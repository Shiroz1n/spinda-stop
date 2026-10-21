import assert from "node:assert/strict";
import { test } from "node:test";
import { Elysia } from "elysia";
import rootApi from "../../../api/index.js";
import catchAllApi from "../../../api/[...path].js";
import { createApiApp } from "../src/server.js";

function createApi(options = {}) {
  const pool = {
    calls: [],
    async query(sql) {
      this.calls.push(sql);
      return { rows: [{ ok: 1 }], rowCount: 1 };
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

test("Vercel preview origin enables secure cookies and same-origin writes", async () => {
  const app = createApiApp({
    pool: { query: async () => ({ rows: [], rowCount: 1 }) },
    env: { APP_ENV: "preview", VERCEL_URL: "spinda-preview.example.vercel.app" },
  });
  const response = await app.handle(new Request("https://spinda-preview.example.vercel.app/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://spinda-preview.example.vercel.app", "Content-Type": "application/json" },
    body: "{}",
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /; Secure/);
});

test("Vercel API entrypoints export the same Elysia app", () => {
  assert.ok(rootApi instanceof Elysia);
  assert.equal(catchAllApi, rootApi);
});
