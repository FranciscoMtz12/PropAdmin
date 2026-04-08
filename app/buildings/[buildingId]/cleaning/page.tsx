"use client";

/*
  Cleaning landing page for a building.

  Esta versión:
  - mantiene colores por categoría
  - mantiene nombre y dirección del edificio
  - muestra un resumen real y más útil por módulo
  - distingue unidades activas e inactivas en limpieza interior
  - deja navegación clara hacia:
    - exterior
    - common
    - units
*/

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brush,
  Building2,
  CalendarClock,
  CheckCircle2,
  Home,
  Leaf,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppIconBox from "@/components/AppIconBox";
import AppBadge from "@/components/AppBadge";
import UiButton from "@/components/UiButton";

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  code: string | null;
};

type CleaningBuildingSchedule = {
  id: string;
  cleaning_type: "exterior" | "common";
  day_of_week: string;
  time_block: "morning" | "afternoon";
};

type Unit = {
  id: string;
  unit_number: string | null;
  display_code: string | null;
};

type CleaningUnitSchedule = {
  id: string;
  unit_id: string;
  day_of_week: string;
  start_time: string;
  duration_hours: number;
  active: boolean;
};

type CleaningArea = {
  key: string;
  title: string;
  description: string;
  color: string;
  background: string;
  border: string;
  badgeText: string;
  icon: React.ReactNode;
  href: string;
  buttonLabel: string;
  summaryTitle: string;
  summaryLines: string[];
};

