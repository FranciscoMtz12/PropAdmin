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

  Funcionalidad CRUD intacta: crear / editar / archivar edificio.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  DoorOpen,
  Edit3,
  Filter,
  Home,
  MoreHorizontal,
  Plus,
  Tags,
  TrendingUp,
  Trash2,
  Warehouse,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import BuildingCategoryBadge from "@/components/BuildingCategoryBadge";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppCard from "@/components/AppCard";
import AppSelect from "@/components/AppSelect";
import AppFormField from "@/components/AppFormField";
import AppEmptyState from "@/components/AppEmptyState";
import {
  BUILDING_CATEGORIES,
  MIXED_USE_SUBCATEGORIES,
} from "@/lib/buildingCategories";
import {
  INPUT_STYLE,
  dropdownTriggerStyle,
  dropdownMenuStyle,
  dropdownActionButtonStyle,
  dropdownDeleteItemStyle,
  warnBannerStyle,
  errorBannerStyle,
} from "@/lib/pageStyles";

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

/* ─── Componente: dona SVG de ocupación ─────────────────────────────── */

function OccupancyDonut({
  totalUnits,
  activeLeases,
}: {
  totalUnits: number;
  activeLeases: number;
}) {
  const pct = totalUnits > 0 ? Math.round((activeLeases / totalUnits) * 100) : 0;
  // Color semántico según nivel de ocupación
  const color =
    totalUnits === 0 ? "#E5E7EB"
    : pct >= 75 ? "#10B981"
    : pct >= 40 ? "#F59E0B"
    : "#EF4444";

  const r = 24;
  const circ = 2 * Math.PI * r; // ~150.8
  const offset = totalUnits === 0 ? circ : circ - (pct / 100) * circ;

  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <svg width="64" height="64">
        {/* Círculo base (track) */}
        <circle cx="32" cy="32" r={r} fill="none" stroke="#E5E7EB" strokeWidth="8" />
        {/* Círculo de progreso — origen en la parte superior */}
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "32px 32px" }}
        />
      </svg>
      {/* Texto central */}
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
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
            color: "var(--text-primary)",
          }}
        >
          {pct}%
        </span>
        <span style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.2 }}>
          ocup.
        </span>
      </div>
    </div>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────── */

