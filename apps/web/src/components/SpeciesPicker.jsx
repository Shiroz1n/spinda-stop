import { useEffect, useMemo, useRef, useState } from "react";
import { searchPokemon } from "@spinda-stop/domain";
import { usageProviders } from "../data/usage/registry.js";
import { getChampionsIndexedPokemon } from "../data/pokemonChampionsRoster.js";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { TypeTag } from "./TypeTag.jsx";

export function SpeciesPicker({ open, pokemon, onChoose, onClose, idPrefix = "species" }) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState("champions");
  const [roster, setRoster] = useState({ status: "idle", pokemon: [] });
  const activePokemon = catalog === "champions" ? roster.pokemon : pokemon;
  const filtered = useMemo(() => searchPokemon(activePokemon, query).slice(0, 16), [activePokemon, query]);

  useEffect(() => {
    if (!open || roster.status !== "idle") return undefined;
    let active = true;
    usageProviders["pokemon-champions-battle-data"].loadIndex()
      .then((index) => { if (active) setRoster({ status: "ready", pokemon: getChampionsIndexedPokemon(index, pokemon) }); })
      .catch(() => { if (active) setRoster({ status: "error", pokemon: [] }); });
    return () => { active = false; };
  }, [open, pokemon, roster.status]);

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
      aria-labelledby={`${idPrefix}-dialog-title`}
      onCancel={(event) => { event.preventDefault(); closePicker(); }}
      onClick={(event) => { if (event.target === dialogRef.current) closePicker(); }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <p className="page-label">{catalog === "champions" ? "Pokémon Champions" : "Pokédex geral"}</p>
            <h2 id={`${idPrefix}-dialog-title`}>Escolha uma espécie</h2>
          </div>
          <button className="icon-button" type="button" onClick={closePicker} aria-label="Fechar seletor">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="picker-catalog-switch" role="group" aria-label="Catálogo de Pokémon">
          <button type="button" aria-pressed={catalog === "champions"} onClick={() => setCatalog("champions")}>Champions</button>
          <button type="button" aria-pressed={catalog === "general"} onClick={() => setCatalog("general")}>Pokédex geral</button>
        </div>
        <label className="field-label" htmlFor={`${idPrefix}-search`}>Nome ou número</label>
        <input
          ref={searchRef}
          id={`${idPrefix}-search`}
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: Garchomp ou 445"
          autoComplete="off"
        />
        {catalog === "champions" && <p className="form-hint">Índice atual de Doubles; não confirma legalidade no regulamento.</p>}
        <div className="picker-results" aria-live="polite">
          {catalog === "champions" && roster.status === "idle" && open && <p className="empty-state" role="status">Carregando o índice de Doubles…</p>}
          {catalog === "champions" && roster.status === "error" && <p className="empty-state" role="status">Índice de Champions indisponível. <button type="button" onClick={() => setRoster({ status: "idle", pokemon: [] })}>Tentar novamente</button> ou escolha a Pokédex geral.</p>}
          {filtered.map((entry) => (
            <button
              className="picker-result"
              type="button"
              key={entry.slug}
              onClick={() => { setQuery(""); onChoose(entry); }}
            >
              <span className="picker-sprite-well"><PokemonSprite pokemon={entry} name={entry.name} size={48} decorative /></span>
              <span className="picker-identity">
                <span className="dex-number">#{String(entry.speciesId).padStart(4, "0")}</span>
                <span className="picker-name">{entry.name}</span>
              </span>
              <span className="type-list">
                {entry.types.map((type) => <TypeTag key={type} type={type} />)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (catalog === "general" || roster.status === "ready") && <p className="empty-state">{catalog === "champions" ? "Nenhum resultado no índice atual de Doubles." : "Nenhum resultado. Tente outro nome ou número."}</p>}
        </div>
        {query.trim() && filtered.length === 16 && <p className="form-hint">Mostrando 16 resultados. Refine a busca para ver a forma desejada.</p>}
      </div>
    </dialog>
  );
}
