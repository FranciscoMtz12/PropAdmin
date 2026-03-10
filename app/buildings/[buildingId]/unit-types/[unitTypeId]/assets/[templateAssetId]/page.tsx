"use client";

/*
  Detalle de asset base de tipología.

  Esta página ya adopta el mismo patrón visual que el detalle de assets reales:
  - header con icono
  - cards de resumen
  - información actual en SectionCard
  - edición dentro de modal
*/

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList, LayoutPanelTop, PackageOpen, PencilLine } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AssetTypeIcon from "@/components/AssetTypeIcon";

type Building = {
  id: string;
  company_id: string;
  name: string;
};

type UnitTypeDetail = {
  id: string;
  building_id: string;
  name: string;
};

type TemplateAssetDetail = {
  id: string;
  unit_type_id: string;
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
  sort_order: number;
};

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 18, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, color: "#667085", marginBottom: 8 }}>{label}</p>
          <strong style={{ fontSize: 26, lineHeight: 1.1 }}>{value}</strong>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "#EEF2FF", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      </div>
    </div>
  );
}

export default function UnitTypeAssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params.buildingId as string;
  const unitTypeId = params.unitTypeId as string;
  const templateAssetId = params.templateAssetId as string;
  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [unitType, setUnitType] = useState<UnitTypeDetail | null>(null);
  const [templateAsset, setTemplateAsset] = useState<TemplateAssetDetail | null>(null);
  const [assetType, setAssetType] = useState("MINISPLIT");
  const [assetName, setAssetName] = useState("");
  const [assetStatus, setAssetStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [showEditForm, setShowEditForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId && unitTypeId && templateAssetId) loadPageData();
  }, [user, buildingId, unitTypeId, templateAssetId]);

  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitTypeId || !templateAssetId) return;
    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .single();
    if (buildingError) {
      setMsg("No se pudo cargar el edificio.");
      setLoadingData(false);
      return;
    }
    setBuilding(buildingData);

    const { data: unitTypeData, error: unitTypeError } = await supabase
      .from("unit_types")
      .select("id, building_id, name")
      .eq("id", unitTypeId)
      .eq("building_id", buildingId)
      .single();
    if (unitTypeError) {
      setMsg("No se pudo cargar la tipología.");
      setLoadingData(false);
      return;
    }
    setUnitType(unitTypeData as UnitTypeDetail);

    const { data: templateAssetData, error: templateAssetError } = await supabase
      .from("unit_type_assets")
      .select("id, unit_type_id, asset_type, name, status, notes, sort_order")
      .eq("id", templateAssetId)
      .eq("unit_type_id", unitTypeId)
      .single();
    if (templateAssetError) {
      setMsg("No se pudo cargar el asset base.");
      setLoadingData(false);
      return;
    }

    const parsed = templateAssetData as TemplateAssetDetail;
    setTemplateAsset(parsed);
    setAssetType(parsed.asset_type || "MINISPLIT");
    setAssetName(parsed.name || "");
    setAssetStatus(parsed.status || "ACTIVE");
    setNotes(parsed.notes || "");
    setSortOrder(String(parsed.sort_order ?? 0));
    setLoadingData(false);
  }

  function cancelEditForm() {
    if (templateAsset) {
      setAssetType(templateAsset.asset_type || "MINISPLIT");
      setAssetName(templateAsset.name || "");
      setAssetStatus(templateAsset.status || "ACTIVE");
      setNotes(templateAsset.notes || "");
      setSortOrder(String(templateAsset.sort_order ?? 0));
    }
    setShowEditForm(false);
    setMsg("");
  }

  async function handleUpdateTemplateAsset(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!templateAsset) {
      setMsg("No se encontró el equipo base.");
      return;
    }
    if (!assetName.trim()) {
      setMsg("El nombre del asset base es obligatorio.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("unit_type_assets")
      .update({
        asset_type: assetType,
        name: assetName.trim(),
        status: assetStatus,
        notes: notes.trim() || null,
        sort_order: sortOrder.trim() ? Number(sortOrder) : 0,
      })
      .eq("id", templateAsset.id)
      .eq("unit_type_id", unitTypeId);
    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Asset base actualizado correctamente.");
    setShowEditForm(false);
    await loadPageData();
  }

  if (loading) return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user) return null;
  if (loadingData) return <PageContainer>Cargando asset base...</PageContainer>;
  if (!building || !unitType || !templateAsset) return <PageContainer>{msg || "No se encontró el equipo base."}</PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title={templateAsset.name}
        titleIcon={<LayoutPanelTop size={20} />}
        subtitle="Este asset todavía es una plantilla de tipología. Luego se clona al crear un departamento real de este tipo."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}/assets`}>Volver a assets base</UiButton>
            <UiButton onClick={() => setShowEditForm(true)} variant="primary">
              <PencilLine size={16} />
              Editar asset base
            </UiButton>
          </>
        }
      />

      {msg && !showEditForm ? <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: 16 }}>{msg}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Tipo" value={templateAsset.asset_type} icon={<AssetTypeIcon assetType={templateAsset.asset_type} size={18} />} />
        <SummaryCard label="Estatus" value={templateAsset.status} icon={<ClipboardList size={18} />} />
        <SummaryCard label="Orden visual" value={templateAsset.sort_order ?? 0} icon={<PackageOpen size={18} />} />
      </div>

      <SectionCard title="Información actual" subtitle="Datos base del equipo plantilla dentro de la tipología." icon={<PackageOpen size={18} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 }}><strong>Edificio</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{building.name}</p></div>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 }}><strong>Tipología</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.name}</p></div>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 }}><strong>Tipo de asset</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{templateAsset.asset_type}</p></div>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 }}><strong>Notas</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{templateAsset.notes || "Sin notas"}</p></div>
        </div>
      </SectionCard>

      <Modal
        open={showEditForm}
        onClose={cancelEditForm}
        title="Editar asset base"
        subtitle="La edición se abre en modal para mantener limpia la pantalla principal."
      >
        <form onSubmit={handleUpdateTemplateAsset}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>Tipo de asset</label>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10, background: "white" }}>
              <option value="MINISPLIT">Minisplit</option>
              <option value="CENTRAL_AC">A/C central</option>
              <option value="FRIDGE">Refrigerador</option>
              <option value="STOVE">Estufa / horno</option>
              <option value="WASHER">Lavadora</option>
              <option value="DRYER">Secadora</option>
              <option value="FAN">Abanico</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>Nombre</label>
            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8 }}>Estatus</label>
              <select value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10, background: "white" }}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8 }}>Orden visual</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10 }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8 }}>Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10, resize: "vertical" }} />
          </div>
          {msg && showEditForm ? <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: 12 }}>{msg}</p> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">{saving ? "Guardando..." : "Actualizar asset base"}</UiButton>
            <UiButton onClick={cancelEditForm}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
