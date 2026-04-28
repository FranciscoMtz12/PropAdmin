import type { CSSProperties } from "react";

/*
  pageStyles.ts — constantes de estilo compartidas para todas las páginas.

  Todas usan variables CSS del sistema de theming, por lo que responden
  automáticamente al dark/light mode sin lógica adicional en cada página.

  Importar lo que se necesite:
    import { INPUT_STYLE, dropdownMenuStyle, ... } from "@/lib/pageStyles";
*/

/* ─── Inputs ──────────────────────────────────────────────────────── */

export const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid var(--border-default)",
  borderRadius: 10,
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  outline: "none",
  fontSize: 14,
};

export const TEXTAREA_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  resize: "vertical" as const,
  minHeight: 100,
};

/* ─── Dropdowns ───────────────────────────────────────────────────── */

export const dropdownTriggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

export const dropdownMenuStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  minWidth: 180,
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  boxShadow: "var(--shadow-card)",
  padding: 6,
  display: "grid",
  gap: 4,
  zIndex: 200,
};

export const dropdownActionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export const dropdownDeleteItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  border: "1px solid #dc2626",
  background: "transparent",
  color: "#dc2626",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

/* ─── Banners de alerta en modales ────────────────────────────────── */

export const warnBannerStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  background: "var(--badge-bg-amber)",
  border: "1px solid var(--metric-border-amber)",
  color: "var(--badge-text-amber)",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.5,
};

export const errorBannerStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--badge-bg-red)",
  border: "1px solid var(--metric-border-red)",
  color: "var(--badge-text-red)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.5,
};

export const successBannerStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--badge-bg-green)",
  border: "1px solid var(--metric-border-green)",
  color: "var(--badge-text-green)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.5,
};

/* ─── Botón destructivo (archivar/eliminar) ───────────────────────── */

export const dangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid var(--badge-text-red)",
  borderRadius: 8,
  padding: "11px 16px",
  background: "var(--badge-text-red)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

/* ─── Link de acción (texto-link dentro de cards) ─────────────────── */

export const cardActionLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "var(--accent)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
};

/* ─── Botón de navegación secundario (dentro de cards) ───────────── */

export const cardNavButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};
