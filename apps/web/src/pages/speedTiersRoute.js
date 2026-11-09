const MODELS = new Set(["champions", "standard"]);
const SORTS = new Set(["fastest", "slowest"]);
const NATURES = new Set(["Adamant", "Bashful", "Bold", "Brave", "Calm", "Careful", "Docile", "Gentle", "Hardy", "Hasty", "Impish", "Jolly", "Lax", "Lonely", "Mild", "Modest", "Naive", "Naughty", "Quiet", "Quirky", "Rash", "Relaxed", "Sassy", "Serious", "Timid"]);

function numberParam(params, key, fallback, maximum) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? Math.min(maximum, Math.max(0, value)) : fallback;
}

function natureParam(params, key) {
  const value = params.get(key);
  return NATURES.has(value) ? value : "Serious";
}

function booleanParam(params, key) {
  return params.get(key) === "1";
}

function defaultRegulation(availableRegulations) {
  if (availableRegulations.includes("M-C")) return "M-C";
  return availableRegulations[0] || "";
}

export function parseSpeedTiersRoute(search, { availableRegulations = [], pokemonSlugs = [] } = {}) {
  const params = new URLSearchParams(search);
  const requestedRegulation = params.get("regulation");
  const requestedTarget = params.get("target") || "";

  return {
    model: MODELS.has(params.get("model")) ? params.get("model") : "champions",
    regulation: availableRegulations.includes(requestedRegulation)
      ? requestedRegulation
      : defaultRegulation(availableRegulations),
    includeMegas: params.get("megas") !== "0",
    sort: SORTS.has(params.get("sort")) ? params.get("sort") : "fastest",
    targetSlug: pokemonSlugs.includes(requestedTarget) ? requestedTarget : "",
    targetQuery: requestedTarget ? "" : (params.get("q") || ""),
    candidate: {
      nature: natureParam(params, "cn"),
      sp: numberParam(params, "cs", 0, 32),
      level: Math.max(1, Math.min(100, numberParam(params, "lv", 50, 100))),
      iv: numberParam(params, "ci", 31, 31),
      ev: numberParam(params, "ce", 0, 252),
      tailwind: booleanParam(params, "cw"),
      choiceScarf: booleanParam(params, "cc"),
    },
    target: {
      nature: natureParam(params, "tn"),
      sp: numberParam(params, "ts", 0, 32),
      level: Math.max(1, Math.min(100, numberParam(params, "lv", 50, 100))),
      iv: numberParam(params, "ti", 31, 31),
      ev: numberParam(params, "te", 0, 252),
      tailwind: booleanParam(params, "tw"),
      choiceScarf: booleanParam(params, "tc"),
    },
    trickRoom: booleanParam(params, "tr"),
  };
}

export function serializeSpeedTiersRoute(settings, availableRegulations = []) {
  const params = new URLSearchParams();
  params.set("model", MODELS.has(settings.model) ? settings.model : "champions");
  if (availableRegulations.includes(settings.regulation)) params.set("regulation", settings.regulation);
  params.set("megas", settings.includeMegas === false ? "0" : "1");
  params.set("sort", SORTS.has(settings.sort) ? settings.sort : "fastest");

  const candidate = settings.candidate || {};
  const target = settings.target || {};
  params.set("cn", NATURES.has(candidate.nature) ? candidate.nature : "Serious");
  params.set("cs", String(Math.min(32, Math.max(0, Number(candidate.sp) || 0))));
  params.set("lv", String(Math.min(100, Math.max(1, Number(candidate.level) || 50))));
  params.set("ci", String(Math.min(31, Math.max(0, Number(candidate.iv ?? 31) || 0))));
  params.set("ce", String(Math.min(252, Math.max(0, Number(candidate.ev) || 0))));
  params.set("cw", candidate.tailwind ? "1" : "0");
  params.set("cc", candidate.choiceScarf ? "1" : "0");
  params.set("tn", NATURES.has(target.nature) ? target.nature : "Serious");
  params.set("ts", String(Math.min(32, Math.max(0, Number(target.sp) || 0))));
  params.set("ti", String(Math.min(31, Math.max(0, Number(target.iv ?? 31) || 0))));
  params.set("te", String(Math.min(252, Math.max(0, Number(target.ev) || 0))));
  params.set("tw", target.tailwind ? "1" : "0");
  params.set("tc", target.choiceScarf ? "1" : "0");
  params.set("tr", settings.trickRoom ? "1" : "0");

  if (settings.targetSlug) params.set("target", settings.targetSlug);
  else if (settings.targetQuery?.trim()) params.set("q", settings.targetQuery.trim());

  return params.toString();
}
