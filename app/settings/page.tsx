"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, Building2, ChevronDown, ChevronUp, CreditCard, Download, FileText, Home,
  Info, Link2, Lock, Monitor, Palette, Phone, Send, Settings2, Shield,
  Trash2, Upload, User, UserPlus, Users, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { generateMetallicGradient } from "@/lib/color-utils";
import { type QuickLink, getAllowedModules, getDefaultQuickLinks, ICON_MAP } from "@/lib/quick-links";

import AppBadge from "@/components/AppBadge";
import AppGrid from "@/components/AppGrid";
import AppSelect from "@/components/AppSelect";
import AppTable from "@/components/AppTable";
import AppTabs, { AppTabPanel } from "@/components/AppTabs";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";

// ─── Types ───────────────────────────────────────────────────────────

type TabKey = "empresa" | "usuarios" | "apariencia" | "cuenta" | "sistema";

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
  accent_style: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
  logo_group_url: string | null;
  initials: string | null;
  admin_contact_email: string | null;
  admin_contact_phone: string | null;
  purchases_contact_email: string | null;
  purchases_contact_phone: string | null;
  group_id: string | null;
  created_at: string | null;
};

type Invitation = {
  id: string;
  token: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type UserRole =
  | "superadmin" | "titular" | "group_admin" | "administracion" | "directivo"
  | "compras" | "mantenimiento" | "field" | "tenant";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_superadmin: boolean;
  company_id: string;
  company_name: string;
  created_at: string;
};

type CompanyRow = { id: string; name: string };

// ─── Constants ───────────────────────────────────────────────────────

const ROLE_ORDER: UserRole[] = [
  "superadmin", "titular", "group_admin", "administracion", "directivo",
  "compras", "mantenimiento", "field",
];

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin", titular: "Titular", group_admin: "Admin de Grupo",
  administracion: "Administración", directivo: "Directivo",
  compras: "Compras", mantenimiento: "Mantenimiento",
  field: "Campo", tenant: "Inquilino",
};

const ROLE_STYLE: Record<UserRole, { bg: string; fg: string }> = {
  superadmin:     { bg: "#F3E8FF", fg: "var(--color-media)" },
  titular:        { bg: "var(--badge-bg-amber)", fg: "var(--color-warning-text)" },
  group_admin:    { bg: "var(--badge-bg-amber)", fg: "var(--color-warning-text)" },
  administracion: { bg: "var(--badge-bg-blue)",  fg: "var(--badge-text-blue)" },
  directivo:      { bg: "var(--badge-bg-gray)",  fg: "var(--badge-text-gray)" },
  compras:        { bg: "var(--priority-high-bg)", fg: "#EA580C" },
  mantenimiento:  { bg: "var(--badge-bg-green)", fg: "var(--badge-text-green)" },
  field:          { bg: "#DBEAFE", fg: "#1E40AF" },
  tenant:         { bg: "#CCFBF1", fg: "#0F766E" },
};

const createSchema = z.object({
  full_name: z.string().min(1, "Nombre obligatorio"),
  email: z.string().min(1, "Email obligatorio").email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["superadmin", "titular", "group_admin", "administracion", "directivo", "compras", "mantenimiento", "field"]),
  company_id: z.string().min(1, "Selecciona una empresa"),
});
type CreateValues = z.infer<typeof createSchema>;

// ─── Styles ──────────────────────────────────────────────────────────

const IS: React.CSSProperties = {
  width: "100%", padding: ".6rem .85rem",
  background: "var(--bg-input, var(--bg-card))",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-md)", color: "var(--text-primary)",
  fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
};

const LS: React.CSSProperties = {
  fontSize: "0.75rem", color: "var(--text-secondary)",
  display: "block", marginBottom: 5, fontWeight: 500,
};

// ─── Helpers ─────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LS}>{label}</label>
      {children}
      {error && <span style={{ fontSize: "0.6875rem", color: "var(--metric-value-red)", marginTop: 3, display: "block" }}>{error}</span>}
    </div>
  );
}

function SaveBtn({ saving, onClick, label = "Guardar" }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      style={{
        padding: ".55rem 1.25rem",
        background: saving ? "var(--accent-muted, #6B1A3F)" : "var(--accent, #8B2252)",
        border: "none", borderRadius: "var(--border-radius-sm)", color: "#fff",
        fontSize: "0.8125rem", fontWeight: 600,
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.7 : 1, transition: "opacity .15s",
      }}
    >
      {saving ? "Guardando..." : label}
    </button>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: "relative", width: 48, height: 26, borderRadius: "var(--border-radius-lg)",
        border: "none", background: on ? "var(--accent, #8B2252)" : "var(--border-default)",
        cursor: "pointer", transition: "background 0.2s", padding: 0, flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: on ? 25 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
      }} />
    </button>
  );
}