export default function BuildingsPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  /* Estado de datos */
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [unitCountByBuilding, setUnitCountByBuilding] = useState<Map<string, number>>(new Map());
  const [activeLeasesCountByBuilding, setActiveLeasesCountByBuilding] = useState<Map<string, number>>(new Map());
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
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [buildingCategory, setBuildingCategory] = useState("residential");
  const [buildingSubcategory, setBuildingSubcategory] = useState("");
  const [saving, setSaving] = useState(false);

  /* Hover + dropdown de acciones por card */
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [openActionsBuildingId, setOpenActionsBuildingId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  /* Redirigir si no hay sesión */
  useEffect(() => {
    if (!loading && !user) router.push("/login");
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

  /* Limpiar elegibilidad cuando se cierra modal de archivar */
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
      .select("id, company_id, name, address, code, building_category, building_subcategory")
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
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

    /* 2. Unidades de todos los edificios */
    const { data: unitsData } = await supabase
      .from("units")
      .select("id, building_id")
      .in("building_id", buildingIds)
      .is("deleted_at", null);

    const units = (unitsData || []) as Array<{ id: string; building_id: string }>;

    /* Mapa building_id → cantidad de unidades */
    const unitCounts = new Map<string, number>();
    /* Mapa unit_id → building_id (para cruzar con leases) */
    const unitBuildingMap = new Map<string, string>();
    units.forEach((u) => {
      unitCounts.set(u.building_id, (unitCounts.get(u.building_id) || 0) + 1);
      unitBuildingMap.set(u.id, u.building_id);
    });
    setUnitCountByBuilding(unitCounts);

    /* 3. Leases activos */
    const unitIds = units.map((u) => u.id);
    const leaseCounts = new Map<string, number>();

    if (unitIds.length > 0) {
      const { data: leasesData } = await supabase
        .from("leases")
        .select("unit_id")
        .in("unit_id", unitIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null);

      (leasesData || []).forEach((l: { unit_id: string }) => {
        const bid = unitBuildingMap.get(l.unit_id);
        if (bid) leaseCounts.set(bid, (leaseCounts.get(bid) || 0) + 1);
      });
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
      const active = activeLeasesCountByBuilding.get(b.id) || 0;
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

  /* Edificios filtrados por categoría */
  const filteredBuildings = useMemo(
    () =>
      buildings.filter(
        (b) => selectedCategory === "ALL" || b.building_category === selectedCategory
      ),
    [buildings, selectedCategory]
  );

  /* ── Handlers de formulario ─────────────────────────────────────── */

  function resetForm() {
    setName("");
    setCode("");
    setAddress("");
    setBuildingCategory("residential");
    setBuildingSubcategory("");
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    resetForm();
  }

  function openEditModal(building: Building) {
    setBuildingEditingId(building.id);
    setName(building.name || "");
    setCode(building.code || "");
    setAddress(building.address || "");
    setBuildingCategory(building.building_category || "residential");
    setBuildingSubcategory(building.building_subcategory || "");
    setIsEditModalOpen(true);
    setOpenActionsBuildingId(null);
    setMsg("");
  }

  function closeEditModal() {
    if (saving) return;
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

  async function handleSubmitBuilding(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!user?.company_id) { setMsg("No se encontró la empresa del usuario."); return; }
    if (!name.trim()) { setMsg("El nombre del edificio es obligatorio."); return; }
    if (buildingCategory === "mixed_use" && !buildingSubcategory) {
      setMsg("Debes seleccionar el tipo de uso mixto.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("buildings").insert({
      company_id: user.company_id,
      name: name.trim(),
      code: code.trim() || null,
      address: address.trim() || null,
      building_category: buildingCategory,
      building_subcategory: buildingCategory === "mixed_use" ? buildingSubcategory || null : null,
    });
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    setMsg("Edificio guardado correctamente.");
    closeCreateModal();
    await loadBuildings();
  }

  async function handleUpdateBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !buildingEditingId) {
      setMsg("No se encontró el edificio a editar.");
      return;
    }
    if (!name.trim()) { setMsg("El nombre del edificio es obligatorio."); return; }
    if (buildingCategory === "mixed_use" && !buildingSubcategory) {
      setMsg("Debes seleccionar el tipo de uso mixto.");
      return;
    }
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("buildings")
      .update({
        name: name.trim(),
        code: code.trim() || null,
        address: address.trim() || null,
        building_category: buildingCategory,
        building_subcategory: buildingCategory === "mixed_use" ? buildingSubcategory || null : null,
      })
      .eq("id", buildingEditingId)
      .eq("company_id", user.company_id);
    setSaving(false);
    if (error) { setMsg(`No se pudo actualizar el edificio. ${error.message}`); return; }
    closeEditModal();
    await loadBuildings();
    setMsg("Edificio actualizado correctamente.");
  }

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
      setDeleteError(`No se pudo archivar el edificio. ${error.message}`);
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
        title="Edificios"
        titleIcon={<Building2 size={20} />}
        actions={
          <>
            <UiButton href="/dashboard">Ir al dashboard</UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nuevo edificio
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
          label="Total de edificios"
          value={portfolioStats.total}
          icon={<Warehouse size={18} />}
          helper="Portafolio actual"
        />
        <MetricCard
          label="Al 75 %+ de ocupación"
          value={portfolioStats.highOccupancy}
          icon={<Building2 size={18} />}
          helper="Edificios en alta ocupación"
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
              {BUILDING_CATEGORIES.map((item, index) => (
                <option key={`${item.key}-${index}`} value={item.key}>
                  {item.label}
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
            actionLabel="Crear edificio"
            onAction={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {filteredBuildings.map((building) => {
              const totalUnits = unitCountByBuilding.get(building.id) || 0;
              const activeLeases = activeLeasesCountByBuilding.get(building.id) || 0;
              const freeUnits = Math.max(0, totalUnits - activeLeases);
              const isHovered = hoveredBuildingId === building.id;

              return (
                /* Wrapper clickeable — toda la card navega al detalle */
                <div
                  key={building.id}
                  onClick={() => router.push(`/buildings/${building.id}`)}
                  onMouseEnter={() => setHoveredBuildingId(building.id)}
                  onMouseLeave={() => setHoveredBuildingId(null)}
                  style={{
                    cursor: "pointer",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    transition: "transform 0.15s ease",
                    borderRadius: 16,
                  }}
                >
                  <AppCard
                    style={{
                      padding: 0,
                      boxShadow: isHovered
                        ? "0 8px 24px rgba(0,0,0,0.13)"
                        : "var(--shadow-card)",
                      transition: "box-shadow 0.15s ease",
                    }}
                  >
                    {/* TOP: info + dona */}
                    <div
                      style={{
                        padding: "16px 16px 14px",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      {/* Izquierda: nombre + dirección + badge */}
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
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
                            color: "var(--text-muted)",
                            marginBottom: 8,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {building.address || "Sin dirección registrada"}
                        </p>
                        <BuildingCategoryBadge category={building.building_category} />
                      </div>

                      {/* Derecha: dona de ocupación */}
                      <OccupancyDonut
                        totalUnits={totalUnits}
                        activeLeases={activeLeases}
                      />
                    </div>

                    {/* DIVISOR */}
                    <div
                      style={{
                        height: "0.5px",
                        background: "var(--border-default)",
                        margin: "0 16px",
                      }}
                    />

                    {/* BOTTOM: stats + acciones */}
                    <div
                      style={{
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      {/* Stats: Total / Ocupados / Libres */}
                      <div style={{ display: "flex", gap: 20 }}>
                        <div style={{ textAlign: "center" }}>
                          <p
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              lineHeight: 1,
                            }}
                          >
                            {totalUnits}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 3,
                            }}
                          >
                            Total
                          </p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: "#10B981",
                              lineHeight: 1,
                            }}
                          >
                            {activeLeases}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 3,
                            }}
                          >
                            Ocupados
                          </p>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: "var(--text-muted)",
                              lineHeight: 1,
                            }}
                          >
                            {freeUnits}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 3,
                            }}
                          >
                            Libres
                          </p>
                        </div>
                      </div>

                      {/* Acciones: hover label + dropdown */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        {/* "Ver detalle →" aparece solo en hover */}
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

                        {/* Dropdown (no propaga click al wrapper) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
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
                                Archivar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </AppCard>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Modal de edición ── */}
      <Modal open={isEditModalOpen} onClose={closeEditModal} title="Editar edificio">
        <form onSubmit={handleUpdateBuilding}>
          <AppFormField label="Nombre del edificio" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Torre Central"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <AppFormField label="Código">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. TC-001"
                style={INPUT_STYLE}
              />
            </AppFormField>

            <AppFormField label="Categoría" required>
              <AppSelect
                value={buildingCategory}
                onChange={(e) => {
                  setBuildingCategory(e.target.value);
                  if (e.target.value !== "mixed_use") setBuildingSubcategory("");
                }}
              >
                {BUILDING_CATEGORIES.map((item, index) => (
                  <option key={`${item.key}-${index}`} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </AppFormField>
          </div>

          {buildingCategory === "mixed_use" ? (
            <AppFormField label="Subcategoría de uso mixto" required>
              <AppSelect
                value={buildingSubcategory}
                onChange={(e) => setBuildingSubcategory(e.target.value)}
              >
                <option value="">Selecciona una subcategoría</option>
                {MIXED_USE_SUBCATEGORIES.map((item, index) => (
                  <option key={`${item.value}-${index}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </AppFormField>
          ) : null}

          <AppFormField label="Dirección">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej. Av. Principal 123"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar cambios"}
            </UiButton>
            <UiButton type="button" onClick={closeEditModal}>
              Cancelar
            </UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal de archivar ── */}
      <Modal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="Archivar edificio"
        maxWidth="480px"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={warnBannerStyle}>
            ¿Archivar el edificio <strong>{buildingToDelete?.name}</strong>? Esta
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
              {deleting ? "Archivando..." : "Archivar edificio"}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal de creación ── */}
      <Modal open={isCreateModalOpen} onClose={closeCreateModal} title="Crear edificio">
        <form onSubmit={handleSubmitBuilding}>
          <AppFormField label="Nombre del edificio" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Torre Central"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <AppFormField label="Código">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. TC-001"
                style={INPUT_STYLE}
              />
            </AppFormField>

            <AppFormField label="Categoría" required>
              <AppSelect
                value={buildingCategory}
                onChange={(e) => {
                  setBuildingCategory(e.target.value);
                  if (e.target.value !== "mixed_use") setBuildingSubcategory("");
                }}
              >
                {BUILDING_CATEGORIES.map((item, index) => (
                  <option key={`${item.key}-${index}`} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </AppFormField>
          </div>

          {buildingCategory === "mixed_use" ? (
            <AppFormField label="Subcategoría de uso mixto" required>
              <AppSelect
                value={buildingSubcategory}
                onChange={(e) => setBuildingSubcategory(e.target.value)}
              >
                <option value="">Selecciona una subcategoría</option>
                {MIXED_USE_SUBCATEGORIES.map((item, index) => (
                  <option key={`${item.value}-${index}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </AppFormField>
          ) : null}

          <AppFormField label="Dirección">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej. Av. Principal 123"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar edificio"}
            </UiButton>
            <UiButton type="button" onClick={closeCreateModal}>
              Cancelar
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
