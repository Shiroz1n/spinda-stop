import test from "node:test";
import assert from "node:assert/strict";
import { searchPokemon } from "../../../packages/domain/src/index.js";
import eligibility from "../../../packages/data/snapshots/champions-eligibility.json" with { type: "json" };
import { getChampionsEligibility, getChampionsEligibleMegaPokemon, getChampionsEligiblePokemon, getChampionsRosterSummary, getOfficialPokemonAliases } from "../src/data/pokemonChampionsRoster.js";

const catalog = [
  { slug: "charizard", name: "Charizard", speciesSlug: "charizard", speciesName: "Charizard", speciesId: 6, formId: "default", isDefault: true },
  { slug: "charizard-mega-y", name: "Mega Charizard Y", speciesSlug: "charizard", speciesName: "Charizard", speciesId: 6, formId: "mega-y" },
  { slug: "basculegion-male", name: "Male Basculegion", speciesSlug: "basculegion", speciesName: "Basculegion", speciesId: 902, formId: "male" },
  { slug: "basculegion-female", name: "Female Basculegion", speciesSlug: "basculegion", speciesName: "Basculegion", speciesId: 902, formId: "female" },
  { slug: "squawkabilly-green-plumage", name: "Green Plumage Squawkabilly", speciesSlug: "squawkabilly", speciesName: "Squawkabilly", speciesId: 931, formId: "green-plumage" },
  { slug: "deoxys", name: "Deoxys", speciesSlug: "deoxys", speciesName: "Deoxys", speciesId: 386, formId: "default", isDefault: true },
  { slug: "meowstic-male-mega", name: "Mega Meowstic", speciesSlug: "meowstic", speciesName: "Meowstic", speciesId: 678, formId: "mega-male" },
  { slug: "meowstic-female-mega", name: "Mega Meowstic", speciesSlug: "meowstic", speciesName: "Meowstic", speciesId: 678, formId: "mega-female" },
];

test("official regulation snapshot distinguishes eligible, ineligible and unresolved forms", () => {
  assert.equal(getChampionsEligibility(catalog[0], "M-C", catalog, eligibility).status, "eligible");
  assert.equal(getChampionsEligibility(catalog[1], "M-C", catalog, eligibility).status, "eligible");
  assert.equal(getChampionsEligibility(catalog[2], "M-C", catalog, eligibility).status, "eligible");
  assert.equal(getChampionsEligibility(catalog[3], "M-C", catalog, eligibility).status, "eligible");
  assert.equal(getChampionsEligibility(catalog[4], "M-C", catalog, eligibility).status, "unknown");
  assert.equal(getChampionsEligibility(catalog[5], "M-C", catalog, eligibility).status, "ineligible");
  assert.equal(getChampionsEligibility(catalog[0], "M-Z", catalog, eligibility).status, "unknown");
});

test("an unqualified official Mega name does not identify one of two gendered forms", () => {
  assert.equal(getChampionsEligibility(catalog[6], "M-C", catalog, eligibility).status, "unknown");
  assert.equal(getChampionsEligibility(catalog[7], "M-C", catalog, eligibility).status, "unknown");
});

test("official roster leaves duplicate generic Squawkabilly labels unresolved", () => {
  const forms = [
    catalog[4],
    { slug: "squawkabilly-blue-plumage", name: "Blue Plumage Squawkabilly", speciesSlug: "squawkabilly", speciesName: "Squawkabilly", speciesId: 931, formId: "blue-plumage" },
  ];
  assert.equal(getChampionsEligibility(forms[0], "M-C", forms, eligibility).status, "unknown");
  assert.equal(getChampionsEligibility(forms[1], "M-C", forms, eligibility).status, "unknown");
  assert.deepEqual(getOfficialPokemonAliases(forms, eligibility).map(({ aliases }) => aliases), [[], []]);
});

test("roster picker and Speed Tiers lists include only forms confirmed for that regulation", () => {
  assert.deepEqual(getChampionsEligiblePokemon(catalog, "M-C", eligibility).map(({ slug }) => slug).sort(), [
    "basculegion-female", "basculegion-male", "charizard", "charizard-mega-y",
  ]);
  assert.deepEqual(getChampionsEligibleMegaPokemon(catalog, "M-C", eligibility).map(({ slug }) => slug), ["charizard-mega-y"]);
  assert.deepEqual(getChampionsEligiblePokemon(catalog, "M-X", eligibility).map(({ slug }) => slug), []);
});

test("official aliases retain source names without collapsing distinct forms", () => {
  const aliasCatalog = [catalog[0], catalog[5]];
  const rows = getOfficialPokemonAliases(aliasCatalog, eligibility);
  assert.ok(rows.find(({ slug }) => slug === "charizard").aliases.includes("Charizard"));
  assert.deepEqual(rows.find(({ slug }) => slug === "deoxys").aliases, []);
});

test("the Pokédex can search a source-confirmed alternate form name", () => {
  const form = { slug: "indeedee-male", name: "Indeedee-F", speciesName: "Indeedee", speciesId: 876, types: ["psychic", "normal"] };
  const snapshot = { regulations: { "M-C": { entries: [{ id: "0876-001", name: "Indeedee Male" }] } } };
  const catalogWithAliases = getOfficialPokemonAliases([form], snapshot);

  assert.deepEqual(searchPokemon(catalogWithAliases, "Indeedee Male").map(({ slug }) => slug), ["indeedee-male"]);
});

test("regulation summary retains source, validity and capture time", () => {
  const summary = getChampionsRosterSummary("M-C", eligibility);
  assert.equal(summary.validFrom, "2026-09-09T02:00:00Z");
  assert.equal(summary.validUntil, "2026-12-02T01:59:00Z");
  assert.equal(summary.rosterCount, 262);
  assert.equal(summary.megaCount, 81);
  assert.equal(summary.rankedSeason.id, "M-8");
  assert.ok(summary.sourceUrl.includes("pokemonchampions.jp"));
  assert.ok(summary.checkedAt);
  assert.equal(summary.rosterComplete, true);
});

test("an incomplete official snapshot never turns a missing row into ineligible", () => {
  const partial = structuredClone(eligibility);
  partial.regulations["M-C"].rowCount += 1;
  assert.equal(getChampionsEligibility(catalog[5], "M-C", catalog, partial).status, "unknown");
  assert.equal(getChampionsEligibility(catalog[0], "M-C", catalog, partial).status, "eligible");
  assert.equal(getChampionsEligibility(catalog[1], "M-C", catalog, partial).status, "unknown");
  assert.equal(getChampionsEligibility(catalog[1], "M-C", catalog, {
    regulations: { "M-C": { ...eligibility.regulations["M-C"], rowCount: 0, allowedMegaNames: [] } },
  }).status, "unknown");
});

test("duplicate or incomplete roster IDs cannot establish eligibility", () => {
  const partial = structuredClone(eligibility);
  partial.regulations["M-C"].entries[1].id = partial.regulations["M-C"].entries[0].id;
  assert.equal(getChampionsEligibility(catalog[0], "M-C", catalog, partial).status, "unknown");
});
