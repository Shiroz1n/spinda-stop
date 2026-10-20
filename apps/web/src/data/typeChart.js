import typeEffectivenessChart from "./typeChart.json" with { type: "json" };

export { typeEffectivenessChart };

export function getDefensiveTypeEffectiveness(attackType, defenderTypes) {
  const attack = String(attackType || "").toLocaleLowerCase("en");
  const chartRow = typeEffectivenessChart[attack];
  if (!chartRow) return null;

  const defense = defenderTypes.map((type) => String(type || "").toLocaleLowerCase("en"));
  if (defense.some((type) => !Object.hasOwn(chartRow, type))) return null;
  return defense.reduce((multiplier, type) => multiplier * chartRow[type], 1);
}
