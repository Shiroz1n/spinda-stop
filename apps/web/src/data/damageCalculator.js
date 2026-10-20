import { calculate, Field, Generations, Move, Pokemon, Side, toID } from "@smogon/calc";

const generation = Generations.get(0);
const generalGeneration = Generations.get(9);
const STATIC_HIT_CONTEXT_ITEMS = new Set(["clearamulet"]);

export const damageCalculatorCatalog = {
  species: [...generation.species].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  moves: [...generation.moves].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  items: [...new Map([...generation.items, ...generalGeneration.items].map((item) => [item.id, item])).values()]
    .map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  abilities: [...generation.abilities].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  natures: [...generation.natures].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  weather: ["Sun", "Rain", "Sand", "Hail", "Snow"],
  terrain: ["Electric", "Grassy", "Misty", "Psychic"],
};

export function getDamageCatalogOptions(catalogName, query) {
  const catalog = damageCalculatorCatalog[catalogName];
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
  if (!catalog || !normalizedQuery) return [];
  return catalog
    .filter((entry) => entry.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 50);
}

export function buildDamageCalculatorSearch(attacker, defender, move = "") {
  const params = new URLSearchParams();
  const sideValues = [
    ["attacker", attacker],
    ["defender", defender],
  ];

  for (const [sideName, side] of sideValues) {
    if (!side?.species) continue;
    const prefix = sideName === "attacker" ? "" : "defender-";
    params.set(sideName, side.species);
    if (side.nature) params.set(`${prefix}nature`, side.nature);
    if (side.ability) params.set(`${prefix}ability`, side.ability);
    if (side.item) params.set(`${prefix}item`, side.item);
    for (const stat of statKeys) {
      const value = Number(side.statPoints?.[stat] ?? 0);
      if (Number.isSafeInteger(value) && value >= 0) {
        params.set(`${prefix}sp-${stat}`, String(value));
      }
    }
  }

  if (move) params.set("move", move);
  return params.toString();
}

export function cloneDamageScenario(scenario) {
  return {
    ...scenario,
    attacker: { ...scenario.attacker, statPoints: { ...scenario.attacker.statPoints }, boosts: { ...scenario.attacker.boosts } },
    defender: { ...scenario.defender, statPoints: { ...scenario.defender.statPoints }, boosts: { ...scenario.defender.boosts } },
    attackerSide: { ...scenario.attackerSide },
    defenderSide: { ...scenario.defenderSide },
  };
}

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"];
const boostKeys = ["atk", "def", "spa", "spd", "spe"];
const spreadTargets = new Set(["allAdjacent", "allAdjacentFoes"]);
const firstHitChangingAbilities = new Set([
  "disguise", "iceface", "multiscale", "shadowshield",
]);
const repeatedDamageChangingAbilities = new Set([
  "angershell", "colorchange", "emergencyexit", "sandspit", "seedsower", "stamina", "weakarmor", "wimpout",
]);
const speedChangingAbilities = new Set(["cottondown", "motordrive", "rattled", "slowstart", "speedboost", "steamengine", "weakarmor"]);
const speedBasedDamageMoves = new Set(["payback", "electroball", "gyroball"]);
const contactReactiveAbilities = new Set([
  "cursedbody", "effectspore", "flamebody", "gooey", "ironbarbs", "mummy", "perishbody",
  "pickpocket", "poisonpoint", "roughskin", "static", "tanglinghair", "wanderingspirit",
]);
const modifierLabels = {
  isAuroraVeil: "Aurora Veil",
  isBattery: "Battery",
  isBeadsOfRuin: "Beads of Ruin",
  isBurned: "Queimadura",
  isCharge: "Charge",
  isFlowerGiftAttacker: "Flower Gift no atacante",
  isFlowerGiftDefender: "Flower Gift no alvo",
  isFriendGuard: "Friend Guard",
  isHelpingHand: "Helping Hand",
  isLightScreen: "Light Screen",
  isPowerSpot: "Power Spot",
  isPowerTrickAttacker: "Power Trick no atacante",
  isPowerTrickDefender: "Power Trick no alvo",
  isReflect: "Reflect",
  isSteelySpiritAttacker: "Steely Spirit",
  isStellarFirstUse: "Primeiro uso do tipo Stellar",
  isSwordOfRuin: "Sword of Ruin",
  isTabletsOfRuin: "Tablets of Ruin",
  isVesselOfRuin: "Vessel of Ruin",
  isWonderRoom: "Wonder Room",
  isDefenderDynamaxed: "Alvo Dynamax",
};

