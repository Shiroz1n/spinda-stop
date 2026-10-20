import test from "node:test";
import assert from "node:assert/strict";
import { buildDamageCalculatorSearch, calculateChampionsDamage, calculateChampionsStats, calculateDamageAgainstTargets, calculateDamageFromTeamAgainstTarget, cloneDamageScenario, getDamageCatalogOptions, getDamageItemSupport, getDamageMove, getDamageSpeciesName, getHitOptions } from "../src/data/damageCalculator.js";

const side = (species, options = {}) => ({
  species,
  nature: options.nature || "Serious",
  ability: options.ability || "",
  item: options.item || "",
  status: "",
  statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...options.statPoints },
  boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
});

test("as Natures reais mudam stats e dano, sem aplicar modificador ao HP", () => {
  const base = side("Garchomp", { statPoints: { atk: 32, spe: 32 } });
  const statsFor = (nature) => calculateChampionsStats({ ...base, nature });
  const serious = statsFor("Serious");
  const adamant = statsFor("Adamant");
  const jolly = statsFor("Jolly");
  const timid = statsFor("Timid");
  const brave = statsFor("Brave");
  const modest = statsFor("Modest");

  assert.equal(adamant.hp, serious.hp);
  assert.equal(jolly.hp, serious.hp);
  assert.equal(timid.hp, serious.hp);
  assert.equal(brave.hp, serious.hp);
  assert.equal(modest.hp, serious.hp);
  assert.ok(adamant.atk > serious.atk);
  assert.ok(adamant.spa < serious.spa);
  assert.ok(jolly.spe > serious.spe);
  assert.ok(jolly.spa < serious.spa);
  assert.ok(timid.spe > serious.spe);
  assert.ok(timid.atk < serious.atk);
  assert.ok(brave.atk > serious.atk);
  assert.ok(brave.spe < serious.spe);
  assert.ok(modest.spa > serious.spa);
  assert.ok(modest.atk < serious.atk);

  const seriousDamage = calculateChampionsDamage({ attacker: base, defender: side("Garchomp"), move: "Earthquake" });
  const adamantDamage = calculateChampionsDamage({ attacker: { ...base, nature: "Adamant" }, defender: side("Garchomp"), move: "Earthquake" });
  assert.equal(seriousDamage.rolls.length, 16);
  assert.equal(adamantDamage.rolls.length, 16);
  assert.ok(adamantDamage.max > seriousDamage.max);
});

test("a prévia de stats ignora item e habilidade desconhecidos sem perder a Nature", () => {
  const base = side("Garchomp", { nature: "Jolly", statPoints: { atk: 8, spe: 32 } });
  const expected = calculateChampionsStats(base);
  const freeTextBattleFields = calculateChampionsStats({
    ...base,
    ability: "Habilidade criada pelo usuário",
    item: "Clear Amulet",
  });
  const adamant = calculateChampionsStats({ ...base, nature: "Adamant" });

  assert.deepEqual(freeTextBattleFields, expected);
  assert.equal(freeTextBattleFields.hp, expected.hp);
  assert.ok(adamant.atk > expected.atk);
  assert.ok(adamant.spe < expected.spe);
});

test("confere a faixa do caso público exibido no Pokémon Showdown", () => {
  const result = calculateChampionsDamage({
    attacker: side("Absol-Mega-Z", {
      nature: "Jolly",
      ability: "Justified",
      item: "Absolite Z",
      statPoints: { atk: 31, spe: 32 },
    }),
    defender: side("Absol-Mega-Z", {
      nature: "Jolly",
      ability: "Justified",
      item: "Absolite Z",
      statPoints: { def: 3 },
    }),
    gameType: "Singles",
    move: "Shadow Claw",
  });

  assert.deepEqual([result.min, result.max], [99, 117]);
  assert.equal(result.rolls.length, 16);
});

test("Doubles aplica o dano em área para Earthquake, Singles não", () => {
  const attacker = side("Garchomp");
  const defender = side("Garchomp");
  const singles = calculateChampionsDamage({ attacker, defender, gameType: "Singles", move: "Earthquake" });
  const doubles = calculateChampionsDamage({ attacker, defender, gameType: "Doubles", move: "Earthquake" });

  assert.deepEqual([singles.min, singles.max], [75, 88]);
  assert.deepEqual([doubles.min, doubles.max], [55, 66]);
  assert.equal(doubles.isSpread, true);
  assert.ok(doubles.activeModifiers.some(({ label, factor }) => label === "Golpe em área" && factor === "0,75× no dano base"));
});

