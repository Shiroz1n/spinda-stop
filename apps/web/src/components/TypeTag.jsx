import { typeIconUrl } from "../data/pokemonSprites.js";

const TYPE_LABELS = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Veneno",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  stellar: "Estelar",
  fairy: "Fada",
  unknown: "Desconhecido",
  shadow: "Sombra",
};

export function typeLabel(type) {
  const key = typeof type === "string" ? type.toLowerCase() : type;
  return TYPE_LABELS[key] ?? type;
}

export function TypeTag({ type }) {
  const key = typeof type === "string" ? type.toLowerCase() : "unknown";
  const icon = typeIconUrl(key);
  return (
    <span className={`type-tag type-${key}`}>
      {icon ? <img src={icon} alt="" aria-hidden="true" width="18" height="18" loading="lazy" decoding="async" /> : null}
      <span>{typeLabel(type)}</span>
    </span>
  );
}

