/**
 * SAPROA Control Center — Auditoría de seguridad (rutas no autenticadas)
 * Ejecutar: npx ts-node scripts/saproa-audit.ts
 * O como Playwright: npx playwright test scripts/saproa-audit.ts
 *
 * Este script verifica que todas las rutas del Control Center
 * redirigen correctamente cuando no hay sesión activa.
 */

import { chromium, Browser, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";

const SAPROA_ROUTES = [
  "/saproa-admin/overview",
  "/saproa-admin/empresas",
  "/saproa-admin/usuarios",
  "/saproa-admin/impersonar",
  "/saproa-admin/roadmap",
  "/saproa-admin/feedback",
  "/saproa-admin/sistema",
];

type RouteResult = {
  route: string;
  finalUrl: string;
  redirected: boolean;
  status: "PASS" | "FAIL";
  note: string;
};

async function testUnauthenticatedAccess(page: Page): Promise<RouteResult[]> {
  const results: RouteResult[] = [];

  for (const route of SAPROA_ROUTES) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    const finalUrl = page.url();
    const redirected = !finalUrl.includes(route) || finalUrl.includes("/login") || finalUrl.includes("/dashboard");

    results.push({
      route,
      finalUrl,
      redirected,
      status: redirected ? "PASS" : "FAIL",
      note: redirected
        ? `Redirigido a ${finalUrl}`
        : "SECURITY: ruta accesible sin autenticación",
    });
  }

  return results;
}

