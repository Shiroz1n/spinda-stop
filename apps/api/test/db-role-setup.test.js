import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const setupScript = new URL("../../../scripts/prepare-runtime-mysql-role.mjs", import.meta.url);

function runSetup(env) {
  return spawnSync(process.execPath, [setupScript.pathname], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      APP_ENV: "test",
      DATABASE_URL: "mysql://spinda_app:fake@127.0.0.1:3306/spinda_test",
      DATABASE_MIGRATION_URL: "mysql://spinda:fake@127.0.0.1:3306/spinda_test",
      ...env,
    },
  });
}

test("database-role preparation refuses every Vercel environment before connecting", () => {
  const result = runSetup({ VERCEL_ENV: "preview" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /só pode rodar em desenvolvimento ou teste local/);
  assert.doesNotMatch(result.stderr, /127\.0\.0\.1|spinda_test|fake/);
});

test("database-role preparation refuses remote MySQL hosts before connecting", () => {
  const result = runSetup({
    DATABASE_URL: "mysql://spinda_app:fake@198.51.100.2:3306/spinda_test",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /só pode apontar para MySQL local ou efêmero/);
  assert.doesNotMatch(result.stderr, /198\.51\.100\.2|fake/);
});
