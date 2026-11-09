import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import detailData from "@spinda-stop/data/details";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { NaturePicker } from "../components/NaturePicker.jsx";
import { TypeTag } from "../components/TypeTag.jsx";
import { getNatureForStat, getNatureSpeedClass } from "../data/natures.js";
import { applySpeedModifiers, calculateChampionsSpeed, calculateStandardSpeed, compareSpeed, compareSpeedOrder, minimumTrainingToOutspeed } from "../data/speedTiers.js";
import { getChampionsEligibleMegaPokemon, getChampionsEligiblePokemon, getChampionsRosterSummary } from "../data/pokemonChampionsRoster.js";
import { clearRecentResearch, readStoredResearchShortcuts, rememberComparison, toggleFavoriteComparison, writeStoredResearchShortcuts } from "../data/researchShortcuts.js";
import { parseSpeedTiersRoute, serializeSpeedTiersRoute } from "./speedTiersRoute.js";
const bySlug = new Map(dexData.pokemon.map((pokemon) => [pokemon.slug, pokemon]));
const pokemonSlugs = [...bySlug.keys()];
const REGULATIONS = ["M-A", "M-B", "M-C"];

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
      <label className="speed-setting-toggle"><input type="checkbox" checked={Boolean(values.tailwind)} onChange={(event) => onChange("tailwind", event.target.checked)} /><span>Tailwind ativo</span></label>
      {model === "standard" && <label className="speed-setting-toggle"><input type="checkbox" checked={Boolean(values.choiceScarf)} onChange={(event) => onChange("choiceScarf", event.target.checked)} /><span>Choice Scarf (hipótese)</span></label>}
    </fieldset>
  );
}

