import { readBoundedJson } from "./read-bounded-json.js";

const API_URL = "https://play.limitlesstcg.com/api/tournaments";
const PUBLIC_CACHE = "public, max-age=60, s-maxage=900, stale-while-revalidate=3600";
const MAX_BODY_LENGTH = 1_048_576;
const TOURNAMENT_ID = /^[a-f\d]{24}$/i;
const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 1000;
const REGULATIONS = new Set(["M-A", "M-B", "M-C"]);
const NEGATIVE_CACHE = "public, max-age=10, s-maxage=30, stale-while-revalidate=30";
const NEGATIVE_TTL_MS = 30_000;
const MAX_NEGATIVE_ENTRIES = 256;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

function reply(body, status = 200, cacheControl = "no-store", headers = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": cacheControl, ...headers } });
}

function safeText(value, maximum = 140) {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex -- Strip untrusted control characters from public metadata.
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function normalizeTournament(row, format) {
  if (!isRecord(row) || row.game !== "VGC" || row.format !== format || !TOURNAMENT_ID.test(row.id || "")) return null;
  const date = validDate(row.date);
  if (!date) return null;
  return {
    id: row.id,
    game: "VGC",
    format,
    name: safeText(row.name),
    date,
    players: nonNegativeInteger(row.players),
    url: `https://play.limitlesstcg.com/tournament/${row.id}`,
  };
}

function normalizePhase(phase) {
  if (!isRecord(phase)) return null;
  return {
    phase: Number.isSafeInteger(phase.phase) && phase.phase > 0 ? phase.phase : null,
    type: safeText(phase.type, 40),
    rounds: Number.isSafeInteger(phase.rounds) && phase.rounds >= 0 ? phase.rounds : null,
    mode: safeText(phase.mode, 10),
  };
}

function normalizeDetails(row, format, expectedId) {
  const tournament = normalizeTournament(row, format);
  if (!tournament || row.id !== expectedId || row.isPublic !== true) return null;
  const details = {
    ...tournament,
    isPublic: true,
  };
  if (isRecord(row.organizer)) {
    details.organizer = {
      id: Number.isSafeInteger(row.organizer.id) ? row.organizer.id : null,
      name: safeText(row.organizer.name),
    };
  }
  if (typeof row.platform === "string") details.platform = safeText(row.platform, 32);
  if (typeof row.decklists === "boolean") details.decklists = row.decklists;
  if (typeof row.isOnline === "boolean") details.isOnline = row.isOnline;
  if (Array.isArray(row.phases)) details.phases = row.phases.slice(0, 16).map(normalizePhase).filter(Boolean);
  if (Array.isArray(row.specialRules)) {
    details.specialRules = row.specialRules.slice(0, 32).map((rule) => safeText(rule, 80)).filter(Boolean);
  }
  return details;
}

function normalizeTeamlist(value) {
  let members;
  if (Array.isArray(value)) {
    if (value.length !== 6) return null;
    members = value;
  } else {
    if (!isRecord(value) || Object.keys(value).length !== 6
      || !Array.from({ length: 6 }, (_, index) => Object.hasOwn(value, String(index))).every(Boolean)) return null;
    members = Array.from({ length: 6 }, (_, index) => value[index]);
  }
  const team = members.map((member) => {
    if (!isRecord(member)) return null;
    const speciesId = safeText(member.id, 100);
    const speciesName = safeText(member.name, 100);
    if (!speciesId || !speciesName) return null;
    const normalized = { speciesId, speciesName };
    for (const [source, target] of [["item", "item"], ["ability", "ability"], ["nature", "nature"]]) {
      const field = safeText(member[source], 100);
      if (field) normalized[target] = field;
    }
    if (Array.isArray(member.attacks)) {
      normalized.moves = member.attacks.slice(0, 4).map((move) => safeText(move, 100)).filter(Boolean);
    }
    return normalized;
  });
  return team.every(Boolean) ? team : null;
}

function normalizeStanding(row, includeTeamlist, allowTeamlists) {
  if (!isRecord(row) || typeof row.player !== "string" || !row.player.trim()) return null;
  const standing = {
    player: safeText(row.player, 100),
    name: safeText(row.name, 100) || safeText(row.player, 100),
    placing: Number.isSafeInteger(row.placing) && row.placing > 0 ? row.placing : null,
  };
  if (typeof row.country === "string" && /^[A-Za-z]{2}$/.test(row.country)) standing.country = row.country.toUpperCase();
  if (isRecord(row.record)) {
    standing.record = {
      wins: nonNegativeInteger(row.record.wins),
      losses: nonNegativeInteger(row.record.losses),
      ties: nonNegativeInteger(row.record.ties),
    };
  }
  if (allowTeamlists) {
    const teamlist = normalizeTeamlist(row.decklist);
    standing.teamlistAvailable = Boolean(teamlist);
    if (includeTeamlist && teamlist) standing.teamlist = teamlist;
  }
  return standing;
}

function retryAfterMilliseconds(header, now) {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.max(seconds * 1000, 1000), MAX_RETRY_AFTER_MS);
  }
  const timestamp = Date.parse(header || "");
  return Number.isFinite(timestamp)
    ? Math.min(Math.max(timestamp - now, 1000), MAX_RETRY_AFTER_MS)
    : DEFAULT_RETRY_AFTER_MS;
}

