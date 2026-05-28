/**
 * mobile-audit-v5.mjs — Reporte mobile SAPROA v5
 * Espera 3 min para deploy de Vercel, luego toma screenshots base64
 * y genera HTML con formato exacto del original + lightbox.
 *
 * Run: node scripts/mobile-audit-v5.mjs
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

/* ───── CONFIG ───── */
const BASE_URL = "https://www.saproa.com";
const DATE_STR = new Date().toISOString().split("T")[0];
const VERCEL_WAIT_MS = 0; // ya desplegado — skip wait

const CREDS = {
  titular:    { email: "titular@fra-mar.mx",    password: "SaproaP01" },
  superadmin: { email: "fco.mtz.c@hotmail.com", password: "Pruebas1"  },
};

const VIEWPORTS = [
  { width: 375, height: 812, label: "375×812" },
  { width: 390, height: 844, label: "390×844" },
  { width: 414, height: 896, label: "414×896" },
];

const TITULAR_PAGES = [
  { name: "home",        path: "/home"        },
  { name: "dashboard",   path: "/dashboard"   },
  { name: "buildings",   path: "/buildings"   },
  { name: "collections", path: "/collections" },
  { name: "tenants",     path: "/tenants"     },
  { name: "maintenance", path: "/maintenance" },
  { name: "purchases",   path: "/purchases"   },
  { name: "servicios",   path: "/servicios"   },
  { name: "payments",    path: "/payments"    },
  { name: "cleaning",    path: "/cleaning"    },
  { name: "settings",    path: "/settings"    },
  { name: "calendar",    path: "/calendar"    },
];

const SUPERADMIN_PAGES = [
  { name: "saproa-overview",   path: "/saproa-admin/overview"   },
  { name: "saproa-empresas",   path: "/saproa-admin/empresas"   },
  { name: "saproa-impersonar", path: "/saproa-admin/impersonar" },
];

const REPORT_DIR  = path.join(process.cwd(), "scripts", "audit-reports");
const REPORT_PATH = path.join(REPORT_DIR, `mobile-audit-v5-${DATE_STR}.html`);

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

/* ───── CAMBIOS DEL ÚLTIMO COMMIT (para sección inicial del reporte) ───── */
const LAST_COMMIT_CHANGES = [
  { id: "C01", file: "components/MetricCircles.tsx", desc: "Siempre 6 columnas fijas con celdas vacías para uniformidad — todos los círculos tienen el mismo tamaño independientemente de cuántas métricas haya." },
  { id: "C02", file: "components/MetricCircles.tsx", desc: "formatMetricValue(): abrevia números grandes ($1.2M, $484k). uiTheme-aware: borderRadius cambia según tema (50% super_soft, md clásico, 2px rígido)." },
  { id: "C03", file: "app/tenants/page.tsx", desc: "AppGrid de MetricCards ocultado en mobile con .metric-grid-desktop-only — MetricCircles lo reemplaza." },
  { id: "C04", file: "app/cleaning/page.tsx", desc: "mod-stat-bar ocultado en mobile — MetricCircles lo reemplaza." },
  { id: "C05", file: "app/analytics/page.tsx", desc: "analytics-stat-bar ocultado en mobile — MetricCircles lo reemplaza." },
  { id: "C06", file: "app/servicios/page.tsx", desc: "Div de service-type cards ocultado en mobile con .metric-grid-desktop-only." },
  { id: "C07", file: "app/collections/page.tsx", desc: "Donuts en columna en mobile (.collections-chart-row { grid-template-columns: 1fr })." },
  { id: "C08", file: "app/globals.css", desc: "CSS consolidado: .mod-stat-bar oculto en mobile, .collections-chart-row, gap y layout corrections." },
];

