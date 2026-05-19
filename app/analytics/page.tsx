"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Users,
  Building2,
  Clock3,
  Home,
  TrendingUp,
  KeyRound,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";

/* ═══ Tipos ═══════════════════════════════════════════════════════ */

type Unit = {
  id: string;
  building_id: string;
  unit_type_id: string | null;
  status: string;
  display_code: string | null;
  unit_number: string | null;
};
type UnitType = { id: string; name: string; bedrooms: number | null; building_id: string };
type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  rent_amount: number | null;
};
type CollectionRecord = {
  id: string;
  unit_id: string;
  lease_id: string | null;
  building_id: string;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: string;
  paid_at: string | null;
};
type Tenant = { id: string; full_name: string };
type Building = { id: string; name: string };

/* ═══ Constantes visuales ═════════════════════════════════════════ */

const BUILDING_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#06B6D4", "#A855F7",
];

const MONTH_LABELS_SHORT = [
  "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic",
];

/* ═══ Helpers ═════════════════════════════════════════════════════ */

function isOccupiedStatus(s: string | null | undefined) {
  const u = (s || "").toUpperCase();
  return u === "RENTED" || u === "OCCUPIED" || u === "PARTIAL";
}

function isVacantStatus(s: string | null | undefined) {
  return (s || "").toUpperCase() === "VACANT";
}

