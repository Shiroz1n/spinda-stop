export const calculatorTestTeam = {
  schemaVersion: 1,
  name: "Fixture de cálculo · PokéAPI SV",
  format: "doubles",
  rulesetId: "champions-doubles-draft",
  members: [
    { pokemonId: "garchomp", speciesId: 445, speciesSlug: "garchomp", formId: "default", formSlug: "garchomp", ability: "Rough Skin", item: "Clear Amulet", nature: "Jolly", level: 50, moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Protect"], statPoints: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 } },
    { pokemonId: "arboliva", speciesId: 930, speciesSlug: "arboliva", formId: "default", formSlug: "arboliva", ability: "Seed Sower", item: "Leftovers", nature: "Calm", level: 50, moves: ["Energy Ball", "Dazzling Gleam", "Earth Power", "Protect"], statPoints: { hp: 22, atk: 0, def: 16, spa: 0, spd: 28, spe: 0 } },
    { pokemonId: "incineroar", speciesId: 727, speciesSlug: "incineroar", formId: "default", formSlug: "incineroar", ability: "Intimidate", item: "Life Orb", nature: "Impish", level: 50, moves: ["Flare Blitz", "Fake Out", "Parting Shot", "Knock Off"], statPoints: { hp: 32, atk: 0, def: 16, spa: 0, spd: 18, spe: 0 } },
    { pokemonId: "rillaboom", speciesId: 812, speciesSlug: "rillaboom", formId: "default", formSlug: "rillaboom", ability: "Grassy Surge", item: "Sitrus Berry", nature: "Adamant", level: 50, moves: ["Grassy Glide", "Wood Hammer", "U-turn", "Protect"], statPoints: { hp: 4, atk: 32, def: 0, spa: 0, spd: 0, spe: 30 } },
    { pokemonId: "charizard", speciesId: 6, speciesSlug: "charizard", formId: "default", formSlug: "charizard", ability: "Solar Power", item: "Life Orb", nature: "Timid", level: 50, moves: ["Heat Wave", "Air Slash", "Dragon Claw", "Protect"], statPoints: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } },
    { pokemonId: "pelipper", speciesId: 279, speciesSlug: "pelipper", formId: "default", formSlug: "pelipper", ability: "Drizzle", item: "Focus Sash", nature: "Bold", level: 50, moves: ["Hurricane", "Hydro Pump", "Tailwind", "Protect"], statPoints: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 } },
  ],
};

export const calculatorTestPokemonIndex = calculatorTestTeam.members.map((member) => ({
  slug: member.pokemonId,
  speciesId: member.speciesId,
  speciesSlug: member.speciesSlug,
  formId: member.formId,
}));

export const calculatorTestSource = {
  pokemon: "PokéAPI v2 CSV, pinned commit 6fd69dfe90465ba96534f6816fc817737d1f97f6",
  moveVersion: "Scarlet / Violet",
  moveMethod: "Pokemon moves by exact Pokémon form ID, version group, and learning method",
  generalMoveAndAbilitySupport: "@smogon/calc 0.12.0 catalog; this is engine support, not Champions move legality",
  naturesAndStatPoints: "Explicit test scenario inputs, not inferred from usage data",
  items: "Engine catalog when supported; Clear Amulet is recognized by the Generation 9 general item catalog but is absent from the Champions subset",
  championsSetLegality: "Not verified",
};
