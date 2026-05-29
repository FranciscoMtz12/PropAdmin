/**
 * Diagnostic 2: intercepts localStorage.setItem to trace mutation order.
 * Compares what's in localStorage BEFORE vs AFTER useIsomorphicLayoutEffect fires.
 * Run: node diagnose-flash2.mjs <email> <password>
 */
import { chromium } from "playwright";

const email    = process.argv[2] ?? "";
const password = process.argv[3] ?? "";
const BASE_URL = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  /* Intercept console.log from the page */
  page.on("console", msg => {
    if (msg.text().startsWith("[DIAG]")) console.log(msg.text());
  });

  /* ── Pre-seed localStorage with a fake company color to simulate returning user ── */
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => {
    // Clear everything first
    localStorage.clear();

    // Simulate: user previously logged in with company color #8B2252
    // We don't know the UID yet, so we'll capture it when the useIsomorphicLayoutEffect fires
    window.__lsMutations = [];
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      const stack = new Error().stack.split('\n').slice(1, 4).join(' | ');
      window.__lsMutations.push({
        ms: Date.now(),
        key,
        value,
        // Try to get React fiber info (simplified)
        stack: stack.substring(0, 200),
      });
      orig(key, value);
      // Log to console so Playwright captures it
      console.log(`[DIAG] localStorage.setItem("${key}", "${value}")`);
    };
  });

  // Now seed the accent cache — but we need the UID first.
  // We'll inject a known fake UID and seed the cache.
  // The real UID will be discovered when the user loads.

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  /* Poll accent every 16ms */
  const timeline = [];
  let polling = true;
  const t0 = Date.now();

  const pollLoop = (async () => {
    while (polling) {
      const s = await page.evaluate((t0ref) => {
        const style = getComputedStyle(document.documentElement);
        const computed = style.getPropertyValue("--accent").trim();
        const inline   = document.documentElement.style.getPropertyValue("--accent").trim();
        const lsAccents = Object.fromEntries(
          Object.keys(localStorage)
            .filter(k => k.startsWith("accentColor"))
            .map(k => [k, localStorage.getItem(k)])
        );
        return { ms: Date.now() - t0ref, computed, inline, lsAccents };
      }, t0);
      timeline.push(s);
      await new Promise(r => setTimeout(r, 16));
    }
  })();

  await page.click('button[type="submit"]');
  console.log(`\n[t=0] Submit click`);

  // Wait for navigation away from login
  try {
    await page.waitForURL(url => !url.href.includes("/login"), { timeout: 12000 });
  } catch {}
  console.log(`[t=${Date.now()-t0}ms] Navigated to: ${page.url()}`);

  // Wait an extra 2s for all async effects to settle
  await new Promise(r => setTimeout(r, 2000));
  polling = false;
  await pollLoop;

  /* ── Report color changes ── */
  console.log("\n=== COLOR TIMELINE (cambios únicos) ===");
  let prev = null;
  for (const s of timeline) {
    if (!prev || s.computed !== prev.computed || s.inline !== prev.inline || JSON.stringify(s.lsAccents) !== JSON.stringify(prev.lsAccents)) {
      console.log(`t=${String(s.ms).padStart(5)}ms | computed="${s.computed}" | inline="${s.inline}" | ls=${JSON.stringify(s.lsAccents)}`);
      prev = s;
    }
  }

  /* ── Report all localStorage mutations in order ── */
  const mutations = await page.evaluate(() => window.__lsMutations || []);
  console.log("\n=== localStorage.setItem MUTATIONS (orden cronológico) ===");
  for (const m of mutations) {
    if (m.key.includes("accent") || m.key.includes("last_user")) {
      console.log(`  t=+${m.ms - (mutations[0]?.ms ?? m.ms)}ms key="${m.key}" value="${m.value}"`);
    }
  }

  /* ── Final localStorage state ── */
  const finalLs = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter(k => k.includes("accent") || k.includes("last_user"))
        .map(k => [k, localStorage.getItem(k)])
    )
  );
  console.log("\n=== FINAL localStorage ===");
  console.log(JSON.stringify(finalLs, null, 2));

  await browser.close();
})();
