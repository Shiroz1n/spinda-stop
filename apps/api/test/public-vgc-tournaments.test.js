import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicVgcTournamentsHandler } from "../src/public-vgc-tournaments.js";

const id = "6aee620dc931f53978d951e6";
const base = "https://app.test/api/public/vgc-tournaments";

test("public VGC tournament list uses documented pagination and keeps schedule status neutral", async () => {
  let requestedUrl;
  const handler = createPublicVgcTournamentsHandler(async (url, options) => {
    requestedUrl = new URL(url);
    assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    assert.equal(options.credentials, undefined);
    return Response.json([
      { id, game: "VGC", format: "M-C", name: "Copa M-C", date: "2026-10-07T00:00:00.000Z", players: 24, secret: "discard" },
      { id: "6aee620dc931f53978d951e7", game: "VGC", format: "M-C", name: "Outra edição", date: "2026-11-08T00:00:00.000Z", players: 12 },
      { id: "6aee620dc931f53978d951e8", game: "VGC", format: "M-B", name: "Outro regulamento", date: "2026-11-08T00:00:00.000Z", players: 12 },
      { id: "invalid", game: "VGC", format: "M-C", name: "ID inválido", date: "2026-11-08T00:00:00.000Z", players: 12 },
    ]);
  });

  const response = await handler(new Request(`${base}?page=2&limit=3`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=900, stale-while-revalidate=3600");
  assert.equal(requestedUrl.origin, "https://play.limitlesstcg.com");
  assert.equal(requestedUrl.pathname, "/api/tournaments");
  assert.deepEqual(Object.fromEntries(requestedUrl.searchParams), { game: "VGC", format: "M-C", limit: "3", page: "2" });
  const body = await response.json();
  const { checkedAt, ...page } = body;
  assert.ok(Number.isFinite(Date.parse(checkedAt)));
  assert.deepEqual(page, {
    tournaments: [
      {
        id,
        game: "VGC",
        format: "M-C",
        name: "Copa M-C",
        date: "2026-10-07T00:00:00.000Z",
        players: 24,
        url: `https://play.limitlesstcg.com/tournament/${id}`,
      },
      {
        id: "6aee620dc931f53978d951e7",
        game: "VGC",
        format: "M-C",
        name: "Outra edição",
        date: "2026-11-08T00:00:00.000Z",
        players: 12,
        url: "https://play.limitlesstcg.com/tournament/6aee620dc931f53978d951e7",
      },
    ],
    page: 2,
    limit: 3,
    hasNextPage: false,
  });
  assert.equal("scheduleStatus" in body.tournaments[0], false);
});

test("invalid pagination is rejected without contacting the upstream", async () => {
  let called = false;
  const handler = createPublicVgcTournamentsHandler(async () => { called = true; return Response.json([]); });
  const response = await handler(new Request(`${base}?page=0&limit=20`));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("documented max page size bounds a caller-supplied limit", async () => {
  let requestedUrl;
  const handler = createPublicVgcTournamentsHandler(async (url) => {
    requestedUrl = new URL(url);
    return Response.json([]);
  });
  const response = await handler(new Request(`${base}?page=3&limit=500`));
  assert.equal(response.status, 200);
  assert.equal(requestedUrl.searchParams.get("limit"), "50");
  const { checkedAt, ...page } = await response.json();
  assert.ok(Number.isFinite(Date.parse(checkedAt)));
  assert.deepEqual(page, { tournaments: [], page: 3, limit: 50, hasNextPage: false });
});

test("public event details preserve edition and only expose approved fields", async () => {
  let requestedUrl;
  const handler = createPublicVgcTournamentsHandler(async (url) => {
    requestedUrl = new URL(url);
    return Response.json({
      id,
      game: "VGC",
      format: "M-C",
      name: "Copa M-C",
      date: "2026-10-07T00:00:00.000Z",
      players: 24,
      isPublic: true,
      decklists: true,
      isOnline: false,
      platform: "SV",
      organizer: { id: 14, name: "Organizador", logo: "https://untrusted.example/logo.png", secret: "discard" },
      phases: [{ phase: 1, type: "SWISS", rounds: 5, mode: "BO3", hidden: "discard" }],
      specialRules: ["RULE-A"],
      secret: "discard",
    });
  });

  const response = await handler(new Request(`${base}/${id}/details`));
  assert.equal(response.status, 200);
  assert.equal(requestedUrl.href, `https://play.limitlesstcg.com/api/tournaments/${id}/details`);
  const body = await response.json();
  assert.deepEqual(body.tournament, {
    id,
    game: "VGC",
    format: "M-C",
    name: "Copa M-C",
    date: "2026-10-07T00:00:00.000Z",
    players: 24,
    url: `https://play.limitlesstcg.com/tournament/${id}`,
    isPublic: true,
    organizer: { id: 14, name: "Organizador" },
    platform: "SV",
    decklists: true,
    isOnline: false,
    phases: [{ phase: 1, type: "SWISS", rounds: 5, mode: "BO3" }],
    specialRules: ["RULE-A"],
  });
  assert.equal("status" in body.tournament, false);
  assert.equal("scheduleStatus" in body.tournament, false);
});

test("event details and standings reject a response for a different event ID", async () => {
  const handler = createPublicVgcTournamentsHandler(async (url) => Response.json({
    id: "6aee620dc931f53978d951e7",
    game: "VGC",
    format: "M-C",
    name: "Different event",
    date: "2026-10-07T00:00:00.000Z",
    isPublic: true,
    decklists: true,
  }));

  const details = await handler(new Request(`${base}/${id}/details`));
  assert.equal(details.status, 404);
  assert.deepEqual(await details.json(), { error: { code: "tournament_not_found", message: "Torneio público não encontrado." } });
});

test("invalid IDs are rejected before an upstream request", async () => {
  let called = false;
  const handler = createPublicVgcTournamentsHandler(async () => { called = true; return Response.json({}); });
  const response = await handler(new Request(`${base}/arbitrary-id/details`));
  assert.equal(response.status, 404);
  assert.equal(called, false);
});

test("private event details and standings are not exposed", async () => {
  let calls = 0;
  const handler = createPublicVgcTournamentsHandler(async () => {
    calls += 1;
    return Response.json({ id, game: "VGC", format: "M-C", name: "Privado", date: "2026-10-07T00:00:00.000Z", isPublic: false });
  });
  const response = await handler(new Request(`${base}/${id}/standings`));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: "tournament_not_found", message: "Torneio público não encontrado." } });
  assert.equal(calls, 1);
});

test("public standings expose published records and a validated six-member teamlist", async () => {
  const requested = [];
  const teamlist = Array.from({ length: 6 }, (_, index) => ({
    id: `species-${index + 1}`,
    name: `Species ${index + 1}`,
    item: "Sitrus Berry",
    ability: "Overgrow",
    attacks: ["Protect", "Tackle", "", "Hidden Power"],
    nature: "Calm",
    tera: null,
    secret: "discard",
  }));
  const keyedTeamlist = Object.fromEntries(teamlist.map((member, index) => [String(index), member]));
  const handler = createPublicVgcTournamentsHandler(async (url) => {
    requested.push(new URL(url).pathname);
    if (url.endsWith("/details")) {
      return Response.json({ id, game: "VGC", format: "M-C", name: "Copa", date: "2026-10-07T00:00:00.000Z", isPublic: true, decklists: true });
    }
    return Response.json([
      { player: "public-id", name: "Player", country: "br", placing: 2, record: { wins: 5, losses: 1, ties: 0 }, decklist: keyedTeamlist, drop: null },
      { player: "other", name: "Other", placing: 1, record: { wins: 6, losses: 0, ties: 0 }, decklist: teamlist.slice(0, 5) },
      { player: "array", name: "Array list", placing: 2, decklist: teamlist },
      { player: "sparse", name: "Sparse", placing: 3, decklist: [, ...teamlist.slice(1)] },
      { player: "unexpected-keys", name: "Unexpected keys", placing: 4, decklist: { ...keyedTeamlist, metadata: "ignore" } },
      { name: "Missing player id", placing: 4 },
    ]);
  });

  const response = await handler(new Request(`${base}/${id}/standings`));
  assert.equal(response.status, 200);
  assert.deepEqual(requested, [
    `/api/tournaments/${id}/details`,
    `/api/tournaments/${id}/standings`,
  ]);
  const body = await response.json();
  assert.equal(body.tournament.id, id);
  assert.deepEqual(body.standings, [{
    player: "public-id",
    name: "Player",
    placing: 2,
    country: "BR",
    record: { wins: 5, losses: 1, ties: 0 },
    teamlistAvailable: true,
  }, {
    player: "other",
    name: "Other",
    placing: 1,
    record: { wins: 6, losses: 0, ties: 0 },
    teamlistAvailable: false,
  }, {
    player: "array",
    name: "Array list",
    placing: 2,
    teamlistAvailable: true,
  }, {
    player: "sparse",
    name: "Sparse",
    placing: 3,
    teamlistAvailable: false,
  }, {
    player: "unexpected-keys",
    name: "Unexpected keys",
    placing: 4,
    teamlistAvailable: false,
  }]);
  assert.equal("scheduleStatus" in body.standings[0], false);

  const detailResponse = await handler(new Request(`${base}/${id}/standings?player=public-id`));
  const detailBody = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailBody.player, "public-id");
  assert.deepEqual(detailBody.teamlist, Array.from({ length: 6 }, (_, index) => ({
    speciesId: `species-${index + 1}`,
    speciesName: `Species ${index + 1}`,
    item: "Sitrus Berry",
    ability: "Overgrow",
    nature: "Calm",
    moves: ["Protect", "Tackle", "Hidden Power"],
  })));
});

