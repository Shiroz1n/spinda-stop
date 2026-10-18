import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { PokemonSprite } from "../components/PokemonSprite.jsx";

const featuredSlugs = ["garchomp", "spinda", "arcanine-hisui", "meowscarada"];

function featuredPokemon() {
  return featuredSlugs
    .map((slug) => dexData.pokemon.find((pokemon) => pokemon.slug === slug))
    .filter(Boolean);
}

export function HomePage() {
  const featured = featuredPokemon();

  return (
    <div className="page-wrap home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="home-kicker"><span className="kicker-dot" /> Preparação para Pokémon Champions</p>
          <h1 id="home-title">Seu próximo time começa aqui.</h1>
          <p className="hero-intro">Descubra espécies, organize suas ideias e prepare a próxima partida.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/dex">Explorar Pokédex</Link>
            <Link className="button button-outline" to="/builder">Montar time <span aria-hidden="true">↗</span></Link>
          </div>
          <p className="home-note">Doubles em foco · seus rascunhos ficam neste navegador</p>
        </div>

        <div className="home-roster" aria-label="Pokémon do catálogo geral">
          <div className="roster-window-top"><span>ENCONTRE SEU PAR</span><span className="roster-led" /></div>
          <div className="roster-scene">
            <div className="scene-sun" aria-hidden="true" />
            <span className="scene-label">CATÁLOGO GERAL</span>
            <div className="featured-pokemon-row">
              {featured.map((pokemon, index) => (
                <Link className={`featured-pokemon featured-pokemon-${index + 1}`} to={`/dex/${pokemon.slug}`} key={pokemon.slug} aria-label={`Ver ficha de ${pokemon.name}`}>
                  <PokemonSprite pokemon={pokemon} name={pokemon.name} size={index === 1 ? 110 : 96} decorative priority={index < 2} />
                </Link>
              ))}
            </div>
          </div>
          <div className="roster-caption">
            {featured.slice(0, 3).map((pokemon) => <span key={pokemon.slug}>{pokemon.name}</span>)}
          </div>
        </div>
      </section>

      <section className="home-actions" aria-label="O que você quer fazer?">
        <Link className="home-action home-action-dex" to="/usage">
          <span className="action-index">01</span>
          <span className="action-art"><PokemonSprite pokemon={featured[0]} name="Garchomp" size={76} decorative /></span>
          <span className="action-copy"><strong>Explorar Pokémon e meta</strong><small>Abra a Pokédex ou confira as tendências de Doubles.</small></span>
          <span className="action-arrow" aria-hidden="true">↗</span>
        </Link>
        <Link className="home-action home-action-builder" to="/builder">
          <span className="action-index">02</span>
          <span className="action-art action-art-team"><PokemonSprite pokemon={featured[1]} name="Spinda" size={70} decorative /></span>
          <span className="action-copy"><strong>Montar um time</strong><small>Edite seis sets e guarde um rascunho local.</small></span>
          <span className="action-arrow" aria-hidden="true">↗</span>
        </Link>
        <div className="home-action home-action-community">
          <span className="action-index">03</span>
          <span className="action-art action-art-community" aria-hidden="true"><span className="community-ball">VS</span></span>
          <span className="action-copy"><strong>Organizar uma partida</strong><small>Crie uma sala ou monte um torneio entre amigos.</small></span>
          <span className="community-links"><Link to="/rooms">Salas</Link><Link to="/tournaments">Torneios</Link></span>
        </div>
      </section>
    </div>
  );
}
