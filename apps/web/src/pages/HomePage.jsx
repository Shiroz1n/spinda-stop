import { useEffect, useState } from "react";
import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { createPokemonSpriteLookup, resolveCompetitivePokemonSprite } from "../data/pokemonSprites.js";
import { usageProviders } from "../data/usage/registry.js";
import { communityRequest } from "../data/communityApi.js";
import { mergeUsageCatalog } from "../data/usage/mergeUsageData.js";
import { getCompetitionPhase, getRankedRegulationPhase, megaEvolutionBattle, rankedRegulation } from "../data/championsCompetition.js";

const spinda = dexData.pokemon.find((pokemon) => pokemon.slug === "spinda");
const metaRoll = usageProviders.metaroll;
const battleData = usageProviders["pokemon-champions-battle-data"];
const findPokemon = createPokemonSpriteLookup(dexData.pokemon);

function resolveUsagePokemon(entry) {
  return resolveCompetitivePokemonSprite(findPokemon, {
    id: entry.showdownId || entry.metaRollId || entry.id,
    name: entry.name,
  });
}

function initials(value) {
  return String(value || "?").trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] || "").join("").toLocaleUpperCase("pt-BR") || "?";
}

function periodLabel() {
  const start = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(rankedRegulation.startsAt));
  const end = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(rankedRegulation.endsAt));
  return `${start} – ${end} · UTC`;
}

function RegulationPanel({ titleId }) {
  const phase = getRankedRegulationPhase();
  const state = phase === "ended" ? "Aviso expirado" : phase === "upcoming" ? "Ainda não vigente" : "Vigente";
  const title = phase === "ended" ? "Última regulação publicada" : phase === "upcoming" ? "Próxima regulação" : "Regulação atual";

  return (
    <section className="home-regulation" aria-labelledby={titleId}>
      <div className="home-section-heading">
        <div><p className="page-label">Pokémon HOME</p><h2 id={titleId}>{title}</h2></div>
        <span className="home-season-status">{state}</span>
      </div>
      <p className="home-regulation-name"><strong>Season {rankedRegulation.season}</strong><span>{rankedRegulation.ruleset}</span></p>
      <p className="home-regulation-period">{periodLabel()}</p>
      <p className="home-regulation-copy">{phase === "ended" ? "O período anunciado terminou. Consulte o jogo para confirmar a regulação vigente." : phase === "upcoming" ? "O anúncio informa as datas; confirme as regras no jogo antes de montar o time." : "Ranked segue esta regulação até 2 dez. 2026. Confirme a elegibilidade no jogo."}</p>
      <details className="home-regulation-details"><summary>Dados do roster</summary><p>O anúncio consultado não informa contagem de Pokémon, Megas disponíveis ou novas liberações.</p></details>
      <a className="home-text-link" href={rankedRegulation.sourceUrl} target="_blank" rel="noreferrer">Anúncio oficial ↗</a>
      <small className="home-checked-at">Verificado em 6 nov. 2026</small>
    </section>
  );
}

function formatUtcRange(start, end) {
  const format = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  return `${format.format(new Date(start))} – ${format.format(new Date(end))} UTC`;
}

function OfficialCompetition() {
  const phase = getCompetitionPhase();
  if (phase === "ended") return null;
  const status = phase === "in-progress" ? "Em andamento" : phase === "registration-open" ? "Inscrições abertas" : "Em breve";
  return <section className="home-official-competition" aria-labelledby="home-official-competition-title">
    <div className="home-official-heading"><div><p className="page-label">Pokémon Champions · online</p><h3 id="home-official-competition-title">{megaEvolutionBattle.name}</h3></div><span>{status}</span></div>
    <div className="home-official-dates"><p><strong>Inscrições</strong><span>{formatUtcRange(megaEvolutionBattle.entryStartsAt, megaEvolutionBattle.endsAt)}</span></p><p><strong>Batalhas</strong><span>{formatUtcRange(megaEvolutionBattle.startsAt, megaEvolutionBattle.endsAt)}</span></p></div>
    <p className="home-official-format">Duplas · {megaEvolutionBattle.restrictions.join(" · ")}</p>
    <small>Confirmado em 7 nov. 2026 · <a href={megaEvolutionBattle.sourceUrl} target="_blank" rel="noreferrer">anúncio oficial ↗</a></small>
  </section>;
}

