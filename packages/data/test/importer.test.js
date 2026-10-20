import test from "node:test";
import assert from "node:assert/strict";
import { buildPokedex, buildPokemonMoveLearnsets, parseCsv, POKEAPI_COMMIT, shardPokemonMoveLearnsets, toDexIndex } from "../scripts/sync-pokedex.mjs";

test("parses quoted commas, escaped quotes, and line breaks", () => {
  const rows = parseCsv('id,name,description\r\n1,"Mr. Mime","line one,\nline ""two"""\r\n');
  assert.equal(rows[0].name, "Mr. Mime");
  assert.equal(rows[0].description, 'line one,\nline "two"');
});

test("builds separate species and form identifiers from source CSVs", () => {
  const csv = {
    "pokemon.csv": "id,identifier,species_id,order,is_default,height,weight\n25,pikachu,25,35,1,4,60\n10081,raichu-alola,26,999,0,8,210\n",
    "pokemon_species.csv": "id,identifier,generation_id,evolves_from_species_id\n25,pikachu,1,\n26,raichu,1,\n",
    "pokemon_species_names.csv": "pokemon_species_id,local_language_id,name,genus\n25,9,Pikachu,Mouse\n26,9,Raichu,Mouse\n",
    "pokemon_stats.csv": "pokemon_id,stat_id,base_stat,effort\n25,1,35,0\n25,2,55,0\n25,3,40,0\n25,4,50,0\n25,5,50,0\n25,6,90,2\n",
    "pokemon_types.csv": "pokemon_id,type_id,slot\n25,13,1\n10081,13,1\n10081,14,2\n",
    "pokemon_forms.csv": "id,identifier,form_identifier,pokemon_id,is_default,is_battle_only,is_mega,order\n25,pikachu,,25,1,0,0,35\n10081,raichu-alola,alola,10081,0,0,0,999\n",
    "pokemon_form_names.csv": "pokemon_form_id,local_language_id,form_name,pokemon_name\n10081,9,Alola Form,Raichu Alola\n",
    "pokemon_abilities.csv": "pokemon_id,ability_id,is_hidden,slot\n25,9,0,1\n",
    "abilities.csv": "id,identifier\n9,static\n",
    "types.csv": "id,identifier\n13,electric\n14,psychic\n",
    "stats.csv": "id,identifier\n1,hp\n2,attack\n3,defense\n4,special-attack\n5,special-defense\n6,speed\n",
    "moves.csv": "id,identifier,type_id,power,accuracy,damage_class_id\n1,thunderbolt,13,90,100,3\n",
    "move_names.csv": "move_id,local_language_id,name\n1,9,Thunderbolt\n",
    "natures.csv": "id,identifier\n1,hardy\n",
    "nature_names.csv": "nature_id,local_language_id,name\n1,9,Hardy\n",
  };
  const result = buildPokedex(csv, "2026-10-18T00:00:00.000Z");
  assert.equal(result.metadata.sourceCommit, POKEAPI_COMMIT);
  assert.equal(result.metadata.speciesCount, 2);
  assert.equal(result.pokemon[0].formId, "default");
  const alolanRaichu = result.pokemon.find((entry) => entry.slug === "raichu-alola");
  assert.equal(alolanRaichu.speciesId, 26);
  assert.equal(alolanRaichu.formId, "alola");
  assert.equal(alolanRaichu.pokemonId, 10081);
  assert.equal(alolanRaichu.evolvesFromSpeciesId, null);
  assert.equal(alolanRaichu.name, "Raichu Alola");
  assert.deepEqual(alolanRaichu.types, ["electric", "psychic"]);
  assert.equal(result.moves[0].name, "Thunderbolt");

  const index = toDexIndex(result.pokemon);
  assert.deepEqual(index.map((entry) => [entry.slug, entry.spriteId, entry.formId]), [
    ["pikachu", 25, "default"],
    ["raichu-alola", 10081, "alola"],
  ]);
  assert.equal(index[1].isDefault, false);
});

