import test from "node:test";
import assert from "node:assert/strict";
import { findUsagePokemonByReference } from "../src/data/usage/pokemonQuery.js";

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

test("returns no selection when the source has no matching entry", () => {
  assert.equal(findUsagePokemonByReference([], "Garchomp"), null);
  assert.equal(findUsagePokemonByReference([{ id: "garchomp" }], ""), null);
});
