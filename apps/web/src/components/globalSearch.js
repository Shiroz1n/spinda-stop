export function normalizeGlobalSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function createGlobalSearchEntries({ pokemon, types, moves, details }) {
  const entries = [];
  for (const entry of pokemon) {
    entries.push({
      kind: "Pokémon",
      name: entry.name,
      detail: `#${String(entry.speciesId).padStart(4, "0")} · ${entry.formId === "default" ? "forma base" : entry.formName || entry.formId}`,
      search: `${entry.name} ${entry.speciesName} ${entry.formName} ${entry.slug} ${entry.speciesId}`,
      href: `/dex/${encodeURIComponent(entry.slug)}`,
    });
  }
  for (const type of types) {
    entries.push({ kind: "Tipo", name: type.label, detail: "Filtrar a Pokédex", search: `${type.value} ${type.label}`, href: `/dex?type=${encodeURIComponent(type.value)}` });
  }
  for (const move of moves) {
    entries.push({ kind: "Golpe", name: move.name, detail: "Catálogo geral · abrir calculadora", search: `${move.name} ${move.slug}`, href: `/calculator?move=${encodeURIComponent(move.name)}` });
  }
  const abilities = new Map();
  for (const entry of pokemon) {
    for (const ability of details.pokemonBySlug[entry.slug]?.abilities || []) {
      const key = normalizeGlobalSearch(ability.name);
      if (!key || abilities.has(key)) continue;
      abilities.set(key, {
        kind: "Habilidade",
        name: ability.name,
        detail: `PokéAPI · exemplo em ${entry.name}`,
        search: ability.name,
        href: `/dex?ability=${encodeURIComponent(ability.name)}`,
      });
    }
  }
  entries.push(...abilities.values());
  return entries.map((entry) => ({ ...entry, normalized: normalizeGlobalSearch(entry.search) }));
}

export function searchGlobalEntries(entries, query, limit = 12) {
  const normalized = normalizeGlobalSearch(query);
  if (!normalized) return [];
  return entries.filter((entry) => entry.normalized.includes(normalized)).slice(0, limit);
}

export function nextGlobalSearchIndex(index, key, count) {
  if (!count || (key !== "ArrowDown" && key !== "ArrowUp")) return index;
  const direction = key === "ArrowDown" ? 1 : -1;
  const current = index < 0 ? (direction > 0 ? -1 : 0) : index;
  return (current + direction + count) % count;
}
