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
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  Ban,
  Copy,
  Briefcase,
  AlertCircle,
  Building2,
  Car,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  CreditCard,
  Droplets,
  Edit3,
  Factory,
  Flame,
  FileClockIcon,
  FileImage,
  FileText,
  FolderOpen,
  Bed,
  Gem,
  Home,
  Minus,
  ImageIcon,
  LayoutGrid,
  Layers3,
  MapPin,
  Monitor,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Ruler,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  SkipForward,
  Sliders,
  Sparkles,
  Store,
  Tags,
  Trash2,
  Trees,
  Truck,
  Warehouse,
  Wifi,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
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
import { getPropertyType, getPropertyLabels, buildingOf, getSubtypeLabel, PROPERTY_TYPES, COMMERCIAL_SUBTYPES, INDUSTRIAL_SUBTYPES } from "@/lib/property-types";
import { PROPERTY_FEATURES, getDefaultFeatures, getFeatureByKey } from "@/lib/property-features";
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
import EntityCard from "@/components/EntityCard";
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
  Building2, Home, Store, Warehouse, Factory, MapPin,
};

const FEATURE_ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  LayoutGrid, Car, Shield, Briefcase, Truck, Trees, Package, Settings,
  Zap, Droplets, Flame, Wifi, ShieldCheck, Sparkles, Wrench, CheckSquare,
};

const SUBTYPE_ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  Store, Briefcase, Building2, Monitor, Warehouse, Package, Factory,
};

const PROPERTY_TYPE_VALUES: string[] = PROPERTY_TYPES.map((pt) => pt.value);

const HOUSE_AMENITIES: { key: string; label: string }[] = [
  { key: "has_living_room",      label: "Sala"              },
  { key: "has_dining_room",      label: "Comedor"           },
  { key: "has_integral_kitchen", label: "Cocina integral"   },
  { key: "has_garden",           label: "Jardín/Patio"      },
  { key: "has_roof_garden",      label: "Roof garden"       },
  { key: "has_storage",          label: "Bodega"            },
  { key: "has_service_room",     label: "Cuarto de servicio"},
  { key: "has_service_bathroom", label: "Baño de servicio"  },
  { key: "has_pool",             label: "Alberca"           },
  { key: "has_cistern",          label: "Cisterna"          },
  { key: "has_security",         label: "Vigilancia"        },
  { key: "has_electric_gate",    label: "Portón eléctrico"  },
];

/* ─── Tipos ─────────────────────────────────────────────────────────── */

type Building = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  code: string | null;
  building_category: string | null;
  building_subcategory: string | null;
  building_subtype: string | null;
  latitude: number | null;
  longitude: number | null;
  land_sqm: number | null;
  construction_sqm: number | null;
  default_unit_sqm: number | null;
  building_tags: string[] | null;
  building_features: Record<string, unknown> | null;
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

type PlazaLocal = {
  id: string;
  unit_number: string;
  display_code: string | null;
  sqm: number | null;
  status: string;
  needs_review: boolean | null;
};

type FeatureConfigRow = {
  id: string;
  feature_key: string;
  is_active: boolean;
};

type BuildingArea = {
  id: string;
  area_type: string;
  area_label: string | null;
  sqm: number | null;
  notes: string | null;
};

type SetupTask = {
  id: string;
  task_key: string;
  feature_key: string;
  is_completed: boolean;
  dismissed: boolean;
};

type BuildingSchedule = {
  id: string;
  cleaning_type: string;
  day_of_week: string;
  time_block: string;
};

type CleaningLog = {
  id: string;
  cleaning_type: string;
  scheduled_date: string;
  status: string;
  completed_at: string | null;
};

type MaintenanceTicket = {
  id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
  performed_at: string | null;
};

type PreventivePlan = {
  id: string;
  next_due_date: string;
  interval_months: number;
  assets: { name: string; asset_type: string }[] | null;
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
  sqm: number | null;
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

const AREA_TYPE_LABELS: Record<string, string> = {
  locales:         "Locales comerciales",
  circulacion:     "Circulación",
  estacionamiento: "Estacionamiento",
  servicios:       "Área de servicios",
  area_verde:      "Área verde",
  naves:           "Naves / Bodegas",
  patios_maniobra: "Patios de maniobra",
  calles:          "Calles internas",
  construccion:    "Construcción",
  otro:            "Otro",
};

const AREA_TYPE_COLORS: Record<string, string> = {
  locales:         "#8B2252",
  estacionamiento: "#3B82F6",
  circulacion:     "#9CA3AF",
  area_verde:      "#10B981",
  servicios:       "#F59E0B",
  naves:           "#6366F1",
  patios_maniobra: "#64748B",
  calles:          "#94A3B8",
  construccion:    "#78716C",
  otro:            "#6B7280",
};

function getAreaTypesForCategory(cat: string | null): string[] {
  if (cat === "commercial") return ["locales", "circulacion", "estacionamiento", "servicios", "area_verde", "otro"];
  if (cat === "industrial" || cat === "industrial_park") return ["naves", "patios_maniobra", "calles", "area_verde", "servicios", "estacionamiento", "otro"];
  if (cat === "land") return ["construccion", "area_verde", "circulacion", "otro"];
  return ["otro"];
}

function getAreaTypeLabel(type: string, customLabel: string | null): string {
  if (type === "otro" && customLabel) return customLabel;
  return AREA_TYPE_LABELS[type] ?? type;
}

const DAY_LABELS_MAP: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié',
  thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
};

const CLEANING_TYPE_LABEL: Record<string, string> = {
  common_area:   'Áreas comunes',
  exterior:      'Exterior',
  unit_interior: 'Interior de unidad',
};

const MAINT_PRIORITY_ICON: Record<string, string> = {
  urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪',
};

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

