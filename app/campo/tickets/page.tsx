"use client";

/*
  Portal de campo — Tickets.
  - Camera inputs OUTSIDE any modal/sheet (FIX 1)
  - Área selector con áreas fijas + departamentos (FIX 3)
  - Asset relacionado (FIX 4)
  - Draft en localStorage (FIX 5)
  - Expansión inline con fotos, materiales y botones de estado (FIX 6)
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Building2, Calendar, Camera, Check, ChevronDown, ChevronUp, Image as ImageIcon, Play, Plus, Trash2, X } from "lucide-react";

import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Webcam from "react-webcam";

import { sortByNatural } from "@/lib/sort-utils";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import Modal from "@/components/Modal";

/* ── Types ─────────────────────────────────────────────────────── */

type Ticket = {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  building_id: string | null;
  created_at: string;
  photos: string[] | null;
  buildings: { name: string } | null;
  units: { display_code: string | null; unit_number: string | null } | null;
};

type Building = { id: string; name: string };
type Unit     = { id: string; unit_number: string | null; display_code: string | null };
type Asset    = { id: string; name: string; asset_type: string | null };

type SupplierSimple = { id: string; name: string; prefix?: string | null };

type MaterialRow = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  supplier_id: string | null;
  supplier_name: string;
};

type MaterialGroup = {
  supplier_id: string | null;
  supplier_name: string;
  materials: MaterialRow[];
};

type CreatePhoto = {
  id: string;
  localUrl: string;
  publicUrl: string | null;
  uploading: boolean;
};

type CreateForm = {
  title:      string;
  buildingId: string;
  area:       string;  // fixed area key OR unit_id
  assetId:    string;
  priority:   string;
  desc:       string;
};

const DEFAULT_FORM: CreateForm = {
  title: "", buildingId: "", area: "", assetId: "", priority: "normal", desc: "",
};

const DRAFT_KEY = "campo_ticket_draft";

const FIXED_AREAS = [
  { value: "areas_comunes",   label: "Áreas comunes"      },
  { value: "cuarto_maquinas", label: "Cuarto de máquinas" },
  { value: "cochera",         label: "Cochera"            },
  { value: "otro_area",       label: "Otra área"          },
];
const FIXED_AREA_VALUES = new Set(FIXED_AREAS.map(a => a.value));

type StatusFilter = "all" | "pending" | "in_progress" | "resolved";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", in_progress: "En proceso", resolved: "Resuelto", cancelled: "Cancelado",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja", normal: "Normal", medium: "Media", high: "Alta", urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--badge-text-red)",
  high:   "var(--badge-text-amber)",
  medium: "var(--badge-text-amber)",
  normal: "var(--badge-text-blue)",
  low:    "var(--text-muted)",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  pending:     { bg: "var(--badge-bg-amber)", text: "var(--badge-text-amber)" },
  in_progress: { bg: "var(--badge-bg-blue)",  text: "var(--badge-text-blue)"  },
  resolved:    { bg: "var(--badge-bg-green)", text: "var(--badge-text-green)" },
  cancelled:   { bg: "var(--badge-bg-gray)",  text: "var(--badge-text-gray)"  },
};

const MATERIAL_UNITS = ["Pieza", "Metro", "Litro", "Tubo", "Caja", "Rollo", "Bolsa", "Otro"];

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendiente" },
  { key: "in_progress", label: "En proceso" },
  { key: "resolved", label: "Resuelto" },
];

/* ── Component ─────────────────────────────────────────────────── */

