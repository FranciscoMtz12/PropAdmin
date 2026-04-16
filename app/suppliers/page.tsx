"use client";

/*
  Catálogo de proveedores.

  Tabla esperada: suppliers
    id, company_id, name, contact_name, email, phone, address,
    tax_id, notes, active (bool default true),
    created_at, updated_at, deleted_at (soft-delete)

  Se usa en:
  - app/maintenance/page.tsx → select de proveedor por material
  - generación de órdenes de compra por proveedor
*/

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { MoreVertical, Package, Plus, Truck } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import AppBadge from "@/components/AppBadge";

/* ── Types ─────────────────────────────────────────────────────────── */

type Supplier = {
  id:              string;
  name:            string;
  contact_name:    string | null;
  email:           string | null;
  phone:           string | null;
  address:         string | null;
  tax_id:          string | null;
  client_number: string | null;
  cfdi_use:        string | null;
  notes:           string | null;
  active:          boolean;
};

type FormState = {
  name:            string;
  contact_name:    string;
  email:           string;
  phone:           string;
  address:         string;
  tax_id:          string;
  client_number: string;
  cfdi_use:        string;
  notes:           string;
  active:          boolean;
};

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

const EMPTY_FORM: FormState = {
  name: "", contact_name: "", email: "", phone: "", address: "",
  tax_id: "", client_number: "", cfdi_use: DEFAULT_CFDI_USE,
  notes: "", active: true,
};

/* ── Component ─────────────────────────────────────────────────────── */

