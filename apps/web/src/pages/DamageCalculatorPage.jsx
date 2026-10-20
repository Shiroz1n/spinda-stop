import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { parseTeam } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import { ItemSprite, PokemonSprite } from "../components/PokemonSprite.jsx";
import { NaturePicker } from "../components/NaturePicker.jsx";
import { createPokemonSpriteLookup } from "../data/pokemonSprites.js";
import { calculateChampionsDamage, calculateChampionsStats, calculateDamageAgainstTargets, calculateDamageFromTeamAgainstTarget, damageCalculatorCatalog, getDamageCatalogOptions, getDamageMove, getDamageSpeciesName, getHitOptions, getSpreadTargetLimit, isSpreadTargetMove } from "../data/damageCalculator.js";

const statFields = [
  ["hp", "HP"], ["atk", "Atk"], ["def", "Def"],
  ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"],
];
const boostFields = statFields.slice(1);
const findPokemonSprite = createPokemonSpriteLookup(dexData.pokemon);
const BUILDER_STORAGE_KEY = "spinda-stop.team.v1";
const defaultSide = (species = "", nature = "Serious") => ({
  species,
  nature,
  ability: "",
  item: "",
  status: "",
  statPoints: Object.fromEntries(statFields.map(([key]) => [key, 0])),
  boosts: Object.fromEntries(boostFields.map(([key]) => [key, 0])),
});

function initialForm(search) {
  const params = new URLSearchParams(search);
  const move = params.get("move") || "";
  const readSide = (sideName, defaults) => {
    const prefix = sideName === "attacker" ? "" : "defender-";
    const side = defaultSide(params.get(sideName) || defaults.species, params.get(`${prefix}nature`) || defaults.nature);
    side.ability = params.get(`${prefix}ability`) || "";
    side.item = params.get(`${prefix}item`) || "";
    side.statPoints = Object.fromEntries(statFields.map(([key]) => [
      key,
      Math.max(0, Number(params.get(`${prefix}sp-${key}`)) || 0),
    ]));
    return side;
  };
  return {
    attacker: readSide("attacker", { species: "", nature: "Serious" }),
    defender: readSide("defender", { species: "", nature: "Serious" }),
    move,
    hits: getHitOptions(getDamageMove(move))[0],
    targetsHit: 2,
    gameType: "Doubles",
    weather: "",
    terrain: "",
    critical: false,
    attackerSide: { isHelpingHand: false },
    defenderSide: { isReflect: false, isLightScreen: false, isAuroraVeil: false, isFriendGuard: false, isProtected: false },
  };
}

function readBuilderTeam() {
  try {
    const saved = window.localStorage.getItem(BUILDER_STORAGE_KEY);
    if (!saved) return { status: "missing", team: null, error: "Não há um time salvo neste navegador." };
    const parsed = parseTeam(saved, dexData.pokemon);
    return parsed.ok
      ? { status: "ready", team: parsed.value, error: "" }
      : { status: "invalid", team: null, error: parsed.error };
  } catch {
    return { status: "unavailable", team: null, error: "Não foi possível ler o rascunho local neste navegador." };
  }
}

function applyScenarioOverrides(base, overrides) {
  return {
    ...base,
    ...overrides,
    attacker: { ...base.attacker, ...overrides.attacker },
    defender: { ...base.defender, ...overrides.defender },
    attackerSide: { ...base.attackerSide, ...overrides.attackerSide },
    defenderSide: { ...base.defenderSide, ...overrides.defenderSide },
  };
}

function DataLists({ form, comparisonForm }) {
  const renderSideOptions = (sideName, side) => {
    return (
      <>
        <datalist id={`damage-${sideName}-species-options`}>{getDamageCatalogOptions("species", side.species).map((name) => <option value={name} key={name} />)}</datalist>
        <datalist id={`damage-${sideName}-item-options`}>{getDamageCatalogOptions("items", side.item).map((name) => <option value={name} key={name} />)}</datalist>
        <datalist id={`damage-${sideName}-ability-options`}>{getDamageCatalogOptions("abilities", side.ability).map((name) => <option value={name} key={name} />)}</datalist>
      </>
    );
  };
  return (
    <div className="damage-datalists">
      {renderSideOptions("attacker", form.attacker)}
      {renderSideOptions("defender", form.defender)}
      {comparisonForm && renderSideOptions("comparison-attacker", comparisonForm.attacker)}
      {comparisonForm && renderSideOptions("comparison-defender", comparisonForm.defender)}
      <datalist id="damage-move-options">{[...new Set([...getDamageCatalogOptions("moves", form.move), ...getDamageCatalogOptions("moves", comparisonForm?.move)])].slice(0, 100).map((name) => <option value={name} key={name} />)}</datalist>
    </div>
  );
}

function CatalogInput({ label, value, onChange, list, placeholder }) {
  return (
    <label className="damage-field">
      <span>{label}</span>
      <input className="text-input" list={list} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" />
    </label>
  );
}

