import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createDatabase } from "../src/db.js";
import { migrateDatabase } from "../src/migrate.js";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "spinda-bun-smoke-"));
const databasePath = join(temporaryDirectory, "smoke.sqlite");
const database = createDatabase(databasePath);
await migrateDatabase(database);
await database.close();

const apiFile = new URL("../src/server.js", import.meta.url).pathname;
const repositoryRoot = new URL("../../..", import.meta.url).pathname;
const webServer = createServer();
webServer.listen(0, "127.0.0.1");
await once(webServer, "listening");
const port = webServer.address().port;
await new Promise((resolve) => webServer.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child;

function startApi() {
  child = spawn(process.execPath, ["--env-file-if-exists=.env", apiFile], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      APP_ENV: "test",
      APP_ORIGIN: origin,
      API_HOST: "127.0.0.1",
      API_PORT: String(port),
      SPINDA_DB_PATH: databasePath,
      GITHUB_CLIENT_ID: "smoke-tx",
      GITHUB_CLIENT_SECRET: "smoke-secret",
    },
  });
  return child;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Bun API exited early (${child.exitCode}).`);
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // The listener is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Bun API did not become healthy in six seconds.");
}

async function stopApi() {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

try {
  startApi();
  await waitForHealth();
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const oauth = await fetch(`${origin}/api/auth/github`, { redirect: "manual" });
  assert.equal(oauth.status, 302);
  assert.match(oauth.headers.get("set-cookie") || "", /spinda_oauth_state=/);

  const sessionResponse = await fetch(`${origin}/api/test/session`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "sqlite-smoke" }),
  });
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  assert.equal(session.user.handle, "sqlite-smoke");
  const cookie = sessionResponse.headers.get("set-cookie").split(";")[0];

  const teams = await fetch(`${origin}/api/teams`, { headers: { Cookie: cookie } });
  assert.equal(teams.status, 200);
  assert.deepEqual(await teams.json(), { teams: [] });

  await stopApi();
  startApi();
  await waitForHealth();
  const restoredSession = await fetch(`${origin}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(restoredSession.status, 200);
  assert.equal((await restoredSession.json()).user.handle, "sqlite-smoke");

  process.stdout.write(`Bun ${process.versions.bun} + Elysia + SQLite HTTP smoke passed, including API restart persistence.\n`);
} finally {
  await stopApi();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
