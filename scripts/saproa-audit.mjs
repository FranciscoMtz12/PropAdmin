/**
 * SAPROA Full Audit Script
 * - Screenshots: 6 theme combos × 11 pages
 * - Source scan: hardcoded colors + border-radius
 * - Auto-fixes: replace hardcoded border-radius with CSS var tokens
 * - HTML report with before/after
 *
 * Run: node scripts/saproa-audit.mjs
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/* ───── CONFIG ───── */
const BASE_URL = "https://www.saproa.com";
const CREDS = { email: "fco.mtz.c@hotmail.com", password: "Pruebas1" };
const AUDIT_DIR = path.join(process.env.USERPROFILE || process.env.HOME, "saproa-audit");
const SS_BEFORE = path.join(AUDIT_DIR, "screenshots", "before");
const SS_AFTER  = path.join(AUDIT_DIR, "screenshots", "after");
const REPORT_PATH = path.join(AUDIT_DIR, "report.html");
const PROJECT_DIR = process.cwd();

const THEME_COMBOS = [
  { theme: "clasico",    dark: false, label: "clasico-light"     },
  { theme: "clasico",    dark: true,  label: "clasico-dark"      },
  { theme: "super_soft", dark: false, label: "super_soft-light"  },
  { theme: "super_soft", dark: true,  label: "super_soft-dark"   },
  { theme: "rigido",     dark: false, label: "rigido-light"      },
  { theme: "rigido",     dark: true,  label: "rigido-dark"       },
];

const PAGES = [
  { name: "01-login",       path: "/login",       noAuth: true  },
  { name: "02-dashboard",   path: "/dashboard",   noAuth: false },
  { name: "03-buildings",   path: "/buildings",   noAuth: false },
  { name: "04-tenants",     path: "/tenants",     noAuth: false },
  { name: "05-collections", path: "/collections", noAuth: false },
  { name: "06-payments",    path: "/payments",    noAuth: false },
  { name: "07-purchases",   path: "/purchases",   noAuth: false },
  { name: "08-maintenance", path: "/maintenance", noAuth: false },
  { name: "09-servicios",   path: "/servicios",   noAuth: false },
  { name: "10-settings",    path: "/settings",    noAuth: false },
  { name: "11-analytics",   path: "/analytics",   noAuth: false },
];

/* Mapping hardcoded pixel values → CSS variable (clasico defaults) */
const RADIUS_MAP = {
  "6px":  "var(--border-radius-sm)",
  "8px":  "var(--border-radius-md)",
  "12px": "var(--border-radius-lg)",
  "16px": "var(--border-radius-xl)",
};

/* ───── HELPERS ───── */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function login(page) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(CREDS.email);
  await page.locator('input[type="password"]').fill(CREDS.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/login"),
    { timeout: 25000 }
  );
  console.log("  ✓ Logged in");
}

async function screenshotPage(page, url, filename, outDir) {
  try {
    await page.goto(BASE_URL + url, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(800); // let ThemeContext + animations settle
    await page.screenshot({ path: path.join(outDir, filename + ".png"), fullPage: false });
    return true;
  } catch (e) {
    console.warn(`  ⚠ Could not screenshot ${url}: ${e.message}`);
    return false;
  }
}

async function makeContext(browser, theme, dark) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Pre-set localStorage before any navigation so ThemeContext picks it up on first load
  await ctx.addInitScript(({ theme, dark }) => {
    localStorage.setItem("ui_theme", theme);
    localStorage.setItem("prop-theme", dark ? "dark" : "light");
  }, { theme, dark });
  return ctx;
}

/* ───── PHASE 1: SCREENSHOTS (BEFORE) ───── */
async function captureScreenshots(outDir) {
  console.log("\n═══ PHASE 1: Capturing screenshots ═══");
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const combo of THEME_COMBOS) {
    console.log(`\n  Theme: ${combo.label}`);

    // Authenticated pages
    const ctx = await makeContext(browser, combo.theme, combo.dark);
    const page = await ctx.newPage();
    await login(page);

    for (const pg of PAGES) {
      if (pg.noAuth) continue;
      const fname = `${combo.label}--${pg.name}`;
      console.log(`    → ${pg.path}`);
      const ok = await screenshotPage(page, pg.path, fname, outDir);
      results[fname] = { combo: combo.label, page: pg.name, ok };
    }

    await ctx.close();

    // Login page (no auth — fresh context so no session cookie)
    const loginPg = PAGES.find(p => p.noAuth);
    if (loginPg) {
      const ctxGuest = await makeContext(browser, combo.theme, combo.dark);
      const guestPage = await ctxGuest.newPage();
      const fname = `${combo.label}--${loginPg.name}`;
      console.log(`    → ${loginPg.path} (public)`);
      await screenshotPage(guestPage, loginPg.path, fname, outDir);
      results[fname] = { combo: combo.label, page: loginPg.name, ok: true };
      await ctxGuest.close();
    }
  }

  await browser.close();
  return results;
}

