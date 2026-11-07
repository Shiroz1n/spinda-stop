import test from "node:test";
import assert from "node:assert/strict";
import { getChampionsIndexedMegaPokemon, getChampionsIndexedPokemon } from "../src/data/pokemonChampionsRoster.js";

const catalog = [
  { slug: "charizard", name: "Charizard", speciesSlug: "charizard", speciesName: "Charizard", formId: "default", isDefault: true },
  { slug: "charizard-mega-y", name: "Mega Charizard Y", speciesSlug: "charizard", speciesName: "Charizard", formId: "mega-y" },
  { slug: "basculegion-male", name: "Male Basculegion", speciesSlug: "basculegion", speciesName: "Basculegion", formId: "male" },
  { slug: "basculegion-female", name: "Female Basculegion", speciesSlug: "basculegion", speciesName: "Basculegion", formId: "female" },
  { slug: "deoxys", name: "Deoxys", speciesSlug: "deoxys", speciesName: "Deoxys", formId: "default", isDefault: true },
];

test("Champions picker and tiers use only forms represented in the current Doubles index", () => {
  const indexed = getChampionsIndexedPokemon({ pokemon: [
    { name: "Basculegion-F", showdownId: "basculegionf", position: 2 },
    { name: "Charizard", showdownId: "charizard", position: 1 },
    { name: "Unknownmon", showdownId: "unknownmon", position: 3 },
    { name: "Basculegion", showdownId: "basculegion", position: 3 },
    { name: "Unranked form", showdownId: "deoxys", position: null },
  ] }, catalog);

  assert.deepEqual(indexed.map(({ slug }) => slug), ["charizard", "basculegion-female", "basculegion-male"]);
  assert.equal(indexed[2].battleDataPosition, 3);
  assert.ok(!indexed.some(({ name }) => ["Regieleki", "Deoxys"].includes(name)));
});

test("Speed tiers add only published Mega forms whose species appears in the current Champions index", () => {
  const index = { pokemon: [
    { name: "Charizard", showdownId: "charizard", position: 1 },
    { name: "Deoxys", showdownId: "deoxys", position: null },
  ] };
  const megas = getChampionsIndexedMegaPokemon(index, catalog, [
    { id: "charizard", formName: "Charizard-Mega-Y" },
    { id: "charizard", formName: "Charizard-Mega-Y" },
    { id: "deoxys", formName: "Deoxys-Mega" },
    { id: "charizard", formName: "Unknown-Mega" },
  ]);

  assert.deepEqual(megas.map(({ slug, battleDataPosition }) => [slug, battleDataPosition]), [["charizard-mega-y", 1]]);
});
