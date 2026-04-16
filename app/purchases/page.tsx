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
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
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
import AppFormField from "@/components/AppFormField";

/* ── Types ─────────────────────────────────────────────────────── */

type Status = "pending" | "sent" | "received" | "cancelled";

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

type Collector = {
  id: string;
  name: string;
  phone: string | null;
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
  supplier_branch_id:   string | null;
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
  supplierBranchId:    string;
  buildingId:          string;
  projectDescription:  string;
  responsibleName:     string;
  responsiblePhone:    string;
  signerName:          string;
  items:               ItemDraft[];
};

const EMPTY_MANUAL_FORM: ManualForm = {
  supplierId: "", supplierBranchId: "", buildingId: "", projectDescription: "",
  responsibleName: "", responsiblePhone: "", signerName: "",
  items: [{ ...EMPTY_ITEM }],
};

/* ── Component ─────────────────────────────────────────────────── */

export default function PurchasesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const { legalName, companyAddress, companyTaxId, companyPhone, companyEmail, logoGroupUrl } = useTheme();

  const [orders,     setOrders]     = useState<PurchaseOrder[]>([]);
  const [suppliers,  setSuppliers]  = useState<SupplierOption[]>([]);
  const [buildings,  setBuildings]  = useState<BuildingOption[]>([]);
  const [signers,    setSigners]    = useState<Signer[]>([]);
  const [customSignerMode, setCustomSignerMode] = useState(false);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLogoPrint, setCompanyLogoPrint] = useState("");
  const [companyLogoUrl,   setCompanyLogoUrl]   = useState("");

  /* Filtros */
  const [filterSupplier, setFilterSupplier] = useState("ALL");
  const [filterStatus,   setFilterStatus]   = useState<"ALL" | Status>("ALL");
  const [search,         setSearch]         = useState("");

  /* Expansión inline de OC */
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [itemsByOrderId,  setItemsByOrderId]  = useState<Record<string, POItem[]>>({});
  const [loadingItemsFor, setLoadingItemsFor] = useState<string | null>(null);
  const [savingStatusFor, setSavingStatusFor] = useState<string | null>(null);

  /* Modal crear / editar */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrderId,  setEditingOrderId]  = useState<string | null>(null);

  /* Form manual */
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [customCollectorMode, setCustomCollectorMode] = useState(false);

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
      { data: collectorData                },
    ] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(`
          id, folio, status, created_at, company_id,
          total_estimated, notes, project_description,
          responsible_name, responsible_phone, signer_name,
          maintenance_log_id, building_id,
          supplier_id, supplier_branch_id,
          suppliers(id, name, contact_email, contact_phone, tax_id),
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
        .select(`
          id, name, tax_id, contact_name, contact_email, contact_phone,
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
        .select("name, logo_url, logo_print_url")
        .eq("id", companyId)
        .single(),

      supabase
        .from("purchase_order_signers")
        .select("id, name, is_default")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),

      supabase
        .from("purchase_order_collectors")
        .select("id, name, phone")
        .eq("company_id", companyId)
        .order("name", { ascending: true }),
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
      maintenance_log_id: string | null; building_id: string | null;
      project_description: string | null;
      responsible_name: string | null; responsible_phone: string | null;
      signer_name: string | null;
      status: Status; notes: string | null; total_estimated: number | null;
      created_at: string;
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

    type SupplierRow = {
      id: string; name: string; tax_id: string | null;
      contact_name: string | null; contact_email: string | null; contact_phone: string | null;
      client_number: string | null; cfdi_use: string | null;
      supplier_branches: Array<SupplierBranchOption & { active: boolean }> | null;
    };
    const suppliersMapped: SupplierOption[] = ((supplierData || []) as unknown as SupplierRow[]).map((s) => ({
      id:            s.id,
      name:          s.name,
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
    setCollectors((collectorData as Collector[]) || []);

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
    const defaultSigner = signers.find((s) => s.is_default)?.name || "";
    setManualForm({ ...EMPTY_MANUAL_FORM, signerName: defaultSigner });
    setFormError("");
    setCustomCollectorMode(false);
    setCustomSignerMode(false);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setEditingOrderId(null);
    setManualForm(EMPTY_MANUAL_FORM);
    setFormError("");
    setCustomCollectorMode(false);
    setCustomSignerMode(false);
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

    const payload = {
      supplier_id:          manualForm.supplierId,
      supplier_branch_id:   manualForm.supplierBranchId || null,
      building_id:          manualForm.buildingId || null,
      project_description:  manualForm.projectDescription.trim() || null,
      responsible_name:     manualForm.responsibleName.trim()   || null,
      responsible_phone:    manualForm.responsiblePhone.trim()  || null,
      signer_name:          manualForm.signerName.trim()        || null,
    };

    console.log("[purchases] manualForm snapshot:", manualForm);
    console.log("[purchases] payload:", payload);
    console.log("[purchases] editingOrderId:", editingOrderId);

    let targetOrderId: string | null = null;

    if (editingOrderId) {
      /* EDITAR: UPDATE purchase_orders + DELETE+INSERT items */
      console.log("[purchases] UPDATE purchase_orders", { id: editingOrderId, payload });
      const { data: updData, error: updErr } = await supabase
        .from("purchase_orders")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingOrderId)
        .select();
      console.log("[purchases] UPDATE result:", { data: updData, error: updErr });
      if (updErr) {
        setSaving(false);
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
      /* CREAR: generar folio + INSERT purchase_orders */
      const folio = await generateNextFolio(user.company_id);
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
        setSaving(false);
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
    const trimmedSigner = manualForm.signerName.trim();
    if (trimmedSigner) {
      const existsAlready = signers.some(
        (s) => s.name.toLowerCase() === trimmedSigner.toLowerCase()
      );
      if (!existsAlready) {
        await supabase.from("purchase_order_signers").insert({
          company_id: user.company_id,
          name:       trimmedSigner,
          is_default: false,
        });
      }
    }

    /* Si es un responsable nuevo (no estaba en el historial), persistir */
    const trimmedCollectorName  = manualForm.responsibleName.trim();
    const trimmedCollectorPhone = manualForm.responsiblePhone.trim();
    if (trimmedCollectorName) {
      const collectorExists = collectors.some(
        (c) => c.name.toLowerCase() === trimmedCollectorName.toLowerCase()
      );
      if (!collectorExists) {
        await supabase.from("purchase_order_collectors").insert({
          company_id: user.company_id,
          name:       trimmedCollectorName,
          phone:      trimmedCollectorPhone || null,
        });
      }
    }

    /* Refrescar items de la OC afectada (para que la vista expandida muestre los datos nuevos) */
    if (targetOrderId) {
      const tid = targetOrderId;
      const { data: freshItems } = await supabase
        .from("purchase_order_items")
        .select("id, description, quantity, unit, unit_price")
        .eq("purchase_order_id", tid)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      setItemsByOrderId((prev) => ({ ...prev, [tid]: (freshItems as POItem[]) || [] }));
    }

    setSaving(false);
    const wasEdit = !!editingOrderId;
    closeCreateModal();
    setMsg(wasEdit ? "Orden de compra actualizada correctamente." : "Orden de compra creada correctamente.");
    /* Recargar lista completa para refrescar conteos, total, signer_name, etc. */
    await loadAll(user.company_id);
  }

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
      .select("id, description, quantity, unit, unit_price")
      .eq("purchase_order_id", order.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[purchases] load items error:", error);
    }
    const rows = (data as POItem[]) || [];
    setItemsByOrderId((prev) => ({ ...prev, [order.id]: rows }));
    setLoadingItemsFor(null);
  }

  /* ── Status change (inline) ───────────────────────────────────── */

  async function handleStatusChange(order: PurchaseOrder, status: Status) {
    if (!user?.company_id || status === order.status) return;
    setSavingStatusFor(order.id);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    setSavingStatusFor(null);
    if (error) { setMsg("No se pudo actualizar el estado."); return; }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    setMsg("Estado actualizado correctamente.");
  }

  /* ── Editar OC: abrir modal con datos precargados ─────────────── */

  async function handleStartEditOrder(order: PurchaseOrder) {
    /* Cargar items si aún no están */
    let items: POItem[] = itemsByOrderId[order.id] || [];
    if (!itemsByOrderId[order.id]) {
      const { data } = await supabase
        .from("purchase_order_items")
        .select("id, description, quantity, unit, unit_price")
        .eq("purchase_order_id", order.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      items = (data as POItem[]) || [];
      setItemsByOrderId((prev) => ({ ...prev, [order.id]: items }));
    }

    setEditingOrderId(order.id);
    setManualForm({
      supplierId:          order.supplier_id,
      supplierBranchId:    order.supplier_branch_id || "",
      buildingId:          order.building_id || "",
      projectDescription:  order.project_description || "",
      responsibleName:     order.responsible_name   || "",
      responsiblePhone:    order.responsible_phone  || "",
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
    setCustomCollectorMode(false);
    setCustomSignerMode(false);
    setShowCreateModal(true);
  }

  /* ── Archive ───────────────────────────────────────────────────── */

  async function handleArchive(id: string) {
    if (!user?.company_id) return;
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
    setGeneratingPdfId(order.id);
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

      const { default: jsPDF } = await import("jspdf");

      /* Preparar ambos logos con aspect ratio correcto */
      const printSrc = companyLogoPrint || companyLogoUrl;
      const logoPrint = printSrc    ? await prepareLogoForPDF(printSrc,    110, 45) : null;
      const logoGroup = logoGroupUrl ? await prepareLogoForPDF(logoGroupUrl, 80, 45) : null;

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

      renderPurchaseOrderPage(doc, {
        folio:              order.folio,
        date:               new Date(order.created_at),
        supplierName:       supplier?.name || "",
        supplierTaxId:      supplier?.tax_id || null,
        cfdiUse:            supplier?.cfdi_use || null,
        clientNumber:       supplier?.client_number || null,
        branchName,
        items:              items.map((it) => ({ quantity: it.quantity, unit: it.unit, description: it.description })),
        buildingName:       building?.name || "",
        projectDescription: order.project_description || "",
        responsibleName:    order.responsible_name  || "",
        responsiblePhone:   order.responsible_phone || "",
        signerName:         order.signer_name       || "",
        logoPrint,
        logoGroup,
        company: { legalName, address: companyAddress, taxId: companyTaxId, phone: companyPhone, email: companyEmail },
      });

      doc.save(`${order.folio}.pdf`);
    } catch (err) {
      console.error("OC PDF error:", err);
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
          {filtered.map((o) => {
            const isExpanded = expandedOrderId === o.id;
            const items      = itemsByOrderId[o.id] || [];
            const hasPrices  = items.some((it) => it.unit_price != null);
            const supplier   = suppliers.find((s) => s.id === o.supplier_id);
            const branch     = o.supplier_branch_id
              ? (supplier?.branches || []).find((b) => b.id === o.supplier_branch_id) || null
              : null;
            const fechaCorta = new Date(o.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
            const fechaLarga = new Date(o.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

            return (
              <AppCard key={o.id} style={{ padding: 0, overflow: "hidden" }}>

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
                      {branch ? (
                        <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}> · {branch.name}</span>
                      ) : null}
                    </div>

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
                {isExpanded ? (
                  <div style={{
                    borderTop: "1px solid var(--border-default)",
                    padding: "16px 18px 20px",
                    display: "flex", flexDirection: "column", gap: 18,
                    background: "var(--bg-input)",
                  }}>

                    {/* ── Sección 1: Datos generales ── */}
                    <div>
                      <SectionLabel>Datos generales</SectionLabel>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                        <DetailRow label="Proveedor" value={o.supplier_name || "—"} />
                        {branch ? <DetailRow label="Sucursal" value={branch.name} /> : null}
                        <DetailRow label="RFC" value={supplier?.tax_id || "—"} />
                        <DetailRow label="Número de cliente" value={supplier?.client_number || "—"} />
                        <DetailRow label="Fecha" value={fechaLarga} />
                        <DetailRow label="Edificio / Proyecto" value={o.building_name || "—"} />
                        <DetailRow label="Responsable a recoger" value={o.responsible_name || "—"} />
                        <DetailRow label="Teléfono del responsable" value={o.responsible_phone || "—"} />
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
                        <div style={{
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
                                        {it.unit_price != null ? `$${Number(it.unit_price).toFixed(2)}` : "—"}
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "right" }}>
                                        {it.unit_price != null ? `$${(Number(it.quantity || 0) * Number(it.unit_price)).toFixed(2)}` : "—"}
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

                    {/* ── Sección 3: Acciones ── */}
                    <div>
                      <SectionLabel>Acciones</SectionLabel>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                            Cambiar estado:
                          </label>
                          <select
                            value={o.status}
                            disabled={savingStatusFor === o.id}
                            onChange={(e) => handleStatusChange(o, e.target.value as Status)}
                            style={{
                              padding: "8px 12px", borderRadius: 8,
                              border: "1px solid var(--border-default)",
                              background: "var(--bg-card)", color: "var(--text-primary)",
                              fontSize: 13, fontWeight: 600,
                              cursor: savingStatusFor === o.id ? "wait" : "pointer",
                              opacity: savingStatusFor === o.id ? 0.7 : 1,
                            }}
                          >
                            <option value="pending">Pendiente</option>
                            <option value="sent">Enviada</option>
                            <option value="received">Recibida</option>
                            <option value="cancelled">Cancelada</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleArchive(o.id)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "9px 14px", borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--badge-bg-red)", color: "var(--badge-text-red)",
                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                            marginLeft: "auto",
                          }}
                        >
                          <Trash2 size={14} />
                          Archivar
                        </button>
                      </div>
                    </div>

                  </div>
                ) : null}
              </AppCard>
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
        <form onSubmit={handleCreate}>

          <AppFormField label="Proveedor" required>
            <select
              style={INPUT_STYLE}
              value={manualForm.supplierId}
              onChange={(e) => setManualForm({
                ...manualForm,
                supplierId:       e.target.value,
                supplierBranchId: "",
              })}
            >
              <option value="">Selecciona un proveedor...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </AppFormField>

          {manualForm.supplierId ? (() => {
            const selected  = suppliers.find(s => s.id === manualForm.supplierId);
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
                    value={manualForm.supplierBranchId}
                    onChange={(e) => setManualForm({ ...manualForm, supplierBranchId: e.target.value })}
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
            <AppFormField label="Responsable a recoger">
              {customCollectorMode ? (
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
                    const val = e.target.value;
                    if (val === "__OTHER__") {
                      setCustomCollectorMode(true);
                      setManualForm({ ...manualForm, responsibleName: "", responsiblePhone: "" });
                    } else if (val === "") {
                      setManualForm({ ...manualForm, responsibleName: "", responsiblePhone: "" });
                    } else {
                      /* Autocompletar teléfono del collector seleccionado */
                      const selected = collectors.find((c) => c.name === val);
                      setManualForm({
                        ...manualForm,
                        responsibleName:  val,
                        responsiblePhone: selected?.phone || manualForm.responsiblePhone,
                      });
                    }
                  }}
                >
                  <option value="">Sin responsable asignado</option>
                  {collectors.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
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

          <AppFormField label="Quién autoriza / firmante">
            {customSignerMode ? (
              <input
                style={INPUT_STYLE}
                value={manualForm.signerName}
                onChange={(e) => setManualForm({ ...manualForm, signerName: e.target.value })}
                placeholder="Nombre del firmante"
                autoFocus
              />
            ) : (
              <select
                style={INPUT_STYLE}
                value={manualForm.signerName}
                onChange={(e) => {
                  if (e.target.value === "__OTHER__") {
                    setCustomSignerMode(true);
                    setManualForm({ ...manualForm, signerName: "" });
                  } else {
                    setManualForm({ ...manualForm, signerName: e.target.value });
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
              {saving
                ? (editingOrderId ? "Guardando..." : "Creando...")
                : (editingOrderId ? "Guardar cambios" : "Crear orden de compra")}
            </UiButton>
          </div>
        </form>
      </Modal>

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