export default function CampoTicketsPage() {
  const { user, loading } = useCurrentUser();

  /* List */
  const [tickets,     setTickets]     = useState<Ticket[]>([]);
  const [buildings,   setBuildings]   = useState<Building[]>([]);
  const [filter,      setFilter]      = useState<StatusFilter>("all");
  const [loadingData, setLoadingData] = useState(true);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  /* Detail per ticket — materiales agrupados por proveedor */
  const [ticketMaterialGroups, setTicketMaterialGroups] = useState<Record<string, MaterialGroup[]>>({});
  const [ticketMatsLoading, setTicketMatsLoading] = useState<Record<string, boolean>>({});
  const [savingMatsFor,     setSavingMatsFor]     = useState<string | null>(null);
  const [updatingStatusFor, setUpdatingStatusFor] = useState<string | null>(null);
  const addingPhotoForRef = useRef<string | null>(null);

  /* Proveedores (para selector de grupo) */
  const [suppliers, setSuppliers] = useState<SupplierSimple[]>([]);
  const [showSupplierPicker, setShowSupplierPicker] = useState<string | null>(null); /* ticketId o null */

  /* Create form */
  const [createOpen,  setCreateOpen]  = useState(false);
  const [form,        setForm]        = useState<CreateForm>(DEFAULT_FORM);
  const [hasDraft,    setHasDraft]    = useState(false);
  const [cPhotos,     setCPhotos]     = useState<CreatePhoto[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [createError, setCreateError] = useState("");

  /* Building-dependent data */
  const [buildingUnits,  setBuildingUnits]  = useState<Unit[]>([]);
  const [buildingAssets, setBuildingAssets] = useState<Asset[]>([]);
  const [loadingDeps,    setLoadingDeps]    = useState(false);

  /* Foto picker — "create" | ticketId | null */
  const [photoPicker, setPhotoPicker] = useState<"create" | string | null>(null);

  /* Webcam modal — "create" | ticketId | null. Reemplaza el capture nativo
     de iOS que no se llevaba bien con el sheet del photo picker. */
  const [webcamOpen, setWebcamOpen] = useState<"create" | string | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);

  /* File refs — inputs FUERA de cualquier modal (evita dismiss en iOS) */
  const createGalleryRef = useRef<HTMLInputElement>(null); // crear ticket, carrete
  const detailGalleryRef = useRef<HTMLInputElement>(null); // ticket existente, carrete

  /* ── Load ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (!loading && user?.company_id) void loadData(user.company_id);
  }, [loading, user]);

  async function loadData(companyId: string) {
    setLoadingData(true);
    const [ticketsRes, buildingsRes, suppliersRes] = await Promise.all([
      supabase
        .from("maintenance_logs")
        .select(`
          id, ticket_number, title, description, status, priority, building_id, created_at, photos,
          buildings(name),
          units(display_code, unit_number)
        `)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("suppliers")
        .select("id, name, prefix")
        .eq("company_id", companyId)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name"),
    ]);
    setTickets((ticketsRes.data as unknown as Ticket[]) || []);
    setBuildings(buildingsRes.data || []);
    setSuppliers((suppliersRes.data as SupplierSimple[]) || []);
    setLoadingData(false);
  }

  /* ── Draft ──────────────────────────────────────────────────── */

  function setField<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function openCreate() {
    const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
    if (raw) {
      try {
        const d = JSON.parse(raw) as Partial<CreateForm>;
        const restored: CreateForm = { ...DEFAULT_FORM, ...d };
        setForm(restored);
        setHasDraft(true);
        if (restored.buildingId) {
          void loadBuildingDeps(restored.buildingId);
          if (restored.area) void loadAssetsForArea(restored.buildingId, restored.area);
        }
      } catch {
        setForm(DEFAULT_FORM);
        setHasDraft(false);
      }
    } else {
      setForm(DEFAULT_FORM);
      setHasDraft(false);
    }
    setCPhotos([]);
    setCreateError("");
    setCreateOpen(true);
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setForm(DEFAULT_FORM);
    setHasDraft(false);
    setBuildingUnits([]);
    setBuildingAssets([]);
    setCPhotos([]);
  }

  function resetAndClose() {
    localStorage.removeItem(DRAFT_KEY);
    setForm(DEFAULT_FORM);
    setHasDraft(false);
    setCPhotos([]);
    setCreateError("");
    setCreateOpen(false);
    setBuildingUnits([]);
    setBuildingAssets([]);
  }

  /* ── Building deps ──────────────────────────────────────────── */

  async function loadBuildingDeps(buildingId: string) {
    if (!user?.company_id || !buildingId) {
      setBuildingUnits([]); setBuildingAssets([]); return;
    }
    setLoadingDeps(true);
    const [unitsRes, assetsRes] = await Promise.all([
      supabase
        .from("units")
        .select("id, unit_number, display_code")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("unit_number"),
      supabase
        .from("assets")
        .select("id, name, asset_type")
        .eq("building_id", buildingId)
        .eq("company_id", user.company_id)
        .is("unit_id", null)      // solo activos de nivel edificio por defecto
        .is("deleted_at", null)
        .order("name"),
    ]);
    const sortedUnits = sortByNatural((unitsRes.data || []) as Unit[], u => u.unit_number);
    setBuildingUnits(sortedUnits);
    setBuildingAssets(assetsRes.data || []);
    setLoadingDeps(false);
  }

  /* Recarga assets según el área seleccionada */
  async function loadAssetsForArea(buildingId: string, area: string) {
    if (!user?.company_id || !buildingId) return;
    const isFixed = FIXED_AREA_VALUES.has(area) || !area;
    let q = supabase
      .from("assets")
      .select("id, name, asset_type")
      .eq("building_id", buildingId)
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .order("name");
    if (isFixed) {
      // Área común / cochera / etc → solo activos del edificio (sin departamento)
      q = q.is("unit_id", null);
    } else {
      // Departamento seleccionado → activos del edificio + activos del depto
      q = q.or(`unit_id.is.null,unit_id.eq.${area}`);
    }
    const { data } = await q;
    setBuildingAssets(data || []);
  }

  async function handleAreaChange(area: string) {
    setForm(prev => {
      const next = { ...prev, area, assetId: "" };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
    void loadAssetsForArea(form.buildingId, area);
  }

  function handleBuildingChange(buildingId: string) {
    setForm(prev => {
      const next = { ...prev, buildingId, area: "", assetId: "" };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
    if (buildingId) void loadBuildingDeps(buildingId);
    else { setBuildingUnits([]); setBuildingAssets([]); }
  }

  /* ── Photo picker helpers ───────────────────────────────────── */

  function triggerInput(ref: React.RefObject<HTMLInputElement | null>) {
    setPhotoPicker(null);
    // pequeño timeout para que el sheet se cierre antes de abrir el picker
    setTimeout(() => ref.current?.click(), 80);
  }

  /* ── Camera: create ─────────────────────────────────────────── */

  async function handleCreatePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user?.id) return;
    e.target.value = "";

    for (const file of files) {
      const id       = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const localUrl = URL.createObjectURL(file);
      setCPhotos(prev => [...prev, { id, localUrl, publicUrl: null, uploading: true }]);

      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path      = `temp/${user.id}-${id}-${cleanName}`;
      const { data, error: uploadErr } = await supabase.storage
        .from("maintenance-photos")
        .upload(path, file);
      if (uploadErr) {
        console.error("Upload error detail:", JSON.stringify(uploadErr));
        toast.error("Error al subir: " + uploadErr.message);
        setCPhotos(prev => prev.filter(p => p.id !== id));
        continue;
      }
      const { data: urlData } = supabase.storage.from("maintenance-photos").getPublicUrl(path);
      setCPhotos(prev => prev.map(p =>
        p.id === id
          ? { ...p, publicUrl: urlData?.publicUrl || null, uploading: false }
          : p
      ));
    }
  }

  function removeCreatePhoto(id: string) {
    setCPhotos(prev => prev.filter(p => p.id !== id));
  }

  /* ── Camera: detail (add to existing) ──────────────────────── */

  async function handleDetailPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const ticketId = addingPhotoForRef.current;
    if (files.length === 0 || !ticketId || !user?.company_id) return;
    e.target.value = "";

    const ticket = tickets.find(t => t.id === ticketId);
    const folder = ticket?.ticket_number || ticketId;

    const newUrls: string[] = [];
    for (const file of files) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path      = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanName}`;
      const { data, error: uploadErr } = await supabase.storage
        .from("maintenance-photos")
        .upload(path, file);
      if (uploadErr) {
        console.error("Upload error detail:", JSON.stringify(uploadErr));
        toast.error("Error al subir: " + uploadErr.message);
        continue;
      }
      const { data: urlData } = supabase.storage.from("maintenance-photos").getPublicUrl(path);
      if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
    }
    if (newUrls.length === 0) return;
    const updated = [...(ticket?.photos || []), ...newUrls];
    await supabase.from("maintenance_logs").update({ photos: updated }).eq("id", ticketId);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, photos: updated } : t));
  }

  /* ── Webcam: capturar foto y reutilizar los handlers de upload existentes ── */

  const handleCapturePhoto = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    /* Convertir el data URL base64 que devuelve react-webcam en un File
       para reutilizar los handlers handleCreatePhoto/handleDetailPhoto. */
    const res = await fetch(imageSrc);
    const blob = await res.blob();
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });

    /* Capturar el destino antes de cerrar el modal (el setState es async). */
    const target = webcamOpen;
    setWebcamOpen(null);

    if (target === "create") {
      const dt = new DataTransfer();
      dt.items.add(file);
      const fakeEvent = { target: { files: dt.files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
      void handleCreatePhoto(fakeEvent);
    } else if (target) {
      /* target es un ticketId */
      addingPhotoForRef.current = target;
      const dt = new DataTransfer();
      dt.items.add(file);
      const fakeEvent = { target: { files: dt.files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
      void handleDetailPhoto(fakeEvent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamOpen]);

  /* ── Create ─────────────────────────────────────────────────── */

  async function handleCreate() {
    if (!user?.company_id) return;
    if (!form.title.trim()) { setCreateError("Escribe un título."); return; }
    if (cPhotos.some(p => p.uploading)) { setCreateError("Espera a que terminen de subir las fotos."); return; }
    setCreateError("");
    setSaving(true);

    const photoUrls: string[] = cPhotos
      .filter(p => p.publicUrl)
      .map(p => p.publicUrl as string);

    const isFixedArea = FIXED_AREA_VALUES.has(form.area);
    const unitId      = !isFixedArea && form.area ? form.area : null;
    const areaLabel   = isFixedArea ? (FIXED_AREAS.find(a => a.value === form.area)?.label || null) : null;

    const { error } = await supabase.from("maintenance_logs").insert({
      company_id:             user.company_id,
      building_id:            form.buildingId || null,
      unit_id:                unitId,
      title:                  form.title.trim(),
      description:            form.desc.trim() || null,
      priority:               form.priority,
      status:                 "pending",
      log_type:               "corrective",
      photos:                 photoUrls,
      reported_by:            user.full_name || user.email,
      category_name_snapshot: areaLabel,
    });

    setSaving(false);
    if (error) { setCreateError("No se pudo crear el ticket."); return; }
    resetAndClose();
    void loadData(user.company_id);
  }

  /* ── Expand ─────────────────────────────────────────────────── */

  async function handleToggleExpand(ticketId: string) {
    if (expandedId === ticketId) { setExpandedId(null); return; }
    setExpandedId(ticketId);
    if (!ticketMaterialGroups[ticketId]) {
      setTicketMatsLoading(prev => ({ ...prev, [ticketId]: true }));
      const { data } = await supabase
        .from("maintenance_materials")
        .select("id, description, quantity, unit, supplier_id, suppliers(name)")
        .eq("maintenance_log_id", ticketId)
        .order("created_at");

      type MatRaw = {
        id: string; description: string; quantity: number; unit: string;
        supplier_id: string | null;
        suppliers: { name: string } | null;
      };

      /* Agrupar por supplier_id */
      const groupMap = new Map<string, MaterialGroup>();
      for (const m of ((data || []) as unknown as MatRaw[])) {
        const key = m.supplier_id || "__otro__";
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            supplier_id:   m.supplier_id,
            supplier_name: m.suppliers?.name || "Otro",
            materials:     [],
          });
        }
        groupMap.get(key)!.materials.push({
          id:            m.id,
          description:   m.description || "",
          quantity:      String(m.quantity || ""),
          unit:          m.unit || "",
          supplier_id:   m.supplier_id,
          supplier_name: m.suppliers?.name || "Otro",
        });
      }

      /* Si no hay materiales, dejar groups vacío — la UI mostrará el CTA "Crear lista" */
      const groups = Array.from(groupMap.values());

      /* Mantener orden de inserción original (por created_at del query) */
      setTicketMaterialGroups(prev => ({ ...prev, [ticketId]: groups }));
      setTicketMatsLoading(prev => ({ ...prev, [ticketId]: false }));
    }
  }

  /* ── Materials — operaciones por grupo ───────────────────────── */

  function updateMaterialInGroup(tid: string, groupIdx: number, matIdx: number, field: string, val: string) {
    setTicketMaterialGroups(prev => {
      const groups = [...(prev[tid] || [])];
      const g = { ...groups[groupIdx], materials: [...groups[groupIdx].materials] };
      g.materials[matIdx] = { ...g.materials[matIdx], [field]: val };
      groups[groupIdx] = g;
      return { ...prev, [tid]: groups };
    });
  }

  function addMaterialToGroup(tid: string, groupIdx: number) {
    setTicketMaterialGroups(prev => {
      const groups = [...(prev[tid] || [])];
      const g = groups[groupIdx];
      groups[groupIdx] = {
        ...g,
        materials: [...g.materials, {
          id: "", description: "", quantity: "1", unit: "Pieza",
          supplier_id: g.supplier_id, supplier_name: g.supplier_name,
        }],
      };
      return { ...prev, [tid]: groups };
    });
  }

  function removeMaterialFromGroup(tid: string, groupIdx: number, matIdx: number) {
    setTicketMaterialGroups(prev => {
      const groups = [...(prev[tid] || [])];
      const g = groups[groupIdx];
      const newMats = g.materials.filter((_, i) => i !== matIdx);
      if (newMats.length === 0) {
        /* Si se queda vacío el grupo, eliminarlo */
        return { ...prev, [tid]: groups.filter((_, i) => i !== groupIdx) };
      }
      groups[groupIdx] = { ...g, materials: newMats };
      return { ...prev, [tid]: groups };
    });
  }

  function removeGroup(tid: string, groupIdx: number) {
    setTicketMaterialGroups(prev => {
      const groups = (prev[tid] || []).filter((_, i) => i !== groupIdx);
      return { ...prev, [tid]: groups };
    });
  }

  function addSupplierGroup(tid: string, supplier: SupplierSimple | null) {
    setTicketMaterialGroups(prev => {
      const groups = [...(prev[tid] || [])];
      const sid = supplier?.id || null;
      /* No duplicar si ya existe un grupo para este proveedor */
      if (groups.some(g => g.supplier_id === sid)) return prev;
      /* Agregar al final — mantener orden de inserción */
      groups.push({
        supplier_id:   sid,
        supplier_name: supplier?.name || "Otro",
        materials:     [{ id: "", description: "", quantity: "1", unit: "Pieza", supplier_id: sid, supplier_name: supplier?.name || "Otro" }],
      });
      return { ...prev, [tid]: groups };
    });
    setShowSupplierPicker(null);
  }

  /* ── Guardar materiales + crear OCs por proveedor ──────────── */

  async function saveMaterials(tid: string) {
    if (!user?.company_id) return;
    setSavingMatsFor(tid);

    const ticket = tickets.find(t => t.id === tid);
    const groups = ticketMaterialGroups[tid] || [];

    /* 1. Flatten de todos los grupos */
    const allMats = groups.flatMap(g =>
      g.materials
        .filter(m => m.description.trim())
        .map(m => ({
          maintenance_log_id: tid,
          description:        m.description.trim(),
          quantity:           parseFloat(m.quantity) || 1,
          unit:               m.unit.trim() || null,
          supplier_id:        g.supplier_id,
        }))
    );

    /* 2. DELETE existentes + INSERT nuevos con supplier_id */
    await supabase.from("maintenance_materials").delete().eq("maintenance_log_id", tid);
    if (allMats.length > 0) {
      await supabase.from("maintenance_materials").insert(allMats);
    }

    /* 3. Crear/actualizar OCs por proveedor */
    let ocsCreated = 0;
    let ocsUpdated = 0;
    const year = new Date().getFullYear();

    for (const g of groups) {
      const groupMats = allMats.filter(m => m.supplier_id === g.supplier_id);
      if (groupMats.length === 0) continue;

      /* Buscar OC existente para este ticket + proveedor */
      const { data: existingOCs } = await supabase
        .from("purchase_orders")
        .select("id, status")
        .eq("maintenance_log_id", tid)
        .eq("supplier_id", g.supplier_id || "")
        .is("deleted_at", null)
        .limit(1);

      const existingOC = existingOCs?.[0] as { id: string; status: string } | undefined;

      if (existingOC && existingOC.status === "pending") {
        /* OC pending → actualizar items sin crear OC nueva */
        await supabase.from("purchase_order_items").delete().eq("purchase_order_id", existingOC.id);
        await supabase.from("purchase_order_items").insert(
          groupMats.map(m => ({
            purchase_order_id: existingOC.id,
            description:       m.description,
            quantity:          m.quantity,
            unit:              m.unit,
          }))
        );
        ocsUpdated++;
        continue;
      }

      /* OC no existe O existe con status != pending */

      /* Si existe OC no-pending, calcular solo materiales adicionales */
      let itemsToInsert = groupMats;
      if (existingOC && existingOC.status !== "pending") {
        const { data: existingItems } = await supabase
          .from("purchase_order_items")
          .select("description, quantity, unit")
          .eq("purchase_order_id", existingOC.id)
          .is("deleted_at", null);

        const existingMap = new Map<string, number>();
        (existingItems || []).forEach((ei: { description: string; quantity: number }) => {
          const key = ei.description.trim().toLowerCase();
          existingMap.set(key, (existingMap.get(key) || 0) + Number(ei.quantity));
        });

        const additionalMaterials: MaterialRow[] = [];
        for (const mat of g.materials) {
          const desc = mat.description.trim();
          if (!desc) continue;
          const key    = desc.toLowerCase();
          const newQty = parseFloat(mat.quantity) || 1;

          if (!existingMap.has(key)) {
            additionalMaterials.push({ ...mat, quantity: String(newQty) });
          } else {
            const existingQty = existingMap.get(key) || 0;
            const diff = newQty - existingQty;
            if (diff > 0) {
              additionalMaterials.push({ ...mat, quantity: String(diff) });
            }
          }
        }

        if (additionalMaterials.length === 0) continue; /* nada nuevo que pedir */
        itemsToInsert = additionalMaterials.map(m => ({
          maintenance_log_id: tid,
          description:        m.description.trim(),
          quantity:           parseFloat(m.quantity) || 1,
          unit:               m.unit.trim() || null,
          supplier_id:        g.supplier_id,
        }));
      }

      /* Crear OC nueva */
      const supplierCode = g.supplier_id
        ? (suppliers.find(s => s.id === g.supplier_id)?.prefix
          || g.supplier_name.replace(/[^A-Za-z]/g, "").slice(0, 2)).toUpperCase()
        : "OT";

      /* Folio correlativo por proveedor: FM-{SP}-{YYYY}-{NNNN} */
      const folioPattern = `FM-${supplierCode}-${year}-%`;
      const { data: lastFolio } = await supabase
        .from("purchase_orders")
        .select("folio")
        .eq("company_id", user.company_id)
        .ilike("folio", folioPattern)
        .is("deleted_at", null);
      let maxN = 0;
      if (lastFolio && lastFolio.length > 0) {
        (lastFolio as { folio: string }[]).forEach(row => {
          const parts = row.folio.split("-");
          const n = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        });
      }
      const folio = `FM-${supplierCode}-${year}-${String(maxN + 1).padStart(4, "0")}`;

      const { data: newOC } = await supabase
        .from("purchase_orders")
        .insert({
          company_id:          user.company_id,
          supplier_id:         g.supplier_id,
          supplier_prefix:     supplierCode,
          maintenance_log_id:  tid,
          building_id:         ticket?.building_id || null,
          project_description: ticket?.description || ticket?.title || null,
          status:              "draft",
          folio,
        })
        .select("id")
        .single();

      if (newOC) {
        await supabase.from("purchase_order_items").insert(
          itemsToInsert.map(m => ({
            purchase_order_id: newOC.id,
            description:       m.description,
            quantity:          m.quantity,
            unit:              m.unit,
          }))
        );
        ocsCreated++;
      }
    }

    setSavingMatsFor(null);

    /* 4. Toast de confirmación */
    const matCount = allMats.length;
    const msgParts: string[] = [];
    msgParts.push(`${matCount} material${matCount === 1 ? "" : "es"} guardado${matCount === 1 ? "" : "s"}`);
    if (ocsCreated > 0) msgParts.push(`${ocsCreated} OC${ocsCreated === 1 ? "" : "s"} creada${ocsCreated === 1 ? "" : "s"}`);
    if (ocsUpdated > 0) msgParts.push(`${ocsUpdated} OC${ocsUpdated === 1 ? "" : "s"} actualizada${ocsUpdated === 1 ? "" : "s"}`);
    toast.success(msgParts.join(" · "));
  }

  /* ── Status update ──────────────────────────────────────────── */

  async function updateStatus(tid: string, newStatus: string) {
    setUpdatingStatusFor(tid);
    const update: Record<string, string> = { status: newStatus };
    if (newStatus === "resolved") update.resolved_at = new Date().toISOString();
    await supabase.from("maintenance_logs").update(update).eq("id", tid);
    setTickets(prev => prev.map(t => t.id === tid ? { ...t, status: newStatus } : t));
    setUpdatingStatusFor(null);
  }

  /* ── Derived ────────────────────────────────────────────────── */

  const filtered = useMemo(
    () => filter === "all" ? tickets : tickets.filter(t => t.status === filter),
    [tickets, filter]
  );

  /* ── Styles ─────────────────────────────────────────────────── */

  const inputStyle: CSSProperties = {
    width: "100%", padding: "11px 12px", borderRadius: "var(--border-radius-md)",
    border: "1px solid var(--border-default)", background: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: "0.9375rem", boxSizing: "border-box",
  };
  const labelStyle: CSSProperties = {
    fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6,
  };
  const sectionLabel: CSSProperties = {
    margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)",
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
  };

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <>
      {/* Inputs de archivo — fuera de cualquier modal para evitar dismiss en iOS */}
      {/* TODO: fix iOS camera capture - temporalmente deshabilitado
      <input ref={createCamRef} type="file" accept="image/*"
        capture={"environment" as unknown as boolean}
        style={{ display: "none" }} onChange={handleCreatePhoto} />
      */}
      <input ref={createGalleryRef} type="file" accept="image/*" multiple
        style={{ display: "none" }} onChange={handleCreatePhoto} />
      {/* TODO: fix iOS camera capture - temporalmente deshabilitado
      <input ref={detailCamRef} type="file" accept="image/*"
        capture={"environment" as unknown as boolean}
        style={{ display: "none" }} onChange={handleDetailPhoto} />
      */}
      <input ref={detailGalleryRef} type="file" accept="image/*" multiple
        style={{ display: "none" }} onChange={handleDetailPhoto} />

      <div style={{ padding: "16px 16px 80px", maxWidth: 560, margin: "0 auto", width: "100%" }}>

        <h2 style={{ margin: "0 0 16px", fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
          Tickets
        </h2>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as const, marginBottom: 16 }}>
          {TABS.map(tab => (
            <button
              key={tab.key} type="button"
              onClick={() => setFilter(tab.key)}
              style={{
                flexShrink: 0, padding: "7px 14px", borderRadius: "var(--border-radius-xl)", fontSize: "0.8125rem",
                fontWeight: filter === tab.key ? 700 : 500, border: "none", cursor: "pointer",
                background: filter === tab.key ? "var(--accent)" : "var(--bg-card)",
                color: filter === tab.key ? "#fff" : "var(--text-secondary)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loadingData ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Sin tickets.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(t => {
              const isExpanded = expandedId === t.id;
              const badge   = STATUS_BADGE[t.status] || STATUS_BADGE.pending;
              const bName   = t.buildings?.name;
              const uCode   = t.units?.display_code || t.units?.unit_number;
              const photos  = t.photos || [];
              const matGroups   = ticketMaterialGroups[t.id] || [];
              const matsLoading = ticketMatsLoading[t.id];

              return (
                <div key={t.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>

                  {/* Collapsed row — tap to expand */}
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(t.id)}
                    style={{ width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", flex: 1, textAlign: "left" }}>
                        {t.title}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ padding: "3px 8px", borderRadius: "var(--border-radius-xl)", fontSize: "0.6875rem", fontWeight: 700, background: badge.bg, color: badge.text, whiteSpace: "nowrap" }}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                        {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {t.ticket_number && (
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontFamily: "monospace" }}>#{t.ticket_number}</span>
                      )}
                      {bName && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {bName}{uCode ? ` · ${uCode}` : ""}
                        </span>
                      )}
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: PRIORITY_COLORS[t.priority] || "var(--text-muted)" }}>
                        {PRIORITY_LABELS[t.priority] || t.priority}
                      </span>
                      {photos.length > 0 && (
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Camera size={20} /> {photos.length}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden", borderTop: "1px solid var(--border-default)", padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 16 }}
                    >

                      {/* Description */}
                      {t.description && (
                        <div>
                          <p style={sectionLabel}>Descripción</p>
                          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary)", lineHeight: 1.5 }}>{t.description}</p>
                        </div>
                      )}

                      {/* Meta chips */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ padding: "5px 10px", background: "var(--bg-page)", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={20} /> {new Date(t.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {bName && (
                          <span style={{ padding: "5px 10px", background: "var(--bg-page)", borderRadius: "var(--border-radius-md)", fontSize: "0.75rem", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Building2 size={20} /> {bName}{uCode ? ` · ${uCode}` : ""}
                          </span>
                        )}
                      </div>

                      {/* Photos */}
                      <div>
                        <p style={sectionLabel}>Fotos {photos.length > 0 ? `(${photos.length})` : ""}</p>
                        {photos.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
                            {photos.map((url, i) => (
                              <img
                                key={i} src={url} alt={`Foto ${i + 1}`}
                                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", cursor: "pointer" }}
                                onClick={() => window.open(url, "_blank")}
                              />
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { addingPhotoForRef.current = t.id; setPhotoPicker(t.id); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: "var(--border-radius-md)", border: "1.5px dashed var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: "0.8125rem", cursor: "pointer" }}
                        >
                          <Camera size={15} /> Agregar foto
                        </button>
                      </div>

                      {/* Materials — agrupados por proveedor */}
                      <div>
                        <p style={sectionLabel}>Materiales</p>
                        {matsLoading ? (
                          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Cargando...</p>
                        ) : matGroups.length === 0 ? (
                          /* Sin materiales: CTA grande centrado */
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" }}>
                            {showSupplierPicker === t.id ? (
                              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, padding: "8px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", background: "var(--bg-input)" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Selecciona proveedor:</span>
                                <button type="button" onClick={() => addSupplierGroup(t.id, null)} style={{ padding: "8px 10px", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.8125rem", cursor: "pointer", textAlign: "left" }}>
                                  Otro (sin proveedor)
                                </button>
                                {suppliers.map(s => (
                                  <button key={s.id} type="button" onClick={() => addSupplierGroup(t.id, s)} style={{ padding: "8px 10px", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.8125rem", cursor: "pointer", textAlign: "left" }}>
                                    {s.name}
                                  </button>
                                ))}
                                <button type="button" onClick={() => setShowSupplierPicker(null)} style={{ padding: "6px", fontSize: "0.75rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowSupplierPicker(t.id)}
                                style={{
                                  padding: "16px 28px", borderRadius: "var(--border-radius-lg)",
                                  border: "2px dashed var(--border-strong)",
                                  background: "transparent", color: "var(--text-secondary)",
                                  fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 8,
                                }}
                              >
                                <Plus size={18} /> Crear lista de materiales
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {matGroups.map((group, gIdx) => (
                              <div key={group.supplier_id || "__otro__"} style={{
                                border: "1px solid var(--border-default)",
                                borderRadius: "var(--border-radius-md)",
                                overflow: "hidden",
                              }}>
                                {/* Header del grupo */}
                                <div style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "8px 12px",
                                  background: group.supplier_id ? "var(--bg-input)" : "transparent",
                                  borderBottom: "1px solid var(--border-default)",
                                }}>
                                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                    {group.supplier_name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeGroup(t.id, gIdx)}
                                    style={{ background: "none", border: "none", color: "var(--badge-text-red)", cursor: "pointer", padding: 2 }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                {/* Materiales del grupo */}
                                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                                  {group.materials.map((m, mIdx) => (
                                    <div key={mIdx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <input
                                        value={m.description}
                                        onChange={e => updateMaterialInGroup(t.id, gIdx, mIdx, "description", e.target.value)}
                                        placeholder="Descripción"
                                        style={{ ...inputStyle, flex: 3, padding: "8px 10px", fontSize: "0.8125rem" }}
                                      />
                                      <input
                                        value={m.quantity}
                                        onChange={e => updateMaterialInGroup(t.id, gIdx, mIdx, "quantity", e.target.value)}
                                        placeholder="Cant."
                                        inputMode="decimal"
                                        style={{ ...inputStyle, flex: 1, padding: "8px", fontSize: "0.8125rem", textAlign: "center" }}
                                      />
                                      <select
                                        value={m.unit}
                                        onChange={e => updateMaterialInGroup(t.id, gIdx, mIdx, "unit", e.target.value)}
                                        style={{ ...inputStyle, flex: 1, padding: "8px", fontSize: "0.8125rem", appearance: "none", WebkitAppearance: "none" }}
                                      >
                                        {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => removeMaterialFromGroup(t.id, gIdx, mIdx)}
                                        style={{ background: "none", border: "none", color: "var(--badge-text-red)", cursor: "pointer", padding: 4, flexShrink: 0 }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addMaterialToGroup(t.id, gIdx)}
                                    style={{ padding: "6px", borderRadius: "var(--border-radius-sm)", border: "1px dashed var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                  >
                                    <Plus size={12} /> Agregar material
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Agregar proveedor */}
                            {showSupplierPicker === t.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", background: "var(--bg-input)" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Selecciona proveedor:</span>
                                <button
                                  type="button"
                                  onClick={() => addSupplierGroup(t.id, null)}
                                  style={{ padding: "8px 10px", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.8125rem", cursor: "pointer", textAlign: "left" }}
                                >
                                  Otro (sin proveedor)
                                </button>
                                {suppliers.filter(s => !matGroups.some(g => g.supplier_id === s.id)).map(s => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => addSupplierGroup(t.id, s)}
                                    style={{ padding: "8px 10px", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.8125rem", cursor: "pointer", textAlign: "left" }}
                                  >
                                    {s.name}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setShowSupplierPicker(null)}
                                  style={{ padding: "6px", fontSize: "0.75rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowSupplierPicker(t.id)}
                                style={{ padding: "8px", borderRadius: "var(--border-radius-md)", border: "1.5px dashed var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                              >
                                <Plus size={14} /> Agregar proveedor
                              </button>
                            )}

                            {/* Botón guardar */}
                            <button
                              type="button"
                              onClick={() => saveMaterials(t.id)}
                              disabled={savingMatsFor === t.id}
                              style={{ padding: "10px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--icon-bg-green)", color: "var(--icon-color-green)", fontSize: "0.875rem", fontWeight: 700, cursor: savingMatsFor === t.id ? "wait" : "pointer", opacity: savingMatsFor === t.id ? 0.7 : 1 }}
                            >
                              {savingMatsFor === t.id ? "Guardando y creando OCs..." : "Guardar materiales"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status buttons */}
                      {(t.status === "pending" || t.status === "in_progress") && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {t.status === "pending" && (
                            <button
                              type="button"
                              disabled={updatingStatusFor === t.id}
                              onClick={() => updateStatus(t.id, "in_progress")}
                              style={{ width: "100%", padding: "14px", borderRadius: "var(--border-radius-lg)", border: "none", background: "var(--icon-bg-blue)", color: "var(--icon-color-blue)", fontSize: "0.9375rem", fontWeight: 700, cursor: updatingStatusFor === t.id ? "wait" : "pointer", opacity: updatingStatusFor === t.id ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                            >
                              {updatingStatusFor === t.id ? "Actualizando..." : (<><Play size={20} /> Iniciar trabajo</>)}
                            </button>
                          )}
                          {t.status === "in_progress" && (
                            <button
                              type="button"
                              disabled={updatingStatusFor === t.id}
                              onClick={() => updateStatus(t.id, "resolved")}
                              style={{ width: "100%", padding: "14px", borderRadius: "var(--border-radius-lg)", border: "none", background: "var(--icon-bg-green)", color: "var(--icon-color-green)", fontSize: "0.9375rem", fontWeight: 700, cursor: updatingStatusFor === t.id ? "wait" : "pointer", opacity: updatingStatusFor === t.id ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                            >
                              {updatingStatusFor === t.id ? "Actualizando..." : (<><Check size={20} /> Marcar resuelto</>)}
                            </button>
                          )}
                        </div>
                      )}

                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* FAB */}
        <button
          type="button"
          onClick={openCreate}
          aria-label="Nuevo ticket"
          style={{
            position: "fixed", bottom: 24, right: 20,
            width: 56, height: 56, borderRadius: "var(--border-radius-xl)",
            background: "var(--accent)", color: "#fff", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.24)", zIndex: 50,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Plus size={24} />
        </button>

        {/* Create modal — bottom sheet */}
        {createOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}
            onClick={e => { if (e.target === e.currentTarget) setCreateOpen(false); }}
          >
            <div
              style={{ width: "100%", maxHeight: "92dvh", overflowY: "auto", background: "var(--bg-card)", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", display: "flex", flexDirection: "column", gap: 14 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Sheet header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>Nuevo ticket</h3>
                <button type="button" onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              {/* Draft banner */}
              {hasDraft && (
                <div style={{ padding: "10px 12px", background: "var(--metric-bg-amber)", border: "1px solid var(--metric-border-amber)", borderRadius: "var(--border-radius-md)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--metric-value-amber)", fontWeight: 600 }}>
                    Tienes un borrador guardado
                  </span>
                  <button type="button" onClick={discardDraft} style={{ background: "none", border: "none", fontSize: "0.75rem", color: "var(--metric-value-amber)", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>
                    Descartar
                  </button>
                </div>
              )}

              {/* Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                <div>
                  <label style={labelStyle}>Título *</label>
                  <input value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Describe el problema..." style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Edificio</label>
                  <select value={form.buildingId} onChange={e => handleBuildingChange(e.target.value)} style={inputStyle}>
                    <option value="">Sin edificio específico</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                {form.buildingId && (
                  <div>
                    <label style={labelStyle}>Área / Departamento</label>
                    <select value={form.area} onChange={e => handleAreaChange(e.target.value)} style={inputStyle} disabled={loadingDeps}>
                      <option value="">Sin área específica</option>
                      {FIXED_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      {buildingUnits.length > 0 && (
                        <optgroup label="── Departamentos ──">
                          {buildingUnits.map(u => (
                            <option key={u.id} value={u.id}>{u.display_code || u.unit_number || "Unidad"}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}

                {form.buildingId && buildingAssets.length > 0 && (
                  <div>
                    <label style={labelStyle}>Equipamiento relacionado (opcional)</label>
                    <select value={form.assetId} onChange={e => setField("assetId", e.target.value)} style={inputStyle}>
                      <option value="">Sin equipamiento específico</option>
                      {buildingAssets.map(a => (
                        <option key={a.id} value={a.id}>{a.asset_type ? `[${a.asset_type}] ` : ""}{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Prioridad</label>
                  <select value={form.priority} onChange={e => setField("priority", e.target.value)} style={inputStyle}>
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Descripción</label>
                  <textarea value={form.desc} onChange={e => setField("desc", e.target.value)} rows={3} placeholder="Detalles adicionales..." style={{ ...inputStyle, resize: "vertical" as const }} />
                </div>

                <div>
                  <label style={labelStyle}>Fotos (opcional)</label>
                  {cPhotos.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
                      {cPhotos.map((p, i) => (
                        <div key={p.id} style={{ position: "relative" }}>
                          <img
                            src={p.publicUrl || p.localUrl}
                            alt={`Foto ${i + 1}`}
                            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", opacity: p.uploading ? 0.5 : 1 }}
                          />
                          {p.uploading && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", borderRadius: "var(--border-radius-md)" }}>
                              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#fff" }}>Subiendo...</span>
                            </div>
                          )}
                          <button type="button" onClick={() => removeCreatePhoto(p.id)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setPhotoPicker("create")} style={{ width: "100%", padding: "12px", borderRadius: "var(--border-radius-md)", border: "1.5px dashed var(--border-strong)", background: "var(--bg-page)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "0.875rem", cursor: "pointer" }}>
                    <Camera size={18} />
                    {cPhotos.length > 0 ? "Agregar otra foto" : "Agregar foto"}
                  </button>
                </div>

                {createError && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--badge-text-red)" }}>{createError}</p>}

                <button type="button" onClick={handleCreate} disabled={saving} style={{ width: "100%", padding: "14px", borderRadius: "var(--border-radius-lg)", border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.9375rem", fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, marginTop: 4 }}>
                  {saving ? "Guardando..." : "Crear ticket"}
                </button>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Photo picker bottom sheet ──────────────────────────── */}
      {photoPicker !== null && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}
          onClick={() => setPhotoPicker(null)}
        >
          <div
            style={{ width: "100%", background: "var(--bg-card)", borderRadius: "20px 20px 0 0", overflow: "hidden", paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: 0, padding: "18px 20px 14px", fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Agregar foto
            </p>

            <div style={{ height: 1, background: "var(--border-default)" }} />

            {/* Cámara: abre el modal de react-webcam (captura directa, sin picker nativo de iOS). */}
            <button
              type="button"
              onClick={() => {
                const target = photoPicker;
                setPhotoPicker(null);
                setTimeout(() => setWebcamOpen(target), 100);
              }}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", cursor: "pointer", fontSize: "0.9375rem", color: "var(--text-primary)", textAlign: "left" }}
            >
              <Camera size={20} /> Tomar foto
            </button>

            <div style={{ height: 1, background: "var(--border-default)" }} />

            <button
              type="button"
              onClick={() => triggerInput(photoPicker === "create" ? createGalleryRef : detailGalleryRef)}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", cursor: "pointer", fontSize: "0.9375rem", color: "var(--text-primary)", textAlign: "left" }}
            >
              <ImageIcon size={20} /> Elegir del carrete
            </button>

            <div style={{ height: 1, background: "var(--border-default)" }} />

            <button
              type="button"
              onClick={() => setPhotoPicker(null)}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", cursor: "pointer", fontSize: "0.9375rem", color: "var(--badge-text-red)", textAlign: "left" }}
            >
              <X size={20} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal del Webcam — captura de foto desde la cámara del dispositivo ── */}
      <Modal
        open={webcamOpen !== null}
        title="Tomar foto"
        onClose={() => {
          setWebcamOpen(null);
          setWebcamError(null);
        }}
        maxWidth="420px"
      >
        {webcamError ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ color: "#EF4444", marginBottom: 12, fontWeight: 600 }}>
              {webcamError}
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Verifica que el navegador tiene permiso para usar la cámara.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              videoConstraints={{
                facingMode: { ideal: "environment" },
                width:  { ideal: 1280 },
                height: { ideal: 720 },
              }}
              onUserMediaError={(err) => {
                setWebcamError("No se pudo acceder a la cámara");
                console.error("Webcam error:", err);
              }}
              style={{ width: "100%", borderRadius: "var(--border-radius-md)" }}
            />
            <button
              type="button"
              onClick={handleCapturePhoto}
              style={{
                background: "#8B2252",
                color: "white",
                border: "none",
                borderRadius: "var(--border-radius-md)",
                padding: "12px 0",
                fontSize: "0.9375rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Camera size={18} />
              Tomar foto
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
