/**
 * mobile-audit.mjs — Auditoría mobile de PropAdmin/SAPROA
 *
 * Testea múltiples páginas con 3 viewports (375×812, 390×844, 414×896)
 * Detecta: overflow horizontal, touch targets pequeños (<44px)
 * Genera screenshots y reporte HTML autocontenido.
 *
 * Run: node scripts/mobile-audit.mjs
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

/* ───── CONFIG ───── */
const BASE_URL = "https://www.saproa.com";
const DATE_STR = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

const CREDS = {
  titular:    { email: "titular@fra-mar.mx",         password: "SaproaP01" },
  superadmin: { email: "fco.mtz.c@hotmail.com",       password: "Pruebas1" },
};

const VIEWPORTS = [
  { width: 375, height: 812,  label: "375×812" },
  { width: 390, height: 844,  label: "390×844" },
  { width: 414, height: 896,  label: "414×896" },
];

// Pages tested with titular login
const TITULAR_PAGES = [
  { name: "home",        path: "/home" },
  { name: "dashboard",   path: "/dashboard" },
  { name: "buildings",   path: "/buildings" },
  { name: "collections", path: "/collections" },
  { name: "tenants",     path: "/tenants" },
  { name: "maintenance", path: "/maintenance" },
  { name: "purchases",   path: "/purchases" },
  { name: "servicios",   path: "/servicios" },
  { name: "payments",    path: "/payments" },
  { name: "cleaning",    path: "/cleaning" },
  { name: "suppliers",   path: "/suppliers" },
  { name: "settings",    path: "/settings" },
  { name: "calendar",    path: "/calendar" },
];

// Pages tested with superadmin login
const SUPERADMIN_PAGES = [
  { name: "saproa-overview",  path: "/saproa-admin/overview" },
  { name: "saproa-empresas",  path: "/saproa-admin/empresas" },
  { name: "saproa-impersonar", path: "/saproa-admin/impersonar" },
];

// Login page — no auth needed
const PUBLIC_PAGES = [
  { name: "login", path: "/login" },
];

const SS_DIR = path.join(process.cwd(), "scripts", "screenshots", "mobile-audit-" + DATE_STR);
const REPORT_DIR = path.join(process.cwd(), "scripts", "audit-reports");
const REPORT_PATH = path.join(REPORT_DIR, `mobile-audit-${DATE_STR}.html`);

/* Ensure directories exist */
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

/* ───── HELPERS ───── */

async function loginAs(page, role) {
  const cred = CREDS[role];
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[type="email"]').fill(cred.email);
  await page.locator('input[type="password"]').fill(cred.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/login"),
    { timeout: 25000 }
  ).catch(() => {});
  // Give the app a moment to settle
  await page.waitForTimeout(1500);
}

async function auditPage(page, pagePath, pageName, viewport) {
  const result = {
    page: pageName,
    path: pagePath,
    viewport: viewport.label,
    hasOverflow: false,
    smallTargets: [],
    screenshotPath: null,
    error: null,
  };

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(BASE_URL + pagePath, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check horizontal overflow
    result.hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    // Check small touch targets
    result.smallTargets = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      return els
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.height < 44;
        })
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 40),
          height: Math.round(el.getBoundingClientRect().height),
          width: Math.round(el.getBoundingClientRect().width),
        }))
        .slice(0, 10); // limit to top 10
    });

    // Take screenshot
    const ssName = `${pageName}-${viewport.label.replace("×", "x")}.png`;
    const ssPath = path.join(SS_DIR, ssName);
    await page.screenshot({ path: ssPath, fullPage: true });
    result.screenshotPath = ssPath;

  } catch (err) {
    result.error = err.message;
    console.error(`  ERROR on ${pageName} @ ${viewport.label}: ${err.message}`);
  }

  return result;
}

/* ───── MAIN ───── */

