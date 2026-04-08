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

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { Bath, BedDouble, LayoutPanelTop, PackageOpen, Plus, Sofa, UtensilsCrossed } from "lucide-react";

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
    Estados del formulario.
    Se usan tanto para crear como para editar.
  */
  const [name, setName] = useState("");
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [hasLivingRoom, setHasLivingRoom] = useState(false);
  const [hasDiningRoom, setHasDiningRoom] = useState(false);
  const [hasPatio, setHasPatio] = useState(false);
  const [hasFridge, setHasFridge] = useState(false);
  const [hasWasher, setHasWasher] = useState(false);
  const [hasDryer, setHasDryer] = useState(false);
  const [stoveType, setStoveType] = useState("NONE");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  /*
    Si editingUnitTypeId tiene valor, estamos editando.
    Si es null, estamos creando una tipología nueva.
  */
  const [editingUnitTypeId, setEditingUnitTypeId] = useState<string | null>(null);

  /*
    Estados auxiliares.
  */
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  /*
    Si no hay usuario autenticado, mandamos al login.
  */
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
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
    setName("");
    setBedrooms(1);
    setBathrooms(1);
    setHasLivingRoom(false);
    setHasDiningRoom(false);
    setHasPatio(false);
    setHasFridge(false);
    setHasWasher(false);
    setHasDryer(false);
    setStoveType("NONE");
    setEditingUnitTypeId(null);
  }

  /*
    Activa el modo edición.
    Llena el formulario con los datos de la tipología seleccionada.
  */
  function handleEditUnitType(unitType: UnitType) {
    setName(unitType.name);
    setBedrooms(unitType.bedrooms);
    setBathrooms(unitType.bathrooms);
    setHasLivingRoom(unitType.has_living_room);
    setHasDiningRoom(unitType.has_dining_room);
    setHasPatio(unitType.has_patio);
    setHasFridge(unitType.has_fridge);
    setHasWasher(unitType.has_washer);
    setHasDryer(unitType.has_dryer);
    setStoveType(unitType.stove_type || "NONE");
    setEditingUnitTypeId(unitType.id);
    setMsg("");
    setIsFormModalOpen(true);
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
  async function handleSubmitUnitType(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!buildingId) {
      setMsg("No se encontró el edificio.");
      return;
    }

    if (!name.trim()) {
      setMsg("El nombre de la tipología es obligatorio.");
      return;
    }

    setSaving(true);

    /*
      Si estamos editando, usamos UPDATE.
    */
    if (editingUnitTypeId) {
      const { error } = await supabase
        .from("unit_types")
        .update({
          name: name.trim(),
          bedrooms,
          bathrooms,
          has_living_room: hasLivingRoom,
          has_dining_room: hasDiningRoom,
          has_patio: hasPatio,
          has_fridge: hasFridge,
          has_washer: hasWasher,
          has_dryer: hasDryer,
          stove_type: stoveType,
        })
        .eq("id", editingUnitTypeId)
        .eq("building_id", buildingId);

      setSaving(false);

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Tipología actualizada correctamente.");
      resetForm();
      await loadPageData();
      return;
    }

    /*
      Si no estamos editando, usamos INSERT.
    */
    const { error } = await supabase.from("unit_types").insert({
      building_id: buildingId,
      name: name.trim(),
      bedrooms,
      bathrooms,
      has_living_room: hasLivingRoom,
      has_dining_room: hasDiningRoom,
      has_patio: hasPatio,
      has_fridge: hasFridge,
      has_washer: hasWasher,
      has_dryer: hasDryer,
      stove_type: stoveType,
    });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Tipología guardada correctamente.");
    resetForm();
    await loadPageData();
  }

  /*
    Cierra sesión y manda al login.
  */
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

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
        Cargando tipologías...
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
        title={`Tipologías — ${building.name}`}
        titleIcon={<LayoutPanelTop size={20} />}
        subtitle="Aquí defines los tipos de departamento del edificio y mantienes su configuración base con una interfaz más limpia."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}`}>Volver al edificio</UiButton>
            <UiButton onClick={() => { resetForm(); setMsg(""); setIsFormModalOpen(true); }} variant="primary">
              <Plus size={16} />
              Nueva tipología
            </UiButton>
          </>
        }
      />

      {msg ? <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: "16px" }}>{msg}</p> : null}

      <SectionCard title="Tipologías del edificio" subtitle="Cada tipología puede tener sus datos base y sus assets plantilla." icon={<LayoutPanelTop size={18} />}>
        {unitTypes.length === 0 ? (
          <p>Todavía no hay tipologías creadas para este edificio.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {unitTypes.map((unitType) => (
              <div key={unitType.id} style={{ border: "1px solid #E5E7EB", borderRadius: "16px", padding: "18px", background: "white" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "14px", background: "#EEF2FF", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <LayoutPanelTop size={18} />
                  </div>
                  <div>
                    <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{unitType.name}</p>
                    <p style={{ margin: 0, color: "#667085", fontSize: "14px" }}>Plantilla base del edificio</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px" }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><BedDouble size={16} /><span>Recámaras</span></div><strong>{unitType.bedrooms}</strong></div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px" }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><Bath size={16} /><span>Baños</span></div><strong>{unitType.bathrooms}</strong></div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px" }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><PackageOpen size={16} /><span>Assets base</span></div><strong>{unitType.asset_template_count || 0}</strong></div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                  <span style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}><Sofa size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Sala: {unitType.has_living_room ? "Sí" : "No"}</span>
                  <span style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}><UtensilsCrossed size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Comedor: {unitType.has_dining_room ? "Sí" : "No"}</span>
                  <span style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}>Patio: {unitType.has_patio ? "Sí" : "No"}</span>
                  <span style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "6px 10px", fontSize: "12px" }}>Estufa: {unitType.stove_type}</span>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}`}>Ver tipología</UiButton>
                  <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}/assets`}>Administrar assets base</UiButton>
                  <UiButton onClick={() => handleEditUnitType(unitType)}>Editar</UiButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal
        open={isFormModalOpen}
        onClose={() => { setIsFormModalOpen(false); if (editingUnitTypeId) { handleCancelEdit(); } }}
        title={editingUnitTypeId ? "Editar tipología" : "Crear tipología"}
        subtitle="El formulario ya no ocupa espacio fijo en la página principal."
      >
        <form onSubmit={handleSubmitUnitType}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Nombre de la tipología</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Tipo A" style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px" }}>Recámaras</label>
              <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px" }}>Baños</label>
              <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))} style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
            <label><input type="checkbox" checked={hasLivingRoom} onChange={(e) => setHasLivingRoom(e.target.checked)} /> Tiene sala</label>
            <label><input type="checkbox" checked={hasDiningRoom} onChange={(e) => setHasDiningRoom(e.target.checked)} /> Tiene comedor</label>
            <label><input type="checkbox" checked={hasPatio} onChange={(e) => setHasPatio(e.target.checked)} /> Tiene patio</label>
            <label><input type="checkbox" checked={hasFridge} onChange={(e) => setHasFridge(e.target.checked)} /> Incluye refrigerador</label>
            <label><input type="checkbox" checked={hasWasher} onChange={(e) => setHasWasher(e.target.checked)} /> Incluye lavadora</label>
            <label><input type="checkbox" checked={hasDryer} onChange={(e) => setHasDryer(e.target.checked)} /> Incluye secadora</label>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Tipo de estufa</label>
            <select value={stoveType} onChange={(e) => setStoveType(e.target.value)} style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px", background: "white" }}>
              <option value="NONE">No tiene</option>
              <option value="GAS">Gas</option>
              <option value="ELECTRIC">Eléctrica</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">
              {saving ? "Guardando..." : editingUnitTypeId ? "Actualizar tipología" : "Guardar tipología"}
            </UiButton>
            <UiButton onClick={() => { setIsFormModalOpen(false); if (editingUnitTypeId) { handleCancelEdit(); } }}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}