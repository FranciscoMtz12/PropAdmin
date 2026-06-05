"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, DollarSign, Layers, LayoutDashboard } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCircles from "@/components/MetricCircles";
import SectionCard from "@/components/SectionCard";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, n: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

function chargesMeter(m: { meter_type: string; billing_mode: string; contract_holder: string }) {
  if (m.meter_type === "dedicated") return m.contract_holder === "company";
  return m.billing_mode === "charged";
}

/* ─── Types ──────────────────────────────────────────────────────── */

type ExpiringRow = {
  id: string;
  tenantName: string;
  buildingName: string;
  unitLabel: string;
  endDate: string;
  daysLeft: number;
};

type BuildingCollRow = {
  id: string;
  name: string;
  expected: number;
  collected: number;
  pct: number;
};

/* ─── Page ───────────────────────────────────────────────────────── */

export default function DashboardAdministracionPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    const ok = user.role === "administracion" || user.role === "superadmin" || user.is_superadmin;
    if (!ok) router.replace("/dashboard");
  }, [user, loading, router]);

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const [pageLoading, setPageLoading] = useState(true);
  const [totalUnits,   setTotalUnits]   = useState(0);
  const [occupiedUnits, setOccupied]    = useState(0);
  const [collectedAmt, setCollected]    = useState(0);
  const [expectedAmt,  setExpected]     = useState(0);
  const [pendingCnt,   setPendingCnt]   = useState(0);
  const [pendingAmt,   setPendingAmt]   = useState(0);
  const [servicesPending, setServices]  = useState(0);
  const [expiringLeases, setExpiring]   = useState<ExpiringRow[]>([]);
  const [buildingColl,   setBuildingColl] = useState<BuildingCollRow[]>([]);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user?.company_id, year, month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);
    const cid   = user.company_id;
    const today = todayKey();
    const in60  = addDays(today, 60);

    try {
      const [
        unitsRes, leasesRes, tenantsRes, buildingsRes,
        collRes, utilMRes, utilInvRes,
      ] = await Promise.all([
        supabase.from("units")
          .select("id, status, building_id, unit_number, display_code")
          .eq("company_id", cid).is("deleted_at", null),
        supabase.from("leases")
          .select("id, unit_id, tenant_id, status, end_date")
          .eq("company_id", cid).is("deleted_at", null).eq("status", "ACTIVE"),
        supabase.from("tenants")
          .select("id, full_name")
          .eq("company_id", cid).is("deleted_at", null),
        supabase.from("buildings")
          .select("id, name")
          .eq("company_id", cid).is("deleted_at", null),
        supabase.from("collection_records")
          .select("id, building_id, amount_due, amount_collected, status")
          .eq("company_id", cid).eq("period_year", year).eq("period_month", month).is("deleted_at", null),
        supabase.from("building_utility_meters")
          .select("id, meter_type, billing_mode, contract_holder")
          .eq("company_id", cid).eq("active", true).is("deleted_at", null),
        supabase.from("building_utility_invoices")
          .select("id, building_utility_meter_id")
          .eq("company_id", cid).eq("period_year", year).eq("period_month", month).is("deleted_at", null),
      ]);

      /* Ocupación */
      type UnitRow = { id: string; status: string; building_id: string; unit_number: string | null; display_code: string | null };
      const units = (unitsRes.data || []) as UnitRow[];
      const occupied = units.filter(u => ["RENTED","OCCUPIED","PARTIAL"].includes((u.status || "").toUpperCase())).length;
      setTotalUnits(units.length);
      setOccupied(occupied);

      /* Cobranza del mes */
      type CollRow = { id: string; building_id: string; amount_due: number; amount_collected: number | null; status: string };
      const coll = (collRes.data || []) as CollRow[];
      const collectedSum = coll.filter(r => ["collected","partial"].includes(r.status)).reduce((s, r) => s + (r.amount_collected ?? 0), 0);
      const expectedSum  = coll.reduce((s, r) => s + r.amount_due, 0);
      const pendingRecs  = coll.filter(r => ["pending","overdue"].includes(r.status));
      const pendingSum   = pendingRecs.reduce((s, r) => s + (r.amount_due - (r.amount_collected ?? 0)), 0);
      setCollected(collectedSum);
      setExpected(expectedSum);
      setPendingCnt(pendingRecs.length);
      setPendingAmt(pendingSum);

      /* Servicios por facturar */
      type MRow = { id: string; meter_type: string; billing_mode: string; contract_holder: string };
      const utilM      = (utilMRes.data  || []) as MRow[];
      const invoicedIds = new Set((utilInvRes.data || []).map((i: any) => i.building_utility_meter_id as string));
      const pendingUtil = utilM.filter(m => chargesMeter(m) && !invoicedIds.has(m.id)).length;
      setServices(pendingUtil);

      /* Contratos por vencer */
      const tenantMap   = new Map(((tenantsRes.data || []) as Array<{ id: string; full_name: string }>).map(t => [t.id, t.full_name]));
      const buildingMap = new Map(((buildingsRes.data || []) as Array<{ id: string; name: string }>).map(b => [b.id, b.name]));
      const unitMap     = new Map(units.map(u => [u.id, u]));

      type LeaseRow = { id: string; unit_id: string | null; tenant_id: string | null; status: string | null; end_date: string | null };
      const leases = (leasesRes.data || []) as LeaseRow[];
      const expiring = leases
        .filter(l => l.end_date && l.end_date >= today && l.end_date <= in60)
        .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""))
        .slice(0, 8)
        .map(l => {
          const unit = l.unit_id ? unitMap.get(l.unit_id) : undefined;
          return {
            id:           l.id,
            tenantName:   l.tenant_id ? (tenantMap.get(l.tenant_id) ?? "Sin inquilino") : "Sin inquilino",
            buildingName: unit ? (buildingMap.get(unit.building_id) ?? "—") : "—",
            unitLabel:    unit ? (unit.display_code ?? unit.unit_number ?? "—") : "—",
            endDate:      l.end_date ?? "",
            daysLeft:     daysBetween(today, l.end_date ?? today),
          };
        });
      setExpiring(expiring);

      /* Cobranza por edificio */
      const buildings = (buildingsRes.data || []) as Array<{ id: string; name: string }>;
      const bRows: BuildingCollRow[] = buildings.map(b => {
        const bc  = coll.filter(r => r.building_id === b.id);
        const exp = bc.reduce((s, r) => s + r.amount_due, 0);
        const col = bc.filter(r => ["collected","partial"].includes(r.status)).reduce((s, r) => s + (r.amount_collected ?? 0), 0);
        return { id: b.id, name: b.name, expected: exp, collected: col, pct: exp > 0 ? Math.round((col / exp) * 100) : 0 };
      }).filter(b => b.expected > 0).sort((a, b) => a.pct - b.pct);
      setBuildingColl(bRows);

    } catch (err) {
      console.error("Dashboard administracion error", err);
    }
    setPageLoading(false);
  }

  if (loading || !user) return null;

  const occPct      = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const occVariant  = occPct >= 80 ? "green" : occPct >= 60 ? "amber" : "red";
  const collPct     = expectedAmt > 0 ? Math.round((collectedAmt / expectedAmt) * 100) : 0;
  const collVariant = collPct >= 90 ? "green" : collPct >= 70 ? "amber" : "red";

  const monthLabel  = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const subtitle    = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard — Administración"
        titleIcon={<LayoutDashboard size={20} />}
        subtitle={subtitle}
      />

      {/* ── Fila 1: Métricas ──────────────────────────────────────── */}
      <MetricCircles metrics={[
        { value: pageLoading ? "…" : `${occupiedUnits}/${totalUnits}`, label: "Ocupación", color: pageLoading ? "default" : occVariant === "green" ? "success" : occVariant === "amber" ? "warning" : "danger" },
        { value: pageLoading ? "…" : formatMXN(collectedAmt), label: "Cobranza", color: pageLoading ? "default" : collVariant === "green" ? "success" : "warning" },
        { value: pageLoading ? "…" : pendingCnt, label: "Pendientes", color: pageLoading ? "default" : pendingCnt > 0 ? "danger" : "success" },
        { value: pageLoading ? "…" : servicesPending, label: "Servicios", color: pageLoading ? "default" : servicesPending > 0 ? "warning" : "success" },
      ]} />

      {/* ── Fila 2: Dos columnas ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(21.25rem, 1fr))", gap: 24 }}>

        {/* Contratos por vencer */}
        <SectionCard title="Contratos por vencer" subtitle="Próximos 60 días">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : expiringLeases.length === 0 ? (
            <AppEmptyState
              title="Sin contratos por vencer"
              description="No hay contratos activos que venzan en los próximos 60 días."
            />
          ) : (
            <AppTable
              minWidth={0}
              rows={expiringLeases}
              columns={[
                {
                  key: "tenant",
                  header: "Inquilino",
                  render: (row) => (
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.8125rem", display: "block", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.tenantName}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {row.buildingName} · {row.unitLabel}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "days",
                  header: "Vence",
                  align: "right",
                  width: 110,
                  render: (row) => {
                    const v = row.daysLeft <= 15 ? "red" : row.daysLeft <= 30 ? "red" : "amber";
                    const l = row.daysLeft <= 15 ? "Urgente" : row.daysLeft <= 30 ? "Pronto" : "Este bimestre";
                    return (
                      <div style={{ textAlign: "right" }}>
                        <AppBadge variant={v}>{l}</AppBadge>
                        <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {row.daysLeft} días
                        </span>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}
        </SectionCard>

        {/* Cobranza por edificio */}
        <SectionCard title="Cobranza por edificio" subtitle="Mes actual — menor % primero">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : buildingColl.length === 0 ? (
            <AppEmptyState
              title="Sin datos de cobranza"
              description="No hay cobros registrados para el mes actual."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {buildingColl.map(b => (
                <div key={b.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{b.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatMXN(b.collected)}{" "}
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/ {formatMXN(b.expected)}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "var(--border-default)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(b.pct, 100)}%`,
                        background: b.pct >= 90 ? "var(--metric-bg-green)" : b.pct >= 70 ? "var(--metric-bg-amber)" : "var(--metric-bg-red)",
                        borderRadius: 99,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 3, display: "block" }}>
                    {b.pct}% cobrado
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

      </div>
    </PageContainer>
  );
}
