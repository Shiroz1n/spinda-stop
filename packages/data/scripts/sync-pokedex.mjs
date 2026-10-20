import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POKEAPI_COMMIT = "6fd69dfe90465ba96534f6816fc817737d1f97f6";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_FILE = resolve(PACKAGE_ROOT, "generated/pokedex.json");
const DETAILS_FILE = resolve(PACKAGE_ROOT, "generated/details.json");
const MOVES_FILE = resolve(PACKAGE_ROOT, "generated/moves.json");
const NATURES_FILE = resolve(PACKAGE_ROOT, "generated/natures.json");
const LEARNSETS_DIRECTORY = resolve(PACKAGE_ROOT, "generated/learnsets");
export const LEARNSET_SHARD_COUNT = 32;
const SOURCE_BASE = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv`;
const FILES = [
  "pokemon.csv",
  "pokemon_species.csv",
  "pokemon_stats.csv",
  "pokemon_types.csv",
  "pokemon_forms.csv",
  "pokemon_form_names.csv",
  "pokemon_species_names.csv",
  "pokemon_abilities.csv",
  "abilities.csv",
  "types.csv",
  "stats.csv",
  "moves.csv",
  "move_names.csv",
  "pokemon_moves.csv",
  "version_groups.csv",
  "pokemon_move_methods.csv",
  "natures.csv",
  "nature_names.csv",
];
const LANGUAGE_ENGLISH = "9";
const STAT_KEYS = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((field) => field.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  if (rows.length < 2) return [];

  const [header, ...data] = rows;
  return data.map((fields) => Object.fromEntries(header.map((key, index) => [key, fields[index] ?? ""])));
}

export function buildPokedex(csvByFilename, generatedAt = new Date().toISOString()) {
  const read = (name) => {
    const text = csvByFilename[name];
    if (typeof text !== "string") throw new Error(`CSV ausente: ${name}`);
    return parseCsv(text);
  };

  const species = new Map(read("pokemon_species.csv").map((entry) => [entry.id, entry]));
  const speciesNames = englishNameMap(read("pokemon_species_names.csv"), "pokemon_species_id", "name");
  const formNames = englishNameMap(read("pokemon_form_names.csv"), "pokemon_form_id", "pokemon_name", "form_name");
  const abilityNames = new Map(read("abilities.csv").map((entry) => [entry.id, entry.identifier]));
  const typeNames = new Map(read("types.csv").map((entry) => [entry.id, entry.identifier]));
  const statNames = new Map(read("stats.csv").map((entry) => [entry.id, entry.identifier]));
  const moveNames = englishNameMap(read("move_names.csv"), "move_id", "name");
  const natureNames = englishNameMap(read("nature_names.csv"), "nature_id", "name");

  const statsByPokemon = groupBy(read("pokemon_stats.csv"), "pokemon_id");
  const typesByPokemon = groupBy(read("pokemon_types.csv"), "pokemon_id");
  const formsByPokemon = groupBy(read("pokemon_forms.csv"), "pokemon_id");
  const abilitiesByPokemon = groupBy(read("pokemon_abilities.csv"), "pokemon_id");
  const pokemon = read("pokemon.csv").map((entry) => {
    const speciesEntry = species.get(entry.species_id);
    const form = (formsByPokemon.get(entry.id) ?? []).find((item) => item.is_default === "1")
      ?? (formsByPokemon.get(entry.id) ?? [])[0];
    const localizedForm = form ? formNames.get(form.id) : undefined;
    const speciesName = speciesNames.get(entry.species_id)?.name ?? titleFromSlug(speciesEntry?.identifier ?? entry.identifier);
    const formName = form && form.is_default !== "1"
      ? (localizedForm?.form_name || form.form_identifier || "Alternate form")
      : "";
    const name = form && localizedForm?.pokemon_name
      ? localizedForm.pokemon_name
      : formName
        ? `${speciesName} (${titleFromSlug(formName)})`
        : speciesName;
    const statValues = Object.fromEntries((statsByPokemon.get(entry.id) ?? []).map((item) => [
      STAT_KEYS[statNames.get(item.stat_id)],
      Number(item.base_stat),
    ]).filter(([key]) => Boolean(key)));
    const abilities = (abilitiesByPokemon.get(entry.id) ?? []).map((item) => ({
      name: titleFromSlug(abilityNames.get(item.ability_id) ?? ""),
      hidden: item.is_hidden === "1",
    })).filter((item) => item.name);
    const typeList = (typesByPokemon.get(entry.id) ?? [])
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map((item) => typeNames.get(item.type_id))
      .filter(Boolean);

    return {
      pokemonId: Number(entry.id),
      slug: entry.identifier,
      speciesId: Number(entry.species_id),
      speciesSlug: speciesEntry?.identifier ?? entry.identifier,
      evolvesFromSpeciesId: Number(speciesEntry?.evolves_from_species_id) || null,
      formId: form?.form_identifier || (entry.is_default === "1" ? "default" : entry.identifier),
      name,
      speciesName,
      formName,
      isDefault: entry.is_default === "1",
      isBattleOnly: form?.is_battle_only === "1",
      isMega: form?.is_mega === "1",
      generation: Number(speciesEntry?.generation_id ?? 0),
      order: Number(form?.order ?? entry.order ?? entry.id),
      types: typeList,
      stats: Object.fromEntries(Object.entries(statValues).filter(([, value]) => Number.isFinite(value))),
      abilities,
      height: Number(entry.height),
      weight: Number(entry.weight),
    };
  });

  const moves = read("moves.csv").map((entry) => ({
    id: Number(entry.id),
    slug: entry.identifier,
    name: moveNames.get(entry.id)?.name ?? titleFromSlug(entry.identifier),
    type: typeNames.get(entry.type_id) ?? "unknown",
    power: entry.power ? Number(entry.power) : null,
    accuracy: entry.accuracy ? Number(entry.accuracy) : null,
    category: ({ "1": "status", "2": "physical", "3": "special" })[entry.damage_class_id] ?? "unknown",
  }));
  const natures = read("natures.csv").map((entry) => ({
    slug: entry.identifier,
    name: natureNames.get(entry.id)?.name ?? titleFromSlug(entry.identifier),
  }));
  const types = [...new Set([...typeNames.values()])].sort();

  return {
    metadata: {
      source: "PokéAPI",
      sourceCommit: POKEAPI_COMMIT,
      sourceUrl: `https://github.com/PokeAPI/pokeapi/tree/${POKEAPI_COMMIT}/data/v2/csv`,
      generatedAt,
      speciesCount: new Set(pokemon.map((entry) => entry.speciesId)).size,
      formCount: pokemon.length,
      moveCount: moves.length,
      note: "Dados gerais. Disponibilidade e legalidade no Pokémon Champions não foram verificadas.",
    },
    types,
    pokemon: pokemon.sort((a, b) => a.speciesId - b.speciesId || a.order - b.order || a.pokemonId - b.pokemonId),
    moves: moves.sort((a, b) => a.name.localeCompare(b.name, "en")),
    natures: natures.sort((a, b) => a.name.localeCompare(b.name, "en")),
  };
}

