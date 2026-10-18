import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createPool } from "./db.js";
import {
  canCheckIn,
  canStartRoom,
  isRoomParticipant,
  normalizeFriendCode,
  validateRoomName,
  validateTeamPayload,
} from "./community-domain.js";
import { decryptFriendCode, encryptFriendCode, encryptionKey } from "./friend-code.js";
import {
  canLockTournament,
  canStartTournament,
  semifinalPairings,
  shuffleTournamentSeeds,
  TOURNAMENT_CAPACITY,
  validateTournamentName,
} from "./tournament-domain.js";

const MAX_BODY_BYTES = 128 * 1024;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_STATE_TTL_SECONDS = 5 * 60;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store", ...headers });
  res.end();
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return ["", ""];
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { return [name, decodeURIComponent(value)]; }
    catch { return [name, value]; }
  }).filter(([name]) => name));
}

function cookie(name, value, maxAge, secure) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function clearCookie(name, secure) {
  return `${cookie(name, "", 0, secure)}`;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function secureEquals(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function isUuid(value) {
  return /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value || "");
}

async function readJson(req) {
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "json_required", "Envie o conteúdo como JSON.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large", "O conteúdo passou de 128 KB.");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value;
  } catch {
    throw new HttpError(400, "invalid_json", "O conteúdo não é um objeto JSON válido.");
  }
}

async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function assertUser(user) {
  if (!user) throw new HttpError(401, "authentication_required", "Entre com GitHub para continuar.");
  return user;
}

function roomSummary(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    capacity: row.capacity,
    hostId: row.host_id,
    createdAt: row.created_at,
    inviteExpiresAt: row.invite_expires_at,
  };
}

function tournamentSummary(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    capacity: row.capacity,
    hostId: row.host_id,
    bracketVersion: row.bracket_version,
    championId: row.champion_id,
    createdAt: row.created_at,
    inviteExpiresAt: row.invite_expires_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function validateTeamName(name) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 48) {
    throw new HttpError(400, "invalid_name", "O nome da equipe precisa ter de 1 a 48 caracteres.");
  }
  return name.trim();
}

function sharedRosterFromTeam(data) {
  const validation = validateTeamPayload(data);
  if (!validation.ok) throw new HttpError(409, "team_invalid", "Salve a equipe novamente antes de compartilhá-la.");
  if (!validation.value.members.some(Boolean)) throw new HttpError(409, "team_empty", "Adicione ao menos um Pokémon à equipe antes de compartilhá-la.");
  return validation.value.members.map((member) => member && ({
    pokemonId: member.pokemonId,
    speciesId: member.speciesId,
    speciesSlug: member.speciesSlug,
    formId: member.formId,
    formSlug: member.formSlug,
  }));
}

