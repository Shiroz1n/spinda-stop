import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { calculateChampionsDamage, damageCalculatorCatalog, getDamageCatalogOptions, getDamageMove, getHitOptions } from "../data/damageCalculator.js";

const statFields = [
  ["hp", "HP"], ["atk", "Atk"], ["def", "Def"],
  ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"],
];
const boostFields = statFields.slice(1);
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
  const cameFromBuilder = params.has("attacker");
  const move = params.get("move") || (cameFromBuilder ? "" : "Earthquake");
  const attacker = defaultSide(params.get("attacker") || "Garchomp", params.get("nature") || "Adamant");
  attacker.ability = params.get("ability") || "";
  attacker.item = params.get("item") || "";
  attacker.statPoints = Object.fromEntries(statFields.map(([key]) => [key, Math.max(0, Number(params.get(`sp-${key}`)) || 0)]));
  return {
    attacker,
    defender: defaultSide("Garchomp", "Serious"),
    move,
    hits: getHitOptions(getDamageMove(move))[0],
    gameType: "Doubles",
    weather: "",
    terrain: "",
    critical: false,
    attackerSide: { isHelpingHand: false },
    defenderSide: { isReflect: false, isLightScreen: false, isAuroraVeil: false, isFriendGuard: false, isProtected: false },
  };
}

function DataLists({ form }) {
  const renderSideOptions = (sideName) => {
    const side = form[sideName];
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
      {renderSideOptions("attacker")}
      {renderSideOptions("defender")}
      <datalist id="damage-move-options">{getDamageCatalogOptions("moves", form.move).map((name) => <option value={name} key={name} />)}</datalist>
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
  const prefix = sideName === "attacker" ? "Quem ataca" : "Quem recebe";
  function update(key, value) { onChange({ ...side, [key]: value }); }
  function updateNested(key, child, value) { onChange({ ...side, [key]: { ...side[key], [child]: value } }); }

  return (
    <section className="damage-side panel-frame" aria-labelledby={`${sideName}-heading`}>
      <div className="damage-side-heading">
        <p className="page-label">{prefix}</p>
        <h2 id={`${sideName}-heading`}>{title}</h2>
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
        <p className="form-hint">A fórmula do jogo é simulada; a legalidade e o total de SP não são validados.</p>
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

export function DamageCalculatorPage() {
  const location = useLocation();
  const [form, setForm] = useState(() => initialForm(location.search));
  const moveData = getDamageMove(form.move);
  const availableHits = moveData ? getHitOptions(moveData) : [1];

  const calculation = useMemo(() => {
    try {
      return { result: calculateChampionsDamage(form), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Não foi possível calcular este cenário." };
    }
  }, [form]);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function updateSide(key, value) { setForm((current) => ({ ...current, [key]: { ...current[key], ...value } })); }
  function updateFieldSide(key, value) { setForm((current) => ({ ...current, [key]: { ...current[key], ...value } })); }
  function handleMoveChange(value) {
    const move = getDamageMove(value);
    const hits = move ? getHitOptions(move)[0] : 1;
    setForm((current) => ({ ...current, move: value, hits }));
  }

  const result = calculation.result;
  const isStatusMove = result?.move.category === "Status";
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
        <p>Os SP entram na fórmula de Champions. Em Doubles, golpes em vários alvos recebem o redutor de área do motor. Nada é enviado para uma API.</p>
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
      </section>

      {calculation.error ? (
        <section className="damage-result damage-result-error" role="alert">
          <p className="page-label">Cenário incompleto</p>
          <h2>Confira os dados do cálculo</h2>
          <p>{calculation.error}</p>
        </section>
      ) : (
        <section className="damage-result panel-frame" aria-labelledby="damage-result-heading" aria-live="polite">
          <div className="damage-result-heading">
            <div>
              <p className="page-label">Resultado · {result.gameType}</p>
              <h2 id="damage-result-heading">{result.attacker.name} usa {result.move.name}</h2>
              <p className="form-hint">Contra {result.defender.name} · nível 50 · {result.hits} {result.hits === 1 ? "acerto" : "acertos"}</p>
            </div>
            {!isStatusMove && <div className="damage-result-range"><strong>{result.min}–{result.max}</strong><span>de dano</span></div>}
          </div>
          {isStatusMove ? (
            <p className="damage-status-note">Este golpe não causa dano direto.</p>
          ) : (
            <>
              <p className="damage-percent">{formatPercent(result.minPercent)}–{formatPercent(result.maxPercent)} da vida máxima calculada do alvo ({result.defender.stats.hp} HP)</p>
              {result.isSpread && <p className="damage-spread-note">Redutor de golpe em área aplicado para Doubles. O valor representa dano a um alvo.</p>}
              {result.hitRanges.length > 1 && <p className="damage-spread-note">Faixa por acerto: {result.hitRanges.map(([min, max], index) => `${index + 1}: ${min}–${max}`).join(" · ")}</p>}
              {result.rolls?.length === 16 && <p className="damage-rolls-label">16 variações de dano: {result.rolls.join(" · ")}</p>}
              {result.max === 0 && <p className="damage-spread-note">Neste cenário, o golpe não causa dano. Pode haver imunidade, proteção ou um efeito especial.</p>}
            </>
          )}
          <p className="damage-engine-note">Motor: <a href="https://github.com/smogon/damage-calc" target="_blank" rel="noreferrer">@smogon/calc 0.12.0</a>, licença MIT. Fórmulas e dados seguem o motor; a tela não valida legalidade, precisão, chance de acerto ou probabilidade de crítico.</p>
        </section>
      )}
      <DataLists form={form} />
    </div>
  );
}

