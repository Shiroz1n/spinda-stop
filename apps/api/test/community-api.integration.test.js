import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, test } from "node:test";
import { createPool } from "../src/db.js";
import { createApiApp } from "../src/server.js";

const enabled = Boolean(process.env.DATABASE_URL);
const appOrigin = "http://127.0.0.1:4173";
const testKey = "ab".repeat(32);
let pool;
let adminPool;
let api;
let testHandles = [];

before(async () => {
  if (!enabled) return;
  pool = createPool();
  adminPool = createPool(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL);
  const fakeOAuthFetch = async (input) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return new Response(JSON.stringify({ access_token: "temporary-test-token" }), { status: 200 });
    if (url === "https://api.github.com/user") return new Response(JSON.stringify({ id: 987654, login: "community-tester", email: "must-not-be-stored@example.test" }), { status: 200 });
    throw new Error("Unexpected external call from the OAuth test.");
  };
  api = createApiApp({
    pool,
    fetchImpl: fakeOAuthFetch,
    env: { ...process.env, APP_ENV: "test", APP_ORIGIN: appOrigin, FRIEND_CODE_ENCRYPTION_KEY: testKey, GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-secret" },
  });
});

after(async () => {
  if (!enabled) return;
  if (testHandles.length) {
    const handles = testHandles.map((handle) => handle.toLowerCase());
    const testUsers = await adminPool.query("SELECT id FROM users WHERE provider = 'test' AND provider_subject = ANY($1::text[])", [handles]);
    const ids = testUsers.rows.map((row) => row.id);
    if (ids.length) {
      await adminPool.query("DELETE FROM teams WHERE owner_id = ANY($1::uuid[])", [ids]);
      await adminPool.query("DELETE FROM tournaments WHERE host_id = ANY($1::uuid[])", [ids]);
      await adminPool.query("DELETE FROM rooms WHERE host_id = ANY($1::uuid[])", [ids]);
      await adminPool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]);
    }
  }
  await adminPool.query("DELETE FROM users WHERE provider = 'github' AND provider_subject = '987654'");
  await pool.end();
  await adminPool.end();
});

