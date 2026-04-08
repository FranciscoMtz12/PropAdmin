"use client";

/*
  Página de detalle de una tipología.

  Esta página sigue el patrón que ya definiste en todo el sistema:
  Lista -> Detalle -> Edición

  Aquí podemos:
  - ver la información actual de la tipología
  - abrir el formulario de edición solo cuando el usuario lo decide
  - ver el resumen de assets base ligados a la tipología
  - entrar a administrar los assets base

  Esta página es importante porque la tipología ya no será solo un dato
  descriptivo; ahora también será la plantilla que define qué assets se
  crean automáticamente cuando nace un nuevo departamento.
*/

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bath, BedDouble, Home, LayoutPanelTop, PackageSearch, PencilLine } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AssetTypeIcon from "@/components/AssetTypeIcon";

type Building = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
};

type UnitTypeDetail = {
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
};

type UnitTypeAssetRow = {
  id: string;
  unit_type_id: string;
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
  sort_order: number;
};

export default function UnitTypeDetailPage() {
  const router = useRouter();
  const params = useParams();

  const buildingId = params.buildingId as string;
  const unitTypeId = params.unitTypeId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [unitType, setUnitType] = useState<UnitTypeDetail | null>(null);
  const [templateAssets, setTemplateAssets] = useState<UnitTypeAssetRow[]>([]);

  /*
    Estados del formulario de edición.
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

  const [showEditForm, setShowEditForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id && buildingId && unitTypeId) {
      loadPageData();
    }
  }, [user, buildingId, unitTypeId]);

  /*
    Cargamos:
    - edificio
    - tipología
    - assets base de la tipología
  */
  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitTypeId) return;

    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name, code")
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
      .eq("id", unitTypeId)
      .eq("building_id", buildingId)
      .single();

    if (unitTypeError) {
      setMsg("No se pudo cargar la tipología.");
      setLoadingData(false);
      return;
    }

    const parsedUnitType = unitTypeData as UnitTypeDetail;
    setUnitType(parsedUnitType);

    /*
      Prellenamos el formulario de edición con la información actual.
    */
    setName(parsedUnitType.name || "");
    setBedrooms(parsedUnitType.bedrooms || 0);
    setBathrooms(parsedUnitType.bathrooms || 0);
    setHasLivingRoom(parsedUnitType.has_living_room || false);
    setHasDiningRoom(parsedUnitType.has_dining_room || false);
    setHasPatio(parsedUnitType.has_patio || false);
    setHasFridge(parsedUnitType.has_fridge || false);
    setHasWasher(parsedUnitType.has_washer || false);
    setHasDryer(parsedUnitType.has_dryer || false);
    setStoveType(parsedUnitType.stove_type || "NONE");

    const { data: templateAssetData, error: templateAssetError } = await supabase
      .from("unit_type_assets")
      .select("id, unit_type_id, asset_type, name, status, notes, sort_order")
      .eq("unit_type_id", unitTypeId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (templateAssetError) {
      setMsg("La tipología se cargó, pero no se pudieron cargar sus equipos base.");
      setTemplateAssets([]);
      setLoadingData(false);
      return;
    }

    setTemplateAssets((templateAssetData as UnitTypeAssetRow[]) || []);
    setLoadingData(false);
  }

  function openEditForm() {
    setShowEditForm(true);
    setMsg("");
  }

  function cancelEditForm() {
    if (unitType) {
      setName(unitType.name || "");
      setBedrooms(unitType.bedrooms || 0);
      setBathrooms(unitType.bathrooms || 0);
      setHasLivingRoom(unitType.has_living_room || false);
      setHasDiningRoom(unitType.has_dining_room || false);
      setHasPatio(unitType.has_patio || false);
      setHasFridge(unitType.has_fridge || false);
      setHasWasher(unitType.has_washer || false);
      setHasDryer(unitType.has_dryer || false);
      setStoveType(unitType.stove_type || "NONE");
    }

    setShowEditForm(false);
    setMsg("");
  }

  async function handleUpdateUnitType(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!unitType) {
      setMsg("No se encontró la tipología.");
      return;
    }

    if (!name.trim()) {
      setMsg("El nombre de la tipología es obligatorio.");
      return;
    }

    setSaving(true);

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
      .eq("id", unitType.id)
      .eq("building_id", buildingId);

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Tipología actualizada correctamente.");
    setShowEditForm(false);
    await loadPageData();
  }

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
        Cargando tipología...
      </div>
    );
  }

  if (!building || !unitType) {
    return (
      <div style={{ minHeight: "100vh", padding: "40px", background: "white", color: "black" }}>
        <p>{msg || "No se encontró la tipología."}</p>
        <a href={`/buildings/${buildingId}/unit-types`} style={{ display: "inline-block", marginTop: "16px", color: "black" }}>
          Volver a tipologías
        </a>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Tipología ${unitType.name}`}
        titleIcon={<LayoutPanelTop size={20} />}
        subtitle="La tipología define la configuración base del departamento y también los assets plantilla que se clonan al crear una unidad nueva."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/unit-types`}>Volver a tipologías</UiButton>
            <UiButton href={`/buildings/${building.id}/unit-types/${unitType.id}/assets`}>Administrar assets base</UiButton>
            <UiButton onClick={openEditForm} variant="primary">
              <PencilLine size={16} />
              Editar tipología
            </UiButton>
          </>
        }
      />

      {msg && !showEditForm ? (
        <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: "16px" }}>{msg}</p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: "16px", padding: "18px", background: "white" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><p style={{ fontSize: "13px", color: "#667085", marginBottom: "8px" }}>Recámaras</p><strong style={{ fontSize: "28px" }}>{unitType.bedrooms}</strong></div><BedDouble size={18} /></div></div>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: "16px", padding: "18px", background: "white" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><p style={{ fontSize: "13px", color: "#667085", marginBottom: "8px" }}>Baños</p><strong style={{ fontSize: "28px" }}>{unitType.bathrooms}</strong></div><Bath size={18} /></div></div>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: "16px", padding: "18px", background: "white" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><p style={{ fontSize: "13px", color: "#667085", marginBottom: "8px" }}>Assets base</p><strong style={{ fontSize: "28px" }}>{templateAssets.length}</strong></div><PackageSearch size={18} /></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <SectionCard title="Información actual" subtitle="Configuración física y funcional de la tipología." icon={<Home size={18} />}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Nombre</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.name}</p></div>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Sala</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.has_living_room ? "Sí" : "No"}</p></div>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Comedor</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.has_dining_room ? "Sí" : "No"}</p></div>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Patio</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.has_patio ? "Sí" : "No"}</p></div>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Refri</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.has_fridge ? "Sí" : "No"}</p></div>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Lavadora / Secadora</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.has_washer ? "Sí" : "No"} / {unitType.has_dryer ? "Sí" : "No"}</p></div>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}><strong>Tipo de estufa</strong><p style={{ margin: "8px 0 0 0", color: "#667085" }}>{unitType.stove_type}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Assets base configurados" subtitle="Vista rápida de los equipos plantilla de esta tipología." icon={<PackageSearch size={18} />}>
          {templateAssets.length === 0 ? (
            <p style={{ margin: 0 }}>Todavía no hay assets base configurados.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {templateAssets.slice(0, 4).map((asset) => (
                <div key={asset.id} style={{ border: "1px solid #E5E7EB", borderRadius: "14px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <AssetTypeIcon assetType={asset.asset_type} size={18} />
                    <div>
                      <strong style={{ display: "block" }}>{asset.name}</strong>
                      <p style={{ margin: 0, color: "#667085", fontSize: "14px" }}>{asset.asset_type} · Orden {asset.sort_order ?? 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <Modal
        open={showEditForm}
        onClose={cancelEditForm}
        title="Editar tipología"
        subtitle="La edición vive dentro de modal para mantener limpia la página de detalle."
      >
        <form onSubmit={handleUpdateUnitType}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Nombre de la tipología</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div><label style={{ display: "block", marginBottom: "8px" }}>Recámaras</label><input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }} /></div>
            <div><label style={{ display: "block", marginBottom: "8px" }}>Baños</label><input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))} style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }} /></div>
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
          {msg && showEditForm ? <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: "12px" }}>{msg}</p> : null}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={saving} variant="primary">{saving ? "Guardando..." : "Actualizar tipología"}</UiButton>
            <UiButton onClick={cancelEditForm}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}