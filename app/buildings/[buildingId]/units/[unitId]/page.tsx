"use client";

/*
  Página de detalle del departamento.

  Esta versión integra:
  - AppTabs para separar resumen / lease / assets / historial
  - AppStatBar para visualizar el estado de los assets del departamento
  - cards y accesos rápidos con el mismo design system de PropAdmin

  Cambio importante:
  - La consulta de assets ahora excluye registros con soft delete:
    .is("deleted_at", null)

  Así esta página ya no cuenta ni muestra assets eliminados lógicamente.
*/

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
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
  unit_types: { name: string } | null;
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
  if (status === "VACANT") {
    return { background: "#DCFCE7", color: "#166534" };
  }

  if (status === "RENTED") {
    return { background: "#DBEAFE", color: "#1D4ED8" };
  }

  if (status === "MAINTENANCE") {
    return { background: "#FEF3C7", color: "#B45309" };
  }

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
        borderRadius: "999px",
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 700,
        background: colors.background,
        color: colors.color,
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
    <AppCard>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <AppIconBox size={42} radius={14} background="#F3F4F6" color="#111827">
          {icon}
        </AppIconBox>

        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#6B7280",
              fontWeight: 600,
            }}
          >
            {label}
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "16px",
              color: "#111827",
              fontWeight: 700,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </AppCard>
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
      void loadPageData();
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

    setBuilding(buildingData as Building);

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
    setFloor(
      parsedUnit.floor !== null && parsedUnit.floor !== undefined
        ? String(parsedUnit.floor)
        : ""
    );
    setStatus(parsedUnit.status || "VACANT");

    const [
      { data: unitTypeData, error: unitTypeError },
      { data: leaseData, error: leaseError },
      { data: assetData, error: assetError },
    ] = await Promise.all([
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
        .eq("company_id", user.company_id)
        .is("deleted_at", null),
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

    if (assetError) {
      setMsg("No se pudieron cargar los assets del departamento.");
      setLoadingData(false);
      return;
    }

    setUnitTypes((unitTypeData as UnitType[]) || []);
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
      setFloor(
        unit.floor !== null && unit.floor !== undefined ? String(unit.floor) : ""
      );
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
        <div
          style={{
            minHeight: "40vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6B7280",
            fontWeight: 600,
          }}
        >
          {loading ? "Cargando usuario..." : "Cargando departamento..."}
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  if (!building || !unit) {
    return (
      <PageContainer>
        <AppCard>
          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{ color: "#B91C1C", fontWeight: 600 }}>
              {msg || "No se encontró el departamento."}
            </div>

            <div>
              <UiButton onClick={() => router.push(`/buildings/${buildingId}/units`)}>
                Volver a departamentos
              </UiButton>
            </div>
          </div>
        </AppCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Departamento ${unit.display_code || unit.unit_number}`}
        subtitle={`Detalle operativo del departamento dentro de ${building.name}.`}
        actions={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton onClick={() => router.push(`/buildings/${buildingId}/units`)}>
              Volver a departamentos
            </UiButton>

            <UiButton
              onClick={() =>
                router.push(`/buildings/${buildingId}/units/${unitId}/assets`)
              }
            >
              Administrar assets
            </UiButton>
          </div>
        }
      />

      {msg && !showEditForm ? (
        <AppCard>
          <div style={{ color: "#1D4ED8", fontWeight: 600 }}>{msg}</div>
        </AppCard>
      ) : null}

      <AppGrid minWidth={220}>
        <InfoStatCard
          icon={<Hash size={18} />}
          label="Número"
          value={unit.unit_number}
        />

        <InfoStatCard
          icon={<Layers3 size={18} />}
          label="Tipología"
          value={unit.unit_types?.name || "Sin tipología"}
        />

        <InfoStatCard
          icon={<Building2 size={18} />}
          label="Piso"
          value={unit.floor ?? "Sin piso"}
        />

        <InfoStatCard
          icon={<Home size={18} />}
          label="Estatus"
          value={<StatusPill status={unit.status} />}
        />
      </AppGrid>

      <div style={{ marginTop: "18px" }}>
        <AppTabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabs={[
            { key: "summary", label: "Resumen", icon: <Home size={16} /> },
            {
              key: "lease",
              label: "Lease actual",
              icon: <Users size={16} />,
              count: activeLease ? 1 : 0,
            },
            {
              key: "assets",
              label: "Assets",
              icon: <Package size={16} />,
              count: assets.length,
            },
            {
              key: "history",
              label: "Historial",
              icon: <History size={16} />,
              count: leaseHistory.length,
            },
          ]}
        />
      </div>

      {activeTab === "summary" ? (
        <div style={{ display: "grid", gap: "18px", marginTop: "18px" }}>
          <SectionCard
            title="Resumen del departamento"
            subtitle="Vista general del estado actual y datos base."
          >
            <div style={{ display: "grid", gap: "18px" }}>
              <AppStatBar
                title="Distribución de assets por estatus"
                segments={
                  assetStatusSegments.length > 0
                    ? assetStatusSegments
                    : [{ label: "Sin assets", value: 0, color: "#CBD5E1" }]
                }
              />

              <AppGrid minWidth={240}>
                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Número
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {unit.unit_number}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Código visible
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {unit.display_code || "Sin código"}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Tipología
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {unit.unit_types?.name || "Sin tipología"}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Piso
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {unit.floor ?? "Sin piso"}
                    </div>
                  </div>
                </AppCard>
              </AppGrid>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <UiButton onClick={handleOpenEdit}>Editar departamento</UiButton>

                <AppCard>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        Assets del departamento
                      </div>
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "13px",
                          color: "#6B7280",
                          fontWeight: 500,
                        }}
                      >
                        Consulta los equipos instalados y su estado actual.
                      </div>
                    </div>

                    <UiButton
                      onClick={() =>
                        router.push(`/buildings/${buildingId}/units/${unitId}/assets`)
                      }
                    >
                      Abrir
                    </UiButton>
                  </div>
                </AppCard>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "lease" ? (
        <div style={{ marginTop: "18px" }}>
          <SectionCard
            title="Lease actual"
            subtitle="Información del arrendamiento activo del departamento."
          >
            {activeLease?.tenants ? (
              <AppGrid minWidth={240}>
                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Nombre
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {activeLease.tenants.full_name}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Email
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {activeLease.tenants.email || "Sin email"}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Teléfono
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {activeLease.tenants.phone || "Sin teléfono"}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Renta
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      ${activeLease.rent_amount}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Inicio
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {formatDate(activeLease.start_date)}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                      Fin
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      {formatDate(activeLease.end_date)}
                    </div>
                  </div>
                </AppCard>
              </AppGrid>
            ) : (
              <AppCard>
                <div style={{ color: "#6B7280", fontWeight: 500 }}>
                  No hay lease activo para este departamento.
                </div>
              </AppCard>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "assets" ? (
        <div style={{ marginTop: "18px" }}>
          <SectionCard
            title="Assets del departamento"
            subtitle="Resumen rápido de los equipos actualmente visibles en la unidad."
          >
            {assets.length === 0 ? (
              <AppCard>
                <div style={{ color: "#6B7280", fontWeight: 500 }}>
                  Todavía no hay assets registrados para este departamento.
                </div>
              </AppCard>
            ) : (
              <AppGrid minWidth={240}>
                {assets.map((asset) => (
                  <AppCard key={asset.id}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {asset.name}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#6B7280",
                          fontWeight: 600,
                        }}
                      >
                        {asset.asset_type}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#374151",
                          fontWeight: 600,
                        }}
                      >
                        {getAssetStatusLabel(asset.status)}
                      </div>
                    </div>
                  </AppCard>
                ))}
              </AppGrid>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div style={{ marginTop: "18px" }}>
          <SectionCard
            title="Historial de leases"
            subtitle="Registro histórico de arrendamientos de la unidad."
          >
            {leaseHistory.length === 0 ? (
              <AppCard>
                <div style={{ color: "#6B7280", fontWeight: 500 }}>
                  Todavía no hay historial de leases para este departamento.
                </div>
              </AppCard>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {leaseHistory.map((lease) => (
                  <AppCard key={lease.id}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {lease.tenants?.full_name || "Sin inquilino"}
                      </div>

                      <div style={{ fontSize: "14px", color: "#4B5563" }}>
                        Inicio: {formatDate(lease.start_date)}
                      </div>

                      <div style={{ fontSize: "14px", color: "#4B5563" }}>
                        Fin: {formatDate(lease.end_date)}
                      </div>

                      <div style={{ fontSize: "14px", color: "#4B5563" }}>
                        Renta: ${lease.rent_amount}
                      </div>

                      <div style={{ fontSize: "14px", color: "#4B5563" }}>
                        Estatus del lease: {lease.status}
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      <Modal
        open={showEditForm}
        onClose={handleCancelEdit}
        title="Editar departamento"
        subtitle="Actualiza los datos base del departamento sin salir de la vista de detalle."
      >
        <form onSubmit={handleUpdateUnit}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Número de departamento</label>
              <input
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Tipología</label>
              <select
                value={selectedUnitTypeId}
                onChange={(e) => setSelectedUnitTypeId(e.target.value)}
                style={inputStyle}
              >
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
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Estatus</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={inputStyle}
              >
                <option value="VACANT">VACANT</option>
                <option value="RENTED">RENTED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            {building.code && unitNumber.trim() ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Display code que se generará:{" "}
                <strong>{generateDisplayCode(building.code, unitNumber)}</strong>
              </div>
            ) : null}

            {msg ? (
              <div style={{ color: "#1D4ED8", fontWeight: 600 }}>{msg}</div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "6px",
              }}
            >
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