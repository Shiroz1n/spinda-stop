import test from "node:test";
import assert from "node:assert/strict";
import { findUsagePokemonByReference, findUsagePokemonForCatalogEntry } from "../src/data/usage/pokemonQuery.js";

test("resolves an exact species or form name without a partial-form collision", () => {
  const entries = [
    { id: "tauros-paldea-aqua", name: "Tauros-Paldea-Aqua" },
    { id: "tauros-paldea-blaze", name: "Tauros-Paldea-Blaze" },
  ];

  assert.equal(findUsagePokemonByReference(entries, "TAUROS-PALDEA-AQUA"), entries[0]);
  assert.equal(findUsagePokemonByReference(entries, "Tauros-Paldea"), null);
});

test("normalizes accents and whitespace when resolving a team member", () => {
  const entry = { showdownId: "flabebe", name: "Flabébé" };
  assert.equal(findUsagePokemonByReference([entry], "  FLABEBE "), entry);
});

test("matches punctuation variants through provider IDs without matching a different form", () => {
  const farfetchd = { id: "farfetchd", name: "Farfetch'd" };
  const vivillon = { id: "vivillon", name: "Vivillon" };

  assert.equal(findUsagePokemonByReference([farfetchd], "Farfetch’d"), farfetchd);
  assert.equal(findUsagePokemonByReference([vivillon], "Vivillon-Fancy"), null);
  assert.equal(findUsagePokemonByReference([{}], "!!!"), null);
});

test("returns no selection when the source has no matching entry", () => {
  assert.equal(findUsagePokemonByReference([], "Garchomp"), null);
  assert.equal(findUsagePokemonByReference([{ id: "garchomp" }], ""), null);
});

test("resolves feminine local catalog forms to Showdown gender IDs", () => {
  const female = { showdownId: "basculegionf", name: "Basculegion-F" };
  const male = { showdownId: "basculegion", name: "Basculegion" };
  const catalogPokemon = { formId: "female", speciesName: "Basculegion", slug: "basculegion-female", name: "Female Basculegion" };

  assert.equal(findUsagePokemonForCatalogEntry([male, female], catalogPokemon), female);
  assert.equal(findUsagePokemonForCatalogEntry([male, female], { ...catalogPokemon, formId: "male", name: "Male Basculegion" }), male);
});