function findEntry(collection, value) {
  return value ? collection.get(toID(value)) : undefined;
}

export function getDamageMove(value) {
  return findEntry(generation.moves, value);
}

export function getDamageItemSupport(value) {
  const label = String(value || "").trim();
  if (!label) return { status: "none", name: "", note: "" };
  const engineItem = findEntry(generation.items, label);
  if (engineItem) return { status: "modeled", name: engineItem.name, note: "" };

  const generalItem = findEntry(generalGeneration.items, label);
  if (!generalItem) {
    return {
      status: "unknown",
      name: label,
      error: `O item “${label}” não foi reconhecido nos catálogos de cálculo consultados. O resultado deste integrante não foi calculado; o efeito e a disponibilidade em Champions continuam não verificados.`,
    };
  }

  if (STATIC_HIT_CONTEXT_ITEMS.has(generalItem.id)) {
    return {
      status: "context-only",
      name: generalItem.name,
      note: `${generalItem.name} foi reconhecido no catálogo geral da geração 9, mas não é aplicado pelo catálogo Champions do motor. Este cálculo pontual usa os stats e estágios já informados e não simula quedas causadas pelo oponente; a disponibilidade/legalidade em Pokémon Champions não está verificada.`,
    };
  }

  return {
    status: "unsupported",
    name: generalItem.name,
    error: `O item “${generalItem.name}” foi reconhecido no catálogo geral da geração 9, mas não é suportado pelo catálogo Champions deste motor. Como pode alterar dano ou sequência, nenhum resultado foi calculado; disponibilidade/legalidade em Champions não verificada.`,
  };
}

export function getDamageSpeciesName(value) {
  return findEntry(generation.species, value)?.name || String(value || "");
}

export function isSpreadTargetMove(move) {
  return Boolean(move && spreadTargets.has(move.target));
}

export function getSpreadTargetLimit(move) {
  if (move?.target === "allAdjacentFoes") return 2;
  if (move?.target === "allAdjacent") return 3;
  return 1;
}

function resolveEntry(collection, value, label, required = false) {
  if (!value && !required) return undefined;
  const entry = findEntry(collection, value);
  if (!entry) throw new Error(`Escolha ${label} disponível no catálogo.`);
  return entry;
}

function normalizeStatPoints(values = {}) {
  return Object.fromEntries(statKeys.map((stat) => {
    const value = Number(values[stat] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("Stat Points precisam ser números inteiros iguais ou maiores que zero.");
    }
    return [stat, value];
  }));
}

