"use client";

/*
  ThemeContext — contexto global de branding, modo claro/oscuro y preferencias UI.

  Responsabilidades:
  1. Lee brand_color, logo_url, logo_dark_url, short_name de la tabla companies.
  2. Aplica brand_color como variable CSS --accent en :root.
  3. Aplica la clase .dark en <html> para activar los CSS vars del modo.
  4. Detecta preferencia de sistema (prefers-color-scheme) en el primer render.
  5. Permite toggle manual que se guarda en localStorage ("prop-theme").
  6. Expone showDescriptions para controlar visibilidad de subtítulos en la UI.
*/

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { generateMetallicGradient } from "@/lib/color-utils";

/* ─── Tipos ───────────────────────────────────────────────────────── */

type ThemeContextType = {
  accentColor: string;
  groupColor: string;
  accentStyle: 'solid' | 'metallic';
  setAccentStyle: (style: 'solid' | 'metallic') => Promise<void>;
  setPropertyAccent: (color: string) => void;
  resetPropertyAccent: () => void;
  platformName: string;
  logoUrl: string | null;
  logoPrintUrl: string | null;
  logoDarkUrl: string | null;
  logoGroupUrl: string | null;
  shortName: string;
  /* Datos fiscales/contacto de la empresa */
  legalName: string;
  companyAddress: string;
  companyTaxId: string;
  companyPhone: string;
  companyEmail: string;
  companyZipCode: string;
  purchasesContactPhone: string;
  purchasesContactEmail: string;
  adminContactPhone: string;
  adminContactEmail: string;
  isDark: boolean;
  toggleDark: () => void;
  showDescriptions: boolean;
  setShowDescriptions: (v: boolean) => void;
  uiTheme: 'clasico' | 'super_soft' | 'rigido';
  setUiTheme: (theme: 'clasico' | 'super_soft' | 'rigido') => void;
};

/* ─── Valor por defecto (antes de cargar empresa) ────────────────── */

const DEFAULT_ACCENT = "#8B2252";

const ThemeContext = createContext<ThemeContextType>({
  accentColor: DEFAULT_ACCENT,
  groupColor: DEFAULT_ACCENT,
  accentStyle: 'solid',
  setAccentStyle: async () => {},
  setPropertyAccent: () => {},
  resetPropertyAccent: () => {},
  platformName: "SAPROA",
  logoUrl: null,
  logoPrintUrl: null,
  logoDarkUrl: null,
  logoGroupUrl: null,
  shortName: "PropAdmin",
  legalName: "",
  companyAddress: "",
  companyTaxId: "",
  companyPhone: "",
  companyEmail: "",
  companyZipCode: "",
  purchasesContactPhone: "",
  purchasesContactEmail: "",
  adminContactPhone: "",
  adminContactEmail: "",
  isDark: false,
  toggleDark: () => {},
  showDescriptions: true,
  setShowDescriptions: () => {},
  uiTheme: 'clasico' as const,
  setUiTheme: () => {},
});

/* ─── Genera iniciales del short_name para el logo de fallback ───── */

