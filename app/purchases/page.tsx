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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import {
  FileText,
  MoreVertical,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";

/* ── Types ─────────────────────────────────────────────────────── */

type Status = "pending" | "sent" | "received" | "cancelled";

type SupplierOption = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  customer_number: string | null;
  cfdi_use: string | null;
};

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
};

type PurchaseOrder = {
  id:                   string;
  folio:                string;
  supplier_id:          string;
  maintenance_log_id:   string | null;
  building_id:          string | null;
  project_description:  string | null;
  responsible_name:     string | null;
  responsible_phone:    string | null;
  signer_name:          string | null;
  status:               Status;
  notes:                string | null;
  total_estimated:      number | null;
  created_at:           string;
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
  pending:   "Pendiente",
  sent:      "Enviada",
  received:  "Recibida",
  cancelled: "Cancelada",
};

const STATUS_VARIANT: Record<Status, "amber" | "blue" | "green" | "red"> = {
  pending:   "amber",
  sent:      "blue",
  received:  "green",
  cancelled: "red",
};

const UNITS = ["Pieza", "Metro", "Litro", "Tubo", "Caja", "Rollo", "Bolsa", "Otro"];

const EMPTY_ITEM: ItemDraft = { description: "", quantity: "1", unit: "Pieza", unit_price: "" };

type ManualForm = {
  supplierId:          string;
  buildingId:          string;
  projectDescription:  string;
  responsibleName:    string;
  responsiblePhone:   string;
  items:               ItemDraft[];
};

const EMPTY_MANUAL_FORM: ManualForm = {
  supplierId: "", buildingId: "", projectDescription: "",
  responsibleName: "", responsiblePhone: "",
  items: [{ ...EMPTY_ITEM }],
};

/* ── Component ─────────────────────────────────────────────────── */

