import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUsageBattleResponse,
  normalizeUsageIndexResponse,
} from "../src/data/usage/providers/pokemonChampionsBattleData.js";

test("normalizes only fields available in the source index", () => {
  const result = normalizeUsageIndexResponse({
    generatedAt: "2026-10-17T15:27:09.479Z",
    defaultSeason: "Current",
    pokemon: [{
      name: "Examplemon",
      showdownId: "examplemon",
      summary: {
        types: ["Water"],
        battleSummary: { Current: { Doubles: { position: 7 } } },
      },
    }],
  });

  assert.equal(result.season, "Current");
  assert.equal(result.pokemon[0].position, 7);
  assert.deepEqual(result.pokemon[0].types, ["Water"]);
  assert.equal(Object.hasOwn(result.pokemon[0], "sampleSize"), false);
  assert.equal(Object.hasOwn(result.pokemon[0], "regulation"), false);
});

test("keeps missing period and percentage values unknown", () => {
  const result = normalizeUsageBattleResponse({
    pokemon: "Examplemon",
    showdownId: "examplemon",
    format: "Doubles",
    season: "Current",
    date: null,
    source: "example.csv",
    rows: [{
      category: "teammate",
      rank: 1,
      name: "Partner",
      percentage: "",
      percentage_value: null,
    }],
  });

  assert.equal(result.date, null);
  assert.equal(result.rows[0].percentage, null);
  assert.equal(result.rows[0].percentageValue, null);
  assert.equal(result.rows[0].statPoints.hp, null);
  assert.equal(Object.hasOwn(result, "sampleSize"), false);
  assert.equal(Object.hasOwn(result, "regulation"), false);
});

test("does not invent a season when the index omits it", () => {
  const result = normalizeUsageIndexResponse({
    pokemon: [{ name: "Examplemon", showdownId: "examplemon" }],
  });

  assert.equal(result.season, null);
  assert.equal(result.pokemon[0].position, null);
});

test("rejects an index without a species list and a response without rows", () => {
  assert.throws(() => normalizeUsageIndexResponse({}), /lista de espécies/);
  assert.throws(() => normalizeUsageBattleResponse({}), /não contém linhas/);
});
