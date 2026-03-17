"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock3,
  CreditCard,
  Eye,
  FileWarning,
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
import Modal from "@/components/Modal";
import MetricCard from "@/components/MetricCard";

type ReportedPayment = {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  collection_record_id: string | null;
  amount_reported: number;
  payment_date: string;
  notes: string | null;
  proof_file_url: string | null;
  proof_file_path: string | null;
  proof_file_name: string | null;
  review_status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  tenants?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type ReviewTab = "pending_review" | "approved" | "rejected";

const sectionTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6B7280",
};

const strongValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const badgeStyleBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
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

function normalizeReportedPayment(raw: any): ReportedPayment {
  return {
    id: raw?.id ?? "",
    tenant_id: raw?.tenant_id ?? "",
    lease_id: raw?.lease_id ?? null,
    collection_record_id: raw?.collection_record_id ?? null,
    amount_reported: Number(raw?.amount_reported ?? 0),
    payment_date: raw?.payment_date ?? "",
    notes: raw?.notes ?? null,
    proof_file_url: raw?.proof_file_url ?? null,
    proof_file_path: raw?.proof_file_path ?? null,
    proof_file_name: raw?.proof_file_name ?? null,
    review_status: raw?.review_status ?? "pending_review",
    rejection_reason: raw?.rejection_reason ?? null,
    reviewed_at: raw?.reviewed_at ?? null,
    tenants: raw?.tenants
      ? {
          full_name: raw.tenants?.full_name ?? null,
          email: raw.tenants?.email ?? null,
        }
      : null,
  };
}

