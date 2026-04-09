"use client";

/*
  Dashboard principal de PropAdmin.

  Secciones:
  1. Métricas de ocupación          — 4 MetricCards
  2. Métricas de cobranza del mes   — 3 MetricCards
  3. Chart de barras                — cobranza últimos 6 meses (recharts)
  4. Chart de dona                  — ocupación actual (recharts)
  5. Tabla cobros vencidos          — top 5, más antiguo primero
  6. Tabla próximos pagos admin     — vencimiento ≤ hoy+7 días
  7. Contratos por vencer           — próximos 90 días
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
  Building2,
  CalendarClock,
  CreditCard,
  DoorOpen,
  LayoutDashboard,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppGrid from "@/components/AppGrid";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";

/* ─── Types ───────────────────────────────────────────────────────── */

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
  status: string;
};

type Lease = {
  id: string;
  unit_id: string | null;
  tenant_id: string | null;
  status: string | null;
  end_date: string | null;
};

type Tenant = {
  id: string;
  full_name: string;
};

type Building = {
  id: string;
  name: string;
};

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

type ExpensePayment = {
  id: string;
  expense_schedule_id: string;
  building_id: string;
  amount_due: number;
  due_date: string;
  status: string;
};

type ExpenseSchedule = {
  id: string;
  title: string;
};

/* ─── Constantes ──────────────────────────────────────────────────── */

const MONTH_LABELS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/* ─── Helpers de módulo (fuera del componente para no recrear en render) ── */

function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function todayDateKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
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

/* Tooltip personalizado para recharts con formato MXN */
function MXNTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 13,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 6, color: "#111827" }}>{label}</p>
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

/* Devuelve colores de badge según días restantes del contrato */
function daysLeftBadge(days: number) {
  if (days < 30) return { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" };
  if (days < 60) return { bg: "#FFEDD5", text: "#C2410C", border: "#FDBA74" };
  return { bg: "#DCFCE7", text: "#166534", border: "#BBF7D0" };
}

/* ─── Filas derivadas ─────────────────────────────────────────────── */

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
  isOverdue: boolean;
};

type ExpiringLeaseRow = {
  id: string;
  tenantName: string;
  unitLabel: string;
  buildingName: string;
  endDateLabel: string;
  daysLeft: number;
};

