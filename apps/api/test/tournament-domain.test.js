import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canLockTournament,
  canStartTournament,
  semifinalPairings,
  shuffleTournamentSeeds,
  validateTournamentName,
} from "../src/tournament-domain.js";

test("tournament names are trimmed and bounded", () => {
  assert.equal(validateTournamentName("  Doubles local  "), "Doubles local");
  assert.equal(validateTournamentName(" "), null);
  assert.equal(validateTournamentName("x".repeat(49)), null);
});

test("only a full checked-in field can lock and start a tournament", () => {
  assert.equal(canLockTournament("open", 4, 4), true);
  assert.equal(canLockTournament("open", 3, 3), false);
  assert.equal(canLockTournament("open", 4, 3), false);
  assert.equal(canLockTournament("locked", 4, 4), false);
  assert.equal(canStartTournament("locked", 4), true);
  assert.equal(canStartTournament("open", 4), false);
  assert.equal(canStartTournament("locked", 3), false);
});

test("the seeded bracket pairs first with fourth and second with third", () => {
  const seeded = shuffleTournamentSeeds(["a", "b", "c", "d"], (max) => max - 1);
  assert.deepEqual(seeded, [
    { userId: "a", seed: 1 },
    { userId: "b", seed: 2 },
    { userId: "c", seed: 3 },
    { userId: "d", seed: 4 },
  ]);
  assert.deepEqual(semifinalPairings(seeded), [["a", "d"], ["b", "c"]]);
  assert.equal(semifinalPairings(seeded.slice(1)), null);
});
