import dexData from "../../../packages/data/generated/pokedex.json" with { type: "json" };

const MUNCHSTATS_TEAMS_URL = "https://www.munchstats.com/teams/api/champions-mc/";
const PUBLIC_CACHE = "public, max-age=60, s-maxage=900, stale-while-revalidate=3600";
const MAX_BODY_LENGTH = 1_048_576;
const TEAM_ID = /^MC\d{3,8}$/;
const EXTERNAL_HOSTS = new Set([
  "munchstats.com",
  "www.munchstats.com",
  "pokepast.es",
  "www.pokepast.es",
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "vgcpastes.com",
  "www.vgcpastes.com",
  "victoryroadvgc.com",
  "www.victoryroadvgc.com",
]);
const normalizeName = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pokemonNames = new Map(dexData.pokemon.flatMap(({ name, slug }) => [[normalizeName(name), name], [normalizeName(slug), name]]));

function reply(body, status = 200, cacheControl = "no-store") {
  return Response.json(body, { status, headers: { "Cache-Control": cacheControl } });
}

function safeText(value, maximum = 120) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function safeExternalUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !EXTERNAL_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeTeam(row) {
  if (!row || typeof row !== "object" || !TEAM_ID.test(row.team_id || "")) return null;
  const pokemon = Array.isArray(row.pokemon) ? row.pokemon.slice(0, 6).map((member) => {
    const item = typeof member === "string" ? "" : safeText(member?.item, 80);
    const name = safeText(typeof member === "string" ? member : member?.name, 80);
    return name ? { name, item } : null;
  }).filter(Boolean) : [];
  if (!pokemon.length) return null;

  return {
    id: row.team_id,
    player: safeText(row.player || row.owner, 80),
    event: safeText(row.event, 140),
    placement: safeText(row.rank, 40),
    date: safeText(row.date, 40),
    sourceUrl: safeExternalUrl(row.source_link),
    pasteUrl: safeExternalUrl(row.pokepaste),
    pokemon,
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

export function createPublicCommunityTeamsHandler(fetchImpl = globalThis.fetch) {
  return async function handlePublicCommunityTeams(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const pasteMatch = path.match(/^\/api\/public\/teams\/([^/]+)\/paste$/);
    if (path !== "/api/public/teams" && !pasteMatch) return reply({ error: { code: "not_found" } }, 404);
    if (request.method !== "GET") return reply({ error: { code: "method_not_allowed" } }, 405);

    if (pasteMatch) {
      const id = pasteMatch[1];
      if (!TEAM_ID.test(id)) return reply({ error: { code: "invalid_team_id" } }, 400);
      try {
        const payload = await fetchJson(fetchImpl, new URL(`paste/${id}`, MUNCHSTATS_TEAMS_URL));
        if (typeof payload?.text !== "string" || payload.text.length > 128 * 1024) throw new Error("invalid_paste");
        return reply({ text: payload.text, sourceUrl: safeExternalUrl(payload.url) }, 200, PUBLIC_CACHE);
      } catch {
        return reply({ error: { code: "public_team_unavailable", message: "O paste público não está disponível agora." } }, 502);
      }
    }

    const rawPokemon = url.searchParams.get("pokemon") || "";
    if (rawPokemon.length > 80) return reply({ error: { code: "invalid_pokemon" } }, 400);
    const pokemon = pokemonNames.get(normalizeName(safeText(rawPokemon, 80)));
    if (!pokemon) return reply({ error: { code: "invalid_pokemon" } }, 400);
    try {
      const upstreamUrl = new URL(MUNCHSTATS_TEAMS_URL);
      upstreamUrl.search = new URLSearchParams({ q: pokemon, offset: "0", limit: "6", sort: "newest" }).toString();
      const payload = await fetchJson(fetchImpl, upstreamUrl);
      if (!Array.isArray(payload?.teams)) throw new Error("invalid_team_list");
      const teams = payload.teams.map(normalizeTeam).filter(Boolean).slice(0, 6);
      return reply({ teams }, 200, PUBLIC_CACHE);
    } catch {
      return reply({ error: { code: "public_teams_unavailable", message: "As equipes públicas não estão disponíveis agora." } }, 502);
    }
  };
}
