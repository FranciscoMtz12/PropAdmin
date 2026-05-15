"use client";

/*
  Página de detalle del edificio — diseño v2.2

  Cambios vs v2.1:
  - Métricas superiores reducidas a 2:
      1. Dona SVG de ocupación (verde/amber/rojo) con % centrado
      2. MetricCard "Unidades" X/Y
  - AppStatBar reemplazado por PieChart recharts (innerRadius=60, outerRadius=90)
  - Layout nueva fila: [PieChart distribución] | [Cobranza BarChart con toggle 3/6 meses]
  - Nueva sección "Tendencia de ocupación": LineChart 12 meses con 2 líneas
  - Sección Info general | Facturación | Accesos rápidos permanece al fondo
*/

import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Building2,
  Car,
  CreditCard,
  Droplets,
  Edit3,
  Factory,
  Flame,
  FileClockIcon,
  FileImage,
  FileText,
  FolderOpen,
  Gem,
  Home,
  ImageIcon,
  LayoutGrid,
  Layers3,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Ruler,
  Settings2,
  Store,
  Tags,
  Trash2,
  Warehouse,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import BuildingCategoryBadge from "@/components/BuildingCategoryBadge";
import AppTabs from "@/components/AppTabs";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";
import AppEmptyState from "@/components/AppEmptyState";
import {
  getBuildingCategoryDefinition,
  getMixedUseSubcategoryLabel,
} from "@/lib/buildingCategories";
import { getPropertyType, getPropertyLabels, PROPERTY_TYPES, BUILDING_FEATURES } from "@/lib/property-types";
import {
  INPUT_STYLE,
  TEXTAREA_STYLE,
  dropdownTriggerStyle,
  dropdownMenuStyle,
  dropdownActionButtonStyle,
  dropdownDeleteItemStyle,
  errorBannerStyle,
} from "@/lib/pageStyles";
import AssetTypeIcon from "@/components/AssetTypeIcon";
import AppBadge from "@/components/AppBadge";
import BuildingServicesTab from "@/components/BuildingServicesTab";
import type { UtilityServiceType } from "@/lib/types";
import { SERVICE_TYPE_LABEL } from "@/lib/types";
import { sortByNatural } from "@/lib/sort-utils";

/* LocationPicker — edición de ubicación en el mapa. */
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 340, width: "100%", borderRadius: 8, background: "var(--bg-card-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
      Cargando selector de ubicación...
    </div>
  ),
});

/* Mini mapa — importación dinámica para evitar errores de SSR con Leaflet. */
const BuildingMiniMap = dynamic(() => import("@/components/BuildingMiniMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 220,
        width: "100%",
        borderRadius: 8,
        background: "var(--bg-card-hover)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      Cargando mapa...
    </div>
  ),
});

/* ─── Mapa de iconos de tipo de propiedad ─────────────────────────── */

const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  Building2, Store, Warehouse, Factory, MapPin,
};

const PROPERTY_TYPE_VALUES: string[] = PROPERTY_TYPES.map((pt) => pt.value);
const FEATURES_TYPES = ["commercial", "industrial", "industrial_park"];

/* ─── Tipos ─────────────────────────────────────────────────────────── */

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  code: string | null;
  building_category: string | null;
  building_subcategory: string | null;
  latitude: number | null;
  longitude: number | null;
  land_sqm: number | null;
  construction_sqm: number | null;
  default_unit_sqm: number | null;
  building_tags: string[] | null;
  building_features: Record<string, boolean> | null;
  parent_building_id: string | null;
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

/* UnitStatusRow incluye created_at para el cálculo de tendencia */
type UnitStatusRow = {
  id: string;
  status: string | null;
  created_at: string;
};

type UnitTypeRow = { id: string };

type BuildingBillingConceptCode = "rent" | "electricity" | "water" | "gas" | "amenities";

type BuildingBillingConcept = {
  id: string;
  building_id: string;
  concept_code: BuildingBillingConceptCode;
  is_active: boolean;
};

type CollectionRecord = {
  id: string;
  period_year: number;
  period_month: number;
  amount_due: number;
  amount_collected: number | null;
  status: string;
};

type LeaseForTrend = {
  unit_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type LandLease = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  rent_amount: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  leased_sqm: number | null;
};

type TrendPoint = { label: string; total: number; occupied: number; pct: number };

type ChildBuilding = {
  id: string;
  name: string;
  code: string | null;
  building_category: string | null;
  total_sqm: number | null;
  land_sqm: number | null;
  construction_sqm: number | null;
};

type BuildingAssetRow = {
  id: string;
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type UtilityMeterForOverview = {
  id: string;
  service_type: UtilityServiceType;
  meter_type: "dedicated" | "shared";
  billing_mode: "charged" | "included";
  contract_holder: "tenant" | "company";
};

type ParkingSpot = {
  id: string;
  spot_number: number;
  status: string;
  tenant_id: string | null;
  lease_id: string | null;
  monthly_fee: number;
  notes: string | null;
  created_at: string;
};

type BuildingLeaseForParking = {
  id: string;
  unit_id: string | null;
  unit_number: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  due_day: number | null;
};

function utilityMeterBillsTenant(m: UtilityMeterForOverview): boolean {
  if (m.meter_type === "dedicated") return m.contract_holder === "company";
  return m.billing_mode === "charged";
}

function UtilityServiceIcon({ type, size = 14 }: { type: UtilityServiceType; size?: number }) {
  switch (type) {
    case "electricity": return <Zap size={size} />;
    case "gas":         return <Flame size={size} />;
    case "water":       return <Droplets size={size} />;
    case "internet":    return <Wifi size={size} />;
    default:            return <Settings2 size={size} />;
  }
}

type UnitRow = {
  id: string;
  unit_number: string;
  display_code: string | null;
};

/* ─── Constantes ─────────────────────────────────────────────────────── */

const BILLING_CONCEPT_OPTIONS: Array<{
  code: BuildingBillingConceptCode;
  label: string;
  icon: ReactNode;
}> = [
  { code: "rent",        label: "Renta",        icon: <CreditCard size={14} /> },
  { code: "electricity", label: "Electricidad",  icon: <Zap size={14} /> },
  { code: "water",       label: "Agua",          icon: <Droplets size={14} /> },
  { code: "gas",         label: "Gas",           icon: <Flame size={14} /> },
  { code: "amenities",   label: "Amenidades",    icon: <Gem size={14} /> },
];

const MONTH_LABELS = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic",
];

const BUILDING_ASSET_TYPES: Array<{ value: string; label: string }> = [
  { value: "ELEVATOR",      label: "Elevador" },
  { value: "CISTERN",       label: "Cisterna" },
  { value: "HYDROPNEUMATIC",label: "Sistema hidroneumático" },
  { value: "GENERATOR",     label: "Generador" },
  { value: "PUMP",          label: "Bomba de agua" },
  { value: "GATE",          label: "Portón / Acceso" },
  { value: "SECURITY_CAMERA",label: "Cámara de seguridad" },
  { value: "INTERCOM",      label: "Intercomunicador" },
  { value: "COMMON_AREA_AC",label: "A/C de áreas comunes" },
  { value: "OTHER",         label: "Otro" },
];

const ASSET_STATUS_OPTIONS = [
  { value: "active",   label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "pending",  label: "Pendiente" },
];

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "Sin tamaño";
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    architectural_plan: "Plano arquitectónico",
    render:             "Render",
    photo:              "Fotografía",
    technical_document: "Documento técnico",
  };
  return map[cat] || "Otro";
}

function formatMXN(v: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(v || 0);
}

/** Devuelve los últimos N meses como {year, month, label} en orden ascendente */
function getLastNMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: MONTH_LABELS[d.getMonth()] };
  });
}

/**
 * Calcula la tendencia de ocupación por mes.
 * - total: unidades creadas antes del fin del mes (deleted_at IS NULL => siguen activas)
 * - occupied: leases cuyo rango de fechas se solapa con el mes
 */
function computeOccupancyTrend(
  units: Array<{ created_at: string }>,
  leases: LeaseForTrend[]
): TrendPoint[] {
  return getLastNMonths(12).map(({ label, year, month }) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay  = new Date(year, month, 0, 23, 59, 59);

    const total = units.filter((u) => new Date(u.created_at) <= lastDay).length;

    const occupied = leases.filter((l) => {
      /* start_date tiene prioridad; fallback a created_at */
      const start = new Date((l.start_date || l.created_at) as string);
      const end   = l.end_date ? new Date(l.end_date) : null;
      return start <= lastDay && (!end || end >= firstDay);
    }).length;

    return { label, total, occupied, pct: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  });
}

/* ─── Componentes locales ────────────────────────────────────────────── */

/**
 * Dona SVG grande para la métrica de ocupación.
 * Sustituye al MetricCard para esta métrica específica.
 */
function OccupancyDonutCard({ occupied, total }: { occupied: number; total: number }) {
  const pct   = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const color = total === 0 ? "#E5E7EB"
    : pct >= 75 ? "#10B981"
    : pct >= 40 ? "#F59E0B"
    : "#EF4444";

  const r    = 44;
  const circ = 2 * Math.PI * r;
  const off  = total === 0 ? circ : circ - (pct / 100) * circ;

  return (
    <AppCard>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* SVG donut */}
        <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <circle
              cx="50" cy="50" r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={off}
              style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3, textAlign: "center" }}>
              ocupación
            </span>
          </div>
        </div>

        {/* Info textual */}
        <div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
            Ocupación actual
          </p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            {occupied} ocupadas de {total} totales
          </p>
        </div>
      </div>
    </AppCard>
  );
}

