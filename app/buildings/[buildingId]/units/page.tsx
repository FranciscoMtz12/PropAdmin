"use client";

/*
  Página de departamentos de un edificio — diseño v2.3

  Lógica de baños/recámaras corregida:
  - La fuente de verdad es la TIPOLOGÍA (unit_types), no la unidad.
  - El SELECT hace JOIN: unit_types(name, bedrooms, bathrooms).
  - Las cards muestran bedrooms/bathrooms de la tipología (read-only).
  - Los modales crear/editar no tienen campos propios de baños/recámaras:
    solo el selector de tipología. Al seleccionar una tipología se muestra
    un preview de sus valores.
  - No se necesita ALTER TABLE en units.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bath,
  BedDouble,
  DoorOpen,
  Edit3,
  FolderCog,
  Hash,
  Layers3,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
  Warehouse,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
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
  code: string | null;
  address: string | null;
};

/* La tipología trae bedrooms y bathrooms desde la tabla unit_types */
type UnitType = {
  id: string;
  building_id: string;
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
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
  rental_type: string | null;
  /* Datos de la tipología — vienen del JOIN, NO son columnas propias de units */
  unit_types: {
    name: string;
    bedrooms: number | null;
    bathrooms: number | null;
  } | null;
};

/* ─── Helpers de estado ─────────────────────────────────────────────── */

function normalizeStatus(status: string | null | undefined): string {
  return (status || "").toUpperCase();
}

/** Unidad tiene inquilino(s) activos — RENTED, OCCUPIED o PARTIAL */
function isOccupied(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return s === "RENTED" || s === "OCCUPIED" || s === "PARTIAL";
}

function getUnitStatusBadge(status: string | null | undefined) {
  const s = normalizeStatus(status);

  if (s === "RENTED" || s === "OCCUPIED") {
    return {
      label: "Rentado",
      backgroundColor: "var(--badge-bg-green)",
      textColor: "var(--badge-text-green)",
      borderColor: "var(--metric-border-green)",
    };
  }
  if (s === "PARTIAL") {
    return {
      label: "Parcial",
      backgroundColor: "var(--badge-bg-amber)",
      textColor: "var(--badge-text-amber)",
      borderColor: "var(--metric-border-amber)",
    };
  }
  if (s === "MAINTENANCE") {
    return {
      label: "Mantenimiento",
      backgroundColor: "var(--badge-bg-red)",
      textColor: "var(--badge-text-red)",
      borderColor: "var(--metric-border-red)",
    };
  }
  /* VACANT y cualquier otro */
  return {
    label: "Vacante",
    backgroundColor: "var(--badge-bg-blue)",
    textColor: "var(--badge-text-blue)",
    borderColor: "var(--metric-border-neutral)",
  };
}

/* ─── Componente: mini dona de estado ───────────────────────────────── */

