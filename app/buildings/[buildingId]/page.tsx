"use client";

/*
  Página de detalle del edificio.

  Esta versión integra los componentes nuevos de UI profesional:
  - AppTabs para cambiar entre resumen / documentos / galería
  - AppStatBar para visualizar la distribución de unidades
  - métricas y cards consistentes con el design system de PropAdmin

  Mejora agregada:
  - acceso directo al nuevo módulo de Cleaning desde:
    1. acciones del header
    2. accesos rápidos
*/

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Brush,
  Building2,
  FileImage,
  FileText,
  FolderOpen,
  Home,
  ImageIcon,
  Layers3,
  MapPin,
  Tags,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import UiButton from "@/components/UiButton";
import BuildingCategoryBadge from "@/components/BuildingCategoryBadge";
import AppTabs from "@/components/AppTabs";
import AppStatBar from "@/components/AppStatBar";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";
import {
  getBuildingCategoryDefinition,
  getMixedUseSubcategoryLabel,
} from "@/lib/buildingCategories";

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  code: string | null;
  building_category: string | null;
  building_subcategory: string | null;
};

type BuildingFile = {
  id: string;
  building_id: string;
  file_name: string;
  file_type: string;
  file_category: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  notes: string | null;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
};

type UnitStatusRow = {
  id: string;
  status: string | null;
};

type UnitTypeRow = {
  id: string;
};

