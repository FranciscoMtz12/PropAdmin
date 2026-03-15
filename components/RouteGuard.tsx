"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/contexts/UserContext";

/*
  RouteGuard cliente para separar experiencia admin vs tenant.

  REGLAS ACTUALES:
  - tenant solo puede usar /portal/*
  - admin normal solo puede usar rutas administrativas
  - superadmin puede usar ambas zonas:
      /dashboard y /portal/*
  - sin sesión:
      rutas admin -> /login
      rutas portal -> /portal/login

  IMPORTANTE:
  Esto sigue siendo protección cliente.
  Más adelante conviene reforzar con auth SSR + middleware.
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

    if (publicHome) return;

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

    // Superadmin: acceso total al sistema.
    if (user.role === "admin" && user.is_superadmin) {
      if (adminPublic || portalPublic) {
        router.replace("/dashboard");
      }
      return;
    }

    if (user.role === "tenant") {
      if (!portalPath) {
        router.replace("/portal/dashboard");
        return;
      }

      if (portalPublic) {
        router.replace("/portal/dashboard");
        return;
      }

      return;
    }

    if (user.role === "admin") {
      if (portalPath) {
        router.replace("/dashboard");
        return;
      }

      if (adminPublic) {
        router.replace("/dashboard");
        return;
      }
    }
  }, [pathname, router, user, loading]);

  return null;
}
