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
