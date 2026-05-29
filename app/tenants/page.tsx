"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  User2,
} from "lucide-react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { naturalCompare } from "@/lib/sort-utils";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppGrid from "@/components/AppGrid";
import MetricCircles from "@/components/MetricCircles";
import AppCard from "@/components/AppCard";
import AppTable from "@/components/AppTable";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AppSelect from "@/components/AppSelect";
import SensitiveField from "@/components/SensitiveField";
import { motion, AnimatePresence } from "framer-motion";

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

type Lease = {
  id: string;
  company_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  responsible_payer_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  due_day: number | null;
  rent_amount: number | null;
  room_number?: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
};

type Building = {
  id: string;
  name: string;
};

const tenantSchema = z.object({
  fullName: z.string().min(1, "El nombre completo es obligatorio"),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  billingName: z.string().optional(),
  billingEmail: z.string().email("Email inválido").or(z.literal("")).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  notes: z.string().optional(),
});
type TenantFormValues = z.infer<typeof tenantSchema>;

type TenantRow = {
  id: string;
  company_id: string;
  fullName: string;
  email: string;
  phone: string;
  taxId: string;
  billingName: string;
  billingEmail: string;
  status: "ACTIVE" | "INACTIVE";
  statusLabel: string;
  notes: string;
  createdAtLabel: string;
  currentBuildingId: string | null;
  currentBuildingLabel: string;
  currentUnitLabel: string;
  hasActiveLease: boolean;
  relatedLeaseCount: number;
  canDelete: boolean;
};

const EMPTY_FORM: TenantFormValues = {
  fullName: "",
  email: "",
  phone: "",
  taxId: "",
  billingName: "",
  billingEmail: "",
  status: "ACTIVE",
  notes: "",
};

function formatDate(dateValue: string) {
  try {
    return new Date(dateValue).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateValue;
  }
}

function formatCurrency(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}

function getStatusLabel(status: "ACTIVE" | "INACTIVE") {
  return status === "ACTIVE" ? "Activo" : "Inactivo";
}

function getStatusColors(status: "ACTIVE" | "INACTIVE") {
  if (status === "ACTIVE") {
    return {
      background: "var(--icon-bg-green)",
      color: "var(--badge-text-green)",
      border: "var(--metric-border-green)",
    };
  }

  return {
    background: "var(--bg-card-hover)",
    color: "var(--text-secondary)",
    border: "var(--border-default)",
  };
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--border-radius-lg)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--border-radius-lg)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  outline: "none",
  resize: "vertical",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 600,
  marginBottom: 8,
  color: "var(--text-primary)",
};

const errorTextStyle: CSSProperties = {
  color: "var(--metric-value-red)",
  fontSize: "0.75rem",
  marginTop: 4,
  marginBottom: 0,
};

