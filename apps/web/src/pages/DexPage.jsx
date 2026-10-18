import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { searchPokemon } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonCard } from "../components/PokemonCard.jsx";
import { typeLabel } from "../components/TypeTag.jsx";

const BATCH_SIZE = 36;
const RESTORE_KEY = "spinda-dex-view";
const RESTORE_TTL = 15 * 60 * 1000;

function readSavedView() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RESTORE_KEY) || "null");
    return saved && Date.now() - saved.savedAt < RESTORE_TTL ? saved : null;
  } catch {
    return null;
  }
}

export function DexPage() {
  const [initialView] = useState(readSavedView);
  const restoreRef = useRef(initialView);
  const [query, setQuery] = useState(() => initialView?.query || "");
  const [type, setType] = useState(() => initialView?.type || "");
  const [generation, setGeneration] = useState(() => initialView?.generation || "");
  const [visibleCount, setVisibleCount] = useState(() => Math.max(BATCH_SIZE, initialView?.visibleCount || BATCH_SIZE));
  const sentinelRef = useRef(null);
  const results = useMemo(
    () => searchPokemon(dexData.pokemon, query, { type, generation }),
    [query, type, generation],
  );
  const visible = results.slice(0, visibleCount);
  const filterCount = Number(Boolean(type)) + Number(Boolean(generation));
  const hasMore = visible.length < results.length;
  const filterKey = `${query}\u0000${type}\u0000${generation}`;
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
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY || 0, behavior: "instant" });
      window.sessionStorage.removeItem(RESTORE_KEY);
      restoreRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [results.length]);

  function clearFilters() {
    setQuery("");
    setType("");
    setGeneration("");
  }

  function rememberPosition() {
    try {
      window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify({
        query,
        type,
        generation,
        visibleCount,
        scrollY: window.scrollY,
        savedAt: Date.now(),
      }));
    } catch {
      // Navigation remains available when session storage is disabled.
    }
  }

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

      <section className="dex-toolbar" aria-label="Busca e filtros da Pokédex">
        <label className="search-field">
          <span className="search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.2 4.2" /></svg></span>
          <span className="sr-only">Buscar espécie, forma ou número</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, forma ou número"
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
        {filterCount > 0 || query ? <button className="button button-quiet clear-filter" type="button" onClick={clearFilters}>Limpar filtros</button> : null}
      </section>

      <div className="results-line">
        <p aria-live="polite"><strong>{results.length.toLocaleString("pt-BR")}</strong> entradas{filterCount > 0 ? ` · ${filterCount} filtro${filterCount > 1 ? "s" : ""}` : ""}</p>
        <p>{visible.length.toLocaleString("pt-BR")} de {results.length.toLocaleString("pt-BR")}</p>
      </div>

      {visible.length > 0 ? (
        <div className="pokemon-grid">
          {visible.map((pokemon) => <PokemonCard key={pokemon.slug} pokemon={pokemon} onOpen={rememberPosition} />)}
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
