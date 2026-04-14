// Código preservado de importación CFDI — pendiente de reimplementar
// Extraído de app/collections/page.tsx durante el rediseño simplificado.
// Contiene: tipos, funciones de matching, handleConfirmImportedInvoice, lógica de modal.

import { supabase } from "@/lib/supabaseClient";
import { type ParsedCfdiData, parseCfdiXml } from "@/lib/cfdiXmlParser";
import { removeInvoiceFile, uploadInvoiceFiles } from "@/lib/invoiceStorage";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type CollectionChargeType =
  | "rent"
  | "maintenance_fee"
  | "electricity"
  | "water"
  | "gas"
  | "amenities"
  | "services"
  | "parking"
  | "penalty"
  | "other";

export type ImportPreviewData = ParsedCfdiData & {
  emitterTaxId?: string | null;
  customerTaxId?: string | null;
  series?: string | null;
  folio?: string | null;
  xmlFileName?: string | null;
};

export type InvoiceImportForm = {
  selectedLeaseId: string;
  selectedChargeCategory: CollectionChargeType;
  title: string;
  dueDate: string;
  notes: string;
};

export type InvoiceImportCandidate = {
  leaseId: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitLabel: string;
  tenantLabel: string;
  responsiblePayerLabel: string;
  billingName: string;
  billingTaxId: string;
  score: number;
  reasons: string[];
};

// ── Utilidades de texto ────────────────────────────────────────────────────────

export function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function scoreExactOrContains(
  candidate: string | null | undefined,
  search: string | null | undefined,
) {
  const normalizedCandidate = normalizeComparableText(candidate);
  const normalizedSearch = normalizeComparableText(search);

  if (!normalizedCandidate || !normalizedSearch) return 0;
  if (normalizedCandidate === normalizedSearch) return 100;
  if (
    normalizedCandidate.includes(normalizedSearch) ||
    normalizedSearch.includes(normalizedCandidate)
  ) {
    return 65;
  }

  const candidateTokens = new Set(normalizedCandidate.split(" ").filter(Boolean));
  const searchTokens = normalizedSearch.split(" ").filter(Boolean);
  const overlap = searchTokens.filter((token) => candidateTokens.has(token)).length;

  if (overlap >= 3) return 45;
  if (overlap >= 2) return 25;
  if (overlap >= 1) return 10;
  return 0;
}

export function inferChargeTypeFromDescription(
  description: string | null | undefined,
): CollectionChargeType {
  const normalized = normalizeComparableText(description);

  if (!normalized) return "other";
  if (
    normalized.includes("renta") ||
    normalized.includes("arrendamiento") ||
    normalized.includes("alquiler")
  )
    return "rent";
  if (normalized.includes("mantenimiento") || normalized.includes("mtto"))
    return "maintenance_fee";
  if (
    normalized.includes("electric") ||
    normalized.includes("electr") ||
    normalized.includes("luz") ||
    normalized.includes("energia")
  )
    return "electricity";
  if (normalized.includes("agua")) return "water";
  if (normalized.includes("gas")) return "gas";
  if (
    normalized.includes("amenidad") ||
    normalized.includes("amenidades") ||
    normalized.includes("amenity") ||
    normalized.includes("gym") ||
    normalized.includes("gimnasio") ||
    normalized.includes("alberca") ||
    normalized.includes("pool") ||
    normalized.includes("club")
  )
    return "amenities";
  if (
    normalized.includes("parking") ||
    normalized.includes("estacionamiento") ||
    normalized.includes("cajon")
  )
    return "parking";
  if (
    normalized.includes("penal") ||
    normalized.includes("recargo") ||
    normalized.includes("mora")
  )
    return "penalty";
  return "other";
}

export function extractCfdiFileIdentifiers(xmlText: string) {
  const readAttr = (tagName: string, attrName: string) => {
    const tagRegex = new RegExp(
      `<[^>]*(?:\\w+:)?${tagName}\\b[^>]*\\b${attrName}="([^"]+)"`,
      "i",
    );
    const match = xmlText.match(tagRegex);

    if (match?.[1]) {
      return String(match[1]).trim();
    }

    const lowercaseAttrRegex = new RegExp(
      `<[^>]*(?:\\w+:)?${tagName}\\b[^>]*\\b${attrName.toLowerCase()}="([^"]+)"`,
      "i",
    );
    const lowercaseMatch = xmlText.match(lowercaseAttrRegex);
    return lowercaseMatch?.[1] ? String(lowercaseMatch[1]).trim() : null;
  };

  return {
    emitterTaxId: readAttr("Emisor", "Rfc"),
    receiverTaxId: readAttr("Receptor", "Rfc"),
    series: readAttr("Comprobante", "Serie"),
    folio: readAttr("Comprobante", "Folio"),
  };
}