/* ───── PHASE 2: SOURCE CODE SCAN ───── */
function scanSourceCode() {
  console.log("\n═══ PHASE 2: Source code scan ═══");
  const issues = [];

  function walkDir(dir, exts) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (["node_modules", ".next", ".git", "playwright-report", "scripts"].includes(e.name)) continue;
        walkDir(full, exts);
      } else if (exts.some(x => e.name.endsWith(x))) {
        scanFile(full, issues);
      }
    }
  }

  function scanFile(filePath, issues) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const rel = path.relative(PROJECT_DIR, filePath).replace(/\\/g, "/");

    lines.forEach((line, i) => {
      const ln = i + 1;

      // Hardcoded hex colors in inline styles
      const hexMatches = [...line.matchAll(/style=\{[^}]*?["'`](#[0-9a-fA-F]{3,8})["'`]/g)];
      for (const m of hexMatches) {
        issues.push({
          type: "hardcoded-color",
          file: rel, line: ln,
          value: m[1],
          snippet: line.trim().slice(0, 120),
          severity: "warn",
        });
      }

      // Hardcoded borderRadius in style objects
      const brMatches = [...line.matchAll(/borderRadius:\s*["'`](\d+px(?:\s+\d+px)*)["'`]/g)];
      for (const m of brMatches) {
        const val = m[1];
        const suggestion = RADIUS_MAP[val] ? `var(--border-radius-${Object.entries(RADIUS_MAP).find(([k]) => k === val)?.[0].replace("px","").replace("6","sm").replace("8","md").replace("12","lg").replace("16","xl")})` : null;
        issues.push({
          type: "hardcoded-radius",
          file: rel, line: ln,
          value: val,
          suggestion: RADIUS_MAP[val] ?? null,
          snippet: line.trim().slice(0, 120),
          severity: RADIUS_MAP[val] ? "warn" : "info",
          autoFixable: !!RADIUS_MAP[val],
        });
      }

      // Hardcoded border-radius in CSS files
      if (filePath.endsWith(".css")) {
        const cssMatches = [...line.matchAll(/border-radius:\s*(\d+px(?:\s+\d+px)*)/g)];
        for (const m of cssMatches) {
          // Skip if it's already defining a variable value (inside :root or [data-theme])
          if (!line.includes("var(")) {
            issues.push({
              type: "css-hardcoded-radius",
              file: rel, line: ln,
              value: m[1],
              snippet: line.trim().slice(0, 120),
              severity: "info",
              autoFixable: false,
            });
          }
        }
      }
    });
  }

  walkDir(path.join(PROJECT_DIR, "app"), [".tsx", ".ts", ".css"]);
  walkDir(path.join(PROJECT_DIR, "components"), [".tsx", ".ts"]);
  walkDir(path.join(PROJECT_DIR, "contexts"), [".tsx", ".ts"]);

  // Summary
  const byType = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }
  console.log("  Scan complete:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`    ${type}: ${count}`);
  }
  return issues;
}

/* ───── PHASE 3: AUTO-FIXES ───── */
function applyAutoFixes(issues) {
  console.log("\n═══ PHASE 3: Applying auto-fixes ═══");
  const fixable = issues.filter(i => i.autoFixable && i.type === "hardcoded-radius");
  const fixedFiles = new Set();
  const fixLog = [];

  // Group by file
  const byFile = {};
  for (const issue of fixable) {
    if (!byFile[issue.file]) byFile[issue.file] = [];
    byFile[issue.file].push(issue);
  }

  for (const [rel, fileIssues] of Object.entries(byFile)) {
    const full = path.join(PROJECT_DIR, rel.replace(/\//g, path.sep));
    let content = fs.readFileSync(full, "utf-8");
    let changed = false;

    for (const val of Object.keys(RADIUS_MAP)) {
      const cssVar = RADIUS_MAP[val];
      // Replace quoted pixel values inside style objects only
      const before = content;
      content = content.replace(
        new RegExp(`(borderRadius:\\s*["'\`])${val.replace("px", "\\px")}(["'\`])`, "g"),
        (_, prefix, suffix) => `${prefix}${cssVar}${suffix}`
      );
      if (content !== before) {
        changed = true;
        const count = (before.match(new RegExp(`borderRadius:\\s*["'\`]${val.replace("px","\\px")}["'\`]`, "g")) || []).length;
        fixLog.push({ file: rel, replaced: `${val} → ${cssVar}`, count });
      }
    }

    if (changed) {
      fs.writeFileSync(full, content, "utf-8");
      fixedFiles.add(rel);
      console.log(`  ✓ Fixed: ${rel}`);
    }
  }

  console.log(`  Total files modified: ${fixedFiles.size}`);
  return { fixedFiles: [...fixedFiles], fixLog };
}

/* ───── PHASE 4: SCREENSHOTS (AFTER) ───── */
async function captureAfterScreenshots(fixedFiles, outDir) {
  if (fixedFiles.length === 0) {
    console.log("\n═══ PHASE 4: No files changed — skipping after screenshots ═══");
    return;
  }
  console.log("\n═══ PHASE 4: Capturing after screenshots ═══");
  const combos = THEME_COMBOS.filter(c => ["clasico-light", "rigido-light"].includes(c.label));
  const browser = await chromium.launch({ headless: true });

  for (const combo of combos) {
    console.log(`\n  Theme: ${combo.label}`);
    const ctx = await makeContext(browser, combo.theme, combo.dark);
    const page = await ctx.newPage();
    await login(page);

    for (const pg of PAGES.filter(p => !p.noAuth)) {
      const fname = `${combo.label}--${pg.name}`;
      console.log(`    → ${pg.path}`);
      await screenshotPage(page, pg.path, fname, outDir);
    }
    await ctx.close();
  }
  await browser.close();
}

/* ───── PHASE 5: HTML REPORT ───── */
function generateReport(ssResults, issues, fixResult) {
  console.log("\n═══ PHASE 5: Generating HTML report ═══");

  const now = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  const colorIssues = issues.filter(i => i.type === "hardcoded-color");
  const radiusIssues = issues.filter(i => i.type === "hardcoded-radius");
  const cssRadiusIssues = issues.filter(i => i.type === "css-hardcoded-radius");

  function issueTable(rows, extra = "") {
    if (!rows.length) return `<p class="empty">Ningún hallazgo${extra}.</p>`;
    return `<table>
      <thead><tr><th>Archivo</th><th>Línea</th><th>Valor</th><th>Sugerencia</th><th>Fragmento</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr class="sev-${r.severity}">
          <td><code>${r.file}</code></td>
          <td>${r.line}</td>
          <td><code>${r.value}</code></td>
          <td>${r.suggestion ? `<code>${r.suggestion}</code>` : r.autoFixable === false ? "—" : "<span class='fixed'>✓ Fixed</span>"}</td>
          <td><small>${r.snippet.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</small></td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  }

  function ssGrid(dir, combos, pages) {
    return THEME_COMBOS.map(combo => {
      const pics = pages.filter(p => !p.noAuth).map(pg => {
        const fname = `${combo.label}--${pg.name}.png`;
        const fpath = path.join(dir, fname);
        const exists = fs.existsSync(fpath);
        if (!exists) return `<div class="ss-cell missing"><span>${pg.name}</span><em>no disponible</em></div>`;
        const dataUri = `data:image/png;base64,${fs.readFileSync(fpath).toString("base64")}`;
        return `<div class="ss-cell"><span>${pg.name.replace(/^\d+-/,"")}</span><img src="${dataUri}" alt="${pg.name}"/></div>`;
      }).join("");
      return `<details class="combo-block" open>
        <summary>${combo.label}</summary>
        <div class="ss-grid">${pics}</div>
      </details>`;
    }).join("\n");
  }

  const beforeGrid = ssGrid(SS_BEFORE, THEME_COMBOS, PAGES);

  const afterSection = fixResult.fixedFiles.length > 0
    ? `<h2>📸 Screenshots — Después de correcciones (clasico-light, rigido-light)</h2>
       ${ssGrid(SS_AFTER, THEME_COMBOS.filter(c => ["clasico-light","rigido-light"].includes(c.label)), PAGES)}`
    : `<h2>📸 Screenshots — Después</h2><p class="empty">Sin cambios de código — no se generaron screenshots posteriores.</p>`;

  const fixLogSection = fixResult.fixLog.length > 0
    ? `<table><thead><tr><th>Archivo</th><th>Reemplazo</th><th>Ocurrencias</th></tr></thead><tbody>
       ${fixResult.fixLog.map(f => `<tr><td><code>${f.file}</code></td><td><code>${f.replaced}</code></td><td>${f.count}</td></tr>`).join("")}
       </tbody></table>`
    : `<p class="empty">No se aplicaron correcciones automáticas.</p>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SAPROA Audit Report — ${now}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui,sans-serif; background:#0f1120; color:#d0d8f0; padding: 24px; }
  h1 { font-size: 1.8rem; margin-bottom: 4px; }
  h2 { font-size: 1.3rem; margin: 32px 0 12px; border-bottom: 1px solid #2a3050; padding-bottom: 6px; }
  h3 { font-size: 1rem; margin: 20px 0 8px; color: #8ba3d0; }
  .meta { color: #607090; font-size: .85rem; margin-bottom: 24px; }
  .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat { background: #1a2035; border: 1px solid #2a3050; border-radius: 10px; padding: 14px 20px; min-width: 120px; }
  .stat .val { font-size: 1.6rem; font-weight: 700; }
  .stat .lbl { font-size: .78rem; color: #607090; }
  .stat.ok .val { color: #4ade80; }
  .stat.warn .val { color: #fbbf24; }
  .stat.err .val { color: #f87171; }
  table { width: 100%; border-collapse: collapse; font-size: .82rem; margin-bottom: 16px; }
  th { background: #1a2035; color: #8ba3d0; text-align: left; padding: 7px 10px; }
  td { padding: 6px 10px; border-bottom: 1px solid #1a2035; vertical-align: top; }
  tr.sev-warn td { background: #1f1a0a; }
  tr.sev-info td { background: #0a1020; }
  code { background: #1a2035; padding: 1px 5px; border-radius: 4px; font-size: .85em; }
  .fixed { color: #4ade80; }
  .empty { color: #607090; font-style: italic; padding: 8px 0; }
  details.combo-block { margin-bottom: 16px; border: 1px solid #2a3050; border-radius: 10px; overflow: hidden; }
  details.combo-block > summary { padding: 10px 16px; background: #1a2035; cursor: pointer; font-weight: 600; user-select: none; }
  details.combo-block > summary:hover { background: #243050; }
  .ss-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 16px; }
  .ss-cell { background: #1a2035; border-radius: 8px; overflow: hidden; }
  .ss-cell span { display: block; padding: 6px 10px; font-size: .78rem; color: #8ba3d0; background: #141c30; }
  .ss-cell img { width: 100%; display: block; }
  .ss-cell.missing { padding: 16px; color: #607090; font-style: italic; }
</style>
</head>
<body>
<h1>🔍 SAPROA — Auditoría Completa</h1>
<p class="meta">Generado: ${now} · URL: ${BASE_URL} · Usuario: ${CREDS.email}</p>

<div class="stats">
  <div class="stat ${colorIssues.length === 0 ? "ok" : "warn"}">
    <div class="val">${colorIssues.length}</div>
    <div class="lbl">Colores hardcodeados</div>
  </div>
  <div class="stat ${radiusIssues.filter(i => !i.autoFixable).length === 0 ? "ok" : "warn"}">
    <div class="val">${radiusIssues.length}</div>
    <div class="lbl">Border-radius inline</div>
  </div>
  <div class="stat ${fixResult.fixedFiles.length > 0 ? "ok" : ""}">
    <div class="val">${fixResult.fixedFiles.length}</div>
    <div class="lbl">Archivos auto-corregidos</div>
  </div>
  <div class="stat ${fixResult.fixLog.length > 0 ? "ok" : ""}">
    <div class="val">${fixResult.fixLog.reduce((s, f) => s + f.count, 0)}</div>
    <div class="lbl">Reemplazos aplicados</div>
  </div>
</div>

<h2>📸 Screenshots — Antes (6 temas × 10 páginas)</h2>
${beforeGrid}

${afterSection}

<h2>🎨 Hallazgos — Colores hardcodeados en inline styles</h2>
${issueTable(colorIssues, " de colores hardcodeados")}

<h2>⬛ Hallazgos — border-radius hardcodeados (inline styles)</h2>
${issueTable(radiusIssues, " de border-radius inline")}

<h2>📄 Hallazgos — border-radius en CSS</h2>
${issueTable(cssRadiusIssues, " de border-radius en CSS")}

<h2>✅ Correcciones automáticas aplicadas</h2>
${fixLogSection}

<h2>📁 Archivos modificados</h2>
${fixResult.fixedFiles.length > 0
  ? `<ul>${fixResult.fixedFiles.map(f => `<li><code>${f}</code></li>`).join("")}</ul>`
  : `<p class="empty">Ningún archivo modificado.</p>`}

</body>
</html>`;

  fs.writeFileSync(REPORT_PATH, html, "utf-8");
  console.log(`  ✓ Report saved: ${REPORT_PATH}`);
}

/* ───── MAIN ───── */
async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║    SAPROA Full Audit — Starting      ║");
  console.log("╚══════════════════════════════════════╝");

  ensureDir(SS_BEFORE);
  ensureDir(SS_AFTER);

  const ssResults  = await captureScreenshots(SS_BEFORE);
  const issues     = scanSourceCode();
  const fixResult  = applyAutoFixes(issues);
  await captureAfterScreenshots(fixResult.fixedFiles, SS_AFTER);
  generateReport(ssResults, issues, fixResult);

  console.log("\n✓ Audit complete.");
  console.log(`  Report: ${REPORT_PATH}`);
}

main().catch(e => { console.error("Audit failed:", e); process.exit(1); });