function formatFileSize(fileSizeBytes: number | null) {
  if (!fileSizeBytes || fileSizeBytes <= 0) return "Sin tamaño";
  if (fileSizeBytes < 1024) return `${fileSizeBytes} B`;
  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategoryLabel(fileCategory: string) {
  if (fileCategory === "architectural_plan") return "Plano arquitectónico";
  if (fileCategory === "render") return "Render";
  if (fileCategory === "photo") return "Fotografía";
  if (fileCategory === "technical_document") return "Documento técnico";
  return "Otro";
}

function SummaryItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <AppCard style={{ padding: 16, borderRadius: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <p style={{ fontSize: 13, color: "#667085", marginBottom: 6 }}>
            {label}
          </p>
          <strong style={{ display: "block", lineHeight: 1.2 }}>{value}</strong>
        </div>

        <AppIconBox size={38} radius={12}>
          {icon}
        </AppIconBox>
      </div>
    </AppCard>
  );
}

export default function BuildingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params.buildingId as string;
  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [files, setFiles] = useState<BuildingFile[]>([]);
  const [unitStatuses, setUnitStatuses] = useState<UnitStatusRow[]>([]);
  const [unitTypeCount, setUnitTypeCount] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [msg, setMsg] = useState("");
  const [loadingBuilding, setLoadingBuilding] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) {
      void loadBuilding();
    }
  }, [user, buildingId]);

  async function loadBuilding() {
    if (!user?.company_id || !buildingId) return;

    setLoadingBuilding(true);
    setMsg("");

    const { data, error } = await supabase
      .from("buildings")
      .select(
        "id, company_id, name, address, code, building_category, building_subcategory"
      )
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .single();

    if (error) {
      setMsg("No se pudo cargar el edificio.");
      setLoadingBuilding(false);
      return;
    }

    setBuilding(data as Building);

    const [{ data: filesData }, { data: unitsData }, { data: unitTypesData }] =
      await Promise.all([
        supabase
          .from("building_files")
          .select(
            "id, building_id, file_name, file_type, file_category, storage_path, public_url, mime_type, file_size_bytes, notes, sort_order, is_cover, created_at"
          )
          .eq("building_id", buildingId)
          .order("is_cover", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),

        supabase
          .from("units")
          .select("id, status")
          .eq("building_id", buildingId)
          .eq("company_id", user.company_id),

        supabase
          .from("unit_types")
          .select("id")
          .eq("building_id", buildingId),
      ]);

    setFiles((filesData as BuildingFile[]) || []);
    setUnitStatuses((unitsData as UnitStatusRow[]) || []);
    setUnitTypeCount((unitTypesData as UnitTypeRow[] | null)?.length || 0);
    setLoadingBuilding(false);
  }

  const documentFiles = useMemo(
    () => files.filter((file) => file.file_type === "document"),
    [files]
  );

  const imageFiles = useMemo(
    () => files.filter((file) => file.file_type === "image"),
    [files]
  );

  const occupiedUnits = unitStatuses.filter(
    (unit) => unit.status === "RENTED"
  ).length;
  const vacantUnits = unitStatuses.filter(
    (unit) => unit.status === "VACANT"
  ).length;
  const maintenanceUnits = unitStatuses.filter(
    (unit) => unit.status === "MAINTENANCE"
  ).length;
  const totalUnits = unitStatuses.length;

  if (loading) {
    return <PageContainer>Cargando usuario...</PageContainer>;
  }

  if (!user) return null;

  if (loadingBuilding) {
    return <PageContainer>Cargando edificio...</PageContainer>;
  }

  if (!building) {
    return <PageContainer>{msg || "No se encontró el edificio."}</PageContainer>;
  }

  const categoryDefinition = getBuildingCategoryDefinition(
    building.building_category
  );

  return (
    <PageContainer>
      <PageHeader
        title={building.name}
        titleIcon={<Building2 size={20} />}
        subtitle="Vista general del inmueble con tabs, métricas y una distribución visual más consistente dentro de PropAdmin."
        actions={
          <>
            <UiButton href="/buildings">Volver a edificios</UiButton>
            <UiButton href={`/buildings/${building.id}/unit-types`}>
              Tipologías
            </UiButton>
            <UiButton href={`/buildings/${building.id}/cleaning`}>
              Limpieza
            </UiButton>
            <UiButton href={`/buildings/${building.id}/units`} variant="primary">
              Departamentos
            </UiButton>
          </>
        }
      />

      <AppGrid minWidth={220} gap={16} style={{ marginBottom: 24 }}>
        <MetricCard
          label="Categoría"
          value={categoryDefinition.label}
          icon={<Tags size={18} />}
          helper="Clasificación"
        />

        <MetricCard
          label="Tipologías"
          value={unitTypeCount}
          icon={<Layers3 size={18} />}
          helper="Modelos de unidad"
        />

        <MetricCard
          label="Departamentos"
          value={totalUnits}
          icon={<Home size={18} />}
          helper="Unidades registradas"
        />

        <MetricCard
          label="Documentos"
          value={documentFiles.length}
          icon={<FileText size={18} />}
          helper="Archivos técnicos"
        />
      </AppGrid>

      <AppTabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "overview", label: "Resumen", icon: <Building2 size={16} /> },
          {
            key: "documents",
            label: "Documentos",
            icon: <FolderOpen size={16} />,
            count: documentFiles.length,
          },
          {
            key: "gallery",
            label: "Galería",
            icon: <FileImage size={16} />,
            count: imageFiles.length,
          },
        ]}
      />

      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 24 }}>
          <AppStatBar
            title="Distribución de departamentos"
            totalLabel={`Total: ${totalUnits}`}
            segments={[
              { label: "Rentados", value: occupiedUnits, color: "#3B82F6" },
              { label: "Disponibles", value: vacantUnits, color: "#22C55E" },
              {
                label: "Mantenimiento",
                value: maintenanceUnits,
                color: "#F59E0B",
              },
            ]}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: 24,
            }}
          >
            <div style={{ display: "grid", gap: 24 }}>
              <SectionCard
                title="Información general"
                subtitle="Datos base del edificio y su clasificación."
                icon={<Building2 size={18} />}
              >
                <AppGrid minWidth={220} gap={14}>
                  <SummaryItem
                    label="Código"
                    value={building.code || "Sin código"}
                    icon={<Tags size={16} />}
                  />

                  <SummaryItem
                    label="Dirección"
                    value={building.address || "Sin dirección"}
                    icon={<MapPin size={16} />}
                  />

                  <SummaryItem
                    label="Categoría"
                    value={categoryDefinition.label}
                    icon={<Building2 size={16} />}
                  />

                  <SummaryItem
                    label="Subcategoría"
                    value={
                      building.building_category === "mixed_use" &&
                      building.building_subcategory
                        ? getMixedUseSubcategoryLabel(
                            building.building_subcategory
                          )
                        : "No aplica"
                    }
                    icon={<Home size={16} />}
                  />
                </AppGrid>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <BuildingCategoryBadge category={building.building_category} />

                  {building.building_category === "mixed_use" &&
                  building.building_subcategory ? (
                    <span
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#475467",
                      }}
                    >
                      {getMixedUseSubcategoryLabel(
                        building.building_subcategory
                      )}
                    </span>
                  ) : null}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Accesos rápidos"
              subtitle="Navega a los módulos más usados de este edificio."
              icon={<Layers3 size={18} />}
            >
              <div style={{ display: "grid", gap: 12 }}>
                <AppCard style={{ padding: 16, borderRadius: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", marginBottom: 4 }}>
                        Tipologías
                      </strong>
                      <p
                        style={{
                          margin: 0,
                          color: "#667085",
                          fontSize: 14,
                        }}
                      >
                        Administra los tipos de unidad y sus assets base.
                      </p>
                    </div>

                    <UiButton href={`/buildings/${building.id}/unit-types`}>
                      Abrir
                    </UiButton>
                  </div>
                </AppCard>

                <AppCard style={{ padding: 16, borderRadius: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", marginBottom: 4 }}>
                        Departamentos
                      </strong>
                      <p
                        style={{
                          margin: 0,
                          color: "#667085",
                          fontSize: 14,
                        }}
                      >
                        Consulta ocupación, unidades y assets asignados.
                      </p>
                    </div>

                    <UiButton
                      href={`/buildings/${building.id}/units`}
                      variant="primary"
                    >
                      Abrir
                    </UiButton>
                  </div>
                </AppCard>

                <AppCard style={{ padding: 16, borderRadius: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", marginBottom: 4 }}>
                        Limpieza
                      </strong>
                      <p
                        style={{
                          margin: 0,
                          color: "#667085",
                          fontSize: 14,
                        }}
                      >
                        Organiza las áreas de limpieza del edificio y prepara la
                        base para futuros calendarios y turnos.
                      </p>
                    </div>

                    <UiButton href={`/buildings/${building.id}/cleaning`}>
                      Abrir
                    </UiButton>
                  </div>
                </AppCard>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <SectionCard
          title="Documentos"
          subtitle="Planos, PDFs y otros archivos técnicos del edificio."
          icon={<FolderOpen size={18} />}
        >
          {documentFiles.length === 0 ? (
            <p style={{ margin: 0, color: "#667085" }}>
              Todavía no hay documentos registrados para este edificio.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {documentFiles.map((file) => (
                <AppCard key={file.id} style={{ padding: 16, borderRadius: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <AppIconBox
                      size={40}
                      radius={12}
                      background="#EFF6FF"
                      color="#2563EB"
                    >
                      <FileText size={18} />
                    </AppIconBox>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", marginBottom: 4 }}>
                        {file.file_name}
                      </strong>
                      <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>
                        {getFileCategoryLabel(file.file_category)} ·{" "}
                        {formatFileSize(file.file_size_bytes)}
                      </p>
                    </div>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "gallery" ? (
        <SectionCard
          title="Galería"
          subtitle="Renders y fotografías del edificio en una misma vista visual."
          icon={<FileImage size={18} />}
        >
          {imageFiles.length === 0 ? (
            <p style={{ margin: 0, color: "#667085" }}>
              Todavía no hay imágenes registradas para este edificio.
            </p>
          ) : (
            <AppGrid minWidth={260} gap={12}>
              {imageFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  {file.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.public_url}
                      alt={file.file_name}
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 160,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#F8FAFC",
                        color: "#94A3B8",
                      }}
                    >
                      <ImageIcon size={22} />
                    </div>
                  )}

                  <div style={{ padding: 14 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>
                      {file.file_name}
                    </strong>
                    <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>
                      {getFileCategoryLabel(file.file_category)}
                    </p>
                  </div>
                </div>
              ))}
            </AppGrid>
          )}
        </SectionCard>
      ) : null}
    </PageContainer>
  );
}
