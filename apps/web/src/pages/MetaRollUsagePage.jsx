import { useEffect, useRef, useState } from "react";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { usageProviders } from "../data/usage/registry.js";
import { findUsagePokemonByReference } from "../data/usage/pokemonQuery.js";
import { useCacheRevalidation } from "../data/usage/useCacheRevalidation.js";
import { MetaRollLadderView } from "./MetaRollLadderView.jsx";

const distributionSections = [
  ["moves", "Golpes"],
  ["items", "Itens"],
  ["abilities", "Habilidades"],
  ["natures", "Naturezas"],
  ["teammates", "Parceiros"],
  ["spreads", "Stat Points"],
];

const profileTabs = [
  ["summary", "Resumo"],
  ...distributionSections,
  ["mega", "Formas Mega"],
  ["matchups", "Matchups"],
  ["history", "Histórico"],
];

const filters = [
  ["moves", "Golpe"],
  ["items", "Item"],
  ["abilities", "Habilidade"],
];

const metaRollProvider = usageProviders.metaroll;
const metaRollSource = metaRollProvider.source;
const findPokemonSprite = createPokemonSpriteLookup(dexData.pokemon);

const statLabels = [
  ["hp", "HP"],
  ["attack", "Atk"],
  ["defense", "Def"],
  ["spAttack", "SpA"],
  ["spDefense", "SpD"],
  ["speed", "Spe"],
];

function normalizeSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function formatCapture(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function displayPercent(value) {
  return Number.isFinite(value) ? value + "%" : "não informado";
}

function DistributionCard({ title, rows, spread = false, note = "", pokemonRows = false }) {
  return (
    <section className="metaroll-card">
      <div className="metaroll-card-heading">
        <h3>{title}</h3>
        <span>{rows.length}</span>
      </div>
      {note ? <p className="metaroll-card-note">{note}</p> : null}
      {rows.length === 0 ? (
        <p className="metaroll-empty">A fonte não publicou valores nesta categoria.</p>
      ) : (
        <ol className="metaroll-list">
          {rows.map((row, index) => {
            const hasBar = Number.isFinite(row.percentageValue);
            const barWidth = hasBar ? Math.max(0, Math.min(100, row.percentageValue)) + "%" : "0%";
            return (
              <li className="metaroll-list-row" key={row.name + "-" + index}>
                <div className="metaroll-row-top">
                  <span className="metaroll-row-rank">#{row.rank}</span>
                  {spread ? (
                    <div className="usage-spread" aria-label="Distribuição de Stat Points">
                      {statLabels.map(([key, label]) => (
                        <span key={key}>
                          <small>{label}</small>
                          <b>{row.statPoints?.[key] ?? "—"}</b>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="metaroll-row-identity">
                      {pokemonRows && findPokemonSprite(row.name) ? <PokemonSprite pokemon={findPokemonSprite(row.name)} name={row.name} size={44} decorative /> : null}
                      <strong>{row.name || "Nome não informado"}</strong>
                    </span>
                  )}
                  <b
                    className={hasBar ? "metaroll-row-percent" : "metaroll-row-percent is-missing"}
                    aria-label={hasBar ? undefined : "Percentual não informado"}
                    title={hasBar ? undefined : "Percentual não informado"}
                  >
                    {hasBar ? displayPercent(row.percentageValue) : "—"}
                  </b>
                </div>
                {hasBar ? <div className="usage-bar-track" aria-hidden="true"><span style={{ width: barWidth }} /></div> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function HistoryUsageCard({ record }) {
  return (
    <section className="metaroll-history-usage">
      <p className="page-label">Uso diário publicado</p>
      <h3>{record.date}</h3>
      <p className="metaroll-card-note">Este histórico guarda apenas os destaques do dia: até 8 golpes, 6 itens e 3 habilidades.</p>
      <div className="metaroll-profile-grid">
        {[["moves", "Golpes"], ["items", "Itens"], ["abilities", "Habilidades"]].map(([key, label]) => (
          <DistributionCard key={key} title={label} rows={record[key]} />
        ))}
      </div>
    </section>
  );
}

function MegaFormsCard({ state, rows, onRetry }) {
  return (
    <section className="metaroll-card metaroll-mega-card" aria-labelledby="metaroll-mega-heading">
      <div className="metaroll-card-heading"><h3 id="metaroll-mega-heading">Formas Mega e pedras associadas</h3><span>{rows.length}</span></div>
      {state.status === "loading" ? <p className="usage-loading" role="status"><span className="usage-spinner" aria-hidden="true" />Carregando formas Mega…</p> : null}
      {state.status === "error" ? (
        <div className="usage-error" role="alert"><div><strong>Não foi possível consultar as formas Mega.</strong><p>{state.error}</p></div><button className="button button-outline button-small" type="button" onClick={onRetry}>Tentar de novo</button></div>
      ) : null}
          {state.status === "success" || rows.length > 0 ? (
        <>
          <div className="metaroll-mega-provenance">
            <div><span>Fonte</span><a href={metaRollSource.url} target="_blank" rel="noreferrer">Dados competitivos: MetaRoll</a></div>
            <div><span>Temporada da resposta</span><strong>{state.data.season || "não informada"}</strong></div>
            <div><span>Captura própria</span><strong>{formatCapture(state.data.capturedAt)}</strong></div>
            <div><span>Última consulta do app</span><strong>{formatCapture(state.data.appFetchedAt)}</strong></div>
          </div>
          {rows.length > 0 ? (
            <ol className="metaroll-mega-list">
              {rows.map((row) => (
                <li key={`${row.formName}-${row.stone}`}>
                  {findPokemonSprite(row.formName) ? <PokemonSprite pokemon={findPokemonSprite(row.formName)} name={row.formName} size={48} decorative /> : <span className="pokemon-art pokemon-art-fallback" aria-hidden="true">MEGA</span>}
                  <div><strong>{row.formName || "Forma não informada"}</strong><span>{row.stone || "Pedra não informada"}</span></div>
                  <b>{displayPercent(row.percent)}</b>
                </li>
              ))}
            </ol>
          ) : <p className="metaroll-empty">A fonte não listou forma Mega associada a este Pokémon nesta captura.</p>}
          <p className="metaroll-card-note">O percentual é o uso publicado para a pedra associada à forma; não é chance de Mega Evolução nem percentual de partidas.</p>
        </>
      ) : null}
    </section>
  );
}

function MatchupSpeciesCard({ title, rows, outcomeLabel }) {
  return (
    <section className="metaroll-card">
      <div className="metaroll-card-heading"><h3>{title}</h3><span>{rows.length}</span></div>
      {rows.length === 0 ? <p className="metaroll-empty">Nenhuma linha foi devolvida nesta categoria.</p> : (
        <ol className="metaroll-list matchup-list">
          {rows.map((row, index) => (
            <li className="metaroll-list-row matchup-row" key={row.name + "-" + index}>
              <span className="metaroll-row-rank">#{index + 1}</span>
              {findPokemonSprite(row.name) ? <PokemonSprite pokemon={findPokemonSprite(row.name)} name={row.name} size={42} decorative /> : null}
              <strong>{row.name}</strong>
              <span>{row.games === null ? "contagem não informada" : `${row.games} ${outcomeLabel}`}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MatchupMoveCard({ title, rows, outcomeLabel }) {
  return (
    <section className="metaroll-card">
      <div className="metaroll-card-heading"><h3>{title}</h3><span>{rows.length}</span></div>
      {rows.length === 0 ? <p className="metaroll-empty">Nenhuma linha foi devolvida nesta categoria.</p> : (
        <ol className="metaroll-list matchup-list">
          {rows.map((row, index) => (
            <li className="metaroll-list-row matchup-row" key={row.name + "-" + index}>
              <span className="metaroll-row-rank">#{index + 1}</span>
              <strong>{row.name}</strong>
              <span>{row.percent === null ? "percentual não informado" : `${row.percent}% ${outcomeLabel}`}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MetaRollUsagePage({ initialPokemonName = "", onPokemonSelect }) {
  const [indexData, setIndexData] = useState(null);
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [season, setSeason] = useState("");
  const [indexStatus, setIndexStatus] = useState("loading");
  const [indexError, setIndexError] = useState("");
  const [indexRetry, setIndexRetry] = useState(0);
  const indexForceKey = useRef("");
  const [query, setQuery] = useState(initialPokemonName);
  const initialPokemonNameRef = useRef(initialPokemonName);
  const [moveFilter, setMoveFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [abilityFilter, setAbilityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("rank");
  const [selectedId, setSelectedId] = useState(null);
  const [entryState, setEntryState] = useState({ key: "", status: "idle" });
  const [entryRetry, setEntryRetry] = useState(0);
  const entryForceKey = useRef("");
  const [megaState, setMegaState] = useState({ key: "", status: "idle" });
  const [megaRetry, setMegaRetry] = useState(0);
  const megaForceKey = useRef("");
  const [selectedUsageDate, setSelectedUsageDate] = useState("");
  const [activeProfileSection, setActiveProfileSection] = useState("summary");
  const [view, setView] = useState("species");
  const entryRequestKey = `${season || "current"}|${selectedId || ""}|${entryRetry}`;
  const megaRequestKey = `${season || "current"}|${selectedId || ""}|${megaRetry}`;
  const currentEntryState = entryState.key === entryRequestKey
    ? entryState
    : entryState.key.startsWith(`${season || "current"}|${selectedId || ""}|`)
      ? { ...entryState, key: entryRequestKey, status: selectedId ? "loading" : "idle" }
      : { key: entryRequestKey, status: selectedId ? "loading" : "idle" };
  const entry = currentEntryState.entry || null;
  const entryCapture = currentEntryState.capture || null;
  const entryStatus = currentEntryState.status;
  const entryError = currentEntryState.error || "";
  const currentMegaState = megaState.key === megaRequestKey
    ? megaState
    : megaState.key.startsWith(`${season || "current"}|${selectedId || ""}|`)
      ? { ...megaState, key: megaRequestKey, status: selectedId ? "loading" : "idle" }
      : { key: megaRequestKey, status: selectedId ? "loading" : "idle" };

  function refreshIndex(force = false) {
    const nextRetry = indexRetry + 1;
    indexForceKey.current = force ? `${season || "current"}|${nextRetry}` : "";
    setIndexStatus("loading");
    setIndexError("");
    setIndexRetry(nextRetry);
  }

  function refreshSelected(force = false) {
    if (!selectedId) return;
    const nextEntryRetry = entryRetry + 1;
    const nextMegaRetry = megaRetry + 1;
    const key = `${season || "current"}|${selectedId}|`;
    entryForceKey.current = force ? `${key}${nextEntryRetry}` : "";
    megaForceKey.current = force ? `${key}${nextMegaRetry}` : "";
    setEntryRetry(nextEntryRetry);
    setMegaRetry(nextMegaRetry);
  }

  function refreshVisibleData() {
    refreshIndex(true);
    refreshSelected(true);
  }

  useCacheRevalidation(indexData?.cacheExpiresAt, () => refreshIndex(false), Boolean(indexData) && view === "species");
  useCacheRevalidation(entryCapture?.cacheExpiresAt, () => refreshSelected(false), Boolean(entry) && view === "species");

  useEffect(() => {
    initialPokemonNameRef.current = initialPokemonName;
  }, [initialPokemonName]);

  useEffect(() => {
    let active = true;
    const requestKey = `${season || "current"}|${indexRetry}`;
    const force = indexForceKey.current === requestKey;
    if (force) indexForceKey.current = "";
    metaRollProvider.loadIndex({ season: season || undefined, force }).then((result) => {
      if (!active) return;
      setIndexData(result);
      setIndexStatus("success");
      setSeasonOptions((current) => current.length > 0 ? current : result.pastSeasons);
      setSelectedId((current) => {
        if (result.entries.some((item) => item.id === current)) return current;
        if (initialPokemonNameRef.current) {
          return findUsagePokemonByReference(result.entries, initialPokemonNameRef.current)?.id || null;
        }
        return [...result.entries].sort((left, right) => {
          const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
          const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
          return leftRank - rightRank;
        })[0]?.id || null;
      });
    }).catch(() => {
      if (!active) return;
      setIndexStatus("error");
      setIndexError("MetaRoll não respondeu. Tente novamente mais tarde.");
    });

    return () => { active = false; };
  }, [season, indexRetry]);

  useEffect(() => {
    if (view !== "species" || !selectedId) return undefined;
    let active = true;
    const requestKey = `${season || "current"}|${selectedId}|${entryRetry}`;
    const force = entryForceKey.current === requestKey;
    if (force) entryForceKey.current = "";

    metaRollProvider.loadPokemonUsage({
      id: selectedId,
      season: season || undefined,
      force,
    }).then((result) => {
      if (!active) return;
      setEntryState({
        key: requestKey,
        status: "success",
        entry: result.entry,
        capture: {
          season: result.season,
          capturedAt: result.capturedAt,
          comparedTo: result.comparedTo,
          format: result.format,
          appFetchedAt: result.appFetchedAt,
          cacheExpiresAt: result.cacheExpiresAt,
        },
      });
      setSelectedUsageDate((current) => result.entry.usageHistory.some((snapshot) => snapshot.date === current)
        ? current
        : result.entry.usageHistory.at(-1)?.date || "");
    }).catch(() => {
      if (!active) return;
      setEntryState((previous) => ({
        key: requestKey,
        status: "error",
        error: "MetaRoll pode estar temporariamente indisponível para esta espécie.",
        ...(previous.key.startsWith(`${season || "current"}|${selectedId}|`) ? { entry: previous.entry, capture: previous.capture } : {}),
      }));
    });

    return () => { active = false; };
  }, [view, selectedId, season, entryRetry]);

  useEffect(() => {
    if (view !== "species" || !selectedId) return undefined;
    let active = true;
    const force = megaForceKey.current === megaRequestKey;
    if (force) megaForceKey.current = "";

    metaRollProvider.loadMegas({ season: season || undefined, force }).then((data) => {
      if (active) setMegaState({ key: megaRequestKey, status: "success", data });
    }).catch(() => {
      if (active) setMegaState((previous) => ({
        key: megaRequestKey,
        status: "error",
        error: "MetaRoll pode estar temporariamente indisponível para esta captura.",
        ...(previous.key.startsWith(`${season || "current"}|${selectedId}|`) ? { data: previous.data } : {}),
      }));
    });

    return () => { active = false; };
  }, [view, selectedId, season, megaRetry, megaRequestKey]);

  const entries = indexData?.entries || [];
  const facetOptions = Object.fromEntries(filters.map(([key]) => [
    key,
    Array.from(new Set(entries.flatMap((item) => item.filterValues[key] || [])))
      .sort((left, right) => left.localeCompare(right, "pt-BR")),
  ]));
  const normalizedQuery = normalizeSearch(query.trim());
  const visibleEntries = entries.filter((item) => {
    const nameMatches = normalizeSearch(item.name).includes(normalizedQuery)
      || normalizeSearch(item.id).includes(normalizedQuery);
    return nameMatches
      && (moveFilter === "all" || item.filterValues.moves.includes(moveFilter))
      && (itemFilter === "all" || item.filterValues.items.includes(itemFilter))
      && (abilityFilter === "all" || item.filterValues.abilities.includes(abilityFilter));
  }).sort((left, right) => {
    if (sortBy === "name") return left.name.localeCompare(right.name, "pt-BR");
    return (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY)
      || left.name.localeCompare(right.name, "pt-BR");
  });
  const selectedEntry = entries.find((item) => item.id === selectedId) || null;
  const selectedHistory = entry?.usageHistory.find((item) => item.date === selectedUsageDate) || null;
  const selectedMegaRows = currentMegaState.data
    ? currentMegaState.data.entries.filter((item) => item.id === selectedId)
    : [];

  return (
    <div className="usage-source-content">
      <div className="usage-source-banner metaroll-source-banner">
        <span className="usage-source-icon" aria-hidden="true">MR</span>
        <div className="usage-source-copy">
          <a href={metaRollSource.url} target="_blank" rel="noreferrer">{metaRollSource.attribution}</a>
          <span>Doubles · fonte e temporada preservadas</span>
        </div>
        <details className="usage-source-details">
          <summary>Sobre os dados</summary>
          <p>Esta tela mantém os dados da MetaRoll separados de Pokémon Champions Battle Data.</p>
          <a className="usage-source-guide" href={metaRollSource.guideUrl} target="_blank" rel="noreferrer">Guia da API ↗</a>
        </details>
      </div>

      {view === "species" && indexData ? (
        <div className="metaroll-capture-note" aria-label="Captura e período da fonte">
          <span><b>Formato</b> Doubles</span>
          <span><b>Temporada</b> {indexData.season || "não informada"}</span>
          <details className="metaroll-capture-more"><summary>Sobre esta captura</summary><div><span><b>Captura</b> {formatCapture(indexData.capturedAt)}</span><span><b>Última consulta</b> {formatCapture(indexData.appFetchedAt)}</span><span><b>Pokémon ranqueados</b> {indexData.count}</span></div><p>A temporada é o nome da fonte; o regulamento oficial não foi confirmado. A contagem é de Pokémon ranqueados, não de partidas.</p></details>
        </div>
      ) : null}
      {view === "species" && indexData ? <button className="button button-outline button-small metaroll-refresh" type="button" disabled={indexStatus === "loading"} onClick={refreshVisibleData}>{indexStatus === "loading" ? "Atualizando…" : "Atualizar agora"}</button> : null}

      <div className="metaroll-view-switch" role="group" aria-label="Seção da fonte MetaRoll">
        <button className={view === "species" ? "is-active" : ""} type="button" aria-pressed={view === "species"} onClick={() => {
          if (view === "species") return;
          setView("species");
          setEntryState({ key: "", status: "loading" });
        }}>Espécies</button>
        <button className={view === "trainers" ? "is-active" : ""} type="button" aria-pressed={view === "trainers"} onClick={() => {
          if (view === "trainers") return;
          setView("trainers");
        }}>Ladder de jogadores</button>
      </div>

      {view === "species" && indexStatus === "loading" ? (
        <div className="usage-index-state" role="status">
          <span className="usage-spinner" aria-hidden="true" />
          Carregando o arquivo de Doubles da MetaRoll…
        </div>
      ) : null}

      {view === "species" && indexStatus === "error" ? (
        <div className="usage-error usage-index-error" role="alert">
          <div><strong>O índice da MetaRoll não está disponível agora.</strong><p>{indexError}</p></div>
          <button className="button button-outline" type="button" onClick={() => {
            setIndexStatus("loading");
            const nextRetry = indexRetry + 1;
            indexForceKey.current = `${season || "current"}|${nextRetry}`;
            setIndexRetry(nextRetry);
          }}>Tentar de novo</button>
        </div>
      ) : null}

      {view === "trainers" ? (
        <MetaRollLadderView
          key={season || "current"}
          season={season}
          seasonOptions={seasonOptions}
          currentSeason={indexData?.season}
          onSeasonChange={(nextSeason) => {
            setSeason(nextSeason);
            setIndexData(null);
            setIndexStatus("loading");
            indexForceKey.current = "";
            setIndexRetry(0);
            setEntryRetry(0);
          }}
        />
      ) : null}

      {view === "species" && indexData ? (
        <div className="usage-layout metaroll-layout">
          <aside className="usage-browser-panel" aria-label="Buscar e filtrar Pokémon">
            <div className="usage-browser-heading">
              <div><p className="page-label">Índice da captura</p><h2>Espécies</h2></div>
              <span className="usage-result-count">{visibleEntries.length}</span>
            </div>
            <div className="usage-filters">
              <label className="usage-search-field">
                <span>Buscar Pokémon</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Tauros-Paldea-Aqua" autoComplete="off" />
              </label>
              <details className="usage-more-filters">
                <summary>Golpe, item, habilidade e período</summary>
                <div className="usage-more-filter-grid">
              {filters.map(([key, label]) => {
                const value = key === "moves" ? moveFilter : key === "items" ? itemFilter : abilityFilter;
                const setter = key === "moves" ? setMoveFilter : key === "items" ? setItemFilter : setAbilityFilter;
                return (
                  <label className="usage-filter-field" key={key}>
                    <span>{label}{facetOptions[key].length === 0 ? " · sem dados" : ""}</span>
                    <select value={value} disabled={facetOptions[key].length === 0} onChange={(event) => setter(event.target.value)}>
                      <option value="all">Todos</option>
                      {facetOptions[key].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                );
              })}
              <label className="usage-filter-field">
                <span>Temporada</span>
                <select value={season} onChange={(event) => {
                  setSeason(event.target.value);
                  setIndexData(null);
                  setIndexStatus("loading");
                  indexForceKey.current = "";
                  setIndexRetry(0);
                  setEntryRetry(0);
                }}>
                  <option value="">Atual · {indexData.season || "sem rótulo"}</option>
                  {seasonOptions.map((seasonName) => <option key={seasonName} value={seasonName}>{seasonName} · captura final</option>)}
                </select>
              </label>
              <label className="usage-filter-field">
                <span>Ordenar</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="rank">Posição de uso</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>
                </div>
              </details>
            </div>
            <p className="usage-filter-note">A MetaRoll não publica tipo nesta ficha. As facetas usam golpes, itens e habilidades do próprio arquivo desta captura.</p>
            <div className="usage-list-caption"><span>Nome</span><span>Posição</span></div>
            {visibleEntries.length > 0 ? (
              <ul className="usage-species-list">
                {visibleEntries.map((item) => (
                  <li key={item.id}>
                    <button className={"usage-species-button" + (item.id === selectedId ? " is-selected" : "")} type="button" aria-pressed={item.id === selectedId} onClick={() => {
                      if (item.id === selectedId) return;
                      setSelectedId(item.id);
                      onPokemonSelect?.(item.name);
                      setEntryRetry(0);
                    }}>
                      <span className="usage-species-art"><PokemonSprite pokemon={resolveCompetitivePokemonSprite(findPokemonSprite, { id: item.id, name: item.name })} name={item.name} size={54} decorative /></span>
                      <span className="usage-species-name"><strong>{item.name}</strong></span>
                      <span className="usage-position">{item.rank === null ? "—" : "#" + item.rank}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <div className="usage-no-results"><strong>Nenhum resultado</strong><p>Remova um filtro ou tente outro nome.</p></div>}
          </aside>

          <section className="usage-detail-panel metaroll-detail-panel" aria-label="Ficha competitiva MetaRoll">
            {!selectedEntry ? <div className="usage-empty"><p>{initialPokemonName ? `A MetaRoll não listou ${initialPokemonName} nesta captura. Limpe a busca ou escolha uma espécie disponível.` : "Escolha uma espécie para abrir a ficha."}</p></div> : (
              <>
                <div className="usage-detail-heading">
                  <PokemonSprite pokemon={resolveCompetitivePokemonSprite(findPokemonSprite, { id: selectedEntry.id, name: selectedEntry.name })} name={selectedEntry.name} size={104} priority decorative className="usage-detail-art" />
                  <div><p className="page-label">Ficha de Doubles</p><h2>{selectedEntry.name}</h2></div>
                  <span className="usage-format-stamp">#{entry?.rank ?? selectedEntry.rank ?? "—"} · Doubles</span>
                </div>
                {entryStatus === "loading" || entryStatus === "idle" ? (
                  <div className="usage-loading" role="status"><span className="usage-spinner" aria-hidden="true" />Carregando ficha de {selectedEntry.name}…</div>
                ) : null}
                {entryStatus === "error" ? (
                  <div className="usage-error" role="alert"><div><strong>Não foi possível carregar esta espécie.</strong><p>{entryError}</p></div><button className="button button-outline button-small" type="button" onClick={() => {
                    const nextRetry = entryRetry + 1;
                    entryForceKey.current = `${season || "current"}|${selectedId}|${nextRetry}`;
                    setEntryRetry(nextRetry);
                  }}>Tentar de novo</button></div>
                ) : null}
                {entry ? (
                  <>
                    <div className="usage-provenance usage-provenance-inline metaroll-provenance">
                      <a className="usage-provenance-source" href={metaRollSource.url} target="_blank" rel="noreferrer">Dados competitivos: MetaRoll</a>
                      <span><strong>Temporada {entryCapture?.season || "não informada"}</strong> · captura {formatCapture(entryCapture?.capturedAt)}</span>
                      <span>Consultado {formatCapture(entryCapture?.appFetchedAt)}</span>
                      <details className="usage-source-help usage-provenance-notes"><summary>Sobre esta captura</summary><p>Golpes, itens, habilidades, naturezas e spreads são parcelas das aparições deste Pokémon. Parceiros não têm percentual publicado; o tamanho da amostra não foi informado. Stat Points não são EVs e a fonte não pareia spread com natureza.{entryCapture?.comparedTo ? ` Posição anterior comparada com a captura de ${formatCapture(entryCapture.comparedTo)}.` : ""}</p></details>
                    </div>
                    <div className="metaroll-rank-summary">
                      <div><span>Posição nesta captura</span><strong>#{entry.rank ?? "não informada"}</strong></div>
                      <div><span>Captura anterior</span><strong>{!entry.hasPreviousRank ? "sem captura anterior" : entry.previousRank === null ? "fora da captura anterior" : "#" + entry.previousRank}</strong></div>
                      <div><span>Identificação de forma</span><strong>{entry.confidence === null
                        ? "não informada"
                        : entry.confidence.formGuessed === true || entry.confidence.identifiedByElimination === true
                          ? "inferida pela fonte"
                          : entry.confidence.formGuessed === false && entry.confidence.identifiedByElimination === false
                            ? "não inferida"
                            : "sinalização incompleta"}</strong></div>
                    </div>
                    <nav className="usage-category-tabs metaroll-profile-tabs" aria-label="Seções da ficha MetaRoll">
                      {profileTabs.map(([key, label]) => (
                        <button key={key} className={activeProfileSection === key ? "usage-category-tab is-active" : "usage-category-tab"} type="button" aria-pressed={activeProfileSection === key} onClick={() => setActiveProfileSection(key)}>{label}</button>
                      ))}
                    </nav>

                    {activeProfileSection === "summary" ? (
                      <div className="metaroll-profile-grid metaroll-profile-summary">
                        {distributionSections.filter(([key]) => ["moves", "items", "abilities", "teammates"].includes(key)).map(([key, label]) => (
                          <DistributionCard key={key} title={label} rows={entry.distributions[key].slice(0, 2)} pokemonRows={key === "teammates"} note={key === "teammates" ? "Sem percentual publicado." : ""} />
                        ))}
                      </div>
                    ) : null}

                    {distributionSections.some(([key]) => key === activeProfileSection) ? (() => {
                      const [key, label] = distributionSections.find(([sectionKey]) => sectionKey === activeProfileSection);
                      return <div className="metaroll-profile-grid"><DistributionCard title={label} rows={entry.distributions[key]} spread={key === "spreads"} pokemonRows={key === "teammates"} note={key === "teammates" ? "A fonte lista parceiros sem percentual." : key === "spreads" ? "Distribuição de Stat Points, sem natureza associada." : ""} /></div>;
                    })() : null}

                    {activeProfileSection === "mega" ? <MegaFormsCard
                      state={currentMegaState}
                      rows={selectedMegaRows}
                      onRetry={() => {
                        const nextRetry = megaRetry + 1;
                        megaForceKey.current = `${season || "current"}|${selectedId}|${nextRetry}`;
                        setMegaRetry(nextRetry);
                      }}
                    /> : null}

                    {activeProfileSection === "matchups" ? <section className="metaroll-matchups-section">
                      <div className="usage-category-heading"><div><h3>Matchups</h3></div><span>MetaRoll</span></div>
                      {entry.matchups ? (
                        <>
                          <div className="metaroll-matchups-grid">
                            <MatchupSpeciesCard title="Vitórias associadas" rows={entry.matchups.beats} outcomeLabel="vitórias" />
                            <MatchupSpeciesCard title="Derrotas associadas" rows={entry.matchups.losesTo} outcomeLabel="derrotas" />
                            <MatchupMoveCard title="Golpes nas vitórias" rows={entry.matchups.beatsWith} outcomeLabel="das vitórias" />
                            <MatchupMoveCard title="Golpes nas derrotas" rows={entry.matchups.beatenBy} outcomeLabel="das derrotas" />
                          </div>
                          <p className="metaroll-matchups-note">As listas são parciais e ordenadas pela fonte. As contagens se alinham às espécies e são jogos ganhos ou perdidos, não o total de partidas do confronto. Percentuais de golpes pertencem às vitórias ou derrotas correspondentes; não são taxa de vitória.</p>
                        </>
                      ) : <p className="metaroll-empty">Esta captura não publicou dados de matchups para a espécie.</p>}
                    </section> : null}

                    {activeProfileSection === "history" ? <section className="metaroll-history-section">
                      <div className="usage-category-heading"><div><h3>Posição e distribuições diárias</h3></div><span>{entry.rankHistory.length} dias de ranking</span></div>
                      {entry.rankHistory.length > 0 ? (
                        <ol className="metaroll-rank-history">
                          {entry.rankHistory.map((point) => <li key={point.date}><time dateTime={point.date}>{point.date}</time><strong>{point.rank === null ? "sem posição" : "#" + point.rank}</strong></li>)}
                        </ol>
                      ) : <p className="metaroll-empty">A fonte não publicou histórico de posição para esta ficha.</p>}
                      {entry.usageHistory.length > 0 ? (
                        <>
                          <label className="usage-snapshot-picker"><span>Dia do histórico de uso</span><select value={selectedUsageDate} onChange={(event) => setSelectedUsageDate(event.target.value)}>
                            {entry.usageHistory.map((record) => <option key={record.date} value={record.date}>{record.date}</option>)}
                          </select></label>
                          {selectedHistory ? <HistoryUsageCard record={selectedHistory} /> : null}
                        </>
                      ) : <p className="metaroll-empty">A fonte não publicou histórico diário de uso para esta ficha.</p>}
                    </section> : null}
                  </>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