function SubSectionTitle({ title }: { title: string }) {
  return (
    <p style={{
      fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 12, marginTop: 0,
    }}>
      {title}
    </p>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Main ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const { uiTheme, setUiTheme, isDark, toggleDark, showDescriptions, setShowDescriptions, accentStyle, setAccentStyle, setPropertyAccent, fontScale, setFontScale } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);
  const logoGroupInputRef = useRef<HTMLInputElement>(null);

  const isSuperadmin = user?.role === "superadmin" || Boolean(user?.is_superadmin);
  const isTitular = user?.role === "titular" || user?.role === "group_admin";
  const isStrictTitular = user?.role === "titular" && Boolean(user?.company_id);
  const canFullAccess = isSuperadmin || isTitular;

  const [activeTab, setActiveTab] = useState<TabKey>("empresa");
  const [tabReady, setTabReady] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Tab: Empresa — Datos generales
  const [gName, setGName] = useState("");
  const [gShort, setGShort] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gAddress, setGAddress] = useState("");
  const [gInitials, setGInitials] = useState("");
  const [savingG, setSavingG] = useState(false);

  // ── Tab: Empresa — Datos fiscales
  const [fLegal, setFLegal] = useState("");
  const [fTaxId, setFTaxId] = useState("");
  const [fRegime, setFRegime] = useState("");
  const [fZip, setFZip] = useState("");
  const [savingF, setSavingF] = useState(false);

  // ── Tab: Empresa — Contactos
  const [cAdminEmail, setCAdminEmail] = useState("");
  const [cAdminPhone, setCAdminPhone] = useState("");
  const [cPurchEmail, setCPurchEmail] = useState("");
  const [cPurchPhone, setCPurchPhone] = useState("");
  const [savingC, setSavingC] = useState(false);

  // ── Tab: Empresa — Marca / Identidad
  const [mColor, setMColor] = useState("#8B2252");
  const [mLogoUrl, setMLogoUrl] = useState("");
  const [mLogoDarkUrl, setMLogoDarkUrl] = useState("");
  const [mLogoGroupUrl, setMLogoGroupUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoGroupFile, setLogoGroupFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoDarkPreview, setLogoDarkPreview] = useState("");
  const [logoGroupPreview, setLogoGroupPreview] = useState("");
  const [savingM, setSavingM] = useState(false);
  const [savingI, setSavingI] = useState(false);

  // ── Tab: Empresa — Grupo
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");
  const [savingGroup, setSavingGroup] = useState(false);

  // ── Tab: Usuarios
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invExpDays, setInvExpDays] = useState("7");
  const [sendingInv, setSendingInv] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [invLink, setInvLink] = useState("");

  // ── Tab: Mi cuenta
  const [acName, setAcName] = useState("");
  const [savingAc, setSavingAc] = useState(false);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // ── Tab: Mi cuenta — Pantalla de inicio
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);
  const [quickLinksLoaded, setQuickLinksLoaded] = useState(false);

  // ── Tab: Sistema — Configuración SAPROA
  const [sapConfigId, setSapConfigId] = useState<string | null>(null);
  const [sapPlatformName, setSapPlatformName] = useState("SAPROA");
  const [sapAccentColor, setSapAccentColor] = useState("#6366F1");
  const [sapAccentStyle, setSapAccentStyle] = useState<'solid' | 'metallic'>('solid');
  const [savingSap, setSavingSap] = useState(false);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: "", email: "", password: "", role: "administracion", company_id: "" },
  });

  // ─── Init tab from URL + role ────────────────────────────────────
  useEffect(() => {
    if (!user || tabReady) return;
    const valid: TabKey[] = ["empresa", "usuarios", "apariencia", "cuenta", "sistema"];
    const p = searchParams?.get("tab") as TabKey | null;
    let target: TabKey = canFullAccess ? "empresa" : "cuenta";
    if (p && valid.includes(p)) {
      if (!canFullAccess && !["apariencia", "cuenta"].includes(p)) {
        target = "cuenta";
      } else if (p === "sistema" && !isSuperadmin) {
        target = "apariencia";
      } else {
        target = p;
      }
    }
    setActiveTab(target);
    setTabReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── Load company data ───────────────────────────────────────────
  useEffect(() => {
    if (!user?.company_id) return;
    void loadCompany();
    void loadInvitations();
    if (isStrictTitular) createForm.setValue("company_id", user.company_id!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id]);

  // ─── Load account name ───────────────────────────────────────────
  useEffect(() => {
    if (user) setAcName(user.full_name ?? "");
  }, [user?.id, user?.full_name]);

  // ─── Load SAPROA config (superadmin only) ───────────────────────
  useEffect(() => {
    if (isSuperadmin) void loadSapConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  // ─── Load users on tab switch ────────────────────────────────────
  useEffect(() => {
    if (activeTab === "usuarios" && !usersLoaded) void loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Load quick links when "cuenta" tab is active ────────────────
  useEffect(() => {
    if (activeTab === "cuenta" && !quickLinksLoaded && user?.id) void loadQuickLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, quickLinksLoaded]);

  // ─── Data loaders ────────────────────────────────────────────────
  async function loadCompany() {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id,name,short_name,legal_name,email,phone,address,tax_id,regime,zip_code,brand_color,accent_style,logo_url,logo_dark_url,logo_group_url,initials,admin_contact_email,admin_contact_phone,purchases_contact_email,purchases_contact_phone,group_id,created_at")
      .eq("id", user!.company_id)
      .single();
    if (data) {
      setCompany(data);
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
      setMLogoGroupUrl(data.logo_group_url ?? "");
      setGroupId(data.group_id ?? null);
      if (data.group_id) {
        const { data: grp } = await supabase
          .from("company_groups")
          .select("name, short_name")
          .eq("id", data.group_id)
          .maybeSingle();
        setGroupName(grp?.short_name || grp?.name || "");
      }
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

  async function loadUsers() {
    setLoadingUsers(true);
    const usersQ = supabase
      .from("app_users")
      .select("id,full_name,email,role,is_superadmin,company_id,created_at")
      .order("created_at", { ascending: false });
    if (isStrictTitular) usersQ.eq("company_id", user!.company_id!);

    const companiesQ = isStrictTitular
      ? supabase.from("companies").select("id,name").eq("id", user!.company_id!)
      : supabase.from("companies").select("id,name").is("deleted_at", null).order("name");

    const [uRes, cRes] = await Promise.all([usersQ, companiesQ]);
    if (uRes.error) { toast.error("No se pudieron cargar los usuarios."); setLoadingUsers(false); return; }

    const cList = (cRes.data ?? []) as CompanyRow[];
    setCompanies(cList);
    const cMap = new Map(cList.map((c) => [c.id, c.name]));
    setUserRows((uRes.data ?? []).map((u: any) => ({ ...u, company_name: cMap.get(u.company_id) || "—" })));
    setUsersLoaded(true);
    setLoadingUsers(false);
  }

  // ─── SAPROA config ───────────────────────────────────────────────
  async function loadSapConfig() {
    const { data } = await supabase
      .from("saproa_config")
      .select("id, platform_name, accent_color, accent_style")
      .limit(1)
      .maybeSingle();
    if (!data) return;
    setSapConfigId(data.id ?? null);
    setSapPlatformName(data.platform_name ?? "SAPROA");
    setSapAccentColor(data.accent_color ?? "#6366F1");
    setSapAccentStyle(data.accent_style === 'metallic' ? 'metallic' : 'solid');
  }

  async function handleSaveSaproa() {
    setSavingSap(true);
    const payload = {
      platform_name: sapPlatformName.trim() || "SAPROA",
      accent_color: sapAccentColor,
      accent_style: sapAccentStyle,
    };
    if (sapConfigId) {
      await supabase.from("saproa_config").update(payload).eq("id", sapConfigId);
    } else {
      const { data } = await supabase.from("saproa_config").insert(payload).select("id").single();
      if (data) setSapConfigId(data.id);
    }
    setSavingSap(false);
    toast.success("Configuración de plataforma guardada");
  }

  // ─── Saves: Empresa ──────────────────────────────────────────────
  async function saveGeneral() {
    if (!company) return;
    setSavingG(true);
    const { error } = await supabase.from("companies").update({
      name: gName.trim(), short_name: gShort.trim() || null,
      phone: gPhone.trim() || null, email: gEmail.trim() || null,
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
      address: gAddress.trim() || null,
    }).eq("id", company.id);
    setSavingF(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Datos fiscales guardados");
  }

  async function saveContacto() {
    if (!company) return;
    setSavingC(true);
    const { error } = await supabase.from("companies").update({
      phone: gPhone.trim() || null,
      email: gEmail.trim() || null,
      admin_contact_email: cAdminEmail.trim() || null,
      admin_contact_phone: cAdminPhone.trim() || null,
      purchases_contact_email: cPurchEmail.trim() || null,
      purchases_contact_phone: cPurchPhone.trim() || null,
    }).eq("id", company.id);
    setSavingC(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Contactos guardados");
  }

  async function saveIdentidad() {
    if (!company) return;
    setSavingI(true);
    let logoUrl = mLogoUrl;
    let logoDarkUrl = mLogoDarkUrl;
    if (logoFile) logoUrl = await uploadLogo(logoFile, false);
    if (logoDarkFile) logoDarkUrl = await uploadLogo(logoDarkFile, true);
    const { error } = await supabase.from("companies").update({
      name: gName.trim(),
      short_name: gShort.trim() || null,
      initials: gInitials.trim().toUpperCase().slice(0, 4) || null,
      brand_color: mColor,
      logo_url: logoUrl || null,
      logo_dark_url: logoDarkUrl || null,
    }).eq("id", company.id);
    setSavingI(false);
    if (error) { toast.error("Error al guardar"); return; }
    setMLogoUrl(logoUrl); setMLogoDarkUrl(logoDarkUrl);
    setLogoFile(null); setLogoDarkFile(null);
    setLogoPreview(""); setLogoDarkPreview("");
    toast.success("Identidad visual guardada");
  }

  async function uploadLogoGroup(file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `groups/${company!.id}/logo_group.${ext}`;
    await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    const { data: pub } = supabase.storage.from("company-assets").getPublicUrl(path);
    return pub.publicUrl;
  }

  function handleLogoGroupInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoGroupPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setLogoGroupFile(file);
  }

  async function saveGroup() {
    if (!company) return;
    setSavingGroup(true);
    let logoGroupUrl = mLogoGroupUrl;
    if (logoGroupFile) logoGroupUrl = await uploadLogoGroup(logoGroupFile);
    const { error } = await supabase.from("companies").update({
      logo_group_url: logoGroupUrl || null,
    }).eq("id", company.id);
    setSavingGroup(false);
    if (error) { toast.error("Error al guardar"); return; }
    setMLogoGroupUrl(logoGroupUrl);
    setLogoGroupFile(null); setLogoGroupPreview("");
    toast.success("Logo de grupo guardado");
  }

  async function uploadLogo(file: File, dark: boolean): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `logos/${company!.id}/logo${dark ? "_dark" : ""}.${ext}`;
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
      brand_color: mColor, logo_url: logoUrl || null, logo_dark_url: logoDarkUrl || null,
    }).eq("id", company.id);
    setSavingM(false);
    if (error) { toast.error("Error al guardar"); return; }
    setMLogoUrl(logoUrl); setMLogoDarkUrl(logoDarkUrl);
    setLogoFile(null); setLogoDarkFile(null);
    setLogoPreview(""); setLogoDarkPreview("");
    toast.success("Marca guardada");
  }

  function handleLogoInput(e: React.ChangeEvent<HTMLInputElement>, dark: boolean) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      dark ? setLogoDarkPreview(ev.target?.result as string) : setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    dark ? setLogoDarkFile(file) : setLogoFile(file);
  }

  // ─── Actions: Usuarios ───────────────────────────────────────────
  async function changeRole(row: UserRow, newRole: UserRole) {
    if (newRole === row.role) return;
    setRoleUpdatingId(row.id);
    const { error } = await supabase.from("app_users")
      .update({ role: newRole, is_superadmin: newRole === "superadmin" })
      .eq("id", row.id);
    if (error) { toast.error("No se pudo actualizar el rol."); setRoleUpdatingId(null); return; }
    setUserRows((prev) => prev.map((r) => r.id === row.id ? { ...r, role: newRole, is_superadmin: newRole === "superadmin" } : r));
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}.`);
    setRoleUpdatingId(null);
  }

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
      token, email: invEmail.trim() || null,
      created_by: user.id, company_id: company.id, expires_at: expiresAt,
    }).select("id,token,email,expires_at,used_at,created_at").single();
    setSendingInv(false);
    if (error || !data) { toast.error("Error al crear invitación"); return; }
    setInvitations((prev) => [data, ...prev]);
    setInvLink(`${window.location.origin}/register?invite=${token}`);
    setInvEmail("");
    toast.success("Invitación creada");
  }

  async function revokeInvitation(id: string) {
    setRevokingId(id);
    const now = new Date().toISOString();
    await supabase.from("invitations").update({ used_at: now }).eq("id", id);
    setInvitations((prev) => prev.map((i) => i.id === id ? { ...i, used_at: now } : i));
    setRevokingId(null);
    toast.success("Invitación revocada");
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/register?invite=${token}`)
      .then(() => toast.success("Enlace copiado"));
  }

  const onCreateSubmit = createForm.handleSubmit(async (data) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { toast.error("Tu sesión expiró. Inicia de nuevo."); return; }
    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: data.full_name.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
          role: data.role,
          company_id: data.company_id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { toast.error(payload?.error || "No se pudo crear el usuario."); return; }
      toast.success("Usuario creado correctamente.");
      createForm.reset();
      setShowCreateUser(false);
      await loadUsers();
    } catch { toast.error("Error de red al crear el usuario."); }
  });

  // ─── Actions: Mi cuenta ──────────────────────────────────────────
  async function saveAccount() {
    if (!user) return;
    setSavingAc(true);
    const { error } = await supabase.from("app_users")
      .update({ full_name: acName.trim() })
      .eq("id", user.id);
    setSavingAc(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Información guardada");
  }

  async function changePassword() {
    if (!pwNew.trim()) { toast.error("Ingresa la nueva contraseña"); return; }
    if (pwNew.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    if (pwNew !== pwConfirm) { toast.error("Las contraseñas no coinciden"); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setSavingPw(false);
    if (error) { toast.error(error.message); return; }
    setPwNew(""); setPwConfirm("");
    toast.success("Contraseña actualizada");
  }

  async function loadQuickLinks() {
    if (!user?.id) return;
    const { data } = await supabase
      .from("user_preferences")
      .select("quick_links")
      .eq("user_id", user.id)
      .maybeSingle();
    const stored = data?.quick_links;
    setQuickLinks(
      stored && Array.isArray(stored) && (stored as unknown[]).length > 0
        ? (stored as QuickLink[])
        : getDefaultQuickLinks((user as { role?: string }).role ?? ""),
    );
    setQuickLinksLoaded(true);
  }

  async function saveQuickLinks() {
    if (!user?.id) return;
    setSavingLinks(true);
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, quick_links: quickLinks }, { onConflict: "user_id" });
    setSavingLinks(false);
    if (error) { toast.error("Error al guardar la pantalla de inicio"); return; }
    toast.success("Pantalla de inicio guardada");
  }

  function toggleQuickLink(mod: QuickLink) {
    setQuickLinks(prev => {
      const idx = prev.findIndex(l => l.path === mod.path);
      if (idx !== -1) return prev.filter(l => l.path !== mod.path);
      if (prev.length >= 7) return prev;
      return [...prev, mod];
    });
  }

  function moveQuickLink(from: number, to: number) {
    if (to < 0 || to >= quickLinks.length) return;
    setQuickLinks(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function updateQuickLinkCustomPath(path: string, customPath: string) {
    setQuickLinks(prev => prev.map(l =>
      l.path === path ? { ...l, customPath: customPath.trim() || undefined } : l
    ));
  }

  // ─── Tab navigation ──────────────────────────────────────────────
  function handleTabChange(key: string) {
    setActiveTab(key as TabKey);
    router.replace(`/settings?tab=${key}`, { scroll: false });
  }

  // ─── Pending dots ────────────────────────────────────────────────
  const pendingFiscal   = !fLegal.trim() || !fTaxId.trim();
  const pendingContacto = !cAdminEmail.trim() || !cPurchEmail.trim();
  const pendingMarca    = !mLogoUrl;
  const pendingEmpresa  = pendingFiscal || pendingContacto || pendingMarca;

  // ─── Tabs config ─────────────────────────────────────────────────
  const allTabs = [
    { key: "empresa",    label: "Empresa",    icon: <Building2 size={14} />, pendingDot: pendingEmpresa },
    { key: "usuarios",   label: "Usuarios",   icon: <Users size={14} /> },
    { key: "apariencia", label: "Apariencia", icon: <Monitor size={14} /> },
    { key: "cuenta",     label: "Mi cuenta",  icon: <User size={14} /> },
    ...(isSuperadmin ? [{ key: "sistema", label: "Sistema", icon: <Shield size={14} /> }] : []),
  ];
  const visibleTabs = canFullAccess ? allTabs : allTabs.filter(t => ["apariencia", "cuenta"].includes(t.key));

  // ─── Derived metrics ─────────────────────────────────────────────
  const totalUsers   = userRows.length;
  const totalAdmins  = userRows.filter((r) => ["superadmin", "administracion", "directivo", "compras", "mantenimiento"].includes(r.role)).length;
  const totalField   = userRows.filter((r) => r.role === "field").length;
  const totalTenants = userRows.filter((r) => r.role === "tenant").length;

  if (loading && canFullAccess && !tabReady) {
    return (
      <PageContainer>
        <div style={{ padding: "2rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>Cargando configuración...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Ajustes del sistema"
        subtitle={company?.short_name ?? company?.name ?? ""}
        titleIcon={<Settings2 size={20} />}
        actions={activeTab === "usuarios" ? (
          <UiButton icon={<UserPlus size={15} />} onClick={() => setShowCreateUser(true)}>
            Nuevo usuario
          </UiButton>
        ) : undefined}
      />

      <div style={{ marginBottom: "1.5rem" }}>
        <AppTabs items={visibleTabs} activeKey={activeTab} onChange={handleTabChange} />
      </div>

      <AppTabPanel activeKey={activeTab}>

        {/* ══ TAB: EMPRESA ══════════════════════════════════════════ */}
        {activeTab === "empresa" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── 1. Identidad visual ── */}
            <SectionCard title="Identidad visual" icon={<Palette size={18} />}>
              {pendingMarca && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "var(--border-radius-md)", background: "var(--accent-tint-soft)", border: "1px solid var(--accent-tint-medium)", marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>Sube el logo para completar la identidad de marca</span>
                </div>
              )}

              {/* Nombre y referencias */}
              <SubSectionTitle title="Nombre y referencias" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
                <Field label="Nombre de la empresa">
                  <input style={IS} value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Inmobiliaria XYZ S.A. de C.V." />
                </Field>
                <Field label="Nombre corto / pantalla">
                  <input style={IS} value={gShort} onChange={(e) => setGShort(e.target.value)} placeholder="XYZ" />
                </Field>
                <Field label="Iniciales (máx. 4)">
                  <input style={IS} value={gInitials} onChange={(e) => setGInitials(e.target.value.slice(0, 4).toUpperCase())} placeholder="XYZ" maxLength={4} />
                </Field>
              </div>

              {/* Logos */}
              <SubSectionTitle title="Logos" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
                {([
                  { label: "Logo principal", hint: "Sobre fondo claro", preview: logoPreview || mLogoUrl, dark: false, bg: "#ffffff", emptyColor: "#6b7280", ref: logoInputRef },
                  { label: "Logo modo oscuro", hint: "Sobre fondo oscuro", preview: logoDarkPreview || mLogoDarkUrl, dark: true, bg: "#111827", emptyColor: "#9ca3af", ref: logoDarkInputRef },
                ] as const).map(({ label, hint, preview, dark, bg, emptyColor, ref }) => (
                  <div key={String(dark)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{hint}</span>
                    </div>
                    <div style={{
                      position: "relative", background: bg,
                      borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border-default)",
                      minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", transition: "border-color 0.15s",
                    }}>
                      {preview ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt="" style={{ maxWidth: "80%", maxHeight: 100, objectFit: "contain", display: "block" }} />
                          <button
                            type="button"
                            onClick={() => {
                              if (dark) { setLogoDarkFile(null); setLogoDarkPreview(""); setMLogoDarkUrl(""); }
                              else      { setLogoFile(null); setLogoPreview(""); setMLogoUrl(""); }
                            }}
                            title="Quitar logo"
                            style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 }}
                          >
                            <X size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()}
                            title="Cambiar logo"
                            style={{ position: "absolute", bottom: 8, right: 8, display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: "var(--border-radius-sm)", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer" }}
                          >
                            <Upload size={11} /> Cambiar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "1.5rem", background: "transparent", border: "none", color: emptyColor, fontSize: "0.8125rem", cursor: "pointer", opacity: 0.7, transition: "opacity 0.15s" }}
                        >
                          <Upload size={20} />
                          <span>Subir logo</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={ref as React.RefObject<HTMLInputElement>}
                      type="file" accept="image/*"
                      onChange={(e) => handleLogoInput(e, dark)}
                      style={{ display: "none" }}
                    />
                  </div>
                ))}
              </div>

              {/* Color y estilo */}
              <SubSectionTitle title="Color y estilo de acento" />
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.75rem" }}>
                <div>
                  <label style={LS}>Color de marca</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <input type="color" value={mColor} onChange={(e) => setMColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", cursor: "pointer", padding: 0, background: "none", flexShrink: 0 }} />
                    <input style={{ ...IS, width: "auto", flex: 1, maxWidth: 140 }} value={mColor} onChange={(e) => setMColor(e.target.value)} maxLength={7} placeholder="#8B2252" />
                    <div style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", background: mColor, border: "1px solid var(--border-default)", flexShrink: 0 }} />
                  </div>
                </div>
                <div>
                  <label style={LS}>Estilo de acento</label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {(['solid', 'metallic'] as const).map((s) => {
                      const active = accentStyle === s;
                      const btnBg = s === 'metallic' ? generateMetallicGradient(mColor) : mColor;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void setAccentStyle(s)}
                          style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: "var(--border-radius-lg)", border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", textAlign: "left", flex: "1 1 140px", maxWidth: 200, outline: "none", transition: "border-color 0.15s" }}
                        >
                          <div style={{ height: 28, borderRadius: "var(--border-radius-sm)", background: btnBg }} />
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.8125rem", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text-primary)" }}>
                              {s === 'solid' ? 'Sólido' : 'Metálico'}
                            </span>
                            {active && <span style={{ fontSize: "0.6875rem", color: "var(--color-success)", fontWeight: 700 }}>✓ Activo</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 6, margin: "6px 0 0" }}>El estilo se guarda automáticamente al seleccionarlo.</p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveBtn saving={savingI} onClick={saveIdentidad} label="Guardar identidad" />
              </div>
            </SectionCard>

            {/* ── 2. Pertenencia a grupo (condicional) ── */}
            {groupId && (
              <SectionCard title="Pertenencia a grupo" icon={<Link2 size={18} />}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--group-accent, var(--accent))", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>
                    {groupName ? `Grupo: ${groupName}` : "Esta empresa pertenece a un grupo corporativo"}
                  </span>
                </div>

                <SubSectionTitle title="Logo del grupo (personalizado para esta empresa)" />
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
                  Reemplaza el logo del grupo en documentos como cotizaciones y órdenes de compra generados desde esta empresa.
                </p>

                <div style={{ maxWidth: 280 }}>
                  <div style={{
                    position: "relative", background: "var(--bg-page)",
                    borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border-default)",
                    minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {(logoGroupPreview || mLogoGroupUrl) ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoGroupPreview || mLogoGroupUrl} alt="" style={{ maxWidth: "80%", maxHeight: 100, objectFit: "contain", display: "block" }} />
                        <button
                          type="button"
                          onClick={() => { setLogoGroupFile(null); setLogoGroupPreview(""); setMLogoGroupUrl(""); }}
                          title="Quitar logo"
                          style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 }}
                        >
                          <X size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => logoGroupInputRef.current?.click()}
                          title="Cambiar logo"
                          style={{ position: "absolute", bottom: 8, right: 8, display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: "var(--border-radius-sm)", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          <Upload size={11} /> Cambiar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoGroupInputRef.current?.click()}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "1.5rem", background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "0.8125rem", cursor: "pointer", opacity: 0.7 }}
                      >
                        <Upload size={20} />
                        <span>Subir logo de grupo</span>
                      </button>
                    )}
                  </div>
                  <input ref={logoGroupInputRef} type="file" accept="image/*" onChange={handleLogoGroupInput} style={{ display: "none" }} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <SaveBtn saving={savingGroup} onClick={saveGroup} label="Guardar logo de grupo" />
                </div>
              </SectionCard>
            )}

            {/* ── 3. Datos fiscales ── */}
            <SectionCard title="Datos fiscales" icon={<FileText size={18} />}>
              {pendingFiscal && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "var(--border-radius-md)", background: "var(--accent-tint-soft)", border: "1px solid var(--accent-tint-medium)", marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>Razón social y RFC son obligatorios para facturación</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16.25rem, 1fr))", gap: "1.25rem" }}>
                <Field label="Razón social">
                  <input style={IS} value={fLegal} onChange={(e) => setFLegal(e.target.value)} placeholder="INMOBILIARIA XYZ S.A. DE C.V." />
                </Field>
                <Field label="RFC">
                  <input style={IS} value={fTaxId} onChange={(e) => setFTaxId(e.target.value.toUpperCase())} placeholder="XYZ010101ABC" maxLength={13} />
                </Field>
                <Field label="Régimen fiscal">
                  <input style={IS} value={fRegime} onChange={(e) => setFRegime(e.target.value)} placeholder="601 - General de Ley Personas Morales" />
                </Field>
                <Field label="Código postal">
                  <input style={IS} value={fZip} onChange={(e) => setFZip(e.target.value)} placeholder="06600" maxLength={5} />
                </Field>
                <Field label="Dirección fiscal">
                  <input style={IS} value={gAddress} onChange={(e) => setGAddress(e.target.value)} placeholder="Av. Reforma 123, Col. Juárez, CDMX" />
                </Field>
              </div>
              <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <SaveBtn saving={savingF} onClick={saveFiscal} />
              </div>
            </SectionCard>

            {/* ── 4. Contacto ── */}
            <SectionCard title="Contacto" icon={<Phone size={18} />}>
              <SubSectionTitle title="Contacto general" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16.25rem, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                <Field label="Teléfono">
                  <input style={IS} value={gPhone} onChange={(e) => setGPhone(e.target.value)} placeholder="+52 55 1234 5678" />
                </Field>
                <Field label="Email principal">
                  <input style={IS} type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="contacto@empresa.com" />
                </Field>
              </div>

              <SubSectionTitle title="Contactos por área" />
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 8px" }}>Administración</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16.25rem, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
                <Field label="Email">
                  <input style={IS} type="email" value={cAdminEmail} onChange={(e) => setCAdminEmail(e.target.value)} placeholder="admin@empresa.com" />
                </Field>
                <Field label="Teléfono">
                  <input style={IS} value={cAdminPhone} onChange={(e) => setCAdminPhone(e.target.value)} placeholder="+52 55 1234 5678" />
                </Field>
              </div>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 8px" }}>Compras</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16.25rem, 1fr))", gap: "1.25rem" }}>
                <Field label="Email">
                  <input style={IS} type="email" value={cPurchEmail} onChange={(e) => setCPurchEmail(e.target.value)} placeholder="compras@empresa.com" />
                </Field>
                <Field label="Teléfono">
                  <input style={IS} value={cPurchPhone} onChange={(e) => setCPurchPhone(e.target.value)} placeholder="+52 55 9876 5432" />
                </Field>
              </div>
              <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <SaveBtn saving={savingC} onClick={saveContacto} />
              </div>
            </SectionCard>

          </div>
        )}

        {/* ══ TAB: USUARIOS ═════════════════════════════════════════ */}
        {activeTab === "usuarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Métricas */}
            <AppGrid minWidth={200}>
              <MetricCard label="Total" value={String(totalUsers)} helper="Todos los activos"
                icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-blue)", display: "grid", placeItems: "center" }}><Users size={18} color="var(--metric-value-blue)" /></div>}
              />
              <MetricCard label="Admins" value={String(totalAdmins)} helper="Roles administrativos"
                icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-purple)", display: "grid", placeItems: "center" }}><Shield size={18} color="#7C3AED" /></div>}
              />
              <MetricCard label="Campo" value={String(totalField)} helper="Equipo operativo"
                icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-green)", display: "grid", placeItems: "center" }}><Building2 size={18} color="var(--metric-value-green)" /></div>}
              />
              <MetricCard label="Inquilinos" value={String(totalTenants)} helper="Portal activo"
                icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-amber)", display: "grid", placeItems: "center" }}><Users size={18} color="var(--metric-value-amber)" /></div>}
              />
            </AppGrid>

            {/* Lista de usuarios */}
            <SectionCard title="Usuarios de la empresa" icon={<Users size={18} />}>
              {loadingUsers ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", padding: "20px 0" }}>Cargando usuarios...</div>
              ) : (
                <div className="mod-table-wrap">
                  <AppTable<UserRow>
                    minWidth={860}
                    rows={userRows}
                    emptyState="No hay usuarios activos."
                    columns={[
                      {
                        key: "name", header: "Nombre",
                        render: (row) => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.full_name || "—"}</span>,
                      },
                      {
                        key: "email", header: "Email",
                        render: (row) => <span style={{ fontSize: "0.8125rem" }}>{row.email}</span>,
                      },
                      ...(!isStrictTitular ? [{
                        key: "company", header: "Empresa",
                        render: (row: UserRow) => <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{row.company_name}</span>,
                      }] : []),
                      {
                        key: "role", header: "Rol",
                        render: (row) => {
                          const s = ROLE_STYLE[row.role];
                          return <AppBadge backgroundColor={s.bg} textColor={s.fg}>{ROLE_LABEL[row.role]}</AppBadge>;
                        },
                      },
                      {
                        key: "actions", header: "Acciones",
                        render: (row) => (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <AppSelect
                              value={row.role}
                              disabled={roleUpdatingId === row.id || row.id === user!.id}
                              onChange={(e) => void changeRole(row, e.target.value as UserRole)}
                              style={{ padding: "6px 8px", fontSize: "0.75rem", minWidth: 140 }}
                            >
                              {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                              {row.role === "tenant" && <option value="tenant">Inquilino</option>}
                            </AppSelect>
                            <button
                              type="button"
                              onClick={() => toast("Función no disponible aún")}
                              disabled={row.id === user!.id}
                              title={row.id === user!.id ? "No puedes desactivarte" : "Desactivar usuario"}
                              style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", padding: "6px 8px", cursor: row.id === user!.id ? "not-allowed" : "pointer", color: row.id === user!.id ? "var(--text-muted)" : "var(--metric-value-red)", display: "inline-flex", alignItems: "center" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
            </SectionCard>

            {/* Invitaciones */}
            <SectionCard title="Invitaciones">
              <SubSectionTitle title="Nueva invitación" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end", marginBottom: 12 }}>
                <Field label="Email del invitado (opcional)">
                  <input style={IS} type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="nuevo@empresa.com" />
                </Field>
                <Field label="Vigencia (días)">
                  <input style={{ ...IS, width: 80 }} type="number" min={1} max={90} value={invExpDays} onChange={(e) => setInvExpDays(e.target.value)} />
                </Field>
              </div>
              <button
                type="button"
                onClick={createInvitation}
                disabled={sendingInv}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: ".6rem 1.1rem", background: "var(--accent, #8B2252)", border: "none", borderRadius: "var(--border-radius-md)", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: sendingInv ? "not-allowed" : "pointer", opacity: sendingInv ? 0.7 : 1 }}
              >
                <Send size={14} /> {sendingInv ? "Generando..." : "Generar invitación"}
              </button>
              {invLink && (
                <div style={{ marginTop: 12, background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", flex: 1, wordBreak: "break-all" }}>{invLink}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(invLink).then(() => toast.success("Copiado"))}
                    style={{ padding: ".4rem .8rem", background: "var(--accent-muted, var(--accent-tint-soft))", border: "1px solid var(--accent, #8B2252)", borderRadius: "var(--border-radius-sm)", color: "var(--accent, #8B2252)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Copiar enlace
                  </button>
                  <button type="button" onClick={() => setInvLink("")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <SubSectionTitle title="Invitaciones enviadas" />
                {invitations.length === 0 ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>No hay invitaciones.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {invitations.map((inv) => {
                      const expired = new Date(inv.expires_at) < new Date();
                      const used    = Boolean(inv.used_at);
                      const active  = !used && !expired;
                      return (
                        <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.75rem 1rem", background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                              {inv.email ?? <span style={{ color: "var(--text-secondary)" }}>Sin email</span>}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                              Vence: {formatDate(inv.expires_at)} · Creada: {formatDate(inv.created_at)}
                            </div>
                          </div>
                          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, background: active ? "rgba(29,158,117,.15)" : "rgba(0,0,0,.1)", color: active ? "#1D9E75" : used ? "#888" : "var(--metric-value-red)" }}>
                            {active ? "Activa" : used ? "Usada" : "Expirada"}
                          </span>
                          {active && (
                            <>
                              <button type="button" onClick={() => copyLink(inv.token)} style={{ padding: ".35rem .75rem", background: "none", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-sm)", color: "var(--text-secondary)", fontSize: "0.75rem", cursor: "pointer" }}>
                                Copiar
                              </button>
                              <button type="button" onClick={() => revokeInvitation(inv.id)} disabled={revokingId === inv.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: ".35rem .75rem", background: "rgba(226,75,74,.1)", border: "1px solid rgba(226,75,74,.3)", borderRadius: "var(--border-radius-sm)", color: "var(--metric-value-red)", fontSize: "0.75rem", cursor: "pointer" }}>
                                <Trash2 size={12} /> Revocar
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ══ TAB: APARIENCIA ═══════════════════════════════════════ */}
        {activeTab === "apariencia" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <SectionCard title="Tema de interfaz" subtitle="El cambio se aplica de inmediato." icon={<Monitor size={18} />}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {([
                  { key: "super_soft", label: "Super Soft", previewR: 28, btnR: 14, desc: "Bordes muy redondeados, look moderno y suave" },
                  { key: "clasico",    label: "Clásico",    previewR: 8,  btnR: 6,  desc: "Bordes estándar, limpio y profesional" },
                  { key: "rigido",     label: "Rígido",     previewR: 0,  btnR: 0,  desc: "Bordes rectos, estilo corporativo" },
                ] as const).map(({ key, label, previewR, btnR, desc }) => {
                  const active = uiTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUiTheme(key)}
                      style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: "var(--border-radius-lg)", border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", textAlign: "left", flex: "1 1 200px", maxWidth: 280, transition: "border-color 0.15s", outline: "none" }}
                    >
                      <div style={{ background: "var(--bg-page)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ background: "var(--bg-card)", borderRadius: previewR, padding: "10px 14px", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: previewR, background: "var(--accent)", flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 7, borderRadius: 4, background: "var(--border-default)", marginBottom: 4 }} />
                            <div style={{ height: 5, borderRadius: 4, background: "var(--border-subtle)", width: "55%" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <div style={{ flex: 1, height: 26, borderRadius: btnR, background: "var(--accent)", opacity: 0.85 }} />
                          <div style={{ flex: 1, height: 26, borderRadius: btnR, background: "var(--border-default)" }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{label}</span>
                          {active && <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-soft)", borderRadius: "var(--border-radius-xl)", padding: "1px 7px" }}>Activo</span>}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Estilo del color de acento" subtitle="Afecta botones primarios y elementos de marca. Se aplica de inmediato.">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {([
                  {
                    key: "solid" as const,
                    label: "Sólido",
                    desc: "Color uniforme y limpio",
                    bg: "var(--accent)",
                  },
                  {
                    key: "metallic" as const,
                    label: "Metálico",
                    desc: "Efecto brillante estilo premium",
                    bg: "var(--accent-gradient)",
                  },
                ]).map(({ key, label, desc, bg }) => {
                  const active = accentStyle === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void setAccentStyle(key)}
                      style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: "var(--border-radius-lg)", border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", textAlign: "left", flex: "1 1 160px", maxWidth: 240, transition: "border-color 0.15s", outline: "none" }}
                    >
                      <div style={{ background: "var(--bg-page)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <div style={{ flex: 2, height: 30, borderRadius: "var(--border-radius-sm)", background: bg }} />
                          <div style={{ flex: 1, height: 30, borderRadius: "var(--border-radius-sm)", background: "var(--border-default)" }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{label}</span>
                          {active && <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-soft)", borderRadius: "var(--border-radius-xl)", padding: "1px 7px" }}>Activo</span>}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Tamaño de texto" subtitle="Ajusta el tamaño base de toda la interfaz. Se aplica de inmediato.">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {([
                  { scale: 0.80, abbr: "S",  label: "Pequeño"      },
                  { scale: 1,    abbr: "M",  label: "Normal"       },
                  { scale: 1.20, abbr: "L",  label: "Grande"       },
                  { scale: 1.40, abbr: "XL", label: "Extra grande" },
                ] as { scale: number; abbr: string; label: string }[]).map(({ scale, abbr, label }) => {
                  const active = fontScale === scale;
                  return (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setFontScale(scale)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                        padding: "16px 20px",
                        borderRadius: "var(--border-radius-lg)",
                        border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                        background: "var(--bg-card)", cursor: "pointer",
                        flex: "1 1 100px", maxWidth: 160, outline: "none",
                        transition: "border-color 0.15s",
                      }}
                    >
                      <span style={{ fontSize: scale * 22, fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)", lineHeight: 1 }}>
                        Aa
                      </span>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, justifyContent: "center" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{abbr}</span>
                          {active && <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-soft)", borderRadius: "var(--border-radius-xl)", padding: "1px 6px" }}>Activo</span>}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>{label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Modo" subtitle="El cambio se aplica de inmediato.">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {([
                  {
                    key: "light" as const,
                    label: "Modo claro",
                    desc: "Fondo blanco, ideal para espacios iluminados",
                    active: !isDark,
                    bgPage: "#f1f5f9",
                    bgCard: "#ffffff",
                    textBar: "#334155",
                    subtextBar: "#cbd5e1",
                    border: "#e2e8f0",
                  },
                  {
                    key: "dark" as const,
                    label: "Modo oscuro",
                    desc: "Fondo oscuro, cómodo con poca luz",
                    active: isDark,
                    bgPage: "#0f1623",
                    bgCard: "#1e2a3a",
                    textBar: "#e2e8f0",
                    subtextBar: "#334155",
                    border: "rgba(255,255,255,0.10)",
                  },
                ] as const).map(({ key, label, desc, active, bgPage, bgCard, textBar, subtextBar, border }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { if ((key === "dark") !== isDark) toggleDark(); }}
                    style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: "var(--border-radius-lg)", border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", textAlign: "left", flex: "1 1 200px", maxWidth: 280, transition: "border-color 0.15s", outline: "none" }}
                  >
                    {/* Preview */}
                    <div style={{ background: bgPage, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ background: bgCard, borderRadius: 8, padding: "10px 14px", border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "var(--border-radius-md)", background: "var(--accent)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 7, borderRadius: 4, background: textBar, opacity: 0.35, marginBottom: 4 }} />
                          <div style={{ height: 5, borderRadius: 4, background: subtextBar, opacity: 0.5, width: "55%" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ flex: 1, height: 26, borderRadius: 6, background: "var(--accent)", opacity: 0.85 }} />
                        <div style={{ flex: 1, height: 26, borderRadius: 6, background: border }} />
                      </div>
                    </div>
                    {/* Label */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{label}</span>
                        {active && <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-soft)", borderRadius: "var(--border-radius-xl)", padding: "1px 7px" }}>Activo</span>}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ══ TAB: MI CUENTA ════════════════════════════════════════ */}
        {activeTab === "cuenta" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <SectionCard title="Información personal" icon={<User size={18} />}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16.25rem, 1fr))", gap: "1.25rem" }}>
                <Field label="Nombre completo">
                  <input style={IS} value={acName} onChange={(e) => setAcName(e.target.value)} placeholder="Tu nombre" />
                </Field>
                <Field label="Email">
                  <input style={{ ...IS, opacity: 0.6, cursor: "not-allowed" }} value={user?.email ?? ""} readOnly />
                </Field>
              </div>
              <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <SaveBtn saving={savingAc} onClick={saveAccount} />
              </div>
            </SectionCard>

            <SectionCard title="Seguridad" icon={<Lock size={18} />}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 420 }}>
                <Field label="Nueva contraseña">
                  <input style={IS} type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                </Field>
                <Field label="Confirmar nueva contraseña">
                  <input style={IS} type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" />
                </Field>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <SaveBtn saving={savingPw} onClick={changePassword} label="Cambiar contraseña" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Preferencias">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Mostrar descripciones</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Subtítulos descriptivos en la barra lateral y encabezados</div>
                </div>
                <Toggle
                  on={showDescriptions}
                  onToggle={() => {
                    const next = !showDescriptions;
                    setShowDescriptions(next);
                    if (user?.id) {
                      void supabase.from("user_preferences")
                        .upsert({ user_id: user.id, show_descriptions: next }, { onConflict: "user_id" });
                    }
                  }}
                />
              </div>
            </SectionCard>

            <SectionCard title="Pantalla de inicio" icon={<Home size={18} />}>
              <p style={{ margin: "0 0 16px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Los primeros 4 accesos aparecen arriba y los siguientes 3 abajo. Máximo 7.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {getAllowedModules(user?.role ?? "").map(mod => {
                  const selIdx = quickLinks.findIndex(l => l.path === mod.path);
                  const isSelected = selIdx !== -1;
                  const atMax = quickLinks.length >= 7 && !isSelected;
                  const Icon = ICON_MAP[mod.icon];
                  const selectedLink = isSelected ? quickLinks[selIdx] : null;
                  return (
                    <div
                      key={mod.path}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "9px 12px",
                        borderRadius: "var(--border-radius-md)",
                        background: isSelected ? "var(--bg-subtle)" : "transparent",
                        border: isSelected ? "1px solid var(--border-default)" : "1px solid transparent",
                        opacity: atMax ? 0.45 : 1,
                        gap: isSelected ? 6 : 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {Icon && (
                          <span style={{ color: "var(--text-secondary)", display: "flex", flexShrink: 0 }}>
                            <Icon size={15} />
                          </span>
                        )}
                        <span style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
                          {mod.label}
                        </span>
                        {isSelected && (
                          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", minWidth: 20, textAlign: "center" }}>
                            {selIdx + 1}
                          </span>
                        )}
                        {isSelected && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <button
                              type="button"
                              disabled={selIdx === 0}
                              onClick={() => moveQuickLink(selIdx, selIdx - 1)}
                              style={{
                                background: "none", border: "none", padding: "1px 3px", cursor: selIdx === 0 ? "not-allowed" : "pointer",
                                color: selIdx === 0 ? "var(--text-muted)" : "var(--text-secondary)", display: "flex",
                              }}
                              title="Subir"
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={selIdx === quickLinks.length - 1}
                              onClick={() => moveQuickLink(selIdx, selIdx + 1)}
                              style={{
                                background: "none", border: "none", padding: "1px 3px",
                                cursor: selIdx === quickLinks.length - 1 ? "not-allowed" : "pointer",
                                color: selIdx === quickLinks.length - 1 ? "var(--text-muted)" : "var(--text-secondary)", display: "flex",
                              }}
                              title="Bajar"
                            >
                              <ChevronDown size={13} />
                            </button>
                          </div>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={atMax}
                          onChange={() => toggleQuickLink(mod)}
                          style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: atMax ? "not-allowed" : "pointer", flexShrink: 0 }}
                        />
                      </div>
                      {isSelected && (
                        <input
                          type="text"
                          placeholder={`URL personalizada (opcional, default: ${mod.path})`}
                          value={selectedLink?.customPath ?? ""}
                          onChange={e => updateQuickLinkCustomPath(mod.path, e.target.value)}
                          style={{
                            fontSize: "0.6875rem", padding: "4px 8px",
                            border: "1px solid var(--border-default)",
                            borderRadius: "var(--border-radius-sm)",
                            background: "var(--bg-input)",
                            color: "var(--text-secondary)",
                            outline: "none", width: "100%", boxSizing: "border-box",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <SaveBtn saving={savingLinks} onClick={saveQuickLinks} label="Guardar pantalla de inicio" />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ══ TAB: SISTEMA (superadmin) ═════════════════════════════ */}
        {activeTab === "sistema" && isSuperadmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Configuración de plataforma SAPROA */}
            <SectionCard title="Configuración de la plataforma SAPROA" icon={<Settings2 size={18} />}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <Field label="Nombre de la plataforma">
                  <input
                    style={IS}
                    value={sapPlatformName}
                    onChange={(e) => setSapPlatformName(e.target.value)}
                    placeholder="SAPROA"
                  />
                </Field>

                <div>
                  <label style={LS}>Color de acento</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="color"
                      value={sapAccentColor}
                      onChange={(e) => { setSapAccentColor(e.target.value); setPropertyAccent(e.target.value); }}
                      style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", cursor: "pointer", padding: 0, background: "none" }}
                    />
                    <input
                      style={{ ...IS, width: "auto", flex: 1, maxWidth: 160 }}
                      value={sapAccentColor}
                      onChange={(e) => {
                        setSapAccentColor(e.target.value);
                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setPropertyAccent(e.target.value);
                      }}
                      maxLength={7}
                      placeholder="#6366F1"
                    />
                    <div style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", background: sapAccentColor, border: "1px solid var(--border-default)" }} />
                  </div>
                </div>

                <div>
                  <label style={LS}>Estilo de acento</label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {(['solid', 'metallic'] as const).map((style) => {
                      const active = sapAccentStyle === style;
                      const bg = style === 'metallic' ? generateMetallicGradient(sapAccentColor) : sapAccentColor;
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setSapAccentStyle(style)}
                          style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: "var(--border-radius-lg)", border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", textAlign: "left", flex: "1 1 140px", maxWidth: 200, outline: "none" }}
                        >
                          <div style={{ height: 28, borderRadius: "var(--border-radius-sm)", background: bg }} />
                          <span style={{ fontSize: "0.8125rem", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text-primary)" }}>
                            {style === 'solid' ? 'Sólido' : 'Metálico'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <SaveBtn saving={savingSap} onClick={handleSaveSaproa} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Plan actual" icon={<CreditCard size={18} />}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ padding: "4px 14px", borderRadius: 999, background: "var(--accent-tint-soft)", color: "var(--accent, #8B2252)", fontSize: "0.8125rem", fontWeight: 700, border: "1px solid var(--accent-tint-medium)" }}>
                  Plan Básico
                </span>
                <span style={{ fontSize: "0.8125rem", color: "#1D9E75", fontWeight: 600 }}>● Activo</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))", gap: 12 }}>
                {[
                  { label: "Propiedades", value: "Ilimitadas" },
                  { label: "Usuarios",    value: "Ilimitados" },
                  { label: "Unidades",    value: "Ilimitadas" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: "14px 16px", borderRadius: "var(--border-radius-md)", background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Información técnica" icon={<Info size={18} />}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "ID de empresa",      value: company?.id ?? "—" },
                  { label: "Versión de la app",   value: "1.0.0" },
                  { label: "Fecha de creación",   value: company?.created_at ? formatDate(company.created_at) : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", minWidth: 160, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Zona de peligro" style={{ border: "1.5px solid rgba(226,75,74,.4)", background: "rgba(226,75,74,.02)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: "rgba(226,75,74,.07)", border: "1px solid rgba(226,75,74,.18)", marginBottom: 18 }}>
                <AlertTriangle size={16} color="var(--metric-value-red)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.55 }}>
                  Las acciones en esta sección pueden tener consecuencias irreversibles. Procede con precaución.
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast("Función de exportación próximamente disponible")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: ".6rem 1.2rem", background: "transparent", border: "1.5px solid var(--metric-value-red)", borderRadius: "var(--border-radius-md)", color: "var(--metric-value-red)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}
              >
                <Download size={15} /> Exportar todos los datos
              </button>
            </SectionCard>
          </div>
        )}

      </AppTabPanel>

      {/* ── Modal: Nuevo usuario ─────────────────────────────────── */}
      <Modal
        open={showCreateUser}
        title="Nuevo usuario"
        subtitle="Se creará la cuenta en auth y su perfil en app_users."
        onClose={() => { if (!createForm.formState.isSubmitting) setShowCreateUser(false); }}
        maxWidth="520px"
      >
        <form onSubmit={onCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nombre completo" error={createForm.formState.errors.full_name?.message}>
            <input {...createForm.register("full_name")} placeholder="Juan Pérez" style={IS} />
          </Field>
          <Field label="Email" error={createForm.formState.errors.email?.message}>
            <input {...createForm.register("email")} type="email" placeholder="juan@empresa.com" style={IS} />
          </Field>
          <Field label="Contraseña temporal" error={createForm.formState.errors.password?.message}>
            <input {...createForm.register("password")} type="text" placeholder="Mínimo 8 caracteres" style={IS} autoComplete="new-password" />
          </Field>
          <Field label="Rol" error={createForm.formState.errors.role?.message}>
            <AppSelect {...createForm.register("role")}>
              {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </AppSelect>
          </Field>
          {!isStrictTitular && (
            <Field label="Empresa" error={createForm.formState.errors.company_id?.message}>
              <AppSelect {...createForm.register("company_id")}>
                <option value="">Selecciona una empresa</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </AppSelect>
            </Field>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <UiButton
              variant="secondary"
              onClick={() => { if (!createForm.formState.isSubmitting) { createForm.reset(); setShowCreateUser(false); } }}
            >
              Cancelar
            </UiButton>
            <UiButton type="submit" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? "Creando..." : "Crear usuario"}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