export default function PurchasesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [orders,     setOrders]     = useState<PurchaseOrder[]>([]);
  const [suppliers,  setSuppliers]  = useState<SupplierOption[]>([]);
  const [buildings,  setBuildings]  = useState<BuildingOption[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLogoPrint, setCompanyLogoPrint] = useState("");
  const [companyLogoUrl,   setCompanyLogoUrl]   = useState("");

  /* Filtros */
  const [filterSupplier, setFilterSupplier] = useState("ALL");
  const [filterStatus,   setFilterStatus]   = useState<"ALL" | Status>("ALL");
  const [search,         setSearch]         = useState("");

  /* Menu contextual */
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /* Modales */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<PurchaseOrder | null>(null);
  const [detailItems,     setDetailItems]     = useState<POItem[]>([]);
  const [showStatusModal, setShowStatusModal] = useState<PurchaseOrder | null>(null);
  const [newStatus,       setNewStatus]       = useState<Status>("pending");

  /* Form manual */
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [customResponsibleName, setCustomPickupName] = useState(false);

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
    ] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(`
          id, folio, status, created_at, company_id,
          total_estimated, notes, project_description,
          responsible_name, responsible_phone, signer_name,
          maintenance_log_id, building_id,
          supplier_id,
          suppliers(id, name, email, phone, tax_id),
          buildings(id, name)
        `)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("purchase_order_items")
        .select("id, purchase_order_id, description, quantity, unit, unit_price")
        .is("deleted_at", null),

      supabase
        .from("suppliers")
        .select("id, name, tax_id, email, phone, address, customer_number, cfdi_use")
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
        .select("name, logo_url, logo_print_url")
        .eq("id", companyId)
        .single(),
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
      maintenance_log_id: string | null; building_id: string | null;
      project_description: string | null;
      responsible_name: string | null; responsible_phone: string | null;
      signer_name: string | null;
      status: Status; notes: string | null; total_estimated: number | null;
      created_at: string;
      suppliers: { id: string; name: string; email: string | null; phone: string | null; tax_id: string | null } | null;
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
        maintenance_log_id:   r.maintenance_log_id,
        building_id:          r.building_id,
        project_description:  r.project_description,
        responsible_name:     r.responsible_name,
        responsible_phone:    r.responsible_phone,
        signer_name:          r.signer_name,
        status:               r.status,
        notes:                r.notes,
        total_estimated:      r.total_estimated ?? (agg?.total || 0),
        created_at:           r.created_at,
        supplier_name:        r.suppliers?.name,
        ticket_number:        r.maintenance_log_id ? ticketMap.get(r.maintenance_log_id) ?? null : null,
        building_name:        r.buildings?.name,
        item_count:           agg?.count || 0,
      };
    });

    setOrders(enriched);
    setSuppliers((supplierData as SupplierOption[]) || []);
    setBuildings((buildingData as BuildingOption[]) || []);

    if (companyData && "name" in companyData) {
      const cd = companyData as { name: string; logo_url?: string; logo_print_url?: string };
      setCompanyName(cd.name || "");
      setCompanyLogoUrl(cd.logo_url || "");
      setCompanyLogoPrint(cd.logo_print_url || "");
    }

    setLoading(false);
  }

  /* ── Metrics ───────────────────────────────────────────────────── */

  const metrics = useMemo(() => {
    const total     = orders.length;
    const pending   = orders.filter(o => o.status === "pending").length;
    const sent      = orders.filter(o => o.status === "sent").length;
    const cancelled = orders.filter(o => o.status === "cancelled").length;
    return { total, pending, sent, cancelled };
  }, [orders]);

  /* ── Pickup person history (unique names ordered by recency) ──── */

  const responsibleHistory = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const o of orders) {
      const n = (o.responsible_name || "").trim();
      if (n && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        list.push(n);
        if (list.length >= 20) break;
      }
    }
    return list;
  }, [orders]);

  /* ── Filter ────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
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
  }, [orders, filterSupplier, filterStatus, search]);

  /* ── Folio generation ──────────────────────────────────────────── */

  async function generateNextFolio(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OC-${year}-`;
    const { data } = await supabase
      .from("purchase_orders")
      .select("folio")
      .eq("company_id", companyId)
      .like("folio", `${prefix}%`)
      .order("folio", { ascending: false })
      .limit(1);
    const last = (data as { folio: string }[] | null)?.[0]?.folio;
    let n = 1;
    if (last) {
      const m = last.match(/OC-\d{4}-(\d+)/);
      if (m) n = parseInt(m[1], 10) + 1;
    }
    return `${prefix}${String(n).padStart(4, "0")}`;
  }

  /* ── Create manual OC ──────────────────────────────────────────── */

  function openCreateModal() {
    setManualForm(EMPTY_MANUAL_FORM);
    setFormError("");
    setCustomPickupName(false);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setManualForm(EMPTY_MANUAL_FORM);
    setFormError("");
    setCustomPickupName(false);
  }

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setManualForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, ...patch } : it),
    }));
  }

  function addItem() {
    setManualForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(idx: number) {
    setManualForm(prev => ({
      ...prev,
      items: prev.items.length <= 1 ? prev.items : prev.items.filter((_, i) => i !== idx),
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user?.company_id) return;
    if (!manualForm.supplierId) { setFormError("Selecciona un proveedor."); return; }

    const validItems = manualForm.items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0
    );
    if (validItems.length === 0) {
      setFormError("Agrega al menos un material válido.");
      return;
    }

    setSaving(true);
    setFormError("");

    const folio = await generateNextFolio(user.company_id);

    const { data: inserted, error: insertErr } = await supabase
      .from("purchase_orders")
      .insert({
        company_id:           user.company_id,
        folio,
        supplier_id:          manualForm.supplierId,
        building_id:          manualForm.buildingId || null,
        project_description:  manualForm.projectDescription.trim() || null,
        responsible_name:     manualForm.responsibleName.trim()   || null,
        responsible_phone:    manualForm.responsiblePhone.trim()  || null,
        status:               "pending",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      setSaving(false);
      setFormError("No se pudo crear la orden de compra.");
      return;
    }

    const itemsPayload = validItems.map((it) => ({
      purchase_order_id: inserted.id,
      description:       it.description.trim(),
      quantity:          Number(it.quantity),
      unit:              it.unit,
      unit_price:        it.unit_price.trim() ? Number(it.unit_price) : null,
    }));

    await supabase.from("purchase_order_items").insert(itemsPayload);

    setSaving(false);
    closeCreateModal();
    setMsg("Orden de compra creada correctamente.");
    void loadAll(user.company_id);
  }

  /* ── Status change ─────────────────────────────────────────────── */

  function openStatusModal(order: PurchaseOrder) {
    setOpenMenuId(null);
    setNewStatus(order.status);
    setShowStatusModal(order);
  }

  async function handleStatusSave() {
    if (!showStatusModal || !user?.company_id) return;
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", showStatusModal.id);

    if (error) { setMsg("No se pudo actualizar el estado."); return; }

    setShowStatusModal(null);
    setMsg("Estado actualizado correctamente.");
    void loadAll(user.company_id);
  }

  /* ── Detail view ───────────────────────────────────────────────── */

  async function openDetail(order: PurchaseOrder) {
    setOpenMenuId(null);
    setShowDetailModal(order);
    setDetailItems([]);
    const { data } = await supabase
      .from("purchase_order_items")
      .select("id, description, quantity, unit, unit_price")
      .eq("purchase_order_id", order.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    setDetailItems((data as POItem[]) || []);
  }

  /* ── Archive ───────────────────────────────────────────────────── */

  async function handleArchive(id: string) {
    if (!user?.company_id) return;
    setOpenMenuId(null);
    if (!window.confirm("¿Archivar esta orden de compra?")) return;
    const { error } = await supabase
      .from("purchase_orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { setMsg("No se pudo archivar."); return; }
    setMsg("OC archivada correctamente.");
    void loadAll(user.company_id);
  }

  /* ── PDF generation ────────────────────────────────────────────── */

  async function handleGeneratePDF(order: PurchaseOrder) {
    setOpenMenuId(null);
    setGeneratingPdfId(order.id);
    try {
      const supplier = suppliers.find(s => s.id === order.supplier_id);
      const building = buildings.find(b => b.id === order.building_id);

      /* Items */
      const { data: itemRows } = await supabase
        .from("purchase_order_items")
        .select("description, quantity, unit, unit_price")
        .eq("purchase_order_id", order.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      const items = (itemRows as POItem[]) || [];

      async function compressLogoForPDF(imgUrl: string): Promise<string> {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const maxW = 300, maxH = 100;
            const ratio = Math.min(maxW / img.width, maxH / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => resolve("");
          img.src = imgUrl;
        });
      }

      const { default: jsPDF }     = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW   = 612;
      const marginL = 40;
      const marginR = 40;
      const contentW = pageW - marginL - marginR;

      const fechaStr = new Date(order.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
      const pdfLogoSrc = companyLogoPrint || companyLogoUrl;
      const compressedLogo = pdfLogoSrc ? await compressLogoForPDF(pdfLogoSrc) : "";

      /* ── HEADER ── */
      let cursorY  = 40;
      let logoEndX = marginL;

      if (compressedLogo) {
        try {
          const tmpImg = new Image();
          await new Promise<void>((res) => { tmpImg.onload = () => res(); tmpImg.onerror = () => res(); tmpImg.src = compressedLogo; });
          const logoMaxW = 120, logoMaxH = 60;
          const logoRatio = Math.min(logoMaxW / (tmpImg.width || 1), logoMaxH / (tmpImg.height || 1));
          const logoW = (tmpImg.width || logoMaxW) * logoRatio;
          const logoH = (tmpImg.height || logoMaxH) * logoRatio;
          doc.addImage(compressedLogo, "PNG", marginL, cursorY, logoW, logoH);
          logoEndX = marginL + logoW + 16;
        } catch { /* sin logo */ }
      }

      const headerRightX = logoEndX + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Orden de Compra", headerRightX, cursorY + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Folio: ${order.folio}`, headerRightX, cursorY + 30);
      doc.text(`Fecha: ${fechaStr}`, headerRightX, cursorY + 44);

      cursorY += 72;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(marginL, cursorY, pageW - marginR, cursorY);
      cursorY += 16;

      /* ── Cells ── */
      const cellH   = 36;
      const cellPad = 8;
      const colW    = (contentW - 8) / 2;
      const col2X   = marginL + colW + 8;

      function drawCell(x: number, y: number, w: number, label: string, value: string, fullWidth = false) {
        const cellWidth = fullWidth ? contentW : w;
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(x, y, cellWidth, cellH, 4, 4, "F");
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, cellWidth, cellH, 4, 4, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(label.toUpperCase(), x + cellPad, y + cellPad + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const maxValueW = cellWidth - cellPad * 2;
        const valueLines = doc.splitTextToSize(value || "—", maxValueW) as string[];
        doc.text(valueLines[0] ?? "—", x + cellPad, y + cellPad + 20);
      }

      const rowGap = cellH + 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("PROVEEDOR", marginL, cursorY);
      cursorY += 10;

      drawCell(marginL, cursorY, colW, "Nombre", supplier?.name || "—");
      drawCell(col2X,   cursorY, colW, "RFC",    supplier?.tax_id || "—");
      cursorY += rowGap;

      drawCell(marginL, cursorY, colW, "Email",    supplier?.email || "—");
      drawCell(col2X,   cursorY, colW, "Teléfono", supplier?.phone || "—");
      cursorY += rowGap;

      if (supplier?.address) {
        drawCell(marginL, cursorY, contentW, "Dirección", supplier.address, true);
        cursorY += rowGap;
      }

      cursorY += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("PROYECTO", marginL, cursorY);
      cursorY += 10;

      drawCell(marginL, cursorY, colW, "Edificio",   building?.name || "—");
      drawCell(col2X,   cursorY, colW, "Responsable", order.responsible_name || "—");
      cursorY += rowGap;

      drawCell(marginL, cursorY, colW, "Dirección", building?.address || "—");
      drawCell(col2X,   cursorY, colW, "Teléfono",  order.responsible_phone || "—");
      cursorY += rowGap;

      if (order.project_description) {
        const descLines = doc.splitTextToSize(order.project_description, contentW - cellPad * 2) as string[];
        const descH     = Math.max(cellH, cellPad * 2 + descLines.length * 12);
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(marginL, cursorY, contentW, descH, 4, 4, "F");
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.roundedRect(marginL, cursorY, contentW, descH, 4, 4, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("DESCRIPCIÓN DEL PROYECTO", marginL + cellPad, cursorY + cellPad + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(descLines, marginL + cellPad, cursorY + cellPad + 20);
        cursorY += descH + 6;
      }

      cursorY += 6;

      /* ── TABLA ── */
      const hasPrices = items.some(it => it.unit_price != null);
      type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginL, right: marginR },
        head: hasPrices
          ? [["#", "Descripción", "Cant.", "Unidad", "P. Unit.", "Importe"]]
          : [["#", "Descripción", "Cant.", "Unidad"]],
        body: items.length > 0
          ? items.map((it, i) => {
              const base = [String(i + 1), it.description, String(it.quantity), it.unit];
              if (hasPrices) {
                const up = it.unit_price ?? 0;
                const tot = Number(it.quantity || 0) * Number(up);
                base.push(up ? `$${up.toFixed(2)}` : "—");
                base.push(up ? `$${tot.toFixed(2)}` : "—");
              }
              return base;
            })
          : [["—", "Sin materiales registrados", "", "", ...(hasPrices ? ["", ""] : [])]],
        theme: "plain",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 8,
        },
        bodyStyles: {
          fontSize: 10,
          cellPadding: 8,
          textColor: [15, 23, 42],
        },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        styles: { lineColor: [229, 231, 235], lineWidth: 0.5 },
        columnStyles: hasPrices
          ? { 0: { cellWidth: 24 }, 2: { cellWidth: 44, halign: "center" }, 3: { cellWidth: 60 }, 4: { cellWidth: 70, halign: "right" }, 5: { cellWidth: 80, halign: "right" } }
          : { 0: { cellWidth: 24 }, 2: { cellWidth: 60, halign: "center" }, 3: { cellWidth: 60 } },
      });

      /* Total si hay precios */
      let finalY = (doc as DocWithAutoTable).lastAutoTable?.finalY ?? cursorY + 40;
      if (hasPrices) {
        const total = items.reduce(
          (acc, it) => acc + Number(it.quantity || 0) * Number(it.unit_price ?? 0),
          0,
        );
        finalY += 16;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`Total estimado: $${total.toFixed(2)} MXN`, pageW - marginR, finalY, { align: "right" });
        finalY += 8;
      }

      const footerY = finalY + 20;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(marginL, footerY, pageW - marginR, footerY);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generado por PropAdmin · ${companyName || ""} · ${fechaStr}`,
        marginL,
        footerY + 14,
      );

      doc.save(`${order.folio}.pdf`);
    } catch {
      setMsg("Error al generar el PDF.");
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

  return (
    <PageContainer>
      <PageHeader
        title="Compras"
        titleIcon={<ShoppingCart size={18} />}
        subtitle="Órdenes de compra generadas manualmente o desde tickets de mantenimiento."
        actions={
          <UiButton variant="primary" onClick={openCreateModal} icon={<Plus size={16} />}>
            Nueva OC manual
          </UiButton>
        }
      />

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

      {/* Métricas */}
      <AppGrid minWidth={200} style={{ marginBottom: 20 }}>
        <MetricCard label="Total OC"    value={metrics.total}     variant="neutral" icon={<ShoppingCart size={18} />} />
        <MetricCard label="Pendientes"  value={metrics.pending}   variant="amber" />
        <MetricCard label="Enviadas"    value={metrics.sent}      variant="blue"  />
        <MetricCard label="Canceladas"  value={metrics.cancelled} variant="red"   />
      </AppGrid>

      {/* Filtros */}
      <AppCard style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
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

          <select
            style={INPUT_STYLE}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "ALL" | Status)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="sent">Enviada</option>
            <option value="received">Recibida</option>
            <option value="cancelled">Cancelada</option>
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
      </AppCard>

      {/* Lista */}
      {loading ? (
        <AppCard><p style={{ margin: 0, color: "var(--text-muted)" }}>Cargando órdenes...</p></AppCard>
      ) : filtered.length === 0 ? (
        <AppCard>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {orders.length === 0
              ? "No hay órdenes de compra. Crea la primera con el botón de arriba."
              : "No hay órdenes con los filtros seleccionados."}
          </p>
        </AppCard>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(o => (
            <AppCard key={o.id} style={{ padding: 18, position: "relative", zIndex: openMenuId === o.id ? 10 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>

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
                            router.push(`/maintenance?expand=${o.maintenance_log_id}`);
                          }
                        }}
                        style={{ cursor: "pointer", textDecoration: "none" }}
                        title="Ver ticket en Mantenimiento"
                      >
                        <AppBadge variant="blue">
                          Ticket: {o.ticket_number ? `MT-${o.ticket_number}` : "Ver ticket"}
                        </AppBadge>
                      </span>
                    ) : (
                      <AppBadge variant="gray">Manual</AppBadge>
                    )}

                    <AppBadge variant={STATUS_VARIANT[o.status]}>
                      {STATUS_LABEL[o.status]}
                    </AppBadge>
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {o.supplier_name || "Sin proveedor"}
                  </div>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)" }}>
                    <span>
                      {new Date(o.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {o.building_name ? <span>· {o.building_name}</span> : null}
                    {(o.item_count ?? 0) > 0 ? <span>· {o.item_count} material{o.item_count !== 1 ? "es" : ""}</span> : null}
                  </div>

                  {o.project_description ? (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                      {o.project_description}
                    </div>
                  ) : null}
                </div>

                {/* Lado derecho — total + menú */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
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

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: 10,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)", color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>

                    {openMenuId === o.id ? (
                      <div
                        style={{
                          position: "absolute", top: 36, right: 0, minWidth: 180,
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 10,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                          zIndex: 10, overflow: "hidden",
                        }}
                      >
                        <MenuItem onClick={() => openDetail(o)}>Ver detalle</MenuItem>
                        <MenuItem onClick={() => openStatusModal(o)}>Cambiar estado</MenuItem>
                        <MenuItem onClick={() => handleGeneratePDF(o)}
                                  disabled={generatingPdfId === o.id}>
                          {generatingPdfId === o.id ? "Generando..." : "Generar PDF"}
                        </MenuItem>
                        <MenuItem onClick={() => handleArchive(o.id)} danger>Archivar</MenuItem>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {/* ═══════════ Modal Nueva OC manual ═══════════ */}
      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="Nueva orden de compra"
        subtitle="Crear una OC manual sin ticket asociado."
        maxWidth="800px"
      >
        <form onSubmit={handleCreate}>

          <AppFormField label="Proveedor" required>
            <select
              style={INPUT_STYLE}
              value={manualForm.supplierId}
              onChange={(e) => setManualForm({ ...manualForm, supplierId: e.target.value })}
            >
              <option value="">Selecciona un proveedor...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </AppFormField>

          <AppFormField label="Proyecto / Edificio">
            <select
              style={INPUT_STYLE}
              value={manualForm.buildingId}
              onChange={(e) => setManualForm({ ...manualForm, buildingId: e.target.value })}
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
              value={manualForm.projectDescription}
              onChange={(e) => setManualForm({ ...manualForm, projectDescription: e.target.value })}
              placeholder="Breve descripción del propósito de la compra..."
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Responsable de recoger">
              {customResponsibleName ? (
                <input
                  style={INPUT_STYLE}
                  value={manualForm.responsibleName}
                  onChange={(e) => setManualForm({ ...manualForm, responsibleName: e.target.value })}
                  placeholder="Nombre completo"
                  autoFocus
                />
              ) : (
                <select
                  style={INPUT_STYLE}
                  value={manualForm.responsibleName}
                  onChange={(e) => {
                    if (e.target.value === "__OTHER__") {
                      setCustomPickupName(true);
                      setManualForm({ ...manualForm, responsibleName: "" });
                    } else {
                      setManualForm({ ...manualForm, responsibleName: e.target.value });
                    }
                  }}
                >
                  <option value="">Sin responsable asignado</option>
                  {responsibleHistory.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="__OTHER__">+ Otro...</option>
                </select>
              )}
            </AppFormField>

            <AppFormField label="Teléfono del responsable">
              <input
                style={INPUT_STYLE}
                value={manualForm.responsiblePhone}
                onChange={(e) => setManualForm({ ...manualForm, responsiblePhone: e.target.value })}
                placeholder="+52 ..."
              />
            </AppFormField>
          </div>

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
              {manualForm.items.map((it, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "80px 130px 1fr 120px 32px", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    style={{ ...INPUT_STYLE, textAlign: "center" }}
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  />
                  <select
                    style={INPUT_STYLE}
                    value={it.unit}
                    onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    style={INPUT_STYLE}
                    placeholder="Descripción del material"
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    style={INPUT_STYLE}
                    placeholder="$"
                    value={it.unit_price}
                    onChange={(e) => updateItem(idx, { unit_price: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={manualForm.items.length <= 1}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: "1px solid var(--border-default)",
                      background: "var(--badge-bg-red)", color: "var(--badge-text-red)",
                      cursor: manualForm.items.length <= 1 ? "not-allowed" : "pointer",
                      opacity: manualForm.items.length <= 1 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

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

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <UiButton type="button" variant="secondary" onClick={closeCreateModal}>
              Cancelar
            </UiButton>
            <UiButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Creando..." : "Crear orden de compra"}
            </UiButton>
          </div>
        </form>
      </Modal>

      {/* ═══════════ Modal Cambiar estado ═══════════ */}
      <Modal
        open={showStatusModal !== null}
        onClose={() => setShowStatusModal(null)}
        title="Cambiar estado"
        subtitle={showStatusModal ? showStatusModal.folio : undefined}
        maxWidth="420px"
      >
        <AppFormField label="Nuevo estado">
          <select
            style={INPUT_STYLE}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as Status)}
          >
            <option value="pending">Pendiente</option>
            <option value="sent">Enviada</option>
            <option value="received">Recibida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </AppFormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <UiButton variant="secondary" onClick={() => setShowStatusModal(null)}>Cancelar</UiButton>
          <UiButton variant="primary" onClick={handleStatusSave}>Guardar</UiButton>
        </div>
      </Modal>

      {/* ═══════════ Modal Detalle ═══════════ */}
      <Modal
        open={showDetailModal !== null}
        onClose={() => setShowDetailModal(null)}
        title={showDetailModal?.folio || ""}
        subtitle={showDetailModal?.supplier_name || undefined}
        maxWidth="720px"
      >
        {showDetailModal ? (
          <div style={{ display: "grid", gap: 16 }}>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {showDetailModal.maintenance_log_id ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/maintenance?expand=${showDetailModal.maintenance_log_id}`)}
                  style={{ cursor: "pointer" }}
                  title="Ver ticket en Mantenimiento"
                >
                  <AppBadge variant="blue">
                    Ticket: {showDetailModal.ticket_number ? `MT-${showDetailModal.ticket_number}` : "Ver ticket"}
                  </AppBadge>
                </span>
              ) : (
                <AppBadge variant="gray">Manual</AppBadge>
              )}
              <AppBadge variant={STATUS_VARIANT[showDetailModal.status]}>
                {STATUS_LABEL[showDetailModal.status]}
              </AppBadge>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DetailRow label="Fecha" value={new Date(showDetailModal.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })} />
              <DetailRow label="Edificio" value={showDetailModal.building_name || "—"} />
              <DetailRow label="Responsable" value={showDetailModal.responsible_name || "—"} />
              <DetailRow label="Teléfono" value={showDetailModal.responsible_phone || "—"} />
            </div>

            {showDetailModal.project_description ? (
              <DetailRow label="Descripción del proyecto" value={showDetailModal.project_description} />
            ) : null}

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Materiales ({detailItems.length})
              </div>
              {detailItems.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>Cargando materiales...</p>
              ) : (
                <div style={{ border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-input)" }}>
                        <th style={thStyle}>Cant.</th>
                        <th style={thStyle}>Unidad</th>
                        <th style={{ ...thStyle, textAlign: "left" }}>Descripción</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>P. unit.</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map(it => (
                        <tr key={it.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                          <td style={tdStyle}>{it.quantity}</td>
                          <td style={tdStyle}>{it.unit}</td>
                          <td style={{ ...tdStyle, textAlign: "left" }}>{it.description}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{it.unit_price != null ? `$${Number(it.unit_price).toFixed(2)}` : "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {it.unit_price != null ? `$${(Number(it.quantity || 0) * Number(it.unit_price)).toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <UiButton
                variant="secondary"
                onClick={() => { if (showDetailModal) void handleGeneratePDF(showDetailModal); }}
                icon={<FileText size={14} />}
              >
                Generar PDF
              </UiButton>
              <UiButton variant="primary" onClick={() => setShowDetailModal(null)}>Cerrar</UiButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────────── */

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block", width: "100%",
        padding: "10px 14px", textAlign: "left",
        background: "transparent", border: "none",
        color: danger ? "var(--badge-text-red)" : "var(--text-primary)",
        fontSize: 13, cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
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
