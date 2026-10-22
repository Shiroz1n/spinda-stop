import { restoreDatabase } from "../apps/api/src/sqlite-files.js";
import { resolveDatabasePath } from "../apps/api/src/db.js";

if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error("Restauração local indisponível em ambiente Vercel.");
const [backupArgument, destinationArgument] = process.argv.slice(2);
if (!backupArgument || !destinationArgument) {
  throw new Error("Uso: npm run api:restore -- <backup.sqlite> <novo-arquivo.sqlite>");
}
const restored = restoreDatabase(resolveDatabasePath(backupArgument), resolveDatabasePath(destinationArgument));
process.stdout.write(`Backup restaurado e verificado em um arquivo novo: ${restored}\n`);
