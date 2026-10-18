import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUsageBattleResponse,
  normalizeUsageIndexResponse,
  withRequestTimeout,
} from "../src/data/usage/providers/pokemonChampionsBattleData.js";

test("encerra a espera quando a origem ignora o abort e não responde", async () => {
  let aborted = false;
  await assert.rejects(
    withRequestTimeout(new Promise(() => {}), 5, () => { aborted = true; }),
    /A fonte demorou a responder/,
  );
  assert.equal(aborted, true);
});

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

test("exposes only source summary values as filters and discovers dated seasons", () => {
  const result = normalizeUsageIndexResponse({
    defaultSeason: "Current",
    seasons: ["M6", "M7"],
    dailyDataFolders: ["M7/17_10_2026"],
    pokemon: [{
      name: "Examplemon",
      showdownId: "examplemon",
      summary: {
        types: ["Water"],
        battleSummary: {
          Current: {
            Doubles: {
              position: 7,
              values: {
                move: [{ name: "Protect", percentage: "80%" }],
                held_item: [{ name: "Sitrus Berry", percentage: "50%" }],
                ability: [{ name: "Intimidate", percentage: "90%" }],
              },
            },
          },
        },
      },
    }],
  });

  assert.deepEqual(result.availableSeasons, ["M7", "M6"]);
  assert.deepEqual(result.pokemon[0].filterValues, {
    moves: ["Protect"],
    items: ["Sitrus Berry"],
    abilities: ["Intimidate"],
  });
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

test("normalizes published Doubles rows and keeps malformed stat points absent", () => {
  const result = normalizeUsageBattleResponse({
    pokemon: "Examplemon",
    showdownId: "examplemon",
    format: "Doubles",
    season: "Current",
    date: "17_10_2026",
    source: "battle_data/Current/17_10_2026/Doubles/Examplemon.csv",
    rows: [
      {
        pokemon: "Examplemon",
        column_position: 2,
        category: "move",
        rank: 1,
        name: "Protect",
        percentage: "77.2%",
        percentage_value: 77.2,
      },
      {
        pokemon: "Examplemon",
        column_position: 2,
        category: "stat_points",
        rank: 1,
        name: "spread",
        percentage: "25%",
        percentage_value: 25,
        hp_points: 12,
        attack_points: 0,
        defense_points: "invalid",
        sp_atk_points: 18,
        sp_def_points: 20,
        speed_points: 8,
      },
      null,
    ],
  });

  assert.equal(result.format, "Doubles");
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].name, "Protect");
  assert.equal(result.rows[0].percentageValue, 77.2);
  assert.equal(result.rows[1].statPoints.hp, 12);
  assert.equal(result.rows[1].statPoints.attack, 0);
  assert.equal(result.rows[1].statPoints.defense, null);
  assert.equal(result.rows[1].statPoints.spAttack, 18);
  assert.equal(result.rows[1].statPoints.spDefense, 20);
  assert.equal(result.rows[1].statPoints.speed, 8);
  assert.equal(result.sourceFile, "battle_data/Current/17_10_2026/Doubles/Examplemon.csv");
});

test("normalizes dated snapshots without merging them into current rows", () => {
  const result = normalizeUsageBattleResponse({
    pokemon: "Examplemon",
    showdownId: "examplemon",
    format: "Doubles",
    requestedDays: 7,
    season: "M7",
    daily: [{
      season: "M7",
      date: "17_10_2026",
      source: "battle_data/M7/17_10_2026/Doubles/Examplemon.csv",
      rows: [{
        pokemon: "Examplemon",
        column_position: 3,
        category: "stat_points",
        rank: 2,
        name: "spread",
        percentage: "25%",
        percentage_value: 25,
        hp_points: 2,
        attack_points: 32,
        defense_points: 0,
        sp_atk_points: 0,
        sp_def_points: 0,
        speed_points: 32,
      }],
    }],
  });

  assert.equal(result.rows.length, 0);
  assert.equal(result.daily[0].season, "M7");
  assert.equal(result.daily[0].date, "17_10_2026");
  assert.equal(result.daily[0].sourceFile, "battle_data/M7/17_10_2026/Doubles/Examplemon.csv");
  assert.equal(result.daily[0].rows[0].percentageValue, 25);
  assert.equal(result.daily[0].rows[0].statPoints.attack, 32);
  assert.equal(result.requestedDays, 7);
  assert.equal(Object.hasOwn(result, "sampleSize"), false);
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
  assert.doesNotThrow(() => normalizeUsageBattleResponse({ daily: [] }));
});
