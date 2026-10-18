import { useEffect, useMemo, useRef, useState } from "react";
import { searchPokemon } from "@spinda-stop/domain";
import { TypeTag } from "./TypeTag.jsx";

export function SpeciesPicker({ open, pokemon, onChoose, onClose }) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => searchPokemon(pokemon, query).slice(0, 16), [pokemon, query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) {
      const focusFrame = requestAnimationFrame(() => searchRef.current?.focus());
      return () => {
        cancelAnimationFrame(focusFrame);
        if (dialog.open) dialog.close();
      };
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function closePicker() {
    setQuery("");
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="species-dialog"
      aria-labelledby="species-dialog-title"
      onCancel={(event) => { event.preventDefault(); closePicker(); }}
      onClick={(event) => { if (event.target === dialogRef.current) closePicker(); }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <p className="page-label">Catálogo geral</p>
            <h2 id="species-dialog-title">Escolha uma espécie</h2>
          </div>
          <button className="icon-button" type="button" onClick={closePicker} aria-label="Fechar seletor">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <label className="field-label" htmlFor="species-search">Nome ou número</label>
        <input
          ref={searchRef}
          id="species-search"
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: Garchomp ou 445"
          autoComplete="off"
        />
        <p className="form-hint">Os resultados vêm do catálogo geral. Disponibilidade no Champions não está confirmada.</p>
        <div className="picker-results" aria-live="polite">
          {filtered.map((entry) => (
            <button
              className="picker-result"
              type="button"
              key={entry.slug}
              onClick={() => { setQuery(""); onChoose(entry); }}
            >
              <span className="dex-number">#{String(entry.speciesId).padStart(4, "0")}</span>
              <span className="picker-name">{entry.name}</span>
              <span className="type-list">
                {entry.types.map((type) => <TypeTag key={type} type={type} />)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="empty-state">Nenhum resultado. Tente outro nome ou número.</p>}
        </div>
        {query.trim() && filtered.length === 16 && <p className="form-hint">Mostrando 16 resultados. Refine a busca para ver a forma desejada.</p>}
      </div>
    </dialog>
  );
}
