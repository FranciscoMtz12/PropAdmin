"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  Info,
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
import UiButton from "@/components/UiButton";

type TenantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
};

type LeaseRecord = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  units?: {
    id: string;
    unit_number: string | null;
    display_code: string | null;
    buildings?: {
      id: string | null;
      name: string | null;
    } | null;
  } | null;
};

type CollectionRecord = {
  id: string;
  lease_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: string | null;
};

type SelectableDebt = {
  id: string;
  label: string;
  pendingAmount: number;
  dueDateLabel: string;
  buildingLabel: string;
  unitLabel: string;
};

const MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

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

const inputStyle: React.CSSProperties = {
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

function normalizeLeaseRecord(raw: any): LeaseRecord {
  return {
    id: raw?.id ?? "",
    start_date: raw?.start_date ?? null,
    end_date: raw?.end_date ?? null,
    status: raw?.status ?? null,
    units: raw?.units
      ? {
          id: raw.units?.id ?? "",
          unit_number: raw.units?.unit_number ?? null,
          display_code: raw.units?.display_code ?? null,
          buildings: raw.units?.buildings
            ? {
                id: raw.units.buildings?.id ?? null,
                name: raw.units.buildings?.name ?? null,
              }
            : null,
        }
      : null,
  };
}

function normalizeCollectionRecord(raw: any): CollectionRecord {
  return {
    id: raw?.id ?? "",
    lease_id: raw?.lease_id ?? null,
    period_year: raw?.period_year ?? 0,
    period_month: raw?.period_month ?? 0,
    due_date: raw?.due_date ?? "",
    amount_due: raw?.amount_due ?? 0,
    amount_collected: raw?.amount_collected ?? 0,
    status: raw?.status ?? null,
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

function formatPeriod(periodYear: number, periodMonth: number) {
  return `${MONTH_LABELS_SHORT[periodMonth - 1] || "Mes"} ${periodYear}`;
}

export default function PortalReportPaymentPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantOptionsLoading, setTenantOptionsLoading] = useState(false);
  const [tenantSelectorValue, setTenantSelectorValue] = useState("");

  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [collectionRecordId, setCollectionRecordId] = useState("");
  const [amountReported, setAmountReported] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
        console.error("Error cargando tenants para preview de reportar pago:", error);
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
    async function loadPaymentFormData() {
      if (userLoading) return;

      if (!user) {
        setLeases([]);
        setCollectionRecords([]);
        setPageLoading(false);
        return;
      }

      if (!effectiveTenantId) {
        setLeases([]);
        setCollectionRecords([]);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      setPageError("");
      setFormError("");
      setFormMessage("");

      const { data: leaseData, error: leaseError } = await supabase
        .from("leases")
        .select(`
          id,
          start_date,
          end_date,
          status,
          units:unit_id (
            id,
            unit_number,
            display_code,
            buildings:building_id (
              id,
              name
            )
          )
        `)
        .eq("tenant_id", effectiveTenantId)
        .order("start_date", { ascending: false });

      if (leaseError) {
        console.error("Error cargando leases para reportar pago:", leaseError);
        setPageError("No se pudieron cargar los adeudos del tenant.");
        setPageLoading(false);
        return;
      }

      const resolvedLeases = Array.isArray(leaseData)
        ? leaseData.map((item) => normalizeLeaseRecord(item))
        : [];

      setLeases(resolvedLeases);

      const leaseIds = resolvedLeases
        .map((lease) => lease.id)
        .filter((id): id is string => Boolean(id));

      if (!leaseIds.length) {
        setCollectionRecords([]);
        setPageLoading(false);
        return;
      }

      const { data: collectionData, error: collectionError } = await supabase
        .from("collection_records")
        .select(`
          id,
          lease_id,
          period_year,
          period_month,
          due_date,
          amount_due,
          amount_collected,
          status
        `)
        .in("lease_id", leaseIds)
        .order("due_date", { ascending: true });

      if (collectionError) {
        console.error("Error cargando collection_records para reportar pago:", collectionError);
        setPageError("No se pudieron cargar los adeudos del tenant.");
        setPageLoading(false);
        return;
      }

      const resolvedCollections = Array.isArray(collectionData)
        ? collectionData.map((item) => normalizeCollectionRecord(item))
        : [];

      setCollectionRecords(resolvedCollections);
      setPageLoading(false);
    }

    void loadPaymentFormData();
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

  const selectableDebts = useMemo<SelectableDebt[]>(() => {
    const leaseMap = new Map(leases.map((lease) => [lease.id, lease]));

    return collectionRecords
      .map((record) => {
        const amountDue = Number(record.amount_due || 0);
        const amountCollected = Number(record.amount_collected || 0);
        const pendingAmount = Math.max(amountDue - amountCollected, 0);

        if (pendingAmount <= 0) return null;

        const lease = record.lease_id ? leaseMap.get(record.lease_id) || null : null;
        const buildingLabel = lease?.units?.buildings?.name || "Sin edificio";
        const unitLabel =
          lease?.units?.display_code || lease?.units?.unit_number || "Sin unidad";

        return {
          id: record.id,
          label: `${formatPeriod(record.period_year, record.period_month)} · ${buildingLabel} · ${unitLabel}`,
          pendingAmount,
          dueDateLabel: formatDate(record.due_date),
          buildingLabel,
          unitLabel,
        };
      })
      .filter((item): item is SelectableDebt => Boolean(item));
  }, [collectionRecords, leases]);

  const selectedDebt = selectableDebts.find((item) => item.id === collectionRecordId) || null;

  const totalPending = selectableDebts.reduce((sum, item) => sum + item.pendingAmount, 0);

  function handleTenantSelection(nextTenantId: string) {
    if (!nextTenantId) {
      router.replace("/portal/report-payment");
      return;
    }

    router.replace(`/portal/report-payment?tenantId=${encodeURIComponent(nextTenantId)}`);
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (isSuperAdmin) {
      setFormError("La vista superadmin es solo de revisión. El reporte lo envía el inquilino.");
      return;
    }

    if (!effectiveTenantId) {
      setFormError("No se encontró el tenant actual.");
      return;
    }

    if (!collectionRecordId) {
      setFormError("Selecciona primero el adeudo que deseas reportar.");
      return;
    }

    const parsedAmount = Number(amountReported);

    if (!parsedAmount || parsedAmount <= 0) {
      setFormError("Ingresa un monto válido mayor a cero.");
      return;
    }

    if (!paymentDate) {
      setFormError("Selecciona la fecha del pago.");
      return;
    }

    setSaving(true);
    setFormError("");
    setFormMessage("");

    const payload = {
      tenant_id: effectiveTenantId,
      collection_record_id: collectionRecordId,
      amount_reported: parsedAmount,
      payment_date: paymentDate,
      review_status: "pending_review",
    };

    const { error } = await supabase.from("tenant_reported_payments").insert(payload);

    if (error) {
      console.error("Error creando tenant_reported_payments:", error);
      setFormError(error.message || "No se pudo registrar el reporte de pago.");
      setSaving(false);
      return;
    }

    setFormMessage("Tu reporte de pago quedó enviado para revisión administrativa.");
    setCollectionRecordId("");
    setAmountReported("");
    setPaymentDate("");
    setSaving(false);
  }

  const tenantName = selectedTenant?.full_name || selectedTenant?.email || "Inquilino";

  return (
    <PageContainer>
      <PageHeader
        title="Reportar pago"
        subtitle={
          isSuperAdmin
            ? "Vista previa del formulario que usará el tenant para reportar un pago."
            : `Hola, ${tenantName}. Aquí puedes reportar un pago para que administración lo revise antes de aplicarlo a cobranza.`
        }
        titleIcon={<CreditCard size={20} />}
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
                Selecciona un inquilino para revisar el formulario de reporte de pago.
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
                  style={inputStyle}
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
                    <FileText size={16} />
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
              <div style={sectionTitleStyle}>No pudimos cargar el formulario</div>
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
                Elige un tenant desde el selector superior para abrir su formulario en modo vista previa.
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      <AppGrid minWidth={240}>
        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <User2 size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Inquilino</div>
              <div style={{ marginTop: 8, ...valueStyle }}>
                {pageLoading ? "Cargando..." : tenantName}
              </div>
              <div style={{ marginTop: 8, ...mutedTextStyle }}>
                Perfil actualmente mostrado.
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Wallet size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Saldo pendiente total</div>
              <div style={{ marginTop: 8, ...valueStyle }}>
                {pageLoading ? "Cargando..." : formatCurrency(totalPending)}
              </div>
              <div style={{ marginTop: 8, ...mutedTextStyle }}>
                Suma de todos los adeudos con saldo pendiente.
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <FileText size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Adeudos disponibles</div>
              <div style={{ marginTop: 8, ...valueStyle }}>
                {pageLoading ? "Cargando..." : String(selectableDebts.length)}
              </div>
              <div style={{ marginTop: 8, ...mutedTextStyle }}>
                Registros que todavía aceptan reporte de pago.
              </div>
            </div>
          </div>
        </AppCard>
      </AppGrid>

      <div style={{ marginTop: 18 }}>
        <AppCard>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={sectionTitleStyle}>Formulario de reporte</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                Selecciona el adeudo correspondiente y captura el monto que pagaste.
                La revisión administrativa ocurre antes de afectar la cobranza real.
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  Adeudo a reportar
                </label>

                <select
                  value={collectionRecordId}
                  onChange={(event) => setCollectionRecordId(event.target.value)}
                  style={inputStyle}
                  disabled={pageLoading || !selectableDebts.length}
                >
                  <option value="">
                    {pageLoading
                      ? "Cargando adeudos..."
                      : selectableDebts.length
                      ? "Selecciona un adeudo"
                      : "No hay adeudos pendientes"}
                  </option>

                  {selectableDebts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.label} · Pendiente {formatCurrency(debt.pendingAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDebt ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "#F8FAFC",
                    border: "1px solid #E5E7EB",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    {selectedDebt.label}
                  </div>
                  <div style={mutedTextStyle}>
                    Vence: <strong>{selectedDebt.dueDateLabel}</strong>
                  </div>
                  <div style={mutedTextStyle}>
                    Saldo pendiente: <strong>{formatCurrency(selectedDebt.pendingAmount)}</strong>
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 16,
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    Monto reportado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountReported}
                    onChange={(event) => setAmountReported(event.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                    disabled={isSuperAdmin}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    Fecha del pago
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    style={inputStyle}
                    disabled={isSuperAdmin}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  color: "#92400E",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                En este bloque queda listo el flujo base de reporte. El siguiente paso recomendado es agregar comprobante, referencia y storage para evidencia.
              </div>

              {formError ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#B91C1C",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {formError}
                </div>
              ) : null}

              {formMessage ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    color: "#065F46",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle2 size={18} />
                  {formMessage}
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <UiButton
                  type="button"
                  variant="secondary"
                  onClick={goToInvoices}
                >
                  Ver adeudos
                </UiButton>

                <UiButton
                  type="submit"
                  disabled={saving || isSuperAdmin || !selectableDebts.length}
                >
                  {saving ? "Enviando..." : "Enviar reporte"}
                </UiButton>
              </div>
            </form>
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
}