function getKnockoutProbabilityEligibility(input, moveData, hits, hasParentalBondFollowUp, attacker, defender, { gameType, isSpreadTarget }) {
  const defenderAbility = toID(defender.ability || input.defender?.ability || "");
  const defenderItem = toID(defender.item || input.defender?.item || "");
  const attackerItem = toID(attacker.item || input.attacker?.item || "");
  const defenderStatus = defender.status || input.defender?.status || "";
  const attackerStatus = attacker.status || input.attacker?.status || "";
  const hasFieldCondition = Object.values(input.attackerSide || {}).some(Boolean)
    || Object.values(input.defenderSide || {}).some(Boolean);
  const changesFirstHit = firstHitChangingAbilities.has(defenderAbility);
  const changesAfterHit = repeatedDamageChangingAbilities.has(defenderAbility);
  const speedBasedMove = speedBasedDamageMoves.has(toID(moveData.name));
  const speedCanChangeBeforeNextHit = speedBasedMove && (
    speedChangingAbilities.has(defenderAbility) || speedChangingAbilities.has(toID(attacker.ability || input.attacker?.ability || ""))
  );
  const spreadTargetCountCanChange = gameType === "Doubles" && isSpreadTarget;
  const contactAbilityChangesNextHit = Boolean(moveData.flags?.contact)
    && contactReactiveAbilities.has(defenderAbility);
  const offensiveStat = moveData.overrideOffensiveStat
    || (moveData.category === "Physical" ? "atk" : "spa");
  const moveLowersOffense = Number(moveData.self?.boosts?.[offensiveStat] || 0) < 0;
  const hasDefenderItem = Boolean(defenderItem);
  const simpleSingleHit = hits === 1 && !hasParentalBondFollowUp && moveData.category !== "Status";
  const notes = [];
  if (!simpleSingleHit) notes.push("Estimativas de KO só são mostradas para golpes de dano com um acerto, sem o golpe adicional de Parental Bond.");
  if (defenderAbility === "sturdy") notes.push("OHKO omitido: Sturdy pode deixar o alvo com 1 HP.");
  if (defenderItem === "focussash") notes.push("OHKO omitido: Focus Sash pode deixar o alvo com 1 HP.");
  if (changesFirstHit) notes.push("Estimativas de KO omitidas: a habilidade do alvo altera ou impede o dano do primeiro golpe.");
  if (changesAfterHit) notes.push(`2HKO omitido: ${defender.ability} pode mudar o dano ou o campo após o primeiro golpe.`);
  if (speedCanChangeBeforeNextHit) notes.push("2HKO omitido: uma habilidade pode alterar a ordem de velocidade usada pelo golpe antes do segundo turno.");
  if (spreadTargetCountCanChange) notes.push("2HKO omitido: um golpe em área em Doubles pode atingir outra quantidade de alvos no próximo turno.");
  if (contactAbilityChangesNextHit) {
    notes.push(`2HKO omitido: ${defender.ability} pode afetar o atacante ou o próximo golpe após um contato.`);
  }
  if (moveLowersOffense) {
    notes.push(`2HKO omitido: ${moveData.name} reduz o atributo ofensivo do atacante após o uso.`);
  }
  if (hasDefenderItem) notes.push("Estimativas de KO omitidas quando o alvo tem item, pois recuperação, berries e efeitos de sobrevivência alteram a sequência.");
  if (attackerStatus || defenderStatus || input.weather || input.terrain || hasFieldCondition || attackerItem) {
    notes.push("2HKO omitido: itens, status ou condições de campo podem mudar entre turnos ou alterar o HP antes do segundo golpe.");
  }
  return {
    ohko: simpleSingleHit && defenderAbility !== "sturdy" && defenderItem !== "focussash" && !changesFirstHit && !hasDefenderItem,
    twoHit: simpleSingleHit && !changesFirstHit && !changesAfterHit && !speedCanChangeBeforeNextHit && !spreadTargetCountCanChange && !contactAbilityChangesNextHit && !moveLowersOffense && !hasDefenderItem && !attackerItem
      && !attackerStatus && !defenderStatus && !input.weather && !input.terrain && !hasFieldCondition,
    notes,
  };
}

function normalizeBoosts(values = {}) {
  return Object.fromEntries(boostKeys.map((stat) => {
    const value = Number(values[stat] ?? 0);
    if (!Number.isInteger(value) || value < -6 || value > 6) {
      throw new Error("Estágios de atributo precisam ficar entre -6 e +6.");
    }
    return [stat, value];
  }));
}

function makePokemon(input, label) {
  const species = resolveEntry(generation.species, input.species, `um Pokémon para ${label}`, true);
  const nature = resolveEntry(generation.natures, input.nature || "Serious", "uma nature");
  const ability = resolveEntry(generation.abilities, input.ability, "uma habilidade");
  const itemSupport = getDamageItemSupport(input.item);
  if (itemSupport.error) throw new Error(itemSupport.error);
  const status = input.status || "";
  const validStatuses = new Set(["", "brn", "par", "psn", "tox", "slp", "frz"]);
  if (!validStatuses.has(status)) throw new Error("Condição de status inválida.");

  return new Pokemon(generation, species.name, {
    ability: ability?.name,
    boosts: normalizeBoosts(input.boosts),
    evs: normalizeStatPoints(input.statPoints),
    item: itemSupport.status === "modeled" ? itemSupport.name : undefined,
    nature: nature?.name || "Serious",
    status,
  });
}

