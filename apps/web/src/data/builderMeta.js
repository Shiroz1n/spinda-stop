const statFields = [["hp", "hp"], ["attack", "atk"], ["defense", "def"], ["spAttack", "spa"], ["spDefense", "spd"], ["speed", "spe"]];

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hasDuplicateMove(moves, name, exceptIndex = -1) {
  const key = normalize(name);
  return Boolean(key && moves?.some((move, index) => index !== exceptIndex && normalize(move) === key));
}

export function applyBuilderMetaOption(member, category, row) {
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  if (!member || (!name && category !== "stat_points")) return { ok: false, error: "Esta opção não pode ser aplicada." };

  if (category === "move") {
    const existing = (member.moves || []).filter(Boolean);
    if (hasDuplicateMove(existing, name)) {
      return { ok: true, changed: false, member, message: `${name} já está selecionado.` };
    }
    if (existing.length === 4) existing.shift();
    existing.push(name);
    return { ok: true, changed: true, member: { ...member, moves: [...existing, ...Array(4 - existing.length).fill("")] }, message: `${name} aplicado ao set.` };
  }

  if (category === "held_item") return { ok: true, changed: true, member: { ...member, item: name }, message: `${name} aplicado como item.` };
  if (category === "ability") return { ok: true, changed: true, member: { ...member, ability: name }, message: `${name} aplicada como habilidade.` };
  if (category === "stat_alignment") return { ok: true, changed: true, member: { ...member, nature: name }, message: `${name} aplicada como Nature.` };
  if (category === "stat_points") {
    const values = Object.fromEntries(statFields.map(([source, target]) => [target, row.statPoints?.[source]]));
    if (Object.values(values).some((value) => !Number.isInteger(value) || value < 0 || value > 32)) {
      return { ok: false, error: "A distribuição publicada está incompleta ou fora do limite de 32 SP por atributo." };
    }
    if (Object.values(values).reduce((total, value) => total + value, 0) > 66) {
      return { ok: false, error: "A distribuição publicada excede 66 SP e não pode ser aplicada." };
    }
    return { ok: true, changed: true, member: { ...member, statPoints: values }, message: "Distribuição de Stat Points aplicada ao set." };
  }

  return { ok: false, error: "Esta categoria é apenas informativa." };
}
