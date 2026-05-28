"use client";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCurrentUser } from "@/contexts/UserContext";
import { initials } from "@/contexts/ThemeContext";

const GROUP_COLOR = "#C9A84C";

export default function GroupBanner() {
  const { user } = useCurrentUser();
  const {
    isImpersonating,
    impersonationMode,
    impersonatedGroupName,
    groupCompanies,
    groupCompanyIds,
    toggleGroupCompany,
  } = useImpersonation();

  const isGroupAdmin = user?.role === 'group_admin';
  if (!isGroupAdmin && (!isImpersonating || impersonationMode !== 'group')) return null;

  return (
    <div
      style={{
        background: "rgba(201,168,76,0.08)",
        border: "1px solid rgba(201,168,76,0.2)",
        borderRadius: "var(--border-radius-md)",
        padding: "9px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      {/* Nombre del grupo */}
      <span style={{
        fontSize: "0.8125rem", fontWeight: 700, color: GROUP_COLOR, whiteSpace: "nowrap",
      }}>
        {impersonatedGroupName
          ? (impersonatedGroupName.startsWith("Grupo") ? impersonatedGroupName : `Grupo ${impersonatedGroupName}`)
          : "Grupo"}
      </span>

      {/* Divisor vertical */}
      <div style={{
        width: 1, height: 22, background: "rgba(201,168,76,0.3)", flexShrink: 0,
      }} />

      {/* Círculos de empresas */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
        {groupCompanies.map(company => {
          const isActive = groupCompanyIds.includes(company.id);
          const bgColor  = company.brand_color || "#6b7280";
          const abbr     = initials(company.short_name || company.name);

          return (
            <button
              key={company.id}
              onClick={() => toggleGroupCompany(company.id)}
              title={company.name}
              style={{
                width: 26, height: 26,
                borderRadius: "50%",
                border: isActive ? "2px solid rgba(255,255,255,0.35)" : "2px solid transparent",
                background: bgColor,
                cursor: "pointer",
                padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                opacity: isActive ? 1 : 0.3,
                filter: isActive ? "none" : "grayscale(0.5)",
                transition: "opacity 0.15s, filter 0.15s",
                flexShrink: 0,
              }}
            >
              {company.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={company.logo_url}
                  alt={company.name}
                  style={{ width: 26, height: 26, objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                <span style={{
                  fontSize: "0.5625rem", fontWeight: 700, color: "#fff", userSelect: "none", lineHeight: 1,
                }}>
                  {abbr}
                </span>
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
