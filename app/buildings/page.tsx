"use client";

/*
  Página principal de edificios.

  Esta versión ya adopta el lenguaje visual que definimos para todo PropAdmin:
  - PageContainer centrado
  - PageHeader con icono
  - métricas en cards
  - lista en cards con iconografía
  - formulario de creación dentro de modal
  - componentes reutilizables para evitar código repetido
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Edit3,
  Filter,
  MapPin,
  Plus,
  Tags,
  MoreHorizontal,
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

function getCategoryStats(buildings: Building[]) {
  return {
    total: buildings.length,
    mixedUse: buildings.filter((item) => item.building_category === "mixed_use").length,
    residential: buildings.filter((item) => item.building_category === "residential").length,
  };
}

const dropdownTriggerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  color: "#111827",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const dropdownMenuStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  minWidth: 180,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
  padding: 6,
  display: "grid",
  gap: 4,
  zIndex: 30,
};

const dropdownActionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  border: "none",
  background: "transparent",
  color: "#111827",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const dropdownDeleteItemStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  border: "none",
  background: "#FEF2F2",
  color: "#B42318",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #D0D5DD",
  borderRadius: 10,
  background: "white",
};

export default function BuildingsPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [buildingEditingId, setBuildingEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [buildingCategory, setBuildingCategory] = useState("residential");
  const [buildingSubcategory, setBuildingSubcategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);
  const [buildingDeleteEligibility, setBuildingDeleteEligibility] = useState<{
    canDelete: boolean;
    unitCount: number;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsBuildingId, setOpenActionsBuildingId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadBuildings = useCallback(async () => {
    if (!user?.company_id) return;

    setLoadingBuildings(true);

    const { data, error } = await supabase
      .from("buildings")
      .select(
        "id, company_id, name, address, code, building_category, building_subcategory"
      )
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("No se pudieron cargar los edificios.");
      setLoadingBuildings(false);
      return;
    }

    setBuildings((data as Building[]) || []);
    setLoadingBuildings(false);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(event.target as Node)) {
        setOpenActionsBuildingId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Con soft delete no necesitamos pre-verificar relaciones.
  // Limpiamos la elegibilidad cuando se cierra el modal.
  useEffect(() => {
    if (!buildingToDelete) {
      setBuildingDeleteEligibility(null);
    }
  }, [buildingToDelete]);

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
    setBuildingDeleteEligibility(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setBuildingToDelete(null);
    setDeleteError(null);
    setBuildingDeleteEligibility(null);
  }

  async function handleSubmitBuilding(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!user?.company_id) {
      setMsg("No se encontró la empresa del usuario.");
      return;
    }

    if (!name.trim()) {
      setMsg("El nombre del edificio es obligatorio.");
      return;
    }

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
      building_subcategory:
        buildingCategory === "mixed_use" ? buildingSubcategory || null : null,
    });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

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

    if (!name.trim()) {
      setMsg("El nombre del edificio es obligatorio.");
      return;
    }

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
        building_subcategory:
          buildingCategory === "mixed_use" ? buildingSubcategory || null : null,
      })
      .eq("id", buildingEditingId)
      .eq("company_id", user.company_id);

    setSaving(false);

    if (error) {
      setMsg(`No se pudo actualizar el edificio. ${error.message}`);
      return;
    }

    closeEditModal();
    await loadBuildings();
    setMsg("Edificio actualizado correctamente.");
  }

  async function handleDeleteBuilding() {
    if (!user?.company_id || !buildingToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    // Soft delete: marca deleted_at en lugar de eliminar físicamente
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
    setBuildingDeleteEligibility(null);
    setDeleting(false);
    setMsg("Edificio archivado correctamente.");
    await loadBuildings();
  }

  useEffect(() => {
    if (user?.company_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadBuildings();
    }
  }, [loadBuildings, user?.company_id]);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      return selectedCategory === "ALL" || building.building_category === selectedCategory;
    });
  }, [buildings, selectedCategory]);

  const stats = useMemo(() => getCategoryStats(buildings), [buildings]);

  if (loading) return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user) return null;

  return (
    <PageContainer>
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
          marginBottom: 24,
        }}
      >
        <MetricCard
          label="Total de edificios"
          value={stats.total}
          icon={<Warehouse size={18} />}
          helper="Portafolio actual"
        />
        <MetricCard
          label="Residenciales"
          value={stats.residential}
          icon={<Building2 size={18} />}
          helper="Uso habitacional"
        />
        <MetricCard
          label="Uso mixto"
          value={stats.mixedUse}
          icon={<Tags size={18} />}
          helper="Subcategorías activas"
        />
      </div>

      <SectionCard
        title="Portafolio"
        icon={<Filter size={18} />}
        action={
          <div style={{ minWidth: 220 }}>
            <AppSelect value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
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
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {filteredBuildings.map((building) => (
              <AppCard key={building.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "#EEF2FF",
                      color: "#4338CA",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={`/buildings/${building.id}`}
                      style={{
                        display: "inline-block",
                        fontSize: 18,
                        marginBottom: 4,
                        fontWeight: 700,
                        color: "#111827",
                        textDecoration: "none",
                      }}
                    >
                      {building.name}
                    </Link>
                    <p style={{ color: "#667085", margin: 0, fontSize: 14 }}>
                      {building.code || "Sin código"}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 12,
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
                      {getMixedUseSubcategoryLabel(building.building_subcategory)}
                    </span>
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 16,
                    color: "#667085",
                  }}
                >
                  <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {building.address || "Sin dirección registrada"}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/buildings/${building.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#4338CA",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    Ver detalle del edificio
                  </Link>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Link
                      href={`/buildings/${building.id}/units`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderRadius: 10,
                        border: "1px solid #E5E7EB",
                        background: "#FFFFFF",
                        color: "#111827",
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Departamentos
                    </Link>

                    <div
                      style={{ position: "relative" }}
                      ref={openActionsBuildingId === building.id ? actionsMenuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenActionsBuildingId(
                            openActionsBuildingId === building.id ? null : building.id
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
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modal de edición */}
      <Modal
        open={isEditModalOpen}
        onClose={closeEditModal}
        title="Editar edificio"
      >
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

      {/* Modal de archivar */}
      <Modal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="Archivar edificio"
        maxWidth="480px"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: "#FFF7ED",
              border: "1px solid #FED7AA",
              color: "#9A3412",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            ¿Archivar el edificio{" "}
            <strong>{buildingToDelete?.name}</strong>? Esta acción lo ocultará del
            sistema pero conservará toda su información.
          </div>

          {deleteError ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#B91C1C",
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {deleteError}
            </div>
          ) : null}

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

      {/* Modal de creación */}
      <Modal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Crear edificio"
      >
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
            <UiButton type="button" onClick={closeCreateModal}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
