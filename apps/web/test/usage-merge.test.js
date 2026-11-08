import test from "node:test";
import assert from "node:assert/strict";
import { hasPublishedStatPoints, mergeCategoryRows, mergeUsageCatalog, selectRankedPartnerRows, selectUsageCapture } from "../src/data/usage/mergeUsageData.js";

test("distinguishes published zero points from missing stat points", () => {
  assert.equal(hasPublishedStatPoints({ hp: 0, attack: null }), true);
  assert.equal(hasPublishedStatPoints({ hp: null, attack: undefined }), false);
  assert.equal(hasPublishedStatPoints(null), false);
});

test("selects one coherent capture for a species and defaults to the active Battle Data view", () => {
  assert.equal(selectUsageCapture([{ name: "Protect" }], [{ name: "Close Combat" }]), "battleData");
  assert.equal(selectUsageCapture([], [{ name: "Close Combat" }]), "battleData");
  assert.equal(selectUsageCapture([], []), null);
});

test("selects only captures matching the active format and can prefer a historical source", () => {
  assert.equal(selectUsageCapture([{ name: "Protect" }], [{ name: "Close Combat" }], {
    formats: { metaRoll: "Singles", battleData: "Doubles" },
  }), "battleData");
  assert.equal(selectUsageCapture([{ name: "Protect" }], [{ name: "Close Combat" }], {
    formats: { metaRoll: "Doubles", battleData: "Doubles" },
    preferredSource: "battleData",
  }), "battleData");
  assert.equal(selectUsageCapture([{ name: "Protect" }], [{ name: "Close Combat" }], {
    formats: { metaRoll: "Singles", battleData: "Singles" },
  }), null);
  assert.equal(selectUsageCapture([{ name: "Protect" }], [], { periodMode: "history" }), "battleData");
  assert.equal(selectUsageCapture([{ name: "Protect" }], null, { periodMode: "history" }), null);
});

test("does not substitute a distribution from a different season", () => {
  assert.equal(selectUsageCapture([{ name: "Protect" }], [{ name: "Close Combat" }], {
    seasons: { metaRoll: "M-8", battleData: "Current" },
    activeSeason: "Current",
  }), "battleData");
  assert.equal(selectUsageCapture([{ name: "Protect" }], [], {
    seasons: { metaRoll: "M-8" },
    activeSeason: "Current",
  }), null);
  assert.equal(selectUsageCapture([{ name: "Protect" }], [], {
    seasons: { metaRoll: "Current" },
    activeSeason: "Current",
  }), "metaRoll");
  assert.equal(selectUsageCapture([{ name: "Protect" }], [], {
    seasons: { metaRoll: "Current" },
  }), null);
});

