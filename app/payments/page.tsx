"use client";

/*
  Módulo de Pagos administrativos.

  Esta página usa:
  - expense_schedules
  - expense_payments

  Nuevo en esta versión:
  - Formulario para crear pagos administrativos reales
  - Al guardar:
    1) crea la configuración en expense_schedules
    2) crea el registro del periodo en expense_payments
  - Esto permite que ya aparezcan eventos azules en el calendario

  Alcance de esta versión:
  - enfocada en pagos administrativos pagados por empresa o edificio
  - no usa invoices
  - no maneja todavía edición inline ni cambio de estado desde la tabla
*/

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Filter,
  Plus,
  ReceiptText,
  Save,
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
import UiButton from "@/components/UiButton";

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

type CreatePaymentForm = {
  buildingId: string;
  appliesTo: "building" | "unit";
  unitId: string;
  expenseType:
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
  vendorName: string;
  responsibilityType: "company" | "building";
  amountDue: string;
  dueDay: string;
  periodMonth: string;
  periodYear: string;
  status: "pending" | "paid" | "overdue";
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

function getDefaultMonth() {
  return String(new Date().getMonth() + 1);
}

function getDefaultYear() {
  return String(new Date().getFullYear());
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

function getDueDateFromPeriod(periodYear: number, periodMonth: number, dueDay: number) {
  const lastDayOfMonth = new Date(periodYear, periodMonth, 0).getDate();
  const safeDay = Math.min(dueDay, lastDayOfMonth);
  const month = String(periodMonth).padStart(2, "0");
  const day = String(safeDay).padStart(2, "0");
  return `${periodYear}-${month}-${day}`;
}

export default function PaymentsPage() {
  const { user, loading } = useCurrentUser();

  const [loadingPage, setLoadingPage] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusFilter>("all");

  const [form, setForm] = useState<CreatePaymentForm>({
    buildingId: "",
    appliesTo: "building",
    unitId: "",
    expenseType: "electricity",
    title: "",
    vendorName: "",
    responsibilityType: "company",
    amountDue: "",
    dueDay: "",
    periodMonth: getDefaultMonth(),
    periodYear: getDefaultYear(),
    status: "pending",
    paymentReference: "",
    notes: "",
  });

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

    const nextBuildings = (buildingsRes.data as Building[]) || [];
    setBuildings(nextBuildings);
    setUnits((unitsRes.data as Unit[]) || []);
    setExpenseSchedules((schedulesRes.data as ExpenseSchedule[]) || []);
    setExpensePayments((paymentsRes.data as ExpensePayment[]) || []);

    setForm((prev) => ({
      ...prev,
      buildingId: prev.buildingId || nextBuildings[0]?.id || "",
    }));

    setLoadingPage(false);
  }

  const unitsForSelectedBuilding = useMemo(() => {
    if (!form.buildingId) return [];
    return units.filter((unit) => unit.building_id === form.buildingId);
  }, [units, form.buildingId]);

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

  function updateForm<K extends keyof CreatePaymentForm>(key: K, value: CreatePaymentForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleCreatePayment() {
    if (!user?.company_id) return;

    setMessage("");
    setSuccessMessage("");

    if (!form.buildingId) {
      setMessage("Selecciona un edificio.");
      return;
    }

    if (form.appliesTo === "unit" && !form.unitId) {
      setMessage("Selecciona una unidad cuando el pago aplique a una unidad.");
      return;
    }

    if (!form.title.trim()) {
      setMessage("Escribe un título para el pago.");
      return;
    }

    if (!form.amountDue || Number(form.amountDue) <= 0) {
      setMessage("Escribe un monto válido.");
      return;
    }

    if (!form.dueDay || Number(form.dueDay) < 1 || Number(form.dueDay) > 31) {
      setMessage("Escribe un día de vencimiento válido entre 1 y 31.");
      return;
    }

    if (!form.periodMonth || Number(form.periodMonth) < 1 || Number(form.periodMonth) > 12) {
      setMessage("Selecciona un mes válido.");
      return;
    }

    if (!form.periodYear || Number(form.periodYear) < 2000) {
      setMessage("Selecciona un año válido.");
      return;
    }

    const amountDue = Number(form.amountDue);
    const dueDay = Number(form.dueDay);
    const periodMonth = Number(form.periodMonth);
    const periodYear = Number(form.periodYear);
    const dueDate = getDueDateFromPeriod(periodYear, periodMonth, dueDay);
    const paidAtValue = form.status === "paid" ? new Date().toISOString() : null;

    setSavingPayment(true);

    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("expense_schedules")
        .insert({
          company_id: user.company_id,
          building_id: form.buildingId,
          unit_id: form.appliesTo === "unit" ? form.unitId : null,
          expense_type: form.expenseType,
          title: form.title.trim(),
          vendor_name: form.vendorName.trim() || null,
          responsibility_type: form.responsibilityType,
          applies_to: form.appliesTo,
          amount_estimated: amountDue,
          due_day: dueDay,
          active: true,
          notes: form.notes.trim() || null,
        })
        .select("id")
        .single();

      if (scheduleError || !scheduleData) {
        throw new Error(scheduleError?.message || "No se pudo crear la configuración del pago.");
      }

      const { error: paymentError } = await supabase
        .from("expense_payments")
        .insert({
          expense_schedule_id: scheduleData.id,
          company_id: user.company_id,
          building_id: form.buildingId,
          unit_id: form.appliesTo === "unit" ? form.unitId : null,
          period_year: periodYear,
          period_month: periodMonth,
          due_date: dueDate,
          amount_due: amountDue,
          status: form.status,
          paid_at: paidAtValue,
          payment_reference: form.paymentReference.trim() || null,
          notes: form.notes.trim() || null,
        });

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo crear el registro del pago.");
      }

      setSuccessMessage("Pago administrativo creado correctamente.");
      setForm((prev) => ({
        ...prev,
        appliesTo: "building",
        unitId: "",
        expenseType: "electricity",
        title: "",
        vendorName: "",
        responsibilityType: "company",
        amountDue: "",
        dueDay: "",
        periodMonth: getDefaultMonth(),
        periodYear: getDefaultYear(),
        status: "pending",
        paymentReference: "",
        notes: "",
      }));

      await loadPaymentsData();
    } catch (error) {
      console.error("Error creando pago administrativo:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error creando el pago administrativo."
      );
    } finally {
      setSavingPayment(false);
    }
  }

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

      {successMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#ECFDF5",
            color: "#166534",
            fontSize: 14,
            fontWeight: 600,
            border: "1px solid #A7F3D0",
          }}
        >
          {successMessage}
        </div>
      ) : null}

      <SectionCard
        title="Nuevo pago administrativo"
        subtitle="Crea un pago real para que aparezca en este módulo y también en el calendario global."
        icon={<Plus size={18} />}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <AppCard>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Edificio
                </span>
                <AppSelect
                  value={form.buildingId}
                  onChange={(event) => {
                    const nextBuildingId = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      buildingId: nextBuildingId,
                      unitId: "",
                    }));
                  }}
                >
                  <option value="">Selecciona un edificio</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </AppSelect>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Aplica a
                </span>
                <AppSelect
                  value={form.appliesTo}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      appliesTo: event.target.value as "building" | "unit",
                      unitId: event.target.value === "building" ? "" : prev.unitId,
                    }))
                  }
                >
                  <option value="building">Edificio</option>
                  <option value="unit">Unidad</option>
                </AppSelect>
              </label>

              {form.appliesTo === "unit" ? (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                    Unidad
                  </span>
                  <AppSelect
                    value={form.unitId}
                    onChange={(event) => updateForm("unitId", event.target.value)}
                  >
                    <option value="">Selecciona una unidad</option>
                    {unitsForSelectedBuilding.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.display_code || unit.unit_number || "Unidad"}
                      </option>
                    ))}
                  </AppSelect>
                </label>
              ) : null}

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Tipo de gasto
                </span>
                <AppSelect
                  value={form.expenseType}
                  onChange={(event) =>
                    updateForm(
                      "expenseType",
                      event.target.value as CreatePaymentForm["expenseType"]
                    )
                  }
                >
                  <option value="electricity">Electricidad</option>
                  <option value="water">Agua</option>
                  <option value="gas">Gas</option>
                  <option value="internet">Internet</option>
                  <option value="phone">Telefonía</option>
                  <option value="maintenance_service">Servicio de mantenimiento</option>
                  <option value="security">Seguridad</option>
                  <option value="cleaning_service">Servicio de limpieza</option>
                  <option value="other">Otro</option>
                </AppSelect>
              </label>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Título
                </span>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Ej. Luz CFE Torre Norte"
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    paddingInline: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Proveedor
                </span>
                <input
                  value={form.vendorName}
                  onChange={(event) => updateForm("vendorName", event.target.value)}
                  placeholder="Ej. CFE, Telmex, Agua y Drenaje"
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    paddingInline: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Quién paga
                </span>
                <AppSelect
                  value={form.responsibilityType}
                  onChange={(event) =>
                    updateForm(
                      "responsibilityType",
                      event.target.value as "company" | "building"
                    )
                  }
                >
                  <option value="company">Empresa</option>
                  <option value="building">Edificio</option>
                </AppSelect>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Monto
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountDue}
                  onChange={(event) => updateForm("amountDue", event.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    paddingInline: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </label>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Día de vencimiento
                </span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(event) => updateForm("dueDay", event.target.value)}
                  placeholder="Ej. 10"
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    paddingInline: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Mes del periodo
                </span>
                <AppSelect
                  value={form.periodMonth}
                  onChange={(event) => updateForm("periodMonth", event.target.value)}
                >
                  {MONTH_LABELS_SHORT.map((month, index) => (
                    <option key={month} value={String(index + 1)}>
                      {month}
                    </option>
                  ))}
                </AppSelect>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Año del periodo
                </span>
                <input
                  type="number"
                  min="2000"
                  value={form.periodYear}
                  onChange={(event) => updateForm("periodYear", event.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    paddingInline: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Estado inicial
                </span>
                <AppSelect
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value as "pending" | "paid" | "overdue"
                    )
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="overdue">Vencido</option>
                </AppSelect>
              </label>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Referencia de pago
                </span>
                <input
                  value={form.paymentReference}
                  onChange={(event) => updateForm("paymentReference", event.target.value)}
                  placeholder="Opcional"
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    paddingInline: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Notas
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Notas administrativas"
                  rows={5}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: "#FFFFFF",
                    padding: 12,
                    fontSize: 14,
                    color: "#111827",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ paddingTop: 8 }}>
                <UiButton
                  onClick={handleCreatePayment}
                  icon={savingPayment ? <Save size={16} /> : <Plus size={16} />}
                >
                  {savingPayment ? "Guardando..." : "Crear pago administrativo"}
                </UiButton>
              </div>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

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
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#DCFCE7",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
          }
        />

        <MetricCard
          label="Pendientes"
          value={String(pendingCount)}
          helper={nextPendingLabel}
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF9C3",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Clock3 size={18} color="#EAB308" />
            </div>
          }
        />

        <MetricCard
          label="Vencidos"
          value={String(overdueCount)}
          helper="Requieren atención"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEE2E2",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AlertCircle size={18} color="#DC2626" />
            </div>
          }
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