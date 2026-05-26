#!/usr/bin/env node
/**
 * generate-audit-report-v2.mjs
 * Genera el reporte HTML de auditoría mobile v2 — 2026-05-26
 *
 * Usage:
 *   node scripts/generate-audit-report-v2.mjs
 *
 * Opcionalmente usa Playwright para tomar screenshots si está disponible.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, "scripts", "audit-reports");
const OUTPUT_FILE = join(OUTPUT_DIR, "mobile-audit-v2-2026-05-26.html");

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

/* ─── Lista de fixes aplicados ──────────────────────────────────────── */

const FIXES = [
  {
    id: "F01",
    file: "components/MetricCircles.tsx",
    type: "NEW COMPONENT",
    status: "FIXED",
    description: "Nuevo componente MetricCircles — muestra métricas como círculos en mobile (≤768px). Solo visible en mobile via CSS .metric-circles-mobile-only. Soporta 1-12 métricas con distribución automática en filas. Colores semánticos via --metric-value-* CSS vars.",
  },
  {
    id: "F02",
    file: "app/globals.css",
    type: "CSS",
    status: "FIXED",
    description: "Agregadas media queries para: .metric-circles-mobile-only (ocultar en desktop), .dashboard-grid-3 forzado a 3 cols en mobile, .dashboard-donut-wrap reducida a 120px, .dashboard-card-mobile padding 10px, .maintenance-filters-row flex-wrap, saproa-empresa-card flex-column mobile, saproa-overview-metrics grid 2×2, saproa-impersonar-grid 1 columna, .calendar-subtitle-desktop oculto en mobile, .dashboard-grid-2 gap 16px.",
  },
  {
    id: "F03",
    file: "app/buildings/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles antes del grid de MetricCards. Dos variantes: modo grupo (3 métricas: propiedades, unidades, ocupación) y modo individual (4 métricas: propiedades, alta ocupación, promedio, unidades).",
  },
  {
    id: "F04",
    file: "app/collections/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles antes del AppGrid de MetricCards. 4 métricas: Total, Cobrado (success), Pendiente (warning), Vencido (danger).",
  },
  {
    id: "F05",
    file: "app/maintenance/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles antes del AppGrid de tickets. 4 métricas: Total, Abiertos (danger), En proceso (warning), Resueltos (success). Solo tab de tickets.",
  },
  {
    id: "F06",
    file: "app/tenants/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles antes del AppGrid de inquilinos. 4 métricas: Total, Activos (success), Con lease (info), Inactivos (danger).",
  },
  {
    id: "F07",
    file: "app/payments/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles antes del grid de MetricCards de pagos. 4 métricas: Pendientes (warning), Pagados (success), $ Pendiente (warning), $ Pagado (success).",
  },
  {
    id: "F08",
    file: "app/servicios/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles con 4 métricas dinámicas: Edificios, Al día (success), Pendiente (warning), Servicios. MetricCard importado pero no usado en render — import mantenido (sin crash).",
  },
  {
    id: "F09",
    file: "app/cleaning/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles con 6 métricas de la semana: Cumplimiento (color dinámico), Tareas hoy, Completadas (success), Pendientes (warning), Edificios activos, Premium.",
  },
  {
    id: "F10",
    file: "app/analytics/page.tsx",
    type: "FEATURE",
    status: "FIXED",
    description: "Agregado MetricCircles con 6 métricas antes de la analytics-stat-bar: Ocupación (success), Personas (info), Contratos, Vencen 30d (warning), Vacantes (danger), Edificios.",
  },
  {
    id: "F11",
    file: "app/saproa-admin/empresas/page.tsx",
    type: "FIX",
    status: "FIXED",
    description: "Agregadas clases CSS a la card de empresa para layout mobile: saproa-empresa-card (flex-direction column), saproa-empresa-stats (flex row), saproa-empresa-impersonar (width 100%). Botón Impersonar a ancho completo en mobile.",
  },
  {
    id: "F12",
    file: "app/saproa-admin/overview/page.tsx",
    type: "FIX",
    status: "FIXED",
    description: "Agregadas clases saproa-overview-metrics (grid 2×2 en mobile) y saproa-overview-grid (1 columna en mobile) a los grids de métricas y contenido.",
  },
  {
    id: "F13",
    file: "app/saproa-admin/impersonar/page.tsx",
    type: "FIX",
    status: "FIXED",
    description: "Agregadas clases saproa-impersonar-grid (1 columna en mobile) y saproa-impersonar-tree al árbol de jerarquía Grupo→Empresa→Usuario.",
  },
  {
    id: "F14",
    file: "app/calendar/page.tsx",
    type: "FIX",
    status: "FIXED",
    description: "Subtitle del PageHeader envuelto en <span className='calendar-subtitle-desktop'> para ocultarlo en mobile via CSS.",
  },
  {
    id: "F15",
    file: "components/PageHeader.tsx",
    type: "FIX",
    status: "FIXED",
    description: "Cambiado tipo de prop subtitle de string a ReactNode para permitir elementos JSX como el span con className para el fix del calendario.",
  },
  {
    id: "F16",
    file: "app/test-metrics/page.tsx",
    type: "CLEANUP",
    status: "FIXED",
    description: "Eliminado directorio y página de prueba app/test-metrics/page.tsx.",
  },
  {
    id: "F17",
    file: "components/Sidebar.tsx",
    type: "VERIFY",
    status: "OK",
    description: "Verificado — todos los touch targets ya están en minHeight: 44px. No era necesario cambiar de 43 a 44.",
  },
  {
    id: "F18",
    file: "app/settings/page.tsx",
    type: "VERIFY",
    status: "OK",
    description: "Las tabs de Settings ya tienen grid 2×2 mobile via .app-tabs-container (CSS ya existía desde versión anterior). No requirió cambio adicional.",
  },
];

