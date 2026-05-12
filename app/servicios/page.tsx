"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock,
  DollarSign, Droplets, Flame, Layers, Settings,
  TrendingUp, Wifi, Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import {
  type BuildingUtilityMeter, type BuildingUtilityInvoice,
  meterGeneratesCharge, SERVICE_TYPE_LABEL, SERVICE_TYPE_UNIT,
} from "@/lib/types";
import { sortByNatural } from "@/lib/sort-utils";
import { shouldBillThisPeriod } from "@/lib/service-utils";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import UtilityInvoiceModal from "@/components/UtilityInvoiceModal";

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

/* ─── Types ──────────────────────────────────────────────────────── */

type BuildingGroup = {
  building_id: string;
  building_name: string;
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

const TH_L  = { padding: "8px 10px", textAlign: "left"  as const, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em", whiteSpace: "nowrap" as const };
const TH_R  = { ...TH_L, textAlign: "right" as const };
const TD_L  = { padding: "9px 10px", fontSize: 13, textAlign: "left"  as const, borderTop: "1px solid var(--border-default)", verticalAlign: "middle" as const };
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
          borderRadius: 8,
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
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
            {name}
          </span>
          {isbimonthly && <AppBadge variant="gray">Bimestral</AppBadge>}
          {generatesCharge
            ? <AppBadge variant="blue">Genera cobro</AppBadge>
            : <AppBadge variant="gray">Gasto del edificio</AppBadge>}
        </div>
        {providerLine && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{providerLine}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {amount != null && (
          <span
            style={{
              fontSize: 13,
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
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: isBtnPrimary ? "none" : "1px solid var(--border-default)",
                background: isBtnPrimary ? "#8B2252" : "transparent",
                color: isBtnPrimary ? "#fff" : "var(--text-primary)",
                whiteSpace: "nowrap",
              }}
            >
              {actionLabel}
            </button>
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
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: "#8B2252",
                  color: "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                Registrar factura
              </button>
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
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden" as const,
  };

  if (!invoice) {
    return (
      <div style={{ ...panelStyle, padding: "14px 16px" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
          Registra la factura del proveedor para ver la distribución
        </p>
      </div>
    );
  }

  if (detail === "loading" || detail === undefined) {
    return (
      <div style={{ ...panelStyle, padding: "14px 16px" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Cargando...</p>
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
          <span style={{ fontSize: 13 }}>
            Precio/{unit}: <strong>{formatMXN(precioUnit)}</strong>
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin consumo total registrado en la factura</span>
        )}
      </div>

      {/* No-readings banner */}
      {!detail.hasReadings && (
        <div style={{ margin: "10px 14px 0", padding: "10px 12px", background: "#fef3c7", borderRadius: 8, fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
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
                    <strong style={{ fontSize: 14 }}>Depa {sm.unit_number}</strong>
                    {sm.sub_meter_number && sm.sub_meter_number !== sm.unit_number && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>— {sm.sub_meter_number}</span>
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
                <td style={{ ...TD_L, fontStyle: "italic", color: "var(--text-muted)", fontSize: 12 }}>
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
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Total cobrado a inquilinos: <strong style={{ color: "var(--text-primary)" }}>{formatMXN(totalInquilinos)}</strong>
        </span>
        {montoAreas != null && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Absorción empresa: <strong style={{ color: "var(--text-primary)" }}>{formatMXN(montoAreas)}</strong>
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
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
          width: 36, height: 36, borderRadius: "8px 0 0 8px",
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
          fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
          minWidth: 160, justifyContent: "center",
        }}
      >
        {MONTH_LABELS[month - 1]} {year}
      </div>
      <button
        type="button"
        onClick={onNext}
        style={{
          width: 36, height: 36, borderRadius: "0 8px 8px 0",
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
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    const ok = user.role === "administracion" || user.role === "superadmin" || user.is_superadmin;
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
    if (user?.company_id) void loadData();
  }, [user?.company_id, period.year, period.month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);
    const cid = user.company_id;
    const { year, month } = period;

    try {
      const { data: buildingsData, error: bErr } = await supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", cid)
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

      const result: BuildingGroup[] = (buildingsData as { id: string; name: string }[])
        .map(b => {
          const utilMeters = (utilMetersByBuilding.get(b.id) ?? [])
            .filter(m => shouldBillThisPeriod(m, year, month));
          return {
            building_id:    b.id,
            building_name:  b.name,
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

  if (loading || !user) return null;

  /* ── Metrics ──────────────────────────────────────────────────── */

  const pendingCount = groups.reduce((n, g) =>
    n + g.utility_meters.filter(m => !g.invoices.has(m.id)).length, 0);

  const registeredCount = groups.reduce((n, g) =>
    n + g.utility_meters.filter(m => {
      const inv = g.invoices.get(m.id);
      return inv != null && inv.status !== "draft";
    }).length, 0);

  const cobrosCount = groups.reduce((n, g) =>
    n + g.utility_meters.filter(m => {
      const inv = g.invoices.get(m.id);
      return inv?.status === "distributed" || inv?.status === "charged";
    }).length, 0);

  const totalAmount = groups.reduce((sum, g) =>
    sum + g.utility_meters.reduce((s, m) => {
      const inv = g.invoices.get(m.id);
      return s + (inv ? Number(inv.total_amount) : 0);
    }, 0), 0);

  /* ── Empty states ─────────────────────────────────────────────── */

  const showNoServices = !pageLoading && !hasAnyMeters;
  const showNoPeriod   = !pageLoading && hasAnyMeters && groups.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Servicios"
        titleIcon={<Layers size={20} />}
        subtitle="Facturación mensual de servicios por edificio"
      />

      <PeriodSelector
        year={period.year}
        month={period.month}
        onPrev={prevPeriod}
        onNext={nextPeriod}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 24 }}>
        <MetricCard
          label="Servicios pendientes"
          value={pageLoading ? "…" : pendingCount}
          icon={<Clock size={18} />}
          variant={pageLoading ? "neutral" : pendingCount > 0 ? "amber" : "green"}
        />
        <MetricCard
          label="Facturas registradas"
          value={pageLoading ? "…" : registeredCount}
          icon={<CheckCircle size={18} />}
          variant={pageLoading ? "neutral" : registeredCount > 0 ? "green" : "neutral"}
        />
        <MetricCard
          label="Cobros generados"
          value={pageLoading ? "…" : cobrosCount}
          icon={<DollarSign size={18} />}
          variant={pageLoading ? "neutral" : cobrosCount > 0 ? "green" : "neutral"}
        />
        <MetricCard
          label="Total facturado"
          value={pageLoading ? "…" : formatMXN(totalAmount)}
          icon={<TrendingUp size={18} />}
          variant="neutral"
        />
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
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando servicios...</p>
      )}

      {!pageLoading && groups.map(group => {
        const bPend = group.utility_meters.filter(m => !group.invoices.has(m.id)).length;

        return (
          <div key={group.building_id} style={{ marginBottom: 20 }}>
            <SectionCard
              title={group.building_name}
              subtitle={bPend === 0 ? "Todo facturado" : `${bPend} servicio${bPend > 1 ? "s" : ""} pendiente${bPend > 1 ? "s" : ""}`}
            >
              {group.utility_meters.map(meter => {
                const invoice    = group.invoices.get(meter.id) ?? null;
                const parts      = [meter.provider_name, meter.meter_number].filter(Boolean);
                const providerLine = parts.length > 0 ? parts.join(" · ") : null;
                const svcName    = SERVICE_TYPE_LABEL[meter.service_type] ?? meter.service_type;
                const isShared   = meter.meter_type === "shared";
                const isExpanded = expandedMeterId === meter.id;
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
          companyId={user.company_id}
          existingInvoice={activeModal.existingInvoice}
          units={activeModal.units}
          onClose={() => setActiveModal(null)}
          onSuccess={() => { setActiveModal(null); void loadData(); }}
        />
      )}
    </PageContainer>
  );
}
