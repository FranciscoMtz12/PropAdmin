"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
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
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";
import UiButton from "@/components/UiButton";

type TenantLeaseRecord = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  rent_amount: number | null;
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

type TenantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
};

type CollectionStoredStatus = "pending" | "partial" | "collected" | "overdue" | string;

type CollectionRecord = {
  id: string;
  collection_schedule_id: string | null;
  company_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: CollectionStoredStatus;
  collected_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
};

type TenantReportedPayment = {
  id: string;
  collection_record_id: string | null;
  review_status: string;
  amount_reported: number;
  payment_date: string;
  created_at: string;
};

type DisplayStatus = "paid" | "overdue" | "pending";

type InvoiceRow = {
  id: string;
  leaseId: string | null;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  amountCollected: number;
  amountCollectedLabel: string;
  pendingAmount: number;
  pendingAmountLabel: string;
  status: DisplayStatus;
  statusLabel: string;
  buildingLabel: string;
  unitLabel: string;
  leaseStatusLabel: string;
  notes: string;
  paymentMethodLabel: string;
  collectedAtLabel: string;
  pendingReviewCount: number;
  latestReportedPaymentLabel: string;
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

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getTodayDateOnlyKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateKey?: string | null) {
  if (!dateKey) return "Sin fecha";

  const safeDate = dateKey.length >= 10 ? dateKey.slice(0, 10) : dateKey;
  const date = parseDateOnly(safeDate);

  return `${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
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

function formatPeriod(periodYear: number, periodMonth: number) {
  return `${MONTH_LABELS_SHORT[periodMonth - 1] || "Mes"} ${periodYear}`;
}

function getDisplayStatus(record: CollectionRecord): DisplayStatus {
  const amountDue = Number(record.amount_due || 0);
  const amountCollected = Number(record.amount_collected || 0);
  const pendingAmount = Math.max(amountDue - amountCollected, 0);

  if (pendingAmount <= 0) return "paid";

  const today = getTodayDateOnlyKey();
  const dueDate = record.due_date?.slice(0, 10);

  if (dueDate && dueDate < today) return "overdue";

  return "pending";
}

function getDisplayStatusLabel(status: DisplayStatus) {
  if (status === "paid") return "Pagado";
  if (status === "overdue") return "Vencido";
  return "Pendiente";
}

function getStatusColors(status: DisplayStatus) {
  if (status === "paid") {
    return {
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
    };
  }

  if (status === "overdue") {
    return {
      background: "#FEF2F2",
      border: "#FECACA",
      text: "#B91C1C",
    };
  }

  return {
    background: "#FEFCE8",
    border: "#FDE68A",
    text: "#A16207",
  };
}

function getPaymentMethodLabel(method?: string | null) {
  if (!method) return "Sin método registrado";

  if (method === "transferencia") return "Transferencia";
  if (method === "efectivo") return "Efectivo";
  if (method === "tarjeta") return "Tarjeta";
  if (method === "deposito" || method === "depósito") return "Depósito";

  return method;
}

function getLeaseLocationLabel(lease?: TenantLeaseRecord | null) {
  const buildingName = lease?.units?.buildings?.name || "Sin edificio";
  const unitLabel =
    lease?.units?.display_code ||
    lease?.units?.unit_number ||
    (lease?.room_number ? `Cuarto ${lease.room_number}` : "Sin unidad");

  return {
    buildingLabel: buildingName,
    unitLabel,
  };
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

export default function PortalInvoicesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [leases, setLeases] = useState<TenantLeaseRecord[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [reportedPayments, setReportedPayments] = useState<TenantReportedPayment[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);

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
    async function loadInvoicesData() {
      if (userLoading) return;

      if (!user) {
        setLeases([]);
        setCollectionRecords([]);
        setReportedPayments([]);
        setPageLoading(false);
        return;
      }

      if (!effectiveTenantId) {
        setLeases([]);
        setCollectionRecords([]);
        setReportedPayments([]);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      setPageError("");

      const { data: leaseData, error: leaseError } = await supabase
        .from("leases")
        .select(`
          id,
          start_date,
          end_date,
          status,
          rent_amount,
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
        .order("start_date", { ascending: false });

      if (leaseError) {
        console.error("Error cargando leases del portal:", leaseError);
        setPageError("No se pudieron cargar tus adeudos.");
        setPageLoading(false);
        return;
      }

      const resolvedLeases: TenantLeaseRecord[] = Array.isArray(leaseData)
        ? (leaseData as TenantLeaseRecord[])
        : [];

      setLeases(resolvedLeases);

      const leaseIds = resolvedLeases
        .map((lease) => lease.id)
        .filter((id): id is string => Boolean(id));

      if (!leaseIds.length) {
        setCollectionRecords([]);
        setReportedPayments([]);
        setPageLoading(false);
        return;
      }

      const { data: recordData, error: recordError } = await supabase
        .from("collection_records")
        .select(`
          id,
          collection_schedule_id,
          company_id,
          building_id,
          unit_id,
          lease_id,
          period_year,
          period_month,
          due_date,
          amount_due,
          amount_collected,
          status,
          collected_at,
          payment_method,
          notes,
          created_at,
          updated_at
        `)
        .in("lease_id", leaseIds)
        .order("due_date", { ascending: true });

      if (recordError) {
        console.error("Error cargando collection_records del portal:");
        console.error("message:", recordError.message);
        console.error("details:", recordError.details);
        console.error("hint:", recordError.hint);
        console.error("code:", recordError.code);
        console.error("full error:", JSON.stringify(recordError, null, 2));

        setPageError("No se pudieron cargar tus adeudos.");
        setPageLoading(false);
        return;
      }

      const resolvedRecords: CollectionRecord[] = Array.isArray(recordData)
        ? (recordData as CollectionRecord[])
        : [];

      setCollectionRecords(resolvedRecords);

      const recordIds = resolvedRecords
        .map((record) => record.id)
        .filter((id): id is string => Boolean(id));

      if (!recordIds.length) {
        setReportedPayments([]);
        setPageLoading(false);
        return;
      }

      const { data: reportedData, error: reportedError } = await supabase
        .from("tenant_reported_payments")
        .select(`
          id,
          collection_record_id,
          review_status,
          amount_reported,
          payment_date,
          created_at
        `)
        .eq("tenant_id", effectiveTenantId)
        .in("collection_record_id", recordIds)
        .order("created_at", { ascending: false });

      if (reportedError) {
        console.error("Error cargando tenant_reported_payments del portal:", reportedError);
        setReportedPayments([]);
      } else {
        const resolvedReportedPayments: TenantReportedPayment[] = Array.isArray(reportedData)
          ? (reportedData as TenantReportedPayment[])
          : [];

        setReportedPayments(resolvedReportedPayments);
      }

      setPageLoading(false);
    }

    void loadInvoicesData();
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

  const leaseMap = useMemo(() => {
    return new Map(leases.map((lease) => [lease.id, lease]));
  }, [leases]);

  const reportedPaymentsByRecord = useMemo(() => {
    const map = new Map<string, TenantReportedPayment[]>();

    for (const payment of reportedPayments) {
      if (!payment.collection_record_id) continue;

      const current = map.get(payment.collection_record_id) || [];
      current.push(payment);
      map.set(payment.collection_record_id, current);
    }

    return map;
  }, [reportedPayments]);

  const invoiceRows = useMemo<InvoiceRow[]>(() => {
    const rows = collectionRecords.map((record) => {
      const lease = record.lease_id ? leaseMap.get(record.lease_id) || null : null;
      const location = getLeaseLocationLabel(lease);

      const amountDue = Number(record.amount_due || 0);
      const amountCollected = Number(record.amount_collected || 0);
      const pendingAmount = Math.max(amountDue - amountCollected, 0);

      const displayStatus = getDisplayStatus(record);
      const relatedReports = reportedPaymentsByRecord.get(record.id) || [];
      const pendingReviewCount = relatedReports.filter(
        (payment) => payment.review_status === "pending_review"
      ).length;

      const latestReportedPayment = relatedReports[0];

      return {
        id: record.id,
        leaseId: record.lease_id,
        periodLabel: formatPeriod(record.period_year, record.period_month),
        dueDate: record.due_date,
        dueDateLabel: formatDate(record.due_date),
        amountDue,
        amountDueLabel: formatCurrency(amountDue),
        amountCollected,
        amountCollectedLabel: formatCurrency(amountCollected),
        pendingAmount,
        pendingAmountLabel: formatCurrency(pendingAmount),
        status: displayStatus,
        statusLabel: getDisplayStatusLabel(displayStatus),
        buildingLabel: location.buildingLabel,
        unitLabel: location.unitLabel,
        leaseStatusLabel: formatLeaseStatus(lease?.status || null),
        notes: record.notes || "Sin notas registradas.",
        paymentMethodLabel: getPaymentMethodLabel(record.payment_method),
        collectedAtLabel: formatDate(
          record.collected_at ? record.collected_at.slice(0, 10) : null
        ),
        pendingReviewCount,
        latestReportedPaymentLabel: latestReportedPayment
          ? `${formatCurrency(latestReportedPayment.amount_reported)} reportado el ${formatDate(
              latestReportedPayment.payment_date
            )}`
          : "Sin reportes enviados todavía.",
      };
    });

    const statusRank: Record<DisplayStatus, number> = {
      overdue: 0,
      pending: 1,
      paid: 2,
    };

    return rows.sort((a, b) => {
      const statusDiff = statusRank[a.status] - statusRank[b.status];
      if (statusDiff !== 0) return statusDiff;

      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [collectionRecords, leaseMap, reportedPaymentsByRecord]);

  const summary = useMemo(() => {
    return invoiceRows.reduce(
      (accumulator, row) => {
        accumulator.totalDue += row.amountDue;
        accumulator.totalCollected += row.amountCollected;
        accumulator.totalPending += row.pendingAmount;

        if (row.status === "overdue") {
          accumulator.totalOverdue += row.pendingAmount;
          accumulator.overdueCount += 1;
        }

        if (row.status === "pending") {
          accumulator.pendingCount += 1;
        }

        if (row.status === "paid") {
          accumulator.paidCount += 1;
        }

        return accumulator;
      },
      {
        totalDue: 0,
        totalCollected: 0,
        totalPending: 0,
        totalOverdue: 0,
        overdueCount: 0,
        pendingCount: 0,
        paidCount: 0,
      }
    );
  }, [invoiceRows]);

  function handleTenantSelection(nextTenantId: string) {
    if (!nextTenantId) {
      router.replace("/portal/invoices");
      return;
    }

    router.replace(`/portal/invoices?tenantId=${encodeURIComponent(nextTenantId)}`);
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

  const tenantName =
    selectedTenant?.full_name || selectedTenant?.email || "Inquilino";

  return (
    <PageContainer>
      <PageHeader
        title="Mis facturas y adeudos"
        subtitle={
          isSuperAdmin
            ? "Vista previa de los adeudos reales del tenant seleccionado. Aquí puedes validar exactamente lo que verá dentro de su portal."
            : `Hola, ${tenantName}. Aquí puedes revisar tus cargos reales por periodo, cuánto llevas pagado y qué adeudos siguen pendientes o vencidos.`
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
              <div style={sectionTitleStyle}>Vista previa de tenant</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                Selecciona el inquilino cuya cobranza deseas revisar sin cerrar sesión de superadmin.
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
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid #D1D5DB",
                      background: "#FFFFFF",
                      color: "#111827",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
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
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "none",
                      background: "#111827",
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: effectiveTenantId ? 1 : 0.6,
                    }}
                  >
                    <Home size={16} />
                    Dashboard portal
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(`/portal/invoices${isSuperAdmin && effectiveTenantId ? `?tenantId=${encodeURIComponent(effectiveTenantId)}` : ""}`)}
                    disabled={!effectiveTenantId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "none",
                      background: "#4F46E5",
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
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
              <div style={sectionTitleStyle}>No pudimos cargar los adeudos</div>
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
                Primero elige un tenant desde el selector superior para abrir sus facturas y adeudos en modo vista previa.
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
          subtitle="Perfil actualmente visible en esta pantalla."
        />

        <InfoCard
          icon={<Wallet size={18} />}
          title="Saldo pendiente"
          value={pageLoading ? "Cargando..." : formatCurrency(summary.totalPending)}
          subtitle="Monto que todavía falta por cubrir en los adeudos."
        />

        <InfoCard
          icon={<AlertTriangle size={18} />}
          title="Saldo vencido"
          value={pageLoading ? "Cargando..." : formatCurrency(summary.totalOverdue)}
          subtitle="Parte pendiente que ya superó su fecha de vencimiento."
        />

        <InfoCard
          icon={<CheckCircle2 size={18} />}
          title="Monto pagado"
          value={pageLoading ? "Cargando..." : formatCurrency(summary.totalCollected)}
          subtitle="Suma de lo que ya aparece cobrado en los registros."
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          title="Periodos registrados"
          value={pageLoading ? "Cargando..." : String(invoiceRows.length)}
          subtitle="Cantidad total de cargos encontrados en el historial."
        />
      </AppGrid>

      <div style={{ marginTop: 18 }}>
        {pageLoading ? (
          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={iconBoxStyle}>
                <Clock3 size={18} />
              </div>

              <div>
                <div style={sectionTitleStyle}>Cargando adeudos</div>
                <div style={mutedTextStyle}>
                  Estamos reuniendo la información real de cobranza ligada al lease.
                </div>
              </div>
            </div>
          </AppCard>
        ) : !invoiceRows.length ? (
          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={iconBoxStyle}>
                <Info size={18} />
              </div>

              <div>
                <div style={sectionTitleStyle}>No hay adeudos registrados</div>
                <div style={mutedTextStyle}>
                  Por ahora no encontramos registros de cobranza ligados al contrato seleccionado.
                </div>
              </div>
            </div>
          </AppCard>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {invoiceRows.map((row) => {
              const colors = getStatusColors(row.status);
              const expanded = detailRecordId === row.id;

              return (
                <AppCard key={row.id}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={iconBoxStyle}>
                          <Home size={18} />
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: "#111827",
                            }}
                          >
                            {row.periodLabel}
                          </div>

                          <div style={{ marginTop: 4, ...mutedTextStyle }}>
                            {row.buildingLabel} · {row.unitLabel}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: `1px solid ${colors.border}`,
                          background: colors.background,
                          color: colors.text,
                          fontWeight: 700,
                          fontSize: 13,
                          alignSelf: "flex-start",
                        }}
                      >
                        {row.statusLabel}
                      </div>
                    </div>

                    <AppGrid minWidth={180} gap={12}>
                      <div
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 14,
                          padding: 14,
                          background: "#F9FAFB",
                        }}
                      >
                        <div style={{ ...mutedTextStyle, marginBottom: 6 }}>Monto del cargo</div>
                        <div style={valueStyle}>{row.amountDueLabel}</div>
                      </div>

                      <div
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 14,
                          padding: 14,
                          background: "#F9FAFB",
                        }}
                      >
                        <div style={{ ...mutedTextStyle, marginBottom: 6 }}>Pagado</div>
                        <div style={valueStyle}>{row.amountCollectedLabel}</div>
                      </div>

                      <div
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 14,
                          padding: 14,
                          background: "#F9FAFB",
                        }}
                      >
                        <div style={{ ...mutedTextStyle, marginBottom: 6 }}>Saldo pendiente</div>
                        <div style={valueStyle}>{row.pendingAmountLabel}</div>
                      </div>

                      <div
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 14,
                          padding: 14,
                          background: "#F9FAFB",
                        }}
                      >
                        <div style={{ ...mutedTextStyle, marginBottom: 6 }}>Vencimiento</div>
                        <div style={valueStyle}>{row.dueDateLabel}</div>
                      </div>
                    </AppGrid>

                    {row.pendingReviewCount > 0 ? (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          color: "#1D4ED8",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        Tienes {row.pendingReviewCount} reporte(s) de pago en revisión para este adeudo.
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <UiButton
                        variant="secondary"
                        icon={<Eye size={16} />}
                        onClick={() =>
                          setDetailRecordId((current) => (current === row.id ? null : row.id))
                        }
                      >
                        {expanded ? "Ocultar detalle" : "Ver detalle"}
                      </UiButton>

                      <UiButton
                        variant="primary"
                        icon={<CreditCard size={16} />}
                        disabled
                      >
                        Reportar pago
                      </UiButton>
                    </div>

                    {expanded ? (
                      <div
                        style={{
                          borderTop: "1px solid #E5E7EB",
                          paddingTop: 16,
                          display: "grid",
                          gap: 12,
                        }}
                      >
                        <DetailRow label="Periodo" value={row.periodLabel} />
                        <DetailRow label="Edificio" value={row.buildingLabel} />
                        <DetailRow label="Unidad" value={row.unitLabel} />
                        <DetailRow label="Estado del contrato" value={row.leaseStatusLabel} />
                        <DetailRow label="Vence el" value={row.dueDateLabel} />
                        <DetailRow label="Monto del cargo" value={row.amountDueLabel} />
                        <DetailRow label="Pagado" value={row.amountCollectedLabel} />
                        <DetailRow label="Saldo pendiente" value={row.pendingAmountLabel} />
                        <DetailRow label="Método registrado" value={row.paymentMethodLabel} />
                        <DetailRow label="Fecha de cobro" value={row.collectedAtLabel} />
                        <DetailRow
                          label="Último pago reportado"
                          value={row.latestReportedPaymentLabel}
                        />
                        <DetailRow label="Notas" value={row.notes} />
                      </div>
                    ) : null}
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <AppCard
          style={{
            border: "1px solid #E0E7FF",
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Building2 size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Navegación rápida del portal</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                Ya puedes moverte fácilmente entre el dashboard del tenant, sus adeudos y regresar al listado administrativo de inquilinos sin perder la vista previa.
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={goToDashboard}
                  disabled={!effectiveTenantId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: "#111827",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: effectiveTenantId ? 1 : 0.6,
                  }}
                >
                  <Home size={16} />
                  Dashboard portal
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/portal/invoices${isSuperAdmin && effectiveTenantId ? `?tenantId=${encodeURIComponent(effectiveTenantId)}` : ""}`)}
                  disabled={!effectiveTenantId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: "#4F46E5",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
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
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid #D1D5DB",
                      background: "#FFFFFF",
                      color: "#111827",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
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
      </div>
    </PageContainer>
  );
}