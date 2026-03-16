"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Save, Upload } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { uploadInvoiceFiles, removeInvoiceFile } from "@/lib/invoiceStorage";
import {
  type CollectionRecordOption,
  formatCurrency,
  normalizeCollectionRecordOption,
} from "@/lib/normalizeInvoice";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";

type InvoiceFormMode = "create" | "edit";

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

type InvoiceFormProps = {
  mode: InvoiceFormMode;
  invoiceId?: string;
  initialData?: ExistingInvoiceData | null;
};

type FormState = {
  collectionRecordId: string;
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
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #D0D5DD",
  borderRadius: 10,
  background: "white",
  color: "#111827",
  outline: "none",
};

const TEXTAREA_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  minHeight: 120,
  resize: "vertical",
};

const INVOICE_TYPE_OPTIONS = [
  { value: "income", label: "Ingreso" },
  { value: "payment", label: "Pago" },
  { value: "credit_note", label: "Nota de crédito" },
  { value: "egress", label: "Egreso" },
];

const CHARGE_CATEGORY_OPTIONS = [
  { value: "rent", label: "Renta" },
  { value: "maintenance_fee", label: "Mantenimiento" },
  { value: "services", label: "Servicios" },
  { value: "parking", label: "Estacionamiento" },
  { value: "penalty", label: "Penalización" },
  { value: "other", label: "Otro" },
];

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultFormState(): FormState {
  const today = new Date();

  return {
    collectionRecordId: "",
    invoiceSeries: "",
    invoiceFolio: "",
    invoiceUuid: "",
    invoiceType: "income",
    issuedAt: getTodayDateKey(),
    periodYear: String(today.getFullYear()),
    periodMonth: String(today.getMonth() + 1),
    subtotal: "",
    tax: "",
    total: "",
    customerName: "",
    customerTaxId: "",
    description: "",
    chargeCategory: "other",
  };
}

