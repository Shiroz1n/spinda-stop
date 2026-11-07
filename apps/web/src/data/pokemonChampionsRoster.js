import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "./pokemonSprites.js";

export function getChampionsIndexedPokemon(index, catalog) {
  const lookup = createPokemonSpriteLookup(catalog);
  const seen = new Set();

  return (index?.pokemon || []).flatMap((entry) => {
    if (!Number.isInteger(entry.position) || entry.position < 1) return [];
    const pokemon = resolveCompetitivePokemonSprite(lookup, { id: entry.showdownId, name: entry.name });
    if (!pokemon || seen.has(pokemon.slug)) return [];
    seen.add(pokemon.slug);
    return [{ ...pokemon, battleDataPosition: entry.position }];
  }).sort((left, right) => left.battleDataPosition - right.battleDataPosition
    || left.name.localeCompare(right.name, "pt-BR"));
}

export function getChampionsIndexedMegaPokemon(index, catalog, megaEntries = []) {
  const indexed = getChampionsIndexedPokemon(index, catalog);
  const baseBySpecies = new Map(indexed.map((pokemon) => [pokemon.speciesSlug, pokemon]));
  const lookup = createPokemonSpriteLookup(catalog);
  const seen = new Set();

  return megaEntries.flatMap((entry) => {
    const base = baseBySpecies.get(entry.id);
    if (!base) return [];
    const pokemon = resolveCompetitivePokemonSprite(lookup, { id: entry.formName, name: entry.formName });
    if (!pokemon || !pokemon.formId.startsWith("mega") || seen.has(pokemon.slug)) return [];
    seen.add(pokemon.slug);
    return [{ ...pokemon, battleDataPosition: base.battleDataPosition }];
  }).sort((left, right) => left.battleDataPosition - right.battleDataPosition
    || left.name.localeCompare(right.name, "pt-BR"));
}