async function request(path, { method = "GET", body, cookie = "" } = {}) {
  const response = await api.handle(new Request(`http://127.0.0.1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(method === "GET" ? {} : { Origin: appOrigin }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  }));
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

function apiFetch(path, options = {}) {
  return api.handle(new Request(`http://127.0.0.1${path}`, options));
}

async function user(handle) {
  testHandles.push(handle);
  const { response, body } = await request("/api/test/session", { method: "POST", body: { handle } });
  assert.equal(response.status, 200);
  const sessionCookie = response.headers.get("set-cookie").split(";")[0];
  return { id: body.user.id, handle: body.user.handle, cookie: sessionCookie };
}

const sampleTeam = {
  schemaVersion: 1,
  name: "Equipe privada",
  format: "doubles",
  rulesetId: "champions-doubles-draft",
  members: [{
    pokemonId: "garchomp", speciesId: 445, speciesSlug: "garchomp", formId: "default", formSlug: "garchomp",
    ability: "Rough Skin", item: "Clear Amulet", nature: "Adamant", level: 50,
    moves: ["Earthquake", "", "", ""], statPoints: { hp: 0, atk: 14, def: 0, spa: 0, spd: 0, spe: 0 },
  }, null, null, null, null, null],
};

test("authenticated team and two-person room lifecycle enforce ownership and transitions", { skip: !enabled }, async () => {
  const host = await user(`host-${Date.now()}`);
  const guest = await user(`guest-${Date.now()}`);
  const outsider = await user(`outside-${Date.now()}`);
  const moderator = await user(`mod-${Date.now()}`);
  await adminPool.query("UPDATE users SET is_moderator = true WHERE id = $1", [moderator.id]);

  const unauthorizedTeams = await request("/api/teams");
  assert.equal(unauthorizedTeams.response.status, 401);
  const createdTeam = await request("/api/teams", { method: "POST", cookie: host.cookie, body: { visibility: "private", data: sampleTeam } });
  assert.equal(createdTeam.response.status, 201);
  assert.equal(createdTeam.body.team.visibility, "private");
  assert.deepEqual(createdTeam.body.team.data.members[0], sampleTeam.members[0]);
  const emptyTeamPayload = { ...sampleTeam, name: "Equipe sem Pokémon", members: Array(6).fill(null) };
  const emptyTeam = await request("/api/teams", { method: "POST", cookie: host.cookie, body: { visibility: "private", data: emptyTeamPayload } });
  assert.equal(emptyTeam.response.status, 201);
  assert.equal((await request("/api/teams", { cookie: guest.cookie })).body.teams.length, 0);
  const publicTeam = await request(`/api/teams/${createdTeam.body.team.id}`, { method: "PATCH", cookie: host.cookie, body: { visibility: "public" } });
  assert.equal(publicTeam.response.status, 200);
  assert.equal((await request("/api/teams/public", { cookie: guest.cookie })).body.teams.length, 1);
  assert.deepEqual(publicTeam.body.team.data.members[0], sampleTeam.members[0]);
  assert.equal((await request(`/api/teams/${createdTeam.body.team.id}`, { method: "PATCH", cookie: host.cookie, body: { visibility: "private" } })).body.team.visibility, "private");
  assert.equal((await request("/api/teams/public", { cookie: guest.cookie })).body.teams.length, 0);
  assert.equal((await request(`/api/teams/${createdTeam.body.team.id}`, { method: "PATCH", cookie: guest.cookie, body: { visibility: "private" } })).response.status, 404);

  const createdRoom = await request("/api/rooms", { method: "POST", cookie: host.cookie, body: { name: "Sala de teste" } });
  assert.equal(createdRoom.response.status, 201);
  const roomId = createdRoom.body.room.id;
  const inviteToken = new URL(createdRoom.body.inviteUrl).hash.slice(1);
  assert.equal((await request(`/api/rooms/${roomId}`)).response.status, 401);
  assert.equal((await request(`/api/rooms/${roomId}`, { cookie: outsider.cookie })).response.status, 404);
  assert.equal((await request("/api/rooms/join", { method: "POST", cookie: guest.cookie, body: { inviteToken: "invalid" } })).response.status, 400);
  assert.equal((await request("/api/rooms/join", { method: "POST", cookie: guest.cookie, body: { inviteToken } })).response.status, 200);
  assert.equal((await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: host.cookie, body: {} })).response.status, 409);
  assert.equal((await request(`/api/rooms/${roomId}/shared-team`, { method: "PUT", cookie: guest.cookie, body: { teamId: createdTeam.body.team.id } })).response.status, 404);
  assert.equal((await request(`/api/rooms/${roomId}/shared-team`, { method: "PUT", cookie: host.cookie, body: { teamId: emptyTeam.body.team.id } })).response.status, 409);
  assert.equal((await request(`/api/rooms/${roomId}/shared-team`, { method: "PUT", cookie: host.cookie, body: { teamId: createdTeam.body.team.id } })).response.status, 200);
  const sharedRoom = await request(`/api/rooms/${roomId}`, { cookie: guest.cookie });
  const hostRoster = sharedRoom.body.members.find((member) => member.id === host.id).sharedRoster;
  assert.equal(hostRoster[0].pokemonId, "garchomp");
  assert.deepEqual(Object.keys(hostRoster[0]).sort(), ["formId", "formSlug", "pokemonId", "speciesId", "speciesSlug"]);
  assert.equal("moves" in hostRoster[0], false);
  assert.equal((await request(`/api/rooms/${roomId}/shared-team`, { method: "DELETE", cookie: host.cookie })).body.shared, false);
  assert.equal((await request(`/api/rooms/${roomId}`, { cookie: guest.cookie })).body.members.find((member) => member.id === host.id).sharedRoster, null);
  assert.equal((await request(`/api/rooms/${roomId}/shared-team`, { method: "PUT", cookie: host.cookie, body: { teamId: createdTeam.body.team.id } })).response.status, 200);

  const hostCheckin = await request(`/api/rooms/${roomId}/check-in`, { method: "POST", cookie: host.cookie, body: {} });
  const guestCheckin = await request(`/api/rooms/${roomId}/check-in`, { method: "POST", cookie: guest.cookie, body: {} });
  assert.equal(hostCheckin.response.status, 200);
  assert.equal(guestCheckin.response.status, 200);
  assert.equal((await request(`/api/rooms/${roomId}/close`, { method: "POST", cookie: host.cookie, body: {} })).body.status, "locked");
  const started = await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: host.cookie, body: {} });
  assert.equal(started.response.status, 200);
  assert.equal((await request(`/api/rooms/${roomId}/start`, { method: "POST", cookie: host.cookie, body: {} })).body.matchId, started.body.matchId);

  const code = "1234-5678-9012";
  assert.equal((await request(`/api/rooms/${roomId}/friend-code`, { method: "PUT", cookie: host.cookie, body: { code } })).response.status, 200);
  const storedCode = await adminPool.query("SELECT friend_code_ciphertext, friend_code_nonce, friend_code_tag FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, host.id]);
  assert.equal(storedCode.rows[0].friend_code_ciphertext.includes(Buffer.from(code)), false);
  const roomView = await request(`/api/rooms/${roomId}`, { cookie: guest.cookie });
  assert.equal(roomView.body.members.find((member) => member.id === host.id).friendCode, code);
  assert.equal((await request(`/api/rooms/${roomId}/friend-code`, { method: "DELETE", cookie: host.cookie })).response.status, 200);
  assert.equal((await request(`/api/rooms/${roomId}`, { cookie: guest.cookie })).body.members.find((member) => member.id === host.id).friendCode, null);

  const reported = await request(`/api/matches/${started.body.matchId}/report`, { method: "POST", cookie: guest.cookie, body: { winnerId: guest.id, note: "Resultado informado pelos jogadores" } });
  assert.equal(reported.body.status, "awaiting_confirmation");
  assert.equal((await request(`/api/matches/${started.body.matchId}/confirm`, { method: "POST", cookie: guest.cookie, body: {} })).response.status, 409);
  assert.equal((await request(`/api/matches/${started.body.matchId}/dispute`, { method: "POST", cookie: host.cookie, body: { reason: "O resultado informado não confere." } })).body.status, "disputed");
  assert.equal((await request("/api/moderation/disputes", { cookie: outsider.cookie })).response.status, 403);
  const modQueue = await request("/api/moderation/disputes", { cookie: moderator.cookie });
  assert.equal(modQueue.body.disputes.some((item) => item.matchId === started.body.matchId), true);
  const disputeId = roomView.body.match?.dispute?.id || (await request(`/api/rooms/${roomId}`, { cookie: guest.cookie })).body.match.dispute.id;
  const resolution = await request(`/api/moderation/disputes/${disputeId}/resolve`, { method: "POST", cookie: moderator.cookie, body: { decision: "confirm", resolution: "As duas pessoas confirmaram o vencedor em mensagem de sala." } });
  assert.equal(resolution.body.status, "confirmed");
  assert.equal(resolution.body.winnerId, guest.id);
  assert.equal((await request(`/api/rooms/${roomId}`, { cookie: host.cookie })).body.room.status, "completed");
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM room_members WHERE room_id = $1 AND friend_code_ciphertext IS NOT NULL", [roomId])).rows[0].count, 0);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM room_members WHERE room_id = $1 AND shared_roster_json IS NOT NULL", [roomId])).rows[0].count, 0);

  const confirmationRoom = await request("/api/rooms", { method: "POST", cookie: host.cookie, body: { name: "Sala com confirmação" } });
  const confirmationId = confirmationRoom.body.room.id;
  const confirmationInvite = new URL(confirmationRoom.body.inviteUrl).hash.slice(1);
  assert.equal((await request("/api/rooms/join", { method: "POST", cookie: guest.cookie, body: { inviteToken: confirmationInvite } })).response.status, 200);
  await request(`/api/rooms/${confirmationId}/check-in`, { method: "POST", cookie: host.cookie, body: {} });
  await request(`/api/rooms/${confirmationId}/check-in`, { method: "POST", cookie: guest.cookie, body: {} });
  await request(`/api/rooms/${confirmationId}/close`, { method: "POST", cookie: host.cookie, body: {} });
  const confirmationMatch = await request(`/api/rooms/${confirmationId}/start`, { method: "POST", cookie: host.cookie, body: {} });
  assert.equal(confirmationMatch.response.status, 200);
  await request(`/api/matches/${confirmationMatch.body.matchId}/report`, { method: "POST", cookie: host.cookie, body: { winnerId: host.id } });
  assert.equal((await request(`/api/matches/${confirmationMatch.body.matchId}/confirm`, { method: "POST", cookie: guest.cookie, body: {} })).body.status, "confirmed");
  assert.equal((await request(`/api/rooms/${confirmationId}`, { cookie: guest.cookie })).body.room.status, "completed");
});

