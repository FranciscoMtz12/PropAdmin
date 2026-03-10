"use client";

/*
  Página para administrar los assets de un departamento.

  Ahora sigue el sistema visual global de PropAdmin y usa iconos
  para que cada equipo tenga una identidad visual más clara.
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
  if (status === "ACTIVE") return { background: "#DCFCE7", color: "#166534" };
  if (status === "PENDING") return { background: "#FEF3C7", color: "#B45309" };
  if (status === "INACTIVE") return { background: "#F3F4F6", color: "#374151" };
  return { background: "#EFF6FF", color: "#1D4ED8" };
}

function StatusPill({ status }: { status: string }) {
  const colors = getAssetStatusColors(status);

  return (
    <AppBadge
      backgroundColor={colors.background}
      textColor={colors.color}
      borderColor={colors.background}
      style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px" }}
    >
      {getAssetStatusLabel(status)}
    </AppBadge>
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
      loadPageData();
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

    setBuilding(buildingData);

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

    setUnit(unitData);

    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .select("id, company_id, building_id, unit_id, asset_type, name, status, notes")
      .eq("unit_id", unitId)
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
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
        <p style={{ color: "#0F172A" }}>{loading ? "Cargando usuario..." : "Cargando assets..."}</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (!building || !unit) {
    return (
      <PageContainer>
        <p style={{ color: "#B91C1C", marginBottom: "16px" }}>{msg || "No se encontró el contexto del equipo."}</p>
        <UiButton href={`/buildings/${buildingId}/units/${unitId}`}>Volver al departamento</UiButton>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Assets del departamento"
        subtitle={`${building.name} • Departamento ${unit.unit_number}`}
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/units/${unit.id}`}>Volver al departamento</UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Crear asset
            </UiButton>
          </>
        }
      />

      {msg ? (
        <div
          style={{
            marginBottom: "18px",
            border: `1px solid ${msg.includes("correctamente") ? "#BBF7D0" : "#FECACA"}`,
            background: msg.includes("correctamente") ? "#F0FDF4" : "#FEF2F2",
            color: msg.includes("correctamente") ? "#166534" : "#B91C1C",
            padding: "12px 14px",
            borderRadius: "12px",
            fontWeight: 600,
          }}
        >
          {msg}
        </div>
      ) : null}

      {assets.length === 0 ? (
        <AppCard style={{ padding: 28, borderRadius: 18, color: "#667085" }}>
          Todavía no hay assets registrados para este departamento.
        </AppCard>
      ) : (
        <AppGrid minWidth={320} gap={20}>
          {assets.map((asset) => (
            <AppCard key={asset.id} style={{ borderRadius: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "14px" }}>
                <AssetTypeIcon assetType={asset.asset_type} size={18} />

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "28px", fontWeight: 700, marginBottom: "6px", lineHeight: 1.1, color: "#111827" }}>
                    {asset.name}
                  </div>
                  <div style={{ color: "#667085", marginBottom: "12px" }}>{asset.asset_type}</div>
                  <StatusPill status={asset.status} />
                </div>
              </div>

              {asset.notes ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "#475467", marginBottom: "14px" }}>
                  <Tag size={15} style={{ marginTop: "2px", flexShrink: 0 }} />
                  <p style={{ margin: 0 }}>{asset.notes}</p>
                </div>
              ) : null}

              <UiButton href={`/buildings/${building.id}/units/${unit.id}/assets/${asset.id}`}>Ver asset</UiButton>
            </AppCard>
          ))}
        </AppGrid>
      )}

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
              <select value={assetType} onChange={(e) => setAssetType(e.target.value)} style={inputStyle}>
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
              <select value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)} style={inputStyle}>
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
                style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <UiButton onClick={() => setIsCreateModalOpen(false)}>Cancelar</UiButton>
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
