"use client";

/*
  Dashboard principal de PropAdmin.

  Layout:
  Fila 1 — Tres donas: Ocupación | Cobranza del mes | Portafolio de edificios
  Fila 2 — BarChart: Cobrado vs Pendiente últimos 6 meses
  Fila 3 — Dos cards: Agenda de hoy | Unidades disponibles
  Fila 4 — Dos tablas operativas: Cobros vencidos | Contratos por vencer
*/

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  DoorOpen,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Wrench,
  Calendar,
  Bell,
  ClipboardList,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { CHART, chartEmptyColor } from "@/lib/chartColors";
import { withCompanyFilter } from "@/lib/supabase/query-helpers";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFontScale } from "@/lib/useFontScale";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useActiveCompanyId, useShouldLoadCompanyData } from "@/lib/useActiveCompanyId";
import { useNotifications } from "@/app/hooks/useNotifications";
import { SEVERITY_COLORS, MODULE_LABELS } from "@/lib/notifications";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ───────────────────────────────────────────────────────── */

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
  unit_type_id: string | null;
  status: string;
};

type UnitType = {
  id: string;
  name: string;
  bedrooms: number | null;
};

type Lease = {
  id: string;
  unit_id: string | null;
  tenant_id: string | null;
  status: string | null;
  end_date: string | null;
};

type Tenant = { id: string; full_name: string };

type Building = { id: string; name: string };

type CollectionRecord = {
  id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: string;
};

type CleaningBuildingSchedule = {
  id: string;
  building_id: string;
  day_of_week: string | number;
};

type CleaningUnitSchedule = {
  id: string;
  unit_id: string;
  day_of_week: string | number;
  active: boolean;
};

type MaintenanceLog = {
  id: string;
  unit_id: string | null;
  title: string | null;
  status: string | null;
};

/* ─── Constantes ──────────────────────────────────────────────────── */

const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/* Nombres de días en inglés para comparar con day_of_week de la BD */
const DAY_NAMES_EN = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

/* ─── Helpers de módulo ───────────────────────────────────────────── */

function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/* Formato compacto para el centro de la dona de cobranza */
function formatMXNCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return formatMXN(amount);
}

function todayDateKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/* Devuelve el nombre en inglés del día actual (para comparar con day_of_week) */
function todayDayName(): string {
  return DAY_NAMES_EN[new Date().getDay()];
}

