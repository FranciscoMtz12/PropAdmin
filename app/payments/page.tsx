"use client";

/*
  Módulo de Pagos administrativos.

  Esta versión soporta:
  - creación de plantillas recurrentes
  - frecuencia mensual / bimestral
  - generación automática del pago pendiente del periodo actual
  - edición de pagos ya creados
  - captura posterior de datos reales del recibo

  Ajustes UX aplicados en esta versión:
  - "Nuevo pago recurrente" inicia cerrado/compacto
  - esa sección ahora aparece debajo de métricas y filtros
  - la edición sigue siendo visible cuando se selecciona un pago
*/

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Edit3,
  Filter,
  Plus,
  ReceiptText,
  RotateCw,
  Save,
  X,
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

type ExpenseFrequencyType = "monthly" | "bimonthly";
type ExpenseResponsibilityType = "company" | "building" | "tenant";
type ExpenseAppliesToType = "building" | "unit";
type ExpensePaymentStatus = "pending" | "paid" | "overdue";

type ExpenseSchedule = {
  id: string;
  company_id?: string;
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
  responsibility_type: ExpenseResponsibilityType;
  applies_to: ExpenseAppliesToType;
  amount_estimated: number | null;
  due_day: number;
  active: boolean;
  notes: string | null;
  frequency_type: ExpenseFrequencyType | null;
  starts_on: string | null;
  ends_on: string | null;
  auto_generate: boolean | null;
  expected_issue_day: number | null;
  expected_cutoff_day: number | null;
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
  status: ExpensePaymentStatus;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  invoice_received_at: string | null;
  cutoff_date: string | null;
  billing_period_label: string | null;
  is_generated_placeholder: boolean | null;
  amount_estimated_snapshot: number | null;
};

type PaymentStatusFilter = "all" | "pending" | "paid" | "overdue";

type PaymentRow = {
  id: string;
  scheduleId: string;
  buildingId: string;
  buildingName: string;
  unitLabel: string;
  title: string;
  vendorName: string;
  expenseTypeLabel: string;
  responsibilityLabel: string;
  appliesToLabel: string;
  frequencyLabel: string;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  status: ExpensePaymentStatus;
  statusLabel: string;
  paymentReference: string;
  notes: string;
  isGeneratedPlaceholder: boolean;
  invoiceReceivedAt: string | null;
  cutoffDate: string | null;
};

type CreatePaymentForm = {
  buildingId: string;
  appliesTo: ExpenseAppliesToType;
  unitId: string;
  expenseType: ExpenseSchedule["expense_type"];
  title: string;
  vendorName: string;
  responsibilityType: "company" | "building";
  frequencyType: ExpenseFrequencyType;
  startsOn: string;
  endsOn: string;
  autoGenerate: boolean;
  expectedIssueDay: string;
  expectedCutoffDay: string;
  amountEstimated: string;
  dueDay: string;
  periodMonth: string;
  periodYear: string;
  amountDue: string;
  dueDate: string;
  invoiceReceivedAt: string;
  cutoffDate: string;
  status: ExpensePaymentStatus;
  paymentReference: string;
  notes: string;
};

