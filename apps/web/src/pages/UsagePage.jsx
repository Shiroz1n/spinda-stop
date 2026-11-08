import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { ItemSprite, PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { usageProviders } from "../data/usage/registry.js";
import { useCacheRevalidation } from "../data/usage/useCacheRevalidation.js";
import { findUsagePokemonByReference } from "../data/usage/pokemonQuery.js";
import { hasPublishedStatPoints, mergeCategoryRows, mergeUsageCatalog, selectRankedPartnerRows, selectUsageCapture } from "../data/usage/mergeUsageData.js";
import { MetaRollUsagePage } from "./MetaRollUsagePage.jsx";

const categories = [
  { id: "profile", label: "Ficha completa" },
  { id: "move", label: "Golpes" },
  { id: "held_item", label: "Itens" },
  { id: "ability", label: "Habilidades" },
  { id: "stat_alignment", label: "Naturezas" },
  { id: "stat_points", label: "Pontos investidos" },
  { id: "teammate", label: "Parceiros" },
];
const metaRollCategoryByBattleData = Object.freeze({
  move: "moves",
  held_item: "items",
  ability: "abilities",
  stat_alignment: "natures",
  stat_points: "spreads",
  teammate: "teammates",
});

const categoryFilters = [
  { id: "move", key: "moves", label: "Golpe" },
  { id: "held_item", key: "items", label: "Item" },
  { id: "ability", key: "abilities", label: "Habilidade" },
];

const statPointLabels = [
  ["hp", "HP"],
  ["attack", "Atk"],
  ["defense", "Def"],
  ["spAttack", "SpA"],
  ["spDefense", "SpD"],
  ["speed", "Spe"],
];

const findPokemonSprite = createPokemonSpriteLookup(dexData.pokemon);

function resolveCatalogPokemon(entry) {
  return findPokemonSprite(entry.name) || findPokemonSprite(entry.showdownId || entry.id);
}

function normalizeSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function formatTimestamp(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function formatSnapshotDate(value) {
  if (!value) return "data do snapshot não informada";
  const folderDate = value.match(/^(\d{2})_(\d{2})_(\d{4})$/);
  if (folderDate) return folderDate[1] + "/" + folderDate[2] + "/" + folderDate[3];
  return value;
}

function captureSummary(source, context) {
  if (!source) return "";
  const period = context.season || "Período não informado";
  const capture = source === "battleData"
    ? context.capturedAt ? formatSnapshotDate(context.capturedAt) : "snapshot sem data publicada"
    : context.capturedAt ? formatTimestamp(context.capturedAt) : "captura não informada";
  return `${source === "metaRoll" ? "MetaRoll" : "Battle Data"} · ${period} · ${capture}`;
}

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function snapshotKey(snapshot) {
  return [snapshot.season || "", snapshot.date || "", snapshot.sourceFile || ""].join("|");
}

function CategoryRow({ row, category }) {
  const statAlignment = category.id === "stat_alignment";
  const observation = row.selected;
  const natureEffects = statAlignment
    ? [observation?.statUp ? "↑ " + observation.statUp : "", observation?.statDown ? "↓ " + observation.statDown : ""].filter(Boolean).join(" · ")
    : "";
  const percentage = observation?.percentageValue !== null && observation?.percentageValue !== undefined
    ? `${observation.percentageValue}%`
    : observation?.percentage || null;
  const partnerRank = category.id === "teammate" ? observation?.rank : null;
  const sourceLabel = observation?.source === "metaRoll" ? "MetaRoll" : "Pokémon Champions Battle Data";
  const capturedAt = observation?.source === "battleData"
    ? formatSnapshotDate(observation.capturedAt)
    : observation?.capturedAt ? formatTimestamp(observation.capturedAt) : "data da captura não informada";
  const provenance = [sourceLabel, observation?.season, capturedAt].filter(Boolean).join(" · ");

  return (
    <li className="usage-data-row">
      <div className="usage-row-main">
        <div className="usage-row-title">
          {category.id === "stat_points" ? (
            hasPublishedStatPoints(row.statPoints) ? <div className="usage-spread" aria-label="Pontos investidos por atributo">
              {statPointLabels.map(([key, label]) => (
                <span key={key}>
                  <small>{label}</small>
                  <b>{displayValue(row.statPoints?.[key])}</b>
                </span>
              ))}
            </div> : <span className="stat-points-empty">SP não publicados</span>
          ) : (
            <div className="usage-row-copy">
              <span className="usage-row-asset">
                {category.id === "held_item" ? <ItemSprite name={row.name} size={28} /> : null}
                {category.id === "teammate" && findPokemonSprite(row.name) ? <PokemonSprite pokemon={findPokemonSprite(row.name)} name={row.name} size={38} decorative /> : null}
              </span>
              <strong>{row.name || (category.id === "stat_points" ? "Distribuição" : "Nome não informado")}</strong>
              {natureEffects ? <small className="usage-nature-effects">{natureEffects}</small> : null}
            </div>
          )}
        </div>
        <div className="usage-merged-values" aria-label={category.id === "teammate" ? "Posição publicada" : "Percentual publicado"}>
          {category.id === "teammate"
            ? <span className="usage-source-observation" aria-label={`Posição publicada ${partnerRank}`} title={provenance}>Posição {partnerRank}</span>
            : <span className={percentage === null ? "usage-source-observation is-missing" : "usage-source-observation"} aria-label={`${percentage ?? "Percentual indisponível"} · ${provenance}`} title={provenance}>{percentage ?? "—"}</span>}
        </div>
      </div>
    </li>
  );
}

function CategoryRows({ rows, category }) {
  return (
    <ol className="usage-row-list">
      {rows.map((row, index) => (
        <CategoryRow
          key={row.key || `${category.id}-${index}`}
          row={row}
          category={category}
        />
      ))}
    </ol>
  );
}

function MetaRollComparison({ selectedPokemon, usage, status, category, periodMode, activeSeason, indexData, indexStatus, indexError, onRetryIndex, onOpenDetails }) {
  const provider = usageProviders.metaroll;
  const entry = indexData?.entries.find((item) => item.id === selectedPokemon.metaRollId) || null;
  const [detailState, setDetailState] = useState({ key: "", status: "idle" });
  const [retry, setRetry] = useState(0);
  const forceNextRequest = useRef(false);
  const requestKey = `${indexData?.season || "current"}|${indexData?.capturedAt || ""}|${indexData?.appFetchedAt || ""}|${entry?.id || ""}|${retry}`;

  useEffect(() => {
    if (indexStatus !== "success" || !entry) return undefined;
    let active = true;
    const force = forceNextRequest.current;
    forceNextRequest.current = false;
    provider.loadPokemonUsage({ id: entry.id, force }).then((result) => {
      if (active) setDetailState({ key: requestKey, status: "success", result });
    }).catch(() => {
      if (active) setDetailState({ key: requestKey, status: "error" });
    });
    return () => { active = false; };
  }, [entry, indexData?.capturedAt, indexData?.appFetchedAt, indexStatus, provider, requestKey, retry]);

  const detail = detailState.key === requestKey ? detailState : { status: entry ? "loading" : "idle" };
  const metaEntry = detail.result?.entry;
  const visibleCategories = category.id === "profile"
    ? categories.filter((item) => item.id !== "profile")
    : [category];
  const battleRows = (item) => Array.isArray(usage?.rows) ? usage.rows.filter((row) => row.category === item.id) : null;
  const metaRows = (item) => metaEntry?.distributions?.[metaRollCategoryByBattleData[item.id]] || [];
  const selectedCapture = selectUsageCapture(Object.values(metaEntry?.distributions || {}).flat(), usage?.rows, {
    formats: { battleData: usage?.format || selectedPokemon.battleData?.format, metaRoll: detail.result?.format || indexData?.format || selectedPokemon.metaRoll?.format },
    seasons: { battleData: usage?.season || selectedPokemon.battleData?.season, metaRoll: detail.result?.season || indexData?.season || selectedPokemon.metaRoll?.season },
    activeSeason: usage?.season || selectedPokemon.battleData?.season || activeSeason,
    periodMode,
  });
  const selectedContext = selectedCapture === "metaRoll"
    ? { season: detail.result?.season || indexData?.season || selectedPokemon.metaRoll?.season, capturedAt: detail.result?.capturedAt || indexData?.capturedAt || null }
    : { season: usage?.season || selectedPokemon.battleData?.season, capturedAt: usage?.date || null };
  const dataPending = !usage && !metaEntry && ((status === "loading" || status === "idle") || indexStatus === "loading" || detail.status === "loading");
  const dataUnavailable = !usage && !metaEntry && (status === "error" || indexStatus === "error" || detail.status === "error");
  const emptyMessage = dataPending
    ? "Carregando os dados publicados…"
    : dataUnavailable
      ? "Uma captura não respondeu; não foi possível confirmar se há linhas nesta categoria."
      : "Nenhuma distribuição publicada nesta categoria.";

  return (
    <section className="usage-distributions" aria-label="Distribuições competitivas">
      <div className="usage-distributions-heading">
        <h3>Distribuições</h3>
        {selectedPokemon.metaRollId ? <button className="text-button" type="button" onClick={() => onOpenDetails("summary")}>Histórico e confrontos</button> : null}
      </div>
      <p className="usage-distributions-note">Uso publicado; não é taxa de vitória.</p>
      {selectedCapture ? <p className="usage-provenance usage-provenance-inline">{captureSummary(selectedCapture, selectedContext)}</p> : null}
      {indexStatus === "loading" && !indexData ? <p className="usage-loading" role="status"><span className="usage-spinner" aria-hidden="true" />Atualizando dados competitivos…</p> : null}
      {indexStatus === "error" ? <div className="usage-error" role="alert"><p>Não foi possível atualizar todos os dados competitivos.</p><button className="button button-outline button-small" type="button" onClick={onRetryIndex}>Tentar de novo</button>{indexError ? <span className="visually-hidden">{indexError}</span> : null}</div> : null}
      {entry && (detail.status === "loading" || detail.status === "idle") ? <p className="usage-loading" role="status"><span className="usage-spinner" aria-hidden="true" />Carregando os dados de {selectedPokemon.name}…</p> : null}
      {entry && detail.status === "error" ? <div className="usage-error" role="alert"><p>Os dados complementares desta espécie não responderam.</p><button className="button button-outline button-small" type="button" onClick={() => { forceNextRequest.current = true; setRetry((current) => current + 1); }}>Tentar de novo</button></div> : null}
      <div className="usage-distribution-grid">
        {visibleCategories.map((item) => {
          const mergedRows = mergeCategoryRows({
            categoryId: item.id,
            formats: { battleData: usage?.format || selectedPokemon.battleData?.format, metaRoll: detail.result?.format || indexData?.format || selectedPokemon.metaRoll?.format },
            contexts: {
              battleData: { season: usage?.season || selectedPokemon.battleData?.season, capturedAt: usage?.date || null, sourceFile: usage?.sourceFile || null, format: usage?.format || selectedPokemon.battleData?.format },
              metaRoll: { season: detail.result?.season || indexData?.season || selectedPokemon.metaRoll?.season, capturedAt: detail.result?.capturedAt || indexData?.capturedAt || null, format: detail.result?.format || indexData?.format || selectedPokemon.metaRoll?.format },
            },
            battleRows: selectedCapture === "battleData" ? battleRows(item) || [] : [],
            metaRows: selectedCapture === "metaRoll" ? metaRows(item) : [],
            preferredSource: selectedCapture || "metaRoll",
            resolvePokemon: resolveCatalogPokemon,
          });
          const rows = item.id === "teammate" ? selectRankedPartnerRows(mergedRows) : mergedRows;
          const categoryEmptyMessage = item.id === "teammate" && !dataPending && !dataUnavailable
            ? "Esta captura não traz parceiros com posição publicada."
            : emptyMessage;
          return (
            <section className="usage-distribution-category" key={item.id}>
              <div className="usage-category-heading">
                <h4>{item.label}</h4>
                {category.id === "profile" ? <button className="text-button" type="button" onClick={() => onOpenDetails(item.id)}>Ver detalhes</button> : <span>{item.id === "teammate" ? `${rows.length} parceiros` : `${rows.length} linhas`}</span>}
              </div>
              {!rows.length ? <div className="usage-empty usage-empty-compact"><p>{categoryEmptyMessage}</p></div> : <CategoryRows rows={category.id === "profile" ? rows.slice(0, 3) : rows} category={item} />}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function UsagePanel({ selectedPokemon, usage, category, periodMode, activeSeason, status, error, onRetry, onCategoryChange, metaRollIndex, metaRollIndexStatus, metaRollIndexError, onRetryMetaRoll, onOpenMetaRoll }) {
  if (!selectedPokemon) {
    return (
      <section className="usage-detail-panel" aria-label="Dados da espécie">
        <div className="usage-empty">
          <p className="page-label">Doubles</p>
          <h2>Escolha uma espécie</h2>
        <p>Use a busca e os filtros para encontrar os dados competitivos publicados.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="usage-detail-panel" aria-label={"Uso de " + selectedPokemon.name}>
      <div className="usage-detail-heading">
        <PokemonSprite pokemon={resolveCompetitivePokemonSprite(findPokemonSprite, { id: selectedPokemon.showdownId, name: selectedPokemon.name })} name={selectedPokemon.name} size={120} priority decorative className="usage-detail-art" />
        <div>
          <p className="page-label">Visão da espécie</p>
          <h2>{selectedPokemon.name}</h2>
          <div className="type-list usage-type-list">
            {selectedPokemon.types.map((type) => <TypeTag key={type} type={type} />)}
          </div>
        </div>
        <span className="usage-format-stamp">Doubles</span>
      </div>

      <nav className="usage-category-tabs" aria-label="Seções da ficha competitiva">
        {categories.map((item) => (
          <button
            key={item.id}
            className={"usage-category-tab" + (item.id === category.id ? " is-active" : "")}
            type="button"
            aria-pressed={item.id === category.id}
            onClick={() => onCategoryChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {status === "loading" || status === "idle" ? (
        <div className="usage-loading" role="status">
          <span className="usage-spinner" aria-hidden="true" />
          Carregando dados de {selectedPokemon.name}…
        </div>
      ) : null}

      {status === "error" ? (
        <div className="usage-error" role="alert">
          <div>
            <strong>Não foi possível carregar esta espécie.</strong>
            <p>{error || "A fonte pode estar indisponível. Tente novamente em instantes."}</p>
          </div>
          <button className="button button-outline button-small" type="button" onClick={onRetry}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      <MetaRollComparison
        selectedPokemon={selectedPokemon}
        usage={usage}
        status={status}
        category={category}
        periodMode={periodMode}
        activeSeason={activeSeason}
        indexData={metaRollIndex}
        indexStatus={metaRollIndexStatus}
        indexError={metaRollIndexError}
        onRetryIndex={onRetryMetaRoll}
        onOpenDetails={onOpenMetaRoll}
      />
    </section>
  );
}

function BattleDataUsagePage({ initialPokemonName = "", onPokemonSelect, metaRollIndex, metaRollIndexStatus, metaRollIndexError, onRetryMetaRoll, onOpenMetaRoll }) {
  const provider = usageProviders["pokemon-champions-battle-data"];
  const [indexData, setIndexData] = useState(null);
  const [indexStatus, setIndexStatus] = useState("loading");
  const [indexRetry, setIndexRetry] = useState(0);
  const indexForceKey = useRef("");
  const [query, setQuery] = useState(initialPokemonName);
  const initialPokemonNameRef = useRef(initialPokemonName);
  const [typeFilter, setTypeFilter] = useState("all");
  const [moveFilter, setMoveFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [abilityFilter, setAbilityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("position");
  const [selectedId, setSelectedId] = useState(null);
  const [categoryId, setCategoryId] = useState("profile");
  const [periodMode, setPeriodMode] = useState("current");
  const [historySeason, setHistorySeason] = useState("all");
  const [historyDays, setHistoryDays] = useState(7);
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");
  const [usageState, setUsageState] = useState({ key: "", status: "idle", result: null, error: "" });
  const [usageRetry, setUsageRetry] = useState(0);
  const usageForceKey = useRef("");
  const catalog = useMemo(
    () => mergeUsageCatalog(indexData ? { ...indexData, format: "Doubles" } : null, metaRollIndex, resolveCatalogPokemon),
    [indexData, metaRollIndex],
  );
  const selectedPokemon = catalog.find((entry) => entry.key === selectedId) || null;
  const selectedPokemonKey = selectedPokemon?.key;
  const selectedShowdownId = selectedPokemon?.showdownId;
  const usageRequestKey = [periodMode, historySeason, historyDays, selectedPokemonKey, usageRetry].join("|");
  const usageStateIsCurrent = usageState.key === usageRequestKey;
  const usage = usageStateIsCurrent ? usageState.result : null;
  const usageStatus = usageStateIsCurrent ? usageState.status : selectedShowdownId ? "loading" : selectedPokemonKey ? "success" : "idle";
  const usageError = usageStateIsCurrent ? usageState.error : "";

  function refreshIndex(force = false) {
    const nextRetry = indexRetry + 1;
    indexForceKey.current = force ? `index|${nextRetry}` : "";
    setIndexStatus("loading");
    setIndexRetry(nextRetry);
  }

  function refreshUsage(force = false) {
    if (!selectedPokemon?.showdownId) return;
    const nextRetry = usageRetry + 1;
    usageForceKey.current = force
      ? [periodMode, historySeason, historyDays, selectedPokemon.key, nextRetry].join("|")
      : "";
    setUsageRetry(nextRetry);
  }

  function refreshVisibleData() {
    refreshIndex(true);
    refreshUsage(true);
    onRetryMetaRoll?.();
  }

  useCacheRevalidation(indexData?.cacheExpiresAt, () => refreshIndex(false), Boolean(indexData));
  useCacheRevalidation(usage?.cacheExpiresAt, () => refreshUsage(false), Boolean(usage));

  useEffect(() => {
    initialPokemonNameRef.current = initialPokemonName;
  }, [initialPokemonName]);

  useEffect(() => {
    let active = true;
    const requestKey = `index|${indexRetry}`;
    const force = indexForceKey.current === requestKey;
    if (force) indexForceKey.current = "";

    provider.loadIndex({ force }).then((result) => {
      if (!active) return;
      setIndexData(result);
      setIndexStatus("success");
    }).catch(() => {
      if (!active) return;
      setIndexStatus("error");
    });

    return () => { active = false; };
  }, [provider, indexRetry]);

  useEffect(() => {
    if (!catalog.length) return;
    setSelectedId((current) => {
      if (catalog.some((entry) => entry.key === current)) return current;
      if (initialPokemonNameRef.current) {
        return findUsagePokemonByReference(catalog, initialPokemonNameRef.current)?.key || null;
      }
      return [...catalog].sort((left, right) => {
        const leftRank = left.displayRank ?? Number.POSITIVE_INFINITY;
        const rightRank = right.displayRank ?? Number.POSITIVE_INFINITY;
        return leftRank - rightRank || left.name.localeCompare(right.name, "pt-BR");
      })[0]?.key || null;
    });
  }, [catalog]);

  useEffect(() => {
    if (!selectedShowdownId) return undefined;

    let active = true;
    const requestKey = usageRequestKey;
    const force = usageForceKey.current === requestKey;
    if (force) usageForceKey.current = "";
    const request = { showdownId: selectedShowdownId, force };
    if (periodMode === "history") {
      request.days = historyDays;
      if (historySeason !== "all") request.season = historySeason;
    }

    provider.loadPokemonUsage(request).then((result) => {
      if (!active) return;
      setUsageState({ key: requestKey, status: "success", result, error: "" });
      setSelectedSnapshotKey((current) => result.daily.some((snapshot) => snapshotKey(snapshot) === current)
        ? current
        : result.daily[0] ? snapshotKey(result.daily[0]) : "");
    }).catch(() => {
      if (!active) return;
      setUsageState({ key: requestKey, status: "error", result: null, error: "A API pode estar temporariamente fora do ar. Nenhum dado local foi substituído." });
    });

    return () => { active = false; };
  }, [provider, selectedShowdownId, usageRequestKey, periodMode, historySeason, historyDays]);

  const requestedPokemon = initialPokemonName
    ? findUsagePokemonByReference(catalog, initialPokemonName)
    : null;
  const types = Array.from(new Set(catalog.flatMap((entry) => entry.types))).sort();
  const facetOptions = Object.fromEntries(categoryFilters.map(({ key }) => [
    key,
    Array.from(new Set(catalog.flatMap((entry) => entry.filterValues?.[key] || [])))
      .sort((left, right) => left.localeCompare(right, "pt-BR")),
  ]));
  const normalizedQuery = normalizeSearch(query.trim());
  const filteredPokemon = catalog
    .filter((entry) => {
      const nameMatches = normalizeSearch(entry.name).includes(normalizedQuery)
        || normalizeSearch(entry.showdownId || entry.metaRollId).includes(normalizedQuery);
      const typeMatches = typeFilter === "all" || entry.types.includes(typeFilter);
      const moveMatches = moveFilter === "all" || entry.filterValues?.moves?.includes(moveFilter);
      const itemMatches = itemFilter === "all" || entry.filterValues?.items?.includes(itemFilter);
      const abilityMatches = abilityFilter === "all" || entry.filterValues?.abilities?.includes(abilityFilter);
      return nameMatches && typeMatches && moveMatches && itemMatches && abilityMatches;
    })
    .sort((left, right) => {
      if (sortBy === "name") return left.name.localeCompare(right.name, "pt-BR");
      const leftPosition = left.displayRank ?? Number.POSITIVE_INFINITY;
      const rightPosition = right.displayRank ?? Number.POSITIVE_INFINITY;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
      return left.name.localeCompare(right.name, "pt-BR");
    });

  const activeCategory = categories.find((item) => item.id === categoryId) || categories[0];
  const displayedUsage = periodMode === "history"
    ? usage?.daily.find((snapshot) => snapshotKey(snapshot) === selectedSnapshotKey) || null
    : usage;
  const hasActiveFilters = Boolean(query) || typeFilter !== "all" || moveFilter !== "all"
    || itemFilter !== "all" || abilityFilter !== "all";

  return (
    <div className="usage-source-content">
      <div className="usage-source-banner">
        <div className="usage-source-copy">
          <strong>Meta competitivo em Doubles</strong>
        </div>
        <details className="usage-source-details">
          <summary>Sobre os dados</summary>
          <p>Percentuais publicados não representam taxa de vitória. Períodos e definições podem variar; por isso, o app seleciona uma captura compatível e mantém ausências sem preenchimento.</p>
          <a className="usage-source-guide" href={provider.source.url} target="_blank" rel="noreferrer">Pokémon Champions Battle Data ↗</a>
          <a className="usage-source-guide" href={usageProviders.metaroll.source.url} target="_blank" rel="noreferrer">MetaRoll ↗</a>
        </details>
      </div>

      {catalog.length ? (
        <div className="usage-index-note" aria-label="Atualização do índice">
          <span className="usage-period-summary">{catalog.length} Pokémon e formas</span>
          <button className="button button-outline button-small" type="button" disabled={indexStatus === "loading" && metaRollIndexStatus === "loading"} onClick={refreshVisibleData}>
            {indexStatus === "loading" || metaRollIndexStatus === "loading" ? "Atualizando…" : "Atualizar agora"}
          </button>
        </div>
      ) : null}

      {!catalog.length && (indexStatus === "loading" || metaRollIndexStatus === "loading") ? (
        <div className="usage-index-state" role="status">
          <span className="usage-spinner" aria-hidden="true" />
          Carregando o catálogo competitivo de Doubles…
        </div>
      ) : null}
      {catalog.length && (indexStatus === "loading" || metaRollIndexStatus === "loading") ? <p className="usage-refresh-status" role="status">Atualizando as capturas em segundo plano…</p> : null}

      {!catalog.length && indexStatus === "error" && metaRollIndexStatus === "error" ? (
        <div className="usage-error usage-index-error" role="alert">
          <div><strong>O catálogo não está disponível agora.</strong><p>As capturas públicas não responderam. Tente novamente.</p></div>
          <button className="button button-outline" type="button" onClick={refreshVisibleData}>Tentar de novo</button>
        </div>
      ) : null}
      {catalog.length && (indexStatus === "error" || metaRollIndexStatus === "error") ? <p className="usage-partial-error" role="status">Parte dos dados não foi atualizada; o que está disponível continua na ficha.</p> : null}

      {catalog.length ? (
        <div className="usage-layout">
          <aside className="usage-browser-panel" aria-label="Buscar espécies">
            <div className="usage-browser-heading">
              <div>
                <p className="page-label">Catálogo</p>
                <h2>Espécies</h2>
              </div>
              <div className="usage-browser-actions">
                {hasActiveFilters ? (
                  <button
                    className="button button-outline button-small usage-clear-filters"
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setTypeFilter("all");
                      setMoveFilter("all");
                      setItemFilter("all");
                      setAbilityFilter("all");
                    }}
                  >
                    Limpar filtros
                  </button>
                ) : null}
                <span className="usage-result-count" aria-label={`${filteredPokemon.length} espécies`}>{filteredPokemon.length}</span>
              </div>
            </div>

            <div className="usage-filters">
              <label className="usage-search-field">
                <span>Buscar Pokémon</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex.: Garchomp"
                  autoComplete="off"
                />
              </label>

              <label className="usage-filter-field">
                <span>Tipo</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="all">Todos os tipos</option>
                  {types.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <details className="usage-more-filters">
                <summary>Mais filtros e período</summary>
                <div className="usage-more-filter-grid">
              {categoryFilters.map(({ id, key, label }) => {
                const value = id === "move" ? moveFilter : id === "held_item" ? itemFilter : abilityFilter;
                const setValue = id === "move" ? setMoveFilter : id === "held_item" ? setItemFilter : setAbilityFilter;
                const options = facetOptions[key] || [];
                return (
                  <label className="usage-filter-field" key={key}>
                    <span>{label} nos índices publicados{options.length === 0 ? " · sem dados" : ""}</span>
                    <select value={value} disabled={options.length === 0} onChange={(event) => setValue(event.target.value)}>
                      <option value="all">Todos</option>
                      {options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                );
              })}

              <label className="usage-filter-field">
                <span>Período</span>
                <select
                  value={periodMode}
                  onChange={(event) => {
                    setPeriodMode(event.target.value);
                    setSelectedSnapshotKey("");
                    setUsageRetry(0);
                  }}
                >
                  <option value="current">Dados atuais</option>
                  <option value="history">Snapshots diários</option>
                </select>
              </label>

              {periodMode === "history" ? (
                <>
                  <label className="usage-filter-field">
                    <span>Temporada da pasta</span>
                    <select
                      value={historySeason}
                      onChange={(event) => {
                        setHistorySeason(event.target.value);
                        setSelectedSnapshotKey("");
                        setUsageRetry(0);
                      }}
                    >
                      <option value="all">Mais recentes disponíveis</option>
                      {(indexData?.availableSeasons || []).map((season) => (
                        <option key={season} value={season}>{season}</option>
                      ))}
                    </select>
                  </label>
                  <label className="usage-filter-field">
                    <span>Snapshots solicitados</span>
                    <select
                      value={historyDays}
                      onChange={(event) => {
                        setHistoryDays(Number(event.target.value));
                        setSelectedSnapshotKey("");
                        setUsageRetry(0);
                      }}
                    >
                      {[7, 14, 31].map((days) => <option key={days} value={days}>{days} dias</option>)}
                    </select>
                  </label>
                </>
              ) : null}

              <label className="usage-filter-field">
                <span>Ordenar</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="position">Posição</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>

                </div>
              </details>
            </div>

            <p className="usage-filter-note">
              Golpes, itens e habilidades vêm dos índices publicados. Formas distintas permanecem separadas e valores ausentes não são inferidos.
            </p>
            {initialPokemonName && !requestedPokemon ? (
              <p className="usage-request-note" role="status">{initialPokemonName} não aparece nas capturas disponíveis. Limpe a busca para escolher outra espécie.</p>
            ) : null}

            <div className="usage-list-caption">
              <span>Nome</span>
              <span>Posição</span>
            </div>

            {filteredPokemon.length > 0 ? (
              <ul className="usage-species-list">
                {filteredPokemon.map((entry) => (
                  <li key={entry.key}>
                    <button
                      className={"usage-species-button" + (entry.key === selectedId ? " is-selected" : "")}
                      type="button"
                      aria-pressed={entry.key === selectedId}
                      onClick={() => {
                        if (entry.key !== selectedId) {
                          setSelectedId(entry.key);
                          onPokemonSelect?.(entry.name);
                          setUsageRetry(0);
                        }
                      }}
                    >
                      <span className="usage-species-art"><PokemonSprite pokemon={resolveCatalogPokemon(entry)} name={entry.name} size={66} decorative /></span>
                      <span className="usage-species-name">
                        <strong>{entry.name}</strong>
                        <span className="type-list">
                          {entry.types.map((type) => <TypeTag key={type} type={type} />)}
                        </span>
                      </span>
                      <span className="usage-position" aria-label={`Posição publicada ${Number.isFinite(entry.displayRank) ? entry.displayRank : "não informada"}`}>{Number.isFinite(entry.displayRank) ? entry.displayRank : "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="usage-no-results">
                <strong>Nenhum resultado</strong>
                <p>Tente outro nome ou remova o filtro de tipo.</p>
              </div>
            )}
          </aside>

          <div className="usage-results-column">
            {periodMode === "history" && usageStatus === "success" && usage?.daily.length > 0 ? (
              <label className="usage-snapshot-picker">
                <span>Snapshot consultado</span>
                <select
                  value={selectedSnapshotKey}
                  onChange={(event) => setSelectedSnapshotKey(event.target.value)}
                >
                  {usage.daily.map((snapshot) => (
                    <option key={snapshotKey(snapshot)} value={snapshotKey(snapshot)}>
                      {snapshot.season || "Temporada não informada"} · {formatSnapshotDate(snapshot.date)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {periodMode === "history" && usageStatus === "success" && usage?.daily.length === 0 ? (
              <div className="usage-empty usage-empty-compact usage-no-snapshots">
                <p>A fonte não trouxe snapshots para esta consulta. Isso não significa uso zero.</p>
              </div>
            ) : null}
            <UsagePanel
              selectedPokemon={selectedPokemon}
              usage={displayedUsage}
              category={activeCategory}
              periodMode={periodMode}
              activeSeason={indexData?.season}
              status={usageStatus}
              error={usageError}
              metaRollIndex={metaRollIndex}
              metaRollIndexStatus={metaRollIndexStatus}
              metaRollIndexError={metaRollIndexError}
              onRetryMetaRoll={onRetryMetaRoll}
              onOpenMetaRoll={(section) => onOpenMetaRoll(selectedPokemon?.name, section, selectedPokemon?.metaRollId)}
              onRetry={() => {
                refreshUsage(true);
              }}
              onCategoryChange={setCategoryId}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UsagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceId = searchParams.get("source") === "metaroll" ? "metaroll" : "pokemon-champions-battle-data";
  const initialPokemonName = searchParams.get("pokemon") || "";
  const showingMetaDetails = sourceId === "metaroll";
  const showingTrainerLadder = showingMetaDetails && searchParams.get("view") === "trainers";
  const [metaRollIndex, setMetaRollIndex] = useState(null);
  const [metaRollIndexStatus, setMetaRollIndexStatus] = useState("loading");
  const [metaRollIndexError, setMetaRollIndexError] = useState("");
  const [metaRollIndexRetry, setMetaRollIndexRetry] = useState(0);
  const metaRollIndexForceKey = useRef("");
  const metaRollProvider = usageProviders.metaroll;

  function refreshMetaRollIndex() {
    const nextRetry = metaRollIndexRetry + 1;
    metaRollIndexForceKey.current = `index|${nextRetry}`;
    setMetaRollIndexStatus("loading");
    setMetaRollIndexError("");
    setMetaRollIndexRetry(nextRetry);
  }

  useEffect(() => {
    if (sourceId === "metaroll") return undefined;
    let active = true;
    const requestKey = `index|${metaRollIndexRetry}`;
    const force = metaRollIndexForceKey.current === requestKey;
    if (force) metaRollIndexForceKey.current = "";
    metaRollProvider.loadIndex({ force }).then((result) => {
      if (!active) return;
      setMetaRollIndex(result);
      setMetaRollIndexStatus("success");
    }).catch(() => {
      if (!active) return;
      setMetaRollIndexStatus("error");
      setMetaRollIndexError("A fonte não respondeu. Tente novamente mais tarde.");
    });
    return () => { active = false; };
  }, [metaRollIndexRetry, metaRollProvider, sourceId]);

  useCacheRevalidation(metaRollIndex?.cacheExpiresAt, refreshMetaRollIndex, sourceId !== "metaroll" && Boolean(metaRollIndex));

  const selectPokemon = (pokemonName) => {
    if (!pokemonName) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("pokemon", pokemonName);
    nextParams.delete("metaRollId");
    setSearchParams(nextParams, { replace: true });
  };
  const openMetaRoll = (pokemonName = initialPokemonName, section = "summary", metaRollId = "") => {
    const sectionByCategory = { move: "moves", held_item: "items", ability: "abilities", stat_alignment: "natures", stat_points: "spreads", teammate: "teammates" };
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("source", "metaroll");
    if (pokemonName) nextParams.set("pokemon", pokemonName);
    if (metaRollId) nextParams.set("metaRollId", metaRollId);
    else nextParams.delete("metaRollId");
    nextParams.set("section", sectionByCategory[section] || section);
    setSearchParams(nextParams, { replace: true });
  };
  const openMetaRollLadder = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("source", "metaroll");
    nextParams.set("view", "trainers");
    nextParams.delete("metaRollId");
    setSearchParams(nextParams, { replace: true });
  };
  const returnToComparison = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("source");
    nextParams.delete("view");
    nextParams.delete("section");
    nextParams.delete("metaRollId");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <section className={"page-wrap usage-page" + (showingMetaDetails ? " metaroll-page" : "")}>
      <div className="page-heading-row usage-heading">
        <div>
          <p className="page-label">Pesquisa de Doubles</p>
          <h1>{showingTrainerLadder ? "Ladder de jogadores" : showingMetaDetails ? "Histórico e confrontos" : "Usage"}</h1>
          <p className="page-intro">{showingTrainerLadder ? "Classificação publicada de jogadores de Doubles." : showingMetaDetails ? `Dados complementares publicados para ${initialPokemonName || "a espécie selecionada"}.` : "Explore espécies e consulte rankings e distribuições publicados para Doubles."}</p>
        </div>
        {showingMetaDetails
          ? <button className="button button-outline" type="button" onClick={returnToComparison}>Voltar ao catálogo</button>
          : <button className="button button-outline" type="button" onClick={openMetaRollLadder}>Ladder de jogadores</button>}
      </div>
      {showingMetaDetails
        ? <MetaRollUsagePage initialPokemonName={initialPokemonName} initialPokemonId={searchParams.get("metaRollId") || ""} initialView={searchParams.get("view") === "trainers" ? "trainers" : "species"} initialSection={searchParams.get("section") || "summary"} onPokemonSelect={selectPokemon} />
        : <BattleDataUsagePage initialPokemonName={initialPokemonName} onPokemonSelect={selectPokemon} metaRollIndex={metaRollIndex} metaRollIndexStatus={metaRollIndexStatus} metaRollIndexError={metaRollIndexError} onRetryMetaRoll={refreshMetaRollIndex} onOpenMetaRoll={openMetaRoll} />}
    </section>
  );
}
