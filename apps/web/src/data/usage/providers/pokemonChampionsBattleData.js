const API_BASE_URL = "https://championsbattledata.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 16;
const REQUEST_TIMEOUT_MS = 25000;
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

const FILTER_CATEGORIES = [
  ["move", "moves"],
  ["held_item", "items"],
  ["ability", "abilities"],
];

export function withRequestTimeout(promise, timeoutMs, onTimeout = () => {}) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout();
      reject(new Error("A fonte demorou a responder."));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

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

function namesFromSummary(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(namesFromSummary);
  if (!value || typeof value !== "object") return [];

  for (const key of ["name", "value", "pokemon", "move", "item", "ability"]) {
    if (typeof value[key] === "string") return [value[key]];
  }

  return Object.entries(value).flatMap(([key, item]) => {
    if (typeof item === "number" || item === null
      || (typeof item === "string" && /^\d+(?:\.\d+)?%?$/.test(item))) return [key];
    return namesFromSummary(item);
  });
}

function collectBattleDataSeasons(value, seasons) {
  if (typeof value === "string") {
    const matches = value.match(/(?:^|\/)(M\d+)(?=\/|$)/gi) || [];
    for (const match of matches) seasons.add(match.replaceAll("/", "").toUpperCase());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectBattleDataSeasons(item, seasons));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value)) {
    if (/^M\d+$/i.test(key)) seasons.add(key.toUpperCase());
    if (/^M\d+$/i.test(item)) seasons.add(item.toUpperCase());
    collectBattleDataSeasons(item, seasons);
  }
}

function normalizeRows(rows) {
  return rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map((row) => ({
    category: typeof row.category === "string" ? row.category : null,
    rank: Number.isFinite(row.rank) ? row.rank : null,
    name: typeof row.name === "string" ? row.name : "",
    percentage: typeof row.percentage === "string" && row.percentage.trim() ? row.percentage : null,
    percentageValue: Number.isFinite(row.percentage_value) ? row.percentage_value : null,
    statUp: typeof row.stat_up === "string" && row.stat_up ? row.stat_up : null,
    statDown: typeof row.stat_down === "string" && row.stat_down ? row.stat_down : null,
    statPoints: Object.fromEntries(
      STAT_POINT_FIELDS.map(([key, field]) => [key, Number.isFinite(row[field]) ? row[field] : null]),
    ),
  }));
}

function normalizeSnapshot(payload) {
  if (!payload || !Array.isArray(payload.rows)) return null;
  return {
    pokemon: typeof payload.pokemon === "string" ? payload.pokemon : null,
    showdownId: typeof payload.showdownId === "string" ? payload.showdownId : null,
    format: typeof payload.format === "string" ? payload.format : null,
    season: typeof payload.season === "string" ? payload.season : null,
    date: typeof payload.date === "string" ? payload.date : null,
    sourceFile: typeof payload.source === "string" ? payload.source : null,
    rows: normalizeRows(payload.rows),
  };
}

async function requestJson(path, force = false) {
  if (inFlightRequests.has(path)) return inFlightRequests.get(path);
  const cached = responseCache.get(path);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;

  const request = (async () => {
    const controller = new AbortController();

    try {
      const dataPromise = fetch(API_BASE_URL + path, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      });
      const data = await withRequestTimeout(dataPromise, REQUEST_TIMEOUT_MS, () => controller.abort());
      rememberResponse(path, data);
      return data;
    } catch (error) {
      if (error.message === "A fonte demorou a responder.") throw error;
      if (error.name === "AbortError") {
        throw new Error("A fonte demorou a responder.", { cause: error });
      }
      throw error;
    } finally {
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
  const availableSeasons = new Set();
  collectBattleDataSeasons(payload.seasons, availableSeasons);
  collectBattleDataSeasons(payload.dailyDataFolders, availableSeasons);
  collectBattleDataSeasons(payload.battleDataFolders, availableSeasons);
  payload.pokemon.forEach((entry) => collectBattleDataSeasons(entry?.battleDataCsvs, availableSeasons));

  return {
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : null,
    season,
    availableSeasons: [...availableSeasons].sort((left, right) => {
      const leftNumber = Number(left.slice(1));
      const rightNumber = Number(right.slice(1));
      return rightNumber - leftNumber;
    }),
    pokemon: payload.pokemon
      .filter((entry) => entry && typeof entry.showdownId === "string")
      .map((entry) => {
        const currentDoubles = season ? entry.summary?.battleSummary?.[season]?.Doubles : null;
        const filterValues = Object.fromEntries(FILTER_CATEGORIES.map(([category, key]) => {
          const raw = currentDoubles?.values?.[category] ?? currentDoubles?.top?.[category];
          return [key, [...new Set(namesFromSummary(raw).filter(Boolean))]];
        }));

        return {
          name: entry.name || entry.battleName || entry.showdownName || entry.showdownId,
          showdownId: entry.showdownId,
          types: Array.isArray(entry.summary?.types) ? entry.summary.types : [],
          position: Number.isFinite(currentDoubles?.position) ? currentDoubles.position : null,
          filterValues,
        };
      }),
  };
}

export function normalizeUsageBattleResponse(payload) {
  if (!payload || (!Array.isArray(payload.rows) && !Array.isArray(payload.daily))) {
    throw new Error("A resposta de batalha não contém linhas.");
  }

  return {
    pokemon: typeof payload.pokemon === "string" ? payload.pokemon : null,
    showdownId: typeof payload.showdownId === "string" ? payload.showdownId : null,
    format: typeof payload.format === "string" ? payload.format : null,
    season: typeof payload.season === "string" ? payload.season : null,
    date: typeof payload.date === "string" ? payload.date : null,
    sourceFile: typeof payload.source === "string" ? payload.source : null,
    rows: Array.isArray(payload.rows) ? normalizeRows(payload.rows) : [],
    daily: Array.isArray(payload.daily)
      ? payload.daily.map(normalizeSnapshot).filter(Boolean)
      : [],
    requestedDays: Number.isInteger(payload.requestedDays) ? payload.requestedDays : null,
  };
}

export const pokemonChampionsBattleDataProvider = Object.freeze({
  source: pokemonChampionsBattleDataSource,

  async loadIndex({ force = false } = {}) {
    return normalizeUsageIndexResponse(await requestJson("/api", force));
  },

  async loadPokemonUsage({ showdownId, season, days, force = false }) {
    if (!showdownId) throw new Error("Falta o identificador da espécie.");

    const query = new URLSearchParams();
    if (typeof season === "string" && season) query.set("season", season);
    if (Number.isInteger(days)) query.set("days", String(Math.max(1, Math.min(31, days))));
    const suffix = query.size ? "?" + query.toString() : "";

    const response = normalizeUsageBattleResponse(
      await requestJson("/api/battle/Doubles/" + encodeURIComponent(showdownId) + suffix, force),
    );

    if (response.format !== "Doubles") {
      throw new Error("A fonte não retornou o formato Doubles.");
    }

    return response;
  },
});
