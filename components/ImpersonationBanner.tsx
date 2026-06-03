"use client";

import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
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
    impersonatedGroupName,
    stopImpersonation,
  } = useImpersonation();

  if (!isImpersonating) return null;

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

  function label() {
    if (impersonationMode === "group") {
      return `Vista grupo · ${impersonatedGroupName ?? ""}`;
    }
    const base = `Vista simulada · ${impersonatedCompanyName ?? ""}`;
    if (impersonationMode === "company") return `${base} · vista completa`;
    if (roleLabel) return `${base} · ${roleLabel}`;
    if (impersonatedUserEmail) return `${base} (${impersonatedUserEmail})`;
    return base;
  }

  function handleExit() {
    stopImpersonation();
    router.push("/saproa-admin/impersonar");
  }

  return (
    <div
      style={{
        background: "var(--accent-tint-soft)",
        border: "1px solid var(--accent-tint-medium)",
        borderRadius: "var(--border-radius-md)",
        padding: "8px 12px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
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
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label()}
      </span>
      <button
        onClick={handleExit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: "var(--border-radius-sm)",
          border: "1px solid rgba(99,102,241,0.4)",
          background: "transparent",
          color: SAPROA_ACCENT,
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <X size={12} />
        Salir
      </button>
    </div>
  );
}
