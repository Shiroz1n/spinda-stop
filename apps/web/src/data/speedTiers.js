const NATURE_FACTOR = Object.freeze({
  favorable: 1.1,
  neutral: 1,
  unfavorable: 0.9,
});

const SPEED_UP_NATURES = new Set(["timid", "jolly", "hasty", "naive"]);
const SPEED_DOWN_NATURES = new Set(["brave", "relaxed", "quiet", "sassy"]);

export const SPEED_PREVIEW_MAX = 999;

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
  const points = readInteger(statPoints, "SP de Speed", 0, SPEED_PREVIEW_MAX);
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

export function minimumTrainingToOutspeed({ model = "champions", baseSpeed, targetSpeed, nature = "neutral", level = 50, iv = 31 }) {
  if (!Number.isFinite(targetSpeed)) return null;
  const maximum = model === "standard" ? 252 : SPEED_PREVIEW_MAX;
  for (let value = 0; value <= maximum; value += model === "standard" ? 4 : 1) {
    const speed = model === "standard"
      ? calculateStandardSpeed({ baseSpeed, level, iv, ev: value, nature })
      : calculateChampionsSpeed(baseSpeed, value, nature);
    if (speed > targetSpeed) return value;
  }
  return null;
}

export function speedNatureFromName(value) {
  return normalizeNature(value);
}

export function savedNatureForSpeed(value, previousNature = "") {
  const selected = normalizeNature(value);
  if (selected === normalizeNature(previousNature) && previousNature) return previousNature;
  return ({ favorable: "Timid", neutral: "Serious", unfavorable: "Brave" })[selected];
}
