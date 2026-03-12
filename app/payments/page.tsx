"use client";

/*
  Módulo de Pagos administrativos.

  Objetivos de esta versión:
  - mantener creación de pagos recurrentes
  - mantener edición de pagos reales y configuración recurrente
  - permitir cambio rápido de estado desde la tabla
  - simplificar la tabla principal
  - mover información extendida a un panel de "Detalles"
  - abrir edición en modal flotante
  - abrir eliminación en modal flotante estilizado
  - agregar iconos visuales por tipo de servicio
  - mantener toasts globales para evitar brincos del layout
*/

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import AppTable from "@/components/AppTable";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";

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
  expenseType: ExpenseSchedule["expense_type"];
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

function getNextPaymentStatus(currentStatus: ExpensePaymentStatus): ExpensePaymentStatus {
  if (currentStatus === "pending") return "paid";
  if (currentStatus === "paid") return "overdue";
  return "pending";
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

function getServiceVisual(type: ExpenseSchedule["expense_type"]) {
  if (type === "electricity") {
    return {
      icon: <Zap size={16} />,
      background: "#FEF3C7",
      color: "#CA8A04",
    };
  }

  if (type === "water") {
    return {
      icon: <Droplet size={16} />,
      background: "#DBEAFE",
      color: "#2563EB",
    };
  }

  if (type === "gas") {
    return {
      icon: <Flame size={16} />,
      background: "#FFEDD5",
      color: "#EA580C",
    };
  }

  if (type === "internet") {
    return {
      icon: <Globe size={16} />,
      background: "#E0F2FE",
      color: "#0284C7",
    };
  }

  if (type === "phone") {
    return {
      icon: <Phone size={16} />,
      background: "#F3E8FF",
      color: "#7C3AED",
    };
  }

  if (type === "maintenance_service") {
    return {
      icon: <Wrench size={16} />,
      background: "#FFEDD5",
      color: "#C2410C",
    };
  }

  if (type === "security") {
    return {
      icon: <Shield size={16} />,
      background: "#FEE2E2",
      color: "#DC2626",
    };
  }

  if (type === "cleaning_service") {
    return {
      icon: <Sparkles size={16} />,
      background: "#DCFCE7",
      color: "#16A34A",
    };
  }

  return {
    icon: <Package size={16} />,
    background: "#E5E7EB",
    color: "#4B5563",
  };
}

function getConceptLabel(row: PaymentRow) {
  const preferred = row.vendorName && row.vendorName !== "Sin proveedor" ? row.vendorName : row.title;
  return preferred.trim() || "Pago";
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
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusFilter>("all");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreatePaymentForm>(getInitialCreateForm());

  const [editingPayment, setEditingPayment] = useState<EditPaymentForm | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [detailsPaymentId, setDetailsPaymentId] = useState<string | null>(null);
  const [deleteTargetRow, setDeleteTargetRow] = useState<PaymentRow | null>(null);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    void loadPaymentsData();
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

    if (schedulesToGenerate.length === 0) {
      showToast({
        type: "info",
        message: "No había pagos nuevos por generar para el periodo actual.",
      });
      return;
    }

    setSyncingCurrentPeriod(true);

    try {
      const rowsToInsert = schedulesToGenerate.map((schedule) => {
        const amountValue = schedule.amount_estimated ?? 0;
        const dueDate = getDueDateFromPeriod(currentYear, currentMonth, schedule.due_day);

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
        const errorText =
          "No se pudieron generar automáticamente algunos pagos del periodo actual.";
        setMessage(errorText);
        showToast({ type: "error", message: errorText });
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

      showToast({
        type: "success",
        message: "Periodo generado correctamente.",
      });
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
          expenseType: schedule.expense_type,
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

  const detailsRow = useMemo(() => {
    return filteredRows.find((row) => row.id === detailsPaymentId) || null;
  }, [filteredRows, detailsPaymentId]);

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
    return `${getConceptLabel(nextPending)} · ${nextPending.dueDateLabel}`;
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

    if (!form.buildingId) {
      const errorText = "Selecciona un edificio.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (form.appliesTo === "unit" && !form.unitId) {
      const errorText = "Selecciona una unidad cuando el pago aplique a una unidad.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (!form.title.trim()) {
      const errorText = "Escribe un nombre corto para el concepto.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (!form.dueDay || Number(form.dueDay) < 1 || Number(form.dueDay) > 31) {
      const errorText = "Escribe un día de vencimiento válido entre 1 y 31.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (!form.periodMonth || Number(form.periodMonth) < 1 || Number(form.periodMonth) > 12) {
      const errorText = "Selecciona un mes válido.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    if (!form.periodYear || Number(form.periodYear) < 2000) {
      const errorText = "Selecciona un año válido.";
      setMessage(errorText);
      showToast({ type: "warning", message: errorText });
      return;
    }

    const amountEstimated = parseOptionalNumber(form.amountEstimated);
    const amountDue = parseOptionalNumber(form.amountDue) ?? amountEstimated ?? 0;
    const dueDay = Number(form.dueDay);
    const periodMonth = Number(form.periodMonth);
    const periodYear = Number(form.periodYear);

    const dueDate = form.dueDate.trim() || getDueDateFromPeriod(periodYear, periodMonth, dueDay);
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

      setForm(getInitialCreateForm(form.buildingId));
      setShowCreateForm(false);

      showToast({
        type: "success",
        message: "Pago administrativo creado correctamente.",
      });

      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.message
          : "Ocurrió un error creando el pago administrativo.";
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

    setIsEditModalOpen(true);
    setMessage("");
  }

  async function handleSaveEditedPayment() {
    if (!user?.company_id || !editingPayment) return;

    setMessage("");
    setSavingPayment(true);

    try {
      if (!editingPayment.buildingId) {
        throw new Error("Selecciona un edificio.");
      }

      if (editingPayment.appliesTo === "unit" && !editingPayment.unitId) {
        throw new Error("Selecciona una unidad.");
      }

      if (!editingPayment.title.trim()) {
        throw new Error("Escribe un nombre corto para el concepto.");
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
        editingPayment.dueDate.trim() || getDueDateFromPeriod(periodYear, periodMonth, dueDay);

      const paidAtValue = editingPayment.status === "paid" ? new Date().toISOString() : null;

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

      setIsEditModalOpen(false);
      setEditingPayment(null);

      showToast({
        type: "success",
        message: "Pago actualizado correctamente.",
      });

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

    setMessage("");
    setStatusUpdatingId(row.id);

    try {
      const nextStatus = getNextPaymentStatus(row.status);

      const { error } = await supabase
        .from("expense_payments")
        .update({
          status: nextStatus,
          paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
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
                status: nextStatus,
                paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
              }
            : payment
        )
      );

      showToast({
        type: "success",
        message: `Estado actualizado a ${getStatusLabel(nextStatus).toLowerCase()}.`,
      });
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.message
          : "Ocurrió un error actualizando el estado del pago.";
      setMessage(errorText);
      showToast({ type: "error", message: errorText });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function openDeleteModal(row: PaymentRow) {
    setDeleteTargetRow(row);
  }

  async function handleDeletePaymentConfirmed() {
    if (!deleteTargetRow || statusUpdatingId || deletingScheduleId) return;

    setMessage("");
    setDeletingScheduleId(deleteTargetRow.scheduleId);

    try {
      const { error: paymentsError } = await supabase
        .from("expense_payments")
        .delete()
        .eq("expense_schedule_id", deleteTargetRow.scheduleId);

      if (paymentsError) {
        throw new Error(paymentsError.message || "No se pudieron eliminar los periodos del pago.");
      }

      const { error: scheduleError } = await supabase
        .from("expense_schedules")
        .delete()
        .eq("id", deleteTargetRow.scheduleId);

      if (scheduleError) {
        throw new Error(scheduleError.message || "No se pudo eliminar la configuración recurrente.");
      }

      if (editingPayment?.scheduleId === deleteTargetRow.scheduleId) {
        setEditingPayment(null);
        setIsEditModalOpen(false);
      }

      if (detailsPaymentId === deleteTargetRow.id) {
        setDetailsPaymentId(null);
      }

      setDeleteTargetRow(null);

      showToast({
        type: "success",
        message: "Pago eliminado correctamente.",
      });

      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error eliminando el pago.";
      setMessage(errorText);
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
      {/* Encabezado principal del módulo. */}
      <PageHeader title="Pagos administrativos" titleIcon={<ReceiptText size={18} />} />

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
          helper="Pendiente + vencido"
          icon={
            <div style={getMetricIconBoxStyle("#DBEAFE")}>
              <CreditCard size={18} color="#2563EB" />
            </div>
          }
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard title="Filtros" icon={<Filter size={18} />}>
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

      {showCreateForm ? (
        <>
          <div style={{ height: 16 }} />

          {/* Formulario para crear una nueva configuración recurrente y su primer periodo. */}
          <SectionCard
            title="Nuevo pago recurrente"
            icon={<Plus size={18} />}
            action={
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={ghostButtonStyle}
              >
                <X size={16} />
                Cerrar
              </button>
            }
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
                    <span style={fieldLabelStyle}>Concepto corto</span>
                    <input
                      value={form.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                      placeholder="Ej. CFE, Agua y Drenaje, Telmex"
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
                      placeholder="Opcional"
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
                        updateForm("frequencyType", event.target.value as ExpenseFrequencyType)
                      }
                    >
                      <option value="monthly">Mensual</option>
                      <option value="bimonthly">Bimestral</option>
                    </AppSelect>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha de inicio</span>
                    <input
                      type="date"
                      value={form.startsOn}
                      onChange={(event) => updateForm("startsOn", event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={fieldLabelStyle}>Fecha fin</span>
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
                    <span style={fieldLabelStyle}>Generar automáticamente el periodo actual</span>
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
                    <span style={fieldLabelStyle}>Fecha límite real</span>
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
                      placeholder="Opcional"
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

                    <UiButton onClick={() => ensureCurrentPeriodPayments()} icon={<RotateCw size={16} />}>
                      {syncingCurrentPeriod ? "Generando..." : "Generar periodo actual"}
                    </UiButton>
                  </div>
                </div>
              </AppCard>
            </div>
          </SectionCard>
        </>
      ) : null}

      <div style={{ height: 16 }} />

      {/* Tabla principal simplificada. */}
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
        <AppTable
          rows={filteredRows}
          emptyState="No hay pagos administrativos para mostrar con los filtros actuales."
          columns={[
            {
              key: "concept",
              header: "Concepto",
              render: (row: PaymentRow) => {
                const serviceVisual = getServiceVisual(row.expenseType);

                return (
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

                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                        {getConceptLabel(row)}
                      </span>

                      <span style={{ fontSize: 12, color: "#6B7280" }}>
                        {row.expenseTypeLabel}
                      </span>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "building",
              header: "Edificio",
              render: (row: PaymentRow) => (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                  {row.buildingName}
                </span>
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

                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{row.frequencyLabel}</span>
                </div>
              ),
            },
            {
              key: "dueDate",
              header: "Vencimiento",
              render: (row: PaymentRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>{row.dueDateLabel}</span>

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
                    {row.isGeneratedPlaceholder ? "Pendiente" : row.amountDueLabel}
                  </span>

                  {row.isGeneratedPlaceholder ? (
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>Monto pendiente</span>
                  ) : null}
                </div>
              ),
            },
            {
              key: "status",
              header: "Estado",
              render: (row: PaymentRow) => {
                const colors = getStatusColors(row.status);
                const isUpdating = statusUpdatingId === row.id;

                return (
                  <button
                    type="button"
                    onClick={() => handleCyclePaymentStatus(row)}
                    disabled={isUpdating || deletingScheduleId === row.scheduleId}
                    title="Haz clic para cambiar el estado"
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
                      cursor: isUpdating ? "wait" : "pointer",
                    }}
                  >
                    {isUpdating ? "Actualizando..." : row.statusLabel}
                  </button>
                );
              },
            },
            {
              key: "actions",
              header: "Acciones",
              render: (row: PaymentRow) => {
                const isOpen = detailsPaymentId === row.id;

                return (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setDetailsPaymentId((prev) => (prev === row.id ? null : row.id))
                      }
                      style={tableActionButtonStyle}
                    >
                      {isOpen ? "Ocultar detalles" : "Detalles"}
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      </SectionCard>

      {detailsRow ? (
        <>
          <div style={{ height: 16 }} />

          {/* Panel inferior con detalles resumidos del pago seleccionado. */}
          <SectionCard
            title="Detalles del pago"
            icon={<ReceiptText size={18} />}
            action={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => startEditingPayment(detailsRow)}
                  style={tableActionButtonStyle}
                >
                  <Edit3 size={14} />
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => openDeleteModal(detailsRow)}
                  style={tableDangerButtonStyle}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <AppCard>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: getServiceVisual(detailsRow.expenseType).background,
                        color: getServiceVisual(detailsRow.expenseType).color,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {getServiceVisual(detailsRow.expenseType).icon}
                    </div>

                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                        {getConceptLabel(detailsRow)}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                        {detailsRow.expenseTypeLabel}
                      </div>
                    </div>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Concepto interno</span>
                    <span style={detailValueStyle}>{detailsRow.title}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Proveedor</span>
                    <span style={detailValueStyle}>{detailsRow.vendorName}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Edificio</span>
                    <span style={detailValueStyle}>{detailsRow.buildingName}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Aplica a</span>
                    <span style={detailValueStyle}>
                      {detailsRow.appliesToLabel === "Unidad"
                        ? detailsRow.unitLabel
                        : detailsRow.appliesToLabel}
                    </span>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Periodo</span>
                    <span style={detailValueStyle}>{detailsRow.periodLabel}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Frecuencia</span>
                    <span style={detailValueStyle}>{detailsRow.frequencyLabel}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Vencimiento</span>
                    <span style={detailValueStyle}>{detailsRow.dueDateLabel}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Monto</span>
                    <span style={detailValueStyle}>
                      {detailsRow.isGeneratedPlaceholder ? "Pendiente" : detailsRow.amountDueLabel}
                    </span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Estado</span>
                    <span
                      style={{
                        ...statusChipStyle,
                        background: getStatusColors(detailsRow.status).background,
                        color: getStatusColors(detailsRow.status).text,
                        borderColor: getStatusColors(detailsRow.status).border,
                      }}
                    >
                      {detailsRow.statusLabel}
                    </span>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Recibo recibido</span>
                    <span style={detailValueStyle}>
                      {detailsRow.invoiceReceivedAt
                        ? formatDate(detailsRow.invoiceReceivedAt)
                        : "Sin fecha"}
                    </span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Fecha de corte</span>
                    <span style={detailValueStyle}>
                      {detailsRow.cutoffDate ? formatDate(detailsRow.cutoffDate) : "Sin fecha"}
                    </span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Referencia</span>
                    <span style={detailValueStyle}>{detailsRow.paymentReference}</span>
                  </div>

                  <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>Quién paga</span>
                    <span style={detailValueStyle}>{detailsRow.responsibilityLabel}</span>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={detailLabelStyle}>Notas / comentarios</div>

                  <div
                    style={{
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                      background: "#F9FAFB",
                      padding: 14,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "#374151",
                      minHeight: 120,
                    }}
                  >
                    {detailsRow.notes && detailsRow.notes !== "—"
                      ? detailsRow.notes
                      : "No hay notas registradas para este pago."}
                  </div>
                </div>
              </AppCard>
            </div>
          </SectionCard>
        </>
      ) : null}

      {/* Modal flotante para editar el pago sin expandir toda la página. */}
      <Modal
        open={isEditModalOpen}
        title="Editar pago"
        subtitle="Actualiza los datos reales del periodo y la configuración recurrente."
        onClose={() => {
          if (!savingPayment) {
            setIsEditModalOpen(false);
            setEditingPayment(null);
          }
        }}
      >
        {editingPayment ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
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
                    updateEditingForm("appliesTo", event.target.value as ExpenseAppliesToType)
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
                <span style={fieldLabelStyle}>Tipo de gasto</span>
                <AppSelect
                  value={editingPayment.expenseType}
                  onChange={(event) =>
                    updateEditingForm(
                      "expenseType",
                      event.target.value as EditPaymentForm["expenseType"]
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
                <span style={fieldLabelStyle}>Concepto corto</span>
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
                    updateEditingForm("frequencyType", event.target.value as ExpenseFrequencyType)
                  }
                >
                  <option value="monthly">Mensual</option>
                  <option value="bimonthly">Bimestral</option>
                </AppSelect>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Fecha de inicio</span>
                <input
                  type="date"
                  value={editingPayment.startsOn}
                  onChange={(event) => updateEditingForm("startsOn", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Fecha fin</span>
                <input
                  type="date"
                  value={editingPayment.endsOn}
                  onChange={(event) => updateEditingForm("endsOn", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Día esperado de recibido</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editingPayment.expectedIssueDay}
                  onChange={(event) => updateEditingForm("expectedIssueDay", event.target.value)}
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
                  onChange={(event) => updateEditingForm("expectedCutoffDay", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={editingPayment.autoGenerate}
                  onChange={(event) => updateEditingForm("autoGenerate", event.target.checked)}
                />
                <span style={fieldLabelStyle}>Generación automática</span>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
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

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Día límite de pago</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editingPayment.dueDay}
                  onChange={(event) => updateEditingForm("dueDay", event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Mes del periodo</span>
                <AppSelect
                  value={editingPayment.periodMonth}
                  onChange={(event) => updateEditingForm("periodMonth", event.target.value)}
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
                  value={editingPayment.periodYear}
                  onChange={(event) => updateEditingForm("periodYear", event.target.value)}
                  style={inputStyle}
                />
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

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Estado</span>
                <AppSelect
                  value={editingPayment.status}
                  onChange={(event) =>
                    updateEditingForm("status", event.target.value as ExpensePaymentStatus)
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="overdue">Vencido</option>
                </AppSelect>
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
                  onChange={(event) => updateEditingForm("cutoffDate", event.target.value)}
                  style={inputStyle}
                />
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
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={fieldLabelStyle}>Notas</span>
              <textarea
                value={editingPayment.notes}
                onChange={(event) => updateEditingForm("notes", event.target.value)}
                rows={4}
                style={textareaStyle}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
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

      {/* Modal de eliminación estilizado, alineado al patrón usado en assets. */}
      <Modal
        open={Boolean(deleteTargetRow)}
        title="Eliminar pago"
        subtitle="Esta acción eliminará la configuración recurrente y sus periodos asociados."
        onClose={() => {
          if (!deletingScheduleId) {
            setDeleteTargetRow(null);
          }
        }}
      >
        {deleteTargetRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: 14,
                borderRadius: 12,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#FEE2E2",
                  color: "#B91C1C",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} />
              </div>

              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#991B1B" }}>
                  ¿Seguro que quieres eliminar este pago?
                </p>

                <p style={{ margin: "6px 0 0", color: "#7F1D1D", lineHeight: 1.5 }}>
                  El pago <strong>{getConceptLabel(deleteTargetRow)}</strong> dejará de aparecer
                  en el módulo de pagos y también se eliminarán sus periodos relacionados.
                </p>
              </div>
            </div>

            <div
              style={{
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "#F9FAFB",
                padding: 14,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={detailItemStyle}>
                <span style={detailLabelStyle}>Edificio</span>
                <span style={detailValueStyle}>{deleteTargetRow.buildingName}</span>
              </div>

              <div style={detailItemStyle}>
                <span style={detailLabelStyle}>Periodo</span>
                <span style={detailValueStyle}>{deleteTargetRow.periodLabel}</span>
              </div>

              <div style={detailItemStyle}>
                <span style={detailLabelStyle}>Estado</span>
                <span style={detailValueStyle}>{deleteTargetRow.statusLabel}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!deletingScheduleId) {
                    setDeleteTargetRow(null);
                  }
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

const fieldLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
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

const detailItemStyle: CSSProperties = {
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

const statusChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  padding: "6px 10px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontSize: 12,
  fontWeight: 800,
};