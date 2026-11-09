import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { BrandMark } from "./BrandMark.jsx";

const GlobalSearch = lazy(() => import("./GlobalSearch.jsx").then((module) => ({ default: module.GlobalSearch })));

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

function CommunityMenu({ onOpenSearch }) {
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
        <button type="button" onClick={() => { closeMenu(); onOpenSearch(); }}>Buscar Pokémon ou golpe <span aria-hidden="true">⌕</span></button>
        <Link to="/rooms" onClick={closeMenu}>Salas <span aria-hidden="true">↗</span></Link>
        <Link to="/tournaments" onClick={closeMenu}>Torneios <span aria-hidden="true">↗</span></Link>
      </div>
    </details>
  );
}

function ThemeIcon({ theme }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {theme === "dark" ? (
        <path d="M16.8 12.1A7 7 0 0 1 7.9 3.2 7.1 7.1 0 1 0 16.8 12Z" />
      ) : (
        <><circle cx="10" cy="10" r="3.5" /><path d="M10 1.5v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6-1.4 1.4m-9.2 9.2L3.5 16m13 0-1.4-1.4M3.5 4l1.4 1.4" /></>
      )}
    </svg>
  );
}

export function AppShell({ children }) {
  const location = useLocation();
  const mainRef = useRef(null);
  const searchReturnFocusRef = useRef(null);
  const previousPath = useRef(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("spinda-theme");
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const activeTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemPreference = (event) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", updateSystemPreference);
    return () => media.removeEventListener("change", updateSystemPreference);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = activeTheme === "dark" ? "#15171d" : "#111111";
    try {
      if (theme === "system") localStorage.removeItem("spinda-theme");
      else localStorage.setItem("spinda-theme", theme);
    } catch {
      // The in-memory theme still works when storage is unavailable.
    }
  }, [activeTheme, theme]);

  useEffect(() => {
    function openSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchReturnFocusRef.current = document.activeElement;
        setSearchMounted(true);
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  function openSearch() {
    searchReturnFocusRef.current = document.activeElement;
    setSearchMounted(true);
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    const target = searchReturnFocusRef.current;
    searchReturnFocusRef.current = null;
    requestAnimationFrame(() => {
      if (target?.isConnected && target.getClientRects().length) target.focus();
      else mainRef.current?.focus({ preventScroll: true });
    });
  }

  function cycleTheme() {
    setTheme((current) => current === "system"
      ? (systemPrefersDark ? "light" : "dark")
      : current === "light" ? "dark" : "system");
  }

  const themeLabel = theme === "system"
    ? `Tema automático, atualmente ${activeTheme === "dark" ? "escuro" : "claro"}. Clique para personalizar.`
    : theme === "light" ? "Tema claro. Clique para escuro." : "Tema escuro. Clique para automático.";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <header className="site-header">
        <Link className="brand" to="/">
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
        <div className="header-tools">
          <button className="header-search-button" type="button" aria-label="Buscar no Spinda Stop" title="Buscar (Ctrl/⌘ K)" onClick={openSearch}>
            <NavigationIcon name="search" />
          </button>
          <button className="theme-toggle" type="button" aria-label={themeLabel} title={themeLabel} onClick={cycleTheme}>
            <ThemeIcon theme={activeTheme} />
          </button>
          <span className="sr-only" aria-live="polite">Tema {theme === "system" ? `automático, ${activeTheme === "dark" ? "escuro" : "claro"}` : theme === "dark" ? "escuro" : "claro"}</span>
          <Link className="button button-small button-primary header-action" to="/builder" aria-label="Montar time">
            <span className="header-action-wide" aria-hidden="true">Montar time</span>
            <span className="header-action-compact" aria-hidden="true">Time</span>
          </Link>
        </div>
      </header>

      <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>{children}</main>

      <nav className="mobile-primary-nav" aria-label="Navegação rápida">
        {navigation.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-nav-link${isActive ? " is-active" : ""}`}>
            <NavigationIcon name={item.icon} />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
        <CommunityMenu onOpenSearch={openSearch} />
      </nav>

      {searchMounted ? <Suspense fallback={null}><GlobalSearch open={searchOpen} onClose={closeSearch} /></Suspense> : null}

      <footer className="site-footer">
        <span>Projeto de fã independente, sem vínculo oficial.</span>
        <span>Dados gerais: <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokéAPI</a>.</span>
      </footer>
    </div>
  );
}
