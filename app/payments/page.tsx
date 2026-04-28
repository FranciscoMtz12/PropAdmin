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
import toast from "react-hot-toast";
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
  periodYear: number;
  periodMonth: number;
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

const paymentFormSchema = z
  .object({
    buildingId: z.string().min(1, "Selecciona un edificio"),
    appliesTo: z.enum(["building", "unit"]),
    unitId: z.string().optional(),
    expenseType: z.enum([
      "electricity",
      "water",
      "gas",
      "internet",
      "phone",
      "maintenance_service",
      "security",
      "cleaning_service",
      "other",
    ]),
    title: z.string().min(1, "Escribe el concepto corto del servicio"),
    vendorName: z.string().optional(),
    serviceIdentifier: z.string().optional(),
    responsibilityType: z.enum(["company", "building"]),
    frequencyType: z.enum(["monthly", "bimonthly"]),
    autoGenerate: z.boolean(),
    amountEstimated: z.string().min(1, "El monto estimado es obligatorio"),
    dueDate: z.string().min(1, "Selecciona la fecha límite de pago"),
    billedPeriodLabel: z.string().optional(),
    consumptionPeriodLabel: z.string().optional(),
    billedMonthLabel: z.string().optional(),
    amountDue: z.string().optional(),
    paymentReference: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.appliesTo !== "unit" || !!data.unitId,
    { message: "Selecciona una unidad", path: ["unitId"] }
  );
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

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
      background: "var(--metric-bg-amber)",
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
    background: "var(--badge-bg-red)",
    border: "#FECACA",
    text: "#B91C1C",
  };
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
    return { icon: <Zap size={16} />, background: "var(--icon-bg-amber)", color: "#CA8A04" };
  }

  if (type === "water") {
    return { icon: <Droplet size={16} />, background: "var(--icon-bg-blue)", color: "var(--badge-text-blue)" };
  }

  if (type === "gas") {
    return { icon: <Flame size={16} />, background: "var(--metric-bg-amber)", color: "#EA580C" };
  }

  if (type === "internet") {
    return { icon: <Globe size={16} />, background: "var(--icon-bg-blue)", color: "#0284C7" };
  }

  if (type === "phone") {
    return { icon: <Phone size={16} />, background: "var(--icon-bg-purple)", color: "var(--icon-color-purple)" };
  }

  if (type === "maintenance_service") {
    return { icon: <Wrench size={16} />, background: "var(--metric-bg-amber)", color: "#C2410C" };
  }

  if (type === "security") {
    return { icon: <Shield size={16} />, background: "var(--badge-bg-red)", color: "#DC2626" };
  }

  if (type === "cleaning_service") {
    return { icon: <Sparkles size={16} />, background: "var(--icon-bg-green)", color: "#16A34A" };
  }

  return { icon: <Package size={16} />, background: "var(--bg-card-hover)", color: "var(--text-secondary)" };
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

/**
 * Esta función deriva el estado almacenado correcto cuando se desmarca un pago pagado.
 * - Si ya venció, vuelve a overdue
 * - Si vence hoy o después, vuelve a pending
 *
 * El estado "due_today" solo existe visualmente en frontend.
 */
function getStoredStatusFromDueDate(dueDate: string, todayKey: string): ExpenseStoredStatus {
  if (!dueDate) return "pending";
  if (dueDate < todayKey) return "overdue";
  return "pending";
}

function getDefaultCreateForm(buildingId = ""): PaymentFormValues {
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

const paymentErrorTextStyle: CSSProperties = {
  color: "#EF4444",
  fontSize: 12,
  marginTop: 4,
  marginBottom: 0,
};

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

    // Dejamos el fondo limpio y sin borde visible para evitar
    // que se vea un contorno gris distinto al color del fondo.
    background,
    border: "none",
    boxShadow: "none",

    display: "grid",
    placeItems: "center",
  };
}

const BUILDING_COLORS = [
  "#3B82F6","#10B981","#8B5CF6","#F59E0B","#EF4444",
  "#EC4899","#14B8A6","#F97316","#6366F1","#84CC16","#06B6D4","#A855F7",
];

const MONTH_LABELS_LONG = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  electricity: "Electricidad",
  water: "Agua",
  gas: "Gas",
  internet: "Internet",
  phone: "Teléfono",
  maintenance_service: "Mantenimiento",
  security: "Seguridad",
  cleaning_service: "Limpieza",
  other: "Otros",
};

const EXPENSE_TYPE_COLOR: Record<string, string> = {
  "Electricidad": "#F59E0B",
  "Agua": "#3B82F6",
  "Gas": "#F97316",
  "Internet": "#6366F1",
  "Teléfono": "#8B5CF6",
  "Mantenimiento": "#10B981",
  "Seguridad": "#EF4444",
  "Limpieza": "#14B8A6",
  "Otros": "#94A3B8",
};

