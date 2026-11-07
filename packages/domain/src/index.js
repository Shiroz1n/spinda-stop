const TEAM_SCHEMA_VERSION = 1;
const MAX_IMPORT_BYTES = 128 * 1024;
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

export function createEmptyTeam() {
  return {
    schemaVersion: TEAM_SCHEMA_VERSION,
    name: "Meu time",
    format: "doubles",
    rulesetId: "champions-doubles-draft",
    members: Array(6).fill(null),
  };
}

export function createTeamMember(pokemon) {
  return {
    pokemonId: pokemon.slug,
    speciesId: pokemon.speciesId,
    speciesSlug: pokemon.speciesSlug,
    formId: pokemon.formId,
    formSlug: pokemon.slug,
    ability: pokemon.abilities?.[0]?.name ?? "",
    item: "",
    nature: "",
    level: 50,
    moves: ["", "", "", ""],
    statPoints: Object.fromEntries(STAT_KEYS.map((key) => [key, 0])),
  };
}

export function setTeamMember(team, slot, pokemon) {
  if (!pokemon || !Number.isInteger(slot) || slot < 0 || slot >= team.members.length) return team;
  if (team.members[slot]?.pokemonId === pokemon.slug) return team;

  const members = [...team.members];
  members[slot] = createTeamMember(pokemon);
  return { ...team, members };
}

export function addPokemonToDraft(team, pokemon) {
  if (!pokemon) return { team, selectedSlot: 0, status: "missing" };

  const existingSlot = team.members.findIndex((member) => member?.pokemonId === pokemon.slug);
  if (existingSlot >= 0) {
    return { team, selectedSlot: existingSlot, status: "existing" };
  }

  const emptySlot = team.members.findIndex((member) => member === null);
  if (emptySlot < 0) return { team, selectedSlot: 0, status: "full" };

  const members = [...team.members];
  members[emptySlot] = createTeamMember(pokemon);
  return {
    team: { ...team, members },
    selectedSlot: emptySlot,
    status: "added",
  };
}

export function searchPokemon(pokemon, query = "", filters = {}) {
  const normalizedQuery = normalizeText(query.trim());
  const { type = "", generation = "" } = filters;
  const minimumBaseStatTotal = optionalNumber(filters.minimumBaseStatTotal);
  const maximumBaseStatTotal = optionalNumber(filters.maximumBaseStatTotal);

  return pokemon.filter((entry) => {
    const matchesQuery = !normalizedQuery || normalizeText([
      entry.name,
      entry.speciesName,
      entry.slug,
      entry.formName,
      String(entry.speciesId),
    ].filter(Boolean).join(" ")).includes(normalizedQuery);
    const matchesType = !type || entry.types.includes(type);
    const matchesGeneration = !generation || String(entry.generation) === String(generation);
    const baseStatTotal = getBaseStatTotal(entry);
    const matchesMinimumTotal = minimumBaseStatTotal === null || (baseStatTotal !== null && baseStatTotal >= minimumBaseStatTotal);
    const matchesMaximumTotal = maximumBaseStatTotal === null || (baseStatTotal !== null && baseStatTotal <= maximumBaseStatTotal);
    return matchesQuery && matchesType && matchesGeneration && matchesMinimumTotal && matchesMaximumTotal;
  });
}

export function sortPokemon(pokemon, sort = "number") {
  return pokemon.map((entry, index) => ({ entry, index })).sort((left, right) => {
    const leftTotal = getBaseStatTotal(left.entry);
    const rightTotal = getBaseStatTotal(right.entry);
    const byNumber = Number(left.entry.speciesId) - Number(right.entry.speciesId)
      || Number(left.entry.order ?? left.entry.spriteId ?? left.entry.pokemonId ?? 0)
        - Number(right.entry.order ?? right.entry.spriteId ?? right.entry.pokemonId ?? 0);
  const compareTotal = (direction) => {
    if (leftTotal === null && rightTotal === null) return byNumber;
    if (leftTotal === null) return 1;
    if (rightTotal === null) return -1;
    return direction * (leftTotal - rightTotal) || byNumber;
  };
    const comparison = sort === "name"
      ? left.entry.name.localeCompare(right.entry.name, "en") || byNumber
      : sort === "total-asc"
      ? compareTotal(1)
        : sort === "total-desc"
        ? compareTotal(-1)
          : byNumber;
    return comparison || left.index - right.index;
  }).map(({ entry }) => entry);
}