async function main() {
  console.log("=== SAPROA Mobile Audit ===");
  console.log(`Date: ${DATE_STR}`);
  console.log(`Screenshots: ${SS_DIR}`);
  console.log("");

  const browser = await chromium.launch({ headless: true });
  const allResults = [];
  const fixes = [];

  /* ── 1. Audit PUBLIC pages (no auth) ── */
  console.log(">> PUBLIC PAGES (no auth)");
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const pg of PUBLIC_PAGES) {
      console.log(`  [${vp.label}] ${pg.name}...`);
      const result = await auditPage(page, pg.path, pg.name, vp);
      result.role = "none";

      // Special check for /login: font-scale should be 1.0
      if (pg.name === "login") {
        const fontScale = await page.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim();
        });
        result.fontScale = fontScale || "1";
        result.fontScaleOk = (parseFloat(result.fontScale) === 1.0 || result.fontScale === "" || result.fontScale === "1");
      }

      allResults.push(result);
    }
    await ctx.close();
  }

  /* ── 2. Audit TITULAR pages ── */
  console.log("\n>> TITULAR PAGES");
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    console.log(`  Logging in as titular @ ${vp.label}...`);
    await loginAs(page, "titular");

    // Auto-detect first building
    let buildingPath = null;
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL + "/buildings", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      const firstBuildingLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/buildings/"]'));
        for (const link of links) {
          const href = link.getAttribute("href");
          if (href && /\/buildings\/[a-zA-Z0-9-]+$/.test(href)) return href;
        }
        return null;
      });
      if (firstBuildingLink) buildingPath = firstBuildingLink;
    } catch(e) {}

    const titularPages = [...TITULAR_PAGES];
    if (buildingPath) {
      titularPages.splice(3, 0, { name: "building-detail", path: buildingPath });
    }

    for (const pg of titularPages) {
      console.log(`  [${vp.label}] ${pg.name}...`);
      const result = await auditPage(page, pg.path, pg.name, vp);
      result.role = "titular";
      allResults.push(result);
    }

    await ctx.close();
  }

  /* ── 3. Audit SUPERADMIN pages ── */
  console.log("\n>> SUPERADMIN PAGES");
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    console.log(`  Logging in as superadmin @ ${vp.label}...`);
    await loginAs(page, "superadmin");

    for (const pg of SUPERADMIN_PAGES) {
      console.log(`  [${vp.label}] ${pg.name}...`);
      const result = await auditPage(page, pg.path, pg.name, vp);
      result.role = "superadmin";
      allResults.push(result);
    }

    await ctx.close();
  }

  await browser.close();

  /* ── 4. Analyze results and determine fixes ── */
  const byPage = {};
  for (const r of allResults) {
    const key = `${r.role}::${r.page}`;
    if (!byPage[key]) byPage[key] = { page: r.page, path: r.path, role: r.role, viewports: [] };
    byPage[key].viewports.push(r);
  }

  // Detect pages with consistent overflow
  for (const [key, data] of Object.entries(byPage)) {
    const overflowCount = data.viewports.filter(v => v.hasOverflow).length;
    if (overflowCount > 0) {
      fixes.push({
        page: data.page,
        path: data.path,
        type: "overflow",
        description: `Horizontal overflow detected in ${overflowCount}/${data.viewports.length} viewports`,
        fix: "Add overflow-x: hidden to page container in globals.css",
      });
    }
    const smallTargetPages = data.viewports.filter(v => v.smallTargets && v.smallTargets.length > 0);
    if (smallTargetPages.length > 0) {
      const allSmall = smallTargetPages.flatMap(v => v.smallTargets);
      const uniqueSmall = [...new Map(allSmall.map(t => [t.text + t.tag, t])).values()];
      if (uniqueSmall.length > 0) {
        fixes.push({
          page: data.page,
          path: data.path,
          type: "touch-target",
          description: `${uniqueSmall.length} element(s) with height < 44px`,
          elements: uniqueSmall.slice(0, 5),
          fix: "Add minHeight: 44px to affected buttons/links via CSS class",
        });
      }
    }
  }

  /* ── 5. Generate HTML report ── */
  console.log("\n>> Generating HTML report...");
  const html = generateReport(allResults, byPage, fixes, DATE_STR);
  fs.writeFileSync(REPORT_PATH, html, "utf-8");
  console.log(`Report saved: ${REPORT_PATH}`);

  /* ── 6. Print summary ── */
  console.log("\n=== SUMMARY ===");
  const overflowPages = [...new Set(allResults.filter(r => r.hasOverflow).map(r => r.page))];
  const smallTargetPages2 = [...new Set(allResults.filter(r => r.smallTargets && r.smallTargets.length > 0).map(r => r.page))];
  console.log(`Overflow pages: ${overflowPages.length > 0 ? overflowPages.join(", ") : "none"}`);
  console.log(`Small target pages: ${smallTargetPages2.length > 0 ? smallTargetPages2.join(", ") : "none"}`);
  console.log(`Total issues: ${fixes.length}`);
  console.log("");

  return { allResults, fixes };
}

/* ───── REPORT GENERATOR ───── */

