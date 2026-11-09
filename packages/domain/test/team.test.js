import test from "node:test";
import assert from "node:assert/strict";
import {
  addPokemonToDraft,
  createEmptyTeam,
  createTeamMember,
  exportShowdownTeam,
  formatNationalNumber,
  importShowdownTeam,
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
const showdownCatalog = [
  ...catalog,
  { ...catalog[0], slug: "raichu-alola", speciesId: 26, speciesSlug: "raichu", formId: "alola", name: "Alolan Raichu", speciesName: "Raichu" },
];

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

test("imports and exports Showdown paste with Champions points encoded as its documented EV field", () => {
  const imported = importShowdownTeam(`Alolan Raichu @ Focus Sash\nAbility: Surge Surfer\nLevel: 50\nEVs: 4 HP / 32 SpA / 30 Spe\nTimid Nature\n- Thunderbolt\n- Protect`, showdownCatalog);

  assert.equal(imported.ok, true);
  assert.equal(imported.value.members[0].pokemonId, "raichu-alola");
  assert.deepEqual(imported.value.members[0].statPoints, { hp: 4, atk: 0, def: 0, spa: 32, spd: 0, spe: 30 });
  assert.equal(imported.value.members[0].nature, "Timid");
  assert.deepEqual(imported.value.members[0].moves.slice(0, 2), ["Thunderbolt", "Protect"]);

  const exported = exportShowdownTeam(imported.value, showdownCatalog);
  assert.match(exported, /^Raichu-Alola @ Focus Sash/m);
  assert.match(exported, /EVs: 4 HP \/ 32 SpA \/ 30 Spe/);
  const roundTrip = importShowdownTeam(exported, showdownCatalog);
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.value.members[0].statPoints, imported.value.members[0].statPoints);
});

test("resolves nicknames and gender while warning that the draft cannot preserve them", () => {
  const imported = importShowdownTeam("Sparky (Pikachu) @ Light Ball\nIVs: 0 Atk\nJolly Nature\n- Thunderbolt", catalog);
  assert.equal(imported.ok, true);
  assert.equal(imported.value.members[0].pokemonId, "pikachu");
  assert.equal(imported.value.members[0].ability, "");
  assert.ok(imported.warnings.some((warning) => warning.includes("apelido “Sparky” não é preservado")));
  assert.ok(imported.warnings.some((warning) => warning.includes("IVs não são representados")));
  assert.ok(imported.warnings.some((warning) => warning.includes("não publica") && warning.includes("habilidade")));
  assert.equal(imported.value.members[0].statPoints.atk, 0);

  const gendered = importShowdownTeam("Pikachu (M)\n- Thunderbolt", catalog);
  assert.equal(gendered.ok, true);
  assert.equal(gendered.value.members[0].pokemonId, "pikachu");
  assert.ok(gendered.warnings.some((warning) => warning.includes("gênero do set não é preservado")));
});

test("partial public imports skip unknown Pokémon and resolve Showdown female form IDs", () => {
  const indeedee = {
    ...catalog[0],
    slug: "indeedee-female",
    name: "Female Indeedee",
    speciesSlug: "indeedee",
    speciesName: "Indeedee",
    speciesId: 876,
    formId: "female",
  };
  const paste = "Unknownmon\n- Protect\n\nPikachu @ Light Ball\n- Thunderbolt\n\nIndeedee-F @ Psychic Seed\n- Psychic";

  assert.match(importShowdownTeam(paste, [catalog[0]]).error, /não foi encontrado/);
  const imported = importShowdownTeam(paste, [catalog[0], indeedee], { allowPartial: true });
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.value.members.filter(Boolean).map((member) => member.pokemonId), ["pikachu", "indeedee-female"]);
  assert.ok(imported.warnings.some((warning) => warning.includes("Unknownmon") && warning.includes("Foi ignorado")));
  assert.equal(imported.value.members[0].pokemonId, "pikachu");
  assert.deepEqual(imported.fieldPresence[0], { ability: false, item: true, nature: false, level: false, statPoints: false, moves: 1 });
  assert.equal(imported.fieldPresence[1].item, true);
  assert.match(importShowdownTeam("Unknownmon", [catalog[0]], { allowPartial: true }).error, /Nenhum Pokémon/);
});

test("partial paste reports fields that are absent instead of implying a published ability or set", () => {
  const imported = importShowdownTeam("Pikachu\n- Thunderbolt", catalog, { allowPartial: true });

  assert.equal(imported.ok, true);
  assert.equal(imported.value.members[0].ability, "");
  assert.deepEqual(imported.fieldPresence[0], { ability: false, item: false, nature: false, level: false, statPoints: false, moves: 1 });
  assert.ok(imported.warnings.some((warning) => warning.includes("não publica") && warning.includes("habilidade") && warning.includes("distribuição de pontos")));
});

