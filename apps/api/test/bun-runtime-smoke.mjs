import assert from "node:assert/strict";
import { createApiApp } from "../src/server.js";

const app = createApiApp({
  pool: { query: async () => ({ rows: [{ ok: 1 }], rowCount: 1 }) },
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

  const oauth = await fetch(`http://127.0.0.1:${port}/api/auth/github`, { redirect: "manual" });
  assert.equal(oauth.status, 302);
  assert.match(oauth.headers.get("set-cookie") || "", /spinda_oauth_state=/);

  process.stdout.write(`Bun ${process.versions.bun} + Elysia HTTP smoke passed.\n`);
} finally {
  await app.stop();
}
