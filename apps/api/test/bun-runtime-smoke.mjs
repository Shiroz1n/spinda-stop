import assert from "node:assert/strict";
import { createApiApp } from "../src/server.js";

const rateBuckets = new Map();
const pool = {
  async query(sql, values = []) {
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
    return { rows: [{ ok: 1 }], rowCount: 1 };
  },
};

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

  const oauth = await fetch(`http://127.0.0.1:${port}/api/auth/github`, { redirect: "manual" });
  assert.equal(oauth.status, 302);
  assert.match(oauth.headers.get("set-cookie") || "", /spinda_oauth_state=/);

  process.stdout.write(`Bun ${process.versions.bun} + Elysia HTTP smoke passed.\n`);
} finally {
  await app.stop();
}
