"use client";

/*
  Módulo de Compras — órdenes de compra (OC).

  Tablas esperadas en Supabase:

    purchase_orders
      id uuid PK, company_id uuid,
      folio text,                               -- OC-YYYY-NNNN
      supplier_id uuid → suppliers,
      maintenance_log_id uuid NULL → maintenance_logs (si viene de ticket),
      building_id uuid NULL → buildings,
      project_description text NULL,
      responsible_name text NULL,               -- quien recoge
      responsible_phone text NULL,
      signer_name text NULL,                    -- quien firma
      status text,                              -- pending | sent | received | cancelled
      total_estimated numeric NULL,
      notes text NULL,
      created_at, updated_at, deleted_at

    purchase_order_items
      id uuid PK, purchase_order_id uuid → purchase_orders,
      description text, quantity numeric, unit text,
      unit_price numeric NULL,
      created_at, deleted_at
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit3,
  ExternalLink,
  FileText,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  Wrench,
  XCircle,
} from "lucide-react";

import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { formatDateLong, formatDateMedium } from "@/lib/dateUtils";
import { type PurchaseReturn, RETURN_REASON_LABEL } from "@/lib/types";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { renderPurchaseOrderPage, prepareLogoForPDF } from "@/app/maintenance/page";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import ReturnModal from "@/components/ReturnModal";
import AppFormField from "@/components/AppFormField";

/* ── Types ─────────────────────────────────────────────────────── */

type Status = "draft" | "pending" | "sent" | "partial" | "received" | "invoiced" | "cancelled";

type SupplierBranchOption = {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
};

type SupplierOption = {
  id: string;
  name: string;
  prefix?: string | null;
  tax_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  client_number: string | null;
  cfdi_use: string | null;
  branches: SupplierBranchOption[];
};

type Signer = {
  id: string;
  name: string;
  is_default: boolean;
};

interface FieldUser {
  id: string;
  full_name: string;
  email: string;
}

type BuildingOption = {
  id: string;
  name: string;
  address: string | null;
};

type POItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  quantity_received?: number | null;
};

type PurchaseOrder = {
  id:                   string;
  folio:                string;
  supplier_id:          string;
  supplier_branch_id:   string | null;
  supplier_prefix:      string | null;
  maintenance_log_id:   string | null;
  building_id:          string | null;
  project_description:  string | null;
  responsible_name:     string | null;
  responsible_phone:    string | null;
  responsible_user_id:  string | null;
  signer_name:          string | null;
  status:               Status;
  notes:                string | null;
  total_estimated:      number | null;
  pdf_url:              string | null;
  sent_at:              string | null;
  created_at:           string;
  parent_order_id:      string | null;
  returns?:             PurchaseReturn[];
  /* Derivados */
  supplier_name?:       string;
  ticket_number?:       string | null;
  building_name?:       string | null;
  item_count?:          number;
};

type ItemDraft = {
  description: string;
  quantity:    string;        /* string mientras el usuario escribe */
  unit:        string;
  unit_price:  string;
};

const STATUS_LABEL: Record<Status, string> = {
  draft:     "Borrador",
  pending:   "Pendiente firma",
  sent:      "Enviada",
  partial:   "Surtido parcial",
  received:  "Completada",
  invoiced:  "Facturada",
  cancelled: "Cancelada",
};

const STATUS_FILTERS: { value: "ALL" | Status; label: string; color: string; bg: string }[] = [
  { value: "ALL",       label: "Todos",            color: "#6b7280", bg: "#f3f4f6" },
  { value: "draft",     label: "Borrador",          color: "#6b7280", bg: "#f3f4f6" },
  { value: "pending",   label: "Pendiente firma",   color: "#d97706", bg: "#fffbeb" },
  { value: "sent",      label: "Enviada",           color: "#2563eb", bg: "#eff6ff" },
  { value: "partial",   label: "Surtido parcial",   color: "#d97706", bg: "#fffbeb" },
  { value: "received",  label: "Completada",        color: "#16a34a", bg: "#f0fdf4" },
  { value: "invoiced",  label: "Facturada",         color: "#7c3aed", bg: "#f5f3ff" },
  { value: "cancelled", label: "Cancelada",         color: "#dc2626", bg: "#fef2f2" },
];

type StatusVariantValue = "amber" | "blue" | "green" | "red" | "gray" | "purple";
const STATUS_VARIANT: Record<Status, StatusVariantValue> = {
  draft:     "gray",
  pending:   "amber",
  sent:      "blue",
  partial:   "amber",
  received:  "green",
  invoiced:  "purple",
  cancelled: "red",
};

// AppBadge no tiene "purple" como variant — fallback con colores custom.
function getStatusBadgeProps(s: Status): { variant?: "amber" | "blue" | "green" | "red" | "gray"; backgroundColor?: string; textColor?: string; borderColor?: string } {
  const v = STATUS_VARIANT[s];
  if (v === "purple") {
    return { backgroundColor: "#f3e8ff", textColor: "#7c3aed", borderColor: "#a855f7" };
  }
  return { variant: v };
}

const UNITS = ["Pieza", "Metro", "Litro", "Tubo", "Caja", "Rollo", "Bolsa", "Otro"];

const MONTH_LABELS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const EMPTY_ITEM: ItemDraft = { description: "", quantity: "1", unit: "Pieza", unit_price: "" };

const itemDraftSchema = z.object({
  description: z.string(),
  quantity:    z.string(),
  unit:        z.string(),
  unit_price:  z.string(),
});

const manualFormSchema = z.object({
  supplierId:         z.string().min(1, "Selecciona un proveedor"),
  supplierBranchId:   z.string().optional(),
  buildingId:         z.string().optional(),
  projectDescription: z.string().optional(),
  responsibleName:    z.string().optional(),
  responsiblePhone:   z.string().optional(),
  responsibleUserId:  z.string().optional(),
  signerName:         z.string().optional(),
  items: z
    .array(itemDraftSchema)
    .refine(
      (items) =>
        items.some(
          (it) => it.description.trim() !== "" && Number(it.quantity) > 0,
        ),
      { message: "Agrega al menos un material válido" },
    ),
});
type ManualFormValues = z.infer<typeof manualFormSchema>;

const EMPTY_MANUAL_FORM: ManualFormValues = {
  supplierId: "", supplierBranchId: "", buildingId: "", projectDescription: "",
  responsibleName: "", responsiblePhone: "", responsibleUserId: "", signerName: "",
  items: [{ ...EMPTY_ITEM }],
};

const purchasesErrorTextStyle: CSSProperties = {
  color: "#EF4444",
  fontSize: 12,
  marginTop: 4,
  marginBottom: 0,
};

/* ── Component ─────────────────────────────────────────────────── */

