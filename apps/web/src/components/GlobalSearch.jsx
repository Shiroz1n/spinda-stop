import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import moveData from "@spinda-stop/data/moves";
import { typeLabel } from "./TypeTag.jsx";
import { createGlobalSearchEntries, nextGlobalSearchIndex, searchGlobalEntries } from "./globalSearch.js";

const entries = createGlobalSearchEntries({
  pokemon: dexData.pokemon,
  types: dexData.types.map((value) => ({ value, label: typeLabel(value) })),
  moves: moveData.moves,
  details: detailData,
});

export function GlobalSearch({ open, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchGlobalEntries(entries, query), [query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function choose(entry) {
    if (!entry) return;
    dialogRef.current?.close();
    onClose();
    navigate(entry.href);
  }

  function onInputKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => nextGlobalSearchIndex(current, event.key, results.length));
    } else if (event.key === "Enter" && results.length) {
      event.preventDefault();
      choose(results[activeIndex] || results[0]);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="global-search-dialog"
      aria-labelledby="global-search-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
    >
      <div className="global-search-content">
        <div className="global-search-heading">
          <div><p className="page-label">Busca no Spinda Stop</p><h2 id="global-search-title">Encontrar conteúdo</h2></div>
          <button className="icon-button" type="button" aria-label="Fechar busca" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <label className="search-field global-search-field">
          <span className="sr-only">Buscar Pokémon, tipo, golpe ou habilidade</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Nome, forma, número, tipo, golpe ou habilidade"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={results[activeIndex] ? `global-search-result-${activeIndex}` : undefined}
            autoComplete="off"
          />
        </label>
        <div id="global-search-results" className="global-search-results" role="listbox" aria-label="Resultados da busca" aria-live="polite">
          {results.map((entry, index) => (
            <button
              id={`global-search-result-${index}`}
              key={`${entry.kind}-${entry.name}-${entry.href}`}
              className={`global-search-result${index === activeIndex ? " is-active" : ""}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(entry)}
            >
              <span><strong>{entry.name}</strong><small>{entry.detail}</small></span><b>{entry.kind}</b>
            </button>
          ))}
          {query && results.length === 0 ? <p className="empty-state" role="status">Nenhum resultado no catálogo disponível.</p> : null}
          {!query ? <p className="global-search-hint">Busque em espécies e formas, catálogo de golpes, tipos e habilidades gerais.</p> : null}
        </div>
        <p className="global-search-footnote">Os catálogos gerais não confirmam disponibilidade ou legalidade em Pokémon Champions.</p>
      </div>
    </dialog>
  );
}