export function toDexIndex(pokemon) {
  return pokemon.map((entry) => ({
    slug: entry.slug,
    spriteId: entry.pokemonId,
    speciesId: entry.speciesId,
    speciesSlug: entry.speciesSlug,
    evolvesFromSpeciesId: entry.evolvesFromSpeciesId,
    formId: entry.formId,
    isDefault: entry.isDefault,
    name: entry.name,
    speciesName: entry.speciesName,
    formName: entry.formName,
    generation: entry.generation,
    types: entry.types,
    stats: Object.fromEntries(["atk", "spa", "spe"].map((key) => [key, entry.stats[key]])),
  }));
}

export function buildPokemonMoveLearnsets(csvByFilename, generatedAt = new Date().toISOString()) {
  const read = (name) => {
    const text = csvByFilename[name];
    if (typeof text !== "string") throw new Error(`CSV ausente: ${name}`);
    return parseCsv(text);
  };

  const moves = new Map(read("moves.csv").map((row) => [row.id, Number(row.id)]));
  const versions = read("version_groups.csv").map((row) => ({
    id: Number(row.id),
    name: row.identifier,
    generation: Number(row.generation_id) || null,
    order: Number(row.order) || Number(row.id),
  }));
  const versionIds = new Set(versions.map((row) => row.id));
  const methods = read("pokemon_move_methods.csv").map((row) => ({ id: Number(row.id), name: row.identifier }));
  const methodIds = new Set(methods.map((row) => row.id));
  const pokemonMovesById = Object.create(null);

  for (const row of read("pokemon_moves.csv")) {
    const pokemonId = Number(row.pokemon_id);
    const moveId = moves.get(row.move_id);
    const versionGroupId = Number(row.version_group_id);
    const methodId = Number(row.pokemon_move_method_id);
    if (!Number.isInteger(pokemonId) || !moveId || !versionIds.has(versionGroupId) || !methodIds.has(methodId)) continue;

    const tuple = [
      moveId,
      versionGroupId,
      methodId,
      Number(row.level) || 0,
      Number(row.order) || 0,
      row.mastery === "1" ? 1 : 0,
    ];
    (pokemonMovesById[pokemonId] ??= []).push(tuple);
  }

  for (const rows of Object.values(pokemonMovesById)) {
    rows.sort((left, right) => left[1] - right[1] || left[2] - right[2] || left[3] - right[3] || left[0] - right[0]);
  }

  return {
    metadata: {
      source: "PokéAPI",
      sourceCommit: POKEAPI_COMMIT,
      sourceUrl: `https://github.com/PokeAPI/pokeapi/tree/${POKEAPI_COMMIT}/data/v2/csv`,
      generatedAt,
      recordCount: Object.values(pokemonMovesById).reduce((count, rows) => count + rows.length, 0),
      pokemonCount: Object.keys(pokemonMovesById).length,
      note: "Aprendibilidade geral por jogo, versão e método. Não confirma compatibilidade nem legalidade no Pokémon Champions.",
    },
    versionGroups: versions.sort((left, right) => left.order - right.order),
    methods: methods.sort((left, right) => left.id - right.id),
    pokemonMovesById,
  };
}

