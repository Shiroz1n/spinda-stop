import pg from "pg";

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL não foi configurada.");
  const serverless = Boolean(process.env.VERCEL_ENV);
  return new pg.Pool({
    connectionString,
    max: serverless ? 2 : 8,
    idleTimeoutMillis: serverless ? 10_000 : 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
