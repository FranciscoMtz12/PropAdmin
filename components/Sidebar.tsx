"use client";

/*
  Sidebar global de PropAdmin.

  Cambios de theming:
  - Barra de acento (3px) en la parte superior con color --accent
  - Área de logo (56px): muestra logo_url / logo_dark_url o iniciales del short_name
  - Ítem activo: barra izquierda 3px --accent + fondo sutil (sin borde blanco previo)
  - Botón de toggle dark/light al fondo del sidebar (ícono Sol/Luna)
  - Fondo: #0f1623 en dark mode, #1e2a3a en light mode
*/

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
  BadgeCheck,
  BarChart2,
  Building2,
  CalendarDays,
  CircleAlert,
  CircleX,
  CreditCard,
  DollarSign,
  FileText,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Sun,
  Truck,
  User2,
  UserCog,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme, initials } from "@/contexts/ThemeContext";

type NavStatus = "done" | "partial" | "pending";

type SidebarItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<any>;
  status: NavStatus;
  disabled?: boolean;
};

type NavSection = {
  label: string;
  items: SidebarItem[];
};

/* ─── Admin sections ─────────────────────────────────────────────── */

const ALL_ADMIN_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, status: "done" },
    ],
  },
  {
    label: "GENERAL",
    items: [
      { label: "Edificios",  href: "/buildings", icon: Building2,    status: "done" },
      { label: "Analytics",  href: "/analytics", icon: BarChart2,    status: "done" },
      { label: "Calendario", href: "/calendar",  icon: CalendarDays, status: "done" },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      { label: "Servicios",  href: "/servicios", icon: Layers,       status: "done" },
      { label: "Pagos",      href: "/payments",  icon: CreditCard,   status: "done" },
      { label: "Cobranza",   href: "/cobranza",  icon: DollarSign,   status: "done" },
      { label: "Inquilinos", href: "/tenants",   icon: Users,        status: "done" },
    ],
  },
  {
    label: "COMPRAS",
    items: [
      { label: "Compras",      href: "/compras",   icon: ShoppingCart, status: "done" },
      { label: "Proveedores",  href: "/suppliers", icon: Truck,        status: "done" },
    ],
  },
  {
    label: "MANTENIMIENTO",
    items: [
      { label: "Mantenimiento", href: "/maintenance", icon: Wrench,   status: "done" },
      { label: "Limpieza",      href: "/cleaning",    icon: Sparkles, status: "done" },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { label: "Usuarios",  href: "/users",    icon: UserCog,      status: "done" },
      { label: "Feedback",  href: "/feedback", icon: MessageSquare, status: "done" },
    ],
  },
];

const TENANT_ITEMS: SidebarItem[] = [
  { label: "Dashboard",              href: "/portal/dashboard",       icon: User2,      status: "partial" },
  { label: "Mi contrato",            href: "/portal/contract",        icon: KeyRound,   status: "partial" },
  { label: "Mis facturas / adeudos", href: "/portal/invoices",        icon: FileText,   status: "partial" },
  { label: "Reportar pago",          href: "/portal/report-payment",  icon: CreditCard, status: "partial" },
  { label: "Renovación de contrato", href: "/portal/renewal",         icon: BadgeCheck, status: "partial" },
];

const FIELD_ITEMS: SidebarItem[] = [
  { href: "/campo/dashboard",  label: "Dashboard",  icon: LayoutDashboard, status: "done" },
  { href: "/campo/tickets",    label: "Tickets",    icon: Wrench,          status: "done" },
  { href: "/campo/limpieza",   label: "Limpieza",   icon: Sparkles,        status: "done" },
  { href: "/campo/assets",     label: "Assets",     icon: Package,         status: "done" },
  { href: "/campo/medidores",  label: "Medidores",  icon: Zap,             status: "done" },
];

/* ─── Role-based section filtering ──────────────────────────────── */

const ROLE_ALLOWED: Record<string, string[]> = {
  administracion: ["/dashboard", "/buildings", "/servicios", "/payments", "/cobranza", "/collections", "/tenants"],
  directivo:      ["/dashboard", "/buildings", "/analytics", "/cobranza", "/collections", "/tenants"],
  compras:        ["/dashboard", "/compras", "/purchases", "/suppliers"],
  mantenimiento:  ["/dashboard", "/maintenance", "/cleaning"],
};

