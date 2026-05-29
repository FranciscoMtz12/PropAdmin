/**
 * Diagnóstico de orquestación login → home.
 * Captura URL, estado DOM, CSS --accent y sessionStorage.show_splash
 * cuadro a cuadro (cada 50ms) desde submit hasta que /home es estable.
 *
 * Credenciales en .env.local (SAPROA_AUDIT_EMAIL / SAPROA_AUDIT_PW).
 * Correr con: node --env-file=.env.local scripts/audit/diagnose-login-bounce.mjs
 */
import { chromium } from "playwright";

const email    = process.env.SAPROA_AUDIT_EMAIL ?? "";
const password = process.env.SAPROA_AUDIT_PW    ?? "";
const BASE_URL = "http://localhost:3000";

if (!email || !password) {
  console.error("Define SAPROA_AUDIT_EMAIL y SAPROA_AUDIT_PW en .env.local");
  process.exit(1);
}

/* ─── helpers de clasificación DOM ─────────────────────────────────── */
function classifyDOM(info) {
  const { url, routeGuardSplash, splashScreen, loginForm, homeContent, landingPage } = info;
  const parts = [];
  if (routeGuardSplash)  parts.push("RouteGuardSplash");
  if (splashScreen)      parts.push("SplashScreen");
  if (loginForm)         parts.push("LoginForm");
  if (homeContent)       parts.push("HomeContent");
  if (landingPage)       parts.push("LandingPage");
  if (!parts.length)     parts.push("(blank/transitioning)");
  return parts.join("+");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  const navigationEvents = [];
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) {
      navigationEvents.push({ ms: Date.now(), url: frame.url() });
    }
  });

  /* ─── 1. Ir a /login con localStorage limpio (simula usuario recurrente) ── */
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => { localStorage.clear(); });

  // Pre-sembrar el color cacheado del usuario (simula sesión previa)
  const KNOWN_UID = "a3e4f406-01b9-47bf-9e01-8e48731b02bc";
  const CACHED_COLOR = "#8B2252"; // color distinto del default para ver el flash
  await page.evaluate(({ uid, color }) => {
    localStorage.setItem(`accentColor_${uid}`, color);
    localStorage.setItem("last_user_id", uid);
  }, { uid: KNOWN_UID, color: CACHED_COLOR });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  /* ─── 2. Arrancar polling antes del submit ──────────────────────────── */
  const timeline = [];
  let polling = true;
  const t0 = Date.now();

  const pollLoop = (async () => {
    while (polling) {
      const snap = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const accent = style.getPropertyValue("--accent").trim();
        const url = location.href;

        // RouteGuard splash: fixed overlay z-9999 con gradient oscuro
        const fixedDivs = Array.from(document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]'));
        const routeGuardSplash = fixedDivs.some(el => {
          const s = el.style;
          return s.zIndex === "9999" || window.getComputedStyle(el).zIndex === "9999";
        });

        // Detectar si hay img de logo SAPROA visible en un fixed overlay
        const saproaLogos = document.querySelectorAll('img[src*="saproa-stacked-dark"]');
        const splashLogoVisible = Array.from(saproaLogos).some(img => {
          const parent = img.closest('div');
          return parent && (window.getComputedStyle(parent).position === 'fixed');
        });

        // Login form: campo de email
        const loginForm = Boolean(document.querySelector('input[type="email"]'));

        // Home content: sidebar o header de /home
        const homeContent = Boolean(
          document.querySelector('[data-testid="sidebar"]') ||
          document.querySelector('nav[class*="sidebar"]') ||
          document.querySelector('aside') ||
          document.querySelector('[class*="Sidebar"]') ||
          // buscar texto típico de home
          document.body.innerText.includes("Inicio") && !loginForm
        );

        // Landing page: botones de rol (Administración, Equipo de Campo)
        const landingPage = Boolean(
          document.body.innerText.includes("Administración") &&
          document.body.innerText.includes("Equipo de Campo") &&
          !loginForm
        );

        const showSplash = sessionStorage.getItem("show_splash");

        return { url, accent, routeGuardSplash, splashLogoVisible, loginForm, homeContent, landingPage, showSplash };
      }).catch(() => null);

      if (snap) {
        timeline.push({ ms: Date.now() - t0, ...snap });
      }
      await new Promise(r => setTimeout(r, 50));
    }
  })();

  /* ─── 3. Submit ─────────────────────────────────────────────────────── */
  const tSubmit = Date.now() - t0;
  await page.click('button[type="submit"]');
  console.log(`\n[t=0ms] Submit click`);

  /* ─── 4. Esperar hasta que /home esté estable ───────────────────────── */
  try {
    await page.waitForURL(u => !u.href.includes("/login"), { timeout: 15000 });
  } catch { /* timeout OK */ }

  // Esperar 3s adicionales para que todo se asiente
  await new Promise(r => setTimeout(r, 3000));
  polling = false;
  await pollLoop;

  console.log(`[t=${Date.now()-t0-tSubmit}ms] Polling finalizado. URL final: ${page.url()}`);

  /* ─── 5. Reportar navegaciones ──────────────────────────────────────── */
  console.log("\n━━━ NAVEGACIONES (framenavigated) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const e of navigationEvents) {
    console.log(`  t=${String(e.ms - (navigationEvents[0]?.ms ?? e.ms)).padStart(5)}ms | ${e.url}`);
  }

  /* ─── 6. Línea de tiempo — solo cambios significativos ─────────────── */
  console.log("\n━━━ LÍNEA DE TIEMPO DE ESTADO DOM (solo cambios) ━━━━━━━━━━━━━━━━━━━━━━━━");
  let prev = null;
  for (const s of timeline) {
    const dom     = classifyDOM(s);
    const changed = !prev
      || s.url !== prev.url
      || s.accent !== prev.accent
      || s.splashLogoVisible !== prev.splashLogoVisible
      || s.routeGuardSplash !== prev.routeGuardSplash
      || s.loginForm !== prev.loginForm
      || s.homeContent !== prev.homeContent
      || s.landingPage !== prev.landingPage;

    if (changed) {
      const path = s.url.replace(BASE_URL, "").split("?")[0] || "/";
      const splash = s.splashLogoVisible ? " [LOGO VISIBLE]" : "";
      const splashFlag = s.showSplash ? " show_splash=1" : "";
      console.log(`  t=${String(s.ms).padStart(5)}ms | url=${path.padEnd(28)} | DOM: ${dom.padEnd(40)} | --accent=${s.accent}${splash}${splashFlag}`);
      prev = s;
    }
  }

  /* ─── 7. Resumen de duración de cada fase ───────────────────────────── */
  const phases = [];
  let phaseStart = null;
  let phaseDOM   = null;
  let phaseUrl   = null;
  for (const s of timeline) {
    const dom = classifyDOM(s);
    const url = s.url.replace(BASE_URL, "").split("?")[0] || "/";
    if (!phaseStart || dom !== phaseDOM || url !== phaseUrl) {
      if (phaseStart !== null) {
        phases.push({ url: phaseUrl, dom: phaseDOM, durationMs: s.ms - phaseStart });
      }
      phaseStart = s.ms;
      phaseDOM   = dom;
      phaseUrl   = url;
    }
  }
  if (phaseStart !== null) {
    const last = timeline[timeline.length - 1];
    phases.push({ url: phaseUrl, dom: phaseDOM, durationMs: (last?.ms ?? phaseStart) - phaseStart });
  }

  console.log("\n━━━ DURACIÓN DE CADA FASE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const p of phases) {
    const bar = "█".repeat(Math.max(1, Math.round(p.durationMs / 50)));
    console.log(`  ${String(p.durationMs).padStart(5)}ms  ${p.url.padEnd(28)} ${p.dom.padEnd(50)} ${bar}`);
  }

  await browser.close();
})();
