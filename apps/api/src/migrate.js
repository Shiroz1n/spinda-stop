import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { mysqlConfigFromUrl } from "./db.js";

const directory = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
const connection = await mysql.createConnection(mysqlConfigFromUrl(connectionString, { serverless: false }));
const lockName = "spinda-stop-schema-migrations";

async function executeStatements(sql) {
  const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await connection.query(statement);
}

try {
  await connection.query("SET time_zone = '+00:00'");
  const [[lock]] = await connection.execute("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
  if (lock.acquired !== 1) throw new Error("Não foi possível obter o bloqueio de migrações MySQL.");

  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
       checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
       applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
     ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin`,
  );

  const [appliedRows] = await connection.execute("SELECT version, checksum FROM schema_migrations");
  const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));
  const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

  for (const version of migrations) {
    const sql = await readFile(join(directory, version), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (applied.has(version)) {
      if (applied.get(version) !== checksum) throw new Error(`A migração ${version} mudou depois de aplicada; crie uma nova versão.`);
      continue;
    }

    // MySQL commits DDL implicitly. Each statement is idempotent so an interrupted
    // migration can be rerun, and its version is recorded only after all DDL succeeds.
    await executeStatements(sql);
    await connection.execute("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [version, checksum]);
    process.stdout.write(`Migração MySQL aplicada: ${version}\n`);
  }
} finally {
  await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
  await connection.end();
}
