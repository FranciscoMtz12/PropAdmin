"use client";

/*
  Página principal de edificios — diseño v2.

  Cambios visuales vs v1:
  - Cards de edificio completamente rediseñadas:
    · Toda la card es clickeable (navega al detalle)
    · Dona SVG de ocupación en la esquina superior derecha
    · Fila de stats inferior: Total / Ocupados / Libres
    · Hover: translateY(-2px) + sombra + "Ver detalle →"
  - Métricas superiores ahora muestran:
    · Total edificios · Edificios al ≥75% · Ocupación promedio · Unidades portafolio
  - Se cargan units + leases ACTIVE para calcular ocupación real

  Funcionalidad CRUD intacta: crear / editar / eliminar edificio.
*/

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Briefcase,
  Building2,
  Car,
  CheckSquare,
  Droplets,
  Edit3,
  Factory,
  Filter,
  Flame,
  Home,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Trash2,
  Trees,
  Truck,
  Warehouse,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppSelect from "@/components/AppSelect";
import AppFormField from "@/components/AppFormField";
import AppEmptyState from "@/components/AppEmptyState";
import {
  getPropertyType,
  PROPERTY_TYPES,
  BUILDING_FEATURES,
} from "@/lib/property-types";
import { PROPERTY_FEATURES, getDefaultFeatures } from "@/lib/property-features";
import {
  INPUT_STYLE,
  dropdownTriggerStyle,
  dropdownMenuStyle,
  dropdownActionButtonStyle,
  dropdownDeleteItemStyle,
  warnBannerStyle,
  errorBannerStyle,
} from "@/lib/pageStyles";

const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  Building2, Home, Store, Warehouse, Factory, MapPin,
};

const FEATURE_ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  LayoutGrid, Car, Shield, Briefcase, Truck, Trees, Package,
  Zap, Droplets, Flame, Wifi, ShieldCheck, Sparkles, Wrench, CheckSquare,
};

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
  total_sqm: number | null;
  building_tags: string[] | null;
  building_features: Record<string, boolean> | null;
  parent_building_id: string | null;
  land_sqm: number | null;
  construction_sqm: number | null;
  default_unit_sqm: number | null;
};

type UnitForTrend = {
  id: string;
  building_id: string;
  created_at: string;
  status: string | null;
};

type LeaseForTrend = {
  unit_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type TrendPoint = {
  label: string;
  total: number;
  occupied: number;
  pct: number;
};

/* ─── Componente: dona SVG de ocupación ─────────────────────────────── */

function OccupancyDonut({
  totalUnits,
  activeLeases,
  size = 64,
}: {
  totalUnits: number;
  activeLeases: number;
  size?: number;
}) {
  const pct = totalUnits > 0 ? Math.round((activeLeases / totalUnits) * 100) : 0;
  const color =
    totalUnits === 0 ? "#E5E7EB"
    : pct >= 75 ? "#10B981"
    : pct >= 40 ? "#F59E0B"
    : "#EF4444";

  const half = size / 2;
  const r    = Math.round(size * 0.375); // 24 @ 64px
  const sw   = Math.round(size * 0.125); // 8  @ 64px
  const circ = 2 * Math.PI * r;
  const offset = totalUnits === 0 ? circ : circ - (pct / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={half} cy={half} r={r} fill="none" stroke="#E5E7EB" strokeWidth={sw} />
        <circle
          cx={half} cy={half} r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: `${half}px ${half}px` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <span style={{ fontSize: Math.round(size * 0.2), fontWeight: 600, lineHeight: 1, color: "var(--text-primary)" }}>
          {pct}%
        </span>
        <span style={{ fontSize: Math.round(size * 0.14), color: "var(--text-muted)", lineHeight: 1.2 }}>
          ocup.
        </span>
      </div>
    </div>
  );
}

const errorTextStyle: React.CSSProperties = {
  color: "#EF4444",
  fontSize: 12,
  marginTop: 4,
  marginBottom: 0,
};

const buildingSchema = z.object({
  name: z.string().min(1, "El nombre del edificio es obligatorio"),
  code: z.string().optional(),
  address: z.string().optional(),
  building_category: z.string().min(1, "Selecciona una categoría"),
  building_subcategory: z.string().optional(),
  /* Coordenadas opcionales para el mapa. Se guardan como string y
     se convierten a number en el submit (evita incompatibilidades
     de tipos entre zod preprocess y react-hook-form). */
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  building_tags: z.array(z.string()).optional(),
  building_features: z.record(z.string(), z.boolean()).optional(),
  land_sqm: z.string().optional(),
  construction_sqm: z.string().optional(),
  default_unit_sqm: z.string().optional(),
});
type BuildingFormValues = z.infer<typeof buildingSchema>;

const BUILDING_DEFAULTS: BuildingFormValues = {
  name: "",
  code: "",
  address: "",
  building_category: "residential_multi",
  building_subcategory: "",
  latitude: "",
  longitude: "",
  building_tags: [],
  building_features: {},
  land_sqm: "",
  construction_sqm: "",
  default_unit_sqm: "",
};

/* LocationPicker — importación dinámica (ssr: false) porque usa Leaflet. */
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 340,
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
      Cargando selector de ubicación...
    </div>
  ),
});

