Warning: truncated output (original token count: 19987)
Total output lines: 1394

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
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

export function createRateLimiter({ pool, secret = "development-only-rate-limit-key", limit = 24, windowMs = 15 * 60 * 1000, maxBuckets = 10_000 } = {}) {
  if (!pool) throw new Error("O rate limit compartilhado precisa do pool PostgreSQL.");
  return async (req, key) => {
    const bucketWindow = Math.floor(Date.now() / windowMs);
    const identity = createHmac("sha256", secret)
      .update(`${key}\0${req.socket.remoteAddress || "unknown"}`)
      .digest("hex");
    const result = await pool.query(
      `INSERT INTO api_rate_limits (bucket_key, bucket_window, hit_count, expires_at)
       VALUES ($1, $2, 1, now() + ($3::double precision * interval '1 millisecond'))
       ON CONFLICT (bucket_key) DO UPDATE
         SET bucket_window = EXCLUDED.bucket_window,
             hit_count = CASE
               WHEN api_rate_limits.bucket_window = EXCLUDED.bucket_window THEN LEAST(api_rate_limits.hit_count + 1, $4::integer)
               ELSE 1
             END,
             expires_at = EXCLUDED.expires_at
       RETURNING hit_count`,
      [identity, bucketWindow, windowMs, limit + 1],
    );
    const hitCount = result.rows[0]?.hit_count;
    if (!Number.isInteger(hitCount)) throw new Error("O PostgreSQL não retornou o contador de limite.");
    if (hitCount > limit) throw new HttpError(429, "rate_limited", "Muitas tentativas. Aguarde alguns minutos e tente de novo.");

    if (hitCount === 1) {
      const active = await pool.query("SELECT count(*)::int AS count FROM api_rate_limits WHERE expires_at > now()");
      if (active.rows[0].count > maxBuckets) {
        await pool.query("DELETE FROM api_rate_limits WHERE bucket_key = $1 AND bucket_window = $2 AND hit_count = 1", [identity, bucketWindow]);
        throw new HttpError(429, "rate_limited", "Muitas tentativas. Aguarde alguns minutos e tente de novo.");
      }
    }
  };
}

export async function cleanupExpiredData(pool) {
  return transaction(pool, async (client) => {
    const sessions = await client.query("DELETE FROM sessions WHERE expires_at < now()");
    const oauthStates = await client.query("DELETE FROM oauth_states WHERE expires_at < now()");
    const rateLimitBuckets = await client.query("DELETE FROM api_rate_limits WHERE expires_at < now()");
    const roomFriendCodes = await client.query(
      `UPDATE room_members rm SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
        WHERE (rm.friend_code_created_at < now() - interval '7 days'
           OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = rm.room_id AND r.status IN ('completed', 'cancelled')))
          AND rm.friend_code_ciphertext IS NOT NULL`,
    );
    const tournamentFriendCodes = await client.query(
      `UPDATE tournament_members tm SET friend_code_ciphertext = NULL, friend_code_nonce = NULL, friend_code_tag = NULL, friend_code_created_at = NULL
        WHERE (tm.friend_code_created_at < now() - interval '7 days'
           OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tm.tournament_id AND t.status IN ('completed', 'cancelled')))
          AND tm.friend_code_ciphertext IS NOT NULL`,
    );
    return {
      sessions: sessions.rowCount,
      oauthStates: oauthStates.rowCount,
      rateLimitBuckets: rateLimitBuckets.rowCount,
      roomFriendCodes: roomFriendCodes.rowCount,
      tournamentFriendCodes: tournamentFriendCodes.rowCount,
    };
  });
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
  const isProduction = env.VERCEL_ENV === "production" || env.APP_ENV === "production";
  const deploymentHost = isProduction
    ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
    : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  const deploymentOrigin = deploymentHost ? `https://${deploymentHost}` : "";
  const origin = new URL(env.APP_ORIGIN || deploymentOrigin || "http://127.0.0.1:5173");
  if (origin.pathname !== "/" || origin.search || origin.hash) throw new Error("APP_ORIGIN deve conter somente a origem do aplicativo.");
  const secureCookies = env.COOKIE_SECURE === "true" || isProduction || Boolean(env.VERCEL_URL);
  const rateLimitHashSecret = env.RATE_LIMIT_HASH_SECRET || "";
  if ((env.VERCEL_ENV || isProduction) && !rateLimitHashSecret) {
    throw new Error("RATE_LIMIT_HASH_SECRET é obrigatória em deployments Vercel.");
  }
  if (env.APP_ENV === "test" && env.API_HOST && !["127.0.0.1", "::1", "localhost"].includes(env.API_HOST)) {
    throw new Error("O servidor de teste só pode ouvir em loopback.");
  }
  let friendKey = null;
  if (env.FRIEND_CODE_ENCRYPTION_KEY) friendKey = encryptionKey(env.FRIEND_CODE_ENCRYPTION_KEY);
  if (isProduction && !friendKey) throw new Error("FRIEND_CODE_ENCRYPTION_KEY é obrigatória em produção.");
  return {
    appOrigin: origin.origin,
    secureCookies,
    // Vercel's deployment context is authoritative over an accidentally
    // configured APP_ENV, especially for routes that exist only in tests.
    envName: env.VERCEL_ENV || env.APP_ENV || "development",
    githubClientId: env.GITHUB_CLIENT_ID || "",
    githubClientSecret: env.GITHUB_CLIENT_SECRET || "",
    friendKey,
    rateLimitHashSecret: rateLimitHashSecret || "development-only-rate-limit-key",
    cronSecret: env.CRON_SECRET || "",
  };
}

