function normalizeReference(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
    : "";
}

function normalizePokemonId(value) {
  return normalizeReference(value).replace(/[^a-z0-9]/g, "");
}

export function findUsagePokemonByReference(entries, reference) {
  const target = normalizeReference(reference);
  if (!target || !Array.isArray(entries)) return null;
  const targetId = normalizePokemonId(reference);

  return entries.find((entry) => {
    const candidates = [entry.name, entry.id, entry.showdownId, entry.showdownName];
    return candidates.some((candidate) => normalizeReference(candidate) === target)
      || (targetId && [entry.id, entry.showdownId].some((candidate) => normalizePokemonId(candidate) === targetId));
  }) || null;
}

export function findUsagePokemonForCatalogEntry(entries, pokemon) {
  if (!pokemon) return null;
  const species = pokemon.speciesName || pokemon.speciesSlug || "";
  const references = [pokemon.showdownId, pokemon.name, pokemon.slug];
  if (pokemon.formId === "male") references.push(species, `${species}-M`);
  if (pokemon.formId === "female") references.push(`${species}-F`, `${species}f`);
  return references.map((reference) => findUsagePokemonByReference(entries, reference)).find(Boolean) || null;
}
