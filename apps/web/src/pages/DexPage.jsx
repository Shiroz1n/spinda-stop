import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { searchPokemon, sortPokemon } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import { PokemonCard } from "../components/PokemonCard.jsx";
import { typeLabel } from "../components/TypeTag.jsx";
import { getOfficialPokemonAliases } from "../data/pokemonChampionsRoster.js";
import { clearRecentResearch, readStoredResearchShortcuts, rememberPokemon, toggleFavoritePokemon, writeStoredResearchShortcuts } from "../data/researchShortcuts.js";

const BATCH_SIZE = 36;
const RESTORE_KEY = "spinda-dex-view";
const RESTORE_TTL = 15 * 60 * 1000;
const MAX_BASE_STAT_TOTAL = Math.max(...dexData.pokemon.map((entry) => entry.baseStatTotal || 0));
const dexSearchCatalog = getOfficialPokemonAliases(dexData.pokemon);

function readSavedView() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RESTORE_KEY) || "null");
    return saved && Date.now() - saved.savedAt < RESTORE_TTL ? saved : null;
  } catch {
    return null;
  }
}

function saveDexView(view) {
  try {
    window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ ...view, savedAt: Date.now() }));
  } catch {
    // Navigation remains available when session storage is disabled.
  }
}

export function DexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialView] = useState(readSavedView);
  const restoreRef = useRef(initialView);
  const [query, setQuery] = useState(() => searchParams.get("q") || initialView?.query || "");
  const [type, setType] = useState(() => searchParams.has("type") ? searchParams.get("type") || "" : initialView?.type || "");
  const [generation, setGeneration] = useState(() => initialView?.generation || "");
  const [minimumBaseStatTotal, setMinimumBaseStatTotal] = useState(() => initialView?.minimumBaseStatTotal || "");
  const [maximumBaseStatTotal, setMaximumBaseStatTotal] = useState(() => initialView?.maximumBaseStatTotal || "");
  const [sort, setSort] = useState(() => initialView?.sort || "number");
  const [shortcuts, setShortcuts] = useState(readStoredResearchShortcuts);
  const [visibleCount, setVisibleCount] = useState(() => Math.max(BATCH_SIZE, initialView?.visibleCount || BATCH_SIZE));
  const sentinelRef = useRef(null);
  const ability = searchParams.get("ability") || "";
  const filtered = useMemo(() => searchPokemon(dexSearchCatalog, query, {
    type,
    generation,
    minimumBaseStatTotal,
    maximumBaseStatTotal,
  }).filter((pokemon) => !ability || (detailData.pokemonBySlug[pokemon.slug]?.abilities || []).some((entry) => entry.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR") === ability.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"))), [query, type, generation, minimumBaseStatTotal, maximumBaseStatTotal, ability]);
  const results = useMemo(() => sortPokemon(filtered, sort), [filtered, sort]);
  const visible = results.slice(0, visibleCount);
  const filterCount = Number(Boolean(type)) + Number(Boolean(ability)) + Number(Boolean(generation))
    + Number(Boolean(minimumBaseStatTotal)) + Number(Boolean(maximumBaseStatTotal));
  const hasMore = visible.length < results.length;
  const filterKey = `${query}\u0000${type}\u0000${generation}\u0000${minimumBaseStatTotal}\u0000${maximumBaseStatTotal}\u0000${sort}`;
  const previousFilterKey = useRef(filterKey);

  useEffect(() => {
    if (previousFilterKey.current !== filterKey) setVisibleCount(BATCH_SIZE);
    previousFilterKey.current = filterKey;
  }, [filterKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(results.length, current + BATCH_SIZE));
      }
    }, { rootMargin: "480px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, results.length]);

  useLayoutEffect(() => {
    const saved = restoreRef.current;
    if (!saved) return;
    setVisibleCount((current) => Math.min(results.length, Math.max(current, saved.visibleCount || BATCH_SIZE)));
    let secondFrame;
    let settleFrame;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, saved.scrollY || 0);
        settleFrame = window.requestAnimationFrame(() => {
          root.style.scrollBehavior = previousScrollBehavior;
          window.sessionStorage.removeItem(RESTORE_KEY);
          restoreRef.current = null;
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
    };
  }, [results.length]);

  function clearFilters() {
    setQuery("");
    setType("");
    setGeneration("");
    setMinimumBaseStatTotal("");
    setMaximumBaseStatTotal("");
    setSort("number");
    if (searchParams.size) setSearchParams({}, { replace: true });
  }

  function updateShortcuts(next) {
    setShortcuts(next);
    writeStoredResearchShortcuts(next);
  }

  function rememberPosition() {
    saveDexView({ query, type, generation, minimumBaseStatTotal, maximumBaseStatTotal, sort, visibleCount, scrollY: window.scrollY });
  }

  function rememberPokemonAndPosition(slug) {
    updateShortcuts(rememberPokemon(shortcuts, slug));
    rememberPosition();
  }

  const favoritePokemon = shortcuts.favoritePokemon.map((slug) => dexData.pokemon.find((pokemon) => pokemon.slug === slug)).filter(Boolean);
  const recentPokemon = shortcuts.recentPokemon.map((slug) => dexData.pokemon.find((pokemon) => pokemon.slug === slug)).filter(Boolean);

  return (
    <div className="page-wrap dex-page">
      <div className="page-heading-row">
        <div>
          <p className="page-label">PokéAPI · espécies e formas</p>
          <h1>Pokédex</h1>
          <p className="page-intro">Encontre uma espécie ou forma pelos tipos, nome ou número nacional.</p>
        </div>
        <Link className="button button-outline desktop-only" to="/builder">Levar ao construtor</Link>
      </div>

      <section className="dex-toolbar" aria-label="Busca, filtros e ordenação da Pokédex">
        <label className="search-field">
          <span className="search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.2 4.2" /></svg></span>
          <span className="sr-only">Buscar espécie, forma ou número</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Espécie ou forma"
          />
        </label>
        <label className="filter-field">
          <span>Tipo</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos os tipos</option>
            {dexData.types.map((entry) => <option value={entry} key={entry}>{typeLabel(entry)}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Geração</span>
          <select value={generation} onChange={(event) => setGeneration(event.target.value)}>
            <option value="">Todas</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((entry) => (
              <option value={entry} key={entry}>Geração {entry}</option>
            ))}
          </select>
        </label>
        <label className="filter-field dex-sort-field">
          <span>Ordenar por</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="number">Número</option>
            <option value="name">Nome A–Z</option>
            <option value="total-desc">Total base · maior</option>
            <option value="total-asc">Total base · menor</option>
          </select>
        </label>
        <details className="dex-stat-filter" open={Boolean(minimumBaseStatTotal || maximumBaseStatTotal)}>
          <summary>Filtrar por total base{minimumBaseStatTotal || maximumBaseStatTotal ? " · ativo" : ""}</summary>
          <div className="dex-stat-filter-fields">
            <label>
              <span>Mínimo</span>
              <input type="number" inputMode="numeric" min="0" max={MAX_BASE_STAT_TOTAL} step="1" value={minimumBaseStatTotal} onChange={(event) => setMinimumBaseStatTotal(event.target.value)} placeholder="0" />
            </label>
            <label>
              <span>Máximo</span>
              <input type="number" inputMode="numeric" min="0" max={MAX_BASE_STAT_TOTAL} step="1" value={maximumBaseStatTotal} onChange={(event) => setMaximumBaseStatTotal(event.target.value)} placeholder={String(MAX_BASE_STAT_TOTAL)} />
            </label>
            <p>Total dos seis stats base na PokéAPI; não representa stats finais no Champions.</p>
          </div>
        </details>
        {ability ? <button className="button button-quiet clear-filter" type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete("ability"); setSearchParams(next, { replace: true }); }}>Habilidade: {ability} ×</button> : null}
        {filterCount > 0 || query ? <button className="button button-quiet clear-filter" type="button" onClick={clearFilters}>Limpar filtros</button> : null}
      </section>

      {(favoritePokemon.length > 0 || recentPokemon.length > 0) && <section className="research-shortcuts" aria-label="Espécies favoritas e recentes">
        {favoritePokemon.length > 0 && <div><div className="research-shortcuts-heading"><h2>Favoritos</h2><button className="text-button" type="button" onClick={() => updateShortcuts({ ...shortcuts, favoritePokemon: [] })}>Limpar</button></div><ul>{favoritePokemon.map((pokemon) => <li key={pokemon.slug}><Link to={`/dex/${encodeURIComponent(pokemon.slug)}`} onClick={() => rememberPokemonAndPosition(pokemon.slug)}>{pokemon.name}</Link><button type="button" aria-label={`Remover ${pokemon.name} dos favoritos`} onClick={() => updateShortcuts(toggleFavoritePokemon(shortcuts, pokemon.slug))}>×</button></li>)}</ul></div>}
        {recentPokemon.length > 0 && <div><div className="research-shortcuts-heading"><h2>Recentes</h2><button className="text-button" type="button" onClick={() => updateShortcuts(clearRecentResearch(shortcuts, "pokemon"))}>Limpar</button></div><ul>{recentPokemon.slice(0, 6).map((pokemon) => <li key={pokemon.slug}><Link to={`/dex/${encodeURIComponent(pokemon.slug)}`} onClick={() => rememberPokemonAndPosition(pokemon.slug)}>{pokemon.name}</Link></li>)}</ul></div>}
      </section>}

      <div className="results-line">
        <p aria-live="polite"><strong>{results.length.toLocaleString("pt-BR")}</strong> formas{filterCount > 0 || query ? ` · ${filterCount + Number(Boolean(query))} filtro${filterCount + Number(Boolean(query)) > 1 ? "s" : ""}` : ""}</p>
        <p>{visible.length.toLocaleString("pt-BR")} de {results.length.toLocaleString("pt-BR")}</p>
      </div>

      {visible.length > 0 ? (
        <div className="pokemon-grid">
          {visible.map((pokemon) => <PokemonCard key={pokemon.slug} pokemon={pokemon} onOpen={() => rememberPokemonAndPosition(pokemon.slug)} isFavorite={shortcuts.favoritePokemon.includes(pokemon.slug)} onToggleFavorite={(slug) => updateShortcuts(toggleFavoritePokemon(shortcuts, slug))} />)}
        </div>
      ) : (
        <section className="empty-state-panel">
          <h2>Nenhum resultado por aqui.</h2>
          <p>Troque a busca ou remova um dos filtros.</p>
          <button className="button button-primary" type="button" onClick={clearFilters}>Limpar busca e filtros</button>
        </section>
      )}

      {hasMore ? (
        <div className="dex-list-status" aria-live="polite">
          <span>Mais Pokémon aparecem ao descer.</span>
          <button className="text-button" type="button" onClick={() => setVisibleCount((current) => Math.min(results.length, current + BATCH_SIZE))}>Carregar mais</button>
          <span className="dex-scroll-sentinel" ref={sentinelRef} aria-hidden="true" />
        </div>
      ) : results.length > 0 ? (
        <p className="dex-list-end" role="status">Fim da lista · {results.length.toLocaleString("pt-BR")} entradas</p>
      ) : null}
    </div>
  );
}