export function shardPokemonMoveLearnsets(learnsets, shardCount = LEARNSET_SHARD_COUNT) {
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    metadata: learnsets.metadata,
    versionGroups: learnsets.versionGroups,
    methods: learnsets.methods,
    pokemonMovesById: Object.create(null),
    shard: index,
  }));

  for (const [pokemonId, rows] of Object.entries(learnsets.pokemonMovesById)) {
    const shardIndex = Number(pokemonId) % shardCount;
    shards[shardIndex].pokemonMovesById[pokemonId] = rows;
  }
  return shards;
}

function englishNameMap(rows, idField, nameField, secondaryField) {
  return new Map(rows.filter((row) => row.local_language_id === LANGUAGE_ENGLISH).map((row) => [
    row[idField],
    { [nameField]: row[nameField], ...(secondaryField ? { [secondaryField]: row[secondaryField] } : {}) },
  ]));
}

function groupBy(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const current = result.get(row[key]) ?? [];
    current.push(row);
    result.set(row[key], current);
  }
  return result;
}

function titleFromSlug(value) {
  return String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadCsv(fileName, sourceDirectory) {
  if (sourceDirectory) return readFile(resolve(sourceDirectory, fileName), "utf8");

  const response = await fetch(`${SOURCE_BASE}/${fileName}`, {
    headers: { accept: "text/csv", "user-agent": "Spinda-Stop/0.1 (+https://github.com/Shiroz1n/spinda-stop)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${fileName}: HTTP ${response.status}`);
  return response.text();
}

async function run() {
  const sourceIndex = process.argv.indexOf("--source-dir");
  const sourceDirectory = sourceIndex >= 0 ? resolve(process.argv[sourceIndex + 1] ?? "") : "";
  const force = process.argv.includes("--force");

  if (!force && !sourceDirectory) {
    try {
      const existing = await Promise.all([GENERATED_FILE, DETAILS_FILE, MOVES_FILE, NATURES_FILE]
        .map(async (file) => JSON.parse(await readFile(file, "utf8"))));
      const learnsetShards = await Promise.all(Array.from({ length: LEARNSET_SHARD_COUNT }, (_, index) =>
        readFile(resolve(LEARNSETS_DIRECTORY, `${String(index).padStart(2, "0")}.json`), "utf8")
          .then((content) => JSON.parse(content))));
      const spriteIndexIsCurrent = Array.isArray(existing[0]?.pokemon)
        && existing[0].pokemon.every((entry) => Number.isInteger(entry.spriteId) && typeof entry.formId === "string");
      if (spriteIndexIsCurrent && existing.every((data) => data.metadata?.sourceCommit === POKEAPI_COMMIT)
        && learnsetShards.every((shard) => shard.metadata?.sourceCommit === POKEAPI_COMMIT)) {
        console.log(`Catálogo local já está na revisão ${POKEAPI_COMMIT.slice(0, 7)}.`);
        return;
      }
    } catch {
      // Primeiro uso: baixar os arquivos da revisão fixa.
    }
  }

  const csvByFilename = {};
  for (const fileName of FILES) {
    csvByFilename[fileName] = await loadCsv(fileName, sourceDirectory);
  }
  const result = buildPokedex(csvByFilename);
  const learnsets = buildPokemonMoveLearnsets(csvByFilename);
  const learnsetShards = shardPokemonMoveLearnsets(learnsets);
  const { pokemon: fullPokemon, moves, natures, ...pokedexData } = result;
  await mkdir(dirname(GENERATED_FILE), { recursive: true });
  await mkdir(LEARNSETS_DIRECTORY, { recursive: true });
  const dexPokemon = toDexIndex(fullPokemon);
  const detailBySlug = Object.fromEntries(fullPokemon.map((entry) => [entry.slug, {
    stats: entry.stats,
    abilities: entry.abilities,
    height: entry.height,
    weight: entry.weight,
  }]));
  await Promise.all([
    writeFile(GENERATED_FILE, `${JSON.stringify({ ...pokedexData, pokemon: dexPokemon })}\n`, "utf8"),
    writeFile(DETAILS_FILE, `${JSON.stringify({ metadata: result.metadata, pokemonBySlug: detailBySlug })}\n`, "utf8"),
    writeFile(MOVES_FILE, `${JSON.stringify({ metadata: result.metadata, moves })}\n`, "utf8"),
    writeFile(NATURES_FILE, `${JSON.stringify({ metadata: result.metadata, natures })}\n`, "utf8"),
    ...learnsetShards.map((shard, index) => writeFile(
      resolve(LEARNSETS_DIRECTORY, `${String(index).padStart(2, "0")}.json`),
      `${JSON.stringify(shard)}\n`,
      "utf8",
    )),
  ]);
  console.log(`Catálogo atualizado: ${result.metadata.speciesCount} espécies, ${result.metadata.formCount} entradas, ${result.metadata.moveCount} golpes e ${learnsets.metadata.recordCount} relações de aprendibilidade.`);
  console.log(`Fonte geral: PokéAPI ${POKEAPI_COMMIT.slice(0, 7)}. Compatibilidade com Pokémon Champions não verificada.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(`Não foi possível gerar o catálogo: ${error.message}`);
    console.error("Confira a conexão e tente novamente com npm run data:sync.");
    process.exitCode = 1;
  });
}
