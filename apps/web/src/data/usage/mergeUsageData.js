function normalizeKey(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
}

function canonicalPokemonKey(entry, resolvePokemon) {
  const local = resolvePokemon?.(entry);
  return local?.slug
    ? `form:${normalizeKey(local.slug)}`
    : `id:${normalizeKey(entry.showdownId || entry.id || entry.name)}`;
}

function mergeFilterValues(left = {}, right = {}) {
  return Object.fromEntries(["moves", "items", "abilities"].map((key) => [
    key,
    [...new Set([...(left[key] || []), ...(right[key] || [])])],
  ]));
}

export function hasPublishedStatPoints(statPoints) {
  return Boolean(statPoints && Object.values(statPoints).some(Number.isFinite));
}

export function selectUsageCapture(metaRows, battleRows, { formats = {}, seasons = {}, preferredSource = "battleData", activeFormat = "doubles", activeSeason = null, periodMode = "current" } = {}) {
  const rows = { metaRoll: metaRows, battleData: battleRows };
  if (periodMode === "history") return Array.isArray(battleRows) ? "battleData" : null;
  const sources = [preferredSource, preferredSource === "metaRoll" ? "battleData" : "metaRoll"];
  const active = normalizeKey(activeFormat);
  const period = normalizeKey(activeSeason);
  return sources.find((source) => {
    const format = normalizeKey(formats[source]);
    const season = normalizeKey(seasons[source]);
    const periodMatches = period ? season === period : source === preferredSource;
    return rows[source]?.length && (!format || format === active) && periodMatches;
  }) || null;
}

function sourceObservation(row, source, context = {}) {
  return {
    source,
    format: context.format || null,
    season: context.season || null,
    capturedAt: context.capturedAt || null,
    sourceFile: context.sourceFile || null,
    rank: Number.isFinite(row.rank) ? row.rank : null,
    percentage: typeof row.percentage === "string" ? row.percentage : null,
    percentageValue: Number.isFinite(row.percentageValue) ? row.percentageValue : null,
    statPoints: row.statPoints ? { ...row.statPoints } : null,
    statUp: typeof row.statUp === "string" ? row.statUp : null,
    statDown: typeof row.statDown === "string" ? row.statDown : null,
  };
}

function distributionKey(row, categoryId, resolvePokemon) {
  if (categoryId === "stat_points") {
    const values = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"].map((key) => row.statPoints?.[key]);
    return values.every(Number.isFinite) ? `spread:${values.join("/")}` : "";
  }
  if (categoryId === "teammate") {
    return canonicalPokemonKey({ id: row.showdownId || row.id, name: row.name }, resolvePokemon);
  }
  return normalizeKey(row.name);
}

