import test from "node:test";
import assert from "node:assert/strict";
import { nextSpeciesPickerIndex } from "../src/components/speciesPickerKeyboard.js";

test("SpeciesPicker arrow keys move through results and wrap at both ends", () => {
  assert.equal(nextSpeciesPickerIndex(-1, "ArrowDown", 3), 0);
  assert.equal(nextSpeciesPickerIndex(0, "ArrowDown", 3), 1);
  assert.equal(nextSpeciesPickerIndex(2, "ArrowDown", 3), 0);
  assert.equal(nextSpeciesPickerIndex(0, "ArrowUp", 3), 2);
  assert.equal(nextSpeciesPickerIndex(2, "ArrowUp", 3), 1);
});

test("SpeciesPicker leaves selection unchanged when no result or navigation key exists", () => {
  assert.equal(nextSpeciesPickerIndex(-1, "ArrowDown", 0), -1);
  assert.equal(nextSpeciesPickerIndex(1, "Enter", 3), 1);
});
