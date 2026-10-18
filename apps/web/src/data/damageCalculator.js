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

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"];
const boostKeys = ["atk", "def", "spa", "spd", "spe"];
const spreadTargets = new Set(["allAdjacent", "allAdjacentFoes"]);

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
  const hitRanges = Array.isArray(damage) && Array.isArray(damage[0])
    ? damage.map((rolls) => [rolls[0], rolls.at(-1)])
    : [[min, max]];

  return {
    attacker,
    defender,
    gameType,
    hitRanges,
    hits,
    isSpread: gameType === "Doubles" && spreadTargets.has(moveData.target),
    maxPercent: defender.stats.hp ? (max / defender.stats.hp) * 100 : 0,
    min,
    minPercent: defender.stats.hp ? (min / defender.stats.hp) * 100 : 0,
    move: moveData,
    rolls: Array.isArray(damage) && !Array.isArray(damage[0]) ? damage : null,
    max,
  };
}