function createRateLimiter({ limit = 24, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return (req, key) => {
    const now = Date.now();
    const bucketKey = `${key}:${req.socket.remoteAddress || "unknown"}`;
    const current = attempts.get(bucketKey);
    if (!current || current.expiresAt <= now) {
      attempts.set(bucketKey, { count: 1, expiresAt: now + windowMs });
      return;
    }
    current.count += 1;
    if (current.count > limit) throw new HttpError(429, "rate_limited", "Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    if (attempts.size > 10_000) {
      for (const [entry, bucket] of attempts) if (bucket.expiresAt <= now) attempts.delete(entry);
    }
  };
}

async function findUser(pool, req) {
  const token = cookies(req).spinda_session;
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.id, u.handle, u.is_moderator
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.disabled_at IS NULL`,
    [digest(token)],
  );
  return result.rows[0] || null;
}

async function githubIdentity({ code, config, fetchImpl }) {
  const tokenResponse = await fetchImpl("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: `${config.appOrigin}/api/auth/github/callback`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!tokenResponse.ok) throw new Error("GitHub não aceitou a troca do código de login.");
  const tokenPayload = await tokenResponse.json();
  if (typeof tokenPayload.access_token !== "string") throw new Error("GitHub não retornou um token de acesso.");
  const userResponse = await fetchImpl("https://api.github.com/user", {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenPayload.access_token}`, "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!userResponse.ok) throw new Error("Não foi possível ler o perfil público do GitHub.");
  const user = await userResponse.json();
  if (!Number.isSafeInteger(user.id) || typeof user.login !== "string") throw new Error("O perfil do GitHub não contém os campos esperados.");
  return { subject: String(user.id), handle: user.login };
}

function appConfig(env) {
  const origin = new URL(env.APP_ORIGIN || "http://127.0.0.1:5173");
  if (origin.pathname !== "/" || origin.search || origin.hash) throw new Error("APP_ORIGIN deve conter somente a origem do aplicativo.");
  const secureCookies = env.COOKIE_SECURE === "true" || env.APP_ENV === "production";
  if (env.APP_ENV === "test" && env.API_HOST && !["127.0.0.1", "::1", "localhost"].includes(env.API_HOST)) {
    throw new Error("O servidor de teste só pode ouvir em loopback.");
  }
  let friendKey = null;
  if (env.FRIEND_CODE_ENCRYPTION_KEY) friendKey = encryptionKey(env.FRIEND_CODE_ENCRYPTION_KEY);
  if (env.APP_ENV === "production" && !friendKey) throw new Error("FRIEND_CODE_ENCRYPTION_KEY é obrigatória em produção.");
  return {
    appOrigin: origin.origin,
    secureCookies,
    envName: env.APP_ENV || "development",
    githubClientId: env.GITHUB_CLIENT_ID || "",
    githubClientSecret: env.GITHUB_CLIENT_SECRET || "",
    friendKey,
  };
}

export function createApiServer({ pool, env = process.env, fetchImpl = fetch } = {}) {
  if (!pool) throw new Error("O pool PostgreSQL é obrigatório.");
  const config = appConfig(env);
  const rateLimit = createRateLimiter();

  async function handle(req, res) {
    const url = new URL(req.url, config.appOrigin);
    const method = req.method || "GET";
    const pathname = url.pathname;
    const cookieJar = cookies(req);

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      if (!secureEquals(req.headers.origin, config.appOrigin)) {
        throw new HttpError(403, "origin_mismatch", "A origem da solicitação não corresponde ao aplicativo.");
      }
    }

    if (method === "GET" && pathname === "/api/health") {
      await pool.query("SELECT 1");
      return json(res, 200, { ok: true });
    }

    if (method === "GET" && pathname === "/api/auth/status") {
      return json(res, 200, {
        githubOAuthAvailable: Boolean(config.githubClientId && config.githubClientSecret),
        friendCodesAvailable: Boolean(config.friendKey),
      });
    }

    if (method === "GET" && pathname === "/api/auth/github") {
      rateLimit(req, "oauth-start");
      if (!config.githubClientId || !config.githubClientSecret) {
        throw new HttpError(503, "oauth_not_configured", "O login do GitHub ainda não foi configurado neste ambiente.");
      }
      const state = randomToken(32);
      await pool.query("DELETE FROM oauth_states WHERE expires_at < now()");
      await pool.query("INSERT INTO oauth_states (token_hash, expires_at) VALUES ($1, now() + interval '5 minutes')", [digest(state)]);
      const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
      authorizationUrl.searchParams.set("client_id", config.githubClientId);
      authorizationUrl.searchParams.set("redirect_uri", `${config.appOrigin}/api/auth/github/callback`);
      authorizationUrl.searchParams.set("scope", "read:user");
      authorizationUrl.searchParams.set("state", state);
      return redirect(res, authorizationUrl.toString(), { "Set-Cookie": cookie("spinda_oauth_state", state, OAUTH_STATE_TTL_SECONDS, config.secureCookies) });
    }

    if (method === "GET" && pathname === "/api/auth/github/callback") {
      rateLimit(req, "oauth-callback");
      const state = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      if (!state || !code || !secureEquals(cookieJar.spinda_oauth_state, state)) {
        throw new HttpError(400, "oauth_state_invalid", "A validação do login expirou. Inicie o acesso de novo.");
      }
      const stateRow = await pool.query(
        "DELETE FROM oauth_states WHERE token_hash = $1 AND expires_at > now() RETURNING token_hash",
        [digest(state)],
      );
      if (!stateRow.rowCount) throw new HttpError(400, "oauth_state_invalid", "A validação do login expirou ou já foi usada.");
      const identity = await githubIdentity({ code, config, fetchImpl });
      const userResult = await pool.query(
        `INSERT INTO users (provider, provider_subject, handle)
         VALUES ('github', $1, $2)
         ON CONFLICT (provider, provider_subject) DO UPDATE SET handle = EXCLUDED.handle
         RETURNING id`,
        [identity.subject, identity.handle],
      );
      const token = randomToken();
      await pool.query("DELETE FROM sessions WHERE expires_at < now()");
      await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [digest(token), userResult.rows[0].id]);
      return redirect(res, `${config.appOrigin}/rooms`, {
        "Set-Cookie": [
          cookie("spinda_session", token, SESSION_TTL_SECONDS, config.secureCookies),
          clearCookie("spinda_oauth_state", config.secureCookies),
        ],
      });
    }

    if (method === "POST" && pathname === "/api/auth/logout") {
      const token = cookieJar.spinda_session;
      if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [digest(token)]);
      return json(res, 200, { ok: true }, { "Set-Cookie": clearCookie("spinda_session", config.secureCookies) });
    }

    if (method === "POST" && pathname === "/api/test/session" && config.envName === "test") {
      const body = await readJson(req);
      const handle = typeof body.handle === "string" ? body.handle.trim() : "";
      if (!/^[A-Za-z0-9-]{1,30}$/.test(handle)) throw new HttpError(400, "invalid_handle", "Use um nome de teste com até 30 letras, números ou hífens.");
      const result = await pool.query(
        `INSERT INTO users (provider, provider_subject, handle)
         VALUES ('test', $1, $2)
         ON CONFLICT (provider, provider_subject) DO UPDATE SET handle = EXCLUDED.handle
         RETURNING id, handle, is_moderator`,
        [handle.toLowerCase(), handle],
      );
      const token = randomToken();
      await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [digest(token), result.rows[0].id]);
      return json(res, 200, { user: result.rows[0] }, { "Set-Cookie": cookie("spinda_session", token, 3600, false) });
    }

    const user = await findUser(pool, req);
    if (method === "GET" && pathname === "/api/me") {
      return json(res, 200, { user: user ? { id: user.id, handle: user.handle, isModerator: user.is_moderator } : null });
    }

    if (method === "GET" && pathname === "/api/teams/public") {
      const result = await pool.query(
        "SELECT id, name, data_json, schema_version, updated_at FROM teams WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT 100",
      );
      return json(res, 200, { teams: result.rows.map((row) => ({ id: row.id, name: row.name, data: row.data_json, schemaVersion: row.schema_version, updatedAt: row.updated_at })) });
    }

    if (method === "GET" && pathname === "/api/teams") {
      const current = assertUser(user);
      const result = await pool.query(
        "SELECT id, name, visibility, data_json, schema_version, created_at, updated_at FROM teams WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 100",
        [current.id],
      );
      return json(res, 200, { teams: result.rows.map((row) => ({ id: row.id, name: row.name, visibility: row.visibility, data: row.data_json, schemaVersion: row.schema_version, createdAt: row.created_at, updatedAt: row.updated_at })) });
    }

    if (method === "POST" && pathname === "/api/teams") {
      const current = assertUser(user);
      const body = await readJson(req);
      const validation = validateTeamPayload(body.data);
      if (!validation.ok) throw new HttpError(400, "invalid_team", validation.error);
      if (Buffer.byteLength(JSON.stringify(body.data)) > MAX_BODY_BYTES) throw new HttpError(413, "team_too_large", "A equipe passou de 128 KB.");
      const visibility = body.visibility === "public" ? "public" : body.visibility === "private" ? "private" : null;
      if (!visibility) throw new HttpError(400, "invalid_visibility", "Escolha se a equipe fica privada ou pública.");
      const name = validateTeamName(body.data.name);
      const result = await pool.query(
        `INSERT INTO teams (owner_id, name, visibility, data_json, schema_version)
         VALUES ($1, $2, $3, $4::jsonb, 1)
         RETURNING id, name, visibility, data_json, schema_version, created_at, updated_at`,
        [current.id, name, visibility, JSON.stringify(body.data)],
      );
      const row = result.rows[0];
      return json(res, 201, { team: { id: row.id, name: row.name, visibility: row.visibility, data: row.data_json, schemaVersion: row.schema_version, createdAt: row.created_at, updatedAt: row.updated_at } });
    }

    const teamMatch = pathname.match(/^\/api\/teams\/([0-9a-f-]+)$/i);
    if (teamMatch && isUuid(teamMatch[1]) && method === "PATCH") {
      const current = assertUser(user);
      const body = await readJson(req);
      const existing = await pool.query("SELECT id, data_json FROM teams WHERE id = $1 AND owner_id = $2", [teamMatch[1], current.id]);
      if (!existing.rowCount) throw new HttpError(404, "team_not_found", "Equipe não encontrada.");
      const nextData = body.data === undefined ? existing.rows[0].data_json : body.data;
      const validation = validateTeamPayload(nextData);
      if (!validation.ok) throw new HttpError(400, "invalid_team", validation.error);
      const visibility = body.visibility === undefined ? null : body.visibility;
      if (visibility !== null && !["private", "public"].includes(visibility)) throw new HttpError(400, "invalid_visibility", "Escolha se a equipe fica privada ou pública.");
      const name = body.name === undefined ? nextData.name : body.name;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 48) throw new HttpError(400, "invalid_name", "O nome da equipe precisa ter de 1 a 48 caracteres.");
      nextData.name = name.trim();
      const updated = await pool.query(
        `UPDATE teams SET name = $1, visibility = COALESCE($2, visibility), data_json = $3::jsonb, updated_at = now()
          WHERE id = $4 AND owner_id = $5
          RETURNING id, name, visibility, data_json, schema_version, created_at, updated_at`,
        [nextData.name, visibility, JSON.stringify(nextData), teamMatch[1], current.id],
      );
      const row = updated.rows[0];
      return json(res, 200, { team: { id: row.id, name: row.name, visibility: row.visibility, data: row.data_json, schemaVersion: row.schema_version, createdAt: row.created_at, updatedAt: row.updated_at } });
    }

    if (teamMatch && isUuid(teamMatch[1]) && method === "DELETE") {
      const current = assertUser(user);
      const result = await pool.query("DELETE FROM teams WHERE id = $1 AND owner_id = $2", [teamMatch[1], current.id]);
      if (!result.rowCount) throw new HttpError(404, "team_not_found", "Equipe não encontrada.");
      return json(res, 200, { ok: true });
    }

    if (method === "GET" && pathname === "/api/tournaments") {
      const current = assertUser(user);
      await clearExpiredTournamentFriendCodes(pool);
      const result = await pool.query(
        `SELECT t.*, tm.status AS member_status,
                (SELECT count(*)::int FROM tournament_members active
                  WHERE active.tournament_id = t.id AND active.status IN ('registered', 'checked_in')) AS participant_count
           FROM tournaments t JOIN tournament_members tm ON tm.tournament_id = t.id
          WHERE tm.user_id = $1 AND tm.status IN ('registered', 'checked_in')
          ORDER BY t.created_at DESC LIMIT 100`,
        [current.id],
      );
      return json(res, 200, { tournaments: result.rows.map((row) => ({ ...tournamentSummary(row), memberStatus: row.member_status, participantCount: row.participant_count })) });
    }

    if (method === "POST" && pathname === "/api/tournaments") {
      const current = assertUser(user);
      const body = await readJson(req);
      const name = validateTournamentName(body.name);
      if (!name) throw new HttpError(400, "invalid_name", "O nome do torneio precisa ter de 1 a 48 caracteres.");
      const inviteToken = randomToken();
      const tournament = await transaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO tournaments (host_id, name, invite_hash, invite_expires_at)
           VALUES ($1, $2, $3, now() + interval '7 days') RETURNING *`,
          [current.id, name, digest(inviteToken)],
        );
        await client.query("INSERT INTO tournament_members (tournament_id, user_id) VALUES ($1, $2)", [inserted.rows[0].id, current.id]);
        return inserted.rows[0];
      });
      return json(res, 201, { tournament: tournamentSummary(tournament), inviteUrl: `${config.appOrigin}/tournaments/join#${inviteToken}` });
    }

    if (method === "POST" && pathname === "/api/tournaments/join") {
      rateLimit(req, "tournament-invite-join");
      const current = assertUser(user);
      const body = await readJson(req);
      if (typeof body.inviteToken !== "string" || body.inviteToken.length < 32 || body.inviteToken.length > 64) throw new HttpError(400, "invalid_invite", "O convite não é válido.");
      const tournamentId = await transaction(pool, async (client) => {
        const found = await client.query("SELECT * FROM tournaments WHERE invite_hash = $1 FOR UPDATE", [digest(body.inviteToken)]);
        if (!found.rowCount || found.rows[0].status !== "open" || new Date(found.rows[0].invite_expires_at) <= new Date()) throw new HttpError(404, "invite_not_found", "Este convite expirou ou o torneio não aceita mais inscrições.");
        const tournament = found.rows[0];
        const existing = await client.query("SELECT status FROM tournament_members WHERE tournament_id = $1 AND user_id = $2", [tournament.id, current.id]);
        if (existing.rows[0]?.status === "removed") throw new HttpError(403, "member_removed", "Sua inscrição neste torneio foi removida.");
        if (existing.rows[0]?.status === "left") {
          const count = await client.query("SELECT count(*)::int AS count FROM tournament_members WHERE tournament_id = $1 AND status IN ('registered', 'checked_in')", [tournament.id]);
          if (count.rows[0].count >= TOURNAMENT_CAPACITY) throw new HttpError(409, "tournament_full", "O torneio já está completo.");
          await client.query("UPDATE tournament_members SET status = 'registered', checked_in_at = NULL, seed = NULL WHERE tournament_id = $1 AND user_id = $2", [tournament.id, current.id]);
        } else if (!existing.rowCount) {
          const count = await client.query("SELECT count(*)::int AS count FROM tournament_members WHERE tournament_id = $1 AND status IN ('registered', 'checked_in')", [tournament.id]);
          if (count.rows[0].count >= TOURNAMENT_CAPACITY) throw new HttpError(409, "tournament_full", "O torneio já está completo.");
          await client.query("INSERT INTO tournament_members (tournament_id, user_id) VALUES ($1, $2)", [tournament.id, current.id]);
        }
        return tournament.id;
      });
      return json(res, 200, { tournamentId });
    }

    const tournamentMatch = pathname.match(/^\/api\/tournaments\/([0-9a-f-]+)(?:\/(.*))?$/i);
    if (tournamentMatch && isUuid(tournamentMatch[1])) {
      const current = assertUser(user);
      const tournamentId = tournamentMatch[1];
      const action = tournamentMatch[2] || "";

      if (method === "GET" && !action) {
        await clearExpiredTournamentFriendCodes(pool, tournamentId);
        const tournamentResult = await pool.query("SELECT * FROM tournaments WHERE id = $1", [tournamentId]);
        const membership = await pool.query("SELECT status FROM tournament_members WHERE tournament_id = $1 AND user_id = $2", [tournamentId, current.id]);
        if (!tournamentResult.rowCount || !membership.rowCount || !["registered", "checked_in"].includes(membership.rows[0].status)) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
        const tournament = tournamentResult.rows[0];
        const members = await pool.query(
          `SELECT u.id, u.handle, tm.status, tm.seed, tm.checked_in_at,
                  tm.friend_code_ciphertext, tm.friend_code_nonce, tm.friend_code_tag,
                  tm.shared_roster_json
             FROM tournament_members tm JOIN users u ON u.id = tm.user_id
            WHERE tm.tournament_id = $1 AND tm.status IN ('registered', 'checked_in')
            ORDER BY tm.seed NULLS LAST, tm.created_at`,
          [tournamentId],
        );
        const matchRows = await pool.query(
          `SELECT m.id, m.round_number, m.bracket_slot, m.status, m.created_at,
                  pa.id AS player_a_id, pa.handle AS player_a_handle,
                  pb.id AS player_b_id, pb.handle AS player_b_handle,
                  report.reporter_id, report.winner_id, report.note, report.created_at AS report_created_at,
                  winner.handle AS winner_handle,
                  dispute.id AS dispute_id, dispute.opened_by, dispute.reason AS dispute_reason,
                  dispute.status AS dispute_status, dispute.resolution, dispute.created_at AS dispute_created_at
             FROM matches m
             JOIN users pa ON pa.id = m.player_a_id JOIN users pb ON pb.id = m.player_b_id
             LEFT JOIN match_reports report ON report.match_id = m.id
             LEFT JOIN users winner ON winner.id = report.winner_id
             LEFT JOIN disputes dispute ON dispute.match_id = m.id
            WHERE m.tournament_id = $1 ORDER BY m.round_number, m.bracket_slot`,
          [tournamentId],
        );
        const memberData = members.rows.map((member) => {
          let friendCode = null;
          if (member.friend_code_ciphertext) {
            if (!config.friendKey) throw new HttpError(503, "friend_code_unavailable", "O compartilhamento de códigos não foi configurado neste ambiente.");
            friendCode = decryptFriendCode(
              { ciphertext: member.friend_code_ciphertext, nonce: member.friend_code_nonce, tag: member.friend_code_tag },
              config.friendKey,
              `tournament:${tournamentId}:${member.id}`,
            );
          }
          return { id: member.id, handle: member.handle, status: member.status, seed: member.seed, checkedInAt: member.checked_in_at, friendCode, sharedRoster: member.shared_roster_json };
        });
        const matches = matchRows.rows.map((row) => ({
          id: row.id,
          roundNumber: row.round_number,
          bracketSlot: row.bracket_slot,
          status: row.status,
          createdAt: row.created_at,
          playerA: { id: row.player_a_id, handle: row.player_a_handle },
          playerB: { id: row.player_b_id, handle: row.player_b_handle },
          report: row.reporter_id ? { reporterId: row.reporter_id, winnerId: row.winner_id, winnerHandle: row.winner_handle, note: row.note, createdAt: row.report_created_at } : null,
          dispute: row.dispute_id ? { id: row.dispute_id, openedBy: row.opened_by, reason: row.dispute_reason, status: row.dispute_status, resolution: row.resolution, createdAt: row.dispute_created_at } : null,
        }));
        const activeCount = await pool.query("SELECT count(*)::int AS count FROM tournament_members WHERE tournament_id = $1 AND status IN ('registered', 'checked_in')", [tournamentId]);
        return json(res, 200, {
          tournament: tournamentSummary(tournament),
          currentUser: { id: current.id, role: tournament.host_id === current.id ? "host" : "member", memberStatus: membership.rows[0].status },
          participantCount: activeCount.rows[0].count,
          members: memberData,
          matches,
        });
      }

      if (method === "PUT" && action === "shared-team") {
        const body = await readJson(req);
        if (!isUuid(body.teamId)) throw new HttpError(400, "invalid_team", "Escolha uma equipe salva nesta conta.");
        await transaction(pool, async (client) => {
          const membership = await client.query(
            `SELECT t.status AS tournament_status, tm.status AS member_status
               FROM tournaments t JOIN tournament_members tm ON tm.tournament_id = t.id
              WHERE t.id = $1 AND tm.user_id = $2 FOR UPDATE OF t, tm`,
            [tournamentId, current.id],
          );
          if (!membership.rowCount || !["registered", "checked_in"].includes(membership.rows[0].member_status)) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
          if (["completed", "cancelled"].includes(membership.rows[0].tournament_status)) throw new HttpError(409, "tournament_finished", "O torneio já terminou.");
          const team = await client.query("SELECT data_json FROM teams WHERE id = $1 AND owner_id = $2", [body.teamId, current.id]);
          if (!team.rowCount) throw new HttpError(404, "team_not_found", "Equipe não encontrada nesta conta.");
          const roster = sharedRosterFromTeam(team.rows[0].data_json);
          await client.query(
            "UPDATE tournament_members SET shared_roster_json = $1::jsonb, shared_roster_updated_at = now() WHERE tournament_id = $2 AND user_id = $3",
            [JSON.stringify(roster), tournamentId, current.id],
          );
        });
        return json(res, 200, { shared: true });
      }

      if (method === "DELETE" && action === "shared-team") {
        const result = await pool.query(
          "UPDATE tournament_members SET shared_roster_json = NULL, shared_roster_updated_at = NULL WHERE tournament_id = $1 AND user_id = $2 RETURNING tournament_id",
          [tournamentId, current.id],
        );
        if (!result.rowCount) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
        return json(res, 200, { shared: false });
      }

      if (method === "POST" && action === "invite") {
        const newToken = randomToken();
        const result = await pool.query(
          `UPDATE tournaments SET invite_hash = $1, invite_expires_at = now() + interval '7 days'
            WHERE id = $2 AND host_id = $3 AND status = 'open' RETURNING *`,
          [digest(newToken), tournamentId, current.id],
        );
        if (!result.rowCount) throw new HttpError(404, "tournament_not_open", "Só o host pode criar convite para um torneio com inscrições abertas.");
        return json(res, 200, { tournament: tournamentSummary(result.rows[0]), inviteUrl: `${config.appOrigin}/tournaments/join#${newToken}` });
      }

      if (method === "POST" && action === "check-in") {
        const result = await transaction(pool, async (client) => {
          const tournament = await client.query("SELECT status FROM tournaments WHERE id = $1 FOR UPDATE", [tournamentId]);
          const member = await client.query("SELECT status FROM tournament_members WHERE tournament_id = $1 AND user_id = $2 FOR UPDATE", [tournamentId, current.id]);
          if (!tournament.rowCount || !member.rowCount) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
          if (member.rows[0].status === "checked_in") return { status: "checked_in" };
          if (tournament.rows[0].status !== "open" || member.rows[0].status !== "registered") throw new HttpError(409, "check_in_closed", "O check-in não está disponível nesta etapa.");
          await client.query("UPDATE tournament_members SET status = 'checked_in', checked_in_at = now() WHERE tournament_id = $1 AND user_id = $2", [tournamentId, current.id]);
          return { status: "checked_in" };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "leave") {
        await transaction(pool, async (client) => {
          const tournament = await client.query("SELECT status, host_id FROM tournaments WHERE id = $1 FOR UPDATE", [tournamentId]);
          if (!tournament.rowCount || tournament.rows[0].status !== "open" || tournament.rows[0].host_id === current.id) throw new HttpError(409, "cannot_leave", "Só é possível sair de um torneio aberto, e o host não pode sair.");
          const result = await client.query(
            `UPDATE tournament_members SET status = 'left', checked_in_at = NULL, seed = NULL,
                    friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
              WHERE tournament_id = $1 AND user_id = $2 AND status IN ('registered', 'checked_in')
              RETURNING tournament_id`,
            [tournamentId, current.id],
          );
          if (!result.rowCount) throw new HttpError(409, "cannot_leave", "Sua inscrição não pode mais ser alterada.");
        });
        return json(res, 200, { ok: true });
      }

      if (method === "POST" && action === "close") {
        const result = await transaction(pool, async (client) => {
          const tournament = await client.query("SELECT * FROM tournaments WHERE id = $1 FOR UPDATE", [tournamentId]);
          if (!tournament.rowCount || tournament.rows[0].host_id !== current.id) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
          if (tournament.rows[0].status === "locked") return { status: "locked" };
          const counts = await client.query(
            `SELECT count(*) FILTER (WHERE status IN ('registered', 'checked_in'))::int AS members,
                    count(*) FILTER (WHERE status = 'checked_in')::int AS checked_in
               FROM tournament_members WHERE tournament_id = $1`,
            [tournamentId],
          );
          if (!canLockTournament(tournament.rows[0].status, counts.rows[0].members, counts.rows[0].checked_in)) throw new HttpError(409, "tournament_not_ready", "O host pode fechar as inscrições quando quatro participantes estiverem inscritos e com check-in.");
          await client.query("UPDATE tournaments SET status = 'locked', locked_at = now(), invite_expires_at = now() WHERE id = $1", [tournamentId]);
          return { status: "locked" };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "start") {
        const result = await transaction(pool, async (client) => {
          const tournament = await client.query("SELECT * FROM tournaments WHERE id = $1 FOR UPDATE", [tournamentId]);
          if (!tournament.rowCount || tournament.rows[0].host_id !== current.id) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
          if (tournament.rows[0].status === "in_progress") {
            const existing = await client.query("SELECT id FROM matches WHERE tournament_id = $1 ORDER BY round_number, bracket_slot", [tournamentId]);
            return { status: "in_progress", matchIds: existing.rows.map((row) => row.id) };
          }
          const checkedIn = await client.query(
            "SELECT user_id FROM tournament_members WHERE tournament_id = $1 AND status = 'checked_in' ORDER BY created_at FOR UPDATE",
            [tournamentId],
          );
          if (!canStartTournament(tournament.rows[0].status, checkedIn.rowCount)) throw new HttpError(409, "tournament_not_ready", "Feche as inscrições e aguarde quatro check-ins.");
          const seeded = shuffleTournamentSeeds(checkedIn.rows.map((row) => row.user_id));
          for (const member of seeded) await client.query("UPDATE tournament_members SET seed = $1 WHERE tournament_id = $2 AND user_id = $3", [member.seed, tournamentId, member.userId]);
          const pairings = semifinalPairings(seeded);
          const matchIds = [];
          for (const [bracketSlot, pairing] of pairings.entries()) {
            const match = await client.query(
              "INSERT INTO matches (tournament_id, round_number, bracket_slot, player_a_id, player_b_id) VALUES ($1, 1, $2, $3, $4) RETURNING id",
              [tournamentId, bracketSlot, pairing[0], pairing[1]],
            );
            matchIds.push(match.rows[0].id);
          }
          await client.query("UPDATE tournaments SET status = 'in_progress', started_at = now(), invite_expires_at = now(), bracket_version = bracket_version + 1 WHERE id = $1", [tournamentId]);
          return { status: "in_progress", matchIds };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "cancel") {
        await transaction(pool, async (client) => {
          const result = await client.query(
            `UPDATE tournaments SET status = 'cancelled', finished_at = now(), invite_expires_at = now(), bracket_version = bracket_version + 1
              WHERE id = $1 AND host_id = $2 AND status IN ('open', 'locked') RETURNING id`,
            [tournamentId, current.id],
          );
          if (!result.rowCount) throw new HttpError(409, "cannot_cancel", "O host só pode cancelar antes do início do torneio.");
          await clearTournamentFriendCodes(client, tournamentId);
        });
        return json(res, 200, { status: "cancelled" });
      }

      if (method === "PUT" && action === "friend-code") {
        if (!config.friendKey) throw new HttpError(503, "friend_code_unavailable", "O compartilhamento de códigos não foi configurado neste ambiente.");
        const body = await readJson(req);
        const code = normalizeFriendCode(body.code);
        if (!code) throw new HttpError(400, "invalid_friend_code", "Informe um código de amizade válido, sem símbolos além de espaços e hífens.");
        const encrypted = encryptFriendCode(code, config.friendKey, `tournament:${tournamentId}:${current.id}`);
        await transaction(pool, async (client) => {
          const tournament = await client.query("SELECT status FROM tournaments WHERE id = $1 FOR UPDATE", [tournamentId]);
          const member = await client.query("SELECT status FROM tournament_members WHERE tournament_id = $1 AND user_id = $2 FOR UPDATE", [tournamentId, current.id]);
          if (!tournament.rowCount || !member.rowCount || !["registered", "checked_in"].includes(member.rows[0].status)) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
          if (["completed", "cancelled"].includes(tournament.rows[0].status)) throw new HttpError(409, "tournament_finished", "O torneio já terminou.");
          await client.query(
            `UPDATE tournament_members SET friend_code_ciphertext = $1, friend_code_nonce = $2, friend_code_tag = $3, friend_code_created_at = now()
              WHERE tournament_id = $4 AND user_id = $5`,
            [encrypted.ciphertext, encrypted.nonce, encrypted.tag, tournamentId, current.id],
          );
        });
        return json(res, 200, { shared: true });
      }

      if (method === "DELETE" && action === "friend-code") {
        const result = await pool.query(
          `UPDATE tournament_members SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
            WHERE tournament_id = $1 AND user_id = $2 RETURNING tournament_id`,
          [tournamentId, current.id],
        );
        if (!result.rowCount) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
        return json(res, 200, { shared: false });
      }
    }

    if (method === "GET" && pathname === "/api/rooms") {
      const current = assertUser(user);
      const result = await pool.query(
        `SELECT r.*, rm.status AS member_status
           FROM rooms r JOIN room_members rm ON rm.room_id = r.id
          WHERE rm.user_id = $1 AND rm.status IN ('registered', 'checked_in')
          ORDER BY r.created_at DESC LIMIT 100`,
        [current.id],
      );
      return json(res, 200, { rooms: result.rows.map((row) => ({ ...roomSummary(row), memberStatus: row.member_status })) });
    }

    if (method === "POST" && pathname === "/api/rooms") {
      const current = assertUser(user);
      const body = await readJson(req);
      const name = validateRoomName(body.name);
      if (!name) throw new HttpError(400, "invalid_name", "O nome da sala precisa ter de 1 a 48 caracteres.");
      if (body.capacity !== undefined && body.capacity !== 2) throw new HttpError(400, "unsupported_capacity", "Esta primeira sala aceita duas pessoas. Torneios ampliam o tamanho do grupo.");
      const token = randomToken();
      const room = await transaction(pool, async (client) => {
        const inserted = await client.query(
          "INSERT INTO rooms (host_id, name, capacity, invite_hash, invite_expires_at) VALUES ($1, $2, 2, $3, now() + interval '7 days') RETURNING *",
          [current.id, name, digest(token)],
        );
        await client.query("INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)", [inserted.rows[0].id, current.id]);
        return inserted.rows[0];
      });
      return json(res, 201, { room: roomSummary(room), inviteUrl: `${config.appOrigin}/rooms/join#${token}` });
    }

    if (method === "POST" && pathname === "/api/rooms/join") {
      rateLimit(req, "invite-join");
      const current = assertUser(user);
      const body = await readJson(req);
      if (typeof body.inviteToken !== "string" || body.inviteToken.length < 32 || body.inviteToken.length > 64) throw new HttpError(400, "invalid_invite", "O convite não é válido.");
      const roomId = await transaction(pool, async (client) => {
        const found = await client.query("SELECT * FROM rooms WHERE invite_hash = $1 FOR UPDATE", [digest(body.inviteToken)]);
        if (!found.rowCount || found.rows[0].status !== "open" || new Date(found.rows[0].invite_expires_at) <= new Date()) throw new HttpError(404, "invite_not_found", "Este convite expirou ou a sala não aceita mais inscrições.");
        const room = found.rows[0];
        const existing = await client.query("SELECT status FROM room_members WHERE room_id = $1 AND user_id = $2", [room.id, current.id]);
        if (existing.rows[0]?.status === "removed") throw new HttpError(403, "member_removed", "Sua inscrição nesta sala foi removida.");
        if (existing.rows[0]?.status === "left") {
          const count = await client.query("SELECT count(*)::int AS count FROM room_members WHERE room_id = $1 AND status IN ('registered', 'checked_in')", [room.id]);
          if (count.rows[0].count >= room.capacity) throw new HttpError(409, "room_full", "A sala já está completa.");
          await client.query("UPDATE room_members SET status = 'registered', checked_in_at = NULL WHERE room_id = $1 AND user_id = $2", [room.id, current.id]);
        } else if (!existing.rowCount) {
          const count = await client.query("SELECT count(*)::int AS count FROM room_members WHERE room_id = $1 AND status IN ('registered', 'checked_in')", [room.id]);
          if (count.rows[0].count >= room.capacity) throw new HttpError(409, "room_full", "A sala já está completa.");
          await client.query("INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)", [room.id, current.id]);
        }
        return room.id;
      });
      return json(res, 200, { roomId });
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([0-9a-f-]+)(?:\/(.*))?$/i);
    if (roomMatch && isUuid(roomMatch[1])) {
      const current = assertUser(user);
      const roomId = roomMatch[1];
      const action = roomMatch[2] || "";

      if (method === "GET" && !action) {
        await pool.query(
          `UPDATE room_members rm SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
            FROM rooms r WHERE rm.room_id = r.id AND rm.room_id = $1
              AND (rm.friend_code_created_at < now() - interval '7 days' OR r.status IN ('completed', 'cancelled'))`,
          [roomId],
        );
        const roomResult = await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
        const membership = await pool.query("SELECT status FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, current.id]);
        if (!roomResult.rowCount || !membership.rowCount || !["registered", "checked_in"].includes(membership.rows[0].status)) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
        const room = roomResult.rows[0];
        const members = await pool.query(
          `SELECT u.id, u.handle, rm.status, rm.checked_in_at,
                  rm.friend_code_ciphertext, rm.friend_code_nonce, rm.friend_code_tag,
                  rm.shared_roster_json
             FROM room_members rm JOIN users u ON u.id = rm.user_id
            WHERE rm.room_id = $1 AND rm.status IN ('registered', 'checked_in') ORDER BY rm.created_at`,
          [roomId],
        );
        const matchResult = await pool.query("SELECT * FROM matches WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1", [roomId]);
        let match = null;
        if (matchResult.rowCount) {
          const matchRow = matchResult.rows[0];
          const [reportResult, disputeResult] = await Promise.all([
            pool.query("SELECT reporter_id, winner_id, note, created_at FROM match_reports WHERE match_id = $1", [matchRow.id]),
            pool.query("SELECT id, opened_by, reason, status, resolution, created_at FROM disputes WHERE match_id = $1", [matchRow.id]),
          ]);
          const handles = new Map(members.rows.map((member) => [member.id, member.handle]));
          const report = reportResult.rows[0];
          match = {
            id: matchRow.id,
            status: matchRow.status,
            playerA: { id: matchRow.player_a_id, handle: handles.get(matchRow.player_a_id) || "Participante" },
            playerB: { id: matchRow.player_b_id, handle: handles.get(matchRow.player_b_id) || "Participante" },
            report: report ? { reporterId: report.reporter_id, winnerId: report.winner_id, winnerHandle: handles.get(report.winner_id) || "Participante", note: report.note, createdAt: report.created_at } : null,
            dispute: disputeResult.rows[0] ? { id: disputeResult.rows[0].id, openedBy: disputeResult.rows[0].opened_by, reason: disputeResult.rows[0].reason, status: disputeResult.rows[0].status, resolution: disputeResult.rows[0].resolution, createdAt: disputeResult.rows[0].created_at } : null,
          };
        }
        const memberData = members.rows.map((member) => {
          let friendCode = null;
          if (member.friend_code_ciphertext) {
            if (!config.friendKey) throw new HttpError(503, "friend_code_unavailable", "O compartilhamento de códigos não foi configurado neste ambiente.");
            friendCode = decryptFriendCode(
              { ciphertext: member.friend_code_ciphertext, nonce: member.friend_code_nonce, tag: member.friend_code_tag },
              config.friendKey,
              `${roomId}:${member.id}`,
            );
          }
          return { id: member.id, handle: member.handle, status: member.status, checkedInAt: member.checked_in_at, friendCode, sharedRoster: member.shared_roster_json };
        });
        return json(res, 200, { room: roomSummary(room), currentUser: { id: current.id, role: room.host_id === current.id ? "host" : "member", memberStatus: membership.rows[0].status }, members: memberData, match });
      }

      if (method === "PUT" && action === "shared-team") {
        const body = await readJson(req);
        if (!isUuid(body.teamId)) throw new HttpError(400, "invalid_team", "Escolha uma equipe salva nesta conta.");
        await transaction(pool, async (client) => {
          const membership = await client.query(
            `SELECT r.status AS room_status, rm.status AS member_status
               FROM rooms r JOIN room_members rm ON rm.room_id = r.id
              WHERE r.id = $1 AND rm.user_id = $2 FOR UPDATE OF r, rm`,
            [roomId, current.id],
          );
          if (!membership.rowCount || !["registered", "checked_in"].includes(membership.rows[0].member_status)) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
          if (["completed", "cancelled"].includes(membership.rows[0].room_status)) throw new HttpError(409, "room_finished", "A sala já terminou.");
          const team = await client.query("SELECT data_json FROM teams WHERE id = $1 AND owner_id = $2", [body.teamId, current.id]);
          if (!team.rowCount) throw new HttpError(404, "team_not_found", "Equipe não encontrada nesta conta.");
          const roster = sharedRosterFromTeam(team.rows[0].data_json);
          await client.query(
            "UPDATE room_members SET shared_roster_json = $1::jsonb, shared_roster_updated_at = now() WHERE room_id = $2 AND user_id = $3",
            [JSON.stringify(roster), roomId, current.id],
          );
        });
        return json(res, 200, { shared: true });
      }

      if (method === "DELETE" && action === "shared-team") {
        const result = await pool.query(
          "UPDATE room_members SET shared_roster_json = NULL, shared_roster_updated_at = NULL WHERE room_id = $1 AND user_id = $2 RETURNING room_id",
          [roomId, current.id],
        );
        if (!result.rowCount) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
        return json(res, 200, { shared: false });
      }

      if (method === "POST" && action === "invite") {
        const newToken = randomToken();
        const result = await pool.query(
          `UPDATE rooms SET invite_hash = $1, invite_expires_at = now() + interval '7 days'
            WHERE id = $2 AND host_id = $3 AND status = 'open' RETURNING *`,
          [digest(newToken), roomId, current.id],
        );
        if (!result.rowCount) throw new HttpError(404, "room_not_open", "Só o host pode criar convite para uma sala aberta.");
        return json(res, 200, { room: roomSummary(result.rows[0]), inviteUrl: `${config.appOrigin}/rooms/join#${newToken}` });
      }

      if (method === "POST" && action === "check-in") {
        const result = await transaction(pool, async (client) => {
          const room = await client.query("SELECT status FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
          if (!room.rowCount) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
          const member = await client.query("SELECT status FROM room_members WHERE room_id = $1 AND user_id = $2 FOR UPDATE", [roomId, current.id]);
          if (!member.rowCount) throw new HttpError(403, "room_membership_required", "Você não está inscrito nesta sala.");
          if (member.rows[0].status === "checked_in") return { status: "checked_in" };
          if (!canCheckIn(room.rows[0].status, member.rows[0].status)) throw new HttpError(409, "check_in_closed", "O check-in não está disponível nesta etapa.");
          await client.query("UPDATE room_members SET status = 'checked_in', checked_in_at = now() WHERE room_id = $1 AND user_id = $2", [roomId, current.id]);
          return { status: "checked_in" };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "leave") {
        const result = await pool.query(
          `UPDATE room_members SET status = 'left', checked_in_at = NULL
                  , friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
            WHERE room_id = $1 AND user_id = $2 AND status IN ('registered', 'checked_in')
              AND EXISTS (SELECT 1 FROM rooms WHERE id = $1 AND status = 'open' AND host_id <> $2)
            RETURNING room_id`,
          [roomId, current.id],
        );
        if (!result.rowCount) throw new HttpError(409, "cannot_leave", "Não é possível sair nesta etapa da sala.");
        return json(res, 200, { ok: true });
      }

      if (method === "POST" && action === "close") {
        const result = await pool.query(
          `UPDATE rooms SET status = 'locked', locked_at = now(), invite_expires_at = now()
            WHERE id = $1 AND host_id = $2 AND status = 'open' RETURNING id`,
          [roomId, current.id],
        );
        if (!result.rowCount) {
          const existing = await pool.query("SELECT status FROM rooms WHERE id = $1 AND host_id = $2", [roomId, current.id]);
          if (!existing.rowCount) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
          if (existing.rows[0].status !== "locked") throw new HttpError(409, "cannot_close", "Esta sala não pode mais fechar inscrições.");
        }
        return json(res, 200, { status: "locked" });
      }

      if (method === "POST" && action === "start") {
        const result = await transaction(pool, async (client) => {
          const room = await client.query("SELECT * FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
          if (!room.rowCount || room.rows[0].host_id !== current.id) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
          if (room.rows[0].status === "in_progress") {
            const existing = await client.query("SELECT id FROM matches WHERE room_id = $1 ORDER BY created_at LIMIT 1", [roomId]);
            return { status: "in_progress", matchId: existing.rows[0]?.id || null };
          }
          const checkedIn = await client.query(
            "SELECT user_id FROM room_members WHERE room_id = $1 AND status = 'checked_in' ORDER BY created_at FOR UPDATE",
            [roomId],
          );
          if (!canStartRoom(room.rows[0].status, checkedIn.rowCount, room.rows[0].capacity)) throw new HttpError(409, "room_not_ready", "Feche as inscrições e aguarde as duas pessoas fazerem check-in.");
          if (checkedIn.rowCount !== 2) throw new HttpError(409, "unsupported_room_size", "Esta etapa inicia apenas uma partida entre duas pessoas.");
          const match = await client.query(
            "INSERT INTO matches (room_id, player_a_id, player_b_id) VALUES ($1, $2, $3) RETURNING id",
            [roomId, checkedIn.rows[0].user_id, checkedIn.rows[1].user_id],
          );
          await client.query("UPDATE rooms SET status = 'in_progress', invite_expires_at = now() WHERE id = $1", [roomId]);
          return { status: "in_progress", matchId: match.rows[0].id };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "cancel") {
        await transaction(pool, async (client) => {
          const result = await client.query(
            `UPDATE rooms SET status = 'cancelled', finished_at = now(), invite_expires_at = now()
              WHERE id = $1 AND host_id = $2 AND status IN ('open', 'locked') RETURNING id`,
            [roomId, current.id],
          );
          if (!result.rowCount) throw new HttpError(409, "cannot_cancel", "Só o host pode cancelar uma sala antes de começar.");
          await clearRoomFriendCodes(client, roomId);
        });
        return json(res, 200, { status: "cancelled" });
      }

      if (method === "PUT" && action === "friend-code") {
        if (!config.friendKey) throw new HttpError(503, "friend_code_unavailable", "O compartilhamento de códigos não foi configurado neste ambiente.");
        const body = await readJson(req);
        const code = normalizeFriendCode(body.code);
        if (!code) throw new HttpError(400, "invalid_friend_code", "Informe um código de amizade válido, sem símbolos além de espaços e hífens.");
        const encrypted = encryptFriendCode(code, config.friendKey, `${roomId}:${current.id}`);
        await transaction(pool, async (client) => {
          const room = await client.query("SELECT status FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
          const member = await client.query("SELECT status FROM room_members WHERE room_id = $1 AND user_id = $2 FOR UPDATE", [roomId, current.id]);
          if (!room.rowCount || !member.rowCount || !["registered", "checked_in"].includes(member.rows[0].status)) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
          if (["completed", "cancelled"].includes(room.rows[0].status)) throw new HttpError(409, "room_finished", "A sala já terminou.");
          await client.query(
            `UPDATE room_members SET friend_code_ciphertext = $1, friend_code_nonce = $2, friend_code_tag = $3, friend_code_created_at = now()
              WHERE room_id = $4 AND user_id = $5`,
            [encrypted.ciphertext, encrypted.nonce, encrypted.tag, roomId, current.id],
          );
        });
        return json(res, 200, { shared: true });
      }

      if (method === "DELETE" && action === "friend-code") {
        const result = await pool.query(
          `UPDATE room_members SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
            WHERE room_id = $1 AND user_id = $2 RETURNING room_id`,
          [roomId, current.id],
        );
        if (!result.rowCount) throw new HttpError(404, "room_not_found", "Sala não encontrada.");
        return json(res, 200, { shared: false });
      }
    }

    const matchRoute = pathname.match(/^\/api\/matches\/([0-9a-f-]+)\/(report|confirm|dispute)$/i);
    if (matchRoute && isUuid(matchRoute[1])) {
      const current = assertUser(user);
      const [, matchId, action] = matchRoute;
      if (method === "POST" && action === "report") {
        const body = await readJson(req);
        const note = typeof body.note === "string" ? body.note.trim() : "";
        if (note.length > 250) throw new HttpError(400, "note_too_long", "A observação pode ter até 250 caracteres.");
        const result = await transaction(pool, async (client) => {
          const match = await client.query("SELECT * FROM matches WHERE id = $1 FOR UPDATE", [matchId]);
          if (!match.rowCount || !isRoomParticipant(match.rows[0], current.id)) throw new HttpError(404, "match_not_found", "Partida não encontrada.");
          if (![match.rows[0].player_a_id, match.rows[0].player_b_id].includes(body.winnerId)) throw new HttpError(400, "invalid_winner", "O vencedor precisa ser uma das pessoas da partida.");
          const existing = await client.query("SELECT * FROM match_reports WHERE match_id = $1", [matchId]);
          if (existing.rowCount) {
            const report = existing.rows[0];
            if (report.reporter_id === current.id && report.winner_id === body.winnerId && report.note === note) return { status: match.rows[0].status };
            throw new HttpError(409, "report_exists", "Já existe um relato para esta partida.");
          }
          if (match.rows[0].status !== "scheduled") throw new HttpError(409, "match_not_reportable", "Esta partida não aceita um novo relato.");
          await client.query("INSERT INTO match_reports (match_id, reporter_id, winner_id, note) VALUES ($1, $2, $3, $4)", [matchId, current.id, body.winnerId, note]);
          await client.query("UPDATE matches SET status = 'awaiting_confirmation' WHERE id = $1", [matchId]);
          return { status: "awaiting_confirmation" };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "confirm") {
        const result = await transaction(pool, async (client) => {
          const candidate = await client.query("SELECT * FROM matches WHERE id = $1", [matchId]);
          if (!candidate.rowCount || !isRoomParticipant(candidate.rows[0], current.id)) throw new HttpError(404, "match_not_found", "Partida não encontrada.");
          if (candidate.rows[0].tournament_id) {
            // Torneios são bloqueados antes da partida para serializar o avanço do chaveamento.
            const tournament = await client.query("SELECT status FROM tournaments WHERE id = $1 FOR UPDATE", [candidate.rows[0].tournament_id]);
            if (!tournament.rowCount || tournament.rows[0].status !== "in_progress") throw new HttpError(409, "tournament_finished", "O torneio não aceita mais confirmações de resultado.");
          }
          const match = await client.query("SELECT * FROM matches WHERE id = $1 FOR UPDATE", [matchId]);
          if (!match.rowCount || !isRoomParticipant(match.rows[0], current.id)) throw new HttpError(404, "match_not_found", "Partida não encontrada.");
          const report = await client.query("SELECT * FROM match_reports WHERE match_id = $1", [matchId]);
          if (!report.rowCount || report.rows[0].reporter_id === current.id || match.rows[0].status !== "awaiting_confirmation") throw new HttpError(409, "confirmation_not_allowed", "Só a outra pessoa pode confirmar um relato pendente.");
          await client.query("UPDATE matches SET status = 'confirmed', resolved_at = now() WHERE id = $1", [matchId]);
          if (match.rows[0].room_id) {
            await client.query("UPDATE rooms SET status = 'completed', finished_at = now() WHERE id = $1", [match.rows[0].room_id]);
            await clearRoomFriendCodes(client, match.rows[0].room_id);
            return { status: "confirmed" };
          }
          const tournament = await applyTournamentMatchResult(client, match.rows[0], report.rows[0].winner_id, "confirm");
          return { status: "confirmed", tournament };
        });
        return json(res, 200, result);
      }

      if (method === "POST" && action === "dispute") {
        const body = await readJson(req);
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (reason.length < 1 || reason.length > 500) throw new HttpError(400, "invalid_reason", "Explique a contestação em até 500 caracteres.");
        const result = await transaction(pool, async (client) => {
          const match = await client.query("SELECT * FROM matches WHERE id = $1 FOR UPDATE", [matchId]);
          if (!match.rowCount || !isRoomParticipant(match.rows[0], current.id)) throw new HttpError(404, "match_not_found", "Partida não encontrada.");
          const report = await client.query("SELECT * FROM match_reports WHERE match_id = $1", [matchId]);
          if (!report.rowCount || report.rows[0].reporter_id === current.id || match.rows[0].status !== "awaiting_confirmation") throw new HttpError(409, "dispute_not_allowed", "Só a outra pessoa pode contestar um relato pendente.");
          await client.query("INSERT INTO disputes (match_id, opened_by, reason) VALUES ($1, $2, $3)", [matchId, current.id, reason]);
          await client.query("UPDATE matches SET status = 'disputed' WHERE id = $1", [matchId]);
          return { status: "disputed" };
        });
        return json(res, 201, result);
      }
    }

    if (method === "GET" && pathname === "/api/moderation/disputes") {
      const current = assertUser(user);
      if (!current.is_moderator) throw new HttpError(403, "moderator_required", "Acesso reservado à moderação.");
      const result = await pool.query(
        `SELECT d.id, d.reason, d.created_at, d.match_id, m.room_id, m.tournament_id,
                COALESCE(r.name, t.name) AS event_name,
                report.winner_id, report.note, reporter.handle AS reporter_handle, opener.handle AS opened_by_handle
           FROM disputes d JOIN matches m ON m.id = d.match_id
           LEFT JOIN rooms r ON r.id = m.room_id LEFT JOIN tournaments t ON t.id = m.tournament_id
           JOIN match_reports report ON report.match_id = m.id JOIN users reporter ON reporter.id = report.reporter_id
           JOIN users opener ON opener.id = d.opened_by
          WHERE d.status = 'open' ORDER BY d.created_at LIMIT 100`,
      );
      return json(res, 200, { disputes: result.rows.map((row) => ({ id: row.id, reason: row.reason, createdAt: row.created_at, matchId: row.match_id, roomId: row.room_id, tournamentId: row.tournament_id, eventType: row.tournament_id ? "tournament" : "room", eventName: row.event_name, winnerId: row.winner_id, note: row.note, reporterHandle: row.reporter_handle, openedByHandle: row.opened_by_handle })) });
    }

    const resolveMatch = pathname.match(/^\/api\/moderation\/disputes\/([0-9a-f-]+)\/resolve$/i);
    if (method === "POST" && resolveMatch && isUuid(resolveMatch[1])) {
      const current = assertUser(user);
      if (!current.is_moderator) throw new HttpError(403, "moderator_required", "Acesso reservado à moderação.");
      const body = await readJson(req);
      const decision = body.decision;
      const resolution = typeof body.resolution === "string" ? body.resolution.trim() : "";
      if (!["confirm", "void"].includes(decision) || resolution.length < 1 || resolution.length > 500) throw new HttpError(400, "invalid_resolution", "Escolha confirmar ou anular e registre uma justificativa de até 500 caracteres.");
      const result = await transaction(pool, async (client) => {
        const matchReference = await client.query(
          "SELECT m.tournament_id FROM disputes d JOIN matches m ON m.id = d.match_id WHERE d.id = $1",
          [resolveMatch[1]],
        );
        if (matchReference.rows[0]?.tournament_id) {
          // Usa a mesma ordem de bloqueio da confirmação comum.
          await client.query("SELECT id FROM tournaments WHERE id = $1 FOR UPDATE", [matchReference.rows[0].tournament_id]);
        }
        const dispute = await client.query("SELECT d.*, m.room_id, m.tournament_id, m.round_number, m.bracket_slot, m.status AS match_status, m.id AS match_id FROM disputes d JOIN matches m ON m.id = d.match_id WHERE d.id = $1 FOR UPDATE OF d, m", [resolveMatch[1]]);
        if (!dispute.rowCount || dispute.rows[0].status !== "open" || dispute.rows[0].match_status !== "disputed") throw new HttpError(404, "dispute_not_found", "Contestação não encontrada ou já resolvida.");
        const row = dispute.rows[0];
        const report = await client.query("SELECT winner_id FROM match_reports WHERE match_id = $1", [row.match_id]);
        const finalStatus = decision === "confirm" ? "confirmed" : "void";
        await client.query("UPDATE disputes SET status = $1, resolution = $2, moderator_id = $3, resolved_at = now() WHERE id = $4", [finalStatus, resolution, current.id, resolveMatch[1]]);
        await client.query("UPDATE matches SET status = $1, resolved_at = now() WHERE id = $2", [finalStatus, row.match_id]);
        let tournament = null;
        if (row.room_id) {
          await client.query("UPDATE rooms SET status = 'completed', finished_at = now() WHERE id = $1", [row.room_id]);
          await clearRoomFriendCodes(client, row.room_id);
        } else {
          tournament = await applyTournamentMatchResult(client, row, report.rows[0]?.winner_id, decision);
        }
        await client.query(
          "INSERT INTO moderation_events (actor_id, room_id, tournament_id, target_user_id, action, reason) VALUES ($1, $2, $3, $4, $5, $6)",
          [current.id, row.room_id, row.tournament_id, row.opened_by, `resolve_dispute_${decision}`, resolution],
        );
        return { status: finalStatus, winnerId: decision === "confirm" ? report.rows[0]?.winner_id : null, tournament };
      });
      return json(res, 200, result);
    }

    json(res, 404, { error: { code: "not_found", message: "Rota não encontrada." } });
  }

  return createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (error instanceof HttpError) return json(res, error.status, { error: { code: error.code, message: error.message } });
      process.stderr.write(`API failure: ${error.name || "Error"}\n`);
      return json(res, 500, { error: { code: "internal_error", message: "O serviço encontrou um erro. Tente de novo." } });
    });
  });
}

async function clearRoomFriendCodes(client, roomId) {
  await client.query(
    `UPDATE room_members SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
      WHERE room_id = $1`,
    [roomId],
  );
}

async function clearTournamentFriendCodes(client, tournamentId) {
  await client.query(
    `UPDATE tournament_members SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
      WHERE tournament_id = $1`,
    [tournamentId],
  );
}

async function clearExpiredTournamentFriendCodes(pool, tournamentId = null) {
  const parameters = tournamentId ? [tournamentId] : [];
  const eventFilter = tournamentId ? "t.id = $1 AND" : "";
  await pool.query(
    `UPDATE tournament_members member
        SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
       FROM tournaments t
      WHERE member.tournament_id = t.id AND ${eventFilter}
        (member.friend_code_created_at < now() - interval '7 days' OR t.status IN ('completed', 'cancelled'))`,
    parameters,
  );
}

async function applyTournamentMatchResult(client, match, winnerId, decision) {
  const matchId = match.id || match.match_id;
  const tournamentResult = await client.query("SELECT * FROM tournaments WHERE id = $1 FOR UPDATE", [match.tournament_id]);
  if (!tournamentResult.rowCount) throw new HttpError(404, "tournament_not_found", "Torneio não encontrado.");
  const tournament = tournamentResult.rows[0];

  if (decision === "void") {
    if (!["completed", "cancelled"].includes(tournament.status)) {
      await client.query(
        `UPDATE tournaments SET status = 'cancelled', champion_id = NULL, finished_at = now(), invite_expires_at = now(), bracket_version = bracket_version + 1
          WHERE id = $1`,
        [tournament.id],
      );
      await client.query("UPDATE matches SET status = 'void', resolved_at = COALESCE(resolved_at, now()) WHERE tournament_id = $1 AND id <> $2 AND status IN ('scheduled', 'awaiting_confirmation')", [tournament.id, matchId]);
      await clearTournamentFriendCodes(client, tournament.id);
      return { status: "cancelled", championId: null, bracketVersion: tournament.bracket_version + 1 };
    }
    return { status: tournament.status, championId: tournament.champion_id, bracketVersion: tournament.bracket_version };
  }

  if (tournament.status !== "in_progress") {
    return { status: tournament.status, championId: tournament.champion_id, bracketVersion: tournament.bracket_version };
  }

  if (match.round_number === 1) {
    const semifinals = await client.query(
      `SELECT m.bracket_slot, m.status, report.winner_id
         FROM matches m LEFT JOIN match_reports report ON report.match_id = m.id
        WHERE m.tournament_id = $1 AND m.round_number = 1 ORDER BY m.bracket_slot`,
      [tournament.id],
    );
    if (semifinals.rowCount === 2 && semifinals.rows.every((row) => row.status === "confirmed" && row.winner_id)) {
      const final = await client.query(
        `INSERT INTO matches (tournament_id, round_number, bracket_slot, player_a_id, player_b_id)
         VALUES ($1, 2, 0, $2, $3)
         ON CONFLICT (tournament_id, round_number, bracket_slot) WHERE tournament_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [tournament.id, semifinals.rows[0].winner_id, semifinals.rows[1].winner_id],
      );
      await client.query("UPDATE tournaments SET bracket_version = bracket_version + 1 WHERE id = $1", [tournament.id]);
      const finalId = final.rows[0]?.id || (await client.query("SELECT id FROM matches WHERE tournament_id = $1 AND round_number = 2 AND bracket_slot = 0", [tournament.id])).rows[0]?.id;
      return { status: "in_progress", championId: null, bracketVersion: tournament.bracket_version + 1, finalMatchId: finalId };
    }
    return { status: "in_progress", championId: null, bracketVersion: tournament.bracket_version };
  }

  if (match.round_number === 2) {
    await client.query(
      `UPDATE tournaments SET status = 'completed', champion_id = $2, finished_at = now(), invite_expires_at = now(), bracket_version = bracket_version + 1
        WHERE id = $1`,
      [tournament.id, winnerId],
    );
    await clearTournamentFriendCodes(client, tournament.id);
    return { status: "completed", championId: winnerId, bracketVersion: tournament.bracket_version + 1 };
  }

  return { status: tournament.status, championId: tournament.champion_id, bracketVersion: tournament.bracket_version };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const pool = createPool();
  const server = createApiServer({ pool });
  const host = process.env.API_HOST || "127.0.0.1";
  const port = Number(process.env.API_PORT || 8787);
  server.listen(port, host, () => process.stdout.write(`Spinda Stop API em http://${host}:${port}\n`));
  const cleanupExpiredData = () => {
    pool.query("DELETE FROM sessions WHERE expires_at < now()").catch(() => {});
    pool.query("DELETE FROM oauth_states WHERE expires_at < now()").catch(() => {});
    pool.query(
      `UPDATE room_members rm SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
        WHERE rm.friend_code_created_at < now() - interval '7 days'
           OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = rm.room_id AND r.status IN ('completed', 'cancelled'))`,
    ).catch(() => {});
    pool.query(
      `UPDATE tournament_members tm SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
        WHERE tm.friend_code_created_at < now() - interval '7 days'
           OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tm.tournament_id AND t.status IN ('completed', 'cancelled'))`,
    ).catch(() => {});
  };
  cleanupExpiredData();
  const cleanup = setInterval(cleanupExpiredData, 60 * 60 * 1000);
  cleanup.unref();
  process.on("SIGTERM", () => server.close(() => pool.end().finally(() => process.exit(0))));
  process.on("SIGINT", () => server.close(() => pool.end().finally(() => process.exit(0))));
}
