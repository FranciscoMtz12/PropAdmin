"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Eye, FileCode2, FileText, Pencil, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { createInvoiceSignedUrl, removeInvoiceFile } from "@/lib/invoiceStorage";
import { InvoiceListRow, normalizeInvoiceRow } from "@/lib/normalizeInvoice";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";
import UiButton from "@/components/UiButton";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { showToast } = useAppToast();

  const invoiceId = String(params?.invoiceId || "");

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceListRow | null>(null);
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [xmlSignedUrl, setXmlSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId || userLoading || !user) return;

    let ignore = false;

    async function loadInvoice() {
      setLoading(true);

      let query = supabase
        .from("collection_invoices")
        .select(
          `
            id,
            company_id,
            building_id,
            unit_id,
            lease_id,
            collection_record_id,
            invoice_series,
            invoice_folio,
            invoice_uuid,
            invoice_type,
            issued_at,
            period_year,
            period_month,
            subtotal,
            tax,
            total,
            customer_name,
            customer_tax_id,
            description,
            charge_category,
            pdf_path,
            xml_path,
            original_pdf_filename,
            original_xml_filename,
            match_confidence,
            match_notes,
            created_at,
            buildings(name),
            units(unit_number, display_code, buildings(name)),
            leases(tenants(full_name)),
            collection_records(
              amount_due,
              due_date,
              status,
              units(unit_number, display_code, buildings(name)),
              buildings(name),
              leases(tenants(full_name))
            )
          `
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (!user.is_superadmin) {
        query = query.eq("company_id", user.company_id);
      }

      const { data, error } = await query;

      if (ignore) return;

      if (error || !data) {
        console.error(error);
        showToast({ type: "error", message: "No encontré la factura solicitada." });
        setInvoice(null);
        setLoading(false);
        return;
      }

      const normalized = normalizeInvoiceRow(data);
      setInvoice(normalized);

      try {
        const [pdfUrl, xmlUrl] = await Promise.all([
          createInvoiceSignedUrl(normalized.pdfPath),
          createInvoiceSignedUrl(normalized.xmlPath),
        ]);

        if (!ignore) {
          setPdfSignedUrl(pdfUrl);
          setXmlSignedUrl(xmlUrl);
        }
      } catch (signedUrlError) {
        console.error(signedUrlError);
        showToast({
          type: "warning",
          message: "La factura cargó, pero no pude generar alguno de los accesos temporales a archivos.",
        });
      }

      setLoading(false);
    }

    loadInvoice();

    return () => {
      ignore = true;
    };
  }, [invoiceId, userLoading, user, showToast]);

  async function handleDelete() {
    if (!invoice) return;

    setDeleting(true);

    try {
      if (invoice.pdfPath) await removeInvoiceFile(invoice.pdfPath);
      if (invoice.xmlPath) await removeInvoiceFile(invoice.xmlPath);

      const { error } = await supabase.from("collection_invoices").delete().eq("id", invoice.id);

      if (error) {
        throw new Error(error.message || "No pude eliminar la factura.");
      }

      showToast({ type: "success", message: "La factura se eliminó correctamente." });
      router.push("/collections/invoices");
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Ocurrió un error al eliminar la factura.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={
          loading
            ? "Detalle de factura"
            : invoice
              ? `Factura ${invoice.invoiceSeries !== "—" ? `${invoice.invoiceSeries}-` : ""}${invoice.invoiceFolio}`
              : "Factura no encontrada"
        }
        subtitle="Revisa la metadata fiscal, el cobro ligado y los accesos temporales a PDF y XML desde un solo lugar."
        titleIcon={<FileText size={22} />}
        actions={
          <>
            <UiButton onClick={() => router.push("/collections/invoices")}>Volver</UiButton>
            {invoice ? (
              <UiButton onClick={() => router.push(`/collections/invoices/${invoice.id}/edit`)} icon={<Pencil size={16} />}>
                Editar
              </UiButton>
            ) : null}
            {invoice ? (
              <UiButton onClick={() => setDeleteOpen(true)} icon={<Trash2 size={16} />}>
                Eliminar
              </UiButton>
            ) : null}
          </>
        }
      />

      {loading ? (
        <SectionCard title="Cargando" subtitle="Estoy recuperando la información de la factura seleccionada.">
          <div style={{ color: "#667085" }}>Un momento...</div>
        </SectionCard>
      ) : !invoice ? (
        <SectionCard title="Factura no disponible" subtitle="No se encontró la factura o no tienes permiso para verla.">
          <UiButton onClick={() => router.push("/collections/invoices")}>Regresar al listado</UiButton>
        </SectionCard>
      ) : (
        <AppGrid minWidth={320}>
          <SectionCard title="Resumen fiscal" subtitle="Datos principales que guardamos para la factura administrativa.">
            <InfoGrid>
              <InfoItem label="Serie" value={invoice.invoiceSeries} />
              <InfoItem label="Folio" value={invoice.invoiceFolio} />
              <InfoItem label="UUID" value={invoice.invoiceUuid} />
              <InfoItem label="Tipo" value={invoice.invoiceTypeLabel} />
              <InfoItem label="Fecha de emisión" value={invoice.issuedAtLabel} />
              <InfoItem label="Periodo" value={invoice.periodLabel} />
              <InfoItem label="Cliente" value={invoice.customerName} />
              <InfoItem label="RFC" value={invoice.customerTaxId} />
              <InfoItem label="Categoría" value={invoice.chargeCategoryLabel} />
            </InfoGrid>

            <AppCard style={{ background: "#F8FAFC", marginTop: 18 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Subtotal" value={invoice.subtotalLabel} />
                <InfoRow label="IVA" value={invoice.taxLabel} />
                <InfoRow label="Total" value={invoice.totalLabel} />
              </div>
            </AppCard>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                Descripción
              </div>
              <div style={{ color: "#475467", lineHeight: 1.7 }}>{invoice.description}</div>
            </div>
          </SectionCard>

          <SectionCard title="Cobranza ligada" subtitle="Esta factura sí queda conectada a un cobro real para mantener trazabilidad del flujo.">
            <InfoGrid>
              <InfoItem label="Edificio" value={invoice.buildingName} />
              <InfoItem label="Unidad" value={invoice.unitLabel} />
              <InfoItem label="Inquilino" value={invoice.tenantName} />
              <InfoItem label="Estado del cobro" value={invoice.collectionStatusLabel} />
              <InfoItem label="Monto del cobro" value={invoice.collectionAmountDueLabel} />
              <InfoItem label="Vencimiento" value={invoice.collectionDueDateLabel} />
            </InfoGrid>

            <div style={{ marginTop: 18 }}>
              <UiButton onClick={() => router.push("/collections")} icon={<Eye size={16} />}>
                Ir a cobranza
              </UiButton>
            </div>
          </SectionCard>

          <SectionCard title="Archivos" subtitle="El bucket sugerido es privado, por eso aquí usamos URLs firmadas temporales para abrir o descargar.">
            <AppGrid minWidth={240}>
              <AppCard style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={18} />
                  <div style={{ fontWeight: 700, color: "#111827" }}>{invoice.originalPdfFilename}</div>
                </div>

                {pdfSignedUrl ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <UiButton href={pdfSignedUrl} icon={<Eye size={15} />}>
                      Abrir PDF
                    </UiButton>
                    <UiButton href={pdfSignedUrl} icon={<Download size={15} />}>
                      Descargar PDF
                    </UiButton>
                  </div>
                ) : (
                  <div style={{ color: "#667085", fontSize: 14 }}>No hay PDF disponible.</div>
                )}
              </AppCard>

              <AppCard style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileCode2 size={18} />
                  <div style={{ fontWeight: 700, color: "#111827" }}>{invoice.originalXmlFilename}</div>
                </div>

                {xmlSignedUrl ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <UiButton href={xmlSignedUrl} icon={<Eye size={15} />}>
                      Abrir XML
                    </UiButton>
                    <UiButton href={xmlSignedUrl} icon={<Download size={15} />}>
                      Descargar XML
                    </UiButton>
                  </div>
                ) : (
                  <div style={{ color: "#667085", fontSize: 14 }}>No hay XML disponible.</div>
                )}
              </AppCard>
            </AppGrid>
          </SectionCard>
        </AppGrid>
      )}

      <DeleteConfirmModal
        open={deleteOpen}
        title="Eliminar factura"
        description={
          invoice
            ? `Vas a eliminar la factura ${invoice.invoiceSeries !== "—" ? `${invoice.invoiceSeries}-` : ""}${invoice.invoiceFolio}. También eliminaré sus archivos PDF y XML del bucket.`
            : ""
        }
        confirmText={deleting ? "Eliminando..." : "Sí, eliminar"}
        onConfirm={handleDelete}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
      />
    </PageContainer>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <AppCard style={{ background: "#FCFCFD" }}>
      <div style={{ fontSize: 13, color: "#667085", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, color: "#111827", fontWeight: 700, lineHeight: 1.5 }}>
        {value || "—"}
      </div>
    </AppCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <span style={{ color: "#667085", fontSize: 14 }}>{label}</span>
      <span style={{ color: "#111827", fontSize: 14, fontWeight: 700 }}>{value || "—"}</span>
    </div>
  );
}