function requestFromWebRequest(request, remoteAddress) {
  const url = new URL(request.url);
  const headers = Object.create(null);
  for (const [name, value] of request.headers) headers[name.toLowerCase()] = value;

  const adapted = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    socket: { remoteAddress: remoteAddress || "unknown" },
  };

  if (request.body) {
    adapted[Symbol.asyncIterator] = async function* readBody() {
      const reader = request.body.getReader();
      let completed = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            completed = true;
            return;
          }
          yield Buffer.from(value);
        }
      } finally {
        if (!completed) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    };
  }

  return adapted;
}

function responseRecorder() {
  let status = 200;
  let body = null;
  let ended = false;
  const headers = new Headers();

  return {
    writeHead(nextStatus, values = {}) {
      status = nextStatus;
      for (const [name, value] of Object.entries(values)) {
        for (const item of Array.isArray(value) ? value : [value]) headers.append(name, String(item));
      }
    },
    end(value) {
      body = value ?? null;
      ended = true;
    },
    toResponse() {
      if (!ended) throw new Error("A rota da API não concluiu a resposta HTTP.");
      return new Response(body, { status, headers });
    },
  };
}

function requestAddress(request, server, trustVercelForwardedFor) {
  if (trustVercelForwardedFor) {
    const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwardedAddress) return forwardedAddress;
  }
  const socketAddress = server?.requestIP?.(request)?.address;
  // Outside Vercel, forwarded headers are request input unless a separately
  // trusted proxy contract is configured. Do not let callers choose their key.
  return socketAddress || "unknown";
}

function createApiRequestHandler({ pool, env = process.env, fetchImpl = fetch } = {}) {
  if (!pool) throw new Error("O pool PostgreSQL é obrigatório.");
  const config = appConfig(env);
  const rateLimit = createRateLimiter({ pool, secret: config.rateLimitHashSecret });
  const trustVercelForwardedFor = Boolean(env.VERCEL_ENV);

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

    if (method === "GET" && pathname === "/api/cron/cleanup") {
      if (!config.cronSecret) throw new HttpError(404, "not_found", "Rota não encontrada.");
      if (!secureEquals(req.headers.authorization, `Bearer ${config.cronSecret}`)) {
        throw new HttpError(401, "cron_unauthorized", "A autorização da rotina de manutenção é inválida.");
      }
      const cleanup = await cleanupExpiredData(pool);
      return json(res, 200, { ok: true, cleanup });
    }

    if (method === "GET" && pathname === "/api/auth/status") {
      return json(res, 200, {
        githubOAuthAvailable: Boolean(config.githubClientId && config.githubClientSecret),
        friendCodesAvailable: Boolean(config.friendKey),
      });
    }

    if (method === "GET" && pathname === "/api/auth/github") {
      await rateLimit(req, "oauth-start");
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
      await rateLimit(req, "oauth-callback");
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
         ON CONFLICT (provider, provider_subject) DO UPDATE SET handle = EXCLUDED.handle…10987 tokens truncated…created_at = now()
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

  return async function handleRequest(request, server) {
    const req = requestFromWebRequest(request, requestAddress(request, server, trustVercelForwardedFor));
    const res = responseRecorder();
    try {
      await handle(req, res);
    } catch (error) {
      if (error instanceof HttpError) json(res, error.status, { error: { code: error.code, message: error.message } });
      else {
        process.stderr.write(`API failure: ${error.name || "Error"}\n`);
        json(res, 500, { error: { code: "internal_error", message: "O serviço encontrou um erro. Tente de novo." } });
      }
    }
    return res.toResponse();
  };
}

export function createApiApp(options = {}) {
  const handleRequest = createApiRequestHandler(options);
  return new Elysia({ name: "spinda-stop-community-api" })
    .all("/api", ({ request, server }) => handleRequest(request, server))
    .all("/api/*", ({ request, server }) => handleRequest(request, server));
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

let deploymentHandler;

async function handleDeploymentRequest({ request, server }) {
  try {
    if (!deploymentHandler) {
      const env = {
        ...process.env,
        APP_ENV: process.env.APP_ENV || process.env.VERCEL_ENV || "development",
      };
      deploymentHandler = createApiRequestHandler({ pool: createPool(), env });
    }
    return await deploymentHandler(request, server);
  } catch (error) {
    process.stderr.write(`API startup failure: ${error.name || "Error"}\n`);
    return Response.json({ error: { code: "service_unavailable", message: "O serviço comunitário não está configurado neste ambiente." } }, { status: 503 });
  }
}

const deploymentApp = new Elysia({ name: "spinda-stop-community-api" })
  .all("/api", handleDeploymentRequest)
  .all("/api/*", handleDeploymentRequest);

export default deploymentApp;

if (import.meta.main) {
  const pool = createPool();
  const app = createApiApp({ pool });
  const host = process.env.API_HOST || "127.0.0.1";
  const port = Number(process.env.API_PORT || 8787);
  app.listen({ port, hostname: host });
  process.stdout.write(`Spinda Stop API em http://${host}:${app.server?.port || port}\n`);
  const runCleanup = () => cleanupExpiredData(pool).catch((error) => {
    process.stderr.write(`API cleanup failure: ${error.name || "Error"}\n`);
  });
  void runCleanup();
  const cleanup = setInterval(runCleanup, 60 * 60 * 1000);
  cleanup.unref();
  const shutdown = async () => {
    clearInterval(cleanup);
    await app.stop();
    await pool.end();
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}
