import { useEffect, useState } from "react";
import { TypeTag } from "../components/TypeTag.jsx";
import { activeUsageProvider } from "../data/usage/activeProvider.js";

const categories = [
  { id: "move", label: "Golpes" },
  { id: "held_item", label: "Itens" },
  { id: "ability", label: "Habilidades" },
  { id: "stat_alignment", label: "Naturezas" },
  { id: "stat_points", label: "Stat Points" },
  { id: "teammate", label: "Parceiros" },
];

const statPointLabels = [
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
          <div className="usage-bar-track" aria-hidden="true">
            {hasBar ? <span style={{ width: barWidth }} /> : null}
          </div>
          <b>{row.percentage || "Não informado"}</b>
        </div>
      </div>
    </li>
  );
}

function UsagePanel({ selectedPokemon, usage, category, status, error, source, onRetry }) {
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

  const rows = usage ? usage.rows.filter((row) => row.category === category.id) : [];

  return (
    <section className="usage-detail-panel" aria-label={"Uso de " + selectedPokemon.name}>
      <div className="usage-detail-heading">
        <div>
          <p className="page-label">Visão da espécie</p>
          <h2>{selectedPokemon.name}</h2>
          <div className="type-list usage-type-list">
            {selectedPokemon.types.map((type) => <TypeTag key={type} type={type} />)}
          </div>
        </div>
        <span className="usage-format-stamp">Doubles</span>
      </div>

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
          <div className="usage-provenance" aria-label="Fonte e período dos dados">
            <div className="usage-provenance-source">
              <span>Fonte</span>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.attribution}
              </a>
            </div>
            <div>
              <span>Período informado pela fonte</span>
              <strong>
                Temporada {usage.season || "não informada"}
                <span className="usage-provenance-separator"> · </span>
                {formatSnapshotDate(usage.date)}
              </strong>
            </div>
            <div className="usage-provenance-notes">
              <span>A temporada é o rótulo da fonte; o regulamento oficial não foi confirmado.</span>
              <span>Tamanho da amostra não informado.</span>
              <span>Denominador não informado; percentual de partidas não confirmado.</span>
            </div>
          </div>

          <div className="usage-category-heading">
            <div>
              <p className="page-label">Distribuição publicada</p>
              <h3>{category.label}</h3>
            </div>
            <span>{rows.length} linhas</span>
          </div>

          {status === "success" && rows.length === 0 ? (
            <div className="usage-empty usage-empty-compact">
              <p>Esta resposta não trouxe linhas para “{category.label}”.</p>
            </div>
          ) : null}

          {status === "success" && rows.length > 0 ? (
            <ol className="usage-row-list">
              {rows.map((row, index) => (
                <CategoryRow
                  key={category.id + "-" + (row.rank === null ? index : row.rank)}
                  row={row}
                  category={category}
                />
              ))}
            </ol>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function UsagePage() {
  const provider = activeUsageProvider;
  const [indexData, setIndexData] = useState(null);
  const [indexStatus, setIndexStatus] = useState("loading");
  const [indexError, setIndexError] = useState("");
  const [indexRetry, setIndexRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("position");
  const [selectedId, setSelectedId] = useState(null);
  const [categoryId, setCategoryId] = useState("move");
  const [usage, setUsage] = useState(null);
  const [usageStatus, setUsageStatus] = useState("idle");
  const [usageError, setUsageError] = useState("");
  const [usageRetry, setUsageRetry] = useState(0);

  useEffect(() => {
    let active = true;

    provider.loadIndex({ force: indexRetry > 0 }).then((result) => {
      if (!active) return;
      setIndexData(result);
      setIndexStatus("success");
      setSelectedId((current) => {
        if (current) return current;
        return [...result.pokemon].sort((left, right) => {
          const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
          const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
          return leftPosition - rightPosition;
        })[0]?.showdownId || null;
      });
    }).catch(() => {
      if (!active) return;
      setIndexData(null);
      setIndexStatus("error");
      setIndexError("Confira sua conexão ou tente novamente mais tarde.");
    });

    return () => { active = false; };
  }, [provider, indexRetry]);

  useEffect(() => {
    if (!selectedId) return undefined;

    let active = true;

    provider.loadPokemonUsage({ showdownId: selectedId, force: usageRetry > 0 }).then((result) => {
      if (!active) return;
      setUsage(result);
      setUsageStatus("success");
    }).catch(() => {
      if (!active) return;
      setUsage(null);
      setUsageStatus("error");
      setUsageError("A API pode estar temporariamente fora do ar. Nenhum dado local foi substituído.");
    });

    return () => { active = false; };
  }, [provider, selectedId, usageRetry]);

  const selectedPokemon = indexData?.pokemon.find((entry) => entry.showdownId === selectedId) || null;
  const types = Array.from(new Set(indexData?.pokemon.flatMap((entry) => entry.types) || [])).sort();
  const normalizedQuery = normalizeSearch(query.trim());
  const filteredPokemon = (indexData?.pokemon || [])
    .filter((entry) => {
      const nameMatches = normalizeSearch(entry.name).includes(normalizedQuery)
        || normalizeSearch(entry.showdownId).includes(normalizedQuery);
      const typeMatches = typeFilter === "all" || entry.types.includes(typeFilter);
      return nameMatches && typeMatches;
    })
    .sort((left, right) => {
      if (sortBy === "name") return left.name.localeCompare(right.name, "pt-BR");
      const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
      const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
      return left.name.localeCompare(right.name, "pt-BR");
    });

  const activeCategory = categories.find((item) => item.id === categoryId) || categories[0];

  return (
    <section className="page-wrap usage-page">
      <div className="page-heading-row usage-heading">
        <div>
          <p className="page-label">Pesquisa de Doubles</p>
          <h1>Usage</h1>
          <p className="page-intro">
            Busque uma espécie, filtre por tipo e explore as categorias que a fonte publica.
          </p>
        </div>
        <span className="usage-edition-mark">ESTUDO · 01</span>
      </div>

      <div className="usage-source-banner">
        <span className="usage-source-icon" aria-hidden="true">BD</span>
        <div className="usage-source-copy">
          <a href={provider.source.url} target="_blank" rel="noreferrer">
            {provider.source.attribution}
          </a>
          <p>
            Fonte independente. A tela não combina números com MetaRoll nem fornece uma API própria.
          </p>
        </div>
        <a className="usage-source-guide" href={provider.source.guideUrl} target="_blank" rel="noreferrer">
          Guia da API <span aria-hidden="true">↗</span>
        </a>
      </div>

      {indexStatus === "success" ? (
        <p className="usage-index-note">
          Índice gerado pela fonte em {formatTimestamp(indexData.generatedAt)} ·
          {" "}{indexData.pokemon.length} entradas no índice.
        </p>
      ) : null}

      {indexStatus === "loading" ? (
        <div className="usage-index-state" role="status">
          <span className="usage-spinner" aria-hidden="true" />
          Carregando o índice público de Doubles…
        </div>
      ) : null}

      {indexStatus === "error" ? (
        <div className="usage-error usage-index-error" role="alert">
          <div>
            <strong>O índice não está disponível agora.</strong>
            <p>{indexError}</p>
          </div>
          <button
            className="button button-outline"
            type="button"
            onClick={() => {
              setIndexStatus("loading");
              setIndexError("");
              setIndexRetry((value) => value + 1);
            }}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {indexStatus === "success" ? (
        <div className="usage-layout">
          <aside className="usage-browser-panel" aria-label="Buscar espécies">
            <div className="usage-browser-heading">
              <div>
                <p className="page-label">Índice da fonte</p>
                <h2>Espécies</h2>
              </div>
              <span className="usage-result-count">{filteredPokemon.length}</span>
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

              <label className="usage-filter-field">
                <span>Ordenar</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="position">Posição na fonte</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>
            </div>

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
                          setUsageRetry(0);
                      setUsage(null);
                      setUsageStatus("loading");
                      setUsageError("");
                        }
                      }}
                    >
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
            <nav className="usage-category-tabs" aria-label="Filtrar categoria de uso">
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={"usage-category-tab" + (category.id === categoryId ? " is-active" : "")}
                  type="button"
                  aria-pressed={category.id === categoryId}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </nav>
            <UsagePanel
              source={provider.source}
              selectedPokemon={selectedPokemon}
              usage={usage}
              category={activeCategory}
              status={usageStatus}
              error={usageError}
              onRetry={() => {
                setUsage(null);
                setUsageStatus("loading");
                setUsageError("");
                setUsageRetry((value) => value + 1);
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