const dayLabels: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export default function BuildingCleaningPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params.buildingId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [buildingSchedules, setBuildingSchedules] = useState<CleaningBuildingSchedule[]>([]);
  const [unitSchedules, setUnitSchedules] = useState<CleaningUnitSchedule[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) {
      loadPageData();
    }
  }, [user, buildingId]);

  async function loadPageData() {
    if (!user?.company_id || !buildingId) return;

    setLoadingPage(true);
    setMsg("");

    const [buildingRes, buildingSchedulesRes, unitSchedulesRes, unitsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, company_id, name, address, code")
        .eq("id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .single(),

      supabase
        .from("cleaning_building_schedules")
        .select("id, cleaning_type, day_of_week, time_block")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("cleaning_unit_schedules")
        .select("id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("units")
        .select("id, unit_number, display_code")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null),
    ]);

    if (buildingRes.error || !buildingRes.data) {
      setMsg("No se pudo cargar la información del edificio.");
      setLoadingPage(false);
      return;
    }

    if (buildingSchedulesRes.error) {
      setMsg("No se pudo cargar la programación de limpieza del edificio.");
      setLoadingPage(false);
      return;
    }

    if (unitSchedulesRes.error) {
      setMsg("No se pudo cargar la programación interior de unidades.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMsg("No se pudieron cargar las unidades del edificio.");
      setLoadingPage(false);
      return;
    }

    setBuilding(buildingRes.data as Building);
    setBuildingSchedules((buildingSchedulesRes.data as CleaningBuildingSchedule[]) || []);
    setUnitSchedules((unitSchedulesRes.data as CleaningUnitSchedule[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setLoadingPage(false);
  }

  function formatDay(dayValue: string) {
    return dayLabels[dayValue] || dayValue;
  }

  function formatTime(timeValue: string | null) {
    if (!timeValue) return "—";

    const parts = timeValue.split(":");
    if (parts.length < 2) return timeValue;

    return `${parts[0]}:${parts[1]}`;
  }

  function formatDuration(duration: number | null) {
    if (!duration) return "—";
    return `${duration} h`;
  }

  function buildBuildingSummaryLines(
    schedules: CleaningBuildingSchedule[]
  ): string[] {
    if (schedules.length === 0) {
      return ["Sin programación"];
    }

    const morning = schedules
      .filter((item) => item.time_block === "morning")
      .map((item) => formatDay(item.day_of_week));

    const afternoon = schedules
      .filter((item) => item.time_block === "afternoon")
      .map((item) => formatDay(item.day_of_week));

    const lines: string[] = [];

    if (morning.length > 0) {
      lines.push(`Mañana: ${morning.join(", ")}`);
    }

    if (afternoon.length > 0) {
      lines.push(`Tarde: ${afternoon.join(", ")}`);
    }

    return lines;
  }

  function buildUnitSummaryLines(): string[] {
    if (unitSchedules.length === 0) {
      return ["Sin unidades programadas"];
    }

    const unitMap = new Map<string, Unit>();
    units.forEach((unit) => {
      unitMap.set(unit.id, unit);
    });

    const activeSchedules = unitSchedules.filter((item) => item.active);
    const inactiveSchedules = unitSchedules.filter((item) => !item.active);

    const orderedActive = [...activeSchedules].sort((a, b) => {
      const aUnit = unitMap.get(a.unit_id);
      const bUnit = unitMap.get(b.unit_id);

      const aLabel = aUnit?.display_code || aUnit?.unit_number || "";
      const bLabel = bUnit?.display_code || bUnit?.unit_number || "";

      return aLabel.localeCompare(bLabel);
    });

    const lines: string[] = [
      `Activas: ${activeSchedules.length}`,
      `Inactivas: ${inactiveSchedules.length}`,
    ];

    const visibleSchedules = orderedActive.slice(0, 2);

    visibleSchedules.forEach((schedule) => {
      const unit = unitMap.get(schedule.unit_id);
      const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";
      const dayLabel = formatDay(schedule.day_of_week);
      const timeLabel = formatTime(schedule.start_time);
      const durationLabel = formatDuration(schedule.duration_hours);

      lines.push(`${unitLabel}: ${dayLabel}, ${timeLabel}, ${durationLabel}`);
    });

    if (orderedActive.length > 2) {
      lines.push(`+ ${orderedActive.length - 2} unidades activas más`);
    }

    return lines;
  }

  const cleaningAreas = useMemo<CleaningArea[]>(() => {
    const exteriorSchedules = buildingSchedules.filter(
      (item) => item.cleaning_type === "exterior"
    );

    const commonSchedules = buildingSchedules.filter(
      (item) => item.cleaning_type === "common"
    );

    return [
      {
        key: "exterior",
        title: "Exterior del edificio",
        description:
          "Programa qué días se limpia el exterior del edificio, con bloques simples de mañana y tarde.",
        color: "#166534",
        background: "#F0FDF4",
        border: "#BBF7D0",
        badgeText: "Exterior",
        icon: <Leaf size={18} />,
        href: `/buildings/${buildingId}/cleaning/exterior`,
        buttonLabel: "Ver programación",
        summaryTitle: "Programación",
        summaryLines: buildBuildingSummaryLines(exteriorSchedules),
      },
      {
        key: "common",
        title: "Áreas comunes",
        description:
          "Define los días de limpieza para pasillos, lobby y espacios compartidos del edificio.",
        color: "#1D4ED8",
        background: "#EFF6FF",
        border: "#BFDBFE",
        badgeText: "Común",
        icon: <Brush size={18} />,
        href: `/buildings/${buildingId}/cleaning/common`,
        buttonLabel: "Ver programación",
        summaryTitle: "Programación",
        summaryLines: buildBuildingSummaryLines(commonSchedules),
      },
      {
        key: "units",
        title: "Interior de unidades",
        description:
          "Administra la limpieza interior por departamento, con horario y duración estimada.",
        color: "#7C3AED",
        background: "#F5F3FF",
        border: "#DDD6FE",
        badgeText: "Unidad",
        icon: <Home size={18} />,
        href: `/buildings/${buildingId}/cleaning/units`,
        buttonLabel: "Ver unidades",
        summaryTitle: "Resumen interior",
        summaryLines: buildUnitSummaryLines(),
      },
    ];
  }, [buildingId, buildingSchedules, unitSchedules, units]);

  const totalBuildingSchedules = buildingSchedules.length;
  const totalActiveUnitSchedules = unitSchedules.filter((item) => item.active).length;

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>Cargando...</div>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (!building) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#B91C1C" }}>
          {msg || "No se encontró el edificio."}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Cleaning"
        subtitle="Configura la programación de limpieza del edificio de forma simple y visual."
        titleIcon={<Sparkles size={18} />}
        actions={
          <UiButton
            href={`/buildings/${buildingId}`}
            icon={<ArrowLeft size={16} />}
          >
            Volver al edificio
          </UiButton>
        }
      />

      <SectionCard
        title="Resumen del edificio"
        subtitle="Contexto base para la programación de limpieza."
        icon={<Building2 size={18} />}
      >
        <AppGrid minWidth={240}>
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#6B7280",
                }}
              >
                Nombre
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {building.name}
              </span>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#6B7280",
                }}
              >
                Dirección
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>
                {building.address || "Sin dirección registrada"}
              </span>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#6B7280",
                }}
              >
                Programación edificio
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {totalBuildingSchedules}
              </span>
              <span style={{ fontSize: 13, color: "#6B7280" }}>
                Exterior + áreas comunes
              </span>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#6B7280",
                }}
              >
                Unidades activas
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {totalActiveUnitSchedules}
              </span>
              <span style={{ fontSize: 13, color: "#6B7280" }}>
                Limpieza interior activa
              </span>
            </div>
          </AppCard>
        </AppGrid>
      </SectionCard>

      <SectionCard
        title="Áreas de limpieza"
        subtitle="Selecciona qué tipo de limpieza quieres programar."
        icon={<CalendarClock size={18} />}
      >
        <AppGrid minWidth={300}>
          {cleaningAreas.map((area) => (
            <AppCard
              key={area.key}
              style={{
                border: `1px solid ${area.border}`,
                background: area.background,
              }}
            >
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
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <AppIconBox
                      size={44}
                      radius={14}
                      background="white"
                      color={area.color}
                      style={{
                        border: `1px solid ${area.border}`,
                      }}
                    >
                      {area.icon}
                    </AppIconBox>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {area.title}
                      </h3>

                      <AppBadge
                        backgroundColor="white"
                        textColor={area.color}
                        borderColor={area.border}
                      >
                        {area.badgeText}
                      </AppBadge>
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#4B5563",
                  }}
                >
                  {area.description}
                </p>

                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.7)",
                    border: `1px solid ${area.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minHeight: 132,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#6B7280",
                    }}
                  >
                    {area.summaryTitle}
                  </span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {area.summaryLines.map((line, index) => (
                      <span
                        key={`${area.key}-${index}`}
                        style={{
                          fontSize: 14,
                          fontWeight: index < 2 && area.key === "units" ? 700 : 600,
                          color: "#111827",
                          lineHeight: 1.5,
                        }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    paddingTop: 4,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      color: area.color,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Módulo listo
                  </div>

                  <UiButton href={area.href}>{area.buttonLabel}</UiButton>
                </div>
              </div>
            </AppCard>
          ))}
        </AppGrid>
      </SectionCard>
    </PageContainer>
  );
}
