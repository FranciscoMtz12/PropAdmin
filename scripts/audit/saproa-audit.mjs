/**
 * SAPROA Diagnóstico Fase 0 — Script de auditoría con Playwright
 * Solo lectura: no modifica datos, limpia cualquier dato de prueba creado.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const BASE_URL = "https://www.saproa.com";
const EMAIL = "fco.mtz.c@hotmail.com";
const PASSWORD = "Pruebas1";

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function toBase64(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return "data:image/png;base64," + fs.readFileSync(filePath).toString("base64");
}

async function measurePageLoad(page, url, label) {
  const start = Date.now();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  const elapsed = Date.now() - start;
  return { label, url, ms: elapsed, status: elapsed < 1500 ? "pass" : elapsed < 3000 ? "warn" : "fail" };
}

async function captureEarly(page, url, label, delayMs = 200) {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForTimeout(delayMs);
  const shot = path.join(SCREENSHOTS_DIR, `${label}_${delayMs}ms.png`);
  await page.screenshot({ path: shot, fullPage: false });
  return shot;
}

async function run() {
  const results = {
    loginBounce: [],
    foucScreenshots: [],
    pageLoads: [],
    viewportScreenshots: [],
    themeScreenshots: [],
    mobileScreenshots: [],
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });

  // ═══ 1. LOGIN BOUNCE — capturar secuencia de navigación ═══
  console.log("\n[1] Testing login bounce...");
  try {
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page1 = await ctx1.newPage();
    const navLog = [];
    const start = Date.now();
    page1.on("framenavigated", (frame) => {
      if (frame === page1.mainFrame()) {
        navLog.push({ url: frame.url(), ms: Date.now() - start });
      }
    });
    // Ir a login
    await page1.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    navLog.push({ event: "ARRIVED_AT_LOGIN", url: page1.url(), ms: Date.now() - start });
    // Fill form
    await page1.fill('input[type="email"]', EMAIL);
    await page1.fill('input[type="password"]', PASSWORD);
    // Screenshot antes de submit
    const beforeLogin = path.join(SCREENSHOTS_DIR, "01_before_login.png");
    await page1.screenshot({ path: beforeLogin });
    // Submit
    await page1.click('button[type="submit"]');
    // Wait for navigation to settle
    await page1.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page1.waitForTimeout(3000);
    const afterLogin = path.join(SCREENSHOTS_DIR, "02_after_login.png");
    await page1.screenshot({ path: afterLogin });
    navLog.push({ event: "FINAL_URL", url: page1.url(), ms: Date.now() - start });
    results.loginBounce = navLog;
    results.loginBounceScreenshots = { before: toBase64(beforeLogin), after: toBase64(afterLogin) };
    console.log("  Nav log:", JSON.stringify(navLog, null, 2));
    await ctx1.close();
  } catch (e) {
    results.errors.push({ phase: "loginBounce", error: e.message });
    console.error("  Error:", e.message);
  }

  // ═══ 2. FOUC — screenshots tempranos post-login ═══
  console.log("\n[2] Testing FOUC (flash of brand color)...");
  try {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    // Login first
    await page2.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page2.fill('input[type="email"]', EMAIL);
    await page2.fill('input[type="password"]', PASSWORD);
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ timeout: 10000 }).catch(() => {});
    // Now visit dashboard and capture early
    const foucShots = [];
    for (const delay of [50, 150, 300, 500, 1000]) {
      try {
        const ctx_f = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          storageState: await ctx2.storageState(),
        });
        const pf = await ctx_f.newPage();
        await pf.goto(`${BASE_URL}/dashboard`, { waitUntil: "commit" });
        await pf.waitForTimeout(delay);
        const fShot = path.join(SCREENSHOTS_DIR, `fouc_${delay}ms.png`);
        await pf.screenshot({ path: fShot });
        // Check computed --accent value
        const accent = await pf.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
        });
        foucShots.push({ delay, shot: toBase64(fShot), accent });
        console.log(`  ${delay}ms → --accent: ${accent}`);
        await ctx_f.close();
      } catch (e) {
        foucShots.push({ delay, error: e.message });
      }
    }
    results.foucScreenshots = foucShots;
    await ctx2.close();
  } catch (e) {
    results.errors.push({ phase: "fouc", error: e.message });
    console.error("  Error:", e.message);
  }

  // ═══ A. PERFORMANCE — tiempos de carga ═══
  console.log("\n[A] Measuring page load times...");
  try {
    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page3 = await ctx3.newPage();
    // Login
    await page3.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page3.fill('input[type="email"]', EMAIL);
    await page3.fill('input[type="password"]', PASSWORD);
    await page3.click('button[type="submit"]');
    await page3.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page3.waitForTimeout(2000);

    const pages = [
      { url: `${BASE_URL}/dashboard`, label: "Dashboard" },
      { url: `${BASE_URL}/buildings`, label: "Buildings" },
      { url: `${BASE_URL}/servicios`, label: "Servicios" },
      { url: `${BASE_URL}/collections`, label: "Cobranza" },
      { url: `${BASE_URL}/purchases`, label: "Compras" },
      { url: `${BASE_URL}/maintenance`, label: "Mantenimiento" },
      { url: `${BASE_URL}/analytics`, label: "Analytics" },
    ];

    for (const p of pages) {
      try {
        const t = Date.now();
        await page3.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
        const ms = Date.now() - t;
        const shot = path.join(SCREENSHOTS_DIR, `page_${p.label.toLowerCase()}.png`);
        await page3.screenshot({ path: shot, fullPage: false });
        results.pageLoads.push({ ...p, ms, status: ms < 1500 ? "pass" : ms < 3000 ? "warn" : "fail", screenshot: toBase64(shot) });
        console.log(`  ${p.label}: ${ms}ms (${ms < 1500 ? "✓" : ms < 3000 ? "⚠" : "✗"})`);
      } catch (e) {
        results.pageLoads.push({ ...p, ms: -1, status: "error", error: e.message });
        console.error(`  ${p.label}: ERROR - ${e.message}`);
      }
    }
    await ctx3.close();
  } catch (e) {
    results.errors.push({ phase: "performance", error: e.message });
    console.error("  Error:", e.message);
  }

  // ═══ 4. VIEWPORT SCREENSHOTS — 1280, 1440, 1920 ═══
  console.log("\n[4] Viewport comparison screenshots...");
  try {
    for (const vw of [1280, 1440, 1920]) {
      const ctx_v = await browser.newContext({ viewport: { width: vw, height: 800 } });
      const pv = await ctx_v.newPage();
      await pv.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
      await pv.fill('input[type="email"]', EMAIL);
      await pv.fill('input[type="password"]', PASSWORD);
      await pv.click('button[type="submit"]');
      await pv.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await pv.waitForTimeout(2000);

      for (const pg of ["/dashboard", "/buildings"]) {
        try {
          await pv.goto(`${BASE_URL}${pg}`, { waitUntil: "networkidle", timeout: 20000 });
          const shot = path.join(SCREENSHOTS_DIR, `viewport_${vw}_${pg.replace("/", "")}.png`);
          await pv.screenshot({ path: shot, fullPage: false });
          results.viewportScreenshots.push({ viewport: vw, page: pg, shot: toBase64(shot) });
          console.log(`  ${vw}px × ${pg}: captured`);
        } catch(e) {
          results.viewportScreenshots.push({ viewport: vw, page: pg, error: e.message });
        }
      }
      await ctx_v.close();
    }
  } catch (e) {
    results.errors.push({ phase: "viewports", error: e.message });
  }

  // ═══ D. MOBILE — 375px ═══
  console.log("\n[D] Mobile screenshots (375px)...");
  try {
    const ctx_m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
    const pm = await ctx_m.newPage();
    await pm.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await pm.fill('input[type="email"]', EMAIL);
    await pm.fill('input[type="password"]', PASSWORD);
    await pm.click('button[type="submit"]');
    await pm.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await pm.waitForTimeout(2000);
    for (const pg of ["/dashboard", "/buildings", "/purchases"]) {
      try {
        await pm.goto(`${BASE_URL}${pg}`, { waitUntil: "networkidle", timeout: 20000 });
        const shot = path.join(SCREENSHOTS_DIR, `mobile_${pg.replace("/", "")}.png`);
        await pm.screenshot({ path: shot, fullPage: true });
        results.mobileScreenshots.push({ page: pg, shot: toBase64(shot) });
        console.log(`  mobile ${pg}: captured`);
      } catch(e) {
        results.mobileScreenshots.push({ page: pg, error: e.message });
      }
    }
    await ctx_m.close();
  } catch(e) {
    results.errors.push({ phase: "mobile", error: e.message });
  }

  // ═══ C. TEMAS — 3 temas × dark/light ═══
  console.log("\n[C] Theme combination screenshots...");
  try {
    const themes = ["clasico", "super_soft", "rigido"];
    for (const theme of themes) {
      for (const dark of [false, true]) {
        try {
          const ctx_t = await browser.newContext({ viewport: { width: 1280, height: 800 } });
          const pt = await ctx_t.newPage();
          await pt.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
          await pt.fill('input[type="email"]', EMAIL);
          await pt.fill('input[type="password"]', PASSWORD);
          await pt.click('button[type="submit"]');
          await pt.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await pt.waitForTimeout(2000);
          // Apply theme via localStorage
          await pt.evaluate(([t, d]) => {
            const lastUid = localStorage.getItem("last_user_id");
            if (lastUid) {
              localStorage.setItem(`uiTheme_${lastUid}`, t);
              localStorage.setItem(`darkMode_${lastUid}`, d ? "true" : "false");
            }
            document.documentElement.setAttribute("data-theme", t);
            document.documentElement.classList.toggle("dark", d);
          }, [theme, dark]);
          await pt.waitForTimeout(500);
          const shot = path.join(SCREENSHOTS_DIR, `theme_${theme}_${dark ? "dark" : "light"}.png`);
          await pt.screenshot({ path: shot, fullPage: false });
          results.themeScreenshots.push({ theme, dark, shot: toBase64(shot) });
          console.log(`  ${theme}/${dark ? "dark" : "light"}: captured`);
          await ctx_t.close();
        } catch(e) {
          results.themeScreenshots.push({ theme, dark, error: e.message });
        }
      }
    }
  } catch(e) {
    results.errors.push({ phase: "themes", error: e.message });
  }

  await browser.close();

  // Write results JSON
  const resultsPath = path.join(__dirname, "audit-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Results written to ${resultsPath}`);
  return results;
}

run().then(r => {
  console.log("\n═══ AUDIT COMPLETE ═══");
  console.log(`Page loads: ${r.pageLoads.length}`);
  console.log(`FOUC shots: ${r.foucScreenshots.length}`);
  console.log(`Login bounce events: ${r.loginBounce.length}`);
  console.log(`Errors: ${r.errors.length}`);
}).catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
