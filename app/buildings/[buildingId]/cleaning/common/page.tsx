"use client";

/*
Página de programación de limpieza de áreas comunes.

Permite seleccionar los días semanales de limpieza
para las áreas comunes del edificio.

Mañana: lunes a sábado
Tarde: lunes a viernes

Importante:
- La UI está en español.
- La base de datos guarda los valores internos en inglés:
  monday, tuesday, wednesday, etc.
*/

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Brush, Save } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import UiButton from "@/components/UiButton";

type DayOption = {
  value: string;
  label: string;
};

const morningDays: DayOption[] = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
];

const afternoonDays: DayOption[] = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
];

export default function CleaningCommonPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.buildingId as string;

  const { user, loading } = useCurrentUser();

  const [morningSelected, setMorningSelected] = useState<string[]>([]);
  const [afternoonSelected, setAfternoonSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) {
      loadSchedule();
    }
  }, [user, buildingId]);

  async function loadSchedule() {
    const { data } = await supabase
      .from("cleaning_building_schedules")
      .select("*")
      .eq("building_id", buildingId)
      .eq("company_id", user?.company_id)
      .eq("cleaning_type", "common");

    if (!data) return;

    const morning = data
      .filter((item) => item.time_block === "morning")
      .map((item) => item.day_of_week);

    const afternoon = data
      .filter((item) => item.time_block === "afternoon")
      .map((item) => item.day_of_week);

    setMorningSelected(morning);
    setAfternoonSelected(afternoon);
  }

  function toggleDay(day: string, block: "morning" | "afternoon") {
    if (block === "morning") {
      setMorningSelected((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      );
      return;
    }

    setAfternoonSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function saveSchedule() {
    if (!user?.company_id) return;

    try {
      setSaving(true);

      await supabase
        .from("cleaning_building_schedules")
        .delete()
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .eq("cleaning_type", "common");

      const rows = [
        ...morningSelected.map((day) => ({
          company_id: user.company_id,
          building_id: buildingId,
          cleaning_type: "common",
          day_of_week: day,
          time_block: "morning",
        })),
        ...afternoonSelected.map((day) => ({
          company_id: user.company_id,
          building_id: buildingId,
          cleaning_type: "common",
          day_of_week: day,
          time_block: "afternoon",
        })),
      ];

      if (rows.length > 0) {
        const { error } = await supabase
          .from("cleaning_building_schedules")
          .insert(rows);

        if (error) {
          alert("No se pudo guardar la programación.");
          return;
        }
      }

      alert("Programación guardada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <p style={{ padding: 20 }}>Cargando...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Áreas comunes"
        subtitle="Define qué días se limpian las áreas comunes del edificio."
        titleIcon={<Brush size={18} />}
        actions={
          <UiButton
            href={`/buildings/${buildingId}/cleaning`}
            icon={<ArrowLeft size={16} />}
          >
            Volver
          </UiButton>
        }
      />

      <AppGrid minWidth={300}>
        <SectionCard title="Turno de mañana">
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {morningDays.map((day) => (
                <label
                  key={day.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={morningSelected.includes(day.value)}
                    onChange={() => toggleDay(day.value, "morning")}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </AppCard>
        </SectionCard>

        <SectionCard title="Turno de tarde">
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {afternoonDays.map((day) => (
                <label
                  key={day.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={afternoonSelected.includes(day.value)}
                    onChange={() => toggleDay(day.value, "afternoon")}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </AppCard>
        </SectionCard>
      </AppGrid>

      <div style={{ marginTop: 24 }}>
        <UiButton
          icon={<Save size={16} />}
          onClick={saveSchedule}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar programación"}
        </UiButton>
      </div>
    </PageContainer>
  );
}