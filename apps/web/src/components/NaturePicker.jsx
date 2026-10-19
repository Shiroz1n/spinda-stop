import { useRef, useState } from "react";
import { getNature, getNatureEffectSummary, NATURES } from "../data/natures.js";

export function NaturePicker({ id, label = "Nature", value, onChange, className = "" }) {
  const detailsRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = getNature(value) || getNature("Serious");
  const unknownValue = Boolean(value && !getNature(value));
  const optionsId = `${id}-options`;

  function choose(nature) {
    onChange(nature.name);
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
    window.requestAnimationFrame(() => detailsRef.current?.querySelector("summary")?.focus());
  }

  return (
    <div className={`nature-picker${className ? ` ${className}` : ""}`}>
      <span className="nature-picker-label">{label}</span>
      <details ref={detailsRef} className="nature-picker-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary
          id={id}
          className="nature-picker-trigger"
          aria-controls={optionsId}
          aria-expanded={open}
          aria-label={`${label}: ${selected?.name || value || "Serious"}, ${getNatureEffectSummary(value || "Serious")}`}
        >
          <span><strong>{selected?.name || value || "Serious"}</strong><small>{getNatureEffectSummary(value || "Serious")}</small></span>
          <span className="nature-picker-caret" aria-hidden="true">{open ? "−" : "+"}</span>
        </summary>
        <div id={optionsId} className="nature-picker-options" role="group" aria-label={`Natures disponíveis para ${label}`} onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (detailsRef.current) detailsRef.current.open = false;
            setOpen(false);
            detailsRef.current?.querySelector("summary")?.focus();
          }
        }}>
          <p className="nature-picker-help">Escolha o efeito aplicado ao set. HP não recebe modificador.</p>
          {NATURES.map((nature) => (
            <button
              key={nature.slug}
              type="button"
              className="nature-picker-option"
              aria-pressed={selected?.slug === nature.slug && !unknownValue}
              onClick={() => choose(nature)}
            >
              <strong>{nature.name}</strong>
              <span>{nature.effects}</span>
              {selected?.slug === nature.slug && !unknownValue ? <span className="nature-picker-current">Atual</span> : null}
            </button>
          ))}
        </div>
      </details>
      {unknownValue ? <small className="nature-picker-warning" role="status">“{value}” não está no catálogo; escolha uma Nature conhecida para calcular.</small> : null}
    </div>
  );
}
