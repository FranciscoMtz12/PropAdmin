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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const templateAssetSchema = z.object({
  assetType: z.enum([
    "MINISPLIT",
    "CENTRAL_AC",
    "BOILER",
    "FRIDGE",
    "WASHER",
    "DRYER",
    "STOVE",
    "FAN",
    "OTHER",
  ]),
  assetName: z.string().min(1, "El nombre del equipo base es obligatorio"),
  assetStatus: z.enum(["ACTIVE", "INACTIVE"]),
  notes: z.string().optional(),
  sortOrder: z.string().optional(),
});
type TemplateAssetFormValues = z.infer<typeof templateAssetSchema>;

const TEMPLATE_ASSET_DEFAULTS: TemplateAssetFormValues = {
  assetType: "MINISPLIT",
  assetName: "",
  assetStatus: "ACTIVE",
  notes: "",
  sortOrder: "0",
};

const errorTextStyle: React.CSSProperties = {
  color: "#EF4444",
  fontSize: "0.75rem",
  marginTop: 4,
  marginBottom: 0,
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
    Formulario para crear nuevo asset base (react-hook-form + zod).
  */
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateAssetFormValues>({
    resolver: zodResolver(templateAssetSchema),
    defaultValues: TEMPLATE_ASSET_DEFAULTS,
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [msg, setMsg] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<UnitTypeAssetRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsAssetId, setOpenActionsAssetId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
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
      setDeleteError(`No se pudo eliminar el equipo base. ${error.message}`);
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
      console.error("unit_type_assets fetch failed", templateAssetError);
      setMsg("No se pudieron cargar los equipos base.");
      setLoadingData(false);
      return;
    }

    setTemplateAssets((templateAssetData as UnitTypeAssetRow[]) || []);
    setLoadingData(false);
  }

  const handleCreateTemplateAsset = handleSubmit(async (data) => {
    setMsg("");

    if (!unitType) {
      setMsg("No se encontró la tipología.");
      return;
    }

    const { error } = await supabase.from("unit_type_assets").insert({
      unit_type_id: unitType.id,
      asset_type: data.assetType,
      name: data.assetName.trim(),
      status: data.assetStatus,
      notes: data.notes?.trim() || null,
      sort_order: data.sortOrder && data.sortOrder.trim() ? Number(data.sortOrder) : 0,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    reset(TEMPLATE_ASSET_DEFAULTS);
    setMsg("Equipo base guardado correctamente.");
    setIsCreateModalOpen(false);

    await loadPageData();
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "40px",
          background: "var(--bg-card)",
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
          background: "var(--bg-card)",
          color: "black",
        }}
      >
        Cargando equipamiento base...
      </div>
    );
  }

  if (!building || !unitType) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "40px",
          background: "var(--bg-card)",
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
        title={`Equipamiento base — ${unitType.name}`}
        titleIcon={<LayoutPanelTop size={20} />}
        subtitle="Configura los equipos plantilla de la tipología con el mismo patrón visual del resto del sistema."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}`}>
              Volver a la tipología
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nuevo equipamiento base
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
        title="Equipamiento base"
        subtitle="Estos equipos se clonan cuando se crea un departamento de esta tipología."
        icon={<PackageOpen size={18} />}
      >
        {templateAssets.length === 0 ? (
          <p>Todavía no hay equipamiento base para esta tipología.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {templateAssets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--border-radius-xl)",
                  padding: "16px",
                  background: "var(--bg-card)",
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
                    <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{asset.name}</p>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem" }}>
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
                      border: "1px solid var(--border-default)",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: "0.75rem",
                    }}
                  >
                    Orden {asset.sort_order ?? 0}
                  </span>

                  <span
                    style={{
                      border: "1px solid var(--border-default)",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: "0.75rem",
                    }}
                  >
                    {asset.status}
                  </span>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}/assets/${asset.id}`}>
                    Ver equipamiento base
                  </UiButton>

                  <div
                    style={{ position: "relative" }}
                    ref={openActionsAssetId === asset.id ? actionsMenuRef : undefined}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenActionsAssetId(openActionsAssetId === asset.id ? null : asset.id)
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--border-radius-md)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                      aria-label="Más acciones"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {openActionsAssetId === asset.id && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 6px)",
                          minWidth: 160,
                          borderRadius: "var(--border-radius-lg)",
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-card)",
                          boxShadow: "var(--shadow-md, 0 4px 16px rgba(0,0,0,0.12))",
                          padding: 6,
                          display: "grid",
                          gap: 4,
                          zIndex: 30,
                        }}
                      >
                        <a
                          href={`/buildings/${building.id}/unit-types/${unitType.id}/assets/${asset.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textDecoration: "none",
                            color: "var(--text-primary)",
                            borderRadius: "var(--border-radius-md)",
                            padding: "9px 10px",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Edit3 size={14} />
                          Editar
                        </a>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(asset)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            border: "none",
                            background: "var(--badge-bg-red)",
                            color: "var(--badge-text-red)",
                            borderRadius: "var(--border-radius-md)",
                            padding: "9px 10px",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={14} />
                          Eliminar
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

      <Modal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="Eliminar equipo base"
        maxWidth="480px"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--border-radius-lg)",
              background: "var(--metric-bg-amber)",
              border: "1px solid var(--metric-border-amber)",
              color: "var(--badge-text-amber)",
              fontSize: "0.875rem",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            ¿Eliminar el equipo base <strong>{assetToDelete?.name}</strong>? Esta acción lo ocultará
            del sistema pero conservará toda su información.
          </div>

          {deleteError ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--border-radius-lg)",
                background: "var(--badge-bg-red)",
                border: "1px solid var(--metric-border-red)",
                color: "var(--badge-text-red)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {deleteError}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              Cancelar
            </UiButton>
            <UiButton type="button" onClick={() => void handleDeleteAsset()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : "Eliminar equipo base"}
            </UiButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear equipamiento base"
        subtitle="El formulario aparece solo cuando lo necesitas para que la página principal quede más limpia."
      >
        <form onSubmit={handleCreateTemplateAsset}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Tipo de equipamiento</label>
            <select
              {...register("assetType")}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--bg-card)",
              }}
            >
              <option value="MINISPLIT">MINISPLIT</option>
              <option value="CENTRAL_AC">CENTRAL_AC</option>
              <option value="BOILER">BOILER</option>
              <option value="FRIDGE">FRIDGE</option>
              <option value="WASHER">WASHER</option>
              <option value="DRYER">DRYER</option>
              <option value="STOVE">STOVE</option>
              <option value="FAN">FAN</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Nombre</label>
            <input
              {...register("assetName")}
              placeholder="Ej. Boiler baño principal"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--border-radius-md)",
              }}
            />
            {errors.assetName ? (
              <p style={errorTextStyle}>{errors.assetName.message}</p>
            ) : null}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Estatus</label>
            <select
              {...register("assetStatus")}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--bg-card)",
              }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Notas</label>
            <textarea
              {...register("notes")}
              placeholder="Notas opcionales sobre este equipo base"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--border-radius-md)",
                minHeight: "100px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Orden visual</label>
            <input
              type="number"
              {...register("sortOrder")}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--border-radius-md)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={isSubmitting} variant="primary">
              {isSubmitting ? "Guardando..." : "Guardar equipamiento base"}
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(false)}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}