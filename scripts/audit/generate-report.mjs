/**
 * Genera el reporte HTML de diagnóstico Fase 0 de SAPROA
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, "..", "audit-reports");
import { mkdirSync } from "fs";
mkdirSync(REPORTS_DIR, { recursive: true });

const auditData = JSON.parse(readFileSync(join(__dirname, "audit-results.json"), "utf8"));
const supabaseData = JSON.parse(readFileSync(join(__dirname, "supabase-results.json"), "utf8"));

const DATE = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
const TIME = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

function statusBadge(status) {
  const colors = {
    pass: "#16A34A", fail: "#DC2626", warn: "#D97706", info: "#2563EB",
    critical: "#DC2626", medium: "#D97706", low: "#16A34A"
  };
  const labels = { pass: "OK", fail: "CRÍTICO", warn: "ADVERTENCIA", info: "INFO", critical: "CRÍTICO", medium: "MEDIO", low: "BAJO" };
  const bg = { pass: "#DCFCE7", fail: "#FEE2E2", warn: "#FEF3C7", info: "#DBEAFE", critical: "#FEE2E2", medium: "#FEF3C7", low: "#DCFCE7" };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;color:${colors[status]};background:${bg[status]};border:1px solid ${colors[status]}33">${labels[status] || status.toUpperCase()}</span>`;
}

function img(b64, alt, width = "100%") {
  if (!b64) return `<div style="background:#F1F5F9;padding:20px;text-align:center;color:#94A3B8;border-radius:8px;font-size:12px">[Screenshot no disponible]</div>`;
  return `<img src="${b64}" alt="${alt}" style="width:${width};border-radius:8px;border:1px solid #E2E8F0;display:block" />`;
}

function loadBar(ms) {
  const color = ms < 1500 ? "#16A34A" : ms < 3000 ? "#D97706" : "#DC2626";
  const pct = Math.min(100, (ms / 4000) * 100);
  return `<div style="background:#F1F5F9;border-radius:4px;height:8px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div></div>`;
}

const navLinks = [
  ["resumen", "Resumen Ejecutivo"],
  ["p1", "1. Rebote de Login"],
  ["p2", "2. Flash FOUC"],
  ["p3", "3. Colores Hardcodeados"],
  ["p4", "4. Espaciado/Cards"],
  ["p5", "5. Animaciones"],
  ["perf", "A. Performance"],
  ["json", "B. JSON en texto"],
  ["temas", "C. Temas"],
  ["mobile", "D. Mobile"],
  ["datos", "E. Integridad datos"],
  ["storage", "F. Storage"],
  ["roles", "G. Roles/Permisos"],
  ["recs", "Recomendaciones"],
];

const nav = `<nav style="position:sticky;top:0;z-index:100;background:#1E2A3A;padding:10px 24px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-bottom:2px solid #8B2252">
  <span style="color:#fff;font-size:13px;font-weight:700;margin-right:10px">SAPROA Fase 0</span>
  ${navLinks.map(([id, label]) => `<a href="#${id}" style="color:#94A3B8;text-decoration:none;font-size:11px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,0.06);white-space:nowrap;transition:color .15s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94A3B8'">${label}</a>`).join("")}
</nav>`;

// ═══════════════ RESUMEN EJECUTIVO ═══════════════
const executiveSummary = `
<section id="resumen" style="margin-bottom:48px">
  <h2 style="font-size:22px;font-weight:700;color:#0F172A;border-bottom:3px solid #8B2252;padding-bottom:8px;margin-bottom:24px">Resumen Ejecutivo — 5 Problemas Prioritarios</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px">

    <!-- P1 -->
    <div style="background:#FFF;border:1px solid #E2E8F0;border-left:4px solid #DC2626;border-radius:8px;padding:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:24px;font-weight:800;color:#DC2626">1</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#0F172A">Rebote de Login (Auth Race Condition)</div>
          ${statusBadge("fail")}
        </div>
      </div>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Síntoma:</b> login → dashboard → login → dashboard antes de estabilizarse.</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Causa raíz:</b> <code>onAuthStateChange</code> en <code>UserContext.tsx:113</code> llama <code>refreshUser()</code> sin filtrar el tipo de evento. Supabase dispara INITIAL_SESSION + SIGNED_IN al hacer login = 2 ciclos de loading consecutivos de ~400-600ms cada uno.</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Archivos:</b> <code>contexts/UserContext.tsx:113</code>, <code>components/RouteGuard.tsx:136</code>, <code>app/login/page.tsx:39</code></p>
      <p style="font-size:13px;color:#374151;margin:0"><b>Evidencia:</b> Nav log: /login(3499ms) → /login(4598ms) → /saproa-admin/overview(6787ms). El segundo hit a /login es el rebote.</p>
    </div>

    <!-- P2 -->
    <div style="background:#FFF;border:1px solid #E2E8F0;border-left:4px solid #DC2626;border-radius:8px;padding:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:24px;font-weight:800;color:#DC2626">2</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#0F172A">Flash Color Vino FOUC</div>
          ${statusBadge("fail")}
        </div>
      </div>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Síntoma:</b> al cargar cualquier página, parpadea el color <code>#8B2252</code> antes del color real de la empresa.</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Causa raíz:</b> <code>const DEFAULT_ACCENT = "#8B2252"</code> en <code>ThemeContext.tsx:64</code> y <code>--accent: #8B2252</code> en <code>globals.css:20</code>. El color de marca no se guarda en localStorage, por lo que el ThemeProvider siempre empieza con el default hasta que la query a Supabase (<code>companies.brand_color</code>) resuelva (~300-800ms post-hidratación).</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Archivos:</b> <code>contexts/ThemeContext.tsx:64,125</code>, <code>app/globals.css:20</code></p>
      <p style="font-size:13px;color:#374151;margin:0"><b>Nota:</b> En sesión de superadmin con caché de Supabase el flash fue imperceptible (color correcto a 50ms). Afecta más a usuarios sin caché o de empresas con color diferente al #8B2252.</p>
    </div>

    <!-- P3 -->
    <div style="background:#FFF;border:1px solid #E2E8F0;border-left:4px solid #D97706;border-radius:8px;padding:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:24px;font-weight:800;color:#D97706">3</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#0F172A">749 Colores Hex Hardcodeados</div>
          ${statusBadge("warn")}
        </div>
      </div>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Síntoma:</b> cambiar el color de icono o elemento requiere buscar y editar en múltiples archivos.</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Causa raíz:</b> Existe sistema de variables CSS (<code>--accent, --badge-bg-*, --icon-color-*</code>) en globals.css, pero ~60% de los archivos usan valores hex literales en inline styles. Hay al menos 90 instancias de <code>#8B2252</code> hardcodeado solo fuera de globals.css.</p>
      <p style="font-size:13px;color:#374151;margin:0"><b>Top 3 archivos:</b> <code>buildings/[buildingId]/page.tsx</code> (110), <code>purchases/page.tsx</code> (65), <code>settings/page.tsx</code> (42).</p>
    </div>

    <!-- P4 -->
    <div style="background:#FFF;border:1px solid #E2E8F0;border-left:4px solid #D97706;border-radius:8px;padding:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:24px;font-weight:800;color:#D97706">4</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#0F172A">Espaciado Inconsistente entre Viewports</div>
          ${statusBadge("warn")}
        </div>
      </div>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Síntoma:</b> cards y padding se ven apretados en laptops de 1280px comparado con monitores 1440px+.</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Causa raíz:</b> globals.css tiene tokens <code>--card-gap:16px</code> y <code>--section-gap:24px</code> pero los inline styles usan valores fijos (16px, 20px, 24px) sin referenciar estas variables. No existe un breakpoint de "laptop pequeña" (1024-1280px) que ajuste el espaciado de los contenedores principales.</p>
      <p style="font-size:13px;color:#374151;margin:0"><b>Archivos:</b> Todos los page.tsx con inline padding styles. <code>app/globals.css:118-120</code> (tokens definidos pero no usados).</p>
    </div>

    <!-- P5 -->
    <div style="background:#FFF;border:1px solid #E2E8F0;border-left:4px solid #D97706;border-radius:8px;padding:20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:24px;font-weight:800;color:#D97706">5</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#0F172A">Animaciones Costosas / Patchy</div>
          ${statusBadge("warn")}
        </div>
      </div>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Síntoma:</b> algunas animaciones se sienten trabadas o lentas, especialmente en acordeones/expansiones.</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Causa raíz:</b> (a) 4 componentes usan <code>animate={{ height: "auto" }}</code> de framer-motion (collections, maintenance, purchases, campo/tickets) que requiere JS para calcular dimensión final y genera layout thrash. (b) ~8 progress bars animan la propiedad <code>width</code> en lugar de <code>scaleX</code>, lo que no beneficia de GPU acceleration. (c) <code>animate={{ width }}</code> en dashboard/page.tsx directamente.</p>
      <p style="font-size:13px;color:#374151;margin:0"><b>Archivos:</b> <code>app/dashboard/page.tsx:876</code>, <code>app/collections/page.tsx:1430</code>, <code>app/maintenance/page.tsx:2269</code>, <code>app/purchases/page.tsx:1978</code>, <code>app/campo/tickets/page.tsx:911</code>.</p>
    </div>

  </div>
</section>`;

// ═══════════════ SECCIÓN 1 — LOGIN BOUNCE ═══════════════
const section1 = `
<section id="p1" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">1. Rebote de Login — Diagnóstico Detallado</h2>

  <div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px">
    <b style="color:#DC2626">Causa Raíz Confirmada:</b> <code>onAuthStateChange</code> en <code>contexts/UserContext.tsx:113</code> llama <code>refreshUser()</code> en <i>cualquier</i> evento de Supabase Auth sin filtrar por tipo. Al hacer login, Supabase dispara tanto <b>INITIAL_SESSION</b> como <b>SIGNED_IN</b>, causando dos ciclos de loading consecutivos.
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Traza de Navegación Capturada</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
    <thead><tr style="background:#F8FAFC"><th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">Tiempo</th><th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">URL</th><th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">Evento</th></tr></thead>
    <tbody>
      ${auditData.loginBounce.map((e, i) => `
      <tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">${e.ms}ms</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace;color:${e.url?.includes('login')?'#DC2626':'#16A34A'}">${e.url || "—"}</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#6B7280">${e.event || "framenavigated"}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Screenshots antes/después del login</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
    <div>
      <div style="font-size:12px;color:#6B7280;margin-bottom:6px">Antes del submit</div>
      ${img(auditData.loginBounceScreenshots?.before, "Antes de login")}
    </div>
    <div>
      <div style="font-size:12px;color:#6B7280;margin-bottom:6px">Después del submit (estado final)</div>
      ${img(auditData.loginBounceScreenshots?.after, "Después de login")}
    </div>
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Análisis del Código</h3>
  <pre style="background:#1E2535;color:#E2E8F0;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;line-height:1.6"><code>// contexts/UserContext.tsx:108-119 — PROBLEMA
useEffect(() => {
  refreshUser();  // ← 1er llamado al montar

  const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
    refreshUser();  // ← llamado en CADA evento: INITIAL_SESSION + SIGNED_IN
    // Resultado: 2 ciclos de loading al hacer login
    // Cada ciclo: loading=true → query app_users → query tenants → loading=false
    // ≈ 400-600ms por ciclo → 800-1200ms de bounce visible
  });
  return () => subscription.unsubscribe();
}, []);</code></pre>

  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin-top:16px">
    <b style="color:#15803D">Enfoque de corrección (sin implementar):</b> Filtrar el tipo de evento en <code>onAuthStateChange((event, session) => {...})</code> — ignorar INITIAL_SESSION si ya se cargó el usuario, o debounce de 50ms para colapsar eventos consecutivos. También considerar eliminar el <code>router.push("/dashboard")</code> del login page y dejar que RouteGuard maneje el redirect.
  </div>
</section>`;

// ═══════════════ SECCIÓN 2 — FOUC ═══════════════
const foucRows = auditData.foucScreenshots.map((f, i) => `
  <tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
    <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">${f.delay}ms</td>
    <td style="padding:8px 12px;border:1px solid #E2E8F0">
      <span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${f.accent || '#ccc'};border:1px solid #ccc;vertical-align:middle;margin-right:6px"></span>
      <code>${f.accent || "error"}</code>
    </td>
    <td style="padding:8px 12px;border:1px solid #E2E8F0">${f.accent === "#8B2252" ? statusBadge("fail") + " DEFAULT vino" : f.accent ? statusBadge("pass") + " Color correcto cargado" : "Error"}</td>
  </tr>`).join("");

const section2 = `
<section id="p2" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">2. Flash del Color Vino (FOUC) — Diagnóstico Detallado</h2>

  <div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px">
    <b style="color:#DC2626">Causa Raíz:</b> <code>const DEFAULT_ACCENT = "#8B2252"</code> en <code>contexts/ThemeContext.tsx:64</code>. El color de la empresa <b>no se persiste en localStorage</b>, por lo que en cada carga el componente empieza en #8B2252 hasta que la query <code>companies.brand_color</code> resuelva en Supabase.
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Color CSS --accent medido en los primeros 1000ms</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">Tiempo</th>
      <th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">--accent value</th>
      <th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">Estado</th>
    </tr></thead>
    <tbody>${foucRows}</tbody>
  </table>
  <p style="font-size:12px;color:#6B7280;margin-bottom:16px"><i>Nota: El test se corrió con cuenta superadmin que tenía caché de Supabase — el color (#6366F1) cargó en menos de 50ms. En sesión limpia o con empresa de color diferente, el flash de #8B2252 sería visible 200-800ms.</i></p>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Screenshots FOUC (primeros 1000ms post-navegación)</h3>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px">
    ${auditData.foucScreenshots.map(f => `<div>
      <div style="font-size:11px;color:#6B7280;text-align:center;margin-bottom:4px">${f.delay}ms</div>
      ${img(f.shot, `${f.delay}ms`, "100%")}
    </div>`).join("")}
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Inventario de hardcoding de #8B2252</h3>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:6px 10px;border:1px solid #E2E8F0;text-align:left">Archivo</th>
      <th style="padding:6px 10px;border:1px solid #E2E8F0;text-align:center">Ocurrencias</th>
      <th style="padding:6px 10px;border:1px solid #E2E8F0;text-align:left">Notas</th>
    </tr></thead>
    <tbody>
      <tr style="background:#fff"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">contexts/ThemeContext.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">1</td><td style="padding:6px 10px;border:1px solid #E2E8F0">DEFAULT_ACCENT (origen del FOUC)</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">app/globals.css</td><td style="text-align:center;border:1px solid #E2E8F0">3</td><td style="padding:6px 10px;border:1px solid #E2E8F0">--accent, --accent-gradient, --group-accent (default CSS)</td></tr>
      <tr style="background:#fff"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">app/buildings/[buildingId]/page.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">~15</td><td style="padding:6px 10px;border:1px solid #E2E8F0">inline styles y colores semánticos</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">components/UtilityMeterModal.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">~12</td><td style="padding:6px 10px;border:1px solid #E2E8F0">accentColor en radio buttons</td></tr>
      <tr style="background:#fff"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">app/login/page.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">2</td><td style="padding:6px 10px;border:1px solid #E2E8F0">Botón submit + link registro</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">components/ImpersonationBanner.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">1</td><td style="padding:6px 10px;border:1px solid #E2E8F0">const SAPROA_COLOR (intencional)</td></tr>
      <tr style="background:#fff"><td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace">components/UnitTypeWizardModal.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">1</td><td style="padding:6px 10px;border:1px solid #E2E8F0">const ACCENT (fallback)</td></tr>
    </tbody>
  </table>

  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px">
    <b style="color:#15803D">Enfoque de corrección:</b> Guardar <code>accent_color</code> en localStorage junto con <code>last_user_id</code>. En ThemeProvider, leer este valor y aplicarlo sincrónicamente antes de la query a Supabase. Así el --accent correcto estaría disponible desde el primer frame.
  </div>
</section>`;

// ═══════════════ SECCIÓN 3 — COLORES HARDCODEADOS ═══════════════
const colorFiles = [
  { file: "app/buildings/[buildingId]/page.tsx", count: 110, type: "Mezcla: marca, semánticos y estructurales" },
  { file: "app/purchases/page.tsx", count: 65, type: "Principalmente semánticos + marca" },
  { file: "app/settings/page.tsx", count: 42, type: "Marca (#8B2252 en var(--accent, #8B2252))" },
  { file: "app/cleaning/page.tsx", count: 34, type: "Colores semánticos de estado" },
  { file: "app/collections/page.tsx", count: 32, type: "Semánticos + marca" },
  { file: "app/dashboard/page.tsx", count: 28, type: "Colores chart y semánticos" },
  { file: "app/buildings/page.tsx", count: 25, type: "Marca + estructurales" },
  { file: "app/calendar/page.tsx", count: 21, type: "Estados de eventos" },
  { file: "app/register/page.tsx", count: 21, type: "Marca #8B2252 (pre-login)" },
  { file: "app/payments/page.tsx", count: 21, type: "Semánticos + marca" },
  { file: "components/BuildingUtilityMeterModal.tsx", count: 20, type: "accentColor en radio buttons" },
  { file: "components/CommercialTypologyModal.tsx", count: 17, type: "Colores de tipología" },
  { file: "components/UtilityMeterModal.tsx", count: 16, type: "accentColor en radio buttons" },
  { file: "components/BuildingServicesTab.tsx", count: 16, type: "Marca + interactivo" },
  { file: "components/UnitTypeWizardModal.tsx", count: 14, type: "const ACCENT fallback" },
];

const section3 = `
<section id="p3" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">3. Inventario de Colores Hardcodeados</h2>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:32px;font-weight:800;color:#D97706">749</div>
      <div style="font-size:12px;color:#92400E">Total instancias hex hardcodeadas</div>
    </div>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:32px;font-weight:800;color:#DC2626">~90</div>
      <div style="font-size:12px;color:#991B1B">#8B2252 hardcodeado (debería ser var(--accent))</div>
    </div>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:32px;font-weight:800;color:#16A34A">✓</div>
      <div style="font-size:12px;color:#166534">Sistema de variables CSS ya definido en globals.css</div>
    </div>
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Top 15 Archivos por Número de Colores Hardcodeados</h3>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">Archivo</th>
      <th style="padding:8px 12px;text-align:center;border:1px solid #E2E8F0">Instancias</th>
      <th style="padding:8px 12px;text-align:left;border:1px solid #E2E8F0">Tipo predominante</th>
    </tr></thead>
    <tbody>
      ${colorFiles.map((f, i) => `<tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
        <td style="padding:6px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">${f.file}</td>
        <td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:6px">
            <div style="width:${Math.min(60, f.count * 0.55)}px;height:6px;background:${f.count > 50 ? '#DC2626' : f.count > 25 ? '#D97706' : '#16A34A'};border-radius:3px"></div>
            <b>${f.count}</b>
          </div>
        </td>
        <td style="padding:6px 12px;border:1px solid #E2E8F0;font-size:11px;color:#6B7280">${f.type}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Clasificación por tipo</h3>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
    <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px">
      <div style="font-size:13px;font-weight:700;color:#DC2626;margin-bottom:8px">🔴 Debería ser variable CSS</div>
      <p style="font-size:12px;color:#374151;margin:0">Colores de marca (#8B2252 → var(--accent)), colores de estado semánticos (#10B981, #EF4444, etc. → var(--icon-color-green), etc.), colores de borde interactivo</p>
    </div>
    <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px">
      <div style="font-size:13px;font-weight:700;color:#D97706;margin-bottom:8px">🟡 Aceptables con contexto</div>
      <p style="font-size:12px;color:#374151;margin:0">Colores de overlay rgba con transparencias (#000, #fff con alpha), gradientes de login page (son fijos intencionalmente), colores de tipología inmobiliaria como metadatos estáticos</p>
    </div>
    <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px">
      <div style="font-size:13px;font-weight:700;color:#16A34A;margin-bottom:8px">🟢 OK — color de data</div>
      <p style="font-size:12px;color:#374151;margin:0">Colores usados en charts (Recharts) para series de datos, colores de área de edificios como categorías de datos, colores de PDF (lib/pdfTemplates.tsx)</p>
    </div>
  </div>
</section>`;

// ═══════════════ SECCIÓN 4 — ESPACIADO ═══════════════
const viewportShots = {};
auditData.viewportScreenshots.forEach(s => {
  const key = `${s.viewport}_${s.page}`;
  viewportShots[key] = s.shot;
});

const section4 = `
<section id="p4" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">4. Espaciado / Cards entre Tamaños de Pantalla</h2>

  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:20px">
    <b style="color:#B45309">Hallazgo:</b> Existe sistema de tokens de spacing en globals.css (<code>--card-gap:16px</code>, <code>--section-gap:24px</code>) pero los componentes usan valores inline hardcodeados. No existe breakpoint dedicado para "laptop pequeña" (1024-1280px) que ajuste el spacing del contenido principal.
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Comparación Dashboard: 1280px vs 1440px vs 1920px</h3>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    ${[1280, 1440, 1920].map(vw => `<div>
      <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;text-align:center">${vw}px ${vw === 1280 ? '(laptop)' : vw === 1440 ? '(estándar)' : '(monitor grande)'}</div>
      ${img(viewportShots[`${vw}_/dashboard`], `${vw}px dashboard`)}
    </div>`).join("")}
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Comparación Buildings: 1280px vs 1440px vs 1920px</h3>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    ${[1280, 1440, 1920].map(vw => `<div>
      <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;text-align:center">${vw}px</div>
      ${img(viewportShots[`${vw}_/buildings`], `${vw}px buildings`)}
    </div>`).join("")}
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Breakpoints actuales definidos en globals.css</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Breakpoint</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Comportamiento</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      <tr style="background:#fff"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">&gt;1024px</td><td style="padding:8px 12px;border:1px solid #E2E8F0">Sidebar completo 280px</td><td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")}</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">768-1024px</td><td style="padding:8px 12px;border:1px solid #E2E8F0">Sidebar colapsado 72px (iconos)</td><td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")}</td></tr>
      <tr style="background:#fff"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">&lt;768px</td><td style="padding:8px 12px;border:1px solid #E2E8F0">Sidebar drawer off-canvas</td><td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")}</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace;color:#DC2626">1024-1280px</td><td style="padding:8px 12px;border:1px solid #E2E8F0">Sin breakpoint — spacing igual que 1920px</td><td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("warn")}</td></tr>
    </tbody>
  </table>
</section>`;

// ═══════════════ SECCIÓN 5 — ANIMACIONES ═══════════════
const costlyAnimations = [
  { file: "app/dashboard/page.tsx:876", code: 'animate={{ width: `${progressPct}%` }}', issue: "framer-motion animando width → no GPU, layout thrash", severity: "fail" },
  { file: "app/collections/page.tsx:1430", code: 'animate={{ height: "auto", opacity: 1 }}', issue: "height:auto requiere JS layout calculation en cada frame", severity: "fail" },
  { file: "app/maintenance/page.tsx:2269", code: 'animate={{ opacity: 1, height: "auto" }}', issue: "height:auto → layout thrash en acordeón", severity: "fail" },
  { file: "app/purchases/page.tsx:1978", code: 'animate={{ opacity: 1, height: "auto" }}', issue: "height:auto → layout thrash en expansión de fila", severity: "fail" },
  { file: "app/campo/tickets/page.tsx:911", code: 'animate={{ opacity: 1, height: "auto" }}', issue: "height:auto en acordeón mobile", severity: "warn" },
  { file: "app/analytics/page.tsx:551,742", code: 'transition:"width .4s"', issue: "CSS transition en width (progress bar) — no GPU", severity: "warn" },
  { file: "app/cleaning/page.tsx:1482,1518", code: 'transition:"width 0.4s"', issue: "CSS transition en width — progress bar", severity: "warn" },
  { file: "app/buildings/[buildingId]/page.tsx:6143", code: 'transition: "left 0.2s"', issue: "CSS transition en left — toggle switch", severity: "warn" },
];

const section5 = `
<section id="p5" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">5. Animaciones Trabadas / Patchy</h2>

  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:20px">
    <b style="color:#B45309">Hallazgo:</b> <code>lib/animations.ts</code> está bien diseñado (usa opacity+transform). El problema está en componentes individuales que usan propiedades costosas directamente (width, height, left) fuera del sistema de animaciones definido.
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Animaciones con Propiedades Costosas</h3>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Archivo</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Código</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Problema</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Severidad</th>
    </tr></thead>
    <tbody>
      ${costlyAnimations.map((a, i) => `<tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
        <td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace;font-size:10px">${a.file}</td>
        <td style="padding:6px 10px;border:1px solid #E2E8F0;font-family:monospace;font-size:10px;color:#374151">${a.code}</td>
        <td style="padding:6px 10px;border:1px solid #E2E8F0;font-size:11px;color:#6B7280">${a.issue}</td>
        <td style="padding:6px 10px;border:1px solid #E2E8F0;text-align:center">${statusBadge(a.severity)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Sistema de animaciones existente en lib/animations.ts</h3>
  <pre style="background:#1E2535;color:#E2E8F0;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto"><code>// ✓ Bien diseñado — usa transform/opacity (GPU accelerated)
fadeIn:    opacity: 0→1                           duration: 200ms
slideUp:   opacity+y: 0→1, 12→0                  duration: 250ms, ease: [0.16,1,0.3,1]
scaleIn:   opacity+scale: 0→1, 0.96→1            duration: 200ms
stagger:   staggerChildren: 60ms

// ✗ No cumple el estándar — propiedades de layout
animate={{ width }} → debería ser transform: scaleX()
animate={{ height: "auto" }} → debería ser maxHeight o useLayoutEffect</code></pre>
</section>`;

// ═══════════════ SECCIÓN A — PERFORMANCE ═══════════════
const sectionPerf = `
<section id="perf" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">A. Performance — Tiempos de Carga</h2>

  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px;margin-bottom:20px;font-size:13px">
    <b style="color:#B45309">Umbral:</b> &lt;1500ms ✓ bueno · 1500-3000ms ⚠ advertencia · &gt;3000ms ✗ crítico (hasta networkidle desde navegación)
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Página</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Tiempo (ms)</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0">Barra</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      ${auditData.pageLoads.map((p, i) => `<tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-weight:500">${p.label}</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace;font-weight:700;color:${p.ms<1500?'#16A34A':p.ms<3000?'#D97706':'#DC2626'}">${p.ms}ms</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0">${loadBar(p.ms)}</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge(p.status)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">
    ${auditData.pageLoads.slice(0,4).map(p => `<div>
      <div style="font-size:11px;color:#6B7280;margin-bottom:4px;text-align:center">${p.label}</div>
      ${img(p.screenshot, p.label)}
    </div>`).join("")}
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">N+1 Queries Potenciales</h3>
  <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px">
    <p style="font-size:13px;color:#374151;margin:0 0 8px">Se encontraron <b>4 patrones Promise.all en loops</b> en <code>app/buildings/[buildingId]/page.tsx</code> (líneas 2392, 2413, 2432, 6331). Estas son inserciones en paralelo post-mutación, no N+1 en fetch — riesgo bajo para performance pero pueden generar errores en cascada.</p>
    <p style="font-size:13px;color:#374151;margin:0"><b>select("*") encontrado en 15 queries</b> de listas potencialmente grandes (medidores, facturación, pagos). Trae columnas innecesarias en tablas anchas.</p>
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:16px 0 8px">Páginas más pesadas en useState/useEffect</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Página</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">useState</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">useEffect</th>
    </tr></thead>
    <tbody>
      <tr style="background:#FEE2E2"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">buildings/[buildingId]/page.tsx</td><td style="text-align:center;border:1px solid #E2E8F0;font-weight:700">40</td><td style="text-align:center;border:1px solid #E2E8F0">5</td></tr>
      <tr style="background:#FEF3C7"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">purchases/page.tsx</td><td style="text-align:center;border:1px solid #E2E8F0;font-weight:700">21</td><td style="text-align:center;border:1px solid #E2E8F0">1</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">dashboard/page.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">17</td><td style="text-align:center;border:1px solid #E2E8F0">1</td></tr>
      <tr style="background:#fff"><td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace">settings/page.tsx</td><td style="text-align:center;border:1px solid #E2E8F0">15</td><td style="text-align:center;border:1px solid #E2E8F0">4</td></tr>
    </tbody>
  </table>
</section>`;

// ═══════════════ SECCIÓN B — JSON ═══════════════
const sectionJson = `
<section id="json" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">B. Auditoría JSON en Campos de Texto</h2>
  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin-bottom:16px">
    ${statusBadge("pass")} <b style="color:#15803D">Sin datos estructurados guardados como JSON en base de datos.</b> Los usos de JSON.parse/stringify encontrados son todos legítimos: localStorage para drafts del formulario de campo, JSON.parse para API responses en rutas de portal, y JSON.parse/stringify para deep copy de estado de UI en UnitTypeWizardModal.
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Archivo</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Uso</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Tipo</th>
    </tr></thead>
    <tbody>
      <tr style="background:#fff"><td style="padding:6px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">app/campo/tickets/page.tsx</td><td style="padding:6px 12px;border:1px solid #E2E8F0;font-size:12px">localStorage draft del form</td><td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")} OK</td></tr>
      <tr style="background:#F8FAFC"><td style="padding:6px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">app/portal/dashboard, renewal, login</td><td style="padding:6px 12px;border:1px solid #E2E8F0;font-size:12px">API response de rutas /api/portal/*</td><td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")} OK</td></tr>
      <tr style="background:#fff"><td style="padding:6px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">components/UnitTypeWizardModal.tsx</td><td style="padding:6px 12px;border:1px solid #E2E8F0;font-size:12px">Deep copy de DEFAULT_EQ (estado UI)</td><td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")} OK</td></tr>
    </tbody>
  </table>
</section>`;

// ═══════════════ SECCIÓN C — TEMAS ═══════════════
const themeGrid = auditData.themeScreenshots.map((t, i) => `
  <div>
    <div style="font-size:11px;color:#6B7280;margin-bottom:4px;text-align:center">${t.theme} / ${t.dark ? 'dark' : 'light'}</div>
    ${img(t.shot, `${t.theme} ${t.dark ? 'dark' : 'light'}`)}
  </div>`).join("");

const sectionTemas = `
<section id="temas" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">C. Consistencia de Temas y Dark Mode</h2>
  <p style="font-size:13px;color:#6B7280;margin-bottom:16px">6 combinaciones capturadas: clásico, super_soft, rígido × claro/oscuro.</p>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    ${themeGrid}
  </div>
  <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px">
    <p style="font-size:13px;color:#374151;margin:0"><b>Observaciones visuales:</b> Los tres temas responden correctamente a los cambios de data-theme. Dark mode activa correctamente .dark en &lt;html&gt;. Los border-radius cambian visiblemente entre clásico, super_soft y rígido. No se detectaron textos invisibles evidentes en dark mode a primera vista.</p>
  </div>
</section>`;

// ═══════════════ SECCIÓN D — MOBILE ═══════════════
const mobileGrid = auditData.mobileScreenshots.map(m => `
  <div>
    <div style="font-size:11px;color:#6B7280;margin-bottom:4px;text-align:center">Mobile 375px — ${m.page}</div>
    ${img(m.shot, `mobile ${m.page}`)}
  </div>`).join("");

const sectionMobile = `
<section id="mobile" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">D. Mobile / Responsive (375px)</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    ${mobileGrid}
  </div>
  <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px">
    <h4 style="font-size:13px;font-weight:600;margin:0 0 8px">Observaciones mobile:</h4>
    <ul style="font-size:13px;color:#374151;margin:0;padding-left:20px;line-height:1.8">
      <li>Sidebar se oculta correctamente en mobile (drawer off-canvas)</li>
      <li>Grids de cards colapsan a 1 columna</li>
      <li>Breadcrumbs y header de página se adaptan</li>
      <li>El CSS en globals.css tiene reglas responsive bien definidas para mobile</li>
    </ul>
  </div>
</section>`;

// ═══════════════ SECCIÓN E — DATOS ═══════════════
const sectionDatos = `
<section id="datos" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">E. Integridad de Datos</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Query</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Resultado</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      <tr style="background:#fff">
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">SELECT COUNT(*) FROM unit_types WHERE company_id IS NULL</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center;font-weight:700">${supabaseData.unitTypesNoCompany?.count ?? "N/A"}</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")}</td>
      </tr>
      <tr style="background:#F8FAFC">
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">SELECT COUNT(*) FROM collection_records WHERE amount_due &lt;= 0 AND deleted_at IS NULL</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center;font-weight:700;color:#DC2626">${supabaseData.badCollections?.count ?? "N/A"}</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("warn")}</td>
      </tr>
      <tr style="background:#fff">
        <td style="padding:8px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">SELECT folio, COUNT(*) FROM purchase_orders WHERE deleted_at IS NULL GROUP BY folio HAVING COUNT(*) &gt; 1</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center;font-weight:700">${supabaseData.dupeFolios?.length ?? "N/A"} duplicados</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">${statusBadge("pass")}</td>
      </tr>
    </tbody>
  </table>
  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px;margin-top:12px;font-size:13px">
    <b style="color:#B45309">⚠ 12 collection_records con amount_due ≤ 0</b> — registros activos (no eliminados) con monto a cobrar cero o negativo. Requiere revisión manual para determinar si son ajustes intencionales o datos corruptos.
  </div>
</section>`;

// ═══════════════ SECCIÓN F — STORAGE ═══════════════
const sectionStorage = `
<section id="storage" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">F. Storage — Buckets</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
    <thead><tr style="background:#F8FAFC">
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:left">Bucket</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Público</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Límite</th>
      <th style="padding:8px 12px;border:1px solid #E2E8F0;text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      ${(supabaseData.buckets || []).map((b, i) => `<tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
        <td style="padding:6px 12px;border:1px solid #E2E8F0;font-family:monospace;font-size:11px">${b.name}</td>
        <td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center">${b.public ? '🔴 SÍ' : '🟢 NO'}</td>
        <td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center;font-size:11px">${b.file_size_limit ? (b.file_size_limit/1024/1024).toFixed(0)+'MB' : 'Sin límite'}</td>
        <td style="padding:6px 12px;border:1px solid #E2E8F0;text-align:center">${b.public && b.name==='building-documents' ? statusBadge("fail") : b.public ? statusBadge("warn") : statusBadge("pass")}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  <div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px">
    <b style="color:#DC2626">⚠ building-documents es PÚBLICO.</b> Este bucket probablemente contiene contratos y documentos sensibles de inquilinos. Debería ser privado con URLs firmadas de corta duración.
  </div>
  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px">
    <b style="color:#B45309">⚠ building-gallery es PÚBLICO.</b> Aceptable para fotos de edificios (marketing), pero confirmar que no se suben documentos privados ahí.
  </div>
  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px;font-size:13px">
    <b style="color:#B45309">⚠ Bucket "utility-readings" NO EXISTE.</b> Si el módulo de medidores planea guardar fotos de lecturas, este bucket debería crearse.
  </div>
</section>`;

// ═══════════════ SECCIÓN G — ROLES ═══════════════
const sectionRoles = `
<section id="roles" style="margin-bottom:48px">
  <h2 style="font-size:20px;font-weight:700;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:20px">G. Arquitectura de Permisos / Roles</h2>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 12px">Distribución actual de roles</h3>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
    ${Object.entries(supabaseData.roleCounts || {}).map(([role, count]) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;padding:6px 12px;font-size:13px"><b>${count}</b> ${role}</span>`
    ).join("")}
  </div>

  <h3 style="font-size:15px;font-weight:600;color:#374151;margin:0 0 12px">Estado actual del sistema de permisos</h3>
  <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin-bottom:16px">
    <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Mecanismo principal:</b> <code>components/RouteGuard.tsx</code> — client-side protection. Sin middleware SSR de Next.js para proteger rutas en servidor.</p>
    <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Lógica de roles:</b> hardcodeada en RouteGuard (~130 líneas). Cada rol tiene una lista de paths permitidos definida inline. No existe tabla de permisos en BD.</p>
    <p style="font-size:13px;color:#374151;margin:0 0 8px"><b>Roles fijos:</b> superadmin, titular, administracion, directivo, compras, mantenimiento, field, tenant, group_admin. Definidos en <code>UserContext.tsx:12</code>.</p>
    <p style="font-size:13px;color:#374151;margin:0"><b>Sidebar filtering:</b> hay lógica de filtrado de items en Sidebar según rol (hardcoded). Cualquier cambio de permisos requiere editar múltiples archivos.</p>
  </div>

  <pre style="background:#1E2535;color:#E2E8F0;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto"><code>// components/RouteGuard.tsx — Lógica de permisos por rol (hardcoded)
if (user.role === "compras") {
  const allowed = ["/dashboard", "/purchases", "/suppliers"]
  if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/purchases"); return; }
}
// Patrón repetido para cada rol: administracion, mantenimiento, directivo, titular, field, tenant
// ← Sin tabla de permisos, sin granularidad por acción, solo por ruta</code></pre>

  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin-top:12px">
    <b style="color:#15803D">Observación:</b> El sistema actual funciona para los roles existentes. Su principal limitación es que no admite personalización por empresa (diferente empresa → diferentes permisos) y agregar un nuevo rol requiere editar RouteGuard, Sidebar y cualquier check inline. De cara a un futuro sistema granular, la separación de permisos en una tabla BD sería el refactor estructural principal.
  </div>
</section>`;

// ═══════════════ RECOMENDACIONES ═══════════════
const sectionRecs = `
<section id="recs" style="margin-bottom:48px">
  <h2 style="font-size:22px;font-weight:700;color:#0F172A;border-bottom:3px solid #8B2252;padding-bottom:8px;margin-bottom:24px">Recomendaciones por Prioridad</h2>

  <h3 style="font-size:16px;font-weight:700;color:#DC2626;margin:0 0 12px">🔴 Alta Prioridad — Fix puntual, alto impacto</h3>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:28px">

    <div style="background:#FFF;border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">1. Eliminar rebote de login</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> En <code>UserContext.tsx:113</code>, cambiar el callback de onAuthStateChange a <code>(event, session) =></code> y omitir el call a refreshUser cuando event === "INITIAL_SESSION" (ya se cargó en el useEffect del mount). Alternativamente, agregar un debounce de 50ms con useRef para colapsar llamadas consecutivas.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Fix puntual — 1-2h. Sin refactor estructural requerido.</p>
    </div>

    <div style="background:#FFF;border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">2. Eliminar FOUC del color de marca</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Guardar <code>accent_color</code> en localStorage en <code>loadCompanyBranding()</code> (junto a last_user_id). En el useEffect de mount de ThemeProvider, leer y aplicar este valor sincrónicamente antes del primer render. Así --accent siempre tendrá el color correcto desde frame 1.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Fix puntual — 2-3h. Cambios solo en ThemeContext.tsx.</p>
    </div>

    <div style="background:#FFF;border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">F. Convertir building-documents a bucket privado</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Cambiar el bucket a privado en Supabase Dashboard y actualizar el código para generar URLs firmadas (createSignedUrl) con TTL de 60-300 segundos al mostrar documentos.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Fix puntual — 3-4h (configuración + actualizar referencias en UI).</p>
    </div>
  </div>

  <h3 style="font-size:16px;font-weight:700;color:#D97706;margin:0 0 12px">🟡 Media Prioridad — Mejora estructural</h3>
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:28px">

    <div style="background:#FFF;border:1px solid #FDE68A;border-left:4px solid #D97706;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">3. Reemplazar colores hardcodeados por variables CSS</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Refactor por fases: (a) reemplazar todos los #8B2252 inline por var(--accent) — impacto inmediato en recoloración; (b) reemplazar colores semánticos (#10B981, #EF4444) por las variables ya definidas en globals.css; (c) los 749 totales se reducirían a ~100 colores de data/charts que son legítimos.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Refactor estructural por fases — 1-2 semanas. La fase (a) es la más prioritaria y puede hacerse con regex + revisión manual.</p>
    </div>

    <div style="background:#FFF;border:1px solid #FDE68A;border-left:4px solid #D97706;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">5. Corregir animaciones costosas</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Para los 4 componentes con height:auto, reemplazar por maxHeight animado con valor inicial 0 y final calculado, o usar la técnica de clip-path/transform para acordeones. Para progress bars con width, usar transform:scaleX() con transform-origin:left.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Fix por componente — 4-6h total. Los 4 casos de height:auto son los más prioritarios.</p>
    </div>

    <div style="background:#FFF;border:1px solid #FDE68A;border-left:4px solid #D97706;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">A. Optimizar queries con select("*")</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Reemplazar los 15 select("*") en tablas de listas con selects explícitos de solo los campos necesarios. Mayor impacto en medidores, facturación y pagos.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Fix puntual por query — 3-4h total.</p>
    </div>

    <div style="background:#FFF;border:1px solid #FDE68A;border-left:4px solid #D97706;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">E. Revisar 12 collection_records con amount_due ≤ 0</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Query manual en Supabase para identificar estos 12 registros, confirmar si son ajustes intencionales (ej: descuentos del 100%) o datos corruptos. Agregar constraint CHECK(amount_due >= 0) o manejar explícitamente el caso.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Revisión manual — 1-2h.</p>
    </div>
  </div>

  <h3 style="font-size:16px;font-weight:700;color:#16A34A;margin:0 0 12px">🟢 Baja Prioridad — Mejora a largo plazo</h3>
  <div style="display:flex;flex-direction:column;gap:10px">

    <div style="background:#FFF;border:1px solid #BBF7D0;border-left:4px solid #16A34A;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">4. Sistema de spacing tokenizado</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Usar las variables --card-gap y --section-gap ya definidas en lugar de valores inline. Agregar un breakpoint 1024-1280px que reduzca el spacing del contenido principal. Refactor gradual por módulo.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Refactor estructural — 1-2 semanas. Bajo impacto visual en resoluciones estándar, alto impacto en laptops pequeñas.</p>
    </div>

    <div style="background:#FFF;border:1px solid #BBF7D0;border-left:4px solid #16A34A;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">G. Migrar permisos a tabla BD</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Diseñar tabla permissions(role, resource, actions) y mover la lógica de RouteGuard a un hook usePermissions() que lea de esa tabla. Permite personalización por empresa en el futuro. Refactor estructural mayor.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Refactor estructural — 3-4 semanas. Bajo riesgo dado que el sistema actual funciona; priorizar cuando se necesite personalización por empresa.</p>
    </div>

    <div style="background:#FFF;border:1px solid #BBF7D0;border-left:4px solid #16A34A;border-radius:8px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">A. Agregar middleware SSR de Next.js para auth</div>
      <p style="font-size:13px;color:#374151;margin:0 0 6px"><b>Enfoque:</b> Crear middleware.ts en la raíz del proyecto que valide la sesión de Supabase SSR antes de que llegue al cliente. Eliminar la dependencia en RouteGuard client-side para la seguridad de rutas. El RouteGuard quedaría solo para UX redirects.</p>
      <p style="font-size:13px;color:#6B7280;margin:0"><b>Estimación:</b> Mejora de seguridad — 1-2 días. Refuerzo importante pero no crítico dado que el acceso real está controlado por RLS en Supabase.</p>
    </div>
  </div>
</section>`;

// ═══════════════ HTML FINAL ═══════════════
const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SAPROA — Diagnóstico Fase 0 — ${DATE}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; color: #0F172A; }
    code { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; background: #F1F5F9; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
    pre code { background: none; padding: 0; font-size: 12px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    table { border-collapse: collapse; }
    a { color: #2563EB; }
  </style>
</head>
<body>
  ${nav}

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1E2A3A 0%,#2D3A4F 100%);color:#fff;padding:40px 24px 32px">
    <div style="max-width:1200px;margin:0 auto">
      <div style="font-size:12px;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">SAPROA · Diagnóstico Técnico</div>
      <h1 style="font-size:32px;font-weight:800;margin-bottom:8px">Fase 0 — Diagnóstico Previo a Refactor</h1>
      <div style="font-size:14px;color:#94A3B8">Generado el ${DATE} a las ${TIME} · Auditoría de código + Playwright + Supabase</div>
      <div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:16px">
        <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:12px 20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#F87171">2</div>
          <div style="font-size:11px;color:#94A3B8">Problemas Críticos</div>
        </div>
        <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:12px 20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#FCD34D">5+</div>
          <div style="font-size:11px;color:#94A3B8">Advertencias</div>
        </div>
        <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:12px 20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#F87171">749</div>
          <div style="font-size:11px;color:#94A3B8">Colores hardcodeados</div>
        </div>
        <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:12px 20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#FCD34D">3190ms</div>
          <div style="font-size:11px;color:#94A3B8">Dashboard load time</div>
        </div>
        <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:12px 20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#F87171">0</div>
          <div style="font-size:11px;color:#94A3B8">Páginas en &lt;1500ms</div>
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    ${executiveSummary}
    ${section1}
    ${section2}
    ${section3}
    ${section4}
    ${section5}
    ${sectionPerf}
    ${sectionJson}
    ${sectionTemas}
    ${sectionMobile}
    ${sectionDatos}
    ${sectionStorage}
    ${sectionRoles}
    ${sectionRecs}

    <!-- FOOTER -->
    <footer style="border-top:1px solid #E2E8F0;padding-top:24px;font-size:12px;color:#94A3B8;text-align:center">
      SAPROA Diagnóstico Fase 0 · ${DATE} · Metodología: análisis estático de código + Playwright headless + queries Supabase (solo SELECT)
    </footer>
  </div>
</body>
</html>`;

const dateStr = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
const outPath = join(REPORTS_DIR, `saproa-diagnostico-${dateStr}.html`);
writeFileSync(outPath, html);
console.log(`\n✓ Reporte generado: ${outPath}`);
console.log(`  Tamaño: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB`);
