"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";

type SaproaConfig = {
  id: string;
  platform_name: string | null;
  accent_color: string | null;
  accent_style: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
};

export default function SaproaSistemaPage() {
  const [config, setConfig] = useState<SaproaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [platformName, setPlatformName] = useState("");
  const [accentColor, setAccentColor] = useState("#8B2252");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoDarkUrl, setLogoDarkUrl] = useState("");

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    const { data, error } = await supabase
      .from("saproa_config")
      .select("id, platform_name, accent_color, accent_style, logo_url, logo_dark_url")
      .limit(1)
      .maybeSingle();
    if (error) {
      toast.error("No se pudo cargar la configuración.");
      setLoading(false);
      return;
    }
    if (data) {
      setConfig(data as SaproaConfig);
      setPlatformName(data.platform_name ?? "");
      setAccentColor(data.accent_color ?? "#8B2252");
      setLogoUrl(data.logo_url ?? "");
      setLogoDarkUrl(data.logo_dark_url ?? "");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!config?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("saproa_config")
      .update({
        platform_name: platformName || null,
        accent_color: accentColor || null,
        logo_url: logoUrl || null,
        logo_dark_url: logoDarkUrl || null,
      })
      .eq("id", config.id);
    if (error) {
      toast.error("No se pudo guardar la configuración.");
    } else {
      toast.success("Configuración guardada.");
    }
    setSaving(false);
  }

  if (loading) {
    return <PageContainer><div style={{ color: "var(--text-muted)", padding: "32px 0" }}>Cargando configuración...</div></PageContainer>;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--border-radius-md)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-input, var(--bg-subtle))",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
    display: "block",
  };

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginBottom: 20,
  };

  return (
    <PageContainer>
      <PageHeader title="Configuración del sistema" titleIcon={<Settings size={18} />} />

      <SectionCard title="Plataforma SAPROA" subtitle="Configuración global de branding y colores" icon={<Settings size={16} />}>
        <div style={{ maxWidth: 540 }}>
          {/* Platform name */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Nombre de la plataforma</label>
            <input
              style={inputStyle}
              value={platformName}
              onChange={e => setPlatformName(e.target.value)}
              placeholder="SAPROA"
            />
          </div>

          {/* Accent color */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Color de acento</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="color"
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                style={{ width: 44, height: 44, border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", cursor: "pointer", padding: 2 }}
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                placeholder="#8B2252"
              />
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: accentColor, flexShrink: 0, border: "1px solid var(--border-default)" }} />
            </div>
          </div>

          {/* Logo URL */}
          <div style={fieldStyle}>
            <label style={labelStyle}>URL del logo (modo claro)</label>
            <input
              style={inputStyle}
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
            {logoUrl && (
              <img src={logoUrl} alt="Logo preview" style={{ height: 40, objectFit: "contain", marginTop: 8, borderRadius: "var(--border-radius-sm)" }} />
            )}
          </div>

          {/* Logo dark URL */}
          <div style={fieldStyle}>
            <label style={labelStyle}>URL del logo (modo oscuro)</label>
            <input
              style={inputStyle}
              value={logoDarkUrl}
              onChange={e => setLogoDarkUrl(e.target.value)}
              placeholder="https://..."
            />
            {logoDarkUrl && (
              <img src={logoDarkUrl} alt="Logo dark preview" style={{ height: 40, objectFit: "contain", marginTop: 8, borderRadius: "var(--border-radius-sm)" }} />
            )}
          </div>

          <UiButton onClick={() => void handleSave()} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </UiButton>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