const resolvePokemon = ({ id, name }) => {
  const key = String(id || name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ({ vivillonfancy: { slug: "vivillon-fancy", types: ["Bug", "Flying"] } })[key] || null;
};

test("unifies species by exact form, picks one published position, and unions search fields", () => {
  const catalog = mergeUsageCatalog({
    format: "Doubles", season: "Current", generatedAt: null,
    pokemon: [
      { name: "Vivillon-Fancy", showdownId: "vivillonfancy", position: 4, types: [], filterValues: { moves: ["Hurricane"] } },
      { name: "Garchomp", showdownId: "garchomp", position: null, types: ["Dragon", "Ground"], filterValues: {} },
    ],
  }, {
    format: "doubles", season: "M-8",
    entries: [
      { id: "vivillonfancy", name: "Vivillon-Fancy", rank: 6, filterValues: { abilities: ["Compound Eyes"] } },
      { id: "vivillon", name: "Vivillon", rank: 1, filterValues: {} },
    ],
  }, resolvePokemon);

  assert.equal(catalog.length, 3);
  const fancy = catalog.find((entry) => entry.key === "form:vivillonfancy");
  assert.equal(fancy.displayRank, 6);
  assert.equal(fancy.displaySource, "metaRoll");
  assert.deepEqual(fancy.types, ["Bug", "Flying"]);
  assert.deepEqual(fancy.filterValues, { moves: ["Hurricane"], items: [], abilities: ["Compound Eyes"] });
  assert.equal(fancy.battleData.season, "Current");
  assert.equal(fancy.metaRoll.season, "M-8");
});

test("keeps positions from unmatched species out of the preferred provider ranking", () => {
  const catalog = mergeUsageCatalog({
    format: "Doubles",
    pokemon: [{ name: "Garchomp", showdownId: "garchomp", position: 1, filterValues: {} }],
  }, {
    format: "Doubles",
    entries: [{ id: "sneasler", name: "Sneasler", rank: 4, filterValues: {} }],
  });

  assert.equal(catalog.find((entry) => entry.name === "Sneasler").displayRank, 4);
  assert.equal(catalog.find((entry) => entry.name === "Garchomp").displayRank, null);
  assert.equal(catalog.find((entry) => entry.name === "Garchomp").displaySource, "battleData");
});

test("deduplicates the same distribution and selects one source value without averaging", () => {
  const rows = mergeCategoryRows({
    categoryId: "move",
    formats: { battleData: "Doubles", metaRoll: "doubles" },
    contexts: { battleData: { season: "Current", capturedAt: "2026-10-30" }, metaRoll: { season: "M-8", capturedAt: "2026-11-06" } },
    battleRows: [{ rank: 1, name: "Dire Claw", percentage: "79.1%", percentageValue: 79.1 }],
    metaRows: [{ rank: 2, name: "dire-claw", percentage: "79.4%", percentageValue: 79.4 }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].selectedSource, "metaRoll");
  assert.equal(rows[0].selected.percentageValue, 79.4);
  assert.equal(rows[0].selected.rank, 2);
  assert.equal(rows[0].observations.battleData.percentageValue, 79.1);
  assert.equal(rows[0].observations.metaRoll.season, "M-8");
});

test("keeps zero distinct from a missing percentage and requires complete spreads to deduplicate", () => {
  const rows = mergeCategoryRows({
    categoryId: "stat_points",
    formats: { battleData: "Doubles", metaRoll: "doubles" },
    battleRows: [{ rank: 1, statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 }, percentageValue: 15 }],
    metaRows: [
      { rank: 1, statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 }, percentageValue: 0 },
      { rank: 2, statPoints: { hp: 2, attack: 32, defense: null, spAttack: 0, spDefense: 0, speed: 32 }, percentageValue: null },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].selected.percentageValue, 0);
  assert.equal(rows[0].selectedSource, "metaRoll");
  assert.equal(rows[1].selected.percentageValue, null);
  assert.equal(rows[1].statPoints.defense, null);
});

test("does not select a row from a different format", () => {
  const rows = mergeCategoryRows({
    categoryId: "ability",
    formats: { battleData: "Doubles", metaRoll: "Singles" },
    battleRows: [{ rank: 1, name: "Intimidate", percentageValue: 30 }],
    metaRows: [{ rank: 1, name: "Intimidate", percentageValue: 40 }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].selectedSource, "battleData");
  assert.equal(rows[0].selected.percentageValue, 30);
});

test("uses the selected capture season without mixing it with the other season", () => {
  const rows = mergeCategoryRows({
    categoryId: "ability",
    contexts: { battleData: { season: "Current" }, metaRoll: { season: "M-8" } },
    battleRows: [{ rank: 1, name: "Intimidate", percentageValue: 30 }],
    metaRows: [{ rank: 1, name: "Intimidate", percentageValue: 40 }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].selected.percentageValue, 40);
  assert.equal(rows[0].selected.season, "M-8");
});

test("orders unmatched distributions after the preferred capture without comparing their ranks", () => {
  const rows = mergeCategoryRows({
    categoryId: "move",
    battleRows: [{ rank: 1, name: "Protect", percentageValue: 50 }],
    metaRows: [{ rank: 4, name: "Close Combat", percentageValue: 40 }],
  });

  assert.deepEqual(rows.map((row) => row.name), ["Close Combat", "Protect"]);
  assert.equal(rows[1].selectedSource, "battleData");
});

test("shows up to 15 partner ranks from one capture and falls back only when the preferred capture has none", () => {
  const rows = Array.from({ length: 18 }, (_, index) => ({
    name: `Partner ${index + 1}`,
    selectedSource: "metaRoll",
    selected: { rank: index + 1 },
    observations: {
      metaRoll: { source: "metaRoll", rank: index + 1 },
      battleData: { source: "battleData", rank: 18 - index },
    },
  }));
  rows.push(
    { name: "No published rank", observations: { metaRoll: { rank: null }, battleData: { rank: null } } },
    { name: "Zero is not a position", observations: { metaRoll: { rank: 0 }, battleData: { rank: 0 } } },
    { name: "", observations: { metaRoll: { rank: 1 }, battleData: { rank: 1 } } },
  );

  const metaRollPartners = selectRankedPartnerRows(rows);
  assert.equal(metaRollPartners.length, 15);
  assert.deepEqual(metaRollPartners.map((row) => row.selected.rank), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.ok(metaRollPartners.every((row) => row.selectedSource === "metaRoll"));

  const battleOnly = rows.map((row) => ({
    ...row,
    observations: { metaRoll: { rank: null }, battleData: row.observations.battleData },
  }));
  const battlePartners = selectRankedPartnerRows(battleOnly);
  assert.ok(battlePartners.every((row) => row.selectedSource === "battleData"));
  assert.deepEqual(battlePartners.map((row) => row.selected.rank), Array.from({ length: 15 }, (_, index) => index + 1));
});

test("keeps whichever catalog responded when the other index failed", () => {
  const catalog = mergeUsageCatalog(null, {
    format: "doubles",
    entries: [{ id: "garchomp", name: "Garchomp", rank: 1, filterValues: {} }],
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].battleData, null);
  assert.equal(catalog[0].displayRank, 1);
});

test("does not place a catalog from another format in the active Doubles index", () => {
  const catalog = mergeUsageCatalog({
    format: "Singles",
    pokemon: [{ name: "Garchomp", showdownId: "garchomp", position: 1, filterValues: {} }],
  }, {
    format: "doubles",
    entries: [{ id: "garchomp", name: "Garchomp", rank: 2, filterValues: {} }],
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].displaySource, "metaRoll");
  assert.equal(catalog[0].battleData, null);
});