function getBaseStatTotal(entry) {
  if (Number.isFinite(entry.baseStatTotal)) return entry.baseStatTotal;
  const keys = ["hp", "atk", "def", "spa", "spd", "spe"];
  if (!keys.every((key) => Number.isFinite(entry.stats?.[key]))) return null;
  return keys.reduce((total, key) => total + entry.stats[key], 0);
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatNationalNumber(speciesId) {
  return `#${String(speciesId).padStart(4, "0")}`;
}

export function serializeTeam(team) {
  return JSON.stringify(team, null, 2);
}

export function importShowdownTeam(text, pokemon = [], { allowPartial = false } = {}) {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    return { ok: false, error: "O texto passou de 128 KB." };
  }

  const bySpecies = new Map();
  for (const entry of pokemon) {
    const aliases = [entry.slug, entry.name];
    if (entry.speciesSlug && entry.slug.startsWith(`${entry.speciesSlug}-`)) {
      aliases.push(`${entry.speciesName || entry.speciesSlug}-${entry.slug.slice(entry.speciesSlug.length + 1)}`);
    }
    if (entry.formId === "male") aliases.push(entry.speciesName || entry.speciesSlug);
    if (entry.formId === "female") aliases.push(`${entry.speciesName || entry.speciesSlug}-F`);
    const taurosBreed = entry.slug.match(/^tauros-paldea-(combat|blaze|aqua)-breed$/);
    if (taurosBreed) aliases.push(`Tauros-Paldea-${taurosBreed[1]}`);
    for (const alias of aliases) {
      const key = normalizeText(alias.replace(/♀/g, "-F").replace(/♂/g, "-M")).replace(/[^a-z0-9]/g, "");
      if (!key) continue;
      const matches = bySpecies.get(key) || new Set();
      matches.add(entry);
      bySpecies.set(key, matches);
    }
  }

  const blocks = text.trim().split(/\n\s*\n/).filter((block) => block.trim());
  if (!blocks.length) return { ok: false, error: "Cole uma equipe exportada pelo Showdown ou Poképaste." };
  if (blocks.length > 6) return { ok: false, error: "O texto contém mais de seis Pokémon." };

  const team = createEmptyTeam();
  const warnings = [];
  const statKeys = { hp: "hp", atk: "atk", attack: "atk", def: "def", defense: "def", spa: "spa", spatk: "spa", spattack: "spa", spd: "spd", spdef: "spd", spdefense: "spd", spe: "spe", speed: "spe" };

  for (const [index, block] of blocks.entries()) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const heading = lines.shift()?.replace(/^\uFEFF/, "") || "";
    const [subject, ...itemParts] = heading.split(/\s+@\s+/);
    const gender = subject.match(/\s+\(([FM])\)\s*$/i)?.[1];
    const subjectWithoutGender = subject.replace(/\s+\([FM]\)\s*$/i, "").trim();
    let speciesName = subjectWithoutGender;
    let speciesKey = normalizeText(speciesName.replace(/♀/g, "-F").replace(/♂/g, "-M")).replace(/[^a-z0-9]/g, "");
    let matches = [...(bySpecies.get(speciesKey) || [])];
    const nicknameMatch = subjectWithoutGender.match(/^(.+?)\s+\(([^()]+)\)$/);
    let resolvedNickname = false;
    if (!matches.length && nicknameMatch) {
      speciesName = nicknameMatch[2].trim();
      speciesKey = normalizeText(speciesName.replace(/♀/g, "-F").replace(/♂/g, "-M")).replace(/[^a-z0-9]/g, "");
      matches = [...(bySpecies.get(speciesKey) || [])];
      resolvedNickname = matches.length > 0;
    }
    const pokemonEntry = matches.length === 1 ? matches[0] : null;
    if (!pokemonEntry) {
      const error = `Pokémon ${index + 1}: “${speciesName}” ${matches.length ? "corresponde a mais de uma forma" : "não foi encontrado no catálogo atual"}.`;
      if (allowPartial) {
        warnings.push(`${error} Foi ignorado.`);
        continue;
      }
      return { ok: false, error };
    }

    if (resolvedNickname) warnings.push(`Pokémon ${index + 1}: o apelido “${nicknameMatch[1]}” não é preservado no rascunho.`);
    if (gender) warnings.push(`Pokémon ${index + 1}: o gênero do set não é preservado no rascunho.`);
    const member = createTeamMember(pokemonEntry);
    member.item = itemParts.join(" @ ").trim();
    let moveIndex = 0;
    for (const line of lines) {
      if (/^-\s*/.test(line)) {
        if (moveIndex === 4) return { ok: false, error: `Pokémon ${index + 1}: há mais de quatro golpes.` };
        member.moves[moveIndex] = line.replace(/^-\s*/, "").trim();
        moveIndex += 1;
        continue;
      }
      const nature = line.match(/^(.+)\s+Nature$/i);
      if (nature) {
        member.nature = nature[1].trim();
        continue;
      }
      const field = line.match(/^([^:]+):\s*(.*)$/);
      if (!field) {
        warnings.push(`Pokémon ${index + 1}: linha não reconhecida — ${line}`);
        continue;
      }
      const [, rawKey, value] = field;
      const key = normalizeText(rawKey).replace(/[^a-z0-9]/g, "");
      if (key === "ability") member.ability = value;
      else if (key === "level") {
        const level = Number(value);
        if (!Number.isInteger(level) || level < 1 || level > 100) return { ok: false, error: `Pokémon ${index + 1}: o nível deve estar entre 1 e 100.` };
        member.level = level;
      } else if (key === "nature") member.nature = value.replace(/\s+nature$/i, "").trim();
      else if (key === "evs") {
        const spread = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
        const seenStats = new Set();
        for (const part of value.split("/").map((segment) => segment.trim()).filter(Boolean)) {
          const stat = part.match(/^(\d+)\s+(.+)$/);
          const statName = stat ? normalizeText(stat[2]).replace(/[^a-z0-9]/g, "") : "";
          if (!stat || !statKeys[statName]) return { ok: false, error: `Pokémon ${index + 1}: não reconheci a distribuição “${value}”.` };
          const statKey = statKeys[statName];
          if (seenStats.has(statKey)) return { ok: false, error: `Pokémon ${index + 1}: a distribuição repete o atributo ${stat[2]}.` };
          seenStats.add(statKey);
          spread[statKey] = Number(stat[1]);
        }
        const total = Object.values(spread).reduce((sum, points) => sum + points, 0);
        if (Object.values(spread).some((points) => points > 32) || total > 66) {
          return { ok: false, error: `Pokémon ${index + 1}: a linha EVs excede o limite Champions de 32 pontos por atributo ou 66 no total; não foi convertida.` };
        }
        member.statPoints = spread;
      } else if (key === "ivs") {
        if (value && !value.split("/").every((part) => /^\s*31\s+/.test(part))) {
          warnings.push(`Pokémon ${index + 1}: IVs não são representados no rascunho Champions e não foram importados.`);
        }
      } else if (["shiny", "gender", "happiness", "pokeball", "teratype", "gigantamax", "dynamaxlevel"].includes(key)) {
        warnings.push(`Pokémon ${index + 1}: ${rawKey} não é representado no rascunho Champions.`);
      } else {
        warnings.push(`Pokémon ${index + 1}: campo “${rawKey}” não foi importado.`);
      }
    }
    team.members[allowPartial ? team.members.findIndex((entry) => entry === null) : index] = member;
  }

  if (!team.members.some(Boolean)) return { ok: false, error: "Nenhum Pokémon do paste foi reconhecido no catálogo atual." };
  return { ok: true, value: team, warnings: [...new Set(warnings)] };
}

