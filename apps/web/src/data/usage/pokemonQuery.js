function normalizeReference(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
    : "";
}

export function findUsagePokemonByReference(entries, reference) {
  const target = normalizeReference(reference);
  if (!target || !Array.isArray(entries)) return null;

  return entries.find((entry) => [entry.name, entry.id, entry.showdownId, entry.showdownName]
    .some((candidate) => normalizeReference(candidate) === target)) || null;
}