test("empty Showdown fields remain absent and cannot clear configured categories as published data", () => {
  const imported = importShowdownTeam("Pikachu @ \nAbility: \nNature: \nLevel: \nEVs: \n- \n- Thunderbolt", catalog, { allowPartial: true });

  assert.equal(imported.ok, true);
  assert.equal(imported.value.members[0].ability, "");
  assert.equal(imported.value.members[0].item, "");
  assert.equal(imported.value.members[0].nature, "");
  assert.equal(imported.value.members[0].level, 50);
  assert.deepEqual(imported.value.members[0].statPoints, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  assert.deepEqual(imported.value.members[0].moves, ["Thunderbolt", "", "", ""]);
  assert.deepEqual(imported.fieldPresence[0], { ability: false, item: false, nature: false, level: false, statPoints: false, moves: 1 });
  assert.ok(imported.warnings.some((warning) => warning.includes("golpe vazio foi ignorado")));
  assert.ok(imported.warnings.some((warning) => warning.includes("não publica") && warning.includes("nível")));
});

test("Showdown gender suffix selects a matching gendered species form when available", () => {
  const gendered = [
    { ...catalog[0], slug: "meowstic-male", name: "Meowstic Male", speciesSlug: "meowstic", speciesName: "Meowstic", formId: "male" },
    { ...catalog[0], slug: "meowstic-female", name: "Meowstic Female", speciesSlug: "meowstic", speciesName: "Meowstic", formId: "female" },
  ];

  const imported = importShowdownTeam("Meowstic (F)\n- Psychic", gendered);
  assert.equal(imported.ok, true);
  assert.equal(imported.value.members[0].pokemonId, "meowstic-female");
  assert.ok(!imported.warnings.some((warning) => warning.includes("gênero do set não é preservado")));
});

test("round trips Paldean Tauros breed forms through Showdown species IDs", () => {
  const tauros = {
    ...catalog[0],
    slug: "tauros-paldea-aqua-breed",
    speciesId: 128,
    speciesSlug: "tauros",
    formId: "paldea-aqua-breed",
    name: "Paldean Tauros (Aqua Breed)",
    speciesName: "Tauros",
  };
  const team = createEmptyTeam();
  team.members[0] = createTeamMember(tauros);
  const exported = exportShowdownTeam(team, [tauros]);

  assert.match(exported, /^Tauros-Paldea-Aqua(?:\n|$)/);
  for (const heading of ["Tauros-Paldea-Aqua", "Paldean Tauros (Aqua Breed)"]) {
    const imported = importShowdownTeam(heading, [tauros]);
    assert.equal(imported.ok, true);
    assert.equal(imported.value.members[0].pokemonId, tauros.slug);
    if (heading === "Paldean Tauros (Aqua Breed)") assert.ok(imported.warnings.some((warning) => warning.includes("não publica")));
  }
  const roundTrip = importShowdownTeam(exported, [tauros]);
  assert.equal(roundTrip.ok, true);
  assert.equal(roundTrip.value.members[0].pokemonId, tauros.slug);
});

test("rejects unsupported or invalid Champions point budgets and malformed species", () => {
  assert.match(importShowdownTeam("Pikachu\nEVs: 252 Atk", catalog).error, /excede o limite Champions/);
  assert.match(importShowdownTeam("Pikachu\nEVs: /", catalog).error, /não reconheci a distribuição/);
  assert.match(importShowdownTeam("Missingmon", catalog).error, /não foi encontrado/);
  assert.match(importShowdownTeam("Pikachu\n- One\n- Two\n- Three\n- Four\n- Five", catalog).error, /mais de quatro golpes/);
  assert.match(importShowdownTeam(Array(7).fill("Pikachu").join("\n\n"), catalog).error, /mais de seis/);
});

test("searches by accents, safe punctuation aliases, number, type, and generation", () => {
  const entries = [
    { ...catalog[0], name: "Nidorán", speciesName: "Nidorán" },
    { ...catalog[0], slug: "raichu-alola", name: "Raichu de Alola", speciesName: "Raichu", formName: "Alola", types: ["electric", "psychic"], generation: 7 },
    { ...catalog[0], slug: "farfetchd", name: "Farfetch’d", speciesId: 83, aliases: ["Farfetch'd"] },
  ];
  assert.equal(searchPokemon(entries).length, 3);
  assert.equal(searchPokemon(entries, "raichu", { type: "electric", generation: 7 }).length, 1);
  assert.equal(searchPokemon(entries, "nidoran").length, 1);
  assert.equal(searchPokemon(entries, "Farfetch'd").length, 1);
  assert.equal(searchPokemon(entries, "#0083").map(({ slug }) => slug).join(","), "farfetchd");
  assert.equal(searchPokemon(entries, "83").map(({ slug }) => slug).join(","), "farfetchd");
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
