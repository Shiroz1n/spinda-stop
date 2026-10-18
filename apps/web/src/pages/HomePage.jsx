import { Link } from "react-router";
import dexData from "@spinda-stop/data/pokedex";
import { BrandMark } from "../components/BrandMark.jsx";

export function HomePage() {
  return (
    <div className="page-wrap home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="hero-brand-line"><BrandMark /><span>Oficina de times</span></div>
          <h1>Prepare o time antes da partida.</h1>
          <p className="hero-intro">Pesquise o catálogo, monte seis posições e salve o rascunho neste navegador.</p>
          <p className="trust-note"><span className="status-dot" /> A disponibilidade no Pokémon Champions ainda não foi verificada.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/builder">Criar um time</Link>
            <Link className="button button-outline" to="/dex">Explorar a Pokédex</Link>
          </div>
        </div>

        <div className="workflow-panel" aria-label="Como usar o Spinda Stop">
          <h2>Seu fluxo de preparação</h2>
          <ol className="workflow-list">
            <li><span className="workflow-symbol">01</span><span><b>Encontre</b><small>Busque espécies e formas.</small></span></li>
            <li><span className="workflow-symbol">02</span><span><b>Monte</b><small>Edite os seis integrantes.</small></span></li>
            <li><span className="workflow-symbol">03</span><span><b>Leve</b><small>Exporte o rascunho em JSON.</small></span></li>
          </ol>
          <p className="workflow-footnote">Sem conta. O rascunho fica no navegador; exporte quando quiser guardar um arquivo.</p>
        </div>
      </section>

      <section className="home-data-strip" aria-label="Sobre o catálogo">
        <div><span className="data-strip-label">Catálogo geral</span><b>{dexData.metadata.speciesCount.toLocaleString("pt-BR")} espécies</b></div>
        <div><span className="data-strip-label">Formas catalogadas</span><b>{dexData.metadata.formCount.toLocaleString("pt-BR")} entradas</b></div>
        <div><span className="data-strip-label">Disponibilidade no jogo</span><b>Não verificada</b></div>
      </section>

      <section className="home-next-step">
        <div>
          <p className="page-label">A seguir</p>
          <h2>Eventos comunitários estão no roteiro.</h2>
        </div>
        <p>Inscrição, check-in, pareamento e confirmação de resultados entram depois das fontes e regras competitivas.</p>
      </section>
    </div>
  );
}
