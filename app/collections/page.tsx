"use client";

/*
  Módulo de Cobranza.

  Esta versión ya integra:
  - collection_schedules
  - collection_records
  - collection_payments
  - collection_invoices
  - acceso rápido a pagos reportados por tenants

  Objetivo:
  - mostrar cobros administrativos a inquilinos
  - identificar pendientes, parciales, cobrados y vencidos
  - filtrar por edificio y estado
  - abrir detalle por registro
  - registrar abonos parciales
  - visualizar historial de pagos
  - visualizar facturas ligadas al cobro
  - revisar pagos reportados por tenants

  Importante:
  - esta pantalla NO timbra facturas
  - esta pantalla NO es contabilidad
  - esta pantalla sigue siendo control administrativo interno de cobranza
*/

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Droplets,
  Eye,
  FileText,
  FileUp,
  Filter,
  Flame,
  Gem,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Upload,
  Wallet,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { type ParsedCfdiData, parseCfdiXml } from "@/lib/cfdiXmlParser";
import { removeInvoiceFile, uploadInvoiceFiles } from "@/lib/invoiceStorage";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";

type Building = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
};



type ImportPreviewData = ParsedCfdiData & {
  emitterTaxId?: string | null;
  xmlFileName?: string | null;
};

type AppUser = {
  id: string;
  company_id: string;
  full_name: string | null;
  email: string | null;
  is_superadmin: boolean | null;
  created_at: string;
};

type Tenant = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  billing_name: string | null;
  billing_email: string | null;
  tax_id: string | null;
};

type Lease = {
  id: string;
  unit_id: string | null;
  tenant_id: string | null;
  responsible_payer_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_tax_id: string | null;
  due_day: number | null;
  rent_amount: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

type CollectionChargeType =
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

type CollectionSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  charge_type: CollectionChargeType;
  title: string;
  responsibility_type: "tenant" | "owner" | "other";
  amount_expected: number;
  due_day: number;
  active: boolean;
  notes: string | null;
};

type CollectionStoredStatus = "pending" | "partial" | "collected" | "overdue";

type CollectionRecord = {
  id: string;
  collection_schedule_id: string;
  company_id: string;
  building_id: string;
  unit_id: string;
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
};

type CollectionPayment = {
  id: string;
  collection_record_id: string;
  company_id: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type CollectionInvoice = {
  id: string;
  collection_record_id: string | null;
  company_id: string;
  building_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  invoice_uuid: string | null;
  invoice_series: string | null;
  invoice_folio: string | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  description: string | null;
  invoice_type: string | null;
  charge_category: string | null;
  issued_at: string | null;
  period_year: number | null;
  period_month: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  pdf_path: string;
  xml_path: string;
  original_pdf_filename: string | null;
  original_xml_filename: string | null;
  match_confidence: number | null;
  match_notes: string | null;
  replaced_at: string | null;
  replaced_by_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
};

type TenantReportedPayment = {
  id: string;
  company_id: string | null;
  review_status: string | null;
};

type InvoicePendingUploadSummary = {
  id: string;
  company_id: string | null;
  status: string | null;
};

type CollectionStatusFilter =
  | "all"
  | "pending"
  | "partial"
  | "collected"
  | "overdue";

type PaymentMethod =
  | ""
  | "transferencia"
  | "efectivo"
  | "tarjeta"
  | "depósito"
  | "otro";

type PaymentForm = {
  recordId: string;
  amount: string;
  paidAt: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
};

type ChargeMode = "recurring" | "one_time";

type InvoiceImportForm = {
  selectedLeaseId: string;
  selectedChargeCategory: CollectionChargeType;
  title: string;
  dueDate: string;
  notes: string;
};

type InvoiceImportCandidate = {
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

type ChargeForm = {
  chargeMode: ChargeMode;
  buildingId: string;
  unitId: string;
  leaseId: string;
  chargeType: CollectionChargeType;
  title: string;
  responsibilityType: "tenant" | "owner" | "other";
  amountExpected: string;
  dueDay: string;
  initialDueDate: string;
  notes: string;
  createFirstRecordNow: boolean;
};

type EditRecordForm = {
  recordId: string;
  title: string;
  amountDue: string;
  notes: string;
};

type CollectionRow = {
  id: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitLabel: string;
  tenantLabel: string;
  responsiblePayerLabel: string;
  title: string;
  chargeTypeLabel: string;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  amountCollected: number;
  amountCollectedLabel: string;
  balance: number;
  balanceLabel: string;
  status: CollectionStoredStatus;
  statusLabel: string;
  paymentMethodLabel: string;
  notes: string;
  invoicesCount: number;
  paymentsCount: number;
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

const MONTH_LABELS_LONG = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function getTodayDateOnlyKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDate(dateKey: string | null) {
  if (!dateKey) return "Sin fecha";

  const safeDate = dateKey.length >= 10 ? dateKey.slice(0, 10) : dateKey;
  const date = parseDateOnly(safeDate);

  return `${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(dateKey: string | null) {
  if (!dateKey) return "Sin fecha";

  const date = new Date(dateKey);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPeriod(periodYear: number, periodMonth: number) {
  return `${MONTH_LABELS_SHORT[periodMonth - 1] || "Mes"} ${periodYear}`;
}

function formatCurrency(amount: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
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

function getChargeTypeLabel(type: CollectionChargeType) {
  if (type === "rent") return "Renta";
  if (type === "maintenance_fee") return "Mantenimiento";
  if (type === "electricity") return "Electricidad";
  if (type === "water") return "Agua";
  if (type === "gas") return "Gas";
  if (type === "amenities") return "Amenidades";
  if (type === "services") return "Servicios (legado)";
  if (type === "parking") return "Estacionamiento";
  if (type === "penalty") return "Penalización";
  return "Otro";
}

function getStatusLabel(status: CollectionStoredStatus) {
  if (status === "collected") return "Cobrado";
  if (status === "partial") return "Parcial";
  if (status === "pending") return "Pendiente";
  return "Vencido";
}

function getStatusColors(status: CollectionStoredStatus) {
  if (status === "collected") {
    return {
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
    };
  }

  if (status === "partial") {
    return {
      background: "#EFF6FF",
      border: "#BFDBFE",
      text: "#1D4ED8",
    };
  }

  if (status === "pending") {
    return {
      background: "#FEFCE8",
      border: "#FDE68A",
      text: "#A16207",
    };
  }

  return {
    background: "#FEF2F2",
    border: "#FECACA",
    text: "#B91C1C",
  };
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getMonthLastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildDateKey(year: number, month: number, day: number) {
  const safeDay = Math.max(1, Math.min(day, getMonthLastDay(year, month)));
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function deriveStatusFromDueDate(dueDate: string) {
  return dueDate < getTodayDateOnlyKey() ? "overdue" : "pending";
}
function getEndOfMonthDateKey(dateKey: string) {
  const safeKey = dateKey || getTodayDateOnlyKey();
  const date = parseDateOnly(safeKey);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return buildDateKey(year, month, getMonthLastDay(year, month));
}

function getCollectionTypeIcon(chargeType: CollectionChargeType) {
  if (chargeType === "rent") return <Landmark size={18} color="#4F46E5" />;
  if (chargeType === "maintenance_fee") return <Wrench size={18} color="#D97706" />;
  if (chargeType === "electricity") return <Zap size={18} color="#2563EB" />;
  if (chargeType === "water") return <Droplets size={18} color="#0EA5E9" />;
  if (chargeType === "gas") return <Flame size={18} color="#EA580C" />;
  if (chargeType === "amenities") return <Gem size={18} color="#7C3AED" />;
  if (chargeType === "services") return <Zap size={18} color="#2563EB" />;
  if (chargeType === "parking") return <CarFront size={18} color="#0F766E" />;
  if (chargeType === "penalty") return <AlertTriangle size={18} color="#DC2626" />;
  return <Receipt size={18} color="#6D28D9" />;
}


function createDefaultImportForm(): InvoiceImportForm {
  return {
    selectedLeaseId: "",
    selectedChargeCategory: "rent",
    title: "",
    dueDate: getTodayDateOnlyKey(),
    notes: "",
  };
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreExactOrContains(candidate: string | null | undefined, search: string | null | undefined) {
  const normalizedCandidate = normalizeComparableText(candidate);
  const normalizedSearch = normalizeComparableText(search);

  if (!normalizedCandidate || !normalizedSearch) return 0;
  if (normalizedCandidate === normalizedSearch) return 100;
  if (normalizedCandidate.includes(normalizedSearch) || normalizedSearch.includes(normalizedCandidate)) {
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

function inferChargeTypeFromDescription(description: string | null | undefined): CollectionChargeType {
  const normalized = normalizeComparableText(description);

  if (!normalized) return "other";
  if (normalized.includes("renta") || normalized.includes("arrendamiento") || normalized.includes("alquiler")) return "rent";
  if (normalized.includes("mantenimiento") || normalized.includes("mtto")) return "maintenance_fee";
  if (normalized.includes("electric") || normalized.includes("electr") || normalized.includes("luz") || normalized.includes("energia")) return "electricity";
  if (normalized.includes("agua")) return "water";
  if (normalized.includes("gas")) return "gas";
  if (normalized.includes("amenidad") || normalized.includes("amenidades") || normalized.includes("amenity") || normalized.includes("gym") || normalized.includes("gimnasio") || normalized.includes("alberca") || normalized.includes("pool") || normalized.includes("club")) return "amenities";
  if (normalized.includes("parking") || normalized.includes("estacionamiento") || normalized.includes("cajon")) return "parking";
  if (normalized.includes("penal") || normalized.includes("recargo") || normalized.includes("mora")) return "penalty";
  return "other";
}


function extractCfdiFileIdentifiers(xmlText: string) {
  const readAttr = (tagName: string, attrName: string) => {
    const tagRegex = new RegExp(`<[^>]*(?:\w+:)?${tagName}\b[^>]*\b${attrName}="([^"]+)"`, "i");
    const match = xmlText.match(tagRegex);
    return match?.[1] || null;
  };

  return {
    emitterTaxId: readAttr("Emisor", "Rfc"),
    receiverTaxId: readAttr("Receptor", "Rfc"),
    series: readAttr("Comprobante", "Serie"),
    folio: readAttr("Comprobante", "Folio"),
  };
}

function isLikelyMatchingInvoicePair(xmlFile: File, pdfFile: File, parsed: ImportPreviewData) {
  const normalizeFileName = (value: string) => normalizeComparableText(value).replace(/\s+/g, "");
  const pdfName = normalizeFileName(pdfFile.name);
  const xmlName = normalizeFileName(xmlFile.name);
  const parsedAny = parsed as any;

  const uuid = normalizeComparableText(parsed.uuid || "").replace(/\s+/g, "");
  const series = normalizeComparableText(String(parsed.series || "")).replace(/\s+/g, "");
  const folio = normalizeComparableText(String(parsed.folio || "")).replace(/\s+/g, "");
  const seriesFolio = normalizeComparableText(`${parsed.series || ""}${parsed.folio || ""}`).replace(/\s+/g, "");
  const receiverTaxId = normalizeComparableText(parsed.customerTaxId || "").replace(/\s+/g, "");
  const emitterTaxId = normalizeComparableText(
    String(
      parsedAny.emitterTaxId ||
      parsedAny.issuerTaxId ||
      parsedAny.supplierTaxId ||
      parsedAny.companyTaxId ||
      ""
    )
  ).replace(/\s+/g, "");

  const matchesByUuid = Boolean(uuid && pdfName.includes(uuid));

  const matchesByBusinessData = Boolean(
    emitterTaxId &&
      receiverTaxId &&
      pdfName.includes(emitterTaxId) &&
      pdfName.includes(receiverTaxId) &&
      ((seriesFolio && pdfName.includes(seriesFolio)) ||
        (folio && pdfName.includes(folio)) ||
        (series && folio && pdfName.includes(`${series}${folio}`)))
  );

  if (matchesByUuid || matchesByBusinessData) return true;

  const xmlStem = xmlName.replace(/xml$/g, "");
  const pdfStem = pdfName.replace(/pdf$/g, "");
  if (xmlStem && pdfStem && (xmlStem.includes(pdfStem) || pdfStem.includes(xmlStem))) return true;

  return false;
}