export default function TenantsPage() {
  const { user, loading } = useCurrentUser();
  const { impersonationMode, groupCompanyIds, groupCompanies } = useImpersonation();
  const isGroupMode = impersonationMode === 'group';
  const router = useRouter();

  const [loadingPage, setLoadingPage] = useState(true);
  const [message, setMessage] = useState("");

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "INACTIVE">(
    "all"
  );
  const [buildingFilter, setBuildingFilter] = useState<string>("all");

  const [showModal, setShowModal] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: EMPTY_FORM,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<TenantRow | null>(null);

  const [openActionsTenantId, setOpenActionsTenantId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const [rentBuildingFilter, setRentBuildingFilter] = useState<string>("all");

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isSuperAdmin = user?.role === "superadmin" || Boolean(user?.is_superadmin);

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    void loadTenantsPage();
  }, [loading, user?.id, user?.company_id, user?.is_superadmin]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionsTenantId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function loadTenantsPage() {
    if (!user) return;

    setLoadingPage(true);
    setMessage("");

    const cid = user?.company_id ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co = (q: any) => cid ? q.eq("company_id", cid) : q;

    const [tenantsRes, leasesRes, unitsRes, buildingsRes] = await Promise.all([
      co(supabase
        .from("tenants")
        .select(
          "id, company_id, full_name, email, phone, tax_id, billing_name, billing_email, status, notes, created_at, updated_at"
        ))
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),

      co(supabase
        .from("leases")
        .select(
          "id, company_id, unit_id, tenant_id, responsible_payer_id, billing_name, billing_email, due_day, rent_amount, room_number, status, start_date, end_date, created_at"
        ))
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      co(supabase
        .from("units")
        .select("id, building_id, unit_number, display_code"))
        .is("deleted_at", null),

      co(supabase
        .from("buildings")
        .select("id, name"))
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);

    if (tenantsRes.error) {
      setMessage("No se pudieron cargar los inquilinos.");
      setLoadingPage(false);
      return;
    }

    if (leasesRes.error) {
      setMessage("No se pudieron cargar los leases de inquilinos.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMessage("No se pudieron cargar las unidades.");
      setLoadingPage(false);
      return;
    }

    if (buildingsRes.error) {
      setMessage("No se pudieron cargar los edificios.");
      setLoadingPage(false);
      return;
    }

    setTenants((tenantsRes.data as Tenant[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setBuildings((buildingsRes.data as Building[]) || []);
    setLoadingPage(false);
  }

  function openCreateModal() {
    setEditingTenantId(null);
    reset(EMPTY_FORM);
    setShowModal(true);
    setMessage("");
  }

  function openEditModal(tenant: Tenant) {
    setEditingTenantId(tenant.id);
    reset({
      fullName: tenant.full_name || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      taxId: tenant.tax_id || "",
      billingName: tenant.billing_name || "",
      billingEmail: tenant.billing_email || "",
      status: tenant.status,
      notes: tenant.notes || "",
    });
    setShowModal(true);
    setMessage("");
    setOpenActionsTenantId(null);
  }

  function closeModal() {
    if (isSubmitting) return;
    setShowModal(false);
    setEditingTenantId(null);
    reset(EMPTY_FORM);
  }

  function openDeleteModal(row: TenantRow) {
    if (deleting) return;
    setTenantToDelete(row);
    setShowDeleteModal(true);
    setMessage("");
    setOpenActionsTenantId(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setShowDeleteModal(false);
    setTenantToDelete(null);
  }

  function handleOpenTenantPortalDashboard(tenantId: string) {
    setOpenActionsTenantId(null);
    router.push(`/portal/dashboard?tenantId=${encodeURIComponent(tenantId)}`);
  }

  function handleOpenTenantPortalInvoices(tenantId: string) {
    setOpenActionsTenantId(null);
    router.push(`/portal/invoices?tenantId=${encodeURIComponent(tenantId)}`);
  }

  const onSubmitTenant = handleSubmit(async (data) => {
    setMessage("");

    if (!user?.company_id) {
      setMessage("No se encontró la empresa del usuario.");
      return;
    }

    const payload = {
      full_name: data.fullName.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      tax_id: data.taxId?.trim() || null,
      billing_name: data.billingName?.trim() || null,
      billing_email: data.billingEmail?.trim() || null,
      status: data.status,
      notes: data.notes?.trim() || null,
    };

    if (editingTenantId) {
      const { error } = await supabase
        .from("tenants")
        .update(payload)
        .eq("id", editingTenantId)
        .eq("company_id", user.company_id);

      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("tenants").insert({
        company_id: user.company_id,
        ...payload,
      });

      if (error) {
        setMessage(error.message);
        return;
      }
    }

    setShowModal(false);
    setEditingTenantId(null);
    reset(EMPTY_FORM);
    setMessage(
      editingTenantId
        ? "Inquilino actualizado correctamente."
        : "Inquilino creado correctamente."
    );
    await loadTenantsPage();
  });

  const tenantRows = useMemo<TenantRow[]>(() => {
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));
    const buildingMap = new Map(buildings.map((building) => [building.id, building]));

    const activeLeaseByTenantId = new Map<string, Lease>();
    const relatedLeaseCountByTenantId = new Map<string, number>();

    leases.forEach((lease) => {
      if (lease.tenant_id) {
        relatedLeaseCountByTenantId.set(
          lease.tenant_id,
          (relatedLeaseCountByTenantId.get(lease.tenant_id) || 0) + 1
        );

        if (lease.status === "ACTIVE" && !activeLeaseByTenantId.has(lease.tenant_id)) {
          activeLeaseByTenantId.set(lease.tenant_id, lease);
        }
      }

      if (lease.responsible_payer_id) {
        relatedLeaseCountByTenantId.set(
          lease.responsible_payer_id,
          (relatedLeaseCountByTenantId.get(lease.responsible_payer_id) || 0) + 1
        );
      }
    });

    return tenants.map((tenant) => {
      const activeLease = activeLeaseByTenantId.get(tenant.id) || null;
      const unit = activeLease?.unit_id ? unitMap.get(activeLease.unit_id) : null;
      const building = unit?.building_id ? buildingMap.get(unit.building_id) : null;
      const relatedLeaseCount = relatedLeaseCountByTenantId.get(tenant.id) || 0;

      return {
        id: tenant.id,
        company_id: tenant.company_id,
        fullName: tenant.full_name,
        email: tenant.email || "—",
        phone: tenant.phone || "—",
        taxId: tenant.tax_id || "—",
        billingName: tenant.billing_name || "—",
        billingEmail: tenant.billing_email || "—",
        status: tenant.status,
        statusLabel: getStatusLabel(tenant.status),
        notes: tenant.notes || "—",
        createdAtLabel: formatDate(tenant.created_at),
        currentBuildingId: building?.id || null,
        currentBuildingLabel: building?.name || "Sin lease activo",
        currentUnitLabel: unit?.display_code || unit?.unit_number || "Sin lease activo",
        hasActiveLease: Boolean(activeLease),
        relatedLeaseCount,
        canDelete: relatedLeaseCount === 0,
      };
    });
  }, [tenants, leases, units, buildings]);

  const filteredRows = useMemo(() => {
    return tenantRows.filter((row) => {
      if (isGroupMode && groupCompanyIds.length > 0 && !groupCompanyIds.includes(row.company_id)) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      if (buildingFilter === "no_lease" && row.currentBuildingId !== null) {
        return false;
      }

      if (
        buildingFilter !== "all" &&
        buildingFilter !== "no_lease" &&
        row.currentBuildingId !== buildingFilter
      ) {
        return false;
      }

      if (search.trim()) {
        const value = search.trim().toLowerCase();

        const haystack = [
          row.fullName,
          row.email,
          row.phone,
          row.taxId,
          row.billingName,
          row.billingEmail,
          row.currentBuildingLabel,
          row.currentUnitLabel,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(value)) {
          return false;
        }
      }

      return true;
    });
  }, [tenantRows, statusFilter, buildingFilter, search, isGroupMode, groupCompanyIds]);

  const tenantsByCompany = useMemo(() => {
    if (!isGroupMode) return [];
    return groupCompanies
      .filter((c) => groupCompanyIds.includes(c.id))
      .map((company) => ({
        company,
        compTenants: filteredRows.filter((t) => t.company_id === company.id),
      }))
      .filter(({ compTenants }) => compTenants.length > 0);
  }, [isGroupMode, groupCompanies, groupCompanyIds, filteredRows]);

  const activeCount = tenantRows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = tenantRows.filter((row) => row.status === "INACTIVE").length;
  const withLeaseCount = tenantRows.filter((row) => row.hasActiveLease).length;

  /* ── Historial de precios de renta por unidad ── */
  const rentHistoryData = useMemo(() => {
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const buildingMap = new Map(buildings.map((b) => [b.id, b]));

    /* Agrupar leases por unit_id, solo los que tienen rent_amount */
    const leasesByUnit = new Map<string, Lease[]>();
    leases.forEach((lease) => {
      if (!lease.unit_id || lease.rent_amount == null) return;
      if (!leasesByUnit.has(lease.unit_id)) leasesByUnit.set(lease.unit_id, []);
      leasesByUnit.get(lease.unit_id)!.push(lease);
    });

    /* Ordenar por start_date desc (más reciente primero) */
    leasesByUnit.forEach((ls) => {
      ls.sort((a, b) => {
        const da = a.start_date || a.created_at;
        const db = b.start_date || b.created_at;
        return db.localeCompare(da);
      });
    });

    /* Agrupar por edificio */
    const byBuilding = new Map<string, { building: Building; entries: { unit: Unit; leases: Lease[] }[] }>();
    leasesByUnit.forEach((ls, unitId) => {
      const unit = unitMap.get(unitId);
      if (!unit) return;
      const building = buildingMap.get(unit.building_id);
      if (!building) return;
      if (!byBuilding.has(building.id)) byBuilding.set(building.id, { building, entries: [] });
      byBuilding.get(building.id)!.entries.push({ unit, leases: ls });
    });

    /* Ordenar unidades dentro de cada edificio */
    byBuilding.forEach((entry) => {
      entry.entries.sort((a, b) => {
        const la = a.unit.display_code || a.unit.unit_number || "";
        const lb = b.unit.display_code || b.unit.unit_number || "";
        return naturalCompare(la, lb);
      });
    });

    let result = Array.from(byBuilding.values()).sort((a, b) =>
      a.building.name.localeCompare(b.building.name)
    );

    if (rentBuildingFilter !== "all") {
      result = result.filter((e) => e.building.id === rentBuildingFilter);
    }
    return result;
  }, [leases, units, buildings, rentBuildingFilter]);

  async function handleDeleteTenantConfirmed() {
    if (!user?.company_id || !tenantToDelete) return;

    setDeleting(true);
    setMessage("");

    // Soft delete: marca deleted_at en lugar de eliminar físicamente
    const { error } = await supabase
      .from("tenants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tenantToDelete.id)
      .eq("company_id", user.company_id);

    if (error) {
      setDeleting(false);
      setMessage(`No se pudo eliminar el inquilino. ${error.message}`);
      return;
    }

    if (editingTenantId === tenantToDelete.id) {
      setShowModal(false);
      setEditingTenantId(null);
      reset(EMPTY_FORM);
    }

    setDeleting(false);
    setShowDeleteModal(false);
    setTenantToDelete(null);
    setMessage("Inquilino archivado correctamente.");
    await loadTenantsPage();
  }

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>
          Cargando inquilinos...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  const TENANT_COLS = [
    {
      key: "fullName",
      header: "Inquilino",
      render: (row: TenantRow) => (
        <div style={{ display: "grid", gap: 4 }}>
          <span style={cellPrimaryStyle}>{row.fullName}</span>
          <span style={cellSecondaryStyle}>{row.createdAtLabel}</span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      render: (row: TenantRow) => (
        <div style={{ display: "grid", gap: 4 }}>
          <SensitiveField value={row.email} type="email" />
          <SensitiveField value={row.phone} type="phone" />
        </div>
      ),
    },
    {
      key: "currentUnit",
      header: "Unidad ligada",
      render: (row: TenantRow) => (
        <div style={{ display: "grid", gap: 4 }}>
          <span style={cellPrimaryStyle}>{row.currentBuildingLabel}</span>
          <span style={cellSecondaryStyle}>{row.currentUnitLabel}</span>
        </div>
      ),
    },
    {
      key: "billing",
      header: "Facturación",
      render: (row: TenantRow) => (
        <div style={{ display: "grid", gap: 4 }}>
          <span style={cellPrimaryStyle}>{row.billingName}</span>
          <span style={cellSecondaryStyle}>{row.billingEmail}</span>
        </div>
      ),
    },
    {
      key: "taxId",
      header: "RFC",
      render: (row: TenantRow) => (
        <SensitiveField value={row.taxId === "—" ? null : row.taxId} type="rfc" />
      ),
    },
    {
      key: "status",
      header: "Estatus",
      render: (row: TenantRow) => {
        const colors = getStatusColors(row.status);
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.background,
              color: colors.color,
              fontSize: "0.75rem",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {row.statusLabel}
          </span>
        );
      },
    },
    {
      key: "notes",
      header: "Notas",
      render: (row: TenantRow) => (
        <span style={cellSecondaryStyle}>{row.notes}</span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (row: TenantRow) => {
        const tenant = tenants.find((item) => item.id === row.id);
        const isOpen = openActionsTenantId === row.id;
        return (
          <div
            style={{ position: "relative", display: "inline-block" }}
            ref={isOpen ? actionsMenuRef : null}
          >
            <button
              type="button"
              onClick={() =>
                setOpenActionsTenantId((prev) =>
                  prev === row.id ? null : row.id
                )
              }
              style={dropdownTriggerStyle}
            >
              <MoreHorizontal size={14} />
              Acciones
              <ChevronDown size={14} />
            </button>
            <AnimatePresence>
            {isOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={dropdownMenuStyle}
              >
                {isSuperAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenTenantPortalDashboard(row.id)}
                      style={dropdownPortalItemStyle}
                    >
                      <ExternalLink size={14} />
                      Ver dashboard portal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTenantPortalInvoices(row.id)}
                      style={dropdownPortalSecondaryItemStyle}
                    >
                      <FileText size={14} />
                      Ver adeudos
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => { if (tenant) openEditModal(tenant); }}
                  style={dropdownItemStyle}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteModal(row)}
                  style={dropdownDeleteItemStyle}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </motion.div>
            ) : null}
            </AnimatePresence>
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Inquilinos"
        titleIcon={<User2 size={18} />}
        actions={
          !isGroupMode ? (
            <UiButton onClick={openCreateModal} icon={<Plus size={16} />}>
              Nuevo inquilino
            </UiButton>
          ) : undefined
        }
      />

      {message ? (
        <AppCard>
          <div
            style={{
              color: message.includes("correctamente") ? "var(--badge-text-blue)" : "var(--badge-text-red)",
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        </AppCard>
      ) : null}

      {isSuperAdmin ? (
        <AppCard style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--border-radius-lg)",
                background: "var(--icon-bg-purple)",
                color: "var(--icon-color-purple)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ExternalLink size={18} />
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Vista portal desde superadmin
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "var(--text-muted)",
                }}
              >
                Desde la columna de acciones puedes abrir directamente el dashboard
                portal o los adeudos del tenant seleccionado sin cerrar sesión y sin
                perder acceso al resto del sistema.
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      <MetricCircles metrics={[
        { value: tenantRows.length, label: "Total" },
        { value: activeCount, label: "Activos", color: "success" },
        { value: withLeaseCount, label: "Con lease", color: "info" },
        { value: inactiveCount, label: "Inactivos", color: "danger" },
      ]} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <AppGrid minWidth={220} className="metric-grid-desktop-only">
        <AppCard>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={metricLabelStyle}>Total</div>
            <div style={metricValueStyle}>{tenantRows.length}</div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={metricLabelStyle}>Activos</div>
            <div style={metricValueStyle}>{activeCount}</div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={metricLabelStyle}>Con lease activo</div>
            <div style={metricValueStyle}>{withLeaseCount}</div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={metricLabelStyle}>Inactivos</div>
            <div style={metricValueStyle}>{inactiveCount}</div>
          </div>
        </AppCard>
      </AppGrid>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} style={{ marginTop: 16 }}>
      <SectionCard title="Filtros">
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", height: 36, boxSizing: "border-box", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)" }}>
              <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, email, RFC o unidad"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.875rem", color: "var(--text-primary)" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["all", "ACTIVE", "INACTIVE"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatusFilter(val)}
                  style={{
                    padding: "4px 10px", fontSize: "0.75rem", minHeight: 32,
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--border-default)",
                    background: statusFilter === val ? "var(--accent)" : "var(--bg-input)",
                    color: statusFilter === val ? "#fff" : "var(--text-secondary)",
                    cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                  }}
                >
                  {val === "all" ? "Todos" : val === "ACTIVE" ? "Activos" : "Inactivos"}
                </button>
              ))}
            </div>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", height: 32, fontSize: "0.875rem", boxSizing: "border-box", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            >
              <option value="all">Todos los edificios</option>
              <option value="no_lease">Sin lease activo</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div
            className="tenants-filter-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(260px, 1.2fr) minmax(220px, 0.8fr) minmax(240px, 0.9fr)",
              gap: 16,
            }}
          >
            <AppCard>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={filterLabelStyle}>
                  <Search size={14} />
                  Buscar
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, email, teléfono, RFC o unidad"
                  style={inputStyle}
                />
              </div>
            </AppCard>

            <AppCard>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={filterLabelStyle}>
                  <User2 size={14} />
                  Estatus
                </div>
                <AppSelect
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "ACTIVE" | "INACTIVE")
                  }
                >
                  <option value="all">Todos</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                </AppSelect>
              </div>
            </AppCard>

            <AppCard>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={filterLabelStyle}>
                  <Building2 size={14} />
                  Edificio
                </div>
                <AppSelect
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="no_lease">Sin lease activo</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </AppSelect>
              </div>
            </AppCard>
          </div>
        )}
      </SectionCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} style={{ marginTop: 16 }}>
      <SectionCard title={isGroupMode ? "Vista consolidada — Inquilinos" : "Listado de inquilinos"}>
        <div className="mod-table-wrap">
        {isGroupMode ? (
          tenantsByCompany.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem" }}>Sin inquilinos en las empresas activas.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {tenantsByCompany.map(({ company, compTenants }) => {
                const compColor = company.brand_color || "var(--accent)";
                return (
                  <div key={company.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: compColor, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {company.short_name || company.name}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 4 }}>
                        {compTenants.length} {compTenants.length === 1 ? "inquilino" : "inquilinos"}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "var(--border-default)", marginLeft: 8 }} />
                    </div>
                    <AppTable
                      rows={compTenants}
                      emptyState="Sin inquilinos en esta empresa."
                      columns={TENANT_COLS}
                    />
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <AppTable
            rows={filteredRows}
            emptyState="Todavía no hay inquilinos registrados."
            columns={TENANT_COLS}
          />
        )}
        </div>
      </SectionCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} style={{ marginTop: 16 }}>
      <SectionCard title="Historial de precios de renta">
        {/* Filtro por edificio */}
        <div style={{ marginBottom: 18 }}>
          <AppSelect
            value={rentBuildingFilter}
            onChange={(e) => setRentBuildingFilter(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="all">Todos los edificios</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </AppSelect>
        </div>

        {rentHistoryData.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>No hay historial de precios registrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            {rentHistoryData.map(({ building, entries }) => (
              <div key={building.id}>
                {/* Encabezado del edificio */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                  fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)",
                }}>
                  <Building2 size={15} style={{ color: "var(--text-muted)" }} />
                  {building.name}
                  <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>
                    · {entries.length} unidad{entries.length !== 1 ? "es" : ""}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(17.5rem, 1fr))", gap: 10 }}>
                  {entries.map(({ unit, leases: unitLeases }) => {
                    const currentLease  = unitLeases.find((l) => l.status === "ACTIVE");
                    const currentRent   = currentLease?.rent_amount ?? null;
                    const pastLeases    = unitLeases.filter((l) => l.status !== "ACTIVE" && l.rent_amount != null);
                    const prevRent      = pastLeases[0]?.rent_amount ?? null;
                    const direction =
                      currentRent != null && prevRent != null
                        ? currentRent > prevRent ? "up"
                        : currentRent < prevRent ? "down"
                        : "same"
                        : null;

                    return (
                      <AppCard key={unit.id} style={{ padding: "12px 14px" }}>
                        {/* Header: nombre unidad + precio actual */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                              {unit.display_code || unit.unit_number || "Unidad"}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                              {currentLease ? "Contrato activo" : "Sin contrato activo"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: "1.0625rem", fontWeight: 800, color: currentRent ? "var(--text-primary)" : "var(--text-muted)" }}>
                              {formatCurrency(currentRent)}
                            </div>
                            {direction === "up" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", fontSize: "0.6875rem", fontWeight: 700, color: "var(--metric-value-green)" }}>
                                <TrendingUp size={12} /> subió
                              </div>
                            ) : direction === "down" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", fontSize: "0.6875rem", fontWeight: 700, color: "var(--metric-value-red)" }}>
                                <TrendingDown size={12} /> bajó
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Historial de cambios */}
                        {unitLeases.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {unitLeases.map((lease, idx) => {
                              const prevAmount = idx + 1 < unitLeases.length ? unitLeases[idx + 1].rent_amount : null;
                              const isActive = lease.status === "ACTIVE";
                              const diff = prevAmount != null && lease.rent_amount != null
                                ? lease.rent_amount - prevAmount : null;
                              return (
                                <div key={lease.id} style={{
                                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                                  padding: "5px 8px", borderRadius: "var(--border-radius-md)",
                                  background: isActive ? "var(--icon-bg-green)" : "var(--bg-input)",
                                  fontSize: "0.75rem",
                                }}>
                                  <span style={{ fontWeight: 700, color: "var(--text-primary)", minWidth: 80, fontFamily: "monospace" }}>
                                    {formatCurrency(lease.rent_amount)}
                                  </span>
                                  <span style={{ color: "var(--text-muted)", flex: 1 }}>
                                    {lease.start_date ? formatDate(lease.start_date) : "—"}
                                    {lease.end_date ? ` → ${formatDate(lease.end_date)}` : ""}
                                  </span>
                                  {isActive ? (
                                    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--metric-value-green)", background: "rgba(16,185,129,0.12)", padding: "1px 6px", borderRadius: "var(--border-radius-md)" }}>ACTIVO</span>
                                  ) : null}
                                  {diff != null && diff !== 0 ? (
                                    <span style={{
                                      fontSize: "0.625rem", fontWeight: 700, padding: "1px 5px", borderRadius: "var(--border-radius-md)",
                                      color: diff > 0 ? "var(--metric-value-green)" : "var(--metric-value-red)",
                                      background: diff > 0 ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.1)",
                                    }}>
                                      {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </AppCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      </motion.div>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingTenantId ? "Editar inquilino" : "Nuevo inquilino"}
      >
        <form onSubmit={onSubmitTenant}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input
                  {...register("fullName")}
                  style={inputStyle}
                  placeholder="Nombre del inquilino"
                />
                {errors.fullName ? (
                  <p style={errorTextStyle}>{errors.fullName.message}</p>
                ) : null}
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  {...register("email")}
                  style={inputStyle}
                  placeholder="correo@ejemplo.com"
                />
                {errors.email ? (
                  <p style={errorTextStyle}>{errors.email.message}</p>
                ) : null}
              </div>

              <div>
                <label style={labelStyle}>Teléfono</label>
                <input
                  {...register("phone")}
                  style={inputStyle}
                  placeholder="Teléfono"
                />
              </div>

              <div>
                <label style={labelStyle}>RFC</label>
                <input
                  {...register("taxId")}
                  style={inputStyle}
                  placeholder="RFC opcional"
                />
              </div>

              <div>
                <label style={labelStyle}>Nombre de facturación</label>
                <input
                  {...register("billingName")}
                  style={inputStyle}
                  placeholder="Nombre fiscal si aplica"
                />
              </div>

              <div>
                <label style={labelStyle}>Email de facturación</label>
                <input
                  {...register("billingEmail")}
                  style={inputStyle}
                  placeholder="correo de facturación"
                />
                {errors.billingEmail ? (
                  <p style={errorTextStyle}>{errors.billingEmail.message}</p>
                ) : null}
              </div>

              <div>
                <label style={labelStyle}>Estatus</label>
                <AppSelect {...register("status")}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </AppSelect>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notas</label>
              <textarea
                {...register("notes")}
                rows={4}
                style={textareaStyle}
                placeholder="Notas internas del inquilino"
              />
            </div>

            {message && showModal ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--border-radius-lg)",
                  background: "var(--badge-bg-red)",
                  color: "var(--badge-text-red)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                {message}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <UiButton type="button" variant="secondary" onClick={closeModal}>
                Cancelar
              </UiButton>

              <UiButton type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Guardando..."
                  : editingTenantId
                    ? "Guardar inquilino"
                    : "Crear inquilino"}
              </UiButton>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={showDeleteModal}
        onClose={closeDeleteModal}
        title="Eliminar inquilino"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--border-radius-lg)",
              background: "var(--metric-bg-amber)",
              border: "1px solid var(--metric-border-amber)",
              color: "var(--badge-text-amber)",
              fontSize: "0.875rem",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            ¿Eliminar a{" "}
            <strong>{tenantToDelete?.fullName ?? "este inquilino"}</strong>?
            Esta acción lo ocultará del sistema pero conservará toda su
            información.
          </div>

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
              onClick={handleDeleteTenantConfirmed}
              disabled={deleting}
            >
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : "Eliminar inquilino"}
            </UiButton>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

const metricLabelStyle: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--text-muted)",
  fontWeight: 600,
};

const metricValueStyle: CSSProperties = {
  fontSize: "1.75rem",
  color: "var(--text-primary)",
  fontWeight: 800,
};

const filterLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: "0.8125rem",
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cellPrimaryStyle: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--text-primary)",
  fontWeight: 700,
};

const cellSecondaryStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--text-muted)",
};

const dropdownTriggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: "var(--border-radius-md)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  fontSize: "0.75rem",
  fontWeight: 700,
  cursor: "pointer",
};

const dropdownMenuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 220,
  background: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-lg)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  padding: 8,
  display: "grid",
  gap: 6,
  zIndex: 50,
};

const dropdownItemStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
  padding: "10px 12px",
  borderRadius: "var(--border-radius-md)",
  border: "none",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  cursor: "pointer",
};

const dropdownPortalItemStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
  padding: "10px 12px",
  borderRadius: "var(--border-radius-md)",
  border: "none",
  background: "var(--icon-bg-purple)",
  color: "var(--icon-color-purple)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  cursor: "pointer",
};

const dropdownPortalSecondaryItemStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
  padding: "10px 12px",
  borderRadius: "var(--border-radius-md)",
  border: "none",
  background: "var(--icon-bg-purple)",
  color: "var(--icon-color-purple)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  cursor: "pointer",
};

const dropdownDeleteItemStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
  padding: "10px 12px",
  borderRadius: "var(--border-radius-md)",
  border: "none",
  background: "var(--badge-bg-red)",
  color: "var(--badge-text-red)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  cursor: "pointer",
};