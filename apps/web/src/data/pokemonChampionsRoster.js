import eligibilitySnapshot from "@spinda-stop/data/champions-eligibility" with { type: "json" };

const OFFICIAL_FORM_SLUGS = Object.freeze({
  "raichualolanform": "raichu-alola",
  "ninetalesalolanform": "ninetales-alola",
  "persianalolanform": "persian-alola",
  "arcaninehisuianform": "arcanine-hisui",
  "slowbrogalarianform": "slowbro-galar",
  "taurospaldeanformcombatbreed": "tauros-paldea-combat-breed",
  "taurospaldeanformblazebreed": "tauros-paldea-blaze-breed",
  "taurospaldeanformaquabreed": "tauros-paldea-aqua-breed",
  "typhlosionhisuianform": "typhlosion-hisui",
  "slowkinggalarianform": "slowking-galar",
  "rotomrotom": "rotom",
  "rotomheatrotom": "rotom-heat",
  "rotomwashrotom": "rotom-wash",
  "rotomfrostrotom": "rotom-frost",
  "rotomfanrotom": "rotom-fan",
  "rotommowrotom": "rotom-mow",
  "samurotthisuianform": "samurott-hisui",
  "zoroarkhisuianform": "zoroark-hisui",
  "stunfiskgalarianform": "stunfisk-galar",
  "toxtricityampedform": "toxtricity-amped",
  "toxtricitylowkeyform": "toxtricity-low-key",
  "indeedeemale": "indeedee-male",
  "indeedeefemale": "indeedee-female",
  "meowsticmale": "meowstic-male",
  "meowsticfemale": "meowstic-female",
  "goodrahisuianform": "goodra-hisui",
  "gourgeistmediumvariety": "gourgeist-average",
  "gourgeistsmallvariety": "gourgeist-small",
  "gourgeistlargevariety": "gourgeist-large",
  "gourgeistjumbovariety": "gourgeist-super",
  "avalugghisuianform": "avalugg-hisui",
  "decidueyehisuianform": "decidueye-hisui",
  "lycanrocmiddayform": "lycanroc-midday",
  "lycanrocmidnightform": "lycanroc-midnight",
  "lycanrocduskform": "lycanroc-dusk",
  "basculegionmale": "basculegion-male",
  "basculegionfemale": "basculegion-female",
});

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
}

function speciesIdFromOfficialId(id) {
  const match = String(id || "").match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

function resolvedEntry(entry, catalog, snapshot = eligibilitySnapshot) {
  const slug = OFFICIAL_FORM_SLUGS[normalize(entry.name)];
  if (slug) return catalog.find((pokemon) => pokemon.slug === slug) || null;
  const name = normalize(entry.name);
  if (snapshot?.regulations && Object.values(snapshot.regulations)
    .some((regulation) => regulation.entries?.filter((candidate) => normalize(candidate.name) === name).length > 1)) return null;
  const matches = catalog.filter((pokemon) => normalize(pokemon.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

function regulationData(regulation, snapshot) {
  const selected = snapshot?.regulations?.[regulation];
  return selected && Array.isArray(selected.entries) ? selected : null;
}

function hasCompleteRoster(selected) {
  if (!Number.isInteger(selected?.rowCount) || selected.rowCount !== selected.entries.length
    || !selected.sourceUrl || !selected.regulationUrl || !selected.checkedAt
    || !Number.isFinite(Date.parse(selected.checkedAt)) || !Number.isFinite(Date.parse(selected.validFrom))
    || !Number.isFinite(Date.parse(selected.validUntil))) return false;
  const ids = selected.entries.map((entry) => entry?.id);
  return ids.every((id) => typeof id === "string" && /^\d{4}-\d{3}$/.test(id))
    && new Set(ids).size === selected.rowCount;
}

function matchRosterEntry(pokemon, entry, catalog, snapshot) {
  if (speciesIdFromOfficialId(entry.id) !== Number(pokemon.speciesId)) return false;
  return resolvedEntry(entry, catalog, snapshot)?.slug === pokemon.slug;
}

export function getChampionsEligibility(pokemon, regulation = "M-C", catalog = [], snapshot = eligibilitySnapshot) {
  if (!pokemon || !Number.isInteger(Number(pokemon.speciesId))) return { status: "unknown", regulation };
  const selected = regulationData(regulation, snapshot);
  if (!selected) return { status: "unknown", regulation };

  if (String(pokemon.formId || "").startsWith("mega")) {
    if (!hasCompleteRoster(selected) || !Array.isArray(selected.allowedMegaNames)) return { status: "unknown", regulation };
    if (catalog.filter((candidate) => normalize(candidate.name) === normalize(pokemon.name)).length !== 1) {
      return { status: "unknown", regulation };
    }
    const allowed = Array.isArray(selected.allowedMegaNames) && selected.allowedMegaNames
      .some((name) => normalize(name) === normalize(pokemon.name));
    return { status: allowed ? "eligible" : "ineligible", regulation, source: selected.sourceUrl };
  }

  if (selected.entries.some((entry) => matchRosterEntry(pokemon, entry, catalog, snapshot))) {
    return { status: "eligible", regulation, source: selected.sourceUrl };
  }
  if (!hasCompleteRoster(selected)) return { status: "unknown", regulation };
  const speciesHasRosterEntry = selected.entries.some((entry) => speciesIdFromOfficialId(entry.id) === Number(pokemon.speciesId));
  return {
    status: speciesHasRosterEntry ? "unknown" : "ineligible",
    regulation,
    source: selected.sourceUrl,
  };
}

export function getChampionsEligiblePokemon(catalog, regulation = "M-C", snapshot = eligibilitySnapshot) {
  return (catalog || []).filter((pokemon) => getChampionsEligibility(pokemon, regulation, catalog, snapshot).status === "eligible");
}

export function getChampionsEligibleMegaPokemon(catalog, regulation = "M-C", snapshot = eligibilitySnapshot) {
  return (catalog || []).filter((pokemon) => String(pokemon.formId || "").startsWith("mega")
    && getChampionsEligibility(pokemon, regulation, catalog, snapshot).status === "eligible");
}

export function getOfficialPokemonAliases(catalog, snapshot = eligibilitySnapshot) {
  const aliases = new Map((catalog || []).map((pokemon) => [pokemon.slug, new Set()]));
  for (const regulation of Object.values(snapshot?.regulations || {})) {
    for (const entry of regulation.entries || []) {
      const pokemon = resolvedEntry(entry, catalog, snapshot);
      if (pokemon) aliases.get(pokemon.slug)?.add(entry.name);
    }
  }
  return (catalog || []).map((pokemon) => ({ ...pokemon, aliases: [...(aliases.get(pokemon.slug) || [])] }));
}

export function getChampionsRosterSummary(regulation = "M-C", snapshot = eligibilitySnapshot) {
  const selected = regulationData(regulation, snapshot);
  if (!selected) return null;
  return {
    regulation,
    validFrom: selected.validFrom,
    validUntil: selected.validUntil,
    sourceUrl: selected.sourceUrl,
    regulationUrl: selected.regulationUrl,
    checkedAt: selected.checkedAt,
    rosterCount: selected.rowCount,
    rosterComplete: hasCompleteRoster(selected),
    megaCount: selected.allowedMegaNames?.length ?? null,
    newlyFeatured: selected.rosterAnnouncement?.newlyFeatured || [],
    rosterAnnouncementUrl: selected.rosterAnnouncement?.sourceUrl || null,
    rankedSeason: selected.rankedSeason || null,
  };
}
