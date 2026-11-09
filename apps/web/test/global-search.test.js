import test from "node:test";
import assert from "node:assert/strict";
import { createGlobalSearchEntries, nextGlobalSearchIndex, searchGlobalEntries } from "../src/components/globalSearch.js";

const entries = createGlobalSearchEntries({
  pokemon: [
    { slug: "raichu", name: "Raichu", speciesName: "Raichu", speciesId: 26, formId: "default" },
    { slug: "raichu-alola", name: "Raichu de Alola", speciesName: "Raichu", formName: "de Alola", speciesId: 26, formId: "alola" },
  ],
  types: [{ value: "electric", label: "Elétrico" }],
  moves: [{ slug: "thunderbolt", name: "Thunderbolt" }],
  details: { pokemonBySlug: { raichu: { abilities: [{ name: "Static" }] }, "raichu-alola": { abilities: [{ name: "Surge Surfer" }] } } },
});

test("global search normalizes accents and preserves distinct forms", () => {
  const raichu = searchGlobalEntries(entries, "RAICHU");
  assert.deepEqual(raichu.filter((entry) => entry.kind === "Pokémon").map((entry) => entry.href), ["/dex/raichu", "/dex/raichu-alola"]);
  assert.equal(searchGlobalEntries(entries, "eletrico")[0].href, "/dex?type=electric");
});

test("global search routes move and ability results to their supported screens", () => {
  assert.equal(searchGlobalEntries(entries, "thunderbolt")[0].href, "/calculator?move=Thunderbolt");
  assert.equal(searchGlobalEntries(entries, "static")[0].href, "/dex?ability=Static");
});

test("global search keyboard navigation wraps and ignores unrelated keys", () => {
  assert.equal(nextGlobalSearchIndex(0, "ArrowDown", 2), 1);
  assert.equal(nextGlobalSearchIndex(1, "ArrowDown", 2), 0);
  assert.equal(nextGlobalSearchIndex(0, "ArrowUp", 2), 1);
  assert.equal(nextGlobalSearchIndex(1, "Enter", 2), 1);
});
