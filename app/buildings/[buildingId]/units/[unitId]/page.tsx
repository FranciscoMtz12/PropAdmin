"use client";

/*
  Página de detalle del departamento.

  Esta versión integra:
  - AppTabs para separar resumen / lease / assets / historial
  - AppStatBar para visualizar el estado de los assets del departamento
  - cards y accesos rápidos con el mismo design system de PropAdmin
*/

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Edit3,
  Hash,
  History,
  Home,
  Layers3,
  Package,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AppGrid from "@/components/AppGrid";
import AppTabs from "@/components/AppTabs";
import AppStatBar from "@/components/AppStatBar";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";

type Building = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
};

type UnitType = {
  id: string;
  building_id: string;
  name: string;
};

type UnitDetail = {
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

type LeaseRow = {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  tenants: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type AssetMiniRow = {
  id: string;
  status: string;
  name: string;
  asset_type: string;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: 600,
  marginBottom: "8px",
  color: "#111827",
};

function formatDate(dateValue: string | null) {
  if (!dateValue) return "Sin fecha";

  try {
    return new Date(dateValue).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateValue;
  }
}

function getUnitStatusLabel(status: string) {
  if (status === "VACANT") return "Disponible";
  if (status === "RENTED") return "Rentado";
  if (status === "MAINTENANCE") return "En mantenimiento";
  return status;
}

function getUnitStatusColors(status: string) {
  if (status === "VACANT") return { background: "#DCFCE7", color: "#166534" };
  if (status === "RENTED") return { background: "#DBEAFE", color: "#1D4ED8" };
  if (status === "MAINTENANCE") return { background: "#FEF3C7", color: "#B45309" };
  return { background: "#F3F4F6", color: "#374151" };
}

function getAssetStatusLabel(status: string) {
  if (status === "ACTIVE") return "Activos";
  if (status === "PENDING") return "Pendientes";
  if (status === "INACTIVE") return "Inactivos";
  return status;
}

function getAssetStatusColor(status: string) {
  if (status === "ACTIVE") return "#22C55E";
  if (status === "PENDING") return "#F59E0B";
  if (status === "INACTIVE") return "#94A3B8";
  return "#CBD5E1";
}

function StatusPill({ status }: { status: string }) {
  const colors = getUnitStatusColors(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "999px",
        background: colors.background,
        color: colors.color,
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {getUnitStatusLabel(status)}
    </span>
  );
}

function InfoStatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <AppIconBox size={42} radius={12}>{icon}</AppIconBox>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>{label}</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{value}</div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function UnitDetailPage() {
  const router = useRouter();
  const params = useParams();

  const buildingId = params.buildingId as string;
  const unitId = params.unitId as string;

  const { user, loading } = useCurrentUser();

  const [building, setBuilding] = useState<Building | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [leaseHistory, setLeaseHistory] = useState<LeaseRow[]>([]);
  const [assets, setAssets] = useState<AssetMiniRow[]>([]);

  const [unitNumber, setUnitNumber] = useState("");
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("VACANT");
  const [activeTab, setActiveTab] = useState("summary");

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
    if (user?.company_id && buildingId && unitId) {
      loadPageData();
    }
  }, [user, buildingId, unitId]);

  async function loadPageData() {
    if (!user?.company_id || !buildingId || !unitId) return;

    setLoadingData(true);
    setMsg("");

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, company_id, name, code, address")
      .eq("id", buildingId)
      .eq("company_id", user.company_id)
      .single();

    if (buildingError) {
      setMsg("No se pudo cargar el edificio.");
      setLoadingData(false);
      return;
    }

    setBuilding(buildingData);

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
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
      .single();

    if (unitError) {
      setMsg("No se pudo cargar el departamento.");
      setLoadingData(false);
      return;
    }

    const parsedUnit = unitData as unknown as UnitDetail;
    setUnit(parsedUnit);
    setUnitNumber(parsedUnit.unit_number || "");
    setSelectedUnitTypeId(parsedUnit.unit_type_id || "");
    setFloor(parsedUnit.floor !== null && parsedUnit.floor !== undefined ? String(parsedUnit.floor) : "");
    setStatus(parsedUnit.status || "VACANT");

    const [{ data: unitTypeData, error: unitTypeError }, { data: leaseData, error: leaseError }, { data: assetData }] = await Promise.all([
      supabase
        .from("unit_types")
        .select("id, building_id, name")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false }),
      supabase
        .from("leases")
        .select(`
          id,
          status,
          start_date,
          end_date,
          rent_amount,
          tenants(full_name, email, phone)
        `)
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false }),
      supabase
        .from("assets")
        .select("id, status, name, asset_type")
        .eq("unit_id", unitId)
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id),
    ]);

    if (unitTypeError) {
      setMsg("No se pudieron cargar las tipologías.");
      setLoadingData(false);
      return;
    }

    if (leaseError) {
      setMsg("No se pudo cargar el historial del departamento.");
      setLoadingData(false);
      return;
    }

    setUnitTypes(unitTypeData || []);
    setLeaseHistory((leaseData as unknown as LeaseRow[]) || []);
    setAssets((assetData as AssetMiniRow[]) || []);
    setLoadingData(false);
  }

  function generateDisplayCode(buildingCode: string | null, unitNumberValue: string) {
    if (!unitNumberValue.trim()) return null;

    if (buildingCode && buildingCode.trim()) {
      return `${buildingCode.trim()}-${unitNumberValue.trim()}`;
    }

    return unitNumberValue.trim();
  }

  function handleOpenEdit() {
    setShowEditForm(true);
    setMsg("");
  }

  function handleCancelEdit() {
    if (unit) {
      setUnitNumber(unit.unit_number || "");
      setSelectedUnitTypeId(unit.unit_type_id || "");
      setFloor(unit.floor !== null && unit.floor !== undefined ? String(unit.floor) : "");
      setStatus(unit.status || "VACANT");
    }
    setShowEditForm(false);
    setMsg("");
  }

  async function handleUpdateUnit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!user?.company_id) {
      setMsg("No se encontró la empresa del usuario.");
      return;
    }

    if (!building || !unit) {
      setMsg("No se encontró la información del departamento.");
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

    const { error } = await supabase
      .from("units")
      .update({
        unit_number: unitNumber.trim(),
        unit_type_id: selectedUnitTypeId,
        floor: floor.trim() ? Number(floor) : null,
        status,
        display_code: displayCode,
      })
      .eq("id", unit.id)
      .eq("company_id", user.company_id)
      .eq("building_id", building.id);

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Departamento actualizado correctamente.");
    setShowEditForm(false);
    await loadPageData();
  }

  const activeLease = useMemo(
    () => leaseHistory.find((lease) => lease.status === "ACTIVE") || null,
    [leaseHistory]
  );

  const assetStatusSegments = useMemo(() => {
    const grouped = assets.reduce<Record<string, number>>((acc, asset) => {
      const key = asset.status || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([segmentStatus, value]) => ({
      label: getAssetStatusLabel(segmentStatus),
      value,
      color: getAssetStatusColor(segmentStatus),
    }));
  }, [assets]);

  if (loading || loadingData) {
    return (
      <PageContainer>
        <p style={{ color: "#0F172A" }}>{loading ? "Cargando usuario..." : "Cargando departamento..."}</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (!building || !unit) {
    return (
      <PageContainer>
        <p style={{ color: "#B91C1C", marginBottom: "16px" }}>{msg || "No se encontró el departamento."}</p>
        <UiButton href={`/buildings/${buildingId}/units`}>Volver a departamentos</UiButton>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Departamento ${unit.unit_number}`}
        subtitle={`${building.name}${unit.display_code ? ` • Código visible: ${unit.display_code}` : ""}`}
        actions={
          <>
            <UiButton href={`/buildings/${building.id}/units`}>Volver a departamentos</UiButton>
            <UiButton href={`/buildings/${building.id}/units/${unit.id}/assets`} variant="primary">
              Administrar assets
            </UiButton>
          </>
        }
      />

      {msg && !showEditForm ? (
        <div
          style={{
            marginBottom: "18px",
            border: `1px solid ${msg.includes("correctamente") ? "#BBF7D0" : "#FECACA"}`,
            background: msg.includes("correctamente") ? "#F0FDF4" : "#FEF2F2",
            color: msg.includes("correctamente") ? "#166534" : "#B91C1C",
            padding: "12px 14px",
            borderRadius: "12px",
            fontWeight: 600,
          }}
        >
          {msg}
        </div>
      ) : null}

      <AppGrid minWidth={220} gap={16} style={{ marginBottom: "20px" }}>
        <InfoStatCard icon={<Hash size={18} />} label="Número" value={unit.unit_number} />
        <InfoStatCard icon={<Layers3 size={18} />} label="Tipología" value={unit.unit_types?.name || "Sin tipología"} />
        <InfoStatCard icon={<Building2 size={18} />} label="Piso" value={unit.floor ?? "Sin piso"} />
        <InfoStatCard icon={<Home size={18} />} label="Estatus" value={<StatusPill status={unit.status} />} />
      </AppGrid>

      <AppTabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "summary", label: "Resumen", icon: <Home size={16} /> },
          { key: "lease", label: "Lease actual", icon: <Users size={16} />, count: activeLease ? 1 : 0 },
          { key: "assets", label: "Assets", icon: <Package size={16} />, count: assets.length },
          { key: "history", label: "Historial", icon: <History size={16} />, count: leaseHistory.length },
        ]}
      />

      {activeTab === "summary" ? (
        <div style={{ display: "grid", gap: "20px" }}>
          <AppStatBar
            title="Estado de assets del departamento"
            totalLabel={`Total: ${assets.length}`}
            segments={
              assetStatusSegments.length > 0
                ? assetStatusSegments
                : [{ label: "Sin assets", value: 0, color: "#CBD5E1" }]
            }
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "20px" }}>
            <SectionCard title="Información actual" subtitle="Información base de la unidad dentro del edificio.">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div><strong>Número:</strong> {unit.unit_number}</div>
                  <div><strong>Código visible:</strong> {unit.display_code || "Sin código"}</div>
                  <div><strong>Tipología:</strong> {unit.unit_types?.name || "Sin tipología"}</div>
                  <div><strong>Piso:</strong> {unit.floor ?? "Sin piso"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <strong>Estatus:</strong>
                    <StatusPill status={unit.status} />
                  </div>
                </div>

                <UiButton onClick={handleOpenEdit}>
                  <Edit3 size={16} />
                  Editar departamento
                </UiButton>
              </div>
            </SectionCard>

            <SectionCard title="Accesos rápidos" subtitle="Navega a lo más usado de esta unidad.">
              <div style={{ display: "grid", gap: 12 }}>
                <AppCard style={{ padding: 16, borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ display: "block", marginBottom: 4 }}>Assets del departamento</strong>
                      <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>Consulta los equipos instalados y su estado actual.</p>
                    </div>
                    <UiButton href={`/buildings/${building.id}/units/${unit.id}/assets`} variant="primary">Abrir</UiButton>
                  </div>
                </AppCard>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "lease" ? (
        <SectionCard title="Inquilino actual" subtitle="Lease activo ligado a este departamento.">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: activeLease?.tenants ? "14px" : 0 }}>
            <AppIconBox size={42} radius={12}>
              <Users size={18} />
            </AppIconBox>

            {activeLease?.tenants ? (
              <div style={{ display: "grid", gap: "10px" }}>
                <div><strong>Nombre:</strong> {activeLease.tenants.full_name}</div>
                <div><strong>Email:</strong> {activeLease.tenants.email || "Sin email"}</div>
                <div><strong>Teléfono:</strong> {activeLease.tenants.phone || "Sin teléfono"}</div>
                <div><strong>Renta:</strong> ${activeLease.rent_amount}</div>
                <div><strong>Inicio:</strong> {formatDate(activeLease.start_date)}</div>
                <div><strong>Fin:</strong> {formatDate(activeLease.end_date)}</div>
              </div>
            ) : (
              <p style={{ margin: 0, color: "#667085" }}>No hay lease activo para este departamento.</p>
            )}
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "assets" ? (
        <div style={{ display: "grid", gap: 20 }}>
          <SectionCard title="Resumen de assets" subtitle="Equipos instalados y su composición por estado.">
            {assets.length === 0 ? (
              <p style={{ margin: 0, color: "#667085" }}>Todavía no hay assets registrados para este departamento.</p>
            ) : (
              <AppGrid minWidth={240} gap={12}>
                {assets.map((asset) => (
                  <AppCard key={asset.id} style={{ padding: 16, borderRadius: 14 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <strong>{asset.name}</strong>
                      <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>{asset.asset_type}</p>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#475467" }}>{getAssetStatusLabel(asset.status)}</span>
                    </div>
                  </AppCard>
                ))}
              </AppGrid>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <SectionCard title="Historial del departamento" subtitle="Leases registrados anteriormente para esta unidad.">
          {leaseHistory.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#667085" }}>
              <AppIconBox size={40} radius={12} background="#F3F4F6" color="#374151">
                <History size={18} />
              </AppIconBox>
              <p style={{ margin: 0 }}>Todavía no hay historial de leases para este departamento.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {leaseHistory.map((lease) => (
                <AppCard
                  key={lease.id}
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    background: "#FCFCFD",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <strong>{lease.tenants?.full_name || "Sin inquilino"}</strong>
                    <StatusPill status={lease.status === "ACTIVE" ? "RENTED" : "VACANT"} />
                  </div>
                  <div style={{ display: "grid", gap: "6px", color: "#334155" }}>
                    <div><strong>Inicio:</strong> {formatDate(lease.start_date)}</div>
                    <div><strong>Fin:</strong> {formatDate(lease.end_date)}</div>
                    <div><strong>Renta:</strong> ${lease.rent_amount}</div>
                    <div><strong>Estatus del lease:</strong> {lease.status}</div>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <Modal
        open={showEditForm}
        title="Editar departamento"
        subtitle="Actualiza la información base del departamento sin alterar el resto del flujo visual de la página."
        onClose={handleCancelEdit}
      >
        <form onSubmit={handleUpdateUnit}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Número de departamento</label>
              <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Tipología</label>
              <select value={selectedUnitTypeId} onChange={(e) => setSelectedUnitTypeId(e.target.value)} style={inputStyle}>
                <option value="">Selecciona una tipología</option>
                {unitTypes.map((unitType) => (
                  <option key={unitType.id} value={unitType.id}>
                    {unitType.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Piso</label>
              <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Estatus</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                <option value="VACANT">VACANT</option>
                <option value="RENTED">RENTED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            {building.code && unitNumber.trim() ? (
              <div style={{ fontSize: "13px", color: "#667085" }}>
                Display code que se generará: {generateDisplayCode(building.code, unitNumber)}
              </div>
            ) : null}

            {msg ? (
              <div style={{ color: msg.includes("correctamente") ? "#166534" : "#B91C1C", fontWeight: 600 }}>{msg}</div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <UiButton onClick={handleCancelEdit}>Cancelar</UiButton>
              <UiButton type="submit" variant="primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </UiButton>
            </div>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
