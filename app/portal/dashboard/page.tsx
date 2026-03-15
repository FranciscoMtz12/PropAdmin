"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Home,
  KeyRound,
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

export default function PortalDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [lease, setLease] = useState<PortalLeaseRecord | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [leaseError, setLeaseError] = useState("");

  const [renewalResponse, setRenewalResponse] = useState<RenewalResponseRecord | null>(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState("");
  const [renewalError, setRenewalError] = useState("");

  useEffect(() => {
    async function loadPortalData() {
      if (userLoading) return;

      if (!user || user.role !== "tenant") {
        setLease(null);
        setLeaseLoading(false);
        return;
      }

      setLeaseLoading(true);
      setLeaseError("");

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
        .eq("tenant_id", user.tenant_id)
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

      const resolvedLease = (leaseData as PortalLeaseRecord | null) ?? null;
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

    loadPortalData();
  }, [user, userLoading]);

  const tenantName =
    user?.role === "tenant" ? user.full_name || user.email : "Inquilino";

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
    if (!lease?.id) return;

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

  return (
    <PageContainer>
      <PageHeader
        title="Portal del inquilino"
        subtitle={`Hola, ${tenantName}. Aquí podrás consultar la información principal de tu contrato y, después, tus adeudos, facturas y pagos reportados.`}
        titleIcon={<Home size={20} />}
      />

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

      {renewalWindowInfo.showCard ? (
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

              {renewalResponse ? (
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
          icon={<KeyRound size={18} />}
          title="Estado del contrato"
          value={leaseLoading ? "Cargando..." : contractStatusLabel}
          subtitle="Estado general del lease vinculado a tu perfil."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Inicio del contrato"
          value={leaseLoading ? "Cargando..." : formatDate(lease?.start_date)}
          subtitle="Fecha inicial registrada en tu contrato."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Fin del contrato"
          value={leaseLoading ? "Cargando..." : formatDate(lease?.end_date)}
          subtitle="Fecha final registrada en tu contrato."
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
                    label="Clave edificio"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.units?.buildings?.code || "Sin código"
                    }
                  />
                  <DetailRow
                    label="Unidad"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.units?.display_code ||
                          lease?.units?.unit_number ||
                          "Sin unidad asignada"
                    }
                  />
                  <DetailRow
                    label="Dirección"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.units?.buildings?.address || "Sin dirección"
                    }
                  />
                </div>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={iconBoxStyle}>
                <FileText size={18} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={sectionTitleStyle}>Mi contrato</div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <DetailRow
                    label="ID del lease"
                    value={leaseLoading ? "Cargando..." : lease?.id || "Sin contrato"}
                  />
                  <DetailRow
                    label="Habitación / cuarto"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : lease?.room_number?.toString() || "No aplica"
                    }
                  />
                  <DetailRow
                    label="Renovación"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : formatRenewalStatus(
                            renewalResponse?.response || lease?.renewal_status || null
                          )
                    }
                  />
                  <DetailRow
                    label="Fecha límite de renovación"
                    value={
                      leaseLoading
                        ? "Cargando..."
                        : formatDate(lease?.renewal_due_date)
                    }
                  />
                </div>
              </div>
            </div>
          </AppCard>
        </AppGrid>
      </div>

      <div style={{ marginTop: 18 }}>
        <AppGrid minWidth={260}>
          <PlaceholderCard
            icon={<FileText size={18} />}
            title="Mis facturas y adeudos"
            text="Aquí conectaremos la cobranza real del lease para mostrar saldos, facturas y movimientos."
          />

          <PlaceholderCard
            icon={<Wallet size={18} />}
            title="Reportar pago"
            text="Aquí podrás subir comprobante y capturar el monto del pago para revisión administrativa."
          />

          <PlaceholderCard
            icon={<CalendarDays size={18} />}
            title="Renovación"
            text="Esta sección ya quedó conectada a tu respuesta de renovación y después la enlazaremos con tareas y seguimiento administrativo."
          />
        </AppGrid>
      </div>
    </PageContainer>
  );
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
          <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>
            {title}
          </div>
          <div style={{ marginTop: 6, ...valueStyle }}>{value}</div>
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
        gap: 4,
        padding: 12,
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        background: "#F9FAFB",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6B7280",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.5,
          color: "#111827",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PlaceholderCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <AppCard>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={iconBoxStyle}>{icon}</div>

        <div>
          <div style={sectionTitleStyle}>{title}</div>
          <div style={{ marginTop: 6, ...mutedTextStyle }}>{text}</div>
        </div>
      </div>
    </AppCard>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Sin información";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin información";

  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return "Sin información";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLeaseStatus(value?: string | null) {
  if (!value) return "Sin estado";

  const normalized = value.toLowerCase();

  if (normalized === "active") return "Activo";
  if (normalized === "draft") return "Borrador";
  if (normalized === "ended") return "Finalizado";
  if (normalized === "cancelled") return "Cancelado";
  if (normalized === "pending") return "Pendiente";

  return value;
}

function formatRenewalStatus(value?: string | null) {
  if (!value) return "Aún sin respuesta";

  const normalized = value.toLowerCase();

  if (normalized === "pending") return "Pendiente";
  if (normalized === "yes") return "Sí desea renovar";
  if (normalized === "no") return "No desea renovar";
  if (normalized === "expired") return "Vencido";

  return value;
}