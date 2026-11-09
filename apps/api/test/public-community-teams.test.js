import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicCommunityTeamsHandler } from "../src/public-community-teams.js";

test("public team search uses a fixed upstream, bounded query, and public-only fields", async () => {
  let requestedUrl;
  const handler = createPublicCommunityTeamsHandler(async (url, options) => {
    requestedUrl = new URL(url);
    assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    assert.equal(options.credentials, undefined);
    return Response.json({ teams: [{
      team_id: "MC781",
      player: "Example player",
      event: "Example Regional",
      rank: "Runner Up",
      date: "2026-11-02",
      source_link: "https://x.com/example/status/1",
      pokepaste: "https://pokepast.es/example",
      paste_text: "must not be returned in list response",
      pokemon: [{ name: "Sneasler", item: "Focus Sash", sprite: "https://untrusted.test/sprite.png" }],
    }] });
  });

  const response = await handler(new Request("https://app.test/api/public/teams?pokemon=Sneasler"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=900, stale-while-revalidate=3600");
  assert.equal(requestedUrl.origin, "https://www.munchstats.com");
  assert.equal(requestedUrl.pathname, "/teams/api/champions-mc/");
  assert.deepEqual(Object.fromEntries(requestedUrl.searchParams), { q: "Sneasler", offset: "0", limit: "6", sort: "newest" });
  assert.deepEqual(await response.json(), {
    teams: [{
      id: "MC781",
      player: "Example player",
      event: "Example Regional",
      placement: "Runner Up",
      date: "2026-11-02",
      sourceUrl: "https://x.com/example/status/1",
      pasteUrl: "https://pokepast.es/example",
      pokemon: [{ name: "Sneasler", item: "Focus Sash" }],
    }],
  });
});

test("invalid searches and paste IDs are rejected before outbound requests", async () => {
  let requests = 0;
  const handler = createPublicCommunityTeamsHandler(async () => { requests += 1; return Response.json({}); });

  assert.equal((await handler(new Request("https://app.test/api/public/teams?pokemon=x"))).status, 400);
  assert.equal((await handler(new Request("https://app.test/api/public/teams?pokemon=not-a-pokemon"))).status, 400);
  assert.equal((await handler(new Request("https://app.test/api/public/teams?pokemon=" + "a".repeat(81)))).status, 400);
  assert.equal((await handler(new Request("https://app.test/api/public/teams/not-an-id/paste"))).status, 400);
  assert.equal(requests, 0);
});

test("paste fetch validates the fixed ID and limits returned text", async () => {
  let requestedUrl;
  const handler = createPublicCommunityTeamsHandler(async (url) => {
    requestedUrl = new URL(url);
    return Response.json({ text: "Sneasler @ Focus Sash\n- Close Combat", url: "https://pokepast.es/example" });
  });

  const response = await handler(new Request("https://app.test/api/public/teams/MC781/paste"));
  assert.equal(requestedUrl.href, "https://www.munchstats.com/teams/api/champions-mc/paste/MC781");
  assert.deepEqual(await response.json(), { text: "Sneasler @ Focus Sash\n- Close Combat", sourceUrl: "https://pokepast.es/example" });
});

test("paste text is limited by its UTF-8 byte length", async () => {
  const handler = createPublicCommunityTeamsHandler(async () => Response.json({ text: "é".repeat(70_000) }));
  const response = await handler(new Request("https://app.test/api/public/teams/MC781/paste"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: { code: "public_team_unavailable", message: "O paste público não está disponível agora." },
  });
});

test("missing pastes are negatively cached without exposing upstream responses", async () => {
  let now = 10_000;
  let requests = 0;
  const handler = createPublicCommunityTeamsHandler(async () => {
    requests += 1;
    return new Response("", { status: 404 });
  }, { now: () => now });

  const first = await handler(new Request("https://app.test/api/public/teams/MC781/paste"));
  assert.equal(first.status, 404);
  assert.equal(first.headers.get("cache-control"), "public, max-age=10, s-maxage=30, stale-while-revalidate=30");
  assert.deepEqual(await first.json(), {
    error: { code: "public_team_not_found", message: "Esta equipe não publicou um paste disponível." },
  });
  assert.equal((await handler(new Request("https://app.test/api/public/teams/MC781/paste"))).status, 404);
  assert.equal(requests, 1);

  now += 30_001;
  await handler(new Request("https://app.test/api/public/teams/MC781/paste"));
  assert.equal(requests, 2);
});

test("upstream failures and unexpected payloads do not expose provider details", async () => {
  const handler = createPublicCommunityTeamsHandler(async () => new Response("private upstream detail", { status: 503 }));
  const response = await handler(new Request("https://app.test/api/public/teams?pokemon=Sneasler"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: { code: "public_teams_unavailable", message: "As equipes públicas não estão disponíveis agora." },
  });
});