export function calculateChampionsStats(input) {
  // Stat previews only depend on the species, Nature, and SP. Keep free-text
  // battle fields out of this path so an unrecognized item or ability cannot
  // hide otherwise valid stats in the editor.
  return makePokemon({
    species: input.species,
    nature: input.nature,
    statPoints: input.statPoints,
  }, "stats do set").stats;
}

export function getHitOptions(move) {
  if (typeof move?.multihit === "number") return [move.multihit];
  if (Array.isArray(move?.multihit)) {
    const [minimum, maximum] = move.multihit;
    return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
  }
  return [1];
}

export function getTypeEffectiveness(moveType, defenderTypes) {
  const type = findEntry(generation.types, moveType);
  if (!type) return null;
  const resolvedDefenderTypes = defenderTypes.map((defenderType) => findEntry(generation.types, defenderType)?.name);
  if (resolvedDefenderTypes.some((defenderType) => !defenderType)) return null;
  return resolvedDefenderTypes.reduce((effectiveness, defenderType) => {
    return effectiveness * (type.effectiveness[defenderType] ?? 1);
  }, 1);
}

function getActiveModifiers(rawDesc, { gameType, moveData, isSpread, typeEffectiveness, damageMax }) {
  const modifiers = [];
  if (isSpread) modifiers.push({ label: "Golpe em área", factor: "0,75× no dano base" });
  if (rawDesc.isCritical) modifiers.push({ label: "Crítico aplicado", factor: "1,5× no dano base" });
  if (rawDesc.isHelpingHand) modifiers.push({ label: "Helping Hand", factor: "1,5× no poder base" });
  if (rawDesc.isReflect || rawDesc.isLightScreen || rawDesc.isAuroraVeil) {
    const factor = gameType === "Singles" ? "0,5×" : "2732/4096 (~0,667×)";
    const key = rawDesc.isReflect ? "isReflect" : rawDesc.isLightScreen ? "isLightScreen" : "isAuroraVeil";
    modifiers.push({ label: modifierLabels[key], factor: `${factor} no dano final` });
  }
  if (rawDesc.isFriendGuard) modifiers.push({ label: "Friend Guard", factor: "0,75× no dano final" });
  if (rawDesc.isBurned) modifiers.push({ label: "Queimadura", factor: "0,5× no dano físico final" });
  if (typeEffectiveness !== null) {
    modifiers.push({ label: "Efetividade base de tipo", factor: `${typeEffectiveness}×` });
  }
  if (rawDesc.stabFactor) modifiers.push({ label: "STAB", factor: rawDesc.stabFactor });
  if (rawDesc.moveBP) modifiers.push({ label: "Poder base ajustado", factor: String(rawDesc.moveBP) });
  if (rawDesc.moveType) modifiers.push({ label: "Tipo do golpe ajustado", factor: rawDesc.moveType });
  if (rawDesc.attackerTera) modifiers.push({ label: "Tipo Tera do atacante", factor: rawDesc.attackerTera });
  if (rawDesc.defenderTera) modifiers.push({ label: "Tipo Tera do alvo", factor: rawDesc.defenderTera });
  if (rawDesc.weather) modifiers.push({ label: "Clima", factor: `${rawDesc.weather} · efeito registrado pelo motor` });
  if (rawDesc.terrain) modifiers.push({ label: "Terreno", factor: `${rawDesc.terrain} · efeito registrado pelo motor` });
  if (rawDesc.attackerAbility) {
    const factor = rawDesc.attackerAbility === "Parental Bond"
      ? "golpe adicional calculado pelo motor a 0,25× do dano base"
      : `${rawDesc.attackerAbility} · efeito registrado pelo motor`;
    modifiers.push({ label: "Habilidade do atacante", factor });
  }
  if (rawDesc.attackerItem) modifiers.push({ label: "Item do atacante", factor: `${rawDesc.attackerItem} · efeito registrado pelo motor` });
  if (rawDesc.defenderAbility) modifiers.push({ label: "Habilidade do alvo", factor: `${rawDesc.defenderAbility} · efeito registrado pelo motor` });
  if (rawDesc.defenderItem) modifiers.push({ label: "Item do alvo", factor: `${rawDesc.defenderItem} · efeito registrado pelo motor` });
  if (rawDesc.attackBoost) modifiers.push({ label: "Estágio ofensivo aplicado", factor: `${rawDesc.attackBoost > 0 ? "+" : ""}${rawDesc.attackBoost}` });
  if (rawDesc.defenseBoost) modifiers.push({ label: "Estágio defensivo aplicado", factor: `${rawDesc.defenseBoost > 0 ? "+" : ""}${rawDesc.defenseBoost}` });
  for (const [key, label] of Object.entries(modifierLabels)) {
    if (rawDesc[key] && !modifiers.some((modifier) => modifier.label.startsWith(label))) {
      let factor = "efeito registrado pelo motor; fator não exposto pelo resultado";
      if (key === "isCharge") factor = "2× no poder base";
      if (key === "isWonderRoom") factor = "troca de Defesa e Defesa Especial aplicada";
      if (key === "isStellarFirstUse") factor = "STAB Stellar adicional registrado pelo motor";
      modifiers.push({ label, factor });
    }
  }
  if (rawDesc.isProtected) {
    modifiers.push(damageMax > 0
      ? { label: "Proteção atravessada", factor: "0,25× no dano final" }
      : { label: "Proteção", factor: "o golpe foi bloqueado pelo motor" });
  }
  if (rawDesc.rivalry) modifiers.push({ label: "Rivalry", factor: rawDesc.rivalry === "buffed" ? "efeito favorável registrado pelo motor" : "efeito desfavorável registrado pelo motor" });
  if (rawDesc.isSwitching) modifiers.push({ label: "Troca", factor: rawDesc.isSwitching });
  if (rawDesc.alliesFainted) modifiers.push({ label: "Aliados derrotados", factor: String(rawDesc.alliesFainted) });
  if (rawDesc.moveTurns) modifiers.push({ label: "Uso em turnos", factor: rawDesc.moveTurns });
  if (moveData.category !== "Status" && modifiers.length === 0) {
    modifiers.push({ label: "Sem modificador contextual identificado", factor: "fórmula e tabela de tipos do motor continuam aplicadas" });
  }
  return modifiers;
}

