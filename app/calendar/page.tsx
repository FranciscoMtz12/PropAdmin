"use client";

/*
  Calendario global del sistema.

  Esta versión integra:
  - Limpieza interior de unidades / departamentos
  - Mantenimiento
  - Pagos administrativos
  - Cobranza

  Decisión funcional aplicada:
  - En el calendario global YA NO se muestran limpiezas de edificio
    como exterior o áreas comunes.
  - Aquí solo se muestran limpiezas internas de unidad / departamento
    para mantener la vista más concisa y enfocada en pendientes cambiantes.
  - Las limpiezas de edificio se siguen reservando para el módulo propio
    de Limpieza, donde sí tiene sentido verlas con más detalle.

  Otras mejoras activas:
  - Consulta de leases tolerante al esquema real.
  - Pagos reales + pagos proyectados.
  - Vista semanal y mensual con eventos compactos.
  - Hover tooltip.
  - Click para abrir modal de detalle.
  - El modal de detalle respeta colores por estado en pagos y cobranza.
  - El día actual en vista mensual se resalta visualmente.

  Mejora aplicada en esta versión:
  - En vista mensual, cuando hay más eventos de los visibles,
    el texto "+ X más" abre un popup por día.
  - Ese popup muestra todos los eventos del día con scroll.
  - Desde ese popup se puede abrir el detalle individual de cada evento.
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
import AppCard from "@/components/AppCard";
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

type ExpenseFrequencyType = "monthly" | "bimonthly";

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
  frequency_type: ExpenseFrequencyType | null;
  starts_on: string | null;
  ends_on: string | null;
  auto_generate: boolean | null;
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

type EventDetailItem = {
  label: string;
  value: string;
};

type CalendarEvent = {
  id: string;
  module: "cleaning" | "maintenance" | "payments" | "collections";
  recurrence: "recurring" | "dated";
  dayKey: string;
  isoDate: string;
  title: string;
  compactLabel: string;
  subtitle: string;
  colorBackground: string;
  colorBorder: string;
  colorText: string;
  detailItems: EventDetailItem[];
};

type WeekDayColumn = {
  key: string;
  label: string;
  shortDate: string;
  isoDate: string;
};

type ViewMode = "week" | "month" | "year";

type HoveredEventState = {
  event: CalendarEvent;
  top: number;
  left: number;
};

type DayEventsModalState = {
  isoDate: string;
  label: string;
  events: CalendarEvent[];
};

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

const PAYMENTS_PROJECTED_COLORS = {
  background: "#F8FBFF",
  border: "#DBEAFE",
  text: "#3B82F6",
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

function formatFullDate(dateKey: string) {
  if (!dateKey) return "Sin fecha";
  const date = parseDateOnly(dateKey);
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
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

  const email = pickFirstString(row, ["tenant_email", "resident_email", "email"]);

  if (email) return email;

  return "Sin inquilino";
}

function getVisibleRange(referenceDate: Date, viewMode: ViewMode) {
  if (viewMode === "week") {
    const start = getStartOfWeek(referenceDate);
    const end = addDays(start, 5);
    return { start, end };
  }

  if (viewMode === "month") {
    return {
      start: getStartOfMonth(referenceDate),
      end: getEndOfMonth(referenceDate),
    };
  }

  return {
    start: new Date(referenceDate.getFullYear(), 0, 1),
    end: new Date(referenceDate.getFullYear(), 11, 31),
  };
}

function getLastDayOfMonth(year: number, monthOneBased: number) {
  return new Date(year, monthOneBased, 0).getDate();
}

function buildDueDateKey(year: number, monthOneBased: number, dueDay: number) {
  const safeDueDay = Math.max(1, Math.min(dueDay, getLastDayOfMonth(year, monthOneBased)));
  return `${year}-${String(monthOneBased).padStart(2, "0")}-${String(safeDueDay).padStart(2, "0")}`;
}

function getMonthListWithinRange(start: Date, end: Date) {
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endCursor) {
    months.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function isExpenseScheduleActiveForPeriod(
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

function getPaymentStatusLabel(status: ExpensePayment["status"]) {
  if (status === "paid") return "Pagado";
  if (status === "overdue") return "Vencido";
  return "Pendiente";
}

function getCollectionStatusLabel(status: CollectionRecord["status"]) {
  if (status === "collected") return "Cobrado";
  if (status === "overdue") return "Vencido";
  return "Pendiente";
}

function getEventIcon(event: CalendarEvent) {
  if (event.module === "cleaning") return <Sparkles size={11} />;
  if (event.module === "maintenance") return <Wrench size={11} />;
  if (event.module === "payments") return <CreditCard size={11} />;
  return <Wallet size={11} />;
}

const MODULE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  cleaning:    { bg: CLEANING_COLORS.background,    text: CLEANING_COLORS.text,    border: CLEANING_COLORS.border },
  maintenance: { bg: MAINTENANCE_COLORS.background, text: MAINTENANCE_COLORS.text, border: MAINTENANCE_COLORS.border },
  payments:    { bg: PAYMENTS_COLORS.background,    text: PAYMENTS_COLORS.text,    border: PAYMENTS_COLORS.border },
  collections: { bg: COLLECTIONS_COLORS.background, text: COLLECTIONS_COLORS.text, border: COLLECTIONS_COLORS.border },
  contratos:   { bg: "#fce7f3", text: "#db2777", border: "#db2777" },
};

function getModuleLabel(module: CalendarEvent["module"]) {
  if (module === "cleaning") return "Limpieza";
  if (module === "maintenance") return "Mantenimiento";
  if (module === "payments") return "Pagos";
  return "Cobranza";
}

function getStatusBadgeColors(module: CalendarEvent["module"], label: string, value: string) {
  if (module === "payments") {
    if (label === "Estado") {
      if (value === "Pagado") {
        return { background: "#ECFDF5", border: "#A7F3D0", text: "#166534" };
      }
      if (value === "Vencido") {
        return { background: "var(--badge-bg-red)", border: "#FECACA", text: "#B91C1C" };
      }
      return { background: "#FEFCE8", border: "#FDE68A", text: "#A16207" };
    }

    if (label === "Tipo" && value === "Proyección") {
      return { background: "#EFF6FF", border: "#DBEAFE", text: "#2563EB" };
    }
  }

  if (module === "collections" && label === "Estado") {
    if (value === "Cobrado") {
      return { background: "#ECFDF5", border: "#A7F3D0", text: "#166534" };
    }
    if (value === "Vencido") {
      return { background: "var(--badge-bg-red)", border: "#FECACA", text: "#B91C1C" };
    }
    return { background: "#FEFCE8", border: "#FDE68A", text: "#A16207" };
  }

  return null;
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
        border: "1px solid var(--border-default)",
        borderRadius: 999,
        padding: "6px 12px",
        background: active ? "var(--icon-bg-purple)" : "var(--bg-card-hover)",
        color: active ? "var(--icon-color-purple)" : "var(--text-secondary)",
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
  moduleKey: string
) {
  const palette = MODULE_COLORS[moduleKey];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active
          ? `1.5px solid ${palette?.border ?? "var(--border-default)"}`
          : "1.5px solid var(--border-default)",
        borderRadius: 999,
        padding: "8px 12px",
        background: active ? (palette?.bg ?? "var(--bg-card)") : "var(--bg-card)",
        color: active ? (palette?.text ?? "var(--text-primary)") : "var(--text-muted)",
        opacity: active ? 1 : 0.6,
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
          background: palette?.border ?? "var(--border-default)",
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
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [referenceDate, setReferenceDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [showCleaning, setShowCleaning] = useState(true);
  const [showMaintenance, setShowMaintenance] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  const [showCollections, setShowCollections] = useState(true);

  const [hoveredEvent, setHoveredEvent] = useState<HoveredEventState | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dayEventsModal, setDayEventsModal] = useState<DayEventsModalState | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    void loadCalendarData();
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
      collectionSchedulesRes,
      collectionRecordsRes,
    ] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("leases")
        .select("*")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("cleaning_building_schedules")
        .select("id, building_id, cleaning_type, day_of_week, time_block")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("cleaning_unit_schedules")
        .select("id, building_id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .eq("active", true),

      supabase
        .from("maintenance_logs")
        .select(
          "id, title, log_type, performed_at, next_due_at, status, asset_name_snapshot, asset_type_snapshot, category_name_snapshot, building_id, unit_id, asset_id"
        )
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("collection_schedules")
        .select(
          "id, building_id, unit_id, lease_id, charge_type, title, responsibility_type, amount_expected, due_day, active, notes"
        )
        .eq("company_id", user.company_id)
        .eq("active", true)
        .is("deleted_at", null),

      supabase
        .from("collection_records")
        .select(
          "id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, payment_method, notes, created_at"
        )
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
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
    setCollectionSchedules((collectionSchedulesRes.data as CollectionSchedule[]) || []);
    setCollectionRecords((collectionRecordsRes.data as CollectionRecord[]) || []);
    setLoadingPage(false);
  }

  const weekStart = useMemo(() => getStartOfWeek(referenceDate), [referenceDate]);
  const todayIsoKey = useMemo(() => dateToIsoKey(new Date()), []);

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

    const filteredUnitSchedules =
      selectedBuildingId === "all"
        ? unitSchedules
        : unitSchedules.filter((item) => item.building_id === selectedBuildingId);

    const filteredMaintenanceLogs =
      selectedBuildingId === "all"
        ? maintenanceLogs
        : maintenanceLogs.filter((item) => item.building_id === selectedBuildingId);

    const filteredExpenseSchedules =
      selectedBuildingId === "all"
        ? expenseSchedules
        : expenseSchedules.filter((item) => item.building_id === selectedBuildingId);

    const filteredExpensePayments =
      selectedBuildingId === "all"
        ? expensePayments
        : expensePayments.filter((item) => item.building_id === selectedBuildingId);

    const filteredCollectionRecords =
      selectedBuildingId === "all"
        ? collectionRecords
        : collectionRecords.filter((item) => item.building_id === selectedBuildingId);

    const unitEvents: CalendarEvent[] = filteredUnitSchedules
      .filter((schedule) => schedule.day_of_week !== "sunday")
      .map((schedule) => {
        const building = buildingMap.get(schedule.building_id);
        const unit = unitMap.get(schedule.unit_id);

        const buildingName = building?.name || "Edificio";
        const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";
        const hourLabel = formatTime(schedule.start_time);
        const durationLabel = formatDuration(schedule.duration_hours);

        return {
          id: `unit-${schedule.id}`,
          module: "cleaning",
          recurrence: "recurring",
          dayKey: schedule.day_of_week,
          isoDate: "",
          title: `${buildingName} · Unidad ${unitLabel}`,
          compactLabel: `Unidad ${unitLabel}`,
          subtitle: `${hourLabel} · ${durationLabel}`,
          colorBackground: CLEANING_COLORS.background,
          colorBorder: CLEANING_COLORS.border,
          colorText: CLEANING_COLORS.text,
          detailItems: [
            { label: "Módulo", value: "Limpieza" },
            { label: "Tipo", value: "Limpieza interior" },
            { label: "Edificio", value: buildingName },
            { label: "Unidad", value: unitLabel },
            { label: "Hora", value: hourLabel },
            { label: "Duración", value: durationLabel },
            { label: "Frecuencia", value: `${DAY_LABELS[schedule.day_of_week]}` },
          ],
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
            compactLabel: baseTitle,
            subtitle: subtitleParts.join(" · "),
            colorBackground: MAINTENANCE_COLORS.background,
            colorBorder: MAINTENANCE_COLORS.border,
            colorText: MAINTENANCE_COLORS.text,
            detailItems: [
              { label: "Módulo", value: "Mantenimiento" },
              { label: "Evento", value: "Realizado" },
              { label: "Edificio", value: buildingName },
              { label: "Unidad", value: unitLabel },
              { label: "Título", value: baseTitle },
              { label: "Fecha", value: performedDateKey },
              {
                label: "Categoría",
                value:
                  log.category_name_snapshot ||
                  log.asset_type_snapshot ||
                  log.log_type ||
                  "Sin categoría",
              },
              { label: "Estado", value: log.status || "Sin estado" },
            ],
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
            compactLabel: `${baseTitle} · Prog.`,
            subtitle: subtitleParts.join(" · "),
            colorBackground: MAINTENANCE_COLORS.background,
            colorBorder: MAINTENANCE_COLORS.border,
            colorText: MAINTENANCE_COLORS.text,
            detailItems: [
              { label: "Módulo", value: "Mantenimiento" },
              { label: "Evento", value: "Programado" },
              { label: "Edificio", value: buildingName },
              { label: "Unidad", value: unitLabel },
              { label: "Título", value: baseTitle },
              { label: "Fecha", value: nextDueDateKey },
              {
                label: "Categoría",
                value:
                  log.category_name_snapshot ||
                  log.asset_type_snapshot ||
                  log.log_type ||
                  "Sin categoría",
              },
              { label: "Estado", value: log.status || "Sin estado" },
            ],
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
      const statusLabel = getPaymentStatusLabel(payment.status);

      paymentEvents.push({
        id: `payment-${payment.id}`,
        module: "payments",
        recurrence: "dated",
        dayKey: dueDayKey,
        isoDate: dueDateKey,
        title: `${schedule.title} · ${statusLabel}`,
        compactLabel: schedule.title,
        subtitle: `${buildingName} · ${scopeLabel} · ${amountLabel}`,
        colorBackground: PAYMENTS_COLORS.background,
        colorBorder: PAYMENTS_COLORS.border,
        colorText: PAYMENTS_COLORS.text,
        detailItems: [
          { label: "Módulo", value: "Pagos" },
          { label: "Tipo", value: "Registro real" },
          { label: "Edificio", value: buildingName },
          { label: "Alcance", value: scopeLabel },
          { label: "Concepto", value: schedule.title },
          { label: "Fecha límite", value: dueDateKey },
          { label: "Monto", value: amountLabel },
          { label: "Estado", value: statusLabel },
          { label: "Proveedor", value: schedule.vendor_name || "Sin proveedor" },
        ],
      });
    });

    const visibleRange = getVisibleRange(referenceDate, viewMode);
    const visibleMonths = getMonthListWithinRange(visibleRange.start, visibleRange.end);

    const existingRealPaymentKeys = new Set(
      filteredExpensePayments.map(
        (payment) => `${payment.expense_schedule_id}-${payment.period_year}-${payment.period_month}`
      )
    );

    filteredExpenseSchedules.forEach((schedule) => {
      if (!schedule.active) return;
      if (schedule.responsibility_type === "tenant") return;

      const building = buildingMap.get(schedule.building_id);
      const unit = schedule.unit_id ? unitMap.get(schedule.unit_id) : null;

      const buildingName = building?.name || "Edificio";
      const unitLabel = unit?.display_code || unit?.unit_number || "General";
      const scopeLabel =
        schedule.applies_to === "unit" ? `Unidad ${unitLabel}` : "Todo el edificio";

      visibleMonths.forEach(({ year, month }) => {
        if (!isExpenseScheduleActiveForPeriod(schedule, year, month)) return;

        const realKey = `${schedule.id}-${year}-${month}`;
        if (existingRealPaymentKeys.has(realKey)) return;

        const projectedDueDate = buildDueDateKey(year, month, schedule.due_day);

        if (
          projectedDueDate < dateToIsoKey(visibleRange.start) ||
          projectedDueDate > dateToIsoKey(visibleRange.end)
        ) {
          return;
        }

        const dueDayKey = getDayKeyFromDateValue(projectedDueDate);
        if (!projectedDueDate || dueDayKey === "sunday") return;

        const amountLabel =
          schedule.amount_estimated !== null
            ? formatCurrency(schedule.amount_estimated)
            : "Sin monto estimado";

        paymentEvents.push({
          id: `projected-payment-${schedule.id}-${year}-${month}`,
          module: "payments",
          recurrence: "dated",
          dayKey: dueDayKey,
          isoDate: projectedDueDate,
          title: `${schedule.title} · Proyectado`,
          compactLabel: `${schedule.title} · Proy.`,
          subtitle: `${buildingName} · ${scopeLabel} · ${amountLabel}`,
          colorBackground: PAYMENTS_PROJECTED_COLORS.background,
          colorBorder: PAYMENTS_PROJECTED_COLORS.border,
          colorText: PAYMENTS_PROJECTED_COLORS.text,
          detailItems: [
            { label: "Módulo", value: "Pagos" },
            { label: "Tipo", value: "Proyección" },
            { label: "Edificio", value: buildingName },
            { label: "Alcance", value: scopeLabel },
            { label: "Concepto", value: schedule.title },
            { label: "Fecha límite", value: projectedDueDate },
            { label: "Monto estimado", value: amountLabel },
            {
              label: "Frecuencia",
              value: schedule.frequency_type === "bimonthly" ? "Bimestral" : "Mensual",
            },
            { label: "Proveedor", value: schedule.vendor_name || "Sin proveedor" },
          ],
        });
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
      const unit = unitMap.get(record.unit_id) || unitMap.get(schedule.unit_id);

      const lease =
        (record.lease_id ? leaseMap.get(record.lease_id) : null) ||
        (schedule.lease_id ? leaseMap.get(schedule.lease_id) : null);

      const buildingName = building?.name || "Edificio";
      const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";
      const tenantLabel = lease ? getLeaseDisplayLabel(lease) : "Sin inquilino";
      const amountLabel = formatCurrency(record.amount_due);
      const statusLabel = getCollectionStatusLabel(record.status);

      collectionEvents.push({
        id: `collection-${record.id}`,
        module: "collections",
        recurrence: "dated",
        dayKey: dueDayKey,
        isoDate: dueDateKey,
        title: `${schedule.title} · ${statusLabel}`,
        compactLabel: schedule.title,
        subtitle: `${buildingName} · Unidad ${unitLabel} · ${tenantLabel} · ${amountLabel}`,
        colorBackground: COLLECTIONS_COLORS.background,
        colorBorder: COLLECTIONS_COLORS.border,
        colorText: COLLECTIONS_COLORS.text,
        detailItems: [
          { label: "Módulo", value: "Cobranza" },
          { label: "Edificio", value: buildingName },
          { label: "Unidad", value: unitLabel },
          { label: "Inquilino", value: tenantLabel },
          { label: "Concepto", value: schedule.title },
          { label: "Fecha límite", value: dueDateKey },
          { label: "Monto", value: amountLabel },
          { label: "Estado", value: statusLabel },
        ],
      });
    });

    return [
      ...unitEvents,
      ...maintenanceEvents,
      ...paymentEvents,
      ...collectionEvents,
    ].sort((a, b) => {
      if (a.isoDate !== b.isoDate) return a.isoDate.localeCompare(b.isoDate);
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
    referenceDate,
    viewMode,
  ]);

  const events = useMemo(() => {
    return allEvents.filter((event) => {
      if (event.module === "cleaning" && !showCleaning) return false;
      if (event.module === "maintenance" && !showMaintenance) return false;
      if (event.module === "payments" && !showPayments) return false;
      if (event.module === "collections" && !showCollections) return false;
      return true;
    });
  }, [allEvents, showCleaning, showMaintenance, showPayments, showCollections]);

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

    // Lunes = 0, Domingo = 6
    const getMondayIndex = (d: Date) => (d.getDay() + 6) % 7;

    const days: { isoDate: string; dayNumber: number; empty: boolean }[] = [];

    // Padding inicial — celdas vacías hasta alinear día 1 con su columna
    const leadingPad = getMondayIndex(monthStart);
    for (let i = 0; i < leadingPad; i++) {
      days.push({ isoDate: "", dayNumber: 0, empty: true });
    }

    // Días reales del mes
    let cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      days.push({
        isoDate: dateToIsoKey(cursor),
        dayNumber: cursor.getDate(),
        empty: false,
      });
      cursor = addDays(cursor, 1);
    }

    // Padding final — completar última semana
    const trailingPad = (7 - (days.length % 7)) % 7;
    for (let i = 0; i < trailingPad; i++) {
      days.push({ isoDate: "", dayNumber: 0, empty: true });
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

  function handleEventMouseEnter(
    event: CalendarEvent,
    target: HTMLButtonElement
  ) {
    const rect = target.getBoundingClientRect();
    const maxLeft =
      typeof window !== "undefined" ? Math.max(12, window.innerWidth - 320) : rect.left;

    setHoveredEvent({
      event,
      top: rect.bottom + 8,
      left: Math.min(rect.left, maxLeft),
    });
  }

  function handleEventMouseLeave() {
    setHoveredEvent(null);
  }

  function openDayEventsModal(isoDate: string, dayLabel: string, dayEvents: CalendarEvent[]) {
    setHoveredEvent(null);
    setDayEventsModal({
      isoDate,
      label: dayLabel,
      events: dayEvents,
    });
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
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>
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
            background: "var(--badge-bg-red)",
            color: "var(--badge-text-red)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {msg}
        </div>
      ) : null}


      <SectionCard
        title="Calendario general"
        subtitle="Vista general de limpieza, mantenimiento, pagos y cobranza con seguimiento semanal, mensual y anual."
        icon={<CalendarDays size={18} />}
      >
        <AppCard>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              className="cal-controls-outer"
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
                className="cal-nav-btns"
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

                <button
                  onClick={() => setReferenceDate(new Date())}
                  style={{
                    padding: ".35rem .85rem",
                    borderRadius: 8,
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Hoy
                </button>

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
                  color: "var(--text-muted)",
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
                className="cal-building-select"
                style={{
                  minWidth: 240,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
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
              {renderModuleToggle("Limpieza", showCleaning, () => setShowCleaning((prev) => !prev), "cleaning")}
              {renderModuleToggle("Mantenimiento", showMaintenance, () => setShowMaintenance((prev) => !prev), "maintenance")}
              {renderModuleToggle("Pagos", showPayments, () => setShowPayments((prev) => !prev), "payments")}
              {renderModuleToggle("Cobranza", showCollections, () => setShowCollections((prev) => !prev), "collections")}
            </div>

            {viewMode === "week" ? (
              isMobile ? (
                /* ── Móvil: lista de días ────────────────────────────── */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {weekDays.map((day) => {
                    const dayEvents = weekEventsByDay.get(day.key) || [];
                    const isToday = day.isoDate === todayIsoKey;
                    return (
                      <div
                        key={day.key}
                        style={{
                          borderRadius: 12,
                          border: `1px solid ${isToday ? "var(--accent)" : "var(--border-default)"}`,
                          overflow: "hidden",
                          background: "var(--bg-card)",
                        }}
                      >
                        {/* Cabecera del día */}
                        <div
                          style={{
                            padding: "8px 12px",
                            background: isToday ? "var(--accent)" : "var(--bg-table-header)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: isToday ? "#fff" : "var(--text-primary)",
                            }}
                          >
                            {day.label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: isToday ? "rgba(255,255,255,0.75)" : "var(--text-muted)",
                            }}
                          >
                            {day.shortDate}
                          </span>
                        </div>
                        {/* Eventos del día */}
                        {dayEvents.length === 0 ? (
                          <div
                            style={{
                              padding: "8px 12px",
                              fontSize: 12,
                              color: "var(--text-muted)",
                            }}
                          >
                            Sin eventos
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: "8px 10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 5,
                            }}
                          >
                            {dayEvents.map((event) => (
                              <button
                                key={`${event.id}-${day.isoDate}`}
                                type="button"
                                onClick={() => {
                                  setHoveredEvent(null);
                                  setSelectedEvent(event);
                                }}
                                style={{
                                  borderRadius: 8,
                                  padding: "7px 10px",
                                  background: event.colorBackground,
                                  border: `1px solid ${event.colorBorder}`,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 7,
                                  width: "100%",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span
                                  style={{
                                    color: event.colorText,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {getEventIcon(event)}
                                </span>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: event.colorText,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                  }}
                                >
                                  {event.compactLabel}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── Desktop: grid de columnas ───────────────────────── */
                <div
                  className="cal-week-grid"
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
                          border: "1px solid var(--border-default)",
                          borderRadius: 16,
                          padding: 14,
                          background: "var(--bg-card)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                          minHeight: 280,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                            {day.label}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                            {day.shortDate}
                          </div>
                        </div>

                        {dayEvents.length === 0 ? (
                          <div
                            style={{
                              borderRadius: 12,
                              padding: "10px 10px",
                              background: "var(--bg-card-hover)",
                              border: "1px dashed #D1D5DB",
                              fontSize: 12,
                              color: "var(--text-muted)",
                              fontWeight: 600,
                            }}
                          >
                            Sin eventos
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {dayEvents.map((event) => (
                              <button
                                key={`${event.id}-${day.isoDate}`}
                                type="button"
                                onMouseEnter={(e) => handleEventMouseEnter(event, e.currentTarget)}
                                onMouseLeave={handleEventMouseLeave}
                                onClick={() => {
                                  setHoveredEvent(null);
                                  setSelectedEvent(event);
                                }}
                                style={{
                                  borderRadius: 10,
                                  padding: "7px 8px",
                                  background: event.colorBackground,
                                  border: `1px solid ${event.colorBorder}`,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 7,
                                  width: "100%",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  minHeight: 34,
                                }}
                              >
                                <span
                                  style={{
                                    color: event.colorText,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {getEventIcon(event)}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: event.colorText,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                  }}
                                >
                                  {event.compactLabel}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}

            {viewMode === "month" ? (
              <div className="cal-month-wrap">
              <div className="cal-month-header" style={{ display:"grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom:"1px solid var(--border-default)", marginBottom:4 }}>
                {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d => (
                  <div key={d} style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", letterSpacing:"0.5px", textAlign:"center", padding:".5rem 0", textTransform:"uppercase" }}>{d}</div>
                ))}
              </div>
              <div
                className="cal-month-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 2,
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {monthDays.map((day, idx) => {
                  if (day.empty) return (
                    <div
                      key={`empty-${idx}`}
                      style={{
                        minHeight: 100,
                        background: "var(--bg-page)",
                        borderRight: "1px solid var(--border-default)",
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    />
                  );
                  const dayEvents = monthEventsByDate.get(day.isoDate) || [];
                  const visibleEvents = dayEvents.slice(0, 4);
                  const isToday = day.isoDate === todayIsoKey;

                  return (
                    <div
                      key={day.isoDate}
                      style={{
                        border: "none",
                        borderRight: "1px solid var(--border-default)",
                        borderBottom: "1px solid var(--border-default)",
                        borderRadius: 0,
                        padding: "6px 8px",
                        background: isToday ? "var(--metric-bg-neutral)" : "var(--bg-card)",
                        outline: isToday ? "2px solid #2563EB" : undefined,
                        outlineOffset: isToday ? "-2px" : undefined,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        minHeight: 170,
                        boxShadow: isToday ? "0 0 0 3px rgba(37, 99, 235, 0.08)" : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: isToday ? "#1D4ED8" : "#111827",
                          }}
                        >
                          {day.dayNumber}
                        </div>

                        {isToday ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "var(--icon-bg-blue)",
                              border: "1px solid #93C5FD",
                              color: "#1D4ED8",
                              fontSize: 10,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Hoy
                          </span>
                        ) : null}
                      </div>

                      {dayEvents.length === 0 ? null : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {visibleEvents.map((event) => (
                            <button
                              key={`${event.id}-${day.isoDate}`}
                              type="button"
                              onMouseEnter={(e) =>
                                handleEventMouseEnter(event, e.currentTarget)
                              }
                              onMouseLeave={handleEventMouseLeave}
                              onClick={() => {
                                setHoveredEvent(null);
                                setSelectedEvent(event);
                              }}
                              style={{
                                borderRadius: 4,
                                padding: "2px 6px",
                                fontSize: 10,
                                fontWeight: 500,
                                background: event.colorBackground,
                                color: event.colorText,
                                border: "none",
                                borderLeft: `3px solid ${event.colorBorder}`,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                marginBottom: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                cursor: "pointer",
                                width: "100%",
                                textAlign: "left",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  verticalAlign: "middle",
                                  flexShrink: 0,
                                }}
                              >
                                {getEventIcon(event)}
                              </span>

                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                }}
                              >
                                {event.compactLabel}
                              </span>
                            </button>
                          ))}

                          {dayEvents.length > 5 ? (
                            <button
                              type="button"
                              onClick={() =>
                                openDayEventsModal(
                                  day.isoDate,
                                  `${day.dayNumber}`,
                                  dayEvents
                                )
                              }
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                textAlign: "left",
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: "var(--text-muted)",
                                cursor: "pointer",
                              }}
                            >
                              + {dayEvents.length - 5} más
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            ) : null}

            {viewMode === "year" ? (
              <div
                className="cal-year-grid"
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
                      border: "1px solid var(--border-default)",
                      borderRadius: 16,
                      padding: 14,
                      background: "var(--bg-card)",
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
                        color: "var(--text-primary)",
                      }}
                    >
                      {month.monthLabel}
                    </div>

                    <div
                      style={{
                        borderRadius: 10,
                        padding: "10px 10px",
                        background: "var(--bg-card-hover)",
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--text-primary)",
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

      {hoveredEvent ? (
        <div
          style={{
            position: "fixed",
            top: hoveredEvent.top,
            left: hoveredEvent.left,
            width: 300,
            zIndex: 2000,
            pointerEvents: "none",
            borderRadius: 14,
            border: "1px solid var(--border-default)",
            background: "var(--bg-card)",
            boxShadow: "0 20px 40px rgba(15, 23, 42, 0.14)",
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: hoveredEvent.event.colorText,
              marginBottom: 6,
            }}
          >
            {hoveredEvent.event.title}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            {getModuleLabel(hoveredEvent.event.module)}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {hoveredEvent.event.detailItems.slice(0, 4).map((item) => (
              <div
                key={`${hoveredEvent.event.id}-${item.label}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr",
                  gap: 8,
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(dayEventsModal)}
        title={
          dayEventsModal
            ? `Eventos del día · ${dayEventsModal.label}`
            : "Eventos del día"
        }
        onClose={() => setDayEventsModal(null)}
      >
        {dayEventsModal ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                borderRadius: 14,
                border: "1px solid var(--border-default)",
                background: "var(--bg-card-hover)",
                padding: 14,
                display: "grid",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                {formatFullDate(dayEventsModal.isoDate)}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                {dayEventsModal.events.length} evento
                {dayEventsModal.events.length === 1 ? "" : "s"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                maxHeight: 420,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {dayEventsModal.events.map((event) => (
                <button
                  key={`${event.id}-day-modal`}
                  type="button"
                  onClick={() => {
                    setDayEventsModal(null);
                    setSelectedEvent(event);
                  }}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${event.colorBorder}`,
                    background: event.colorBackground,
                    padding: 12,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      display: "grid",
                      placeItems: "center",
                      background: "var(--bg-card)",
                      color: event.colorText,
                      border: `1px solid ${event.colorBorder}`,
                      flexShrink: 0,
                    }}
                  >
                    {getEventIcon(event)}
                  </div>

                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: event.colorText,
                        lineHeight: 1.35,
                      }}
                    >
                      {event.title}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: event.colorText,
                        opacity: 0.9,
                        lineHeight: 1.35,
                      }}
                    >
                      {event.subtitle}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {getModuleLabel(event.module)}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <UiButton onClick={() => setDayEventsModal(null)}>Cerrar</UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedEvent)}
        title={selectedEvent?.title || "Detalle del evento"}
        onClose={() => setSelectedEvent(null)}
      >
        {selectedEvent ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${selectedEvent.colorBorder}`,
                background: selectedEvent.colorBackground,
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--bg-card)",
                  color: selectedEvent.colorText,
                  border: `1px solid ${selectedEvent.colorBorder}`,
                  flexShrink: 0,
                }}
              >
                {getEventIcon(selectedEvent)}
              </div>

              <div style={{ display: "grid", gap: 2 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: selectedEvent.colorText,
                  }}
                >
                  {selectedEvent.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: selectedEvent.colorText,
                    opacity: 0.9,
                  }}
                >
                  {getModuleLabel(selectedEvent.module)}
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: 14,
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)",
                overflow: "hidden",
              }}
            >
              {selectedEvent.detailItems.map((item, index) => {
                const badgeColors = getStatusBadgeColors(
                  selectedEvent.module,
                  item.label,
                  item.value
                );

                return (
                  <div
                    key={`${selectedEvent.id}-${item.label}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "170px 1fr",
                      gap: 12,
                      padding: "12px 14px",
                      borderTop: index === 0 ? "none" : "1px solid #F3F4F6",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.label}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {badgeColors ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: badgeColors.background,
                            border: `1px solid ${badgeColors.border}`,
                            color: badgeColors.text,
                            fontSize: 12,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.value}
                        </span>
                      ) : (
                        item.value
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <UiButton onClick={() => setSelectedEvent(null)}>Cerrar</UiButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}