/* ───── LOGIN ───── */
async function loginAs(page, role, retries = 3) {
  const { email, password } = CREDS[role];
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(BASE_URL + "/login", { waitUntil: "networkidle", timeout: 45000 });
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForFunction(
        () => !window.location.pathname.includes("/login"),
        { timeout: 30000 }
      ).catch(() => {});
      await page.waitForTimeout(2000);
      return; // success
    } catch (err) {
      console.error(`  ✗ Login attempt ${attempt}/${retries} failed: ${err.message.slice(0, 80)}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 5000));
      else throw err;
    }
  }
}

/* ───── AUDIT SINGLE VIEWPORT ───── */
async function auditViewport(page, pagePath, vp) {
  const result = {
    viewport: vp.label,
    hasOverflow: false,
    smallTargets: [],
    fontScale: null,
    screenshotB64: null,
    error: null,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL + pagePath, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);

    result.hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    result.smallTargets = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 44; })
        .map(el => ({
          tag:    el.tagName.toLowerCase(),
          text:   (el.textContent || "").trim().slice(0, 50),
          height: Math.round(el.getBoundingClientRect().height),
          width:  Math.round(el.getBoundingClientRect().width),
        }))
        .slice(0, 8)
    );

    result.fontScale = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim() || "1"
    );

    const buf = await page.screenshot({ fullPage: true });
    result.screenshotB64 = buf.toString("base64");
    break; // success — exit retry loop
  } catch (err) {
    if (attempt === 2 || !err.message.includes("ERR_NAME_NOT_RESOLVED")) {
      result.error = err.message;
      console.error(`  ✗ ERROR @ ${vp.label}: ${err.message.slice(0, 80)}`);
      break;
    }
    console.error(`  ↺ Retry @ ${vp.label} (DNS fluke)...`);
    await new Promise(r => setTimeout(r, 4000));
  }
  } // end retry loop

  return result;
}

/* ───── MAIN ───── */
async function main() {
  console.log("=== SAPROA Mobile Audit v5 ===");
  console.log(`Date: ${DATE_STR}`);
  if (VERCEL_WAIT_MS > 0) {
    console.log(`\nEsperando ${VERCEL_WAIT_MS / 60000} minutos para que Vercel termine de desplegar...`);
    const waitStart = Date.now();
    while (Date.now() - waitStart < VERCEL_WAIT_MS) {
      const remaining = Math.ceil((VERCEL_WAIT_MS - (Date.now() - waitStart)) / 1000);
      process.stdout.write(`\r  ${remaining}s restantes...`);
      await new Promise(r => setTimeout(r, 5000));
    }
    console.log("\n  ✓ Deploy completado — iniciando Playwright\n");
  } else {
    console.log("  ✓ Vercel ya desplegado — iniciando Playwright\n");
  }

  const browser = await chromium.launch({ headless: true });

  const pageResults = [];

  function addResult(pg, role, vpResult) {
    let entry = pageResults.find(r => r.name === pg.name);
    if (!entry) {
      entry = { name: pg.name, path: pg.path, role, vpResults: [] };
      pageResults.push(entry);
    }
    entry.vpResults.push(vpResult);
  }

  /* ── TITULAR ── */
  console.log(">> TITULAR PAGES");
  for (const vp of VIEWPORTS) {
    const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    console.log(`  Login titular @ ${vp.label}...`);
    await loginAs(page, "titular");
    for (const pg of TITULAR_PAGES) {
      console.log(`  [${vp.label}] ${pg.name}...`);
      addResult(pg, "titular", await auditViewport(page, pg.path, vp));
    }
    await ctx.close();
  }

  /* ── SUPERADMIN ── */
  console.log("\n>> SUPERADMIN PAGES");
  for (const vp of VIEWPORTS) {
    const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    console.log(`  Login superadmin @ ${vp.label}...`);
    await loginAs(page, "superadmin");
    for (const pg of SUPERADMIN_PAGES) {
      console.log(`  [${vp.label}] ${pg.name}...`);
      addResult(pg, "superadmin", await auditViewport(page, pg.path, vp));
    }
    await ctx.close();
  }

  await browser.close();
  console.log("\nGenerando HTML...");

  /* ───── STATS ───── */
  const totalPages      = pageResults.length;
  const pagesWithIssues = pageResults.filter(p =>
    p.vpResults.some(r => r.hasOverflow || r.error || r.smallTargets.length > 0)
  ).length;
  const overflowIssues  = pageResults.reduce((s, p) =>
    s + p.vpResults.filter(r => r.hasOverflow).length, 0);
  const touchIssues     = pageResults.filter(p =>
    p.vpResults.some(r => r.smallTargets.length > 0)
  ).length;

  /* ───── SECCIÓN CAMBIOS ───── */
  const changesHtml = LAST_COMMIT_CHANGES.map((c, i) => `
    <div class="fix-item touch-target">
      <div class="fix-header">
        <span class="fix-num">${c.id}</span>
        <span class="fix-page">${c.file}</span>
      </div>
      <div class="fix-desc">${c.desc}</div>
    </div>`).join("\n");

  /* ───── ISSUES LIST ───── */
  const issueItems = pageResults
    .filter(p => p.vpResults.some(r => r.hasOverflow || r.smallTargets.length > 0 || r.error))
    .map((p, idx) => {
      const hasOverflow   = p.vpResults.some(r => r.hasOverflow);
      const maxTargets    = Math.max(...p.vpResults.map(r => r.smallTargets.length));
      const sampleTargets = p.vpResults.find(r => r.smallTargets.length > 0)?.smallTargets ?? [];
      const type = hasOverflow ? "overflow" : "touch-target";
      const badgeClass = hasOverflow ? "fail" : "warn";
      const label = hasOverflow ? "OVERFLOW" : "TOUCH-TARGET";
      const desc  = hasOverflow
        ? "Overflow horizontal detectado"
        : `${maxTargets} element(s) with height < 44px`;
      const rec   = hasOverflow
        ? "Recommendation: Fix grid/flex overflow — use minmax(0,1fr), overflow:hidden"
        : "Recommendation: Add minHeight: 44px to affected buttons/links via CSS class";
      const elsList = sampleTargets.length
        ? `<ul class="fix-els">${sampleTargets.slice(0, 5).map(t =>
            `<li><code>&lt;${t.tag}&gt;</code> "${t.text || "(sin texto)"}" — ${t.height}px</li>`
          ).join("")}</ul>`
        : "";
      return `
      <div class="fix-item ${type}">
        <div class="fix-header">
          <span class="fix-num">#${idx + 1}</span>
          <span class="fix-page">${p.name} <code>${p.path}</code></span>
          <span class="fix-type badge ${badgeClass}">${label}</span>
        </div>
        <div class="fix-desc">${desc}</div>
        <div class="fix-rec">${rec}</div>
        ${elsList}
      </div>`;
    }).join("\n");

  /* ───── PAGE CARDS ───── */
  const pageCards = pageResults.map(p => {
    const hasIssues = p.vpResults.some(r => r.hasOverflow || r.error || r.smallTargets.length > 0);
    const overallBadge = hasIssues
      ? `<span class="badge fail">ISSUE</span>`
      : `<span class="badge pass">PASS</span>`;

    const ssCols = p.vpResults.map(r => {
      const overflowBadge = r.hasOverflow
        ? `<span class="badge fail">OVERFLOW</span>`
        : `<span class="badge pass">NO OVERFLOW</span>`;
      const touchCount = r.smallTargets.length;
      const touchBadge = touchCount > 0
        ? `<span class="badge warn">TOUCH ${touchCount}</span>`
        : `<span class="badge pass">TOUCH OK</span>`;
      const errBadge = r.error ? `<span class="badge fail">ERROR</span>` : "";

      const imgTag = r.screenshotB64
        ? `<img
            src="data:image/png;base64,${r.screenshotB64}"
            alt="${r.viewport}"
            class="ss-img"
            loading="lazy"
            onclick="showLb(this.src)"
            style="cursor:zoom-in" />`
        : `<div class="ss-placeholder">${r.error ? "Error: " + r.error.slice(0, 60) : "Sin screenshot"}</div>`;

      return `
        <div class="ss-col">
          <div class="ss-label">${r.viewport}</div>
          ${imgTag}
          <div class="ss-meta">
            ${overflowBadge}
            ${touchBadge}
            ${errBadge}
          </div>
        </div>`;
    }).join("\n");

    /* issue-detail blocks */
    const fontScaleVal = p.vpResults[0]?.fontScale ?? "—";
    const fontScaleOk  = parseFloat(fontScaleVal || "1") === 1.0 || fontScaleVal === "" || fontScaleVal === "1";
    const fontScaleDetail = fontScaleVal
      ? `<div class="issue-detail">
          <strong>Font Scale (--font-scale):</strong>
          ${fontScaleOk
            ? `<span class="ok">${fontScaleVal} ✓ OK</span>`
            : `<span class="bad">${fontScaleVal} ✗ Resetear al salir</span>`}
        </div>`
      : "";

    const allTargets    = p.vpResults.flatMap(r => r.smallTargets);
    const uniqueTargets = allTargets
      .filter((t, i, arr) => arr.findIndex(x => x.tag === t.tag && x.text === t.text) === i)
      .slice(0, 8);
    const touchDetail = uniqueTargets.length
      ? `<div class="issue-detail">
          <strong>Small touch targets (&lt;44px):</strong>
          <ul>${uniqueTargets.map(t =>
            `<li><code>&lt;${t.tag}&gt;</code> "${t.text || "(sin texto)"}" — ${t.height}×${t.width}px</li>`
          ).join("")}</ul>
        </div>`
      : "";

    return `
      <div class="page-card${hasIssues ? " has-issues" : ""}">
        <div class="page-header">
          <div class="page-title">
            <span class="role-badge">${p.role}</span>
            <strong>${p.name}</strong>
            <code>${p.path}</code>
          </div>
          ${overallBadge}
        </div>
        <div class="ss-row">
          ${ssCols}
        </div>
        ${fontScaleDetail}
        ${touchDetail}
      </div>`;
  }).join("\n");

  /* ───── HTML FINAL (formato exacto del original + lightbox) ───── */
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SAPROA Mobile Audit v5 — ${DATE_STR}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f1117;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 1.75rem; font-weight: 800; color: #f1f5f9; margin-bottom: 4px; }
  h2 { font-size: 1.125rem; font-weight: 700; color: #cbd5e1; margin: 32px 0 16px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
  .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }
  .stats-bar { display: flex; gap: 16px; flex-wrap: wrap; margin: 24px 0; }
  .stat { background: #1e2535; border: 1px solid #2d3748; border-radius: 12px; padding: 16px 20px; flex: 1; min-width: 140px; text-align: center; }
  .stat-val { font-size: 2rem; font-weight: 800; }
  .stat-val.green { color: #4ade80; }
  .stat-val.red { color: #f87171; }
  .stat-val.amber { color: #fcd34d; }
  .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .badge.pass { background: #052e16; color: #4ade80; border: 1px solid #166534; }
  .badge.fail { background: #1c0507; color: #f87171; border: 1px solid #9f1239; }
  .badge.warn { background: #1c1106; color: #fcd34d; border: 1px solid #854d0e; }
  .page-card { background: #1a2030; border: 1px solid #2d3748; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
  .page-card.has-issues { border-color: #854d0e; }
  .page-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: #1e293b; gap: 12px; flex-wrap: wrap; }
  .page-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .page-title strong { color: #f1f5f9; font-size: 0.9375rem; }
  .page-title code { color: #94a3b8; font-size: 0.8125rem; background: #0f1623; padding: 2px 6px; border-radius: 4px; }
  .role-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.625rem; font-weight: 800; text-transform: uppercase; background: #0c1a3a; color: #60a5fa; border: 1px solid #1e40af; }
  .ss-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #2d3748; }
  .ss-col { background: #0f1623; padding: 12px; }
  .ss-label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-align: center; }
  .ss-img { width: 100%; height: auto; border-radius: 6px; display: block; max-height: 500px; object-fit: contain; transition: opacity 0.15s; }
  .ss-img:hover { opacity: 0.82; }
  .ss-placeholder { height: 200px; display: flex; align-items: center; justify-content: center; color: #475569; font-size: 0.75rem; background: #1a2030; border-radius: 6px; }
  .ss-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; justify-content: center; }
  .issue-detail { padding: 12px 20px; border-top: 1px solid #2d3748; font-size: 0.8125rem; }
  .issue-detail ul { margin-top: 6px; padding-left: 18px; }
  .issue-detail li { color: #94a3b8; margin: 2px 0; }
  .issue-detail code { background: #0f1623; padding: 1px 5px; border-radius: 3px; font-size: 0.75rem; }
  .issue-detail .ok { color: #4ade80; }
  .issue-detail .bad { color: #f87171; }
  .fix-item { background: #1a2030; border: 1px solid #2d3748; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .fix-item.overflow { border-left: 4px solid #f87171; }
  .fix-item.touch-target { border-left: 4px solid #fcd34d; }
  .fix-item.change { border-left: 4px solid #6366f1; }
  .fix-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .fix-num { background: #2d3748; color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .fix-page { font-weight: 600; color: #f1f5f9; }
  .fix-page code { color: #94a3b8; font-size: 0.8125rem; }
  .fix-desc { color: #cbd5e1; margin-bottom: 6px; }
  .fix-rec { color: #64748b; font-size: 0.8125rem; font-style: italic; }
  .fix-els { margin-top: 8px; padding-left: 16px; color: #94a3b8; font-size: 0.8125rem; list-style: disc; }
  .fix-els code { background: #0f1623; padding: 1px 4px; border-radius: 3px; }
  .no-issues { color: #4ade80; padding: 20px; text-align: center; background: #052e16; border-radius: 8px; border: 1px solid #166534; }
  /* Lightbox */
  #lb-overlay { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.93); align-items: center; justify-content: center; cursor: zoom-out; }
  #lb-overlay.active { display: flex; }
  #lb-overlay img { max-width: 95vw; max-height: 95vh; border-radius: 8px; cursor: default; box-shadow: 0 0 80px rgba(0,0,0,0.9); }
  #lb-close { position: fixed; top: 18px; right: 22px; font-size: 2.25rem; line-height: 1; color: #fff; cursor: pointer; opacity: 0.65; user-select: none; }
  #lb-close:hover { opacity: 1; }
</style>
</head>
<body>
<div class="container">
  <h1>SAPROA Mobile Audit v5</h1>
  <p class="subtitle">Generated: ${DATE_STR} | Viewports: 375×812, 390×844, 414×896 | Base URL: https://www.saproa.com | Último commit: 4a8b09d</p>

  <div class="stats-bar">
    <div class="stat">
      <div class="stat-val">${totalPages}</div>
      <div class="stat-label">Pages tested</div>
    </div>
    <div class="stat">
      <div class="stat-val ${pagesWithIssues > 0 ? "red" : "green"}">${pagesWithIssues}</div>
      <div class="stat-label">Pages with issues</div>
    </div>
    <div class="stat">
      <div class="stat-val ${overflowIssues > 0 ? "red" : "green"}">${overflowIssues}</div>
      <div class="stat-label">Overflow issues</div>
    </div>
    <div class="stat">
      <div class="stat-val ${touchIssues > 0 ? "amber" : "green"}">${touchIssues}</div>
      <div class="stat-label">Touch target issues</div>
    </div>
  </div>

  <h2>Cambios del último commit (4a8b09d)</h2>
  ${changesHtml}

  <h2>Issues Found</h2>
  ${issueItems || '<div class="no-issues">✓ No issues found across all pages and viewports</div>'}

  <h2>Page Results</h2>
  ${pageCards}

</div>

<div id="lb-overlay" onclick="hideLb()">
  <span id="lb-close" onclick="hideLb()">✕</span>
  <img id="lb-img" src="" alt="" onclick="event.stopPropagation()" />
</div>

<script>
function showLb(src) {
  document.getElementById('lb-img').src = src;
  document.getElementById('lb-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function hideLb() {
  document.getElementById('lb-overlay').classList.remove('active');
  document.getElementById('lb-img').src = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideLb(); });
</script>
</body>
</html>`;

  fs.writeFileSync(REPORT_PATH, html, "utf8");
  const sizeMB = (fs.statSync(REPORT_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ Reporte: ${REPORT_PATH} (${sizeMB} MB)`);
  console.log(`  Páginas: ${totalPages} | Con issues: ${pagesWithIssues} | Overflows: ${overflowIssues} | Touch: ${touchIssues}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
