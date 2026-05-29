"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCurrentUser } from "@/contexts/UserContext";
import { getAdminDestination } from "@/lib/auth-routing";

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

const ADMIN_PUBLIC_ROUTES = ["/login", "/register"];
const PORTAL_PUBLIC_ROUTES = ["/portal/login"]; // /portal/login redirects to /login server-side

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

function isPublicFicha(pathname: string) {
  return pathname.startsWith("/p/") || pathname === "/p";
}

function isLegalPage(pathname: string) {
  return pathname === "/terms" || pathname === "/privacy";
}

export default function RouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [isValidating, setIsValidating] = useState(true);

  // Welcome splash: fires when user authenticates from /login, clears on arrival at destination.
  // This lets us suppress the splash on /login before submit while preserving it post-submit.
  const [welcomeTransition, setWelcomeTransition] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const curr = user?.id;
    if (!prevUserIdRef.current && curr && pathname === "/login") setWelcomeTransition(true);
    if (prevUserIdRef.current && !curr) setWelcomeTransition(false);
    prevUserIdRef.current = curr;
  }, [user?.id, pathname]);

  useEffect(() => {
    if (welcomeTransition && pathname && !isAdminPublicPath(pathname)) setWelcomeTransition(false);
  }, [welcomeTransition, pathname]);

  useEffect(() => {
    if (!pathname || loading) return;
    setIsValidating(false);

    const portalPath = isPortalPath(pathname);
    const campoPath = isCampoPath(pathname);
    const adminPublic = isAdminPublicPath(pathname);
    const portalPublic = isPortalPublicPath(pathname);
    const publicHome = isPublicHome(pathname);

    if (publicHome) return;

    // Public unit share pages — no auth required
    if (isPublicFicha(pathname)) return;

    // Legal pages — accessible without authentication
    if (isLegalPage(pathname)) return;

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

    // /home es accesible para cualquier usuario admin autenticado (incluyendo superadmin en modo impersonación)
    if (pathname === "/home") return;

    // Field: solo /campo/*
    if (user.role === "field") {
      if (!pathname.startsWith("/campo") && pathname !== "/settings") { router.replace("/campo/dashboard"); return; }
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
      if (user.role === "titular" || user.role === "group_admin") {
        if (pathname.startsWith("/feedback")) { router.replace("/dashboard"); return; }
        return;
      }
      if (user.role === "compras") {
        const allowed = ["/dashboard", "/purchases", "/suppliers", "/settings"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/purchases"); return; }
        return;
      }
      if (user.role === "mantenimiento") {
        const allowed = ["/dashboard", "/maintenance", "/cleaning", "/settings"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/maintenance"); return; }
        return;
      }
      if (user.role === "administracion") {
        const allowed = ["/dashboard", "/buildings", "/servicios", "/payments", "/collections", "/cobranza", "/tenants", "/settings"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/dashboard"); return; }
        return;
      }
      if (user.role === "directivo") {
        const allowed = ["/dashboard", "/buildings", "/analytics", "/collections", "/cobranza", "/tenants"]
        if (!allowed.some(p => pathname.startsWith(p))) { router.replace("/dashboard"); return; }
        return;
      }
    }

    // Todos los roles admin — no pueden estar en portal ni campo
    const adminHome = user.role ? getAdminDestination(user.role, Boolean(user.is_superadmin)) : "/home";
    if (portalPath) { router.replace(adminHome); return; }
    if (pathname.startsWith("/campo")) { router.replace(adminHome); return; }
    if (adminPublic) { router.replace(adminHome); return; }
  }, [pathname, router, user, loading]);

  const adminPublicPage = pathname ? isAdminPublicPath(pathname) : false;
  const showSplash = welcomeTransition || (!adminPublicPage && (loading || isValidating));

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          key="splash"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            position: "fixed", inset: 0,
            background: "linear-gradient(160deg, #0d1b2a 0%, #1c3a5e 60%, #0d1b2a 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <img
            src="/brands/saproa/saproa-stacked-dark.png"
            alt="SAPROA"
            className="splash-logo"
            style={{ width: 160, height: 160, objectFit: "contain" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