export function exportShowdownTeam(team, pokemon = []) {
  const pokemonBySlug = new Map(pokemon.map((entry) => [entry.slug, entry]));
  return team.members.filter(Boolean).map((member) => {
    const entry = pokemonBySlug.get(member.pokemonId);
    if (!entry) return "";
    const taurosBreed = entry.slug.match(/^tauros-paldea-(combat|blaze|aqua)-breed$/);
    const species = entry.slug === "nidoran-f" ? "Nidoran-F"
      : entry.slug === "nidoran-m" ? "Nidoran-M"
        : taurosBreed ? `Tauros-Paldea-${taurosBreed[1][0].toUpperCase()}${taurosBreed[1].slice(1)}`
        : entry.slug.startsWith(`${entry.speciesSlug}-`)
          ? `${entry.speciesName || entry.speciesSlug}-${entry.slug.slice(entry.speciesSlug.length + 1).split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("-")}`
          : entry.name;
    const lines = [member.item ? `${species} @ ${member.item}` : species];
    if (member.ability) lines.push(`Ability: ${member.ability}`);
    if (member.level) lines.push(`Level: ${member.level}`);
    const spread = STAT_KEYS.flatMap((key) => member.statPoints[key] ? [`${member.statPoints[key]} ${{ hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" }[key]}`] : []);
    if (spread.length) lines.push(`EVs: ${spread.join(" / ")}`);
    if (member.nature && member.nature !== "Serious") lines.push(`${member.nature} Nature`);
    lines.push(...member.moves.filter(Boolean).map((move) => `- ${move}`));
    return lines.join("\n");
  }).filter(Boolean).join("\n\n");
}

