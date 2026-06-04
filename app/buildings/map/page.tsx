"use client";

/*
  Página de mapa de edificios.

  Carga todos los edificios de la empresa que tengan coordenadas
  (latitude y longitude NO NULL) y los renderiza en un mapa Leaflet.

  El componente del mapa se importa dinámicamente (ssr: false) porque
  Leaflet necesita `window` y no puede renderizarse en el servidor.
*/

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, MapPin } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useActiveCompanyId } from "@/lib/useActiveCompanyId";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import UiButton from "@/components/UiButton";

import type { BuildingMapPoint } from "@/components/BuildingsMap";

/* Importación dinámica del mapa: SSR off para evitar errores de Leaflet. */
const BuildingsMap = dynamic(() => import("@/components/BuildingsMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 600,
        width: "100%",
        borderRadius: "var(--border-radius-lg)",
        background: "var(--bg-card-hover)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "0.875rem",
      }}
    >
      Cargando mapa...
    </div>
  ),
});

type BuildingRow = {
  id:        string;
  name:      string;
  address:   string | null;
  latitude:  number | null;
  longitude: number | null;
};

export default function BuildingsMapPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const activeCompanyId = useActiveCompanyId();
  const isSuperAdmin = user?.role === "superadmin" || Boolean(user?.is_superadmin);

  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (userLoading) return;
    if (!user) return;
    void loadBuildings(activeCompanyId);
  }, [userLoading, user, activeCompanyId]);

  async function loadBuildings(companyId: string | null) {
    setLoadingPage(true);
    setMsg("");
    let q = supabase
      .from("buildings")
      .select("id, name, address, latitude, longitude")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;

    if (error) {
      setMsg(`No se pudieron cargar los edificios: ${error.message}`);
      setBuildings([]);
    } else {
      setBuildings((data as BuildingRow[]) || []);
    }
    setLoadingPage(false);
  }

  /* Sólo los edificios con coordenadas válidas aparecen en el mapa. */
  const mapPoints = useMemo<BuildingMapPoint[]>(() => {
    return buildings
      .filter(
        (b): b is BuildingRow & { latitude: number; longitude: number } =>
          b.latitude !== null && b.longitude !== null,
      )
      .map((b) => ({
        id:        b.id,
        name:      b.name,
        address:   b.address,
        latitude:  b.latitude,
        longitude: b.longitude,
      }));
  }, [buildings]);

  const withoutCoordsCount = buildings.length - mapPoints.length;

  /* Persiste la nueva ubicación de un edificio tras arrastrarlo. */
  async function handleUpdateLocation(
    id: string,
    latitude: number,
    longitude: number,
  ) {
    if (!user?.company_id) return;

    const building = buildings.find((b) => b.id === id);
    const toastId = toast.loading("Actualizando ubicación...");

    const { error } = await supabase
      .from("buildings")
      .update({ latitude, longitude })
      .eq("id", id)
      .eq("company_id", user.company_id);

    if (error) {
      toast.dismiss(toastId);
      toast.error(`No se pudo actualizar: ${error.message}`);
      return;
    }

    setBuildings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, latitude, longitude } : b)),
    );

    toast.dismiss(toastId);
    toast.success(`Ubicación de ${building?.name || "edificio"} actualizada`);
  }

  if (userLoading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>
          Cargando mapa...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mapa de edificios"
        titleIcon={<MapPin size={20} />}
        actions={
          <UiButton href="/buildings">
            <ArrowLeft size={16} />
            Ver lista
          </UiButton>
        }
      />

      {msg ? (
        <AppCard>
          <div style={{ color: "var(--badge-text-red)", fontWeight: 600 }}>
            {msg}
          </div>
        </AppCard>
      ) : null}

      <AppCard style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
            <strong>{mapPoints.length}</strong>{" "}
            edificio{mapPoints.length === 1 ? "" : "s"} en el mapa
            {withoutCoordsCount > 0 ? (
              <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                · {withoutCoordsCount} sin coordenadas
              </span>
            ) : null}
          </div>
        </div>

        {mapPoints.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
            }}
          >
            No hay edificios con coordenadas capturadas. Edita un edificio y
            agrega latitud/longitud para verlo aquí.
          </div>
        ) : (
          <BuildingsMap
            buildings={mapPoints}
            onUpdateLocation={isSuperAdmin ? handleUpdateLocation : undefined}
          />
        )}
      </AppCard>
    </PageContainer>
  );
}
