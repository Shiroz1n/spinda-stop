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
import { BuilderMetaPanel } from "../components/BuilderMetaPanel.jsx";
import { PublicTournamentTeams } from "../components/PublicTournamentTeams.jsx";
import { applyBuilderMetaOption, hasDuplicateMove } from "../data/builderMeta.js";
import { buildDamageCalculatorSearch, calculateChampionsStats, getDamageSpeciesName } from "../data/damageCalculator.js";
import { getPokepasteRawUrl } from "../data/pokepaste.js";
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

function createInitialDraft(pokemonSlug, metaOption) {
  const saved = readSavedTeam();
  const team = saved.team;
  const pokemon = pokemonWithDetails(pokemonSlug);
  if (!pokemon) return { team, selectedSlot: 0, message: saved.message, preserveStored: saved.preserveStored };

  const result = addPokemonToDraft(team, pokemon);
  let nextTeam = result.team;
  let metaMessage = "";
  if (metaOption && result.status !== "full") {
    const applied = applyBuilderMetaOption(nextTeam.members[result.selectedSlot], metaOption.category, metaOption.row);
    if (applied.ok && applied.changed) {
      const members = [...nextTeam.members];
      members[result.selectedSlot] = applied.member;
      nextTeam = { ...nextTeam, members };
      metaMessage = applied.message;
    } else if (!applied.ok) metaMessage = applied.error;
    else metaMessage = applied.message;
  }
  const slotLabel = result.selectedSlot + 1;
  const messages = {
    added: `${pokemon.name} adicionado à posição ${slotLabel}.`,
    existing: `${pokemon.name} já está na posição ${slotLabel}. O set existente foi mantido.`,
    full: "O time está cheio. Escolha uma posição no construtor antes de substituir alguém.",
  };

  return {
    team: nextTeam,
    selectedSlot: result.selectedSlot,
    message: [saved.message, messages[result.status], metaMessage].filter(Boolean).join(" "),
    preserveStored: saved.preserveStored,
  };
}