test("Doubles só aplica o redutor de área quando o cenário tem mais de um alvo válido", () => {
  const input = { attacker: side("Garchomp"), defender: side("Garchomp"), move: "Earthquake", gameType: "Doubles" };
  const oneTarget = calculateChampionsDamage({ ...input, targetsHit: 1 });
  const twoTargets = calculateChampionsDamage({ ...input, targetsHit: 2 });
  const threeTargets = calculateChampionsDamage({ ...input, targetsHit: 3 });

  assert.equal(oneTarget.isSpreadTarget, true);
  assert.equal(oneTarget.isSpread, false);
  assert.equal(oneTarget.targetsHit, 1);
  assert.deepEqual([oneTarget.min, oneTarget.max], [75, 88]);
  assert.equal(oneTarget.activeModifiers.some(({ label }) => label === "Golpe em área"), false);
  assert.equal(twoTargets.isSpread, true);
  assert.equal(threeTargets.isSpread, true);
  assert.deepEqual([twoTargets.min, twoTargets.max], [55, 66]);
  assert.deepEqual([threeTargets.min, threeTargets.max], [55, 66]);
  assert.equal(twoTargets.rolls.length, 16);
  assert.ok(twoTargets.activeModifiers.some(({ label, factor }) => label === "Golpe em área" && factor === "0,75× no dano base"));
});

test("o cenário de um alvo mantém os 16 rolls do simulador sem o redutor de área", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", { nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2, atk: 32, spe: 32 } }),
    defender: side("Garchomp", { nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2 } }),
    move: "Earthquake",
    gameType: "Doubles",
    targetsHit: 1,
  });

  assert.deepEqual(result.attacker.stats, { hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
  assert.deepEqual(result.rolls, [90, 91, 91, 93, 94, 94, 96, 97, 99, 99, 100, 102, 102, 103, 105, 106]);
});

test("golpe de alvo único não recebe redutor de área em Doubles", () => {
  const input = { attacker: side("Garchomp"), defender: side("Garchomp"), move: "Shadow Claw" };
  const singles = calculateChampionsDamage({ ...input, gameType: "Singles" });
  const doubles = calculateChampionsDamage({ ...input, gameType: "Doubles" });

  assert.equal(doubles.isSpreadTarget, false);
  assert.equal(doubles.isSpread, false);
  assert.deepEqual([doubles.min, doubles.max], [singles.min, singles.max]);
});

test("não aceita mais alvos do que o padrão do golpe permite", () => {
  assert.throws(() => calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    move: "Rock Slide",
    gameType: "Doubles",
    targetsHit: 3,
  }), /1 a 2 alvos/);
});

test("converte Stat Points em stats de nível 50 no caso cruzado com OP.GG", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    defender: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      item: "Garchompite Z",
      statPoints: { hp: 2 },
    }),
    gameType: "Singles",
    move: "Earthquake",
  });

  assert.deepEqual(result.attacker.stats, { hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
  assert.deepEqual([result.min, result.max], [90, 106]);
});

test("reproduz o caso OP.GG com Life Orb, Reflect e nature diferente", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", {
      nature: "Modest",
      ability: "Rough Skin",
      item: "Life Orb",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    defender: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      item: "Garchompite Z",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    gameType: "Singles",
    move: "Earthquake",
    defenderSide: { isReflect: true },
  });

  assert.deepEqual(result.attacker.stats, { hp: 185, atk: 163, def: 115, spa: 110, spd: 105, spe: 154 });
  assert.deepEqual([result.min, result.max], [53, 62]);
  assert.ok(result.activeModifiers.some(({ label, factor }) => label === "Item do atacante" && factor.startsWith("Life Orb")));
  assert.ok(result.activeModifiers.some(({ label, factor }) => label === "Reflect" && factor.startsWith("0,5×")));
});

