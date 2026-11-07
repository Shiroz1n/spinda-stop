import assert from "node:assert/strict";
import { test } from "node:test";
import { getCompetitionPhase, getRankedRegulationPhase, megaEvolutionBattle, rankedRegulation } from "../src/data/championsCompetition.js";

test("official competition status follows the published UTC boundaries", () => {
  assert.equal(getCompetitionPhase(Date.parse("2026-11-06T01:59:59Z")), "upcoming");
  assert.equal(getCompetitionPhase(Date.parse(megaEvolutionBattle.entryStartsAt)), "registration-open");
  assert.equal(getCompetitionPhase(Date.parse(megaEvolutionBattle.startsAt)), "in-progress");
  assert.equal(getCompetitionPhase(Date.parse(megaEvolutionBattle.endsAt)), "ended");
});

test("ranked regulation status never remains current past its published end date", () => {
  assert.equal(getRankedRegulationPhase(Date.parse("2026-11-03T23:59:59Z")), "upcoming");
  assert.equal(getRankedRegulationPhase(Date.parse(rankedRegulation.startsAt)), "current");
  assert.equal(getRankedRegulationPhase(Date.parse(rankedRegulation.endsAt)), "ended");
});
