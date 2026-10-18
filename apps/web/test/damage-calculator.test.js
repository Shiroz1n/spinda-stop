import test from "node:test";
import assert from "node:assert/strict";
import { calculateChampionsDamage, getDamageMove, getHitOptions } from "../src/data/damageCalculator.js";

const side = (species, options = {}) => ({
  species,
  nature: options.nature || "Serious",
  ability: options.ability || "",
  item: options.item || "",
  status: "",
  statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...options.statPoints },
  boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
});

test("confere a faixa do caso público exibido no Pokémon Showdown", () => {
  const result = calculateChampionsDamage({
    attacker: side("Absol-Mega-Z", {
      nature: "Jolly",
      ability: "Justified",
      item: "Absolite Z",
      statPoints: { atk: 31, spe: 32 },
    }),
    defender: side("Absol-Mega-Z", {
      nature: "Jolly",
      ability: "Justified",
      item: "Absolite Z",
      statPoints: { def: 3 },
    }),
    gameType: "Singles",
    move: "Shadow Claw",
  });

  assert.deepEqual([result.min, result.max], [99, 117]);
  assert.equal(result.rolls.length, 16);
});

test("Doubles aplica o dano em área para Earthquake, Singles não", () => {
  const attacker = side("Garchomp");
  const defender = side("Garchomp");
  const singles = calculateChampionsDamage({ attacker, defender, gameType: "Singles", move: "Earthquake" });
  const doubles = calculateChampionsDamage({ attacker, defender, gameType: "Doubles", move: "Earthquake" });

  assert.deepEqual([singles.min, singles.max], [75, 88]);
  assert.deepEqual([doubles.min, doubles.max], [55, 66]);
  assert.equal(doubles.isSpread, true);
});

test("golpe multi-hit usa apenas quantidades permitidas pela entrada do motor", () => {
  assert.deepEqual(getHitOptions(getDamageMove("Bullet Seed")), [2, 3, 4, 5]);
  assert.deepEqual(getHitOptions(getDamageMove("Pin Missile")), [2, 3, 4, 5]);

  const result = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    gameType: "Doubles",
    move: "Bullet Seed",
    hits: 2,
  });

  assert.equal(result.hits, 2);
  assert.equal(result.hitRanges.length, 2);
  assert.ok(result.min > 0);
});

test("valida espécie e Stat Points antes de calcular", () => {
  assert.throws(() => calculateChampionsDamage({
    attacker: side("nome inventado"),
    defender: side("Garchomp"),
    move: "Earthquake",
  }), /catálogo/);

  assert.throws(() => calculateChampionsDamage({
    attacker: side("Garchomp", { statPoints: { atk: -1 } }),
    defender: side("Garchomp"),
    move: "Earthquake",
  }), /Stat Points/);
});

test("golpes sem dano direto não são apresentados como uma faixa de dano", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    move: "Protect",
  });

  assert.equal(result.move.category, "Status");
  assert.deepEqual([result.min, result.max], [0, 0]);
});
