import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createPool } from "../src/db.js";
import { createApiServer } from "../src/server.js";

const enabled = Boolean(process.env.DATABASE_URL);
const appOrigin = "http://127.0.0.1:4173";
const testKey = "ab".repeat(32);
let pool;
let server;
let apiOrigin;
let testHandles = [];

before(async () => {
  if (!enabled) return;
  pool = createPool();
  const fakeOAuthFetch = async (input) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return new Response(JSON.stringify({ access_token: "temporary-test-token" }), { status: 200 });
    if (url === "https://api.github.com/user") return new Response(JSON.stringify({ id: 987654, login: "community-tester", email: "must-not-be-stored@example.test" }), { status: 200 });
    throw new Error("Unexpected external call from the OAuth test.");
  };
  server = createApiServer({
    pool,
    fetchImpl: fakeOAuthFetch,
    env: { ...process.env, APP_ENV: "test", APP_ORIGIN: appOrigin, FRIEND_CODE_ENCRYPTION_KEY: testKey, GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-secret" },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiOrigin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!enabled) return;
  if (testHandles.length) {
    const handles = testHandles.map((handle) => handle.toLowerCase());
    const testUsers = await pool.query("SELECT id FROM users WHERE provider = 'test' AND provider_subject = ANY($1::text[])", [handles]);
    const ids = testUsers.rows.map((row) => row.id);
    if (ids.length) {
      await pool.query("DELETE FROM teams WHERE owner_id = ANY($1::uuid[])", [ids]);
      await pool.query("DELETE FROM rooms WHERE host_id = ANY($1::uuid[])", [ids]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]);
    }
  }
  await pool.query("DELETE FROM users WHERE provider = 'github' AND provider_subject = '987654'");
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function request(path, { method = "GET", body, cookie = "" } = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(method === "GET" ? {} : { Origin: appOrigin }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
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
  await pool.query("UPDATE users SET is_moderator = true WHERE id = $1", [moderator.id]);

  const unauthorizedTeams = await request("/api/teams");
  assert.equal(unauthorizedTeams.response.status, 401);
  const createdTeam = await request("/api/teams", { method: "POST", cookie: host.cookie, body: { visibility: "private", data: sampleTeam } });
  assert.equal(createdTeam.response.status, 201);
  assert.equal(createdTeam.body.team.visibility, "private");
  assert.deepEqual(createdTeam.body.team.data.members[0], sampleTeam.members[0]);
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
  const storedCode = await pool.query("SELECT friend_code_ciphertext, friend_code_nonce, friend_code_tag FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, host.id]);
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
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM room_members WHERE room_id = $1 AND friend_code_ciphertext IS NOT NULL", [roomId])).rows[0].count, 0);

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

test("API rejects writes from another origin", { skip: !enabled }, async () => {
  const response = await fetch(`${apiOrigin}/api/test/session`, {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "origin-check" }),
  });
  assert.equal(response.status, 403);
});

test("GitHub OAuth checks one-use state, stores no email and issues a scoped session cookie", { skip: !enabled }, async () => {
  const start = await fetch(`${apiOrigin}/api/auth/github`, { redirect: "manual" });
  assert.equal(start.status, 302);
  const authorizationUrl = new URL(start.headers.get("location"));
  assert.equal(authorizationUrl.origin, "https://github.com");
  assert.equal(authorizationUrl.searchParams.get("client_id"), "test-client");
  assert.equal(authorizationUrl.searchParams.get("scope"), "read:user");
  const state = authorizationUrl.searchParams.get("state");
  const stateCookie = start.headers.getSetCookie().find((value) => value.startsWith("spinda_oauth_state=")).split(";")[0];
  assert.ok(state);

  const callback = await fetch(`${apiOrigin}/api/auth/github/callback?code=temporary-code&state=${state}`, {
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
  assert.equal((await pool.query("SELECT provider_subject FROM users WHERE provider = 'github' AND provider_subject = '987654'")).rowCount, 1);
  assert.equal((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email'")).rowCount, 0);

  const reused = await fetch(`${apiOrigin}/api/auth/github/callback?code=temporary-code&state=${state}`, { headers: { Cookie: stateCookie }, redirect: "manual" });
  assert.equal(reused.status, 400);
  const logout = await request("/api/auth/logout", { method: "POST", cookie: sessionCookie, body: {} });
  assert.equal(logout.response.status, 200);
  assert.equal((await request("/api/me", { cookie: sessionCookie })).body.user, null);
});

if (!enabled) test("PostgreSQL integration needs DATABASE_URL", { skip: true }, () => {});
