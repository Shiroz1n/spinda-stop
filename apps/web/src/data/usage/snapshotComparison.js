const SNAPSHOT_CATEGORIES = ["move", "held_item", "ability", "stat_alignment", "stat_points", "teammate"];
const STAT_POINT_FIELDS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];

function normalized(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "")
    : "";
}

function snapshotDate(value) {
  if (typeof value !== "string") return null;
  const folderDate = value.match(/^(\d{2})_(\d{2})_(\d{4})$/);
  const isoDate = folderDate ? folderDate[3] + "-" + folderDate[2] + "-" + folderDate[1] : value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && Number.isFinite(Date.parse(isoDate + "T00:00:00Z")) ? isoDate : null;
}

export function areComparableSnapshots(left, right) {
  if (!left || !right || !left.showdownId || left.showdownId !== right.showdownId
    || !left.season || normalized(left.season) !== normalized(right.season)
    || normalized(left.format) !== "doubles") return false;
  if (normalized(right.format) !== "doubles") return false;

  const leftDate = snapshotDate(left.date);
  const rightDate = snapshotDate(right.date);
  if (!leftDate || !rightDate || leftDate === rightDate) return false;

  const sourceParts = [left.sourceFile, right.sourceFile].map((source) => typeof source === "string" ? source.split("/") : []);
  return sourceParts.every((parts, index) => parts.length >= 5
    && parts[0] === "battle_data"
    && normalized(parts[1]) === normalized(index === 0 ? left.season : right.season)
    && snapshotDate(parts[2]) === (index === 0 ? leftDate : rightDate)
    && normalized(parts[3]) === "doubles");
}

function rowIdentity(row, category) {
  if (category === "stat_points") {
    const values = STAT_POINT_FIELDS.map((field) => row.statPoints?.[field]);
    return values.every(Number.isFinite) ? "spread:" + values.join("/") : null;
  }
  const name = normalized(row.name);
  return name ? "name:" + name : null;
}

export function compareSnapshotRanks(current, comparison, categoryId = "profile") {
  if (!areComparableSnapshots(current, comparison)) return null;
  const selectedCategories = categoryId === "profile" ? SNAPSHOT_CATEGORIES : [categoryId];

  return selectedCategories.map((category) => {
    const currentRows = new Map((current.rows || [])
      .filter((row) => row.category === category && Number.isInteger(row.rank) && row.rank > 0)
      .map((row) => [rowIdentity(row, category), row])
      .filter(([key]) => key));
    const comparisonRows = new Map((comparison.rows || [])
      .filter((row) => row.category === category && Number.isInteger(row.rank) && row.rank > 0)
      .map((row) => [rowIdentity(row, category), row])
      .filter(([key]) => key));
    const rows = [...currentRows].flatMap(([key, row]) => {
      const previous = comparisonRows.get(key);
      return previous ? [{
        name: row.name || previous.name || "Distribuição",
        currentRank: row.rank,
        comparisonRank: previous.rank,
        movement: previous.rank - row.rank,
      }] : [];
    }).sort((left, right) => left.currentRank - right.currentRank || left.name.localeCompare(right.name, "pt-BR"));
    return { category, rows };
  }).filter((group) => group.rows.length);
}
