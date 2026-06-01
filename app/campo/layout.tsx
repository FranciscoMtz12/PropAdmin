"use client";

/*
  Layout del portal de campo — sidebar expandible tipo app móvil.

  Estructura:
  - Header fijo (56px): hamburger izquierda · logo centro · nombre derecha
  - Sidebar overlay: desliza desde la izquierda, contiene logo, usuario,
    nav links, ajustes y logout
  - Contenido: ocupa el resto de la pantalla con scroll
  - SettingsModal: portal al body cuando se abre desde el sidebar

  Protección de rutas: solo admin.
  Redirige a /login si no hay sesión o si el usuario es tenant.
*/

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grid2X2, LogOut, Menu, Settings, ShoppingCart, Sparkles, Ticket, Wrench, X, Zap } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import SettingsModal from "@/components/SettingsModal";
import BgTexture from "@/components/BgTexture";

const NAV_ITEMS = [
  { href: "/campo/dashboard",  label: "Inicio",     icon: Grid2X2     },
  { href: "/campo/tickets",    label: "Tickets",    icon: Wrench      },
  { href: "/campo/limpieza",   label: "Limpieza",   icon: Sparkles    },
  { href: "/campo/medidores",  label: "Medidores",  icon: Zap         },
  { href: "/campo/assets",     label: "Activos",    icon: Ticket      },
  { href: "/campo/compras",    label: "Órdenes",    icon: ShoppingCart },
];

export default function CampoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, loading }                            = useCurrentUser();
  const { logoUrl, logoDarkUrl, isDark, accentColor } = useTheme();

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ── Protección de ruta ──────────────────────────────────────── */
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    const role = user.role;
    if (role === "tenant") { router.replace("/portal/dashboard"); return; }
    if (role !== "field" && role !== "mantenimiento" && !user.is_superadmin) { router.replace("/dashboard"); return; }
  }, [loading, user, router]);

  /* ── Bloquear scroll del body cuando el sidebar está abierto ─── */
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  /* ── Cerrar sidebar al cambiar de ruta ──────────────────────── */
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  async function handleLogout() {
    setSidebarOpen(false);
    await supabase.auth.signOut();
    router.replace("/");
  }

  const displayLogo = isDark ? (logoDarkUrl || logoUrl) : logoUrl;
  const accent      = accentColor || "var(--accent)";
  const accentBg    = accentColor ? `${accentColor}22` : "var(--accent-tint-soft)";

  if (loading || !user || user.role === "tenant" || (user.role !== "field" && user.role !== "mantenimiento" && !user.is_superadmin)) return null;

  return (
    <>
      <BgTexture />
      <div
        style={{
          position: "relative",
          zIndex: 1,
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
            top: 0, left: 0, right: 0,
            height: 56,
            zIndex: 100,
            background: "var(--bg-topbar)",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 12,
          }}
        >
          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "var(--border-radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-page)", color: "var(--text-muted)",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <Menu size={18} />
          </button>

          {/* Logo — centro */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {displayLogo ? (
              <img src={displayLogo} alt="Logo" style={{ height: 30, maxWidth: 120, objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: accent, letterSpacing: "-0.3px" }}>
                PropAdmin Campo
              </span>
            )}
          </div>

          {/* Nombre (primer nombre) */}
          <div style={{ flexShrink: 0, maxWidth: 90 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {(user.full_name || user.email || "").split(" ")[0]}
            </span>
          </div>
        </header>

        {/* ── Contenido con scroll ────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            paddingTop: 56,
            paddingBottom: 24,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>

      {/* ── Backdrop ────────────────────────────────────────────── */}
      <div
        onClick={() => setSidebarOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(1px)",
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* ── Sidebar panel ───────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          zIndex: 201,
          width: 280,
          background: "var(--bg-sidebar)",
          display: "flex",
          flexDirection: "column",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          overflowY: "auto",
          boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.3)" : "none",
        }}
      >
        {/* Logo + cerrar */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {displayLogo ? (
            <img src={displayLogo} alt="Logo" style={{ height: 32, maxWidth: 130, objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
              PropAdmin
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--border-radius-md)", border: "none", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Usuario */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: "var(--border-radius-lg)",
              background: accent, display: "flex", alignItems: "center",
              justifyContent: "center", marginBottom: 10,
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>
              {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <p style={{ margin: "0 0 2px", fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>
            {user.full_name || "Usuario"}
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", wordBreak: "break-all" }}>
            {user.email}
          </p>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "12px" }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: "var(--border-radius-lg)",
                  marginBottom: 4,
                  textDecoration: "none",
                  background: isActive ? accentBg : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.875rem",
                  borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: ajustes + logout */}
        <div style={{ padding: "12px 12px 32px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 2 }}>
          <button
            type="button"
            onClick={() => { setSidebarOpen(false); setSettingsOpen(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: "var(--border-radius-lg)",
              border: "none", background: "transparent",
              color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", fontWeight: 500,
              cursor: "pointer", textAlign: "left", width: "100%",
            }}
          >
            <Settings size={18} strokeWidth={1.8} />
            Ajustes
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: "var(--border-radius-lg)",
              border: "none", background: "transparent",
              color: "rgba(248,113,113,0.9)", fontSize: "0.875rem", fontWeight: 500,
              cursor: "pointer", textAlign: "left", width: "100%",
            }}
          >
            <LogOut size={18} strokeWidth={1.8} />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* ── Settings Modal ───────────────────────────────────────── */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
