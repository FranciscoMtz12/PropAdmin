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
  User2,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";
import AppTable from "@/components/AppTable";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AppSelect from "@/components/AppSelect";

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

type TenantFormState = {
  fullName: string;
  email: string;
  phone: string;
  taxId: string;
  billingName: string;
  billingEmail: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
};

type TenantRow = {
  id: string;
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

function emptyForm(): TenantFormState {
  return {
    fullName: "",
    email: "",
    phone: "",
    taxId: "",
    billingName: "",
    billingEmail: "",
    status: "ACTIVE",
    notes: "",
  };
}

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

function getStatusLabel(status: "ACTIVE" | "INACTIVE") {
  return status === "ACTIVE" ? "Activo" : "Inactivo";
}

function getStatusColors(status: "ACTIVE" | "INACTIVE") {
  if (status === "ACTIVE") {
    return {
      background: "#DCFCE7",
      color: "#166534",
      border: "#86EFAC",
    };
  }

  return {
    background: "#F3F4F6",
    color: "#374151",
    border: "#D1D5DB",
  };
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  outline: "none",
  resize: "vertical",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 8,
  color: "#111827",
};

export default function TenantsPage() {
  const { user, loading } = useCurrentUser();
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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TenantFormState>(emptyForm());

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<TenantRow | null>(null);

  const [openActionsTenantId, setOpenActionsTenantId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const isSuperAdmin = user?.role === "admin" && Boolean(user.is_superadmin);

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    void loadTenantsPage();
  }, [loading, user?.company_id]);

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
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMessage("");

    const [tenantsRes, leasesRes, unitsRes, buildingsRes] = await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id, company_id, full_name, email, phone, tax_id, billing_name, billing_email, status, notes, created_at, updated_at"
        )
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),

      supabase
        .from("leases")
        .select(
          "id, company_id, unit_id, tenant_id, responsible_payer_id, billing_name, billing_email, due_day, rent_amount, room_number, status, start_date, end_date, created_at"
        )
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),

      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
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
    setForm(emptyForm());
    setShowModal(true);
    setMessage("");
  }

  function openEditModal(tenant: Tenant) {
    setEditingTenantId(tenant.id);
    setForm({
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
    if (saving) return;
    setShowModal(false);
    setEditingTenantId(null);
    setForm(emptyForm());
  }

  function openDeleteModal(row: TenantRow) {
    if (saving) return;
    setTenantToDelete(row);
    setShowDeleteModal(true);
    setMessage("");
    setOpenActionsTenantId(null);
  }

  function closeDeleteModal() {
    if (saving) return;
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

  async function handleSaveTenant(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!user?.company_id) {
      setMessage("No se encontró la empresa del usuario.");
      return;
    }

    if (!form.fullName.trim()) {
      setMessage("El nombre completo es obligatorio.");
      return;
    }

    setSaving(true);

    if (editingTenantId) {
      const { error } = await supabase
        .from("tenants")
        .update({
          full_name: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          tax_id: form.taxId.trim() || null,
          billing_name: form.billingName.trim() || null,
          billing_email: form.billingEmail.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
        })
        .eq("id", editingTenantId)
        .eq("company_id", user.company_id);

      if (error) {
        setSaving(false);
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("tenants").insert({
        company_id: user.company_id,
        full_name: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        tax_id: form.taxId.trim() || null,
        billing_name: form.billingName.trim() || null,
        billing_email: form.billingEmail.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      });

      if (error) {
        setSaving(false);
        setMessage(error.message);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    setEditingTenantId(null);
    setForm(emptyForm());
    setMessage(
      editingTenantId
        ? "Inquilino actualizado correctamente."
        : "Inquilino creado correctamente."
    );
    await loadTenantsPage();
  }

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
  }, [tenantRows, statusFilter, buildingFilter, search]);

  const activeCount = tenantRows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = tenantRows.filter((row) => row.status === "INACTIVE").length;
  const withLeaseCount = tenantRows.filter((row) => row.hasActiveLease).length;

  async function handleDeleteTenantConfirmed() {
    if (!user?.company_id || !tenantToDelete) return;

    setSaving(true);
    setMessage("");

    // Soft delete: marca deleted_at en lugar de eliminar físicamente
    const { error } = await supabase
      .from("tenants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tenantToDelete.id)
      .eq("company_id", user.company_id);

    if (error) {
      setSaving(false);
      setMessage(`No se pudo archivar el inquilino. ${error.message}`);
      return;
    }

    if (editingTenantId === tenantToDelete.id) {
      setShowModal(false);
      setEditingTenantId(null);
      setForm(emptyForm());
    }

    setSaving(false);
    setShowDeleteModal(false);
    setTenantToDelete(null);
    setMessage("Inquilino archivado correctamente.");
    await loadTenantsPage();
  }

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>
          Cargando inquilinos...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Inquilinos"
        titleIcon={<User2 size={18} />}
        actions={
          <UiButton onClick={openCreateModal} icon={<Plus size={16} />}>
            Nuevo inquilino
          </UiButton>
        }
      />

      {message ? (
        <AppCard>
          <div
            style={{
              color: message.includes("correctamente") ? "#1D4ED8" : "#B91C1C",
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
                borderRadius: 14,
                background: "#EEF2FF",
                color: "#4338CA",
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
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Vista portal desde superadmin
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#6B7280",
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

      <AppGrid minWidth={220}>
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

      <div style={{ height: 16 }} />

      <SectionCard title="Filtros">
        <div
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
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Listado de inquilinos">
        <AppTable
          rows={filteredRows}
          emptyState="Todavía no hay inquilinos registrados."
          columns={[
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
                  <span style={cellPrimaryStyle}>{row.email}</span>
                  <span style={cellSecondaryStyle}>{row.phone}</span>
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
                <span style={cellPrimaryStyle}>{row.taxId}</span>
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
                      fontSize: 12,
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

                    {isOpen ? (
                      <div style={dropdownMenuStyle}>
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
                          onClick={() => {
                            if (tenant) openEditModal(tenant);
                          }}
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
                          Archivar
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </SectionCard>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingTenantId ? "Editar inquilino" : "Nuevo inquilino"}
      >
        <form onSubmit={handleSaveTenant}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="Nombre del inquilino"
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label style={labelStyle}>Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="Teléfono"
                />
              </div>

              <div>
                <label style={labelStyle}>RFC</label>
                <input
                  value={form.taxId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, taxId: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="RFC opcional"
                />
              </div>

              <div>
                <label style={labelStyle}>Nombre de facturación</label>
                <input
                  value={form.billingName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, billingName: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="Nombre fiscal si aplica"
                />
              </div>

              <div>
                <label style={labelStyle}>Email de facturación</label>
                <input
                  value={form.billingEmail}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, billingEmail: e.target.value }))
                  }
                  style={inputStyle}
                  placeholder="correo de facturación"
                />
              </div>

              <div>
                <label style={labelStyle}>Estatus</label>
                <AppSelect
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as "ACTIVE" | "INACTIVE",
                    }))
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </AppSelect>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={4}
                style={textareaStyle}
                placeholder="Notas internas del inquilino"
              />
            </div>

            {message && showModal ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#FEF2F2",
                  color: "#B91C1C",
                  fontSize: 14,
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

              <UiButton type="submit" disabled={saving}>
                {saving
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
        title="Archivar inquilino"
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
            ¿Archivar a{" "}
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
              disabled={saving}
            >
              Cancelar
            </UiButton>
            <UiButton
              type="button"
              onClick={handleDeleteTenantConfirmed}
              disabled={saving}
            >
              <Trash2 size={16} />
              {saving ? "Archivando..." : "Archivar inquilino"}
            </UiButton>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

const metricLabelStyle: CSSProperties = {
  fontSize: 13,
  color: "#6B7280",
  fontWeight: 600,
};

const metricValueStyle: CSSProperties = {
  fontSize: 28,
  color: "#111827",
  fontWeight: 800,
};

const filterLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cellPrimaryStyle: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 700,
};

const cellSecondaryStyle: CSSProperties = {
  fontSize: 12,
  color: "#6B7280",
};

const dropdownTriggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dropdownMenuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 220,
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
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
  borderRadius: 10,
  border: "none",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 13,
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
  borderRadius: 10,
  border: "none",
  background: "#EEF2FF",
  color: "#3730A3",
  fontSize: 13,
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
  borderRadius: 10,
  border: "none",
  background: "#F5F3FF",
  color: "#5B21B6",
  fontSize: 13,
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
  borderRadius: 10,
  border: "none",
  background: "#FFF1F2",
  color: "#B91C1C",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};