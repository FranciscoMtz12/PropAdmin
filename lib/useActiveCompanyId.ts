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
 *
 * Lee directamente desde ImpersonationContext (no vía ImpersonationBridge)
 * para evitar dependencias de timing con el bridge.
 */
export function useShouldLoadCompanyData(): boolean {
  const { user } = useCurrentUser();
  const { isImpersonating, impersonationMode, impersonatedCompanyId } = useImpersonation();

  if (!user) return false;

  // Impersonando empresa o usuario: cargar solo si hay un company_id destino
  if (isImpersonating && (impersonationMode === "company" || impersonationMode === "user")) {
    return !!impersonatedCompanyId;
  }

  // Modo grupo: cargar (sin filtro de empresa específica)
  if (isImpersonating && impersonationMode === "group") return true;

  // Sin impersonar: cargar si el usuario tiene empresa propia
  return !!user.company_id;
}