/** Mini-card para el resumen de información general */
function SummaryItem({
  label, value, icon,
}: {
  label: string; value: string; icon: ReactNode;
}) {
  return (
    <AppCard style={{ padding: 16, borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</p>
          <strong style={{ display: "block", lineHeight: 1.2 }}>{value}</strong>
        </div>
        <AppIconBox size={38} radius={12}>{icon}</AppIconBox>
      </div>
    </AppCard>
  );
}

/* ─── Tooltips recharts ──────────────────────────────────────────────── */

function CollectionTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: "2px 0", color: p.color }}>
          {p.name}: <strong>{formatMXN(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function OccupancyTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const totalVal    = (payload.find((p: any) => p.dataKey === "total")?.value as number) || 0;
  const occupiedVal = (payload.find((p: any) => p.dataKey === "occupied")?.value as number) || 0;
  const pct         = totalVal > 0 ? Math.round((occupiedVal / totalVal) * 100) : 0;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{label}</p>
      <p style={{ margin: "2px 0", color: "#3B82F6" }}>Total: <strong>{totalVal}</strong></p>
      <p style={{ margin: "2px 0", color: "#10B981" }}>Ocupadas: <strong>{occupiedVal}</strong></p>
      <p style={{ margin: "2px 0", color: "var(--text-muted)" }}>Ocupación: <strong>{pct}%</strong></p>
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
      <p style={{ color: item.payload.color as string, fontWeight: 700 }}>
        {item.name as string}: <strong>{item.value as number}</strong>
      </p>
    </div>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────── */

export default function BuildingDetailPage() {
  const router    = useRouter();
  const params    = useParams();
  const buildingId = params.buildingId as string;
  const { user, loading } = useCurrentUser();

  /* Estado de datos */
  const [building, setBuilding]             = useState<Building | null>(null);
  const [files, setFiles]                   = useState<BuildingFile[]>([]);
  const [unitStatuses, setUnitStatuses]     = useState<UnitStatusRow[]>([]);
  const [unitTypeCount, setUnitTypeCount]   = useState(0);
  const [billingConcepts, setBillingConcepts] = useState<BuildingBillingConcept[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [leasesForTrend, setLeasesForTrend] = useState<LeaseForTrend[]>([]);
  const [buildingAssets, setBuildingAssets] = useState<BuildingAssetRow[]>([]);

  /* Estado de UI */
  const [activeTab, setActiveTab]             = useState("overview");
  const [msg, setMsg]                         = useState("");
  const [loadingBuilding, setLoadingBuilding] = useState(true);
  const [collectionMonths, setCollectionMonths] = useState<3 | 6>(3);
  const [savingBillingConcept, setSavingBillingConcept] =
    useState<BuildingBillingConceptCode | null>(null);
  const [openActionsAssetId, setOpenActionsAssetId] = useState<string | null>(null);

  /* Estado de modales */
  const [isEditModalOpen, setIsEditModalOpen]     = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [savingEdit, setSavingEdit]               = useState(false);
  const [deletingBuilding, setDeletingBuilding]   = useState(false);

  /* Modales de assets del edificio */
  const [assetCreateOpen, setAssetCreateOpen]   = useState(false);
  const [assetEditOpen, setAssetEditOpen]       = useState(false);
  const [assetArchiveOpen, setAssetArchiveOpen] = useState(false);
  const [selectedAsset, setSelectedAsset]       = useState<BuildingAssetRow | null>(null);
  const [savingAsset, setSavingAsset]           = useState(false);
  const [assetModalMsg, setAssetModalMsg]       = useState("");

  /* Unidades del edificio (para BuildingServicesTab) */
  const [buildingUnits, setBuildingUnits] = useState<UnitRow[]>([]);

  /* Servicios activos (para card en Resumen) */
  const [utilityMeters, setUtilityMeters] = useState<UtilityMeterForOverview[]>([]);

  /* Counts de tabs (cargados al inicio para evitar mostrar 0) */
  const [tabCounts, setTabCounts] = useState({ assets: 0, docs: 0, gallery: 0, services: 0, parking: 0 });

  /* Contratos directos del edificio (land, commercial, industrial) */
  const [landLeases, setLandLeases] = useState<LandLease[]>([]);

  /* Bodegas hijas (industrial_park) */
  const [childBuildings, setChildBuildings] = useState<ChildBuilding[]>([]);
  const [isCreateBodegaOpen, setIsCreateBodegaOpen] = useState(false);
  const [savingBodega, setSavingBodega] = useState(false);
  const [bodegaName, setBodegaName] = useState("");
  const [bodegaCode, setBodegaCode] = useState("");
  const [bodegaLandSqm, setBodegaLandSqm] = useState("");
  const [bodegaConstructionSqm, setBodegaConstructionSqm] = useState("");
  const [bodegaFeatures, setBodegaFeatures] = useState<Record<string, boolean>>({});
  const [bodegaMsg, setBodegaMsg] = useState("");

  /* Cajones de estacionamiento */
  const [parkingSpots, setParkingSpots]   = useState<ParkingSpot[]>([]);
  const [parkingLeases, setParkingLeases] = useState<BuildingLeaseForParking[]>([]);
  const [loadingParking, setLoadingParking] = useState(false);
  const [createSpotOpen, setCreateSpotOpen] = useState(false);
  const [newSpotNumber, setNewSpotNumber]   = useState("");
  const [savingSpot, setSavingSpot]         = useState(false);
  const [spotMsg, setSpotMsg]               = useState("");
  const [assignSpot, setAssignSpot]         = useState<ParkingSpot | null>(null);
  const [assignLeaseId, setAssignLeaseId]   = useState("");
  const [assignFee, setAssignFee]           = useState("0");
  const [assignNotes, setAssignNotes]       = useState("");
  const [savingAssign, setSavingAssign]     = useState(false);
  const [assignMsg, setAssignMsg]           = useState("");
  const [releaseSpot, setReleaseSpot]       = useState<ParkingSpot | null>(null);
  const [savingRelease, setSavingRelease]   = useState(false);

  /* Formulario de asset */
  const [assetType, setAssetType]   = useState("ELEVATOR");
  const [assetName, setAssetName]   = useState("");
  const [assetStatus, setAssetStatus] = useState("active");
  const [assetNotes, setAssetNotes] = useState("");

  /* Estado de formulario edición */
  const [name, setName]                               = useState("");
  const [code, setCode]                               = useState("");
  const [address, setAddress]                         = useState("");
  const [buildingCategory, setBuildingCategory]       = useState("residential");
  const [editBuildingTags, setEditBuildingTags]       = useState<string[]>([]);
  const [editBuildingFeatures, setEditBuildingFeatures] = useState<Record<string, boolean>>({});
  const [editLandSqm, setEditLandSqm]                 = useState("");
  const [editConstructionSqm, setEditConstructionSqm] = useState("");
  const [editDefaultUnitSqm, setEditDefaultUnitSqm]   = useState("");
  const [editLatitude, setEditLatitude]               = useState("");
  const [editLongitude, setEditLongitude]             = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) void loadBuilding();
  }, [user, buildingId]);

  useEffect(() => {
    if (activeTab === "parking" && building && !loadingBuilding) void loadParkingData();
  }, [activeTab, building, loadingBuilding]);

  /* ── Carga de datos ──────────────────────────────────────────────── */

  async function loadBuilding() {
    if (!user?.company_id || !buildingId) return;
    setLoadingBuilding(true);
    setMsg("");

    const { data, error } = await supabase
      .from("buildings")
      .select("id, company_id, name, address, code, building_category, building_subcategory, latitude, longitude, land_sqm, construction_sqm, default_unit_sqm, building_tags, building_features, parent_building_id")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .single();

    if (error) { setMsg("No se pudo cargar el edificio."); setLoadingBuilding(false); return; }

    const b = data as Building;
    setBuilding(b);
    setName(b.name || "");
    setCode(b.code || "");
    setAddress(b.address || "");
    setBuildingCategory(b.building_category || "residential");

    /* Queries paralelas — units incluye created_at para tendencia */
    const [
      { data: filesData },
      { data: unitsData },
      { data: unitTypesData },
      { data: billingData },
      { data: collData },
      { data: assetsData },
    ] = await Promise.all([
      supabase
        .from("building_files")
        .select("id, building_id, file_name, file_type, file_category, storage_path, public_url, mime_type, file_size_bytes, notes, sort_order, is_cover, created_at")
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),

      supabase
        .from("units")
        .select("id, status, created_at")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("unit_types")
        .select("id")
        .eq("building_id", buildingId)
        .is("deleted_at", null),

      supabase
        .from("building_billing_concepts")
        .select("id, building_id, concept_code, is_active")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: true }),

      supabase
        .from("collection_records")
        .select("id, period_year, period_month, amount_due, amount_collected, status")
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(200),

      supabase
        .from("assets")
        .select("id, asset_type, name, status, notes, created_at")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("unit_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    setFiles((filesData as BuildingFile[]) || []);
    setUnitStatuses((unitsData as UnitStatusRow[]) || []);
    setUnitTypeCount((unitTypesData as UnitTypeRow[] | null)?.length || 0);
    setBillingConcepts((billingData as BuildingBillingConcept[]) || []);
    setCollectionRecords((collData as CollectionRecord[]) || []);
    setBuildingAssets((assetsData as BuildingAssetRow[]) || []);

    /* Leases para tendencia — consulta independiente tras conocer unit_ids */
    const unitIds = ((unitsData || []) as Array<{ id: string }>).map((u) => u.id);
    if (unitIds.length > 0) {
      const { data: lData } = await supabase
        .from("leases")
        .select("unit_id, start_date, end_date, created_at")
        .in("unit_id", unitIds)
        .is("deleted_at", null);
      setLeasesForTrend((lData as LeaseForTrend[]) || []);
    } else {
      setLeasesForTrend([]);
    }

    /* Contratos directos del edificio (land, commercial, industrial) — unit_id IS NULL */
    if (["land", "commercial", "industrial"].includes(b.building_category ?? "")) {
      type LLRow = { id: string; tenant_id: string; rent_amount: number; start_date: string | null; end_date: string | null; status: string; leased_sqm: number | null };
      const { data: llData } = await supabase
        .from("leases")
        .select("id, tenant_id, rent_amount, start_date, end_date, status, leased_sqm")
        .eq("building_id", buildingId)
        .is("unit_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const llRows = (llData || []) as LLRow[];

      const tIds = [...new Set(llRows.map((l) => l.tenant_id).filter(Boolean))];
      const tenantNameMap: Record<string, string> = {};
      if (tIds.length > 0) {
        const { data: tData } = await supabase.from("tenants").select("id, full_name").in("id", tIds);
        for (const t of (tData || []) as Array<{ id: string; full_name: string }>) {
          tenantNameMap[t.id] = t.full_name;
        }
      }
      setLandLeases(llRows.map((l) => ({ ...l, tenant_name: tenantNameMap[l.tenant_id] ?? null })));
    } else {
      setLandLeases([]);
    }

    /* Bodegas hijas (industrial_park) */
    if (b.building_category === "industrial_park") {
      const { data: cbData } = await supabase
        .from("buildings")
        .select("id, name, code, building_category, total_sqm, land_sqm, construction_sqm")
        .eq("parent_building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("name");
      setChildBuildings((cbData || []) as ChildBuilding[]);
    } else {
      setChildBuildings([]);
    }

    // Unidades del edificio para BuildingServicesTab + servicios para Resumen
    const [{ data: allUnits }, { data: utilMetersData }] = await Promise.all([
      supabase
        .from("units")
        .select("id, unit_number, display_code")
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("unit_number"),
      supabase
        .from("building_utility_meters")
        .select("id, service_type, meter_type, billing_mode, contract_holder")
        .eq("building_id", buildingId)
        .eq("active", true)
        .is("deleted_at", null),
    ]);
    setBuildingUnits((allUnits || []) as UnitRow[]);
    setUtilityMeters((utilMetersData || []) as UtilityMeterForOverview[]);

    // Counts de todos los tabs — consultas head:true, sin traer filas
    const [
      { count: aCount },
      { count: dCount },
      { count: gCount },
      { count: sCount },
      { count: pCount },
    ] = await Promise.all([
      supabase.from("assets").select("*", { count: "exact", head: true })
        .eq("building_id", buildingId).is("unit_id", null).is("deleted_at", null),
      supabase.from("building_files").select("*", { count: "exact", head: true })
        .eq("building_id", buildingId).eq("file_type", "document").is("deleted_at", null),
      supabase.from("building_files").select("*", { count: "exact", head: true })
        .eq("building_id", buildingId).eq("file_type", "image").is("deleted_at", null),
      supabase.from("building_utility_meters").select("*", { count: "exact", head: true })
        .eq("building_id", buildingId).eq("active", true).is("deleted_at", null),
      supabase.from("parking_spots").select("*", { count: "exact", head: true })
        .eq("building_id", buildingId).is("deleted_at", null),
    ]);
    setTabCounts({
      assets:   aCount ?? 0,
      docs:     dCount ?? 0,
      gallery:  gCount ?? 0,
      services: sCount ?? 0,
      parking:  pCount ?? 0,
    });

    setLoadingBuilding(false);
  }

  /* ── Cajones de estacionamiento ─────────────────────────────────── */

  async function loadParkingData() {
    if (!user?.company_id || !building) return;
    setLoadingParking(true);
    const { data: spots } = await supabase
      .from("parking_spots")
      .select("id, spot_number, status, tenant_id, lease_id, monthly_fee, notes, created_at")
      .eq("building_id", building.id)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .order("spot_number");
    const spotsArr = (spots || []) as ParkingSpot[];
    setParkingSpots(spotsArr);
    setTabCounts(prev => ({ ...prev, parking: spotsArr.length }));

    const unitIds = buildingUnits.map(u => u.id);
    if (unitIds.length > 0) {
      type LRow = { id: string; unit_id: string | null; tenant_id: string | null; due_day: number | null };
      type TRow = { id: string; full_name: string };

      // Step 1: leases activos de las unidades del edificio
      const { data: lData } = await supabase
        .from("leases")
        .select("id, unit_id, tenant_id, due_day")
        .in("unit_id", unitIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null);
      const leaseList = (lData || []) as LRow[];

      // Step 2: nombres de inquilinos (query separada — evita depender del FK PostgREST)
      const tenantIds = [...new Set(
        leaseList.map(l => l.tenant_id).filter((id): id is string => id != null)
      )];
      const tenantMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: tData } = await supabase
          .from("tenants")
          .select("id, full_name")
          .in("id", tenantIds);
        for (const t of (tData || []) as TRow[]) tenantMap[t.id] = t.full_name;
      }

      // Step 3: combinar con unit_number desde buildingUnits (ya cargado)
      setParkingLeases(leaseList.map(l => {
        const unit = buildingUnits.find(u => u.id === l.unit_id);
        return {
          id: l.id, unit_id: l.unit_id, tenant_id: l.tenant_id, due_day: l.due_day,
          tenant_name: l.tenant_id ? (tenantMap[l.tenant_id] ?? null) : null,
          unit_number: unit?.unit_number ?? null,
        };
      }));
    } else {
      setParkingLeases([]);
    }
    setLoadingParking(false);
  }

  async function handleCreateSpot() {
    if (!user?.company_id || !building) return;
    const num = parseInt(newSpotNumber, 10);
    if (!num || num <= 0) { setSpotMsg("Ingresa un número de cajón válido."); return; }
    setSavingSpot(true);
    setSpotMsg("");
    const { error } = await supabase.from("parking_spots").insert({
      company_id: user.company_id, building_id: building.id,
      spot_number: num, status: "vacant", monthly_fee: 0,
    });
    setSavingSpot(false);
    if (error) { setSpotMsg(error.message); return; }
    setCreateSpotOpen(false);
    setNewSpotNumber("");
    await loadParkingData();
  }

  async function handleAssignSpot() {
    if (!user?.company_id || !building || !assignSpot) return;
    const lease = parkingLeases.find(l => l.id === assignLeaseId);
    if (!lease) { setAssignMsg("Selecciona un contrato."); return; }
    const fee = parseFloat(assignFee) || 0;
    setSavingAssign(true);
    setAssignMsg("");
    const { error } = await supabase.from("parking_spots").update({
      status: "rented", tenant_id: lease.tenant_id,
      lease_id: lease.id, monthly_fee: fee,
      notes: assignNotes.trim() || null,
    }).eq("id", assignSpot.id);
    if (error) { setSavingAssign(false); setAssignMsg(error.message); return; }
    if (fee > 0 && lease.unit_id) {
      await supabase.from("collection_schedules").insert({
        company_id: user.company_id, building_id: building.id,
        unit_id: lease.unit_id, lease_id: lease.id,
        charge_type: "parking",
        title: `Estacionamiento - Cajón ${assignSpot.spot_number}`,
        responsibility_type: "tenant", amount_expected: fee,
        due_day: lease.due_day ?? 5, active: true, billing_frequency: "monthly",
      });
    }
    setSavingAssign(false);
    setAssignSpot(null);
    setAssignLeaseId(""); setAssignFee("0"); setAssignNotes("");
    await loadParkingData();
  }

  async function handleReleaseSpot() {
    if (!user?.company_id || !releaseSpot) return;
    setSavingRelease(true);
    const now = new Date().toISOString();
    if (releaseSpot.lease_id) {
      await supabase.from("collection_schedules")
        .update({ deleted_at: now, active: false })
        .eq("lease_id", releaseSpot.lease_id).eq("charge_type", "parking").is("deleted_at", null);
    }
    const { error } = await supabase.from("parking_spots").update({
      status: "vacant", tenant_id: null, lease_id: null, monthly_fee: 0, notes: null,
    }).eq("id", releaseSpot.id);
    setSavingRelease(false);
    setReleaseSpot(null);
    if (error) { setMsg(error.message); return; }
    await loadParkingData();
  }

  /* ── Derivaciones ─────────────────────────────────────────────────── */

  const documentFiles = useMemo(() => files.filter((f) => f.file_type === "document"), [files]);
  const imageFiles    = useMemo(() => files.filter((f) => f.file_type === "image"),    [files]);

  /* Ocupación: RENTED, OCCUPIED y PARTIAL cuentan como ocupadas */
  const occupiedUnits    = unitStatuses.filter((u) => {
    const s = (u.status || "").toUpperCase();
    return s === "RENTED" || s === "OCCUPIED" || s === "PARTIAL";
  }).length;
  const partialUnits     = unitStatuses.filter((u) => (u.status || "").toUpperCase() === "PARTIAL").length;
  const vacantUnits      = unitStatuses.filter((u) => (u.status || "").toUpperCase() === "VACANT").length;
  const maintenanceUnits = unitStatuses.filter((u) => (u.status || "").toUpperCase() === "MAINTENANCE").length;
  const totalUnits       = unitStatuses.length;

  /* Variante de color de la dona de ocupación */
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  /* Datos para el PieChart de distribución */
  const rentedUnits = occupiedUnits - partialUnits;
  const pieData = useMemo(() => [
    { name: "Rentados",      value: rentedUnits,      color: "#10B981" },
    { name: "Parciales",     value: partialUnits,     color: "#F59E0B" },
    { name: "Disponibles",   value: vacantUnits,      color: "#3B82F6" },
    { name: "Mantenimiento", value: maintenanceUnits, color: "#EF4444" },
  ].filter((d) => d.value > 0), [rentedUnits, partialUnits, vacantUnits, maintenanceUnits]);

  /* Datos para el BarChart de cobranza — últimos N meses */
  const collectionChartData = useMemo(() => {
    return getLastNMonths(6).slice(6 - collectionMonths).map(({ year, month, label }) => {
      const records  = collectionRecords.filter((r) => r.period_year === year && r.period_month === month);
      const cobrado  = records.reduce((s, r) => s + (r.amount_collected ?? 0), 0);
      const pendiente = records.reduce((s, r) => s + Math.max(0, r.amount_due - (r.amount_collected ?? 0)), 0);
      return { label, cobrado, pendiente };
    });
  }, [collectionRecords, collectionMonths]);

  const hasCollectionData = collectionChartData.some((d) => d.cobrado > 0 || d.pendiente > 0);

  /* Tendencia de ocupación — últimos 12 meses */
  const occupancyTrend = useMemo(
    () => computeOccupancyTrend(unitStatuses, leasesForTrend),
    [unitStatuses, leasesForTrend]
  );
  const hasTrendData = occupancyTrend.some((d) => d.total > 0);

  const activeBillingConceptCodes = billingConcepts
    .filter((item) => item.is_active)
    .map((item) => item.concept_code);

  /* ── Valores derivados para el modal de edición ─────────────────── */

  const editSelectedTypes = [
    ...(PROPERTY_TYPE_VALUES.includes(buildingCategory) ? [buildingCategory] : []),
    ...editBuildingTags.filter((t) => PROPERTY_TYPE_VALUES.includes(t) && t !== buildingCategory),
  ];
  const editShowFeatures = editSelectedTypes.some((t) => FEATURES_TYPES.includes(t));

  const editLatNum = editLatitude.trim() && Number.isFinite(Number(editLatitude)) ? Number(editLatitude) : null;
  const editLngNum = editLongitude.trim() && Number.isFinite(Number(editLongitude)) ? Number(editLongitude) : null;

  function toggleEditType(value: string) {
    const primary = buildingCategory;
    const secTags = editBuildingTags.filter((t) => PROPERTY_TYPE_VALUES.includes(t) && t !== primary);
    const all = [
      ...(PROPERTY_TYPE_VALUES.includes(primary) ? [primary] : []),
      ...secTags,
    ];
    if (all.includes(value)) {
      if (value === primary) {
        if (secTags.length === 0) return;
        setBuildingCategory(secTags[0]);
        setEditBuildingTags(secTags.slice(1));
      } else {
        setEditBuildingTags(secTags.filter((t) => t !== value));
      }
    } else {
      if (all.length >= 3) return;
      setEditBuildingTags([...secTags, value]);
    }
  }

  function toggleEditFeature(key: string) {
    setEditBuildingFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleEditLocationChange(lat: number, lng: number, addr?: string) {
    setEditLatitude(String(lat));
    setEditLongitude(String(lng));
    if (addr && !address.trim()) setAddress(addr);
  }

  /* ── Handlers ─────────────────────────────────────────────────────── */

  function openEditModal() {
    if (!building) return;
    setName(building.name || "");
    setCode(building.code || "");
    setAddress(building.address || "");

    // Combinar category + tags, filtrar inválidos, deduplicar con Set
    const rawTypes = [building.building_category, ...(building.building_tags ?? [])].filter(
      (t): t is string => !!t && PROPERTY_TYPE_VALUES.includes(t),
    );
    const dedupedTypes = [...new Set(rawTypes)];
    const initTypes = dedupedTypes.length > 0 ? dedupedTypes : ["residential"];
    setBuildingCategory(initTypes[0]);
    setEditBuildingTags(initTypes.slice(1));
    setEditBuildingFeatures(building.building_features ?? {});
    setEditLandSqm(building.land_sqm != null ? String(building.land_sqm) : "");
    setEditConstructionSqm(building.construction_sqm != null ? String(building.construction_sqm) : "");
    setEditDefaultUnitSqm(building.default_unit_sqm != null ? String(building.default_unit_sqm) : "");
    setEditLatitude(building.latitude != null ? String(building.latitude) : "");
    setEditLongitude(building.longitude != null ? String(building.longitude) : "");
    setIsEditModalOpen(true);
    setMsg("");
  }

  async function handleUpdateBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !building) { setMsg("No se encontró el edificio."); return; }
    if (!name.trim()) { setMsg("El nombre del edificio es obligatorio."); return; }
    setSavingEdit(true);
    setMsg("");

    const latNum  = editLatitude.trim()  ? Number(editLatitude)  : null;
    const lngNum  = editLongitude.trim() ? Number(editLongitude) : null;

    const { error } = await supabase
      .from("buildings")
      .update({
        name: name.trim(),
        code: code.trim() || null,
        address: address.trim() || null,
        building_category: buildingCategory,
        building_subcategory: null,
        building_tags: editBuildingTags,
        building_features: editBuildingFeatures,
        land_sqm: editLandSqm.trim() ? Number(editLandSqm) : null,
        construction_sqm: editConstructionSqm.trim() ? Number(editConstructionSqm) : null,
        default_unit_sqm: buildingCategory !== "land" && editDefaultUnitSqm.trim() ? Number(editDefaultUnitSqm) : null,
        latitude:  latNum !== null && Number.isFinite(latNum)  ? latNum  : null,
        longitude: lngNum !== null && Number.isFinite(lngNum) ? lngNum : null,
      })
      .eq("id", building.id)
      .eq("company_id", user.company_id);

    setSavingEdit(false);
    if (error) { setMsg(`No se pudo actualizar el edificio. ${error.message}`); return; }
    setIsEditModalOpen(false);
    await loadBuilding();
    setMsg("Edificio actualizado correctamente.");
  }

  async function handleCreateBodega(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !building) return;
    if (!bodegaName.trim()) { setBodegaMsg("El nombre es obligatorio."); return; }
    setSavingBodega(true);
    setBodegaMsg("");
    const { error } = await supabase.from("buildings").insert({
      company_id: user.company_id,
      name: bodegaName.trim(),
      code: bodegaCode.trim() || null,
      building_category: "industrial",
      parent_building_id: building.id,
      land_sqm: bodegaLandSqm.trim() ? Number(bodegaLandSqm) : null,
      construction_sqm: bodegaConstructionSqm.trim() ? Number(bodegaConstructionSqm) : null,
      building_features: bodegaFeatures,
    });
    setSavingBodega(false);
    if (error) { setBodegaMsg(`Error: ${error.message}`); return; }
    setIsCreateBodegaOpen(false);
    setBodegaName(""); setBodegaCode(""); setBodegaLandSqm(""); setBodegaConstructionSqm("");
    setBodegaFeatures({}); setBodegaMsg("");
    await loadBuilding();
  }

  async function handleDeleteBuilding() {
    if (!user?.company_id || !building) return;
    setDeletingBuilding(true);
    setMsg("");
    const now = new Date().toISOString();
    const bid = building.id;

    // 1. Sub-medidores (via metros del edificio)
    const { data: meterRows } = await supabase
      .from("building_utility_meters").select("id")
      .eq("building_id", bid).is("deleted_at", null);
    const meterIds = (meterRows || []).map((m: { id: string }) => m.id);
    if (meterIds.length > 0) {
      await supabase.from("building_utility_sub_meters")
        .update({ deleted_at: now })
        .in("building_utility_meter_id", meterIds).is("deleted_at", null);
    }

    // 2. Metros de servicios
    await supabase.from("building_utility_meters")
      .update({ deleted_at: now }).eq("building_id", bid).is("deleted_at", null);

    // 3. Áreas comunes
    await supabase.from("common_areas")
      .update({ deleted_at: now }).eq("building_id", bid).is("deleted_at", null);

    // 4. Assets del edificio
    await supabase.from("assets")
      .update({ deleted_at: now }).eq("building_id", bid).is("deleted_at", null);

    // 5-7. Cascada via unidades
    const { data: unitRows } = await supabase
      .from("units").select("id")
      .eq("building_id", bid).is("deleted_at", null);
    const unitIds = (unitRows || []).map((u: { id: string }) => u.id);
    if (unitIds.length > 0) {
      await supabase.from("collection_schedules")
        .update({ deleted_at: now, active: false })
        .in("unit_id", unitIds).is("deleted_at", null);
      await supabase.from("collection_records")
        .update({ deleted_at: now })
        .in("unit_id", unitIds).in("status", ["pending", "overdue"]).is("deleted_at", null);
      await supabase.from("leases")
        .update({ deleted_at: now, status: "ENDED" })
        .in("unit_id", unitIds).eq("status", "ACTIVE").is("deleted_at", null);
    }

    // 8. Horarios de limpieza
    await supabase.from("cleaning_unit_schedules")
      .update({ deleted_at: now }).eq("building_id", bid).is("deleted_at", null);

    // 9. Unidades
    await supabase.from("units")
      .update({ deleted_at: now }).eq("building_id", bid).is("deleted_at", null);

    // 10. Edificio
    const { error } = await supabase.from("buildings")
      .update({ deleted_at: now }).eq("id", bid).eq("company_id", user.company_id);

    if (error) { setMsg(`No se pudo eliminar el edificio. ${error.message}`); setDeletingBuilding(false); return; }
    setDeletingBuilding(false);
    setIsDeleteModalOpen(false);
    router.push("/buildings");
  }

  async function toggleBillingConcept(conceptCode: BuildingBillingConceptCode) {
    if (!building || !user?.company_id) return;
    const existing   = billingConcepts.find((item) => item.concept_code === conceptCode);
    const nextActive = !(existing?.is_active ?? false);
    setSavingBillingConcept(conceptCode);
    setMsg("");
    let errorMessage = "";
    if (existing) {
      const { error } = await supabase.from("building_billing_concepts").update({ is_active: nextActive }).eq("id", existing.id);
      if (error) errorMessage = error.message;
    } else {
      const { error } = await supabase.from("building_billing_concepts").insert({
        company_id: user.company_id, building_id: building.id,
        concept_code: conceptCode, is_active: true,
      });
      if (error) errorMessage = error.message;
    }
    setSavingBillingConcept(null);
    if (errorMessage) { setMsg(`No se pudo actualizar la configuración de facturación. ${errorMessage}`); return; }
    await loadBuilding();
  }

  /* ── Handlers de assets del edificio ───────────────────────────── */

  function openCreateAssetModal() {
    setAssetType("ELEVATOR");
    setAssetName("");
    setAssetStatus("active");
    setAssetNotes("");
    setAssetModalMsg("");
    setAssetCreateOpen(true);
  }

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !building) return;
    if (!assetName.trim()) { setAssetModalMsg("El nombre del asset es obligatorio."); return; }
    setSavingAsset(true);
    setAssetModalMsg("");
    const { error } = await supabase.from("assets").insert({
      company_id: user.company_id,
      building_id: building.id,
      unit_id: null,
      asset_type: assetType,
      name: assetName.trim(),
      status: assetStatus,
      notes: assetNotes.trim() || null,
    });
    setSavingAsset(false);
    if (error) { setAssetModalMsg(`Error al crear el asset: ${error.message}`); return; }
    setAssetCreateOpen(false);
    await loadBuilding();
  }

  function openEditAssetModal(asset: BuildingAssetRow) {
    setSelectedAsset(asset);
    setAssetType(asset.asset_type);
    setAssetName(asset.name);
    setAssetStatus(asset.status);
    setAssetNotes(asset.notes || "");
    setAssetModalMsg("");
    setAssetEditOpen(true);
    setOpenActionsAssetId(null);
  }

  async function handleEditAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    if (!assetName.trim()) { setAssetModalMsg("El nombre del asset es obligatorio."); return; }
    setSavingAsset(true);
    setAssetModalMsg("");
    const { error } = await supabase.from("assets").update({
      asset_type: assetType,
      name: assetName.trim(),
      status: assetStatus,
      notes: assetNotes.trim() || null,
    }).eq("id", selectedAsset.id);
    setSavingAsset(false);
    if (error) { setAssetModalMsg(`Error al actualizar el asset: ${error.message}`); return; }
    setAssetEditOpen(false);
    await loadBuilding();
  }

  function openArchiveAssetModal(asset: BuildingAssetRow) {
    setSelectedAsset(asset);
    setAssetModalMsg("");
    setAssetArchiveOpen(true);
    setOpenActionsAssetId(null);
  }

  async function handleArchiveAsset() {
    if (!selectedAsset) return;
    setSavingAsset(true);
    setAssetModalMsg("");
    const { error } = await supabase.from("assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", selectedAsset.id);
    setSavingAsset(false);
    if (error) { setAssetModalMsg(`Error al eliminar el asset: ${error.message}`); return; }
    setAssetArchiveOpen(false);
    await loadBuilding();
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  if (loading)        return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user)          return null;
  if (loadingBuilding) return <PageContainer>Cargando edificio...</PageContainer>;
  if (!building)      return <PageContainer>{msg || "No se encontró el edificio."}</PageContainer>;

  const categoryDefinition = getBuildingCategoryDefinition(building.building_category);
  const labels = getPropertyLabels(building.building_category);
  const isLand         = building.building_category === "land";
  const isCommercial   = building.building_category === "commercial";
  const isIndustrial   = building.building_category === "industrial";
  const isIndustrialPark = building.building_category === "industrial_park";
  const hasLeasesTab   = isLand || isCommercial || isIndustrial;
  const hasParkingTab  = !isLand && !isCommercial && !isIndustrial && !isIndustrialPark;
  const hasAssetsTab   = !isIndustrialPark;
  const hasServicesTab = !isIndustrialPark;
  const hasBodegasTab  = isIndustrialPark;
  const hideUnitsUI    = isLand || isIndustrialPark;

  function getBuildingDetailLabel(cat: string | null): string {
    switch (cat) {
      case "commercial":    return "Detalle de la propiedad";
      case "industrial":    return "Detalle de la nave";
      case "industrial_park": return "Detalle del parque";
      case "land":          return "Detalle del terreno";
      default:              return "Detalle del edificio";
    }
  }

  return (
    <PageContainer>
      {/* ── Breadcrumb dinámico ── */}
      <div style={{ width: "100%", padding: "18px 0 0 0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text-secondary)" }}>
          <a href="/dashboard" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Inicio</a>
          <span style={{ color: "var(--text-muted)" }}>{">"}</span>
          <a href="/buildings" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Propiedades</a>
          <span style={{ color: "var(--text-muted)" }}>{">"}</span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{getBuildingDetailLabel(building.building_category)}</span>
        </div>
      </div>

      <PageHeader
        title={building.name}
        titleIcon={<Building2 size={20} />}
        subtitle={`Vista general del ${labels.building.toLowerCase()} — ocupación, ${labels.collections.toLowerCase()} y tendencia.`}
        actions={
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {/* Volver */}
            <a
              href="/buildings"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border-default)", background: "var(--bg-card)",
                color: "var(--text-primary)", cursor: "pointer", textDecoration: "none",
                fontSize: 11, fontWeight: 600,
              }}
            >
              <ArrowLeft size={18} />
              <span>Volver</span>
            </a>
            {/* Editar */}
            <button
              type="button"
              onClick={openEditModal}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border-default)", background: "var(--bg-card)",
                color: "var(--text-primary)", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
              }}
            >
              <Pencil size={18} />
              <span>Editar</span>
            </button>
            {/* Unidades — oculto para terrenos y parques industriales */}
            {!hideUnitsUI && (
              <a
                href={`/buildings/${building.id}/units`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 4, padding: "10px 12px", borderRadius: 10,
                  border: "1px solid var(--accent)", background: "var(--accent)",
                  color: "#ffffff", cursor: "pointer", textDecoration: "none",
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <Layers3 size={18} />
                <span>{labels.units}</span>
              </a>
            )}
            {/* Eliminar */}
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "10px 12px", borderRadius: 10,
                border: "1px solid #dc2626", background: "transparent",
                color: "#dc2626", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
              }}
            >
              <Trash2 size={18} />
              <span>Eliminar</span>
            </button>
          </div>
        }
      />

      {msg ? (
        <p style={{ color: msg.includes("correctamente") ? "var(--badge-text-green)" : "var(--badge-text-red)", marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {msg}
        </p>
      ) : null}

      {/* ── Tabs ── */}
      <AppTabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "overview",  label: "Resumen",    icon: <Building2 size={16} /> },
          ...(hasLeasesTab  ? [{ key: "leases",  label: labels.leases, icon: <FileClockIcon size={16} />, count: landLeases.length }] : []),
          ...(hasBodegasTab ? [{ key: "bodegas", label: "Bodegas",     icon: <Warehouse size={16} />,    count: childBuildings.length }] : []),
          ...(hasAssetsTab  ? [{ key: "assets",  label: "Activos",     icon: <Package size={16} />,      count: tabCounts.assets }] : []),
          { key: "documents", label: "Documentos", icon: <FolderOpen size={16} />, count: tabCounts.docs },
          { key: "gallery",   label: "Galería",    icon: <FileImage size={16} />,  count: tabCounts.gallery },
          ...(hasServicesTab ? [{ key: "services", label: "Servicios", icon: <Wrench size={16} />,       count: tabCounts.services }] : []),
          ...(hasParkingTab  ? [{ key: "parking",  label: "Cajones",   icon: <Car size={16} />,          count: tabCounts.parking }] : []),
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 24 }}>

          {/* ── Fila 1: métricas ── */}
          {isIndustrialPark ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              <MetricCard label="Bodegas" value={String(childBuildings.length)} icon={<Warehouse size={18} />} helper="Naves en el parque" />
              {building.land_sqm != null && (
                <MetricCard label="M² totales" value={`${building.land_sqm.toLocaleString("es-MX")} m²`} icon={<Ruler size={18} />} helper="M² de terreno" />
              )}
              {building.construction_sqm != null && (
                <MetricCard label="M² construcción" value={`${building.construction_sqm.toLocaleString("es-MX")} m²`} icon={<Building2 size={18} />} helper="M² construidos" />
              )}
            </div>
          ) : (
            <div className="building-detail-metrics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <OccupancyDonutCard occupied={occupiedUnits} total={totalUnits} />
              {isLand ? (
                building.land_sqm != null ? (
                  <MetricCard
                    label="Superficie total"
                    value={`${building.land_sqm.toLocaleString("es-MX")} m²`}
                    icon={<MapPin size={18} />}
                    helper="M² de terreno registrados"
                  />
                ) : null
              ) : (
                <MetricCard
                  label={labels.units}
                  value={`${occupiedUnits} / ${totalUnits}`}
                  icon={<Home size={18} />}
                  helper="Ocupadas sobre registradas"
                />
              )}
            </div>
          )}

          {/* ── Información general: 2 columnas — datos | mapa ── */}
          <SectionCard
            title="Información general"
            subtitle={`Datos base del ${labels.building.toLowerCase()}.`}
            icon={<Building2 size={18} />}
            action={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <BuildingCategoryBadge category={building.building_category} />
                {building.building_category === "mixed_use" && building.building_subcategory ? (
                  <span style={{ border: "1px solid var(--border-default)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {getMixedUseSubcategoryLabel(building.building_subcategory)}
                  </span>
                ) : null}
              </div>
            }
          >
            <div className="building-detail-info" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "stretch" }}>

              {/* Columna izquierda — datos del edificio */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SummaryItem label="Código"    value={building.code || "Sin código"}      icon={<Tags size={16} />} />
                <SummaryItem label="Dirección" value={building.address || "Sin dirección"} icon={<MapPin size={16} />} />
                <SummaryItem label="Categoría" value={getPropertyType(building.building_category)?.label ?? building.building_category ?? ""}            icon={<Building2 size={16} />} />
                {building.building_category === "mixed_use" && building.building_subcategory ? (
                  <SummaryItem
                    label="Subcategoría"
                    value={getMixedUseSubcategoryLabel(building.building_subcategory)}
                    icon={<Home size={16} />}
                  />
                ) : null}
              </div>

              {/* Columna derecha — mapa o placeholder (se estira para igualar la columna izquierda) */}
              <div style={{ height: "100%", alignSelf: "stretch" }}>
                {building.latitude !== null && building.longitude !== null ? (
                  <BuildingMiniMap
                    latitude={building.latitude}
                    longitude={building.longitude}
                    name={building.name}
                    address={building.address}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      minHeight: 200,
                      background: "var(--bg-card)",
                      border: "0.5px dashed var(--border-default)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                      Sin ubicación registrada
                    </p>
                    <a
                      href="/buildings/map"
                      style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                    >
                      Agregar en el mapa →
                    </a>
                  </div>
                )}
              </div>

            </div>

            {/* ── Métricas de superficie ── */}
            {(building.land_sqm != null || building.construction_sqm != null || building.default_unit_sqm != null) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
                {building.land_sqm != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                    <Ruler size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {building.land_sqm.toLocaleString("es-MX")} m² terreno
                    </span>
                  </div>
                )}
                {building.construction_sqm != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                    <Building2 size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {building.construction_sqm.toLocaleString("es-MX")} m² construcción
                    </span>
                  </div>
                )}
                {building.default_unit_sqm != null && !isLand && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                    <LayoutGrid size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {building.default_unit_sqm.toLocaleString("es-MX")} m²/unidad
                    </span>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── Fila 2: PieChart distribución | BarChart cobranza ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>

            {/* Col izquierda: Distribución — oculta para terrenos y parques */}
            {!isLand && !isIndustrialPark && <SectionCard title={`Distribución de ${labels.units.toLowerCase()}`} icon={<Home size={18} />}>
              {totalUnits === 0 ? (
                <AppEmptyState
                  title={`Sin ${labels.units.toLowerCase()} registrados`}
                  description={`Crea el primer ${labels.unit.toLowerCase()} para ver la distribución aquí.`}
                />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Leyenda manual con conteos */}
                  <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                    {pieData.map((item) => (
                      <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          {item.name}: <strong style={{ color: "var(--text-primary)" }}>{item.value}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>}

            {/* Col derecha: Cobranza — oculta para parques industriales */}
            {!isIndustrialPark && <SectionCard
              title={labels.collections}
              subtitle={`Últimos ${collectionMonths} meses`}
              icon={<CreditCard size={18} />}
              action={
                <button
                  type="button"
                  onClick={() => setCollectionMonths(collectionMonths === 3 ? 6 : 3)}
                  style={{
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: "var(--bg-page)", color: "var(--accent)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8, padding: "5px 10px",
                  }}
                >
                  {collectionMonths === 3 ? "Ver 6 meses" : "Ver 3 meses"}
                </button>
              }
            >
              {!hasCollectionData ? (
                <AppEmptyState
                  title="Sin registros de cobranza"
                  description="No hay cobros registrados para este edificio en el período seleccionado."
                />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={collectionChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v: number) => v >= 1_000 ? `$${Math.round(v / 1_000)}k` : `$${v}`}
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={48}
                    />
                    <Tooltip content={<CollectionTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} formatter={(v: string) => v === "cobrado" ? "Cobrado" : "Pendiente"} />
                    <Bar dataKey="cobrado"   name="cobrado"   fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="pendiente" name="pendiente" fill="#f97316" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>}
          </div>

          {/* ── Fila 3: Tendencia de ocupación — oculta para terrenos y parques ── */}
          {!isLand && !isIndustrialPark && <SectionCard
            title="Tendencia de ocupación"
            subtitle="Últimos 12 meses — total de unidades vs. unidades ocupadas."
            icon={<Building2 size={18} />}
          >
            {!hasTrendData ? (
              <AppEmptyState
                title="Sin histórico suficiente"
                description="No hay datos suficientes para mostrar la tendencia de ocupación."
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={occupancyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={32}
                  />
                  <Tooltip content={<OccupancyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                  <Line
                    type="monotone" dataKey="occupied" name="Ocupadas"
                    stroke="#10B981" strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>}

          {/* ── Fila 4: Grid 2 columnas — Facturación | Accesos (oculta para parques) ── */}
          {!isIndustrialPark && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>

            {/* Servicios activos */}
            <SectionCard title="Servicios activos" subtitle="Gestionado desde el tab Servicios." icon={<Wrench size={18} />}>
              {utilityMeters.length === 0 ? (
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
                    Sin servicios configurados.{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("services")}
                      style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}
                    >
                      Ir a Servicios →
                    </button>
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {utilityMeters.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 999,
                        background: "var(--bg-page)",
                        border: "1px solid var(--border-default)",
                        fontSize: 13,
                      }}
                    >
                      <UtilityServiceIcon type={m.service_type} size={14} />
                      <span style={{ fontWeight: 600 }}>{SERVICE_TYPE_LABEL[m.service_type]}</span>
                      <span style={{ color: "var(--text-muted)" }}>·</span>
                      <span style={{
                        fontSize: 12,
                        color: utilityMeterBillsTenant(m) ? "var(--badge-text-green)" : "var(--text-muted)",
                      }}>
                        {utilityMeterBillsTenant(m) ? "Se cobra" : "Incluido"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Accesos rápidos */}
            <SectionCard title="Accesos rápidos" subtitle="Navega a los módulos del edificio." icon={<Layers3 size={18} />}>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { title: "Tipologías",         desc: `${unitTypeCount} tipos de unidad registrados.`,       href: `/buildings/${building.id}/unit-types`, variant: undefined as "primary" | undefined, hidden: hideUnitsUI },
                  { title: labels.units,          desc: `${totalUnits} ${labels.unit.toLowerCase()}s en el ${labels.building.toLowerCase()}.`, href: `/buildings/${building.id}/units`, variant: "primary" as "primary" | undefined, hidden: hideUnitsUI },
                  { title: "Limpieza",            desc: "Organiza las áreas de limpieza.",                      href: `/buildings/${building.id}/cleaning`,    variant: undefined as "primary" | undefined, hidden: false },
                ].filter(item => !item.hidden).map((item) => (
                  <AppCard key={item.href} style={{ padding: 14, borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ display: "block", marginBottom: 2, fontSize: 14 }}>{item.title}</strong>
                        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>{item.desc}</p>
                      </div>
                      <UiButton href={item.href} variant={item.variant}>Abrir</UiButton>
                    </div>
                  </AppCard>
                ))}
              </div>
            </SectionCard>
          </div>}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: ASSETS DEL EDIFICIO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "assets" ? (() => {
        const activeAssets   = buildingAssets.filter((a) => a.status === "active");
        const inactiveAssets = buildingAssets.filter((a) => a.status !== "active");

        function getAssetStatusBadge(status: string) {
          if (status === "active")   return <AppBadge variant="green">Activo</AppBadge>;
          if (status === "inactive") return <AppBadge variant="red">Inactivo</AppBadge>;
          return <AppBadge variant="amber">Pendiente</AppBadge>;
        }

        return (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Métricas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              <MetricCard
                label="Total assets"
                value={buildingAssets.length}
                icon={<Package size={18} />}
              />
              <MetricCard
                label="Activos"
                value={activeAssets.length}
                icon={<Package size={18} />}
                variant="green"
              />
              <MetricCard
                label="Inactivos / Pendientes"
                value={inactiveAssets.length}
                icon={<Package size={18} />}
                variant="amber"
              />
            </div>

            {/* Lista */}
            <SectionCard
              title="Assets del edificio"
              subtitle="Equipos e instalaciones de áreas comunes."
              icon={<Package size={18} />}
              action={
                <UiButton variant="primary" onClick={openCreateAssetModal}>
                  <Plus size={15} /> Agregar asset
                </UiButton>
              }
            >
              {buildingAssets.length === 0 ? (
                <AppEmptyState
                  title="Sin assets registrados"
                  description="Registra los equipos e instalaciones del edificio."
                />
              ) : (
                <AppGrid minWidth={260} gap={16}>
                  {buildingAssets.map((asset) => {
                    const typeLabel = BUILDING_ASSET_TYPES.find((t) => t.value === asset.asset_type)?.label || asset.asset_type;
                    return (
                      <AppCard key={asset.id} style={{ padding: 16, borderRadius: 16 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <AssetTypeIcon assetType={asset.asset_type} size={18} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: "block", fontSize: 14, marginBottom: 2 }}>{asset.name}</strong>
                            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>{typeLabel}</p>
                            {getAssetStatusBadge(asset.status)}
                          </div>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <button
                              type="button"
                              style={dropdownTriggerStyle}
                              onClick={() => setOpenActionsAssetId(openActionsAssetId === asset.id ? null : asset.id)}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {openActionsAssetId === asset.id && (
                              <div style={dropdownMenuStyle}>
                                <button type="button" style={dropdownActionButtonStyle} onClick={() => openEditAssetModal(asset)}>
                                  <Edit3 size={14} /> Editar
                                </button>
                                <button type="button" style={dropdownDeleteItemStyle} onClick={() => openArchiveAssetModal(asset)}>
                                  <Archive size={14} /> Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {asset.notes ? (
                          <p style={{ margin: "10px 0 0", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
                            {asset.notes}
                          </p>
                        ) : null}
                      </AppCard>
                    );
                  })}
                </AppGrid>
              )}
            </SectionCard>
          </div>
        );
      })() : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: DOCUMENTOS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "documents" ? (
        <SectionCard title="Documentos" subtitle="Planos, PDFs y otros archivos técnicos del edificio." icon={<FolderOpen size={18} />}>
          {documentFiles.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>Todavía no hay documentos registrados para este edificio.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {documentFiles.map((file) => (
                <AppCard key={file.id} style={{ padding: 16, borderRadius: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <AppIconBox size={40} radius={12} background="var(--icon-bg-blue)" color="var(--icon-color-blue)">
                      <FileText size={18} />
                    </AppIconBox>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", marginBottom: 4 }}>{file.file_name}</strong>
                      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                        {getFileCategoryLabel(file.file_category)} · {formatFileSize(file.file_size_bytes)}
                      </p>
                    </div>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: GALERÍA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "gallery" ? (
        <SectionCard title="Galería" subtitle="Renders y fotografías del edificio." icon={<FileImage size={18} />}>
          {imageFiles.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>Todavía no hay imágenes registradas para este edificio.</p>
          ) : (
            <AppGrid minWidth={260} gap={12}>
              {imageFiles.map((file) => (
                <div key={file.id} style={{ border: "1px solid var(--border-default)", borderRadius: 14, overflow: "hidden", background: "var(--bg-card)" }}>
                  {file.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.public_url} alt={file.file_name} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-muted)" }}>
                      <ImageIcon size={22} />
                    </div>
                  )}
                  <div style={{ padding: 14 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>{file.file_name}</strong>
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>{getFileCategoryLabel(file.file_category)}</p>
                  </div>
                </div>
              ))}
            </AppGrid>
          )}
        </SectionCard>
      ) : null}


      {/* ══════════════════════════════════════════════════════════════
          TAB: SERVICIOS DEL EDIFICIO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "services" && building ? (
        <BuildingServicesTab
          buildingId={building.id}
          companyId={building.company_id}
          buildingName={building.name}
          units={buildingUnits}
        />
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: CONTRATOS DE TERRENO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "leases" && hasLeasesTab ? (() => {
        const activeLeases = landLeases.filter((l) => l.status === "ACTIVE");
        const totalLeasedSqm = activeLeases.reduce((s, l) => s + (l.leased_sqm ?? 0), 0);
        const totalLandSqm = building.land_sqm ?? 0;
        const availableSqm = Math.max(0, totalLandSqm - totalLeasedSqm);
        const pctRented = totalLandSqm > 0 ? Math.min(100, Math.round((totalLeasedSqm / totalLandSqm) * 100)) : 0;

        return (
          <div style={{ display: "grid", gap: 20 }}>
            <SectionCard
              title={labels.leases}
              subtitle={`${labels.building} — contratos activos y disponibilidad.`}
              icon={<FileClockIcon size={18} />}
            >
              {/* Barra de ocupación del terreno */}
              {building.land_sqm != null && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                    Ocupación del terreno
                  </p>
                  <div style={{ background: "var(--border-default)", borderRadius: 999, height: 10, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ width: `${pctRented}%`, height: "100%", background: "#10B981", borderRadius: 999, transition: "width 0.4s ease" }} />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    {totalLeasedSqm.toLocaleString("es-MX")} m² rentados
                    {" · "}
                    {availableSqm.toLocaleString("es-MX")} m² disponibles
                    {" · "}
                    {totalLandSqm.toLocaleString("es-MX")} m² totales
                    {" · "}
                    <strong style={{ color: "#10B981" }}>{pctRented}%</strong>
                  </p>
                </div>
              )}

              {landLeases.length === 0 ? (
                <AppEmptyState
                  title={`Sin ${labels.leases.toLowerCase()}`}
                  description={`No hay contratos registrados para este ${labels.building.toLowerCase()}.`}
                />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {landLeases.map((lease) => (
                    <AppCard key={lease.id} style={{ padding: 16, borderRadius: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <strong style={{ fontSize: 14, display: "block", marginBottom: 2 }}>
                            {lease.tenant_name ?? "Arrendatario"}
                          </strong>
                          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>
                            {lease.start_date ?? "Sin fecha"}{lease.end_date ? ` → ${lease.end_date}` : " (sin vencimiento)"}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                          {lease.leased_sqm != null && (
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, margin: 0 }}>
                                {lease.leased_sqm.toLocaleString("es-MX")} m²
                              </p>
                              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0 0" }}>superficie</p>
                            </div>
                          )}
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, margin: 0 }}>
                              {formatMXN(lease.rent_amount)}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0 0" }}>mensual</p>
                          </div>
                          <span style={{
                            padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                            background: lease.status === "ACTIVE" ? "#dcfce7" : "#f3f4f6",
                            color: lease.status === "ACTIVE" ? "#16a34a" : "#6b7280",
                          }}>
                            {lease.status === "ACTIVE" ? "Activo" : lease.status}
                          </span>
                        </div>
                      </div>
                    </AppCard>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        );
      })() : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: CAJONES DE ESTACIONAMIENTO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "parking" ? (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionCard
            title="Cajones de estacionamiento"
            subtitle="Espacios de estacionamiento del edificio."
            icon={<Car size={18} />}
            action={
              <UiButton icon={<Plus size={15} />} onClick={() => { setNewSpotNumber(""); setSpotMsg(""); setCreateSpotOpen(true); }}>
                Agregar cajón
              </UiButton>
            }
          >
            {loadingParking ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "16px 20px" }}>Cargando...</p>
            ) : parkingSpots.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "16px 20px" }}>Sin cajones registrados. Usa &quot;Agregar cajón&quot; para comenzar.</p>
            ) : (
              <div>
                {parkingSpots.map((spot, i) => {
                  const occupied = spot.status === "rented";
                  const tenantName = spot.tenant_id
                    ? (parkingLeases.find(l => l.tenant_id === spot.tenant_id)?.tenant_name ?? null)
                    : null;
                  return (
                    <div key={spot.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 12, padding: "14px 20px", flexWrap: "wrap",
                      borderTop: i > 0 ? "1px solid var(--border-default)" : undefined,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Cajón #{spot.spot_number}</span>
                        <AppBadge variant={occupied ? "red" : "green"}>{occupied ? "Ocupado" : "Disponible"}</AppBadge>
                        {occupied && tenantName && (
                          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{tenantName}</span>
                        )}
                        {occupied && spot.monthly_fee > 0 && (
                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatMXN(spot.monthly_fee)}/mes</span>
                        )}
                      </div>
                      <div>
                        {occupied ? (
                          <UiButton variant="secondary" onClick={() => setReleaseSpot(spot)}>Liberar</UiButton>
                        ) : (
                          <UiButton onClick={() => { setAssignSpot(spot); setAssignLeaseId(""); setAssignFee("0"); setAssignNotes(""); setAssignMsg(""); }}>
                            Asignar
                          </UiButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: BODEGAS (industrial_park)
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "bodegas" && hasBodegasTab ? (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionCard
            title="Bodegas del parque"
            subtitle="Naves industriales que forman parte de este parque."
            icon={<Warehouse size={18} />}
            action={
              <UiButton icon={<Plus size={15} />} onClick={() => { setBodegaName(""); setBodegaCode(""); setBodegaLandSqm(""); setBodegaConstructionSqm(""); setBodegaFeatures({}); setBodegaMsg(""); setIsCreateBodegaOpen(true); }}>
                Agregar bodega
              </UiButton>
            }
          >
            {childBuildings.length === 0 ? (
              <AppEmptyState
                title="Sin bodegas registradas"
                description="Agrega la primera bodega para comenzar a gestionar el parque industrial."
                actionLabel="Agregar primera bodega"
                onAction={() => { setBodegaName(""); setBodegaCode(""); setBodegaLandSqm(""); setBodegaConstructionSqm(""); setBodegaFeatures({}); setBodegaMsg(""); setIsCreateBodegaOpen(true); }}
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {childBuildings.map((cb) => (
                  <AppCard key={cb.id} style={{ padding: 16, borderRadius: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ fontSize: 14, display: "block", marginBottom: 2 }}>{cb.name}</strong>
                        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>
                          {cb.code ? `Código: ${cb.code}` : "Sin código"}
                          {cb.construction_sqm != null ? ` · ${cb.construction_sqm.toLocaleString("es-MX")} m² construcción` : ""}
                          {cb.land_sqm != null ? ` · ${cb.land_sqm.toLocaleString("es-MX")} m² terreno` : ""}
                        </p>
                      </div>
                      <UiButton href={`/buildings/${cb.id}`}>Ver detalle</UiButton>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* ── Modal editar edificio ── */}
      <Modal open={isEditModalOpen} onClose={() => { if (!savingEdit) setIsEditModalOpen(false); }} title="Editar propiedad">
        <form onSubmit={handleUpdateBuilding}>
          {msg && isEditModalOpen ? <p style={errorBannerStyle}>{msg}</p> : null}

          <AppFormField label="Nombre de la propiedad" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Torre Central" style={INPUT_STYLE} />
          </AppFormField>

          <AppFormField label="Código">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. TC-001" style={INPUT_STYLE} />
          </AppFormField>

          <AppFormField label="Tipo de propiedad" required>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {PROPERTY_TYPES.map((pt) => {
                const PtIcon = ICON_MAP[pt.icon];
                const orderIdx = editSelectedTypes.indexOf(pt.value);
                const selected = orderIdx !== -1;
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => toggleEditType(pt.value)}
                    style={{
                      position: "relative",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 4, padding: "10px 8px", borderRadius: 10,
                      border: selected ? `2px solid ${pt.color}` : "2px solid var(--border-default)",
                      background: selected ? pt.color + "15" : "var(--bg-card)",
                      color: selected ? pt.color : "var(--text-secondary)",
                      cursor: "pointer", fontWeight: selected ? 700 : 500, fontSize: 12,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {selected && (
                      <span style={{
                        position: "absolute", top: 4, left: 4,
                        width: 16, height: 16, borderRadius: "50%",
                        background: pt.color, color: "#fff",
                        fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {orderIdx + 1}
                      </span>
                    )}
                    {PtIcon && <PtIcon size={18} color={selected ? pt.color : "var(--text-muted)"} />}
                    {pt.label}
                  </button>
                );
              })}
            </div>
            {editSelectedTypes.length > 1 && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
                Tipo principal: <strong style={{ color: "var(--text-primary)" }}>
                  {PROPERTY_TYPES.find((pt) => pt.value === editSelectedTypes[0])?.label}
                </strong>
              </p>
            )}
          </AppFormField>

          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Superficie
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <AppFormField label="M² de terreno">
                <input value={editLandSqm} onChange={(e) => setEditLandSqm(e.target.value)} type="number" placeholder="Ej: 500" style={INPUT_STYLE} />
              </AppFormField>
              <AppFormField label="M² de construcción">
                <input value={editConstructionSqm} onChange={(e) => setEditConstructionSqm(e.target.value)} type="number" placeholder="Ej: 350" style={INPUT_STYLE} />
              </AppFormField>
            </div>
            {buildingCategory !== "land" && (
              <AppFormField label="M² por unidad (referencia)">
                <input value={editDefaultUnitSqm} onChange={(e) => setEditDefaultUnitSqm(e.target.value)} type="number" placeholder="Ej: 65" style={INPUT_STYLE} />
              </AppFormField>
            )}
          </div>

          {editShowFeatures && (
            <AppFormField label="Características">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BUILDING_FEATURES.map((feat) => {
                  const active = !!editBuildingFeatures[feat.key];
                  return (
                    <label key={feat.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                      <input type="checkbox" checked={active} onChange={() => toggleEditFeature(feat.key)} />
                      {feat.label}
                    </label>
                  );
                })}
              </div>
            </AppFormField>
          )}

          <AppFormField label="Dirección">
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej. Av. Principal 123" style={INPUT_STYLE} />
          </AppFormField>

          <AppFormField label="Ubicación en el mapa (opcional)">
            <LocationPicker
              latitude={editLatNum}
              longitude={editLngNum}
              onLocationChange={handleEditLocationChange}
            />
          </AppFormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={savingEdit}>Cancelar</UiButton>
            <UiButton type="submit" disabled={savingEdit}>{savingEdit ? "Guardando..." : "Guardar cambios"}</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal agregar bodega ── */}
      <Modal open={isCreateBodegaOpen} onClose={() => { if (!savingBodega) setIsCreateBodegaOpen(false); }} title="Agregar bodega">
        <form onSubmit={handleCreateBodega}>
          {bodegaMsg ? <p style={errorBannerStyle}>{bodegaMsg}</p> : null}
          <AppFormField label="Nombre de la bodega" required>
            <input value={bodegaName} onChange={(e) => setBodegaName(e.target.value)} placeholder="Ej. Bodega 1" style={INPUT_STYLE} />
          </AppFormField>
          <AppFormField label="Código">
            <input value={bodegaCode} onChange={(e) => setBodegaCode(e.target.value)} placeholder="Ej. B-01" style={INPUT_STYLE} />
          </AppFormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <AppFormField label="M² de terreno">
              <input value={bodegaLandSqm} onChange={(e) => setBodegaLandSqm(e.target.value)} type="number" placeholder="Ej: 500" style={INPUT_STYLE} />
            </AppFormField>
            <AppFormField label="M² de construcción">
              <input value={bodegaConstructionSqm} onChange={(e) => setBodegaConstructionSqm(e.target.value)} type="number" placeholder="Ej: 350" style={INPUT_STYLE} />
            </AppFormField>
          </div>
          <AppFormField label="Características">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {BUILDING_FEATURES.map((feat) => (
                <label key={feat.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={!!bodegaFeatures[feat.key]} onChange={() => setBodegaFeatures((prev) => ({ ...prev, [feat.key]: !prev[feat.key] }))} />
                  {feat.label}
                </label>
              ))}
            </div>
          </AppFormField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setIsCreateBodegaOpen(false)} disabled={savingBodega}>Cancelar</UiButton>
            <UiButton type="submit" disabled={savingBodega}>{savingBodega ? "Guardando..." : "Crear bodega"}</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal crear asset ── */}
      <Modal open={assetCreateOpen} onClose={() => { if (!savingAsset) setAssetCreateOpen(false); }} title="Agregar asset">
        <form onSubmit={handleCreateAsset}>
          {assetModalMsg ? <p style={errorBannerStyle}>{assetModalMsg}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <AppFormField label="Tipo de asset" required>
              <AppSelect value={assetType} onChange={(e) => setAssetType(e.target.value)}>
                {BUILDING_ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </AppSelect>
            </AppFormField>
            <AppFormField label="Estatus" required>
              <AppSelect value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)}>
                {ASSET_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </AppSelect>
            </AppFormField>
          </div>
          <AppFormField label="Nombre / descripción" required>
            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Ej. Elevador principal" style={INPUT_STYLE} />
          </AppFormField>
          <AppFormField label="Notas">
            <textarea value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} placeholder="Modelo, número de serie, observaciones…" style={TEXTAREA_STYLE} />
          </AppFormField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setAssetCreateOpen(false)} disabled={savingAsset}>Cancelar</UiButton>
            <UiButton type="submit" variant="primary" disabled={savingAsset}>{savingAsset ? "Guardando..." : "Crear asset"}</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal editar asset ── */}
      <Modal open={assetEditOpen} onClose={() => { if (!savingAsset) setAssetEditOpen(false); }} title="Editar asset">
        <form onSubmit={handleEditAsset}>
          {assetModalMsg ? <p style={errorBannerStyle}>{assetModalMsg}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <AppFormField label="Tipo de asset" required>
              <AppSelect value={assetType} onChange={(e) => setAssetType(e.target.value)}>
                {BUILDING_ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </AppSelect>
            </AppFormField>
            <AppFormField label="Estatus" required>
              <AppSelect value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)}>
                {ASSET_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </AppSelect>
            </AppFormField>
          </div>
          <AppFormField label="Nombre / descripción" required>
            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Ej. Elevador principal" style={INPUT_STYLE} />
          </AppFormField>
          <AppFormField label="Notas">
            <textarea value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} placeholder="Modelo, número de serie, observaciones…" style={TEXTAREA_STYLE} />
          </AppFormField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setAssetEditOpen(false)} disabled={savingAsset}>Cancelar</UiButton>
            <UiButton type="submit" variant="primary" disabled={savingAsset}>{savingAsset ? "Guardando..." : "Guardar cambios"}</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal eliminar asset ── */}
      <DeleteConfirmModal
        open={assetArchiveOpen}
        title="Eliminar asset"
        description={selectedAsset ? `¿Eliminar "${selectedAsset.name}"? El registro se ocultará pero se conserva en la base de datos.` : "¿Eliminar este asset?"}
        confirmText={savingAsset ? "Eliminando..." : "Eliminar asset"}
        onConfirm={() => void handleArchiveAsset()}
        onCancel={() => { if (!savingAsset) setAssetArchiveOpen(false); }}
      />

      {/* ── Modal eliminar edificio ── */}
      <DeleteConfirmModal
        open={isDeleteModalOpen}
        title="Eliminar edificio"
        description={building ? `¿Eliminar ${building.name}? Esta acción lo ocultará del sistema pero conservará toda su información.` : "¿Eliminar este edificio?"}
        confirmText={deletingBuilding ? "Eliminando..." : "Eliminar edificio"}
        onConfirm={() => void handleDeleteBuilding()}
        onCancel={() => { if (!deletingBuilding) setIsDeleteModalOpen(false); }}
      />

      {/* ── Modal agregar cajón ── */}
      <Modal open={createSpotOpen} onClose={() => { if (!savingSpot) setCreateSpotOpen(false); }} title="Agregar cajón">
        {spotMsg ? <p style={errorBannerStyle}>{spotMsg}</p> : null}
        <AppFormField label="Número de cajón" required>
          <input
            type="number" min="1" value={newSpotNumber}
            onChange={e => setNewSpotNumber(e.target.value)}
            placeholder="Ej. 1" style={INPUT_STYLE}
          />
        </AppFormField>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={() => setCreateSpotOpen(false)} disabled={savingSpot}>Cancelar</UiButton>
          <UiButton type="button" variant="primary" onClick={() => void handleCreateSpot()} disabled={savingSpot || !newSpotNumber}>
            {savingSpot ? "Guardando..." : "Agregar"}
          </UiButton>
        </div>
      </Modal>

      {/* ── Modal asignar cajón ── */}
      <Modal
        open={assignSpot !== null}
        onClose={() => { if (!savingAssign) setAssignSpot(null); }}
        title={`Asignar Cajón #${assignSpot?.spot_number ?? ""}`}
      >
        {assignMsg ? <p style={errorBannerStyle}>{assignMsg}</p> : null}
        <AppFormField label="Contrato / Inquilino" required>
          <AppSelect value={assignLeaseId} onChange={e => setAssignLeaseId(e.target.value)}>
            <option value="">Selecciona un contrato...</option>
            {sortByNatural(parkingLeases, l => l.unit_number).map(l => (
              <option key={l.id} value={l.id}>
                {l.tenant_name ?? "Sin nombre"}{l.unit_number ? ` — Depa ${l.unit_number}` : ""}
              </option>
            ))}
          </AppSelect>
        </AppFormField>
        <AppFormField label="Cuota mensual (0 si va incluido en renta)">
          <input
            type="number" min="0" value={assignFee}
            onChange={e => setAssignFee(e.target.value)}
            placeholder="0" style={INPUT_STYLE}
          />
        </AppFormField>
        <AppFormField label="Notas">
          <input
            value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
            placeholder="Notas opcionales" style={INPUT_STYLE}
          />
        </AppFormField>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={() => setAssignSpot(null)} disabled={savingAssign}>Cancelar</UiButton>
          <UiButton type="button" variant="primary" onClick={() => void handleAssignSpot()} disabled={savingAssign || !assignLeaseId}>
            {savingAssign ? "Asignando..." : "Asignar cajón"}
          </UiButton>
        </div>
      </Modal>

      {/* ── Modal liberar cajón ── */}
      <DeleteConfirmModal
        open={releaseSpot !== null}
        title={`Liberar Cajón #${releaseSpot?.spot_number ?? ""}`}
        description={`¿Liberar este cajón? Se quitará la asignación actual${releaseSpot?.monthly_fee && releaseSpot.monthly_fee > 0 ? " y se archivará el cobro de estacionamiento." : "."}`}
        confirmText={savingRelease ? "Liberando..." : "Liberar cajón"}
        onConfirm={() => void handleReleaseSpot()}
        onCancel={() => { if (!savingRelease) setReleaseSpot(null); }}
      />
    </PageContainer>
  );
}
