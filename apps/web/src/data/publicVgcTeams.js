import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "./pokemonSprites.js";

export function publicTeamlistToShowdownPaste(teamlist, catalog = []) {
  if (!Array.isArray(teamlist) || teamlist.length !== 6) return null;
  const findPokemon = createPokemonSpriteLookup(catalog);
  const blocks = teamlist.map((member) => {
    if (!member || typeof member.speciesName !== "string" || !member.speciesName.trim()) return null;
    const match = resolveCompetitivePokemonSprite(findPokemon, { id: member.speciesId, name: member.speciesName });
    if (!match) return null;
    const lines = [match.name || member.speciesName.trim()];
    if (member.item) lines[0] += ` @ ${member.item}`;
    if (member.ability) lines.push(`Ability: ${member.ability}`);
    if (member.nature) lines.push(`${member.nature} Nature`);
    for (const move of Array.isArray(member.moves) ? member.moves.slice(0, 4) : []) {
      if (typeof move === "string" && move.trim()) lines.push(`- ${move}`);
    }
    return lines.join("\n");
  });
  return blocks.every(Boolean) ? blocks.join("\n\n") : null;
}
