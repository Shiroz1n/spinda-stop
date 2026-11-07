import test from "node:test";
import assert from "node:assert/strict";
import { mergeCategoryRows, mergeUsageCatalog } from "../src/data/usage/mergeUsageData.js";

const resolvePokemon = ({ id, name }) => {
  const key = String(id || name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ({ "vivillonfancy": { slug: "vivillon-fancy", types: ["Bug", "Flying"] } })[key] || null;
};

test("unifies species by exact form and unions filter fields without inventing ranks", () => {
  const catalog = mergeUsageCatalog({
    format: "Doubles",
    season: "Current",
    generatedAt: null,
    pokemon: [
      { name: "Vivillon-Fancy", showdownId: "vivillonfancy", position: 4, types: [], filterValues: { moves: ["Hurricane"] } },
      { name: "Garchomp", showdownId: "garchomp", position: null, types: ["Dragon", "Ground"], filterValues: {} },
    ],
  }, {
    format: "doubles",
    season: "M-8",
    entries: [
      { id: "vivillonfancy", name: "Vivillon-Fancy", rank: 6, filterValues: { abilities: ["Compound Eyes"] } },
      { id: "vivillon", name: "Vivillon", rank: 1, filterValues: {} },
    ],
  }, resolvePokemon);

  assert.equal(catalog.length, 3);
  const fancy = catalog.find((entry) => entry.key === "form:vivillonfancy");
  assert.equal(fancy.position, 4);
  assert.equal(fancy.metaRollRank, 6);
  assert.deepEqual(fancy.types, ["Bug", "Flying"]);
  assert.equal(fancy.battleData.season, "Current");
  assert.equal(fancy.metaRoll.season, "M-8");
  assert.deepEqual(fancy.filterValues, { moves: ["Hurricane"], items: [], abilities: ["Compound Eyes"] });
  assert.equal(catalog.find((entry) => entry.name === "Vivillon").battleData, null);
  assert.equal(catalog.find((entry) => entry.name === "Garchomp").position, null);
});

test("merges matching category identities into one row with separate source observations", () => {
  const rows = mergeCategoryRows({
    categoryId: "move",
    formats: { battleData: "Doubles", metaRoll: "doubles" },
    battleRows: [{ rank: 1, name: "Dire Claw", percentage: "79.1%", percentageValue: 79.1 }],
    metaRows: [{ rank: 2, name: "dire-claw", percentage: "79.4%", percentageValue: 79.4 }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].observations.battleData.percentageValue, 79.1);
  assert.equal(rows[0].observations.metaRoll.percentageValue, 79.4);
  assert.equal(Object.hasOwn(rows[0], "average"), false);
});

test("keys stat point spreads by all six values and keeps zero distinct from missing", () => {
  const rows = mergeCategoryRows({
    categoryId: "stat_points",
    formats: { battleData: "Doubles", metaRoll: "doubles" },
    battleRows: [{ rank: 1, statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 }, percentageValue: 15 }],
    metaRows: [
      { rank: 1, statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 }, percentageValue: 14.8 },
      { rank: 2, statPoints: { hp: 2, attack: 32, defense: null, spAttack: 0, spDefense: 0, speed: 32 }, percentageValue: 2 },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].observations.battleData.percentageValue, 15);
  assert.equal(rows[0].observations.metaRoll.percentageValue, 14.8);
  assert.equal(rows[1].statPoints.defense, null);
  assert.equal(rows[0].statPoints.defense, 0);
});

test("keeps incomplete spreads as separate observations instead of deduplicating unknown values", () => {
  const rows = mergeCategoryRows({
    categoryId: "stat_points",
    formats: { battleData: "Doubles", metaRoll: "doubles" },
    battleRows: [{ rank: 1, statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 } }],
    metaRows: [
      { rank: 1, statPoints: { hp: 2, attack: 32, defense: null, spAttack: 0, spDefense: 0, speed: 32 } },
      { rank: 2, statPoints: { hp: 2, attack: 32, defense: null, spAttack: 0, spDefense: 0, speed: 32 } },
    ],
  });

  assert.equal(rows.length, 3);
  assert.equal(rows.filter((row) => row.observations.metaRoll).length, 2);
});

test("does not deduplicate provider rows from different formats", () => {
  const rows = mergeCategoryRows({
    categoryId: "ability",
    formats: { battleData: "Doubles", metaRoll: "Singles" },
    battleRows: [{ rank: 1, name: "Intimidate", percentageValue: 30 }],
    metaRows: [{ rank: 1, name: "Intimidate", percentageValue: 40 }],
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => Object.keys(row.observations)), [["battleData"], ["metaRoll"]]);
});

test("does not merge distributions when one source format is unknown", () => {
  const rows = mergeCategoryRows({
    categoryId: "ability",
    formats: { battleData: "Doubles", metaRoll: null },
    battleRows: [{ rank: 1, name: "Intimidate" }],
    metaRows: [{ rank: 1, name: "Intimidate" }],
  });

  assert.equal(rows.length, 2);
});

test("keeps the usable provider catalog when the other index failed", () => {
  const catalog = mergeUsageCatalog(null, {
    format: "doubles",
    entries: [{ id: "garchomp", name: "Garchomp", rank: 1, filterValues: {} }],
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].battleData, null);
  assert.equal(catalog[0].metaRoll.rank, 1);
});
