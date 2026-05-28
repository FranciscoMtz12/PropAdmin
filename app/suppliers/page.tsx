"use client";

/*
  Catálogo de proveedores con sucursales.

  Tablas esperadas:

    suppliers
      id uuid PK, company_id uuid, name text,
      client_number text NULL, contact_name text NULL,
      contact_email text NULL, contact_phone text NULL,
      tax_id text NULL, cfdi_use text NULL, notes text NULL,
      active bool default true,
      tiene_credito bool default false,
      dias_credito integer default 30,
      created_at, updated_at, deleted_at

    supplier_branches
      id uuid PK, supplier_id uuid → suppliers,
      name text, address text NULL,
      email text NULL, phone text NULL,
      active bool default true,
      created_at, deleted_at

  Se usa en:
  - app/maintenance/page.tsx → select de proveedor por material
  - app/purchases/page.tsx → OC (proveedor + sucursal)
*/

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Edit3, MoreVertical, Package, Plus, Truck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import MetricCard from "@/components/MetricCard";
import MetricCircles from "@/components/MetricCircles";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import AppBadge from "@/components/AppBadge";
import SensitiveField from "@/components/SensitiveField";

/* ── Types ─────────────────────────────────────────────────────────── */

type SupplierBranch = {
  id:          string;
  supplier_id: string;
  name:        string;
  address:     string | null;
  email:       string | null;
  phone:       string | null;
  active:      boolean;
};

type Supplier = {
  id:             string;
  company_id:     string;
  name:           string;
  prefix:         string | null;          /* Prefijo usado en folio de OC (p.ej. HD, LC) */
  client_number:  string | null;
  contact_name:   string | null;
  contact_email:  string | null;
  contact_phone:  string | null;
  tax_id:         string | null;
  cfdi_use:       string | null;
  notes:          string | null;
  active:         boolean;
  tiene_credito:  boolean;
  dias_credito:   number;
  created_at:     string;
  deleted_at:     string | null;
  branches?:      SupplierBranch[];
};

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  prefix: z.string().max(4, "Máximo 4 caracteres").optional(),
  client_number: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email("Email inválido").or(z.literal("")).optional(),
  contact_phone: z.string().optional(),
  tax_id: z.string().optional(),
  cfdi_use: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
  tiene_credito: z.boolean(),
  dias_credito: z.number().int().min(1),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

type BranchDraft = {
  name:    string;
  address: string;
  email:   string;
  phone:   string;
};

const EMPTY_BRANCH_DRAFT: BranchDraft = { name: "", address: "", email: "", phone: "" };

const DEFAULT_CFDI_USE = "G03 Gastos en general";

const CFDI_USES = [
  "G01 Adquisición de mercancías",
  "G02 Devoluciones, descuentos o bonificaciones",
  "G03 Gastos en general",
  "I01 Construcciones",
  "I02 Mobiliario y equipo de oficina por inversiones",
  "I03 Equipo de transporte",
  "I04 Equipo de computo y accesorios",
  "I05 Dados, troqueles, moldes, matrices y herramental",
  "I06 Comunicaciones telefónicas",
  "I07 Comunicaciones satelitales",
  "I08 Otra maquinaria y equipo",
  "D01 Honorarios médicos, dentales y gastos hospitalarios",
  "S01 Sin efectos fiscales",
  "CP01 Pagos",
];

const EMPTY_FORM: SupplierFormValues = {
  name: "", prefix: "", client_number: "", contact_name: "",
  contact_email: "", contact_phone: "",
  tax_id: "", cfdi_use: DEFAULT_CFDI_USE,
  notes: "", active: true,
  tiene_credito: false, dias_credito: 30,
};

const errorTextStyle: CSSProperties = {
  color: "var(--metric-value-red)",
  fontSize: "0.75rem",
  marginTop: 4,
  marginBottom: 0,
};

/* ── Component ─────────────────────────────────────────────────────── */

