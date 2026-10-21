Warning: truncated output (original token count: 32806)
Total output lines: 1988

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const args = process.argv.slice(2);
const fastMode = args.includes("--fast") || args.includes("--quick");
const pageFlagIndex = args.findIndex((argument) => argument === "--pages" || argument === "--screens");
const pageFlag = args.find((argument) => argument.startsWith("--pages=") || argument.startsWith("--screens="));
const requestedPageList = process.env.VISUAL_REVIEW_PAGES
  || (pageFlag ? pageFlag.slice(pageFlag.indexOf("=") + 1) : pageFlagIndex >= 0 ? args[pageFlagIndex + 1] : "");
if (requestedPageList && !fastMode) {
  throw new Error("A seleção de telas só está disponível no modo rápido (--fast). O modo completo sempre roda todas as telas.");
}
const reviewStartedAt = Date.now();
const outputDir = resolve(process.env.VISUAL_OUTPUT_DIR || join(root, fastMode ? "artifacts/visual-review-fast" : "artifacts/visual-review"));
const baseUrl = "http://127.0.0.1:4173";
const spindaFaviconUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/7a7d66b1620e646f69afd48dc1273da9033ede9c/sprites/pokemon/versions/generation-v/black-white/327.png";
const observations = [];
const failures = [];
const accessibilityIssues = [];
const quickScreenRegistry = {
  home: "/",
  dex: "/dex",
  pokemon: "/dex/garchomp-mega-z",
  usage: "/usage?pokemon=Garchomp",
  builder: "/builder",
  calculator: "/calculator",
  speed: "/speed-tiers?target=garchomp-mega-z",
  rooms: "/rooms",
  tournaments: "/tournaments",
};
const quickAliases = { pokedex: "dex", detail: "pokemon", "dex-detail": "pokemon", "speed-tiers": "speed" };
const requestedQuickPages = requestedPageList
  ? requestedPageList.split(",").map((page) => quickAliases[page.trim()] || page.trim()).filter(Boolean)
  : Object.keys(quickScreenRegistry);
const unknownQuickPages = requestedQuickPages.filter((page) => !Object.hasOwn(quickScreenRegistry, page));
if (unknownQuickPages.length) {
  throw new Error("Telas desconhecidas no modo rápido: " + unknownQuickPages.join(", ") + ". Opções: " + Object.keys(quickScreenRegistry).join(", ") + ".");
}
const selectedQuickPages = [...new Set(requestedQuickPages)];
const representativeCaptures = new Set([
  "home",
  "pokedex-loaded-more",
  "pokedex-base-stat-filter-open",
  "pokedex-empty",
  "pokemon-sheet",
  "pokemon-sprite-unavailable",
  "pokemon-evolution",
  "pokemon-alolan-raichu-evolution",
  "pokemon-form-learnset-empty",
  "pokemon-learnset-filtered",
  "usage-battle-data",
  "usage-index-loading",
  "usage-empty",
  "usage-battle-data-error",
  "usage-metaroll-empty",
  "usage-metaroll-error",
  "usage-metaroll-mega-error",
  "usage-ladder",
  "builder-empty",
  "builder-empty-speed-target",
  "builder-account-save-error",
  "builder-six-members-first-fold",
  "builder-nature-before",
  "builder-nature-picker-open",
  "builder-nature-after",
  "builder-six-speed-vs-mega-garchomp-z",
  "builder-speed-budget-nature",
  "calculator-comparison",
  "calculator-comparison-rolls",
  "calculator-one-v-many",
  "calculator-team-vs-one",
  "calculator-team-vs-one-first-fold",
  "calculator-team-vs-one-team",
  "calculator-empty-choice",
  "speed-tiers-mega-garchomp-z",
  "speed-tiers-target-nature-open",
  "speed-tiers-mega-garchomp-z-results",
  "room-state-flow",
  "rooms-signed-out",
  "rooms-api-error",
  "rooms-empty",
  "tournament-state-flow",
  "tournaments-empty",
  "tournaments-api-error",
]);

await mkdir(outputDir, { recursive: true });

async function markProgress(viewport, name, stage) {
  await writeFile(join(outputDir, "progress.json"), JSON.stringify({
    viewport,
    name,
    stage,
    updatedAt: new Date().toISOString(),
  }, null, 2));
}

const server = spawn(process.execPath, [
  join(root, "node_modules/vite/bin/vite.js"), "preview",
  "--host", "127.0.0.1", "--port", "4173", "--strictPort",
], { cwd: join(root, "apps/web"), stdio: "inherit" });
const apiServer = !fastMode && process.env.DATABASE_URL ? spawn(process.execPath, [
  join(root, "apps/api/src/server.js"),
], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    APP_ENV: "test",
    APP_ORIGIN: baseUrl,
    API_HOST: "127.0.0.1",
    API_PORT: "8787",
  },
}) : null;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("A prévia Vite terminou antes de ficar pronta.");
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // A prévia ainda está inicializando.
    }
    await delay(500);
  }
  throw new Error("A prévia Vite não respondeu em 30 segundos.");
}