test("Limitless VGC array teamlists require exactly six members", async () => {
  const handler = createPublicVgcTournamentsHandler(async (url) => url.endsWith("/details")
    ? Response.json({ id, game: "VGC", format: "M-C", name: "Copa", date: "2026-10-07T00:00:00.000Z", isPublic: true, decklists: true })
    : Response.json([{ player: "public-id", placing: 1, decklist: Array(1_000).fill(null) }]));

  const response = await handler(new Request(`${base}/${id}/standings`));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).standings[0].teamlistAvailable, false);
});

test("public event without decklists does not expose unexpected team payloads", async () => {
  const handler = createPublicVgcTournamentsHandler(async (url) => url.endsWith("/details")
    ? Response.json({ id, game: "VGC", format: "M-C", name: "Copa", date: "2026-10-07T00:00:00.000Z", isPublic: true, decklists: false })
    : Response.json([{ player: "public-id", name: "Player", decklist: Array(6).fill({ id: "x", name: "X" }) }]));
  const response = await handler(new Request(`${base}/${id}/standings`));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal("teamlist" in body.standings[0], false);
  assert.equal("teamlistAvailable" in body.standings[0], false);
});

test("invalid player IDs are rejected before any Limitless request", async () => {
  let calls = 0;
  const handler = createPublicVgcTournamentsHandler(async () => { calls += 1; return Response.json({}); });
  const response = await handler(new Request(`${base}/${id}/standings?player=${"x".repeat(101)}`));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_player");
  assert.equal(calls, 0);
});