function imageToBase64(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = fs.readFileSync(filePath);
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

function statusBadge(hasIssues) {
  if (hasIssues) return `<span class="badge fail">ISSUE</span>`;
  return `<span class="badge pass">PASS</span>`;
}

function generateReport(allResults, byPage, fixes, dateStr) {
  // Collect unique pages in order
  const pageOrder = [];
  const seen = new Set();
  for (const r of allResults) {
    const k = `${r.role}::${r.page}`;
    if (!seen.has(k)) { seen.add(k); pageOrder.push(k); }
  }

  const pageCards = pageOrder.map(key => {
    const data = byPage[key];
    if (!data) return "";
    const viewportResults = data.viewports;
    const hasOverflow = viewportResults.some(v => v.hasOverflow);
    const hasSmallTargets = viewportResults.some(v => v.smallTargets && v.smallTargets.length > 0);
    const hasError = viewportResults.some(v => v.error);
    const hasIssues = hasOverflow || hasSmallTargets || hasError;

    const screenshotRow = viewportResults.map(v => {
      const b64 = imageToBase64(v.screenshotPath);
      return `
        <div class="ss-col">
          <div class="ss-label">${v.viewport}</div>
          ${b64
            ? `<img src="${b64}" alt="${v.viewport}" class="ss-img" loading="lazy" />`
            : `<div class="ss-placeholder">No screenshot</div>`
          }
          <div class="ss-meta">
            ${v.hasOverflow ? `<span class="badge fail">OVERFLOW</span>` : `<span class="badge pass">NO OVERFLOW</span>`}
            ${v.smallTargets && v.smallTargets.length > 0 ? `<span class="badge warn">TOUCH ${v.smallTargets.length}</span>` : ""}
            ${v.error ? `<span class="badge fail">ERROR</span>` : ""}
          </div>
        </div>`;
    }).join("");

    const smallTargetDetails = viewportResults
      .filter(v => v.smallTargets && v.smallTargets.length > 0)
      .flatMap(v => v.smallTargets)
      .slice(0, 6);
    const uniqueSmall = [...new Map(smallTargetDetails.map(t => [t.text + t.tag, t])).values()];

    const fontScaleResult = viewportResults.find(v => v.fontScale != null);

    return `
      <div class="page-card ${hasIssues ? "has-issues" : ""}">
        <div class="page-header">
          <div class="page-title">
            <span class="role-badge">${data.role}</span>
            <strong>${data.page}</strong>
            <code>${data.path}</code>
          </div>
          ${statusBadge(hasIssues)}
        </div>
        <div class="ss-row">${screenshotRow}</div>
        ${fontScaleResult ? `
        <div class="issue-detail">
          <strong>Font Scale (--font-scale):</strong>
          <span class="${fontScaleResult.fontScaleOk ? "ok" : "bad"}">${fontScaleResult.fontScale} ${fontScaleResult.fontScaleOk ? "✓ OK" : "✗ Should be 1.0"}</span>
        </div>` : ""}
        ${hasOverflow ? `<div class="issue-detail overflow-issue"><strong>Horizontal overflow detected</strong> — page content exceeds viewport width.</div>` : ""}
        ${uniqueSmall.length > 0 ? `
        <div class="issue-detail">
          <strong>Small touch targets (&lt;44px):</strong>
          <ul>${uniqueSmall.map(t => `<li><code>&lt;${t.tag}&gt;</code> "${t.text || "(no text)"}" — ${t.height}×${t.width}px</li>`).join("")}</ul>
        </div>` : ""}
        ${viewportResults.some(v => v.error) ? `
        <div class="issue-detail error-detail">
          <strong>Errors:</strong>
          ${viewportResults.filter(v => v.error).map(v => `<div>${v.viewport}: ${v.error}</div>`).join("")}
        </div>` : ""}
      </div>`;
  }).join("\n");

  const fixesHtml = fixes.length === 0
    ? `<p class="no-issues">No issues detected — all pages pass!</p>`
    : fixes.map((f, i) => `
      <div class="fix-item ${f.type}">
        <div class="fix-header">
          <span class="fix-num">#${i + 1}</span>
          <span class="fix-page">${f.page} <code>${f.path}</code></span>
          <span class="fix-type badge ${f.type === "overflow" ? "fail" : "warn"}">${f.type.toUpperCase()}</span>
        </div>
        <div class="fix-desc">${f.description}</div>
        <div class="fix-rec">Recommendation: ${f.fix}</div>
        ${f.elements ? `<ul class="fix-els">${f.elements.map(e => `<li><code>&lt;${e.tag}&gt;</code> "${e.text}" — ${e.height}px</li>`).join("")}</ul>` : ""}
      </div>`).join("\n");

  const totalPages = Object.keys(byPage).length;
  const pagesWithIssues = Object.values(byPage).filter(d =>
    d.viewports.some(v => v.hasOverflow || (v.smallTargets && v.smallTargets.length > 0) || v.error)
  ).length;
  const overflowCount = fixes.filter(f => f.type === "overflow").length;
  const touchCount = fixes.filter(f => f.type === "touch-target").length;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SAPROA Mobile Audit — ${dateStr}</title>
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
  .stats-bar {
    display: flex; gap: 16px; flex-wrap: wrap; margin: 24px 0;
  }
  .stat {
    background: #1e2535; border: 1px solid #2d3748; border-radius: 12px;
    padding: 16px 20px; flex: 1; min-width: 140px; text-align: center;
  }
  .stat-val { font-size: 2rem; font-weight: 800; }
  .stat-val.green { color: #4ade80; }
  .stat-val.red { color: #f87171; }
  .stat-val.amber { color: #fcd34d; }
  .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .badge {
    display: inline-flex; align-items: center; padding: 2px 8px;
    border-radius: 999px; font-size: 0.6875rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .badge.pass { background: #052e16; color: #4ade80; border: 1px solid #166534; }
  .badge.fail { background: #1c0507; color: #f87171; border: 1px solid #9f1239; }
  .badge.warn { background: #1c1106; color: #fcd34d; border: 1px solid #854d0e; }
  .page-card {
    background: #1a2030; border: 1px solid #2d3748; border-radius: 12px;
    margin-bottom: 24px; overflow: hidden;
  }
  .page-card.has-issues { border-color: #854d0e; }
  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; background: #1e293b; gap: 12px; flex-wrap: wrap;
  }
  .page-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .page-title strong { color: #f1f5f9; font-size: 0.9375rem; }
  .page-title code { color: #94a3b8; font-size: 0.8125rem; background: #0f1623; padding: 2px 6px; border-radius: 4px; }
  .role-badge {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 0.625rem; font-weight: 800; text-transform: uppercase;
    background: #0c1a3a; color: #60a5fa; border: 1px solid #1e40af;
  }
  .ss-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #2d3748; }
  .ss-col { background: #0f1623; padding: 12px; }
  .ss-label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-align: center; }
  .ss-img { width: 100%; height: auto; border-radius: 6px; display: block; max-height: 500px; object-fit: contain; }
  .ss-placeholder { height: 200px; display: flex; align-items: center; justify-content: center; color: #475569; font-size: 0.75rem; background: #1a2030; border-radius: 6px; }
  .ss-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; justify-content: center; }
  .issue-detail {
    padding: 12px 20px;
    border-top: 1px solid #2d3748;
    font-size: 0.8125rem;
  }
  .issue-detail.overflow-issue { background: rgba(159,18,57,0.08); }
  .issue-detail.error-detail { background: rgba(159,18,57,0.08); }
  .issue-detail ul { margin-top: 6px; padding-left: 18px; }
  .issue-detail li { color: #94a3b8; margin: 2px 0; }
  .issue-detail code { background: #0f1623; padding: 1px 5px; border-radius: 3px; font-size: 0.75rem; }
  .issue-detail .ok { color: #4ade80; }
  .issue-detail .bad { color: #f87171; }
  .fix-item { background: #1a2030; border: 1px solid #2d3748; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .fix-item.overflow { border-left: 4px solid #f87171; }
  .fix-item.touch-target { border-left: 4px solid #fcd34d; }
  .fix-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .fix-num { background: #2d3748; color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .fix-page { font-weight: 600; color: #f1f5f9; }
  .fix-page code { color: #94a3b8; font-size: 0.8125rem; }
  .fix-desc { color: #cbd5e1; margin-bottom: 6px; }
  .fix-rec { color: #64748b; font-size: 0.8125rem; font-style: italic; }
  .fix-els { margin-top: 8px; padding-left: 16px; color: #94a3b8; font-size: 0.8125rem; }
  .fix-els code { background: #0f1623; padding: 1px 4px; border-radius: 3px; }
  .no-issues { color: #4ade80; padding: 20px; text-align: center; background: #052e16; border-radius: 8px; border: 1px solid #166534; }
</style>
</head>
<body>
<div class="container">
  <h1>SAPROA Mobile Audit</h1>
  <p class="subtitle">Generated: ${dateStr} | Viewports: 375×812, 390×844, 414×896 | Base URL: ${BASE_URL}</p>

  <div class="stats-bar">
    <div class="stat">
      <div class="stat-val">${totalPages}</div>
      <div class="stat-label">Pages tested</div>
    </div>
    <div class="stat">
      <div class="stat-val ${pagesWithIssues === 0 ? "green" : "red"}">${pagesWithIssues}</div>
      <div class="stat-label">Pages with issues</div>
    </div>
    <div class="stat">
      <div class="stat-val ${overflowCount === 0 ? "green" : "red"}">${overflowCount}</div>
      <div class="stat-label">Overflow issues</div>
    </div>
    <div class="stat">
      <div class="stat-val ${touchCount === 0 ? "green" : "amber"}">${touchCount}</div>
      <div class="stat-label">Touch target issues</div>
    </div>
    <div class="stat">
      <div class="stat-val ${fixes.length === 0 ? "green" : "amber"}">${fixes.length}</div>
      <div class="stat-label">Total issues found</div>
    </div>
  </div>

  <h2>Issues Found</h2>
  ${fixesHtml}

  <h2>Page Results</h2>
  ${pageCards}
</div>
</body>
</html>`;
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