async function waitForApi() {
  if (!apiServer) return;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (apiServer.exitCode !== null) throw new Error("A API comunitária terminou antes de ficar pronta.");
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // A API ainda está inicializando.
    }
    await delay(500);
  }
  throw new Error("A API comunitária não respondeu em 30 segundos.");
}

async function waitForUsage(page, selector = ".usage-index-note, .usage-index-error") {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: 35_000 });
  } catch {
    const state = await page.locator("body").innerText({ timeout: 5_000 });
    failures.push(`Usage não chegou a um estado de sucesso ou erro: ${state.slice(0, 240)}`);
  }
}

async function capture(page, viewport, name, { audit = false, fullPage = true } = {}) {
  const file = join(outputDir, `${viewport}-${name}.png`);
  await markProgress(viewport, name, "screenshot-start");
  await page.screenshot({ path: file, fullPage, animations: "disabled" });
  await markProgress(viewport, name, "screenshot-complete");
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    title: document.title,
  }));
  const overflow = Math.max(metrics.documentWidth, metrics.bodyWidth) - metrics.viewportWidth;
  observations.push({ viewport, name, file: file.split("/").at(-1), ...metrics, overflow });
  if (overflow > 1) failures.push(`${viewport}/${name} tem ${overflow}px de overflow horizontal.`);

  if (audit) {
    const contrast = await page.evaluate(() => {
      const luminance = (value) => {
        const [red, green, blue] = value.match(/[0-9.]+/g).slice(0, 3).map(Number).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const ratio = (foreground, background) => {
        const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
        return Number(((values[0] + 0.05) / (values[1] + 0.05)).toFixed(2));
      };
      const visible = (element) => {
        const style = getComputedStyle(element);
        return element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
      };
      const opaqueBackground = (element) => {
        for (let current = element; current; current = current.parentElement) {
          const image = getComputedStyle(current).backgroundImage;
          const gradientColor = image.match(/rgba?\([\d.,%\s]+\)/i)?.[0] || image.match(/#[0-9a-f]{6}/i)?.[0];
          if (gradientColor) {
            const channels = gradientColor.startsWith("#")
              ? [1, 3, 5].map((offset) => Number.parseInt(gradientColor.slice(offset, offset + 2), 16))
              : gradientColor.match(/[\d.]+/g).slice(0, 3).map(Number);
            return `rgb(${channels.join(", ")})`;
          }
          const color = getComputedStyle(current).backgroundColor;
          const channels = color.match(/[0-9.]+/g) || [];
          const alpha = channels.length > 3 ? Number(channels[3]) : 1;
          if (alpha >= 0.99) return color;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const checks = [
        ["navegação desktop", ".site-header .primary-nav .nav-link:not(.is-active)"],
        ["navegação mobile", ".mobile-primary-nav .mobile-nav-link:not(.is-active)"],
        ["atribuição no rodapé", ".site-footer a"],
      ];
      return checks.flatMap(([label, textSelector]) => {
        const text = [...document.querySelectorAll(textSelector)].find(visible);
        if (!text) return [];
        const foregroundColor = getComputedStyle(text).color;
        const backgroundColor = opaqueBackground(text);
        return [{ label, ratio: ratio(foregroundColor, backgroundColor), foregroundColor, backgroundColor }];
      });
    });
    observations.push({ viewport, name, contrast });
    for (const check of contrast) {
      if (check.ratio < 4.5) failures.push(`${viewport}/${name}: contraste ${check.ratio}:1 em ${check.label}.`);
    }

    await markProgress(viewport, name, "axe-start");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    await markProgress(viewport, name, "axe-complete");
    if (result.violations.length) {
      accessibilityIssues.push({
        viewport,
        name,
        violations: result.violations.map((issue) => ({
          id: issue.id,
          impact: issue.impact,
          description: issue.description,
          help: issue.help,
          nodes: issue.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
        })),
      });
    }
  }
}

async function safeCapture(page, viewport, name, options) {
  if (!representativeCaptures.has(name)) return;
  try {
    await capture(page, viewport, name, options);
    await markProgress(viewport, name, "capture-complete");
  } catch (error) {
    await markProgress(viewport, name, "capture-error");
    failures.push(`${viewport}/${name}: ${error.message}`);
  }
}

async function warmVisibleListSprites(page, selector, viewportHeight = 800) {
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let y = 0; y <= maxScroll; y += Math.max(240, Math.floor(viewportHeight * 0.75))) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(60);
  }
  await page.waitForFunction((imageSelector) => [...document.querySelectorAll(imageSelector)].every((image) => image.complete), selector, { timeout: 15_000 }).catch(() => {});
  const spriteState = await page.locator(selector).evaluateAll((images) => ({
    total: images.length,
    loaded: images.filter((image) => image.complete && image.naturalWidth > 0).length,
    failed: images.filter((image) => image.complete && image.naturalWidth === 0).length,
  }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  return spriteState;
}

async function waitForSpritePaint(page, selector, includeOffscreen = false) {
  await page.locator(selector).evaluateAll((images, includeAll) => {
    const targets = includeAll ? images : images.filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.bottom >= 0 && rect.top <= window.innerHeight;
    });
    return Promise.all(targets.map((image) => Promise.race([
      image.decode().catch(() => {}),
      new Promise((resolve) => window.setTimeout(resolve, 1_000)),
    ])));
  }, includeOffscreen);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function waitForEither(page, selector, timeout = 35_000) {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: timeout });
    return true;
  } catch {
    return false;
  }
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function inspectCommunityHierarchy(page, viewportName, kind, dataMode) {
  const hierarchy = await page.evaluate(() => {
    const step = document.querySelector(".community-next-step");
    const participants = document.querySelector(".participant-list");
    const grid = document.querySelector(".community-room-grid");
    const invite = document.querySelector(".community-invite-panel");
    return {
      nextStepTop: step?.getBoundingClientRect().top,
      participantsTop: participants?.getBoundingClientRect().top,
      nextStepBeforeGrid: Boolean(step && grid && (step.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)),
      inviteAfterGrid: Boolean(invite && grid && (grid.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING)),
      championsMentions: [...document.querySelectorAll(".community-game-context")].filter((element) => element.innerText.includes("Pokémon Champions")).length,
    };
  });
  observations.push({ viewport: viewportName, name: `${kind}-state-before-forms`, ...hierarchy, dataMode });
  if (!hierarchy.nextStepBeforeGrid || hierarchy.nextStepTop >= hierarchy.participantsTop) failures.push(`${viewportName}/${kind}: estado e próxima ação não aparecem antes da lista de participantes.`);
  if (hierarchy.championsMentions !== 1) failures.push(`${viewportName}/${kind}: o contexto da partida deve aparecer uma vez.`);
  return hierarchy;
}

