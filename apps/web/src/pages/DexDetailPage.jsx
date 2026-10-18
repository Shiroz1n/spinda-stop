import { Link, useParams } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag } from "../components/TypeTag.jsx";

const STAT_LABELS = [
  ["hp", "HP"], ["atk", "Attack"], ["def", "Defense"],
  ["spa", "Sp. Atk"], ["spd", "Sp. Def"], ["spe", "Speed"],
];

function formLabel(pokemon) {
  if (pokemon.formId === "default") return "Forma padrão";
  return pokemon.formName || pokemon.formId.replaceAll("-", " ");
}

export function DexDetailPage() {
  const { slug = "" } = useParams();
  const summary = dexData.pokemon.find((entry) => entry.slug === slug);
  const pokemon = summary ? { ...summary, ...detailData.pokemonBySlug[slug] } : null;

  if (!pokemon) {
    return (
      <section className="page-wrap not-found-page">
        <div className="not-found-mark" aria-hidden="true">?</div>
        <p className="page-label">Pokédex</p>
        <h1>Essa forma não está no catálogo.</h1>
        <Link className="button button-primary" to="/dex">Voltar à Pokédex</Link>
      </section>
    );
  }

  const total = STAT_LABELS.reduce((sum, [key]) => sum + (pokemon.stats[key] ?? 0), 0);
  const forms = dexData.pokemon.filter((entry) => entry.speciesId === pokemon.speciesId);

  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" to="/dex"><span aria-hidden="true">←</span> Pokédex</Link>

      <section className="detail-heading" aria-labelledby="pokemon-title">
        <div className="detail-stage-art">
          <span className="detail-spark detail-spark-one" aria-hidden="true">✦</span>
          <span className="detail-spark detail-spark-two" aria-hidden="true">✧</span>
          <PokemonSprite pokemon={pokemon} name={pokemon.name} size={200} priority />
          <span className="detail-number">{formatNationalNumber(pokemon.speciesId)}</span>
        </div>
        <div className="detail-title">
          <p className="page-label">PokéAPI · geração {pokemon.generation || "—"}</p>
          <h1 id="pokemon-title">{pokemon.name}</h1>
          <p className="detail-form-label">{pokemon.speciesName} <span>·</span> {formLabel(pokemon)}</p>
          <div className="type-list detail-types">{pokemon.types.map((type) => <TypeTag type={type} key={type} />)}</div>
          <div className="detail-hero-actions">
            <Link className="button button-primary" to={`/usage?pokemon=${encodeURIComponent(pokemon.name)}`}>Tendências de Doubles</Link>
            <Link className="button button-outline" to="/builder" state={{ pokemonSlug: pokemon.slug }}>Adicionar ao time</Link>
          </div>
          <p className="detail-data-caption">Dados gerais da espécie; disponibilidade no jogo depende do regulamento.</p>
        </div>
      </section>

      {forms.length > 1 ? (
        <section className="detail-forms" aria-labelledby="forms-heading">
          <div className="section-heading"><h2 id="forms-heading">Formas de {pokemon.speciesName}</h2><span>{forms.length}</span></div>
          <div className="form-switcher">
            {forms.map((form) => (
              <Link className={`form-option${form.slug === pokemon.slug ? " is-current" : ""}`} to={`/dex/${form.slug}`} aria-current={form.slug === pokemon.slug ? "page" : undefined} key={form.slug}>
                <PokemonSprite pokemon={form} name={form.name} size={56} decorative />
                <span>{form.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="detail-grid">
        <section className="panel-frame detail-panel" aria-labelledby="stats-heading">
          <div className="section-heading"><h2 id="stats-heading">Stats base</h2><span>Total {total}</span></div>
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
          <p className="form-hint">Referência geral da PokéAPI; não representa o stat final do Pokémon Champions.</p>
        </section>

        <section className="panel-frame detail-panel" aria-labelledby="profile-heading">
          <div className="section-heading"><h2 id="profile-heading">Dados da espécie</h2><span>PokéAPI</span></div>
          <dl className="detail-facts">
            <div><dt>Espécie</dt><dd>{pokemon.speciesName}</dd></div>
            <div><dt>Forma</dt><dd>{formLabel(pokemon)}</dd></div>
            <div><dt>Altura</dt><dd>{(pokemon.height / 10).toLocaleString("pt-BR")} m</dd></div>
            <div><dt>Peso</dt><dd>{(pokemon.weight / 10).toLocaleString("pt-BR")} kg</dd></div>
            <div><dt>Habilidades gerais</dt><dd>{pokemon.abilities.map((ability) => `${ability.name}${ability.hidden ? " (oculta)" : ""}`).join(", ") || "Sem dado"}</dd></div>
          </dl>
          <a className="source-link" href={dexData.metadata.sourceUrl} target="_blank" rel="noreferrer">Revisão da fonte ↗</a>
        </section>
      </div>
    </div>
  );
}
