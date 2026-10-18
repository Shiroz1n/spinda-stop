import { Link, NavLink } from "react-router";
import { BrandMark } from "./BrandMark.jsx";

const navigation = [
  { to: "/dex", label: "Pokédex" },
  { to: "/builder", label: "Construtor" },
];

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Spinda Stop — início">
          <BrandMark />
          <span>Spinda Stop</span>
        </Link>
        <nav className="primary-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link className="button button-small button-primary header-action" to="/builder">
          Montar time
        </Link>
      </header>

      <main id="main-content" className="main-content">{children}</main>

      <footer className="site-footer">
        <span>Spinda Stop é um projeto independente da comunidade.</span>
        <span>Dados gerais: <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokéAPI</a>.</span>
      </footer>
    </div>
  );
}
