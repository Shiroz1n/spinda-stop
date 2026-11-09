import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { publicTeamlistToShowdownPaste } from "../data/publicVgcTeams.js";

const findPokemon = createPokemonSpriteLookup(dexData.pokemon);
const PAGE_LIMIT = 20;
const STANDINGS_PAGE_SIZE = 20;

function updateParams(searchParams, setSearchParams, changes, replace = false) {
  const next = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  setSearchParams(next, { replace });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}

function recordLabel(record) {
  if (!record || record.wins === null && record.losses === null && record.ties === null) return "Recorde não publicado";
  return `${record.wins ?? "—"}V · ${record.losses ?? "—"}D · ${record.ties ?? "—"}E`;
}

function TeamPreview({ teamlist, onImport }) {
  return <div className="vgc-team-preview">
    <ol className="vgc-team-preview-list">{teamlist.map((member, index) => {
      const pokemon = resolveCompetitivePokemonSprite(findPokemon, { id: member.speciesId, name: member.speciesName });
      return <li key={`${member.speciesId}-${index}`}>
        {pokemon ? <PokemonSprite pokemon={pokemon} name={member.speciesName} size={44} decorative /> : <span className="vgc-team-fallback" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
        <div><strong>{member.speciesName}</strong><span>{[member.item, member.ability, member.nature && `${member.nature} Nature`].filter(Boolean).join(" · ") || "Set parcial"}</span>
          {member.moves?.length ? <small>{member.moves.join(" · ")}</small> : <small>Golpes não publicados</small>}
          <small className="vgc-import-missing">Não publicados: {[!member.item && "item", !member.ability && "habilidade", !member.nature && "Nature", !member.moves?.length && "golpes", "Stat Points"].filter(Boolean).join(", ")}.</small>
        </div>
      </li>;
    })}</ol>
    <button className="button button-primary" type="button" onClick={onImport}>Importar esta equipe no Builder</button>
  </div>;
}

export function PublicVgcTournamentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const format = searchParams.get("format") || "M-C";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const eventId = searchParams.get("event") || "";
  const query = searchParams.get("q") || "";
  const teamPlayer = searchParams.get("team") || "";
  const standingPage = Math.max(1, Number(searchParams.get("standingPage")) || 1);
  const listKey = `${format}:${page}`;
  const eventKey = eventId ? `${eventId}:${format}` : "";
  const teamDetailsKey = eventId && teamPlayer ? `${eventKey}:${teamPlayer}` : "";
  const [list, setList] = useState({ key: "", status: "loading", tournaments: [] });
  const [event, setEvent] = useState({ key: "", status: "idle" });
  const standingsQuery = searchParams.get("playerQ") || "";
  const [teamDetails, setTeamDetails] = useState({ key: "", status: "idle", player: "" });
  const currentList = list.key === listKey ? list : { status: "loading", tournaments: [] };
  const currentEvent = !eventId ? { status: "idle" } : event.key === eventKey ? event : { status: "loading" };
  const selectedStanding = currentEvent.status === "ready" ? currentEvent.standings.find((entry) => entry.player === teamPlayer) : null;
  const hasPublishedTeamlist = selectedStanding?.teamlistAvailable === true;
  const currentTeamDetails = !teamDetailsKey ? { status: "idle", player: "" }
    : currentEvent.status === "ready" && !hasPublishedTeamlist
      ? { status: "error", player: teamPlayer, message: "Esta teamlist não foi publicada." }
      : teamDetails.key === teamDetailsKey ? teamDetails : { status: "loading", player: teamPlayer };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/vgc-tournaments?format=${encodeURIComponent(format)}&page=${page}&limit=${PAGE_LIMIT}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível carregar torneios.");
        return payload;
      })
      .then((payload) => setList({ key: listKey, status: "ready", ...payload }))
      .catch((error) => { if (!controller.signal.aborted) setList({ key: listKey, status: "error", tournaments: [], message: error.message }); });
    return () => controller.abort();
  }, [format, page, listKey]);

  useEffect(() => {
    if (!eventId) return undefined;
    const controller = new AbortController();
    fetch(`/api/public/vgc-tournaments/${encodeURIComponent(eventId)}/standings?format=${encodeURIComponent(format)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível abrir este evento.");
        return payload;
      })
      .then((payload) => setEvent({ key: eventKey, status: "ready", ...payload }))
      .catch((error) => { if (!controller.signal.aborted) setEvent({ key: eventKey, status: "error", message: error.message }); });
    return () => controller.abort();
  }, [eventId, format, eventKey]);

  useEffect(() => {
    if (!teamDetailsKey || currentEvent.status !== "ready" || !hasPublishedTeamlist) return undefined;
    const controller = new AbortController();
    fetch(`/api/public/vgc-tournaments/${encodeURIComponent(eventId)}/standings?format=${encodeURIComponent(format)}&player=${encodeURIComponent(teamPlayer)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Teamlist não disponível.");
        return payload;
      })
      .then((payload) => setTeamDetails({ key: teamDetailsKey, status: "ready", player: teamPlayer, teamlist: payload.teamlist }))
      .catch((error) => { if (!controller.signal.aborted) setTeamDetails({ key: teamDetailsKey, status: "error", player: teamPlayer, message: error.message }); });
    return () => controller.abort();
  }, [eventId, format, teamPlayer, teamDetailsKey, currentEvent.status, hasPublishedTeamlist]);

  const filteredStandings = useMemo(() => {
    if (currentEvent.status !== "ready") return [];
    const normalized = standingsQuery.trim().toLocaleLowerCase("pt-BR");
    return currentEvent.standings.filter((standing) => !normalized || standing.name.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [currentEvent, standingsQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredStandings.length / STANDINGS_PAGE_SIZE));
  const visibleStandings = filteredStandings.slice((standingPage - 1) * STANDINGS_PAGE_SIZE, standingPage * STANDINGS_PAGE_SIZE);

  function selectEvent(id) {
    updateParams(searchParams, setSearchParams, { event: id, team: null, standingPage: null, playerQ: null });
  }

  function importTeam(standing) {
    if (currentTeamDetails.status !== "ready" || currentTeamDetails.player !== standing.player || !currentTeamDetails.teamlist?.length) return;
    const paste = publicTeamlistToShowdownPaste(currentTeamDetails.teamlist, dexData.pokemon);
    if (!paste) {
      setTeamDetails({ key: teamDetailsKey, status: "error", player: standing.player, message: "A teamlist não corresponde a seis integrantes identificáveis no catálogo atual." });
      return;
    }
    navigate("/builder", { state: {
      publicTournamentPaste: paste,
      publicTournamentName: `${standing.name} · ${currentEvent.tournament.name}`,
      publicTournamentSource: currentEvent.tournament.url,
      publicTournamentImportKey: `${currentEvent.tournament.id}:${standing.player}:${Date.now()}`,
    } });
  }

  return <main className="page-wrap public-vgc-page">
    <header className="page-heading-row public-vgc-heading">
      <div><p className="page-label">Fonte pública · Limitless VGC</p><h1>Torneios e equipes</h1><p className="page-intro">Consulte eventos registrados no Limitless e abra as teamlists que cada jogador publicou.</p></div>
      <a className="button button-outline" href="https://docs.limitlesstcg.com/developer/tournaments" target="_blank" rel="noreferrer">Sobre a fonte ↗</a>
    </header>
    <section className="public-vgc-toolbar" aria-label="Filtros de torneios">
      <label>Regulamento<select value={format} onChange={(change) => updateParams(searchParams, setSearchParams, { format: change.target.value, page: 1, event: null, team: null, standingPage: null })}><option value="M-C">M-C</option><option value="M-B">M-B</option><option value="M-A">M-A</option></select></label>
      <label>Buscar nesta página<input type="search" value={query} onChange={(change) => updateParams(searchParams, setSearchParams, { q: change.target.value, event: null, team: null }, true)} placeholder="Nome do torneio" /></label>
      <span className="public-vgc-source-note">Datas em UTC · a fonte não informa status ao vivo.</span>
    </section>
    <div className="public-vgc-layout">
      <section className="public-vgc-results" aria-label={`Torneios ${format}`}>
        <div className="public-vgc-list-heading"><h2>Eventos VGC · {format}</h2><span>{currentList.status === "ready" ? `Página ${currentList.page}` : ""}</span></div>
        {currentList.status === "loading" ? <p className="community-loading" role="status">Carregando eventos…</p> : null}
        {currentList.status === "error" ? <p className="community-error" role="alert">{currentList.message}</p> : null}
        {currentList.status === "ready" && !currentList.tournaments.length ? <p className="community-empty">Nenhum evento nesta página. Volte uma página ou escolha outro regulamento.</p> : null}
        {currentList.status === "ready" && currentList.tournaments.length ? <ol className="public-vgc-event-list">{currentList.tournaments.filter((tournament) => !query || tournament.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))).map((tournament) => <li key={tournament.id}>
          <button type="button" aria-current={eventId === tournament.id ? "true" : undefined} onClick={() => selectEvent(tournament.id)}>
            <span className="public-vgc-event-date">{formatDate(tournament.date)}</span><strong>{tournament.name || "Evento VGC"}</strong><span>{tournament.players === null ? "Participantes não informados" : `${tournament.players} participantes`} · status não informado</span>
          </button>
        </li>)}</ol> : null}
        <nav className="public-vgc-pagination" aria-label="Paginação de torneios">
          <button className="button button-outline" type="button" disabled={page <= 1 || currentList.status === "loading"} onClick={() => updateParams(searchParams, setSearchParams, { page: page - 1, event: null, team: null })}>Anterior</button>
          <span>Página {page}</span>
          <button className="button button-outline" type="button" disabled={currentList.status !== "ready" || !currentList.hasNextPage} onClick={() => updateParams(searchParams, setSearchParams, { page: page + 1, event: null, team: null })}>Próxima</button>
        </nav>
      </section>
      <section className="public-vgc-detail">
        {!eventId ? <div className="public-vgc-empty"><p className="page-label">Detalhes do evento</p><h2>Escolha um torneio</h2><p>A lista e os filtros permanecem nesta página enquanto você consulta cada edição.</p></div> : null}
        {currentEvent.status === "loading" ? <p className="community-loading" role="status">Carregando resultados públicos…</p> : null}
        {currentEvent.status === "error" ? <p className="community-error" role="alert">{currentEvent.message}</p> : null}
        {currentEvent.status === "ready" ? <>
          <div className="public-vgc-detail-heading"><div><p className="page-label">Evento público · {currentEvent.tournament.format}</p><h2>{currentEvent.tournament.name || "Torneio VGC"}</h2><p>{formatDate(currentEvent.tournament.date)} · {currentEvent.tournament.players ?? "—"} participantes</p></div><a href={currentEvent.tournament.url} target="_blank" rel="noreferrer">Fonte ↗</a></div>
          <dl className="public-vgc-event-facts"><div><dt>Organizador</dt><dd>{currentEvent.tournament.organizer?.name || "Não informado"}</dd></div><div><dt>Plataforma</dt><dd>{currentEvent.tournament.platform || "Não informada"}</dd></div><div><dt>Formato</dt><dd>{currentEvent.tournament.phases?.map((phase) => [phase.type, phase.mode, phase.rounds ? `${phase.rounds} rodadas` : ""].filter(Boolean).join(" · ")).filter(Boolean).join(" / ") || "Não informado"}</dd></div><div><dt>Teamlists</dt><dd>{currentEvent.tournament.decklists ? "Publicadas quando disponíveis" : "Não publicadas"}</dd></div></dl>
          {!currentEvent.standings.length ? <p className="community-empty">Este evento não publicou resultados.</p> : <>
            <div className="public-vgc-standing-toolbar"><h3>Standings</h3><label>Buscar jogador<input type="search" value={standingsQuery} onChange={(change) => updateParams(searchParams, setSearchParams, { playerQ: change.target.value, standingPage: 1 }, true)} placeholder="Nome público" /></label></div>
            <ol className="public-vgc-standing-list">{visibleStandings.map((standing) => <li key={standing.player}>
              <span className="public-vgc-place">{standing.placing ? `#${standing.placing}` : "—"}</span><div className="public-vgc-player"><strong>{standing.name}</strong><span>{recordLabel(standing.record)}{standing.country ? ` · ${standing.country}` : ""}</span></div>
              {standing.teamlistAvailable ? <div className="public-vgc-team-actions"><button className="button button-outline button-small" type="button" onClick={() => updateParams(searchParams, setSearchParams, { team: teamPlayer === standing.player ? null : standing.player })}>{teamPlayer === standing.player ? "Fechar prévia" : "Ver equipe"}</button></div> : <span className="public-vgc-no-team">Teamlist não publicada</span>}
              {teamPlayer === standing.player && currentTeamDetails.player === standing.player && currentTeamDetails.status === "loading" ? <p className="vgc-team-loading" role="status">Carregando teamlist…</p> : null}
              {teamPlayer === standing.player && currentTeamDetails.player === standing.player && currentTeamDetails.status === "error" ? <p className="community-error" role="alert">{currentTeamDetails.message}</p> : null}
              {teamPlayer === standing.player && currentTeamDetails.player === standing.player && currentTeamDetails.status === "ready" ? <TeamPreview teamlist={currentTeamDetails.teamlist} onImport={() => importTeam(standing)} /> : null}
            </li>)}</ol>
            <nav className="public-vgc-pagination" aria-label="Paginação dos resultados"><button className="button button-outline" type="button" disabled={standingPage <= 1} onClick={() => updateParams(searchParams, setSearchParams, { standingPage: standingPage - 1 })}>Anterior</button><span>Página {Math.min(standingPage, pageCount)} de {pageCount}</span><button className="button button-outline" type="button" disabled={standingPage >= pageCount} onClick={() => updateParams(searchParams, setSearchParams, { standingPage: standingPage + 1 })}>Próxima</button></nav>
          </>}
          <small className="public-vgc-attribution">Dados públicos desta edição: <a href="https://docs.limitlesstcg.com/developer/tournaments" target="_blank" rel="noreferrer">API do Limitless</a>. O evento é hospedado no Limitless; isso não representa todo o circuito presencial.</small>
        </> : null}
      </section>
    </div>
    <p className="public-vgc-cache-note">Consulta atualizada {currentList.checkedAt ? formatDate(currentList.checkedAt) : "—"}. A importação leva somente campos publicados; o Builder avisa sobre os campos ausentes e pede confirmação antes de substituir um rascunho.</p>
  </main>;
}
