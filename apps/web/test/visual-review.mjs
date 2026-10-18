import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const outputDir = resolve(process.env.VISUAL_OUTPUT_DIR || join(root, "artifacts/visual-review"));
const baseUrl = "http://127.0.0.1:4173";
const observations = [];
const failures = [];
const accessibilityIssues = [];

await mkdir(outputDir, { recursive: true });

const server = spawn(process.execPath, [
  join(root, "node_modules/vite/bin/vite.js"), "preview",
  "--host", "127.0.0.1", "--port", "4173", "--strictPort",
], { cwd: join(root, "apps/web"), stdio: "inherit" });

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

async function waitForUsage(page, selector = ".usage-index-note, .usage-index-error") {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeoutMs: 35_000 });
  } catch {
    const state = await page.locator("body").innerText({ timeoutMs: 5_000 });
    failures.push(`Usage não chegou a um estado de sucesso ou erro: ${state.slice(0, 240)}`);
  }
}

async function capture(page, viewport, name, { audit = false } = {}) {
  const file = join(outputDir, `${viewport}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
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
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
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
  try {
    await capture(page, viewport, name, options);
  } catch (error) {
    failures.push(`${viewport}/${name}: ${error.message}`);
  }
}

async function waitForEither(page, selector, timeout = 35_000) {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeoutMs: timeout });
    return true;
  } catch {
    return false;
  }
}

async function runViewport(viewportName, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await safeCapture(page, viewportName, "home", { audit: true });
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
    await page.getByRole("heading", { name: "Pokédex" }).waitFor({ state: "visible", timeoutMs: 10_000 });
  }

  await page.goto(`${baseUrl}/dex`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pokédex" }).waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(page, viewportName, "pokedex", { audit: true });
  const search = page.getByPlaceholder("Buscar por nome, forma ou número");
  await search.fill("Garchomp");
  await page.locator(".pokemon-card").first().waitFor({ state: "visible", timeoutMs: 10_000 });
  await page.locator(".pokemon-card-title").first().click();
  await page.getByRole("heading", { name: /Garchomp/ }).waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(page, viewportName, "pokemon-sheet", { audit: true });
  await page.goto(`${baseUrl}/dex`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Buscar por nome, forma ou número").fill("spindastop-no-match-457");
  await page.locator(".empty-state-panel").waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(page, viewportName, "pokedex-empty");

  await page.goto(`${baseUrl}/builder`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Monte seu time" }).waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(page, viewportName, "builder-empty", { audit: true });
  await page.getByRole("button", { name: "Escolher espécie" }).first().click();
  await page.getByLabel("Nome ou número").fill("Garchomp");
  await page.locator(".species-dialog .picker-result").first().click();
  await page.getByRole("heading", { name: "Garchomp", exact: true }).waitFor({ state: "visible", timeoutMs: 10_000 });
  await page.getByLabel("Item", { exact: true }).fill("Clear Amulet");
  await page.getByLabel("Nature", { exact: true }).fill("Adamant");
  await page.locator("#move-0").fill("Earthquake");
  await page.locator(".points-section summary").click();
  await page.locator("#stat-atk").fill("14");
  const downloadReady = page.waitForEvent("download", { timeoutMs: 10_000 });
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
  await page.getByText("Equipe importada e salva neste navegador.").waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(page, viewportName, "builder-preserved-set", { audit: true });
  await page.locator(".team-slot").nth(1).click();
  const pickerSearch = page.getByLabel("Nome ou número");
  if (await pickerSearch.count()) {
    await pickerSearch.fill("Arboliva");
    await page.locator(".species-dialog .picker-result").first().click();
  }
  await safeCapture(page, viewportName, "builder-two-sides");
  await page.getByRole("link", { name: /como atacante/i }).click();
  await page.getByRole("heading", { name: /Cenário|Resultado/ }).waitFor({ state: "visible", timeoutMs: 10_000 }).catch(() => {});
  await safeCapture(page, viewportName, "calculator-from-builder", { audit: true });

  await page.goto(`${baseUrl}/usage?pokemon=Garchomp`, { waitUntil: "domcontentloaded" });
  await waitForUsage(page);
  if (await page.locator(".usage-index-note").count()) {
    await waitForEither(page, ".usage-provenance, .usage-error", 35_000);
  }
  await safeCapture(page, viewportName, "usage-battle-data", { audit: true });
  if (await page.locator(".usage-index-note").count()) {
    const usageSearch = page.locator(".usage-browser-panel input[type=search]");
    await usageSearch.fill("spindastop-no-match-457");
    await page.locator(".usage-no-results").waitFor({ state: "visible", timeoutMs: 10_000 });
    await safeCapture(page, viewportName, "usage-empty");
    await usageSearch.fill("Garchomp");
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
    await safeCapture(page, viewportName, "usage-filtered");
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await usageSearch.fill("Garchomp");
    await page.locator('.usage-filters .usage-filter-field:has-text("Período") select').selectOption("history");
    await waitForEither(page, ".usage-snapshot-picker, .usage-no-snapshots, .usage-error", 35_000);
    await safeCapture(page, viewportName, "usage-history");
  }

  const metaRollButton = page.getByRole("button", { name: "MetaRoll", exact: true });
  if (await metaRollButton.count()) {
    await metaRollButton.press("Enter");
    const activeSource = page.locator(".usage-source-switch button.is-active");
    await activeSource.filter({ hasText: "MetaRoll" }).waitFor({ state: "visible", timeoutMs: 10_000 });
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
    await page.locator(".usage-source-switch button.is-active").filter({ hasText: "Battle Data" }).waitFor({ state: "visible", timeoutMs: 10_000 });
  } else {
    failures.push(`${viewportName}: o seletor de fonte não está disponível no Usage de Battle Data.`);
  }

  await page.goto(`${baseUrl}/usage?source=metaroll&pokemon=Tauros-Paldea-Aqua`, { waitUntil: "domcontentloaded" });
  const metaRollLoaded = await waitForEither(page, ".metaroll-capture-note, .usage-index-error");
  if (await page.locator(".metaroll-capture-note").count()) {
    await waitForEither(page, ".metaroll-provenance, .usage-error", 35_000);
  }
  await safeCapture(page, viewportName, "usage-metaroll", { audit: true });
  if (metaRollLoaded && await page.locator(".metaroll-capture-note").count()) {
    await safeCapture(page, viewportName, "usage-matchups-history");
    await page.getByRole("button", { name: "Ladder de jogadores" }).click();
    await waitForEither(page, ".metaroll-ladder-capture, .usage-error", 35_000);
    await safeCapture(page, viewportName, "usage-ladder", { audit: true });
    await page.getByRole("button", { name: "Espécies" }).click();
    await page.locator(".usage-browser-panel input[type=search]").fill("spindastop-no-match-457");
    await page.locator(".usage-no-results").waitFor({ state: "visible", timeoutMs: 10_000 });
    await safeCapture(page, viewportName, "usage-metaroll-empty");
  }

  const errorPage = await context.newPage();
  await errorPage.route("https://championsbattledata.com/**", (route) => route.abort());
  await errorPage.goto(`${baseUrl}/usage`, { waitUntil: "domcontentloaded" });
  await errorPage.locator(".usage-index-error").waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(errorPage, viewportName, "usage-battle-data-error");
  await errorPage.goto(`${baseUrl}/usage?source=metaroll`, { waitUntil: "domcontentloaded" });
  await errorPage.route("https://metaroll.app/**", (route) => route.abort()).catch(() => {});
  await errorPage.reload({ waitUntil: "domcontentloaded" });
  await errorPage.locator(".usage-index-error").waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(errorPage, viewportName, "usage-metaroll-error");
  await errorPage.close();

  await page.goto(`${baseUrl}/calculator`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Calculadora de dano" }).waitFor({ state: "visible", timeoutMs: 10_000 }).catch(() => {});
  await safeCapture(page, viewportName, "calculator", { audit: true });
  await page.getByLabel("Comparar com outro cenário").check();
  await page.locator(".damage-comparison-results").waitFor({ state: "visible", timeoutMs: 10_000 });
  await safeCapture(page, viewportName, "calculator-comparison", { audit: true });

  if (pageErrors.length) failures.push(`${viewportName}: erros no app: ${pageErrors.join(" | ")}`);
  await context.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    try {
      await runViewport(name, viewport);
    } catch (error) {
      failures.push(`${name}: inspeção interrompida — ${error.message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: failures.length || accessibilityIssues.length ? "needs-review" : "passed",
    observations,
    accessibilityIssues,
    failures,
  };
  await writeFile(join(outputDir, "inspection.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (failures.length || accessibilityIssues.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