test("reproduz a forma Mega de Garchomp e a faixa pública com Reflect", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp-Mega", {
      nature: "Modest",
      ability: "Sand Force",
      item: "Garchompite",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    defender: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      item: "Garchompite Z",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    gameType: "Singles",
    move: "Earthquake",
    defenderSide: { isReflect: true },
  });

  assert.deepEqual(result.attacker.stats, { hp: 185, atk: 199, def: 135, spa: 154, spd: 115, spe: 144 });
  assert.deepEqual([result.min, result.max], [49, 58]);
});

test("reproduz a faixa Doubles pública do Earthquake contra um alvo", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      item: "Garchompite Z",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    defender: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      item: "Garchompite Z",
      statPoints: { hp: 2 },
    }),
    gameType: "Doubles",
    move: "Earthquake",
  });

  assert.deepEqual([result.min, result.max], [67, 79]);
  assert.equal(result.rolls.length, 16);
  assert.deepEqual(result.rolls, [67, 67, 69, 69, 70, 70, 72, 72, 73, 73, 75, 75, 76, 76, 78, 79]);
  assert.equal(result.koProbabilities, null);
  assert.ok(result.koProbabilityNotes.some((note) => note.includes("item")));
});

test("identifica os modificadores de campo que o motor realmente aplicou", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", { ability: "Rough Skin", statPoints: { atk: 32 } }),
    defender: side("Garchomp"),
    gameType: "Doubles",
    move: "Earthquake",
    attackerSide: { isHelpingHand: true },
    defenderSide: { isReflect: true, isFriendGuard: true },
  });
  const modifiers = Object.fromEntries(result.activeModifiers.map(({ label, factor }) => [label, factor]));

  assert.equal(modifiers["Golpe em área"], "0,75× no dano base");
  assert.equal(modifiers["Helping Hand"], "1,5× no poder base");
  assert.equal(modifiers.Reflect, "2732/4096 (~0,667×) no dano final");
  assert.equal(modifiers["Friend Guard"], "0,75× no dano final");
  assert.equal(modifiers.STAB, "1,5×");
});

test("crítico é mostrado somente quando o motor o aplicou", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    move: "Shadow Claw",
    critical: true,
  });

  assert.ok(result.activeModifiers.some(({ label }) => label === "Crítico aplicado"));

  const canceled = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp", { ability: "Battle Armor" }),
    move: "Shadow Claw",
    critical: true,
  });
  assert.equal(canceled.activeModifiers.some(({ label }) => label === "Crítico aplicado"), false);
});

test("Dragon Claw com crítico bate a faixa pública e informa o fator configurado", () => {
  const input = {
    attacker: side("Garchomp", { nature: "Modest", statPoints: { hp: 2, atk: 32, spe: 32 } }),
    defender: side("Garchomp", { nature: "Modest", statPoints: { hp: 2, atk: 32, spe: 32 } }),
    move: "Dragon Claw",
    gameType: "Singles",
  };
  const normal = calculateChampionsDamage(input);
  const critical = calculateChampionsDamage({ ...input, critical: true });

  assert.deepEqual([normal.min, normal.max], [128, 152]);
  assert.deepEqual([critical.min, critical.max], [192, 228]);
  assert.ok(critical.activeModifiers.some(({ label, factor }) => label === "Crítico aplicado" && factor === "1,5× no dano base"));
});

test("golpe multi-hit usa apenas quantidades permitidas pela entrada do motor", () => {
  assert.deepEqual(getHitOptions(getDamageMove("Bullet Seed")), [2, 3, 4, 5]);
  assert.deepEqual(getHitOptions(getDamageMove("Pin Missile")), [2, 3, 4, 5]);

  const result = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    gameType: "Doubles",
    move: "Bullet Seed",
    hits: 2,
  });

  assert.equal(result.hits, 2);
  assert.equal(result.hitRanges.length, 2);
  assert.equal(result.rollGroups.length, 2);
  assert.ok(result.rollGroups.every((rolls) => rolls.length === 16));
  assert.deepEqual(result.rollGroupLabels, ["Acerto 1", "Acerto 2"]);
  assert.equal(result.rolls, null);
  assert.equal(result.koProbabilities, null);
  assert.ok(result.min > 0);

  const referenceCase = calculateChampionsDamage({
    attacker: side("Rillaboom", { nature: "Hardy", statPoints: { hp: 2, atk: 32, spe: 32 } }),
    defender: side("Garchomp", { statPoints: { hp: 2 } }),
    gameType: "Doubles",
    move: "Bullet Seed",
    hits: 5,
  });
  assert.deepEqual([referenceCase.min, referenceCase.max], [110, 135]);
  assert.deepEqual(referenceCase.hitRanges, [[22, 27], [22, 27], [22, 27], [22, 27], [22, 27]]);
});

