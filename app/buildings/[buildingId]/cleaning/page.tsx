"use client";

/*
  Página de Cleaning del edificio.

  Objetivo de esta versión:
  - Mantener la base ya conectada al building detail.
  - Mejorar la presentación del módulo para que se sienta alineado al design system.
  - Dejar claro que Cleaning será un módulo separado de Maintenance.
  - Preparar el terreno para próximas fases:
    1) detalle por categoría
    2) tareas recurrentes
    3) responsables
    4) agenda / calendario
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

type CleaningArea = {
  key: string;
  title: string;
  description: string;
  color: string;
  background: string;
  border: string;
  badgeText: string;
  icon: React.ReactNode;
  bullets: string[];
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

  const cleaningAreas = useMemo<CleaningArea[]>(
    () => [
      {
        key: "exterior",
        title: "Exterior del edificio",
        description:
          "Controla la limpieza de accesos, fachada, estacionamiento y perímetro general.",
        color: "#166534",
        background: "#F0FDF4",
        border: "#BBF7D0",
        badgeText: "Exterior",
        icon: <Leaf size={18} />,
        bullets: [
          "Fachada y acceso principal",
          "Perímetro y estacionamiento",
          "Basura exterior y presentación general",
        ],
      },
      {
        key: "common",
        title: "Áreas comunes",
        description:
          "Organiza pasillos, escaleras, lobby y espacios compartidos del edificio.",
        color: "#1D4ED8",
        background: "#EFF6FF",
        border: "#BFDBFE",
        badgeText: "Común",
        icon: <Brush size={18} />,
        bullets: [
          "Lobby, escaleras y elevadores",
          "Pasillos y zonas de circulación",
          "Áreas de convivencia o amenities",
        ],
      },
      {
        key: "units",
        title: "Interior de unidades",
        description:
          "Prepara la operación para limpiezas profundas, entregas y rotación de departamentos.",
        color: "#7C3AED",
        background: "#F5F3FF",
        border: "#DDD6FE",
        badgeText: "Unidad",
        icon: <Home size={18} />,
        bullets: [
          "Limpieza pre check-in / post salida",
          "Limpieza profunda de unidades",
          "Seguimiento de estándar interior",
        ],
      },
    ],
    []
  );

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>Cargando usuario...</div>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (loadingBuilding) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>Cargando edificio...</div>
      </PageContainer>
    );
  }

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
        subtitle="Módulo operativo para organizar la limpieza del edificio por áreas, con una base lista para crecer hacia tareas, responsables y agenda."
        titleIcon={<Sparkles size={18} />}
        actions={
          <>
            <UiButton
              href={`/buildings/${buildingId}`}
              icon={<ArrowLeft size={16} />}
            >
              Volver al edificio
            </UiButton>

            <UiButton
              href={`/buildings/${buildingId}/maintenance`}
              icon={<Wrench size={16} />}
            >
              Mantenimiento
            </UiButton>
          </>
        }
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Edificio"
          value={building.name}
          helper="Activo"
          icon={<Building2 size={18} />}
        />
        <MetricCard
          label="Código"
          value={building.code || "Sin código"}
          helper="Referencia"
          icon={<CheckCircle2 size={18} />}
        />
        <MetricCard
          label="Categorías de limpieza"
          value={cleaningAreas.length}
          helper="Base del módulo"
          icon={<Brush size={18} />}
        />
        <MetricCard
          label="Agenda"
          value="Próximamente"
          helper="Siguiente fase"
          icon={<CalendarClock size={18} />}
        />
      </AppGrid>

      <SectionCard
        title="Resumen del edificio"
        subtitle="Contexto base del inmueble para trabajar la operación de limpieza."
        icon={<Building2 size={18} />}
      >
        <AppGrid minWidth={280}>
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
        </AppGrid>
      </SectionCard>

      <SectionCard
        title="Áreas de limpieza"
        subtitle="Cada bloque representa una futura línea operativa separada dentro del módulo de Cleaning."
        icon={<Brush size={18} />}
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

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {area.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        color: "#374151",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: area.color,
                          flexShrink: 0,
                        }}
                      />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    paddingTop: 4,
                  }}
                >
                  <UiButton disabled>Ver detalle (próximamente)</UiButton>
                </div>
              </div>
            </AppCard>
          ))}
        </AppGrid>
      </SectionCard>

      <SectionCard
        title="Qué sigue en este módulo"
        subtitle="Esta parte deja claro el crecimiento lógico de Cleaning sin mezclarlo con Maintenance."
        icon={<CalendarClock size={18} />}
      >
        <AppGrid minWidth={260}>
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                1. Detalle por categoría
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#4B5563",
                }}
              >
                Crear una vista individual para Exterior, Áreas comunes e Interior de
                unidades.
              </p>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                2. Tareas recurrentes
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#4B5563",
                }}
              >
                Registrar frecuencia, checklist, prioridad y estatus operativo de cada
                limpieza.
              </p>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                3. Agenda y responsables
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#4B5563",
                }}
              >
                Conectar el módulo con programación operativa, calendario y personal
                asignado.
              </p>
            </div>
          </AppCard>
        </AppGrid>
      </SectionCard>
    </PageContainer>
  );
}