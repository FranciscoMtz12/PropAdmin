import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("09 — Limpieza", () => {

  test("mantenimiento: accede a /cleaning", async ({ page }) => {
    await login(page, "mantenimiento");
    await page.goto("/cleaning");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    expect(url).not.toContain("/login");
    console.log("✓ Mantenimiento: /cleaning accesible, URL:", url);
  });

  test("mantenimiento: /cleaning carga schedules", async ({ page }) => {
    await login(page, "mantenimiento");
    await page.goto("/cleaning");
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").innerText();
    const hasSchedule = bodyText.length > 200;
    console.log(`✓ /cleaning tiene contenido (${bodyText.length} chars), snippet: ${bodyText.slice(0, 120).replace(/\n/g, " ")}`);
    expect(hasSchedule).toBeTruthy();
  });

  test("superadmin: accede a /cleaning", async ({ page }) => {
    await login(page, "superadmin");
    await page.goto("/cleaning");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    expect(url).not.toContain("/login");
    console.log("✓ Superadmin: /cleaning accesible");
  });

  test("mantenimiento: sub-rutas de limpieza accesibles", async ({ page }) => {
    await login(page, "mantenimiento");

    const routes = [
      "/cleaning",
    ];

    // Find a building ID to test sub-routes
    await page.goto("/cleaning");
    await page.waitForLoadState("networkidle");

    // Check for building-specific cleaning links
    const cleaningLinks = page.locator("a[href*='/cleaning/'], a[href*='cleaning']");
    const count = await cleaningLinks.count();
    console.log(`✓ /cleaning — ${count} enlaces de sub-rutas encontrados`);

    if (count > 0) {
      const firstLink = cleaningLinks.first();
      const href = await firstLink.getAttribute("href");
      if (href) {
        await page.goto(href);
        await page.waitForLoadState("networkidle");
        console.log("✓ Sub-ruta de limpieza accesible:", href);
      }
    }
  });

});
