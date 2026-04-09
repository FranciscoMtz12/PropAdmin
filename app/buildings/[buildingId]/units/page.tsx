"use client";

/*
  Página para administrar departamentos (units) de un edificio específico.

  Esta versión mantiene toda la lógica existente del sistema, pero actualiza la UI
  para que siga el mismo design system global de PropAdmin:
  - métricas arriba
  - cards visuales con iconos
  - badges de estado
  - empty state consistente
  - formulario de creación con AppFormField y AppSelect

  Además sigue haciendo lo más importante:
  - crear departamentos
  - asociarlos a una tipología
  - clonar automáticamente los assets base de la tipología elegida
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BedDouble,
  DoorOpen,
  Edit3,
  FolderCog,
  Hash,
  Layers3,
  MoreHorizontal,
  Plus,
  Trash2,
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
import AppIconBox from "@/components/AppIconBox";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";

/*
  Tipo para el edificio actual.
*/
type Building = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
};

/*
  Tipo para las tipologías disponibles del edificio.
*/
type UnitType = {
  id: string;
  building_id: string;
  name: string;
};

/*
  Tipo para un departamento con el nombre de su tipología.
*/
type UnitRow = {
  id: string;
  company_id: string;
  building_id: string;
  unit_type_id: string;
  unit_number: string;
  display_code: string | null;
  floor: number | null;
  status: string;
  unit_types: {
    name: string;
  } | null;
};

const dropdownTriggerStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 10, border: "1px solid #E5E7EB", background: "#FFFFFF",
  color: "#111827", padding: "8px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};

const dropdownMenuStyle: React.CSSProperties = {
  position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 160,
  borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF",
  boxShadow: "0 10px 28px rgba(15,23,42,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 30,
};

const dropdownItemStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, width: "100%",
  border: "none", background: "transparent", color: "#111827",
  borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const dropdownDeleteItemStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, width: "100%",
  border: "none", background: "#FEF2F2", color: "#B42318",
  borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

function getUnitStatusBadge(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "OCCUPIED":
      return {
        label: "Ocupado",
        backgroundColor: "#DCFCE7",
        textColor: "#166534",
        borderColor: "#BBF7D0",
      };
    case "MAINTENANCE":
      return {
        label: "Mantenimiento",
        backgroundColor: "#FEF3C7",
        textColor: "#92400E",
        borderColor: "#FDE68A",
      };
    case "VACANT":
    default:
      return {
        label: "Vacante",
        backgroundColor: "#EEF2FF",
        textColor: "#4338CA",
        borderColor: "#C7D2FE",
      };
  }
}

