"use client";

/*
  Layout del portal de campo — UI optimizada para móvil/tablet.

  Estructura:
  - Header fijo (56px): logo de la empresa + nombre de usuario + botón logout
  - Contenido: ocupa el resto de la pantalla con scroll, paddingBottom para la barra
  - Bottom navigation (64px): Dashboard, Tickets, Limpieza, Assets

  Protección de rutas: solo admin (cualquier rol admin).
  Redirige a /login si no hay sesión o el usuario es tenant.
*/

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grid2X2, LogOut, Sparkles, Ticket, Wrench } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { href: "/campo/dashboard", label: "Inicio",   icon: Grid2X2 },
  { href: "/campo/tickets",   label: "Tickets",  icon: Wrench   },
  { href: "/campo/limpieza",  label: "Limpieza", icon: Sparkles },
  { href: "/campo/assets",    label: "Activos",  icon: Ticket   },
];

export default function CampoLayout({ children }: { children: ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, loading } = useCurrentUser();
  const { logoUrl, logoDarkUrl, isDark, accentColor } = useTheme();

  /* ── Protección de ruta ──────────────────────────────────────── */
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === "tenant") { router.replace("/portal/dashboard"); return; }
  }, [loading, user, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const displayLogo = isDark ? (logoDarkUrl || logoUrl) : logoUrl;

  if (loading || !user || user.role === "tenant") return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100dvh",
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Header fijo ────────────────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          zIndex: 100,
          background: "var(--bg-topbar)",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          gap: 12,
        }}
      >
        {/* Logo / nombre */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {displayLogo ? (
            <img
              src={displayLogo}
              alt="Logo"
              style={{ height: 32, maxWidth: 120, objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: accentColor || "var(--accent)",
                letterSpacing: "-0.3px",
              }}
            >
              PropAdmin
            </span>
          )}
        </div>

        {/* Usuario + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.full_name || user.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border-default)",
              background: "var(--bg-page)",
              color: "var(--text-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Contenido con scroll ────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          paddingTop: 56,
          paddingBottom: 72,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>

      {/* ── Bottom navigation ──────────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 100,
          background: "var(--bg-topbar)",
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: isActive ? (accentColor || "var(--accent)") : "var(--text-muted)",
                borderTop: isActive
                  ? `2px solid ${accentColor || "var(--accent)"}`
                  : "2px solid transparent",
                background: isActive ? "var(--bg-card-hover)" : "transparent",
                transition: "color 0.15s",
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
