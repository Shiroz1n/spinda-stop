import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { communityRequest } from "../data/communityApi.js";

const ROOM_STATES = {
  open: "Inscrições abertas",
  locked: "Check-in",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function ErrorNotice({ children }) {
  return children ? <p className="community-error" role="alert">{children}</p> : null;
}

export function RoomsPage() {
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState(null);
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("Sala privada");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function refresh() {
    try {
      const [auth, session] = await Promise.all([communityRequest("/auth/status"), communityRequest("/me")]);
      setAuthStatus(auth);
      setUser(session.user);
      const pendingInvite = session.user ? window.sessionStorage.getItem("spinda_pending_invite") : null;
      if (pendingInvite) {
        const { roomId } = await communityRequest("/rooms/join", { method: "POST", body: { inviteToken: pendingInvite } });
        window.sessionStorage.removeItem("spinda_pending_invite");
        navigate(`/rooms/${roomId}`, { replace: true });
        return;
      }
      const roomList = session.user ? await communityRequest("/rooms") : { rooms: [] };
      setRooms(roomList.rooms);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([communityRequest("/auth/status"), communityRequest("/me")])
      .then(async ([auth, session]) => {
        const roomList = session.user ? await communityRequest("/rooms") : { rooms: [] };
        if (!active) return;
        setAuthStatus(auth);
        setUser(session.user);
        setRooms(roomList.rooms);
        setLoading(false);
        const pendingInvite = session.user ? window.sessionStorage.getItem("spinda_pending_invite") : null;
        if (pendingInvite) {
          communityRequest("/rooms/join", { method: "POST", body: { inviteToken: pendingInvite } })
            .then(({ roomId }) => {
              window.sessionStorage.removeItem("spinda_pending_invite");
              if (active) navigate(`/rooms/${roomId}`, { replace: true });
            })
            .catch((caught) => {
              if (["invalid_invite", "invite_not_found"].includes(caught.code)) window.sessionStorage.removeItem("spinda_pending_invite");
              if (active) setError(caught.message);
            });
        }
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [navigate]);

  async function createRoom(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await communityRequest("/rooms", { method: "POST", body: { name } });
      navigate(`/rooms/${result.room.id}`, { state: { inviteUrl: result.inviteUrl } });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await communityRequest("/auth/logout", { method: "POST", body: {} });
      setUser(null);
      setRooms([]);
      setAuthStatus({ githubOAuthAvailable: Boolean(authStatus?.githubOAuthAvailable) });
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="page-wrap community-page">
      <div className="page-heading-row community-heading">
        <div><p className="page-label">Organização da comunidade</p><h1>Salas privadas</h1><p className="page-intro">Combine uma partida no Pokémon Champions e registre o resultado aqui. O site não se conecta ao jogo.</p></div>
        {user ? <div className="community-account-actions"><span className="community-account-chip">GitHub · {user.handle}</span><button className="text-button" type="button" disabled={busy} onClick={signOut}>Sair</button></div> : null}
      </div>

      {!user && !loading ? (
        <section className="community-auth-card panel-frame" aria-labelledby="community-auth-title">
          <span className="community-card-label">Conta opcional</span>
          <h2 id="community-auth-title">Entre para criar ou aceitar um convite</h2>
          <p>Usamos o identificador e o nome público do GitHub. Não pedimos e-mail, senha do jogo nem dados da Nintendo.</p>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          {authStatus?.githubOAuthAvailable ? <a className="button button-primary" href="/api/auth/github">Entrar com GitHub</a> : authStatus ? <p className="community-config-note">O login ainda não foi configurado neste ambiente. Quem mantém o projeto precisa informar as credenciais OAuth do GitHub no servidor.</p> : null}
          {authStatus === null && error ? <p className="community-config-note">Não foi possível consultar a configuração do login. Tente verificar o serviço novamente.</p> : null}
          <button className="text-button" type="button" onClick={refresh}>Verificar de novo</button>
        </section>
      ) : null}

      {loading ? <p className="community-loading" role="status">Carregando suas salas…</p> : null}
      {user ? (
        <div className="community-dashboard">
          <section className="community-create-card panel-frame" aria-labelledby="create-room-title">
            <div className="section-heading"><h2 id="create-room-title">Criar uma sala pequena</h2><span>2 pessoas</span></div>
            <p className="community-muted">A sala começa privada. Você recebe um convite que pode compartilhar com uma pessoa.</p>
            <form className="community-create-form" onSubmit={createRoom}>
              <label className="community-field"><span>Nome da sala</span><input className="text-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={48} required /></label>
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Criando…" : "Criar sala privada"}</button>
            </form>
            <ErrorNotice>{error}</ErrorNotice>
          </section>
          <section className="community-rooms-card panel-frame" aria-labelledby="my-rooms-title">
            <div className="section-heading"><h2 id="my-rooms-title">Suas salas</h2><button className="text-button" type="button" onClick={refresh}>Atualizar</button></div>
            {rooms.length ? <ul className="community-room-list">{rooms.map((room) => <li key={room.id}><div><strong>{room.name}</strong><span>{ROOM_STATES[room.status] || room.status}</span></div><Link className="button button-outline button-small" to={`/rooms/${room.id}`}>Abrir</Link></li>)}</ul> : <p className="community-empty">Você ainda não entrou em uma sala. Crie uma acima ou abra um convite.</p>}
          </section>
          {user.isModerator ? <ModeratorQueue onResolved={refresh} /> : null}
        </div>
      ) : null}
      <p className="community-privacy-note">Códigos de amizade são opcionais e visíveis apenas aos membros da sala. As partidas acontecem no jogo; participantes informam e confirmam o resultado.</p>
    </section>
  );
}

function ModeratorQueue({ onResolved }) {
  const [disputes, setDisputes] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    try { setDisputes((await communityRequest("/moderation/disputes")).disputes); setError(""); }
    catch (caught) { setError(caught.message); }
  }

  useEffect(() => {
    let active = true;
    communityRequest("/moderation/disputes")
      .then((result) => { if (active) setDisputes(result.disputes); })
      .catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);

  async function resolve(dispute, decision) {
    const reason = window.prompt("Registre o motivo da decisão (até 500 caracteres):")?.trim();
    if (!reason) return;
    setBusyId(dispute.id);
    try {
      await communityRequest(`/moderation/disputes/${dispute.id}/resolve`, { method: "POST", body: { decision, resolution: reason } });
      await load();
      onResolved();
    } catch (caught) { setError(caught.message); }
    finally { setBusyId(""); }
  }

  return (
    <section className="community-rooms-card panel-frame" aria-labelledby="moderation-title">
      <div className="section-heading"><h2 id="moderation-title">Contestações para revisar</h2><button className="text-button" type="button" onClick={load}>Atualizar</button></div>
      <ErrorNotice>{error}</ErrorNotice>
      {disputes.length ? <ul className="community-room-list">{disputes.map((dispute) => <li key={dispute.id}><div><strong>{dispute.roomName}</strong><span>{dispute.reason}</span></div><div className="community-row-actions"><button className="button button-primary button-small" disabled={busyId === dispute.id} onClick={() => resolve(dispute, "confirm")}>Confirmar relato</button><button className="button button-outline button-small" disabled={busyId === dispute.id} onClick={() => resolve(dispute, "void")}>Anular</button></div></li>)}</ul> : <p className="community-empty">Nenhuma contestação pendente.</p>}
    </section>
  );
}

export function RoomJoinPage() {
  const navigate = useNavigate();
  const [state, setState] = useState(() => window.location.hash
    ? { status: "loading" }
    : { status: "error", error: "O link não contém um convite. Peça ao host para gerar outro." });

  useEffect(() => {
    const inviteToken = window.location.hash.slice(1) || window.sessionStorage.getItem("spinda_pending_invite") || "";
    if (!inviteToken) return undefined;
    window.sessionStorage.setItem("spinda_pending_invite", inviteToken);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    let active = true;
    Promise.all([communityRequest("/me"), communityRequest("/auth/status")])
      .then(([session, auth]) => {
        if (!session.user) {
          if (active) setState({ status: "signed-out", oauthAvailable: auth.githubOAuthAvailable });
          return null;
        }
        return communityRequest("/rooms/join", { method: "POST", body: { inviteToken } });
      })
      .then((result) => {
        if (!result) return;
        window.sessionStorage.removeItem("spinda_pending_invite");
        if (active) navigate(`/rooms/${result.roomId}`, { replace: true });
      })
      .catch((caught) => {
        if (["invalid_invite", "invite_not_found"].includes(caught.code)) window.sessionStorage.removeItem("spinda_pending_invite");
        if (active) setState({ status: "error", error: caught.message });
      });
    return () => { active = false; };
  }, [navigate]);

  return <section className="page-wrap narrow-page community-page"><p className="page-label">Convite privado</p><h1>Entrar na sala</h1>{state.status === "loading" ? <p role="status">Validando convite…</p> : null}{state.status === "signed-out" ? <><p className="community-muted">Entre com GitHub. O convite fica no armazenamento temporário desta aba e será validado depois do login.</p>{state.oauthAvailable ? <a className="button button-primary" href="/api/auth/github">Entrar com GitHub</a> : <p className="community-config-note">O login do GitHub ainda não foi configurado neste ambiente.</p>}</> : null}{state.status === "error" ? <ErrorNotice>{state.error}</ErrorNotice> : null}<Link className="button button-outline" to="/rooms">Voltar às salas</Link></section>;
}

export function RoomDetailPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const [roomState, setRoomState] = useState({ status: "loading" });
  const [user, setUser] = useState(null);
  const [friendCodesAvailable, setFriendCodesAvailable] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(() => location.state?.inviteUrl || "");
  const [friendCode, setFriendCode] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [room, session, auth] = await Promise.all([communityRequest(`/rooms/${roomId}`), communityRequest("/me"), communityRequest("/auth/status")]);
      setRoomState({ status: "ready", data: room });
      setUser(session.user);
      setFriendCodesAvailable(auth.friendCodesAvailable);
    } catch (error) { setRoomState({ status: "error", error: error.message }); }
  }

  useEffect(() => {
    let active = true;
    Promise.all([communityRequest(`/rooms/${roomId}`), communityRequest("/me"), communityRequest("/auth/status")])
      .then(([room, session, auth]) => {
        if (!active) return;
        setRoomState({ status: "ready", data: room });
        setUser(session.user);
        setFriendCodesAvailable(auth.friendCodesAvailable);
      })
      .catch((error) => { if (active) setRoomState({ status: "error", error: error.message }); });
    return () => { active = false; };
  }, [roomId]);

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
      await act(`/rooms/${roomId}/invite`, { method: "POST", body: {} });
      return;
    }
    try { await navigator.clipboard.writeText(inviteUrl); setMessage("Convite copiado."); }
    catch { setMessage("Selecione e copie o link do convite manualmente."); }
  }

  if (roomState.status === "loading") return <section className="page-wrap community-page"><p role="status">Carregando a sala…</p></section>;
  if (roomState.status === "error") return <section className="page-wrap narrow-page community-page"><p className="page-label">Acesso à sala</p><h1>Não foi possível abrir</h1><ErrorNotice>{roomState.error}</ErrorNotice><Link className="button button-outline" to="/rooms">Voltar às salas</Link></section>;

  const { room, currentUser, members, match } = roomState.data;
  const isHost = currentUser.role === "host";
  const canShareCode = !["completed", "cancelled"].includes(room.status);
  const awaitingOpponent = match?.status === "awaiting_confirmation" && match.report?.reporterId !== currentUser.id;
  const disputed = match?.status === "disputed";

  return (
    <section className="page-wrap community-page">
      <div className="community-room-heading">
        <div><p className="page-label">Sala {isHost ? "do host" : "por convite"}</p><h1>{room.name}</h1><p className="page-intro">{ROOM_STATES[room.status]} · {members.length} de {room.capacity} participantes</p></div>
        <Link className="button button-outline" to="/rooms">Minhas salas</Link>
      </div>
      <ErrorNotice>{actionError}</ErrorNotice>
      {message ? <p className="community-success" role="status">{message}</p> : null}

      {room.status === "open" && isHost ? <section className="community-room-panel panel-frame"><div className="section-heading"><h2>Convite</h2><span>Expira em 7 dias</span></div><p className="community-muted">Compartilhe o link apenas com quem vai participar. O token fica no fragmento e é removido ao entrar.</p>{inviteUrl ? <div className="invite-copy-row"><input className="text-input" aria-label="Link de convite" readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /><button className="button button-primary button-small" type="button" onClick={copyInvite}>Copiar link</button></div> : <button className="button button-outline button-small" type="button" onClick={copyInvite}>Gerar convite</button>}</section> : null}

      <div className="community-room-grid">
        <section className="community-room-panel panel-frame" aria-labelledby="participants-title">
          <div className="section-heading"><h2 id="participants-title">Participantes</h2><span>Jogo acontece no Pokémon Champions</span></div>
          <ul className="participant-list">{members.map((member) => <li key={member.id}><div><strong>{member.handle}{member.id === room.hostId ? " · host" : ""}</strong><span>{member.status === "checked_in" ? "Check-in feito" : "Inscrito"}</span>{member.friendCode ? <span className="friend-code-value">Código compartilhado: {member.friendCode}</span> : null}</div>{member.id === currentUser.id && canShareCode && member.friendCode ? <button className="text-button" type="button" disabled={busy} onClick={() => act(`/rooms/${roomId}/friend-code`, { method: "DELETE" })}>Remover meu código</button> : null}</li>)}</ul>
          {canShareCode && friendCodesAvailable ? <form className="friend-code-form" onSubmit={(event) => { event.preventDefault(); act(`/rooms/${roomId}/friend-code`, { method: "PUT", body: { code: friendCode } }).then((result) => { if (result) setFriendCode(""); }); }}><label className="community-field"><span>Seu código de amizade (opcional)</span><input className="text-input" maxLength={40} value={friendCode} onChange={(event) => setFriendCode(event.target.value)} autoComplete="off" /></label><button className="button button-outline button-small" type="submit" disabled={busy || !friendCode}>Compartilhar só nesta sala</button><small>Fica visível aos membros e é removido ao terminar a sala ou após 7 dias.</small></form> : null}
          {canShareCode && !friendCodesAvailable ? <p className="community-empty">Compartilhamento de código temporariamente indisponível neste servidor.</p> : null}
          {currentUser.memberStatus === "registered" && room.status === "open" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => act(`/rooms/${roomId}/check-in`, { method: "POST", body: {} })}>Fazer check-in</button> : null}
          {isHost && room.status === "open" ? <button className="button button-outline" type="button" disabled={busy || members.length < 2 || members.some((member) => member.status !== "checked_in")} onClick={() => act(`/rooms/${roomId}/close`, { method: "POST", body: {} })}>Fechar inscrições</button> : null}
          {isHost && room.status === "locked" ? <button className="button button-primary" type="button" disabled={busy || members.some((member) => member.status !== "checked_in")} onClick={() => act(`/rooms/${roomId}/start`, { method: "POST", body: {} })}>Iniciar sala</button> : null}
          {isHost && ["open", "locked"].includes(room.status) ? <button className="text-button community-cancel" type="button" disabled={busy} onClick={() => { if (window.confirm("Cancelar esta sala?")) act(`/rooms/${roomId}/cancel`, { method: "POST", body: {} }); }}>Cancelar sala</button> : null}
        </section>

        <section className="community-room-panel panel-frame" aria-labelledby="match-title">
          <div className="section-heading"><h2 id="match-title">Resultado</h2><span>Registro manual</span></div>
          {!match ? <p className="community-empty">A partida aparece depois que o host fechar as inscrições e iniciar a sala.</p> : null}
          {match ? <div className="match-card"><p>{match.playerA.handle} × {match.playerB.handle}</p><strong>{match.status === "scheduled" ? "Aguardando resultado" : match.status === "awaiting_confirmation" ? "Aguardando confirmação" : match.status === "disputed" ? "Em contestação" : match.status === "confirmed" ? "Resultado confirmado" : "Partida anulada"}</strong>{match.report ? <p>Vencedor informado: <b>{match.report.winnerHandle}</b>{match.report.note ? <span> · {match.report.note}</span> : null}</p> : null}
            {match.status === "scheduled" ? <form className="community-match-form" onSubmit={(event) => { event.preventDefault(); act(`/matches/${match.id}/report`, { method: "POST", body: { winnerId } }); }}><label className="community-field"><span>Vencedor informado</span><select className="text-input" value={winnerId} onChange={(event) => setWinnerId(event.target.value)} required><option value="">Selecione</option><option value={match.playerA.id}>{match.playerA.handle}</option><option value={match.playerB.id}>{match.playerB.handle}</option></select></label><button className="button button-primary" disabled={busy || !winnerId}>Registrar resultado</button></form> : null}
            {awaitingOpponent ? <div className="community-match-actions"><button className="button button-primary" disabled={busy} onClick={() => act(`/matches/${match.id}/confirm`, { method: "POST", body: {} })}>Confirmar resultado</button><form onSubmit={(event) => { event.preventDefault(); act(`/matches/${match.id}/dispute`, { method: "POST", body: { reason: disputeReason } }); }}><label className="community-field"><span>Motivo da contestação</span><textarea className="text-input" rows="2" maxLength={500} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} required /></label><button className="button button-outline" disabled={busy || !disputeReason.trim()}>Contestar</button></form></div> : null}
            {disputed ? <p className="community-dispute-note">Contestação registrada: {match.dispute?.reason}. A moderação verá apenas os dados necessários para decidir.</p> : null}
            {disputed && user?.isModerator ? <ModeratorResolution match={match} onResolve={(decision, resolution) => act(`/moderation/disputes/${match.dispute.id}/resolve`, { method: "POST", body: { decision, resolution } })} busy={busy} /> : null}
          </div> : null}
        </section>
      </div>
      <p className="community-privacy-note">O Spinda Stop organiza pessoas e relatos voluntários. Não valida nem recebe dados da partida dentro do jogo.</p>
    </section>
  );
}

function ModeratorResolution({ onResolve, busy }) {
  const [decision, setDecision] = useState("confirm");
  const [resolution, setResolution] = useState("");
  return <form className="moderator-resolution" onSubmit={(event) => { event.preventDefault(); onResolve(decision, resolution); }}><strong>Ação da moderação</strong><label className="community-field"><span>Decisão e motivo</span><select className="text-input" value={decision} onChange={(event) => setDecision(event.target.value)}><option value="confirm">Confirmar o relato</option><option value="void">Anular a partida</option></select><textarea className="text-input" rows="2" maxLength={500} value={resolution} onChange={(event) => setResolution(event.target.value)} required /></label><button className="button button-primary button-small" type="submit" disabled={busy || !resolution.trim()}>Registrar decisão</button><p className="form-hint">A ação e a justificativa ficam no histórico de moderação.</p></form>;
}