function MiniStatusRing({ status, occupiedRooms, totalRooms }: { status: string; occupiedRooms?: number; totalRooms?: number }) {
  const s = normalizeStatus(status);
  const r = 14;
  const circ = 2 * Math.PI * r;

  /* Dona proporcional para unidades by_room con datos reales */
  if (occupiedRooms !== undefined && totalRooms !== undefined && totalRooms > 0) {
    const fraction = Math.min(occupiedRooms / totalRooms, 1);
    const filled   = circ * fraction;
    const color    = fraction === 0 ? "#9CA3AF" : fraction < 1 ? "#F59E0B" : "#10B981";
    return (
      <svg width="40" height="40" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        {filled > 0 ? (
          <circle
            cx="20" cy="20" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${filled} ${circ}`}
            style={{ transform: "rotate(-90deg)", transformOrigin: "20px 20px" }}
          />
        ) : null}
      </svg>
    );
  }

  if (s === "PARTIAL") {
    /* Dona partida: mitad verde, mitad gris */
    const half = circ / 2;
    return (
      <svg width="40" height="40" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#9CA3AF" strokeWidth="6" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke="#10B981" strokeWidth="6"
          strokeDasharray={`${half} ${circ}`}
          style={{ transform: "rotate(-90deg)", transformOrigin: "20px 20px" }}
        />
      </svg>
    );
  }

  const color =
    s === "RENTED" || s === "OCCUPIED" ? "#10B981"
    : s === "MAINTENANCE"              ? "#EF4444"
    : "#9CA3AF";

  return (
    <svg width="40" height="40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth="6" />
    </svg>
  );
}

/* ─── Página ─────────────────────────────────────────────────────────── */

export default function BuildingUnitsPage() {
  const router     = useRouter();
  const params     = useParams();
  const buildingId = params.buildingId as string;
  const { user, loading } = useCurrentUser();

  /* Estado de datos */
  const [building, setBuilding]       = useState<Building | null>(null);
  const [unitTypes, setUnitTypes]     = useState<UnitType[]>([]);
  const [units, setUnits]             = useState<UnitRow[]>([]);
  const [tenantsByUnitId, setTenantsByUnitId] = useState<Map<string, string>>(new Map());
  const [activeLeaseCountByUnitId, setActiveLeaseCountByUnitId] = useState<Map<string, number>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [msg, setMsg]                 = useState("");

  /* Estado del formulario de creación */
  const [unitNumber, setUnitNumber]               = useState("");
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [floor, setFloor]                         = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [saving, setSaving]                       = useState(false);

  /* Estado del modal de archivar */
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete]           = useState<UnitRow | null>(null);
  const [deleteError, setDeleteError]             = useState<string | null>(null);
  const [deleting, setDeleting]                   = useState(false);

  /* Estado del modal de edición */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit]         = useState<UnitRow | null>(null);
  const [editUnitNumber, setEditUnitNumber]   = useState("");
  const [editFloor, setEditFloor]             = useState("");
  const [editUnitTypeId, setEditUnitTypeId]   = useState("");

  /* Control de dropdown por unidad */
  const [openActionsUnitId, setOpenActionsUnitId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId) void loadPageData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, buildingId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(e.target as Node)) {
        setOpenActionsUnitId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Carga de datos ──────────────────────────────────────────────── */

  async function loadPageData() {
    if (!user?.company_id || !buildingId) return;
    setLoadingData(true);
    setMsg("");

    /* 1. Edificio */
    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name, code, address")
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

    /* 2. Tipologías — traer bedrooms y bathrooms para los modales */
    const { data: unitTypeData, error: unitTypeError } = await supabase
      .from("unit_types")
      .select("id, building_id, name, bedrooms, bathrooms")
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (unitTypeError) {
      setMsg("No se pudieron cargar las tipologías del edificio.");
      setLoadingData(false);
      return;
    }
    setUnitTypes((unitTypeData || []) as UnitType[]);

    /* 3. Departamentos — JOIN con unit_types para traer bedrooms/bathrooms */
    const { data: unitData, error: unitError } = await supabase
      .from("units")
      .select(`
        id,
        company_id,
        building_id,
        unit_type_id,
        unit_number,
        display_code,
        floor,
        status,
        rental_type,
        unit_types(name, bedrooms, bathrooms)
      `)
      .eq("building_id", buildingId)
      .is("deleted_at", null);

    if (unitError) {
      setMsg("No se pudieron cargar los departamentos.");
      setLoadingData(false);
      return;
    }

    const raw = (unitData as unknown as UnitRow[]) || [];

    /* Ordenamiento numérico: "1", "2", "10" en lugar de "1", "10", "2" */
    const sorted = [...raw].sort((a, b) => {
      const numA = parseInt(a.unit_number, 10);
      const numB = parseInt(b.unit_number, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.unit_number.localeCompare(b.unit_number);
    });
    setUnits(sorted);

    /* 4. Nombre del inquilino activo para unidades ocupadas */
    const occupiedIds = sorted.filter((u) => isOccupied(u.status)).map((u) => u.id);
    const tenantMap = new Map<string, string>();

    if (occupiedIds.length > 0) {
      const { data: activeLeasesData } = await supabase
        .from("leases")
        .select("unit_id, tenant_id")
        .in("unit_id", occupiedIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null);

      const tenantIds = [
        ...new Set(
          (activeLeasesData || [])
            .map((l: { tenant_id: string | null }) => l.tenant_id)
            .filter(Boolean) as string[]
        ),
      ];

      if (tenantIds.length > 0) {
        const { data: tenantsData } = await supabase
          .from("tenants")
          .select("id, full_name")
          .in("id", tenantIds);

        const tenantById = new Map(
          (tenantsData || []).map(
            (t: { id: string; full_name: string }) => [t.id, t.full_name]
          )
        );

        (activeLeasesData || []).forEach(
          (l: { unit_id: string; tenant_id: string | null }) => {
            const name = l.tenant_id ? tenantById.get(l.tenant_id) : undefined;
            if (name) tenantMap.set(l.unit_id, name);
          }
        );
      }
    }

    setTenantsByUnitId(tenantMap);

    /* 5. Conteo de leases activos por unidad — solo para by_room */
    const byRoomIds = sorted.filter((u) => u.rental_type === "by_room").map((u) => u.id);
    if (byRoomIds.length > 0) {
      const { data: byRoomLeases } = await supabase
        .from("leases")
        .select("unit_id")
        .in("unit_id", byRoomIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null);

      const countMap = new Map<string, number>();
      (byRoomLeases || []).forEach((l: { unit_id: string }) => {
        countMap.set(l.unit_id, (countMap.get(l.unit_id) || 0) + 1);
      });
      setActiveLeaseCountByUnitId(countMap);
    }

    setLoadingData(false);
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */

  function generateDisplayCode(buildingCode: string | null, unitNum: string) {
    if (!unitNum.trim()) return null;
    if (buildingCode?.trim()) return `${buildingCode.trim()}-${unitNum.trim()}`;
    return unitNum.trim();
  }

  async function cloneTemplateAssetsToUnit(
    newUnitId: string,
    selectedTypeId: string
  ): Promise<string | null> {
    if (!user?.company_id || !building) return null;

    const { data: templateAssets, error } = await supabase
      .from("unit_type_assets")
      .select("asset_type, name, status, notes, sort_order")
      .eq("unit_type_id", selectedTypeId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return error.message;
    if (!templateAssets?.length) return null;

    const rows = templateAssets.map((item) => ({
      company_id: user.company_id,
      building_id: building.id,
      unit_id: newUnitId,
      asset_type: item.asset_type,
      name: item.name,
      status: item.status || "ACTIVE",
      notes: item.notes || null,
    }));

    const { error: insertError } = await supabase.from("assets").insert(rows);
    return insertError ? insertError.message : null;
  }

  /* ── Handlers CRUD ───────────────────────────────────────────────── */

  async function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!user?.company_id)  { setMsg("No se encontró la empresa del usuario."); return; }
    if (!building)           { setMsg("No se encontró el edificio."); return; }
    if (!unitNumber.trim())  { setMsg("El número del departamento es obligatorio."); return; }
    if (!selectedUnitTypeId) { setMsg("Debes seleccionar una tipología."); return; }

    const displayCode = generateDisplayCode(building.code, unitNumber);
    setSaving(true);

    const { data: newUnit, error } = await supabase
      .from("units")
      .insert({
        company_id:   user.company_id,
        building_id:  building.id,
        unit_type_id: selectedUnitTypeId,
        unit_number:  unitNumber.trim(),
        display_code: displayCode,
        floor:        floor.trim() ? Number(floor) : null,
        status:       "VACANT",
      })
      .select("id")
      .single();

    if (error || !newUnit) {
      setSaving(false);
      setMsg(error?.message || "No se pudo crear el departamento.");
      return;
    }

    const cloneError = await cloneTemplateAssetsToUnit(newUnit.id, selectedUnitTypeId);
    setSaving(false);

    if (cloneError) {
      setMsg(`El departamento se creó, pero hubo un problema al clonar los assets base: ${cloneError}`);
      await loadPageData();
      return;
    }

    setUnitNumber("");
    setSelectedUnitTypeId("");
    setFloor("");
    setIsCreateModalOpen(false);
    setMsg("Departamento guardado correctamente. Si la tipología tenía equipos base, ya se clonaron automáticamente.");
    await loadPageData();
  }

  function openDeleteModal(unit: UnitRow) {
    setUnitToDelete(unit);
    setIsDeleteModalOpen(true);
    setOpenActionsUnitId(null);
    setMsg("");
    setDeleteError(null);
  }

  function openEditModal(unit: UnitRow) {
    setEditingUnit(unit);
    setEditUnitNumber(unit.unit_number);
    setEditFloor(unit.floor != null ? String(unit.floor) : "");
    setEditUnitTypeId(unit.unit_type_id);
    setIsEditModalOpen(true);
    setOpenActionsUnitId(null);
    setMsg("");
  }

  function closeEditModal() {
    if (saving) return;
    setIsEditModalOpen(false);
    setEditingUnit(null);
  }

  async function handleUpdateUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.company_id || !editingUnit || !building) return;
    if (!editUnitNumber.trim()) { setMsg("El número del departamento es obligatorio."); return; }

    setSaving(true);
    const displayCode = generateDisplayCode(building.code, editUnitNumber);
    const { error } = await supabase
      .from("units")
      .update({
        unit_number:  editUnitNumber.trim(),
        display_code: displayCode,
        floor:        editFloor.trim() ? Number(editFloor) : null,
        unit_type_id: editUnitTypeId || editingUnit.unit_type_id,
      })
      .eq("id", editingUnit.id)
      .eq("company_id", user.company_id);
    setSaving(false);

    if (error) { setMsg(`No se pudo actualizar el departamento. ${error.message}`); return; }
    setIsEditModalOpen(false);
    setEditingUnit(null);
    setMsg("Departamento actualizado correctamente.");
    await loadPageData();
  }

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setUnitToDelete(null);
    setDeleteError(null);
  }

  async function handleDeleteUnit() {
    if (!user?.company_id || !unitToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("units")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", unitToDelete.id)
      .eq("company_id", user.company_id);

    if (error) {
      setDeleteError(`No se pudo archivar el departamento. ${error.message}`);
      setDeleting(false);
      return;
    }
    setIsDeleteModalOpen(false);
    setUnitToDelete(null);
    setDeleting(false);
    setMsg("Departamento archivado correctamente.");
    await loadPageData();
  }

  /* ── Estadísticas ─────────────────────────────────────────────────── */

  const stats = useMemo(
    () => ({
      total:       units.length,
      rented:      units.filter((u) => ["RENTED", "OCCUPIED"].includes(normalizeStatus(u.status))).length,
      partial:     units.filter((u) => normalizeStatus(u.status) === "PARTIAL").length,
      vacant:      units.filter((u) => normalizeStatus(u.status) === "VACANT").length,
      maintenance: units.filter((u) => normalizeStatus(u.status) === "MAINTENANCE").length,
    }),
    [units]
  );

  /* ── Tipología seleccionada (para preview en modales) ─────────────── */

  const selectedTypeForCreate = unitTypes.find((ut) => ut.id === selectedUnitTypeId) ?? null;
  const selectedTypeForEdit   = unitTypes.find((ut) => ut.id === editUnitTypeId)     ?? null;

  /* ── Render ──────────────────────────────────────────────────────── */

  if (loading)     return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user)       return null;
  if (loadingData) return <PageContainer>Cargando departamentos...</PageContainer>;

  if (!building) {
    return (
      <PageContainer>
        <p>{msg || "No se encontró el edificio."}</p>
        <a href="/buildings" style={{ display: "inline-block", marginTop: 16, color: "var(--text-primary)" }}>
          Volver a edificios
        </a>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Departamentos — ${building.name}`}
        titleIcon={<DoorOpen size={20} />}
        subtitle="Crea, organiza y administra las unidades del edificio."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}`}>Volver al edificio</UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nuevo departamento
            </UiButton>
          </>
        }
      />

      {msg ? (
        <p style={{
          color: msg.includes("correctamente") ? "var(--badge-text-green)" : "var(--badge-text-red)",
          marginBottom: 16, fontSize: 14, fontWeight: 600,
        }}>
          {msg}
        </p>
      ) : null}

      {/* Métricas */}
      <AppGrid minWidth={180} gap={16} style={{ marginBottom: 24 }}>
        <MetricCard label="Total"            value={stats.total}       icon={<Warehouse size={18} />} helper="Unidades registradas" />
        <MetricCard label="Vacantes"         value={stats.vacant}      icon={<DoorOpen size={18} />}  helper="Disponibles para ocupación" variant="blue" />
        <MetricCard label="Parciales"        value={stats.partial}     icon={<BedDouble size={18} />} helper="Rentadas por cuarto" variant="amber" />
        <MetricCard label="Rentados"         value={stats.rented}      icon={<BedDouble size={18} />} helper="Con lease activo" variant="green" />
        <MetricCard label="Mantenimiento"    value={stats.maintenance} icon={<Wrench size={18} />}   helper="Requieren atención" variant="amber" />
      </AppGrid>

      {/* Grid de departamentos */}
      <SectionCard
        title="Departamentos del edificio"
        subtitle="Ordenados por número — entra al detalle o administra sus assets."
        icon={<FolderCog size={18} />}
      >
        {units.length === 0 ? (
          <AppEmptyState
            title="Todavía no hay departamentos"
            description="Crea la primera unidad del edificio y, si su tipología tiene assets base, el sistema los clonará automáticamente."
            actionLabel="Crear departamento"
            onAction={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {units.map((unit) => {
              const badge         = getUnitStatusBadge(unit.status);
              const tenantName    = tenantsByUnitId.get(unit.id);
              const typeInfo      = unit.unit_types;
              const isByRoom      = unit.rental_type === "by_room";
              const occupiedRooms = isByRoom ? (activeLeaseCountByUnitId.get(unit.id) ?? 0) : undefined;
              const totalRooms    = isByRoom ? (typeInfo?.bedrooms ?? 1) : undefined;

              return (
                <AppCard key={unit.id} style={{ padding: 16, position: "relative" }}>
                  {/* Mini dona — esquina superior derecha */}
                  <div style={{ position: "absolute", top: 12, right: 12 }}>
                    <MiniStatusRing status={unit.status} occupiedRooms={occupiedRooms} totalRooms={totalRooms} />
                  </div>

                  {/* Contenido con margen derecho para no solaparse con dona */}
                  <div style={{ paddingRight: 52 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 10 }}>
                      {/* Izquierda: número + código */}
                      <div style={{ flexShrink: 0 }}>
                        <p style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1, marginBottom: 3 }}>
                          {unit.unit_number}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1 }}>
                          {unit.display_code || "—"}
                        </p>
                      </div>

                      {/* Derecha: badges + detalles */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <AppBadge
                            backgroundColor={badge.backgroundColor}
                            textColor={badge.textColor}
                            borderColor={badge.borderColor}
                          >
                            {badge.label}
                          </AppBadge>
                          {isByRoom && occupiedRooms !== undefined && totalRooms !== undefined ? (
                            <AppBadge backgroundColor="var(--metric-bg-amber)" textColor="var(--badge-text-amber)" borderColor="var(--metric-border-amber)">
                              {occupiedRooms}/{totalRooms} cuartos
                            </AppBadge>
                          ) : null}
                          <AppBadge backgroundColor="var(--bg-page)" textColor="var(--text-secondary)" borderColor="var(--border-default)">
                            <Layers3 size={12} />
                            {typeInfo?.name || "Sin tipología"}
                          </AppBadge>
                        </div>

                        {/* Piso + recámaras + baños (datos de la tipología) */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "var(--text-secondary)", fontSize: 12 }}>
                          {unit.floor != null ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Hash size={11} />
                              Piso {unit.floor}
                            </span>
                          ) : null}
                          {typeInfo?.bedrooms != null ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <BedDouble size={11} />
                              {typeInfo.bedrooms} rec.
                            </span>
                          ) : null}
                          {typeInfo?.bathrooms != null ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Bath size={11} />
                              {typeInfo.bathrooms} baño{typeInfo.bathrooms !== 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Inquilino activo */}
                    {tenantName ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                        <User size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tenantName}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ height: "0.5px", background: "var(--border-default)", margin: "10px 0" }} />

                  {/* Acciones */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <UiButton href={`/buildings/${building.id}/units/${unit.id}`}>Ver</UiButton>

                    <div
                      style={{ position: "relative" }}
                      ref={openActionsUnitId === unit.id ? actionsMenuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenActionsUnitId(openActionsUnitId === unit.id ? null : unit.id)}
                        style={dropdownTriggerStyle}
                        aria-label="Más acciones"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openActionsUnitId === unit.id && (
                        <div style={dropdownMenuStyle}>
                          <button type="button" onClick={() => openEditModal(unit)}   style={dropdownActionButtonStyle}><Edit3 size={14} /> Editar</button>
                          <button type="button" onClick={() => openDeleteModal(unit)} style={dropdownDeleteItemStyle}><Trash2 size={14} /> Archivar</button>
                        </div>
                      )}
                    </div>
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Modal: editar ── */}
      <Modal open={isEditModalOpen} onClose={closeEditModal} title="Editar departamento">
        <form onSubmit={handleUpdateUnit}>
          <AppFormField label="Número de departamento" required>
            <input
              value={editUnitNumber}
              onChange={(e) => setEditUnitNumber(e.target.value)}
              placeholder="Ej. 101"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <AppFormField label="Tipología">
              <AppSelect value={editUnitTypeId} onChange={(e) => setEditUnitTypeId(e.target.value)}>
                {unitTypes.map((ut) => <option key={ut.id} value={ut.id}>{ut.name}</option>)}
              </AppSelect>
            </AppFormField>
            <AppFormField label="Piso">
              <input
                type="number" min={0} value={editFloor}
                onChange={(e) => setEditFloor(e.target.value)}
                placeholder="Ej. 1" style={INPUT_STYLE}
              />
            </AppFormField>
          </div>

          {/* Preview de recámaras/baños de la tipología seleccionada */}
          {selectedTypeForEdit ? (
            <TypePreview type={selectedTypeForEdit} />
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar cambios"}
            </UiButton>
            <UiButton type="button" onClick={closeEditModal}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal: archivar ── */}
      <Modal open={isDeleteModalOpen} onClose={closeDeleteModal} title="Archivar departamento" maxWidth="480px">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={warnBannerStyle}>
            ¿Archivar el departamento <strong>{unitToDelete?.unit_number}</strong>? Esta acción lo
            ocultará del sistema pero conservará toda su información.
          </div>
          {deleteError ? <div style={errorBannerStyle}>{deleteError}</div> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              Cancelar
            </UiButton>
            <UiButton type="button" onClick={() => void handleDeleteUnit()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Archivando..." : "Archivar departamento"}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: crear ── */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear departamento"
        subtitle="Los assets base de la tipología se clonarán automáticamente al guardar."
      >
        <form onSubmit={handleCreateUnit}>
          <AppFormField label="Número de departamento" required>
            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Ej. 101"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <AppFormField label="Tipología" required>
              <AppSelect value={selectedUnitTypeId} onChange={(e) => setSelectedUnitTypeId(e.target.value)}>
                <option value="">Selecciona una tipología</option>
                {unitTypes.map((ut) => <option key={ut.id} value={ut.id}>{ut.name}</option>)}
              </AppSelect>
            </AppFormField>
            <AppFormField label="Piso">
              <input
                type="number" min={0} value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="Ej. 1" style={INPUT_STYLE}
              />
            </AppFormField>
          </div>

          {/* Preview de recámaras/baños de la tipología seleccionada */}
          {selectedTypeForCreate ? (
            <TypePreview type={selectedTypeForCreate} />
          ) : null}

          {building.code && unitNumber.trim() ? (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
              Código generado: <strong>{generateDisplayCode(building.code, unitNumber)}</strong>
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar departamento"}
            </UiButton>
            <UiButton type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}

/* ─── TypePreview — muestra recámaras/baños de la tipología ─────────── */

function TypePreview({ type }: { type: UnitType }) {
  const hasBed  = type.bedrooms  != null;
  const hasBath = type.bathrooms != null;
  if (!hasBed && !hasBath) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--bg-page)",
        border: "1px solid var(--border-default)",
        marginBottom: 16,
        fontSize: 13,
        color: "var(--text-secondary)",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-muted)", marginRight: 4 }}>
        {type.name}:
      </span>
      {hasBed ? (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <BedDouble size={14} />
          {type.bedrooms} recámara{type.bedrooms !== 1 ? "s" : ""}
        </span>
      ) : null}
      {hasBath ? (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Bath size={14} />
          {type.bathrooms} baño{type.bathrooms !== 1 ? "s" : ""}
        </span>
      ) : null}
    </div>
  );
}
