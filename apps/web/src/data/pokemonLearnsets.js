const VERSION_LABELS = {
  "red-blue": "Red / Blue",
  "yellow": "Yellow",
  "gold-silver": "Gold / Silver",
  "crystal": "Crystal",
  "ruby-sapphire": "Ruby / Sapphire",
  "emerald": "Emerald",
  "firered-leafgreen": "FireRed / LeafGreen",
  "diamond-pearl": "Diamond / Pearl",
  "platinum": "Platinum",
  "heartgold-soulsilver": "HeartGold / SoulSilver",
  "black-white": "Black / White",
  "black-2-white-2": "Black 2 / White 2",
  "x-y": "X / Y",
  "omega-ruby-alpha-sapphire": "Omega Ruby / Alpha Sapphire",
  "sun-moon": "Sun / Moon",
  "ultra-sun-ultra-moon": "Ultra Sun / Ultra Moon",
  "lets-go-pikachu-lets-go-eevee": "Let's Go Pikachu / Eevee",
  "sword-shield": "Sword / Shield",
  "brilliant-diamond-and-shining-pearl": "Brilliant Diamond / Shining Pearl",
  "legends-arceus": "Legends: Arceus",
  "scarlet-violet": "Scarlet / Violet",
  "legends-za": "Legends: Z-A",
};

const METHOD_LABELS = {
  "level-up": "Nível",
  machine: "Máquina",
  egg: "Ovo",
  tutor: "Tutor",
  reminder: "Recordador",
  mastery: "Maestria",
  "form-change": "Mudança de forma",
  "stadium-surfing-pikachu": "Stadium",
  "light-ball-egg": "Ovo com Light Ball",
  "colosseum-purification": "Purificação em Colosseum",
  "xd-shadow": "Golpe Shadow de XD",
  "xd-purification": "Purificação em XD",
};

function titleFromSlug(value) {
  return String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en"));
}

export function formatVersionGroup(name) {
  return VERSION_LABELS[name] || titleFromSlug(name);
}

export function formatMoveLearnMethod(name) {
  return METHOD_LABELS[name] || titleFromSlug(name);
}

export function filterPokemonLearnsets(rows, moves, filters = {}) {
  const moveById = new Map(moves.map((move) => [move.id, move]));
  const versionGroupId = filters.versionGroupId === "" || filters.versionGroupId == null
    ? null
    : Number(filters.versionGroupId);
  const methodId = filters.methodId === "" || filters.methodId == null ? null : Number(filters.methodId);
  const query = String(filters.query || "").trim().toLocaleLowerCase("pt-BR");

  return (rows || []).flatMap(([moveId, versionId, learnMethodId, level, order, mastery]) => {
    if (versionGroupId !== null && versionId !== versionGroupId) return [];
    if (methodId !== null && learnMethodId !== methodId) return [];
    const move = moveById.get(moveId);
    if (!move) return [];
    if (query && !move.name.toLocaleLowerCase("pt-BR").includes(query)) return [];
    if (filters.type && move.type !== filters.type) return [];
    if (filters.category && move.category !== filters.category) return [];
    return [{ move, versionGroupId: versionId, methodId: learnMethodId, level, order, mastery: mastery === 1 }];
  }).sort((left, right) => left.move.name.localeCompare(right.move.name, "en")
    || left.methodId - right.methodId
    || left.level - right.level);
}

export function getEvolutionNeighbors(pokemonIndex, speciesId) {
  const speciesById = new Map();
  for (const pokemon of pokemonIndex) {
    if (!speciesById.has(pokemon.speciesId) || pokemon.isDefault) speciesById.set(pokemon.speciesId, pokemon);
  }
  const current = speciesById.get(Number(speciesId));
  if (!current) return { previous: null, current: null, next: [] };

  const previous = current.evolvesFromSpeciesId
    ? speciesById.get(current.evolvesFromSpeciesId) || null
    : null;
  const next = [...speciesById.values()]
    .filter((pokemon) => pokemon.evolvesFromSpeciesId === current.speciesId)
    .sort((left, right) => left.speciesId - right.speciesId);

  return { previous, current, next };
}
