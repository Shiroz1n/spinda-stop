export const megaEvolutionBattle = Object.freeze({
  name: "Mega Evolution Battle",
  sourceUrl: "https://news.pokemon-home.com/en/page/852.html",
  sourceCheckedAt: "2026-11-07",
  entryStartsAt: "2026-11-06T02:00:00Z",
  startsAt: "2026-11-13T02:00:00Z",
  endsAt: "2026-11-16T01:59:00Z",
  format: "Duplas",
  restrictions: ["Apenas Pokémon capazes de Mega Evoluir", "Uma Mega Evolução por batalha", "Sem itens repetidos", "20 minutos por batalha"],
});

export const rankedRegulation = Object.freeze({
  season: "M-8",
  ruleset: "Regulation M-C",
  startsAt: "2026-11-04T02:00:00Z",
  endsAt: "2026-12-02T01:59:00Z",
  checkedAt: "2026-11-06",
  sourceUrl: "https://champions-news.pokemon-home.com/en/page/867.html",
});

export function getRankedRegulationPhase(now = Date.now()) {
  if (now < Date.parse(rankedRegulation.startsAt)) return "upcoming";
  if (now < Date.parse(rankedRegulation.endsAt)) return "current";
  return "ended";
}

export function getCompetitionPhase(now = Date.now()) {
  if (now < Date.parse(megaEvolutionBattle.entryStartsAt)) return "upcoming";
  if (now < Date.parse(megaEvolutionBattle.startsAt)) return "registration-open";
  if (now < Date.parse(megaEvolutionBattle.endsAt)) return "in-progress";
  return "ended";
}
