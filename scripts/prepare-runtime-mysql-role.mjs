import mysql from "mysql2/promise";
import { mysqlConfigFromUrl } from "../apps/api/src/db.js";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db", "mysql"]);
const appEnvironment = process.env.APP_ENV || "development";

function parseLocalUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} precisa ser uma URL MySQL válida.`);
  }
  if (url.protocol !== "mysql:" || !localHosts.has(url.hostname)) {
    throw new Error(`${name} só pode apontar para MySQL local ou efêmero.`);
  }
  return url;
}

if (process.env.VERCEL_ENV || !["development", "test"].includes(appEnvironment)) {
  throw new Error("A preparação automática do usuário MySQL só pode rodar em desenvolvimento ou teste local.");
}

const runtimeUrl = parseLocalUrl(process.env.DATABASE_URL || "", "DATABASE_URL");
const migrationUrl = parseLocalUrl(process.env.DATABASE_MIGRATION_URL || "", "DATABASE_MIGRATION_URL");
const database = decodeURIComponent(runtimeUrl.pathname.slice(1));
const migrationDatabase = decodeURIComponent(migrationUrl.pathname.slice(1));
const runtimeUser = decodeURIComponent(runtimeUrl.username);
const runtimePassword = decodeURIComponent(runtimeUrl.password);
const migrationUser = decodeURIComponent(migrationUrl.username);

if (runtimeUrl.hostname !== migrationUrl.hostname || (runtimeUrl.port || "3306") !== (migrationUrl.port || "3306") || !database || database !== migrationDatabase) {
  throw new Error("As URLs MySQL precisam apontar para o mesmo host, porta e banco.");
}
if (!runtimeUser || !runtimePassword || !migrationUser || runtimeUser === migrationUser || ["root", "admin"].includes(runtimeUser.toLowerCase())) {
  throw new Error("Configure usuários diferentes em DATABASE_URL e DATABASE_MIGRATION_URL.");
}

const runtimeIdentity = `${mysql.escape(runtimeUser)}@'%'`;
const qualified = (table) => `${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
const admin = await mysql.createConnection(mysqlConfigFromUrl(migrationUrl.toString(), { serverless: false }));

const grants = [
  `GRANT SELECT ON ${qualified("users")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, provider, provider_subject, handle) ON ${qualified("users")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (handle) ON ${qualified("users")} TO ${runtimeIdentity}`,
  ...["sessions", "oauth_states", "teams", "rooms", "room_members", "matches", "match_reports", "disputes", "tournaments", "tournament_members"].map((table) => `GRANT SELECT ON ${qualified(table)} TO ${runtimeIdentity}`),
  `GRANT INSERT (token_hash, user_id, expires_at) ON ${qualified("sessions")} TO ${runtimeIdentity}`,
  `GRANT DELETE ON ${qualified("sessions")} TO ${runtimeIdentity}`,
  `GRANT INSERT (token_hash, expires_at) ON ${qualified("oauth_states")} TO ${runtimeIdentity}`,
  `GRANT DELETE ON ${qualified("oauth_states")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, owner_id, name, visibility, data_json, schema_version) ON ${qualified("teams")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (name, visibility, data_json, updated_at) ON ${qualified("teams")} TO ${runtimeIdentity}`,
  `GRANT DELETE ON ${qualified("teams")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, host_id, name, capacity, invite_hash, invite_expires_at) ON ${qualified("rooms")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (status, invite_hash, invite_expires_at, locked_at, finished_at) ON ${qualified("rooms")} TO ${runtimeIdentity}`,
  `GRANT INSERT (room_id, user_id) ON ${qualified("room_members")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (status, checked_in_at, friend_code_ciphertext, friend_code_nonce, friend_code_tag, friend_code_created_at, shared_roster_json, shared_roster_updated_at) ON ${qualified("room_members")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, host_id, name, invite_hash, invite_expires_at) ON ${qualified("tournaments")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (status, invite_hash, invite_expires_at, locked_at, started_at, finished_at, bracket_version, champion_id) ON ${qualified("tournaments")} TO ${runtimeIdentity}`,
  `GRANT INSERT (tournament_id, user_id) ON ${qualified("tournament_members")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (status, seed, checked_in_at, friend_code_ciphertext, friend_code_nonce, friend_code_tag, friend_code_created_at, shared_roster_json, shared_roster_updated_at) ON ${qualified("tournament_members")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, room_id, tournament_id, round_number, bracket_slot, player_a_id, player_b_id) ON ${qualified("matches")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (status, resolved_at) ON ${qualified("matches")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, match_id, reporter_id, winner_id, note) ON ${qualified("match_reports")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, match_id, opened_by, reason) ON ${qualified("disputes")} TO ${runtimeIdentity}`,
  `GRANT UPDATE (status, resolution, moderator_id, resolved_at) ON ${qualified("disputes")} TO ${runtimeIdentity}`,
  `GRANT SELECT (bucket_key, bucket_window, hit_count, expires_at), INSERT (bucket_key, bucket_window, hit_count, expires_at), UPDATE (bucket_window, hit_count, expires_at), DELETE ON ${qualified("api_rate_limits")} TO ${runtimeIdentity}`,
  `GRANT INSERT (id, actor_id, room_id, tournament_id, target_user_id, action, reason) ON ${qualified("moderation_events")} TO ${runtimeIdentity}`,
];

try {
  await admin.query(`CREATE USER IF NOT EXISTS ${runtimeIdentity} IDENTIFIED BY ${mysql.escape(runtimePassword)}`);
  await admin.query(`ALTER USER ${runtimeIdentity} IDENTIFIED BY ${mysql.escape(runtimePassword)} ACCOUNT UNLOCK`);
  await admin.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${runtimeIdentity}`);
  for (const statement of grants) await admin.query(statement);
  const [rows] = await admin.query(`SHOW GRANTS FOR ${runtimeIdentity}`);
  if (rows.some((row) => /ALL PRIVILEGES|GRANT OPTION|schema_migrations/i.test(Object.values(row).join(" ")))) {
    throw new Error("O usuário de runtime recebeu privilégios administrativos inesperados.");
  }
  process.stdout.write("Usuário local de runtime preparado com privilégios de dados limitados e sem DDL.\n");
} catch (error) {
  process.stderr.write(`Falha ao preparar o usuário MySQL de runtime (${error.code || error.name || "erro"}).\n`);
  process.exitCode = 1;
} finally {
  await admin.end();
}
