"use client";

/**
 * Página para administrar los assets de un departamento.
 * Mantiene el sistema visual global de PropAdmin y usa íconos
 * para que cada equipo tenga una identidad visual más clara.
 *
 * Cambio importante:
 * - Ahora la lista excluye assets con soft delete usando:
 *   .is("deleted_at", null)
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Tag } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import AppBadge from "@/components/AppBadge";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AssetTypeIcon from "@/components/AssetTypeIcon";

type Building = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
};

type UnitDetail = {
  id: string;
  company_id: string;
  building_id: string;
  unit_number: string;
  display_code: string | null;
};

type AssetRow = {
  id: string;
  company_id: string;
  building_id: string;
  unit_id: string;
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: 600,
  marginBottom: "8px",
  color: "#111827",
};

function getAssetStatusLabel(status: string) {
  if (status === "ACTIVE") return "Activo";
  if (status === "PENDING") return "Pendiente";
  if (status === "INACTIVE") return "Inactivo";
  return status;
}

function getAssetStatusColors(status: string) {
  if (status === "ACTIVE") {
    return { background: "#DCFCE7", color: "#166534" };
  }

  if (status === "PENDING") {
    return { background: "#FEF3C7", color: "#B45309" };
  }

  if (status === "INACTIVE") {
    return { background: "#F3F4F6", color: "#374151" };
  }

  return { background: "#EFF6FF", color: "#1D4ED8" };
}

function StatusPill({ status }: { status: string }) {
  const colors = getAssetStatusColors(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 700,
        background: colors.background,
        color: colors.color,
      }}
    >
      {getAssetStatusLabel(status)}
    </span>
  );
}

export default function UnitAssetsPage() {
  const router = useRouter();
  const params = useParams();

  const buildingId = params.buildingId as string;
  const unitId = params.unitId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const [assetType, setAssetType] = useState("MINISPLIT");
  const [assetName, setAssetName] = useState("");
  const [assetStatus, setAssetStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId && unitId) {
      void loadPageData();
    }
  }, [user, buildingId, unitId]);

  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitId) return;

    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name, code")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .single();

    if (buildingError) {
      setMsg("No se pudo cargar el edificio.");
      setLoadingData(false);
      return;
    }

    setBuilding(buildingData as Building);

    const { data: unitData, error: unitError } = await supabase
      .from("units")
      .select("id, company_id, building_id, unit_number, display_code")
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
      .single();

    if (unitError) {
      setMsg("No se pudo cargar el departamento.");
      setLoadingData(false);
      return;
    }

    setUnit(unitData as UnitDetail);

    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .select("id, company_id, building_id, unit_id, asset_type, name, status, notes")
      .eq("unit_id", unitId)
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
      /**
       * Cambio clave:
       * Solo traemos assets que NO han sido eliminados lógicamente.
       * Esto alinea esta vista con el soft delete ya implementado.
       */
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (assetError) {
      setMsg("No se pudieron cargar los assets.");
      setLoadingData(false);
      return;
    }

    setAssets((assetData as AssetRow[]) || []);
    setLoadingData(false);
  }

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!user?.company_id) {
      setMsg("No se encontró la empresa del usuario.");
      return;
    }

    if (!building || !unit) {
      setMsg("No se encontró la información del departamento.");
      return;
    }

    if (!assetName.trim()) {
      setMsg("El nombre del asset es obligatorio.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("assets").insert({
      company_id: user.company_id,
      building_id: building.id,
      unit_id: unit.id,
      asset_type: assetType,
      name: assetName.trim(),
      status: assetStatus,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setAssetType("MINISPLIT");
    setAssetName("");
    setAssetStatus("ACTIVE");
    setNotes("");
    setIsCreateModalOpen(false);
    setMsg("Equipo guardado correctamente.");

    await loadPageData();
  }

  if (loading || loadingData) {
    return (
      <PageContainer>
        <div
          style={{
            minHeight: "40vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6B7280",
            fontWeight: 600,
          }}
        >
          {loading ? "Cargando usuario..." : "Cargando assets..."}
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (!building || !unit) {
    return (
      <PageContainer>
        <AppCard>
          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{ color: "#B91C1C", fontWeight: 600 }}>
              {msg || "No se encontró el contexto del equipo."}
            </div>

            <div>
              <UiButton
                onClick={() =>
                  router.push(`/buildings/${buildingId}/units/${unitId}`)
                }
              >
                Volver al departamento
              </UiButton>
            </div>
          </div>
        </AppCard>
      </PageContainer>
    );
  }

  const unitDisplay = unit.display_code?.trim() || unit.unit_number;

  return (
    <PageContainer>
      <PageHeader
        title={`Assets · ${unitDisplay}`}
        subtitle={`Administra los equipos y activos del departamento en ${building.name}.`}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <UiButton
              onClick={() => router.push(`/buildings/${buildingId}/units/${unitId}`)}
            >
              Volver al departamento
            </UiButton>

            <UiButton
              onClick={() => setIsCreateModalOpen(true)}
              variant="primary"
              icon={<Plus size={16} />}
            >
              Crear asset
            </UiButton>
          </div>
        }
      />

      <div style={{ display: "grid", gap: "18px" }}>
        {msg ? (
          <AppCard>
            <div style={{ color: "#1D4ED8", fontWeight: 600 }}>{msg}</div>
          </AppCard>
        ) : null}

        {assets.length === 0 ? (
          <AppCard>
            <div style={{ padding: "8px 2px", color: "#6B7280", fontWeight: 500 }}>
              Todavía no hay assets registrados para este departamento.
            </div>
          </AppCard>
        ) : (
          <AppGrid minWidth={280}>
            {assets.map((asset) => (
              <AppCard key={asset.id}>
                <div style={{ display: "grid", gap: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "14px",
                          background: "#F3F4F6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#111827",
                          flexShrink: 0,
                        }}
                      >
                        <AssetTypeIcon assetType={asset.asset_type} size={20} />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          {asset.name}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "#6B7280",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          <Tag size={14} />
                          <span>{asset.asset_type}</span>
                        </div>
                      </div>
                    </div>

                    <StatusPill status={asset.status} />
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <AppBadge>{asset.asset_type}</AppBadge>
                  </div>

                  {asset.notes ? (
                    <div
                      style={{
                        fontSize: "14px",
                        lineHeight: 1.6,
                        color: "#4B5563",
                        background: "#F9FAFB",
                        border: "1px solid #F3F4F6",
                        borderRadius: "14px",
                        padding: "12px 14px",
                      }}
                    >
                      {asset.notes}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <UiButton
                      variant="secondary"
                      onClick={() =>
                        router.push(
                          `/buildings/${buildingId}/units/${unitId}/assets/${asset.id}`
                        )
                      }
                    >
                      Ver asset
                    </UiButton>
                  </div>
                </div>
              </AppCard>
            ))}
          </AppGrid>
        )}
      </div>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear asset"
        subtitle="El formulario se abre bajo demanda para mantener más limpia la página principal."
      >
        <form onSubmit={handleCreateAsset}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Tipo de asset</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                style={inputStyle}
              >
                <option value="MINISPLIT">MINISPLIT</option>
                <option value="CENTRAL_AC">CENTRAL_AC</option>
                <option value="FRIDGE">FRIDGE</option>
                <option value="WASHER">WASHER</option>
                <option value="DRYER">DRYER</option>
                <option value="STOVE">STOVE</option>
                <option value="FAN">FAN</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Nombre</label>
              <input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Ej. Aire acondicionado sala"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Estado</label>
              <select
                value={assetStatus}
                onChange={(e) => setAssetStatus(e.target.value)}
                style={inputStyle}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales"
                style={{
                  ...inputStyle,
                  minHeight: "110px",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "6px",
              }}
            >
              <UiButton onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </UiButton>

              <UiButton type="submit" variant="primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar asset"}
              </UiButton>
            </div>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}