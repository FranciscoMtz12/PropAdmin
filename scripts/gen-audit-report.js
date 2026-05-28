const fs = require("fs");
const path = require("path");

const date = "2026-05-25";
const outDir = path.join(__dirname, "audit-reports");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const staticFindings = {
  "TypeScript — 0 errores al finalizar": {
    severity: "LOW",
    items: [
      "npx tsc --noEmit completó con 0 errores tras PARTE 1 y limpieza de console.log",
      "UiButton.tsx — agregado style?: CSSProperties (fix para 7 instancias en saproa-admin)",
      "Todos los tipos correctamente cast en pages de saproa-admin",
    ],
  },
  "SAPROA Control Center — Route Guard (app/saproa-admin/layout.tsx)": {
    severity: "INFO",
    items: [
      "Guard implementado via isRealSuperAdmin del ImpersonationContext (no user.is_superadmin que ImpersonationBridge sobreescribe)",
      "Redirige a /dashboard si el usuario no es superadmin real",
      "Todas las sub-rutas del Control Center heredan el guard automáticamente (App Router)",
      "isSaproaMode = isRealSuperAdmin && !isImpersonating — condición correcta para mostrar menú SAPROA",
    ],
  },
  "console.log de depuración eliminados (FASE 3)": {
    severity: "LOW",
    items: [
      "app/purchases/page.tsx — 13 console.log de debug eliminados: payload snapshots, INSERT/UPDATE results, items PDF logs, fieldUsers raw, invoice meta",
      "app/purchases/reporte-pagos/page.tsx — 9 console.log de debug eliminados: handleSave validation block completo",
      "Conservados: console.error en app/api/** (logging legítimo de servidor — no expone datos sensibles en cliente)",
      "Total eliminado: 22 console.log de producción",
    ],
  },
  "Seguridad ALTA — API route sin verificación server-side": {
    severity: "HIGH",
    items: [
      "app/api/portal/renewal-response/route.ts — El endpoint valida que el tenant existe en DB pero NO verifica que el token del request corresponda al tenant_auth_user_id.",
      "Riesgo: Actor con acceso a la API podría enviar respuesta de renovación suplantando a otro tenant si conoce su tenant_id.",
      "Mitigación actual: RouteGuard en cliente + validación de tenant en DB (parcial — no suficiente para endpoint público).",
      "Acción recomendada: Agregar const { data: { user } } = await supabaseAdmin.auth.getUser(bearerToken) y comparar con tenant.auth_user_id antes de insertar.",
      "Nota: Esta vulnerabilidad preexistía antes de la implementación del Control Center — no introducida en este PR.",
    ],
  },
  "Imágenes — <img> raw en lugar de next/image": {
    severity: "MEDIUM",
    items: [
      "app/saproa-admin/sistema/page.tsx:156,170 — previews de logo con URLs externas (Supabase Storage). next/image requeriría agregar dominio en next.config.",
      "app/campo/layout.tsx:125,197 — logo dinámico por empresa (URL de Supabase Storage).",
      "app/register/page.tsx:535,578 — preview de logo local antes de upload (ObjectURL, no hay dominio que agregar).",
      "app/settings/page.tsx:782 — preview local (ObjectURL).",
      "Acción recomendada: Para URLs de Supabase Storage, agregar el dominio en next.config.images.remotePatterns y migrar a <Image>.",
    ],
  },
  "Colores hardcoded en saproa-admin — análisis": {
    severity: "LOW",
    items: [
      "#6366F1 (SAPROA_ACCENT) — intencional, constante nombrada en Sidebar.tsx e impersonar/page.tsx. Represents SAPROA brand.",
      "#8B2252 — default del accent_color en sistema/page.tsx (cargado de DB, el hardcode es solo el valor inicial del state).",
      "#6b7280 — fallback neutro para brand_color null en empresas/usuarios/impersonar. Aceptable.",
      "#EF4444/#F59E0B/#22C55E — colores de prioridad en roadmap/overview. Parte del diseño semántico intencional.",
      "Colores de iconos en feedback/overview (#2563EB, #DC2626, #16A34A) — coinciden con los tokens de color del sistema de badges.",
      "Evaluación: Todos los hardcodes son intencionales o valores de fallback seguros.",
    ],
  },
  "React keys en .map() — verificación": {
    severity: "INFO",
    items: [
      "empresas/page.tsx — key={c.id} ✓",
      "impersonar/page.tsx — key={group.id}, key={company.id}, key={u.id} ✓",
      "overview/page.tsx — key={card.label}, key={c.id}, key={f.id}, key={item.id} ✓",
      "roadmap/page.tsx — key={priority}, key={item.id} ✓",
      "usuarios/page.tsx — key={u.id} ✓",
      "Resultado: 0 maps sin key prop en app/saproa-admin/",
    ],
  },
  "TODO/FIXME identificados en la base de código": {
    severity: "LOW",
    items: [
      "app/campo/tickets/page.tsx:810-817 — iOS camera capture deshabilitado temporalmente (preexistente).",
      "No hay TODO/FIXME en ningún archivo bajo app/saproa-admin/",
      "Acción: El item de campo/tickets es una feature pendiente de iOS, no un bug de seguridad.",
    ],
  },
  "Acceso no autenticado — rutas /saproa-admin/*": {
    severity: "INFO",
    items: [
      "Verificación: app/saproa-admin/layout.tsx es un RouteGuard client-side que redirige a /dashboard si !isRealSuperAdmin.",
      "El guard se ejecuta antes de renderizar children, retornando null mientras loading=true.",
      "isRealSuperAdmin proviene del ImpersonationContext y NO es afectado por ImpersonationBridge (permanece true incluso durante impersonación).",
      "Nota: La protección es client-side. Para rutas de solo datos (sin /api/), esto es adecuado en Next.js App Router con middleware.",
      "Recomendación futura: Agregar middleware.ts con verificación de cookie de sesión de Supabase para rutas /saproa-admin/*.",
    ],
  },
  "ImpersonationBanner — mejoras implementadas": {
    severity: "INFO",
    items: [
      "Usa groupColor de ThemeContext (= brand_color de empresa impersonada) en lugar de color SAPROA hardcoded.",
      "Al hacer exit, navega a /saproa-admin/overview (no a /dashboard) para volver al Control Center.",
      "Indicador visual de punto (8px) con brand_color antes del ícono Eye.",
      "Colores dinámicos con hex alpha: background=${color}14, border=${color}33, button-border=${color}66.",
    ],
  },
  "Sidebar — SAPROA Control Center": {
    severity: "INFO",
    items: [
      "isSaproaMode = isRealSuperAdmin && !isImpersonating — condición correcta.",
      "activeAccent = isSaproaMode ? SAPROA_ACCENT (#6366F1) : groupColor — dinámico.",
      "3 secciones SAPROA: PLATAFORMA (Overview, Empresas, Usuarios), DEVELOPER (Impersonar, Roadmap, Sandbox-disabled), SOPORTE (Feedback, Sistema).",
      "Logo area: Shield icon en caja indigo cuando isSaproaMode.",
      "Todos los accentColor={groupColor} migrados a accentColor={activeAccent}.",
    ],
  },
};

