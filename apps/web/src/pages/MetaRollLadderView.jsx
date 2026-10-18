import { useEffect, useRef, useState } from "react";
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

function formatHistoryDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function RatingHistoryPanel({ history, season }) {
  const rankOptions = Array.from(new Set(history.flatMap((point) => Object.keys(point.ratingsByRank))))
    .filter((rank) => /^\d+$/.test(rank))
    .sort((left, right) => Number(left) - Number(right));
  const [selectedMetric, setSelectedMetric] = useState("average");
  const activeMetric = selectedMetric === "average" || rankOptions.includes(selectedMetric) ? selectedMetric : "average";
  const metricValue = (point) => activeMetric === "average"
    ? point.average
    : point.ratingsByRank[activeMetric] ?? null;
  const metricLabel = activeMetric === "average"
    ? "Média publicada"
    : `Posição #${activeMetric}`;
  const points = history.map((point) => ({
    at: point.at,
    time: Date.parse(point.at),
    value: metricValue(point),
    count: point.count,
  })).filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  const counts = Array.from(new Set(points.map((point) => point.count).filter(Number.isFinite)))
    .sort((left, right) => left - right);
  const chart = points.length > 1 ? (() => {
    const width = 760;
    const height = 190;
    const left = 46;
    const right = 738;
    const top = 16;
    const bottom = 148;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.12, 1);
    const minAxis = min - padding;
    const maxAxis = max + padding;
    const firstTime = points[0].time;
    const lastTime = points.at(-1).time;
    const xScale = (time, index) => lastTime === firstTime
      ? left + ((right - left) * index) / (points.length - 1)
      : left + ((time - firstTime) / (lastTime - firstTime)) * (right - left);
    const yScale = (value) => bottom - ((value - minAxis) / (maxAxis - minAxis)) * (bottom - top);
    const coordinates = points.map((point, index) => `${xScale(point.time, index).toFixed(2)},${yScale(point.value).toFixed(2)}`);
    return { width, height, left, right, top, bottom, minAxis, maxAxis, coordinates, first: points[0], last: points.at(-1), yScale };
  })() : null;
  const tableLabel = activeMetric === "average" ? "Média publicada" : `Rating na posição #${activeMetric}`;

  return (
    <section className="metaroll-rating-history" aria-labelledby="metaroll-rating-history-heading">
      <div className="metaroll-rating-history-heading">
        <div>
          <p className="page-label">Tendência de Doubles · MetaRoll</p>
          <h3 id="metaroll-rating-history-heading">Histórico de rating da ladder</h3>
          <p>Valores lidos de <code>ratingHistory</code> na resposta de <code>ladder.json</code>.</p>
        </div>
        <label className="usage-filter-field">
          <span>Série</span>
          <select value={activeMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
            <option value="average">Média publicada</option>
            {rankOptions.map((rank) => <option key={rank} value={rank}>Posição #{rank}</option>)}
          </select>
        </label>
      </div>
      <div className="metaroll-rating-history-meta">
        <div><span>Fonte</span><a href={metaRollSource.url} target="_blank" rel="noreferrer">Dados competitivos: MetaRoll</a></div>
        <div><span>Temporada da resposta</span><strong>{season || "não informada pela resposta"}</strong></div>
        <div><span>Período deste histórico</span><strong>{firstPoint && lastPoint ? `${formatCapture(firstPoint.at)} — ${formatCapture(lastPoint.at)}` : "não informado"}</strong></div>
        <div><span>Pontos</span><strong>{points.length}</strong></div>
        <div><span><code>n</code> informado</span><strong>{counts.length === 0 ? "não informado" : counts.length === 1 ? counts[0] : `${counts[0]}–${counts.at(-1)}`}</strong></div>
      </div>
      {points.length > 1 ? (
        <>
          <svg className="metaroll-rating-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-labelledby="metaroll-rating-chart-title" aria-describedby="metaroll-rating-history-note">
            <title id="metaroll-rating-chart-title">{metricLabel} no histórico MetaRoll de Doubles</title>
            <line x1={chart.left} x2={chart.right} y1={chart.bottom} y2={chart.bottom} />
            <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.bottom} />
            <line className="metaroll-rating-gridline" x1={chart.left} x2={chart.right} y1={chart.yScale((chart.minAxis + chart.maxAxis) / 2)} y2={chart.yScale((chart.minAxis + chart.maxAxis) / 2)} />
            <polyline points={chart.coordinates.join(" ")} />
            <circle cx={chart.left} cy={chart.yScale(chart.first.value)} r="4" />
            <circle cx={chart.right} cy={chart.yScale(chart.last.value)} r="4" />
          </svg>
          <div className="metaroll-rating-chart-dates" aria-hidden="true"><span>{formatHistoryDate(firstPoint.at)}</span><span>{formatHistoryDate(lastPoint.at)}</span></div>
          <div className="metaroll-rating-history-values">
            <div><span>Primeiro ponto · {formatCapture(firstPoint.at)}</span><strong>{formatRating(firstPoint.value)}</strong></div>
            <div><span>Último ponto · {formatCapture(lastPoint.at)}</span><strong>{formatRating(lastPoint.value)}</strong></div>
          </div>
          <p className="metaroll-card-note" id="metaroll-rating-history-note"><code>n</code> é o valor informado pela fonte para cada ponto; não é contagem de partidas do metagame. A documentação não descreve formalmente o histórico. Na captura atual, <code>avg</code> coincide com a média dos ratings listados e <code>ranks</code> com os ratings das posições correspondentes; isso não reconstrói pontos antigos.</p>
          <details className="metaroll-rating-history-details">
            <summary>Ver pontos publicados</summary>
            <div className="metaroll-rating-table-wrap">
              <table>
                <caption>Valores da série selecionada: {tableLabel}</caption>
                <thead><tr><th scope="col">Captura (UTC)</th><th scope="col">{tableLabel}</th><th scope="col"><code>n</code></th></tr></thead>
                <tbody>{points.map((point) => <tr key={point.at}><td><time dateTime={point.at}>{formatCapture(point.at)}</time></td><td>{formatRating(point.value)}</td><td>{point.count ?? "não informado"}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="metaroll-empty">A fonte não publicou pontos suficientes de histórico de rating para esta captura.</p>
      )}
    </section>
  );
}

export function MetaRollLadderView({ season, seasonOptions, currentSeason, onSeasonChange }) {
  const [ladderState, setLadderState] = useState({ key: "", status: "idle" });
  const [ladderRetry, setLadderRetry] = useState(0);
  const ladderForceKey = useRef("");
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
    const force = ladderForceKey.current === requestKey;
    if (force) ladderForceKey.current = "";

    metaRollProvider.loadLadder({
      season: season || undefined,
      force,
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
          <button className="button button-outline" type="button" onClick={() => {
            const nextRetry = ladderRetry + 1;
            ladderForceKey.current = `${season || "current"}|${nextRetry}`;
            setLadderRetry(nextRetry);
          }}>Tentar de novo</button>
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
          {currentLadderState.data.ratingHistory.length > 0 ? (
            <RatingHistoryPanel key={season || "current"} history={currentLadderState.data.ratingHistory} season={currentLadderState.data.season} />
          ) : <p className="metaroll-empty">A fonte não publicou histórico de rating nesta captura.</p>}
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