type EditPaymentForm = {
  paymentId: string;
  scheduleId: string;
  buildingId: string;
  appliesTo: ExpenseAppliesToType;
  unitId: string;
  title: string;
  vendorName: string;
  expenseType: ExpenseSchedule["expense_type"];
  responsibilityType: "company" | "building";
  frequencyType: ExpenseFrequencyType;
  startsOn: string;
  endsOn: string;
  autoGenerate: boolean;
  expectedIssueDay: string;
  expectedCutoffDay: string;
  amountEstimated: string;
  dueDay: string;
  periodMonth: string;
  periodYear: string;
  amountDue: string;
  dueDate: string;
  invoiceReceivedAt: string;
  cutoffDate: string;
  status: ExpensePaymentStatus;
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

function getResponsibilityLabel(type: ExpenseResponsibilityType) {
  if (type === "company") return "Empresa";
  if (type === "building") return "Edificio";
  return "Inquilino";
}

function getAppliesToLabel(type: ExpenseAppliesToType) {
  return type === "unit" ? "Unidad" : "Edificio";
}

function getFrequencyLabel(type: ExpenseFrequencyType | null) {
  if (type === "bimonthly") return "Bimestral";
  return "Mensual";
}

function getStatusLabel(status: ExpensePaymentStatus) {
  if (status === "pending") return "Pendiente";
  if (status === "paid") return "Pagado";
  return "Vencido";
}

function getStatusColors(status: ExpensePaymentStatus) {
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

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isScheduleActiveForCurrentPeriod(
  schedule: ExpenseSchedule,
  currentYear: number,
  currentMonth: number
) {
  const startsOn = schedule.starts_on ? parseDateOnly(schedule.starts_on) : null;
  const endsOn = schedule.ends_on ? parseDateOnly(schedule.ends_on) : null;
  const currentDate = new Date(currentYear, currentMonth - 1, 1);

  if (startsOn && currentDate < new Date(startsOn.getFullYear(), startsOn.getMonth(), 1)) {
    return false;
  }

  if (endsOn && currentDate > new Date(endsOn.getFullYear(), endsOn.getMonth(), 1)) {
    return false;
  }

  const frequency = schedule.frequency_type || "monthly";
  if (frequency === "monthly") return true;

  if (!startsOn) return true;

  const startIndex = startsOn.getFullYear() * 12 + startsOn.getMonth();
  const currentIndex = currentYear * 12 + (currentMonth - 1);
  return (currentIndex - startIndex) % 2 === 0;
}

function getInitialCreateForm(buildingId = ""): CreatePaymentForm {
  return {
    buildingId,
    appliesTo: "building",
    unitId: "",
    expenseType: "electricity",
    title: "",
    vendorName: "",
    responsibilityType: "company",
    frequencyType: "monthly",
    startsOn: getTodayDateOnlyKey(),
    endsOn: "",
    autoGenerate: true,
    expectedIssueDay: "",
    expectedCutoffDay: "",
    amountEstimated: "",
    dueDay: "",
    periodMonth: getDefaultMonth(),
    periodYear: getDefaultYear(),
    amountDue: "",
    dueDate: "",
    invoiceReceivedAt: "",
    cutoffDate: "",
    status: "pending",
    paymentReference: "",
    notes: "",
  };
}

export default function PaymentsPage() {
  const { user, loading } = useCurrentUser();

  const [loadingPage, setLoadingPage] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [syncingCurrentPeriod, setSyncingCurrentPeriod] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusFilter>("all");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreatePaymentForm>(getInitialCreateForm());
  const [editingPayment, setEditingPayment] = useState<EditPaymentForm | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    loadPaymentsData();
  }, [loading, user?.company_id]);

  async function loadPaymentsData(showLoader = true) {
    if (!user?.company_id) return;

    if (showLoader) setLoadingPage(true);
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
        .select(`
          id,
          company_id,
          building_id,
          unit_id,
          expense_type,
          title,
          vendor_name,
          responsibility_type,
          applies_to,
          amount_estimated,
          due_day,
          active,
          notes,
          frequency_type,
          starts_on,
          ends_on,
          auto_generate,
          expected_issue_day,
          expected_cutoff_day
        `)
        .eq("company_id", user.company_id)
        .eq("active", true)
        .in("responsibility_type", ["company", "building"]),

      supabase
        .from("expense_payments")
        .select(`
          id,
          expense_schedule_id,
          company_id,
          building_id,
          unit_id,
          period_year,
          period_month,
          due_date,
          amount_due,
          status,
          paid_at,
          payment_reference,
          notes,
          created_at,
          invoice_received_at,
          cutoff_date,
          billing_period_label,
          is_generated_placeholder,
          amount_estimated_snapshot
        `)
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true }),
    ]);

    if (buildingsRes.error) {
      setMessage("No se pudieron cargar los edificios.");
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMessage("No se pudieron cargar las unidades.");
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      setMessage("No se pudieron cargar las configuraciones de pagos.");
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (paymentsRes.error) {
      setMessage("No se pudieron cargar los registros de pagos.");
      if (showLoader) setLoadingPage(false);
      return;
    }

    const nextBuildings = (buildingsRes.data as Building[]) || [];
    const nextUnits = (unitsRes.data as Unit[]) || [];
    const nextSchedules = (schedulesRes.data as ExpenseSchedule[]) || [];
    const nextPayments = (paymentsRes.data as ExpensePayment[]) || [];

    setBuildings(nextBuildings);
    setUnits(nextUnits);
    setExpenseSchedules(nextSchedules);
    setExpensePayments(nextPayments);

    setForm((prev) => ({
      ...prev,
      buildingId: prev.buildingId || nextBuildings[0]?.id || "",
    }));

    if (showLoader) setLoadingPage(false);

    await ensureCurrentPeriodPayments(nextSchedules, nextPayments);
  }

  async function ensureCurrentPeriodPayments(
    schedulesInput?: ExpenseSchedule[],
    paymentsInput?: ExpensePayment[]
  ) {
    if (!user?.company_id) return;

    const schedules = schedulesInput ?? expenseSchedules;
    const payments = paymentsInput ?? expensePayments;

    const currentYear = Number(getDefaultYear());
    const currentMonth = Number(getDefaultMonth());

    const existingBySchedule = new Set(
      payments
        .filter(
          (payment) =>
            payment.period_year === currentYear && payment.period_month === currentMonth
        )
        .map((payment) => payment.expense_schedule_id)
    );

    const schedulesToGenerate = schedules.filter((schedule) => {
      if (!schedule.active) return false;
      if (schedule.responsibility_type === "tenant") return false;
      if (schedule.auto_generate === false) return false;
      if (!isScheduleActiveForCurrentPeriod(schedule, currentYear, currentMonth)) return false;
      if (existingBySchedule.has(schedule.id)) return false;
      return true;
    });

    if (schedulesToGenerate.length === 0) return;

    setSyncingCurrentPeriod(true);

    try {
      const rowsToInsert = schedulesToGenerate.map((schedule) => {
        const amountValue = schedule.amount_estimated ?? 0;
        const dueDate = getDueDateFromPeriod(
          currentYear,
          currentMonth,
          schedule.due_day
        );

        return {
          expense_schedule_id: schedule.id,
          company_id: user.company_id,
          building_id: schedule.building_id,
          unit_id: schedule.applies_to === "unit" ? schedule.unit_id : null,
          period_year: currentYear,
          period_month: currentMonth,
          due_date: dueDate,
          amount_due: amountValue,
          status: "pending" as ExpensePaymentStatus,
          paid_at: null,
          payment_reference: null,
          notes: schedule.notes || null,
          billing_period_label: formatPeriod(currentYear, currentMonth),
          is_generated_placeholder: true,
          amount_estimated_snapshot: schedule.amount_estimated ?? null,
          invoice_received_at: null,
          cutoff_date: null,
        };
      });

      const { error } = await supabase.from("expense_payments").insert(rowsToInsert);

      if (error) {
        console.error("Error generando pagos del periodo actual:", error);
        setMessage("No se pudieron generar automáticamente algunos pagos del periodo actual.");
        return;
      }

      const { data: refreshedPayments, error: refreshError } = await supabase
        .from("expense_payments")
        .select(`
          id,
          expense_schedule_id,
          company_id,
          building_id,
          unit_id,
          period_year,
          period_month,
          due_date,
          amount_due,
          status,
          paid_at,
          payment_reference,
          notes,
          created_at,
          invoice_received_at,
          cutoff_date,
          billing_period_label,
          is_generated_placeholder,
          amount_estimated_snapshot
        `)
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true });

      if (!refreshError) {
        setExpensePayments((refreshedPayments as ExpensePayment[]) || []);
      }
    } finally {
      setSyncingCurrentPeriod(false);
    }
  }

  const unitsForSelectedBuilding = useMemo(() => {
    if (!form.buildingId) return [];
    return units.filter((unit) => unit.building_id === form.buildingId);
  }, [units, form.buildingId]);

  const unitsForEditingBuilding = useMemo(() => {
    if (!editingPayment?.buildingId) return [];
    return units.filter((unit) => unit.building_id === editingPayment.buildingId);
  }, [units, editingPayment]);

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
          scheduleId: schedule.id,
          buildingId: payment.building_id,
          buildingName: building?.name || "Edificio",
          unitLabel:
            schedule.applies_to === "unit" ? `Unidad ${unitLabel}` : "Todo el edificio",
          title: schedule.title,
          vendorName: schedule.vendor_name || "Sin proveedor",
          expenseTypeLabel: getExpenseTypeLabel(schedule.expense_type),
          responsibilityLabel: getResponsibilityLabel(schedule.responsibility_type),
          appliesToLabel: getAppliesToLabel(schedule.applies_to),
          frequencyLabel: getFrequencyLabel(schedule.frequency_type || "monthly"),
          periodLabel: formatPeriod(payment.period_year, payment.period_month),
          dueDate: payment.due_date,
          dueDateLabel: formatDate(payment.due_date),
          amountDue: payment.amount_due,
          amountDueLabel: formatCurrency(payment.amount_due),
          status: payment.status,
          statusLabel: getStatusLabel(payment.status),
          paymentReference: payment.payment_reference || "—",
          notes: payment.notes || schedule.notes || "—",
          isGeneratedPlaceholder: Boolean(payment.is_generated_placeholder),
          invoiceReceivedAt: payment.invoice_received_at,
          cutoffDate: payment.cutoff_date,
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

  function updateEditingForm<K extends keyof EditPaymentForm>(key: K, value: EditPaymentForm[K]) {
    setEditingPayment((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value,
      };
    });
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

    const amountEstimated = parseOptionalNumber(form.amountEstimated);
    const amountDue = parseOptionalNumber(form.amountDue) ?? amountEstimated ?? 0;
    const dueDay = Number(form.dueDay);
    const periodMonth = Number(form.periodMonth);
    const periodYear = Number(form.periodYear);

    const dueDate =
      form.dueDate.trim() ||
      getDueDateFromPeriod(periodYear, periodMonth, dueDay);

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
          amount_estimated: amountEstimated,
          due_day: dueDay,
          active: true,
          notes: form.notes.trim() || null,
          frequency_type: form.frequencyType,
          starts_on: form.startsOn || null,
          ends_on: form.endsOn || null,
          auto_generate: form.autoGenerate,
          expected_issue_day: parseOptionalNumber(form.expectedIssueDay),
          expected_cutoff_day: parseOptionalNumber(form.expectedCutoffDay),
        })
        .select("id")
        .single();

      if (scheduleError || !scheduleData) {
        throw new Error(scheduleError?.message || "No se pudo crear la configuración del pago.");
      }

      const { error: paymentError } = await supabase.from("expense_payments").insert({
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
        billing_period_label: formatPeriod(periodYear, periodMonth),
        is_generated_placeholder: !form.amountDue.trim(),
        amount_estimated_snapshot: amountEstimated,
        invoice_received_at: form.invoiceReceivedAt || null,
        cutoff_date: form.cutoffDate || null,
      });

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo crear el registro del pago.");
      }

      setSuccessMessage("Pago administrativo creado correctamente.");
      setForm(getInitialCreateForm(form.buildingId));
      setShowCreateForm(false);

      await loadPaymentsData(false);
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

  function startEditingPayment(row: PaymentRow) {
    const payment = expensePayments.find((item) => item.id === row.id);
    const schedule = expenseSchedules.find((item) => item.id === row.scheduleId);

    if (!payment || !schedule) {
      setMessage("No se pudo abrir la edición del pago seleccionado.");
      return;
    }

    setEditingPayment({
      paymentId: payment.id,
      scheduleId: schedule.id,
      buildingId: schedule.building_id,
      appliesTo: schedule.applies_to,
      unitId: schedule.unit_id || "",
      title: schedule.title,
      vendorName: schedule.vendor_name || "",
      expenseType: schedule.expense_type,
      responsibilityType:
        schedule.responsibility_type === "tenant" ? "company" : schedule.responsibility_type,
      frequencyType: schedule.frequency_type || "monthly",
      startsOn: schedule.starts_on || "",
      endsOn: schedule.ends_on || "",
      autoGenerate: schedule.auto_generate !== false,
      expectedIssueDay:
        schedule.expected_issue_day !== null && schedule.expected_issue_day !== undefined
          ? String(schedule.expected_issue_day)
          : "",
      expectedCutoffDay:
        schedule.expected_cutoff_day !== null && schedule.expected_cutoff_day !== undefined
          ? String(schedule.expected_cutoff_day)
          : "",
      amountEstimated:
        schedule.amount_estimated !== null && schedule.amount_estimated !== undefined
          ? String(schedule.amount_estimated)
          : "",
      dueDay: String(schedule.due_day),
      periodMonth: String(payment.period_month),
      periodYear: String(payment.period_year),
      amountDue: String(payment.amount_due),
      dueDate: payment.due_date,
      invoiceReceivedAt: payment.invoice_received_at || "",
      cutoffDate: payment.cutoff_date || "",
      status: payment.status,
      paymentReference: payment.payment_reference || "",
      notes: payment.notes || schedule.notes || "",
    });

    setSuccessMessage("");
    setMessage("");
  }

  async function handleSaveEditedPayment() {
    if (!user?.company_id || !editingPayment) return;

    setMessage("");
    setSuccessMessage("");
    setSavingPayment(true);

    try {
      if (!editingPayment.buildingId) {
        throw new Error("Selecciona un edificio.");
      }

      if (editingPayment.appliesTo === "unit" && !editingPayment.unitId) {
        throw new Error("Selecciona una unidad.");
      }

      if (!editingPayment.title.trim()) {
        throw new Error("Escribe un título para el pago.");
      }

      if (!editingPayment.dueDay || Number(editingPayment.dueDay) < 1 || Number(editingPayment.dueDay) > 31) {
        throw new Error("Escribe un día de vencimiento válido.");
      }

      const periodMonth = Number(editingPayment.periodMonth);
      const periodYear = Number(editingPayment.periodYear);
      const dueDay = Number(editingPayment.dueDay);

      if (!periodMonth || periodMonth < 1 || periodMonth > 12) {
        throw new Error("Selecciona un mes válido.");
      }

      if (!periodYear || periodYear < 2000) {
        throw new Error("Selecciona un año válido.");
      }

      const amountEstimated = parseOptionalNumber(editingPayment.amountEstimated);
      const amountDue = parseOptionalNumber(editingPayment.amountDue) ?? 0;
      const dueDate =
        editingPayment.dueDate.trim() ||
        getDueDateFromPeriod(periodYear, periodMonth, dueDay);

      const paidAtValue =
        editingPayment.status === "paid" ? new Date().toISOString() : null;

      const { error: scheduleError } = await supabase
        .from("expense_schedules")
        .update({
          building_id: editingPayment.buildingId,
          unit_id: editingPayment.appliesTo === "unit" ? editingPayment.unitId : null,
          expense_type: editingPayment.expenseType,
          title: editingPayment.title.trim(),
          vendor_name: editingPayment.vendorName.trim() || null,
          responsibility_type: editingPayment.responsibilityType,
          applies_to: editingPayment.appliesTo,
          amount_estimated: amountEstimated,
          due_day: dueDay,
          notes: editingPayment.notes.trim() || null,
          frequency_type: editingPayment.frequencyType,
          starts_on: editingPayment.startsOn || null,
          ends_on: editingPayment.endsOn || null,
          auto_generate: editingPayment.autoGenerate,
          expected_issue_day: parseOptionalNumber(editingPayment.expectedIssueDay),
          expected_cutoff_day: parseOptionalNumber(editingPayment.expectedCutoffDay),
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPayment.scheduleId);

      if (scheduleError) {
        throw new Error(scheduleError.message || "No se pudo actualizar la configuración.");
      }

      const { error: paymentError } = await supabase
        .from("expense_payments")
        .update({
          building_id: editingPayment.buildingId,
          unit_id: editingPayment.appliesTo === "unit" ? editingPayment.unitId : null,
          period_year: periodYear,
          period_month: periodMonth,
          due_date: dueDate,
          amount_due: amountDue,
          status: editingPayment.status,
          paid_at: paidAtValue,
          payment_reference: editingPayment.paymentReference.trim() || null,
          notes: editingPayment.notes.trim() || null,
          invoice_received_at: editingPayment.invoiceReceivedAt || null,
          cutoff_date: editingPayment.cutoffDate || null,
          billing_period_label: formatPeriod(periodYear, periodMonth),
          is_generated_placeholder: amountDue === 0,
          amount_estimated_snapshot: amountEstimated,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPayment.paymentId);

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo actualizar el pago.");
      }

      setEditingPayment(null);
      setSuccessMessage("Pago actualizado correctamente.");
      await loadPaymentsData(false);
    } catch (error) {
      console.error("Error actualizando pago:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error actualizando el pago."
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
            <div style={statusIconBoxGreen}>
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
          }
        />

        <MetricCard
          label="Pendientes"
          value={String(pendingCount)}
          helper={nextPendingLabel}
          icon={
            <div style={statusIconBoxYellow}>
              <Clock3 size={18} color="#EAB308" />
            </div>
          }
        />

        <MetricCard
          label="Vencidos"
          value={String(overdueCount)}
          helper="Requieren atención"
          icon={
            <div style={statusIconBoxRed}>
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
              <div style={filterLabelStyle}>
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
              <div style={filterLabelStyle}>
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

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={filterLabelStyle}>
                <CalendarClock size={14} />
                Plantillas activas
              </div>

              <div
                style={{
                  minHeight: 42,
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "#F9FAFB",
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "#374151",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {expenseSchedules.length} configuraciones activas
              </div>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Nuevo pago recurrente"
        subtitle="Empieza compacto para no ocupar espacio, y se expande cuando lo necesitas."
        icon={<Plus size={18} />}
      >
        {!showCreateForm ? (
          <AppCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#111827",
                  }}
                >
                  Crear nuevo pago recurrente
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    lineHeight: 1.45,
                  }}
                >
                  Da de alta luz, agua, internet, Telmex u otros servicios para que
                  se generen como pendientes del periodo.
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <UiButton
                  onClick={() => setShowCreateForm(true)}
                  icon={<ChevronDown size={16} />}
                >
                  Abrir formulario
                </UiButton>

                <UiButton
                  onClick={() => ensureCurrentPeriodPayments()}
                  icon={<RotateCw size={16} />}
                >
                  {syncingCurrentPeriod ? "Generando..." : "Generar periodo actual"}
                </UiButton>
              </div>
            </div>
          </AppCard>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                Completa la plantilla recurrente y el periodo actual
              </span>

              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={ghostButtonStyle}
              >
                <ChevronUp size={16} />
                Cerrar
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Edificio</span>
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
                    <span style={fieldLabelStyle}>Aplica a</span>
                    <AppSelect
                      value={form.appliesTo}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          appliesTo: event.target.value as ExpenseAppliesToType,
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
                      <span style={fieldLabelStyle}>Unidad</span>
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
                    <span style={fieldLabelStyle}>Tipo de gasto</span>
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

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Título</span>
                    <input
                      value={form.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                      placeholder="Ej. Luz CFE Torre Norte"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Proveedor</span>
                    <input
                      value={form.vendorName}
                      onChange={(event) => updateForm("vendorName", event.target.value)}
                      placeholder="Ej. CFE, Telmex"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Quién paga</span>
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
                    <span style={fieldLabelStyle}>Frecuencia</span>
                    <AppSelect
                      value={form.frequencyType}
                      onChange={(event) =>
                        updateForm(
                          "frequencyType",
                          event.target.value as ExpenseFrequencyType
                        )
                      }
                    >
                      <option value="monthly">Mensual</option>
                      <option value="bimonthly">Bimestral</option>
                    </AppSelect>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha de inicio de recurrencia</span>
                    <input
                      type="date"
                      value={form.startsOn}
                      onChange={(event) => updateForm("startsOn", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha fin de recurrencia</span>
                    <input
                      type="date"
                      value={form.endsOn}
                      onChange={(event) => updateForm("endsOn", event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Día esperado de recibido</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.expectedIssueDay}
                      onChange={(event) => updateForm("expectedIssueDay", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Día esperado de corte</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.expectedCutoffDay}
                      onChange={(event) => updateForm("expectedCutoffDay", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={form.autoGenerate}
                      onChange={(event) => updateForm("autoGenerate", event.target.checked)}
                    />
                    <span style={fieldLabelStyle}>
                      Generar automáticamente el periodo actual si falta
                    </span>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Monto estimado</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amountEstimated}
                      onChange={(event) => updateForm("amountEstimated", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Día límite de pago</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.dueDay}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        updateForm("dueDay", nextValue);

                        const parsed = Number(nextValue);
                        if (parsed >= 1 && parsed <= 31) {
                          updateForm(
                            "dueDate",
                            getDueDateFromPeriod(
                              Number(form.periodYear),
                              Number(form.periodMonth),
                              parsed
                            )
                          );
                        }
                      }}
                      placeholder="Ej. 10"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Mes del periodo</span>
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
                    <span style={fieldLabelStyle}>Año del periodo</span>
                    <input
                      type="number"
                      min="2000"
                      value={form.periodYear}
                      onChange={(event) => updateForm("periodYear", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha límite real de pago</span>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(event) => updateForm("dueDate", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Monto real del periodo</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amountDue}
                      onChange={(event) => updateForm("amountDue", event.target.value)}
                      placeholder="Opcional, puede quedar en 0"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Estado inicial</span>
                    <AppSelect
                      value={form.status}
                      onChange={(event) =>
                        updateForm("status", event.target.value as ExpensePaymentStatus)
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
                    <span style={fieldLabelStyle}>Fecha de recibido del recibo</span>
                    <input
                      type="date"
                      value={form.invoiceReceivedAt}
                      onChange={(event) => updateForm("invoiceReceivedAt", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha de corte</span>
                    <input
                      type="date"
                      value={form.cutoffDate}
                      onChange={(event) => updateForm("cutoffDate", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Referencia de pago</span>
                    <input
                      value={form.paymentReference}
                      onChange={(event) => updateForm("paymentReference", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Notas</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => updateForm("notes", event.target.value)}
                      placeholder="Notas administrativas"
                      rows={4}
                      style={textareaStyle}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <UiButton
                      onClick={handleCreatePayment}
                      icon={savingPayment ? <Save size={16} /> : <Plus size={16} />}
                    >
                      {savingPayment ? "Guardando..." : "Crear pago"}
                    </UiButton>

                    <UiButton
                      onClick={() => ensureCurrentPeriodPayments()}
                      icon={<RotateCw size={16} />}
                    >
                      {syncingCurrentPeriod ? "Generando..." : "Generar periodo actual"}
                    </UiButton>
                  </div>
                </div>
              </AppCard>
            </div>
          </div>
        )}
      </SectionCard>

      {editingPayment ? (
        <>
          <div style={{ height: 16 }} />

          <SectionCard
            title="Editar pago seleccionado"
            subtitle="Aquí puedes actualizar el registro mensual real y también la configuración recurrente."
            icon={<Edit3 size={18} />}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Edificio</span>
                    <AppSelect
                      value={editingPayment.buildingId}
                      onChange={(event) => {
                        const nextBuildingId = event.target.value;
                        setEditingPayment((prev) =>
                          prev
                            ? {
                                ...prev,
                                buildingId: nextBuildingId,
                                unitId: "",
                              }
                            : prev
                        );
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
                    <span style={fieldLabelStyle}>Aplica a</span>
                    <AppSelect
                      value={editingPayment.appliesTo}
                      onChange={(event) =>
                        updateEditingForm(
                          "appliesTo",
                          event.target.value as ExpenseAppliesToType
                        )
                      }
                    >
                      <option value="building">Edificio</option>
                      <option value="unit">Unidad</option>
                    </AppSelect>
                  </label>

                  {editingPayment.appliesTo === "unit" ? (
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={fieldLabelStyle}>Unidad</span>
                      <AppSelect
                        value={editingPayment.unitId}
                        onChange={(event) => updateEditingForm("unitId", event.target.value)}
                      >
                        <option value="">Selecciona una unidad</option>
                        {unitsForEditingBuilding.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.display_code || unit.unit_number || "Unidad"}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                  ) : null}

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Título</span>
                    <input
                      value={editingPayment.title}
                      onChange={(event) => updateEditingForm("title", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Proveedor</span>
                    <input
                      value={editingPayment.vendorName}
                      onChange={(event) => updateEditingForm("vendorName", event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Tipo de gasto</span>
                    <AppSelect
                      value={editingPayment.expenseType}
                      onChange={(event) =>
                        updateEditingForm(
                          "expenseType",
                          event.target.value as ExpenseSchedule["expense_type"]
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

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Quién paga</span>
                    <AppSelect
                      value={editingPayment.responsibilityType}
                      onChange={(event) =>
                        updateEditingForm(
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
                    <span style={fieldLabelStyle}>Frecuencia</span>
                    <AppSelect
                      value={editingPayment.frequencyType}
                      onChange={(event) =>
                        updateEditingForm(
                          "frequencyType",
                          event.target.value as ExpenseFrequencyType
                        )
                      }
                    >
                      <option value="monthly">Mensual</option>
                      <option value="bimonthly">Bimestral</option>
                    </AppSelect>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={editingPayment.autoGenerate}
                      onChange={(event) =>
                        updateEditingForm("autoGenerate", event.target.checked)
                      }
                    />
                    <span style={fieldLabelStyle}>Autogenerar periodo actual</span>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Inicio recurrencia</span>
                    <input
                      type="date"
                      value={editingPayment.startsOn}
                      onChange={(event) => updateEditingForm("startsOn", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fin recurrencia</span>
                    <input
                      type="date"
                      value={editingPayment.endsOn}
                      onChange={(event) => updateEditingForm("endsOn", event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Día esperado de recibido</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editingPayment.expectedIssueDay}
                      onChange={(event) =>
                        updateEditingForm("expectedIssueDay", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Día esperado de corte</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editingPayment.expectedCutoffDay}
                      onChange={(event) =>
                        updateEditingForm("expectedCutoffDay", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Monto estimado</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingPayment.amountEstimated}
                      onChange={(event) =>
                        updateEditingForm("amountEstimated", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Día límite de pago</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editingPayment.dueDay}
                      onChange={(event) =>
                        updateEditingForm("dueDay", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Periodo</span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <AppSelect
                        value={editingPayment.periodMonth}
                        onChange={(event) =>
                          updateEditingForm("periodMonth", event.target.value)
                        }
                      >
                        {MONTH_LABELS_SHORT.map((month, index) => (
                          <option key={month} value={String(index + 1)}>
                            {month}
                          </option>
                        ))}
                      </AppSelect>

                      <input
                        type="number"
                        min="2000"
                        value={editingPayment.periodYear}
                        onChange={(event) =>
                          updateEditingForm("periodYear", event.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha límite real</span>
                    <input
                      type="date"
                      value={editingPayment.dueDate}
                      onChange={(event) => updateEditingForm("dueDate", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha de recibido</span>
                    <input
                      type="date"
                      value={editingPayment.invoiceReceivedAt}
                      onChange={(event) =>
                        updateEditingForm("invoiceReceivedAt", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha de corte</span>
                    <input
                      type="date"
                      value={editingPayment.cutoffDate}
                      onChange={(event) =>
                        updateEditingForm("cutoffDate", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Monto real</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingPayment.amountDue}
                      onChange={(event) =>
                        updateEditingForm("amountDue", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Estado</span>
                    <AppSelect
                      value={editingPayment.status}
                      onChange={(event) =>
                        updateEditingForm(
                          "status",
                          event.target.value as ExpensePaymentStatus
                        )
                      }
                    >
                      <option value="pending">Pendiente</option>
                      <option value="paid">Pagado</option>
                      <option value="overdue">Vencido</option>
                    </AppSelect>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Referencia</span>
                    <input
                      value={editingPayment.paymentReference}
                      onChange={(event) =>
                        updateEditingForm("paymentReference", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Notas</span>
                    <textarea
                      value={editingPayment.notes}
                      onChange={(event) => updateEditingForm("notes", event.target.value)}
                      rows={4}
                      style={textareaStyle}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <UiButton
                      onClick={handleSaveEditedPayment}
                      icon={<Save size={16} />}
                    >
                      {savingPayment ? "Guardando..." : "Guardar cambios"}
                    </UiButton>

                    <button
                      type="button"
                      onClick={() => setEditingPayment(null)}
                      style={ghostButtonStyle}
                    >
                      <X size={16} />
                      Cancelar edición
                    </button>
                  </div>
                </div>
              </AppCard>
            </div>
          </SectionCard>
        </>
      ) : null}

      <div style={{ height: 16 }} />

      <SectionCard
        title="Listado de pagos administrativos"
        subtitle="Puedes editar cualquier registro para completar el recibo real cuando llegue."
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
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                    {row.title}
                  </span>

                  <span style={{ fontSize: 12, color: "#6B7280" }}>
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                    {row.buildingName}
                  </span>

                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {row.unitLabel} · {row.appliesToLabel}
                  </span>
                </div>
              ),
            },
            {
              key: "period",
              header: "Periodo / frecuencia",
              render: (row: PaymentRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                    {row.periodLabel}
                  </span>

                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {row.frequencyLabel}
                  </span>
                </div>
              ),
            },
            {
              key: "dueDate",
              header: "Vencimiento",
              render: (row: PaymentRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>
                    {row.dueDateLabel}
                  </span>

                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {row.invoiceReceivedAt
                      ? `Recibido: ${formatDate(row.invoiceReceivedAt)}`
                      : "Sin recibido"}
                  </span>
                </div>
              ),
            },
            {
              key: "amount",
              header: "Monto",
              align: "right",
              render: (row: PaymentRow) => (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    alignItems: "flex-end",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                    {row.amountDueLabel}
                  </span>

                  {row.isGeneratedPlaceholder ? (
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      Placeholder
                    </span>
                  ) : null}
                </div>
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
                  <span style={{ fontSize: 12, color: "#374151" }}>
                    {row.paymentReference}
                  </span>

                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {row.notes}
                  </span>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Acciones",
              render: (row: PaymentRow) => (
                <button
                  type="button"
                  onClick={() => startEditingPayment(row)}
                  style={tableActionButtonStyle}
                >
                  <Edit3 size={14} />
                  Editar
                </button>
              ),
            },
          ]}
        />
      </SectionCard>
    </PageContainer>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  paddingInline: 12,
  fontSize: 14,
  color: "#111827",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: 12,
  fontSize: 14,
  color: "#111827",
  outline: "none",
  resize: "vertical",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
};

const filterLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const statusIconBoxGreen: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#DCFCE7",
  display: "grid",
  placeItems: "center",
};

const statusIconBoxYellow: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#FEF9C3",
  display: "grid",
  placeItems: "center",
};

const statusIconBoxRed: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#FEE2E2",
  display: "grid",
  placeItems: "center",
};

const ghostButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  color: "#111827",
  cursor: "pointer",
};

const tableActionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
  cursor: "pointer",
};