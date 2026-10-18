import { useEffect, useState } from "react";
import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "./PokemonSprite.jsx";
import { communityRequest } from "../data/communityApi.js";

export function TeamAccountPanel({ onLoad, onSave }) {
  const [state, setState] = useState({ status: "loading" });
  const [visibility, setVisibility] = useState("private");
  const [savedVisibility, setSavedVisibility] = useState({});
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [session, teamList] = await Promise.all([
        communityRequest("/me"),
        communityRequest("/teams").catch((error) => {
          if (error.message.includes("Entre com GitHub")) return null;
          throw error;
        }),
      ]);
      setState(session.user
        ? { status: "ready", user: session.user, teams: teamList?.teams || [] }
        : { status: "signed-out" });
    } catch (error) {
      setState({ status: "error", error: error.message });
    }
  }

  useEffect(() => { refresh(); }, []);

  async function saveCopy() {
    setBusy(true);
    try {
      await onSave(visibility);
      await refresh();
    } catch (error) {
      setState((current) => ({ ...current, actionError: error.message }));
    } finally {
      setBusy(false);
    }
  }

  async function removeSaved(id) {
    setBusy(true);
    try {
      await communityRequest(`/teams/${id}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      setState((current) => ({ ...current, actionError: error.message }));
    } finally {
      setBusy(false);
    }
  }

  async function updateVisibility(saved) {
    setBusy(true);
    try {
      await communityRequest(`/teams/${saved.id}`, { method: "PATCH", body: { visibility: savedVisibility[saved.id] || saved.visibility } });
      await refresh();
    } catch (error) {
      setState((current) => ({ ...current, actionError: error.message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="team-account-panel panel-frame" aria-labelledby="team-account-title">
      <div className="section-heading">
        <h2 id="team-account-title">Equipes da conta</h2>
        <span>Opcional</span>
      </div>
      {state.status === "loading" ? <p role="status">Verificando sua sessão…</p> : null}
      {state.status === "error" ? <p className="community-inline-error" role="status">{state.error} O rascunho local continua disponível.</p> : null}
      {state.status === "signed-out" ? (
        <p className="community-muted">Entre em <Link to="/rooms">Salas</Link> para guardar uma cópia na conta. A equipe deste navegador continua local.</p>
      ) : null}
      {state.status === "ready" ? (
        <>
          <p className="community-muted">Conectado como <strong>{state.user.handle}</strong>. Salvar cria uma cópia; o rascunho local e os sets atuais não mudam.</p>
          <div className="team-account-actions">
            <label className="community-field">
              <span>Visibilidade desta cópia</span>
              <select className="text-input" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <option value="private">Privada</option>
                <option value="public">Pública</option>
              </select>
            </label>
            <button className="button button-primary button-small" type="button" disabled={busy} onClick={saveCopy}>Salvar cópia na conta</button>
          </div>
          {state.actionError ? <p className="community-inline-error" role="alert">{state.actionError}</p> : null}
          <div className="account-team-list" aria-label="Equipes salvas na conta">
            {state.teams.length ? state.teams.map((saved) => (
              <div className="account-team-row" key={saved.id}>
                <div className="account-team-summary"><strong>{saved.name}</strong><span>{saved.visibility === "public" ? "Pública" : "Privada"}</span></div>
                <div className="account-team-sprites" role="list" aria-label={`Integrantes de ${saved.name}`}>
                  {(saved.data?.members || []).slice(0, 6).map((member, index) => {
                    const pokemon = dexData.pokemon.find((entry) => entry.slug === member?.pokemonId);
                    return (
                      <span className="account-team-member" role="listitem" key={`${saved.id}-${index}`}>
                        {pokemon
                          ? <PokemonSprite pokemon={pokemon} name={pokemon.name} size={44} />
                          : <span className="account-team-empty" role="img" aria-label={`Posição ${index + 1} vazia`} />}
                      </span>
                    );
                  })}
                </div>
                <button className="button button-outline button-small" type="button" disabled={busy} onClick={() => onLoad(saved.data)}>Carregar</button>
                <label className="sr-only" htmlFor={`team-visibility-${saved.id}`}>Visibilidade de {saved.name}</label>
                <select className="text-input account-team-visibility" id={`team-visibility-${saved.id}`} value={savedVisibility[saved.id] || saved.visibility} onChange={(event) => setSavedVisibility((current) => ({ ...current, [saved.id]: event.target.value }))}>
                  <option value="private">Privada</option><option value="public">Pública</option>
                </select>
                <button className="button button-outline button-small" type="button" disabled={busy || (savedVisibility[saved.id] || saved.visibility) === saved.visibility} onClick={() => updateVisibility(saved)}>Atualizar</button>
                <button className="text-button" type="button" disabled={busy} onClick={() => removeSaved(saved.id)}>Excluir</button>
              </div>
            )) : <p className="community-muted">Nenhuma cópia na conta ainda.</p>}
          </div>
          <p className="form-hint">Sets públicos são visíveis a qualquer pessoa. A equipe não é validada como legal ou permitida no jogo.</p>
        </>
      ) : null}
    </section>
  );
}
