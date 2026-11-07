import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./db.js";

const directory = join(dirname(fileURLToPath(import.meta.url)), "../migrations");

export async function migrateDatabase(database) {
  await database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

  for (const version of migrations) {
    const sql = await readFile(join(directory, version), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const didApply = await database.transaction(async (tx) => {
      const existing = (await tx.query("SELECT checksum FROM schema_migrations WHERE version = ?1", [version])).rows[0];
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`A migração SQLite ${version} foi alterada depois de aplicada; crie uma nova versão de migração.`);
        return false;
      }
      await tx.exec(sql);
      await tx.query("INSERT INTO schema_migrations (version, checksum) VALUES (?1, ?2)", [version, checksum]);
      return true;
    });
    if (didApply) process.stdout.write(`Migração SQLite aplicada: ${version}\n`);
  }

  const violations = await database.query("PRAGMA foreign_key_check");
  if (violations.rowCount) throw new Error("A verificação de integridade referencial do SQLite encontrou violações após as migrações.");
  return migrations;
}

if (import.meta.main) {
  const database = createDatabase();
  try {
    await migrateDatabase(database);
  } catch (error) {
    process.stderr.write(`Falha ao aplicar migrações SQLite (${error.name || "erro"}).\n`);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}
