import test from "node:test";
import assert from "node:assert/strict";
import { Generations, Pokemon } from "@smogon/calc";
import {
  calculateChampionsSpeed,
  calculateStandardSpeed,
  compareSpeed,
  minimumTrainingToOutspeed,
  savedNatureForSpeed,
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

test("valores máximos são limitados à faixa do controle e nature desfavorável é respeitada", () => {
  assert.equal(calculateChampionsSpeed(102, 999, "neutral"), 1121);
  assert.equal(calculateStandardSpeed({ baseSpeed: 102, level: 50, iv: 31, ev: 252, nature: "unfavorable" }), 138);
  assert.equal(minimumTrainingToOutspeed({ baseSpeed: 1, targetSpeed: 5_000, nature: "neutral" }), null);
});

test("aplicar categoria de nature preserva a nature salva quando Speed já tem o mesmo efeito", () => {
  assert.equal(savedNatureForSpeed("favorable", "Jolly"), "Jolly");
  assert.equal(savedNatureForSpeed("neutral", "Modest"), "Modest");
  assert.equal(savedNatureForSpeed("unfavorable", "Jolly"), "Brave");
  assert.equal(savedNatureForSpeed("neutral", ""), "Serious");
});
