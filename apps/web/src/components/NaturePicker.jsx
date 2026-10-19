import { useEffect, useRef, useState } from "react";
import { getNature, getNatureEffectSummary, NATURES } from "../data/natures.js";

export function NaturePicker({ id, label = "Nature", value, onChange, className = "" }) {
  const detailsRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState(null);
  const selected = getNature(value) || getNature("Serious");
  const unknownValue = Boolean(value && !getNature(value));
  const optionsId = `${id}-options`;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const keepPopupInViewport = className.includes("builder-target-nature") || className.includes("speed-nature-target");

  function closePicker() {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
    setPopupStyle(null);
    detailsRef.current?.querySelector("summary")?.focus();
  }

  function handleToggle(event) {
    const isOpen = event.currentTarget.open;
    setOpen(isOpen);
    if (!isOpen || !keepPopupInViewport || window.innerWidth > 420) {
      setPopupStyle(null);
      return;
    }

    const trigger = event.currentTarget.querySelector("summary");
    const bounds = trigger?.getBoundingClientRect();
    if (!bounds) return;

    const gutter = 10;
    const width = Math.min(620, window.innerWidth - gutter * 2);
    const maxHeight = Math.min(420, window.innerHeight * 0.58);
    const left = Math.max(gutter, Math.min(bounds.right - width, window.innerWidth - width - gutter));
    const below = bounds.bottom + 5;
    const top = below + maxHeight <= window.innerHeight - gutter
      ? below
      : Math.max(gutter, bounds.top - maxHeight - 5);
    setPopupStyle({ position: "fixed", left: `${left}px`, top: `${top}px`, width: `${width}px` });
  }

  useEffect(() => {
    if (!open) return undefined;
    function dismissOutside(event) {
      if (detailsRef.current && !detailsRef.current.contains(event.target)) {
        if (detailsRef.current) detailsRef.current.open = false;
        setOpen(false);
        setPopupStyle(null);
      }
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [open]);

  function choose(nature) {
    onChange(nature.name);
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
    setPopupStyle(null);
    window.requestAnimationFrame(() => detailsRef.current?.querySelector("summary")?.focus());
  }

  return (
    <div className={`nature-picker${className ? ` ${className}` : ""}`}>
      <span id={labelId} className="nature-picker-label">{label}</span>
      <details ref={detailsRef} className="nature-picker-details" onToggle={handleToggle} onKeyDown={(event) => {
        if (event.key === "Escape" && detailsRef.current?.open) {
          event.preventDefault();
          closePicker();
        }
      }}>
        <summary
          id={id}
          className="nature-picker-trigger"
          aria-controls={optionsId}
          aria-expanded={open}
          aria-labelledby={`${labelId} ${valueId}`}
        >
          <span id={valueId}><strong>{selected?.name || value || "Serious"}</strong><small>{getNatureEffectSummary(value || "Serious")}</small></span>
          <span className="nature-picker-caret" aria-hidden="true">{open ? "−" : "+"}</span>
        </summary>
        <div id={optionsId} className="nature-picker-options" style={popupStyle || undefined} role="group" aria-label={`Natures disponíveis para ${label}`}>
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