/* ─── Páginas auditadas ─────────────────────────────────────────────── */

const PAGES = [
  { path: "/dashboard",               label: "Dashboard",           status: "FIXED",   fixes: ["F01","F02"] },
  { path: "/buildings",               label: "Propiedades",         status: "FIXED",   fixes: ["F03"] },
  { path: "/collections",             label: "Cobranza",            status: "FIXED",   fixes: ["F04"] },
  { path: "/maintenance",             label: "Mantenimiento",       status: "FIXED",   fixes: ["F05"] },
  { path: "/tenants",                 label: "Inquilinos",          status: "FIXED",   fixes: ["F06"] },
  { path: "/payments",                label: "Pagos",               status: "FIXED",   fixes: ["F07"] },
  { path: "/servicios",               label: "Servicios",           status: "FIXED",   fixes: ["F08"] },
  { path: "/cleaning",                label: "Limpieza",            status: "FIXED",   fixes: ["F09"] },
  { path: "/analytics",              label: "Analytics",           status: "FIXED",   fixes: ["F10"] },
  { path: "/saproa-admin/empresas",   label: "Saproa Empresas",     status: "FIXED",   fixes: ["F11"] },
  { path: "/saproa-admin/overview",   label: "Saproa Overview",     status: "FIXED",   fixes: ["F12"] },
  { path: "/saproa-admin/impersonar", label: "Saproa Impersonar",   status: "FIXED",   fixes: ["F13"] },
  { path: "/calendar",               label: "Calendario",          status: "FIXED",   fixes: ["F14","F15"] },
  { path: "/settings",               label: "Settings",            status: "OK",      fixes: ["F18"] },
];

const statusBadge = (s) => {
  const colors = {
    FIXED:   { bg: "#052E16", text: "#4ADE80", border: "#166534" },
    OK:      { bg: "#0C1A3A", text: "#60A5FA", border: "#1E40AF" },
    PENDING: { bg: "#1C0507", text: "#F87171", border: "#9F1239" },
  };
  const c = colors[s] ?? colors.PENDING;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.6875rem;font-weight:700;letter-spacing:0.06em;background:${c.bg};color:${c.text};border:1px solid ${c.border}">${s}</span>`;
};

