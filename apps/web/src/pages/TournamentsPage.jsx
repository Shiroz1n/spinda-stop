import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { EventTeamSharing, SharedTeamPreview } from "../components/EventTeamSharing.jsx";
import { communityRequest } from "../data/communityApi.js";

const TOURNAMENT_STATES = {
  open: "Inscrições abertas",
  locked: "Check-in concluído",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const MEMBER_STATES = { registered: "Inscrito", checked_in: "Check-in feito", left: "Saiu", removed: "Removido" };
const MATCH_STATES = {
  scheduled: "Aguardando resultado",
  awaiting_confirmation: "Aguardando confirmação",
  confirmed: "Resultado confirmado",
  disputed: "Em contestação",
  void: "Partida anulada",
};

function ErrorNotice({ children }) {
  return children ? <p className="community-error" role="alert">{children}</p> : null;
}

function TournamentSignIn({ oauthAvailable }) {
  return (
    <section className="community-auth-card panel-frame" aria-labelledby="tournament-signin-title">
      <span className="community-card-label">Conta opcional</span>
      <h2 id="tournament-signin-title">Entre para organizar ou aceitar um convite</h2>
      <p>Usamos seu identificador e nome público do GitHub. O Spinda Stop organiza os participantes; as partidas acontecem no jogo.</p>
      {oauthAvailable ? <a className="button button-primary" href="/api/auth/github">Entrar com GitHub</a> : <p className="community-config-note">O login do GitHub ainda não foi configurado neste ambiente.</p>}
    </section>
  );
}

export function TournamentsPage() {
  const [state, setState] = useState({ status: "loading" });
  const [name, setName] = useState("Doubles entre amigos");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function load() {
    setState({ status: "loading" });
    try {
      const [session, auth] = await Promise.all([communityRequest("/me"), communityRequest("/auth/status")]);
      if (!session.user) {
        setState({ status: "signed-out", oauthAvailable: auth.githubOAuthAvailable });
        return;
      }
      const pendingInvite = window.sessionStorage.getItem("spinda_pending_tournament_invite");
      if (pendingInvite) {
        const joined = await communityRequest("/tournaments/join", { method: "POST", body: { inviteToken: pendingInvite } });
        window.sessionStorage.removeItem("spinda_pending_tournament_invite");
        navigate(`/tournaments/${joined.tournamentId}`, { replace: true });
        return;
      }
      const result = await communityRequest("/tournaments");
      setState({ status: "ready", user: session.user, tournaments: result.tournaments });
      setError("");
    } catch (caught) {
      if (caught.status >= 400 && caught.status < 500) window.sessionStorage.removeItem("spinda_pending_tournament_invite");
      setState({ status: "error", error: caught.message });
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([communityRequest("/me"), communityRequest("/auth/status")])
      .then(async ([session, auth]) => {
        if (!session.user) {
          if (active) setState({ status: "signed-out", oauthAvailable: auth.githubOAuthAvailable });
          return;
        }
        const pendingInvite = window.sessionStorage.getItem("spinda_pending_tournament_invite");
        if (pendingInvite) {
          const joined = await communityRequest("/tournaments/join", { method: "POST", body: { inviteToken: pendingInvite } });
          window.sessionStorage.removeItem("spinda_pending_tournament_invite");
          if (active) navigate(`/tournaments/${joined.tournamentId}`, { replace: true });
          return;
        }
        const result = await communityRequest("/tournaments");
        if (active) setState({ status: "ready", user: session.user, tournaments: result.tournaments });
      })
      .catch((caught) => {
        if (caught.status >= 400 && caught.status < 500) window.sessionStorage.removeItem("spinda_pending_tournament_invite");
        if (active) setState({ status: "error", error: caught.message });
      });
    return () => { active = false; };
  }, [navigate]);

  async function createTournament(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await communityRequest("/tournaments", { method: "POST", body: { name } });
      navigate(`/tournaments/${result.tournament.id}`, { state: { inviteUrl: result.inviteUrl } });
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="page-wrap community-page">
      <div className="page-heading-row community-heading">
        <div><p className="page-label">Encontros da comunidade</p><h1>Torneios privados</h1><p className="page-intro">Um chaveamento simples de quatro pessoas. Combine as partidas no Pokémon Champions e registre os resultados aqui.</p></div>
        {state.status === "ready" ? <span className="community-account-chip">GitHub · {state.user.handle}</span> : null}
      </div>

      {state.status === "loading" ? <p className="community-loading" role="status">Carregando seus torneios…</p> : null}
      {state.status === "error" ? <section className="community-auth-card panel-frame"><h2>Não foi possível carregar</h2><ErrorNotice>{state.error}</ErrorNotice><button className="button button-outline" type="button" onClick={load}>Tentar de novo</button></section> : null}
      {state.status === "signed-out" ? <TournamentSignIn oauthAvailable={state.oauthAvailable} /> : null}
      {state.status === "ready" ? (
        <div className="community-dashboard">
          <section className="community-create-card panel-frame" aria-labelledby="create-tournament-title">
            <div className="section-heading"><h2 id="create-tournament-title">Criar um torneio</h2><span>4 participantes</span></div>
            <p className="community-muted">O convite é privado. Só quem entrar pelo link participa; a ordem das semifinais sai de um sorteio ao iniciar.</p>
            <form className="community-create-form" onSubmit={createTournament}>
              <label className="community-field"><span>Nome do torneio</span><input className="text-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={48} required /></label>
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Criando…" : "Criar torneio"}</button>
            </form>
            <ErrorNotice>{error}</ErrorNotice>
          </section>
          <section className="community-rooms-card panel-frame" aria-labelledby="my-tournaments-title">
            <div className="section-heading"><h2 id="my-tournaments-title">Seus torneios</h2><button className="text-button" type="button" onClick={load}>Atualizar</button></div>
            {state.tournaments.length ? <ul className="community-room-list">{state.tournaments.map((tournament) => <li key={tournament.id}><div><strong>{tournament.name}</strong><span>{TOURNAMENT_STATES[tournament.status]} · {tournament.participantCount}/4</span></div><Link className="button button-outline button-small" to={`/tournaments/${tournament.id}`}>Abrir</Link></li>)}</ul> : <p className="community-empty">Você ainda não entrou em um torneio.</p>}
          </section>
        </div>
      ) : null}
      <p className="community-privacy-note">Códigos de amizade são opcionais, compartilhados pela própria pessoa e visíveis apenas aos participantes. Eles são apagados no fim do torneio ou após sete dias.</p>
    </section>
  );
}

export function TournamentJoinPage() {
  const navigate = useNavigate();
  const [state, setState] = useState(() => window.location.hash ? { status: "loading" } : { status: "error", error: "O link não contém um convite. Peça ao host para gerar outro." });

  useEffect(() => {
    const inviteToken = window.location.hash.slice(1) || window.sessionStorage.getItem("spinda_pending_tournament_invite") || "";
    if (!inviteToken) return undefined;
    window.sessionStorage.setItem("spinda_pending_tournament_invite", inviteToken);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    let active = true;
    Promise.all([communityRequest("/me"), communityRequest("/auth/status")])
      .then(([session, auth]) => {
        if (!session.user) {
          if (active) setState({ status: "signed-out", oauthAvailable: auth.githubOAuthAvailable });
          return null;
        }
        return communityRequest("/tournaments/join", { method: "POST", body: { inviteToken } });
      })
      .then((result) => {
        if (!result) return;
        window.sessionStorage.removeItem("spinda_pending_tournament_invite");
        if (active) navigate(`/tournaments/${result.tournamentId}`, { replace: true });
      })
      .catch((caught) => {
        if (caught.status >= 400 && caught.status < 500) window.sessionStorage.removeItem("spinda_pending_tournament_invite");
        if (active) setState({ status: "error", error: caught.message });
      });
    return () => { active = false; };
  }, [navigate]);

  return (
    <section className="page-wrap narrow-page community-page">
      <p className="page-label">Convite privado</p><h1>Entrar no torneio</h1>
      {state.status === "loading" ? <p className="community-loading" role="status">Validando convite…</p> : null}
      {state.status === "signed-out" ? <><p className="community-muted">Entre com GitHub. O convite fica temporariamente nesta aba e será validado depois do login.</p><TournamentSignIn oauthAvailable={state.oauthAvailable} /></> : null}
      {state.status === "error" ? <ErrorNotice>{state.error}</ErrorNotice> : null}
      <Link className="button button-outline" to="/tournaments">Voltar aos torneios</Link>
    </section>
  );
}

export function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const location = useLocation();
  const [state, setState] = useState({ status: "loading" });
  const [user, setUser] = useState(null);
  const [friendCodesAvailable, setFriendCodesAvailable] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(() => location.state?.inviteUrl || "");
  const [friendCode, setFriendCode] = useState("");
  const [winnerByMatch, setWinnerByMatch] = useState({});
  const [reasonByMatch, setReasonByMatch] = useState({});
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [tournament, session, auth] = await Promise.all([communityRequest(`/tournaments/${tournamentId}`), communityRequest("/me"), communityRequest("/auth/status")]);
      setState({ status: "ready", data: tournament });
      setUser(session.user);
      setFriendCodesAvailable(auth.friendCodesAvailable);
    } catch (error) { setState({ status: "error", error: error.message }); }
  }

  useEffect(() => {
    let active = true;
    Promise.all([communityRequest(`/tournaments/${tournamentId}`), communityRequest("/me"), communityRequest("/auth/status")])
      .then(([tournament, session, auth]) => {
        if (!active) return;
        setState({ status: "ready", data: tournament });
        setUser(session.user);
        setFriendCodesAvailable(auth.friendCodesAvailable);
      })
      .catch((error) => { if (active) setState({ status: "error", error: error.message }); });
    return () => { active = false; };
  }, [tournamentId]);

  async function act(path, options = {}) {
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const result = await communityRequest(path, options);
      if (result.inviteUrl) setInviteUrl(result.inviteUrl);
      setMessage("Alteração salva.");
      await refresh();
      return result;
    } catch (error) { setActionError(error.message); return null; }
    finally { setBusy(false); }
  }

  async function copyInvite() {
    if (!inviteUrl) {
      await act(`/tournaments/${tournamentId}/invite`, { method: "POST", body: {} });
      return;
    }
    try { await navigator.clipboard.writeText(inviteUrl); setMessage("Convite copiado."); }
    catch { setMessage("Selecione e copie o link do convite manualmente."); }
  }

  if (state.status === "loading") return <section className="page-wrap community-page"><p className="community-loading" role="status">Carregando torneio…</p></section>;
  if (state.status === "error") return <section className="page-wrap narrow-page community-page"><p className="page-label">Acesso ao torneio</p><h1>Não foi possível abrir</h1><ErrorNotice>{state.error}</ErrorNotice><Link className="button button-outline" to="/tournaments">Voltar aos torneios</Link></section>;

  const { tournament, currentUser, participantCount, members, matches } = state.data;
  const isHost = currentUser.role === "host";
  const terminal = ["completed", "cancelled"].includes(tournament.status);
  const allCheckedIn = members.length === 4 && members.every((member) => member.status === "checked_in");
  const ownFriendCode = members.find((member) => member.id === currentUser.id)?.friendCode;
  const nextStep = terminal
    ? tournament.status === "completed" ? "Chaveamento e resultados confirmados ficam disponíveis para consulta." : "Este torneio foi cancelado."
    : tournament.status === "open" && isHost
      ? allCheckedIn ? "Todos fizeram check-in. Feche as inscrições para preparar o chaveamento." : "Convide as outras pessoas e aguarde o check-in antes de fechar as inscrições."
      : tournament.status === "open"
        ? currentUser.memberStatus === "registered" ? "Confirme presença com check-in." : "Aguarde o host completar as inscrições."
        : tournament.status === "locked" && isHost
          ? "As inscrições estão fechadas. Sorteie e inicie o chaveamento quando estiverem prontos."
          : tournament.status === "locked"
            ? "Aguarde o host iniciar o chaveamento."
            : matches.some((match) => match.status === "awaiting_confirmation")
              ? "Há um resultado aguardando confirmação do adversário."
              : "Consulte a chave e registre o resultado após cada partida.";

  return (
    <section className="page-wrap community-page">
      <div className="community-room-heading">
        <div><p className="page-label">{isHost ? "Torneio do host" : "Torneio por convite"}</p><h1>{tournament.name}</h1><p className="page-intro">{TOURNAMENT_STATES[tournament.status]} · {participantCount}/4 participantes{tournament.championId ? ` · campeão: ${members.find((member) => member.id === tournament.championId)?.handle || "participante"}` : ""}</p></div>
        <Link className="button button-outline" to="/tournaments">Meus torneios</Link>
      </div>
      <div className="community-next-step" aria-label="Próxima ação">
        <strong>{TOURNAMENT_STATES[tournament.status]}</strong><span>{nextStep}</span><a href={tournament.status === "in_progress" ? "#bracket-title" : "#tournament-members-title"}>Abrir etapa <span aria-hidden="true">↓</span></a>
      </div>
      <ErrorNotice>{actionError}</ErrorNotice>
      {message ? <p className="community-success" role="status">{message}</p> : null}

      <div className="community-room-grid tournament-detail-grid">
        <section className="community-room-panel panel-frame" aria-labelledby="tournament-members-title">
          <div className="section-heading"><h2 id="tournament-members-title">Participantes</h2><span>{participantCount}/4</span></div>
          <ul className="participant-list">{members.map((member) => <li key={member.id}><div className="participant-card-main"><div><strong>{member.handle}{member.id === tournament.hostId ? " · host" : ""}{member.seed ? ` · seed ${member.seed}` : ""}</strong><span>{MEMBER_STATES[member.status] || member.status}{member.friendCode ? <span className="friend-code-value"> · Código: {member.friendCode}</span> : ""}</span></div><SharedTeamPreview roster={member.sharedRoster} ownerName={member.handle} /></div></li>)}</ul>
          {!terminal ? <EventTeamSharing eventId={tournamentId} eventType="tournament" sharedRoster={members.find((member) => member.id === currentUser.id)?.sharedRoster} onSaved={refresh} /> : null}
          {currentUser.memberStatus === "registered" && tournament.status === "open" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => act(`/tournaments/${tournamentId}/check-in`, { method: "POST", body: {} })}>Fazer check-in</button> : null}
          {isHost && tournament.status === "open" ? <button className="button button-outline" type="button" disabled={busy || !allCheckedIn} onClick={() => act(`/tournaments/${tournamentId}/close`, { method: "POST", body: {} })}>Fechar inscrições</button> : null}
          {isHost && tournament.status === "locked" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => act(`/tournaments/${tournamentId}/start`, { method: "POST", body: {} })}>Sortear e iniciar</button> : null}
          {!isHost && tournament.status === "open" ? <button className="text-button community-cancel" type="button" disabled={busy} onClick={() => act(`/tournaments/${tournamentId}/leave`, { method: "POST", body: {} })}>Sair do torneio</button> : null}
          {isHost && ["open", "locked"].includes(tournament.status) ? <button className="text-button community-cancel" type="button" disabled={busy} onClick={() => { if (window.confirm("Cancelar este torneio?")) act(`/tournaments/${tournamentId}/cancel`, { method: "POST", body: {} }); }}>Cancelar torneio</button> : null}
          {!terminal && friendCodesAvailable ? <form className="friend-code-form" onSubmit={(event) => { event.preventDefault(); act(`/tournaments/${tournamentId}/friend-code`, { method: "PUT", body: { code: friendCode } }).then((result) => { if (result) setFriendCode(""); }); }}><label className="community-field"><span>Seu código de amizade (opcional)</span><input className="text-input" maxLength={40} value={friendCode} onChange={(event) => setFriendCode(event.target.value)} autoComplete="off" /></label><button className="button button-outline button-small" type="submit" disabled={busy || !friendCode}>Compartilhar com participantes</button><small>Visível apenas ao grupo e removido ao terminar ou após sete dias.</small></form> : null}
          {!terminal && ownFriendCode ? <button className="button button-quiet button-small" type="button" disabled={busy} onClick={() => act(`/tournaments/${tournamentId}/friend-code`, { method: "DELETE" })}>Remover meu código</button> : null}
          {!terminal && !friendCodesAvailable ? <p className="community-empty">Compartilhamento de código temporariamente indisponível neste servidor.</p> : null}
        </section>

        <section className="community-room-panel panel-frame" aria-labelledby="bracket-title">
          <div className="section-heading"><h2 id="bracket-title">Chaveamento</h2><span>Eliminação simples</span></div>
          {!matches.length ? <p className="community-empty">A chave aparece quando o host sortear e iniciar o torneio.</p> : <div className="tournament-bracket">{[1, 2].map((round) => {
            const roundMatches = matches.filter((match) => match.roundNumber === round);
            if (!roundMatches.length) return null;
            return <section className="tournament-round" key={round} aria-labelledby={`tournament-round-${round}`}><h3 id={`tournament-round-${round}`}>{round === 1 ? "Semifinais" : "Final"}</h3>{roundMatches.map((match) => <TournamentMatch key={match.id} match={match} tournament={tournament} currentUser={currentUser} user={user} busy={busy} winner={winnerByMatch[match.id] || ""} reason={reasonByMatch[match.id] || ""} onWinner={(value) => setWinnerByMatch((previous) => ({ ...previous, [match.id]: value }))} onReason={(value) => setReasonByMatch((previous) => ({ ...previous, [match.id]: value }))} onAct={act} />)}</section>;
          })}</div>}
        </section>
      </div>
      {tournament.status === "open" && isHost ? <section className="community-room-panel community-invite-panel panel-frame tournament-invite-panel"><div className="section-heading"><h2>Convite</h2><span>Expira em 7 dias</span></div><p className="community-muted">Compartilhe o link com as outras três pessoas. O token fica no fragmento da URL e é removido ao entrar.</p>{inviteUrl ? <div className="invite-copy-row"><input className="text-input" aria-label="Link de convite" readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /><button className="button button-primary button-small" type="button" onClick={copyInvite}>Copiar link</button></div> : <button className="button button-outline button-small" type="button" onClick={copyInvite}>Gerar convite</button>}</section> : null}
      <details className="community-game-context"><summary>Partidas no Pokémon Champions</summary><p>Participantes informam os resultados e o adversário confirma ou contesta cada relato.</p></details>
      <p className="community-privacy-note">A organização registra relatos voluntários; não verifica partidas dentro do jogo. Se a moderação anular uma partida em torneio, o evento é cancelado nesta primeira versão, sem replay automático.</p>
    </section>
  );
}