export function BuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const importRef = useRef(null);
  const accountDetailsRef = useRef(null);
  const consumedPublicImport = useRef(null);
  const [initialDraft] = useState(() => createInitialDraft(location.state?.pokemonSlug, location.state?.metaOption));
  const [team, setTeam] = useState(initialDraft.team);
  const [showdownInput, setShowdownInput] = useState("");
  const [showdownExport, setShowdownExport] = useState("");
  const [pokepasteUrl, setPokepasteUrl] = useState("");
  const [builderTab, setBuilderTab] = useState("team");
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
  const [moveError, setMoveError] = useState(null);
  const selectedMember = team.members[selectedSlot];
  const teamAnalysis = useMemo(() => calculateTeamAnalysis(team, dexData.pokemon, moveData.moves), [team]);
  const selectedPokemonId = selectedMember?.pokemonId;
  const selectedPokemon = useMemo(() => selectedPokemonId ? pokemonWithDetails(selectedPokemonId) : null, [selectedPokemonId]);
  const teamReferencePokemon = useMemo(() => selectedPokemon || pokemonWithDetails(team.members.find(Boolean)?.pokemonId), [selectedPokemon, team.members]);
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
    const publicPaste = location.state?.publicTournamentPaste;
    const importKey = location.state?.publicTournamentImportKey || publicPaste;
    if (publicPaste && importKey && consumedPublicImport.current !== importKey) {
      consumedPublicImport.current = importKey;
      const source = location.state?.publicTournamentSource || "";
      const name = location.state?.publicTournamentName || "teamlist pública";
      const sourceHost = (() => { try { return new URL(source).hostname; } catch { return "Limitless"; } })();
      if (typeof publicPaste === "string" && publicPaste.trim()) importShowdownText(publicPaste, { allowPartial: true, sourceNotice: `${name} · ${sourceHost}` });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Router state is a one-shot import result that must be surfaced without replacing the draft.
      else setMessage("A teamlist pública não pôde ser convertida para o catálogo atual; nenhuma posição foi substituída.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (location.state?.pokemonSlug || location.state?.metaOption) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state?.pokemonSlug, location.state?.metaOption, location.state?.publicTournamentPaste, location.state?.publicTournamentImportKey, location.state?.publicTournamentName, location.state?.publicTournamentSource, navigate, importShowdownText]);

  useEffect(() => {
    if (initialDraft.preserveStored) return;
    try { localStorage.setItem(STORAGE_KEY, serializeTeam(initialDraft.team)); } catch { /* Export remains available if storage is blocked. */ }
  }, [initialDraft]);

  function commitTeam(nextTeam) {
    setMoveError(null);
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

  function applyMetaOption(category, row) {
    const applied = applyBuilderMetaOption(selectedMember, category, row);
    if (!applied.ok || !applied.changed) {
      setMessage(applied.error || applied.message);
      return;
    }
    const members = [...team.members];
    members[selectedSlot] = applied.member;
    const saved = commitTeam({ ...team, members });
    setMessage(saved ? applied.message : `${applied.message} Não foi possível salvar neste navegador.`);
  }

  function chooseForSlot(slot) {
    setMoveError(null);
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

  function importShowdownText(text, options = {}) {
    const { allowPartial = false, sourceNotice = "" } = options;
    const result = importShowdownTeam(text, dexData.pokemon, { allowPartial });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const consequences = [
      team.members.some(Boolean) ? "A importação substituirá as seis posições e as configurações atuais do rascunho." : "A equipe será salva neste navegador.",
      ...(sourceNotice ? [`Origem: ${sourceNotice}.`] : []),
      ...(result.warnings.length ? [`Avisos:\n${result.warnings.join("\n")}`] : []),
    ].join("\n\n");
    if ((team.members.some(Boolean) || result.warnings.length) && !window.confirm(consequences)) return;
    const saved = commitTeam(result.value);
    setSelectedSlot(Math.max(0, result.value.members.findIndex(Boolean)));
    setSpeedPreviews({});
    setShowdownInput("");
    setBuilderTab("team");
    setMessage(saved ? `${sourceNotice ? `Equipe pública importada de ${sourceNotice}.` : "Equipe Showdown importada."} Revise os campos disponíveis e a legalidade no formato selecionado.` : "Equipe importada, mas não foi possível salvá-la neste navegador.");
  }

  function importShowdownPaste() {
    importShowdownText(showdownInput);
  }

  async function importPokepasteUrl() {
    const url = getPokepasteRawUrl(pokepasteUrl);
    if (!url) {
      setMessage("Informe um link válido de pokepast.es.");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit", signal: controller.signal });
      if (!response.ok) throw new Error("unavailable");
      const text = await response.text();
      if (text.length > 128 * 1024) throw new Error("too_large");
      setShowdownInput(text);
      importShowdownText(text);
    } catch {
      setMessage("Não foi possível ler esse Poképaste. Confira o link ou cole o texto exportado.");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function applyPublicSet(member, sourceTeam, supplied = {}) {
    const slot = selectedMember?.pokemonId === member.pokemonId
      ? selectedSlot
      : team.members.findIndex((entry) => entry?.pokemonId === member.pokemonId);
    if (slot < 0) return;
    const categories = [
      supplied.ability && "habilidade",
      supplied.item && "item",
      supplied.nature && "Nature",
      supplied.statPoints && "Stat Points",
      supplied.level && "nível",
      supplied.moves > 0 && "golpes",
    ].filter(Boolean);
    if (!categories.length) {
      setMessage("Esta equipe não publicou campos de set aplicáveis para esse Pokémon.");
      return;
    }
    const pokemonName = pokemonWithDetails(member.pokemonId)?.name || "este Pokémon";
    const missing = [
      !supplied.ability && "habilidade",
      !supplied.item && "item",
      !supplied.nature && "Nature",
      !supplied.statPoints && "Stat Points",
      !supplied.level && "nível",
      !supplied.moves && "golpes",
    ].filter(Boolean);
    const partialMoves = supplied.moves > 0 && supplied.moves < 4
      ? ` Só ${supplied.moves} de 4 golpes foi publicado; os demais espaços ficarão vazios.`
      : "";
    const confirmText = `Este set substituirá ${categories.join(", ")} de ${pokemonName} na posição ${slot + 1}.${partialMoves}${missing.length ? ` Os campos sem publicação (${missing.join(", ")}) serão mantidos.` : ""} Deseja continuar?`;
    if (!window.confirm(confirmText)) return;
    const members = [...team.members];
    members[slot] = {
      ...members[slot],
      ...(supplied.ability ? { ability: member.ability } : {}),
      ...(supplied.item ? { item: member.item } : {}),
      ...(supplied.nature ? { nature: member.nature } : {}),
      ...(supplied.statPoints ? { statPoints: member.statPoints } : {}),
      ...(supplied.level ? { level: member.level } : {}),
      ...(supplied.moves > 0 ? { moves: member.moves } : {}),
    };
    commitTeam({ ...team, members });
    setSelectedSlot(slot);
    setBuilderTab("team");
    setMessage(`Dados publicados de ${sourceTeam.event || "equipe pública"} aplicados à posição ${slot + 1}.`);
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

  async function shareTeam() {
    const text = exportShowdownTeam(team, dexData.pokemon);
    if (!text) {
      setMessage("Adicione um Pokémon antes de compartilhar a equipe.");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: team.name, text });
        setMessage("Equipe compartilhada.");
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage("Texto da equipe copiado para compartilhar.");
    } catch (error) {
      if (error.name === "AbortError") return;
      setMessage("Não foi possível compartilhar a equipe neste navegador.");
    }
  }

  function clearTeam() {
    if ((filledSlots > 0 || team.name !== "Meu time") && !window.confirm("Limpar as seis posições e começar uma equipe nova?")) return;
    commitTeam(createEmptyTeam());
    setSelectedSlot(0);
    setSpeedPreviews({});
    setDamageOpponentSlot(-1);
    setMessage("Equipe nova pronta.");
  }

  function showAccountTeams() {
    if (!accountDetailsRef.current) return;
    accountDetailsRef.current.open = true;
    accountDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateMove(index, value) {
    if (value && hasDuplicateMove(selectedMember.moves, value, index)) {
      setMoveError({ slot: selectedSlot, index, name: value });
      setMessage("");
      return;
    }
    setMoveError(null);
    const moves = [...selectedMember.moves];
    moves[index] = value;
    setMessage("");
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

      <nav className="builder-action-toolbar" aria-label="Ações da equipe">
        <button className="button builder-action-share" type="button" onClick={shareTeam}>Compartilhar</button>
        <button className="button button-outline" type="button" onClick={() => { commitTeam(team); setMessage("Rascunho salvo neste navegador."); }}>Salvar</button>
        <button className="button button-outline" type="button" onClick={showAccountTeams}>Minhas equipes / carregar</button>
        <button className="button button-outline" type="button" onClick={() => setBuilderTab("paste")}>Importar</button>
        <button className="button button-outline" type="button" onClick={() => { setBuilderTab("paste"); void copyShowdownPaste(); }}>Exportar</button>
        <button className="button button-quiet" type="button" onClick={clearTeam}>Nova equipe / limpar</button>
      </nav>

      <section className="builder-workspace">
        <div className="builder-center-column">
        <div className="builder-workbench-tabs" role="group" aria-label="Área de trabalho da equipe">
          {[["team", "Equipe"], ["meta", "Meta"], ["paste", "Poképaste"]].map(([key, label]) => <button type="button" key={key} aria-pressed={builderTab === key} onClick={() => setBuilderTab(key)}>{label}</button>)}
        </div>

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
                  onClick={() => { setMoveError(null); entry ? setSelectedSlot(index) : chooseForSlot(index); }}
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
        </div>

        {builderTab === "team" && <div className="editor-column">
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
                    <input id={`move-${index}`} className="text-input" list={moveListId} value={move} maxLength={100} onChange={(event) => updateMove(index, event.target.value)} placeholder="Buscar golpe" aria-label={`Golpe ${index + 1}`} aria-invalid={moveError?.slot === selectedSlot && moveError.index === index} aria-describedby={moveError?.slot === selectedSlot && moveError.index === index ? `move-${index}-error` : undefined} />
                    {moveError?.slot === selectedSlot && moveError.index === index && <small id={`move-${index}-error`} className="move-field-error" role="alert">{moveError.name} já está neste set.</small>}
                  </label>
                ))}
                <details className="builder-compatibility field-wide"><summary>Compatibilidade do set</summary><p>Golpes gerais; legalidade não verificada.</p></details>

                <details className="points-section field-wide">
                  <summary>Conferir pontos investidos <span>{pointTotal} distribuídos</span></summary>
                  <p className="form-hint">Até 32 SP por atributo e 66 no set; legalidade não verificada. {pointRemaining >= 0 ? `Restam ${pointRemaining} SP.` : `Excede o limite em ${Math.abs(pointRemaining)} SP.`}</p>
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
        </div>}

        {builderTab === "meta" && (selectedPokemon
          ? <BuilderMetaPanel key={selectedPokemon.slug} pokemon={selectedPokemon} member={selectedMember} onApplyOption={applyMetaOption} />
          : <section className="builder-meta-empty"><h2>Meta da equipe</h2><p>Adicione um Pokémon para consultar suas distribuições.</p></section>)}

        {builderTab === "paste" && <section className="builder-paste-panel" aria-labelledby="builder-paste-title">
          <div className="builder-paste-heading"><div><p className="page-label">Showdown · Poképaste</p><h2 id="builder-paste-title">Importar ou exportar equipe</h2></div><Link to="/usage">Consultar meta ↗</Link></div>
          <div className="builder-showdown-tools">
            <section aria-labelledby="builder-showdown-import-title">
              <h3 id="builder-showdown-import-title">Importar texto</h3>
              <label className="builder-paste-label" htmlFor="builder-pokepaste-url">Link do Poképaste</label>
              <div className="builder-pokepaste-url"><input id="builder-pokepaste-url" className="text-input" type="url" inputMode="url" autoComplete="url" value={pokepasteUrl} onChange={(event) => setPokepasteUrl(event.target.value)} placeholder="https://pokepast.es/…" /><button className="button button-outline" type="button" onClick={importPokepasteUrl}>Importar link</button></div>
              <label className="builder-paste-label" htmlFor="builder-showdown-input">Cole o texto exportado</label>
              <textarea id="builder-showdown-input" className="text-input builder-paste-input" value={showdownInput} onChange={(event) => setShowdownInput(event.target.value)} placeholder={"Garchomp @ Life Orb\nAbility: Rough Skin\nJolly Nature\n- Earthquake"} />
              <button className="button button-primary" type="button" onClick={importShowdownPaste}>Importar texto</button>
            </section>
            <section aria-labelledby="builder-showdown-export-title">
              <h3 id="builder-showdown-export-title">Exportar equipe</h3>
              <label className="builder-paste-label" htmlFor="builder-showdown-export">Texto Showdown</label>
              <textarea id="builder-showdown-export" className="text-input builder-paste-input" value={showdownExport} readOnly placeholder="Prepare a equipe para copiar." />
              <button className="button button-outline" type="button" onClick={copyShowdownPaste}>Preparar e copiar</button>
              <details className="builder-format-details"><summary>Formato e limites</summary><p>Showdown guarda SP no campo EVs; legalidade não é verificada. <a href="https://github.com/smogon/pokemon-showdown/blob/master/sim/TEAMS.md" target="_blank" rel="noreferrer">Formato ↗</a></p></details>
            </section>
          </div>
          <details className="builder-json-details"><summary>Importar ou exportar JSON</summary><div className="builder-actions builder-json-actions"><button className="button button-outline" type="button" onClick={() => importRef.current?.click()}>Importar JSON</button><button className="button button-outline" type="button" onClick={exportTeam}>Exportar JSON</button><input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importTeam} aria-label="Selecionar arquivo de equipe JSON" /></div></details>
        </section>}
        </div>
        <TeamAnalysis analysis={teamAnalysis} />

        {teamReferencePokemon ? <PublicTournamentTeams key={teamReferencePokemon.slug} pokemon={teamReferencePokemon} selectedPokemon={teamReferencePokemon} onImport={importShowdownText} onApplySet={applyPublicSet} /> : <aside className="builder-public-teams builder-public-empty"><p className="page-label">Arquivo público · M-C</p><h2>Equipes de torneio</h2><p>Adicione um Pokémon para encontrar equipes arquivadas com ele.</p></aside>}
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
        </div> : <div className="builder-speed-hint">Ajuste um alvo para comparar. Trick Room muda a ordem de ação.</div>}
      </section>

      <details className="builder-rules-details">
        <summary>Sobre cálculo e validação</summary>
        <div className="rules-warning" role="note">
          <span className="warning-mark">Regras</span>
          <p>Speed compara stats no nível 50 e Nature. Efeitos de campo, IVs e legalidade não são simulados.</p>
        </div>
      </details>

      <details ref={accountDetailsRef} className="builder-account-details"><summary>Equipes da conta</summary><TeamAccountPanel onSave={saveTeamToAccount} onLoad={loadAccountTeam} /></details>

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
      <div className="team-analysis-heading"><div><p className="page-label">Visão da equipe</p><h2 id="team-analysis-title">Análise da equipe</h2></div></div>
      <ul className="team-analysis-summary" aria-label="Resumo da equipe">
        <li><strong>{analysis.filledSlots}/6</strong><span>Pokémon</span></li>
        <li><strong>{analysis.attackTypes.length}</strong><span>Tipos de golpes equipados</span></li>
        <li><strong>{analysis.coverage.filter(({ multiplier }) => multiplier > 1).length}/18</strong><span>Tipos cobertos a 2× ou mais</span></li>
      </ul>
      <section className="team-analysis-coverage" aria-labelledby="team-coverage-title">
        <div><h3 id="team-coverage-title">Cobertura de tipos</h3><p>Golpes equipados · melhor multiplicador</p></div>
        {analysis.attackTypes.length ? <ul className="team-analysis-type-grid">{analysis.coverage.map(({ type, multiplier }) => <li key={type} className={multiplier > 1 ? "is-effective" : ""}><TypeTag type={type} /><strong>{multiplier === null ? "—" : multiplierLabel(multiplier)}</strong></li>)}</ul> : <p className="team-analysis-empty">Adicione um golpe de dano.</p>}
        {analysis.attackTypes.length ? <p className="team-analysis-note">Tipos sem cobertura super efetiva: {analysis.blindSpots.length ? analysis.blindSpots.map((type) => type.slice(0, 3).toUpperCase()).join(", ") : "nenhum contra tipos puros"}.</p> : null}
      </section>
      <div className="team-analysis-defenses">
        {relationGroup("Fraquezas", analysis.weaknesses, "weakness")}
        {relationGroup("Resistências", analysis.resistances, "resistance")}
        {relationGroup("Imunidades", analysis.immunities, "immunity")}
      </div>
      <details className="team-analysis-help"><summary>Como é calculado</summary><p>Golpes usam o tipo puro do alvo; defesas combinam os tipos da equipe. Habilidades e itens não entram.</p></details>
    </aside>
  );
}

function safeFileName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "spinda-stop-team";
}
