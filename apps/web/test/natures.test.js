import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTeam, createTeamMember, parseTeam, serializeTeam } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex" with { type: "json" };
import natureCatalog from "@spinda-stop/data/natures" with { type: "json" };
import { getNature, getNatureEffectSummary, getNatureMultiplier, NATURES } from "../src/data/natures.js";

test("um catálogo cobre as 25 Natures oficiais com nomes e efeitos legíveis", () => {
  assert.equal(NATURES.length, 25);
  assert.deepEqual(NATURES.map(({ slug }) => slug).sort(), natureCatalog.natures.map(({ slug }) => slug).sort());
  assert.equal(getNatureEffectSummary("Jolly"), "Velocidade ↑ · Ataque Especial ↓");
  assert.equal(getNatureEffectSummary("Adamant"), "Ataque ↑ · Ataque Especial ↓");
  assert.equal(getNatureEffectSummary("Timid"), "Velocidade ↑ · Ataque ↓");
  assert.equal(getNatureEffectSummary("Brave"), "Ataque ↑ · Velocidade ↓");
  assert.equal(getNatureEffectSummary("Modest"), "Ataque Especial ↑ · Ataque ↓");
  for (const name of ["Bashful", "Docile", "Hardy", "Quirky", "Serious"]) {
    assert.equal(getNatureEffectSummary(name), "Sem alteração");
  }
});

test("HP não recebe efeito de Nature e os atalhos são insensíveis a caixa", () => {
  assert.equal(getNature("jOlLy")?.name, "Jolly");
  for (const name of ["Jolly", "Timid", "Adamant", "Brave", "Modest", "Bashful"]) {
    assert.equal(getNatureMultiplier(name, "hp"), 1);
  }
  assert.equal(getNatureMultiplier("Jolly", "spe"), 1.1);
  assert.equal(getNatureMultiplier("Jolly", "spa"), 0.9);
  assert.equal(getNatureMultiplier("Brave", "spe"), 0.9);
  assert.equal(getNatureMultiplier("Bashful", "atk"), 1);
});

test("Nature real continua intacta ao serializar e importar o set", () => {
  const team = createEmptyTeam();
  team.members[0] = { ...createTeamMember(dexData.pokemon.find(({ slug }) => slug === "garchomp")), nature: "Adamant" };
  team.members[1] = { ...createTeamMember(dexData.pokemon.find(({ slug }) => slug === "lucario")), nature: "Timid" };
  const imported = parseTeam(serializeTeam(team), dexData.pokemon);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.value.members.slice(0, 2).map(({ nature }) => nature), ["Adamant", "Timid"]);
});
