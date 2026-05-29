"use client";

import { useState, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Palette, Sun, Moon, Download,
  Building2, Users, TrendingUp, AlertCircle,
  Plus, Settings, Eye, Loader2,
  Monitor, Tablet, Smartphone, Laptop,
} from "lucide-react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
} from "recharts";

import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import UiButton from "@/components/UiButton";
import AppBadge from "@/components/AppBadge";
import MetricCard from "@/components/MetricCard";
import AppTable from "@/components/AppTable";
import AppSelect from "@/components/AppSelect";
import AppTabs from "@/components/AppTabs";
import EntityCard from "@/components/EntityCard";
import AppEmptyState from "@/components/AppEmptyState";
import MetricCircles from "@/components/MetricCircles";
import Modal from "@/components/Modal";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ThemeOption  = "clasico" | "super_soft" | "rigido";
type ViewportSize = 375 | 768 | 1280 | null;

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACCENT_BASE = { label: "SAPROA indigo", value: "#6366F1", company: "SAPROA" };

const ACCENT_COMPANIES = [
  { label: "Fra-Mar vino",  value: "#8B2252", company: "Fra-Mar" },
  { label: "HEMSA azul",    value: "#0047AB", company: "HEMSA" },
  { label: "MATZ naranja",  value: "#FF6600", company: "MATZ" },
  { label: "ADM rojo",      value: "#CC0000", company: "ADM" },
  { label: "PROMSA gris",   value: "#808080", company: "PROMSA" },
] as const;

const THEME_OPTIONS: { label: string; value: ThemeOption; radiusMd: number }[] = [
  { label: "Super Soft", value: "super_soft", radiusMd: 20 },
  { label: "Clásico",    value: "clasico",    radiusMd: 8  },
  { label: "Rígido",     value: "rigido",     radiusMd: 2  },
];

const VIEWPORT_PRESETS: { label: string; value: ViewportSize; display: string; Icon: React.ElementType }[] = [
  { label: "Móvil",   value: 375,  display: "375px",    Icon: Smartphone },
  { label: "Tablet",  value: 768,  display: "768px",    Icon: Tablet },
  { label: "Laptop",  value: 1280, display: "1280px",   Icon: Laptop },
  { label: "Desktop", value: null, display: "Completo", Icon: Monitor },
];

type TableRow = { id: string; nombre: string; tipo: string; estado: "activo" | "pendiente" | "inactivo" };

const TABLE_ROWS: TableRow[] = [
  { id: "001", nombre: "Torre Reforma 222", tipo: "Oficinas",     estado: "activo" },
  { id: "002", nombre: "Pabellón Polanco",  tipo: "Comercial",    estado: "pendiente" },
  { id: "003", nombre: "Loft Roma Norte",   tipo: "Habitacional", estado: "inactivo" },
];

const TABLE_COLS = [
  { key: "id",     header: "ID",     render: (r: TableRow) => <code style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.id}</code> },
  { key: "nombre", header: "Nombre", render: (r: TableRow) => <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{r.nombre}</strong> },
  { key: "tipo",   header: "Tipo",   render: (r: TableRow) => <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{r.tipo}</span> },
  {
    key: "estado", header: "Estado",
    render: (r: TableRow) => (
      <AppBadge variant={r.estado === "activo" ? "green" : r.estado === "pendiente" ? "amber" : "gray"}>
        {r.estado === "activo" ? "Activo" : r.estado === "pendiente" ? "Pendiente" : "Inactivo"}
      </AppBadge>
    ),
  },
];

const DONUT_DATA = [
  { name: "Ocupados", value: 68 },
  { name: "Vacantes", value: 18 },
  { name: "En obras", value: 9 },
  { name: "Reservas", value: 5 },
];

const BAR_DATA = [
  { mes: "Ene", ingresos: 42000, gastos: 31000 },
  { mes: "Feb", ingresos: 38000, gastos: 28000 },
  { mes: "Mar", ingresos: 51000, gastos: 35000 },
  { mes: "Abr", ingresos: 47000, gastos: 32000 },
  { mes: "May", ingresos: 55000, gastos: 38000 },
];

const METRIC_CIRCLES_DATA = [
  { value: "68%",  label: "Ocupac.",  color: "success" as const },
  { value: "12",   label: "Mant.",    color: "warning" as const },
  { value: "$42k", label: "Ingresos", color: "default" as const },
  { value: "3",    label: "Vacantes", color: "danger"  as const },
  { value: "98%",  label: "Pagos",    color: "success" as const },
  { value: "7",    label: "Tickets",  color: "info"    as const },
];

