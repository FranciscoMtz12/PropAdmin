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
import { useSwipeable } from "react-swipeable";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
  BadgeCheck,
  BarChart2,
  Building2,
  CalendarDays,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  User2,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme, initials } from "@/contexts/ThemeContext";
import { useIconSize } from "@/lib/useFontScale";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useNotifications } from "@/app/hooks/useNotifications";
import { SEVERITY_COLORS } from "@/lib/notifications";
import type { NotificationModule } from "@/lib/notifications";

type SidebarItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<any>;
  disabled?: boolean;
  notifModules?: NotificationModule[];
};

type NavSection = {
  label: string;
  items: SidebarItem[];
};

const SAPROA_ACCENT = "#6366F1";

/* ─── SAPROA Admin sections (superadmin sin impersonar) ─────────── */

const SAPROA_SECTIONS: NavSection[] = [
  {
    label: "PLATAFORMA",
    items: [
      { label: "Overview",  href: "/saproa-admin/overview",  icon: LayoutDashboard },
      { label: "Empresas",  href: "/saproa-admin/empresas",  icon: Building2       },
      { label: "Usuarios",  href: "/saproa-admin/usuarios",  icon: Users           },
    ],
  },
  {
    label: "DEVELOPER",
    items: [
      { label: "Impersonar", href: "/saproa-admin/impersonar", icon: Eye          },
      { label: "Roadmap",    href: "/saproa-admin/roadmap",    icon: FileText     },
      { label: "Sandbox",    href: "#",                        icon: Sparkles, disabled: true },
    ],
  },
  {
    label: "SOPORTE",
    items: [
      { label: "Feedback", href: "/saproa-admin/feedback", icon: MessageSquare },
      { label: "Sistema",  href: "/saproa-admin/sistema",  icon: Settings      },
    ],
  },
];

/* ─── Admin sections ─────────────────────────────────────────────── */

const ALL_ADMIN_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, notifModules: ["cobranza", "servicios", "unidades", "contratos", "mantenimiento", "propiedades", "compras", "pagos", "configuracion"] },
    ],
  },
  {
    label: "GENERAL",
    items: [
      { label: "Propiedades", href: "/buildings", icon: Building2,    notifModules: ["unidades", "propiedades", "servicios", "contratos"] },
      { label: "Analytics",  href: "/analytics", icon: BarChart2 },
      { label: "Calendario", href: "/calendar",  icon: CalendarDays },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      { label: "Servicios",  href: "/servicios",   icon: Layers,     notifModules: ["servicios"] },
      { label: "Pagos",      href: "/payments",    icon: CreditCard, notifModules: ["pagos"] },
      { label: "Cobranza",   href: "/collections", icon: DollarSign, notifModules: ["cobranza", "contratos"] },
      { label: "Inquilinos", href: "/tenants",     icon: Users },
    ],
  },
  {
    label: "COMPRAS",
    items: [
      { label: "Compras",     href: "/purchases", icon: ShoppingCart, notifModules: ["compras"] },
      { label: "Proveedores", href: "/suppliers", icon: Truck },
    ],
  },
  {
    label: "MANTENIMIENTO",
    items: [
      { label: "Mantenimiento", href: "/maintenance", icon: Wrench,   notifModules: ["mantenimiento"] },
      { label: "Limpieza",      href: "/cleaning",    icon: Sparkles },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { label: "Ajustes del sistema", href: "/settings",  icon: Settings, notifModules: ["configuracion"] },
      { label: "Feedback",      href: "/feedback",   icon: MessageSquare },
    ],
  },
];

const TENANT_ITEMS: SidebarItem[] = [
  { label: "Dashboard",              href: "/portal/dashboard",      icon: User2      },
  { label: "Mi contrato",            href: "/portal/contract",       icon: KeyRound   },
  { label: "Mis facturas / adeudos", href: "/portal/invoices",       icon: FileText   },
  { label: "Reportar pago",          href: "/portal/report-payment", icon: CreditCard },
  { label: "Renovación de contrato", href: "/portal/renewal",        icon: BadgeCheck },
];

const FIELD_ITEMS: SidebarItem[] = [
  { href: "/campo/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campo/tickets",   label: "Tickets",   icon: Wrench          },
  { href: "/campo/limpieza",  label: "Limpieza",  icon: Sparkles        },
  { href: "/campo/assets",    label: "Equipamiento",    icon: Package         },
  { href: "/campo/medidores", label: "Medidores", icon: Zap             },
];

/* ─── Role-based section filtering ──────────────────────────────── */

