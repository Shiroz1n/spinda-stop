import test from "node:test";
import assert from "node:assert/strict";
import { parseSpeedTiersRoute, serializeSpeedTiersRoute } from "../src/pages/speedTiersRoute.js";

const routeOptions = { availableRegulations: ["M-A", "M-C"], pokemonSlugs: ["corviknight", "charizard-mega-y"] };

test("Speed Tiers restores model, valid regulation, Mega filter, sort and target from the URL", () => {
  const restored = parseSpeedTiersRoute("?model=standard&regulation=M-A&megas=0&sort=slowest&target=charizard-mega-y", routeOptions);
  assert.deepEqual(restored, {
    model: "standard",
    regulation: "M-A",
    includeMegas: false,
    sort: "slowest",
    targetSlug: "charizard-mega-y",
    targetQuery: "",
    candidate: { nature: "Serious", sp: 0, level: 50, iv: 31, ev: 0, tailwind: false, choiceScarf: false },
    target: { nature: "Serious", sp: 0, level: 50, iv: 31, ev: 0, tailwind: false, choiceScarf: false },
    trickRoom: false,
  });
});

test("Speed Tiers defaults to Champions and the newest available regulation without inventing one", () => {
  assert.deepEqual(parseSpeedTiersRoute("?model=unknown&regulation=M-Z&sort=random&target=missing", routeOptions), {
    model: "champions",
    regulation: "M-C",
    includeMegas: true,
    sort: "fastest",
    targetSlug: "",
    targetQuery: "",
    candidate: { nature: "Serious", sp: 0, level: 50, iv: 31, ev: 0, tailwind: false, choiceScarf: false },
    target: { nature: "Serious", sp: 0, level: 50, iv: 31, ev: 0, tailwind: false, choiceScarf: false },
    trickRoom: false,
  });
  assert.equal(parseSpeedTiersRoute("", { availableRegulations: ["M-B"] }).regulation, "M-B");
  assert.equal(parseSpeedTiersRoute("", { availableRegulations: [] }).regulation, "");
});

test("Speed Tiers keeps a valid target when its regulation or Mega filter hides it", () => {
  const restored = parseSpeedTiersRoute("?regulation=M-A&megas=0&target=charizard-mega-y", routeOptions);
  assert.equal(restored.targetSlug, "charizard-mega-y");
  assert.equal(restored.includeMegas, false);
});

test("Speed Tiers serializes route state consistently and omits unavailable regulations", () => {
  const search = serializeSpeedTiersRoute({
    model: "standard",
    regulation: "M-Z",
    includeMegas: false,
    sort: "slowest",
    targetSlug: "",
    targetQuery: "Mega Charizard Y",
  }, ["M-C"]);
  const parsed = parseSpeedTiersRoute(`?${search}`, { availableRegulations: ["M-C"] });
  assert.equal(parsed.model, "standard");
  assert.equal(parsed.regulation, "M-C");
  assert.equal(parsed.includeMegas, false);
  assert.equal(parsed.sort, "slowest");
  assert.equal(parsed.targetQuery, "Mega Charizard Y");
});

test("Speed Tiers round-trips settings needed to reopen a comparison", () => {
  const settings = {
    model: "champions", regulation: "M-C", includeMegas: true, sort: "slowest", targetSlug: "corviknight",
    candidate: { nature: "Timid", sp: 28, level: 50, iv: 31, ev: 0, tailwind: true, choiceScarf: false },
    target: { nature: "Bold", sp: 12, level: 50, iv: 31, ev: 0, tailwind: false, choiceScarf: false },
    trickRoom: true,
  };
  const parsed = parseSpeedTiersRoute(`?${serializeSpeedTiersRoute(settings, ["M-C"])}`, routeOptions);
  assert.deepEqual(parsed.candidate, settings.candidate);
  assert.deepEqual(parsed.target, settings.target);
  assert.equal(parsed.trickRoom, true);
});
