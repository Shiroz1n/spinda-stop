import { existsSync, lstatSync, rmSync } from "node:fs";
import { resolveDatabasePath, createDatabase } from "../apps/api/src/db.js";
import { migrateDatabase } from "../apps/api/src/migrate.js";
import { dirname } from "node:path";

export function resolveResetTarget(configuredPath = process.env.SPINDA_DB_PATH) {
  const defaultPath = resolveDatabasePath(".local/spinda-stop.sqlite");
  if (configuredPath && resolveDatabasePath(configuredPath) !== defaultPath) {
    throw new Error("O arquivo configurado não é o banco local padrão; nada foi removido.");
  }
  return defaultPath;
}

if (import.meta.main) {
  if (process.env.VERCEL || process.env.VERCEL_ENV || (process.env.APP_ENV && process.env.APP_ENV !== "development")) {
    throw new Error("Reset só é permitido no ambiente local de desenvolvimento.");
  }
  const databasePath = resolveResetTarget();
  for (const path of [dirname(databasePath), databasePath]) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      throw new Error("O caminho do banco local usa link simbólico; nada foi removido.");
    }
  }
  if (["-wal", "-shm", "-journal"].some((suffix) => existsSync(`${databasePath}${suffix}`))) {
    throw new Error("Pare a API antes do reset; há arquivos SQLite ativos ou pendentes.");
  }

  for (const suffix of ["", "-shm", "-journal"]) rmSync(`${databasePath}${suffix}`, { force: true });
  const database = createDatabase(databasePath);
  try {
    await migrateDatabase(database);
  } finally {
    await database.close();
  }
  process.stdout.write("Banco local de desenvolvimento recriado e migrado.\n");
}