const ROLE_ALLOWED: Record<string, string[]> = {
  titular:        ["/dashboard", "/buildings", "/analytics", "/servicios", "/payments", "/cobranza", "/collections", "/tenants", "/purchases", "/suppliers", "/maintenance", "/cleaning", "/settings"],
  administracion: ["/dashboard", "/buildings", "/servicios", "/payments", "/cobranza", "/collections", "/tenants"],
  directivo:      ["/dashboard", "/buildings", "/analytics", "/cobranza", "/collections", "/tenants"],
  compras:        ["/dashboard", "/purchases", "/suppliers"],
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
  notifBadge,
}: {
  item: SidebarItem;
  pathname: string;
  accentColor: string;
  previewTenantId?: string | null;
  notifBadge?: { count: number; severity: 'critical' | 'warning' | 'brand' | 'info' } | null;
}) {
  const Icon = item.icon;
  const navIconSz = useIconSize(17);
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
    borderRadius: "var(--border-radius-md, 12px)",
    textDecoration: "none",
    background: active ? "rgba(255,255,255,0.10)" : "transparent",
    borderLeft: active ? `3px solid ${accentColor}` : "3px solid transparent",
    transition: "all 0.15s ease",
    cursor: item.disabled ? "default" : "pointer",
  };

  const leftBlock = (
    <div className="sidebar-nav-item-left" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
      <Icon
        size={navIconSz}
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
          fontSize: "0.875rem",
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

  const badgeColor = (notifBadge?.severity === 'brand' || notifBadge?.severity === 'info') ? accentColor : notifBadge ? SEVERITY_COLORS[notifBadge.severity].dot : '';
  const rightBlock = notifBadge ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 999,
        background: "transparent",
        border: `1.5px solid ${badgeColor}`,
        fontSize: "0.6875rem",
        fontWeight: 700,
        color: badgeColor,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {notifBadge.count}
    </span>
  ) : null;

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
            fontSize: "0.75rem",
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
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const swipeOpenHandlers = useSwipeable({
    onSwipedRight: () => setMobileOpen(true),
    delta: 30,
    trackTouch: true,
    trackMouse: false,
    preventScrollOnSwipe: false,
    swipeDuration: 300,
  });

  const swipeCloseHandlers = useSwipeable({
    onSwipedLeft: () => setMobileOpen(false),
    delta: 30,
    trackTouch: true,
    trackMouse: false,
    preventScrollOnSwipe: false,
    swipeDuration: 300,
  });

  // Attach swipe-open listener to document.body (no covering div → no tap blocking)
  const { ref: attachSwipeOpen } = swipeOpenHandlers;
  useEffect(() => {
    if (!isMobile || mobileOpen) {
      attachSwipeOpen(null);
      return;
    }
    attachSwipeOpen(document.body);
    return () => attachSwipeOpen(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, mobileOpen]);
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { accentColor, groupColor, logoUrl, logoDarkUrl, shortName, platformName } = useTheme();
  const { impersonationMode, isRealSuperAdmin, isImpersonating } = useImpersonation();
  const footerIconSz = useIconSize(15);
  const shieldIconSz = useIconSize(18);

  /* Modo SAPROA Control Center: superadmin real SIN impersonar ninguna empresa */
  const isSaproaMode = isRealSuperAdmin && !isImpersonating;
  const { moduleStats } = useNotifications(user?.company_id ?? null, !!user && !isSaproaMode);

  const isPortalPath = pathname?.startsWith("/portal") ?? false;
  const isHiddenRoute =
    pathname === "/login" || pathname === "/portal/login" || pathname === "/" ||
    (pathname?.startsWith("/campo") ?? false);

  const previewTenantId = searchParams.get("tenantId");
  const isSuperAdmin = user?.role === "superadmin" || Boolean(user?.is_superadmin);
  const isField = user?.role === "field";

  const activeSections: NavSection[] = (() => {
    if (isSaproaMode) return SAPROA_SECTIONS;
    if (isSuperAdmin) return ALL_ADMIN_SECTIONS;
    // titular / group_admin: todo excepto /feedback (panel superadmin)
    if (user?.role === "titular" || user?.role === "group_admin") {
      const TITULAR_DENIED = ["/feedback"];
      return ALL_ADMIN_SECTIONS
        .map(section => ({
          ...section,
          items: section.items.filter(item => !TITULAR_DENIED.some(d => item.href?.startsWith(d))),
        }))
        .filter(section => section.items.length > 0);
    }
    const allowed = ROLE_ALLOWED[user?.role ?? ""] ?? ["/dashboard"];
    return filterSections(ALL_ADMIN_SECTIONS, allowed);
  })();

  function getItemBadge(item: SidebarItem) {
    if (!item.notifModules?.length) return null;
    const relevant = moduleStats.filter(s => item.notifModules!.includes(s.module));
    if (relevant.length === 0) return null;
    const count = relevant.reduce((sum, s) => sum + s.count, 0);
    const severity = relevant.some(s => s.severity === 'critical') ? 'critical'
                   : relevant.some(s => s.severity === 'warning')  ? 'warning'
                   : relevant.some(s => s.severity === 'brand')    ? 'brand'
                   : 'info';
    return { count, severity } as { count: number; severity: 'critical' | 'warning' | 'brand' | 'info' };
  }

  if (isHiddenRoute) return null;

  async function handleLogout() {
    document.documentElement.style.setProperty('--font-scale', '1');
    await supabase.auth.signOut();
    router.push("/");
  }

  const sidebarTitle = isSaproaMode
    ? "Control center"
    : impersonationMode === "group"
      ? "Vista consolidada"
      : isPortalPath
        ? "Portal del inquilino"
        : "Gestión de Propiedades";

  const sessionName = user?.full_name || (isPortalPath ? "Inquilino" : "Sin sesión");
  const sessionEmail = user?.email || "No autenticado";

  const sidebarBg = "var(--bg-sidebar)";
  const activeLogo = logoDarkUrl ?? logoUrl;
  /* Superadmin sin company_id usa el nombre de la plataforma SAPROA */
  const displayName = (isSuperAdmin && !user?.company_id) ? platformName : shortName;
  const logoInitials = initials(displayName);
  const activeAccent = isSaproaMode ? SAPROA_ACCENT : accentColor;

  return (
    <>
    {/* Overlay móvil — captura swipe izquierda para cerrar */}
    {mobileOpen && (
      <div
        {...swipeCloseHandlers}
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
        background: activeAccent,
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
        borderRadius: "var(--sidebar-radius)",
        boxShadow: "var(--card-shadow)",
        transition: "background 0.2s, border-radius 0.3s, box-shadow 0.3s",
      }}
    >
      {/* ── Barra de acento superior (3px) ──────────────────────── */}
      <div style={{ height: 3, background: activeAccent, flexShrink: 0, transition: "background 0.3s" }} />

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
          <div style={{ height: 56, display: "flex", justifyContent: "center", alignItems: "center", width: "100%", padding: "16px 0" }}>
            <Link
              href="/home"
              style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0, minHeight: 44, minWidth: 44, justifyContent: "center" }}
            >
              {isSaproaMode ? (
                activeLogo ? (
                  <img
                    src={activeLogo}
                    alt="SAPROA"
                    style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }}
                  />
                ) : (
                  /* Fallback SAPROA: círculo índigo con inicial "S" */
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: "var(--border-radius-md, 10px)",
                      background: SAPROA_ACCENT,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: "1.25rem", color: "#ffffff",
                      letterSpacing: "-0.02em", flexShrink: 0,
                    }}
                  >
                    S
                  </div>
                )
              ) : activeLogo ? (
                <img
                  src={activeLogo}
                  alt={shortName}
                  style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 38, height: 38, borderRadius: "var(--border-radius-md, 10px)",
                    background: accentColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "0.875rem", color: "#ffffff",
                    letterSpacing: "0.04em", flexShrink: 0, transition: "background 0.3s",
                  }}
                >
                  {logoInitials}
                </div>
              )}
            </Link>
          </div>

          {/* Separador debajo del logo */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "-10px 0 0" }} />

          {/* ── Navegación ───────────────────────────────────────── */}
          {isField ? (
            <SidebarSection
              title=""
              items={FIELD_ITEMS}
              pathname={pathname}
              accentColor={activeAccent}
            />
          ) : isPortalPath ? (
            <SidebarSection
              title="Portal"
              items={TENANT_ITEMS}
              pathname={pathname}
              previewTenantId={previewTenantId}
              accentColor={activeAccent}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeSections.map((section, idx) => (
                <div key={idx}>
                  {section.label && (isSuperAdmin || isSaproaMode || user?.role === "group_admin") && (
                    <div style={{ padding: "12px 4px 4px" }}>
                      <span
                        style={{
                          fontSize: "0.625rem",
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
                        accentColor={activeAccent}
                        notifBadge={getItemBadge(item)}
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
            <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
              Sesión actual
            </span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#FFFFFF" }}>{sessionName}</span>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.58)" }}>{sessionEmail}</span>
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
                  fontSize: "0.6875rem",
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
            onClick={() => router.push("/settings")}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
              minHeight: 44, padding: "10px 12px", borderRadius: "var(--border-radius-md, 12px)",
              border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
              color: "#FFFFFF", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer",
            }}
          >
            <Settings size={footerIconSz} />
            <span className="sidebar-footer-text">Ajustes</span>
          </button>

          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
              minHeight: 44, padding: "10px 12px", borderRadius: "var(--border-radius-md, 12px)",
              border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
              color: "#FFFFFF", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer",
            }}
          >
            <LogOut size={footerIconSz} />
            <span className="sidebar-footer-text">Cerrar sesión</span>
          </button>
        </div>
      </div>

    </aside>
    </>
  );
}
