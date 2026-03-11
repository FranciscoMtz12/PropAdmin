"use client";

/*
  Página de limpieza del edificio.

  Esta pantalla es un primer paso para estructurar el módulo de limpieza,
  manteniendo la experiencia visual de PropAdmin:
  - se carga el edificio desde Supabase
  - se presentan tres áreas de limpieza en cards limpias
  - se deja un espacio para programación (calendario / turnos) en el futuro

  En fases siguientes se podrá:
  - agregar tareas recurrentes por área
  - asociar responsables (staff de limpieza)
  - visualizar agenda / calendario
*/

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brush, Building2, Home, Layers, CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppIconBox from "@/components/AppIconBox";
import UiButton from "@/components/UiButton";

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  code: string | null;
};

export default function BuildingCleaningPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params.buildingId as string;
  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [loadingBuilding, setLoadingBuilding] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) {
      loadBuilding();
    }
  }, [user, buildingId]);

  async function loadBuilding() {
    if (!user?.company_id || !buildingId) return;

    setLoadingBuilding(true);
    setMsg("");

    const { data, error } = await supabase
      .from("buildings")
      .select("id, company_id, name, address, code")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .single();

    if (error || !data) {
      setMsg("No se pudo cargar la información del edificio.");
      setLoadingBuilding(false);
      return;
    }

    setBuilding(data as Building);
    setLoadingBuilding(false);
  }

  if (loading) return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user) return null;
  if (loadingBuilding) return <PageContainer>Cargando edificio...</PageContainer>;
  if (!building) return <PageContainer>{msg || "No se encontró el edificio."}</PageContainer>;

  const cleaningAreas = [
    {
      key: "exterior",
      title: "Exterior del edificio",
      description: "Fachadas, estacionamientos y accesos.",
      icon: <Building2 size={18} />, 
    },
    {
      key: "common",
      title: "Áreas comunes",
      description: "Pasillos, escaleras, lobby y zonas de convivencia.",
      icon: <Layers size={18} />,
    },
    {
      key: "units",
      title: "Interior de unidades",
      description: "Departamentos y espacios privados (limpieza profunda).",
      icon: <Home size={18} />,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={`Limpieza · ${building.name}`}
        titleIcon={<Brush size={20} />}
        subtitle="Organiza las áreas de limpieza del edificio y mantén el plan operativo para el equipo de facility." 
        actions={
          <>
            <UiButton href={`/buildings/${building.id}`}>Volver al edificio</UiButton>
            <UiButton href={`/buildings/${building.id}/maintenance`}>Mantenimiento</UiButton>
          </>
        }
      />

      <SectionCard
        title="Áreas de limpieza"
        subtitle="Selecciona un área para ver detalles y pasos sugeridos." 
        icon={<Brush size={24} />}
      >
        <AppGrid>
          {cleaningAreas.map((area) => (
            <AppCard key={area.key} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <AppIconBox size={40} radius={12} background="#ECFDF5" color="#166534">
                  {area.icon}
                </AppIconBox>

                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{area.title}</h3>
                  <p style={{ margin: "8px 0 14px", color: "#667085" }}>{area.description}</p>
                  <UiButton variant="secondary" disabled>
                    Ver (próximamente)
                  </UiButton>
                </div>
              </div>
            </AppCard>
          ))}
        </AppGrid>
      </SectionCard>

      <SectionCard
        title="Programación de limpieza"
        subtitle="Próximamente podrás crear ciclos y turnos para mantener todo al día."
        icon={<CalendarClock size={24} />}
      >
        <p style={{ margin: 0, color: "#667085" }}>
          En esta sección tendrás una agenda con frecuencia, responsables y recordatorios.
        </p>

        <div style={{ marginTop: 18 }}>
          <UiButton variant="secondary" disabled>
            Ver calendario (próximamente)
          </UiButton>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
