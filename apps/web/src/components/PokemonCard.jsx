import { Link } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import { TypeTag } from "./TypeTag.jsx";

const QUICK_STATS = [
  ["atk", "Atk"],
  ["spa", "SpA"],
  ["spe", "Spe"],
];

export function PokemonCard({ pokemon }) {
  return (
    <article className="pokemon-card">
      <div className="pokemon-card-top">
        <span className="dex-number">{formatNationalNumber(pokemon.speciesId)}</span>
        <span className="unknown-chip">Champions: desconhecido</span>
      </div>
      <Link className="pokemon-card-title" to={`/dex/${encodeURIComponent(pokemon.slug)}`}>
        {pokemon.name}
      </Link>
      {pokemon.formName && pokemon.name !== pokemon.speciesName && (
        <p className="form-note">{pokemon.speciesName} · {pokemon.formName}</p>
      )}
      <div className="type-list" aria-label="Tipos">
        {pokemon.types.map((type) => <TypeTag key={type} type={type} />)}
      </div>
      <div className="quick-stats" aria-label="Stats base gerais">
        {QUICK_STATS.map(([key, label]) => (
          <span key={key}><b>{label}</b> {pokemon.stats[key] ?? "—"}</span>
        ))}
      </div>
      <Link className="card-link-cue" to={`/dex/${encodeURIComponent(pokemon.slug)}`}>
        <span>Ver ficha de {pokemon.name}</span>
        <svg className="arrow-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 15 15 5M6 5h9v9" /></svg>
      </Link>
    </article>
  );
}
