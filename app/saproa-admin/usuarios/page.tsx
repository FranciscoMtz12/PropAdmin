"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { initials } from "@/contexts/ThemeContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import UiButton from "@/components/UiButton";
import { staggerContainer, staggerItem } from "@/lib/animations";

type AppUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  company_id: string | null;
  created_at: string;
  companyName?: string;
  companyShortName?: string | null;
  companyBrandColor?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  titular: "Titular",
  administracion: "Administración",
  directivo: "Directivo",
  compras: "Compras",
  mantenimiento: "Mantenimiento",
  field: "Campo",
  tenant: "Inquilino",
};

const ROLE_VARIANT: Record<string, "blue" | "green" | "amber" | "red" | "gray"> = {
  titular: "blue",
  administracion: "green",
  directivo: "blue",
  compras: "amber",
  mantenimiento: "amber",
  field: "gray",
  tenant: "gray",
};

export default function SaproaUsuariosPage() {
  const router = useRouter();
  const { startImpersonation } = useImpersonation();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: usersData }, { data: companiesData }] = await Promise.all([
      supabase
        .from("app_users")
        .select("id, full_name, email, role, company_id, created_at")
        .eq("is_superadmin", false)
        .order("full_name"),
      supabase
        .from("companies")
        .select("id, name, short_name, brand_color")
        .is("deleted_at", null),
    ]);

    const companyMap = new Map<string, { name: string; short_name: string | null; brand_color: string | null }>(
      ((companiesData ?? []) as { id: string; name: string; short_name: string | null; brand_color: string | null }[])
        .map(c => [c.id, { name: c.name, short_name: c.short_name, brand_color: c.brand_color }]),
    );

    const mapped: AppUser[] = ((usersData ?? []) as AppUser[]).map(u => {
      const co = u.company_id ? companyMap.get(u.company_id) : undefined;
      return {
        ...u,
        companyName: co?.name,
        companyShortName: co?.short_name,
        companyBrandColor: co?.brand_color,
      };
    });

    setUsers(mapped);
    setLoading(false);
  }

  function handleImpersonate(u: AppUser) {
    if (!u.company_id) return;
    startImpersonation({
      companyId:    u.company_id,
      companyName:  u.companyShortName || u.companyName || "",
      userId:       u.id,
      userEmail:    u.email,
      userFullName: u.full_name,
      role:         u.role,
    });
    router.push("/home");
  }

  return (
    <PageContainer>
      <PageHeader title="Usuarios" subtitle="Todos los usuarios de la plataforma (excepto superadmin)" />

      <SectionCard title="Usuarios registrados" icon={<Users size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Cargando...</p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {users.map(u => {
              const avatarColor = u.companyBrandColor || "#6b7280";
              const avatarText = initials(u.full_name || u.email);
              const dotColor = u.companyBrandColor || "#6b7280";
              return (
                <motion.div
                  key={u.id}
                  variants={staggerItem}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--border-radius-lg)",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {avatarText}
                  </div>

                  {/* Name + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {u.full_name || "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                  </div>

                  {/* Role */}
                  <AppBadge variant={ROLE_VARIANT[u.role] ?? "gray"}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </AppBadge>

                  {/* Company */}
                  {u.companyName && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {u.companyShortName || u.companyName}
                      </span>
                    </div>
                  )}

                  {/* Date */}
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", flexShrink: 0 }}>
                    {new Date(u.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>

                  {/* Ver como */}
                  <UiButton
                    variant="secondary"
                    onClick={() => handleImpersonate(u)}
                    disabled={!u.company_id}
                    style={{ flexShrink: 0 }}
                  >
                    Ver como
                  </UiButton>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
