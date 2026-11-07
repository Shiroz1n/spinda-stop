import { useEffect, useMemo, useState } from "react";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { usageProviders } from "../data/usage/registry.js";
import { findUsagePokemonByReference } from "../data/usage/pokemonQuery.js";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { mergeCategoryRows, selectRankedPartnerRows } from "../data/usage/mergeUsageData.js";

const sources = usageProviders;
const findPokemon = createPokemonSpriteLookup(dexData.pokemon);
const categories = [
  ["moves", "Golpes", "move"],
  ["items", "Itens", "held_item"],
  ["abilities", "Habilidades", "ability"],
  ["natures", "Natures", "stat_alignment"],
  ["spreads", "Stat Points", "stat_points"],
  ["teammates", "Parceiros", "teammate"],
];
const statLabels = [["hp", "HP"], ["attack", "Atk"], ["defense", "Def"], ["spAttack", "SpA"], ["spDefense", "SpD"], ["speed", "Spe"]];

function loadDetails(provider, index, reference, source) {
  if (source === "battleData") {
    const entry = findUsagePokemonByReference(index?.pokemon, reference);
    return entry ? provider.loadPokemonUsage({ showdownId: entry.showdownId, season: index.season }) : null;
  }
  const entry = findUsagePokemonByReference(index?.entries, reference);
  return entry ? provider.loadPokemonUsage({ id: entry.id, season: index.season }) : null;
}

function rowsFor(detail, source, categoryId) {
  if (!detail) return [];
  if (source === "battleData") return detail.rows.filter((row) => row.category === categoryId);
  const key = ({ move: "moves", held_item: "items", ability: "abilities", stat_alignment: "natures", stat_points: "spreads", teammate: "teammates" })[categoryId];
  return detail.entry.distributions[key] || [];
}

function Distribution({ row }) {
  const value = row.selected?.percentageValue;
  const stats = row.statPoints;
  const pokemon = findPokemon(row.name);
  return <li className="builder-meta-row">
    <span className="builder-meta-name">{pokemon && <PokemonSprite pokemon={pokemon} name={row.name} size={28} decorative />}{row.name || "Sem nome publicado"}</span>
    {stats && <span className="builder-meta-spread">{statLabels.map(([key, label]) => <span key={key}><small>{label}</small><b>{Number.isFinite(stats[key]) ? stats[key] : "—"}</b></span>)}</span>}
    <span className="builder-meta-value">{Number.isFinite(value) ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</span>
  </li>;
}

export function BuilderMetaPanel({ pokemon }) {
  const [state, setState] = useState({ status: "loading", battle: null, metaRoll: null, contexts: {} });

  useEffect(() => {
    let active = true;
    setState({ status: "loading", battle: null, metaRoll: null, contexts: {} });
    Promise.allSettled([sources["pokemon-champions-battle-data"].loadIndex(), sources.metaroll.loadIndex()]).then(async ([battleIndex, metaIndex]) => {
      const indexes = {
        battleData: battleIndex.status === "fulfilled" ? battleIndex.value : null,
        metaRoll: metaIndex.status === "fulfilled" ? metaIndex.value : null,
      };
      const details = await Promise.allSettled([
        indexes.battleData && loadDetails(sources["pokemon-champions-battle-data"], indexes.battleData, pokemon.name, "battleData"),
        indexes.metaRoll && loadDetails(sources.metaroll, indexes.metaRoll, pokemon.name, "metaRoll"),
      ]);
      if (!active) return;
      const battle = details[0].status === "fulfilled" ? details[0].value : null;
      const metaRoll = details[1].status === "fulfilled" ? details[1].value : null;
      const available = battle || metaRoll;
      setState({
        status: available ? "ready" : "error",
        battle,
        metaRoll,
        contexts: {
          battleData: { format: battle?.format || indexes.battleData?.format, season: battle?.season || indexes.battleData?.season, capturedAt: battle?.date || indexes.battleData?.generatedAt, sourceFile: battle?.sourceFile },
          metaRoll: { format: metaRoll?.format || indexes.metaRoll?.format, season: metaRoll?.season || indexes.metaRoll?.season, capturedAt: metaRoll?.capturedAt || indexes.metaRoll?.capturedAt },
        },
        indexes,
        failedSources: [battleIndex, metaIndex, ...details.filter((result) => result.status === "rejected")].filter((result) => result.status === "rejected").length,
      });
    }).catch(() => { if (active) setState({ status: "error", battle: null, metaRoll: null, contexts: {} }); });
    return () => { active = false; };
  }, [pokemon.slug, pokemon.name]);

  const distributions = useMemo(() => categories.map(([key, title, categoryId]) => {
    const rows = mergeCategoryRows({
      battleRows: rowsFor(state.battle, "battleData", categoryId),
      metaRows: rowsFor(state.metaRoll, "metaRoll", categoryId),
      categoryId,
      formats: { battleData: state.contexts.battleData?.format, metaRoll: state.contexts.metaRoll?.format },
      contexts: state.contexts,
      resolvePokemon: (entry) => resolveCompetitivePokemonSprite(findPokemon, { id: entry.showdownId || entry.id, name: entry.name }),
    });
    return [key, title, key === "teammates" ? selectRankedPartnerRows(rows) : rows.slice(0, 6)];
  }), [state]);

  const contexts = Object.entries(state.contexts).filter(([, context]) => context?.season || context?.capturedAt).map(([source, context]) => ({ source, ...context }));
  return <section className="builder-meta-panel" aria-labelledby="builder-meta-title">
    <div className="builder-meta-heading"><div><p className="page-label">Doubles · Pokémon Champions</p><h2 id="builder-meta-title">Meta de {pokemon.name}</h2></div><span>Capturas disponíveis</span></div>
    {state.status === "loading" && <p role="status">Carregando as distribuições…</p>}
    {state.status === "error" && <p role="status">O meta desta espécie não está disponível agora.</p>}
    {state.status === "ready" && <>
      {state.failedSources > 0 && <p className="builder-meta-partial" role="status">Uma fonte não respondeu; os dados disponíveis continuam visíveis.</p>}
      <div className="builder-meta-grid">{distributions.map(([key, title, rows]) => <section className="builder-meta-category" key={key}>
        <div><h3>{title}</h3><span>{rows.length || "—"}</span></div>
        {rows.length ? <ol>{rows.map((row) => <Distribution key={row.key} row={row} />)}</ol> : <p>Sem distribuição publicada.</p>}
      </section>)}</div>
      <details className="builder-meta-about"><summary>Fontes e capturas</summary>
        <p>Cada métrica usa uma captura; períodos diferentes não são calculados em média.</p>
        <ul>{contexts.map(({ source, format, season, capturedAt }) => <li key={source}><a href={sources[source === "metaRoll" ? "metaroll" : "pokemon-champions-battle-data"].source.url} target="_blank" rel="noreferrer">{sources[source === "metaRoll" ? "metaroll" : "pokemon-champions-battle-data"].source.label}</a>{format ? ` · ${format}` : ""}{season ? ` · ${season}` : ""}{capturedAt ? ` · ${capturedAt}` : ""}</li>)}</ul>
      </details>
    </>}
  </section>;
}
