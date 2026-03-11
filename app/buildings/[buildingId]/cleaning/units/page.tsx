"use client";

/*
Página de limpieza interior de unidades.

Objetivo:
- Mostrar todas las unidades del edificio
- Indicar visualmente si cada unidad tiene limpieza programada o no
- Mostrar día, hora y duración cuando exista programación activa

Importante:
- La UI está en español
- La base de datos guarda day_of_week en inglés
*/

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Home, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
};

type Unit = {
  id: string;
  unit_number: string | null;
  display_code: string | null;
  floor: number | null;
  status: string | null;
};

type CleaningUnitSchedule = {
  id: string;
  unit_id: string;
  day_of_week: string;
  start_time: string;
  duration_hours: number;
  active: boolean;
};

type UnitRow = {
  id: string;
  unitLabel: string;
  floorLabel: string;
  unitStatus: string;
  hasCleaning: boolean;
  cleaningDay: string;
  cleaningTime: string;
  cleaningDuration: string;
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

export default function CleaningUnitsPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.buildingId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [schedules, setSchedules] = useState<CleaningUnitSchedule[]>([]);
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

    const [buildingRes, unitsRes, schedulesRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, company_id, name, address")
        .eq("id", buildingId)
        .eq("company_id", user.company_id)
        .single(),

      supabase
        .from("units")
        .select("id, unit_number, display_code, floor, status")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .order("floor", { ascending: true })
        .order("unit_number", { ascending: true }),

      supabase
        .from("cleaning_unit_schedules")
        .select("id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .eq("active", true),
    ]);

    if (buildingRes.error || !buildingRes.data) {
      setMsg("No se pudo cargar la información del edificio.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMsg("No se pudieron cargar las unidades.");
      setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      setMsg("No se pudo cargar la programación de limpieza.");
      setLoadingPage(false);
      return;
    }

    setBuilding(buildingRes.data as Building);
    setUnits((unitsRes.data as Unit[]) || []);
    setSchedules((schedulesRes.data as CleaningUnitSchedule[]) || []);
    setLoadingPage(false);
  }

  function formatDay(dayValue: string | null) {
    if (!dayValue) return "—";
    return dayLabels[dayValue] || dayValue;
  }

  function formatTime(timeValue: string | null) {
    if (!timeValue) return "—";

    const parts = timeValue.split(":");
    if (parts.length < 2) return timeValue;

    const hour = parts[0];
    const minute = parts[1];

    return `${hour}:${minute}`;
  }

  function formatDuration(duration: number | null) {
    if (!duration) return "—";

    if (Number.isInteger(duration)) {
      return `${duration} h`;
    }

    return `${duration} h`;
  }

  const rows = useMemo<UnitRow[]>(() => {
    const scheduleMap = new Map<string, CleaningUnitSchedule>();

    schedules.forEach((schedule) => {
      scheduleMap.set(schedule.unit_id, schedule);
    });

    return units.map((unit) => {
      const schedule = scheduleMap.get(unit.id);
      const unitLabel =
        unit.display_code || unit.unit_number || "Unidad sin nombre";

      return {
        id: unit.id,
        unitLabel,
        floorLabel: unit.floor !== null ? `Piso ${unit.floor}` : "Sin piso",
        unitStatus: unit.status || "Sin estatus",
        hasCleaning: Boolean(schedule),
        cleaningDay: schedule ? formatDay(schedule.day_of_week) : "—",
        cleaningTime: schedule ? formatTime(schedule.start_time) : "—",
        cleaningDuration: schedule ? formatDuration(schedule.duration_hours) : "—",
      };
    });
  }, [units, schedules]);

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
        title="Interior de unidades"
        subtitle={`Consulta qué departamentos de ${building.name} tienen limpieza interior programada.`}
        titleIcon={<Home size={18} />}
        actions={
          <UiButton
            href={`/buildings/${buildingId}/cleaning`}
            icon={<ArrowLeft size={16} />}
          >
            Volver
          </UiButton>
        }
      />

      <SectionCard
        title="Resumen del edificio"
        subtitle="Contexto base para revisar la programación interior."
      >
        <AppCard>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#6B7280",
                }}
              >
                Edificio
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {building.name}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          </div>
        </AppCard>
      </SectionCard>

      <SectionCard
        title="Unidades del edificio"
        subtitle="Las unidades con limpieza programada aparecen en verde tenue."
      >
        {rows.length === 0 ? (
          <AppEmptyState
            title="No hay unidades registradas"
            description="Primero da de alta unidades en este edificio para poder programar limpieza interior."
          />
        ) : (
          <AppCard>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 760,
                }}
              >
                <thead>
                  <tr>
                    <th style={tableHeadStyle}>Unidad</th>
                    <th style={tableHeadStyle}>Piso</th>
                    <th style={tableHeadStyle}>Estatus unidad</th>
                    <th style={tableHeadStyle}>Limpieza</th>
                    <th style={tableHeadStyle}>Día</th>
                    <th style={tableHeadStyle}>Hora</th>
                    <th style={tableHeadStyle}>Duración</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        background: row.hasCleaning ? "#F0FDF4" : "#FFFFFF",
                        borderBottom: "1px solid #E5E7EB",
                      }}
                    >
                      <td style={tableCellStyleStrong}>{row.unitLabel}</td>
                      <td style={tableCellStyle}>{row.floorLabel}</td>
                      <td style={tableCellStyle}>{row.unitStatus}</td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 13,
                            fontWeight: 600,
                            background: row.hasCleaning ? "#DCFCE7" : "#F3F4F6",
                            color: row.hasCleaning ? "#166534" : "#4B5563",
                          }}
                        >
                          {row.hasCleaning ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          {row.hasCleaning ? "Programada" : "Sin programar"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>{row.cleaningDay}</td>
                      <td style={tableCellStyle}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Clock3 size={14} />
                          {row.cleaningTime}
                        </span>
                      </td>
                      <td style={tableCellStyle}>{row.cleaningDuration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AppCard>
        )}
      </SectionCard>
    </PageContainer>
  );
}

const tableHeadStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#6B7280",
  borderBottom: "1px solid #E5E7EB",
  background: "#F9FAFB",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px",
  fontSize: 14,
  color: "#374151",
  verticalAlign: "middle",
};

const tableCellStyleStrong: React.CSSProperties = {
  ...tableCellStyle,
  fontWeight: 700,
  color: "#111827",
};