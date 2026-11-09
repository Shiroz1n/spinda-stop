import { useEffect, useMemo, useRef, useState } from "react";
import { searchPokemon } from "@spinda-stop/domain";
import { getChampionsEligiblePokemon, getChampionsRosterSummary, getOfficialPokemonAliases } from "../data/pokemonChampionsRoster.js";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { TypeTag } from "./TypeTag.jsx";
import { nextSpeciesPickerIndex } from "./speciesPickerKeyboard.js";

export function SpeciesPicker({ open, pokemon, onChoose, onClose, idPrefix = "species" }) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState("champions");
  const roster = useMemo(() => getOfficialPokemonAliases(getChampionsEligiblePokemon(pokemon, "M-C")), [pokemon]);
  const rosterSummary = getChampionsRosterSummary("M-C");
  const activePokemon = catalog === "champions" ? roster : pokemon;
  const filtered = useMemo(() => searchPokemon(activePokemon, query).slice(0, 16), [activePokemon, query]);

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

  function handleResultNavigation(event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const resultButtons = [...(resultsRef.current?.querySelectorAll(".picker-result") || [])];
    if (!resultButtons.length) return;

    const currentIndex = resultButtons.indexOf(document.activeElement);
    const isSearch = document.activeElement === searchRef.current;
    if (!isSearch && currentIndex < 0) return;

    event.preventDefault();
    const nextIndex = nextSpeciesPickerIndex(currentIndex, event.key, resultButtons.length);
    resultButtons[nextIndex]?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className="species-dialog"
      aria-labelledby={`${idPrefix}-dialog-title`}
      onCancel={(event) => { event.preventDefault(); closePicker(); }}
      onClick={(event) => { if (event.target === dialogRef.current) closePicker(); }}
      onKeyDown={handleResultNavigation}
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
        {catalog === "champions" && <p className="form-hint">Elenco M-C · {rosterSummary?.checkedAt ? `consultado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(rosterSummary.checkedAt))}` : "consulta sem data"}.</p>}
        <div ref={resultsRef} className="picker-results" aria-live="polite">
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
          {filtered.length === 0 && <p className="empty-state">{catalog === "champions" ? "Nenhum resultado confirmado no elenco M-C." : "Nenhum resultado. Tente outro nome ou número."}</p>}
        </div>
        {query.trim() && filtered.length === 16 && <p className="form-hint">Mostrando 16 resultados. Refine a busca para ver a forma desejada.</p>}
      </div>
    </dialog>
  );
}
