"use client";

import { useEffect, useState } from "react";
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

function isCampoPath(pathname: string) {
  return pathname.startsWith("/campo");
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
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (!pathname || loading) return;
    setIsValidating(false);

    const portalPath = isPortalPath(pathname);
    const campoPath = isCampoPath(pathname);
    const adminPublic = isAdminPublicPath(pathname);
    const portalPublic = isPortalPublicPath(pathname);
    const publicHome = isPublicHome(pathname);

    if (publicHome) return;

    // Campo routes handle their own auth/role redirect internally
    if (campoPath) return;

    if (!user) {
      if (portalPath && !portalPublic) {
        router.replace("/portal/login");
        return;
      }

      if (!portalPath && !adminPublic) {
        router.replace("/");
        return;
      }

      return;
    }

    // Field: solo /campo/*
    if (user.role === "field") {
      if (!pathname.startsWith("/campo")) { router.replace("/campo/dashboard"); return; }
      return;
    }

    // Tenant: solo /portal/*
    if (user.role === "tenant") {
      if (!portalPath) { router.replace("/portal/dashboard"); return; }
      if (portalPublic) { router.replace("/portal/dashboard"); return; }
      return;
    }

    // Superadmin saltea el enforcement granular pero sigue con las redirecciones generales
    const skipGranular = user.role === "superadmin" || user.is_superadmin;

    if (!skipGranular) {
      if (user.role === "compras") {
        const allowed = ["/dashboard", "/compras", "/purchases", "/suppliers"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/purchases"); return; }
        return;
      }
      if (user.role === "mantenimiento") {
        const allowed = ["/dashboard", "/maintenance", "/cleaning"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/maintenance"); return; }
        return;
      }
      if (user.role === "administracion") {
        const allowed = ["/dashboard", "/buildings", "/servicios", "/payments", "/cobranza", "/collections", "/tenants"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/dashboard"); return; }
        return;
      }
      if (user.role === "directivo") {
        const allowed = ["/dashboard", "/buildings", "/analytics", "/cobranza", "/collections", "/tenants"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/dashboard"); return; }
        return;
      }
    }

    // Todos los roles admin — no pueden estar en portal ni campo
    if (portalPath) { router.replace("/dashboard"); return; }
    if (pathname.startsWith("/campo")) { router.replace("/dashboard"); return; }
    if (adminPublic) { router.replace("/dashboard"); return; }
  }, [pathname, router, user, loading]);

  if (loading || isValidating) return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(160deg, #0d1b2a 0%, #1c3a5e 60%, #0d1b2a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
    }}>
      <img
        src="/brands/saproa/saproa-stacked-dark.png"
        alt="SAPROA"
        className="splash-logo"
        style={{ width: 160, height: 160, objectFit: "contain" }}
      />
    </div>
  );

  return null;
}
