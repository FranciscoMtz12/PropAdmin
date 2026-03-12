"use client";

/*
  Calendario global del sistema.

  Esta versión integra:
  - Limpieza
  - Mantenimiento
  - Pagos administrativos
  - Cobranza

  Corrección aplicada:
  - La consulta a leases ahora es tolerante con el esquema real.
  - Ya no depende de columnas fijas como tenant_name o tenant_email.
  - Esto evita que se rompa toda la carga del calendario si leases cambia.
*/

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
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

type LeaseRow = Record<string, unknown>;

type CleaningBuildingSchedule = {
  id: string;
  building_id: string;
  cleaning_type: "exterior" | "common";
  day_of_week: string;
  time_block: "morning" | "afternoon";
};

type CleaningUnitSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  day_of_week: string;
  start_time: string;
  duration_hours: number;
  active: boolean;
};

type MaintenanceLog = {
  id: string;
  title: string;
  log_type: string | null;
  performed_at: string | null;
  next_due_at: string | null;
  status: string;
  asset_name_snapshot: string | null;
  asset_type_snapshot: string | null;
  category_name_snapshot: string | null;
  building_id: string | null;
  unit_id: string | null;
  asset_id: string | null;
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

type CollectionSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  charge_type:
    | "rent"
    | "maintenance_fee"
    | "services"
    | "parking"
    | "penalty"
    | "other";
  title: string;
  responsibility_type: "tenant" | "owner" | "other";
  amount_expected: number;
  due_day: number;
  active: boolean;
  notes: string | null;
};

type CollectionRecord = {
  id: string;
  collection_schedule_id: string;
  company_id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: "pending" | "collected" | "overdue";
  collected_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

type CalendarEvent = {
  id: string;
  module: "cleaning" | "maintenance" | "payments" | "collections";
  recurrence: "recurring" | "dated";
  dayKey: string;
  isoDate: string;
  title: string;
  subtitle: string;
  colorBackground: string;
  colorBorder: string;
  colorText: string;
};

type WeekDayColumn = {
  key: string;
  label: string;
  shortDate: string;
  isoDate: string;
};

type ViewMode = "week" | "month" | "year";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const CLEANING_COLORS = {
  background: "#ECFDF5",
  border: "#A7F3D0",
  text: "#166534",
};

const MAINTENANCE_COLORS = {
  background: "#FFF7ED",
  border: "#FDBA74",
  text: "#9A3412",
};

const PAYMENTS_COLORS = {
  background: "#EFF6FF",
  border: "#93C5FD",
  text: "#1D4ED8",
};

const COLLECTIONS_COLORS = {
  background: "#FEFCE8",
  border: "#FDE68A",
  text: "#A16207",
};

function getStartOfWeek(date: Date) {
  const copy = new Date(date);
  const jsDay = copy.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatShortDate(date: Date) {
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()].slice(0, 3)}`;
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 5);

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} - ${end.getDate()} ${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${MONTH_LABELS[start.getMonth()]} - ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${start.getFullYear()}`;
  }

  return `${start.getDate()} ${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()} - ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${end.getFullYear()}`;
}

