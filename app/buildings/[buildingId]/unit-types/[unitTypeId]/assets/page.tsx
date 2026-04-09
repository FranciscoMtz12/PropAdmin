"use client";

/*
  Página para administrar los assets base de una tipología.

  Esta pantalla ya modela la idea clave del sistema:
  - unit_type_assets = plantilla / blueprint
  - assets = instancia real del departamento

  Aquí no creamos el asset del departamento todavía.
  Aquí solo definimos qué assets deberían nacer automáticamente cuando
  se cree un nuevo unit con esta tipología.

  Flujo recomendado:
  Lista -> Detalle del asset base -> Edición
*/

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { Edit3, LayoutPanelTop, MoreHorizontal, PackageOpen, Plus, Trash2 } from "lucide-react";
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

type UnitTypeAssetRow = {
  id: string;
  unit_type_id: string;
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
  sort_order: number;
};

export default function UnitTypeAssetsPage() {
  const router = useRouter();
  const params = useParams();

  const buildingId = params.buildingId as string;
  const unitTypeId = params.unitTypeId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [unitType, setUnitType] = useState<UnitTypeDetail | null>(null);
  const [templateAssets, setTemplateAssets] = useState<UnitTypeAssetRow[]>([]);

  /*
    Formulario para crear nuevo asset base.
  */
  const [assetType, setAssetType] = useState("MINISPLIT");
  const [assetName, setAssetName] = useState("");
  const [assetStatus, setAssetStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<UnitTypeAssetRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsAssetId, setOpenActionsAssetId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId && unitTypeId) {
      loadPageData();
    }
  }, [user, buildingId, unitTypeId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(event.target as Node)) {
        setOpenActionsAssetId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openDeleteModal(asset: UnitTypeAssetRow) {
    setAssetToDelete(asset);
    setIsDeleteModalOpen(true);
    setOpenActionsAssetId(null);
    setMsg("");
    setDeleteError(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setAssetToDelete(null);
    setDeleteError(null);
  }

  async function handleDeleteAsset() {
    if (!assetToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("unit_type_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", assetToDelete.id);
    if (error) {
      setDeleteError(`No se pudo archivar el equipo base. ${error.message}`);
      setDeleting(false);
      return;
    }
    setIsDeleteModalOpen(false);
    setAssetToDelete(null);
    setDeleting(false);
    setMsg("Equipo base archivado correctamente.");
    await loadPageData();
  }

  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitTypeId) return;

    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
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
      .eq("unit_type_id", unitTypeId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (templateAssetError) {
      setMsg("No se pudieron cargar los assets base.");
      setLoadingData(false);
      return;
    }

    setTemplateAssets((templateAssetData as UnitTypeAssetRow[]) || []);
    setLoadingData(false);
  }

  async function handleCreateTemplateAsset(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!unitType) {
      setMsg("No se encontró la tipología.");
      return;
    }

    if (!assetName.trim()) {
      setMsg("El nombre del asset base es obligatorio.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("unit_type_assets").insert({
      unit_type_id: unitType.id,
      asset_type: assetType,
      name: assetName.trim(),
      status: assetStatus,
      notes: notes.trim() || null,
      sort_order: sortOrder.trim() ? Number(sortOrder) : 0,
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
    setSortOrder("0");
    setMsg("Equipo base guardado correctamente.");
    setIsCreateModalOpen(false);

    await loadPageData();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "40px",
          background: "white",
          color: "black",
        }}
      >
        Cargando usuario...
      </div>
    );
  }

  if (!user) return null;

  if (loadingData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "40px",
          background: "white",
          color: "black",
        }}
      >
        Cargando assets base...
      </div>
    );
  }

  if (!building || !unitType) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "40px",
          background: "white",
          color: "black",
        }}
      >
        <p>{msg || "No se encontró la tipología."}</p>
        <a
          href={`/buildings/${buildingId}/unit-types`}
          style={{
            display: "inline-block",
            marginTop: "16px",
            color: "black",
          }}
        >
          Volver a tipologías
        </a>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Assets base — ${unitType.name}`}
        titleIcon={<LayoutPanelTop size={20} />}
        subtitle="Configura los equipos plantilla de la tipología con el mismo patrón visual del resto del sistema."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}`}>
              Volver a la tipología
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nuevo asset base
            </UiButton>
          </>
        }
      />

      {msg ? (
        <p
          style={{
            color: msg.includes("correctamente") ? "green" : "crimson",
            marginBottom: "16px",
          }}
        >
          {msg}
        </p>
      ) : null}

      <SectionCard
        title="Assets base"
        subtitle="Estos equipos se clonan cuando se crea un departamento de esta tipología."
        icon={<PackageOpen size={18} />}
      >
        {templateAssets.length === 0 ? (
          <p>Todavía no hay assets base para esta tipología.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {templateAssets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <AssetTypeIcon assetType={asset.asset_type} size={18} />
                  <div>
                    <p style={{ fontWeight: "bold", marginBottom: "4px" }}>
                      {asset.name}
                    </p>
                    <p style={{ margin: 0, color: "#667085", fontSize: "14px" }}>
                      {asset.asset_type}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: "12px",
                    }}
                  >
                    Orden {asset.sort_order ?? 0}
                  </span>

                  <span
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: "12px",
                    }}
                  >
                    {asset.status}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}/assets/${asset.id}`}>
                    Ver asset base
                  </UiButton>
                  <div
                    style={{ position: "relative" }}
                    ref={openActionsAssetId === asset.id ? actionsMenuRef : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenActionsAssetId(openActionsAssetId === asset.id ? null : asset.id)}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#111827", padding: "8px 10px", cursor: "pointer" }}
                      aria-label="Más acciones"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openActionsAssetId === asset.id && (
                      <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 160, borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 10px 28px rgba(15,23,42,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 30 }}>
                        <a
                          href={`/buildings/${building.id}/unit-types/${unitType.id}/assets/${asset.id}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "100%", textDecoration: "none", color: "#111827", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          <Edit3 size={14} />
                          Editar
                        </a>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(asset)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "#FEF2F2", color: "#B42318", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                          Archivar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal open={isDeleteModalOpen} onClose={closeDeleteModal} title="Archivar equipo base" maxWidth="480px">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
            ¿Archivar el equipo base <strong>{assetToDelete?.name}</strong>? Esta acción lo ocultará del sistema pero conservará toda su información.
          </div>
          {deleteError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{deleteError}</div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>Cancelar</UiButton>
            <UiButton type="button" onClick={() => void handleDeleteAsset()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Archivando..." : "Archivar equipo base"}
            </UiButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear asset base"
        subtitle="El formulario aparece solo cuando lo necesitas para que la página principal quede más limpia."
      >
        <form onSubmit={handleCreateTemplateAsset}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Tipo de asset
            </label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #D0D5DD",
                borderRadius: "10px",
                background: "white",
              }}
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

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Nombre
            </label>
            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="Ej. Aire acondicionado sala"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #D0D5DD",
                borderRadius: "10px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Estatus
            </label>
            <select
              value={assetStatus}
              onChange={(e) => setAssetStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #D0D5DD",
                borderRadius: "10px",
                background: "white",
              }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales sobre este asset base"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #D0D5DD",
                borderRadius: "10px",
                minHeight: "100px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Orden visual
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #D0D5DD",
                borderRadius: "10px",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar asset base"}
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}