import { useEffect, useState } from "react";
import { usageProviders } from "../data/usage/registry.js";

const metaRollProvider = usageProviders.metaroll;
const metaRollSource = metaRollProvider.source;

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

function formatRating(value) {
  return Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    : "não informado";
}

function formatPreviousRank(person) {
  if (!Object.hasOwn(person, "previousRank")) return "não informada";
  return person.previousRank === null ? "fora da captura anterior" : "#" + person.previousRank;
}

export function MetaRollLadderView({ season, seasonOptions, currentSeason, onSeasonChange }) {
  const [ladderState, setLadderState] = useState({ key: "", status: "idle" });
  const [ladderRetry, setLadderRetry] = useState(0);
  const [ladderQuery, setLadderQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [ladderSort, setLadderSort] = useState("rank");
  const [ladderPage, setLadderPage] = useState(1);
  const [ladderPageSize, setLadderPageSize] = useState(50);
  const requestKey = `${season || "current"}|${ladderRetry}`;
  const currentLadderState = ladderState.key === requestKey
    ? ladderState
    : { key: requestKey, status: "loading" };

  useEffect(() => {
    let active = true;

    metaRollProvider.loadLadder({
      season: season || undefined,
      force: ladderRetry > 0,
    }).then((result) => {
      if (active) setLadderState({ key: requestKey, status: "success", data: result });
    }).catch(() => {
      if (active) setLadderState({
        key: requestKey,
        status: "error",
        error: "A ladder de jogadores da MetaRoll não está disponível agora.",
      });
    });

    return () => { active = false; };
  }, [season, ladderRetry, requestKey]);

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
    <section className="metaroll-ladder-panel" aria-label="Ladder de jogadores de Doubles">
      <div className="metaroll-ladder-heading">
        <div><p className="page-label">Classificação de jogadores · Doubles</p><h2>Ladder</h2><p>A resposta atual da fonte cobre os jogadores que ela publica, até o limite do próprio arquivo.</p></div>
        <label className="usage-filter-field">
          <span>Temporada</span>
          <select value={season} onChange={(event) => onSeasonChange(event.target.value)}>
            <option value="">Atual · {currentSeason || "rótulo não informado"}</option>
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
  );
}