export default function InvoiceForm({
  mode,
  invoiceId,
  initialData = null,
}: InvoiceFormProps) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<CollectionRecordOption[]>([]);
  const [form, setForm] = useState<FormState>(createDefaultFormState());
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedXmlFile, setSelectedXmlFile] = useState<File | null>(null);
  const [existingPdfPath, setExistingPdfPath] = useState<string | null>(
    initialData?.pdfPath || null
  );
  const [existingXmlPath, setExistingXmlPath] = useState<string | null>(
    initialData?.xmlPath || null
  );
  const [existingPdfFilename, setExistingPdfFilename] = useState<string>(
    initialData?.originalPdfFilename || ""
  );
  const [existingXmlFilename, setExistingXmlFilename] = useState<string>(
    initialData?.originalXmlFilename || ""
  );

  useEffect(() => {
    if (!initialData) return;

    setForm({
      collectionRecordId: initialData.collectionRecordId || "",
      invoiceSeries: initialData.invoiceSeries || "",
      invoiceFolio: initialData.invoiceFolio || "",
      invoiceUuid: initialData.invoiceUuid || "",
      invoiceType: initialData.invoiceType || "income",
      issuedAt: initialData.issuedAt || getTodayDateKey(),
      periodYear: initialData.periodYear || "",
      periodMonth: initialData.periodMonth || "",
      subtotal: initialData.subtotal || "",
      tax: initialData.tax || "",
      total: initialData.total || "",
      customerName: initialData.customerName || "",
      customerTaxId: initialData.customerTaxId || "",
      description: initialData.description || "",
      chargeCategory: initialData.chargeCategory || "other",
    });

    setExistingPdfPath(initialData.pdfPath || null);
    setExistingXmlPath(initialData.xmlPath || null);
    setExistingPdfFilename(initialData.originalPdfFilename || "");
    setExistingXmlFilename(initialData.originalXmlFilename || "");
  }, [initialData]);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;

    const currentUser = user;
    let ignore = false;

    async function loadCollectionRecords() {
      setLoadingRecords(true);

      let query = supabase
        .from("collection_records")
        .select(`
          id,
          company_id,
          building_id,
          unit_id,
          lease_id,
          due_date,
          amount_due,
          status,
          period_year,
          period_month,
          buildings(name),
          units(unit_number, display_code, buildings(name)),
          leases(
            billing_name,
            tenants(full_name, tax_id)
          ),
          collection_schedules(title)
        `)
        .order("due_date", { ascending: false });

      const isCompanyAdmin =
        currentUser.role === "admin" && !Boolean(currentUser.is_superadmin);

      if (isCompanyAdmin && currentUser.company_id) {
        query = query.eq("company_id", currentUser.company_id);
      }

      const { data, error } = await query;

      if (ignore) return;

      if (error) {
        console.error(error);
        showToast({
          type: "error",
          message: "No fue posible cargar los cobros disponibles para ligar la factura.",
        });
        setRecords([]);
        setLoadingRecords(false);
        return;
      }

      const normalized = Array.isArray(data)
        ? data.map((item) => normalizeCollectionRecordOption(item))
        : [];

      setRecords(normalized);
      setLoadingRecords(false);
    }

    loadCollectionRecords();

    return () => {
      ignore = true;
    };
  }, [loading, user, showToast]);

  const selectedRecord = useMemo(() => {
    return records.find((record) => record.id === form.collectionRecordId) || null;
  }, [records, form.collectionRecordId]);

  useEffect(() => {
    if (!selectedRecord) return;

    setForm((prev) => ({
      ...prev,
      periodYear: prev.periodYear || String(selectedRecord.periodYear || ""),
      periodMonth: prev.periodMonth || String(selectedRecord.periodMonth || ""),
      chargeCategory:
        prev.chargeCategory && prev.chargeCategory !== "other"
          ? prev.chargeCategory
          : inferChargeCategoryFromTitle(selectedRecord.title),
      customerName: prev.customerName || selectedRecord.customerName || selectedRecord.tenantName,
      customerTaxId: prev.customerTaxId || selectedRecord.customerTaxId || "",
      description: prev.description || selectedRecord.title,
      total: prev.total || String(selectedRecord.amountDue || ""),
    }));
  }, [selectedRecord]);

  const totalPreview = useMemo(() => {
    const subtotal = Number(form.subtotal || 0);
    const tax = Number(form.tax || 0);
    const total = Number(form.total || 0);

    if (total > 0) return formatCurrency(total);
    if (subtotal > 0 || tax > 0) return formatCurrency(subtotal + tax);
    return formatCurrency(0);
  }, [form.subtotal, form.tax, form.total]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || user.role !== "admin") return;

    const currentUser = user;

    if (!form.collectionRecordId) {
      showToast({ type: "warning", message: "Primero selecciona el cobro relacionado." });
      return;
    }

    if (!selectedRecord) {
      showToast({
        type: "warning",
        message:
          "El cobro seleccionado ya no está disponible. Recarga la página e intenta otra vez.",
      });
      return;
    }

    if (mode === "create" && (!selectedPdfFile || !selectedXmlFile)) {
      showToast({
        type: "warning",
        message: "Para crear la factura necesito que subas tanto el PDF como el XML.",
      });
      return;
    }

    if (!form.invoiceUuid.trim()) {
      showToast({ type: "warning", message: "Ingresa el UUID de la factura." });
      return;
    }

    setSaving(true);

    try {
      const payloadBase = {
        company_id: selectedRecord.companyId || initialData?.companyId || currentUser.company_id,
        building_id: selectedRecord.buildingId || initialData?.buildingId || null,
        unit_id: selectedRecord.unitId || initialData?.unitId || null,
        lease_id: selectedRecord.leaseId || initialData?.leaseId || null,
        collection_record_id: form.collectionRecordId,
        invoice_series: form.invoiceSeries.trim() || null,
        invoice_folio: form.invoiceFolio.trim() || null,
        invoice_uuid: form.invoiceUuid.trim(),
        invoice_type: form.invoiceType,
        issued_at: form.issuedAt || null,
        period_year: form.periodYear ? Number(form.periodYear) : null,
        period_month: form.periodMonth ? Number(form.periodMonth) : null,
        subtotal: form.subtotal ? Number(form.subtotal) : null,
        tax: form.tax ? Number(form.tax) : null,
        total: form.total ? Number(form.total) : null,
        customer_name: form.customerName.trim() || null,
        customer_tax_id: form.customerTaxId.trim() || null,
        description: form.description.trim() || null,
        charge_category: form.chargeCategory || null,
      };

      if (mode === "create") {
        const { data: insertedData, error: insertError } = await supabase
          .from("collection_invoices")
          .insert({
            ...payloadBase,
            created_by: currentUser.id,
          })
          .select("id")
          .single();

        if (insertError || !insertedData?.id) {
          throw new Error(insertError?.message || "No fue posible crear la factura.");
        }

        const uploadedFiles = await uploadInvoiceFiles({
          companyId: payloadBase.company_id || currentUser.company_id,
          buildingId: payloadBase.building_id,
          leaseId: payloadBase.lease_id,
          invoiceUuid: payloadBase.invoice_uuid,
          invoiceId: insertedData.id,
          pdfFile: selectedPdfFile,
          xmlFile: selectedXmlFile,
        });

        const { error: updateFilesError } = await supabase
          .from("collection_invoices")
          .update({
            pdf_path: uploadedFiles.pdfPath,
            xml_path: uploadedFiles.xmlPath,
            original_pdf_filename: uploadedFiles.originalPdfFilename,
            original_xml_filename: uploadedFiles.originalXmlFilename,
          })
          .eq("id", insertedData.id);

        if (updateFilesError) {
          throw new Error(
            updateFilesError.message || "La factura se creó, pero falló el guardado de archivos."
          );
        }

        showToast({
          type: "success",
          message: "La factura se creó correctamente y ya quedó ligada a cobranza.",
        });

        router.push(`/collections/invoices/${insertedData.id}`);
        router.refresh();
        return;
      }

      if (!invoiceId) {
        throw new Error("No encontré el ID de la factura a editar.");
      }

      let nextPdfPath = existingPdfPath;
      let nextXmlPath = existingXmlPath;
      let nextPdfFilename = existingPdfFilename || null;
      let nextXmlFilename = existingXmlFilename || null;

      if (selectedPdfFile) {
        if (existingPdfPath) {
          await removeInvoiceFile(existingPdfPath);
        }

        const uploadedPdf = await uploadInvoiceFiles({
          companyId: payloadBase.company_id || currentUser.company_id,
          buildingId: payloadBase.building_id,
          leaseId: payloadBase.lease_id,
          invoiceUuid: payloadBase.invoice_uuid,
          invoiceId,
          pdfFile: selectedPdfFile,
        });

        nextPdfPath = uploadedPdf.pdfPath;
        nextPdfFilename = uploadedPdf.originalPdfFilename;
      }

      if (selectedXmlFile) {
        if (existingXmlPath) {
          await removeInvoiceFile(existingXmlPath);
        }

        const uploadedXml = await uploadInvoiceFiles({
          companyId: payloadBase.company_id || currentUser.company_id,
          buildingId: payloadBase.building_id,
          leaseId: payloadBase.lease_id,
          invoiceUuid: payloadBase.invoice_uuid,
          invoiceId,
          xmlFile: selectedXmlFile,
        });

        nextXmlPath = uploadedXml.xmlPath;
        nextXmlFilename = uploadedXml.originalXmlFilename;
      }

      const { error: updateError } = await supabase
        .from("collection_invoices")
        .update({
          ...payloadBase,
          pdf_path: nextPdfPath,
          xml_path: nextXmlPath,
          original_pdf_filename: nextPdfFilename,
          original_xml_filename: nextXmlFilename,
        })
        .eq("id", invoiceId);

      if (updateError) {
        throw new Error(updateError.message || "No fue posible guardar los cambios de la factura.");
      }

      showToast({ type: "success", message: "La factura se actualizó correctamente." });
      router.push(`/collections/invoices/${invoiceId}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado al guardar la factura.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "create" ? "Nueva factura" : "Editar factura"}
        subtitle={
          mode === "create"
            ? "Crea una factura administrativa, sube el PDF y XML, y déjala ligada al cobro correcto."
            : "Ajusta la metadata de la factura o reemplaza sus archivos sin salir del flujo administrativo."
        }
        titleIcon={<FileText size={22} />}
        actions={
          <UiButton onClick={() => router.push("/collections/invoices")}>
            Cancelar
          </UiButton>
        }
      />

      <form onSubmit={handleSubmit}>
        <SectionCard
          title="Acciones"
          subtitle="Guarda la factura cuando hayas terminado de revisar la información."
        >
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton onClick={() => router.push("/collections/invoices")}>
              Cancelar
            </UiButton>
            <UiButton type="submit" variant="primary" icon={<Save size={16} />}>
              {saving ? "Guardando..." : mode === "create" ? "Crear factura" : "Guardar cambios"}
            </UiButton>
          </div>
        </SectionCard>

        <div style={{ height: 16 }} />

        <AppGrid minWidth={320}>
          <SectionCard
            title="Datos principales"
            subtitle="La factura siempre debe quedar ligada a un cobro existente para mantener coherencia con cobranza."
            icon={<Link2 size={18} />}
          >
            <AppFormField
              label="Cobro relacionado"
              required
              helperText={
                loadingRecords
                  ? "Cargando cobros disponibles..."
                  : "Selecciona el cobro administrativo al que pertenece esta factura."
              }
            >
              <AppSelect
                value={form.collectionRecordId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, collectionRecordId: event.target.value }))
                }
                disabled={loadingRecords || loading}
              >
                <option value="">Selecciona un cobro</option>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.periodLabel} · {record.buildingName} · {record.unitLabel} ·{" "}
                    {record.amountDueLabel}
                  </option>
                ))}
              </AppSelect>
            </AppFormField>

            {selectedRecord ? (
              <AppCard style={{ background: "#F8FAFC", borderStyle: "dashed" }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <InfoRow label="Cobro" value={selectedRecord.title} />
                  <InfoRow label="Periodo" value={selectedRecord.periodLabel} />
                  <InfoRow
                    label="Edificio / unidad"
                    value={`${selectedRecord.buildingName} · ${selectedRecord.unitLabel}`}
                  />
                  <InfoRow label="Inquilino" value={selectedRecord.tenantName} />
                  <InfoRow label="Vencimiento" value={selectedRecord.dueDateLabel} />
                  <InfoRow label="Monto" value={selectedRecord.amountDueLabel} />
                  <InfoRow label="Estado" value={selectedRecord.statusLabel} />
                </div>
              </AppCard>
            ) : null}

            <AppGrid minWidth={180}>
              <AppFormField label="Serie">
                <input
                  style={INPUT_STYLE}
                  value={form.invoiceSeries}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, invoiceSeries: event.target.value }))
                  }
                  placeholder="Ej. A"
                />
              </AppFormField>

              <AppFormField label="Folio">
                <input
                  style={INPUT_STYLE}
                  value={form.invoiceFolio}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, invoiceFolio: event.target.value }))
                  }
                  placeholder="Ej. 1024"
                />
              </AppFormField>
            </AppGrid>

            <AppFormField label="UUID" required>
              <input
                style={INPUT_STYLE}
                value={form.invoiceUuid}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, invoiceUuid: event.target.value }))
                }
                placeholder="UUID fiscal de la factura"
              />
            </AppFormField>

            <AppGrid minWidth={180}>
              <AppFormField label="Tipo de factura">
                <AppSelect
                  value={form.invoiceType}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, invoiceType: event.target.value }))
                  }
                >
                  {INVOICE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </AppFormField>

              <AppFormField label="Categoría del cobro">
                <AppSelect
                  value={form.chargeCategory}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, chargeCategory: event.target.value }))
                  }
                >
                  {CHARGE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </AppFormField>
            </AppGrid>

            <AppGrid minWidth={180}>
              <AppFormField label="Fecha de emisión">
                <input
                  type="date"
                  style={INPUT_STYLE}
                  value={form.issuedAt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, issuedAt: event.target.value }))
                  }
                />
              </AppFormField>

              <AppFormField label="Año del periodo">
                <input
                  type="number"
                  style={INPUT_STYLE}
                  value={form.periodYear}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, periodYear: event.target.value }))
                  }
                  placeholder="2026"
                />
              </AppFormField>

              <AppFormField label="Mes del periodo">
                <input
                  type="number"
                  min={1}
                  max={12}
                  style={INPUT_STYLE}
                  value={form.periodMonth}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, periodMonth: event.target.value }))
                  }
                  placeholder="3"
                />
              </AppFormField>
            </AppGrid>
          </SectionCard>

          <SectionCard
            title="Datos fiscales y archivos"
            subtitle="Aquí guardamos la metadata principal y los archivos originales que vas a probar desde la interfaz."
            icon={<Upload size={18} />}
          >
            <AppFormField label="Nombre del cliente">
              <input
                style={INPUT_STYLE}
                value={form.customerName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, customerName: event.target.value }))
                }
                placeholder="Razón social o nombre"
              />
            </AppFormField>

            <AppFormField label="RFC del cliente">
              <input
                style={INPUT_STYLE}
                value={form.customerTaxId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, customerTaxId: event.target.value }))
                }
                placeholder="RFC"
              />
            </AppFormField>

            <AppGrid minWidth={180}>
              <AppFormField label="Subtotal">
                <input
                  type="number"
                  step="0.01"
                  style={INPUT_STYLE}
                  value={form.subtotal}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, subtotal: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </AppFormField>

              <AppFormField label="IVA">
                <input
                  type="number"
                  step="0.01"
                  style={INPUT_STYLE}
                  value={form.tax}
                  onChange={(event) => setForm((prev) => ({ ...prev, tax: event.target.value }))}
                  placeholder="0.00"
                />
              </AppFormField>

              <AppFormField label="Total">
                <input
                  type="number"
                  step="0.01"
                  style={INPUT_STYLE}
                  value={form.total}
                  onChange={(event) => setForm((prev) => ({ ...prev, total: event.target.value }))}
                  placeholder="0.00"
                />
              </AppFormField>
            </AppGrid>

            <AppCard style={{ background: "#F8FAFC" }}>
              <div style={{ fontSize: 13, color: "#475467", marginBottom: 6 }}>Total visible</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>{totalPreview}</div>
            </AppCard>

            <AppFormField label="Descripción">
              <textarea
                style={TEXTAREA_STYLE}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Descripción interna o concepto fiscal"
              />
            </AppFormField>

            <AppGrid minWidth={260}>
              <AppFormField
                label="PDF"
                required={mode === "create"}
                helperText={
                  existingPdfFilename
                    ? `Archivo actual: ${existingPdfFilename}`
                    : "Sube el PDF original de la factura."
                }
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setSelectedPdfFile(event.target.files?.[0] || null)}
                  style={INPUT_STYLE}
                />
              </AppFormField>

              <AppFormField
                label="XML"
                required={mode === "create"}
                helperText={
                  existingXmlFilename
                    ? `Archivo actual: ${existingXmlFilename}`
                    : "Sube el XML original de la factura."
                }
              >
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={(event) => setSelectedXmlFile(event.target.files?.[0] || null)}
                  style={INPUT_STYLE}
                />
              </AppFormField>
            </AppGrid>

            {selectedPdfFile || selectedXmlFile ? (
              <AppCard style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedPdfFile ? <InfoRow label="PDF nuevo" value={selectedPdfFile.name} /> : null}
                  {selectedXmlFile ? <InfoRow label="XML nuevo" value={selectedXmlFile.name} /> : null}
                </div>
              </AppCard>
            ) : null}
          </SectionCard>
        </AppGrid>
      </form>
    </PageContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "#667085", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>{value || "—"}</span>
    </div>
  );
}

function inferChargeCategoryFromTitle(title?: string | null) {
  const normalized = String(title || "").toLowerCase();

  if (normalized.includes("renta")) return "rent";
  if (normalized.includes("mantenimiento")) return "maintenance_fee";
  if (normalized.includes("servicio")) return "services";
  if (normalized.includes("parking") || normalized.includes("estacionamiento")) return "parking";
  if (normalized.includes("penal")) return "penalty";

  return "other";
}