import pg from "pg";

function databaseName(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

function localDatabaseUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} precisa ser uma URL PostgreSQL válida.`);
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "postgres"]);
  if (!/^postgres(?:ql)?:$/.test(url.protocol) || !localHosts.has(url.hostname)) {
    throw new Error(`${name} só pode apontar para PostgreSQL local ou efêmero.`);
  }
  return url;
}

const appEnvironment = process.env.APP_ENV || "development";
if (process.env.VERCEL_ENV || !["development", "test"].includes(appEnvironment)) {
  throw new Error("A preparação automática do papel PostgreSQL só pode rodar em desenvolvimento ou teste local.");
}

const runtimeUrl = localDatabaseUrl(process.env.DATABASE_URL || "", "DATABASE_URL");
const migrationUrl = localDatabaseUrl(process.env.DATABASE_MIGRATION_URL || "", "DATABASE_MIGRATION_URL");
const database = databaseName(runtimeUrl);
const migrationDatabase = databaseName(migrationUrl);
const runtimeRole = decodeURIComponent(runtimeUrl.username);
const runtimePassword = decodeURIComponent(runtimeUrl.password);
const migrationRole = decodeURIComponent(migrationUrl.username);

if (!database || database !== migrationDatabase) throw new Error("As URLs PostgreSQL precisam apontar para o mesmo banco.");
if (!runtimeRole || !runtimePassword || !migrationRole || runtimeRole === migrationRole) {
  throw new Error("Configure usuários diferentes em DATABASE_URL e DATABASE_MIGRATION_URL.");
}

const client = new pg.Client({ connectionString: migrationUrl.toString() });
let transactionOpen = false;

async function executeForRuntimeRole(template) {
  const result = await client.query("SELECT format($1::text, $2::text) AS statement", [template, runtimeRole]);
  await client.query(result.rows[0].statement);
}

try {
  await client.connect();
  await client.query("BEGIN");
  transactionOpen = true;

  const { rows: [{ ownsDatabase, ownsSchema, ownsObjects }] } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM pg_database WHERE datname = $2 AND datdba = (SELECT oid FROM pg_roles WHERE rolname = $1)) AS "ownsDatabase",
       EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public' AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = $1)) AS "ownsSchema",
       EXISTS (
         SELECT 1 FROM pg_class relation
         JOIN pg_namespace ns ON ns.oid = relation.relnamespace
         WHERE ns.nspname = 'public' AND relation.relowner = (SELECT oid FROM pg_roles WHERE rolname = $1)
         UNION ALL
         SELECT 1 FROM pg_proc routine
         JOIN pg_namespace ns ON ns.oid = routine.pronamespace
         WHERE ns.nspname = 'public' AND routine.proowner = (SELECT oid FROM pg_roles WHERE rolname = $1)
       ) AS "ownsObjects"`,
    [runtimeRole, database],
  );
  if (ownsDatabase || ownsSchema || ownsObjects) {
    throw new Error("O papel de runtime é dono do banco, schema ou objetos; use um papel local novo ou transfira a propriedade ao migrador.");
  }

  const { rows: memberships } = await client.query(
    `SELECT granted.rolname
       FROM pg_auth_members membership
       JOIN pg_roles granted ON granted.oid = membership.roleid
       JOIN pg_roles member ON member.oid = membership.member
      WHERE member.rolname = $1`,
    [runtimeRole],
  );
  if (memberships.length) throw new Error("O papel de runtime pertence a outros papéis PostgreSQL; use um papel local novo.");

  const { rows: [{ roleExists }] } = await client.query(
    'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS "roleExists"',
    [runtimeRole],
  );
  const roleTemplate = roleExists
    ? "ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS"
    : "CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS";
  const roleDdl = await client.query("SELECT format($1::text, $2::text, $3::text) AS statement", [roleTemplate, runtimeRole, runtimePassword]);
  await client.query(roleDdl.rows[0].statement);

  const revokeDatabase = await client.query("SELECT format('REVOKE ALL ON DATABASE %I FROM %I', $1::text, $2::text) AS statement", [database, runtimeRole]);
  await client.query(revokeDatabase.rows[0].statement);
  const connect = await client.query("SELECT format('GRANT CONNECT ON DATABASE %I TO %I', $1::text, $2::text) AS statement", [database, runtimeRole]);
  await client.query(connect.rows[0].statement);
  await executeForRuntimeRole("REVOKE ALL ON SCHEMA public FROM %I");
  await executeForRuntimeRole("GRANT USAGE ON SCHEMA public TO %I");
  await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await executeForRuntimeRole("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I");
  await executeForRuntimeRole("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I");
  await executeForRuntimeRole("REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I");

  const grants = [
    "GRANT SELECT ON TABLE users, sessions, oauth_states, teams, rooms, room_members, matches, match_reports, disputes, tournaments, tournament_members TO %I",
    "GRANT INSERT (provider, provider_subject, handle) ON TABLE users TO %I",
    "GRANT UPDATE (handle) ON TABLE users TO %I",
    "GRANT INSERT (token_hash, user_id, expires_at) ON TABLE sessions TO %I",
    "GRANT DELETE ON TABLE sessions TO %I",
    "GRANT INSERT (token_hash, expires_at) ON TABLE oauth_states TO %I",
    "GRANT DELETE ON TABLE oauth_states TO %I",
    "GRANT SELECT (bucket_key, bucket_window, hit_count, expires_at) ON TABLE api_rate_limits TO %I",
    "GRANT INSERT (bucket_key, bucket_window, hit_count, expires_at) ON TABLE api_rate_limits TO %I",
    "GRANT UPDATE (bucket_window, hit_count, expires_at) ON TABLE api_rate_limits TO %I",
    "GRANT DELETE ON TABLE api_rate_limits TO %I",
    "GRANT INSERT (owner_id, name, visibility, data_json, schema_version) ON TABLE teams TO %I",
    "GRANT UPDATE (name, visibility, data_json, updated_at) ON TABLE teams TO %I",
    "GRANT DELETE ON TABLE teams TO %I",
    "GRANT INSERT (host_id, name, capacity, invite_hash, invite_expires_at) ON TABLE rooms TO %I",
    "GRANT UPDATE (status, invite_hash, invite_expires_at, locked_at, finished_at) ON TABLE rooms TO %I",
    "GRANT INSERT (room_id, user_id) ON TABLE room_members TO %I",
    "GRANT UPDATE (status, checked_in_at, friend_code_ciphertext, friend_code_nonce, friend_code_tag, friend_code_created_at, shared_roster_json, shared_roster_updated_at) ON TABLE room_members TO %I",
    "GRANT INSERT (host_id, name, invite_hash, invite_expires_at) ON TABLE tournaments TO %I",
    "GRANT UPDATE (status, invite_hash, invite_expires_at, locked_at, started_at, finished_at, bracket_version, champion_id) ON TABLE tournaments TO %I",
    "GRANT INSERT (tournament_id, user_id) ON TABLE tournament_members TO %I",
    "GRANT UPDATE (status, seed, checked_in_at, friend_code_ciphertext, friend_code_nonce, friend_code_tag, friend_code_created_at, shared_roster_json, shared_roster_updated_at) ON TABLE tournament_members TO %I",
    "GRANT INSERT (room_id, tournament_id, round_number, bracket_slot, player_a_id, player_b_id) ON TABLE matches TO %I",
    "GRANT UPDATE (status, resolved_at) ON TABLE matches TO %I",
    "GRANT INSERT (match_id, reporter_id, winner_id, note) ON TABLE match_reports TO %I",
    "GRANT INSERT (match_id, opened_by, reason) ON TABLE disputes TO %I",
    "GRANT UPDATE (status, resolution, moderator_id, resolved_at) ON TABLE disputes TO %I",
    "REVOKE ALL ON TABLE schema_migrations, moderation_events FROM %I",
    "GRANT INSERT (actor_id, room_id, tournament_id, target_user_id, action, reason) ON TABLE moderation_events TO %I",
  ];
  for (const grant of grants) await executeForRuntimeRole(grant);

  await client.query("COMMIT");
  transactionOpen = false;
  process.stdout.write("Papel de runtime preparado com permissões por tabela e coluna, sem DDL ou promoção de usuário.\n");
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  process.stderr.write(`Falha ao preparar o papel PostgreSQL de runtime (${error.code || error.name || "erro"}).\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
