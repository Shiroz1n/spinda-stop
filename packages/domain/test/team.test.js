import test from "node:test";
import assert from "node:assert/strict";
import {
  addPokemonToDraft,
  createEmptyTeam,
  createTeamMember,
  formatNationalNumber,
  parseTeam,
  searchPokemon,
  sortPokemon,
  setTeamMember,
  serializeTeam,
} from "../src/index.js";

const catalog = [{
  slug: "pikachu",
  speciesId: 25,
  speciesSlug: "pikachu",
  formId: "default",
  name: "Pikachu",
  speciesName: "Pikachu",
  formName: "",
  types: ["electric"],
  generation: 1,
  abilities: [{ name: "Static" }],
}];

test("creates six empty slots and a team member with a separate form ID", () => {
  const team = createEmptyTeam();
  const member = createTeamMember(catalog[0]);
  assert.equal(team.members.length, 6);
  assert.equal(team.members[0], null);
  assert.equal(member.speciesId, 25);
  assert.equal(member.formId, "default");
  assert.equal(member.pokemonId, "pikachu");
  assert.equal(member.moves.length, 4);
});

test("keeps an existing set when the same Pokémon is opened from the Pokédex", () => {
  const team = createEmptyTeam();
  const savedMember = {
    ...createTeamMember(catalog[0]),
    ability: "Lightning Rod",
    item: "Sitrus Berry",
    nature: "Calm",
    moves: ["Protect", "Thunderbolt", "", ""],
    statPoints: { hp: 12, atk: 0, def: 8, spa: 18, spd: 20, spe: 8 },
  };
  team.members[2] = savedMember;

  const result = addPokemonToDraft(team, catalog[0]);

  assert.equal(result.status, "existing");
  assert.equal(result.selectedSlot, 2);
  assert.equal(result.team, team);
  assert.equal(result.team.members[2], savedMember);
  assert.equal(result.team.members[2].item, "Sitrus Berry");
  assert.deepEqual(result.team.members[2].moves, ["Protect", "Thunderbolt", "", ""]);
});

test("keeps a configured set when the same species is selected in its slot", () => {
  const team = createEmptyTeam();
  team.members[0] = {
    ...createTeamMember(catalog[0]),
    ability: "Lightning Rod",
    item: "Sitrus Berry",
    nature: "Calm",
    moves: ["Protect", "Thunderbolt", "", ""],
    statPoints: { hp: 12, atk: 0, def: 8, spa: 18, spd: 20, spe: 8 },
  };
  const before = team.members[0];

  const result = setTeamMember(team, 0, catalog[0]);

  assert.equal(result, team);
  assert.equal(result.members[0], before);
  assert.equal(result.members[0].item, "Sitrus Berry");
  assert.deepEqual(result.members[0].moves, ["Protect", "Thunderbolt", "", ""]);
  assert.deepEqual(result.members[0].statPoints, before.statPoints);
});

test("replacing a slot starts a fresh set and preserves the other slots", () => {
  const team = createEmptyTeam();
  team.members[0] = { ...createTeamMember(catalog[0]), item: "Sitrus Berry", moves: ["Protect", "", "", ""] };
  team.members[1] = createTeamMember(catalog[0]);
  const otherSlot = team.members[1];
  const nextPokemon = { ...catalog[0], slug: "raichu", name: "Raichu", speciesId: 26 };

  const result = setTeamMember(team, 0, nextPokemon);

  assert.equal(result.members[0].pokemonId, "raichu");
  assert.equal(result.members[0].item, "");
  assert.deepEqual(result.members[0].moves, ["", "", "", ""]);
  assert.equal(result.members[1], otherSlot);
});

test("does not replace a team member when every slot is occupied", () => {
  const team = createEmptyTeam();
  team.members = Array.from({ length: 6 }, (_, index) => ({ pokemonId: `member-${index}` }));
  const before = structuredClone(team);

  const result = addPokemonToDraft(team, catalog[0]);

  assert.equal(result.status, "full");
  assert.equal(result.team, team);
  assert.deepEqual(result.team, before);
});

