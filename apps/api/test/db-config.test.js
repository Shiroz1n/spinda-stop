import assert from "node:assert/strict";
import { test } from "node:test";
import { mysqlConfigFromUrl } from "../src/db.js";

test("MySQL URL parsing decodes local credentials without enabling local TLS", () => {
  const config = mysqlConfigFromUrl("mysql://spinda_app:p%40ss%3Aword@127.0.0.1:3307/spinda_stop", { serverless: false });

  assert.equal(config.user, "spinda_app");
  assert.equal(config.password, "p@ss:word");
  assert.equal(config.database, "spinda_stop");
  assert.equal(config.ssl, undefined);
  assert.equal(config.timezone, "Z");
  assert.equal(config.connectionLimit, 8);
});

test("remote MySQL connections require verified TLS and a serverless-sized pool", () => {
  const config = mysqlConfigFromUrl("mysql://spinda_app:credential@mysql.example.test:3306/spinda_preview", { serverless: true });

  assert.deepEqual(config.ssl, { rejectUnauthorized: true, minVersion: "TLSv1.2" });
  assert.equal(config.connectionLimit, 2);
  assert.equal(config.waitForConnections, true);
  assert.equal(config.connectTimeout, 5000);
});

test("invalid schemes, incomplete URLs, and remote TLS downgrade requests are rejected", () => {
  assert.throws(() => mysqlConfigFromUrl("postgresql://user:password@localhost/app"), /protocolo mysql/);
  assert.throws(() => mysqlConfigFromUrl("mysql://user@localhost/app"), /usuário, senha, host e banco/);
  assert.throws(() => mysqlConfigFromUrl("mysql://user:password@mysql.example.test/app?ssl=false"), /TLS não pode ser desativado/);
});
