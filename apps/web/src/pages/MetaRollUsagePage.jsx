import { useEffect, useState } from "react";
import { usageProviders } from "../data/usage/registry.js";

const distributionSections = [
  ["moves", "Golpes"],
  ["items", "Itens"],
  ["abilities", "Habilidades"],
  ["natures", "Naturezas"],
  ["teammates", "Parceiros"],
  ["spreads", "Stat Points"],
];

const filters = [
  ["moves", "Golpe"],
  ["items", "Item"],
  ["abilities", "Habilidade"],
];

const metaRollProvider = usageProviders.metaroll;
const metaRollSource = metaRollProvider.source;

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

function DistributionCard({ title, rows, spread = false, note = "" }) {
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
                    <strong>{row.name || "Nome não informado"}</strong>
                  )}
                  <b className="metaroll-row-percent">{displayPercent(row.percentageValue)}</b>
                </div>
                <div className="usage-bar-track" aria-hidden="true">
                  {hasBar ? <span style={{ width: barWidth }} /> : null}
                </div>
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

function MatchupSpeciesCard({ title, rows, outcomeLabel }) {
  return (
    <section className="metaroll-card">
      <div className="metaroll-card-heading"><h3>{title}</h3><span>{rows.length}</span></div>
      {rows.length === 0 ? <p className="metaroll-empty">Nenhuma linha foi devolvida nesta categoria.</p> : (
        <ol className="metaroll-list matchup-list">
          {rows.map((row, index) => (
            <li className="metaroll-list-row matchup-row" key={row.name + "-" + index}>
              <span className="metaroll-row-rank">#{index + 1}</span>
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

function formatRating(value) {
  return Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    : "não informado";
}

function formatPreviousRank(person) {
  if (!Object.hasOwn(person, "previousRank")) return "não informada";
  return person.previousRank === null ? "fora da captura anterior" : "#" + person.previousRank;
}

export function MetaRollUsagePage() {
  const [indexData, setIndexData] = useState(null);
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [season, setSeason] = useState("");
  const [indexStatus, setIndexStatus] = useState("loading");
  const [indexError, setIndexError] = useState("");
  const [indexRetry, setIndexRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [moveFilter, setMoveFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [abilityFilter, setAbilityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("rank");
  const [selectedId, setSelectedId] = useState(null);
  const [entryState, setEntryState] = useState({ key: "", status: "idle" });
  const [entryRetry, setEntryRetry] = useState(0);
  const [selectedUsageDate, setSelectedUsageDate] = useState("");
  const [view, setView] = useState("species");
  const [ladderState, setLadderState] = useState({ key: "", status: "idle" });
  const [ladderRetry, setLadderRetry] = useState(0);
  const [ladderQuery, setLadderQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [ladderSort, setLadderSort] = useState("rank");
  const [ladderPage, setLadderPage] = useState(1);
  const [ladderPageSize, setLadderPageSize] = useState(50);
  const entryRequestKey = `${season || "current"}|${selectedId || ""}|${entryRetry}`;
  const currentEntryState = entryState.key === entryRequestKey
    ? entryState
    : { key: entryRequestKey, status: selectedId ? "loading" : "idle" };
  const entry = currentEntryState.status === "success" ? currentEntryState.entry : null;
  const entryCapture = currentEntryState.status === "success" ? currentEntryState.capture : null;
  const entryStatus = currentEntryState.status;
  const entryError = currentEntryState.error || "";
  const ladderRequestKey = `${season || "current"}|${ladderRetry}`;
  const currentLadderState = ladderState.key === ladderRequestKey
    ? ladderState
    : { key: ladderRequestKey, status: "loading" };

  useEffect(() => {
    let active = true;
    metaRollProvider.loadIndex({ season: season || undefined, force: indexRetry > 0 }).then((result) => {
      if (!active) return;
      setIndexData(result);
      setIndexStatus("success");
      setSeasonOptions((current) => current.length > 0 ? current : result.pastSeasons);
      setSelectedId((current) => result.entries.some((item) => item.id === current)
        ? current
        : [...result.entries].sort((left, right) => {
          const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
          const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
          return leftRank - rightRank;
        })[0]?.id || null);
    }).catch(() => {
      if (!active) return;
      setIndexData(null);
      setIndexStatus("error");
      setIndexError("MetaRoll não respondeu. Tente novamente mais tarde.");
    });

    return () => { active = false; };
  }, [season, indexRetry]);

  useEffect(() => {
    if (view !== "trainers") return undefined;
    let active = true;
    const requestKey = `${season || "current"}|${ladderRetry}`;

    metaRollProvider.loadLadder({
      season: season || undefined,
      force: ladderRetry > 0,
    }).then((result) => {
      if (!active) return;
      setLadderState({ key: requestKey, status: "success", data: result });
    }).catch(() => {
      if (!active) return;
      setLadderState({
        key: requestKey,
        status: "error",
        error: "A ladder de jogadores da MetaRoll não está disponível agora.",
      });
    });

    return () => { active = false; };
  }, [view, season, ladderRetry]);

  useEffect(() => {
    if (view !== "species" || !selectedId) return undefined;
    let active = true;
    const requestKey = `${season || "current"}|${selectedId}|${entryRetry}`;

    metaRollProvider.loadPokemonUsage({
      id: selectedId,
      season: season || undefined,
      force: entryRetry > 0,
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
        },
      });
      setSelectedUsageDate(result.entry.usageHistory.at(-1)?.date || "");
    }).catch(() => {
      if (!active) return;
      setEntryState({
        key: requestKey,
        status: "error",
        error: "MetaRoll pode estar temporariamente indisponível para esta espécie.",
      });
    });

    return () => { active = false; };
  }, [view, selectedId, season, entryRetry]);

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
  const ladderEntries = currentLadderState.status === "success" ? currentLadderState.data.entries : [];
  const ladderCountries = Array.from(new Set(ladderEntries.map((person) => person.country?.name).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  const ladderLanguages = Array.from(new Set(ladderEntries.map((person) => person.language?.name).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  const normalizedLadderQuery = normalizeSearch(ladderQuery.trim());
  const filteredLadder = ladderEntries.filter((person) => (
    normalizeSearch(person.name).includes(normalizedLadderQuery)
    || normalizeSearch(person.id).includes(normalizedLadderQuery)
  ) && (countryFilter === "all" || person.country?.name === countryFilter)
    && (languageFilter === "all" || person.language?.name === languageFilter))
    .sort((left, right) => {
      const leftValue = left[ladderSort];
      const rightValue = right[ladderSort];
      if (ladderSort === "name") return left.name.localeCompare(right.name, "pt-BR");
      if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue) {
        return ladderSort === "rank" ? leftValue - rightValue : rightValue - leftValue;
      }
      if (Number.isFinite(leftValue)) return -1;
      if (Number.isFinite(rightValue)) return 1;
      return left.name.localeCompare(right.name, "pt-BR");
    });
  const ladderPageCount = Math.max(1, Math.ceil(filteredLadder.length / ladderPageSize));
  const currentLadderPage = Math.min(ladderPage, ladderPageCount);
  const pagedLadder = filteredLadder.slice((currentLadderPage - 1) * ladderPageSize, currentLadderPage * ladderPageSize);

  return (
    <section className="page-wrap usage-page metaroll-page">
      <div className="page-heading-row usage-heading">
        <div>
          <p className="page-label">Pesquisa de Doubles</p>
          <h1>Usage · MetaRoll</h1>
          <p className="page-intro">Ficha e histórico do ladder ranqueado publicados por esta fonte independente.</p>
        </div>
        <span className="usage-edition-mark">CAPTURA · MR</span>
      </div>

      <div className="usage-source-banner metaroll-source-banner">
        <span className="usage-source-icon" aria-hidden="true">MR</span>
        <div className="usage-source-copy">
          <a href={metaRollSource.url} target="_blank" rel="noreferrer">{metaRollSource.attribution}</a>
          <p>Fonte independente. Os dados aparecem separados de Pokémon Champions Battle Data.</p>
        </div>
        <a className="usage-source-guide" href={metaRollSource.guideUrl} target="_blank" rel="noreferrer">
          Guia da API <span aria-hidden="true">↗</span>
        </a>
      </div>

      {view === "species" && indexStatus === "success" ? (
        <div className="metaroll-capture-note" aria-label="Captura e período da fonte">
          <span><b>Formato</b> Doubles</span>
          <span><b>Temporada</b> {indexData.season || "não informada"}</span>
          <span><b>Captura</b> {formatCapture(indexData.capturedAt)}</span>
          <span><b>Pokémon no ranking</b> {indexData.count}</span>
          <p>A temporada é o nome da fonte; o regulamento oficial não foi confirmado. A contagem é de Pokémon ranqueados, não de partidas.</p>
        </div>
      ) : null}

      <div className="metaroll-view-switch" role="group" aria-label="Seção da fonte MetaRoll">
        <button className={view === "species" ? "is-active" : ""} type="button" aria-pressed={view === "species"} onClick={() => {
          if (view === "species") return;
          setView("species");
          setEntryState({ key: "", status: "loading" });
        }}>Espécies</button>
        <button className={view === "trainers" ? "is-active" : ""} type="button" aria-pressed={view === "trainers"} onClick={() => {
          if (view === "trainers") return;
          setView("trainers");
          setLadderState({ key: "", status: "loading" });
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
            setIndexRetry((value) => value + 1);
          }}>Tentar de novo</button>
        </div>
      ) : null}

      {view === "trainers" ? (
        <section className="metaroll-ladder-panel" aria-label="Ladder de jogadores de Doubles">
          <div className="metaroll-ladder-heading">
            <div><p className="page-label">Classificação de jogadores · Doubles</p><h2>Ladder</h2><p>A resposta atual da fonte cobre os jogadores que ela publica, até o limite do próprio arquivo.</p></div>
            <label className="usage-filter-field">
              <span>Temporada</span>
              <select value={season} onChange={(event) => {
                setSeason(event.target.value);
                setIndexData(null);
                setIndexStatus("loading");
                setIndexRetry(0);
                setEntryRetry(0);
                setLadderRetry(0);
                setLadderPage(1);
                setCountryFilter("all");
                setLanguageFilter("all");
              }}>
                <option value="">Atual · {indexData?.season || "rótulo não informado"}</option>
                {seasonOptions.map((seasonName) => <option key={seasonName} value={seasonName}>{seasonName} · captura final</option>)}
              </select>
            </label>
          </div>
          {currentLadderState.status === "loading" ? (
            <div className="usage-index-state" role="status"><span className="usage-spinner" aria-hidden="true" />Carregando ladder de jogadores…</div>
          ) : null}
          {currentLadderState.status === "error" ? (
            <div className="usage-error usage-index-error" role="alert">
              <div><strong>Não foi possível carregar esta captura.</strong><p>{currentLadderState.error}</p></div>
              <button className="button button-outline" type="button" onClick={() => setLadderRetry((value) => value + 1)}>Tentar de novo</button>
            </div>
          ) : null}
          {currentLadderState.status === "success" ? (
            <>
              <div className="metaroll-ladder-capture">
                <div><span>Fonte</span><a href={metaRollSource.url} target="_blank" rel="noreferrer">Dados competitivos: MetaRoll</a></div>
                <div><span>Formato</span><strong>Doubles</strong></div>
                <div><span>Temporada consultada</span><strong>{currentLadderState.data.season || season || "não informada pela resposta"}</strong></div>
                <div><span>Captura da ladder</span><strong>{formatCapture(currentLadderState.data.capturedAt)}</strong></div>
                <div><span>Comparação de posição</span><strong>{formatCapture(currentLadderState.data.comparedTo)}</strong></div>
                <div><span>Entradas listadas</span><strong>{currentLadderState.data.count ?? "não informadas"}</strong></div>
                <p>O arquivo documentado contém até 1.000 jogadores. `rating` já vem dividido pela fonte; taxa de vitória é `wins / battles`. Isto não é o ladder completo nem uma amostra de partidas do metagame.</p>
              </div>
              <div className="metaroll-ladder-filters">
                <label className="usage-search-field"><span>Buscar jogador ou ID</span><input type="search" value={ladderQuery} onChange={(event) => { setLadderQuery(event.target.value); setLadderPage(1); }} placeholder="Nome ou ID publicado" autoComplete="off" /></label>
                <label className="usage-filter-field"><span>País</span><select value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setLadderPage(1); }}><option value="all">Todos</option>{ladderCountries.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                <label className="usage-filter-field"><span>Idioma</span><select value={languageFilter} onChange={(event) => { setLanguageFilter(event.target.value); setLadderPage(1); }}><option value="all">Todos</option>{ladderLanguages.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                <label className="usage-filter-field"><span>Ordenar por</span><select value={ladderSort} onChange={(event) => { setLadderSort(event.target.value); setLadderPage(1); }}><option value="rank">Posição</option><option value="rating">Rating</option><option value="battles">Partidas</option><option value="winRate">Taxa de vitórias publicada</option><option value="name">Nome A–Z</option></select></label>
                <label className="usage-filter-field"><span>Linhas por página</span><select value={ladderPageSize} onChange={(event) => { setLadderPageSize(Number(event.target.value)); setLadderPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
              </div>
              <div className="metaroll-ladder-results-heading"><strong>{filteredLadder.length} jogadores</strong><span>Página {currentLadderPage} de {ladderPageCount}</span></div>
              {pagedLadder.length > 0 ? (
                <ol className="metaroll-ladder-list">
                  {pagedLadder.map((person) => (
                    <li className="metaroll-ladder-row" key={person.id}>
                      <div className="metaroll-player-identity"><span className="metaroll-player-rank">{person.rank === null ? "—" : "#" + person.rank}</span><div><strong>{person.name || "Nome não informado"}</strong><small>ID {person.id}</small></div></div>
                      <div><span>Rating</span><strong>{formatRating(person.rating)}</strong></div>
                      <div><span>Registro publicado</span><strong>{person.wins ?? "—"}V · {person.losses ?? "—"}D · {person.draws ?? "—"}E</strong></div>
                      <div><span>Partidas</span><strong>{person.battles ?? "não informado"}</strong></div>
                      <div><span>Taxa de vitórias</span><strong>{person.winRate === null ? "não informada" : `${person.winRate}%`}</strong></div>
                      <div><span>País · idioma</span><strong>{person.country?.flag ? person.country.flag + " " : ""}{person.country?.name || "não informado"} · {person.language?.name || "não informado"}</strong></div>
                      <div><span>Posição anterior</span><strong>{formatPreviousRank(person)}</strong></div>
                      <div><span>Avatar no jogo</span><strong>{person.avatar === null ? "não informado" : "#" + person.avatar}</strong></div>
                    </li>
                  ))}
                </ol>
              ) : <div className="usage-no-results"><strong>Nenhum resultado</strong><p>Tente outro nome ou remova um filtro.</p></div>}
              <div className="metaroll-ladder-pagination"><button className="button button-outline button-small" type="button" disabled={currentLadderPage <= 1} onClick={() => setLadderPage((page) => Math.max(1, page - 1))}>Anterior</button><span>{currentLadderPage} / {ladderPageCount}</span><button className="button button-outline button-small" type="button" disabled={currentLadderPage >= ladderPageCount} onClick={() => setLadderPage((page) => Math.min(ladderPageCount, page + 1))}>Próxima</button></div>
            </>
          ) : null}
        </section>
      ) : null}

      {view === "species" && indexStatus === "success" ? (
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
            <p className="usage-filter-note">A MetaRoll não publica tipo nesta ficha. As facetas usam golpes, itens e habilidades do próprio arquivo desta captura.</p>
            <div className="usage-list-caption"><span>Nome</span><span>Posição</span></div>
            {visibleEntries.length > 0 ? (
              <ul className="usage-species-list">
                {visibleEntries.map((item) => (
                  <li key={item.id}>
                    <button className={"usage-species-button" + (item.id === selectedId ? " is-selected" : "")} type="button" aria-pressed={item.id === selectedId} onClick={() => {
                      if (item.id === selectedId) return;
                      setSelectedId(item.id);
                      setEntryRetry(0);
                    }}>
                      <span className="usage-species-name"><strong>{item.name}</strong></span>
                      <span className="usage-position">{item.rank === null ? "—" : "#" + item.rank}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <div className="usage-no-results"><strong>Nenhum resultado</strong><p>Remova um filtro ou tente outro nome.</p></div>}
          </aside>

          <section className="usage-detail-panel metaroll-detail-panel" aria-label="Ficha competitiva MetaRoll">
            {!selectedEntry ? <div className="usage-empty"><p>Escolha uma espécie para abrir a ficha.</p></div> : (
              <>
                <div className="usage-detail-heading">
                  <div><p className="page-label">Ficha de Doubles</p><h2>{selectedEntry.name}</h2></div>
                  <span className="usage-format-stamp">#{entry?.rank ?? selectedEntry.rank ?? "—"} · Doubles</span>
                </div>
                {entryStatus === "loading" || entryStatus === "idle" ? (
                  <div className="usage-loading" role="status"><span className="usage-spinner" aria-hidden="true" />Carregando ficha de {selectedEntry.name}…</div>
                ) : null}
                {entryStatus === "error" ? (
                  <div className="usage-error" role="alert"><div><strong>Não foi possível carregar esta espécie.</strong><p>{entryError}</p></div><button className="button button-outline button-small" type="button" onClick={() => {
                    setEntryRetry((value) => value + 1);
                  }}>Tentar de novo</button></div>
                ) : null}
                {entry ? (
                  <>
                    <div className="usage-provenance metaroll-provenance">
                      <div className="usage-provenance-source"><span>Fonte</span><a href={metaRollSource.url} target="_blank" rel="noreferrer">Dados competitivos: MetaRoll</a></div>
                      <div><span>Período devolvido pela fonte</span><strong>Temporada {entryCapture?.season || "não informada"} · captura {formatCapture(entryCapture?.capturedAt)}</strong></div>
                      <div className="usage-provenance-notes"><span>Golpes, itens, habilidades, naturezas e spreads são parcelas das aparições deste Pokémon.</span><span>Parceiros não têm percentual publicado.</span><span>Tamanho da amostra não informado.</span><span>Stat Points não são EVs e a fonte não pareia spread com natureza.</span>{entryCapture?.comparedTo ? <span>Posição anterior comparada com a captura de {formatCapture(entryCapture.comparedTo)}.</span> : null}</div>
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
                    <div className="metaroll-profile-grid">
                      {distributionSections.map(([key, label]) => (
                        <DistributionCard
                          key={key}
                          title={label}
                          rows={entry.distributions[key]}
                          spread={key === "spreads"}
                          note={key === "teammates" ? "A fonte lista parceiros sem percentual." : key === "spreads" ? "Distribuição de Stat Points, sem natureza associada." : ""}
                        />
                      ))}
                    </div>

                    <section className="metaroll-matchups-section">
                      <div className="usage-category-heading"><div><p className="page-label">Relações publicadas</p><h3>Matchups</h3></div><span>MetaRoll</span></div>
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
                    </section>

                    <section className="metaroll-history-section">
                      <div className="usage-category-heading"><div><p className="page-label">Histórico da temporada</p><h3>Posição e distribuições diárias</h3></div><span>{entry.rankHistory.length} dias de ranking</span></div>
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
                    </section>
                  </>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
