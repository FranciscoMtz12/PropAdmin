"use client";

import { useCurrentUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

/**
 * Devuelve el company_id activo según el estado de impersonación.
 *
 * - Modo empresa o usuario: impersonatedCompanyId
 * - Modo grupo:             null (la query viaja sin filtro; RLS o el caller maneja el acceso)
 * - Sin impersonar:         user.company_id (el del usuario real)
 */
export function useActiveCompanyId(): string | null {
  const { user } = useCurrentUser();
  const { isImpersonating, impersonationMode, impersonatedCompanyId } = useImpersonation();

  if (isImpersonating && impersonationMode !== "group" && impersonatedCompanyId) {
    return impersonatedCompanyId;
  }

  return user?.company_id ?? null;
}

/**
 * True si el componente debe cargar datos propios de la empresa activa.
 * Para superadmin: solo cuando está impersonando (modo empresa o usuario).
 */
export function useShouldLoadCompanyData(): boolean {
  const { user } = useCurrentUser();
  const { isImpersonating, impersonationMode } = useImpersonation();

  if (!user) return false;
  if (!user.is_superadmin) return true;

  // Superadmin: cargar solo cuando impersona empresa o usuario (no grupo)
  return isImpersonating && impersonationMode !== "group";
}
