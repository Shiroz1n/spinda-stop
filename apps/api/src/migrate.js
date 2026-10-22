import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./db.js";

const directory = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
const pool = createPool(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL);
const client = await pool.connect();

try {
  await client.query("SELECT pg_advisory_lock(1397771329)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await client.query("SELECT version FROM schema_migrations")).rows.map((row) => row.version));
  const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

  for (const version of migrations) {
    if (applied.has(version)) continue;
    const sql = await readFile(join(directory, version), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      process.stdout.write(`Migração aplicada: ${version}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(1397771329)").catch(() => {});
  client.release();
  await pool.end();
}
