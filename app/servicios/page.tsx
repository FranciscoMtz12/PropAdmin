"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, ChevronLeft, ChevronRight, Clock,
  DollarSign, Droplets, Flame, Layers, Settings,
  TrendingUp, Wifi, Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import {
  type BuildingUtilityMeter, type ElectricityBill, type BuildingUtilityInvoice,
  meterGeneratesCharge, BILLING_FREQUENCY_LABEL, SERVICE_TYPE_LABEL,
} from "@/lib/types";
import { shouldBillThisPeriod } from "@/lib/service-utils";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import ElectricityBillModal from "@/components/ElectricityBillModal";
import BuildingUtilityInvoiceModal from "@/components/BuildingUtilityInvoiceModal";

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

type CfeMeterRow = {
  id: string;
  meter_number: string;
  building_id: string;
  description: string | null;
  meter_type: string;
};

type BuildingGroup = {
  building_id: string;
  building_name: string;
  cfe_meters: CfeMeterRow[];
  utility_meters: BuildingUtilityMeter[];
  bills: Map<string, ElectricityBill>;         // cfe_meter_id → bill
  invoices: Map<string, BuildingUtilityInvoice>; // meter_id → invoice
  units: { id: string; unit_number: string }[];
};

type ActiveModal =
  | { kind: "cfe"; meter: CfeMeterRow; building: { id: string; name: string }; existingBill: ElectricityBill | null }
  | { kind: "utility"; meter: BuildingUtilityMeter; building: { id: string; name: string }; existingInvoice: BuildingUtilityInvoice | null; units: { id: string; unit_number: string }[] }
  | null;

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
  invoice,
  amount,
  onAction,
}: {
  serviceType: string;
  name: string;
  providerLine: string | null;
  isbimonthly: boolean;
  invoice: { status: string; total_amount: number } | null;
  amount: number | null;
  onAction: () => void;
}) {
  const status = invoice?.status ?? "pending";
  const badge = INVOICE_STATUS_BADGE[status] ?? INVOICE_STATUS_BADGE.pending;
  const actionLabel = ACTION_LABEL[status] ?? "Registrar factura";
  const isBtnPrimary = status === "pending" || status === "draft";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      {/* Icon */}
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

      {/* Name + provider */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
            {name}
          </span>
          {isbimonthly && (
            <AppBadge variant="gray">Bimestral</AppBadge>
          )}
        </div>
        {providerLine && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{providerLine}</span>
        )}
      </div>

      {/* Amount + badge + action */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {amount != null && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: status === "charged" ? "var(--badge-text-green)" : "var(--text-primary)",
            }}
          >
            {formatMXN(amount)}
          </span>
        )}
        <AppBadge variant={badge.variant}>{badge.label}</AppBadge>
        <button
          type="button"
          onClick={onAction}
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

  function prevPeriod() {
    setPeriod(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 });
  }
  function nextPeriod() {
    setPeriod(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 });
  }

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user?.company_id, period.year, period.month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);
    const cid          = user.company_id;
    const { year, month } = period;

    try {
      /* Step 1 — buildings */
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

      /* Step 2 — parallel loads */
      const [cfeRes, umRes, unitsRes, ebRes, uiRes] = await Promise.all([
        supabase.from("cfe_meters")
          .select("id, meter_number, building_id, description, meter_type")
          .in("building_id", bIds)
          .is("deleted_at", null),

        supabase.from("building_utility_meters")
          .select("*")
          .in("building_id", bIds)
          .eq("active", true)
          .is("deleted_at", null),

        supabase.from("units")
          .select("id, unit_number, building_id")
          .in("building_id", bIds)
          .is("deleted_at", null),

        supabase.from("electricity_bills")
          .select("*")
          .in("building_id", bIds)
          .eq("period_year", year)
          .eq("period_month", month)
          .is("deleted_at", null),

        supabase.from("building_utility_invoices")
          .select("*")
          .in("building_id", bIds)
          .eq("period_year", year)
          .eq("period_month", month)
          .is("deleted_at", null),
      ]);

      /* Build lookup maps */
      const cfeMetersByBuilding = new Map<string, CfeMeterRow[]>();
      const utilMetersByBuilding = new Map<string, BuildingUtilityMeter[]>();
      const unitsByBuilding = new Map<string, { id: string; unit_number: string }[]>();
      const billsByCfeMeter = new Map<string, ElectricityBill>();
      const invoicesByMeter = new Map<string, BuildingUtilityInvoice>();

      ((cfeRes.data ?? []) as CfeMeterRow[]).forEach(m => {
        const arr = cfeMetersByBuilding.get(m.building_id) ?? [];
        arr.push(m);
        cfeMetersByBuilding.set(m.building_id, arr);
      });

      ((umRes.data ?? []) as BuildingUtilityMeter[]).forEach(m => {
        const arr = utilMetersByBuilding.get(m.building_id) ?? [];
        arr.push(m);
        utilMetersByBuilding.set(m.building_id, arr);
      });

      ((unitsRes.data ?? []) as { id: string; unit_number: string; building_id: string }[]).forEach(u => {
        const arr = unitsByBuilding.get(u.building_id) ?? [];
        arr.push({ id: u.id, unit_number: u.unit_number });
        unitsByBuilding.set(u.building_id, arr);
      });

      ((ebRes.data ?? []) as ElectricityBill[]).forEach(b => {
        billsByCfeMeter.set(b.cfe_meter_id, b);
      });

      ((uiRes.data ?? []) as BuildingUtilityInvoice[]).forEach(i => {
        invoicesByMeter.set(i.building_utility_meter_id, i);
      });

      /* Count all configured meters (before period filter) for empty-state detection */
      const totalConfigured =
        [...cfeMetersByBuilding.values()].reduce((n, arr) => n + arr.length, 0) +
        [...utilMetersByBuilding.values()].reduce((n, arr) => n + arr.filter(meterGeneratesCharge).length, 0);
      setHasAnyMeters(totalConfigured > 0);

      /* Build per-building groups, filtering utility meters by period */
      const result: BuildingGroup[] = (buildingsData as { id: string; name: string }[])
        .map(b => {
          const cfeMeters = cfeMetersByBuilding.get(b.id) ?? [];
          const utilMeters = (utilMetersByBuilding.get(b.id) ?? [])
            .filter(m => meterGeneratesCharge(m))
            .filter(m => shouldBillThisPeriod(m, year, month));
          return {
            building_id:   b.id,
            building_name: b.name,
            cfe_meters:    cfeMeters,
            utility_meters: utilMeters,
            bills:    billsByCfeMeter,
            invoices: invoicesByMeter,
            units:    unitsByBuilding.get(b.id) ?? [],
          };
        })
        .filter(g => g.cfe_meters.length > 0 || g.utility_meters.length > 0);

      setGroups(result);
    } catch (err) {
      console.error("Servicios load error", err);
    }
    setPageLoading(false);
  }

  if (loading || !user) return null;

  /* ── Metrics ──────────────────────────────────────────────────── */

  const pendingCount = groups.reduce((n, g) => {
    const cfePend  = g.cfe_meters.filter(m => !g.bills.has(m.id)).length;
    const utilPend = g.utility_meters.filter(m => !g.invoices.has(m.id)).length;
    return n + cfePend + utilPend;
  }, 0);

  const registeredCount = groups.reduce((n, g) => {
    const cfeDone  = [...g.bills.values()].filter(b => b.status !== "draft").length;
    const utilDone = [...g.invoices.values()].filter(i => i.status !== "draft").length;
    return n + cfeDone + utilDone;
  }, 0);

  const cobrosCount = groups.reduce((n, g) => {
    const cfeCobros  = [...g.bills.values()].filter(b => b.status === "distributed" || b.status === "charged").length;
    const utilCobros = [...g.invoices.values()].filter(i => i.status === "distributed" || i.status === "charged").length;
    return n + cfeCobros + utilCobros;
  }, 0);

  const totalAmount = groups.reduce((sum, g) => {
    const cfeSum  = [...g.bills.values()].reduce((s, b) => s + Number(b.total_amount), 0);
    const utilSum = [...g.invoices.values()].reduce((s, i) => s + Number(i.total_amount), 0);
    return sum + cfeSum + utilSum;
  }, 0);

  /* ── Empty states ─────────────────────────────────────────────── */

  const showNoServices    = !pageLoading && !hasAnyMeters;
  const showNoPeriod      = !pageLoading && hasAnyMeters && groups.length === 0;

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

      {/* ── Métricas ──────────────────────────────────────────────── */}
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

      {/* ── Empty states ──────────────────────────────────────────── */}
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

      {/* ── Loading ────────────────────────────────────────────────── */}
      {pageLoading && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando servicios...</p>
      )}

      {/* ── Per-building cards ─────────────────────────────────────── */}
      {!pageLoading && groups.map(group => {
        const bPend =
          group.cfe_meters.filter(m => !group.bills.has(m.id)).length +
          group.utility_meters.filter(m => !group.invoices.has(m.id)).length;

        return (
          <div key={group.building_id} style={{ marginBottom: 20 }}>
            <SectionCard
              title={group.building_name}
              subtitle={bPend === 0 ? "Todo facturado" : `${bPend} servicio${bPend > 1 ? "s" : ""} pendiente${bPend > 1 ? "s" : ""}`}
            >
              {/* CFE meters */}
              {group.cfe_meters.map(cfeMeter => {
                const bill = group.bills.get(cfeMeter.id) ?? null;
                const providerLine = cfeMeter.description
                  ? `CFE · ${cfeMeter.description} · ${cfeMeter.meter_number}`
                  : `CFE · ${cfeMeter.meter_number}`;
                return (
                  <ServiceRow
                    key={cfeMeter.id}
                    serviceType="electricity"
                    name="Electricidad CFE"
                    providerLine={providerLine}
                    isbimonthly={false}
                    invoice={bill}
                    amount={bill ? Number(bill.total_amount) : null}
                    onAction={() => setActiveModal({
                      kind: "cfe",
                      meter: cfeMeter,
                      building: { id: group.building_id, name: group.building_name },
                      existingBill: bill,
                    })}
                  />
                );
              })}

              {/* Generic utility meters */}
              {group.utility_meters.map(meter => {
                const invoice = group.invoices.get(meter.id) ?? null;
                const parts = [
                  meter.provider_name,
                  meter.meter_number,
                ].filter(Boolean);
                const providerLine = parts.length > 0 ? parts.join(" · ") : null;
                const svcName = SERVICE_TYPE_LABEL[meter.service_type] ?? meter.service_type;
                return (
                  <ServiceRow
                    key={meter.id}
                    serviceType={meter.service_type}
                    name={svcName}
                    providerLine={providerLine}
                    isbimonthly={meter.billing_frequency === "bimonthly"}
                    invoice={invoice}
                    amount={invoice ? Number(invoice.total_amount) : null}
                    onAction={() => setActiveModal({
                      kind: "utility",
                      meter,
                      building: { id: group.building_id, name: group.building_name },
                      existingInvoice: invoice,
                      units: group.units,
                    })}
                  />
                );
              })}
            </SectionCard>
          </div>
        );
      })}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {activeModal?.kind === "cfe" && (
        <ElectricityBillModal
          cfeMeter={activeModal.meter}
          buildingName={activeModal.building.name}
          companyId={user.company_id}
          period={period}
          existingBill={activeModal.existingBill}
          onClose={() => setActiveModal(null)}
          onSuccess={() => { setActiveModal(null); void loadData(); }}
        />
      )}

      {activeModal?.kind === "utility" && (
        <BuildingUtilityInvoiceModal
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
