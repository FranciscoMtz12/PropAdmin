"use client";

/*
  Módulo general de Mantenimiento.

  Esta versión agrega:
  - vista semanal
  - vista mensual
  - vista anual
  - filtro por edificio
  - eventos realizados y próximos/programados

  Importante:
  - Toda la UI visible queda en español.
  - Esta versión usa solo campos que hoy sí existen en maintenance_logs.
  - Se normaliza el manejo de fechas para que semana, mes y año coincidan.
*/

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  ShieldCheck,
  Wrench,
  CircleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import UiButton from "@/components/UiButton";

type MaintenanceCategory = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

type RecentLogRow = {
  id: string;
  title: string;
  log_type: string;
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

type BuildingOption = {
  id: string;
  name: string;
  code: string | null;
};

type UnitOption = {
  id: string;
  unit_number: string;
  display_code: string | null;
  building_id: string;
};

type EnrichedRecentLogRow = RecentLogRow & {
  building_label: string;
  unit_label: string;
};

type CalendarEvent = {
  id: string;
  dayKey: string;
  isoDate: string;
  title: string;
  subtitle: string;
  kind: "done" | "upcoming";
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

/*
  Toma cualquier timestamp/string y se queda solo con la parte YYYY-MM-DD.
  Así evitamos que la zona horaria cambie el día visual.
*/
function getDateOnlyKey(dateValue: string | null) {
  if (!dateValue) return "";
  return dateValue.slice(0, 10);
}

/*
  Convierte YYYY-MM-DD a Date local sin depender de UTC.
*/
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

function formatLogType(logType: string) {
  const normalized = (logType || "").toLowerCase();

  if (normalized === "preventive") return "Preventivo";
  if (normalized === "corrective") return "Correctivo";
  if (normalized === "replacement") return "Reemplazo";
  if (normalized === "inspection") return "Inspección";
  if (normalized === "note") return "Nota";

  return logType || "Sin tipo";
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

export default function MaintenancePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [recentLogs, setRecentLogs] = useState<EnrichedRecentLogRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [msg, setMsg] = useState("");

  const [selectedBuildingId, setSelectedBuildingId] = useState("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [referenceDate, setReferenceDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id) {
      loadPageData();
    }
  }, [user]);

  async function loadPageData() {
    if (!user?.company_id) return;

    setLoadingData(true);
    setMsg("");

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("maintenance_categories")
      .select("id, company_id, name, description, status, created_at")
      .eq("company_id", user.company_id)
      .order("name", { ascending: true });

    if (categoriesError) {
      setMsg("No se pudieron cargar las categorías de mantenimiento.");
      setLoadingData(false);
      return;
    }

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, name, code")
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (!buildingError) {
      setBuildings((buildingData as BuildingOption[]) || []);
    } else {
      setBuildings([]);
    }

    const { data: logsData, error: logsError } = await supabase
      .from("maintenance_logs")
      .select(
        "id, title, log_type, performed_at, next_due_at, status, asset_name_snapshot, asset_type_snapshot, category_name_snapshot, building_id, unit_id, asset_id"
      )
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (logsError) {
      setMsg("Se cargaron las categorías, pero no se pudo cargar la actividad de mantenimiento.");
      setCategories((categoriesData as MaintenanceCategory[]) || []);
      setRecentLogs([]);
      setLoadingData(false);
      return;
    }

    const parsedLogs = (logsData as RecentLogRow[]) || [];

    const buildingIds = Array.from(
      new Set(parsedLogs.map((log) => log.building_id).filter(Boolean) as string[])
    );

    const unitIds = Array.from(
      new Set(parsedLogs.map((log) => log.unit_id).filter(Boolean) as string[])
    );

    let buildingMap = new Map<string, BuildingOption>();
    let unitMap = new Map<string, UnitOption>();

    if (buildingIds.length > 0) {
      const { data: logBuildingData, error: logBuildingError } = await supabase
        .from("buildings")
        .select("id, name, code")
        .in("id", buildingIds)
        .is("deleted_at", null);

      if (!logBuildingError) {
        buildingMap = new Map(
          ((logBuildingData as BuildingOption[]) || []).map((building) => [building.id, building])
        );
      }
    }

    if (unitIds.length > 0) {
      const { data: logUnitData, error: logUnitError } = await supabase
        .from("units")
        .select("id, unit_number, display_code, building_id")
        .in("id", unitIds)
        .is("deleted_at", null);

      if (!logUnitError) {
        unitMap = new Map(
          ((logUnitData as UnitOption[]) || []).map((unit) => [unit.id, unit])
        );
      }
    }

    const enrichedLogs: EnrichedRecentLogRow[] = parsedLogs.map((log) => {
      const building = log.building_id ? buildingMap.get(log.building_id) : null;
      const unit = log.unit_id ? unitMap.get(log.unit_id) : null;

      const buildingLabel = building ? building.name : "Sin edificio ligado";
      const unitLabel = unit
        ? `Departamento ${unit.display_code || unit.unit_number}`
        : "";

      return {
        ...log,
        building_label: buildingLabel,
        unit_label: unitLabel,
      };
    });

    setCategories((categoriesData as MaintenanceCategory[]) || []);
    setRecentLogs(enrichedLogs);
    setLoadingData(false);
  }

  const filteredLogs = useMemo(() => {
    return recentLogs.filter((log) => {
      if (selectedBuildingId === "ALL") return true;
      return log.building_id === selectedBuildingId;
    });
  }, [recentLogs, selectedBuildingId]);

  const weekStart = useMemo(() => getStartOfWeek(referenceDate), [referenceDate]);

  const weekDays = useMemo<WeekDayColumn[]>(() => {
    return DAY_ORDER.map((dayKey, index) => {
      const date = addDays(weekStart, index);

      return {
        key: dayKey,
        label: DAY_LABELS[dayKey],
        shortDate: formatShortDate(date),
        isoDate: date.toISOString().slice(0, 10),
      };
    });
  }, [weekStart]);

  const weekEvents = useMemo<CalendarEvent[]>(() => {
    const weekDateSet = new Set(weekDays.map((day) => day.isoDate));

    const doneEvents: CalendarEvent[] = filteredLogs
      .filter((log) => {
        const iso = getDateOnlyKey(log.performed_at);
        return iso && weekDateSet.has(iso);
      })
      .map((log) => {
        const isoDate = getDateOnlyKey(log.performed_at);

        return {
          id: `done-${log.id}`,
          dayKey: getDayKeyFromDateValue(log.performed_at),
          isoDate,
          title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
          subtitle: `${log.title} · ${formatLogType(log.log_type)}`,
          kind: "done",
          colorBackground: "#FFF7ED",
          colorBorder: "#FED7AA",
          colorText: "#9A3412",
        };
      });

    const upcomingEvents: CalendarEvent[] = filteredLogs
      .filter((log) => {
        const iso = getDateOnlyKey(log.next_due_at);
        return iso && weekDateSet.has(iso);
      })
      .map((log) => {
        const isoDate = getDateOnlyKey(log.next_due_at);

        return {
          id: `upcoming-${log.id}`,
          dayKey: getDayKeyFromDateValue(log.next_due_at),
          isoDate,
          title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
          subtitle: `${log.title} · Próximo`,
          kind: "upcoming",
          colorBackground: "#FEF3C7",
          colorBorder: "#FCD34D",
          colorText: "#92400E",
        };
      });

    return [...doneEvents, ...upcomingEvents]
      .filter((event) => event.dayKey !== "sunday")
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredLogs, weekDays]);

  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    DAY_ORDER.forEach((day) => {
      map.set(day, []);
    });

    weekEvents.forEach((event) => {
      const current = map.get(event.dayKey) || [];
      current.push(event);
      map.set(event.dayKey, current);
    });

    return map;
  }, [weekEvents]);

  const monthDays = useMemo(() => {
    const monthStart = getStartOfMonth(referenceDate);
    const monthEnd = getEndOfMonth(referenceDate);

    const days: { isoDate: string; label: string; dayNumber: number }[] = [];
    let cursor = new Date(monthStart);

    while (cursor <= monthEnd) {
      const isoDate = cursor.toISOString().slice(0, 10);
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
    const monthDateSet = new Set(monthDays.map((day) => day.isoDate));
    const map = new Map<string, CalendarEvent[]>();

    monthDays.forEach((day) => {
      map.set(day.isoDate, []);
    });

    const doneEvents = filteredLogs
      .filter((log) => {
        const iso = getDateOnlyKey(log.performed_at);
        return iso && monthDateSet.has(iso);
      })
      .map((log) => ({
        id: `done-${log.id}`,
        dayKey: getDayKeyFromDateValue(log.performed_at),
        isoDate: getDateOnlyKey(log.performed_at),
        title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
        subtitle: `${log.title} · ${formatLogType(log.log_type)}`,
        kind: "done" as const,
        colorBackground: "#FFF7ED",
        colorBorder: "#FED7AA",
        colorText: "#9A3412",
      }));

    const upcomingEvents = filteredLogs
      .filter((log) => {
        const iso = getDateOnlyKey(log.next_due_at);
        return iso && monthDateSet.has(iso);
      })
      .map((log) => ({
        id: `upcoming-${log.id}`,
        dayKey: getDayKeyFromDateValue(log.next_due_at),
        isoDate: getDateOnlyKey(log.next_due_at),
        title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
        subtitle: `${log.title} · Próximo`,
        kind: "upcoming" as const,
        colorBackground: "#FEF3C7",
        colorBorder: "#FCD34D",
        colorText: "#92400E",
      }));

    [...doneEvents, ...upcomingEvents]
      .filter((event) => event.dayKey !== "sunday")
      .forEach((event) => {
        const current = map.get(event.isoDate) || [];
        current.push(event);
        map.set(event.isoDate, current);
      });

    return map;
  }, [filteredLogs, monthDays]);

  const yearSummary = useMemo(() => {
    const targetYear = referenceDate.getFullYear();

    return MONTH_LABELS.map((monthLabel, monthIndex) => {
      const monthDone = filteredLogs.filter((log) => {
        const iso = getDateOnlyKey(log.performed_at);
        if (!iso) return false;

        const date = parseDateOnly(iso);
        return (
          date.getFullYear() === targetYear &&
          date.getMonth() === monthIndex &&
          date.getDay() !== 0
        );
      }).length;

      const monthUpcoming = filteredLogs.filter((log) => {
        const iso = getDateOnlyKey(log.next_due_at);
        if (!iso) return false;

        const date = parseDateOnly(iso);
        return (
          date.getFullYear() === targetYear &&
          date.getMonth() === monthIndex &&
          date.getDay() !== 0
        );
      }).length;

      return {
        monthLabel,
        done: monthDone,
        upcoming: monthUpcoming,
        total: monthDone + monthUpcoming,
      };
    });
  }, [filteredLogs, referenceDate]);

  const totals = useMemo(() => {
    const done = recentLogs.filter((log) => log.status === "DONE").length;
    const upcoming = recentLogs.filter((log) => !!log.next_due_at).length;
    const corrective = recentLogs.filter((log) => log.log_type === "corrective").length;

    return {
      categories: categories.length,
      upcoming,
      corrective,
    };
  }, [categories, recentLogs]);

  const selectedBuildingLabel =
    selectedBuildingId === "ALL"
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

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>Cargando usuario...</div>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (loadingData) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>Cargando mantenimiento...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mantenimiento"
        subtitle="Vista operativa de mantenimiento con seguimiento semanal, mensual y anual."
        titleIcon={<Wrench size={18} />}
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
          icon={<CalendarClock size={18} />}
        />
        <MetricCard
          label="Categorías"
          value={String(totals.categories)}
          helper="Tipos activos"
          icon={<ClipboardList size={18} />}
        />
        <MetricCard
          label="Programados"
          value={String(totals.upcoming)}
          helper={selectedBuildingLabel}
          icon={<ShieldCheck size={18} />}
        />
        <MetricCard
          label="Correctivos"
          value={String(totals.corrective)}
          helper="Seguimiento"
          icon={<CircleAlert size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Calendario de mantenimiento"
        subtitle="Vista operativa para revisar trabajos realizados y próximos trabajos."
        icon={<CalendarClock size={18} />}
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
                <option value="ALL">Todos los edificios</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.code ? `${building.code} - ` : ""}
                    {building.name}
                  </option>
                ))}
              </select>
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
                              key={event.id}
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
                              key={event.id}
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
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 10,
                          padding: "10px 10px",
                          background: "#FFF7ED",
                          border: "1px solid #FED7AA",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#9A3412",
                        }}
                      >
                        Realizados: {month.done}
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          padding: "10px 10px",
                          background: "#FEF3C7",
                          border: "1px solid #FCD34D",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#92400E",
                        }}
                      >
                        Próximos: {month.upcoming}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#6B7280",
                        }}
                      >
                        Total: {month.total}
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
                background: "#F97316",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Realizado
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
              Próximo / programado
            </span>
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
}
