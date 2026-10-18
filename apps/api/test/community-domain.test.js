import assert from "node:assert/strict";
import test from "node:test";
import { canCheckIn, canStartRoom, isRoomParticipant, normalizeFriendCode, validateRoomName, validateTeamPayload } from "../src/community-domain.js";
import { decryptFriendCode, encryptFriendCode, encryptionKey } from "../src/friend-code.js";

const sampleTeam = {
  schemaVersion: 1,
  name: "Rascunho Doubles",
  format: "doubles",
  rulesetId: "champions-doubles-draft",
  members: [
    {
      pokemonId: "garchomp", speciesId: 445, speciesSlug: "garchomp", formId: 445, formSlug: "garchomp",
      ability: "Rough Skin", item: "Clear Amulet", nature: "Adamant", level: 50,
      moves: ["Earthquake", "", "", ""], statPoints: { hp: 0, atk: 14, def: 0, spa: 0, spd: 0, spe: 0 },
    },
    null, null, null, null, null,
  ],
};

test("keeps a team payload intact, including unfinished sets and Stat Points", () => {
  const result = validateTeamPayload(sampleTeam);
  assert.equal(result.ok, true);
  assert.equal(result.value, sampleTeam);
  assert.equal(result.value.members[0].item, "Clear Amulet");
  assert.equal(result.value.members[0].statPoints.atk, 14);
  assert.deepEqual(result.value.members[0].moves, ["Earthquake", "", "", ""]);
  assert.equal(validateTeamPayload({ ...sampleTeam, members: [null] }).ok, false);
  assert.equal(validateTeamPayload({ ...sampleTeam, format: "singles" }).ok, false);
  assert.equal(validateTeamPayload({ ...sampleTeam, members: [{ ...sampleTeam.members[0], statPoints: { atk: -1 } }, null, null, null, null, null] }).ok, false);
});

test("room transitions require an open or locked room and enough check-ins", () => {
  assert.equal(canCheckIn("open", "registered"), true);
  assert.equal(canCheckIn("locked", "registered"), true);
  assert.equal(canCheckIn("in_progress", "registered"), false);
  assert.equal(canCheckIn("open", "left"), false);
  assert.equal(canStartRoom("locked", 2), true);
  assert.equal(canStartRoom("open", 2), false);
  assert.equal(canStartRoom("locked", 1), false);
});

test("room and friendship-code inputs are bounded and normalized", () => {
  assert.equal(validateRoomName("  Sala do sábado  "), "Sala do sábado");
  assert.equal(validateRoomName(" "), null);
  assert.equal(validateRoomName("x".repeat(49)), null);
  assert.equal(normalizeFriendCode("  1234-5678-9012  "), "1234-5678-9012");
  assert.equal(normalizeFriendCode("<script>"), null);
  assert.equal(normalizeFriendCode("-----"), null);
});

test("friend codes are authenticated ciphertext and decrypt only with the same key", () => {
  const key = encryptionKey("ab".repeat(32));
  const sealed = encryptFriendCode("1234-5678-9012", key);
  assert.equal(sealed.ciphertext.includes(Buffer.from("1234-5678-9012")), false);
  assert.equal(decryptFriendCode(sealed, key), "1234-5678-9012");
  assert.throws(() => decryptFriendCode(sealed, encryptionKey("cd".repeat(32))));
  const scoped = encryptFriendCode("1234-5678-9012", key, "room-1:user-1");
  assert.equal(decryptFriendCode(scoped, key, "room-1:user-1"), "1234-5678-9012");
  assert.throws(() => decryptFriendCode(scoped, key, "room-1:user-2"));
  assert.throws(() => encryptionKey("short"));
});

test("a match participant check does not grant access to an outsider", () => {
  const match = { player_a_id: "a", player_b_id: "b" };
  assert.equal(isRoomParticipant(match, "a"), true);
  assert.equal(isRoomParticipant(match, "b"), true);
  assert.equal(isRoomParticipant(match, "c"), false);
});
