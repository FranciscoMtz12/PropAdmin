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

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleAlert,
  CircleX,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  LogOut,
  Moon,
  ReceiptText,
  Sparkles,
  Sun,
  User2,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

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

const ADMIN_ITEMS: SidebarItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, status: "done" },
  { label: "Calendario", href: "/calendar", icon: CalendarDays, status: "done" },
  { label: "Pagos", href: "/payments", icon: ReceiptText, status: "done" },
  { label: "Cobranza", href: "/collections", icon: Wallet, status: "partial" },
  { label: "Edificios", href: "/buildings", icon: Building2, status: "done" },
  { label: "Inquilinos", href: "/tenants", icon: Users, status: "done" },
  { label: "Limpieza", href: "/cleaning", icon: Sparkles, status: "partial" },
  { label: "Mantenimiento", href: "/maintenance", icon: Wrench, status: "done" },
];

const TENANT_ITEMS: SidebarItem[] = [
  { label: "Dashboard", href: "/portal/dashboard", icon: User2, status: "partial" },
  { label: "Mi contrato", href: "/portal/contract", icon: KeyRound, status: "partial" },
  { label: "Mis facturas / adeudos", href: "/portal/invoices", icon: FileText, status: "partial" },
  { label: "Reportar pago", href: "/portal/report-payment", icon: CreditCard, status: "partial" },
  { label: "Renovación de contrato", href: "/portal/renewal", icon: BadgeCheck, status: "partial" },
];

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

/* ─── SidebarSection ─────────────────────────────────────────────── */

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
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 800,
          padding: "0 4px",
        }}
      >
        {title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item) => {
          const Icon = item.icon;
          const statusVisual = getStatusVisual(item.status);
          const StatusIcon = statusVisual.icon;
          const resolvedHref =
            item.href && !item.disabled
              ? appendTenantPreviewToHref(item.href, previewTenantId)
              : undefined;
          const active = isItemActive(pathname, item.href);

          /*
            Ítem activo: borde izquierdo 3px con --accent + fondo sutil.
            Ítem inactivo: sin borde, sin fondo.
          */
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
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
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
              title={statusVisual.label}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <StatusIcon size={15} color={statusVisual.color} />
            </div>
          );

          if (resolvedHref) {
            return (
              <Link key={`${title}-${item.label}`} href={resolvedHref} style={commonStyle}>
                {leftBlock}
                {rightBlock}
              </Link>
            );
          }

          return (
            <div
              key={`${title}-${item.label}`}
              style={{ ...commonStyle, opacity: 0.7 }}
            >
              {leftBlock}
              {rightBlock}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Sidebar principal ──────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { accentColor, logoUrl, logoDarkUrl, shortName, isDark, toggleDark } = useTheme();

  const isPortalPath = pathname?.startsWith("/portal") ?? false;
  const isHiddenRoute =
    pathname === "/login" || pathname === "/portal/login" || pathname === "/";

  const previewTenantId = searchParams.get("tenantId");
  const isSuperAdmin = user?.role === "admin" && Boolean(user.is_superadmin);

  if (isHiddenRoute) return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(isPortalPath ? "/portal/login" : "/login");
  }

  const sidebarTitle = isSuperAdmin
    ? "Control total del sistema"
    : isPortalPath
      ? "Portal del inquilino"
      : "Gestión de Propiedades";

  const sessionName = user?.full_name || (isPortalPath ? "Inquilino" : "Sin sesión");
  const sessionEmail = user?.email || "No autenticado";

  /* Fondo del sidebar: siempre oscuro, más profundo en dark mode */
  const sidebarBg = isDark ? "#0f1623" : "#1e2a3a";

  /*
    Logo en el sidebar: el fondo siempre es oscuro, por lo que siempre
    necesitamos la versión clara del logo (logo_dark_url).
    Fallback: logo_url → iniciales con fondo --accent.
  */
  const activeLogo = logoDarkUrl ?? logoUrl;
  const logoInitials = initials(shortName);

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        height: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
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
      <div
        style={{
          height: 3,
          background: accentColor,
          flexShrink: 0,
          transition: "background 0.3s",
        }}
      />

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
          <div
            style={{
              height: 56,
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 4,
            }}
          >
            {activeLogo ? (
              /* Logo de la empresa — versión clara (dark url) para fondo oscuro del sidebar */
              <img
                src={activeLogo}
                alt={shortName}
                style={{
                  height: 36,
                  width: "auto",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            ) : (
              /* Fallback: iniciales con fondo de acento */
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: accentColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 14,
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                  transition: "background 0.3s",
                }}
              >
                {logoInitials}
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shortName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.52)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sidebarTitle}
              </div>
            </div>
          </div>

          {/* Separador debajo del logo */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "-10px 0 0" }} />

          {/* ── Secciones de navegación ──────────────────────────── */}
          {isSuperAdmin ? (
            <>
              <SidebarSection
                title="Administración"
                items={ADMIN_ITEMS}
                pathname={pathname}
                accentColor={accentColor}
              />
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
              <SidebarSection
                title="Vista portal"
                items={TENANT_ITEMS}
                pathname={pathname}
                previewTenantId={previewTenantId}
                accentColor={accentColor}
              />
              {previewTenantId ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.75)",
                    lineHeight: 1.5,
                  }}
                >
                  Vista previa activa:
                  <div style={{ marginTop: 4, fontWeight: 700, color: "#FFFFFF", wordBreak: "break-word" }}>
                    {previewTenantId}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.68)",
                    lineHeight: 1.5,
                  }}
                >
                  Entra al portal y elige un tenant para vista previa sin perder el acceso al sistema.
                </div>
              )}
            </>
          ) : isPortalPath ? (
            <SidebarSection
              title="Portal"
              items={TENANT_ITEMS}
              pathname={pathname}
              previewTenantId={previewTenantId}
              accentColor={accentColor}
            />
          ) : (
            <SidebarSection
              title="Administración"
              items={ADMIN_ITEMS}
              pathname={pathname}
              accentColor={accentColor}
            />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.50)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 700,
              }}
            >
              Sesión actual
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
              {sessionName}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>
              {sessionEmail}
            </span>
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

          {/* Toggle dark/light mode */}
          <button
            type="button"
            onClick={toggleDark}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.78)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? "Modo claro" : "Modo oscuro"}
          </button>

          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
