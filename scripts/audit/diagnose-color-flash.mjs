/**
 * Diagnóstico de destello de color en login → /saproa-admin/overview.
 *
 * Corre DOS escenarios para superadmin:
 *   A) Cache pre-sembrado con color vino (#8B2252) — simula post-impersonation
 *   B) Sin caché previo — simula primer login o login limpio
 *
 * Captura --accent cada 10ms desde el submit hasta /home estable.
 * Credenciales: SAPROA_AUDIT_EMAIL / SAPROA_AUDIT_PW en .env.local
 */
import { chromium } from "playwright";

const email    = process.env.SAPROA_AUDIT_EMAIL ?? "";
const password = process.env.SAPROA_AUDIT_PW    ?? "";
const BASE_URL = "http://localhost:3000";

if (!email || !password) {
  console.error("Define SAPROA_AUDIT_EMAIL y SAPROA_AUDIT_PW en .env.local");
  process.exit(1);
}

const KNOWN_UID    = "a3e4f406-01b9-47bf-9e01-8e48731b02bc";
const WRONG_COLOR  = "#8B2252";   // color vino (simula caché de impersonation)

async function runScenario(label, preseedColor) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`ESCENARIO ${label}`);
  console.log(`${"═".repeat(70)}`);

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => localStorage.clear());

  if (preseedColor) {
    await page.evaluate(({ uid, color }) => {
      localStorage.setItem(`accentColor_${uid}`, color);
      localStorage.setItem("last_user_id", uid);
    }, { uid: KNOWN_UID, color: preseedColor });
    console.log(`Pre-seed: accentColor_${KNOWN_UID} = "${preseedColor}"`);
  } else {
    console.log(`Sin pre-seed: localStorage completamente limpio`);
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  /* ── Polling de colores cada 10ms ──────────────────────────────────── */
  const timeline = [];
  let polling = true;
  const t0 = Date.now();

  const pollLoop = (async () => {
    while (polling) {
      const s = await page.evaluate((t0ref) => {
        const style = getComputedStyle(document.documentElement);
        return {
          ms:      Date.now() - t0ref,
          url:     location.pathname,
          accent:  style.getPropertyValue("--accent").trim(),
          primary: style.getPropertyValue("--color-primary").trim(),
        };
      }, t0).catch(() => null);
      if (s) timeline.push(s);
      await new Promise(r => setTimeout(r, 10));
    }
  })();

  /* ── Submit ─────────────────────────────────────────────────────────── */
  await page.locator('button[type="submit"]').click({ force: true });
  console.log(`[t=0ms] Submit click`);

  try {
    await page.waitForURL(u => !u.href.includes("/login"), { timeout: 20000 });
  } catch { /* timeout ok */ }

  await new Promise(r => setTimeout(r, 2500));
  polling = false;
  await pollLoop;

  console.log(`\nURL final: ${page.url()}`);

  /* ── Reportar solo cambios de --accent ─────────────────────────────── */
  console.log(`\n── Secuencia de --accent (solo cambios) ────────────────────────────`);
  let prev = null;
  const changes = [];
  for (const s of timeline) {
    if (!prev || s.accent !== prev.accent || s.url !== prev.url) {
      changes.push(s);
      const marker = preseedColor && s.accent === preseedColor  ? " ← WRONG (caché impersonation)"
                   : s.accent === "#6366f1" || s.accent === "#6366F1" ? " ← #6366F1 SAPROA/DEFAULT"
                   : s.accent === "#6366f1".toUpperCase() ? " ← DEFAULT"
                   : "";
      console.log(`  t=${String(s.ms).padStart(5)}ms  url=${s.url.padEnd(25)}  --accent=${s.accent}${marker}`);
      prev = s;
    }
  }

  /* ── Medir duración del destello ────────────────────────────────────── */
  if (preseedColor) {
    const wrongStart = changes.find(s => s.accent.toLowerCase() === preseedColor.toLowerCase());
    const wrongEnd   = wrongStart
      ? changes.find(s => changes.indexOf(s) > changes.indexOf(wrongStart) && s.accent.toLowerCase() !== preseedColor.toLowerCase())
      : null;
    if (wrongStart && wrongEnd) {
      const duration = wrongEnd.ms - wrongStart.ms;
      console.log(`\n  ► Destello "${preseedColor}" visible: ${duration}ms  (t=${wrongStart.ms} → t=${wrongEnd.ms})`);
    } else if (wrongStart && !wrongEnd) {
      console.log(`\n  ► Color "${preseedColor}" aplicado y NUNCA corregido (posible bug)`);
    } else {
      console.log(`\n  ► Caché "${preseedColor}" NO fue aplicado (fix funcionando o caché ignorado)`);
    }
  }

  /* ── Estado final del localStorage ─────────────────────────────────── */
  const finalLs = await page.evaluate(({ uid }) => ({
    accentColor: localStorage.getItem(`accentColor_${uid}`),
    last_user_id: localStorage.getItem("last_user_id"),
  }), { uid: KNOWN_UID });
  console.log(`\n  localStorage final:`);
  console.log(`    accentColor_${KNOWN_UID} = "${finalLs.accentColor}"`);
  console.log(`    last_user_id             = "${finalLs.last_user_id}"`);

  await browser.close();
  return changes;
}

(async () => {
  const changesA = await runScenario("A — Caché vino (#8B2252, simula post-impersonation)", WRONG_COLOR);
  const changesB = await runScenario("B — Sin caché (login limpio)",                       null);

  /* ── Comparativa final ───────────────────────────────────────────────── */
  console.log(`\n${"═".repeat(70)}`);
  console.log(`ANÁLISIS COMPARATIVO`);
  console.log(`${"═".repeat(70)}`);

  const colorsA = [...new Set(changesA.map(s => s.accent))];
  const colorsB = [...new Set(changesB.map(s => s.accent))];
  console.log(`\nEscenario A (vino cacheado) — colores únicos vistos: ${colorsA.join(" → ")}`);
  console.log(`Escenario B (sin caché)     — colores únicos vistos: ${colorsB.join(" → ")}`);

  const flashA = changesA.find(s => s.accent.toLowerCase() === WRONG_COLOR.toLowerCase());
  console.log(`\nDestello del vino en A: ${flashA ? `SÍ (aparece a t=${flashA.ms}ms)` : "NO"}`);
  console.log(`Destello del vino en B: ${changesB.some(s => s.accent.toLowerCase() === WRONG_COLOR.toLowerCase()) ? "SÍ" : "NO"}`);

  const finalA = changesA[changesA.length - 1]?.accent ?? "(n/a)";
  const finalB = changesB[changesB.length - 1]?.accent ?? "(n/a)";
  console.log(`\nColor final en A: ${finalA}`);
  console.log(`Color final en B: ${finalB}`);
  console.log(`Colores finales iguales: ${finalA.toLowerCase() === finalB.toLowerCase() ? "SÍ ✓" : "NO (inconsistencia)"}`);
})();
