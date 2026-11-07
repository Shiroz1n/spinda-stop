import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { NaturePicker } from "../components/NaturePicker.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { getNatureForStat, getNatureSpeedClass } from "../data/natures.js";
import { calculateChampionsSpeed, calculateStandardSpeed, compareSpeed, compareSpeedOrder, minimumTrainingToOutspeed } from "../data/speedTiers.js";
import { usageProviders } from "../data/usage/registry.js";
import { getChampionsIndexedPokemon } from "../data/pokemonChampionsRoster.js";
const bySlug = new Map(dexData.pokemon.map((pokemon) => [pokemon.slug, pokemon]));

function baseSpeed(pokemon) {
  return detailData.pokemonBySlug[pokemon.slug]?.stats?.spe ?? pokemon.stats?.spe ?? null;
}

function normalizedSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function speedFor(pokemon, model, side) {
  const base = baseSpeed(pokemon);
  if (!base) return null;
  return model === "standard"
    ? calculateStandardSpeed({ baseSpeed: base, level: side.level, iv: side.iv, ev: side.ev, nature: side.nature })
    : calculateChampionsSpeed(base, side.sp, side.nature);
}

function safeSpeedFor(pokemon, model, side) {
  try { return speedFor(pokemon, model, side); } catch { return null; }
}

