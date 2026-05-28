"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const SAPROA_ACCENT = "#6366F1";

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

  return (
    <div
      style={{
        background: "rgba(99,102,241,0.08)",
        border: "1px solid rgba(99,102,241,0.2)",
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
          background: SAPROA_ACCENT,
          flexShrink: 0,
        }}
      />
      <Eye size={14} color={SAPROA_ACCENT} style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: "0.8125rem",
          color: SAPROA_ACCENT,
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
          border: "1px solid rgba(99,102,241,0.4)",
          background: "transparent",
          color: SAPROA_ACCENT,
          fontSize: "0.75rem",
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
