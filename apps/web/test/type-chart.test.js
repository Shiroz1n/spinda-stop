import test from "node:test";
import assert from "node:assert/strict";
import { getTypeEffectiveness } from "../src/data/damageCalculator.js";
import { getDefensiveTypeEffectiveness, typeEffectivenessChart } from "../src/data/typeChart.js";

test("the fiche type chart matches the pinned damage engine for every single and dual type", () => {
  const types = Object.keys(typeEffectivenessChart);
  assert.equal(types.length, 18);
  const defenses = [...types.map((type) => [type])];
  for (let first = 0; first < types.length; first += 1) {
    for (let second = first + 1; second < types.length; second += 1) {
      defenses.push([types[first], types[second]]);
    }
  }

  for (const attackType of types) {
    for (const defenderTypes of defenses) {
      assert.equal(
        getDefensiveTypeEffectiveness(attackType, defenderTypes),
        getTypeEffectiveness(attackType, defenderTypes),
        `${attackType} against ${defenderTypes.join(" / ")}`,
      );
    }
  }
});

test("the fiche omits matchups whose types have no entry in the source chart", () => {
  assert.equal(getDefensiveTypeEffectiveness("stellar", ["normal"]), null);
  assert.equal(getDefensiveTypeEffectiveness("fire", ["stellar"]), null);
});
