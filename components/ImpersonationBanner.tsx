"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useTheme } from "@/contexts/ThemeContext";

export function ImpersonationBanner() {
  const router = useRouter();
  const {
    isImpersonating,
    impersonationMode,
    impersonatedCompanyName,
    impersonatedRole,
    impersonatedUserEmail,
    stopImpersonation,
  } = useImpersonation();
  const { groupColor } = useTheme();

  if (!isImpersonating || impersonationMode === "group") return null;

  const ROLE_LABEL: Record<string, string> = {
    titular: "Titular",
    administracion: "Administración",
    directivo: "Directivo",
    compras: "Compras",
    mantenimiento: "Mantenimiento",
    field: "Campo",
  };

  const roleLabel =
    (impersonatedRole && ROLE_LABEL[impersonatedRole]) || impersonatedRole || "";

  function handleExit() {
    stopImpersonation();
    router.push("/saproa-admin/overview");
  }

  /* hex to rgba helper — appends 2-digit hex alpha */
  const bg     = `${groupColor}14`;   // ~0.08 opacity
  const border = `${groupColor}33`;   // ~0.20 opacity
  const btnBorder = `${groupColor}66`; // ~0.40 opacity

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "var(--border-radius-md)",
        padding: "9px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: groupColor,
          flexShrink: 0,
        }}
      />
      <Eye size={14} color={groupColor} style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: groupColor,
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        Vista simulada
        {impersonatedCompanyName ? ` · ${impersonatedCompanyName}` : ""}
        {impersonationMode === "company"
          ? " · vista completa"
          : roleLabel
          ? ` · ${roleLabel}`
          : ""}
        {impersonationMode === "user" && impersonatedUserEmail
          ? ` (${impersonatedUserEmail})`
          : ""}
      </span>
      <button
        onClick={handleExit}
        style={{
          padding: "4px 10px",
          borderRadius: "var(--border-radius-sm)",
          border: `1px solid ${btnBorder}`,
          background: "transparent",
          color: groupColor,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Salir de vista simulada
      </button>
    </div>
  );
}