export default function SuppliersPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const { impersonationMode, groupCompanyIds, groupCompanies } = useImpersonation();
  const isGroupMode = impersonationMode === 'group';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState("");

  /* Modal */
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit: rhfSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: EMPTY_FORM,
  });
  const formActive       = watch("active");
  const formTieneCredito = watch("tiene_credito");
  const formDiasCredito  = watch("dias_credito");

  /* Sucursales — formulario inline dentro del modal (editar) */
  const [branchDraft,   setBranchDraft]   = useState<BranchDraft>(EMPTY_BRANCH_DRAFT);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [savingBranch,  setSavingBranch]  = useState(false);

  /* Edición inline de sucursal existente */
  const [editingBranchId,   setEditingBranchId]   = useState<string | null>(null);
  const [editingBranchForm, setEditingBranchForm] = useState<BranchDraft>(EMPTY_BRANCH_DRAFT);
  const [savingEditBranch,  setSavingEditBranch]  = useState(false);

  /* Sucursales — agregar rápido desde la card */
  const [quickBranchForSupplier, setQuickBranchForSupplier] = useState<string | null>(null);
  const [quickBranch, setQuickBranch] = useState<BranchDraft>(EMPTY_BRANCH_DRAFT);
  const [savingQuickBranch, setSavingQuickBranch] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /* ── Load ────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!userLoading && user && !user.is_superadmin) void loadSuppliers(user?.company_id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user?.id, user?.company_id, user?.is_superadmin]);

  async function loadSuppliers(companyId: string | null) {
    setLoading(true);
    setMsg("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co = (q: any) => companyId ? q.eq("company_id", companyId) : q;
    const { data, error } = await co(supabase
      .from("suppliers")
      .select("*, supplier_branches(*)"))
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      console.error("loadSuppliers error:", error);
      setMsg(`No se pudieron cargar los proveedores: ${error.message}`);
      setSuppliers([]);
    } else {
      type Row = Supplier & { supplier_branches: SupplierBranch[] | null };
      const rows = ((data || []) as unknown as Row[]).map((r) => ({
        ...r,
        branches: (r.supplier_branches || [])
          .filter((b) => b.active)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
      setSuppliers(rows);
    }
    setLoading(false);
  }

  /* ── Grupo mode derivados ────────────────────────────────────────── */

  const displayedSuppliers = useMemo(() => {
    if (!isGroupMode) return suppliers;
    if (groupCompanyIds.length === 0) return suppliers;
    return suppliers.filter((s) => groupCompanyIds.includes(s.company_id));
  }, [suppliers, isGroupMode, groupCompanyIds]);

  const suppliersByCompany = useMemo(() => {
    if (!isGroupMode) return [];
    return groupCompanies
      .filter((c) => groupCompanyIds.includes(c.id))
      .map((company) => ({
        company,
        compSuppliers: displayedSuppliers.filter((s) => s.company_id === company.id),
      }))
      .filter(({ compSuppliers }) => compSuppliers.length > 0);
  }, [isGroupMode, groupCompanies, groupCompanyIds, displayedSuppliers]);

  /* ── Metrics ─────────────────────────────────────────────────────── */

  const { total, activeCount, inactiveCount } = useMemo(() => {
    const total         = displayedSuppliers.length;
    const activeCount   = displayedSuppliers.filter((s) => s.active).length;
    const inactiveCount = total - activeCount;
    return { total, activeCount, inactiveCount };
  }, [displayedSuppliers]);

  /* ── Form handlers ───────────────────────────────────────────────── */

  function openCreate() {
    setEditingId(null);
    reset(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
    setShowBranchForm(false);
    setBranchDraft(EMPTY_BRANCH_DRAFT);
    setOpenMenuId(null);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    reset({
      name:          s.name,
      prefix:        s.prefix        || "",
      client_number: s.client_number || "",
      contact_name:  s.contact_name  || "",
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
      tax_id:        s.tax_id        || "",
      cfdi_use:      s.cfdi_use      || DEFAULT_CFDI_USE,
      notes:         s.notes         || "",
      active:        s.active,
      tiene_credito: s.tiene_credito ?? false,
      dias_credito:  s.dias_credito  ?? 30,
    });
    setFormError("");
    setShowModal(true);
    setShowBranchForm(false);
    setBranchDraft(EMPTY_BRANCH_DRAFT);
    setOpenMenuId(null);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    reset(EMPTY_FORM);
    setFormError("");
    setShowBranchForm(false);
    setBranchDraft(EMPTY_BRANCH_DRAFT);
    setEditingBranchId(null);
    setEditingBranchForm(EMPTY_BRANCH_DRAFT);
  }

  const handleSubmit = rhfSubmit(async (data) => {
    if (!user?.company_id) return;
    setFormError("");

    const payload = {
      name:          data.name.trim(),
      prefix:        data.prefix?.trim().toUpperCase() || null,
      client_number: data.client_number?.trim() || null,
      contact_name:  data.contact_name?.trim()  || null,
      contact_email: data.contact_email?.trim() || null,
      contact_phone: data.contact_phone?.trim() || null,
      tax_id:        data.tax_id?.trim()        || null,
      cfdi_use:      data.cfdi_use?.trim()      || DEFAULT_CFDI_USE,
      notes:         data.notes?.trim()         || null,
      active:        data.active,
      tiene_credito: data.tiene_credito,
      dias_credito:  data.tiene_credito ? (data.dias_credito ?? 30) : 0,
    };

    if (editingId) {
      const { error } = await supabase
        .from("suppliers")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingId);

      if (error) {
        console.error("suppliers save error:", error);
        setFormError(`No se pudo guardar el proveedor: ${error.message}`);
        return;
      }

      closeModal();
      setMsg("Proveedor actualizado correctamente.");
      void loadSuppliers(user.company_id);
    } else {
      const { data: inserted, error } = await supabase
        .from("suppliers")
        .insert({ ...payload, company_id: user.company_id })
        .select("id")
        .single();

      if (error) {
        console.error("suppliers save error:", error);
        setFormError(`No se pudo guardar el proveedor: ${error.message}`);
        return;
      }
      if (!inserted) return;

      setMsg("Proveedor creado. Ahora puedes agregar sucursales.");
      /* Recargar y cambiar a modo editar sin cerrar el modal */
      await loadSuppliers(user.company_id);
      setEditingId(inserted.id);
      setShowBranchForm(false);
      setBranchDraft(EMPTY_BRANCH_DRAFT);
    }
  });

  async function handleArchive(id: string) {
    if (!user?.company_id) return;
    setOpenMenuId(null);
    if (!window.confirm("¿Eliminar este proveedor?")) return;

    const { error } = await supabase
      .from("suppliers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) { setMsg("No se pudo eliminar el proveedor."); return; }
    setMsg("Proveedor archivado correctamente.");
    void loadSuppliers(user.company_id);
  }

  /* ── Branches ────────────────────────────────────────────────────── */

  async function handleAddBranch(supplierId: string, draft: BranchDraft): Promise<boolean> {
    if (!draft.name.trim()) return false;
    const { error } = await supabase.from("supplier_branches").insert({
      supplier_id: supplierId,
      name:        draft.name.trim(),
      address:     draft.address.trim() || null,
      email:       draft.email.trim()   || null,
      phone:       draft.phone.trim()   || null,
      active:      true,
    });
    if (error) {
      console.error("add branch error:", error);
      setMsg(`No se pudo agregar la sucursal: ${error.message}`);
      return false;
    }
    return true;
  }

  async function handleArchiveBranch(branchId: string) {
    if (!window.confirm("¿Eliminar esta sucursal?")) return;
    const { error } = await supabase
      .from("supplier_branches")
      .update({ active: false, deleted_at: new Date().toISOString() })
      .eq("id", branchId);
    if (error) { setMsg("No se pudo eliminar la sucursal."); return; }
    if (user?.company_id) void loadSuppliers(user.company_id);
  }

  async function handleSaveModalBranch() {
    if (!editingId) return;
    if (!branchDraft.name.trim()) { setFormError("El nombre de la sucursal es requerido."); return; }
    setSavingBranch(true);
    setFormError("");
    const ok = await handleAddBranch(editingId, branchDraft);
    setSavingBranch(false);
    if (!ok) return;
    setBranchDraft(EMPTY_BRANCH_DRAFT);
    setShowBranchForm(false);
    if (user?.company_id) void loadSuppliers(user.company_id);
  }

  function startEditBranch(b: SupplierBranch) {
    setEditingBranchId(b.id);
    setEditingBranchForm({
      name:    b.name,
      address: b.address || "",
      email:   b.email   || "",
      phone:   b.phone   || "",
    });
  }

  function cancelEditBranch() {
    setEditingBranchId(null);
    setEditingBranchForm(EMPTY_BRANCH_DRAFT);
  }

  async function handleSaveEditBranch() {
    if (!editingBranchId) return;
    if (!editingBranchForm.name.trim()) {
      setFormError("El nombre de la sucursal es requerido.");
      return;
    }
    setSavingEditBranch(true);
    setFormError("");
    const { error } = await supabase
      .from("supplier_branches")
      .update({
        name:    editingBranchForm.name.trim(),
        address: editingBranchForm.address.trim() || null,
        email:   editingBranchForm.email.trim()   || null,
        phone:   editingBranchForm.phone.trim()   || null,
      })
      .eq("id", editingBranchId);
    setSavingEditBranch(false);
    if (error) {
      console.error("update branch error:", error);
      setFormError(`No se pudo actualizar la sucursal: ${error.message}`);
      return;
    }
    cancelEditBranch();
    if (user?.company_id) void loadSuppliers(user.company_id);
  }

  async function handleSaveQuickBranch() {
    if (!quickBranchForSupplier) return;
    if (!quickBranch.name.trim()) { setMsg("El nombre de la sucursal es requerido."); return; }
    setSavingQuickBranch(true);
    const ok = await handleAddBranch(quickBranchForSupplier, quickBranch);
    setSavingQuickBranch(false);
    if (!ok) return;
    setQuickBranch(EMPTY_BRANCH_DRAFT);
    setQuickBranchForSupplier(null);
    if (user?.company_id) void loadSuppliers(user.company_id);
  }

  /* ── Derived: sucursales del proveedor en edición (desde la lista cargada) ── */
  const editingBranches = useMemo(() => {
    if (!editingId) return [];
    const s = suppliers.find((x) => x.id === editingId);
    return s?.branches || [];
  }, [editingId, suppliers]);

  /* ── Styles ──────────────────────────────────────────────────────── */

  const INPUT_STYLE: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--border-radius-md)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    boxSizing: "border-box",
    outline: "none",
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.06em",
    marginBottom: 12, marginTop: 8,
    paddingBottom: 6, borderBottom: "1px solid var(--border-default)",
  };

  const cardStyle: CSSProperties = {
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    position: "relative",
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  if (userLoading) {
    return <PageContainer><p style={{ color: "var(--text-muted)" }}>Cargando...</p></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Proveedores"
        titleIcon={<Truck size={18} />}
        subtitle="Catálogo de proveedores y sus sucursales."
        actions={
          !isGroupMode ? (
            <UiButton variant="primary" onClick={openCreate} icon={<Plus size={16} />}>
              Nuevo proveedor
            </UiButton>
          ) : undefined
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

      {/* Métricas mobile */}
      <MetricCircles metrics={[
        { value: total,         label: "Total",    color: "default" },
        { value: activeCount,   label: "Activos",  color: "success" },
        { value: inactiveCount, label: "Inactivos",color: "warning" },
      ]} />

      {/* Métricas desktop */}
      <AppGrid minWidth={220} className="metric-grid-desktop-only" style={{ marginBottom: 20 }}>
        <MetricCard label="Total proveedores" value={total}         variant="neutral" icon={<Package size={18} />} />
        <MetricCard label="Activos"           value={activeCount}   variant="green"   />
        <MetricCard label="Inactivos"         value={inactiveCount} variant="amber"   />
      </AppGrid>

      {/* Lista */}
      {loading ? (
        <AppCard><p style={{ margin: 0, color: "var(--text-muted)" }}>Cargando proveedores...</p></AppCard>
      ) : displayedSuppliers.length === 0 ? (
        <AppCard>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {isGroupMode ? "Las empresas activas no tienen proveedores registrados." : "No hay proveedores. Crea el primero con el botón de arriba."}
          </p>
        </AppCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: isGroupMode ? 32 : 0 }}>
          {(isGroupMode
            ? suppliersByCompany
            : [{ company: null, compSuppliers: displayedSuppliers }] as Array<{ company: typeof groupCompanies[0] | null; compSuppliers: Supplier[] }>
          ).map(({ company, compSuppliers }) => (
            <div key={company?.id ?? "all"}>
              {company ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: company.brand_color || "var(--accent)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {company.short_name || company.name}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 4 }}>
                    {compSuppliers.length} {compSuppliers.length === 1 ? "proveedor" : "proveedores"}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--border-default)", marginLeft: 8 }} />
                </div>
              ) : null}
              <AppGrid minWidth={320}>
                {compSuppliers.map((s, index) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
            <AppCard style={cardStyle}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                    </div>
                    {s.prefix ? (
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 700,
                        fontFamily: "monospace",
                        padding: "2px 6px", borderRadius: "var(--border-radius-sm)",
                        background: "var(--bg-input)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                        flexShrink: 0,
                      }}>
                        {s.prefix}
                      </span>
                    ) : null}
                  </div>
                  {s.tax_id ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      RFC: <SensitiveField value={s.tax_id} type="rfc" />
                    </div>
                  ) : null}
                  {s.client_number ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Cliente #{s.client_number}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {s.tiene_credito ? (
                    <AppBadge variant="blue">
                      Crédito {s.dias_credito}d
                    </AppBadge>
                  ) : null}
                  <AppBadge variant={s.active ? "green" : "amber"}>
                    {s.active ? "Activo" : "Inactivo"}
                  </AppBadge>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: "var(--border-radius-md)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)", color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>

                    {openMenuId === s.id ? (
                      <div
                        style={{
                          position: "absolute", top: 36, right: 0, minWidth: 150,
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--border-radius-md)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                          zIndex: 10, overflow: "hidden",
                        }}
                      >
                        <button type="button" onClick={() => openEdit(s)}
                          style={menuBtnStyle()}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleArchive(s.id)}
                          style={menuBtnStyle(true)}>
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Persona de contacto */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                {s.contact_name  ? <div>{s.contact_name}</div> : null}
                {s.contact_phone ? <div><SensitiveField value={s.contact_phone} type="phone" /></div> : null}
                {s.contact_email ? <div><SensitiveField value={s.contact_email} type="email" /></div> : null}
                {!s.contact_name && !s.contact_phone && !s.contact_email ? (
                  <div style={{ color: "var(--text-muted)" }}>Sin persona de contacto</div>
                ) : null}
              </div>

              {/* Sucursales */}
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 10, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Sucursales ({s.branches?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickBranchForSupplier(quickBranchForSupplier === s.id ? null : s.id);
                      setQuickBranch(EMPTY_BRANCH_DRAFT);
                    }}
                    aria-label="Agregar sucursal"
                    style={{
                      width: 24, height: 24, borderRadius: "var(--border-radius-sm)",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-card)", color: "var(--text-secondary)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {(s.branches || []).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {(s.branches || []).map((b) => (
                      <div key={b.id} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{b.name}</span>
                        {b.address ? <span style={{ color: "var(--text-muted)" }}>· {b.address}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sin sucursales registradas.</div>
                )}

                {/* Quick branch form */}
                <AnimatePresence initial={false}>
                {quickBranchForSupplier === s.id ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{
                    overflow: "hidden",
                    marginTop: 10, padding: 10,
                    background: "var(--bg-input)", borderRadius: "var(--border-radius-md)",
                    border: "1px solid var(--border-default)",
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <input
                      style={{ ...INPUT_STYLE, fontSize: "0.8125rem", padding: "8px 10px" }}
                      placeholder="Nombre de la sucursal *"
                      value={quickBranch.name}
                      onChange={(e) => setQuickBranch({ ...quickBranch, name: e.target.value })}
                      autoFocus
                    />
                    <input
                      style={{ ...INPUT_STYLE, fontSize: "0.8125rem", padding: "8px 10px" }}
                      placeholder="Dirección"
                      value={quickBranch.address}
                      onChange={(e) => setQuickBranch({ ...quickBranch, address: e.target.value })}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input
                        style={{ ...INPUT_STYLE, fontSize: "0.8125rem", padding: "8px 10px" }}
                        placeholder="Email sucursal"
                        value={quickBranch.email}
                        onChange={(e) => setQuickBranch({ ...quickBranch, email: e.target.value })}
                      />
                      <input
                        style={{ ...INPUT_STYLE, fontSize: "0.8125rem", padding: "8px 10px" }}
                        placeholder="Teléfono sucursal"
                        value={quickBranch.phone}
                        onChange={(e) => setQuickBranch({ ...quickBranch, phone: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => { setQuickBranchForSupplier(null); setQuickBranch(EMPTY_BRANCH_DRAFT); }}
                        style={miniBtnStyle()}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveQuickBranch}
                        disabled={savingQuickBranch}
                        style={miniBtnStyle(true)}
                      >
                        {savingQuickBranch ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </motion.div>
                ) : null}
                </AnimatePresence>
              </div>
            </AppCard>
            </motion.div>
          ))}
              </AppGrid>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Editar proveedor" : "Nuevo proveedor"}
        maxWidth="680px"
      >
        <form onSubmit={handleSubmit}>

          {/* ─── Sección 1: Datos generales ─── */}
          <div style={sectionTitleStyle}>Datos generales</div>

          <AppFormField label="Nombre / Razón social" required>
            <input
              style={INPUT_STYLE}
              {...register("name")}
              placeholder="Nombre del proveedor"
            />
            {errors.name ? <p style={errorTextStyle}>{errors.name.message}</p> : null}
          </AppFormField>

          {/* Prefijo OC + Número de cliente en grid de 2 columnas */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16 }}>
            <AppFormField
              label="Prefijo OC"
              helperText="Se usa en el folio de órdenes de compra."
            >
              <input
                style={{ ...INPUT_STYLE, fontFamily: "monospace", textTransform: "uppercase" }}
                {...register("prefix", {
                  onChange: (e) => setValue("prefix", e.target.value.toUpperCase()),
                })}
                placeholder="Ej. HD, LC, AM"
                maxLength={4}
              />
              {errors.prefix ? <p style={errorTextStyle}>{errors.prefix.message}</p> : null}
            </AppFormField>

            <AppFormField label="Número de cliente">
              <input
                style={INPUT_STYLE}
                {...register("client_number")}
                placeholder="Nuestro número con el proveedor"
              />
            </AppFormField>
          </div>

          {/* Toggle activo */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: "var(--border-radius-md)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-input)",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                Proveedor activo
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                Solo los activos aparecen en los selectores de materiales y compras.
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
              <input
                type="checkbox"
                {...register("active")}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: "absolute", cursor: "pointer",
                top: 0, left: 0, right: 0, bottom: 0,
                background: formActive ? "var(--accent)" : "var(--border-default)",
                borderRadius: "var(--border-radius-lg)", transition: "0.2s",
              }} />
              <span style={{
                position: "absolute",
                left: formActive ? 22 : 2, top: 2,
                width: 20, height: 20,
                background: "#fff", borderRadius: "50%",
                transition: "0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </label>
          </div>

          {/* ─── Sección 2: Persona de contacto ─── */}
          <div style={sectionTitleStyle}>Persona de contacto</div>

          <AppFormField
            label="Nombre persona de contacto"
            helperText="Aplica para todas las sucursales (contacto general)."
          >
            <input
              style={INPUT_STYLE}
              {...register("contact_name")}
              placeholder="Persona de contacto"
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Email persona de contacto">
              <input
                type="email"
                style={INPUT_STYLE}
                {...register("contact_email")}
                placeholder="correo@ejemplo.com"
              />
              {errors.contact_email ? (
                <p style={errorTextStyle}>{errors.contact_email.message}</p>
              ) : null}
            </AppFormField>

            <AppFormField label="Teléfono persona de contacto">
              <input
                style={INPUT_STYLE}
                {...register("contact_phone")}
                placeholder="+52 ..."
              />
            </AppFormField>
          </div>

          <AppFormField label="Notas">
            <textarea
              style={{ ...INPUT_STYLE, resize: "vertical", minHeight: 70 }}
              {...register("notes")}
              placeholder="Notas internas, especialidades, condiciones..."
            />
          </AppFormField>

          {/* ─── Sección crédito ─── */}
          <div style={sectionTitleStyle}>Condiciones de crédito</div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: "var(--border-radius-md)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-input)",
            marginBottom: formTieneCredito ? 12 : 16,
          }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                ¿Tiene crédito?
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                El proveedor otorga crédito a pagar después de la factura.
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
              <input
                type="checkbox"
                {...register("tiene_credito")}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: "absolute", cursor: "pointer",
                top: 0, left: 0, right: 0, bottom: 0,
                background: formTieneCredito ? "var(--metric-value-green)" : "var(--border-default)",
                borderRadius: "var(--border-radius-lg)", transition: "0.2s",
              }} />
              <span style={{
                position: "absolute",
                left: formTieneCredito ? 22 : 2, top: 2,
                width: 20, height: 20,
                background: "#fff", borderRadius: "50%",
                transition: "0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </label>
          </div>

          {formTieneCredito ? (
            <div style={{ marginBottom: 16 }}>
              <AppFormField label="Días de crédito">
                <input
                  type="number"
                  min={1}
                  style={INPUT_STYLE}
                  {...register("dias_credito", { valueAsNumber: true })}
                  placeholder="30"
                />
              </AppFormField>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {[15, 30, 45, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue("dias_credito", d)}
                    style={{
                      padding: "5px 12px", borderRadius: "var(--border-radius-md)", cursor: "pointer",
                      fontSize: "0.75rem", fontWeight: 600,
                      border: "1px solid var(--border-default)",
                      background: formDiasCredito === d ? "var(--accent)" : "var(--bg-card)",
                      color: formDiasCredito === d ? "#fff" : "var(--text-secondary)",
                      transition: "0.15s",
                    }}
                  >
                    {d} días
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* ─── Sección 3: Sucursales (solo en editar) ─── */}
          {editingId ? (
            <>
              <div style={sectionTitleStyle}>Sucursales</div>

              {editingBranches.length === 0 ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 10 }}>
                  Sin sucursales registradas.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {editingBranches.map((b) => (
                    editingBranchId === b.id ? (
                      /* Form de edición inline */
                      <div key={b.id} style={{
                        padding: 12, borderRadius: "var(--border-radius-md)",
                        background: "var(--bg-input)",
                        border: "1px solid var(--accent)",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}>
                        <AppFormField label="Nombre de la sucursal" required>
                          <input
                            style={INPUT_STYLE}
                            value={editingBranchForm.name}
                            onChange={(e) => setEditingBranchForm({ ...editingBranchForm, name: e.target.value })}
                          />
                        </AppFormField>

                        <AppFormField label="Dirección">
                          <input
                            style={INPUT_STYLE}
                            value={editingBranchForm.address}
                            onChange={(e) => setEditingBranchForm({ ...editingBranchForm, address: e.target.value })}
                            placeholder="Calle, número, colonia, ciudad"
                          />
                        </AppFormField>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <AppFormField label="Email de la sucursal">
                            <input
                              type="email"
                              style={INPUT_STYLE}
                              value={editingBranchForm.email}
                              onChange={(e) => setEditingBranchForm({ ...editingBranchForm, email: e.target.value })}
                              placeholder="correo@sucursal.com"
                            />
                          </AppFormField>

                          <AppFormField label="Teléfono de la sucursal">
                            <input
                              style={INPUT_STYLE}
                              value={editingBranchForm.phone}
                              onChange={(e) => setEditingBranchForm({ ...editingBranchForm, phone: e.target.value })}
                              placeholder="+52 ..."
                            />
                          </AppFormField>
                        </div>

                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button type="button" onClick={cancelEditBranch} style={miniBtnStyle()}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditBranch}
                            disabled={savingEditBranch}
                            style={miniBtnStyle(true)}
                          >
                            {savingEditBranch ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Renglón normal */
                      <div key={b.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 8, padding: "8px 12px",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--border-radius-md)", background: "var(--bg-input)",
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {b.name}
                          </div>
                          {b.address ? (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{b.address}</div>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => startEditBranch(b)}
                            aria-label="Editar sucursal"
                            style={{
                              width: 28, height: 28, borderRadius: "var(--border-radius-sm)",
                              border: "1px solid var(--border-default)",
                              background: "var(--bg-card)", color: "var(--text-secondary)",
                              cursor: "pointer", display: "inline-flex",
                              alignItems: "center", justifyContent: "center", padding: 0,
                            }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveBranch(b.id)}
                            aria-label="Eliminar sucursal"
                            style={{
                              width: 28, height: 28, borderRadius: "var(--border-radius-sm)",
                              border: "1px solid var(--border-default)",
                              background: "var(--badge-bg-red)", color: "var(--badge-text-red)",
                              cursor: "pointer", display: "inline-flex",
                              alignItems: "center", justifyContent: "center", padding: 0,
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {showBranchForm ? (
                <div style={{
                  padding: 12, borderRadius: "var(--border-radius-md)",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  display: "flex", flexDirection: "column", gap: 10,
                  marginBottom: 10,
                }}>
                  <AppFormField label="Nombre de la sucursal" required>
                    <input
                      style={INPUT_STYLE}
                      value={branchDraft.name}
                      onChange={(e) => setBranchDraft({ ...branchDraft, name: e.target.value })}
                      placeholder="Ej: Sucursal Norte"
                    />
                  </AppFormField>

                  <AppFormField label="Dirección">
                    <input
                      style={INPUT_STYLE}
                      value={branchDraft.address}
                      onChange={(e) => setBranchDraft({ ...branchDraft, address: e.target.value })}
                      placeholder="Calle, número, colonia, ciudad"
                    />
                  </AppFormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <AppFormField label="Email de la sucursal">
                      <input
                        type="email"
                        style={INPUT_STYLE}
                        value={branchDraft.email}
                        onChange={(e) => setBranchDraft({ ...branchDraft, email: e.target.value })}
                        placeholder="correo@sucursal.com"
                      />
                    </AppFormField>

                    <AppFormField label="Teléfono de la sucursal">
                      <input
                        style={INPUT_STYLE}
                        value={branchDraft.phone}
                        onChange={(e) => setBranchDraft({ ...branchDraft, phone: e.target.value })}
                        placeholder="+52 ..."
                      />
                    </AppFormField>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => { setShowBranchForm(false); setBranchDraft(EMPTY_BRANCH_DRAFT); }}
                      style={miniBtnStyle()}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveModalBranch}
                      disabled={savingBranch}
                      style={miniBtnStyle(true)}
                    >
                      {savingBranch ? "Guardando..." : "Guardar sucursal"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowBranchForm(true); setBranchDraft(EMPTY_BRANCH_DRAFT); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", borderRadius: "var(--border-radius-md)",
                    border: "1px dashed var(--border-strong)",
                    background: "transparent", color: "var(--text-secondary)",
                    fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                    marginBottom: 10,
                  }}
                >
                  <Plus size={14} /> Agregar sucursal
                </button>
              )}
            </>
          ) : null}

          {formError ? (
            <div style={{
              color: "var(--badge-text-red)",
              marginBottom: 12, fontSize: "0.8125rem", fontWeight: 600,
            }}>
              {formError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-default)" }}>
            <UiButton type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </UiButton>
            <UiButton type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear proveedor"}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}

/* ── Helpers de estilos ───────────────────────────────────────────── */

function menuBtnStyle(danger = false): CSSProperties {
  return {
    display: "block", width: "100%",
    padding: "10px 14px", textAlign: "left",
    background: "transparent", border: "none",
    color: danger ? "var(--badge-text-red)" : "var(--text-primary)",
    fontSize: "0.8125rem", cursor: "pointer",
  };
}

function miniBtnStyle(primary = false): CSSProperties {
  return {
    padding: "7px 12px", borderRadius: "var(--border-radius-md)",
    border: primary ? "1px solid var(--accent)" : "1px solid var(--border-default)",
    background: primary ? "var(--accent)" : "var(--bg-card)",
    color: primary ? "#fff" : "var(--text-primary)",
    fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
  };
}