test("Sand Force e Sand aplicam a faixa pública de Earthquake em Mega Garchomp", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp-Mega", {
      nature: "Hardy",
      ability: "Sand Force",
      item: "Garchompite",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    defender: side("Garchomp", { nature: "Hardy", statPoints: { hp: 2 } }),
    move: "Earthquake",
    gameType: "Doubles",
    weather: "Sand",
  });

  assert.deepEqual([result.min, result.max], [106, 126]);
  assert.deepEqual(result.attacker.stats, { hp: 185, atk: 222, def: 135, spa: 140, spd: 115, spe: 144 });
  assert.ok(result.activeModifiers.some(({ label, factor }) => label === "Habilidade do atacante" && factor.startsWith("Sand Force")));
});

test("Parental Bond identifica o golpe adicional sem classificá-lo como acerto configurado", () => {
  const result = calculateChampionsDamage({
    attacker: side("Kangaskhan-Mega", { ability: "Parental Bond", item: "Kangaskhanite" }),
    defender: side("Garchomp"),
    move: "Double-Edge",
    hits: 1,
  });

  assert.equal(result.hasParentalBondFollowUp, true);
  assert.deepEqual(result.rollGroupLabels, ["Golpe principal", "Golpe adicional de Parental Bond"]);
  assert.equal(result.koProbabilities, null);
});

test("Proteção zerada e Proteção atravessada exibem semânticas diferentes", () => {
  const blocked = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    move: "Close Combat",
    defenderSide: { isProtected: true },
  });
  const pierced = calculateChampionsDamage({
    attacker: side("Garchomp", { ability: "Unseen Fist" }),
    defender: side("Garchomp"),
    move: "Close Combat",
    defenderSide: { isProtected: true },
  });

  assert.deepEqual([blocked.min, blocked.max], [0, 0]);
  assert.ok(blocked.activeModifiers.some(({ label }) => label === "Proteção"));
  assert.ok(pierced.min > 0);
  assert.ok(pierced.activeModifiers.some(({ label, factor }) => label === "Proteção atravessada" && factor === "0,25× no dano final"));
});

test("a chance condicional de 2HKO reproduz 237/256 no caso cruzado com OP.GG", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      statPoints: { hp: 2, atk: 32, spe: 32 },
    }),
    defender: side("Garchomp", {
      nature: "Jolly",
      ability: "Rough Skin",
      statPoints: { hp: 2 },
    }),
    move: "Earthquake",
    gameType: "Singles",
  });

  assert.deepEqual(result.rolls, [90, 91, 91, 93, 94, 94, 96, 97, 99, 99, 100, 102, 102, 103, 105, 106]);
  assert.equal(result.defender.stats.hp, 185);
  assert.deepEqual(result.koProbabilities, { ohko: { successes: 0, total: 16 }, twoHit: { successes: 237, total: 256 } });
});

test("omite 2HKO para golpe em área em Doubles porque o número de alvos pode mudar", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp", { nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2, atk: 32, spe: 32 } }),
    defender: side("Garchomp", { nature: "Jolly", ability: "Rough Skin", statPoints: { hp: 2 } }),
    move: "Earthquake",
    gameType: "Doubles",
    targetsHit: 2,
  });

  assert.deepEqual([result.min, result.max], [67, 79]);
  assert.equal(result.koProbabilities?.twoHit, null);
  assert.ok(result.koProbabilityNotes.some((note) => note.includes("quantidade de alvos")));
});

test("omite probabilidades de KO quando o cenário muda entre os turnos", () => {
  const weather = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    move: "Earthquake",
    weather: "Sand",
  });
  const sturdy = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp", { ability: "Sturdy" }),
    move: "Earthquake",
    gameType: "Singles",
  });
  const defaultDisguise = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Mimikyu"),
    move: "Shadow Claw",
  });

  assert.deepEqual(weather.koProbabilities, { ohko: { successes: 0, total: 16 }, twoHit: null });
  assert.ok(weather.koProbabilityNotes.some((note) => note.includes("campo")));
  assert.deepEqual(sturdy.koProbabilities?.ohko, null);
  assert.ok(sturdy.koProbabilities?.twoHit);
  assert.ok(sturdy.koProbabilityNotes.some((note) => note.includes("Sturdy")));
  assert.equal(defaultDisguise.defender.ability, "Disguise");
  assert.equal(defaultDisguise.koProbabilities, null);
  assert.ok(defaultDisguise.koProbabilityNotes.some((note) => note.includes("habilidade do alvo")));
});

