/**
 * Diagnostic: traces --accent CSS variable timeline and localStorage during login → home
 * Run: node scripts/audit/diagnose-flash.mjs <email> <password>
 */
import { chromium } from "playwright";

const email    = process.argv[2] ?? "";
const password = process.argv[3] ?? "";
const BASE_URL = "http://localhost:3000";

if (!email || !password) {
  console.error("Usage: node diagnose-flash.mjs <email> <password>");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  /* ── Paso 1: ir a login y asegurarse de que no haya sesión activa ── */
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload();
  await page.waitForLoadState("networkidle");

  /* ── Paso 2: leer estado inicial de localStorage ────────────────── */
  const lsBeforeLogin = await page.evaluate(() => ({
    last_user_id: localStorage.getItem("last_user_id"),
    allKeys: Object.keys(localStorage).filter(k => k.includes("accent") || k.includes("last_user")),
  }));
  console.log("\n=== ANTES DEL LOGIN ===");
  console.log("localStorage:", JSON.stringify(lsBeforeLogin));

  /* ── Paso 3: iniciar polling de --accent y localStorage ─────────── */
  const timeline = [];
  let polling = true;

  async function poll() {
    const t0 = Date.now();
    while (polling) {
      const sample = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const accent = style.getPropertyValue("--accent").trim();
        const colorPrimary = style.getPropertyValue("--color-primary").trim();
        const inlineAccent = document.documentElement.style.getPropertyValue("--accent").trim();
        const lsKeys = Object.fromEntries(
          Object.keys(localStorage)
            .filter(k => k.includes("accent") || k.includes("last_user"))
            .map(k => [k, localStorage.getItem(k)])
        );
        return { accent, colorPrimary, inlineAccent, ls: lsKeys };
      });
      sample.ms = Date.now() - t0;
      timeline.push(sample);
      await new Promise(r => setTimeout(r, 16)); // ~1 frame
    }
  }

  /* ── Paso 4: login ─────────────────────────────────────────────── */
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const pollPromise = poll();
  const t0 = Date.now();

  await page.click('button[type="submit"]');
  console.log(`\n=== SUBMIT CLICK (t=0ms) ===`);

  /* Esperar a que la URL cambie a /home o similar */
  try {
    await page.waitForURL(url => !url.href.includes("/login"), { timeout: 10000 });
  } catch {
    console.error("URL no cambió en 10s");
  }

  const urlAfterNav = page.url();
  const msAfterNav = Date.now() - t0;
  console.log(`\n=== NAVEGACIÓN A ${urlAfterNav} (t=${msAfterNav}ms) ===`);

  /* Esperar a que el color se estabilice (sin cambio durante 500ms) */
  let stableCount = 0;
  let lastAccent = "";
  const waitForStable = new Promise(resolve => {
    const check = setInterval(() => {
      const last = timeline[timeline.length - 1];
      if (!last) return;
      if (last.accent === lastAccent) {
        stableCount++;
        if (stableCount > 30) { clearInterval(check); resolve(); }
      } else {
        stableCount = 0;
        lastAccent = last.accent;
      }
    }, 16);
  });

  await Promise.race([waitForStable, new Promise(r => setTimeout(r, 5000))]);
  polling = false;
  await pollPromise.catch(() => {});

  /* ── Paso 5: reportar línea de tiempo ────────────────────────────── */
  console.log("\n=== LÍNEA DE TIEMPO (solo cambios) ===");
  let prev = null;
  for (const s of timeline) {
    const changed = !prev
      || s.accent !== prev.accent
      || s.inlineAccent !== prev.inlineAccent
      || JSON.stringify(s.ls) !== JSON.stringify(prev.ls);

    if (changed) {
      console.log(`t=${String(s.ms).padStart(5)}ms | computed --accent="${s.accent}" | inline="${s.inlineAccent}" | ls=${JSON.stringify(s.ls)}`);
      prev = s;
    }
  }

  /* ── Paso 6: estado final de localStorage ────────────────────────── */
  const lsAfterStable = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter(k => k.includes("accent") || k.includes("last_user"))
        .map(k => [k, localStorage.getItem(k)])
    )
  );
  console.log("\n=== ESTADO FINAL localStorage ===");
  console.log(JSON.stringify(lsAfterStable, null, 2));

  await browser.close();
})();
