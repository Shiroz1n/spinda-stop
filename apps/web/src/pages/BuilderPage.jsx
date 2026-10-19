import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { addPokemonToDraft, createEmptyTeam, parseTeam, serializeTeam, setTeamMember } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import moveData from "@spinda-stop/data/moves";
import natureData from "@spinda-stop/data/natures";
import { SpeciesPicker } from "../components/SpeciesPicker.jsx";
import { ItemSprite, PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { TeamAccountPanel } from "../components/TeamAccountPanel.jsx";
import { buildDamageCalculatorSearch, getDamageSpeciesName } from "../data/damageCalculator.js";
import { applySpeedPointsToStatSpread, calculateChampionsSpeed, CHAMPIONS_MAX_STAT_POINTS, CHAMPIONS_MAX_TOTAL_POINTS, compareSpeed, getChampionsSpeedRecommendation, maximumLegalSpeedPoints, savedNatureForSpeed, speedNatureFromName } from "../data/speedTiers.js";
import { communityRequest } from "../data/communityApi.js";

const STORAGE_KEY = "spinda-stop.team.v1";
const STAT_FIELDS = [
  ["hp", "HP"],
  ["atk", "Atk"],
  ["def", "Def"],
  ["spa", "SpA"],
  ["spd", "SpD"],
  ["spe", "Spe"],
];

function readSavedTeam() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { team: createEmptyTeam(), preserveStored: false, message: "" };
    const parsed = parseTeam(saved, dexData.pokemon);
    return parsed.ok
      ? { team: parsed.value, preserveStored: false, message: "" }
      : { team: createEmptyTeam(), preserveStored: true, message: "O rascunho salvo não pôde ser lido e foi preservado. Importe um arquivo válido ou faça uma alteração para salvar uma equipe nova." };
  } catch {
    return { team: createEmptyTeam(), preserveStored: true, message: "O armazenamento deste navegador não pôde ser lido. A equipe atual ainda pode ser exportada." };
  }
}

function pokemonWithDetails(slug) {
  const summary = dexData.pokemon.find((entry) => entry.slug === slug);
  return summary ? { ...summary, ...detailData.pokemonBySlug[slug] } : null;
}

function createInitialDraft(pokemonSlug) {
  const saved = readSavedTeam();
  const team = saved.team;
  const pokemon = pokemonWithDetails(pokemonSlug);
  if (!pokemon) return { team, selectedSlot: 0, message: saved.message, preserveStored: saved.preserveStored };

  const result = addPokemonToDraft(team, pokemon);
  const slotLabel = result.selectedSlot + 1;
  const messages = {
    added: `${pokemon.name} adicionado à posição ${slotLabel}.`,
    existing: `${pokemon.name} já está na posição ${slotLabel}. O set existente foi mantido.`,
    full: "O time está cheio. Escolha uma posição no construtor antes de substituir alguém.",
  };

  return {
    team: result.team,
    selectedSlot: result.selectedSlot,
    message: [saved.message, messages[result.status]].filter(Boolean).join(" "),
    preserveStored: saved.preserveStored,
  };
}

