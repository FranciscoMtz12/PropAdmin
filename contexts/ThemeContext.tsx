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
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/* useLayoutEffect en cliente (sincrónico antes del paint), useEffect en SSR */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser, type AdminUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
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
  fontScale: number;
  setFontScale: (scale: number) => void;
};

/* ─── Valor por defecto (antes de cargar empresa) ────────────────── */

const DEFAULT_ACCENT = "#6366F1";

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
  fontScale: 1,
  setFontScale: () => {},
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

/* ─── Claves de localStorage por usuario ─────────────────────────── */

function darkModeKey(uid: string)    { return `darkMode_${uid}`; }
function uiThemeKey(uid: string)    { return `uiTheme_${uid}`; }
function fontScaleKey(uid: string)  { return `fontScale_${uid}`; }
function accentColorKey(uid: string){ return `accentColor_${uid}`; }

/* ─── Provider ────────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const {
    isImpersonating,
    impersonationMode,
    impersonatedCompanyId,
    impersonatedGroupId,
    impersonatedGroupName,
  } = useImpersonation();

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
  const [fontScale, setFontScaleState] = useState(1);

  /* ── Aplicar --font-scale en :root cuando cambie fontScale ──────── */
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  /* ── Resetear branding al cerrar sesión (user → null) ──────────── */
  useEffect(() => {
    if (!user) {
      /* Limpiar preferencias del usuario anterior para que el login vea defaults */
      const lastUid = localStorage.getItem("last_user_id");
      if (lastUid) {
        localStorage.removeItem(fontScaleKey(lastUid));
      }
      localStorage.removeItem("last_user_id");

      document.documentElement.style.setProperty('--font-scale', '1');
      setFontScaleState(1);
      setAccentColor(DEFAULT_ACCENT);
      setGroupColor(DEFAULT_ACCENT);
      companyBaseColorRef.current = DEFAULT_ACCENT;
      document.documentElement.style.setProperty("--accent",          DEFAULT_ACCENT);
      document.documentElement.style.setProperty("--accent-gradient", DEFAULT_ACCENT);
      document.documentElement.style.setProperty("--color-accent",    DEFAULT_ACCENT);
      document.documentElement.style.setProperty("--color-primary",   DEFAULT_ACCENT);
      document.documentElement.style.setProperty("--group-accent",    DEFAULT_ACCENT);
      document.documentElement.style.setProperty("--color-accent-rgb", "99, 102, 241");
      setLogoUrl(null);
      setLogoDarkUrl(null);
      setLogoGroupUrl(null);
      setShortName("PropAdmin");
    }
  }, [user]);

  /* ── Leer preferencia de modo guardada o del sistema (solo en cliente) ── */
  useEffect(() => {
    /* Intentar leer la preferencia del último usuario logueado para evitar flash */
    const lastUid = localStorage.getItem("last_user_id");
    if (lastUid) {
      /* Leer font scale inmediatamente para evitar flash de tamaño */
      const storedScale = parseFloat(localStorage.getItem(fontScaleKey(lastUid)) ?? "1");
      if ([0.80, 1, 1.20, 1.40].includes(storedScale)) {
        setFontScaleState(storedScale);
        document.documentElement.style.setProperty('--font-scale', String(storedScale));
      }
      /* Restaurar accent color desde caché para evitar FOUC de color de marca */
      const cachedAccent = localStorage.getItem(accentColorKey(lastUid));
      if (cachedAccent) {
        setAccentColor(cachedAccent);
        document.documentElement.style.setProperty("--accent",          cachedAccent);
        document.documentElement.style.setProperty("--accent-gradient", generateMetallicGradient(cachedAccent));
        document.documentElement.style.setProperty("--color-accent",    cachedAccent);
        document.documentElement.style.setProperty("--color-primary",   cachedAccent);
      }
      const stored = localStorage.getItem(darkModeKey(lastUid));
      if (stored === "true" || stored === "false") {
        setIsDark(stored === "true");
        return;
      }
    }
    /* Sin preferencia guardada → usar preferencia del sistema operativo */
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(prefersDark);
  }, []);

  /* ── Aplicar clase .dark en <html> cuando cambie isDark ────────── */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  /* ── Aplicar --accent + --accent-gradient en :root cuando cambie accentColor ── */
  useIsomorphicLayoutEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor);
    document.documentElement.style.setProperty("--accent-gradient", generateMetallicGradient(accentColor));
    if (user?.id) {
      localStorage.setItem(accentColorKey(user.id), accentColor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor, user?.id]);

  /* ── Aplicar --btn-primary-bg según accentStyle ─────────────────── */
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--btn-primary-bg",
      accentStyle === 'metallic' ? "var(--accent-gradient)" : "var(--accent)",
    );
  }, [accentStyle]);

  /* ── Aplicar data-theme desde localStorage inmediatamente (antes de Supabase) ── */
  useEffect(() => {
    /* Intentar leer la preferencia del último usuario logueado para evitar flash */
    const lastUid = localStorage.getItem("last_user_id");
    const saved = lastUid ? localStorage.getItem(uiThemeKey(lastUid)) : null;
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
    if (impersonationMode === 'group' && impersonatedGroupId) {
      void loadGroupBranding(impersonatedGroupId, impersonatedGroupName ?? '');
    } else if (isImpersonating && impersonatedCompanyId) {
      void loadCompanyBranding(impersonatedCompanyId, false, false, true);
    } else if (user?.company_id) {
      const isSA = Boolean(user.is_superadmin) || user.role === 'superadmin';
      const isGA = (user.role as string) === 'group_admin';
      void loadCompanyBranding(user.company_id, isSA, isGA);
    } else if (!user?.company_id && (user?.role as string) === 'group_admin' && (user as AdminUser)?.group_id) {
      /* group_admin sin empresa: cargar colores del grupo directamente */
      void loadGroupBranding((user as AdminUser).group_id!, '');
    } else if (user?.is_superadmin) {
      /* Superadmin con company_id = null: cargar config de plataforma directo */
      void loadSaproaConfig();
    }
    if (user?.id) {
      void loadUserPreferences(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating, impersonationMode, impersonatedCompanyId, impersonatedGroupId, user?.company_id, (user as AdminUser)?.group_id, user?.id, user?.is_superadmin, user?.role]);

  async function loadGroupBranding(groupId: string, groupName: string) {
    const { data } = await supabase
      .from("company_groups")
      .select("id, name, short_name, brand_color, logo_url")
      .eq("id", groupId)
      .maybeSingle();

    const color = (data as any)?.brand_color || "#C9A84C";
    setAccentColor(color);
    setGroupColor(color);
    companyBaseColorRef.current = color;
    document.documentElement.style.setProperty("--color-primary", color);
    document.documentElement.style.setProperty("--group-accent", color);
    setAccentStyleState('solid');
    const rawName = (data as any)?.short_name || groupName;
    const displayGroupName = rawName.startsWith("Grupo") ? rawName : `Grupo ${rawName}`;
    setShortName(displayGroupName);
    setPlatformName(displayGroupName);
    setLogoUrl((data as any)?.logo_url ?? null);
    setLogoDarkUrl(null);
    setLogoGroupUrl(null);
  }

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

  async function loadCompanyBranding(companyId: string, isSuperAdmin: boolean, isGroupAdmin: boolean, forceCompanyColor = false) {
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
    if (data.group_id && !forceCompanyColor) {
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
    /* Marcar último usuario para acelerar el siguiente inicio de sesión */
    localStorage.setItem("last_user_id", userId);

    const { data } = await supabase
      .from("user_preferences")
      .select("dark_mode, show_descriptions, ui_theme, font_scale")
      .eq("user_id", userId)
      .maybeSingle();

    if (data && typeof data.show_descriptions === "boolean") {
      setShowDescriptions(data.show_descriptions);
    }

    const VALID_THEMES = ["clasico", "super_soft", "rigido"] as const;
    type ValidTheme = typeof VALID_THEMES[number];

    /* ui_theme: clave por usuario > BD > clásico */
    const localThemeRaw = localStorage.getItem(uiThemeKey(userId));
    const localTheme = VALID_THEMES.includes(localThemeRaw as ValidTheme) ? localThemeRaw as ValidTheme : null;
    const dbTheme = data && VALID_THEMES.includes(data.ui_theme as ValidTheme) ? data.ui_theme as ValidTheme : null;
    const finalTheme = localTheme ?? dbTheme ?? 'clasico';
    localStorage.setItem(uiThemeKey(userId), finalTheme);
    setUiThemeState(finalTheme);

    /* dark_mode: clave por usuario > BD > preferencia del sistema (ya aplicada en el mount) */
    const localDarkRaw = localStorage.getItem(darkModeKey(userId));
    if (localDarkRaw === "true" || localDarkRaw === "false") {
      setIsDark(localDarkRaw === "true");
    } else if (data && typeof data.dark_mode === "boolean") {
      setIsDark(data.dark_mode);
      localStorage.setItem(darkModeKey(userId), String(data.dark_mode));
    }

    /* font_scale: localStorage > BD > 1.0 */
    const VALID_SCALES = [0.80, 1, 1.20, 1.40];
    const localScaleRaw = parseFloat(localStorage.getItem(fontScaleKey(userId)) ?? "1");
    const localScale = VALID_SCALES.includes(localScaleRaw) ? localScaleRaw : null;
    const dbScale = data?.font_scale != null && VALID_SCALES.includes(data.font_scale as number) ? (data.font_scale as number) : null;
    const finalScale = localScale ?? dbScale ?? 1;
    localStorage.setItem(fontScaleKey(userId), String(finalScale));
    setFontScaleState(finalScale);
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
    if (user?.id) {
      localStorage.setItem(darkModeKey(user.id), String(next));
      void supabase.from("user_preferences").upsert(
        { user_id: user.id, dark_mode: next },
        { onConflict: "user_id" },
      );
    }
  }

  function setUiTheme(theme: 'clasico' | 'super_soft' | 'rigido') {
    setUiThemeState(theme);
    if (user?.id) {
      localStorage.setItem(uiThemeKey(user.id), theme);
      void supabase.from("user_preferences").upsert(
        { user_id: user.id, ui_theme: theme },
        { onConflict: "user_id" },
      );
    }
  }

  function setFontScale(scale: number) {
    setFontScaleState(scale);
    window.dispatchEvent(new CustomEvent('font-scale-change', { detail: scale }));
    if (user?.id) {
      localStorage.setItem(fontScaleKey(user.id), String(scale));
      void supabase.from("user_preferences").upsert(
        { user_id: user.id, font_scale: scale },
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
        fontScale,
        setFontScale,
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
