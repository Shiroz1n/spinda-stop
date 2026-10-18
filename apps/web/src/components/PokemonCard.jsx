import { Link } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { TypeTag } from "./TypeTag.jsx";

const QUICK_STATS = [["hp", "HP"], ["atk", "Atk"], ["def", "Def"], ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"]];

export function PokemonCard({ pokemon }) {
  const availableStats = QUICK_STATS.filter(([key]) => Number.isFinite(pokemon.stats?.[key]));
  const statsLabel = availableStats.map(([key, label]) => `${label} ${pokemon.stats[key]}`).join(", ");

  return (
    <article className="pokemon-card">
      <Link className="pokemon-card-link" to={`/dex/${encodeURIComponent(pokemon.slug)}`}>
        <span className="pokemon-card-art"><PokemonSprite pokemon={pokemon} name={pokemon.name} size={112} decorative /></span>
        <span className="pokemon-card-copy">
          <span className="pokemon-card-number">{formatNationalNumber(pokemon.speciesId)}</span>
          <strong className="pokemon-card-title">{pokemon.name}</strong>
          {pokemon.formId !== "default" && <span className="form-chip">{pokemon.formName || pokemon.formId.replaceAll("-", " ")}</span>}
          <span className="type-list" aria-label="Tipos">
            {pokemon.types.map((type) => <TypeTag type={type} key={type} />)}
          </span>
        </span>
        <span className="quick-stats" aria-label={`Stats base gerais: ${statsLabel}`}>
          {availableStats.map(([key, label]) => <span key={key}><b>{label}</b>{pokemon.stats[key]}</span>)}
        </span>
        <span className="card-link-cue" aria-hidden="true">Abrir ficha <span>↗</span></span>
      </Link>
    </article>
  );
}