export default function PurchasesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const { legalName, companyAddress, companyTaxId, companyPhone, companyEmail, companyZipCode, logoGroupUrl, purchasesContactPhone, purchasesContactEmail } = useTheme();

  const [orders,     setOrders]     = useState<PurchaseOrder[]>([]);
  const [suppliers,  setSuppliers]  = useState<SupplierOption[]>([]);
  const [buildings,  setBuildings]  = useState<BuildingOption[]>([]);
  const [signers,    setSigners]    = useState<Signer[]>([]);
  const [customSignerMode, setCustomSignerMode] = useState(false);
  const [fieldUsers, setFieldUsers] = useState<FieldUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLogoPrint, setCompanyLogoPrint] = useState("");
  const [companyLogoUrl,   setCompanyLogoUrl]   = useState("");
  const [companyInitials, setCompanyInitials]   = useState("");

  /* Filtros */
  const [filterSupplier, setFilterSupplier] = useState("ALL");
  const [filterStatus,   setFilterStatus]   = useState<"ALL" | Status>("ALL");
  const [search,         setSearch]         = useState("");

  /* Vista por mes (igual que /collections) */
  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  /* Combobox de proveedor */
  const [supplierSearch,       setSupplierSearch]       = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  /* Subida de PDF firmado */
  const [uploadingId,   setUploadingId]   = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  /* Expansión inline de OC */
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [itemsByOrderId,  setItemsByOrderId]  = useState<Record<string, POItem[]>>({});
  const [loadingItemsFor, setLoadingItemsFor] = useState<string | null>(null);

  /* Progreso del ticket ligado a la OC */
  type TicketProgress = { itemTotal: number; itemReceived: number };
  const [ticketProgress,     setTicketProgress]     = useState<Record<string, TicketProgress | null>>({});
  const [loadingProgressFor, setLoadingProgressFor] = useState<Record<string, boolean>>({});

  /* Confirmación de cancelación */
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<PurchaseOrder | null>(null);
  const [returnTarget, setReturnTarget] = useState<PurchaseOrder | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ number: "", amount: "", date: "", notes: "" });
  const [savingInvoice, setSavingInvoice] = useState(false);

  /* XML factura */
  type XmlConcepto = { descripcion: string; cantidad: string; valorUnitario: string; importe: string };
  const [xmlConceptos,    setXmlConceptos]    = useState<XmlConcepto[]>([]);
  const [xmlRfcEmisor,    setXmlRfcEmisor]    = useState("");
  const [xmlNombreEmisor, setXmlNombreEmisor] = useState("");
  const [xmlUploaded,     setXmlUploaded]     = useState(false);
  const xmlFileInputRef = useRef<HTMLInputElement>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState(false);

  /* Modal crear / editar */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrderId,  setEditingOrderId]  = useState<string | null>(null);
  const saveAsPendingRef = useRef(false);

  /* Form manual */
  const {
    register,
    handleSubmit: rhfSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ManualFormValues>({
    resolver: zodResolver(manualFormSchema),
    defaultValues: EMPTY_MANUAL_FORM,
  });
  const { fields: itemFields, append: appendItem, remove: removeItemField, update: updateItemField } = useFieldArray({
    control,
    name: "items",
  });
  const manualSupplierId       = watch("supplierId");
  const manualSupplierBranchId = watch("supplierBranchId");
  const manualSignerName       = watch("signerName");
  const manualItems            = watch("items");

  const [formError, setFormError] = useState("");

  /* PDF loading state */
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  /* ── Load ──────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!userLoading && user?.company_id) void loadAll(user.company_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user]);

  async function loadAll(companyId: string) {
    setLoading(true);
    setMsg("");

    const [
      { data: ocData,      error: ocError },
      { data: itemsData                    },
      { data: supplierData                 },
      { data: buildingData                 },
      { data: companyData                  },
      { data: signerData                   },
      { data: fieldUserData, error: fieldUserError },
    ] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(`
          id, folio, status, created_at, company_id,
          total_estimated, notes, project_description,
          responsible_name, responsible_phone, responsible_user_id, signer_name,
          maintenance_log_id, building_id,
          supplier_id, supplier_branch_id, supplier_prefix,
          pdf_url, sent_at, parent_order_id,
          suppliers(id, name, contact_email, contact_phone, tax_id),
          buildings(id, name)
        `)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("purchase_order_items")
        .select("id, purchase_order_id, description, quantity, unit, unit_price, quantity_received")
        .is("deleted_at", null),

      supabase
        .from("suppliers")
        .select(`
          id, name, prefix, tax_id, contact_name, contact_email, contact_phone,
          client_number, cfdi_use,
          supplier_branches(id, name, address, email, phone, active)
        `)
        .eq("company_id", companyId)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true }),

      supabase
        .from("buildings")
        .select("id, name, address")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),

      supabase
        .from("companies")
        .select("name, logo_url, logo_print_url, initials")
        .eq("id", companyId)
        .single(),

      supabase
        .from("purchase_order_signers")
        .select("id, name, is_default")
        .eq("company_id", companyId)
        .eq("role", "signer")
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),

      supabase
        .from("app_users")
        .select("id, full_name, email")
        .eq("company_id", companyId)
        .in("role", ["field", "mantenimiento"])
        .order("full_name", { ascending: true }),
    ]);

    if (ocError) {
      console.error("loadAll purchase_orders error:", ocError);
      setMsg(`No se pudieron cargar las órdenes de compra: ${ocError.message}`);
      setOrders([]);
      setLoading(false);
      return;
    }

    type OCRow = {
      id: string; folio: string; supplier_id: string;
      supplier_branch_id: string | null;
      supplier_prefix: string | null;
      maintenance_log_id: string | null; building_id: string | null;
      project_description: string | null;
      responsible_name: string | null; responsible_phone: string | null;
      responsible_user_id: string | null;
      signer_name: string | null;
      status: Status; notes: string | null; total_estimated: number | null;
      pdf_url: string | null; sent_at: string | null;
      created_at: string;
      parent_order_id: string | null;
      suppliers: { id: string; name: string; contact_email: string | null; contact_phone: string | null; tax_id: string | null } | null;
      buildings: { id: string; name: string } | null;
    };

    /* Sumar conteo de items por OC (fallback de total si DB no lo guarda) */
    type ItemRow = { purchase_order_id: string; quantity: number; unit_price: number | null };
    const itemsByOc = new Map<string, { total: number; count: number }>();
    ((itemsData || []) as ItemRow[]).forEach((it) => {
      const entry = itemsByOc.get(it.purchase_order_id) || { total: 0, count: 0 };
      entry.count += 1;
      if (it.unit_price != null) entry.total += Number(it.quantity || 0) * Number(it.unit_price);
      itemsByOc.set(it.purchase_order_id, entry);
    });

    /* Fetch de ticket_numbers para los maintenance_log_ids presentes */
    const ocRows = ((ocData || []) as unknown as OCRow[]);
    const mlIds  = Array.from(new Set(
      ocRows.map(r => r.maintenance_log_id).filter((x): x is string => Boolean(x))
    ));
    let ticketMap = new Map<string, string | null>();
    if (mlIds.length > 0) {
      const { data: mlData } = await supabase
        .from("maintenance_logs")
        .select("id, ticket_number")
        .in("id", mlIds);
      ticketMap = new Map(
        ((mlData || []) as { id: string; ticket_number: string | null }[])
          .map(m => [m.id, m.ticket_number])
      );
    }

    const enriched: PurchaseOrder[] = ocRows.map((r) => {
      const agg = itemsByOc.get(r.id);
      return {
        id:                   r.id,
        folio:                r.folio,
        supplier_id:          r.supplier_id,
        supplier_branch_id:   r.supplier_branch_id,
        supplier_prefix:      r.supplier_prefix,
        maintenance_log_id:   r.maintenance_log_id,
        building_id:          r.building_id,
        project_description:  r.project_description,
        responsible_name:     r.responsible_name,
        responsible_phone:    r.responsible_phone,
        responsible_user_id:  r.responsible_user_id,
        signer_name:          r.signer_name,
        status:               r.status,
        notes:                r.notes,
        total_estimated:      r.total_estimated ?? (agg?.total || 0),
        pdf_url:              r.pdf_url,
        sent_at:              r.sent_at,
        created_at:           r.created_at,
        parent_order_id:      r.parent_order_id ?? null,
        supplier_name:        r.suppliers?.name,
        ticket_number:        r.maintenance_log_id ? ticketMap.get(r.maintenance_log_id) ?? null : null,
        building_name:        r.buildings?.name,
        item_count:           agg?.count || 0,
      };
    });

    setOrders(enriched);

    /* CAMBIO 2 — Cargar devoluciones y adjuntarlas a las OCs */
    const orderIds = enriched.map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: returnsData } = await supabase
        .from("purchase_returns")
        .select("id, company_id, purchase_order_id, reason, reason_notes, photo_url, created_by, created_at, deleted_at, items:purchase_return_items(id, return_id, purchase_order_item_id, quantity_returned)")
        .in("purchase_order_id", orderIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (returnsData && returnsData.length > 0) {
        setOrders((prev) =>
          prev.map((o) => ({
            ...o,
            returns: (returnsData as PurchaseReturn[]).filter((r) => r.purchase_order_id === o.id),
          }))
        );
      }
    }

    type SupplierRow = {
      id: string; name: string; prefix: string | null; tax_id: string | null;
      contact_name: string | null; contact_email: string | null; contact_phone: string | null;
      client_number: string | null; cfdi_use: string | null;
      supplier_branches: Array<SupplierBranchOption & { active: boolean }> | null;
    };
    const suppliersMapped: SupplierOption[] = ((supplierData || []) as unknown as SupplierRow[]).map((s) => ({
      id:            s.id,
      name:          s.name,
      prefix:        s.prefix,
      tax_id:        s.tax_id,
      contact_name:  s.contact_name,
      contact_email: s.contact_email,
      contact_phone: s.contact_phone,
      client_number: s.client_number,
      cfdi_use:      s.cfdi_use,
      branches: (s.supplier_branches || [])
        .filter((b) => b.active)
        .map((b) => ({ id: b.id, name: b.name, address: b.address, email: b.email, phone: b.phone }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    setSuppliers(suppliersMapped);
    setBuildings((buildingData as BuildingOption[]) || []);
    setSigners((signerData as Signer[]) || []);
    console.log("fieldUsers raw:", fieldUserData, "error:", fieldUserError);
    setFieldUsers((fieldUserData as FieldUser[]) || []);

    if (companyData && "name" in companyData) {
      const cd = companyData as { name: string; logo_url?: string; logo_print_url?: string; initials?: string };
      setCompanyName(cd.name || "");
      setCompanyLogoUrl(cd.logo_url || "");
      setCompanyLogoPrint(cd.logo_print_url || "");
      /* Fallback: 2 primeras letras del nombre si no hay iniciales en DB */
      const fallbackInitials = (cd.name || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
      setCompanyInitials((cd.initials || fallbackInitials || "CO").toUpperCase());
    }

    setLoading(false);
  }

  /* ── Metrics ───────────────────────────────────────────────────── */

  const metrics = useMemo(() => {
    const byMonth = orders.filter((o) => {
      const d = new Date(o.created_at);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    const total     = byMonth.length;
    const draft     = byMonth.filter(o => o.status === "draft").length;
    const pending   = byMonth.filter(o => o.status === "pending").length;
    const sent      = byMonth.filter(o => o.status === "sent").length;
    const partial   = byMonth.filter(o => o.status === "partial").length;
    const received  = byMonth.filter(o => o.status === "received").length;
    const invoiced  = byMonth.filter(o => o.status === "invoiced").length;
    const cancelled = byMonth.filter(o => o.status === "cancelled").length;
    return { total, draft, pending, sent, partial, received, invoiced, cancelled };
  }, [orders, selectedMonth, selectedYear]);

  /* ── Supplier combobox — lista filtrada por el search ──────────── */
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  /* ── Navegación de mes ─────────────────────────────────────────── */

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedYear((y) => y - 1); setSelectedMonth(12); }
    else setSelectedMonth((m) => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedYear((y) => y + 1); setSelectedMonth(1); }
    else setSelectedMonth((m) => m + 1);
  }

  /* ── Filter ────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      /* Filtro por mes (created_at) */
      const d = new Date(o.created_at);
      if (d.getFullYear() !== selectedYear || d.getMonth() + 1 !== selectedMonth) return false;

      if (filterSupplier !== "ALL" && o.supplier_id !== filterSupplier) return false;
      if (filterStatus   !== "ALL" && o.status !== filterStatus) return false;
      if (q) {
        const hay = [
          o.folio,
          o.supplier_name || "",
          o.project_description || "",
          o.ticket_number || "",
          o.building_name || "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterSupplier, filterStatus, search, selectedYear, selectedMonth]);

  /* ── Folio generation ──────────────────────────────────────────── */

  /* Prefijo del proveedor: usa supplier.prefix si existe; si no, las 2 primeras letras del nombre */
  function computeSupplierPrefix(s: SupplierOption | undefined): string {
    if (s?.prefix && s.prefix.trim()) return s.prefix.trim().toUpperCase();
    const clean = (s?.name || "").replace(/[^A-Za-z]/g, "");
    return (clean.slice(0, 2).toUpperCase() || "XX");
  }

  /* Folio compuesto: {companyInitials}-{supplierPrefix}-{YYYY}-{NNNN}
     NNNN es correlativo por company+year (sin importar proveedor). */
  /* Folio correlativo por proveedor: {CI}-{SP}-{YYYY}-{NNNN} */
  async function generateNextFolio(
    companyId: string,
    companyInitials: string,
    supplierPrefix: string,
  ): Promise<string> {
    const year    = new Date().getFullYear();
    const pattern = `${companyInitials}-${supplierPrefix}-${year}-%`;

    const { data } = await supabase
      .from("purchase_orders")
      .select("folio")
      .eq("company_id", companyId)
      .ilike("folio", pattern)
      .is("deleted_at", null);

    let maxNum = 0;
    if (data && data.length > 0) {
      (data as { folio: string }[]).forEach((row) => {
        const parts = row.folio.split("-");
        const num   = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
    }

    const nextNum = String(maxNum + 1).padStart(4, "0");
    return `${companyInitials}-${supplierPrefix}-${year}-${nextNum}`;
  }

  /* ── Create manual OC ──────────────────────────────────────────── */

  function openCreateModal() {
    const defaultSigner = signers.find((s) => s.is_default)?.name || "";
    reset({ ...EMPTY_MANUAL_FORM, signerName: defaultSigner });
    setFormError("");
    setCustomSignerMode(false);
    setSupplierSearch("");
    setShowSupplierDropdown(false);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setEditingOrderId(null);
    reset(EMPTY_MANUAL_FORM);
    setFormError("");
    setCustomSignerMode(false);
    setSupplierSearch("");
    setShowSupplierDropdown(false);
  }

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    const current = manualItems[idx];
    if (!current) return;
    updateItemField(idx, { ...current, ...patch });
  }

  function addItem() {
    appendItem({ ...EMPTY_ITEM });
  }

  function removeItem(idx: number) {
    if (itemFields.length <= 1) return;
    removeItemField(idx);
  }

  const handleCreate = rhfSubmit(async (data) => {
    if (!user?.company_id) return;

    const validItems = data.items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0
    );
    if (validItems.length === 0) {
      setFormError("Agrega al menos un material válido.");
      return;
    }

    setFormError("");

    /* Prefijo del proveedor (persiste en la OC — se usa en folio y en lectura) */
    const selectedSupplier = suppliers.find((s) => s.id === data.supplierId);
    const supplierPrefix   = computeSupplierPrefix(selectedSupplier);

    const payload = {
      supplier_id:          data.supplierId,
      supplier_branch_id:   data.supplierBranchId || null,
      supplier_prefix:      supplierPrefix,
      building_id:          data.buildingId || null,
      project_description:  data.projectDescription?.trim() || null,
      responsible_name:     data.responsibleName?.trim()   || null,
      responsible_phone:    data.responsiblePhone?.trim()  || null,
      responsible_user_id:  data.responsibleUserId || null,
      signer_name:          data.signerName?.trim()        || null,
    };

    console.log("[purchases] manualForm snapshot:", data);
    console.log("[purchases] payload:", payload);
    console.log("[purchases] editingOrderId:", editingOrderId);

    let targetOrderId: string | null = null;

    if (editingOrderId) {
      /* EDITAR: UPDATE purchase_orders + DELETE+INSERT items */
      console.log("[purchases] UPDATE purchase_orders", { id: editingOrderId, payload });
      const updPayload = {
        ...payload,
        updated_at: new Date().toISOString(),
        ...(saveAsPendingRef.current ? { status: "pending" } : {}),
      };
      const { data: updData, error: updErr } = await supabase
        .from("purchase_orders")
        .update(updPayload)
        .eq("id", editingOrderId)
        .select();
      console.log("[purchases] UPDATE result:", { data: updData, error: updErr });
      if (updErr) {
        setFormError(`No se pudo actualizar: ${updErr.message}`);
        return;
      }
      targetOrderId = editingOrderId;

      /* Soft-delete items anteriores */
      const { data: delData, error: delErr } = await supabase
        .from("purchase_order_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("purchase_order_id", editingOrderId)
        .is("deleted_at", null)
        .select();
      console.log("[purchases] soft-delete items result:", { data: delData, error: delErr });
    } else {
      /* CREAR: generar folio compuesto + INSERT purchase_orders */
      const folio = await generateNextFolio(
        user.company_id,
        companyInitials || "CO",
        supplierPrefix,
      );
      const insertBody = {
        company_id: user.company_id,
        folio,
        status:     "pending",
        ...payload,
      };
      console.log("[purchases] INSERT purchase_orders:", insertBody);
      const { data: inserted, error: insertErr } = await supabase
        .from("purchase_orders")
        .insert(insertBody)
        .select("id")
        .single();
      console.log("[purchases] INSERT result:", { data: inserted, error: insertErr });
      if (insertErr || !inserted) {
        setFormError("No se pudo crear la orden de compra.");
        return;
      }
      targetOrderId = inserted.id;
    }

    const itemsPayload = validItems.map((it) => ({
      purchase_order_id: targetOrderId,
      description:       it.description.trim(),
      quantity:          Number(it.quantity),
      unit:              it.unit,
      unit_price:        it.unit_price.trim() ? Number(it.unit_price) : null,
    }));

    console.log("[purchases] INSERT purchase_order_items:", itemsPayload);
    const { data: itemsIns, error: itemsErr } = await supabase
      .from("purchase_order_items")
      .insert(itemsPayload)
      .select();
    console.log("[purchases] items INSERT result:", { data: itemsIns, error: itemsErr });

    /* Si es un firmante nuevo (no estaba en la lista), persistir para futuras OC */
    const trimmedSigner = data.signerName?.trim() || "";
    if (trimmedSigner) {
      const signerExists = signers.some(
        (s) => s.name.toLowerCase() === trimmedSigner.toLowerCase()
      );
      if (!signerExists) {
        const { data: signerIns, error: signerInsErr } = await supabase
          .from("purchase_order_signers")
          .insert({
            company_id: user.company_id,
            name:       trimmedSigner,
            is_default: false,
            role:       "signer",
          })
          .select();
        console.log("[purchases] new signer INSERT result:", { data: signerIns, error: signerInsErr });
      }
    }


    /* Refrescar items de la OC afectada (para que la vista expandida muestre los datos nuevos) */
    if (targetOrderId) {
      const tid = targetOrderId;
      const { data: freshItems } = await supabase
        .from("purchase_order_items")
        .select("id, description, quantity, unit, unit_price, quantity_received")
        .eq("purchase_order_id", tid)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      setItemsByOrderId((prev) => ({ ...prev, [tid]: (freshItems as POItem[]) || [] }));
    }

    const wasEdit        = !!editingOrderId;
    const markedPending  = wasEdit && saveAsPendingRef.current;
    closeCreateModal();
    setMsg(
      wasEdit
        ? (markedPending ? "OC guardada y marcada como Pendiente firma." : "Borrador guardado correctamente.")
        : "Orden de compra creada correctamente."
    );
    /* Recargar lista completa para refrescar conteos, total, signer_name, etc. */
    await loadAll(user.company_id);
  });

  /* ── Expand / load items ──────────────────────────────────────── */

  async function handleToggleExpand(order: PurchaseOrder) {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(order.id);

    /* Siempre traer items frescos desde Supabase al expandir */
    setLoadingItemsFor(order.id);
    const { data, error } = await supabase
      .from("purchase_order_items")
      .select("id, description, quantity, unit, unit_price, quantity_received")
      .eq("purchase_order_id", order.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[purchases] load items error:", error);
    }
    const rows = (data as POItem[]) || [];
    setItemsByOrderId((prev) => ({ ...prev, [order.id]: rows }));
    setLoadingItemsFor(null);

    if (order.maintenance_log_id) void loadTicketProgress(order);
  }

  /* ── Progreso del ticket ligado ─────────────────────────────── */

  async function loadTicketProgress(order: PurchaseOrder) {
    const mlId = order.maintenance_log_id;
    if (!mlId || ticketProgress[order.id] !== undefined) return;
    setLoadingProgressFor((p) => ({ ...p, [order.id]: true }));

    /* Paso 1 — traer todas las OCs del ticket con status confirmado desde DB
       (usamos DB en lugar de estado local para garantizar parent_order_id actualizado) */
    const { data: ticketOCsRaw } = await supabase
      .from("purchase_orders")
      .select("id, parent_order_id, status, folio")
      .eq("maintenance_log_id", mlId)
      .not("status", "in", "(draft,cancelled)")
      .is("deleted_at", null);

    type OCMini = { id: string; parent_order_id: string | null; status: string; folio: string };
    const ticketOCs = (ticketOCsRaw ?? []) as OCMini[];

    if (ticketOCs.length === 0) {
      setTicketProgress((p) => ({ ...p, [order.id]: { itemTotal: 0, itemReceived: 0 } }));
      setLoadingProgressFor((p) => ({ ...p, [order.id]: false }));
      return;
    }

    /* Paso 2 — IDs separados: raíces (para totalPedidas) vs todas (para totalSurtidas) */
    const allIds  = ticketOCs.map((o) => o.id);
    const rootIds = ticketOCs.filter((o) => o.parent_order_id === null).map((o) => o.id);

    const [rootItemsRes, allItemsRes] = await Promise.all([
      rootIds.length > 0
        ? supabase.from("purchase_order_items").select("quantity").in("purchase_order_id", rootIds).is("deleted_at", null)
        : Promise.resolve({ data: [] as { quantity: number }[] }),
      supabase.from("purchase_order_items").select("quantity_received").in("purchase_order_id", allIds).is("deleted_at", null),
    ]);

    let totalPedidas = 0;
    ((rootItemsRes.data ?? []) as { quantity: number }[]).forEach((it) => {
      totalPedidas += Number(it.quantity ?? 0);
    });
    let totalSurtidas = 0;
    ((allItemsRes.data ?? []) as { quantity_received: number | null }[]).forEach((it) => {
      totalSurtidas += Number(it.quantity_received ?? 0);
    });

    const totalPendientes = Math.max(0, totalPedidas - totalSurtidas);
    const porcentaje = totalPedidas > 0
      ? Math.min(100, Math.round((totalSurtidas / totalPedidas) * 100))
      : 0;

    setTicketProgress((p) => ({ ...p, [order.id]: { itemTotal: totalPedidas, itemReceived: totalSurtidas } }));
    setLoadingProgressFor((p) => ({ ...p, [order.id]: false }));
  }

  /* ── Crear OC borrador por faltantes ────────────────────────── */

  async function createOCForFaltantes(order: PurchaseOrder) {
    if (!user?.company_id) return;

    /* FIX 3 — Si ya existe una OC hija en draft, navegar a ella en vez de crear otra */
    const existingChild = orders.find(
      (ord) => ord.parent_order_id === order.id && ord.status === "draft"
    );
    if (existingChild) {
      setSearch(existingChild.folio);
      setExpandedOrderId(existingChild.id);
      const vMatch = existingChild.folio.match(/-V(\d+)$/);
      const vNum = vMatch ? vMatch[1] : "?";
      toast(`Ya existe una V${vNum} en borrador: ${existingChild.folio}`);
      return;
    }

    const items = itemsByOrderId[order.id] ?? [];
    const faltanteItems = items.filter(
      (it) => it.quantity_received != null && it.quantity_received < it.quantity
    );
    if (faltanteItems.length === 0) {
      toast.error("No hay faltantes registrados en esta OC.");
      return;
    }

    /* Determinar el folio raíz: quitar sufijo -Vn si existe (por si la OC ya es versión
       o si el parent no está en memoria). */
    const rawRoot = order.parent_order_id
      ? orders.find((o) => o.id === order.parent_order_id)?.folio ?? order.folio
      : order.folio;
    const rootFolio = rawRoot.replace(/-V\d+$/, "");

    /* Buscar versiones existentes para determinar el siguiente número */
    const versionPattern = `${rootFolio}-V%`;
    const { data: existingVersions } = await supabase
      .from("purchase_orders")
      .select("folio")
      .eq("company_id", user.company_id)
      .ilike("folio", versionPattern)
      .is("deleted_at", null);

    let maxVersion = 1;
    (existingVersions ?? []).forEach((row: { folio: string }) => {
      const match = row.folio.match(/-V(\d+)$/);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v > maxVersion) maxVersion = v;
      }
    });
    const nextVersion = maxVersion + 1;
    const newFolio = `${rootFolio}-V${nextVersion}`;

    const nowIso = new Date().toISOString();
    const { data: newOC, error } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: user.company_id,
        folio: newFolio,
        supplier_id: order.supplier_id,
        supplier_branch_id: order.supplier_branch_id,
        supplier_prefix: order.supplier_prefix,
        maintenance_log_id: order.maintenance_log_id,
        building_id: order.building_id,
        status: "draft",
        project_description: `Reposición de faltantes de ${order.folio}`,
        responsible_user_id: order.responsible_user_id,
        responsible_name: order.responsible_name,
        responsible_phone: order.responsible_phone,
        signer_name: order.signer_name,
        parent_order_id: order.parent_order_id ?? order.id,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (error || !newOC) {
      toast.error("No se pudo crear la OC por faltantes.");
      return;
    }
    await supabase.from("purchase_order_items").insert(
      faltanteItems.map((fi) => ({
        purchase_order_id: (newOC as { id: string }).id,
        description: fi.description,
        quantity: fi.quantity - (fi.quantity_received ?? 0),
        unit: fi.unit,
        created_at: nowIso,
      }))
    );
    void loadAll(user.company_id);
    toast.success(`Borrador creado: ${newFolio}`);
  }

  /* ── Cancelar OC (con confirmación) ──────────────────────────── */

  async function handleCancelOrder() {
    if (!user?.company_id || !cancelTarget) return;
    setCancelling(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("id", cancelTarget.id);
    setCancelling(false);
    if (error) {
      setMsg(`No se pudo cancelar la OC: ${error.message}`);
      return;
    }
    setOrders((prev) => prev.map((o) =>
      o.id === cancelTarget.id ? { ...o, status: "cancelled" as Status } : o
    ));
    setMsg(`OC ${cancelTarget.folio} cancelada correctamente.`);
    setCancelTarget(null);
  }

  /* ── Cascada de completado hacia la OC madre ────────────────── */

  async function completeParentChain(currentOrderId: string): Promise<void> {
    const current = orders.find((o) => o.id === currentOrderId);
    const parentId = current?.parent_order_id;
    if (!parentId) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "received", received_at: nowIso, updated_at: nowIso })
      .eq("id", parentId)
      .neq("status", "received");
    if (!error) {
      setOrders((prev) =>
        prev.map((o) => o.id === parentId ? { ...o, status: "received" as Status } as PurchaseOrder : o)
      );
      await completeParentChain(parentId);
    }
  }

  /* ── Cambio de status: marcar recibida / parcial ─────────────── */

  async function markStatus(order: PurchaseOrder, status: Status) {
    setUpdatingStatusId(order.id);
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: nowIso };
    if (status === "received") patch.received_at = nowIso;
    const { error } = await supabase.from("purchase_orders").update(patch).eq("id", order.id);
    if (error) {
      console.error("purchase_orders status update failed", error);
      toast.error("No se pudo actualizar el estado.");
      setUpdatingStatusId(null);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status, ...(status === "received" ? { received_at: nowIso } : {}) } as PurchaseOrder : o)));
    /* Cascada hacia la madre cuando se completa */
    if (status === "received") await completeParentChain(order.id);
    /* Invalidar caché de progreso — las OCs del mismo ticket deben recalcular */
    if (order.maintenance_log_id) {
      const mlId = order.maintenance_log_id;
      setTicketProgress((prev) => {
        const next = { ...prev };
        orders
          .filter((ord) => ord.maintenance_log_id === mlId)
          .forEach((ord) => { delete next[ord.id]; });
        return next;
      });
    }
    const labels: Record<Status, string> = {
      draft: "como borrador",
      pending: "por enviar",
      sent: "enviada",
      partial: "surtido parcial",
      received: "completada",
      invoiced: "facturada",
      cancelled: "cancelada",
    };
    toast.success(`OC marcada ${labels[status]}.`);
    setUpdatingStatusId(null);
  }

  /* ── Registrar factura ───────────────────────────────────────── */

  async function saveInvoice() {
    if (!invoiceTarget) return;
    const num = invoiceForm.number.trim();
    const amt = parseFloat(invoiceForm.amount);
    const date = invoiceForm.date.trim();
    if (!num || !isFinite(amt) || amt <= 0 || !date) {
      toast.error("Completa número, monto y fecha de factura.");
      return;
    }
    setSavingInvoice(true);

    // Preservar notas previas intentando parsearlas como JSON.
    let existing: Record<string, unknown> = {};
    if (invoiceTarget.notes) {
      try {
        const parsed = JSON.parse(invoiceTarget.notes);
        if (parsed && typeof parsed === "object") existing = parsed as Record<string, unknown>;
        else existing = { text: invoiceTarget.notes };
      } catch {
        existing = { text: invoiceTarget.notes };
      }
    }

    const invoicePayload: Record<string, unknown> = {
      number: num,
      amount: amt,
      date,
      notes: invoiceForm.notes.trim() || null,
    };
    if (xmlUploaded) {
      invoicePayload.rfc_emisor     = xmlRfcEmisor;
      invoicePayload.nombre_emisor  = xmlNombreEmisor;
      invoicePayload.conceptos      = xmlConceptos;
      invoicePayload.xml_uploaded   = true;
    }
    const newNotes = JSON.stringify({ ...existing, invoice: invoicePayload });

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "invoiced", notes: newNotes, updated_at: nowIso })
      .eq("id", invoiceTarget.id);
    if (error) {
      console.error("invoice save failed", error);
      toast.error("No se pudo guardar la factura.");
      setSavingInvoice(false);
      return;
    }
    setOrders((prev) => prev.map((o) =>
      o.id === invoiceTarget.id ? { ...o, status: "invoiced" as Status, notes: newNotes } : o
    ));
    toast.success("Factura registrada.");
    setInvoiceTarget(null);
    setInvoiceForm({ number: "", amount: "", date: "", notes: "" });
    resetXmlState();
    setSavingInvoice(false);
  }

  function resetXmlState() {
    setXmlConceptos([]);
    setXmlRfcEmisor("");
    setXmlNombreEmisor("");
    setXmlUploaded(false);
  }

  function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/xml");
        if (doc.querySelector("parsererror")) {
          toast.error("El archivo XML no es válido.");
          return;
        }
        const root = doc.documentElement;
        const fecha   = root.getAttribute("Fecha") ?? "";
        const total   = root.getAttribute("Total") ?? "";
        const folio   = root.getAttribute("Folio") ?? "";
        const serie   = root.getAttribute("Serie") ?? "";

        const getFirst = (name: string): Element | null => {
          for (const ns of [
            "http://www.sat.gob.mx/cfd/4",
            "http://www.sat.gob.mx/cfd/3",
          ]) {
            const els = doc.getElementsByTagNameNS(ns, name);
            if (els.length > 0) return els[0];
          }
          const plain = doc.getElementsByTagName(name);
          return plain.length > 0 ? plain[0] : null;
        };

        const getAll = (name: string): Element[] => {
          for (const ns of [
            "http://www.sat.gob.mx/cfd/4",
            "http://www.sat.gob.mx/cfd/3",
          ]) {
            const els = doc.getElementsByTagNameNS(ns, name);
            if (els.length > 0) return Array.from(els);
          }
          return Array.from(doc.getElementsByTagName(name));
        };

        const emisor        = getFirst("Emisor");
        const rfcEmisor     = emisor?.getAttribute("Rfc") ?? "";
        const nombreEmisor  = emisor?.getAttribute("Nombre") ?? "";

        const conceptos = getAll("Concepto").map((c) => ({
          descripcion:   c.getAttribute("Descripcion")   ?? "",
          cantidad:      c.getAttribute("Cantidad")      ?? "",
          valorUnitario: c.getAttribute("ValorUnitario") ?? "",
          importe:       c.getAttribute("Importe")       ?? "",
        }));

        const facturaNum = [serie, folio].filter(Boolean).join("") || "";
        const fechaDate  = fecha.substring(0, 10);

        setInvoiceForm((f) => ({
          ...f,
          number: facturaNum || f.number,
          amount: total      || f.amount,
          date:   fechaDate  || f.date,
        }));
        setXmlConceptos(conceptos);
        setXmlRfcEmisor(rfcEmisor);
        setXmlNombreEmisor(nombreEmisor);
        setXmlUploaded(true);
        toast.success("XML procesado correctamente.");
      } catch {
        toast.error("No se pudo procesar el XML.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  // Parsear metadata de factura guardada en notes (JSON)
  type InvoiceMeta = {
    number?: string;
    amount?: number;
    date?: string;
    notes?: string | null;
    rfc_emisor?: string;
    nombre_emisor?: string;
  };

  function getInvoiceMeta(o: PurchaseOrder): InvoiceMeta | null {
    if (!o.notes) return null;
    try {
      const parsed = JSON.parse(o.notes);
      if (parsed && typeof parsed === "object" && "invoice" in parsed) {
        return (parsed as { invoice: InvoiceMeta }).invoice;
      }
    } catch { /* notes es texto plano */ }
    return null;
  }

  /* ── Editar OC: abrir modal con datos precargados ─────────────── */

  async function handleStartEditOrder(order: PurchaseOrder) {
    /* Cargar items si aún no están */
    let items: POItem[] = itemsByOrderId[order.id] || [];
    if (!itemsByOrderId[order.id]) {
      const { data } = await supabase
        .from("purchase_order_items")
        .select("id, description, quantity, unit, unit_price, quantity_received")
        .eq("purchase_order_id", order.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      items = (data as POItem[]) || [];
      setItemsByOrderId((prev) => ({ ...prev, [order.id]: items }));
    }

    setEditingOrderId(order.id);
    reset({
      supplierId:          order.supplier_id,
      supplierBranchId:    order.supplier_branch_id || "",
      buildingId:          order.building_id || "",
      projectDescription:  order.project_description || "",
      responsibleName:     order.responsible_name   || "",
      responsiblePhone:    order.responsible_phone  || "",
      responsibleUserId:   order.responsible_user_id || "",
      signerName:          order.signer_name        || "",
      items: items.length > 0
        ? items.map((r) => ({
            description: r.description,
            quantity:    String(r.quantity ?? ""),
            unit:        r.unit || "Pieza",
            unit_price:  r.unit_price != null ? String(r.unit_price) : "",
          }))
        : [{ ...EMPTY_ITEM }],
    });
    setFormError("");
    setCustomSignerMode(false);
    /* Precarga el texto del combobox con el nombre del proveedor actual */
    const preSupplier = suppliers.find((s) => s.id === order.supplier_id);
    setSupplierSearch(preSupplier?.name || "");
    setShowSupplierDropdown(false);
    setShowCreateModal(true);
  }

  /* ── Subir PDF firmado ────────────────────────────────────────── */

  function triggerSignedPdfUpload(orderId: string) {
    setUploadTargetId(orderId);
    /* pequeño timeout para que React termine de actualizar antes de abrir el picker */
    setTimeout(() => pdfFileInputRef.current?.click(), 30);
  }

  async function handleSignedPdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file    = e.target.files?.[0];
    const orderId = uploadTargetId;
    e.target.value = ""; /* permite volver a subir el mismo archivo luego */
    if (!file || !orderId || !user?.company_id) { setUploadTargetId(null); return; }

    const order = orders.find((o) => o.id === orderId);
    if (!order) { setUploadTargetId(null); return; }

    setUploadingId(orderId);

    const path = `${user.company_id}/${order.folio}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("purchase-orders")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });

    if (upErr) {
      console.error("upload pdf error:", upErr);
      setMsg(`No se pudo subir el PDF: ${upErr.message}`);
      setUploadingId(null);
      setUploadTargetId(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("purchase-orders").getPublicUrl(path);
    const pdfUrl = urlData?.publicUrl ? urlData.publicUrl + "?t=" + Date.now() : null;
    const nowIso = new Date().toISOString();

    const { error: updErr } = await supabase
      .from("purchase_orders")
      .update({ pdf_url: pdfUrl, status: "sent", sent_at: nowIso, updated_at: nowIso })
      .eq("id", orderId);

    if (updErr) {
      console.error("update pdf_url error:", updErr);
      setMsg(`PDF subido pero no se pudo actualizar la OC: ${updErr.message}`);
      setUploadingId(null);
      setUploadTargetId(null);
      return;
    }

    /* Refrescar en memoria */
    setOrders((prev) => prev.map((o) =>
      o.id === orderId
        ? { ...o, pdf_url: pdfUrl, status: "sent" as Status, sent_at: nowIso }
        : o
    ));
    setUploadingId(null);
    setUploadTargetId(null);
    setMsg("PDF firmado subido correctamente. OC marcada como enviada.");
  }

  /* ── PDF generation ────────────────────────────────────────────── */

  async function handleGeneratePDF(order: PurchaseOrder) {
    setGeneratingPdfId(order.id);
    const toastId = toast.loading("Generando PDF...");
    try {
      const supplier = suppliers.find((s) => s.id === order.supplier_id);
      const building = buildings.find((b) => b.id === order.building_id);

      /* Items */
      const { data: itemRows } = await supabase
        .from("purchase_order_items")
        .select("description, quantity, unit, unit_price")
        .eq("purchase_order_id", order.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      const items = (itemRows as POItem[]) || [];

      /* Resolver sucursal */
      let branchName: string | null = null;
      if (order.supplier_branch_id) {
        const inCat = (supplier?.branches || []).find((b) => b.id === order.supplier_branch_id);
        if (inCat) {
          branchName = inCat.name;
        } else {
          const { data: brData } = await supabase
            .from("supplier_branches")
            .select("name")
            .eq("id", order.supplier_branch_id)
            .maybeSingle();
          branchName = (brData as { name: string } | null)?.name || null;
        }
      }

      /* Preparar ambos logos con aspect ratio correcto */
      const printSrc = companyLogoPrint || companyLogoUrl;
      const logoPrint = printSrc    ? await prepareLogoForPDF(printSrc,    110, 45) : null;
      const logoGroup = logoGroupUrl ? await prepareLogoForPDF(logoGroupUrl, 80, 45) : null;

      console.log("items con precios:", JSON.stringify(
        items.map((it) => ({
          desc: it.description,
          unit_price: it.unit_price,
          mapped: it.unit_price || 0,
        })), null, 2
      ));

      /* renderPurchaseOrderPage ahora es async y se auto-descarga vía html2pdf */
      await renderPurchaseOrderPage(null, {
        folio:              order.folio,
        date:               new Date(order.created_at),
        supplierName:       supplier?.name || "",
        supplierTaxId:      supplier?.tax_id || null,
        cfdiUse:            supplier?.cfdi_use || null,
        clientNumber:       supplier?.client_number || null,
        branchName,
        items:              (() => {
          console.log("items para PDF:", JSON.stringify(items.map((i) => ({
            description: i.description,
            unit_price: i.unit_price,
          })), null, 2));
          return items.map((it) => ({ quantity: it.quantity, unit: it.unit, description: it.description, unitPrice: it.unit_price || 0 }));
        })(),
        buildingName:       building?.name || "",
        projectDescription: order.project_description || "",
        responsibleName:    order.responsible_name  || "",
        responsiblePhone:   order.responsible_phone || "",
        signerName:         order.signer_name       || "",
        logoPrint,
        logoGroup,
        company: { legalName, address: companyAddress, taxId: companyTaxId, phone: companyPhone, email: companyEmail, zipCode: companyZipCode },
        companyPhone,
        purchasesContactPhone,
        purchasesContactEmail,
      });
      toast.dismiss(toastId);
      toast.success("PDF listo");
    } catch (err) {
      console.error("OC PDF error:", err);
      toast.dismiss(toastId);
      toast.error("Error al generar el PDF.");
    }
    setGeneratingPdfId(null);
  }

  /* ── Styles ────────────────────────────────────────────────────── */

  const INPUT_STYLE: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--border-default)",
    borderRadius: 10,
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  };

  /* ── Render ────────────────────────────────────────────────────── */

  if (userLoading) {
    return <PageContainer><p style={{ color: "var(--text-muted)" }}>Cargando...</p></PageContainer>;
  }

  const monthLabel = `${MONTH_LABELS_LONG[selectedMonth - 1]} ${selectedYear}`;

  return (
    <PageContainer>
      {/* Input oculto para subir PDF firmado — fuera del loop para un único ref */}
      <input
        ref={pdfFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={handleSignedPdfUpload}
      />

      <PageHeader
        title="Compras"
        titleIcon={<ShoppingCart size={18} />}
        subtitle="Órdenes de compra generadas manualmente o desde tickets de mantenimiento."
        actions={
          <>
            <UiButton
              variant="secondary"
              onClick={() => router.push("/purchases/reporte-pagos")}
              icon={<FileText size={16} />}
            >
              Reporte de pagos
            </UiButton>
            <UiButton variant="primary" onClick={openCreateModal} icon={<Plus size={16} />}>
              Nueva OC manual
            </UiButton>
          </>
        }
      />

      {/* Navegador de mes (igual que /collections) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <div style={monthNavStyle}>
          <button type="button" onClick={prevMonth} style={monthNavBtnStyle} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <span style={monthNavLabelStyle}>{monthLabel}</span>
          <button type="button" onClick={nextMonth} style={monthNavBtnStyle} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {msg ? (
        <AppCard style={{ marginBottom: 16 }}>
          <div style={{
            color: msg.includes("correctamente") ? "var(--badge-text-blue)" : "var(--badge-text-red)",
            fontWeight: 600,
          }}>
            {msg}
          </div>
        </AppCard>
      ) : null}

      {/* Métricas — stat bar compacta */}
      <div className="purchases-statbar" style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>
        {[
          { label: "Total OC",        value: metrics.total,     sub: "todas" },
          { label: "Borradores",      value: metrics.draft,     sub: "sin enviar" },
          { label: "Por enviar",      value: metrics.pending,   sub: "aprobadas", color: "#F59E0B" },
          { label: "Enviadas",        value: metrics.sent,      sub: "al proveedor", color: "#3B82F6" },
          { label: "Surtido parcial", value: metrics.partial,   sub: "entrega", color: "#F59E0B" },
          { label: "Completadas",     value: metrics.received,  sub: "recibidas", color: "#10B981" },
          { label: "Facturadas",      value: metrics.invoiced,  sub: "cerradas", color: "#7c3aed" },
          { label: "Canceladas",      value: metrics.cancelled, sub: "anuladas", color: "#EF4444" },
        ].map((s, i, arr) => (
          <div key={i} className="purchases-statbar-cell" style={{ flex: 1, padding: "14px 16px", borderRight: i < arr.length - 1 ? "1px solid var(--border-default)" : "none", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color ?? "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <AppCard style={{ marginBottom: 16 }}>
        <div className="purchases-filters" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
          <select
            style={INPUT_STYLE}
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
          >
            <option value="ALL">Todos los proveedores</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute", left: 12, top: "50%",
                transform: "translateY(-50%)", color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              style={{ ...INPUT_STYLE, paddingLeft: 36 }}
              placeholder="Buscar por folio, proveedor, descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Pills de estado */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STATUS_FILTERS.map((f) => {
            const active = filterStatus === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilterStatus(f.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  border: active
                    ? `1.5px solid ${f.color}`
                    : `1px solid ${f.color}4d`,
                  background: active ? f.bg : `${f.bg}80`,
                  color: active ? f.color : `${f.color}99`,
                  transition: "all 0.15s ease",
                  lineHeight: 1.4,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </AppCard>

      {/* Lista */}
      {loading ? (
        <AppCard><p style={{ margin: 0, color: "var(--text-muted)" }}>Cargando órdenes...</p></AppCard>
      ) : filtered.length === 0 ? (
        <AppCard>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {orders.length === 0
              ? "No hay órdenes de compra. Crea la primera con el botón de arriba."
              : `No hay órdenes de compra en ${monthLabel} con los filtros seleccionados.`}
          </p>
        </AppCard>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((o, index) => {
            const isExpanded = expandedOrderId === o.id;
            const items      = itemsByOrderId[o.id] || [];
            const hasPrices  = items.some((it) => it.unit_price != null && Number(it.unit_price) > 0);
            const supplier   = suppliers.find((s) => s.id === o.supplier_id);
            const branch     = o.supplier_branch_id
              ? (supplier?.branches || []).find((b) => b.id === o.supplier_branch_id) || null
              : null;
            const fechaCorta = formatDateMedium(o.created_at);
            const fechaLarga = formatDateLong(o.created_at);

            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
              <AppCard style={{ padding: 0, overflow: "hidden" }}>

                {/* ── Fila colapsada (clickeable) ────────────────── */}
                <div
                  onClick={() => handleToggleExpand(o)}
                  style={{
                    padding: 18, cursor: "pointer",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", gap: 12, flexWrap: "wrap",
                    background: "transparent",
                  }}
                >
                  {/* Lado izquierdo */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <AppBadge variant="gray" style={{ fontFamily: "monospace" }}>
                        {o.folio}
                      </AppBadge>

                      {o.maintenance_log_id ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/maintenance?expand=${o.maintenance_log_id}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/maintenance?expand=${o.maintenance_log_id}`);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                          title="Ver ticket en Mantenimiento"
                        >
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 8px", borderRadius: 20,
                            background: "#EFF6FF", color: "#1D4ED8",
                            fontSize: 11, fontWeight: 700,
                          }}>
                            <Wrench size={11} />
                            {o.ticket_number ? `MT-${o.ticket_number}` : "Mantenimiento"}
                          </span>
                        </span>
                      ) : (
                        <AppBadge variant="gray">Manual</AppBadge>
                      )}

                      <AppBadge {...getStatusBadgeProps(o.status)}>
                        {STATUS_LABEL[o.status]}
                      </AppBadge>
                      {(() => {
                        if (o.status !== "partial") return null;
                        const child = orders.find((ord) => ord.parent_order_id === o.id);
                        if (!child) return null;
                        const vMatch = child.folio.match(/-V(\d+)$/);
                        const vNum = vMatch ? vMatch[1] : "?";
                        return (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px",
                            borderRadius: 20, background: "#eff6ff",
                            color: "#2563eb", border: "1px solid #93c5fd",
                          }}>
                            V{vNum} activa
                          </span>
                        );
                      })()}
                      {(() => {
                        if (o.status !== "received") return null;
                        const children = orders.filter((ord) => ord.parent_order_id === o.id);
                        if (children.length === 0) return null;
                        let maxV = 0;
                        children.forEach((c) => {
                          const m = c.folio.match(/-V(\d+)$/);
                          if (m) { const v = parseInt(m[1], 10); if (v > maxV) maxV = v; }
                        });
                        if (maxV === 0) return null;
                        return (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px",
                            borderRadius: 20, background: "#dcfce7",
                            color: "#15803d", border: "1px solid #86efac",
                          }}>
                            Cerrada vía V{maxV}
                          </span>
                        );
                      })()}

                      {/* CAMBIO 3 — Badge "Con devolución" */}
                      {o.returns && o.returns.length > 0 ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px",
                          borderRadius: 20, background: "#fff7ed",
                          color: "#c2410c", border: "1px solid #fdba74",
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          <RotateCcw size={10} />
                          {o.returns.length === 1 ? "Con devolución" : `${o.returns.length} devoluciones`}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                      {o.supplier_name || "Sin proveedor"}
                      {branch ? (
                        <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}> · {branch.name}</span>
                      ) : null}
                    </div>
                    {o.maintenance_log_id ? (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                        De mantenimiento · Ticket: {o.ticket_number ? `MT-${o.ticket_number}` : o.maintenance_log_id.slice(0, 8)}
                      </div>
                    ) : null}

                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)" }}>
                      <span>{fechaCorta}</span>
                      {o.building_name ? <span>· {o.building_name}</span> : null}
                      {(o.item_count ?? 0) > 0 ? <span>· {o.item_count} material{o.item_count !== 1 ? "es" : ""}</span> : null}
                    </div>
                  </div>

                  {/* Lado derecho — total + chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    {(o.total_estimated ?? 0) > 0 ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                          Total estimado
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
                          ${(o.total_estimated || 0).toFixed(2)}
                        </div>
                      </div>
                    ) : null}

                    <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                </div>

                {/* ── Vista expandida inline ─────────────────────── */}
                <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{
                    overflow: "hidden",
                    borderTop: "1px solid var(--border-default)",
                    padding: "16px 18px 20px",
                    display: "flex", flexDirection: "column", gap: 18,
                    background: "var(--bg-input)",
                  }}>

                    {/* ── Sección 0: Relaciones de versión ── */}
                    {(() => {
                      const parentOrder = o.parent_order_id
                        ? orders.find((ord) => ord.id === o.parent_order_id)
                        : null;
                      const childOrders = orders.filter((ord) => ord.parent_order_id === o.id);
                      if (!parentOrder && childOrders.length === 0) return null;
                      return (
                        <div style={{
                          display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
                          padding: "10px 14px", borderRadius: 10,
                          background: "var(--bg-card)", border: "1px solid var(--border-default)",
                        }}>
                          {parentOrder && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                              <span style={{ fontWeight: 600 }}>Faltantes de:</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSearch(parentOrder.folio); setExpandedOrderId(parentOrder.id); }}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "2px 8px", borderRadius: 14,
                                  background: "#EFF6FF", color: "#1D4ED8",
                                  fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                                  border: "none", cursor: "pointer",
                                }}
                              >
                                {parentOrder.folio}
                              </button>
                            </span>
                          )}
                          {childOrders.length > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
                              <span style={{ fontWeight: 600 }}>Versiones:</span>
                              {childOrders.map((child) => (
                                <button
                                  key={child.id}
                                  onClick={(e) => { e.stopPropagation(); setSearch(child.folio); setExpandedOrderId(child.id); }}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "2px 8px", borderRadius: 14,
                                    background: "#F0FDF4", color: "#15803D",
                                    fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                                    border: "none", cursor: "pointer",
                                  }}
                                >
                                  {child.folio}
                                </button>
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Sección 0b: Progreso del ticket ── */}
                    {o.maintenance_log_id ? (() => {
                      const prog = ticketProgress[o.id];
                      const loading = loadingProgressFor[o.id];
                      if (loading) return (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Cargando progreso del ticket...</p>
                      );
                      if (!prog) return null;
                      const pct = prog.itemTotal > 0
                        ? Math.min(100, Math.round((prog.itemReceived / prog.itemTotal) * 100))
                        : 0;
                      const pendientes = Math.max(0, prog.itemTotal - prog.itemReceived);
                      return (
                        <div style={{
                          padding: "12px 16px", borderRadius: 10,
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Progreso del ticket
                            </span>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 14,
                              background: "#EFF6FF", color: "#1D4ED8",
                              fontSize: 12, fontWeight: 700,
                            }}>
                              {o.ticket_number ? `MT-${o.ticket_number}` : "Ticket ligado"}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>
                              <strong style={{ color: "var(--text-primary)" }}>{prog.itemTotal}</strong> piezas pedidas
                            </span>
                            <span style={{ color: "#15803D" }}>
                              <strong>{prog.itemReceived.toFixed(0)}</strong> surtidos
                            </span>
                            <span style={{ color: pendientes > 0 ? "#B45309" : "var(--text-muted)" }}>
                              <strong>{pendientes.toFixed(0)}</strong> pendientes
                            </span>
                          </div>
                          <div style={{ height: 8, background: "var(--border-default)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 4,
                              background: pct === 100 ? "#16a34a" : "#3B82F6",
                              width: `${pct}%`,
                              transition: "width 0.4s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                            {pct}% surtido
                          </div>
                        </div>
                      );
                    })() : null}

                    {/* ── Sección 1: Datos generales ── */}
                    <div>
                      <SectionLabel>Datos generales</SectionLabel>
                      <div className="purchases-detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                        <DetailRow label="Proveedor" value={o.supplier_name || "—"} />
                        {branch ? <DetailRow label="Sucursal" value={branch.name} /> : null}
                        <DetailRow label="RFC" value={supplier?.tax_id || "—"} />
                        <DetailRow label="Número de cliente" value={supplier?.client_number || "—"} />
                        <DetailRow label="Fecha" value={fechaLarga} />
                        <DetailRow label="Edificio / Proyecto" value={o.building_name || "—"} />
                        <DetailRow label="Responsable a recoger" value={o.responsible_name || "—"} />
                        <DetailRow label="Teléfono del responsable" value={o.responsible_phone || "—"} />
                        {o.responsible_user_id ? (() => {
                          const fu = fieldUsers.find((u) => u.id === o.responsible_user_id);
                          return fu ? <DetailRow label="Email del responsable" value={fu.email} /> : null;
                        })() : null}
                        <DetailRow label="Quién autoriza" value={o.signer_name || "—"} />
                      </div>
                      {o.project_description ? (
                        <div style={{ marginTop: 10 }}>
                          <DetailRow label="Descripción del proyecto" value={o.project_description} />
                        </div>
                      ) : null}
                    </div>

                    {/* ── Sección 2: Materiales (solo lectura — editar desde modal "Editar OC") ── */}
                    <div>
                      <SectionLabel>Materiales</SectionLabel>
                      {loadingItemsFor === o.id ? (
                        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>Cargando materiales...</p>
                      ) : items.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>Sin materiales.</p>
                      ) : (
                        <div className="purchases-table-wrap" style={{
                          border: "1px solid var(--border-default)",
                          borderRadius: 10, overflow: "hidden",
                          background: "var(--bg-card)",
                        }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: "var(--bg-input)" }}>
                                <th style={{ ...thStyle, width: 36 }}>#</th>
                                <th style={{ ...thStyle, textAlign: "left" }}>Descripción</th>
                                <th style={thStyle}>Cantidad</th>
                                <th style={thStyle}>Unidad</th>
                                {hasPrices ? (
                                  <>
                                    <th style={{ ...thStyle, textAlign: "right" }}>P. unit.</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                                  </>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, idx) => (
                                <tr key={it.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                                  <td style={tdStyle}>{idx + 1}</td>
                                  <td style={{ ...tdStyle, textAlign: "left" }}>{it.description}</td>
                                  <td style={tdStyle}>{it.quantity}</td>
                                  <td style={tdStyle}>{it.unit}</td>
                                  {hasPrices ? (
                                    <>
                                      <td style={{ ...tdStyle, textAlign: "right" }}>
                                        {it.unit_price && Number(it.unit_price) > 0 ? `$${Number(it.unit_price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "right" }}>
                                        {it.unit_price && Number(it.unit_price) > 0 ? `$${(Number(it.quantity || 0) * Number(it.unit_price)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                                      </td>
                                    </>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ── Sección 2a: Conceptos facturados del XML ── */}
                    {o.status === "invoiced" ? (() => {
                      const meta = getInvoiceMeta(o);
                      console.log('invoice meta:', meta);
                      const conceptos = meta && Array.isArray((meta as { conceptos?: unknown[] }).conceptos)
                        ? (meta as { conceptos: { descripcion: string; cantidad: string; valorUnitario: string; importe: string }[] }).conceptos
                        : [];
                      if (conceptos.length === 0) return null;
                      const totalXml = conceptos.reduce((acc, c) => acc + (Number(c.importe) || 0), 0);
                      return (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <SectionLabel>Conceptos facturados</SectionLabel>
                            <span style={{
                              padding: "2px 8px", borderRadius: 999,
                              background: "var(--icon-bg-purple)", color: "var(--icon-color-purple)",
                              border: "1px solid rgba(168, 85, 247, 0.4)",
                              fontSize: 10, fontWeight: 700,
                              letterSpacing: "0.04em",
                              marginTop: -8,
                            }}>
                              Del XML
                            </span>
                          </div>
                          <div style={{
                            border: "1px solid rgba(168, 85, 247, 0.4)",
                            borderRadius: 10, overflow: "hidden",
                            background: "var(--bg-card)",
                          }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: "var(--bg-table-header)" }}>
                                  <th style={{ ...thStyle, width: 36 }}>#</th>
                                  <th style={{ ...thStyle, textAlign: "left" }}>Descripción</th>
                                  <th style={thStyle}>Cantidad</th>
                                  <th style={{ ...thStyle, textAlign: "right" }}>P. Unit.</th>
                                  <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {conceptos.map((c, idx) => (
                                  <tr key={idx} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                    <td style={tdStyle}>{idx + 1}</td>
                                    <td style={{ ...tdStyle, textAlign: "left" }}>{c.descripcion}</td>
                                    <td style={tdStyle}>{c.cantidad}</td>
                                    <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-secondary)" }}>
                                      {Number(c.valorUnitario) > 0
                                        ? `$${Number(c.valorUnitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                                        : "—"}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>
                                      {Number(c.importe) > 0
                                        ? `$${Number(c.importe).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                                {/* Fila total */}
                                <tr style={{ borderTop: "2px solid rgba(168, 85, 247, 0.4)", background: "var(--bg-table-header)" }}>
                                  <td colSpan={4} style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "var(--icon-color-purple)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Total
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "var(--icon-color-purple)", fontSize: 14 }}>
                                    ${totalXml.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })() : null}

                    {/* ── Sección 2b: Faltantes — solo si partial ── */}
                    {o.status === "partial" ? (() => {
                      const faltantes = items.filter(
                        (it) => it.quantity_received != null && it.quantity_received < it.quantity
                      );
                      if (faltantes.length === 0) return null;
                      return (
                        <div>
                          <SectionLabel>Faltantes</SectionLabel>
                          <div style={{
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            borderRadius: 10, overflow: "hidden",
                            background: "var(--bg-card)",
                          }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: "rgba(245, 158, 11, 0.1)" }}>
                                  <th style={{ ...thStyle, textAlign: "left", color: "var(--text-secondary)" }}>Descripción</th>
                                  <th style={{ ...thStyle, color: "var(--text-secondary)" }}>Pedido</th>
                                  <th style={{ ...thStyle, color: "var(--text-secondary)" }}>Recibido</th>
                                  <th style={{ ...thStyle, color: "var(--text-secondary)" }}>Faltante</th>
                                </tr>
                              </thead>
                              <tbody>
                                {faltantes.map((it) => {
                                  const diff = it.quantity - (it.quantity_received ?? 0);
                                  return (
                                    <tr key={it.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                      <td style={{ ...tdStyle, textAlign: "left", color: "var(--text-primary)" }}>{it.description}</td>
                                      <td style={{ ...tdStyle, color: "var(--text-primary)" }}>{it.quantity} {it.unit}</td>
                                      <td style={{ ...tdStyle, color: "var(--text-primary)" }}>{it.quantity_received ?? 0} {it.unit}</td>
                                      <td style={{ ...tdStyle, color: "#ef4444", fontWeight: 700 }}>
                                        -{diff} {it.unit}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })() : null}

                    {/* ── Sección 2c: Factura — solo si invoiced ── */}
                    {o.status === "invoiced" ? (() => {
                      const meta = getInvoiceMeta(o);
                      if (!meta) return null;
                      return (
                        <div>
                          <SectionLabel>Factura</SectionLabel>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 12,
                            padding: "14px 16px",
                            borderRadius: 10,
                            border: "1px solid rgba(168, 85, 247, 0.4)",
                            background: "var(--bg-card)",
                          }}>
                            {meta.number ? (
                              <DetailRow label="Número de factura" value={meta.number} />
                            ) : null}
                            {meta.amount != null ? (
                              <DetailRow
                                label="Monto total"
                                value={`$${Number(meta.amount).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`}
                              />
                            ) : null}
                            {meta.date ? (
                              <DetailRow label="Fecha de factura" value={meta.date} />
                            ) : null}
                            {meta.rfc_emisor ? (
                              <DetailRow label="RFC emisor" value={meta.rfc_emisor} />
                            ) : null}
                            {meta.nombre_emisor ? (
                              <DetailRow label="Nombre emisor" value={meta.nombre_emisor} />
                            ) : null}
                          </div>
                        </div>
                      );
                    })() : null}

                    {/* ── Sección 2d: Devoluciones ── */}
                    {o.returns && o.returns.length > 0 ? (
                      <div>
                        <SectionLabel>Devoluciones ({o.returns.length})</SectionLabel>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {o.returns.map((ret, ri) => (
                            <div key={ret.id} style={{
                              border: "1px solid rgba(194, 65, 12, 0.3)",
                              borderRadius: 10,
                              padding: "12px 14px",
                              background: "var(--bg-card)",
                              display: "flex", flexDirection: "column", gap: 6,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                  background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74",
                                }}>
                                  Dev. #{ri + 1}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                  {RETURN_REASON_LABEL[ret.reason]}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                                  {new Date(ret.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              </div>
                              {ret.reason_notes ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{ret.reason_notes}</p>
                              ) : null}
                              {ret.items && ret.items.length > 0 ? (
                                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                                  {ret.items.length} material{ret.items.length !== 1 ? "es" : ""} devuelto{ret.items.length !== 1 ? "s" : ""} ·&nbsp;
                                  {ret.items.map((it) => it.quantity_returned).reduce((a, b) => a + b, 0)} unidades
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* ── Sección 3: Acciones ── */}
                    <div>
                      <SectionLabel>Acciones</SectionLabel>
                      <div className="purchases-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>

                        {/* Revisar y aprobar — solo para borradores: abre modal de edición */}
                        {o.status === "draft" ? (
                          <button
                            type="button"
                            onClick={() => handleStartEditOrder(o)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "9px 14px", borderRadius: 8,
                              border: "1px solid var(--accent)",
                              background: "var(--accent)", color: "#fff",
                              fontSize: 13, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            <CheckCircle2 size={14} />
                            Revisar y aprobar
                          </button>
                        ) : null}

                        {/* Botones de surtido — cuando sent */}
                        {o.status === "sent" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void markStatus(o, "received")}
                              disabled={updatingStatusId === o.id}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "9px 14px", borderRadius: 8,
                                border: "1px solid #10B981", background: "#10B981", color: "#fff",
                                fontSize: 13, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Marcar surtido completo
                            </button>
                            <button
                              type="button"
                              onClick={() => void markStatus(o, "partial")}
                              disabled={updatingStatusId === o.id}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "9px 14px", borderRadius: 8,
                                border: "1px solid #F59E0B", background: "transparent", color: "#b45309",
                                fontSize: 13, fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              <AlertCircle size={14} />
                              Surtido parcial
                            </button>
                          </>
                        ) : null}

                        {/* Botones — cuando partial: cerrada para surtido, solo faltantes y factura */}
                        {o.status === "partial" ? (
                          <>
                            {/* Badge indicando que está cerrada */}
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "6px 12px", borderRadius: 8,
                              background: "#fffbeb", border: "1px solid #F59E0B",
                              color: "#b45309", fontSize: 12, fontWeight: 600,
                            }}>
                              <AlertCircle size={13} />
                              Surtido parcial — Cerrada
                            </span>
                            {(() => {
                              const childDraft = orders.find((ord) => ord.parent_order_id === o.id && ord.status === "draft");
                              if (!childDraft) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => void createOCForFaltantes(o)}
                                    style={{
                                      display: "inline-flex", alignItems: "center", gap: 6,
                                      padding: "9px 14px", borderRadius: 8,
                                      border: "1px solid #ea580c", background: "#ea580c", color: "#fff",
                                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    }}
                                  >
                                    <Plus size={14} />
                                    Nueva OC por faltantes
                                  </button>
                                );
                              }
                              const vMatch = childDraft.folio.match(/-V(\d+)$/);
                              const vNum = vMatch ? vMatch[1] : "?";
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSearch(childDraft.folio); setExpandedOrderId(childDraft.id); }}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "9px 14px", borderRadius: 8,
                                    border: "1px solid #3B82F6", background: "transparent", color: "#2563eb",
                                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                                  }}
                                >
                                  Ver V{vNum} →
                                </button>
                              );
                            })()}
                          </>
                        ) : null}

                        {/* Registrar factura — cuando received o partial */}
                        {(o.status === "received" || o.status === "partial") ? (
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceTarget(o);
                              const meta = getInvoiceMeta(o);
                              setInvoiceForm({
                                number: meta?.number ?? "",
                                amount: meta?.amount != null ? String(meta.amount) : "",
                                date: meta?.date ?? "",
                                notes: meta?.notes ?? "",
                              });
                            }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "9px 14px", borderRadius: 8,
                              border: "1px solid #7c3aed", background: "#7c3aed", color: "#fff",
                              fontSize: 13, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            <FileText size={14} />
                            Registrar factura
                          </button>
                        ) : null}

                        {/* Badge + reemplazar XML — cuando invoiced */}
                        {o.status === "invoiced" ? (() => {
                          const meta = getInvoiceMeta(o);
                          return (
                            <>
                              {meta?.number ? (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "6px 12px", borderRadius: 999,
                                  background: "#f3e8ff", color: "#7c3aed",
                                  border: "1px solid #a855f7",
                                  fontSize: 12, fontWeight: 600,
                                }}>
                                  <FileText size={12} />
                                  Factura #{meta.number}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceTarget(o);
                                  const m = getInvoiceMeta(o);
                                  setInvoiceForm({
                                    number: m?.number ?? "",
                                    amount: m?.amount != null ? String(m.amount) : "",
                                    date:   m?.date   ?? "",
                                    notes:  m?.notes  ?? "",
                                  });
                                }}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "9px 14px", borderRadius: 8,
                                  border: "1px solid #a855f7", background: "transparent",
                                  color: "#7c3aed",
                                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}
                              >
                                <Upload size={14} />
                                Reemplazar XML
                              </button>
                            </>
                          );
                        })() : null}

                        {/* CAMBIO 4 — Registrar devolución */}
                        {(o.status === "received" || o.status === "invoiced") ? (
                          <button
                            type="button"
                            onClick={() => setReturnTarget(o)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "9px 14px", borderRadius: 8,
                              border: "1px solid #c2410c", background: "transparent",
                              color: "#c2410c",
                              fontSize: 13, fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            <RotateCcw size={14} />
                            Registrar devolución
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleGeneratePDF(o)}
                          disabled={generatingPdfId === o.id}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "9px 14px", borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--bg-card)", color: "var(--text-primary)",
                            fontSize: 13, fontWeight: 600,
                            cursor: generatingPdfId === o.id ? "wait" : "pointer",
                            opacity: generatingPdfId === o.id ? 0.7 : 1,
                          }}
                        >
                          <FileText size={14} />
                          {generatingPdfId === o.id ? "Generando..." : "Generar PDF"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEditOrder(o)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "9px 14px", borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--bg-card)", color: "var(--text-primary)",
                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          <Edit3 size={14} />
                          Editar OC
                        </button>

                        {/* PDF firmado */}
                        {o.pdf_url ? (
                          <>
                            <a
                              href={o.pdf_url + (o.pdf_url.includes("?") ? "" : "?t=" + Date.now())}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "9px 14px", borderRadius: 8,
                                border: "1px solid var(--metric-border-green)",
                                background: "var(--metric-bg-green)",
                                color: "var(--metric-value-green)",
                                fontSize: 13, fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Ver PDF firmado
                              <ExternalLink size={12} />
                            </a>
                            <button
                              type="button"
                              onClick={() => triggerSignedPdfUpload(o.id)}
                              disabled={uploadingId === o.id}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "9px 14px", borderRadius: 8,
                                border: "1px solid var(--border-default)",
                                background: "var(--bg-card)", color: "var(--text-primary)",
                                fontSize: 13, fontWeight: 600,
                                cursor: uploadingId === o.id ? "wait" : "pointer",
                                opacity: uploadingId === o.id ? 0.7 : 1,
                              }}
                            >
                              <Upload size={14} />
                              {uploadingId === o.id ? "Subiendo..." : "Reemplazar"}
                            </button>
                          </>
                        ) : (o.status !== "cancelled" && o.status !== "draft") ? (
                          <button
                            type="button"
                            onClick={() => triggerSignedPdfUpload(o.id)}
                            disabled={uploadingId === o.id}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "9px 14px", borderRadius: 8,
                              border: "1px solid var(--accent)",
                              background: "var(--accent)", color: "#fff",
                              fontSize: 13, fontWeight: 700,
                              cursor: uploadingId === o.id ? "wait" : "pointer",
                              opacity: uploadingId === o.id ? 0.7 : 1,
                            }}
                          >
                            <Upload size={14} />
                            {uploadingId === o.id ? "Subiendo..." : "Subir PDF firmado"}
                          </button>
                        ) : null}

                        {/* Cancelar OC — visible en todos los estados excepto cancelled */}
                        {o.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(o)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "9px 14px", borderRadius: 8,
                              border: "1px solid var(--badge-text-red)",
                              background: "transparent",
                              color: "var(--badge-text-red)",
                              fontSize: 13, fontWeight: 600, cursor: "pointer",
                              marginLeft: "auto",
                            }}
                          >
                            <XCircle size={14} />
                            Cancelar OC
                          </button>
                        ) : null}
                      </div>
                    </div>

                  </motion.div>
                ) : null}
                </AnimatePresence>
              </AppCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════════ Modal Nueva / Editar OC ═══════════ */}
      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title={editingOrderId ? "Editar orden de compra" : "Nueva orden de compra"}
        subtitle={editingOrderId ? undefined : "Crear una OC manual sin ticket asociado."}
        maxWidth="800px"
      >
        <form id="purchases-create-form" onSubmit={handleCreate}>

          <AppFormField label="Proveedor" required>
            <div style={{ position: "relative" }}>
              <input
                style={INPUT_STYLE}
                placeholder="Buscar proveedor..."
                value={supplierSearch}
                onFocus={() => setShowSupplierDropdown(true)}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setShowSupplierDropdown(true);
                  /* Al editar el texto, invalidamos la selección previa */
                  if (manualSupplierId) {
                    setValue("supplierId", "");
                    setValue("supplierBranchId", "");
                  }
                }}
                /* onBlur diferido para permitir click en el dropdown */
                onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)}
                autoComplete="off"
              />
              {showSupplierDropdown && filteredSuppliers.length > 0 ? (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  maxHeight: 220, overflowY: "auto",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 20,
                }}>
                  {filteredSuppliers.map((s) => (
                    <div
                      key={s.id}
                      onMouseDown={(e) => e.preventDefault()} /* evita perder foco antes del click */
                      onClick={() => {
                        setValue("supplierId", s.id);
                        setValue("supplierBranchId", "");
                        setSupplierSearch(s.name);
                        setShowSupplierDropdown(false);
                      }}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        fontSize: 14,
                        color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border-default)",
                        background: manualSupplierId === s.id ? "var(--bg-input)" : "transparent",
                      }}
                    >
                      {s.name}
                      {s.prefix ? (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          [{s.prefix}]
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {showSupplierDropdown && filteredSuppliers.length === 0 && supplierSearch.trim() ? (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  fontSize: 13, color: "var(--text-muted)",
                  zIndex: 20,
                }}>
                  Sin resultados.
                </div>
              ) : null}
            </div>
            {errors.supplierId ? (
              <p style={purchasesErrorTextStyle}>{errors.supplierId.message}</p>
            ) : null}
          </AppFormField>

          {manualSupplierId ? (() => {
            const selected  = suppliers.find(s => s.id === manualSupplierId);
            const branches  = selected?.branches || [];
            return (
              <AppFormField label="Sucursal">
                {branches.length === 0 ? (
                  <div style={{
                    padding: "10px 12px",
                    border: "1px dashed var(--border-default)",
                    borderRadius: 10,
                    background: "var(--bg-input)",
                    fontSize: 13, color: "var(--text-muted)",
                  }}>
                    Sin sucursales registradas — se usarán los datos generales del proveedor.
                  </div>
                ) : (
                  <select
                    style={INPUT_STYLE}
                    {...register("supplierBranchId")}
                  >
                    <option value="">Sin sucursal específica (datos generales)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </AppFormField>
            );
          })() : null}

          <AppFormField label="Proyecto / Edificio">
            <select
              style={INPUT_STYLE}
              {...register("buildingId")}
            >
              <option value="">Sin edificio específico</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </AppFormField>

          <AppFormField label="Descripción del proyecto">
            <textarea
              style={{ ...INPUT_STYLE, resize: "vertical", minHeight: 60 }}
              {...register("projectDescription")}
              placeholder="Breve descripción del propósito de la compra..."
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Responsable a recoger">
              {fieldUsers.length === 0 ? (
                <div style={{ ...INPUT_STYLE, color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>
                  No hay usuarios de campo registrados
                </div>
              ) : (
                <select
                  style={INPUT_STYLE}
                  value={watch("responsibleUserId") || ""}
                  onChange={(e) => {
                    const userId = e.target.value;
                    if (!userId) {
                      setValue("responsibleUserId", "");
                      setValue("responsibleName", "");
                      setValue("responsiblePhone", "");
                      return;
                    }
                    const u = fieldUsers.find((fu) => fu.id === userId);
                    if (!u) return;
                    setValue("responsibleUserId", u.id);
                    setValue("responsibleName", u.full_name);
                    setValue("responsiblePhone", "");
                  }}
                >
                  <option value="">Sin responsable asignado</option>
                  {fieldUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              )}
            </AppFormField>

            <AppFormField label="Teléfono del responsable">
              <input
                style={INPUT_STYLE}
                {...register("responsiblePhone")}
                placeholder="+52 ..."
              />
            </AppFormField>
          </div>

          <AppFormField label="Quién autoriza / firmante">
            {customSignerMode ? (
              <input
                style={INPUT_STYLE}
                {...register("signerName")}
                placeholder="Nombre del firmante"
                autoFocus
              />
            ) : (
              <select
                style={INPUT_STYLE}
                value={manualSignerName || ""}
                onChange={(e) => {
                  if (e.target.value === "__OTHER__") {
                    setCustomSignerMode(true);
                    setValue("signerName", "");
                  } else {
                    setValue("signerName", e.target.value);
                  }
                }}
              >
                <option value="">Sin firmante asignado</option>
                {signers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}{s.is_default ? " (default)" : ""}
                  </option>
                ))}
                <option value="__OTHER__">+ Otro...</option>
              </select>
            )}
          </AppFormField>

          {/* Renglones de materiales */}
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
              Materiales
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "80px 130px 1fr 120px 32px", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>Cant.</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", paddingLeft: 4 }}>Unidad</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", paddingLeft: 4 }}>Descripción</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", paddingLeft: 4 }}>P. unit. (opc)</span>
              <span />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {itemFields.map((field, idx) => (
                <div key={field.id} style={{ display: "grid", gridTemplateColumns: "80px 130px 1fr 120px 32px", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    style={{ ...INPUT_STYLE, textAlign: "center" }}
                    {...register(`items.${idx}.quantity` as const)}
                  />
                  <select
                    style={INPUT_STYLE}
                    {...register(`items.${idx}.unit` as const)}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    style={INPUT_STYLE}
                    placeholder="Descripción del material"
                    {...register(`items.${idx}.description` as const)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    style={INPUT_STYLE}
                    placeholder="$"
                    {...register(`items.${idx}.unit_price` as const)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={itemFields.length <= 1}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: "1px solid var(--border-default)",
                      background: "var(--badge-bg-red)", color: "var(--badge-text-red)",
                      cursor: itemFields.length <= 1 ? "not-allowed" : "pointer",
                      opacity: itemFields.length <= 1 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {errors.items ? (
              <p style={purchasesErrorTextStyle}>
                {errors.items.message || errors.items.root?.message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={addItem}
              style={{
                marginTop: 10,
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8,
                border: "1px dashed var(--border-strong)",
                background: "transparent", color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus size={14} /> Agregar renglón
            </button>
          </div>

          {formError ? (
            <div style={{ color: "var(--badge-text-red)", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              {formError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeCreateModal}>
              Cancelar
            </UiButton>
            {editingOrderId ? (
              <>
                <UiButton
                  type="submit"
                  form="purchases-create-form"
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => { saveAsPendingRef.current = false; }}
                >
                  {isSubmitting && !saveAsPendingRef.current ? "Guardando..." : "Guardar borrador"}
                </UiButton>
                <UiButton
                  type="submit"
                  form="purchases-create-form"
                  variant="primary"
                  disabled={isSubmitting}
                  onClick={() => { saveAsPendingRef.current = true; }}
                >
                  {isSubmitting && saveAsPendingRef.current ? "Guardando..." : "Guardar y marcar Pendiente firma"}
                </UiButton>
              </>
            ) : (
              <UiButton type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear orden de compra"}
              </UiButton>
            )}
          </div>
        </form>
      </Modal>

      {/* ═══════════ Modal Confirmar cancelación ═══════════ */}
      <Modal
        open={cancelTarget !== null}
        onClose={() => { if (!cancelling) setCancelTarget(null); }}
        title="¿Cancelar orden de compra?"
        maxWidth="460px"
      >
        {cancelTarget ? (
          <>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              La OC <strong style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{cancelTarget.folio}</strong> será marcada como cancelada. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <UiButton
                type="button"
                variant="secondary"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                No, mantener
              </UiButton>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 16px", borderRadius: 12,
                  border: "1px solid var(--badge-text-red)",
                  background: "var(--badge-text-red)",
                  color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: cancelling ? "wait" : "pointer",
                  opacity: cancelling ? 0.7 : 1,
                }}
              >
                {cancelling ? "Cancelando..." : "Sí, cancelar"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      {/* ═══════════ Modal Registrar factura ═══════════ */}
      {/* Input oculto para XML */}
      <input
        ref={xmlFileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        style={{ display: "none" }}
        onChange={handleXmlUpload}
      />

      <Modal
        open={invoiceTarget !== null}
        onClose={() => {
          if (!savingInvoice) {
            setInvoiceTarget(null);
            setInvoiceForm({ number: "", amount: "", date: "", notes: "" });
            resetXmlState();
          }
        }}
        title="Registrar factura"
        subtitle={invoiceTarget ? `OC ${invoiceTarget.folio}` : undefined}
        maxWidth="580px"
      >
        {invoiceTarget ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ── Sección XML del SAT ── */}
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: xmlUploaded ? "#f0fdf4" : "var(--bg-input)",
              border: `1px solid ${xmlUploaded ? "#86efac" : "var(--border-default)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {xmlUploaded ? "✓ XML procesado" : "Subir XML del SAT"}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {xmlUploaded
                      ? "Los campos se pre-llenaron automáticamente."
                      : "Opcional — pre-llena los campos desde el comprobante fiscal."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => xmlFileInputRef.current?.click()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 8, flexShrink: 0,
                    border: `1px solid ${xmlUploaded ? "#22c55e" : "var(--border-strong)"}`,
                    background: xmlUploaded ? "#dcfce7" : "var(--bg-card)",
                    color: xmlUploaded ? "#166534" : "var(--text-secondary)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <Upload size={13} />
                  {xmlUploaded ? "Reemplazar" : "Seleccionar XML"}
                </button>
              </div>

              {/* RFC del emisor */}
              {xmlUploaded && xmlRfcEmisor ? (() => {
                const supplier = suppliers.find((s) => s.id === invoiceTarget.supplier_id);
                const rfcMatch = Boolean(
                  supplier?.tax_id &&
                  supplier.tax_id.toUpperCase() === xmlRfcEmisor.toUpperCase()
                );
                return (
                  <div style={{
                    marginTop: 10, padding: "8px 10px", borderRadius: 8,
                    background: rfcMatch ? "#dcfce7" : "#fefce8",
                    border: `1px solid ${rfcMatch ? "#86efac" : "#fde047"}`,
                    fontSize: 12,
                    color: rfcMatch ? "#166534" : "#92400e",
                  }}>
                    RFC Emisor: <strong>{xmlRfcEmisor}</strong>
                    {xmlNombreEmisor ? ` — ${xmlNombreEmisor}` : ""}
                    {rfcMatch
                      ? " ✓ Coincide con el proveedor"
                      : ` (proveedor tiene: ${supplier?.tax_id ?? "sin RFC"})`}
                  </div>
                );
              })() : null}

              {/* Tabla de conceptos */}
              {xmlUploaded && xmlConceptos.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Conceptos del XML ({xmlConceptos.length})
                  </p>
                  <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#dcfce7" }}>
                          <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, color: "#166534" }}>Descripción</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>Cant.</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>P. Unit.</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xmlConceptos.map((c, i) => (
                          <tr key={i} style={{ borderTop: "1px solid #bbf7d0" }}>
                            <td style={{ padding: "6px 10px", color: "var(--text-primary)" }}>{c.descripcion}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{c.cantidad}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text-secondary)" }}>
                              {Number(c.valorUnitario) > 0
                                ? `$${Number(c.valorUnitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>
                              {Number(c.importe) > 0
                                ? `$${Number(c.importe).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Separador */}
            <div style={{ borderTop: "1px solid var(--border-default)", margin: "0 -4px" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Número de factura *</label>
              <input
                type="text"
                value={invoiceForm.number}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, number: e.target.value }))}
                placeholder="A-1234"
                style={{
                  padding: 10, borderRadius: 8, fontSize: 13,
                  background: "var(--bg-input)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Monto real *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                style={{
                  padding: 10, borderRadius: 8, fontSize: 13,
                  background: "var(--bg-input)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Fecha de factura *</label>
              <input
                type="date"
                value={invoiceForm.date}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, date: e.target.value }))}
                style={{
                  padding: 10, borderRadius: 8, fontSize: 13,
                  background: "var(--bg-input)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Notas (opcional)</label>
              <textarea
                rows={3}
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observaciones, diferencias con la OC, etc."
                style={{
                  padding: 10, borderRadius: 8, fontSize: 13,
                  background: "var(--bg-input)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                  resize: "vertical", fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <UiButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setInvoiceTarget(null);
                  setInvoiceForm({ number: "", amount: "", date: "", notes: "" });
                  resetXmlState();
                }}
                disabled={savingInvoice}
              >
                Cancelar
              </UiButton>
              <button
                type="button"
                onClick={() => void saveInvoice()}
                disabled={savingInvoice}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 16px", borderRadius: 12,
                  border: "1px solid #7c3aed",
                  background: "#7c3aed",
                  color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: savingInvoice ? "wait" : "pointer",
                  opacity: savingInvoice ? 0.7 : 1,
                }}
              >
                {savingInvoice ? "Guardando..." : "Guardar factura"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ═══════════ Modal Devolución ═══════════ */}
      {returnTarget ? (
        <ReturnModal
          oc={{
            id:            returnTarget.id,
            folio:         returnTarget.folio,
            supplier_name: returnTarget.supplier_name,
            ticket_number: returnTarget.ticket_number,
            company_id:    user?.company_id,
          }}
          items={(itemsByOrderId[returnTarget.id] || []).map((it) => ({
            id:                it.id,
            description:       it.description,
            quantity:          it.quantity,
            unit:              it.unit,
            quantity_received: it.quantity_received,
          }))}
          isOpen={true}
          onClose={() => setReturnTarget(null)}
          onSuccess={() => {
            if (user?.company_id) void loadAll(user.company_id);
          }}
        />
      ) : null}

    </PageContainer>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  color: "var(--text-primary)",
  textAlign: "center",
};

/* ── Estilos del navegador de mes (idem a /collections) ────────── */

const monthNavStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
};

const monthNavBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-page)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  flexShrink: 0,
};

const monthNavLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  minWidth: 140,
  textAlign: "center",
};
