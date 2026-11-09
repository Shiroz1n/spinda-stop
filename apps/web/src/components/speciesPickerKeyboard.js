export function nextSpeciesPickerIndex(currentIndex, key, resultCount) {
  if (!resultCount || (key !== "ArrowDown" && key !== "ArrowUp")) return currentIndex;

  const direction = key === "ArrowDown" ? 1 : -1;
  const current = currentIndex < 0 ? (direction > 0 ? -1 : 0) : currentIndex;
  return (current + direction + resultCount) % resultCount;
}