test("preserves evolution parent by species and exact-form identity in the Dex index", () => {
  const csv = {
    "pokemon.csv": "id,identifier,species_id,order,is_default,height,weight\n25,pikachu,25,35,1,4,60\n26,raichu,26,36,1,8,300\n10081,raichu-alola,26,999,0,8,210\n",
    "pokemon_species.csv": "id,identifier,generation_id,evolves_from_species_id\n25,pikachu,1,\n26,raichu,1,25\n",
    "pokemon_species_names.csv": "pokemon_species_id,local_language_id,name,genus\n25,9,Pikachu,Mouse\n26,9,Raichu,Mouse\n",
    "pokemon_stats.csv": "pokemon_id,stat_id,base_stat,effort\n25,1,35,0\n26,1,60,0\n10081,1,60,0\n",
    "pokemon_types.csv": "pokemon_id,type_id,slot\n25,13,1\n26,13,1\n10081,13,1\n10081,14,2\n",
    "pokemon_forms.csv": "id,identifier,form_identifier,pokemon_id,is_default,is_battle_only,is_mega,order\n25,pikachu,,25,1,0,0,35\n26,raichu,,26,1,0,0,36\n10081,raichu-alola,alola,10081,0,0,0,999\n",
    "pokemon_form_names.csv": "pokemon_form_id,local_language_id,form_name,pokemon_name\n10081,9,Alola Form,Raichu Alola\n",
    "pokemon_abilities.csv": "pokemon_id,ability_id,is_hidden,slot\n25,9,0,1\n26,9,0,1\n10081,9,0,1\n",
    "abilities.csv": "id,identifier\n9,static\n",
    "types.csv": "id,identifier\n13,electric\n14,psychic\n",
    "stats.csv": "id,identifier\n1,hp\n",
    "moves.csv": "id,identifier,type_id,power,accuracy,damage_class_id\n1,thunderbolt,13,90,100,3\n",
    "move_names.csv": "move_id,local_language_id,name\n1,9,Thunderbolt\n",
    "natures.csv": "id,identifier\n1,hardy\n",
    "nature_names.csv": "nature_id,local_language_id,name\n1,9,Hardy\n",
  };
  const result = buildPokedex(csv);
  const index = toDexIndex(result.pokemon);
  assert.equal(index.find((entry) => entry.slug === "raichu-alola").evolvesFromSpeciesId, 25);
  assert.equal(index.find((entry) => entry.slug === "raichu").evolvesFromSpeciesId, 25);
});

test("builds form-specific move learnsets with separate game version and learning method", () => {
  const csv = {
    "moves.csv": "id,identifier\n1,thunderbolt\n2,thunder-wave\n",
    "version_groups.csv": "id,identifier,generation_id,order\n25,scarlet-violet,9,25\n26,legends-za,9,26\n",
    "pokemon_move_methods.csv": "id,identifier\n1,level-up\n4,machine\n",
    "pokemon_moves.csv": "pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order,mastery\n10081,25,1,4,,1,\n10081,25,2,1,18,2,\n10081,26,1,1,12,1,1\n",
  };
  const learnsets = buildPokemonMoveLearnsets(csv, "2026-10-20T00:00:00.000Z");

  assert.equal(learnsets.metadata.sourceCommit, POKEAPI_COMMIT);
  assert.equal(learnsets.metadata.recordCount, 3);
  assert.deepEqual(learnsets.versionGroups.map(({ name }) => name), ["scarlet-violet", "legends-za"]);
  assert.deepEqual(learnsets.pokemonMovesById["10081"], [
    [2, 25, 1, 18, 2, 0],
    [1, 25, 4, 0, 1, 0],
    [1, 26, 1, 12, 1, 1],
  ]);
  assert.equal(learnsets.pokemonMovesById["26"], undefined);
  const shards = shardPokemonMoveLearnsets(learnsets, 4);
  assert.deepEqual(shards.map((shard) => shard.shard), [0, 1, 2, 3]);
  assert.deepEqual(shards[1].pokemonMovesById["10081"], learnsets.pokemonMovesById["10081"]);
  assert.equal(shards[2].pokemonMovesById["10081"], undefined);
  assert.equal(shards[1].metadata.sourceCommit, POKEAPI_COMMIT);
});
