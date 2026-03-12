"use client";

/*
  Módulo de Pagos administrativos.

  Esta página usa la nueva base de datos operativa:
  - expense_schedules
  - expense_payments

  Objetivo:
  - mostrar pagos administrativos reales del sidebar
  - enfocarse en gastos que paga la empresa o el edificio
  - dejar fuera de esta vista los servicios pagados directamente por el inquilino
  - mantener el mismo design system del sistema

  Importante:
  - aquí NO usamos invoices
  - aquí NO mostramos facturas futuras al inquilino
  - esta pantalla es para operación administrativa interna
*/

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Filter,
  ReceiptText,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppTable from "@/components/AppTable";
import AppSelect from "@/components/AppSelect";

type Building = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
};

type ExpenseSchedule = {
  id: string;
  building_id: string;
  unit_id: string | null;
  expense_type:
    | "electricity"
    | "water"
    | "gas"
    | "internet"
    | "phone"
    | "maintenance_service"
    | "security"
    | "cleaning_service"
    | "other";
  title: string;
  vendor_name: string | null;
  responsibility_type: "company" | "building" | "tenant";
  applies_to: "building" | "unit";
  amount_estimated: number | null;
  due_day: number;
  active: boolean;
  notes: string | null;
};

type ExpensePayment = {
  id: string;
  expense_schedule_id: string;
  company_id: string;
  building_id: string;
  unit_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  status: "pending" | "paid" | "overdue";
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
};

type PaymentStatusFilter = "all" | "pending" | "paid" | "overdue";

type PaymentRow = {
  id: string;
  buildingId: string;
  buildingName: string;
  unitLabel: string;
  title: string;
  vendorName: string;
  expenseTypeLabel: string;
  responsibilityLabel: string;
  appliesToLabel: string;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  status: "pending" | "paid" | "overdue";
  statusLabel: string;
  paymentReference: string;
  notes: string;
};

const MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function getTodayDateOnlyKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDate(dateKey: string) {
  if (!dateKey) return "Sin fecha";

  const date = parseDateOnly(dateKey);

  return `${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatPeriod(periodYear: number, periodMonth: number) {
  return `${MONTH_LABELS_SHORT[periodMonth - 1] || "Mes"} ${periodYear}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function getExpenseTypeLabel(type: ExpenseSchedule["expense_type"]) {
  if (type === "electricity") return "Electricidad";
  if (type === "water") return "Agua";
  if (type === "gas") return "Gas";
  if (type === "internet") return "Internet";
  if (type === "phone") return "Telefonía";
  if (type === "maintenance_service") return "Servicio de mantenimiento";
  if (type === "security") return "Seguridad";
  if (type === "cleaning_service") return "Servicio de limpieza";
  return "Otro";
}

function getResponsibilityLabel(type: ExpenseSchedule["responsibility_type"]) {
  if (type === "company") return "Empresa";
  if (type === "building") return "Edificio";
  return "Inquilino";
}

function getAppliesToLabel(type: ExpenseSchedule["applies_to"]) {
  return type === "unit" ? "Unidad" : "Edificio";
}

function getStatusLabel(status: PaymentRow["status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "paid") return "Pagado";
  return "Vencido";
}

function getStatusColors(status: PaymentRow["status"]) {
  if (status === "paid") {
    return {
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
    };
  }

  if (status === "pending") {
    return {
      background: "#FEFCE8",
      border: "#FDE68A",
      text: "#A16207",
    };
  }

  return {
    background: "#FEF2F2",
    border: "#FECACA",
    text: "#B91C1C",
  };
}

export default function PaymentsPage() {
  const { user, loading } = useCurrentUser();

  const [loadingPage, setLoadingPage] = useState(true);
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusFilter>("all");

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    loadPaymentsData();
  }, [loading, user?.company_id]);

  async function loadPaymentsData() {
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMessage("");

    const [buildingsRes, unitsRes, schedulesRes, paymentsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .order("name", { ascending: true }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id),

      supabase
        .from("expense_schedules")
        .select(
          "id, building_id, unit_id, expense_type, title, vendor_name, responsibility_type, applies_to, amount_estimated, due_day, active, notes"
        )
        .eq("company_id", user.company_id)
        .eq("active", true)
        .in("responsibility_type", ["company", "building"]),

      supabase
        .from("expense_payments")
        .select(
          "id, expense_schedule_id, company_id, building_id, unit_id, period_year, period_month, due_date, amount_due, status, paid_at, payment_reference, notes, created_at"
        )
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true }),
    ]);

    if (buildingsRes.error) {
      setMessage("No se pudieron cargar los edificios.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMessage("No se pudieron cargar las unidades.");
      setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      setMessage("No se pudieron cargar las configuraciones de pagos.");
      setLoadingPage(false);
      return;
    }

    if (paymentsRes.error) {
      setMessage("No se pudieron cargar los registros de pagos.");
      setLoadingPage(false);
      return;
    }

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setExpenseSchedules((schedulesRes.data as ExpenseSchedule[]) || []);
    setExpensePayments((paymentsRes.data as ExpensePayment[]) || []);
    setLoadingPage(false);
  }

  const paymentRows = useMemo<PaymentRow[]>(() => {
    const buildingMap = new Map<string, Building>();
    const unitMap = new Map<string, Unit>();
    const scheduleMap = new Map<string, ExpenseSchedule>();

    buildings.forEach((building) => buildingMap.set(building.id, building));
    units.forEach((unit) => unitMap.set(unit.id, unit));
    expenseSchedules.forEach((schedule) => scheduleMap.set(schedule.id, schedule));

    return expensePayments
      .map((payment) => {
        const schedule = scheduleMap.get(payment.expense_schedule_id);

        if (!schedule) return null;
        if (schedule.responsibility_type === "tenant") return null;

        const building =
          buildingMap.get(payment.building_id) ||
          buildingMap.get(schedule.building_id);

        const unit =
          (payment.unit_id ? unitMap.get(payment.unit_id) : null) ||
          (schedule.unit_id ? unitMap.get(schedule.unit_id) : null);

        const unitLabel = unit?.display_code || unit?.unit_number || "General";

        return {
          id: payment.id,
          buildingId: payment.building_id,
          buildingName: building?.name || "Edificio",
          unitLabel: schedule.applies_to === "unit" ? `Unidad ${unitLabel}` : "Todo el edificio",
          title: schedule.title,
          vendorName: schedule.vendor_name || "Sin proveedor",
          expenseTypeLabel: getExpenseTypeLabel(schedule.expense_type),
          responsibilityLabel: getResponsibilityLabel(schedule.responsibility_type),
          appliesToLabel: getAppliesToLabel(schedule.applies_to),
          periodLabel: formatPeriod(payment.period_year, payment.period_month),
          dueDate: payment.due_date,
          dueDateLabel: formatDate(payment.due_date),
          amountDue: payment.amount_due,
          amountDueLabel: formatCurrency(payment.amount_due),
          status: payment.status,
          statusLabel: getStatusLabel(payment.status),
          paymentReference: payment.payment_reference || "—",
          notes: payment.notes || schedule.notes || "—",
        };
      })
      .filter((row): row is PaymentRow => Boolean(row));
  }, [buildings, units, expenseSchedules, expensePayments]);

  const filteredRows = useMemo(() => {
    return paymentRows.filter((row) => {
      if (selectedBuildingId !== "all" && row.buildingId !== selectedBuildingId) {
        return false;
      }

      if (selectedStatus !== "all" && row.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [paymentRows, selectedBuildingId, selectedStatus]);

  const selectedBuildingLabel =
    selectedBuildingId === "all"
      ? "Todos los edificios"
      : buildings.find((building) => building.id === selectedBuildingId)?.name || "Edificio";

  const totalRecords = filteredRows.length;
  const paidCount = filteredRows.filter((row) => row.status === "paid").length;
  const pendingCount = filteredRows.filter((row) => row.status === "pending").length;
  const overdueCount = filteredRows.filter((row) => row.status === "overdue").length;

  const pendingAmount = filteredRows
    .filter((row) => row.status === "pending" || row.status === "overdue")
    .reduce((sum, row) => sum + row.amountDue, 0);

  const todayKey = getTodayDateOnlyKey();

  const nextPendingLabel = useMemo(() => {
    const nextPending = filteredRows
      .filter((row) => row.status === "pending" && row.dueDate >= todayKey)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    if (!nextPending) return "Sin próximos pagos";
    return `${nextPending.title} · ${nextPending.dueDateLabel}`;
  }, [filteredRows, todayKey]);

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>
          Cargando módulo de pagos...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Pagos"
        subtitle="Control administrativo de servicios y gastos pagados por la empresa o por el edificio."
        titleIcon={<ReceiptText size={18} />}
      />

      {message ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {message}
        </div>
      ) : null}

      <AppGrid minWidth={220}>
        <MetricCard
          label="Registros"
          value={String(totalRecords)}
          helper={selectedBuildingLabel}
          icon={<ReceiptText size={18} />}
        />
        <MetricCard
          label="Pagados"
          value={String(paidCount)}
          helper="Pagos realizados"
          icon={<CheckCircle2 size={18} color="#16A34A" />}
        />
        <MetricCard
          label="Pendientes"
          value={String(pendingCount)}
          helper={nextPendingLabel}
          icon={<Clock3 size={18} color="#EAB308" />}
        />
        <MetricCard
          label="Vencidos"
          value={String(overdueCount)}
          helper="Requieren atención"
          icon={<AlertCircle size={18} color="#DC2626" />}
        />
        <MetricCard
          label="Monto pendiente"
          value={formatCurrency(pendingAmount)}
          helper="Pendiente + vencido"
          icon={<CreditCard size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Filtros"
        subtitle="Ajusta la vista por edificio y estado del pago."
        icon={<Filter size={18} />}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <Building2 size={14} />
                Edificio
              </div>

              <AppSelect
                value={selectedBuildingId}
                onChange={(event) => setSelectedBuildingId(event.target.value)}
              >
                <option value="all">Todos los edificios</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </AppSelect>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <Filter size={14} />
                Estado
              </div>

              <AppSelect
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as PaymentStatusFilter)
                }
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="overdue">Vencido</option>
              </AppSelect>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Listado de pagos administrativos"
        subtitle="Solo se muestran pagos absorbidos por la empresa o por el edificio."
        icon={<ReceiptText size={18} />}
      >
        <AppTable
          rows={filteredRows}
          emptyState="No hay pagos administrativos para mostrar con los filtros actuales."
          columns={[
            {
              key: "concept",
              header: "Concepto",
              render: (row: PaymentRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    {row.title}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    {row.expenseTypeLabel} · {row.vendorName}
                  </span>
                </div>
              ),
            },
            {
              key: "building",
              header: "Edificio / alcance",
              render: (row: PaymentRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {row.buildingName}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    {row.unitLabel} · {row.appliesToLabel}
                  </span>
                </div>
              ),
            },
            {
              key: "period",
              header: "Periodo",
              render: (row: PaymentRow) => (
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  {row.periodLabel}
                </span>
              ),
            },
            {
              key: "dueDate",
              header: "Vencimiento",
              render: (row: PaymentRow) => (
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  {row.dueDateLabel}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Monto",
              align: "right",
              render: (row: PaymentRow) => (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#111827",
                  }}
                >
                  {row.amountDueLabel}
                </span>
              ),
            },
            {
              key: "responsibility",
              header: "Responsable",
              render: (row: PaymentRow) => (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#374151",
                  }}
                >
                  {row.responsibilityLabel}
                </span>
              ),
            },
            {
              key: "status",
              header: "Estado",
              render: (row: PaymentRow) => {
                const colors = getStatusColors(row.status);

                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${colors.border}`,
                      background: colors.background,
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.statusLabel}
                  </span>
                );
              },
            },
            {
              key: "reference",
              header: "Referencia / notas",
              render: (row: PaymentRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#374151",
                    }}
                  >
                    {row.paymentReference}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#9CA3AF",
                    }}
                  >
                    {row.notes}
                  </span>
                </div>
              ),
            },
          ]}
        />
      </SectionCard>
    </PageContainer>
  );
}
