import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Elysia } from "elysia";
import rootApi from "../../../api/index.js";
import catchAllApi from "../../../api/[...path].js";
import { createApiApp, createRateLimiter } from "../src/server.js";

function createApi(options = {}) {
  const rateBuckets = new Map();
  const pool = {
    calls: [],
    async query(sql, values = []) {
      this.calls.push(sql);
      if (sql.includes("INSERT INTO api_rate_limits")) {
        const [bucketKey, bucketWindow, , maximumCount] = values;
        const current = rateBuckets.get(bucketKey);
        const hitCount = current?.bucketWindow === bucketWindow ? Math.min(current.hitCount + 1, maximumCount) : 1;
        rateBuckets.set(bucketKey, { bucketWindow, hitCount });
        return { rows: [{ hit_count: hitCount }], rowCount: 1 };
      }
      if (sql.includes("SELECT count(*)::int AS count FROM api_rate_limits")) {
        return { rows: [{ count: rateBuckets.size }], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM api_rate_limits WHERE bucket_key")) {
        rateBuckets.delete(values[0]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [{ ok: 1 }], rowCount: 1 };
    },
    async connect() {
      return { query: this.query.bind(this), release() {} };
    },
  };
  const app = createApiApp({
    pool,
    env: {
      APP_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret",
      ...options.env,
    },
    ...options,
  });
  return { app, pool };
}

test("Elysia serves the health route through Fetch requests", async () => {
  const { app, pool } = createApi();
  const response = await app.handle(new Request("http://api.test/api/health"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(pool.calls.length, 1);
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

test("rate-limit buckets stay capped when callers rotate addresses", async () => {
  const { pool } = createApi();
  const limit = createRateLimiter({ pool, limit: 2, windowMs: 60_000, maxBuckets: 2 });
  const requestFor = (remoteAddress) => ({ socket: { remoteAddress } });

  await limit(requestFor("192.0.2.1"), "invite");
  await limit(requestFor("192.0.2.2"), "invite");
  await assert.rejects(limit(requestFor("192.0.2.3"), "invite"), /Muitas tentativas/);
  await limit(requestFor("192.0.2.1"), "invite");
  await assert.rejects(limit(requestFor("192.0.2.1"), "invite"), /Muitas tentativas/);
});

test("independent Elysia handlers share rate-limit storage", async () => {
  const { app: first, pool } = createApi();
  const second = createApi({ pool }).app;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const app = attempt % 2 === 0 ? first : second;
    const response = await app.handle(new Request("http://api.test/api/auth/github"));
    assert.equal(response.status, 302);
  }
  const denied = await second.handle(new Request("http://api.test/api/auth/github"));
  assert.equal(denied.status, 429);
  assert.equal((await denied.json()).error.code, "rate_limited");
});

test("scheduled cleanup requires its bearer secret and clears only through the authenticated route", async () => {
  const { app, pool } = createApi({ env: { CRON_SECRET: "test-cron-secret" } });
  const unauthorized = await app.handle(new Request("http://api.test/api/cron/cleanup"));
  assert.equal(unauthorized.status, 401);

  const authorized = await app.handle(new Request("http://api.test/api/cron/cleanup", {
    headers: { Authorization: "Bearer test-cron-secret" },
  }));
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {
    ok: true,
    cleanup: { sessions: 1, oauthStates: 1, rateLimitBuckets: 1, roomFriendCodes: 1, tournamentFriendCodes: 1 },
  });
  assert.equal(pool.calls.filter((sql) => /DELETE FROM sessions|DELETE FROM oauth_states|DELETE FROM api_rate_limits/.test(sql)).length, 3);
});

test("Vercel deployment context disables the test-session endpoint", async () => {
  const { app } = createApi({ env: {
    APP_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    VERCEL_ENV: "preview",
    RATE_LIMIT_HASH_SECRET: "local-test-rate-secret",
  } });
  const response = await app.handle(new Request("http://api.test/api/test/session", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "remote-test-session" }),
  }));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("Vercel API requires the keyed rate-limit identifier secret", () => {
  assert.throws(() => createApiApp({
    pool: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "spinda-preview.example.vercel.app",
    },
  }), /RATE_LIMIT_HASH_SECRET é obrigatória/);
});

test("Vercel preview origin enables secure cookies and same-origin writes", async () => {
  const app = createApiApp({
    pool: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "preview",
      VERCEL_ENV: "preview",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_BRANCH_URL: "spinda-pr-30.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
      RATE_LIMIT_HASH_SECRET: "local-test-rate-secret",
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
    pool: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_BRANCH_URL: "spinda-main.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
      FRIEND_CODE_ENCRYPTION_KEY: "a".repeat(64),
      RATE_LIMIT_HASH_SECRET: "local-test-rate-secret",
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
    pool: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "development",
      VERCEL_ENV: "production",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
      RATE_LIMIT_HASH_SECRET: "local-test-rate-secret",
    },
  }), /FRIEND_CODE_ENCRYPTION_KEY é obrigatória em produção/);

  const app = createApiApp({
    pool: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: {
      APP_ENV: "development",
      VERCEL_ENV: "production",
      VERCEL_URL: "spinda-deploy-123.example.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "spinda-stop.example.com",
      FRIEND_CODE_ENCRYPTION_KEY: "c".repeat(64),
      RATE_LIMIT_HASH_SECRET: "local-test-rate-secret",
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

test("Vercel config selects its supported Bun runtime family", async () => {
  const config = JSON.parse(await readFile(new URL("../../../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.bunVersion, "1.x");
  const headers = new Map(config.headers.flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])));
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("Permissions-Policy"), "camera=(), geolocation=(), microphone=()");
});