function SideEditor({ title, side, onChange, sideName, showSpecies = true }) {
  const prefix = sideName.includes("attacker") ? "Quem ataca" : "Quem recebe";
  function update(key, value) { onChange({ ...side, [key]: value }); }
  function updateNested(key, child, value) { onChange({ ...side, [key]: { ...side[key], [child]: value } }); }
  const statPointTotal = statFields.reduce((total, [key]) => total + (Number(side.statPoints[key]) || 0), 0);
  const selectedPokemon = findPokemonSprite(side.species);
  let calculatedStats = null;
  try {
    if (side.species) calculatedStats = calculateChampionsStats(side);
  } catch {
    calculatedStats = null;
  }

  return (
    <section className="damage-side panel-frame" aria-labelledby={`${sideName}-heading`}>
      <div className="damage-side-heading">
        <PokemonSprite pokemon={selectedPokemon} name={side.species || title} size={70} decorative className="damage-side-art" />
        <div><p className="page-label">{prefix}</p><h2 id={`${sideName}-heading`}>{title}</h2></div>
        {side.item ? <span className="damage-item-chip"><ItemSprite name={side.item} size={28} />{side.item}</span> : null}
      </div>
      <div className="damage-side-fields">
        {showSpecies ? <CatalogInput label="Pokémon" value={side.species} onChange={(value) => update("species", value)} list={`damage-${sideName}-species-options`} placeholder="Buscar no catálogo" /> : <p className="damage-shared-target-note">O mesmo set defensivo vale para cada espécie da lista.</p>}
        <NaturePicker id={`damage-${sideName}-nature`} label="Nature" value={side.nature} onChange={(value) => update("nature", value)} className="damage-nature-picker" />
        <CatalogInput label="Habilidade" value={side.ability} onChange={(value) => update("ability", value)} list={`damage-${sideName}-ability-options`} placeholder="Padrão da espécie" />
        <CatalogInput label="Item" value={side.item} onChange={(value) => update("item", value)} list={`damage-${sideName}-item-options`} placeholder="Sem item" />
        <label className="damage-field">
          <span>Status</span>
          <select className="text-input" value={side.status} onChange={(event) => update("status", event.target.value)}>
            <option value="">Sem status</option>
            <option value="brn">Queimado</option>
            <option value="par">Paralisado</option>
            <option value="psn">Envenenado</option>
            <option value="tox">Muito envenenado</option>
            <option value="slp">Adormecido</option>
            <option value="frz">Congelado</option>
          </select>
        </label>
      </div>
      <fieldset className="damage-stat-fieldset">
        <legend>Stat Points</legend>
        <div className="damage-stat-grid">
          {statFields.map(([key, label]) => (
            <label className="damage-field" key={key}>
              <span>{label}</span>
              <input className="text-input" type="number" min="0" step="1" value={side.statPoints[key]} onChange={(event) => updateNested("statPoints", key, event.target.value === "" ? 0 : Number(event.target.value))} />
            </label>
          ))}
        </div>
        <p className="form-hint" role="status" aria-live="polite">Total informado: {statPointTotal} SP. A legalidade e os limites oficiais de SP não são confirmados.</p>
      </fieldset>
      {calculatedStats ? <dl className="damage-calculated-stats" aria-live="polite" aria-label={`Stats calculados de ${side.species} com ${side.nature || "Serious"}`}>
        {statFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{calculatedStats[key]}</dd></div>)}
      </dl> : null}
      <details className="damage-advanced">
        <summary>Estágios de atributos</summary>
        <div className="damage-boost-grid">
          {boostFields.map(([key, label]) => (
            <label className="damage-field" key={key}>
              <span>{label} (−6 a +6)</span>
              <input className="text-input" type="number" min="-6" max="6" step="1" value={side.boosts[key]} onChange={(event) => updateNested("boosts", key, event.target.value === "" ? 0 : Number(event.target.value))} />
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}

function FieldToggle({ label, checked, onChange, disabled = false }) {
  return <label className="damage-toggle"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function formatPercent(value) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatRolls(rolls) {
  return rolls.join(" · ");
}

function formatStatLine(pokemon, side) {
  return statFields.map(([key, label]) => `${label} ${pokemon.stats[key]} (${side.statPoints[key]} SP)`).join(" · ");
}

function formatConditions(attackerSide, defenderSide) {
  const labels = {
    isHelpingHand: "Helping Hand",
    isReflect: "Reflect",
    isLightScreen: "Light Screen",
    isAuroraVeil: "Aurora Veil",
    isFriendGuard: "Friend Guard",
    isProtected: "Proteção ativa",
  };
  const active = [attackerSide, defenderSide].flatMap((side) => Object.entries(side || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => labels[key] || key));
  return active.length ? active.join(", ") : "nenhuma";
}

function formatStatus(status) {
  return ({ brn: "queimado", par: "paralisado", psn: "envenenado", tox: "muito envenenado", slp: "adormecido", frz: "congelado" })[status] || "sem status";
}

function DamageResultPanel({ calculation, form, label, compactMatchup = false }) {
  if (!calculation?.result && !calculation?.error) {
    return (
      <section className="damage-result damage-result-empty" role="status">
        <p className="page-label">Confronto</p>
        <h2>Escolha atacante, alvo e golpe</h2>
        <p>O resultado e os rolls aparecem assim que os três campos estiverem selecionados.</p>
      </section>
    );
  }

  if (!calculation?.result) {
    return (
      <section className="damage-result damage-result-error" role="alert">
        <p className="page-label">Cenário incompleto</p>
        <h2>Confira os dados do cálculo</h2>
        <p>{calculation?.error || "Não foi possível calcular este cenário."}</p>
      </section>
    );
  }

  const { result } = calculation;
  const isStatusMove = result.move.category === "Status";
  const hitSummary = result.hasParentalBondFollowUp
    ? "1 acerto + golpe adicional de Parental Bond"
    : `${result.hits} ${result.hits === 1 ? "acerto" : "acertos"}`;

  return (
    <section className="damage-result panel-frame" aria-label={`${label} · ${result.gameType}`}>
      <div className="damage-result-heading">
        {!compactMatchup ? (
          <div className="damage-result-matchup">
            <PokemonSprite pokemon={findPokemonSprite(form.attacker.species)} name={result.attacker.name} size={82} priority decorative />
            <span className="damage-versus" aria-hidden="true">VS</span>
            <PokemonSprite pokemon={findPokemonSprite(form.defender.species)} name={result.defender.name} size={82} priority decorative />
          </div>
        ) : null}
        <div className="damage-result-copy">
          <p className="page-label">{label} · {result.gameType}</p>
          <h2>{result.attacker.name} usa {result.move.name}</h2>
          <p className="form-hint">{compactMatchup ? `Nível 50 · ${hitSummary}` : `Contra ${result.defender.name} · nível 50 · ${hitSummary}`}</p>
        </div>
        {!isStatusMove && <div className="damage-result-range"><strong>{result.min}–{result.max}</strong><span>de dano</span></div>}
      </div>
      {isStatusMove ? (
        <p className="damage-status-note">Este golpe não causa dano direto.</p>
      ) : (
        <>
          <p className="damage-percent">{formatPercent(result.minPercent)}–{formatPercent(result.maxPercent)} da vida máxima calculada do alvo ({result.defender.stats.hp} HP)</p>
          {result.itemContextNotes.length ? <p className="damage-item-context" role="note">{result.itemContextNotes.join(" ")}</p> : null}
          <details className="damage-result-more">
            <summary>16 rolls, condições e detalhes</summary>
          {result.isSpreadTarget && result.gameType === "Doubles" && (
            <p className="damage-spread-note">
              {result.isSpread
                ? `Redutor de golpe em área aplicado: ${result.targetsHit} alvos válidos. A faixa mostra o dano por alvo.`
                : "Golpe em área com 1 alvo válido: sem o redutor de 0,75×. A faixa mostra o dano ao alvo."}
            </p>
          )}
          {result.hitRanges.length > 1 && <p className="damage-spread-note">{result.hasParentalBondFollowUp ? "Faixas do golpe principal e do golpe adicional:" : "Faixa por acerto:"} {result.hitRanges.map(([min, max], index) => `${result.rollGroupLabels[index]} ${min}–${max}`).join(" · ")}</p>}
          {result.rolls?.length === 16 && <div className="damage-rolls"><h3>16 resultados de dano</h3><ol>{result.rolls.map((roll, index) => <li key={`${roll}-${index}`}>{roll}</li>)}</ol></div>}
          {result.rollGroups.length > 1 && result.rollGroups.every((group) => group.length === 16) && (
            <details className="damage-multihit-rolls">
              <summary>{result.hasParentalBondFollowUp ? "Ver 16 resultados de cada golpe de Parental Bond" : "Ver 16 resultados de cada acerto"}</summary>
              {result.rollGroups.map((group, index) => <p key={index}><strong>{result.rollGroupLabels[index]}:</strong> {formatRolls(group)}</p>)}
              <p className="form-hint">A faixa total soma as faixas de cada golpe/acerto. Este motor não enumera aqui todas as combinações possíveis.</p>
            </details>
          )}
          {result.koProbabilities && <div className="damage-ko-note">
            <h3>Probabilidade condicional de nocaute</h3>
            {result.koProbabilities.ohko && <p>OHKO: {formatPercent((result.koProbabilities.ohko.successes / result.koProbabilities.ohko.total) * 100)} ({result.koProbabilities.ohko.successes}/16).</p>}
            {result.koProbabilities.twoHit && <p>2HKO: {formatPercent((result.koProbabilities.twoHit.successes / result.koProbabilities.twoHit.total) * 100)} ({result.koProbabilities.twoHit.successes}/256).</p>}
            <small>Alvo começa no HP máximo. Valores condicionados aos acertos, ao crítico selecionado e ao mesmo cenário; ignoram precisão e chance de crítico. Não são chance de vencer a partida.</small>
          </div>}
          {result.koProbabilityNotes.length > 0 && <p className="damage-spread-note">{result.koProbabilityNotes.join(" ")}</p>}
          <details className="damage-breakdown">
            <summary>O que entrou neste cálculo</summary>
            <div className="damage-breakdown-stats">
              <p><strong>Atacante:</strong> {formatStatLine(result.attacker, form.attacker)}</p>
              <p><strong>Alvo:</strong> {formatStatLine(result.defender, form.defender)}</p>
            </div>
            <h3>Entradas selecionadas</h3>
            <ul>
              <li><strong>Atacante:</strong> {form.attacker.nature || "Serious"}; habilidade {result.attacker.ability || "não definida"}; item {result.attacker.item || "nenhum"}; {formatStatus(result.attacker.status)}; estágios {Object.entries(form.attacker.boosts || {}).filter(([, value]) => Number(value) !== 0).map(([key, value]) => `${key.toUpperCase()} ${Number(value) > 0 ? "+" : ""}${value}`).join(", ") || "sem alterações"}.</li>
              <li><strong>Alvo:</strong> {form.defender.nature || "Serious"}; habilidade {result.defender.ability || "não definida"}; item {result.defender.item || "nenhum"}; {formatStatus(result.defender.status)}; estágios {Object.entries(form.defender.boosts || {}).filter(([, value]) => Number(value) !== 0).map(([key, value]) => `${key.toUpperCase()} ${Number(value) > 0 ? "+" : ""}${value}`).join(", ") || "sem alterações"}.</li>
              <li><strong>Golpe:</strong> {result.move.name}; {result.move.category}; {result.effectiveMoveType}; poder base {result.move.bp || "não definido"}; classe de alvo {result.originalMoveTarget}; crítico {form.critical ? "forçado" : "desligado"}; acertos {result.hits}.</li>
              <li><strong>Campo:</strong> {result.gameType}; alvos válidos {result.isSpreadTarget ? result.targetsHit : 1}; clima {form.weather || "nenhum"}; terreno {form.terrain || "nenhum"}; condições {formatConditions(form.attackerSide, form.defenderSide)}.</li>
            </ul>
            <h3>Modificadores identificados pelo motor</h3>
            <ul>{result.activeModifiers.map((modifier, index) => <li key={`${modifier.label}-${index}`}><strong>{modifier.label}:</strong> {modifier.factor}</li>)}</ul>
            <p className="form-hint">Habilidades, itens e condições só aparecem quando o motor os registrou neste cenário. Quando o resultado não expõe o fator numérico, mostramos o efeito pelo nome sem estimá-lo.</p>
          </details>
          {result.max === 0 && <p className="damage-spread-note">Neste cenário, o golpe não causa dano. Pode haver imunidade, proteção ou um efeito especial.</p>}
          </details>
        </>
      )}
    </section>
  );
}

function MultiTargetResults({ calculations, attacker, move }) {
  if (!calculations.length) {
    return <section className="damage-result damage-result-empty" role="status"><p className="page-label">Vários alvos</p><h2>Adicione ao menos dois alvos</h2><p>O atacante, o golpe e o set defensivo serão compartilhados nesta comparação.</p></section>;
  }
  return (
    <section className="damage-multi-results" aria-label={`${attacker} usa ${move} contra vários alvos`}>
      <div className="damage-multi-heading"><div><p className="page-label">Um atacante · {calculations.length} alvos</p><h2>{attacker} usa {move}</h2></div><span>Set defensivo compartilhado</span></div>
      <div className="damage-multi-grid">
        {calculations.map(({ species, result, error }, index) => (
          <article className={`damage-multi-row${error ? " has-error" : ""}`} key={species}>
            <div className="damage-multi-identity"><PokemonSprite pokemon={findPokemonSprite(species)} name={species} size={54} priority={index < 2} decorative /><strong>{species}</strong></div>
            {result ? <>
              <strong className="damage-multi-range">{result.min}–{result.max}</strong>
              <span className="damage-multi-percent">{formatPercent(result.minPercent)}–{formatPercent(result.maxPercent)} · {result.defender.stats.hp} HP</span>
              <details><summary>Ver rolls</summary>{result.rolls?.length === 16 ? <ol className="damage-multi-rolls">{result.rolls.map((roll, index) => <li key={`${species}-${index}`}>{roll}</li>)}</ol> : <p className="form-hint">Rolls separados por acerto: {result.rollGroups.map((group) => group.join(" · ")).join(" / ")}</p>}</details>
            </> : <p className="damage-multi-error" role="alert">{error}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function TeamMoveResult({ entry }) {
  const { result, error, move } = entry;
  if (!result) {
    return <article className="damage-team-move is-unavailable"><strong>{move}</strong><p role="alert">{error}</p></article>;
  }
  const isStatusMove = result.move.category === "Status";
  const barWidth = `${Math.max(0, Math.min(100, result.maxPercent))}%`;
  return (
    <article className="damage-team-move">
      <div className="damage-team-move-heading">
        <div><strong>{result.move.name}</strong><span>{result.move.type} · {result.move.category}</span></div>
        {isStatusMove ? <b className="damage-team-move-status">Sem dano direto</b> : <b className="damage-team-move-range">{result.min}–{result.max}</b>}
      </div>
      {!isStatusMove ? <>
        <div className="damage-team-percent-row"><span>{formatPercent(result.minPercent)}–{formatPercent(result.maxPercent)} do alvo</span><span>{result.defender.stats.hp} HP</span></div>
        <div className="damage-team-percent-track" aria-hidden="true"><span style={{ width: barWidth }} /></div>
      </> : null}
      <details className="damage-team-move-details">
        <summary>{result.rolls?.length === 16 ? "16 rolls e modificadores" : "Detalhes do golpe"}</summary>
        {result.rolls?.length === 16 ? <div className="damage-rolls"><h3>16 resultados de dano</h3><ol>{result.rolls.map((roll, index) => <li key={`${move}-${index}`}>{roll}</li>)}</ol></div> : null}
        {result.rollGroups.length > 1 ? <p>Faixas por acerto: {result.rollGroups.map((group, index) => `${result.rollGroupLabels[index]} ${group[0]}–${group.at(-1)}`).join(" · ")}</p> : null}
        {!result.rolls && !result.rollGroups.some((group) => group.length === 16) ? <p className="form-hint">O motor não retornou uma sequência de 16 rolls para este cenário; a faixa exibida vem diretamente do resultado dele.</p> : null}
        <ul className="damage-team-modifiers">{result.activeModifiers.map((modifier, index) => <li key={`${modifier.label}-${index}`}><strong>{modifier.label}:</strong> {modifier.factor}</li>)}</ul>
        {result.itemContextNotes.length ? <p className="damage-item-context" role="note">{result.itemContextNotes.join(" ")}</p> : null}
        <p className="form-hint">Alvo em {result.defender.stats.hp} HP · faixa por alvo em Doubles. Acerto e crítico aleatório não estão incluídos.</p>
      </details>
    </article>
  );
}

function TeamAgainstTargetResults({ teamState, calculations, target, onRefresh }) {
  if (teamState.status !== "ready") {
    return (
      <section className="damage-result damage-team-empty" role="status">
        <p className="page-label">Time contra um alvo</p>
        <h2>Carregue um rascunho do builder</h2>
        <p>{teamState.error}</p>
        <div className="damage-team-actions"><Link className="button button-primary button-small" to="/builder">Abrir construtor</Link><button className="button button-outline button-small" type="button" onClick={onRefresh}>Atualizar time</button></div>
      </section>
    );
  }
  if (!target.species.trim()) {
    return <section className="damage-result damage-result-empty" role="status"><p className="page-label">Time vs 1 alvo</p><h2>Escolha o alvo</h2><p>Edite o alvo para comparar os golpes preenchidos dos integrantes salvos no construtor.</p></section>;
  }

  const populated = calculations.reduce((count, row) => count + row.moves.filter(({ result }) => result).length, 0);
  const targetPokemon = findPokemonSprite(target.species);
  return (
    <section className="damage-team-results" aria-label={`Time contra ${target.species}`}>
      <header className="damage-team-results-heading">
        <div className="damage-team-target-portrait"><PokemonSprite pokemon={targetPokemon} name={target.species} size={82} priority decorative /></div>
        <div className="damage-team-target-copy"><p className="page-label">{teamState.team.name} · Doubles</p><h2>Time ataca {target.species}</h2><p>{populated} golpes calculados · mesmos parâmetros de campo · um alvo válido</p></div>
        <button className="button button-outline button-small" type="button" onClick={onRefresh}>Atualizar time</button>
      </header>
      <div className="damage-team-member-grid">
        {calculations.map((row) => {
          const member = row.member;
          const pokemon = member ? findPokemonSprite(member.pokemonId) : null;
          const usedPoints = member ? statFields.reduce((sum, [key]) => sum + (Number(member.statPoints[key]) || 0), 0) : 0;
          return (
            <article className={`damage-team-member is-${row.status}`} key={row.slot}>
              <div className="damage-team-member-heading">
                <PokemonSprite pokemon={pokemon} name={pokemon?.name || `Posição ${row.slot}`} size={60} priority={row.slot < 3} decorative />
                <div><span className="damage-team-slot">POS. {String(row.slot).padStart(2, "0")}</span><h3>{pokemon?.name || "Posição vazia"}</h3></div>
              </div>
              {member ? <div className="damage-team-set-meta"><span>Nature <b>{member.nature || "Serious"}</b></span><span>Habilidade <b>{member.ability || "—"}</b></span><span>Item <b>{member.item || "—"}</b></span><span>SP <b>{usedPoints}/66</b></span></div> : null}
              {row.status === "empty" ? <p className="damage-team-member-note">Sem integrante salvo nesta posição.</p> : null}
              {row.status === "no-moves" || row.status === "invalid" || row.status === "unknown-item" || row.status === "unsupported-item" ? <p className="damage-team-member-note" role={row.status === "invalid" ? "alert" : "status"}>{row.error}</p> : null}
              {row.moves.length > 0 ? <div className="damage-team-moves">{row.moves.map((entry, index) => <TeamMoveResult entry={entry} key={`${row.slot}-${entry.move}-${index}`} />)}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DamageCalculatorPage() {
  const location = useLocation();
  const editorRef = useRef(null);
  const [form, setForm] = useState(() => initialForm(location.search));
  const [editorOpen, setEditorOpen] = useState(false);
  const [comparison, setComparison] = useState({ enabled: false, overrides: {} });
  const [targetMode, setTargetMode] = useState("one");
  const [multiTargets, setMultiTargets] = useState([]);
  const [comparisonAspect, setComparisonAspect] = useState("move");
  const [builderTeamState, setBuilderTeamState] = useState(readBuilderTeam);
  const comparisonForm = useMemo(
    () => comparison.enabled ? applyScenarioOverrides(form, comparison.overrides) : null,
    [comparison.enabled, comparison.overrides, form],
  );
  const moveData = getDamageMove(form.move);
  const selectedTargets = multiTargets.map((species) => species.trim()).filter(Boolean);
  const calculationReady = targetMode === "team"
    ? Boolean(form.defender.species.trim())
    : Boolean(form.attacker.species.trim() && form.move.trim() && (targetMode === "one" ? form.defender.species.trim() : selectedTargets.length >= 2));
  const availableHits = moveData ? getHitOptions(moveData) : [1];
  const showSpreadTargetCount = form.gameType === "Doubles" && moveData?.category !== "Status" && isSpreadTargetMove(moveData);
  const comparisonMoveData = getDamageMove(comparisonForm?.move);
  const showComparisonTargetCount = comparisonForm?.gameType === "Doubles" && comparisonMoveData?.category !== "Status" && isSpreadTargetMove(comparisonMoveData);
  const comparisonAvailableHits = useMemo(
    () => comparisonMoveData ? getHitOptions(comparisonMoveData) : [1],
    [comparisonMoveData],
  );

  const calculation = useMemo(() => {
    if (!calculationReady || targetMode !== "one") return { result: null, error: "" };
    try {
      return { result: calculateChampionsDamage(form), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Não foi possível calcular este cenário." };
    }
  }, [form, calculationReady, targetMode]);

  const multipleTargetCalculations = targetMode === "many" && calculationReady
    ? calculateDamageAgainstTargets(form, selectedTargets)
    : [];

  const resolvedBuilderMembers = useMemo(() => builderTeamState.team?.members.map((member) => member
    ? { ...member, species: getDamageSpeciesName(member.pokemonId) }
    : null) || [], [builderTeamState.team]);
  const teamTargetCalculations = useMemo(() => {
    if (targetMode !== "team" || builderTeamState.status !== "ready" || !form.defender.species.trim()) return [];
    return calculateDamageFromTeamAgainstTarget(resolvedBuilderMembers, form.defender, {
      gameType: form.gameType,
      weather: form.weather,
      terrain: form.terrain,
      critical: form.critical,
      attackerSide: form.attackerSide,
      defenderSide: form.defenderSide,
    });
  }, [targetMode, builderTeamState.status, resolvedBuilderMembers, form.defender, form.gameType, form.weather, form.terrain, form.critical, form.attackerSide, form.defenderSide]);

  const comparisonCalculation = useMemo(() => {
    if (!comparisonForm?.move.trim()) return null;
    const hits = comparisonAvailableHits.includes(comparisonForm.hits) ? comparisonForm.hits : comparisonAvailableHits[0];
    const scenario = { ...comparisonForm, hits };
    try {
      return { result: calculateChampionsDamage(scenario), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Não foi possível calcular este cenário." };
    }
  }, [comparisonForm, comparisonAvailableHits]);

  const announcementText = targetMode === "team"
    ? form.defender.species.trim() ? `Comparação dos seis integrantes contra ${form.defender.species}.` : "Escolha o alvo para comparar os golpes do time."
    : targetMode === "many"
      ? `${selectedTargets.length} alvos selecionados para comparação.`
      : comparison.enabled
    ? [
      resultAnnouncement("Cenário A", calculation),
      Object.keys(comparison.overrides).length > 0 && comparisonForm?.move.trim()
        ? resultAnnouncement("Cenário B", comparisonCalculation)
        : "Cenário B: escolha uma variação para comparar.",
    ].join(" ")
    : resultAnnouncement("Resultado", calculation);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(() => setAnnouncement(announcementText), 450);
    return () => clearTimeout(timeoutId);
  }, [announcementText]);

  useEffect(() => {
    function syncBuilderTeam(event) {
      if (!event || event.key === BUILDER_STORAGE_KEY) setBuilderTeamState(readBuilderTeam());
    }
    window.addEventListener("storage", syncBuilderTeam);
    return () => window.removeEventListener("storage", syncBuilderTeam);
  }, []);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function updateSide(key, value) { setForm((current) => ({ ...current, [key]: { ...current[key], ...value } })); }
  function updateFieldSide(key, value) { setForm((current) => ({ ...current, [key]: { ...current[key], ...value } })); }
  function handleMoveChange(value) {
    const move = getDamageMove(value);
    const hits = move ? getHitOptions(move)[0] : 1;
    setForm((current) => ({
      ...current,
      move: value,
      hits,
      targetsHit: isSpreadTargetMove(move) ? Math.max(2, Math.min(current.targetsHit || 2, getSpreadTargetLimit(move))) : 1,
    }));
  }
  function handleComparisonMoveChange(value) {
    const move = getDamageMove(value);
    setComparison((current) => {
      const scenario = applyScenarioOverrides(form, current.overrides);
      return {
        ...current,
        overrides: {
          ...current.overrides,
          move: value,
          hits: move ? getHitOptions(move)[0] : 1,
          targetsHit: isSpreadTargetMove(move) ? Math.max(2, Math.min(scenario.targetsHit || 2, getSpreadTargetLimit(move))) : 1,
        },
      };
    });
  }
  function updateComparison(key, value) {
    setComparison((current) => ({ ...current, overrides: { ...current.overrides, [key]: value } }));
  }
  function updateComparisonSide(key, value) {
    setComparison((current) => ({ ...current, overrides: { ...current.overrides, [key]: { ...current.overrides[key], ...value } } }));
  }
  function updateComparisonFieldSide(key, value) {
    setComparison((current) => ({ ...current, overrides: { ...current.overrides, [key]: { ...current.overrides[key], ...value } } }));
  }
  function changeTargetMode(nextMode) {
    setTargetMode(nextMode);
    if (nextMode !== "one") setComparison({ enabled: false, overrides: {} });
    if (nextMode === "many") {
      setComparison({ enabled: false, overrides: {} });
      setMultiTargets((current) => current.length ? current : [form.defender.species, ""]);
    }
    if (nextMode === "team") setBuilderTeamState(readBuilderTeam());
  }
  function refreshBuilderTeam() {
    setBuilderTeamState(readBuilderTeam());
  }
  function openEditor() {
    setEditorOpen(true);
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function updateMultiTarget(index, value) {
    setMultiTargets((current) => current.map((species, itemIndex) => itemIndex === index ? value : species));
  }
  function addMultiTarget() {
    setMultiTargets((current) => current.length < 6 ? [...current, ""] : current);
  }
  function removeMultiTarget(index) {
    setMultiTargets((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }
  const teamTargetHp = teamTargetCalculations.flatMap((row) => row.moves).find(({ result }) => result)?.result?.defender.stats.hp;
  return (
    <div className="page-wrap damage-page">
      <div className="page-heading-row damage-heading">
        <div>
          <p className="page-label">Combate · Pokémon Champions</p>
          <h1>Calculadora de dano</h1>
          <p className="page-intro">Compare um confronto, vários alvos ou os golpes do time contra o mesmo adversário.</p>
        </div>
        <Link className="button button-outline" to="/builder">Voltar ao construtor</Link>
      </div>

      <section className="damage-target-mode" aria-label="Modo de confronto">
        <span>Comparar</span>
        <div role="group" aria-label="Modo da calculadora">
          <button type="button" className={targetMode === "one" ? "is-selected" : ""} aria-pressed={targetMode === "one"} onClick={() => changeTargetMode("one")}>1 vs 1</button>
          <button type="button" className={targetMode === "many" ? "is-selected" : ""} aria-pressed={targetMode === "many"} onClick={() => changeTargetMode("many")}>1 vs vários</button>
          <button type="button" className={targetMode === "team" ? "is-selected" : ""} aria-pressed={targetMode === "team"} onClick={() => changeTargetMode("team")}>Time vs 1</button>
        </div>
      </section>

      <div className={comparison.enabled ? "damage-quickbar damage-quickbar-comparison" : "damage-quickbar"}>
        <div className="damage-quickbar-matchup" role="group" aria-label={`${targetMode === "team" ? "Time do construtor" : `Atacante ${form.attacker.species || "não escolhido"}`}; alvo ${form.defender.species || "não escolhido"}`}>
          <div className="damage-quickbar-side">
            {targetMode === "team" ? <div className="damage-quickbar-team-art" aria-hidden="true">{builderTeamState.team?.members.map((member, index) => member ? <PokemonSprite key={`${member.pokemonId}-${index}`} pokemon={findPokemonSprite(member.pokemonId)} name="" size={34} decorative /> : null)}</div> : <PokemonSprite pokemon={findPokemonSprite(form.attacker.species)} name={form.attacker.species || "Atacante não escolhido"} size={52} priority decorative />}
            <span><small>{targetMode === "team" ? "Atacantes" : "Atacante"}</small><strong>{targetMode === "team" ? builderTeamState.team?.name || "Time não salvo" : form.attacker.species || "Escolha Pokémon"}</strong><small>{targetMode === "team" ? `${builderTeamState.team?.members.filter(Boolean).length || 0} integrantes salvos` : calculation?.result ? `${calculation.result.attacker.stats.hp} HP calculado` : "HP —"}</small></span>
          </div>
          <span className="damage-versus" aria-hidden="true">VS</span>
          <div className="damage-quickbar-side">
            {targetMode === "many" ? <span className="damage-target-count" aria-hidden="true">{selectedTargets.length || "…"}</span> : <PokemonSprite pokemon={findPokemonSprite(form.defender.species)} name={form.defender.species || "Alvo não escolhido"} size={52} priority decorative />}
            <span><small>Alvo{targetMode === "many" ? "s" : ""}</small><strong>{targetMode === "many" ? `${selectedTargets.length || "Escolha"} alvos` : form.defender.species || "Escolha Pokémon"}</strong><small>{calculation?.result ? `${calculation.result.defender.stats.hp} HP calculado` : targetMode === "team" ? (teamTargetHp ? `${teamTargetHp} HP calculado` : "set compartilhado") : "HP —"}</small></span>
          </div>
          <strong className="damage-quickbar-move">{targetMode === "team" ? "Golpes dos sets" : form.move || "Escolha um golpe"}</strong>
        </div>
        <div className="damage-quickbar-actions">
          {targetMode === "one" ? <FieldToggle label="Comparar cenários" checked={comparison.enabled} disabled={!calculationReady && !comparison.enabled} onChange={(enabled) => setComparison(enabled ? { enabled: true, overrides: {} } : { enabled: false, overrides: comparison.overrides })} /> : null}
          <button className="button button-primary button-small" type="button" onClick={openEditor}>Editar confronto</button>
        </div>
      </div>

      {comparison.enabled ? (
        <div className="damage-comparison-results" aria-label="Comparação dos cenários">
          <DamageResultPanel calculation={calculation} form={form} label="A · atual" compactMatchup />
          {Object.keys(comparison.overrides).length > 0 && comparisonForm?.move.trim() ? (
            <DamageResultPanel calculation={comparisonCalculation} form={comparisonForm} label="B · variação" compactMatchup />
          ) : (
            <section className="damage-comparison-empty panel-frame" role="status">
              <p className="page-label">Cenário B</p>
              <h2>Escolha uma variação</h2>
              <p>Edite apenas o golpe, campo, atacante ou alvo que deseja comparar.</p>
            </section>
          )}
        </div>
      ) : targetMode === "many" ? <MultiTargetResults calculations={multipleTargetCalculations} attacker={form.attacker.species} move={form.move} /> : targetMode === "team" ? <TeamAgainstTargetResults teamState={builderTeamState} calculations={teamTargetCalculations} target={form.defender} onRefresh={refreshBuilderTeam} /> : <DamageResultPanel calculation={calculation} form={form} label="Resultado" />}

      <details className="damage-editor-disclosure" id="damage-editor" ref={editorRef} open={editorOpen || !calculationReady} onToggle={(event) => { if (calculationReady) setEditorOpen(event.currentTarget.open); }}>
        <summary>Editar confronto, sets e campo</summary>
        <div className="damage-editor-content">
          {targetMode === "many" ? <details className="damage-edit-task" open={!calculationReady}>
            <summary>Alvos comparados <span>{selectedTargets.length}/6 escolhidos</span></summary>
            <section className="damage-many-targets" aria-label="Alvos comparados">
              <div className="damage-many-heading"><div><strong>Escolha até seis alvos</strong><span>Os resultados usam o mesmo atacante, golpe e set defensivo.</span></div><button className="button button-outline button-small" type="button" onClick={addMultiTarget} disabled={multiTargets.length >= 6}>Adicionar alvo</button></div>
              <div className="damage-many-fields">
                {multiTargets.map((species, index) => <label className="damage-field" key={index}><span>Alvo {index + 1}</span><div className="damage-many-input"><input className="text-input" value={species} onChange={(event) => updateMultiTarget(index, event.target.value)} list={`damage-many-target-${index}`} placeholder="Buscar espécie ou forma" autoComplete="off" /><datalist id={`damage-many-target-${index}`}>{getDamageCatalogOptions("species", species).map((name) => <option key={name} value={name} />)}</datalist><button className="button button-quiet button-small" type="button" aria-label={`Remover alvo ${index + 1}`} onClick={() => removeMultiTarget(index)} disabled={multiTargets.length <= 2}>×</button></div></label>)}
              </div>
            </section>
          </details> : null}

          <details className="damage-edit-task" open={!calculationReady && targetMode !== "many"}>
            <summary>{targetMode === "team" ? "Set do alvo" : "Pokémon e sets"}<span>{targetMode === "team" ? "defesa compartilhada" : "nature · habilidade · item · SP"}</span></summary>
            <section className="damage-input-grid" aria-label="Pokémon e parâmetros dos sets">
              {targetMode === "team" ? <div className="damage-team-source"><div className="section-heading"><h2>Atacantes do builder</h2><span>{builderTeamState.team?.members.filter(Boolean).length || 0}/6 sets</span></div><p>Nature, habilidade, item, Stat Points e golpes vêm do rascunho salvo. Sets vazios ou inválidos ficam identificados em cada posição.</p><Link className="button button-outline button-small" to="/builder">Editar time</Link></div> : <SideEditor title="Atacante" sideName="attacker" side={form.attacker} onChange={(value) => updateSide("attacker", value)} />}
              <SideEditor title={targetMode === "many" ? "Set defensivo compartilhado" : "Alvo"} sideName="defender" side={form.defender} onChange={(value) => updateSide("defender", value)} showSpecies={targetMode !== "many"} />
            </section>
          </details>

          <details className="damage-edit-task" open={!calculationReady && targetMode !== "team"}>
            <summary>{targetMode === "team" ? "Campo e modificadores" : "Golpes e campo"}<span>{targetMode === "team" ? "clima · terreno · telas" : "golpe · clima · terreno · telas"}</span></summary>
            <section className="damage-move-panel panel-frame" aria-labelledby="move-heading">
              <div className="section-heading"><h2 id="move-heading">{targetMode === "team" ? "Campo e modificadores" : "Golpe e campo"}</h2><span>{targetMode === "team" ? "Compartilhados nos sets" : "Simulação individual"}</span></div>
              <div className="damage-move-fields">
          {targetMode !== "team" ? <CatalogInput label="Golpe" value={form.move} onChange={handleMoveChange} list="damage-move-options" placeholder="Buscar golpe" /> : null}
          <label className="damage-field">
            <span>Formato do campo</span>
            <select className="text-input" value={form.gameType} onChange={(event) => update("gameType", event.target.value)}>
              <option value="Doubles">Doubles</option>
              <option value="Singles">Singles</option>
            </select>
          </label>
          {targetMode !== "team" && showSpreadTargetCount && (
            <label className="damage-field">
              <span>Alvos válidos no golpe</span>
              <select className="text-input" value={Math.min(form.targetsHit, getSpreadTargetLimit(moveData))} onChange={(event) => update("targetsHit", Number(event.target.value))}>
                {Array.from({ length: getSpreadTargetLimit(moveData) }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}</option>)}
              </select>
              <span className="form-hint">Conte alvos válidos antes de Proteção; o resultado é por alvo.</span>
            </label>
          )}
          {targetMode !== "team" ? <label className="damage-field">
            <span>Acertos</span>
            <select className="text-input" value={availableHits.includes(form.hits) ? form.hits : availableHits[0]} onChange={(event) => update("hits", Number(event.target.value))}>
              {availableHits.map((count) => <option value={count} key={count}>{count}</option>)}
            </select>
          </label> : null}
          <label className="damage-field">
            <span>Clima</span>
            <select className="text-input" value={form.weather} onChange={(event) => update("weather", event.target.value)}>
              <option value="">Sem clima</option>
              {damageCalculatorCatalog.weather.map((weather) => <option value={weather} key={weather}>{weather}</option>)}
            </select>
          </label>
          <label className="damage-field">
            <span>Terreno</span>
            <select className="text-input" value={form.terrain} onChange={(event) => update("terrain", event.target.value)}>
              <option value="">Sem terreno</option>
              {damageCalculatorCatalog.terrain.map((terrain) => <option value={terrain} key={terrain}>{terrain}</option>)}
            </select>
          </label>
          {targetMode !== "team" ? <FieldToggle label="Golpe crítico" checked={form.critical} onChange={(value) => update("critical", value)} /> : null}
              </div>
              <details className="damage-field-advanced">
          <summary>Condições de campo avançadas</summary>
          <div className="damage-field-conditions">
            <div>
              <h3>Lado do atacante</h3>
              <FieldToggle label="Helping Hand" checked={form.attackerSide.isHelpingHand} onChange={(value) => updateFieldSide("attackerSide", { isHelpingHand: value })} />
            </div>
            <div>
              <h3>Lado do alvo</h3>
              <FieldToggle label="Reflect" checked={form.defenderSide.isReflect} onChange={(value) => updateFieldSide("defenderSide", { isReflect: value })} />
              <FieldToggle label="Light Screen" checked={form.defenderSide.isLightScreen} onChange={(value) => updateFieldSide("defenderSide", { isLightScreen: value })} />
              <FieldToggle label="Aurora Veil" checked={form.defenderSide.isAuroraVeil} onChange={(value) => updateFieldSide("defenderSide", { isAuroraVeil: value })} />
              <FieldToggle label="Friend Guard" checked={form.defenderSide.isFriendGuard} onChange={(value) => updateFieldSide("defenderSide", { isFriendGuard: value })} />
              <FieldToggle label="Proteção ativa" checked={form.defenderSide.isProtected} onChange={(value) => updateFieldSide("defenderSide", { isProtected: value })} />
            </div>
          </div>
              </details>
              {targetMode === "one" ? <div className="damage-comparison-controls">
          {comparisonForm && (
            <>
              <p>O cenário B acompanha o A. Escolha o que muda; atacante, alvo e demais condições continuam iguais até você sobrescrevê-los.</p>
              <div className="damage-comparison-fields damage-comparison-quick">
                <label className="damage-field">
                  <span>Variar no cenário B</span>
                  <select className="text-input" value={comparisonAspect} onChange={(event) => setComparisonAspect(event.target.value)}>
                    <option value="move">Golpe</option><option value="weather">Clima</option><option value="terrain">Terreno</option><option value="attacker">Atacante</option><option value="defender">Alvo</option>
                  </select>
                </label>
                {comparisonAspect === "move" ? <CatalogInput label="Golpe B" value={comparisonForm.move} onChange={handleComparisonMoveChange} list="damage-move-options" placeholder="Buscar golpe" /> : null}
                {comparisonAspect === "weather" ? <label className="damage-field"><span>Clima B</span><select className="text-input" value={comparisonForm.weather} onChange={(event) => updateComparison("weather", event.target.value)}><option value="">Sem clima</option>{damageCalculatorCatalog.weather.map((weather) => <option value={weather} key={weather}>{weather}</option>)}</select></label> : null}
                {comparisonAspect === "terrain" ? <label className="damage-field"><span>Terreno B</span><select className="text-input" value={comparisonForm.terrain} onChange={(event) => updateComparison("terrain", event.target.value)}><option value="">Sem terreno</option>{damageCalculatorCatalog.terrain.map((terrain) => <option value={terrain} key={terrain}>{terrain}</option>)}</select></label> : null}
                {comparisonAspect === "attacker" ? <CatalogInput label="Atacante B" value={comparisonForm.attacker.species} onChange={(value) => updateComparisonSide("attacker", { species: value })} list="damage-comparison-attacker-species-options" placeholder="Buscar Pokémon" /> : null}
                {comparisonAspect === "defender" ? <CatalogInput label="Alvo B" value={comparisonForm.defender.species} onChange={(value) => updateComparisonSide("defender", { species: value })} list="damage-comparison-defender-species-options" placeholder="Buscar Pokémon" /> : null}
              </div>
              <details className="damage-field-advanced damage-comparison-advanced">
                <summary>Ajustes adicionais do cenário B</summary>
                <div className="damage-comparison-fields">
                  <label className="damage-field"><span>Formato</span><select className="text-input" value={comparisonForm.gameType} onChange={(event) => updateComparison("gameType", event.target.value)}><option value="Doubles">Doubles</option><option value="Singles">Singles</option></select></label>
                  {showComparisonTargetCount ? <label className="damage-field"><span>Alvos válidos</span><select className="text-input" value={Math.min(comparisonForm.targetsHit, getSpreadTargetLimit(comparisonMoveData))} onChange={(event) => updateComparison("targetsHit", Number(event.target.value))}>{Array.from({ length: getSpreadTargetLimit(comparisonMoveData) }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}</option>)}</select><span className="form-hint">A faixa é por alvo.</span></label> : null}
                  <label className="damage-field"><span>Acertos</span><select className="text-input" value={comparisonAvailableHits.includes(comparisonForm.hits) ? comparisonForm.hits : comparisonAvailableHits[0]} onChange={(event) => updateComparison("hits", Number(event.target.value))}>{comparisonAvailableHits.map((count) => <option value={count} key={count}>{count}</option>)}</select></label>
                  <FieldToggle label="Golpe crítico" checked={comparisonForm.critical} onChange={(critical) => updateComparison("critical", critical)} />
                </div>
                <div className="damage-input-grid damage-comparison-team" aria-label="Configuração dos lados no cenário B">
                  <SideEditor title="Atacante B" sideName="comparison-attacker" side={comparisonForm.attacker} onChange={(value) => updateComparisonSide("attacker", value)} />
                  <SideEditor title="Alvo B" sideName="comparison-defender" side={comparisonForm.defender} onChange={(value) => updateComparisonSide("defender", value)} />
                </div>
                <div className="damage-field-conditions">
                  <div><h3>Lado do atacante</h3><FieldToggle label="Helping Hand" checked={comparisonForm.attackerSide.isHelpingHand} onChange={(value) => updateComparisonFieldSide("attackerSide", { isHelpingHand: value })} /></div>
                  <div><h3>Lado do alvo</h3><FieldToggle label="Reflect" checked={comparisonForm.defenderSide.isReflect} onChange={(value) => updateComparisonFieldSide("defenderSide", { isReflect: value })} /><FieldToggle label="Light Screen" checked={comparisonForm.defenderSide.isLightScreen} onChange={(value) => updateComparisonFieldSide("defenderSide", { isLightScreen: value })} /><FieldToggle label="Aurora Veil" checked={comparisonForm.defenderSide.isAuroraVeil} onChange={(value) => updateComparisonFieldSide("defenderSide", { isAuroraVeil: value })} /><FieldToggle label="Friend Guard" checked={comparisonForm.defenderSide.isFriendGuard} onChange={(value) => updateComparisonFieldSide("defenderSide", { isFriendGuard: value })} /><FieldToggle label="Proteção ativa" checked={comparisonForm.defenderSide.isProtected} onChange={(value) => updateComparisonFieldSide("defenderSide", { isProtected: value })} /></div>
                </div>
              </details>
            </>
          )}
              </div> : null}
            </section>
          </details>
        </div>
      </details>
      <details className="damage-context-help"><summary>Como interpretar estes resultados</summary><p>Valores usam o nível 50 e os sets selecionados. O motor <a href="https://github.com/smogon/damage-calc" target="_blank" rel="noreferrer">@smogon/calc 0.12.0</a> calcula 16 rolls por golpe simples. Precisão e chance aleatória de crítico não entram na faixa; o aplicativo não valida legalidade nem regulamento.</p></details>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      <DataLists form={form} comparisonForm={comparisonForm} />
    </div>
  );
}

function resultAnnouncement(label, calculation) {
  if (!calculation?.result) return `${label}: ${calculation?.error || "o cálculo está incompleto."}`;
  const { result } = calculation;
  if (result.move.category === "Status") return `${label}: ${result.attacker.name} usa ${result.move.name}; o golpe não causa dano direto.`;
  return `${label}: ${result.attacker.name} usa ${result.move.name} contra ${result.defender.name}, ${result.min} a ${result.max} de dano.`;
}