function generateHtmlReport(staticFindings, date) {
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
  const entries = Object.entries(staticFindings).sort((a, b) => {
    return (severityOrder[a[1].severity] || 3) - (severityOrder[b[1].severity] || 3);
  });

  const highCount = entries.filter(([, v]) => v.severity === "HIGH").length;
  const medCount = entries.filter(([, v]) => v.severity === "MEDIUM").length;
  const lowCount = entries.filter(([, v]) => v.severity === "LOW").length;
  const infoCount = entries.filter(([, v]) => v.severity === "INFO").length;

  const sections = entries.map(([key, val]) => `
    <div class="finding">
      <h3><span class="severity ${val.severity.toLowerCase()}">${val.severity}</span> ${key}</h3>
      <ul>${val.items.map(i => `<li>${i}</li>`).join("")}</ul>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>SAPROA Audit Report — ${date}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 920px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; color: #1e293b; }
  h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .summary-card { background: #fff; border-radius: 8px; padding: 14px 18px; border: 1px solid #e2e8f0; }
  .summary-card .val { font-size: 26px; font-weight: 800; }
  .summary-card .lbl { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .high .val { color: #dc2626; } .medium .val { color: #d97706; } .low .val { color: #16a34a; } .info-card .val { color: #2563eb; }
  .section-title { font-size: 16px; font-weight: 700; margin: 28px 0 14px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
  .finding { background: #fff; border-radius: 8px; padding: 16px 20px; border: 1px solid #e2e8f0; margin-bottom: 12px; }
  .finding h3 { margin: 0 0 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .finding ul { margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6; }
  .finding li { margin-bottom: 3px; }
  .severity { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; flex-shrink: 0; }
  .severity.high { background: #fee2e2; color: #dc2626; }
  .severity.medium { background: #fff7ed; color: #c2410c; }
  .severity.low { background: #f0fdf4; color: #166534; }
  .severity.info { background: #eff6ff; color: #1d4ed8; }
  footer { margin-top: 48px; font-size: 11px; color: #94a3b8; text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>

<h1>SAPROA Control Center — Reporte de Auditoría</h1>
<p class="subtitle">Generado el ${date} &nbsp;|&nbsp; PropAdmin &nbsp;|&nbsp; Rama: main &nbsp;|&nbsp; Commit: 2370155</p>

<div class="summary">
  <div class="summary-card high"><div class="val">${highCount}</div><div class="lbl">Alta</div></div>
  <div class="summary-card medium"><div class="val">${medCount}</div><div class="lbl">Media</div></div>
  <div class="summary-card low"><div class="val">${lowCount}</div><div class="lbl">Baja</div></div>
  <div class="summary-card info-card"><div class="val">${infoCount}</div><div class="lbl">Info</div></div>
</div>

<div class="section-title">Hallazgos</div>
${sections}

<footer>Generado por SAPROA Audit Script &nbsp;·&nbsp; PropAdmin &nbsp;·&nbsp; ${date}</footer>
</body>
</html>`;
}

const html = generateHtmlReport(staticFindings, date);
const reportPath = path.join(outDir, `saproa-audit-${date}.html`);
fs.writeFileSync(reportPath, html, "utf-8");
console.log("Report generated:", reportPath);
