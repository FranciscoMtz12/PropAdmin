"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Home,
  Info,
  Search,
  Upload,
  User2,
  Wallet,
  XCircle,
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
  leaseId: string | null;
};

type AmountMode = "full" | "other";

type TenantReportedPaymentRecord = {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  collection_record_id: string | null;
  amount_reported: number;
  payment_date: string | null;
  notes: string | null;
  proof_file_url: string | null;
  proof_file_name: string | null;
  review_status: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string | null;
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

const iconBoxStyle: CSSProperties = {
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

const mutedTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6B7280",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const valueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
};

const inputStyle: CSSProperties = {
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

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 110,
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  padding: "12px 14px",
  background: "#FFFFFF",
  color: "#111827",
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
  resize: "vertical",
};

const actionButtonStyle: CSSProperties = {
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
    amount_due: Number(raw?.amount_due ?? 0),
    amount_collected: Number(raw?.amount_collected ?? 0),
    status: raw?.status ?? null,
  };
}

function normalizeTenantReportedPaymentRecord(raw: any): TenantReportedPaymentRecord {
  return {
    id: raw?.id ?? "",
    tenant_id: raw?.tenant_id ?? "",
    lease_id: raw?.lease_id ?? null,
    collection_record_id: raw?.collection_record_id ?? null,
    amount_reported: Number(raw?.amount_reported ?? 0),
    payment_date: raw?.payment_date ?? null,
    notes: raw?.notes ?? null,
    proof_file_url: raw?.proof_file_url ?? null,
    proof_file_name: raw?.proof_file_name ?? null,
    review_status: raw?.review_status ?? "pending_review",
    rejection_reason: raw?.rejection_reason ?? null,
    reviewed_at: raw?.reviewed_at ?? null,
    created_at: raw?.created_at ?? null,
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

function formatDateTime(dateKey?: string | null) {
  if (!dateKey) return "Sin fecha";

  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getTodayDateOnlyKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusVisual(status?: string | null) {
  if (status === "approved") {
    return {
      label: "Aprobado",
      background: "#ECFDF5",
      border: "#A7F3D0",
      color: "#166534",
      icon: <CheckCircle2 size={14} />,
    };
  }

  if (status === "rejected") {
    return {
      label: "Rechazado",
      background: "#FEF2F2",
      border: "#FECACA",
      color: "#B91C1C",
      icon: <XCircle size={14} />,
    };
  }

  return {
    label: "Pendiente de revisión",
    background: "#FEF3C7",
    border: "#FDE68A",
    color: "#92400E",
    icon: <Clock3 size={14} />,
  };
}

function formatDecimalInput(value: string) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const firstDot = sanitized.indexOf(".");

  if (firstDot === -1) return sanitized;

  return (
    sanitized.slice(0, firstDot + 1) +
    sanitized.slice(firstDot + 1).replace(/\./g, "")
  );
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
  const [reportedPayments, setReportedPayments] = useState<TenantReportedPaymentRecord[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [collectionRecordId, setCollectionRecordId] = useState("");
  const [amountMode, setAmountMode] = useState<AmountMode>("full");
  const [amountReported, setAmountReported] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateOnlyKey());
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [allowSuperadminSubmission, setAllowSuperadminSubmission] = useState(false);

  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const previewTenantId = searchParams.get("tenantId");
  const previewCollectionRecordId = searchParams.get("recordId");
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

      let resolvedCollections: CollectionRecord[] = [];

      if (leaseIds.length) {
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
          console.error(
            "Error cargando collection_records para reportar pago:",
            collectionError
          );
          setPageError("No se pudieron cargar los adeudos del tenant.");
          setPageLoading(false);
          return;
        }

        resolvedCollections = Array.isArray(collectionData)
          ? collectionData.map((item) => normalizeCollectionRecord(item))
          : [];
      }

      setCollectionRecords(resolvedCollections);

      const { data: reportedData, error: reportedError } = await supabase
        .from("tenant_reported_payments")
        .select(`
          id,
          tenant_id,
          lease_id,
          collection_record_id,
          amount_reported,
          payment_date,
          notes,
          proof_file_url,
          proof_file_name,
          review_status,
          rejection_reason,
          reviewed_at,
          created_at
        `)
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: false });

      if (reportedError) {
        console.error(
          "Error cargando historial de pagos reportados:",
          reportedError
        );
        setPageError("No se pudo cargar el historial de reportes de pago.");
        setPageLoading(false);
        return;
      }

      const resolvedReported = Array.isArray(reportedData)
        ? reportedData.map((item) => normalizeTenantReportedPaymentRecord(item))
        : [];

      setReportedPayments(resolvedReported);
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
          leaseId: record.lease_id,
        };
      })
      .filter((item): item is SelectableDebt => Boolean(item));
  }, [collectionRecords, leases]);

  const collectionMap = useMemo(() => {
    return new Map(collectionRecords.map((record) => [record.id, record]));
  }, [collectionRecords]);

  const reportDebtMap = useMemo(() => {
    const map = new Map<string, string>();

    selectableDebts.forEach((debt) => {
      map.set(debt.id, debt.label);
    });

    collectionRecords.forEach((record) => {
      if (map.has(record.id)) return;
      map.set(record.id, formatPeriod(record.period_year, record.period_month));
    });

    return map;
  }, [collectionRecords, selectableDebts]);

  const selectedDebt =
    selectableDebts.find((item) => item.id === collectionRecordId) || null;

  useEffect(() => {
    if (!selectableDebts.length) {
      setCollectionRecordId("");
      return;
    }

    if (previewCollectionRecordId) {
      const preselectedDebt = selectableDebts.find((item) => item.id === previewCollectionRecordId);
      if (preselectedDebt) {
        setCollectionRecordId((current) => (current ? current : preselectedDebt.id));
        return;
      }
    }

    setCollectionRecordId((current) =>
      current && selectableDebts.some((item) => item.id === current)
        ? current
        : selectableDebts[0]?.id || ""
    );
  }, [previewCollectionRecordId, selectableDebts]);

  useEffect(() => {
    if (!selectedDebt) {
      if (amountMode === "full") {
        setAmountReported("");
      }
      return;
    }

    if (amountMode === "full") {
      setAmountReported(String(selectedDebt.pendingAmount));
    }
  }, [amountMode, selectedDebt]);

  useEffect(() => {
    setPaymentDate((current) => current || getTodayDateOnlyKey());
  }, []);

  const totalPending = selectableDebts.reduce(
    (sum, item) => sum + item.pendingAmount,
    0
  );

  const pendingReportsCount = reportedPayments.filter(
    (item) => item.review_status === "pending_review"
  ).length;

  function handleTenantSelection(nextTenantId: string) {
    if (!nextTenantId) {
      router.replace("/portal/report-payment");
      return;
    }

    router.replace(
      `/portal/report-payment?tenantId=${encodeURIComponent(nextTenantId)}`
    );
  }

  function goToDashboard() {
    if (effectiveTenantId && isSuperAdmin) {
      router.push(
        `/portal/dashboard?tenantId=${encodeURIComponent(effectiveTenantId)}`
      );
      return;
    }

    router.push("/portal/dashboard");
  }

  function goToInvoices() {
    if (effectiveTenantId && isSuperAdmin) {
      router.push(
        `/portal/invoices?tenantId=${encodeURIComponent(effectiveTenantId)}`
      );
      return;
    }

    router.push("/portal/invoices");
  }

  function goBackToTenants() {
    router.push("/tenants");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (isSuperAdmin && !allowSuperadminSubmission) {
      setFormError(
        "Activa el modo de prueba para enviar este reporte como superadmin."
      );
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

    const relatedDebt = selectableDebts.find((item) => item.id === collectionRecordId);

    if (!relatedDebt) {
      setFormError("El adeudo seleccionado ya no está disponible.");
      return;
    }

    if (parsedAmount > relatedDebt.pendingAmount) {
      setFormError("El monto reportado no puede ser mayor al saldo pendiente.");
      return;
    }

    setSaving(true);
    setFormError("");
    setFormMessage("");

    try {
      let proofFileUrl: string | null = null;
      let proofFilePath: string | null = null;
      let proofFileName: string | null = null;
      let proofFileType: string | null = null;

      if (proofFile) {
        const ext = proofFile.name.split(".").pop() || "file";
        const safeExt = ext.toLowerCase();
        const filePath = `tenant/${effectiveTenantId}/${collectionRecordId}/${Date.now()}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(filePath, proofFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(filePath);

        proofFileUrl = publicUrlData.publicUrl;
        proofFilePath = filePath;
        proofFileName = proofFile.name;
        proofFileType = proofFile.type;
      }

      const payload = {
        company_id: selectedTenant?.company_id || user?.company_id || null,
        tenant_id: effectiveTenantId,
        lease_id: relatedDebt.leaseId,
        collection_record_id: collectionRecordId,
        collection_invoice_id: null,
        amount_reported: parsedAmount,
        payment_date: paymentDate,
        notes: isSuperAdmin
          ? `[SIMULACIÓN SUPERADMIN] ${notes.trim() || "Reporte enviado en modo prueba."}`
          : notes.trim() || null,
        proof_file_url: proofFileUrl,
        proof_file_path: proofFilePath,
        proof_file_name: proofFileName,
        proof_file_type: proofFileType,
        review_status: "pending_review",
      };

      const { error } = await supabase
        .from("tenant_reported_payments")
        .insert(payload);

      if (error) {
        throw error;
      }

      setFormMessage(
        isSuperAdmin
          ? "Reporte de pago enviado en modo prueba para revisión administrativa."
          : "Tu reporte de pago quedó enviado para revisión administrativa."
      );
      setAmountMode("full");
      setAmountReported(relatedDebt ? String(relatedDebt.pendingAmount) : "");
      setPaymentDate(getTodayDateOnlyKey());
      setNotes("");
      setProofFile(null);

      const { data: reportedData } = await supabase
        .from("tenant_reported_payments")
        .select(`
          id,
          tenant_id,
          lease_id,
          collection_record_id,
          amount_reported,
          payment_date,
          notes,
          proof_file_url,
          proof_file_name,
          review_status,
          rejection_reason,
          reviewed_at,
          created_at
        `)
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: false });

      const resolvedReported = Array.isArray(reportedData)
        ? reportedData.map((item) => normalizeTenantReportedPaymentRecord(item))
        : [];

      setReportedPayments(resolvedReported);
    } catch (error: any) {
      console.error("Error creando tenant_reported_payments:", error);
      setFormError(error?.message || "No se pudo registrar el reporte de pago.");
    } finally {
      setSaving(false);
    }
  }

  const tenantName =
    selectedTenant?.full_name || selectedTenant?.email || "Inquilino";

  return (
    <PageContainer>
      <PageHeader
        title="Reportar pago"
        subtitle={
          isSuperAdmin
            ? "Modo simulación del formulario que usará el inquilino para reportar un pago."
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
                Selecciona un inquilino para simular su experiencia real dentro del portal y probar el flujo de reporte de pago.
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
                Elige un tenant desde el selector superior para abrir su formulario en modo simulación.
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

        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Clock3 size={18} />
            </div>

            <div>
              <div style={sectionTitleStyle}>Reportes enviados</div>
              <div style={{ marginTop: 8, ...valueStyle }}>
                {pageLoading ? "Cargando..." : String(reportedPayments.length)}
              </div>
              <div style={{ marginTop: 8, ...mutedTextStyle }}>
                {pendingReportsCount} pendiente{pendingReportsCount === 1 ? "" : "s"} de revisión.
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
                Selecciona el adeudo correspondiente, captura el monto y sube el comprobante si lo tienes.
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
                  onChange={(event) => {
                    setCollectionRecordId(event.target.value);
                    setFormError("");
                    setFormMessage("");
                  }}
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
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    {selectedDebt.label}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={mutedTextStyle}>Edificio</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {selectedDebt.buildingLabel}
                      </div>
                    </div>
                    <div>
                      <div style={mutedTextStyle}>Unidad</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {selectedDebt.unitLabel}
                      </div>
                    </div>
                    <div>
                      <div style={mutedTextStyle}>Vencimiento</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {selectedDebt.dueDateLabel}
                      </div>
                    </div>
                    <div>
                      <div style={mutedTextStyle}>Saldo pendiente</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                        {formatCurrency(selectedDebt.pendingAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  ¿Qué monto quieres reportar?
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: amountMode === "full" ? "1px solid #86EFAC" : "1px solid #D1D5DB",
                      background: amountMode === "full" ? "#F0FDF4" : "#FFFFFF",
                      color: "#111827",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="radio"
                      name="amountMode"
                      checked={amountMode === "full"}
                      onChange={() => setAmountMode("full")}
                    />
                    Reportar saldo completo
                  </label>

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: amountMode === "other" ? "1px solid #93C5FD" : "1px solid #D1D5DB",
                      background: amountMode === "other" ? "#EFF6FF" : "#FFFFFF",
                      color: "#111827",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="radio"
                      name="amountMode"
                      checked={amountMode === "other"}
                      onChange={() => setAmountMode("other")}
                    />
                    Reportar otro monto
                  </label>
                </div>
              </div>

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
                    type="text"
                    inputMode="decimal"
                    value={amountReported}
                    onChange={(event) =>
                      setAmountReported(formatDecimalInput(event.target.value))
                    }
                    style={{
                      ...inputStyle,
                      background: amountMode === "full" ? "#F9FAFB" : "#FFFFFF",
                    }}
                    placeholder="0.00"
                    disabled={(isSuperAdmin && !allowSuperadminSubmission) || amountMode === "full"}
                  />
                  {selectedDebt ? (
                    <div style={{ ...mutedTextStyle, fontSize: 13 }}>
                      Máximo permitido para este adeudo: <strong>{formatCurrency(selectedDebt.pendingAmount)}</strong>
                    </div>
                  ) : null}
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
                    disabled={isSuperAdmin && !allowSuperadminSubmission}
                  />
                  <div style={{ ...mutedTextStyle, fontSize: 13 }}>
                    La fecha se llena automáticamente con hoy, pero puedes ajustarla si el pago se hizo antes.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  style={textareaStyle}
                  placeholder="Agrega un comentario opcional para administración."
                  disabled={isSuperAdmin && !allowSuperadminSubmission}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  Comprobante
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 54,
                    borderRadius: 12,
                    border: "1px dashed #C7D2FE",
                    background: "#F8FAFC",
                    padding: "0 14px",
                    cursor: isSuperAdmin && !allowSuperadminSubmission ? "not-allowed" : "pointer",
                    opacity: isSuperAdmin && !allowSuperadminSubmission ? 0.7 : 1,
                  }}
                >
                  <Upload size={16} color="#4F46E5" />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    {proofFile
                      ? proofFile.name
                      : "Selecciona imagen o PDF del comprobante"}
                  </span>

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      setProofFile(event.target.files?.[0] || null)
                    }
                    disabled={isSuperAdmin && !allowSuperadminSubmission}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {isSuperAdmin ? (
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #D1D5DB",
                    background: allowSuperadminSubmission ? "#EEF2FF" : "#F9FAFB",
                    color: "#111827",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowSuperadminSubmission}
                    onChange={(event) => setAllowSuperadminSubmission(event.target.checked)}
                  />
                  Permitir envío de prueba como superadmin para este inquilino
                </label>
              ) : null}

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
                <UiButton type="button" variant="secondary" onClick={goToInvoices}>
                  Ver adeudos
                </UiButton>

                <UiButton
                  type="submit"
                  disabled={saving || (isSuperAdmin && !allowSuperadminSubmission) || !selectableDebts.length || !collectionRecordId}
                >
                  {saving ? "Enviando..." : "Enviar reporte"}
                </UiButton>
              </div>
            </form>
          </div>
        </AppCard>
      </div>

      <div style={{ marginTop: 18 }}>
        <AppCard>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={sectionTitleStyle}>Historial de reportes</div>
              <div style={{ marginTop: 6, ...mutedTextStyle }}>
                Aquí puedes ver los pagos que ya enviaste y el estado de revisión de cada uno.
              </div>
            </div>

            {reportedPayments.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px dashed #D1D5DB",
                  background: "#F9FAFB",
                  color: "#6B7280",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Aún no has enviado reportes de pago.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {reportedPayments.map((report) => {
                  const statusVisual = getStatusVisual(report.review_status);
                  const linkedRecord = report.collection_record_id
                    ? collectionMap.get(report.collection_record_id) || null
                    : null;

                  const reportLabel = report.collection_record_id
                    ? reportDebtMap.get(report.collection_record_id) || "Adeudo relacionado"
                    : "Adeudo relacionado";

                  return (
                    <div
                      key={report.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        background: "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                            {reportLabel}
                          </div>
                          <div style={mutedTextStyle}>
                            Enviado: {formatDateTime(report.created_at)}
                          </div>
                        </div>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: `1px solid ${statusVisual.border}`,
                            background: statusVisual.background,
                            color: statusVisual.color,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {statusVisual.icon}
                          {statusVisual.label}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={mutedTextStyle}>Monto reportado</div>
                          <div style={valueStyle}>{formatCurrency(report.amount_reported)}</div>
                        </div>

                        <div>
                          <div style={mutedTextStyle}>Fecha del pago</div>
                          <div style={valueStyle}>{formatDate(report.payment_date)}</div>
                        </div>

                        {linkedRecord ? (
                          <div>
                            <div style={mutedTextStyle}>Saldo actual del adeudo</div>
                            <div style={valueStyle}>
                              {formatCurrency(
                                Math.max(
                                  Number(linkedRecord.amount_due || 0) -
                                    Number(linkedRecord.amount_collected || 0),
                                  0
                                )
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {report.notes ? (
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            background: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#111827",
                              marginBottom: 4,
                            }}
                          >
                            Tus notas
                          </div>
                          <div style={mutedTextStyle}>{report.notes}</div>
                        </div>
                      ) : null}

                      {report.review_status === "rejected" && report.rejection_reason ? (
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#991B1B",
                              marginBottom: 4,
                            }}
                          >
                            Motivo del rechazo
                          </div>
                          <div style={{ ...mutedTextStyle, color: "#991B1B" }}>
                            {report.rejection_reason}
                          </div>
                        </div>
                      ) : null}

                      {report.review_status !== "pending_review" && report.reviewed_at ? (
                        <div style={{ ...mutedTextStyle, fontWeight: 600 }}>
                          Revisado: {formatDateTime(report.reviewed_at)}
                        </div>
                      ) : null}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {report.proof_file_url ? (
                          <a
                            href={report.proof_file_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <UiButton variant="secondary">
                              Ver comprobante
                            </UiButton>
                          </a>
                        ) : (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px dashed #D1D5DB",
                              color: "#6B7280",
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            Sin comprobante adjunto
                          </div>
                        )}

                        {report.proof_file_name ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              color: "#6B7280",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            <Eye size={14} />
                            {report.proof_file_name}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
}