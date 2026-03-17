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
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Droplets,
  Edit3,
  Filter,
  MapPin,
  Plus,
  Tags,
  MoreHorizontal,
  Trash2,
  Warehouse,
  Zap,
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


type BuildingBillingConceptCode = "rent" | "electricity" | "water";

type BuildingBillingConceptRow = {
  id: string;
  building_id: string;
  concept_code: BuildingBillingConceptCode;
  is_active: boolean;
};

const BILLING_CONCEPT_OPTIONS: Array<{
  code: BuildingBillingConceptCode;
  label: string;
  icon: React.ReactNode;
}> = [
  { code: "rent", label: "Renta", icon: <CreditCard size={14} /> },
  { code: "electricity", label: "Electricidad", icon: <Zap size={14} /> },
  { code: "water", label: "Agua", icon: <Droplets size={14} /> },
];

function BuildingBillingConceptsPanel({
  buildingId,
  companyId,
}: {
  buildingId: string;
  companyId: string;
}) {
  const [rows, setRows] = useState<BuildingBillingConceptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<BuildingBillingConceptCode | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("building_billing_concepts")
      .select("id, building_id, concept_code, is_active")
      .eq("building_id", buildingId);

    if (error) {
      console.error("No se pudieron cargar los conceptos de facturación:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as BuildingBillingConceptRow[]) || []);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function toggleConcept(conceptCode: BuildingBillingConceptCode) {
    setSavingCode(conceptCode);

    const existing = rows.find((item) => item.concept_code === conceptCode);

    const { error } = await supabase
      .from("building_billing_concepts")
      .upsert(
        {
          company_id: companyId,
          building_id: buildingId,
          concept_code: conceptCode,
          is_active: existing ? !existing.is_active : true,
        },
        { onConflict: "building_id,concept_code" }
      );

    if (error) {
      console.error("No se pudo actualizar el concepto de facturación:", error);
      setSavingCode(null);
      return;
    }

    await loadRows();
    setSavingCode(null);
  }

  return (
    <div
      style={{
        borderTop: "1px solid #E5E7EB",
        marginTop: 12,
        paddingTop: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gap: 2 }}>
        <strong style={{ fontSize: 14, color: "#111827" }}>Conceptos de facturación</strong>
        <span style={{ fontSize: 12, color: "#667085" }}>
          Define qué facturas se deben generar cada mes para este edificio.
        </span>
      </div>

      {loading ? (
        <span style={{ fontSize: 13, color: "#667085" }}>Cargando configuración...</span>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {BILLING_CONCEPT_OPTIONS.map((option) => {
            const existing = rows.find((item) => item.concept_code === option.code);
            const active = Boolean(existing?.is_active);
            const isSaving = savingCode === option.code;

            return (
              <button
                key={option.code}
                type="button"
                onClick={() => void toggleConcept(option.code)}
                disabled={isSaving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  border: active ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                  background: active ? "#ECFDF5" : "#F9FAFB",
                  color: active ? "#166534" : "#475467",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isSaving ? "wait" : "pointer",
                  opacity: isSaving ? 0.72 : 1,
                }}
              >
                {option.icon}
                {isSaving
                  ? "Guardando..."
                  : `${option.label}${active ? " activa" : " inactiva"}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

const dropdownItemLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  border: "none",
  background: "transparent",
  textDecoration: "none",
  color: "#111827",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
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
  }

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setBuildingToDelete(null);
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
    setMsg("");

    const { error } = await supabase
      .from("buildings")
      .delete()
      .eq("id", buildingToDelete.id)
      .eq("company_id", user.company_id);

    if (error) {
      const hasRelationsError =
        error.code === "23503" ||
        error.message.toLowerCase().includes("foreign key") ||
        error.message.toLowerCase().includes("constraint");

      setMsg(
        hasRelationsError
          ? "No se puede eliminar el edificio porque tiene registros relacionados."
          : `No se pudo eliminar el edificio. ${error.message}`
      );
      setDeleting(false);
      return;
    }

    setIsDeleteModalOpen(false);
    setBuildingToDelete(null);
    setDeleting(false);
    setMsg("Edificio eliminado correctamente.");
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
                    <strong
                      style={{
                        display: "block",
                        fontSize: 18,
                        marginBottom: 4,
                      }}
                    >
                      {building.name}
                    </strong>
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

                <BuildingBillingConceptsPanel
                  buildingId={building.id}
                  companyId={building.company_id}
                />

                <div
                  style={{ position: "relative", display: "inline-block" }}
                  ref={openActionsBuildingId === building.id ? actionsMenuRef : null}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenActionsBuildingId((prev) =>
                        prev === building.id ? null : building.id
                      )
                    }
                    style={dropdownTriggerStyle}
                  >
                    <MoreHorizontal size={14} />
                    Acciones
                  </button>

                  {openActionsBuildingId === building.id ? (
                    <div style={dropdownMenuStyle}>
                      <a href={`/buildings/${building.id}`} style={dropdownItemLinkStyle}>
                        Ver edificio
                      </a>
                      <a href={`/buildings/${building.id}/units`} style={dropdownItemLinkStyle}>
                        Departamentos
                      </a>
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
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </SectionCard>

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

      <Modal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="Eliminar edificio"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: 14,
              borderRadius: 12,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEE2E2",
                color: "#B91C1C",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "#991B1B" }}>
                ¿Seguro que quieres eliminar este edificio?
              </p>
              <p style={{ margin: "6px 0 0", color: "#7F1D1D" }}>
                Se eliminará <strong>{buildingToDelete?.name || "este edificio"}</strong> del
                portafolio. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <UiButton onClick={closeDeleteModal} disabled={deleting}>
              Cancelar
            </UiButton>
            <UiButton onClick={() => void handleDeleteBuilding()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : "Sí, eliminar edificio"}
            </UiButton>
          </div>
        </div>
      </Modal>

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