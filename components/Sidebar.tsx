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
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
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
        width: "248px",
        minHeight: "100vh",
        borderRight: "1px solid #E5E7EB",
        background: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "18px 14px",
        position: "sticky",
        top: 0,
      }}
    >
      <div>
        <div style={{ padding: "8px 10px", marginBottom: "18px" }}>
          <div style={{ fontSize: "30px", fontWeight: 800, lineHeight: 1 }}>PropAdmin</div>
          <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>
            Gestión de Propiedades
          </div>
        </div>

        <nav style={{ display: "grid", gap: "6px" }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderRadius: "14px",
                  padding: "12px 12px",
                  textDecoration: "none",
                  fontWeight: active ? 700 : 500,
                  fontSize: "15px",
                  color: active ? "#2563EB" : "#374151",
                  background: active ? "#EAF1FF" : "transparent",
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: "grid", gap: "10px", padding: "8px 6px 0 6px" }}>
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "14px",
            padding: "12px",
            background: "white",
          }}
        >
          <div style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}>
            Usuario actual
          </div>
          <div style={{ fontWeight: 700, color: "#111827", fontSize: "14px" }}>
            {user?.full_name || user?.email || "Sin usuario"}
          </div>
          {user?.company_id ? (
            <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>
              Empresa activa configurada
            </div>
          ) : null}
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            width: "100%",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "12px 14px",
            background: "white",
            color: "#111827",
            fontWeight: 600,
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
