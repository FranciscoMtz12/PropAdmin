"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Building2,
  Home,
  Clock3,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
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

type CleaningEvent = {
  id: string;
  day_of_week: string;
  title: string;
  subtitle: string;
  typeLabel: string;
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

export default function CleaningPage() {
  const { user, loading } = useCurrentUser();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildingSchedules, setBuildingSchedules] = useState<CleaningBuildingSchedule[]>([]);
  const [unitSchedules, setUnitSchedules] = useState<CleaningUnitSchedule[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [msg, setMsg] = useState("");

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    loadCleaningData();
  }, [loading, user?.company_id]);

  async function loadCleaningData() {
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMsg("");

    const [buildingsRes, unitsRes, buildingSchedulesRes, unitSchedulesRes] =
      await Promise.all([
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

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setBuildingSchedules((buildingSchedulesRes.data as CleaningBuildingSchedule[]) || []);
    setUnitSchedules((unitSchedulesRes.data as CleaningUnitSchedule[]) || []);
    setLoadingPage(false);
  }

  const weekStart = useMemo(() => {
    const today = new Date();
    const start = getStartOfWeek(today);
    return addDays(start, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return DAY_ORDER.map((dayKey, index) => {
      const date = addDays(weekStart, index);

      return {
        key: dayKey,
        label: DAY_LABELS[dayKey],
        shortDate: formatShortDate(date),
      };
    });
  }, [weekStart]);

  const events = useMemo<CleaningEvent[]>(() => {
    const buildingMap = new Map<string, Building>();
    const unitMap = new Map<string, Unit>();

    buildings.forEach((building) => buildingMap.set(building.id, building));
    units.forEach((unit) => unitMap.set(unit.id, unit));

    const filteredBuildingSchedules =
      selectedBuildingId === "all"
        ? buildingSchedules
        : buildingSchedules.filter((item) => item.building_id === selectedBuildingId);

    const filteredUnitSchedules =
      selectedBuildingId === "all"
        ? unitSchedules
        : unitSchedules.filter((item) => item.building_id === selectedBuildingId);

    const buildingEvents: CleaningEvent[] = filteredBuildingSchedules.map((schedule) => {
      const building = buildingMap.get(schedule.building_id);
      const buildingName = building?.name || "Edificio";

      const typeLabel =
        schedule.cleaning_type === "exterior" ? "Exterior" : "Áreas comunes";

      const blockLabel = schedule.time_block === "morning" ? "Mañana" : "Tarde";

      return {
        id: `building-${schedule.id}`,
        day_of_week: schedule.day_of_week,
        title: `${buildingName} · ${typeLabel}`,
        subtitle: blockLabel,
        typeLabel,
      };
    });

    const unitEvents: CleaningEvent[] = filteredUnitSchedules.map((schedule) => {
      const building = buildingMap.get(schedule.building_id);
      const unit = unitMap.get(schedule.unit_id);

      const buildingName = building?.name || "Edificio";
      const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";

      return {
        id: `unit-${schedule.id}`,
        day_of_week: schedule.day_of_week,
        title: `${buildingName} · Unidad ${unitLabel}`,
        subtitle: `${formatTime(schedule.start_time)} · ${formatDuration(schedule.duration_hours)}`,
        typeLabel: "Interior",
      };
    });

    return [...buildingEvents, ...unitEvents]
      .filter((event) => event.day_of_week !== "sunday")
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [buildings, units, buildingSchedules, unitSchedules, selectedBuildingId]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CleaningEvent[]>();

    DAY_ORDER.forEach((day) => {
      map.set(day, []);
    });

    events.forEach((event) => {
      const current = map.get(event.day_of_week) || [];
      current.push(event);
      map.set(event.day_of_week, current);
    });

    return map;
  }, [events]);

  const totalExterior = buildingSchedules.filter((x) => x.cleaning_type === "exterior").length;
  const totalCommon = buildingSchedules.filter((x) => x.cleaning_type === "common").length;
  const totalInterior = unitSchedules.filter((x) => x.active).length;

  const selectedBuildingName =
    selectedBuildingId === "all"
      ? "Todos los edificios"
      : buildings.find((b) => b.id === selectedBuildingId)?.name || "Edificio";

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>Cargando limpieza...</div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Limpieza"
        subtitle="Vista general de la operación de limpieza para todos los edificios."
        titleIcon={<Sparkles size={18} />}
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
          value="Semana"
          helper={formatWeekRange(weekStart)}
          icon={<Sparkles size={18} />}
        />
        <MetricCard
          label="Exterior"
          value={String(totalExterior)}
          helper="Programaciones"
          icon={<Building2 size={18} />}
        />
        <MetricCard
          label="Áreas comunes"
          value={String(totalCommon)}
          helper="Programaciones"
          icon={<Sparkles size={18} />}
        />
        <MetricCard
          label="Interior"
          value={String(totalInterior)}
          helper="Unidades activas"
          icon={<Home size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Calendario semanal de limpieza"
        subtitle="Vista operativa de limpieza agrupada por día."
        icon={<Clock3 size={18} />}
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
                <AppBadge backgroundColor="#EEF2FF" textColor="#4338CA">
                  Semana
                </AppBadge>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <UiButton
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  icon={<ChevronLeft size={16} />}
                >
                  Semana anterior
                </UiButton>

                <UiButton onClick={() => setWeekOffset(0)}>
                  Semana actual
                </UiButton>

                <UiButton
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  icon={<ChevronRight size={16} />}
                >
                  Semana siguiente
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
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 16,
              }}
            >
              {weekDays.map((day) => {
                const dayEvents = eventsByDay.get(day.key) || [];

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
                              background: "#ECFDF5",
                              border: "1px solid #A7F3D0",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#166534",
                                lineHeight: 1.35,
                              }}
                            >
                              {event.title}
                            </span>

                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: "#166534",
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
      </div>
    </PageContainer>
  );
}

