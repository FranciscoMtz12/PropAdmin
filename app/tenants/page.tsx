"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Building2, Home, Plus, Search, User2 } from "lucide-react";

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
  currentBuildingLabel: string;
  currentUnitLabel: string;
  hasActiveLease: boolean;
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

  const [showModal, setShowModal] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TenantFormState>(emptyForm());

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    void loadTenantsPage();
  }, [loading, user?.company_id]);

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
        .order("full_name", { ascending: true }),

      supabase
        .from("leases")
        .select(
          "id, company_id, unit_id, tenant_id, responsible_payer_id, billing_name, billing_email, due_day, rent_amount, status, start_date, end_date, created_at"
        )
        .eq("company_id", user.company_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id),

      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
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
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingTenantId(null);
    setForm(emptyForm());
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

    leases.forEach((lease) => {
      if (lease.status !== "ACTIVE") return;
      if (!lease.tenant_id) return;

      if (!activeLeaseByTenantId.has(lease.tenant_id)) {
        activeLeaseByTenantId.set(lease.tenant_id, lease);
      }
    });

    return tenants.map((tenant) => {
      const activeLease = activeLeaseByTenantId.get(tenant.id) || null;
      const unit = activeLease?.unit_id ? unitMap.get(activeLease.unit_id) : null;
      const building =
        unit?.building_id ? buildingMap.get(unit.building_id) : null;

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
        currentBuildingLabel: building?.name || "Sin lease activo",
        currentUnitLabel:
          unit?.display_code || unit?.unit_number || "Sin lease activo",
        hasActiveLease: Boolean(activeLease),
      };
    });
  }, [tenants, leases, units, buildings]);

  const filteredRows = useMemo(() => {
    return tenantRows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) {
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
  }, [tenantRows, statusFilter, search]);

  const activeCount = tenantRows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = tenantRows.filter((row) => row.status === "INACTIVE").length;
  const withLeaseCount = tenantRows.filter((row) => row.hasActiveLease).length;

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
            gridTemplateColumns: "minmax(260px, 1.2fr) minmax(220px, 0.8fr)",
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
                <Building2 size={14} />
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
              render: (row: TenantRow) => (
                <button
                  type="button"
                  onClick={() => {
                    const tenant = tenants.find((item) => item.id === row.id);
                    if (tenant) openEditModal(tenant);
                  }}
                  style={actionButtonStyle}
                >
                  Editar
                </button>
              ),
            },
          ]}
        />
      </SectionCard>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingTenantId ? "Editar inquilino" : "Nuevo inquilino"}
        subtitle="Centraliza aquí la información base para después usarla en leases, cobranza y facturación."
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

const actionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};