// app/collections/reported-payments/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Eye,
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

type ReportedPayment = {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  collection_record_id: string | null;
  amount_reported: number;
  payment_date: string;
  notes: string | null;
  proof_file_url: string | null;
  review_status: string;
  tenants?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const sectionTextStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6B7280",
};

const strongValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const badgeStyleBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
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
    review_status: raw?.review_status ?? "pending_review",
    tenants: raw?.tenants
      ? {
          full_name: raw.tenants?.full_name ?? null,
          email: raw.tenants?.email ?? null,
        }
      : null,
  };
}

export default function ReportedPaymentsPage() {
  const { user } = useCurrentUser();

  const [payments, setPayments] = useState<ReportedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "admin" && Boolean(user?.is_superadmin);
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
        review_status,
        tenants:tenant_id (
          full_name,
          email
        )
      `)
      .eq("review_status", "pending_review")
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
  }, [user?.id, user?.company_id, isCompanyAdmin, isSuperAdmin]);

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
        .select("id, amount_collected")
        .eq("id", payment.collection_record_id)
        .single();

      if (recordError) {
        throw recordError;
      }

      const newAmountCollected =
        Number(record?.amount_collected || 0) + Number(payment.amount_reported || 0);

      const { error: updateCollectionError } = await supabase
        .from("collection_records")
        .update({
          amount_collected: newAmountCollected,
        })
        .eq("id", payment.collection_record_id);

      if (updateCollectionError) {
        throw updateCollectionError;
      }

      const reviewPayload: Record<string, any> = {
        review_status: "approved",
      };

      if (user?.id) {
        reviewPayload.reviewed_by = user.id;
      }

      reviewPayload.reviewed_at = new Date().toISOString();

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

  async function rejectPayment(payment: ReportedPayment) {
    setProcessingId(payment.id);
    setPageError("");

    try {
      const reviewPayload: Record<string, any> = {
        review_status: "rejected",
      };

      if (user?.id) {
        reviewPayload.reviewed_by = user.id;
      }

      reviewPayload.reviewed_at = new Date().toISOString();

      const { error } = await supabase
        .from("tenant_reported_payments")
        .update(reviewPayload)
        .eq("id", payment.id);

      if (error) {
        throw error;
      }

      await loadPayments();
    } catch (error: any) {
      console.error("Error rechazando pago reportado:", error);
      setPageError(error?.message || "No se pudo rechazar el pago reportado.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Pagos reportados"
        subtitle="Revisión administrativa de pagos enviados por inquilinos."
        titleIcon={<Wallet size={20} />}
      />

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

      {loading ? (
        <AppCard>
          <div style={sectionTextStyle}>Cargando pagos reportados...</div>
        </AppCard>
      ) : null}

      {!loading && !payments.length ? (
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
                No hay pagos pendientes
              </div>
              <div style={sectionTextStyle}>
                En este momento no existen pagos reportados pendientes de revisión.
              </div>
            </div>
          </div>
        </AppCard>
      ) : null}

      {!loading && payments.length ? (
        <AppGrid minWidth={320}>
          {payments.map((payment) => {
            const isProcessing = processingId === payment.id;
            const tenantLabel =
              payment.tenants?.full_name || payment.tenants?.email || "Inquilino sin nombre";

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
                        background: "#FEF3C7",
                        color: "#92400E",
                      }}
                    >
                      Pendiente de revisión
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

                  {payment.proof_file_url ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={payment.proof_file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <UiButton variant="secondary">
                          Ver comprobante
                        </UiButton>
                      </a>

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
                        Se abre en una pestaña nueva
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

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <UiButton
                      onClick={() => void rejectPayment(payment)}
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
                </div>
              </AppCard>
            );
          })}
        </AppGrid>
      ) : null}
    </PageContainer>
  );
}