/* Devuelve el índice numérico del día actual 0-6 */
function todayDayIndex(): number {
  return new Date().getDay();
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, (d || 1) + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function daysBetween(fromKey: string, toKey: string): number {
  const parse = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000);
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/*
  Tooltip del BarChart con formato MXN.
  isDark se pasa como prop para no llamar a un hook dentro de un componente
  que recharts instancia fuera del árbol normal de React.
*/
function MXNTooltip({
  active,
  payload,
  label,
  isDark,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  isDark?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-md)",
        padding: "12px 16px",
        fontSize: "0.8125rem",
        boxShadow: "var(--shadow-md, 0 4px 16px rgba(0,0,0,0.12))",
      }}
    >
      <p
        style={{
          fontWeight: 700,
          marginBottom: 6,
          color: "var(--text-primary)",
        }}
      >
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: "2px 0", color: p.color }}>
          {p.name}: <strong>{formatMXN(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function yAxisFormatter(value: number): string {
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

/* Colores del badge de días restantes de contrato — usa CSS vars */
function daysLeftBadge(days: number) {
  if (days < 30) return { bg: "var(--badge-bg-red)",   text: "var(--badge-text-red)",   border: "var(--metric-border-red)" };
  if (days < 60) return { bg: "var(--badge-bg-amber)", text: "var(--badge-text-amber)", border: "var(--metric-border-amber)" };
  return          { bg: "var(--badge-bg-amber)",       text: "var(--badge-text-amber)", border: "var(--metric-border-amber)" };
}

/* ─── Tipos de filas de tablas ────────────────────────────────────── */

type OverdueRow = {
  id: string;
  tenantName: string;
  buildingUnit: string;
  amount: string;
  daysOverdue: number;
};

type ExpiringLeaseRow = {
  id: string;
  tenantName: string;
  unitLabel: string;
  buildingName: string;
  endDateLabel: string;
  daysLeft: number;
};

type AvailableUnitRow = {
  id: string;
  unitLabel: string;
  buildingName: string;
  bedroomsLabel: string;
};

type BuildingProgress = {
  buildingId: string;
  buildingName: string;
  steps: {
    created: boolean;
    hasUnitTypes: boolean;
    hasUnits: boolean;
    hasServices: boolean;
    hasTenant: boolean;
  };
};

/* ─── Componente principal ────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { isDark } = useTheme();
  const { fontScale, cols3, cols2 } = useFontScale();
  const { isRealSuperAdmin, isImpersonating } = useImpersonation();
  const activeCompanyId = useActiveCompanyId();
  const shouldLoadData  = useShouldLoadCompanyData();

  const role = user?.role;
  const isSuperOrAdmin = role === 'superadmin' || user?.is_superadmin || role === 'administracion' || role === 'directivo';
  const isCompras = role === 'compras';
  const isMantenimiento = role === 'mantenimiento';
  void isSuperOrAdmin;

  const { notifications, loading: notifLoading } = useNotifications(activeCompanyId ?? "");

  /* ── Checklist mensual ─────────────────────────────────────── */
  const [checklistResults, setChecklistResults] = useState<Record<string, boolean>>({});
  const [checklistLoading, setChecklistLoading] = useState(true);

  /* ── Setup de propiedades ──────────────────────────────────── */
  const [setupProgress, setSetupProgress] = useState<BuildingProgress[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);

  const [loadingData, setLoadingData] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  /* ── Datos crudos de Supabase ──────────────────────────────────── */
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  /* Agenda de hoy */
  const [cleaningBuildingSchedules, setCleaningBuildingSchedules] = useState<CleaningBuildingSchedule[]>([]);
  const [cleaningUnitSchedules, setCleaningUnitSchedules] = useState<CleaningUnitSchedule[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);

  /* Guard de autenticación */
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* Superadmin sin impersonar → Control Center SAPROA */
  useEffect(() => {
    if (loading) return;
    if (isRealSuperAdmin && !isImpersonating) {
      router.replace('/saproa-admin/impersonar');
    }
  }, [loading, isRealSuperAdmin, isImpersonating, router]);

  /* Redirect por rol a dashboard específico */
  useEffect(() => {
    if (loading || !user) return;
    if (role === 'administracion') { router.replace('/dashboard/administracion'); return; }
    if (role === 'compras') { router.replace('/dashboard/compras'); return; }
    if (role === 'mantenimiento') { router.replace('/dashboard/mantenimiento'); return; }
  }, [user, loading, role, router]);

  /* Carga inicial cuando el usuario está listo */
  useEffect(() => {
    if (!loading && user && shouldLoadData) void loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, user?.company_id, shouldLoadData, activeCompanyId]);

  useEffect(() => {
    if (!loading && user) {
      if (activeCompanyId) void loadSetupProgress();
      else setLoadingSetup(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, user?.company_id, activeCompanyId]);

  useEffect(() => {
    if (!loading && user && shouldLoadData) void loadChecklist(activeCompanyId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, user?.company_id, shouldLoadData, activeCompanyId]);

  async function loadDashboard() {
    if (!user) return;
    setLoadingData(true);

    const cid = activeCompanyId;

    // ── DEBUG TEMPORAL ──────────────────────────────────────────────
    console.log('[DASH] ▶ loadDashboard called');
    console.log('[DASH] cid (activeCompanyId)  =', cid);
    console.log('[DASH] shouldLoadData         =', shouldLoadData);
    console.log('[DASH] user.company_id        =', user?.company_id);
    console.log('[DASH] user.is_superadmin     =', user?.is_superadmin);
    console.log('[DASH] user.role              =', user?.role);
    // ────────────────────────────────────────────────────────────────

    const today = todayDateKey();

    /* Primer día de hace 5 meses (= ventana de 6 meses para chart) */
    const now = new Date();
    const sixMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsAgoKey = [
      sixMonthsAgoDate.getFullYear(),
      String(sixMonthsAgoDate.getMonth() + 1).padStart(2, "0"),
      "01",
    ].join("-");

    const [
      unitsRes,
      unitTypesRes,
      leasesRes,
      tenantsRes,
      buildingsRes,
      collectionRes,
      cleaningBuildingRes,
      cleaningUnitRes,
      maintenanceRes,
    ] = await Promise.all([
      /* Unidades — incluye unit_type_id para card de disponibles */
      withCompanyFilter(supabase
        .from("units")
        .select("id, building_id, unit_number, display_code, unit_type_id, status"),
        cid).is("deleted_at", null),

      /* Tipos de unidad — para mostrar tipo en card de disponibles */
      withCompanyFilter(supabase
        .from("unit_types")
        .select("id, name, bedrooms"), cid).is("deleted_at", null),

      /* Leases — activos + contratos próximos a vencer */
      withCompanyFilter(supabase
        .from("leases")
        .select("id, unit_id, tenant_id, status, end_date"),
        cid).is("deleted_at", null),

      /* Inquilinos — solo nombre */
      withCompanyFilter(supabase
        .from("tenants")
        .select("id, full_name"),
        cid).is("deleted_at", null),

      /* Edificios — solo nombre */
      withCompanyFilter(supabase
        .from("buildings")
        .select("id, name"),
        cid).is("deleted_at", null),

      /* Cobros — últimos 6 meses para chart + métricas del mes */
      withCompanyFilter(supabase
        .from("collection_records")
        .select(
          "id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status"
        ),
        cid).is("deleted_at", null)
        .gte("due_date", sixMonthsAgoKey)
        .order("due_date", { ascending: true }),

      /* Limpiezas de edificios — sin filtro company_id, RLS filtra vía building_id */
      supabase
        .from("cleaning_building_schedules")
        .select("id, building_id, day_of_week"),

      /* Limpiezas de unidades — sin filtro company_id, RLS filtra vía building_id */
      supabase
        .from("cleaning_unit_schedules")
        .select("id, unit_id, day_of_week, active")
        .is("deleted_at", null)
        .eq("active", true),

      /* Mantenimientos con fecha programada = hoy */
      withCompanyFilter(supabase
        .from("maintenance_logs")
        .select("id, unit_id, title, status"),
        cid),
    ]);

    // ── DEBUG TEMPORAL ──────────────────────────────────────────────
    console.log('[DASH] ◀ Promise.all results:');
    console.log('[DASH]   buildings  count =', buildingsRes.data?.length,  '| error =', buildingsRes.error?.message   ?? 'none', '| sample =', buildingsRes.data?.slice(0, 2));
    console.log('[DASH]   units      count =', unitsRes.data?.length,      '| error =', unitsRes.error?.message       ?? 'none', '| sample =', unitsRes.data?.slice(0, 2));
    console.log('[DASH]   leases     count =', leasesRes.data?.length,     '| error =', leasesRes.error?.message      ?? 'none');
    console.log('[DASH]   tenants    count =', tenantsRes.data?.length,    '| error =', tenantsRes.error?.message     ?? 'none');
    console.log('[DASH]   collection count =', collectionRes.data?.length, '| error =', collectionRes.error?.message  ?? 'none');
    console.log('[DASH]   maintenance count=', maintenanceRes.data?.length,'| error =', maintenanceRes.error?.message ?? 'none');
    // ────────────────────────────────────────────────────────────────

    setUnits((unitsRes.data as Unit[]) || []);
    setUnitTypes((unitTypesRes.data as UnitType[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setTenants((tenantsRes.data as Tenant[]) || []);
    setBuildings((buildingsRes.data as Building[]) || []);
    setCollectionRecords((collectionRes.data as CollectionRecord[]) || []);
    setCleaningBuildingSchedules((cleaningBuildingRes.data as CleaningBuildingSchedule[]) || []);
    setCleaningUnitSchedules((cleaningUnitRes.data as CleaningUnitSchedule[])||[]);
    setMaintenanceLogs((maintenanceRes.data as MaintenanceLog[]) || []);

    setLoadingData(false);
  }

  async function loadChecklist(companyId: string | null) {
    setChecklistLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const thirtyStr = thirtyDays.toISOString().split('T')[0];

    const [
      { count: cobrosCount },
      { count: vencidosCount },
      { count: lecturasCount },
      { count: contratosCount },
    ] = await Promise.all([
      withCompanyFilter(supabase.from('collection_records')
        .select('id', { count: 'exact', head: true }), companyId)
        .eq('period_year', year)
        .eq('period_month', month),
      withCompanyFilter(supabase.from('collection_records')
        .select('id', { count: 'exact', head: true }), companyId)
        .eq('status', 'overdue')
        .is('deleted_at', null),
      withCompanyFilter(supabase.from('building_utility_readings')
        .select('id', { count: 'exact', head: true }), companyId)
        .eq('period_year', year)
        .eq('period_month', month)
        .is('deleted_at', null),
      withCompanyFilter(supabase.from('leases')
        .select('id', { count: 'exact', head: true }), companyId)
        .eq('status', 'ACTIVE')
        .not('end_date', 'is', null)
        .lte('end_date', thirtyStr)
        .is('deleted_at', null),
    ]);

    setChecklistResults({
      generar_cobros:     (cobrosCount ?? 0) > 0,
      revisar_vencidos:   (vencidosCount ?? 0) === 0,
      lecturas_servicios: (lecturasCount ?? 0) > 0,
      revisar_contratos:  (contratosCount ?? 0) === 0,
    });
    setChecklistLoading(false);
  }

  async function loadSetupProgress() {
    if (!activeCompanyId) return;
    const cid = activeCompanyId;
    const [
      { data: bData },
      { data: uData },
      { data: utData },
      { data: mData },
      { data: lData },
    ] = await Promise.all([
      supabase.from("buildings").select("id, name").eq("company_id", cid).is("deleted_at", null),
      supabase.from("units").select("id, building_id").eq("company_id", cid).is("deleted_at", null),
      supabase.from("unit_types").select("id, building_id").eq("company_id", cid).is("deleted_at", null),
      supabase.from("building_utility_meters").select("id, building_id").eq("company_id", cid).eq("active", true).is("deleted_at", null),
      supabase.from("leases").select("id, unit_id").eq("company_id", cid).eq("status", "ACTIVE").is("deleted_at", null),
    ]);

    const bldgs = (bData ?? []) as Array<{ id: string; name: string }>;
    const unitRows = (uData ?? []) as Array<{ id: string; building_id: string }>;
    const utRows = (utData ?? []) as Array<{ id: string; building_id: string }>;
    const meterRows = (mData ?? []) as Array<{ id: string; building_id: string }>;
    const leaseRows = (lData ?? []) as Array<{ id: string; unit_id: string | null }>;

    const unitsByBldg = new Map<string, string[]>();
    for (const u of unitRows) {
      const arr = unitsByBldg.get(u.building_id) ?? [];
      arr.push(u.id);
      unitsByBldg.set(u.building_id, arr);
    }
    const utBldgSet = new Set(utRows.map(r => r.building_id));
    const meterBldgSet = new Set(meterRows.map(r => r.building_id));
    const activeLeaseUnitSet = new Set(leaseRows.map(r => r.unit_id).filter(Boolean) as string[]);
    const tenantBldgSet = new Set<string>();
    for (const [bldId, uIds] of unitsByBldg) {
      if (uIds.some(uid => activeLeaseUnitSet.has(uid))) tenantBldgSet.add(bldId);
    }

    const progress = bldgs
      .map(b => ({
        buildingId: b.id,
        buildingName: b.name,
        steps: {
          created: true,
          hasUnitTypes: utBldgSet.has(b.id),
          hasUnits: (unitsByBldg.get(b.id)?.length ?? 0) > 0,
          hasServices: meterBldgSet.has(b.id),
          hasTenant: tenantBldgSet.has(b.id),
        },
      }))
      .filter(p => !p.steps.hasUnitTypes || !p.steps.hasUnits || !p.steps.hasServices || !p.steps.hasTenant);

    setSetupProgress(progress);
    setLoadingSetup(false);
  }

  /* ─── Lookup maps ─────────────────────────────────────────────── */

  const tenantMap = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const unitTypeMap = useMemo(() => new Map(unitTypes.map((t) => [t.id, t])), [unitTypes]);
  const leaseMap = useMemo(() => new Map(leases.map((l) => [l.id, l])), [leases]);

  /* ─── DONA 1: Métricas de ocupación ──────────────────────────── */

  const occupancyStats = useMemo(() => {
    const total = units.length;
    /* RENTED, OCCUPIED y PARTIAL cuentan como ocupadas */
    const occupied = units.filter((u) => {
      const s = (u.status || "").toUpperCase();
      return s === "RENTED" || s === "OCCUPIED" || s === "PARTIAL";
    }).length;
    const vacant = units.filter((u) => (u.status || "").toUpperCase() === "VACANT").length;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, vacant, rate };
  }, [units]);

  /* ─── DONA 2: Cobranza del mes actual ────────────────────────── */

  const collectionMonthStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthRecords = collectionRecords.filter(
      (r) => r.period_year === currentYear && r.period_month === currentMonth
    );

    const monthTotal = monthRecords.reduce((sum, r) => sum + r.amount_due, 0);
    const collected = monthRecords.reduce((sum, r) => sum + (r.amount_collected ?? 0), 0);
    const pending = monthRecords
      .filter((r) => r.status === "pending" || r.status === "partial")
      .reduce((sum, r) => sum + (r.amount_due - (r.amount_collected ?? 0)), 0);
    const overdue = collectionRecords
      .filter((r) => r.status === "overdue")
      .reduce((sum, r) => sum + (r.amount_due - (r.amount_collected ?? 0)), 0);

    return { monthTotal, collected, pending, overdue };
  }, [collectionRecords]);

  /*
    Dona de cobranza: siempre mostrar.
    Sin datos → segmento gris único.
  */
  const neutralSegmentColor = chartEmptyColor(isDark);

  const collectionDonutData = useMemo(() => {
    const { collected, pending, overdue } = collectionMonthStats;
    const hasData = collected > 0 || pending > 0 || overdue > 0;
    if (!hasData) return [{ name: "Sin datos", value: 1, color: neutralSegmentColor }];
    const data: { name: string; value: number; color: string }[] = [];
    if (collected > 0) data.push({ name: "Cobrado", value: collected, color: CHART.positive });
    if (pending > 0) data.push({ name: "Pendiente", value: pending, color: CHART.warning });
    if (overdue > 0) data.push({ name: "Vencido", value: overdue, color: CHART.negative });
    return data;
  }, [collectionMonthStats]);

  const collectionDonutIsEmpty =
    collectionMonthStats.collected === 0 &&
    collectionMonthStats.pending === 0 &&
    collectionMonthStats.overdue === 0;

  /* ─── DONA 3: Portafolio de edificios ────────────────────────── */

  const buildingStats = useMemo(() => {
    const buildingsWithTenants = new Set(
      leases
        .filter((l) => l.status === "ACTIVE" && l.unit_id)
        .map((l) => {
          const unit = l.unit_id ? unitMap.get(l.unit_id) : undefined;
          return unit?.building_id;
        })
        .filter((id): id is string => !!id)
    );
    const withTenants = buildingsWithTenants.size;
    const empty = buildings.length - withTenants;
    return { total: buildings.length, withTenants, empty };
  }, [leases, buildings, unitMap]);

  const buildingDonutData = useMemo(() => {
    if (buildingStats.total === 0) return [{ name: "Sin edificios", value: 1, color: neutralSegmentColor }];
    return [
      { name: "Con inquilinos", value: buildingStats.withTenants || 0, color: CHART.reference },
      { name: "Vacíos", value: buildingStats.empty || 0, color: neutralSegmentColor },
    ].filter((d) => d.value > 0);
  }, [buildingStats, neutralSegmentColor]);

  /* ─── FILA 2: BarChart — últimos 6 meses (solo barras) ───────── */

  const barChartData = useMemo(() => {
    const now = new Date();
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: MONTH_LABELS_SHORT[d.getMonth()] });
    }
    return months.map(({ year, month, label }) => {
      const records = collectionRecords.filter(
        (r) => r.period_year === year && r.period_month === month
      );
      const cobrado = records.reduce((sum, r) => sum + (r.amount_collected ?? 0), 0);
      const pendiente = records
        .filter((r) => r.status !== "collected")
        .reduce((sum, r) => sum + (r.amount_due - (r.amount_collected ?? 0)), 0);
      return { mes: label, Cobrado: cobrado, Pendiente: pendiente };
    });
  }, [collectionRecords]);

  const barChartIsEmpty = barChartData.every((d) => d.Cobrado === 0 && d.Pendiente === 0);

  /* ─── FILA 3, Card A: Agenda de hoy ──────────────────────────── */

  const agendaHoy = useMemo(() => {
    const todayName = todayDayName();
    const todayIndex = todayDayIndex();
    const todayKey = todayDateKey();

    /*
      day_of_week puede estar almacenado como string en inglés ("monday")
      o como entero 0-6. Comparamos ambos formatos.
    */
    const matchesDay = (dow: string | number): boolean => {
      if (typeof dow === "number") return dow === todayIndex;
      return dow.toLowerCase() === todayName;
    };

    const buildingCleanings = cleaningBuildingSchedules.filter((s) => matchesDay(s.day_of_week));
    const unitCleanings = cleaningUnitSchedules.filter((s) => matchesDay(s.day_of_week));
    const maintenances: MaintenanceLog[] = [];

    const totalCleanings = buildingCleanings.length + unitCleanings.length;

    return {
      buildingCleanings: buildingCleanings.length,
      unitCleanings: unitCleanings.length,
      totalCleanings,
      maintenances: maintenances.length,
      hasActivity: totalCleanings > 0 || maintenances.length > 0,
    };
  }, [cleaningBuildingSchedules, cleaningUnitSchedules, maintenanceLogs]);

  /* ─── FILA 3, Card B: Unidades disponibles ───────────────────── */

  const availableUnitRows = useMemo<AvailableUnitRow[]>(() => {
    /* Solo unidades con status VACANT */
    return units
      .filter((u) => (u.status || "").toUpperCase() === "VACANT")
      .slice(0, 6)
      .map((u) => ({
        id: u.id,
        unitLabel: u.display_code ?? u.unit_number ?? "—",
        buildingName: buildingMap.get(u.building_id)?.name ?? "—",
        bedroomsLabel: (() => {
          const beds = u.unit_type_id ? unitTypeMap.get(u.unit_type_id)?.bedrooms ?? null : null;
          if (beds === null) return "—";
          if (beds === 0) return "Studio";
          return `${beds} rec.`;
        })(),
      }));
  }, [units, leases, buildingMap, unitTypeMap]);

  /* ─── FILA 4, Tabla 1: Cobros vencidos (top 5) ───────────────── */

  const overdueRows = useMemo<OverdueRow[]>(() => {
    const today = todayDateKey();
    return collectionRecords
      .filter((r) => r.status === "overdue")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)
      .map((r) => {
        const lease = r.lease_id ? leaseMap.get(r.lease_id) : null;
        const tenant = lease?.tenant_id ? tenantMap.get(lease.tenant_id) : null;
        const building = buildingMap.get(r.building_id);
        const unit = unitMap.get(r.unit_id);
        const balance = r.amount_due - (r.amount_collected ?? 0);
        return {
          id: r.id,
          tenantName: tenant?.full_name ?? "Sin inquilino",
          buildingUnit: `${building?.name ?? "—"} · ${unit?.display_code ?? unit?.unit_number ?? "—"}`,
          amount: formatMXN(balance),
          daysOverdue: daysBetween(r.due_date, today),
        };
      });
  }, [collectionRecords, leaseMap, tenantMap, buildingMap, unitMap]);

  /* ─── FILA 4, Tabla 2: Contratos por vencer — 90 días (top 5) ── */

  const expiringLeaseRows = useMemo<ExpiringLeaseRow[]>(() => {
    const today = todayDateKey();
    const in90 = addDays(today, 90);
    return leases
      .filter(
        (l) =>
          l.status === "ACTIVE" &&
          l.end_date &&
          l.end_date >= today &&
          l.end_date <= in90
      )
      .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""))
      .slice(0, 5)
      .map((l) => {
        const tenant = l.tenant_id ? tenantMap.get(l.tenant_id) : null;
        const unit = l.unit_id ? unitMap.get(l.unit_id) : null;
        const building = unit?.building_id ? buildingMap.get(unit.building_id) : null;
        return {
          id: l.id,
          tenantName: tenant?.full_name ?? "Sin inquilino",
          unitLabel: unit?.display_code ?? unit?.unit_number ?? "—",
          buildingName: building?.name ?? "—",
          endDateLabel: formatDateLabel(l.end_date ?? ""),
          daysLeft: daysBetween(today, l.end_date ?? ""),
        };
      });
  }, [leases, tenantMap, unitMap, buildingMap]);

  /* ─── Guards de sesión ───────────────────────────────────────── */

  if (loading) {
    return (
      <PageContainer>
        <p style={{ padding: "40px 0", color: "var(--text-muted)" }}>Cargando usuario...</p>
      </PageContainer>
    );
  }
  if (!user) return null;

  if (isCompras || isMantenimiento || role === 'administracion') return null;

  /* Nombre del mes actual capitalizado para el título de la dona */
  const monthName = new Date().toLocaleDateString("es-MX", { month: "long" });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  /* Altura de la dona (loading state), escala con font-scale */
  const donutHeight = Math.round(220 * fontScale);
  const chartHeight = Math.round(280 * fontScale);
  const cardGap = Math.round(20 * fontScale);
  const DONUT_LOADING_HEIGHT = donutHeight;

  /* ─── Paleta de colores según modo ───────────────────────────────
     Centralizado aquí para que todos los elementos del render usen
     el mismo set de colores y no haya valores hardcodeados dispersos.
  ─────────────────────────────────────────────────────────────────── */
  const c = {
    chartAxis: isDark ? "#64748B" : "#667085",
    chartGrid: isDark ? "#2D3748" : "#F2F4F7",
  };

  /* Mapea severidad a CSS variables que respetan dark mode */
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical': return { bg: 'var(--metric-bg-red)',   border: 'var(--metric-border-red)',   text: 'var(--metric-value-red)',   dot: 'var(--metric-value-red)'   };
      case 'warning':  return { bg: 'var(--metric-bg-amber)', border: 'var(--metric-border-amber)', text: 'var(--metric-value-amber)', dot: 'var(--metric-value-amber)' };
      case 'brand':    return { bg: 'var(--metric-bg-blue)',  border: 'var(--accent)',              text: 'var(--accent)',             dot: 'var(--accent)'             };
      case 'info':     return { bg: 'var(--metric-bg-blue)',  border: 'var(--accent)',              text: 'var(--accent)',             dot: 'var(--accent)'             };
      default:         return { bg: 'var(--bg-card)',         border: 'var(--border-default)',      text: 'var(--text-primary)',       dot: 'var(--text-muted)'         };
    }
  };

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        titleIcon={<LayoutDashboard size={20} />}
        subtitle={role === "titular" ? "General" : "Vista general del portafolio: ocupación, cobranza y alertas operativas."}
        actions={<UiButton href="/buildings">Ver edificios</UiButton>}
      />

      {/* ══ FILA 1: TRES DONAS ════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div
        className="dashboard-grid-3"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols3}, 1fr)`,
          gap: cardGap,
          marginBottom: cardGap,
        }}
      >
        {/* ── Dona 1: Ocupación ─────────────────────────────────── */}
        <AppCard className="dashboard-card-mobile" style={{ padding: 24 }}>
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 4px",
            }}
          >
            Ocupación
          </p>

          {loadingData ? (
            <div
              style={{
                height: DONUT_LOADING_HEIGHT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Cargando...
            </div>
          ) : occupancyStats.total === 0 ? (
            <div style={{ height: DONUT_LOADING_HEIGHT }}>
              <AppEmptyState
                title="Sin unidades"
                description="Crea unidades en tus edificios para ver esta métrica."
              />
            </div>
          ) : (
            <>
              <div style={{ position: "relative", width: "100%" }}>
                <ResponsiveContainer width="100%" aspect={1}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Ocupadas", value: occupancyStats.occupied },
                        { name: "Vacías", value: occupancyStats.vacant },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill={CHART.positive} />
                      <Cell fill={neutralSegmentColor} />
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "1.875rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      display: "block",
                      lineHeight: 1,
                    }}
                  >
                    {occupancyStats.rate}%
                  </strong>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    ocupación
                  </span>
                </div>
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--divider)",
                  paddingTop: 14,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--metric-value-green)" }}>{occupancyStats.occupied}</strong>{" "}
                  ocupadas de{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{occupancyStats.total}</strong> totales
                </p>
                {occupancyStats.vacant > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {occupancyStats.vacant}{" "}
                    {occupancyStats.vacant === 1 ? "disponible" : "disponibles"}
                  </p>
                )}
              </div>
            </>
          )}
        </AppCard>

        {/* ── Dona 2: Cobranza del mes (siempre visible) ────────── */}
        <AppCard className="dashboard-card-mobile" style={{ padding: 24 }}>
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 4px",
            }}
          >
            Cobranza — {monthLabel}
          </p>

          {loadingData ? (
            <div
              style={{
                height: DONUT_LOADING_HEIGHT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Cargando...
            </div>
          ) : (
            <>
              {/* Dona siempre visible — gris si no hay datos */}
              <div style={{ position: "relative", width: "100%" }}>
                <ResponsiveContainer width="100%" aspect={1}>
                  <PieChart>
                    <Pie
                      data={collectionDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={collectionDonutIsEmpty ? 0 : 2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {collectionDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    {!collectionDonutIsEmpty && (
                      <Tooltip formatter={(v, n) => [formatMXN(Number(v)), n]} />
                    )}
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                  }}
                >
                  <strong
                    style={{
                      fontSize: collectionDonutIsEmpty ? "1.125rem" : "1rem",
                      fontWeight: 800,
                      color: collectionDonutIsEmpty ? "var(--text-muted)" : "var(--text-primary)",
                      display: "block",
                      lineHeight: 1.2,
                    }}
                  >
                    {collectionDonutIsEmpty
                      ? "$0.00"
                      : formatMXNCompact(collectionMonthStats.monthTotal)}
                  </strong>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    total mes
                  </span>
                </div>
              </div>

              {/* Pie: desglose o mensaje vacío */}
              <div
                style={{
                  borderTop: "1px solid var(--divider)",
                  paddingTop: 14,
                  marginTop: 6,
                }}
              >
                {collectionDonutIsEmpty ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    Sin cobros registrados este mes
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "Cobrado", value: collectionMonthStats.collected, color: CHART.positive },
                      { label: "Pendiente", value: collectionMonthStats.pending, color: CHART.warning },
                      { label: "Vencido", value: collectionMonthStats.overdue, color: CHART.negative },
                    ]
                      .filter((item) => item.value > 0)
                      .map(({ label, value, color }) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 99,
                                background: color,
                                display: "inline-block",
                                flexShrink: 0,
                              }}
                            />
                            {label}
                          </span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color }}>
                            {formatMXN(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </AppCard>

        {/* ── Dona 3: Portafolio de edificios ───────────────────── */}
        <AppCard className="dashboard-card-mobile" style={{ padding: 24 }}>
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 4px",
            }}
          >
            Portafolio
          </p>

          {loadingData ? (
            <div
              style={{
                height: DONUT_LOADING_HEIGHT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Cargando...
            </div>
          ) : buildingStats.total === 0 ? (
            <div style={{ height: DONUT_LOADING_HEIGHT }}>
              <AppEmptyState
                title="Sin edificios"
                description="Registra tu primer edificio para ver esta métrica."
              />
            </div>
          ) : (
            <>
              <div style={{ position: "relative", width: "100%" }}>
                <ResponsiveContainer width="100%" aspect={1}>
                  <PieChart>
                    <Pie
                      data={buildingDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {buildingDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "1.875rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      display: "block",
                      lineHeight: 1,
                    }}
                  >
                    {buildingStats.total}
                  </strong>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    edificios
                  </span>
                </div>
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--divider)",
                  paddingTop: 14,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  <strong style={{ color: CHART.reference }}>{buildingStats.withTenants}</strong>{" "}
                  con inquilinos ·{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>{buildingStats.empty}</strong>{" "}
                  {buildingStats.empty === 1 ? "vacío" : "vacíos"}
                </p>
              </div>
            </>
          )}
        </AppCard>
      </div>

      </motion.div>

      {/* ══ FILA 2: BARCHART — Cobrado vs Pendiente ══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
      <div style={{ marginBottom: 24 }}>
        <SectionCard
          title="Cobranza — últimos 6 meses"
          subtitle="Cobrado vs pendiente por mes"
          icon={<TrendingUp size={18} />}
        >
          {loadingData ? (
            <div
              style={{
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Cargando datos...
            </div>
          ) : barChartIsEmpty ? (
            <AppEmptyState
              title="Sin registros de cobranza"
              description="Cuando registres cobros aparecerá aquí la tendencia de los últimos 6 meses."
            />
          ) : (
            <div className="dashboard-chart-wrap">
              <div className="dashboard-chart-legend">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8125rem" }}>
                  <span style={{ color: CHART.positive }}>●</span> Cobrado
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8125rem" }}>
                  <span style={{ color: CHART.warning }}>●</span> Pendiente
                </span>
              </div>
              <div className="dashboard-bar-container">
              <ResponsiveContainer width="100%" height={chartHeight} minWidth={1}>
                <BarChart data={barChartData} barGap={4} barCategoryGap="28%" margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.chartGrid} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: "0.75rem", fill: c.chartAxis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={yAxisFormatter}
                    tick={{ fontSize: "0.75rem", fill: c.chartAxis }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip content={<MXNTooltip isDark={isDark} />} />
                  <Bar dataKey="Cobrado" fill={CHART.positive} radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Pendiente" fill={CHART.warning} radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
      </motion.div>

      {/* ══ FILA 3: AGENDA DE HOY + UNIDADES DISPONIBLES ════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.16 }}>
      <div
        className="dashboard-grid-2"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols2}, 1fr)`,
          gap: cardGap,
          marginBottom: cardGap,
          alignItems: "stretch",
        }}
      >
        {/* ── Card A: Agenda de hoy ─────────────────────────────── */}
        <div style={{ overflow: "hidden", minWidth: 0, height: "100%" }}>
        <SectionCard
          title="Agenda de hoy"
          subtitle={new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          icon={<Calendar size={18} />}
        >
          {loadingData ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : !agendaHoy.hasActivity ? (
            <AppEmptyState
              title="Día sin actividades programadas ✓"
              description="No hay limpiezas, mantenimientos ni pagos para hoy."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Limpiezas */}
              {agendaHoy.totalCleanings > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 14px",
                    background: "var(--metric-bg-green)",
                    border: "1px solid var(--metric-border-green)",
                    borderRadius: "var(--border-radius-lg)",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      background: "var(--icon-bg-green)",
                      borderRadius: "var(--border-radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--icon-color-green)",
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "var(--metric-value-green)" }}>
                      {agendaHoy.totalCleanings}{" "}
                      {agendaHoy.totalCleanings === 1 ? "limpieza" : "limpiezas"}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {agendaHoy.buildingCleanings > 0 &&
                        `${agendaHoy.buildingCleanings} de edificio`}
                      {agendaHoy.buildingCleanings > 0 && agendaHoy.unitCleanings > 0 && " · "}
                      {agendaHoy.unitCleanings > 0 &&
                        `${agendaHoy.unitCleanings} de unidad`}
                    </p>
                  </div>
                </div>
              )}

              {/* Mantenimientos */}
              {agendaHoy.maintenances > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 14px",
                    background: "var(--metric-bg-neutral)",
                    border: "1px solid var(--metric-border-neutral)",
                    borderRadius: "var(--border-radius-lg)",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      background: "var(--icon-bg-blue)",
                      borderRadius: "var(--border-radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--icon-color-blue)",
                    }}
                  >
                    <Wrench size={18} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                      {agendaHoy.maintenances}{" "}
                      {agendaHoy.maintenances === 1 ? "mantenimiento" : "mantenimientos"}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Programados para hoy
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </SectionCard>
        </div>

        {/* ── Card B: Unidades disponibles ──────────────────────── */}
        <div style={{ overflow: "hidden", minWidth: 0, height: "100%" }}>
        <SectionCard
          title="Unidades disponibles"
          subtitle="Sin lease activo · máximo 6"
          icon={<DoorOpen size={18} />}
        >
          {loadingData ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : availableUnitRows.length === 0 ? (
            <AppEmptyState
              title="Sin unidades disponibles"
              description="Todas las unidades tienen un lease activo."
            />
          ) : (
            <div className="dashboard-units-table">
            <AppTable
              rows={availableUnitRows}
              columns={[
                {
                  key: "unit",
                  header: "Unidad",
                  render: (row) => (
                    <div>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          display: "block",
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.unitLabel}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {row.buildingName}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "type",
                  header: "Recámaras",
                  render: (row) => (
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      {row.bedroomsLabel}
                    </span>
                  ),
                },
              ]}
            />
            </div>
          )}
        </SectionCard>
        </div>
      </div>

      </motion.div>

      {/* ══ FILA 4: DOS TABLAS OPERATIVAS ════════════════════════════ */}
      {/*
        Usamos minmax(0, 1fr) en lugar de 1fr para que cada columna
        pueda encogerse por debajo de su contenido mínimo y no rompa
        el grid cuando AppTable tiene contenido largo.
      */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : `repeat(${cols2}, minmax(0, 1fr))`,
          gap: 24,
          alignItems: "stretch",
        }}
      >
        {/* ── Tabla 1: Cobros vencidos urgentes ─────────────────── */}
        <SectionCard
          title="Cobros vencidos"
          subtitle="Más antiguos primero · top 5"
          icon={<AlertTriangle size={18} />}
        >
          {loadingData ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : overdueRows.length === 0 ? (
            <AppEmptyState
              title="Sin cobros vencidos ✓"
              description="No hay cobros vencidos. ¡Todo al corriente!"
            />
          ) : (
            <div className="dashboard-table-mobile">
            <AppTable
              minWidth={0}
              rows={overdueRows}
              columns={[
                {
                  key: "tenant",
                  header: "Inquilino",
                  render: (row) => (
                    <div style={{ overflow: "hidden" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          display: "block",
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.tenantName}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--text-muted)",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.buildingUnit}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "amount",
                  header: "Monto",
                  align: "right",
                  render: (row) => (
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          color: "var(--badge-text-red)",
                          display: "block",
                        }}
                      >
                        {row.amount}
                      </span>
                      <AppBadge variant="red">
                        {row.daysOverdue}{" "}
                        {row.daysOverdue === 1 ? "día" : "días"}
                      </AppBadge>
                    </div>
                  ),
                },
              ]}
            />
            </div>
          )}
        </SectionCard>

        {/* ── Tabla 2: Contratos por vencer ─────────────────────── */}
        {/*
          overflow:hidden en el wrapper evita que la card se expanda horizontalmente
          cuando el contenido de la tabla es más ancho que 1/3 del grid.
        */}
        <div className="dashboard-table-mobile" style={{ overflow: "hidden", minWidth: 0 }}>
          <SectionCard
            title="Contratos por vencer"
            subtitle="Próximos 90 días · top 5"
            icon={<CalendarClock size={18} />}
          >
            {loadingData ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
            ) : expiringLeaseRows.length === 0 ? (
              <AppEmptyState
                title="Sin contratos por vencer"
                description="No hay contratos activos que venzan en los próximos 90 días."
              />
            ) : (
              <div className="dashboard-contracts-table">
              <AppTable
                minWidth={0}
                rows={expiringLeaseRows}
                columns={[
                  {
                    key: "tenant",
                    header: "Inquilino",
                    /* width sin fijar → ocupa todo el espacio sobrante */
                    render: (row) => (
                      <div style={{ overflow: "hidden", maxWidth: "100%" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.8125rem",
                            display: "block",
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.tenantName.length > 15
                            ? row.tenantName.slice(0, 15) + "..."
                            : row.tenantName}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            color: "var(--text-muted)",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.endDateLabel} · {row.daysLeft}{" "}
                          {row.daysLeft === 1 ? "día" : "días"}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "daysLeft",
                    header: "Vence",
                    align: "right",
                    /* Columna de ancho mínimo fijo para no empujar el layout */
                    width: 100,
                    render: (row) => {
                      const badge = daysLeftBadge(row.daysLeft);
                      return (
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              color: "var(--text-muted)",
                              display: "block",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.endDateLabel}
                          </span>
                          <AppBadge
                            backgroundColor={badge.bg}
                            textColor={badge.text}
                            borderColor={badge.border}
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {row.daysLeft}{" "}
                            {row.daysLeft === 1 ? "día" : "días"}
                          </AppBadge>
                        </div>
                      );
                    },
                  },
                ]}
              />
              </div>
            )}
          </SectionCard>
        </div>
      </div>
      </motion.div>

      {/* ══ FILA 5: NOTIFICACIONES + CHECKLIST MENSUAL ═══════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.32 }}>
      <div
        className="dashboard-grid-2"
        style={{ display: "grid", gridTemplateColumns: `repeat(${cols2}, 1fr)`, gap: cardGap, marginTop: cardGap, alignItems: "stretch" }}
      >
        {/* ── Card: Notificaciones activas ──────────────────────── */}
        <SectionCard
          title="Notificaciones activas"
          subtitle="Estado operativo del portafolio"
          icon={<Bell size={18} />}
        >
          {notifLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Calculando...</p>
          ) : notifications.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
              <CheckCircle2 size={36} color="var(--metric-value-green)" />
              <p style={{ margin: 0, fontWeight: 700, color: "var(--metric-value-green)", fontSize: "0.9375rem" }}>Todo al día</p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                No hay alertas operativas pendientes.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notifications.map(notif => {
                const col = getSeverityStyle(notif.severity);
                return (
                  <div
                    key={notif.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: "var(--border-radius-md)",
                      background: col.bg,
                      borderLeft: `4px solid ${col.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: col.dot,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: col.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {MODULE_LABELS[notif.module]}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8125rem", color: col.text }}>{notif.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: col.text, opacity: 0.8 }}>{notif.description}</p>
                    </div>
                    {notif.action_route && (
                      <a
                        href={notif.action_route}
                        style={{
                          alignSelf: "center",
                          flexShrink: 0,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: col.text,
                          textDecoration: "underline",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: 44,
                          padding: "0 4px",
                        }}
                      >
                        Ver →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Card: Checklist mensual ────────────────────────────── */}
        {(() => {
          const now = new Date();
          const monthName = now.toLocaleDateString("es-MX", { month: "long" });
          const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          const TASKS = [
            { key: 'generar_cobros',     label: 'Generar cobros del mes',       route: '/collections/invoice-generation' },
            { key: 'revisar_vencidos',   label: 'Revisar cobros vencidos',       route: '/collections' },
            { key: 'lecturas_servicios', label: 'Capturar lecturas del mes',     route: '/servicios' },
            { key: 'revisar_contratos',  label: 'Revisar contratos por vencer',  route: '/collections' },
          ];
          const allDone = !checklistLoading && TASKS.every(t => checklistResults[t.key]);
          return (
            <SectionCard
              title={`Pendientes de ${monthCapitalized} ${now.getFullYear()}`}
              subtitle="Tareas recurrentes del mes"
              icon={<ClipboardList size={18} />}
            >
              {checklistLoading ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Calculando...</p>
              ) : allDone ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
                  <CheckCircle2 size={36} color="var(--metric-value-green)" />
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--metric-value-green)", fontSize: "0.9375rem" }}>Mes al día</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                    Todas las tareas del mes están completadas.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {TASKS.map(task => {
                    const done = Boolean(checklistResults[task.key]);
                    return (
                      <div
                        key={task.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: "var(--border-radius-md)",
                          background: done ? "var(--metric-bg-green)" : "var(--bg-page)",
                          border: `1px solid ${done ? "var(--metric-border-green)" : "var(--border-default)"}`,
                        }}
                      >
                        {done ? (
                          <CheckCircle2 size={18} color="var(--badge-text-green)" style={{ flexShrink: 0 }} />
                        ) : (
                          <Circle size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        )}
                        <span
                          style={{
                            flex: 1,
                            fontSize: "0.8125rem",
                            fontWeight: done ? 600 : 500,
                            color: done ? "var(--badge-text-green)" : "var(--text-primary)",
                            textDecoration: done ? "line-through" : "none",
                            opacity: done ? 0.75 : 1,
                          }}
                        >
                          {task.label}
                        </span>
                        {!done && (
                          <a
                            href={task.route}
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                              textDecoration: "none",
                              flexShrink: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              minHeight: 44,
                              padding: "0 4px",
                            }}
                          >
                            Ir →
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );
        })()}
      </div>
      </motion.div>

      {/* ══ CARD: SETUP PENDIENTE ═══════════════════════════════════ */}
      <AnimatePresence>
        {!loadingSetup && setupProgress.length > 0 && (
          <motion.div
            key="setup-progress-card"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
            style={{ marginTop: 24 }}
          >
            <SectionCard
              title="Configuración pendiente"
              subtitle={`${setupProgress.length} ${setupProgress.length === 1 ? "propiedad" : "propiedades"} sin completar`}
              icon={<ClipboardList size={18} />}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {setupProgress.map((b, bi) => {
                  const stepsArr = [
                    { label: "Propiedad creada", done: b.steps.created, action: null },
                    { label: "Tipología", done: b.steps.hasUnitTypes, action: { label: "Crear tipología", href: `/buildings/${b.buildingId}?tab=typologies` } },
                    { label: "Unidades", done: b.steps.hasUnits, action: { label: "Agregar unidades", href: `/buildings/${b.buildingId}?tab=typologies` } },
                    { label: "Servicios", done: b.steps.hasServices, action: { label: "Configurar servicios", href: `/buildings/${b.buildingId}?tab=services` } },
                    { label: "Inquilino activo", done: b.steps.hasTenant, action: { label: "Agregar inquilino", href: "/tenants" } },
                  ] as const;
                  const completedCount = stepsArr.filter(s => s.done).length;
                  const progressPct = (completedCount / stepsArr.length) * 100;
                  const pendingSteps = stepsArr.filter(s => !s.done && s.action);
                  return (
                    <div key={b.buildingId} style={{ paddingBottom: bi < setupProgress.length - 1 ? 20 : 0, borderBottom: bi < setupProgress.length - 1 ? "1px solid var(--border-default)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Building2 size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <Link href={`/buildings/${b.buildingId}`} style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>
                            {b.buildingName}
                          </Link>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{completedCount}/5</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border-default)", borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                          style={{ height: "100%", background: "var(--accent)", borderRadius: 999 }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {pendingSteps.map(step => step.action && (
                          <Link
                            key={step.label}
                            href={step.action.href}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)",
                              border: "1px solid var(--accent)", borderRadius: "var(--border-radius-sm)",
                              padding: "4px 10px", textDecoration: "none",
                            }}
                          >
                            {step.action.label}
                            <ChevronRight size={12} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

    </PageContainer>
  );
}


