export function validateTeamPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "A equipe precisa ser um objeto JSON." };
  }
  const { schemaVersion, format, rulesetId, name, members } = payload;
  if (schemaVersion !== 1 || format !== "doubles" || rulesetId !== "champions-doubles-draft") {
    return { ok: false, error: "A equipe precisa ser um rascunho Doubles v1 do Spinda Stop." };
  }
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 48) {
    return { ok: false, error: "O nome da equipe precisa ter de 1 a 48 caracteres." };
  }
  if (!Array.isArray(members) || members.length !== 6) {
    return { ok: false, error: "A equipe precisa ter seis posições." };
  }
  const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"];
  for (const [index, member] of members.entries()) {
    if (member === null) continue;
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      return { ok: false, error: `A posição ${index + 1} tem formato inválido.` };
    }
    if (
      typeof member.pokemonId !== "string" || !member.pokemonId
      || typeof member.speciesSlug !== "string" || member.formSlug !== member.pokemonId
      || !Number.isInteger(member.speciesId) || member.speciesId < 1
      || typeof member.formId !== "string" || !member.formId || member.formId.length > 100
      || !Number.isInteger(member.level) || member.level < 1 || member.level > 100
    ) {
      return { ok: false, error: `A posição ${index + 1} precisa de espécie e nível válidos.` };
    }
    if (["ability", "item", "nature"].some((key) => typeof member[key] !== "string" || member[key].length > 100)) {
      return { ok: false, error: `A posição ${index + 1} tem habilidade, item ou nature inválidos.` };
    }
    if (!Array.isArray(member.moves) || member.moves.length !== 4 || member.moves.some((move) => typeof move !== "string" || move.length > 100)) {
      return { ok: false, error: `A posição ${index + 1} precisa de quatro campos de golpe.` };
    }
    if (!member.statPoints || typeof member.statPoints !== "object" || statKeys.some((key) => !Number.isInteger(member.statPoints[key]) || member.statPoints[key] < 0 || member.statPoints[key] > 999)) {
      return { ok: false, error: `A posição ${index + 1} precisa dos seis campos de Stat Points.` };
    }
  }
  return { ok: true, value: payload };
}

export function validateRoomName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 48 ? name : null;
}

export function canCheckIn(roomStatus, memberStatus) {
  return ["open", "locked"].includes(roomStatus) && memberStatus === "registered";
}

export function canStartRoom(roomStatus, checkedInCount, requiredCount = 2) {
  return roomStatus === "locked" && checkedInCount >= requiredCount;
}

export function isRoomParticipant(match, userId) {
  return match && (match.player_a_id === userId || match.player_b_id === userId);
}

export function normalizeFriendCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code.length >= 5 && code.length <= 40 && /[a-zA-Z0-9]/.test(code) && /^[a-zA-Z0-9 -]+$/.test(code) ? code : null;
}