function getStatusVisual(status: string) {
  if (status === "approved") {
    return {
      label: "Aprobado",
      background: "#ECFDF5",
      border: "#A7F3D0",
      color: "#166534",
      icon: <CheckCircle size={14} />,
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

function getTabLabel(tab: ReviewTab) {
  if (tab === "approved") return "Aprobados";
  if (tab === "rejected") return "Rechazados";
  return "Pendientes";
}

function getTodayDateOnlyKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function ReportedPaymentsPage() {
  const { user } = useCurrentUser();

  const [payments, setPayments] = useState<ReportedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [openingProofId, setOpeningProofId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ReviewTab>("pending_review");

  const [rejectingPayment, setRejectingPayment] = useState<ReportedPayment | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [savingRejection, setSavingRejection] = useState(false);

  const isCompanyAdmin = user?.role === "admin" && !Boolean(user?.is_superadmin);

  async function loadPayments() {
    setLoading(true);
    setPageError("");

    let query = supabase
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
        proof_file_path,
        proof_file_name,
        review_status,
        rejection_reason,
        reviewed_at,
        tenants:tenant_id (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (isCompanyAdmin && user?.company_id) {
      query = query.eq("company_id", user.company_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error cargando pagos reportados:", error);
      setPageError("No se pudieron cargar los pagos reportados.");
      setPayments([]);
      setLoading(false);
      return;
    }

    const normalized = Array.isArray(data)
      ? data.map((item) => normalizeReportedPayment(item))
      : [];

    setPayments(normalized);
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void loadPayments();
  }, [user?.id, user?.company_id, isCompanyAdmin]);

  const pendingPayments = useMemo(
    () => payments.filter((item) => item.review_status === "pending_review"),
    [payments]
  );

  const approvedPayments = useMemo(
    () => payments.filter((item) => item.review_status === "approved"),
    [payments]
  );

  const rejectedPayments = useMemo(
    () => payments.filter((item) => item.review_status === "rejected"),
    [payments]
  );

  const activePayments = useMemo(() => {
    if (activeTab === "approved") return approvedPayments;
    if (activeTab === "rejected") return rejectedPayments;
    return pendingPayments;
  }, [activeTab, pendingPayments, approvedPayments, rejectedPayments]);

  const pendingTotalAmount = pendingPayments.reduce(
    (sum, item) => sum + Number(item.amount_reported || 0),
    0
  );

  async function openProof(payment: ReportedPayment) {
    const fallbackUrl = payment.proof_file_url;

    if (!payment.proof_file_path && fallbackUrl) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!payment.proof_file_path) {
      setPageError("Este reporte no tiene un archivo de comprobante disponible.");
      return;
    }

    setOpeningProofId(payment.id);
    setPageError("");

    try {
      const { data } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(payment.proof_file_path);

      if (!data?.publicUrl) {
        throw new Error("No pude generar la URL del comprobante.");
      }

      window.open(data.publicUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Error abriendo comprobante:", error);
      setPageError(
        error?.message || "No se pudo abrir el comprobante de este reporte."
      );
    } finally {
      setOpeningProofId(null);
    }
  }

  async function approvePayment(payment: ReportedPayment) {
    if (!payment.collection_record_id) {
      setPageError("Este reporte no tiene collection_record_id relacionado.");
      return;
    }

    setProcessingId(payment.id);
    setPageError("");

    try {
      const { data: record, error: recordError } = await supabase
        .from("collection_records")
        .select(`
          id,
          amount_due,
          amount_collected,
          due_date
        `)
        .eq("id", payment.collection_record_id)
        .single();

      if (recordError) {
        throw recordError;
      }

      const amountDue = Number(record?.amount_due || 0);
      const previousCollected = Number(record?.amount_collected || 0);
      const reportedAmount = Number(payment.amount_reported || 0);

      const newAmountCollected = previousCollected + reportedAmount;
      const remainingBalance = amountDue - newAmountCollected;

      const todayKey = getTodayDateOnlyKey();
      const dueDateKey = normalizeDateOnly(record?.due_date);

      let recalculatedStatus: "pending" | "partial" | "collected" | "overdue" = "pending";

      if (remainingBalance <= 0) {
        recalculatedStatus = "collected";
      } else if (newAmountCollected > 0) {
        recalculatedStatus = "partial";
      } else if (dueDateKey && dueDateKey < todayKey) {
        recalculatedStatus = "overdue";
      } else {
        recalculatedStatus = "pending";
      }

      const { error: updateCollectionError } = await supabase
        .from("collection_records")
        .update({
          amount_collected: newAmountCollected,
          status: recalculatedStatus,
        })
        .eq("id", payment.collection_record_id);

      if (updateCollectionError) {
        throw updateCollectionError;
      }

      const reviewPayload: Record<string, any> = {
        review_status: "approved",
        rejection_reason: null,
        reviewed_at: new Date().toISOString(),
      };

      if (user?.id) {
        reviewPayload.reviewed_by = user.id;
      }

      const { error: updateReportedError } = await supabase
        .from("tenant_reported_payments")
        .update(reviewPayload)
        .eq("id", payment.id);

      if (updateReportedError) {
        throw updateReportedError;
      }

      await loadPayments();
    } catch (error: any) {
      console.error("Error aprobando pago reportado:", error);
      setPageError(error?.message || "No se pudo aprobar el pago reportado.");
    } finally {
      setProcessingId(null);
    }
  }

  function openRejectModal(payment: ReportedPayment) {
    setRejectingPayment(payment);
    setRejectionReason(payment.rejection_reason || "");
    setPageError("");
  }

  async function submitRejection() {
    if (!rejectingPayment) return;

    const trimmedReason = rejectionReason.trim();

    if (!trimmedReason) {
      setPageError("Escribe el motivo del rechazo.");
      return;
    }

    setSavingRejection(true);
    setPageError("");

    try {
      const reviewPayload: Record<string, any> = {
        review_status: "rejected",
        rejection_reason: trimmedReason,
        reviewed_at: new Date().toISOString(),
      };

      if (user?.id) {
        reviewPayload.reviewed_by = user.id;
      }

      const { error } = await supabase
        .from("tenant_reported_payments")
        .update(reviewPayload)
        .eq("id", rejectingPayment.id);

      if (error) {
        throw error;
      }

      await loadPayments();
      setRejectingPayment(null);
      setRejectionReason("");
    } catch (error: any) {
      console.error("Error rechazando pago reportado:", error);
      setPageError(error?.message || "No se pudo rechazar el pago reportado.");
    } finally {
      setSavingRejection(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Pagos reportados"
        subtitle="Revisión administrativa de pagos enviados por inquilinos."
        titleIcon={<Wallet size={20} />}
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Pendientes"
          value={String(pendingPayments.length)}
          helper="En espera de decisión"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF3C7",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Clock3 size={18} color="#92400E" />
            </div>
          }
        />

        <MetricCard
          label="Aprobados"
          value={String(approvedPayments.length)}
          helper="Ya aplicados"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#DCFCE7",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CheckCircle size={18} color="#166534" />
            </div>
          }
        />

        <MetricCard
          label="Rechazados"
          value={String(rejectedPayments.length)}
          helper="Con motivo registrado"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEE2E2",
                display: "grid",
                placeItems: "center",
              }}
            >
              <XCircle size={18} color="#B91C1C" />
            </div>
          }
        />

        <MetricCard
          label="Monto pendiente"
          value={formatCurrency(pendingTotalAmount)}
          helper="Reportado por revisar"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#EEF2FF",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CreditCard size={18} color="#4338CA" />
            </div>
          }
        />
      </AppGrid>

      <div style={{ height: 16 }} />

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
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "#FEE2E2",
                color: "#B91C1C",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Ocurrió un problema
              </div>
              <div style={sectionTextStyle}>{pageError}</div>
            </div>
          </div>
        </AppCard>
      ) : null}

      <AppCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(["pending_review", "approved", "rejected"] as ReviewTab[]).map((tab) => {
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  border: isActive ? "1px solid #C7D2FE" : "1px solid #E5E7EB",
                  background: isActive ? "#EEF2FF" : "#FFFFFF",
                  color: isActive ? "#3730A3" : "#374151",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {getTabLabel(tab)}
              </button>
            );
          })}
        </div>
      </AppCard>

      {loading ? (
        <AppCard>
          <div style={sectionTextStyle}>Cargando pagos reportados...</div>
        </AppCard>
      ) : null}

      {!loading && !activePayments.length ? (
        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "#FEF3C7",
                color: "#92400E",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileWarning size={18} />
            </div>

            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                No hay registros en esta vista
              </div>
              <div style={sectionTextStyle}>
                No existen pagos reportados en la pestaña actual.
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      {!loading && activePayments.length ? (
        <AppGrid minWidth={320}>
          {activePayments.map((payment) => {
            const isProcessing = processingId === payment.id;
            const isOpeningProof = openingProofId === payment.id;
            const tenantLabel =
              payment.tenants?.full_name || payment.tenants?.email || "Inquilino sin nombre";

            const statusVisual = getStatusVisual(payment.review_status);

            return (
              <AppCard key={payment.id}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={strongValueStyle}>{tenantLabel}</div>
                      <div style={sectionTextStyle}>
                        {payment.tenants?.email || "Sin correo disponible"}
                      </div>
                    </div>

                    <span
                      style={{
                        ...badgeStyleBase,
                        background: statusVisual.background,
                        border: `1px solid ${statusVisual.border}`,
                        color: statusVisual.color,
                        gap: 6,
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
                      <div style={sectionTextStyle}>Monto reportado</div>
                      <div style={strongValueStyle}>
                        {formatCurrency(payment.amount_reported)}
                      </div>
                    </div>

                    <div>
                      <div style={sectionTextStyle}>Fecha de pago</div>
                      <div style={strongValueStyle}>{formatDate(payment.payment_date)}</div>
                    </div>
                  </div>

                  {payment.notes ? (
                    <div
                      style={{
                        border: "1px solid #E5E7EB",
                        background: "#F9FAFB",
                        borderRadius: 12,
                        padding: 12,
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
                        Notas del inquilino
                      </div>
                      <div style={sectionTextStyle}>{payment.notes}</div>
                    </div>
                  ) : null}

                  {payment.review_status === "rejected" && payment.rejection_reason ? (
                    <div
                      style={{
                        border: "1px solid #FECACA",
                        background: "#FEF2F2",
                        borderRadius: 12,
                        padding: 12,
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
                      <div style={{ ...sectionTextStyle, color: "#991B1B" }}>
                        {payment.rejection_reason}
                      </div>
                    </div>
                  ) : null}

                  {payment.review_status !== "pending_review" && payment.reviewed_at ? (
                    <div style={{ ...sectionTextStyle, fontWeight: 600 }}>
                      Revisado: {formatDateTime(payment.reviewed_at)}
                    </div>
                  ) : null}

                  {payment.proof_file_path || payment.proof_file_url ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <UiButton
                        variant="secondary"
                        onClick={() => void openProof(payment)}
                        disabled={isOpeningProof}
                      >
                        {isOpeningProof ? "Abriendo..." : "Ver comprobante"}
                      </UiButton>

                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          color: "#6B7280",
                        }}
                      >
                        <Eye size={15} />
                        {payment.proof_file_name || "Archivo adjunto"}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px dashed #D1D5DB",
                        background: "#F9FAFB",
                        borderRadius: 12,
                        padding: 12,
                        color: "#6B7280",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      Este reporte no incluye comprobante.
                    </div>
                  )}

                  {payment.review_status === "pending_review" ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <UiButton
                        onClick={() => openRejectModal(payment)}
                        variant="secondary"
                        disabled={isProcessing}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <XCircle size={16} />
                          {isProcessing ? "Procesando..." : "Rechazar"}
                        </span>
                      </UiButton>

                      <UiButton
                        onClick={() => void approvePayment(payment)}
                        disabled={isProcessing}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <CheckCircle size={16} />
                          {isProcessing ? "Procesando..." : "Aprobar"}
                        </span>
                      </UiButton>
                    </div>
                  ) : null}
                </div>
              </AppCard>
            );
          })}
        </AppGrid>
      ) : null}

      <Modal
        open={Boolean(rejectingPayment)}
        title="Rechazar pago reportado"
        onClose={() => {
          if (!savingRejection) {
            setRejectingPayment(null);
            setRejectionReason("");
          }
        }}
      >
        {rejectingPayment ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "#F9FAFB",
                padding: 12,
              }}
            >
              <div style={{ ...sectionTextStyle, fontWeight: 700, color: "#111827" }}>
                {rejectingPayment.tenants?.full_name ||
                  rejectingPayment.tenants?.email ||
                  "Inquilino"}
              </div>
              <div style={sectionTextStyle}>
                Monto: {formatCurrency(rejectingPayment.amount_reported)}
              </div>
              <div style={sectionTextStyle}>
                Fecha reportada: {formatDate(rejectingPayment.payment_date)}
              </div>
            </div>

            <label style={{ display: "grid", gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Motivo del rechazo
              </span>

              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                placeholder="Escribe el motivo para que quede registrado."
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #D1D5DB",
                  background: "#FFFFFF",
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "#111827",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!savingRejection) {
                    setRejectingPayment(null);
                    setRejectionReason("");
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minWidth: 110,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #D1D5DB",
                  background: "#FFFFFF",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <UiButton onClick={() => void submitRejection()} disabled={savingRejection}>
                {savingRejection ? "Guardando..." : "Confirmar rechazo"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}