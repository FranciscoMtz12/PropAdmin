"use client";

import { supabase } from "@/lib/supabaseClient";

/* Destinos posibles por tipo de usuario */
export type AuthDestination =
  | "/saproa-admin/overview"
  | "/home"
  | "/campo/dashboard"
  | "/portal/dashboard";

export type ResolvedProfile =
  | { type: "admin"; role: string; destination: AuthDestination }
  | { type: "tenant"; destination: "/portal/dashboard" }
  | { type: "unknown" };

/**
 * Resuelve a qué ruta debe ir un usuario autenticado.
 * Orden: app_users (admin) → tenants → unknown.
 * Diseñado para que agregar un nuevo tipo de usuario sea trivial:
 * solo añade una query y un caso al tipo ResolvedProfile.
 */
export async function resolveUserDestination(authUserId: string): Promise<ResolvedProfile> {
  // 1 — Intentar como admin
  const { data: adminData } = await supabase
    .from("app_users")
    .select("id, role, is_superadmin")
    .eq("id", authUserId)
    .maybeSingle();

  if (adminData) {
    return {
      type: "admin",
      role: adminData.role,
      destination: getAdminDestination(adminData.role, Boolean(adminData.is_superadmin)),
    };
  }

  // 2 — Intentar como inquilino
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("id")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (tenantData) {
    return { type: "tenant", destination: "/portal/dashboard" };
  }

  return { type: "unknown" };
}

/**
 * Mapa sincrónico de rol → destino (para RouteGuard que ya tiene el user cargado).
 * Agregar un rol nuevo: añadir un case aquí.
 */
export function getAdminDestination(role: string, isSuperadmin: boolean): AuthDestination {
  if (isSuperadmin || role === "superadmin") return "/home";
  if (role === "field")                       return "/campo/dashboard";
  // titular, administracion, directivo, compras, mantenimiento, group_admin → /home
  return "/home";
}
