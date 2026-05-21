"use client";

/*
  Página para administrar tipologías específicas de un edificio.

  IMPORTANTE:
  En tu sistema las tipologías NO son globales.
  Cada edificio tiene sus propias tipologías.

  Esta versión mantiene lo que ya tenías y agrega coherencia con tu
  nuevo flujo Lista -> Detalle -> Edición:

  - cargar el edificio
  - listar tipologías del edificio
  - crear tipologías
  - editar tipologías desde esta misma página (sin romper lo ya hecho)
  - botón para ver el detalle de la tipología
  - contador de assets base por tipología

  Nota:
  Aunque esta pantalla sigue permitiendo edición rápida, el nuevo flujo
  recomendado ya queda disponible entrando al detalle de la tipología.
*/

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { Bath, BedDouble, Edit3, LayoutPanelTop, MoreHorizontal, PackageOpen, Plus, Sofa, Trash2, UtensilsCrossed } from "lucide-react";
import UnitTypeWizardModal from "@/components/UnitTypeWizardModal";

/*
  Tipo TypeScript para el edificio actual.
*/
type Building = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
};

/*
  Tipo TypeScript para una tipología.

  asset_template_count es opcional porque puede venir nulo
  si una tipología todavía no tiene assets base cargados.
*/
type UnitType = {
  id: string;
  building_id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  has_living_room: boolean;
  has_dining_room: boolean;
  has_patio: boolean;
  has_fridge: boolean;
  has_washer: boolean;
  has_dryer: boolean;
  stove_type: string;
  asset_template_count?: number;
};

type UnitTypeAssetCountRow = {
  unit_type_id: string;
};

const dropdownTriggerStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--bg-card)",
  color: "var(--text-primary)", padding: "8px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};

const dropdownMenuStyle: React.CSSProperties = {
  position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 160,
  borderRadius: 12, border: "1px solid var(--border-default)", background: "var(--bg-card)",
  boxShadow: "0 10px 28px rgba(15,23,42,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 30,
};

const dropdownItemStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, width: "100%",
  border: "none", background: "transparent", color: "var(--text-primary)",
  borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const dropdownDeleteItemStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, width: "100%",
  border: "none", background: "var(--badge-bg-red)", color: "var(--badge-text-red)",
  borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const errorTextStyle: React.CSSProperties = {
  color: "#EF4444",
  fontSize: 12,
  marginTop: 4,
  marginBottom: 0,
};

const unitTypeSchema = z.object({
  name: z.string().min(1, "El nombre de la tipología es obligatorio"),
  bedrooms: z.number().int().min(0, "No puede ser negativo"),
  bathrooms: z.number().int().min(0, "No puede ser negativo"),
  hasLivingRoom: z.boolean(),
  hasDiningRoom: z.boolean(),
  hasPatio: z.boolean(),
  hasFridge: z.boolean(),
  hasWasher: z.boolean(),
  hasDryer: z.boolean(),
  stoveType: z.enum(["NONE", "GAS", "ELECTRIC"]),
});
type UnitTypeFormValues = z.infer<typeof unitTypeSchema>;

const UNIT_TYPE_DEFAULTS: UnitTypeFormValues = {
  name: "",
  bedrooms: 1,
  bathrooms: 1,
  hasLivingRoom: false,
  hasDiningRoom: false,
  hasPatio: false,
  hasFridge: false,
  hasWasher: false,
  hasDryer: false,
  stoveType: "NONE",
};

