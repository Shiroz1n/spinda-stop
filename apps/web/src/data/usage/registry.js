import { pokemonChampionsBattleDataProvider } from "./providers/pokemonChampionsBattleData.js";
import { metaRollProvider } from "./providers/metaroll.js";

export const usageProviders = Object.freeze({
  "pokemon-champions-battle-data": pokemonChampionsBattleDataProvider,
  metaroll: metaRollProvider,
});