async function fetchJson(fetchImpl, url, { allowNotFound = false, now = Date.now, onRateLimit } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (allowNotFound && response.status === 404) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    if (response.status === 429) {
      const retryAfterMs = retryAfterMilliseconds(response.headers.get("retry-after"), now());
      await response.body?.cancel().catch(() => {});
      onRateLimit?.(retryAfterMs);
      const error = new Error("upstream_rate_limited");
      error.retryAfterMs = retryAfterMs;
      throw error;
    }
    return await readBoundedJson(response, MAX_BODY_LENGTH);
  } finally {
    clearTimeout(timeout);
  }
}

function parsePage(url) {
  const rawPage = url.searchParams.get("page");
  const rawLimit = url.searchParams.get("limit");
  const page = rawPage === null ? 1 : Number(rawPage);
  const limit = rawLimit === null ? PAGE_SIZE : Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE || !Number.isSafeInteger(limit) || limit < 1) return null;
  return { page, limit: Math.min(limit, MAX_PAGE_SIZE) };
}

function requestedFormat(url) {
  const format = url.searchParams.get("format") || "M-C";
  return REGULATIONS.has(format) ? format : null;
}

function responseMetadata() {
  return { checkedAt: new Date().toISOString() };
}

function errorUnavailable(error) {
  const retryAfterMs = Number(error?.retryAfterMs);
  const rateLimited = Number.isFinite(retryAfterMs) && retryAfterMs > 0;
  return reply(
    { error: { code: "public_tournaments_unavailable", message: "Os dados públicos do torneio não estão disponíveis agora." } },
    rateLimited ? 503 : 502,
    "no-store",
    rateLimited ? { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } : {},
  );
}

