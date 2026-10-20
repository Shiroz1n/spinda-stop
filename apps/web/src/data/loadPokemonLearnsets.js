import shard00 from "@spinda-stop/data/learnsets/00?url";
import shard01 from "@spinda-stop/data/learnsets/01?url";
import shard02 from "@spinda-stop/data/learnsets/02?url";
import shard03 from "@spinda-stop/data/learnsets/03?url";
import shard04 from "@spinda-stop/data/learnsets/04?url";
import shard05 from "@spinda-stop/data/learnsets/05?url";
import shard06 from "@spinda-stop/data/learnsets/06?url";
import shard07 from "@spinda-stop/data/learnsets/07?url";
import shard08 from "@spinda-stop/data/learnsets/08?url";
import shard09 from "@spinda-stop/data/learnsets/09?url";
import shard10 from "@spinda-stop/data/learnsets/10?url";
import shard11 from "@spinda-stop/data/learnsets/11?url";
import shard12 from "@spinda-stop/data/learnsets/12?url";
import shard13 from "@spinda-stop/data/learnsets/13?url";
import shard14 from "@spinda-stop/data/learnsets/14?url";
import shard15 from "@spinda-stop/data/learnsets/15?url";
import shard16 from "@spinda-stop/data/learnsets/16?url";
import shard17 from "@spinda-stop/data/learnsets/17?url";
import shard18 from "@spinda-stop/data/learnsets/18?url";
import shard19 from "@spinda-stop/data/learnsets/19?url";
import shard20 from "@spinda-stop/data/learnsets/20?url";
import shard21 from "@spinda-stop/data/learnsets/21?url";
import shard22 from "@spinda-stop/data/learnsets/22?url";
import shard23 from "@spinda-stop/data/learnsets/23?url";
import shard24 from "@spinda-stop/data/learnsets/24?url";
import shard25 from "@spinda-stop/data/learnsets/25?url";
import shard26 from "@spinda-stop/data/learnsets/26?url";
import shard27 from "@spinda-stop/data/learnsets/27?url";
import shard28 from "@spinda-stop/data/learnsets/28?url";
import shard29 from "@spinda-stop/data/learnsets/29?url";
import shard30 from "@spinda-stop/data/learnsets/30?url";
import shard31 from "@spinda-stop/data/learnsets/31?url";

const LEARNSET_SHARD_URLS = [
  shard00, shard01, shard02, shard03, shard04, shard05, shard06, shard07,
  shard08, shard09, shard10, shard11, shard12, shard13, shard14, shard15,
  shard16, shard17, shard18, shard19, shard20, shard21, shard22, shard23,
  shard24, shard25, shard26, shard27, shard28, shard29, shard30, shard31,
];
const SHARD_COUNT = LEARNSET_SHARD_URLS.length;
const shardRequests = new Map();

export function loadPokemonLearnsets(pokemonId) {
  const id = Number(pokemonId);
  if (!Number.isSafeInteger(id) || id < 1) return Promise.reject(new Error("Forma sem identificador de catálogo."));
  const shard = id % SHARD_COUNT;
  if (!shardRequests.has(shard)) {
    shardRequests.set(shard, fetch(LEARNSET_SHARD_URLS[shard], { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`PokéAPI respondeu HTTP ${response.status}.`);
        const data = await response.json();
        if (!data?.metadata?.sourceCommit || !data?.pokemonMovesById || !Array.isArray(data.versionGroups) || !Array.isArray(data.methods)) {
          throw new Error("O arquivo de aprendibilidade não corresponde ao catálogo esperado.");
        }
        return data;
      })
      .catch((error) => {
        shardRequests.delete(shard);
        throw error;
      }));
  }
  return shardRequests.get(shard).then((data) => ({
    metadata: data.metadata,
    versionGroups: data.versionGroups,
    methods: data.methods,
    rows: data.pokemonMovesById[id] || [],
  }));
}