function PublicVgcTournaments() {
  const [state, setState] = useState({ status: "loading", tournaments: [] });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/vgc-tournaments", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || "Agenda indisponível.");
        return payload;
      })
      .then((payload) => setState({ status: "ready", tournaments: Array.isArray(payload.tournaments) ? payload.tournaments : [] }))
      .catch((error) => { if (!controller.signal.aborted) setState({ status: "error", tournaments: [], message: error.message }); });
    return () => controller.abort();
  }, []);

  return <section className="home-vgc-tournaments" aria-labelledby="home-vgc-title">
    <div className="home-section-heading"><div><p className="page-label">Pokémon VGC · M-C</p><h2 id="home-vgc-title">Agenda de torneios</h2></div><a href="https://play.limitlesstcg.com/tournaments?game=VGC&format=M-C" target="_blank" rel="noreferrer">Ver torneios ↗</a></div>
    <p className="home-vgc-intro">Datas de início publicadas pela comunidade; não indicam se o torneio está ao vivo.</p>
    {state.status === "loading" && <p className="home-data-state" role="status">Carregando torneios M-C…</p>}
    {state.status === "error" && <p className="home-data-state" role="status">{state.message || "A agenda não respondeu."}</p>}
    {state.status === "ready" && !state.tournaments.length && <p className="home-data-state">Nenhum torneio M-C de hoje ou futuro foi publicado.</p>}
    {state.tournaments.length > 0 && <ol className="home-vgc-list">{state.tournaments.slice(0, 6).map((tournament) => <li key={tournament.id}>
      <span className="home-vgc-date">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(new Date(tournament.date))} UTC</span>
      <span className="home-vgc-name"><strong>{tournament.name || "Torneio VGC"}</strong><small>{tournament.scheduleStatus === "today" ? "Agendado para hoje" : "Próximo torneio"}</small></span>
      <a href={tournament.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${tournament.name || "torneio"} no Limitless`}>Abrir ↗</a>
    </li>)}</ol>}
    <small className="home-vgc-credit">Fonte: <a href="https://docs.limitlesstcg.com/developer/tournaments.html" target="_blank" rel="noreferrer">API pública Limitless VGC</a>.</small>
  </section>;
}

function HomeCommunity() {
  const [state, setState] = useState({ status: "loading", rooms: [], tournaments: [] });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    communityRequest("/me", { signal: controller.signal }).then(async ({ user }) => {
      if (!user) return { status: "signed-out", rooms: [], tournaments: [] };
      const [rooms, tournaments] = await Promise.all([
        communityRequest("/rooms", { signal: controller.signal }),
        communityRequest("/tournaments", { signal: controller.signal }),
      ]);
      return {
        status: "ready",
        rooms: (rooms.rooms || []).filter((room) => !["completed", "cancelled"].includes(room.status)),
        tournaments: (tournaments.tournaments || []).filter((tournament) => !["completed", "cancelled"].includes(tournament.status)),
      };
    }).then((next) => { if (active) setState(next); }).catch((error) => {
      if (active && !controller.signal.aborted) setState({ status: error.status === 401 ? "signed-out" : "error", rooms: [], tournaments: [] });
    });
    return () => { active = false; controller.abort(); };
  }, []);

  const hasActivity = state.rooms.length || state.tournaments.length;
  return (
    <section className="home-community" aria-labelledby="home-community-title">
      <div className="home-section-heading">
        <div><p className="page-label">Comunidade</p><h2 id="home-community-title">Salas e torneios</h2></div>
        <div className="home-community-links"><Link to="/rooms">Salas</Link><Link to="/tournaments">Torneios</Link></div>
      </div>
      {state.status === "loading" ? <p className="home-data-state" role="status">Consultando sua atividade…</p> : null}
      {state.status === "error" ? <p className="home-data-state" role="status">Não foi possível consultar sua atividade agora. Abra a comunidade para tentar novamente.</p> : null}
      {state.status === "signed-out" ? <div className="home-community-empty"><p>Salas e torneios são privados e aparecem aqui depois que você entra.</p><Link className="button button-outline" to="/rooms">Abrir salas</Link><Link className="button button-outline" to="/tournaments">Abrir torneios</Link></div> : null}
      {state.status === "ready" && !hasActivity ? <div className="home-community-empty"><p>Você ainda não participa de uma sala ou torneio ativo.</p><Link className="button button-outline" to="/rooms">Criar ou entrar em uma sala</Link><Link className="button button-outline" to="/tournaments">Criar ou entrar em um torneio</Link></div> : null}
      {state.status === "ready" && hasActivity ? (
        <div className="home-community-columns">
          <div><h3>Salas</h3>{state.rooms.length ? <ul className="home-community-list">{state.rooms.slice(0, 3).map((room) => <li key={room.id}><span><strong>{room.name}</strong><small>{room.status === "open" ? "Inscrições abertas" : room.status === "locked" ? "Check-in" : room.status === "in_progress" ? "Em andamento" : room.status}</small></span><Link to={`/rooms/${room.id}`}>Abrir</Link></li>)}</ul> : <p className="home-data-state">Sem salas ativas.</p>}<Link className="home-text-link" to="/rooms">Ver salas ↗</Link></div>
          <div><h3>Torneios</h3>{state.tournaments.length ? <ul className="home-community-list">{state.tournaments.slice(0, 3).map((tournament) => <li key={tournament.id}><span><strong>{tournament.name}</strong><small>{tournament.status === "open" ? "Inscrições abertas" : tournament.status === "in_progress" ? "Em andamento" : tournament.status}</small></span><Link to={`/tournaments/${tournament.id}`}>Abrir</Link></li>)}</ul> : <p className="home-data-state">Sem torneios ativos.</p>}<Link className="home-text-link" to="/tournaments">Ver torneios ↗</Link></div>
        </div>
      ) : null}
    </section>
  );
}

function UsagePreview({ state }) {
  const entries = state.data?.slice().sort((left, right) => (left.displayRank ?? Number.MAX_SAFE_INTEGER) - (right.displayRank ?? Number.MAX_SAFE_INTEGER)).slice(0, 15) || [];
  return (
    <section className="home-preview home-usage-preview" aria-labelledby="home-usage-title">
      <div className="home-section-heading"><div><p className="page-label">Doubles</p><h2 id="home-usage-title">Usage</h2></div><Link to="/usage">Ver tudo ↗</Link></div>
      {state.status === "loading" ? <p className="home-data-state" role="status">Carregando o meta…</p> : null}
      {state.status === "error" ? <p className="home-data-state" role="status">Usage não respondeu. <Link to="/usage">Abrir captura</Link></p> : null}
      {state.status === "ready" && entries.length ? <ol className="home-preview-list" aria-label="Pokémon melhor posicionados na captura selecionada" tabIndex={entries.length >= 7 ? 0 : undefined}>{entries.map((entry) => {
        const pokemon = resolveUsagePokemon(entry);
        return <li key={entry.key}><span className="home-preview-rank">{entry.displayRank ?? "—"}</span>{pokemon ? <PokemonSprite pokemon={pokemon} name={entry.name} size={44} decorative /> : <span className="home-avatar" aria-hidden="true">{initials(entry.name)}</span>}<span className="home-preview-copy"><strong>{entry.name}</strong><small>{entry.displayRank ? `Posição ${entry.displayRank}` : "posição não publicada"}</small></span></li>;
      })}</ol> : null}
      {state.status === "ready" && !entries.length ? <p className="home-data-state">As capturas não publicaram espécies.</p> : null}
      {state.status === "ready" ? <small className="home-preview-meta">Posições publicadas em Doubles{state.season ? ` · ${state.season}` : ""}</small> : null}
    </section>
  );
}

function LadderPreview({ state }) {
  const entries = state.data?.entries.slice().sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)).slice(0, 50) || [];
  return (
    <section className="home-preview home-ladder-preview" aria-labelledby="home-ladder-title">
      <div className="home-section-heading"><div><p className="page-label">Doubles</p><h2 id="home-ladder-title">Ladder</h2></div><Link to="/usage?source=metaroll&view=trainers">Ver tudo ↗</Link></div>
      {state.status === "loading" ? <p className="home-data-state" role="status">Carregando jogadores…</p> : null}
      {state.status === "error" ? <p className="home-data-state" role="status">A Ladder não respondeu. <Link to="/usage?source=metaroll&view=trainers">Abrir ladder</Link></p> : null}
      {state.status === "ready" && entries.length ? <ol className="home-preview-list home-ladder-list" aria-label="Jogadores melhor posicionados na Ladder" tabIndex={entries.length >= 7 ? 0 : undefined}>{entries.map((person) => <li key={person.id}><span className="home-preview-rank">{person.rank ?? "—"}</span><span className="home-avatar" aria-hidden="true">{initials(person.name)}</span><span className="home-preview-copy"><strong>{person.name || "Nome não informado"}</strong><small>{person.rating === null ? "rating não informado" : `Rating ${person.rating.toLocaleString("pt-BR")}`}</small></span></li>)}</ol> : null}
      {state.status === "ready" && !entries.length ? <p className="home-data-state">A captura não publicou jogadores.</p> : null}
      {state.data?.season ? <small className="home-preview-meta">Temporada {state.data.season} · posição publicada</small> : null}
    </section>
  );
}

export function HomePage() {
  const [usageState, setUsageState] = useState({ status: "loading", data: null });
  const [ladderState, setLadderState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let active = true;
    Promise.allSettled([battleData.loadIndex(), metaRoll.loadIndex()]).then(([battleResult, metaResult]) => {
      if (!active) return;
      const catalog = mergeUsageCatalog(
        battleResult.status === "fulfilled" ? battleResult.value : null,
        metaResult.status === "fulfilled" ? metaResult.value : null,
        resolveUsagePokemon,
      );
      const source = catalog.some((entry) => entry.metaRoll !== null) ? "metaRoll" : "battleData";
      const index = source === "metaRoll"
        ? (metaResult.status === "fulfilled" ? metaResult.value : null)
        : (battleResult.status === "fulfilled" ? battleResult.value : null);
      const rankedEntries = catalog.filter((entry) => entry.displaySource === source);
      setUsageState(catalog.length ? { status: "ready", data: rankedEntries, season: index?.season || null } : { status: "error", data: null });
    });
    metaRoll.loadLadder().then((data) => { if (active) setLadderState({ status: "ready", data }); })
      .catch(() => { if (active) setLadderState({ status: "error", data: null }); });
    return () => { active = false; };
  }, []);

  return (
    <div className="page-wrap home-page home-dashboard">
      <div className="home-dashboard-top">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="page-label">Pokémon Champions · Doubles</p>
            <h1 id="home-title">Prepare seu próximo time.</h1>
            <p className="hero-intro">Encontre uma espécie, entenda o meta e ajuste sua equipe antes da batalha.</p>
            <form className="home-search" action="/dex" method="get" role="search" aria-label="Buscar na Pokédex">
              <label htmlFor="home-pokemon-search">Espécie, forma ou número</label>
              <div><input id="home-pokemon-search" name="q" type="search" placeholder="Ex.: Garchomp" /><button className="button button-primary" type="submit">Buscar na Pokédex</button></div>
            </form>
            <div className="hero-actions"><Link className="button button-primary" to="/builder">Montar time</Link><Link className="home-secondary-link" to="/dex">Explorar Pokédex ↗</Link></div>
            <nav className="home-actions" aria-label="Outras ferramentas">
              <Link className="home-action" to="/calculator">Calculadora</Link>
              <Link className="home-action" to="/speed-tiers">Speed Tiers</Link>
            </nav>
          </div>
          <Link className="home-signature" to="/dex/spinda" aria-label="Conheça Spinda na Pokédex">
            <span className="home-signature-art"><PokemonSprite pokemon={spinda} name="Spinda" size={176} priority decorative /></span>
            <span className="home-signature-caption"><strong>Spinda Stop</strong><small>Um ponto de partida para sua próxima batalha.</small></span>
          </Link>
        </section>
        <div className="home-mobile-regulation"><RegulationPanel titleId="home-regulation-mobile-title" /></div>
        <UsagePreview state={usageState} />
        <LadderPreview state={ladderState} />
      </div>
      <div className="home-dashboard-bottom">
        <HomeCommunity />
        <OfficialCompetition />
        <PublicVgcTournaments />
        <div className="home-desktop-regulation"><RegulationPanel titleId="home-regulation-desktop-title" /></div>
      </div>
      <p className="home-data-credit">Dados gerais: <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokéAPI</a>. Dados competitivos: <a href={battleData.source.url} target="_blank" rel="noreferrer">Pokémon Champions Battle Data</a> e <a href={metaRoll.source.url} target="_blank" rel="noreferrer">MetaRoll</a>.</p>
    </div>
  );
}
