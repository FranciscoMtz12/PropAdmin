/**
 * Diagnostic 3: pre-seeds a fake accent color for the known UID, then intercepts
 * localStorage.setItem to prove the useIsomorphicLayoutEffect cache-destruction bug.
 *
 * Key question: does useIsomorphicLayoutEffect overwrite the cached color BEFORE
 * the branding useEffect can read it?
 *
 * Run: node scripts/audit/diagnose-flash3.mjs <email> <password>
 *
 * Expected result if bug exists:
 *   - pre-seed:  localStorage["accentColor_<uid>"] = "#8B2252"  (fake company color)
 *   - after login: localStorage["accentColor_<uid>"] = "#6366F1" (DEFAULT_ACCENT, from useLayoutEffect)
 *   - --accent flashes #6366F1 for ~400ms before branding useEffect sets the real color
 */
import { chromium } from "playwright";

const email    = process.argv[2] ?? "";
const password = process.argv[3] ?? "";
const BASE_URL = "http://localhost:3000";

if (!email || !password) {
  console.error("Usage: node diagnose-flash3.mjs <email> <password>");
  process.exit(1);
}

// Known UID from first diagnostic run — superadmin account
// We'll discover the real UID at runtime and also try pre-seeding with this one
const KNOWN_UID = "a3e4f406-01b9-47bf-9e01-8e48731b02bc";
const FAKE_COLOR = "#8B2252"; // fake "company color" — visually distinct from DEFAULT_ACCENT #6366F1

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", msg => {
    if (msg.text().startsWith("[DIAG]")) console.log(msg.text());
  });

  /* ── Step 1: go to login, pre-seed localStorage with fake company color ── */
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(({ uid, fakeColor }) => {
    localStorage.clear();

    // Simulate returning user: store fake company color + last_user_id
    localStorage.setItem(`accentColor_${uid}`, fakeColor);
    localStorage.setItem("last_user_id", uid);

    // Intercept ALL future setItem calls
    window.__lsMutations = [];
    const origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      const stack = new Error().stack.split('\n').slice(1, 5).join(' || ').substring(0, 300);
      window.__lsMutations.push({ ms: Date.now(), key, value, stack });
      origSet(key, value);
      if (key.includes("accent") || key.includes("last_user")) {
        console.log(`[DIAG] t=+?ms localStorage.setItem("${key}", "${value}")`);
      }
    };

    window.__t0 = Date.now();
    console.log(`[DIAG] Pre-seeded: accentColor_${uid} = "${fakeColor}"`);
    console.log(`[DIAG] Pre-seeded: last_user_id = "${uid}"`);
  }, { uid: KNOWN_UID, fakeColor: FAKE_COLOR });

  console.log(`\n[SETUP] Pre-seeded localStorage with accentColor_${KNOWN_UID} = "${FAKE_COLOR}"`);
  console.log(`[SETUP] This simulates a returning user whose company color is ${FAKE_COLOR}\n`);

  /* ── Step 2: fill and submit login ── */
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  /* ── Step 3: poll --accent and localStorage every 16ms ── */
  const timeline = [];
  let polling = true;
  const t0 = Date.now();

  const pollLoop = (async () => {
    while (polling) {
      const s = await page.evaluate((t0ref) => {
        const style = getComputedStyle(document.documentElement);
        const computed = style.getPropertyValue("--accent").trim();
        const inline   = document.documentElement.style.getPropertyValue("--accent").trim();
        const lsSnap = Object.fromEntries(
          Object.keys(localStorage)
            .filter(k => k.startsWith("accentColor") || k === "last_user_id")
            .map(k => [k, localStorage.getItem(k)])
        );
        return { ms: Date.now() - t0ref, computed, inline, ls: lsSnap };
      }, t0);
      timeline.push(s);
      await new Promise(r => setTimeout(r, 16));
    }
  })();

  await page.click('button[type="submit"]');
  console.log(`[t=0ms] Submit clicked`);

  try {
    await page.waitForURL(url => !url.href.includes("/login"), { timeout: 15000 });
  } catch { /* timeout ok */ }
  console.log(`[t=${Date.now()-t0}ms] Navigated to: ${page.url()}`);

  // Wait for effects to settle
  await new Promise(r => setTimeout(r, 2500));
  polling = false;
  await pollLoop;

  /* ── Report 1: color timeline (changes only) ── */
  console.log("\n━━━ COLOR TIMELINE (changes only) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  let prev = null;
  for (const s of timeline) {
    const changed = !prev
      || s.computed !== prev.computed
      || s.inline !== prev.inline
      || JSON.stringify(s.ls) !== JSON.stringify(prev.ls);
    if (changed) {
      const lsAccent = Object.entries(s.ls).find(([k]) => k.startsWith("accentColor"))?.[1] ?? "—";
      console.log(`  t=${String(s.ms).padStart(5)}ms | CSS --accent="${s.computed}" | inline="${s.inline}" | cached="${lsAccent}"`);
      prev = s;
    }
  }

  /* ── Report 2: localStorage mutations in chronological order ── */
  const mutations = await page.evaluate(() => window.__lsMutations || []);
  const t0ms = mutations[0]?.ms ?? t0;

  console.log("\n━━━ localStorage.setItem MUTATIONS (chronological) ━━━━━━━━━━━━━━━━━━━━━━━━");
  if (mutations.length === 0) {
    console.log("  (none captured — setItem interception may have reset on navigation)");
  }
  for (const m of mutations) {
    if (m.key.includes("accent") || m.key.includes("last_user")) {
      const rel = m.ms - t0ms;
      console.log(`  t=+${String(rel).padStart(5)}ms | "${m.key}" ← "${m.value}"`);
      // Show abbreviated stack to find the React hook origin
      const hookLine = m.stack.split('||').find(l => l.includes('ThemeContext') || l.includes('useIsomorphic') || l.includes('useEffect'));
      if (hookLine) console.log(`             └─ ${hookLine.trim().substring(0, 120)}`);
    }
  }

  /* ── Report 3: did the fake color survive? ── */
  const finalLs = await page.evaluate(({ uid }) =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter(k => k.includes("accent") || k.includes("last_user"))
        .map(k => [k, localStorage.getItem(k)])
    ),
    { uid: KNOWN_UID }
  );

  console.log("\n━━━ FINAL localStorage state ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(JSON.stringify(finalLs, null, 2));

  const survivalKey = `accentColor_${KNOWN_UID}`;
  const survived = finalLs[survivalKey] === FAKE_COLOR;
  console.log(`\n━━━ VERDICT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Pre-seeded: "${survivalKey}" = "${FAKE_COLOR}"`);
  console.log(`  Final:      "${survivalKey}" = "${finalLs[survivalKey] ?? "(missing)"}"`);
  if (!survived) {
    console.log(`  ✗ CACHE DESTROYED — useIsomorphicLayoutEffect overwrote the cached color with DEFAULT_ACCENT`);
    console.log(`    This is the root cause of the color flash.`);
  } else {
    console.log(`  ✓ Cache survived — bug NOT reproduced (check if account UID matched)`);
  }

  await browser.close();
})();
