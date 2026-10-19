import test from "node:test";
import assert from "node:assert/strict";
import { Generations, Pokemon } from "@smogon/calc";
import {
  applySpeedPointsToStatSpread,
  CHAMPIONS_MAX_STAT_POINTS,
  calculateChampionsSpeed,
  calculateStandardSpeed,
  compareSpeed,
  maximumLegalSpeedPoints,
  minimumTrainingToOutspeed,
  savedNatureForSpeed,
  validateChampionsStatPoints,
} from "../src/data/speedTiers.js";

test("modelo Champions reproduz o stat de Speed usado pelo motor no nível 50", () => {
  assert.equal(calculateChampionsSpeed(102, 32, "favorable"), 169);
  assert.equal(calculateChampionsSpeed(102, 0, "neutral"), 122);
  assert.equal(calculateChampionsSpeed(151, 32, "neutral"), 203);
});

test("modelo padrão usa nível, IV, EV e nature na ordem da fórmula", () => {
  const garchomp = { baseSpeed: 102, level: 50, iv: 31, ev: 252 };
  assert.equal(calculateStandardSpeed({ ...garchomp, nature: "favorable" }), 169);
  assert.equal(calculateStandardSpeed({ ...garchomp, nature: "neutral" }), 154);
  assert.equal(calculateStandardSpeed({ ...garchomp, nature: "unfavorable" }), 138);
  assert.equal(calculateStandardSpeed({ ...garchomp, level: 100, nature: "neutral" }), 303);
});

test("ambos os modelos de Speed conferem com os stats calculados pelo @smogon/calc", () => {
  const champions = new Pokemon(Generations.get(0), "Garchomp", {
    nature: "Jolly",
    evs: { spe: 32 },
  });
  const standard = new Pokemon(Generations.get(9), "Garchomp", {
    level: 50,
    nature: "Jolly",
    ivs: { spe: 31 },
    evs: { spe: 252 },
  });

  assert.equal(calculateChampionsSpeed(102, 32, "favorable"), champions.stats.spe);
  assert.equal(calculateStandardSpeed({ baseSpeed: 102, level: 50, iv: 31, ev: 252, nature: "favorable" }), standard.stats.spe);
});

test("empates são distintos de ficar abaixo e o SP mínimo exige ultrapassar", () => {
  assert.equal(compareSpeed(134, 134), "tie");
  assert.equal(compareSpeed(135, 134), "faster");
  assert.equal(compareSpeed(133, 134), "slower");
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 102, targetSpeed: 134, nature: "neutral" }), 13);
  assert.equal(calculateChampionsSpeed(102, 12, "neutral"), 134);
  assert.equal(calculateChampionsSpeed(102, 13, "neutral"), 135);
});

test("Champions aplica nature positiva, neutra e negativa e limita Speed a 32 SP", () => {
  assert.equal(calculateChampionsSpeed(102, CHAMPIONS_MAX_STAT_POINTS, "favorable"), 169);
  assert.equal(calculateChampionsSpeed(102, CHAMPIONS_MAX_STAT_POINTS, "neutral"), 154);
  assert.equal(calculateChampionsSpeed(102, CHAMPIONS_MAX_STAT_POINTS, "unfavorable"), 138);
  assert.throws(() => calculateChampionsSpeed(102, 33, "neutral"), /entre 0 e 32/);
  assert.throws(() => calculateChampionsSpeed(102, 50, "neutral"), /entre 0 e 32/);
  assert.equal(calculateStandardSpeed({ baseSpeed: 102, level: 50, iv: 31, ev: 252, nature: "unfavorable" }), 138);
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 1, targetSpeed: 5_000, nature: "neutral" }), null);
});

test("ultrapassar exige Speed estritamente maior e nunca recomenda mais de 32 SP", () => {
  assert.equal(calculateChampionsSpeed(100, 32, "neutral"), 152);
  assert.equal(compareSpeed(calculateChampionsSpeed(100, 32, "neutral"), 152), "tie");
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 100, targetSpeed: 152, nature: "neutral" }), null);
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 100, targetSpeed: 160, nature: "neutral" }), null);
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 100, targetSpeed: 160, nature: "favorable" }), 27);
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 100, targetSpeed: 160, nature: "unfavorable" }), null);
});

test("prévia de Speed respeita 32 SP por atributo e o orçamento total de 66", () => {
  const spread = { hp: 2, atk: 32, def: 20, spa: 0, spd: 0, spe: 12 };
  assert.deepEqual(validateChampionsStatPoints(spread), { valid: true, total: 66, remaining: 0, error: "" });
  assert.equal(maximumLegalSpeedPoints(spread), 12);
  assert.deepEqual(applySpeedPointsToStatSpread(spread, 12), {
    ok: true,
    statPoints: { ...spread, spe: 12 },
    remaining: 0,
  });
  assert.deepEqual(applySpeedPointsToStatSpread(spread, 13), {
    ok: false,
    error: "O set passa do orçamento total de 66 SP.",
  });
  assert.deepEqual(applySpeedPointsToStatSpread(spread, 33), {
    ok: false,
    error: "SP de Speed precisa ficar entre 0 e 32.",
  });
  const invalidAttribute = { ...spread, atk: 33, spe: 0 };
  assert.equal(validateChampionsStatPoints(invalidAttribute).valid, false);
  assert.equal(maximumLegalSpeedPoints(invalidAttribute), 0);
  assert.equal(applySpeedPointsToStatSpread(invalidAttribute, 0).ok, false);
});

test("aplicar categoria de nature preserva a nature salva quando Speed já tem o mesmo efeito", () => {
  assert.equal(savedNatureForSpeed("favorable", "Jolly"), "Jolly");
  assert.equal(savedNatureForSpeed("neutral", "Modest"), "Modest");
  assert.equal(savedNatureForSpeed("unfavorable", "Jolly"), "Brave");
  assert.equal(savedNatureForSpeed("neutral", ""), "Serious");
});