test("exports and imports a valid draft without inventing legality", () => {
  const team = createEmptyTeam();
  team.name = "Elétricos";
  team.members[0] = createTeamMember(catalog[0]);
  const result = parseTeam(serializeTeam(team), catalog);
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Elétricos");
  assert.equal(result.value.members[0].pokemonId, "pikachu");
});

test("checks form identity and drops unknown fields from imported members", () => {
  const team = createEmptyTeam();
  team.members[0] = { ...createTeamMember(catalog[0]), injected: "ignored" };
  const parsed = parseTeam(JSON.stringify(team), catalog);
  assert.equal(parsed.ok, true);
  assert.equal(Object.hasOwn(parsed.value.members[0], "injected"), false);

  team.members[0].formSlug = "raichu-alola";
  assert.match(parseTeam(JSON.stringify(team), catalog).error, /não corresponde/);
});

test("returns useful errors for malformed, oversized, unknown, and wrong-version files", () => {
  assert.match(parseTeam("{").error, /JSON válido/);
  assert.match(parseTeam("x".repeat(128 * 1024 + 1)).error, /128 KB/);

  const team = createEmptyTeam();
  team.schemaVersion = 9;
  assert.match(parseTeam(JSON.stringify(team), catalog).error, /versão/);

  team.schemaVersion = 1;
  team.format = "singles";
  assert.match(parseTeam(JSON.stringify(team), catalog).error, /rascunho de Doubles/);
  team.format = "doubles";
  team.members[0] = { ...createTeamMember(catalog[0]), pokemonId: "missing" };
  assert.match(parseTeam(JSON.stringify(team), catalog).error, /não encontrado/);
});

test("searches by accents, slug, type, and generation with no filters by default", () => {
  const entries = [
    { ...catalog[0], name: "Nidorán", speciesName: "Nidorán" },
    { ...catalog[0], slug: "raichu-alola", name: "Raichu de Alola", speciesName: "Raichu", formName: "Alola", types: ["electric", "psychic"], generation: 7 },
  ];
  assert.equal(searchPokemon(entries).length, 2);
  assert.equal(searchPokemon(entries, "raichu", { type: "electric", generation: 7 }).length, 1);
  assert.equal(searchPokemon(entries, "nidoran").length, 1);
  assert.equal(formatNationalNumber(25), "#0025");
});

test("filters by exact base-stat total and sorts deterministically without ranking language", () => {
  const entries = [
    { ...catalog[0], slug: "middle", speciesId: 4, name: "Middle", stats: { hp: 50, atk: 50 }, baseStatTotal: 100 },
    { ...catalog[0], slug: "strong", speciesId: 9, name: "Strong", stats: { hp: 90, atk: 90 }, baseStatTotal: 180 },
    { ...catalog[0], slug: "small", speciesId: 1, name: "Small", stats: { hp: 25, atk: 25 }, baseStatTotal: 50 },
  ];

  assert.deepEqual(searchPokemon(entries, "", { minimumBaseStatTotal: 100, maximumBaseStatTotal: 180 }).map(({ slug }) => slug), ["middle", "strong"]);
  assert.deepEqual(sortPokemon(entries, "total-desc").map(({ slug }) => slug), ["strong", "middle", "small"]);
  assert.deepEqual(sortPokemon(entries, "name").map(({ slug }) => slug), ["middle", "small", "strong"]);
  const incomplete = { ...catalog[0], slug: "incomplete", speciesId: 10, stats: { hp: 30 } };
  assert.deepEqual(searchPokemon([...entries, incomplete], "", { minimumBaseStatTotal: 75 }).map(({ slug }) => slug), ["middle", "strong"]);
});

test("preserves PokéAPI order when sorting variants by national number", () => {
  const entries = [
    { ...catalog[0], slug: "form-later", speciesId: 25, spriteId: 20, order: 20 },
    { ...catalog[0], slug: "form-first", speciesId: 25, spriteId: 30, order: 10 },
  ];
  assert.deepEqual(sortPokemon(entries).map(({ slug }) => slug), ["form-first", "form-later"]);
});
