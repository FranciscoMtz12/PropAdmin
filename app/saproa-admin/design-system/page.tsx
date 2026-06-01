"use client";

/*
  Catálogo del sistema de diseño — PropAdmin / SAPROA.
  Secciones colapsables tipo acordeón, todas cerradas al inicio.
  Gráficas demo usan los tokens de chart (NO --accent).
*/

import { useState } from "react";
import {
  ChevronDown,
  Palette,
  LayoutGrid,
  SlidersHorizontal,
  Table2,
  TextCursor,
  BadgeCheck,
  BarChart2,
  MousePointerClick,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { CHART } from "@/lib/chartColors";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppBadge from "@/components/AppBadge";
import UiButton from "@/components/UiButton";
import AppCard from "@/components/AppCard";

/* ── Acordeón ──────────────────────────────────────────────────────── */

function AccordionSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        marginBottom: 8,
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
          gap: 10,
          padding: "14px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {icon && (
          <span style={{ color: "var(--text-muted)", display: "flex" }}>{icon}</span>
        )}
        <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", color: "var(--text-muted)" }}
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
            <div
              style={{
                padding: "4px 24px 24px",
                borderTop: "1px solid var(--border-default)",
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Swatch de color con tooltip ────────────────────────────────────── */

function ColorSwatch({
  token,
  hex,
  label,
}: {
  token: string;
  hex: string;
  label: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "default" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "var(--border-radius-md)",
          background: hex,
          border: "1px solid rgba(0,0,0,0.08)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.3, maxWidth: 72 }}>
        {label}
      </span>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--text-primary)",
              color: "var(--bg-card)",
              borderRadius: "var(--border-radius-sm)",
              padding: "4px 8px",
              fontSize: "0.6875rem",
              whiteSpace: "nowrap",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700 }}>{token}</div>
            <div style={{ opacity: 0.75 }}>{hex}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Datos para gráficas demo ──────────────────────────────────────── */

const DONUT_DEMO = [
  { name: "Cobrado",   value: 62, color: CHART.positive  },
  { name: "Pendiente", value: 23, color: CHART.warning   },
  { name: "Vencido",   value: 15, color: CHART.negative  },
];

const BAR_DEMO = [
  { mes: "Ene", Cobrado: 48000, Pendiente: 12000 },
  { mes: "Feb", Cobrado: 55000, Pendiente: 8000  },
  { mes: "Mar", Cobrado: 42000, Pendiente: 18000 },
  { mes: "Abr", Cobrado: 61000, Pendiente: 5000  },
  { mes: "May", Cobrado: 58000, Pendiente: 9000  },
  { mes: "Jun", Cobrado: 67000, Pendiente: 4000  },
];

const LINE_DEMO = [
  { mes: "Ene", ocupacion: 72, vacantes: 3 },
  { mes: "Feb", ocupacion: 75, vacantes: 2 },
  { mes: "Mar", ocupacion: 80, vacantes: 2 },
  { mes: "Abr", ocupacion: 83, vacantes: 1 },
  { mes: "May", ocupacion: 88, vacantes: 1 },
  { mes: "Jun", ocupacion: 91, vacantes: 1 },
];

/* ── Página ──────────────────────────────────────────────────────────── */

export default function DesignSystemPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Sistema de diseño"
        titleIcon={<Palette size={20} />}
        subtitle="Catálogo de tokens, componentes y patrones visuales de PropAdmin."
      />

      {/* ── Paleta de colores ──────────────────────────────────────── */}
      <AccordionSection title="Paleta de colores" icon={<Palette size={16} />}>
        {/* Acento */}
        <div style={{ marginTop: 16 }}>
          <p style={groupLabelStyle}>Acento de empresa</p>
          <div style={swatchRowStyle}>
            <ColorSwatch token="--accent" hex="var(--accent)" label="Acento" />
          </div>
        </div>

        {/* Semánticos de gráficas */}
        <div style={{ marginTop: 20 }}>
          <p style={groupLabelStyle}>Gráficas — Semánticos</p>
          <div style={swatchRowStyle}>
            <ColorSwatch token="--chart-positive"  hex={CHART.positive}  label="Positive" />
            <ColorSwatch token="--chart-warning"   hex={CHART.warning}   label="Warning"  />
            <ColorSwatch token="--chart-negative"  hex={CHART.negative}  label="Negative" />
            <ColorSwatch token="--chart-reference" hex={CHART.reference} label="Reference"/>
            <ColorSwatch token="--chart-neutral"   hex={CHART.neutral}   label="Neutral"  />
          </div>
        </div>

        {/* Categoriales de gráficas */}
        <div style={{ marginTop: 20 }}>
          <p style={groupLabelStyle}>Gráficas — Categoriales (series/edificios)</p>
          <div style={swatchRowStyle}>
            {CHART.cat.map((hex, i) => (
              <ColorSwatch key={hex} token={`--chart-cat-${i + 1}`} hex={hex} label={`Cat ${i + 1}`} />
            ))}
          </div>
        </div>

        {/* Fondos */}
        <div style={{ marginTop: 20 }}>
          <p style={groupLabelStyle}>Fondos</p>
          <div style={swatchRowStyle}>
            <ColorSwatch token="--bg-page"       hex="var(--bg-page)"       label="Página"    />
            <ColorSwatch token="--bg-card"       hex="var(--bg-card)"       label="Card"      />
            <ColorSwatch token="--bg-card-hover" hex="var(--bg-card-hover)" label="Card hover"/>
            <ColorSwatch token="--bg-sidebar"    hex="var(--bg-sidebar)"    label="Sidebar"   />
          </div>
        </div>

        {/* Semánticos de UI */}
        <div style={{ marginTop: 20 }}>
          <p style={groupLabelStyle}>Semánticos de estado (métricas)</p>
          <div style={swatchRowStyle}>
            <ColorSwatch token="--metric-value-green" hex="var(--metric-value-green)" label="Verde"  />
            <ColorSwatch token="--metric-value-amber" hex="var(--metric-value-amber)" label="Ámbar"  />
            <ColorSwatch token="--metric-value-red"   hex="var(--metric-value-red)"   label="Rojo"   />
            <ColorSwatch token="--metric-value-blue"  hex="var(--metric-value-blue)"  label="Azul"   />
          </div>
        </div>

        {/* Panel de controles */}
        <div
          style={{
            marginTop: 20,
            padding: "14px 16px",
            background: "var(--bg-page)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--border-radius-md)",
          }}
        >
          <p style={{ ...groupLabelStyle, marginBottom: 8 }}>Panel de controles del sandbox</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Acento actual</p>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--border-radius-sm)",
                  background: "var(--accent)",
                  border: "1px solid var(--border-default)",
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Modo</p>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: "var(--border-radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border-default)", fontSize: "0.75rem", color: "var(--text-primary)" }}>Light</span>
                <span style={{ padding: "4px 10px", borderRadius: "var(--border-radius-sm)", background: "#1E2535", color: "#F1F5F9", fontSize: "0.75rem" }}>Dark</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Tema UI</p>
              <div style={{ display: "flex", gap: 6 }}>
                {["Default", "Rounded", "Soft"].map((t) => (
                  <span key={t} style={{ padding: "4px 10px", borderRadius: "var(--border-radius-sm)", background: "var(--bg-card)", border: "1px solid var(--border-default)", fontSize: "0.75rem", color: "var(--text-primary)" }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* ── Cards ──────────────────────────────────────────────────── */}
      <AccordionSection title="Cards" icon={<LayoutGrid size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          <AppCard style={{ padding: 20 }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", margin: "0 0 4px" }}>Card base</p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>Usa --bg-card, --shadow-card, --border-default.</p>
          </AppCard>

          <div style={{ padding: 20, background: "var(--metric-bg-green)", border: "1px solid var(--metric-border-green)", borderRadius: "var(--border-radius-lg)" }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--metric-value-green)", margin: "0 0 4px" }}>Card verde</p>
            <p style={{ fontSize: "0.75rem", color: "var(--metric-value-green)", opacity: 0.8, margin: 0 }}>metric-bg/border/value-green</p>
          </div>

          <div style={{ padding: 20, background: "var(--metric-bg-amber)", border: "1px solid var(--metric-border-amber)", borderRadius: "var(--border-radius-lg)" }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--metric-value-amber)", margin: "0 0 4px" }}>Card ámbar</p>
            <p style={{ fontSize: "0.75rem", color: "var(--metric-value-amber)", opacity: 0.8, margin: 0 }}>metric-bg/border/value-amber</p>
          </div>

          <div style={{ padding: 20, background: "var(--metric-bg-red)", border: "1px solid var(--metric-border-red)", borderRadius: "var(--border-radius-lg)" }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--metric-value-red)", margin: "0 0 4px" }}>Card roja</p>
            <p style={{ fontSize: "0.75rem", color: "var(--metric-value-red)", opacity: 0.8, margin: 0 }}>metric-bg/border/value-red</p>
          </div>

          <div style={{ padding: 20, background: "var(--metric-bg-blue)", border: "1px solid var(--metric-border-blue)", borderRadius: "var(--border-radius-lg)" }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--metric-value-blue)", margin: "0 0 4px" }}>Card azul</p>
            <p style={{ fontSize: "0.75rem", color: "var(--metric-value-blue)", opacity: 0.8, margin: 0 }}>metric-bg/border/value-blue</p>
          </div>
        </div>
      </AccordionSection>

      {/* ── Botones ────────────────────────────────────────────────── */}
      <AccordionSection title="Botones" icon={<MousePointerClick size={16} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <UiButton variant="primary">Primario (solid)</UiButton>
          <UiButton variant="secondary">Secundario</UiButton>
          <UiButton variant="ghost">Ghost</UiButton>
          <UiButton disabled>Deshabilitado</UiButton>
        </div>
      </AccordionSection>

      {/* ── Badges ─────────────────────────────────────────────────── */}
      <AccordionSection title="Badges" icon={<BadgeCheck size={16} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <AppBadge variant="green">Cobrado · green</AppBadge>
          <AppBadge variant="amber">Pendiente · amber</AppBadge>
          <AppBadge variant="red">Vencido · red</AppBadge>
          <AppBadge variant="blue">Referencia · blue</AppBadge>
          <AppBadge variant="gray">Neutro · gray</AppBadge>
        </div>

        <div style={{ marginTop: 16 }}>
          <p style={groupLabelStyle}>Con colores personalizados</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            <AppBadge
              backgroundColor="var(--metric-bg-green)"
              textColor="var(--metric-value-green)"
              borderColor="var(--metric-border-green)"
            >
              Custom verde
            </AppBadge>
            <AppBadge
              backgroundColor="var(--metric-bg-amber)"
              textColor="var(--metric-value-amber)"
              borderColor="var(--metric-border-amber)"
            >
              Custom ámbar
            </AppBadge>
          </div>
        </div>
      </AccordionSection>

      {/* ── Filtros ────────────────────────────────────────────────── */}
      <AccordionSection title="Filtros e Inputs" icon={<SlidersHorizontal size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
          <div>
            <label style={inputLabelStyle}>Input texto</label>
            <input
              type="text"
              placeholder="Buscar inquilino..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={inputLabelStyle}>Input número</label>
            <input
              type="number"
              placeholder="0.00"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={inputLabelStyle}>Select</label>
            <select style={{ ...inputStyle, appearance: "none" }}>
              <option>Todos los estados</option>
              <option>Cobrado</option>
              <option>Pendiente</option>
              <option>Vencido</option>
            </select>
          </div>

          <div>
            <label style={inputLabelStyle}>Textarea</label>
            <textarea
              placeholder="Notas..."
              style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <p style={groupLabelStyle}>Input con error</p>
          <input
            type="text"
            value="valor incorrecto"
            readOnly
            style={{ ...inputStyle, borderColor: "var(--color-error)", outline: "none" }}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--color-error)", marginTop: 4 }}>Este campo es requerido.</p>
        </div>
      </AccordionSection>

      {/* ── Tablas ─────────────────────────────────────────────────── */}
      <AccordionSection title="Tablas" icon={<Table2 size={16} />}>
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-table-header)" }}>
                {["Inquilino", "Unidad", "Monto", "Estado"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { tenant: "Ana García",    unit: "401-A", amount: "$8,500.00",  status: "green",  statusLabel: "Cobrado"  },
                { tenant: "Luis Martínez", unit: "302",   amount: "$6,200.00",  status: "amber",  statusLabel: "Pendiente"},
                { tenant: "Rosa Pérez",    unit: "105-B", amount: "$11,000.00", status: "red",    statusLabel: "Vencido"  },
                { tenant: "Carlos López",  unit: "201",   amount: "$7,800.00",  status: "green",  statusLabel: "Cobrado"  },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={tdStyle}><strong>{row.tenant}</strong></td>
                  <td style={tdStyle}>{row.unit}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{row.amount}</td>
                  <td style={tdStyle}>
                    <AppBadge variant={row.status as "green" | "amber" | "red"}>{row.statusLabel}</AppBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AccordionSection>

      {/* ── Tipografía ─────────────────────────────────────────────── */}
      <AccordionSection title="Tipografía" icon={<TextCursor size={16} />}>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "--font-size-3xl · 36px", size: "2.25rem", weight: 800 },
            { label: "--font-size-2xl · 28px", size: "1.75rem", weight: 700 },
            { label: "--font-size-xl  · 22px", size: "1.375rem",weight: 700 },
            { label: "--font-size-lg  · 18px", size: "1.125rem",weight: 600 },
            { label: "--font-size-md  · 16px", size: "1rem",     weight: 600 },
            { label: "--font-size-base· 14px", size: "0.875rem", weight: 400 },
            { label: "--font-size-sm  · 13px", size: "0.8125rem",weight: 400 },
            { label: "--font-size-xs  · 11px", size: "0.6875rem",weight: 600 },
          ].map(({ label, size, weight }) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", minWidth: 200 }}>{label}</span>
              <span style={{ fontSize: size, fontWeight: weight, color: "var(--text-primary)" }}>
                El portafolio está al día
              </span>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── Gráficas ───────────────────────────────────────────────── */}
      <AccordionSection title="Gráficas" icon={<BarChart2 size={16} />}>
        <div style={{ marginTop: 20 }}>
          <p style={groupLabelStyle}>
            Todos los colores vienen de <code style={{ background: "var(--bg-page)", padding: "1px 5px", borderRadius: 4 }}>lib/chartColors.ts</code> — NO del acento.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginTop: 16 }}>
          {/* Dona */}
          <div>
            <p style={chartTitleStyle}>Dona — distribución cobranza</p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={DONUT_DEMO}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {DONUT_DEMO.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [`${v}%`]}
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--border-radius-md)",
                      fontSize: "0.75rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                {DONUT_DEMO.map((d) => (
                  <span key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    {d.name} ({d.value}%)
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Barras */}
          <div>
            <p style={chartTitleStyle}>Barras — cobrado vs pendiente</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={BAR_DEMO} barGap={4} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="mes" tick={{ fontSize: "0.6875rem", fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: "0.6875rem", fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem" }}
                  formatter={(v) => [`$${Number(v).toLocaleString("es-MX")}`]}
                />
                <Bar dataKey="Cobrado"   fill={CHART.positive} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Pendiente" fill={CHART.warning}  radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART.positive }} /> Cobrado
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART.warning }} /> Pendiente
              </span>
            </div>
          </div>

          {/* Líneas */}
          <div>
            <p style={chartTitleStyle}>Líneas — tendencia ocupación</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={LINE_DEMO} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: "0.6875rem", fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: "0.6875rem", fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem" }}
                  formatter={(v, n) => [`${v}${n === "ocupacion" ? "%" : ""}`, n === "ocupacion" ? "% Ocupación" : "Vacantes"]}
                />
                <Line type="monotone" dataKey="ocupacion" name="% Ocupación" stroke={CHART.positive} strokeWidth={2.5} dot={{ r: 3, fill: CHART.positive }} />
                <Line type="monotone" dataKey="vacantes"  name="Vacantes"    stroke={CHART.negative} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: CHART.negative }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span style={{ width: 12, height: 2, background: CHART.positive, display: "inline-block" }} /> % Ocupación
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span style={{ width: 12, height: 2, background: CHART.negative, display: "inline-block" }} /> Vacantes
              </span>
            </div>
          </div>
        </div>

        {/* Paleta categoriales */}
        <div style={{ marginTop: 24 }}>
          <p style={groupLabelStyle}>Colores categoriales — para identificar edificios/series</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {CHART.cat.map((hex, i) => (
              <div key={hex} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: hex, flexShrink: 0 }} />
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>cat-{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </AccordionSection>

      {/* ── Espaciado y radio ──────────────────────────────────────── */}
      <AccordionSection title="Espaciado y radio de borde" icon={<SlidersHorizontal size={16} />}>
        <div style={{ marginTop: 16 }}>
          <p style={groupLabelStyle}>Border radius</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
            {[
              { token: "--border-radius-sm",   px: "6px"   },
              { token: "--border-radius-md",   px: "8px"   },
              { token: "--border-radius-lg",   px: "12px"  },
              { token: "--border-radius-xl",   px: "16px"  },
              { token: "--border-radius-full", px: "999px" },
            ].map(({ token, px }) => (
              <div key={token} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    background: "var(--accent)",
                    opacity: 0.2,
                    border: "2px solid var(--accent)",
                    borderRadius: `var(${token})`,
                  }}
                />
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", textAlign: "center" }}>
                  {token.replace("--border-radius-", "")}<br />{px}
                </span>
              </div>
            ))}
          </div>

          <p style={{ ...groupLabelStyle, marginTop: 20 }}>Espaciado</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            {[
              { token: "--spacing-xs", px: 4  },
              { token: "--spacing-sm", px: 8  },
              { token: "--spacing-md", px: 12 },
              { token: "--spacing-lg", px: 16 },
              { token: "--spacing-xl", px: 24 },
              { token: "--spacing-2xl",px: 32 },
              { token: "--spacing-3xl",px: 48 },
            ].map(({ token, px }) => (
              <div key={token} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: px, height: px, background: "var(--accent)", opacity: 0.3, borderRadius: 2 }} />
                <span style={{ fontSize: "0.5625rem", color: "var(--text-muted)" }}>{px}px</span>
              </div>
            ))}
          </div>
        </div>
      </AccordionSection>
    </PageContainer>
  );
}

/* ── Estilos helpers ─────────────────────────────────────────────────── */

const groupLabelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 8px",
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  margin: "0 0 8px",
};

const swatchRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-md)",
  fontSize: "0.875rem",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const inputLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "0.8125rem",
  color: "var(--text-primary)",
};
