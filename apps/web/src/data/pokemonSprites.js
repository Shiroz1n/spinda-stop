export const POKEAPI_SPRITES_REVISION = "7a7d66b1620e646f69afd48dc1273da9033ede9c";
export const POKEAPI_SPRITES_BASE = `https://raw.githubusercontent.com/PokeAPI/sprites/${POKEAPI_SPRITES_REVISION}/sprites`;
export const SHOWDOWN_FORM_SPRITES_BASE = "https://play.pokemonshowdown.com/sprites/gen5";

// The numeric files for these recently added forms are absent from the pinned
// PokeAPI sprite tree. Each key is an exact PokéAPI form slug; none falls back
// to the base species image.
export const SHOWDOWN_FORM_SPRITES = Object.freeze({
  "absol-mega-z": "absol-megaz.png",
  "baxcalibur-mega": "baxcalibur-mega.png",
  "chandelure-mega": "chandelure-mega.png",
  "chesnaught-mega": "chesnaught-mega.png",
  "chimecho-mega": "chimecho-mega.png",
  "crabominable-mega": "crabominable-mega.png",
  "dragonite-mega": "dragonite-mega.png",
  "delphox-mega": "delphox-mega.png",
  "drampa-mega": "drampa-mega.png",
  "emboar-mega": "emboar-mega.png",
  "excadrill-mega": "excadrill-mega.png",
  "feraligatr-mega": "feraligatr-mega.png",
  "floette-mega": "floette-mega.png",
  "froslass-mega": "froslass-mega.png",
  "garchomp-mega-z": "garchomp-megaz.png",
  "glimmora-mega": "glimmora-mega.png",
  "golisopod-mega": "golisopod-mega.png",
  "golurk-mega": "golurk-mega.png",
  "greninja-mega": "greninja-mega.png",
  "hawlucha-mega": "hawlucha-mega.png",
  "lucario-mega-z": "lucario-megaz.png",
  "meganium-mega": "meganium-mega.png",
  "meowstic-male-mega": "meowstic-mmega.png",
  "meowstic-female-mega": "meowstic-fmega.png",
  "scovillain-mega": "scovillain-mega.png",
  "skarmory-mega": "skarmory-mega.png",
  "starmie-mega": "starmie-mega.png",
});

const TYPE_IDS = Object.freeze({
  normal: 1,
  fighting: 2,
  flying: 3,
  poison: 4,
  ground: 5,
  rock: 6,
  bug: 7,
  ghost: 8,
  steel: 9,
  fire: 10,
  water: 11,
  grass: 12,
  electric: 13,
  psychic: 14,
  ice: 15,
  dragon: 16,
  dark: 17,
  fairy: 18,
  stellar: 19,
});

function toId(value) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formAliases(entry) {
  const aliases = [entry.slug, entry.name];
  const form = toId(entry.formId);
  const species = toId(entry.speciesSlug || entry.speciesName);
  if (!species || !form || form === "default") return aliases;

  if (form.startsWith("mega")) aliases.push(`${species}${form}`);
  if (form === "mega") aliases.push(`${species}mega`);
  const regionalForm = form.match(/^(alola|galar|hisui|paldea)(.*)$/);
  const region = regionalForm?.[1];
  if (region) {
    const regionalAdjective = ({ alola: "alolan", galar: "galarian", hisui: "hisuian", paldea: "paldean" })[region];
    const qualifier = regionalForm[2]?.replace(/breed$/, "");
    if (qualifier) {
      // Showdown and MetaRoll omit PokeAPI's "-breed" suffix for Paldean Tauros.
      aliases.push(`${species}${region}${qualifier}`);
      aliases.push(`${regionalAdjective}${species}${qualifier}`);
    } else {
      aliases.push(`${species}${region}`);
      aliases.push(`${regionalAdjective}${species}`);
    }
  }
  return aliases;
}

export function createPokemonSpriteLookup(catalog) {
  const lookup = new Map();
  const add = (alias, entry) => {
    const key = toId(alias);
    if (key && !lookup.has(key)) lookup.set(key, entry);
  };

  for (const entry of catalog || []) {
    add(entry.slug, entry);
    add(entry.name, entry);
    if (entry.showdownId) add(entry.showdownId, entry);
    if (entry.metarollId) add(entry.metarollId, entry);
    if (entry.spriteId) add(entry.spriteId, entry);
    for (const alias of formAliases(entry)) add(alias, entry);
    if (entry.formId === "default" || entry.isDefault === true) {
      add(entry.speciesSlug, entry);
      add(entry.speciesName, entry);
    }
  }

  return (reference) => lookup.get(toId(reference)) || null;
}

export function resolveCompetitivePokemonSprite(lookup, { id, name }) {
  const byId = lookup(id);
  const byName = lookup(name);
  if (byName?.isDefault === false && byId?.isDefault === true) return byName;
  return byId || byName || null;
}

export function resolvePokemonSpriteUrl(pokemon) {
  if (!pokemon || typeof pokemon !== "object") return null;
  const exactFormAsset = SHOWDOWN_FORM_SPRITES[pokemon.slug];
  if (exactFormAsset) return `${SHOWDOWN_FORM_SPRITES_BASE}/${exactFormAsset}`;
  const isDefault = pokemon.formId === "default" || pokemon.isDefault === true;
  const spriteId = Number(pokemon.spriteId);

  const speciesId = Number(pokemon.speciesId);
  if (isDefault && Number.isInteger(speciesId) && speciesId > 0 && speciesId <= 649) {
    return `${POKEAPI_SPRITES_BASE}/pokemon/versions/generation-v/black-white/${speciesId}.png`;
  }

  // The Black/White collection ends at National Dex 649. Later base species
  // use their own PokeAPI ID in the Showdown collection instead of a broken URL.
  if (!Number.isInteger(spriteId) || spriteId < 1) return null;
  return `${POKEAPI_SPRITES_BASE}/pokemon/other/showdown/${spriteId}.gif`;
}

export function typeIconUrl(type) {
  const id = TYPE_IDS[toId(type)];
  return id ? `${POKEAPI_SPRITES_BASE}/types/generation-ix/champions/small/${id}.png` : null;
}

export function itemSpriteUrl(itemName) {
  const slug = typeof itemName === "string"
    ? itemName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";
  return slug ? `${POKEAPI_SPRITES_BASE}/items/${slug}.png` : null;
}

export const POKEMON_SPRITE_REFERENCE = Object.freeze({
  name: "Spinda",
  slug: "spinda",
  speciesSlug: "spinda",
  speciesId: 327,
  spriteId: 327,
  formId: "default",
});
