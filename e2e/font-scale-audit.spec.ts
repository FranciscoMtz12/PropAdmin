import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("font-scale rem audit", () => {
  test("titulos y metric cards escalan con font-scale 1.4 en /buildings", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/buildings");
    await page.waitForLoadState("networkidle");

    /* ── Screenshot antes (escala 1.0) ───────────────────────────── */
    await page.screenshot({ path: "playwright-report/buildings-scale-1.0.png", fullPage: false });

    /* Medir fontSize del título de página en escala normal */
    const titleFontBefore = await page.evaluate(() => {
      const el = document.querySelector(".ph-title, h1") as HTMLElement | null;
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    });

    /* ── Aplicar font-scale 1.4 directo en CSS var ───────────────── */
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--font-scale", "1.4");
    });
    await page.waitForTimeout(300);

    /* ── Screenshot después (escala 1.4) ─────────────────────────── */
    await page.screenshot({ path: "playwright-report/buildings-scale-1.4.png", fullPage: false });

    /* Medir fontSize del título en escala 1.4 */
    const titleFontAfter = await page.evaluate(() => {
      const el = document.querySelector(".ph-title, h1") as HTMLElement | null;
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    });

    /* Verificar que el título creció ≥ 35% (de ~38px a ~53px) */
    if (titleFontBefore !== null && titleFontAfter !== null) {
      const ratio = titleFontAfter / titleFontBefore;
      expect(ratio).toBeGreaterThan(1.3);
    }

    /* Verificar que el número grande de MetricCard también creció */
    const metricFontAfter = await page.evaluate(() => {
      /* Buscar el número grande en una metric card */
      const el = Array.from(document.querySelectorAll("strong, [style*='1.75rem'], [style*='2rem']"))
        .find(e => (e as HTMLElement).style?.fontSize?.includes("rem")) as HTMLElement | null;
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    });

    if (metricFontAfter !== null) {
      /* A escala 1.4, 1.75rem = 1.75 * 16 * 1.4 = 39.2px */
      expect(metricFontAfter).toBeGreaterThan(35);
    }
  });
});
