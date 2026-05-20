/**
 * Suite de pruebas estáticas — sistema de notificaciones SAPROA.
 * Análisis de código fuente sin Supabase ni React runtime.
 * Ejecutar: npx tsx scripts/test-notificaciones.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────────────────────────────────────
//  FRAMEWORK
// ─────────────────────────────────────────────────────────────────────────────

type Result = { name: string; passed: boolean; error?: string };
const results: Result[] = [];

function recordPass(name: string) {
  results.push({ name, passed: true });
  console.log(`✅ PASS — ${name}`);
}

function recordFail(name: string, error: string, expected?: unknown, got?: unknown) {
  results.push({ name, passed: false, error });
  console.log(`❌ FAIL — ${name}`);
  console.log(`   Error: ${error}`);
  if (expected !== undefined) console.log(`   Esperado: ${JSON.stringify(expected)}`);
  if (got !== undefined) console.log(`   Obtenido: ${JSON.stringify(got)}`);
}

class TestFail extends Error {
  constructor(msg: string, public expected?: unknown, public got?: unknown) { super(msg); }
}

function ok(cond: boolean, msg: string, expected?: unknown, got?: unknown): void {
  if (!cond) throw new TestFail(msg, expected, got);
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    recordPass(name);
  } catch (e) {
    if (e instanceof TestFail) recordFail(name, e.message, e.expected, e.got);
    else recordFail(name, String(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ARCHIVOS FUENTE
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();

function src(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

const NOTIFICATIONS_TS   = src("lib/notifications.ts");
const USE_NOTIFICATIONS  = src("app/hooks/useNotifications.ts");
const SIDEBAR_TSX        = src("components/Sidebar.tsx");

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 1 — Estructura del tipo Notification
// ─────────────────────────────────────────────────────────────────────────────

function suite1(): void {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 1 — Estructura del tipo Notification");
  console.log("══════════════════════════════════════════════════════════════\n");

  const requiredFields: Array<[string, RegExp]> = [
    ["id: string",                 /\bid\s*:\s*string/],
    ["module: NotificationModule", /\bmodule\s*:\s*NotificationModule/],
    ["severity: NotificationSeverity", /\bseverity\s*:\s*NotificationSeverity/],
    ["title: string",              /\btitle\s*:\s*string/],
    ["description: string",        /\bdescription\s*:\s*string/],
    ["action_route: string | null", /\baction_route\s*:\s*string \| null/],
    ["is_resolved: boolean",       /\bis_resolved\s*:\s*boolean/],
    ["building_id? (opcional)",    /\bbuilding_id\s*\?\s*:/],
    ["count? (opcional)",          /\bcount\s*\?\s*:/],
  ];

  for (const [label, pattern] of requiredFields) {
    run(`1 — Notification.${label}`, () => {
      ok(pattern.test(NOTIFICATIONS_TS), `Campo no encontrado en lib/notifications.ts`, label, "no encontrado");
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 2 — NotificationModule incluye los 9 módulos
// ─────────────────────────────────────────────────────────────────────────────

function suite2(): void {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 2 — NotificationModule tiene los 9 módulos");
  console.log("══════════════════════════════════════════════════════════════\n");

  const expectedModules = [
    "cobranza", "servicios", "unidades", "contratos",
    "mantenimiento", "propiedades", "compras", "pagos", "configuracion",
  ];

  // Extract the NotificationModule type line
  const moduleTypeLine = NOTIFICATIONS_TS.match(/export type NotificationModule\s*=([^;]+)/)?.[1] ?? "";

  for (const mod of expectedModules) {
    run(`2 — NotificationModule incluye '${mod}'`, () => {
      ok(
        moduleTypeLine.includes(`'${mod}'`),
        `'${mod}' no está en NotificationModule`,
        `incluye '${mod}'`,
        moduleTypeLine.trim(),
      );
    });
  }

  run("2 — MODULE_LABELS tiene etiqueta para todos los módulos", () => {
    for (const mod of expectedModules) {
      ok(NOTIFICATIONS_TS.includes(`${mod}:`), `MODULE_LABELS no tiene clave '${mod}'`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 3 — useNotifications tiene queries por módulo
// ─────────────────────────────────────────────────────────────────────────────

function suite3(): void {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 3 — useNotifications tiene queries por módulo");
  console.log("══════════════════════════════════════════════════════════════\n");

  run("3 — servicios: query a building_utility_meters", () => {
    ok(
      USE_NOTIFICATIONS.includes("from('building_utility_meters')"),
      "No se encontró query a 'building_utility_meters' para módulo servicios",
    );
  });

  run("3 — compras: query a purchase_orders con status pending/partial", () => {
    const hasPending = USE_NOTIFICATIONS.includes("eq('status', 'pending')") ||
                       USE_NOTIFICATIONS.includes('eq("status", "pending")');
    const hasPartial  = USE_NOTIFICATIONS.includes("eq('status', 'partial')") ||
                        USE_NOTIFICATIONS.includes('eq("status", "partial")');
    ok(hasPending && hasPartial, "No se encontraron queries pending/partial en purchase_orders para módulo compras");
  });

  run("3 — cobranza: query a collection_records con status overdue", () => {
    const hasOverdue = /from\('collection_records'\)/.test(USE_NOTIFICATIONS) &&
                       /eq\('status',\s*'overdue'\)/.test(USE_NOTIFICATIONS);
    ok(hasOverdue, "No se encontró query a collection_records (overdue) para módulo cobranza");
  });

  run("3 — mantenimiento: query a maintenance_logs con priority urgent", () => {
    const hasMaint = USE_NOTIFICATIONS.includes("from('maintenance_logs')") &&
                     (USE_NOTIFICATIONS.includes("eq('priority', 'urgent')") ||
                      USE_NOTIFICATIONS.includes('eq("priority", "urgent")'));
    ok(hasMaint, "No se encontró query a maintenance_logs (urgent) para módulo mantenimiento");
  });

  run("3 — pagos: query a purchase_orders con status invoiced", () => {
    const hasInvoiced = /eq\('status',\s*'invoiced'\)/.test(USE_NOTIFICATIONS);
    ok(hasInvoiced, "No se encontró query a purchase_orders con status='invoiced' para módulo pagos");
  });

  run("3 — pagos: query a payment_reports para detectar OCs ya reportadas", () => {
    ok(
      USE_NOTIFICATIONS.includes("from('payment_reports')"),
      "No se encontró query a 'payment_reports' para módulo pagos",
    );
  });

  run("3 — configuracion: query a companies para verificar campos de onboarding", () => {
    ok(
      USE_NOTIFICATIONS.includes("from('companies')"),
      "No se encontró query a 'companies' para módulo configuracion",
    );
    ok(
      USE_NOTIFICATIONS.includes("logo_url") && USE_NOTIFICATIONS.includes("brand_color"),
      "Query de configuracion no incluye logo_url o brand_color",
    );
  });

  run("3 — contratos: query a leases (por vencer y vencidos)", () => {
    const hasLeases = /from\('leases'\)/.test(USE_NOTIFICATIONS) &&
                      USE_NOTIFICATIONS.includes("end_date");
    ok(hasLeases, "No se encontró query a 'leases' para módulo contratos");
  });

  run("3 — unidades: query a units con needs_review", () => {
    const hasUnits = USE_NOTIFICATIONS.includes("from('units')") &&
                     USE_NOTIFICATIONS.includes("needs_review");
    ok(hasUnits, "No se encontró query a 'units' (needs_review) para módulo unidades");
  });

  run("3 — hook exporta { notifications, byModule, moduleStats, loading, refetch }", () => {
    ok(USE_NOTIFICATIONS.includes("return { notifications, byModule, moduleStats, loading, refetch }"),
       "El hook no retorna la estructura esperada");
  });

  run("3 — ModuleStat tiene module, count, severity", () => {
    ok(
      USE_NOTIFICATIONS.includes("module: NotificationModule") &&
      USE_NOTIFICATIONS.includes("count: number") &&
      USE_NOTIFICATIONS.includes("severity:"),
      "ModuleStat no tiene los campos requeridos",
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 4 — SEVERITY_COLORS
// ─────────────────────────────────────────────────────────────────────────────

function suite4(): void {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 4 — Colores de severidad");
  console.log("══════════════════════════════════════════════════════════════\n");

  run("4 — critical.dot = #E24B4A (rojo)", () => {
    const criticalBlock = NOTIFICATIONS_TS.match(/critical\s*:\s*\{[^}]+\}/)?.[0] ?? "";
    ok(criticalBlock.includes("#E24B4A"), "critical no tiene color #E24B4A", "#E24B4A", criticalBlock);
  });

  run("4 — warning.dot = #EF9F27 (ámbar)", () => {
    const warningBlock = NOTIFICATIONS_TS.match(/warning\s*:\s*\{[^}]+\}/)?.[0] ?? "";
    ok(warningBlock.includes("#EF9F27"), "warning no tiene color #EF9F27", "#EF9F27", warningBlock);
  });

  run("4 — brand.dot = #8B2252", () => {
    const brandBlock = NOTIFICATIONS_TS.match(/brand\s*:\s*\{[^}]+\}/)?.[0] ?? "";
    ok(brandBlock.includes("#8B2252"), "brand no tiene color #8B2252", "#8B2252", brandBlock);
  });

  run("4 — info usa var(--accent) (brand color dinámico)", () => {
    const infoBlock = NOTIFICATIONS_TS.match(/info\s*:\s*\{[^}]+\}/)?.[0] ?? "";
    ok(infoBlock.includes("var(--accent)"), "info no usa var(--accent) para el color brand dinámico", "var(--accent)", infoBlock);
  });

  run("4 — SEVERITY_COLORS tiene las 4 severidades definidas", () => {
    ok(
      NOTIFICATIONS_TS.includes("critical:") &&
      NOTIFICATIONS_TS.includes("warning:") &&
      NOTIFICATIONS_TS.includes("brand:") &&
      NOTIFICATIONS_TS.includes("info:"),
      "SEVERITY_COLORS no tiene las 4 severidades",
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 5 — Sidebar notifModules por ítem
// ─────────────────────────────────────────────────────────────────────────────

function suite5(): void {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 5 — Sidebar: notifModules por ítem de navegación");
  console.log("══════════════════════════════════════════════════════════════\n");

  run("5 — Dashboard incluye todos los módulos en notifModules", () => {
    const allModules = ["cobranza", "servicios", "unidades", "contratos",
                        "mantenimiento", "propiedades", "compras", "pagos", "configuracion"];
    const dashLine = SIDEBAR_TSX.match(/Dashboard.*?notifModules.*?\]/s)?.[0] ?? "";
    for (const mod of allModules) {
      ok(dashLine.includes(`"${mod}"`) || SIDEBAR_TSX.match(
        new RegExp(`Dashboard[^}]{0,200}notifModules[^\\]]*"${mod}"`)
      ) !== null,
        `Dashboard.notifModules no incluye '${mod}'`,
      );
    }
  });

  run("5 — Pagos tiene notifModules: [\"pagos\"]", () => {
    const pagosLine = SIDEBAR_TSX.match(/label:\s*["']Pagos["'][^}]{0,300}/s)?.[0] ?? "";
    ok(pagosLine.includes('"pagos"') || pagosLine.includes("'pagos'"),
       "Ítem Pagos no tiene notifModules con 'pagos'");
  });

  run("5 — Configuración tiene notifModules: [\"configuracion\"]", () => {
    const configLine = SIDEBAR_TSX.match(/label:\s*["']Configuración["'][^}]{0,300}/s)?.[0] ?? "";
    ok(configLine.includes('"configuracion"') || configLine.includes("'configuracion'"),
       "Ítem Configuración no tiene notifModules con 'configuracion'");
  });

  run("5 — Compras tiene notifModules: [\"compras\"]", () => {
    const comprasLine = SIDEBAR_TSX.match(/label:\s*["']Compras["'][^}]{0,300}/s)?.[0] ?? "";
    ok(comprasLine.includes('"compras"') || comprasLine.includes("'compras'"),
       "Ítem Compras no tiene notifModules con 'compras'");
  });

  run("5 — Mantenimiento tiene notifModules: [\"mantenimiento\"]", () => {
    const maintLine = SIDEBAR_TSX.match(/label:\s*["']Mantenimiento["'][^}]{0,300}/s)?.[0] ?? "";
    ok(maintLine.includes('"mantenimiento"') || maintLine.includes("'mantenimiento'"),
       "Ítem Mantenimiento no tiene notifModules con 'mantenimiento'");
  });

  run("5 — Servicios tiene notifModules: [\"servicios\"]", () => {
    const servLine = SIDEBAR_TSX.match(/label:\s*["']Servicios["'][^}]{0,300}/s)?.[0] ?? "";
    ok(servLine.includes('"servicios"') || servLine.includes("'servicios'"),
       "Ítem Servicios no tiene notifModules con 'servicios'");
  });

  run("5 — Cobranza tiene notifModules con 'cobranza' y 'contratos'", () => {
    const cobrLine = SIDEBAR_TSX.match(/label:\s*["']Cobranza["'][^}]{0,300}/s)?.[0] ?? "";
    ok(
      (cobrLine.includes('"cobranza"') || cobrLine.includes("'cobranza'")) &&
      (cobrLine.includes('"contratos"') || cobrLine.includes("'contratos'")),
      "Ítem Cobranza no tiene notifModules con 'cobranza' y 'contratos'",
    );
  });

  run("5 — Propiedades tiene notifModules con unidades, propiedades, servicios, contratos", () => {
    const propLine = SIDEBAR_TSX.match(/label:\s*["']Propiedades["'][^}]{0,300}/s)?.[0] ?? "";
    for (const mod of ["unidades", "propiedades", "servicios", "contratos"]) {
      ok(propLine.includes(`"${mod}"`) || propLine.includes(`'${mod}'`),
         `Ítem Propiedades no tiene notifModules con '${mod}'`);
    }
  });

  run("5 — Sidebar importa useNotifications y SEVERITY_COLORS", () => {
    ok(
      SIDEBAR_TSX.includes("useNotifications") && SIDEBAR_TSX.includes("SEVERITY_COLORS"),
      "Sidebar no importa useNotifications o SEVERITY_COLORS",
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 6 — Notificaciones de edificio tienen building_id
// ─────────────────────────────────────────────────────────────────────────────

// Split source into notifs.push() call blocks for per-notification checks.
// Each block ends at the matching closing `)` — we approximate by splitting on
// 'notifs.push({' and taking each chunk up to the first standalone '})'.
function extractPushBlocks(source: string): string[] {
  return source.split("notifs.push({").slice(1).map(chunk => {
    // Walk chars counting braces so we get the full object body
    let depth = 1;
    let i = 0;
    for (; i < chunk.length && depth > 0; i++) {
      if (chunk[i] === "{") depth++;
      else if (chunk[i] === "}") depth--;
    }
    return chunk.slice(0, i);
  });
}

function suite6(): void {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 6 — Notificaciones de edificio incluyen building_id");
  console.log("══════════════════════════════════════════════════════════════\n");

  const pushBlocks = extractPushBlocks(USE_NOTIFICATIONS);

  function blockContaining(idFragment: string): string {
    return pushBlocks.find(b => b.includes(idFragment)) ?? "";
  }

  run("6 — Notificaciones de unidades (units-review) incluyen building_id", () => {
    const block = blockContaining("units-review-");
    ok(block !== "", "No se encontró notifs.push con 'units-review-'");
    ok(block.includes("building_id"), "Notificación units-review no tiene campo building_id");
  });

  run("6 — Notificaciones de contratos (leases-expiring) incluyen building_id", () => {
    const block = blockContaining("leases-expiring-");
    ok(block !== "", "No se encontró notifs.push con 'leases-expiring-'");
    ok(block.includes("building_id"), "Notificación leases-expiring no tiene campo building_id");
  });

  run("6 — Notificaciones de contratos (leases-expired) incluyen building_id", () => {
    const block = blockContaining("leases-expired-");
    ok(block !== "", "No se encontró notifs.push con 'leases-expired-'");
    ok(block.includes("building_id"), "Notificación leases-expired no tiene campo building_id");
  });

  run("6 — Notificaciones de servicios (meters-placeholder) incluyen building_id", () => {
    const block = blockContaining("meters-placeholder-");
    ok(block !== "", "No se encontró notifs.push con 'meters-placeholder-'");
    ok(block.includes("building_id"), "Notificación meters-placeholder no tiene campo building_id");
  });

  run("6 — groupByBuilding extrae building_id de cada notificación de edificio", () => {
    ok(
      USE_NOTIFICATIONS.includes("function groupByBuilding") &&
      USE_NOTIFICATIONS.includes("building_id"),
      "groupByBuilding no existe o no maneja building_id",
    );
  });

  run("6 — building_id es campo opcional en el tipo Notification", () => {
    ok(
      /building_id\s*\?\s*:\s*string/.test(NOTIFICATIONS_TS),
      "building_id no está definido como campo opcional en Notification",
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║   SAPROA — Pruebas estáticas del sistema de notificaciones  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("  Modo: análisis de código fuente (sin Supabase ni React)\n");

  suite1();
  suite2();
  suite3();
  suite4();
  suite5();
  suite6();

  const total  = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);

  const s1 = results.filter(r => r.name.startsWith("1"));
  const s2 = results.filter(r => r.name.startsWith("2"));
  const s3 = results.filter(r => r.name.startsWith("3"));
  const s4 = results.filter(r => r.name.startsWith("4"));
  const s5 = results.filter(r => r.name.startsWith("5"));
  const s6 = results.filter(r => r.name.startsWith("6"));

  const pct  = (arr: Result[]) => `${arr.filter(r => r.passed).length}/${arr.length}`;
  const icon = (arr: Result[]) => arr.every(r => r.passed) ? "✅" : "❌";

  console.log("\n\n══════════════════════════════════════════════════════════════");
  console.log(`RESULTADOS: ${passed}/${total} tests pasaron`);
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`SUITE 1 Tipo Notification:    ${pct(s1)} ${icon(s1)}`);
  console.log(`SUITE 2 NotificationModule:   ${pct(s2)} ${icon(s2)}`);
  console.log(`SUITE 3 Queries por módulo:   ${pct(s3)} ${icon(s3)}`);
  console.log(`SUITE 4 Severity colors:      ${pct(s4)} ${icon(s4)}`);
  console.log(`SUITE 5 Sidebar notifModules: ${pct(s5)} ${icon(s5)}`);
  console.log(`SUITE 6 Building_id presente: ${pct(s6)} ${icon(s6)}`);

  if (failed.length > 0) {
    console.log("\nFALLOS ENCONTRADOS:");
    for (const r of failed) {
      console.log(`  • [${r.name}] ${r.error}`);
    }
  } else {
    console.log("\nFALLOS ENCONTRADOS: Ninguno");
  }

  const allPass = passed === total;
  console.log(`\nRECOMENDACIÓN: ${allPass
    ? "✅ Sistema de notificaciones verificado — estructura, queries y colores correctos."
    : `⚠️  ${failed.length} test(s) fallaron. Revisar bugs listados arriba.`
  }`);
  console.log("══════════════════════════════════════════════════════════════\n");

  process.exit(allPass ? 0 : 1);
}

main();