function TournamentMatch({ match, tournament, currentUser, user, busy, winner, reason, onWinner, onReason, onAct }) {
  const isPlayer = match.playerA.id === currentUser.id || match.playerB.id === currentUser.id;
  const awaitingOpponent = isPlayer && match.status === "awaiting_confirmation" && match.report?.reporterId !== currentUser.id;
  const disputed = match.status === "disputed";
  const canReport = isPlayer && match.status === "scheduled" && tournament.status === "in_progress";
  const matchPath = `/matches/${match.id}`;
  return (
    <article className="tournament-match-card">
      <p className="tournament-match-players"><span>{match.playerA.handle}</span><b aria-hidden="true">×</b><span>{match.playerB.handle}</span></p>
      <strong className={`tournament-match-status status-${match.status}`}>{MATCH_STATES[match.status] || match.status}</strong>
      {match.report ? <p className="community-muted">Vencedor informado: <b>{match.report.winnerHandle}</b>{match.report.note ? ` · ${match.report.note}` : ""}</p> : null}
      {match.status === "scheduled" && tournament.status === "in_progress" && !isPlayer ? <p className="community-muted">O resultado é registrado pelas duas pessoas desta partida.</p> : null}
      {match.status === "awaiting_confirmation" && !awaitingOpponent ? <p className="community-muted">Aguardando confirmação da outra pessoa da partida.</p> : null}
      {canReport ? <form className="community-match-form" onSubmit={(event) => { event.preventDefault(); onAct(`${matchPath}/report`, { method: "POST", body: { winnerId: winner } }); }}><label className="community-field"><span>Vencedor informado</span><select className="text-input" value={winner} onChange={(event) => onWinner(event.target.value)} required><option value="">Selecione</option><option value={match.playerA.id}>{match.playerA.handle}</option><option value={match.playerB.id}>{match.playerB.handle}</option></select></label><button className="button button-primary button-small" type="submit" disabled={busy || !winner}>Registrar resultado</button></form> : null}
      {awaitingOpponent ? <div className="community-match-actions"><button className="button button-primary button-small" type="button" disabled={busy} onClick={() => onAct(`${matchPath}/confirm`, { method: "POST", body: {} })}>Confirmar resultado</button><form onSubmit={(event) => { event.preventDefault(); onAct(`${matchPath}/dispute`, { method: "POST", body: { reason } }); }}><label className="community-field"><span>Motivo da contestação</span><textarea className="text-input" rows="2" maxLength={500} value={reason} onChange={(event) => onReason(event.target.value)} required /></label><button className="button button-outline button-small" type="submit" disabled={busy || !reason.trim()}>Contestar</button></form></div> : null}
      {disputed ? <p className="community-dispute-note">Contestação: {match.dispute?.reason}. A moderação decide se confirma ou anula este relato.</p> : null}
      {disputed && user?.isModerator ? <TournamentModeratorResolution busy={busy} onResolve={(decision, resolution) => onAct(`/moderation/disputes/${match.dispute.id}/resolve`, { method: "POST", body: { decision, resolution } })} /> : null}
    </article>
  );
}

function TournamentModeratorResolution({ busy, onResolve }) {
  const [decision, setDecision] = useState("confirm");
  const [resolution, setResolution] = useState("");
  return <form className="moderator-resolution" onSubmit={(event) => { event.preventDefault(); onResolve(decision, resolution); }}><strong>Ação da moderação</strong><label className="community-field"><span>Decisão e motivo</span><select className="text-input" value={decision} onChange={(event) => setDecision(event.target.value)}><option value="confirm">Confirmar o relato</option><option value="void">Anular e cancelar o torneio</option></select><textarea className="text-input" rows="2" maxLength={500} value={resolution} onChange={(event) => setResolution(event.target.value)} required /></label><button className="button button-primary button-small" type="submit" disabled={busy || !resolution.trim()}>Registrar decisão</button><p className="form-hint">A ação e a justificativa ficam no histórico de moderação.</p></form>;
}