export function parseTeam(text, pokemon = []) {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    return { ok: false, error: "O arquivo passou de 128 KB." };
  }

  let candidate;
  try {
    candidate = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não contém um JSON válido." };
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { ok: false, error: "O arquivo precisa conter um objeto de equipe." };
  }
  if (candidate.schemaVersion !== TEAM_SCHEMA_VERSION) {
    return { ok: false, error: "Esta versão do arquivo não é compatível." };
  }
  if (candidate.format !== "doubles" || candidate.rulesetId !== "champions-doubles-draft") {
    return { ok: false, error: "O arquivo não corresponde a um rascunho de Doubles do Spinda Stop." };
  }
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0 || candidate.name.length > 48) {
    return { ok: false, error: "Informe um nome de equipe com até 48 caracteres." };
  }
  if (!Array.isArray(candidate.members) || candidate.members.length !== 6) {
    return { ok: false, error: "A equipe precisa ter exatamente seis posições." };
  }

  for (let index = 0; index < candidate.members.length; index += 1) {
    const member = candidate.members[index];
    if (member === null) continue;
    const path = `Posição ${index + 1}`;
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      return { ok: false, error: `${path}: formato inválido.` };
    }
    const pokemonEntry = typeof member.pokemonId === "string"
      ? pokemon.find((entry) => entry.slug === member.pokemonId)
      : null;
    if (!pokemonEntry) {
      return { ok: false, error: `${path}: Pokémon não encontrado no catálogo atual.` };
    }
    if (
      member.speciesId !== pokemonEntry.speciesId
      || member.speciesSlug !== pokemonEntry.speciesSlug
      || member.formId !== pokemonEntry.formId
      || member.formSlug !== pokemonEntry.slug
    ) {
      return { ok: false, error: `${path}: espécie ou forma não corresponde ao catálogo atual.` };
    }
    if (!Number.isInteger(member.level) || member.level < 1 || member.level > 100) {
      return { ok: false, error: `${path}: nível fora do intervalo de 1 a 100.` };
    }
    if (!Array.isArray(member.moves) || member.moves.length !== 4 || member.moves.some((move) => typeof move !== "string" || move.length > 100)) {
      return { ok: false, error: `${path}: use quatro campos de golpe com até 100 caracteres cada.` };
    }
    if (!member.statPoints || typeof member.statPoints !== "object" || STAT_KEYS.some((key) => !Number.isInteger(member.statPoints[key]) || member.statPoints[key] < 0 || member.statPoints[key] > 999)) {
      return { ok: false, error: `${path}: distribuição de pontos inválida.` };
    }
    for (const key of ["ability", "item", "nature"]) {
      if (typeof member[key] !== "string" || member[key].length > 100) {
        return { ok: false, error: `${path}: o campo ${key} é inválido.` };
      }
    }
  }

  return {
    ok: true,
    value: {
      schemaVersion: TEAM_SCHEMA_VERSION,
      name: candidate.name.trim(),
      format: "doubles",
      rulesetId: "champions-doubles-draft",
      members: candidate.members.map((member) => {
        if (member === null) return null;
        const pokemonEntry = pokemon.find((entry) => entry.slug === member.pokemonId);
        return {
          pokemonId: pokemonEntry.slug,
          speciesId: pokemonEntry.speciesId,
          speciesSlug: pokemonEntry.speciesSlug,
          formId: pokemonEntry.formId,
          formSlug: pokemonEntry.slug,
          ability: member.ability,
          item: member.item,
          nature: member.nature,
          level: member.level,
          moves: [...member.moves],
          statPoints: Object.fromEntries(STAT_KEYS.map((key) => [key, member.statPoints[key]])),
        };
      }),
    },
  };
}

function normalizeText(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}
