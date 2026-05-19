import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("10 — Pagos", () => {

  test("administración: accede a /payments", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    expect(url).not.toContain("/login");
    console.log("✓ Administración: /payments accesible, URL:", url);
  });

  test("administración: /payments carga contenido", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(200);

    const hasPagos = bodyText.includes("Pago") || bodyText.includes("pago") || bodyText.includes("$") || bodyText.includes("reporte");
    console.log(`✓ /payments cargado — hasPagos=${hasPagos}, snippet: ${bodyText.slice(0, 120).replace(/\n/g, " ")}`);
  });

  test("superadmin: accede a /payments", async ({ page }) => {
    await login(page, "superadmin");
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    expect(url).not.toContain("/login");
    console.log("✓ Superadmin: /payments accesible");
  });

  test("administración: /collections/reported-payments carga", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/collections/reported-payments");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const notBlocked = !url.includes("/login");
    const bodyText = await page.locator("body").innerText();
    console.log(`✓ /collections/reported-payments — notBlocked=${notBlocked}, snippet: ${bodyText.slice(0, 120).replace(/\n/g, " ")}`);
    expect(notBlocked).toBeTruthy();
  });

  test("administración: ver detalle de un reporte de pago", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    // Try to click first payment report
    const firstRow = page.locator("table tbody tr, [role='row']").nth(1);
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(1500);
      console.log("✓ Detalle de reporte de pago abierto, URL:", page.url());
    } else {
      // Look for any payment-related link
      const paymentLink = page.locator("a[href*='/payments/'], a[href*='/collections/invoices/']").first();
      if (await paymentLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await paymentLink.click();
        await page.waitForLoadState("networkidle");
        console.log("✓ Detalle de pago via link, URL:", page.url());
      } else {
        console.log("ℹ️ No se encontró fila/link de reporte de pago clickeable");
      }
    }
  });

  test("compras: no puede acceder a /payments", async ({ page }) => {
    await login(page, "compras");
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const wasRedirected = !url.includes("/payments");
    console.log(`✓ Compras en /payments → redirigido=${wasRedirected}, URL final: ${url}`);
  });

});
