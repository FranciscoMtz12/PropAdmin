/**
 * Verification script — Fase 3.3 — Caso Extremo 8 pisos mixto.
 * Creates: Zona 1 (P1, 4 locales) + Zona 2 (P2-3, oficinas 600m²) + Zona 3 (P4-8, deptos 4,4,4,3,2)
 * Expects: 1 property, 2 space_groups (pisos), 23 spaces (4+2+17)
 *
 * Run: npx tsx scripts/verify-mixto-extremo.ts
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:3000";
const PROP_NAME = "Edificio Mixto Test 8P";
const SCREENSHOT_DIR = path.join(__dirname, "../screenshots/verify-mixto");

// Supabase service-role client for direct DB verification
const SUPABASE_URL = "https://mremgbneyztpbojwgwcc.supabase.co";
// Service key loaded from env; fall back to anon for read-only checks
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function ensureDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page: import("playwright").Page, name: string) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`   📸 ${name}.png`);
  return p;
}

async function waitAndClick(page: import("playwright").Page, selector: string, opts?: { timeout?: number }) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: opts?.timeout ?? 8000 });
  await el.click();
}

(async () => {
  ensureDir();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try {
    // ── 1. Login ────────────────────────────────────────────────────────────
    console.log("\n1. LOGIN");
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').fill("fco.mtz.c@hotmail.com");
    await page.locator('input[type="password"]').fill("Pruebas1");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 20000 });
    console.log("   ✅ Logged in →", page.url());
    await shot(page, "01-logged-in");

    // ── 2. Impersonar Inmobiliaria Demo ─────────────────────────────────────
    console.log("\n2. IMPERSONAR");
    await page.goto(`${BASE}/saproa-admin/impersonar`);
    await page.waitForLoadState("networkidle");
    await shot(page, "02-impersonar-page");

    // Wait for data to render (React async fetch)
    await page.waitForTimeout(2000);

    // Expand "MATZ" group by clicking on its row text
    const matzRow = page.locator("text=MATZ").first();
    await matzRow.waitFor({ state: "visible", timeout: 8000 });
    await matzRow.click();
    await page.waitForTimeout(600);

    // Now find "Inmobiliaria Demo" and expand it to show the "Ver" button
    const demoRow = page.locator("text=Inmobiliaria Demo, text=DEMO").first();
    const demoVisible = await demoRow.isVisible({ timeout: 3000 }).catch(() => false);
    if (demoVisible) {
      await demoRow.click(); // expand company row to show Ver button
      await page.waitForTimeout(400);
    }

    // Click the "Ver" button that is near "Inmobiliaria Demo"
    // The Ver button triggers impersonateCompany and redirects to /home
    const verBtns = page.locator("button").filter({ hasText: /^Ver$/ });
    const verCount = await verBtns.count();
    console.log(`   Ver buttons found: ${verCount}`);
    if (verCount > 0) {
      await verBtns.first().click();
    } else {
      // Try title attribute
      await page.locator("button[title*='DEMO'], button[title*='Demo'], button[title*='mpersonar']").first().click();
    }
    await page.waitForTimeout(1000);
    console.log("   ✅ Impersonated Inmobiliaria Demo, URL:", page.url());
    await shot(page, "03-impersonated");

    // ── 3. Navigate to /propiedades ─────────────────────────────────────────
    console.log("\n3. PROPIEDADES");
    await page.goto(`${BASE}/propiedades`);
    await page.waitForLoadState("networkidle");
    await shot(page, "04-propiedades");

    // ── 4. Open wizard ──────────────────────────────────────────────────────
    console.log("\n4. OPEN WIZARD");
    const newBtn = page.locator("button").filter({ hasText: "Nueva propiedad" }).first();
    await newBtn.waitFor({ state: "visible", timeout: 8000 });
    await newBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "05-wizard-open");

    // ── 5. Step 1 — Select 3 types ──────────────────────────────────────────
    console.log("\n5. STEP 1 — SELECT 3 TYPES");
    // Click Comercial / Plaza
    await page.locator("button").filter({ hasText: "Comercial / Plaza" }).click();
    await page.waitForTimeout(200);
    // Click Comercial · Oficinas
    await page.locator("button").filter({ hasText: "Comercial · Oficinas" }).click();
    await page.waitForTimeout(200);
    // Click Residencial multifamiliar
    await page.locator("button").filter({ hasText: "Residencial multifamiliar" }).click();
    await page.waitForTimeout(300);

    const labelText = await page.locator("text=Etiqueta:").isVisible({ timeout: 2000 }).catch(() => false);
    console.log("   Label preview visible:", labelText);
    await shot(page, "06-step1-3tipos");

    // ── 6. Next → Step 2 ────────────────────────────────────────────────────
    console.log("\n6. STEP 2 — NAME");
    await page.locator("button").filter({ hasText: "Siguiente" }).first().click();
    await page.waitForTimeout(400);
    await page.locator('input').first().fill(PROP_NAME);
    await shot(page, "07-step2-nombre");

    // ── 7. Next → Step 3 ────────────────────────────────────────────────────
    console.log("\n7. STEP 3 — ZONAS");
    await page.locator("button").filter({ hasText: "Siguiente" }).first().click();
    await page.waitForTimeout(600);
    await shot(page, "08-step3-zonas-inicial");

    // Step 3 should show the LateralPanel with 3 pre-initialized zones
    const zonaPanel = await page.locator("text=Zona 1").isVisible({ timeout: 3000 }).catch(() => false);
    console.log("   Zona 1 visible in panel:", zonaPanel);

    // ── ZONA 1: Comercial, piso 1, 4 locales ────────────────────────────────
    console.log("   Configuring Zona 1 (Comercial, P1, 4 locales)...");
    // Click Zona 1 in lateral panel
    await page.locator("button").filter({ hasText: "Zona 1" }).first().click();
    await page.waitForTimeout(300);

    // Name
    const nameInput1 = page.locator('input[placeholder*="Locales"], input[placeholder*="zona"]').first();
    await nameInput1.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    // Clear and fill the first visible text input (zona name)
    const inputs = page.locator('input[type="text"], input:not([type])');
    await inputs.first().clear();
    await inputs.first().fill("Planta Baja Locales");
    await page.waitForTimeout(200);

    // Make sure "Comercial / Plaza" is selected as tipo
    const comercialBtn = page.locator("button").filter({ hasText: "Comercial / Plaza" }).last();
    if (await comercialBtn.isVisible()) await comercialBtn.click();
    await page.waitForTimeout(200);

    // Piso inicio/fin should already be 1 for zona 1, but ensure it
    // The floor range inputs - set both to 1
    const floorInputs = page.locator('input[type="number"]');
    const floorInputCount = await floorInputs.count();
    if (floorInputCount >= 2) {
      await floorInputs.first().fill("1");
      await floorInputs.nth(1).fill("1");
    }
    await page.waitForTimeout(300);

    // The counter for floor 1 should show. Click + to go from default 3 to 4
    const plusButtons = page.locator("button").filter({ hasText: "+" });
    const plusCount = await plusButtons.count();
    if (plusCount > 0) {
      // Default is 3, need 4 → click + once
      await plusButtons.last().click();
      await page.waitForTimeout(200);
    }
    await shot(page, "09-zona1-comercial");

    // ── ZONA 2: Oficinas, pisos 2-3, 600m² ──────────────────────────────────
    console.log("   Configuring Zona 2 (Oficinas, P2-3, 600m²)...");
    await page.locator("button").filter({ hasText: "Zona 2" }).first().click();
    await page.waitForTimeout(400);
    await shot(page, "10-zona2-selected");

    // Clear and set name
    const nameInputs2 = page.locator('input[type="text"], input:not([type])');
    await nameInputs2.first().clear();
    await nameInputs2.first().fill("Pisos Oficinas");
    await page.waitForTimeout(200);

    // Select Oficinas type button
    const oficinasBtn = page.locator("button").filter({ hasText: "Comercial · Oficinas" });
    const ofBtnCount = await oficinasBtn.count();
    for (let i = 0; i < ofBtnCount; i++) {
      const visible = await oficinasBtn.nth(i).isVisible();
      if (visible) { await oficinasBtn.nth(i).click(); break; }
    }
    await page.waitForTimeout(300);

    // Set floor range 2 to 3
    const floorNums2 = page.locator('input[type="number"]');
    const cnt2 = await floorNums2.count();
    if (cnt2 >= 2) {
      await floorNums2.first().fill("2");
      await floorNums2.nth(1).fill("3");
      await floorNums2.nth(1).blur();
      await page.waitForTimeout(400);
    }

    // Set 600m² for each floor that appears
    const m2Inputs = page.locator('input[placeholder*="600"], input[placeholder*="m"]');
    const m2count = await m2Inputs.count();
    for (let i = 0; i < m2count; i++) {
      await m2Inputs.nth(i).fill("600");
    }
    await page.waitForTimeout(300);
    await shot(page, "11-zona2-oficinas");

    // ── ZONA 3: Residencial, pisos 4-8, 4,4,4,3,2 ───────────────────────────
    console.log("   Configuring Zona 3 (Residencial, P4-8, 4+4+4+3+2 deptos)...");
    await page.locator("button").filter({ hasText: "Zona 3" }).first().click();
    await page.waitForTimeout(400);

    // Name
    const nameInputs3 = page.locator('input[type="text"], input:not([type])');
    await nameInputs3.first().clear();
    await nameInputs3.first().fill("Torre Departamentos");
    await page.waitForTimeout(200);

    // Select Residencial multifamiliar type
    const residBtn = page.locator("button").filter({ hasText: "Residencial multifamiliar" });
    const resCnt = await residBtn.count();
    for (let i = 0; i < resCnt; i++) {
      const visible = await residBtn.nth(i).isVisible();
      if (visible) { await residBtn.nth(i).click(); break; }
    }
    await page.waitForTimeout(300);

    // Set floor range 4 to 8
    const floorNums3 = page.locator('input[type="number"]');
    const cnt3 = await floorNums3.count();
    if (cnt3 >= 2) {
      await floorNums3.first().fill("4");
      await floorNums3.nth(1).fill("8");
      await floorNums3.nth(1).blur();
      await page.waitForTimeout(500);
    }

    await shot(page, "12-zona3-residencial-rangos");

    // At this point, floors 4-8 counters should appear (5 floors, each Counter)
    // Target distribution: 4,4,4,3,2
    // The counters default to 3. Adjust per floor:
    // Floor 4: +1 (3→4), Floor 5: +1 (3→4), Floor 6: +1 (3→4), Floor 7: 0 (stays 3), Floor 8: -1 (3→2)
    // Counter buttons are + and - near each floor label
    // We'll look for all + buttons in the zona detail area
    const allPlusInDetail = page.locator("button").filter({ hasText: "+" });
    const plusTotal = await allPlusInDetail.count();
    console.log(`   Plus buttons found: ${plusTotal}`);

    // Click + for floor 4 (first counter)
    if (plusTotal >= 1) await allPlusInDetail.nth(0).click();
    await page.waitForTimeout(150);
    // Click + for floor 5 (second counter)
    if (plusTotal >= 2) await allPlusInDetail.nth(1).click();
    await page.waitForTimeout(150);
    // Click + for floor 6 (third counter)
    if (plusTotal >= 3) await allPlusInDetail.nth(2).click();
    await page.waitForTimeout(150);
    // Floor 7 stays at 3
    // Click - for floor 8 (fifth counter)
    const allMinusInDetail = page.locator("button").filter({ hasText: "−" });
    const minusTotal = await allMinusInDetail.count();
    if (minusTotal >= 5) await allMinusInDetail.nth(4).click();
    await page.waitForTimeout(300);

    await shot(page, "13-zona3-deptos-distribucion");

    // Check overlap warning
    const overlapWarning = await page.locator("text=superpuestos").isVisible({ timeout: 1000 }).catch(() => false);
    console.log("   Overlap warning:", overlapWarning ? "⚠️ YES (unexpected)" : "✅ NONE");

    // ── 8. Paso 4 — Assets (skip) ─────────────────────────────────────────
    console.log("\n8. STEP 4 — ASSETS (skip)");
    await page.locator("button").filter({ hasText: "Siguiente" }).first().click();
    await page.waitForTimeout(400);
    await shot(page, "14-step4-assets");

    // ── 9. Paso 5 — Resumen ────────────────────────────────────────────────
    console.log("\n9. STEP 5 — RESUMEN");
    await page.locator("button").filter({ hasText: "Siguiente" }).first().click();
    await page.waitForTimeout(400);
    await shot(page, "15-step5-resumen");

    const showsName = await page.locator(`text=${PROP_NAME}`).isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`   Name "${PROP_NAME}" visible:`, showsName ? "✅" : "❌");

    const showsMixto = await page.locator("text=Mixto").isVisible({ timeout: 2000 }).catch(() => false);
    console.log("   Label 'Mixto' visible:", showsMixto ? "✅" : "❌");

    const shows3Zonas = await page.locator("text=3").isVisible({ timeout: 1000 }).catch(() => false);
    console.log("   '3 zonas' metric visible:", shows3Zonas ? "✅" : "ℹ️ maybe");

    // ── 10. Crear propiedad ────────────────────────────────────────────────
    console.log("\n10. CREATE PROPERTY");
    await page.locator("button").filter({ hasText: "Crear propiedad" }).first().click();
    await page.waitForTimeout(2000);

    const hasError = await page.locator("text=Error").isVisible({ timeout: 1000 }).catch(() => false);
    const hasSuccess = await page.locator("text=creada").isVisible({ timeout: 3000 }).catch(() => false);
    console.log("   Error visible:", hasError ? "❌ YES" : "✅ NONE");
    console.log("   Success toast visible:", hasSuccess ? "✅ YES" : "⚠️ NO");
    await shot(page, "16-after-create");

    // ── 11. DB Verification ───────────────────────────────────────────────
    console.log("\n11. DB VERIFICATION");
    await page.waitForTimeout(1000);

    const { data: props } = await db.from("properties")
      .select("id, name, property_label")
      .eq("name", PROP_NAME)
      .is("deleted_at", null)
      .limit(1);

    if (!props || props.length === 0) {
      console.log("   ❌ Property NOT found in DB — creation may have failed");
    } else {
      const prop = props[0];
      console.log(`   ✅ Property created: id=${prop.id}`);
      console.log(`   ✅ Label: "${prop.property_label}"`);

      // Count space_groups
      const { data: sgs, count: sgCount } = await db.from("space_groups")
        .select("id, name, group_type", { count: "exact" })
        .eq("property_id", prop.id)
        .is("deleted_at", null);
      console.log(`   space_groups: ${sgCount} (expected: 2)`);
      (sgs ?? []).forEach(sg => console.log(`     - ${sg.name} (${sg.group_type})`));

      // Count spaces by type
      const { data: spaces } = await db.from("spaces")
        .select("space_type, floor, space_group_id, is_divisible, total_sqm")
        .eq("property_id", prop.id)
        .is("deleted_at", null);

      const byType: Record<string, number> = {};
      const byFloor: Record<string, Record<string, number>> = {};
      for (const sp of spaces ?? []) {
        byType[sp.space_type] = (byType[sp.space_type] ?? 0) + 1;
        const k = `${sp.space_type}|floor=${sp.floor}|group=${sp.space_group_id ? "yes" : "no"}`;
        byFloor[k] = (byFloor[k] ?? 0) + 1;
      }

      console.log(`   spaces total: ${(spaces ?? []).length} (expected: 23)`);
      console.log(`   commercial_local: ${byType["commercial_local"] ?? 0} (expected: 4)`);
      console.log(`   office: ${byType["office"] ?? 0} (expected: 2)`);
      console.log(`   apartment: ${byType["apartment"] ?? 0} (expected: 17)`);

      // Check divisible offices
      const officeSpaces = (spaces ?? []).filter(s => s.space_type === "office");
      const allDivisible = officeSpaces.every(s => s.is_divisible === true);
      const allSqm600 = officeSpaces.every(s => Number(s.total_sqm) === 600);
      console.log(`   Offices is_divisible=true: ${allDivisible ? "✅" : "❌"}`);
      console.log(`   Offices total_sqm=600: ${allSqm600 ? "✅" : "❌"}`);

      // Check locals have no space_group
      const localSpaces = (spaces ?? []).filter(s => s.space_type === "commercial_local");
      const noGroup = localSpaces.every(s => !s.space_group_id);
      console.log(`   Locals have no space_group: ${noGroup ? "✅" : "❌"}`);

      // Check apartments span floors 4-8
      const aptFloors = [...new Set((spaces ?? []).filter(s => s.space_type === "apartment").map(s => s.floor))].sort();
      console.log(`   Apartment floors: ${aptFloors.join(", ")} (expected: 4,5,6,7,8)`);

      // PASS/FAIL summary
      const pass = (sgCount === 2) &&
                   (byType["commercial_local"] === 4) &&
                   (byType["office"] === 2) &&
                   (byType["apartment"] === 17) &&
                   allDivisible && allSqm600 && noGroup;
      console.log(`\n   ═══════════════════════════════`);
      console.log(`   RESULTADO: ${pass ? "✅ TODAS LAS VERIFICACIONES PASAN" : "❌ ALGUNAS VERIFICACIONES FALLARON"}`);
      console.log(`   ═══════════════════════════════`);

      // Soft delete test property
      console.log("\n12. CLEANUP — soft-delete test property");
      await db.from("properties").update({ deleted_at: new Date().toISOString() }).eq("id", prop.id);
      console.log("   ✅ Propiedad de prueba eliminada (soft-delete)");
    }

    console.log(`\n📸 Screenshots: ${SCREENSHOT_DIR}`);

  } catch (err) {
    console.error("\nERROR:", err);
    await shot(page, "error-state").catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