test("omite 2HKO quando um golpe de contato ativa Wandering Spirit", () => {
  const input = {
    attacker: side("Azumarill", {
      nature: "Adamant",
      ability: "Huge Power",
      statPoints: { atk: 14 },
    }),
    defender: side("Runerigus", { statPoints: { hp: 2 } }),
    move: "Play Rough",
    gameType: "Singles",
  };
  const contact = calculateChampionsDamage(input);
  const nonContact = calculateChampionsDamage({ ...input, move: "Earthquake" });

  assert.equal(contact.defender.ability, "Wandering Spirit");
  assert.deepEqual([contact.min, contact.max], [58, 69]);
  assert.equal(contact.koProbabilities?.ohko?.total, 16);
  assert.equal(contact.koProbabilities?.twoHit, null);
  assert.ok(contact.koProbabilityNotes.some((note) => note.includes("Wandering Spirit")));
  assert.equal(nonContact.koProbabilities?.twoHit?.total, 256);
});

test("mantém OHKO e omite 2HKO quando Sand Spit muda o clima", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp-Mega", { ability: "Sand Force" }),
    defender: side("Sandaconda", { statPoints: { hp: 4 } }),
    move: "Earthquake",
    gameType: "Singles",
  });

  assert.equal(result.defender.ability, "Sand Spit");
  assert.deepEqual([result.min, result.max], [75, 88]);
  assert.deepEqual(result.koProbabilities, { ohko: { successes: 0, total: 16 }, twoHit: null });
  assert.ok(result.koProbabilityNotes.some((note) => note.includes("Sand Spit") && note.includes("campo")));
});

test("omite 2HKO quando Seed Sower muda o terreno após Wood Hammer", () => {
  const input = {
    attacker: side("Rillaboom", { nature: "Adamant", statPoints: { atk: 32 } }),
    defender: side("Arboliva"),
    move: "Wood Hammer",
    gameType: "Singles",
  };
  const first = calculateChampionsDamage(input);
  const second = calculateChampionsDamage({ ...input, terrain: "Grassy" });
  const pairsAfterTerrainChange = first.rolls.reduce((total, firstRoll) => (
    total + second.rolls.filter((secondRoll) => firstRoll + secondRoll >= first.defender.stats.hp).length
  ), 0);

  assert.equal(first.defender.ability, "Seed Sower");
  assert.deepEqual([first.min, first.max], [60, 71]);
  assert.deepEqual([second.min, second.max], [78, 92]);
  assert.equal(pairsAfterTerrainChange, 83);
  assert.equal(first.koProbabilities?.twoHit, null);
  assert.ok(first.koProbabilityNotes.some((note) => note.includes("Seed Sower") && note.includes("campo")));
});

test("omite 2HKO quando o golpe reduz o atributo ofensivo do próximo uso", () => {
  const attacker = side("Garchomp");
  const defender = side("Glaceon");
  const first = calculateChampionsDamage({ attacker, defender, move: "Draco Meteor", gameType: "Singles" });
  const reducedAttacker = side("Garchomp");
  reducedAttacker.boosts.spa = -2;
  const second = calculateChampionsDamage({ attacker: reducedAttacker, defender, move: "Draco Meteor", gameType: "Singles" });
  const pairsAfterDrop = first.rolls.reduce((total, firstRoll) => (
    total + second.rolls.filter((secondRoll) => firstRoll + secondRoll >= first.defender.stats.hp).length
  ), 0);

  assert.deepEqual([first.min, first.max], [64, 76]);
  assert.deepEqual([second.min, second.max], [33, 39]);
  assert.equal(pairsAfterDrop, 0);
  assert.equal(first.koProbabilities?.twoHit, null);
  assert.ok(first.koProbabilityNotes.some((note) => note.includes("Draco Meteor") && note.includes("atributo ofensivo")));
});

