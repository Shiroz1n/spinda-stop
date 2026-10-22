import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";

export function verifyDatabaseFile(path) {
  const database = new Database(path, { readonly: true, create: false });
  try {
    const integrity = database.query("PRAGMA integrity_check").get()?.integrity_check;
    const foreignKeys = database.query("PRAGMA foreign_key_check").all();
    if (integrity !== "ok" || foreignKeys.length) throw new Error("O arquivo SQLite não passou na verificação de integridade.");
    return true;
  } finally {
    database.close();
  }
}

export function backupDatabase(sourcePath, destinationPath) {
  const source = resolve(sourcePath);
  const destination = resolve(destinationPath);
  if (source === destination) throw new Error("O backup precisa ser salvo em outro arquivo.");
  if (!existsSync(source)) throw new Error("O banco local ainda não existe; aplique as migrações antes de fazer backup.");
  if (existsSync(destination)) throw new Error("O arquivo de destino já existe; escolha um nome novo para preservar backups anteriores.");
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });

  const database = new Database(source);
  try {
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec("PRAGMA foreign_keys = ON");
    database.query("VACUUM INTO ?1").run(destination);
  } finally {
    database.close();
  }

  try {
    chmodSync(destination, 0o600);
    verifyDatabaseFile(destination);
  } catch (error) {
    rmSync(destination, { force: true });
    throw error;
  }
  return destination;
}

export function restoreDatabase(backupPath, destinationPath) {
  const backup = resolve(backupPath);
  const destination = resolve(destinationPath);
  if (backup === destination) throw new Error("A restauração deve ser feita em um arquivo novo, sem sobrescrever o backup.");
  if (!existsSync(backup)) throw new Error("O arquivo de backup não foi encontrado.");
  if (existsSync(destination)) throw new Error("O arquivo de destino já existe; restaure em um caminho novo.");
  verifyDatabaseFile(backup);
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });

  try {
    copyFileSync(backup, destination);
    chmodSync(destination, 0o600);
    verifyDatabaseFile(destination);
  } catch (error) {
    rmSync(destination, { force: true });
    throw error;
  }
  return destination;
}
