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
  const [list, setList] = useState({ status: "loading", tournaments: [] });
  const [event, setEvent] = useState({ status: "idle" });
  const standingsQuery = searchParams.get("playerQ") || "";
  const [teamDetails, setTeamDetails] = useState({ status: "idle", player: "" });

  useEffect(() => {
    const controller = new AbortController();
    setList({ status: "loading", tournaments: [] });
    fetch(`/api/public/vgc-tournaments?format=${encodeURIComponent(format)}&page=${page}&limit=${PAGE_LIMIT}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível carregar torneios.");
        return payload;
      })
      .then((payload) => setList({ status: "ready", ...payload }))
      .catch((error) => { if (!controller.signal.aborted) setList({ status: "error", tournaments: [], message: error.message }); });
    return () => controller.abort();
  }, [format, page]);

  useEffect(() => {
    if (!eventId) { setEvent({ status: "idle" }); return undefined; }
    const controller = new AbortController();
    setEvent({ status: "loading" });
    fetch(`/api/public/vgc-tournaments/${encodeURIComponent(eventId)}/standings?format=${encodeURIComponent(format)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível abrir este evento.");
        return payload;
      })
      .then((payload) => setEvent({ status: "ready", ...payload }))
      .catch((error) => { if (!controller.signal.aborted) setEvent({ status: "error", message: error.message }); });
    return () => controller.abort();
  }, [eventId, format]);

  useEffect(() => {
    if (!eventId || !teamPlayer || event.status !== "ready") { setTeamDetails({ status: "idle", player: "" }); return undefined; }
    const standing = event.standings.find((entry) => entry.player === teamPlayer);
    if (!standing?.teamlistAvailable) { setTeamDetails({ status: "error", player: teamPlayer, message: "Esta teamlist não foi publicada." }); return undefined; }
    const controller = new AbortController();
    setTeamDetails({ status: "loading", player: teamPlayer });
    fetch(`/api/public/vgc-tournaments/${encodeURIComponent(eventId)}/standings?format=${encodeURIComponent(format)}&player=${encodeURIComponent(teamPlayer)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Teamlist não disponível.");
        return payload;
      })
      .then((payload) => setTeamDetails({ status: "ready", player: teamPlayer, teamlist: payload.teamlist }))
      .catch((error) => { if (!controller.signal.aborted) setTeamDetails({ status: "error", player: teamPlayer, message: error.message }); });
    return () => controller.abort();
  }, [eventId, format, teamPlayer, event.status]);

  const filteredStandings = useMemo(() => {
    if (event.status !== "ready") return [];
    const normalized = standingsQuery.trim().toLocaleLowerCase("pt-BR");
    return event.standings.filter((standing) => !normalized || standing.name.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [event, standingsQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredStandings.length / STANDINGS_PAGE_SIZE));
  const visibleStandings = filteredStandings.slice((standingPage - 1) * STANDINGS_PAGE_SIZE, standingPage * STANDINGS_PAGE_SIZE);

  function selectEvent(id) {
    updateParams(searchParams, setSearchParams, { event: id, team: null, standingPage: null, playerQ: null });
  }

  function importTeam(standing) {
    if (teamDetails.status !== "ready" || teamDetails.player !== standing.player || !teamDetails.teamlist?.length) return;
    const paste = publicTeamlistToShowdownPaste(teamDetails.teamlist, dexData.pokemon);
    if (!paste) {
      setTeamDetails({ status: "error", player: standing.player, message: "A teamlist não corresponde a seis integrantes identificáveis no catálogo atual." });
      return;
    }
    navigate("/builder", { state: {
      publicTournamentPaste: paste,
      publicTournamentName: `${standing.name} · ${event.tournament.name}`,
      publicTournamentSource: event.tournament.url,
      publicTournamentImportKey: `${event.tournament.id}:${standing.player}:${Date.now()}`,
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
        <div className="public-vgc-list-heading"><h2>Eventos VGC · {format}</h2><span>{list.status === "ready" ? `Página ${list.page}` : ""}</span></div>
        {list.status === "loading" ? <p className="community-loading" role="status">Carregando eventos…</p> : null}
        {list.status === "error" ? <p className="community-error" role="alert">{list.message}</p> : null}
        {list.status === "ready" && !list.tournaments.length ? <p className="community-empty">Nenhum evento nesta página. Volte uma página ou escolha outro regulamento.</p> : null}
        {list.status === "ready" && list.tournaments.length ? <ol className="public-vgc-event-list">{list.tournaments.filter((tournament) => !query || tournament.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))).map((tournament) => <li key={tournament.id}>
          <button type="button" aria-current={eventId === tournament.id ? "true" : undefined} onClick={() => selectEvent(tournament.id)}>
            <span className="public-vgc-event-date">{formatDate(tournament.date)}</span><strong>{tournament.name || "Evento VGC"}</strong><span>{tournament.players === null ? "Participantes não informados" : `${tournament.players} participantes`} · status não informado</span>
          </button>
        </li>)}</ol> : null}
        <nav className="public-vgc-pagination" aria-label="Paginação de torneios">
          <button className="button button-outline" type="button" disabled={page <= 1 || list.status === "loading"} onClick={() => updateParams(searchParams, setSearchParams, { page: page - 1, event: null, team: null })}>Anterior</button>
          <span>Página {page}</span>
          <button className="button button-outline" type="button" disabled={list.status !== "ready" || !list.hasNextPage} onClick={() => updateParams(searchParams, setSearchParams, { page: page + 1, event: null, team: null })}>Próxima</button>
        </nav>
      </section>
      <section className="public-vgc-detail">
        {!eventId ? <div className="public-vgc-empty"><p className="page-label">Detalhes do evento</p><h2>Escolha um torneio</h2><p>A lista e os filtros permanecem nesta página enquanto você consulta cada edição.</p></div> : null}
        {event.status === "loading" ? <p className="community-loading" role="status">Carregando resultados públicos…</p> : null}
        {event.status === "error" ? <p className="community-error" role="alert">{event.message}</p> : null}
        {event.status === "ready" ? <>
          <div className="public-vgc-detail-heading"><div><p className="page-label">Evento público · {event.tournament.format}</p><h2>{event.tournament.name || "Torneio VGC"}</h2><p>{formatDate(event.tournament.date)} · {event.tournament.players ?? "—"} participantes</p></div><a href={event.tournament.url} target="_blank" rel="noreferrer">Fonte ↗</a></div>
          <dl className="public-vgc-event-facts"><div><dt>Organizador</dt><dd>{event.tournament.organizer?.name || "Não informado"}</dd></div><div><dt>Plataforma</dt><dd>{event.tournament.platform || "Não informada"}</dd></div><div><dt>Formato</dt><dd>{event.tournament.phases?.map((phase) => [phase.type, phase.mode, phase.rounds ? `${phase.rounds} rodadas` : ""].filter(Boolean).join(" · ")).filter(Boolean).join(" / ") || "Não informado"}</dd></div><div><dt>Teamlists</dt><dd>{event.tournament.decklists ? "Publicadas quando disponíveis" : "Não publicadas"}</dd></div></dl>
          {!event.standings.length ? <p className="community-empty">Este evento não publicou resultados.</p> : <>
            <div className="public-vgc-standing-toolbar"><h3>Standings</h3><label>Buscar jogador<input type="search" value={standingsQuery} onChange={(change) => updateParams(searchParams, setSearchParams, { playerQ: change.target.value, standingPage: 1 }, true)} placeholder="Nome público" /></label></div>
            <ol className="public-vgc-standing-list">{visibleStandings.map((standing) => <li key={standing.player}>
              <span className="public-vgc-place">{standing.placing ? `#${standing.placing}` : "—"}</span><div className="public-vgc-player"><strong>{standing.name}</strong><span>{recordLabel(standing.record)}{standing.country ? ` · ${standing.country}` : ""}</span></div>
              {standing.teamlistAvailable ? <div className="public-vgc-team-actions"><button className="button button-outline button-small" type="button" onClick={() => updateParams(searchParams, setSearchParams, { team: teamPlayer === standing.player ? null : standing.player })}>{teamPlayer === standing.player ? "Fechar prévia" : "Ver equipe"}</button></div> : <span className="public-vgc-no-team">Teamlist não publicada</span>}
              {teamPlayer === standing.player && teamDetails.player === standing.player && teamDetails.status === "loading" ? <p className="vgc-team-loading" role="status">Carregando teamlist…</p> : null}
              {teamPlayer === standing.player && teamDetails.player === standing.player && teamDetails.status === "error" ? <p className="community-error" role="alert">{teamDetails.message}</p> : null}
              {teamPlayer === standing.player && teamDetails.player === standing.player && teamDetails.status === "ready" ? <TeamPreview teamlist={teamDetails.teamlist} onImport={() => importTeam(standing)} /> : null}
            </li>)}</ol>
            <nav className="public-vgc-pagination" aria-label="Paginação dos resultados"><button className="button button-outline" type="button" disabled={standingPage <= 1} onClick={() => updateParams(searchParams, setSearchParams, { standingPage: standingPage - 1 })}>Anterior</button><span>Página {Math.min(standingPage, pageCount)} de {pageCount}</span><button className="button button-outline" type="button" disabled={standingPage >= pageCount} onClick={() => updateParams(searchParams, setSearchParams, { standingPage: standingPage + 1 })}>Próxima</button></nav>
          </>}
          <small className="public-vgc-attribution">Dados públicos desta edição: <a href="https://docs.limitlesstcg.com/developer/tournaments" target="_blank" rel="noreferrer">API do Limitless</a>. O evento é hospedado no Limitless; isso não representa todo o circuito presencial.</small>
        </> : null}
      </section>
    </div>
    <p className="public-vgc-cache-note">Consulta atualizada {list.checkedAt ? formatDate(list.checkedAt) : "—"}. A importação leva somente campos publicados; o Builder avisa sobre os campos ausentes e pede confirmação antes de substituir um rascunho.</p>
  </main>;
}
