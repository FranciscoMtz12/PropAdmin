"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, LayoutDashboard, ShoppingCart, Wrench } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import SectionCard from "@/components/SectionCard";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";

/* ─── Helpers ────────────────────────────────────────────────────── */

const DAY_NAMES_EN = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function timeAgo(isoString: string) {
  const hours = Math.floor((Date.now() - new Date(isoString).getTime()) / 3_600_000);
  if (hours < 24) return `hace ${hours === 0 ? "< 1" : hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

/* ─── Types ──────────────────────────────────────────────────────── */

type LogRow = {
  id: string;
  title: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  building_id: string | null;
};

/* ─── Page ───────────────────────────────────────────────────────── */

export default function DashboardMantenimientoPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    const ok = user.role === "mantenimiento" || user.role === "superadmin" || user.is_superadmin;
    if (!ok) router.replace("/dashboard");
  }, [user, loading, router]);

  const [pageLoading, setPageLoading] = useState(true);
  const [openLogs, setOpenLogs]       = useState<LogRow[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [cleaningToday, setCleaningToday] = useState(0);
  const [materialsPending, setMaterialsPending] = useState(0);
  const [recentLogs, setRecentLogs]   = useState<(LogRow & { building_name: string | null })[]>([]);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user?.company_id]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);
    const cid = user.company_id;

    const now            = new Date();
    const todayDow       = DAY_NAMES_EN[now.getDay()];
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
      const [
        openRes,
        resolvedRes,
        buildingSchedRes,
        unitSchedRes,
        materialsRes,
        recentRes,
        buildingsRes,
      ] = await Promise.all([
        supabase
          .from("maintenance_logs")
          .select("id, title, status, priority, created_at, updated_at, building_id")
          .eq("company_id", cid)
          .is("deleted_at", null)
          .not("status", "in", '("completed","cancelled","resolved")')
          .order("created_at", { ascending: true }),

        supabase
          .from("maintenance_logs")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .is("deleted_at", null)
          .in("status", ["completed","resolved"])
          .gte("updated_at", monthStart),

        supabase
          .from("cleaning_building_schedules")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("day_of_week", todayDow),

        supabase
          .from("cleaning_unit_schedules")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("day_of_week", todayDow),

        supabase
          .from("purchase_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .is("deleted_at", null)
          .not("maintenance_log_id", "is", null)
          .in("status", ["pending","sent","partial"]),

        supabase
          .from("maintenance_logs")
          .select("id, title, status, priority, created_at, updated_at, building_id")
          .eq("company_id", cid)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(10),

        supabase
          .from("buildings")
          .select("id, name")
          .eq("company_id", cid)
          .is("deleted_at", null),
      ]);

      if (openRes.error) throw openRes.error;
      if (recentRes.error) throw recentRes.error;

      setOpenLogs((openRes.data as LogRow[]) ?? []);
      setResolvedCount(resolvedRes.count ?? 0);
      setCleaningToday((buildingSchedRes.count ?? 0) + (unitSchedRes.count ?? 0));
      setMaterialsPending(materialsRes.count ?? 0);

      const buildingMap = new Map<string, string>();
      ((buildingsRes.data ?? []) as { id: string; name: string }[]).forEach(b => {
        buildingMap.set(b.id, b.name);
      });

      const recent = ((recentRes.data as LogRow[]) ?? []).map(r => ({
        ...r,
        building_name: r.building_id ? (buildingMap.get(r.building_id) ?? null) : null,
      }));
      setRecentLogs(recent);

    } catch (err) {
      console.error("Dashboard mantenimiento error", err);
    }
    setPageLoading(false);
  }

  if (loading || !user) return null;

  /* Priority sort: urgent=1 high=2 medium=3 low=4 */
  const PRIORITY_ORDER: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
  const sortedOpen = [...openLogs].sort((a, b) =>
    (PRIORITY_ORDER[a.priority ?? "low"] ?? 4) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 4)
  );
  const openTable = sortedOpen.slice(0, 8);

  const ticketsVariant = pageLoading ? "neutral" : openLogs.length > 5 ? "red" : openLogs.length > 0 ? "amber" : "green";
  const resolvedVariant = pageLoading ? "neutral" : resolvedCount > 0 ? "green" : "neutral";

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard — Mantenimiento"
        titleIcon={<LayoutDashboard size={20} />}
        subtitle="Estado de tickets, limpieza y materiales"
      />

      {/* ── Fila 1: Métricas ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 24 }}>
        <MetricCard
          label="Tickets abiertos"
          value={pageLoading ? "…" : openLogs.length}
          icon={<AlertTriangle size={18} />}
          variant={ticketsVariant}
        />
        <MetricCard
          label="Resueltos este mes"
          value={pageLoading ? "…" : resolvedCount}
          icon={<CheckCircle size={18} />}
          variant={resolvedVariant}
        />
        <MetricCard
          label="Limpieza hoy"
          value={pageLoading ? "…" : cleaningToday}
          helper="tareas programadas"
          icon={<Wrench size={18} />}
          variant="neutral"
        />
        <MetricCard
          label="Materiales pendientes"
          value={pageLoading ? "…" : materialsPending}
          helper="OCs vinculadas a tickets"
          icon={<ShoppingCart size={18} />}
          variant={pageLoading ? "neutral" : materialsPending > 0 ? "amber" : "green"}
        />
      </div>

      {/* ── Fila 2: Dos columnas ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>

        {/* Tickets abiertos por prioridad */}
        <SectionCard title="Tickets abiertos por prioridad" subtitle="Urgente → Baja · máx. 8">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
          ) : openTable.length === 0 ? (
            <AppEmptyState title="Sin tickets abiertos" description="No hay tickets de mantenimiento abiertos." />
          ) : (
            <AppTable
              minWidth={0}
              rows={openTable}
              columns={[
                {
                  key: "titulo",
                  header: "Título",
                  render: (row) => {
                    const pMap: Record<string, { label: string; variant: "red"|"amber"|"gray" }> = {
                      urgent: { label: "Urgente", variant: "red" },
                      high:   { label: "Alta",    variant: "amber" },
                      medium: { label: "Media",   variant: "amber" },
                      low:    { label: "Baja",    variant: "gray" },
                    };
                    const p = pMap[row.priority ?? "low"] ?? pMap.low;
                    return (
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                          {row.title ?? "Sin título"}
                        </span>
                        <AppBadge variant={p.variant}>{p.label}</AppBadge>
                      </div>
                    );
                  },
                },
                {
                  key: "estado",
                  header: "Estado",
                  align: "right",
                  width: 110,
                  render: (row) => {
                    const STATUS_LABEL: Record<string, string> = {
                      open: "Abierto", in_progress: "En progreso", pending: "Pendiente",
                      on_hold: "En espera", draft: "Borrador",
                    };
                    return (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    );
                  },
                },
              ]}
            />
          )}
        </SectionCard>

        {/* Actividad reciente */}
        <SectionCard title="Actividad reciente" subtitle="Últimos 10 movimientos">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
          ) : recentLogs.length === 0 ? (
            <AppEmptyState title="Sin actividad" description="No hay registros de mantenimiento recientes." />
          ) : (
            <AppTable
              minWidth={0}
              rows={recentLogs}
              columns={[
                {
                  key: "titulo",
                  header: "Ticket",
                  render: (row) => (
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                        {row.title ?? "Sin título"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {row.building_name ?? "Sin edificio"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "tiempo",
                  header: "Actualizado",
                  align: "right",
                  width: 110,
                  render: (row) => (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {timeAgo(row.updated_at)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>

      </div>
    </PageContainer>
  );
}
