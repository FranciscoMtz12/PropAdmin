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

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { Edit3, MoreHorizontal, Plus, Tag, Trash2 } from "lucide-react";

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

import {
  INPUT_STYLE,
  TEXTAREA_STYLE,
  dropdownTriggerStyle,
  dropdownMenuStyle,
  dropdownActionButtonStyle,
  dropdownDeleteItemStyle,
  warnBannerStyle,
  errorBannerStyle,
  dangerButtonStyle,
} from "@/lib/pageStyles";

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

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: 600,
  marginBottom: "8px",
  color: "var(--text-primary)",
};

function getAssetStatusLabel(status: string) {
  if (status === "ACTIVE") return "Activo";
  if (status === "PENDING") return "Pendiente";
  if (status === "INACTIVE") return "Inactivo";
  return status;
}

function getAssetStatusColors(status: string) {
  if (status === "ACTIVE") {
    return { background: "var(--badge-bg-green)", color: "var(--badge-text-green)" };
  }
  if (status === "PENDING") {
    return { background: "var(--badge-bg-amber)", color: "var(--badge-text-amber)" };
  }
  if (status === "INACTIVE") {
    return { background: "var(--badge-bg-gray)", color: "var(--badge-text-gray)" };
  }
  return { background: "var(--badge-bg-blue)", color: "var(--badge-text-blue)" };
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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetRow | null>(null);
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
    if (user?.company_id && buildingId && unitId) {
      void loadPageData();
    }
  }, [user, buildingId, unitId]);

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

  function openDeleteModal(asset: AssetRow) {
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
    if (!user?.company_id || !assetToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", assetToDelete.id)
      .eq("company_id", user.company_id);
    if (error) {
      setDeleteError(`No se pudo archivar el equipo. ${error.message}`);
      setDeleting(false);
      return;
    }
    setIsDeleteModalOpen(false);
    setAssetToDelete(null);
    setDeleting(false);
    setMsg("Equipo archivado correctamente.");
    await loadPageData();
  }

  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitId) return;

    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name, code")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
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
      .is("deleted_at", null)
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
            color: "var(--text-muted)",
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
            <div style={{ color: "var(--badge-text-red)", fontWeight: 600 }}>
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
            <div style={{ color: "var(--accent)", fontWeight: 600 }}>{msg}</div>
          </AppCard>
        ) : null}

        {assets.length === 0 ? (
          <AppCard>
            <div style={{ padding: "8px 2px", color: "var(--text-muted)", fontWeight: 500 }}>
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
                          background: "var(--icon-bg-neutral)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--icon-color-neutral)",
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
                            color: "var(--text-primary)",
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
                            color: "var(--text-muted)",
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
                        color: "var(--text-secondary)",
                        background: "var(--bg-page)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "14px",
                        padding: "12px 14px",
                      }}
                    >
                      {asset.notes}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <UiButton
                      variant="secondary"
                      onClick={() => router.push(`/buildings/${buildingId}/units/${unitId}/assets/${asset.id}`)}
                    >
                      Ver asset
                    </UiButton>
                    <div
                      style={{ position: "relative" }}
                      ref={openActionsAssetId === asset.id ? actionsMenuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenActionsAssetId(openActionsAssetId === asset.id ? null : asset.id)}
                        style={dropdownTriggerStyle}
                        aria-label="Más acciones"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openActionsAssetId === asset.id && (
                        <div style={dropdownMenuStyle}>
                          <button
                            type="button"
                            onClick={() => { setOpenActionsAssetId(null); router.push(`/buildings/${buildingId}/units/${unitId}/assets/${asset.id}`); }}
                            style={dropdownActionButtonStyle}
                          >
                            <Edit3 size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(asset)}
                            style={dropdownDeleteItemStyle}
                          >
                            <Trash2 size={14} />
                            Archivar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </AppCard>
            ))}
          </AppGrid>
        )}
      </div>

      <Modal open={isDeleteModalOpen} onClose={closeDeleteModal} title="Archivar equipo" maxWidth="480px">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={warnBannerStyle}>
            ¿Archivar el equipo <strong>{assetToDelete?.name}</strong>? Esta acción lo ocultará del sistema pero conservará toda su información.
          </div>
          {deleteError ? (
            <div style={errorBannerStyle}>{deleteError}</div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>Cancelar</UiButton>
            <UiButton type="button" onClick={() => void handleDeleteAsset()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Archivando..." : "Archivar equipo"}
            </UiButton>
          </div>
        </div>
      </Modal>

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
                style={INPUT_STYLE}
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
                style={INPUT_STYLE}
              />
            </div>

            <div>
              <label style={labelStyle}>Estado</label>
              <select
                value={assetStatus}
                onChange={(e) => setAssetStatus(e.target.value)}
                style={INPUT_STYLE}
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
                style={TEXTAREA_STYLE}
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
