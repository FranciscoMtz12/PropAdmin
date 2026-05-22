"use client";

/*
  ImpersonationBridge — re-provee UserContext con los valores efectivos
  cuando el superadmin está impersonando una empresa/usuario.

  Posición en el árbol: DENTRO de ImpersonationProvider, ENCIMA de ThemeProvider.
  - Lee el UserContext real (del UserProvider padre).
  - Cuando isImpersonating: sustituye company_id, role, is_superadmin.
  - Los componentes hijos (ThemeProvider, Sidebar, páginas) ven el usuario efectivo.
*/

import { useMemo } from "react";
import { UserContext, useCurrentUser, type AdminUser, type UserContextType } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type AdminRole = AdminUser["role"];

export function ImpersonationBridge({ children }: { children: React.ReactNode }) {
  const realCtx = useCurrentUser();
  const { isImpersonating, impersonatedCompanyId, impersonatedRole } = useImpersonation();

  const effectiveCtx = useMemo((): UserContextType => {
    if (!isImpersonating || !realCtx.user) return realCtx;

    const effectiveUser: AdminUser = {
      id:           realCtx.user.id,
      email:        realCtx.user.email,
      full_name:    realCtx.user.full_name,
      company_id:   impersonatedCompanyId,
      is_superadmin: false,
      role:         ((impersonatedRole ?? "titular") as AdminRole),
    };

    return {
      user:            effectiveUser,
      loading:         realCtx.loading,
      isSupabaseAdmin: false,
      refreshUser:     realCtx.refreshUser,
    };
  }, [isImpersonating, impersonatedCompanyId, impersonatedRole, realCtx]);

  return (
    <UserContext.Provider value={effectiveCtx}>
      {children}
    </UserContext.Provider>
  );
}
