"use client";

/*
Página de configuración de limpieza interior por unidad.

Objetivo:
- Ver el detalle básico del departamento
- Crear o editar su programación semanal de limpieza interior
- Guardar:
  - día
  - hora de inicio
  - duración estimada
  - activa / inactiva

Importante:
- UI en español
- day_of_week se guarda en inglés en la base de datos
*/

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Home, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppFormField from "@/components/AppFormField";
import UiButton from "@/components/UiButton";

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
};

type Unit = {
  id: string;
  company_id: string;
  building_id: string;
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

type DayOption = {
  value: string;
  label: string;
};

const dayOptions: DayOption[] = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
];

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--border-radius-lg)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  outline: "none",
  fontSize: "14px",
  color: "var(--text-primary)",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "14px",
  color: "var(--text-secondary)",
};

const errorTextStyle: CSSProperties = {
  color: "#EF4444",
  fontSize: 12,
  marginTop: 4,
  marginBottom: 0,
};

const cleaningScheduleSchema = z.object({
  dayOfWeek: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ]),
  startTime: z.string().min(1, "Debes capturar una hora"),
  durationHours: z
    .number()
    .positive("La duración debe ser mayor que 0")
    .max(12, "La duración máxima es de 12 horas"),
  active: z.boolean(),
});
type CleaningScheduleValues = z.infer<typeof cleaningScheduleSchema>;

const CLEANING_SCHEDULE_DEFAULTS: CleaningScheduleValues = {
  dayOfWeek: "monday",
  startTime: "09:00",
  durationHours: 1.5,
  active: true,
};

export default function CleaningUnitDetailPage() {
  const params = useParams();
  const router = useRouter();

  const buildingId = params.buildingId as string;
  const unitId = params.unitId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CleaningScheduleValues>({
    resolver: zodResolver(cleaningScheduleSchema),
    defaultValues: CLEANING_SCHEDULE_DEFAULTS,
  });

  const [loadingPage, setLoadingPage] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId && unitId) {
      loadPageData();
    }
  }, [user, buildingId, unitId]);

  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitId) return;

    setLoadingPage(true);
    setMsg("");

    const [buildingRes, unitRes, scheduleRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, company_id, name, address")
        .eq("id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .single(),

      supabase
        .from("units")
        .select("id, company_id, building_id, unit_number, display_code, floor, status")
        .eq("id", unitId)
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .single(),

      supabase
        .from("cleaning_unit_schedules")
        .select("id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("unit_id", unitId)
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);

    if (buildingRes.error || !buildingRes.data) {
      setMsg("No se pudo cargar el edificio.");
      setLoadingPage(false);
      return;
    }

    if (unitRes.error || !unitRes.data) {
      setMsg("No se pudo cargar el departamento.");
      setLoadingPage(false);
      return;
    }

    setBuilding(buildingRes.data as Building);
    setUnit(unitRes.data as Unit);

    const schedule = scheduleRes.data as CleaningUnitSchedule | null;

    if (schedule) {
      setScheduleId(schedule.id);
      reset({
        dayOfWeek: (schedule.day_of_week as CleaningScheduleValues["dayOfWeek"]) || "monday",
        startTime: schedule.start_time ? schedule.start_time.slice(0, 5) : "09:00",
        durationHours: schedule.duration_hours ?? 1.5,
        active: Boolean(schedule.active),
      });
    } else {
      setScheduleId(null);
      reset(CLEANING_SCHEDULE_DEFAULTS);
    }

    setLoadingPage(false);
  }

  const handleSave = handleSubmit(async (data) => {
    if (!user?.company_id || !buildingId || !unitId) return;

    setMsg("");

    const payload = {
      company_id: user.company_id,
      building_id: buildingId,
      unit_id: unitId,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      duration_hours: data.durationHours,
      active: data.active,
    };

    let errorMessage = "";

    if (scheduleId) {
      const { error } = await supabase
        .from("cleaning_unit_schedules")
        .update(payload)
        .eq("id", scheduleId)
        .eq("company_id", user.company_id)
        .eq("building_id", buildingId)
        .eq("unit_id", unitId);

      if (error) {
        errorMessage = error.message;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("cleaning_unit_schedules")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        errorMessage = error.message;
      } else if (inserted?.id) {
        setScheduleId(inserted.id);
      }
    }

    if (errorMessage) {
      setMsg(errorMessage);
      return;
    }

    setMsg("Programación guardada correctamente.");
    await loadPageData();
  });

  const unitLabel = useMemo(() => {
    if (!unit) return "";
    return unit.display_code || unit.unit_number || "Unidad sin nombre";
  }, [unit]);

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>Cargando...</div>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (!building || !unit) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--badge-text-red)" }}>
          {msg || "No se encontró la unidad."}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Programación de limpieza"
        subtitle={`Configura la limpieza interior de ${unitLabel} en ${building.name}.`}
        titleIcon={<Home size={18} />}
        actions={
          <UiButton
            href={`/buildings/${buildingId}/cleaning/units`}
            icon={<ArrowLeft size={16} />}
          >
            Volver a unidades
          </UiButton>
        }
      />

      <SectionCard
        title="Resumen del departamento"
        subtitle="Información base para definir la limpieza interior."
      >
        <AppGrid minWidth={220}>
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={labelTinyStyle}>Unidad</span>
              <span style={valueStrongStyle}>{unitLabel}</span>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={labelTinyStyle}>Piso</span>
              <span style={valueStrongStyle}>
                {unit.floor !== null ? `Piso ${unit.floor}` : "Sin piso"}
              </span>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={labelTinyStyle}>Estatus</span>
              <span style={valueStrongStyle}>{unit.status || "Sin estatus"}</span>
            </div>
          </AppCard>
        </AppGrid>
      </SectionCard>

      <SectionCard
        title="Configuración"
        subtitle="Define el día, la hora y la duración estimada del servicio."
        icon={<Clock3 size={18} />}
      >
        <AppCard>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <AppGrid minWidth={240}>
              <AppFormField label="Día de limpieza" required>
                <select {...register("dayOfWeek")} style={inputStyle}>
                  {dayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
                {errors.dayOfWeek ? (
                  <p style={errorTextStyle}>{errors.dayOfWeek.message}</p>
                ) : null}
              </AppFormField>

              <AppFormField label="Hora de inicio" required>
                <input
                  type="time"
                  {...register("startTime")}
                  style={inputStyle}
                />
                {errors.startTime ? (
                  <p style={errorTextStyle}>{errors.startTime.message}</p>
                ) : null}
              </AppFormField>

              <AppFormField
                label="Duración estimada (horas)"
                required
                helperText="Ejemplos: 1.5, 2, 3"
              >
                <input
                  type="number"
                  min="0.5"
                  max="12"
                  step="0.5"
                  {...register("durationHours", { valueAsNumber: true })}
                  style={inputStyle}
                />
                {errors.durationHours ? (
                  <p style={errorTextStyle}>{errors.durationHours.message}</p>
                ) : null}
              </AppFormField>
            </AppGrid>

            <label style={checkboxRowStyle}>
              <input type="checkbox" {...register("active")} />
              Programación activa
            </label>

            {msg ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--border-radius-lg)",
                  background: msg.includes("correctamente") ? "var(--badge-bg-green)" : "var(--badge-bg-red)",
                  color: msg.includes("correctamente") ? "var(--badge-text-green)" : "var(--badge-text-red)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {msg}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <UiButton icon={<Save size={16} />} type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar programación"}
              </UiButton>
            </div>
          </form>
        </AppCard>
      </SectionCard>
    </PageContainer>
  );
}

const labelTinyStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const valueStrongStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text-primary)",
};