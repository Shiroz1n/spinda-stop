import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Elysia } from "elysia";
import rootApi from "../../../api/index.js";
import catchAllApi from "../../../api/[...path].js";
import { createDatabase } from "../src/db.js";
import { createApiApp, createRateLimiter } from "../src/server.js";

function createApi(options = {}) {
  const database = {
    calls: [],
    async query(sql) {
      this.calls.push(sql);
      return { rows: [{ ok: 1 }], rowCount: 1 };
    },
  };
  const app = createApiApp({
    database,
    env: {
      APP_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret",
      ...options.env,
    },
    ...options,
  });
  return { app, database };
}

test("Elysia serves the health route through Fetch requests", async () => {
  const { app, database } = createApi();
  const response = await app.handle(new Request("http://api.test/api/health"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(database.calls.length, 2);
});

test("health reports a local database without migrations as unavailable", async () => {
  const database = createDatabase(":memory:");
  const app = createApiApp({ database, env: { APP_ENV: "test", APP_ORIGIN: "http://localhost:5173" } });
  try {
    const response = await app.handle(new Request("http://api.test/api/health"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "storage_not_ready");
  } finally {
    await database.close();
  }
});

test("Elysia preserves API errors and body-size limits", async () => {
  const { app } = createApi();
  const wrongOrigin = await app.handle(new Request("http://api.test/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://untrusted.test", "Content-Type": "application/json" },
    body: "{}",
  }));
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json()).error.code, "origin_mismatch");

  const badContentType = await app.handle(new Request("http://api.test/api/test/session", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "text/plain" },
    body: "{}",
  }));
  assert.equal(badContentType.status, 415);
  assert.equal((await badContentType.json()).error.code, "json_required");

  const oversizedBody = await app.handle(new Request("http://api.test/api/test/session", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(128 * 1024) }),
  }));
  assert.equal(oversizedBody.status, 413);
  assert.equal((await oversizedBody.json()).error.code, "body_too_large");
});

test("Elysia keeps OAuth redirect and cookie headers intact", async () => {
  const { app } = createApi();
  const response = await app.handle(new Request("http://api.test/api/auth/github"));

  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")).hostname, "github.com");
  assert.match(response.headers.get("set-cookie") || "", /spinda_oauth_state=/);
});

test("rate limiting does not trust caller supplied X-Forwarded-For values", async () => {
  const { app } = createApi();
  const responses = [];

  for (let attempt = 0; attempt < 30; attempt += 1) {
    responses.push(await app.handle(new Request("http://api.test/api/auth/github", {
      headers: { "X-Forwarded-For": `198.51.100.${attempt + 1}` },
    })));
  }

  assert.equal(responses.filter((response) => response.status === 302).length, 24);
  assert.equal(responses.filter((response) => response.status === 429).length, 6);
  assert.equal((await responses[24].json()).error.code, "rate_limited");
});

test("rate-limit buckets stay capped when callers rotate addresses", () => {
  const limit = createRateLimiter({ limit: 2, windowMs: 60_000, maxBuckets: 2 });
  const requestFor = (remoteAddress) => ({ socket: { remoteAddress } });

  limit(requestFor("192.0.2.1"), "invite");
  limit(requestFor("192.0.2.2"), "invite");
  assert.throws(() => limit(requestFor("192.0.2.3"), "invite"), /Muitas tentativas/);
  assert.doesNotThrow(() => limit(requestFor("192.0.2.1"), "invite"));
  assert.throws(() => limit(requestFor("192.0.2.1"), "invite"), /Muitas tentativas/);
});

test("Vercel deployment context disables the test-session endpoint", async () => {
  const { app } = createApi({ env: {
    APP_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    VERCEL_ENV: "preview",
  } });
  const response = await app.handle(new Request("http://api.test/api/test/session", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "remote-test-session" }),
  }));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("Vercel preview origin enables secure cookies and same-origin writes", async () => {
  const app = createApiApp({
    database: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "preview",
      VERCEL_ENV: "preview",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_BRANCH_URL: "spinda-pr-30.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
    },
  });
  const response = await app.handle(new Request("https://spinda-pr-30.example.vercel.app/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://spinda-pr-30.example.vercel.app", "Content-Type": "application/json" },
    body: "{}",
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /; Secure/);
});

test("Vercel production origin uses the stable project domain", async () => {
  const app = createApiApp({
    database: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_BRANCH_URL: "spinda-main.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
      FRIEND_CODE_ENCRYPTION_KEY: "a".repeat(64),
    },
  });
  const response = await app.handle(new Request("https://spinda-stop.example.com/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://spinda-stop.example.com", "Content-Type": "application/json" },
    body: "{}",
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /; Secure/);
});

test("Vercel production context enforces production encryption settings", () => {
  assert.throws(() => createApiApp({
    database: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "development",
      VERCEL_ENV: "production",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
    },
  }), /FRIEND_CODE_ENCRYPTION_KEY é obrigatória em produção/);

  const app = createApiApp({
    database: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "development",
      VERCEL_ENV: "production",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
      FRIEND_CODE_ENCRYPTION_KEY: "c".repeat(64),
    },
  });

  return app.handle(new Request("https://spinda-stop.example.com/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://spinda-stop.example.com", "Content-Type": "application/json" },
    body: "{}",
  })).then((response) => assert.match(response.headers.get("set-cookie") || "", /; Secure/));
});

test("Vercel API entrypoints export the same Elysia app", () => {
  assert.ok(rootApi instanceof Elysia);
  assert.equal(catchAllApi, rootApi);
});

test("Vercel API routes report the persistent-storage limit without opening a local database", async () => {
  const prior = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    const response = await rootApi.handle(new Request("https://preview.example/api/health"));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "persistent_storage_required",
        message: "Os recursos comunitários aguardam uma hospedagem com armazenamento persistente.",
      },
    });
  } finally {
    if (prior === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prior;
  }
});

test("Vercel config selects its supported Bun runtime family", async () => {
  const config = JSON.parse(await readFile(new URL("../../../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.bunVersion, "1.x");
  const headers = new Map(config.headers.flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])));
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("Permissions-Policy"), "camera=(), geolocation=(), microphone=()");
});
