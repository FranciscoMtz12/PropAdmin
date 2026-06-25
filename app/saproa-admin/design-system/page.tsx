"use client";

import { useState, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Palette, Sun, Moon, Download,
  Building2, Users, TrendingUp, AlertCircle,
  Plus, Settings, Eye, Loader2,
  Monitor, Tablet, Smartphone, Laptop,
  X, Bell, FileText, Home, Star, Check, CreditCard,
  Menu, ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CHART } from "@/lib/chartColors";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

import PageHeader        from "@/components/PageHeader";
import AppCard           from "@/components/AppCard";
import UiButton          from "@/components/UiButton";
import AppBadge          from "@/components/AppBadge";
import MetricCard        from "@/components/MetricCard";
import AppTable          from "@/components/AppTable";
import AppSelect         from "@/components/AppSelect";
import AppTabs           from "@/components/AppTabs";
import EntityCard        from "@/components/EntityCard";
import AppEmptyState     from "@/components/AppEmptyState";
import MetricCircles     from "@/components/MetricCircles";
import Modal             from "@/components/Modal";
import SectionCard       from "@/components/SectionCard";
import AppGrid           from "@/components/AppGrid";
import BuildingCategoryBadge from "@/components/BuildingCategoryBadge";
import AppFormField      from "@/components/AppFormField";
import SensitiveField    from "@/components/SensitiveField";
import AppStatBar        from "@/components/AppStatBar";
import AppIconBox        from "@/components/AppIconBox";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import WizardShell       from "@/components/WizardShell";
import SpaceTemplateWizardModal from "@/components/SpaceTemplateWizardModal";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ThemeOption = "clasico" | "super_soft" | "rigido";
type FrameType   = "phone" | "tablet" | "none";

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

// min/max del slider de ancho libre
const SLIDER_MIN = 320;
const SLIDER_MAX = 1700;
// marcas de referencia visibles en el slider
const SLIDER_REFS = [1280, 1440, 1600];

