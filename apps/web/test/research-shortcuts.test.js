import test from "node:test";
import assert from "node:assert/strict";
import { clearRecentResearch, emptyResearchShortcuts, readResearchShortcuts, rememberComparison, rememberPokemon, toggleFavoriteComparison, toggleFavoritePokemon, writeResearchShortcuts } from "../src/data/researchShortcuts.js";

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("local shortcuts persist favorites and recent entries, with a removable recent list", () => {
  const local = storage();
  let shortcuts = rememberPokemon(emptyResearchShortcuts(), "indeedee-female");
  shortcuts = toggleFavoritePokemon(shortcuts, "indeedee-female");
  writeResearchShortcuts(local, shortcuts);
  assert.deepEqual(readResearchShortcuts(local), shortcuts);
  assert.deepEqual(clearRecentResearch(shortcuts, "pokemon").recentPokemon, []);
  assert.deepEqual(toggleFavoritePokemon(shortcuts, "indeedee-female").favoritePokemon, []);
});

test("speed comparisons are deduplicated and favorites can be removed", () => {
  const comparison = { key: "M-C|champions|garchomp", title: "Garchomp · M-C", url: "/speed-tiers?model=champions&regulation=M-C&target=garchomp" };
  let shortcuts = rememberComparison(emptyResearchShortcuts(), comparison);
  shortcuts = rememberComparison(shortcuts, comparison);
  assert.equal(shortcuts.recentComparisons.length, 1);
  shortcuts = toggleFavoriteComparison(shortcuts, comparison);
  assert.equal(shortcuts.favoriteComparisons[0].key, comparison.key);
  assert.equal(toggleFavoriteComparison(shortcuts, comparison).favoriteComparisons.length, 0);
});

test("disabled storage and malformed shortcuts fall back without breaking the page", () => {
  const disabled = { getItem() { throw new Error("disabled"); }, setItem() { throw new Error("disabled"); } };
  assert.deepEqual(readResearchShortcuts(disabled), emptyResearchShortcuts());
  writeResearchShortcuts(disabled, emptyResearchShortcuts());
  const malformed = storage();
  malformed.setItem("spinda-research-shortcuts", JSON.stringify({ favoritePokemon: [4, "raichu"], recentComparisons: [{ url: "https://example.com" }] }));
  assert.deepEqual(readResearchShortcuts(malformed).favoritePokemon, ["raichu"]);
  assert.deepEqual(readResearchShortcuts(malformed).recentComparisons, []);
});