export function SpeedTiersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const availableRegulations = useMemo(() => REGULATIONS.filter((id) => getChampionsRosterSummary(id)), []);
  const routeSettings = useMemo(() => parseSpeedTiersRoute(location.search, { availableRegulations, pokemonSlugs }), [location.search, availableRegulations]);
  const [model, setModel] = useState(routeSettings.model);
  const [regulation, setRegulation] = useState(routeSettings.regulation);
  const [includeMegas, setIncludeMegas] = useState(routeSettings.includeMegas);
  const [targetSlug, setTargetSlug] = useState(routeSettings.targetSlug);
  const [targetQuery, setTargetQuery] = useState(() => routeSettings.targetQuery || bySlug.get(routeSettings.targetSlug)?.name || "");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [sort, setSort] = useState(routeSettings.sort);
  const [trickRoom, setTrickRoom] = useState(routeSettings.trickRoom);
  const [visibleCount, setVisibleCount] = useState(90);
  const [candidate, setCandidate] = useState(routeSettings.candidate);
  const [target, setTarget] = useState(routeSettings.target);
  const [shortcuts, setShortcuts] = useState(readStoredResearchShortcuts);
  useEffect(() => {
    setModel(routeSettings.model);
    setRegulation(routeSettings.regulation);
    setIncludeMegas(routeSettings.includeMegas);
    setSort(routeSettings.sort);
    setTargetSlug(routeSettings.targetSlug);
    setTargetQuery(routeSettings.targetQuery || bySlug.get(routeSettings.targetSlug)?.name || "");
    setCandidate(routeSettings.candidate);
    setTarget(routeSettings.target);
    setTrickRoom(routeSettings.trickRoom);
  }, [routeSettings]);
  useEffect(() => {
    const canonicalSearch = `?${serializeSpeedTiersRoute(routeSettings, availableRegulations)}`;
    if (location.search !== canonicalSearch) {
      navigate(`${location.pathname}${canonicalSearch}${location.hash}`, { replace: true });
    }
  }, [availableRegulations, location.hash, location.pathname, location.search, navigate, routeSettings]);
  const regulationSummary = getChampionsRosterSummary(regulation);
  const confirmedRoster = useMemo(() => getChampionsEligiblePokemon(dexData.pokemon, regulation), [regulation]);
  const megaPokemon = useMemo(() => getChampionsEligibleMegaPokemon(dexData.pokemon, regulation), [regulation]);
  const availablePokemon = useMemo(() => model === "champions"
    ? confirmedRoster.filter((pokemon) => includeMegas || !String(pokemon.formId || "").startsWith("mega"))
    : dexData.pokemon, [model, confirmedRoster, includeMegas]);
  const availableSlugs = useMemo(() => new Set(availablePokemon.map((pokemon) => pokemon.slug)), [availablePokemon]);
  const selectedTarget = availableSlugs.has(targetSlug) ? bySlug.get(targetSlug) || null : null;
  const currentComparison = selectedTarget ? {
    key: serializeSpeedTiersRoute({ ...routeSettings, targetSlug: selectedTarget.slug, targetQuery: "" }, availableRegulations),
    title: `${selectedTarget.name} · ${model === "champions" ? regulation : "Padrão"}`,
    url: `/speed-tiers?${serializeSpeedTiersRoute({ ...routeSettings, targetSlug: selectedTarget.slug, targetQuery: "" }, availableRegulations)}`,
  } : null;
  useEffect(() => {
    if (!currentComparison) return;
    setShortcuts((current) => {
      const next = rememberComparison(current, currentComparison);
      if (next !== current) writeStoredResearchShortcuts(next);
      return next;
    });
  }, [currentComparison?.key, currentComparison?.title, currentComparison?.url]);
  const targetOptions = useMemo(() => {
    const query = normalizedSearch(targetQuery.trim());
    if (!query || selectedTarget?.name === targetQuery) return [];
    return availablePokemon.filter((pokemon) => normalizedSearch(`${pokemon.name} ${pokemon.speciesName} ${pokemon.slug} ${pokemon.speciesId} ${(pokemon.aliases || []).join(" ")}`).includes(query)).slice(0, 10);
  }, [availablePokemon, selectedTarget?.name, targetQuery]);

  function updateRoute(patch) {
    const nextSettings = { ...routeSettings, ...patch };
    const search = serializeSpeedTiersRoute(nextSettings, availableRegulations);
    navigate(`${location.pathname}?${search}${location.hash}`, { replace: true });
  }

  const rawTargetSpeed = useMemo(() => selectedTarget ? safeSpeedFor(selectedTarget, model, { ...target, level: candidate.level }) : null, [selectedTarget, model, candidate.level, target]);
  const targetSpeed = applySpeedModifiers(rawTargetSpeed, { tailwind: target.tailwind, choiceScarf: model === "standard" && target.choiceScarf });
  const ranked = useMemo(() => {
    if (!selectedTarget || targetSpeed === null) return [];
    const query = normalizedSearch(candidateQuery.trim());
    return availablePokemon
      .filter((pokemon) => !query || normalizedSearch(`${pokemon.name} ${pokemon.speciesName} ${pokemon.slug} ${pokemon.speciesId}`).includes(query))
      .map((pokemon) => {
        const rawValue = safeSpeedFor(pokemon, model, { ...candidate, level: candidate.level });
        const modifiers = { tailwind: candidate.tailwind, choiceScarf: model === "standard" && candidate.choiceScarf };
        const value = applySpeedModifiers(rawValue, modifiers);
        const relation = compareSpeed(value, targetSpeed);
        const pokemonBaseSpeed = baseSpeed(pokemon);
        const required = !Number.isFinite(pokemonBaseSpeed) ? null : model === "champions"
          ? minimumTrainingToOutspeed({ model, baseSpeed: pokemonBaseSpeed, targetSpeed, nature: candidate.nature, modifiers })
          : minimumTrainingToOutspeed({ model, baseSpeed: pokemonBaseSpeed, targetSpeed, nature: candidate.nature, level: candidate.level, iv: candidate.iv, modifiers });
        const favorableNature = getNatureForStat("spe", "up")?.name || "Timid";
        const favorableRequired = required === null && getNatureSpeedClass(candidate.nature) !== "favorable" && Number.isFinite(pokemonBaseSpeed)
          ? minimumTrainingToOutspeed({ model, baseSpeed: pokemonBaseSpeed, targetSpeed, nature: favorableNature, level: candidate.level, iv: candidate.iv, modifiers })
          : null;
        const order = compareSpeedOrder(value, targetSpeed, trickRoom);
        return { pokemon, pokemonBaseSpeed, rawValue, value, relation, order, required, favorableRequired, favorableNature };
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
    const next = { ...candidate, [key]: value };
    setCandidate(next);
    updateRoute({ candidate: next });
    setVisibleCount(90);
  }
  function updateTarget(key, value) {
    const next = { ...target, [key]: value };
    setTarget(next);
    updateRoute({ target: next });
  }
  function updateComparisonShortcuts(next) {
    setShortcuts(next);
    writeStoredResearchShortcuts(next);
  }
  function chooseTarget(pokemon) {
    setVisibleCount(90);
    updateRoute({ targetSlug: pokemon.slug, targetQuery: "" });
  }
  function switchModel(nextModel) {
    if (nextModel !== "champions" && nextModel !== "standard") return;
    updateRoute({ model: nextModel });
    setVisibleCount(90);
  }
  function switchRegulation(nextRegulation) {
    if (!availableRegulations.includes(nextRegulation)) return;
    updateRoute({ regulation: nextRegulation });
    setVisibleCount(90);
  }
  function toggleMegas(checked) {
    updateRoute({ includeMegas: checked });
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
          {model === "champions" && (availableRegulations.length > 0
            ? <label className="speed-setting-field"><span>Regulamento</span><select className="text-input" value={regulation} onChange={(event) => switchRegulation(event.target.value)}>{availableRegulations.map((id) => <option value={id} key={id}>{id}</option>)}</select></label>
            : <p className="speed-no-regulation" role="status">Nenhum regulamento de Champions tem roster confirmado.</p>)}
          <label className="speed-target-search">
            <span>Alvo da comparação</span>
            <input className="text-input" value={targetQuery} onChange={(event) => {
              const query = event.target.value;
              setTargetQuery(query);
              setTargetSlug("");
              updateRoute({ targetSlug: "", targetQuery: query });
            }} placeholder="Buscar espécie ou forma" autoComplete="off" role="combobox" aria-expanded={targetOptions.length > 0} aria-controls="speed-target-options" />
            {targetOptions.length > 0 && <div className="speed-search-options" id="speed-target-options" role="listbox">{targetOptions.map((pokemon) => <button type="button" role="option" aria-selected="false" key={pokemon.slug} onClick={() => chooseTarget(pokemon)}><PokemonSprite pokemon={pokemon} name={pokemon.name} size={38} decorative /><span>{pokemon.name}<small>#{pokemon.speciesId} · {pokemon.formId === "default" ? "forma base" : pokemon.formId}</small></span></button>)}</div>}
          </label>
          <label className="speed-setting-field">
            <span>Ordenar</span>
            <select className="text-input" value={sort} onChange={(event) => updateRoute({ sort: event.target.value })}><option value="fastest">Mais rápidos primeiro</option><option value="slowest">Mais lentos primeiro</option></select>
          </label>
          <label className="speed-trick-room-toggle"><input type="checkbox" checked={trickRoom} onChange={(event) => { setTrickRoom(event.target.checked); updateRoute({ trickRoom: event.target.checked }); }} /><span>Trick Room ativo</span><small>A Speed bruta não muda; a ordem é invertida.</small></label>
        </div>

      </section>

      {!selectedTarget ? (
        <section className="speed-empty" role="status"><span className="speed-empty-mark">→</span><div><h2>{targetSlug && model === "champions" ? "Alvo fora do roster selecionado" : "Escolha um alvo"}</h2><p>{targetSlug && model === "champions" ? `Não há elegibilidade confirmada para esta forma no ${regulation}${!includeMegas && String(bySlug.get(targetSlug)?.formId || "").startsWith("mega") ? ". Ative “Incluir Megas” para compará-la quando elegível." : ". Escolha outra forma ou troque o regulamento."}` : "Os resultados aparecem aqui com empates e o menor SP/EV que passa a Speed do alvo."}</p></div></section>
      ) : (
        <>
          <section className="speed-target-banner" aria-label={`Alvo ${selectedTarget.name}`}>
            <PokemonSprite pokemon={selectedTarget} name={selectedTarget.name} size={76} priority decorative />
            <div className="speed-target-copy"><p className="page-label">Alvo · {selectedTarget.formId === "default" ? "forma base" : selectedTarget.formId}</p><h2>{selectedTarget.name}</h2><div className="type-list">{selectedTarget.types.map((type) => <TypeTag type={type} key={type} />)}</div></div>
            <div className="speed-target-value"><strong>{targetSpeed ?? "—"}</strong><span>Speed na ordem</span><small>Base {baseSpeed(selectedTarget) ?? "—"} · bruta {rawTargetSpeed ?? "—"} · nível {candidate.level}</small></div>
          </section>
          {(shortcuts.favoriteComparisons.length > 0 || shortcuts.recentComparisons.length > 0) && <section className="research-shortcuts speed-comparison-shortcuts" aria-label="Comparações de Speed salvas e recentes">
            {shortcuts.favoriteComparisons.length > 0 && <div><div className="research-shortcuts-heading"><h2>Favoritas</h2><button className="text-button" type="button" onClick={() => updateComparisonShortcuts({ ...shortcuts, favoriteComparisons: [] })}>Limpar</button></div><ul>{shortcuts.favoriteComparisons.map((entry) => <li key={entry.key}><Link to={entry.url}>{entry.title}</Link><button type="button" aria-label={`Remover ${entry.title} das comparações favoritas`} onClick={() => updateComparisonShortcuts(toggleFavoriteComparison(shortcuts, entry))}>×</button></li>)}</ul></div>}
            {shortcuts.recentComparisons.length > 0 && <div><div className="research-shortcuts-heading"><h2>Recentes</h2><button className="text-button" type="button" onClick={() => updateComparisonShortcuts(clearRecentResearch(shortcuts, "comparison"))}>Limpar</button></div><ul>{shortcuts.recentComparisons.slice(0, 6).map((entry) => <li key={entry.key}><Link to={entry.url}>{entry.title}</Link></li>)}</ul></div>}
          </section>}
          {currentComparison && <button className="button button-outline speed-save-comparison" type="button" aria-pressed={shortcuts.favoriteComparisons.some((entry) => entry.key === currentComparison.key)} onClick={() => updateComparisonShortcuts(toggleFavoriteComparison(shortcuts, currentComparison))}>{shortcuts.favoriteComparisons.some((entry) => entry.key === currentComparison.key) ? "★ Comparação favorita" : "☆ Favoritar comparação"}</button>}
          <details className="speed-assumptions-disclosure">
            <summary>Hipóteses de Speed <span>Comparados: {candidate.nature} · {model === "champions" ? `${candidate.sp} SP` : `${candidate.ev} EV`} | Alvo: {target.nature} · {model === "champions" ? `${target.sp} SP` : `${target.ev} EV`}</span></summary>
            <div className="speed-assumptions">
              <SpeedSettings label="Pokémon comparados" model={model} values={candidate} onChange={updateCandidate} />
              <SpeedSettings label="Alvo" model={model} values={{ ...target, level: candidate.level }} onChange={updateTarget} target />
            </div>
          </details>
          <div className="speed-results-toolbar">
            <div><strong>{ranked.length.toLocaleString("pt-BR")}</strong> {model === "champions" ? "entradas no índice Doubles" : "entradas no catálogo"}</div>
            <div className="speed-results-options">
              <label className="speed-candidate-search">Buscar na lista <input className="text-input" value={candidateQuery} onChange={(event) => { setCandidateQuery(event.target.value); setVisibleCount(90); }} placeholder="Espécie ou forma" /></label>
              {model === "champions" && <label className="speed-mega-toggle"><input type="checkbox" checked={includeMegas} onChange={(event) => toggleMegas(event.target.checked)} /><span>Incluir Megas</span><small>{megaPokemon.length}</small></label>}
            </div>
          </div>
          <div className="speed-results-head" aria-hidden="true"><span>Pokémon</span><span>Speed na ordem</span><span>Contra o alvo</span><span>{model === "champions" ? "SP para passar" : "EV para passar"}</span></div>
          <div className="speed-results-list" aria-live="polite">
            {visibleRows.map(({ pokemon, pokemonBaseSpeed, rawValue, value, relation, order, required, favorableRequired, favorableNature }) => (
              <article className={`speed-result-row is-${relation}`} key={pokemon.slug}>
                <div className="speed-result-pokemon"><PokemonSprite pokemon={pokemon} name={pokemon.name} size={48} decorative /><div><strong>{pokemon.name}</strong><small>#{pokemon.speciesId} · {pokemon.formId === "default" ? "forma base" : pokemon.formId}</small><span className="type-list">{pokemon.types.map((type) => <TypeTag type={type} key={type} />)}</span></div></div>
                <span className="speed-result-number"><strong>{value ?? "—"}</strong><small>Base {pokemonBaseSpeed ?? "—"} · bruta {rawValue ?? "—"}</small></span>
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
      <details className="speed-about"><summary>Sobre o cálculo e os dados</summary><p>O modelo Champions usa o roster oficial {regulation} consultado em {regulationSummary?.checkedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(regulationSummary.checkedAt)) : "data não informada"}. Formas sem confirmação oficial ficam fora desta lista. O cálculo usa nível 50, stats base, Stat Points e Nature. Tailwind altera a ordem considerada; Trick Room só inverte a ordem, sem alterar Speed bruta.</p><p>O modelo geral usa base, IV, EV e nível; Choice Scarf é uma hipótese disponível nesse modo. Stats e formas gerais vêm da PokéAPI.</p>{regulationSummary?.sourceUrl && <p><a href={regulationSummary.sourceUrl} target="_blank" rel="noreferrer">Fonte do roster {regulation} ↗</a></p>}</details>
    </div>
  );
}
