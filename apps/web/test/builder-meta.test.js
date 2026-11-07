import test from "node:test";
import assert from "node:assert/strict";
import { applyBuilderMetaOption } from "../src/data/builderMeta.js";

const member = {
  pokemonId: "pikachu",
  ability: "Static",
  item: "Light Ball",
  nature: "Serious",
  moves: ["Protect", "Thunderbolt", "Volt Tackle", "Fake Out"],
  statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
};

test("meta move options deduplicate and replace the oldest move when all four slots are filled", () => {
  const duplicate = applyBuilderMetaOption(member, "move", { name: "Thunderbolt" });
  const next = applyBuilderMetaOption(member, "move", { name: "Electro Ball" });

  assert.equal(duplicate.changed, false);
  assert.deepEqual(next.member.moves, ["Thunderbolt", "Volt Tackle", "Fake Out", "Electro Ball"]);
  assert.equal(member.moves[0], "Protect");
});

test("meta choices replace only their own field and validate published Stat Points", () => {
  const changed = applyBuilderMetaOption(member, "stat_points", {
    name: "Balanced",
    statPoints: { hp: 2, attack: 32, defense: 0, spAttack: 0, spDefense: 0, speed: 32 },
  });
  const invalid = applyBuilderMetaOption(member, "stat_points", {
    name: "Incomplete",
    statPoints: { hp: 2, attack: 32, defense: null, spAttack: 0, spDefense: 0, speed: 32 },
  });

  assert.deepEqual(changed.member.statPoints, { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
  assert.equal(changed.member.item, member.item);
  assert.equal(invalid.ok, false);
  assert.deepEqual(member.statPoints, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
});

test("item, ability, and Nature choices replace only their own fields", () => {
  const item = applyBuilderMetaOption(member, "held_item", { name: "Sitrus Berry" }).member;
  const ability = applyBuilderMetaOption(member, "ability", { name: "Lightning Rod" }).member;
  const nature = applyBuilderMetaOption(member, "stat_alignment", { name: "Jolly" }).member;

  assert.equal(item.item, "Sitrus Berry");
  assert.equal(item.ability, member.ability);
  assert.equal(ability.ability, "Lightning Rod");
  assert.equal(ability.item, member.item);
  assert.equal(nature.nature, "Jolly");
  assert.equal(nature.moves, member.moves);
});
