import { useEffect, useState } from "react";
import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { communityRequest } from "../data/communityApi.js";
import { createPokemonSpriteLookup } from "../data/pokemonSprites.js";

const findPokemon = createPokemonSpriteLookup(dexData.pokemon);

export function SharedTeamPreview({ roster, ownerName }) {
  if (!Array.isArray(roster) || !roster.some(Boolean)) return null;
  return (
    <section className="shared-team-preview" aria-label={`Pokémon compartilhados por ${ownerName}`}>
      <span className="shared-team-label">Time compartilhado</span>
      <ul className="shared-team-sprites" aria-label="Integrantes do time compartilhado">
        {roster.map((member, index) => {
          if (!member) return <li className="shared-team-empty" key={`empty-${index}`} aria-hidden="true" />;
          const pokemon = findPokemon(member.pokemonId || member.formSlug);
          const label = pokemon?.name || member.formSlug || "Pokémon";
          return <li key={`${member.formSlug}-${index}`}><PokemonSprite pokemon={pokemon} name={label} size={52} /></li>;
        })}
      </ul>
    </section>
  );
}

export function EventTeamSharing({ eventId, eventType, sharedRoster, onSaved }) {
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/${eventType === "tournament" ? "tournaments" : "rooms"}/${eventId}/shared-team`;

  useEffect(() => {
    let active = true;
    communityRequest("/teams").then(({ teams: savedTeams }) => {
      if (!active) return;
      setTeams(savedTeams.filter((team) => team.data?.members?.some(Boolean)));
      setStatus("ready");
    }).catch((caught) => {
      if (!active) return;
      setError(caught.message);
      setStatus("error");
    });
    return () => { active = false; };
  }, []);

  async function shareTeam(event) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      await communityRequest(path, { method: "PUT", body: { teamId: selectedId } });
      await onSaved();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true);
    setError("");
    try {
      await communityRequest(path, { method: "DELETE" });
      await onSaved();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="event-team-sharing" aria-labelledby="share-team-title">
      <div>
        <h3 id="share-team-title">Compartilhar Pokémon do time</h3>
        <p>Opcional. Só as espécies e formas ficam visíveis ao grupo deste evento; você pode parar quando quiser.</p>
      </div>
      {status === "loading" ? <p className="form-hint" role="status">Carregando equipes salvas…</p> : null}
      {status === "error" ? <p className="community-inline-error" role="alert">{error}</p> : null}
      {status === "ready" && teams.length === 0 ? <p className="form-hint">Salve uma equipe no <Link to="/builder">Construtor</Link> para compartilhar os Pokémon.</p> : null}
      {status === "ready" && teams.length > 0 ? (
        <form className="event-team-sharing-controls" onSubmit={shareTeam}>
          <label className="community-field" htmlFor={`shared-team-${eventId}`}>
            <span>Equipe salva</span>
            <select id={`shared-team-${eventId}`} className="text-input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Escolha uma equipe</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <button className="button button-outline button-small" type="submit" disabled={busy || !selectedId}>{sharedRoster ? "Trocar equipe" : "Compartilhar"}</button>
          {sharedRoster ? <button className="text-button" type="button" disabled={busy} onClick={stopSharing}>Parar de compartilhar</button> : null}
        </form>
      ) : null}
      {error && status !== "error" ? <p className="community-inline-error" role="alert">{error}</p> : null}
    </section>
  );
}
