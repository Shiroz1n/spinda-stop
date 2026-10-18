const API_BASE_URL = "https://metaroll.app/api/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 16;
const responseCache = new Map();
const inFlightRequests = new Map();

export const metaRollSource = Object.freeze({
  id: "metaroll",
  label: "MetaRoll",
  attribution: "Dados competitivos: MetaRoll",
  url: "https://metaroll.app/",
  guideUrl: "https://metaroll.app/api/v1/docs",
});

function rememberResponse(path, data) {
  responseCache.delete(path);
  responseCache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value);
  }
}

async function requestJson(path, force = false) {
  if (inFlightRequests.has(path)) return inFlightRequests.get(path);
  const cached = responseCache.get(path);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;

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

function normalizeDistribution(value, { spread = false } = {}) {
  if (!Array.isArray(value)) return [];

  return value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)).map((entry, index) => {
    const percent = Number.isFinite(entry?.percent) ? entry.percent : null;
    const statPoints = spread && entry?.statPoints && typeof entry.statPoints === "object"
      ? {
          hp: Number.isFinite(entry.statPoints.hp) ? entry.statPoints.hp : null,
          attack: Number.isFinite(entry.statPoints.atk) ? entry.statPoints.atk : null,
          defense: Number.isFinite(entry.statPoints.def) ? entry.statPoints.def : null,
          spAttack: Number.isFinite(entry.statPoints.spa) ? entry.statPoints.spa : null,
          spDefense: Number.isFinite(entry.statPoints.spd) ? entry.statPoints.spd : null,
          speed: Number.isFinite(entry.statPoints.spe) ? entry.statPoints.spe : null,
      }
      : null;

    return {
      rank: index + 1,
      name: typeof entry?.name === "string" ? entry.name : "",
      percent,
      percentage: percent === null ? null : percent + "%",
      percentageValue: percent,
      statPoints,
    };
  });
}

function normalizeHistoryMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).map(([name, percent], index) => {
    const number = Number.isFinite(percent) ? percent : null;
    return {
      rank: index + 1,
      name,
      percent: number,
      percentage: number === null ? null : number + "%",
      percentageValue: number,
    };
  });
}

function normalizeMatchupNames(names, games) {
  if (!Array.isArray(names)) return [];
  return names.filter((name) => typeof name === "string").map((name, index) => ({
    name,
    games: Array.isArray(games) && Number.isFinite(games[index]) ? games[index] : null,
  }));
}

function normalizeMatchupMoves(moves) {
  if (!Array.isArray(moves)) return [];
  return moves.filter((move) => move && typeof move.name === "string").map((move) => ({
    name: move.name,
    percent: Number.isFinite(move.percent) ? move.percent : null,
    percentageValue: Number.isFinite(move.percent) ? move.percent : null,
  }));
}

function normalizeMatchups(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    beats: normalizeMatchupNames(value.beats, value.beatsGames),
    losesTo: normalizeMatchupNames(value.losesTo, value.losesToGames),
    beatsWith: normalizeMatchupMoves(value.beatsWith),
    beatenBy: normalizeMatchupMoves(value.beatenBy),
  };
}

function normalizeSpeciesEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const distributions = {
    abilities: normalizeDistribution(entry.abilities),
    items: normalizeDistribution(entry.items),
    moves: normalizeDistribution(entry.moves),
    natures: normalizeDistribution(entry.natures),
    teammates: normalizeDistribution(entry.teammates),
    spreads: normalizeDistribution(entry.spreads, { spread: true }),
  };
  const filterValues = {
    abilities: distributions.abilities.map((row) => row.name).filter(Boolean),
    items: distributions.items.map((row) => row.name).filter(Boolean),
    moves: distributions.moves.map((row) => row.name).filter(Boolean),
  };

  return {
    id: typeof entry.id === "string" ? entry.id : "",
    name: typeof entry.name === "string" ? entry.name : "",
    rank: Number.isFinite(entry.rank) ? entry.rank : null,
    previousRank: Number.isFinite(entry.previousRank) ? entry.previousRank : null,
    hasPreviousRank: Object.hasOwn(entry, "previousRank"),
    rankHistory: Array.isArray(entry.rankHistory)
      ? entry.rankHistory.filter((item) => item && typeof item.d === "string")
        .map((item) => ({ date: item.d, rank: Number.isFinite(item.r) ? item.r : null }))
      : [],
    usageHistory: Array.isArray(entry.usageHistory)
      ? entry.usageHistory.filter((item) => item && typeof item.d === "string")
        .map((item) => ({
          date: item.d,
          moves: normalizeHistoryMap(item.m),
          items: normalizeHistoryMap(item.i),
          abilities: normalizeHistoryMap(item.a),
        }))
      : [],
    distributions,
    filterValues,
    matchups: normalizeMatchups(entry.matchups),
    confidence: entry.confidence && typeof entry.confidence === "object" ? {
      formGuessed: typeof entry.confidence.formGuessed === "boolean" ? entry.confidence.formGuessed : null,
      identifiedByElimination: typeof entry.confidence.identifiedByElimination === "boolean"
        ? entry.confidence.identifiedByElimination
        : null,
    } : null,
  };
}

