import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { ItemSprite, PokemonSprite } from "../components/PokemonSprite.jsx";
import { createPokemonSpriteLookup } from "../data/pokemonSprites.js";
import { calculateChampionsDamage, cloneDamageScenario, damageCalculatorCatalog, getDamageCatalogOptions, getDamageMove, getHitOptions, getSpreadTargetLimit, isSpreadTargetMove } from "../data/damageCalculator.js";

const statFields = [
  ["hp", "HP"], ["atk", "Atk"], ["def", "Def"],
  ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"],
];
const boostFields = statFields.slice(1);
const findPokemonSprite = createPokemonSpriteLookup(dexData.pokemon);
const defaultSide = (species, nature) => ({
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
  const cameFromBuilder = params.has("attacker") || params.has("defender");
  const move = params.get("move") || (cameFromBuilder ? "" : "Earthquake");
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
    attacker: readSide("attacker", { species: "Garchomp", nature: "Adamant" }),
    defender: readSide("defender", { species: "Garchomp", nature: "Serious" }),
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

function DataLists({ form, comparisonForm }) {
  const renderSideOptions = (sideName, side) => {
    return (
      <>
        <datalist id={`damage-${sideName}-species-options`}>{getDamageCatalogOptions("species", side.species).map((name) => <option value={name} key={name} />)}</datalist>
        <datalist id={`damage-${sideName}-item-options`}>{getDamageCatalogOptions("items", side.item).map((name) => <option value={name} key={name} />)}</datalist>
        <datalist id={`damage-${sideName}-ability-options`}>{getDamageCatalogOptions("abilities", side.ability).map((name) => <option value={name} key={name} />)}</datalist>
        <datalist id={`damage-${sideName}-nature-options`}>{getDamageCatalogOptions("natures", side.nature).map((name) => <option value={name} key={name} />)}</datalist>
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

function SideEditor({ title, side, onChange, sideName }) {
  const prefix = sideName.includes("attacker") ? "Quem ataca" : "Quem recebe";
  function update(key, value) { onChange({ ...side, [key]: value }); }
  function updateNested(key, child, value) { onChange({ ...side, [key]: { ...side[key], [child]: value } }); }
  const statPointTotal = statFields.reduce((total, [key]) => total + (Number(side.statPoints[key]) || 0), 0);
  const selectedPokemon = findPokemonSprite(side.species);

  return (
    <section className="damage-side panel-frame" aria-labelledby={`${sideName}-heading`}>
      <div className="damage-side-heading">
        <PokemonSprite pokemon={selectedPokemon} name={side.species || title} size={70} decorative className="damage-side-art" />
        <div><p className="page-label">{prefix}</p><h2 id={`${sideName}-heading`}>{title}</h2></div>
        {side.item ? <span className="damage-item-chip"><ItemSprite name={side.item} size={28} />{side.item}</span> : null}
      </div>
      <div className="damage-side-fields">
        <CatalogInput label="Pokémon" value={side.species} onChange={(value) => update("species", value)} list={`damage-${sideName}-species-options`} placeholder="Buscar no catálogo" />
        <CatalogInput label="Nature" value={side.nature} onChange={(value) => update("nature", value)} list={`damage-${sideName}-nature-options`} placeholder="Serious" />
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

function FieldToggle({ label, checked, onChange }) {
  return <label className="damage-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
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

function DamageResultPanel({ calculation, form, label }) {
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
        <div className="damage-result-matchup">
          <PokemonSprite pokemon={findPokemonSprite(form.attacker.species)} name={result.attacker.name} size={82} decorative />
          <span className="damage-versus" aria-hidden="true">VS</span>
          <PokemonSprite pokemon={findPokemonSprite(form.defender.species)} name={result.defender.name} size={82} decorative />
        </div>
        <div className="damage-result-copy">
          <p className="page-label">{label} · {result.gameType}</p>
          <h2>{result.attacker.name} usa {result.move.name}</h2>
          <p className="form-hint">Contra {result.defender.name} · nível 50 · {hitSummary}</p>
        </div>
        {!isStatusMove && <div className="damage-result-range"><strong>{result.min}–{result.max}</strong><span>de dano</span></div>}
      </div>
      {isStatusMove ? (
        <p className="damage-status-note">Este golpe não causa dano direto.</p>
      ) : (
        <>
          <p className="damage-percent">{formatPercent(result.minPercent)}–{formatPercent(result.maxPercent)} da vida máxima calculada do alvo ({result.defender.stats.hp} HP)</p>
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
          <details className="damage-breakdown" open>
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
        </>
      )}
      <p className="damage-engine-note">Motor: <a href="https://github.com/smogon/damage-calc" target="_blank" rel="noreferrer">@smogon/calc 0.12.0</a>, licença MIT. Fórmulas e dados seguem o motor; a tela não valida legalidade, precisão, chance de acerto ou probabilidade de crítico.</p>
    </section>
  );
}

export function DamageCalculatorPage() {
  const location = useLocation();
  const [form, setForm] = useState(() => initialForm(location.search));
  const [comparison, setComparison] = useState({ enabled: false, form: null });
  const comparisonForm = comparison.enabled ? comparison.form : null;
  const moveData = getDamageMove(form.move);
  const availableHits = moveData ? getHitOptions(moveData) : [1];
  const showSpreadTargetCount = form.gameType === "Doubles" && moveData?.category !== "Status" && isSpreadTargetMove(moveData);
  const comparisonMoveData = getDamageMove(comparisonForm?.move);
  const showComparisonTargetCount = comparisonForm?.gameType === "Doubles" && comparisonMoveData?.category !== "Status" && isSpreadTargetMove(comparisonMoveData);
  const comparisonAvailableHits = useMemo(
    () => comparisonMoveData ? getHitOptions(comparisonMoveData) : [1],
    [comparisonMoveData],
  );

  const calculation = useMemo(() => {
    try {
      return { result: calculateChampionsDamage(form), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Não foi possível calcular este cenário." };
    }
  }, [form]);

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

  const announcementText = comparison.enabled
    ? [
      resultAnnouncement("Cenário A", calculation),
      comparisonForm?.move.trim()
        ? resultAnnouncement("Cenário B", comparisonCalculation)
        : "Cenário B: escolha um golpe para comparar.",
    ].join(" ")
    : resultAnnouncement("Resultado", calculation);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(() => setAnnouncement(announcementText), 450);
    return () => clearTimeout(timeoutId);
  }, [announcementText]);

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
    setComparison((current) => ({
      ...current,
      form: current.form && {
        ...current.form,
        move: value,
        hits: move ? getHitOptions(move)[0] : 1,
        targetsHit: isSpreadTargetMove(move) ? Math.max(2, Math.min(current.form.targetsHit || 2, getSpreadTargetLimit(move))) : 1,
      },
    }));
  }
  function updateComparison(key, value) {
    setComparison((current) => ({ ...current, form: current.form && { ...current.form, [key]: value } }));
  }
  function updateComparisonSide(key, value) {
    setComparison((current) => ({ ...current, form: current.form && { ...current.form, [key]: { ...current.form[key], ...value } } }));
  }
  function updateComparisonFieldSide(key, value) {
    updateComparison(key, { ...comparisonForm[key], ...value });
  }
  return (
    <div className="page-wrap damage-page">
      <div className="page-heading-row damage-heading">
        <div>
          <p className="page-label">Combate · Pokémon Champions</p>
          <h1>Calculadora de dano</h1>
          <p className="page-intro">Simule um golpe contra um alvo. A calculadora roda no navegador e mostra a faixa de dano do cenário escolhido.</p>
        </div>
        <Link className="button button-outline" to="/builder">Voltar ao construtor</Link>
      </div>

      <div className="damage-rules-note" role="note">
        <strong>Nível 50 · motor de Pokémon Showdown</strong>
        <p>Os SP entram na fórmula de Champions. Em Doubles, golpes em área só recebem o redutor quando atingem mais de um alvo válido; informe quantos estão no campo. Nada é enviado para uma API.</p>
      </div>

      <section className="damage-input-grid" aria-label="Pokémon e parâmetros do cálculo">
        <SideEditor title="Atacante" sideName="attacker" side={form.attacker} onChange={(value) => updateSide("attacker", value)} />
        <SideEditor title="Alvo" sideName="defender" side={form.defender} onChange={(value) => updateSide("defender", value)} />
      </section>

      <section className="damage-move-panel panel-frame" aria-labelledby="move-heading">
        <div className="section-heading"><h2 id="move-heading">Golpe e campo</h2><span>Simulação individual</span></div>
        <div className="damage-move-fields">
          <CatalogInput label="Golpe" value={form.move} onChange={handleMoveChange} list="damage-move-options" placeholder="Buscar golpe" />
          <label className="damage-field">
            <span>Formato do campo</span>
            <select className="text-input" value={form.gameType} onChange={(event) => update("gameType", event.target.value)}>
              <option value="Doubles">Doubles</option>
              <option value="Singles">Singles</option>
            </select>
          </label>
          {showSpreadTargetCount && (
            <label className="damage-field">
              <span>Alvos válidos no golpe</span>
              <select className="text-input" value={Math.min(form.targetsHit, getSpreadTargetLimit(moveData))} onChange={(event) => update("targetsHit", Number(event.target.value))}>
                {Array.from({ length: getSpreadTargetLimit(moveData) }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}</option>)}
              </select>
              <span className="form-hint">Conte alvos válidos antes de Proteção; o resultado é por alvo.</span>
            </label>
          )}
          <label className="damage-field">
            <span>Acertos</span>
            <select className="text-input" value={availableHits.includes(form.hits) ? form.hits : availableHits[0]} onChange={(event) => update("hits", Number(event.target.value))}>
              {availableHits.map((count) => <option value={count} key={count}>{count}</option>)}
            </select>
          </label>
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
          <FieldToggle label="Golpe crítico" checked={form.critical} onChange={(value) => update("critical", value)} />
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
        <div className="damage-comparison-controls">
          <FieldToggle
            label="Comparar com outro cenário"
            checked={comparison.enabled}
            onChange={(enabled) => setComparison(enabled
              ? { enabled: true, form: cloneDamageScenario(form) }
              : { enabled: false, form: comparison.form })}
          />
          {comparisonForm && (
            <>
              <p>O cenário B começa como uma cópia independente do cenário A. Alterá-lo não muda o cenário A nem os sets salvos no construtor.</p>
              <div className="damage-comparison-fields">
                <CatalogInput label="Golpe do cenário B" value={comparisonForm.move} onChange={handleComparisonMoveChange} list="damage-move-options" placeholder="Escolha outro golpe" />
                <label className="damage-field">
                  <span>Formato do cenário B</span>
                  <select className="text-input" value={comparisonForm.gameType} onChange={(event) => updateComparison("gameType", event.target.value)}>
                    <option value="Doubles">Doubles</option><option value="Singles">Singles</option>
                  </select>
                </label>
                {showComparisonTargetCount && (
                  <label className="damage-field">
                    <span>Alvos válidos no golpe B</span>
                    <select className="text-input" value={Math.min(comparisonForm.targetsHit, getSpreadTargetLimit(comparisonMoveData))} onChange={(event) => updateComparison("targetsHit", Number(event.target.value))}>
                      {Array.from({ length: getSpreadTargetLimit(comparisonMoveData) }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}</option>)}
                    </select>
                    <span className="form-hint">Conte alvos válidos antes de Proteção; o resultado é por alvo.</span>
                  </label>
                )}
                <label className="damage-field">
                  <span>Acertos no cenário B</span>
                  <select className="text-input" value={comparisonAvailableHits.includes(comparisonForm.hits) ? comparisonForm.hits : comparisonAvailableHits[0]} onChange={(event) => updateComparison("hits", Number(event.target.value))}>
                    {comparisonAvailableHits.map((count) => <option value={count} key={count}>{count}</option>)}
                  </select>
                </label>
                <label className="damage-field">
                  <span>Clima no cenário B</span>
                  <select className="text-input" value={comparisonForm.weather} onChange={(event) => updateComparison("weather", event.target.value)}>
                    <option value="">Sem clima</option>
                    {damageCalculatorCatalog.weather.map((weather) => <option value={weather} key={weather}>{weather}</option>)}
                  </select>
                </label>
                <label className="damage-field">
                  <span>Terreno no cenário B</span>
                  <select className="text-input" value={comparisonForm.terrain} onChange={(event) => updateComparison("terrain", event.target.value)}>
                    <option value="">Sem terreno</option>
                    {damageCalculatorCatalog.terrain.map((terrain) => <option value={terrain} key={terrain}>{terrain}</option>)}
                  </select>
                </label>
                <FieldToggle label="Crítico no cenário B" checked={comparisonForm.critical} onChange={(critical) => updateComparison("critical", critical)} />
              </div>
              <div className="damage-input-grid damage-comparison-team" aria-label="Pokémon do cenário B">
                <SideEditor title="Atacante · cenário B" sideName="comparison-attacker" side={comparisonForm.attacker} onChange={(value) => updateComparisonSide("attacker", value)} />
                <SideEditor title="Alvo · cenário B" sideName="comparison-defender" side={comparisonForm.defender} onChange={(value) => updateComparisonSide("defender", value)} />
              </div>
              <details className="damage-field-advanced">
                <summary>Condições de campo do cenário B</summary>
                <div className="damage-field-conditions">
                  <div><h3>Lado do atacante</h3><FieldToggle label="Helping Hand" checked={comparisonForm.attackerSide.isHelpingHand} onChange={(value) => updateComparisonFieldSide("attackerSide", { isHelpingHand: value })} /></div>
                  <div>
                    <h3>Lado do alvo</h3>
                    <FieldToggle label="Reflect" checked={comparisonForm.defenderSide.isReflect} onChange={(value) => updateComparisonFieldSide("defenderSide", { isReflect: value })} />
                    <FieldToggle label="Light Screen" checked={comparisonForm.defenderSide.isLightScreen} onChange={(value) => updateComparisonFieldSide("defenderSide", { isLightScreen: value })} />
                    <FieldToggle label="Aurora Veil" checked={comparisonForm.defenderSide.isAuroraVeil} onChange={(value) => updateComparisonFieldSide("defenderSide", { isAuroraVeil: value })} />
                    <FieldToggle label="Friend Guard" checked={comparisonForm.defenderSide.isFriendGuard} onChange={(value) => updateComparisonFieldSide("defenderSide", { isFriendGuard: value })} />
                    <FieldToggle label="Proteção ativa" checked={comparisonForm.defenderSide.isProtected} onChange={(value) => updateComparisonFieldSide("defenderSide", { isProtected: value })} />
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      </section>

      {comparison.enabled ? (
        <>
          <p className="damage-comparison-note" role="note">Comparação lado a lado. Cada cenário mostra seus rolls e modificadores; não compartilha probabilidades entre golpes.</p>
          <div className="damage-comparison-results" aria-label="Comparação dos cenários">
            <DamageResultPanel calculation={calculation} form={form} label="Cenário A · atual" />
            {comparisonForm?.move.trim() ? (
              <DamageResultPanel calculation={comparisonCalculation} form={comparisonForm} label="Cenário B · comparação" />
            ) : (
              <section className="damage-comparison-empty panel-frame" role="status">
                <p className="page-label">Cenário B</p>
                <h2>Escolha um golpe</h2>
                <p>O resultado aparecerá aqui quando o golpe do segundo cenário estiver no catálogo.</p>
              </section>
            )}
          </div>
        </>
      ) : (
        <DamageResultPanel calculation={calculation} form={form} label="Resultado" />
      )}
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

