import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
    if (!isOpen || !keepPopupInViewport) setPopupStyle(null);
  }

  useLayoutEffect(() => {
    if (!open || !keepPopupInViewport) return undefined;

    let frame = 0;
    const positionPopup = () => {
      const details = detailsRef.current;
      const bounds = details?.querySelector("summary")?.getBoundingClientRect();
      if (!bounds || !details?.open) return;

      const gutter = 10;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.max(1, Math.min(620, viewportWidth - gutter * 2));
      const maxHeight = Math.max(80, Math.min(420, viewportHeight - gutter * 2));
      const belowSpace = Math.max(0, viewportHeight - bounds.bottom - gutter - 5);
      const aboveSpace = Math.max(0, bounds.top - gutter - 5);
      const openBelow = belowSpace >= Math.min(240, maxHeight) || belowSpace >= aboveSpace;
      const availableHeight = openBelow ? belowSpace : aboveSpace;
      const height = Math.max(80, Math.min(maxHeight, availableHeight));
      const left = Math.max(gutter, Math.min(bounds.left, viewportWidth - width - gutter));
      const top = openBelow ? bounds.bottom + 5 : Math.max(gutter, bounds.top - height - 5);

      setPopupStyle({
        position: "fixed",
        left: `${left}px`,
        right: "auto",
        top: `${top}px`,
        bottom: "auto",
        width: `${width}px`,
        maxHeight: `${height}px`,
        boxSizing: "border-box",
      });
    };
    const schedulePosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(positionPopup);
    };

    positionPopup();
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
    };
  }, [keepPopupInViewport, open]);

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
