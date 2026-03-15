"use client";

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
  ReceiptText,
  Sparkles,
  User2,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

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
  {
    label: "Dashboard",
    href: "/portal/dashboard",
    icon: User2,
    status: "partial",
  },
  {
    label: "Mi contrato",
    href: "/portal/contract",
    icon: KeyRound,
    status: "pending",
    disabled: true,
  },
  {
    label: "Mis facturas / adeudos",
    href: "/portal/invoices",
    icon: FileText,
    status: "partial",
  },
  {
    label: "Reportar pago",
    href: "/portal/report-payment",
    icon: CreditCard,
    status: "pending",
    disabled: true,
  },
  {
    label: "Renovación de contrato",
    href: "/portal/renewal",
    icon: BadgeCheck,
    status: "pending",
    disabled: true,
  },
];

function getStatusVisual(status: NavStatus) {
  if (status === "done") {
    return {
      icon: BadgeCheck,
      color: "#22C55E",
      label: "Listo",
    };
  }

  if (status === "partial") {
    return {
      icon: CircleAlert,
      color: "#F59E0B",
      label: "Parcial",
    };
  }

  return {
    icon: CircleX,
    color: "#F87171",
    label: "Pendiente",
  };
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

function SidebarSection({
  title,
  items,
  pathname,
  previewTenantId,
}: {
  title: string;
  items: SidebarItem[];
  pathname: string;
  previewTenantId?: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.62)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 800,
          padding: "0 4px",
        }}
      >
        {title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => {
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
            padding: "12px 14px",
            borderRadius: 14,
            textDecoration: "none",
            background: active ? "rgba(255,255,255,0.14)" : "transparent",
            border: active
              ? "1px solid rgba(255,255,255,0.16)"
              : "1px solid transparent",
            transition: "all 0.2s ease",
          };

          const leftBlock = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minWidth: 0,
                flex: 1,
              }}
            >
              <Icon
                size={18}
                color={item.disabled ? "rgba(255,255,255,0.45)" : "#FFFFFF"}
              />
              <span
                style={{
                  color: item.disabled ? "rgba(255,255,255,0.55)" : "#FFFFFF",
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
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
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <StatusIcon size={16} color={statusVisual.color} />
            </div>
          );

          if (resolvedHref) {
            return (
              <Link
                key={`${title}-${item.label}`}
                href={resolvedHref}
                style={commonStyle}
              >
                {leftBlock}
                {rightBlock}
              </Link>
            );
          }

          return (
            <div
              key={`${title}-${item.label}`}
              style={{
                ...commonStyle,
                opacity: 0.82,
                cursor: "default",
              }}
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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();

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

  const sessionName =
    user?.full_name ||
    (isPortalPath ? "Inquilino" : "Sin sesión");

  const sessionEmail = user?.email || "No autenticado";

  return (
    <aside
      style={{
        width: 300,
        minWidth: 300,
        height: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        overflowY: "auto",
        background: "#0F172A",
        color: "#FFFFFF",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            PropAdmin
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {sidebarTitle}
          </div>
        </div>

        {isSuperAdmin ? (
          <>
            <SidebarSection
              title="Administración"
              items={ADMIN_ITEMS}
              pathname={pathname}
            />

            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.08)",
                margin: "2px 0 2px",
              }}
            />

            <SidebarSection
              title="Vista portal"
              items={TENANT_ITEMS}
              pathname={pathname}
              previewTenantId={previewTenantId}
            />

            {previewTenantId ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.5,
                }}
              >
                Vista previa activa del tenant:
                <div
                  style={{
                    marginTop: 6,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    wordBreak: "break-word",
                  }}
                >
                  {previewTenantId}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.5,
                }}
              >
                Puedes entrar al portal y luego elegir un tenant para vista previa
                sin perder el acceso al resto del sistema.
              </div>
            )}
          </>
        ) : isPortalPath ? (
          <SidebarSection
            title="Portal"
            items={TENANT_ITEMS}
            pathname={pathname}
            previewTenantId={previewTenantId}
          />
        ) : (
          <SidebarSection
            title="Administración"
            items={ADMIN_ITEMS}
            pathname={pathname}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 700,
            }}
          >
            Sesión actual
          </span>

          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            {sessionName}
          </span>

          <span
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {sessionEmail}
          </span>

          {isSuperAdmin ? (
            <span
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignSelf: "flex-start",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.14)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#86EFAC",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.02em",
              }}
            >
              SUPERADMIN
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "#FFFFFF",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
