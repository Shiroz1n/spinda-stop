import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMetaRollLadderResponse,
  normalizeMetaRollIndexResponse,
  normalizeMetaRollPokemonResponse,
} from "../src/data/usage/providers/metaroll.js";

test("normalizes MetaRoll all entries and uses their fields for filters", () => {
  const result = normalizeMetaRollIndexResponse({
    version: 1,
    game: "Pokémon Champions",
    source: "in-game ranked ladder",
    format: "doubles",
    season: "M-7",
    capturedAt: "2026-10-18T05:46:15.000Z",
    comparedTo: "2026-10-17T05:46:13.000Z",
    count: 262,
    pastSeasons: ["M-6"],
    entries: [{
      id: "examplemon",
      name: "Examplemon",
      rank: 8,
      previousRank: 10,
      abilities: [{ name: "Intimidate", percent: 54.6 }],
      items: [{ name: "Sitrus Berry", percent: 30 }],
      moves: [{ name: "Protect", percent: 77.2 }],
      natures: [{ name: "Adamant", percent: 60 }],
      teammates: [{ name: "Farigiraf", percent: null }],
      spreads: [{
        statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
        percent: 29.1,
      }],
    }],
  });

  assert.equal(result.season, "M-7");
  assert.equal(result.count, 262);
  assert.equal(result.entries[0].rank, 8);
  assert.deepEqual(result.entries[0].filterValues, {
    abilities: ["Intimidate"],
    items: ["Sitrus Berry"],
    moves: ["Protect"],
  });
  assert.equal(result.entries[0].distributions.teammates[0].percent, null);
  assert.equal(result.entries[0].distributions.spreads[0].statPoints.attack, 32);
  assert.equal(Object.hasOwn(result, "sampleSize"), false);
  assert.equal(Object.hasOwn(result, "regulation"), false);
});

test("normalizes separate daily rank and usage histories", () => {
  const result = normalizeMetaRollPokemonResponse({
    version: 1,
    game: "Pokémon Champions",
    source: "in-game ranked ladder",
    format: "doubles",
    season: "M-7",
    capturedAt: "2026-10-18T05:46:15.000Z",
    comparedTo: "2026-10-17T05:46:13.000Z",
    count: 262,
    entry: {
      id: "examplemon",
      name: "Examplemon",
      rank: 8,
      previousRank: 10,
      rankHistory: [{ d: "2026-10-17", r: 10 }, { d: "2026-10-18", r: 8 }],
      usageHistory: [{
        d: "2026-10-18",
        m: { Protect: 77.2 },
        i: { "Sitrus Berry": 30 },
        a: { Intimidate: 54.6 },
      }],
      abilities: [{ name: "Intimidate", percent: 54.6 }],
      items: [{ name: "Sitrus Berry", percent: 30 }],
      moves: [{ name: "Protect", percent: 77.2 }],
      natures: [],
      teammates: [{ name: "Farigiraf", percent: null }],
      spreads: [],
      confidence: { formGuessed: false, identifiedByElimination: false },
    },
  });

  assert.deepEqual(result.entry.rankHistory, [
    { date: "2026-10-17", rank: 10 },
    { date: "2026-10-18", rank: 8 },
  ]);
  assert.equal(result.entry.usageHistory[0].moves[0].name, "Protect");
  assert.equal(result.entry.usageHistory[0].items[0].percentageValue, 30);
  assert.equal(result.entry.rank, 8);
});

test("does not fill in history, percentages, or metadata the source omits", () => {
  const result = normalizeMetaRollIndexResponse({
    capturedAt: "2026-10-18T05:46:15.000Z",
    format: "doubles",
    entries: [{ id: "examplemon", name: "Examplemon", teammates: [{ name: "Partner", percent: null }] }],
  });

  assert.deepEqual(result.entries[0].rankHistory, []);
  assert.equal(result.entries[0].rank, null);
  assert.equal(result.entries[0].distributions.teammates[0].percent, null);
  assert.equal(result.entries[0].distributions.moves.length, 0);
  assert.equal(result.attribution, null);
});

test("normalizes MetaRoll matchups without turning their percentages into win rates", () => {
  const result = normalizeMetaRollPokemonResponse({
    format: "doubles",
    season: "M-7",
    capturedAt: "2026-10-18T05:46:15.000Z",
    entry: {
      id: "tauros-paldea-aqua",
      name: "Tauros-Paldea-Aqua",
      matchups: {
        beats: ["Sneasler", "Sylveon"],
        beatsGames: [12, null],
        losesTo: ["Basculegion"],
        losesToGames: [4],
        beatsWith: [{ name: "Earthquake", percent: 48.2 }],
        beatenBy: [{ name: "Blizzard", percent: 6.2 }],
      },
    },
  });

  assert.deepEqual(result.entry.matchups, {
    beats: [{ name: "Sneasler", games: 12 }, { name: "Sylveon", games: null }],
    losesTo: [{ name: "Basculegion", games: 4 }],
    beatsWith: [{ name: "Earthquake", percent: 48.2, percentageValue: 48.2 }],
    beatenBy: [{ name: "Blizzard", percent: 6.2, percentageValue: 6.2 }],
  });
  assert.equal(Object.hasOwn(result.entry.matchups, "winRate"), false);
});

test("normalizes the separate Doubles trainer ladder and keeps missing values unknown", () => {
  const result = normalizeMetaRollLadderResponse({
    source: "in-game ranked ladder",
    format: "doubles",
    ranks: "trainers",
    capturedAt: "2026-10-18T08:16:09.000Z",
    comparedTo: "2026-10-17T06:25:09.000Z",
    count: 1000,
    entries: [
      {
        rank: 1,
        previousRank: 4,
        id: "public-player-id",
        name: "Player One",
        rating: 2275.236,
        wins: 262,
        losses: 154,
        draws: 0,
        battles: 416,
        winRate: 63,
        country: { code: 509, name: "Thailand", flag: "🇹🇭", iso: "th" },
        language: { code: 20, name: "English", flag: "🇺🇸", iso: "us" },
        avatar: 22,
      },
      { rank: 2, id: "another-player", name: "Player Two", previousRank: null },
      { rank: 3, id: "new-player", name: "Player Three" },
    ],
  });

  assert.equal(result.format, "doubles");
  assert.equal(result.ranks, "trainers");
  assert.equal(result.count, 1000);
  assert.equal(result.season, null);
  assert.equal(result.entries[0].rating, 2275.236);
  assert.equal(result.entries[0].battles, 416);
  assert.equal(result.entries[0].winRate, 63);
  assert.equal(result.entries[0].country.iso, "th");
  assert.equal(result.entries[0].avatar, 22);
  assert.equal(result.entries[1].previousRank, null);
  assert.equal(Object.hasOwn(result.entries[2], "previousRank"), false);
  assert.equal(result.entries[2].winRate, null);
  assert.throws(() => normalizeMetaRollLadderResponse({ format: "singles", ranks: "trainers", entries: [] }), /Doubles/);
});