// ─── CSS vars por modo ────────────────────────────────────────────────────────

const LIGHT_VARS: Record<string, string> = {
  "--bg-page":              "#F1F5F9",
  "--bg-card":              "#FFFFFF",
  "--bg-card-hover":        "#F8FAFC",
  "--bg-input":             "#FFFFFF",
  "--bg-table-header":      "#F8FAFC",
  "--bg-table-empty":       "#F8FAFC",
  "--text-primary":         "#0F172A",
  "--text-secondary":       "#64748B",
  "--text-muted":           "#94A3B8",
  "--text-subtle":          "#CBD5E1",
  "--text-placeholder":     "#CBD5E1",
  "--border-default":       "#E2E8F0",
  "--border-strong":        "#CBD5E1",
  "--border-subtle":        "#F1F5F9",
  "--border-dashed":        "#CBD5E1",
  "--divider":              "#F1F5F9",
  "--shadow-card":          "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
  "--shadow-md":            "0 4px 16px rgba(0,0,0,0.12)",
  "--shadow-lg":            "0 20px 60px rgba(0,0,0,0.25)",
  "--chart-axis":           "#94A3B8",
  "--chart-grid":           "#E2E8F0",
  "--metric-bg-green":      "#F0FDF4",  "--metric-border-green":  "#BBF7D0",  "--metric-value-green":   "#15803D",
  "--metric-bg-amber":      "#FFFBEB",  "--metric-border-amber":  "#FDE68A",  "--metric-value-amber":   "#B45309",
  "--metric-bg-red":        "#FFF1F2",  "--metric-border-red":    "#FECDD3",  "--metric-value-red":     "#B91C1C",
  "--metric-bg-neutral":    "#F8FAFC",  "--metric-border-neutral":"#E2E8F0",  "--metric-value-neutral": "#374151",
  "--metric-bg-blue":       "#EFF6FF",  "--metric-border-blue":   "#BFDBFE",  "--metric-value-blue":    "#1D4ED8",
  "--badge-bg-green":   "#DCFCE7", "--badge-text-green": "#15803D",
  "--badge-bg-amber":   "#FEF3C7", "--badge-text-amber": "#B45309",
  "--badge-bg-red":     "#FEE2E2", "--badge-text-red":   "#B91C1C",
  "--badge-bg-blue":    "#EFF6FF", "--badge-text-blue":  "#1D4ED8",
  "--badge-bg-gray":    "#F1F5F9", "--badge-text-gray":  "#475569",
  "--icon-bg-neutral":  "#F1F5F9", "--icon-color-neutral": "#64748B",
  "--icon-bg-green":    "#DCFCE7", "--icon-color-green":   "#15803D",
  "--icon-bg-amber":    "#FEF3C7", "--icon-color-amber":   "#B45309",
  "--icon-bg-red":      "#FEE2E2", "--icon-color-red":     "#B91C1C",
  "--icon-bg-blue":     "#EFF6FF", "--icon-color-blue":    "#1D4ED8",
};