function buildImportedChargeTitle(parsed: ParsedCfdiData | null, category: CollectionChargeType) {
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


function formatCollectionTitleForRow({
  chargeType,
  periodMonth,
  fallbackTitle,
}: {
  chargeType: CollectionChargeType;
  periodMonth: number;
  fallbackTitle: string | null | undefined;
}) {
  const monthLabel = MONTH_LABELS_LONG[periodMonth - 1] || "Mes";

  if (chargeType === "rent") return `Renta ${monthLabel}`;
  if (chargeType === "maintenance_fee") return `Mantenimiento ${monthLabel}`;
  if (chargeType === "electricity") return `Electricidad ${monthLabel}`;
  if (chargeType === "water") return `Agua ${monthLabel}`;
  if (chargeType === "gas") return `Gas ${monthLabel}`;
  if (chargeType === "amenities") return `Amenidades ${monthLabel}`;
  if (chargeType === "services") return `Servicios ${monthLabel}`;
  if (chargeType === "parking") return `Estacionamiento ${monthLabel}`;
  if (chargeType === "penalty") return `Penalización ${monthLabel}`;

  const normalizedFallback = String(fallbackTitle || "").trim();
  if (!normalizedFallback) return `Cobro ${monthLabel}`;
  if (normalizedFallback.length <= 42) return normalizedFallback;
  return `${normalizedFallback.slice(0, 39).trim()}...`;
}

function formatUnitLabel(unit: Unit | null | undefined) {
  const unitNumber = String(unit?.unit_number || "").trim();
  const displayCode = String(unit?.display_code || "").trim();
  const rawValue = unitNumber || displayCode;

  if (!rawValue) return "Departamento sin número";

  const normalized = normalizeComparableText(`${displayCode} ${unitNumber}`);
  const usesCommercialLabel = normalized.includes("local") || normalized.includes("comercial");
  const prefix = usesCommercialLabel ? "Unidad" : "Departamento";

  return `${prefix} ${rawValue}`;
}

function createDefaultChargeForm(): ChargeForm {
  const todayKey = getTodayDateOnlyKey();
  const today = parseDateOnly(todayKey);

  return {
    chargeMode: "recurring",
    buildingId: "",
    unitId: "",
    leaseId: "",
    chargeType: "rent",
    title: "",
    responsibilityType: "tenant",
    amountExpected: "",
    dueDay: String(today.getDate()),
    initialDueDate: todayKey,
    notes: "",
    createFirstRecordNow: true,
  };
}

function getUserDisplayLabel(user: AppUser | null | undefined) {
  if (!user) return null;
  return user.full_name || user.email || null;
}

export default function CollectionsPage() {
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();
  const router = useRouter();

  const [loadingPage, setLoadingPage] = useState(true);
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [collectionPayments, setCollectionPayments] = useState<CollectionPayment[]>([]);
  const [collectionInvoices, setCollectionInvoices] = useState<CollectionInvoice[]>([]);
  const [reportedPayments, setReportedPayments] = useState<TenantReportedPayment[]>([]);
  const [invoicePendingUploads, setInvoicePendingUploads] = useState<InvoicePendingUploadSummary[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] =
    useState<CollectionStatusFilter>("all");

  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [paymentRecordId, setPaymentRecordId] = useState<string | null>(null);
  const [createChargeOpen, setCreateChargeOpen] = useState(false);
  const [importInvoiceOpen, setImportInvoiceOpen] = useState(false);
  const [creatingCharge, setCreatingCharge] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [importingInvoice, setImportingInvoice] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState(false);

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    recordId: "",
    amount: "",
    paidAt: getTodayDateOnlyKey(),
    paymentMethod: "",
    reference: "",
    notes: "",
  });
  const [chargeForm, setChargeForm] = useState<ChargeForm>(createDefaultChargeForm());
  const [importForm, setImportForm] = useState<InvoiceImportForm>(createDefaultImportForm());
  const [importXmlFile, setImportXmlFile] = useState<File | null>(null);
  const [importPdfFile, setImportPdfFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [editForm, setEditForm] = useState<EditRecordForm>({
    recordId: "",
    title: "",
    amountDue: "",
    notes: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    void loadCollectionsData();
  }, [loading, user?.company_id]);

  async function loadCollectionsData() {
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMessage("");

    const [
      buildingsRes,
      unitsRes,
      appUsersRes,
      tenantsRes,
      leasesRes,
      schedulesRes,
      recordsRes,
      paymentsRes,
      invoicesRes,
      reportedPaymentsRes,
      pendingUploadsRes,
    ] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .order("name", { ascending: true }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id),

      supabase
        .from("app_users")
        .select("id, company_id, full_name, email, is_superadmin, created_at")
        .eq("company_id", user.company_id),

      supabase
        .from("tenants")
        .select("id, company_id, full_name, email, billing_name, billing_email, tax_id")
        .eq("company_id", user.company_id),

      supabase
        .from("leases")
        .select(
          "id, unit_id, tenant_id, responsible_payer_id, billing_name, billing_email, billing_tax_id, due_day, rent_amount, status, start_date, end_date"
        )
        .eq("company_id", user.company_id),

      supabase
        .from("collection_schedules")
        .select(
          "id, building_id, unit_id, lease_id, charge_type, title, responsibility_type, amount_expected, due_day, active, notes"
        )
        .eq("company_id", user.company_id)
        .eq("active", true),

      supabase
        .from("collection_records")
        .select(
          "id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, payment_method, notes, created_at"
        )
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true }),

      supabase
        .from("collection_payments")
        .select(
          "id, collection_record_id, company_id, amount, paid_at, payment_method, reference, notes, created_by, created_at"
        )
        .eq("company_id", user.company_id)
        .order("paid_at", { ascending: false }),

      supabase
        .from("collection_invoices")
        .select(
          "id, collection_record_id, company_id, building_id, unit_id, lease_id, invoice_uuid, invoice_series, invoice_folio, customer_name, customer_tax_id, description, invoice_type, charge_category, issued_at, period_year, period_month, subtotal, tax, total, pdf_path, xml_path, original_pdf_filename, original_xml_filename, match_confidence, match_notes, replaced_at, replaced_by_invoice_id, created_by, created_at"
        )
        .eq("company_id", user.company_id)
        .is("replaced_at", null)
        .order("issued_at", { ascending: false }),

      supabase
        .from("tenant_reported_payments")
        .select("id, company_id, review_status")
        .eq("company_id", user.company_id)
        .eq("review_status", "pending_review")
        .order("created_at", { ascending: false }),

      supabase
        .from("invoice_pending_uploads")
        .select("id, company_id, status")
        .eq("company_id", user.company_id)
        .eq("status", "pending_upload")
        .order("created_at", { ascending: false }),
    ]);

    if (buildingsRes.error) {
      setMessage("No se pudieron cargar los edificios.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMessage("No se pudieron cargar las unidades.");
      setLoadingPage(false);
      return;
    }

    if (appUsersRes.error) {
      setMessage("No se pudieron cargar los usuarios.");
      setLoadingPage(false);
      return;
    }

    if (tenantsRes.error) {
      setMessage("No se pudieron cargar los inquilinos.");
      setLoadingPage(false);
      return;
    }

    if (leasesRes.error) {
      setMessage("No se pudieron cargar los contratos.");
      setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      setMessage("No se pudieron cargar las configuraciones de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (recordsRes.error) {
      setMessage("No se pudieron cargar los registros de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (paymentsRes.error) {
      setMessage("No se pudieron cargar los abonos de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (invoicesRes.error) {
      setMessage("No se pudieron cargar las facturas ligadas a cobranza.");
      setLoadingPage(false);
      return;
    }

    if (reportedPaymentsRes.error) {
      setMessage("No se pudieron cargar los pagos reportados pendientes.");
      setLoadingPage(false);
      return;
    }

    if (pendingUploadsRes.error) {
      setMessage("No se pudieron cargar los pendientes de factura por cargar.");
      setLoadingPage(false);
      return;
    }

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setAppUsers((appUsersRes.data as AppUser[]) || []);
    setTenants((tenantsRes.data as Tenant[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setCollectionSchedules((schedulesRes.data as CollectionSchedule[]) || []);
    setCollectionRecords((recordsRes.data as CollectionRecord[]) || []);
    setCollectionPayments((paymentsRes.data as CollectionPayment[]) || []);
    setCollectionInvoices((invoicesRes.data as CollectionInvoice[]) || []);
    setReportedPayments((reportedPaymentsRes.data as TenantReportedPayment[]) || []);
    setInvoicePendingUploads((pendingUploadsRes.data as InvoicePendingUploadSummary[]) || []);
    setLoadingPage(false);
  }

  const collectionRows = useMemo<CollectionRow[]>(() => {
    const buildingMap = new Map<string, Building>();
    const unitMap = new Map<string, Unit>();
    const userMap = new Map<string, AppUser>();
    const leaseMap = new Map<string, Lease>();
    const scheduleMap = new Map<string, CollectionSchedule>();
    const paymentsByRecordId = new Map<string, CollectionPayment[]>();
    const invoicesByRecordId = new Map<string, CollectionInvoice[]>();

    buildings.forEach((building) => buildingMap.set(building.id, building));
    units.forEach((unit) => unitMap.set(unit.id, unit));
    appUsers.forEach((appUser) => userMap.set(appUser.id, appUser));
    leases.forEach((lease) => leaseMap.set(lease.id, lease));
    collectionSchedules.forEach((schedule) => scheduleMap.set(schedule.id, schedule));

    collectionPayments.forEach((payment) => {
      const current = paymentsByRecordId.get(payment.collection_record_id) || [];
      current.push(payment);
      paymentsByRecordId.set(payment.collection_record_id, current);
    });

    collectionInvoices.forEach((invoice) => {
      if (!invoice.collection_record_id) return;
      const current = invoicesByRecordId.get(invoice.collection_record_id) || [];
      current.push(invoice);
      invoicesByRecordId.set(invoice.collection_record_id, current);
    });

    return collectionRecords
      .map((record) => {
        const schedule = scheduleMap.get(record.collection_schedule_id);
        if (!schedule) return null;

        const building =
          buildingMap.get(record.building_id) || buildingMap.get(schedule.building_id);
        const unit = unitMap.get(record.unit_id) || unitMap.get(schedule.unit_id);
        const lease =
          (record.lease_id ? leaseMap.get(record.lease_id) : null) ||
          (schedule.lease_id ? leaseMap.get(schedule.lease_id) : null);

        const tenantUser = lease?.tenant_id ? userMap.get(lease.tenant_id) : null;
        const responsiblePayerUser = lease?.responsible_payer_id
          ? userMap.get(lease.responsible_payer_id)
          : null;

        const unitLabel = formatUnitLabel(unit);

        const tenantLabel =
          getUserDisplayLabel(tenantUser) ||
          lease?.billing_name ||
          lease?.billing_email ||
          "Sin inquilino asignado";

        const responsiblePayerLabel =
          getUserDisplayLabel(responsiblePayerUser) ||
          lease?.billing_name ||
          lease?.billing_email ||
          getUserDisplayLabel(tenantUser) ||
          "Sin responsable definido";

        const paidAmount =
          record.amount_collected ??
          (paymentsByRecordId.get(record.id) || []).reduce(
            (sum, payment) => sum + (payment.amount || 0),
            0
          );

        const balance = Math.max((record.amount_due || 0) - paidAmount, 0);

        return {
          id: record.id,
          buildingId: record.building_id,
          buildingName: building?.name || "Edificio",
          unitId: record.unit_id,
          unitLabel,
          tenantLabel,
          responsiblePayerLabel,
          title: formatCollectionTitleForRow({
            chargeType: schedule.charge_type,
            periodMonth: record.period_month,
            fallbackTitle: schedule.title,
          }),
          chargeTypeLabel: getChargeTypeLabel(schedule.charge_type),
          periodLabel: formatPeriod(record.period_year, record.period_month),
          dueDate: record.due_date,
          dueDateLabel: formatDate(record.due_date),
          amountDue: record.amount_due || 0,
          amountDueLabel: formatCurrency(record.amount_due || 0),
          amountCollected: paidAmount,
          amountCollectedLabel: formatCurrency(paidAmount),
          balance,
          balanceLabel: formatCurrency(balance),
          status: record.status,
          statusLabel: getStatusLabel(record.status),
          paymentMethodLabel: record.payment_method || "—",
          notes: record.notes || schedule.notes || "—",
          invoicesCount: (invoicesByRecordId.get(record.id) || []).length,
          paymentsCount: (paymentsByRecordId.get(record.id) || []).length,
        };
      })
      .filter((row): row is CollectionRow => Boolean(row));
  }, [
    buildings,
    units,
    appUsers,
    leases,
    collectionSchedules,
    collectionRecords,
    collectionPayments,
    collectionInvoices,
  ]);

  const collectionRowsById = useMemo(() => {
    return new Map(collectionRows.map((row) => [row.id, row]));
  }, [collectionRows]);

  const unitsForSelectedBuilding = useMemo(() => {
    if (!chargeForm.buildingId) return [];
    return units
      .filter((unit) => unit.building_id === chargeForm.buildingId)
      .sort((a, b) => {
        const aLabel = a.display_code || a.unit_number || "";
        const bLabel = b.display_code || b.unit_number || "";
        return aLabel.localeCompare(bLabel);
      });
  }, [units, chargeForm.buildingId]);

  const leasesForSelectedUnit = useMemo(() => {
    if (!chargeForm.unitId) return [];
    return leases.filter((lease) => lease.unit_id === chargeForm.unitId);
  }, [leases, chargeForm.unitId]);

  const tenantMap = useMemo(() => {
    return new Map(tenants.map((tenant) => [tenant.id, tenant]));
  }, [tenants]);

  const selectedChargeLease = useMemo(() => {
    if (!chargeForm.leaseId) return null;
    return leases.find((lease) => lease.id === chargeForm.leaseId) || null;
  }, [leases, chargeForm.leaseId]);

  const selectedChargeTenant = useMemo(() => {
    if (!selectedChargeLease?.tenant_id) return null;
    return tenantMap.get(selectedChargeLease.tenant_id) || null;
  }, [selectedChargeLease, tenantMap]);

  const leaseLookupOptions = useMemo(() => {
    return leases
      .filter((lease) => Boolean(lease.unit_id))
      .map((lease) => {
        const unit = units.find((item) => item.id === lease.unit_id) || null;
        const building = unit
          ? buildings.find((item) => item.id === unit.building_id) || null
          : null;
        const tenant = lease.tenant_id ? tenantMap.get(lease.tenant_id) || null : null;

        const label = `${lease.billing_name || tenant?.billing_name || tenant?.full_name || "Sin nombre"} · ${building?.name || "Edificio"} · Unidad ${unit?.display_code || unit?.unit_number || "Unidad"}`;

        return {
          id: lease.id,
          label,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [leases, units, buildings, tenantMap]);

  const importCandidates = useMemo<InvoiceImportCandidate[]>(() => {
    if (!importPreview) return [];

    return leases
      .filter((lease) => Boolean(lease.unit_id))
      .map((lease) => {
        const unit = units.find((item) => item.id === lease.unit_id) || null;
        const building = unit ? buildings.find((item) => item.id === unit.building_id) || null : null;
        const tenant = lease.tenant_id ? tenantMap.get(lease.tenant_id) || null : null;
        const payer = lease.responsible_payer_id ? tenantMap.get(lease.responsible_payer_id) || null : null;
        const reasons: string[] = [];
        let score = 0;

        const xmlTaxId = normalizeComparableText(importPreview.customerTaxId);
        const xmlName = normalizeComparableText(importPreview.customerName);
        const xmlDescription = normalizeComparableText(importPreview.description);

        if (xmlTaxId && normalizeComparableText(lease.billing_tax_id) === xmlTaxId) {
          score += 120;
          reasons.push("RFC exacto contra facturación del contrato");
        } else if (xmlTaxId && normalizeComparableText(payer?.tax_id) === xmlTaxId) {
          score += 100;
          reasons.push("RFC exacto contra responsable de pago");
        } else if (xmlTaxId && normalizeComparableText(tenant?.tax_id) === xmlTaxId) {
          score += 80;
          reasons.push("RFC exacto contra inquilino");
        }

        const billingNameScore = scoreExactOrContains(lease.billing_name, xmlName);
        if (billingNameScore > 0) {
          score += billingNameScore;
          reasons.push("Nombre parecido al de facturación del contrato");
        }

        const payerScore = scoreExactOrContains(payer?.billing_name || payer?.full_name, xmlName);
        if (payerScore > 0) {
          score += Math.min(payerScore, 45);
          reasons.push("Nombre parecido al responsable de pago");
        }

        const tenantScore = scoreExactOrContains(tenant?.billing_name || tenant?.full_name, xmlName);
        if (tenantScore > 0) {
          score += Math.min(tenantScore, 35);
          reasons.push("Nombre parecido al inquilino");
        }

        const unitTokens = normalizeComparableText(`${unit?.display_code || ""} ${unit?.unit_number || ""}`)
          .split(" ")
          .filter(Boolean);
        if (xmlDescription && unitTokens.some((token) => token.length >= 2 && xmlDescription.includes(token))) {
          score += 18;
          reasons.push("La descripción menciona la unidad");
        }

        return {
          leaseId: lease.id,
          buildingId: building?.id || unit?.building_id || "",
          buildingName: building?.name || "Edificio",
          unitId: unit?.id || "",
          unitLabel: unit?.display_code || unit?.unit_number || "Unidad",
          tenantLabel: tenant?.full_name || tenant?.billing_name || "Sin inquilino",
          responsiblePayerLabel: payer?.full_name || payer?.billing_name || lease.billing_name || tenant?.full_name || "Sin responsable",
          billingName: lease.billing_name || tenant?.billing_name || tenant?.full_name || "",
          billingTaxId: lease.billing_tax_id || payer?.tax_id || tenant?.tax_id || "",
          score,
          reasons,
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [importPreview, leases, units, buildings, tenantMap]);

  const selectedImportCandidate = useMemo(() => {
    if (!importForm.selectedLeaseId) return null;
    return importCandidates.find((candidate) => candidate.leaseId === importForm.selectedLeaseId) || null;
  }, [importCandidates, importForm.selectedLeaseId]);

  useEffect(() => {
    if (!importPreview) return;

    const inferredCategory = inferChargeTypeFromDescription(importPreview.description);
    const suggestedTitle = buildImportedChargeTitle(importPreview, inferredCategory);

    setImportForm((prev) => ({
      ...prev,
      selectedLeaseId: prev.selectedLeaseId || importCandidates[0]?.leaseId || "",
      selectedChargeCategory: prev.selectedChargeCategory || inferredCategory,
      title: prev.title || suggestedTitle,
      dueDate: getEndOfMonthDateKey(importPreview.issuedAt || prev.dueDate || getTodayDateOnlyKey()),
    }));

    setImportStatusMessage(
      importCandidates[0]
        ? `Clasificación automática propuesta con ${importCandidates[0].score >= 100 ? "alta" : importCandidates[0].score >= 60 ? "media" : "baja"} confianza.`
        : "No encontré una coincidencia automática fuerte. Revisa y selecciona manualmente el contrato correcto."
    );
  }, [importPreview, importCandidates]);

  const filteredRows = useMemo(() => {
    return collectionRows.filter((row) => {
      if (selectedBuildingId !== "all" && row.buildingId !== selectedBuildingId) {
        return false;
      }

      if (selectedStatus !== "all" && row.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [collectionRows, selectedBuildingId, selectedStatus]);

  const selectedBuildingLabel =
    selectedBuildingId === "all"
      ? "Todos los edificios"
      : buildings.find((building) => building.id === selectedBuildingId)?.name ||
        "Edificio";

  const totalRecords = filteredRows.length;
  const collectedCount = filteredRows.filter((row) => row.status === "collected").length;
  const partialCount = filteredRows.filter((row) => row.status === "partial").length;
  const pendingCount = filteredRows.filter((row) => row.status === "pending").length;
  const overdueCount = filteredRows.filter((row) => row.status === "overdue").length;
  const reportedPendingCount = reportedPayments.length;
  const pendingInvoiceUploadCount = invoicePendingUploads.length;

  const totalOutstandingAmount = filteredRows
    .filter((row) => row.status !== "collected")
    .reduce((sum, row) => sum + row.balance, 0);

  const todayKey = getTodayDateOnlyKey();

  const nextPendingLabel = useMemo(() => {
    const nextPending = filteredRows
      .filter(
        (row) =>
          (row.status === "pending" || row.status === "partial") &&
          row.dueDate >= todayKey
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    if (!nextPending) return "Sin próximos cobros";
    return `${nextPending.title} · ${nextPending.dueDateLabel}`;
  }, [filteredRows, todayKey]);

  const detailRow = detailRecordId ? collectionRowsById.get(detailRecordId) || null : null;

  const detailPayments = useMemo(() => {
    if (!detailRecordId) return [];
    return collectionPayments
      .filter((payment) => payment.collection_record_id === detailRecordId)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  }, [collectionPayments, detailRecordId]);

  const detailInvoices = useMemo(() => {
    if (!detailRecordId) return [];
    return collectionInvoices
      .filter((invoice) => invoice.collection_record_id === detailRecordId)
      .sort((a, b) => {
        const aDate = a.issued_at || a.created_at;
        const bDate = b.issued_at || b.created_at;
        return bDate.localeCompare(aDate);
      });
  }, [collectionInvoices, detailRecordId]);

  const deleteRecordRow = deleteRecordId
    ? collectionRowsById.get(deleteRecordId) || null
    : null;
  const editRecordRow = editRecordId
    ? collectionRowsById.get(editRecordId) || null
    : null;

  const paymentsByRecordId = useMemo(() => {
    const map = new Map<string, CollectionPayment[]>();
    collectionPayments.forEach((payment) => {
      const current = map.get(payment.collection_record_id) || [];
      current.push(payment);
      map.set(payment.collection_record_id, current);
    });
    return map;
  }, [collectionPayments]);

  const invoicesByRecordId = useMemo(() => {
    const map = new Map<string, CollectionInvoice[]>();
    collectionInvoices.forEach((invoice) => {
      if (!invoice.collection_record_id) return;
      const current = map.get(invoice.collection_record_id) || [];
      current.push(invoice);
      map.set(invoice.collection_record_id, current);
    });
    return map;
  }, [collectionInvoices]);

  async function handleDeleteCollectionRecord() {
    if (!deleteRecordId || !user?.company_id) return;

    const record = collectionRecords.find((item) => item.id === deleteRecordId);
    if (!record) {
      showToast({ type: "warning", message: "Ese cobro ya no existe o ya fue eliminado." });
      setDeleteRecordId(null);
      return;
    }

    const linkedInvoices = collectionInvoices.filter((invoice) => invoice.collection_record_id === deleteRecordId);
    const linkedPayments = collectionPayments.filter((payment) => payment.collection_record_id === deleteRecordId);
    const otherRecordsForSchedule = collectionRecords.filter((item) => item.collection_schedule_id === record.collection_schedule_id && item.id !== record.id);
    const schedule = collectionSchedules.find((item) => item.id === record.collection_schedule_id) || null;

    setDeletingRecord(true);

    try {
      for (const invoice of linkedInvoices) {
        if (invoice.pdf_path) {
          try {
            await removeInvoiceFile(invoice.pdf_path);
          } catch (storageError) {
            console.warn("No pude borrar el PDF de la factura ligada.", storageError);
          }
        }

        if (invoice.xml_path) {
          try {
            await removeInvoiceFile(invoice.xml_path);
          } catch (storageError) {
            console.warn("No pude borrar el XML de la factura ligada.", storageError);
          }
        }
      }

      if (linkedInvoices.length > 0) {
        const deleteInvoices = await supabase
          .from("collection_invoices")
          .delete()
          .in("id", linkedInvoices.map((invoice) => invoice.id));

        if (deleteInvoices.error) {
          throw new Error(deleteInvoices.error.message || "No pude eliminar las facturas ligadas a este cobro.");
        }
      }

      if (linkedPayments.length > 0) {
        const deletePayments = await supabase
          .from("collection_payments")
          .delete()
          .in("id", linkedPayments.map((payment) => payment.id));

        if (deletePayments.error) {
          throw new Error(deletePayments.error.message || "No pude eliminar los abonos ligados a este cobro.");
        }
      }

      const deleteRecord = await supabase
        .from("collection_records")
        .delete()
        .eq("id", deleteRecordId)
        .eq("company_id", user.company_id);

      if (deleteRecord.error) {
        throw new Error(deleteRecord.error.message || "No pude eliminar el cobro.");
      }

      if (schedule && !schedule.active && otherRecordsForSchedule.length === 0) {
        const deleteSchedule = await supabase
          .from("collection_schedules")
          .delete()
          .eq("id", schedule.id)
          .eq("company_id", user.company_id);

        if (deleteSchedule.error) {
          console.warn("No pude eliminar la configuración huérfana del cobro.", deleteSchedule.error.message);
        }
      }

      await loadCollectionsData();
      setDetailRecordId((current) => (current === deleteRecordId ? null : current));
      setDeleteRecordId(null);
      showToast({ type: "success", message: "Cobro eliminado correctamente." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No pude eliminar el cobro.";
      showToast({ type: "error", message: errorMessage });
    } finally {
      setDeletingRecord(false);
    }
  }

  function openEditRecordModal(row: CollectionRow) {
    setEditRecordId(row.id);
    setEditForm({
      recordId: row.id,
      title: row.title,
      amountDue: String(row.amountDue || ""),
      notes: row.notes === "—" ? "" : row.notes,
    });
  }

  async function handleSaveRecordEdits() {
    if (!user?.company_id || !editRecordId) return;

    const record = collectionRecords.find((item) => item.id === editRecordId);
    if (!record) {
      showToast({ type: "error", message: "No pude encontrar el cobro a editar." });
      return;
    }

    const nextAmount = parsePositiveNumber(editForm.amountDue);
    if (!nextAmount) {
      showToast({ type: "error", message: "Ingresa un monto válido para este cobro." });
      return;
    }

    setEditingRecord(true);

    try {
      const schedule = collectionSchedules.find((item) => item.id === record.collection_schedule_id) || null;

      const updateRecord = await supabase
        .from("collection_records")
        .update({
          amount_due: nextAmount,
          notes: editForm.notes.trim() || null,
        })
        .eq("id", editRecordId)
        .eq("company_id", user.company_id);

      if (updateRecord.error) {
        throw new Error(updateRecord.error.message || "No pude actualizar el cobro.");
      }

      if (schedule) {
        const updateSchedule = await supabase
          .from("collection_schedules")
          .update({
            title: editForm.title.trim() || schedule.title,
            amount_expected: nextAmount,
            notes: editForm.notes.trim() || null,
          })
          .eq("id", schedule.id)
          .eq("company_id", user.company_id);

        if (updateSchedule.error) {
          throw new Error(updateSchedule.error.message || "No pude actualizar la configuración del cobro.");
        }
      }

      await loadCollectionsData();
      setEditRecordId(null);
      showToast({ type: "success", message: "Cobro actualizado correctamente." });
    } catch (error) {
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "No pude actualizar el cobro.",
      });
    } finally {
      setEditingRecord(false);
    }
  }

  function openPaymentModal(row: CollectionRow) {
    setPaymentRecordId(row.id);
    setPaymentForm({
      recordId: row.id,
      amount: row.balance > 0 ? String(row.balance) : "",
      paidAt: getTodayDateOnlyKey(),
      paymentMethod: "",
      reference: "",
      notes: "",
    });
  }

  async function handleSavePayment() {
    if (!user?.company_id || !paymentRecordId) return;

    const row = collectionRowsById.get(paymentRecordId);
    if (!row) return;

    const amount = parsePositiveNumber(paymentForm.amount);

    if (!amount) {
      showToast({ type: "error", message: "Ingresa un monto válido para el abono." });
      return;
    }

    if (amount > row.balance) {
      showToast({ type: "error", message: "El abono no puede ser mayor al saldo pendiente." });
      return;
    }

    if (!paymentForm.paidAt) {
      showToast({ type: "error", message: "Selecciona la fecha del abono." });
      return;
    }

    setSavingPayment(true);

    const paidAtIso = new Date(`${paymentForm.paidAt}T12:00:00`).toISOString();

    const insertRes = await supabase.from("collection_payments").insert({
      collection_record_id: row.id,
      company_id: user.company_id,
      amount,
      paid_at: paidAtIso,
      payment_method: paymentForm.paymentMethod || null,
      reference: paymentForm.reference.trim() || null,
      notes: paymentForm.notes.trim() || null,
      created_by: user.id || null,
    });

    if (insertRes.error) {
      showToast({ type: "error", message: "No se pudo registrar el abono." });
      setSavingPayment(false);
      return;
    }

    await loadCollectionsData();

    setSavingPayment(false);
    setPaymentRecordId(null);

    showToast({ type: "success", message: "Abono registrado correctamente." });
  }

  const paymentRow = paymentRecordId
    ? collectionRowsById.get(paymentRecordId) || null
    : null;

  function resetImportInvoiceState() {
    setImportForm(createDefaultImportForm());
    setImportXmlFile(null);
    setImportPdfFile(null);
    setImportPreview(null);
    setImportStatusMessage("");
  }

  function openImportInvoiceModal() {
    resetImportInvoiceState();
    setImportInvoiceOpen(true);
  }

  async function handleImportXmlSelected(file: File | null) {
    setImportXmlFile(file);

    if (!file) {
      setImportPreview(null);
      setImportStatusMessage("");
      return;
    }

    try {
      const xmlText = await file.text();
      const parsed = parseCfdiXml(xmlText);
      const extractedIdentifiers = extractCfdiFileIdentifiers(xmlText);
      const preview: ImportPreviewData = {
        ...parsed,
        emitterTaxId: extractedIdentifiers.emitterTaxId || (parsed as any).emitterTaxId || null,
        customerTaxId: parsed.customerTaxId || extractedIdentifiers.receiverTaxId || null,
        series: parsed.series || extractedIdentifiers.series || null,
        folio: parsed.folio || extractedIdentifiers.folio || null,
        xmlFileName: file.name,
      };
      const inferredCategory = inferChargeTypeFromDescription(preview.description);

      setImportPreview(preview);
      setImportForm((prev) => ({
        ...prev,
        selectedChargeCategory: inferredCategory,
        title: buildImportedChargeTitle(preview, inferredCategory),
        dueDate: getEndOfMonthDateKey(preview.issuedAt || prev.dueDate || getTodayDateOnlyKey()),
      }));
      setImportStatusMessage("XML leído correctamente. Ahora revisa la coincidencia sugerida antes de confirmar.");
    } catch (error) {
      console.error(error);
      setImportPreview(null);
      setImportStatusMessage(error instanceof Error ? error.message : "No fue posible leer este XML automáticamente.");
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "No pude leer automáticamente el XML.",
      });
    }
  }

  async function handleConfirmImportedInvoice() {
    if (!user?.company_id || !user.id) return;

    if (!importPreview) {
      showToast({ type: "warning", message: "Primero sube un XML válido para analizar la factura." });
      return;
    }

    if (!importXmlFile || !importPdfFile) {
      showToast({ type: "warning", message: "Necesito tanto el XML como el PDF para importar la factura." });
      return;
    }

    if (!isLikelyMatchingInvoicePair(importXmlFile, importPdfFile, importPreview)) {
      showToast({
        type: "error",
        message: "El XML y el PDF no parecen corresponder a la misma factura. Deben coincidir por UUID o por RFC emisor + RFC receptor + folio/serie-folio.",
      });
      return;
    }

    if (!importForm.selectedLeaseId) {
      showToast({ type: "warning", message: "Selecciona el contrato al que pertenece esta factura." });
      return;
    }

    const lease = leases.find((item) => item.id === importForm.selectedLeaseId);
    if (!lease || !lease.unit_id) {
      showToast({ type: "error", message: "No pude ubicar el contrato seleccionado." });
      return;
    }

    const unit = units.find((item) => item.id === lease.unit_id);
    if (!unit) {
      showToast({ type: "error", message: "No pude ubicar la unidad del contrato seleccionado." });
      return;
    }

    const duplicateInvoice = collectionInvoices.find(
      (invoice) => invoice.invoice_uuid && invoice.invoice_uuid === importPreview.uuid
    );

    if (duplicateInvoice) {
      showToast({
        type: "warning",
        message: "Ese UUID ya existe en Cobranza. Ya puedes consultarlo desde el botón Ver facturas sin salir de esta pantalla.",
      });
      return;
    }

    const chargeCategory = importForm.selectedChargeCategory || inferChargeTypeFromDescription(importPreview.description);
    const dueDate = getEndOfMonthDateKey(importPreview.issuedAt || importForm.dueDate || getTodayDateOnlyKey());
    const dueDateObject = parseDateOnly(dueDate);
    const amountDue = Number(importPreview.total || importPreview.subtotal || 0);

    if (!Number.isFinite(amountDue) || amountDue <= 0) {
      showToast({ type: "warning", message: "No pude detectar un total válido en el XML." });
      return;
    }

    setImportingInvoice(true);

    let uploadedFilesForCleanup: { pdfPath: string | null; xmlPath: string | null } | null = null;
    let createdScheduleId: string | null = null;
    let createdRecordId: string | null = null;

    try {
      let schedule = collectionSchedules.find(
        (item) =>
          item.lease_id === lease.id &&
          item.unit_id === unit.id &&
          item.building_id === unit.building_id &&
          item.charge_type === chargeCategory &&
          item.active
      ) || null;

      if (!schedule) {
        const createdSchedule = await supabase
          .from("collection_schedules")
          .insert({
            company_id: user.company_id,
            building_id: unit.building_id,
            unit_id: unit.id,
            lease_id: lease.id,
            charge_type: chargeCategory,
            title: importForm.title.trim() || buildImportedChargeTitle(importPreview, chargeCategory),
            responsibility_type: "tenant",
            amount_expected: amountDue,
            due_day: 31,
            active: ["rent", "maintenance_fee", "electricity", "water", "gas", "amenities", "parking"].includes(chargeCategory),
            notes: importForm.notes.trim() || "Configuración creada automáticamente desde importación de factura.",
          })
          .select("id, building_id, unit_id, lease_id, charge_type, title, responsibility_type, amount_expected, due_day, active, notes")
          .single();

        if (createdSchedule.error || !createdSchedule.data) {
          throw new Error(createdSchedule.error?.message || "No pude crear la configuración base del cobro importado.");
        }

        schedule = createdSchedule.data as CollectionSchedule;
        createdScheduleId = schedule.id;
      }

      let record = collectionRecords.find(
        (item) =>
          item.collection_schedule_id === schedule.id &&
          item.period_year === dueDateObject.getFullYear() &&
          item.period_month === dueDateObject.getMonth() + 1
      ) || null;

      if (!record) {
        record = collectionRecords.find((item) => {
          if (item.unit_id !== unit.id) return false;
          if ((item.lease_id || null) !== lease.id) return false;
          if (item.period_year !== dueDateObject.getFullYear()) return false;
          if (item.period_month !== dueDateObject.getMonth() + 1) return false;
          const relatedSchedule = collectionSchedules.find((scheduleItem) => scheduleItem.id === item.collection_schedule_id);
          return relatedSchedule?.charge_type === chargeCategory;
        }) || null;
      }

      if (!record) {
        const createdRecord = await supabase
          .from("collection_records")
          .insert({
            collection_schedule_id: schedule.id,
            company_id: user.company_id,
            building_id: unit.building_id,
            unit_id: unit.id,
            lease_id: lease.id,
            period_year: dueDateObject.getFullYear(),
            period_month: dueDateObject.getMonth() + 1,
            due_date: dueDate,
            amount_due: amountDue,
            amount_collected: 0,
            status: deriveStatusFromDueDate(dueDate),
            collected_at: null,
            payment_method: null,
            notes: importForm.notes.trim() || importPreview.description || "Cobro generado automáticamente desde factura importada.",
          })
          .select("id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, payment_method, notes, created_at")
          .single();

        if (createdRecord.error || !createdRecord.data) {
          throw new Error(createdRecord.error?.message || "No pude crear el registro de cobranza desde la factura importada.");
        }

        record = createdRecord.data as CollectionRecord;
        createdRecordId = record.id;
      }

      const uploadedFiles = await uploadInvoiceFiles({
        companyId: user.company_id,
        buildingId: unit.building_id,
        leaseId: lease.id,
        invoiceUuid: importPreview.uuid,
        pdfFile: importPdfFile,
        xmlFile: importXmlFile,
      });

      uploadedFilesForCleanup = {
        pdfPath: uploadedFiles.pdfPath,
        xmlPath: uploadedFiles.xmlPath,
      };

      if (!uploadedFiles.pdfPath || !uploadedFiles.xmlPath) {
        throw new Error("No pude guardar correctamente los archivos de la factura importada.");
      }

      const invoiceInsert = await supabase
        .from("collection_invoices")
        .insert({
          company_id: user.company_id,
          building_id: unit.building_id,
          unit_id: unit.id,
          lease_id: lease.id,
          collection_record_id: record.id,
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
          match_confidence: selectedImportCandidate?.score || 0,
          match_notes: selectedImportCandidate?.reasons.join(" | ") || importStatusMessage || null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (invoiceInsert.error || !invoiceInsert.data?.id) {
        throw new Error(invoiceInsert.error?.message || "No pude crear la factura importada dentro de Cobranza.");
      }

      const { error: pendingUploadCompletionError } = await supabase
        .from("invoice_pending_uploads")
        .update({
          status: "completed",
          linked_collection_record_id: record.id,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq("company_id", user.company_id)
        .eq("lease_id", lease.id)
        .eq("period_year", dueDateObject.getFullYear())
        .eq("period_month", dueDateObject.getMonth() + 1)
        .eq("concept_code", chargeCategory)
        .eq("status", "pending_upload");

      if (pendingUploadCompletionError) {
        throw new Error(
          pendingUploadCompletionError.message ||
            "La factura se importó, pero no pude completar el pendiente de carga relacionado."
        );
      }

      await loadCollectionsData();
      setImportingInvoice(false);
      setImportInvoiceOpen(false);
      resetImportInvoiceState();

      showToast({
        type: "success",
        message: "Factura importada correctamente. El cobro ya quedó clasificado y visible en Cobranza. Puedes revisar el documento cuando quieras desde Ver facturas.",
      });

      setDetailRecordId(record.id);
    } catch (error) {
      console.error(error);

      if (uploadedFilesForCleanup?.pdfPath || uploadedFilesForCleanup?.xmlPath) {
        try {
          await Promise.all([
            removeInvoiceFile(uploadedFilesForCleanup.pdfPath),
            removeInvoiceFile(uploadedFilesForCleanup.xmlPath),
          ]);
        } catch (cleanupError) {
          console.error("No pude limpiar los archivos subidos tras fallar la importación.", cleanupError);
        }
      }

      if (createdRecordId) {
        try {
          await supabase.from("collection_records").delete().eq("id", createdRecordId);
        } catch (cleanupError) {
          console.error("No pude limpiar el record creado tras fallar la importación.", cleanupError);
        }
      }

      if (createdScheduleId) {
        try {
          await supabase.from("collection_schedules").delete().eq("id", createdScheduleId);
        } catch (cleanupError) {
          console.error("No pude limpiar el schedule creado tras fallar la importación.", cleanupError);
        }
      }

      setImportingInvoice(false);
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : "No pude completar la importación de la factura.",
      });
    }
  }

  function openCreateChargeModal() {
    setChargeForm(createDefaultChargeForm());
    setCreateChargeOpen(true);
  }

  async function handleCreateCharge() {
    if (!user?.company_id) return;

    if (!chargeForm.buildingId) {
      showToast({ type: "error", message: "Selecciona un edificio para el cobro." });
      return;
    }

    if (!chargeForm.unitId) {
      showToast({ type: "error", message: "Selecciona una unidad para el cobro." });
      return;
    }

    const amountExpected = parsePositiveNumber(chargeForm.amountExpected);
    if (!amountExpected) {
      showToast({ type: "error", message: "Ingresa un monto válido para el cobro." });
      return;
    }

    if (!chargeForm.title.trim()) {
      showToast({ type: "error", message: "Escribe el concepto o título del cobro." });
      return;
    }

    if (!chargeForm.initialDueDate) {
      showToast({ type: "error", message: "Selecciona la fecha inicial de vencimiento." });
      return;
    }

    const dueDate = chargeForm.initialDueDate;
    const dueDateObject = parseDateOnly(dueDate);
    const derivedDueDay = chargeForm.chargeMode === "recurring"
      ? Number(chargeForm.dueDay || dueDateObject.getDate())
      : dueDateObject.getDate();

    if (!Number.isFinite(derivedDueDay) || derivedDueDay < 1 || derivedDueDay > 31) {
      showToast({ type: "error", message: "Selecciona un día de vencimiento válido." });
      return;
    }

    setCreatingCharge(true);

    const schedulePayload = {
      company_id: user.company_id,
      building_id: chargeForm.buildingId,
      unit_id: chargeForm.unitId,
      lease_id: chargeForm.leaseId || null,
      charge_type: chargeForm.chargeType,
      title: chargeForm.title.trim(),
      responsibility_type: chargeForm.responsibilityType,
      amount_expected: amountExpected,
      due_day: derivedDueDay,
      active: chargeForm.chargeMode === "recurring",
      notes: chargeForm.notes.trim() || null,
    };

    const { data: insertedSchedule, error: scheduleError } = await supabase
      .from("collection_schedules")
      .insert(schedulePayload)
      .select("id")
      .single();

    if (scheduleError || !insertedSchedule) {
      console.error(scheduleError);
      showToast({ type: "error", message: "No se pudo crear la configuración del cobro." });
      setCreatingCharge(false);
      return;
    }

    const shouldCreateRecord =
      chargeForm.chargeMode === "one_time" || chargeForm.createFirstRecordNow;

    if (shouldCreateRecord) {
      const recordPayload = {
        collection_schedule_id: insertedSchedule.id,
        company_id: user.company_id,
        building_id: chargeForm.buildingId,
        unit_id: chargeForm.unitId,
        lease_id: chargeForm.leaseId || null,
        period_year: dueDateObject.getFullYear(),
        period_month: dueDateObject.getMonth() + 1,
        due_date: dueDate,
        amount_due: amountExpected,
        amount_collected: 0,
        status: deriveStatusFromDueDate(dueDate),
        collected_at: null,
        payment_method: null,
        notes: chargeForm.notes.trim() || null,
      };

      const { error: recordError } = await supabase
        .from("collection_records")
        .insert(recordPayload);

      if (recordError) {
        console.error(recordError);
        await supabase.from("collection_schedules").delete().eq("id", insertedSchedule.id);
        showToast({
          type: "error",
          message:
            recordError.message.includes("unique")
              ? "Ya existe un cobro para ese mismo periodo en esta configuración. Ajusta la fecha inicial."
              : "No se pudo crear el primer cobro ligado a la configuración.",
        });
        setCreatingCharge(false);
        return;
      }
    }

    await loadCollectionsData();
    setCreatingCharge(false);
    setCreateChargeOpen(false);
    setChargeForm(createDefaultChargeForm());

    showToast({
      type: "success",
      message:
        chargeForm.chargeMode === "recurring"
          ? shouldCreateRecord
            ? "Cobro recurrente creado y primer registro generado correctamente."
            : "Cobro recurrente creado correctamente."
          : "Cargo adicional creado correctamente.",
    });
  }

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>
          Cargando módulo de cobranza...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Cobranza"
        titleIcon={<Wallet size={18} />}
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton onClick={openImportInvoiceModal} icon={<FileUp size={16} />}>
              Importar factura
            </UiButton>
            <UiButton
              onClick={() => router.push("/collections/invoices")}
              icon={<FileText size={16} />}
              variant="secondary"
            >
              Ver facturas
            </UiButton>
            <UiButton onClick={openCreateChargeModal} icon={<Plus size={16} />} variant="secondary">
              Cargo manual
            </UiButton>
          </div>
        }
      />

      {message ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {message}
        </div>
      ) : null}

      <AppGrid minWidth={220}>
        <MetricCard
          label="Registros"
          value={String(totalRecords)}
          helper={selectedBuildingLabel}
          icon={<Wallet size={18} />}
        />

        <MetricCard
          label="Cobrados"
          value={String(collectedCount)}
          helper="Cobros cerrados"
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
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
          }
        />

        <MetricCard
          label="Parciales"
          value={String(partialCount)}
          helper="Con abonos registrados"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#DBEAFE",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Landmark size={18} color="#2563EB" />
            </div>
          }
        />

        <MetricCard
          label="Pendientes"
          value={String(pendingCount)}
          helper={nextPendingLabel}
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF9C3",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Clock3 size={18} color="#EAB308" />
            </div>
          }
        />

        <MetricCard
          label="Vencidos"
          value={String(overdueCount)}
          helper="Requieren seguimiento"
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
              <AlertCircle size={18} color="#DC2626" />
            </div>
          }
        />

        <MetricCard
          label="Pagos reportados"
          value={String(reportedPendingCount)}
          helper="Pendientes de revisión"
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

        <div onClick={() => router.push("/collections/pending-invoice-uploads")} style={{ cursor: "pointer" }}>
          <MetricCard
            label="Falta cargar factura"
            value={String(pendingInvoiceUploadCount)}
            helper="Facturas generadas sin XML/PDF"
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: pendingInvoiceUploadCount > 0 ? "#FEF3C7" : "#F3F4F6",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Upload size={18} color={pendingInvoiceUploadCount > 0 ? "#D97706" : "#4B5563"} />
              </div>
            }
          />
        </div>

        <MetricCard
          label="Saldo pendiente"
          value={formatCurrency(totalOutstandingAmount)}
          helper="Pendiente + parcial + vencido"
          icon={<CalendarDays size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard title="Centro de revisión" icon={<CreditCard size={18} />}>
        <AppGrid minWidth={280}>
          <AppCard>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={quickSectionTitleStyle}>Pagos reportados por inquilinos</div>
                <div style={quickSectionTextStyle}>
                  Revisa comprobantes enviados desde el portal antes de afectar la
                  cobranza real. Aquí podrás aprobar o rechazar cada reporte.
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: reportedPendingCount > 0 ? "#FEF3C7" : "#ECFDF5",
                  border: `1px solid ${reportedPendingCount > 0 ? "#FDE68A" : "#A7F3D0"}`,
                  color: reportedPendingCount > 0 ? "#92400E" : "#166534",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <CreditCard size={15} />
                {reportedPendingCount > 0
                  ? `${reportedPendingCount} pendiente${reportedPendingCount === 1 ? "" : "s"}`
                  : "Sin pendientes"}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <UiButton
                  onClick={() => router.push("/collections/reported-payments")}
                  icon={<Eye size={16} />}
                >
                  Abrir revisión
                </UiButton>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={quickSectionTitleStyle}>Generación de facturas</div>
                <div style={quickSectionTextStyle}>
                  Lleva control administrativo de qué facturas deben generarse este mes por contrato vigente según la configuración de cada edificio.
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "#EEF2FF",
                  border: "1px solid #C7D2FE",
                  color: "#3730A3",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <FileText size={15} />
                Control mensual
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <UiButton
                  onClick={() => router.push("/collections/invoice-generation")}
                  icon={<Eye size={16} />}
                >
                  Abrir control
                </UiButton>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={quickSectionTitleStyle}>Falta cargar factura</div>
                <div style={quickSectionTextStyle}>
                  Revisa las facturas ya generadas externamente que todavía no tienen XML/PDF cargado en el sistema.
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: pendingInvoiceUploadCount > 0 ? "#FEF3C7" : "#F3F4F6",
                  border: `1px solid ${pendingInvoiceUploadCount > 0 ? "#FDE68A" : "#E5E7EB"}`,
                  color: pendingInvoiceUploadCount > 0 ? "#92400E" : "#374151",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <Upload size={15} />
                {pendingInvoiceUploadCount > 0
                  ? `${pendingInvoiceUploadCount} pendiente${pendingInvoiceUploadCount === 1 ? "" : "s"}`
                  : "Sin pendientes"}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <UiButton
                  onClick={() => router.push("/collections/pending-invoice-uploads")}
                  icon={<Eye size={16} />}
                  variant="secondary"
                >
                  Abrir listado
                </UiButton>
              </div>
            </div>
          </AppCard>
        </AppGrid>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Filtros" icon={<Filter size={18} />}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={filterLabelStyle}>
                <Building2 size={14} />
                Edificio
              </div>

              <AppSelect
                value={selectedBuildingId}
                onChange={(event) => setSelectedBuildingId(event.target.value)}
              >
                <option value="all">Todos los edificios</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </AppSelect>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={filterLabelStyle}>
                <Filter size={14} />
                Estado
              </div>

              <AppSelect
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as CollectionStatusFilter)
                }
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="partial">Parcial</option>
                <option value="collected">Cobrado</option>
                <option value="overdue">Vencido</option>
              </AppSelect>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Listado de cobranza" icon={<Wallet size={18} />}>
                <div style={{ display: "grid", gap: 14 }}>
          <div style={collectionHeaderGridStyle}>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Concepto</span>
              <span style={headerSecondaryTextStyle}>categoría</span>
            </div>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Edificio</span>
              <span style={headerSecondaryTextStyle}>departamento / unidad</span>
            </div>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Inquilino</span>
              <span style={headerSecondaryTextStyle}>responsable de pago</span>
            </div>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Periodo</span>
              <span style={headerSecondaryTextStyle}>tipo de cobro</span>
            </div>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Vencimiento</span>
              <span style={headerSecondaryTextStyle}>fin de mes</span>
            </div>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Monto</span>
              <span style={headerSecondaryTextStyle}>cobrado</span>
            </div>
            <div style={headerCellWrapStyle}>
              <span style={headerPrimaryTextStyle}>Estado</span>
              <span style={headerSecondaryTextStyle}>saldo actual</span>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div style={emptyInlineBoxStyle}>
              Todavía no hay registros de cobranza. Importa una factura o crea un cargo manual para empezar a operar este módulo.
            </div>
          ) : (
            filteredRows.map((row) => {
              const isExpanded = detailRecordId === row.id;
              const rowPayments = (paymentsByRecordId.get(row.id) || []).slice().sort((a, b) => b.paid_at.localeCompare(a.paid_at));
              const rowInvoices = (invoicesByRecordId.get(row.id) || []).slice().sort((a, b) => {
                const aDate = a.issued_at || a.created_at;
                const bDate = b.issued_at || b.created_at;
                return bDate.localeCompare(aDate);
              });
              const statusColors = getStatusColors(row.status);

              return (
                <div key={row.id} style={collectionRowCardStyle}>
                  <div style={collectionBodyGridStyle}>
                    <div style={conceptCellWrapStyle}>
                      <div style={chargeIconWrapStyle}>{getCollectionTypeIcon(collectionSchedules.find((item) => item.id === collectionRecords.find((record) => record.id === row.id)?.collection_schedule_id)?.charge_type || "other")}</div>
                      <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <div style={{ ...rowTitleStyle, lineHeight: 1.1 }}>{row.title}</div>
                        <button
                          type="button"
                          onClick={() => setDetailRecordId((current) => (current === row.id ? null : row.id))}
                          style={detailToggleButtonStyle}
                        >
                          {isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    <div style={rowTwoLineCellStyle}>
                      <span style={rowPrimaryTextStyle}>{row.buildingName}</span>
                      <span style={rowSecondaryTextStyle}>{row.unitLabel}</span>
                    </div>

                    <div style={rowTwoLineCellStyle}>
                      <span style={rowPrimaryTextStyle}>{row.tenantLabel}</span>
                      <span style={rowSecondaryTextStyle}>{row.responsiblePayerLabel}</span>
                    </div>

                    <div style={rowTwoLineCellStyle}>
                      <span style={rowPrimaryTextStyle}>{row.periodLabel}</span>
                      <span style={rowSecondaryTextStyle}>{row.chargeTypeLabel}</span>
                    </div>

                    <div style={rowSingleCellStyle}>
                      <span style={rowPrimaryTextStyle}>{row.dueDateLabel}</span>
                    </div>

                    <div style={rowTwoLineCellStyle}>
                      <span style={rowMoneyPrimaryStyle}>{row.amountDueLabel}</span>
                      <span style={rowSecondaryTextStyle}>{row.amountCollectedLabel} cobrados</span>
                    </div>

                    <div style={rowTwoLineCellStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: `1px solid ${statusColors.border}`,
                          background: statusColors.background,
                          color: statusColors.text,
                          fontSize: 12,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          width: "fit-content",
                        }}
                      >
                        {row.statusLabel}
                      </span>
                      <span style={rowSecondaryTextStyle}>{row.balanceLabel} pendientes</span>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div style={expandedRowWrapStyle}>
                      <div style={detailTopGridStyle}>
                        <div style={detailBlockStyle}>
                          <div style={detailLabelStyle}>Actividad</div>
                          <div style={detailValueStyle}>{row.paymentsCount} abono{row.paymentsCount === 1 ? "" : "s"} · {row.invoicesCount} factura{row.invoicesCount === 1 ? "" : "s"}</div>
                        </div>
                        <div style={detailBlockStyle}>
                          <div style={detailLabelStyle}>Saldo pendiente</div>
                          <div style={detailValueStyle}>{row.balanceLabel}</div>
                        </div>
                        <div style={detailBlockStyle}>
                          <div style={detailLabelStyle}>Método registrado</div>
                          <div style={detailValueStyle}>{row.paymentMethodLabel}</div>
                        </div>
                      </div>

                      <div style={inlineActionRowStyle}>
                        <button type="button" onClick={() => openPaymentModal(row)} style={inlineGreenButtonStyle} disabled={row.balance <= 0}>
                          <Plus size={15} />
                          Registrar abono
                        </button>
                        <button type="button" onClick={() => openEditRecordModal(row)} style={inlineBlueButtonStyle}>
                          <Pencil size={15} />
                          Editar
                        </button>
                        <button type="button" onClick={() => setDeleteRecordId(row.id)} style={inlineRedButtonStyle}>
                          <Trash2 size={15} />
                          Eliminar
                        </button>
                      </div>

                      <div>
                        <div style={detailSectionTitleStyle}>Notas</div>
                        <div style={notesBoxStyle}>
                          {row.notes && row.notes !== "—" ? row.notes : "No hay notas registradas para este cobro."}
                        </div>
                      </div>

                      <div>
                        <div style={detailSectionTitleStyle}>Historial de abonos</div>
                        {rowPayments.length === 0 ? (
                          <div style={emptyInlineBoxStyle}>No hay abonos registrados para este cobro.</div>
                        ) : (
                          <div style={detailListWrapStyle}>
                            {rowPayments.map((payment) => (
                              <div key={payment.id} style={detailListItemStyle}>
                                <div style={{ display: "grid", gap: 4 }}>
                                  <span style={cellPrimaryStrongStyle}>{formatCurrency(payment.amount)}</span>
                                  <span style={cellSecondaryStyle}>{payment.payment_method || "Sin método"} · {formatDateTime(payment.paid_at)}</span>
                                </div>
                                <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                                  <span style={cellSecondaryStyle}>{payment.reference || "Sin referencia"}</span>
                                  <span style={cellSecondaryStyle}>{payment.notes || "Sin notas"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div style={detailSectionTitleStyle}>Facturas ligadas</div>
                        {rowInvoices.length === 0 ? (
                          <div style={emptyInlineBoxStyle}>Todavía no hay facturas ligadas a este cobro.</div>
                        ) : (
                          <div style={detailListWrapStyle}>
                            {rowInvoices.map((invoice) => (
                              <div key={invoice.id} style={detailListItemStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={invoiceIconWrapStyle}>
                                    <Receipt size={16} />
                                  </div>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={cellPrimaryStrongStyle}>{invoice.description || "Factura ligada"}</span>
                                    <span style={cellSecondaryStyle}>{invoice.customer_name || "Sin cliente"} · {invoice.invoice_uuid || "Sin UUID"}</span>
                                  </div>
                                </div>
                                <div style={{ display: "grid", gap: 8, textAlign: "right" }}>
                                  <span style={cellPrimaryStyle}>{formatCurrency(invoice.total)}</span>
                                  <span style={cellSecondaryStyle}>{formatDate(invoice.issued_at)}</span>
                                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    <button type="button" onClick={() => router.push(`/collections/invoices/${invoice.id}`)} style={smallGhostButtonStyle}>Abrir factura</button>
                                    {invoice.pdf_path ? <button type="button" onClick={async () => { const { data } = await supabase.storage.from("invoices").createSignedUrl(invoice.pdf_path, 60); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }} style={smallGhostButtonStyle}>Ver PDF</button> : null}
                                    {invoice.xml_path ? <button type="button" onClick={async () => { const { data } = await supabase.storage.from("invoices").createSignedUrl(invoice.xml_path, 60); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }} style={smallGhostButtonStyle}>Ver XML</button> : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
</SectionCard>

      <Modal
        open={Boolean(deleteRecordRow)}
        title="Eliminar cobro"
        onClose={() => {
          if (!deletingRecord) {
            setDeleteRecordId(null);
          }
        }}
      >
        {deleteRecordRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={dangerBoxStyle}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={detailSectionTitleStyle}>Confirmación requerida</div>
                <div style={quickSectionTextStyle}>
                  Vas a eliminar este cobro, sus abonos ligados y también las facturas importadas con sus archivos XML/PDF.
                  Esta acción no se puede deshacer.
                </div>
              </div>
            </div>

            <div style={detailTopGridStyle}>
              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Concepto</div>
                <div style={detailValueStyle}>{deleteRecordRow.title}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Ubicación</div>
                <div style={detailValueStyle}>
                  {deleteRecordRow.buildingName} · {deleteRecordRow.unitLabel}
                </div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Periodo</div>
                <div style={detailValueStyle}>{deleteRecordRow.periodLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Saldo</div>
                <div style={detailValueStyle}>{deleteRecordRow.balanceLabel}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <UiButton
                variant="secondary"
                onClick={() => setDeleteRecordId(null)}
                disabled={deletingRecord}
              >
                Cancelar
              </UiButton>

              <UiButton
                onClick={handleDeleteCollectionRecord}
                disabled={deletingRecord}
                icon={<Trash2 size={16} />}
              >
                {deletingRecord ? "Eliminando..." : "Confirmar eliminación"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={importInvoiceOpen}
        title="Importar factura"
        onClose={() => {
          if (!importingInvoice) {
            setImportInvoiceOpen(false);
            resetImportInvoiceState();
          }
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={paymentSummaryCardStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={detailSectionTitleStyle}>Ingesta inteligente de XML + PDF</div>
              <div style={quickSectionTextStyle}>
                Este es ahora el flujo principal de Cobranza. Sube ambos archivos y el sistema intentará
                clasificar la factura automáticamente para crear o ligar el cobro correspondiente.
              </div>
            </div>
          </div>

          <div style={simpleFormGridStyle}>
            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>XML CFDI</span>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  void handleImportXmlSelected(file);
                }}
                style={inputStyle}
              />
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>PDF de la factura</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setImportPdfFile(event.target.files?.[0] || null)}
                style={inputStyle}
              />
            </label>
          </div>

          <div
            style={{
              ...paymentSummaryCardStyle,
              border: `1px solid ${importPreview ? "#BFDBFE" : "#E5E7EB"}`,
              background: importPreview ? "#EFF6FF" : "#F9FAFB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={invoiceIconWrapStyle}>
                {importPreview ? <WandSparkles size={16} /> : <Upload size={16} />}
              </div>
              <div style={detailSectionTitleStyle}>
                {importPreview ? "Vista previa detectada" : "Aún no se ha leído un XML"}
              </div>
            </div>

            <div style={quickSectionTextStyle}>
              {importStatusMessage || "Sube un XML para extraer UUID, cliente, RFC, fecha, importe y concepto."}
            </div>
          </div>

          {importPreview ? (
            <>
              <div style={detailTopGridStyle}>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Cliente detectado</div>
                  <div style={detailValueStyle}>{importPreview.customerName || "Sin nombre"}</div>
                </div>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>RFC detectado</div>
                  <div style={detailValueStyle}>{importPreview.customerTaxId || "Sin RFC"}</div>
                </div>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>UUID</div>
                  <div style={detailValueStyle}>{importPreview.uuid || "Sin UUID"}</div>
                </div>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Fecha CFDI</div>
                  <div style={detailValueStyle}>{formatDate(importPreview.issuedAt || null)}</div>
                </div>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Total</div>
                  <div style={detailValueStyle}>{formatCurrency(Number(importPreview.total || 0))}</div>
                </div>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Concepto</div>
                  <div style={detailValueStyle}>{importPreview.description || "Sin descripción"}</div>
                </div>
              </div>

              <div style={simpleFormGridStyle}>
                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>Contrato sugerido</span>
                  <AppSelect
                    value={importForm.selectedLeaseId}
                    onChange={(event) =>
                      setImportForm((prev) => ({
                        ...prev,
                        selectedLeaseId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecciona un contrato</option>
                    {importCandidates.length > 0 ? (
                      <optgroup label="Coincidencias sugeridas">
                        {importCandidates.map((candidate) => (
                          <option key={`candidate-${candidate.leaseId}`} value={candidate.leaseId}>
                            {candidate.tenantLabel} · {candidate.buildingName} · Unidad {candidate.unitLabel} · score {candidate.score}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    <optgroup label="Todos los contratos disponibles">
                      {leaseLookupOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  </AppSelect>
                </label>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>Categoría sugerida</span>
                  <AppSelect
                    value={importForm.selectedChargeCategory}
                    onChange={(event) =>
                      setImportForm((prev) => ({
                        ...prev,
                        selectedChargeCategory: event.target.value as CollectionChargeType,
                      }))
                    }
                  >
                    <option value="rent">Renta</option>
                    <option value="maintenance_fee">Mantenimiento</option>
                    <option value="electricity">Electricidad</option>
                    <option value="water">Agua</option>
                    <option value="gas">Gas</option>
                    <option value="amenities">Amenidades</option>
                    <option value="services">Servicios (legado)</option>
                    <option value="parking">Estacionamiento</option>
                    <option value="penalty">Penalización</option>
                    <option value="other">Otro</option>
                  </AppSelect>
                </label>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>Vencimiento del cobro</span>
                  <input
                    type="date"
                    value={importForm.dueDate}
                    disabled
                    style={{ ...inputStyle, background: "#F3F4F6", color: "#6B7280" }}
                  />
                  <span style={fieldHelperStyle}>Se calcula automáticamente como el último día del mes correspondiente al CFDI.</span>
                </label>
              </div>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Título del cobro</span>
                <input
                  type="text"
                  value={importForm.title}
                  onChange={(event) =>
                    setImportForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Cómo quieres que aparezca este cobro en el listado"
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Notas internas</span>
                <textarea
                  value={importForm.notes}
                  onChange={(event) =>
                    setImportForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Opcional: observaciones internas de esta importación"
                  style={textareaStyle}
                />
              </label>

              {selectedImportCandidate ? (
                <div style={paymentSummaryCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={invoiceIconWrapStyle}>
                      <Receipt size={16} />
                    </div>
                    <div style={detailSectionTitleStyle}>
                      Coincidencia sugerida · score {selectedImportCandidate.score}
                    </div>
                  </div>
                  <div style={detailTopGridStyle}>
                    <div style={detailBlockStyle}>
                      <div style={detailLabelStyle}>Contrato propuesto</div>
                      <div style={detailValueStyle}>{selectedImportCandidate.tenantLabel} · {selectedImportCandidate.buildingName} · Unidad {selectedImportCandidate.unitLabel}</div>
                    </div>
                    <div style={detailBlockStyle}>
                      <div style={detailLabelStyle}>Responsable sugerido</div>
                      <div style={detailValueStyle}>{selectedImportCandidate.responsiblePayerLabel}</div>
                    </div>
                    <div style={detailBlockStyle}>
                      <div style={detailLabelStyle}>Facturación esperada</div>
                      <div style={detailValueStyle}>{selectedImportCandidate.billingName || "Sin nombre"}</div>
                    </div>
                    <div style={detailBlockStyle}>
                      <div style={detailLabelStyle}>RFC esperado</div>
                      <div style={detailValueStyle}>{selectedImportCandidate.billingTaxId || "Sin RFC"}</div>
                    </div>
                  </div>
                  <div style={{ ...quickSectionTextStyle, marginTop: 10 }}>
                    {selectedImportCandidate.reasons.join(" · ") || "Revisión manual"}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                if (!importingInvoice) {
                  setImportInvoiceOpen(false);
                  resetImportInvoiceState();
                }
              }}
              style={ghostButtonStyle}
            >
              Cancelar
            </button>

            <UiButton
              onClick={handleConfirmImportedInvoice}
              icon={<FileUp size={16} />}
              disabled={!importPreview || !importXmlFile || !importPdfFile || importingInvoice}
            >
              {importingInvoice ? "Importando..." : "Confirmar e importar"}
            </UiButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={createChargeOpen}
        title="Nuevo cobro"
        onClose={() => {
          if (!creatingCharge) {
            setCreateChargeOpen(false);
            setChargeForm(createDefaultChargeForm());
          }
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={paymentSummaryCardStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={detailSectionTitleStyle}>Alta operativa de cobranza</div>
              <div style={quickSectionTextStyle}>
                Aquí podrás crear tanto cobros recurrentes como cargos adicionales. En los recurrentes,
                el sistema puede generar de una vez el primer registro visible en este listado.
              </div>
            </div>
          </div>

          <div style={simpleFormGridStyle}>
            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Tipo de cobro</span>
              <AppSelect
                value={chargeForm.chargeMode}
                onChange={(event) => {
                  const nextMode = event.target.value as ChargeMode;
                  setChargeForm((prev) => ({
                    ...prev,
                    chargeMode: nextMode,
                    createFirstRecordNow: nextMode === "recurring",
                  }));
                }}
              >
                <option value="recurring">Recurrente</option>
                <option value="one_time">Único / cargo adicional</option>
              </AppSelect>
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Categoría</span>
              <AppSelect
                value={chargeForm.chargeType}
                onChange={(event) =>
                  setChargeForm((prev) => ({
                    ...prev,
                    chargeType: event.target.value as CollectionChargeType,
                  }))
                }
              >
                <option value="rent">Renta</option>
                <option value="maintenance_fee">Mantenimiento</option>
                <option value="electricity">Electricidad</option>
                    <option value="water">Agua</option>
                    <option value="gas">Gas</option>
                    <option value="amenities">Amenidades</option>
                    <option value="services">Servicios (legado)</option>
                <option value="parking">Estacionamiento</option>
                <option value="penalty">Penalización</option>
                <option value="other">Otro</option>
              </AppSelect>
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Responsable</span>
              <AppSelect
                value={chargeForm.responsibilityType}
                onChange={(event) =>
                  setChargeForm((prev) => ({
                    ...prev,
                    responsibilityType: event.target.value as "tenant" | "owner" | "other",
                  }))
                }
              >
                <option value="tenant">Inquilino</option>
                <option value="owner">Propietario</option>
                <option value="other">Otro</option>
              </AppSelect>
            </label>
          </div>

          <div style={simpleFormGridStyle}>
            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Edificio</span>
              <AppSelect
                value={chargeForm.buildingId}
                onChange={(event) =>
                  setChargeForm((prev) => ({
                    ...prev,
                    buildingId: event.target.value,
                    unitId: "",
                    leaseId: "",
                  }))
                }
              >
                <option value="">Selecciona un edificio</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </AppSelect>
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Unidad</span>
              <AppSelect
                value={chargeForm.unitId}
                onChange={(event) =>
                  setChargeForm((prev) => ({
                    ...prev,
                    unitId: event.target.value,
                    leaseId: "",
                  }))
                }
                disabled={!chargeForm.buildingId}
              >
                <option value="">Selecciona una unidad</option>
                {unitsForSelectedBuilding.map((unit) => {
                  const label = unit.display_code || unit.unit_number || "Unidad";
                  return (
                    <option key={unit.id} value={unit.id}>
                      {label}
                    </option>
                  );
                })}
              </AppSelect>
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Contrato / lease</span>
              <AppSelect
                value={chargeForm.leaseId}
                onChange={(event) =>
                  setChargeForm((prev) => ({
                    ...prev,
                    leaseId: event.target.value,
                  }))
                }
                disabled={!chargeForm.unitId}
              >
                <option value="">Sin contrato específico</option>
                {leasesForSelectedUnit.map((lease) => {
                  const tenant = lease.tenant_id ? tenantMap.get(lease.tenant_id) : null;
                  const tenantLabel =
                    tenant?.full_name ||
                    lease.billing_name ||
                    lease.billing_email ||
                    "Contrato sin inquilino visible";

                  return (
                    <option key={lease.id} value={lease.id}>
                      {tenantLabel}
                    </option>
                  );
                })}
              </AppSelect>
            </label>
          </div>

          {(selectedChargeLease || selectedChargeTenant) ? (
            <div style={detailTopGridStyle}>
              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Cliente sugerido</div>
                <div style={detailValueStyle}>
                  {selectedChargeTenant?.billing_name ||
                    selectedChargeLease?.billing_name ||
                    selectedChargeTenant?.full_name ||
                    "Sin nombre de facturación"}
                </div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>RFC sugerido</div>
                <div style={detailValueStyle}>{selectedChargeTenant?.tax_id || "Sin RFC"}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Correo</div>
                <div style={detailValueStyle}>
                  {selectedChargeTenant?.billing_email ||
                    selectedChargeTenant?.email ||
                    selectedChargeLease?.billing_email ||
                    "Sin correo"}
                </div>
              </div>
            </div>
          ) : null}

          <div style={simpleFormGridStyle}>
            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Concepto</span>
              <input
                value={chargeForm.title}
                onChange={(event) =>
                  setChargeForm((prev) => ({ ...prev, title: event.target.value }))
                }
                style={inputStyle}
                placeholder="Ej. Renta marzo 302 o ajuste extraordinario"
              />
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Monto esperado</span>
              <input
                value={chargeForm.amountExpected}
                onChange={(event) =>
                  setChargeForm((prev) => ({
                    ...prev,
                    amountExpected: formatDecimalInput(event.target.value),
                  }))
                }
                inputMode="decimal"
                style={inputStyle}
                placeholder="0.00"
              />
            </label>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>
                {chargeForm.chargeMode === "recurring" ? "Primer vencimiento" : "Vencimiento"}
              </span>
              <input
                type="date"
                value={chargeForm.initialDueDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  const parsed = parseDateOnly(nextDate || getTodayDateOnlyKey());
                  setChargeForm((prev) => ({
                    ...prev,
                    initialDueDate: nextDate,
                    dueDay:
                      prev.chargeMode === "recurring"
                        ? String(parsed.getDate())
                        : prev.dueDay,
                  }));
                }}
                style={inputStyle}
              />
            </label>
          </div>

          {chargeForm.chargeMode === "recurring" ? (
            <div style={simpleFormGridStyle}>
              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Día de vencimiento mensual</span>
                <AppSelect
                  value={chargeForm.dueDay}
                  onChange={(event) =>
                    setChargeForm((prev) => ({ ...prev, dueDay: event.target.value }))
                  }
                >
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={String(day)}>
                      Día {day}
                    </option>
                  ))}
                </AppSelect>
              </label>

              <div style={{ ...fieldWrapStyle, alignSelf: "end" }}>
                <span style={fieldLabelStyle}>Generación inicial</span>
                <label style={toggleCardStyle}>
                  <input
                    type="checkbox"
                    checked={chargeForm.createFirstRecordNow}
                    onChange={(event) =>
                      setChargeForm((prev) => ({
                        ...prev,
                        createFirstRecordNow: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    Crear primer cobro ahora para que ya aparezca en este listado.
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div style={oneTimeInfoStyle}>
              Este cargo adicional se guardará con una configuración interna no recurrente y generará
              inmediatamente un solo registro de cobranza.
            </div>
          )}

          <label style={fieldWrapStyle}>
            <span style={fieldLabelStyle}>Notas</span>
            <textarea
              value={chargeForm.notes}
              onChange={(event) =>
                setChargeForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              rows={4}
              style={textareaStyle}
              placeholder="Notas internas, detalle del cargo o instrucciones administrativas"
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                if (!creatingCharge) {
                  setCreateChargeOpen(false);
                  setChargeForm(createDefaultChargeForm());
                }
              }}
              style={ghostButtonStyle}
            >
              Cancelar
            </button>

            <UiButton onClick={handleCreateCharge} icon={<Plus size={16} />}>
              {creatingCharge ? "Guardando..." : "Guardar cobro"}
            </UiButton>
          </div>
        </div>
      </Modal>

            <Modal
        open={Boolean(editRecordRow)}
        title="Editar cobro"
        onClose={() => {
          if (!editingRecord) setEditRecordId(null);
        }}
      >
        {editRecordRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={paymentSummaryCardStyle}>
              <div style={paymentSummaryGridStyle}>
                <div>
                  <div style={detailLabelStyle}>Ubicación</div>
                  <div style={detailValueStyle}>{editRecordRow.buildingName} · {editRecordRow.unitLabel}</div>
                </div>
                <div>
                  <div style={detailLabelStyle}>Periodo</div>
                  <div style={detailValueStyle}>{editRecordRow.periodLabel}</div>
                </div>
                <div>
                  <div style={detailLabelStyle}>Estado actual</div>
                  <div style={detailValueStyle}>{editRecordRow.statusLabel}</div>
                </div>
              </div>
            </div>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Concepto</span>
              <input
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                style={inputStyle}
              />
            </label>

            <div style={simpleFormGridStyle}>
              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto</span>
                <input
                  value={editForm.amountDue}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, amountDue: formatDecimalInput(event.target.value) }))}
                  inputMode="decimal"
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Vencimiento</span>
                <input value={editRecordRow.dueDateLabel} disabled style={{ ...inputStyle, background: "#F3F4F6", color: "#6B7280" }} />
              </label>
            </div>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Notas</span>
              <textarea
                value={editForm.notes}
                onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
                style={textareaStyle}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => { if (!editingRecord) setEditRecordId(null); }} style={ghostButtonStyle}>Cancelar</button>
              <button type="button" onClick={handleSaveRecordEdits} style={inlineBlueButtonStyle}>
                <Pencil size={15} />
                {editingRecord ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

<Modal
        open={Boolean(paymentRow)}
        title="Registrar abono"
        onClose={() => {
          if (!savingPayment) setPaymentRecordId(null);
        }}
      >
        {paymentRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={paymentSummaryCardStyle}>
              <div style={paymentSummaryGridStyle}>
                <div>
                  <div style={detailLabelStyle}>Concepto</div>
                  <div style={detailValueStyle}>{paymentRow.title}</div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Unidad</div>
                  <div style={detailValueStyle}>
                    {paymentRow.buildingName} · {paymentRow.unitLabel}
                  </div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Inquilino</div>
                  <div style={detailValueStyle}>{paymentRow.tenantLabel}</div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Saldo actual</div>
                  <div style={detailValueStyle}>{paymentRow.balanceLabel}</div>
                </div>
              </div>
            </div>

            <div style={simpleFormGridStyle}>
              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto del abono</span>
                <input
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: formatDecimalInput(event.target.value),
                    }))
                  }
                  inputMode="decimal"
                  style={inputStyle}
                  placeholder="0.00"
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Fecha del abono</span>
                <input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paidAt: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Método</span>
                <AppSelect
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentMethod: event.target.value as PaymentMethod,
                    }))
                  }
                >
                  <option value="">Selecciona un método</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="depósito">Depósito</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </AppSelect>
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Referencia</span>
                <input
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      reference: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="Transferencia, folio o comentario corto"
                />
              </label>
            </div>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Notas</span>
              <textarea
                value={paymentForm.notes}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                style={textareaStyle}
                placeholder="Notas internas del abono"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!savingPayment) setPaymentRecordId(null);
                }}
                style={ghostButtonStyle}
              >
                Cancelar
              </button>

              <UiButton onClick={handleSavePayment} icon={<Plus size={16} />}>
                {savingPayment ? "Guardando..." : "Guardar abono"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

const quickSectionTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#111827",
};

const quickSectionTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6B7280",
};

const filterLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cellPrimaryStyle: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 700,
};

const cellPrimaryStrongStyle: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 800,
};

const cellSecondaryStyle: CSSProperties = {
  fontSize: 12,
  color: "#6B7280",
};

const tableActionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const tablePrimaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#1D4ED8",
  fontSize: 12,
  fontWeight: 700,
};

const collectionHeaderGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1.05fr) minmax(0, 1.35fr) minmax(0, 0.82fr) minmax(0, 0.92fr) minmax(0, 0.96fr) minmax(0, 0.92fr)",
  gap: 12,
  padding: "0 8px 2px",
  width: "100%",
};

const collectionBodyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1.05fr) minmax(0, 1.35fr) minmax(0, 0.82fr) minmax(0, 0.92fr) minmax(0, 0.96fr) minmax(0, 0.92fr)",
  gap: 12,
  alignItems: "center",
  width: "100%",
};

const collectionRowCardStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 12,
  borderRadius: 20,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  width: "100%",
  overflow: "hidden",
};

const headerCellWrapStyle: CSSProperties = {
  display: "grid",
  gap: 2,
};

const headerPrimaryTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  lineHeight: 1.1,
};

const headerSecondaryTextStyle: CSSProperties = {
  fontSize: 9,
  color: "#9CA3AF",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  lineHeight: 1.1,
};

const conceptCellWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const chargeIconWrapStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  background: "#EEF2FF",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const rowTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
  lineHeight: 1.15,
  wordBreak: "break-word",
};

const detailToggleButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#2563EB",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  width: "fit-content",
};

const rowTwoLineCellStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  alignContent: "center",
  minWidth: 0,
};

const rowSingleCellStyle: CSSProperties = {
  display: "grid",
  alignContent: "center",
  minWidth: 0,
};

const rowPrimaryTextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#111827",
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const rowSecondaryTextStyle: CSSProperties = {
  fontSize: 11,
  color: "#6B7280",
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const rowMoneyPrimaryStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
};

const expandedRowWrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingTop: 16,
  borderTop: "1px solid #E5E7EB",
};

const inlineActionRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const actionBaseButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid transparent",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const inlineGreenButtonStyle: CSSProperties = {
  ...actionBaseButtonStyle,
  background: "#16A34A",
  borderColor: "#15803D",
  color: "#FFFFFF",
};

const inlineBlueButtonStyle: CSSProperties = {
  ...actionBaseButtonStyle,
  background: "#2563EB",
  borderColor: "#1D4ED8",
  color: "#FFFFFF",
};

const inlineRedButtonStyle: CSSProperties = {
  ...actionBaseButtonStyle,
  background: "#DC2626",
  borderColor: "#B91C1C",
  color: "#FFFFFF",
};

const smallGhostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #FECACA",
  background: "#FEF2F2",
};

const fieldHelperStyle: CSSProperties = {
  fontSize: 12,
  color: "#6B7280",
  lineHeight: 1.5,
};

const detailTopGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const detailBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
};

const detailLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const detailSectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 10,
};

const detailSectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const notesBoxStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: 12,
  fontSize: 13,
  color: "#4B5563",
  lineHeight: 1.6,
};

const emptyInlineBoxStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px dashed #D1D5DB",
  background: "#F9FAFB",
  padding: 14,
  fontSize: 13,
  color: "#6B7280",
};

const detailListWrapStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const detailListItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
};

const invoiceIconWrapStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "#EEF2FF",
  color: "#4338CA",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const paymentSummaryCardStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: 14,
};

const paymentSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const simpleFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
  resize: "vertical",
};

const toggleCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#F9FAFB",
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.5,
};

const oneTimeInfoStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#1D4ED8",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.6,
};

const ghostButtonStyle: CSSProperties = {
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
};