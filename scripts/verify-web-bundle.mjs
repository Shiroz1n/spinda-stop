import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = join(root, "apps/web/dist");
const forbiddenNames = /\.(?:sqlite3?|db)(?:-(?:wal|shm|journal))?$/i;
const forbiddenText = /DATABASE_URL|DATABASE_MIGRATION_URL|SPINDA_DB_PATH|FRIEND_CODE_ENCRYPTION_KEY|GITHUB_CLIENT_SECRET|bun:sqlite|apps\/api\/src/;
const textExtensions = new Set([".html", ".js", ".css", ".json", ".map"]);
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else files.push(path);
  }
}

try {
  await collect(output);
} catch {
  throw new Error("Build web não encontrado; rode npm run build antes de verificar o bundle.");
}

assert.ok(files.length > 0, "Build web deve conter arquivos publicáveis.");
for (const path of files) {
  assert.equal(forbiddenNames.test(path), false, "O bundle não pode incluir arquivo SQLite, banco ou sidecar.");
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 16).equals(Buffer.from("SQLite format 3\0")), false, "O bundle não pode publicar um banco SQLite com extensão renomeada.");
  if (!textExtensions.has(extname(path))) continue;
  const contents = bytes.toString("utf8");
  assert.equal(forbiddenText.test(contents), false, "O bundle web contém marcador de configuração ou código privado do servidor.");
}

process.stdout.write(`Bundle web verificado: ${files.length} arquivos, sem banco SQLite ou marcadores de configuração de servidor.\n`);