function formatCurrency(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function monthsBetween(startISO: string, endISO: string) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_LABELS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/* ═══ Página ══════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const allowedRoles = ["superadmin", "administracion", "directivo"];
  const hasAccess =
    !!user &&
    (allowedRoles.includes(user.role) || Boolean(user.is_superadmin));

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    if (!hasAccess) { router.replace("/dashboard"); return; }
    void loadData();
  }, [loading, user, hasAccess, router]);

  async function loadData() {
    if (!user?.company_id) return;
    setLoadingData(true);

    const today = new Date();
    const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1)
      .toISOString()
      .slice(0, 10);

    const [unitsRes, unitTypesRes, leasesRes, tenantsRes, buildingsRes, collectionsRes] =
      await Promise.all([
        supabase
          .from("units")
          .select("id, building_id, unit_type_id, status, display_code, unit_number")
          .eq("company_id", user.company_id)
          .is("deleted_at", null),
        supabase
          .from("unit_types")
          .select("id, name, bedrooms, building_id")
          .eq("company_id", user.company_id)
          .is("deleted_at", null),
        supabase
          .from("leases")
          .select("id, unit_id, tenant_id, status, start_date, end_date, rent_amount")
          .eq("company_id", user.company_id)
          .is("deleted_at", null),
        supabase
          .from("tenants")
          .select("id, full_name")
          .eq("company_id", user.company_id)
          .is("deleted_at", null),
        supabase
          .from("buildings")
          .select("id, name")
          .eq("company_id", user.company_id)
          .is("deleted_at", null),
        supabase
          .from("collection_records")
          .select("id, unit_id, lease_id, building_id, period_year, period_month, due_date, amount_due, amount_collected, status, paid_at")
          .eq("company_id", user.company_id)
          .is("deleted_at", null)
          .gte("due_date", twelveMonthsAgo),
      ]);

    const errs = [unitsRes, unitTypesRes, leasesRes, tenantsRes, buildingsRes, collectionsRes]
      .filter((r) => r.error);
    if (errs.length) {
      errs.forEach((r) => console.error("analytics fetch failed", r.error));
    }

    setUnits((unitsRes.data as Unit[]) || []);
    setUnitTypes((unitTypesRes.data as UnitType[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setTenants((tenantsRes.data as Tenant[]) || []);
    setBuildings((buildingsRes.data as Building[]) || []);
    setCollectionRecords((collectionsRes.data as CollectionRecord[]) || []);
    setLoadingData(false);
  }

  /* ── Derivados ────────────────────────────────────────────────── */

  const unitTypeById = useMemo(() => new Map(unitTypes.map((t) => [t.id, t])), [unitTypes]);
  const buildingById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const activeLeases = useMemo(() => leases.filter((l) => l.status === "ACTIVE"), [leases]);

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => isOccupiedStatus(u.status)).length;
  const vacantUnits = units.filter((u) => isVacantStatus(u.status)).length;
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  // Personas estimadas: suma de bedrooms de las tipologías de unidades ocupadas, o 1 si no tiene tipo
  const estimatedPeople = useMemo(() => {
    return units
      .filter((u) => isOccupiedStatus(u.status))
      .reduce((sum, u) => {
        const t = u.unit_type_id ? unitTypeById.get(u.unit_type_id) : null;
        return sum + Math.max(1, t?.bedrooms ?? 1);
      }, 0);
  }, [units, unitTypeById]);

  // Contratos que vencen en 30 días
  const leasesExpiring30 = useMemo(() => {
    const now = Date.now();
    const in30 = now + 30 * 24 * 60 * 60 * 1000;
    return activeLeases
      .filter((l) => {
        if (!l.end_date) return false;
        const t = new Date(l.end_date).getTime();
        return t >= now && t <= in30;
      })
      .sort((a, b) => (a.end_date || "").localeCompare(b.end_date || ""));
  }, [activeLeases]);

  /* ── Ocupación por edificio ────────────────────────────────────── */
  const occupancyByBuilding = useMemo(() => {
    return buildings
      .map((b) => {
        const buildingUnits = units.filter((u) => u.building_id === b.id);
        const total = buildingUnits.length;
        const occ = buildingUnits.filter((u) => isOccupiedStatus(u.status)).length;
        const rate = total > 0 ? (occ / total) * 100 : 0;
        return { id: b.id, name: b.name, occ, total, rate };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [buildings, units]);

  /* ── Desempeño por tipología ──────────────────────────────────── */
  const typologyPerformance = useMemo(() => {
    return unitTypes.map((t) => {
      const typeUnits = units.filter((u) => u.unit_type_id === t.id);
      const total = typeUnits.length;
      const occ = typeUnits.filter((u) => isOccupiedStatus(u.status)).length;
      const rate = total > 0 ? (occ / total) * 100 : 0;

      // Días promedio vacío: para cada unidad de este tipo, gaps entre leases consecutivos
      const gaps: number[] = [];
      typeUnits.forEach((u) => {
        const unitLeases = leases
          .filter((l) => l.unit_id === u.id && l.start_date && l.end_date)
          .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
        for (let i = 0; i < unitLeases.length - 1; i++) {
          const endI = unitLeases[i].end_date!;
          const startNext = unitLeases[i + 1].start_date!;
          const gap = daysBetween(endI, startNext);
          if (gap >= 0 && gap < 365 * 2) gaps.push(gap);
        }
      });
      const avgVacancy = gaps.length >= 3 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

      const demand: "alta" | "media" | "baja" = rate >= 85 ? "alta" : rate >= 60 ? "media" : "baja";

      return {
        id: t.id,
        name: t.name,
        total,
        occupied: occ,
        rate,
        avgVacancy,
        demand,
        bedrooms: t.bedrooms ?? 1,
      };
    });
  }, [unitTypes, units, leases]);

  /* ── Rotación por unidad ──────────────────────────────────────── */
  const rotationRanking = useMemo(() => {
    const counts = new Map<string, number>();
    leases.forEach((l) => {
      if (!l.unit_id) return;
      counts.set(l.unit_id, (counts.get(l.unit_id) ?? 0) + 1);
    });
    const ranked = Array.from(counts.entries())
      .map(([unitId, count]) => {
        const u = unitById.get(unitId);
        const b = u ? buildingById.get(u.building_id) : undefined;
        return {
          unitId,
          label: u?.display_code || u?.unit_number || unitId.slice(0, 6),
          building: b?.name || "—",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    return ranked;
  }, [leases, unitById, buildingById]);

  const maxRotation = rotationRanking[0]?.count ?? 1;

  /* ── Contratos más largos ─────────────────────────────────────── */
  const longestLeases = useMemo(() => {
    return activeLeases
      .filter((l) => l.start_date && l.end_date)
      .map((l) => {
        const duration = monthsBetween(l.start_date!, l.end_date!);
        const u = unitById.get(l.unit_id);
        const b = u ? buildingById.get(u.building_id) : undefined;
        const t = tenantById.get(l.tenant_id);
        return {
          id: l.id,
          tenant: t?.full_name || "—",
          unit: u?.display_code || u?.unit_number || "—",
          building: b?.name || "—",
          start: l.start_date!,
          end: l.end_date!,
          duration,
        };
      })
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }, [activeLeases, unitById, buildingById, tenantById]);

  /* ── Line: ocupación histórica 6 meses ────────────────────────── */
  const occupancyHistory = useMemo(() => {
    const now = new Date();
    const months: { y: number; m: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }
    const total = totalUnits || 1;
    return months.map(({ y, m }) => {
      const label = MONTH_LABELS_SHORT[m - 1] + " " + String(y).slice(2);
      const monthStart = new Date(y, m - 1, 1).getTime();
      const monthEnd = new Date(y, m, 0, 23, 59, 59).getTime();
      // Unidades con algún lease activo ese mes
      const occupiedSet = new Set<string>();
      leases.forEach((l) => {
        if (!l.start_date) return;
        const s = new Date(l.start_date).getTime();
        const e = l.end_date ? new Date(l.end_date).getTime() : Infinity;
        if (s <= monthEnd && e >= monthStart) occupiedSet.add(l.unit_id);
      });
      const occ = occupiedSet.size;
      const vacant = Math.max(0, total - occ);
      const rate = (occ / total) * 100;
      return { mes: label, ocupacion: Math.round(rate), vacantes: vacant };
    });
  }, [leases, totalUnits]);

  /* ── Eficiencia de cobro por edificio ──────────────────────────── */
  const collectionEfficiency = useMemo(() => {
    return buildings
      .map((b) => {
        const records = collectionRecords.filter((r) => r.building_id === b.id);
        const totalDue = records.reduce((s, r) => s + (r.amount_due ?? 0), 0);
        const totalCollected = records.reduce((s, r) => s + (r.amount_collected ?? 0), 0);
        const rate = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;
        const missing = Math.max(0, totalDue - totalCollected);
        return { id: b.id, name: b.name, totalDue, totalCollected, rate, missing };
      })
      .filter((b) => b.totalDue > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [buildings, collectionRecords]);

  /* ── Comportamiento de pago por inquilino ──────────────────────── */
  const tenantPaymentBehavior = useMemo(() => {
    const byTenant = new Map<string, { due: number; collected: number; paid: number; late: number; lateDays: number[] }>();

    collectionRecords.forEach((r) => {
      const lease = r.lease_id ? leases.find((l) => l.id === r.lease_id) : null;
      if (!lease) return;
      const tenantId = lease.tenant_id;
      if (!tenantId) return;
      const prev = byTenant.get(tenantId) || { due: 0, collected: 0, paid: 0, late: 0, lateDays: [] };
      prev.due += r.amount_due ?? 0;
      prev.collected += r.amount_collected ?? 0;
      if (r.paid_at) {
        prev.paid += 1;
        const lateBy = daysBetween(r.due_date, r.paid_at);
        if (lateBy > 0) {
          prev.late += 1;
          prev.lateDays.push(lateBy);
        }
      }
      byTenant.set(tenantId, prev);
    });

    return Array.from(byTenant.entries())
      .map(([tenantId, data]) => {
        const tenant = tenantById.get(tenantId);
        // Buscar el edificio via su lease activo
        const activeLease = activeLeases.find((l) => l.tenant_id === tenantId);
        const unit = activeLease ? unitById.get(activeLease.unit_id) : null;
        const building = unit ? buildingById.get(unit.building_id) : null;

        const collectedRate = data.due > 0 ? (data.collected / data.due) * 100 : 0;
        const punctualityRate = data.paid > 0 ? ((data.paid - data.late) / data.paid) * 100 : 0;
        const avgLateDays = data.lateDays.length > 0
          ? Math.round(data.lateDays.reduce((a, b) => a + b, 0) / data.lateDays.length)
          : 0;

        let evaluation: "excelente" | "bueno" | "regular" | "atencion";
        if (collectedRate >= 95 && punctualityRate >= 80) evaluation = "excelente";
        else if (collectedRate >= 80) evaluation = "bueno";
        else if (collectedRate >= 60) evaluation = "regular";
        else evaluation = "atencion";

        return {
          tenantId,
          tenantName: tenant?.full_name || "—",
          building: building?.name || "—",
          collectedRate,
          punctualityRate,
          avgLateDays,
          evaluation,
          totalPayments: data.paid,
        };
      })
      .filter((r) => r.totalPayments > 0)
      .sort((a, b) => b.collectedRate - a.collectedRate);
  }, [collectionRecords, leases, activeLeases, tenantById, unitById, buildingById]);

  /* ── Historial de precios de renta ─────────────────────────────── */
  const rentHistory = useMemo(() => {
    return units
      .filter((u) => isOccupiedStatus(u.status))
      .map((u) => {
        const unitLeases = leases.filter((l) => l.unit_id === u.id);
        const activeLease = unitLeases.find((l) => l.status === "ACTIVE");
        const currentRent = activeLease?.rent_amount ?? null;
        const rentedLeases = unitLeases.filter((l) => (l.rent_amount ?? 0) > 0);
        const avgRent = rentedLeases.length > 0
          ? rentedLeases.reduce((s, l) => s + (l.rent_amount ?? 0), 0) / rentedLeases.length
          : 0;
        let trend: "up" | "down" | "flat" = "flat";
        if (rentedLeases.length > 1 && currentRent != null) {
          const diff = currentRent - avgRent;
          if (diff > avgRent * 0.02) trend = "up";
          else if (diff < -avgRent * 0.02) trend = "down";
        }

        // Duración promedio de contratos en esta unidad
        const durations = unitLeases
          .filter((l) => l.start_date && l.end_date)
          .map((l) => monthsBetween(l.start_date!, l.end_date!))
          .filter((m) => m > 0);
        const avgDuration = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;

        const b = buildingById.get(u.building_id);
        const t = u.unit_type_id ? unitTypeById.get(u.unit_type_id) : null;

        return {
          unitId: u.id,
          unitLabel: u.display_code || u.unit_number || "—",
          building: b?.name || "—",
          typology: t?.name || "—",
          currentRent,
          avgRent,
          trend,
          avgDuration,
          leaseCount: unitLeases.length,
        };
      })
      .sort((a, b) => (b.currentRent ?? 0) - (a.currentRent ?? 0));
  }, [units, leases, buildingById, unitTypeById]);

  /* ── Renta promedio por tipología ──────────────────────────────── */
  const avgRentByTypology = useMemo(() => {
    return unitTypes
      .map((t) => {
        const typeUnits = units.filter((u) => u.unit_type_id === t.id);
        const typeLeases = leases.filter(
          (l) => (l.rent_amount ?? 0) > 0 && typeUnits.some((u) => u.id === l.unit_id)
        );
        if (typeLeases.length === 0) return null;
        const avg = typeLeases.reduce((s, l) => s + (l.rent_amount ?? 0), 0) / typeLeases.length;
        return { id: t.id, name: t.name, avg, count: typeLeases.length };
      })
      .filter((r): r is { id: string; name: string; avg: number; count: number } => r !== null)
      .sort((a, b) => b.avg - a.avg);
  }, [unitTypes, units, leases]);

  /* ── Render ───────────────────────────────────────────────────── */

  if (loading || loadingData) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>Cargando analytics...</div>
      </PageContainer>
    );
  }

  if (!user || !hasAccess) return null;

  return (
    <PageContainer>
      <PageHeader title="Analytics" titleIcon={<BarChart2 size={18} />} />

      {/* ════ SECCIÓN 1: Stat bar compacta ════════════════════════════ */}
      <div className="analytics-stat-bar" style={{ display:"flex", background:"var(--bg-card)", border:"1px solid var(--border-default)", borderRadius:12, overflow:"hidden", marginBottom:"1rem" }}>
        {[
          { label:"Ocupación", value:`${occupancyRate.toFixed(0)}%`, sub:"global", color:"#10B981" },
          { label:"Personas", value:estimatedPeople, sub:"estimadas", color:"#3B82F6" },
          { label:"Contratos", value:activeLeases.length, sub:"activos" },
          { label:"Vencen 30d", value:leasesExpiring30.length, sub:"contratos", color:"#F59E0B" },
          { label:"Vacantes", value:vacantUnits, sub:"unidades", color:"#EF4444" },
          { label:"Edificios", value:buildings.length, sub:"activos" },
        ].map((s, i, arr) => (
          <div key={i} className="mod-stat-cell" style={{ flex:1, padding:".6rem .75rem", borderRight: i < arr.length-1 ? "1px solid var(--border-default)" : "none", textAlign:"center" }}>
            <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:600, color: s.color ?? "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ════ SECCIÓN 2: Ocupación por edificio + Contratos por vencer ══════ */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:16, marginBottom:16 }} className="dashboard-grid-2">
        <SectionCard title="Ocupación por edificio" icon={<Building2 size={18} />}>
          {occupancyByBuilding.length === 0 ? (
            <AppEmptyState title="Sin edificios" description="No hay datos para mostrar." />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {occupancyByBuilding.map((b) => {
                const color = b.rate >= 80 ? "#10B981" : b.rate >= 50 ? "#F59E0B" : "#EF4444";
                return (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:12, color:"var(--text-secondary)", minWidth:120, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {b.name}
                    </div>
                    <div style={{ flex:1, height:10, background:"var(--divider)", borderRadius:5, overflow:"hidden" }}>
                      <div style={{ width:`${b.rate}%`, height:"100%", background:color, transition:"width .4s" }} />
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)", minWidth:70, textAlign:"right" }}>
                      {b.rate.toFixed(0)}% · {b.occ}/{b.total}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Contratos por vencer" icon={<Clock3 size={18} />}>
          {leasesExpiring30.length === 0 ? (
            <AppEmptyState title="Sin próximos vencimientos" description="Nada vence en los próximos 30 días." />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {leasesExpiring30.slice(0, 10).map((l) => {
                const days = l.end_date ? daysBetween(new Date().toISOString(), l.end_date) : 0;
                const variant: "red" | "amber" | "green" = days < 15 ? "red" : days < 30 ? "amber" : "green";
                const u = unitById.get(l.unit_id);
                const t = tenantById.get(l.tenant_id);
                return (
                  <div key={l.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", border:"1px solid var(--border-default)", borderRadius:8 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:2, minWidth:0 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{t?.full_name || "—"}</span>
                      <span style={{ fontSize:11, color:"var(--text-muted)" }}>{u?.display_code || u?.unit_number || "—"}</span>
                    </div>
                    <AppBadge variant={variant}>{days} {days === 1 ? "día" : "días"}</AppBadge>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ════ SECCIÓN 3: Desempeño por tipología ══════════════════════════ */}
      <SectionCard title="Desempeño por tipología" icon={<Home size={18} />}>
        {typologyPerformance.length === 0 ? (
          <AppEmptyState title="Sin tipologías" description="Crea tipologías para ver análisis." />
        ) : (
          <AppGrid minWidth={220}>
            {typologyPerformance.map((t) => {
              const demandColor =
                t.demand === "alta" ? "green" : t.demand === "media" ? "amber" : "gray";
              const demandLabel =
                t.demand === "alta" ? "Alta demanda" : t.demand === "media" ? "Media demanda" : "Baja demanda";
              return (
                <AppCard key={t.id} style={{ padding: 14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{t.name}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{t.bedrooms} recámara{t.bedrooms === 1 ? "" : "s"}</div>
                    </div>
                    <AppBadge variant={demandColor}>{demandLabel}</AppBadge>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12 }}>
                    <div>
                      <div style={{ color:"var(--text-muted)", fontSize:10 }}>Ocupación</div>
                      <div style={{ fontWeight:600, fontSize:15, color:"var(--text-primary)" }}>
                        {t.rate.toFixed(0)}%
                      </div>
                      <div style={{ color:"var(--text-muted)", fontSize:10 }}>{t.occupied}/{t.total}</div>
                    </div>
                    <div>
                      <div style={{ color:"var(--text-muted)", fontSize:10 }}>Días vacío promedio</div>
                      <div style={{ fontWeight:600, fontSize:15, color:"var(--text-primary)" }}>
                        {t.avgVacancy !== null ? `${t.avgVacancy}d` : "Sin datos"}
                      </div>
                    </div>
                  </div>
                </AppCard>
              );
            })}
          </AppGrid>
        )}
      </SectionCard>

      <div style={{ height:16 }} />

      {/* ════ SECCIÓN 4: Mayor rotación ═══════════════════════════════════ */}
      <SectionCard title="Mayor rotación" icon={<TrendingUp size={18} />} subtitle="Unidades con más inquilinos históricos" style={{ marginBottom:16 }}>
        {rotationRanking.length === 0 ? (
          <AppEmptyState title="Sin rotación" description="No hay historial suficiente." />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {rotationRanking.map((r) => (
              <div key={r.unitId} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)", minWidth:110, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {r.label} · {r.building}
                </div>
                <div style={{ flex:1, height:10, background:"var(--divider)", borderRadius:5, overflow:"hidden" }}>
                  <div style={{ width:`${(r.count / maxRotation) * 100}%`, height:"100%", background:"#EC4899" }} />
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)", minWidth:50, textAlign:"right" }}>
                  {r.count} {r.count === 1 ? "contrato" : "contratos"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════ SECCIÓN 5: Contratos más largos ═════════════════════════════ */}
      <SectionCard title="Inquilinos más leales" icon={<KeyRound size={18} />} subtitle="Contratos activos ordenados por duración">
        {longestLeases.length === 0 ? (
          <AppEmptyState title="Sin contratos activos" description="No hay contratos para rankear." />
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border-default)" }}>
                  <th style={thStyle}>Inquilino</th>
                  <th style={thStyle}>Departamento</th>
                  <th style={thStyle}>Edificio</th>
                  <th style={thStyle}>Inicio</th>
                  <th style={thStyle}>Duración</th>
                  <th style={thStyle}>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {longestLeases.map((r) => {
                  const variant: "green" | "blue" | "gray" =
                    r.duration > 24 ? "green" : r.duration >= 12 ? "blue" : "gray";
                  const label =
                    r.duration > 24 ? "Leal" : r.duration >= 12 ? "Estable" : "Reciente";
                  return (
                    <tr key={r.id} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td style={tdStyle}><strong>{r.tenant}</strong></td>
                      <td style={tdStyle}>{r.unit}</td>
                      <td style={tdStyle}>{r.building}</td>
                      <td style={tdStyle}>{formatDateShort(r.start)}</td>
                      <td style={tdStyle}>
                        <AppBadge variant={variant}>{r.duration} meses · {label}</AppBadge>
                      </td>
                      <td style={tdStyle}>{formatDateShort(r.end)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div style={{ height:16 }} />

      {/* ════ SECCIÓN 7: Tendencia ocupación vs vacantes ══════════════════ */}
      <SectionCard title="Tendencia ocupación" icon={<TrendingUp size={18} />} subtitle="% ocupación vs. vacantes · últimos 6 meses">
        {occupancyHistory.length === 0 ? (
          <AppEmptyState title="Sin histórico" description="No hay datos suficientes." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={occupancyHistory} margin={{ top:4, right:12, left:0, bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="mes" tick={{ fontSize:11, fill:"var(--text-muted)" }} />
              <YAxis yAxisId="left" tick={{ fontSize:11, fill:"var(--text-muted)" }} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize:11, fill:"var(--text-muted)" }} />
              <Tooltip contentStyle={{ background:"var(--bg-card)", border:"1px solid var(--border-default)", borderRadius:8, fontSize:12 }} />
              <Legend wrapperStyle={{ fontSize:11, paddingTop:6 }} />
              <Line yAxisId="left" type="monotone" dataKey="ocupacion" name="% Ocupación" stroke="#10B981" strokeWidth={2.5} dot={{ r:3 }} />
              <Line yAxisId="right" type="monotone" dataKey="vacantes" name="Vacantes" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r:3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div style={{ height:16 }} />

      {/* ════ SECCIÓN 8: Eficiencia de cobro por edificio ═════════════════ */}
      <SectionCard title="Eficiencia de cobro por edificio" icon={<Building2 size={18} />} subtitle="Últimos 12 meses · cobrado / esperado">
        {collectionEfficiency.length === 0 ? (
          <AppEmptyState title="Sin cobros" description="No hay datos de cobranza en el periodo." />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {collectionEfficiency.map((b) => {
              const color = b.rate >= 90 ? "#10B981" : b.rate >= 70 ? "#F59E0B" : "#EF4444";
              return (
                <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ fontSize:12, color:"var(--text-secondary)", minWidth:120, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {b.name}
                  </div>
                  <div style={{ flex:1, height:10, background:"var(--divider)", borderRadius:5, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100, b.rate)}%`, height:"100%", background:color, transition:"width .4s" }} />
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", minWidth:140, lineHeight:1.3 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)" }}>
                      {b.rate.toFixed(0)}%
                    </span>
                    {b.missing > 0 && (
                      <span style={{ fontSize:10, color:"#EF4444" }}>
                        {formatCurrency(b.missing)} pendiente
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div style={{ height:16 }} />

      {/* ════ SECCIÓN 9: Comportamiento de pago de inquilinos ═════════════ */}
      <SectionCard title="Comportamiento de pago" icon={<Users size={18} />} subtitle="Inquilinos con historial de cobros">
        {tenantPaymentBehavior.length === 0 ? (
          <AppEmptyState title="Sin historial" description="No hay pagos registrados por inquilino." />
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border-default)" }}>
                  <th style={thStyle}>Inquilino</th>
                  <th style={thStyle}>Edificio</th>
                  <th style={thStyle}>% Cobrado</th>
                  <th style={thStyle}>Puntualidad</th>
                  <th style={thStyle}>Días retraso</th>
                  <th style={thStyle}>Evaluación</th>
                </tr>
              </thead>
              <tbody>
                {tenantPaymentBehavior.map((r) => {
                  const variant: "green" | "blue" | "amber" | "red" =
                    r.evaluation === "excelente" ? "green" :
                    r.evaluation === "bueno" ? "blue" :
                    r.evaluation === "regular" ? "amber" : "red";
                  const label =
                    r.evaluation === "excelente" ? "Excelente" :
                    r.evaluation === "bueno" ? "Bueno" :
                    r.evaluation === "regular" ? "Regular" : "Atención";
                  return (
                    <tr key={r.tenantId} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td style={tdStyle}><strong>{r.tenantName}</strong></td>
                      <td style={tdStyle}>{r.building}</td>
                      <td style={tdStyle}>{r.collectedRate.toFixed(0)}%</td>
                      <td style={tdStyle}>{r.punctualityRate.toFixed(0)}%</td>
                      <td style={tdStyle}>{r.avgLateDays > 0 ? `${r.avgLateDays}d` : "—"}</td>
                      <td style={tdStyle}>
                        <AppBadge variant={variant}>{label}</AppBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div style={{ height:16 }} />

      {/* ════ SECCIÓN 10: Historial de precios de renta ═══════════════════ */}
      <SectionCard title="Historial de precios de renta" icon={<TrendingUp size={18} />} subtitle="Unidades ocupadas · tendencia vs. promedio histórico">
        {rentHistory.length === 0 ? (
          <AppEmptyState title="Sin histórico de rentas" description="No hay unidades con datos de renta." />
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border-default)" }}>
                  <th style={thStyle}>Unidad</th>
                  <th style={thStyle}>Edificio</th>
                  <th style={thStyle}>Tipología</th>
                  <th style={thStyle}>Renta actual</th>
                  <th style={thStyle}>Promedio histórico</th>
                  <th style={thStyle}>Tendencia</th>
                  <th style={thStyle}>Duración promedio</th>
                </tr>
              </thead>
              <tbody>
                {rentHistory.slice(0, 15).map((r) => {
                  const trendIcon = r.trend === "up" ? "↑" : r.trend === "down" ? "↓" : "→";
                  const trendColor = r.trend === "up" ? "#10B981" : r.trend === "down" ? "#EF4444" : "var(--text-muted)";
                  return (
                    <tr key={r.unitId} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td style={tdStyle}><strong>{r.unitLabel}</strong></td>
                      <td style={tdStyle}>{r.building}</td>
                      <td style={tdStyle}>{r.typology}</td>
                      <td style={tdStyle}>{r.currentRent != null ? formatCurrency(r.currentRent) : "—"}</td>
                      <td style={tdStyle}>{r.avgRent > 0 ? formatCurrency(r.avgRent) : "—"}</td>
                      <td style={{ ...tdStyle, color: trendColor, fontWeight: 700, fontSize: 16 }}>
                        {trendIcon}
                      </td>
                      <td style={tdStyle}>{r.avgDuration != null ? `${r.avgDuration} meses` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {avgRentByTypology.length > 0 && (
          <div style={{ marginTop: 16, padding: 14, background: "var(--bg-page)", borderRadius: 10, border: "1px solid var(--border-default)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.5px", marginBottom: 10 }}>
              RENTA PROMEDIO POR TIPOLOGÍA
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {avgRentByTypology.map((t, i) => (
                <div key={t.id} style={{
                  flex: "1 1 160px",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderLeft: `4px solid ${BUILDING_COLORS[i % BUILDING_COLORS.length]}`,
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                    {formatCurrency(t.avg)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {t.count} contrato{t.count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
};
