"use client";

/*
Página de programación de limpieza exterior.

Permite seleccionar los días semanales de limpieza
para el exterior del edificio.

Mañana: lunes a sábado
Tarde: lunes a viernes

Importante:
- La UI está en español.
- La base de datos sigue guardando los valores internos en inglés:
  monday, tuesday, wednesday, etc.
*/

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Leaf, Save, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import Modal from "@/components/Modal";
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

export default function CleaningExteriorPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.buildingId as string;

  const { user, loading } = useCurrentUser();

  const [morningSelected, setMorningSelected] = useState<string[]>([]);
  const [afternoonSelected, setAfternoonSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState("");
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

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
    const { data, error } = await supabase
      .from("cleaning_building_schedules")
      .select("*")
      .eq("building_id", buildingId)
      .eq("company_id", user?.company_id)
      .eq("cleaning_type", "exterior")
      .is("deleted_at", null);

    if (error || !data) return;

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
      setMsg("");

      // Soft delete: archiva los registros existentes antes de insertar los nuevos
      await supabase
        .from("cleaning_building_schedules")
        .update({ deleted_at: new Date().toISOString() })
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .eq("cleaning_type", "exterior")
        .is("deleted_at", null);

      const rows = [
        ...morningSelected.map((day) => ({
          company_id: user.company_id,
          building_id: buildingId,
          cleaning_type: "exterior",
          day_of_week: day,
          time_block: "morning",
        })),
        ...afternoonSelected.map((day) => ({
          company_id: user.company_id,
          building_id: buildingId,
          cleaning_type: "exterior",
          day_of_week: day,
          time_block: "afternoon",
        })),
      ];

      if (rows.length > 0) {
        const { error } = await supabase
          .from("cleaning_building_schedules")
          .insert(rows);

        if (error) {
          setMsg("No se pudo guardar la programación.");
          return;
        }
      }

      setMsg("Programación guardada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  function clearSchedule() {
    // Abre el modal de confirmación en lugar de usar window.confirm
    setIsClearModalOpen(true);
  }

  async function handleClearConfirmed() {
    if (!user?.company_id) return;

    try {
      setClearing(true);
      setMsg("");
      setIsClearModalOpen(false);

      // Soft delete: archiva la programación en lugar de eliminarla físicamente
      const { error } = await supabase
        .from("cleaning_building_schedules")
        .update({ deleted_at: new Date().toISOString() })
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .eq("cleaning_type", "exterior")
        .is("deleted_at", null);

      if (error) {
        setMsg("No se pudo limpiar la programación.");
        return;
      }

      setMorningSelected([]);
      setAfternoonSelected([]);
      setMsg("La programación se limpió correctamente.");
    } finally {
      setClearing(false);
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
        title="Exterior del edificio"
        subtitle="Define qué días se limpia el exterior del edificio."
        titleIcon={<Leaf size={18} />}
        actions={
          <UiButton
            href={`/buildings/${buildingId}/cleaning`}
            icon={<ArrowLeft size={16} />}
          >
            Volver
          </UiButton>
        }
      />

      {msg ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: msg.includes("correctamente") ? "#ECFDF5" : "#FEF2F2",
            color: msg.includes("correctamente") ? "#166534" : "#B91C1C",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {msg}
        </div>
      ) : null}

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

      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <UiButton
          icon={<Save size={16} />}
          onClick={saveSchedule}
          disabled={saving || clearing}
        >
          {saving ? "Guardando..." : "Guardar programación"}
        </UiButton>

        <UiButton
          icon={<Trash2 size={16} />}
          onClick={clearSchedule}
          disabled={saving || clearing}
        >
          {clearing ? "Limpiando..." : "Limpiar programación"}
        </UiButton>
      </div>

      {/* Modal de confirmación para limpiar la programación */}
      <Modal
        open={isClearModalOpen}
        onClose={() => { if (!clearing) setIsClearModalOpen(false); }}
        title="Limpiar programación"
        maxWidth="480px"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: "#FFF7ED",
              border: "1px solid #FED7AA",
              color: "#9A3412",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            ¿Limpiar toda la programación de limpieza exterior? Esta acción archivará
            los registros actuales pero conservará su historial.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <UiButton
              type="button"
              variant="secondary"
              onClick={() => setIsClearModalOpen(false)}
              disabled={clearing}
            >
              Cancelar
            </UiButton>
            <UiButton
              type="button"
              onClick={() => void handleClearConfirmed()}
              disabled={clearing}
            >
              <Trash2 size={16} />
              {clearing ? "Limpiando..." : "Limpiar programación"}
            </UiButton>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