export function BuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const importRef = useRef(null);
  const [initialDraft] = useState(() => createInitialDraft(location.state?.pokemonSlug));
  const [team, setTeam] = useState(initialDraft.team);
  const [selectedSlot, setSelectedSlot] = useState(initialDraft.selectedSlot);
  const [damageOpponentSlot, setDamageOpponentSlot] = useState(() => initialDraft.team.members.findIndex((member, index) => index !== initialDraft.selectedSlot && Boolean(member)));
  const [speedTargetSlug, setSpeedTargetSlug] = useState("");
  const [speedTargetSp, setSpeedTargetSp] = useState(0);
  const [speedTargetNature, setSpeedTargetNature] = useState("neutral");
  const [speedPreviews, setSpeedPreviews] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(0);
  const [speedTargetPickerOpen, setSpeedTargetPickerOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(initialDraft.preserveStored ? "Rascunho salvo preservado" : "Rascunho local");
  const [message, setMessage] = useState(initialDraft.message);
  const selectedMember = team.members[selectedSlot];
  const selectedPokemon = useMemo(
    () => selectedMember ? pokemonWithDetails(selectedMember.pokemonId) : null,
    [selectedMember],
  );
  const moveListId = "move-options";
  const natureListId = "nature-options";
  const damageOpponents = team.members
    .map((member, index) => ({ member, index, pokemon: member ? pokemonWithDetails(member.pokemonId) : null }))
    .filter(({ member, index, pokemon }) => member && pokemon && index !== selectedSlot);
  const selectedDamageOpponent = damageOpponents.find(({ index }) => index === damageOpponentSlot) || damageOpponents[0] || null;
  const speedTargetPokemon = useMemo(() => speedTargetSlug ? pokemonWithDetails(speedTargetSlug) : null, [speedTargetSlug]);
  const speedTargetValue = speedTargetPokemon
    ? calculateChampionsSpeed(speedTargetPokemon.stats.spe, speedTargetSp, speedTargetNature)
    : null;
  const speedComparisonRows = team.members.map((member, index) => {
    const pokemon = member ? pokemonWithDetails(member.pokemonId) : null;
    if (!member || !pokemon || speedTargetValue === null) return { member, pokemon, index, preview: null, speed: null, relation: "unknown", requiredSp: null };
    const savedPreview = speedPreviews[index];
    const preview = savedPreview || {
      sp: Number(member.statPoints.spe) || 0,
      nature: speedNatureFromName(member.nature),
      natureTouched: false,
    };
    const availableSpeedSp = maximumLegalSpeedPoints(member.statPoints);
    const previewSpeedPoints = Math.min(availableSpeedSp, CHAMPIONS_MAX_STAT_POINTS, Math.max(0, Number(preview.sp) || 0));
    const appliedPreview = applySpeedPointsToStatSpread(member.statPoints, previewSpeedPoints);
    const speed = appliedPreview.ok ? calculateChampionsSpeed(pokemon.stats.spe, previewSpeedPoints, preview.nature) : null;
    const relation = appliedPreview.ok ? compareSpeed(speed, speedTargetValue) : "unknown";
    const recommendation = appliedPreview.ok
      ? getChampionsSpeedRecommendation({ baseSpeed: pokemon.stats.spe, targetSpeed: speedTargetValue, nature: preview.nature, availableSpeedSp })
      : null;
    return { member, pokemon, index, preview: { ...preview, sp: previewSpeedPoints }, speed, relation, recommendation, availableSpeedSp };
  });

  function toDamageSide(member, pokemon) {
    return {
      species: getDamageSpeciesName(pokemon.slug),
      nature: member.nature || "Serious",
      ability: member.ability,
      item: member.item,
      statPoints: member.statPoints,
      moves: member.moves,
    };
  }

  function calculatorUrl(selectedRole) {
    const selectedSide = toDamageSide(selectedMember, selectedPokemon);
    const otherSide = selectedDamageOpponent
      ? toDamageSide(selectedDamageOpponent.member, selectedDamageOpponent.pokemon)
      : null;
    const attacker = selectedRole === "attacker" ? selectedSide : otherSide;
    const defender = selectedRole === "defender" ? selectedSide : otherSide;
    const move = attacker?.moves?.find((entry) => entry.trim()) || "";
    return `/calculator?${buildDamageCalculatorSearch(attacker, defender, move)}`;
  }

  useEffect(() => {
    if (location.state?.pokemonSlug) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state?.pokemonSlug, navigate]);

  useEffect(() => {
    if (initialDraft.preserveStored) return;
    try { localStorage.setItem(STORAGE_KEY, serializeTeam(initialDraft.team)); } catch { /* Export remains available if storage is blocked. */ }
  }, [initialDraft]);

  function commitTeam(nextTeam) {
    setTeam(nextTeam);
    try {
      localStorage.setItem(STORAGE_KEY, serializeTeam(nextTeam));
      setSaveStatus("Salvo neste navegador");
      return true;
    } catch {
      setSaveStatus("Falha ao salvar localmente");
      return false;
    }
  }

  function updateMember(update) {
    const members = [...team.members];
    members[selectedSlot] = { ...members[selectedSlot], ...update };
    commitTeam({ ...team, members });
  }

  function chooseForSlot(slot) {
    setSelectedSlot(slot);
    setPickerSlot(slot);
    setPickerOpen(true);
  }

  function choosePokemon(pokemon) {
    const selectedPokemon = pokemonWithDetails(pokemon.slug);
    const samePokemon = team.members[pickerSlot]?.pokemonId === selectedPokemon.slug;
    commitTeam(setTeamMember(team, pickerSlot, selectedPokemon));
    setSpeedPreviews((current) => {
      const next = { ...current };
      delete next[pickerSlot];
      return next;
    });
    setSelectedSlot(pickerSlot);
    setPickerOpen(false);
    setMessage(samePokemon
      ? `${selectedPokemon.name} já está nesta posição; o set foi mantido.`
      : `${selectedPokemon.name} adicionado à posição ${pickerSlot + 1}.`);
  }

  function clearSlot() {
    const members = [...team.members];
    members[selectedSlot] = null;
    commitTeam({ ...team, members });
    setMessage(`Posição ${selectedSlot + 1} limpa.`);
  }

  function exportTeam() {
    let url = "";
    try {
      const file = new Blob([serializeTeam(team)], { type: "application/json" });
      url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(team.name)}.json`;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setMessage("Arquivo JSON exportado.");
    } catch {
      setMessage("Não foi possível exportar o arquivo neste navegador.");
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function importTeam(event) {
    const [file] = event.target.files ?? [];
    event.target.value = "";
    if (!file) return;
    if (file.size > 128 * 1024) {
      setMessage("O arquivo passou de 128 KB.");
      return;
    }
    let contents;
    try {
      contents = await file.text();
    } catch {
      setMessage("Não foi possível ler o arquivo selecionado.");
      return;
    }
    const result = parseTeam(contents, dexData.pokemon);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const saved = commitTeam(result.value);
    setSelectedSlot(Math.max(0, result.value.members.findIndex(Boolean)));
    setMessage(saved ? "Equipe importada e salva neste navegador." : "Equipe importada, mas não foi possível salvá-la neste navegador.");
  }

  function updateMove(index, value) {
    const moves = [...selectedMember.moves];
    moves[index] = value;
    updateMember({ moves });
  }

  function updateSpeedPreview(index, key, value) {
    const member = team.members[index];
    if (!member) return;
    setSpeedPreviews((current) => {
      const preview = current[index] || {
        sp: Number(member.statPoints.spe) || 0,
        nature: speedNatureFromName(member.nature),
        natureTouched: false,
      };
      const nextValue = key === "sp"
        ? Math.min(maximumLegalSpeedPoints(member.statPoints), Math.max(0, Number(value) || 0))
        : value;
      return {
        ...current,
        [index]: {
          ...preview,
          [key]: nextValue,
          ...(key === "nature" ? { natureTouched: true } : {}),
        },
      };
    });
  }

  function applySpeedPreview(index) {
    const member = team.members[index];
    if (!member) return;
    const preview = speedPreviews[index] || {
      sp: Number(member.statPoints.spe) || 0,
      nature: speedNatureFromName(member.nature),
      natureTouched: false,
    };
    const speedPoints = Math.min(
      maximumLegalSpeedPoints(member.statPoints),
      CHAMPIONS_MAX_STAT_POINTS,
      Math.max(0, Number(preview.sp) || 0),
    );
    const appliedSpread = applySpeedPointsToStatSpread(
      member.statPoints,
      speedPoints,
    );
    if (!appliedSpread.ok) {
      setMessage(`Prévia não aplicada. ${appliedSpread.error}`);
      return;
    }
    const members = [...team.members];
    members[index] = {
      ...member,
      nature: preview.natureTouched ? savedNatureForSpeed(preview.nature, member.nature) : member.nature,
      statPoints: appliedSpread.statPoints,
    };
    commitTeam({ ...team, members });
    setMessage(`A prévia foi aplicada à posição ${index + 1}.`);
  }

  function selectSpeedTarget(pokemon) {
    setSpeedTargetSlug(pokemon.slug);
    setSpeedTargetSp(0);
    setSpeedTargetNature("neutral");
    setSpeedTargetPickerOpen(false);
  }

  async function saveTeamToAccount(visibility) {
    await communityRequest("/teams", { method: "POST", body: { visibility, data: team } });
  }

  function loadAccountTeam(savedTeam) {
    const result = parseTeam(JSON.stringify(savedTeam), dexData.pokemon);
    if (!result.ok) {
      setMessage(`Não foi possível carregar a equipe: ${result.error}`);
      return;
    }
    commitTeam(result.value);
    setSelectedSlot(Math.max(0, result.value.members.findIndex(Boolean)));
    setMessage("Equipe da conta carregada para este rascunho local.");
  }

  const filledSlots = team.members.filter(Boolean).length;
  const pointTotal = selectedMember
    ? Object.values(selectedMember.statPoints).reduce((sum, value) => sum + value, 0)
    : 0;
  const pointRemaining = CHAMPIONS_MAX_TOTAL_POINTS - pointTotal;

  function maximumForStatPointField(statKey) {
    if (!selectedMember) return 0;
    const otherPoints = Object.entries(selectedMember.statPoints)
      .filter(([key]) => key !== statKey)
      .reduce((sum, [, value]) => sum + value, 0);
    return Math.max(0, Math.min(CHAMPIONS_MAX_STAT_POINTS, CHAMPIONS_MAX_TOTAL_POINTS - otherPoints));
  }

  return (
    <div className="page-wrap builder-page">
      <div className="page-heading-row builder-heading">
        <div>
          <p className="page-label">Construtor local · Doubles</p>
          <h1><span className="builder-heading-title-full">Monte seu time</span><span className="builder-heading-title-compact">Meu time</span></h1>
          <p className="page-intro">Seis posições para o seu time de Doubles.</p>
        </div>
        <a className="button button-outline button-small builder-speed-jump" href="#builder-speed-title">Comparar Speed</a>
      </div>

      <div className="builder-status-row">
        <label className="team-name-field">
          <span>Nome da equipe</span>
          <input className="text-input" value={team.name} maxLength={48} onChange={(event) => commitTeam({ ...team, name: event.target.value.slice(0, 48) })} onBlur={() => { if (!team.name.trim()) commitTeam({ ...team, name: "Meu time" }); }} />
        </label>
        <div className="team-status-summary">
          <span><b>{filledSlots}</b> de 6 posições</span>
          <span className="save-status"><span className="status-dot" />{saveStatus}</span>
        </div>
      </div>

      <section className="builder-workspace">
        <div className="slot-column">
          <div className="section-heading"><h2>Integrantes</h2><span>Duplas</span></div>
          <div className="team-slots" role="group" aria-label="Seis posições da equipe">
            {team.members.map((member, index) => {
              const entry = member ? dexData.pokemon.find((pokemon) => pokemon.slug === member.pokemonId) : null;
              return (
                <button
                  className={`team-slot${selectedSlot === index ? " is-selected" : ""}`}
                  key={index}
                  type="button"
                  aria-pressed={selectedSlot === index}
                  onClick={() => entry ? setSelectedSlot(index) : chooseForSlot(index)}
                >
                  <span className="team-slot-art">{entry ? <PokemonSprite pokemon={entry} name={entry.name} size={64} decorative /> : <span className="team-slot-empty" aria-hidden="true">+</span>}</span>
                  <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="slot-copy"><b>{entry?.name ?? "Vazio"}</b><small>{entry ? (entry.formName || "Posição configurável") : "Escolher espécie"}</small></span>
                  {entry && <span className="type-list slot-types">{entry.types.map((type) => <TypeTag key={type} type={type} />)}</span>}
                  {!entry && <span className="slot-add">Adicionar</span>}
                </button>
              );
            })}
          </div>
          <p className="slot-hint">Selecione uma posição para editar ou escolha uma espécie para preenchê-la.</p>
        </div>

        <div className="editor-column">
          {!selectedMember || !selectedPokemon ? (
            <section className="empty-editor panel-frame">
              <span className="empty-editor-label">Posição vazia</span>
              <h2>Escolha uma posição</h2>
              <p>Adicione uma espécie para abrir os campos do set.</p>
              <button className="button button-primary" type="button" onClick={() => chooseForSlot(selectedSlot)}>Escolher espécie</button>
            </section>
          ) : (
            <section className="set-editor panel-frame" aria-labelledby="active-member-title">
              <div className="set-editor-heading">
                <PokemonSprite pokemon={selectedPokemon} name={selectedPokemon.name} size={112} priority decorative className="set-editor-art" />
                <div>
                  <p className="page-label">Posição {selectedSlot + 1} · set geral</p>
                  <h2 id="active-member-title">{selectedPokemon.name}</h2>
                  {selectedPokemon.formName && <p className="form-note">{selectedPokemon.speciesName} · {selectedPokemon.formName}</p>}
                  <div className="type-list">{selectedPokemon.types.map((type) => <TypeTag key={type} type={type} />)}</div>
                </div>
                <div className="set-heading-actions">
                  <button className="button button-outline button-small" type="button" onClick={() => chooseForSlot(selectedSlot)}>Trocar Pokémon</button>
                  <details className="builder-secondary-actions">
                    <summary>Usage e calculadora</summary>
                    <div>
                      <Link className="button button-outline button-small" to={`/usage?pokemon=${encodeURIComponent(selectedPokemon.name)}`} aria-label={`Ver tendências de Usage para ${selectedPokemon.name}`}>Ver tendências de Usage</Link>
                      <label className="builder-damage-opponent">
                        <span>Outro lado da simulação</span>
                        <select className="text-input" aria-label="Outro Pokémon para a calculadora" value={selectedDamageOpponent ? String(selectedDamageOpponent.index) : ""} onChange={(event) => setDamageOpponentSlot(Number(event.target.value))}>
                          {selectedDamageOpponent ? null : <option value="">Escolha outro Pokémon</option>}
                          {damageOpponents.map(({ index, pokemon }) => <option value={index} key={index}>{`Posição ${index + 1} · ${pokemon.name}`}</option>)}
                        </select>
                      </label>
                      <Link className="button button-outline button-small" to={calculatorUrl("attacker")} aria-label={`Usar ${selectedPokemon.name} como atacante na calculadora`}>Como atacante</Link>
                      <Link className="button button-outline button-small" to={calculatorUrl("defender")} aria-label={`Usar ${selectedPokemon.name} como alvo na calculadora`}>Como alvo</Link>
                      <button className="button button-quiet button-small" type="button" onClick={clearSlot}>Limpar posição</button>
                    </div>
                  </details>
                </div>
              </div>

              <div className="editor-fields">
                <label className="field-label" htmlFor="member-ability">Habilidade</label>
                <input id="member-ability" className="text-input" list="ability-options" value={selectedMember.ability} maxLength={100} onChange={(event) => updateMember({ ability: event.target.value })} placeholder="Escolha ou digite" />
                <datalist id="ability-options">
                  {selectedPokemon.abilities.map((ability) => <option value={ability.name} key={`${ability.name}-${ability.hidden}`}>{ability.hidden ? "Habilidade oculta" : "Habilidade geral"}</option>)}
                </datalist>

                <label className="field-label" htmlFor="member-item">Item</label>
                <div className="item-input-row">
                  <ItemSprite name={selectedMember.item} size={32} />
                  <input id="member-item" className="text-input" value={selectedMember.item} maxLength={100} onChange={(event) => updateMember({ item: event.target.value })} placeholder="Digite um item" />
                </div>

                <label className="field-label" htmlFor="member-nature">Nature</label>
                <input id="member-nature" className="text-input" list={natureListId} value={selectedMember.nature} maxLength={100} onChange={(event) => updateMember({ nature: event.target.value })} placeholder="Escolha ou digite" />
                <datalist id={natureListId}>{natureData.natures.map((nature) => <option key={nature.slug} value={nature.name} />)}</datalist>

                <label className="field-label" htmlFor="member-level">Nível</label>
                <input id="member-level" className="text-input short-number-input" type="number" min="1" max="100" value={selectedMember.level} onChange={(event) => updateMember({ level: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })} />

                <div className="moves-heading"><h3>Golpes</h3><span>Até quatro</span></div>
                <datalist id={moveListId}>{moveData.moves.map((move) => <option key={move.slug} value={move.name} />)}</datalist>
                {selectedMember.moves.map((move, index) => (
                  <label className="move-field" htmlFor={`move-${index}`} key={index}>
                    <span>{index + 1}</span>
                    <input id={`move-${index}`} className="text-input" list={moveListId} value={move} maxLength={100} onChange={(event) => updateMove(index, event.target.value)} placeholder="Buscar golpe" />
                  </label>
                ))}
                <details className="builder-compatibility field-wide"><summary>Compatibilidade do set</summary><p>A lista contém golpes gerais. Compatibilidade do Pokémon e do regulamento não é verificada.</p></details>

                <details className="points-section field-wide">
                  <summary>Conferir Stat Points <span>{pointTotal} distribuídos</span></summary>
                  <p className="form-hint">Limite usado pelo formato comunitário: 32 SP por atributo e 66 no set. Isso não confirma uma regra oficial do jogo. {pointRemaining >= 0 ? `Restam ${pointRemaining} SP.` : `O set excede o orçamento em ${Math.abs(pointRemaining)} SP.`}</p>
                  <div className="points-grid">
                    {STAT_FIELDS.map(([key, label]) => (
                      <label key={key} htmlFor={`stat-${key}`}>
                        <span>{label}</span>
                        <input id={`stat-${key}`} className="text-input" type="number" min="0" max={maximumForStatPointField(key)} value={selectedMember.statPoints[key]} onChange={(event) => updateMember({ statPoints: { ...selectedMember.statPoints, [key]: Math.min(maximumForStatPointField(key), Math.max(0, Number(event.target.value) || 0)) } })} />
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            </section>
          )}
        </div>
      </section>

      <section className="builder-speed-panel" aria-labelledby="builder-speed-title">
        <div className="builder-speed-heading">
          <div><p className="page-label">Comparação temporária · Champions</p><h2 id="builder-speed-title">Speed do time</h2></div>
          <Link className="button button-outline button-small" to={speedTargetPokemon ? `/speed-tiers?target=${encodeURIComponent(speedTargetPokemon.slug)}` : "/speed-tiers"}>Abrir Speed Tiers</Link>
        </div>
        <div className={speedTargetPokemon ? "builder-speed-target" : "builder-speed-target is-empty"}>
          {speedTargetPokemon ? <>
            <PokemonSprite pokemon={speedTargetPokemon} name={speedTargetPokemon.name} size={52} decorative />
            <div className="builder-speed-target-name"><small>Adversário escolhido</small><strong>{speedTargetPokemon.name}</strong><span>{speedTargetValue} Speed · nível 50</span></div>
            <label><span>SP do alvo</span><input className="text-input" type="number" min="0" max="32" value={speedTargetSp} onChange={(event) => setSpeedTargetSp(Math.min(32, Math.max(0, Number(event.target.value) || 0)))} /></label>
            <label><span>Nature do alvo</span><select className="text-input" value={speedTargetNature} onChange={(event) => setSpeedTargetNature(event.target.value)}><option value="favorable">Favorável à Speed</option><option value="neutral">Neutra para Speed</option><option value="unfavorable">Desfavorável à Speed</option></select></label>
            <button className="button button-quiet button-small" type="button" onClick={() => setSpeedTargetPickerOpen(true)}>Trocar alvo</button>
          </> : <>
            <div className="builder-speed-target-placeholder"><strong>Escolha um adversário</strong><span>Compare os seis do time ao mesmo tempo.</span></div>
            <button className="button button-primary button-small" type="button" onClick={() => setSpeedTargetPickerOpen(true)}>Selecionar Pokémon</button>
          </>}
        </div>
        {speedTargetPokemon ? <div className="builder-speed-grid" aria-label="Comparação dos seis Pokémon do time">
          {speedComparisonRows.map(({ member, pokemon, index, preview, speed, relation, recommendation, availableSpeedSp }) => {
            if (!member || !pokemon) return <div className="builder-speed-empty" key={index}><span>{String(index + 1).padStart(2, "0")}</span>Posição vazia</div>;
            const appliedSpread = applySpeedPointsToStatSpread(member.statPoints, preview.sp);
            const remainingSp = CHAMPIONS_MAX_TOTAL_POINTS - Object.entries(member.statPoints).reduce((sum, [key, value]) => sum + (key === "spe" ? preview.sp : value), 0);
            const recommendationText = !appliedSpread.ok
              ? "Set inválido · revise os SP"
              : relation === "faster"
                ? "Já ultrapassa"
                : recommendation.requiredSp === null
                  ? "Não passa com até 32 SP"
                  : recommendation.canOutspeed
                    ? `${relation === "tie" ? "Empata · " : ""}${recommendation.requiredSp} SP passa`
                    : `Não passa · precisa ${recommendation.requiredSp} SP; ${availableSpeedSp} disponíveis`;
            const favorableNatureText = !appliedSpread.ok || relation === "faster" || recommendation.canOutspeed || preview.nature === "favorable"
              ? ""
              : recommendation.favorableRequiredSp === null
                ? "Nem natureza favorável + 32 SP ultrapassa"
                : recommendation.favorableCanOutspeed
                  ? `Nature favorável: ${recommendation.favorableRequiredSp} SP passa`
                  : `Nature favorável: precisa ${recommendation.favorableRequiredSp} SP; ${availableSpeedSp} disponíveis`;
            const remainingText = appliedSpread.ok
              ? `${remainingSp} SP livres`
              : "revise a distribuição";
            return <article className={`builder-speed-row is-${relation}`} key={index} data-speed={speed} data-target-speed={speedTargetValue} data-relation={relation}>
              <div className="builder-speed-identity"><PokemonSprite pokemon={pokemon} name={pokemon.name} size={48} decorative /><div><strong>{pokemon.name}</strong><small>{speed ?? "—"} Speed · {relation === "faster" ? "ultrapassa" : relation === "tie" ? "empata" : relation === "slower" ? "abaixo" : "sem dado"}</small></div></div>
              <label className="builder-speed-sp"><span>SP de Speed · temporário</span><div><input aria-label={`SP temporário de Speed de ${pokemon.name}`} type="range" min="0" max={availableSpeedSp} value={preview.sp} onChange={(event) => updateSpeedPreview(index, "sp", Number(event.target.value))} /><input className="text-input" type="number" min="0" max={availableSpeedSp} value={preview.sp} onChange={(event) => updateSpeedPreview(index, "sp", Number(event.target.value))} aria-label={`Valor temporário de SP de Speed de ${pokemon.name}`} /></div><small>{availableSpeedSp} SP disponíveis em Speed · máximo de 32 por atributo</small></label>
              <label className="builder-speed-nature"><span>Nature temporária</span><select className="text-input" value={preview.nature} onChange={(event) => updateSpeedPreview(index, "nature", event.target.value)}><option value="favorable">Favorável (+10%)</option><option value="neutral">Neutra</option><option value="unfavorable">Desfavorável (−10%)</option></select></label>
              <div className="builder-speed-action"><span>{recommendationText} · {remainingText}</span>{favorableNatureText && <small className="builder-speed-favorable-note">{favorableNatureText}</small>}<button className="button button-outline button-small" type="button" onClick={() => applySpeedPreview(index)} disabled={!appliedSpread.ok} aria-disabled={!appliedSpread.ok}>Aplicar ao set</button>{!appliedSpread.ok && <small role="status">{appliedSpread.error}</small>}</div>
            </article>;
          })}
        </div> : <div className="builder-speed-hint">A prévia é separada dos sets. SP e nature só mudam a equipe ao usar “Aplicar ao set”. IV não entra neste modelo Champions. <details><summary>Sobre os limites</summary><span>Esta prévia aceita até 32 SP em Speed e confere o orçamento de 66 SP do set antes de salvar. A referência é um formato comunitário e não confirma regras oficiais.</span></details></div>}
        {speedTargetPokemon && <div className="builder-speed-hint">Prévia não salva · Trick Room muda ordem de atuação, não Speed bruta. <details><summary>Sobre o modelo</summary><span>Fórmula Champions no nível 50 conforme o modelo do @smogon/calc. Boosts, Tailwind, paralisia, itens e habilidades ficam fora desta comparação. Aplicar uma natureza nova também pode alterar outros stats do set.</span></details></div>}
      </section>

      <details className="builder-tools-details">
        <summary>Importar ou exportar equipe</summary>
        <div className="builder-actions">
          <button className="button button-outline" type="button" onClick={() => importRef.current?.click()}>Importar JSON</button>
          <button className="button button-primary" type="button" onClick={exportTeam}>Exportar JSON</button>
          <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importTeam} aria-label="Selecionar arquivo de equipe JSON" />
        </div>
      </details>

      <details className="builder-rules-details">
        <summary>Limites deste rascunho</summary>
        <div className="rules-warning" role="note">
          <span className="warning-mark">Regras</span>
          <p>O editor não valida regulamento, legalidade de golpes/habilidades nem limites oficiais de Stat Points.</p>
        </div>
      </details>

      <TeamAccountPanel onSave={saveTeamToAccount} onLoad={loadAccountTeam} />

      <p className="form-message" role="status" aria-live="polite">{message}</p>
      <SpeciesPicker open={pickerOpen} pokemon={dexData.pokemon} onChoose={choosePokemon} onClose={() => setPickerOpen(false)} />
      <SpeciesPicker idPrefix="speed-target" open={speedTargetPickerOpen} pokemon={dexData.pokemon} onChoose={selectSpeedTarget} onClose={() => setSpeedTargetPickerOpen(false)} />
    </div>
  );
}

function safeFileName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "spinda-stop-team";
}
