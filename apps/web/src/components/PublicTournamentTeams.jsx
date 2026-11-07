import { useEffect, useState } from "react";
import { importShowdownTeam } from "@spinda-stop/domain";
import dexData from "@spinda-stop/data/pokedex";
import { ItemSprite, PokemonSprite } from "./PokemonSprite.jsx";
import { TypeTag } from "./TypeTag.jsx";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";

const pokemonBySlug = new Map(dexData.pokemon.map((pokemon) => [pokemon.slug, pokemon]));
const findPokemon = createPokemonSpriteLookup(dexData.pokemon);

function normalized(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function PublicTournamentTeams({ pokemon, selectedPokemon, onImport, onApplySet }) {
  const [state, setState] = useState({ status: "loading", teams: [] });
  const [opened, setOpened] = useState(null);
  const [pastes, setPastes] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/teams?pokemon=${encodeURIComponent(pokemon.name)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("Não foi possível carregar equipes públicas agora.");
        return payload;
      })
      .then((payload) => setState({ status: "ready", teams: Array.isArray(payload.teams) ? payload.teams : [] }))
      .catch(() => { if (!controller.signal.aborted) setState({ status: "error", teams: [], message: "Não foi possível carregar equipes públicas agora." }); });
    return () => controller.abort();
  }, [pokemon.slug, pokemon.name]);

  async function loadPaste(team) {
    if (pastes[team.id]) return pastes[team.id];
    setPastes((current) => ({ ...current, [team.id]: { status: "loading" } }));
    try {
      const response = await fetch(`/api/public/teams/${encodeURIComponent(team.id)}/paste`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.text !== "string") throw new Error("Este paste não está disponível agora.");
      const parsed = importShowdownTeam(payload.text, dexData.pokemon, { allowPartial: true });
      if (!parsed.ok) throw new Error(parsed.error);
      const value = { status: "ready", text: payload.text, team: parsed.value, warnings: parsed.warnings, sourceUrl: payload.sourceUrl };
      setPastes((current) => ({ ...current, [team.id]: value }));
      return value;
    } catch (error) {
      const value = { status: "error", message: error.message || "Este paste não está disponível agora." };
      setPastes((current) => ({ ...current, [team.id]: value }));
      return value;
    }
  }

  async function toggleDetails(team) {
    const next = opened === team.id ? null : team.id;
    setOpened(next);
    if (next) await loadPaste(team);
  }

  async function importTeam(team) {
    setOpened(team.id);
    const paste = await loadPaste(team);
    if (paste.status === "ready") onImport(paste.text, { allowPartial: true });
  }

  async function applySet(team) {
    const paste = await loadPaste(team);
    if (paste.status !== "ready") return;
    const member = paste.team.members.find((entry) => entry?.pokemonId === selectedPokemon.slug);
    if (member) onApplySet(member, team);
  }

  return <aside className="builder-public-teams" aria-labelledby="builder-public-teams-title">
    <div className="builder-public-heading"><div><p className="page-label">Arquivo público · M-C</p><h2 id="builder-public-teams-title">Equipes com {pokemon.name}</h2></div><span>Até 6</span></div>
    <p className="builder-public-intro">Resultados arquivados de torneios comunitários; não representam eventos ao vivo.</p>
    {state.status === "loading" && <p role="status">Buscando equipes…</p>}
    {state.status === "error" && <p role="status">{state.message || "As equipes públicas não responderam."}</p>}
    {state.status === "ready" && state.teams.length === 0 && <p>Não encontramos equipes públicas para esta busca.</p>}
    {state.teams.length > 0 && <ol className="builder-public-list">{state.teams.map((team) => {
      const paste = pastes[team.id];
      const matchingMember = paste?.status === "ready" && paste.team.members.find((entry) => entry?.pokemonId === selectedPokemon.slug);
      return <li className="builder-public-card" key={team.id}>
        <div className="builder-public-card-heading"><strong>{team.player || "Jogador sem nome publicado"}</strong><time>{team.date || "Data não publicada"}</time></div>
        <p>{team.event || "Evento sem nome publicado"}{team.placement ? ` · ${team.placement}` : ""}</p>
        <div className="builder-public-sprites" aria-label="Pokémon da equipe">{team.pokemon.map((member, index) => {
          const local = resolveCompetitivePokemonSprite(findPokemon, { id: member.showdownId || member.pokemonId || member.id, name: member.name })
            || dexData.pokemon.find((entry) => normalized(entry.name) === normalized(member.name) || normalized(entry.slug) === normalized(member.name));
          return local ? <PokemonSprite key={`${team.id}-${index}`} pokemon={local} name={member.name} size={36} /> : <span className="builder-public-fallback" key={`${team.id}-${index}`} aria-label={member.name}>{member.name.slice(0, 2).toUpperCase()}</span>;
        })}</div>
        <div className="builder-public-actions"><button type="button" className="button button-outline button-small" aria-expanded={opened === team.id} onClick={() => toggleDetails(team)}>{opened === team.id ? "Ocultar set" : "Ver set"}</button>{team.sourceUrl && <a className="button button-quiet button-small" href={team.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}<button type="button" className="button button-quiet button-small" disabled={paste?.status === "loading"} onClick={() => importTeam(team)}>{paste?.status === "loading" ? "Carregando…" : "Importar equipe"}</button></div>
        {opened === team.id && <div className="builder-public-details">
          {paste?.status === "loading" && <p role="status">Carregando paste…</p>}
          {paste?.status === "error" && <p role="status">{paste.message}</p>}
          {paste?.status === "ready" && <>
            <ul className="builder-public-set-grid" aria-label={`Sets da equipe de ${team.player || "jogador"}`}>{paste.team.members.filter(Boolean).map((member) => {
              const entry = pokemonBySlug.get(member.pokemonId);
              const moves = member.moves.filter(Boolean);
              return <li className="builder-public-set-card" key={member.pokemonId}>
                <div className="builder-public-set-heading">
                  {entry ? <PokemonSprite pokemon={entry} name={entry.name} size={44} decorative /> : <span className="builder-public-fallback" aria-hidden="true">?</span>}
                  <div><strong>{entry?.name || member.pokemonId}</strong>{entry?.types?.length ? <span className="type-list">{entry.types.map((type) => <TypeTag key={type} type={type} />)}</span> : null}</div>
                </div>
                <div className="builder-public-set-columns">
                  <div className="builder-public-set-equipment">
                    {member.ability ? <div><small>Habilidade</small><strong>{member.ability}</strong></div> : null}
                    {member.item ? <div><small>Item</small><strong><ItemSprite name={member.item} size={24} />{member.item}</strong></div> : null}
                  </div>
                  <div className="builder-public-set-moves"><small>Golpes</small>{moves.length ? <ol>{moves.map((move, index) => <li key={`${index}-${move}`}>{move}</li>)}</ol> : <span>Não publicados</span>}</div>
                </div>
              </li>;
            })}</ul>
            {paste.warnings.length > 0 && <ul className="builder-public-warnings">{paste.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            {matchingMember && <button className="button button-primary button-small" type="button" onClick={() => applySet(team)}>Aplicar set de {selectedPokemon.name}</button>}
            {paste.sourceUrl && <a href={paste.sourceUrl} target="_blank" rel="noreferrer">Abrir Poképaste ↗</a>}
          </>}
        </div>}
      </li>;
    })}</ol>}
    <p className="builder-public-credit">Fonte: <a href="https://www.munchstats.com/teams/" target="_blank" rel="noreferrer">VGCPastes via MunchStats</a>.</p>
  </aside>;
}
