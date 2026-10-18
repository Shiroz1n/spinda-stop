import { useMemo, useState } from "react";
import { Link } from "react-router";
import { searchPokemon } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonCard } from "../components/PokemonCard.jsx";
import { typeLabel } from "../components/TypeTag.jsx";

const PAGE_SIZE = 36;

export function DexPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [generation, setGeneration] = useState("");
  const [page, setPage] = useState(1);
  const results = useMemo(
    () => searchPokemon(dexData.pokemon, query, { type, generation }),
    [query, type, generation],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filterCount = Number(Boolean(type)) + Number(Boolean(generation));

  function clearFilters() {
    setQuery("");
    setType("");
    setGeneration("");
    setPage(1);
  }

  function updateQuery(value) {
    setQuery(value);
    setPage(1);
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
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Buscar por nome, forma ou número"
          />
        </label>
        <label className="filter-field">
          <span>Tipo</span>
          <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
            <option value="">Todos os tipos</option>
            {dexData.types.map((entry) => <option value={entry} key={entry}>{typeLabel(entry)}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Geração</span>
          <select value={generation} onChange={(event) => { setGeneration(event.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((entry) => (
              <option value={entry} key={entry}>Geração {entry}</option>
            ))}
          </select>
        </label>
        {filterCount > 0 && <button className="button button-quiet clear-filter" type="button" onClick={clearFilters}>Limpar filtros</button>}
      </section>

      <div className="results-line">
        <p aria-live="polite"><strong>{results.length.toLocaleString("pt-BR")}</strong> entradas{filterCount > 0 ? ` · ${filterCount} filtro${filterCount > 1 ? "s" : ""}` : ""}</p>
        {query || filterCount ? <p>Filtros ativos</p> : <p>Catálogo completo</p>}
      </div>

      {visible.length > 0 ? (
        <div className="pokemon-grid">
          {visible.map((pokemon) => <PokemonCard key={pokemon.slug} pokemon={pokemon} />)}
        </div>
      ) : (
        <section className="empty-state-panel">
          <h2>Nenhum resultado por aqui.</h2>
          <p>Troque a busca ou remova um dos filtros.</p>
          <button className="button button-primary" type="button" onClick={clearFilters}>Limpar busca e filtros</button>
        </section>
      )}

      {results.length > PAGE_SIZE && (
        <nav className="pagination" aria-label="Paginação do catálogo">
          <button className="button button-outline" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Anterior</button>
          <span>Página <b>{currentPage}</b> de <b>{pageCount}</b></span>
          <button className="button button-outline" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}>Próxima</button>
        </nav>
      )}
    </div>
  );
}
