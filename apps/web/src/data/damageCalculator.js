import { calculate, Field, Generations, Move, Pokemon, Side, toID } from "@smogon/calc";

const generation = Generations.get(0);

export const damageCalculatorCatalog = {
  species: [...generation.species].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  moves: [...generation.moves].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  items: [...generation.items].map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
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

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"];
const boostKeys = ["atk", "def", "spa", "spd", "spe"];
const spreadTargets = new Set(["allAdjacent", "allAdjacentFoes"]);
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
  const item = resolveEntry(generation.items, input.item, "um item");
  const status = input.status || "";
  const validStatuses = new Set(["", "brn", "par", "psn", "tox", "slp", "frz"]);
  if (!validStatuses.has(status)) throw new Error("Condição de status inválida.");

  return new Pokemon(generation, species.name, {
    ability: ability?.name,
    boosts: normalizeBoosts(input.boosts),
    evs: normalizeStatPoints(input.statPoints),
    item: item?.name,
    nature: nature?.name || "Serious",
    status,
  });
}

export function getHitOptions(move) {
  if (typeof move?.multihit === "number") return [move.multihit];
  if (Array.isArray(move?.multihit)) {
    const [minimum, maximum] = move.multihit;
    return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
  }
  return [1];
}

function getTypeEffectiveness(moveType, defenderTypes) {
  const type = findEntry(generation.types, moveType);
  if (!type) return null;
  return defenderTypes.reduce((effectiveness, defenderType) => {
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
  if (typeEffectiveness !== null && typeEffectiveness !== 1) {
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
  const attacker = makePokemon(input.attacker, "ataque");
  const defender = makePokemon(input.defender, "defesa");
  const moveData = resolveEntry(generation.moves, input.move, "um golpe", true);
  const hitOptions = getHitOptions(moveData);
  const hits = Number(input.hits ?? hitOptions[0]);
  if (!hitOptions.includes(hits)) throw new Error("O número de acertos não corresponde aos dados deste golpe.");

  const gameType = input.gameType === "Singles" ? "Singles" : "Doubles";
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
  const move = new Move(generation, moveData.name);
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
  const isSpread = gameType === "Doubles" && spreadTargets.has(moveData.target);
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
  }
  const hasRollDistribution = moveData.category !== "Status" && rollGroups.length === 1 && Array.isArray(rollGroups[0]) && rollGroups[0].length === 16;
  const rolls = hasRollDistribution ? rollGroups[0] : null;
  const koProbabilities = hasRollDistribution && max > 0 ? (() => {
    const hp = defender.stats.hp;
    const ohkoRolls = rolls.filter((roll) => roll >= hp).length;
    const twoHitPairs = rolls.reduce((total, first) => total + rolls.filter((second) => first + second >= hp).length, 0);
    return {
      ohko: { successes: ohkoRolls, total: 16 },
      twoHit: { successes: twoHitPairs, total: 256 },
    };
  })() : null;

  return {
    attacker,
    activeModifiers: getActiveModifiers(result.rawDesc, { gameType, moveData, isSpread, typeEffectiveness, damageMax: max }),
    defender,
    gameType,
    hitRanges,
    hits,
    hasParentalBondFollowUp,
    isSpread,
    koProbabilities,
    maxPercent: defender.stats.hp ? (max / defender.stats.hp) * 100 : 0,
    min,
    minPercent: defender.stats.hp ? (min / defender.stats.hp) * 100 : 0,
    move: moveData,
    rollGroups: rollGroups.map((group) => Array.isArray(group) ? group : [group]),
    rollGroupLabels,
    rolls,
    max,
  };
}
