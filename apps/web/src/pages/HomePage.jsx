import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";

const spinda = dexData.pokemon.find((pokemon) => pokemon.slug === "spinda");

const destinations = [
  { title: "Usage", note: "Fonte, formato e período", to: "/usage" },
  { title: "Calculadora", note: "Dano e rolls do motor", to: "/calculator" },
  { title: "Speed Tiers", note: "Compare um alvo", to: "/speed-tiers" },
  { title: "Salas", note: "Partidas privadas", to: "/rooms" },
  { title: "Torneios", note: "Chave e participantes", to: "/tournaments" },
];

export function HomePage() {
  return (
    <div className="page-wrap home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <h1 id="home-title">Prepare seu próximo time.</h1>
          <p className="hero-intro">Pokémon Champions · Doubles — procure uma forma, ajuste os seis sets e compare o próximo confronto.</p>
          <form className="home-search" action="/dex" method="get" role="search" aria-label="Buscar na Pokédex">
            <label htmlFor="home-pokemon-search">Espécie, forma ou número</label>
            <div><input id="home-pokemon-search" name="q" type="search" placeholder="Ex.: Garchomp" /><button className="button button-primary" type="submit">Buscar na Pokédex</button></div>
          </form>
          <div className="hero-actions">
            <Link className="button button-outline" to="/builder">Montar time</Link>
            <span className="home-note">O rascunho permanece neste navegador.</span>
          </div>
        </div>

        <Link className="home-signature" to="/dex/spinda">
          <span className="home-signature-art"><PokemonSprite pokemon={spinda} name="Spinda" size={176} priority decorative /></span>
          <span><strong>Spinda Stop</strong><small>Um ponto de partida para sua próxima batalha.</small><span className="sr-only">Abrir Spinda na Pokédex.</span></span>
        </Link>
      </section>

      <nav className="home-actions" aria-label="Atalhos principais">
        {destinations.map((item) => (
          <Link className="home-action" key={item.to} to={item.to}>
            <span className="action-copy"><strong>{item.title}</strong><small>{item.note}</small></span>
            <span className="action-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