function mergeCategoryRows({ battleRows = [], metaRows = [], categoryId, formats = {}, contexts = {}, resolvePokemon, preferredSource = "metaRoll", activeFormat = "doubles" }) {
  const rows = new Map();
  const otherSource = preferredSource === "metaRoll" ? "battleData" : "metaRoll";
  const sources = [
    [preferredSource, preferredSource === "metaRoll" ? metaRows : battleRows],
    [otherSource, otherSource === "metaRoll" ? metaRows : battleRows],
  ];

  for (const [source, entries] of sources) {
    const format = normalizeKey(formats[source]);
    if (format && format !== normalizeKey(activeFormat)) continue;
    entries.forEach((entry, index) => {
      const identity = distributionKey(entry, categoryId, resolvePokemon);
      const key = identity || `${source}:unidentified:${index}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          name: entry.name || "",
          statPoints: entry.statPoints ? { ...entry.statPoints } : null,
          statUp: entry.statUp || null,
          statDown: entry.statDown || null,
          observations: {},
          selectedSource: source,
          selected: sourceObservation(entry, source, contexts[source]),
        };
        rows.set(key, row);
      }
      if (!row.observations[source]) row.observations[source] = sourceObservation(entry, source, contexts[source]);
      if (source === preferredSource) {
        row.selectedSource = source;
        row.selected = sourceObservation(entry, source, contexts[source]);
        row.name ||= entry.name || "";
        row.statPoints ||= entry.statPoints ? { ...entry.statPoints } : null;
        row.statUp ||= entry.statUp || null;
        row.statDown ||= entry.statDown || null;
      }
    });
  }

  return [...rows.values()].sort((left, right) => {
    const leftPriority = left.selectedSource === preferredSource ? 0 : 1;
    const rightPriority = right.selectedSource === preferredSource ? 0 : 1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    if (leftPriority === 1) return left.name.localeCompare(right.name, "pt-BR");
    const leftRank = left.selected?.rank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.selected?.rank ?? Number.POSITIVE_INFINITY;
    return leftRank - rightRank || left.name.localeCompare(right.name, "pt-BR");
  });
}

function selectRankedPartnerRows(rows, preferredSource = "metaRoll") {
  const fallbackSource = preferredSource === "metaRoll" ? "battleData" : "metaRoll";
  const hasPosition = (row, source) => row.name?.trim() && Number.isInteger(row.observations?.[source]?.rank) && row.observations[source].rank > 0;
  const hasRankedRows = (source) => rows.some((row) => hasPosition(row, source));
  const source = hasRankedRows(preferredSource) ? preferredSource : fallbackSource;

  return rows
    .filter((row) => hasPosition(row, source))
    .map((row) => ({ ...row, selectedSource: source, selected: row.observations[source] }))
    .sort((left, right) => left.selected.rank - right.selected.rank)
    .slice(0, 15);
}

export function mergeUsageCatalog(battleIndex, metaRollIndex, resolvePokemon, activeFormat = "doubles") {
  const entries = new Map();
  const add = (entry, source, indexData) => {
    const key = canonicalPokemonKey(entry, resolvePokemon);
    if (key === "id:") return;
    const sourceEntry = source === "battleData"
      ? { id: entry.showdownId, rank: Number.isFinite(entry.position) ? entry.position : null, season: indexData?.season || null, format: indexData?.format || null }
      : { id: entry.id, rank: Number.isFinite(entry.rank) ? entry.rank : null, season: indexData?.season || null, format: indexData?.format || null };
    let merged = entries.get(key);
    if (!merged) {
      const local = resolvePokemon?.(entry);
      merged = {
        key,
        name: entry.name || entry.showdownId || entry.id,
        showdownId: null,
        metaRollId: null,
        position: null,
        metaRollRank: null,
        displayRank: null,
        displaySource: null,
        types: [...(entry.types?.length ? entry.types : local?.types || [])],
        filterValues: { moves: [], items: [], abilities: [] },
        battleData: null,
        metaRoll: null,
      };
      entries.set(key, merged);
    }
    if (source === "battleData") {
      merged.showdownId = entry.showdownId;
      merged.position = sourceEntry.rank;
      merged.battleData = sourceEntry;
      if (merged.displaySource === null) {
        merged.displaySource = source;
        merged.displayRank = sourceEntry.rank;
      }
    } else {
      merged.metaRollId = entry.id;
      merged.metaRollRank = sourceEntry.rank;
      merged.metaRoll = sourceEntry;
      merged.displaySource = source;
      merged.displayRank = sourceEntry.rank;
    }
    if (!merged.types.length && entry.types?.length) merged.types = [...entry.types];
    merged.filterValues = mergeFilterValues(merged.filterValues, entry.filterValues);
  };

  const supportsFormat = (index) => !index?.format || normalizeKey(index.format) === normalizeKey(activeFormat);
  if (supportsFormat(battleIndex)) for (const entry of battleIndex?.pokemon || []) add(entry, "battleData", battleIndex);
  if (supportsFormat(metaRollIndex)) for (const entry of metaRollIndex?.entries || []) add(entry, "metaRoll", metaRollIndex);

  const catalog = [...entries.values()];
  const hasMetaRollCatalog = catalog.some((entry) => entry.metaRoll !== null);
  return catalog.map((entry) => hasMetaRollCatalog && entry.metaRoll === null
    ? { ...entry, displayRank: null }
    : entry);
}

export { mergeCategoryRows, selectRankedPartnerRows };