test("missing public teamlists are briefly cached as negative responses", async () => {
  let standingsCalls = 0;
  const handler = createPublicVgcTournamentsHandler(async (url) => {
    if (url.endsWith("/details")) return Response.json({ id, game: "VGC", format: "M-C", name: "Copa", date: "2026-10-07T00:00:00.000Z", isPublic: true, decklists: true });
    standingsCalls += 1;
    return Response.json([{ player: "known-player", name: "Player", decklist: Array(5).fill({ id: "x", name: "X" }) }]);
  });
  const request = new Request(`${base}/${id}/standings?player=known-player`);
  const first = await handler(request);
  const second = await handler(request);
  assert.equal(first.status, 404);
  assert.equal(second.status, 404);
  assert.match(second.headers.get("cache-control"), /max-age=10/);
  assert.equal(standingsCalls, 1);
});

test("public VGC routes hide upstream failures", async () => {
  const handler = createPublicVgcTournamentsHandler(async () => new Response("upstream detail", { status: 503 }));
  const response = await handler(new Request(`${base}?page=1`));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: { code: "public_tournaments_unavailable", message: "Os dados públicos do torneio não estão disponíveis agora." },
  });
});

test("Limitless 429 honors Retry-After and cools down repeated requests per instance", async () => {
  let currentTime = 1_000;
  let calls = 0;
  const handler = createPublicVgcTournamentsHandler(async () => {
    calls += 1;
    return new Response(null, { status: 429, headers: { "Retry-After": "45" } });
  }, { now: () => currentTime });

  const first = await handler(new Request(base));
  assert.equal(first.status, 503);
  assert.equal(first.headers.get("retry-after"), "45");
  assert.equal(calls, 1);

  currentTime += 10_000;
  const cooledDown = await handler(new Request(base));
  assert.equal(cooledDown.status, 503);
  assert.equal(cooledDown.headers.get("retry-after"), "35");
  assert.equal(calls, 1);

  currentTime += 35_000;
  const retry = await handler(new Request(base));
  assert.equal(retry.status, 503);
  assert.equal(retry.headers.get("retry-after"), "45");
  assert.equal(calls, 2);
});
