"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";
import InvoiceForm from "@/components/invoices/InvoiceForm";
import PageContainer from "@/components/PageContainer";
import SectionCard from "@/components/SectionCard";

type ExistingInvoiceData = {
  id: string;
  companyId: string;
  buildingId: string | null;
  unitId: string | null;
  leaseId: string | null;
  collectionRecordId: string | null;
  invoiceSeries: string;
  invoiceFolio: string;
  invoiceUuid: string;
  invoiceType: string;
  issuedAt: string;
  periodYear: string;
  periodMonth: string;
  subtotal: string;
  tax: string;
  total: string;
  customerName: string;
  customerTaxId: string;
  description: string;
  chargeCategory: string;
  pdfPath: string | null;
  xmlPath: string | null;
  originalPdfFilename: string;
  originalXmlFilename: string;
};

export default function EditInvoicePage() {
  const params = useParams();
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();

  const invoiceId = String(params?.invoiceId || "");

  const [pageLoading, setPageLoading] = useState(true);
  const [invoice, setInvoice] = useState<ExistingInvoiceData | null>(null);

  useEffect(() => {
    if (!invoiceId || loading || !user || user.role !== "admin") return;

    let ignore = false;

    async function loadInvoice() {
      setPageLoading(true);

      let query = supabase
        .from("collection_invoices")
        .select(`
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
          original_xml_filename
        `)
        .eq("id", invoiceId);

      const isCompanyAdmin = user.role === "admin" && !Boolean(user.is_superadmin);

      if (isCompanyAdmin && user.company_id) {
        query = query.eq("company_id", user.company_id);
      }

      const { data, error } = await query.maybeSingle();

      if (ignore) return;

      if (error || !data) {
        console.error(error);
        showToast({ type: "error", message: "No pude cargar la factura para edición." });
        setInvoice(null);
        setPageLoading(false);
        return;
      }

      setInvoice({
        id: String(data.id),
        companyId: String(data.company_id || user.company_id),
        buildingId: data.building_id ? String(data.building_id) : null,
        unitId: data.unit_id ? String(data.unit_id) : null,
        leaseId: data.lease_id ? String(data.lease_id) : null,
        collectionRecordId: data.collection_record_id ? String(data.collection_record_id) : null,
        invoiceSeries: String(data.invoice_series || ""),
        invoiceFolio: String(data.invoice_folio || ""),
        invoiceUuid: String(data.invoice_uuid || ""),
        invoiceType: String(data.invoice_type || "income"),
        issuedAt: data.issued_at ? String(data.issued_at).slice(0, 10) : "",
        periodYear: data.period_year ? String(data.period_year) : "",
        periodMonth: data.period_month ? String(data.period_month) : "",
        subtotal: data.subtotal !== null && data.subtotal !== undefined ? String(data.subtotal) : "",
        tax: data.tax !== null && data.tax !== undefined ? String(data.tax) : "",
        total: data.total !== null && data.total !== undefined ? String(data.total) : "",
        customerName: String(data.customer_name || ""),
        customerTaxId: String(data.customer_tax_id || ""),
        description: String(data.description || ""),
        chargeCategory: String(data.charge_category || "other"),
        pdfPath: data.pdf_path ? String(data.pdf_path) : null,
        xmlPath: data.xml_path ? String(data.xml_path) : null,
        originalPdfFilename: String(data.original_pdf_filename || ""),
        originalXmlFilename: String(data.original_xml_filename || ""),
      });

      setPageLoading(false);
    }

    loadInvoice();

    return () => {
      ignore = true;
    };
  }, [invoiceId, loading, user, showToast]);

  if (pageLoading) {
    return (
      <PageContainer>
        <SectionCard title="Cargando factura" subtitle="Estoy preparando la información para editarla.">
          <div style={{ color: "#667085" }}>Un momento...</div>
        </SectionCard>
      </PageContainer>
    );
  }

  if (!invoice) {
    return (
      <PageContainer>
        <SectionCard title="Factura no encontrada" subtitle="No pude recuperar la factura para edición.">
          <div style={{ color: "#667085" }}>Revisa el listado y vuelve a intentarlo.</div>
        </SectionCard>
      </PageContainer>
    );
  }

  return <InvoiceForm mode="edit" invoiceId={invoiceId} initialData={invoice} />;
}