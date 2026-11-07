import { useEffect, useState } from "react";
import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";
import { usageProviders } from "../data/usage/registry.js";
import { communityRequest } from "../data/communityApi.js";
import { mergeUsageCatalog } from "../data/usage/mergeUsageData.js";

const spinda = dexData.pokemon.find((pokemon) => pokemon.slug === "spinda");
const metaRoll = usageProviders.metaroll;
const battleData = usageProviders["pokemon-champions-battle-data"];
const regulation = {
  season: "M-8",
  ruleset: "Regulation M-C",
  startsAt: "2026-11-04T02:00:00Z",
  endsAt: "2026-12-02T01:59:00Z",
  checkedAt: "2026-11-06",
  url: "https://champions-news.pokemon-home.com/en/page/867.html",
};

function normalized(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const pokemonByName = new Map(dexData.pokemon.flatMap((pokemon) => [
  [normalized(pokemon.name), pokemon],
  [normalized(pokemon.slug), pokemon],
]));

function initials(value) {
  return String(value || "?").trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] || "").join("").toLocaleUpperCase("pt-BR") || "?";
}

function periodLabel() {
  const start = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(regulation.startsAt));
  const end = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(regulation.endsAt));
  return `${start} – ${end} · UTC`;
}

function RegulationPanel({ titleId }) {
  const state = "Período oficial confirmado";

  return (
    <section className="home-regulation" aria-labelledby={titleId}>
      <div className="home-section-heading">
        <div><p className="page-label">Aviso oficial</p><h2 id={titleId}>Regulação atual</h2></div>
        <span className="home-season-status">{state}</span>
      </div>
      <p className="home-regulation-name"><strong>Season {regulation.season}</strong><span>{regulation.ruleset}</span></p>
      <p className="home-regulation-period">{periodLabel()}</p>
      <p className="home-regulation-copy">O aviso informa que a temporada ranqueada segue esta regulação. A lista de Pokémon elegíveis e os detalhes das regras precisam ser conferidos no jogo.</p>
      <details className="home-regulation-details">
        <summary>O que foi confirmado</summary>
        <p>Pokémon HOME confirma o período de Season M-8 e Regulation M-C. O anúncio não publica aqui a contagem do roster, o número de Megas disponíveis nem os novos Pokémon liberados.</p>
      </details>
      <a className="home-text-link" href={regulation.url} target="_blank" rel="noreferrer">Abrir anúncio oficial ↗</a>
      <small className="home-checked-at">Verificado em 6 nov. 2026 · dados de elenco não confirmados</small>
    </section>
  );
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
  const entries = state.data?.slice().sort((left, right) => (left.displayRank ?? Number.MAX_SAFE_INTEGER) - (right.displayRank ?? Number.MAX_SAFE_INTEGER)).slice(0, 6) || [];
  return (
    <section className="home-preview home-usage-preview" aria-labelledby="home-usage-title">
      <div className="home-section-heading"><div><p className="page-label">Doubles</p><h2 id="home-usage-title">Usage</h2></div><Link to="/usage">Ver tudo ↗</Link></div>
      {state.status === "loading" ? <p className="home-data-state" role="status">Carregando o meta…</p> : null}
      {state.status === "error" ? <p className="home-data-state" role="status">Usage não respondeu. <Link to="/usage">Abrir captura</Link></p> : null}
      {state.status === "ready" && entries.length ? <ol className="home-preview-list" aria-label="Pokémon melhor posicionados na captura selecionada">{entries.map((entry) => {
        const pokemon = pokemonByName.get(normalized(entry.showdownId || entry.metaRollId)) || pokemonByName.get(normalized(entry.name));
        return <li key={entry.key}><span className="home-preview-rank">{entry.displayRank ?? "—"}</span>{pokemon ? <PokemonSprite pokemon={pokemon} name={entry.name} size={44} decorative /> : <span className="home-avatar" aria-hidden="true">{initials(entry.name)}</span>}<span className="home-preview-copy"><strong>{entry.name}</strong><small>{entry.displayRank ? `Posição ${entry.displayRank}` : "posição não publicada"}</small></span></li>;
      })}</ol> : null}
      {state.status === "ready" && !entries.length ? <p className="home-data-state">As capturas não publicaram espécies.</p> : null}
      {state.status === "ready" ? <small className="home-preview-meta">Posições publicadas em Doubles{state.season ? ` · ${state.season}` : ""}</small> : null}
    </section>
  );
}

function LadderPreview({ state }) {
  const entries = state.data?.entries.slice().sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)).slice(0, 6) || [];
  return (
    <section className="home-preview home-ladder-preview" aria-labelledby="home-ladder-title">
      <div className="home-section-heading"><div><p className="page-label">Doubles</p><h2 id="home-ladder-title">Ladder</h2></div><Link to="/usage?source=metaroll&view=trainers">Ver tudo ↗</Link></div>
      {state.status === "loading" ? <p className="home-data-state" role="status">Carregando jogadores…</p> : null}
      {state.status === "error" ? <p className="home-data-state" role="status">A Ladder não respondeu. <Link to="/usage?source=metaroll&view=trainers">Abrir ladder</Link></p> : null}
      {state.status === "ready" && entries.length ? <ol className="home-preview-list home-ladder-list" aria-label="Jogadores melhor posicionados na Ladder">{entries.map((person) => <li key={person.id}><span className="home-preview-rank">{person.rank ?? "—"}</span><span className="home-avatar" aria-hidden="true">{initials(person.name)}</span><span className="home-preview-copy"><strong>{person.name || "Nome não informado"}</strong><small>{person.rating === null ? "rating não informado" : `Rating ${person.rating.toLocaleString("pt-BR")}`}</small></span></li>)}</ol> : null}
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
        <div className="home-desktop-regulation"><RegulationPanel titleId="home-regulation-desktop-title" /></div>
      </div>
      <p className="home-data-credit">Dados gerais: <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokéAPI</a>. Dados competitivos: <a href={battleData.source.url} target="_blank" rel="noreferrer">Pokémon Champions Battle Data</a> e <a href={metaRoll.source.url} target="_blank" rel="noreferrer">MetaRoll</a>.</p>
    </div>
  );
}
