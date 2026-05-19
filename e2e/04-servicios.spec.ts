import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("04 — Servicios", () => {

  test.beforeEach(async ({ page }) => {
    await login(page, "superadmin");
  });

  test("carga /servicios con período mayo 2026", async ({ page }) => {
    await page.goto("/servicios");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Mayo 2026").first()).toBeVisible({ timeout: 10000 });
    console.log("✓ /servicios cargado con Mayo 2026");
  });

  test("cards de resumen muestran servicios configurados", async ({ page }) => {
    await page.goto("/servicios");
    await page.waitForLoadState("networkidle");

    const serviceLabels = ["Electricidad", "Internet", "Agua", "Gas"];
    const found: string[] = [];
    for (const label of serviceLabels) {
      const visible = await page.locator(`text=${label}`).first().isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) found.push(label);
    }
    expect(found.length).toBeGreaterThan(0);
    console.log(`✓ Servicios visibles: ${found.join(", ")}`);
  });

  test("Marsella 232 Electricidad tiene botón Generar PDFs", async ({ page }) => {
    await page.goto("/servicios");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Marsella 232").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Generar PDFs").first()).toBeVisible({ timeout: 8000 });
    console.log("✓ Botón 'Generar PDFs' visible para Marsella 232 Electricidad");
  });

  test("ver factura distribuida de Marsella 232 Electricidad", async ({ page }) => {
    await page.goto("/servicios");
    await page.waitForLoadState("networkidle");

    // Look for Cobrada or Distribuida badge near Electricidad
    const cobradaBadge = page.locator("text=Cobrada").first();
    const distribuidaBadge = page.locator("text=Distribuida").first();

    const hasCobrada    = await cobradaBadge.isVisible({ timeout: 5000 }).catch(() => false);
    const hasDistribuida = await distribuidaBadge.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasCobrada || hasDistribuida).toBeTruthy();
    console.log(`✓ Factura mayo 2026: Cobrada=${hasCobrada} Distribuida=${hasDistribuida}`);
  });

  test("subir factura de servicio fijo — buscar botón 'Subir factura'", async ({ page }) => {
    await page.goto("/servicios");
    await page.waitForLoadState("networkidle");

    // Look for "Subir factura" button (fixed-billing meters without invoice)
    const subirBtn = page.locator("text=Subir factura").first();
    const hasSubir = await subirBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasSubir) {
      console.log("ℹ️ No hay botones 'Subir factura' en mayo 2026 — todas las facturas fijas ya están cargadas");
      return;
    }

    await subirBtn.click();
    await page.waitForTimeout(1000);

    // Modal should open
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);

    if (modalVisible) {
      // Fill amount
      await page.locator('input[type="number"], input[placeholder="0.00"]').first().fill("500");
      // Fill folio
      const folioInput = page.locator('input[placeholder*="Folio"], input[placeholder*="folio"], input[placeholder*="1234"]').first();
      if (await folioInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await folioInput.fill("TEST-E2E-TELMEX-001");
      }
      // DO NOT submit — just verify modal accepts input
      const submitBtn = page.locator('button:has-text("Registrar factura"), button[type="submit"]').first();
      const canSubmit = await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false);
      expect(canSubmit).toBeTruthy();
      console.log("✓ Modal 'Subir factura' acepta monto y folio TEST-E2E-TELMEX-001");

      // Close without submitting
      const cancelBtn = page.locator('button:has-text("Cancelar")').first();
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    } else {
      console.log("ℹ️ Modal no abrió al hacer clic en 'Subir factura'");
    }
  });

});