async function captureCommunityState(context, viewport, viewportName, kind) {
  const page = await context.newPage();
  const hostId = "00000000-0000-4000-8000-000000000001";
  const participantIds = [
    hostId,
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
    "00000000-0000-4000-8000-000000000004",
  ];
  const members = participantIds.map((id, index) => ({
    id,
    handle: ["DoublesCoach", "Marina", "Ren", "Kai"][index],
    status: "checked_in",
    checkedInAt: "2026-10-18T12:00:00.000Z",
    seed: null,
    friendCode: null,
    sharedRoster: index === 1 ? [{ pokemonId: "garchomp", formSlug: "garchomp" }, null, null, null, null, null] : null,
  }));

  await page.route("**/api/auth/status", (route) => fulfillJson(route, { githubOAuthAvailable: false, friendCodesAvailable: false }));
  await page.route("**/api/me", (route) => fulfillJson(route, { user: { id: hostId, handle: "DoublesCoach", isModerator: false } }));
  await page.route("**/api/teams", (route) => fulfillJson(route, { teams: [] }));

  let url;
  if (kind === "room") {
    const roomId = "visual-room";
    const roomView = {
      room: { id: roomId, name: "Sala de revisão", status: "in_progress", capacity: 2, hostId, createdAt: "2026-10-18T12:00:00.000Z", inviteExpiresAt: "2026-10-25T12:00:00.000Z" },
      currentUser: { id: hostId, role: "host", memberStatus: "checked_in" },
      members: members.slice(0, 2),
      match: {
        id: "00000000-0000-4000-8000-000000000010",
        status: "scheduled",
        playerA: { id: hostId, handle: "DoublesCoach" },
        playerB: { id: participantIds[1], handle: "Marina" },
        report: null,
        dispute: null,
      },
    };
    await page.route(`**/api/rooms/${roomId}`, (route) => fulfillJson(route, roomView));
    url = `${baseUrl}/rooms/${roomId}`;
  } else {
    const tournamentId = "visual-tournament";
    const tournamentView = {
      tournament: { id: tournamentId, name: "Chave de sábado", status: "open", capacity: 4, hostId, bracketVersion: 0, championId: null, createdAt: "2026-10-18T12:00:00.000Z", inviteExpiresAt: "2026-10-25T12:00:00.000Z", startedAt: null, finishedAt: null },
      currentUser: { id: hostId, role: "host", memberStatus: "checked_in" },
      participantCount: 4,
      members,
      matches: [],
    };
    await page.route(`**/api/tournaments/${tournamentId}`, (route) => fulfillJson(route, tournamentView));
    url = `${baseUrl}/tournaments/${tournamentId}`;
  }

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator(".community-next-step").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".participant-list").waitFor({ state: "visible", timeout: 10_000 });
  const hierarchy = await inspectCommunityHierarchy(page, viewportName, kind, "API-shaped visual fixture");
  if (kind === "room") {
    await page.getByText("Aguardando resultado", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByLabel("Vencedor informado").waitFor({ state: "visible", timeout: 10_000 });
  } else {
    await page.getByRole("button", { name: "Fechar inscrições" }).waitFor({ state: "visible", timeout: 10_000 });
    if (!hierarchy.inviteAfterGrid) failures.push(`${viewportName}/tournament: a ação secundária de convite deve vir depois de participantes e chaveamento.`);
  }
  await safeCapture(page, viewportName, `${kind}-state-flow`, { audit: true, fullPage: false });
  await page.close();
}