export function isLikelyMatchingInvoicePair(
  xmlFile: File,
  pdfFile: File,
  parsed: ImportPreviewData,
) {
  const normalizeFileName = (value: string) =>
    normalizeComparableText(value).replace(/\s+/g, "");
  const pdfName = normalizeFileName(pdfFile.name);
  const xmlName = normalizeFileName(xmlFile.name);
  const parsedAny = parsed as Record<string, unknown>;

  const uuid = normalizeComparableText(parsed.uuid || "").replace(/\s+/g, "");
  const series = normalizeComparableText(String(parsed.series || "")).replace(/\s+/g, "");
  const folio = normalizeComparableText(String(parsed.folio || "")).replace(/\s+/g, "");
  const seriesFolio = normalizeComparableText(
    `${parsed.series || ""}${parsed.folio || ""}`,
  ).replace(/\s+/g, "");
  const receiverTaxId = normalizeComparableText(parsed.customerTaxId || "").replace(
    /\s+/g,
    "",
  );
  const emitterTaxId = normalizeComparableText(
    String(
      parsedAny.emitterTaxId ||
        parsedAny.issuerTaxId ||
        parsedAny.supplierTaxId ||
        parsedAny.companyTaxId ||
        "",
    ),
  ).replace(/\s+/g, "");

  const matchesByUuid = Boolean(uuid && pdfName.includes(uuid));

  const matchesByBusinessData = Boolean(
    emitterTaxId &&
      receiverTaxId &&
      pdfName.includes(emitterTaxId) &&
      pdfName.includes(receiverTaxId) &&
      ((seriesFolio && pdfName.includes(seriesFolio)) ||
        (folio && pdfName.includes(folio)) ||
        (series && folio && pdfName.includes(`${series}${folio}`))),
  );

  if (matchesByUuid || matchesByBusinessData) return true;

  const xmlStem = xmlName.replace(/xml$/g, "");
  const pdfStem = pdfName.replace(/pdf$/g, "");
  if (xmlStem && pdfStem && (xmlStem.includes(pdfStem) || pdfStem.includes(xmlStem)))
    return true;

  return false;
}

export function buildImportedChargeTitle(
  parsed: ParsedCfdiData | null,
  category: CollectionChargeType,
) {
  const fromXml = String(parsed?.description || "").trim();
  if (fromXml) return fromXml;
  if (category === "rent") return "Renta importada desde XML";
  if (category === "maintenance_fee") return "Mantenimiento importado desde XML";
  if (category === "electricity") return "Electricidad importada desde XML";
  if (category === "water") return "Agua importada desde XML";
  if (category === "gas") return "Gas importado desde XML";
  if (category === "amenities") return "Amenidades importadas desde XML";
  if (category === "services") return "Servicios importados desde XML";
  if (category === "parking") return "Estacionamiento importado desde XML";
  if (category === "penalty") return "Penalización importada desde XML";
  return "Cobro importado desde XML";
}

export function createDefaultImportForm(): InvoiceImportForm {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    selectedLeaseId: "",
    selectedChargeCategory: "rent",
    title: "",
    dueDate: `${year}-${month}-${day}`,
    notes: "",
  };
}

