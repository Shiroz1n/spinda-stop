import test from "node:test";
import assert from "node:assert/strict";
import {
  createPokemonSpriteLookup,
  itemSpriteUrl,
  POKEAPI_SPRITES_BASE,
  POKEAPI_HOME_FORM_SPRITES,
  resolvePokemonSpriteUrl,
  resolveCompetitivePokemonSprite,
  typeIconUrl,
} from "../src/data/pokemonSprites.js";

const catalog = [
  { slug: "charizard", speciesSlug: "charizard", speciesName: "Charizard", name: "Charizard", speciesId: 6, spriteId: 6, formId: "default", isDefault: true },
  { slug: "charizard-mega-x", speciesSlug: "charizard", speciesName: "Charizard", name: "Mega Charizard X", speciesId: 6, spriteId: 10034, formId: "mega-x", isDefault: false },
  { slug: "raichu", speciesSlug: "raichu", speciesName: "Raichu", name: "Raichu", speciesId: 26, spriteId: 26, formId: "default", isDefault: true },
  { slug: "raichu-alola", metarollId: "alolan-raichu", speciesSlug: "raichu", speciesName: "Raichu", name: "Raichu Alola", speciesId: 26, spriteId: 10100, formId: "alola", isDefault: false },
  { slug: "tauros", speciesSlug: "tauros", speciesName: "Tauros", name: "Tauros", speciesId: 128, spriteId: 128, formId: "default", isDefault: true },
  { slug: "tauros-paldea-aqua-breed", speciesSlug: "tauros", speciesName: "Tauros", name: "Paldean Tauros (Aqua Breed)", speciesId: 128, spriteId: 10252, formId: "paldea-aqua-breed", isDefault: false },
];

test("sprite lookup keeps Mega and regional forms separate from base species", () => {
  const lookup = createPokemonSpriteLookup(catalog);

  assert.equal(lookup("charizard")?.slug, "charizard");
  assert.equal(lookup("charizardmegax")?.slug, "charizard-mega-x");
  assert.equal(lookup("Mega Charizard X")?.slug, "charizard-mega-x");
  assert.equal(lookup("raichualola")?.slug, "raichu-alola");
  assert.equal(lookup("Alolan Raichu")?.slug, "raichu-alola");
  assert.equal(lookup("alolan-raichu")?.slug, "raichu-alola");
  assert.equal(lookup(10100)?.slug, "raichu-alola");
});

test("an alternate form without its own sprite ID has no base-form fallback", () => {
  assert.equal(resolvePokemonSpriteUrl({ speciesId: 6, formId: "mega-x" }), null);
  assert.equal(resolvePokemonSpriteUrl({ speciesId: 6, spriteId: 10034, formId: "mega-x" }), `${POKEAPI_SPRITES_BASE}/pokemon/other/showdown/10034.gif`);
  assert.equal(resolvePokemonSpriteUrl({ speciesId: 6, formId: "default" }), `${POKEAPI_SPRITES_BASE}/pokemon/versions/generation-v/black-white/6.png`);
});

test("all 49 catalogued Legends: Z-A Megas map to exact pinned PokeAPI HOME assets", () => {
  for (const [slug, file] of Object.entries(POKEAPI_HOME_FORM_SPRITES)) {
    assert.equal(
      resolvePokemonSpriteUrl({ slug, speciesId: 445, spriteId: Number.parseInt(file, 10), formId: "mega", isDefault: false }),
      `${POKEAPI_SPRITES_BASE}/pokemon/other/home/${file}`,
    );
  }
  assert.equal(Object.keys(POKEAPI_HOME_FORM_SPRITES).length, 49);
  assert.equal(POKEAPI_HOME_FORM_SPRITES["garchomp-mega-z"], "10309.png");
  assert.equal(POKEAPI_HOME_FORM_SPRITES["absol-mega-z"], "10307.png");
  assert.equal(POKEAPI_HOME_FORM_SPRITES["lucario-mega-z"], "10310.png");
});

test("Mega Raichu X and Y use their exact pinned PokeAPI HOME sprites", () => {
  assert.equal(POKEAPI_HOME_FORM_SPRITES["raichu-mega-x"], "10304.png");
  assert.equal(POKEAPI_HOME_FORM_SPRITES["raichu-mega-y"], "10305.png");
  assert.equal(
    resolvePokemonSpriteUrl({ slug: "raichu-mega-x", speciesId: 26, spriteId: 10304, formId: "mega-x", isDefault: false }),
    `${POKEAPI_SPRITES_BASE}/pokemon/other/home/10304.png`,
  );
  assert.equal(
    resolvePokemonSpriteUrl({ slug: "raichu-mega-y", speciesId: 26, spriteId: 10305, formId: "mega-y", isDefault: false }),
    `${POKEAPI_SPRITES_BASE}/pokemon/other/home/10305.png`,
  );
});

test("base forms after the Black and White roster use their own Showdown sprite IDs", () => {
  const url = resolvePokemonSpriteUrl({ speciesId: 1000, spriteId: 1000, formId: "default" });
  assert.match(url, /pokemon\/other\/showdown\/1000\.gif$/);
});

test("a descriptive form name wins when a provider ID collapses it to the base species", () => {
  const lookup = createPokemonSpriteLookup(catalog);
  assert.equal(
    resolveCompetitivePokemonSprite(lookup, { id: "raichu", name: "Alolan Raichu" })?.slug,
    "raichu-alola",
  );
  assert.equal(
    resolveCompetitivePokemonSprite(lookup, { id: "raichualola", name: "Raichu" })?.slug,
    "raichu-alola",
  );
});

test("Showdown and MetaRoll Paldean Tauros IDs resolve to the exact breed", () => {
  const lookup = createPokemonSpriteLookup(catalog);
  const expected = "tauros-paldea-aqua-breed";

  assert.equal(lookup("taurospaldeaaqua")?.slug, expected);
  assert.equal(lookup("tauros-paldea-aqua")?.slug, expected);
  assert.equal(
    resolveCompetitivePokemonSprite(lookup, { id: "tauros-paldea-aqua", name: "Tauros-Paldea-Aqua" })?.slug,
    expected,
  );
  assert.equal(lookup("tauros")?.slug, "tauros");
});

test("type and item assets point to the pinned PokeAPI sprite revision", () => {
  assert.equal(typeIconUrl("fire"), `${POKEAPI_SPRITES_BASE}/types/generation-ix/champions/small/10.png`);
  assert.equal(typeIconUrl("FIRE"), typeIconUrl("fire"));
  assert.equal(typeIconUrl("shadow"), null);
  assert.equal(itemSpriteUrl("Clear Amulet"), `${POKEAPI_SPRITES_BASE}/items/clear-amulet.png`);
});