const DARK_VARS: Record<string, string> = {
  "--bg-page":              "#0F1623",
  "--bg-card":              "#1E2535",
  "--bg-card-hover":        "#243044",
  "--bg-input":             "#243044",
  "--bg-table-header":      "#1A2030",
  "--bg-table-empty":       "#1A2030",
  "--text-primary":         "#F1F5F9",
  "--text-secondary":       "#94A3B8",
  "--text-muted":           "#64748B",
  "--text-subtle":          "#475569",
  "--text-placeholder":     "#475569",
  "--border-default":       "#2D3748",
  "--border-strong":        "#3D4F6A",
  "--border-subtle":        "#2D3748",
  "--border-dashed":        "#2D3748",
  "--divider":              "#2D3748",
  "--shadow-card":          "none",
  "--shadow-md":            "0 4px 16px rgba(0,0,0,0.4)",
  "--shadow-lg":            "0 20px 60px rgba(0,0,0,0.6)",
  "--chart-axis":           "#64748B",
  "--chart-grid":           "#2D3748",
  "--metric-bg-green":      "#052E16",  "--metric-border-green":  "#166534",  "--metric-value-green":   "#4ADE80",
  "--metric-bg-amber":      "#1C1106",  "--metric-border-amber":  "#854D0E",  "--metric-value-amber":   "#FCD34D",
  "--metric-bg-red":        "#1C0507",  "--metric-border-red":    "#9F1239",  "--metric-value-red":     "#F87171",
  "--metric-bg-neutral":    "#1E2535",  "--metric-border-neutral":"#2D3748",  "--metric-value-neutral": "#F1F5F9",
  "--metric-bg-blue":       "#0C1A3A",  "--metric-border-blue":   "#1E40AF",  "--metric-value-blue":    "#60A5FA",
  "--badge-bg-green":   "#052E16", "--badge-text-green": "#4ADE80",
  "--badge-bg-amber":   "#1C1106", "--badge-text-amber": "#FCD34D",
  "--badge-bg-red":     "#1C0507", "--badge-text-red":   "#F87171",
  "--badge-bg-blue":    "#0C1A3A", "--badge-text-blue":  "#60A5FA",
  "--badge-bg-gray":    "#2D3748", "--badge-text-gray":  "#94A3B8",
  "--icon-bg-neutral":    "#2D3748", "--icon-color-neutral":  "#94A3B8",
  "--icon-bg-green":      "#052E16", "--icon-color-green":    "#4ADE80",
  "--icon-bg-amber":      "#1C1106", "--icon-color-amber":    "#FCD34D",
  "--icon-bg-red":        "#1C0507", "--icon-color-red":      "#F87171",
  "--icon-bg-blue":       "#0C1A3A", "--icon-color-blue":     "#60A5FA",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRadiusVars(r: number, theme: ThemeOption): Record<string, string> {
  if (theme === "rigido")     return { "--border-radius-sm": "1px",  "--border-radius-md": "2px",  "--border-radius-lg": "4px",  "--border-radius-xl": "6px"  };
  if (theme === "super_soft") return { "--border-radius-sm": "14px", "--border-radius-md": "20px", "--border-radius-lg": "28px", "--border-radius-xl": "32px" };
  return {
    "--border-radius-sm": `${Math.max(r - 2, 0)}px`,
    "--border-radius-md": `${r}px`,
    "--border-radius-lg": `${Math.min(r + 4, 28)}px`,
    "--border-radius-xl": `${Math.min(r + 8, 32)}px`,
  };
}

function accentLabel(value: string, customColor: string | null): string {
  if (value === ACCENT_BASE.value) return `${ACCENT_BASE.company} — ${value}`;
  const co = ACCENT_COMPANIES.find((o) => o.value === value);
  if (co) return `${co.company} — ${value}`;
  if (customColor === value) return `Custom — ${value}`;
  return value;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CatalogSection({ title, componentNames, children }: {
  title: string; componentNames?: string[]; children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
        {componentNames?.map((n) => (
          <code key={n} style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "var(--border-radius-sm)", background: "var(--bg-table-header)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
            {n}
          </code>
        ))}
      </div>
      {children}
    </section>
  );
}

function CtrlLabel({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ marginBottom: hint ? "2px" : "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>{value}</span>
      </div>
      {hint && <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", margin: "2px 0 6px" }}>{hint}</p>}
    </div>
  );
}

function SkeletonBlock({ width = "100%", height = "12px", delay = "0s" }: { width?: string; height?: string; delay?: string }) {
  return <div style={{ width, height, borderRadius: "var(--border-radius-sm)", background: "var(--border-default)", animation: `ds-pulse 1.5s ease-in-out ${delay} infinite` }} />;
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      <div style={{ width: "40px", height: "40px", flexShrink: 0, borderRadius: "var(--border-radius-md)", background: "var(--border-default)", animation: "ds-pulse 1.5s ease-in-out infinite" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <SkeletonBlock width="60%" height="12px" delay="0.1s" />
        <SkeletonBlock width="40%" height="10px" delay="0.2s" />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

// Panel width constant — used both for the fixed sidebar and the catalog's right padding.
const PANEL_W = 264;

export default function DesignSystemPage() {
  const [radius, setRadius]           = useState(8);
  const [spacing, setSpacing]         = useState(4);
  const [accent, setAccent]           = useState("#6366F1");
  const [theme, setTheme]             = useState<ThemeOption>("clasico");
  const [isDark, setIsDark]           = useState(false);
  const [notes, setNotes]             = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [reportDone, setReportDone]   = useState(false);
  const [activeTab, setActiveTab]     = useState("cards");
  const [viewport, setViewport]       = useState<ViewportSize>(null);
  const [customColor, setCustomColor] = useState<string | null>(null);

  const colorPickerRef = useRef<HTMLInputElement>(null);

  const handleThemeChange = useCallback((t: ThemeOption) => {
    const opt = THEME_OPTIONS.find((o) => o.value === t);
    setTheme(t);
    if (opt) setRadius(opt.radiusMd);
  }, []);

  const handleRadiusChange = useCallback((v: number) => {
    setRadius(v);
    setTheme("clasico");
  }, []);

  const catalogVars: Record<string, string> = {
    ...(isDark ? DARK_VARS : LIGHT_VARS),
    ...computeRadiusVars(radius, theme),
    "--accent":         accent,
    "--btn-primary-bg": accent,
  };

  const themeLabel     = THEME_OPTIONS.find((o) => o.value === theme)?.label ?? theme;
  const viewportPreset = VIEWPORT_PRESETS.find((p) => p.value === viewport) ?? VIEWPORT_PRESETS[3];
  const DONUT_COLORS   = [accent, "#94A3B8", "#FCD34D", "#60A5FA"];

  const handleGenerateReport = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const radiusDisplay = theme === "rigido" ? "1–6px (fijo — tema Rígido)" : theme === "super_soft" ? "14–32px (fijo — tema Super Soft)" : `${radius}px (Clásico custom)`;
    const viewportDisplay = viewport === null ? "Desktop (ancho completo)" : `${viewportPreset.label} — ${viewport}px`;

    const md =
`# Preferencias de diseño — ${dateStr} ${timeStr}

## Controles

- Viewport simulado: ${viewportDisplay}
- Border-radius: ${radiusDisplay}
- Espaciado entre elementos: ${spacing}px
- Color de acento: ${accent} (${accentLabel(accent, customColor)})
- Tema: ${themeLabel}
- Modo: ${isDark ? "Oscuro" : "Claro"}

## Notas de Francisco

${notes.trim() || "(sin notas)"}
`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = `preferencias-diseno-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setReportDone(true);
    setTimeout(() => setReportDone(false), 4000);
  }, [radius, spacing, accent, theme, isDark, notes, viewport, viewportPreset, customColor, themeLabel]);

  // ── catalogVars applied to the fixed panel via inline style ──────────────
  const panelStyle = {
    position: "fixed" as const,
    right: 0,
    top: 0,
    height: "100vh",
    width: `${PANEL_W}px`,
    overflowY: "auto" as const,
    scrollbarWidth: "thin" as const,
    zIndex: 50,
    padding: "18px",
    boxSizing: "border-box" as const,
    // CSS vars applied directly so dark mode / radius / accent work on the panel
    ...(catalogVars as unknown as CSSProperties),
    background: "var(--bg-card)",
    borderLeft: "1px solid var(--border-default)",
    transition: "background 0.3s, border-color 0.3s",
  };

  return (
    // Root wrapper — MainContentWrapper exempts this path from maxWidth:1280, so
    // this div fills the full area between the left sidebar spacer and screen edge.
    <div
      className="ds-page-wrapper"
      style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
    >
      {/* ── CSS local ─── */}
      <style>{`
        .ds-show-circles .metric-circles-mobile-only {
          display: flex !important;
          flex-direction: column !important;
        }
        @keyframes ds-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .ds-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px;
          border-radius: 999px; background: var(--border-default);
          outline: none; cursor: pointer;
        }
        .ds-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--accent); cursor: pointer;
          border: 2px solid var(--bg-card);
          box-shadow: 0 0 0 2px var(--accent);
          transition: transform 0.15s;
        }
        .ds-range::-webkit-slider-thumb:active { transform: scale(1.25); }
        .ds-range::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--accent); cursor: pointer;
          border: 2px solid var(--bg-card);
        }
        /* Mobile: stack vertically, panel goes to top, full right padding */
        @media (max-width: 900px) {
          .ds-page-wrapper { display: flex; flex-direction: column; }
          .ds-controls-sidebar {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            order: -1;
            border-left: none !important;
            border-bottom: 1px solid var(--border-default);
          }
          .ds-catalog-wrapper {
            padding-right: 16px !important;
            order: 0;
          }
        }
      `}</style>

      {/* ── Header con padding estándar ─── */}
      <div style={{ padding: "24px 32px 0", boxSizing: "border-box" }}>
        <PageHeader
          title="Sistema de Diseño"
          subtitle="Sandbox de previsualización — los controles solo afectan este catálogo"
          titleIcon={<Palette size={22} />}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════
          ÁREA DEL CATÁLOGO
          padding-right = PANEL_W + 16px de respiro → el catálogo NUNCA
          se monta bajo el panel fijo, en cualquier ancho de pantalla.
          padding-left = 32px estándar de la app.
      ════════════════════════════════════════════════════════════════ */}
      <div
        className="ds-catalog-wrapper"
        style={{
          padding: `16px ${PANEL_W + 16}px 40px 32px`,
          boxSizing: "border-box",
          ...(catalogVars as unknown as CSSProperties),
          transition: "all 0.3s ease",
        }}
      >

        {/* ── Selector de viewport ─── */}
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>
            Viewport:
          </span>
          <div style={{ display: "flex", gap: "4px", padding: "4px", borderRadius: "var(--border-radius-md)", background: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
            {VIEWPORT_PRESETS.map(({ label, value, display, Icon }) => {
              const active = viewport === value;
              return (
                <button
                  key={label}
                  type="button"
                  title={`Simular ${label} (${display})`}
                  onClick={() => setViewport(value)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    padding: "6px 12px", borderRadius: "var(--border-radius-sm)", border: "none",
                    background: active ? accent : "transparent",
                    color: active ? "#fff" : "var(--text-secondary)",
                    fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                    transition: "all 0.15s", whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 700, color: "var(--accent)", padding: "4px 8px", borderRadius: "var(--border-radius-sm)", background: "var(--bg-table-header)", border: "1px solid var(--border-default)" }}>
            {viewportPreset.display}
          </span>
        </div>

        {/* ── Catálogo restringido al viewport seleccionado ─── */}
        <div style={{ maxWidth: viewport !== null ? `${viewport}px` : "none", margin: "0 auto", transition: "max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1)" }}>
          <div
            className="ds-catalog"
            style={{ padding: "24px", borderRadius: "var(--border-radius-lg)", background: "var(--bg-page)", border: "1px solid var(--border-default)", transition: "background 0.3s, border-color 0.3s", overflow: "hidden" }}
          >

            {/* ── 1. Cards ─── */}
            <CatalogSection title="Cards" componentNames={["MetricCard", "AppCard", "EntityCard"]}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>MetricCard — variantes semánticas</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <MetricCard label="Unidades activas" value="124" icon={<Building2 size={18} />} variant="green" />
                <MetricCard label="Pagos pendientes" value="$18k" icon={<AlertCircle size={18} />} variant="amber" />
                <MetricCard label="Tickets abiertos" value="7" icon={<TrendingUp size={18} />} variant="red" />
                <MetricCard label="Total inquilinos" value="89" icon={<Users size={18} />} variant="neutral" />
                <MetricCard label="Vacantes" value="12" icon={<Eye size={18} />} variant="blue" />
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>AppCard — base genérica</p>
              <AppCard style={{ marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>AppCard genérico</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>Contenedor base con border, background y shadow desde CSS vars.</p>
              </AppCard>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>EntityCard — con métricas y acciones</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                <EntityCard
                  title="Torre Reforma 222" subtitle="Av. Reforma 222, CDMX"
                  badge={<AppBadge variant="green">Activo</AppBadge>}
                  metrics={[{ label: "Unidades", value: 48, color: "var(--metric-value-blue)" }, { label: "Ocupación", value: "92%" }, { label: "Tickets", value: 3, color: "var(--metric-value-amber)" }]}
                  actions={<UiButton variant="secondary" style={{ fontSize: "0.75rem", padding: "6px 10px" }}>Ver</UiButton>}
                />
                <EntityCard
                  title="Pabellón Polanco" subtitle="Masaryk 111, Polanco"
                  badge={<AppBadge variant="amber">Pendiente</AppBadge>}
                  metrics={[{ label: "Unidades", value: 24 }, { label: "Ocupación", value: "78%" }]}
                  actions={<UiButton variant="secondary" style={{ fontSize: "0.75rem", padding: "6px 10px" }}>Ver</UiButton>}
                />
              </div>
            </CatalogSection>

            {/* ── 2. Botones ─── */}
            <CatalogSection title="Botones" componentNames={["UiButton", "AppTabs"]}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
                <UiButton variant="primary" icon={<Plus size={15} />}>Primario</UiButton>
                <UiButton variant="secondary" icon={<Settings size={15} />}>Secundario</UiButton>
                <UiButton variant="ghost" icon={<Eye size={15} />}>Ghost</UiButton>
                <UiButton variant="primary" disabled icon={<Loader2 size={15} />}>Cargando…</UiButton>
                <UiButton variant="secondary" disabled>Deshabilitado</UiButton>
              </div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>AppTabs — navegación horizontal con conteo</p>
              <AppTabs activeKey={activeTab} onChange={setActiveTab} items={[{ key: "cards", label: "Cards", count: 3 }, { key: "botones", label: "Botones", count: 5 }, { key: "tablas", label: "Tablas", count: 1 }, { key: "graficas", label: "Gráficas" }]} />
            </CatalogSection>

            {/* ── 3. Badges ─── */}
            <CatalogSection title="Badges" componentNames={["AppBadge"]}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <AppBadge variant="green">Activo</AppBadge>
                <AppBadge variant="amber">Pendiente</AppBadge>
                <AppBadge variant="red">Vencido</AppBadge>
                <AppBadge variant="blue">Vacante</AppBadge>
                <AppBadge variant="gray">Archivado</AppBadge>
                <AppBadge backgroundColor={accent} textColor="#fff">Acento actual</AppBadge>
              </div>
            </CatalogSection>

            {/* ── 4. Filtros / Pills ─── */}
            <CatalogSection title="Barra de filtros — pills">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {["Todos", "Activos", "Pendientes", "Archivados", "Con deuda", "Sin inquilino"].map((f, i) => (
                  <button key={f} type="button" style={{ padding: "8px 14px", borderRadius: "var(--border-radius-full)", border: i === 0 ? `1px solid ${accent}` : "1px solid var(--border-default)", background: i === 0 ? accent : "var(--bg-card)", color: i === 0 ? "#fff" : "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                    {f}
                  </button>
                ))}
              </div>
            </CatalogSection>

            {/* ── 5. Tablas ─── */}
            <CatalogSection title="Tablas" componentNames={["AppTable"]}>
              <AppTable columns={TABLE_COLS} rows={TABLE_ROWS} minWidth={400} />
            </CatalogSection>

            {/* ── 6. Inputs y selects ─── */}
            <CatalogSection title="Inputs y selects" componentNames={["AppSelect"]}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Campo de texto</label>
                  <input type="text" placeholder="Buscar inmueble…" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Select</label>
                  <AppSelect>
                    <option>Seleccionar tipo</option>
                    <option>Oficinas</option>
                    <option>Comercial</option>
                    <option>Habitacional</option>
                    <option>Industrial</option>
                  </AppSelect>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Deshabilitado</label>
                  <input type="text" disabled value="Solo lectura" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", background: "var(--bg-table-header)", color: "var(--text-muted)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", cursor: "not-allowed", opacity: 0.7 }} />
                </div>
              </div>
            </CatalogSection>

            {/* ── 7. Círculos indicador ─── */}
            <CatalogSection title="Círculos de indicador" componentNames={["MetricCircles"]}>
              <div className="ds-show-circles" style={{ background: "var(--bg-card)", borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border-default)", padding: "16px" }}>
                <MetricCircles metrics={METRIC_CIRCLES_DATA} />
              </div>
            </CatalogSection>

            {/* ── 8. Gráficas ─── */}
            <CatalogSection title="Gráficas" componentNames={["Recharts · PieChart", "Recharts · BarChart"]}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                <AppCard>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Ocupación por estado</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={DONUT_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {DONUT_DATA.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <RechartTooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "0.8125rem" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" }}>
                    {DONUT_DATA.map((d, i) => (
                      <span key={d.name} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: DONUT_COLORS[i % DONUT_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                        {d.name} ({d.value}%)
                      </span>
                    ))}
                  </div>
                </AppCard>

                <AppCard>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Ingresos vs Gastos (MXN)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={BAR_DATA} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                      <RechartTooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "0.8125rem" }} formatter={(v: unknown) => [typeof v === "number" ? `$${v.toLocaleString("es-MX")}` : String(v), ""]} />
                      <Bar dataKey="ingresos" fill={accent} radius={[3, 3, 0, 0]} name="Ingresos" />
                      <Bar dataKey="gastos"   fill="#94A3B8" radius={[3, 3, 0, 0]} name="Gastos" />
                    </BarChart>
                  </ResponsiveContainer>
                </AppCard>
              </div>
            </CatalogSection>

            {/* ── 9. Modales ─── */}
            <CatalogSection title="Modales" componentNames={["Modal"]}>
              <UiButton variant="primary" onClick={() => setShowModal(true)} icon={<Eye size={15} />}>
                Abrir modal de ejemplo
              </UiButton>
              <Modal open={showModal} title="Modal de ejemplo" subtitle="Responde a radius, acento y modo del sandbox" onClose={() => setShowModal(false)} maxWidth="480px">
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "16px", lineHeight: 1.6 }}>Los componentes dentro del modal heredan las CSS vars del sandbox.</p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                  <AppBadge variant="green">Activo</AppBadge>
                  <AppBadge variant="amber">Pendiente</AppBadge>
                  <AppBadge variant="red">Vencido</AppBadge>
                  <AppBadge backgroundColor={accent} textColor="#fff">Acento</AppBadge>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                  <UiButton variant="ghost" onClick={() => setShowModal(false)}>Cancelar</UiButton>
                  <UiButton variant="primary" onClick={() => setShowModal(false)}>Confirmar</UiButton>
                </div>
              </Modal>
            </CatalogSection>

            {/* ── 10. Empty states y loading ─── */}
            <CatalogSection title="Empty states y loading states" componentNames={["AppEmptyState"]}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                <AppEmptyState title="Sin inmuebles registrados" description="Todavía no hay inmuebles en este portafolio. Agrega el primero para comenzar." actionLabel="+ Nuevo inmueble" onAction={() => {}} />
                <AppCard>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "14px" }}>Estado de carga (skeleton)</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <SkeletonRow /><SkeletonRow /><SkeletonRow />
                  </div>
                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <SkeletonBlock width="100%" height="14px" />
                    <SkeletonBlock width="75%"  height="12px" delay="0.15s" />
                    <SkeletonBlock width="55%"  height="12px" delay="0.3s" />
                  </div>
                </AppCard>
              </div>
            </CatalogSection>

          </div>
        </div>
        {/* /viewport-constrained */}
      </div>
      {/* /ds-catalog-wrapper */}

      {/* ════════════════════════════════════════════════════════════════
          PANEL DE CONTROLES — sidebar fija al borde derecho de la pantalla.
          position:fixed + right:0 → siempre pegada al borde, sin importar
          el ancho del viewport ni el maxWidth del contenido central.
          CSS vars aplicadas directamente en panelStyle.
      ════════════════════════════════════════════════════════════════ */}
      <div className="ds-controls-sidebar" style={panelStyle}>

        <h2 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "18px", letterSpacing: "0.01em" }}>
          Controles de previsualización
        </h2>

        {/* ── Border-radius ─── */}
        <div style={{ marginBottom: "18px" }}>
          <CtrlLabel label="Border-radius" value={`${radius}px`} />
          <input type="range" className="ds-range" min={0} max={28} step={1} value={radius} onChange={(e) => handleRadiusChange(Number(e.target.value))} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px" }}>
            <span>0px</span><span>28px</span>
          </div>
        </div>

        {/* ── Espaciado entre elementos ─── */}
        <div style={{ marginBottom: "18px" }}>
          <CtrlLabel label="Espaciado entre elementos" value={`${spacing}px`} hint="Gap entre ítems del catálogo" />
          <input type="range" className="ds-range" min={2} max={8} step={1} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} />
          <div style={{ display: "flex", gap: `${spacing}px`, marginTop: "8px", padding: `${spacing * 2}px`, borderRadius: "var(--border-radius-md)", background: "var(--bg-table-header)", border: "1px dashed var(--border-dashed)", transition: "all 0.2s" }}>
            {[...Array(5)].map((_, i) => <div key={i} style={{ flex: 1, height: "8px", borderRadius: "var(--border-radius-full)", background: accent, opacity: 0.3 + i * 0.15, transition: "all 0.2s" }} />)}
          </div>
        </div>

        <div style={{ height: "1px", background: "var(--border-default)", margin: "4px 0 16px" }} />

        {/* ── Color de acento ─── */}
        <div style={{ marginBottom: "18px" }}>
          <CtrlLabel label="Color de acento" value={accent === ACCENT_BASE.value ? "SAPROA" : ACCENT_COMPANIES.find((o) => o.value === accent)?.company ?? "Custom"} />

          <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Base plataforma</p>
          <div style={{ marginBottom: "10px" }}>
            <button type="button" title={`SAPROA — ${ACCENT_BASE.value}`} onClick={() => setAccent(ACCENT_BASE.value)}
              style={{ width: "32px", height: "32px", borderRadius: "50%", background: ACCENT_BASE.value, border: accent === ACCENT_BASE.value ? "3px solid var(--text-primary)" : "2px solid var(--border-default)", cursor: "pointer", transform: accent === ACCENT_BASE.value ? "scale(1.18)" : "scale(1)", boxShadow: accent === ACCENT_BASE.value ? `0 0 0 3px ${ACCENT_BASE.value}40` : "none", transition: "transform 0.15s, box-shadow 0.15s" }}
            />
          </div>

          <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Empresas</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {ACCENT_COMPANIES.map((opt) => (
              <button key={opt.value} type="button" title={`${opt.company} — ${opt.value}`} onClick={() => setAccent(opt.value)}
                style={{ width: "32px", height: "32px", borderRadius: "50%", background: opt.value, border: accent === opt.value ? "3px solid var(--text-primary)" : "2px solid var(--border-default)", cursor: "pointer", transform: accent === opt.value ? "scale(1.18)" : "scale(1)", boxShadow: accent === opt.value ? `0 0 0 3px ${opt.value}40` : "none", transition: "transform 0.15s, box-shadow 0.15s" }}
              />
            ))}
          </div>

          <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Personalizado (sesión)</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {customColor && (
              <button type="button" title={`Custom — ${customColor}`} onClick={() => setAccent(customColor)}
                style={{ width: "32px", height: "32px", borderRadius: "50%", background: customColor, border: accent === customColor ? "3px solid var(--text-primary)" : "2px solid var(--border-default)", cursor: "pointer", transform: accent === customColor ? "scale(1.18)" : "scale(1)", boxShadow: accent === customColor ? `0 0 0 3px ${customColor}40` : "none", transition: "transform 0.15s, box-shadow 0.15s", flexShrink: 0 }}
              />
            )}
            <button type="button" onClick={() => colorPickerRef.current?.click()} title="Elegir color personalizado"
              style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bg-card)", border: "2px dashed var(--border-strong)", color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "18px", lineHeight: 1, transition: "border-color 0.15s", flexShrink: 0 }}
            >+</button>
            <input ref={colorPickerRef} type="color" value={customColor ?? "#6366F1"}
              onChange={(e) => { setCustomColor(e.target.value); setAccent(e.target.value); }}
              style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
            />
            {customColor && <span style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{customColor}</span>}
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "6px" }}>{accentLabel(accent, customColor)}</p>
        </div>

        <div style={{ height: "1px", background: "var(--border-default)", margin: "4px 0 16px" }} />

        {/* ── Tema ─── */}
        <div style={{ marginBottom: "18px" }}>
          <CtrlLabel label="Tema" value={themeLabel} />
          <div style={{ display: "flex", gap: "4px" }}>
            {THEME_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => handleThemeChange(opt.value)}
                style={{ flex: 1, padding: "7px 2px", fontSize: "0.6875rem", fontWeight: 600, borderRadius: "var(--border-radius-md)", border: theme === opt.value ? `1px solid ${accent}` : "1px solid var(--border-default)", background: theme === opt.value ? accent : "var(--bg-card)", color: theme === opt.value ? "#fff" : "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px" }}>Seleccionar tema mueve el slider al radius correspondiente.</p>
        </div>

        {/* ── Modo claro/oscuro ─── */}
        <div style={{ marginBottom: "18px" }}>
          <CtrlLabel label="Modo" value={isDark ? "Oscuro" : "Claro"} />
          <button type="button" onClick={() => setIsDark(!isDark)}
            style={{ width: "100%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: isDark ? "#1E2535" : "#F8FAFC", color: isDark ? "#F1F5F9" : "#0F172A", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, transition: "all 0.25s" }}
          >
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
            {isDark ? "Modo oscuro" : "Modo claro"}
          </button>
          <div style={{ marginTop: "6px", padding: "5px 8px", borderRadius: "var(--border-radius-sm)", background: isDark ? "rgba(255,193,7,0.1)" : "rgba(99,102,241,0.08)", border: `1px solid ${isDark ? "rgba(255,193,7,0.25)" : "rgba(99,102,241,0.2)"}`, display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "11px" }}>👁</span>
            <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Solo previsualización — no afecta la app</span>
          </div>
        </div>

        <div style={{ height: "1px", background: "var(--border-default)", margin: "4px 0 16px" }} />

        {/* ── Notas ─── */}
        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: me gustó el radius 16px para cards pero no para botones…"
            rows={4}
            style={{ width: "100%", padding: "10px 12px", fontSize: "0.8125rem", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
          />
        </div>

        {/* ── Generar reporte ─── */}
        <UiButton variant="primary" onClick={handleGenerateReport} icon={<Download size={16} />} style={{ width: "100%", justifyContent: "center" }}>
          GENERAR REPORTE
        </UiButton>

        {reportDone && (
          <p style={{ marginTop: "10px", fontSize: "0.75rem", color: "#4ADE80", textAlign: "center", fontWeight: 600 }}>
            ✓ Reporte .md descargado
          </p>
        )}

        <div style={{ marginTop: "14px", padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "var(--bg-table-header)", border: "1px solid var(--border-default)" }}>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            Los controles solo afectan este catálogo — no escriben a la config global.
            El reporte documenta preferencias para decidir después.
          </p>
        </div>

      </div>
      {/* /ds-controls-sidebar */}

    </div>
    // /ds-page-wrapper
  );
}
