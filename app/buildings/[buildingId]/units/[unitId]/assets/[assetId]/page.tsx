"use client";

/*
  Asset Detail

  Página estabilizada para mostrar, editar y eliminar lógicamente el asset real de un departamento.
  Este archivo se alineó al schema confirmado en Supabase:
  - units.unit_number
  - units.display_code
  - assets.icon_name
  - assets.deleted_at
  - assets NO tiene brand/model/serial_number/install_date/warranty_expiration

  Objetivos de este patch:
  - no romper rutas existentes
  - mantener el design system ya definido
  - endurecer queries con company_id / building_id / unit_id
  - mostrar mensajes de error más claros
  - dejar listo el puente hacia mantenimiento por asset
  - agregar soft delete para assets
*/

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  Hash,
  PackageSearch,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AssetTypeIcon from "@/components/AssetTypeIcon";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";
import AppTabs from "@/components/AppTabs";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import AppBadge from "@/components/AppBadge";

type AssetRow = {
  id: string;
  company_id: string;
  building_id: string;
  unit_id: string;
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
  icon_name: string | null;
  created_at: string;
  deleted_at: string | null;
};

type UnitRow = {
  id: string;
  company_id: string;
  building_id: string;
  unit_type_id: string;
  unit_number: string;
  display_code: string | null;
  floor: number | null;
  status: string;
};

type BuildingRow = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
};

type TimelineItem = {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  icon: "asset" | "maintenance" | "created";
};

type TabKey = "summary" | "timeline" | "documents";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #D0D5DD",
  borderRadius: 10,
  background: "white",
  color: "#111827",
  outline: "none",
};

const dangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#B91C1C",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerPrimaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #DC2626",
  background: "#DC2626",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #D0D5DD",
  background: "white",
  color: "#344054",
  fontWeight: 600,
  cursor: "pointer",
};

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "No registrada";

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;

  return parsed.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getAssetStatusLabel(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "Activo";
    case "PENDING":
      return "Pendiente";
    case "INACTIVE":
      return "Inactivo";
    case "MAINTENANCE":
      return "En mantenimiento";
    case "BROKEN":
      return "Fuera de servicio";
    case "REPLACED":
      return "Reemplazado";
    default:
      return status || "Sin estatus";
  }
}

function getAssetStatusBadge(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return { background: "#DCFCE7", color: "#166534", border: "#BBF7D0" };
    case "PENDING":
      return { background: "#FEF3C7", color: "#B45309", border: "#FDE68A" };
    case "INACTIVE":
      return { background: "#F3F4F6", color: "#374151", border: "#E5E7EB" };
    case "MAINTENANCE":
      return { background: "#FEF3C7", color: "#92400E", border: "#FDE68A" };
    case "BROKEN":
      return { background: "#FEE2E2", color: "#991B1B", border: "#FECACA" };
    case "REPLACED":
      return { background: "#E5E7EB", color: "#374151", border: "#D1D5DB" };
    default:
      return { background: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" };
  }
}

function buildFallbackTimeline(asset: AssetRow): TimelineItem[] {
  return [
    {
      id: "asset-created",
      title: "Asset registrado en el sistema",
      subtitle: "Fecha de alta del equipo dentro del departamento",
      dateLabel: formatDate(asset.created_at),
      icon: "created",
    },
  ];
}

