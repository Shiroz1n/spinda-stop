const TOURNAMENTS_URL = "https://play.limitlesstcg.com/api/tournaments";
const PUBLIC_CACHE = "public, max-age=60, s-maxage=900, stale-while-revalidate=3600";
const MAX_BODY_LENGTH = 1_048_576;
const TOURNAMENT_ID = /^[a-f\d]{24}$/i;

function reply(body, status = 200, cacheControl = "no-store") {
  return Response.json(body, { status, headers: { "Cache-Control": cacheControl } });
}

function safeText(value, maximum = 140) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum)
    : "";
}

function normalizeTournament(row) {
  if (!row || row.game !== "VGC" || row.format !== "M-C" || !TOURNAMENT_ID.test(row.id || "")) return null;
  const date = typeof row.date === "string" && Number.isFinite(Date.parse(row.date)) ? row.date : null;
  if (!date) return null;
  return {
    id: row.id,
    name: safeText(row.name),
    date,
    players: Number.isSafeInteger(row.players) && row.players >= 0 ? row.players : null,
    url: `https://play.limitlesstcg.com/tournament/${row.id}`,
  };
}

async function fetchJson(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("upstream_status");
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) throw new Error("upstream_size");
    const text = await response.text();
    if (text.length > MAX_BODY_LENGTH) throw new Error("upstream_size");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export function createPublicVgcTournamentsHandler(fetchImpl = globalThis.fetch) {
  return async function handlePublicVgcTournaments(request) {
    if (new URL(request.url).pathname !== "/api/public/vgc-tournaments") return reply({ error: { code: "not_found" } }, 404);
    if (request.method !== "GET") return reply({ error: { code: "method_not_allowed" } }, 405);
    try {
      const url = new URL(TOURNAMENTS_URL);
      url.search = new URLSearchParams({ game: "VGC", format: "M-C", limit: "8" }).toString();
      const payload = await fetchJson(fetchImpl, url);
      if (!Array.isArray(payload)) throw new Error("invalid_tournaments");
      const tournaments = payload.map(normalizeTournament).filter(Boolean).slice(0, 8);
      return reply({ tournaments }, 200, PUBLIC_CACHE);
    } catch {
      return reply({ error: { code: "public_tournaments_unavailable", message: "A agenda de torneios não está disponível agora." } }, 502);
    }
  };
}