function normalizeLadderPerson(entry) {
  if (!entry || typeof entry !== "object") return null;
  const normalizeLocale = (value) => value && typeof value === "object" ? {
    code: Number.isFinite(value.code) ? value.code : null,
    name: typeof value.name === "string" ? value.name : null,
    flag: typeof value.flag === "string" ? value.flag : null,
    iso: typeof value.iso === "string" ? value.iso : null,
  } : null;
  const numeric = (key) => Number.isFinite(entry[key]) ? entry[key] : null;

  return {
    id: typeof entry.id === "string" ? entry.id : "",
    name: typeof entry.name === "string" ? entry.name : "",
    rank: numeric("rank"),
    ...(Object.hasOwn(entry, "previousRank") ? { previousRank: numeric("previousRank") } : {}),
    rating: numeric("rating"),
    wins: numeric("wins"),
    losses: numeric("losses"),
    draws: numeric("draws"),
    battles: numeric("battles"),
    winRate: numeric("winRate"),
    country: normalizeLocale(entry.country),
    language: normalizeLocale(entry.language),
    avatar: numeric("avatar"),
  };
}

export function normalizeMetaRollLadderResponse(payload) {
  if (!payload || !Array.isArray(payload.entries)) {
    throw new Error("A resposta MetaRoll não contém a ladder de jogadores.");
  }
  if (payload.format !== "doubles" || payload.ranks !== "trainers") {
    throw new Error("A fonte não retornou a ladder de treinadores de Doubles.");
  }

  return {
    format: payload.format,
    ranks: payload.ranks,
    season: typeof payload.season === "string" ? payload.season : null,
    capturedAt: typeof payload.capturedAt === "string" ? payload.capturedAt : null,
    comparedTo: typeof payload.comparedTo === "string" ? payload.comparedTo : null,
    count: Number.isFinite(payload.count) ? payload.count : null,
    entries: payload.entries.map(normalizeLadderPerson).filter((entry) => entry && entry.id),
  };
}

function asEntries(payload) {
  const entries = Array.isArray(payload?.entries)
    ? payload.entries
    : Array.isArray(payload?.pokemon)
      ? payload.pokemon
      : null;
  if (!entries) throw new Error("A resposta MetaRoll não contém uma lista de espécies.");
  return entries.map((entry) => normalizeSpeciesEntry(
    entry?.entry && typeof entry.entry === "object" ? { ...entry, ...entry.entry } : entry,
  )).filter((entry) => entry && entry.id);
}

export function normalizeMetaRollIndexResponse(payload) {
  const entries = asEntries(payload);
  const attribution = payload.attribution && typeof payload.attribution === "object"
    ? payload.attribution
    : null;

  return {
    version: Number.isFinite(payload.version) ? payload.version : null,
    game: typeof payload.game === "string" ? payload.game : null,
    source: typeof payload.source === "string" ? payload.source : null,
    format: typeof payload.format === "string" ? payload.format : null,
    season: typeof payload.season === "string" ? payload.season : null,
    capturedAt: typeof payload.capturedAt === "string" ? payload.capturedAt : null,
    comparedTo: typeof payload.comparedTo === "string" ? payload.comparedTo : null,
    count: Number.isFinite(payload.count) ? payload.count : entries.length,
    pastSeasons: Array.isArray(payload.pastSeasons)
      ? payload.pastSeasons.filter((season) => typeof season === "string")
      : [],
    attribution: attribution ? {
      required: attribution.required === true,
      name: typeof attribution.name === "string" ? attribution.name : metaRollSource.label,
      url: typeof attribution.url === "string" ? attribution.url : metaRollSource.url,
      text: typeof attribution.text === "string" ? attribution.text : null,
      terms: typeof attribution.terms === "string" ? attribution.terms : null,
    } : null,
    entries,
  };
}

export function normalizeMetaRollPokemonResponse(payload) {
  if (!payload || !payload.entry || typeof payload.entry !== "object") {
    throw new Error("A resposta MetaRoll não contém a ficha da espécie.");
  }
  const header = normalizeMetaRollIndexResponse({
    ...payload,
    entries: [payload.entry],
  });
  if (!header.entries[0]) throw new Error("A resposta MetaRoll não contém o identificador da espécie.");
  return { ...header, entry: header.entries[0] };
}

function apiPath(season, filename) {
  const prefix = season ? "/seasons/" + encodeURIComponent(season) + "/" : "/";
  return prefix + filename;
}

export const metaRollProvider = Object.freeze({
  source: metaRollSource,

  async loadIndex({ season, force = false } = {}) {
    const path = apiPath(season, "all.json");
    const result = normalizeMetaRollIndexResponse(await requestJson(path, force));
    if (result.format !== "doubles") {
      throw new Error("A fonte não retornou o arquivo de Doubles.");
    }
    return result;
  },

  async loadPokemonUsage({ id, season, force = false }) {
    if (!id) throw new Error("Falta o identificador da espécie.");
    const path = apiPath(season, "pokemon/" + encodeURIComponent(id) + ".json");
    const result = normalizeMetaRollPokemonResponse(await requestJson(path, force));
    if (result.format !== "doubles") {
      throw new Error("A fonte não retornou o ladder Doubles.");
    }
    if (result.entry.id !== id) {
      throw new Error("A fonte retornou uma ficha diferente da espécie solicitada.");
    }
    return result;
  },

  async loadLadder({ season, force = false } = {}) {
    const path = apiPath(season, "ladder.json");
    return normalizeMetaRollLadderResponse(await requestJson(path, force));
  },
});