export default function BuildingUnitsPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params.buildingId as string;

  const { user, loading } = useCurrentUser();

  /*
    Estados principales de la página.
  */
  const [building, setBuilding] = useState<Building | null>(null);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);

  /*
    Estados del formulario para crear departamentos.
  */
  const [unitNumber, setUnitNumber] = useState("");
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [floor, setFloor] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  /*
    Estados del modal de archivar.
  */
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<UnitRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /*
    Estados del modal de edición.
  */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [editUnitNumber, setEditUnitNumber] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editUnitTypeId, setEditUnitTypeId] = useState("");

  /*
    Control de dropdown de acciones por unidad.
  */
  const [openActionsUnitId, setOpenActionsUnitId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  /*
    Estados auxiliares.
  */
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  /*
    Si no hay usuario, lo mandamos al login.
  */
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  /*
    Cuando ya existe usuario y buildingId, cargamos:
    - edificio
    - tipologías del edificio
    - departamentos del edificio
  */
  useEffect(() => {
    if (user?.company_id && buildingId) {
      loadPageData();
    }
  }, [user, buildingId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(event.target as Node)) {
        setOpenActionsUnitId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /*
    Función principal para cargar todos los datos necesarios de la página.
  */
  async function loadPageData() {
    if (!user?.company_id || !buildingId) return;

    setLoadingData(true);
    setMsg("");

    /*
      1) Cargar el edificio y validar que pertenezca a la empresa del usuario.
    */
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

    /*
      2) Cargar tipologías de este edificio.
    */
    const { data: unitTypeData, error: unitTypeError } = await supabase
      .from("unit_types")
      .select("id, building_id, name")
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (unitTypeError) {
      setMsg("No se pudieron cargar las tipologías del edificio.");
      setLoadingData(false);
      return;
    }

    setUnitTypes(unitTypeData || []);

    /*
      3) Cargar departamentos del edificio.
      Traemos también el nombre de la tipología relacionada.
    */
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
        unit_types(name)
      `)
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (unitError) {
      setMsg("No se pudieron cargar los departamentos.");
      setLoadingData(false);
      return;
    }

    if (unitData) {
      setUnits(unitData as unknown as UnitRow[]);
    } else {
      setUnits([]);
    }

    setLoadingData(false);
  }

  /*
    Genera un display_code amigable.
    Si el edificio tiene código:
      E1 + 101 => E1-101
    Si no tiene código:
      usa solo el número del departamento
  */
  function generateDisplayCode(buildingCode: string | null, unitNumberValue: string) {
    if (!unitNumberValue.trim()) return null;

    if (buildingCode && buildingCode.trim()) {
      return `${buildingCode.trim()}-${unitNumberValue.trim()}`;
    }

    return unitNumberValue.trim();
  }

  /*
    Clona a la tabla real de assets todos los assets base definidos en la
    tipología seleccionada.
  */
  async function cloneTemplateAssetsToUnit(newUnitId: string, selectedTypeId: string) {
    if (!user?.company_id || !building) return null;

    const { data: templateAssets, error: templateAssetsError } = await supabase
      .from("unit_type_assets")
      .select("asset_type, name, status, notes, sort_order")
      .eq("unit_type_id", selectedTypeId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (templateAssetsError) {
      return templateAssetsError.message;
    }

    if (!templateAssets || templateAssets.length === 0) {
      return null;
    }

    const assetRowsToInsert = templateAssets.map((item) => ({
      company_id: user.company_id,
      building_id: building.id,
      unit_id: newUnitId,
      asset_type: item.asset_type,
      name: item.name,
      status: item.status || "ACTIVE",
      notes: item.notes || null,
    }));

    const { error: insertAssetsError } = await supabase
      .from("assets")
      .insert(assetRowsToInsert);

    if (insertAssetsError) {
      return insertAssetsError.message;
    }

    return null;
  }

  /*
    Crea un departamento nuevo dentro del edificio y clona sus assets base.
  */
  async function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!user?.company_id) {
      setMsg("No se encontró la empresa del usuario.");
      return;
    }

    if (!building) {
      setMsg("No se encontró el edificio.");
      return;
    }

    if (!unitNumber.trim()) {
      setMsg("El número del departamento es obligatorio.");
      return;
    }

    if (!selectedUnitTypeId) {
      setMsg("Debes seleccionar una tipología.");
      return;
    }

    const displayCode = generateDisplayCode(building.code, unitNumber);

    setSaving(true);

    const { data: newUnit, error } = await supabase
      .from("units")
      .insert({
        company_id: user.company_id,
        building_id: building.id,
        unit_type_id: selectedUnitTypeId,
        unit_number: unitNumber.trim(),
        display_code: displayCode,
        floor: floor.trim() ? Number(floor) : null,
        status: "VACANT",
      })
      .select("id")
      .single();

    if (error || !newUnit) {
      setSaving(false);
      setMsg(error?.message || "No se pudo crear el departamento.");
      return;
    }

    const cloneErrorMessage = await cloneTemplateAssetsToUnit(newUnit.id, selectedUnitTypeId);

    setSaving(false);

    if (cloneErrorMessage) {
      setMsg(`El departamento se creó, pero hubo un problema al clonar los assets base: ${cloneErrorMessage}`);
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
    setEditFloor(unit.floor !== null ? String(unit.floor) : "");
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
        unit_number: editUnitNumber.trim(),
        display_code: displayCode,
        floor: editFloor.trim() ? Number(editFloor) : null,
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

  const stats = useMemo(() => {
    return {
      total: units.length,
      vacant: units.filter((unit) => unit.status === "VACANT").length,
      occupied: units.filter((unit) => unit.status === "OCCUPIED").length,
      maintenance: units.filter((unit) => unit.status === "MAINTENANCE").length,
    };
  }, [units]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "white", color: "black" }}>
        Cargando usuario...
      </div>
    );
  }

  if (!user) return null;

  if (loadingData) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "white", color: "black" }}>
        Cargando departamentos...
      </div>
    );
  }

  if (!building) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "white", color: "black" }}>
        <p>{msg || "No se encontró el edificio."}</p>
        <a href="/buildings" style={{ display: "inline-block", marginTop: "16px", color: "black" }}>
          Volver a edificios
        </a>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Departamentos — ${building.name}`}
        titleIcon={<DoorOpen size={20} />}
        subtitle="Crea, organiza y administra las unidades del edificio dentro del mismo lenguaje visual del resto de PropAdmin."
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
        <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: "16px" }}>
          {msg}
        </p>
      ) : null}

      <AppGrid minWidth={220} gap={16} style={{ marginBottom: 24 }}>
        <MetricCard
          label="Total de departamentos"
          value={stats.total}
          icon={<Warehouse size={18} />}
          helper="Unidades registradas"
        />
        <MetricCard
          label="Vacantes"
          value={stats.vacant}
          icon={<DoorOpen size={18} />}
          helper="Disponibles para ocupación"
        />
        <MetricCard
          label="Ocupados"
          value={stats.occupied}
          icon={<BedDouble size={18} />}
          helper="Con lease activo"
        />
        <MetricCard
          label="En mantenimiento"
          value={stats.maintenance}
          icon={<Wrench size={18} />}
          helper="Requieren atención"
        />
      </AppGrid>

      <SectionCard
        title="Departamentos del edificio"
        subtitle="Desde aquí puedes entrar al detalle o administrar sus assets reales."
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
          <AppGrid minWidth={300} gap={16}>
            {units.map((unit) => {
              const unitStatus = getUnitStatusBadge(unit.status);

              return (
                <AppCard key={unit.id} style={{ padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <AppIconBox>
                      <DoorOpen size={18} />
                    </AppIconBox>

                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 18, marginBottom: 4 }}>
                        Departamento {unit.unit_number}
                      </strong>
                      <p style={{ color: "#667085", margin: 0, fontSize: 14 }}>
                        {unit.display_code || "Sin código visible"}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <AppBadge
                      backgroundColor={unitStatus.backgroundColor}
                      textColor={unitStatus.textColor}
                      borderColor={unitStatus.borderColor}
                    >
                      {unitStatus.label}
                    </AppBadge>

                    <AppBadge backgroundColor="#F8FAFC" textColor="#475467" borderColor="#E2E8F0">
                      <Layers3 size={14} />
                      {unit.unit_types?.name || "Sin tipología"}
                    </AppBadge>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#667085", fontSize: 14 }}>
                      <Hash size={14} />
                      <span>Piso: {unit.floor ?? "Sin piso"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#667085", fontSize: 14 }}>
                      <Layers3 size={14} />
                      <span>Tipo: {unit.unit_types?.name || "No asignada"}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <UiButton href={`/buildings/${building.id}/units/${unit.id}`}>
                        Ver departamento
                      </UiButton>
                      <UiButton href={`/buildings/${building.id}/units/${unit.id}/assets`}>
                        Administrar assets
                      </UiButton>
                    </div>
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
                          <button type="button" onClick={() => openEditModal(unit)} style={dropdownItemStyle}>
                            <Edit3 size={14} />
                            Editar
                          </button>
                          <button type="button" onClick={() => openDeleteModal(unit)} style={dropdownDeleteItemStyle}>
                            <Trash2 size={14} />
                            Archivar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </AppCard>
              );
            })}
          </AppGrid>
        )}
      </SectionCard>

      <Modal open={isEditModalOpen} onClose={closeEditModal} title="Editar departamento">
        <form onSubmit={handleUpdateUnit}>
          <AppFormField label="Número de departamento" required>
            <input
              value={editUnitNumber}
              onChange={(e) => setEditUnitNumber(e.target.value)}
              placeholder="Ej. 101"
              style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10 }}
            />
          </AppFormField>
          <AppFormField label="Tipología">
            <AppSelect value={editUnitTypeId} onChange={(e) => setEditUnitTypeId(e.target.value)}>
              {unitTypes.map((ut) => (
                <option key={ut.id} value={ut.id}>{ut.name}</option>
              ))}
            </AppSelect>
          </AppFormField>
          <AppFormField label="Piso (opcional)">
            <input
              type="number"
              value={editFloor}
              onChange={(e) => setEditFloor(e.target.value)}
              placeholder="Ej. 1"
              style={{ width: "100%", padding: 12, border: "1px solid #D0D5DD", borderRadius: 10 }}
            />
          </AppFormField>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar cambios"}
            </UiButton>
            <UiButton type="button" onClick={closeEditModal}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>

      <Modal open={isDeleteModalOpen} onClose={closeDeleteModal} title="Archivar departamento" maxWidth="480px">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
            ¿Archivar el departamento <strong>{unitToDelete?.unit_number}</strong>? Esta acción lo ocultará del sistema pero conservará toda su información.
          </div>
          {deleteError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{deleteError}</div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>Cancelar</UiButton>
            <UiButton type="button" onClick={() => void handleDeleteUnit()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Archivando..." : "Archivar departamento"}
            </UiButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear departamento"
        subtitle="El formulario se abre solo cuando lo necesitas para que la página no se sienta saturada."
      >
        <form onSubmit={handleCreateUnit}>
          <AppFormField label="Número de departamento" required>
            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Ej. 101"
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #D0D5DD",
                borderRadius: 10,
              }}
            />
          </AppFormField>

          <AppFormField label="Tipología" required>
            <AppSelect
              value={selectedUnitTypeId}
              onChange={(e) => setSelectedUnitTypeId(e.target.value)}
            >
              <option value="">Selecciona una tipología</option>
              {unitTypes.map((unitType) => (
                <option key={unitType.id} value={unitType.id}>
                  {unitType.name}
                </option>
              ))}
            </AppSelect>
          </AppFormField>

          <AppFormField label="Piso (opcional)">
            <input
              type="number"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="Ej. 1"
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #D0D5DD",
                borderRadius: 10,
              }}
            />
          </AppFormField>

          {building.code && unitNumber.trim() ? (
            <p style={{ fontSize: "12px", color: "#667085", marginBottom: "16px" }}>
              Display code que se generará: {generateDisplayCode(building.code, unitNumber)}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : "Guardar departamento"}
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(false)}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
