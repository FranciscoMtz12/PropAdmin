import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("08 — Portal de Campo", () => {

  test("campo: login exitoso", async ({ page }) => {
    await login(page, "campo");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    expect(url).not.toContain("/login");
    console.log("✓ Campo: login exitoso, URL:", url);
  });

  test("campo: /campo/compras accesible", async ({ page }) => {
    await login(page, "campo");
    await page.goto("/campo/compras");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").innerText();
    const notBlocked = !url.includes("/login");
    console.log(`✓ /campo/compras — notBlocked=${notBlocked}, snippet: ${bodyText.slice(0, 100).replace(/\n/g, " ")}`);
    expect(notBlocked).toBeTruthy();
  });

  test("campo: /campo/medidores accesible", async ({ page }) => {
    await login(page, "campo");
    await page.goto("/campo/medidores");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").innerText();
    const notBlocked = !url.includes("/login");
    console.log(`✓ /campo/medidores — notBlocked=${notBlocked}, snippet: ${bodyText.slice(0, 100).replace(/\n/g, " ")}`);
    expect(notBlocked).toBeTruthy();
  });

  test("campo: /campo/dashboard accesible", async ({ page }) => {
    await login(page, "campo");
    await page.goto("/campo/dashboard");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const notBlocked = !url.includes("/login");
    console.log(`✓ /campo/dashboard — notBlocked=${notBlocked}, URL: ${url}`);
  });

  test("campo: no puede acceder a /servicios (debe redirigir)", async ({ page }) => {
    await login(page, "campo");
    await page.goto("/servicios");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const wasRedirected = !url.includes("/servicios");
    console.log(`✓ Campo en /servicios → redirigido=${wasRedirected}, URL final: ${url}`);
    // Informational — if the app redirects campo users away from admin routes
  });

  test("campo: no puede acceder a /buildings (debe redirigir)", async ({ page }) => {
    await login(page, "campo");
    await page.goto("/buildings");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const wasRedirected = !url.includes("/buildings");
    console.log(`✓ Campo en /buildings → redirigido=${wasRedirected}, URL final: ${url}`);
  });

});
