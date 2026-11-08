import { useEffect, useMemo, useState } from "react";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { usageProviders } from "../data/usage/registry.js";
import { findUsagePokemonForCatalogEntry } from "../data/usage/pokemonQuery.js";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { hasPublishedStatPoints, mergeCategoryRows, selectRankedPartnerRows, selectUsageCapture } from "../data/usage/mergeUsageData.js";
import { applyBuilderMetaOption } from "../data/builderMeta.js";

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
const statFields = [["hp", "hp"], ["attack", "atk"], ["defense", "def"], ["spAttack", "spa"], ["spDefense", "spd"], ["speed", "spe"]];
const categoryIds = Object.fromEntries(categories.map(([key, , id]) => [key, id]));

function loadDetails(provider, index, pokemon, source) {
  if (source === "battleData") {
    const entry = findUsagePokemonForCatalogEntry(index?.pokemon, pokemon);
    return entry ? provider.loadPokemonUsage({ showdownId: entry.showdownId, season: index.season }) : null;
  }
  const entry = findUsagePokemonForCatalogEntry(index?.entries, pokemon);
  return entry ? provider.loadPokemonUsage({ id: entry.id, season: index.season }) : null;
}

function rowsFor(detail, source, categoryId) {
  if (!detail) return [];
  if (source === "battleData") return detail.rows.filter((row) => row.category === categoryId);
  const key = ({ move: "moves", held_item: "items", ability: "abilities", stat_alignment: "natures", stat_points: "spreads", teammate: "teammates" })[categoryId];
  return detail.entry.distributions[key] || [];
}

