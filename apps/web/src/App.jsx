import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell.jsx";

const BuilderPage = lazy(() => import("./pages/BuilderPage.jsx").then((module) => ({ default: module.BuilderPage })));
const DexDetailPage = lazy(() => import("./pages/DexDetailPage.jsx").then((module) => ({ default: module.DexDetailPage })));
const DexPage = lazy(() => import("./pages/DexPage.jsx").then((module) => ({ default: module.DexPage })));
const HomePage = lazy(() => import("./pages/HomePage.jsx").then((module) => ({ default: module.HomePage })));

function NotFoundPage() {
  return (
    <section className="page-wrap narrow-page">
      <p className="page-label">Página não encontrada</p>
      <h1>Esse caminho não existe.</h1>
      <Link to="/" className="button button-primary">Voltar ao início</Link>
    </section>
  );
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<div className="page-wrap loading-state" role="status">Carregando tela…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dex" element={<DexPage />} />
          <Route path="/dex/:slug" element={<DexDetailPage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