function getTimelineIcon(icon: TimelineItem["icon"]) {
  switch (icon) {
    case "asset":
      return <PackageSearch size={16} />;
    case "maintenance":
      return <Wrench size={16} />;
    case "created":
      return <CalendarDays size={16} />;
    default:
      return <Star size={16} />;
  }
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();

  const buildingId = params.buildingId as string;
  const unitId = params.unitId as string;
  const assetId = params.assetId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<BuildingRow | null>(null);
  const [unit, setUnit] = useState<UnitRow | null>(null);
  const [asset, setAsset] = useState<AssetRow | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("MINISPLIT");
  const [assetStatus, setAssetStatus] = useState("ACTIVE");
  const [iconName, setIconName] = useState("");
  const [notes, setNotes] = useState("");

  const [msg, setMsg] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId && unitId && assetId) {
      void loadPageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id, buildingId, unitId, assetId]);

  async function loadPageData() {
    if (!user?.company_id) return;

    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name, code")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .single();

    if (buildingError || !buildingData) {
      setMsg(`No se pudo cargar el edificio. ${buildingError?.message || ""}`.trim());
      setLoadingData(false);
      return;
    }

    setBuilding(buildingData as BuildingRow);

    const { data: unitData, error: unitError } = await supabase
      .from("units")
      .select(
        "id, company_id, building_id, unit_type_id, unit_number, display_code, floor, status"
      )
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .single();

    if (unitError || !unitData) {
      setMsg(`No se pudo cargar el departamento. ${unitError?.message || ""}`.trim());
      setLoadingData(false);
      return;
    }

    setUnit(unitData as UnitRow);

    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .select(
        "id, company_id, building_id, unit_id, asset_type, name, status, notes, icon_name, created_at, deleted_at"
      )
      .eq("id", assetId)
      .eq("unit_id", unitId)
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .single();

    if (assetError || !assetData) {
      setMsg(`No se pudo cargar el asset. ${assetError?.message || ""}`.trim());
      setLoadingData(false);
      return;
    }

    const parsedAsset = assetData as AssetRow;
    setAsset(parsedAsset);

    setAssetName(parsedAsset.name || "");
    setAssetType(parsedAsset.asset_type || "MINISPLIT");
    setAssetStatus(parsedAsset.status || "ACTIVE");
    setIconName(parsedAsset.icon_name || "");
    setNotes(parsedAsset.notes || "");

    setLoadingData(false);
  }

  async function handleSaveAsset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");

    if (!asset) {
      setMsg("No se encontró el asset.");
      return;
    }

    if (!assetName.trim()) {
      setMsg("El nombre del asset es obligatorio.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("assets")
      .update({
        name: assetName.trim(),
        asset_type: assetType,
        status: assetStatus,
        icon_name: iconName.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", asset.id)
      .eq("company_id", user?.company_id || "")
      .is("deleted_at", null);

    setSaving(false);

    if (error) {
      setMsg(`No se pudo actualizar el asset. ${error.message}`);
      return;
    }

    setIsEditModalOpen(false);
    setMsg("Asset actualizado correctamente.");
    await loadPageData();
  }

  async function handleDeleteAsset() {
    if (!asset || !user?.company_id) return;

    setDeleting(true);
    setMsg("");

    const { error } = await supabase
      .from("assets")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .eq("company_id", user.company_id)
      .is("deleted_at", null);

    setDeleting(false);

    if (error) {
      setMsg(`No se pudo eliminar el asset. ${error.message}`);
      return;
    }

    router.push(`/buildings/${buildingId}/units/${unitId}/assets`);
  }

  const timeline = useMemo(() => {
    if (!asset) return [];
    return buildFallbackTimeline(asset);
  }, [asset]);

  const tabs = [
    { key: "summary", label: "Resumen", icon: <PackageSearch size={16} /> },
    { key: "timeline", label: "Historial", icon: <Wrench size={16} />, count: timeline.length },
    { key: "documents", label: "Documentos", icon: <FileText size={16} /> },
  ];

  if (loading) {
    return <PageContainer>Cargando usuario...</PageContainer>;
  }

  if (!user) return null;

  if (loadingData) {
    return <PageContainer>Cargando asset...</PageContainer>;
  }

  if (!building || !unit || !asset) {
    return (
      <PageContainer>
        <PageHeader
          title="Asset"
          subtitle="No se pudo cargar la información del asset."
          actions={
            <UiButton href={`/buildings/${buildingId}/units/${unitId}/assets`}>
              Volver a assets
            </UiButton>
          }
        />
        {msg ? <p style={{ color: "crimson" }}>{msg}</p> : null}
      </PageContainer>
    );
  }

  const statusBadge = getAssetStatusBadge(asset.status);
  const unitLabel = unit.display_code || unit.unit_number || unit.id;

  return (
    <PageContainer>
      <PageHeader
        title={asset.name || "Asset sin nombre"}
        titleIcon={<AssetTypeIcon assetType={asset.asset_type || "OTHER"} size={18} />}
        subtitle={`Activo del departamento ${unitLabel} dentro de ${building.name}.`}
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/units/${unit.id}/assets`}>
              Volver a assets
            </UiButton>

            <UiButton
              href={`/buildings/${building.id}/units/${unit.id}/assets/${asset.id}/maintenance`}
            >
              <Wrench size={16} />
              Ver mantenimiento
            </UiButton>

            <UiButton onClick={() => setIsEditModalOpen(true)} variant="primary">
              <Pencil size={16} />
              Editar asset
            </UiButton>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              style={dangerButtonStyle}
            >
              <Trash2 size={16} />
              Eliminar asset
            </button>
          </>
        }
      />

      {msg ? (
        <p
          style={{
            color: msg.includes("correctamente") ? "green" : "crimson",
            marginBottom: 16,
          }}
        >
          {msg}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <AssetTypeIcon assetType={asset.asset_type || "OTHER"} size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Tipo</p>
              <strong>{asset.asset_type || "No definido"}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <Hash size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Departamento</p>
              <strong>{unitLabel}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <CalendarDays size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Fecha de alta</p>
              <strong>{formatDate(asset.created_at)}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <ShieldCheck size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Estatus</p>
              <div style={{ marginTop: 6 }}>
                <AppBadge
                  backgroundColor={statusBadge.background}
                  textColor={statusBadge.color}
                  borderColor={statusBadge.border}
                  style={{ fontSize: 12, fontWeight: 700 }}
                >
                  {getAssetStatusLabel(asset.status)}
                </AppBadge>
              </div>
            </div>
          </div>
        </AppCard>
      </div>

      <SectionCard
        title="Resumen del asset"
        subtitle="Vista general del equipo instalado en el departamento."
        icon={<PackageSearch size={18} />}
      >
        <AppTabs
          items={tabs}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
        />

        {activeTab === "summary" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            <SectionCard
              title="Información actual"
              subtitle="Datos reales disponibles en la tabla assets."
              icon={<PackageSearch size={18} />}
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Nombre</p>
                  <strong>{asset.name || "No registrado"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Tipo</p>
                  <strong>{asset.asset_type || "No definido"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Icono sugerido</p>
                  <strong>{asset.icon_name || "No registrado"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Fecha de creación</p>
                  <strong>{formatDate(asset.created_at)}</strong>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Ubicación y operación"
              subtitle="Contexto del asset dentro del edificio y departamento."
              icon={<FileText size={18} />}
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Edificio</p>
                  <strong>{building.name}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Departamento</p>
                  <strong>{unitLabel}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Piso</p>
                  <strong>{unit.floor ?? "No registrado"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>
                    Estatus del departamento
                  </p>
                  <strong>{unit.status || "No definido"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Notas</p>
                  <p style={{ marginTop: 6 }}>
                    {asset.notes || "Todavía no hay notas registradas para este equipo."}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "timeline" ? (
          <div style={{ display: "grid", gap: 12 }}>
            {timeline.length ? (
              timeline.map((item) => (
                <AppCard key={item.id}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <AppIconBox>{getTimelineIcon(item.icon)}</AppIconBox>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <p style={{ margin: "6px 0 0", color: "#667085" }}>{item.subtitle}</p>
                        </div>
                        <AppBadge>{item.dateLabel}</AppBadge>
                      </div>
                    </div>
                  </div>
                </AppCard>
              ))
            ) : (
              <p style={{ margin: 0, color: "#667085" }}>
                Todavía no hay movimientos visibles para este asset.
              </p>
            )}
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <SectionCard
            title="Documentos del asset"
            subtitle="Esta sección queda lista para conectar archivos específicos del equipo."
            icon={<FileText size={18} />}
          >
            <p style={{ margin: 0, color: "#667085" }}>
              Todavía no hay documentos cargados para este asset.
            </p>
          </SectionCard>
        ) : null}
      </SectionCard>

      <Modal
        open={isEditModalOpen}
        title="Editar asset"
        subtitle="Actualiza los campos que sí existen en la tabla assets de tu base actual."
        onClose={() => setIsEditModalOpen(false)}
      >
        <form onSubmit={handleSaveAsset}>
          <AppFormField label="Nombre del asset" required>
            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="Ej. Frigobar Whirlpool"
              style={inputStyle}
            />
          </AppFormField>

          <AppFormField label="Tipo de asset" required>
            <AppSelect value={assetType} onChange={(e) => setAssetType(e.target.value)}>
              <option value="MINISPLIT">Minisplit</option>
              <option value="FRIDGE">Refrigerador</option>
              <option value="TV">Televisión</option>
              <option value="MICROWAVE">Microondas</option>
              <option value="STOVE">Estufa</option>
              <option value="WASHER">Lavadora</option>
              <option value="DRYER">Secadora</option>
              <option value="WATER_HEATER">Boiler</option>
              <option value="OTHER">Otro</option>
            </AppSelect>
          </AppFormField>

          <AppFormField
            label="Nombre de icono"
            helperText="Campo opcional para guardar una referencia visual en la base."
          >
            <input
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              placeholder="Ej. fridge, snowflake, tv"
              style={inputStyle}
            />
          </AppFormField>

          <AppFormField label="Estatus" required>
            <AppSelect value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)}>
              <option value="ACTIVE">Activo</option>
              <option value="PENDING">Pendiente</option>
              <option value="INACTIVE">Inactivo</option>
              <option value="MAINTENANCE">En mantenimiento</option>
              <option value="BROKEN">Fuera de servicio</option>
              <option value="REPLACED">Reemplazado</option>
            </AppSelect>
          </AppFormField>

          <AppFormField label="Notas">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Detalles útiles para operación, revisión o mantenimiento..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </AppFormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton onClick={() => setIsEditModalOpen(false)}>Cancelar</UiButton>
            <UiButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </UiButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={isDeleteModalOpen}
        title="Eliminar asset"
        subtitle="Esta acción ocultará el asset del sistema y dejará de aparecer en el departamento."
        onClose={() => {
          if (!deleting) setIsDeleteModalOpen(false);
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: 14,
              borderRadius: 12,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEE2E2",
                color: "#B91C1C",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "#991B1B" }}>
                ¿Seguro que quieres eliminar este asset?
              </p>
              <p style={{ margin: "6px 0 0", color: "#7F1D1D" }}>
                El asset <strong>{asset.name}</strong> dejará de aparecer en las vistas normales del
                sistema. Esta acción está pensada para limpieza operativa y pruebas.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, color: "#667085" }}>
              Edificio: <strong>{building.name}</strong>
            </p>
            <p style={{ margin: 0, color: "#667085" }}>
              Departamento: <strong>{unitLabel}</strong>
            </p>
            <p style={{ margin: 0, color: "#667085" }}>
              Asset: <strong>{asset.name}</strong>
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleting}
              style={{
                ...ghostButtonStyle,
                opacity: deleting ? 0.7 : 1,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => void handleDeleteAsset()}
              disabled={deleting}
              style={{
                ...dangerPrimaryButtonStyle,
                opacity: deleting ? 0.7 : 1,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : "Sí, eliminar asset"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}