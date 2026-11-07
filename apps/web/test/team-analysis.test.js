import test from "node:test";
import assert from "node:assert/strict";
import { calculateTeamAnalysis } from "../src/data/teamAnalysis.js";

test("calculates dual-type defenses and only recognizes equipped damaging moves", () => {
  const team = { members: [
    { pokemonId: "garchomp", moves: ["Earthquake", "Protect", "Unknown Move", ""] },
    { pokemonId: "rotom-wash", moves: ["Hydro Pump", "Thunderbolt", ""] },
    null, null, null, null,
  ] };
  const pokemon = [
    { slug: "garchomp", name: "Garchomp", types: ["dragon", "ground"] },
    { slug: "rotom-wash", name: "Rotom-Wash", types: ["electric", "water"] },
  ];
  const moves = [
    { name: "Earthquake", type: "ground", category: "physical" },
    { name: "Protect", type: "normal", category: "status" },
    { name: "Hydro Pump", type: "water", category: "special" },
    { name: "Thunderbolt", type: "electric", category: "special" },
  ];

  const analysis = calculateTeamAnalysis(team, pokemon, moves);
  assert.equal(analysis.filledSlots, 2);
  assert.equal(analysis.equippedMoveCount, 3);
  assert.deepEqual(analysis.attackTypes, ["ground", "water", "electric"]);
  assert.equal(analysis.weaknesses.find(({ type }) => type === "ice").counts[0][0], 4);
  assert.ok(analysis.immunities.some(({ type, counts }) => type === "electric" && counts[0][0] === 0));
  assert.equal(analysis.coverage.find(({ type }) => type === "fire").multiplier, 2);
  assert.equal(analysis.blindSpots.includes("fire"), false);
});
