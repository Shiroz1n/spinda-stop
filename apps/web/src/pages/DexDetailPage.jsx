import { Link, useParams } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag, typeLabel } from "../components/TypeTag.jsx";
import { getDefensiveTypeEffectiveness, typeEffectivenessChart } from "../data/typeChart.js";

const STAT_LABELS = [
  ["hp", "HP"], ["atk", "Ataque"], ["def", "Defesa"],
  ["spa", "Atq. Esp."], ["spd", "Def. Esp."], ["spe", "Velocidade"],
];

const TYPE_RELATIONS = [
  { multiplier: 4, title: "Fraqueza extrema · 4×", group: "weaknesses" },
  { multiplier: 2, title: "Fraquezas · 2×", group: "weaknesses" },
  { multiplier: 0.5, title: "Resistências · ½×", group: "resistances" },
  { multiplier: 0.25, title: "Resistência extrema · ¼×", group: "resistances" },
  { multiplier: 0, title: "Imunidades · 0×", group: "immunities" },
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
  const typeRelations = dexData.types.map((type) => ({
    type,
    multiplier: getDefensiveTypeEffectiveness(type, pokemon.types),
  }));
  const supportedTypeIds = new Set(Object.keys(typeEffectivenessChart));
  const unsupportedDefenseTypes = pokemon.types.filter((type) => !supportedTypeIds.has(type.toLocaleLowerCase("en")));
  const unsupportedAttackTypes = dexData.types.filter((type) => !supportedTypeIds.has(type.toLocaleLowerCase("en")));

  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" to="/dex"><span aria-hidden="true">←</span> Pokédex</Link>

      <section className="detail-heading" aria-labelledby="pokemon-title">
        <div className="detail-stage-art">
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

      <nav className="detail-section-nav" aria-label="Seções da ficha">
        {forms.length > 1 ? <a href="#detail-forms">Formas</a> : null}
        <a href="#detail-stats">Stats base</a>
        <a href="#detail-types">Relações de tipo</a>
        <a href="#detail-profile">Dados da espécie</a>
      </nav>

      {forms.length > 1 ? (
        <section className="detail-forms" id="detail-forms" aria-labelledby="forms-heading">
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
        <section className="panel-frame detail-panel" id="detail-stats" aria-labelledby="stats-heading">
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

        <section className="panel-frame detail-panel" id="detail-profile" aria-labelledby="profile-heading">
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

      <section className="detail-type-relations" id="detail-types" aria-labelledby="type-relations-heading">
        <div className="section-heading"><div><p className="page-label">Carta de tipos</p><h2 id="type-relations-heading">Relações defensivas</h2></div><span>Multiplicador por golpe</span></div>
        {unsupportedDefenseTypes.length ? (
          <p className="detail-type-source" role="status">O simulador não fornece uma carta completa para o tipo {unsupportedDefenseTypes.map(typeLabel).join(" / ")} desta forma.</p>
        ) : (
          <>
            <div className="type-relation-groups">
              {TYPE_RELATIONS.map((group) => {
                const entries = typeRelations.filter((entry) => entry.multiplier === group.multiplier);
                if (!entries.length) return null;
                return (
                  <section className={`type-relation-group is-${group.group}`} key={group.multiplier}>
                    <h3>{group.title}</h3>
                    <ul>{entries.map(({ type }) => <li key={type}><TypeTag type={type} /><strong>{group.multiplier === 0.5 ? "½×" : group.multiplier === 0.25 ? "¼×" : `${group.multiplier}×`}</strong></li>)}</ul>
                  </section>
                );
              })}
            </div>
            <p className="detail-type-source">Carta de tipos derivada de <code>@smogon/calc</code> 0.12.0. Tipos neutros (1×) ficam omitidos. Relações gerais não indicam golpes legais, presença no jogo ou elegibilidade em regulamento do Champions.{unsupportedAttackTypes.length ? ` Sem multiplicador nesta carta: ${unsupportedAttackTypes.map(typeLabel).join(" / ")}.` : ""}</p>
          </>
        )}
      </section>
    </div>
  );
}
