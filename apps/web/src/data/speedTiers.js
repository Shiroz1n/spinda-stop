const NATURE_FACTOR = Object.freeze({
  favorable: 1.1,
  neutral: 1,
  unfavorable: 0.9,
});

const SPEED_UP_NATURES = new Set(["timid", "jolly", "hasty", "naive"]);
const SPEED_DOWN_NATURES = new Set(["brave", "relaxed", "quiet", "sassy"]);

export const CHAMPIONS_MAX_STAT_POINTS = 32;
export const CHAMPIONS_MAX_TOTAL_POINTS = 66;
const CHAMPIONS_STAT_KEYS = Object.freeze(["hp", "atk", "def", "spa", "spd", "spe"]);

function toNatureId(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeNature(value) {
  if (Object.hasOwn(NATURE_FACTOR, value)) return value;
  const nature = toNatureId(value);
  if (SPEED_UP_NATURES.has(nature)) return "favorable";
  if (SPEED_DOWN_NATURES.has(nature)) return "unfavorable";
  return "neutral";
}

function readInteger(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} precisa ficar entre ${min} e ${max}.`);
  }
  return number;
}

function natureFactor(value) {
  return NATURE_FACTOR[normalizeNature(value)];
}

export function calculateChampionsSpeed(baseSpeed, statPoints = 0, nature = "neutral") {
  const base = readInteger(baseSpeed, "Speed base", 1, 999);
  const points = readInteger(statPoints, "SP de Speed", 0, CHAMPIONS_MAX_STAT_POINTS);
  return Math.floor((base + points + 20) * natureFactor(nature));
}

export function calculateStandardSpeed({ baseSpeed, level = 50, iv = 31, ev = 0, nature = "neutral" }) {
  const base = readInteger(baseSpeed, "Speed base", 1, 999);
  const selectedLevel = readInteger(level, "Nível", 1, 100);
  const selectedIv = readInteger(iv, "IV", 0, 31);
  const selectedEv = readInteger(ev, "EV de Speed", 0, 252);
  const unmodified = Math.floor(((2 * base + selectedIv + Math.floor(selectedEv / 4)) * selectedLevel) / 100) + 5;
  return Math.floor(unmodified * natureFactor(nature));
}

export function compareSpeed(value, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return "unknown";
  if (value > target) return "faster";
  if (value < target) return "slower";
  return "tie";
}

export function validateChampionsStatPoints(statPoints) {
  if (!statPoints || typeof statPoints !== "object" || CHAMPIONS_STAT_KEYS.some((key) => !Number.isInteger(statPoints[key]) || statPoints[key] < 0)) {
    return { valid: false, total: null, remaining: null, error: "A distribuição de SP precisa conter seis valores inteiros não negativos." };
  }

  const overLimit = CHAMPIONS_STAT_KEYS.filter((key) => statPoints[key] > CHAMPIONS_MAX_STAT_POINTS);
  const total = CHAMPIONS_STAT_KEYS.reduce((sum, key) => sum + statPoints[key], 0);
  const reasons = [];
  if (overLimit.length > 0) reasons.push("Cada atributo aceita no máximo 32 SP.");
  if (total > CHAMPIONS_MAX_TOTAL_POINTS) reasons.push("O set passa do orçamento total de 66 SP.");
  return { valid: reasons.length === 0, total, remaining: CHAMPIONS_MAX_TOTAL_POINTS - total, error: reasons.join(" ") };
}

export function maximumLegalSpeedPoints(statPoints) {
  if (!statPoints || typeof statPoints !== "object") return 0;
  const otherKeys = CHAMPIONS_STAT_KEYS.filter((key) => key !== "spe");
  if (otherKeys.some((key) => !Number.isInteger(statPoints[key]) || statPoints[key] < 0 || statPoints[key] > CHAMPIONS_MAX_STAT_POINTS)) return 0;
  const pointsSpentElsewhere = otherKeys.reduce((sum, key) => sum + statPoints[key], 0);
  return Math.max(0, Math.min(CHAMPIONS_MAX_STAT_POINTS, CHAMPIONS_MAX_TOTAL_POINTS - pointsSpentElsewhere));
}

export function applySpeedPointsToStatSpread(statPoints, speedPoints) {
  let selectedSpeedPoints;
  try {
    selectedSpeedPoints = readInteger(speedPoints, "SP de Speed", 0, CHAMPIONS_MAX_STAT_POINTS);
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const nextStatPoints = { ...statPoints, spe: selectedSpeedPoints };
  const validation = validateChampionsStatPoints(nextStatPoints);
  return validation.valid
    ? { ok: true, statPoints: nextStatPoints, remaining: validation.remaining }
    : { ok: false, error: validation.error };
}

export function minimumTrainingToOutspeed({ model = "champions", baseSpeed, targetSpeed, nature = "neutral", level = 50, iv = 31 }) {
  if (!Number.isFinite(targetSpeed)) return null;
  const maximum = model === "standard" ? 252 : CHAMPIONS_MAX_STAT_POINTS;
  for (let value = 0; value <= maximum; value += model === "standard" ? 4 : 1) {
    const speed = model === "standard"
      ? calculateStandardSpeed({ baseSpeed, level, iv, ev: value, nature })
      : calculateChampionsSpeed(baseSpeed, value, nature);
    if (speed > targetSpeed) return value;
  }
  return null;
}

export function getChampionsSpeedRecommendation({ baseSpeed, targetSpeed, nature = "neutral", availableSpeedSp = CHAMPIONS_MAX_STAT_POINTS }) {
  const available = Number.isInteger(availableSpeedSp)
    ? Math.min(CHAMPIONS_MAX_STAT_POINTS, Math.max(0, availableSpeedSp))
    : 0;
  const requiredSp = minimumTrainingToOutspeed({ baseSpeed, targetSpeed, nature });
  const favorableRequiredSp = normalizeNature(nature) === "favorable"
    ? null
    : minimumTrainingToOutspeed({ baseSpeed, targetSpeed, nature: "favorable" });
  return {
    availableSpeedSp: available,
    requiredSp,
    canOutspeed: requiredSp !== null && requiredSp <= available,
    favorableRequiredSp,
    favorableCanOutspeed: favorableRequiredSp !== null && favorableRequiredSp <= available,
  };
}

export function speedNatureFromName(value) {
  return normalizeNature(value);
}

export function savedNatureForSpeed(value, previousNature = "") {
  const selected = normalizeNature(value);
  if (selected === normalizeNature(previousNature) && previousNature) return previousNature;
  return ({ favorable: "Timid", neutral: "Serious", unfavorable: "Brave" })[selected];
}
