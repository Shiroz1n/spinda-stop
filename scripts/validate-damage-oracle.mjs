import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { calculateChampionsDamage } from "../apps/web/src/data/damageCalculator.js";
const SHOWDOWN_COMMIT = "f0e61e58ad297885578231746036438e1b42f40a";
const showdownRoot = process.env.POKEMON_SHOWDOWN_ROOT;
if (!showdownRoot) throw new Error("Defina POKEMON_SHOWDOWN_ROOT para a cópia compilada de Pokémon Showdown.");
const actualCommit = execFileSync("git", ["-C", showdownRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (actualCommit !== SHOWDOWN_COMMIT) throw new Error(`Esperado Pokémon Showdown ${SHOWDOWN_COMMIT}; encontrado ${actualCommit}.`);
const require = createRequire(import.meta.url);
const { Battle } = require(path.join(showdownRoot, "dist/sim"));

const filler = { species: "Snorlax", name: "", item: "", ability: "Immunity", moves: ["Rest"], nature: "Serious", evs: {}, level: 50 };
const toBase = (species) => species.replace(/-Mega(?:-[XYZ])?$/, "");
function makeSet(mon, dex) {
  const species = toBase(mon.species);
  const isMega = species !== mon.species;
  const baseAbility = isMega ? dex.species.get(species).abilities["0"] : mon.ability || "";
  return { species, name: "", item: mon.item || "", ability: baseAbility, moves: [mon.move || "Tackle"], nature: mon.nature || "Serious", evs: { ...(mon.statPoints || {}) }, level: 50 };
}
function setup(input) {
  const formatid = input.gameType === "Singles" ? "gen9championscustomgame" : "gen9championsdoublescustomgame";
  const b = new Battle({ formatid, seed: [1, 2, 3, 4] });
  const attackerSet = makeSet({ ...input.attacker, move: input.move }, b.dex);
  const defenderSet = makeSet(input.defender, b.dex);
  b.setPlayer("p1", { name: "p1", team: [attackerSet, filler] });
  b.setPlayer("p2", { name: "p2", team: [defenderSet, filler] });
  if (b.p1.activeRequest?.teamPreview) {
    b.choose("p1", "team 12");
    b.choose("p2", "team 12");
  }
  const attacker = b.p1.active[0];
  const defender = b.p2.active[0];
  if (/Mega(?:-[XYZ])?$/.test(input.attacker.species)) b.actions.runMegaEvo(attacker);
  if (/Mega(?:-[XYZ])?$/.test(input.defender.species)) b.actions.runMegaEvo(defender);
  attacker.clearBoosts();
  defender.clearBoosts();
  for (const [stat, value] of Object.entries(input.attacker.boosts || {})) if (value) attacker.boostBy({ [stat]: value });
  for (const [stat, value] of Object.entries(input.defender.boosts || {})) if (value) defender.boostBy({ [stat]: value });
  if (input.attacker.status) attacker.setStatus(input.attacker.status);
  if (input.defender.status) defender.setStatus(input.defender.status);
  if (input.weather) b.field.setWeather(({ Sand: "sandstorm", Sun: "sunnyday", Rain: "raindance", Snow: "snowscape", Hail: "hail" })[input.weather], attacker);
  if (input.terrain) b.field.setTerrain(input.terrain.toLowerCase() + "terrain", attacker);
  if (input.defenderSide?.isReflect) b.p2.addSideCondition("reflect", attacker);
  if (input.defenderSide?.isLightScreen) b.p2.addSideCondition("lightscreen", attacker);
  if (input.defenderSide?.isAuroraVeil) b.p2.addSideCondition("auroraveil", attacker);
  if (input.attackerSide?.isHelpingHand) attacker.addVolatile("helpinghand", b.p1.active[1]);
  return { b, attacker, defender };
}
function simulatorRoll(input, roll, hit = 1) {
  const { b, attacker, defender } = setup(input);
  b.random = (min, max) => {
    if (min === 16 && max === undefined) return roll;
    throw new Error("unexpected random call " + min + "," + max);
  };
  let move = b.dex.getActiveMove(input.move);
  move.willCrit = Boolean(input.critical) || Boolean(move.willCrit);
  move.spreadHit = input.gameType !== "Singles"
    && ["allAdjacent", "allAdjacentFoes"].includes(move.target)
    && Number(input.targetsHit ?? 2) > 1;
  if (input.hits && input.hits > 1) {
    move.hits = input.hits;
    move.hit = hit;
  }
  b.activeMove = move;
  b.activePokemon = attacker;
  b.activeTarget = defender;
  b.singleEvent("ModifyType", move, null, attacker, defender, move, move);
  b.singleEvent("ModifyMove", move, null, attacker, defender, move, move);
  move = b.runEvent("ModifyType", attacker, defender, move, move);
  move = b.runEvent("ModifyMove", attacker, defender, move, move);
  if (!b.runEvent("TryMove", attacker, defender, move) || !b.runEvent("TryHit", defender, attacker, move)) return 0;
  if (move.onTryImmunity && !b.singleEvent("TryImmunity", move, {}, defender, attacker, move)) return 0;
  b.singleEvent("PrepareHit", move, {}, defender, attacker, move);
  b.runEvent("PrepareHit", attacker, defender, move);
  b.runEvent("TryPrimaryHit", defender, attacker, move);
  b.forceRandomChance = false;
  return b.actions.getDamage(attacker, defender, move, true) || 0;
}
function sorted(values) { return [...values].sort((a, b) => a - b); }
function compare(label, input, multi = false) {
  const local = calculateChampionsDamage(input);
  let simRolls;
  if (multi) {
    simRolls = local.rollGroups.map((_, hitIndex) =>
      sorted(Array.from({ length: 16 }, (_, roll) => simulatorRoll(input, roll, hitIndex + 1)))
    );
    const calcGroups = local.rollGroups.map(sorted);
    if (JSON.stringify(simRolls) !== JSON.stringify(calcGroups)) {
      throw new Error(label + " multi mismatch: " + JSON.stringify({ simRolls, calcGroups }));
    }
  } else {
    simRolls = sorted(Array.from({ length: 16 }, (_, roll) => simulatorRoll(input, roll)));
    if (JSON.stringify(simRolls) !== JSON.stringify(sorted(local.rolls || []))) {
      throw new Error(label + " mismatch: " + JSON.stringify({ simRolls, calc: local.rolls }));
    }
  }
  const { attacker: simAttacker } = setup(input);
  const battleStats = {
    hp: simAttacker.maxhp,
    atk: simAttacker.storedStats.atk,
    def: simAttacker.storedStats.def,
    spa: simAttacker.storedStats.spa,
    spd: simAttacker.storedStats.spd,
    spe: simAttacker.storedStats.spe,
  };
  if (JSON.stringify(battleStats) !== JSON.stringify(local.attacker.stats)) {
    throw new Error(label + " stat mismatch: " + JSON.stringify({ battleStats, calc: local.attacker.stats }));
  }
  if (/Mega(?:-[XYZ])?$/.test(input.attacker.species) && simAttacker.getAbility().name !== input.attacker.ability) {
    throw new Error(label + " Mega ability mismatch: " + simAttacker.getAbility().name + " vs " + input.attacker.ability);
  }
  return { label, min: local.min, max: local.max, rollGroups: multi ? simRolls.length : 1 };
}

const cases = [
  compare("Doubles Earthquake, one valid target", {
    attacker: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Earthquake", gameType: "Doubles", targetsHit: 1,
  }),
  compare("Doubles Earthquake, two valid targets", {
    attacker: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Earthquake", gameType: "Doubles", targetsHit: 2,
  }),
  compare("Doubles Earthquake, three valid targets", {
    attacker: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Earthquake", gameType: "Doubles", targetsHit: 3,
  }),
  compare("Mega Garchomp, Sand Force, Sand", {
    attacker: { species: "Garchomp-Mega", nature: "Hardy", ability: "Sand Force", item: "Garchompite", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Hardy", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Earthquake", gameType: "Doubles", targetsHit: 2, weather: "Sand",
  }),
  compare("Life Orb + Reflect", {
    attacker: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", item: "Life Orb", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Earthquake", gameType: "Singles", defenderSide: { isReflect: true },
  }),
  compare("Critical Dragon Claw", {
    attacker: { species: "Garchomp", nature: "Modest", ability: "Rough Skin", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Modest", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Dragon Claw", gameType: "Singles", critical: true,
  }),
  compare("Helping Hand + Reflect", {
    attacker: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", statPoints: { atk: 32 } },
    defender: { species: "Garchomp", nature: "Jolly", ability: "Rough Skin" },
    move: "Earthquake", gameType: "Doubles", targetsHit: 2,
    attackerSide: { isHelpingHand: true }, defenderSide: { isReflect: true },
  }),
  compare("Bullet Seed, five hits", {
    attacker: { species: "Rillaboom", nature: "Hardy", ability: "Overgrow", statPoints: { hp: 2, atk: 32, spe: 32 } },
    defender: { species: "Garchomp", nature: "Serious", ability: "Rough Skin", statPoints: { hp: 2 } },
    move: "Bullet Seed", gameType: "Doubles", targetsHit: 1, hits: 5,
  }, true),
];
const comparedRollGroups = cases.reduce((total, result) => total + result.rollGroups, 0);
console.log(`Pokémon Showdown ${SHOWDOWN_COMMIT}: ${cases.length} cenários, ${comparedRollGroups} grupos de 16 rolls conferidos; stats do atacante também coincidem.`);
for (const { label, min, max, rollGroups } of cases) console.log(`- ${label}: ${min}–${max} (${rollGroups} ${rollGroups === 1 ? "grupo" : "grupos"})`);