function daysAgo(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
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

/* ─── Indicador de estado: círculo sólido con ícono ─────────────────── */

function getStatusIndicator(status: string) {
  switch ((status ?? "").toUpperCase()) {
    case "OCCUPIED":
    case "RENTED":
      return { bg: "#1D9E75", icon: "Check" };
    case "VACANT":
      return { bg: "#378ADD", icon: "Home" };
    case "PARTIAL":
      return { bg: "#EF9F27", icon: "Clock" };
    case "MAINTENANCE":
    case "OUT_OF_SERVICE":
      return { bg: "#E24B4A", icon: "Ban" };
    default:
      return { bg: "#888780", icon: "Minus" };
  }
}

function StatusCircle({ status }: { status: string }) {
  const ind = getStatusIndicator(status);
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: ind.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {ind.icon === "Check" && <Check size={15} color="white" strokeWidth={3} />}
      {ind.icon === "Home"  && <Home  size={15} color="white" strokeWidth={2} />}
      {ind.icon === "Clock" && <Clock size={15} color="white" strokeWidth={2} />}
      {ind.icon === "Ban"   && <Ban   size={15} color="white" strokeWidth={2} />}
      {ind.icon === "Minus" && <Minus size={15} color="white" strokeWidth={3} />}
    </div>
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

/* ─── Mapa task_key → tab para bolitas de setup pendiente ────────────── */

const TASK_TAB_MAP: Record<string, string> = {
  add_electricity_meter:  'services',
  add_water_meter:        'services',
  add_gas_meter:          'services',
  setup_internet:         'services',
  setup_cleaning_schedule:'services',
  add_parking_spots:      'parking',
  setup_common_areas:     'common_areas',
  setup_admin_office:     'assets',
  setup_security_booth:   'assets',
  setup_service_storage:  'assets',
  add_first_asset:        'assets',
  upload_documents:       'documents',
  add_photos:             'gallery',
  add_first_lease:        'leases',
  add_first_unit:         'overview',
  setup_security_service: 'overview',
  setup_loading_dock:     'assets',
}

/* ─── Mapa task_key → label y ruta (derivado de PROPERTY_FEATURES) ─────── */

const TASK_META: Record<string, { label: string; route?: string }> = {}
for (const feat of PROPERTY_FEATURES) {
  for (const task of feat.tasks) {
    TASK_META[task.key] = { label: task.label, route: task.route }
  }
}

/* ─── Banner de tareas pendientes por tab ────────────────────────────── */

type SetupTaskLike = { id: string; task_key: string; feature_key: string; is_completed: boolean; dismissed: boolean }

function TabPendingBanner({
  tasks,
  buildingId,
  onNavigate,
  onDismiss,
}: {
  tasks: SetupTaskLike[];
  buildingId: string;
  onNavigate: (route: string) => void;
  onDismiss: (ids: string[]) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div style={{
      background: 'rgba(139, 34, 82, 0.05)',
      borderLeft: '3px solid var(--brand-color, #8B2252)',
      borderRadius: 'var(--border-radius-md, 8px)',
      padding: '10px 14px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tasks.length > 0 ? 6 : 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-color, #8B2252)', fontSize: 13, fontWeight: 600 }}>
          <Settings size={13} />
          Pendiente en este módulo
        </span>
        <button
          type="button"
          onClick={() => onDismiss(tasks.map(t => t.id))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <X size={14} />
        </button>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tasks.map(task => {
          const meta = TASK_META[task.task_key];
          const label = meta?.label ?? task.task_key;
          const rawRoute = meta?.route;
          const resolvedRoute = rawRoute?.replace('[id]', buildingId);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => { if (resolvedRoute) onNavigate(resolvedRoute); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: resolvedRoute ? 'pointer' : 'default',
                  padding: '3px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ color: 'var(--brand-color, #8B2252)', fontSize: 9, lineHeight: 1 }}>●</span>
                <span style={{ flex: 1 }}>{label}</span>
                {resolvedRoute && <ChevronRight size={12} color="var(--text-muted)" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────── */

export default function BuildingDetailPage() {
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const buildingId   = params.buildingId as string;
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
  const [activeTab, setActiveTab]             = useState(searchParams.get("tab") ?? "overview");
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
  /* Áreas de unidades industriales — para cálculo automático en tab Superficies */
  const [buildingUnitAreas, setBuildingUnitAreas] = useState<Array<{ area_type: string; sqm: number | null }>>([]);

  /* Servicios activos (para card en Resumen) */
  const [utilityMeters, setUtilityMeters] = useState<UtilityMeterForOverview[]>([]);

  /* Counts de tabs (cargados al inicio para evitar mostrar 0) */
  const [tabCounts, setTabCounts] = useState({ assets: 0, docs: 0, gallery: 0, services: 0, parking: 0 });

  /* Contratos directos del edificio (land, commercial, industrial) */
  const [landLeases, setLandLeases] = useState<LandLease[]>([]);

  /* Bodegas hijas (industrial_park) */
  const [childBuildings, setChildBuildings]   = useState<ChildBuilding[]>([]);
  /* Locales como units (plaza_comercial) */
  const [plazaLocales, setPlazaLocales]       = useState<PlazaLocal[]>([]);
  const [unitsNeedingReview, setUnitsNeedingReview] = useState(0);
  const [commonAreas, setCommonAreas]         = useState<{ id: string; name: string }[]>([]);
  const [addingCommonArea, setAddingCommonArea] = useState(false);
  const [newCommonAreaName, setNewCommonAreaName] = useState("");
  const [savingCommonArea, setSavingCommonArea]   = useState(false);
  const [isCreateBodegaOpen, setIsCreateBodegaOpen] = useState(false);
  const [savingBodega, setSavingBodega] = useState(false);
  const [bodegaName, setBodegaName] = useState("");
  const [bodegaCode, setBodegaCode] = useState("");
  const [bodegaConstructionSqm, setBodegaConstructionSqm] = useState("");
  const [bodegaPatioSqm, setBodegaPatioSqm] = useState("");    // bodega: patio de maniobras m²
  const [bodegaRampas, setBodegaRampas] = useState("");        // bodega: número de rampas
  const [bodegaMsg, setBodegaMsg] = useState("");

  /* Acciones en locales de plaza_comercial */
  const [openActionsLocalId, setOpenActionsLocalId] = useState<string | null>(null);
  /* Acciones en bodegas de industrial_park */
  const [openActionsBodegaId, setOpenActionsBodegaId] = useState<string | null>(null);
  const [bodegaOccupied, setBodegaOccupied] = useState<Set<string>>(new Set());
  const [bodegasOccupiedLoaded, setBodegasOccupiedLoaded] = useState(false);
  const [editingLocal, setEditingLocal]             = useState<PlazaLocal | null>(null);
  const [editLocalName, setEditLocalName]           = useState("");
  const [editLocalCode, setEditLocalCode]           = useState("");
  const [editLocalSqm, setEditLocalSqm]             = useState("");
  const [editLocalMsg, setEditLocalMsg]             = useState("");
  const [savingLocal, setSavingLocal]               = useState(false);
  const [deletingLocal, setDeletingLocal]           = useState<PlazaLocal | null>(null);
  const [confirmingDeleteLocal, setConfirmingDeleteLocal] = useState(false);
  const [duplicatingLocal, setDuplicatingLocal]     = useState<PlazaLocal | null>(null);
  const [dupLocalCount, setDupLocalCount]           = useState(1);
  const [dupLocalSaving, setDupLocalSaving]         = useState(false);

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

  /* Features configurables */
  const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfigRow[]>([]);
  const [savingFeatureKey, setSavingFeatureKey] = useState<string | null>(null);
  const [featureStatus, setFeatureStatus]         = useState<Record<string, "ok" | "pending" | "unchecked">>({});
  const [featureToast, setFeatureToast]           = useState<string | null>(null);
  const [featureWarnToast, setFeatureWarnToast]   = useState<string | null>(null);
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0);
  const [activeFeatureKeys, setActiveFeatureKeys] = useState<Set<string>>(new Set());

  /* Servicios: limpieza y mantenimiento (lazy) */
  const [servicesTabLoaded, setServicesTabLoaded] = useState(false);
  const [buildingSchedules, setBuildingSchedules] = useState<BuildingSchedule[]>([]);
  const [recentCleaningLogs, setRecentCleaningLogs] = useState<CleaningLog[]>([]);
  const [openTickets, setOpenTickets] = useState<MaintenanceTicket[]>([]);
  const [upcomingPreventives, setUpcomingPreventives] = useState<PreventivePlan[]>([]);
  /* Modales: agregar horario de limpieza */
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addScheduleType, setAddScheduleType] = useState('common_area');
  const [addScheduleDays, setAddScheduleDays] = useState<string[]>([]);
  const [addScheduleBlock, setAddScheduleBlock] = useState('morning');
  const [savingSchedule, setSavingSchedule] = useState(false);
  /* Modales: nuevo ticket de mantenimiento */
  const [addTicketOpen, setAddTicketOpen] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState('medium');
  const [savingTicket, setSavingTicket] = useState(false);

  /* Setup checklist */
  const [setupTasks, setSetupTasks] = useState<SetupTask[]>([]);

  /* Áreas de superficie */
  const [buildingAreas, setBuildingAreas] = useState<BuildingArea[]>([]);
  const [areaCreateOpen, setAreaCreateOpen] = useState(false);
  const [newAreaType, setNewAreaType] = useState("");
  const [newAreaLabel, setNewAreaLabel] = useState("");
  const [newAreaSqm, setNewAreaSqm] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [areaMsg, setAreaMsg] = useState("");

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
  const [editLandSqm, setEditLandSqm]                 = useState("");
  const [editConstructionSqm, setEditConstructionSqm] = useState("");
  const [editDefaultUnitSqm, setEditDefaultUnitSqm]   = useState("");
  const [editHouseFeatures, setEditHouseFeatures]     = useState<Record<string, unknown>>({});
  const [editSubtype, setEditSubtype]                 = useState<string>("");
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

  useEffect(() => {
    if (activeTab === 'services' && building && !servicesTabLoaded) {
      void loadServicesTabData();
      setServicesTabLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, building, servicesTabLoaded]);

  useEffect(() => {
    if (activeTab !== 'bodegas' || bodegasOccupiedLoaded || childBuildings.length === 0) return;
    const ids = childBuildings.map(cb => cb.id);
    void (async () => {
      const { data } = await supabase
        .from('leases')
        .select('building_id')
        .in('building_id', ids)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);
      setBodegaOccupied(new Set((data ?? []).map((r: { building_id: string }) => r.building_id)));
      setBodegasOccupiedLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, childBuildings, bodegasOccupiedLoaded]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    router.replace(`/buildings/${buildingId}?tab=${tab}`, { scroll: false });
  }

  useEffect(() => {
    if (!createSpotOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!savingSpot && newSpotNumber) void handleCreateSpot();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSpotOpen, savingSpot, newSpotNumber]);

  useEffect(() => {
    if (!areaCreateOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!savingArea) void handleCreateArea();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCreateOpen, savingArea, newAreaType, newAreaLabel, newAreaSqm]);

  /* ── Carga de datos ──────────────────────────────────────────────── */

  async function loadBuilding() {
    if (!user?.company_id || !buildingId) return;
    setLoadingBuilding(true);
    setMsg("");

    const { data, error } = await supabase
      .from("buildings")
      .select("id, company_id, name, address, code, building_category, building_subcategory, building_subtype, latitude, longitude, land_sqm, construction_sqm, default_unit_sqm, building_tags, building_features, parent_building_id")
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

    /* Contratos directos del edificio (land, commercial, industrial, residential_single) — unit_id IS NULL */
    if (["land", "commercial", "industrial", "residential_single"].includes(b.building_category ?? "")) {
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

    /* Bodegas hijas (industrial_park) + Áreas comunes + Locales (plaza_comercial) */
    const [cbResult, caResult, localesResult, areasResult] = await Promise.all([
      b.building_category === "industrial_park"
        ? supabase.from("buildings")
            .select("id, name, code, building_category, building_subtype, total_sqm, land_sqm, construction_sqm")
            .eq("parent_building_id", buildingId)
            .eq("company_id", user.company_id)
            .is("deleted_at", null)
            .order("name")
        : Promise.resolve({ data: [] }),
      supabase.from("common_areas")
        .select("id, name")
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("created_at"),
      b.building_subtype === "plaza_comercial"
        ? supabase.from("units")
            .select("id, unit_number, display_code, sqm, status, needs_review")
            .eq("building_id", buildingId)
            .is("deleted_at", null)
            .order("unit_number")
        : Promise.resolve({ data: [] }),
      supabase
        .from("building_areas")
        .select("id, area_type, area_label, sqm, notes")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);
    setChildBuildings((cbResult.data || []) as ChildBuilding[]);
    setCommonAreas((caResult.data || []) as { id: string; name: string }[]);
    setPlazaLocales((localesResult.data || []) as PlazaLocal[]);
    setBuildingAreas((areasResult.data || []) as BuildingArea[]);

    // Unidades del edificio para BuildingServicesTab + servicios para Resumen
    const [{ data: allUnits }, { data: utilMetersData }, { count: needsReviewCount }] = await Promise.all([
      supabase
        .from("units")
        .select("id, unit_number, display_code, sqm")
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("unit_number"),
      supabase
        .from("building_utility_meters")
        .select("id, service_type, meter_type, billing_mode, contract_holder")
        .eq("building_id", buildingId)
        .eq("active", true)
        .is("deleted_at", null),
      supabase
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("building_id", buildingId)
        .eq("needs_review", true)
        .is("deleted_at", null),
    ]);
    setBuildingUnits((allUnits || []) as UnitRow[]);
    setUtilityMeters((utilMetersData || []) as UtilityMeterForOverview[]);
    setUnitsNeedingReview(needsReviewCount ?? 0);

    /* unit_areas por unidad — solo para edificios industriales (áreas automáticas en tab Superficies) */
    if (b.building_category === "industrial") {
      const uIds = ((allUnits || []) as UnitRow[]).map((u) => u.id);
      if (uIds.length > 0) {
        const { data: uaData } = await supabase
          .from("unit_areas")
          .select("area_type, sqm")
          .in("unit_id", uIds)
          .is("deleted_at", null);
        setBuildingUnitAreas((uaData || []) as Array<{ area_type: string; sqm: number | null }>);
      } else {
        setBuildingUnitAreas([]);
      }
    } else {
      setBuildingUnitAreas([]);
    }

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

    /* Setup tasks — todas las no descartadas (pendientes + completadas) */
    const [{ data: tasksData }, { data: featConfigData }] = await Promise.all([
      supabase
        .from("building_setup_tasks")
        .select("id, task_key, feature_key, is_completed, dismissed")
        .eq("building_id", buildingId)
        .eq("dismissed", false)
        .order("is_completed", { ascending: true }),
      supabase
        .from("building_feature_config")
        .select("feature_key, is_active")
        .eq("building_id", buildingId)
        .is("deleted_at", null),
    ]);
    setActiveFeatureKeys(new Set(
      ((featConfigData || []) as Array<{ feature_key: string; is_active: boolean }>)
        .filter((f) => f.is_active)
        .map((f) => f.feature_key)
    ));

    const tasks = (tasksData || []) as SetupTask[];

    /* Auto-completar tareas del checklist según datos existentes */
    const [
      parkingCount,
      electricityCount,
      waterCount,
      gasCount,
      internetCount,
      cleaningCount,
      leasesCount,
      documentsCount,
      assetsCount,
    ] = await Promise.all([
      supabase.from('parking_spots').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).is('deleted_at', null),
      supabase.from('building_utility_meters').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).eq('service_type', 'electricity').is('deleted_at', null),
      supabase.from('building_utility_meters').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).eq('service_type', 'water').is('deleted_at', null),
      supabase.from('building_utility_meters').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).eq('service_type', 'gas').is('deleted_at', null),
      supabase.from('building_utility_meters').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).eq('service_type', 'internet').is('deleted_at', null),
      supabase.from('cleaning_building_schedules').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).is('deleted_at', null),
      supabase.from('leases').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).is('deleted_at', null),
      supabase.from('building_files').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).is('deleted_at', null),
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('building_id', buildingId).is('deleted_at', null),
    ]);

    const autoCompleteMap = [
      { key: 'add_first_unit',          done: (allUnits?.length           ?? 0) > 0 },
      { key: 'add_first_lease',         done: (leasesCount.count          ?? 0) > 0 },
      { key: 'add_parking_spots',       done: (parkingCount.count         ?? 0) > 0 },
      { key: 'add_electricity_meter',   done: (electricityCount.count     ?? 0) > 0 },
      { key: 'add_water_meter',         done: (waterCount.count           ?? 0) > 0 },
      { key: 'add_gas_meter',           done: (gasCount.count             ?? 0) > 0 },
      { key: 'setup_internet',          done: (internetCount.count        ?? 0) > 0 },
      { key: 'setup_cleaning_schedule', done: (cleaningCount.count        ?? 0) > 0 },
      { key: 'upload_documents',        done: (documentsCount.count       ?? 0) > 0 },
      { key: 'add_first_asset',         done: (assetsCount.count          ?? 0) > 0 },
      { key: 'setup_common_areas',      done: (commonAreas?.length        ?? 0) > 0 },
      { key: 'setup_admin_office',      done: false },
      { key: 'setup_security_booth',    done: false },
      { key: 'setup_service_storage',   done: false },
      { key: 'setup_security_service',  done: false },
    ];

    const keysToComplete = tasks
      .filter(task => !task.is_completed && autoCompleteMap.some(m => m.key === task.task_key && m.done))
      .map(task => task.task_key);

    if (keysToComplete.length > 0) {
      await supabase.from('building_setup_tasks')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('building_id', buildingId)
        .in('task_key', keysToComplete);
      for (const task of tasks) {
        if (keysToComplete.includes(task.task_key)) task.is_completed = true;
      }
    }

    setSetupTasks(tasks.sort((a, b) => Number(a.is_completed) - Number(b.is_completed)));

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

  /* ── Servicios: limpieza y mantenimiento ──────────────────────── */

  async function loadServicesTabData() {
    if (!building) return;
    const today = new Date().toISOString().split('T')[0];
    const [
      { data: schedulesData },
      { data: logsData },
      { data: ticketsData },
      { data: preventivesData },
    ] = await Promise.all([
      supabase
        .from('cleaning_building_schedules')
        .select('id, cleaning_type, day_of_week, time_block')
        .eq('building_id', building.id)
        .is('deleted_at', null)
        .order('day_of_week'),
      supabase
        .from('cleaning_logs')
        .select('id, cleaning_type, scheduled_date, status, completed_at')
        .eq('building_id', building.id)
        .is('deleted_at', null)
        .order('scheduled_date', { ascending: false })
        .limit(5),
      supabase
        .from('maintenance_logs')
        .select('id, title, priority, status, created_at, performed_at')
        .eq('building_id', building.id)
        .eq('company_id', building.company_id)
        .not('status', 'eq', 'DONE')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('preventive_plans')
        .select('id, next_due_date, interval_months, assets(name, asset_type)')
        .eq('company_id', building.company_id)
        .gte('next_due_date', today)
        .order('next_due_date')
        .limit(3),
    ]);
    setBuildingSchedules((schedulesData || []) as BuildingSchedule[]);
    setRecentCleaningLogs((logsData || []) as CleaningLog[]);
    setOpenTickets((ticketsData || []) as MaintenanceTicket[]);
    setUpcomingPreventives((preventivesData || []) as PreventivePlan[]);
  }

  async function handleAddSchedule() {
    if (!building || addScheduleDays.length === 0) return;
    setSavingSchedule(true);
    await Promise.all(
      addScheduleDays.map(day =>
        supabase.from('cleaning_building_schedules').insert({
          building_id: building.id,
          company_id: building.company_id,
          cleaning_type: addScheduleType,
          day_of_week: day,
          time_block: addScheduleBlock,
        })
      )
    );
    setAddScheduleOpen(false);
    setAddScheduleDays([]);
    setAddScheduleType('common_area');
    setAddScheduleBlock('morning');
    setSavingSchedule(false);
    const { data } = await supabase
      .from('cleaning_building_schedules')
      .select('id, cleaning_type, day_of_week, time_block')
      .eq('building_id', building.id)
      .is('deleted_at', null)
      .order('day_of_week');
    setBuildingSchedules((data || []) as BuildingSchedule[]);
  }

  async function handleDeleteSchedule(scheduleId: string) {
    await supabase.from('cleaning_building_schedules')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', scheduleId);
    setBuildingSchedules(prev => prev.filter(s => s.id !== scheduleId));
  }

  async function handleAddTicket() {
    if (!building || !newTicketTitle.trim()) return;
    setSavingTicket(true);
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('maintenance_logs').insert({
      building_id: building.id,
      company_id: building.company_id,
      title: newTicketTitle.trim(),
      description: newTicketDesc.trim() || null,
      priority: newTicketPriority,
      status: 'OPEN',
      log_type: 'corrective',
      performed_at: today,
    });
    setAddTicketOpen(false);
    setNewTicketTitle('');
    setNewTicketDesc('');
    setNewTicketPriority('medium');
    setSavingTicket(false);
    const { data } = await supabase
      .from('maintenance_logs')
      .select('id, title, priority, status, created_at, performed_at')
      .eq('building_id', building.id)
      .eq('company_id', building.company_id)
      .not('status', 'eq', 'DONE')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);
    setOpenTickets((data || []) as MaintenanceTicket[]);
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
    setEditLandSqm(building.land_sqm != null ? String(building.land_sqm) : "");
    setEditConstructionSqm(building.construction_sqm != null ? String(building.construction_sqm) : "");
    setEditDefaultUnitSqm(building.default_unit_sqm != null ? String(building.default_unit_sqm) : "");
    setEditHouseFeatures(building.building_features ?? {});
    setEditSubtype(building.building_subtype ?? "");
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
        building_subtype: (buildingCategory === "commercial" || buildingCategory === "industrial") ? (editSubtype || null) : null,
        building_tags: editBuildingTags,
        building_features: Object.keys(editHouseFeatures).length ? editHouseFeatures : null,
        land_sqm: editLandSqm.trim() ? Number(editLandSqm) : null,
        construction_sqm: editConstructionSqm.trim() ? Number(editConstructionSqm) : null,
        default_unit_sqm: buildingCategory !== "land" && buildingCategory !== "residential_single" && editDefaultUnitSqm.trim() ? Number(editDefaultUnitSqm) : null,
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

  /* ── Features modal ─────────────────────────────────────────────── */

  async function openFeaturesModal() {
    if (!building) return;
    setIsFeaturesModalOpen(true);
    const [configRes, metersRes, parkingRes, cleaningRes, unitsRes] = await Promise.all([
      supabase.from("building_feature_config").select("id, feature_key, is_active").eq("building_id", building.id).is("deleted_at", null),
      supabase.from("building_utility_meters").select("id, service_type").eq("building_id", building.id).is("deleted_at", null),
      supabase.from("parking_spots").select("id").eq("building_id", building.id).is("deleted_at", null),
      supabase.from("cleaning_building_schedules").select("id").eq("building_id", building.id).is("deleted_at", null),
      supabase.from("units").select("id").eq("building_id", building.id).is("deleted_at", null),
    ]);
    const existingConfigs = (configRes.data || []) as FeatureConfigRow[];
    const meters = metersRes.data ?? [];

    const newStatus: Record<string, "ok" | "pending" | "unchecked"> = {
      units:           (unitsRes.data?.length   ?? 0) > 0 ? "ok" : "pending",
      parking:         (parkingRes.data?.length  ?? 0) > 0 ? "ok" : "pending",
      cleaning:        (cleaningRes.data?.length ?? 0) > 0 ? "ok" : "pending",
      electricity:     meters.some((m) => m.service_type === "electricity") ? "ok" : "pending",
      water:           meters.some((m) => m.service_type === "water")       ? "ok" : "pending",
      gas:             meters.some((m) => m.service_type === "gas")         ? "ok" : "pending",
      internet:        meters.some((m) => m.service_type === "internet")    ? "ok" : "pending",
      security_booth:  "unchecked",
      admin_office:    "unchecked",
      loading_dock:    "unchecked",
      common_areas:    "unchecked",
      service_storage: "unchecked",
      security_service:"unchecked",
      maintenance:     "unchecked",
    };
    setFeatureStatus(newStatus);

    // Auto-activate features that already have real data in DB
    const autoActivateKeys = (["units", "parking", "cleaning", "electricity", "water", "gas", "internet"] as const)
      .filter((key) => newStatus[key] === "ok");

    if (autoActivateKeys.length > 0 && user?.company_id) {
      const upsertRows = autoActivateKeys.map((key) => {
        const feat = PROPERTY_FEATURES.find((f) => f.key === key);
        return {
          building_id:      building.id,
          company_id:       user.company_id,
          feature_key:      key,
          feature_category: feat?.category ?? "service",
          is_active:        true,
        };
      });
      await supabase.from("building_feature_config").upsert(upsertRows, { onConflict: "building_id,feature_key" });
    }

    // Reload configs after potential auto-activation
    const { data: refreshed } = await supabase
      .from("building_feature_config")
      .select("id, feature_key, is_active")
      .eq("building_id", building.id)
      .is("deleted_at", null);
    setFeatureConfigs((refreshed || []) as FeatureConfigRow[]);
  }

  async function handleToggleFeature(featureKey: string) {
    if (!building || !user?.company_id) return;
    setSavingFeatureKey(featureKey);
    setFeatureWarnToast(null);

    const existing   = featureConfigs.find((c) => c.feature_key === featureKey);
    const nextActive = !(existing?.is_active ?? false);
    const feat       = PROPERTY_FEATURES.find((f) => f.key === featureKey);

    const METER_KEYS = ["electricity", "water", "gas", "internet"] as const;
    type MeterKey    = typeof METER_KEYS[number];
    const isMeterKey = (k: string): k is MeterKey => METER_KEYS.includes(k as MeterKey);

    // ── Deactivation checks ───────────────────────────────────────────
    if (!nextActive) {
      const now = new Date().toISOString();

      if (isMeterKey(featureKey)) {
        const { data: meters } = await supabase
          .from("building_utility_meters")
          .select("id, active")
          .eq("building_id", building.id)
          .eq("service_type", featureKey)
          .is("deleted_at", null);

        const realMeters   = (meters || []).filter((m) => m.active === true);
        const placeholders = (meters || []).filter((m) => m.active === false);

        if (realMeters.length > 0) {
          setFeatureWarnToast(`No puedes desactivar ${feat?.label ?? featureKey} porque ya tiene un medidor configurado. Elimínalo primero desde el tab Servicios.`);
          setTimeout(() => setFeatureWarnToast(null), 6000);
          setSavingFeatureKey(null);
          return;
        }

        await Promise.all(placeholders.map((ph) =>
          supabase.from("building_utility_meters").update({ deleted_at: now }).eq("id", ph.id)
        ));
        setServicesRefreshKey((prev) => prev + 1);

      } else if (featureKey === "parking") {
        const { data: spots } = await supabase
          .from("parking_spots")
          .select("id, tenant_id")
          .eq("building_id", building.id)
          .is("deleted_at", null);

        const realSpots = (spots || []).filter((s) => s.tenant_id != null);

        if (realSpots.length > 0) {
          setFeatureWarnToast(`No puedes desactivar ${feat?.label ?? featureKey} porque hay cajones con tenants asignados. Libéralos primero desde el tab Cajones.`);
          setTimeout(() => setFeatureWarnToast(null), 6000);
          setSavingFeatureKey(null);
          return;
        }

        await Promise.all((spots || []).map((s) =>
          supabase.from("parking_spots").update({ deleted_at: now }).eq("id", s.id)
        ));
        void loadParkingData();

      } else if (featureKey === "cleaning") {
        const { data: schedules } = await supabase
          .from("cleaning_building_schedules")
          .select("id")
          .eq("building_id", building.id)
          .is("deleted_at", null);

        if ((schedules || []).length > 1) {
          setFeatureWarnToast(`No puedes desactivar ${feat?.label ?? featureKey} porque ya tiene schedules configurados. Elimínalos primero desde el módulo de Limpieza.`);
          setTimeout(() => setFeatureWarnToast(null), 6000);
          setSavingFeatureKey(null);
          return;
        }

        await Promise.all((schedules || []).map((s) =>
          supabase.from("cleaning_building_schedules").update({ deleted_at: now }).eq("id", s.id)
        ));
      }

      setFeatureStatus((prev) => ({ ...prev, [featureKey]: "pending" }));
    }

    // ── Update feature_config ─────────────────────────────────────────
    if (existing) {
      await supabase.from("building_feature_config").update({ is_active: nextActive }).eq("id", existing.id);
    } else {
      await supabase.from("building_feature_config").insert({
        building_id:      building.id,
        company_id:       user.company_id,
        feature_key:      featureKey,
        feature_category: feat?.category ?? "service",
        is_active:        true,
      });
    }

    // ── Activation logic ──────────────────────────────────────────────
    if (nextActive) {
      if (feat && feat.tasks.length > 0) {
        const taskRows = feat.tasks
          .filter((task) => !task.applicableTypes || task.applicableTypes.includes(building.building_category ?? ""))
          .map((task) => ({
            building_id:  building.id,
            company_id:   user.company_id,
            task_key:     task.key,
            feature_key:  featureKey,
            is_completed: false,
          }));
        if (taskRows.length > 0) {
          await supabase.from("building_setup_tasks").upsert(taskRows, {
            onConflict: "building_id,task_key",
            ignoreDuplicates: true,
          });
        }
      }

      if (featureStatus[featureKey] === "pending") {
        if (isMeterKey(featureKey)) {
          await supabase.from("building_utility_meters").insert({
            building_id:       building.id,
            company_id:        user.company_id,
            service_type:      featureKey,
            meter_type:        "dedicated",
            provider_name:     "Pendiente de configurar",
            active:            false,
            contract_holder:   "company",
            billing_mode:      "charged",
            billing_frequency: "monthly",
            description:       "PLACEHOLDER — completar configuración",
          });
          setServicesRefreshKey((prev) => prev + 1);
        } else if (featureKey === "parking") {
          await supabase.from("parking_spots").insert({
            building_id: building.id,
            company_id:  user.company_id,
            spot_number: "1",
            status:      "vacant",
          });
          void loadParkingData();
        } else if (featureKey === "cleaning") {
          await supabase.from("cleaning_building_schedules").insert({
            building_id:   building.id,
            company_id:    user.company_id,
            cleaning_type: "common",
            day_of_week:   "monday",
            time_block:    "morning",
          });
        }

        setFeatureStatus((prev) => ({ ...prev, [featureKey]: "ok" }));
        setFeatureToast(`✓ ${feat?.label ?? featureKey} configurado — completa los detalles en el módulo correspondiente`);
        setTimeout(() => setFeatureToast(null), 4000);
      }
    }

    // ── Reload configs ────────────────────────────────────────────────
    const { data } = await supabase
      .from("building_feature_config")
      .select("id, feature_key, is_active")
      .eq("building_id", building.id)
      .is("deleted_at", null);
    setFeatureConfigs((data || []) as FeatureConfigRow[]);
    setActiveFeatureKeys(new Set(
      ((data || []) as Array<{ feature_key: string; is_active: boolean }>)
        .filter((f) => f.is_active)
        .map((f) => f.feature_key)
    ));
    setSavingFeatureKey(null);
  }

  /* ── Setup checklist ─────────────────────────────────────────────── */

  async function handleCompleteTask(taskId: string) {
    if (!user) return;
    await supabase.from("building_setup_tasks").update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    }).eq("id", taskId);
    setSetupTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, is_completed: true } : t)
        .sort((a, b) => Number(a.is_completed) - Number(b.is_completed))
    );
  }

  async function handleDismissAllTasks() {
    const ids = setupTasks.map((t) => t.id);
    if (ids.length === 0) return;
    await supabase.from("building_setup_tasks").update({ dismissed: true }).in("id", ids);
    setSetupTasks([]);
  }

  async function handleDismissBannerTasks(ids: string[]) {
    if (ids.length === 0) return;
    await supabase.from("building_setup_tasks").update({ dismissed: true }).in("id", ids);
    setSetupTasks(prev => prev.filter(t => !ids.includes(t.id)));
  }

  function handleBannerNavigate(route: string) {
    if (route === '/cleaning') {
      document.getElementById('services-cleaning-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (route.includes('?tab=')) {
      const tab = new URL(route, 'http://x').searchParams.get('tab');
      if (tab) setActiveTab(tab);
    } else {
      router.push(route);
    }
  }

  async function handleCreateBodega(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !building) return;
    if (!bodegaName.trim()) { setBodegaMsg("El nombre es obligatorio."); return; }
    setSavingBodega(true);
    setBodegaMsg("");

    let insertError: { message: string } | null = null;

    if (building.building_subtype === "plaza_comercial") {
      /* Plaza comercial: crear unit */
      const { error } = await supabase.from("units").insert({
        company_id:   user.company_id,
        building_id:  building.id,
        unit_number:  bodegaName.trim(),
        display_code: bodegaCode.trim() || null,
        sqm:          bodegaConstructionSqm.trim() ? Number(bodegaConstructionSqm) : null,
        status:       "VACANT",
      });
      insertError = error;
    } else {
      /* Parque industrial: crear building hijo */
      const localFeatures: Record<string, unknown> = {};
      if (bodegaPatioSqm.trim()) localFeatures.patio_sqm = Number(bodegaPatioSqm);
      if (bodegaRampas.trim())   localFeatures.rampas    = Number(bodegaRampas);
      const { error } = await supabase.from("buildings").insert({
        company_id:         user.company_id,
        name:               bodegaName.trim(),
        code:               bodegaCode.trim() || null,
        building_category:  "industrial",
        building_subtype:   "nave_industrial",
        parent_building_id: building.id,
        construction_sqm:   bodegaConstructionSqm.trim() ? Number(bodegaConstructionSqm) : null,
        building_features:  Object.keys(localFeatures).length ? localFeatures : null,
      });
      insertError = error;
    }

    setSavingBodega(false);
    if (insertError) { setBodegaMsg(`Error: ${insertError.message}`); return; }
    setIsCreateBodegaOpen(false);
    setBodegaName(""); setBodegaCode(""); setBodegaConstructionSqm(""); setBodegaPatioSqm(""); setBodegaRampas(""); setBodegaMsg("");
    await loadBuilding();
  }

  /* ── Acciones en locales de plaza_comercial ──────────────────── */

  function openEditLocal(local: PlazaLocal) {
    setEditingLocal(local);
    setEditLocalName(local.unit_number);
    setEditLocalCode(local.display_code ?? "");
    setEditLocalSqm(local.sqm != null ? String(local.sqm) : "");
    setEditLocalMsg("");
    setOpenActionsLocalId(null);
  }

  async function handleSaveLocal(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !editingLocal) return;
    if (!editLocalName.trim()) { setEditLocalMsg("El nombre es obligatorio."); return; }
    setSavingLocal(true);
    setEditLocalMsg("");
    const sqmVal = editLocalSqm.trim() ? parseFloat(editLocalSqm) : null;
    const { error } = await supabase.from("units").update({
      unit_number:  editLocalName.trim(),
      display_code: editLocalCode.trim() || null,
      sqm:          sqmVal !== null && !isNaN(sqmVal) ? sqmVal : null,
    }).eq("id", editingLocal.id).eq("company_id", user.company_id);
    setSavingLocal(false);
    if (error) { setEditLocalMsg(error.message); return; }
    setEditingLocal(null);
    await loadBuilding();
  }

  async function handleDuplicateLocal() {
    const local = duplicatingLocal;
    if (!user?.company_id || !building || !local) return;
    setDupLocalSaving(true);

    /* Patrones: unit_number para el nombre, display_code para el código */
    const nameMatch = local.unit_number.match(/^(.*?)(\d+)$/);
    const codeBase  = local.display_code ?? local.unit_number;
    const codeMatch = codeBase.match(/^(.*?)(\d+)$/);

    const existingNames = new Set(plazaLocales.map(l => l.unit_number.toLowerCase()));
    const existingCodes = new Set(plazaLocales.map(l => (l.display_code ?? "").toLowerCase()));

    /* Máximo actual por prefijo de nombre */
    let nameNext = 2, namePrefix = "", namePad = 1;
    if (nameMatch) {
      namePrefix = nameMatch[1]; namePad = nameMatch[2].length;
      const nums = plazaLocales
        .map(l => { const m = l.unit_number.match(/^(.*?)(\d+)$/); return m && m[1] === namePrefix ? parseInt(m[2], 10) : null; })
        .filter((n): n is number => n !== null);
      nameNext = (nums.length > 0 ? Math.max(...nums) : parseInt(nameMatch[2], 10)) + 1;
    }

    /* Máximo actual por prefijo de código */
    let codeNext = 2, codePrefix = "", codePad = 2, hasCodePattern = false;
    if (codeMatch) {
      hasCodePattern = true; codePrefix = codeMatch[1]; codePad = codeMatch[2].length;
      const nums = plazaLocales
        .map(l => { const m = (l.display_code ?? "").match(/^(.*?)(\d+)$/); return m && m[1] === codePrefix ? parseInt(m[2], 10) : null; })
        .filter((n): n is number => n !== null);
      codeNext = (nums.length > 0 ? Math.max(...nums) : parseInt(codeMatch[2], 10)) + 1;
    }

    let created = 0;
    for (let i = 0; i < dupLocalCount; i++) {
      /* unit_number */
      let newName: string;
      if (nameMatch) {
        let n = nameNext;
        let c = namePrefix + (namePad > 1 ? String(n).padStart(namePad, "0") : String(n));
        while (existingNames.has(c.toLowerCase())) { n++; c = namePrefix + (namePad > 1 ? String(n).padStart(namePad, "0") : String(n)); }
        newName = c; nameNext = n + 1;
      } else {
        let n = 2; let c = `${local.unit_number} ${n}`;
        while (existingNames.has(c.toLowerCase())) c = `${local.unit_number} ${++n}`;
        newName = c;
      }
      existingNames.add(newName.toLowerCase());

      /* display_code */
      let newCode: string | null = null;
      if (hasCodePattern) {
        let n = codeNext;
        let c = codePrefix + String(n).padStart(codePad, "0");
        while (existingCodes.has(c.toLowerCase())) { n++; c = codePrefix + String(n).padStart(codePad, "0"); }
        newCode = c; codeNext = n + 1;
        existingCodes.add(newCode.toLowerCase());
      }

      const { data: newLocal, error } = await supabase.from("units").insert({
        company_id:   user.company_id,
        building_id:  building.id,
        unit_number:  newName,
        display_code: newCode,
        sqm:          local.sqm,
        status:       "VACANT",
        needs_review: true,
      }).select("id").single();

      if (error || !newLocal) { toast.error(`Error en copia ${i + 1}: ${error?.message ?? "error"}`); break; }
      created++;

      const { data: amenities } = await supabase.from("unit_amenities")
        .select("amenity_key").eq("unit_id", local.id).is("deleted_at", null);
      if (amenities && amenities.length > 0) {
        await supabase.from("unit_amenities").insert(
          amenities.map((a: { amenity_key: string }) => ({ unit_id: newLocal.id, company_id: building.company_id, amenity_key: a.amenity_key }))
        );
      }
    }

    setDupLocalSaving(false);
    setDuplicatingLocal(null);
    setDupLocalCount(1);
    if (created > 0) {
      toast.success(`${created} ${created === 1 ? "copia creada" : "copias creadas"} — revisa los datos`);
      await loadBuilding();
    }
  }

  async function handleDeleteLocal() {
    if (!user?.company_id || !deletingLocal) return;
    setConfirmingDeleteLocal(true);
    const now = new Date().toISOString();
    await supabase.from("leases").update({ deleted_at: now, status: "ENDED" })
      .eq("unit_id", deletingLocal.id).eq("status", "ACTIVE").is("deleted_at", null);
    const { error } = await supabase.from("units").update({ deleted_at: now })
      .eq("id", deletingLocal.id).eq("company_id", user.company_id);
    setConfirmingDeleteLocal(false);
    if (error) { toast.error(error.message); return; }
    setDeletingLocal(null);
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

  async function handleCreateArea() {
    if (!user?.company_id || !building) return;
    if (!newAreaType) { setAreaMsg("Selecciona un tipo de área."); return; }
    const sqm = Number(newAreaSqm);
    if (!newAreaSqm.trim() || !Number.isFinite(sqm) || sqm <= 0) {
      setAreaMsg("Ingresa los m² (número mayor a cero).");
      return;
    }
    setSavingArea(true);
    setAreaMsg("");
    const { error } = await supabase.from("building_areas").insert({
      company_id: user.company_id,
      building_id: building.id,
      area_type: newAreaType,
      area_label: newAreaType === "otro" ? newAreaLabel.trim() || null : null,
      sqm,
      notes: null,
    });
    setSavingArea(false);
    if (error) { setAreaMsg(error.message); return; }
    setAreaCreateOpen(false);
    setNewAreaType("");
    setNewAreaLabel("");
    setNewAreaSqm("");
    await loadBuilding();
  }

  async function handleDeleteArea(areaId: string) {
    if (!user?.company_id) return;
    await supabase
      .from("building_areas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", areaId)
      .eq("company_id", user.company_id);
    await loadBuilding();
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  if (loading)        return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user)          return null;
  if (loadingBuilding) return <PageContainer>Cargando edificio...</PageContainer>;
  if (!building)      return <PageContainer>{msg || "No se encontró el edificio."}</PageContainer>;

  const categoryDefinition = getBuildingCategoryDefinition(building.building_category);
  const labels = getPropertyLabels(building.building_category, building.building_subtype);
  const isLand              = building.building_category === "land";
  const isCommercial        = building.building_category === "commercial";
  const isIndustrial        = building.building_category === "industrial";
  const isIndustrialPark    = building.building_category === "industrial_park";
  const isResidentialSingle = building.building_category === "residential_single";
  const isPlazaComercial    = building.building_subtype === "plaza_comercial";
  const hasLeasesTab   = isLand || isCommercial || isIndustrial || isResidentialSingle;
  const hasParkingTab  = !isLand && !isCommercial && !isIndustrial && !isIndustrialPark && !isResidentialSingle && !isPlazaComercial
                         && activeFeatureKeys.has("parking");
  const hasAssetsTab       = !isIndustrialPark;
  const hasServicesTab     = !isIndustrialPark
                             && (activeFeatureKeys.has("electricity") || activeFeatureKeys.has("water")
                                 || activeFeatureKeys.has("gas") || activeFeatureKeys.has("internet")
                                 || tabCounts.services > 0);
  const hasBodegasTab      = isIndustrialPark;
  const hasLocalesTab      = isPlazaComercial;
  const hasCommonAreasTab  = activeFeatureKeys.has("common_areas")
                             && ["residential_multi", "commercial", "industrial_park"].includes(building.building_category ?? "");
  const hideUnitsUI    = isLand || isIndustrialPark || isResidentialSingle || isPlazaComercial;
  const hasSuperficiesTab = ["commercial", "industrial", "industrial_park", "land"].includes(building.building_category ?? "");

  const tabsWithPendingTasks = new Set(
    setupTasks
      .filter(t => !t.is_completed && !t.dismissed)
      .map(t => TASK_TAB_MAP[t.task_key])
      .filter(Boolean)
  );

  const pendingSetupCount = setupTasks.filter(t => !t.is_completed && !t.dismissed).length;

  const pendingByTab = {
    services:  setupTasks.filter(t => !t.is_completed && !t.dismissed && ['add_electricity_meter','add_water_meter','add_gas_meter','setup_internet','setup_cleaning_schedule'].includes(t.task_key)),
    assets:    setupTasks.filter(t => !t.is_completed && !t.dismissed && ['setup_admin_office','setup_security_booth','setup_service_storage','add_first_asset','setup_loading_dock'].includes(t.task_key)),
    documents: setupTasks.filter(t => !t.is_completed && !t.dismissed && ['upload_documents'].includes(t.task_key)),
    gallery:   setupTasks.filter(t => !t.is_completed && !t.dismissed && ['add_photos'].includes(t.task_key)),
    leases:    setupTasks.filter(t => !t.is_completed && !t.dismissed && ['add_first_lease'].includes(t.task_key)),
    parking:   setupTasks.filter(t => !t.is_completed && !t.dismissed && ['add_parking_spots'].includes(t.task_key)),
  };

  function getBuildingDetailLabel(cat: string | null, sub?: string | null): string {
    if (cat === "commercial") {
      switch (sub) {
        case "plaza_comercial": return "Detalle de la plaza";
        case "oficinas":        return "Detalle del edificio de oficinas";
        case "showroom":        return "Detalle del showroom";
        default:                return "Detalle del local";
      }
    }
    if (cat === "industrial") {
      return sub === "planta" ? "Detalle de la planta" : "Detalle de la nave";
    }
    switch (cat) {
      case "industrial_park":    return "Detalle del parque";
      case "land":               return "Detalle del terreno";
      case "residential_single": return "Detalle de la casa";
      default:                   return "Detalle del edificio";
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
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{getBuildingDetailLabel(building.building_category, building.building_subtype)}</span>
        </div>
      </div>

      <PageHeader
        title={building.name}
        titleIcon={<Building2 size={20} />}
        subtitle={`Vista general ${buildingOf(labels)} — ocupación, ${labels.collections.toLowerCase()} y tendencia.`}
        actions={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
            {/* Configuración */}
            <button
              type="button"
              onClick={() => void openFeaturesModal()}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--border-default)", background: "var(--bg-card)",
                color: "var(--text-primary)", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
              }}
            >
              <Sliders size={18} />
              <span>Configuración</span>
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
        onChange={handleTabChange}
        items={[
          { key: "overview",  label: "Resumen",    icon: <Building2 size={16} />, pendingDot: tabsWithPendingTasks.has('overview') },
          ...(hasLeasesTab  ? [{ key: "leases",  label: labels.leases, icon: <FileClockIcon size={16} />, count: landLeases.length, pendingDot: tabsWithPendingTasks.has('leases') }] : []),
          ...(hasBodegasTab  ? [{ key: "bodegas",  label: "Bodegas",  icon: <Warehouse size={16} />, count: childBuildings.length }] : []),
          ...(hasLocalesTab  ? [{ key: "locales", label: "Locales", icon: <Store size={16} />, count: plazaLocales.length, notifDot: unitsNeedingReview > 0 ? { count: unitsNeedingReview, color: '#EF9F27' } : undefined }] : []),
          ...(hasSuperficiesTab ? [{ key: "superficies", label: "Superficies", icon: <Ruler size={16} />, count: buildingAreas.length }] : []),
          ...(hasAssetsTab  ? [{ key: "assets",  label: "Activos",     icon: <Package size={16} />,      count: tabCounts.assets,    pendingDot: tabsWithPendingTasks.has('assets')       }] : []),
          { key: "documents", label: "Documentos", icon: <FolderOpen size={16} />, count: tabCounts.docs,    pendingDot: tabsWithPendingTasks.has('documents') },
          { key: "gallery",   label: "Galería",    icon: <FileImage size={16} />,  count: tabCounts.gallery, pendingDot: tabsWithPendingTasks.has('gallery')   },
          ...(hasServicesTab     ? [{ key: "services",     label: "Servicios",     icon: <Wrench size={16} />,  count: tabCounts.services, pendingDot: tabsWithPendingTasks.has('services')     }] : []),
          ...(hasParkingTab      ? [{ key: "parking",      label: "Cajones",       icon: <Car size={16} />,     count: tabCounts.parking,  pendingDot: tabsWithPendingTasks.has('parking')      }] : []),
          ...(hasCommonAreasTab  ? [{ key: "common_areas", label: "Áreas comunes", icon: <Trees size={16} />,   count: commonAreas.length, pendingDot: tabsWithPendingTasks.has('common_areas') }] : []),
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 24 }}>

          {/* ── Fila 1: métricas ── */}
          {isLand ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              {building.land_sqm != null && (
                <MetricCard label="M² de terreno" value={`${building.land_sqm.toLocaleString("es-MX")} m²`} icon={<MapPin size={18} />} helper="Superficie total del terreno" />
              )}
              {building.construction_sqm != null && (
                <MetricCard label="M² construidos" value={`${building.construction_sqm.toLocaleString("es-MX")} m²`} icon={<Building2 size={18} />} helper="Superficie de construcción" />
              )}
              {building.address && (
                <MetricCard label="Dirección" value={building.address} icon={<MapPin size={18} />} helper="Ubicación del terreno" />
              )}
              {building.latitude != null && building.longitude != null && (
                <MetricCard
                  label="Coordenadas"
                  value={`${Number(building.latitude).toFixed(5)}, ${Number(building.longitude).toFixed(5)}`}
                  icon={<MapPin size={18} />}
                  helper="Ver en mapa"
                />
              )}
            </div>
          ) : isIndustrialPark || isPlazaComercial ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              {isPlazaComercial ? (
                <>
                  <MetricCard label="Locales" value={String(plazaLocales.length)} icon={<Store size={18} />} helper="Locales en la plaza" />
                  <MetricCard label="Ocupados" value={String(plazaLocales.filter((l) => l.status === "OCCUPIED").length)} icon={<Store size={18} />} helper="Locales rentados" variant="green" />
                  <MetricCard label="Disponibles" value={String(plazaLocales.filter((l) => l.status === "VACANT").length)} icon={<Store size={18} />} helper="Locales vacantes" variant="blue" />
                  {(() => {
                    const totalSqm = plazaLocales.reduce((s, l) => s + (l.sqm ?? 0), 0);
                    return totalSqm > 0
                      ? <MetricCard label="M² totales" value={`${totalSqm.toLocaleString("es-MX")} m²`} icon={<Ruler size={18} />} helper="Suma de m² de locales" />
                      : null;
                  })()}
                </>
              ) : (
                <>
                  <MetricCard label="Bodegas" value={String(childBuildings.length)} icon={<Warehouse size={18} />} helper="Naves en el parque" />
                  {building.land_sqm != null && (
                    <MetricCard label="M² totales" value={`${building.land_sqm.toLocaleString("es-MX")} m²`} icon={<Ruler size={18} />} helper="M² de terreno" />
                  )}
                  {building.construction_sqm != null && (
                    <MetricCard label="M² construcción" value={`${building.construction_sqm.toLocaleString("es-MX")} m²`} icon={<Building2 size={18} />} helper="M² construidos" />
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="building-detail-metrics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <OccupancyDonutCard occupied={occupiedUnits} total={totalUnits} />
              {isResidentialSingle ? (
                building.construction_sqm != null ? (
                  <MetricCard
                    label="M² construidos"
                    value={`${building.construction_sqm.toLocaleString("es-MX")} m²`}
                    icon={<Building2 size={18} />}
                    helper="Superficie de construcción"
                  />
                ) : building.land_sqm != null ? (
                  <MetricCard
                    label="M² de terreno"
                    value={`${building.land_sqm.toLocaleString("es-MX")} m²`}
                    icon={<MapPin size={18} />}
                    helper="Superficie del terreno"
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

          {/* ── Ficha de la propiedad — solo residential_single ── */}
          {isResidentialSingle && (() => {
            const hf = building.building_features ?? {};
            const bedrooms       = Number(hf.bedrooms ?? 0);
            const fullBathrooms  = Number(hf.full_bathrooms ?? 0);
            const parkingSpots   = Number(hf.parking_spots ?? 0);
            const rentalMode     = hf.rental_mode as string | undefined;

            const pills = [
              { icon: <Bed size={14} />,      value: bedrooms,                      label: bedrooms === 1 ? "Recámara" : "Recámaras" },
              { icon: <Droplets size={14} />, value: fullBathrooms,                  label: fullBathrooms === 1 ? "Baño" : "Baños"    },
              { icon: <Car size={14} />,      value: parkingSpots,                   label: parkingSpots === 1 ? "Cajón" : "Cajones"  },
              { icon: <Ruler size={14} />,    value: building.construction_sqm ?? 0, label: "m² const."                              },
              { icon: <MapPin size={14} />,   value: building.land_sqm ?? 0,         label: "m² terreno"                             },
            ].filter((p) => (p.value ?? 0) > 0);

            const activeAmenities = HOUSE_AMENITIES.filter((a) => Boolean(hf[a.key]));
            const otherNotes = hf.other_notes as string | undefined;
            const hasAnyData = pills.length > 0 || activeAmenities.length > 0 || otherNotes || rentalMode;

            return (
              <SectionCard title="Ficha de la propiedad" icon={<Home size={18} />}>
                {!hasAnyData ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
                    <span>Sin ficha configurada</span>
                    <button
                      type="button"
                      onClick={openEditModal}
                      style={{ background: "none", border: "none", color: "#0369a1", cursor: "pointer", fontSize: 13, textDecoration: "underline", padding: 0 }}
                    >
                      Editar propiedad
                    </button>
                    <span>para agregar los detalles</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {pills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {pills.map((pill, i) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 14px", borderRadius: 8, border: "0.5px solid var(--border-default)",
                            background: "var(--bg-page)", fontSize: 13,
                          }}>
                            <span style={{ color: "var(--text-muted)", lineHeight: 0 }}>{pill.icon}</span>
                            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{pill.value}</span>
                            <span style={{ color: "var(--text-muted)" }}>{pill.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(activeAmenities.length > 0 || otherNotes) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {activeAmenities.map((a) => (
                          <span key={a.key} style={{ padding: "4px 10px", borderRadius: 12, fontSize: 12, background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>
                            {a.label}
                          </span>
                        ))}
                        {otherNotes && String(otherNotes).split("\n").map((l) => l.trim()).filter((l) => l.length > 0).map((line, idx) => (
                          <span key={idx} style={{ padding: "4px 10px", borderRadius: 12, fontSize: 12, background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>
                            {line.length > 40 ? line.slice(0, 38) + "…" : line}
                          </span>
                        ))}
                      </div>
                    )}
                    {rentalMode && (
                      <div>
                        <span style={{
                          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: rentalMode === "whole" ? "#0369a11a" : "#8B22521a",
                          color:      rentalMode === "whole" ? "#0369a1"   : "#8B2252",
                        }}>
                          {rentalMode === "whole" ? "Renta completa" : "Renta por cuartos"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            );
          })()}

          {/* ── Setup checklist ── */}
          {setupTasks.length > 0 && (() => {
            const visibleSetupTasks = setupTasks.filter((t) => {
              // Always show if feature/task is unknown (safe default)
              const feature = PROPERTY_FEATURES.find((f) => f.key === t.feature_key);
              const task = feature?.tasks.find((tk) => tk.key === t.task_key);
              if (!task?.applicableTypes) return true;
              return task.applicableTypes.includes(building.building_category ?? "");
            });
            const pendingTasks   = visibleSetupTasks.filter((t) => !t.is_completed);
            const completedTasks = visibleSetupTasks.filter((t) => t.is_completed);
            const totalCount     = visibleSetupTasks.length;
            const completedCount = completedTasks.length;
            if (totalCount === 0) return null;
            const allDone        = pendingTasks.length === 0;
            const circ           = 2 * Math.PI * 12;
            const dashOffset     = circ * (1 - completedCount / totalCount);

            return (
              <div style={{
                borderRadius: 12,
                background: "rgba(139,34,82,0.04)",
                border: "1px solid rgba(139,34,82,0.2)",
                borderLeft: "4px solid #8B2252",
                padding: 20,
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: allDone ? 16 : 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckSquare size={18} color="#8B2252" />
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                      Configuración pendiente
                    </span>

                    {/* Donut de progreso */}
                    <svg width="32" height="32" style={{ flexShrink: 0 }}>
                      <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border-default)" strokeWidth="3" />
                      <circle
                        cx="16" cy="16" r="12"
                        fill="none"
                        stroke="#1D9E75"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 16 16)"
                      />
                      <text
                        x="16" y="20"
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--text-secondary)"
                        fontWeight="600"
                      >
                        {Math.round((completedCount / totalCount) * 100)}%
                      </text>
                    </svg>

                    {/* Badge de pendientes */}
                    {pendingTasks.length > 0 && (
                      <span style={{
                        background: "#8B2252", color: "#fff",
                        borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700,
                      }}>
                        {pendingTasks.length}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDismissAllTasks()}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
                    title="Descartar todo"
                  >
                    ✕
                  </button>
                </div>

                {/* Estado: todo completado */}
                {allDone ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 0" }}>
                    <CheckCircle2 size={32} color="#1D9E75" />
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                      ¡Propiedad configurada!
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                      Todos los pasos de configuración están completos.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Tareas pendientes */}
                    {pendingTasks.map((task) => {
                      const feat    = getFeatureByKey(task.feature_key);
                      const taskDef = feat?.tasks.find((t) => t.key === task.task_key);
                      if (!taskDef) return null;
                      const resolvedRoute = taskDef?.route?.replace("[id]", building.id);
                      return (
                        <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => void handleCompleteTask(task.id)}
                            style={{ marginTop: 3, cursor: "pointer", accentColor: "#8B2252", flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {resolvedRoute ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (resolvedRoute.includes(`/buildings/${building.id}?tab=`)) {
                                    const tabValue = new URL(resolvedRoute, window.location.origin).searchParams.get("tab");
                                    if (tabValue) {
                                      handleTabChange(tabValue);
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                      return;
                                    }
                                  }
                                  router.push(resolvedRoute);
                                }}
                                style={{
                                  background: "none", border: "none", padding: 0,
                                  display: "inline-flex", alignItems: "center", gap: 3,
                                  cursor: "pointer",
                                  fontSize: 13, fontWeight: 600, color: "#8B2252",
                                }}
                              >
                                {taskDef?.label ?? task.task_key}
                                <ChevronRight size={14} color="var(--text-muted)" />
                              </button>
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                {taskDef?.label ?? task.task_key}
                              </span>
                            )}
                            {taskDef?.description && (
                              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                                {taskDef.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Separador + tareas completadas */}
                    {completedTasks.length > 0 && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <div style={{ flex: 1, height: 1, background: "#bbf7d0" }} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#1D9E75", whiteSpace: "nowrap" }}>Completadas</span>
                          <div style={{ flex: 1, height: 1, background: "#bbf7d0" }} />
                        </div>
                        {completedTasks.map((task) => {
                          const feat    = getFeatureByKey(task.feature_key);
                          const taskDef = feat?.tasks.find((t) => t.key === task.task_key);
                          if (!taskDef) return null;
                          return (
                            <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "6px 8px", borderRadius: 8, background: "#f0fdf4" }}>
                              <CheckCircle2 size={18} color="#1D9E75" style={{ flexShrink: 0, marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}>
                                  {taskDef?.label ?? task.task_key}
                                </span>
                                {taskDef?.description && (
                                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(21,128,61,0.7)" }}>
                                    {taskDef.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(139,34,82,0.15)" }}>
                  <button
                    type="button"
                    onClick={() => void handleDismissAllTasks()}
                    style={{
                      padding: "8px 16px", borderRadius: 8,
                      border: "1px solid var(--border-default)", background: "transparent",
                      fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <SkipForward size={14} />
                    Ya tengo experiencia, omitir configuración
                  </button>
                </div>
              </div>
            );
          })()}

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
                <SummaryItem
                  label="Categoría"
                  value={
                    building.building_subtype
                      ? `${getPropertyType(building.building_category)?.label ?? ""} — ${getSubtypeLabel(building.building_category, building.building_subtype) ?? building.building_subtype}`
                      : (getPropertyType(building.building_category)?.label ?? building.building_category ?? "")
                  }
                  icon={<Building2 size={16} />}
                />
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
                      {building.construction_sqm.toLocaleString("es-MX")} m²
                    </span>
                  </div>
                )}
                {building.default_unit_sqm != null && !isLand && !isResidentialSingle && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                    <LayoutGrid size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {building.default_unit_sqm.toLocaleString("es-MX")} m²/unidad
                    </span>
                  </div>
                )}
              </div>
            )}
            {hasSuperficiesTab && buildingAreas.length > 0 ? (() => {
              const total = buildingAreas.reduce((s, a) => s + (a.sqm ?? 0), 0);
              return (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Ruler size={14} style={{ color: "var(--text-muted)" }} />
                    Distribución de superficies
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {buildingAreas.map((area) => {
                      const pct = total > 0 ? Math.round(((area.sqm ?? 0) / total) * 100) : 0;
                      const color = AREA_TYPE_COLORS[area.area_type] ?? "#6B7280";
                      return (
                        <div key={area.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getAreaTypeLabel(area.area_type, area.area_label)}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                            {(area.sqm ?? 0).toLocaleString("es-MX")} m²
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 80, height: 6, borderRadius: 999, background: "var(--bg-page)", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color }} />
                            </div>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, minWidth: 28, textAlign: "right" }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Total</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {total.toLocaleString("es-MX")} m²
                      </span>
                    </div>
                    {building.construction_sqm != null && total > 0 && Math.abs(total - building.construction_sqm) > 1 ? (
                      <div style={{ fontSize: 12, color: "var(--badge-text-amber)", fontWeight: 600 }}>
                        Registrado: {building.construction_sqm.toLocaleString("es-MX")} m² · Diferencia: {Math.abs(total - building.construction_sqm).toLocaleString("es-MX")} m²
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })() : null}
          </SectionCard>

          {/* ── Fila 2: PieChart distribución | BarChart cobranza ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>

            {/* Col izquierda: Distribución — oculta para terrenos, parques y residencial unifamiliar */}
            {!isLand && !isIndustrialPark && !isResidentialSingle && <SectionCard title={`Distribución de ${labels.units.toLowerCase()}`} icon={<Home size={18} />}>
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

          {/* ── Fila 3: Tendencia de ocupación — oculta para terrenos, parques y residencial unifamiliar ── */}
          {!isLand && !isIndustrialPark && !isResidentialSingle && <SectionCard
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
                      onClick={() => handleTabChange("services")}
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
          <>
            {pendingByTab.assets.length > 0 && (
              <TabPendingBanner tasks={pendingByTab.assets} buildingId={buildingId as string} onNavigate={handleBannerNavigate} onDismiss={handleDismissBannerTasks} />
            )}
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
          </>
        );
      })() : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: DOCUMENTOS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "documents" ? (
        <>
          {pendingByTab.documents.length > 0 && (
            <TabPendingBanner tasks={pendingByTab.documents} buildingId={buildingId as string} onNavigate={handleBannerNavigate} onDismiss={handleDismissBannerTasks} />
          )}
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
        </>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: GALERÍA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "gallery" ? (
        <>
          {pendingByTab.gallery.length > 0 && (
            <TabPendingBanner tasks={pendingByTab.gallery} buildingId={buildingId as string} onNavigate={handleBannerNavigate} onDismiss={handleDismissBannerTasks} />
          )}
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
        </>
      ) : null}


      {/* ══════════════════════════════════════════════════════════════
          TAB: SERVICIOS DEL EDIFICIO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "services" && building ? (
        <>
          {pendingByTab.services.length > 0 && (
            <TabPendingBanner tasks={pendingByTab.services} buildingId={buildingId as string} onNavigate={handleBannerNavigate} onDismiss={handleDismissBannerTasks} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            {/* ── SUMINISTROS ── */}
            <BuildingServicesTab
              buildingId={building.id}
              companyId={building.company_id}
              buildingName={building.name}
              units={buildingUnits}
              refreshKey={servicesRefreshKey}
            />

            {/* ── LIMPIEZA ── */}
            <div id="services-cleaning-section" style={{ background: "var(--color-background-primary, var(--bg-card))", border: "0.5px solid var(--color-border-tertiary, var(--border-default))", borderRadius: "var(--border-radius-lg, 14px)", overflow: "hidden", marginBottom: 20 }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Sparkles size={14} color="var(--accent, #8B2252)" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Limpieza</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <a href={`/cleaning?building_id=${building.id}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
                    Ver historial completo →
                  </a>
                  <button
                    type="button"
                    onClick={() => setAddScheduleOpen(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
                  >
                    <Plus size={12} />Agregar horario
                  </button>
                </div>
              </div>

              {/* Schedules como filas flat */}
              {buildingSchedules.length === 0 ? (
                <div style={{ padding: "14px 18px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                    Sin horarios de limpieza configurados
                  </p>
                </div>
              ) : (
                buildingSchedules.map((s, si) => {
                  const borderColor = s.cleaning_type === 'common_area' ? '#378ADD' : '#10B981';
                  const isLast = si === buildingSchedules.length - 1 && recentCleaningLogs.length === 0;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px 10px 15px", borderLeft: `3px solid ${borderColor}`, background: "#FAFCFF", borderBottom: isLast ? "none" : "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>
                        {DAY_LABELS_MAP[s.day_of_week] ?? s.day_of_week} · {s.time_block === 'morning' ? 'mañana' : 'tarde'}
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>
                          {CLEANING_TYPE_LABEL[s.cleaning_type] ?? s.cleaning_type}
                        </span>
                      </span>
                      <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => toast('Próximamente')}
                          style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px", color: "var(--text-secondary)", fontSize: 12 }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('¿Eliminar este horario de limpieza?')) {
                              void handleDeleteSchedule(s.id);
                            }
                          }}
                          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-danger, #dc2626)", display: "inline-flex", alignItems: "center" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Últimos logs */}
              {recentCleaningLogs.length > 0 && (
                <>
                  <div style={{ padding: "10px 18px 4px", borderTop: buildingSchedules.length > 0 ? "0.5px solid var(--color-border-tertiary, var(--border-default))" : undefined }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Últimos registros</span>
                  </div>
                  {recentCleaningLogs.map((log, li) => (
                    <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: li < recentCleaningLogs.length - 1 ? "0.5px solid var(--color-border-tertiary, var(--border-default))" : "none" }}>
                      <span style={{ color: "var(--text-muted)", minWidth: 52, flexShrink: 0, fontSize: 12 }}>{formatShortDate(log.scheduled_date)}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{CLEANING_TYPE_LABEL[log.cleaning_type] ?? log.cleaning_type}</span>
                      <span style={{
                        padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 600, flexShrink: 0,
                        background: log.status === 'completed' ? '#d1fae5' : log.status === 'skipped' ? '#fef3c7' : 'var(--divider)',
                        color: log.status === 'completed' ? '#065f46' : log.status === 'skipped' ? '#92400e' : 'var(--text-secondary)',
                      }}>
                        {log.status === 'completed' ? 'Completado' : log.status === 'skipped' ? 'Omitido' : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── MANTENIMIENTO ── */}
            <div style={{ background: "var(--color-background-primary, var(--bg-card))", border: "0.5px solid var(--color-border-tertiary, var(--border-default))", borderRadius: "var(--border-radius-lg, 14px)", overflow: "hidden", marginBottom: 20 }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Wrench size={14} color="var(--accent, #8B2252)" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Mantenimiento</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <a href={`/maintenance?building_id=${building.id}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
                    Ver todos los tickets →
                  </a>
                  <button
                    type="button"
                    onClick={() => setAddTicketOpen(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
                  >
                    <Plus size={12} />Nuevo ticket
                  </button>
                </div>
              </div>

              {/* Tickets abiertos */}
              {openTickets.length === 0 ? (
                <div style={{ padding: "14px 18px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#10B981", fontWeight: 600 }}>
                    Sin tickets pendientes
                  </p>
                </div>
              ) : (
                openTickets.map((ticket, ti) => {
                  const dotColor = ticket.priority === 'urgent' ? '#EF4444' : ticket.priority === 'high' ? '#F97316' : ticket.priority === 'medium' ? '#F59E0B' : '#9CA3AF';
                  const pillBg = ticket.priority === 'urgent' ? '#fee2e2' : ticket.priority === 'high' ? '#ffedd5' : ticket.priority === 'medium' ? '#fef9c3' : '#f3f4f6';
                  const pillColor = ticket.priority === 'urgent' ? '#991b1b' : ticket.priority === 'high' ? '#9a3412' : ticket.priority === 'medium' ? '#713f12' : '#6b7280';
                  const priorityLabel = ticket.priority === 'urgent' ? 'Urgente' : ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Media' : 'Baja';
                  const age = daysAgo(ticket.created_at);
                  const isLast = ti === openTickets.length - 1 && upcomingPreventives.length === 0;
                  return (
                    <div key={ticket.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: isLast ? "none" : "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{ticket.title}</span>
                      <span style={{ padding: "2px 6px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: pillBg, color: pillColor, flexShrink: 0 }}>
                        {priorityLabel}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                        {age === 0 ? 'Hoy' : `Hace ${age} día${age === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Preventivos próximos */}
              {upcomingPreventives.length > 0 && (
                <>
                  <div style={{ padding: "10px 18px 4px", borderTop: openTickets.length > 0 ? "0.5px solid var(--color-border-tertiary, var(--border-default))" : undefined }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Preventivos próximos</span>
                  </div>
                  {upcomingPreventives.map((p, pi) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: pi < upcomingPreventives.length - 1 ? "0.5px solid var(--color-border-tertiary, var(--border-default))" : "none" }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.assets?.[0]?.name ?? 'Activo'}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatShortDate(p.next_due_date)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Modal: agregar horario de limpieza */}
          <Modal
            open={addScheduleOpen}
            title="Agregar horario de limpieza"
            onClose={() => { setAddScheduleOpen(false); setAddScheduleDays([]); }}
            maxWidth={480}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Tipo</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {([{ value: 'common_area', label: 'Áreas comunes' }, { value: 'exterior', label: 'Exterior' }]).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setAddScheduleType(opt.value)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: addScheduleType === opt.value ? "1.5px solid var(--accent)" : "1.5px solid var(--border-default)", background: addScheduleType === opt.value ? "var(--accent)" : "var(--bg-card)", color: addScheduleType === opt.value ? "#fff" : "var(--text-secondary)" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Días</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(['monday','tuesday','wednesday','thursday','friday','saturday'] as const).map(day => (
                    <button key={day} type="button" onClick={() => setAddScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} style={{ padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: addScheduleDays.includes(day) ? "1.5px solid var(--accent)" : "1.5px solid var(--border-default)", background: addScheduleDays.includes(day) ? "var(--accent)" : "var(--bg-card)", color: addScheduleDays.includes(day) ? "#fff" : "var(--text-secondary)" }}>
                      {DAY_LABELS_MAP[day]}
                    </button>
                  ))}
                </div>
                {addScheduleDays.length === 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#EF4444" }}>Selecciona al menos un día.</p>}
              </div>
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Turno</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {([{ value: 'morning', label: 'Mañana' }, { value: 'afternoon', label: 'Tarde' }]).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setAddScheduleBlock(opt.value)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: addScheduleBlock === opt.value ? "1.5px solid var(--accent)" : "1.5px solid var(--border-default)", background: addScheduleBlock === opt.value ? "var(--accent)" : "var(--bg-card)", color: addScheduleBlock === opt.value ? "#fff" : "var(--text-secondary)" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <UiButton variant="secondary" onClick={() => { setAddScheduleOpen(false); setAddScheduleDays([]); }}>Cancelar</UiButton>
                <UiButton variant="primary" onClick={() => void handleAddSchedule()} disabled={savingSchedule || addScheduleDays.length === 0}>
                  {savingSchedule ? 'Guardando...' : 'Guardar'}
                </UiButton>
              </div>
            </div>
          </Modal>

          {/* Modal: nuevo ticket de mantenimiento */}
          <Modal
            open={addTicketOpen}
            title="Nuevo ticket de mantenimiento"
            onClose={() => setAddTicketOpen(false)}
            maxWidth={520}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>Título *</p>
                <input value={newTicketTitle} onChange={e => setNewTicketTitle(e.target.value)} placeholder="Ej: Fuga en tubería del 3er piso" style={INPUT_STYLE} />
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>Descripción (opcional)</p>
                <textarea value={newTicketDesc} onChange={e => setNewTicketDesc(e.target.value)} rows={3} placeholder="Describe el problema en detalle..." style={TEXTAREA_STYLE} />
              </div>
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Prioridad</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([{ value: 'low', label: 'Baja' }, { value: 'medium', label: 'Media' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' }]).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setNewTicketPriority(opt.value)} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, border: newTicketPriority === opt.value ? "1.5px solid var(--accent)" : "1.5px solid var(--border-default)", background: newTicketPriority === opt.value ? "var(--accent)" : "var(--bg-card)", color: newTicketPriority === opt.value ? "#fff" : "var(--text-secondary)" }}>
                      <span>{MAINT_PRIORITY_ICON[opt.value]}</span>{opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <UiButton variant="secondary" onClick={() => setAddTicketOpen(false)}>Cancelar</UiButton>
                <UiButton variant="primary" onClick={() => void handleAddTicket()} disabled={savingTicket || !newTicketTitle.trim()}>
                  {savingTicket ? 'Creando...' : 'Crear ticket'}
                </UiButton>
              </div>
            </div>
          </Modal>
        </>
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
          <>
            {pendingByTab.leases.length > 0 && (
              <TabPendingBanner tasks={pendingByTab.leases} buildingId={buildingId as string} onNavigate={handleBannerNavigate} onDismiss={handleDismissBannerTasks} />
            )}
            <div style={{ display: "grid", gap: 20 }}>
            <SectionCard
              title={labels.leases}
              subtitle={`${labels.building} — contratos activos y disponibilidad.`}
              icon={<FileClockIcon size={18} />}
            >
              {/* Barra de ocupación del terreno — solo para terrenos */}
              {building.building_category === "land" && building.land_sqm != null && (
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
          </>
        );
      })() : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: CAJONES DE ESTACIONAMIENTO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "parking" ? (
        <>
          {pendingByTab.parking.length > 0 && (
            <TabPendingBanner tasks={pendingByTab.parking} buildingId={buildingId as string} onNavigate={handleBannerNavigate} onDismiss={handleDismissBannerTasks} />
          )}
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
        </>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: BODEGAS (industrial_park)
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "bodegas" && hasBodegasTab ? (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Métricas */}
          {childBuildings.length > 0 && (
            <AppGrid minWidth={160} gap={16}>
              <MetricCard label="Total"       value={String(childBuildings.length)}                                    icon={<Warehouse size={18} />} helper="Bodegas en el parque" />
              <MetricCard label="Disponibles" value={String(childBuildings.filter(cb => !bodegaOccupied.has(cb.id)).length)} icon={<Warehouse size={18} />} helper="Sin lease activo" variant="blue" />
              <MetricCard label="Rentadas"    value={String(childBuildings.filter(cb => bodegaOccupied.has(cb.id)).length)}  icon={<Warehouse size={18} />} helper="Con lease activo" variant="green" />
              {(() => { const total = childBuildings.reduce((s, cb) => s + (cb.construction_sqm ?? 0), 0); return total > 0 ? <MetricCard label="M² construcción" value={`${total.toLocaleString("es-MX")} m²`} icon={<Ruler size={18} />} helper="Suma de m² construidos" /> : null; })()}
            </AppGrid>
          )}
          <SectionCard
            title="Bodegas del parque"
            subtitle="Naves industriales que forman parte de este parque."
            icon={<Warehouse size={18} />}
            action={
              <UiButton icon={<Plus size={15} />} onClick={() => { const n = (childBuildings.length + 1).toString().padStart(2, "0"); setBodegaName(""); setBodegaCode(`B-${n}`); setBodegaConstructionSqm(""); setBodegaPatioSqm(""); setBodegaRampas(""); setBodegaMsg(""); setIsCreateBodegaOpen(true); }}>
                Agregar bodega
              </UiButton>
            }
          >
            {childBuildings.length === 0 ? (
              <AppEmptyState
                title="Sin bodegas registradas"
                description="Agrega la primera bodega para comenzar a gestionar el parque industrial."
                actionLabel="Agregar primera bodega"
                onAction={() => { const n = (childBuildings.length + 1).toString().padStart(2, "0"); setBodegaName(""); setBodegaCode(`B-${n}`); setBodegaConstructionSqm(""); setBodegaPatioSqm(""); setBodegaRampas(""); setBodegaMsg(""); setIsCreateBodegaOpen(true); }}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {childBuildings.map((cb) => {
                  const isOccupied = bodegaOccupied.has(cb.id);
                  return (
                    <div key={cb.id} style={{ position: "relative" }}>
                      <EntityCard
                        title={cb.name}
                        subtitle={cb.code ?? "Sin código"}
                        badge={
                          <AppBadge
                            backgroundColor={isOccupied ? "var(--badge-bg-green)" : "var(--badge-bg-blue)"}
                            textColor={isOccupied ? "var(--badge-text-green)" : "var(--badge-text-blue)"}
                            borderColor={isOccupied ? "var(--metric-border-green)" : "var(--metric-border-neutral)"}
                          >
                            {isOccupied ? "Rentada" : "Disponible"}
                          </AppBadge>
                        }
                        onClick={() => router.push(`/buildings/${cb.id}`)}
                        actions={
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenActionsBodegaId(openActionsBodegaId === cb.id ? null : cb.id); }}
                              style={dropdownTriggerStyle}
                              aria-label="Más acciones"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {openActionsBodegaId === cb.id && (
                              <div style={dropdownMenuStyle}>
                                <button type="button" style={dropdownActionButtonStyle} onClick={() => { router.push(`/buildings/${cb.id}`); setOpenActionsBodegaId(null); }}>
                                  <Warehouse size={14} /> Ver detalle
                                </button>
                                <button type="button" style={dropdownDeleteItemStyle} onClick={() => setOpenActionsBodegaId(null)}>
                                  <Trash2 size={14} /> Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        }
                      >
                        {(cb.construction_sqm != null || cb.land_sqm != null) && (
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                            {cb.construction_sqm != null && <span style={{ fontWeight: 600 }}>{cb.construction_sqm.toLocaleString("es-MX")} m² construcción</span>}
                            {cb.land_sqm != null && <span style={{ marginLeft: cb.construction_sqm != null ? 8 : 0 }}>{cb.land_sqm.toLocaleString("es-MX")} m² terreno</span>}
                          </div>
                        )}
                      </EntityCard>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: LOCALES (plaza_comercial)
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "locales" && hasLocalesTab ? (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Métricas + Dona de ocupación */}
          {plazaLocales.length > 0 && (
            <div className="building-detail-metrics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <OccupancyDonutCard
                occupied={plazaLocales.filter(l => l.status === "OCCUPIED").length}
                total={plazaLocales.length}
              />
              <AppGrid minWidth={130} gap={12}>
                <MetricCard label="Total"       value={String(plazaLocales.length)}                                           icon={<Store size={18} />} helper="Locales en la plaza" />
                <MetricCard label="Disponibles" value={String(plazaLocales.filter(l => l.status !== "OCCUPIED").length)}      icon={<Store size={18} />} helper="Sin lease activo" variant="blue" />
                <MetricCard label="Rentados"    value={String(plazaLocales.filter(l => l.status === "OCCUPIED").length)}       icon={<Store size={18} />} helper="Con lease activo" variant="green" />
                {(() => { const total = plazaLocales.reduce((s, l) => s + (l.sqm ?? 0), 0); return total > 0 ? <MetricCard label="M² totales" value={`${total.toLocaleString("es-MX")} m²`} icon={<Ruler size={18} />} helper="Suma de m² de locales" /> : null; })()}
              </AppGrid>
            </div>
          )}
          <SectionCard
            title="Locales de la plaza"
            subtitle="Espacios comerciales que forman parte de esta plaza."
            icon={<Store size={18} />}
            action={
              <UiButton icon={<Plus size={15} />} onClick={() => {
                const n = (plazaLocales.length + 1).toString().padStart(2, "0");
                setBodegaName(""); setBodegaCode(`L-${n}`); setBodegaConstructionSqm(""); setBodegaMsg("");
                setIsCreateBodegaOpen(true);
              }}>
                Agregar local
              </UiButton>
            }
          >
            {plazaLocales.length === 0 ? (
              <AppEmptyState
                title="Sin locales registrados"
                description="Agrega el primer local para comenzar a gestionar la plaza comercial."
                actionLabel="Agregar primer local"
                onAction={() => {
                  const n = (plazaLocales.length + 1).toString().padStart(2, "0");
                  setBodegaName(""); setBodegaCode(`L-${n}`); setBodegaConstructionSqm(""); setBodegaMsg("");
                  setIsCreateBodegaOpen(true);
                }}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {plazaLocales.map((local) => {
                  const occupied = local.status === "OCCUPIED";
                  return (
                    <div key={local.id} style={{ position: "relative" }}>
                      {local.needs_review && (
                        <div
                          title="Pendiente de revisión"
                          style={{
                            position: "absolute", top: 10, left: 10,
                            width: 10, height: 10, borderRadius: "50%",
                            background: "#EF9F27", zIndex: 2, pointerEvents: "none",
                          }}
                        />
                      )}
                      <EntityCard
                        title={local.unit_number}
                        subtitle={local.display_code ? `Código: ${local.display_code}` : "Sin código"}
                        badge={
                          <AppBadge
                            backgroundColor={occupied ? "var(--badge-bg-green)" : "var(--badge-bg-blue)"}
                            textColor={occupied ? "var(--badge-text-green)" : "var(--badge-text-blue)"}
                            borderColor={occupied ? "var(--metric-border-green)" : "var(--metric-border-neutral)"}
                          >
                            {occupied ? "Rentado" : "Disponible"}
                          </AppBadge>
                        }
                        statusIndicator={<StatusCircle status={local.status ?? "VACANT"} />}
                        onClick={() => router.push(`/buildings/${building.id}/units/${local.id}`)}
                        actions={
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenActionsLocalId(openActionsLocalId === local.id ? null : local.id); }}
                              style={dropdownTriggerStyle}
                              aria-label="Más acciones"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {openActionsLocalId === local.id && (
                              <div style={dropdownMenuStyle}>
                                <button type="button" style={dropdownActionButtonStyle} onClick={() => { router.push(`/buildings/${building.id}/units/${local.id}`); setOpenActionsLocalId(null); }}>
                                  <Store size={14} /> Ver detalle
                                </button>
                                <button type="button" style={dropdownActionButtonStyle} onClick={() => { openEditLocal(local); setOpenActionsLocalId(null); }}>
                                  <Edit3 size={14} /> Editar
                                </button>
                                <button type="button" style={dropdownActionButtonStyle} onClick={() => { setDuplicatingLocal(local); setDupLocalCount(1); setOpenActionsLocalId(null); }}>
                                  <Copy size={14} /> Duplicar
                                </button>
                                <button type="button" style={dropdownDeleteItemStyle} onClick={() => { setDeletingLocal(local); setOpenActionsLocalId(null); }}>
                                  <Trash2 size={14} /> Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        }
                      >
                        {local.sqm != null && (
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                            <span style={{ fontWeight: 600 }}>{local.sqm.toLocaleString("es-MX")} m²</span>
                          </div>
                        )}
                      </EntityCard>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          TAB: SUPERFICIES (building_areas)
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "superficies" && hasSuperficiesTab ? (() => {
        /* ── Áreas calculadas automáticamente ── */
        type AutoArea = { key: string; label: string; sqm: number; color: string };
        const autoAreas: AutoArea[] = [];

        if (isCommercial) {
          const units = isPlazaComercial ? plazaLocales : buildingUnits;
          const localesSqm = units.reduce((s, u) => s + (u.sqm ?? 0), 0);
          if (localesSqm > 0) autoAreas.push({ key: "locales", label: "Locales comerciales", sqm: localesSqm, color: AREA_TYPE_COLORS.locales ?? "#8B2252" });
        } else if (isIndustrial) {
          const grouped: Record<string, number> = {};
          for (const ua of buildingUnitAreas) {
            grouped[ua.area_type] = (grouped[ua.area_type] ?? 0) + (ua.sqm ?? 0);
          }
          for (const [type, sqm] of Object.entries(grouped)) {
            if (sqm > 0) autoAreas.push({ key: type, label: AREA_TYPE_LABELS[type] ?? type, sqm, color: AREA_TYPE_COLORS[type] ?? "#6B7280" });
          }
        } else if (isIndustrialPark) {
          const navesSqm = childBuildings.reduce((s, cb) => s + (cb.construction_sqm ?? 0), 0);
          if (navesSqm > 0) autoAreas.push({ key: "naves", label: "Naves / Bodegas", sqm: navesSqm, color: AREA_TYPE_COLORS.naves ?? "#6366F1" });
        }

        const autoTotal   = autoAreas.reduce((s, a) => s + a.sqm, 0);
        const manualTotal = buildingAreas.reduce((s, a) => s + (a.sqm ?? 0), 0);
        const grandTotal  = autoTotal + manualTotal;
        const hasAnyAreas = autoAreas.length > 0 || buildingAreas.length > 0;
        const areaTypes   = getAreaTypesForCategory(building.building_category);

        return (
          <div style={{ display: "grid", gap: 20 }}>
            <SectionCard
              title="Distribución de superficies"
              subtitle="Desglose de m² por tipo de área."
              icon={<Ruler size={18} />}
              action={
                <UiButton icon={<Plus size={15} />} onClick={() => {
                  setNewAreaType(areaTypes[0] || "otro");
                  setNewAreaLabel("");
                  setNewAreaSqm("");
                  setAreaMsg("");
                  setAreaCreateOpen(true);
                }}>
                  Agregar área
                </UiButton>
              }
            >
              {!hasAnyAreas ? (
                <AppEmptyState
                  title="Sin áreas registradas"
                  description="Agrega la primera área para ver la distribución de superficies."
                  actionLabel="Agregar primera área"
                  onAction={() => {
                    setNewAreaType(areaTypes[0] || "otro");
                    setNewAreaLabel("");
                    setNewAreaSqm("");
                    setAreaMsg("");
                    setAreaCreateOpen(true);
                  }}
                />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>

                  {/* ── Áreas automáticas ── */}
                  {autoAreas.length > 0 ? (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Áreas calculadas automáticamente
                      </div>
                      {autoAreas.map((area) => {
                        const pct = grandTotal > 0 ? Math.round((area.sqm / grandTotal) * 100) : 0;
                        return (
                          <AppCard key={area.key} style={{ padding: 16, background: "var(--badge-bg-blue)" }}>
                            <div style={{ display: "grid", gap: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                    <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{area.label}</strong>
                                    <span style={{ fontSize: 10, fontWeight: 700, background: "var(--icon-bg-blue)", color: "var(--badge-text-blue)", borderRadius: 999, padding: "2px 7px" }}>
                                      Auto
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                                    Calculado de los espacios registrados
                                  </span>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                                    {area.sqm.toLocaleString("es-MX")} m²
                                  </div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{pct}%</div>
                                </div>
                              </div>
                              <div style={{ height: 6, borderRadius: 999, background: "var(--bg-page)", overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: area.color }} />
                              </div>
                            </div>
                          </AppCard>
                        );
                      })}
                    </>
                  ) : null}

                  {/* ── Separador ── */}
                  {autoAreas.length > 0 && buildingAreas.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "var(--border-default)" }} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Áreas adicionales
                      </span>
                      <div style={{ flex: 1, height: 1, background: "var(--border-default)" }} />
                    </div>
                  ) : null}

                  {/* ── Áreas manuales ── */}
                  {buildingAreas.map((area) => {
                    const pct = grandTotal > 0 ? Math.round(((area.sqm ?? 0) / grandTotal) * 100) : 0;
                    const color = AREA_TYPE_COLORS[area.area_type] ?? "#6B7280";
                    return (
                      <AppCard key={area.id} style={{ padding: 16 }}>
                        <div style={{ display: "grid", gap: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div>
                              <strong style={{ fontSize: 14, color: "var(--text-primary)", display: "block", marginBottom: 2 }}>
                                {getAreaTypeLabel(area.area_type, area.area_label)}
                              </strong>
                              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                                {(area.sqm ?? 0).toLocaleString("es-MX")} m²
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>{pct}%</span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteArea(area.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
                                title="Eliminar área"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div style={{ height: 6, borderRadius: 999, background: "var(--bg-page)", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color }} />
                          </div>
                        </div>
                      </AppCard>
                    );
                  })}

                  {/* ── Total general ── */}
                  <AppCard style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>Total</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                        {grandTotal.toLocaleString("es-MX")} m²
                      </span>
                    </div>
                    {building.construction_sqm != null && Math.abs(grandTotal - building.construction_sqm) > 1 ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--badge-text-amber)", fontWeight: 600 }}>
                        Registrado: {building.construction_sqm.toLocaleString("es-MX")} m² · Diferencia: {Math.abs(grandTotal - building.construction_sqm).toLocaleString("es-MX")} m²
                      </div>
                    ) : null}
                  </AppCard>
                </div>
              )}
            </SectionCard>
          </div>
        );
      })() : null}

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

          {(buildingCategory === "commercial" || buildingCategory === "industrial") && (() => {
            const subtypes = buildingCategory === "commercial" ? COMMERCIAL_SUBTYPES : INDUSTRIAL_SUBTYPES;
            const label = buildingCategory === "commercial" ? "Tipo de espacio comercial" : "Tipo de instalación industrial";
            const color = buildingCategory === "commercial" ? "#0369a1" : "#b45309";
            const effective = subtypes.find(s => s.value === editSubtype) ? editSubtype : subtypes[0].value;
            return (
              <AppFormField label={label}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {subtypes.map((st) => {
                    const StIcon = SUBTYPE_ICON_MAP[st.icon];
                    const sel = effective === st.value;
                    return (
                      <button key={st.value} type="button" onClick={() => setEditSubtype(st.value)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                          padding: "10px 12px", borderRadius: 10, textAlign: "left",
                          border: sel ? `2px solid ${color}` : "2px solid var(--border-default)",
                          background: sel ? color + "12" : "var(--bg-card)",
                          cursor: "pointer", transition: "all 0.15s ease",
                        }}
                      >
                        {StIcon && <StIcon size={15} color={sel ? color : "var(--text-muted)"} />}
                        <p style={{ margin: 0, fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? color : "var(--text-primary)", lineHeight: 1.2 }}>{st.label}</p>
                        <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>{st.description}</p>
                      </button>
                    );
                  })}
                </div>
              </AppFormField>
            );
          })()}

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
            {buildingCategory !== "land" && buildingCategory !== "residential_single" && (
              <AppFormField label="M² por unidad (referencia)">
                <input value={editDefaultUnitSqm} onChange={(e) => setEditDefaultUnitSqm(e.target.value)} type="number" placeholder="Ej: 65" style={INPUT_STYLE} />
              </AppFormField>
            )}
          </div>

          {buildingCategory === "residential_single" && (() => {
            const hf = editHouseFeatures;
            const setHF = (key: string, val: unknown) => setEditHouseFeatures((prev) => ({ ...prev, [key]: val }));
            return (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                  Características de la casa
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <AppFormField label="Recámaras">
                    <input type="number" value={String(hf.bedrooms ?? "")} onChange={(e) => setHF("bedrooms", e.target.value ? Number(e.target.value) : undefined)} placeholder="0" style={INPUT_STYLE} />
                  </AppFormField>
                  <AppFormField label="Baños completos">
                    <input type="number" value={String(hf.full_bathrooms ?? "")} onChange={(e) => setHF("full_bathrooms", e.target.value ? Number(e.target.value) : undefined)} placeholder="0" style={INPUT_STYLE} />
                  </AppFormField>
                  <AppFormField label="Medios baños">
                    <input type="number" value={String(hf.half_bathrooms ?? "")} onChange={(e) => setHF("half_bathrooms", e.target.value ? Number(e.target.value) : undefined)} placeholder="0" style={INPUT_STYLE} />
                  </AppFormField>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <AppFormField label="Cajones estacionamiento">
                    <input type="number" value={String(hf.parking_spots ?? "")} onChange={(e) => setHF("parking_spots", e.target.value ? Number(e.target.value) : undefined)} placeholder="0" style={INPUT_STYLE} />
                  </AppFormField>
                  <AppFormField label="Niveles/pisos">
                    <input type="number" value={String(hf.floors ?? "")} onChange={(e) => setHF("floors", e.target.value ? Number(e.target.value) : undefined)} placeholder="1" style={INPUT_STYLE} />
                  </AppFormField>
                  <AppFormField label="Año de construcción">
                    <input type="number" value={String(hf.year_built ?? "")} onChange={(e) => setHF("year_built", e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej: 2005" style={INPUT_STYLE} />
                  </AppFormField>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  {HOUSE_AMENITIES.map((a) => (
                    <label key={a.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                      <input type="checkbox" checked={Boolean(hf[a.key])} onChange={(e) => setHF(a.key, e.target.checked)} style={{ accentColor: "#0369a1" }} />
                      {a.label}
                    </label>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                    <input type="checkbox" checked={Boolean(hf.has_other)}
                      onChange={(e) => {
                        setHF("has_other", e.target.checked);
                        if (!e.target.checked) setHF("other_notes", undefined);
                      }}
                      style={{ accentColor: "#0369a1" }} />
                    Otro
                  </label>
                  {Boolean(hf.has_other) && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Describe las características adicionales</p>
                      <textarea
                        value={(hf.other_notes as string) ?? ""}
                        onChange={(e) => setHF("other_notes", e.target.value || undefined)}
                        placeholder="Ej: Cuarto de TV, estudio, terraza techada..."
                        rows={3}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-default)", fontSize: 13, resize: "vertical", boxSizing: "border-box", background: "var(--bg-input, var(--bg-page))", color: "var(--text-primary)" }}
                      />
                    </div>
                  )}
                </div>
                <AppFormField label="Modo de renta">
                  <div style={{ display: "flex", gap: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" checked={hf.rental_mode === "whole"} onChange={() => setHF("rental_mode", "whole")} style={{ accentColor: "#0369a1" }} />
                      Casa completa
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" checked={hf.rental_mode === "by_room"} onChange={() => setHF("rental_mode", "by_room")} style={{ accentColor: "#8B2252" }} />
                      Por cuartos
                    </label>
                  </div>
                </AppFormField>
              </div>
            );
          })()}

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

      {/* ── Modal agregar bodega / local ── */}
      <Modal open={isCreateBodegaOpen} onClose={() => { if (!savingBodega) setIsCreateBodegaOpen(false); }} title={isPlazaComercial ? "Agregar local" : "Agregar bodega"}>
        <form onSubmit={handleCreateBodega}>
          {bodegaMsg ? <p style={errorBannerStyle}>{bodegaMsg}</p> : null}

          <AppFormField label={isPlazaComercial ? "Nombre del local" : "Nombre de la bodega"} required>
            <input
              value={bodegaName}
              onChange={(e) => setBodegaName(e.target.value)}
              placeholder={isPlazaComercial ? "Ej: Local A, Local 101, Farmacia" : "Ej: Bodega Norte, Nave 3"}
              style={INPUT_STYLE}
            />
          </AppFormField>

          <AppFormField label="Código">
            <input value={bodegaCode} onChange={(e) => setBodegaCode(e.target.value)} placeholder={isPlazaComercial ? "L-01" : "B-01"} style={INPUT_STYLE} />
          </AppFormField>

          {isPlazaComercial ? (
            <AppFormField label="Metros cuadrados">
              <input value={bodegaConstructionSqm} onChange={(e) => setBodegaConstructionSqm(e.target.value)} type="number" min={0} step={0.5} placeholder="Ej: 85" style={INPUT_STYLE} />
            </AppFormField>
          ) : (
            <>
              <AppFormField label="M² de construcción">
                <input value={bodegaConstructionSqm} onChange={(e) => setBodegaConstructionSqm(e.target.value)} type="number" min={0} placeholder="Ej: 500" style={INPUT_STYLE} />
              </AppFormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <AppFormField label="M² patio de maniobras">
                  <input value={bodegaPatioSqm} onChange={(e) => setBodegaPatioSqm(e.target.value)} type="number" min={0} placeholder="Ej: 120" style={INPUT_STYLE} />
                </AppFormField>
                <AppFormField label="Número de rampas">
                  <input value={bodegaRampas} onChange={(e) => setBodegaRampas(e.target.value)} type="number" min={0} placeholder="Ej: 2" style={INPUT_STYLE} />
                </AppFormField>
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setIsCreateBodegaOpen(false)} disabled={savingBodega}>Cancelar</UiButton>
            <UiButton type="submit" disabled={savingBodega}>{savingBodega ? "Guardando..." : isPlazaComercial ? "Crear local" : "Crear bodega"}</UiButton>
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

      {/* ══════════════════════════════════════════════════════════════
          TAB: ÁREAS COMUNES
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "common_areas" && hasCommonAreasTab && (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionCard
            title="Áreas comunes"
            icon={<Trees size={18} />}
            action={
              <UiButton variant="primary" icon={<Plus size={14} />} onClick={() => { setNewCommonAreaName(""); setAddingCommonArea(true); }}>
                Agregar área común
              </UiButton>
            }
          >
            {commonAreas.length === 0 ? (
              <AppEmptyState
                title="Sin áreas comunes registradas"
                description="Registra jardines, roof garden, gimnasio, alberca u otros espacios compartidos."
                actionLabel="+ Agregar área común"
                onAction={() => { setNewCommonAreaName(""); setAddingCommonArea(true); }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {commonAreas.map((area) => (
                  <div key={area.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--bg-page)",
                  }}>
                    <Trees size={14} color="#15803d" />
                    <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{area.name}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Modal: agregar área común ── */}
      <Modal open={addingCommonArea} onClose={() => { if (!savingCommonArea) setAddingCommonArea(false); }} title="Agregar área común">
        <AppFormField label="Nombre del área" required>
          <input
            value={newCommonAreaName}
            onChange={(e) => setNewCommonAreaName(e.target.value)}
            placeholder="Ej: Jardín, Roof garden, Gimnasio..."
            style={INPUT_STYLE}
          />
        </AppFormField>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <UiButton
            variant="primary"
            disabled={savingCommonArea || !newCommonAreaName.trim()}
            onClick={async () => {
              if (!building || !newCommonAreaName.trim()) return;
              setSavingCommonArea(true);
              await supabase.from("common_areas").insert({ building_id: building.id, name: newCommonAreaName.trim() });
              const { data } = await supabase.from("common_areas").select("id, name").eq("building_id", building.id).is("deleted_at", null).order("created_at");
              setCommonAreas((data || []) as { id: string; name: string }[]);
              setSavingCommonArea(false);
              setAddingCommonArea(false);
            }}
          >
            {savingCommonArea ? "Guardando..." : "Guardar"}
          </UiButton>
          <UiButton onClick={() => { if (!savingCommonArea) setAddingCommonArea(false); }}>Cancelar</UiButton>
        </div>
      </Modal>

      {/* ── Modal de configuración de features ── */}
      <Modal
        open={isFeaturesModalOpen}
        onClose={() => setIsFeaturesModalOpen(false)}
        title="Configuración de la propiedad"
      >
        {(() => {
          const applicableFeatures  = getDefaultFeatures(building?.building_category ?? "");
          const toggleableFeatures  = applicableFeatures.filter((f) => f.key !== "general_setup");
          const spaceFeatures   = toggleableFeatures.filter((f) => f.category === "space");
          const serviceFeatures = toggleableFeatures.filter((f) => f.category === "service");

          const PENDING_HINTS: Record<string, { text: string; tab?: string; path?: string }> = {
            electricity: { text: "Sin medidores configurados → Ir a Servicios",  tab: "services" },
            water:       { text: "Sin medidor de agua → Ir a Servicios",          tab: "services" },
            gas:         { text: "Sin medidor de gas → Ir a Servicios",           tab: "services" },
            internet:    { text: "Sin servicio configurado → Ir a Servicios",     tab: "services" },
            units:       { text: "Sin unidades registradas → Ir a Unidades",      tab: "overview" },
            parking:     { text: "Sin cajones registrados → Ir a Cajones",        tab: "parking"  },
            cleaning:    { text: "Sin schedules configurados → Ir a Limpieza",    path: "/cleaning" },
          };

          function ToggleRow({ feat }: { feat: typeof applicableFeatures[number] }) {
            const FeatIcon = FEATURE_ICON_MAP[feat.icon];
            const config   = featureConfigs.find((c) => c.feature_key === feat.key);
            const isActive = config?.is_active ?? false;
            const isSaving = savingFeatureKey === feat.key;
            const status   = featureStatus[feat.key] ?? "unchecked";
            const hint     = PENDING_HINTS[feat.key];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
                    {FeatIcon && <span style={{ flexShrink: 0, marginTop: 2, lineHeight: 0 }}><FeatIcon size={15} color={feat.color} /></span>}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{feat.label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>{feat.description}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {isActive && status === "ok" && (
                      <span title="Configurado" style={{ lineHeight: 0 }}>
                        <CheckCircle2 size={14} color="#1D9E75" />
                      </span>
                    )}
                    {isActive && status === "pending" && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <AlertCircle size={14} color="#EF9F27" />
                        <span style={{ fontSize: 10, color: "#EF9F27", fontWeight: 600 }}>Pendiente</span>
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleToggleFeature(feat.key)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: isActive ? feat.color : "#e5e7eb",
                        border: "none", cursor: isSaving ? "wait" : "pointer",
                        position: "relative", transition: "background 0.2s", padding: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3, left: isActive ? 23 : 3,
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>
                </div>
                {isActive && status === "pending" && hint && (
                  <p style={{ margin: 0, fontSize: 11, color: "#EF9F27", paddingLeft: 23 }}>
                    {hint.text.split("→")[0].trim()}{" → "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsFeaturesModalOpen(false);
                        if (hint.tab) {
                          setActiveTab(hint.tab);
                          setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
                        } else if (hint.path) {
                          router.push(hint.path);
                        }
                      }}
                      style={{ background: "none", border: "none", color: "#EF9F27", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                    >
                      {hint.text.split("→")[1]?.trim()}
                    </button>
                  </p>
                )}
              </div>
            );
          }

          return (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Sección: Espacios físicos */}
                {spaceFeatures.length > 0 && (
                  <div style={{ background: "var(--bg-page)", borderRadius: 12, padding: 16, border: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Building2 size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Espacios físicos</p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Construcciones e instalaciones de la propiedad</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {spaceFeatures.map((feat) => <ToggleRow key={feat.key} feat={feat} />)}
                    </div>
                  </div>
                )}

                {/* Sección: Servicios */}
                {serviceFeatures.length > 0 && (
                  <div style={{ background: "var(--bg-page)", borderRadius: 12, padding: 16, border: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Zap size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Servicios</p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Suministros y servicios operativos activos</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {serviceFeatures.map((feat) => <ToggleRow key={feat.key} feat={feat} />)}
                    </div>
                  </div>
                )}
              </div>

              {featureWarnToast && (
                <div style={{
                  marginTop: 16, padding: "10px 14px", borderRadius: 10,
                  background: "#fff7ed", border: "1px solid #fed7aa",
                  color: "#c2410c", fontSize: 13, fontWeight: 500,
                }}>
                  {featureWarnToast}
                </div>
              )}

              {featureToast && (
                <div style={{
                  marginTop: 16, padding: "10px 14px", borderRadius: 10,
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  color: "#15803d", fontSize: 13, fontWeight: 500,
                }}>
                  {featureToast}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <UiButton type="button" onClick={() => setIsFeaturesModalOpen(false)}>Cerrar</UiButton>
              </div>
            </>
          );
        })()}
      </Modal>

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

      {/* ── Modal agregar área de superficie ── */}
      <Modal
        open={areaCreateOpen}
        onClose={() => { setAreaCreateOpen(false); setAreaMsg(""); }}
        title="Agregar área"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
              Tipo de área
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {getAreaTypesForCategory(building.building_category).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewAreaType(t)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    border: newAreaType === t ? "2px solid var(--accent)" : "1px solid var(--border-default)",
                    background: newAreaType === t ? "var(--icon-bg-blue)" : "var(--bg-card)",
                    color: newAreaType === t ? "var(--badge-text-blue)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {AREA_TYPE_LABELS[t] ?? t}
                </button>
              ))}
            </div>
          </div>
          {newAreaType === "otro" ? (
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                Descripción personalizada
              </label>
              <input
                value={newAreaLabel}
                onChange={(e) => setNewAreaLabel(e.target.value)}
                style={INPUT_STYLE}
                placeholder="Ej. Bodega de materiales"
              />
            </div>
          ) : null}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
              M²
            </label>
            <input
              value={newAreaSqm}
              onChange={(e) => setNewAreaSqm(e.target.value.replace(/[^\d.]/g, ""))}
              style={INPUT_STYLE}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
          {areaMsg ? (
            <div style={{ color: "var(--badge-text-red)", fontSize: 13, fontWeight: 600 }}>{areaMsg}</div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <UiButton variant="secondary" onClick={() => { setAreaCreateOpen(false); setAreaMsg(""); }}>
              Cancelar
            </UiButton>
            <UiButton onClick={() => void handleCreateArea()} disabled={savingArea}>
              {savingArea ? "Guardando..." : "Guardar"}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal editar local ── */}
      <Modal
        open={editingLocal !== null}
        onClose={() => { if (!savingLocal) setEditingLocal(null); }}
        title="Editar local"
      >
        <form onSubmit={(e) => void handleSaveLocal(e)}>
          <div style={{ display: "grid", gap: 14 }}>
            <AppFormField label="Nombre del local" required>
              <input
                value={editLocalName}
                onChange={e => setEditLocalName(e.target.value)}
                placeholder="Ej. Local 1"
                style={INPUT_STYLE}
              />
            </AppFormField>
            <AppFormField label="Código">
              <input
                value={editLocalCode}
                onChange={e => setEditLocalCode(e.target.value)}
                placeholder="Ej. L-01"
                style={INPUT_STYLE}
              />
            </AppFormField>
            <AppFormField label="M²">
              <input
                type="number" min={0} step="0.01"
                value={editLocalSqm}
                onChange={e => setEditLocalSqm(e.target.value)}
                placeholder="Ej. 85"
                style={INPUT_STYLE}
              />
            </AppFormField>
            {editLocalMsg ? <p style={{ color: "var(--badge-text-red)", fontSize: 13, margin: 0 }}>{editLocalMsg}</p> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <UiButton type="button" variant="secondary" onClick={() => setEditingLocal(null)} disabled={savingLocal}>Cancelar</UiButton>
              <UiButton type="submit" variant="primary" disabled={savingLocal}>{savingLocal ? "Guardando..." : "Guardar"}</UiButton>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Confirmar eliminar local ── */}
      <DeleteConfirmModal
        open={deletingLocal !== null}
        title="Eliminar local"
        description={deletingLocal ? `¿Eliminar ${deletingLocal.unit_number}? Esta acción lo ocultará del sistema.` : ""}
        confirmText={confirmingDeleteLocal ? "Eliminando..." : "Eliminar local"}
        onConfirm={() => void handleDeleteLocal()}
        onCancel={() => { if (!confirmingDeleteLocal) setDeletingLocal(null); }}
      />

      {/* ── Modal duplicar local ── */}
      <Modal
        open={duplicatingLocal !== null}
        onClose={() => { if (!dupLocalSaving) { setDuplicatingLocal(null); setDupLocalCount(1); } }}
        title="Duplicar local"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            ¿Cuántas copias quieres crear de <strong>{duplicatingLocal?.unit_number}</strong>?
          </p>
          <AppFormField label="Cantidad de copias">
            <input
              type="number"
              min={1}
              max={50}
              value={dupLocalCount}
              onChange={e => setDupLocalCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              style={INPUT_STYLE}
            />
          </AppFormField>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <UiButton variant="secondary" disabled={dupLocalSaving} onClick={() => { setDuplicatingLocal(null); setDupLocalCount(1); }}>
              Cancelar
            </UiButton>
            <UiButton variant="primary" disabled={dupLocalSaving} onClick={() => void handleDuplicateLocal()}>
              {dupLocalSaving ? "Duplicando..." : `Duplicar${dupLocalCount > 1 ? ` (${dupLocalCount})` : ""}`}
            </UiButton>
          </div>
        </div>
      </Modal>

    </PageContainer>
  );
}
