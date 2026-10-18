import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell.jsx";

const BuilderPage = lazy(() => import("./pages/BuilderPage.jsx").then((module) => ({ default: module.BuilderPage })));
const DamageCalculatorPage = lazy(() => import("./pages/DamageCalculatorPage.jsx").then((module) => ({ default: module.DamageCalculatorPage })));
const DexDetailPage = lazy(() => import("./pages/DexDetailPage.jsx").then((module) => ({ default: module.DexDetailPage })));
const DexPage = lazy(() => import("./pages/DexPage.jsx").then((module) => ({ default: module.DexPage })));
const HomePage = lazy(() => import("./pages/HomePage.jsx").then((module) => ({ default: module.HomePage })));
const UsagePage = lazy(() => import("./pages/UsagePage.jsx").then((module) => ({ default: module.UsagePage })));
const RoomsPage = lazy(() => import("./pages/RoomsPage.jsx").then((module) => ({ default: module.RoomsPage })));
const RoomJoinPage = lazy(() => import("./pages/RoomsPage.jsx").then((module) => ({ default: module.RoomJoinPage })));
const RoomDetailPage = lazy(() => import("./pages/RoomsPage.jsx").then((module) => ({ default: module.RoomDetailPage })));

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
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/calculator" element={<DamageCalculatorPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/rooms/join" element={<RoomJoinPage />} />
          <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
