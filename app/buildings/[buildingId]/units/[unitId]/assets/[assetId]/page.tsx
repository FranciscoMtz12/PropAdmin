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

import { useEffect, useMemo, useState, type FormEvent } from "react";
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

import {
  INPUT_STYLE,
  dangerButtonStyle,
  errorBannerStyle,
} from "@/lib/pageStyles";

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
      return { background: "var(--badge-bg-green)", color: "var(--badge-text-green)", border: "var(--metric-border-green)" };
    case "PENDING":
      return { background: "var(--badge-bg-amber)", color: "var(--badge-text-amber)", border: "var(--metric-border-amber)" };
    case "INACTIVE":
      return { background: "var(--badge-bg-gray)", color: "var(--badge-text-gray)", border: "var(--border-default)" };
    case "MAINTENANCE":
      return { background: "var(--badge-bg-amber)", color: "var(--badge-text-amber)", border: "var(--metric-border-amber)" };
    case "BROKEN":
      return { background: "var(--badge-bg-red)", color: "var(--badge-text-red)", border: "var(--metric-border-red)" };
    case "REPLACED":
      return { background: "var(--badge-bg-gray)", color: "var(--badge-text-gray)", border: "var(--border-default)" };
    default:
      return { background: "var(--badge-bg-blue)", color: "var(--badge-text-blue)", border: "var(--border-default)" };
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
      router.push("/");
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
        {msg ? <p style={{ color: "var(--badge-text-red)" }}>{msg}</p> : null}
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
            color: msg.includes("correctamente") ? "var(--badge-text-green)" : "var(--badge-text-red)",
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
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Tipo</p>
              <strong style={{ color: "var(--text-primary)" }}>{asset.asset_type || "No definido"}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <Hash size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Departamento</p>
              <strong style={{ color: "var(--text-primary)" }}>{unitLabel}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <CalendarDays size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Fecha de alta</p>
              <strong style={{ color: "var(--text-primary)" }}>{formatDate(asset.created_at)}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <ShieldCheck size={18} />
            </AppIconBox>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Estatus</p>
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
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Nombre</p>
                  <strong style={{ color: "var(--text-primary)" }}>{asset.name || "No registrado"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Tipo</p>
                  <strong style={{ color: "var(--text-primary)" }}>{asset.asset_type || "No definido"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Icono sugerido</p>
                  <strong style={{ color: "var(--text-primary)" }}>{asset.icon_name || "No registrado"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Fecha de creación</p>
                  <strong style={{ color: "var(--text-primary)" }}>{formatDate(asset.created_at)}</strong>
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
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Edificio</p>
                  <strong style={{ color: "var(--text-primary)" }}>{building.name}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Departamento</p>
                  <strong style={{ color: "var(--text-primary)" }}>{unitLabel}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Piso</p>
                  <strong style={{ color: "var(--text-primary)" }}>{unit.floor ?? "No registrado"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Estatus del departamento
                  </p>
                  <strong style={{ color: "var(--text-primary)" }}>{unit.status || "No definido"}</strong>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Notas</p>
                  <p style={{ marginTop: 6, color: "var(--text-secondary)" }}>
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
                          <strong style={{ color: "var(--text-primary)" }}>{item.title}</strong>
                          <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>{item.subtitle}</p>
                        </div>
                        <AppBadge>{item.dateLabel}</AppBadge>
                      </div>
                    </div>
                  </div>
                </AppCard>
              ))
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
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
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
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
              style={INPUT_STYLE}
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
              style={INPUT_STYLE}
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
              style={{ ...INPUT_STYLE, resize: "vertical" }}
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
              borderRadius: "var(--border-radius-lg)",
              background: "var(--badge-bg-red)",
              border: "1px solid var(--metric-border-red)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--border-radius-md)",
                background: "var(--icon-bg-red)",
                color: "var(--icon-color-red)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--badge-text-red)" }}>
                ¿Seguro que quieres eliminar este asset?
              </p>
              <p style={{ margin: "6px 0 0", color: "var(--badge-text-red)", opacity: 0.85 }}>
                El asset <strong>{asset.name}</strong> dejará de aparecer en las vistas normales del
                sistema. Esta acción está pensada para limpieza operativa y pruebas.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Edificio: <strong style={{ color: "var(--text-primary)" }}>{building.name}</strong>
            </p>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Departamento: <strong style={{ color: "var(--text-primary)" }}>{unitLabel}</strong>
            </p>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Asset: <strong style={{ color: "var(--text-primary)" }}>{asset.name}</strong>
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <UiButton
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleting}
              variant="secondary"
            >
              Cancelar
            </UiButton>

            <button
              type="button"
              onClick={() => void handleDeleteAsset()}
              disabled={deleting}
              style={{
                ...dangerButtonStyle,
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
