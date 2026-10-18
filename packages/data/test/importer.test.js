import test from "node:test";
import assert from "node:assert/strict";
import { buildPokedex, parseCsv, POKEAPI_COMMIT } from "../scripts/sync-pokedex.mjs";

test("parses quoted commas, escaped quotes, and line breaks", () => {
  const rows = parseCsv('id,name,description\r\n1,"Mr. Mime","line one,\nline ""two"""\r\n');
  assert.equal(rows[0].name, "Mr. Mime");
  assert.equal(rows[0].description, 'line one,\nline "two"');
});

test("builds separate species and form identifiers from source CSVs", () => {
  const csv = {
    "pokemon.csv": "id,identifier,species_id,order,is_default,height,weight\n25,pikachu,25,35,1,4,60\n10081,raichu-alola,26,999,0,8,210\n",
    "pokemon_species.csv": "id,identifier,generation_id\n25,pikachu,1\n26,raichu,1\n",
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
  assert.equal(alolanRaichu.name, "Raichu Alola");
  assert.deepEqual(alolanRaichu.types, ["electric", "psychic"]);
  assert.equal(result.moves[0].name, "Thunderbolt");
});
