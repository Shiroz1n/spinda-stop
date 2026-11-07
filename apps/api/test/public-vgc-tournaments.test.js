import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicVgcTournamentsHandler } from "../src/public-vgc-tournaments.js";

test("public VGC agenda requests a fixed M-C feed and returns bounded public fields", async () => {
  let requestedUrl;
  const handler = createPublicVgcTournamentsHandler(async (url, options) => {
    requestedUrl = new URL(url);
    assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    assert.equal(options.credentials, undefined);
    return Response.json([
      { id: "6aee620dc931f53978d951e6", game: "VGC", format: "M-C", name: "Copa M-C", date: "2026-11-07T00:00:00.000Z", players: 24, secret: "discard" },
      { id: "6aee620dc931f53978d951e7", game: "VGC", format: "M-C", name: "Próxima Copa", date: "2026-11-08T00:00:00.000Z", players: 12 },
      { id: "6aee620dc931f53978d951e8", game: "VGC", format: "M-C", name: "Evento passado", date: "2026-11-06T23:59:00.000Z", players: 24 },
      { id: "6aee620dc931f53978d951e6", game: "VGC", format: "M-B", name: "Wrong regulation", date: "2026-11-07T00:00:00.000Z", players: 24 },
      { id: "not-an-id", game: "VGC", format: "M-C", name: "Wrong id", date: "2026-11-07T00:00:00.000Z", players: 24 },
    ]);
  }, () => new Date("2026-11-07T08:00:00.000Z"));

  const response = await handler(new Request("https://app.test/api/public/vgc-tournaments"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=900, stale-while-revalidate=3600");
  assert.equal(requestedUrl.origin, "https://play.limitlesstcg.com");
  assert.equal(requestedUrl.pathname, "/api/tournaments");
  assert.deepEqual(Object.fromEntries(requestedUrl.searchParams), { game: "VGC", format: "M-C", limit: "50" });
  assert.deepEqual(await response.json(), { tournaments: [
    {
      id: "6aee620dc931f53978d951e6",
      name: "Copa M-C",
      date: "2026-11-07T00:00:00.000Z",
      players: 24,
      scheduleStatus: "today",
      url: "https://play.limitlesstcg.com/tournament/6aee620dc931f53978d951e6",
    },
    {
      id: "6aee620dc931f53978d951e7",
      name: "Próxima Copa",
      date: "2026-11-08T00:00:00.000Z",
      players: 12,
      scheduleStatus: "upcoming",
      url: "https://play.limitlesstcg.com/tournament/6aee620dc931f53978d951e7",
    },
  ] });
});

test("public VGC agenda does not expose upstream failures", async () => {
  const handler = createPublicVgcTournamentsHandler(async () => new Response("upstream detail", { status: 503 }));
  const response = await handler(new Request("https://app.test/api/public/vgc-tournaments"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: { code: "public_tournaments_unavailable", message: "A agenda de torneios não está disponível agora." },
  });
});
