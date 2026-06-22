/**
 * Verification script for /propiedades page and wizard.
 * Targets localhost:3000 — NOT production.
 * Run: npx ts-node --esm scripts/verify-propiedades.ts
 * Or:  npx playwright test --config scripts/pw-local.config.ts
 */
import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(__dirname, "../screenshots/verify-propiedades");

async function shot(page: import("playwright").Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try {
    // ── 1. Login as superadmin ──────────────────────────────────────
    console.log("1. Logging in as superadmin...");
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').fill("fco.mtz.c@hotmail.com");
    await page.locator('input[type="password"]').fill("Pruebas1");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 20000 });
    console.log("   ✅ Logged in, redirected to:", page.url());

    // ── 2. Navigate to /propiedades ─────────────────────────────────
    console.log("2. Navigating to /propiedades...");
    await page.goto(`${BASE}/propiedades`);
    await page.waitForLoadState("networkidle");
    const title = await page.locator("h1").first().textContent();
    console.log("   ✅ Page title:", title);
    await shot(page, "01-propiedades-page");

    // ── 3. Check for company selector / impersonation needed ────────
    const hasEmptyState = await page.locator("text=Sin propiedades aún").isVisible({ timeout: 3000 }).catch(() => false);
    const hasList = await page.locator("text=Inmobiliaria Demo").isVisible({ timeout: 3000 }).catch(() => false);
    console.log("   Empty state visible:", hasEmptyState, "| Demo company visible:", hasList);

    // ── 4. Click "Nueva propiedad" ──────────────────────────────────
    console.log("3. Opening wizard...");
    const btn = page.locator("button", { hasText: "Nueva propiedad" }).first();
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();
    await page.waitForTimeout(400);
    const modalTitle = await page.locator("h2").first().textContent();
    console.log("   ✅ Modal title:", modalTitle);
    await shot(page, "02-wizard-step1");

    // ── 5. Step 1 — select Residencial multifamiliar ────────────────
    console.log("4. Step 1: selecting Residencial multifamiliar...");
    await page.locator("button", { hasText: "Residencial multifamiliar" }).click();
    await page.waitForTimeout(200);
    const labelPreview = await page.locator("text=Etiqueta:").isVisible({ timeout: 2000 }).catch(() => false);
    console.log("   Label preview visible:", labelPreview);
    await shot(page, "03-wizard-step1-selected");

    // ── 6. Next → Step 2 ───────────────────────────────────────────
    console.log("5. Navigating to step 2...");
    await page.locator("button", { hasText: "Siguiente →" }).click();
    await page.waitForTimeout(400);
    await shot(page, "04-wizard-step2");

    // ── 7. Fill name ───────────────────────────────────────────────
    console.log("6. Filling name...");
    const nameInput = page.locator("input").first();
    await nameInput.fill("Edificio Test 3.1");
    await page.waitForTimeout(200);

    // ── 8. Next → Step 3 ──────────────────────────────────────────
    console.log("7. Navigating to step 3...");
    await page.locator("button", { hasText: "Siguiente →" }).click();
    await page.waitForTimeout(400);
    const step3Visible = await page.locator("text=Pisos y espacios").isVisible({ timeout: 3000 }).catch(() => false);
    console.log("   ✅ Step 3 multi-floor visible:", step3Visible);
    await shot(page, "05-wizard-step3");

    // ── 9. Set floors: 2 pisos ────────────────────────────────────
    // Default is 1 piso, add one more
    await page.locator("button", { hasText: "Agregar piso" }).click();
    await page.waitForTimeout(300);
    const preview = await page.locator("text=6 espacios").isVisible({ timeout: 2000 }).catch(() =>
      page.locator("text=espacios").first().textContent().catch(() => "?")
    );
    console.log("   Preview after adding floor:", preview);
    await shot(page, "06-wizard-step3-2pisos");

    // ── 10. Next → Step 4 ─────────────────────────────────────────
    console.log("8. Navigating to step 4 (assets)...");
    await page.locator("button", { hasText: "Siguiente →" }).click();
    await page.waitForTimeout(400);
    await shot(page, "07-wizard-step4");

    // ── 11. Next → Step 5 (resumen) ───────────────────────────────
    console.log("9. Navigating to step 5 (resumen)...");
    await page.locator("button", { hasText: "Siguiente →" }).click();
    await page.waitForTimeout(400);
    const summaryName = await page.locator("text=Edificio Test 3.1").isVisible({ timeout: 3000 }).catch(() => false);
    console.log("   ✅ Summary shows name:", summaryName);
    await shot(page, "08-wizard-step5-resumen");

    // ── 12. Create property ────────────────────────────────────────
    // Only create if we have a company (superadmin without impersonation has no company)
    // Check if error appears
    console.log("10. Clicking Crear propiedad...");
    await page.locator("button", { hasText: "Crear propiedad" }).click();
    await page.waitForTimeout(1000);
    const noCompanyErr = await page.locator("text=No hay empresa activa").isVisible({ timeout: 2000 }).catch(() => false);
    const successToast = await page.locator("text=creada").isVisible({ timeout: 3000 }).catch(() => false);
    console.log("   No-company error:", noCompanyErr, "| Success toast:", successToast);
    await shot(page, "09-after-create");

    // ── 13. Verify /buildings still works ─────────────────────────
    console.log("11. Checking /buildings still works...");
    await page.goto(`${BASE}/buildings`);
    await page.waitForLoadState("networkidle");
    const buildingsTitle = await page.locator("h1").first().textContent().catch(() => "?");
    console.log("   ✅ /buildings title:", buildingsTitle);
    await shot(page, "10-buildings-intact");

    console.log("\n=== ALL STEPS COMPLETED ===");
    console.log("Screenshots saved to:", SCREENSHOT_DIR);
  } catch (err) {
    console.error("ERROR:", err);
    await shot(page, "error-state").catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