/* ─── Página ─────────────────────────────────────────────────────────── */

export default function BuildingsPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  /* Estado de datos */
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [unitCountByBuilding, setUnitCountByBuilding] = useState<Map<string, number>>(new Map());
  const [occupiedByBuilding, setOccupiedByBuilding] = useState<Map<string, number>>(new Map());
  const [vacantByBuilding, setVacantByBuilding] = useState<Map<string, number>>(new Map());
  const [activeLeasesCountByBuilding, setActiveLeasesCountByBuilding] = useState<Map<string, number>>(new Map());
  const [allUnitsForTrend, setAllUnitsForTrend] = useState<UnitForTrend[]>([]);
  const [allLeasesForTrend, setAllLeasesForTrend] = useState<LeaseForTrend[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [msg, setMsg] = useState("");

  /* Estado de modales */
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [buildingEditingId, setBuildingEditingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Estado de formulario */
  const {
    register,
    handleSubmit: rhfSubmit,
    reset,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: BUILDING_DEFAULTS,
  });

  /* Estado del modal de creación en 2 pasos */
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [selectedFeatureKeys, setSelectedFeatureKeys] = useState<string[]>([]);
  const buildingCategory = watch("building_category");
  const buildingTags = watch("building_tags") ?? [];
  const buildingFeatures = watch("building_features") ?? {};

  /* Multi-type selection: primary type = building_category, secondary = building_tags filtered to type values */
  const PROPERTY_TYPE_VALUES: string[] = PROPERTY_TYPES.map((pt) => pt.value);
  const selectedTypeTags = (buildingTags as string[]).filter(
    (t) => PROPERTY_TYPE_VALUES.includes(t) && t !== buildingCategory,
  );
  const selectedTypes = [
    ...(PROPERTY_TYPE_VALUES.includes(buildingCategory) ? [buildingCategory] : []),
    ...selectedTypeTags,
  ];

  const FEATURES_TYPES = ["commercial", "industrial", "industrial_park"];
  const showFeatures = selectedTypes.some((t) => FEATURES_TYPES.includes(t));

  function toggleTypeSelection(value: string) {
    const primary = getValues("building_category") as string;
    const secTags = ((getValues("building_tags") as string[]) ?? []).filter((t) => PROPERTY_TYPE_VALUES.includes(t));
    const all = [primary, ...secTags];

    if (all.includes(value)) {
      if (value === primary) {
        if (secTags.length === 0) return; // min 1 — can't deselect the only one
        setValue("building_category", secTags[0]);
        setValue("building_tags", secTags.slice(1));
      } else {
        setValue("building_tags", secTags.filter((t) => t !== value));
      }
    } else {
      if (all.length >= 3) return; // max 3
      setValue("building_tags", [...secTags, value]);
    }
  }

  function toggleFeature(key: string) {
    const current = (getValues("building_features") as Record<string, boolean>) ?? {};
    setValue("building_features", { ...current, [key]: !current[key] });
  }

  /* Coordenadas observadas como números (o null si están vacías/no válidas). */
  const latitudeStr  = watch("latitude");
  const longitudeStr = watch("longitude");
  const latitudeNum  = latitudeStr  && latitudeStr.trim()  ? Number(latitudeStr)  : null;
  const longitudeNum = longitudeStr && longitudeStr.trim() ? Number(longitudeStr) : null;
  const latitudeForPicker  = latitudeNum  !== null && Number.isFinite(latitudeNum)  ? latitudeNum  : null;
  const longitudeForPicker = longitudeNum !== null && Number.isFinite(longitudeNum) ? longitudeNum : null;

  /* Callback del LocationPicker → sincroniza con el form. */
  function handleLocationChange(lat: number, lng: number, address?: string) {
    setValue("latitude", String(lat));
    setValue("longitude", String(lng));
    /* Sugerir la dirección sólo si el campo está vacío (no sobrescribir input del usuario). */
    if (address && !getValues("address")?.trim()) {
      setValue("address", address);
    }
  }

  /* Hover + dropdown de acciones por card */
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [openActionsBuildingId, setOpenActionsBuildingId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  /* Redirigir si no hay sesión */
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  /* Cerrar dropdown al hacer click fuera */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(e.target as Node)) {
        setOpenActionsBuildingId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Limpiar elegibilidad cuando se cierra modal de eliminar */
  useEffect(() => {
    if (!buildingToDelete) setDeleteError(null);
  }, [buildingToDelete]);

  /* ── Carga de datos ─────────────────────────────────────────────── */

  const loadBuildings = useCallback(async () => {
    if (!user?.company_id) return;
    setLoadingBuildings(true);

    /* 1. Edificios */
    const { data, error } = await supabase
      .from("buildings")
      .select("id, company_id, name, address, code, building_category, building_subcategory, latitude, longitude, total_sqm, building_tags, building_features, parent_building_id, land_sqm, construction_sqm, default_unit_sqm")
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .is("parent_building_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("No se pudieron cargar los edificios.");
      setLoadingBuildings(false);
      return;
    }

    const loadedBuildings = (data as Building[]) || [];
    setBuildings(loadedBuildings);

    if (loadedBuildings.length === 0) {
      setUnitCountByBuilding(new Map());
      setActiveLeasesCountByBuilding(new Map());
      setLoadingBuildings(false);
      return;
    }

    const buildingIds = loadedBuildings.map((b) => b.id);

    /* 2. Unidades de todos los edificios — incluye status para ocupación real */
    const { data: unitsData } = await supabase
      .from("units")
      .select("id, building_id, created_at, status")
      .in("building_id", buildingIds)
      .is("deleted_at", null);

    const units = (unitsData || []) as UnitForTrend[];

    /* Mapa building_id → cantidad de unidades */
    const unitCounts = new Map<string, number>();
    /* Ocupados por status (RENTED, OCCUPIED, PARTIAL) */
    const occupiedCounts = new Map<string, number>();
    /* Vacantes por status */
    const vacantCounts = new Map<string, number>();
    /* Mapa unit_id → building_id (para cruzar con leases) */
    const unitBuildingMap = new Map<string, string>();
    units.forEach((u) => {
      unitCounts.set(u.building_id, (unitCounts.get(u.building_id) || 0) + 1);
      const s = (u.status || "").toUpperCase();
      if (s === "RENTED" || s === "OCCUPIED" || s === "PARTIAL") {
        occupiedCounts.set(u.building_id, (occupiedCounts.get(u.building_id) || 0) + 1);
      }
      if (s === "VACANT") {
        vacantCounts.set(u.building_id, (vacantCounts.get(u.building_id) || 0) + 1);
      }
      unitBuildingMap.set(u.id, u.building_id);
    });
    setUnitCountByBuilding(unitCounts);
    setOccupiedByBuilding(occupiedCounts);
    setVacantByBuilding(vacantCounts);
    setAllUnitsForTrend(units);

    /* 3. Leases activos + datos de tendencia */
    const unitIds = units.map((u) => u.id);
    const leaseCounts = new Map<string, number>();

    if (unitIds.length > 0) {
      const [{ data: leasesActiveData }, { data: leasesTrendData }] = await Promise.all([
        supabase
          .from("leases")
          .select("unit_id")
          .in("unit_id", unitIds)
          .eq("status", "ACTIVE")
          .is("deleted_at", null),
        supabase
          .from("leases")
          .select("unit_id, start_date, end_date, created_at")
          .in("unit_id", unitIds)
          .is("deleted_at", null),
      ]);

      (leasesActiveData || []).forEach((l: { unit_id: string }) => {
        const bid = unitBuildingMap.get(l.unit_id);
        if (bid) leaseCounts.set(bid, (leaseCounts.get(bid) || 0) + 1);
      });

      setAllLeasesForTrend((leasesTrendData || []) as LeaseForTrend[]);
    } else {
      setAllLeasesForTrend([]);
    }

    setActiveLeasesCountByBuilding(leaseCounts);
    setLoadingBuildings(false);
  }, [user]);

  useEffect(() => {
    if (user?.company_id) void loadBuildings();
  }, [loadBuildings, user?.company_id]);

  /* ── Métricas del portafolio ─────────────────────────────────────── */

  const portfolioStats = useMemo(() => {
    const total = buildings.length;

    const occupancies = buildings.map((b) => {
      const totalU = unitCountByBuilding.get(b.id) || 0;
      const active = occupiedByBuilding.get(b.id) || 0;
      return totalU > 0 ? (active / totalU) * 100 : 0;
    });

    const highOccupancy = buildings.filter((_, i) => (occupancies[i] || 0) >= 75).length;
    const avgOccupancy =
      total > 0 ? Math.round(occupancies.reduce((a, c) => a + c, 0) / total) : 0;

    let totalPortfolioUnits = 0;
    unitCountByBuilding.forEach((count) => {
      totalPortfolioUnits += count;
    });

    return { total, highOccupancy, avgOccupancy, totalPortfolioUnits };
  }, [buildings, unitCountByBuilding, activeLeasesCountByBuilding]);

  /* ── Tendencia del portafolio (últimos 12 meses) ────────────────── */

  const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  function getLastNMonths(n: number): Array<{ year: number; month: number; label: string }> {
    const result = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(), // 0-indexed
        label: `${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      });
    }
    return result;
  }

  const portfolioTrend = useMemo<TrendPoint[]>(() => {
    if (allUnitsForTrend.length === 0) return [];
    const months = getLastNMonths(12);
    return months.map(({ year, month, label }) => {
      const firstDay = new Date(year, month, 1);
      const lastDay  = new Date(year, month + 1, 0, 23, 59, 59);

      const total = allUnitsForTrend.filter((u) => {
        return new Date(u.created_at) <= lastDay;
      }).length;

      const occupied = allLeasesForTrend.filter((l) => {
        const start = new Date((l.start_date || l.created_at) as string);
        const end   = l.end_date ? new Date(l.end_date) : null;
        return start <= lastDay && (!end || end >= firstDay);
      }).length;

      const pct = total > 0 ? Math.round((Math.min(occupied, total) / total) * 100) : 0;
      return { label, total, occupied: Math.min(occupied, total), pct };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUnitsForTrend, allLeasesForTrend]);

  const hasPortfolioTrend = portfolioTrend.some((p) => p.total > 0);

  /* Edificios filtrados por categoría y ordenados alfabéticamente (orden natural) */
  const filteredBuildings = useMemo(
    () =>
      buildings
        .filter((b) => selectedCategory === "ALL" || b.building_category === selectedCategory)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" })
        ),
    [buildings, selectedCategory]
  );

  /* ── Handlers de formulario ─────────────────────────────────────── */

  function resetForm() {
    reset(BUILDING_DEFAULTS);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setCreateStep(1);
    setSelectedFeatureKeys([]);
    resetForm();
  }

  async function handleNextStep() {
    const isValid = await trigger(["name", "building_category"]);
    if (!isValid) return;
    const primaryType = getValues("building_category");
    setSelectedFeatureKeys(getDefaultFeatures(primaryType).map((f) => f.key));
    setCreateStep(2);
  }

  function toggleFeatureSelection(key: string) {
    setSelectedFeatureKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function openEditModal(building: Building) {
    setBuildingEditingId(building.id);

    // Combinar category + tags, filtrar valores inválidos y deduplicar con Set
    const rawTypes = [building.building_category, ...(building.building_tags ?? [])].filter(
      (t): t is string => !!t && PROPERTY_TYPE_VALUES.includes(t),
    );
    const dedupedTypes = [...new Set(rawTypes)];
    const initTypes = dedupedTypes.length > 0 ? dedupedTypes : ["residential"];

    reset({
      name: building.name || "",
      code: building.code || "",
      address: building.address || "",
      building_category: initTypes[0],
      building_subcategory: building.building_subcategory || "",
      latitude: building.latitude != null ? String(building.latitude) : "",
      longitude: building.longitude != null ? String(building.longitude) : "",
      building_tags: initTypes.slice(1),
      building_features: building.building_features ?? {},
      land_sqm: building.land_sqm != null ? String(building.land_sqm) : "",
      construction_sqm: building.construction_sqm != null ? String(building.construction_sqm) : "",
      default_unit_sqm: building.default_unit_sqm != null ? String(building.default_unit_sqm) : "",
    });
    setIsEditModalOpen(true);
    setOpenActionsBuildingId(null);
    setMsg("");
  }

  function closeEditModal() {
    if (isSubmitting) return;
    setIsEditModalOpen(false);
    setBuildingEditingId(null);
    resetForm();
  }

  function openDeleteModal(building: Building) {
    setBuildingToDelete(building);
    setIsDeleteModalOpen(true);
    setOpenActionsBuildingId(null);
    setMsg("");
    setDeleteError(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setBuildingToDelete(null);
    setDeleteError(null);
  }

  const handleSubmitBuilding = rhfSubmit(async (data) => {
    if (createStep !== 2) return;
    setMsg("");
    if (!user?.company_id) { setMsg("No se encontró la empresa del usuario."); return; }

    const { data: newBuilding, error } = await supabase.from("buildings").insert({
      company_id: user.company_id,
      name: data.name.trim(),
      code: data.code?.trim() || null,
      address: data.address?.trim() || null,
      building_category: data.building_category,
      building_subcategory: null,
      latitude: data.latitude && data.latitude.trim() ? Number(data.latitude) : null,
      longitude: data.longitude && data.longitude.trim() ? Number(data.longitude) : null,
      building_tags: data.building_tags?.length ? data.building_tags : null,
      building_features: data.building_features && Object.keys(data.building_features).length ? data.building_features : null,
      land_sqm: data.land_sqm && data.land_sqm.trim() ? Number(data.land_sqm) : null,
      construction_sqm: data.construction_sqm && data.construction_sqm.trim() ? Number(data.construction_sqm) : null,
      default_unit_sqm: data.building_category !== "land" && data.building_category !== "residential_single" && data.default_unit_sqm && data.default_unit_sqm.trim() ? Number(data.default_unit_sqm) : null,
    }).select("id").single();
    if (error || !newBuilding) { setMsg(error?.message ?? "Error al crear el edificio."); return; }

    const newBuildingId = newBuilding.id;

    if (selectedFeatureKeys.length > 0) {
      await supabase.from("building_feature_config").insert(
        selectedFeatureKeys.map((key) => {
          const feat = PROPERTY_FEATURES.find((f) => f.key === key);
          return {
            building_id: newBuildingId,
            company_id: user.company_id,
            feature_key: key,
            feature_category: feat?.category ?? "service",
            is_active: true,
          };
        })
      );

      const taskRows = selectedFeatureKeys.flatMap((key) => {
        const feat = PROPERTY_FEATURES.find((f) => f.key === key);
        return (feat?.tasks ?? []).map((task) => ({
          building_id: newBuildingId,
          company_id: user.company_id,
          task_key: task.key,
          feature_key: key,
          is_completed: false,
        }));
      });
      if (taskRows.length > 0) {
        await supabase.from("building_setup_tasks").insert(taskRows);
      }
    }

    setMsg("Edificio guardado correctamente.");
    closeCreateModal();
    await loadBuildings();
  });

  const handleUpdateBuilding = rhfSubmit(async (data) => {
    if (!user?.company_id || !buildingEditingId) {
      setMsg("No se encontró el edificio a editar.");
      return;
    }
    setMsg("");
    const { error } = await supabase
      .from("buildings")
      .update({
        name: data.name.trim(),
        code: data.code?.trim() || null,
        address: data.address?.trim() || null,
        building_category: data.building_category,
        building_subcategory: null,
        latitude: data.latitude && data.latitude.trim() ? Number(data.latitude) : null,
        longitude: data.longitude && data.longitude.trim() ? Number(data.longitude) : null,
        building_tags: data.building_tags?.length ? data.building_tags : null,
        building_features: data.building_features && Object.keys(data.building_features).length ? data.building_features : null,
        land_sqm: data.land_sqm && data.land_sqm.trim() ? Number(data.land_sqm) : null,
        construction_sqm: data.construction_sqm && data.construction_sqm.trim() ? Number(data.construction_sqm) : null,
        default_unit_sqm: data.building_category !== "land" && data.building_category !== "residential_single" && data.default_unit_sqm && data.default_unit_sqm.trim() ? Number(data.default_unit_sqm) : null,
      })
      .eq("id", buildingEditingId)
      .eq("company_id", user.company_id);
    if (error) { setMsg(`No se pudo actualizar el edificio. ${error.message}`); return; }
    closeEditModal();
    await loadBuildings();
    setMsg("Edificio actualizado correctamente.");
  });

  async function handleDeleteBuilding() {
    if (!user?.company_id || !buildingToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("buildings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", buildingToDelete.id)
      .eq("company_id", user.company_id);
    if (error) {
      setDeleteError(`No se pudo eliminar el edificio. ${error.message}`);
      setDeleting(false);
      return;
    }
    setIsDeleteModalOpen(false);
    setBuildingToDelete(null);
    setDeleting(false);
    setMsg("Edificio archivado correctamente.");
    await loadBuildings();
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  if (loading) return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user) return null;

  return (
    <PageContainer>
      {/* Encabezado */}
      <PageHeader
        title="Propiedades"
        titleIcon={<Building2 size={20} />}
        actions={
          <>
            <UiButton href="/dashboard">Ir al dashboard</UiButton>
            <UiButton href="/buildings/map">
              <MapIcon size={16} />
              Ver mapa
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nueva propiedad
            </UiButton>
          </>
        }
      />

      {/* Mensaje de feedback */}
      {msg ? (
        <p
          style={{
            color: msg.includes("correctamente")
              ? "var(--badge-text-green)"
              : "var(--badge-text-red)",
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {msg}
        </p>
      ) : null}

      {/* ── Métricas del portafolio ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <MetricCard
          label="Total de propiedades"
          value={portfolioStats.total}
          icon={<Warehouse size={18} />}
          helper="Portafolio actual"
        />
        <MetricCard
          label="Al 75 %+ de ocupación"
          value={portfolioStats.highOccupancy}
          icon={<Building2 size={18} />}
          helper="Propiedades en alta ocupación"
          variant="green"
        />
        <MetricCard
          label="Ocupación promedio"
          value={`${portfolioStats.avgOccupancy}%`}
          icon={<TrendingUp size={18} />}
          helper="Promedio del portafolio"
        />
        <MetricCard
          label="Unidades en portafolio"
          value={portfolioStats.totalPortfolioUnits}
          icon={<Home size={18} />}
          helper="Total de departamentos"
        />
      </div>

      {/* ── Lista de edificios ── */}
      <SectionCard
        title="Portafolio"
        icon={<Filter size={18} />}
        action={
          <div style={{ minWidth: 220 }}>
            <AppSelect
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">Todas las categorías</option>
              {PROPERTY_TYPES.map((pt, index) => (
                <option key={`${pt.value}-${index}`} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </AppSelect>
          </div>
        }
      >
        {loadingBuildings ? (
          <p style={{ margin: 0 }}>Cargando edificios...</p>
        ) : filteredBuildings.length === 0 ? (
          <AppEmptyState
            title="Todavía no hay edificios"
            description="Empieza creando tu primer edificio para construir el portafolio dentro de PropAdmin."
            actionLabel="Nueva propiedad"
            onAction={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <div
            className="buildings-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              width: "100%",
              maxWidth: "100%",
            }}
          >
            {filteredBuildings.map((building, index) => {
              const totalUnits = unitCountByBuilding.get(building.id) || 0;
              const activeLeases = occupiedByBuilding.get(building.id) || 0;
              const freeUnits = vacantByBuilding.get(building.id) || 0;
              const isHovered = hoveredBuildingId === building.id;

              return (
                <motion.div
                  key={building.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.06 }}
                  style={{ overflow: "visible", position: "relative", width: "100%", maxWidth: "100%", minWidth: 0 }}
                >
                {/* Wrapper clickeable — toda la card navega al detalle */}
                <div
                  onClick={() => router.push(`/buildings/${building.id}`)}
                  onMouseEnter={() => setHoveredBuildingId(building.id)}
                  onMouseLeave={() => setHoveredBuildingId(null)}
                  style={{
                    cursor: "pointer",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    transition: "transform 0.15s ease",
                    borderRadius: 16,
                    overflow: "visible",
                    position: "relative",
                    zIndex: openActionsBuildingId === building.id ? 100 : 1,
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                  }}
                >
                  {/* Card — divs inline, sin CSS classes que pisen estilos */}
                  <div
                    style={{
                      border: "1px solid var(--border-default)",
                      borderRadius: 16,
                      padding: 16,
                      background: "var(--bg-card)",
                      boxShadow: isHovered
                        ? "0 8px 24px rgba(0,0,0,0.13)"
                        : "var(--shadow-card)",
                      transition: "box-shadow 0.15s ease, background 0.2s, border-color 0.2s",
                      width: "100%",
                      maxWidth: "100%",
                      minWidth: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Fila superior: info izq + dona der */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        overflow: "visible",
                        marginBottom: 10,
                      }}
                    >
                      {/* Info — flex:1 con truncado */}
                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {building.name}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            marginBottom: 8,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {building.address || "Sin dirección registrada"}
                        </p>
                        {(() => {
                          const typeTags = (building.building_tags ?? []).filter(
                            (t) => PROPERTY_TYPE_VALUES.includes(t),
                          );
                          if (typeTags.length > 0) {
                            const allTypes = [building.building_category, ...typeTags].filter(
                              (t): t is string => !!t && PROPERTY_TYPE_VALUES.includes(t),
                            );
                            const dedupedTypes = [...new Set(allTypes)].slice(0, 3);
                            return (
                              <div>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  fontSize: 11, fontWeight: 600, padding: "2px 8px",
                                  borderRadius: 999, background: "#37415115", color: "#374151",
                                }}>
                                  Uso mixto
                                </span>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                                  {dedupedTypes.map((typeValue) => {
                                    const typeDef = PROPERTY_TYPES.find((t) => t.value === typeValue);
                                    if (!typeDef) return null;
                                    const TypeIcon = ICON_MAP[typeDef.icon];
                                    return (
                                      <span key={typeValue} style={{
                                        display: "inline-flex", alignItems: "center", gap: 3,
                                        fontSize: 10, padding: "1px 6px", borderRadius: 999,
                                        background: typeDef.color + "1a", color: typeDef.color, fontWeight: 500,
                                      }}>
                                        {TypeIcon && <TypeIcon size={10} />}
                                        {typeDef.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          const pt = getPropertyType(building.building_category);
                          const PtIcon = ICON_MAP[pt.icon];
                          return (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 11, fontWeight: 600, padding: "2px 8px",
                              borderRadius: 999, background: pt.color + "1a", color: pt.color,
                            }}>
                              {PtIcon && <PtIcon size={11} />}
                              {pt.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Dona — tamaño fijo, no se encoge */}
                      <div
                        style={{
                          flexShrink: 0,
                          width: 72,
                          height: 72,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <OccupancyDonut
                          totalUnits={totalUnits}
                          activeLeases={activeLeases}
                          size={72}
                        />
                      </div>
                    </div>

                    {/* Divisor */}
                    <div style={{ height: "0.5px", background: "var(--border-default)", margin: "10px 0" }} />

                    {/* Fila inferior: métricas izq + acciones der */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      {/* Métricas */}
                      <div style={{ display: "flex", gap: 20 }}>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                            {totalUnits}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Total</p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 18, fontWeight: 700, color: "#10B981", lineHeight: 1 }}>
                            {activeLeases}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Ocupados</p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-muted)", lineHeight: 1 }}>
                            {freeUnits}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Libres</p>
                        </div>
                        {building.total_sqm != null && building.building_category !== "residential_multi" && building.building_category !== "residential_single" && (
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                              {building.total_sqm.toLocaleString("es-MX")}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>m²</p>
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isHovered && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--accent)",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Ver detalle →
                          </span>
                        )}
                        <div
                          style={{ position: "relative" }}
                          ref={
                            openActionsBuildingId === building.id
                              ? actionsMenuRef
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionsBuildingId(
                                openActionsBuildingId === building.id
                                  ? null
                                  : building.id
                              )
                            }
                            style={dropdownTriggerStyle}
                            aria-label="Más acciones"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openActionsBuildingId === building.id && (
                            <div style={dropdownMenuStyle}>
                              <button
                                type="button"
                                onClick={() => openEditModal(building)}
                                style={dropdownActionButtonStyle}
                              >
                                <Edit3 size={14} />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(building)}
                                style={dropdownDeleteItemStyle}
                              >
                                <Trash2 size={14} />
                                Eliminar edificio
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Tendencia del portafolio ── */}
      <div style={{ marginTop: 24 }}>
      <SectionCard
        title="Tendencia del portafolio"
        icon={<TrendingUp size={18} />}
      >
        {loadingBuildings ? (
          <p style={{ margin: 0 }}>Cargando datos...</p>
        ) : !hasPortfolioTrend ? (
          <AppEmptyState
            title="Sin datos de tendencia"
            description="Registra unidades y contratos para ver la evolución de ocupación del portafolio."
          />
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={portfolioTrend}
                margin={{ top: 8, right: 48, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                  axisLine={false}
                  tickLine={false}
                />
                {/* Eje izquierdo — conteos */}
                <YAxis
                  yAxisId="count"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                {/* Eje derecho — porcentaje */}
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    if (name === "% Ocupación") return [`${value ?? 0}%`, name];
                    return [value ?? 0, name];
                  }}
                />
                <Legend
                  iconType="line"
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="total"
                  name="Total unidades"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="occupied"
                  name="Ocupadas"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="pct"
                  name="% Ocupación"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
      </div>

      {/* ── Modal de edición ── */}
      <Modal open={isEditModalOpen} onClose={closeEditModal} title="Editar propiedad">
        <form onSubmit={handleUpdateBuilding}>
          <AppFormField label="Nombre del edificio" required>
            <input
              {...register("name")}
              placeholder="Ej. Torre Central"
              style={INPUT_STYLE}
            />
            {errors.name ? <p style={errorTextStyle}>{errors.name.message}</p> : null}
          </AppFormField>

          <AppFormField label="Código">
            <input
              {...register("code")}
              placeholder="Ej. TC-001"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <AppFormField label="Tipo de propiedad" required>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PROPERTY_TYPES.map((pt) => {
                const PtIcon = ICON_MAP[pt.icon];
                const orderIdx = selectedTypes.indexOf(pt.value);
                const selected = orderIdx !== -1;
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => toggleTypeSelection(pt.value)}
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
            {selectedTypes.length > 1 && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
                Tipo principal: <strong style={{ color: "var(--text-primary)" }}>
                  {PROPERTY_TYPES.find((pt) => pt.value === selectedTypes[0])?.label}
                </strong>
              </p>
            )}
            {errors.building_category ? (
              <p style={errorTextStyle}>{errors.building_category.message}</p>
            ) : null}
          </AppFormField>

          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Superficie
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <AppFormField label="M² de terreno">
                <input
                  {...register("land_sqm")}
                  type="number"
                  placeholder="Ej: 500"
                  style={INPUT_STYLE}
                />
              </AppFormField>
              <AppFormField label="M² de construcción">
                <input
                  {...register("construction_sqm")}
                  type="number"
                  placeholder="Ej: 350"
                  style={INPUT_STYLE}
                />
              </AppFormField>
            </div>
            {buildingCategory !== "land" && buildingCategory !== "residential_single" && (
              <AppFormField label="M² por unidad (referencia)">
                <input
                  {...register("default_unit_sqm")}
                  type="number"
                  placeholder="Ej: 65"
                  style={INPUT_STYLE}
                />
              </AppFormField>
            )}
          </div>

          {showFeatures && (
            <AppFormField label="Características">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BUILDING_FEATURES.map((feat) => {
                  const active = !!(buildingFeatures as Record<string, boolean>)[feat.key];
                  return (
                    <label
                      key={feat.key}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        cursor: "pointer", fontSize: 13, color: "var(--text-primary)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleFeature(feat.key)}
                      />
                      {feat.label}
                    </label>
                  );
                })}
              </div>
            </AppFormField>
          )}

          <AppFormField label="Dirección">
            <input
              {...register("address")}
              placeholder="Ej. Av. Principal 123"
              style={INPUT_STYLE}
            />
          </AppFormField>

          {/* Ubicación en el mapa — buscador + mini mapa interactivo */}
          <AppFormField label="Ubicación en el mapa (opcional)">
            <LocationPicker
              latitude={latitudeForPicker}
              longitude={longitudeForPicker}
              onLocationChange={handleLocationChange}
            />
          </AppFormField>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={isSubmitting} variant="primary">
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </UiButton>
            <UiButton type="button" onClick={closeEditModal}>
              Cancelar
            </UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal de eliminar ── */}
      <Modal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="Eliminar edificio"
        maxWidth="480px"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={warnBannerStyle}>
            ¿Eliminar el edificio <strong>{buildingToDelete?.name}</strong>? Esta
            acción lo ocultará del sistema pero conservará toda su información.
          </div>

          {deleteError ? <div style={errorBannerStyle}>{deleteError}</div> : null}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <UiButton
              type="button"
              variant="secondary"
              onClick={closeDeleteModal}
              disabled={deleting}
            >
              Cancelar
            </UiButton>
            <UiButton
              type="button"
              onClick={() => void handleDeleteBuilding()}
              disabled={deleting}
            >
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : "Eliminar edificio"}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal de creación (2 pasos) ── */}
      <Modal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        title={createStep === 1 ? "Nueva propiedad" : "¿Qué tiene esta propiedad?"}
      >
        <form onSubmit={handleSubmitBuilding}>
          {/* ── PASO 1: datos del edificio ── */}
          {createStep === 1 && (
            <>
              <AppFormField label="Nombre del edificio" required>
                <input
                  {...register("name")}
                  placeholder="Ej. Torre Central"
                  style={INPUT_STYLE}
                />
                {errors.name ? <p style={errorTextStyle}>{errors.name.message}</p> : null}
              </AppFormField>

              <AppFormField label="Código">
                <input
                  {...register("code")}
                  placeholder="Ej. TC-001"
                  style={INPUT_STYLE}
                />
              </AppFormField>

              <AppFormField label="Tipo de propiedad" required>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {PROPERTY_TYPES.map((pt) => {
                    const PtIcon = ICON_MAP[pt.icon];
                    const orderIdx = selectedTypes.indexOf(pt.value);
                    const selected = orderIdx !== -1;
                    return (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => toggleTypeSelection(pt.value)}
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
                {selectedTypes.length > 1 && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
                    Tipo principal: <strong style={{ color: "var(--text-primary)" }}>
                      {PROPERTY_TYPES.find((pt) => pt.value === selectedTypes[0])?.label}
                    </strong>
                  </p>
                )}
                {errors.building_category ? (
                  <p style={errorTextStyle}>{errors.building_category.message}</p>
                ) : null}
              </AppFormField>

              <div style={{ marginBottom: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  Superficie
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <AppFormField label="M² de terreno">
                    <input {...register("land_sqm")} type="number" placeholder="Ej: 500" style={INPUT_STYLE} />
                  </AppFormField>
                  <AppFormField label="M² de construcción">
                    <input {...register("construction_sqm")} type="number" placeholder="Ej: 350" style={INPUT_STYLE} />
                  </AppFormField>
                </div>
                {buildingCategory !== "land" && buildingCategory !== "residential_single" && (
                  <AppFormField label="M² por unidad (referencia)">
                    <input {...register("default_unit_sqm")} type="number" placeholder="Ej: 65" style={INPUT_STYLE} />
                  </AppFormField>
                )}
              </div>

              {showFeatures && (
                <AppFormField label="Características">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {BUILDING_FEATURES.map((feat) => {
                      const active = !!(buildingFeatures as Record<string, boolean>)[feat.key];
                      return (
                        <label key={feat.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                          <input type="checkbox" checked={active} onChange={() => toggleFeature(feat.key)} />
                          {feat.label}
                        </label>
                      );
                    })}
                  </div>
                </AppFormField>
              )}

              <AppFormField label="Dirección">
                <input {...register("address")} placeholder="Ej. Av. Principal 123" style={INPUT_STYLE} />
              </AppFormField>

              <AppFormField label="Ubicación en el mapa (opcional)">
                <LocationPicker
                  latitude={latitudeForPicker}
                  longitude={longitudeForPicker}
                  onLocationChange={handleLocationChange}
                />
              </AppFormField>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <UiButton type="button" variant="primary" onClick={() => void handleNextStep()}>
                  Siguiente →
                </UiButton>
                <UiButton type="button" onClick={closeCreateModal}>
                  Cancelar
                </UiButton>
              </div>
            </>
          )}

          {/* ── PASO 2: selector de features ── */}
          {createStep === 2 && (() => {
            const applicableFeatures = getDefaultFeatures(selectedTypes[0] ?? "");
            const spaceFeatures   = applicableFeatures.filter((f) => f.category === "space");
            const serviceFeatures = applicableFeatures.filter((f) => f.category === "service");

            function FeatureCard({ feat }: { feat: typeof applicableFeatures[number] }) {
              const FeatIcon = FEATURE_ICON_MAP[feat.icon];
              const selected = selectedFeatureKeys.includes(feat.key);
              return (
                <button
                  key={feat.key}
                  type="button"
                  onClick={() => toggleFeatureSelection(feat.key)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 12px", borderRadius: 10, width: "100%", textAlign: "left",
                    border: selected ? `2px solid ${feat.color}` : "2px solid var(--border-default)",
                    background: selected ? feat.color + "12" : "var(--bg-card)",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  {FeatIcon && <span style={{ flexShrink: 0, marginTop: 2, lineHeight: 0 }}><FeatIcon size={16} color={selected ? feat.color : "var(--text-muted)"} /></span>}
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? feat.color : "var(--text-primary)", lineHeight: 1.2 }}>
                      {feat.label}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>
                      {feat.description}
                    </p>
                  </div>
                </button>
              );
            }

            return (
              <>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  Selecciona los espacios y servicios disponibles. Puedes cambiar esto después.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Sección: Espacios físicos */}
                  {spaceFeatures.length > 0 && (
                    <div style={{ background: "var(--bg-page)", borderRadius: 12, padding: 16, border: "1px solid var(--border-default)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Building2 size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Espacios físicos</p>
                          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Construcciones e instalaciones de la propiedad</p>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {spaceFeatures.map((feat) => <FeatureCard key={feat.key} feat={feat} />)}
                      </div>
                    </div>
                  )}

                  {/* Sección: Servicios */}
                  {serviceFeatures.length > 0 && (
                    <div style={{ background: "var(--bg-page)", borderRadius: 12, padding: 16, border: "1px solid var(--border-default)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Zap size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Servicios</p>
                          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Suministros y servicios operativos activos</p>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {serviceFeatures.map((feat) => <FeatureCard key={feat.key} feat={feat} />)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                  <UiButton type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? "Creando..." : "Crear propiedad"}
                  </UiButton>
                  <UiButton type="button" onClick={() => setCreateStep(1)}>
                    ← Atrás
                  </UiButton>
                  <UiButton type="button" onClick={closeCreateModal}>
                    Cancelar
                  </UiButton>
                </div>
              </>
            );
          })()}
        </form>
      </Modal>
    </PageContainer>
  );
}
