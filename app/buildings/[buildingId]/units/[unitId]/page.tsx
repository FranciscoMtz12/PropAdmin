"use client";

/*
  Página de detalle del departamento.

  Esta versión integra:
  - Resumen / leases / assets / historial
  - Leases múltiples por unidad
  - Un lease por cuarto
  - Máximo de leases activos según bedroom_count del unit_type
  - Datos de facturación automáticos desde tenants
  - Corrección de fechas sin desfase por zona horaria

  Reglas activas:
  - bedroom_count define cuántos leases activos máximos puede tener la unidad
  - room_number identifica qué cuarto ocupa cada lease
  - due_day se guarda fijo como 31 por control interno (fin de mes)
  - nombre/email de facturación se toman automáticamente del responsable de pago
    o del inquilino si no hay responsable de pago distinto
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
  BedDouble,
  Building2,
  Hash,
  History,
  Home,
  Layers3,
  Package,
  Pencil,
  Plus,
  Trash2,
  Users,
  XCircle,
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
import AppSelect from "@/components/AppSelect";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

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
  bedroom_count: number | null;
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
  unit_types: { name: string; bedroom_count: number | null } | null;
};

type Tenant = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LeaseRow = {
  id: string;
  company_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  responsible_payer_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  due_day: number | null;
  rent_amount: number | null;
  room_number: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type AssetMiniRow = {
  id: string;
  status: string;
  name: string;
  asset_type: string;
};

type LeaseFormState = {
  tenantId: string;
  responsiblePayerId: string;
  rentAmount: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "ENDED";
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  outline: "none",
};

const readOnlyInputStyle: CSSProperties = {
  ...inputStyle,
  background: "#F9FAFB",
  color: "#6B7280",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: 600,
  marginBottom: "8px",
  color: "#111827",
};

function parseDateOnly(dateValue: string | null) {
  if (!dateValue) return null;
  const safe = dateValue.slice(0, 10);
  const [year, month, day] = safe.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return "Sin fecha";

  const parsed = parseDateOnly(dateValue);
  if (!parsed) return dateValue;

  return parsed.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function getLeaseStatusLabel(status: string | null) {
  if (status === "ACTIVE") return "Activo";
  if (status === "ENDED") return "Finalizado";
  return status || "Sin estatus";
}

function getLeaseStatusColors(status: string | null) {
  if (status === "ACTIVE") {
    return { background: "#DCFCE7", color: "#166534", border: "#86EFAC" };
  }

  return { background: "#FEF3C7", color: "#B45309", border: "#FCD34D" };
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

function LeaseStatusPill({ status }: { status: string | null }) {
  const colors = getLeaseStatusColors(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        padding: "8px 14px",
        fontSize: "13px",
        fontWeight: 800,
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {getLeaseStatusLabel(status)}
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

function getTenantDisplayName(tenant: Tenant | null | undefined) {
  if (!tenant) return "Sin inquilino";
  return tenant.full_name || tenant.email || "Sin inquilino";
}

function resolveBillingSnapshot({
  tenant,
  responsiblePayer,
}: {
  tenant: Tenant | null | undefined;
  responsiblePayer: Tenant | null | undefined;
}) {
  const source = responsiblePayer || tenant || null;

  return {
    billingName: source?.billing_name || source?.full_name || "",
    billingEmail: source?.billing_email || source?.email || "",
  };
}

function emptyLeaseForm(): LeaseFormState {
  return {
    tenantId: "",
    responsiblePayerId: "",
    rentAmount: "",
    roomNumber: "",
    startDate: getTodayDateInput(),
    endDate: "",
    status: "ACTIVE",
  };
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leaseHistory, setLeaseHistory] = useState<LeaseRow[]>([]);
  const [assets, setAssets] = useState<AssetMiniRow[]>([]);

  const [unitNumber, setUnitNumber] = useState("");
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("VACANT");

  const [activeTab, setActiveTab] = useState("summary");
  const [showEditForm, setShowEditForm] = useState(false);

  const [showLeaseModal, setShowLeaseModal] = useState(false);
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);
  const [leaseForm, setLeaseForm] = useState<LeaseFormState>(emptyLeaseForm());
  const [showDeleteLeaseModal, setShowDeleteLeaseModal] = useState(false);
  const [leaseToDelete, setLeaseToDelete] = useState<LeaseRow | null>(null);


  function openDeleteLeaseModal(lease: LeaseRow) {
    setLeaseToDelete(lease);
    setShowDeleteLeaseModal(true);
    setMsg("");
  }

  function closeDeleteLeaseModal() {
    if (saving) return;
    setShowDeleteLeaseModal(false);
    setLeaseToDelete(null);
  }

  async function handleDeleteLeaseConfirmed() {
    if (!user?.company_id || !unit || !leaseToDelete) return;

    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("leases")
      .delete()
      .eq("id", leaseToDelete.id)
      .eq("company_id", user.company_id);

    if (error) {
      setSaving(false);
      setMsg(error.message);
      return;
    }

    const remainingActive = activeLeases.filter((lease) => lease.id !== leaseToDelete.id);

    await supabase
      .from("units")
      .update({ status: remainingActive.length > 0 ? "RENTED" : "VACANT" })
      .eq("id", unit.id)
      .eq("company_id", user.company_id);

    setShowDeleteLeaseModal(false);
    setLeaseToDelete(null);
    setSaving(false);
    setMsg("Lease eliminado correctamente.");
    await loadPageData();
  }

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
        unit_types(name, bedroom_count)
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
      { data: tenantsData, error: tenantsError },
      { data: leaseData, error: leaseError },
      { data: assetData, error: assetError },
    ] = await Promise.all([
      supabase
        .from("unit_types")
        .select("id, building_id, name, bedroom_count")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false }),

      supabase
        .from("tenants")
        .select(
          "id, company_id, full_name, email, phone, tax_id, billing_name, billing_email, status, notes, created_at, updated_at"
        )
        .eq("company_id", user.company_id)
        .eq("status", "ACTIVE")
        .order("full_name", { ascending: true }),

      supabase
        .from("leases")
        .select(
          "id, company_id, unit_id, tenant_id, responsible_payer_id, billing_name, billing_email, due_day, rent_amount, room_number, status, start_date, end_date, created_at"
        )
        .eq("unit_id", unitId)
        .eq("company_id", user.company_id)
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

    if (tenantsError) {
      setMsg("No se pudieron cargar los inquilinos.");
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
    setTenants((tenantsData as Tenant[]) || []);
    setLeaseHistory((leaseData as LeaseRow[]) || []);
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

  const bedroomCount = useMemo(() => {
    const raw = unit?.unit_types?.bedroom_count;
    if (!raw || raw < 1) return 1;
    return raw;
  }, [unit]);

  const activeLeases = useMemo(
    () =>
      leaseHistory
        .filter((lease) => lease.status === "ACTIVE")
        .sort((a, b) => (a.room_number || 999) - (b.room_number || 999)),
    [leaseHistory]
  );

  const tenantsMap = useMemo(() => {
    return new Map(tenants.map((tenant) => [tenant.id, tenant]));
  }, [tenants]);

  const occupiedRoomNumbers = useMemo(() => {
    return activeLeases
      .map((lease) => lease.room_number)
      .filter((roomNumber): roomNumber is number => Boolean(roomNumber));
  }, [activeLeases]);

  const availableRoomNumbers = useMemo(() => {
    const used = new Set(occupiedRoomNumbers);

    if (editingLeaseId) {
      const editingLease = leaseHistory.find((lease) => lease.id === editingLeaseId);
      if (editingLease?.room_number) {
        used.delete(editingLease.room_number);
      }
    }

    const options: number[] = [];
    for (let i = 1; i <= bedroomCount; i += 1) {
      if (!used.has(i)) options.push(i);
    }

    return options;
  }, [bedroomCount, occupiedRoomNumbers, editingLeaseId, leaseHistory]);

  const billingPreview = useMemo(() => {
    const tenant = leaseForm.tenantId ? tenantsMap.get(leaseForm.tenantId) : null;
    const responsiblePayer = leaseForm.responsiblePayerId
      ? tenantsMap.get(leaseForm.responsiblePayerId)
      : null;

    return resolveBillingSnapshot({ tenant, responsiblePayer });
  }, [leaseForm.tenantId, leaseForm.responsiblePayerId, tenantsMap]);

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

  function openCreateLease() {
    if (activeLeases.length >= bedroomCount) {
      setMsg(
        `Esta unidad ya alcanzó su capacidad máxima de ${bedroomCount} lease(s) activo(s).`
      );
      return;
    }

    setEditingLeaseId(null);
    setLeaseForm({
      ...emptyLeaseForm(),
      roomNumber: availableRoomNumbers[0] ? String(availableRoomNumbers[0]) : "",
    });
    setShowLeaseModal(true);
    setMsg("");
  }

  function openEditLease(lease: LeaseRow) {
    setEditingLeaseId(lease.id);
    setLeaseForm({
      tenantId: lease.tenant_id || "",
      responsiblePayerId: lease.responsible_payer_id || "",
      rentAmount:
        lease.rent_amount !== null && lease.rent_amount !== undefined
          ? String(lease.rent_amount)
          : "",
      roomNumber:
        lease.room_number !== null && lease.room_number !== undefined
          ? String(lease.room_number)
          : "",
      startDate: lease.start_date || getTodayDateInput(),
      endDate: lease.end_date || "",
      status: lease.status === "ENDED" ? "ENDED" : "ACTIVE",
    });
    setShowLeaseModal(true);
    setMsg("");
  }

  function closeLeaseModal() {
    if (saving) return;
    setShowLeaseModal(false);
    setEditingLeaseId(null);
    setLeaseForm(emptyLeaseForm());
  }

  async function handleSaveLease(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!user?.company_id || !unit) {
      setMsg("No se encontró el contexto necesario para guardar el lease.");
      return;
    }

    if (!leaseForm.tenantId) {
      setMsg("Debes seleccionar un inquilino.");
      return;
    }

    const roomNumber = Number(leaseForm.roomNumber);
    if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > bedroomCount) {
      setMsg("Debes seleccionar un cuarto válido.");
      return;
    }

    const roomAlreadyInUse = activeLeases.some(
      (lease) => lease.room_number === roomNumber && lease.id !== editingLeaseId
    );

    if (leaseForm.status === "ACTIVE" && roomAlreadyInUse) {
      setMsg("Ese cuarto ya tiene un lease activo.");
      return;
    }

    if (
      leaseForm.status === "ACTIVE" &&
      activeLeases.length >= bedroomCount &&
      !editingLeaseId
    ) {
      setMsg(
        `Esta unidad ya alcanzó su capacidad máxima de ${bedroomCount} lease(s) activo(s).`
      );
      return;
    }

    const rentAmountNumber = Number(leaseForm.rentAmount);
    if (!Number.isFinite(rentAmountNumber) || rentAmountNumber <= 0) {
      setMsg("La renta debe ser un monto válido mayor a cero.");
      return;
    }

    if (!leaseForm.startDate) {
      setMsg("Debes seleccionar una fecha de inicio.");
      return;
    }

    if (leaseForm.endDate && leaseForm.endDate < leaseForm.startDate) {
      setMsg("La fecha de fin no puede ser menor a la fecha de inicio.");
      return;
    }

    const tenant = tenantsMap.get(leaseForm.tenantId) || null;
    const responsiblePayer = leaseForm.responsiblePayerId
      ? tenantsMap.get(leaseForm.responsiblePayerId) || null
      : null;

    const billingSnapshot = resolveBillingSnapshot({ tenant, responsiblePayer });

    setSaving(true);

    const payload = {
      tenant_id: leaseForm.tenantId,
      responsible_payer_id: leaseForm.responsiblePayerId || null,
      billing_name: billingSnapshot.billingName || null,
      billing_email: billingSnapshot.billingEmail || null,
      due_day: 31,
      rent_amount: rentAmountNumber,
      room_number: roomNumber,
      start_date: leaseForm.startDate,
      end_date: leaseForm.endDate || null,
      status: leaseForm.status,
    };

    if (editingLeaseId) {
      const { error: updateLeaseError } = await supabase
        .from("leases")
        .update(payload)
        .eq("id", editingLeaseId)
        .eq("company_id", user.company_id);

      if (updateLeaseError) {
        setSaving(false);
        setMsg(updateLeaseError.message);
        return;
      }
    } else {
      const { error: insertLeaseError } = await supabase.from("leases").insert({
        company_id: user.company_id,
        unit_id: unit.id,
        ...payload,
      });

      if (insertLeaseError) {
        setSaving(false);
        setMsg(insertLeaseError.message);
        return;
      }
    }

    const shouldBeRented =
      leaseForm.status === "ACTIVE" ||
      activeLeases.some((lease) => lease.id !== editingLeaseId && lease.status === "ACTIVE");

    await supabase
      .from("units")
      .update({ status: shouldBeRented ? "RENTED" : "VACANT" })
      .eq("id", unit.id)
      .eq("company_id", user.company_id);

    setSaving(false);
    setShowLeaseModal(false);
    setEditingLeaseId(null);
    setLeaseForm(emptyLeaseForm());
    setMsg(
      editingLeaseId
        ? "Lease actualizado correctamente."
        : "Lease creado correctamente."
    );
    await loadPageData();
  }

  async function handleFinishLease(leaseId: string, currentEndDate: string | null) {
    if (!user?.company_id || !unit) return;

    setSaving(true);
    setMsg("");

    const today = getTodayDateInput();

    const { error } = await supabase
      .from("leases")
      .update({
        status: "ENDED",
        end_date: currentEndDate || today,
      })
      .eq("id", leaseId)
      .eq("company_id", user.company_id);

    if (error) {
      setSaving(false);
      setMsg(error.message);
      return;
    }

    const remainingActive = activeLeases.filter((lease) => lease.id !== leaseId);

    await supabase
      .from("units")
      .update({ status: remainingActive.length > 0 ? "RENTED" : "VACANT" })
      .eq("id", unit.id)
      .eq("company_id", user.company_id);

    setSaving(false);
    setMsg("Lease finalizado correctamente.");
    await loadPageData();
  }

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

      {msg && !showEditForm && !showLeaseModal ? (
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
          icon={<BedDouble size={18} />}
          label="Recámaras"
          value={bedroomCount}
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
              label: "Leases activos",
              icon: <Users size={16} />,
              count: activeLeases.length,
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
          <SectionCard title="Resumen del departamento">
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
                    <div style={miniLabelStyle}>Número</div>
                    <div style={miniValueStyle}>{unit.unit_number}</div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={miniLabelStyle}>Código visible</div>
                    <div style={miniValueStyle}>{unit.display_code || "Sin código"}</div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={miniLabelStyle}>Tipología</div>
                    <div style={miniValueStyle}>
                      {unit.unit_types?.name || "Sin tipología"}
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={miniLabelStyle}>Recámaras</div>
                    <div style={miniValueStyle}>{bedroomCount}</div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={miniLabelStyle}>Leases activos</div>
                    <div style={miniValueStyle}>{activeLeases.length}</div>
                  </div>
                </AppCard>

                <AppCard>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={miniLabelStyle}>Cuartos disponibles</div>
                    <div style={miniValueStyle}>
                      {Math.max(bedroomCount - activeLeases.length, 0)}
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
                      <div style={summaryCardTitleStyle}>Assets del departamento</div>
                      <div style={summaryCardTextStyle}>
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
            title="Leases activos"
            icon={<Users size={18} />}
            action={
              <UiButton
                onClick={openCreateLease}
                icon={<Plus size={16} />}
                disabled={activeLeases.length >= bedroomCount}
              >
                Crear lease
              </UiButton>
            }
          >
            <div style={{ display: "grid", gap: "14px", marginBottom: "14px" }}>
              <AppCard>
                <div
                  style={{
                    display: "flex",
                    gap: "18px",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={summaryCardTextStyle}>
                    Capacidad máxima: <strong>{bedroomCount}</strong> lease(s) activo(s)
                  </div>

                  <div style={summaryCardTextStyle}>
                    Ocupados: <strong>{activeLeases.length}</strong> · Disponibles:{" "}
                    <strong>{Math.max(bedroomCount - activeLeases.length, 0)}</strong>
                  </div>
                </div>
              </AppCard>
            </div>

            {activeLeases.length > 0 ? (
              <AppGrid minWidth={280}>
                {activeLeases.map((lease) => {
                  const tenant = lease.tenant_id ? tenantsMap.get(lease.tenant_id) : null;
                  const responsiblePayer = lease.responsible_payer_id
                    ? tenantsMap.get(lease.responsible_payer_id)
                    : null;

                  return (
                    <AppCard key={lease.id}>
                      <div style={{ display: "grid", gap: "12px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 800,
                              color: "#111827",
                            }}
                          >
                            Cuarto {lease.room_number || "—"}
                          </div>

                          <LeaseStatusPill status={lease.status} />
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Inquilino</div>
                          <div style={miniValueStyle}>{getTenantDisplayName(tenant)}</div>
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Responsable de pago</div>
                          <div style={miniValueStyle}>
                            {responsiblePayer
                              ? getTenantDisplayName(responsiblePayer)
                              : lease.billing_name || lease.billing_email || "Mismo inquilino"}
                          </div>
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Renta</div>
                          <div style={miniValueStyle}>{formatCurrency(lease.rent_amount)}</div>
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Inicio</div>
                          <div style={miniValueStyle}>{formatDate(lease.start_date)}</div>
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Fin</div>
                          <div style={miniValueStyle}>{formatDate(lease.end_date)}</div>
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Nombre de facturación</div>
                          <div style={miniValueStyle}>
                            {lease.billing_name || "Sin definir"}
                          </div>
                        </div>

                        <div style={miniGroupStyle}>
                          <div style={miniLabelStyle}>Email de facturación</div>
                          <div style={miniValueStyle}>
                            {lease.billing_email || "Sin definir"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                            marginTop: "4px",
                          }}
                        >
                          <UiButton
                            onClick={() => openEditLease(lease)}
                            icon={<Pencil size={16} />}
                          >
                            Editar lease
                          </UiButton>

                          <UiButton
                            variant="secondary"
                            onClick={() => handleFinishLease(lease.id, lease.end_date)}
                            icon={<XCircle size={16} />}
                          >
                            Finalizar lease
                          </UiButton>
                        </div>
                      </div>
                    </AppCard>
                  );
                })}
              </AppGrid>
            ) : (
              <AppCard>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ color: "#6B7280", fontWeight: 500 }}>
                    No hay leases activos para este departamento.
                  </div>

                  <div>
                    <UiButton onClick={openCreateLease} icon={<Plus size={16} />}>
                      Crear lease
                    </UiButton>
                  </div>
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
                {leaseHistory.map((lease) => {
                  const tenant = lease.tenant_id ? tenantsMap.get(lease.tenant_id) : null;
                  const responsiblePayer = lease.responsible_payer_id
                    ? tenantsMap.get(lease.responsible_payer_id)
                    : null;

                  return (
                    <AppCard key={lease.id}>
                      <div style={{ display: "grid", gap: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 700,
                              color: "#111827",
                            }}
                          >
                            {getTenantDisplayName(tenant)} · Cuarto {lease.room_number || "—"}
                          </div>

                          <LeaseStatusPill status={lease.status} />
                        </div>

                        <div style={historyMetaTextStyle}>
                          Responsable de pago:{" "}
                          {responsiblePayer
                            ? getTenantDisplayName(responsiblePayer)
                            : lease.billing_name || lease.billing_email || "Mismo inquilino"}
                        </div>

                        <div style={historyMetaTextStyle}>
                          Inicio: {formatDate(lease.start_date)}
                        </div>

                        <div style={historyMetaTextStyle}>
                          Fin: {formatDate(lease.end_date)}
                        </div>

                        <div style={historyMetaTextStyle}>
                          Renta: {formatCurrency(lease.rent_amount)}
                        </div>

                        <div style={historyMetaTextStyle}>
                          Facturación:{" "}
                          {lease.billing_name || lease.billing_email
                            ? `${lease.billing_name || "Sin nombre"} · ${
                                lease.billing_email || "Sin email"
                              }`
                            : "Sin datos de facturación"}
                        </div>
                      </div>
                    </AppCard>
                  );
                })}
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
              <AppSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="VACANT">VACANT</option>
                <option value="RENTED">RENTED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </AppSelect>
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
                Código visible sugerido:{" "}
                <strong>{generateDisplayCode(building.code, unitNumber)}</strong>
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "8px",
              }}
            >
              <UiButton type="button" variant="secondary" onClick={handleCancelEdit}>
                Cancelar
              </UiButton>

              <UiButton type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </UiButton>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={showLeaseModal}
        onClose={closeLeaseModal}
        title={editingLeaseId ? "Editar lease" : "Crear lease"}
        subtitle="Asigna el arrendamiento de un cuarto específico dentro de esta unidad."
      >
        <form onSubmit={handleSaveLease}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label style={labelStyle}>Inquilino</label>
                <AppSelect
                  value={leaseForm.tenantId}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({
                      ...prev,
                      tenantId: e.target.value,
                      responsiblePayerId:
                        prev.responsiblePayerId && prev.responsiblePayerId !== prev.tenantId
                          ? prev.responsiblePayerId
                          : "",
                    }))
                  }
                >
                  <option value="">Selecciona un inquilino</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </AppSelect>
              </div>

              <div>
                <label style={labelStyle}>Responsable de pago</label>
                <AppSelect
                  value={leaseForm.responsiblePayerId}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({
                      ...prev,
                      responsiblePayerId: e.target.value,
                    }))
                  }
                >
                  <option value="">Mismo inquilino</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </AppSelect>
              </div>

              <div>
                <label style={labelStyle}>Cuarto</label>
                <AppSelect
                  value={leaseForm.roomNumber}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({
                      ...prev,
                      roomNumber: e.target.value,
                    }))
                  }
                >
                  <option value="">Selecciona un cuarto</option>
                  {availableRoomNumbers.map((roomNumber) => (
                    <option key={roomNumber} value={String(roomNumber)}>
                      Cuarto {roomNumber}
                    </option>
                  ))}
                </AppSelect>
              </div>

              <div>
                <label style={labelStyle}>Renta mensual</label>
                <input
                  value={leaseForm.rentAmount}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({
                      ...prev,
                      rentAmount: e.target.value.replace(/[^\d.]/g, ""),
                    }))
                  }
                  style={inputStyle}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label style={labelStyle}>Fecha de inicio</label>
                <input
                  type="date"
                  value={leaseForm.startDate}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Fecha de fin</label>
                <input
                  type="date"
                  value={leaseForm.endDate}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Nombre de facturación</label>
                <input
                  value={billingPreview.billingName}
                  style={readOnlyInputStyle}
                  readOnly
                />
              </div>

              <div>
                <label style={labelStyle}>Email de facturación</label>
                <input
                  value={billingPreview.billingEmail}
                  style={readOnlyInputStyle}
                  readOnly
                />
              </div>

              <div>
                <label style={labelStyle}>Estatus del lease</label>
                <AppSelect
                  value={leaseForm.status}
                  onChange={(e) =>
                    setLeaseForm((prev) => ({
                      ...prev,
                      status: e.target.value as "ACTIVE" | "ENDED",
                    }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ENDED">ENDED</option>
                </AppSelect>
              </div>
            </div>

            <AppCard>
              <div style={{ display: "grid", gap: "6px" }}>
                <div style={miniLabelStyle}>Capacidad de la unidad</div>
                <div style={miniValueStyle}>
                  {bedroomCount} recámara(s) · {activeLeases.length} lease(s) activo(s)
                </div>
              </div>
            </AppCard>

            {msg && showLeaseModal ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "#FEF2F2",
                  color: "#B91C1C",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {msg}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "8px",
              }}
            >
              <UiButton type="button" variant="secondary" onClick={closeLeaseModal}>
                Cancelar
              </UiButton>

              <UiButton type="submit" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : editingLeaseId
                  ? "Guardar lease"
                  : "Crear lease"}
              </UiButton>
            </div>
          </div>
        </form>
      </Modal>

      <DeleteConfirmModal
        open={showDeleteLeaseModal}
        title="Eliminar lease"
        description={
          leaseToDelete
            ? `¿Seguro que quieres eliminar el lease de ${getTenantDisplayName(
                leaseToDelete.tenant_id ? tenantsMap.get(leaseToDelete.tenant_id) : null
              )} del cuarto ${leaseToDelete.room_number || "—"}? Esta acción no se puede deshacer.`
            : "¿Seguro que quieres eliminar este lease? Esta acción no se puede deshacer."
        }
        confirmText={saving ? "Eliminando..." : "Eliminar"}
        cancelText="Cancelar"
        onCancel={closeDeleteLeaseModal}
        onConfirm={handleDeleteLeaseConfirmed}
      />
    </PageContainer>
  );
}

const miniLabelStyle: CSSProperties = {
  fontSize: "13px",
  color: "#6B7280",
  fontWeight: 600,
};

const miniValueStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#111827",
};

const summaryCardTitleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#111827",
};

const summaryCardTextStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "13px",
  color: "#6B7280",
  fontWeight: 500,
};

const historyMetaTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#4B5563",
};

const miniGroupStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
};