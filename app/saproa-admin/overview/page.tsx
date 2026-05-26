"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  MessageSquare,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import UiButton from "@/components/UiButton";
import { staggerContainer, staggerItem } from "@/lib/animations";

const SAPROA_ACCENT = "#6366F1";

type Company = {
  id: string;
  name: string;
  short_name: string | null;
  brand_color: string | null;
  created_at: string;
  userCount?: number;
};

type FeedbackRow = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  status: string;
};

type Metrics = {
  companies: number;
  users: number;
  buildings: number;
  feedbackPending: number;
};

const ROADMAP_PENDING = [
  { id: "S1", label: "Enmascaramiento de datos sensibles", color: "#EF4444" },
  { id: "S2", label: "Auditar endpoints API sin autenticación", color: "#EF4444" },
  { id: "M15", label: "Analytics Grupo MATZ", color: "#F59E0B" },
  { id: "M9",  label: "Migrar Storage a privados", color: "#F59E0B" },
  { id: "P1",  label: "Demo interactivo", color: "#22C55E" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export default function SaproaOverviewPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics>({ companies: 0, users: 0, buildings: 0, feedbackPending: 0 });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [
      { count: companiesCount },
      { count: usersCount },
      { count: buildingsCount },
      { count: feedbackCount },
      { data: companiesData },
      { data: feedbackData },
      { data: usersData },
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("app_users").select("*", { count: "exact", head: true }).eq("is_superadmin", false),
      supabase.from("buildings").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("feedback").select("*", { count: "exact", head: true }).eq("status", "nuevo"),
      supabase.from("companies").select("id, name, short_name, brand_color, created_at").is("deleted_at", null).order("name"),
      supabase.from("feedback").select("id, type, title, created_at, status").order("created_at", { ascending: false }).limit(3),
      supabase.from("app_users").select("id, company_id").eq("is_superadmin", false),
    ]);

    setMetrics({
      companies: companiesCount ?? 0,
      users: usersCount ?? 0,
      buildings: buildingsCount ?? 0,
      feedbackPending: feedbackCount ?? 0,
    });

    const userCountByCompany = new Map<string, number>();
    for (const u of (usersData ?? []) as { id: string; company_id: string | null }[]) {
      if (u.company_id) userCountByCompany.set(u.company_id, (userCountByCompany.get(u.company_id) ?? 0) + 1);
    }

    const comps: Company[] = ((companiesData ?? []) as Company[]).map(c => ({
      ...c,
      userCount: userCountByCompany.get(c.id) ?? 0,
    }));

    setCompanies(comps);
    setFeedback((feedbackData ?? []) as FeedbackRow[]);
    setLoading(false);
  }

  const metricCards = [
    { label: "Empresas activas",    value: metrics.companies,       icon: <Building2 size={18} color={SAPROA_ACCENT} />,    bg: "rgba(99,102,241,0.10)" },
    { label: "Usuarios totales",    value: metrics.users,           icon: <Users     size={18} color="#0EA5E9" />,           bg: "rgba(14,165,233,0.10)"  },
    { label: "Propiedades",         value: metrics.buildings,       icon: <Building2 size={18} color="#10B981" />,           bg: "rgba(16,185,129,0.10)"  },
    { label: "Feedback pendiente",  value: metrics.feedbackPending, icon: <MessageSquare size={18} color="#F59E0B" />,       bg: "rgba(245,158,11,0.10)"  },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="SAPROA Control Center"
        subtitle="Vista general de la plataforma"
      />

      {/* Metric cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="saproa-overview-metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(12.5rem, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {metricCards.map(card => (
          <motion.div
            key={card.label}
            variants={staggerItem}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--border-radius-lg)",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "var(--border-radius-md)", background: card.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {loading ? "—" : card.value}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 3 }}>{card.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* First row: Empresas + Feedback reciente */}
      <div className="saproa-overview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard title="Empresas del grupo" icon={<Building2 size={16} />}>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {companies.slice(0, 6).map(c => {
              const dot = c.brand_color || "#6b7280";
              const isNew = Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 3600000;
              return (
                <motion.div
                  key={c.id}
                  variants={staggerItem}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {c.short_name || c.name}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {c.userCount} usuario{c.userCount !== 1 ? "s" : ""}
                  </span>
                  {isNew && (
                    <AppBadge variant="blue">nueva</AppBadge>
                  )}
                  {!isNew && (
                    <AppBadge variant="green">activa</AppBadge>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </SectionCard>

        <SectionCard title="Feedback reciente" icon={<MessageSquare size={16} />}>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {feedback.length === 0 && !loading && (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Sin feedback registrado.</p>
            )}
            {feedback.map(f => (
              <motion.div
                key={f.id}
                variants={staggerItem}
                style={{ padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "var(--bg-subtle)", display: "flex", flexDirection: "column", gap: 4 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AppBadge variant={f.type === "problema" ? "red" : f.type === "idea" ? "blue" : "amber"}>
                    {f.type}
                  </AppBadge>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                    {relativeTime(f.created_at)}
                  </span>
                </div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</span>
              </motion.div>
            ))}
          </motion.div>
        </SectionCard>
      </div>

      {/* Second row: Roadmap pendientes + Acceso rápido */}
      <div className="saproa-overview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Pendientes del roadmap" icon={<ChevronRight size={16} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ROADMAP_PENDING.map(item => (
              <div
                key={item.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", minWidth: 28, flexShrink: 0 }}>{item.id}</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)", flex: 1 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Acceso rápido">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <UiButton
              variant="secondary"
              style={{ justifyContent: "space-between", width: "100%" }}
              onClick={() => router.push("/saproa-admin/impersonar")}
            >
              <span>Impersonar empresa</span>
              <ArrowRight size={14} />
            </UiButton>
            <UiButton
              variant="secondary"
              style={{ justifyContent: "space-between", width: "100%" }}
              onClick={() => router.push("/saproa-admin/feedback")}
            >
              <span>Ver feedback</span>
              <ArrowRight size={14} />
            </UiButton>
            <UiButton
              variant="secondary"
              style={{ justifyContent: "space-between", width: "100%" }}
              onClick={() => router.push("/saproa-admin/sistema")}
            >
              <span>Configurar sistema</span>
              <ArrowRight size={14} />
            </UiButton>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
