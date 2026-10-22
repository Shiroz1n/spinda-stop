import mysql from "mysql2/promise";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function mysqlConfigFromUrl(connectionString, { serverless = Boolean(process.env.VERCEL_ENV) } = {}) {
  if (!connectionString) throw new Error("DATABASE_URL não foi configurada.");

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL precisa ser uma URL MySQL válida.");
  }

  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL precisa usar o protocolo mysql://.");
  if (!url.hostname || !url.username || !url.password || !url.pathname.slice(1)) {
    throw new Error("DATABASE_URL precisa informar usuário, senha, host e banco.");
  }

  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (!isLocal && url.searchParams.get("ssl") === "false") {
    throw new Error("TLS não pode ser desativado para conexões MySQL remotas.");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: isLocal ? undefined : { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    timezone: "Z",
    dateStrings: false,
    decimalNumbers: true,
    bigNumberStrings: false,
    flags: ["FOUND_ROWS"],
    waitForConnections: true,
    connectionLimit: serverless ? 2 : 8,
    maxIdle: serverless ? 2 : 8,
    idleTimeout: serverless ? 10_000 : 30_000,
    queueLimit: 0,
    connectTimeout: 5_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    typeCast(field, next) {
      if (field.type === "TINY" && field.length === 1) {
        const value = field.string();
        return value === null ? null : value === "1";
      }
      return next();
    },
  };
}

function normalizeResult(result) {
  if (Array.isArray(result)) return { rows: result, rowCount: result.length };
  return {
    rows: [],
    rowCount: result.affectedRows,
    insertId: result.insertId,
  };
}

function clientFor(connection) {
  return {
    async query(sql, parameters = []) {
      const transactionCommand = /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i.test(sql);
      if (transactionCommand) {
        const [result] = await connection.query(sql);
        return normalizeResult(result);
      }
      const [result] = await connection.execute(sql, parameters);
      return normalizeResult(result);
    },
    release() {
      connection.release();
    },
  };
}

async function initializeConnection(connection) {
  if (connection.__spindaUtcReady) return;
  await connection.query("SET time_zone = '+00:00'");
  // Match PostgreSQL's default transaction semantics for workflows that combine
  // a locking read with later reads in the same transaction.
  await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
  connection.__spindaUtcReady = true;
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  const pool = mysql.createPool(mysqlConfigFromUrl(connectionString));

  return {
    async query(sql, parameters = []) {
      const connection = await pool.getConnection();
      try {
        await initializeConnection(connection);
        const transactionCommand = /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i.test(sql);
        const [result] = transactionCommand
          ? await connection.query(sql)
          : await connection.execute(sql, parameters);
        return normalizeResult(result);
      } finally {
        connection.release();
      }
    },
    async connect() {
      const connection = await pool.getConnection();
      try {
        await initializeConnection(connection);
      } catch (error) {
        connection.release();
        throw error;
      }
      return clientFor(connection);
    },
    end() {
      return pool.end();
    },
  };
}
