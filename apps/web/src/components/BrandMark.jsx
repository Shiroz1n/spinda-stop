import { POKEMON_SPRITE_REFERENCE } from "../data/pokemonSprites.js";
import { PokemonSprite } from "./PokemonSprite.jsx";

export function BrandMark() {
  return <PokemonSprite pokemon={POKEMON_SPRITE_REFERENCE} name="Spinda" size={48} priority decorative className="brand-mark" />;
}
