"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock,
  DollarSign, Droplets, Flame, Layers, Settings,
  TrendingUp, Wifi, Zap,
} from "lucide-react";

import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  type BuildingUtilityMeter, type BuildingUtilityInvoice, type BuildingUtilityInvoiceItem,
  meterGeneratesCharge, SERVICE_TYPE_LABEL, SERVICE_TYPE_UNIT,
} from "@/lib/types";
import { sortByNatural } from "@/lib/sort-utils";
import { shouldBillThisPeriod } from "@/lib/service-utils";
import { useTheme } from "@/contexts/ThemeContext";
import { getReciboServicioPdfBlob, getReporteDistribucionPdfBlob } from "@/lib/pdfTemplates";
import JSZip from "jszip";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import MetricCircles from "@/components/MetricCircles";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import UtilityInvoiceModal from "@/components/UtilityInvoiceModal";
import UploadFixedInvoiceModal from "@/components/UploadFixedInvoiceModal";

/* ─── Constants ──────────────────────────────────────────────────── */

const MONTH_LABELS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(n);
}

function proxyUrl(url: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/logo-proxy?url=${encodeURIComponent(url)}`;
}

/* ─── Types ──────────────────────────────────────────────────────── */

type BuildingGroup = {
  building_id: string;
  building_name: string;
  company_id: string | null;
  utility_meters: BuildingUtilityMeter[];
  invoices: Map<string, BuildingUtilityInvoice>;
  units: { id: string; unit_number: string }[];
};

type ActiveModal = {
  meter: BuildingUtilityMeter;
  building: { id: string; name: string };
  existingInvoice: BuildingUtilityInvoice | null;
  units: { id: string; unit_number: string }[];
} | null;

type SubMeterWithReading = {
  id: string;
  unit_id: string;
  unit_number: string;
  sub_meter_number: string | null;
  reading: {
    id: string;
    previous_reading: number;
    current_reading: number;
    consumption: number | null;
  } | null;
};

type SharedMeterDetail = {
  subMeters: SubMeterWithReading[];
  hasReadings: boolean;
};

const TH_L  = { padding: "8px 10px", textAlign: "left"  as const, fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em", whiteSpace: "nowrap" as const };
const TH_R  = { ...TH_L, textAlign: "right" as const };
const TD_L  = { padding: "9px 10px", fontSize: "0.8125rem", textAlign: "left"  as const, borderTop: "1px solid var(--border-default)", verticalAlign: "middle" as const };
const TD_R  = { ...TD_L, textAlign: "right" as const };

/* ─── Helpers ────────────────────────────────────────────────────── */

function ServiceIcon({ type, size = 16 }: { type: string; size?: number }) {
  switch (type) {
    case "electricity": return <Zap size={size} />;
    case "gas":         return <Flame size={size} />;
    case "water":       return <Droplets size={size} />;
    case "internet":    return <Wifi size={size} />;
    default:            return <Settings size={size} />;
  }
}

const INVOICE_STATUS_BADGE: Record<string, { label: string; variant: "amber"|"gray"|"blue"|"green" }> = {
  pending:     { label: "Pendiente",   variant: "amber" },
  draft:       { label: "Borrador",    variant: "gray"  },
  distributed: { label: "Distribuida", variant: "blue"  },
  charged:     { label: "Cobrada",     variant: "green" },
};

const ACTION_LABEL: Record<string, string> = {
  pending:     "Registrar factura",
  draft:       "Completar",
  distributed: "Generar cobros",
  charged:     "Ver detalle",
};

/* ─── Service row ─────────────────────────────────────────────────── */

function ServiceRow({
  serviceType,
  name,
  providerLine,
  isbimonthly,
  generatesCharge,
  invoice,
  amount,
  onAction,
  isShared,
  isExpanded,
  onExpandToggle,
  billingType,
  fixedAmount,
  onGenerateFixedCobro,
  generatingFixedCobro,
  onGeneratePdfs,
  generatingPdfs,
  onUploadInvoice,
}: {
  serviceType: string;
  name: string;
  providerLine: string | null;
  isbimonthly: boolean;
  generatesCharge: boolean;
  invoice: { status: string; total_amount: number } | null;
  amount: number | null;
  onAction: () => void;
  isShared?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  billingType?: "variable" | "fixed";
  fixedAmount?: number;
  onGenerateFixedCobro?: () => void;
  generatingFixedCobro?: boolean;
  onGeneratePdfs?: () => void;
  generatingPdfs?: boolean;
  onUploadInvoice?: () => void;
}) {
  const status = invoice?.status ?? "pending";
  const badge = INVOICE_STATUS_BADGE[status] ?? INVOICE_STATUS_BADGE.pending;
  const actionLabel = ACTION_LABEL[status] ?? "Registrar factura";
  const isBtnPrimary = status === "pending" || status === "draft";

  return (
    <div
      onClick={isShared ? onExpandToggle : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid var(--border-default)",
        cursor: isShared ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--border-radius-md)",
          background: "var(--bg-page)",
          border: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--text-muted)",
        }}
      >
        <ServiceIcon type={serviceType} size={15} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
            {name}
          </span>
          {isbimonthly && <AppBadge variant="gray">Bimestral</AppBadge>}
          {generatesCharge
            ? <AppBadge variant="blue">Genera cobro</AppBadge>
            : <AppBadge variant="gray">Gasto del edificio</AppBadge>}
        </div>
        {providerLine && (
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{providerLine}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {billingType === "fixed" ? (
          <>
            <AppBadge variant="gray">Monto fijo</AppBadge>
            {fixedAmount != null && fixedAmount > 0 && (
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-muted)" }}>
                {formatMXN(fixedAmount)}/mes
              </span>
            )}
            {generatesCharge && onGenerateFixedCobro && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onGenerateFixedCobro(); }}
                disabled={generatingFixedCobro}
                style={{
                  padding: "5px 12px", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem", fontWeight: 600,
                  cursor: generatingFixedCobro ? "default" : "pointer",
                  border: "none", background: "var(--accent)", color: "#fff", whiteSpace: "nowrap",
                  opacity: generatingFixedCobro ? 0.6 : 1,
                }}
              >
                {generatingFixedCobro ? "Generando..." : "Generar cobro"}
              </button>
            )}
            {invoice == null && onUploadInvoice && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onUploadInvoice(); }}
                style={{
                  padding: "5px 12px", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem", fontWeight: 600,
                  cursor: "pointer", border: "1px solid var(--border-default)",
                  background: "var(--bg-card)", color: "var(--text-primary)", whiteSpace: "nowrap",
                }}
              >
                Subir factura
              </button>
            )}
          </>
        ) : (
          <>
            {amount != null && (
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: generatesCharge && status === "charged"
                    ? "var(--badge-text-green)"
                    : "var(--text-muted)",
                }}
              >
                {formatMXN(amount)}
              </span>
            )}
            {generatesCharge ? (
              <>
                <AppBadge variant={badge.variant}>{badge.label}</AppBadge>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onAction(); }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "var(--border-radius-md)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isBtnPrimary ? "none" : "1px solid var(--border-default)",
                    background: isBtnPrimary ? "var(--accent)" : "transparent",
                    color: isBtnPrimary ? "#fff" : "var(--text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {actionLabel}
                </button>
                {isShared && invoice != null && onGeneratePdfs && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onGeneratePdfs(); }}
                    disabled={generatingPdfs}
                    style={{
                      padding: "5px 12px", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem", fontWeight: 600,
                      cursor: generatingPdfs ? "default" : "pointer",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-card)", color: "var(--text-primary)", whiteSpace: "nowrap",
                      opacity: generatingPdfs ? 0.6 : 1,
                    }}
                  >
                    {generatingPdfs ? "Generando..." : "Generar PDFs"}
                  </button>
                )}
              </>
            ) : (
              <>
                <AppBadge variant="gray">Gasto empresa</AppBadge>
                {invoice == null && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onAction(); }}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "var(--border-radius-md)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Registrar factura
                  </button>
                )}
              </>
            )}
          </>
        )}
        {isShared && (
          <ChevronDown
            size={16}
            style={{
              flexShrink: 0,
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── SharedMeterDropdown ─────────────────────────────────────────── */

function SharedMeterDropdown({
  invoice,
  detail,
  consumptionUnit,
}: {
  invoice: BuildingUtilityInvoice | null;
  detail: SharedMeterDetail | "loading" | undefined;
  consumptionUnit: string | null;
}) {
  const panelStyle = {
    background: "var(--bg-page)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--border-radius-md)",
    marginBottom: 8,
    overflow: "hidden" as const,
  };

  if (!invoice) {
    return (
      <div style={{ ...panelStyle, padding: "14px 16px" }}>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>
          Registra la factura del proveedor para ver la distribución
        </p>
      </div>
    );
  }

  if (detail === "loading" || detail === undefined) {
    return (
      <div style={{ ...panelStyle, padding: "14px 16px" }}>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    );
  }

  const totalConsumption = Number(invoice.total_consumption) ?? 0;
  const totalAmount      = Number(invoice.total_amount);
  const hasTotals        = totalConsumption > 0;
  const precioUnit       = hasTotals ? totalAmount / totalConsumption : null;
  const unit             = invoice.consumption_unit || consumptionUnit || "";

  const sorted      = sortByNatural(detail.subMeters, sm => sm.unit_number);
  const sumConsumos = sorted.reduce((s, sm) => s + (sm.reading?.consumption ?? 0), 0);
  const consumoAreas = totalConsumption - sumConsumos;
  const montoAreas   = precioUnit != null ? consumoAreas * precioUnit : null;

  const totalInquilinos = sorted.reduce((s, sm) => {
    if (sm.reading?.consumption == null || precioUnit == null) return s;
    return s + sm.reading.consumption * precioUnit;
  }, 0);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        {hasTotals && precioUnit != null ? (
          <span style={{ fontSize: "0.8125rem" }}>
            Precio/{unit}: <strong>{formatMXN(precioUnit)}</strong>
          </span>
        ) : (
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Sin consumo total registrado en la factura</span>
        )}
      </div>

      {/* No-readings banner */}
      {!detail.hasReadings && (
        <div style={{ margin: "10px 14px 0", padding: "10px 12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--border-radius-md)", fontSize: "0.8125rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          Campo aún no ha capturado lecturas para este período
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH_L}>Depa</th>
              <th style={TH_R}>Lect. ant.</th>
              <th style={TH_R}>Lect. act.</th>
              <th style={TH_R}>Consumo</th>
              <th style={TH_R}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(sm => {
              const r     = sm.reading;
              const monto = r?.consumption != null && precioUnit != null
                ? r.consumption * precioUnit : null;
              return (
                <tr key={sm.id}>
                  <td style={TD_L}>
                    <strong style={{ fontSize: "0.875rem" }}>Depa {sm.unit_number}</strong>
                    {sm.sub_meter_number && sm.sub_meter_number !== sm.unit_number && (
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: 4 }}>— {sm.sub_meter_number}</span>
                    )}
                  </td>
                  <td style={TD_R}>{r != null ? r.previous_reading.toLocaleString("es-MX") : "—"}</td>
                  <td style={TD_R}>{r != null ? r.current_reading.toLocaleString("es-MX") : "—"}</td>
                  <td style={TD_R}>
                    {r == null
                      ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Pendiente</span>
                      : r.consumption != null
                        ? `${r.consumption.toLocaleString("es-MX")}${unit ? " " + unit : ""}`
                        : "—"}
                  </td>
                  <td style={TD_R}>{monto != null ? formatMXN(monto) : "—"}</td>
                </tr>
              );
            })}
            {/* Áreas comunes */}
            {hasTotals && (
              <tr style={{ opacity: 0.75 }}>
                <td style={{ ...TD_L, fontStyle: "italic", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  Áreas comunes (empresa)
                </td>
                <td style={TD_R}>—</td>
                <td style={TD_R}>—</td>
                <td style={TD_R}>
                  {`${consumoAreas.toLocaleString("es-MX")}${unit ? " " + unit : ""}`}
                </td>
                <td style={TD_R}>{montoAreas != null ? formatMXN(montoAreas) : "—"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-default)", display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Total cobrado a inquilinos: <strong style={{ color: "var(--text-primary)" }}>{formatMXN(totalInquilinos)}</strong>
        </span>
        {montoAreas != null && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Absorción empresa: <strong style={{ color: "var(--text-primary)" }}>{formatMXN(montoAreas)}</strong>
          </span>
        )}
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Total factura: <strong style={{ color: "var(--text-primary)" }}>{formatMXN(totalAmount)}</strong>
        </span>
      </div>
    </div>
  );
}

/* ─── Period selector ─────────────────────────────────────────────── */

function PeriodSelector({
  year, month, onPrev, onNext,
}: {
  year: number; month: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      <button
        type="button"
        onClick={onPrev}
        style={{
          width: 36, height: 36, borderRadius: "var(--border-radius-md) 0 0 var(--border-radius-md)",
          border: "1px solid var(--border-default)", background: "var(--bg-card)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-primary)",
        }}
      >
        <ChevronLeft size={16} />
      </button>
      <div
        style={{
          padding: "0 24px", height: 36, display: "flex", alignItems: "center",
          borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)",
          background: "var(--bg-card)",
          fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)",
          minWidth: 160, justifyContent: "center",
        }}
      >
        {MONTH_LABELS[month - 1]} {year}
      </div>
      <button
        type="button"
        onClick={onNext}
        style={{
          width: 36, height: 36, borderRadius: "0 var(--border-radius-md) var(--border-radius-md) 0",
          border: "1px solid var(--border-default)", background: "var(--bg-card)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-primary)",
        }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function ServiciosPage() {
  const { user, loading } = useCurrentUser();
  const { impersonationMode, groupCompanyIds, groupCompanies } = useImpersonation();
  const isGroupMode = impersonationMode === 'group';
  const { legalName, companyAddress, companyTaxId, accentColor, logoPrintUrl, logoGroupUrl } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    const ok = user.role === "titular" || user.role === "group_admin" || user.role === "administracion" || user.role === "superadmin" || user.is_superadmin;
    if (!ok) router.replace("/dashboard");
  }, [user, loading, router]);

  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [pageLoading, setPageLoading] = useState(true);
  const [groups, setGroups]           = useState<BuildingGroup[]>([]);
  const [hasAnyMeters, setHasAnyMeters] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [expandedMeterId, setExpandedMeterId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SharedMeterDetail | "loading">>({});
  const [generatingFixedMeter, setGeneratingFixedMeter] = useState<string | null>(null);
  const [generatingPdfsMeter, setGeneratingPdfsMeter]   = useState<string | null>(null);
  const [uploadInvoiceMeter, setUploadInvoiceMeter]     = useState<{ meter: BuildingUtilityMeter; building: { id: string; name: string } } | null>(null);
  const [pendingBuildings, setPendingBuildings] = useState<{ id: string; name: string; count: number }[]>([]);

  function prevPeriod() {
    setPeriod(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 });
  }
  function nextPeriod() {
    setPeriod(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 });
  }

  useEffect(() => {
    setExpandedMeterId(null);
    setDetailCache({});
  }, [period.year, period.month]);

  useEffect(() => {
    if (user?.company_id || user?.is_superadmin || isGroupMode) void loadData();
  }, [user?.company_id, user?.is_superadmin, isGroupMode, period.year, period.month]);

  useEffect(() => {
    if (user?.company_id || user?.is_superadmin || isGroupMode) void loadPendingMeters();
  }, [user?.company_id, user?.is_superadmin, isGroupMode]);

  async function loadPendingMeters() {
    if (!user?.company_id && !user?.is_superadmin && !isGroupMode) return;
    const cid = user?.company_id ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co = (q: any) => cid ? q.eq("company_id", cid) : q;
    const { data } = await co(supabase
      .from("building_utility_meters")
      .select("id, building_id, buildings(name)"))
      .eq("active", false)
      .is("deleted_at", null);
    if (!data) return;
    const byBuilding = new Map<string, { name: string; count: number }>();
    type PendingRow = { building_id: string; buildings: { name: string } | null };
    for (const row of data as unknown as PendingRow[]) {
      const bid = row.building_id;
      const bname = row.buildings?.name ?? "Edificio";
      const entry = byBuilding.get(bid);
      if (entry) entry.count++;
      else byBuilding.set(bid, { name: bname, count: 1 });
    }
    setPendingBuildings(
      [...byBuilding.entries()].map(([id, { name, count }]) => ({ id, name, count }))
    );
  }

  async function loadData() {
    if (!user?.company_id && !user?.is_superadmin && !isGroupMode) return;
    setPageLoading(true);
    const cid = user?.company_id ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co = (q: any) => cid ? q.eq("company_id", cid) : q;
    const { year, month } = period;

    try {
      const { data: buildingsData, error: bErr } = await co(supabase
        .from("buildings")
        .select("id, name, company_id"))
        .is("deleted_at", null)
        .order("name");
      if (bErr) throw bErr;
      if (!buildingsData?.length) {
        setGroups([]);
        setHasAnyMeters(false);
        setPageLoading(false);
        return;
      }

      const bIds = (buildingsData as { id: string; name: string }[]).map(b => b.id);

      const [umRes, unitsRes, uiRes] = await Promise.all([
        supabase.from("building_utility_meters")
          .select("*")
          .in("building_id", bIds)
          .eq("active", true)
          .is("deleted_at", null),

        supabase.from("units")
          .select("id, unit_number, building_id")
          .in("building_id", bIds)
          .is("deleted_at", null),

        supabase.from("building_utility_invoices")
          .select("*")
          .in("building_id", bIds)
          .eq("period_year", year)
          .eq("period_month", month)
          .is("deleted_at", null),
      ]);

      const utilMetersByBuilding = new Map<string, BuildingUtilityMeter[]>();
      const unitsByBuilding = new Map<string, { id: string; unit_number: string }[]>();
      const invoicesByMeter = new Map<string, BuildingUtilityInvoice>();

      ((umRes.data ?? []) as BuildingUtilityMeter[]).forEach(m => {
        // exclude dedicated meters where tenant pays directly
        if (m.meter_type === "dedicated" && m.contract_holder === "tenant") return;
        const arr = utilMetersByBuilding.get(m.building_id) ?? [];
        arr.push(m);
        utilMetersByBuilding.set(m.building_id, arr);
      });

      ((unitsRes.data ?? []) as { id: string; unit_number: string; building_id: string }[]).forEach(u => {
        const arr = unitsByBuilding.get(u.building_id) ?? [];
        arr.push({ id: u.id, unit_number: u.unit_number });
        unitsByBuilding.set(u.building_id, arr);
      });

      ((uiRes.data ?? []) as BuildingUtilityInvoice[]).forEach(i => {
        invoicesByMeter.set(i.building_utility_meter_id, i);
      });

      const totalConfigured = [...utilMetersByBuilding.values()].reduce((n, arr) => n + arr.length, 0);
      setHasAnyMeters(totalConfigured > 0);

      const result: BuildingGroup[] = (buildingsData as { id: string; name: string; company_id: string | null }[])
        .map(b => {
          const utilMeters = (utilMetersByBuilding.get(b.id) ?? [])
            .filter(m => shouldBillThisPeriod(m, year, month));
          return {
            building_id:    b.id,
            building_name:  b.name,
            company_id:     b.company_id ?? null,
            utility_meters: utilMeters,
            invoices:       invoicesByMeter,
            units:          unitsByBuilding.get(b.id) ?? [],
          };
        })
        .filter(g => g.utility_meters.length > 0);

      setGroups(result);
    } catch (err) {
      console.error("Servicios load error", err);
    }
    setPageLoading(false);
  }

  async function handleExpand(meterId: string) {
    if (expandedMeterId === meterId) { setExpandedMeterId(null); return; }
    setExpandedMeterId(meterId);
    if (detailCache[meterId] !== undefined) return;

    setDetailCache(prev => ({ ...prev, [meterId]: "loading" }));

    const { data: smData } = await supabase
      .from("building_utility_sub_meters")
      .select("id, unit_id, sub_meter_number")
      .eq("building_utility_meter_id", meterId)
      .is("deleted_at", null);

    const smList = (smData || []) as { id: string; unit_id: string; sub_meter_number: string | null }[];
    const unitIds = smList.map(s => s.unit_id);
    const unitMap: Record<string, string> = {};
    if (unitIds.length > 0) {
      const { data: uData } = await supabase
        .from("units").select("id, unit_number").in("id", unitIds);
      ((uData || []) as { id: string; unit_number: string }[]).forEach(u => { unitMap[u.id] = u.unit_number; });
    }

    const smIds = smList.map(s => s.id);
    const readingMap: Record<string, {
      id: string; previous_reading: number; current_reading: number; consumption: number | null;
    }> = {};
    if (smIds.length > 0) {
      const { data: rData } = await supabase
        .from("building_utility_readings")
        .select("id, building_utility_sub_meter_id, previous_reading, current_reading, consumption")
        .in("building_utility_sub_meter_id", smIds)
        .eq("period_year", period.year)
        .eq("period_month", period.month)
        .is("deleted_at", null);
      ((rData || []) as {
        id: string; building_utility_sub_meter_id: string;
        previous_reading: number; current_reading: number; consumption: number | null;
      }[]).forEach(r => { readingMap[r.building_utility_sub_meter_id] = r; });
    }

    const subMeters: SubMeterWithReading[] = smList.map(sm => ({
      id: sm.id,
      unit_id: sm.unit_id,
      unit_number: unitMap[sm.unit_id] ?? sm.unit_id.slice(0, 6),
      sub_meter_number: sm.sub_meter_number,
      reading: readingMap[sm.id] ?? null,
    }));

    setDetailCache(prev => ({
      ...prev,
      [meterId]: { subMeters, hasReadings: Object.keys(readingMap).length > 0 },
    }));
  }

  async function handleGenerateFixedCobro(meter: BuildingUtilityMeter, buildingUnits: { id: string; unit_number: string }[]) {
    if (!user?.company_id) return;
    const fixedAmt = meter.fixed_amount ?? 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    setGeneratingFixedMeter(meter.id);
    try {
      const unitIds = buildingUnits.map(u => u.id);
      if (!unitIds.length) { toast.error("Sin unidades configuradas"); return; }

      const { data: lData } = await supabase
        .from("leases")
        .select("id, unit_id, due_day")
        .in("unit_id", unitIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .lte("start_date", todayStr)
        .or(`end_date.is.null,end_date.gte.${todayStr}`);

      const leases = (lData || []) as { id: string; unit_id: string; due_day: number | null }[];
      if (!leases.length) { toast.error("Sin inquilinos activos en este edificio"); return; }

      const leaseUnitIds = leases.map(l => l.unit_id);
      const { data: sData } = await supabase
        .from("collection_schedules")
        .select("id, unit_id, amount_expected")
        .eq("company_id", user.company_id)
        .in("unit_id", leaseUnitIds)
        .eq("charge_type", meter.service_type)
        .is("deleted_at", null);

      const existingScheds = (sData || []) as { id: string; unit_id: string; amount_expected: number }[];
      const schedByUnit = new Map(existingScheds.map(s => [s.unit_id, s]));

      const newScheds: object[] = [];
      for (const lease of leases) {
        if (!schedByUnit.has(lease.unit_id)) {
          newScheds.push({
            company_id:          user.company_id,
            building_id:         meter.building_id,
            unit_id:             lease.unit_id,
            lease_id:            lease.id,
            charge_type:         meter.service_type,
            title:               SERVICE_TYPE_LABEL[meter.service_type] ?? meter.service_type,
            responsibility_type: "tenant",
            amount_expected:     fixedAmt,
            due_day:             lease.due_day ?? 15,
            active:              true,
            billing_frequency:   "monthly",
          });
        }
      }

      if (newScheds.length > 0) {
        const { data: created } = await supabase
          .from("collection_schedules").insert(newScheds)
          .select("id, unit_id, amount_expected");
        ((created || []) as { id: string; unit_id: string; amount_expected: number }[]).forEach(s => {
          schedByUnit.set(s.unit_id, s);
        });
      }

      const toUpdate = existingScheds.filter(s => s.amount_expected !== fixedAmt);
      if (toUpdate.length) {
        await supabase.from("collection_schedules")
          .update({ amount_expected: fixedAmt })
          .in("id", toUpdate.map(s => s.id));
      }

      const allSchedIds = [...schedByUnit.values()].map(s => s.id);
      const { data: exRec } = await supabase
        .from("collection_records")
        .select("collection_schedule_id")
        .in("collection_schedule_id", allSchedIds)
        .eq("period_year", period.year)
        .eq("period_month", period.month)
        .is("deleted_at", null);

      const existingIds = new Set(
        ((exRec || []) as { collection_schedule_id: string }[]).map(r => r.collection_schedule_id),
      );

      const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
      const buildDue = (y: number, m: number, d: number) => {
        const safe = Math.max(1, Math.min(d, lastDay(y, m)));
        return `${y}-${String(m).padStart(2,"0")}-${String(safe).padStart(2,"0")}`;
      };

      const toInsert = leases
        .filter(l => { const s = schedByUnit.get(l.unit_id); return s && !existingIds.has(s.id); })
        .map(l => {
          const sched = schedByUnit.get(l.unit_id)!;
          const dueDate = buildDue(period.year, period.month, l.due_day ?? 15);
          return {
            collection_schedule_id: sched.id,
            company_id:    user!.company_id,
            building_id:   meter.building_id,
            unit_id:       l.unit_id,
            lease_id:      l.id,
            period_year:   period.year,
            period_month:  period.month,
            due_date:      dueDate,
            amount_due:    fixedAmt,
            amount_collected: 0,
            status:        dueDate < todayStr ? "overdue" : "pending",
            collected_at:  null,
            needs_capture: false,
            notes:         null,
          };
        });

      if (!toInsert.length) {
        toast.success("Los cobros de este período ya están generados.");
        return;
      }

      const { error } = await supabase.from("collection_records").insert(toInsert);
      if (error) { toast.error(`Error: ${error.message}`); return; }
      toast.success(`${toInsert.length} cobro${toInsert.length === 1 ? "" : "s"} generado${toInsert.length === 1 ? "" : "s"}.`);
    } finally {
      setGeneratingFixedMeter(null);
    }
  }

  async function handleGeneratePdfs(
    meter: BuildingUtilityMeter,
    invoice: BuildingUtilityInvoice,
    group: BuildingGroup,
  ) {
    setGeneratingPdfsMeter(meter.id);
    try {
      const { data: itemsData } = await supabase
        .from("building_utility_invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id);

      const items = (itemsData ?? []) as BuildingUtilityInvoiceItem[];

      const unitIds = [...new Set(items.map(i => i.unit_id))];
      const tenantMap: Record<string, string> = {};
      const responsibleMap: Record<string, string> = {};
      if (unitIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { data: leasesData } = await supabase
          .from("leases")
          .select("unit_id, tenant_id, responsible_payer_id, tenant:tenants(full_name)")
          .in("unit_id", unitIds)
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .lte("start_date", today)
          .or(`end_date.is.null,end_date.gte.${today}`);

        const leaseRows = (leasesData ?? []) as unknown as {
          unit_id: string;
          tenant_id: string;
          responsible_payer_id: string | null;
          tenant: { full_name: string } | null;
        }[];

        for (const row of leaseRows) {
          if (row.tenant) tenantMap[row.unit_id] = row.tenant.full_name;
        }

        const responsibleIds = [...new Set(
          leaseRows
            .filter(r => r.responsible_payer_id != null && r.responsible_payer_id !== r.tenant_id)
            .map(r => r.responsible_payer_id as string),
        )];

        if (responsibleIds.length > 0) {
          const { data: payerData } = await supabase
            .from("tenants")
            .select("id, full_name")
            .in("id", responsibleIds);

          const payerNameMap: Record<string, string> = {};
          for (const p of (payerData ?? []) as { id: string; full_name: string }[]) {
            payerNameMap[p.id] = p.full_name;
          }

          for (const row of leaseRows) {
            if (row.responsible_payer_id && row.responsible_payer_id !== row.tenant_id) {
              const name = payerNameMap[row.responsible_payer_id];
              if (name) responsibleMap[row.unit_id] = name;
            }
          }
        }
      }

      const totalConsumption = Number(invoice.total_consumption ?? 0);
      const totalAmount      = Number(invoice.total_amount);
      const ratePerUnit      = totalConsumption > 0 ? totalAmount / totalConsumption : undefined;
      const consumptionUnit  = invoice.consumption_unit ?? SERVICE_TYPE_UNIT[meter.service_type] ?? undefined;
      const periodLabel = `${MONTH_LABELS[period.month - 1]} ${period.year}`;
      const mm          = String(period.month).padStart(2, "0");
      const yyyy        = String(period.year);
      const svcName     = SERVICE_TYPE_LABEL[meter.service_type] ?? meter.service_type;
      const folioS      = svcName[0].toUpperCase();
      const folioEdif   = group.building_name
        .split(" ")
        .map(t => t.slice(0, 3))
        .join("")
        .toUpperCase()
        .slice(0, 8);

      // Group items by unit_id to avoid duplicate receipts when multiple
      // sub-meter rows exist for the same unit
      const byUnit = new Map<string, { subtotal: number; consumption: number | null; percentage: number | null }>();
      for (const item of items) {
        if (!tenantMap[item.unit_id]) continue;
        const prev = byUnit.get(item.unit_id);
        if (prev) {
          prev.subtotal    += Number(item.amount_assigned);
          prev.consumption  = prev.consumption != null && item.consumption != null
            ? prev.consumption + item.consumption
            : (prev.consumption ?? item.consumption);
          prev.percentage   = prev.percentage != null && item.percentage != null
            ? prev.percentage + item.percentage
            : (prev.percentage ?? item.percentage);
        } else {
          byUnit.set(item.unit_id, {
            subtotal:    Number(item.amount_assigned),
            consumption: item.consumption,
            percentage:  item.percentage,
          });
        }
      }

      // Sort by unit_number for consistent ordering in receipts and report
      const sortedUnits = sortByNatural(
        [...byUnit.entries()].map(([unitId, agg]) => ({
          unitId,
          agg,
          unitNumber: group.units.find(u => u.id === unitId)?.unit_number ?? "—",
        })),
        e => e.unitNumber,
      );

      const matzUrl = logoGroupUrl ?? logoPrintUrl;
      const logoProxied     = logoPrintUrl ? proxyUrl(logoPrintUrl) : undefined;
      const logoMatzProxied = matzUrl ? proxyUrl(matzUrl) : undefined;
      const zip = new JSZip();

      for (const { unitId, agg, unitNumber } of sortedUnits) {
        const { subtotal, consumption } = agg;
        const svcCharge = subtotal * 0.02;
        const folio     = `${folioS}-${folioEdif}-${unitNumber.replace(/\s/g, "")}-${mm}-${yyyy}`;
        const blob = await getReciboServicioPdfBlob({
          legalName,
          address:             companyAddress,
          rfc:                 companyTaxId,
          accentColor,
          logoUrl:             logoProxied,
          logoMatzUrl:         logoMatzProxied,
          serviceName:         svcName,
          providerName:        meter.provider_name ?? "",
          period:              periodLabel,
          buildingName:        group.building_name,
          unitNumber,
          tenantName:          tenantMap[unitId],
          consumption:         consumption ?? undefined,
          consumptionUnit:     consumptionUnit ?? undefined,
          ratePerUnit,
          subtotal,
          serviceChargePct:    2,
          serviceChargeAmount: svcCharge,
          total:               subtotal + svcCharge,
          responsibleName:     responsibleMap[unitId],
          folio,
        });
        zip.file(`${folio}.pdf`, blob);
      }

      const reportRows: {
        unitNumber: string; tenantName: string;
        consumption?: number; percentage?: number;
        subtotal: number; serviceChargeAmount: number; total: number;
        type: "tenant" | "common" | "company";
      }[] = sortedUnits.map(({ unitId, agg, unitNumber }) => {
        const { subtotal, consumption, percentage } = agg;
        return {
          unitNumber,
          tenantName:          tenantMap[unitId],
          consumption:         consumption ?? undefined,
          percentage:          percentage ?? undefined,
          subtotal,
          serviceChargeAmount: subtotal * 0.02,
          total:               subtotal * 1.02,
          type:                "tenant" as const,
        };
      });

      if (totalConsumption > 0 && ratePerUnit != null) {
        const sumTenant = sortedUnits.reduce((s, { agg }) => s + (agg.consumption ?? 0), 0);
        const commonConsumption = totalConsumption - sumTenant;
        if (commonConsumption > 0) {
          const subtotal = commonConsumption * ratePerUnit;
          reportRows.push({
            unitNumber: "—", tenantName: "Áreas comunes",
            consumption: commonConsumption, percentage: undefined,
            subtotal, serviceChargeAmount: 0, total: subtotal,
            type: "company" as const,
          });
        }
      }

      const reportFolio = `${folioS}-${folioEdif}-RPT-${mm}-${yyyy}`;
      const reportBlob = await getReporteDistribucionPdfBlob({
        legalName,
        address:      companyAddress,
        rfc:          companyTaxId,
        accentColor,
        logoUrl:      logoProxied,
        logoMatzUrl:  logoMatzProxied,
        serviceName:  svcName,
        providerName: meter.provider_name ?? "",
        meterNumber:  meter.meter_number ?? undefined,
        period:       periodLabel,
        buildingName: group.building_name,
        invoiceTotal: totalAmount,
        ratePerUnit,
        consumptionUnit: consumptionUnit ?? undefined,
        invoiceFolio: invoice.folio ?? undefined,
        rows:         reportRows,
        folio:        reportFolio,
      });
      zip.file(`${reportFolio}.pdf`, reportBlob);

      const zipName = `CONSUMO ${svcName.toUpperCase()} ${group.building_name.toUpperCase()} ${MONTH_LABELS[period.month - 1].toUpperCase()} ${yyyy}.zip`;
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${sortedUnits.length} recibo${sortedUnits.length !== 1 ? "s" : ""} + reporte empacados en ZIP.`);
    } catch (err) {
      console.error("PDF generation error", err);
      toast.error("Error al generar PDFs");
    } finally {
      setGeneratingPdfsMeter(null);
    }
  }

  /* ── Metrics (hooks must be before any early return) ─────────── */

  const filteredGroups = useMemo(() => {
    if (!isGroupMode) return groups;
    return groups.filter(g => g.company_id != null && groupCompanyIds.includes(g.company_id));
  }, [isGroupMode, groups, groupCompanyIds]);

  if (loading || !user) return null;

  const totalAmount = filteredGroups.reduce((sum, g) =>
    sum + g.utility_meters.reduce((s, m) => {
      const inv = g.invoices.get(m.id);
      return s + (inv ? Number(inv.total_amount) : 0);
    }, 0), 0);

  const serviceStats = (() => {
    const allMeters = filteredGroups.flatMap(g => g.utility_meters.map(m => ({ m, g })));
    const types = [...new Set(allMeters.map(({ m }) => m.service_type))];
    return types.map(type => {
      const meters = allMeters.filter(({ m }) => m.service_type === type);
      const total      = meters.length;
      const registered = meters.filter(({ m, g }) => {
        const inv = g.invoices.get(m.id);
        return inv != null && inv.status !== "draft";
      }).length;
      return { type, total, registered, allDone: registered === total };
    });
  })();

  /* ── Empty states ─────────────────────────────────────────────── */

  const showNoServices = !pageLoading && !hasAnyMeters;
  const showNoPeriod   = !pageLoading && hasAnyMeters && filteredGroups.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Servicios"
        titleIcon={<Layers size={20} />}
        subtitle="Facturación mensual de servicios por edificio"
      />

      {pendingBuildings.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            borderRadius: "var(--border-radius-lg)",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={16} style={{ color: "var(--metric-value-amber)", flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
              Servicios pendientes de atención
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pendingBuildings.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(`/buildings/${b.id}`)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 10px", borderRadius: "var(--border-radius-md)", gap: 8,
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{b.name}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
                  {b.count} servicio{b.count !== 1 ? "s" : ""} sin configurar
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <PeriodSelector
        year={period.year}
        month={period.month}
        onPrev={prevPeriod}
        onNext={nextPeriod}
      />

      <MetricCircles metrics={[
        { value: filteredGroups.length, label: "Edificios" },
        { value: serviceStats.filter(s => s.allDone).length, label: "Al día", color: "success" },
        { value: serviceStats.filter(s => !s.allDone).length, label: "Pendiente", color: "warning" },
        { value: serviceStats.length, label: "Servicios" },
      ]} />

      <div className="metric-grid-desktop-only" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))", gap: 12, marginBottom: 24 }}>

        {/* Per-service-type cards */}
        {!pageLoading && serviceStats.map(({ type, total, registered, allDone }) => (
          <div
            key={type}
            style={{
              padding: "14px 16px", borderRadius: "var(--border-radius-lg)",
              background: "var(--bg-card)", border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "var(--border-radius-md)", flexShrink: 0,
                background: allDone ? "var(--icon-bg-green)" : "var(--icon-bg-amber)",
                color: allDone ? "var(--icon-color-green)" : "var(--icon-color-amber)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ServiceIcon type={type} size={15} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                {SERVICE_TYPE_LABEL[type as keyof typeof SERVICE_TYPE_LABEL] ?? type}
              </span>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Facturas:{" "}
              <strong style={{ color: "var(--text-primary)" }}>{registered}/{total}</strong>
            </p>
            <p style={{
              margin: 0, fontSize: "0.75rem", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
              color: allDone ? "var(--metric-value-green)" : "var(--metric-value-amber)",
            }}>
              {allDone
                ? <><CheckCircle size={12} /> Al día</>
                : <><Clock size={12} /> Pendiente</>}
            </p>
          </div>
        ))}

        {/* Total facturado */}
        <div style={{
          padding: "14px 16px", borderRadius: "var(--border-radius-lg)",
          background: "var(--bg-card)", border: "1px solid var(--border-default)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "var(--border-radius-md)", flexShrink: 0,
              background: "var(--bg-page)", border: "1px solid var(--border-default)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)",
            }}>
              <TrendingUp size={15} />
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Total facturado
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
            {pageLoading ? "…" : formatMXN(totalAmount)}
          </p>
        </div>

      </div>

      {showNoServices && (
        <SectionCard title="Sin servicios configurados">
          <AppEmptyState
            title="No hay servicios configurados"
            description="Configura los servicios en el detalle de cada edificio."
          />
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
            <UiButton href="/buildings">Ir a Edificios</UiButton>
          </div>
        </SectionCard>
      )}

      {showNoPeriod && (
        <SectionCard title="Sin servicios este período">
          <AppEmptyState
            title={`No hay servicios que facturar en ${MONTH_LABELS[period.month - 1]} ${period.year}`}
            description="Los servicios bimestrales pueden no tocar este mes según su ciclo de facturación."
          />
        </SectionCard>
      )}

      {pageLoading && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando servicios...</p>
      )}

      {!pageLoading && filteredGroups.map(group => {
        const bPend = group.utility_meters.filter(m => !group.invoices.has(m.id)).length;
        const company = isGroupMode ? groupCompanies.find(c => c.id === group.company_id) : undefined;

        return (
          <div key={group.building_id} style={{ marginBottom: 20 }}>
            <SectionCard
              title={group.building_name}
              subtitle={bPend === 0 ? "Todo facturado" : `${bPend} servicio${bPend > 1 ? "s" : ""} pendiente${bPend > 1 ? "s" : ""}`}
            >
              {company && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: company.brand_color || "var(--accent)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{company.short_name || company.name}</span>
                </div>
              )}
              {group.utility_meters.map(meter => {
                const invoice      = group.invoices.get(meter.id) ?? null;
                const parts        = [meter.provider_name, meter.meter_number].filter(Boolean);
                const providerLine = parts.length > 0 ? parts.join(" · ") : null;
                const svcName      = SERVICE_TYPE_LABEL[meter.service_type] ?? meter.service_type;
                const isFixed      = meter.billing_type === "fixed";
                const isShared     = meter.meter_type === "shared" && !isFixed;
                const isExpanded   = expandedMeterId === meter.id;
                return (
                  <div key={meter.id}>
                    <ServiceRow
                      serviceType={meter.service_type}
                      name={svcName}
                      providerLine={providerLine}
                      isbimonthly={meter.billing_frequency === "bimonthly"}
                      generatesCharge={meterGeneratesCharge(meter)}
                      invoice={invoice}
                      amount={invoice ? Number(invoice.total_amount) : null}
                      isShared={isShared}
                      isExpanded={isExpanded}
                      onExpandToggle={isShared ? () => void handleExpand(meter.id) : undefined}
                      billingType={meter.billing_type}
                      fixedAmount={meter.fixed_amount}
                      onGenerateFixedCobro={
                        isFixed && meterGeneratesCharge(meter)
                          ? () => void handleGenerateFixedCobro(meter, group.units)
                          : undefined
                      }
                      generatingFixedCobro={generatingFixedMeter === meter.id}
                      onGeneratePdfs={
                        isShared && invoice != null
                          ? () => void handleGeneratePdfs(meter, invoice, group)
                          : undefined
                      }
                      generatingPdfs={generatingPdfsMeter === meter.id}
                      onUploadInvoice={
                        isFixed && invoice == null
                          ? () => setUploadInvoiceMeter({ meter, building: { id: group.building_id, name: group.building_name } })
                          : undefined
                      }
                      onAction={() => setActiveModal({
                        meter,
                        building: { id: group.building_id, name: group.building_name },
                        existingInvoice: invoice,
                        units: group.units,
                      })}
                    />
                    {isShared && isExpanded && (
                      <SharedMeterDropdown
                        invoice={invoice}
                        detail={detailCache[meter.id]}
                        consumptionUnit={SERVICE_TYPE_UNIT[meter.service_type]}
                      />
                    )}
                  </div>
                );
              })}
            </SectionCard>
          </div>
        );
      })}

      {activeModal && (
        <UtilityInvoiceModal
          isOpen
          meter={activeModal.meter}
          building={activeModal.building}
          period={period}
          companyId={user.company_id!}
          existingInvoice={activeModal.existingInvoice}
          units={activeModal.units}
          onClose={() => setActiveModal(null)}
          onSuccess={() => { setActiveModal(null); void loadData(); }}
        />
      )}

      {uploadInvoiceMeter && (
        <UploadFixedInvoiceModal
          isOpen
          meter={uploadInvoiceMeter.meter}
          building={uploadInvoiceMeter.building}
          period={period}
          companyId={user.company_id!}
          onClose={() => setUploadInvoiceMeter(null)}
          onSuccess={() => { setUploadInvoiceMeter(null); void loadData(); }}
        />
      )}
    </PageContainer>
  );
}
