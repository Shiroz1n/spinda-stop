import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { ItemSprite, PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { usageProviders } from "../data/usage/registry.js";
import { useCacheRevalidation } from "../data/usage/useCacheRevalidation.js";
import { findUsagePokemonByReference } from "../data/usage/pokemonQuery.js";
import { MetaRollUsagePage } from "./MetaRollUsagePage.jsx";

const categories = [
  { id: "profile", label: "Ficha completa" },
  { id: "move", label: "Golpes" },
  { id: "held_item", label: "Itens" },
  { id: "ability", label: "Habilidades" },
  { id: "stat_alignment", label: "Naturezas" },
  { id: "stat_points", label: "Stat Points" },
  { id: "teammate", label: "Parceiros" },
];

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

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function snapshotKey(snapshot) {
  return [snapshot.season || "", snapshot.date || "", snapshot.sourceFile || ""].join("|");
}

function CategoryRow({ row, category }) {
  const percentageValue = row.percentageValue;
  const hasBar = typeof percentageValue === "number";
  const barWidth = hasBar ? Math.max(0, Math.min(100, percentageValue)) + "%" : "0%";
  const statAlignment = category.id === "stat_alignment";

  return (
    <li className="usage-data-row">
      <div className="usage-row-main">
        <div className="usage-row-title">
          <span className="usage-row-rank">{row.rank === null ? "—" : "#" + row.rank}</span>
          {category.id === "stat_points" ? (
            <div className="usage-spread" aria-label="Distribuição de Stat Points">
              {statPointLabels.map(([key, label]) => (
                <span key={key}>
                  <small>{label}</small>
                  <b>{displayValue(row.statPoints[key])}</b>
                </span>
              ))}
            </div>
          ) : (
            <div className="usage-row-copy">
              <span className="usage-row-asset">
                {category.id === "held_item" ? <ItemSprite name={row.name} size={28} /> : null}
                {category.id === "teammate" && findPokemonSprite(row.name) ? <PokemonSprite pokemon={findPokemonSprite(row.name)} name={row.name} size={38} decorative /> : null}
              </span>
              <strong>{row.name || "Nome não informado"}</strong>
              {statAlignment && (row.statUp || row.statDown) ? (
                <small>
                  {row.statUp ? "↑ " + row.statUp : ""}
                  {row.statUp && row.statDown ? " · " : ""}
                  {row.statDown ? "↓ " + row.statDown : ""}
                </small>
              ) : null}
            </div>
          )}
        </div>
        <div className="usage-row-value">
          {hasBar ? <div className="usage-bar-track" aria-hidden="true"><span style={{ width: barWidth }} /></div> : null}
          <b>{hasBar ? row.percentage : "Percentual não informado"}</b>
        </div>
      </div>
    </li>
  );
}

function CategoryRows({ rows, category }) {
  if (rows.length === 0) {
    return (
      <div className="usage-empty usage-empty-compact">
        <p>Esta resposta não trouxe linhas para “{category.label}”.</p>
      </div>
    );
  }

  return (
    <ol className="usage-row-list">
      {rows.map((row, index) => (
        <CategoryRow
          key={category.id + "-" + (row.rank === null ? index : row.rank)}
          row={row}
          category={category}
        />
      ))}
    </ol>
  );
}

function UsagePanel({ selectedPokemon, usage, category, status, error, source, onRetry, onCategoryChange }) {
  if (!selectedPokemon) {
    return (
      <section className="usage-detail-panel" aria-label="Dados da espécie">
        <div className="usage-empty">
          <p className="page-label">Doubles</p>
          <h2>Escolha uma espécie</h2>
          <p>Use a busca ou os filtros ao lado para abrir as linhas publicadas pela fonte.</p>
        </div>
      </section>
    );
  }

  const visibleCategories = categories.filter((item) => item.id !== "profile");
  const rows = usage && category.id !== "profile"
    ? usage.rows.filter((row) => row.category === category.id)
    : [];
  const profileRows = (item) => usage?.rows.filter((row) => row.category === item.id) || [];

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
          {Number.isFinite(selectedPokemon.position) ? <p className="usage-selected-rank"><span>Posição na fonte</span><strong>#{selectedPokemon.position}</strong></p> : null}
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

      {usage ? (
        <>
          <div className="usage-provenance usage-provenance-inline" aria-label="Fonte e período dos dados">
            <a className="usage-provenance-source" href={source.url} target="_blank" rel="noreferrer">
              {source.attribution}
            </a>
            <span><strong>Temporada {usage.season || "não informada"}</strong> · {formatSnapshotDate(usage.date)}</span>
            <span>Consultado {formatTimestamp(usage.appFetchedAt)}</span>
            <details className="usage-source-help">
              <summary>Sobre esta captura</summary>
              {usage.sourceFile ? <p>Arquivo de origem: <code>{usage.sourceFile}</code></p> : null}
              <p>Temporada é o rótulo devolvido pela fonte. A amostra e o denominador não foram publicados; percentuais de distribuição não são taxa de partidas.</p>
            </details>
          </div>

          {category.id === "profile" ? (
            <div className="usage-profile-sections">
              {visibleCategories.map((item) => {
                const itemRows = profileRows(item);
                return (
                  <section className="usage-profile-section" key={item.id}>
                    <div className="usage-category-heading">
                      <div>
                        <h3>{item.label}</h3>
                      </div>
                      <div className="usage-profile-actions"><span>{itemRows.length} linhas</span><button className="text-button" type="button" onClick={() => onCategoryChange(item.id)}>Ver tudo</button></div>
                    </div>
                    <CategoryRows rows={itemRows.slice(0, 2)} category={item} />
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              <div className="usage-category-heading">
                <div>
                  <p className="page-label">Distribuição publicada</p>
                  <h3>{category.label}</h3>
                </div>
                <span>{rows.length} linhas</span>
              </div>
              <CategoryRows rows={rows} category={category} />
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

function BattleDataUsagePage({ initialPokemonName = "", onPokemonSelect, sourceSwitcher }) {
  const provider = usageProviders["pokemon-champions-battle-data"];
  const [indexData, setIndexData] = useState(null);
  const [indexStatus, setIndexStatus] = useState("loading");
  const [indexError, setIndexError] = useState("");
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
  const [categoryId, setCategoryId] = useState("move");
  const [periodMode, setPeriodMode] = useState("current");
  const [historySeason, setHistorySeason] = useState("all");
  const [historyDays, setHistoryDays] = useState(7);
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");
  const [usage, setUsage] = useState(null);
  const [usageStatus, setUsageStatus] = useState("idle");
  const [usageError, setUsageError] = useState("");
  const [usageRetry, setUsageRetry] = useState(0);
  const usageForceKey = useRef("");

  function refreshIndex(force = false) {
    const nextRetry = indexRetry + 1;
    indexForceKey.current = force ? `index|${nextRetry}` : "";
    setIndexStatus("loading");
    setIndexError("");
    setIndexRetry(nextRetry);
  }

  function refreshUsage(force = false) {
    if (!selectedId) return;
    const nextRetry = usageRetry + 1;
    usageForceKey.current = force
      ? [periodMode, historySeason, historyDays, selectedId, nextRetry].join("|")
      : "";
    setUsageStatus("loading");
    setUsageError("");
    setUsageRetry(nextRetry);
  }

  function refreshVisibleData() {
    refreshIndex(true);
    refreshUsage(true);
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
      setSelectedId((current) => {
        if (current && result.pokemon.some((entry) => entry.showdownId === current)) return current;
        if (initialPokemonNameRef.current) {
          return findUsagePokemonByReference(result.pokemon, initialPokemonNameRef.current)?.showdownId || null;
        }
        return [...result.pokemon].sort((left, right) => {
          const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
          const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
          return leftPosition - rightPosition;
        })[0]?.showdownId || null;
      });
    }).catch(() => {
      if (!active) return;
      setIndexStatus("error");
      setIndexError("Confira sua conexão ou tente novamente mais tarde.");
    });

    return () => { active = false; };
  }, [provider, indexRetry]);

  useEffect(() => {
    if (!selectedId) return undefined;

    let active = true;
    const requestKey = [periodMode, historySeason, historyDays, selectedId, usageRetry].join("|");
    const force = usageForceKey.current === requestKey;
    if (force) usageForceKey.current = "";
    const request = { showdownId: selectedId, force };
    if (periodMode === "history") {
      request.days = historyDays;
      if (historySeason !== "all") request.season = historySeason;
    }

    provider.loadPokemonUsage(request).then((result) => {
      if (!active) return;
      setUsage(result);
      setSelectedSnapshotKey((current) => result.daily.some((snapshot) => snapshotKey(snapshot) === current)
        ? current
        : result.daily[0] ? snapshotKey(result.daily[0]) : "");
      setUsageStatus("success");
    }).catch(() => {
      if (!active) return;
      setUsageStatus("error");
      setUsageError("A API pode estar temporariamente fora do ar. Nenhum dado local foi substituído.");
    });

    return () => { active = false; };
  }, [provider, selectedId, periodMode, historySeason, historyDays, usageRetry]);

  const selectedPokemon = indexData?.pokemon.find((entry) => entry.showdownId === selectedId) || null;
  const requestedPokemon = initialPokemonName
    ? findUsagePokemonByReference(indexData?.pokemon || [], initialPokemonName)
    : null;
  const types = Array.from(new Set(indexData?.pokemon.flatMap((entry) => entry.types) || [])).sort();
  const facetOptions = Object.fromEntries(categoryFilters.map(({ key }) => [
    key,
    Array.from(new Set(indexData?.pokemon.flatMap((entry) => entry.filterValues?.[key] || []) || []))
      .sort((left, right) => left.localeCompare(right, "pt-BR")),
  ]));
  const normalizedQuery = normalizeSearch(query.trim());
  const filteredPokemon = (indexData?.pokemon || [])
    .filter((entry) => {
      const nameMatches = normalizeSearch(entry.name).includes(normalizedQuery)
        || normalizeSearch(entry.showdownId).includes(normalizedQuery);
      const typeMatches = typeFilter === "all" || entry.types.includes(typeFilter);
      const moveMatches = moveFilter === "all" || entry.filterValues?.moves?.includes(moveFilter);
      const itemMatches = itemFilter === "all" || entry.filterValues?.items?.includes(itemFilter);
      const abilityMatches = abilityFilter === "all" || entry.filterValues?.abilities?.includes(abilityFilter);
      return nameMatches && typeMatches && moveMatches && itemMatches && abilityMatches;
    })
    .sort((left, right) => {
      if (sortBy === "name") return left.name.localeCompare(right.name, "pt-BR");
      const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
      const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
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
    <section className="page-wrap usage-page">
      <div className="page-heading-row usage-heading">
        <div>
          <p className="page-label">Pesquisa de Doubles</p>
          <h1>Usage</h1>
          <p className="page-intro">Ranking, ficha e distribuições da fonte selecionada.</p>
        </div>
        {sourceSwitcher}
      </div>

      <div className="usage-source-banner">
        <span className="usage-source-icon" aria-hidden="true">BD</span>
        <div className="usage-source-copy">
          <a href={provider.source.url} target="_blank" rel="noreferrer">
            {provider.source.attribution}
          </a>
          <span>Doubles</span>
        </div>
        <details className="usage-source-details">
          <summary>Sobre os dados</summary>
          <p>Esta tela mostra apenas esta fonte. Não combina percentuais com MetaRoll nem expõe uma API própria.</p>
          <a className="usage-source-guide" href={provider.source.guideUrl} target="_blank" rel="noreferrer">Guia da API ↗</a>
        </details>
      </div>

      {indexData ? (
        <div className="usage-index-note" aria-label="Atualização do índice">
          <span className="usage-period-summary">Doubles · {indexData.pokemon.length} Pokémon no índice</span>
          <button className="button button-outline button-small" type="button" disabled={indexStatus === "loading"} onClick={refreshVisibleData}>
            {indexStatus === "loading" ? "Atualizando…" : "Atualizar agora"}
          </button>
          <details className="usage-capture-details"><summary>Captura e consulta</summary><span>Captura {formatTimestamp(indexData.generatedAt)} · Consultado {formatTimestamp(indexData.appFetchedAt)}</span></details>
        </div>
      ) : null}

      {indexStatus === "loading" ? (
        <div className="usage-index-state" role="status">
          <span className="usage-spinner" aria-hidden="true" />
          Carregando o índice público de Doubles…
        </div>
      ) : null}
      {indexStatus === "loading" && indexData ? <p className="usage-refresh-status" role="status">Atualizando os dados em segundo plano…</p> : null}

      {indexStatus === "error" ? (
        <div className="usage-error usage-index-error" role="alert">
          <div>
            <strong>O índice não está disponível agora.</strong>
            <p>{indexError}</p>
          </div>
          <button
            className="button button-outline"
            type="button"
              onClick={() => refreshVisibleData()}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {indexData ? (
        <div className="usage-layout">
          <aside className="usage-browser-panel" aria-label="Buscar espécies">
            <div className="usage-browser-heading">
              <div>
                <p className="page-label">Índice da fonte</p>
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
                    <span>{label} no resumo da fonte{options.length === 0 ? " · sem dados" : ""}</span>
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
                    setUsage(null);
                    setUsageStatus("loading");
                    setUsageError("");
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
                        setUsage(null);
                        setUsageStatus("loading");
                        setUsageError("");
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
                        setUsage(null);
                        setUsageStatus("loading");
                        setUsageError("");
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
                  <option value="position">Posição na fonte</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>

                </div>
              </details>
            </div>

            <p className="usage-filter-note">
              Golpes, itens e habilidades vêm dos destaques do índice atual. Valores ausentes não são inferidos.
            </p>
            {initialPokemonName && indexData && !requestedPokemon ? (
              <p className="usage-request-note" role="status">A Battle Data não listou {initialPokemonName} neste índice. Limpe a busca para escolher outra espécie.</p>
            ) : null}

            <div className="usage-list-caption">
              <span>Nome</span>
              <span>Posição na fonte</span>
            </div>

            {filteredPokemon.length > 0 ? (
              <ul className="usage-species-list">
                {filteredPokemon.map((entry) => (
                  <li key={entry.showdownId}>
                    <button
                      className={"usage-species-button" + (entry.showdownId === selectedId ? " is-selected" : "")}
                      type="button"
                      aria-pressed={entry.showdownId === selectedId}
                      onClick={() => {
                        if (entry.showdownId !== selectedId) {
                          setSelectedId(entry.showdownId);
                          onPokemonSelect?.(entry.name);
                          setUsageRetry(0);
                          setUsage(null);
                          setUsageStatus("loading");
                          setUsageError("");
                        }
                      }}
                    >
                      <span className="usage-species-art"><PokemonSprite pokemon={resolveCompetitivePokemonSprite(findPokemonSprite, { id: entry.showdownId, name: entry.name })} name={entry.name} size={66} decorative /></span>
                      <span className="usage-species-name">
                        <strong>{entry.name}</strong>
                        <span className="type-list">
                          {entry.types.map((type) => <TypeTag key={type} type={type} />)}
                        </span>
                      </span>
                      <span className="usage-position">
                        {entry.position === null ? "—" : entry.position}
                      </span>
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
              source={provider.source}
              selectedPokemon={selectedPokemon}
              usage={displayedUsage}
              category={activeCategory}
              status={usageStatus}
              error={usageError}
              onRetry={() => {
                refreshUsage(true);
              }}
              onCategoryChange={setCategoryId}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UsagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceId = searchParams.get("source") === "metaroll" ? "metaroll" : "pokemon-champions-battle-data";
  const initialPokemonName = searchParams.get("pokemon") || "";
  const selectSource = (nextSource) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("source", nextSource);
    setSearchParams(nextParams, { replace: true });
  };
  const selectPokemon = (pokemonName) => {
    if (!pokemonName) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("pokemon", pokemonName);
    setSearchParams(nextParams, { replace: true });
  };

  const sourceSwitcher = (
    <div className="usage-source-switch" role="group" aria-label="Selecionar fonte de Usage">
      <button
        aria-pressed={sourceId === "pokemon-champions-battle-data"}
        className={sourceId === "pokemon-champions-battle-data" ? "is-active" : ""}
        type="button"
        onClick={() => selectSource("pokemon-champions-battle-data")}
      >
        Battle Data
      </button>
      <button
        aria-pressed={sourceId === "metaroll"}
        className={sourceId === "metaroll" ? "is-active" : ""}
        type="button"
        onClick={() => selectSource("metaroll")}
      >
        MetaRoll
      </button>
    </div>
  );

  return sourceId === "metaroll"
    ? <MetaRollUsagePage initialPokemonName={initialPokemonName} onPokemonSelect={selectPokemon} sourceSwitcher={sourceSwitcher} />
    : <BattleDataUsagePage initialPokemonName={initialPokemonName} onPokemonSelect={selectPokemon} sourceSwitcher={sourceSwitcher} />;
}