export default function SuppliersPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [suppliers,   setSuppliers]   = useState<Supplier[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [msg,         setMsg]         = useState("");

  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState("");

  const [openMenuId,  setOpenMenuId]  = useState<string | null>(null);

  /* ── Load ────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!userLoading && user?.company_id) void loadSuppliers(user.company_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user]);

  async function loadSuppliers(companyId: string) {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, contact_name, email, phone, address, tax_id, client_number, cfdi_use, notes, active")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) {
      console.error("loadSuppliers error:", error);
      setMsg(`No se pudieron cargar los proveedores: ${error.message}`);
      setSuppliers([]);
    } else {
      setSuppliers((data as Supplier[]) || []);
    }
    setLoading(false);
  }

  /* ── Metrics ─────────────────────────────────────────────────────── */

  const { total, activeCount, inactiveCount } = useMemo(() => {
    const total         = suppliers.length;
    const activeCount   = suppliers.filter(s => s.active).length;
    const inactiveCount = total - activeCount;
    return { total, activeCount, inactiveCount };
  }, [suppliers]);

  /* ── Form handlers ───────────────────────────────────────────────── */

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
    setOpenMenuId(null);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name:            s.name,
      contact_name:    s.contact_name    || "",
      email:           s.email           || "",
      phone:           s.phone           || "",
      address:         s.address         || "",
      tax_id:          s.tax_id          || "",
      client_number: s.client_number || "",
      cfdi_use:        s.cfdi_use        || DEFAULT_CFDI_USE,
      notes:           s.notes           || "",
      active:          s.active,
    });
    setFormError("");
    setShowModal(true);
    setOpenMenuId(null);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.company_id) return;
    if (!form.name.trim()) { setFormError("El nombre es requerido."); return; }

    setSaving(true);
    setFormError("");

    const payload = {
      name:            form.name.trim(),
      contact_name:    form.contact_name.trim()    || null,
      email:           form.email.trim()           || null,
      phone:           form.phone.trim()           || null,
      address:         form.address.trim()         || null,
      tax_id:          form.tax_id.trim()          || null,
      client_number: form.client_number.trim() || null,
      cfdi_use:        form.cfdi_use.trim()        || DEFAULT_CFDI_USE,
      notes:           form.notes.trim()           || null,
      active:          form.active,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("suppliers")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("suppliers")
        .insert({ ...payload, company_id: user.company_id }));
    }

    setSaving(false);

    if (error) { setFormError("No se pudo guardar el proveedor."); return; }

    closeModal();
    setMsg(editingId ? "Proveedor actualizado correctamente." : "Proveedor creado correctamente.");
    void loadSuppliers(user.company_id);
  }

  async function handleArchive(id: string) {
    if (!user?.company_id) return;
    setOpenMenuId(null);
    const confirmed = window.confirm("¿Archivar este proveedor?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("suppliers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) { setMsg("No se pudo archivar el proveedor."); return; }
    setMsg("Proveedor archivado correctamente.");
    void loadSuppliers(user.company_id);
  }

  /* ── Styles ──────────────────────────────────────────────────────── */

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

  const cardStyle: CSSProperties = {
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    position: "relative",
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  if (userLoading) {
    return (
      <PageContainer>
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Proveedores"
        titleIcon={<Truck size={18} />}
        subtitle="Catálogo de proveedores usado en materiales y órdenes de compra."
        actions={
          <UiButton variant="primary" onClick={openCreate} icon={<Plus size={16} />}>
            Nuevo proveedor
          </UiButton>
        }
      />

      {msg ? (
        <AppCard style={{ marginBottom: 16 }}>
          <div style={{
            color: msg.includes("correctamente")
              ? "var(--badge-text-blue)"
              : "var(--badge-text-red)",
            fontWeight: 600,
          }}>
            {msg}
          </div>
        </AppCard>
      ) : null}

      {/* Métricas */}
      <AppGrid minWidth={220} style={{ marginBottom: 20 }}>
        <MetricCard
          label="Total proveedores"
          value={total}
          variant="neutral"
          icon={<Package size={18} />}
        />
        <MetricCard
          label="Activos"
          value={activeCount}
          variant="green"
        />
        <MetricCard
          label="Inactivos"
          value={inactiveCount}
          variant="amber"
        />
      </AppGrid>

      {/* Lista */}
      {loading ? (
        <AppCard>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Cargando proveedores...</p>
        </AppCard>
      ) : suppliers.length === 0 ? (
        <AppCard>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            No hay proveedores. Crea el primero con el botón de arriba.
          </p>
        </AppCard>
      ) : (
        <AppGrid minWidth={280}>
          {suppliers.map(s => (
            <AppCard key={s.id} style={cardStyle}>

              {/* Header de la card */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </div>
                  {s.tax_id ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontFamily: "monospace" }}>
                      RFC: {s.tax_id}
                    </div>
                  ) : null}
                  {s.client_number ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Cliente #: {s.client_number}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <AppBadge variant={s.active ? "green" : "amber"}>
                    {s.active ? "Activo" : "Inactivo"}
                  </AppBadge>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
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

                    {openMenuId === s.id ? (
                      <div
                        style={{
                          position: "absolute",
                          top: 36,
                          right: 0,
                          minWidth: 150,
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 10,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                          zIndex: 10,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          style={{
                            display: "block", width: "100%",
                            padding: "10px 14px", textAlign: "left",
                            background: "transparent", border: "none",
                            color: "var(--text-primary)",
                            fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(s.id)}
                          style={{
                            display: "block", width: "100%",
                            padding: "10px 14px", textAlign: "left",
                            background: "transparent", border: "none",
                            color: "var(--badge-text-red)",
                            fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Archivar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Datos de contacto */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-secondary)" }}>
                {s.contact_name ? <div>{s.contact_name}</div> : null}
                {s.phone        ? <div>{s.phone}</div>        : null}
                {s.email        ? <div style={{ wordBreak: "break-all" }}>{s.email}</div> : null}
                {!s.contact_name && !s.phone && !s.email ? (
                  <div style={{ color: "var(--text-muted)" }}>Sin datos de contacto</div>
                ) : null}
              </div>

            </AppCard>
          ))}
        </AppGrid>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Editar proveedor" : "Nuevo proveedor"}
        maxWidth="600px"
      >
        <form onSubmit={handleSubmit}>
          <AppFormField label="Nombre" required>
            <input
              style={INPUT_STYLE}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre del proveedor"
            />
          </AppFormField>

          <AppFormField label="Nombre de contacto">
            <input
              style={INPUT_STYLE}
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              placeholder="Persona de contacto"
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Email">
              <input
                type="email"
                style={INPUT_STYLE}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </AppFormField>

            <AppFormField label="Teléfono">
              <input
                style={INPUT_STYLE}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+52 ..."
              />
            </AppFormField>
          </div>

          <AppFormField label="Dirección">
            <input
              style={INPUT_STYLE}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Calle, número, colonia, ciudad"
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="RFC">
              <input
                style={{ ...INPUT_STYLE, fontFamily: "monospace" }}
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value.toUpperCase() })}
                placeholder="RFC para facturación"
                maxLength={13}
              />
            </AppFormField>

            <AppFormField label="Número de cliente">
              <input
                style={INPUT_STYLE}
                value={form.client_number}
                onChange={(e) => setForm({ ...form, client_number: e.target.value })}
                placeholder="Nuestro número con el proveedor"
              />
            </AppFormField>
          </div>

          <AppFormField label="Uso CFDI">
            <select
              style={INPUT_STYLE}
              value={form.cfdi_use}
              onChange={(e) => setForm({ ...form, cfdi_use: e.target.value })}
            >
              {CFDI_USES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </AppFormField>

          <AppFormField label="Notas">
            <textarea
              style={{ ...INPUT_STYLE, resize: "vertical", minHeight: 80 }}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas internas, especialidades, condiciones..."
            />
          </AppFormField>

          {/* Toggle activo */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: 10,
            border: "1px solid var(--border-default)",
            background: "var(--bg-input)",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Proveedor activo
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Solo los activos aparecen en el selector de materiales.
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: "absolute", cursor: "pointer",
                top: 0, left: 0, right: 0, bottom: 0,
                background: form.active ? "var(--accent)" : "var(--border-default)",
                borderRadius: 12, transition: "0.2s",
              }} />
              <span style={{
                position: "absolute",
                left: form.active ? 22 : 2,
                top: 2,
                width: 20, height: 20,
                background: "#fff", borderRadius: "50%",
                transition: "0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </label>
          </div>

          {formError ? (
            <div style={{
              color: "var(--badge-text-red)",
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {formError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <UiButton type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </UiButton>
            <UiButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear proveedor"}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