/* ─── Componente principal ────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  /* Estado de carga global */
  const [loadingData, setLoadingData] = useState(true);

  /* Datos crudos de Supabase */
  const [units, setUnits] = useState<Unit[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);

  /* Guard de autenticación */
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  /* Carga inicial cuando el usuario está listo */
  useEffect(() => {
    if (user?.company_id) {
      void loadDashboard();
    }
  }, [user?.company_id]);

  async function loadDashboard() {
    if (!user?.company_id) return;
    setLoadingData(true);

    const today = todayDateKey();
    const sevenDaysLater = addDays(today, 7);

    /*
      Para el chart de barras necesitamos el primer día de hace 5 meses
      (6 meses en total contando el actual).
    */
    const now = new Date();
    const sixMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsAgoKey = [
      sixMonthsAgoDate.getFullYear(),
      String(sixMonthsAgoDate.getMonth() + 1).padStart(2, "0"),
      "01",
    ].join("-");

    const [
      unitsRes,
      leasesRes,
      tenantsRes,
      buildingsRes,
      collectionRes,
      expensePaymentsRes,
      expenseSchedulesRes,
    ] = await Promise.all([
      /* Unidades — necesitamos status para ocupación */
      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code, status")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Leases — activos + los que venzan en 90 días */
      supabase
        .from("leases")
        .select("id, unit_id, tenant_id, status, end_date")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Inquilinos — solo nombre para labels */
      supabase
        .from("tenants")
        .select("id, full_name")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Edificios — solo nombre para labels */
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      /* Cobros — últimos 6 meses para el chart + métricas del mes */
      supabase
        .from("collection_records")
        .select(
          "id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status"
        )
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .gte("due_date", sixMonthsAgoKey)
        .order("due_date", { ascending: true }),

      /* Pagos administrativos pendientes hasta los próximos 7 días
         (incluye vencidos sin pagar que tengan due_date ≤ hoy+7) */
      supabase
        .from("expense_payments")
        .select("id, expense_schedule_id, building_id, amount_due, due_date, status")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .neq("status", "paid")
        .lte("due_date", sevenDaysLater)
        .order("due_date", { ascending: true }),

      /* Schedules — solo para obtener el título del pago */
      supabase
        .from("expense_schedules")
        .select("id, title")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),
    ]);

    setUnits((unitsRes.data as Unit[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setTenants((tenantsRes.data as Tenant[]) || []);
    setBuildings((buildingsRes.data as Building[]) || []);
    setCollectionRecords((collectionRes.data as CollectionRecord[]) || []);
    setExpensePayments((expensePaymentsRes.data as ExpensePayment[]) || []);
    setExpenseSchedules((expenseSchedulesRes.data as ExpenseSchedule[]) || []);

    setLoadingData(false);
  }

  /* ─── Mapas de lookup (id → entidad) ─────────────────────────── */

  const tenantMap = useMemo(
    () => new Map(tenants.map((t) => [t.id, t])),
    [tenants]
  );
  const buildingMap = useMemo(
    () => new Map(buildings.map((b) => [b.id, b])),
    [buildings]
  );
  const unitMap = useMemo(
    () => new Map(units.map((u) => [u.id, u])),
    [units]
  );
  const scheduleMap = useMemo(
    () => new Map(expenseSchedules.map((s) => [s.id, s])),
    [expenseSchedules]
  );
  /* lease_id → Lease para enriquecer collection_records */
  const leaseMap = useMemo(
    () => new Map(leases.map((l) => [l.id, l])),
    [leases]
  );

  /* ─── 1. Métricas de ocupación ───────────────────────────────── */

  const occupancyStats = useMemo(() => {
    const total = units.length;
    const occupied = units.filter((u) => u.status === "OCCUPIED").length;
    const vacant = units.filter((u) => u.status === "VACANT").length;
    const maintenance = units.filter((u) => u.status === "MAINTENANCE").length;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, vacant, maintenance, rate };
  }, [units]);

  /* ─── 2. Métricas de cobranza del mes actual ─────────────────── */

  const collectionMonthStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthRecords = collectionRecords.filter(
      (r) => r.period_year === currentYear && r.period_month === currentMonth
    );

    /* Cobrado: suma de amount_collected en registros del mes */
    const collected = monthRecords.reduce(
      (sum, r) => sum + (r.amount_collected ?? 0),
      0
    );

    /* Pendiente: saldo restante de registros pending o partial del mes */
    const pending = monthRecords
      .filter((r) => r.status === "pending" || r.status === "partial")
      .reduce((sum, r) => sum + (r.amount_due - (r.amount_collected ?? 0)), 0);

    /* Vencido: saldo restante de TODOS los registros overdue (no solo del mes) */
    const overdue = collectionRecords
      .filter((r) => r.status === "overdue")
      .reduce((sum, r) => sum + (r.amount_due - (r.amount_collected ?? 0)), 0);

    return { collected, pending, overdue };
  }, [collectionRecords]);

  /* ─── 3. Datos para el BarChart — últimos 6 meses ────────────── */

  const barChartData = useMemo(() => {
    const now = new Date();
    /* Construimos el arreglo de los 6 meses de más antiguo a más reciente */
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: MONTH_LABELS_SHORT[d.getMonth()],
      });
    }

    return months.map(({ year, month, label }) => {
      const records = collectionRecords.filter(
        (r) => r.period_year === year && r.period_month === month
      );
      const cobrado = records.reduce(
        (sum, r) => sum + (r.amount_collected ?? 0),
        0
      );
      /* Pendiente = saldo no cobrado de registros que no están "collected" */
      const pendiente = records
        .filter((r) => r.status !== "collected")
        .reduce(
          (sum, r) => sum + (r.amount_due - (r.amount_collected ?? 0)),
          0
        );
      return { mes: label, Cobrado: cobrado, Pendiente: pendiente };
    });
  }, [collectionRecords]);

  const barChartIsEmpty = barChartData.every(
    (d) => d.Cobrado === 0 && d.Pendiente === 0
  );

  /* ─── 4. Datos para el PieChart — ocupación ─────────────────── */

  const donutData = useMemo(() => {
    const { occupied, vacant, maintenance } = occupancyStats;
    const segments = [
      { name: "Ocupadas", value: occupied, color: "#22C55E" },
      { name: "Vacantes", value: vacant, color: "#E2E8F0" },
    ];
    if (maintenance > 0) {
      segments.push({ name: "Mantenimiento", value: maintenance, color: "#3B82F6" });
    }
    return segments;
  }, [occupancyStats]);

  /* ─── 5. Cobros vencidos (top 5, más antiguo primero) ────────── */

  const overdueRows = useMemo<OverdueRow[]>(() => {
    const today = todayDateKey();

    return collectionRecords
      .filter((r) => r.status === "overdue")
      .sort((a, b) => a.due_date.localeCompare(b.due_date)) /* más antiguo primero */
      .slice(0, 5)
      .map((r) => {
        /* Nombre del inquilino via lease → tenant */
        const lease = r.lease_id ? leaseMap.get(r.lease_id) : null;
        const tenant = lease?.tenant_id ? tenantMap.get(lease.tenant_id) : null;
        const tenantName = tenant?.full_name ?? "Sin inquilino";

        const building = buildingMap.get(r.building_id);
        const unit = unitMap.get(r.unit_id);
        const unitLabel = unit?.display_code ?? unit?.unit_number ?? "—";

        const balance = r.amount_due - (r.amount_collected ?? 0);
        const daysOverdue = daysBetween(r.due_date, today);

        return {
          id: r.id,
          tenantName,
          buildingUnit: `${building?.name ?? "—"} · ${unitLabel}`,
          amount: formatMXN(balance),
          daysOverdue,
        };
      });
  }, [collectionRecords, leaseMap, tenantMap, buildingMap, unitMap]);

  /* ─── 6. Próximos pagos administrativos (top 5) ─────────────── */

  const upcomingPaymentRows = useMemo<UpcomingPaymentRow[]>(() => {
    const today = todayDateKey();

    return expensePayments.slice(0, 5).map((p) => {
      const schedule = scheduleMap.get(p.expense_schedule_id);

      return {
        id: p.id,
        title: schedule?.title ?? "Sin concepto",
        amount: formatMXN(p.amount_due),
        dueDateLabel: formatDateLabel(p.due_date),
        isOverdue: p.due_date < today,
      };
    });
  }, [expensePayments, scheduleMap]);

  /* ─── 7. Contratos por vencer en 90 días ─────────────────────── */

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
      .map((l) => {
        const tenant = l.tenant_id ? tenantMap.get(l.tenant_id) : null;
        const unit = l.unit_id ? unitMap.get(l.unit_id) : null;
        const building = unit?.building_id ? buildingMap.get(unit.building_id) : null;
        const daysLeft = daysBetween(today, l.end_date ?? "");

        return {
          id: l.id,
          tenantName: tenant?.full_name ?? "Sin inquilino",
          unitLabel: unit?.display_code ?? unit?.unit_number ?? "—",
          buildingName: building?.name ?? "—",
          endDateLabel: formatDateLabel(l.end_date ?? ""),
          daysLeft,
        };
      });
  }, [leases, tenantMap, unitMap, buildingMap]);

  /* ─── Guards de sesión ───────────────────────────────────────── */

  if (loading) {
    return (
      <PageContainer>
        <p style={{ padding: "40px 0", color: "#667085" }}>Cargando usuario...</p>
      </PageContainer>
    );
  }
  if (!user) return null;

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        titleIcon={<LayoutDashboard size={20} />}
        subtitle="Vista general del portafolio: ocupación, cobranza y alertas operativas."
        actions={<UiButton href="/buildings">Ver edificios</UiButton>}
      />

      {/* ── 1. MÉTRICAS DE OCUPACIÓN ──────────────────────────────── */}
      <AppGrid minWidth={200} gap={16} style={{ marginBottom: 12 }}>
        <MetricCard
          label="Total de unidades"
          value={loadingData ? "..." : occupancyStats.total}
          icon={<Building2 size={18} />}
          helper="Registradas en el sistema"
        />
        <MetricCard
          label="Unidades ocupadas"
          value={loadingData ? "..." : occupancyStats.occupied}
          icon={<DoorOpen size={18} />}
          helper="Con lease activo"
        />
        <MetricCard
          label="Unidades vacantes"
          value={loadingData ? "..." : occupancyStats.vacant}
          icon={<DoorOpen size={18} />}
          helper="Disponibles"
        />
        <MetricCard
          label="Tasa de ocupación"
          value={loadingData ? "..." : `${occupancyStats.rate}%`}
          icon={<TrendingUp size={18} />}
          helper="Ocupadas / total"
        />
      </AppGrid>

      {/* ── 2. MÉTRICAS DE COBRANZA DEL MES ───────────────────────── */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#94A3B8",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "24px 0 12px",
        }}
      >
        Cobranza — mes actual
      </p>
      <AppGrid minWidth={220} gap={16} style={{ marginBottom: 32 }}>
        <MetricCard
          label="Cobrado este mes"
          value={loadingData ? "..." : formatMXN(collectionMonthStats.collected)}
          icon={<Wallet size={18} />}
          helper="Pagos registrados"
        />
        <MetricCard
          label="Pendiente de cobro"
          value={loadingData ? "..." : formatMXN(collectionMonthStats.pending)}
          icon={<CreditCard size={18} />}
          helper="Parciales + pendientes del mes"
        />
        <MetricCard
          label="Saldo vencido total"
          value={loadingData ? "..." : formatMXN(collectionMonthStats.overdue)}
          icon={<AlertTriangle size={18} />}
          helper="Requiere atención inmediata"
        />
      </AppGrid>

      {/* ── 3 + 4. CHARTS ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 20,
          marginBottom: 32,
          alignItems: "start",
        }}
      >
        {/* BarChart — cobranza últimos 6 meses */}
        <SectionCard
          title="Cobranza — últimos 6 meses"
          subtitle="Comparativo mensual: cobrado (verde) vs pendiente (naranja)."
          icon={<TrendingUp size={18} />}
        >
          {loadingData ? (
            <div
              style={{
                height: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94A3B8",
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
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barChartData} barGap={4} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#F2F4F7" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12, fill: "#667085" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yAxisFormatter}
                  tick={{ fontSize: 12, fill: "#667085" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={<MXNTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
                />
                <Bar
                  dataKey="Cobrado"
                  fill="#22C55E"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="Pendiente"
                  fill="#FB923C"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* PieChart (dona) — ocupación actual */}
        <SectionCard
          title="Ocupación actual"
          subtitle="Distribución de estatus de unidades."
          icon={<Building2 size={18} />}
        >
          {loadingData ? (
            <div
              style={{
                height: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94A3B8",
                fontSize: 14,
              }}
            >
              Cargando datos...
            </div>
          ) : occupancyStats.total === 0 ? (
            <AppEmptyState
              title="Sin unidades registradas"
              description="Crea unidades en tus edificios para ver el gráfico de ocupación."
            />
          ) : (
            <>
              {/* Dona con porcentaje superpuesto en el centro */}
              <div style={{ position: "relative", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={98}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Porcentaje centrado sobre la dona */}
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
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#101828",
                      display: "block",
                      lineHeight: 1,
                    }}
                  >
                    {occupancyStats.rate}%
                  </strong>
                  <span
                    style={{ fontSize: 11, color: "#667085", fontWeight: 600 }}
                  >
                    ocupación
                  </span>
                </div>
              </div>

              {/* Leyenda manual debajo de la dona */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 14,
                  justifyContent: "center",
                }}
              >
                {donutData.map((item) => (
                  <div
                    key={item.name}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: item.color,
                        display: "inline-block",
                        border:
                          item.color === "#E2E8F0" ? "1px solid #CBD5E1" : "none",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#475467" }}>
                      {item.name}:{" "}
                      <strong style={{ color: "#101828" }}>{item.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* ── 5. COBROS VENCIDOS URGENTES ───────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SectionCard
          title="Cobros vencidos"
          subtitle="Los 5 registros más antiguos sin cobrar. Requieren atención inmediata."
          icon={<AlertTriangle size={18} />}
        >
          {loadingData ? (
            <p style={{ color: "#94A3B8", fontSize: 14 }}>Cargando...</p>
          ) : overdueRows.length === 0 ? (
            <AppEmptyState
              title="Sin cobros vencidos"
              description="No hay cobros vencidos en este momento. ¡Todo al corriente!"
            />
          ) : (
            <AppTable
              rows={overdueRows}
              columns={[
                {
                  key: "tenant",
                  header: "Inquilino",
                  render: (row) => (
                    <span style={{ fontWeight: 600 }}>{row.tenantName}</span>
                  ),
                },
                {
                  key: "buildingUnit",
                  header: "Edificio · Unidad",
                  render: (row) => (
                    <span style={{ color: "#667085" }}>{row.buildingUnit}</span>
                  ),
                },
                {
                  key: "amount",
                  header: "Monto vencido",
                  align: "right",
                  render: (row) => (
                    <span style={{ fontWeight: 700, color: "#B91C1C" }}>
                      {row.amount}
                    </span>
                  ),
                },
                {
                  key: "daysOverdue",
                  header: "Días vencido",
                  align: "center",
                  render: (row) => (
                    <AppBadge
                      backgroundColor="#FEF2F2"
                      textColor="#B91C1C"
                      borderColor="#FECACA"
                    >
                      {row.daysOverdue}{" "}
                      {row.daysOverdue === 1 ? "día" : "días"}
                    </AppBadge>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 6. PRÓXIMOS PAGOS ADMINISTRATIVOS ─────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SectionCard
          title="Próximos pagos administrativos"
          subtitle="Gastos pendientes con vencimiento hasta los próximos 7 días."
          icon={<CalendarClock size={18} />}
        >
          {loadingData ? (
            <p style={{ color: "#94A3B8", fontSize: 14 }}>Cargando...</p>
          ) : upcomingPaymentRows.length === 0 ? (
            <AppEmptyState
              title="Sin pagos próximos"
              description="No hay pagos administrativos pendientes en los próximos 7 días."
            />
          ) : (
            <AppTable
              rows={upcomingPaymentRows}
              columns={[
                {
                  key: "title",
                  header: "Concepto",
                  render: (row) => (
                    <span style={{ fontWeight: 600 }}>{row.title}</span>
                  ),
                },
                {
                  key: "amount",
                  header: "Monto",
                  align: "right",
                  render: (row) => (
                    <span style={{ fontWeight: 700 }}>{row.amount}</span>
                  ),
                },
                {
                  key: "dueDate",
                  header: "Vencimiento",
                  render: (row) => (
                    <span style={{ color: "#667085" }}>{row.dueDateLabel}</span>
                  ),
                },
                {
                  key: "status",
                  header: "Estado",
                  align: "center",
                  render: (row) =>
                    row.isOverdue ? (
                      <AppBadge
                        backgroundColor="#FEF2F2"
                        textColor="#B91C1C"
                        borderColor="#FECACA"
                      >
                        Vencido
                      </AppBadge>
                    ) : (
                      <AppBadge
                        backgroundColor="#FEFCE8"
                        textColor="#A16207"
                        borderColor="#FDE68A"
                      >
                        Pendiente
                      </AppBadge>
                    ),
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 7. CONTRATOS POR VENCER (90 DÍAS) ─────────────────────── */}
      <SectionCard
        title="Contratos por vencer — próximos 90 días"
        subtitle="Leases activos que terminan pronto. Considera renovar con anticipación."
        icon={<CalendarClock size={18} />}
      >
        {loadingData ? (
          <p style={{ color: "#94A3B8", fontSize: 14 }}>Cargando...</p>
        ) : expiringLeaseRows.length === 0 ? (
          <AppEmptyState
            title="Sin contratos por vencer"
            description="No hay contratos activos que venzan en los próximos 90 días."
          />
        ) : (
          <AppTable
            rows={expiringLeaseRows}
            columns={[
              {
                key: "tenant",
                header: "Inquilino",
                render: (row) => (
                  <span style={{ fontWeight: 600 }}>{row.tenantName}</span>
                ),
              },
              {
                key: "unit",
                header: "Unidad",
                render: (row) => (
                  <div>
                    <span style={{ fontWeight: 600, display: "block" }}>
                      {row.unitLabel}
                    </span>
                    <span style={{ fontSize: 13, color: "#667085" }}>
                      {row.buildingName}
                    </span>
                  </div>
                ),
              },
              {
                key: "endDate",
                header: "Fecha fin",
                render: (row) => (
                  <span style={{ color: "#374151" }}>{row.endDateLabel}</span>
                ),
              },
              {
                key: "daysLeft",
                header: "Días restantes",
                align: "center",
                render: (row) => {
                  const badge = daysLeftBadge(row.daysLeft);
                  return (
                    <AppBadge
                      backgroundColor={badge.bg}
                      textColor={badge.text}
                      borderColor={badge.border}
                    >
                      {row.daysLeft} {row.daysLeft === 1 ? "día" : "días"}
                    </AppBadge>
                  );
                },
              },
            ]}
          />
        )}
      </SectionCard>
    </PageContainer>
  );
}