export function calculateChampionsDamage(input) {
  const itemContextNotes = [
    ["Atacante", input.attacker?.item],
    ["Alvo", input.defender?.item],
  ].flatMap(([side, value]) => {
    const item = getDamageItemSupport(value);
    return item.status === "context-only" ? [`${side}: ${item.note}`] : [];
  });
  const attacker = makePokemon(input.attacker, "ataque");
  const defender = makePokemon(input.defender, "defesa");
  const moveData = resolveEntry(generation.moves, input.move, "um golpe", true);
  const hitOptions = getHitOptions(moveData);
  const hits = Number(input.hits ?? hitOptions[0]);
  if (!hitOptions.includes(hits)) throw new Error("O número de acertos não corresponde aos dados deste golpe.");

  const gameType = input.gameType === "Singles" ? "Singles" : "Doubles";
  const isSpreadTarget = moveData.category !== "Status" && isSpreadTargetMove(moveData);
  const maxTargets = getSpreadTargetLimit(moveData);
  const targetsHit = isSpreadTarget && gameType === "Doubles" ? Number(input.targetsHit ?? 2) : 1;
  if (isSpreadTarget && gameType === "Doubles" && (!Number.isInteger(targetsHit) || targetsHit < 1 || targetsHit > maxTargets)) {
    throw new Error(`Informe de 1 a ${maxTargets} alvos válidos para este golpe.`);
  }
  const spreadModifierApplied = gameType === "Doubles" && isSpreadTarget && targetsHit > 1;
  const weather = input.weather
    ? damageCalculatorCatalog.weather.find((entry) => toID(entry) === toID(input.weather))
    : undefined;
  const terrain = input.terrain
    ? damageCalculatorCatalog.terrain.find((entry) => toID(entry) === toID(input.terrain))
    : undefined;
  if (input.weather && !weather) throw new Error("Escolha um clima disponível no catálogo.");
  if (input.terrain && !terrain) throw new Error("Escolha um terreno disponível no catálogo.");
  const attackerSide = input.attackerSide || {};
  const defenderSide = input.defenderSide || {};
  const field = new Field({
    gameType,
    weather,
    terrain,
    attackerSide: new Side(attackerSide),
    defenderSide: new Side(defenderSide),
  });
  // @smogon/calc infers the spread penalty from the move's target class. The battle
  // simulator applies it only when more than one valid target is present, so model
  // the one-target case by overriding that class before the calculator clones it.
  const move = new Move(generation, moveData.name, {
    overrides: gameType === "Doubles" && isSpreadTarget && targetsHit === 1
      ? { target: "normal" }
      : undefined,
  });
  move.hits = hits;
  move.isCrit = Boolean(input.critical);

  const result = calculate(generation, attacker, defender, move, field);
  const [min, max] = result.range();
  const damage = result.damage;
  const rollGroups = Array.isArray(damage) && Array.isArray(damage[0])
    ? damage
    : Array.isArray(damage) && damage.length === 16
      ? [damage]
      : [[min, max]];
  const hitRanges = rollGroups.map((rolls) => Array.isArray(rolls)
    ? [rolls[0], rolls.at(-1)]
    : [min, max]);
  const isSpread = spreadModifierApplied;
  const hasParentalBondFollowUp = attacker.hasAbility("Parental Bond") && hits === 1 && !isSpread
    && rollGroups.length === 2;
  const rollGroupLabels = rollGroups.map((_, index) => hasParentalBondFollowUp
    ? index === 0 ? "Golpe principal" : "Golpe adicional de Parental Bond"
    : `Acerto ${index + 1}`);
  const effectiveMoveType = result.rawDesc.moveType || moveData.type;
  const typeEffectiveness = getTypeEffectiveness(effectiveMoveType, defender.types);
  const hasStab = Boolean(effectiveMoveType) && (attacker.hasOriginalType(effectiveMoveType) || attacker.hasAbility("Protean", "Libero"));
  if (hasStab) {
    const stabFactor = attacker.hasAbility("Adaptability") ? "2×" : "1,5×";
    result.rawDesc.stabFactor = stabFactor;
  } else if (!result.rawDesc.stabFactor) {
    result.rawDesc.stabFactor = "1× (sem STAB)";
  }
  const hasRollDistribution = moveData.category !== "Status" && rollGroups.length === 1 && Array.isArray(rollGroups[0]) && rollGroups[0].length === 16;
  const rolls = hasRollDistribution ? rollGroups[0] : null;
  const koEligibility = getKnockoutProbabilityEligibility(input, moveData, hits, hasParentalBondFollowUp, attacker, defender, {
    gameType,
    isSpreadTarget,
  });
  const koProbabilities = hasRollDistribution && max > 0 && (koEligibility.ohko || koEligibility.twoHit) ? (() => {
    const hp = defender.stats.hp;
    const ohkoRolls = rolls.filter((roll) => roll >= hp).length;
    const twoHitPairs = rolls.reduce((total, first) => total + rolls.filter((second) => first + second >= hp).length, 0);
    return {
      ohko: koEligibility.ohko ? { successes: ohkoRolls, total: 16 } : null,
      twoHit: koEligibility.twoHit ? { successes: twoHitPairs, total: 256 } : null,
    };
  })() : null;

  return {
    attacker,
    activeModifiers: getActiveModifiers(result.rawDesc, { gameType, moveData, isSpread, typeEffectiveness, damageMax: max }),
    defender,
    gameType,
    hitRanges,
    itemContextNotes,
    hits,
    hasParentalBondFollowUp,
    isSpread,
    koProbabilityNotes: hasRollDistribution ? koEligibility.notes : [],
    koProbabilities,
    maxPercent: defender.stats.hp ? (max / defender.stats.hp) * 100 : 0,
    min,
    minPercent: defender.stats.hp ? (min / defender.stats.hp) * 100 : 0,
    move: moveData,
    originalMoveTarget: moveData.target,
    effectiveMoveType,
    typeEffectiveness,
    isSpreadTarget,
    targetsHit,
    rollGroups: rollGroups.map((group) => Array.isArray(group) ? group : [group]),
    rollGroupLabels,
    rolls,
    max,
  };
}