const VIEWPORT_PRESETS: { label: string; value: number; Icon: React.ElementType }[] = [
  { label: "Móvil",   value: 375,  Icon: Smartphone },
  { label: "Tablet",  value: 768,  Icon: Tablet },
  { label: "Laptop",  value: 1280, Icon: Laptop },
  { label: "Desktop", value: 1440, Icon: Monitor },
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

const LINE_DATA = [
  { mes: "Ene", ocupacion: 62, ingresos: 42 },
  { mes: "Feb", ocupacion: 65, ingresos: 38 },
  { mes: "Mar", ocupacion: 71, ingresos: 51 },
  { mes: "Abr", ocupacion: 68, ingresos: 47 },
  { mes: "May", ocupacion: 75, ingresos: 55 },
  { mes: "Jun", ocupacion: 78, ingresos: 60 },
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
  "--icon-bg-purple":   "#F3E8FF", "--icon-color-purple":  "#7E22CE",
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
  "--icon-bg-purple":     "#2E1065", "--icon-color-purple":   "#C084FC",
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
  const [open, setOpen] = useState(false);

  return (
    <section
      style={{
        marginBottom: "8px",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <h3 style={{ flex: 1, fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {title}
          {componentNames?.map((n) => (
            <code key={n} style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: "var(--border-radius-sm)", background: "var(--bg-table-header)", color: "var(--text-secondary)", border: "1px solid var(--border-default)", fontWeight: 500 }}>
              {n}
            </code>
          ))}
        </h3>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", color: "var(--text-muted)", flexShrink: 0 }}
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "4px 20px 20px", borderTop: "1px solid var(--border-default)" }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function DsToggle({ label, description, icon, checked, onChange, saving }: {
  label: string; description: string; icon: ReactNode; checked: boolean; onChange: () => void; saving?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: "var(--border-radius-lg)", background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-neutral)", color: "var(--icon-color-neutral)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{label}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={saving}
        style={{ position: "relative", width: 44, height: 24, borderRadius: "var(--border-radius-lg)", border: "none", cursor: saving ? "wait" : "pointer", background: checked ? "var(--accent)" : "var(--border-strong)", transition: "background 0.2s", flexShrink: 0, opacity: saving ? 0.7 : 1 }}
      >
        <span style={{ position: "absolute", top: 2, left: checked ? "calc(100% - 22px)" : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
      </button>
    </div>
  );
}

function DeviceFrame({ type, children }: { type: FrameType; children: ReactNode }) {
  if (type === "none") return <>{children}</>;
  const isPhone = type === "phone";
  return (
    <div style={{
      background: "#16161e",
      borderRadius: isPhone ? "44px" : "28px",
      padding: isPhone ? "16px 6px" : "16px 10px",
      boxShadow: "inset 0 0 0 1px #323245, 0 0 0 3px #0a0a12, 0 28px 72px rgba(0,0,0,0.55)",
      position: "relative",
      userSelect: "none",
    }}>
      {isPhone ? (
        <div style={{ position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)", width: "52px", height: "5px", borderRadius: "3px", background: "#2c2c3e" }} />
      ) : (
        <div style={{ position: "absolute", top: "9px", left: "50%", transform: "translateX(-50%)", width: "9px", height: "9px", borderRadius: "50%", background: "#2c2c3e" }} />
      )}
      <div style={{ borderRadius: isPhone ? "30px" : "16px", overflow: "hidden", marginTop: isPhone ? "8px" : "4px" }}>
        {children}
      </div>
      {isPhone && (
        <div style={{ margin: "10px auto 0", width: "90px", height: "4px", borderRadius: "2px", background: "#2c2c3e" }} />
      )}
    </div>
  );
}

// ─── Paleta de colores — datos ───────────────────────────────────────────────

const CHECKER_BG = "repeating-conic-gradient(#d4d4d4 0% 25%, #f0f0f0 0% 50%) 0 0 / 10px 10px";

type ColorToken  = { token: string; usage: string; transparent?: boolean };
type ColorFamily = { title: string; tokens: ColorToken[] };

const COLOR_FAMILIES: ColorFamily[] = [
  {
    title: "Acento y tints",
    tokens: [
      { token: "--accent",             usage: "Color de marca de la empresa activa. Botones primarios, bordes activos, iconos de acción." },
      { token: "--accent-tint-subtle", usage: "Fondo muy sutil del acento (~5%). Filas seleccionadas, opciones activas de radio/checkbox.", transparent: true },
      { token: "--accent-tint-soft",   usage: "Fondo suave del acento (~10%). Alertas de marca, badges de estado.", transparent: true },
      { token: "--accent-tint-medium", usage: "Fondo medio del acento (~25%). Bordes destacados, selección enfatizada.", transparent: true },
    ],
  },
  {
    title: "Estado de unidad",
    tokens: [
      { token: "--status-occupied",    usage: "Unidad ocupada / contrato activo. StatusCircle verde y borders de limpieza exterior." },
      { token: "--status-vacant",      usage: "Unidad vacante / disponible. StatusCircle azul, borders de áreas comunes." },
      { token: "--status-partial",     usage: "Ocupación parcial. StatusCircle ámbar." },
      { token: "--status-maintenance", usage: "Unidad en mantenimiento o fuera de servicio. StatusCircle rojo." },
      { token: "--status-default",     usage: "Sin estado definido / inactivo. StatusCircle gris." },
    ],
  },
  {
    title: "Prioridad de tickets",
    tokens: [
      { token: "--priority-urgent",      usage: "Dot urgente en listas de tickets." },
      { token: "--priority-urgent-bg",   usage: "Fondo del pill de prioridad urgente." },
      { token: "--priority-urgent-text", usage: "Texto del pill de prioridad urgente." },
      { token: "--priority-high",        usage: "Dot de prioridad alta." },
      { token: "--priority-high-bg",     usage: "Fondo del pill de prioridad alta." },
      { token: "--priority-high-text",   usage: "Texto del pill de prioridad alta." },
      { token: "--priority-medium",      usage: "Dot de prioridad media. También --status-partial." },
      { token: "--priority-medium-bg",   usage: "Fondo del pill de prioridad media." },
      { token: "--priority-medium-text", usage: "Texto del pill de prioridad media." },
      { token: "--priority-low",         usage: "Dot de prioridad baja." },
      { token: "--priority-low-bg",      usage: "Fondo del pill de prioridad baja." },
      { token: "--priority-low-text",    usage: "Texto del pill de prioridad baja." },
    ],
  },
  {
    title: "Semánticos — Error",
    tokens: [
      { token: "--color-error",        usage: "Mensajes de validación, bordes de input inválido, toasts de error." },
      { token: "--color-error-bg",     usage: "Fondo de alertas de error." },
      { token: "--color-error-border", usage: "Borde de alertas y campos con error." },
    ],
  },
  {
    title: "Semánticos — Éxito",
    tokens: [
      { token: "--color-success",        usage: "Badges activos, toasts de éxito, checkmarks." },
      { token: "--color-success-bg",     usage: "Fondo de alertas de éxito." },
      { token: "--color-success-border", usage: "Borde de alertas de éxito." },
      { token: "--color-success-subtle", usage: "Tint muy sutil de verde éxito (~12%). Amenidades, lease activo.", transparent: true },
    ],
  },
  {
    title: "Semánticos — Warning",
    tokens: [
      { token: "--color-warning",        usage: "Badges ámbar, iconos de advertencia." },
      { token: "--color-warning-bg",     usage: "Fondo de alertas de advertencia." },
      { token: "--color-warning-border", usage: "Borde de alertas de advertencia." },
      { token: "--color-warning-text",   usage: "Texto ámbar oscuro. Etiquetas de roles titular/group_admin, iconos de overdue." },
    ],
  },
  {
    title: "Semánticos — Info",
    tokens: [
      { token: "--color-info",        usage: "Links, avisos informativos." },
      { token: "--color-info-bg",     usage: "Fondo de alertas informativas." },
      { token: "--color-info-border", usage: "Borde de alertas informativas." },
      { token: "--color-info-dark",   usage: "Azul oscuro para accentColor de checkboxes, radio buttons, selector de subtipo de edificio." },
    ],
  },
  {
    title: "Charts",
    tokens: [
      { token: "--color-chart-green",  usage: "Verde en Recharts. Cobrado, ocupación, métricas positivas." },
      { token: "--color-chart-blue",   usage: "Azul en Recharts. Disponible, estacionamiento, distribución de área." },
      { token: "--color-chart-orange", usage: "Naranja en Recharts. Pendiente, prioridad alta en gráficas." },
    ],
  },
  {
    title: "Media y especiales",
    tokens: [
      { token: "--color-media",    usage: "Morado para archivos de fotos, status 'Facturada' en compras, ícono de elevador." },
      { token: "--color-media-bg", usage: "Fondo morado sutil. Badge de fotos, background de status invoiced." },
    ],
  },
  {
    title: "Texto",
    tokens: [
      { token: "--text-primary",   usage: "Texto principal, títulos, valores de métricas." },
      { token: "--text-secondary", usage: "Texto secundario, etiquetas de formulario, encabezados de tabla." },
      { token: "--text-muted",     usage: "Texto apagado, placeholders, notas auxiliares." },
    ],
  },
  {
    title: "Fondos",
    tokens: [
      { token: "--bg-page",       usage: "Fondo de página. Canvas principal de la app." },
      { token: "--bg-card",       usage: "Fondo de cards, paneles y modales." },
      { token: "--bg-card-hover", usage: "Fondo de card en hover o estado secundario." },
      { token: "--bg-input",      usage: "Fondo de inputs y selects." },
    ],
  },
  {
    title: "Bordes",
    tokens: [
      { token: "--border-default", usage: "Borde estándar de cards, inputs y tablas." },
      { token: "--border-strong",  usage: "Borde más pronunciado para separaciones importantes." },
      { token: "--border-subtle",  usage: "Borde muy sutil, casi invisible." },
    ],
  },
];

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return rgb;
  const hex = [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, "0")).join("");
  if (m[4] !== undefined) {
    const a = parseFloat(m[4]);
    if (a < 1) return `#${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
  }
  return `#${hex}`;
}

type TipState = { visible: boolean; value: string; resolved: string; x: number; y: number };

function ColorSwatch({ token, usage, transparent }: ColorToken) {
  const [tip, setTip] = useState<TipState>({ visible: false, value: "", resolved: "", x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (!ref.current) return;
    const raw = getComputedStyle(ref.current).getPropertyValue(token).trim();
    const inner = ref.current.querySelector("[data-color-inner]") as HTMLElement | null;
    const resolvedRgb = inner ? getComputedStyle(inner).backgroundColor : "";
    const resolved = resolvedRgb ? rgbToHex(resolvedRgb) : "";
    const rect = ref.current.getBoundingClientRect();
    setTip({ visible: true, value: raw || "—", resolved, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }

  const isComplex = tip.value.includes("(");
  const primaryVal = tip.resolved || tip.value;
  const showRaw = isComplex && !!tip.resolved;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, position: "relative" }}>
      <div
        ref={ref}
        className="ds-color-swatch"
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTip(t => ({ ...t, visible: false }))}
        style={{
          width: 52, height: 52, borderRadius: "var(--border-radius-md)",
          position: "relative", overflow: "hidden",
          border: "1px solid var(--border-default)", cursor: "default", flexShrink: 0,
        }}
      >
        {transparent && <div style={{ position: "absolute", inset: 0, backgroundImage: CHECKER_BG }} />}
        <div data-color-inner style={{ position: "absolute", inset: 0, background: `var(${token})` }} />
      </div>

      <code style={{ fontSize: "0.5rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.3, maxWidth: 68, wordBreak: "break-all" }}>
        {token}
      </code>

      {/* Tooltip — position:fixed para no ser recortado por overflow:hidden del catálogo */}
      {tip.visible && (
        <div className="ds-color-tip" style={{
          position: "fixed", top: tip.y, left: tip.x, transform: "translateX(-50%)",
          zIndex: 9999, background: "var(--bg-card)", border: "1px solid var(--border-default)",
          borderRadius: "var(--border-radius-md)", padding: "10px 12px",
          minWidth: 220, maxWidth: 260, boxShadow: "var(--shadow-md)", pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", top: -5, left: "50%", marginLeft: -5,
            width: 10, height: 10, background: "var(--bg-card)",
            border: "1px solid var(--border-default)", borderBottom: "none", borderRight: "none",
            transform: "rotate(45deg)",
          }} />
          <p style={{ margin: "0 0 5px", fontFamily: "monospace", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {token}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: showRaw ? 3 : 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: `var(${token})`, border: "1px solid var(--border-default)", flexShrink: 0 }} />
            <code style={{ fontSize: "0.5625rem", color: "var(--accent)", lineHeight: 1.4, wordBreak: "break-all" }}>
              {primaryVal}
            </code>
          </div>
          {showRaw && (
            <p style={{ margin: "0 0 6px", fontFamily: "monospace", fontSize: "0.5rem", color: "var(--text-muted)", lineHeight: 1.4, wordBreak: "break-all" }}>
              {tip.value}
            </p>
          )}
          <div style={{ height: 1, background: "var(--border-default)", margin: "4px 0 6px" }} />
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            {usage}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── WizardKit — pasos de demo ───────────────────────────────────────────────

const WK_STEPS = [
  { label: "Datos generales" },
  { label: "Ubicación" },
  { label: "Configuración" },
  { label: "Resumen" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

const PANEL_W = 264;

export default function DesignSystemPage() {
  const [radius, setRadius]           = useState(8);
  const [spacing, setSpacing]         = useState(4);
  const [accent, setAccent]           = useState("#6366F1");
  const [theme, setTheme]             = useState<ThemeOption>("clasico");
  const [isDark, setIsDark]           = useState(false);
  const [notes, setNotes]             = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [showModal640, setShowModal640] = useState(false);
  const [showModal760, setShowModal760] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportDone, setReportDone]   = useState(false);
  const [activeTab, setActiveTab]     = useState("cards");
  const [activeTab2, setActiveTab2]   = useState("resumen");
  const [viewportPx, setViewportPx]   = useState(1440);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [toggle1, setToggle1]         = useState(true);
  const [toggle2, setToggle2]         = useState(false);
  const [wkCreateOpen, setWkCreateOpen] = useState(false);
  const [wkCreateStep, setWkCreateStep] = useState(1);
  const [wkCreateDir, setWkCreateDir]   = useState<"left" | "right">("right");
  const [wkEditOpen, setWkEditOpen]     = useState(false);
  const [wkEditStep, setWkEditStep]     = useState(1);
  const [wkEditDir, setWkEditDir]       = useState<"left" | "right">("right");
  const [stWizardOpen, setStWizardOpen] = useState(false);
  const [stWizardType, setStWizardType] = useState("apartment");
  const TEST_PROPERTY_ID = "0d0553a7-cf0f-4538-b377-975a7d479ad8";
  const TEST_COMPANY_ID  = "2672224b-b1d9-46fc-83b5-7b3f2cab29dd";

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

  const wkCreateNext = useCallback(() => {
    setWkCreateDir("right");
    setWkCreateStep((s) => Math.min(s + 1, WK_STEPS.length));
  }, []);
  const wkCreateBack = useCallback(() => {
    setWkCreateDir("left");
    setWkCreateStep((s) => Math.max(s - 1, 1));
  }, []);
  const wkEditJump = useCallback((target: number) => {
    setWkEditDir((prev) => (target > wkEditStep ? "right" : "left"));
    setWkEditStep(target);
  }, [wkEditStep]);

  const catalogVars: Record<string, string> = {
    ...(isDark ? DARK_VARS : LIGHT_VARS),
    ...computeRadiusVars(radius, theme),
    "--accent":         accent,
    "--btn-primary-bg": accent,
  };

  const themeLabel    = THEME_OPTIONS.find((o) => o.value === theme)?.label ?? theme;
  const matchedPreset = VIEWPORT_PRESETS.find((p) => p.value === viewportPx);
  const frameType: FrameType = viewportPx === 375 ? "phone" : viewportPx === 768 ? "tablet" : "none";
  const inFrame       = frameType !== "none";
  const DONUT_COLORS  = [CHART.positive, CHART.neutral, CHART.warning, CHART.reference];

  const handleGenerateReport = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const radiusDisplay = theme === "rigido" ? "1–6px (fijo — tema Rígido)" : theme === "super_soft" ? "14–32px (fijo — tema Super Soft)" : `${radius}px (Clásico custom)`;
    const matchedP = VIEWPORT_PRESETS.find(p => p.value === viewportPx);
    const viewportDisplay = matchedP ? `${matchedP.label} — ${viewportPx}px` : `Personalizado — ${viewportPx}px`;

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
  }, [radius, spacing, accent, theme, isDark, notes, viewportPx, customColor, themeLabel]);

  const panelStyle: CSSProperties = {
    position: "fixed",
    right: 0,
    top: 0,
    height: "100vh",
    width: `${PANEL_W}px`,
    overflowY: "auto",
    scrollbarWidth: "thin",
    zIndex: 200,
    padding: "18px",
    boxSizing: "border-box",
    ...(catalogVars as unknown as CSSProperties),
    background: "var(--bg-card)",
    borderLeft: "1px solid var(--border-default)",
    transition: "background 0.3s, border-color 0.3s, transform 0.3s ease",
  };

  const labelStyle: CSSProperties = { display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" };
  const inputBase: CSSProperties  = { width: "100%", padding: "10px 12px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" };

  return (
    <div className="ds-page-wrapper" style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <style>{`
        .ds-show-circles .metric-circles-mobile-only {
          display: flex !important;
          flex-direction: column !important;
        }
        @keyframes ds-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes ds-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .ds-spin { animation: ds-spin 1s linear infinite; display: inline-flex; }
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
        /* ── Swatches de color ─── */
        .ds-color-swatch {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ds-color-swatch:hover {
          transform: scale(1.13);
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
          z-index: 1;
        }
        .ds-color-tip {
          animation: ds-tip-in 0.12s ease;
        }
        @keyframes ds-tip-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        /* ── Dispositivos móviles (drawer) ─── */
        @media (max-width: 900px) {
          .ds-page-header { padding: 16px 12px 0 !important; }
          .ds-catalog-wrapper {
            padding-right: 12px !important;
            padding-left: 12px !important;
          }
          .ds-controls-sidebar {
            transform: translateX(100%);
            width: min(85vw, 320px) !important;
            z-index: 200 !important;
          }
          .ds-controls-sidebar.ds-drawer-open {
            transform: translateX(0) !important;
          }
          .ds-hamburger { display: flex !important; }
          .ds-drawer-overlay--open {
            opacity: 1 !important;
            pointer-events: all !important;
          }
          .ds-drawer-close { display: flex !important; }
        }
        @media (min-width: 901px) {
          .ds-controls-sidebar { transform: none !important; }
          .ds-hamburger { display: none !important; }
          .ds-drawer-overlay { display: none !important; }
          .ds-drawer-close { display: none !important; }
        }
      `}</style>

      <div className="ds-page-header" style={{ padding: "24px 32px 0", boxSizing: "border-box" }}>
        <PageHeader
          title="Sistema de Diseño"
          subtitle="Sandbox de previsualización — los controles solo afectan este catálogo"
          titleIcon={<Palette size={22} />}
        />
      </div>

      <div
        className="ds-catalog-wrapper"
        style={{
          padding: `16px ${PANEL_W + 16}px 40px 32px`,
          boxSizing: "border-box",
          ...(catalogVars as unknown as CSSProperties),
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ maxWidth: `${viewportPx}px`, margin: "0 auto", transition: "max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)", transform: "translateZ(0)", position: "relative" }}>
          <DeviceFrame type={frameType}>
          <div
            className="ds-catalog"
            style={{ padding: "24px", borderRadius: inFrame ? 0 : "var(--border-radius-lg)", background: "var(--bg-page)", border: inFrame ? "none" : "1px solid var(--border-default)", transition: "background 0.3s, border-color 0.3s", overflow: "hidden" }}
          >

            {/* ── 0. Paleta de colores ─── */}
            <CatalogSection title="Paleta de colores">
              {COLOR_FAMILIES.map((family) => (
                <div key={family.title} style={{ marginBottom: "22px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {family.title}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 10px" }}>
                    {family.tokens.map((t) => (
                      <ColorSwatch key={t.token} token={t.token} usage={t.usage} transparent={t.transparent} />
                    ))}
                  </div>
                </div>
              ))}
            </CatalogSection>

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

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>MetricCard — con helper (subtexto bajo el valor)</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <MetricCard label="Reserva mant." value="$42k" helper="Actualizado hoy" icon={<TrendingUp size={18} />} variant="green" />
                <MetricCard label="Mora promedio" value="18 días" helper="↑ 3 días vs mes ant." icon={<AlertCircle size={18} />} variant="amber" />
                <MetricCard label="Cobranza" value="94%" helper="Meta: 95%" icon={<Users size={18} />} variant="blue" />
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>AppCard — base genérica</p>
              <AppCard style={{ marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>AppCard genérico</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>Contenedor base con border, background y shadow desde CSS vars.</p>
              </AppCard>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>EntityCard — con métricas y acciones</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
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

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>EntityCard — con statusIndicator (caja visual 72×72 a la derecha)</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                <EntityCard
                  title="Piso 12B" subtitle="Torre Reforma"
                  badge={<AppBadge variant="red">Morosa</AppBadge>}
                  statusIndicator={
                    <div style={{ width: 72, height: 72, borderRadius: "var(--border-radius-md)", background: "var(--metric-bg-red)", border: "1px solid var(--metric-border-red)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                      <AlertCircle size={20} style={{ color: "var(--metric-value-red)" }} />
                      <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--metric-value-red)" }}>$12k</span>
                    </div>
                  }
                  metrics={[{ label: "Meses vencidos", value: 2, color: "var(--metric-value-red)" }]}
                />
                <EntityCard
                  title="Local B-04" subtitle="Pabellón Polanco"
                  badge={<AppBadge variant="green">Al corriente</AppBadge>}
                  statusIndicator={
                    <div style={{ width: 72, height: 72, borderRadius: "var(--border-radius-md)", background: "var(--metric-bg-green)", border: "1px solid var(--metric-border-green)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                      <Check size={20} style={{ color: "var(--metric-value-green)" }} />
                      <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--metric-value-green)" }}>OK</span>
                    </div>
                  }
                  metrics={[{ label: "Renta", value: "$18k", color: "var(--metric-value-green)" }]}
                />
              </div>
            </CatalogSection>

            {/* ── 2. Botones ─── */}
            <CatalogSection title="Botones" componentNames={["UiButton", "AppTabs"]}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Variantes principales</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                <UiButton variant="primary" icon={<Plus size={15} />}>Primario</UiButton>
                <UiButton variant="secondary" icon={<Settings size={15} />}>Secundario</UiButton>
                <UiButton variant="ghost" icon={<Eye size={15} />}>Ghost</UiButton>
                <UiButton variant="secondary" disabled>Deshabilitado</UiButton>
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>UiButton como link (href → &lt;a&gt;)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                <UiButton variant="primary" href="#">Link primario</UiButton>
                <UiButton variant="secondary" href="#" icon={<Eye size={15} />}>Ver detalle</UiButton>
                <UiButton variant="ghost" href="#">Ghost link</UiButton>
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>UiButton loading (spinner animado, disabled)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
                <UiButton variant="primary" disabled icon={<span className="ds-spin"><Loader2 size={15} /></span>}>Guardando…</UiButton>
                <UiButton variant="secondary" disabled icon={<span className="ds-spin"><Loader2 size={15} /></span>}>Cargando…</UiButton>
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>AppTabs — con conteo</p>
              <div style={{ marginBottom: "16px" }}>
                <AppTabs activeKey={activeTab} onChange={setActiveTab} items={[{ key: "cards", label: "Cards", count: 3 }, { key: "botones", label: "Botones", count: 5 }, { key: "tablas", label: "Tablas", count: 1 }, { key: "graficas", label: "Gráficas" }]} />
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>AppTabs — con ícono, notifDot y pendingDot</p>
              <AppTabs activeKey={activeTab2} onChange={setActiveTab2} items={[
                { key: "resumen", label: "Resumen",  icon: <Home size={14} /> },
                { key: "pagos",   label: "Pagos",    icon: <CreditCard size={14} />, count: 4 },
                { key: "docs",    label: "Docs",     icon: <FileText size={14} />,   notifDot: { count: 2, color: "#ef4444" } },
                { key: "notas",   label: "Notas",    icon: <Star size={14} />,       pendingDot: true },
              ]} />
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
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Con datos</p>
              <div style={{ marginBottom: "16px" }}>
                <AppTable columns={TABLE_COLS} rows={TABLE_ROWS} minWidth={400} />
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Empty state — borde dashed (default)</p>
              <div style={{ marginBottom: "16px" }}>
                <AppTable columns={TABLE_COLS} rows={[]} minWidth={400} />
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Empty state custom + minWidth=0 (para grids estrechos)</p>
              <AppTable
                columns={TABLE_COLS.slice(0, 2)}
                rows={[]}
                minWidth={0}
                emptyState={
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <Building2 size={28} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-secondary)" }}>Sin inmuebles</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Agrega uno para comenzar.</p>
                  </div>
                }
              />
            </CatalogSection>

            {/* ── 6. Inputs y selects ─── */}
            <CatalogSection title="Inputs y selects" componentNames={["AppSelect"]}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Estados base</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={labelStyle}>Campo de texto</label>
                  <input type="text" placeholder="Buscar inmueble…" style={inputBase} />
                </div>
                <div>
                  <label style={labelStyle}>Select</label>
                  <AppSelect>
                    <option>Seleccionar tipo</option>
                    <option>Oficinas</option>
                    <option>Comercial</option>
                    <option>Habitacional</option>
                    <option>Industrial</option>
                  </AppSelect>
                </div>
                <div>
                  <label style={labelStyle}>Deshabilitado</label>
                  <input type="text" disabled value="Solo lectura" style={{ ...inputBase, background: "var(--bg-table-header)", color: "var(--text-muted)", cursor: "not-allowed", opacity: 0.7 }} />
                </div>
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Input — focus (borde acento) y error (borde rojo + mensaje)</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={labelStyle}>Focus</label>
                  <input type="text" defaultValue="Av. Reforma 222" style={{ ...inputBase, border: `2px solid ${accent}`, outline: "none" }} />
                </div>
                <div>
                  <label style={labelStyle}>Error</label>
                  <input type="text" defaultValue="correo-invalido" style={{ ...inputBase, border: "2px solid var(--badge-text-red)" }} />
                  <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--badge-text-red)", fontWeight: 600 }}>Formato de correo inválido</p>
                </div>
              </div>

              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>AppSelect — disabled y error (override via style prop)</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Select disabled</label>
                  <AppSelect disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
                    <option>Seleccionar tipo</option>
                  </AppSelect>
                </div>
                <div>
                  <label style={labelStyle}>Select error</label>
                  <AppSelect style={{ border: "2px solid var(--badge-text-red)" }}>
                    <option>— Elige una opción —</option>
                    <option>Oficinas</option>
                  </AppSelect>
                  <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--badge-text-red)", fontWeight: 600 }}>Campo requerido</p>
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
            <CatalogSection title="Gráficas" componentNames={["Recharts · PieChart", "Recharts · BarChart", "Recharts · LineChart"]}>
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
                      <Bar dataKey="ingresos" fill={CHART.positive} radius={[3, 3, 0, 0]} name="Ingresos" />
                      <Bar dataKey="gastos"   fill="#94A3B8" radius={[3, 3, 0, 0]} name="Gastos" />
                    </BarChart>
                  </ResponsiveContainer>
                </AppCard>

                <AppCard>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Evolución mensual — LineChart</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={LINE_DATA} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <RechartTooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "0.8125rem" }} />
                      <Legend wrapperStyle={{ fontSize: "0.75rem", color: "var(--text-secondary)" }} />
                      <Line type="monotone" dataKey="ocupacion" stroke={CHART.positive} strokeWidth={2} dot={{ fill: CHART.positive, r: 4 }} name="Ocupación %" />
                      <Line type="monotone" dataKey="ingresos"  stroke={CHART.reference}  strokeWidth={2} dot={{ fill: CHART.reference,  r: 4 }} name="Ingresos k" />
                    </LineChart>
                  </ResponsiveContainer>
                </AppCard>
              </div>
            </CatalogSection>

            {/* ── 9. Modales ─── */}
            <CatalogSection title="Modales" componentNames={["Modal", "DeleteConfirmModal"]}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                <UiButton variant="secondary" onClick={() => setShowModal(true)}>Modal 480px</UiButton>
                <UiButton variant="secondary" onClick={() => setShowModal640(true)}>Modal 640px</UiButton>
                <UiButton variant="secondary" onClick={() => setShowModal760(true)}>Modal 760px (default)</UiButton>
                <UiButton variant="secondary" icon={<AlertCircle size={15} />} onClick={() => setShowDeleteModal(true)}>DeleteConfirmModal</UiButton>
              </div>

              <Modal open={showModal} title="Modal de ejemplo" subtitle="maxWidth='480px' — responde a radius, acento y modo" onClose={() => setShowModal(false)} maxWidth="480px">
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

              <Modal open={showModal640} title="Modal 640px" subtitle="maxWidth='640px'" onClose={() => setShowModal640(false)} maxWidth="640px">
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>Ancho intermedio para formularios de media complejidad.</p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                  <UiButton variant="ghost" onClick={() => setShowModal640(false)}>Cancelar</UiButton>
                  <UiButton variant="primary" onClick={() => setShowModal640(false)}>Confirmar</UiButton>
                </div>
              </Modal>

              <Modal open={showModal760} title="Modal 760px (default)" subtitle="maxWidth='760px' — ancho por defecto del componente Modal" onClose={() => setShowModal760(false)} maxWidth="760px">
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>Ancho default para formularios complejos y wizards.</p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                  <UiButton variant="ghost" onClick={() => setShowModal760(false)}>Cancelar</UiButton>
                  <UiButton variant="primary" onClick={() => setShowModal760(false)}>Confirmar</UiButton>
                </div>
              </Modal>

              <DeleteConfirmModal
                open={showDeleteModal}
                title="Eliminar inmueble"
                description="¿Confirmas que deseas eliminar 'Torre Reforma 222'? El registro se ocultará del sistema."
                onConfirm={() => setShowDeleteModal(false)}
                onCancel={() => setShowDeleteModal(false)}
              />
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

            {/* ── 11. SectionCard ─── */}
            <CatalogSection title="SectionCard" componentNames={["SectionCard"]}>
              <div style={{ display: "grid", gap: "16px" }}>
                <SectionCard title="Sección básica" subtitle="Subtítulo descriptivo (visible cuando showDescriptions=true en la app)">
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Contenido de la sección. Usa AppCard internamente con padding 24px.
                  </p>
                </SectionCard>
                <SectionCard
                  title="Con ícono y acción"
                  subtitle="El ícono va en AppIconBox variant=neutral; la acción al extremo derecho del header"
                  icon={<Building2 size={20} />}
                  action={<UiButton variant="primary" icon={<Plus size={14} />}>Nuevo</UiButton>}
                >
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    SectionCard es el wrapper estándar para secciones, formularios y listas de la app.
                  </p>
                </SectionCard>
              </div>
            </CatalogSection>

            {/* ── 12. AppGrid ─── */}
            <CatalogSection title="AppGrid" componentNames={["AppGrid"]}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>minWidth=200 — auto-fit responsive</p>
              <AppGrid minWidth={200} gap={12} style={{ marginBottom: "16px" }}>
                {["Item A", "Item B", "Item C", "Item D", "Item E", "Item F"].map((label) => (
                  <AppCard key={label}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", textAlign: "center" }}>{label}</p>
                  </AppCard>
                ))}
              </AppGrid>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>minWidth=100 — más columnas en el mismo ancho</p>
              <AppGrid minWidth={100} gap={8}>
                {["1","2","3","4","5","6","7","8"].map((n) => (
                  <div key={n} style={{ padding: "10px", borderRadius: "var(--border-radius-md)", background: "var(--metric-bg-blue)", border: "1px solid var(--metric-border-blue)", textAlign: "center", fontSize: "0.875rem", fontWeight: 700, color: "var(--metric-value-blue)" }}>{n}</div>
                ))}
              </AppGrid>
            </CatalogSection>

            {/* ── 13. BuildingCategoryBadge ─── */}
            <CatalogSection title="BuildingCategoryBadge" componentNames={["BuildingCategoryBadge"]}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <BuildingCategoryBadge category="residential" />
                <BuildingCategoryBadge category="commercial" />
                <BuildingCategoryBadge category="industrial" />
                <BuildingCategoryBadge category="mixed_use" />
                <BuildingCategoryBadge category="house" />
                <BuildingCategoryBadge category="land" />
                <BuildingCategoryBadge category={null} />
              </div>
            </CatalogSection>

            {/* ── 14. AppFormField ─── */}
            <CatalogSection title="AppFormField" componentNames={["AppFormField"]}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0 16px" }}>
                <AppFormField label="Campo básico">
                  <input type="text" placeholder="Nombre del inmueble…" style={inputBase} />
                </AppFormField>
                <AppFormField label="Con helper text" helperText="Máximo 12 caracteres alfanuméricos.">
                  <input type="text" placeholder="RFC…" style={inputBase} />
                </AppFormField>
                <AppFormField label="Requerido con error" required error="Este campo es requerido.">
                  <input type="text" placeholder="Dirección…" style={{ ...inputBase, border: "2px solid var(--badge-text-red)" }} />
                </AppFormField>
              </div>
            </CatalogSection>

            {/* ── 15. SensitiveField ─── */}
            <CatalogSection title="SensitiveField" componentNames={["SensitiveField"]}>
              <AppCard>
                <div style={{ display: "grid", gap: "10px" }}>
                  {([
                    { label: "RFC",             type: "rfc"     as const, value: "MATF850101AB3" },
                    { label: "Teléfono",        type: "phone"   as const, value: "5512345678" },
                    { label: "Email",           type: "email"   as const, value: "francisco@empresa.com" },
                    { label: "Cuenta bancaria", type: "bank"    as const, value: "1234567890123456" },
                    { label: "Genérico",        type: "generic" as const, value: "dato-sensitivo-xyz123" },
                  ]).map(({ label, type, value }) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", minWidth: 130 }}>{label}</span>
                      <SensitiveField value={value} type={type} />
                    </div>
                  ))}
                </div>
              </AppCard>
            </CatalogSection>

            {/* ── 16. AppStatBar ─── */}
            <CatalogSection title="AppStatBar" componentNames={["AppStatBar"]}>
              <div style={{ display: "grid", gap: "16px" }}>
                <AppStatBar
                  title="Ocupación del portafolio"
                  segments={[
                    { label: "Ocupadas", value: 68, color: accent },
                    { label: "Vacantes", value: 18, color: "#94A3B8" },
                    { label: "En obras", value: 9,  color: "#f59e0b" },
                    { label: "Reservas", value: 5,  color: "#60a5fa" },
                  ]}
                />
                <AppStatBar
                  title="Estado de contratos"
                  totalLabel="89 contratos"
                  segments={[
                    { label: "Vigentes",    value: 72, color: "#22c55e" },
                    { label: "Por vencer",  value: 11, color: "#f59e0b" },
                    { label: "Vencidos",    value: 6,  color: "#ef4444" },
                  ]}
                />
              </div>
            </CatalogSection>

            {/* ── 17. AppIconBox ─── */}
            <CatalogSection title="AppIconBox" componentNames={["AppIconBox"]}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>6 variantes semánticas (size=44 default)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
                {([
                  { variant: "neutral" as const, icon: <Settings size={20} /> },
                  { variant: "green"   as const, icon: <Check size={20} /> },
                  { variant: "amber"   as const, icon: <AlertCircle size={20} /> },
                  { variant: "red"     as const, icon: <X size={20} /> },
                  { variant: "blue"    as const, icon: <Bell size={20} /> },
                  { variant: "purple"  as const, icon: <Star size={20} /> },
                ]).map(({ variant, icon }) => (
                  <div key={variant} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <AppIconBox variant={variant}>{icon}</AppIconBox>
                    <code style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>{variant}</code>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>Distintos size y radius</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
                <AppIconBox variant="blue"    size={28} radius={6}><Bell size={14} /></AppIconBox>
                <AppIconBox variant="green"   size={36} radius={10}><Check size={16} /></AppIconBox>
                <AppIconBox variant="amber"   size={44} radius={14}><AlertCircle size={18} /></AppIconBox>
                <AppIconBox variant="neutral" size={56} radius={18}><Settings size={22} /></AppIconBox>
                <AppIconBox variant="red"     size={44} radius="50%"><X size={18} /></AppIconBox>
                <AppIconBox variant="purple"  size={44} radius="var(--border-radius-xl)"><Star size={18} /></AppIconBox>
              </div>
            </CatalogSection>

            {/* ── 18. Toggle / Switch ─── */}
            <CatalogSection title="Toggle / Switch" componentNames={["SettingsModal → ToggleRow"]}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Componente interno de SettingsModal. La función <code style={{ fontSize: "0.6875rem" }}>ToggleRow</code> no está exportada; se replica aquí como <code style={{ fontSize: "0.6875rem" }}>DsToggle</code>.
              </p>
              <AppCard>
                <div style={{ display: "grid", gap: "8px" }}>
                  <DsToggle
                    label="Modo oscuro"
                    description="Cambiar entre tema claro y oscuro"
                    icon={<Moon size={15} />}
                    checked={toggle1}
                    onChange={() => setToggle1((v) => !v)}
                  />
                  <DsToggle
                    label="Mostrar descripciones"
                    description="Subtítulos grises bajo los títulos de sección"
                    icon={<FileText size={15} />}
                    checked={toggle2}
                    onChange={() => setToggle2((v) => !v)}
                  />
                  <DsToggle
                    label="Estado saving / disabled"
                    description="opacity 0.7, cursor wait"
                    icon={<Settings size={15} />}
                    checked={false}
                    onChange={() => {}}
                    saving
                  />
                </div>
              </AppCard>
            </CatalogSection>

            {/* ── 19. Checkbox ─── */}
            <CatalogSection title="Checkbox" componentNames={["<input type='checkbox'>"]}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                No existe un componente AppCheckbox — se usa el elemento nativo con <code style={{ fontSize: "0.6875rem" }}>accentColor: accent</code> para respetar el color de tema.
              </p>
              <AppCard>
                <div style={{ display: "grid", gap: "12px" }}>
                  {([
                    { label: "Opción sin marcar",              checked: false, disabled: false },
                    { label: "Opción marcada",                 checked: true,  disabled: false },
                    { label: "Deshabilitada sin marcar",       checked: false, disabled: true  },
                    { label: "Deshabilitada y marcada",        checked: true,  disabled: true  },
                  ]).map(({ label, checked, disabled }, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
                      <input
                        type="checkbox"
                        defaultChecked={checked}
                        disabled={disabled}
                        style={{ width: 18, height: 18, accentColor: accent, cursor: disabled ? "not-allowed" : "pointer" }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: checked ? 600 : 400 }}>{label}</span>
                    </label>
                  ))}
                </div>
              </AppCard>
            </CatalogSection>

            {/* ── 20. Toast / Notificación ─── */}
            <CatalogSection title="Toast / Notificación" componentNames={["react-hot-toast"]}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Apariencia visual estática. En la app se disparan con <code style={{ fontSize: "0.6875rem" }}>toast.success()</code> / <code style={{ fontSize: "0.6875rem" }}>toast.error()</code>.
              </p>
              <div style={{ display: "grid", gap: "10px", maxWidth: 380 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-md)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--metric-bg-green)", border: "1px solid var(--metric-border-green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={14} style={{ color: "var(--metric-value-green)" }} />
                  </div>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>Guardado correctamente</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-md)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--metric-bg-red)", border: "1px solid var(--metric-border-red)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X size={14} style={{ color: "var(--metric-value-red)" }} />
                  </div>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>Error al guardar los cambios</span>
                </div>
              </div>
            </CatalogSection>

            {/* ── 21. ImpersonationBanner + GroupBanner ─── */}
            <CatalogSection title="ImpersonationBanner + GroupBanner" componentNames={["ImpersonationBanner", "GroupBanner"]}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Ambos componentes requieren ImpersonationContext activo y retornan <code style={{ fontSize: "0.6875rem" }}>null</code> sin él. Se muestra su apariencia visual estática.
              </p>
              <div style={{ display: "grid", gap: "12px" }}>
                {/* ImpersonationBanner — visual estática */}
                <div style={{ background: "var(--accent-tint-soft)", border: "1px solid var(--accent-tint-medium)", borderRadius: "var(--border-radius-md)", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1", flexShrink: 0 }} />
                  <Eye size={14} color="#6366F1" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: "0.8125rem", color: "#6366F1", fontWeight: 600, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Vista simulada · Fra-Mar · Administración (admin@fra-mar.mx)
                  </span>
                  <button type="button" style={{ padding: "4px 10px", borderRadius: "var(--border-radius-sm)", border: "1px solid rgba(99,102,241,0.4)", background: "transparent", color: "#6366F1", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Salir de vista simulada
                  </button>
                </div>

                {/* GroupBanner — visual estática */}
                <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "var(--border-radius-md)", padding: "9px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#C9A84C", whiteSpace: "nowrap" }}>Grupo MATZ</span>
                  <div style={{ width: 1, height: 22, background: "rgba(201,168,76,0.3)", flexShrink: 0 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {[
                      { label: "MT", color: "#FF6600", active: true  },
                      { label: "SA", color: "#6366F1", active: true  },
                      { label: "PM", color: "#808080", active: false },
                    ].map((co) => (
                      <div key={co.label} style={{ width: 26, height: 26, borderRadius: "50%", background: co.color, display: "flex", alignItems: "center", justifyContent: "center", opacity: co.active ? 1 : 0.3, border: co.active ? "2px solid rgba(255,255,255,0.35)" : "2px solid transparent", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.5625rem", fontWeight: 700, color: "#fff", userSelect: "none" }}>{co.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CatalogSection>

            {/* ── 22. WizardKit ─── */}
            <CatalogSection title="WizardKit" componentNames={["WizardShell"]}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                <code style={{ fontSize: "0.6875rem" }}>WizardShell</code> soporta dos modos.{" "}
                <strong>Crear</strong>: flujo lineal, pasos bloqueados, footer con ← Atrás / Siguiente → / acción final.{" "}
                <strong>Editar</strong>: pasos clickeables, hint de navegación libre, footer con Cerrar + Guardar cambios.
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <UiButton
                  variant="primary"
                  type="button"
                  onClick={() => { setWkCreateStep(1); setWkCreateDir("right"); setWkCreateOpen(true); }}
                >
                  Abrir modo crear →
                </UiButton>
                <UiButton
                  variant="secondary"
                  type="button"
                  onClick={() => { setWkEditStep(2); setWkEditDir("right"); setWkEditOpen(true); }}
                >
                  Abrir modo editar (paso 2) →
                </UiButton>
              </div>

              {/* Wizard crear */}
              <WizardShell
                open={wkCreateOpen}
                title="Nueva propiedad"
                steps={WK_STEPS}
                currentStep={wkCreateStep}
                stepDir={wkCreateDir}
                mode="create"
                onNext={wkCreateNext}
                onBack={wkCreateBack}
                onCancel={() => setWkCreateOpen(false)}
                onFinish={() => setWkCreateOpen(false)}
                finalLabel="Crear propiedad"
              >
                {wkCreateStep === 1 && (
                  <div style={{ display: "grid", gap: 16 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Datos generales</p>
                    {[["Nombre de la propiedad", "Ej. Torre Reforma 222"], ["Código interno", "Ej. TRF-01"]].map(([label, placeholder]) => (
                      <div key={label}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
                        <div style={{ height: 40, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: "0 12px", display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-placeholder)" }}>{placeholder}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[["Tipo", "Oficinas"], ["Categoría", "Clase A"]].map(([label, placeholder]) => (
                        <div key={label}>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
                          <div style={{ height: 40, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.8125rem", color: "var(--text-placeholder)" }}>{placeholder}</span>
                            <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {wkCreateStep === 2 && (
                  <div style={{ display: "grid", gap: 16 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Ubicación</p>
                    {[["Dirección", "Ej. Paseo de la Reforma 222"], ["Ciudad", "Ciudad de México"], ["Código postal", "06600"]].map(([label, placeholder]) => (
                      <div key={label}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
                        <div style={{ height: 40, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: "0 12px", display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-placeholder)" }}>{placeholder}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {wkCreateStep === 3 && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Configuración</p>
                    {[
                      { label: "Acepta mascotas",  checked: true  },
                      { label: "Área de fumadores", checked: false },
                      { label: "Acceso 24 hrs",    checked: true  },
                      { label: "Estacionamiento",  checked: false },
                    ].map(({ label, checked }) => (
                      <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" defaultChecked={checked} style={{ width: 18, height: 18, accentColor: accent, cursor: "pointer" }} />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {wkCreateStep === 4 && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Resumen</p>
                    <div style={{ borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border-default)", background: "var(--bg-table-header)", overflow: "hidden" }}>
                      {[
                        ["Nombre", "Torre Reforma 222"],
                        ["Código", "TRF-01"],
                        ["Tipo", "Oficinas · Clase A"],
                        ["Dirección", "Paseo de la Reforma 222, CDMX 06600"],
                        ["Extras", "Acepta mascotas · Acceso 24 hrs"],
                      ].map(([k, v], idx, arr) => (
                        <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "10px 16px", borderBottom: idx < arr.length - 1 ? "1px solid var(--border-default)" : "none" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>{k}</span>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </WizardShell>

              {/* Wizard editar */}
              <WizardShell
                open={wkEditOpen}
                title="Editar propiedad — Torre Reforma 222"
                steps={WK_STEPS}
                currentStep={wkEditStep}
                stepDir={wkEditDir}
                mode="edit"
                onNext={() => {}}
                onBack={() => {}}
                onCancel={() => setWkEditOpen(false)}
                onFinish={() => {}}
                onSave={() => setWkEditOpen(false)}
                onStepChange={wkEditJump}
              >
                {wkEditStep === 1 && (
                  <div style={{ display: "grid", gap: 16 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Datos generales</p>
                    {[["Nombre de la propiedad", "Torre Reforma 222"], ["Código interno", "TRF-01"]].map(([label, value]) => (
                      <div key={label}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
                        <div style={{ height: 40, borderRadius: "var(--border-radius-md)", border: `1px solid ${accent}`, background: "var(--bg-input)", padding: "0 12px", display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {wkEditStep === 2 && (
                  <div style={{ display: "grid", gap: 16 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Ubicación</p>
                    {[["Dirección", "Paseo de la Reforma 222"], ["Ciudad", "Ciudad de México"], ["Código postal", "06600"]].map(([label, value]) => (
                      <div key={label}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
                        <div style={{ height: 40, borderRadius: "var(--border-radius-md)", border: `1px solid ${accent}`, background: "var(--bg-input)", padding: "0 12px", display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {wkEditStep === 3 && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Configuración</p>
                    {[
                      { label: "Acepta mascotas",  checked: true  },
                      { label: "Área de fumadores", checked: false },
                      { label: "Acceso 24 hrs",    checked: true  },
                      { label: "Estacionamiento",  checked: false },
                    ].map(({ label, checked }) => (
                      <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" defaultChecked={checked} style={{ width: 18, height: 18, accentColor: accent, cursor: "pointer" }} />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {wkEditStep === 4 && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Resumen</p>
                    <div style={{ borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border-default)", background: "var(--bg-table-header)", overflow: "hidden" }}>
                      {[
                        ["Nombre", "Torre Reforma 222"],
                        ["Código", "TRF-01"],
                        ["Tipo", "Oficinas · Clase A"],
                        ["Dirección", "Paseo de la Reforma 222, CDMX 06600"],
                        ["Extras", "Acepta mascotas · Acceso 24 hrs"],
                      ].map(([k, v], idx, arr) => (
                        <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "10px 16px", borderBottom: idx < arr.length - 1 ? "1px solid var(--border-default)" : "none" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>{k}</span>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </WizardShell>
            </CatalogSection>

            {/* ── 23. SpaceTemplateWizardModal ─── */}
            <CatalogSection title="SpaceTemplateWizardModal" componentNames={["SpaceTemplateWizardModal"]}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: 1.6 }}>
                Wizard de Fase 4 Pieza 1-A. Crea/edita <code>space_templates</code> con perfil residencial (apartment / loft / house).
                Tipos no residenciales muestran el placeholder "perfil en construcción".
                Datos guardados en <code>space_templates</code> + <code>space_template_assets</code>.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {[
                  { type: "apartment", label: "Departamento" },
                  { type: "loft",      label: "Loft"         },
                  { type: "house",     label: "Casa"         },
                  { type: "warehouse",        label: "Bodega"           },
                  { type: "office",           label: "Oficina"          },
                  { type: "commercial_local", label: "Local comercial"  },
                  { type: "unknown_type",     label: "Tipo desconocido" },
                ].map(({ type, label }) => (
                  <UiButton
                    key={type}
                    type="button"
                    variant={type === "unknown_type" ? "ghost" : "secondary"}
                    onClick={() => { setStWizardType(type); setStWizardOpen(true); }}
                  >
                    {label}
                  </UiButton>
                ))}
              </div>
              <SpaceTemplateWizardModal
                open={stWizardOpen}
                propertyId={TEST_PROPERTY_ID}
                companyId={TEST_COMPANY_ID}
                spaceType={stWizardType}
                onClose={() => setStWizardOpen(false)}
                onSuccess={() => { setStWizardOpen(false); }}
              />
            </CatalogSection>

          </div>
          </DeviceFrame>
        </div>
      </div>

      {/* ── Hamburguesa (solo móvil) ─── */}
      <button
        className="ds-hamburger"
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir controles"
        style={{
          display: "none",
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 190,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: accent,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
      >
        <Menu size={22} />
      </button>

      {/* ── Overlay del drawer (solo móvil) ─── */}
      <div
        className={`ds-drawer-overlay${drawerOpen ? " ds-drawer-overlay--open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 195,
          background: "rgba(0,0,0,0.5)",
          opacity: 0,
          pointerEvents: "none",
          transition: "opacity 0.3s",
        }}
      />

      {/* ── Panel de controles ─── */}
      <div className={`ds-controls-sidebar${drawerOpen ? " ds-drawer-open" : ""}`} style={panelStyle}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "0.01em" }}>
            Controles de previsualización
          </h2>
          <button
            className="ds-drawer-close"
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar controles"
            style={{ display: "none", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-page)", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Viewport / ancho libre ─── */}
        <div style={{ marginBottom: "18px" }}>
          {/* Ancho actual */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Ancho del catálogo
            </span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
              {viewportPx}px
            </span>
          </div>

          {/* Slider libre 320–1700 */}
          <input
            type="range"
            className="ds-range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={10}
            value={viewportPx}
            onChange={(e) => setViewportPx(Number(e.target.value))}
            style={{ marginBottom: "4px" }}
          />

          {/* Marcas de referencia */}
          <div style={{ position: "relative", height: "28px", marginBottom: "10px" }}>
            {SLIDER_REFS.map((ref) => {
              const pct = ((ref - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
              return (
                <button
                  key={ref}
                  type="button"
                  title={`Ir a ${ref}px`}
                  onClick={() => setViewportPx(ref)}
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    transform: "translateX(-50%)",
                    textAlign: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <div style={{ width: 1, height: 6, background: viewportPx === ref ? "var(--accent)" : "var(--border-strong)", margin: "0 auto 2px" }} />
                  <span style={{ fontSize: "0.5rem", fontFamily: "monospace", color: viewportPx === ref ? "var(--accent)" : "var(--text-muted)", fontWeight: viewportPx === ref ? 700 : 400, whiteSpace: "nowrap" }}>
                    {ref}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Presets rápidos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
            {VIEWPORT_PRESETS.map(({ label, value, Icon }) => {
              const active = viewportPx === value;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setViewportPx(value)}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "7px 6px", borderRadius: "var(--border-radius-md)", border: active ? `1px solid ${accent}` : "1px solid var(--border-default)", background: active ? accent : "var(--bg-card)", color: active ? "#fff" : "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {matchedPreset ? `Preset: ${matchedPreset.label}` : "Ancho libre — arrastra el slider"}
          </p>
        </div>

        <div style={{ height: "1px", background: "var(--border-default)", margin: "4px 0 16px" }} />

        {/* ── Border-radius ─── */}
        <div style={{ marginBottom: "18px" }}>
          <CtrlLabel label="Border-radius" value={`${radius}px`} />
          <input type="range" className="ds-range" min={0} max={28} step={1} value={radius} onChange={(e) => handleRadiusChange(Number(e.target.value))} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "4px" }}>
            <span>0px</span><span>28px</span>
          </div>
        </div>

        {/* ── Espaciado ─── */}
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
          <div style={{ marginTop: "6px", padding: "5px 8px", borderRadius: "var(--border-radius-sm)", background: isDark ? "rgba(255,193,7,0.1)" : "var(--accent-tint-soft)", border: `1px solid ${isDark ? "rgba(255,193,7,0.25)" : "var(--accent-tint-medium)"}`, display: "flex", alignItems: "center", gap: "4px" }}>
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

    </div>
  );
}
