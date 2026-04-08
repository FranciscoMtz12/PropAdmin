"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  Home,
  Info,
  KeyRound,
  Receipt,
  Search,
  User2,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";

type TenantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
};

type PortalLeaseRecord = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  rent_amount: number | null;
  due_day: number | null;
  billing_name: string | null;
  billing_email: string | null;
  renewal_status: string | null;
  renewal_due_date: string | null;
  renewal_offered_at: string | null;
  room_number: number | null;
  units?: {
    id: string;
    unit_number: string | null;
    display_code: string | null;
    buildings?: {
      id: string | null;
      name: string | null;
      code: string | null;
      address: string | null;
    } | null;
  } | null;
};

const iconBoxStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#EEF2FF",
  color: "#4338CA",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const mutedTextStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6B7280",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const valueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
};

const actionButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

function normalizeTenantOption(raw: any): TenantOption {
  return {
    id: raw?.id ?? "",
    full_name: raw?.full_name ?? null,
    email: raw?.email ?? null,
    company_id: raw?.company_id ?? null,
  };
}

function normalizePortalLease(raw: any): PortalLeaseRecord {
  return {
    id: raw?.id ?? "",
    start_date: raw?.start_date ?? null,
    end_date: raw?.end_date ?? null,
    status: raw?.status ?? null,
    rent_amount: raw?.rent_amount ?? null,
    due_day: raw?.due_day ?? null,
    billing_name: raw?.billing_name ?? null,
    billing_email: raw?.billing_email ?? null,
    renewal_status: raw?.renewal_status ?? null,
    renewal_due_date: raw?.renewal_due_date ?? null,
    renewal_offered_at: raw?.renewal_offered_at ?? null,
    room_number: raw?.room_number ?? null,
    units: raw?.units
      ? {
          id: raw.units?.id ?? "",
          unit_number: raw.units?.unit_number ?? null,
          display_code: raw.units?.display_code ?? null,
          buildings: raw.units?.buildings
            ? {
                id: raw.units.buildings?.id ?? null,
                name: raw.units.buildings?.name ?? null,
                code: raw.units.buildings?.code ?? null,
                address: raw.units.buildings?.address ?? null,
              }
            : null,
        }
      : null,
  };
}

