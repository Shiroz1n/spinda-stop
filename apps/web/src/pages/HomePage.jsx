import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";

const spinda = dexData.pokemon.find((pokemon) => pokemon.slug === "spinda");

const destinations = [
  { number: "01", title: "Explorar a Pokédex", note: "Espécies, formas e tipos", to: "/dex" },
  { number: "02", title: "Montar um time", note: "Edite seis sets e salve o rascunho neste navegador", to: "/builder" },
  { number: "03", title: "Consultar Usage", note: "Abra rankings e distribuições da fonte selecionada", to: "/usage" },
  { number: "04", title: "Criar sala", note: "Combine uma partida entre amigos", to: "/rooms" },
  { number: "05", title: "Criar torneio", note: "Organize uma chave entre amigos", to: "/tournaments" },
];

export function HomePage() {
  return (
    <div className="page-wrap home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="home-kicker">Pokémon Champions · Doubles</p>
          <h1 id="home-title">Prepare seu próximo time.</h1>
          <p className="hero-intro">Explore o catálogo, organize sets e combine a próxima partida.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/dex">Abrir a Pokédex</Link>
            <Link className="button button-outline" to="/builder">Montar time</Link>
          </div>
          <p className="home-note">Seus rascunhos ficam neste navegador.</p>
        </div>

        <Link className="home-signature" to="/dex/spinda">
          <span className="home-signature-art"><PokemonSprite pokemon={spinda} name="Spinda" size={176} priority decorative /></span>
          <span><strong>Spinda Stop</strong><small>Um ponto de partida para sua próxima batalha.</small><span className="sr-only">Abrir Spinda na Pokédex.</span></span>
        </Link>
      </section>

      <nav className="home-actions" aria-label="Atalhos principais">
        {destinations.map((item) => (
          <Link className="home-action" key={item.number} to={item.to}>
            <span className="action-index">{item.number}</span>
            <span className="action-copy"><strong>{item.title}</strong><small>{item.note}</small></span>
            <span className="action-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
