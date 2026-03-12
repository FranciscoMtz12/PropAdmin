"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Home,
  LogOut,
  ReceiptText,
  Sparkles,
  Wrench,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

/*
Sidebar global del sistema.

Cambios aplicados:
- "Pagos" usa ReceiptText (pagos administrativos)
- Se agrega módulo "Cobranza"
*/

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Calendario", href: "/calendar", icon: CalendarDays },

  { label: "Pagos", href: "/payments", icon: ReceiptText },
  { label: "Cobranza", href: "/collections", icon: Wallet },

  { label: "Edificios", href: "/buildings", icon: Building2 },
  { label: "Limpieza", href: "/cleaning", icon: Sparkles },
  { label: "Mantenimiento", href: "/maintenance", icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();

  if (pathname === "/login") return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        background: "#0F172A",
        color: "#FFFFFF",
        minHeight: "100vh",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* LOGO / APP NAME */}
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
            Gestión de Propiedades
          </div>
        </div>

        {/* NAVIGATION */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  textDecoration: "none",
                  color: "#FFFFFF",
                  background: active
                    ? "rgba(255,255,255,0.14)"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(255,255,255,0.16)"
                    : "1px solid transparent",
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* USER SECTION */}
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
            Usuario actual
          </span>

          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            {user?.full_name || user?.email || "Sin usuario"}
          </span>

          {user?.company_id ? (
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.65)",
              }}
            >
              Empresa activa configurada
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "#FFFFFF",
            padding: "12px 14px",
            fontSize: 14,
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