test("valida espécie e Stat Points antes de calcular", () => {
  assert.throws(() => calculateChampionsDamage({
    attacker: side("nome inventado"),
    defender: side("Garchomp"),
    move: "Earthquake",
  }), /catálogo/);

  assert.throws(() => calculateChampionsDamage({
    attacker: side("Garchomp", { statPoints: { atk: -1 } }),
    defender: side("Garchomp"),
    move: "Earthquake",
  }), /Stat Points/);
});

test("sugestões do catálogo são filtradas e limitadas para não renderizar a lista toda", () => {
  assert.deepEqual(getDamageCatalogOptions("species", "garchomp"), ["Garchomp", "Garchomp-Mega", "Garchomp-Mega-Z"]);
  assert.deepEqual(getDamageCatalogOptions("species", ""), []);
  assert.equal(getDamageCatalogOptions("moves", "a").length, 50);
  assert.ok(getDamageCatalogOptions("items", "Clear").includes("Clear Amulet"));
});

test("o link do construtor preserva os dois sets e o golpe escolhido", () => {
  const attacker = side("Garchomp", {
    nature: "Jolly",
    ability: "Rough Skin",
    item: "Life Orb",
    statPoints: { hp: 2, atk: 32, spe: 32 },
  });
  const defender = side("Gardevoir-Mega", {
    nature: "Modest",
    ability: "Pixilate",
    item: "Gardevoirite",
    statPoints: { hp: 4, def: 12, spd: 16 },
  });
  const params = new URLSearchParams(buildDamageCalculatorSearch(attacker, defender, "Earthquake"));

  assert.deepEqual({
    attacker: params.get("attacker"),
    nature: params.get("nature"),
    ability: params.get("ability"),
    item: params.get("item"),
    hp: params.get("sp-hp"),
    atk: params.get("sp-atk"),
    spe: params.get("sp-spe"),
    defender: params.get("defender"),
    defenderNature: params.get("defender-nature"),
    defenderAbility: params.get("defender-ability"),
    defenderItem: params.get("defender-item"),
    defenderHp: params.get("defender-sp-hp"),
    defenderDef: params.get("defender-sp-def"),
    defenderSpd: params.get("defender-sp-spd"),
    move: params.get("move"),
  }, {
    attacker: "Garchomp",
    nature: "Jolly",
    ability: "Rough Skin",
    item: "Life Orb",
    hp: "2",
    atk: "32",
    spe: "32",
    defender: "Gardevoir-Mega",
    defenderNature: "Modest",
    defenderAbility: "Pixilate",
    defenderItem: "Gardevoirite",
    defenderHp: "4",
    defenderDef: "12",
    defenderSpd: "16",
    move: "Earthquake",
  });
});

test("link do builder sem adversário preserva o lado escolhido e não inventa um alvo", () => {
  const params = new URLSearchParams(buildDamageCalculatorSearch(side(getDamageSpeciesName("lucario-mega-z")), null, "Shadow Claw"));
  assert.equal(params.get("attacker"), "Lucario-Mega-Z");
  assert.equal(params.get("defender"), null);
  assert.equal(params.get("move"), "Shadow Claw");
});

test("IDs de forma do catálogo chegam ao motor de dano sem colapsar na espécie base", () => {
  assert.equal(getDamageSpeciesName("garchomp-mega-z"), "Garchomp-Mega-Z");
  assert.equal(getDamageSpeciesName("absol-mega-z"), "Absol-Mega-Z");
  assert.equal(getDamageSpeciesName("raichu-mega-x"), "Raichu-Mega-X");
  assert.notEqual(getDamageSpeciesName("garchomp-mega-z"), getDamageSpeciesName("garchomp"));
});

test("um atacante calcula alvos independentes no mesmo cenário, sem mutar o set compartilhado", () => {
  const input = { attacker: side("Garchomp"), defender: side("Garchomp"), move: "Earthquake", gameType: "Doubles", targetsHit: 1 };
  const before = structuredClone(input);
  const targets = calculateDamageAgainstTargets(input, ["Garchomp", "Gardevoir-Mega", ""]);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map(({ species, result }) => [species, result.min, result.max]), [
    ["Garchomp", 75, 88],
    ["Gardevoir-Mega", 100, 118],
  ]);
  assert.deepEqual(input, before);
});

