import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiApp } from "../src/server.js";

test("Elysia serves the public archive through the scoped route", async () => {
  const app = createApiApp({
    database: {},
    publicTeamsFetch: async () => Response.json({ teams: [{ team_id: "MC781", pokemon: ["Sneasler"] }] }),
  });
  const response = await app.handle(new Request("https://app.test/api/public/teams?pokemon=Sneasler"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    teams: [{ id: "MC781", player: "", event: "", placement: "", date: "", sourceUrl: null, pasteUrl: null, pokemon: [{ name: "Sneasler", item: "" }] }],
  });
});

test("Elysia limits paste cache misses by requester address", async () => {
  let upstreamRequests = 0;
  const app = createApiApp({
    database: {},
    env: { ...process.env, VERCEL_ENV: "" },
    publicTeamsFetch: async () => {
      upstreamRequests += 1;
      return Response.json({ text: "Sneasler @ Focus Sash" });
    },
  });
  let lastResponse;
  for (let index = 0; index < 25; index += 1) {
    lastResponse = await app.handle(new Request("https://app.test/api/public/teams/MC781/paste", {
      headers: { "x-forwarded-for": `198.51.100.${index + 1}` },
    }));
  }
  assert.equal(upstreamRequests, 24);
  assert.equal(lastResponse.status, 429);
});

test("Elysia serves the public VGC agenda through the scoped route", async () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const date = tomorrow.toISOString();
  const app = createApiApp({
    database: {},
    publicVgcTournamentsFetch: async () => Response.json([{
      id: "6aee620dc931f53978d951e6",
      game: "VGC",
      format: "M-C",
      name: "Copa M-C",
      date,
      players: 24,
    }]),
  });
  const response = await app.handle(new Request("https://app.test/api/public/vgc-tournaments"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tournaments: [{
      id: "6aee620dc931f53978d951e6",
      name: "Copa M-C",
      date,
      players: 24,
      scheduleStatus: "upcoming",
      url: "https://play.limitlesstcg.com/tournament/6aee620dc931f53978d951e6",
    }],
  });
});
