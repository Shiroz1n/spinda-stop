import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { addPokemonToDraft, createEmptyTeam, exportShowdownTeam, importShowdownTeam, parseTeam, serializeTeam, setTeamMember } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import moveData from "@spinda-stop/data/moves";
import { SpeciesPicker } from "../components/SpeciesPicker.jsx";
import { NaturePicker } from "../components/NaturePicker.jsx";
import { ItemSprite, PokemonSprite } from "../components/PokemonSprite.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { TeamAccountPanel } from "../components/TeamAccountPanel.jsx";
import { buildDamageCalculatorSearch, calculateChampionsStats, getDamageSpeciesName } from "../data/damageCalculator.js";
import { getNature, getNatureSpeedClass } from "../data/natures.js";
import { calculateTeamAnalysis } from "../data/teamAnalysis.js";
import { applySpeedPointsToStatSpread, calculateChampionsSpeed, CHAMPIONS_MAX_STAT_POINTS, CHAMPIONS_MAX_TOTAL_POINTS, compareSpeed, compareSpeedOrder, getChampionsSpeedRecommendation, maximumLegalSpeedPoints, resolveSpeedPreviewNature, speedNatureFromName } from "../data/speedTiers.js";
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
  const [showdownInput, setShowdownInput] = useState("");
  const [showdownExport, setShowdownExport] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(initialDraft.selectedSlot);
  const [damageOpponentSlot, setDamageOpponentSlot] = useState(() => initialDraft.team.members.findIndex((member, index) => index !== initialDraft.selectedSlot && Boolean(member)));
  const [speedTargetSlug, setSpeedTargetSlug] = useState("");
  const [speedTargetSp, setSpeedTargetSp] = useState(0);
  const [speedTargetNature, setSpeedTargetNature] = useState("Serious");
  const [speedTrickRoom, setSpeedTrickRoom] = useState(false);
  const [speedPreviews, setSpeedPreviews] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(0);
  const [speedTargetPickerOpen, setSpeedTargetPickerOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(initialDraft.preserveStored ? "Rascunho salvo preservado" : "Rascunho local");
  const [message, setMessage] = useState(initialDraft.message);
  const selectedMember = team.members[selectedSlot];
  const teamAnalysis = useMemo(() => calculateTeamAnalysis(team, dexData.pokemon, moveData.moves), [team]);
  const selectedPokemon = useMemo(
    () => selectedMember ? pokemonWithDetails(selectedMember.pokemonId) : null,
    [selectedMember],
  );
  const selectedComputedStats = useMemo(() => {
    if (!selectedPokemon || !selectedMember) return null;
    try {
      return calculateChampionsStats({
        species: getDamageSpeciesName(selectedPokemon.slug),
        nature: selectedMember.nature || "Serious",
        statPoints: selectedMember.statPoints,
      });
    } catch {
      return null;
    }
  }, [selectedPokemon, selectedMember]);
  const moveListId = "move-options";
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
    const preview = {
      ...savedPreview,
      sp: Number(member.statPoints.spe) || 0,
      natureTouched: Boolean(savedPreview?.natureTouched),
      ...(savedPreview?.sp !== undefined ? { sp: savedPreview.sp } : {}),
      nature: resolveSpeedPreviewNature(member.nature, savedPreview),
    };
    const availableSpeedSp = maximumLegalSpeedPoints(member.statPoints);
    const previewSpeedPoints = Math.min(availableSpeedSp, CHAMPIONS_MAX_STAT_POINTS, Math.max(0, Number(preview.sp) || 0));
    const appliedPreview = applySpeedPointsToStatSpread(member.statPoints, previewSpeedPoints);
    const speed = appliedPreview.ok ? calculateChampionsSpeed(pokemon.stats.spe, previewSpeedPoints, preview.nature) : null;
    const relation = appliedPreview.ok ? compareSpeed(speed, speedTargetValue) : "unknown";
    const recommendation = appliedPreview.ok
      ? getChampionsSpeedRecommendation({ baseSpeed: pokemon.stats.spe, targetSpeed: speedTargetValue, nature: preview.nature, availableSpeedSp })
      : null;
    const order = appliedPreview.ok ? compareSpeedOrder(speed, speedTargetValue, speedTrickRoom) : "unknown";
    return { member, pokemon, index, preview: { ...preview, sp: previewSpeedPoints }, speed, relation, order, recommendation, availableSpeedSp };
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

  function importShowdownPaste() {
    const result = importShowdownTeam(showdownInput, dexData.pokemon);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const consequences = [
      team.members.some(Boolean) ? "A importação substituirá as seis posições e as configurações atuais do rascunho." : "A equipe será salva neste navegador.",
      ...(result.warnings.length ? [`Avisos:\n${result.warnings.join("\n")}`] : []),
    ].join("\n\n");
    if ((team.members.some(Boolean) || result.warnings.length) && !window.confirm(consequences)) return;
    const saved = commitTeam(result.value);
    setSelectedSlot(Math.max(0, result.value.members.findIndex(Boolean)));
    setSpeedPreviews({});
    setShowdownInput("");
    setMessage(saved ? "Equipe Showdown importada. Revise os golpes e a legalidade no formato selecionado." : "Equipe importada, mas não foi possível salvá-la neste navegador.");
  }

  async function copyShowdownPaste() {
    const text = exportShowdownTeam(team, dexData.pokemon);
    if (!text) {
      setMessage("Adicione ao menos um Pokémon para preparar o texto da equipe.");
      return;
    }
    setShowdownExport(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Texto Showdown copiado. Você pode colá-lo em uma nova Poképaste.");
    } catch {
      setMessage("Texto preparado abaixo. A cópia automática não está disponível neste navegador.");
    }
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
    const savedPreview = speedPreviews[index];
    const preview = {
      ...savedPreview,
      sp: Number(member.statPoints.spe) || 0,
      natureTouched: Boolean(savedPreview?.natureTouched),
      ...(savedPreview?.sp !== undefined ? { sp: savedPreview.sp } : {}),
      nature: resolveSpeedPreviewNature(member.nature, savedPreview),
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
      nature: preview.natureTouched ? (getNature(preview.nature)?.name || member.nature) : member.nature,
      statPoints: appliedSpread.statPoints,
    };
    commitTeam({ ...team, members });
    setMessage(`A prévia foi aplicada à posição ${index + 1}.`);
  }

  function selectSpeedTarget(pokemon) {
    setSpeedTargetSlug(pokemon.slug);
    setSpeedTargetSp(0);
    setSpeedTargetNature("Serious");
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

              <p className="builder-ready-set-note field-wide">Sets prontos ainda não estão disponíveis: as fontes publicam golpes, itens, Nature e SP como distribuições separadas, sem relação verificável entre eles.</p>

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

                <NaturePicker id="member-nature" label="Nature do set" value={selectedMember.nature || "Serious"} onChange={(nature) => updateMember({ nature })} className="field-wide" />
                {selectedComputedStats ? <dl className="builder-nature-stats field-wide" aria-label="Stats calculados conforme a Nature e os pontos investidos">
                  {[["hp", "HP"], ["atk", "Atk"], ["def", "Def"], ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"]].map(([key, label]) => <div key={key} data-stat={key}><dt>{label}</dt><dd>{selectedComputedStats[key]}</dd></div>)}
                </dl> : <p className="builder-nature-stats-note field-wide" role="status">Os stats deste set não podem ser calculados até a distribuição e a Nature serem válidas.</p>}

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
                  <summary>Conferir pontos investidos <span>{pointTotal} distribuídos</span></summary>
                  <p className="form-hint">Limite usado pelo formato comunitário: 32 pontos por atributo e 66 no set. Isso não confirma uma regra oficial do jogo. {pointRemaining >= 0 ? `Restam ${pointRemaining} pontos.` : `O set excede o orçamento em ${Math.abs(pointRemaining)} pontos.`}</p>
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

        <TeamAnalysis analysis={teamAnalysis} />
      </section>

      <section className="builder-speed-panel" aria-labelledby="builder-speed-title">
        <div className="builder-speed-heading">
          <div><p className="page-label">Comparação temporária · Champions</p><h2 id="builder-speed-title">Speed do time</h2></div>
          <label className="speed-trick-room-toggle"><input type="checkbox" checked={speedTrickRoom} onChange={(event) => setSpeedTrickRoom(event.target.checked)} /><span>Trick Room ativo</span><small>Ordem invertida; Speed bruta preservada.</small></label>
          <Link className="button button-outline button-small" to={speedTargetPokemon ? `/speed-tiers?target=${encodeURIComponent(speedTargetPokemon.slug)}` : "/speed-tiers"}>Abrir Speed Tiers</Link>
        </div>
        <div className={speedTargetPokemon ? "builder-speed-target" : "builder-speed-target is-empty"}>
          {speedTargetPokemon ? <>
            <PokemonSprite pokemon={speedTargetPokemon} name={speedTargetPokemon.name} size={52} decorative />
            <div className="builder-speed-target-name"><small>Adversário escolhido</small><strong>{speedTargetPokemon.name}</strong><span>{speedTargetValue} Speed · nível 50</span></div>
            <label><span>SP do alvo</span><input className="text-input" type="number" min="0" max="32" value={speedTargetSp} onChange={(event) => setSpeedTargetSp(Math.min(32, Math.max(0, Number(event.target.value) || 0)))} /></label>
            <NaturePicker id="builder-target-nature" label="Nature do alvo" value={speedTargetNature} onChange={setSpeedTargetNature} className="builder-target-nature" />
            <button className="button button-quiet button-small" type="button" onClick={() => setSpeedTargetPickerOpen(true)}>Trocar alvo</button>
          </> : <>
            <div className="builder-speed-target-placeholder"><strong>Escolha um adversário</strong><span>Compare os seis do time ao mesmo tempo.</span></div>
            <button className="button button-primary button-small" type="button" onClick={() => setSpeedTargetPickerOpen(true)}>Selecionar Pokémon</button>
          </>}
        </div>
        {speedTargetPokemon ? <div className="builder-speed-grid" aria-label="Comparação dos seis Pokémon do time">
          {speedComparisonRows.map(({ member, pokemon, index, preview, speed, relation, order, recommendation, availableSpeedSp }) => {
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
            const favorableNatureText = !appliedSpread.ok || relation === "faster" || recommendation.canOutspeed || getNatureSpeedClass(preview.nature) === "favorable"
              ? ""
              : recommendation.favorableRequiredSp === null
                ? "Nem Timid (Velocidade ↑) + 32 SP ultrapassa"
                : recommendation.favorableCanOutspeed
                  ? `Timid (Velocidade ↑): ${recommendation.favorableRequiredSp} SP passa`
                  : `Timid (Velocidade ↑): precisa ${recommendation.favorableRequiredSp} SP; ${availableSpeedSp} disponíveis`;
            const remainingText = appliedSpread.ok
              ? `${remainingSp} SP livres`
              : "revise a distribuição";
            return <article className={`builder-speed-row is-${relation}`} key={index} data-speed={speed} data-target-speed={speedTargetValue} data-relation={relation} data-order={order}>
              <div className="builder-speed-identity"><PokemonSprite pokemon={pokemon} name={pokemon.name} size={48} decorative /><div><strong>{pokemon.name}</strong><small>{speed ?? "—"} Speed · {relation === "faster" ? "ultrapassa" : relation === "tie" ? "empata" : relation === "slower" ? "abaixo" : "sem dado"}{order === "first" ? " · atua antes" : order === "second" ? " · atua depois" : ""}</small></div></div>
              <label className="builder-speed-sp"><span>SP de Speed · temporário</span><div><input aria-label={`SP temporário de Speed de ${pokemon.name}`} type="range" min="0" max={availableSpeedSp} value={preview.sp} onChange={(event) => updateSpeedPreview(index, "sp", Number(event.target.value))} /><input className="text-input" type="number" min="0" max={availableSpeedSp} value={preview.sp} onChange={(event) => updateSpeedPreview(index, "sp", Number(event.target.value))} aria-label={`Valor temporário de SP de Speed de ${pokemon.name}`} /></div><small>{availableSpeedSp} SP disponíveis em Speed · máximo de 32 por atributo</small></label>
              <NaturePicker id={`builder-speed-nature-${index}`} label="Nature temporária" value={preview.nature} onChange={(nature) => updateSpeedPreview(index, "nature", nature)} className="builder-speed-nature" />
              <div className="builder-speed-action"><span>{recommendationText} · {remainingText}</span>{favorableNatureText && <small className="builder-speed-favorable-note">{favorableNatureText}</small>}<button className="button button-outline button-small" type="button" onClick={() => applySpeedPreview(index)} disabled={!appliedSpread.ok} aria-disabled={!appliedSpread.ok}>Aplicar ao set</button>{!appliedSpread.ok && <small role="status">{appliedSpread.error}</small>}</div>
            </article>;
          })}
        </div> : <div className="builder-speed-hint">Prévia separada do set; use “Aplicar ao set” para salvar SP e Nature.</div>}
        {speedTargetPokemon && <div className="builder-speed-hint">Prévia não salva; use “Aplicar ao set” para gravar as mudanças. Trick Room altera a ordem, não a Speed exibida.</div>}
      </section>

      <details className="builder-tools-details">
        <summary>Importar ou exportar equipe</summary>
        <div className="builder-showdown-tools">
          <section aria-labelledby="builder-showdown-import-title">
            <h2 id="builder-showdown-import-title">Colar do Showdown ou Poképaste</h2>
            <p>Copie o texto exportado da equipe e cole aqui. Importar uma URL do Poképaste não está disponível.</p>
            <label className="builder-paste-label" htmlFor="builder-showdown-input">Texto da equipe</label>
            <textarea id="builder-showdown-input" className="text-input builder-paste-input" value={showdownInput} onChange={(event) => setShowdownInput(event.target.value)} placeholder={"Garchomp @ Life Orb\nAbility: Rough Skin\nJolly Nature\n- Earthquake"} />
            <button className="button button-primary" type="button" onClick={importShowdownPaste}>Importar texto</button>
          </section>
          <section aria-labelledby="builder-showdown-export-title">
            <h2 id="builder-showdown-export-title">Copiar equipe</h2>
            <p>No formato Champions do Showdown, o campo EVs representa os Stat Points. Os valores são copiados diretamente, sem conversão. <a href="https://github.com/smogon/pokemon-showdown/blob/master/sim/TEAMS.md" target="_blank" rel="noreferrer">Ver formato oficial ↗</a></p>
            <label className="builder-paste-label" htmlFor="builder-showdown-export">Texto exportado</label>
            <textarea id="builder-showdown-export" className="text-input builder-paste-input" value={showdownExport} readOnly placeholder="O texto da equipe aparecerá aqui." />
            <button className="button button-outline" type="button" onClick={copyShowdownPaste}>Preparar e copiar texto</button>
          </section>
        </div>
        <div className="builder-actions builder-json-actions">
          <button className="button button-outline" type="button" onClick={() => importRef.current?.click()}>Importar JSON</button>
          <button className="button button-outline" type="button" onClick={exportTeam}>Exportar JSON</button>
          <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importTeam} aria-label="Selecionar arquivo de equipe JSON" />
        </div>
      </details>

      <details className="builder-rules-details">
        <summary>Sobre cálculo e validação</summary>
        <div className="rules-warning" role="note">
          <span className="warning-mark">Regras</span>
          <p>Speed usa o modelo nível 50 com até 32 SP por atributo e 66 no set; IVs, boosts, clima, itens, habilidades e Tailwind ficam fora. O editor não confirma regulamento nem legalidade.</p>
        </div>
      </details>

      <TeamAccountPanel onSave={saveTeamToAccount} onLoad={loadAccountTeam} />

      <p className="form-message" role="status" aria-live="polite">{message}</p>
      <SpeciesPicker open={pickerOpen} pokemon={dexData.pokemon} onChoose={choosePokemon} onClose={() => setPickerOpen(false)} />
      <SpeciesPicker idPrefix="speed-target" open={speedTargetPickerOpen} pokemon={dexData.pokemon} onChoose={selectSpeedTarget} onClose={() => setSpeedTargetPickerOpen(false)} />
    </div>
  );
}

function TeamAnalysis({ analysis }) {
  function multiplierLabel(value) {
    if (value === 0) return "0×";
    if (value < 1) return ({ 0.5: "½×", 0.25: "¼×", 0.125: "⅛×" })[value] || `${value}×`;
    return `${value}×`;
  }

  function relationGroup(title, items, kind) {
    return (
      <section className={`team-analysis-relation is-${kind}`}>
        <h3>{title}</h3>
        {items.length ? <ul>{items.map(({ type, counts }) => <li key={type}><TypeTag type={type} /><span>{counts.map(([multiplier, count]) => `${count} ${count === 1 ? "integrante" : "integrantes"} · ${multiplierLabel(multiplier)}`).join(" / ")}</span></li>)}</ul> : <p className="team-analysis-empty">Nenhum tipo nesta categoria.</p>}
      </section>
    );
  }

  return (
    <aside className="builder-team-analysis" aria-labelledby="team-analysis-title">
      <div className="team-analysis-heading"><div><p className="page-label">Visão da equipe</p><h2 id="team-analysis-title">Análise da equipe</h2></div><span>{analysis.filledSlots}/6</span></div>
      <section className="team-analysis-coverage" aria-labelledby="team-coverage-title">
        <div><h3 id="team-coverage-title">Cobertura ofensiva</h3><p>Melhor efetividade dos golpes equipados contra cada tipo puro.</p></div>
        {analysis.attackTypes.length ? <ul className="team-analysis-type-grid">{analysis.coverage.map(({ type, multiplier }) => <li key={type} className={multiplier > 1 ? "is-effective" : ""}><TypeTag type={type} /><strong>{multiplier === null ? "—" : multiplierLabel(multiplier)}</strong></li>)}</ul> : <p className="team-analysis-empty">Adicione golpes de dano reconhecidos para ver a cobertura. Golpes de status não entram no cálculo.</p>}
        {analysis.attackTypes.length ? <p className="team-analysis-note">Tipos sem cobertura super efetiva: {analysis.blindSpots.length ? analysis.blindSpots.map((type) => type.slice(0, 3).toUpperCase()).join(", ") : "nenhum contra tipos puros"}.</p> : null}
        <p className="team-analysis-note">A análise considera só o tipo do golpe. Não inclui STAB, habilidade, item, clima, campo ou combinação com os tipos do alvo.</p>
      </section>
      <div className="team-analysis-defenses">
        {relationGroup("Fraquezas", analysis.weaknesses, "weakness")}
        {relationGroup("Resistências", analysis.resistances, "resistance")}
        {relationGroup("Imunidades", analysis.immunities, "immunity")}
      </div>
      <p className="team-analysis-note">Defesas calculadas pelos tipos de cada integrante, incluindo multiplicadores duplos. Habilidades e efeitos de itens não são simulados.</p>
    </aside>
  );
}

function safeFileName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "spinda-stop-team";
}