test("copiar um cenário deixa os dois sets e condições independentes", () => {
  const original = {
    attacker: side("Garchomp", { statPoints: { atk: 32 } }),
    defender: side("Gardevoir-Mega", { item: "Gardevoirite" }),
    attackerSide: { isHelpingHand: true },
    defenderSide: { isReflect: true },
    move: "Earthquake",
    targetsHit: 2,
    weather: "",
  };
  const comparison = cloneDamageScenario(original);
  comparison.attacker.statPoints.atk = 0;
  comparison.defender.species = "Garchomp";
  comparison.attackerSide.isHelpingHand = false;
  comparison.targetsHit = 1;

  assert.equal(original.attacker.statPoints.atk, 32);
  assert.equal(original.defender.species, "Gardevoir-Mega");
  assert.equal(original.attackerSide.isHelpingHand, true);
  assert.equal(original.defenderSide.isReflect, true);
  assert.equal(original.targetsHit, 2);
});

test("golpes sem dano direto não são apresentados como uma faixa de dano", () => {
  const result = calculateChampionsDamage({
    attacker: side("Garchomp"),
    defender: side("Garchomp"),
    move: "Protect",
  });

  assert.equal(result.move.category, "Status");
  assert.deepEqual([result.min, result.max], [0, 0]);
});

