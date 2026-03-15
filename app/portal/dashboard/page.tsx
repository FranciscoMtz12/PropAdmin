"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Home,
  Info,
  KeyRound,
  Search,
  User2,
  Wallet,
  XCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";

type PortalLeaseRecord = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  rent_amount: number | null;
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

type RenewalResponseRecord = {
  id: string;
  response: "yes" | "no" | string;
  created_at?: string | null;
};

type TenantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
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
        gridTemplateColumns: "160px minmax(0, 1fr)",
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

export default function PortalDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lease, setLease] = useState<PortalLeaseRecord | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [leaseError, setLeaseError] = useState("");

  const [renewalResponse, setRenewalResponse] = useState<RenewalResponseRecord | null>(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState("");
  const [renewalError, setRenewalError] = useState("");

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
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Error cargando tenants para preview del portal:", error);
        setTenantOptions([]);
        setTenantOptionsLoading(false);
        return;
      }

      const resolvedTenantOptions: TenantOption[] = Array.isArray(data)
        ? (data as TenantOption[])
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
    async function loadPortalData() {
      if (userLoading) return;

      if (!user) {
        setLease(null);
        setLeaseLoading(false);
        return;
      }

      if (!effectiveTenantId) {
        setLease(null);
        setRenewalResponse(null);
        setLeaseLoading(false);
        return;
      }

      setLeaseLoading(true);
      setLeaseError("");
      setRenewalMessage("");
      setRenewalError("");

      const { data: leaseData, error: leaseQueryError } = await supabase
        .from("leases")
        .select(`
          id,
          start_date,
          end_date,
          status,
          rent_amount,
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
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaseQueryError) {
        console.error("Error cargando lease del portal:", leaseQueryError);
        setLeaseError("No se pudo cargar la información del contrato.");
        setLease(null);
        setLeaseLoading(false);
        return;
      }

      const resolvedLease: PortalLeaseRecord | null = leaseData
        ? (leaseData as PortalLeaseRecord)
        : null;

      setLease(resolvedLease);

      if (resolvedLease?.id) {
        const { data: responseData, error: responseError } = await supabase
          .from("lease_renewal_responses")
          .select("id, response, created_at")
          .eq("lease_id", resolvedLease.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!responseError && responseData) {
          setRenewalResponse(responseData as RenewalResponseRecord);
        } else {
          setRenewalResponse(null);
        }
      } else {
        setRenewalResponse(null);
      }

      setLeaseLoading(false);
    }

    void loadPortalData();
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

  const contractStatusLabel = useMemo(() => {
    return formatLeaseStatus(lease?.status || null);
  }, [lease?.status]);

  const renewalWindowInfo = useMemo(() => {
    if (!lease?.end_date) {
      return {
        showCard: false,
        text: "",
        diffDays: null as number | null,
      };
    }

    const endDate = new Date(`${lease.end_date}T00:00:00`);
    if (Number.isNaN(endDate.getTime())) {
      return {
        showCard: false,
        text: "",
        diffDays: null,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 90) {
      return {
        showCard: false,
        text: "",
        diffDays,
      };
    }

    if (diffDays <= 0) {
      return {
        showCard: true,
        text: "Tu contrato ya alcanzó su fecha final. Administración podrá indicarte el siguiente paso.",
        diffDays,
      };
    }

    if (diffDays <= 30) {
      return {
        showCard: true,
        text: "Tu contrato vence pronto. Por favor indica si te interesa renovarlo.",
        diffDays,
      };
    }

    return {
      showCard: true,
      text: "Tu contrato ya está dentro de la ventana de renovación. Indícanos si te interesa renovarlo.",
      diffDays,
    };
  }, [lease?.end_date]);

  async function handleRenewalAnswer(answer: "yes" | "no") {
    if (!lease?.id || isSuperAdmin) return;

    setRenewalLoading(true);
    setRenewalMessage("");
    setRenewalError("");

    try {
      const response = await fetch("/api/portal/renewal-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leaseId: lease.id,
          response: answer,
        }),
      });

      const rawText = await response.text();

      let payload: any = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        setRenewalError(
          payload?.error || "No se pudo guardar tu respuesta de renovación."
        );
        setRenewalLoading(false);
        return;
      }

      setRenewalResponse({
        id: crypto.randomUUID(),
        response: answer,
        created_at: new Date().toISOString(),
      });

      setLease((current) =>
        current
          ? {
              ...current,
              renewal_status: answer,
            }
          : current
      );

      setRenewalMessage(
        payload?.message || "Tu respuesta quedó registrada correctamente."
      );
    } catch (error) {
      console.error("Error enviando respuesta de renovación:", error);
      setRenewalError("Ocurrió un error inesperado al guardar tu respuesta.");
    }

    setRenewalLoading(false);
  }

  function handleTenantSelection(nextTenantId: string) {
    if (!nextTenantId) {
      router.replace("/portal/dashboard");
      return;
    }

    router.replace(`/portal/dashboard?tenantId=${encodeURIComponent(nextTenantId)}`);
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

  const showTenantSelectorCard = isSuperAdmin && !effectiveTenantId;

  return (
    <PageContainer>
      <PageHeader
        title="Portal del inquilino"
        subtitle={
          isSuperAdmin
            ? "Vista previa del portal tenant desde tu sesión superadmin. Aquí puedes revisar exactamente lo que verá el inquilino sin cerrar sesión."
            : `Hola, ${tenantName}. Aquí podrás consultar la información principal de tu contrato y, después, tus adeudos, facturas y pagos reportados.`
        }
        titleIcon={<Home size={20} />}
      />

      {isSuperAdmin ? (
        <AppCard style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Search size={18} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={sectionTitleStyle}>Vista previa de tenant</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                Selecciona un inquilino para revisar su portal completo desde tu sesión superadmin.
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gap: 12,
                }}
              >
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

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
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
                    onClick={() => router.push(`/portal/dashboard?tenantId=${encodeURIComponent(effectiveTenantId || "")}`)}
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
                    <FileText size={16} />
                    Ver adeudos
                  </button>
                </div>
              </div>

              {selectedTenant ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    background: "#F8FAFC",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    Tenant seleccionado: {selectedTenant.full_name || "Sin nombre"}
                  </div>
                  <div style={{ marginTop: 6, ...mutedTextStyle }}>
                    {selectedTenant.email || "Sin correo registrado"}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </AppCard>
      ) : null}

      {showTenantSelectorCard ? (
        <AppCard style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Info size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Selecciona un inquilino para continuar</div>
              <div style={mutedTextStyle}>
                Como superadmin, primero elige un tenant desde el selector superior para abrir su portal en modo vista previa.
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      {leaseError ? (
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
              <div style={sectionTitleStyle}>No pudimos cargar tu contrato</div>
              <div style={mutedTextStyle}>{leaseError}</div>
            </div>
          </div>
        </AppCard>
      ) : null}

      {renewalWindowInfo.showCard && lease ? (
        <AppCard
          style={{
            marginBottom: 18,
            border: "1px solid #FDE68A",
            background: "#FFFBEB",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                ...iconBoxStyle,
                background: "#FEF3C7",
                color: "#B45309",
              }}
            >
              <CalendarDays size={18} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={sectionTitleStyle}>Renovación de contrato</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                {renewalWindowInfo.text}
              </div>

              <div style={{ marginTop: 10, ...mutedTextStyle }}>
                Fecha fin de contrato: <strong>{formatDate(lease?.end_date)}</strong>
              </div>

              {isSuperAdmin ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    color: "#1D4ED8",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Estás viendo esta sección en modo vista previa. La respuesta del inquilino no se puede enviar desde superadmin.
                </div>
              ) : renewalResponse ? (
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  {renewalResponse.response === "yes" ? (
                    <CheckCircle2 size={18} color="#15803D" />
                  ) : (
                    <XCircle size={18} color="#B91C1C" />
                  )}

                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                    {renewalResponse.response === "yes"
                      ? "Ya registraste que sí te interesa renovar."
                      : "Ya registraste que no deseas renovar."}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleRenewalAnswer("yes")}
                    disabled={renewalLoading}
                    style={{
                      ...actionButtonStyle,
                      background: "#166534",
                      color: "#FFFFFF",
                      opacity: renewalLoading ? 0.7 : 1,
                    }}
                  >
                    Sí, me interesa renovar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRenewalAnswer("no")}
                    disabled={renewalLoading}
                    style={{
                      ...actionButtonStyle,
                      background: "#B91C1C",
                      color: "#FFFFFF",
                      opacity: renewalLoading ? 0.7 : 1,
                    }}
                  >
                    No, no me interesa renovar
                  </button>
                </div>
              )}

              {renewalMessage ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    color: "#065F46",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {renewalMessage}
                </div>
              ) : null}

              {renewalError ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#B91C1C",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {renewalError}
                </div>
              ) : null}
            </div>
          </div>
        </AppCard>
      ) : null}

      <AppGrid minWidth={240}>
        <InfoCard
          icon={<User2 size={18} />}
          title="Inquilino"
          value={leaseLoading ? "Cargando..." : tenantName}
          subtitle="Perfil actualmente mostrado en el portal."
        />

        <InfoCard
          icon={<KeyRound size={18} />}
          title="Estado del contrato"
          value={leaseLoading ? "Cargando..." : contractStatusLabel}
          subtitle="Estado general del lease vinculado al perfil mostrado."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Inicio del contrato"
          value={leaseLoading ? "Cargando..." : formatDate(lease?.start_date)}
          subtitle="Fecha inicial registrada en el contrato."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Fin del contrato"
          value={leaseLoading ? "Cargando..." : formatDate(lease?.end_date)}
          subtitle="Fecha final registrada en el contrato."
        />

        <InfoCard
          icon={<Wallet size={18} />}
          title="Renta"
          value={leaseLoading ? "Cargando..." : formatCurrency(lease?.rent_amount)}
          subtitle="Monto actual registrado en el contrato."
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
                <div style={sectionTitleStyle}>Mi ubicación</div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <DetailRow
                    label="Edificio"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.units?.buildings?.name || "Sin edificio asignado"
                    }
                  />
                  <DetailRow
                    label="Unidad"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.units?.display_code ||
                          lease?.units?.unit_number ||
                          (lease?.room_number ? `Cuarto ${lease.room_number}` : "Sin unidad asignada")
                    }
                  />
                  <DetailRow
                    label="Dirección"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.units?.buildings?.address || "Sin dirección registrada"
                    }
                  />
                </div>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={iconBoxStyle}>
                <Home size={18} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={sectionTitleStyle}>Navegación rápida del portal</div>
                <div style={{ marginTop: 8, ...mutedTextStyle }}>
                  Desde aquí puedes moverte rápido entre la vista general del contrato, los adeudos y regresar al listado administrativo de inquilinos.
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/portal/dashboard${isSuperAdmin && effectiveTenantId ? `?tenantId=${encodeURIComponent(effectiveTenantId)}` : ""}`)}
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
                    <FileText size={16} />
                    Ver adeudos
                  </button>

                  {isSuperAdmin ? (
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
                  ) : null}
                </div>
              </div>
            </div>
          </AppCard>
        </AppGrid>
      </div>
    </PageContainer>
  );
}