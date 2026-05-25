import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("font-scale visual scaling — íconos, donuts, gráficas", () => {
  test("dashboard: donuts y gráficas 40% más grandes en scale 1.4", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    /* ── Screenshot escala 1.0 ─────────────────────────────────── */
    await page.screenshot({ path: "playwright-report/dashboard-scale-1.0.png", fullPage: false });

    /* Medir altura de la primera dona (dashboard-donut-wrap) */
    const donutHeightBefore = await page.evaluate(() => {
      const el = document.querySelector(".dashboard-donut-wrap") as HTMLElement | null;
      return el ? el.getBoundingClientRect().height : null;
    });

    /* ── Aplicar font-scale 1.4 ────────────────────────────────── */
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--font-scale", "1.4");
    });
    await page.waitForTimeout(400);

    /* ── Screenshot escala 1.4 ─────────────────────────────────── */
    await page.screenshot({ path: "playwright-report/dashboard-scale-1.4.png", fullPage: false });

    /* Verificar que la dona creció ~40% */
    const donutHeightAfter = await page.evaluate(() => {
      const el = document.querySelector(".dashboard-donut-wrap") as HTMLElement | null;
      return el ? el.getBoundingClientRect().height : null;
    });

    if (donutHeightBefore !== null && donutHeightAfter !== null) {
      const ratio = donutHeightAfter / donutHeightBefore;
      expect(ratio).toBeGreaterThan(1.3);
    }
  });

  test("analytics: gráfica LineChart escala en 1.4", async ({ page }) => {
    await login(page, "administracion");
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "playwright-report/analytics-scale-1.0.png", fullPage: false });

    /* Medir altura del primer ResponsiveContainer */
    const chartHeightBefore = await page.evaluate(() => {
      const el = document.querySelector(".recharts-responsive-container") as HTMLElement | null;
      return el ? el.getBoundingClientRect().height : null;
    });

    await page.evaluate(() => {
      document.documentElement.style.setProperty("--font-scale", "1.4");
    });
    await page.waitForTimeout(400);

    await page.screenshot({ path: "playwright-report/analytics-scale-1.4.png", fullPage: false });

    const chartHeightAfter = await page.evaluate(() => {
      const el = document.querySelector(".recharts-responsive-container") as HTMLElement | null;
      return el ? el.getBoundingClientRect().height : null;
    });

    if (chartHeightBefore !== null && chartHeightAfter !== null && chartHeightBefore > 0) {
      const ratio = chartHeightAfter / chartHeightBefore;
      expect(ratio).toBeGreaterThan(1.3);
    }
  });

  test("sin overflow horizontal en ningún scale", async ({ page }) => {
    await login(page, "administracion");

    for (const scale of ["0.8", "1.0", "1.2", "1.4"]) {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      await page.evaluate((s) => {
        document.documentElement.style.setProperty("--font-scale", s);
      }, scale);
      await page.waitForTimeout(300);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Overflow en scale ${scale}`).toBe(false);
    }
  });
});