test("time contra um alvo calcula golpes do builder e preserva os 16 rolls", () => {
  const team = [
    { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", item: "", statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, moves: ["Earthquake", "Shadow Claw", "", ""] },
  ];
  const rows = calculateDamageFromTeamAgainstTarget(team, side("Gardevoir-Mega"), {
    gameType: "Doubles",
    weather: "Rain",
    attackerSide: { isHelpingHand: true },
    defenderSide: { isReflect: true },
  });

  assert.equal(rows.length, 6);
  assert.equal(rows[0].status, "ready");
  assert.deepEqual(rows[0].moves.map(({ move }) => move), ["Earthquake", "Shadow Claw"]);
  assert.equal(rows[0].moves[0].result.rolls.length, 16);
  assert.equal(rows[0].moves[0].result.gameType, "Doubles");
  assert.equal(rows[0].moves[0].result.targetsHit, 1);
  assert.ok(rows[0].moves[0].result.activeModifiers.some(({ label }) => label === "Helping Hand"));
  assert.ok(rows[0].moves[0].result.activeModifiers.some(({ label }) => label === "Reflect"));
  assert.equal(rows[1].status, "empty");
});

test("a Nature salva no set muda os golpes na comparação Time vs 1", () => {
  const member = {
    species: "Garchomp",
    ability: "Rough Skin",
    item: "",
    statPoints: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: ["Earthquake", "", "", ""],
  };
  const target = side("Gardevoir-Mega");
  const neutral = calculateDamageFromTeamAgainstTarget([{ ...member, nature: "Serious" }], target);
  const adamant = calculateDamageFromTeamAgainstTarget([{ ...member, nature: "Adamant" }], target);
  assert.equal(neutral[0].moves[0].result.rolls.length, 16);
  assert.equal(adamant[0].moves[0].result.rolls.length, 16);
  assert.ok(adamant[0].moves[0].result.max > neutral[0].moves[0].result.max);
});

test("compara os golpes preenchidos dos seis integrantes contra o mesmo alvo", () => {
  const speciesAndMoves = [
    ["Garchomp", "Earthquake"],
    ["Lucario", "Aura Sphere"],
    ["Gardevoir-Mega", "Moonblast"],
    ["Charizard", "Heat Wave"],
    ["Absol-Mega-Z", "Shadow Claw"],
    ["Garchomp-Mega-Z", "Dragon Claw"],
  ];
  const members = speciesAndMoves.map(([species, move]) => ({
    species,
    nature: "Serious",
    ability: "",
    item: "",
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [move, "", "", ""],
  }));
  const rows = calculateDamageFromTeamAgainstTarget(members, side("Gardevoir-Mega"));

  assert.deepEqual(rows.map(({ status }) => status), Array(6).fill("ready"));
  assert.deepEqual(rows.map(({ moves }) => moves[0].result.move.name), speciesAndMoves.map(([, move]) => move));
  assert.ok(rows.every(({ moves }) => moves[0].result && moves[0].result.max >= moves[0].result.min));
  assert.ok(rows.slice(0, 5).every(({ moves }) => moves[0].result.rolls?.length === 16));
});

test("time contra um alvo explicita sets sem golpes e não presume uma distribuição legal", () => {
  const blank = { species: "Garchomp", nature: "Serious", ability: "Rough Skin", item: "", statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, moves: ["", " ", "", ""] };
  const overStatLimit = { ...blank, statPoints: { ...blank.statPoints, atk: 33 }, moves: ["Earthquake", "", "", ""] };
  const overBudget = { ...blank, statPoints: { hp: 12, atk: 12, def: 12, spa: 12, spd: 10, spe: 9 }, moves: ["Earthquake", "", "", ""] };
  const unknownMove = { ...blank, moves: ["Earthquake", "Move Not In Catalogue", "", ""] };
  const clearAmulet = { ...blank, item: "Clear Amulet", moves: ["Earthquake", "", "", ""] };
  const unsupportedItem = { ...blank, item: "Choice Specs", moves: ["Earthquake", "", "", ""] };
  const rows = calculateDamageFromTeamAgainstTarget([blank, overStatLimit, overBudget, unknownMove, clearAmulet, unsupportedItem], side("Garchomp"));

  assert.equal(rows[0].status, "no-moves");
  assert.match(rows[0].error, /Nenhum golpe/);
  assert.equal(rows[1].status, "invalid");
  assert.match(rows[1].error, /0 a 32 SP/);
  assert.equal(rows[2].status, "invalid");
  assert.match(rows[2].error, /66/);
  assert.equal(rows[3].status, "ready");
  assert.ok(rows[3].moves[0].result);
  assert.equal(rows[3].moves[1].result, null);
  assert.match(rows[3].moves[1].error, /fora do catálogo/);
  assert.equal(rows[4].status, "ready");
  assert.equal(rows[4].moves[0].result.rolls.length, 16);
  assert.match(rows[4].moves[0].result.itemContextNotes[0], /Clear Amulet/);
  assert.match(rows[4].moves[0].result.itemContextNotes[0], /não está verificada/);
  assert.equal(rows[5].status, "unsupported-item");
  assert.equal(rows[5].moves.length, 0);
  assert.match(rows[5].error, /reconhecido no catálogo geral/);
  assert.match(getDamageItemSupport("Mystery Item").status, /unknown/);
  assert.match(getDamageItemSupport("Clear Amulet").status, /context-only/);
});

test("Clear Amulet conserva o contexto e não altera o dano pontual quando estágios são informados", () => {
  const input = { attacker: side("Garchomp", { item: "Clear Amulet", nature: "Jolly", statPoints: { atk: 32 } }), defender: side("Gardevoir-Mega"), move: "Earthquake", gameType: "Singles" };
  const withAmulet = calculateChampionsDamage(input);
  const withoutAmulet = calculateChampionsDamage({ ...input, attacker: { ...input.attacker, item: "" } });

  assert.equal(withAmulet.rolls.length, 16);
  assert.deepEqual(withAmulet.rolls, withoutAmulet.rolls);
  assert.equal(withAmulet.itemContextNotes.length, 1);
  assert.match(withAmulet.itemContextNotes[0], /não simula quedas causadas pelo oponente/);
  assert.match(withAmulet.itemContextNotes[0], /legalidade em Pokémon Champions não está verificada/);
});

test("um item desconhecido ou não suportado bloqueia só o integrante correspondente", () => {
  const member = { species: "Garchomp", nature: "Jolly", ability: "Rough Skin", item: "", statPoints: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }, moves: ["Earthquake", "", "", ""] };
  const rows = calculateDamageFromTeamAgainstTarget([
    { ...member, item: "Mystery Item" },
    member,
    { ...member, item: "Choice Specs" },
    member,
    member,
    member,
  ], { ...side("Garchomp"), item: "" });

  assert.deepEqual(rows.map(({ status }) => status), ["unknown-item", "ready", "unsupported-item", "ready", "ready", "ready"]);
  assert.match(rows[0].error, /não foi reconhecido/);
  assert.match(rows[2].error, /pode alterar dano/);
  assert.ok(rows.slice(1).filter((_, index) => index !== 1).every((row) => row.moves[0].result.rolls.length === 16));
});
