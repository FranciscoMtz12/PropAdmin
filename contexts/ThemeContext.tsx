"use client";

/*
  ThemeContext — contexto global de branding y modo claro/oscuro.

  Responsabilidades:
  1. Lee brand_color, logo_url, logo_dark_url, short_name de la tabla companies.
  2. Aplica brand_color como variable CSS --accent en :root.
  3. Aplica la clase .dark en <html> para activar los CSS vars del modo.
  4. Detecta preferencia de sistema (prefers-color-scheme) en el primer render.
  5. Permite toggle manual que se guarda en localStorage ("prop-theme").
*/

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

/* ─── Tipos ───────────────────────────────────────────────────────── */

type ThemeContextType = {
  accentColor: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  shortName: string;
  isDark: boolean;
  toggleDark: () => void;
};

/* ─── Valor por defecto (antes de cargar empresa) ────────────────── */

const DEFAULT_ACCENT = "#8B2252";

const ThemeContext = createContext<ThemeContextType>({
  accentColor: DEFAULT_ACCENT,
  logoUrl: null,
  logoDarkUrl: null,
  shortName: "PropAdmin",
  isDark: false,
  toggleDark: () => {},
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const [shortName, setShortName] = useState("PropAdmin");
  const [isDark, setIsDark] = useState(false);

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

  /* ── Aplicar --accent en :root cuando cambie accentColor ───────── */
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor);
  }, [accentColor]);

  /* ── Cargar branding de la empresa cuando el usuario esté listo ── */
  useEffect(() => {
    if (user?.company_id) {
      void loadCompanyBranding(user.company_id);
    }
  }, [user?.company_id]);

  async function loadCompanyBranding(companyId: string) {
    const { data } = await supabase
      .from("companies")
      .select("brand_color, logo_url, logo_dark_url, short_name")
      .eq("id", companyId)
      .maybeSingle();

    if (!data) return;

    if (data.brand_color) setAccentColor(data.brand_color);
    setLogoUrl(data.logo_url ?? null);
    setLogoDarkUrl(data.logo_dark_url ?? null);
    if (data.short_name) setShortName(data.short_name);
  }

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("prop-theme", next ? "dark" : "light");
  }

  return (
    <ThemeContext.Provider
      value={{ accentColor, logoUrl, logoDarkUrl, shortName, isDark, toggleDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/* ─── Hook de acceso ─────────────────────────────────────────────── */

export function useTheme() {
  return useContext(ThemeContext);
}
