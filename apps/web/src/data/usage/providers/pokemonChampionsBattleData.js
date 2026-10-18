const API_BASE_URL = "https://championsbattledata.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 16;
const responseCache = new Map();
const inFlightRequests = new Map();

const STAT_POINT_FIELDS = [
  ["hp", "hp_points"],
  ["attack", "attack_points"],
  ["defense", "defense_points"],
  ["spAttack", "sp_atk_points"],
  ["spDefense", "sp_def_points"],
  ["speed", "speed_points"],
];

export const pokemonChampionsBattleDataSource = Object.freeze({
  id: "pokemon-champions-battle-data",
  label: "Pokémon Champions Battle Data",
  attribution: "Dados de batalha: Pokémon Champions Battle Data",
  url: "https://championsbattledata.com/",
  guideUrl: "https://championsbattledata.com/api_guide",
});

function rememberResponse(path, data) {
  responseCache.delete(path);
  responseCache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value);
  }
}

async function requestJson(path, force = false) {
  const cached = responseCache.get(path);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;
  if (inFlightRequests.has(path)) return inFlightRequests.get(path);

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(API_BASE_URL + path, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      rememberResponse(path, data);
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("A fonte demorou a responder.", { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      inFlightRequests.delete(path);
    }
  })();

  inFlightRequests.set(path, request);
  return request;
}

export function normalizeUsageIndexResponse(payload) {
  if (!payload || !Array.isArray(payload.pokemon)) {
    throw new Error("O índice da fonte não contém uma lista de espécies.");
  }

  const season = typeof payload.defaultSeason === "string" ? payload.defaultSeason : null;

  return {
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : null,
    season,
    pokemon: payload.pokemon
      .filter((entry) => entry && typeof entry.showdownId === "string")
      .map((entry) => {
        const currentDoubles = season ? entry.summary?.battleSummary?.[season]?.Doubles : null;

        return {
          name: entry.name || entry.battleName || entry.showdownName || entry.showdownId,
          showdownId: entry.showdownId,
          types: Array.isArray(entry.summary?.types) ? entry.summary.types : [],
          position: Number.isFinite(currentDoubles?.position) ? currentDoubles.position : null,
        };
      }),
  };
}

export function normalizeUsageBattleResponse(payload) {
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error("A resposta de batalha não contém linhas.");
  }

  return {
    pokemon: typeof payload.pokemon === "string" ? payload.pokemon : null,
    showdownId: typeof payload.showdownId === "string" ? payload.showdownId : null,
    format: typeof payload.format === "string" ? payload.format : null,
    season: typeof payload.season === "string" ? payload.season : null,
    date: typeof payload.date === "string" ? payload.date : null,
    sourceFile: typeof payload.source === "string" ? payload.source : null,
    rows: payload.rows.map((row) => ({
      category: typeof row.category === "string" ? row.category : null,
      rank: Number.isFinite(row.rank) ? row.rank : null,
      name: typeof row.name === "string" ? row.name : "",
      percentage: typeof row.percentage === "string" && row.percentage.trim() ? row.percentage : null,
      percentageValue: Number.isFinite(row.percentage_value) ? row.percentage_value : null,
      statUp: typeof row.stat_up === "string" && row.stat_up ? row.stat_up : null,
      statDown: typeof row.stat_down === "string" && row.stat_down ? row.stat_down : null,
      statPoints: Object.fromEntries(
        STAT_POINT_FIELDS.map(([key, field]) => [key, row[field] ?? null]),
      ),
    })),
  };
}

export const pokemonChampionsBattleDataProvider = Object.freeze({
  source: pokemonChampionsBattleDataSource,

  async loadIndex({ force = false } = {}) {
    return normalizeUsageIndexResponse(await requestJson("/api", force));
  },

  async loadPokemonUsage({ showdownId, force = false }) {
    if (!showdownId) throw new Error("Falta o identificador da espécie.");

    const response = normalizeUsageBattleResponse(
      await requestJson("/api/battle/Doubles/" + encodeURIComponent(showdownId), force),
    );

    if (response.format !== "Doubles") {
      throw new Error("A fonte não retornou o formato Doubles.");
    }

    return response;
  },
});
