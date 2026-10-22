import { backupDatabase } from "../apps/api/src/sqlite-files.js";
import { resolveDatabasePath } from "../apps/api/src/db.js";

if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error("Backup local indisponível em ambiente Vercel.");
const requestedPath = process.argv[2] || `.local-backups/spinda-stop-${new Date().toISOString().replaceAll(":", "-")}.sqlite`;
const destination = backupDatabase(resolveDatabasePath(), resolveDatabasePath(requestedPath));
process.stdout.write(`Backup SQLite criado e verificado: ${destination}\n`);
