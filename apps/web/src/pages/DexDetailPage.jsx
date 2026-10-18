import { Link, useParams } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import { TypeTag } from "../components/TypeTag.jsx";

const STAT_LABELS = [
  ["hp", "HP"],
  ["atk", "Attack"],
  ["def", "Defense"],
  ["spa", "Special Attack"],
  ["spd", "Special Defense"],
  ["spe", "Speed"],
];

export function DexDetailPage() {
  const { slug = "" } = useParams();
  const summary = dexData.pokemon.find((entry) => entry.slug === slug);
  const pokemon = summary ? { ...summary, ...detailData.pokemonBySlug[slug] } : null;

  if (!pokemon) {
    return (
      <section className="page-wrap narrow-page">
        <p className="page-label">Catálogo geral</p>
        <h1>Essa entrada não está no catálogo.</h1>
        <Link className="button button-primary" to="/dex">Voltar à Pokédex</Link>
      </section>
    );
  }

  const total = STAT_LABELS.reduce((sum, [key]) => sum + (pokemon.stats[key] ?? 0), 0);
  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" to="/dex">
        <svg className="back-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M15 10H5m0 0 4-4m-4 4 4 4" /></svg>
        Voltar à Pokédex
      </Link>
      <section className="detail-heading panel-frame">
        <div className="detail-number">{formatNationalNumber(pokemon.speciesId)}</div>
        <div className="detail-title">
          <p className="page-label">Dados gerais · geração {pokemon.generation || "—"}</p>
          <h1>{pokemon.name}</h1>
          {pokemon.formName && <p>{pokemon.speciesName} · {pokemon.formName}</p>}
          <div className="type-list">{pokemon.types.map((type) => <TypeTag type={type} key={type} />)}</div>
        </div>
        <span className="unknown-chip detail-status">Champions: desconhecido</span>
      </section>

      <div className="detail-grid">
        <section className="panel-frame detail-panel">
          <div className="section-heading">
            <h2>Stats base gerais</h2>
            <span>Total {total}</span>
          </div>
          <ul className="stat-list">
            {STAT_LABELS.map(([key, label]) => {
              const value = pokemon.stats[key] ?? 0;
              return (
                <li className="stat-row" key={key}>
                  <span>{label}</span>
                  <span className="stat-track" aria-hidden="true"><span style={{ width: `${Math.min(100, value / 255 * 100)}%` }} /></span>
                  <strong>{value}</strong>
                </li>
              );
            })}
          </ul>
          <p className="form-hint">São valores de referência da PokéAPI; não calculam stats do Pokémon Champions.</p>
        </section>

        <section className="panel-frame detail-panel">
          <div className="section-heading"><h2>Ficha</h2><span>PokéAPI</span></div>
          <dl className="detail-facts">
            <div><dt>Espécie</dt><dd>{pokemon.speciesName}</dd></div>
            <div><dt>Forma</dt><dd>{pokemon.formName || "Padrão"}</dd></div>
            <div><dt>Altura</dt><dd>{(pokemon.height / 10).toLocaleString("pt-BR")} m</dd></div>
            <div><dt>Peso</dt><dd>{(pokemon.weight / 10).toLocaleString("pt-BR")} kg</dd></div>
            <div><dt>Habilidades gerais</dt><dd>{pokemon.abilities.map((ability) => `${ability.name}${ability.hidden ? " (oculta)" : ""}`).join(", ") || "Sem dado"}</dd></div>
          </dl>
          <p className="unknown-note">Compatibilidade com formato e regulamento não consultada.</p>
        </section>
      </div>
      <div className="detail-actions">
        <Link className="button button-primary" to="/builder" state={{ pokemonSlug: pokemon.slug }}>Adicionar ao time</Link>
        <a className="source-link" href={dexData.metadata.sourceUrl} target="_blank" rel="noreferrer">Ver revisão da fonte</a>
      </div>
    </div>
  );
}
