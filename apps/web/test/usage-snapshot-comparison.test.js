import assert from "node:assert/strict";
import test from "node:test";
import { areComparableSnapshots, compareSnapshotRanks } from "../src/data/usage/snapshotComparison.js";

const current = {
  showdownId: "corviknight",
  season: "M-8",
  format: "Doubles",
  date: "08_11_2026",
  sourceFile: "battle_data/M8/08_11_2026/Doubles/Corviknight.csv",
  rows: [
    { category: "move", rank: 1, name: "Body Press", percentageValue: 65 },
    { category: "move", rank: 2, name: "Roost", percentageValue: 24 },
    { category: "move", rank: 3, name: "New move", percentageValue: 10 },
    { category: "stat_points", rank: 1, name: "spread", statPoints: { hp: 32, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 32 } },
  ],
};
const comparison = {
  ...current,
  date: "07_11_2026",
  sourceFile: "battle_data/M8/07_11_2026/Doubles/Corviknight.csv",
  rows: [
    { category: "move", rank: 2, name: "Body Press", percentageValue: 30 },
    { category: "move", rank: 1, name: "Roost", percentageValue: 40 },
    { category: "move", rank: 3, name: "Removed move", percentageValue: 30 },
    { category: "stat_points", rank: 2, name: "spread", statPoints: { hp: 32, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 32 } },
  ],
};

test("compares published positions only for the same Pokémon, format, season, and dated source", () => {
  assert.equal(areComparableSnapshots(current, comparison), true);
  assert.deepEqual(compareSnapshotRanks(current, comparison, "move"), [{
    category: "move",
    rows: [
      { name: "Body Press", currentRank: 1, comparisonRank: 2, movement: 1 },
      { name: "Roost", currentRank: 2, comparisonRank: 1, movement: -1 },
    ],
  }]);
  assert.deepEqual(compareSnapshotRanks(current, comparison, "stat_points"), [{
    category: "stat_points",
    rows: [{ name: "spread", currentRank: 1, comparisonRank: 2, movement: 1 }],
  }]);
  assert.equal("percentageValue" in compareSnapshotRanks(current, comparison, "move")[0].rows[0], false);
});

test("refuses snapshots with mismatched context, missing dates, or unstamped sources", () => {
  assert.equal(areComparableSnapshots(current, { ...comparison, season: "M-7" }), false);
  assert.equal(areComparableSnapshots(current, { ...comparison, format: "Singles" }), false);
  assert.equal(areComparableSnapshots(current, { ...comparison, showdownId: "corviknight-galar" }), false);
  assert.equal(areComparableSnapshots(current, { ...comparison, date: null }), false);
  assert.equal(areComparableSnapshots(current, { ...comparison, sourceFile: "battle_data/M8/current/Doubles/Corviknight.csv" }), false);
  assert.equal(compareSnapshotRanks(current, { ...comparison, season: "M-7" }, "move"), null);
});
