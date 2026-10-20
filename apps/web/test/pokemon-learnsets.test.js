import test from "node:test";
import assert from "node:assert/strict";
import { filterPokemonLearnsets, formatMoveLearnMethod, formatVersionGroup, getEvolutionNeighbors } from "../src/data/pokemonLearnsets.js";

const moves = [
  { id: 1, name: "Thunderbolt", type: "electric", category: "special" },
  { id: 2, name: "Thunder Wave", type: "electric", category: "status" },
  { id: 3, name: "Surf", type: "water", category: "special" },
];
const learnsets = [
  [1, 25, 4, 0, 1, 0],
  [2, 25, 1, 18, 2, 0],
  [3, 26, 1, 12, 1, 1],
];

test("filters form learnsets by game version, method, move type and category", () => {
  assert.deepEqual(filterPokemonLearnsets(learnsets, moves, { versionGroupId: 25 }).map(({ move }) => move.name), ["Thunder Wave", "Thunderbolt"]);
  assert.deepEqual(filterPokemonLearnsets(learnsets, moves, { versionGroupId: 25, methodId: 4 }).map(({ move }) => move.name), ["Thunderbolt"]);
  assert.deepEqual(filterPokemonLearnsets(learnsets, moves, { versionGroupId: 25, type: "electric", category: "status" }).map(({ move }) => move.name), ["Thunder Wave"]);
  assert.equal(filterPokemonLearnsets(learnsets, moves, { versionGroupId: 26 })[0].mastery, true);
  assert.deepEqual(filterPokemonLearnsets(learnsets, moves, { versionGroupId: 99 }), []);
});

test("uses readable game and method labels while keeping unknown source terms intact", () => {
  assert.equal(formatVersionGroup("legends-za"), "Legends: Z-A");
  assert.equal(formatVersionGroup("new-version-group"), "New Version Group");
  assert.equal(formatMoveLearnMethod("level-up"), "Nível");
});

test("resolves direct evolutionary neighbors by species rather than duplicating forms", () => {
  const pokemon = [
    { slug: "pichu", speciesId: 172, isDefault: true, evolvesFromSpeciesId: null },
    { slug: "pikachu", speciesId: 25, isDefault: true, evolvesFromSpeciesId: 172 },
    { slug: "raichu", speciesId: 26, isDefault: true, evolvesFromSpeciesId: 25 },
    { slug: "raichu-alola", speciesId: 26, isDefault: false, evolvesFromSpeciesId: 25 },
    { slug: "mimikyu", speciesId: 778, isDefault: true, evolvesFromSpeciesId: null },
  ];
  const neighbors = getEvolutionNeighbors(pokemon, 25);
  assert.equal(neighbors.previous.slug, "pichu");
  assert.equal(neighbors.current.slug, "pikachu");
  assert.deepEqual(neighbors.next.map(({ slug }) => slug), ["raichu"]);
  assert.deepEqual(getEvolutionNeighbors(pokemon, 999), { previous: null, current: null, next: [] });
});
