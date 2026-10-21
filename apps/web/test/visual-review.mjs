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
const apiServer = !fastMode && process.env.DATABASE_URL ? spawn("bun", [
  "--env-file-if-exists=.env",
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
  await safeCapture(page, viewportName, "pokedex-loaded-more-scrolled", { fullPage: false });
  const firstCardIdentity = await page.locator(".pokemon-card").first().evaluate((card) => ({
    number: card.querySelector(".pokemon-card-number")?.textContent?.trim(),
    name: card.querySelector(".pokemon-card-title")?.textContent?.trim(),
    hasType: Boolean(card.querySelector(".pokemon-card .type-tag")),
    hasStats: Boolean(card.querySelector(".quick-stats")),
  }));
  observations.push({ viewport: viewportName, name: "pokedex-row-identity", ...firstCardIdentity });
  if (!firstCardIdentity.number || !firstCardIdentity.name || !firstCardIdentity.hasType || firstCardIdentity.hasStats) {
    failures.push(`${viewportName}: a linha da Pokédex não mostra número, nome e tipo de forma compacta.`);
  }
  const search = page.getByRole("searchbox", { name: "Buscar espécie, forma ou número" });
  const dexTypeFilter = page.locator('.dex-toolbar .filter-field:has-text("Tipo") select');
  const dexGenerationFilter = page.locator('.dex-toolbar .filter-field:has-text("Geração") select');
  await dexTypeFilter.selectOption("dragon");
  await dexGenerationFilter.selectOption("4");
  await search.fill("Garchomp");
  await page.locator(".pokemon-card").first().waitFor({ state: "visible", timeout: 10_000 });
  const filteredCount = Number((await page.locator(".results-line strong").innerText()).replace(/\D/g, ""));
  const filteredNames = await page.locator(".pokemon-card-title").allTextContents();
  if (filteredCount < 1 || filteredNames.length !== filteredCount || filteredNames.some((name) => !name.includes("Garchomp"))) {
    failures.push(`${viewportName}: busca e filtros não consultaram o catálogo completo para Garchomp.`);
  }
  await page.locator(".pokemon-card-title").last().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll(".pokemon-card-art .pokemon-art")].every((art) => {
    if (art.classList.contains("is-fallback")) return Boolean(art.querySelector(".pokemon-art-fallback")?.textContent?.trim());
    const image = art.querySelector("img");
    return Boolean(image?.complete && image.naturalWidth > 0);
  }), null, { timeout: 10_000 });
  const formSpriteStates = await page.locator(".pokemon-card-art .pokemon-art").evaluateAll((elements) => elements.map((art) => ({
    state: art.classList.contains("is-fallback") ? "fallback" : "image",
    label: art.querySelector(".pokemon-art-fallback")?.textContent || "",
    src: art.querySelector("img")?.getAttribute("src") || "",
  })));
  observations.push({ viewport: viewportName, name: "pokedex-form-sprites-ready", sprites: formSpriteStates });
  await page.evaluate(() => window.scrollTo(0, 0));
  await safeCapture(page, viewportName, "pokedex-filtered", { fullPage: viewport.width > 720 });
  const statFilter = page.locator(".dex-stat-filter");
  await statFilter.locator("summary").click();
  await safeCapture(page, viewportName, "pokedex-base-stat-filter-open", { fullPage: false });
  const minimumBaseStatInput = statFilter.locator(".dex-stat-filter-fields input").first();
  const maximumBaseStatInput = statFilter.locator(".dex-stat-filter-fields input").nth(1);
  if (await maximumBaseStatInput.getAttribute("max") !== "1125") failures.push(`${viewportName}: o filtro do total base não aceita o maior total da forma no catálogo fixado.`);
  await minimumBaseStatInput.fill("700");
  await page.waitForFunction(() => document.querySelectorAll(".pokemon-card").length === 2);
  const baseStatFilteredNames = await page.locator(".pokemon-card-title").allTextContents();
  if (!baseStatFilteredNames.includes("Mega Garchomp") || !baseStatFilteredNames.includes("Mega Garchomp Z")) {
    failures.push(`${viewportName}: o limite de total base não filtrou as duas formas de Garchomp esperadas.`);
  }
  await minimumBaseStatInput.fill("");
  await page.locator(".dex-sort-field select").selectOption("number");
  await page.locator(".pokemon-card-title").first().click();
  await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(page, viewportName, "pokemon-sheet", { audit: true, fullPage: false });
  const missingSpritePage = await context.newPage();
  await missingSpritePage.route("https://raw.githubusercontent.com/PokeAPI/sprites/7a7d66b1620e646f69afd48dc1273da9033ede9c/sprites/pokemon/versions/generation-v/black-white/25.png", (route) => route.abort());
  await missingSpritePage.goto(`${baseUrl}/dex/pikachu`, { waitUntil: "domcontentloaded" });
  const missingSprite = missingSpritePage.locator(".detail-stage-art .pokemon-art");
  await missingSprite.waitFor({ state: "visible", timeout: 10_000 });
  await missingSpritePage.locator(".detail-stage-art .pokemon-art.is-fallback").waitFor({ state: "visible", timeout: 10_000 });
  const missingSpriteLabel = await missingSprite.getAttribute("aria-label");
  observations.push({ viewport: viewportName, name: "pokemon-sprite-unavailable-state", ariaLabel: missingSpriteLabel });
  if (!missingSpriteLabel?.includes("sprite indisponível")) failures.push(`${viewportName}: o sprite ausente deve informar seu estado pelo nome acessível.`);
  await safeCapture(missingSpritePage, viewportName, "pokemon-sprite-unavailable", { audit: true, fullPage: false });
  await missingSpritePage.close();
  const evolutionSection = page.locator(".detail-evolutions");
  await evolutionSection.waitFor({ state: "visible", timeout: 10_000 });
  const evolutionNames = await evolutionSection.locator(".evolution-list strong").allTextContents();
  if (!evolutionNames.includes("Gabite") || !evolutionNames.includes("Garchomp")) {
    failures.push(`${viewportName}: a ficha de Garchomp não mostrou sua relação evolutiva direta.`);
  }
  const evolutionText = await evolutionSection.innerText();
  if (!evolutionText.includes("Subir de nível") || !evolutionText.includes("Nível mínimo 48")) {
    failures.push(`${viewportName}: a ficha não exibiu método e nível mínimo da evolução de Garchomp conforme a revisão fixada.`);
  }
  if (viewport.width <= 370) {
    const currentNameHeight = await evolutionSection.locator(".evolution-list li.is-current strong").evaluate((element) => element.getBoundingClientRect().height);
    if (currentNameHeight > 22) failures.push(`${viewportName}: o nome da forma atual quebrou em linhas na lista evolutiva.`);
  }
  await evolutionSection.scrollIntoViewIfNeeded();
  await safeCapture(page, viewportName, "pokemon-evolution", { audit: true, fullPage: false });

  const learnsetSection = page.locator(".detail-learnsets");
  await learnsetSection.waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".detail-move-list").waitFor({ state: "visible", timeout: 15_000 });
  const learnsetFilters = learnsetSection.locator(".detail-learnset-filters");
  const learnsetSearch = learnsetFilters.locator('input[type="search"]');
  const formFilter = learnsetFilters.locator("select").nth(0);
  const versionFilter = learnsetFilters.locator("select").nth(1);
  const methodFilter = learnsetFilters.locator("select").nth(2);
  const typeFilter = learnsetFilters.locator("select").nth(3);
  const categoryFilter = learnsetFilters.locator("select").nth(4);
  await learnsetSearch.focus();
  await page.keyboard.press("Tab");
  if (!(await formFilter.evaluate((element) => element === document.activeElement))) {
    failures.push(`${viewportName}: os filtros de aprendibilidade não seguem a ordem de teclado apresentada.`);
  }
  await versionFilter.selectOption({ label: "Todos os jogos" });
  const clearMoveFilters = learnsetFilters.getByRole("button", { name: "Limpar filtros" });
  if (await clearMoveFilters.isDisabled()) failures.push(`${viewportName}: o filtro Todos os jogos não habilitou uma ação para voltar à versão padrão.`);
  await clearMoveFilters.click();
  if (await versionFilter.inputValue() === "") failures.push(`${viewportName}: Limpar filtros não restaurou a versão padrão da fonte.`);
  await formFilter.selectOption("garchomp-mega-z");
  await page.waitForURL("**/dex/garchomp-mega-z");
  await page.locator(".detail-learnset-empty").waitFor({ state: "visible", timeout: 10_000 });
  if (!(await page.locator("#pokemon-title").innerText()).includes("Mega Garchomp Z")) {
    failures.push(`${viewportName}: a busca de aprendibilidade não manteve o nome da forma selecionada.`);
  }
  await safeCapture(page, viewportName, "pokemon-form-learnset-empty", { fullPage: false });
  await page.locator(".detail-learnset-filters select").nth(0).selectOption("garchomp");
  await page.waitForURL("**/dex/garchomp");
  await page.locator(".detail-move-list").waitFor({ state: "visible", timeout: 10_000 });
  await versionFilter.selectOption({ label: "Scarlet / Violet" });
  await methodFilter.selectOption({ label: "Máquina" });
  await typeFilter.selectOption("ground");
  await categoryFilter.selectOption("physical");
  await learnsetSearch.fill("Earthquake");
  const selectedLearnsetRow = page.locator(".detail-move-list > li").filter({ hasText: "Earthquake" }).first();
  await selectedLearnsetRow.waitFor({ state: "visible", timeout: 10_000 });
  if (!(await selectedLearnsetRow.innerText()).includes("Máquina")) {
    failures.push(`${viewportName}: os filtros de jogo, método, tipo e categoria não localizaram Earthquake na forma selecionada.`);
  }
  const calculatorHref = await selectedLearnsetRow.locator(".detail-move-calc").getAttribute("href");
  if (calculatorHref !== "/calculator?attacker=Garchomp&move=Earthquake") {
    failures.push(`${viewportName}: a ação contextual do golpe não preservou espécie e golpe para a calculadora.`);
  }
  const calculatorAccessibleName = await selectedLearnsetRow.locator(".detail-move-calc").getAttribute("aria-label");
  if (!calculatorAccessibleName?.includes("Preparar cálculo") || !calculatorAccessibleName.includes("Earthquake")) {
    failures.push(`${viewportName}: o nome acessível do link contextual não inclui o texto visível e o golpe.`);
  }
  await learnsetSection.scrollIntoViewIfNeeded();
  await safeCapture(page, viewportName, "pokemon-learnset-filtered", { audit: true, fullPage: false });
  await page.locator(".detail-page .back-link").click();
  await page.getByRole("heading", { name: "Pokédex" }).waitFor({ state: "visible", timeout: 10_000 });
  const returnedDexState = await page.evaluate(() => ({
    query: document.querySelector('.dex-toolbar input[type="search"]')?.value,
    type: document.querySelector('.dex-toolbar .filter-field select')?.value,
    generation: document.querySelectorAll('.dex-toolbar .filter-field select')[1]?.value,
    scrollY: window.scrollY,
  }));
  observations.push({ viewport: viewportName, name: "pokedex-return-state", ...returnedDexState });
  if (returnedDexState.query !== "Garchomp" || returnedDexState.type !== "dragon" || returnedDexState.generation !== "4") {
    failures.push(`${viewportName}: a Pokédex perdeu busca ou filtros ao voltar da ficha.`);
  }
  await dexTypeFilter.selectOption("");
  await dexGenerationFilter.selectOption("");
  await search.fill("Mega Raichu");
  await page.waitForFunction(() => document.querySelectorAll(".pokemon-card").length === 2, null, { timeout: 10_000 });
  const megaRaichuCards = page.locator(".pokemon-card");
  const megaRaichuNames = await page.locator(".pokemon-card-title").allTextContents();
  if (megaRaichuNames.length !== 2 || !megaRaichuNames.some((name) => name.includes("Mega Raichu X")) || !megaRaichuNames.some((name) => name.includes("Mega Raichu Y"))) {
    failures.push(`${viewportName}: a Pokédex não distinguiu Mega Raichu X e Y na busca pelas formas de Z-A.`);
  }
  const megaRaichuSprites = [];
  for (let index = 0; index < await megaRaichuCards.count(); index += 1) {
    const card = megaRaichuCards.nth(index);
    await card.scrollIntoViewIfNeeded();
    const image = card.locator(".pokemon-card-art .pokemon-art img");
    await image.waitFor({ state: "attached", timeout: 10_000 });
    await page.waitForFunction((expected) => [...document.querySelectorAll(".pokemon-card")].some((entry) => {
      const img = entry.querySelector(".pokemon-card-art .pokemon-art img");
      return img?.getAttribute("src")?.endsWith(expected) && img.complete && img.naturalWidth === 512 && !img.closest(".pokemon-art")?.classList.contains("is-loading");
    }), index === 0 ? "10304.png" : "10305.png", { timeout: 15_000 });
    megaRaichuSprites.push(await image.evaluate((element) => ({
      src: element.getAttribute("src"), width: element.naturalWidth, loaded: !element.closest(".pokemon-art")?.classList.contains("is-loading"),
    })));
  }
  const expectedRaichuAssets = ["10304.png", "10305.png"];
  if (megaRaichuSprites.length !== 2 || megaRaichuSprites.some((sprite) => !expectedRaichuAssets.some((asset) => sprite.src?.endsWith(asset)) || sprite.width !== 512 || !sprite.loaded)) {
    failures.push(`${viewportName}: Mega Raichu X/Y não carregaram os sprites HOME próprios da forma.`);
  }
  observations.push({ viewport: viewportName, name: "pokedex-mega-raichu-z-a-exact-sprites", names: megaRaichuNames, sprites: megaRaichuSprites });
  await safeCapture(page, viewportName, "pokedex-mega-raichu-z-a", { fullPage: true });
  await search.fill("Mega Garchomp Z");
  await page.getByText("Mega Garchomp Z", { exact: true }).first().waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector(".pokemon-card-art .pokemon-art img");
    return image?.getAttribute("src")?.endsWith("10309.png")
      && image.complete && image.naturalWidth === 512
      && !image.closest(".pokemon-art")?.classList.contains("is-loading");
  }, null, { timeout: 15_000 });
  const garchompZDexSprite = await page.locator(".pokemon-card-art .pokemon-art img").first().evaluate((image) => ({ src: image.getAttribute("src"), width: image.naturalWidth }));
  observations.push({ viewport: viewportName, name: "pokedex-mega-garchomp-z-home-sprite", ...garchompZDexSprite });
  await safeCapture(page, viewportName, "pokedex-mega-garchomp-z", { fullPage: true });
  await dexTypeFilter.selectOption("dragon");
  await dexGenerationFilter.selectOption("4");
  await search.fill("Garchomp");
  await page.locator(".pokemon-card-title").first().waitFor({ state: "visible", timeout: 10_000 });
  await search.fill("spindastop-no-match-457");
  await page.locator(".empty-state-panel").waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(page, viewportName, "pokedex-empty", { fullPage: false });
  await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
  await dexTypeFilter.selectOption("water");
  await page.waitForFunction(() => document.querySelectorAll(".pokemon-card").length > 12, null, { timeout: 10_000 });
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
  const waterScrollBeforeOpen = await page.evaluate(() => window.scrollY);
  await page.locator(".pokemon-card-link").nth(12).click();
  await page.locator(".detail-page").waitFor({ state: "visible", timeout: 10_000 });
  const savedScrollY = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem("spinda-dex-view") || "null")?.scrollY);
  await page.locator(".detail-page .back-link").click();
  await page.getByRole("heading", { name: "Pokédex" }).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction((expectedScrollY) => {
    const restorePending = Boolean(window.sessionStorage.getItem("spinda-dex-view"));
    return !restorePending && Math.abs(window.scrollY - expectedScrollY) <= 100;
  }, savedScrollY, { timeout: 10_000 });
  const restoredScrollState = await page.evaluate(() => ({
    type: document.querySelector('.dex-toolbar .filter-field select')?.value,
    scrollY: window.scrollY,
  }));
  observations.push({ viewport: viewportName, name: "pokedex-scroll-restored", before: waterScrollBeforeOpen, saved: savedScrollY, ...restoredScrollState });
  if (restoredScrollState.type !== "water" || Math.abs(restoredScrollState.scrollY - savedScrollY) > 100) {
    failures.push(`${viewportName}: a Pokédex não restaurou o filtro e a posição após abrir e voltar da ficha.`);
  }
  await safeCapture(page, viewportName, "pokedex-restored", { fullPage: false });

  const formEvolutionPage = await context.newPage();
  await formEvolutionPage.goto(`${baseUrl}/dex/raichu-alola`, { waitUntil: "domcontentloaded" });
  await formEvolutionPage.getByRole("heading", { name: "Alolan Raichu", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  const alolanRaichuRule = formEvolutionPage.locator(".detail-evolutions");
  await alolanRaichuRule.waitFor({ state: "visible", timeout: 10_000 });
  const alolanRaichuState = await formEvolutionPage.evaluate(() => ({
    title: document.querySelector("#pokemon-title")?.textContent?.trim(),
    types: document.querySelector(".detail-types")?.innerText?.replace(/\s+/g, " ").trim(),
    total: document.querySelector("#detail-stats .section-heading > span")?.textContent?.trim(),
    sprite: document.querySelector(".detail-stage-art .pokemon-art img")?.getAttribute("src"),
    evolution: document.querySelector(".detail-evolutions")?.innerText,
  }));
  observations.push({ viewport: viewportName, name: "pokemon-alolan-raichu-exact-form", ...alolanRaichuState });
  if (alolanRaichuState.title !== "Alolan Raichu" || !alolanRaichuState.types?.includes("Psíquico") || alolanRaichuState.total !== "Total 485" || !alolanRaichuState.sprite?.endsWith("10100.gif")) {
    failures.push(`${viewportName}: a forma Alolan Raichu não atualizou nome, tipos, stats e sprite pelo ID exato da forma.`);
  }
  if (!alolanRaichuState.evolution?.includes("Forma resultante: Alola") || !alolanRaichuState.evolution.includes("Thunder Stone")) {
    failures.push(`${viewportName}: a condição de evolução para a forma Alola não correspondeu à revisão fixa da PokéAPI.`);
  }
  await safeCapture(formEvolutionPage, viewportName, "pokemon-alolan-raichu-evolution", { audit: true, fullPage: false });
  await formEvolutionPage.close();

  await page.goto(`${baseUrl}/builder`, { waitUntil: "domcontentloaded" });
  await page.locator(".builder-heading h1").waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(page, viewportName, "builder-empty", { audit: true });
  const emptySpeedTarget = page.locator(".builder-speed-target.is-empty");
  await emptySpeedTarget.scrollIntoViewIfNeeded();
  const emptySpeedTargetLayout = await emptySpeedTarget.evaluate((element) => {
    const placeholder = element.querySelector(".builder-speed-target-placeholder").getBoundingClientRect();
    const action = element.querySelector(".button").getBoundingClientRect();
    const container = element.getBoundingClientRect();
    return {
      placeholderRight: placeholder.right,
      placeholderBottom: placeholder.bottom,
      actionLeft: action.left,
      actionRight: action.right,
      actionTop: action.top,
      containerLeft: container.left,
      containerRight: container.right,
    };
  });
  observations.push({ viewport: viewportName, name: "builder-empty-speed-target-layout", ...emptySpeedTargetLayout });
  const emptySpeedTargetCollides = viewport.width <= 420
    ? emptySpeedTargetLayout.actionTop < emptySpeedTargetLayout.placeholderBottom + 3
    : emptySpeedTargetLayout.placeholderRight > emptySpeedTargetLayout.actionLeft + 1;
  if (emptySpeedTargetCollides
    || emptySpeedTargetLayout.actionLeft < emptySpeedTargetLayout.containerLeft - 1
    || emptySpeedTargetLayout.actionRight > emptySpeedTargetLayout.containerRight + 1) {
    failures.push(`${viewportName}: o seletor do alvo de Speed colide com a instrução em largura estreita ou sai do painel.`);
  }
  const trickRoomToggleLayout = await page.locator(".speed-trick-room-toggle").evaluate((label) => {
    const checkbox = label.querySelector("input").getBoundingClientRect();
    const title = label.querySelector("span").getBoundingClientRect();
    const note = label.querySelector("small").getBoundingClientRect();
    return { checkboxRight: checkbox.right, titleLeft: title.left, titleBottom: title.bottom, noteTop: note.top };
  });
  observations.push({ viewport: viewportName, name: "builder-speed-trick-room-label-layout", ...trickRoomToggleLayout });
  if (trickRoomToggleLayout.checkboxRight + 3 > trickRoomToggleLayout.titleLeft
    || trickRoomToggleLayout.noteTop < trickRoomToggleLayout.titleBottom - 1) {
    failures.push(`${viewportName}: o controle de Trick Room deve separar checkbox, rótulo e explicação.`);
  }
  await safeCapture(page, viewportName, "builder-empty-speed-target", { audit: true, fullPage: false });
  await page.getByRole("button", { name: "Escolher espécie" }).first().click();
  await page.locator("#species-search").fill("Garchomp");
  await page.locator(".species-dialog .picker-result").first().click();
  await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".builder-secondary-actions > summary").click();
  await page.getByRole("link", { name: /usar garchomp como atacante/i }).click();
  await page.locator(".damage-result-empty").waitFor({ state: "visible", timeout: 10_000 });
  const builderCalculatorParams = new URL(page.url()).searchParams;
  if (builderCalculatorParams.get("attacker") !== "Garchomp" || builderCalculatorParams.has("defender")) {
    failures.push(`${viewportName}: a calculadora do builder deve manter o atacante e pedir um alvo quando não há outro integrante.`);
  }
  await safeCapture(page, viewportName, "calculator-from-builder-no-opponent", { audit: true, fullPage: false });
  await page.goto(`${baseUrl}/builder`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  const slotNameMetrics = await page.locator(".team-slot.is-selected .slot-copy b").evaluate((element) => ({
    text: element.textContent?.trim(),
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }));
  observations.push({ viewport: viewportName, name: "builder-slot-name-fit", ...slotNameMetrics });
  if (viewport.width <= 360 && (slotNameMetrics.scrollWidth > slotNameMetrics.clientWidth || slotNameMetrics.whiteSpace === "nowrap")) {
    failures.push(`${viewportName}: o nome do Pokémon selecionado está cortado no slot do builder.`);
  }
  await page.getByLabel("Item", { exact: true }).fill("Clear Amulet");
  const natureTrigger = page.locator("#member-nature");
  await natureTrigger.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const natureStatsBefore = await page.locator(".builder-nature-stats").innerText();
  await safeCapture(page, viewportName, "builder-nature-before", { fullPage: false });
  await natureTrigger.focus();
  await natureTrigger.press("Enter");
  await page.locator("#member-nature-options").waitFor({ state: "visible" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const natureMenuBounds = await page.locator("#member-nature-options").evaluate((menu) => {
    const rect = menu.getBoundingClientRect();
    const nav = document.querySelector(".mobile-primary-nav");
    const navBounds = nav?.getBoundingClientRect();
    const navVisible = navBounds && navBounds.height > 0 && getComputedStyle(nav).display !== "none";
    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      viewportWidth: window.innerWidth,
      visibleBottom: navVisible ? Math.round(navBounds.top) : window.innerHeight,
      position: getComputedStyle(menu).position,
    };
  });
  observations.push({ viewport: viewportName, name: "builder-nature-menu-bounds", ...natureMenuBounds });
  if (natureMenuBounds.left < -1 || natureMenuBounds.right > natureMenuBounds.viewportWidth + 1
    || natureMenuBounds.top < -1 || natureMenuBounds.bottom > natureMenuBounds.visibleBottom + 1
    || natureMenuBounds.position !== "fixed") {
    failures.push(`${viewportName}: o menu de Nature do builder deve caber acima da navegação fixa.`);
  }
  await safeCapture(page, viewportName, "builder-nature-picker-open", { fullPage: false });
  await page.keyboard.press("Tab");
  const firstNatureFocused = await page.evaluate(() => document.activeElement?.classList.contains("nature-picker-option"));
  if (!firstNatureFocused) failures.push(`${viewportName}: Tab não moveu o foco do seletor de Nature para uma opção.`);
  await page.locator("#member-nature-options").getByRole("button", { name: /^Adamant/ }).click();
  await page.locator("#member-nature").getByText("Adamant", { exact: true }).waitFor({ state: "visible" });
  const natureStatsAfter = await page.locator(".builder-nature-stats").innerText();
  if (natureStatsBefore === natureStatsAfter) failures.push(`${viewportName}: trocar para Adamant não atualizou os stats mostrados no builder.`);
  await safeCapture(page, viewportName, "builder-nature-after", { fullPage: false });
  await page.getByLabel("Item", { exact: true }).fill("Clear Amulet");
  await page.locator("#move-0").fill("Earthquake");
  await page.locator(".points-section summary").click();
  await page.locator("#stat-atk").fill("14");
  await page.locator(".builder-tools-details > summary").click();
  const downloadReady = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  const download = await downloadReady;
  const exportedFile = await download.path();
  assert.ok(exportedFile, "a exportação deve criar um arquivo JSON");
  const exportedText = await readFile(exportedFile, "utf8");
  const exportedTeam = JSON.parse(exportedText);
  assert.equal(exportedTeam.members[0].item, "Clear Amulet");
  assert.equal(exportedTeam.members[0].nature, "Adamant");
  assert.equal(exportedTeam.members[0].moves[0], "Earthquake");
  assert.equal(exportedTeam.members[0].statPoints.atk, 14);
  await page.locator('input[aria-label="Selecionar arquivo de equipe JSON"]').setInputFiles(exportedFile);
  await page.getByText("Equipe importada e salva neste navegador.").waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(page, viewportName, "builder-preserved-set", { audit: true });
  await page.locator(".team-slot").nth(1).click();
  const pickerSearch = page.locator("#species-search");
  if (await pickerSearch.count()) {
    await pickerSearch.fill("Arboliva");
    await page.locator(".species-dialog .picker-result").first().click();
  }
  await safeCapture(page, viewportName, "builder-two-sides");
  for (const [slotIndex, species] of [[2, "Incineroar"], [3, "Rillaboom"], [4, "Charizard"], [5, "Pelipper"]]) {
    await page.locator(".team-slot").nth(slotIndex).click();
    await page.locator("#species-search").fill(species);
    await page.locator(".species-dialog .picker-result").first().click();
    await page.getByRole("heading", { name: species, exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  }
  await waitForSpritePaint(page, ".team-slot .pokemon-art img");
  const teamSpriteStates = await page.locator(".team-slot").evaluateAll((slots) => slots.map((slot) => {
    const art = slot.querySelector(".pokemon-art");
    const image = art?.querySelector("img");
    return {
      name: slot.querySelector(".slot-copy b")?.textContent?.trim() || "",
      src: image?.getAttribute("src") || "",
      loaded: Boolean(image?.complete && image.naturalWidth > 0 && !art.classList.contains("is-loading") && !art.classList.contains("is-fallback")),
    };
  }));
  observations.push({ viewport: viewportName, name: "builder-six-member-sprite-load", sprites: teamSpriteStates });
  if (teamSpriteStates.length !== 6 || teamSpriteStates.some((sprite) => !sprite.loaded)) {
    failures.push(`${viewportName}: os seis sprites do builder devem estar carregados antes da captura.`);
  }
  const slotNames = await page.locator(".team-slot .slot-copy b").allTextContents();
  observations.push({ viewport: viewportName, name: "builder-six-member-names", slotNames });
  if (slotNames.length !== 6 || slotNames.some((name) => name === "Vazio")) {
    failures.push(`${viewportName}: a revisão mobile/desktop não conseguiu preencher e reconhecer os seis Pokémon do builder.`);
  }
  const slotLayoutMetrics = await page.locator(".team-slot .slot-copy b").evaluateAll((elements) => elements.map((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return { text: element.textContent?.trim(), lineCount: range.getClientRects().length };
  }));
  observations.push({ viewport: viewportName, name: "builder-six-member-name-lines", slots: slotLayoutMetrics });
  if (viewport.width <= 420 && slotLayoutMetrics.some((slot) => slot.lineCount > 1)) {
    failures.push(`${viewportName}: os nomes dos seis Pokémon devem permanecer legíveis em uma linha nos slots mobile.`);
  }
  await safeCapture(page, viewportName, "builder-six-members", { audit: true, fullPage: viewport.width > 720 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const firstFoldSlots = await page.locator(".team-slot").evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight - 72;
  }).length);
  observations.push({ viewport: viewportName, name: "builder-six-members-first-fold-visible-slots", count: firstFoldSlots });
  if (firstFoldSlots !== 6) failures.push(`${viewportName}: os seis slots preenchidos devem caber na primeira dobra, acima da navegação mobile.`);
  const builderTitleLayout = await page.locator(".builder-heading h1").evaluate((element) => {
    const visibleTitle = element.querySelector(window.matchMedia("(max-width: 420px)").matches
      ? ".builder-heading-title-compact"
      : ".builder-heading-title-full") ?? element;
    const range = document.createRange();
    range.selectNodeContents(visibleTitle);
    const title = element.getBoundingClientRect();
    const action = element.closest(".builder-heading")?.querySelector(".builder-speed-jump")?.getBoundingClientRect();
    const overlapsAction = Boolean(action && title.left < action.right && title.right > action.left && title.top < action.bottom && title.bottom > action.top);
    return { lineCount: range.getClientRects().length, width: element.clientWidth, scrollWidth: element.scrollWidth, overlapsAction };
  });
  observations.push({ viewport: viewportName, name: "builder-title-compact-layout", ...builderTitleLayout });
  if (viewport.width <= 420 && (builderTitleLayout.lineCount !== 1 || builderTitleLayout.scrollWidth > builderTitleLayout.width + 1 || builderTitleLayout.overlapsAction)) {
    failures.push(`${viewportName}: o título do builder deve caber em uma linha sem overflow ou sobreposição ao botão Speed.`);
  }
  await safeCapture(page, viewportName, "builder-six-members-first-fold", { audit: true, fullPage: false });
  await page.getByRole("link", { name: "Comparar Speed" }).click();
  await page.locator("#builder-speed-title").waitFor({ state: "visible", timeout: 10_000 });
  const speedShortcutState = await page.waitForFunction(() => {
    const title = document.querySelector("#builder-speed-title");
    const mobileNav = document.querySelector(".mobile-primary-nav");
    const rect = title?.getBoundingClientRect();
    const navStyle = mobileNav ? getComputedStyle(mobileNav) : null;
    const navVisible = Boolean(mobileNav && navStyle?.display !== "none" && navStyle?.visibility !== "hidden");
    const visibleBottom = navVisible ? mobileNav.getBoundingClientRect().top : window.innerHeight;
    return location.hash === "#builder-speed-title" && rect && rect.bottom > 0 && rect.top < visibleBottom
      ? { hash: location.hash, titleTop: rect.top, titleBottom: rect.bottom, visibleBottom }
      : false;
  }, null, { timeout: 10_000 }).then((handle) => handle.jsonValue()).catch(() => null);
  const speedShortcutDiagnostic = await page.evaluate(() => {
    const title = document.querySelector("#builder-speed-title");
    const mobileNav = document.querySelector(".mobile-primary-nav");
    const rect = title?.getBoundingClientRect();
    const navStyle = mobileNav ? getComputedStyle(mobileNav) : null;
    return {
      hash: location.hash,
      titleTop: rect?.top ?? null,
      titleBottom: rect?.bottom ?? null,
      mobileNavVisible: Boolean(mobileNav && navStyle?.display !== "none" && navStyle?.visibility !== "hidden"),
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
  observations.push({ viewport: viewportName, name: "builder-speed-shortcut", ...(speedShortcutState || speedShortcutDiagnostic) });
  const speedPanelInView = Boolean(speedShortcutState);
  if (!speedPanelInView) failures.push(`${viewportName}: o atalho para comparar Speed não levou ao comparador do time.`);
  await safeCapture(page, viewportName, "builder-speed-shortcut", { fullPage: false });
  await page.getByRole("button", { name: "Selecionar Pokémon" }).click();
  await page.locator("#speed-target-search").fill("Garchomp-Mega-Z");
  await page.locator('.species-dialog[aria-labelledby="speed-target-dialog-title"] .picker-result').first().click();
  await page.locator(".builder-speed-row").nth(5).waitFor({ state: "visible", timeout: 10_000 });
  if (await page.locator(".builder-speed-row").count() !== 6) failures.push(`${viewportName}: a comparação do builder não atualizou os seis integrantes juntos.`);
  await page.waitForFunction(() => {
    const image = document.querySelector(".builder-speed-target .pokemon-art img");
    return image?.getAttribute("src")?.endsWith("10309.png") && image.complete && image.naturalWidth === 512
      && !image.closest(".pokemon-art")?.classList.contains("is-loading");
  }, null, { timeout: 15_000 });
  const megaZTargetImage = await page.locator(".builder-speed-target .pokemon-art img").evaluate((image) => ({ src: image.src, width: image.naturalWidth }));
  if (!megaZTargetImage.src.endsWith("10309.png") || megaZTargetImage.width !== 512) failures.push(`${viewportName}: Mega Garchomp Z não carregou o sprite HOME específico da forma.`);
  const targetNatureWidth = await page.locator(".builder-target-nature").evaluate((element) => Math.round(element.getBoundingClientRect().width));
  observations.push({ viewport: viewportName, name: "builder-speed-target-nature-width", width: targetNatureWidth });
  if (viewport.width <= 420 && targetNatureWidth < 160) failures.push(`${viewportName}: o seletor da Nature do alvo ficou estreito demais no mobile.`);
  await page.locator("#builder-target-nature").press("Enter");
  const targetNatureMenu = page.locator("#builder-target-nature-options");
  await targetNatureMenu.waitFor({ state: "visible", timeout: 10_000 });
  const targetNatureMenuBounds = await targetNatureMenu.evaluate((menu) => {
    const rect = menu.getBoundingClientRect();
    return { left: Math.round(rect.left), right: Math.round(rect.right), viewport: window.innerWidth };
  });
  observations.push({ viewport: viewportName, name: "builder-speed-target-nature-menu-bounds", ...targetNatureMenuBounds });
  if (targetNatureMenuBounds.left < -1 || targetNatureMenuBounds.right > targetNatureMenuBounds.viewport + 1) {
    failures.push(`${viewportName}: o menu de Nature do alvo de Speed deve caber na largura da tela.`);
  }
  await page.keyboard.press("Escape");
  await targetNatureMenu.waitFor({ state: "hidden", timeout: 2_000 });
  const targetNameGeometry = await page.locator(".builder-speed-target").evaluate((container) => {
    const artwork = container.querySelector(":scope > .pokemon-art").getBoundingClientRect();
    const name = container.querySelector(".builder-speed-target-name strong").getBoundingClientRect();
    return { artworkRight: Math.round(artwork.right), nameLeft: Math.round(name.left) };
  });
  observations.push({ viewport: viewportName, name: "builder-speed-target-artwork-clearance", ...targetNameGeometry });
  if (viewport.width <= 420 && targetNameGeometry.artworkRight > targetNameGeometry.nameLeft) failures.push(`${viewportName}: speed target sprite overlaps its name.`);
  await page.getByLabel("SP do alvo").fill("32");
  const updatedTeamRows = await page.locator(".builder-speed-row").evaluateAll((rows) => rows.map((row) => ({ speed: row.dataset.speed, target: row.dataset.targetSpeed, relation: row.dataset.relation })));
  if (updatedTeamRows.length !== 6 || updatedTeamRows.some((row) => row.target !== "203" || !row.speed || !row.relation)) failures.push(`${viewportName}: alterar o SP do alvo não atualizou os seis resultados de Speed.`);
  const speedGridColumns = await page.locator(".builder-speed-grid").evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  observations.push({ viewport: viewportName, name: "builder-speed-grid-columns", count: speedGridColumns });
  if (viewport.width <= 420 && speedGridColumns !== 1) failures.push(`${viewportName}: os controles de Speed devem ter largura de toque legível em telas mobile.`);
  await page.locator(".builder-speed-row").first().locator('input[type="number"]').fill("1");
  await page.locator(".team-slot").first().click();
  const mainNatureTrigger = page.locator("#member-nature");
  await mainNatureTrigger.click();
  await page.locator("#member-nature-options").getByRole("button", { name: /^Jolly/ }).click();
  await page.getByRole("link", { name: "Comparar Speed" }).click();
  const speedAfterSavedNatureChange = await page.locator(".builder-speed-row").first().getAttribute("data-speed");
  observations.push({ viewport: viewportName, name: "builder-speed-uses-current-saved-nature", speed: speedAfterSavedNatureChange });
  if (speedAfterSavedNatureChange !== "135") failures.push(`${viewportName}: a prévia de SP temporária não acompanhou a Nature Jolly salva no set.`);
  await page.locator(".builder-speed-row").first().locator('input[type="number"]').fill("17");
  await page.locator(".builder-speed-row").first().getByRole("button", { name: "Aplicar ao set" }).click();
  await page.locator(".team-slot").first().click();
  if (!(await page.locator(".points-section").evaluate((details) => details.open))) await page.locator(".points-section > summary").click();
  if (await page.locator("#stat-spe").inputValue() !== "17") failures.push(`${viewportName}: aplicar a prévia de Speed não salvou o SP no set selecionado.`);
  await page.locator(".builder-speed-panel").scrollIntoViewIfNeeded();
  await safeCapture(page, viewportName, "builder-six-speed-vs-mega-garchomp-z", { audit: true, fullPage: false });
  await page.locator(".builder-speed-row").last().scrollIntoViewIfNeeded();
  await safeCapture(page, viewportName, "builder-six-speed-last-member", { fullPage: false });
  const validTeamSnapshot = await page.evaluate(() => window.localStorage.getItem("spinda-stop.team.v1"));
  await page.evaluate(() => {
    const key = "spinda-stop.team.v1";
    const team = JSON.parse(window.localStorage.getItem(key));
    team.members[0].nature = "Adamant";
    team.members[0].statPoints = { hp: 9, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 };
    window.localStorage.setItem(key, JSON.stringify(team));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Comparar Speed" }).click();
  await page.getByRole("button", { name: "Selecionar Pokémon" }).click();
  await page.locator("#speed-target-search").fill("Alakazam");
  await page.locator('.species-dialog[aria-labelledby="speed-target-dialog-title"] .picker-result').getByText("Alakazam", { exact: true }).click();
  await page.getByLabel("SP do alvo").fill("20");
  const budgetRow = page.locator(".builder-speed-row").first();
  const budgetRecommendation = await budgetRow.locator(".builder-speed-action").innerText();
  const favorableNatureAlternative = await budgetRow.locator(".builder-speed-favorable-note").innerText();
  observations.push({ viewport: viewportName, name: "builder-speed-budget-nature", recommendation: budgetRecommendation, alternative: favorableNatureAlternative });
  if (!budgetRecommendation.includes("25 SP livres") || !favorableNatureAlternative.includes("25 SP passa")) {
    failures.push(`${viewportName}: a prévia deve respeitar 25 SP restantes e separar o resultado da nature favorável.`);
  }
  await safeCapture(page, viewportName, "builder-speed-budget-nature", { audit: true, fullPage: false });
  await page.evaluate((snapshot) => window.localStorage.setItem("spinda-stop.team.v1", snapshot), validTeamSnapshot);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  if (viewportName === "desktop") {
    await page.evaluate(() => {
      const key = "spinda-stop.team.v1";
      const team = JSON.parse(window.localStorage.getItem(key));
      team.members[0].statPoints = { hp: 32, atk: 32, def: 3, spa: 0, spd: 0, spe: 0 };
      window.localStorage.setItem(key, JSON.stringify(team));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByRole("link", { name: "Comparar Speed" }).click();
    await page.getByRole("button", { name: "Selecionar Pokémon" }).click();
    await page.locator("#speed-target-search").fill("Garchomp-Mega-Z");
    await page.locator('.species-dialog[aria-labelledby="speed-target-dialog-title"] .picker-result').first().click();
    const invalidTeamSnapshotAfterHydration = await page.evaluate(() => window.localStorage.getItem("spinda-stop.team.v1"));
    const invalidApplyButton = page.locator(".builder-speed-row").first().getByRole("button", { name: "Aplicar ao set" });
    const disabledForInvalidSet = await invalidApplyButton.isDisabled();
    await invalidApplyButton.dispatchEvent("click");
    const savedAfterInvalidApply = await page.evaluate(() => window.localStorage.getItem("spinda-stop.team.v1"));
    observations.push({ viewport: viewportName, name: "builder-speed-invalid-apply", disabled: disabledForInvalidSet, unchanged: savedAfterInvalidApply === invalidTeamSnapshotAfterHydration });
    if (!disabledForInvalidSet || savedAfterInvalidApply !== invalidTeamSnapshotAfterHydration) {
      failures.push(`${viewportName}: Aplicar ao set deve bloquear e preservar uma distribuição de SP inválida.`);
    }
    await page.evaluate((snapshot) => window.localStorage.setItem("spinda-stop.team.v1", snapshot), validTeamSnapshot);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  }
  await page.locator(".builder-secondary-actions > summary").click();
  await page.getByRole("link", { name: /como atacante/i }).click();
  await page.getByRole("heading", { name: /Cenário|Resultado/ }).waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  await safeCapture(page, viewportName, "calculator-from-builder", { audit: true });

  const dynamicLeaderPage = await context.newPage();
  await dynamicLeaderPage.route("**/api", (route) => fulfillJson(route, {
    defaultSeason: "M8",
    pokemon: [
      {
        name: "Garchomp",
        showdownId: "garchomp",
        summary: { types: ["Dragon", "Ground"], battleSummary: { M8: { Doubles: { position: 2 } } } },
      },
      {
        name: "Mega Lucario Z",
        showdownId: "lucario-megaz",
        summary: { types: ["Fighting", "Steel"], battleSummary: { M8: { Doubles: { position: 1 } } } },
      },
    ],
  }));
  await dynamicLeaderPage.route("**/api/battle/Doubles/**", (route) => fulfillJson(route, {
    pokemon: "Mega Lucario Z",
    showdownId: "lucario-megaz",
    format: "Doubles",
    season: "M8",
    date: "2026-10-18",
    source: "visual-fixture.csv",
    rows: [],
    daily: [],
  }));
  await dynamicLeaderPage.goto(`${baseUrl}/usage`, { waitUntil: "domcontentloaded" });
  await dynamicLeaderPage.getByRole("heading", { name: "Mega Lucario Z", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  const dynamicLeaderState = await dynamicLeaderPage.evaluate(() => ({
    selected: document.querySelector(".usage-species-button.is-selected .usage-species-name strong")?.textContent?.trim(),
    pokemonQuery: new URLSearchParams(location.search).get("pokemon"),
  }));
  observations.push({ viewport: viewportName, name: "usage-dynamic-source-leader", dataMode: "API-shaped visual fixture", ...dynamicLeaderState });
  if (dynamicLeaderState.selected !== "Mega Lucario Z" || dynamicLeaderState.pokemonQuery) {
    failures.push(`${viewportName}: Usage não selecionou o líder atual da fonte sem inserir uma espécie fixa na URL.`);
  }
  await dynamicLeaderPage.close();

  const loadingUsagePage = await context.newPage();
  let releaseUsageIndex;
  const usageIndexGate = new Promise((resolveGate) => { releaseUsageIndex = resolveGate; });
  await loadingUsagePage.route("https://championsbattledata.com/api", async (route) => {
    await usageIndexGate;
    await fulfillJson(route, {
      defaultSeason: "M8",
      pokemon: [{
        name: "Garchomp",
        showdownId: "garchomp",
        summary: { types: ["Dragon", "Ground"], battleSummary: { M8: { Doubles: { position: 2 } } } },
      }],
    });
  });
  await loadingUsagePage.route("https://championsbattledata.com/api/battle/Doubles/**", (route) => fulfillJson(route, {
    pokemon: "Garchomp",
    showdownId: "garchomp",
    format: "Doubles",
    season: "M8",
    date: "2026-10-18",
    source: "visual-fixture.csv",
    rows: [],
    daily: [],
  }));
  await loadingUsagePage.goto(`${baseUrl}/usage`, { waitUntil: "domcontentloaded" });
  const loadingUsageState = loadingUsagePage.locator(".usage-index-state");
  await loadingUsageState.waitFor({ state: "visible", timeout: 10_000 });
  const loadingUsageCopy = await loadingUsageState.innerText();
  assert.equal(loadingUsageCopy, "Carregando o índice público de Doubles…", "o carregamento de Usage deve informar a fonte enquanto o índice está pendente");
  observations.push({ viewport: viewportName, name: "usage-index-loading-copy", text: loadingUsageCopy });
  await safeCapture(loadingUsagePage, viewportName, "usage-index-loading", { audit: true, fullPage: false });
  releaseUsageIndex();
  await loadingUsagePage.locator(".usage-provenance").waitFor({ state: "visible", timeout: 10_000 });
  await loadingUsagePage.close();

  await page.goto(`${baseUrl}/usage?pokemon=Garchomp`, { waitUntil: "domcontentloaded" });
  await waitForUsage(page);
  if (await page.locator(".usage-index-note").count()) {
    await waitForEither(page, ".usage-provenance, .usage-error", 35_000);
  }
  await safeCapture(page, viewportName, "usage-battle-data", { audit: true, fullPage: false });
  if (viewport.width <= 760) {
    const mobileUsageOrder = await page.evaluate(() => ({
      selected: document.querySelector(".usage-results-column")?.getBoundingClientRect().top,
      search: document.querySelector(".usage-browser-panel")?.getBoundingClientRect().top,
    }));
    observations.push({ viewport: viewportName, name: "usage-mobile-results-before-search", ...mobileUsageOrder });
    if (mobileUsageOrder.selected === undefined || mobileUsageOrder.search === undefined || mobileUsageOrder.selected >= mobileUsageOrder.search) {
      failures.push(`${viewportName}: Usage deve mostrar a ficha e o ranking selecionado antes da busca no mobile.`);
    }
  }
  if (await page.locator(".usage-index-note").count()) {
    const usageCategory = page.locator(".usage-category-tabs .usage-category-tab").filter({ hasText: "Golpes" }).first();
    await usageCategory.click();
    if ((await usageCategory.getAttribute("aria-pressed")) !== "true") failures.push(`${viewportName}: a aba de golpes do Usage não ficou selecionada.`);
    const usageListHeight = await page.locator(".usage-species-list").evaluate((list) => list.getBoundingClientRect().height);
    observations.push({ viewport: viewportName, name: "usage-mobile-ranking-strip-height", height: usageListHeight });
    if (viewport.width <= 600 && usageListHeight > 112) failures.push(`${viewportName}: a lista mobile de espécies ocupa espaço excessivo antes da ficha selecionada.`);
    const firstUsageRow = page.locator(".usage-row-list li").first();
    if (await firstUsageRow.count()) await firstUsageRow.scrollIntoViewIfNeeded();
    await safeCapture(page, viewportName, "usage-battle-data-moves", { audit: true, fullPage: false });
    const usageRow = page.locator(".usage-species-button").first();
    if (await usageRow.count()) {
      const usageRowMetrics = await usageRow.evaluate((button) => {
        const rect = (selector) => {
          const element = button.querySelector(selector);
          if (!element) return null;
          const bounds = element.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, centerY: (bounds.top + bounds.bottom) / 2 };
        };
        const name = button.querySelector(".usage-species-name > strong");
        const nameRange = document.createRange();
        if (name) nameRange.selectNodeContents(name);
        const artRect = rect(".usage-species-art");
        const positionRect = rect(".usage-position");
        const typeList = button.querySelector(".usage-species-name .type-list");
        const typeListRect = typeList?.getBoundingClientRect();
        const typeTagsFit = !typeList || Array.from(typeList.children).every((tag) => {
          const tagRect = tag.getBoundingClientRect();
          return tagRect.left >= typeListRect.left - 1 && tagRect.right <= typeListRect.right + 1;
        });
        return {
          name: name?.textContent?.trim(),
          nameLineCount: nameRange.getClientRects().length,
          rankAlignedWithArt: Boolean(artRect && positionRect && Math.abs(artRect.centerY - positionRect.centerY) <= 8),
          typeTagsFit,
        };
      });
      observations.push({ viewport: viewportName, name: "usage-species-row-layout", ...usageRowMetrics });
      if (viewport.width <= 420 && (!usageRowMetrics.rankAlignedWithArt || !usageRowMetrics.typeTagsFit || (usageRowMetrics.name === "Garchomp" && usageRowMetrics.nameLineCount > 1))) {
        failures.push(`${viewportName}: a linha compacta de Usage deve manter Pokémon, nome, tipos e posição alinhados e legíveis.`);
      }
    }
    const usageSearch = page.locator(".usage-browser-panel input[type=search]");
    await usageSearch.fill("spindastop-no-match-457");
    await page.locator(".usage-no-results").waitFor({ state: "visible", timeout: 10_000 });
    await safeCapture(page, viewportName, "usage-empty", { fullPage: false });
    await usageSearch.fill("Garchomp");
    await page.locator(".usage-more-filters > summary").click();
    const sourceFilters = [
      ['.usage-filters .usage-filter-field:has-text("Tipo") select', "Dragon"],
      ['.usage-filters .usage-filter-field:has-text("Golpe no resumo da fonte") select', "Earthquake"],
      ['.usage-filters .usage-filter-field:has-text("Item no resumo da fonte") select', "Garchompite Z"],
      ['.usage-filters .usage-filter-field:has-text("Habilidade no resumo da fonte") select', "Sand Veil"],
    ];
    for (const [selector, label] of sourceFilters) {
      const filter = page.locator(selector);
      const optionExists = await filter.evaluate((select, optionLabel) =>
        Array.from(select.options).some((option) => option.label === optionLabel), label);
      if (!optionExists) failures.push(`Usage não oferece a faceta real "${label}" neste índice.`);
      else await filter.selectOption({ label });
    }
    const filteredSpecies = await page.locator(".usage-species-button").allTextContents();
    if (!filteredSpecies.some((name) => name.includes("Garchomp"))) {
      failures.push("As facetas combinadas não preservaram o Garchomp compatível com os dados publicados.");
    }
    await safeCapture(page, viewportName, "usage-filtered", { fullPage: false });
    if (viewportName === "desktop") {
      const filterSelectors = [
        ".usage-browser-panel input[type=search]",
        '.usage-filters .usage-filter-field:has-text("Tipo") select',
        '.usage-filters .usage-filter-field:has-text("Golpe no resumo da fonte") select',
        '.usage-filters .usage-filter-field:has-text("Item no resumo da fonte") select',
        '.usage-filters .usage-filter-field:has-text("Habilidade no resumo da fonte") select',
      ];
      const beforeRefresh = await Promise.all(filterSelectors.map((selector) => page.locator(selector).inputValue()));
      await page.locator(".usage-index-note button").click();
      await page.locator(".usage-index-note button").filter({ hasText: "Atualizar agora" }).waitFor({ state: "visible", timeout: 35_000 });
      const afterRefresh = await Promise.all(filterSelectors.map((selector) => page.locator(selector).inputValue()));
      if (JSON.stringify(afterRefresh) !== JSON.stringify(beforeRefresh)) {
        failures.push("Usage perdeu a busca ou os filtros durante a atualização manual.");
      }
      if (!(await page.locator(".usage-species-button.is-selected").innerText()).includes("Garchomp")) {
        failures.push("Usage mudou a espécie selecionada durante a atualização manual.");
      }
    }
    const clearUsageFilters = page.locator(".usage-browser-panel").getByRole("button", { name: "Limpar filtros" });
    await clearUsageFilters.evaluate((button) => button.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
    await clearUsageFilters.click();
    await usageSearch.fill("Garchomp");
    await page.locator('.usage-filters .usage-filter-field:has-text("Período") select').selectOption("history");
    await waitForEither(page, ".usage-snapshot-picker, .usage-no-snapshots, .usage-error", 35_000);
    await safeCapture(page, viewportName, "usage-history", { fullPage: false });
  }

  const metaRollButton = page.getByRole("button", { name: "MetaRoll", exact: true });
  if (await metaRollButton.count()) {
    await metaRollButton.press("Enter");
    const activeSource = page.locator(".usage-source-switch button.is-active");
    await activeSource.filter({ hasText: "MetaRoll" }).waitFor({ state: "visible", timeout: 10_000 });
    const keyboardSource = await metaRollButton.evaluate((button) => ({
      pressed: button.getAttribute("aria-pressed"),
      outlineWidth: getComputedStyle(button).outlineWidth,
      outlineStyle: getComputedStyle(button).outlineStyle,
    }));
    observations.push({ viewport: viewportName, name: "keyboard-source-switch", ...keyboardSource });
    if (keyboardSource.pressed !== "true" || keyboardSource.outlineWidth === "0px" || keyboardSource.outlineStyle === "none") {
      failures.push(`${viewportName}: a troca de fonte por teclado não deixou estado e foco visíveis.`);
    }
    await page.getByRole("button", { name: "Battle Data", exact: true }).press("Enter");
    await page.locator(".usage-source-switch button.is-active").filter({ hasText: "Battle Data" }).waitFor({ state: "visible", timeout: 10_000 });
  } else {
    failures.push(`${viewportName}: o seletor de fonte não está disponível no Usage de Battle Data.`);
  }

  await page.goto(`${baseUrl}/usage?source=metaroll&pokemon=Tauros-Paldea-Aqua`, { waitUntil: "domcontentloaded" });
  const metaRollLoaded = await waitForEither(page, ".metaroll-capture-note, .usage-index-error");
  if (await page.locator(".metaroll-capture-note").count()) {
    await waitForEither(page, ".metaroll-provenance, .usage-error", 35_000);
  }
  await safeCapture(page, viewportName, "usage-metaroll", { audit: true, fullPage: false });
  if (await page.locator(".metaroll-layout .usage-more-filters > summary").count()) {
    await page.locator(".metaroll-layout .usage-more-filters > summary").click();
    const profileTabs = page.locator(".metaroll-profile-tabs .usage-category-tab");
    if (await profileTabs.count()) {
      await profileTabs.nth(1).click();
      await safeCapture(page, viewportName, "usage-metaroll-category", { audit: true, fullPage: false });
    }
  }
  if (metaRollLoaded && await page.locator(".metaroll-capture-note").count()) {
    const teammateCard = page.locator(".metaroll-profile-summary .metaroll-card").filter({ hasText: "Parceiros" }).first();
    const teammateRows = teammateCard.locator(".metaroll-list-row");
    if (await teammateRows.count()) {
      const missingPercentage = teammateRows.first().locator(".metaroll-row-percent.is-missing");
      if (!await missingPercentage.count()) {
        failures.push(`${viewportName}: parceiros MetaRoll devem identificar percentual ausente sem inventar valor.`);
      } else if (await missingPercentage.innerText() !== "—" || await missingPercentage.getAttribute("aria-label") !== "Percentual não informado") {
        failures.push(`${viewportName}: parceiros MetaRoll devem identificar percentual ausente sem inventar valor.`);
      }
      if (viewport.width <= 360) {
        const identityWidth = await teammateRows.first().locator(".metaroll-row-identity").evaluate((element) => element.getBoundingClientRect().width);
        if (identityWidth < 80) failures.push(`${viewportName}: o nome do parceiro perde espaço no cartão estreito do MetaRoll.`);
      }
    }
    const metaRollSearch = page.locator(".metaroll-layout input[type=search]");
    await metaRollSearch.fill("Garchomp");
    await page.locator(".metaroll-layout .usage-species-button").filter({ hasText: "Garchomp" }).first().click();
    await waitForEither(page, ".metaroll-mega-list, .metaroll-mega-card .usage-error, .metaroll-mega-card .metaroll-empty", 35_000);
    if (await page.locator(".metaroll-mega-list").count()) {
      const megaText = await page.locator(".metaroll-mega-list").innerText();
      if (!megaText.includes("Garchomp-Mega")) failures.push(`${viewportName}: MetaRoll não mostrou a forma Mega publicada para Garchomp.`);
    } else if (await page.locator(".metaroll-mega-card .usage-error").count()) {
      failures.push(`${viewportName}: o endpoint de formas Mega falhou na conferência visual.`);
    }
    await safeCapture(page, viewportName, "usage-metaroll-megas", { audit: true, fullPage: false });
    await safeCapture(page, viewportName, "usage-matchups-history", { fullPage: false });
    await page.getByRole("button", { name: "Ladder de jogadores" }).click();
    await waitForEither(page, ".metaroll-ladder-about > summary, .usage-error", 35_000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await safeCapture(page, viewportName, "usage-ladder", { audit: true, fullPage: false });
    await page.getByRole("button", { name: "Espécies" }).click();
    await page.locator(".usage-browser-panel input[type=search]").fill("spindastop-no-match-457");
    await page.locator(".usage-no-results").waitFor({ state: "visible", timeout: 10_000 });
    await safeCapture(page, viewportName, "usage-metaroll-empty", { fullPage: false });
  }

  const errorPage = await context.newPage();
  await errorPage.route("https://championsbattledata.com/**", (route) => route.abort());
  await errorPage.goto(`${baseUrl}/usage`, { waitUntil: "domcontentloaded" });
  await errorPage.locator(".usage-index-error").waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(errorPage, viewportName, "usage-battle-data-error");
  await errorPage.goto(`${baseUrl}/usage?source=metaroll`, { waitUntil: "domcontentloaded" });
  await errorPage.route("https://metaroll.app/**", (route) => route.abort()).catch(() => {});
  await errorPage.reload({ waitUntil: "domcontentloaded" });
  await errorPage.locator(".usage-index-error").waitFor({ state: "visible", timeout: 10_000 });
  await safeCapture(errorPage, viewportName, "usage-metaroll-error");

  const megaErrorPage = await context.newPage();
  await megaErrorPage.route("https://metaroll.app/api/v1/megas.json", (route) => route.abort()).catch(() => {});
  await megaErrorPage.goto(`${baseUrl}/usage?source=metaroll&pokemon=Garchomp`, { waitUntil: "domcontentloaded" });
  await waitForEither(megaErrorPage, ".metaroll-mega-card .usage-error, .metaroll-mega-list", 35_000);
  await safeCapture(megaErrorPage, viewportName, "usage-metaroll-mega-error", { audit: true });
  await errorPage.close();

  await page.goto(`${baseUrl}/calculator`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Calculadora de dano" }).waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  const emptyCalculatorSlots = await page.locator(".damage-move-slot").evaluateAll((slots) => slots.map((slot) => ({
    empty: slot.classList.contains("is-empty"),
    label: slot.querySelector(".damage-move-slot-select strong")?.textContent?.trim(),
  })));
  if (emptyCalculatorSlots.length !== 8 || emptyCalculatorSlots.some((slot) => !slot.empty || slot.label !== "Escolher golpe")
    || await page.getByText("Garchomp", { exact: true }).count()) {
    failures.push(`${viewportName}: a calculadora direta deve mostrar os oito slots vazios sem injetar espécie ou golpe padrão.`);
  }
  await safeCapture(page, viewportName, "calculator-empty-choice", { audit: true, fullPage: false });
  await page.locator(".damage-workbench-side").first().locator('input[list="damage-attacker-species-options"]').fill("Garchomp");
  await page.locator(".damage-workbench-side").nth(1).locator('input[list="damage-defender-species-options"]').fill("Gardevoir-Mega");
  await page.getByRole("button", { name: "Catálogo do motor" }).first().click();
  const attackerMoveSearch = page.getByRole("searchbox", { name: "Buscar golpes de Garchomp" });
  await attackerMoveSearch.fill("Earthquake");
  await page.locator(".damage-workbench-side").first().locator(".damage-move-options button").filter({ hasText: "Earthquake" }).first().click();
  await page.getByRole("heading", { name: "Garchomp usa Earthquake" }).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("button", { name: "Mais ajustes" }).click();
  const damageEditor = page.locator(".damage-editor-disclosure");
  await damageEditor.waitFor({ state: "visible", timeout: 10_000 });
  if (!(await damageEditor.evaluate((details) => details.open))) await damageEditor.locator(":scope > summary").click();
  await safeCapture(page, viewportName, "calculator", { audit: true, fullPage: false });
  const unsupportedQuery = new URLSearchParams({ attacker: "Garchomp", defender: "Gardevoir-Mega", move: "Earthquake", ability: "Habilidade criada pelo usuário", item: "Item desconhecido importado" });
  await page.goto(`${baseUrl}/calculator?${unsupportedQuery}`, { waitUntil: "domcontentloaded" });
  const attackerEditor = page.locator(".damage-workbench-side").first();
  const importedSetDetails = attackerEditor.locator(".damage-side-settings");
  if (!(await importedSetDetails.evaluate((details) => details.open))) await importedSetDetails.locator(":scope > summary").click();
  const importedItem = await attackerEditor.getByLabel("Item", { exact: true }).inputValue();
  const importedAbility = await attackerEditor.getByLabel("Habilidade", { exact: true }).inputValue();
  const itemLimitNote = await attackerEditor.locator(".damage-source-note.is-limited").textContent().catch(() => "");
  const attackerStatsVisible = await attackerEditor.locator(".damage-calculated-stats").isVisible();
  if (importedItem !== "Item desconhecido importado" || importedAbility !== "Habilidade criada pelo usuário") failures.push(`${viewportName}: item ou habilidade importados foram descartados do set.`);
  if (!itemLimitNote || !attackerStatsVisible) failures.push(`${viewportName}: o limite do item desconhecido ou os stats válidos não foram apresentados.`);
  await safeCapture(page, viewportName, "calculator-unsupported-imported-item", { audit: true, fullPage: false });
  await attackerEditor.getByLabel("Item", { exact: true }).selectOption("");
  await attackerEditor.getByLabel("Habilidade", { exact: true }).selectOption("");
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForSpritePaint(page, ".damage-quickbar .pokemon-art img, .damage-result-matchup .pokemon-art img");
  await page.getByRole("checkbox", { name: "Comparar", exact: true }).check();
  await page.locator(".damage-comparison-results").waitFor({ state: "visible", timeout: 10_000 });
  if (!(await page.locator(".damage-editor-disclosure").evaluate((details) => details.open))) {
    await page.locator(".damage-editor-disclosure > summary").click();
  }
  const moveAndFieldTask = page.locator(".damage-edit-task").filter({ hasText: "Golpes e campo" });
  if (!(await moveAndFieldTask.evaluate((details) => details.open))) await moveAndFieldTask.locator(":scope > summary").click();
  await page.getByLabel("Golpe B").fill("Dragon Claw");
  const comparisonResults = page.locator(".damage-comparison-results .damage-result");
  await comparisonResults.nth(1).getByRole("heading", { name: "Garchomp usa Dragon Claw" }).waitFor({ state: "visible", timeout: 10_000 });
  if (await comparisonResults.count() !== 2) failures.push(`${viewportName}: a comparação deve calcular A e B com a variação selecionada.`);
  await page.evaluate(() => window.scrollTo(0, 0));
  const comparisonFirstFold = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".damage-comparison-results .damage-result")];
    const bottomNav = document.querySelector(".mobile-primary-nav");
    const visibleBottom = bottomNav?.getBoundingClientRect().top ?? window.innerHeight;
    const ranges = cards.map((card) => {
      const range = card.querySelector(".damage-result-range");
      const rect = range?.getBoundingClientRect();
      return {
        visible: Boolean(rect && rect.top >= 0 && rect.bottom <= visibleBottom),
        top: rect ? Math.round(rect.top) : null,
        bottom: rect ? Math.round(rect.bottom) : null,
      };
    });
    return { count: cards.length, ranges, visibleBottom, cardBottom: Math.max(0, ...cards.map((card) => card.getBoundingClientRect().bottom)) };
  });
  observations.push({ viewport: viewportName, name: "calculator-comparison-first-fold", ...comparisonFirstFold });
  if (viewport.width <= 760 && (comparisonFirstFold.count !== 2 || comparisonFirstFold.ranges.some((range) => !range.visible))) {
    failures.push(`${viewportName}: os danos dos cenários A e B devem aparecer juntos acima da navegação mobile.`);
  }
  if (viewport.width <= 420) {
    const matchupIdentity = await page.locator(".damage-quickbar-side strong").evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        text: element.textContent?.trim() || "",
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    }));
    observations.push({ viewport: viewportName, name: "calculator-comparison-pokemon-names", labels: matchupIdentity });
    if (matchupIdentity.length !== 2 || matchupIdentity.some((label) => !label.text || label.text.includes("…")
      || label.overflow === "hidden" || label.textOverflow === "ellipsis" || label.whiteSpace === "nowrap"
      || label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1)) {
      failures.push(`${viewportName}: os nomes do atacante e do alvo devem aparecer completos na barra A/B.`);
    }
  }
  await waitForSpritePaint(page, ".damage-quickbar .pokemon-art img");
  await safeCapture(page, viewportName, "calculator-comparison", { audit: true, fullPage: false });
  const compactDetailState = await page.locator(".damage-result-more").evaluateAll((elements) => elements.map((element) => element.open));
  if (compactDetailState.some(Boolean)) failures.push(`${viewportName}: os rolls e modificadores secundários devem começar recolhidos.`);
  if (await page.locator(".damage-engine-note").count() !== 0 || await page.locator(".damage-context-help").count() !== 1 || await page.locator(".damage-context-help").evaluate((details) => details.open)) failures.push(`${viewportName}: a ajuda do motor deve começar compacta e recolhida.`);
  await page.locator(".damage-result-more > summary").first().click();
  const visibleRollCount = await page.locator(".damage-result-more[open] .damage-rolls li").count();
  if (visibleRollCount !== 16) failures.push(`${viewportName}: a variação da calculadora não expôs exatamente os 16 rolls ao abrir detalhes.`);
  await page.locator(".damage-rolls").first().scrollIntoViewIfNeeded();
  await safeCapture(page, viewportName, "calculator-comparison-rolls", { audit: true, fullPage: false });
  if (!(await page.locator(".damage-editor-disclosure").evaluate((details) => details.open))) await page.locator(".damage-editor-disclosure > summary").click();
  await page.getByRole("button", { name: "1 vs vários" }).click();
  await page.locator('input[list="damage-many-target-1"]').fill("Garchomp-Mega-Z");
  await page.locator(".damage-multi-row").nth(1).waitFor({ state: "visible", timeout: 10_000 });
  if (await page.locator(".damage-multi-row").count() !== 2) failures.push(`${viewportName}: um atacante não mostrou resultados independentes para dois alvos.`);
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll(".damage-multi-row")].find((item) => item.textContent?.includes("Garchomp-Mega-Z"));
    const image = row?.querySelector(".pokemon-art img");
    return image?.src.endsWith("10309.png") && image.complete && image.naturalWidth === 512 && !image.closest(".pokemon-art")?.classList.contains("is-loading");
  }, null, { timeout: 15_000 }).catch(() => {});
  const multiTargetMegaSprite = await page.locator(".damage-multi-row").filter({ hasText: "Garchomp-Mega-Z" }).locator(".pokemon-art img").evaluate((image) => ({ src: image.src, width: image.naturalWidth, loaded: !image.closest(".pokemon-art")?.classList.contains("is-loading") }));
  observations.push({ viewport: viewportName, name: "calculator-multi-target-mega-garchomp-z-sprite", ...multiTargetMegaSprite });
  if (!multiTargetMegaSprite.src.endsWith("10309.png") || multiTargetMegaSprite.width !== 512 || !multiTargetMegaSprite.loaded) {
    failures.push(`${viewportName}: o segundo alvo da calculadora não exibiu o sprite próprio de Mega Garchomp Z antes da captura.`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await waitForSpritePaint(page, ".damage-multi-row .pokemon-art img");
  const visibleMultiTargetResults = await page.locator(".damage-multi-row").evaluateAll((rows) => rows.map((row) => {
    const rect = row.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, hasSprite: Boolean(row.querySelector(".pokemon-art img")) };
  }));
  observations.push({ viewport: viewportName, name: "calculator-one-v-many-results-visible", rows: visibleMultiTargetResults });
  if (visibleMultiTargetResults.length !== 2 || visibleMultiTargetResults.some((row) => !row.hasSprite)) {
    failures.push(`${viewportName}: a comparação de vários alvos precisa capturar as duas linhas de resultado com sprites.`);
  }
  await safeCapture(page, viewportName, "calculator-one-v-many", {
    audit: viewport.width > 720,
    fullPage: viewport.width > 720,
  });

  if (viewport.width > 720) {
    await page.getByRole("button", { name: "1 vs 1" }).click();
    const pokemonSetTask = page.locator(".damage-edit-task").filter({ hasText: "Pokémon e sets" });
    if (!(await pokemonSetTask.evaluate((details) => details.open))) await pokemonSetTask.locator(":scope > summary").click();
    if (!(await moveAndFieldTask.evaluate((details) => details.open))) await moveAndFieldTask.locator(":scope > summary").click();
    await page.locator(".damage-workbench-side").first().locator('input[list="damage-attacker-species-options"]').fill("Lucario-Mega-Z");
    await page.locator(".damage-workbench-side").nth(1).locator('input[list="damage-defender-species-options"]').fill("Absol-Mega-Z");
    const multiMovePicker = page.locator(".damage-move-picker").first();
    await multiMovePicker.getByRole("button", { name: "Catálogo do motor" }).click();
    await multiMovePicker.getByRole("searchbox", { name: "Buscar golpes de Lucario-Mega-Z" }).fill("Shadow Claw");
    await multiMovePicker.locator(".damage-move-options button").filter({ hasText: "Shadow Claw" }).first().click();
    await page.getByRole("heading", { name: /Lucario-Mega-Z usa Shadow Claw/ }).waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll(".damage-workbench-side .damage-side-art img")];
      return images.length === 2 && images.every((image) => image.complete && image.naturalWidth === 512 && !image.closest(".pokemon-art")?.classList.contains("is-loading"));
    }, null, { timeout: 15_000 }).catch(() => {});
    const alternateFormSprites = await page.locator(".damage-workbench-side .damage-side-art img").evaluateAll((images) => images.map((image) => ({ src: image.src, width: image.naturalWidth, loaded: !image.closest(".pokemon-art")?.classList.contains("is-loading") })));
    if (alternateFormSprites.length !== 2 || !alternateFormSprites[0].src.endsWith("10310.png") || !alternateFormSprites[1].src.endsWith("10307.png") || alternateFormSprites.some(({ width, loaded }) => width !== 512 || !loaded)) {
      failures.push(`${viewportName}: a calculadora não mostrou os sprites específicos de Mega Lucario Z e Mega Absol Z.`);
    }
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll(".damage-result-matchup .pokemon-art img")];
      return images.length === 2 && images.every((image) => image.complete && image.naturalWidth === 512 && !image.closest(".pokemon-art")?.classList.contains("is-loading"));
    }, null, { timeout: 15_000 }).catch(() => {});
    const resultFormSprites = await page.locator(".damage-result-matchup .pokemon-art img").evaluateAll((images) => images.map((image) => ({ src: image.src, width: image.naturalWidth, loaded: !image.closest(".pokemon-art")?.classList.contains("is-loading") })));
    if (resultFormSprites.length !== 2 || !resultFormSprites[0].src.endsWith("10310.png") || !resultFormSprites[1].src.endsWith("10307.png") || resultFormSprites.some(({ width, loaded }) => width !== 512 || !loaded)) {
      failures.push(`${viewportName}: o resultado não mostrou os sprites próprios de Mega Lucario Z e Mega Absol Z.`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitForSpritePaint(page, ".damage-quickbar .pokemon-art img, .damage-result-matchup .pokemon-art img");
    await safeCapture(page, viewportName, "calculator-lucario-z-vs-absol-z", { audit: true, fullPage: false });
  }

  const inverseMoveNames = ["Earthquake", "Energy Ball", "Grassy Glide", "Flare Blitz", "Heat Wave", "Hurricane"];
  const inverseTeamState = await page.evaluate((moves) => {
    const key = "spinda-stop.team.v1";
    const team = JSON.parse(window.localStorage.getItem(key) || "null");
    if (!team || !Array.isArray(team.members) || team.members.length !== 6 || team.members.some((member) => !member)) return null;
    team.name = "Equipe de comparação";
    team.members.forEach((member, index) => { member.moves = [moves[index], "", "", ""]; });
    window.localStorage.setItem(key, JSON.stringify(team));
    return team.members.map((member) => ({ pokemonId: member.pokemonId, move: member.moves[0], nature: member.nature, statPoints: member.statPoints }));
  }, inverseMoveNames);
  await markProgress(viewportName, "calculator-team-vs-one", "builder-team-fixture-ready");
  if (!inverseTeamState) failures.push(`${viewportName}: não foi possível preparar os seis sets locais para o modo inverso da calculadora.`);
  await page.goto(`${baseUrl}/calculator?defender=Gardevoir-Mega`, { waitUntil: "domcontentloaded" });
  await markProgress(viewportName, "calculator-team-vs-one", "calculator-route-loaded");
  await page.getByRole("button", { name: "Time vs 1" }).click();
  await markProgress(viewportName, "calculator-team-vs-one", "team-vs-one-selected");
  await page.locator(".damage-team-member-grid").waitFor({ state: "visible", timeout: 10_000 });
  await markProgress(viewportName, "calculator-team-vs-one", "team-vs-one-results-rendered");
  const teamResultLayout = await page.locator(".damage-team-member-grid").evaluate((grid) => ({
    display: getComputedStyle(grid).display,
    columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
    overviewColumns: getComputedStyle(document.querySelector(".damage-quickbar-team-art")).gridTemplateColumns.split(" ").filter(Boolean).length,
    overviewMembers: document.querySelectorAll(".damage-quickbar-team-art .pokemon-art").length,
  }));
  observations.push({ viewport: viewportName, name: "calculator-team-vs-one-layout", ...teamResultLayout });
  const expectedResultColumns = viewport.width > 760 ? 2 : 1;
  if (teamResultLayout.display !== "grid" || teamResultLayout.columns !== expectedResultColumns) {
    failures.push(`${viewportName}: Time vs 1 deve usar ${expectedResultColumns} coluna(s) de resultados em ${viewport.width}px.`);
  }
  if (teamResultLayout.overviewColumns !== 3 || teamResultLayout.overviewMembers !== 6) {
    failures.push(`${viewportName}: o resumo de Time vs 1 deve identificar os seis integrantes em duas fileiras compactas.`);
  }
  const inverseRows = await page.locator(".damage-team-member").evaluateAll((rows) => rows.map((row) => ({
    status: [...row.classList].find((name) => name.startsWith("is-")),
    text: row.innerText,
    alerts: row.querySelectorAll('[role="alert"]').length,
  })));
  observations.push({ viewport: viewportName, name: "calculator-team-vs-one-rows", rows: inverseRows.map(({ status, text }) => ({ status, text: text.slice(0, 260) })) });
  const readyRows = inverseRows.filter(({ status }) => status === "is-ready");
  const unavailableRows = inverseRows.filter(({ status }) => status !== "is-ready");
  if (inverseRows.length !== 6 || readyRows.length === 0) failures.push(`${viewportName}: Time vs 1 não exibiu os seis integrantes do builder ou nenhum golpe calculável.`);
  if (unavailableRows.some(({ alerts }) => alerts === 0)) failures.push(`${viewportName}: um set não calculável não explicou o erro junto ao Pokémon e ao golpe.`);
  for (const move of inverseMoveNames) {
    if (!inverseRows.some(({ text }) => text.includes(move))) failures.push(`${viewportName}: o golpe ${move} do builder não apareceu na comparação inversa.`);
  }
  const teamSpriteSelector = ".damage-team-member .pokemon-art img, .damage-team-results-heading .pokemon-art img";
  if (viewport.width > 720) await warmVisibleListSprites(page, teamSpriteSelector, viewport.height);
  await waitForSpritePaint(page, teamSpriteSelector, viewport.width > 720);
  await markProgress(viewportName, "calculator-team-vs-one", "sprites-ready");
  const firstValidMember = page.locator(".damage-team-member.is-ready").first();
  await firstValidMember.locator(".damage-team-move-details > summary").first().click();
  const teamRollCount = await firstValidMember.locator(".damage-rolls li").count();
  if (teamRollCount !== 16) failures.push(`${viewportName}: um golpe calculável de Time vs 1 não preservou os 16 rolls.`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const firstTeamDamage = await firstValidMember.locator(".damage-team-move-range").first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const nav = document.querySelector(".mobile-primary-nav");
    const navStyle = nav ? getComputedStyle(nav) : null;
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      availableBottom: nav && navStyle?.display !== "none" ? Math.round(nav.getBoundingClientRect().top) : window.innerHeight,
      text: element.textContent?.trim(),
    };
  });
  observations.push({ viewport: viewportName, name: "calculator-team-vs-one-first-damage", ...firstTeamDamage });
  if (viewport.width <= 420 && (firstTeamDamage.top < 0 || firstTeamDamage.bottom > firstTeamDamage.availableBottom)) {
    failures.push(`${viewportName}: o primeiro dano do Time vs 1 ficou fora da primeira dobra ou atrás da navegação fixa.`);
  }
  await safeCapture(page, viewportName, "calculator-team-vs-one-first-fold", { audit: true, fullPage: false });
  await safeCapture(page, viewportName, "calculator-team-vs-one-team", { fullPage: true });
  await safeCapture(page, viewportName, "calculator-team-vs-one", { fullPage: viewport.width > 720 });

  await page.goto(`${baseUrl}/speed-tiers?target=garchomp-mega-z`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Speed Tiers" }).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByLabel("Buscar na lista").fill("Garchomp");
  await page.locator(".speed-result-row").first().waitFor({ state: "visible", timeout: 10_000 });
  if (await page.locator(".speed-result-row").filter({ hasText: "Mega Garchomp Z" }).count() < 1) failures.push(`${viewportName}: Speed Tiers não manteve a forma Mega Garchomp Z na busca.`);
  const speedThresholds = await page.locator(".speed-threshold").allTextContents();
  if (speedThresholds.some((text) => /\b(?:3[3-9]|[4-9]\d)\s*SP\b/.test(text))) failures.push(`${viewportName}: Speed Tiers recomendou mais de 32 SP num único atributo.`);
  if (!speedThresholds.some((text) => text.includes("Não passa com até 32 SP"))) failures.push(`${viewportName}: Speed Tiers não explicou quando o alvo é inalcançável dentro do limite de 32 SP.`);
  const speedAssumptionsDisclosure = page.locator(".speed-assumptions-disclosure");
  if (!await speedAssumptionsDisclosure.evaluate((details) => details.open)) await speedAssumptionsDisclosure.locator(":scope > summary").click();
  await page.locator("#speed-target-nature").press("Enter");
  const speedTargetNatureMenu = page.locator("#speed-target-nature-options");
  await speedTargetNatureMenu.waitFor({ state: "visible", timeout: 10_000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const speedTargetNatureBounds = await speedTargetNatureMenu.evaluate((menu) => {
    const rect = menu.getBoundingClientRect();
    const nav = document.querySelector(".mobile-primary-nav");
    const navBounds = nav?.getBoundingClientRect();
    const navVisible = navBounds && navBounds.height > 0 && getComputedStyle(nav).display !== "none";
    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      viewport: window.innerWidth,
      visibleBottom: navVisible ? Math.round(navBounds.top) : window.innerHeight,
      position: getComputedStyle(menu).position,
      inlineStyle: menu.style.cssText,
    };
  });
  observations.push({ viewport: viewportName, name: "speed-tiers-target-nature-menu-bounds", ...speedTargetNatureBounds });
  if (speedTargetNatureBounds.left < -1 || speedTargetNatureBounds.right > speedTargetNatureBounds.viewport + 1
    || speedTargetNatureBounds.top < -1 || speedTargetNatureBounds.bottom > speedTargetNatureBounds.visibleBottom + 1
    || speedTargetNatureBounds.position !== "fixed") {
    failures.push(`${viewportName}: o menu de Nature do alvo em Speed Tiers deve caber na largura da tela.`);
  }
  await safeCapture(page, viewportName, "speed-tiers-target-nature-open", { audit: true, fullPage: false });
  await page.keyboard.press("Escape");
  await speedAssumptionsDisclosure.locator(":scope > summary").click();
  await page.locator(".speed-target-banner").scrollIntoViewIfNeeded();
  const speedTargetLayout = await page.locator(".speed-target-banner").evaluate((banner) => {
    const artwork = banner.querySelector(".pokemon-art").getBoundingClientRect();
    const name = banner.querySelector(".speed-target-copy h2").getBoundingClientRect();
    return { artworkRight: artwork.right, nameLeft: name.left };
  });
  observations.push({ viewport: viewportName, name: "speed-target-banner-art-fit", ...speedTargetLayout });
  if (viewport.width <= 360 && speedTargetLayout.artworkRight > speedTargetLayout.nameLeft + 1) {
    failures.push(`${viewportName}: o sprite e o nome do alvo de Speed estão sobrepostos no banner.`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await safeCapture(page, viewportName, "speed-tiers-mega-garchomp-z", { audit: true, fullPage: false });
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

    if (screen === "calculator") {
      try {
        await runQuickCalculatorInteraction(page, viewportName);
      } catch (error) {
        failures.push(viewportName + "/calculator-interaction: " + error.message);
      }
    }

    if (applicationErrors.length) {
      observations.push({ mode: "fast", viewport: viewportName, name: "quick-" + screen + "-application-errors", errors: applicationErrors });
      failures.push(viewportName + "/" + screen + ": erro de aplicação: " + applicationErrors.join(" | "));
    }
    await page.close();
  }

  await context.close();
  console.log("Visual review fast: end " + viewportName + "; " + observations.length + " observations, " + failures.length + " failures so far.");
}

async function runQuickCalculatorInteraction(page, viewportName) {
  const moves = ["Wood Hammer", "Grassy Glide", "U-turn", "Knock Off"];
  await page.route("https://pokeapi.co/**", (route) => route.abort()).catch(() => {});
  await page.goto(baseUrl + "/calculator?attacker=Rillaboom&defender=Incineroar", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Calculadora de dano" }).waitFor({ state: "visible", timeout: 10_000 });
  const attackerSide = page.locator(".damage-workbench-side").first();
  await attackerSide.getByRole("button", { name: "Catálogo do motor" }).click();
  const states = [];

  for (const [index, move] of moves.entries()) {
    if (index > 0) await attackerSide.locator(".damage-move-slot-select").nth(index).click();
    const search = attackerSide.getByRole("searchbox", { name: "Buscar golpes de Rillaboom" });
    await search.fill(move);
    const option = attackerSide.locator(".damage-move-options button").filter({ hasText: move }).first();
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();
    const resultHeading = (await page.locator(".damage-result-copy h2").textContent() || "").trim();
    const damageRange = (await page.locator(".damage-result-range strong").textContent() || "").trim();
    const active = await attackerSide.locator(".damage-move-slot-select").nth(index).getAttribute("aria-pressed");
    if (!resultHeading.includes("usa " + move) || !damageRange || active !== "true") {
      failures.push(`${viewportName}/calculator: ${move} não virou o golpe ativo com resultado visível (heading=${resultHeading}; range=${damageRange}; active=${active}).`);
    }
    states.push({ move, resultHeading, damageRange, active: active === "true" });
    if (viewportName === "desktop") {
      const slug = move.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await capture(page, viewportName, `calculator-move-${index + 1}-${slug}`, { audit: false, fullPage: false });
    }
  }

  const moveSlotCount = await attackerSide.locator(".damage-move-slot").count();
  if (moveSlotCount !== 4) failures.push(`${viewportName}/calculator: esperava 4 slots de golpe e encontrei ${moveSlotCount}.`);
  if (viewportName === "mobile") {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await capture(page, viewportName, "calculator-four-moves-selected", { audit: false, fullPage: false });
  }
  observations.push({ mode: "fast", viewport: viewportName, name: "calculator-four-move-selection", moveSlotCount, states });

  const firstMoveSlot = attackerSide.locator(".damage-move-slot-select").first();
  await firstMoveSlot.focus();
  await page.keyboard.press("Enter");
  const keyboardSelectedMove = {
    pressed: await firstMoveSlot.getAttribute("aria-pressed"),
    resultHeading: (await page.locator(".damage-result-copy h2").textContent() || "").trim(),
  };
  if (keyboardSelectedMove.pressed !== "true" || !keyboardSelectedMove.resultHeading.includes("usa Wood Hammer")) {
    failures.push(`${viewportName}/calculator: teclado não ativou o primeiro slot nem atualizou o dano.`);
  }
  observations.push({ mode: "fast", viewport: viewportName, name: "calculator-keyboard-move-selection", ...keyboardSelectedMove });
  if (viewportName === "desktop") {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await capture(page, viewportName, "calculator-keyboard-active-move", { audit: false, fullPage: false });
  }

  if (viewportName !== "desktop") return;

  const changeSpecies = async (name) => {
    await attackerSide.getByLabel("Pokémon", { exact: true }).fill(name);
    await page.waitForTimeout(80);
  };
  const selectMove = async (species, move) => {
    await attackerSide.getByRole("button", { name: "Catálogo do motor" }).click();
    const search = attackerSide.getByRole("searchbox", { name: `Buscar golpes de ${species}` });
    await search.fill(move);
    const option = attackerSide.locator(".damage-move-options button").filter({ hasText: move }).first();
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();
  };
  const readRange = async () => (await page.locator(".damage-result-range strong").textContent() || "").trim();
  const numericRange = (value) => value.replace(/[^0-9.]/g, "");

  await changeSpecies("Azumarill");
  await selectMove("Azumarill", "Play Rough");
  const azumarillBase = await readRange();
  const setDetails = attackerSide.locator(".damage-side-settings");
  if (!(await setDetails.evaluate((details) => details.open))) await setDetails.locator(":scope > summary").click();
  await attackerSide.getByLabel("Habilidade", { exact: true }).selectOption({ label: "Huge Power" });
  const azumarillAbility = await readRange();
  if (!azumarillBase || numericRange(azumarillBase) === numericRange(azumarillAbility)) failures.push(`${viewportName}/calculator: Huge Power não atualizou o dano de Play Rough.`);
  await attackerSide.getByLabel("Item", { exact: true }).selectOption({ label: "Life Orb" });
  const azumarillItem = await readRange();
  if (numericRange(azumarillAbility) === numericRange(azumarillItem)) failures.push(`${viewportName}/calculator: Life Orb não atualizou o dano de Play Rough.`);
  const nature = attackerSide.locator("#damage-attacker-nature");
  await nature.click();
  await page.locator(".nature-picker-options").getByRole("button", { name: /Adamant/ }).click();
  const azumarillNature = await readRange();
  if (numericRange(azumarillItem) === numericRange(azumarillNature)) failures.push(`${viewportName}/calculator: Nature Adamant não atualizou o dano de Play Rough.`);
  const advanced = attackerSide.locator(".damage-advanced");
  if (!(await advanced.evaluate((details) => details.open))) await advanced.locator(":scope > summary").click();
  await attackerSide.getByLabel("Atk", { exact: true }).fill("252");
  const azumarillStats = await readRange();
  if (numericRange(azumarillNature) === numericRange(azumarillStats)) failures.push(`${viewportName}/calculator: 252 SP em Atk não atualizou o dano.`);

  await attackerSide.getByLabel("Habilidade", { exact: true }).selectOption("");
  await attackerSide.getByLabel("Item", { exact: true }).selectOption("");
  await attackerSide.locator(".damage-side-settings #damage-attacker-nature").click();
  await page.locator(".nature-picker-options").getByRole("button", { name: /^Serious/ }).click();
  await changeSpecies("Garchomp-Mega-Z");
  await selectMove("Garchomp-Mega-Z", "Earthquake");
  const formHeading = (await page.locator(".damage-result-copy h2").textContent() || "").trim();
  const formAbility = await attackerSide.getByLabel("Habilidade", { exact: true }).locator("option").allTextContents();
  const formSprite = await attackerSide.locator(".damage-side-art").getAttribute("data-sprite-url").catch(() => "");
  const formSlug = await attackerSide.locator(".damage-side-art").getAttribute("data-pokemon-slug").catch(() => "");
  const formSideLabel = (await attackerSide.locator(".damage-side-heading").innerText()).trim();
  if (!formHeading.includes("usa Earthquake") || !formAbility.includes("Levitate") || formSlug !== "garchomp-mega-z" || !formSprite.includes("/10309.png") || !formSideLabel.includes("Mega Garchomp Z")) failures.push(`${viewportName}/calculator: a forma Mega Garchomp Z ou a habilidade própria da forma não foi atualizada (result=${formHeading}; side=${formSideLabel}; slug=${formSlug}; sprite=${formSprite}; abilities=${formAbility.join(", ")}).`);
  const megaFormRange = await readRange();
  observations.push({ mode: "fast", viewport: viewportName, name: "calculator-alternate-form", formHeading, formSideLabel, formSprite, abilities: formAbility, damageRange: megaFormRange });

  await changeSpecies("Charizard");
  await selectMove("Charizard", "Flamethrower");
  const charizardBase = await readRange();
  await page.locator(".damage-field-deck .damage-field select").nth(1).selectOption({ label: "Sun" });
  const charizardSun = await readRange();
  if (!charizardBase || numericRange(charizardBase) === numericRange(charizardSun)) failures.push(`${viewportName}/calculator: Sun não atualizou o dano de Flamethrower.`);
  await changeSpecies("Rillaboom");
  await selectMove("Rillaboom", "Grassy Glide");
  const grassyGlideDryGround = await readRange();
  await page.locator(".damage-field-deck .damage-field select").nth(2).selectOption({ label: "Grassy" });
  const grassyGlideTerrain = await readRange();
  if (!grassyGlideDryGround || numericRange(grassyGlideDryGround) === numericRange(grassyGlideTerrain)) failures.push(`${viewportName}/calculator: Grassy Terrain não atualizou o dano de Grassy Glide.`);

  observations.push({
    mode: "fast", viewport: viewportName, name: "calculator-calculation-controls",
    azumarill: { base: azumarillBase, hugePower: azumarillAbility, lifeOrb: azumarillItem, adamant: azumarillNature, attack252: azumarillStats },
    alternateForm: { heading: formHeading, range: megaFormRange, abilities: formAbility },
    field: { charizardBase, sun: charizardSun, grassyGlideDryGround, grassyGlideTerrain },
  });
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
