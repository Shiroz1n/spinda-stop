import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { addPokemonToDraft, createEmptyTeam, parseTeam, serializeTeam, setTeamMember } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import moveData from "@spinda-stop/data/moves";
import natureData from "@spinda-stop/data/natures";
import { SpeciesPicker } from "../components/SpeciesPicker.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { buildDamageCalculatorSearch } from "../data/damageCalculator.js";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(0);
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

  function toDamageSide(member, pokemon) {
    return {
      species: pokemon.name,
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
      : { species: "Garchomp", nature: "Serious", statPoints: Object.fromEntries(STAT_FIELDS.map(([key]) => [key, 0])) };
    const attacker = selectedRole === "attacker" ? selectedSide : otherSide;
    const defender = selectedRole === "defender" ? selectedSide : otherSide;
    const move = attacker.moves?.find((entry) => entry.trim()) || "";
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

  const filledSlots = team.members.filter(Boolean).length;
  const pointTotal = selectedMember
    ? Object.values(selectedMember.statPoints).reduce((sum, value) => sum + value, 0)
    : 0;

  return (
    <div className="page-wrap builder-page">
      <div className="page-heading-row builder-heading">
        <div>
          <p className="page-label">Construtor local · Doubles</p>
          <h1>Monte seu time</h1>
          <p className="page-intro">Edite seis posições, salve o rascunho no navegador e exporte um arquivo para levar com você.</p>
        </div>
        <div className="builder-actions">
          <button className="button button-outline" type="button" onClick={() => importRef.current?.click()}>Importar JSON</button>
          <button className="button button-primary" type="button" onClick={exportTeam}>Exportar JSON</button>
          <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importTeam} aria-label="Selecionar arquivo de equipe JSON" />
        </div>
      </div>

      <div className="rules-warning" role="note">
        <span className="warning-mark">Regras</span>
        <p><strong>Rascunho sem validação do jogo.</strong> Regras de Stat Points, golpes, habilidades e espécies ainda não foram confirmadas por regulamento.</p>
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
                <div>
                  <p className="page-label">Posição {selectedSlot + 1} · set geral</p>
                  <h2 id="active-member-title">{selectedPokemon.name}</h2>
                  {selectedPokemon.formName && <p className="form-note">{selectedPokemon.speciesName} · {selectedPokemon.formName}</p>}
                  <div className="type-list">{selectedPokemon.types.map((type) => <TypeTag key={type} type={type} />)}</div>
                  <p className="form-hint builder-usage-hint">A consulta mostra tendências da fonte sem alterar este set.</p>
                  <p className="form-hint builder-usage-hint">A calculadora abre em nível 50 e pode levar os sets dos dois lados. O cálculo começa pelo primeiro golpe preenchido do atacante.</p>
                </div>
                <div className="set-heading-actions">
                  <Link className="button button-outline button-small" to={`/usage?pokemon=${encodeURIComponent(selectedPokemon.name)}`} aria-label={`Ver tendências de ${selectedPokemon.name} em Usage`}>
                    Ver tendências de Usage
                  </Link>
                  <label className="builder-damage-opponent">
                    <span>Outro lado da simulação</span>
                    <select className="text-input" aria-label="Outro Pokémon para a calculadora" value={selectedDamageOpponent ? String(selectedDamageOpponent.index) : ""} onChange={(event) => setDamageOpponentSlot(Number(event.target.value))}>
                      {selectedDamageOpponent ? null : <option value="">Garchomp padrão</option>}
                      {damageOpponents.map(({ index, pokemon }) => <option value={index} key={index}>{`Posição ${index + 1} · ${pokemon.name}`}</option>)}
                    </select>
                  </label>
                  <Link className="button button-outline button-small" to={calculatorUrl("attacker")} aria-label={`Usar ${selectedPokemon.name} como atacante na calculadora`}>
                    Como atacante
                  </Link>
                  <Link className="button button-outline button-small" to={calculatorUrl("defender")} aria-label={`Usar ${selectedPokemon.name} como alvo na calculadora`}>
                    Como alvo
                  </Link>
                  <button className="button button-outline button-small" type="button" onClick={() => chooseForSlot(selectedSlot)}>Trocar</button>
                  <button className="button button-quiet button-small" type="button" onClick={clearSlot}>Limpar posição</button>
                </div>
              </div>

              <div className="editor-fields">
                <label className="field-label" htmlFor="member-ability">Habilidade</label>
                <input id="member-ability" className="text-input" list="ability-options" value={selectedMember.ability} maxLength={100} onChange={(event) => updateMember({ ability: event.target.value })} placeholder="Escolha ou digite" />
                <datalist id="ability-options">
                  {selectedPokemon.abilities.map((ability) => <option value={ability.name} key={`${ability.name}-${ability.hidden}`}>{ability.hidden ? "Habilidade oculta" : "Habilidade geral"}</option>)}
                </datalist>

                <label className="field-label" htmlFor="member-item">Item</label>
                <input id="member-item" className="text-input" value={selectedMember.item} maxLength={100} onChange={(event) => updateMember({ item: event.target.value })} placeholder="Digite um item" />

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
                    <input id={`move-${index}`} className="text-input" list={moveListId} value={move} maxLength={100} onChange={(event) => updateMove(index, event.target.value)} placeholder="Buscar ou digitar golpe" />
                  </label>
                ))}
                <p className="form-hint field-wide">A lista contém golpes gerais. Compatibilidade do Pokémon e do regulamento não é verificada.</p>

                <details className="points-section field-wide">
                  <summary>Stat Points <span>{pointTotal} distribuídos · limite ainda não aplicado</span></summary>
                  <p className="form-hint">Os valores ficam no arquivo da equipe. O limite do jogo ainda precisa de confirmação.</p>
                  <div className="points-grid">
                    {STAT_FIELDS.map(([key, label]) => (
                      <label key={key} htmlFor={`stat-${key}`}>
                        <span>{label}</span>
                        <input id={`stat-${key}`} className="text-input" type="number" min="0" max="999" value={selectedMember.statPoints[key]} onChange={(event) => updateMember({ statPoints: { ...selectedMember.statPoints, [key]: Math.min(999, Math.max(0, Number(event.target.value) || 0)) } })} />
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            </section>
          )}
        </div>
      </section>

      <p className="form-message" role="status" aria-live="polite">{message}</p>
      <p className="builder-footnote">Esta etapa guarda os campos do time e exporta um formato próprio. Não calcula dano nem confirma legalidade.</p>

      <SpeciesPicker open={pickerOpen} pokemon={dexData.pokemon} onChoose={choosePokemon} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

function safeFileName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "spinda-stop-team";
}
