const STORAGE_KEY = "spinda-research-shortcuts";
const LIMIT = 12;

export function emptyResearchShortcuts() {
  return { favoritePokemon: [], recentPokemon: [], favoriteComparisons: [], recentComparisons: [] };
}

export function readResearchShortcuts(storage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return emptyResearchShortcuts();
    return {
      favoritePokemon: Array.isArray(value.favoritePokemon) ? value.favoritePokemon.filter((slug) => typeof slug === "string").slice(0, LIMIT) : [],
      recentPokemon: Array.isArray(value.recentPokemon) ? value.recentPokemon.filter((slug) => typeof slug === "string").slice(0, LIMIT) : [],
      favoriteComparisons: Array.isArray(value.favoriteComparisons) ? value.favoriteComparisons.filter(validComparison).slice(0, LIMIT) : [],
      recentComparisons: Array.isArray(value.recentComparisons) ? value.recentComparisons.filter(validComparison).slice(0, LIMIT) : [],
    };
  } catch {
    return emptyResearchShortcuts();
  }
}

export function readStoredResearchShortcuts() {
  try { return readResearchShortcuts(window.localStorage); } catch { return emptyResearchShortcuts(); }
}

export function writeResearchShortcuts(storage, value) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Keep the shortcuts available for this session. */ }
}

export function writeStoredResearchShortcuts(value) {
  try { writeResearchShortcuts(window.localStorage, value); } catch { /* Storage can be disabled by the browser. */ }
}

export function rememberPokemon(shortcuts, slug) {
  if (!slug) return shortcuts;
  const recentPokemon = [slug, ...shortcuts.recentPokemon.filter((entry) => entry !== slug)].slice(0, LIMIT);
  return recentPokemon.every((entry, index) => entry === shortcuts.recentPokemon[index])
    && recentPokemon.length === shortcuts.recentPokemon.length ? shortcuts : { ...shortcuts, recentPokemon };
}

export function toggleFavoritePokemon(shortcuts, slug) {
  const favoritePokemon = shortcuts.favoritePokemon.includes(slug)
    ? shortcuts.favoritePokemon.filter((entry) => entry !== slug)
    : [slug, ...shortcuts.favoritePokemon].slice(0, LIMIT);
  return { ...shortcuts, favoritePokemon };
}

function validComparison(value) {
  return Boolean(value && typeof value === "object" && typeof value.key === "string"
    && typeof value.title === "string" && typeof value.url === "string" && value.url.startsWith("/speed-tiers?"));
}

export function rememberComparison(shortcuts, comparison) {
  if (!validComparison(comparison)) return shortcuts;
  if (shortcuts.recentComparisons[0]?.key === comparison.key) return shortcuts;
  return { ...shortcuts, recentComparisons: [comparison, ...shortcuts.recentComparisons.filter((entry) => entry.key !== comparison.key)].slice(0, LIMIT) };
}

export function toggleFavoriteComparison(shortcuts, comparison) {
  if (!validComparison(comparison)) return shortcuts;
  const favoriteComparisons = shortcuts.favoriteComparisons.some((entry) => entry.key === comparison.key)
    ? shortcuts.favoriteComparisons.filter((entry) => entry.key !== comparison.key)
    : [comparison, ...shortcuts.favoriteComparisons].slice(0, LIMIT);
  return { ...shortcuts, favoriteComparisons };
}

export function clearRecentResearch(shortcuts, kind) {
  return kind === "pokemon" ? { ...shortcuts, recentPokemon: [] } : { ...shortcuts, recentComparisons: [] };
}
