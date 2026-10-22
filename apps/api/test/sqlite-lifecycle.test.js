import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { createDatabase, resolveDatabasePath } from "../src/db.js";
import { migrateDatabase } from "../src/migrate.js";
import { cleanupExpiredData } from "../src/server.js";
import { backupDatabase, restoreDatabase, verifyDatabaseFile } from "../src/sqlite-files.js";
import { resolveResetTarget } from "../../../scripts/reset-local-database.mjs";

const resetScript = new URL("../../../scripts/reset-local-database.mjs", import.meta.url);

async function withDatabase(action) {
  const directory = await mkdtemp(join(tmpdir(), "spinda-sqlite-test-"));
  const path = join(directory, "database.sqlite");
  const database = createDatabase(path);
  try {
    await migrateDatabase(database);
    return await action({ directory, path, database });
  } finally {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function userValues(id, handle = "tester") {
  return [id, handle, handle];
}

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

test("migrations are repeatable, versioned, and reject changed history", async () => {
  await withDatabase(async ({ database }) => {
    await migrateDatabase(database);
    assert.equal((await database.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count, 3);
    assert.equal((await database.query("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
    assert.equal((await database.query("PRAGMA foreign_key_check")).rowCount, 0);

    await database.query("UPDATE schema_migrations SET checksum = ?1 WHERE version = ?2", ["changed", "001_community.sql"]);
    await assert.rejects(migrateDatabase(database), /alterada depois de aplicada/);
  });
});

test("each file connection enables foreign keys, WAL and a bounded busy wait", async () => {
  await withDatabase(async ({ path, directory, database }) => {
    assert.equal((await database.query("PRAGMA foreign_keys")).rows[0].foreign_keys, 1);
    assert.equal((await database.query("PRAGMA journal_mode")).rows[0].journal_mode, "wal");
    assert.equal((await database.query("PRAGMA busy_timeout")).rows[0].timeout, 5000);
    assert.equal((await database.query("PRAGMA synchronous")).rows[0].synchronous, 2);
    if (process.platform !== "win32") {
      assert.equal((await stat(path)).mode & 0o777, 0o600);
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
    }
  });
});

test("relative database paths are anchored to the repository and Vercel refuses local files", () => {
  const repositoryRoot = new URL("../../..", import.meta.url).pathname;
  assert.equal(resolveDatabasePath(".local/example.sqlite"), join(repositoryRoot, ".local/example.sqlite"));

  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    assert.throws(() => createDatabase(":memory:"), /não é persistente em funções Vercel/);
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("foreign keys, JSON checks and multi-statement writes roll back", async () => {
  await withDatabase(async ({ database }) => {
    await assert.rejects(database.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", ["not-a-uuid", "invalid-id", "Invalid"]));
    const ownerId = uuid(11);
    await database.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(ownerId));
    await assert.rejects(database.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)", ["a".repeat(64), uuid(12), "2030-01-01T00:00:00.000Z"]));
    await assert.rejects(database.query("INSERT INTO teams (id, owner_id, name, data_json, schema_version) VALUES (?1, ?2, ?3, ?4, 1)", [uuid(13), ownerId, "Equipe", "not-json"]));
    await database.query("INSERT INTO teams (id, owner_id, name, data_json, schema_version) VALUES (?1, ?2, 'Cascade', ?3, 1)", [uuid(14), ownerId, { members: [] }]);
    await database.query("DELETE FROM users WHERE id = ?1", [ownerId]);
    assert.equal((await database.query("SELECT count(*) AS count FROM teams WHERE id = ?1", [uuid(14)])).rows[0].count, 0);

    await assert.rejects(database.transaction(async (tx) => {
      await tx.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(uuid(21), "Rollback"));
      await tx.query("INSERT INTO teams (id, owner_id, name, data_json, schema_version) VALUES (?1, ?2, ?3, ?4, 1)", [uuid(22), uuid(21), "Equipe", { members: [] }]);
      throw new Error("force rollback");
    }), /force rollback/);

    assert.equal((await database.query("SELECT count(*) AS count FROM users WHERE id = ?1", [uuid(21)])).rows[0].count, 0);
    assert.equal((await database.query("SELECT count(*) AS count FROM teams WHERE id = ?1", [uuid(22)])).rows[0].count, 0);
  });
});

test("bound adversarial text remains data and concurrent writes serialize", async () => {
  await withDatabase(async ({ database }) => {
    const payload = "x'); DROP TABLE teams; --";
    await database.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(uuid(31), payload));
    const writes = Array.from({ length: 32 }, (_, index) => database.transaction(async (tx) => {
      await tx.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(uuid(100 + index), `parallel-${index}`));
    }));
    await Promise.all(writes);

    assert.equal((await database.query("SELECT handle FROM users WHERE id = ?1", [uuid(31)])).rows[0].handle, payload);
    assert.equal((await database.query("SELECT count(*) AS count FROM users WHERE provider_subject LIKE 'parallel-%'")).rows[0].count, 32);
    assert.equal((await database.query("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'teams'")).rows[0].count, 1);
  });
});

test("the database file persists after reopening the API connection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "spinda-sqlite-reopen-"));
  const path = join(directory, "database.sqlite");
  let database = createDatabase(path);
  try {
    await migrateDatabase(database);
    await database.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(uuid(41), "Persistent"));
    await database.close();

    database = createDatabase(path);
    assert.equal((await database.query("SELECT handle FROM users WHERE id = ?1", [uuid(41)])).rows[0].handle, "Persistent");
  } finally {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("backup and restore produce independently verified SQLite files", async () => {
  await withDatabase(async ({ directory, path, database }) => {
    await database.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(uuid(51), "Backed up"));
    const backup = backupDatabase(path, join(directory, "snapshot.sqlite"));
    const restored = restoreDatabase(backup, join(directory, "restored.sqlite"));
    assert.equal(verifyDatabaseFile(backup), true);
    assert.equal(verifyDatabaseFile(restored), true);

    const copy = createDatabase(restored);
    try {
      assert.equal((await copy.query("SELECT handle FROM users WHERE id = ?1", [uuid(51)])).rows[0].handle, "Backed up");
    } finally {
      await copy.close();
    }
  });
});

test("expired sessions, OAuth states, and friend codes are cleared idempotently", async () => {
  await withDatabase(async ({ database }) => {
    const expired = "2020-01-01T00:00:00.000Z";
    const userId = uuid(61);
    const roomId = uuid(62);
    await database.query("INSERT INTO users (id, provider, provider_subject, handle) VALUES (?1, 'test', ?2, ?3)", userValues(userId, "Cleanup"));
    await database.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)", ["a".repeat(64), userId, expired]);
    await database.query("INSERT INTO oauth_states (token_hash, expires_at) VALUES (?1, ?2)", ["b".repeat(64), expired]);
    await database.query(
      "INSERT INTO rooms (id, host_id, name, invite_hash, invite_expires_at) VALUES (?1, ?2, 'Old room', ?3, ?4)",
      [roomId, userId, "c".repeat(64), "2030-01-01T00:00:00.000Z"],
    );
    await database.query(
      `INSERT INTO room_members (room_id, user_id, friend_code_ciphertext, friend_code_nonce, friend_code_tag, friend_code_created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [roomId, userId, Buffer.from("ciphertext"), Buffer.from("nonce"), Buffer.from("tag"), expired],
    );

    await cleanupExpiredData(database);
    await cleanupExpiredData(database);

    assert.equal((await database.query("SELECT count(*) AS count FROM sessions WHERE token_hash = ?1", ["a".repeat(64)])).rows[0].count, 0);
    assert.equal((await database.query("SELECT count(*) AS count FROM oauth_states WHERE token_hash = ?1", ["b".repeat(64)])).rows[0].count, 0);
    const member = await database.query("SELECT friend_code_ciphertext, friend_code_nonce, friend_code_tag, friend_code_created_at FROM room_members WHERE room_id = ?1", [roomId]);
    assert.deepEqual(member.rows[0], { friend_code_ciphertext: null, friend_code_nonce: null, friend_code_tag: null, friend_code_created_at: null });
  });
});

test("the reset command refuses Vercel and a custom data path", () => {
  assert.equal(resolveResetTarget(".local/spinda-stop.sqlite"), resolveDatabasePath(".local/spinda-stop.sqlite"));
  assert.throws(() => resolveResetTarget("/tmp/do-not-reset.sqlite"), /não é o banco local padrão/);

  const runReset = (env) => spawnSync(process.execPath, [resetScript.pathname], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...env },
  });
  const vercel = runReset({ APP_ENV: "development", VERCEL_ENV: "preview" });
  assert.notEqual(vercel.status, 0);
  assert.match(vercel.stderr, /só é permitido no ambiente local de desenvolvimento/);

  const customPath = runReset({ APP_ENV: "development", SPINDA_DB_PATH: "/tmp/do-not-reset.sqlite" });
  assert.notEqual(customPath.status, 0);
  assert.match(customPath.stderr, /não é o banco local padrão/);
});
