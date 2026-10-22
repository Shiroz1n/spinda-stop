import { AsyncLocalStorage } from "node:async_hooks";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const transactionContext = new AsyncLocalStorage();
const DEFAULT_DATABASE_PATH = ".local/spinda-stop.sqlite";

function configuredPath(value) {
  const input = value || DEFAULT_DATABASE_PATH;
  if (input === ":memory:") return input;
  return isAbsolute(input) ? resolve(input) : resolve(repositoryRoot, input);
}

function encodeValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object" && !ArrayBuffer.isView(value) && !(value instanceof ArrayBuffer)) {
    return JSON.stringify(value);
  }
  return value;
}

function decodeRow(row) {
  if (!row) return row;
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith("_json") && typeof value === "string") row[key] = JSON.parse(value);
  }
  return row;
}

function resultFor(database, sql, parameters = []) {
  const statement = database.query(sql);
  const values = parameters.map(encodeValue);
  if (/\b(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
    const rows = statement.all(...values).map(decodeRow);
    return { rows, rowCount: rows.length };
  }
  const result = statement.run(...values);
  return { rows: [], rowCount: result.changes };
}

export function resolveDatabasePath(value = process.env.SPINDA_DB_PATH) {
  return configuredPath(value);
}

export function createDatabase(databasePath = process.env.SPINDA_DB_PATH) {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error("SQLite em arquivo não é persistente em funções Vercel; configure uma hospedagem com disco persistente antes de iniciar a API.");
  }

  const path = configuredPath(databasePath);
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  }
  const database = new Database(path, { create: true, readwrite: true });
  const memoryDatabase = path === ":memory:";
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec(`PRAGMA journal_mode = ${memoryDatabase ? "MEMORY" : "WAL"}`);
    database.exec("PRAGMA synchronous = FULL");
    if (database.query("PRAGMA foreign_keys").get()?.foreign_keys !== 1) {
      throw new Error("O SQLite não habilitou foreign_keys na conexão.");
    }
    if (!memoryDatabase) chmodSync(path, 0o600);
  } catch (error) {
    database.close();
    throw error;
  }

  let lockTail = Promise.resolve();
  let closed = false;

  async function withLock(action) {
    let release;
    const gate = new Promise((resolveGate) => { release = resolveGate; });
    const previous = lockTail;
    lockTail = previous.then(() => gate, () => gate);
    await previous;
    try {
      if (closed) throw new Error("A conexão SQLite já foi encerrada.");
      return await action();
    } finally {
      release();
    }
  }

  async function query(sql, parameters = []) {
    if (transactionContext.getStore() === database) {
      if (closed) throw new Error("A conexão SQLite já foi encerrada.");
      return resultFor(database, sql, parameters);
    }
    return withLock(() => resultFor(database, sql, parameters));
  }

  async function exec(sql) {
    if (transactionContext.getStore() === database) {
      database.exec(sql);
      return;
    }
    return withLock(() => database.exec(sql));
  }

  async function transaction(action) {
    return withLock(() => transactionContext.run(database, async () => {
      database.exec("BEGIN IMMEDIATE");
      try {
        const result = await action({ query, exec });
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }));
  }

  return {
    path,
    query,
    exec,
    transaction,
    async close() {
      await withLock(() => {
        closed = true;
        database.close();
      });
    },
  };
}
