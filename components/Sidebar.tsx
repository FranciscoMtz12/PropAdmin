"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CreditCard,
  Home,
  LogOut,
  Wrench,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Calendario", href: "/calendar", icon: CalendarDays },
  { label: "Pagos", href: "/payments", icon: CreditCard },
  { label: "Edificios", href: "/buildings", icon: Building2 },
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
        minHeight: "100vh",
        background: "#FFFFFF",
        borderRight: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 20,
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.02em",
            }}
          >
            PropAdmin
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginTop: 6,
            }}
          >
            Gestión de Propiedades
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

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
                  background: active ? "#EEF2FF" : "transparent",
                  color: active ? "#4338CA" : "#374151",
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

      <div
        style={{
          borderTop: "1px solid #E5E7EB",
          paddingTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#6B7280",
            }}
          >
            Usuario actual
          </span>

          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
              lineHeight: 1.5,
            }}
          >
            {user?.full_name || user?.email || "Sin usuario"}
          </span>

          {user?.company_id ? (
            <span
              style={{
                fontSize: 12,
                color: "#059669",
                fontWeight: 600,
              }}
            >
              Empresa activa configurada
            </span>
          ) : null}
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            color: "#374151",
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
