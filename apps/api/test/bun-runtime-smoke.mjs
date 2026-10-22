import assert from "node:assert/strict";
import { createApiApp } from "../src/server.js";
import { createPool } from "../src/db.js";

if (!process.env.DATABASE_URL) throw new Error("O smoke test Bun exige DATABASE_URL para MySQL efêmero.");
const pool = createPool();

const app = createApiApp({
  pool,
  env: {
    APP_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    GITHUB_CLIENT_ID: "smoke-client",
    GITHUB_CLIENT_SECRET: "smoke-secret",
  },
});

app.listen({ hostname: "127.0.0.1", port: 0 });

try {
  const port = app.server?.port;
  assert.ok(port, "Bun started the Elysia server on an ephemeral port");

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  const base = `http://127.0.0.1:${port}`;
  const oauth = await fetch(`${base}/api/auth/github`, { redirect: "manual" });
  assert.equal(oauth.status, 302);
  assert.match(oauth.headers.get("set-cookie") || "", /spinda_oauth_state=/);

  const handle = `bun-http-${Date.now()}`;
  const login = await fetch(`${base}/api/test/session`, {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  assert.equal(login.status, 200);
  const session = login.headers.get("set-cookie")?.split(";")[0];
  assert.match(session || "", /^spinda_session=/);

  const me = await fetch(`${base}/api/me`, { headers: { Cookie: session } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.handle, handle);

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "http://localhost:5173", Cookie: session, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { ok: true });
  assert.equal((await (await fetch(`${base}/api/me`, { headers: { Cookie: session } })).json()).user, null);

  process.stdout.write(`Bun ${process.versions.bun} + Elysia + MySQL HTTP smoke passed (health, OAuth start, session, logout).\n`);
} finally {
  await app.stop();
  await pool.end();
}