test("private four-person tournament enforces entry, check-in, bracket and moderated results", { skip: !enabled }, async () => {
  const stamp = Date.now();
  const host = await user(`t-host-${stamp}`);
  const playerA = await user(`t-a-${stamp}`);
  const playerB = await user(`t-b-${stamp}`);
  const playerC = await user(`t-c-${stamp}`);
  const outsider = await user(`t-out-${stamp}`);
  const moderator = await user(`t-mod-${stamp}`);
  await adminPool.query("UPDATE users SET is_moderator = true WHERE id = $1", [moderator.id]);

  assert.equal((await request("/api/tournaments")).response.status, 401);
  const created = await request("/api/tournaments", { method: "POST", cookie: host.cookie, body: { name: "Doubles local" } });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.tournament.status, "open");
  const savedTeam = await request("/api/teams", { method: "POST", cookie: host.cookie, body: { visibility: "private", data: sampleTeam } });
  assert.equal(savedTeam.response.status, 201);
  const tournamentId = created.body.tournament.id;
  const inviteToken = new URL(created.body.inviteUrl).hash.slice(1);
  for (const entrant of [playerA, playerB, playerC]) {
    assert.equal((await request("/api/tournaments/join", { method: "POST", cookie: entrant.cookie, body: { inviteToken } })).response.status, 200);
  }
  assert.equal((await request(`/api/tournaments/${tournamentId}/shared-team`, { method: "PUT", cookie: host.cookie, body: { teamId: savedTeam.body.team.id } })).response.status, 200);
  assert.equal((await request(`/api/tournaments/${tournamentId}/leave`, { method: "POST", cookie: playerC.cookie, body: {} })).response.status, 200);
  assert.equal((await request("/api/tournaments", { cookie: playerC.cookie })).body.tournaments.some((tournament) => tournament.id === tournamentId), false);
  assert.equal((await request("/api/tournaments/join", { method: "POST", cookie: playerC.cookie, body: { inviteToken } })).response.status, 200);
  assert.equal((await request(`/api/tournaments/${tournamentId}/leave`, { method: "POST", cookie: host.cookie, body: {} })).response.status, 409);
  assert.equal((await request("/api/tournaments/join", { method: "POST", cookie: outsider.cookie, body: { inviteToken } })).response.status, 409);
  assert.equal((await request(`/api/tournaments/${tournamentId}`, { cookie: outsider.cookie })).response.status, 404);
  assert.equal((await request(`/api/tournaments/${tournamentId}/close`, { method: "POST", cookie: host.cookie, body: {} })).response.status, 409);

  for (const entrant of [host, playerA, playerB, playerC]) {
    assert.equal((await request(`/api/tournaments/${tournamentId}/check-in`, { method: "POST", cookie: entrant.cookie, body: {} })).body.status, "checked_in");
  }
  assert.equal((await request(`/api/tournaments/${tournamentId}/close`, { method: "POST", cookie: playerA.cookie, body: {} })).response.status, 404);
  const [racingLeave, racingClose] = await Promise.all([
    request(`/api/tournaments/${tournamentId}/leave`, { method: "POST", cookie: playerC.cookie, body: {} }),
    request(`/api/tournaments/${tournamentId}/close`, { method: "POST", cookie: host.cookie, body: {} }),
  ]);
  const afterRace = await request(`/api/tournaments/${tournamentId}`, { cookie: host.cookie });
  if (afterRace.body.tournament.status === "locked") {
    assert.equal(racingLeave.response.status, 409);
    assert.equal(afterRace.body.members.length, 4);
  } else {
    assert.equal(afterRace.body.tournament.status, "open");
    assert.equal(racingLeave.response.status, 200);
    assert.equal(racingClose.response.status, 409);
    assert.equal((await request("/api/tournaments/join", { method: "POST", cookie: playerC.cookie, body: { inviteToken } })).response.status, 200);
    assert.equal((await request(`/api/tournaments/${tournamentId}/check-in`, { method: "POST", cookie: playerC.cookie, body: {} })).body.status, "checked_in");
    assert.equal((await request(`/api/tournaments/${tournamentId}/close`, { method: "POST", cookie: host.cookie, body: {} })).body.status, "locked");
  }
  const shared = await request(`/api/tournaments/${tournamentId}/friend-code`, { method: "PUT", cookie: host.cookie, body: { code: "1234-5678-9012" } });
  assert.equal(shared.response.status, 200);
  const encrypted = await adminPool.query("SELECT friend_code_ciphertext FROM tournament_members WHERE tournament_id = $1 AND user_id = $2", [tournamentId, host.id]);
  assert.equal(encrypted.rows[0].friend_code_ciphertext.includes(Buffer.from("1234-5678-9012")), false);
  assert.equal((await request(`/api/tournaments/${tournamentId}`, { cookie: outsider.cookie })).response.status, 404);
  const started = await request(`/api/tournaments/${tournamentId}/start`, { method: "POST", cookie: host.cookie, body: {} });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.status, "in_progress");
  assert.equal(started.body.matchIds.length, 2);
  assert.equal((await request(`/api/tournaments/${tournamentId}/start`, { method: "POST", cookie: host.cookie, body: {} })).body.matchIds.length, 2);

  const tournamentView = await request(`/api/tournaments/${tournamentId}`, { cookie: playerA.cookie });
  assert.equal(tournamentView.response.status, 200);
  assert.equal(tournamentView.body.matches.length, 2);
  assert.equal(tournamentView.body.members.find((member) => member.id === host.id).friendCode, "1234-5678-9012");
  assert.equal(tournamentView.body.members.find((member) => member.id === host.id).sharedRoster[0].pokemonId, "garchomp");
  assert.equal((await request(`/api/tournaments/${tournamentId}/friend-code`, { method: "DELETE", cookie: host.cookie })).response.status, 200);
  assert.equal((await request(`/api/tournaments/${tournamentId}`, { cookie: playerA.cookie })).body.members.find((member) => member.id === host.id).friendCode, null);
  assert.equal((await request(`/api/tournaments/${tournamentId}/friend-code`, { method: "PUT", cookie: host.cookie, body: { code: "1234-5678-9012" } })).response.status, 200);
  const seeds = tournamentView.body.members.map((member) => member.seed).sort();
  assert.deepEqual(seeds, [1, 2, 3, 4]);
  const semis = tournamentView.body.matches;
  const cookiesById = new Map([[host.id, host.cookie], [playerA.id, playerA.cookie], [playerB.id, playerB.cookie], [playerC.id, playerC.cookie]]);
  const seedByUser = new Map(tournamentView.body.members.map((member) => [member.id, member.seed]));
  assert.deepEqual(semis.map((match) => [seedByUser.get(match.playerA.id), seedByUser.get(match.playerB.id)].sort((a, b) => a - b)), [[1, 4], [2, 3]]);

  const disputedSemi = semis[0];
  assert.equal((await request(`/api/matches/${disputedSemi.id}/report`, { method: "POST", cookie: cookiesById.get(disputedSemi.playerA.id), body: { winnerId: disputedSemi.playerA.id, note: "Relato manual" } })).body.status, "awaiting_confirmation");
  assert.equal((await request(`/api/matches/${disputedSemi.id}/confirm`, { method: "POST", cookie: cookiesById.get(disputedSemi.playerA.id), body: {} })).response.status, 409);
  assert.equal((await request(`/api/matches/${disputedSemi.id}/dispute`, { method: "POST", cookie: cookiesById.get(disputedSemi.playerB.id), body: { reason: "O placar relatado precisa de revisão." } })).response.status, 201);
  assert.equal((await request("/api/moderation/disputes", { cookie: outsider.cookie })).response.status, 403);
  const queue = await request("/api/moderation/disputes", { cookie: moderator.cookie });
  const queued = queue.body.disputes.find((dispute) => dispute.matchId === disputedSemi.id);
  assert.equal(queued.eventName, "Doubles local");
  assert.equal(queued.eventType, "tournament");
  assert.equal(queued.tournamentId, tournamentId);
  const disputeId = (await request(`/api/tournaments/${tournamentId}`, { cookie: host.cookie })).body.matches.find((match) => match.id === disputedSemi.id).dispute.id;
  const otherSemi = semis[1];
  assert.equal((await request(`/api/matches/${otherSemi.id}/report`, { method: "POST", cookie: cookiesById.get(otherSemi.playerA.id), body: { winnerId: otherSemi.playerB.id } })).body.status, "awaiting_confirmation");
  const [moderatorResolution, playerConfirmation] = await Promise.all([
    request(`/api/moderation/disputes/${disputeId}/resolve`, { method: "POST", cookie: moderator.cookie, body: { decision: "confirm", resolution: "Os participantes confirmaram o resultado relatado." } }),
    request(`/api/matches/${otherSemi.id}/confirm`, { method: "POST", cookie: cookiesById.get(otherSemi.playerB.id), body: {} }),
  ]);
  assert.equal(moderatorResolution.body.status, "confirmed");
  assert.equal(playerConfirmation.body.tournament.status, "in_progress");
  const withFinal = await request(`/api/tournaments/${tournamentId}`, { cookie: host.cookie });
  assert.equal(withFinal.body.matches.length, 3);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM matches WHERE tournament_id = $1 AND round_number = 2", [tournamentId])).rows[0].count, 1);
  const final = withFinal.body.matches.find((match) => match.roundNumber === 2);
  assert.ok(final);
  assert.equal((await request(`/api/matches/${final.id}/report`, { method: "POST", cookie: cookiesById.get(final.playerA.id), body: { winnerId: final.playerA.id } })).body.status, "awaiting_confirmation");
  const completed = await request(`/api/matches/${final.id}/confirm`, { method: "POST", cookie: cookiesById.get(final.playerB.id), body: {} });
  assert.equal(completed.body.tournament.status, "completed");
  assert.equal(completed.body.tournament.championId, final.playerA.id);
  const finished = await request(`/api/tournaments/${tournamentId}`, { cookie: host.cookie });
  assert.equal(finished.body.tournament.status, "completed");
  assert.equal(finished.body.matches.length, 3);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM tournament_members WHERE tournament_id = $1 AND friend_code_ciphertext IS NOT NULL", [tournamentId])).rows[0].count, 0);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM tournament_members WHERE tournament_id = $1 AND shared_roster_json IS NOT NULL", [tournamentId])).rows[0].count, 0);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM moderation_events WHERE tournament_id = $1 AND action = 'resolve_dispute_confirm'", [tournamentId])).rows[0].count, 1);

  const cancelledCreation = await request("/api/tournaments", { method: "POST", cookie: host.cookie, body: { name: "Doubles cancelado" } });
  const cancelledId = cancelledCreation.body.tournament.id;
  const cancelledToken = new URL(cancelledCreation.body.inviteUrl).hash.slice(1);
  for (const entrant of [playerA, playerB, playerC]) await request("/api/tournaments/join", { method: "POST", cookie: entrant.cookie, body: { inviteToken: cancelledToken } });
  for (const entrant of [host, playerA, playerB, playerC]) await request(`/api/tournaments/${cancelledId}/check-in`, { method: "POST", cookie: entrant.cookie, body: {} });
  assert.equal((await request(`/api/tournaments/${cancelledId}/close`, { method: "POST", cookie: host.cookie, body: {} })).response.status, 200);
  assert.equal((await request(`/api/tournaments/${cancelledId}/start`, { method: "POST", cookie: host.cookie, body: {} })).response.status, 200);
  assert.equal((await request(`/api/tournaments/${cancelledId}/friend-code`, { method: "PUT", cookie: host.cookie, body: { code: "1234-5678-9012" } })).response.status, 200);
  const cancelledView = await request(`/api/tournaments/${cancelledId}`, { cookie: host.cookie });
  const contestedMatch = cancelledView.body.matches[0];
  assert.equal((await request(`/api/matches/${contestedMatch.id}/report`, { method: "POST", cookie: cookiesById.get(contestedMatch.playerA.id), body: { winnerId: contestedMatch.playerA.id } })).response.status, 200);
  assert.equal((await request(`/api/matches/${contestedMatch.id}/dispute`, { method: "POST", cookie: cookiesById.get(contestedMatch.playerB.id), body: { reason: "O relato precisa ser anulado." } })).response.status, 201);
  const cancelledMatchView = await request(`/api/tournaments/${cancelledId}`, { cookie: host.cookie });
  const cancelledDispute = cancelledMatchView.body.matches.find((match) => match.id === contestedMatch.id).dispute;
  const voided = await request(`/api/moderation/disputes/${cancelledDispute.id}/resolve`, { method: "POST", cookie: moderator.cookie, body: { decision: "void", resolution: "Sem confirmação independente; evento encerrado." } });
  assert.equal(voided.body.status, "void");
  assert.equal(voided.body.tournament.status, "cancelled");
  const cancelledFinalState = await request(`/api/tournaments/${cancelledId}`, { cookie: host.cookie });
  assert.equal(cancelledFinalState.body.tournament.status, "cancelled");
  assert.ok(cancelledFinalState.body.matches.every((match) => match.status === "void"));
  assert.equal(cancelledFinalState.body.members.find((member) => member.id === host.id).friendCode, null);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM tournament_members WHERE tournament_id = $1 AND friend_code_ciphertext IS NOT NULL", [cancelledId])).rows[0].count, 0);
  assert.equal((await adminPool.query("SELECT count(*)::int AS count FROM moderation_events WHERE tournament_id = $1 AND action = 'resolve_dispute_void'", [cancelledId])).rows[0].count, 1);
});

