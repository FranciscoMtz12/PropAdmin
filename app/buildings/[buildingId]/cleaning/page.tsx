"use client";

/*
  Cleaning landing page for a building.

  Esta versión mezcla lo mejor de las dos ideas:
  - Mantiene el look visual que ya te gustaba:
    - colores por categoría
    - nombre del edificio
    - dirección
  - Simplifica el contenido para que no se vea sobrecargado
  - Deja navegación clara hacia:
    - exterior
    - common
    - units
*/

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Brush, Building2, Home, Leaf, Sparkles } from "lucide-react";

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
          "Programa qué días se limpia el exterior del edificio, con bloques simples de mañana y tarde.",
        color: "#166534",
        background: "#F0FDF4",
        border: "#BBF7D0",
        badgeText: "Exterior",
        icon: <Leaf size={18} />,
        href: `/buildings/${buildingId}/cleaning/exterior`,
        buttonLabel: "Ver programación",
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
      },
    ],
    [buildingId]
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
        subtitle="Selecciona qué tipo de limpieza quieres programar."
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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    paddingTop: 4,
                  }}
                >
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