function sameValue(left, right) {
  return String(left || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
    === String(right || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function captureSummary(source, context) {
  const period = context?.season || "Período não informado";
  const snapshotDate = context?.capturedAt?.match(/^(\d{2})_(\d{2})_(\d{4})$/);
  const capture = context?.capturedAt
    ? snapshotDate ? `${snapshotDate[1]}/${snapshotDate[2]}/${snapshotDate[3]}` : context.capturedAt
    : source === "battleData" ? "snapshot sem data publicada" : "captura não informada";
  const sourceLabel = source === "metaRoll" ? "MetaRoll" : "Battle Data";
  if (source === "metaRoll" && context?.capturedAt && !Number.isNaN(Date.parse(context.capturedAt))) {
    return `${sourceLabel} · ${period} · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(context.capturedAt))} UTC`;
  }
  return `${sourceLabel} · ${period} · ${capture}`;
}

function Distribution({ row, category, member, onApplyOption }) {
  const value = row.selected?.percentageValue;
  const stats = row.statPoints;
  const pokemon = findPokemon(row.name);
  const application = category === "teammate" ? null : applyBuilderMetaOption(member, category, row);
  const applied = category === "move" ? member?.moves?.some((move) => move && sameValue(move, row.name))
    : category === "held_item" ? sameValue(member?.item, row.name)
      : category === "ability" ? sameValue(member?.ability, row.name)
        : category === "stat_alignment" ? sameValue(member?.nature, row.name)
          : category === "stat_points" && statFields.every(([source, target]) => Number.isInteger(stats?.[source]) && member?.statPoints?.[target] === stats[source]);
  const rank = row.selected?.rank;
  const contents = <>
    <span className="builder-meta-line"><span className="builder-meta-name">{pokemon && <PokemonSprite pokemon={pokemon} name={row.name} size={28} decorative />}{row.name || "Sem nome publicado"}</span>{category === "teammate" && Number.isInteger(rank) && rank > 0 && <span className="builder-meta-rank">Posição {rank}</span>}<span className="builder-meta-value">{Number.isFinite(value) ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</span></span>
    {category === "stat_points" ? hasPublishedStatPoints(stats) ? <span className="builder-meta-spread">{statLabels.map(([key, label]) => <span key={key}><small>{label}</small><b>{Number.isFinite(stats[key]) ? stats[key] : "—"}</b></span>)}</span> : <span className="stat-points-empty">Distribuição incompleta</span> : null}
  </>;
  return <li className={`builder-meta-row${applied ? " is-applied" : ""}`}>
    {category === "teammate" ? <div className="builder-meta-option is-readonly">{contents}</div> : <button className="builder-meta-option" type="button" aria-pressed={Boolean(applied)} disabled={!application?.ok} onClick={() => onApplyOption(category, row)}>{contents}<span className="builder-meta-action">{applied ? "Aplicado" : application?.ok ? "Aplicar" : "Indisponível"}</span>{!application?.ok && application?.error && <span className="builder-meta-apply-error">{application.error}</span>}</button>}
  </li>;
}

export function BuilderMetaPanel({ pokemon, member, onApplyOption }) {
  const [state, setState] = useState({ status: "loading", battle: null, metaRoll: null, contexts: {} });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([sources["pokemon-champions-battle-data"].loadIndex(), sources.metaroll.loadIndex()]).then(async ([battleIndex, metaIndex]) => {
      const indexes = {
        battleData: battleIndex.status === "fulfilled" ? battleIndex.value : null,
        metaRoll: metaIndex.status === "fulfilled" ? metaIndex.value : null,
      };
      const matches = {
        battleData: findUsagePokemonForCatalogEntry(indexes.battleData?.pokemon, pokemon),
        metaRoll: findUsagePokemonForCatalogEntry(indexes.metaRoll?.entries, pokemon),
      };
      const details = await Promise.allSettled([
        indexes.battleData && matches.battleData ? loadDetails(sources["pokemon-champions-battle-data"], indexes.battleData, pokemon, "battleData") : null,
        indexes.metaRoll && matches.metaRoll ? loadDetails(sources.metaroll, indexes.metaRoll, pokemon, "metaRoll") : null,
      ]);
      if (!active) return;
      const battle = details[0].status === "fulfilled" ? details[0].value : null;
      const metaRoll = details[1].status === "fulfilled" ? details[1].value : null;
      const failedSources = [battleIndex, metaIndex, ...details].filter((result) => result.status === "rejected").length;
      const published = Boolean(selectUsageCapture(Object.values(metaRoll?.entry?.distributions || {}).flat(), battle?.rows || [], {
        formats: { battleData: battle?.format || indexes.battleData?.format, metaRoll: metaRoll?.format || indexes.metaRoll?.format },
        seasons: { battleData: battle?.season || indexes.battleData?.season, metaRoll: metaRoll?.season || indexes.metaRoll?.season },
        activeSeason: indexes.battleData?.season,
      }));
      const hasMatch = Boolean(matches.battleData || matches.metaRoll);
      setState({
        status: published ? "ready" : failedSources ? "error" : hasMatch ? "no-sets" : "not-indexed",
        battle,
        metaRoll,
        contexts: {
          battleData: { format: battle?.format || indexes.battleData?.format, season: battle?.season || indexes.battleData?.season, capturedAt: battle?.date || null, sourceFile: battle?.sourceFile },
          metaRoll: { format: metaRoll?.format || indexes.metaRoll?.format, season: metaRoll?.season || indexes.metaRoll?.season, capturedAt: metaRoll?.capturedAt || indexes.metaRoll?.capturedAt },
        },
        indexes,
        failedSources,
      });
    }).catch(() => { if (active) setState({ status: "error", battle: null, metaRoll: null, contexts: {} }); });
    return () => { active = false; };
  }, [pokemon, attempt]);

  const selectedSource = selectUsageCapture(Object.values(state.metaRoll?.entry?.distributions || {}).flat(), state.battle?.rows || [], {
    formats: { battleData: state.contexts.battleData?.format, metaRoll: state.contexts.metaRoll?.format },
    seasons: { battleData: state.contexts.battleData?.season, metaRoll: state.contexts.metaRoll?.season },
    activeSeason: state.indexes?.battleData?.season,
  });
  const distributions = useMemo(() => categories.map(([key, title, categoryId]) => {
    const rows = mergeCategoryRows({
      battleRows: selectedSource === "battleData" ? rowsFor(state.battle, "battleData", categoryId) : [],
      metaRows: selectedSource === "metaRoll" ? rowsFor(state.metaRoll, "metaRoll", categoryId) : [],
      categoryId,
      preferredSource: selectedSource || "metaRoll",
      formats: { battleData: state.contexts.battleData?.format, metaRoll: state.contexts.metaRoll?.format },
      contexts: state.contexts,
      resolvePokemon: (entry) => resolveCompetitivePokemonSprite(findPokemon, { id: entry.showdownId || entry.id, name: entry.name }),
    });
    return [key, title, key === "teammates" ? selectRankedPartnerRows(rows) : rows.slice(0, 6)];
  }), [selectedSource, state]);

  const selectedContext = selectedSource ? state.contexts[selectedSource] : null;
  const selectedProvider = selectedSource === "metaRoll" ? sources.metaroll : sources["pokemon-champions-battle-data"];
  return <section className="builder-meta-panel" aria-labelledby="builder-meta-title">
    <div className="builder-meta-heading"><div><p className="page-label">Doubles · Pokémon Champions</p><h2 id="builder-meta-title">Meta de {pokemon.name}</h2></div></div>
    {state.status === "loading" && <p role="status">Carregando as distribuições…</p>}
    {state.status === "error" && <div role="status"><p>Não foi possível carregar o meta agora.</p><button className="button button-outline button-small" type="button" onClick={() => { setState({ status: "loading", battle: null, metaRoll: null, contexts: {} }); setAttempt((value) => value + 1); }}>Tentar novamente</button></div>}
    {state.status === "not-indexed" && <p role="status">Esta forma não consta no índice de uso atual de Doubles.</p>}
    {state.status === "no-sets" && <p role="status">Sem sets publicados para esta espécie neste recorte.</p>}
    {state.status === "ready" && <>
      {state.failedSources > 0 && <p className="builder-meta-partial" role="status">Parte do meta está indisponível; os dados recebidos continuam visíveis.</p>}
      {onApplyOption && <p className="builder-meta-apply-hint">Selecione uma opção para aplicar ao Pokémon da posição ativa.</p>}
      {selectedSource && <p className="usage-provenance usage-provenance-inline">{captureSummary(selectedSource, selectedContext)}</p>}
      <div className="builder-meta-grid">{distributions.map(([key, title, rows]) => <section className="builder-meta-category" key={key}>
        <div><h3>{title}</h3><span>{rows.length || "—"}</span></div>
        {rows.length ? <ol>{rows.map((row) => <Distribution key={row.key} row={row} category={categoryIds[key]} member={member} onApplyOption={onApplyOption} />)}</ol> : <p>Sem dados publicados.</p>}
      </section>)}</div>
      {onApplyOption && <p className="builder-meta-apply-status" role="status" aria-live="polite">Seleções alteram apenas esta posição.</p>}
      <details className="builder-meta-about"><summary>Sobre os dados</summary>
        <p>Distribuições de capturas diferentes não são combinadas.</p>
        {selectedProvider && <p><a href={selectedProvider.source.url} target="_blank" rel="noreferrer">Fonte e atribuição ↗</a></p>}
      </details>
    </>}
  </section>;
}
