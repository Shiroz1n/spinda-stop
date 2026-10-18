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
  return TYPE_LABELS[type] ?? type;
}

export function TypeTag({ type }) {
  return <span className={`type-tag type-${type}`}>{typeLabel(type)}</span>;
}
