import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { formatNationalNumber } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import moveData from "@spinda-stop/data/moves";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag, typeLabel } from "../components/TypeTag.jsx";
import { loadPokemonLearnsets } from "../data/loadPokemonLearnsets.js";
import { filterPokemonLearnsets, formatMoveLearnMethod, formatVersionGroup, getEvolutionNeighbors } from "../data/pokemonLearnsets.js";
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

function EvolutionSection({ pokemon }) {
  const chain = getEvolutionNeighbors(dexData.pokemon, pokemon.speciesId);
  if (!chain.previous && chain.next.length === 0) return null;

  const entries = [
    ...(chain.previous ? [{ pokemon: chain.previous, label: "Pré-evolução" }] : []),
    ...(chain.current ? [{ pokemon: chain.current, label: "Espécie atual" }] : []),
    ...chain.next.map((entry) => ({ pokemon: entry, label: "Evolução" })),
  ];
  return (
    <section className="detail-evolutions" id="detail-evolution" aria-labelledby="evolution-heading">
      <div className="section-heading"><h2 id="evolution-heading">Linha evolutiva</h2><span>PokéAPI · relação por espécie</span></div>
      <ol className="evolution-list">
        {entries.map(({ pokemon: entry, label }) => (
          <li className={entry.speciesId === pokemon.speciesId ? "is-current" : ""} key={entry.speciesId}>
            <span>{label}</span>
            <Link to={`/dex/${entry.slug}`} aria-current={entry.speciesId === pokemon.speciesId ? "page" : undefined}>
              <PokemonSprite pokemon={entry} name={entry.name} size={54} decorative />
              <strong>{entry.name}</strong>
              <small>{entry.types.map(typeLabel).join(" / ")}</small>
            </Link>
          </li>
        ))}
      </ol>
      <p className="form-hint">A relação descreve evolução entre espécies; não confirma presença, forma permitida ou legalidade em Pokémon Champions.</p>
    </section>
  );
}

function MoveLearnsetSection({ pokemon, learnsetState, onRetry }) {
  const [filters, setFilters] = useState({ query: "", type: "", category: "", methodId: "", versionGroupId: "" });
  const learnsets = learnsetState.data;
  const rows = useMemo(
    () => filterPokemonLearnsets(learnsets?.rows, moveData.moves, filters),
    [filters, learnsets],
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const methods = learnsets?.methods || [];
  const versions = learnsets?.versionGroups || [];
  return (
    <section className="detail-learnsets" id="detail-moves" aria-labelledby="learnsets-heading">
      <div className="section-heading detail-learnsets-heading">
        <div><p className="page-label">Por jogo e forma</p><h2 id="learnsets-heading">Golpes aprendidos</h2></div>
        <span>{learnsetState.status === "ready" ? `${rows.length} registros` : "PokéAPI"}</span>
      </div>
      <p className="detail-learnset-scope">Aprendibilidade geral na versão selecionada. Não confirma compatibilidade do set nem legalidade em Pokémon Champions.</p>
      {learnsetState.status === "loading" ? <p className="form-hint" role="status">Carregando os dados da forma…</p> : null}
      {learnsetState.status === "error" ? <div className="detail-learnset-error" role="alert"><p>{learnsetState.error}</p><button className="button button-outline button-small" type="button" onClick={onRetry}>Tentar novamente</button></div> : null}
      {learnsets ? <>
        <div className="detail-learnset-filters" aria-label="Filtros de golpes">
          <label><span>Golpe</span><input type="search" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Buscar golpe" /></label>
          <label><span>Versão</span><select value={filters.versionGroupId} onChange={(event) => updateFilter("versionGroupId", event.target.value)}><option value="">Todos os jogos</option>{versions.map((version) => <option value={version.id} key={version.id}>{formatVersionGroup(version.name)}</option>)}</select></label>
          <label><span>Método</span><select value={filters.methodId} onChange={(event) => updateFilter("methodId", event.target.value)}><option value="">Todos</option>{methods.map((method) => <option value={method.id} key={method.id}>{formatMoveLearnMethod(method.name)}</option>)}</select></label>
          <label><span>Tipo do golpe</span><select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}><option value="">Todos</option>{dexData.types.map((type) => <option value={type} key={type}>{typeLabel(type)}</option>)}</select></label>
          <label><span>Categoria</span><select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">Todas</option><option value="physical">Físico</option><option value="special">Especial</option><option value="status">Status</option></select></label>
        </div>
        {rows.length ? <ul className="detail-move-list">{rows.map((row) => {
          const search = new URLSearchParams({ attacker: pokemon.name, move: row.move.name });
          const methodLabel = formatMoveLearnMethod(methods.find((method) => method.id === row.methodId)?.name);
          const versionName = versions.find((version) => version.id === row.versionGroupId)?.name;
          return (
            <li key={`${row.move.id}-${row.versionGroupId}-${row.methodId}-${row.level}-${row.order}`}>
              <div className="detail-move-copy"><strong>{row.move.name}</strong><span><TypeTag type={row.move.type} /> <span>{row.move.category === "physical" ? "Físico" : row.move.category === "special" ? "Especial" : row.move.category === "status" ? "Status" : "Categoria não definida"}</span></span></div>
              <div className="detail-move-learning"><span>{formatVersionGroup(versionName)}</span><span>{methodLabel}{row.level > 0 ? ` · nível ${row.level}` : ""}{row.mastery ? " · maestria" : ""}</span></div>
              <Link className="text-button detail-move-calc" to={`/calculator?${search}`} aria-label={`Preparar ${row.move.name} com ${pokemon.name} na calculadora`}>Preparar cálculo</Link>
            </li>
          );
        })}</ul> : <p className="detail-learnset-empty" role="status">A fonte não lista golpes para esta combinação de filtros e forma. Isso não determina compatibilidade ou legalidade em Pokémon Champions.</p>}
        <a className="source-link" href={learnsets.metadata.sourceUrl} target="_blank" rel="noreferrer">Fonte: PokéAPI {learnsets.metadata.sourceCommit.slice(0, 7)} ↗</a>
      </> : null}
    </section>
  );
}

