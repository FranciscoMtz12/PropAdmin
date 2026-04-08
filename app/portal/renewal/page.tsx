"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Home,
  Info,
  Search,
  User2,
  XCircle,
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
  renewal_status: string | null;
  renewal_due_date: string | null;
  renewal_offered_at: string | null;
};

type RenewalResponseRecord = {
  id: string;
  response: "yes" | "no" | string;
  created_at?: string | null;
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

export default function PortalRenewalPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lease, setLease] = useState<PortalLeaseRecord | null>(null);
  const [renewalResponse, setRenewalResponse] = useState<RenewalResponseRecord | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

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
        console.error("Error cargando tenants para preview de renovación:", error);
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
    async function loadRenewalData() {
      if (userLoading) return;

      if (!user) {
        setLease(null);
        setRenewalResponse(null);
        setPageLoading(false);
        return;
      }

      if (!effectiveTenantId) {
        setLease(null);
        setRenewalResponse(null);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      setPageError("");
      setSubmitMessage("");
      setSubmitError("");

      const { data: leaseData, error: leaseError } = await supabase
        .from("leases")
        .select(`
          id,
          start_date,
          end_date,
          status,
          renewal_status,
          renewal_due_date,
          renewal_offered_at
        `)
        .eq("tenant_id", effectiveTenantId)
        .is("deleted_at", null)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaseError) {
        console.error("Error cargando renovación del portal:", leaseError);
        setPageError("No se pudo cargar la información de renovación.");
        setLease(null);
        setRenewalResponse(null);
        setPageLoading(false);
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

        const resolvedResponse: RenewalResponseRecord | null =
          responseError || !responseData
            ? null
            : (responseData as RenewalResponseRecord);

        setRenewalResponse(resolvedResponse);
      } else {
        setRenewalResponse(null);
      }

      setPageLoading(false);
    }

    void loadRenewalData();
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
        text: "Todavía no inicia la ventana de renovación.",
        diffDays,
      };
    }

    if (diffDays <= 0) {
      return {
        showCard: true,
        text: "Tu contrato ya alcanzó su fecha final. Administración revisará el siguiente paso.",
        diffDays,
      };
    }

    if (diffDays <= 30) {
      return {
        showCard: true,
        text: "Tu contrato vence pronto. Por favor confirma si te interesa renovarlo.",
        diffDays,
      };
    }

    return {
      showCard: true,
      text: "Tu contrato ya está dentro de la ventana de renovación. Indícanos si deseas continuar.",
      diffDays,
    };
  }, [lease?.end_date]);

  async function handleRenewalAnswer(answer: "yes" | "no") {
    if (!lease?.id || isSuperAdmin) return;

    setSubmitLoading(true);
    setSubmitMessage("");
    setSubmitError("");

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
        setSubmitError(
          payload?.error || "No se pudo guardar tu respuesta de renovación."
        );
        setSubmitLoading(false);
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

      setSubmitMessage(
        payload?.message || "Tu respuesta quedó registrada correctamente."
      );
    } catch (error) {
      console.error("Error enviando respuesta de renovación:", error);
      setSubmitError("Ocurrió un error inesperado al guardar tu respuesta.");
    }

    setSubmitLoading(false);
  }

  function handleTenantSelection(nextTenantId: string) {
    if (!nextTenantId) {
      router.replace("/portal/renewal");
      return;
    }

    router.replace(`/portal/renewal?tenantId=${encodeURIComponent(nextTenantId)}`);
  }

  function goToDashboard() {
    if (effectiveTenantId && isSuperAdmin) {
      router.push(`/portal/dashboard?tenantId=${encodeURIComponent(effectiveTenantId)}`);
      return;
    }

    router.push("/portal/dashboard");
  }

  function goBackToTenants() {
    router.push("/tenants");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Renovación de contrato"
        subtitle={
          isSuperAdmin
            ? "Modo simulación de la renovación del inquilino seleccionado."
            : `Hola, ${tenantName}. Aquí puedes responder si te interesa renovar tu contrato.`
        }
        titleIcon={<CalendarDays size={20} />}
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
                Selecciona un inquilino para revisar su estatus de renovación.
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
              <div style={sectionTitleStyle}>No pudimos cargar la renovación</div>
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
                Elige un tenant desde el selector superior para abrir su renovación en modo vista previa.
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
          icon={<CalendarDays size={18} />}
          title="Fin del contrato"
          value={pageLoading ? "Cargando..." : formatDate(lease?.end_date)}
          subtitle="Fecha que define la ventana de renovación."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Límite de renovación"
          value={pageLoading ? "Cargando..." : formatDate(lease?.renewal_due_date)}
          subtitle="Fecha límite interna registrada."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Estado del lease"
          value={pageLoading ? "Cargando..." : formatLeaseStatus(lease?.status)}
          subtitle="Estado general del contrato."
        />
      </AppGrid>

      <div style={{ marginTop: 18 }}>
        {!renewalWindowInfo.showCard ? (
          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={iconBoxStyle}>
                <Info size={18} />
              </div>

              <div>
                <div style={sectionTitleStyle}>Aún no inicia la renovación</div>
                <div style={mutedTextStyle}>
                  {renewalWindowInfo.text || "Todavía no está activa la ventana de renovación."}
                </div>
              </div>
            </div>
          </AppCard>
        ) : (
          <AppCard
            style={{
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
                <div style={sectionTitleStyle}>Estado de renovación</div>
                <div style={{ marginTop: 6, ...mutedTextStyle }}>
                  {renewalWindowInfo.text}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={mutedTextStyle}>
                    Fecha fin de contrato: <strong>{formatDate(lease?.end_date)}</strong>
                  </div>

                  <div style={mutedTextStyle}>
                    Respuesta actual:{" "}
                    <strong>
                      {renewalResponse?.response === "yes"
                        ? "Sí quiere renovar"
                        : renewalResponse?.response === "no"
                        ? "No quiere renovar"
                        : "Sin respuesta"}
                    </strong>
                  </div>

                  {renewalResponse?.created_at ? (
                    <div style={mutedTextStyle}>
                      Última respuesta registrada:{" "}
                      <strong>{formatDate(renewalResponse.created_at)}</strong>
                    </div>
                  ) : null}
                </div>

                {isSuperAdmin ? (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 12,
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      color: "#1D4ED8",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Estás viendo esta sección en modo simulación. El superadmin no envía la respuesta del inquilino desde aquí.
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
                      disabled={submitLoading}
                      style={{
                        ...actionButtonStyle,
                        background: "#166534",
                        color: "#FFFFFF",
                        opacity: submitLoading ? 0.7 : 1,
                      }}
                    >
                      Sí, me interesa renovar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRenewalAnswer("no")}
                      disabled={submitLoading}
                      style={{
                        ...actionButtonStyle,
                        background: "#B91C1C",
                        color: "#FFFFFF",
                        opacity: submitLoading ? 0.7 : 1,
                      }}
                    >
                      No, no me interesa renovar
                    </button>
                  </div>
                )}

                {submitMessage ? (
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
                    {submitMessage}
                  </div>
                ) : null}

                {submitError ? (
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
                    {submitError}
                  </div>
                ) : null}
              </div>
            </div>
          </AppCard>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              {renewalResponse?.response === "yes" ? (
                <CheckCircle2 size={18} />
              ) : renewalResponse?.response === "no" ? (
                <XCircle size={18} />
              ) : (
                <Info size={18} />
              )}
            </div>

            <div>
              <div style={sectionTitleStyle}>Resumen actual</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                {renewalResponse?.response === "yes"
                  ? "El inquilino ya indicó que sí desea renovar."
                  : renewalResponse?.response === "no"
                  ? "El inquilino ya indicó que no desea renovar."
                  : "Todavía no existe una respuesta registrada para esta renovación."}
              </div>
            </div>
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
}