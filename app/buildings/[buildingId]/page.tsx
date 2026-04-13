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

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Building2,
  CreditCard,
  Droplets,
  Flame,
  Gem,
  FileImage,
  FileText,
  FolderOpen,
  Home,
  ImageIcon,
  Layers3,
  MapPin,
  Pencil,
  Tags,
  Trash2,
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
  BUILDING_CATEGORIES,
  MIXED_USE_SUBCATEGORIES,
  getBuildingCategoryDefinition,
  getMixedUseSubcategoryLabel,
} from "@/lib/buildingCategories";
import { INPUT_STYLE, TEXTAREA_STYLE } from "@/lib/pageStyles";

/* ─── Tipos ─────────────────────────────────────────────────────────── */

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
  unit_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type TrendPoint = { label: string; total: number; occupied: number; pct: number };

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

  /* Estado de UI */
  const [activeTab, setActiveTab]             = useState("overview");
  const [msg, setMsg]                         = useState("");
  const [loadingBuilding, setLoadingBuilding] = useState(true);
  const [collectionMonths, setCollectionMonths] = useState<3 | 6>(3);
  const [savingBillingConcept, setSavingBillingConcept] =
    useState<BuildingBillingConceptCode | null>(null);

  /* Estado de modales */
  const [isEditModalOpen, setIsEditModalOpen]     = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [savingEdit, setSavingEdit]               = useState(false);
  const [deletingBuilding, setDeletingBuilding]   = useState(false);

  /* Estado de formulario edición */
  const [name, setName]                               = useState("");
  const [code, setCode]                               = useState("");
  const [address, setAddress]                         = useState("");
  const [buildingCategory, setBuildingCategory]       = useState("residential");
  const [buildingSubcategory, setBuildingSubcategory] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) void loadBuilding();
  }, [user, buildingId]);

  /* ── Carga de datos ──────────────────────────────────────────────── */

  async function loadBuilding() {
    if (!user?.company_id || !buildingId) return;
    setLoadingBuilding(true);
    setMsg("");

    const { data, error } = await supabase
      .from("buildings")
      .select("id, company_id, name, address, code, building_category, building_subcategory")
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
    setBuildingSubcategory(b.building_subcategory || "");

    /* Queries paralelas — units incluye created_at para tendencia */
    const [
      { data: filesData },
      { data: unitsData },
      { data: unitTypesData },
      { data: billingData },
      { data: collData },
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
    ]);

    setFiles((filesData as BuildingFile[]) || []);
    setUnitStatuses((unitsData as UnitStatusRow[]) || []);
    setUnitTypeCount((unitTypesData as UnitTypeRow[] | null)?.length || 0);
    setBillingConcepts((billingData as BuildingBillingConcept[]) || []);
    setCollectionRecords((collData as CollectionRecord[]) || []);

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

    setLoadingBuilding(false);
  }

  /* ── Derivaciones ─────────────────────────────────────────────────── */

  const documentFiles = useMemo(() => files.filter((f) => f.file_type === "document"), [files]);
  const imageFiles    = useMemo(() => files.filter((f) => f.file_type === "image"),    [files]);

  /* Ocupación: contar status RENTED y OCCUPIED por si hay inconsistencia en el DB */
  const occupiedUnits    = unitStatuses.filter((u) => {
    const s = (u.status || "").toUpperCase();
    return s === "RENTED" || s === "OCCUPIED";
  }).length;
  const vacantUnits      = unitStatuses.filter((u) => (u.status || "").toUpperCase() === "VACANT").length;
  const maintenanceUnits = unitStatuses.filter((u) => (u.status || "").toUpperCase() === "MAINTENANCE").length;
  const totalUnits       = unitStatuses.length;

  /* Variante de color de la dona de ocupación */
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  /* Datos para el PieChart de distribución */
  const pieData = useMemo(() => [
    { name: "Rentados",      value: occupiedUnits,    color: "#10B981" },
    { name: "Disponibles",   value: vacantUnits,      color: "#3B82F6" },
    { name: "Mantenimiento", value: maintenanceUnits, color: "#F59E0B" },
  ], [occupiedUnits, vacantUnits, maintenanceUnits]);

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

  /* ── Handlers ─────────────────────────────────────────────────────── */

  function openEditModal() {
    if (!building) return;
    setName(building.name || "");
    setCode(building.code || "");
    setAddress(building.address || "");
    setBuildingCategory(building.building_category || "residential");
    setBuildingSubcategory(building.building_subcategory || "");
    setIsEditModalOpen(true);
    setMsg("");
  }

  async function handleUpdateBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !building) { setMsg("No se encontró el edificio."); return; }
    if (!name.trim()) { setMsg("El nombre del edificio es obligatorio."); return; }
    if (buildingCategory === "mixed_use" && !buildingSubcategory) {
      setMsg("Debes seleccionar el tipo de uso mixto."); return;
    }
    setSavingEdit(true);
    setMsg("");
    const { error } = await supabase
      .from("buildings")
      .update({
        name: name.trim(), code: code.trim() || null,
        address: address.trim() || null,
        building_category: buildingCategory,
        building_subcategory: buildingCategory === "mixed_use" ? buildingSubcategory || null : null,
      })
      .eq("id", building.id)
      .eq("company_id", user.company_id);
    setSavingEdit(false);
    if (error) { setMsg(`No se pudo actualizar el edificio. ${error.message}`); return; }
    setIsEditModalOpen(false);
    await loadBuilding();
    setMsg("Edificio actualizado correctamente.");
  }

  async function handleDeleteBuilding() {
    if (!user?.company_id || !building) return;
    setDeletingBuilding(true);
    setMsg("");
    const { error } = await supabase
      .from("buildings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", building.id)
      .eq("company_id", user.company_id);
    if (error) { setMsg(`No se pudo archivar el edificio. ${error.message}`); setDeletingBuilding(false); return; }
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

  /* ── Render ──────────────────────────────────────────────────────── */

  if (loading)        return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user)          return null;
  if (loadingBuilding) return <PageContainer>Cargando edificio...</PageContainer>;
  if (!building)      return <PageContainer>{msg || "No se encontró el edificio."}</PageContainer>;

  const categoryDefinition = getBuildingCategoryDefinition(building.building_category);

  return (
    <PageContainer>
      <PageHeader
        title={building.name}
        titleIcon={<Building2 size={20} />}
        subtitle="Vista general del inmueble — ocupación, cobranza y tendencia."
        actions={
          <>
            <UiButton href="/buildings">Volver a edificios</UiButton>
            <UiButton onClick={openEditModal}><Pencil size={16} /> Editar edificio</UiButton>
            <UiButton onClick={() => setIsDeleteModalOpen(true)}><Trash2 size={16} /> Archivar edificio</UiButton>
            <UiButton href={`/buildings/${building.id}/units`} variant="primary">Departamentos</UiButton>
          </>
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
          { key: "documents", label: "Documentos", icon: <FolderOpen size={16} />, count: documentFiles.length },
          { key: "gallery",   label: "Galería",    icon: <FileImage size={16} />,  count: imageFiles.length },
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 24 }}>

          {/* ── Fila 1: 2 métricas ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <OccupancyDonutCard occupied={occupiedUnits} total={totalUnits} />
            <MetricCard
              label="Unidades"
              value={`${occupiedUnits} / ${totalUnits}`}
              icon={<Home size={18} />}
              helper="Ocupadas sobre registradas"
            />
          </div>

          {/* ── Fila 2: PieChart distribución | BarChart cobranza ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>

            {/* Col izquierda: Distribución de unidades */}
            <SectionCard title="Distribución de unidades" icon={<Home size={18} />}>
              {totalUnits === 0 ? (
                <AppEmptyState
                  title="Sin unidades registradas"
                  description="Crea departamentos para ver la distribución aquí."
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
            </SectionCard>

            {/* Col derecha: Cobranza del edificio con toggle 3/6 meses */}
            <SectionCard
              title="Cobranza del edificio"
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
            </SectionCard>
          </div>

          {/* ── Fila 3: Tendencia de ocupación ── */}
          <SectionCard
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
          </SectionCard>

          {/* ── Fila 4: Grid 3 columnas — Info | Facturación | Accesos ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>

            {/* Info general */}
            <SectionCard title="Información general" subtitle="Datos base del edificio." icon={<Building2 size={18} />}>
              <AppGrid minWidth={180} gap={12}>
                <SummaryItem label="Código"    value={building.code || "Sin código"}      icon={<Tags size={16} />} />
                <SummaryItem label="Dirección" value={building.address || "Sin dirección"} icon={<MapPin size={16} />} />
                <SummaryItem label="Categoría" value={categoryDefinition.label}            icon={<Building2 size={16} />} />
                {building.building_category === "mixed_use" && building.building_subcategory ? (
                  <SummaryItem
                    label="Subcategoría"
                    value={getMixedUseSubcategoryLabel(building.building_subcategory)}
                    icon={<Home size={16} />}
                  />
                ) : null}
              </AppGrid>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <BuildingCategoryBadge category={building.building_category} />
                {building.building_category === "mixed_use" && building.building_subcategory ? (
                  <span style={{ border: "1px solid var(--border-default)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {getMixedUseSubcategoryLabel(building.building_subcategory)}
                  </span>
                ) : null}
              </div>
            </SectionCard>

            {/* Facturación */}
            <SectionCard title="Facturación" subtitle="Conceptos de la generación mensual." icon={<CreditCard size={18} />}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {BILLING_CONCEPT_OPTIONS.map((option) => {
                    const isActive = activeBillingConceptCodes.includes(option.code);
                    const isSaving = savingBillingConcept === option.code;
                    return (
                      <button
                        key={option.code} type="button"
                        onClick={() => void toggleBillingConcept(option.code)}
                        disabled={isSaving}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "9px 14px", borderRadius: 999,
                          border: `1px solid ${isActive ? "var(--metric-border-green)" : "var(--border-default)"}`,
                          background: isActive ? "var(--badge-bg-green)" : "var(--bg-card)",
                          color: isActive ? "var(--badge-text-green)" : "var(--text-primary)",
                          fontWeight: 700, fontSize: 13, cursor: isSaving ? "wait" : "pointer",
                          opacity: isSaving ? 0.75 : 1,
                        }}
                      >
                        {option.icon}
                        {isSaving ? "Guardando..." : option.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {activeBillingConceptCodes.length > 0
                    ? `Activos: ${BILLING_CONCEPT_OPTIONS.filter((o) => activeBillingConceptCodes.includes(o.code)).map((o) => o.label).join(", ")}.`
                    : "Sin conceptos activos."}
                </p>
              </div>
            </SectionCard>

            {/* Accesos rápidos */}
            <SectionCard title="Accesos rápidos" subtitle="Navega a los módulos del edificio." icon={<Layers3 size={18} />}>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { title: "Tipologías",    desc: `${unitTypeCount} tipos de unidad registrados.`,       href: `/buildings/${building.id}/unit-types`, variant: undefined as "primary" | undefined },
                  { title: "Departamentos", desc: `${totalUnits} unidades en el edificio.`,               href: `/buildings/${building.id}/units`,       variant: "primary" as "primary" | undefined },
                  { title: "Limpieza",      desc: "Organiza las áreas de limpieza.",                      href: `/buildings/${building.id}/cleaning`,    variant: undefined as "primary" | undefined },
                ].map((item) => (
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
          </div>
        </div>
      ) : null}

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

      {/* ── Modal editar edificio ── */}
      <Modal open={isEditModalOpen} onClose={() => { if (!savingEdit) setIsEditModalOpen(false); }} title="Editar edificio">
        <form onSubmit={handleUpdateBuilding}>
          <AppFormField label="Nombre del edificio" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Torre Central" style={INPUT_STYLE} />
          </AppFormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <AppFormField label="Código">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. TC-001" style={INPUT_STYLE} />
            </AppFormField>
            <AppFormField label="Categoría" required>
              <AppSelect value={buildingCategory} onChange={(e) => setBuildingCategory(e.target.value)}>
                {BUILDING_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </AppSelect>
            </AppFormField>
          </div>
          {buildingCategory === "mixed_use" ? (
            <AppFormField label="Subcategoría de uso mixto" required>
              <AppSelect value={buildingSubcategory} onChange={(e) => setBuildingSubcategory(e.target.value)}>
                <option value="">Selecciona una subcategoría</option>
                {MIXED_USE_SUBCATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </AppSelect>
            </AppFormField>
          ) : null}
          <AppFormField label="Dirección">
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección del edificio" style={TEXTAREA_STYLE} />
          </AppFormField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={savingEdit}>Cancelar</UiButton>
            <UiButton type="submit" disabled={savingEdit}>{savingEdit ? "Guardando..." : "Guardar cambios"}</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal archivar edificio ── */}
      <DeleteConfirmModal
        open={isDeleteModalOpen}
        title="Archivar edificio"
        description={building ? `¿Archivar ${building.name}? Esta acción lo ocultará del sistema pero conservará toda su información.` : "¿Archivar este edificio?"}
        confirmText={deletingBuilding ? "Archivando..." : "Archivar edificio"}
        onConfirm={() => void handleDeleteBuilding()}
        onCancel={() => { if (!deletingBuilding) setIsDeleteModalOpen(false); }}
      />
    </PageContainer>
  );
}
