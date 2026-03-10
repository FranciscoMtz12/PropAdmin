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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Filter,
  MapPin,
  Plus,
  Tags,
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
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [buildingCategory, setBuildingCategory] = useState("residential");
  const [buildingSubcategory, setBuildingSubcategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id) {
      loadBuildings();
    }
  }, [user]);

  async function loadBuildings() {
    if (!user?.company_id) return;

    setLoadingBuildings(true);
    setMsg("");

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
  }

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
        subtitle="Administra el portafolio de propiedades usando cards, iconos y el mismo patrón visual del resto de PropAdmin."
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
        subtitle="Filtra y navega por los edificios con una vista más visual y consistente."
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

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <UiButton href={`/buildings/${building.id}`}>Ver edificio</UiButton>
                  <UiButton href={`/buildings/${building.id}/units`}>
                    Departamentos
                  </UiButton>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Crear edificio"
        subtitle="El formulario aparece solo cuando lo necesitas para mantener la lista principal limpia."
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
            <UiButton onClick={closeCreateModal}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
