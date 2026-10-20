import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTeam, serializeTeam } from "@spinda-stop/domain";
import { calculatorTestPokemonIndex, calculatorTestSource, calculatorTestTeam } from "./fixtures/calculator-team.js";
import { calculateChampionsDamage, calculateDamageAgainstTargets, calculateDamageFromTeamAgainstTarget, getDamageItemSupport, getDamageMove } from "../src/data/damageCalculator.js";

const TARGET = { species: "Gardevoir-Mega", nature: "Serious", ability: "", item: "", statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };

function toCalculatorMembers(team) {
  return team.members.map((member) => ({
    species: member.pokemonId,
    nature: member.nature,
    ability: member.ability,
    item: member.item,
    statPoints: member.statPoints,
    moves: member.moves,
  }));
}

test("fixture de seis sets conserva a forma, os quatro golpes e os campos ao importar/exportar", async () => {
  const proof = JSON.parse(await readFile(new URL("./fixtures/verified-sv-learnset.json", import.meta.url), "utf8"));
  assert.equal(proof.metadata.sourceCommit, "6fd69dfe90465ba96534f6816fc817737d1f97f6");
  assert.equal(proof.metadata.versionGroup, "scarlet-violet");

  const imported = parseTeam(serializeTeam(calculatorTestTeam), calculatorTestPokemonIndex);
  assert.equal(imported.ok, true);
  assert.equal(imported.value.members.length, 6);
  for (const member of imported.value.members) {
    const source = proof.pokemon[member.pokemonId];
    assert.ok(source, `Forma sem fonte: ${member.pokemonId}`);
    assert.equal(member.speciesId, source.speciesId);
    assert.equal(member.formId, source.formId);
    assert.equal(member.moves.length, 4);
    assert.ok(source.abilities.includes(member.ability));
    assert.deepEqual(member.moves, source.moves.map(({ name }) => name));
    assert.ok(source.moves.every(({ name, method }) => name && method));
    assert.ok(getDamageItemSupport(member.item).status === "modeled" || getDamageItemSupport(member.item).status === "context-only");
    const totalSp = Object.values(member.statPoints).reduce((sum, value) => sum + value, 0);
    assert.ok(totalSp <= 66);
    assert.ok(Object.values(member.statPoints).every((value) => value <= 32));
  }
  assert.equal(calculatorTestSource.championsSetLegality, "Not verified");
  assert.match(proof.metadata.note, /não confirmam.*legalidade/);
});

test("seis sets rastreáveis calculam independentemente no modo Time vs 1", () => {
  const rows = calculateDamageFromTeamAgainstTarget(toCalculatorMembers(calculatorTestTeam), TARGET, { gameType: "Doubles" });
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(({ status }) => status), Array(6).fill("ready"));
  assert.deepEqual(rows.map(({ member }) => member.species), calculatorTestTeam.members.map(({ pokemonId }) => pokemonId));
  assert.ok(rows.every((row) => row.moves.length === 4));
  assert.ok(rows.every((row) => row.moves[0].result.rolls.length === 16));
  assert.ok(rows.every((row) => row.moves.every(({ result, move }) => result || !getDamageMove(move))));
  assert.match(rows[0].moves[0].result.itemContextNotes[0], /Clear Amulet/);
});

test("mudanças de golpe, Nature, item, habilidade, SP e campo alteram Time vs 1", () => {
  const members = toCalculatorMembers(calculatorTestTeam);
  const options = { gameType: "Singles" };
  const target = { ...TARGET, species: "Garchomp" };
  const baseline = calculateDamageFromTeamAgainstTarget(members, target, options)[0].moves[0].result.rolls;
  const variants = [
    { members: [{ ...members[0], moves: ["Dragon Claw", ...members[0].moves.slice(1)] }], options },
    { members: [{ ...members[0], nature: "Adamant" }], options },
    { members: [{ ...members[0], item: "Life Orb" }], options },
    { members: [{ ...members[0], statPoints: { ...members[0].statPoints, atk: 0 } }], options },
    { members: [{ ...members[0], ability: "Sand Force" }], options: { ...options, weather: "Sand" } },
    { members: [{ ...members[0] }], options: { ...options, terrain: "Grassy" } },
  ];

  for (const variant of variants) {
    const result = calculateDamageFromTeamAgainstTarget(variant.members, target, variant.options)[0].moves[0].result;
    assert.ok(result, "a edição ainda deve produzir um resultado");
    assert.equal(result.rolls.length, 16);
    assert.notDeepEqual(result.rolls, baseline);
  }
});

test("1 vs 1 e 1 vs vários mantêm 16 rolls e reagem aos campos editados", () => {
  const attacker = { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", item: "Life Orb", statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } };
  const input = { attacker, defender: TARGET, move: "Earthquake", gameType: "Singles" };
  const single = calculateChampionsDamage(input);
  const changed = calculateChampionsDamage({ ...input, attacker: { ...attacker, nature: "Serious", statPoints: { ...attacker.statPoints, atk: 0 } }, terrain: "Grassy" });
  assert.equal(single.rolls.length, 16);
  assert.equal(changed.rolls.length, 16);
  assert.notDeepEqual(single.rolls, changed.rolls);

  const many = calculateDamageAgainstTargets({ ...input, attacker: { ...attacker, item: "" } }, ["Garchomp", "Gardevoir-Mega"]);
  const manyChanged = calculateDamageAgainstTargets({ ...input, attacker: { ...attacker, item: "Life Orb", nature: "Adamant" }, weather: "Sand" }, ["Garchomp", "Gardevoir-Mega"]);
  assert.equal(many.length, 2);
  assert.ok(many.every(({ result }) => result.rolls.length === 16));
  assert.ok(manyChanged.every(({ result }) => result.rolls.length === 16));
  many.forEach(({ result }, index) => assert.notDeepEqual(result.rolls, manyChanged[index].result.rolls));
});