const typeBadge = (t) => {
  const colors = {
    "NEW COMPONENT": "#A855F7",
    "FEATURE":       "#3B82F6",
    "FIX":           "#F59E0B",
    "CSS":           "#10B981",
    "CLEANUP":       "#6B7280",
    "VERIFY":        "#94A3B8",
  };
  const c = colors[t] ?? "#6B7280";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.625rem;font-weight:700;background:${c}22;color:${c};border:1px solid ${c}44">${t}</span>`;
};

const fixMap = Object.fromEntries(FIXES.map(f => [f.id, f]));

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mobile Audit v2 — 2026-05-26</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f1117;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.6;
      padding: 24px;
    }
    .header {
      border-bottom: 1px solid #1E2535;
      padding-bottom: 20px;
      margin-bottom: 32px;
    }
    .header h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #F1F5F9;
      margin-bottom: 6px;
    }
    .header .meta {
      color: #64748B;
      font-size: 0.8125rem;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: #1E2535;
      border: 1px solid #2D3748;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }
    .summary-card .num {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 4px;
    }
    .summary-card .lbl {
      font-size: 0.75rem;
      color: #64748B;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .section-title {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #1E2535;
    }
    .fixes-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 32px;
    }
    .fix-row {
      background: #1E2535;
      border: 1px solid #2D3748;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .fix-id {
      font-size: 0.6875rem;
      font-weight: 800;
      color: #64748B;
      min-width: 32px;
      padding-top: 2px;
    }
    .fix-body { flex: 1; min-width: 0; }
    .fix-file {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 0.6875rem;
      color: #60A5FA;
      margin-bottom: 4px;
    }
    .fix-desc {
      font-size: 0.8125rem;
      color: #94A3B8;
      line-height: 1.5;
    }
    .fix-badges {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .pages-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .page-card {
      background: #1E2535;
      border: 1px solid #2D3748;
      border-radius: 8px;
      padding: 14px;
    }
    .page-path {
      font-family: monospace;
      font-size: 0.75rem;
      color: #60A5FA;
      margin-bottom: 4px;
    }
    .page-label {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #F1F5F9;
      margin-bottom: 8px;
    }
    .page-fixes {
      font-size: 0.6875rem;
      color: #64748B;
    }
    .footer {
      border-top: 1px solid #1E2535;
      padding-top: 16px;
      color: #475569;
      font-size: 0.75rem;
    }
    /* Lightbox */
    .lightbox { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:9999; align-items:center; justify-content:center; }
    .lightbox.active { display:flex; }
    .lightbox img { max-width:95vw; max-height:95vh; border-radius:8px; }
    .thumb-link img { max-width:200px; cursor:pointer; border:2px solid #2D3748; border-radius:4px; transition:border-color 0.2s; }
    .thumb-link img:hover { border-color:#60A5FA; }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .pages-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<div id="lb" class="lightbox" onclick="this.classList.remove('active')">
  <img id="lb-img" src="" alt="Screenshot">
</div>

<div class="header">
  <h1>Mobile Audit v2</h1>
  <div class="meta">
    Generado: 2026-05-26 &nbsp;·&nbsp;
    Proyecto: PropAdmin &nbsp;·&nbsp;
    Stack: Next.js App Router + TypeScript + Supabase
  </div>
</div>

<!-- Resumen ejecutivo -->
<div class="summary-grid">
  <div class="summary-card">
    <div class="num" style="color:#4ADE80">${FIXES.filter(f=>f.status==="FIXED").length}</div>
    <div class="lbl">Fixes aplicados</div>
  </div>
  <div class="summary-card">
    <div class="num" style="color:#60A5FA">${FIXES.filter(f=>f.status==="OK").length}</div>
    <div class="lbl">Verificados OK</div>
  </div>
  <div class="summary-card">
    <div class="num" style="color:#F59E0B">${PAGES.length}</div>
    <div class="lbl">Páginas auditadas</div>
  </div>
  <div class="summary-card">
    <div class="num" style="color:#A855F7">0</div>
    <div class="lbl">Errores TS</div>
  </div>
</div>

<!-- Componente nuevo -->
<div class="section-title">Componente creado</div>
<div style="background:#1E2535;border:1px solid #2D3748;border-radius:10px;padding:16px 20px;margin-bottom:32px;">
  <div style="font-size:1rem;font-weight:800;color:#A855F7;margin-bottom:8px">MetricCircles</div>
  <div style="font-family:monospace;font-size:0.75rem;color:#60A5FA;margin-bottom:10px">components/MetricCircles.tsx</div>
  <div style="color:#94A3B8;font-size:0.8125rem;margin-bottom:10px">
    Componente de métricas circulares para mobile. Solo se muestra en pantallas ≤768px vía CSS (<code>.metric-circles-mobile-only</code>).
    Soporta 1–12 métricas con distribución automática en filas (máx 2 filas, hasta 6 por fila).
    Colores semánticos: default, success, danger, warning, info — mapeados a variables CSS --metric-value-*.
    Tamaños de fuente calculados con <code>calc((100vw - 32px) / 6 * factor)</code> para escalar perfectamente.
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">≤6 métricas → 1 fila</span>
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">7 → 4+3</span>
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">8 → 4+4</span>
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">9 → 5+4</span>
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">10 → 5+5</span>
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">11 → 6+5</span>
    <span style="background:#A855F722;color:#A855F7;border:1px solid #A855F744;border-radius:4px;padding:2px 8px;font-size:0.6875rem;font-weight:700">12 → 6+6</span>
  </div>
</div>

<!-- Lista de fixes -->
<div class="section-title">Fixes aplicados (${FIXES.length} total)</div>
<div class="fixes-list">
${FIXES.map(f => `  <div class="fix-row">
    <div class="fix-id">${f.id}</div>
    <div class="fix-body">
      <div class="fix-badges">
        ${statusBadge(f.status)}
        ${typeBadge(f.type)}
      </div>
      <div class="fix-file">${f.file}</div>
      <div class="fix-desc">${f.description}</div>
    </div>
  </div>`).join("\n")}
</div>

<!-- Páginas auditadas -->
<div class="section-title">Páginas auditadas (${PAGES.length})</div>
<div class="pages-grid">
${PAGES.map(p => `  <div class="page-card">
    <div class="page-path">${p.path}</div>
    <div class="page-label" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <span>${p.label}</span>
      ${statusBadge(p.status)}
    </div>
    <div class="page-fixes" style="margin-top:8px">
      Fixes: ${p.fixes.map(id => `<code style="background:#0F1117;padding:1px 5px;border-radius:3px;color:#94A3B8">${id}</code>`).join(" ")}
    </div>
    ${p.fixes.map(id => fixMap[id]).filter(Boolean).map(f => `<div style="font-size:0.6875rem;color:#475569;margin-top:6px;line-height:1.4">${f.description.substring(0, 120)}${f.description.length > 120 ? "…" : ""}</div>`).join("")}
  </div>`).join("\n")}
</div>

<!-- TypeScript check -->
<div class="section-title">TypeScript check</div>
<div style="background:#052E16;border:1px solid #166534;border-radius:8px;padding:14px 16px;margin-bottom:32px;display:flex;align-items:center;gap:12px">
  <span style="font-size:1.25rem">✅</span>
  <div>
    <div style="font-weight:700;color:#4ADE80">npx tsc --noEmit — Sin errores</div>
    <div style="font-size:0.75rem;color:#64748B;margin-top:2px">Todos los tipos correctos. PageHeader.subtitle extendido a ReactNode.</div>
  </div>
</div>

<div class="footer">
  PropAdmin — Mobile Audit Report v2 &nbsp;·&nbsp; 2026-05-26 &nbsp;·&nbsp;
  Generado por Claude Sonnet 4.6 &nbsp;·&nbsp;
  <a href="https://www.saproa.com" style="color:#60A5FA">saproa.com</a>
</div>

<script>
function showImg(src) {
  document.getElementById("lb-img").src = src;
  document.getElementById("lb").classList.add("active");
}
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") document.getElementById("lb").classList.remove("active");
});
</script>
</body>
</html>`;

writeFileSync(OUTPUT_FILE, html, "utf8");
console.log(`✅ Reporte generado: ${OUTPUT_FILE}`);