// Reuse the same engine and shared attacker/field inputs for a target list.
// This is a comparison helper only; each target remains a separate result.
export function calculateDamageAgainstTargets(input, targetSpecies) {
  return (Array.isArray(targetSpecies) ? targetSpecies : [])
    .map((species) => String(species || "").trim())
    .filter(Boolean)
    .map((species) => {
      try {
        return { species, result: calculateChampionsDamage({
          ...input,
          defender: { ...input.defender, species },
        }), error: "" };
      } catch (error) {
        return { species, result: null, error: error instanceof Error ? error.message : "Não foi possível calcular este alvo." };
      }
    });
}

const championsStatKeys = ["hp", "atk", "def", "spa", "spd", "spe"];

function validateTeamDamageMember(member) {
  const statPoints = member?.statPoints;
  if (!statPoints || typeof statPoints !== "object") return "Distribuição de Stat Points ausente.";

  let total = 0;
  for (const key of championsStatKeys) {
    const value = statPoints[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > 32) {
      return `${key.toUpperCase()} precisa ter de 0 a 32 SP.`;
    }
    total += value;
  }
  if (total > 66) return `O set usa ${total} SP; o limite deste modelo é 66.`;
  if (!String(member?.species || "").trim()) return "Espécie ausente no rascunho salvo.";
  if (!Array.isArray(member.moves)) return "Lista de golpes ausente neste set.";
  return "";
}