function SpeedSettings({ label, model, values, onChange, target = false }) {
  return (
    <fieldset className="speed-settings">
      <legend>{label}</legend>
      <NaturePicker id={`speed-${target ? "target" : "candidate"}-nature`} label={`Nature · ${label.toLocaleLowerCase("pt-BR")}`} value={values.nature} onChange={(nature) => onChange("nature", nature)} className={`speed-setting-nature${target ? " speed-nature-target" : ""}`} />
      {model === "champions" ? (
        <label className="speed-setting-field">
          <span>SP de Speed</span>
          <input className="text-input" type="number" min="0" max="32" step="1" value={values.sp} onChange={(event) => onChange("sp", event.target.value === "" ? 0 : Math.min(32, Math.max(0, Number(event.target.value))))} />
        </label>
      ) : (
        <>
          {!target && <label className="speed-setting-field"><span>Nível</span><input className="text-input" type="number" min="1" max="100" value={values.level} onChange={(event) => onChange("level", Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /></label>}
          <label className="speed-setting-field"><span>IV de Speed</span><input className="text-input" type="number" min="0" max="31" value={values.iv} onChange={(event) => onChange("iv", Math.min(31, Math.max(0, Number(event.target.value) || 0)))} /></label>
          <label className="speed-setting-field"><span>EV de Speed</span><input className="text-input" type="number" min="0" max="252" step="4" value={values.ev} onChange={(event) => onChange("ev", Math.min(252, Math.max(0, Number(event.target.value) || 0)))} /></label>
        </>
      )}
    </fieldset>
  );
}

export function SpeedTiersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTarget = new URLSearchParams(location.search).get("target") || "";
  const [model, setModel] = useState("champions");
  const [roster, setRoster] = useState({ status: "loading", pokemon: [] });
  const [targetSlug, setTargetSlug] = useState(() => bySlug.has(requestedTarget) ? requestedTarget : "");
  const [targetQuery, setTargetQuery] = useState(() => bySlug.get(requestedTarget)?.name || "");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [sort, setSort] = useState("fastest");
  const [trickRoom, setTrickRoom] = useState(false);
  const [visibleCount, setVisibleCount] = useState(90);
  const [candidate, setCandidate] = useState({ nature: "Serious", sp: 0, level: 50, iv: 31, ev: 0 });
  const [target, setTarget] = useState({ nature: "Serious", sp: 0, level: 50, iv: 31, ev: 0 });
  useEffect(() => {
    let active = true;
    usageProviders["pokemon-champions-battle-data"].loadIndex()
      .then((index) => { if (active) setRoster({ status: "ready", pokemon: getChampionsIndexedPokemon(index, dexData.pokemon) }); })
      .catch(() => { if (active) setRoster({ status: "error", pokemon: [] }); });
    return () => { active = false; };
  }, []);
  const availablePokemon = model === "champions" ? roster.pokemon : dexData.pokemon;
  const availableSlugs = useMemo(() => new Set(availablePokemon.map((pokemon) => pokemon.slug)), [availablePokemon]);
  const selectedTarget = availableSlugs.has(targetSlug) ? bySlug.get(targetSlug) || null : null;
  const targetOptions = useMemo(() => {
    const query = normalizedSearch(targetQuery.trim());
    if (!query || selectedTarget?.name === targetQuery) return [];
    return availablePokemon.filter((pokemon) => normalizedSearch(`${pokemon.name} ${pokemon.speciesName} ${pokemon.slug} ${pokemon.speciesId}`).includes(query)).slice(0, 10);
  }, [availablePokemon, selectedTarget?.name, targetQuery]);

  const targetSpeed = useMemo(() => selectedTarget ? safeSpeedFor(selectedTarget, model, { ...target, level: candidate.level }) : null, [selectedTarget, model, candidate.level, target]);
  const ranked = useMemo(() => {
    if (!selectedTarget || targetSpeed === null) return [];
    const query = normalizedSearch(candidateQuery.trim());
    return availablePokemon
      .filter((pokemon) => !query || normalizedSearch(`${pokemon.name} ${pokemon.speciesName} ${pokemon.slug} ${pokemon.speciesId}`).includes(query))
      .map((pokemon) => {
        const value = safeSpeedFor(pokemon, model, { ...candidate, level: candidate.level });
        const relation = compareSpeed(value, targetSpeed);
        const pokemonBaseSpeed = baseSpeed(pokemon);
        const required = !Number.isFinite(pokemonBaseSpeed) ? null : model === "champions"
          ? minimumTrainingToOutspeed({ model, baseSpeed: pokemonBaseSpeed, targetSpeed, nature: candidate.nature })
          : minimumTrainingToOutspeed({ model, baseSpeed: pokemonBaseSpeed, targetSpeed, nature: candidate.nature, level: candidate.level, iv: candidate.iv });
        const favorableNature = getNatureForStat("spe", "up")?.name || "Timid";
        const favorableRequired = required === null && getNatureSpeedClass(candidate.nature) !== "favorable" && Number.isFinite(pokemonBaseSpeed)
          ? minimumTrainingToOutspeed({ model, baseSpeed: pokemonBaseSpeed, targetSpeed, nature: favorableNature, level: candidate.level, iv: candidate.iv })
          : null;
        const order = compareSpeedOrder(value, targetSpeed, trickRoom);
        return { pokemon, value, relation, order, required, favorableRequired, favorableNature };
      })
      .sort((left, right) => {
        if (left.value === null && right.value !== null) return 1;
        if (right.value === null && left.value !== null) return -1;
        const leftSpeed = left.value ?? Number.NEGATIVE_INFINITY;
        const rightSpeed = right.value ?? Number.NEGATIVE_INFINITY;
        return sort === "slowest"
          ? leftSpeed - rightSpeed || left.pokemon.name.localeCompare(right.pokemon.name)
          : rightSpeed - leftSpeed || left.pokemon.name.localeCompare(right.pokemon.name);
      });
  }, [availablePokemon, selectedTarget, targetSpeed, candidateQuery, model, candidate, sort, trickRoom]);
  const visibleRows = ranked.slice(0, visibleCount);

  function updateCandidate(key, value) {
    setCandidate((current) => ({ ...current, [key]: value }));
    setVisibleCount(90);
  }
  function updateTarget(key, value) {
    setTarget((current) => ({ ...current, [key]: value }));
  }
  function chooseTarget(pokemon) {
    setTargetSlug(pokemon.slug);
    setTargetQuery(pokemon.name);
    setVisibleCount(90);
    navigate(`/speed-tiers?target=${encodeURIComponent(pokemon.slug)}`, { replace: true });
  }
  function switchModel(nextModel) {
    setModel(nextModel);
    setVisibleCount(90);
  }

  return (
    <div className="page-wrap speed-page">
      <div className="page-heading-row speed-heading">
        <div>
          <p className="page-label">Doubles · comparação calculada</p>
          <h1>Speed Tiers</h1>
          <p className="page-intro">Compare a ordem de Speed e veja quanto falta para passar o alvo.</p>
        </div>
        <Link className="button button-outline" to="/builder">Comparar meu time</Link>
      </div>

      <section className="speed-workbench" aria-label="Configuração dos tiers de Speed">
        <div className="speed-model-row">
          <label className="speed-setting-field">
            <span>Modelo de stats</span>
            <select className="text-input" value={model} onChange={(event) => switchModel(event.target.value)}>
              <option value="champions">Champions · SP</option>
              <option value="standard">Padrão · EV/IV</option>
            </select>
          </label>
          <label className="speed-target-search">
            <span>Alvo da comparação</span>
            <input className="text-input" value={targetQuery} onChange={(event) => { setTargetQuery(event.target.value); setTargetSlug(""); }} placeholder="Buscar espécie ou forma" autoComplete="off" role="combobox" aria-expanded={targetOptions.length > 0} aria-controls="speed-target-options" />
            {targetOptions.length > 0 && <div className="speed-search-options" id="speed-target-options" role="listbox">{targetOptions.map((pokemon) => <button type="button" role="option" aria-selected="false" key={pokemon.slug} onClick={() => chooseTarget(pokemon)}><PokemonSprite pokemon={pokemon} name={pokemon.name} size={38} decorative /><span>{pokemon.name}<small>#{pokemon.speciesId} · {pokemon.formId === "default" ? "forma base" : pokemon.formId}</small></span></button>)}</div>}
          </label>
          <label className="speed-setting-field">
            <span>Ordenar</span>
            <select className="text-input" value={sort} onChange={(event) => setSort(event.target.value)}><option value="fastest">Mais rápidos primeiro</option><option value="slowest">Mais lentos primeiro</option></select>
          </label>
          <label className="speed-trick-room-toggle"><input type="checkbox" checked={trickRoom} onChange={(event) => setTrickRoom(event.target.checked)} /><span>Trick Room ativo</span><small>A Speed bruta não muda; a ordem é invertida.</small></label>
        </div>

      </section>

      {!selectedTarget ? (
        <section className="speed-empty" role="status"><span className="speed-empty-mark">→</span><div><h2>{model === "champions" && roster.status === "loading" ? "Carregando o índice de Doubles" : model === "champions" && roster.status === "error" ? "Índice de Champions indisponível" : targetSlug && model === "champions" ? "Alvo fora do índice atual" : "Escolha um alvo"}</h2><p>{model === "champions" && roster.status === "loading" ? "A lista será limitada às formas indexadas para Doubles." : model === "champions" && roster.status === "error" ? "Tente novamente mais tarde ou selecione Padrão para consultar o catálogo geral." : targetSlug && model === "champions" ? "Escolha uma forma indexada para Doubles ou selecione Padrão para usar o catálogo geral." : "Os resultados aparecem aqui com os empates e o menor SP/EV que passa a Speed do alvo."}</p></div></section>
      ) : (
        <>
          <section className="speed-target-banner" aria-label={`Alvo ${selectedTarget.name}`}>
            <PokemonSprite pokemon={selectedTarget} name={selectedTarget.name} size={76} priority decorative />
            <div className="speed-target-copy"><p className="page-label">Alvo · {selectedTarget.formId === "default" ? "forma base" : selectedTarget.formId}</p><h2>{selectedTarget.name}</h2><div className="type-list">{selectedTarget.types.map((type) => <TypeTag type={type} key={type} />)}</div></div>
            <div className="speed-target-value"><strong>{targetSpeed ?? "—"}</strong><span>Speed</span><small>calculada · nível {candidate.level}</small></div>
          </section>
          <details className="speed-assumptions-disclosure">
            <summary>Nature e pontos de Speed <span>Comparados: {candidate.nature} · {model === "champions" ? `${candidate.sp} pontos` : `${candidate.ev} EV`} | Alvo: {target.nature} · {model === "champions" ? `${target.sp} pontos` : `${target.ev} EV`}</span></summary>
            <div className="speed-assumptions">
              <SpeedSettings label="Pokémon comparados" model={model} values={candidate} onChange={updateCandidate} />
              <SpeedSettings label="Alvo" model={model} values={{ ...target, level: candidate.level }} onChange={updateTarget} target />
            </div>
          </details>
          <div className="speed-results-toolbar"><div><strong>{ranked.length.toLocaleString("pt-BR")}</strong> {model === "champions" ? "entradas no índice Doubles" : "entradas no catálogo"}</div><label>Buscar na lista <input className="text-input" value={candidateQuery} onChange={(event) => { setCandidateQuery(event.target.value); setVisibleCount(90); }} placeholder="Espécie ou forma" /></label></div>
          <div className="speed-results-head" aria-hidden="true"><span>Pokémon</span><span>Speed</span><span>Contra o alvo</span><span>{model === "champions" ? "SP para passar" : "EV para passar"}</span></div>
          <div className="speed-results-list" aria-live="polite">
            {visibleRows.map(({ pokemon, value, relation, order, required, favorableRequired, favorableNature }) => (
              <article className={`speed-result-row is-${relation}`} key={pokemon.slug}>
                <div className="speed-result-pokemon"><PokemonSprite pokemon={pokemon} name={pokemon.name} size={48} decorative /><div><strong>{pokemon.name}</strong><small>#{pokemon.speciesId} · {pokemon.formId === "default" ? "forma base" : pokemon.formId}</small><span className="type-list">{pokemon.types.map((type) => <TypeTag type={type} key={type} />)}</span></div></div>
                <strong className="speed-result-number">{value ?? "—"}</strong>
                <span className={`speed-relation speed-relation-${relation}`}>{relation === "faster" ? "Ultrapassa" : relation === "tie" ? "Empata" : relation === "slower" ? "Abaixo" : "Sem dado"}{order === "first" ? " · atua antes" : order === "second" ? " · atua depois" : ""}</span>
                <span className="speed-threshold">
                  <span>{relation === "faster" ? "—" : required === null ? (model === "champions" ? (candidate.nature === "favorable" ? "Não passa com natureza favorável e 32 SP" : "Não passa com até 32 SP") : "Não alcança no modelo") : `${required} ${model === "champions" ? "SP" : "EV"}`}</span>
                  {required === null && favorableRequired !== null && <small>{favorableNature} (Velocidade ↑ · simulação): {favorableRequired} {model === "champions" ? "SP" : "EV"}</small>}
                  {required === null && getNatureSpeedClass(candidate.nature) !== "favorable" && favorableRequired === null && model === "champions" && <small>Nem Timid (Velocidade ↑) + 32 SP ultrapassa</small>}
                </span>
              </article>
            ))}
            {ranked.length === 0 && <p className="empty-state">Nenhuma espécie corresponde à busca.</p>}
          </div>
          {visibleCount < ranked.length ? <button className="button button-outline speed-load-more" type="button" onClick={() => setVisibleCount((count) => Math.min(ranked.length, count + 90))}>Mostrar mais {Math.min(90, ranked.length - visibleCount)}</button> : <p className="speed-end">Fim da lista · {ranked.length.toLocaleString("pt-BR")} entradas</p>}
        </>
      )}
      <details className="speed-about"><summary>Sobre o cálculo e os dados</summary><p>Champions usa o índice atual de Doubles do Pokémon Champions Battle Data; a lista não é uma confirmação oficial de legalidade. O cálculo usa nível 50, base, Stat Points e Nature. Trick Room inverte a ordem; outros efeitos de batalha não entram. O tier calculado não é ranking de uso.</p><p>Outros jogos usam base, IV, EV e nível como hipótese. Espécies e formas vêm da PokéAPI.</p></details>
    </div>
  );
}