function formatMonthLabel(date: Date) {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatYearLabel(date: Date) {
  return `${date.getFullYear()}`;
}

function getDateOnlyKey(dateValue: string | null) {
  if (!dateValue) return "";
  return dateValue.slice(0, 10);
}

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDayKeyFromDateValue(dateValue: string | null) {
  const dateKey = getDateOnlyKey(dateValue);
  if (!dateKey) return "";

  const date = parseDateOnly(dateKey);
  const jsDay = date.getDay();

  if (jsDay === 0) return "sunday";
  if (jsDay === 1) return "monday";
  if (jsDay === 2) return "tuesday";
  if (jsDay === 3) return "wednesday";
  if (jsDay === 4) return "thursday";
  if (jsDay === 5) return "friday";
  return "saturday";
}

function dateToIsoKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(timeValue: string | null) {
  if (!timeValue) return "Sin hora";
  const parts = timeValue.split(":");
  if (parts.length < 2) return timeValue;
  return `${parts[0]}:${parts[1]}`;
}

function formatDuration(duration: number | null) {
  if (!duration) return "Sin duración";
  return `${duration} h`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function pickFirstString(row: LeaseRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getLeaseId(row: LeaseRow) {
  const value = row["id"];
  return typeof value === "string" ? value : "";
}

function getLeaseUnitId(row: LeaseRow) {
  const value = row["unit_id"];
  return typeof value === "string" ? value : "";
}

function getLeaseDisplayLabel(row: LeaseRow) {
  const name = pickFirstString(row, [
    "tenant_name",
    "tenant_full_name",
    "resident_name",
    "primary_tenant_name",
    "full_name",
    "name",
  ]);

  if (name) return name;

  const email = pickFirstString(row, [
    "tenant_email",
    "resident_email",
    "email",
  ]);

  if (email) return email;

  return "Sin inquilino";
}

function renderViewTab(
  label: string,
  active: boolean,
  onClick: () => void
) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        padding: "6px 12px",
        background: active ? "#EEF2FF" : "#F3F4F6",
        color: active ? "#4338CA" : "#374151",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function renderModuleToggle(
  label: string,
  active: boolean,
  onClick: () => void,
  colors: { background: string; border: string; text: string }
) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        padding: "8px 12px",
        background: active ? colors.background : "#FFFFFF",
        color: colors.text,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: colors.text,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  );
}

export default function CalendarPage() {
  const { user, loading } = useCurrentUser();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [buildingSchedules, setBuildingSchedules] = useState<CleaningBuildingSchedule[]>([]);
  const [unitSchedules, setUnitSchedules] = useState<CleaningUnitSchedule[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [expenseSchedules, setExpenseSchedules] = useState<ExpenseSchedule[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);

  const [loadingPage, setLoadingPage] = useState(true);
  const [msg, setMsg] = useState("");

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [referenceDate, setReferenceDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [showCleaning, setShowCleaning] = useState(true);
  const [showMaintenance, setShowMaintenance] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  const [showCollections, setShowCollections] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    loadCalendarData();
  }, [loading, user?.company_id]);

  async function loadCalendarData() {
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMsg("");

    const [
      buildingsRes,
      unitsRes,
      leasesRes,
      buildingSchedulesRes,
      unitSchedulesRes,
      maintenanceLogsRes,
      expenseSchedulesRes,
      expensePaymentsRes,
      collectionSchedulesRes,
      collectionRecordsRes,
    ] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .order("name", { ascending: true }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id),

      /*
        Consulta tolerante:
        leases puede no tener tenant_name / tenant_email exactos.
        Por eso usamos select("*") y luego inferimos.
      */
      supabase
        .from("leases")
        .select("*")
        .eq("company_id", user.company_id),

      supabase
        .from("cleaning_building_schedules")
        .select("id, building_id, cleaning_type, day_of_week, time_block")
        .eq("company_id", user.company_id),

      supabase
        .from("cleaning_unit_schedules")
        .select("id, building_id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("company_id", user.company_id)
        .eq("active", true),

      supabase
        .from("maintenance_logs")
        .select(
          "id, title, log_type, performed_at, next_due_at, status, asset_name_snapshot, asset_type_snapshot, category_name_snapshot, building_id, unit_id, asset_id"
        )
        .eq("company_id", user.company_id)
        .order("created_at", { ascending: false }),

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

      supabase
        .from("collection_schedules")
        .select(
          "id, building_id, unit_id, lease_id, charge_type, title, responsibility_type, amount_expected, due_day, active, notes"
        )
        .eq("company_id", user.company_id)
        .eq("active", true),

      supabase
        .from("collection_records")
        .select(
          "id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, payment_method, notes, created_at"
        )
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true }),
    ]);

    if (buildingsRes.error) {
      setMsg("No se pudieron cargar los edificios.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMsg("No se pudieron cargar las unidades.");
      setLoadingPage(false);
      return;
    }

    if (leasesRes.error) {
      setMsg("No se pudieron cargar los contratos.");
      setLoadingPage(false);
      return;
    }

    if (buildingSchedulesRes.error) {
      setMsg("No se pudo cargar la programación de limpieza del edificio.");
      setLoadingPage(false);
      return;
    }

    if (unitSchedulesRes.error) {
      setMsg("No se pudo cargar la programación interior de limpieza.");
      setLoadingPage(false);
      return;
    }

    if (maintenanceLogsRes.error) {
      setMsg("No se pudieron cargar los registros de mantenimiento.");
      setLoadingPage(false);
      return;
    }

    if (expenseSchedulesRes.error) {
      setMsg("No se pudieron cargar las configuraciones de pagos.");
      setLoadingPage(false);
      return;
    }

    if (expensePaymentsRes.error) {
      setMsg("No se pudieron cargar los registros de pagos.");
      setLoadingPage(false);
      return;
    }

    if (collectionSchedulesRes.error) {
      setMsg("No se pudieron cargar las configuraciones de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (collectionRecordsRes.error) {
      setMsg("No se pudieron cargar los registros de cobranza.");
      setLoadingPage(false);
      return;
    }

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setLeases((leasesRes.data as LeaseRow[]) || []);
    setBuildingSchedules((buildingSchedulesRes.data as CleaningBuildingSchedule[]) || []);
    setUnitSchedules((unitSchedulesRes.data as CleaningUnitSchedule[]) || []);
    setMaintenanceLogs((maintenanceLogsRes.data as MaintenanceLog[]) || []);
    setExpenseSchedules((expenseSchedulesRes.data as ExpenseSchedule[]) || []);
    setExpensePayments((expensePaymentsRes.data as ExpensePayment[]) || []);
    setCollectionSchedules((collectionSchedulesRes.data as CollectionSchedule[]) || []);
    setCollectionRecords((collectionRecordsRes.data as CollectionRecord[]) || []);
    setLoadingPage(false);
  }

  const weekStart = useMemo(() => getStartOfWeek(referenceDate), [referenceDate]);

  const weekDays = useMemo<WeekDayColumn[]>(() => {
    return DAY_ORDER.map((dayKey, index) => {
      const date = addDays(weekStart, index);

      return {
        key: dayKey,
        label: DAY_LABELS[dayKey],
        shortDate: formatShortDate(date),
        isoDate: dateToIsoKey(date),
      };
    });
  }, [weekStart]);

  const allEvents = useMemo<CalendarEvent[]>(() => {
    const buildingMap = new Map<string, Building>();
    const unitMap = new Map<string, Unit>();
    const leaseMap = new Map<string, LeaseRow>();
    const expenseScheduleMap = new Map<string, ExpenseSchedule>();
    const collectionScheduleMap = new Map<string, CollectionSchedule>();

    buildings.forEach((building) => buildingMap.set(building.id, building));
    units.forEach((unit) => unitMap.set(unit.id, unit));
    leases.forEach((lease) => {
      const leaseId = getLeaseId(lease);
      if (leaseId) leaseMap.set(leaseId, lease);
    });
    expenseSchedules.forEach((schedule) => expenseScheduleMap.set(schedule.id, schedule));
    collectionSchedules.forEach((schedule) => collectionScheduleMap.set(schedule.id, schedule));

    const filteredBuildingSchedules =
      selectedBuildingId === "all"
        ? buildingSchedules
        : buildingSchedules.filter((item) => item.building_id === selectedBuildingId);

    const filteredUnitSchedules =
      selectedBuildingId === "all"
        ? unitSchedules
        : unitSchedules.filter((item) => item.building_id === selectedBuildingId);

    const filteredMaintenanceLogs =
      selectedBuildingId === "all"
        ? maintenanceLogs
        : maintenanceLogs.filter((item) => item.building_id === selectedBuildingId);

    const filteredExpensePayments =
      selectedBuildingId === "all"
        ? expensePayments
        : expensePayments.filter((item) => item.building_id === selectedBuildingId);

    const filteredCollectionRecords =
      selectedBuildingId === "all"
        ? collectionRecords
        : collectionRecords.filter((item) => item.building_id === selectedBuildingId);

    const buildingEvents: CalendarEvent[] = filteredBuildingSchedules
      .filter((schedule) => schedule.day_of_week !== "sunday")
      .map((schedule) => {
        const building = buildingMap.get(schedule.building_id);
        const buildingName = building?.name || "Edificio";
        const typeLabel =
          schedule.cleaning_type === "exterior" ? "Exterior" : "Áreas comunes";
        const blockLabel =
          schedule.time_block === "morning" ? "Mañana" : "Tarde";

        return {
          id: `building-${schedule.id}`,
          module: "cleaning",
          recurrence: "recurring",
          dayKey: schedule.day_of_week,
          isoDate: "",
          title: `${buildingName} · ${typeLabel}`,
          subtitle: blockLabel,
          colorBackground: CLEANING_COLORS.background,
          colorBorder: CLEANING_COLORS.border,
          colorText: CLEANING_COLORS.text,
        };
      });

    const unitEvents: CalendarEvent[] = filteredUnitSchedules
      .filter((schedule) => schedule.day_of_week !== "sunday")
      .map((schedule) => {
        const building = buildingMap.get(schedule.building_id);
        const unit = unitMap.get(schedule.unit_id);

        const buildingName = building?.name || "Edificio";
        const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";

        return {
          id: `unit-${schedule.id}`,
          module: "cleaning",
          recurrence: "recurring",
          dayKey: schedule.day_of_week,
          isoDate: "",
          title: `${buildingName} · Unidad ${unitLabel}`,
          subtitle: `${formatTime(schedule.start_time)} · ${formatDuration(schedule.duration_hours)}`,
          colorBackground: CLEANING_COLORS.background,
          colorBorder: CLEANING_COLORS.border,
          colorText: CLEANING_COLORS.text,
        };
      });

    const maintenanceEvents: CalendarEvent[] = [];

    filteredMaintenanceLogs.forEach((log) => {
      const building = log.building_id ? buildingMap.get(log.building_id) : null;
      const unit = log.unit_id ? unitMap.get(log.unit_id) : null;

      const buildingName = building?.name || "Edificio";
      const unitLabel = unit?.display_code || unit?.unit_number || "General";

      const baseTitle =
        log.title?.trim() ||
        log.asset_name_snapshot?.trim() ||
        "Mantenimiento";

      const subtitleParts = [
        buildingName,
        `Unidad ${unitLabel}`,
        log.category_name_snapshot || log.asset_type_snapshot || log.log_type || log.status,
      ].filter(Boolean);

      const performedDateKey = getDateOnlyKey(log.performed_at);
      if (performedDateKey) {
        const performedDayKey = getDayKeyFromDateValue(performedDateKey);

        if (performedDayKey !== "sunday") {
          maintenanceEvents.push({
            id: `maintenance-done-${log.id}`,
            module: "maintenance",
            recurrence: "dated",
            dayKey: performedDayKey,
            isoDate: performedDateKey,
            title: `${baseTitle} · Realizado`,
            subtitle: subtitleParts.join(" · "),
            colorBackground: MAINTENANCE_COLORS.background,
            colorBorder: MAINTENANCE_COLORS.border,
            colorText: MAINTENANCE_COLORS.text,
          });
        }
      }

      const nextDueDateKey = getDateOnlyKey(log.next_due_at);
      if (nextDueDateKey) {
        const nextDueDayKey = getDayKeyFromDateValue(nextDueDateKey);

        if (nextDueDayKey !== "sunday") {
          maintenanceEvents.push({
            id: `maintenance-next-${log.id}`,
            module: "maintenance",
            recurrence: "dated",
            dayKey: nextDueDayKey,
            isoDate: nextDueDateKey,
            title: `${baseTitle} · Programado`,
            subtitle: subtitleParts.join(" · "),
            colorBackground: MAINTENANCE_COLORS.background,
            colorBorder: MAINTENANCE_COLORS.border,
            colorText: MAINTENANCE_COLORS.text,
          });
        }
      }
    });

    const paymentEvents: CalendarEvent[] = [];

    filteredExpensePayments.forEach((payment) => {
      const schedule = expenseScheduleMap.get(payment.expense_schedule_id);
      if (!schedule) return;
      if (schedule.responsibility_type === "tenant") return;

      const dueDateKey = getDateOnlyKey(payment.due_date);
      const dueDayKey = getDayKeyFromDateValue(dueDateKey);
      if (!dueDateKey || dueDayKey === "sunday") return;

      const building =
        buildingMap.get(payment.building_id) || buildingMap.get(schedule.building_id);
      const unit =
        (payment.unit_id ? unitMap.get(payment.unit_id) : null) ||
        (schedule.unit_id ? unitMap.get(schedule.unit_id) : null);

      const buildingName = building?.name || "Edificio";
      const unitLabel = unit?.display_code || unit?.unit_number || "General";
      const scopeLabel =
        schedule.applies_to === "unit" ? `Unidad ${unitLabel}` : "Todo el edificio";
      const amountLabel = formatCurrency(payment.amount_due);

      let statusLabel = "Pendiente";
      if (payment.status === "paid") statusLabel = "Pagado";
      if (payment.status === "overdue") statusLabel = "Vencido";

      paymentEvents.push({
        id: `payment-${payment.id}`,
        module: "payments",
        recurrence: "dated",
        dayKey: dueDayKey,
        isoDate: dueDateKey,
        title: `${schedule.title} · ${statusLabel}`,
        subtitle: `${buildingName} · ${scopeLabel} · ${amountLabel}`,
        colorBackground: PAYMENTS_COLORS.background,
        colorBorder: PAYMENTS_COLORS.border,
        colorText: PAYMENTS_COLORS.text,
      });
    });

    const collectionEvents: CalendarEvent[] = [];

    filteredCollectionRecords.forEach((record) => {
      const schedule = collectionScheduleMap.get(record.collection_schedule_id);
      if (!schedule) return;

      const dueDateKey = getDateOnlyKey(record.due_date);
      const dueDayKey = getDayKeyFromDateValue(dueDateKey);
      if (!dueDateKey || dueDayKey === "sunday") return;

      const building =
        buildingMap.get(record.building_id) || buildingMap.get(schedule.building_id);
      const unit =
        unitMap.get(record.unit_id) || unitMap.get(schedule.unit_id);

      const lease =
        (record.lease_id ? leaseMap.get(record.lease_id) : null) ||
        (schedule.lease_id ? leaseMap.get(schedule.lease_id) : null);

      const buildingName = building?.name || "Edificio";
      const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";
      const tenantLabel = lease ? getLeaseDisplayLabel(lease) : "Sin inquilino";
      const amountLabel = formatCurrency(record.amount_due);

      let statusLabel = "Pendiente";
      if (record.status === "collected") statusLabel = "Cobrado";
      if (record.status === "overdue") statusLabel = "Vencido";

      collectionEvents.push({
        id: `collection-${record.id}`,
        module: "collections",
        recurrence: "dated",
        dayKey: dueDayKey,
        isoDate: dueDateKey,
        title: `${schedule.title} · ${statusLabel}`,
        subtitle: `${buildingName} · Unidad ${unitLabel} · ${tenantLabel} · ${amountLabel}`,
        colorBackground: COLLECTIONS_COLORS.background,
        colorBorder: COLLECTIONS_COLORS.border,
        colorText: COLLECTIONS_COLORS.text,
      });
    });

    return [
      ...buildingEvents,
      ...unitEvents,
      ...maintenanceEvents,
      ...paymentEvents,
      ...collectionEvents,
    ].sort((a, b) => {
      if (a.module !== b.module) return a.module.localeCompare(b.module);
      return a.title.localeCompare(b.title);
    });
  }, [
    buildings,
    units,
    leases,
    buildingSchedules,
    unitSchedules,
    maintenanceLogs,
    expenseSchedules,
    expensePayments,
    collectionSchedules,
    collectionRecords,
    selectedBuildingId,
  ]);

  const events = useMemo(() => {
    return allEvents.filter((event) => {
      if (event.module === "cleaning" && !showCleaning) return false;
      if (event.module === "maintenance" && !showMaintenance) return false;
      if (event.module === "payments" && !showPayments) return false;
      if (event.module === "collections" && !showCollections) return false;
      return true;
    });
  }, [
    allEvents,
    showCleaning,
    showMaintenance,
    showPayments,
    showCollections,
  ]);

  const getEventsForDate = useMemo(() => {
    return (isoDate: string) => {
      const dayKey = getDayKeyFromDateValue(isoDate);

      return events
        .filter((event) => {
          if (event.recurrence === "recurring") {
            return event.dayKey === dayKey;
          }

          return event.isoDate === isoDate;
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    };
  }, [events]);

  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    weekDays.forEach((day) => {
      map.set(day.key, getEventsForDate(day.isoDate));
    });

    return map;
  }, [weekDays, getEventsForDate]);

  const monthDays = useMemo(() => {
    const monthStart = getStartOfMonth(referenceDate);
    const monthEnd = getEndOfMonth(referenceDate);

    const days: { isoDate: string; label: string; dayNumber: number }[] = [];
    let cursor = new Date(monthStart);

    while (cursor <= monthEnd) {
      const isoDate = dateToIsoKey(cursor);
      const dayKey = getDayKeyFromDateValue(isoDate);

      if (dayKey !== "sunday") {
        days.push({
          isoDate,
          label: DAY_LABELS[dayKey],
          dayNumber: cursor.getDate(),
        });
      }

      cursor = addDays(cursor, 1);
    }

    return days;
  }, [referenceDate]);

  const monthEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    monthDays.forEach((day) => {
      map.set(day.isoDate, getEventsForDate(day.isoDate));
    });

    return map;
  }, [monthDays, getEventsForDate]);

  const yearSummary = useMemo(() => {
    const targetYear = referenceDate.getFullYear();

    return MONTH_LABELS.map((monthLabel, monthIndex) => {
      const monthDaysCount = new Date(targetYear, monthIndex + 1, 0).getDate();

      let total = 0;
      let cleaningTotal = 0;
      let maintenanceTotal = 0;
      let paymentsTotal = 0;
      let collectionsTotal = 0;

      for (let day = 1; day <= monthDaysCount; day += 1) {
        const isoDate = dateToIsoKey(new Date(targetYear, monthIndex, day));
        const dayKey = getDayKeyFromDateValue(isoDate);

        if (dayKey === "sunday") continue;

        const dayEvents = getEventsForDate(isoDate);

        total += dayEvents.length;
        cleaningTotal += dayEvents.filter((event) => event.module === "cleaning").length;
        maintenanceTotal += dayEvents.filter((event) => event.module === "maintenance").length;
        paymentsTotal += dayEvents.filter((event) => event.module === "payments").length;
        collectionsTotal += dayEvents.filter((event) => event.module === "collections").length;
      }

      return {
        monthLabel,
        total,
        cleaningTotal,
        maintenanceTotal,
        paymentsTotal,
        collectionsTotal,
      };
    });
  }, [referenceDate, getEventsForDate]);

  const totalCleaningEvents = useMemo(() => {
    return events.filter((event) => event.module === "cleaning").length;
  }, [events]);

  const totalMaintenanceEvents = useMemo(() => {
    return events.filter((event) => event.module === "maintenance").length;
  }, [events]);

  const totalPaymentsEvents = useMemo(() => {
    return events.filter((event) => event.module === "payments").length;
  }, [events]);

  const totalCollectionsEvents = useMemo(() => {
    return events.filter((event) => event.module === "collections").length;
  }, [events]);

  const selectedBuildingName =
    selectedBuildingId === "all"
      ? "Todos los edificios"
      : buildings.find((b) => b.id === selectedBuildingId)?.name || "Edificio";

  function goPrevious() {
    if (viewMode === "week") {
      setReferenceDate((prev) => addDays(prev, -7));
      return;
    }

    if (viewMode === "month") {
      setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      return;
    }

    setReferenceDate((prev) => new Date(prev.getFullYear() - 1, 0, 1));
  }

  function goCurrent() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setReferenceDate(today);
  }

  function goNext() {
    if (viewMode === "week") {
      setReferenceDate((prev) => addDays(prev, 7));
      return;
    }

    if (viewMode === "month") {
      setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      return;
    }

    setReferenceDate((prev) => new Date(prev.getFullYear() + 1, 0, 1));
  }

  const currentLabel =
    viewMode === "week"
      ? formatWeekRange(weekStart)
      : viewMode === "month"
      ? formatMonthLabel(referenceDate)
      : formatYearLabel(referenceDate);

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>
          Cargando calendario...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Calendario"
        subtitle="Vista general del sistema para organizar limpieza, mantenimiento, pagos y cobranza."
        titleIcon={<CalendarDays size={18} />}
      />

      {msg ? (
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
          {msg}
        </div>
      ) : null}

      <AppGrid minWidth={220}>
        <MetricCard
          label="Vista activa"
          value={
            viewMode === "week"
              ? "Semana"
              : viewMode === "month"
              ? "Mes"
              : "Año"
          }
          helper={currentLabel}
          icon={<CalendarDays size={18} />}
        />
        <MetricCard
          label="Limpieza"
          value={String(totalCleaningEvents)}
          helper={selectedBuildingName}
          icon={<Sparkles size={18} />}
        />
        <MetricCard
          label="Mantenimiento"
          value={String(totalMaintenanceEvents)}
          helper={selectedBuildingName}
          icon={<Wrench size={18} />}
        />
        <MetricCard
          label="Pagos"
          value={String(totalPaymentsEvents)}
          helper={selectedBuildingName}
          icon={<CreditCard size={18} />}
        />
        <MetricCard
          label="Cobranza"
          value={String(totalCollectionsEvents)}
          helper={selectedBuildingName}
          icon={<Wallet size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Calendario general"
        subtitle="Vista general de limpieza, mantenimiento, pagos y cobranza con seguimiento semanal, mensual y anual."
        icon={<CalendarDays size={18} />}
      >
        <AppCard>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {renderViewTab("Semana", viewMode === "week", () => setViewMode("week"))}
                {renderViewTab("Mes", viewMode === "month", () => setViewMode("month"))}
                {renderViewTab("Año", viewMode === "year", () => setViewMode("year"))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <UiButton onClick={goPrevious} icon={<ChevronLeft size={16} />}>
                  {viewMode === "week"
                    ? "Semana anterior"
                    : viewMode === "month"
                    ? "Mes anterior"
                    : "Año anterior"}
                </UiButton>

                <UiButton onClick={goCurrent}>
                  {viewMode === "week"
                    ? "Semana actual"
                    : viewMode === "month"
                    ? "Mes actual"
                    : "Año actual"}
                </UiButton>

                <UiButton onClick={goNext} icon={<ChevronRight size={16} />}>
                  {viewMode === "week"
                    ? "Semana siguiente"
                    : viewMode === "month"
                    ? "Mes siguiente"
                    : "Año siguiente"}
                </UiButton>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
              }}
            >
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
                Edificio
              </div>

              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                style={{
                  minWidth: 240,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  color: "#111827",
                  fontSize: 14,
                }}
              >
                <option value="all">Todos los edificios</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
              }}
            >
              {renderModuleToggle(
                "Limpieza",
                showCleaning,
                () => setShowCleaning((prev) => !prev),
                CLEANING_COLORS
              )}

              {renderModuleToggle(
                "Mantenimiento",
                showMaintenance,
                () => setShowMaintenance((prev) => !prev),
                MAINTENANCE_COLORS
              )}

              {renderModuleToggle(
                "Pagos",
                showPayments,
                () => setShowPayments((prev) => !prev),
                PAYMENTS_COLORS
              )}

              {renderModuleToggle(
                "Cobranza",
                showCollections,
                () => setShowCollections((prev) => !prev),
                COLLECTIONS_COLORS
              )}
            </div>

            {viewMode === "week" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                {weekDays.map((day) => {
                  const dayEvents = weekEventsByDay.get(day.key) || [];

                  return (
                    <div
                      key={day.key}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 16,
                        padding: 14,
                        background: "#FFFFFF",
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                        minHeight: 280,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#111827",
                          }}
                        >
                          {day.label}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#6B7280",
                          }}
                        >
                          {day.shortDate}
                        </div>
                      </div>

                      {dayEvents.length === 0 ? (
                        <div
                          style={{
                            borderRadius: 12,
                            padding: "10px 10px",
                            background: "#F9FAFB",
                            border: "1px dashed #D1D5DB",
                            fontSize: 12,
                            color: "#6B7280",
                            fontWeight: 600,
                          }}
                        >
                          Sin eventos
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {dayEvents.map((event) => (
                            <div
                              key={`${event.id}-${day.isoDate}`}
                              style={{
                                borderRadius: 12,
                                padding: "10px 10px",
                                background: event.colorBackground,
                                border: `1px solid ${event.colorBorder}`,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: event.colorText,
                                  lineHeight: 1.35,
                                }}
                              >
                                {event.title}
                              </span>

                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: event.colorText,
                                  opacity: 0.9,
                                  lineHeight: 1.35,
                                }}
                              >
                                {event.subtitle}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {viewMode === "month" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                {monthDays.map((day) => {
                  const dayEvents = monthEventsByDate.get(day.isoDate) || [];
                  const visibleEvents = dayEvents.slice(0, 3);

                  return (
                    <div
                      key={day.isoDate}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 16,
                        padding: 12,
                        background: "#FFFFFF",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        minHeight: 170,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#111827",
                        }}
                      >
                        {day.dayNumber} · {day.label}
                      </div>

                      {dayEvents.length === 0 ? (
                        <div
                          style={{
                            borderRadius: 10,
                            padding: "8px 8px",
                            background: "#F9FAFB",
                            border: "1px dashed #D1D5DB",
                            fontSize: 11,
                            color: "#6B7280",
                            fontWeight: 600,
                          }}
                        >
                          Sin eventos
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {visibleEvents.map((event) => (
                            <div
                              key={`${event.id}-${day.isoDate}`}
                              style={{
                                borderRadius: 10,
                                padding: "8px 8px",
                                background: event.colorBackground,
                                border: `1px solid ${event.colorBorder}`,
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: event.colorText,
                                  lineHeight: 1.3,
                                }}
                              >
                                {event.title}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: event.colorText,
                                  opacity: 0.9,
                                  lineHeight: 1.3,
                                }}
                              >
                                {event.subtitle}
                              </span>
                            </div>
                          ))}

                          {dayEvents.length > 3 ? (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: "#6B7280",
                              }}
                            >
                              + {dayEvents.length - 3} más
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {viewMode === "year" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                {yearSummary.map((month) => (
                  <div
                    key={month.monthLabel}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 16,
                      padding: 14,
                      background: "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      minHeight: 150,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#111827",
                      }}
                    >
                      {month.monthLabel}
                    </div>

                    <div
                      style={{
                        borderRadius: 10,
                        padding: "10px 10px",
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        Eventos: {month.total}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: CLEANING_COLORS.text,
                        }}
                      >
                        Limpieza: {month.cleaningTotal}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: MAINTENANCE_COLORS.text,
                        }}
                      >
                        Mantenimiento: {month.maintenanceTotal}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: PAYMENTS_COLORS.text,
                        }}
                      >
                        Pagos: {month.paymentsTotal}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: COLLECTIONS_COLORS.text,
                        }}
                      >
                        Cobranza: {month.collectionsTotal}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </AppCard>
      </SectionCard>

      <div style={{ height: 16 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#10B981",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Limpieza
            </span>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#F97316",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Mantenimiento
            </span>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#2563EB",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Pagos
            </span>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#EAB308",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Cobranza
            </span>
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
}