// The inverse comparison consumes actual builder sets. Empty slots and partial
// or invalid sets are represented explicitly; no default move or legal set is
// inferred on behalf of the player.
export function calculateDamageFromTeamAgainstTarget(teamMembers, defender, options = {}) {
  return Array.from({ length: 6 }, (_, index) => {
    const member = Array.isArray(teamMembers) ? teamMembers[index] : null;
    if (!member) return { slot: index + 1, status: "empty", moves: [], error: "Posição vazia." };

    const memberError = validateTeamDamageMember(member);
    if (memberError) return { slot: index + 1, status: "invalid", member, moves: [], error: memberError };

    const selectedMoves = Array.isArray(member.moves)
      ? member.moves.map((move) => String(move || "").trim()).filter(Boolean)
      : [];
    if (selectedMoves.length === 0) {
      return { slot: index + 1, status: "no-moves", member, moves: [], error: "Nenhum golpe preenchido neste set." };
    }

    const itemSupport = getDamageItemSupport(member.item);
    if (itemSupport.error) {
      return {
        slot: index + 1,
        status: itemSupport.status === "unknown" ? "unknown-item" : "unsupported-item",
        member,
        moves: [],
        error: itemSupport.error,
      };
    }

    const moves = selectedMoves.map((move) => {
      if (!getDamageMove(move)) return { move, result: null, error: "Golpe fora do catálogo de cálculo." };
      try {
        return {
          move,
          result: calculateChampionsDamage({
            ...options,
            attacker: {
              species: member.species,
              nature: member.nature || "Serious",
              ability: member.ability || "",
              item: member.item || "",
              statPoints: member.statPoints,
              boosts: member.boosts || {},
              status: member.status || "",
            },
            defender,
            gameType: options.gameType || "Doubles",
            targetsHit: 1,
            move,
          }),
          error: "",
        };
      } catch (error) {
        return { move, result: null, error: error instanceof Error ? error.message : "Não foi possível calcular este golpe." };
      }
    });
    return { slot: index + 1, status: moves.some(({ result }) => result) ? "ready" : "invalid", member, moves, error: "" };
  });
}
