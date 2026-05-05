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

function daysOpen(isoString: string) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000);
}

/* ─── Types ──────────────────────────────────────────────────────── */

type WorkOrderRow = {
  id: string;
  work_order_number: string | null;
  notes: string | null;
  priority: string | null;
  status: string;
  created_at: string;
  building_id: string | null;
};

type ActivityRow = {
  id: string;
  title: string | null;
  log_type: string | null;
  created_at: string;
  building_id: string | null;
  building_name: string | null;
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

  const [pageLoading, setPageLoading]     = useState(true);
  const [openOrders, setOpenOrders]       = useState<(WorkOrderRow & { building_name: string | null })[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [cleaningToday, setCleaningToday] = useState(0);
  const [materialsPending, setMaterialsPending] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user?.company_id]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);
    const cid      = user.company_id;
    const now      = new Date();
    const todayDow = DAY_NAMES_EN[now.getDay()];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
      const [
        openRes,
        resolvedRes,
        buildingSchedRes,
        unitSchedRes,
        materialsRes,
        activityRes,
        buildingsRes,
      ] = await Promise.all([
        /* Open work orders */
        supabase
          .from("work_orders")
          .select("id, work_order_number, notes, priority, status, created_at, building_id")
          .eq("company_id", cid)
          .is("deleted_at", null)
          .not("status", "in", '("completed","cancelled")')
          .order("created_at", { ascending: true }),

        /* Resolved this month */
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .is("deleted_at", null)
          .eq("status", "completed")
          .gte("completed_at", monthStart),

        /* Cleaning today — buildings */
        supabase
          .from("cleaning_building_schedules")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("day_of_week", todayDow),

        /* Cleaning today — units */
        supabase
          .from("cleaning_unit_schedules")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("day_of_week", todayDow),

        /* Pending purchase orders for the company */
        supabase
          .from("purchase_orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .is("deleted_at", null)
          .in("status", ["pending","sent","partial"]),

        /* Recent maintenance_logs activity */
        supabase
          .from("maintenance_logs")
          .select("id, title, log_type, created_at, building_id")
          .eq("company_id", cid)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10),

        /* Buildings for name lookup */
        supabase
          .from("buildings")
          .select("id, name")
          .eq("company_id", cid)
          .is("deleted_at", null),
      ]);

      if (openRes.error) throw openRes.error;
      if (activityRes.error) throw activityRes.error;

      const buildingMap = new Map<string, string>();
      ((buildingsRes.data ?? []) as { id: string; name: string }[]).forEach(b => {
        buildingMap.set(b.id, b.name);
      });

      const orders = ((openRes.data as WorkOrderRow[]) ?? []).map(r => ({
        ...r,
        building_name: r.building_id ? (buildingMap.get(r.building_id) ?? null) : null,
      }));

      const activity = ((activityRes.data as Omit<ActivityRow, "building_name">[]) ?? []).map(r => ({
        ...r,
        building_name: r.building_id ? (buildingMap.get(r.building_id) ?? null) : null,
      }));

      setOpenOrders(orders);
      setResolvedCount(resolvedRes.count ?? 0);
      setCleaningToday((buildingSchedRes.count ?? 0) + (unitSchedRes.count ?? 0));
      setMaterialsPending(materialsRes.count ?? 0);
      setRecentActivity(activity);

    } catch (err) {
      console.error("Dashboard mantenimiento error", err);
    }
    setPageLoading(false);
  }

  if (loading || !user) return null;

  /* Priority sort: urgent=1 high=2 medium=3 low=4 */
  const PRIORITY_ORDER: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
  const sortedOpen = [...openOrders].sort((a, b) =>
    (PRIORITY_ORDER[a.priority ?? "low"] ?? 4) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 4)
  );
  const openTable = sortedOpen.slice(0, 8);

  const ticketsVariant = pageLoading ? "neutral"
    : openOrders.length > 5 ? "red"
    : openOrders.length > 0 ? "amber"
    : "green";

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
          value={pageLoading ? "…" : openOrders.length}
          icon={<AlertTriangle size={18} />}
          variant={ticketsVariant}
        />
        <MetricCard
          label="Resueltos este mes"
          value={pageLoading ? "…" : resolvedCount}
          icon={<CheckCircle size={18} />}
          variant={pageLoading ? "neutral" : resolvedCount > 0 ? "green" : "neutral"}
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
          helper="OCs pendientes / enviadas"
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
            <AppEmptyState title="Sin tickets abiertos" description="No hay órdenes de trabajo abiertas." />
          ) : (
            <AppTable
              minWidth={0}
              rows={openTable}
              columns={[
                {
                  key: "orden",
                  header: "Orden / Descripción",
                  render: (row) => {
                    const pMap: Record<string, { label: string; variant: "red"|"amber"|"gray" }> = {
                      urgent: { label: "Urgente", variant: "red" },
                      high:   { label: "Alta",    variant: "amber" },
                      medium: { label: "Media",   variant: "amber" },
                      low:    { label: "Baja",    variant: "gray" },
                    };
                    const p = pMap[row.priority ?? "low"] ?? pMap.low;
                    const notesPreview = row.notes
                      ? row.notes.length > 48 ? row.notes.slice(0, 48) + "…" : row.notes
                      : null;
                    return (
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                          {row.work_order_number ?? "Sin número"}
                        </span>
                        {notesPreview && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                            {notesPreview}
                          </span>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <AppBadge variant={p.variant}>{p.label}</AppBadge>
                          {row.building_name && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.building_name}</span>
                          )}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "dias",
                  header: "Días",
                  align: "right",
                  width: 64,
                  render: (row) => {
                    const d = daysOpen(row.created_at);
                    const v = d > 7 ? "red" : d > 3 ? "amber" : "gray";
                    return (
                      <AppBadge variant={v}>
                        {d === 0 ? "Hoy" : `${d}d`}
                      </AppBadge>
                    );
                  },
                },
              ]}
            />
          )}
        </SectionCard>

        {/* Actividad reciente (maintenance_logs) */}
        <SectionCard title="Actividad reciente" subtitle="Últimos 10 registros">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
          ) : recentActivity.length === 0 ? (
            <AppEmptyState title="Sin actividad" description="No hay registros de mantenimiento recientes." />
          ) : (
            <AppTable
              minWidth={0}
              rows={recentActivity}
              columns={[
                {
                  key: "titulo",
                  header: "Registro",
                  render: (row) => (
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                        {row.title ?? row.log_type ?? "Sin título"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {row.building_name ?? "Sin edificio"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "tiempo",
                  header: "Hace",
                  align: "right",
                  width: 100,
                  render: (row) => (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {timeAgo(row.created_at)}
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
