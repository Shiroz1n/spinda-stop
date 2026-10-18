import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { BrandMark } from "./BrandMark.jsx";

const navigation = [
  { to: "/dex", label: "Pokédex", shortLabel: "Dex", icon: "search" },
  { to: "/usage", label: "Usage", shortLabel: "Usage", icon: "bars" },
  { to: "/builder", label: "Construtor", shortLabel: "Time", icon: "team" },
  { to: "/calculator", label: "Calculadora", shortLabel: "Dano", icon: "calc" },
  { to: "/speed-tiers", label: "Speed Tiers", shortLabel: "Speed", icon: "speed" },
];

function NavigationIcon({ name }) {
  const paths = {
    search: <><circle cx="7" cy="7" r="4.2" /><path d="m10.2 10.2 4.1 4.1" /></>,
    bars: <><path d="M2 13h2V8H2zm5 0h2V4H7zm5 0h2V6h-2z" /></>,
    team: <><rect x="1.5" y="2" width="5" height="5" /><rect x="9.5" y="2" width="5" height="5" /><rect x="5.5" y="9" width="5" height="5" /></>,
    calc: <><path d="M2 5h12M8 1v8M3 11h4m-2-2v4m4-2h5" /></>,
    speed: <><path d="M2 12h12M3 9h3m2-3h3m1-3h2" /><path d="m2 4 3 3-3 3" /></>,
  };
  return <svg className="mobile-nav-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function CommunityMenu() {
  const menuRef = useRef(null);
  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  return (
    <details className="mobile-more-nav" ref={menuRef}>
      <summary aria-label="Mais opções da comunidade">
        <span className="mobile-nav-more-icon" aria-hidden="true"><i /><i /><i /></span>
        <span>Mais</span>
      </summary>
      <div className="mobile-more-menu">
        <Link to="/rooms" onClick={closeMenu}>Salas <span aria-hidden="true">↗</span></Link>
        <Link to="/tournaments" onClick={closeMenu}>Torneios <span aria-hidden="true">↗</span></Link>
      </div>
    </details>
  );
}

export function AppShell({ children }) {
  const location = useLocation();
  const mainRef = useRef(null);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      mainRef.current?.focus();
    }
  }, [location.pathname]);

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
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/rooms" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>Salas</NavLink>
          <NavLink to="/tournaments" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>Torneios</NavLink>
        </nav>
        <Link className="button button-small button-primary header-action" to="/builder">Montar time</Link>
      </header>

      <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>{children}</main>

      <nav className="mobile-primary-nav" aria-label="Navegação rápida">
        {navigation.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-nav-link${isActive ? " is-active" : ""}`}>
            <NavigationIcon name={item.icon} />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
        <CommunityMenu />
      </nav>

      <footer className="site-footer">
        <span>Projeto de fã independente, sem vínculo oficial.</span>
        <span>Dados gerais: <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokéAPI</a>.</span>
      </footer>
    </div>
  );
}
