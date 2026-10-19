import natureCatalog from "@spinda-stop/data/natures" with { type: "json" };

const statLabels = Object.freeze({
  atk: "Ataque",
  def: "Defesa",
  spa: "Ataque Especial",
  spd: "Defesa Especial",
  spe: "Velocidade",
});

// The 20 raised/lowered combinations and five neutral natures are defined once
// here so every editor and speed model uses the same canonical effects.
const natureModifiers = Object.freeze({
  adamant: ["atk", "spa"],
  bashful: [null, null],
  bold: ["def", "atk"],
  brave: ["atk", "spe"],
  calm: ["spd", "atk"],
  careful: ["spd", "spa"],
  docile: [null, null],
  gentle: ["spd", "def"],
  hardy: [null, null],
  hasty: ["spe", "def"],
  impish: ["def", "spa"],
  jolly: ["spe", "spa"],
  lax: ["def", "spd"],
  lonely: ["atk", "def"],
  mild: ["spa", "def"],
  modest: ["spa", "atk"],
  naive: ["spe", "spd"],
  naughty: ["atk", "spd"],
  quiet: ["spa", "spe"],
  quirky: [null, null],
  rash: ["spa", "spd"],
  relaxed: ["def", "spe"],
  sassy: ["spd", "spe"],
  serious: [null, null],
  timid: ["spe", "atk"],
});

export const NATURES = Object.freeze(natureCatalog.natures.map(({ slug, name }) => {
  const [raised, lowered] = natureModifiers[slug] || [null, null];
  const effects = raised && lowered
    ? `${statLabels[raised]} ↑ · ${statLabels[lowered]} ↓`
    : "Sem alteração";
  return Object.freeze({ slug, name, raised, lowered, effects });
}));

const natureById = new Map(NATURES.map((nature) => [nature.slug, nature]));

export function getNature(value) {
  const key = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return natureById.get(key) || null;
}

export function getNatureMultiplier(value, stat) {
  if (stat === "hp") return 1;
  const nature = getNature(value);
  if (!nature) return 1;
  if (nature.raised === stat) return 1.1;
  if (nature.lowered === stat) return 0.9;
  return 1;
}

export function getNatureForStat(stat, direction = "up") {
  return NATURES.find((nature) => nature[direction === "down" ? "lowered" : "raised"] === stat) || NATURES.find((nature) => !nature.raised) || null;
}

export function getNatureEffectSummary(value) {
  return getNature(value)?.effects || "Nature não catalogada";
}

export function getNatureSpeedClass(value) {
  const multiplier = getNatureMultiplier(value, "spe");
  return multiplier > 1 ? "favorable" : multiplier < 1 ? "unfavorable" : "neutral";
}