export default function PaymentsPage() {
  const { user, loading } = useCurrentUser();

  const [loadingPage, setLoadingPage] = useState(true);
  const [syncingCurrentPeriod, setSyncingCurrentPeriod] = useState(false);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [showCreateForm, setShowCreateForm] = useState(false);

  const createForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: getDefaultCreateForm(),
  });
  const createBuildingId = createForm.watch("buildingId");
  const createAppliesTo = createForm.watch("appliesTo");

  const editForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: getDefaultCreateForm(),
  });
  const editBuildingId = editForm.watch("buildingId");
  const editAppliesTo = editForm.watch("appliesTo");

  /* Ids del pago actualmente en edición — se guardan aparte del form. */
  const [editingIds, setEditingIds] = useState<{ paymentId: string; scheduleId: string } | null>(
    null
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [openDetailPaymentId, setOpenDetailPaymentId] = useState<string | null>(null);
  const [deleteTargetRow, setDeleteTargetRow] = useState<PaymentRow | null>(null);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);

  const todayKey = getTodayDateOnlyKey();

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    void loadPaymentsData();
  }, [loading, user?.company_id, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!expensePayments.length || !user?.company_id || syncingStatuses) return;
    void syncAutomaticOverdueStatuses();
  }, [expensePayments, user?.company_id]);

  const donutData = useMemo(() => {
    const scheduleById = new Map(expenseSchedules.map(s => [s.id, s]));
    const totals: Record<string, number> = {};
    expensePayments.forEach(p => {
      if (p.period_year !== selectedYear || p.period_month !== selectedMonth) return;
      const schedule = scheduleById.get(p.expense_schedule_id);
      const cat = schedule ? EXPENSE_TYPE_LABEL[schedule.expense_type] : "Sin categoría";
      totals[cat] = (totals[cat] ?? 0) + (p.amount_due ?? 0);
    });
    return Object.entries(totals).map(([name, value]) => ({
      name,
      value,
      color: EXPENSE_TYPE_COLOR[name] ?? "#94A3B8",
    }));
  }, [expensePayments, expenseSchedules, selectedYear, selectedMonth]);

  const lineChartData = useMemo(() => {
    const months: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return months.map(({ year, month }) => {
      const label = MONTH_LABELS_LONG[month - 1].slice(0, 3) + " " + String(year).slice(2);
      const row: Record<string, string | number> = { mes: label };
      const scheduleById = new Map(expenseSchedules.map(s => [s.id, s]));
      expensePayments
        .filter(p => p.period_year === year && p.period_month === month)
        .forEach(p => {
          const schedule = scheduleById.get(p.expense_schedule_id);
          if (!schedule) return;
          const cat = EXPENSE_TYPE_LABEL[schedule.expense_type as keyof typeof EXPENSE_TYPE_LABEL] ?? "Otros";
          row[cat] = ((row[cat] as number) ?? 0) + Number(p.amount_due ?? 0);
        });
      return row;
    });
  }, [expensePayments, expenseSchedules, selectedYear, selectedMonth]);

  const lineCategories = useMemo(() => {
    const cats = new Set<string>();
    lineChartData.forEach(row => Object.keys(row).filter(k => k !== "mes").forEach(k => cats.add(k)));
    return Array.from(cats);
  }, [lineChartData]);

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };
  const monthLabel = `${MONTH_LABELS_LONG[selectedMonth - 1]} ${selectedYear}`;

  async function loadPaymentsData(showLoader = true) {
    if (!user?.company_id) return;

    if (showLoader) setLoadingPage(true);
    setMessage("");

    const [buildingsRes, unitsRes, schedulesRes, paymentsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name, address")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

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
        .is("deleted_at", null)
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
        .is("deleted_at", null)
        .order("due_date", { ascending: true }),
    ]);

    if (buildingsRes.error) {
      const errorText = "No se pudieron cargar los edificios.";
      setMessage(errorText);
      toast.error(errorText);
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      const errorText = "No se pudieron cargar las unidades.";
      setMessage(errorText);
      toast.error(errorText);
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      const errorText = "No se pudieron cargar las configuraciones de pagos.";
      setMessage(errorText);
      toast.error(errorText);
      if (showLoader) setLoadingPage(false);
      return;
    }

    if (paymentsRes.error) {
      const errorText = "No se pudieron cargar los registros de pagos.";
      setMessage(errorText);
      toast.error(errorText);
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

    if (!createForm.getValues("buildingId") && nextBuildings[0]?.id) {
      createForm.setValue("buildingId", nextBuildings[0].id);
    }

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

    const currentYear = selectedYear;
    const currentMonth = selectedMonth;

    const realToday = new Date();
    const isCurrentPeriod = selectedYear === realToday.getFullYear() && selectedMonth === realToday.getMonth() + 1;
    if (!isCurrentPeriod) return;

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
        toast.error("No se pudieron generar automáticamente algunos pagos del periodo actual.");
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
    if (!createBuildingId) return [];
    return units.filter((unit) => unit.building_id === createBuildingId);
  }, [units, createBuildingId]);

  const unitsForEditingBuilding = useMemo(() => {
    if (!editBuildingId) return [];
    return units.filter((unit) => unit.building_id === editBuildingId);
  }, [units, editBuildingId]);

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
          periodYear: payment.period_year,
          periodMonth: payment.period_month,
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
      if (row.periodYear !== selectedYear || row.periodMonth !== selectedMonth) return false;
      return true;
    });
  }, [paymentRows, selectedBuildingId, selectedStatus, selectedYear, selectedMonth]);

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

  const handleCreatePayment = createForm.handleSubmit(async (data) => {
    if (!user?.company_id) return;

    setMessage("");

    const dueDay = getDueDayFromDate(data.dueDate);
    if (!dueDay) {
      const errorText = "No se pudo calcular el día de vencimiento.";
      setMessage(errorText);
      toast(errorText, { icon: "⚠️" });
      return;
    }

    const dueDateObject = parseDateOnly(data.dueDate);
    const periodMonth = dueDateObject.getMonth() + 1;
    const periodYear = dueDateObject.getFullYear();
    const amountEstimated = parseOptionalNumber(data.amountEstimated);
    const amountDueRaw = data.amountDue?.trim() || "";
    const amountDue = parseOptionalNumber(amountDueRaw) ?? amountEstimated ?? 0;
    const cutoffDate = getCutoffDateFromDueDate(data.dueDate);
    const startsOn = getStartsOnFromDueDate(data.dueDate);
    const storedStatus: ExpenseStoredStatus =
      data.dueDate < todayKey ? "overdue" : "pending";

    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("expense_schedules")
        .insert({
          company_id: user.company_id,
          building_id: data.buildingId,
          unit_id: data.appliesTo === "unit" ? data.unitId : null,
          expense_type: data.expenseType,
          title: data.title.trim(),
          vendor_name: data.vendorName?.trim() || null,
          service_identifier: data.serviceIdentifier?.trim() || null,
          responsibility_type: data.responsibilityType,
          applies_to: data.appliesTo,
          amount_estimated: amountEstimated,
          due_day: dueDay,
          active: true,
          notes: data.notes?.trim() || null,
          frequency_type: data.frequencyType,
          starts_on: startsOn,
          ends_on: null,
          auto_generate: data.autoGenerate,
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
        building_id: data.buildingId,
        unit_id: data.appliesTo === "unit" ? data.unitId : null,
        period_year: periodYear,
        period_month: periodMonth,
        due_date: data.dueDate,
        amount_due: amountDue,
        status: storedStatus,
        paid_at: null,
        payment_reference: data.paymentReference?.trim() || null,
        notes: data.notes?.trim() || null,
        billing_period_label: formatPeriod(periodYear, periodMonth),
        is_generated_placeholder: !amountDueRaw,
        amount_estimated_snapshot: amountEstimated,
        invoice_received_at: null,
        cutoff_date: cutoffDate || null,
        billed_period_label: data.billedPeriodLabel?.trim() || null,
        consumption_period_label: data.consumptionPeriodLabel?.trim() || null,
        billed_month_label: data.billedMonthLabel?.trim() || null,
      });

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo crear el registro del pago.");
      }

      toast.success("Pago administrativo creado correctamente.");
      createForm.reset(getDefaultCreateForm(data.buildingId));
      setShowCreateForm(false);
      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error creando el pago.";
      setMessage(errorText);
      toast.error(errorText);
    }
  });

  function startEditingPayment(row: PaymentRow) {
    const payment = expensePayments.find((item) => item.id === row.id);
    const schedule = expenseSchedules.find((item) => item.id === row.scheduleId);

    if (!payment || !schedule) {
      const errorText = "No se pudo abrir la edición del pago seleccionado.";
      setMessage(errorText);
      toast.error(errorText);
      return;
    }

    setEditingIds({ paymentId: payment.id, scheduleId: schedule.id });
    editForm.reset({
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

  const handleSaveEditedPayment = editForm.handleSubmit(async (data) => {
    if (!user?.company_id || !editingIds) return;

    setMessage("");

    try {
      const dueDay = getDueDayFromDate(data.dueDate);
      if (!dueDay) throw new Error("No se pudo calcular el día de vencimiento.");

      const dueDateObject = parseDateOnly(data.dueDate);
      const periodMonth = dueDateObject.getMonth() + 1;
      const periodYear = dueDateObject.getFullYear();
      const amountEstimated = parseOptionalNumber(data.amountEstimated);
      const amountDue = parseOptionalNumber(data.amountDue || "") ?? 0;
      const cutoffDate = getCutoffDateFromDueDate(data.dueDate);
      const startsOn = getStartsOnFromDueDate(data.dueDate);

      /**
       * Si el pago ya estaba pagado antes de editarlo, conservamos "paid".
       * Si no estaba pagado, recalculamos su estado real por fecha.
       */
      const currentlyPaid = expensePayments.find(
        (payment) => payment.id === editingIds.paymentId
      )?.status === "paid";

      const storedStatus: ExpenseStoredStatus = currentlyPaid
        ? "paid"
        : getStoredStatusFromDueDate(data.dueDate, todayKey);

      const nextPaidAt = currentlyPaid
        ? expensePayments.find((payment) => payment.id === editingIds.paymentId)?.paid_at || null
        : null;

      const { error: scheduleError } = await supabase
        .from("expense_schedules")
        .update({
          building_id: data.buildingId,
          unit_id: data.appliesTo === "unit" ? data.unitId : null,
          expense_type: data.expenseType,
          title: data.title.trim(),
          vendor_name: data.vendorName?.trim() || null,
          service_identifier: data.serviceIdentifier?.trim() || null,
          responsibility_type: data.responsibilityType,
          applies_to: data.appliesTo,
          amount_estimated: amountEstimated,
          due_day: dueDay,
          notes: data.notes?.trim() || null,
          frequency_type: data.frequencyType,
          starts_on: startsOn,
          auto_generate: data.autoGenerate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingIds.scheduleId);

      if (scheduleError) {
        throw new Error(scheduleError.message || "No se pudo actualizar la configuración.");
      }

      const { error: paymentError } = await supabase
        .from("expense_payments")
        .update({
          building_id: data.buildingId,
          unit_id: data.appliesTo === "unit" ? data.unitId : null,
          period_year: periodYear,
          period_month: periodMonth,
          due_date: data.dueDate,
          amount_due: amountDue,
          status: storedStatus,
          paid_at: nextPaidAt,
          payment_reference: data.paymentReference?.trim() || null,
          notes: data.notes?.trim() || null,
          billing_period_label: formatPeriod(periodYear, periodMonth),
          is_generated_placeholder: amountDue === 0,
          amount_estimated_snapshot: amountEstimated,
          invoice_received_at: null,
          cutoff_date: cutoffDate || null,
          billed_period_label: data.billedPeriodLabel?.trim() || null,
          consumption_period_label: data.consumptionPeriodLabel?.trim() || null,
          billed_month_label: data.billedMonthLabel?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingIds.paymentId);

      if (paymentError) {
        throw new Error(paymentError.message || "No se pudo actualizar el pago.");
      }

      setIsEditModalOpen(false);
      setEditingIds(null);

      toast.success("Pago actualizado correctamente.");
      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error actualizando el pago.";
      setMessage(errorText);
      toast.error(errorText);
    }
  });

  async function handleCyclePaymentStatus(row: PaymentRow) {
    if (statusUpdatingId || deletingScheduleId) return;

    // Si ya está pagado: mostrar confirmación de revertir en lugar de ejecutar directamente
    if (row.displayStatus === "paid") {
      setRevertConfirmId(row.id);
      return;
    }

    setStatusUpdatingId(row.id);

    try {
      const { error } = await supabase
        .from("expense_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) throw new Error(error.message || "No se pudo actualizar el estado.");

      setExpensePayments((prev) =>
        prev.map((payment) =>
          payment.id === row.id ? { ...payment, status: "paid", paid_at: new Date().toISOString() } : payment
        )
      );
      toast.success("Pago marcado como pagado.");
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Ocurrió un error actualizando el estado.";
      toast.error(errorText);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleConfirmRevert(row: PaymentRow) {
    setRevertConfirmId(null);
    if (statusUpdatingId || deletingScheduleId) return;
    setStatusUpdatingId(row.id);
    try {
      const nextStoredStatus = getStoredStatusFromDueDate(row.dueDate, todayKey);
      const { error } = await supabase
        .from("expense_payments")
        .update({ status: nextStoredStatus, paid_at: null, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw new Error(error.message || "No se pudo revertir el pago.");
      setExpensePayments((prev) =>
        prev.map((p) => p.id === row.id ? { ...p, status: nextStoredStatus, paid_at: null } : p)
      );
      toast.success("El pago volvió a su estado real según la fecha.");
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Ocurrió un error.";
      toast.error(errorText);
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
      const now = new Date().toISOString();

      // Soft delete: archiva todos los periodos del schedule
      const { error: paymentsError } = await supabase
        .from("expense_payments")
        .update({ deleted_at: now })
        .eq("expense_schedule_id", deleteTargetRow.scheduleId);

      if (paymentsError) {
        throw new Error(paymentsError.message || "No se pudieron archivar los periodos.");
      }

      // Soft delete: archiva el schedule (configuración recurrente)
      const { error: scheduleError } = await supabase
        .from("expense_schedules")
        .update({ deleted_at: now })
        .eq("id", deleteTargetRow.scheduleId);

      if (scheduleError) {
        throw new Error(scheduleError.message || "No se pudo archivar la configuración.");
      }

      setDeleteTargetRow(null);
      if (openDetailPaymentId === deleteTargetRow.id) setOpenDetailPaymentId(null);
      if (editingIds?.scheduleId === deleteTargetRow.scheduleId) {
        setEditingIds(null);
        setIsEditModalOpen(false);
      }

      toast.success("Pago archivado correctamente.");
      await loadPaymentsData(false);
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Ocurrió un error eliminando el pago.";
      toast.error(errorText);
    } finally {
      setDeletingScheduleId(null);
    }
  }

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>
          Cargando módulo de pagos...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader title="Pagos administrativos" titleIcon={<ReceiptText size={18} />} />

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.25rem", border:"1px solid var(--border-default)", borderRadius:12, padding:"4px", background:"var(--bg-card)" }}>
          <button onClick={prevMonth} style={{ background:"none", border:"none", borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text-secondary)", fontSize:18, lineHeight:1 }}>‹</button>
          <span style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", minWidth:130, textAlign:"center", padding:"0 8px" }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ background:"none", border:"none", borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text-secondary)", fontSize:18, lineHeight:1 }}>›</button>
        </div>
      </div>

      {message ? <div style={inlineErrorStyle}>{message}</div> : null}

      <div className="pay-stat-bar" style={{ display:"flex", background:"var(--bg-card)", border:"1px solid var(--border-default)", borderRadius:12, overflow:"hidden", marginBottom:"1rem" }}>
        {[
          { label:"Registros", value:totalRecords, sub:"total" },
          { label:"Pendiente", value:`$${pendingAmount.toLocaleString("es-MX",{minimumFractionDigits:2})}`, sub:"no pagado", color:"#F59E0B" },
          { label:"Pagados", value:paidCount, sub:"realizados", color:"#10B981" },
          { label:"Pendientes", value:pendingCount, sub:"por pagar", color:"#F59E0B" },
          { label:"Vence hoy", value:dueTodayCount, sub:"revisión", color:"#F97316" },
          { label:"Vencidos", value:overdueCount, sub:"atención", color:"#EF4444" },
        ].map((s, i, arr) => (
          <div key={i} style={{ flex:1, padding:".6rem .75rem", borderRight: i < arr.length-1 ? "1px solid var(--border-default)" : "none", textAlign:"center" }}>
            <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:600, color: s.color ?? "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="pay-charts-row" style={{ display:"flex", gap:"1rem", marginBottom:"1rem", alignItems:"stretch" }}>
        {donutData.length > 0 && (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border-default)", borderRadius:12, padding:"1rem", width:240, flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:600, color:"var(--text-secondary)", letterSpacing:"0.5px", marginBottom:".75rem" }}>GASTO POR CATEGORÍA</div>
            <div style={{ width:"100%", height:110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits:2 })}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem", marginTop:".5rem" }}>
              {donutData.map((entry, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.4rem", fontSize:10 }}>
                  <div style={{ width:7, height:7, borderRadius:1, background:entry.color, flexShrink:0 }} />
                  <span style={{ color:"var(--text-secondary)", flex:1 }}>{entry.name}</span>
                  <span style={{ color:"var(--text-primary)", fontWeight:500 }}>${entry.value.toLocaleString("es-MX", { minimumFractionDigits:2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {lineChartData.length > 0 && (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border-default)", borderRadius:12, padding:"1rem", flex:1 }}>
            <div style={{ fontSize:10, fontWeight:600, color:"var(--text-secondary)", letterSpacing:"0.5px", marginBottom:".75rem" }}>TENDENCIA DE GASTO — ÚLTIMOS 6 MESES</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineChartData} margin={{ top:4, right:12, left:0, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="mes" tick={{ fontSize:10, fill:"var(--text-muted)" }} />
                <YAxis tick={{ fontSize:10, fill:"var(--text-muted)" }} tickFormatter={v => `$${Number(v).toLocaleString("es-MX", { notation:"compact" })}`} />
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits:2 })}`} contentStyle={{ background:"var(--bg-card)", border:"1px solid var(--border-default)", borderRadius:8, fontSize:11 }} />
                <Legend wrapperStyle={{ fontSize:10, paddingTop:6 }} />
                {lineCategories.map(cat => (
                  <Line key={cat} type="monotone" dataKey={cat} stroke={EXPENSE_TYPE_COLOR[cat] ?? "#94A3B8"} strokeWidth={2} dot={{ r:2.5 }} activeDot={{ r:4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

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
            <form onSubmit={handleCreatePayment} style={simpleFormGridStyle}>
              <AppCard>
                <div style={simpleFormFieldsStyle}>
                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Edificio</span>
                    <AppSelect
                      {...createForm.register("buildingId", {
                        onChange: () => createForm.setValue("unitId", ""),
                      })}
                    >
                      <option value="">Selecciona un edificio</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name}
                        </option>
                      ))}
                    </AppSelect>
                    {createForm.formState.errors.buildingId ? (
                      <p style={paymentErrorTextStyle}>
                        {createForm.formState.errors.buildingId.message}
                      </p>
                    ) : null}
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Aplica a</span>
                    <AppSelect
                      {...createForm.register("appliesTo", {
                        onChange: (event) => {
                          if (event.target.value === "building") {
                            createForm.setValue("unitId", "");
                          }
                        },
                      })}
                    >
                      <option value="building">Edificio</option>
                      <option value="unit">Unidad</option>
                    </AppSelect>
                  </label>

                  {createAppliesTo === "unit" ? (
                    <label style={fieldWrapStyle}>
                      <span style={fieldLabelStyle}>Unidad</span>
                      <AppSelect {...createForm.register("unitId")}>
                        <option value="">Selecciona una unidad</option>
                        {unitsForSelectedBuilding.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.display_code || unit.unit_number || "Unidad"}
                          </option>
                        ))}
                      </AppSelect>
                      {createForm.formState.errors.unitId ? (
                        <p style={paymentErrorTextStyle}>
                          {createForm.formState.errors.unitId.message}
                        </p>
                      ) : null}
                    </label>
                  ) : null}

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Tipo de servicio</span>
                    <AppSelect {...createForm.register("expenseType")}>
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
                      {...createForm.register("title")}
                      placeholder="Ej. CFE, Agua y Drenaje, Telmex"
                      style={inputStyle}
                    />
                    {createForm.formState.errors.title ? (
                      <p style={paymentErrorTextStyle}>
                        {createForm.formState.errors.title.message}
                      </p>
                    ) : null}
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Proveedor</span>
                    <input
                      {...createForm.register("vendorName")}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>
                      {getIdentifierLabel(createForm.watch("expenseType"))}
                    </span>
                    <input
                      {...createForm.register("serviceIdentifier")}
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
                    <AppSelect {...createForm.register("frequencyType")}>
                      <option value="monthly">Mensual</option>
                      <option value="bimonthly">Bimestral</option>
                    </AppSelect>
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Quién paga</span>
                    <AppSelect {...createForm.register("responsibilityType")}>
                      <option value="company">Empresa</option>
                      <option value="building">Edificio</option>
                    </AppSelect>
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Fecha límite de pago</span>
                    <input
                      type="date"
                      {...createForm.register("dueDate")}
                      style={inputStyle}
                    />
                    {createForm.formState.errors.dueDate ? (
                      <p style={paymentErrorTextStyle}>
                        {createForm.formState.errors.dueDate.message}
                      </p>
                    ) : null}
                  </label>

                  <div style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Fecha de corte</span>
                    <div style={readonlyFieldStyle}>
                      {createForm.watch("dueDate")
                        ? formatDate(getCutoffDateFromDueDate(createForm.watch("dueDate")))
                        : "Sin fecha"}
                    </div>
                  </div>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Periodo facturado</span>
                    <input
                      {...createForm.register("billedPeriodLabel")}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Periodo de consumo</span>
                    <input
                      {...createForm.register("consumptionPeriodLabel")}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Mes facturado</span>
                    <input
                      {...createForm.register("billedMonthLabel")}
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
                      {...createForm.register("amountEstimated")}
                      placeholder="0"
                      style={inputStyle}
                    />
                    {createForm.formState.errors.amountEstimated ? (
                      <p style={paymentErrorTextStyle}>
                        {createForm.formState.errors.amountEstimated.message}
                      </p>
                    ) : null}
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Monto real</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      {...createForm.register("amountDue")}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      {...createForm.register("autoGenerate")}
                    />
                    <span style={fieldLabelStyle}>Generar automáticamente próximos periodos</span>
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Referencia de pago</span>
                    <input
                      {...createForm.register("paymentReference")}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldWrapStyle}>
                    <span style={fieldLabelStyle}>Notas / comentarios</span>
                    <textarea
                      {...createForm.register("notes")}
                      rows={4}
                      placeholder="Opcional"
                      style={textareaStyle}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <UiButton
                      type="submit"
                      icon={createForm.formState.isSubmitting ? <Save size={16} /> : <Plus size={16} />}
                    >
                      {createForm.formState.isSubmitting ? "Guardando..." : "Crear pago"}
                    </UiButton>

                    <UiButton onClick={() => ensureCurrentPeriodPayments()} icon={<RotateCw size={16} />}>
                      {syncingCurrentPeriod ? "Generando..." : "Generar periodo actual"}
                    </UiButton>
                  </div>
                </div>
              </AppCard>
            </form>
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
                <col style={{ width: "22%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>

              <thead>
                <tr>
                  <th style={thStyle}>Concepto</th>
                  <th style={thStyle}>Edificio</th>
                  <th style={thStyle}>Periodo / frecuencia</th>
                  <th style={thStyle}>Fecha límite</th>
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
                  const buildingIdx = buildings.findIndex(b => b.id === row.buildingId);
                  const buildingColor = BUILDING_COLORS[buildingIdx >= 0 ? buildingIdx % BUILDING_COLORS.length : 0];

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
                                border: "none",
                                boxShadow: "none",
                              }}
                            >
                              {serviceVisual.icon}
                            </div>

                            <div style={{ width:3, height:32, borderRadius:2, background:buildingColor, flexShrink:0 }} />

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
                          <div style={{ position: "relative", display: "inline-block" }}>
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
                            {revertConfirmId === row.id ? (
                              <div style={{
                                position: "absolute",
                                top: "calc(100% + 6px)",
                                right: 0,
                                zIndex: 10,
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 12,
                                padding: "10px 14px",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                minWidth: 180,
                                whiteSpace: "nowrap",
                              }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                  ¿Revertir pago?
                                </span>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void handleConfirmRevert(row); }}
                                    style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid #FECACA", background: "var(--badge-bg-red)", color: "var(--badge-text-red)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                  >
                                    Sí, revertir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setRevertConfirmId(null); }}
                                    style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>

                      {isOpen ? (
                        <tr>
                          <td colSpan={6} style={{ ...tdStyle, paddingTop: 0, verticalAlign: "top" }}>
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
                                  Archivar
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
          if (!editForm.formState.isSubmitting) {
            setIsEditModalOpen(false);
            setEditingIds(null);
          }
        }}
      >
        {editingIds ? (
          <form onSubmit={handleSaveEditedPayment} style={{ display: "grid", gap: 16 }}>
            <div style={simpleFormGridStyle}>
              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Edificio</span>
                <AppSelect
                  {...editForm.register("buildingId", {
                    onChange: () => editForm.setValue("unitId", ""),
                  })}
                >
                  <option value="">Selecciona un edificio</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </AppSelect>
                {editForm.formState.errors.buildingId ? (
                  <p style={paymentErrorTextStyle}>
                    {editForm.formState.errors.buildingId.message}
                  </p>
                ) : null}
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Aplica a</span>
                <AppSelect
                  {...editForm.register("appliesTo", {
                    onChange: (event) => {
                      if (event.target.value === "building") {
                        editForm.setValue("unitId", "");
                      }
                    },
                  })}
                >
                  <option value="building">Edificio</option>
                  <option value="unit">Unidad</option>
                </AppSelect>
              </label>

              {editAppliesTo === "unit" ? (
                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>Unidad</span>
                  <AppSelect {...editForm.register("unitId")}>
                    <option value="">Selecciona una unidad</option>
                    {unitsForEditingBuilding.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.display_code || unit.unit_number || "Unidad"}
                      </option>
                    ))}
                  </AppSelect>
                  {editForm.formState.errors.unitId ? (
                    <p style={paymentErrorTextStyle}>
                      {editForm.formState.errors.unitId.message}
                    </p>
                  ) : null}
                </label>
              ) : null}

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Tipo de servicio</span>
                <AppSelect {...editForm.register("expenseType")}>
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
                <input {...editForm.register("title")} style={inputStyle} />
                {editForm.formState.errors.title ? (
                  <p style={paymentErrorTextStyle}>
                    {editForm.formState.errors.title.message}
                  </p>
                ) : null}
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Proveedor</span>
                <input {...editForm.register("vendorName")} style={inputStyle} />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>{getIdentifierLabel(editForm.watch("expenseType"))}</span>
                <input {...editForm.register("serviceIdentifier")} style={inputStyle} />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Frecuencia</span>
                <AppSelect {...editForm.register("frequencyType")}>
                  <option value="monthly">Mensual</option>
                  <option value="bimonthly">Bimestral</option>
                </AppSelect>
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Quién paga</span>
                <AppSelect {...editForm.register("responsibilityType")}>
                  <option value="company">Empresa</option>
                  <option value="building">Edificio</option>
                </AppSelect>
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Fecha límite de pago</span>
                <input type="date" {...editForm.register("dueDate")} style={inputStyle} />
                {editForm.formState.errors.dueDate ? (
                  <p style={paymentErrorTextStyle}>
                    {editForm.formState.errors.dueDate.message}
                  </p>
                ) : null}
              </label>

              <div style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Fecha de corte</span>
                <div style={readonlyFieldStyle}>
                  {editForm.watch("dueDate")
                    ? formatDate(getCutoffDateFromDueDate(editForm.watch("dueDate")))
                    : "Sin fecha"}
                </div>
              </div>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Periodo facturado</span>
                <input {...editForm.register("billedPeriodLabel")} style={inputStyle} />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Periodo de consumo</span>
                <input {...editForm.register("consumptionPeriodLabel")} style={inputStyle} />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Mes facturado</span>
                <input {...editForm.register("billedMonthLabel")} style={inputStyle} />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto estimado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...editForm.register("amountEstimated")}
                  style={inputStyle}
                />
                {editForm.formState.errors.amountEstimated ? (
                  <p style={paymentErrorTextStyle}>
                    {editForm.formState.errors.amountEstimated.message}
                  </p>
                ) : null}
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto real</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...editForm.register("amountDue")}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" {...editForm.register("autoGenerate")} />
                <span style={fieldLabelStyle}>Generar automáticamente próximos periodos</span>
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Referencia de pago</span>
                <input {...editForm.register("paymentReference")} style={inputStyle} />
              </label>
            </div>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Notas / comentarios</span>
              <textarea {...editForm.register("notes")} rows={4} style={textareaStyle} />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!editForm.formState.isSubmitting) {
                    setIsEditModalOpen(false);
                    setEditingIds(null);
                  }
                }}
                style={ghostButtonStyle}
              >
                Cancelar
              </button>

              <UiButton type="submit" icon={<Save size={16} />}>
                {editForm.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
              </UiButton>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTargetRow)}
        title="Archivar pago"
        subtitle="Esta acción archivará la configuración recurrente y sus periodos asociados."
        onClose={() => {
          if (!deletingScheduleId) setDeleteTargetRow(null);
        }}
      >
        {deleteTargetRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "var(--metric-bg-amber)",
                border: "1px solid #FED7AA",
                color: "var(--badge-text-amber)",
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              ¿Archivar el pago{" "}
              <strong>{deleteTargetRow.title}</strong>? Dejará de aparecer en el
              módulo de pagos y también se archivarán sus periodos relacionados.
              Esta acción conservará toda su información.
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
                  ? "Archivando..."
                  : "Archivar pago"}
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
  background: "var(--badge-bg-red)",
  color: "var(--badge-text-red)",
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
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const filterReadonlyStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card-hover)",
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--text-secondary)",
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
  color: "var(--text-secondary)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  paddingInline: 12,
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  padding: 12,
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
  resize: "vertical",
};

const readonlyFieldStyle: CSSProperties = {
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card-hover)",
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--text-primary)",
};

const ghostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text-primary)",
  cursor: "pointer",
};

const iconOnlyButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const emptyStateStyle: CSSProperties = {
  padding: "18px 16px",
  borderRadius: 14,
  border: "1px dashed #D1D5DB",
  background: "var(--bg-card-hover)",
  color: "var(--text-muted)",
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
  minWidth: 540,
};

const thStyle: CSSProperties = {
  padding: "14px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border-default)",
  background: "var(--bg-card-hover)",
  position: "sticky",
  top: 0,
};

const rowStyle: CSSProperties = {
  background: "var(--bg-card)",
};

const tdStyle: CSSProperties = {
  padding: "16px 14px",
  borderBottom: "1px solid #F3F4F6",
  verticalAlign: "middle",
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
  color: "var(--text-primary)",
};

const conceptSecondaryActionStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--badge-text-blue)",
  fontWeight: 600,
};

const cellPrimaryTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const cellSecondaryTextStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-placeholder)",
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
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-primary)",
  cursor: "pointer",
};

const tableDangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid var(--metric-border-red)",
  background: "var(--badge-bg-red)",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--badge-text-red)",
  cursor: "pointer",
};

const inlineDetailsCardStyle: CSSProperties = {
  marginTop: 2,
  marginBottom: 10,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card-hover)",
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
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailValueStyle: CSSProperties = {
  fontSize: 14,
  color: "var(--text-primary)",
  fontWeight: 600,
};

const notesBoxStyle: CSSProperties = {
  marginTop: 6,
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  padding: 12,
  fontSize: 13,
  color: "var(--text-secondary)",
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
  background: "var(--badge-bg-red)",
  border: "1px solid var(--metric-border-red)",
};

const deleteAlertIconWrapStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "var(--badge-bg-red)",
  color: "var(--badge-text-red)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const deleteAlertTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 700,
  color: "var(--badge-text-red)",
};

const deleteAlertTextStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--badge-text-red)",
  lineHeight: 1.5,
};

const deleteSummaryBoxStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card-hover)",
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
  background: "var(--badge-text-red)",
  color: "var(--bg-card)",
  fontWeight: 700,
  cursor: "pointer",
};