import { Link } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { TypeTag } from "./TypeTag.jsx";

export function PokemonCard({ pokemon, onOpen }) {
  return (
    <article className="pokemon-card">
      <Link className="pokemon-card-link" to={`/dex/${encodeURIComponent(pokemon.slug)}`} onClick={onOpen}>
        <span className="pokemon-card-art"><PokemonSprite pokemon={pokemon} name={pokemon.name} size={112} decorative /></span>
        <span className="pokemon-card-copy">
        <span className="pokemon-card-number">#{formatNationalNumber(pokemon.speciesId)}</span>
          <strong className="pokemon-card-title">{pokemon.name}</strong>
          {pokemon.formId !== "default" && <span className="form-chip">{pokemon.formName || pokemon.formId.replaceAll("-", " ")}</span>}
          <span className="type-list" aria-label="Tipos">
            {pokemon.types.map((type) => <TypeTag type={type} key={type} />)}
          </span>
        </span>
        <span className="sr-only">Abrir ficha</span>
      </Link>
    </article>
  );
}