function formatDate(dateKey?: string | null) {
  if (!dateKey) return "Sin fecha";

  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatLeaseStatus(status?: string | null) {
  if (!status) return "Sin estado";

  const normalized = status.toUpperCase();

  if (normalized === "ACTIVE") return "Activo";
  if (normalized === "ENDED") return "Finalizado";
  if (normalized === "CANCELLED") return "Cancelado";
  if (normalized === "PENDING") return "Pendiente";

  return status;
}

function formatRenewalStatus(status?: string | null) {
  if (!status) return "Sin respuesta";

  const normalized = status.toLowerCase();

  if (normalized === "yes") return "Sí quiere renovar";
  if (normalized === "no") return "No quiere renovar";
  if (normalized === "pending") return "Pendiente";

  return status;
}

function InfoCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <AppCard>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={iconBoxStyle}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={sectionTitleStyle}>{title}</div>
          <div style={{ marginTop: 8, ...valueStyle }}>{value}</div>
          <div style={{ marginTop: 8, ...mutedTextStyle }}>{subtitle}</div>
        </div>
      </div>
    </AppCard>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px minmax(0, 1fr)",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#6B7280",
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#111827",
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function PortalContractPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lease, setLease] = useState<PortalLeaseRecord | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantOptionsLoading, setTenantOptionsLoading] = useState(false);
  const [tenantSelectorValue, setTenantSelectorValue] = useState("");

  const previewTenantId = searchParams.get("tenantId");
  const isSuperAdmin = user?.role === "admin" && Boolean(user.is_superadmin);
  const effectiveTenantId =
    user?.role === "tenant" ? user.tenant_id : previewTenantId;

  useEffect(() => {
    async function loadTenantOptions() {
      if (userLoading) return;
      if (!isSuperAdmin) {
        setTenantOptions([]);
        return;
      }

      setTenantOptionsLoading(true);

      const { data, error } = await supabase
        .from("tenants")
        .select("id, full_name, email, company_id")
        .is("deleted_at", null)
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Error cargando tenants para preview del contrato:", error);
        setTenantOptions([]);
        setTenantOptionsLoading(false);
        return;
      }

      const resolvedTenantOptions = Array.isArray(data)
        ? data.map((item) => normalizeTenantOption(item))
        : [];

      setTenantOptions(resolvedTenantOptions);
      setTenantOptionsLoading(false);
    }

    void loadTenantOptions();
  }, [isSuperAdmin, userLoading]);

  useEffect(() => {
    setTenantSelectorValue(previewTenantId || "");
  }, [previewTenantId]);

  useEffect(() => {
    async function loadContractData() {
      if (userLoading) return;

      if (!user) {
        setLease(null);
        setPageLoading(false);
        return;
      }

      if (!effectiveTenantId) {
        setLease(null);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      setPageError("");

      const { data, error } = await supabase
        .from("leases")
        .select(`
          id,
          start_date,
          end_date,
          status,
          rent_amount,
          due_day,
          billing_name,
          billing_email,
          renewal_status,
          renewal_due_date,
          renewal_offered_at,
          room_number,
          units:unit_id (
            id,
            unit_number,
            display_code,
            buildings:building_id (
              id,
              name,
              code,
              address
            )
          )
        `)
        .eq("tenant_id", effectiveTenantId)
        .is("deleted_at", null)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error cargando contrato del portal:", error);
        setPageError("No se pudo cargar la información del contrato.");
        setLease(null);
        setPageLoading(false);
        return;
      }

      const resolvedLease = data ? normalizePortalLease(data) : null;

      setLease(resolvedLease);
      setPageLoading(false);
    }

    void loadContractData();
  }, [effectiveTenantId, user, userLoading]);

  const selectedTenant = useMemo(() => {
    if (user?.role === "tenant") {
      return {
        id: user.tenant_id,
        full_name: user.full_name,
        email: user.email,
        company_id: user.company_id,
      };
    }

    return tenantOptions.find((tenant) => tenant.id === effectiveTenantId) || null;
  }, [effectiveTenantId, tenantOptions, user]);

  const tenantName = selectedTenant?.full_name || selectedTenant?.email || "Inquilino";

  function handleTenantSelection(nextTenantId: string) {
    if (!nextTenantId) {
      router.replace("/portal/contract");
      return;
    }

    router.replace(`/portal/contract?tenantId=${encodeURIComponent(nextTenantId)}`);
  }

  function goToDashboard() {
    if (effectiveTenantId && isSuperAdmin) {
      router.push(`/portal/dashboard?tenantId=${encodeURIComponent(effectiveTenantId)}`);
      return;
    }

    router.push("/portal/dashboard");
  }

  function goToInvoices() {
    if (effectiveTenantId && isSuperAdmin) {
      router.push(`/portal/invoices?tenantId=${encodeURIComponent(effectiveTenantId)}`);
      return;
    }

    router.push("/portal/invoices");
  }

  function goBackToTenants() {
    router.push("/tenants");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mi contrato"
        subtitle={
          isSuperAdmin
            ? "Modo simulación del contrato del inquilino seleccionado."
            : `Hola, ${tenantName}. Aquí puedes revisar la información principal de tu contrato.`
        }
        titleIcon={<FileText size={20} />}
      />

      {isSuperAdmin ? (
        <AppCard style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Search size={18} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={sectionTitleStyle}>Actuar como inquilino</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                Selecciona un inquilino para navegar su contrato desde tu sesión superadmin.
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                <select
                  value={tenantSelectorValue}
                  onChange={(event) => {
                    const nextTenantId = event.target.value;
                    setTenantSelectorValue(nextTenantId);
                    handleTenantSelection(nextTenantId);
                  }}
                  disabled={tenantOptionsLoading}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    padding: "0 14px",
                    background: "#FFFFFF",
                    color: "#111827",
                    fontSize: 14,
                    fontWeight: 600,
                    outline: "none",
                  }}
                >
                  <option value="">
                    {tenantOptionsLoading
                      ? "Cargando inquilinos..."
                      : "Selecciona un inquilino para vista previa"}
                  </option>

                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {(tenant.full_name || "Sin nombre") +
                        (tenant.email ? ` — ${tenant.email}` : "")}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button
                    type="button"
                    onClick={goBackToTenants}
                    style={{
                      ...actionButtonStyle,
                      background: "#FFFFFF",
                      color: "#111827",
                      border: "1px solid #D1D5DB",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ArrowLeft size={16} />
                    Volver a inquilinos
                  </button>

                  <button
                    type="button"
                    onClick={goToDashboard}
                    disabled={!effectiveTenantId}
                    style={{
                      ...actionButtonStyle,
                      background: "#111827",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: effectiveTenantId ? 1 : 0.6,
                    }}
                  >
                    <Home size={16} />
                    Dashboard portal
                  </button>

                  <button
                    type="button"
                    onClick={goToInvoices}
                    disabled={!effectiveTenantId}
                    style={{
                      ...actionButtonStyle,
                      background: "#4F46E5",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: effectiveTenantId ? 1 : 0.6,
                    }}
                  >
                    <Receipt size={16} />
                    Ver adeudos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      {pageError ? (
        <AppCard
          style={{
            marginBottom: 18,
            border: "1px solid #FECACA",
            background: "#FEF2F2",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                ...iconBoxStyle,
                background: "#FEE2E2",
                color: "#B91C1C",
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>No pudimos cargar el contrato</div>
              <div style={mutedTextStyle}>{pageError}</div>
            </div>
          </div>
        </AppCard>
      ) : null}

      {isSuperAdmin && !effectiveTenantId ? (
        <AppCard style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Info size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Selecciona un inquilino para continuar</div>
              <div style={mutedTextStyle}>
                Elige un tenant desde el selector superior para abrir su contrato en modo vista previa.
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      <AppGrid minWidth={240}>
        <InfoCard
          icon={<User2 size={18} />}
          title="Inquilino"
          value={pageLoading ? "Cargando..." : tenantName}
          subtitle="Perfil actualmente mostrado."
        />

        <InfoCard
          icon={<KeyRound size={18} />}
          title="Estado del contrato"
          value={pageLoading ? "Cargando..." : formatLeaseStatus(lease?.status)}
          subtitle="Estado general del lease."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Inicio"
          value={pageLoading ? "Cargando..." : formatDate(lease?.start_date)}
          subtitle="Fecha de inicio del contrato."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Fin"
          value={pageLoading ? "Cargando..." : formatDate(lease?.end_date)}
          subtitle="Fecha final del contrato."
        />

        <InfoCard
          icon={<Wallet size={18} />}
          title="Renta"
          value={pageLoading ? "Cargando..." : formatCurrency(lease?.rent_amount)}
          subtitle="Monto actual registrado."
        />
      </AppGrid>

      <div style={{ marginTop: 18 }}>
        <AppGrid minWidth={320}>
          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={iconBoxStyle}>
                <Building2 size={18} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={sectionTitleStyle}>Datos de ubicación</div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <DetailRow
                    label="Edificio"
                    value={
                      pageLoading
                        ? "Cargando..."
                        : lease?.units?.buildings?.name || "Sin edificio asignado"
                    }
                  />
                  <DetailRow
                    label="Unidad"
                    value={
                      pageLoading
                        ? "Cargando..."
                        : lease?.units?.display_code ||
                          lease?.units?.unit_number ||
                          (lease?.room_number ? `Cuarto ${lease.room_number}` : "Sin unidad asignada")
                    }
                  />
                  <DetailRow
                    label="Dirección"
                    value={
                      pageLoading
                        ? "Cargando..."
                        : lease?.units?.buildings?.address || "Sin dirección registrada"
                    }
                  />
                  <DetailRow
                    label="Día de pago"
                    value={
                      pageLoading
                        ? "Cargando..."
                        : lease?.due_day
                        ? `Día ${lease.due_day} de cada mes`
                        : "Sin día definido"
                    }
                  />
                </div>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={iconBoxStyle}>
                <Receipt size={18} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={sectionTitleStyle}>Datos administrativos</div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <DetailRow
                    label="Nombre de facturación"
                    value={pageLoading ? "Cargando..." : lease?.billing_name || "No registrado"}
                  />
                  <DetailRow
                    label="Email de facturación"
                    value={pageLoading ? "Cargando..." : lease?.billing_email || "No registrado"}
                  />
                  <DetailRow
                    label="Estado de renovación"
                    value={pageLoading ? "Cargando..." : formatRenewalStatus(lease?.renewal_status)}
                  />
                  <DetailRow
                    label="Límite de renovación"
                    value={pageLoading ? "Cargando..." : formatDate(lease?.renewal_due_date)}
                  />
                  <DetailRow
                    label="Oferta enviada"
                    value={pageLoading ? "Cargando..." : formatDate(lease?.renewal_offered_at)}
                  />
                </div>
              </div>
            </div>
          </AppCard>
        </AppGrid>
      </div>
    </PageContainer>
  );
}