export default function BuildingUnitTypesPage() {
  /*
    Router para navegación interna.
  */
  const router = useRouter();

  /*
    useParams nos permite leer el parámetro dinámico de la ruta.
    Ejemplo:
    /buildings/abc123/unit-types
    → buildingId = "abc123"
  */
  const params = useParams();
  const buildingId = params.buildingId as string;

  /*
    Usuario actual desde el contexto global.
  */
  const { user, loading } = useCurrentUser();

  /*
    Estados de datos principales.
  */
  const [building, setBuilding] = useState<Building | null>(null);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);

  /*
    Formulario controlado por react-hook-form + zod.
    Sirve tanto para crear como para editar (reset con valores del item).
  */
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitTypeFormValues>({
    resolver: zodResolver(unitTypeSchema),
    defaultValues: UNIT_TYPE_DEFAULTS,
  });

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  /*
    Si editingUnitTypeId tiene valor, estamos editando.
    Si es null, estamos creando una tipología nueva.
  */
  const [editingUnitTypeId, setEditingUnitTypeId] = useState<string | null>(null);

  /*
    Estados del modal de eliminar.
  */
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitTypeToDelete, setUnitTypeToDelete] = useState<UnitType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /*
    Control de dropdown de acciones por tipología.
  */
  const [openActionsUnitTypeId, setOpenActionsUnitTypeId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  /*
    Estados auxiliares.
  */
  const [msg, setMsg] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  /*
    Si no hay usuario autenticado, mandamos al login.
  */
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  /*
    Cuando ya tenemos usuario y buildingId,
    cargamos:
    - el edificio
    - las tipologías de ese edificio
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
        setOpenActionsUnitTypeId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /*
    Carga:
    1. el edificio actual
    2. las tipologías de ese edificio
    3. el conteo de assets base por tipología

    Además valida que el edificio pertenezca
    a la empresa del usuario actual.
  */
  async function loadPageData() {
    if (!user?.company_id || !buildingId) return;

    setLoadingData(true);
    setMsg("");

    /*
      Traemos el edificio actual.
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
      Traemos las tipologías de este edificio.
    */
    const { data: unitTypeData, error: unitTypeError } = await supabase
      .from("unit_types")
      .select(`
        id,
        building_id,
        name,
        bedrooms,
        bathrooms,
        has_living_room,
        has_dining_room,
        has_patio,
        has_fridge,
        has_washer,
        has_dryer,
        stove_type
      `)
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (unitTypeError) {
      console.error("unit_types fetch failed", unitTypeError);
      setMsg("No se pudieron cargar las tipologías.");
      setLoadingData(false);
      return;
    }

    const parsedUnitTypes = (unitTypeData || []) as UnitType[];

    /*
      Cargamos aparte los assets base de todas las tipologías del edificio.
      Aquí solo necesitamos saber cuántos tiene cada una para mostrarlo
      en la lista.
    */
    const unitTypeIds = parsedUnitTypes.map((item) => item.id);

    let assetCountMap: Record<string, number> = {};

    if (unitTypeIds.length > 0) {
      const { data: assetTemplateRows, error: assetTemplateError } = await supabase
        .from("unit_type_assets")
        .select("unit_type_id")
        .in("unit_type_id", unitTypeIds)
        .is("deleted_at", null);

      if (assetTemplateError) {
        setMsg("Se cargaron las tipologías, pero no se pudo obtener el conteo de equipos base.");
      } else {
        (assetTemplateRows as UnitTypeAssetCountRow[] | null)?.forEach((row) => {
          assetCountMap[row.unit_type_id] = (assetCountMap[row.unit_type_id] || 0) + 1;
        });
      }
    }

    const enrichedUnitTypes = parsedUnitTypes.map((item) => ({
      ...item,
      asset_template_count: assetCountMap[item.id] || 0,
    }));

    setUnitTypes(enrichedUnitTypes);
    setLoadingData(false);
  }

  /*
    Resetea el formulario y vuelve al modo crear.
  */
  function resetForm() {
    reset(UNIT_TYPE_DEFAULTS);
    setEditingUnitTypeId(null);
  }

  /*
    Activa el modo edición.
    Llena el formulario con los datos de la tipología seleccionada.
  */
  function handleEditUnitType(unitType: UnitType) {
    reset({
      name: unitType.name,
      bedrooms: unitType.bedrooms,
      bathrooms: unitType.bathrooms,
      hasLivingRoom: unitType.has_living_room,
      hasDiningRoom: unitType.has_dining_room,
      hasPatio: unitType.has_patio,
      hasFridge: unitType.has_fridge,
      hasWasher: unitType.has_washer,
      hasDryer: unitType.has_dryer,
      stoveType: (unitType.stove_type as "NONE" | "GAS" | "ELECTRIC") || "NONE",
    });
    setEditingUnitTypeId(unitType.id);
    setMsg("");
    setIsFormModalOpen(true);
    setOpenActionsUnitTypeId(null);
  }

  /*
    Cancela edición y regresa el formulario a modo crear.
  */
  function handleCancelEdit() {
    resetForm();
    setMsg("");
    setIsFormModalOpen(false);
  }

  /*
    Esta función ahora sirve para:
    - crear una tipología nueva
    - o actualizar una tipología existente

    Todo depende de si editingUnitTypeId tiene valor.
  */
  const onSubmitUnitType = handleSubmit(async (data) => {
    setMsg("");

    if (!buildingId) {
      setMsg("No se encontró el edificio.");
      return;
    }

    const payload = {
      name: data.name.trim(),
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      has_living_room: data.hasLivingRoom,
      has_dining_room: data.hasDiningRoom,
      has_patio: data.hasPatio,
      has_fridge: data.hasFridge,
      has_washer: data.hasWasher,
      has_dryer: data.hasDryer,
      stove_type: data.stoveType,
    };

    if (editingUnitTypeId) {
      const { error } = await supabase
        .from("unit_types")
        .update(payload)
        .eq("id", editingUnitTypeId)
        .eq("building_id", buildingId);

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Tipología actualizada correctamente.");
      resetForm();
      await loadPageData();
      return;
    }

    const { error } = await supabase.from("unit_types").insert({
      building_id: buildingId,
      ...payload,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Tipología guardada correctamente.");
    resetForm();
    await loadPageData();
  });

  function openDeleteModal(unitType: UnitType) {
    setUnitTypeToDelete(unitType);
    setIsDeleteModalOpen(true);
    setOpenActionsUnitTypeId(null);
    setMsg("");
    setDeleteError(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setUnitTypeToDelete(null);
    setDeleteError(null);
  }

  async function handleDeleteUnitType() {
    if (!unitTypeToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("unit_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", unitTypeToDelete.id)
      .eq("building_id", buildingId);
    if (error) {
      setDeleteError(`No se pudo eliminar la tipología. ${error.message}`);
      setDeleting(false);
      return;
    }
    setIsDeleteModalOpen(false);
    setUnitTypeToDelete(null);
    setDeleting(false);
    setMsg("Tipología archivada correctamente.");
    await loadPageData();
  }

  /*
    Cierra sesión y manda al login.
  */
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "var(--bg-card)", color: "black" }}>
        Cargando usuario...
      </div>
    );
  }

  if (!user) return null;

  if (loadingData) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "var(--bg-card)", color: "black" }}>
        Cargando tipologías...
      </div>
    );
  }

  if (!building) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "var(--bg-card)", color: "black" }}>
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
        title={`Tipologías — ${building.name}`}
        titleIcon={<LayoutPanelTop size={20} />}
        subtitle="Aquí defines los tipos de departamento del edificio y mantienes su configuración base con una interfaz más limpia."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}`}>Volver al edificio</UiButton>
            <UiButton onClick={() => { setMsg(""); setIsWizardOpen(true); }} variant="primary">
              <Plus size={16} />
              Nueva tipología
            </UiButton>
          </>
        }
      />

      {msg ? <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: "16px" }}>{msg}</p> : null}

      <SectionCard title="Tipologías del edificio" subtitle="Cada tipología puede tener sus datos base y su equipamiento plantilla." icon={<LayoutPanelTop size={18} />}>
        {unitTypes.length === 0 ? (
          <p>Todavía no hay tipologías creadas para este edificio.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {unitTypes.map((unitType) => (
              <div key={unitType.id} style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-xl)", padding: "18px", background: "var(--bg-card)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "14px", background: "var(--icon-bg-purple)", color: "var(--icon-color-purple)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <LayoutPanelTop size={18} />
                  </div>
                  <div>
                    <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{unitType.name}</p>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Plantilla base del edificio</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", padding: "12px" }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><BedDouble size={16} /><span>Recámaras</span></div><strong>{unitType.bedrooms}</strong></div>
                  <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", padding: "12px" }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><Bath size={16} /><span>Baños</span></div><strong>{unitType.bathrooms}</strong></div>
                  <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", padding: "12px" }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><PackageOpen size={16} /><span>Equipamiento base</span></div><strong>{unitType.asset_template_count || 0}</strong></div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                  <span style={{ border: "1px solid var(--border-default)", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}><Sofa size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Sala: {unitType.has_living_room ? "Sí" : "No"}</span>
                  <span style={{ border: "1px solid var(--border-default)", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}><UtensilsCrossed size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Comedor: {unitType.has_dining_room ? "Sí" : "No"}</span>
                  <span style={{ border: "1px solid var(--border-default)", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}>Patio: {unitType.has_patio ? "Sí" : "No"}</span>
                  <span style={{ border: "1px solid var(--border-default)", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}>Estufa: {unitType.stove_type}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}`}>Ver tipología</UiButton>
                    <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}/assets`}>Administrar equipamiento base</UiButton>
                  </div>
                  <div
                    style={{ position: "relative" }}
                    ref={openActionsUnitTypeId === unitType.id ? actionsMenuRef : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenActionsUnitTypeId(openActionsUnitTypeId === unitType.id ? null : unitType.id)}
                      style={dropdownTriggerStyle}
                      aria-label="Más acciones"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openActionsUnitTypeId === unitType.id && (
                      <div style={dropdownMenuStyle}>
                        <button type="button" onClick={() => handleEditUnitType(unitType)} style={dropdownItemStyle}>
                          <Edit3 size={14} />
                          Editar
                        </button>
                        <button type="button" onClick={() => openDeleteModal(unitType)} style={dropdownDeleteItemStyle}>
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {building && (
        <UnitTypeWizardModal
          open={isWizardOpen}
          buildingId={building.id}
          companyId={building.company_id}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={async () => { setIsWizardOpen(false); await loadPageData(); }}
        />
      )}

      <Modal open={isDeleteModalOpen} onClose={closeDeleteModal} title="Eliminar tipología" maxWidth="480px">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--metric-bg-amber)", border: "1px solid var(--metric-border-amber)", color: "var(--badge-text-amber)", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
            ¿Eliminar la tipología <strong>{unitTypeToDelete?.name}</strong>? Esta acción la ocultará del sistema pero conservará toda su información.
          </div>
          {deleteError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--badge-bg-red)", border: "1px solid var(--metric-border-red)", color: "var(--badge-text-red)", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{deleteError}</div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>Cancelar</UiButton>
            <UiButton type="button" onClick={() => void handleDeleteUnitType()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : "Eliminar tipología"}
            </UiButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={isFormModalOpen}
        onClose={() => { setIsFormModalOpen(false); if (editingUnitTypeId) { handleCancelEdit(); } }}
        title="Editar tipología"
        subtitle="El formulario ya no ocupa espacio fijo en la página principal."
      >
        <form onSubmit={onSubmitUnitType}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Nombre de la tipología</label>
            <input {...register("name")} placeholder="Ej. Tipo A" style={{ width: "100%", padding: "12px", border: "1px solid var(--border-default)", borderRadius: "10px" }} />
            {errors.name ? <p style={errorTextStyle}>{errors.name.message}</p> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px" }}>Recámaras</label>
              <input type="number" min={0} {...register("bedrooms", { valueAsNumber: true })} style={{ width: "100%", padding: "12px", border: "1px solid var(--border-default)", borderRadius: "10px" }} />
              {errors.bedrooms ? <p style={errorTextStyle}>{errors.bedrooms.message}</p> : null}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px" }}>Baños</label>
              <input type="number" min={0} {...register("bathrooms", { valueAsNumber: true })} style={{ width: "100%", padding: "12px", border: "1px solid var(--border-default)", borderRadius: "10px" }} />
              {errors.bathrooms ? <p style={errorTextStyle}>{errors.bathrooms.message}</p> : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
            <label><input type="checkbox" {...register("hasLivingRoom")} /> Tiene sala</label>
            <label><input type="checkbox" {...register("hasDiningRoom")} /> Tiene comedor</label>
            <label><input type="checkbox" {...register("hasPatio")} /> Tiene patio</label>
            <label><input type="checkbox" {...register("hasFridge")} /> Incluye refrigerador</label>
            <label><input type="checkbox" {...register("hasWasher")} /> Incluye lavadora</label>
            <label><input type="checkbox" {...register("hasDryer")} /> Incluye secadora</label>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Tipo de estufa</label>
            <select {...register("stoveType")} style={{ width: "100%", padding: "12px", border: "1px solid var(--border-default)", borderRadius: "10px", background: "var(--bg-card)" }}>
              <option value="NONE">No tiene</option>
              <option value="GAS">Gas</option>
              <option value="ELECTRIC">Eléctrica</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={isSubmitting} variant="primary">
              {isSubmitting ? "Guardando..." : "Actualizar tipología"}
            </UiButton>
            <UiButton onClick={() => { setIsFormModalOpen(false); if (editingUnitTypeId) { handleCancelEdit(); } }}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}