export function DexDetailPage() {
  const { slug = "" } = useParams();
  const summary = dexData.pokemon.find((entry) => entry.slug === slug);
  const pokemon = summary ? { ...summary, ...detailData.pokemonBySlug[slug] } : null;
  const [learnsetState, setLearnsetState] = useState({ requestKey: "", status: "idle", data: null, error: "" });
  const [learnsetRetry, setLearnsetRetry] = useState(0);

  useEffect(() => {
    if (!summary?.spriteId) return undefined;
    let active = true;
    const requestKey = `${summary.spriteId}:${learnsetRetry}`;
    loadPokemonLearnsets(summary.spriteId).then((data) => {
      if (active) setLearnsetState({ requestKey, status: "ready", data, error: "" });
    }).catch((error) => {
      if (active) setLearnsetState({ requestKey, status: "error", data: null, error: error instanceof Error ? error.message : "Não foi possível carregar os dados de aprendibilidade." });
    });
    return () => { active = false; };
  }, [summary?.spriteId, learnsetRetry]);

  const currentLearnsetRequestKey = summary?.spriteId ? `${summary.spriteId}:${learnsetRetry}` : "";
  const currentLearnsetState = learnsetState.requestKey === currentLearnsetRequestKey
    ? learnsetState
    : { status: summary?.spriteId ? "loading" : "idle", data: null, error: "" };

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
        {getEvolutionNeighbors(dexData.pokemon, pokemon.speciesId).previous || getEvolutionNeighbors(dexData.pokemon, pokemon.speciesId).next.length ? <a href="#detail-evolution">Evolução</a> : null}
        {forms.length > 1 ? <a href="#detail-forms">Formas</a> : null}
        <a href="#detail-stats">Stats base</a>
        <a href="#detail-types">Relações de tipo</a>
        <a href="#detail-moves">Golpes aprendidos</a>
        <a href="#detail-profile">Dados da espécie</a>
      </nav>

      <EvolutionSection pokemon={pokemon} />

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

      <MoveLearnsetSection
        pokemon={pokemon}
        learnsetState={currentLearnsetState}
        onRetry={() => setLearnsetRetry((current) => current + 1)}
      />
    </div>
  );
}
