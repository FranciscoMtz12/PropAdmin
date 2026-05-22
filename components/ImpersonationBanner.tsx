"use client";

import { Eye } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const SAPROA_COLOR = "#8B2252";

export function ImpersonationBanner() {
  const {
    isImpersonating,
    impersonatedCompanyName,
    impersonatedRole,
    impersonatedUserEmail,
    stopImpersonation,
  } = useImpersonation();

  if (!isImpersonating) return null;

  const ROLE_LABEL: Record<string, string> = {
    titular: "Titular", administracion: "Administración", directivo: "Directivo",
    compras: "Compras", mantenimiento: "Mantenimiento", field: "Campo",
  };

  const roleLabel = (impersonatedRole && ROLE_LABEL[impersonatedRole]) || impersonatedRole || "";

  return (
    <div
      style={{
        background: "rgba(139,34,82,0.07)",
        border: "1px solid rgba(139,34,82,0.18)",
        borderRadius: "var(--border-radius-md)",
        padding: "9px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}
    >
      <Eye size={14} color={SAPROA_COLOR} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: SAPROA_COLOR, fontWeight: 600, lineHeight: 1.4 }}>
        Vista simulada
        {impersonatedCompanyName ? ` · ${impersonatedCompanyName}` : ""}
        {roleLabel ? ` · ${roleLabel}` : ""}
        {impersonatedUserEmail ? ` (${impersonatedUserEmail})` : ""}
      </span>
      <button
        onClick={stopImpersonation}
        style={{
          padding: "4px 10px",
          borderRadius: "var(--border-radius-sm)",
          border: `1px solid rgba(139,34,82,0.4)`,
          background: "transparent",
          color: SAPROA_COLOR,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Salir
      </button>
    </div>
  );
}
