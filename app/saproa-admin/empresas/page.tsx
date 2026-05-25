"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import UiButton from "@/components/UiButton";
import { staggerContainer, staggerItem } from "@/lib/animations";

type Company = {
  id: string;
  name: string;
  short_name: string | null;
  brand_color: string | null;
  created_at: string;
  userCount: number;
  buildingCount: number;
};

export default function SaproaEmpresasPage() {
  const router = useRouter();
  const { startImpersonation } = useImpersonation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: companiesData }, { data: usersData }, { data: buildingsData }] = await Promise.all([
      supabase.from("companies").select("id, name, short_name, brand_color, created_at").is("deleted_at", null).order("name"),
      supabase.from("app_users").select("id, company_id").eq("is_superadmin", false),
      supabase.from("buildings").select("id, company_id").is("deleted_at", null),
    ]);

    const userCountByCompany = new Map<string, number>();
    for (const u of (usersData ?? []) as { id: string; company_id: string | null }[]) {
      if (u.company_id) userCountByCompany.set(u.company_id, (userCountByCompany.get(u.company_id) ?? 0) + 1);
    }

    const buildingCountByCompany = new Map<string, number>();
    for (const b of (buildingsData ?? []) as { id: string; company_id: string | null }[]) {
      if (b.company_id) buildingCountByCompany.set(b.company_id, (buildingCountByCompany.get(b.company_id) ?? 0) + 1);
    }

    const comps: Company[] = ((companiesData ?? []) as Omit<Company, "userCount" | "buildingCount">[]).map(c => ({
      ...c,
      userCount: userCountByCompany.get(c.id) ?? 0,
      buildingCount: buildingCountByCompany.get(c.id) ?? 0,
    }));

    setCompanies(comps);
    setLoading(false);
  }

  function handleImpersonate(company: Company) {
    startImpersonation({
      companyId:    company.id,
      companyName:  company.short_name || company.name,
      userId:       null,
      userEmail:    null,
      userFullName: null,
      role:         "superadmin",
    });
    router.push("/dashboard");
  }

  return (
    <PageContainer>
      <PageHeader title="Empresas" subtitle="Todas las empresas registradas en la plataforma" />

      <SectionCard title="Empresas registradas" icon={<Building2 size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Cargando...</p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {companies.map(c => {
              const dot = c.brand_color || "#6b7280";
              const isNew = Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 3600000;
              return (
                <motion.div
                  key={c.id}
                  variants={staggerItem}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--border-radius-lg)",
                  }}
                >
                  {/* Dot */}
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0 }} />

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {c.name}
                    </div>
                    {c.short_name && c.short_name !== c.name && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{c.short_name}</div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{c.userCount}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>usuarios</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{c.buildingCount}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>propiedades</div>
                    </div>
                  </div>

                  {/* Date + badge */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <AppBadge variant={isNew ? "blue" : "green"}>{isNew ? "nueva" : "activa"}</AppBadge>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                      {new Date(c.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Impersonar */}
                  <UiButton variant="secondary" onClick={() => handleImpersonate(c)} style={{ flexShrink: 0 }}>
                    Impersonar
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
