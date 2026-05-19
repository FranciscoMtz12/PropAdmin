"use client";

/*
  Dashboard principal de PropAdmin.

  Layout:
  Fila 1 — Tres donas: Ocupación | Cobranza del mes | Portafolio de edificios
  Fila 2 — BarChart: Cobrado vs Pendiente últimos 6 meses
  Fila 3 — Dos cards: Agenda de hoy | Unidades disponibles
  Fila 4 — Tres tablas operativas: Cobros vencidos | Pagos admin | Contratos por vencer
*/

import { useEffect, useMemo, useState } from "react";
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
  CalendarClock,
  CheckCircle2,
  Circle,
  DoorOpen,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Wrench,
  Wallet,
  Calendar,
  Bell,
  ClipboardList,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
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
  unit_types: { bedrooms: number | null } | { bedrooms: number | null }[] | null;
};

type UnitType = {
  id: string;
  name: string;
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

type ExpenseSchedule = {
  id: string;
  title: string;
  due_day: number | null;
  amount_estimated: number | null;
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
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 13,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
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

type UpcomingPaymentRow = {
  id: string;
  title: string;
  amount: string;
  dueDateLabel: string;
  /** "overdue" → vence antes de hoy | "upcoming" → hoy o próximos 7 días */
  paymentStatus: "overdue" | "upcoming";
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

/* ─── Componente principal ────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { isDark } = useTheme();

  const role = user?.role;
  const isSuperOrAdmin = role === 'superadmin' || user?.is_superadmin || role === 'administracion' || role === 'directivo';
  const isCompras = role === 'compras';
  const isMantenimiento = role === 'mantenimiento';
  void isSuperOrAdmin;

  const { notifications, loading: notifLoading } = useNotifications(user?.company_id ?? "");

  /* ── Checklist mensual ─────────────────────────────────────── */
  const [checklistResults, setChecklistResults] = useState<Record<string, boolean>>({});
  const [checklistLoading, setChecklistLoading] = useState(true);

  const [loadingData, setLoadingData] = useState(true);

  /* ── Datos crudos de Supabase ──────────────────────────────────── */
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  /* Agenda de hoy */
  const [cleaningBuildingSchedules, setCleaningBuildingSchedules] = useState<CleaningBuildingSchedule[]>([]);
  const [cleaningUnitSchedules, setCleaningUnitSchedules] = useState<CleaningUnitSchedule[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);

  /* Guard de autenticación */
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  /* Redirect por rol a dashboard específico */
  useEffect(() => {
    if (loading || !user) return;
    if (role === 'administracion') { router.replace('/dashboard/administracion'); return; }
    if (role === 'compras') { router.replace('/dashboard/compras'); return; }
    if (role === 'mantenimiento') { router.replace('/dashboard/mantenimiento'); return; }
  }, [user, loading, role, router]);

  /* Carga inicial cuando el usuario está listo */
  useEffect(() => {
    if (user?.company_id) void loadDashboard();
  }, [user?.company_id]);

  useEffect(() => {
    if (user?.company_id) void loadChecklist(user.company_id);
  }, [user?.company_id]);

  async function loadDashboard() {
    if (!user?.company_id) return;
    setLoadingData(true);

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
      expenseSchedulesRes,
      cleaningBuildingRes,
      cleaningUnitRes,
      maintenanceRes,
    ] = await Promise.all([
      /* Unidades — incluye unit_type_id para card de disponibles */
      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code, unit_type_id, status, unit_types(bedrooms)")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Tipos de unidad — para mostrar tipo en card de disponibles */
      supabase
        .from("unit_types")
        .select("id, name"),

      /* Leases — activos + contratos próximos a vencer */
      supabase
        .from("leases")
        .select("id, unit_id, tenant_id, status, end_date")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Inquilinos — solo nombre */
      supabase
        .from("tenants")
        .select("id, full_name")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Edificios — solo nombre */
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Cobros — últimos 6 meses para chart + métricas del mes */
      supabase
        .from("collection_records")
        .select(
          "id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status"
        )
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .gte("due_date", sixMonthsAgoKey)
        .order("due_date", { ascending: true }),

      /* Schedules de gastos — título, día de cobro, monto estimado, próxima fecha */
      supabase
        .from("expense_schedules")
        .select("id, title, due_day, amount_estimated")
        .eq("company_id", user.company_id)
        .eq("active", true),

      /* Limpiezas de edificios activas — filtramos por día en memo */
      supabase
        .from("cleaning_building_schedules")
        .select("id, building_id, day_of_week")
        .eq("company_id", user.company_id),

      /* Limpiezas de unidades activas — filtramos por día en memo */
      supabase
        .from("cleaning_unit_schedules")
        .select("id, unit_id, day_of_week, active")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .eq("active", true),

      /* Mantenimientos con fecha programada = hoy */
      supabase
        .from("maintenance_logs")
        .select("id, unit_id, title, status")
        .eq("company_id", user.company_id),
    ]);

    setUnits((unitsRes.data as Unit[]) || []);
    setUnitTypes((unitTypesRes.data as UnitType[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setTenants((tenantsRes.data as Tenant[]) || []);
    setBuildings((buildingsRes.data as Building[]) || []);
    setCollectionRecords((collectionRes.data as CollectionRecord[]) || []);
    setExpenseSchedules((expenseSchedulesRes.data as ExpenseSchedule[]) || []);
    setCleaningBuildingSchedules((cleaningBuildingRes.data as CleaningBuildingSchedule[]) || []);
    setCleaningUnitSchedules((cleaningUnitRes.data as CleaningUnitSchedule[])||[]);
    setMaintenanceLogs((maintenanceRes.data as MaintenanceLog[]) || []);

    setLoadingData(false);
  }

  async function loadChecklist(companyId: string) {
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
      supabase.from('collection_records')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('period_year', year)
        .eq('period_month', month),
      supabase.from('collection_records')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'overdue')
        .is('deleted_at', null),
      supabase.from('building_utility_readings')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('period_year', year)
        .eq('period_month', month)
        .is('deleted_at', null),
      supabase.from('leases')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
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
  /* Color del segmento neutro (vacío/sin datos) — depende del modo */
  const neutralSegmentColor = isDark ? "#374151" : "#e5e7eb";

  const collectionDonutData = useMemo(() => {
    const { collected, pending, overdue } = collectionMonthStats;
    const hasData = collected > 0 || pending > 0 || overdue > 0;
    if (!hasData) return [{ name: "Sin datos", value: 1, color: neutralSegmentColor }];
    const data: { name: string; value: number; color: string }[] = [];
    if (collected > 0) data.push({ name: "Cobrado", value: collected, color: "#22c55e" });
    if (pending > 0) data.push({ name: "Pendiente", value: pending, color: "#f97316" });
    if (overdue > 0) data.push({ name: "Vencido", value: overdue, color: "#ef4444" });
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
      { name: "Con inquilinos", value: buildingStats.withTenants || 0, color: "#6366f1" },
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
    const paymentsDueToday = expenseSchedules.filter((s) => {
      if (s.due_day == null) return false;
      const d = String(s.due_day).padStart(2, "0");
      return todayKey.slice(-2) === d;
    });

    const totalCleanings = buildingCleanings.length + unitCleanings.length;

    return {
      buildingCleanings: buildingCleanings.length,
      unitCleanings: unitCleanings.length,
      totalCleanings,
      maintenances: maintenances.length,
      paymentsDueToday: paymentsDueToday.length,
      hasActivity: totalCleanings > 0 || maintenances.length > 0 || paymentsDueToday.length > 0,
    };
  }, [cleaningBuildingSchedules, cleaningUnitSchedules, maintenanceLogs, expenseSchedules]);

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
          const ut = Array.isArray(u.unit_types) ? u.unit_types[0] : u.unit_types;
          if (!ut || ut.bedrooms === null) return "—";
          if (ut.bedrooms === 0) return "Studio";
          return `${ut.bedrooms} rec.`;
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

  /* ─── FILA 4, Tabla 2: Próximos pagos admin (top 5) ─────────── */
  /*
    Calcula la fecha de vencimiento de cada schedule usando due_day + mes actual.
    Ejemplo: due_day=10, mes actual=abril 2026 → "2026-04-10"
    Muestra schedules cuya fecha calculada es ≤ hoy+7 (incluye vencidos).
  */
  const upcomingPaymentRows = useMemo<UpcomingPaymentRow[]>(() => {
    const today = todayDateKey();
    const sevenDaysLater = addDays(today, 7);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");

    return expenseSchedules
      .filter((s) => s.due_day != null)
      .map((s) => {
        /* Construir fecha: YYYY-MM-DD usando due_day del mes actual */
        const dayStr = String(s.due_day!).padStart(2, "0");
        const dueDateKey = `${currentYear}-${currentMonthStr}-${dayStr}`;
        return { s, dueDateKey };
      })
      /* Solo mostrar los que vencen hoy o antes, o hasta los próximos 7 días */
      .filter(({ dueDateKey }) => dueDateKey <= sevenDaysLater)
      .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey))
      .slice(0, 5)
      .map(({ s, dueDateKey }) => ({
        id: s.id,
        title: s.title,
        amount: formatMXN(s.amount_estimated ?? 0),
        dueDateLabel: formatDateLabel(dueDateKey),
        paymentStatus: dueDateKey < today ? "overdue" : "upcoming",
      }));
  }, [expenseSchedules]);

  /* ─── FILA 4, Tabla 3: Contratos por vencer — 90 días (top 5) ── */

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

  /* Altura de placeholder de loading para las donas */
  const DONUT_LOADING_HEIGHT = 220;

  /* ─── Paleta de colores según modo ───────────────────────────────
     Centralizado aquí para que todos los elementos del render usen
     el mismo set de colores y no haya valores hardcodeados dispersos.
  ─────────────────────────────────────────────────────────────────── */
  const c = {
    /* Textos */
    textPrimary:   isDark ? "#F1F5F9" : "#101828",
    textSecondary: isDark ? "#CBD5E1" : "#374151",
    textMuted:     isDark ? "#94A3B8" : "#667085",
    textSubtle:    isDark ? "#64748B" : "#94A3B8",
    textLabel:     isDark ? "#64748B" : "#9CA3AF",   /* labels uppercase */
    /* Divisores y bordes internos de card */
    divider:       isDark ? "#2D3748" : "#F3F4F6",
    /* Recharts */
    chartAxis:     isDark ? "#64748B" : "#667085",
    chartGrid:     isDark ? "#2D3748" : "#F2F4F7",
    /* Segmento neutro de las donas (vacío/sin datos) */
    donutEmpty:    isDark ? "#374151" : "#e5e7eb",
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
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* ── Dona 1: Ocupación ─────────────────────────────────── */}
        <AppCard className="dashboard-card-mobile" style={{ padding: 24 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: c.textLabel,
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
                color: c.textMuted,
                fontSize: 14,
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
              <div className="dashboard-donut-wrap" style={{ position: "relative", height: 190 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Ocupadas", value: occupancyStats.occupied },
                        { name: "Vacías", value: occupancyStats.vacant },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill={c.donutEmpty} />
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
                      fontSize: 30,
                      fontWeight: 800,
                      color: c.textPrimary,
                      display: "block",
                      lineHeight: 1,
                    }}
                  >
                    {occupancyStats.rate}%
                  </strong>
                  <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 600 }}>
                    ocupación
                  </span>
                </div>
              </div>
              <div
                style={{
                  borderTop: `1px solid ${c.divider}`,
                  paddingTop: 14,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: c.textSecondary }}>
                  <strong style={{ color: "#22c55e" }}>{occupancyStats.occupied}</strong>{" "}
                  ocupadas de{" "}
                  <strong style={{ color: c.textPrimary }}>{occupancyStats.total}</strong> totales
                </p>
                {occupancyStats.vacant > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: c.textMuted }}>
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
              fontSize: 11,
              fontWeight: 700,
              color: c.textLabel,
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
                color: c.textMuted,
                fontSize: 14,
              }}
            >
              Cargando...
            </div>
          ) : (
            <>
              {/* Dona siempre visible — gris si no hay datos */}
              <div className="dashboard-donut-wrap" style={{ position: "relative", height: 190 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <PieChart>
                    <Pie
                      data={collectionDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
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
                      fontSize: collectionDonutIsEmpty ? 18 : 16,
                      fontWeight: 800,
                      color: collectionDonutIsEmpty ? c.textSubtle : c.textPrimary,
                      display: "block",
                      lineHeight: 1.2,
                    }}
                  >
                    {collectionDonutIsEmpty
                      ? "$0.00"
                      : formatMXNCompact(collectionMonthStats.monthTotal)}
                  </strong>
                  <span style={{ fontSize: 10, color: c.textSubtle, fontWeight: 600 }}>
                    total mes
                  </span>
                </div>
              </div>

              {/* Pie: desglose o mensaje vacío */}
              <div
                style={{
                  borderTop: `1px solid ${c.divider}`,
                  paddingTop: 14,
                  marginTop: 6,
                }}
              >
                {collectionDonutIsEmpty ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: c.textSubtle,
                      textAlign: "center",
                    }}
                  >
                    Sin cobros registrados este mes
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "Cobrado", value: collectionMonthStats.collected, color: "#22c55e" },
                      { label: "Pendiente", value: collectionMonthStats.pending, color: "#f97316" },
                      { label: "Vencido", value: collectionMonthStats.overdue, color: "#ef4444" },
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
                              fontSize: 12,
                              color: c.textMuted,
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
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>
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
              fontSize: 11,
              fontWeight: 700,
              color: c.textLabel,
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
                color: c.textMuted,
                fontSize: 14,
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
              <div className="dashboard-donut-wrap" style={{ position: "relative", height: 190 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <PieChart>
                    <Pie
                      data={buildingDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
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
                      fontSize: 30,
                      fontWeight: 800,
                      color: c.textPrimary,
                      display: "block",
                      lineHeight: 1,
                    }}
                  >
                    {buildingStats.total}
                  </strong>
                  <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 600 }}>
                    edificios
                  </span>
                </div>
              </div>
              <div
                style={{
                  borderTop: `1px solid ${c.divider}`,
                  paddingTop: 14,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: c.textSecondary }}>
                  <strong style={{ color: "#6366f1" }}>{buildingStats.withTenants}</strong>{" "}
                  con inquilinos ·{" "}
                  <strong style={{ color: c.textSecondary }}>{buildingStats.empty}</strong>{" "}
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
                color: c.textMuted,
                fontSize: 14,
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
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <span style={{ color: "#22c55e" }}>●</span> Cobrado
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <span style={{ color: "#f97316" }}>●</span> Pendiente
                </span>
              </div>
              <div className="dashboard-bar-container">
              <ResponsiveContainer width="100%" height={280} minWidth={1}>
                <BarChart data={barChartData} barGap={4} barCategoryGap="28%" margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.chartGrid} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 12, fill: c.chartAxis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={yAxisFormatter}
                    tick={{ fontSize: 12, fill: c.chartAxis }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip content={<MXNTooltip isDark={isDark} />} />
                  <Bar dataKey="Cobrado" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Pendiente" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={36} />
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
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* ── Card A: Agenda de hoy ─────────────────────────────── */}
        <div style={{ overflow: "hidden", minWidth: 0 }}>
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
            <p style={{ color: c.textMuted, fontSize: 14 }}>Cargando...</p>
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
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      background: "var(--icon-bg-green)",
                      borderRadius: 10,
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
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--metric-value-green)" }}>
                      {agendaHoy.totalCleanings}{" "}
                      {agendaHoy.totalCleanings === 1 ? "limpieza" : "limpiezas"}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
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
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      background: "var(--icon-bg-blue)",
                      borderRadius: 10,
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
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                      {agendaHoy.maintenances}{" "}
                      {agendaHoy.maintenances === 1 ? "mantenimiento" : "mantenimientos"}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                      Programados para hoy
                    </p>
                  </div>
                </div>
              )}

              {/* Pagos que vencen hoy */}
              {agendaHoy.paymentsDueToday > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 14px",
                    background: "var(--metric-bg-amber)",
                    border: "1px solid var(--metric-border-amber)",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      background: "var(--icon-bg-amber)",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--icon-color-amber)",
                    }}
                  >
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--metric-value-amber)" }}>
                      {agendaHoy.paymentsDueToday}{" "}
                      {agendaHoy.paymentsDueToday === 1 ? "pago vence" : "pagos vencen"} hoy
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                      Gastos administrativos
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
        </div>

        {/* ── Card B: Unidades disponibles ──────────────────────── */}
        <div style={{ overflow: "hidden", minWidth: 0 }}>
        <SectionCard
          title="Unidades disponibles"
          subtitle="Sin lease activo · máximo 6"
          icon={<DoorOpen size={18} />}
        >
          {loadingData ? (
            <p style={{ color: c.textMuted, fontSize: 14 }}>Cargando...</p>
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
                          fontSize: 13,
                          display: "block",
                          color: c.textPrimary,
                        }}
                      >
                        {row.unitLabel}
                      </span>
                      <span style={{ fontSize: 11, color: c.textMuted }}>
                        {row.buildingName}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "type",
                  header: "Recámaras",
                  render: (row) => (
                    <span style={{ fontSize: 13, color: c.textSecondary }}>
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

      {/* ══ FILA 4: TRES TABLAS OPERATIVAS ═══════════════════════════ */}
      {/*
        Usamos minmax(0, 1fr) en lugar de 1fr para que cada columna
        pueda encogerse por debajo de su contenido mínimo y no rompa
        el grid cuando AppTable tiene contenido largo.
      */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.24 }}>
      <div
        className="dashboard-grid-3"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ── Tabla 1: Cobros vencidos urgentes ─────────────────── */}
        <SectionCard
          title="Cobros vencidos"
          subtitle="Más antiguos primero · top 5"
          icon={<AlertTriangle size={18} />}
        >
          {loadingData ? (
            <p style={{ color: c.textMuted, fontSize: 14 }}>Cargando...</p>
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
                          fontSize: 13,
                          display: "block",
                          color: c.textPrimary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.tenantName}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: c.textMuted,
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
                          fontSize: 13,
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

        {/* ── Tabla 2: Pagos administrativos próximos ───────────── */}
        <SectionCard
          title="Pagos administrativos"
          subtitle="Próximos 7 días · top 5"
          icon={<CalendarClock size={18} />}
        >
          {loadingData ? (
            <p style={{ color: c.textMuted, fontSize: 14 }}>Cargando...</p>
          ) : upcomingPaymentRows.length === 0 ? (
            <AppEmptyState
              title="Sin pagos próximos"
              description="No hay pagos administrativos en los próximos 7 días."
            />
          ) : (
            <div className="dashboard-table-mobile">
            <AppTable
              minWidth={0}
              rows={upcomingPaymentRows}
              columns={[
                {
                  key: "title",
                  header: "Concepto",
                  render: (row) => (
                    /* overflow:hidden evita que texto largo expanda la card */
                    <div style={{ overflow: "hidden" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          display: "block",
                          color: c.textPrimary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: c.textMuted,
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.dueDateLabel}
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
                        style={{ fontWeight: 700, fontSize: 13, display: "block" }}
                      >
                        {row.amount}
                      </span>
                      {row.paymentStatus === "overdue" ? (
                        <AppBadge variant="red" style={{ whiteSpace: "nowrap" }}>
                          Vencido
                        </AppBadge>
                      ) : (
                        <AppBadge variant="amber" style={{ whiteSpace: "nowrap" }}>
                          Próximo
                        </AppBadge>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            </div>
          )}
        </SectionCard>

        {/* ── Tabla 3: Contratos por vencer ─────────────────────── */}
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
              <p style={{ color: c.textMuted, fontSize: 14 }}>Cargando...</p>
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
                            fontSize: 13,
                            display: "block",
                            color: c.textPrimary,
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
                            fontSize: 11,
                            color: c.textMuted,
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
                              fontSize: 11,
                              color: c.textMuted,
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
        style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginTop: 24 }}
      >
        {/* ── Card: Notificaciones activas ──────────────────────── */}
        <SectionCard
          title="Notificaciones activas"
          subtitle="Estado operativo del portafolio"
          icon={<Bell size={18} />}
        >
          {notifLoading ? (
            <p style={{ color: c.textMuted, fontSize: 14 }}>Calculando...</p>
          ) : notifications.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
              <CheckCircle2 size={36} color="#22C55E" />
              <p style={{ margin: 0, fontWeight: 700, color: "#22C55E", fontSize: 15 }}>Todo al día</p>
              <p style={{ margin: 0, fontSize: 12, color: c.textMuted, textAlign: "center" }}>
                No hay alertas operativas pendientes.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notifications.map(notif => {
                const col = SEVERITY_COLORS[notif.severity];
                return (
                  <div
                    key={notif.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
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
                        <span style={{ fontSize: 11, fontWeight: 700, color: col.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {MODULE_LABELS[notif.module]}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: col.text }}>{notif.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: col.text, opacity: 0.8 }}>{notif.description}</p>
                    </div>
                    {notif.action_route && (
                      <a
                        href={notif.action_route}
                        style={{
                          alignSelf: "center",
                          flexShrink: 0,
                          fontSize: 12,
                          fontWeight: 700,
                          color: col.text,
                          textDecoration: "underline",
                          whiteSpace: "nowrap",
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
                <p style={{ color: c.textMuted, fontSize: 14 }}>Calculando...</p>
              ) : allDone ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
                  <CheckCircle2 size={36} color="#22C55E" />
                  <p style={{ margin: 0, fontWeight: 700, color: "#22C55E", fontSize: 15 }}>Mes al día</p>
                  <p style={{ margin: 0, fontSize: 12, color: c.textMuted, textAlign: "center" }}>
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
                          borderRadius: 10,
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
                            fontSize: 13,
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
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--accent)",
                              textDecoration: "none",
                              flexShrink: 0,
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

    </PageContainer>
  );
}


