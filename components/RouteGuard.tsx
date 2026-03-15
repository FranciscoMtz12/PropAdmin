"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/contexts/UserContext";

/*
  RouteGuard cliente para separar experiencia admin vs tenant.

  IMPORTANTE:
  Esto sí bloquea navegación dentro de la app y evita que un tenant use
  rutas administrativas por URL manual.
  Pero todavía NO sustituye seguridad server-side real.

  Más adelante, para blindaje completo, conviene migrar auth a cookies SSR
  y luego agregar middleware de Next con validación de sesión del lado servidor.
*/

const ADMIN_PUBLIC_ROUTES = ["/login"];
const PORTAL_PUBLIC_ROUTES = ["/portal/login"];

function isPortalPath(pathname: string) {
  return pathname.startsWith("/portal");
}

function isAdminPublicPath(pathname: string) {
  return ADMIN_PUBLIC_ROUTES.includes(pathname);
}

function isPortalPublicPath(pathname: string) {
  return PORTAL_PUBLIC_ROUTES.includes(pathname);
}

function isPublicHome(pathname: string) {
  return pathname === "/";
}

export default function RouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!pathname || loading) return;

    const portalPath = isPortalPath(pathname);
    const adminPublic = isAdminPublicPath(pathname);
    const portalPublic = isPortalPublicPath(pathname);
    const publicHome = isPublicHome(pathname);

    // Home raíz: no forzamos nada aquí.
    if (publicHome) return;

    // Sin sesión
    if (!user) {
      if (portalPath && !portalPublic) {
        router.replace("/portal/login");
        return;
      }

      if (!portalPath && !adminPublic) {
        router.replace("/login");
        return;
      }

      return;
    }

    // Usuario tenant
    if (user.role === "tenant") {
      // Tenant no debe ver rutas admin
      if (!portalPath) {
        router.replace("/portal/dashboard");
        return;
      }

      // Tenant autenticado no necesita volver a /portal/login
      if (portalPublic) {
        router.replace("/portal/dashboard");
        return;
      }

      return;
    }

    // Usuario admin
    if (user.role === "admin") {
      // Admin no debe navegar dentro del portal tenant
      if (portalPath) {
        router.replace("/dashboard");
        return;
      }

      // Admin autenticado no necesita volver a /login
      if (adminPublic) {
        router.replace("/dashboard");
        return;
      }
    }
  }, [pathname, router, user, loading]);

  return null;
}
