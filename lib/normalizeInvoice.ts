export type InvoiceStoredType = {
  id: string;
  company_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  collection_record_id: string | null;
  invoice_series: string | null;
  invoice_folio: string | null;
  invoice_uuid: string | null;
  invoice_type: string | null;
  issued_at: string | null;
  period_year: number | null;
  period_month: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  description: string | null;
  charge_category: string | null;
  pdf_path: string | null;
  xml_path: string | null;
  original_pdf_filename: string | null;
  original_xml_filename: string | null;
  match_confidence: number | null;
  match_notes: string | null;
  replaced_at: string | null;
  replaced_by_invoice_id: string | null;
  created_by: string | null;
  created_at: string | null;
};

export type CollectionRecordOption = {
  id: string;
  companyId: string | null;
  buildingId: string | null;
  unitId: string | null;
  leaseId: string | null;
  buildingName: string;
  unitLabel: string;
  tenantName: string;
  dueDate: string | null;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  status: string;
  statusLabel: string;
  periodYear: number | null;
  periodMonth: number | null;
  periodLabel: string;
  title: string;
  customerName: string;
  customerTaxId: string;
};

export type InvoiceListRow = {
  id: string;
  companyId: string | null;
  buildingId: string | null;
  unitId: string | null;
  leaseId: string | null;
  collectionRecordId: string | null;
  invoiceSeries: string;
  invoiceFolio: string;
  invoiceUuid: string;
  invoiceType: string;
  invoiceTypeLabel: string;
  issuedAt: string | null;
  issuedAtLabel: string;
  periodYear: number | null;
  periodMonth: number | null;
  periodLabel: string;
  subtotal: number;
  tax: number;
  total: number;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  customerName: string;
  customerTaxId: string;
  description: string;
  chargeCategory: string;
  chargeCategoryLabel: string;
  pdfPath: string | null;
  xmlPath: string | null;
  originalPdfFilename: string;
  originalXmlFilename: string;
  matchConfidence: number | null;
  matchConfidenceLabel: string;
  matchNotes: string;
  buildingName: string;
  unitLabel: string;
  tenantName: string;
  collectionStatus: string;
  collectionStatusLabel: string;
  collectionAmountDue: number;
  collectionAmountDueLabel: string;
  collectionDueDate: string | null;
  collectionDueDateLabel: string;
  createdAt: string | null;
  createdAtLabel: string;
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

export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDate(dateKey?: string | null) {
  if (!dateKey) return "Sin fecha";

  const safeDate = dateKey.length >= 10 ? dateKey.slice(0, 10) : dateKey;
  const [year, month, day] = safeDate.split("-").map(Number);

  if (!year || !month || !day) return safeDate;

  return `${day} ${MONTH_LABELS_SHORT[month - 1] || "Mes"} ${year}`;
}

export function formatPeriod(periodYear?: number | null, periodMonth?: number | null) {
  if (!periodYear || !periodMonth) return "Sin periodo";
  return `${MONTH_LABELS_SHORT[periodMonth - 1] || "Mes"} ${periodYear}`;
}

export function formatCollectionStatus(status?: string | null) {
  const normalized = String(status || "pending").toLowerCase();

  if (normalized === "collected") return "Cobrado";
  if (normalized === "partial") return "Parcial";
  if (normalized === "overdue") return "Vencido";
  return "Pendiente";
}

export function formatInvoiceType(type?: string | null) {
  const normalized = String(type || "income").toLowerCase();

  if (normalized === "income" || normalized === "ingreso") return "Ingreso";
  if (normalized === "egress" || normalized === "egreso") return "Egreso";
  if (normalized === "payment" || normalized === "pago") return "Pago";
  if (normalized === "credit_note" || normalized === "nota_credito") {
    return "Nota de crédito";
  }

  return type || "Sin tipo";
}

export function formatChargeCategory(category?: string | null) {
  if (!category) return "Sin categoría";

  const normalized = category.toLowerCase();

  if (normalized === "rent") return "Renta";
  if (normalized === "maintenance_fee") return "Mantenimiento";
  if (normalized === "services") return "Servicios";
  if (normalized === "parking") return "Estacionamiento";
  if (normalized === "penalty") return "Penalización";
  if (normalized === "other") return "Otro";

  return category;
}

export function normalizeCollectionRecordOption(raw: any): CollectionRecordOption {
  const unitNumber = raw?.units?.unit_number;
  const unitDisplayCode = raw?.units?.display_code;
  const buildingName = raw?.buildings?.name || raw?.units?.buildings?.name || "Sin edificio";
  const tenantName =
    raw?.leases?.tenants?.full_name ||
    raw?.leases?.billing_name ||
    raw?.billing_name ||
    "Sin inquilino";

  return {
    id: String(raw?.id || ""),
    companyId: raw?.company_id ? String(raw.company_id) : null,
    buildingId: raw?.building_id ? String(raw.building_id) : null,
    unitId: raw?.unit_id ? String(raw.unit_id) : null,
    leaseId: raw?.lease_id ? String(raw.lease_id) : null,
    buildingName,
    unitLabel: unitDisplayCode || unitNumber || "Sin unidad",
    tenantName,
    dueDate: raw?.due_date ? String(raw.due_date) : null,
    dueDateLabel: formatDate(raw?.due_date),
    amountDue: Number(raw?.amount_due || 0),
    amountDueLabel: formatCurrency(raw?.amount_due || 0),
    status: String(raw?.status || "pending"),
    statusLabel: formatCollectionStatus(raw?.status),
    periodYear: raw?.period_year ? Number(raw.period_year) : null,
    periodMonth: raw?.period_month ? Number(raw.period_month) : null,
    periodLabel: formatPeriod(raw?.period_year, raw?.period_month),
    title: raw?.collection_schedules?.title || raw?.title || "Cobro administrativo",
    customerName:
      raw?.leases?.billing_name || raw?.leases?.tenants?.full_name || raw?.customer_name || "",
    customerTaxId: raw?.leases?.tenants?.tax_id || raw?.customer_tax_id || "",
  };
}

export function normalizeInvoiceRow(raw: any): InvoiceListRow {
  const collectionRecord = raw?.collection_records || null;
  const unitNumber =
    raw?.units?.display_code ||
    raw?.units?.unit_number ||
    collectionRecord?.units?.display_code ||
    collectionRecord?.units?.unit_number ||
    "Sin unidad";

  const buildingName =
    raw?.buildings?.name ||
    raw?.units?.buildings?.name ||
    collectionRecord?.buildings?.name ||
    collectionRecord?.units?.buildings?.name ||
    "Sin edificio";

  const tenantName =
    raw?.leases?.tenants?.full_name ||
    collectionRecord?.leases?.tenants?.full_name ||
    raw?.customer_name ||
    "Sin inquilino";

  const collectionStatus = String(collectionRecord?.status || "pending");
  const pdfPath = raw?.pdf_path ? String(raw.pdf_path) : null;
  const xmlPath = raw?.xml_path ? String(raw.xml_path) : null;

  return {
    id: String(raw?.id || ""),
    companyId: raw?.company_id ? String(raw.company_id) : null,
    buildingId: raw?.building_id ? String(raw.building_id) : null,
    unitId: raw?.unit_id ? String(raw.unit_id) : null,
    leaseId: raw?.lease_id ? String(raw.lease_id) : null,
    collectionRecordId: raw?.collection_record_id ? String(raw.collection_record_id) : null,
    invoiceSeries: String(raw?.invoice_series || "—"),
    invoiceFolio: String(raw?.invoice_folio || "—"),
    invoiceUuid: String(raw?.invoice_uuid || "—"),
    invoiceType: String(raw?.invoice_type || "income"),
    invoiceTypeLabel: formatInvoiceType(raw?.invoice_type),
    issuedAt: raw?.issued_at ? String(raw.issued_at) : null,
    issuedAtLabel: formatDate(raw?.issued_at),
    periodYear: raw?.period_year ? Number(raw.period_year) : null,
    periodMonth: raw?.period_month ? Number(raw.period_month) : null,
    periodLabel: formatPeriod(raw?.period_year, raw?.period_month),
    subtotal: Number(raw?.subtotal || 0),
    tax: Number(raw?.tax || 0),
    total: Number(raw?.total || 0),
    subtotalLabel: formatCurrency(raw?.subtotal || 0),
    taxLabel: formatCurrency(raw?.tax || 0),
    totalLabel: formatCurrency(raw?.total || 0),
    customerName: String(raw?.customer_name || "Sin cliente"),
    customerTaxId: String(raw?.customer_tax_id || "Sin RFC"),
    description: String(raw?.description || "Sin descripción"),
    chargeCategory: String(raw?.charge_category || "other"),
    chargeCategoryLabel: formatChargeCategory(raw?.charge_category),
    pdfPath,
    xmlPath,
    originalPdfFilename: String(raw?.original_pdf_filename || "PDF cargado"),
    originalXmlFilename: String(raw?.original_xml_filename || "XML cargado"),
    matchConfidence:
      raw?.match_confidence === null || raw?.match_confidence === undefined
        ? null
        : Number(raw.match_confidence),
    matchConfidenceLabel:
      raw?.match_confidence === null || raw?.match_confidence === undefined
        ? "Sin score"
        : `${Number(raw.match_confidence).toFixed(0)}%`,
    matchNotes: String(raw?.match_notes || ""),
    buildingName,
    unitLabel: unitNumber,
    tenantName,
    collectionStatus,
    collectionStatusLabel: formatCollectionStatus(collectionStatus),
    collectionAmountDue: Number(collectionRecord?.amount_due || 0),
    collectionAmountDueLabel: formatCurrency(collectionRecord?.amount_due || 0),
    collectionDueDate: collectionRecord?.due_date ? String(collectionRecord.due_date) : null,
    collectionDueDateLabel: formatDate(collectionRecord?.due_date),
    createdAt: raw?.created_at ? String(raw.created_at) : null,
    createdAtLabel: formatDate(raw?.created_at),
  };
}