test("API rejects writes from another origin", { skip: !enabled }, async () => {
  const response = await apiFetch("/api/test/session", {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "origin-check" }),
  });
  assert.equal(response.status, 403);
});

test("GitHub OAuth checks one-use state, stores no email and issues a scoped session cookie", { skip: !enabled }, async () => {
  const start = await apiFetch("/api/auth/github", { redirect: "manual" });
  assert.equal(start.status, 302);
  const authorizationUrl = new URL(start.headers.get("location"));
  assert.equal(authorizationUrl.origin, "https://github.com");
  assert.equal(authorizationUrl.searchParams.get("client_id"), "test-client");
  assert.equal(authorizationUrl.searchParams.get("scope"), "read:user");
  const state = authorizationUrl.searchParams.get("state");
  const stateCookie = start.headers.getSetCookie().find((value) => value.startsWith("spinda_oauth_state=")).split(";")[0];
  assert.ok(state);

  const callback = await apiFetch(`/api/auth/github/callback?code=temporary-code&state=${state}`, {
    headers: { Cookie: stateCookie },
    redirect: "manual",
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), `${appOrigin}/rooms`);
  const cookies = callback.headers.getSetCookie();
  const session = cookies.find((value) => value.startsWith("spinda_session="));
  assert.match(session, /HttpOnly/);
  assert.match(session, /SameSite=Lax/);
  const sessionCookie = session.split(";")[0];
  const me = await request("/api/me", { cookie: sessionCookie });
  assert.equal(me.body.user.handle, "community-tester");
  testHandles.push("community-tester");
  assert.equal((await adminPool.query("SELECT provider_subject FROM users WHERE provider = 'github' AND provider_subject = '987654'")).rowCount, 1);
  assert.equal((await adminPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email'")).rowCount, 0);

  const reused = await apiFetch(`/api/auth/github/callback?code=temporary-code&state=${state}`, { headers: { Cookie: stateCookie }, redirect: "manual" });
  assert.equal(reused.status, 400);
  const logout = await request("/api/auth/logout", { method: "POST", cookie: sessionCookie, body: {} });
  assert.equal(logout.response.status, 200);
  assert.equal((await request("/api/me", { cookie: sessionCookie })).body.user, null);
});

if (!enabled) test("PostgreSQL integration needs DATABASE_URL", { skip: true }, () => {});

test("team writes keep SQL-shaped names as data and cannot cross account ownership", { skip: !enabled }, async () => {
  const owner = await user(`sql-owner-${Date.now()}`);
  const other = await user(`sql-other-${Date.now()}`);
  const maliciousName = "'; UPDATE users SET is_moderator = true; --";
  const created = await request("/api/teams", {
    method: "POST",
    cookie: owner.cookie,
    body: {
      ownerId: other.id,
      userId: other.id,
      isModerator: true,
      visibility: "private",
      data: { ...sampleTeam, name: maliciousName },
    },
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.body.team.name, maliciousName);
  assert.equal((await request("/api/teams", { cookie: other.cookie })).body.teams.some((team) => team.id === created.body.team.id), false);
  assert.equal((await request(`/api/teams/${created.body.team.id}`, {
    method: "PATCH", cookie: other.cookie, body: { visibility: "public" },
  })).response.status, 404);
  assert.equal((await request(`/api/teams/${created.body.team.id}`, { method: "DELETE", cookie: other.cookie })).response.status, 404);
  assert.equal((await request("/api/teams/'%20OR%201=1", { cookie: owner.cookie })).response.status, 404);
  const ownerRow = await adminPool.query("SELECT owner_id FROM teams WHERE id = $1", [created.body.team.id]);
  assert.equal(ownerRow.rows[0].owner_id, owner.id);
  assert.equal((await adminPool.query("SELECT is_moderator FROM users WHERE id = $1", [other.id])).rows[0].is_moderator, false);

  const stillPrivate = await request("/api/teams", { cookie: owner.cookie });
  assert.equal(stillPrivate.body.teams.find((team) => team.id === created.body.team.id).visibility, "private");
  assert.equal((await adminPool.query("SELECT name FROM teams WHERE id = $1", [created.body.team.id])).rows[0].name, maliciousName);
});

test("runtime PostgreSQL role cannot grant moderator privileges", {
  skip: !enabled || process.env.REQUIRE_RESTRICTED_DB_ROLE !== "true",
}, async () => {
  const account = await user(`least-privilege-${Date.now()}`);
  await assert.rejects(
    pool.query("SELECT * FROM moderation_events LIMIT 1"),
    /permission denied/i,
  );
  await assert.rejects(
    pool.query("UPDATE users SET is_moderator = true WHERE id = $1", [account.id]),
    /permission denied/i,
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(client.query("CREATE TABLE runtime_role_must_not_create (id integer)"), /permission denied/i);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
  assert.equal((await request("/api/moderation/disputes", { cookie: account.cookie })).response.status, 403);
});

test("rate limiting is shared between independent API instances in PostgreSQL", { skip: !enabled }, async () => {
  const ip = `203.0.113.${(Date.now() % 200) + 1}`;
  const rateHashSecret = "integration-rate-hash-secret";
  const bucketKey = createHmac("sha256", rateHashSecret).update(`tournament-invite-join\0${ip}`).digest("hex");
  const env = {
    APP_ENV: "test",
    VERCEL_ENV: "preview",
    VERCEL_BRANCH_URL: "spinda-rate-test.example.vercel.app",
    APP_ORIGIN: "https://spinda-rate-test.example.vercel.app",
    RATE_LIMIT_HASH_SECRET: rateHashSecret,
    GITHUB_CLIENT_ID: "test-client",
    GITHUB_CLIENT_SECRET: "test-secret",
  };
  const first = createApiApp({ pool, env });
  const second = createApiApp({ pool, env });
  const send = (app) => app.handle(new Request(`${env.APP_ORIGIN}/api/tournaments/join`, {
    method: "POST",
    headers: {
      Origin: env.APP_ORIGIN,
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: "{}",
  }));

  try {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await send(attempt % 2 === 0 ? first : second);
      assert.equal(response.status, 401);
    }
    const limited = await send(second);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, "rate_limited");
    const storedBucket = await adminPool.query("SELECT hit_count FROM api_rate_limits WHERE bucket_key = $1", [bucketKey]);
    assert.equal(storedBucket.rows[0].hit_count, 25);
    assert.notEqual(bucketKey, ip);
  } finally {
    await adminPool.query("DELETE FROM api_rate_limits WHERE bucket_key = $1", [bucketKey]);
  }
});

test("cron cleanup requires a secret and removes expired rows using runtime permissions", { skip: !enabled }, async () => {
  const expiredBucket = "f".repeat(64);
  await adminPool.query(
    "INSERT INTO api_rate_limits (bucket_key, bucket_window, hit_count, expires_at) VALUES ($1, 1, 1, now() - interval '1 minute') ON CONFLICT (bucket_key) DO UPDATE SET expires_at = now() - interval '1 minute'",
    [expiredBucket],
  );
  const maintenanceApi = createApiApp({
    pool,
    env: { APP_ENV: "test", APP_ORIGIN: appOrigin, CRON_SECRET: "integration-cron-secret" },
  });

  const denied = await maintenanceApi.handle(new Request("http://127.0.0.1/api/cron/cleanup"));
  assert.equal(denied.status, 401);
  assert.equal((await adminPool.query("SELECT 1 FROM api_rate_limits WHERE bucket_key = $1", [expiredBucket])).rowCount, 1);

  const cleaned = await maintenanceApi.handle(new Request("http://127.0.0.1/api/cron/cleanup", {
    headers: { Authorization: "Bearer integration-cron-secret" },
  }));
  assert.equal(cleaned.status, 200);
  const body = await cleaned.json();
  assert.equal(body.ok, true);
  assert.ok(body.cleanup.rateLimitBuckets >= 1);
  assert.equal((await adminPool.query("SELECT 1 FROM api_rate_limits WHERE bucket_key = $1", [expiredBucket])).rowCount, 0);
});
