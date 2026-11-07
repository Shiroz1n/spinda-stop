import { getDefensiveTypeEffectiveness, typeEffectivenessChart } from "./typeChart.js";

const TYPES = Object.keys(typeEffectivenessChart);

function key(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function calculateTeamAnalysis(team, pokemonCatalog, moveCatalog) {
  const pokemonBySlug = new Map(pokemonCatalog.map((pokemon) => [pokemon.slug, pokemon]));
  const movesByName = new Map(moveCatalog.map((move) => [key(move.name), move]));
  const members = team.members.flatMap((member, slot) => {
    const pokemon = member ? pokemonBySlug.get(member.pokemonId) : null;
    return pokemon ? [{ slot, pokemon, types: pokemon.types.map((type) => key(type)).filter((type) => TYPES.includes(type)) }] : [];
  });
  const equippedMoves = team.members.flatMap((member) => (member?.moves || []).flatMap((name) => {
    if (!name.trim()) return [];
    const move = movesByName.get(key(name));
    return move && move.category !== "status" && TYPES.includes(key(move.type)) ? [move] : [];
  }));
  const attackTypes = [...new Set(equippedMoves.map((move) => key(move.type)))];
  const defensive = TYPES.map((type) => {
    const effects = members.map(({ slot, pokemon, types }) => ({
      name: pokemon.name,
      slot,
      multiplier: getDefensiveTypeEffectiveness(type, types),
    }));
    return { type, effects };
  });
  const group = (matches) => defensive.flatMap(({ type, effects }) => {
    const counts = new Map();
    for (const effect of effects) {
      if (matches(effect.multiplier)) counts.set(effect.multiplier, (counts.get(effect.multiplier) || 0) + 1);
    }
    return counts.size ? [{ type, counts: [...counts].sort((left, right) => right[0] - left[0]) }] : [];
  });

  return {
    filledSlots: members.length,
    equippedMoveCount: equippedMoves.length,
    attackTypes,
    coverage: TYPES.map((type) => {
      const multipliers = attackTypes.map((attackType) => typeEffectivenessChart[attackType][type]);
      return { type, multiplier: multipliers.length ? Math.max(...multipliers) : null };
    }),
    weaknesses: group((multiplier) => multiplier > 1),
    resistances: group((multiplier) => multiplier > 0 && multiplier < 1),
    immunities: group((multiplier) => multiplier === 0),
    blindSpots: TYPES.filter((type) => !attackTypes.some((attackType) => typeEffectivenessChart[attackType][type] > 1)),
  };
}