// ── handleConfirmImportedInvoice ───────────────────────────────────────────────
// Lógica completa de importación de factura CFDI.
// Requiere: user, companyId, importPreview, importXmlFile, importPdfFile,
// importForm, leases, units, collectionSchedules, collectionRecords,
// collectionInvoices, selectedImportCandidate, importStatusMessage.
//
// Pasos:
//  1. Validar archivos y coincidencia XML↔PDF
//  2. Resolver lease → unit → building
//  3. Verificar UUID duplicado
//  4. Buscar o crear collection_schedule
//  5. Buscar o crear collection_record para el periodo
//  6. Upload PDF + XML a Storage
//  7. INSERT collection_invoice
//  8. UPDATE invoice_pending_uploads si aplica
//  9. Rollback parcial si falla (soft delete de schedule/record creados)
//
// Reimplementar en el modal de importar factura cuando se reactive esta funcionalidad.
// Ver la implementación original completa en el historial de git.
export async function confirmImportedInvoice(params: {
  companyId: string;
  userId: string;
  importPreview: ImportPreviewData;
  importXmlFile: File;
  importPdfFile: File;
  importForm: InvoiceImportForm;
  leases: Array<{ id: string; unit_id: string | null }>;
  units: Array<{ id: string; building_id: string }>;
  collectionSchedules: Array<{
    id: string;
    lease_id: string | null;
    unit_id: string;
    building_id: string;
    charge_type: string;
    active: boolean;
  }>;
  collectionRecords: Array<{
    id: string;
    collection_schedule_id: string;
    period_year: number;
    period_month: number;
    unit_id: string;
    lease_id: string | null;
  }>;
  collectionInvoices: Array<{ invoice_uuid: string | null }>;
  selectedCandidateScore?: number;
  selectedCandidateReasons?: string[];
  importStatusMessage?: string;
}): Promise<{ success: boolean; recordId?: string; message: string }> {
  const {
    companyId,
    userId,
    importPreview,
    importXmlFile,
    importPdfFile,
    importForm,
    leases,
    units,
    collectionSchedules,
    collectionRecords,
    collectionInvoices,
    selectedCandidateScore,
    selectedCandidateReasons,
    importStatusMessage,
  } = params;

  if (!isLikelyMatchingInvoicePair(importXmlFile, importPdfFile, importPreview)) {
    return {
      success: false,
      message:
        "El XML y el PDF no parecen corresponder a la misma factura. Deben coincidir por UUID o por RFC emisor + RFC receptor + folio/serie-folio.",
    };
  }

  const lease = leases.find((item) => item.id === importForm.selectedLeaseId);
  if (!lease?.unit_id) {
    return { success: false, message: "No pude ubicar el contrato seleccionado." };
  }

  const unit = units.find((item) => item.id === lease.unit_id);
  if (!unit) {
    return { success: false, message: "No pude ubicar la unidad del contrato seleccionado." };
  }

  const duplicateInvoice = collectionInvoices.find(
    (invoice) => invoice.invoice_uuid && invoice.invoice_uuid === importPreview.uuid,
  );
  if (duplicateInvoice) {
    return {
      success: false,
      message:
        "Ese UUID ya existe en Cobranza. Ya puedes consultarlo desde el botón Ver facturas.",
    };
  }

  const chargeCategory =
    importForm.selectedChargeCategory ||
    inferChargeTypeFromDescription(importPreview.description);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const dueDateObject = new Date(`${dueDate}T00:00:00`);
  const amountDue = Number(importPreview.total || importPreview.subtotal || 0);

  if (!Number.isFinite(amountDue) || amountDue <= 0) {
    return { success: false, message: "No pude detectar un total válido en el XML." };
  }

  let createdScheduleId: string | null = null;
  let createdRecordId: string | null = null;

  try {
    let schedule =
      collectionSchedules.find(
        (item) =>
          item.lease_id === lease.id &&
          item.unit_id === unit.id &&
          item.building_id === unit.building_id &&
          item.charge_type === chargeCategory &&
          item.active,
      ) || null;

    if (!schedule) {
      const { data: createdSchedule, error: scheduleError } = await supabase
        .from("collection_schedules")
        .insert({
          company_id: companyId,
          building_id: unit.building_id,
          unit_id: unit.id,
          lease_id: lease.id,
          charge_type: chargeCategory,
          title:
            importForm.title.trim() ||
            buildImportedChargeTitle(importPreview, chargeCategory),
          responsibility_type: "tenant",
          amount_expected: amountDue,
          due_day: 31,
          active: [
            "rent",
            "maintenance_fee",
            "electricity",
            "water",
            "gas",
            "amenities",
            "parking",
          ].includes(chargeCategory),
          notes:
            importForm.notes.trim() ||
            "Configuración creada automáticamente desde importación de factura.",
        })
        .select(
          "id, building_id, unit_id, lease_id, charge_type, title, responsibility_type, amount_expected, due_day, active, notes",
        )
        .single();

      if (scheduleError || !createdSchedule) {
        throw new Error(
          scheduleError?.message || "No pude crear la configuración base del cobro importado.",
        );
      }

      schedule = createdSchedule as typeof schedule;
      createdScheduleId = schedule!.id;
    }

    let record =
      collectionRecords.find(
        (item) =>
          item.collection_schedule_id === schedule!.id &&
          item.period_year === dueDateObject.getFullYear() &&
          item.period_month === dueDateObject.getMonth() + 1,
      ) || null;

    if (!record) {
      const { data: createdRecord, error: recordError } = await supabase
        .from("collection_records")
        .insert({
          collection_schedule_id: schedule!.id,
          company_id: companyId,
          building_id: unit.building_id,
          unit_id: unit.id,
          lease_id: lease.id,
          period_year: dueDateObject.getFullYear(),
          period_month: dueDateObject.getMonth() + 1,
          due_date: dueDate,
          amount_due: amountDue,
          amount_collected: 0,
          status: dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "pending",
          collected_at: null,
          payment_method: null,
          notes:
            importForm.notes.trim() ||
            importPreview.description ||
            "Cobro generado automáticamente desde factura importada.",
        })
        .select("id")
        .single();

      if (recordError || !createdRecord) {
        throw new Error(
          recordError?.message ||
            "No pude crear el registro de cobranza desde la factura importada.",
        );
      }

      record = createdRecord as typeof record;
      createdRecordId = record!.id;
    }

    const uploadedFiles = await uploadInvoiceFiles({
      companyId,
      buildingId: unit.building_id,
      leaseId: lease.id,
      invoiceUuid: importPreview.uuid,
      pdfFile: importPdfFile,
      xmlFile: importXmlFile,
    });

    if (!uploadedFiles.pdfPath || !uploadedFiles.xmlPath) {
      throw new Error("No pude guardar correctamente los archivos de la factura importada.");
    }

    const { error: invoiceError } = await supabase.from("collection_invoices").insert({
      company_id: companyId,
      building_id: unit.building_id,
      unit_id: unit.id,
      lease_id: lease.id,
      collection_record_id: record!.id,
      invoice_uuid: importPreview.uuid || null,
      invoice_series: importPreview.series || null,
      invoice_folio: importPreview.folio || null,
      customer_name: importPreview.customerName || null,
      customer_tax_id: importPreview.customerTaxId || null,
      description: importPreview.description || importForm.title.trim() || null,
      invoice_type: importPreview.invoiceType || "income",
      charge_category: chargeCategory,
      issued_at: importPreview.issuedAt || dueDate,
      period_year: dueDateObject.getFullYear(),
      period_month: dueDateObject.getMonth() + 1,
      subtotal: importPreview.subtotal ? Number(importPreview.subtotal) : null,
      tax: importPreview.tax ? Number(importPreview.tax) : null,
      total: importPreview.total ? Number(importPreview.total) : amountDue,
      pdf_path: uploadedFiles.pdfPath,
      xml_path: uploadedFiles.xmlPath,
      original_pdf_filename: uploadedFiles.originalPdfFilename,
      original_xml_filename: uploadedFiles.originalXmlFilename,
      match_confidence: selectedCandidateScore || 0,
      match_notes:
        selectedCandidateReasons?.join(" | ") || importStatusMessage || null,
      created_by: userId,
    });

    if (invoiceError) {
      throw new Error(invoiceError.message || "No pude crear la factura importada.");
    }

    return {
      success: true,
      recordId: record!.id,
      message:
        "Factura importada correctamente. El cobro ya quedó clasificado y visible en Cobranza.",
    };
  } catch (error) {
    if (createdRecordId) {
      try {
        await supabase
          .from("collection_records")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", createdRecordId);
      } catch (_) {
        /* silent */
      }
    }

    if (createdScheduleId) {
      try {
        await supabase
          .from("collection_schedules")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", createdScheduleId);
      } catch (_) {
        /* silent */
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No pude completar la importación de la factura.",
    };
  }
}

// ── handleImportXmlSelected (lógica de parseo XML) ────────────────────────────
// Recibe el File del XML, lo parsea con parseCfdiXml, extrae identificadores
// adicionales y devuelve un ImportPreviewData listo para mostrar.
export async function parseImportXmlFile(file: File): Promise<ImportPreviewData> {
  const xmlText = await file.text();
  const parsed = parseCfdiXml(xmlText);
  const extractedIdentifiers = extractCfdiFileIdentifiers(xmlText);
  const parsedAny = parsed as Record<string, unknown>;

  return {
    ...parsed,
    emitterTaxId:
      extractedIdentifiers.emitterTaxId || (parsedAny.emitterTaxId as string) || null,
    customerTaxId:
      (parsedAny.customerTaxId as string) || extractedIdentifiers.receiverTaxId || null,
    series:
      (parsedAny.series as string) || extractedIdentifiers.series || null,
    folio:
      (parsedAny.folio as string) || extractedIdentifiers.folio || null,
    xmlFileName: file.name,
  };
}

// ── Nota sobre el modal JSX ────────────────────────────────────────────────────
// El modal de importación de factura fue eliminado de collections/page.tsx.
// Para reimplementarlo, usar los pasos:
// 1. Campos: <input type="file" accept=".xml" /> para XML
//            <input type="file" accept=".pdf" /> para PDF
// 2. Al seleccionar XML: llamar parseImportXmlFile(file) → setImportPreview
// 3. Usar importCandidates (computado desde leases × importPreview) para sugerir contrato
// 4. Botón "Confirmar importación": llamar confirmImportedInvoice(params)
// 5. El scoring se calcula comparando billing_tax_id/RFC del lease contra customerTaxId del XML
// Ver implementación completa en el historial de git (commit antes del rediseño de cobranza).
