"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Mail, Palette, Send, Shield, Trash2, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppTabs from "@/components/AppTabs";

// ─── Types ─────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  short_name: string | null;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  regime: string | null;
  zip_code: string | null;
  brand_color: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
  initials: string | null;
  admin_contact_email: string | null;
  admin_contact_phone: string | null;
  purchases_contact_email: string | null;
  purchases_contact_phone: string | null;
};

type Invitation = {
  id: string;
  token: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

// ─── Helpers ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: ".6rem .85rem",
  background: "var(--bg-input, var(--bg-card))",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 5,
  fontWeight: 500,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      style={{
        padding: ".55rem 1.25rem",
        background: saving ? "var(--accent-muted, #6B1A3F)" : "var(--accent, #8B2252)",
        border: "none",
        borderRadius: 8,
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.7 : 1,
        transition: "opacity .15s",
      }}
    >
      {saving ? "Guardando..." : "Guardar"}
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ─── Main ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("general");
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // ── tab: general
  const [gName, setGName]         = useState("");
  const [gShort, setGShort]       = useState("");
  const [gPhone, setGPhone]       = useState("");
  const [gEmail, setGEmail]       = useState("");
  const [gAddress, setGAddress]   = useState("");
  const [gInitials, setGInitials] = useState("");
  const [savingG, setSavingG]     = useState(false);

  // ── tab: fiscal
  const [fLegal, setFLegal]     = useState("");
  const [fTaxId, setFTaxId]     = useState("");
  const [fRegime, setFRegime]   = useState("");
  const [fZip, setFZip]         = useState("");
  const [savingF, setSavingF]   = useState(false);

  // ── tab: contacto
  const [cAdminEmail, setCAdminEmail]       = useState("");
  const [cAdminPhone, setCAdminPhone]       = useState("");
  const [cPurchEmail, setCPurchEmail]       = useState("");
  const [cPurchPhone, setCPurchPhone]       = useState("");
  const [savingC, setSavingC]               = useState(false);

  // ── tab: marca
  const [mColor, setMColor]         = useState("#8B2252");
  const [mLogoUrl, setMLogoUrl]     = useState("");
  const [mLogoDarkUrl, setMLogoDarkUrl] = useState("");
  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview]   = useState("");
  const [logoDarkPreview, setLogoDarkPreview] = useState("");
  const [savingM, setSavingM]       = useState(false);

  // ── tab: invitaciones
  const [invitations, setInvitations]   = useState<Invitation[]>([]);
  const [invEmail, setInvEmail]         = useState("");
  const [invExpDays, setInvExpDays]     = useState("7");
  const [sendingInv, setSendingInv]     = useState(false);
  const [revokingId, setRevokingId]     = useState<string | null>(null);
  const [invLink, setInvLink]           = useState("");

  // ─── load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.company_id) return;
    void loadCompany();
    void loadInvitations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id]);

  async function loadCompany() {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id,name,short_name,legal_name,email,phone,address,tax_id,regime,zip_code,brand_color,logo_url,logo_dark_url,initials,admin_contact_email,admin_contact_phone,purchases_contact_email,purchases_contact_phone")
      .eq("id", user!.company_id)
      .single();
    if (data) {
      setCompany(data);
      // populate fields
      setGName(data.name ?? "");
      setGShort(data.short_name ?? "");
      setGPhone(data.phone ?? "");
      setGEmail(data.email ?? "");
      setGAddress(data.address ?? "");
      setGInitials(data.initials ?? "");
      setFLegal(data.legal_name ?? "");
      setFTaxId(data.tax_id ?? "");
      setFRegime(data.regime ?? "");
      setFZip(data.zip_code ?? "");
      setCAdminEmail(data.admin_contact_email ?? "");
      setCAdminPhone(data.admin_contact_phone ?? "");
      setCPurchEmail(data.purchases_contact_email ?? "");
      setCPurchPhone(data.purchases_contact_phone ?? "");
      setMColor(data.brand_color ?? "#8B2252");
      setMLogoUrl(data.logo_url ?? "");
      setMLogoDarkUrl(data.logo_dark_url ?? "");
    }
    setLoading(false);
  }

  async function loadInvitations() {
    const { data } = await supabase
      .from("invitations")
      .select("id,token,email,expires_at,used_at,created_at")
      .eq("company_id", user!.company_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setInvitations(data ?? []);
  }

  // ─── saves ─────────────────────────────────────────────────────────
  async function saveGeneral() {
    if (!company) return;
    setSavingG(true);
    const { error } = await supabase.from("companies").update({
      name: gName.trim(),
      short_name: gShort.trim() || null,
      phone: gPhone.trim() || null,
      email: gEmail.trim() || null,
      address: gAddress.trim() || null,
      initials: gInitials.trim().toUpperCase().slice(0, 4) || null,
    }).eq("id", company.id);
    setSavingG(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Datos generales guardados");
  }

  async function saveFiscal() {
    if (!company) return;
    setSavingF(true);
    const { error } = await supabase.from("companies").update({
      legal_name: fLegal.trim() || null,
      tax_id: fTaxId.trim().toUpperCase() || null,
      regime: fRegime.trim() || null,
      zip_code: fZip.trim() || null,
    }).eq("id", company.id);
    setSavingF(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Datos fiscales guardados");
  }

  async function saveContacto() {
    if (!company) return;
    setSavingC(true);
    const { error } = await supabase.from("companies").update({
      admin_contact_email: cAdminEmail.trim() || null,
      admin_contact_phone: cAdminPhone.trim() || null,
      purchases_contact_email: cPurchEmail.trim() || null,
      purchases_contact_phone: cPurchPhone.trim() || null,
    }).eq("id", company.id);
    setSavingC(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Contactos guardados");
  }

  async function uploadLogo(file: File, dark: boolean): Promise<string> {
    const ext = file.name.split(".").pop();
    const suffix = dark ? "_dark" : "";
    const path = `logos/${company!.id}/logo${suffix}.${ext}`;
    await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    const { data: pub } = supabase.storage.from("company-assets").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function saveMarca() {
    if (!company) return;
    setSavingM(true);
    let logoUrl = mLogoUrl;
    let logoDarkUrl = mLogoDarkUrl;
    if (logoFile) logoUrl = await uploadLogo(logoFile, false);
    if (logoDarkFile) logoDarkUrl = await uploadLogo(logoDarkFile, true);
    const { error } = await supabase.from("companies").update({
      brand_color: mColor,
      logo_url: logoUrl || null,
      logo_dark_url: logoDarkUrl || null,
    }).eq("id", company.id);
    setSavingM(false);
    if (error) { toast.error("Error al guardar"); return; }
    setMLogoUrl(logoUrl);
    setMLogoDarkUrl(logoDarkUrl);
    setLogoFile(null); setLogoDarkFile(null);
    setLogoPreview(""); setLogoDarkPreview("");
    toast.success("Marca guardada");
  }

  // ─── invitations ────────────────────────────────────────────────────
  function generateToken(): string {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
  }

  async function createInvitation() {
    if (!company || !user) return;
    setSendingInv(true);
    const token = generateToken();
    const days = Math.max(1, Math.min(90, parseInt(invExpDays) || 7));
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const { data, error } = await supabase.from("invitations").insert({
      token,
      email: invEmail.trim() || null,
      created_by: user.id,
      company_id: company.id,
      expires_at: expiresAt,
    }).select("id,token,email,expires_at,used_at,created_at").single();
    setSendingInv(false);
    if (error || !data) { toast.error("Error al crear invitación"); return; }
    setInvitations((prev) => [data, ...prev]);
    const link = `${window.location.origin}/register?invite=${token}`;
    setInvLink(link);
    setInvEmail("");
    toast.success("Invitación creada");
  }

  async function revokeInvitation(id: string) {
    setRevokingId(id);
    await supabase.from("invitations").update({ used_at: new Date().toISOString() }).eq("id", id);
    setInvitations((prev) => prev.map((i) => i.id === id ? { ...i, used_at: new Date().toISOString() } : i));
    setRevokingId(null);
    toast.success("Invitación revocada");
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/register?invite=${token}`;
    navigator.clipboard.writeText(link).then(() => toast.success("Enlace copiado"));
  }

  function handleLogoInput(e: React.ChangeEvent<HTMLInputElement>, dark: boolean) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (dark) setLogoDarkPreview(ev.target?.result as string);
      else setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (dark) setLogoDarkFile(file);
    else setLogoFile(file);
  }

  // ─── tabs ────────────────────────────────────────────────────────────
  const tabs = [
    { key: "general",      label: "General",      icon: <Building2 size={14} /> },
    { key: "fiscal",       label: "Fiscal",       icon: <CreditCard size={14} /> },
    { key: "contacto",     label: "Contacto",     icon: <Mail size={14} /> },
    { key: "marca",        label: "Marca",        icon: <Palette size={14} /> },
    { key: "invitaciones", label: "Invitaciones", icon: <Send size={14} />, count: invitations.filter(i => !i.used_at && new Date(i.expires_at) > new Date()).length },
  ];

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: "2rem", color: "var(--text-secondary)", fontSize: 14 }}>Cargando configuración...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Configuración"
        subtitle={company?.short_name ?? company?.name ?? ""}
        titleIcon={<Shield size={20} />}
      />

      <div style={{ marginBottom: "1.5rem" }}>
        <AppTabs items={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── General ──────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <SectionCard title="Datos generales">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
            <Field label="Nombre de la empresa">
              <input style={inputStyle} value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Inmobiliaria XYZ S.A. de C.V." />
            </Field>
            <Field label="Nombre corto / pantalla">
              <input style={inputStyle} value={gShort} onChange={(e) => setGShort(e.target.value)} placeholder="XYZ" />
            </Field>
            <Field label="Iniciales (máx. 4)">
              <input style={inputStyle} value={gInitials} onChange={(e) => setGInitials(e.target.value.slice(0, 4).toUpperCase())} placeholder="XYZ" maxLength={4} />
            </Field>
            <Field label="Teléfono">
              <input style={inputStyle} value={gPhone} onChange={(e) => setGPhone(e.target.value)} placeholder="+52 55 1234 5678" />
            </Field>
            <Field label="Email principal">
              <input style={inputStyle} type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="contacto@empresa.com" />
            </Field>
            <Field label="Dirección / Ciudad">
              <input style={inputStyle} value={gAddress} onChange={(e) => setGAddress(e.target.value)} placeholder="Ciudad de México, CDMX" />
            </Field>
          </div>
          <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
            <SaveBtn saving={savingG} onClick={saveGeneral} />
          </div>
        </SectionCard>
      )}

      {/* ── Fiscal ───────────────────────────────────────────────── */}
      {activeTab === "fiscal" && (
        <SectionCard title="Datos fiscales">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
            <Field label="Razón social">
              <input style={inputStyle} value={fLegal} onChange={(e) => setFLegal(e.target.value)} placeholder="INMOBILIARIA XYZ S.A. DE C.V." />
            </Field>
            <Field label="RFC">
              <input style={inputStyle} value={fTaxId} onChange={(e) => setFTaxId(e.target.value.toUpperCase())} placeholder="XYZ010101ABC" maxLength={13} />
            </Field>
            <Field label="Régimen fiscal">
              <input style={inputStyle} value={fRegime} onChange={(e) => setFRegime(e.target.value)} placeholder="601 - General de Ley Personas Morales" />
            </Field>
            <Field label="Código postal">
              <input style={inputStyle} value={fZip} onChange={(e) => setFZip(e.target.value)} placeholder="06600" maxLength={5} />
            </Field>
          </div>
          <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
            <SaveBtn saving={savingF} onClick={saveFiscal} />
          </div>
        </SectionCard>
      )}

      {/* ── Contacto ─────────────────────────────────────────────── */}
      {activeTab === "contacto" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <SectionCard title="Contacto administración">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <Field label="Email">
                <input style={inputStyle} type="email" value={cAdminEmail} onChange={(e) => setCAdminEmail(e.target.value)} placeholder="admin@empresa.com" />
              </Field>
              <Field label="Teléfono">
                <input style={inputStyle} value={cAdminPhone} onChange={(e) => setCAdminPhone(e.target.value)} placeholder="+52 55 1234 5678" />
              </Field>
            </div>
          </SectionCard>
          <SectionCard title="Contacto compras">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <Field label="Email">
                <input style={inputStyle} type="email" value={cPurchEmail} onChange={(e) => setCPurchEmail(e.target.value)} placeholder="compras@empresa.com" />
              </Field>
              <Field label="Teléfono">
                <input style={inputStyle} value={cPurchPhone} onChange={(e) => setCPurchPhone(e.target.value)} placeholder="+52 55 9876 5432" />
              </Field>
            </div>
          </SectionCard>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SaveBtn saving={savingC} onClick={saveContacto} />
          </div>
        </div>
      )}

      {/* ── Marca ────────────────────────────────────────────────── */}
      {activeTab === "marca" && (
        <SectionCard title="Identidad de marca">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Color */}
            <div>
              <label style={labelStyle}>Color de marca</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="color" value={mColor} onChange={(e) => setMColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: 8, border: "1px solid var(--border-default)", cursor: "pointer", padding: 0, background: "none" }} />
                <input style={{ ...inputStyle, width: "auto", flex: 1, maxWidth: 160 }} value={mColor} onChange={(e) => setMColor(e.target.value)} maxLength={7} placeholder="#8B2252" />
                <div style={{ width: 44, height: 44, borderRadius: 8, background: mColor, border: "1px solid var(--border-default)" }} />
              </div>
            </div>

            {/* Logos */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.25rem" }}>
              {[
                { label: "Logo principal (fondo claro)", preview: logoPreview || mLogoUrl, dark: false, inputRef: logoInputRef },
                { label: "Logo modo oscuro", preview: logoDarkPreview || mLogoDarkUrl, dark: true, inputRef: logoDarkInputRef },
              ].map(({ label, preview, dark, inputRef }) => (
                <div key={String(dark)}>
                  <label style={labelStyle}>{label}</label>
                  <input ref={inputRef} type="file" accept="image/*" onChange={(e) => handleLogoInput(e, dark)} style={{ display: "none" }} />
                  {preview ? (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border-default)", background: dark ? "#1a1a2e" : "#f5f5f5" }} />
                      <button type="button" onClick={() => { if (dark) { setLogoDarkFile(null); setLogoDarkPreview(""); setMLogoDarkUrl(""); } else { setLogoFile(null); setLogoPreview(""); setMLogoUrl(""); } }} style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "#E24B4A", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => inputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, padding: ".6rem 1rem", background: "var(--bg-card)", border: "1px dashed var(--border-default)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
                      <Upload size={14} /> Subir logo
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <SaveBtn saving={savingM} onClick={saveMarca} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Invitaciones ─────────────────────────────────────────── */}
      {activeTab === "invitaciones" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <SectionCard title="Nueva invitación">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
                <Field label="Email del invitado (opcional)">
                  <input style={inputStyle} type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="nuevo@empresa.com" />
                </Field>
                <Field label="Vence en (días)">
                  <input style={{ ...inputStyle, width: 80 }} type="number" min={1} max={90} value={invExpDays} onChange={(e) => setInvExpDays(e.target.value)} />
                </Field>
              </div>

              <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={createInvitation}
                  disabled={sendingInv}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: ".6rem 1.1rem", background: "var(--accent, #8B2252)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: sendingInv ? "not-allowed" : "pointer", opacity: sendingInv ? 0.7 : 1 }}
                >
                  <Send size={14} /> {sendingInv ? "Generando..." : "Generar invitación"}
                </button>
              </div>

              {invLink && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, wordBreak: "break-all" }}>{invLink}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(invLink).then(() => toast.success("Copiado"))}
                    style={{ padding: ".4rem .8rem", background: "var(--accent-muted, rgba(139,34,82,.15))", border: "1px solid var(--accent, #8B2252)", borderRadius: 6, color: "var(--accent, #8B2252)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Copiar enlace
                  </button>
                  <button type="button" onClick={() => setInvLink("")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}>
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Invitaciones enviadas">
            {invitations.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No hay invitaciones.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {invitations.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  const used = Boolean(inv.used_at);
                  const active = !used && !expired;
                  return (
                    <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.75rem 1rem", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 10, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                          {inv.email ?? <span style={{ color: "var(--text-secondary)" }}>Sin email</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          Vence: {formatDate(inv.expires_at)} · Creada: {formatDate(inv.created_at)}
                        </div>
                      </div>
                      <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: active ? "rgba(29,158,117,.15)" : "rgba(0,0,0,.1)", color: active ? "#1D9E75" : used ? "#888" : "#E24B4A" }}>
                        {active ? "Activa" : used ? "Usada" : "Expirada"}
                      </span>
                      {active && (
                        <>
                          <button type="button" onClick={() => copyLink(inv.token)} style={{ padding: ".35rem .75rem", background: "none", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                            Copiar
                          </button>
                          <button type="button" onClick={() => revokeInvitation(inv.id)} disabled={revokingId === inv.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: ".35rem .75rem", background: "rgba(226,75,74,.1)", border: "1px solid rgba(226,75,74,.3)", borderRadius: 6, color: "#E24B4A", fontSize: 12, cursor: "pointer" }}>
                            <Trash2 size={12} /> Revocar
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
}
