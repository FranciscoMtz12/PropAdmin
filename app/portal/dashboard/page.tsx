"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  FileText,
  Home,
  KeyRound,
  Wallet,
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
      id: string;
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

export default function PortalDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [lease, setLease] = useState<PortalLeaseRecord | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [leaseError, setLeaseError] = useState("");

  useEffect(() => {
    async function loadLease() {
      if (userLoading) return;

      if (!user || user.role !== "tenant") {
        setLease(null);
        setLeaseLoading(false);
        return;
      }

      setLeaseLoading(true);
      setLeaseError("");

      const { data, error } = await supabase
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

      if (error) {
        console.error("Error cargando lease del portal:", error);
        setLeaseError(
          "No se pudo cargar la información del contrato del inquilino."
        );
        setLease(null);
        setLeaseLoading(false);
        return;
      }

      setLease((data as PortalLeaseRecord | null) ?? null);
      setLeaseLoading(false);
    }

    loadLease();
  }, [user, userLoading]);

  const contractStatusLabel = useMemo(() => {
    return formatLeaseStatus(lease?.status || null);
  }, [lease?.status]);

  const renewalMessage = useMemo(() => {
    if (!lease?.end_date) return null;

    const endDate = new Date(lease.end_date);
    if (Number.isNaN(endDate.getTime())) return null;

    const today = new Date();
    const diffMs = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "Tu contrato ya alcanzó su fecha final. Administración podrá indicarte el siguiente paso.";
    }

    if (diffDays <= 30) {
      return "Tu contrato vence pronto. Muy pronto aquí aparecerá el flujo de renovación.";
    }

    if (diffDays <= 90) {
      return "Tu contrato ya está dentro de la ventana de renovación. Aquí mostraremos la respuesta de renovación en la siguiente fase.";
    }

    return null;
  }, [lease?.end_date]);

  const tenantName =
    user?.role === "tenant" ? user.full_name || user.email : "Inquilino";

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

      {renewalMessage ? (
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

            <div>
              <div style={sectionTitleStyle}>Seguimiento de renovación</div>
              <div style={mutedTextStyle}>{renewalMessage}</div>
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
          subtitle="Fecha inicial registrada en tu lease."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Fin del contrato"
          value={leaseLoading ? "Cargando..." : formatDate(lease?.end_date)}
          subtitle="Fecha final registrada en tu lease."
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
                        : formatRenewalStatus(lease?.renewal_status || null)
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
            text="Aquí aparecerá el flujo formal de renovación cuando el contrato entre en su ventana correspondiente."
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
  if (normalized === "yes") return "Acepta renovar";
  if (normalized === "no") return "No desea renovar";
  if (normalized === "expired") return "Vencido";

  return value;
}