export function initials(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/* ─── Provider ────────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();

  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [groupColor, setGroupColor] = useState(DEFAULT_ACCENT);
  const [accentStyle, setAccentStyleState] = useState<'solid' | 'metallic'>('solid');
  const [platformName, setPlatformName] = useState("SAPROA");
  const companyBaseColorRef = useRef(DEFAULT_ACCENT);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPrintUrl, setLogoPrintUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const [logoGroupUrl, setLogoGroupUrl] = useState<string | null>(null);
  const [shortName, setShortName] = useState("PropAdmin");
  const [legalName, setLegalName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyTaxId, setCompanyTaxId]     = useState("");
  const [companyPhone, setCompanyPhone]     = useState("");
  const [companyEmail, setCompanyEmail]     = useState("");
  const [companyZipCode, setCompanyZipCode] = useState("");
  const [purchasesContactPhone, setPurchasesContactPhone] = useState("");
  const [purchasesContactEmail, setPurchasesContactEmail] = useState("");
  const [adminContactPhone, setAdminContactPhone] = useState("");
  const [adminContactEmail, setAdminContactEmail] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [uiTheme, setUiThemeState] = useState<'clasico' | 'super_soft' | 'rigido'>('clasico');

  /* ── Leer preferencia de modo guardada o del sistema (solo en cliente) ── */
  useEffect(() => {
    const stored = localStorage.getItem("prop-theme");
    if (stored === "dark" || stored === "light") {
      setIsDark(stored === "dark");
    } else {
      /* Sin preferencia guardada → usar preferencia del sistema operativo */
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
    }
  }, []);

  /* ── Aplicar clase .dark en <html> cuando cambie isDark ────────── */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  /* ── Aplicar --accent + --accent-gradient en :root cuando cambie accentColor ── */
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor);
    document.documentElement.style.setProperty("--accent-gradient", generateMetallicGradient(accentColor));
  }, [accentColor]);

  /* ── Aplicar --btn-primary-bg según accentStyle ─────────────────── */
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--btn-primary-bg",
      accentStyle === 'metallic' ? "var(--accent-gradient)" : "var(--accent)",
    );
  }, [accentStyle]);

  /* ── Aplicar data-theme desde localStorage inmediatamente (antes de Supabase) ── */
  useEffect(() => {
    const saved = localStorage.getItem("ui_theme");
    const theme = (saved === "super_soft" || saved === "clasico" || saved === "rigido") ? saved : "clasico";
    document.documentElement.setAttribute("data-theme", theme);
    setUiThemeState(theme);
  }, []);

  /* ── Aplicar data-theme en <html> cuando cambie uiTheme ────────── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", uiTheme);
  }, [uiTheme]);

  /* ── Cargar branding + preferencias de usuario cuando esté listo ── */
  useEffect(() => {
    if (user?.company_id) {
      const isSA = Boolean(user.is_superadmin) || user.role === 'superadmin';
      const isGA = (user.role as string) === 'group_admin';
      void loadCompanyBranding(user.company_id, isSA, isGA);
    } else if (user?.is_superadmin) {
      /* Superadmin con company_id = null: cargar config de plataforma directo */
      void loadSaproaConfig();
    }
    if (user?.id) {
      void loadUserPreferences(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id, user?.id, user?.is_superadmin, user?.role]);

  async function loadSaproaConfig() {
    const { data } = await supabase
      .from("saproa_config")
      .select("id, platform_name, accent_color, accent_style, logo_url, logo_dark_url")
      .limit(1)
      .maybeSingle();

    if (!data) return;

    const color = data.accent_color || DEFAULT_ACCENT;
    setAccentColor(color);
    setGroupColor(color);
    companyBaseColorRef.current = color;
    document.documentElement.style.setProperty("--color-primary", color);
    setAccentStyleState(data.accent_style === 'metallic' ? 'metallic' : 'solid');
    if (data.platform_name) setPlatformName(data.platform_name);
    setLogoUrl(data.logo_url ?? null);
    setLogoDarkUrl(data.logo_dark_url ?? null);
  }

  async function loadCompanyBranding(companyId: string, isSuperAdmin: boolean, isGroupAdmin: boolean) {
    const { data } = await supabase
      .from("companies")
      .select("brand_color, logo_url, logo_print_url, logo_dark_url, logo_group_url, short_name, legal_name, address, phone, email, tax_id, zip_code, regime, purchases_contact_phone, purchases_contact_email, admin_contact_phone, admin_contact_email, group_id, accent_style")
      .eq("id", companyId)
      .maybeSingle();

    if (!data) return;

    /* Logos, nombre y datos de contacto siempre desde companies */
    setLogoUrl(data.logo_url ?? null);
    setLogoPrintUrl(data.logo_print_url ?? null);
    setLogoDarkUrl(data.logo_dark_url ?? null);
    setLogoGroupUrl(data.logo_group_url ?? null);
    if (data.short_name) setShortName(data.short_name);
    setLegalName(data.legal_name      || "");
    setCompanyAddress(data.address    || "");
    setCompanyTaxId(data.tax_id       || "");
    setCompanyPhone(data.phone        || "");
    setCompanyEmail(data.email        || "");
    setCompanyZipCode(data.zip_code   || "");
    setPurchasesContactPhone(data.purchases_contact_phone || "");
    setPurchasesContactEmail(data.purchases_contact_email || "");
    setAdminContactPhone(data.admin_contact_phone || "");
    setAdminContactEmail(data.admin_contact_email || "");

    if (isSuperAdmin) {
      /* Superadmin: colores vienen de saproa_config, no de companies */
      await loadSaproaConfig();
      return;
    }

    /* Estilo de acento desde companies (roles no-superadmin) */
    setAccentStyleState(data.accent_style === 'metallic' ? 'metallic' : 'solid');

    const companyColor = data.brand_color || DEFAULT_ACCENT;

    /* Cargar color del grupo corporativo */
    let baseAccent = companyColor;
    if (data.group_id) {
      const { data: groupData } = await supabase
        .from("company_groups")
        .select("brand_color")
        .eq("id", data.group_id)
        .maybeSingle();
      const gc = groupData?.brand_color || companyColor;
      setGroupColor(gc);
      document.documentElement.style.setProperty("--group-accent", gc);
      /* Solo group_admin ve el color del grupo como acento base */
      if (isGroupAdmin) baseAccent = gc;
    } else {
      setGroupColor(companyColor);
      document.documentElement.style.setProperty("--group-accent", companyColor);
    }

    setAccentColor(baseAccent);
    companyBaseColorRef.current = baseAccent;
  }

  async function loadUserPreferences(userId: string) {
    const { data } = await supabase
      .from("user_preferences")
      .select("dark_mode, show_descriptions, ui_theme")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return; // tabla no existe o no hay registro — usar defaults

    if (typeof data.show_descriptions === "boolean") {
      setShowDescriptions(data.show_descriptions);
    }
    const VALID_THEMES = ["clasico", "super_soft", "rigido"] as const;
    type ValidTheme = typeof VALID_THEMES[number];
    const dbTheme = VALID_THEMES.includes(data.ui_theme as ValidTheme) ? data.ui_theme as ValidTheme : null;
    const localRaw = localStorage.getItem("ui_theme");
    const localTheme = VALID_THEMES.includes(localRaw as ValidTheme) ? localRaw as ValidTheme : null;
    if (localTheme) {
      setUiThemeState(localTheme);             // localStorage gana — sincronizar estado
    } else if (dbTheme) {
      localStorage.setItem("ui_theme", dbTheme);
      setUiThemeState(dbTheme);               // sin local → usar BD y persistir
    }
    // dark_mode se sincroniza desde SettingsModal al cambiar; aquí solo cargamos show_descriptions
    // para no sobreescribir la preferencia de localStorage en el primer render
  }

  async function setAccentStyle(style: 'solid' | 'metallic') {
    setAccentStyleState(style);
    if (user?.company_id) {
      await supabase.from("companies").update({ accent_style: style }).eq("id", user.company_id);
    }
  }

  function setPropertyAccent(color: string) {
    setAccentColor(color);
  }

  function resetPropertyAccent() {
    setAccentColor(companyBaseColorRef.current);
  }

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("prop-theme", next ? "dark" : "light");
  }

  function setUiTheme(theme: 'clasico' | 'super_soft' | 'rigido') {
    localStorage.setItem("ui_theme", theme);   // localStorage primero — fuente de verdad
    setUiThemeState(theme);
    if (user?.id) {
      void supabase.from("user_preferences").upsert(
        { user_id: user.id, ui_theme: theme },
        { onConflict: "user_id" },
      );
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        accentColor,
        groupColor,
        accentStyle,
        setAccentStyle,
        setPropertyAccent,
        resetPropertyAccent,
        platformName,
        logoUrl,
        logoPrintUrl,
        logoDarkUrl,
        logoGroupUrl,
        shortName,
        legalName,
        companyAddress,
        companyTaxId,
        companyPhone,
        companyEmail,
        companyZipCode,
        purchasesContactPhone,
        purchasesContactEmail,
        adminContactPhone,
        adminContactEmail,
        isDark,
        toggleDark,
        showDescriptions,
        setShowDescriptions,
        uiTheme,
        setUiTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/* ─── Hook de acceso ─────────────────────────────────────────────── */

export function useTheme() {
  return useContext(ThemeContext);
}
