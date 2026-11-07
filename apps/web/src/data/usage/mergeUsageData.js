function normalizeKey(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
}

function formatKey(value) {
  return normalizeKey(value);
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

function sourceObservation(row) {
  return {
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

function mergeCategoryRows({ battleRows = [], metaRows = [], categoryId, formats = {}, resolvePokemon }) {
  const battleFormat = formatKey(formats.battleData);
  const metaFormat = formatKey(formats.metaRoll);
  const compatibleFormat = Boolean(battleFormat && metaFormat && battleFormat === metaFormat);
  const rows = new Map();

  for (const [source, entries] of [["battleData", battleRows], ["metaRoll", metaRows]]) {
    entries.forEach((entry, index) => {
      const identity = distributionKey(entry, categoryId, resolvePokemon);
      const key = compatibleFormat && identity ? identity : `${source}:${identity || `unidentified:${index}`}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          name: entry.name || "",
          statPoints: entry.statPoints ? { ...entry.statPoints } : null,
          statUp: entry.statUp || null,
          statDown: entry.statDown || null,
          observations: {},
        };
        rows.set(key, row);
      }
      if (!row.observations[source]) row.observations[source] = sourceObservation(entry);
    });
  }

  return [...rows.values()].sort((left, right) => {
    const leftRank = left.observations.battleData?.rank ?? left.observations.metaRoll?.rank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.observations.battleData?.rank ?? right.observations.metaRoll?.rank ?? Number.POSITIVE_INFINITY;
    return leftRank - rightRank || left.name.localeCompare(right.name, "pt-BR");
  });
}

export function mergeUsageCatalog(battleIndex, metaRollIndex, resolvePokemon) {
  const entries = new Map();
  const add = (entry, source, indexData) => {
    const key = canonicalPokemonKey(entry, resolvePokemon);
    if (key === "id:") return;
    const sourceEntry = source === "battleData"
      ? {
          id: entry.showdownId,
          rank: Number.isFinite(entry.position) ? entry.position : null,
          format: indexData?.format || "Doubles",
          season: indexData?.season || null,
          capturedAt: indexData?.generatedAt || null,
          appFetchedAt: indexData?.appFetchedAt || null,
        }
      : {
          id: entry.id,
          rank: Number.isFinite(entry.rank) ? entry.rank : null,
          format: indexData?.format || null,
          season: indexData?.season || null,
          capturedAt: indexData?.capturedAt || null,
          appFetchedAt: indexData?.appFetchedAt || null,
        };
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
    } else {
      merged.metaRollId = entry.id;
      merged.metaRollRank = sourceEntry.rank;
      merged.metaRoll = sourceEntry;
    }
    if (!merged.types.length && entry.types?.length) merged.types = [...entry.types];
    merged.filterValues = mergeFilterValues(merged.filterValues, entry.filterValues);
  };

  for (const entry of battleIndex?.pokemon || []) add(entry, "battleData", battleIndex);
  for (const entry of metaRollIndex?.entries || []) add(entry, "metaRoll", metaRollIndex);

  return [...entries.values()];
}

export { mergeCategoryRows };
