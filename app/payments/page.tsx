"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Droplet,
  Edit3,
  Filter,
  Flame,
  Globe,
  Package,
  Phone,
  Plus,
  ReceiptText,
  RotateCw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";

type Building = {
  id: string;
  name: string;
  address: string | null;
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
type ExpenseStoredStatus = "pending" | "paid" | "overdue";
type ExpenseDisplayStatus = "pending" | "paid" | "overdue" | "due_today";

type ExpenseType =
  | "electricity"
  | "water"
  | "gas"
  | "internet"
  | "phone"
  | "maintenance_service"
  | "security"
  | "cleaning_service"
  | "other";

type ExpenseSchedule = {
  id: string;
  company_id?: string;
  building_id: string;
  unit_id: string | null;
  expense_type: ExpenseType;
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
  service_identifier: string | null;
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
  status: ExpenseStoredStatus;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  invoice_received_at: string | null;
  cutoff_date: string | null;
  billing_period_label: string | null;
  is_generated_placeholder: boolean | null;
  amount_estimated_snapshot: number | null;
  billed_period_label: string | null;
  consumption_period_label: string | null;
  billed_month_label: string | null;
};

type PaymentStatusFilter = "all" | "pending" | "paid" | "overdue" | "due_today";

type PaymentRow = {
  id: string;
  scheduleId: string;
  buildingId: string;
  buildingName: string;
  buildingAddress: string;
  unitLabel: string;
  title: string;
  vendorName: string;
  expenseType: ExpenseType;
  frequencyLabel: string;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  storedStatus: ExpenseStoredStatus;
  displayStatus: ExpenseDisplayStatus;
  statusLabel: string;
  paymentReference: string;
  notes: string;
  isGeneratedPlaceholder: boolean;
  cutoffDate: string | null;
  serviceIdentifier: string;
  serviceIdentifierLabel: string;
  billedPeriodLabel: string;
  consumptionPeriodLabel: string;
  billedMonthLabel: string;
};

type CreatePaymentForm = {
  buildingId: string;
  appliesTo: ExpenseAppliesToType;
  unitId: string;
  expenseType: ExpenseType;
  title: string;
  vendorName: string;
  serviceIdentifier: string;
  responsibilityType: "company" | "building";
  frequencyType: ExpenseFrequencyType;
  autoGenerate: boolean;
  amountEstimated: string;
  dueDate: string;
  billedPeriodLabel: string;
  consumptionPeriodLabel: string;
  billedMonthLabel: string;
  amountDue: string;
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
  serviceIdentifier: string;
  expenseType: ExpenseType;
  responsibilityType: "company" | "building";
  frequencyType: ExpenseFrequencyType;
  autoGenerate: boolean;
  amountEstimated: string;
  dueDate: string;
  billedPeriodLabel: string;
  consumptionPeriodLabel: string;
  billedMonthLabel: string;
  amountDue: string;
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

function getFrequencyLabel(type: ExpenseFrequencyType | null) {
  return type === "bimonthly" ? "Bimestral" : "Mensual";
}

function getStoredStatusLabel(status: ExpenseStoredStatus) {
  if (status === "paid") return "Pagado";
  if (status === "overdue") return "Vencido";
  return "Pendiente";
}

function getDisplayStatusLabel(status: ExpenseDisplayStatus) {
  if (status === "paid") return "Pagado";
  if (status === "overdue") return "Vencido";
  if (status === "due_today") return "Vence hoy";
  return "Pendiente";
}

function getStatusColors(status: ExpenseDisplayStatus) {
  if (status === "paid") {
    return {
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
    };
  }

  if (status === "due_today") {
    return {
      background: "#FFF7ED",
      border: "#FDBA74",
      text: "#C2410C",
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

function getNextStoredStatusFromDisplayStatus(
  currentStatus: ExpenseDisplayStatus
): ExpenseStoredStatus {
  if (currentStatus === "paid") return "overdue";
  if (currentStatus === "overdue") return "pending";
  if (currentStatus === "due_today") return "paid";
  return "paid";
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getIdentifierLabel(expenseType: ExpenseType) {
  if (expenseType === "electricity") return "Número de servicio";
  if (expenseType === "water") return "Número de contrato";
  if (expenseType === "gas") return "Número de cuenta";
  if (expenseType === "phone" || expenseType === "internet") return "Número de teléfono";
  return "Identificador del servicio";
}

function getServiceVisual(type: ExpenseType) {
  if (type === "electricity") {
    return { icon: <Zap size={16} />, background: "#FEF3C7", color: "#CA8A04" };
  }

  if (type === "water") {
    return { icon: <Droplet size={16} />, background: "#DBEAFE", color: "#2563EB" };
  }

  if (type === "gas") {
    return { icon: <Flame size={16} />, background: "#FFEDD5", color: "#EA580C" };
  }

  if (type === "internet") {
    return { icon: <Globe size={16} />, background: "#E0F2FE", color: "#0284C7" };
  }

  if (type === "phone") {
    return { icon: <Phone size={16} />, background: "#F3E8FF", color: "#7C3AED" };
  }

  if (type === "maintenance_service") {
    return { icon: <Wrench size={16} />, background: "#FFEDD5", color: "#C2410C" };
  }

  if (type === "security") {
    return { icon: <Shield size={16} />, background: "#FEE2E2", color: "#DC2626" };
  }

  if (type === "cleaning_service") {
    return { icon: <Sparkles size={16} />, background: "#DCFCE7", color: "#16A34A" };
  }

  return { icon: <Package size={16} />, background: "#E5E7EB", color: "#4B5563" };
}

function getDueDayFromDate(dateKey: string) {
  if (!dateKey) return null;
  return parseDateOnly(dateKey).getDate();
}

function getCutoffDateFromDueDate(dueDate: string) {
  if (!dueDate) return "";
  const next = parseDateOnly(dueDate);
  next.setDate(next.getDate() + 1);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartsOnFromDueDate(dueDate: string) {
  if (!dueDate) return null;
  const date = parseDateOnly(dueDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function getDisplayStatusFromPayment(
  payment: ExpensePayment,
  todayKey: string
): ExpenseDisplayStatus {
  if (payment.status === "paid") return "paid";
  if (!payment.due_date) return payment.status === "overdue" ? "overdue" : "pending";
  if (payment.due_date < todayKey) return "overdue";
  if (payment.due_date === todayKey) return "due_today";
  return "pending";
}

function getDefaultCreateForm(buildingId = ""): CreatePaymentForm {
  return {
    buildingId,
    appliesTo: "building",
    unitId: "",
    expenseType: "electricity",
    title: "",
    vendorName: "",
    serviceIdentifier: "",
    responsibilityType: "company",
    frequencyType: "monthly",
    autoGenerate: true,
    amountEstimated: "",
    dueDate: getTodayDateOnlyKey(),
    billedPeriodLabel: "",
    consumptionPeriodLabel: "",
    billedMonthLabel: "",
    amountDue: "",
    paymentReference: "",
    notes: "",
  };
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

function getMetricIconBoxStyle(background: string): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    background,
    display: "grid",
    placeItems: "center",
  };
}

export default function PaymentsPage() {
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();

  const [loadingPage, setLoadingPage] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [syncingCurrentPeriod, setSyncingCurrentPeriod] = useState(false);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusFilter>("all");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePaymentForm>(getDefaultCreateForm());

  const [editingPayment, setEditingPayment] = useState<EditPaymentForm | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [openDetailPaymentId, setOpenDetailPaymentId] = useState<string | null>(null);
  const [deleteTargetRow, setDeleteTargetRow] = useState<PaymentRow | null>(null);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  const todayKey = getTodayDateOnlyKey();

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    void loadPaymentsData();
  }, [loading, user?.company_id]);

  useEffect(() => {
    if (!expensePayments.length || !user?.company_id || syncingStatuses) return;
    void syncAutomaticOverdueStatuses();
  }, [expensePayments, user?.company_id]);

  async function loadPaymentsData(showLoader = true) {
    if (!user?.company_id) return;

    if (showLoader) setLoadingPage(true);
    setMessage("");

    const [buildingsRes, unitsRes, schedulesRes, paymentsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name, address")
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
          expected_cutoff_day,
          service_identifier
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
          amount_estimated_snapshot,
          billed_period_label,
          consumption_period_label,
          billed_month_label
        `)
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true }),
    ]);

    if (buildingsRes.error) {
      const errorText = "No se pudieron cargar los edificios.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      const errorText = "No se pudieron cargar las unidades.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      const errorText = "No se pudieron cargar las configuraciones de pagos.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (paymentsRes.error) {
      const errorText = "No se pudieron cargar los registros de pagos.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
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

    setCreateForm((prev) => ({
      ...prev,
      buildingId: prev.buildingId || nextBuildings[0]?.id || "",
    }));

    if (showLoader) setLoadingPage(false);

    await ensureCurrentPeriodPayments(nextSchedules, nextPayments);
  }

  async function syncAutomaticOverdueStatuses() {
    const rowsToOverdue = expensePayments.filter(
      (payment) =>
        payment.status !== "paid" &&
        Boolean(payment.due_date) &&
        payment.due_date < todayKey &&
        payment.status !== "overdue"
    );

    if (!rowsToOverdue.length) return;

    setSyncingStatuses(true);

    try {
      const updates = rowsToOverdue.map((payment) =>
        supabase
          .from("expense_payments")
          .update({
            status: "overdue",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
      );

      await Promise.all(updates);

      setExpensePayments((prev) =>
        prev.map((payment) =>
          rowsToOverdue.some((item) => item.id === payment.id)
            ? { ...payment, status: "overdue" }
            : payment
        )
      );
    } finally {
      setSyncingStatuses(false);
    }
  }

  async function ensureCurrentPeriodPayments(
    schedulesInput?: ExpenseSchedule[],
    paymentsInput?: ExpensePayment[]
  ) {
    if (!user?.company_id) return;

    const schedules = schedulesInput ?? expenseSchedules;
    const payments = paymentsInput ?? expensePayments;

    const currentYear = Number(new Date().getFullYear());
    const currentMonth = Number(new Date().getMonth() + 1);

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
        const dueDay = Math.max(1, Math.min(31, schedule.due_day));
        const dueDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(
          dueDay
        ).padStart(2, "0")}`;

        const storedStatus: ExpenseStoredStatus = dueDate < todayKey ? "overdue" : "pending";

        return {
          expense_schedule_id: schedule.id,
          company_id: user.company_id,
          building_id: schedule.building_id,
          unit_id: schedule.applies_to === "unit" ? schedule.unit_id : null,
          period_year: currentYear,
          period_month: currentMonth,
          due_date: dueDate,
          amount_due: amountValue,
          status: storedStatus,
          paid_at: null,
          payment_reference: null,
          notes: schedule.notes || null,
          billing_period_label: formatPeriod(currentYear, currentMonth),
          is_generated_placeholder: true,
          amount_estimated_snapshot: schedule.amount_estimated ?? null,
          invoice_received_at: null,
          cutoff_date: getCutoffDateFromDueDate(dueDate),
          billed_period_label: null,
          consumption_period_label: null,
          billed_month_label: null,
        };
      });

      const { error } = await supabase.from("expense_payments").insert(rowsToInsert);

      if (error) {
        showToast({
          type: "error",
          message: "No se pudieron generar automáticamente algunos pagos del periodo actual.",
        });
        return;
      }

      const { data: refreshedPayments } = await supabase
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
          amount_estimated_snapshot,
          billed_period_label,
          consumption_period_label,
          billed_month_label
        `)
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true });

      setExpensePayments((refreshedPayments as ExpensePayment[]) || []);
    } finally {
      setSyncingCurrentPeriod(false);
    }
  }

  const unitsForSelectedBuilding = useMemo(() => {
    if (!createForm.buildingId) return [];
    return units.filter((unit) => unit.building_id === createForm.buildingId);
  }, [units, createForm.buildingId]);

  const unitsForEditingBuilding = useMemo(() => {
    if (!editingPayment?.buildingId) return [];
    return units.filter((unit) => unit.building_id === editingPayment.buildingId);
  }, [units, editingPayment?.buildingId]);

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

        const building =
          buildingMap.get(payment.building_id) || buildingMap.get(schedule.building_id);

        const unit =
          (payment.unit_id ? unitMap.get(payment.unit_id) : null) ||
          (schedule.unit_id ? unitMap.get(schedule.unit_id) : null);

        const displayStatus = getDisplayStatusFromPayment(payment, todayKey);

        return {
          id: payment.id,
          scheduleId: schedule.id,
          buildingId: payment.building_id,
          buildingName: building?.name || "Edificio",
          buildingAddress: building?.address || "Sin dirección",
          unitLabel: unit?.display_code || unit?.unit_number || "General",
          title: schedule.title,
          vendorName: schedule.vendor_name || "",
          expenseType: schedule.expense_type,
          frequencyLabel: getFrequencyLabel(schedule.frequency_type || "monthly"),
          periodLabel: formatPeriod(payment.period_year, payment.period_month),
          dueDate: payment.due_date,
          dueDateLabel: formatDate(payment.due_date),
          amountDue: payment.amount_due,
          amountDueLabel: formatCurrency(payment.amount_due),
          storedStatus: payment.status,
          displayStatus,
          statusLabel: getDisplayStatusLabel(displayStatus),
          paymentReference: payment.payment_reference || "—",
          notes: payment.notes || schedule.notes || "—",
          isGeneratedPlaceholder: Boolean(payment.is_generated_placeholder),
          cutoffDate: payment.cutoff_date,
          serviceIdentifier: schedule.service_identifier || "Sin identificador",
          serviceIdentifierLabel: getIdentifierLabel(schedule.expense_type),
          billedPeriodLabel: payment.billed_period_label || "Sin dato",
          consumptionPeriodLabel: payment.consumption_period_label || "Sin dato",
          billedMonthLabel: payment.billed_month_label || "Sin dato",
        };
      })
      .filter((row): row is PaymentRow => Boolean(row));
  }, [buildings, units, expenseSchedules, expensePayments, todayKey]);

  const filteredRows = useMemo(() => {
    return paymentRows.filter((row) => {
      if (selectedBuildingId !== "all" && row.buildingId !== selectedBuildingId) return false;
      if (selectedStatus !== "all" && row.displayStatus !== selectedStatus) return false;
      return true;
    });
  }, [paymentRows, selectedBuildingId, selectedStatus]);

  const totalRecords = filteredRows.length;
  const paidCount = filteredRows.filter((row) => row.displayStatus === "paid").length;
  const pendingCount = filteredRows.filter((row) => row.displayStatus === "pending").length;
  const dueTodayCount = filteredRows.filter((row) => row.displayStatus === "due_today").length;
  const overdueCount = filteredRows.filter((row) => row.displayStatus === "overdue").length;

  const pendingAmount = filteredRows
    .filter((row) => row.displayStatus !== "paid")
    .reduce((sum, row) => sum + row.amountDue, 0);

  const selectedBuildingLabel =
    selectedBuildingId === "all"
      ? "Todos los edificios"
      : buildings.find((building) => building.id === selectedBuildingId)?.name || "Edificio";

  const nextPendingLabel = useMemo(() => {
    const nextPending = filteredRows
      .filter((row) => row.displayStatus === "pending" || row.displayStatus === "due_today")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    if (!nextPending) return "Sin próximos pagos";
    return `${nextPending.title} · ${nextPending.dueDateLabel}`;
  }, [filteredRows]);

  function updateCreateForm<K extends keyof CreatePaymentForm>(
    key: K,
    value: CreatePaymentForm[K]
  ) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditingForm<K extends keyof EditPaymentForm>(
    key: K,
    value: EditPaymentForm[K]
  ) {
    setEditingPayment((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleCreatePayment() {
    if (!user?.company_id) return;

    setMessage("");

    if (!createForm.buildingId) {
      const errorText = "Selecciona un edificio.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (createForm.appliesTo === "unit" && !createForm.unitId) {
      const errorText = "Selecciona una unidad.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (!createForm.title.trim()) {
      const errorText = "Escribe el concepto corto del servicio.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (!createForm.dueDate) {
      const errorText = "Selecciona la fecha límite de pago.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    const dueDay = getDueDayFromDate(createForm.dueDate);
    if (!dueDay) {
      const errorText = "No se pudo calcular el día de vencimiento.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    const dueDateObject = parseDateOnly(createForm.dueDate);
    const periodMonth = dueDateObject.getMonth() + 1;
    const periodYear = dueDateObject.getFullYear();
    const amountEstimated = parseOptionalNumber(createForm.amountEstimated);
    const amountDue = parseOptionalNumber(createForm.amountDue) ?? amountEstimated ?? 0;
    const cutoffDate = getCutoffDateFromDueDate(createForm.dueDate);
    const startsOn = getStartsOnFromDueDate(createForm.dueDate);
    const storedStatus: ExpenseStoredStatus =
      createForm.dueDate < todayKey ? "overdue" : "pending";

    setSavingPayment(true);

    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("expense_schedules")
        .insert({
          company_id: user.company_id,
          building_id: createForm.buildingId,
          unit_id: createForm.appliesTo === "unit" ? createForm.unitId : null,
          expense_type: createForm.expenseType,
          title: createForm.title.trim(),
          vendor_name: createForm.vendorName.trim() || null,
          service_identifier: createForm.serviceIdentifier.trim() || null,
          responsibility_type: createForm.responsibilityType,
          applies_to: createForm.appliesTo,
          amount_estimated: amountEstimated,
          due_day: dueDay,
          active: true,
          notes: createForm.notes.trim() || null,
          frequency_type: createForm.frequencyType,
          starts_on: startsOn,
          ends_on: null,
          auto_generate: createForm.autoGenerate,
          expected_issue_day: null,
          expected_cutoff_day: null,
        })
        .select("id")
        .single();

      if (scheduleError || !scheduleData) {
        throw new Error(scheduleError?.message || "No se pudo crear la configuración del pago.");
      }

      const { error: paymentError } = await supabase.from("expense_payments").insert({
        expense_schedule_id: scheduleData.id,
        company_id: user.company_id,
        building_id: createForm.buildingId,
        unit_id: createForm.appliesTo === "unit" ? createForm.unitId : null,
        period_year: periodYear,
        period_month: periodMonth,
        due_date: createForm.dueDate,
        amount_due: amountDue,
        status: storedStatus,
        paid_at: null,
        payment_reference: createForm.paymentReference.trim() || null,
        notes: createForm.notes.trim() || null,
        billing_period_label: formatPeriod(periodYear, periodMonth),
        is_generated_placeholder: !createForm.amountDue.trim(),
        amount_estimated_snapshot: amountEstimated,
        invoice_received_at: null,
        cutoff_date: cutoffDate || null,
        billed_period_label: createForm.billedPeriodLabel.trim() || null,
        consumption_period_label: createForm.consumptionPeriodLabel.trim() || null,
        billed_month_label: createForm.billedMonthLabel.trim() || null,
      });

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo crear el registro del pago.");
      }

      showToast({ type: "success", message: "Pago administrativo creado correctamente." });
      setCreateForm(getDefaultCreateForm(createForm.buildingId));
      setShowCreateForm(false);
      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error creando el pago.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
    } finally {
      setSavingPayment(false);
    }
  }

  function startEditingPayment(row: PaymentRow) {
    const payment = expensePayments.find((item) => item.id === row.id);
    const schedule = expenseSchedules.find((item) => item.id === row.scheduleId);

    if (!payment || !schedule) {
      const errorText = "No se pudo abrir la edición del pago seleccionado.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
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
      serviceIdentifier: schedule.service_identifier || "",
      expenseType: schedule.expense_type,
      responsibilityType:
        schedule.responsibility_type === "tenant" ? "company" : schedule.responsibility_type,
      frequencyType: schedule.frequency_type || "monthly",
      autoGenerate: schedule.auto_generate !== false,
      amountEstimated:
        schedule.amount_estimated !== null && schedule.amount_estimated !== undefined
          ? String(schedule.amount_estimated)
          : "",
      dueDate: payment.due_date,
      billedPeriodLabel: payment.billed_period_label || "",
      consumptionPeriodLabel: payment.consumption_period_label || "",
      billedMonthLabel: payment.billed_month_label || "",
      amountDue: String(payment.amount_due),
      paymentReference: payment.payment_reference || "",
      notes: payment.notes || schedule.notes || "",
    });

    setIsEditModalOpen(true);
    setOpenDetailPaymentId(row.id);
  }

  async function handleSaveEditedPayment() {
    if (!user?.company_id || !editingPayment) return;

    setSavingPayment(true);
    setMessage("");

    try {
      if (!editingPayment.buildingId) throw new Error("Selecciona un edificio.");
      if (editingPayment.appliesTo === "unit" && !editingPayment.unitId) {
        throw new Error("Selecciona una unidad.");
      }
      if (!editingPayment.title.trim()) {
        throw new Error("Escribe el concepto corto del servicio.");
      }
      if (!editingPayment.dueDate) {
        throw new Error("Selecciona la fecha límite de pago.");
      }

      const dueDay = getDueDayFromDate(editingPayment.dueDate);
      if (!dueDay) throw new Error("No se pudo calcular el día de vencimiento.");

      const dueDateObject = parseDateOnly(editingPayment.dueDate);
      const periodMonth = dueDateObject.getMonth() + 1;
      const periodYear = dueDateObject.getFullYear();
      const amountEstimated = parseOptionalNumber(editingPayment.amountEstimated);
      const amountDue = parseOptionalNumber(editingPayment.amountDue) ?? 0;
      const cutoffDate = getCutoffDateFromDueDate(editingPayment.dueDate);
      const startsOn = getStartsOnFromDueDate(editingPayment.dueDate);
      const storedStatus: ExpenseStoredStatus =
        editingPayment.dueDate < todayKey ? "overdue" : "pending";

      const { error: scheduleError } = await supabase
        .from("expense_schedules")
        .update({
          building_id: editingPayment.buildingId,
          unit_id: editingPayment.appliesTo === "unit" ? editingPayment.unitId : null,
          expense_type: editingPayment.expenseType,
          title: editingPayment.title.trim(),
          vendor_name: editingPayment.vendorName.trim() || null,
          service_identifier: editingPayment.serviceIdentifier.trim() || null,
          responsibility_type: editingPayment.responsibilityType,
          applies_to: editingPayment.appliesTo,
          amount_estimated: amountEstimated,
          due_day: dueDay,
          notes: editingPayment.notes.trim() || null,
          frequency_type: editingPayment.frequencyType,
          starts_on: startsOn,
          auto_generate: editingPayment.autoGenerate,
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
          due_date: editingPayment.dueDate,
          amount_due: amountDue,
          status: storedStatus,
          paid_at: null,
          payment_reference: editingPayment.paymentReference.trim() || null,
          notes: editingPayment.notes.trim() || null,
          billing_period_label: formatPeriod(periodYear, periodMonth),
          is_generated_placeholder: amountDue === 0,
          amount_estimated_snapshot: amountEstimated,
          invoice_received_at: null,
          cutoff_date: cutoffDate || null,
          billed_period_label: editingPayment.billedPeriodLabel.trim() || null,
          consumption_period_label: editingPayment.consumptionPeriodLabel.trim() || null,
          billed_month_label: editingPayment.billedMonthLabel.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPayment.paymentId);

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo actualizar el pago.");
      }

      setIsEditModalOpen(false);
      setEditingPayment(null);

      showToast({ type: "success", message: "Pago actualizado correctamente." });
      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error actualizando el pago.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleCyclePaymentStatus(row: PaymentRow) {
    if (statusUpdatingId || deletingScheduleId) return;

    setStatusUpdatingId(row.id);

    try {
      const nextStoredStatus = getNextStoredStatusFromDisplayStatus(row.displayStatus);

      const { error } = await supabase
        .from("expense_payments")
        .update({
          status: nextStoredStatus,
          paid_at: nextStoredStatus === "paid" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) {
        throw new Error(error.message || "No se pudo actualizar el estado.");
      }

      setExpensePayments((prev) =>
        prev.map((payment) =>
          payment.id === row.id
            ? {
                ...payment,
                status: nextStoredStatus,
                paid_at: nextStoredStatus === "paid" ? new Date().toISOString() : null,
              }
            : payment
        )
      );

      showToast({
        type: "success",
        message: `Estado actualizado a ${getStoredStatusLabel(nextStoredStatus).toLowerCase()}.`,
      });
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error actualizando el estado.";
      showToast({ type: "error", message: errorText });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function openDeleteModal(row: PaymentRow) {
    setDeleteTargetRow(row);
  }

  async function handleDeletePaymentConfirmed() {
    if (!deleteTargetRow || deletingScheduleId) return;

    setDeletingScheduleId(deleteTargetRow.scheduleId);

    try {
      const { error: paymentsError } = await supabase
        .from("expense_payments")
        .delete()
        .eq("expense_schedule_id", deleteTargetRow.scheduleId);

      if (paymentsError) {
        throw new Error(paymentsError.message || "No se pudieron eliminar los periodos.");
      }

      const { error: scheduleError } = await supabase
        .from("expense_schedules")
        .delete()
        .eq("id", deleteTargetRow.scheduleId);

      if (scheduleError) {
        throw new Error(scheduleError.message || "No se pudo eliminar la configuración.");
      }

      setDeleteTargetRow(null);
      if (openDetailPaymentId === deleteTargetRow.id) setOpenDetailPaymentId(null);
      if (editingPayment?.scheduleId === deleteTargetRow.scheduleId) {
        setEditingPayment(null);
        setIsEditModalOpen(false);
      }

      showToast({ type: "success", message: "Pago eliminado correctamente." });
      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error eliminando el pago.";
      showToast({ type: "error", message: errorText });
    } finally {
      setDeletingScheduleId(null);
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
      <PageHeader title="Pagos administrativos" titleIcon={<ReceiptText size={18} />} />

      {message ? <div style={inlineErrorStyle}>{message}</div> : null}

      <AppGrid minWidth={220}>
        <MetricCard
          label="Registros"
          value={String(totalRecords)}
          helper={selectedBuildingLabel}
          icon={
            <div style={getMetricIconBoxStyle("#E0F2FE")}>
              <ReceiptText size={18} color="#0284C7" />
            </div>
          }
        />

        <MetricCard
          label="Pagados"
          value={String(paidCount)}
          helper="Pagos realizados"
          icon={
            <div style={getMetricIconBoxStyle("#DCFCE7")}>
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
          }
        />

        <MetricCard
          label="Pendientes"
          value={String(pendingCount)}
          helper={nextPendingLabel}
          icon={
            <div style={getMetricIconBoxStyle("#FEF3C7")}>
              <Clock3 size={18} color="#D97706" />
            </div>
          }
        />

        <MetricCard
          label="Vence hoy"
          value={String(dueTodayCount)}
          helper="Revisión inmediata"
          icon={
            <div style={getMetricIconBoxStyle("#FFEDD5")}>
              <AlertCircle size={18} color="#EA580C" />
            </div>
          }
        />

        <MetricCard
          label="Vencidos"
          value={String(overdueCount)}
          helper="Requieren atención"
          icon={
            <div style={getMetricIconBoxStyle("#FEE2E2")}>
              <AlertCircle size={18} color="#DC2626" />
            </div>
          }
        />

        <MetricCard
          label="Monto pendiente"
          value={formatCurrency(pendingAmount)}
          helper="No pagado"
          icon={
            <div style={getMetricIconBoxStyle("#DBEAFE")}>
              <CreditCard size={18} color="#2563EB" />
            </div>
          }
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard title="Filtros" icon={<Filter size={18} />}>
        <div style={filtersGridStyle}>
          <AppCard>
            <div style={filterFieldWrapStyle}>
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
            <div style={filterFieldWrapStyle}>
              <div style={filterLabelStyle}>
                <Filter size={14} />
                Estado
              </div>

              <AppSelect
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as PaymentStatusFilter)}
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="due_today">Vence hoy</option>
                <option value="paid">Pagado</option>
                <option value="overdue">Vencido</option>
              </AppSelect>
            </div>
          </AppCard>

          <AppCard>
            <div style={filterFieldWrapStyle}>
              <div style={filterLabelStyle}>
                <CalendarClock size={14} />
                Plantillas activas
              </div>

              <div style={filterReadonlyStyle}>
                {expenseSchedules.length} configuraciones activas
              </div>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      {showCreateForm ? (
        <>
          <SectionCard
            title="Nuevo pago recurrente"
            icon={<Plus size={18} />}
            action={
              <button type="button" onClick={() => setShowCreateForm(false)} style={ghostButtonStyle}>
                <X size={16} />
                Cerrar
              </button>
            }
          >
            <div style={simpleFormGridStyle}>
              <AppCard>
                <div style={simpleFormFieldsStyle}>
                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Edificio</span>
                    <AppSelect
                      value={createForm.buildingId}
                      onChange={(event) => {
                        const nextBuildingId = event.target.value;
                        setCreateForm((prev) => ({
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

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Aplica a</span>
                    <AppSelect
                      value={createForm.appliesTo}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
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

                  {createForm.appliesTo === "unit" ? (
                    <label style={fieldWrapStyle}>
                      <span style={fieldLabelStyle}>Unidad</span>
                      <AppSelect
                        value={createForm.unitId}
                        onChange={(event) => updateCreateForm("unitId", event.target.value)}
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

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Tipo de servicio</span>
                    <AppSelect
                      value={createForm.expenseType}
                      onChange={(event) =>
                        updateCreateForm("expenseType", event.target.value as ExpenseType)
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

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Concepto corto</span>
                    <input
                      value={createForm.title}
                      onChange={(event) => updateCreateForm("title", event.target.value)}
                      placeholder="Ej. CFE, Agua y Drenaje, Telmex"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Proveedor</span>
                    <input
                      value={createForm.vendorName}
                      onChange={(event) => updateCreateForm("vendorName", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>
                      {getIdentifierLabel(createForm.expenseType)}
                    </span>
                    <input
                      value={createForm.serviceIdentifier}
                      onChange={(event) =>
                        updateCreateForm("serviceIdentifier", event.target.value)
                      }
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </AppCard>

              <AppCard>
                <div style={simpleFormFieldsStyle}>
                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Frecuencia</span>
                    <AppSelect
                      value={createForm.frequencyType}
                      onChange={(event) =>
                        updateCreateForm("frequencyType", event.target.value as ExpenseFrequencyType)
                      }
                    >
                      <option value="monthly">Mensual</option>
                      <option value="bimonthly">Bimestral</option>
                    </AppSelect>
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Quién paga</span>
                    <AppSelect
                      value={createForm.responsibilityType}
                      onChange={(event) =>
                        updateCreateForm(
                          "responsibilityType",
                          event.target.value as "company" | "building"
                        )
                      }
                    >
                      <option value="company">Empresa</option>
                      <option value="building">Edificio</option>
                    </AppSelect>
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Fecha límite de pago</span>
                    <input
                      type="date"
                      value={createForm.dueDate}
                      onChange={(event) => updateCreateForm("dueDate", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <div style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Fecha de corte</span>
                    <div style={readonlyFieldStyle}>
                      {createForm.dueDate
                        ? formatDate(getCutoffDateFromDueDate(createForm.dueDate))
                        : "Sin fecha"}
                    </div>
                  </div>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Periodo facturado</span>
                    <input
                      value={createForm.billedPeriodLabel}
                      onChange={(event) => updateCreateForm("billedPeriodLabel", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Periodo de consumo</span>
                    <input
                      value={createForm.consumptionPeriodLabel}
                      onChange={(event) =>
                        updateCreateForm("consumptionPeriodLabel", event.target.value)
                      }
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Mes facturado</span>
                    <input
                      value={createForm.billedMonthLabel}
                      onChange={(event) => updateCreateForm("billedMonthLabel", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Monto estimado</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.amountEstimated}
                      onChange={(event) => updateCreateForm("amountEstimated", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Monto real</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.amountDue}
                      onChange={(event) => updateCreateForm("amountDue", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={createForm.autoGenerate}
                      onChange={(event) => updateCreateForm("autoGenerate", event.target.checked)}
                    />
                    <span style={fieldLabelStyle}>Generar automáticamente próximos periodos</span>
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Referencia de pago</span>
                    <input
                      value={createForm.paymentReference}
                      onChange={(event) => updateCreateForm("paymentReference", event.target.value)}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Notas / comentarios</span>
                    <textarea
                      value={createForm.notes}
                      onChange={(event) => updateCreateForm("notes", event.target.value)}
                      rows={4}
                      placeholder="Opcional"
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

                    <UiButton onClick={() => ensureCurrentPeriodPayments()} icon={<RotateCw size={16} />}>
                      {syncingCurrentPeriod ? "Generando..." : "Generar periodo actual"}
                    </UiButton>
                  </div>
                </div>
              </AppCard>
            </div>
          </SectionCard>
          <div style={{ height: 16 }} />
        </>
      ) : null}

      <SectionCard
        title="Listado de pagos"
        icon={<ReceiptText size={18} />}
        action={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              style={iconOnlyButtonStyle}
              title={showCreateForm ? "Cerrar formulario" : "Nuevo pago recurrente"}
              aria-label={showCreateForm ? "Cerrar formulario" : "Nuevo pago recurrente"}
            >
              {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            </button>

            <button
              type="button"
              onClick={() => ensureCurrentPeriodPayments()}
              style={ghostButtonStyle}
            >
              <RotateCw size={16} />
              {syncingCurrentPeriod ? "Generando..." : "Generar periodo"}
            </button>
          </div>
        }
      >
        {!filteredRows.length ? (
          <div style={emptyStateStyle}>
            No hay pagos administrativos para mostrar con los filtros actuales.
          </div>
        ) : (
          <div style={tableShellStyle}>
            <table style={tableStyle}>
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>

              <thead>
                <tr>
                  <th style={thStyle}>Concepto</th>
                  <th style={thStyle}>Edificio</th>
                  <th style={thStyle}>Periodo / frecuencia</th>
                  <th style={thStyle}>Vencimiento</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const serviceVisual = getServiceVisual(row.expenseType);
                  const isOpen = openDetailPaymentId === row.id;
                  const isUpdating = statusUpdatingId === row.id;
                  const colors = getStatusColors(row.displayStatus);

                  return (
                    <FragmentLike key={row.id}>
                      <tr style={rowStyle}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                background: serviceVisual.background,
                                color: serviceVisual.color,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {serviceVisual.icon}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setOpenDetailPaymentId((prev) => (prev === row.id ? null : row.id))
                              }
                              style={conceptDropdownButtonStyle}
                            >
                              <span style={conceptPrimaryTextStyle}>{row.title}</span>
                              <span style={conceptSecondaryActionStyle}>
                                {isOpen ? "Ocultar detalles" : "Ver detalles"}
                              </span>
                            </button>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span style={cellPrimaryTextStyle}>{row.buildingName}</span>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={cellPrimaryTextStyle}>{row.periodLabel}</span>
                            <span style={cellSecondaryTextStyle}>{row.frequencyLabel}</span>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span style={cellPrimaryTextStyle}>{row.dueDateLabel}</span>
                        </td>

                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span style={cellPrimaryTextStyle}>
                            {row.isGeneratedPlaceholder ? "Pendiente" : row.amountDueLabel}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <button
                            type="button"
                            onClick={() => handleCyclePaymentStatus(row)}
                            disabled={isUpdating || deletingScheduleId === row.scheduleId}
                            title="Haz clic para cambiar el estado"
                            style={{
                              ...statusButtonStyle,
                              background: colors.background,
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                              cursor: isUpdating ? "wait" : "pointer",
                            }}
                          >
                            {isUpdating ? "Actualizando..." : row.statusLabel}
                          </button>
                        </td>
                      </tr>

                      {isOpen ? (
                        <tr>
                          <td colSpan={6} style={{ ...tdStyle, paddingTop: 0 }}>
                            <div style={inlineDetailsCardStyle}>
                              <div style={inlineDetailsGridStyle}>
                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>Dirección del edificio</div>
                                  <div style={detailValueStyle}>{row.buildingAddress}</div>
                                </div>

                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>{row.serviceIdentifierLabel}</div>
                                  <div style={detailValueStyle}>{row.serviceIdentifier}</div>
                                </div>

                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>Fecha límite</div>
                                  <div style={detailValueStyle}>{row.dueDateLabel}</div>
                                </div>

                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>Fecha de corte</div>
                                  <div style={detailValueStyle}>
                                    {row.cutoffDate ? formatDate(row.cutoffDate) : "Sin fecha"}
                                  </div>
                                </div>

                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>Periodo facturado</div>
                                  <div style={detailValueStyle}>{row.billedPeriodLabel}</div>
                                </div>

                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>Periodo de consumo</div>
                                  <div style={detailValueStyle}>{row.consumptionPeriodLabel}</div>
                                </div>

                                <div style={detailBlockStyle}>
                                  <div style={detailLabelStyle}>Mes facturado</div>
                                  <div style={detailValueStyle}>{row.billedMonthLabel}</div>
                                </div>
                              </div>

                              <div style={{ marginTop: 14 }}>
                                <div style={detailLabelStyle}>Notas / comentarios</div>
                                <div style={notesBoxStyle}>
                                  {row.notes && row.notes !== "—"
                                    ? row.notes
                                    : "No hay notas registradas para este pago."}
                                </div>
                              </div>

                              <div style={inlineDetailsActionsStyle}>
                                <button
                                  type="button"
                                  onClick={() => startEditingPayment(row)}
                                  style={tableActionButtonStyle}
                                >
                                  <Edit3 size={14} />
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openDeleteModal(row)}
                                  style={tableDangerButtonStyle}
                                >
                                  <Trash2 size={14} />
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </FragmentLike>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={isEditModalOpen}
        title="Editar pago"
        subtitle="Actualiza los datos del servicio y del periodo sin expandir toda la página."
        onClose={() => {
          if (!savingPayment) {
            setIsEditModalOpen(false);
            setEditingPayment(null);
          }
        }}
      >
        {editingPayment ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={simpleFormGridStyle}>
              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Edificio</span>
                <AppSelect
                  value={editingPayment.buildingId}
                  onChange={(event) => {
                    const nextBuildingId = event.target.value;
                    setEditingPayment((prev) =>
                      prev ? { ...prev, buildingId: nextBuildingId, unitId: "" } : prev
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

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Aplica a</span>
                <AppSelect
                  value={editingPayment.appliesTo}
                  onChange={(event) =>
                    updateEditingForm("appliesTo", event.target.value as ExpenseAppliesToType)
                  }
                >
                  <option value="building">Edificio</option>
                  <option value="unit">Unidad</option>
                </AppSelect>
              </label>

              {editingPayment.appliesTo === "unit" ? (
                <label style={fieldWrapStyle}>
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

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Tipo de servicio</span>
                <AppSelect
                  value={editingPayment.expenseType}
                  onChange={(event) =>
                    updateEditingForm("expenseType", event.target.value as ExpenseType)
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

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Concepto corto</span>
                <input
                  value={editingPayment.title}
                  onChange={(event) => updateEditingForm("title", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Proveedor</span>
                <input
                  value={editingPayment.vendorName}
                  onChange={(event) => updateEditingForm("vendorName", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>{getIdentifierLabel(editingPayment.expenseType)}</span>
                <input
                  value={editingPayment.serviceIdentifier}
                  onChange={(event) => updateEditingForm("serviceIdentifier", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Frecuencia</span>
                <AppSelect
                  value={editingPayment.frequencyType}
                  onChange={(event) =>
                    updateEditingForm("frequencyType", event.target.value as ExpenseFrequencyType)
                  }
                >
                  <option value="monthly">Mensual</option>
                  <option value="bimonthly">Bimestral</option>
                </AppSelect>
              </label>

              <label style={fieldWrapStyle}>
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

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Fecha límite de pago</span>
                <input
                  type="date"
                  value={editingPayment.dueDate}
                  onChange={(event) => updateEditingForm("dueDate", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <div style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Fecha de corte</span>
                <div style={readonlyFieldStyle}>
                  {editingPayment.dueDate
                    ? formatDate(getCutoffDateFromDueDate(editingPayment.dueDate))
                    : "Sin fecha"}
                </div>
              </div>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Periodo facturado</span>
                <input
                  value={editingPayment.billedPeriodLabel}
                  onChange={(event) => updateEditingForm("billedPeriodLabel", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Periodo de consumo</span>
                <input
                  value={editingPayment.consumptionPeriodLabel}
                  onChange={(event) =>
                    updateEditingForm("consumptionPeriodLabel", event.target.value)
                  }
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Mes facturado</span>
                <input
                  value={editingPayment.billedMonthLabel}
                  onChange={(event) => updateEditingForm("billedMonthLabel", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto estimado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingPayment.amountEstimated}
                  onChange={(event) => updateEditingForm("amountEstimated", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto real</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingPayment.amountDue}
                  onChange={(event) => updateEditingForm("amountDue", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={editingPayment.autoGenerate}
                  onChange={(event) => updateEditingForm("autoGenerate", event.target.checked)}
                />
                <span style={fieldLabelStyle}>Generar automáticamente próximos periodos</span>
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Referencia de pago</span>
                <input
                  value={editingPayment.paymentReference}
                  onChange={(event) => updateEditingForm("paymentReference", event.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Notas / comentarios</span>
              <textarea
                value={editingPayment.notes}
                onChange={(event) => updateEditingForm("notes", event.target.value)}
                rows={4}
                style={textareaStyle}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!savingPayment) {
                    setIsEditModalOpen(false);
                    setEditingPayment(null);
                  }
                }}
                style={ghostButtonStyle}
              >
                Cancelar
              </button>

              <UiButton onClick={handleSaveEditedPayment} icon={<Save size={16} />}>
                {savingPayment ? "Guardando..." : "Guardar cambios"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTargetRow)}
        title="Eliminar pago"
        subtitle="Esta acción eliminará la configuración recurrente y sus periodos asociados."
        onClose={() => {
          if (!deletingScheduleId) setDeleteTargetRow(null);
        }}
      >
        {deleteTargetRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={deleteAlertBoxStyle}>
              <div style={deleteAlertIconWrapStyle}>
                <AlertTriangle size={18} />
              </div>

              <div>
                <p style={deleteAlertTitleStyle}>¿Seguro que quieres eliminar este pago?</p>
                <p style={deleteAlertTextStyle}>
                  El pago <strong>{deleteTargetRow.title}</strong> dejará de aparecer en el módulo
                  de pagos y también se eliminarán sus periodos relacionados.
                </p>
              </div>
            </div>

            <div style={deleteSummaryBoxStyle}>
              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Edificio</div>
                <div style={detailValueStyle}>{deleteTargetRow.buildingName}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Periodo</div>
                <div style={detailValueStyle}>{deleteTargetRow.periodLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Estado</div>
                <div style={detailValueStyle}>{deleteTargetRow.statusLabel}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!deletingScheduleId) setDeleteTargetRow(null);
                }}
                style={ghostButtonStyle}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeletePaymentConfirmed}
                disabled={deletingScheduleId === deleteTargetRow.scheduleId}
                style={{
                  ...dangerPrimaryButtonStyle,
                  opacity: deletingScheduleId === deleteTargetRow.scheduleId ? 0.7 : 1,
                  cursor:
                    deletingScheduleId === deleteTargetRow.scheduleId ? "wait" : "pointer",
                }}
              >
                <Trash2 size={16} />
                {deletingScheduleId === deleteTargetRow.scheduleId
                  ? "Eliminando..."
                  : "Eliminar pago"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

function FragmentLike({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

const inlineErrorStyle: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  background: "#FEF2F2",
  color: "#B91C1C",
  fontSize: 14,
  fontWeight: 600,
};

const filtersGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

const filterFieldWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const filterLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const filterReadonlyStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: "10px 12px",
  fontSize: 14,
  color: "#374151",
  display: "flex",
  alignItems: "center",
};

const simpleFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 16,
};

const simpleFormFieldsStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
};

const inputStyle: CSSProperties = {
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

const textareaStyle: CSSProperties = {
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

const readonlyFieldStyle: CSSProperties = {
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
};

const ghostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "#111827",
  cursor: "pointer",
};

const iconOnlyButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#111827",
  cursor: "pointer",
};

const emptyStateStyle: CSSProperties = {
  padding: "18px 16px",
  borderRadius: 14,
  border: "1px dashed #D1D5DB",
  background: "#F9FAFB",
  color: "#6B7280",
  fontSize: 14,
};

const tableShellStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const thStyle: CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #E5E7EB",
  background: "#F9FAFB",
  position: "sticky",
  top: 0,
};

const rowStyle: CSSProperties = {
  background: "#FFFFFF",
};

const tdStyle: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #F3F4F6",
  verticalAlign: "top",
};

const conceptDropdownButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  textAlign: "left",
  display: "grid",
  gap: 2,
  cursor: "pointer",
};

const conceptPrimaryTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#111827",
};

const conceptSecondaryActionStyle: CSSProperties = {
  fontSize: 12,
  color: "#2563EB",
  fontWeight: 600,
};

const cellPrimaryTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#111827",
};

const cellSecondaryTextStyle: CSSProperties = {
  fontSize: 12,
  color: "#9CA3AF",
};

const statusButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tableActionButtonStyle: CSSProperties = {
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

const tableDangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#B91C1C",
  cursor: "pointer",
};

const inlineDetailsCardStyle: CSSProperties = {
  marginTop: 2,
  marginBottom: 10,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  borderRadius: 14,
  padding: 14,
};

const inlineDetailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const detailBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const detailLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailValueStyle: CSSProperties = {
  fontSize: 14,
  color: "#111827",
  fontWeight: 600,
};

const notesBoxStyle: CSSProperties = {
  marginTop: 6,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  padding: 12,
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.5,
};

const inlineDetailsActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 14,
  flexWrap: "wrap",
};

const deleteAlertBoxStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: 14,
  borderRadius: 12,
  background: "#FEF2F2",
  border: "1px solid #FECACA",
};

const deleteAlertIconWrapStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#FEE2E2",
  color: "#B91C1C",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const deleteAlertTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 700,
  color: "#991B1B",
};

const deleteAlertTextStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#7F1D1D",
  lineHeight: 1.5,
};

const deleteSummaryBoxStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: 14,
  display: "grid",
  gap: 8,
};

const dangerPrimaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #DC2626",
  background: "#DC2626",
  color: "#FFFFFF",
  fontWeight: 700,
  cursor: "pointer",
};