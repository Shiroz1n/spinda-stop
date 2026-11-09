import assert from "node:assert/strict";
import test from "node:test";
import { importShowdownTeam } from "../../../packages/domain/src/index.js";
import { publicTeamlistToShowdownPaste } from "../src/data/publicVgcTeams.js";

const catalog = [
  { slug: "pikachu", name: "Pikachu", speciesSlug: "pikachu", speciesName: "Pikachu", speciesId: 25, formId: "default" },
  { slug: "indeedee-female", name: "Female Indeedee", speciesSlug: "indeedee", speciesName: "Indeedee", speciesId: 876, formId: "female" },
  ...Array.from({ length: 4 }, (_, index) => ({ slug: `species-${index}`, name: `Species ${index}`, speciesSlug: `species-${index}`, speciesName: `Species ${index}`, speciesId: index + 1, formId: "default" })),
];

test("Limitless teamlists preserve published fields and leave absent set fields explicit", () => {
  const teamlist = Array.from({ length: 6 }, (_, index) => ({
    speciesId: index === 1 ? "indeedee-female" : catalog[index].slug,
    speciesName: catalog[index].name,
    ...(index === 0 ? { item: "Light Ball", ability: "Static", nature: "Timid", moves: ["Thunderbolt", "Protect"] } : {}),
  }));
  const paste = publicTeamlistToShowdownPaste(teamlist, catalog);
  const imported = importShowdownTeam(paste, catalog, { allowPartial: true });

  assert.equal(imported.ok, true);
  assert.equal(imported.value.members[0].item, "Light Ball");
  assert.equal(imported.value.members[0].ability, "Static");
  assert.equal(imported.value.members[0].nature, "Timid");
  assert.deepEqual(imported.value.members[0].moves.slice(0, 2), ["Thunderbolt", "Protect"]);
  assert.equal(imported.value.members[1].pokemonId, "indeedee-female");
  assert.ok(imported.warnings.some((warning) => warning.includes("não publica") && warning.includes("distribuição de pontos")));
});

test("incomplete public teamlists are rejected instead of importing a partial roster silently", () => {
  assert.equal(publicTeamlistToShowdownPaste(Array(5).fill({ speciesId: "pikachu", speciesName: "Pikachu" }), catalog), null);
  assert.equal(publicTeamlistToShowdownPaste(Array(6).fill({ speciesId: "pikachu" }), catalog), null);
});

test("public teamlists reject conflicting known species identities", () => {
  const teamlist = catalog.map((pokemon) => ({ speciesId: pokemon.slug, speciesName: pokemon.name }));
  teamlist[0] = { speciesId: "pikachu", speciesName: "Species 0" };

  assert.equal(publicTeamlistToShowdownPaste(teamlist, catalog), null);
});