async function runViewport(viewportName, viewport) {
  console.log(`Visual review: start ${viewportName} at ${viewport.width}×${viewport.height}.`);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600, reducedMotion: "reduce" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator(".home-hero").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("heading", { name: "Prepare seu próximo time.", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  if (viewportName === "desktop") {
    const declaredFavicon = await page.locator('link[rel="icon"]').getAttribute("href");
    assert.equal(declaredFavicon, spindaFaviconUrl, "favicon deve usar a mesma URL versionada do sprite Spinda Black/White");
    const faviconImage = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      try {
        await Promise.race([
          image.decode(),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error("tempo esgotado")), 10_000)),
        ]);
        return { complete: image.complete, width: image.naturalWidth, height: image.naturalHeight };
      } catch (error) {
        return { complete: image.complete, width: image.naturalWidth, height: image.naturalHeight, error: error.message };
      }
    }, declaredFavicon);
    observations.push({ viewport: viewportName, name: "spinda-favicon", href: declaredFavicon, ...faviconImage });
    assert.ok(faviconImage.complete && faviconImage.width > 0 && faviconImage.height > 0, `o navegador não conseguiu exibir o favicon remoto: ${faviconImage.error || "imagem vazia"}`);
  }
  await safeCapture(page, viewportName, "home", { audit: true, fullPage: viewport.width > 720 });

  await page.goto(`${baseUrl}/rooms`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Salas privadas" }).waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(page, viewportName, "rooms-signed-out", { audit: true });
  const unavailablePage = await context.newPage();
  await unavailablePage.route("**/api/auth/status", (route) => route.abort());
  await unavailablePage.goto(`${baseUrl}/rooms`, { waitUntil: "domcontentloaded" });
  await unavailablePage.locator(".community-auth-card .community-error").waitFor({ state: "visible", timeout: 10_000 });
  const authUnavailableCopy = await unavailablePage.locator(".community-auth-card .community-config-note").innerText();
  assert.equal(authUnavailableCopy, "Não foi possível verificar o acesso com GitHub. Tente novamente.", "a indisponibilidade do login deve orientar a pessoa sem expor detalhes internos de configuração");
  observations.push({ viewport: viewportName, name: "rooms-auth-unavailable-copy", text: authUnavailableCopy });
  await safeCapture(unavailablePage, viewportName, "rooms-api-error", { audit: true });
  await unavailablePage.close();
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => ({
    className: document.activeElement?.className,
    text: document.activeElement?.textContent?.trim(),
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
  }));
  observations.push({ viewport: viewportName, name: "keyboard-first-focus", ...firstFocus });
  if (!String(firstFocus.className).includes("skip-link") || firstFocus.outlineWidth === "0px") {
    failures.push(`${viewportName}: o primeiro foco de teclado não mostra o link de salto com contorno.`);
  }
  await safeCapture(page, viewportName, "home-keyboard-focus");

  let dexLinkFocus;
  for (let tab = 0; tab < 12; tab += 1) {
    await page.keyboard.press("Tab");
    dexLinkFocus = await page.evaluate(() => ({
      href: document.activeElement?.getAttribute("href"),
      label: document.activeElement?.textContent?.trim(),
      outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
      outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    }));
    if (dexLinkFocus.href === "/dex") break;
  }
  observations.push({ viewport: viewportName, name: "keyboard-dex-link-focus", ...dexLinkFocus });
  if (dexLinkFocus?.href !== "/dex" || dexLinkFocus.outlineWidth === "0px" || dexLinkFocus.outlineStyle === "none") {
    failures.push(`${viewportName}: não foi possível focar Pokédex com contorno visível pelo teclado.`);
  } else {
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Pokédex" }).waitFor({ state: "visible", timeout: 10_000 });
  }

  await page.goto(`${baseUrl}/dex`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Pokédex" }).waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(page, viewportName, "pokedex", { audit: true, fullPage: viewport.width > 720 });
  const initialCardCount = await page.locator(".pokemon-card").count();
  const catalogCount = Number((await page.locator(".results-line strong").innerText()).replace(/\D/g, ""));
  observations.push({ viewport: viewportName, name: "pokedex-progressive-loading", initialCardCount, catalogCount });
  if (initialCardCount >= catalogCount) failures.push(`${viewportName}: a Pokédex renderizou o catálogo inteiro em vez de usar lotes.`);
  if (await page.locator(".pagination").count()) failures.push(`${viewportName}: a paginação antiga ainda aparece na Pokédex.`);
  await page.locator(".dex-scroll-sentinel").scrollIntoViewIfNeeded();
  await page.waitForFunction((count) => document.querySelectorAll(".pokemon-card").length > count, initialCardCount, { timeout: 10_000 });
  const loadedCardCount = await page.locator(".pokemon-card").count();
  if (loadedCardCount <= initialCardCount || loadedCardCount >= catalogCount) {
    failures.push(`${viewportName}: o carregamento progressivo não adicionou um lote limitado de Pokémon.`);
  }
  const dexSpriteState = await warmVisibleListSprites(page, ".pokemon-card-art .pokemon-art img", viewport.height);
  observations.push({ viewport: viewportName, name: "pokedex-loaded-batch-sprites", ...dexSpriteState });
  await safeCapture(page, viewportName, "pokedex-loaded-more", { audit: true, fullPage: viewport.width > 720 });
  await page.locator(".pokemon-card").nth(Math.max(initialCardCount, loadedCardCount - 6)).scrollIntoViewIfNeeded();
  await safeCaptur…20806 tokens truncated…feCapture(page, viewportName, "speed-tiers-mega-garchomp-z", { audit: true, fullPage: false });
  await page.locator(".speed-result-row").first().scrollIntoViewIfNeeded();
  await safeCapture(page, viewportName, "speed-tiers-mega-garchomp-z-results", { audit: true, fullPage: false });

  await captureCommunityState(context, viewport, viewportName, "room");
  await captureCommunityState(context, viewport, viewportName, "tournament");

  if (process.env.DATABASE_URL && viewportName === "desktop") {
    const signIn = await context.request.post(`${baseUrl}/api/test/session`, {
      headers: { Origin: baseUrl },
      data: { handle: `visual-${viewportName}` },
    });
    if (!signIn.ok()) {
      failures.push(`${viewportName}: a sessão de teste para a sala não foi criada (${signIn.status()}).`);
    } else {
      const hostSession = await signIn.json();
      const shareableTeam = { ...exportedTeam, name: "Time compartilhado" };
      const savedTeamResponse = await context.request.post(`${baseUrl}/api/teams`, {
        headers: { Origin: baseUrl },
        data: { visibility: "private", data: shareableTeam },
      });
      let sharedTeamId = "";
      if (!savedTeamResponse.ok()) {
        failures.push(`${viewportName}: não foi possível preparar a equipe para testar o compartilhamento (${savedTeamResponse.status()}).`);
      } else {
        sharedTeamId = (await savedTeamResponse.json()).team.id;
      }
      await page.goto(`${baseUrl}/rooms`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Suas salas" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(page, viewportName, "rooms-empty", { audit: true });
      await page.getByLabel("Nome da sala").fill("Revisão visual");
      await page.getByRole("button", { name: "Criar sala privada" }).click();
      await page.getByRole("heading", { name: "Revisão visual" }).waitFor({ state: "visible", timeout: 10_000 });
      await page.locator('[aria-label="Link de convite"]').waitFor({ state: "visible", timeout: 10_000 });
      await page.locator(".community-next-step").waitFor({ state: "visible", timeout: 10_000 });
      const roomHierarchy = await inspectCommunityHierarchy(page, viewportName, "room-live-test-db", "ephemeral PostgreSQL integration fixture");
      if (!roomHierarchy.inviteAfterGrid) failures.push(`${viewportName}/room: painel de convite aparece antes de participantes e resultado.`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await safeCapture(page, viewportName, "room-live-first-fold", { audit: true, fullPage: false });
      if (sharedTeamId) {
        await page.locator(".event-team-sharing-controls select").selectOption(sharedTeamId);
        await page.getByRole("button", { name: "Compartilhar", exact: true }).click();
        await page.getByRole("img", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
        await safeCapture(page, viewportName, "rooms-shared-roster-host", { audit: true });
      }
      const inviteUrl = await page.locator('[aria-label="Link de convite"]').inputValue();
      await safeCapture(page, viewportName, "rooms-invite", { audit: true });

      const guestContext = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const guestPage = await guestContext.newPage();
      guestPage.on("pageerror", (error) => pageErrors.push(error.message));
      const inviteToken = new URL(inviteUrl).hash.slice(1);
      await guestPage.goto(`${baseUrl}/rooms/join#${inviteToken}`, { waitUntil: "domcontentloaded" });
      await guestPage.getByRole("heading", { name: "Entrar na sala" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(guestPage, viewportName, "rooms-join-signin", { audit: true });
      const inviteHeldInTab = await guestPage.evaluate(() => window.sessionStorage.getItem("spinda_pending_invite")?.length > 0 && !window.location.hash);
      if (!inviteHeldInTab) failures.push(`${viewportName}: o convite sem login não foi preservado fora da URL.`);
      const guestSession = await guestContext.request.post(`${baseUrl}/api/test/session`, {
        headers: { Origin: baseUrl },
        data: { handle: `visual-guest-${viewportName}` },
      });
      if (!guestSession.ok()) failures.push(`${viewportName}: a sessão de convidado para a sala não foi criada.`);
      const guest = guestSession.ok() ? await guestSession.json() : null;
      await guestPage.goto(`${baseUrl}/rooms`, { waitUntil: "domcontentloaded" });
      await guestPage.getByRole("heading", { name: "Revisão visual" }).waitFor({ state: "visible", timeout: 10_000 });
      if (sharedTeamId) {
        await guestPage.getByRole("img", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
        await safeCapture(guestPage, viewportName, "rooms-shared-roster-guest", { audit: true });
      }
      await guestPage.getByRole("button", { name: "Fazer check-in" }).click();
      await page.getByRole("button", { name: "Fazer check-in" }).click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Fechar inscrições" }).click();
      await page.getByRole("button", { name: "Iniciar sala" }).click();
      await page.getByRole("heading", { name: "Resultado" }).waitFor({ state: "visible", timeout: 10_000 });
      await page.getByLabel("Vencedor informado").selectOption(guest?.user?.id || "");
      await page.getByRole("button", { name: "Registrar resultado" }).click();
      await guestPage.reload({ waitUntil: "domcontentloaded" });
      await guestPage.getByRole("button", { name: "Confirmar resultado" }).click();
      await guestPage.getByText("Resultado confirmado", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("Resultado confirmado", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(page, viewportName, "rooms-complete", { audit: true });
      await safeCapture(guestPage, viewportName, "rooms-confirm-result", { audit: true });
      await guestContext.close();

      await page.goto(`${baseUrl}/tournaments`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Seus torneios" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(page, viewportName, "tournaments-empty", { audit: true });
      const tournamentsErrorPage = await context.newPage();
      await tournamentsErrorPage.route("**/api/tournaments", (route) => route.abort()).catch(() => {});
      await tournamentsErrorPage.goto(`${baseUrl}/tournaments`, { waitUntil: "domcontentloaded" });
      await tournamentsErrorPage.getByRole("heading", { name: "Não foi possível carregar" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(tournamentsErrorPage, viewportName, "tournaments-api-error", { audit: true });
      await tournamentsErrorPage.close();

      await page.getByLabel("Nome do torneio").fill("Chave visual Doubles");
      await page.getByRole("button", { name: "Criar torneio" }).click();
      await page.getByRole("heading", { name: "Chave visual Doubles" }).waitFor({ state: "visible", timeout: 10_000 });
      await page.locator('[aria-label="Link de convite"]').waitFor({ state: "visible", timeout: 10_000 });
      await page.locator(".community-next-step").waitFor({ state: "visible", timeout: 10_000 });
      const tournamentHierarchy = await inspectCommunityHierarchy(page, viewportName, "tournament-live-test-db", "ephemeral PostgreSQL integration fixture");
      if (!tournamentHierarchy.inviteAfterGrid) failures.push(`${viewportName}/tournament: painel de convite aparece antes de participantes e chaveamento.`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await safeCapture(page, viewportName, "tournament-live-first-fold", { audit: true, fullPage: false });
      const tournamentInviteUrl = await page.locator('[aria-label="Link de convite"]').inputValue();
      const tournamentId = page.url().split("/").at(-1);
      const tournamentToken = new URL(tournamentInviteUrl).hash.slice(1);
      await safeCapture(page, viewportName, "tournament-invite", { audit: true });

      const tournamentJoinContext = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const tournamentJoinPage = await tournamentJoinContext.newPage();
      await tournamentJoinPage.goto(`${baseUrl}/tournaments/join#${tournamentToken}`, { waitUntil: "domcontentloaded" });
      await tournamentJoinPage.getByRole("heading", { name: "Entrar no torneio" }).waitFor({ state: "visible", timeout: 10_000 });
      await tournamentJoinPage.getByRole("heading", { name: "Entre para organizar ou aceitar um convite" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(tournamentJoinPage, viewportName, "tournament-join-signin", { audit: true });
      const inviteStorageState = await tournamentJoinPage.evaluate(() => ({
        token: window.sessionStorage.getItem("spinda_pending_tournament_invite"),
        hash: window.location.hash,
      }));
      if (inviteStorageState.token !== tournamentToken || inviteStorageState.hash) failures.push(`${viewportName}: o convite do torneio não foi guardado em sessão nem removido da URL.`);
      await tournamentJoinContext.close();

      const playerContexts = new Map([[hostSession.user.id, context]]);
      for (let playerIndex = 0; playerIndex < 3; playerIndex += 1) {
        const playerContext = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
        const playerSession = await playerContext.request.post(`${baseUrl}/api/test/session`, {
          headers: { Origin: baseUrl },
          data: { handle: `visual-bracket-${playerIndex}-${viewportName}` },
        });
        if (!playerSession.ok()) failures.push(`${viewportName}: a sessão do participante ${playerIndex + 1} não foi criada.`);
        const player = playerSession.ok() ? await playerSession.json() : null;
        if (player) {
          playerContexts.set(player.user.id, playerContext);
          const joined = await playerContext.request.post(`${baseUrl}/api/tournaments/join`, { headers: { Origin: baseUrl }, data: { inviteToken: tournamentToken } });
          if (!joined.ok()) failures.push(`${viewportName}: o participante ${playerIndex + 1} não entrou no torneio.`);
        }
      }
      for (const [participantId, playerContext] of playerContexts) {
        const checkedIn = await playerContext.request.post(`${baseUrl}/api/tournaments/${tournamentId}/check-in`, { headers: { Origin: baseUrl }, data: {} });
        if (!checkedIn.ok()) failures.push(`${viewportName}: participante ${participantId} não conseguiu fazer check-in.`);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Fechar inscrições" }).click();
      await page.getByRole("button", { name: "Sortear e iniciar" }).waitFor({ state: "visible", timeout: 10_000 });
      await page.getByRole("button", { name: "Sortear e iniciar" }).click();
      await page.getByRole("heading", { name: "Semifinais" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(page, viewportName, "tournament-semifinals", { audit: true });

      const getTournament = async () => {
        const response = await context.request.get(`${baseUrl}/api/tournaments/${tournamentId}`);
        assert.equal(response.ok(), true, "host deve conseguir consultar o chaveamento");
        return response.json();
      };
      const reportAndConfirm = async (match) => {
        const reporterContext = playerContexts.get(match.playerA.id);
        const opponentContext = playerContexts.get(match.playerB.id);
        const report = await reporterContext.request.post(`${baseUrl}/api/matches/${match.id}/report`, { headers: { Origin: baseUrl }, data: { winnerId: match.playerA.id } });
        if (!report.ok()) failures.push(`${viewportName}: não foi possível relatar a partida ${match.id}.`);
        const confirm = await opponentContext.request.post(`${baseUrl}/api/matches/${match.id}/confirm`, { headers: { Origin: baseUrl }, data: {} });
        if (!confirm.ok()) failures.push(`${viewportName}: não foi possível confirmar a partida ${match.id}.`);
        return confirm.json();
      };
      let liveTournament = await getTournament();
      for (const semifinal of liveTournament.matches.filter((match) => match.roundNumber === 1)) await reportAndConfirm(semifinal);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Final" }).waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(page, viewportName, "tournament-final", { audit: true });
      liveTournament = await getTournament();
      const finalMatch = liveTournament.matches.find((match) => match.roundNumber === 2);
      await reportAndConfirm(finalMatch);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText(/Concluído/).first().waitFor({ state: "visible", timeout: 10_000 });
      await safeCapture(page, viewportName, "tournament-complete", { audit: true });
      for (const [participantId, playerContext] of playerContexts) if (participantId !== hostSession.user.id) await playerContext.close();

      await page.goto(`${baseUrl}/builder`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Equipes da conta" }).waitFor({ state: "visible", timeout: 10_000 });
      await page.locator('input[aria-label="Selecionar arquivo de equipe JSON"]').setInputFiles(exportedFile);
      await page.getByText("Equipe importada e salva neste navegador.").waitFor({ state: "visible", timeout: 10_000 });
      const teamSaveResponses = [];
      page.on("response", (response) => {
        if (response.url().includes("/api/teams") && response.request().method() === "POST") {
          teamSaveResponses.push(response.status());
        }
      });
      await page.getByRole("button", { name: "Salvar cópia na conta" }).click();
      await waitForEither(page, ".account-team-row, .community-inline-error", 10_000);
      if (!(await page.locator(".account-team-row").count())) {
        const accountText = await page.locator(".team-account-panel").innerText();
        failures.push(`${viewportName}: não foi possível salvar uma cópia do time (POST ${teamSaveResponses.join(",") || "sem resposta"}): ${accountText.slice(0, 180)}`);
        await safeCapture(page, viewportName, "builder-account-save-error", { audit: true });
      }
      if (await page.locator(".account-team-row").count()) {
        const accountTeamRow = page.locator(".account-team-row").first();
        await accountTeamRow.waitFor({ state: "visible", timeout: 10_000 });
        await safeCapture(page, viewportName, "builder-account-team", { audit: true });
        await accountTeamRow.locator(".account-team-visibility").selectOption("public");
        await accountTeamRow.getByRole("button", { name: "Atualizar" }).click();
        await accountTeamRow.locator(".account-team-summary span").filter({ hasText: "Pública" }).waitFor({ state: "visible", timeout: 10_000 });
        await safeCapture(page, viewportName, "builder-account-public", { audit: true });
      }
    }
  }

  if (pageErrors.length) failures.push(`${viewportName}: erros no app: ${pageErrors.join(" | ")}`);
  await context.close();
  console.log(`Visual review: end ${viewportName}; ${observations.length} observations, ${failures.length} failures so far.`);
}

async function runFastViewport(viewportName, viewport) {
  console.log("Visual review fast: start " + viewportName + " at " + viewport.width + "×" + viewport.height + " for " + selectedQuickPages.join(", ") + ".");
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
    reducedMotion: "reduce",
  });

  for (const screen of selectedQuickPages) {
    const page = await context.newPage();
    const applicationErrors = [];
    page.on("pageerror", (error) => applicationErrors.push(error.message));
    page.on("console", (message) => {
      const consoleText = message.text().toLowerCase();
      const expectedResourceFailure = consoleText.includes("failed to load resource")
        || consoleText.includes("net::err")
        || consoleText.includes("404 (not found)");
      if (message.type() === "error" && !expectedResourceFailure) {
        applicationErrors.push(message.text());
      }
    });

    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const payload = pathname.endsWith("/auth/status")
        ? { githubOAuthAvailable: false, friendCodesAvailable: false }
        : pathname === "/api/me"
          ? { user: null }
          : pathname === "/api/teams"
            ? { teams: [] }
            : pathname === "/api/rooms"
              ? { rooms: [] }
              : pathname === "/api/tournaments"
                ? { tournaments: [] }
                : { error: "API comunitária fora do escopo da revisão rápida." };
      await route.fulfill({
        status: pathname === "/api/me" ? 401 : 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    const path = quickScreenRegistry[screen];
    await page.goto(baseUrl + path, { waitUntil: "domcontentloaded" });
    const heading = page.locator("#main-content h1, #main-content h2").first();
    try {
      await heading.waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      failures.push(viewportName + "/" + screen + ": não encontrou título após abrir " + path + ".");
    }
    await page.waitForTimeout(100);
    const headingText = await heading.textContent().catch(() => "");
    await capture(page, viewportName, "quick-" + screen + "-first-fold", { audit: false, fullPage: false });

    await page.keyboard.press("Tab");
    const skipFocus = await page.evaluate(() => {
      const active = document.activeElement;
      const style = getComputedStyle(active);
      return {
        className: String(active?.className || ""),
        label: active?.textContent?.trim() || active?.getAttribute("aria-label") || "",
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        focusVisible: active?.matches(":focus-visible") || false,
      };
    });
    observations.push({ mode: "fast", viewport: viewportName, name: "quick-" + screen + "-skip-focus", heading: headingText?.trim(), ...skipFocus });
    if (!skipFocus.className.includes("skip-link") || skipFocus.outlineWidth === "0px" || skipFocus.outlineStyle === "none") {
      failures.push(viewportName + "/" + screen + ": o primeiro Tab não mostra o link de salto com foco visível.");
    }

    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const mainControl = await page.evaluate(() => {
      const active = document.activeElement;
      const main = document.querySelector("#main-content");
      const style = getComputedStyle(active);
      const rect = active?.getBoundingClientRect();
      const nav = document.querySelector(".mobile-primary-nav");
      const navStyle = nav ? getComputedStyle(nav) : null;
      const navRect = nav?.getBoundingClientRect();
      let decoration = false;
      for (let current = active; current; current = current.parentElement) {
        const currentStyle = getComputedStyle(current);
        if ((currentStyle.outlineStyle !== "none" && Number.parseFloat(currentStyle.outlineWidth) > 0)
          || currentStyle.boxShadow !== "none") {
          decoration = true;
          break;
        }
      }
      return {
        tag: active?.tagName || "",
        role: active?.getAttribute("role") || "",
        label: active?.getAttribute("aria-label") || active?.textContent?.trim() || "",
        insideMain: Boolean(main?.contains(active)),
        focusVisible: active?.matches(":focus-visible") || false,
        decoration,
        top: rect?.top,
        bottom: rect?.bottom,
        overlapsMobileNav: Boolean(nav && navStyle.display !== "none" && rect && navRect && rect.bottom > navRect.top && rect.top < navRect.bottom),
      };
    });
    observations.push({ mode: "fast", viewport: viewportName, name: "quick-" + screen + "-main-keyboard-focus", ...mainControl });
    if (!mainControl.insideMain || !mainControl.focusVisible || !mainControl.decoration) {
      failures.push(viewportName + "/" + screen + ": a navegação por teclado não chegou ao conteúdo com foco visual claro.");
    }
    if (mainControl.overlapsMobileNav) {
      failures.push(viewportName + "/" + screen + ": o foco do conteúdo ficou sob a navegação fixa.");
    }
    await capture(page, viewportName, "quick-" + screen + "-keyboard-focus", { audit: false, fullPage: false });

    if (applicationErrors.length) {
      observations.push({ mode: "fast", viewport: viewportName, name: "quick-" + screen + "-application-errors", errors: applicationErrors });
      failures.push(viewportName + "/" + screen + ": erro de aplicação: " + applicationErrors.join(" | "));
    }
    await page.close();
  }

  await context.close();
  console.log("Visual review fast: end " + viewportName + "; " + observations.length + " observations, " + failures.length + " failures so far.");
}

let browser;
try {
  await waitForServer();
  await waitForApi();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath(),
  });
  const fullViewports = [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
    ["mobile-320", { width: 320, height: 760 }],
    ["reflow-720", { width: 720, height: 960 }],
  ];
  const quickViewports = [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ];
  const viewports = fastMode ? quickViewports : fullViewports;
  for (const [name, viewport] of viewports) {
    try {
      if (fastMode) await runFastViewport(name, viewport);
      else await runViewport(name, viewport);
    } catch (error) {
      failures.push(`${name}: inspeção interrompida — ${error.message}`);
    }
  }

  const durationMs = Date.now() - reviewStartedAt;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: fastMode ? "fast-development-subset" : "full-gate",
    scope: fastMode
      ? "Selected screens at 1440 and 390 CSS px with screenshots, overflow, runtime errors, and keyboard focus checks. Not equivalent to the complete review."
      : "All existing scenarios at four widths, with axe, community flows, and PostgreSQL when DATABASE_URL is set.",
    durationMs,
    selectedScreens: fastMode ? selectedQuickPages : "all",
    axeIncluded: !fastMode,
    communityApiIncluded: !fastMode && Boolean(process.env.DATABASE_URL),
    viewports: viewports.map(([name, viewport]) => ({
      name,
      cssWidth: viewport.width,
    })),
    status: failures.length || accessibilityIssues.length ? "needs-review" : "passed",
    observations,
    accessibilityIssues,
    failures,
  };
  await writeFile(join(outputDir, "inspection.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("Visual review " + report.mode + " duration: " + (durationMs / 1000).toFixed(1) + "s.");
  console.log(JSON.stringify(report, null, 2));
  if (failures.length || accessibilityIssues.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (apiServer) apiServer.kill("SIGTERM");
  server.kill("SIGTERM");
}