export function createPublicVgcTournamentsHandler(fetchImpl = globalThis.fetch, { now = Date.now } = {}) {
  const notFoundCache = new Map();
  let upstreamCooldownUntil = 0;
  function fetchUpstream(url, options = {}) {
    const retryAfterMs = upstreamCooldownUntil - now();
    if (retryAfterMs > 0) {
      const error = new Error("upstream_rate_limited");
      error.retryAfterMs = retryAfterMs;
      throw error;
    }
    return fetchJson(fetchImpl, url, {
      ...options,
      now,
      onRateLimit(delay) {
        // shortcut: the cooldown is per instance; use shared storage if Limitless quota is hit across instances.
        upstreamCooldownUntil = Math.max(upstreamCooldownUntil, now() + delay);
      },
    });
  }
  function cachedNotFound(key) {
    const cached = notFoundCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= now()) {
      notFoundCache.delete(key);
      return null;
    }
    return reply(cached.body, 404, NEGATIVE_CACHE);
  }
  function rememberNotFound(key, code, message) {
    if (!notFoundCache.has(key) && notFoundCache.size >= MAX_NEGATIVE_ENTRIES) {
      notFoundCache.delete(notFoundCache.keys().next().value);
    }
    const body = { error: { code, message } };
    notFoundCache.set(key, { body, expiresAt: now() + NEGATIVE_TTL_MS });
    return reply(body, 404, NEGATIVE_CACHE);
  }

  return async function handlePublicVgcTournaments(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") return reply({ error: { code: "method_not_allowed" } }, 405);

    const path = url.pathname.match(/^\/api\/public\/vgc-tournaments(?:\/([a-f\d]{24})(?:\/(details|standings))?)?$/i);
    if (!path) return reply({ error: { code: "not_found" } }, 404);
    const [, id, action] = path;

    if (!id) {
      const pagination = parsePage(url);
      if (!pagination) return reply({ error: { code: "invalid_pagination", message: "Página ou limite inválido." } }, 400);
      const format = requestedFormat(url);
      if (!format) return reply({ error: { code: "invalid_format", message: "Regulamento VGC inválido." } }, 400);
      try {
        const upstream = new URL(API_URL);
        upstream.search = new URLSearchParams({
          game: "VGC",
          format,
          limit: String(pagination.limit),
          page: String(pagination.page),
        }).toString();
        const payload = await fetchUpstream(upstream);
        if (!Array.isArray(payload)) throw new Error("invalid_tournaments");
        const tournaments = payload.map((row) => normalizeTournament(row, format)).filter(Boolean);
        return reply({
          tournaments,
          page: pagination.page,
          limit: pagination.limit,
          hasNextPage: payload.length === pagination.limit,
          ...responseMetadata(),
        }, 200, PUBLIC_CACHE);
      } catch (error) {
        return errorUnavailable(error);
      }
    }

    if (!TOURNAMENT_ID.test(id)) return reply({ error: { code: "not_found" } }, 404);
    const format = requestedFormat(url);
    if (!format) return reply({ error: { code: "invalid_format", message: "Regulamento VGC inválido." } }, 400);
    const eventKey = `event:${id}:${format}`;
    if (action !== "standings") {
      const cached = cachedNotFound(eventKey);
      if (cached) return cached;
      try {
        const details = await fetchUpstream(`${API_URL}/${id}/details`, { allowNotFound: true });
        const tournament = details && normalizeDetails(details, format, id);
        return tournament
          ? reply({ tournament, ...responseMetadata() }, 200, PUBLIC_CACHE)
          : rememberNotFound(eventKey, "tournament_not_found", "Torneio público não encontrado.");
      } catch (error) {
        return errorUnavailable(error);
      }
    }

    const selectedPlayer = url.searchParams.get("player") || "";
    // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted public player IDs.
    if (selectedPlayer.length > 100 || /[\u0000-\u001f\u007f]/.test(selectedPlayer)) {
      return reply({ error: { code: "invalid_player", message: "Identificador de jogador inválido." } }, 400);
    }
    const cachedEvent = cachedNotFound(eventKey);
    if (cachedEvent) return cachedEvent;
    const teamKey = selectedPlayer ? `team:${id}:${format}:${selectedPlayer}` : "";
    const cachedTeam = teamKey ? cachedNotFound(teamKey) : null;
    if (cachedTeam) return cachedTeam;
    try {
      const details = await fetchUpstream(`${API_URL}/${id}/details`, { allowNotFound: true });
      const tournament = details && normalizeDetails(details, format, id);
      if (!tournament) return rememberNotFound(eventKey, "tournament_not_found", "Torneio público não encontrado.");
      const payload = await fetchUpstream(`${API_URL}/${id}/standings`);
      if (!Array.isArray(payload)) throw new Error("invalid_standings");
      const standings = payload.map((row) => normalizeStanding(row, false, tournament.decklists === true)).filter(Boolean);
      if (!selectedPlayer) return reply({ tournament, standings, ...responseMetadata() }, 200, PUBLIC_CACHE);
      const selected = payload.map((row) => normalizeStanding(row, true, tournament.decklists === true)).find((standing) => standing?.player === selectedPlayer && standing.teamlist);
      return selected
        ? reply({ tournament, teamlist: selected.teamlist, player: selected.player, ...responseMetadata() }, 200, PUBLIC_CACHE)
        : rememberNotFound(teamKey, "teamlist_not_found", "Esta teamlist pública não está disponível.");
    } catch (error) {
      return errorUnavailable(error);
    }
  };
}
