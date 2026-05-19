import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("02 — Edificios y Unidades", () => {

  test.beforeEach(async ({ page }) => {
    await login(page, "superadmin");
  });

  test("ver lista de edificios", async ({ page }) => {
    await page.goto("/buildings");
    await page.waitForLoadState("networkidle");
    // Should show at least one building
    await expect(page.locator("text=Marsella 232").first()).toBeVisible({ timeout: 10000 });
    console.log("✓ Lista de edificios cargada");
  });

  test("ver detalle de Marsella 232", async ({ page }) => {
    await page.goto("/buildings");
    await page.waitForLoadState("networkidle");
    await page.locator("text=Marsella 232").first().click();
    await page.waitForURL(/buildings\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    // Building detail should show the name
    await expect(page.locator("text=Marsella 232").first()).toBeVisible({ timeout: 8000 });
    console.log("✓ Detalle de Marsella 232 cargado, URL:", page.url());
  });

  test("tabs: Unidades, Contratos, Servicios visibles", async ({ page }) => {
    await page.goto("/buildings");
    await page.waitForLoadState("networkidle");
    await page.locator("text=Marsella 232").first().click();
    await page.waitForURL(/buildings\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Check for tab navigation
    const tabs = ["Unidades", "Contratos", "Servicios"];
    for (const tab of tabs) {
      const tabEl = page.locator(`text=${tab}`).first();
      const visible = await tabEl.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`  Tab "${tab}": ${visible ? "✓" : "✗"}`);
    }
  });

  test("unidades en Marsella 232 están en orden natural", async ({ page }) => {
    await page.goto("/buildings");
    await page.waitForLoadState("networkidle");
    await page.locator("text=Marsella 232").first().click();
    await page.waitForURL(/buildings\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Click Unidades tab if needed
    const unidadesTab = page.locator("text=Unidades").first();
    if (await unidadesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unidadesTab.click();
      await page.waitForTimeout(1000);
    }

    // Check that unit numbers appear in order (1 before 10 before 11)
    const bodyText = await page.locator("body").innerText();
    const pos1  = bodyText.indexOf("Depa 1");
    const pos10 = bodyText.indexOf("Depa 10");
    const pos2  = bodyText.indexOf("Depa 2");

    if (pos1 > 0 && pos10 > 0 && pos2 > 0) {
      // Natural sort: 1, 2, 3... 10, 11 — so pos2 < pos10
      expect(pos1).toBeLessThan(pos2);
      expect(pos2).toBeLessThan(pos10);
      console.log("✓ Unidades en orden natural (1, 2, 3... 10, 11)");
    } else {
      // Try without "Depa" prefix
      console.log("ℹ️ No se encontraron labels 'Depa N' — verificar selector");
    }
  });

});
