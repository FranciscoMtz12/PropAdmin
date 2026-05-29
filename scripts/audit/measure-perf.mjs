/**
 * Performance measurement: mide tiempo hasta networkidle en cada página principal.
 * Requiere credenciales de admin con acceso a todas las secciones.
 * Run: node scripts/audit/measure-perf.mjs <email> <password>
 *
 * Output: tabla página → ms → veredicto
 */
import { chromium } from "playwright";

const email    = process.argv[2] ?? "";
const password = process.argv[3] ?? "";
const BASE_URL = "http://localhost:3000";

if (!email || !password) {
  console.error("Usage: node measure-perf.mjs <email> <password>");
  process.exit(1);
}

const PAGES = [
  { label: "/home",           path: "/home" },
  { label: "/dashboard",      path: "/dashboard" },
  { label: "/buildings",      path: "/buildings" },
  { label: "/servicios",      path: "/servicios" },
  { label: "/cobranza",       path: "/cobranza" },
  { label: "/compras",        path: "/compras" },
  { label: "/mantenimiento",  path: "/mantenimiento" },
  { label: "/analytics",      path: "/analytics" },
];

function verdict(ms) {
  if (ms < 1500) return "✅ OK";
  if (ms < 3000) return "⚠️  WARN";
  return "🔴 CRÍTICO";
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const loginPage = await context.newPage();

  // 1. Login
  console.log("Logging in…");
  await loginPage.goto(`${BASE_URL}/login`);
  await loginPage.fill('input[type="email"]', email);
  await loginPage.fill('input[type="password"]', password);
  await loginPage.click('button[type="submit"]');
  try {
    await loginPage.waitForURL(url => !url.href.includes("/login"), { timeout: 15000 });
  } catch {
    console.error("Login failed or timed out");
    await browser.close();
    process.exit(1);
  }

  // 2. Measure each page (reuse context so auth cookies are preserved)
  const results = [];
  for (const { label, path } of PAGES) {
    const page = await context.newPage();
    const t0 = Date.now();
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout: 20000 });
    } catch {
      // timeout or navigation error — record what we have
    }
    const ms = Date.now() - t0;
    const finalUrl = page.url();
    const redirected = !finalUrl.includes(path) ? ` → ${finalUrl.replace(BASE_URL, "")}` : "";
    results.push({ label: label + redirected, ms });
    await page.close();
    console.log(`  ${verdict(ms)}  ${label}  ${ms}ms${redirected}`);
  }

  // 3. Summary table
  console.log("\n┌──────────────────────────────┬──────────┬───────────┐");
  console.log("│ Página                       │    ms    │ Veredicto │");
  console.log("├──────────────────────────────┼──────────┼───────────┤");
  for (const r of results) {
    const page = r.label.padEnd(30);
    const ms   = String(r.ms).padStart(8);
    const v    = verdict(r.ms);
    console.log(`│ ${page}│ ${ms} │ ${v}    │`);
  }
  console.log("└──────────────────────────────┴──────────┴───────────┘");

  await browser.close();
})();