function filterSections(sections: NavSection[], allowedPrefixes: string[]): NavSection[] {
  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(
        item => item.href && allowedPrefixes.some(p => item.href!.startsWith(p)),
      ),
    }))
    .filter(section => section.items.length > 0);
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function getStatusVisual(status: NavStatus) {
  if (status === "done") return { icon: BadgeCheck, color: "#22C55E", label: "Listo" };
  if (status === "partial") return { icon: CircleAlert, color: "#F59E0B", label: "Parcial" };
  return { icon: CircleX, color: "#F87171", label: "Pendiente" };
}

function appendTenantPreviewToHref(href: string, tenantId?: string | null) {
  if (!tenantId) return href;
  if (!href.startsWith("/portal")) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}tenantId=${encodeURIComponent(tenantId)}`;
}

function isItemActive(pathname: string, itemHref?: string) {
  if (!itemHref) return false;
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

/* ─── NavItem ────────────────────────────────────────────────────── */

function NavItem({
  item,
  pathname,
  accentColor,
  previewTenantId,
}: {
  item: SidebarItem;
  pathname: string;
  accentColor: string;
  previewTenantId?: string | null;
}) {
  const Icon = item.icon;
  const statusVisual = getStatusVisual(item.status);
  const StatusIcon = statusVisual.icon;
  const resolvedHref =
    item.href && !item.disabled
      ? appendTenantPreviewToHref(item.href, previewTenantId)
      : undefined;
  const active = isItemActive(pathname, item.href);

  const commonStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "11px 14px 11px 11px",
    borderRadius: 12,
    textDecoration: "none",
    background: active ? "rgba(255,255,255,0.10)" : "transparent",
    borderLeft: active ? `3px solid ${accentColor}` : "3px solid transparent",
    transition: "all 0.15s ease",
    cursor: item.disabled ? "default" : "pointer",
  };

  const leftBlock = (
    <div className="sidebar-nav-item-left" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
      <Icon
        size={17}
        color={
          item.disabled
            ? "rgba(255,255,255,0.35)"
            : active
              ? "#ffffff"
              : "rgba(255,255,255,0.80)"
        }
      />
      <span
        className="sidebar-nav-label"
        style={{
          color: item.disabled
            ? "rgba(255,255,255,0.45)"
            : active
              ? "#ffffff"
              : "rgba(255,255,255,0.82)",
          fontSize: 14,
          fontWeight: active ? 700 : 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.label}
      </span>
    </div>
  );

  const rightBlock = (
    <div
      className="sidebar-nav-status"
      title={statusVisual.label}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <StatusIcon size={15} color={statusVisual.color} />
    </div>
  );

  if (resolvedHref) {
    return (
      <Link href={resolvedHref} style={commonStyle}>
        {leftBlock}
        {rightBlock}
      </Link>
    );
  }

  return (
    <div style={{ ...commonStyle, opacity: 0.7 }}>
      {leftBlock}
      {rightBlock}
    </div>
  );
}

/* ─── SidebarSection (portal / field) ───────────────────────────── */

function SidebarSection({
  title,
  items,
  pathname,
  previewTenantId,
  accentColor,
}: {
  title: string;
  items: SidebarItem[];
  pathname: string;
  previewTenantId?: string | null;
  accentColor: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {title && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 800,
            padding: "0 4px",
          }}
          className="sidebar-section-title"
        >
          {title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map(item => (
          <NavItem
            key={item.href ?? item.label}
            item={item}
            pathname={pathname}
            accentColor={accentColor}
            previewTenantId={previewTenantId}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Sidebar principal ──────────────────────────────────────────── */

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { accentColor, logoUrl, logoDarkUrl, shortName, isDark, toggleDark } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isPortalPath = pathname?.startsWith("/portal") ?? false;
  const isHiddenRoute =
    pathname === "/login" || pathname === "/portal/login" || pathname === "/" ||
    (pathname?.startsWith("/campo") ?? false);

  const previewTenantId = searchParams.get("tenantId");
  const isSuperAdmin = user?.role === "superadmin" || Boolean(user?.is_superadmin);
  const isField = user?.role === "field";

  const activeSections: NavSection[] = (() => {
    if (isSuperAdmin) return ALL_ADMIN_SECTIONS;
    const allowed = ROLE_ALLOWED[user?.role ?? ""] ?? ["/dashboard"];
    return filterSections(ALL_ADMIN_SECTIONS, allowed);
  })();

  if (isHiddenRoute) return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const sidebarTitle = isSuperAdmin
    ? "Control total del sistema"
    : isPortalPath
      ? "Portal del inquilino"
      : "Gestión de Propiedades";

  const sessionName = user?.full_name || (isPortalPath ? "Inquilino" : "Sin sesión");
  const sessionEmail = user?.email || "No autenticado";

  const sidebarBg = isDark ? "#0f1623" : "#1e2a3a";
  const activeLogo = logoDarkUrl ?? logoUrl;
  const logoInitials = initials(shortName);

  return (
    <>
    {/* Overlay móvil */}
    {mobileOpen && (
      <div
        onClick={() => setMobileOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          zIndex: 40,
          display: "block",
        }}
      />
    )}
    {/* Botón hamburger móvil */}
    <button
      type="button"
      onClick={() => setMobileOpen((o) => !o)}
      className="sidebar-hamburger"
      aria-label="Menú"
      style={{
        display: "none",
        position: "fixed",
        top: "1rem",
        left: "1rem",
        zIndex: 50,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: accentColor,
        border: "none",
        cursor: "pointer",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,.35)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        {mobileOpen ? (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        ) : (
          <>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </>
        )}
      </svg>
    </button>
    <aside
      className={mobileOpen ? "sidebar-open" : ""}
      style={{
        width: 280,
        minWidth: 280,
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
        overflowY: "auto",
        background: sidebarBg,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "background 0.2s",
      }}
    >
      {/* ── Barra de acento superior (3px) ──────────────────────── */}
      <div style={{ height: 3, background: accentColor, flexShrink: 0, transition: "background 0.3s" }} />

      {/* ── Área scrollable ──────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "0 16px 16px",
          overflowY: "auto",
          gap: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ── Área de logo (altura fija 56px) ─────────────────── */}
          <div style={{ height: 56, display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            {activeLogo ? (
              <img
                src={activeLogo}
                alt={shortName}
                style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: accentColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14, color: "#ffffff",
                  letterSpacing: "0.04em", flexShrink: 0, transition: "background 0.3s",
                }}
              >
                {logoInitials}
              </div>
            )}
            <div className="sidebar-logo-text" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {shortName}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.52)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sidebarTitle}
              </div>
            </div>
          </div>

          {/* Separador debajo del logo */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "-10px 0 0" }} />

          {/* ── Navegación ───────────────────────────────────────── */}
          {isField ? (
            <SidebarSection
              title=""
              items={FIELD_ITEMS}
              pathname={pathname}
              accentColor={accentColor}
            />
          ) : isPortalPath ? (
            <SidebarSection
              title="Portal"
              items={TENANT_ITEMS}
              pathname={pathname}
              previewTenantId={previewTenantId}
              accentColor={accentColor}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeSections.map((section, idx) => (
                <div key={idx}>
                  {section.label && isSuperAdmin && (
                    <div style={{ padding: "12px 4px 4px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.10em",
                          color: "rgba(255,255,255,0.38)",
                          textTransform: "uppercase",
                        }}
                      >
                        {section.label}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: section.label ? 4 : 0 }}>
                    {section.items.map(item => (
                      <NavItem
                        key={item.href ?? item.label}
                        item={item}
                        pathname={pathname}
                        accentColor={accentColor}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Parte inferior: sesión + toggle + logout ─────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            marginTop: 16,
          }}
        >
          {/* Datos de sesión */}
          <div className="sidebar-user-info" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
              Sesión actual
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{sessionName}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>{sessionEmail}</span>
            {isSuperAdmin && (
              <span
                style={{
                  marginTop: 6,
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  padding: "4px 9px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.14)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  color: "#86EFAC",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                }}
              >
                SUPERADMIN
              </span>
            )}
          </div>

          {/* Ajustes */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.78)", fontWeight: 600, fontSize: 13, cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <Settings size={15} />
            <span className="sidebar-footer-text">Ajustes</span>
          </button>

          {/* Toggle dark/light mode */}
          <button
            type="button"
            onClick={toggleDark}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.78)", fontWeight: 600, fontSize: 13, cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            <span className="sidebar-footer-text">{isDark ? "Modo claro" : "Modo oscuro"}</span>
          </button>

          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
              padding: "10px 12px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
              color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            <LogOut size={15} />
            <span className="sidebar-footer-text">Cerrar sesión</span>
          </button>
        </div>
      </div>

      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </aside>
    </>
  );
}