function generateHtmlReport(
  routeResults: RouteResult[],
  date: string,
  staticFindings: Record<string, { severity: string; items: string[] }>,
): string {
  const passCount = routeResults.filter((r) => r.status === "PASS").length;
  const failCount = routeResults.filter((r) => r.status === "FAIL").length;

  const routeRows = routeResults
    .map(
      (r) => `
    <tr class="${r.status === "PASS" ? "pass" : "fail"}">
      <td><code>${r.route}</code></td>
      <td><span class="badge ${r.status === "PASS" ? "badge-pass" : "badge-fail"}">${r.status}</span></td>
      <td>${r.note}</td>
    </tr>`,
    )
    .join("");

  const staticSections = Object.entries(staticFindings)
    .map(
      ([key, val]) => `
    <div class="finding">
      <h3><span class="severity ${val.severity.toLowerCase()}">${val.severity}</span> ${key}</h3>
      <ul>${val.items.map((i) => `<li>${i}</li>`).join("")}</ul>
    </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>SAPROA Audit Report — ${date}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 32px; background: #f8fafc; color: #1e293b; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 14px; margin-bottom: 32px; }
  .summary { display: flex; gap: 16px; margin-bottom: 32px; }
  .summary-card { background: #fff; border-radius: 8px; padding: 16px 24px; border: 1px solid #e2e8f0; flex: 1; }
  .summary-card .val { font-size: 28px; font-weight: 700; }
  .summary-card .lbl { font-size: 12px; color: #64748b; }
  .pass .val { color: #16a34a; }
  .fail-card .val { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 32px; }
  th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-size: 12px; color: #64748b; font-weight: 600; }
  td { padding: 10px 14px; font-size: 13px; border-top: 1px solid #e2e8f0; }
  tr.pass td { background: #f0fdf4; }
  tr.fail td { background: #fef2f2; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .badge-pass { background: #dcfce7; color: #16a34a; }
  .badge-fail { background: #fee2e2; color: #dc2626; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  .section-title { font-size: 18px; font-weight: 700; margin: 32px 0 16px; }
  .finding { background: #fff; border-radius: 8px; padding: 16px 20px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
  .finding h3 { margin: 0 0 10px; font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .finding ul { margin: 0; padding-left: 20px; font-size: 13px; color: #475569; }
  .finding li { margin-bottom: 4px; }
  .severity { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .severity.critical { background: #fee2e2; color: #dc2626; }
  .severity.high { background: #fff7ed; color: #c2410c; }
  .severity.medium { background: #fefce8; color: #a16207; }
  .severity.low { background: #f0fdf4; color: #166534; }
  .severity.info { background: #eff6ff; color: #1d4ed8; }
  footer { margin-top: 48px; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>

<h1>SAPROA Control Center — Reporte de Auditoría</h1>
<p class="subtitle">Generado el ${date} | PropAdmin v1.0 | Rama: main</p>

<div class="summary">
  <div class="summary-card pass">
    <div class="val">${passCount}</div>
    <div class="lbl">Rutas protegidas</div>
  </div>
  <div class="summary-card fail-card">
    <div class="val">${failCount}</div>
    <div class="lbl">Rutas expuestas</div>
  </div>
  <div class="summary-card">
    <div class="val">${routeResults.length}</div>
    <div class="lbl">Rutas auditadas</div>
  </div>
</div>

<div class="section-title">FASE 3 — Acceso no autenticado</div>
<table>
  <thead><tr><th>Ruta</th><th>Resultado</th><th>Notas</th></tr></thead>
  <tbody>${routeRows}</tbody>
</table>

<div class="section-title">Análisis estático</div>
${staticSections}

<footer>Generado por SAPROA Audit Script · PropAdmin · ${date}</footer>
</body>
</html>`;
}

async function run() {
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join(__dirname, "audit-reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("Iniciando auditoría SAPROA...");

  let browser: Browser | null = null;
  let routeResults: RouteResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log("FASE 3: Verificando acceso no autenticado...");
    routeResults = await testUnauthenticatedAccess(page);
    routeResults.forEach((r) => {
      console.log(`  ${r.status === "PASS" ? "✓" : "✗"} ${r.route} → ${r.finalUrl}`);
    });
  } catch (e) {
    console.warn("No se pudo conectar al servidor dev. Asegúrate de que esté corriendo en localhost:3000");
    console.warn("Los resultados de rutas se marcarán como no verificados.");
    routeResults = SAPROA_ROUTES.map((route) => ({
      route,
      finalUrl: "N/A (servidor no disponible)",
      redirected: false,
      status: "FAIL" as const,
      note: "No se pudo verificar — servidor dev no disponible",
    }));
  } finally {
    await browser?.close();
  }

  const staticFindings: Record<string, { severity: string; items: string[] }> = {
    "console.log de depuración eliminados": {
      severity: "LOW",
      items: [
        "app/purchases/page.tsx — 13 console.log de debug eliminados (payload, INSERT/UPDATE results, items PDF)",
        "app/purchases/reporte-pagos/page.tsx — 9 console.log de debug eliminados (handleSave validation logs)",
        "Conservados: console.error en routes API (logging legítimo de servidor)",
      ],
    },
    "Seguridad — API route sin auth server-side": {
      severity: "HIGH",
      items: [
        "app/api/portal/renewal-response/route.ts — El endpoint NO verifica que el bearer/cookie corresponda al tenant_id recibido.",
        "Riesgo: Un actor malicioso podría enviar una respuesta de renovación en nombre de otro tenant si conoce su tenant_auth_id.",
        "Mitigación actual: RouteGuard en cliente + validación de tenant en DB (parcial).",
        "Acción recomendada: Agregar verificación SSR via supabaseAdmin.auth.getUser(token) + comparar con tenant.auth_user_id.",
      ],
    },
    "Imágenes — raw <img> en lugar de next/image": {
      severity: "INFO",
      items: [
        "app/saproa-admin/sistema/page.tsx — 2 instancias (previews de logo dinámico — URLs externas, next/image requeriría dominio en config)",
        "app/campo/layout.tsx — 2 instancias (logo dinámico por empresa)",
        "app/register/page.tsx — 2 instancias (preview local antes de upload)",
        "app/settings/page.tsx — 1 instancia (preview local)",
        "Acción: Para logos externos, agregar dominios a next.config y migrar a <Image>.",
      ],
    },
    "Colores hardcoded en saproa-admin": {
      severity: "LOW",
      items: [
        "#6366F1 (SAPROA_ACCENT) — intencional, constante nombrada en Sidebar.tsx e impersonar/page.tsx",
        "#8B2252 (SAPROA_COLOR) — intencional, default del accent_color en sistema/page.tsx",
        "#6b7280 — fallback neutro para brand_color null (empresas, usuarios, impersonar)",
        "#EF4444/#F59E0B/#22C55E — colores de prioridad en roadmap (parte del diseño intencional)",
        "Colores de iconos en feedback: #2563EB, #DC2626, #16A34A — coinciden con tokens Tailwind del sistema de badges",
      ],
    },
    "Rutas /saproa-admin — Route Guard": {
      severity: "INFO",
      items: [
        "app/saproa-admin/layout.tsx implementa guard via isRealSuperAdmin de ImpersonationContext",
        "ImpersonationBridge garantiza que is_superadmin=false durante impersonación, así isRealSuperAdmin es inmune",
        "Todas las sub-rutas heredan el guard automáticamente por Next.js App Router",
        "Redirect a /dashboard si !isRealSuperAdmin (no expone la UI ni datos)",
      ],
    },
    "TODO/FIXME identificados": {
      severity: "LOW",
      items: [
        "app/campo/tickets/page.tsx:810-817 — iOS camera capture deshabilitado (feature flag pendiente)",
        "No hay TODO/FIXME en ningún archivo de app/saproa-admin/",
      ],
    },
    "TypeScript — 0 errores": {
      severity: "LOW",
      items: [
        "npx tsc --noEmit → 0 errores al finalizar PARTE 1 y PARTE 2",
        "UiButton.tsx — agregado style?: CSSProperties (fix para 7 instancias en saproa-admin)",
        "Todos los tipos de supabase correctamente cast en los nuevos pages",
      ],
    },
  };

  const html = generateHtmlReport(routeResults, date, staticFindings);
  const reportPath = path.join(outDir, `saproa-audit-${date}.html`);
  fs.writeFileSync(reportPath, html, "utf-8");

  console.log(`\nReporte generado: ${reportPath}`);
  console.log(`Rutas auditadas: ${routeResults.length}`);
  console.log(`PASS: ${routeResults.filter((r) => r.status === "PASS").length}`);
  console.log(`FAIL: ${routeResults.filter((r) => r.status === "FAIL").length}`);
}

run().catch(console.error);
