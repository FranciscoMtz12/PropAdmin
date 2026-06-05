"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, LayoutDashboard, Send, TrendingUp } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCircles from "@/components/MetricCircles";
import SectionCard from "@/components/SectionCard";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function daysAgo(isoString: string) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000);
}

/* ─── Types ──────────────────────────────────────────────────────── */

type PORow = {
  id: string;
  folio: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  total_estimated: number | null;
  parent_order_id: string | null;
  supplier_name: string | null;
};

/* ─── Page ───────────────────────────────────────────────────────── */

export default function DashboardComprasPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    const ok = user.role === "compras" || user.role === "superadmin" || user.is_superadmin;
    if (!ok) router.replace("/dashboard");
  }, [user, loading, router]);

  const [pageLoading, setPageLoading] = useState(true);
  const [orders, setOrders]           = useState<PORow[]>([]);
  const [thisMonthSpent, setThisMonthSpent] = useState(0);
  const [prevMonthSpent, setPrevMonthSpent] = useState(0);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user?.company_id]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);
    const cid = user.company_id;

    const now            = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, folio, status, created_at, updated_at, total_estimated, parent_order_id, suppliers(name)")
        .eq("company_id", cid)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      type Raw = {
        id: string; folio: string | null; status: string;
        created_at: string; updated_at: string; total_estimated: number | null;
        parent_order_id: string | null;
        suppliers: { name: string } | { name: string }[] | null;
      };

      const mapped: PORow[] = ((data as unknown as Raw[]) || []).map(r => {
        const sup = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
        return {
          id: r.id, folio: r.folio, status: r.status,
          created_at: r.created_at, updated_at: r.updated_at,
          total_estimated: r.total_estimated, parent_order_id: r.parent_order_id,
          supplier_name: sup?.name ?? null,
        };
      });

      setOrders(mapped);

      const thisSpent = mapped
        .filter(o => ["received","invoiced"].includes(o.status) && o.created_at >= thisMonthStart && o.created_at < nextMonthStart)
        .reduce((s, o) => s + (o.total_estimated ?? 0), 0);
      const prevSpent = mapped
        .filter(o => ["received","invoiced"].includes(o.status) && o.created_at >= prevMonthStart && o.created_at < thisMonthStart)
        .reduce((s, o) => s + (o.total_estimated ?? 0), 0);

      setThisMonthSpent(thisSpent);
      setPrevMonthSpent(prevSpent);

    } catch (err) {
      console.error("Dashboard compras error", err);
    }
    setPageLoading(false);
  }

  if (loading || !user) return null;

  /* Derived metrics */
  const pendingApprove = orders.filter(o => o.status === "pending" && !o.parent_order_id);
  const sentOrders     = orders.filter(o => o.status === "sent");
  const partialOrders  = orders.filter(o => o.status === "partial");

  /* Gasto vs mes anterior */
  const spentDiff    = prevMonthSpent > 0 ? Math.round(((thisMonthSpent - prevMonthSpent) / prevMonthSpent) * 100) : null;
  const spentHelper  = spentDiff !== null
    ? `${spentDiff >= 0 ? "+" : ""}${spentDiff}% vs mes anterior`
    : "sin datos mes anterior";

  /* Tables */
  const pendingTable = pendingApprove.slice(0, 8);
  const sentTable    = sentOrders.slice(0, 8);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard — Compras"
        titleIcon={<LayoutDashboard size={20} />}
        subtitle="Órdenes de compra y gasto del mes"
      />

      {/* ── Fila 1: Métricas ──────────────────────────────────────── */}
      <MetricCircles metrics={[
        { value: pageLoading ? "…" : pendingApprove.length, label: "Por aprobar", color: pageLoading ? "default" : pendingApprove.length > 0 ? "warning" : "success" },
        { value: pageLoading ? "…" : sentOrders.length, label: "Enviadas", color: "info" },
        { value: pageLoading ? "…" : formatMXN(thisMonthSpent), label: "Gasto mes" },
        { value: pageLoading ? "…" : partialOrders.length, label: "Faltantes", color: pageLoading ? "default" : partialOrders.length > 0 ? "warning" : "success" },
      ]} />

      {/* ── Fila 2: Dos columnas ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(21.25rem, 1fr))", gap: 24 }}>

        {/* OCs pendientes de aprobar */}
        <SectionCard title="OCs pendientes de aprobar" subtitle="Más antiguas primero · máx. 8">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : pendingTable.length === 0 ? (
            <AppEmptyState title="Sin OCs pendientes" description="No hay órdenes de compra pendientes de aprobación." />
          ) : (
            <AppTable
              minWidth={0}
              rows={pendingTable}
              columns={[
                {
                  key: "folio",
                  header: "Folio / Proveedor",
                  render: (row) => (
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.8125rem", display: "block", color: "var(--text-primary)" }}>
                        {row.folio ?? "Sin folio"}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {row.supplier_name ?? "Sin proveedor"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "monto",
                  header: "Monto",
                  align: "right",
                  width: 120,
                  render: (row) => {
                    const days   = daysAgo(row.created_at);
                    const bv     = days > 3 ? "red" : days > 1 ? "amber" : "gray";
                    return (
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", color: "var(--text-primary)" }}>
                          {row.total_estimated != null ? formatMXN(row.total_estimated) : "—"}
                        </span>
                        <AppBadge variant={bv}>
                          {days === 0 ? "Hoy" : `${days} ${days === 1 ? "día" : "días"}`}
                        </AppBadge>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}
        </SectionCard>

        {/* OCs enviadas sin recibir */}
        <SectionCard title="OCs enviadas sin recibir" subtitle="Más antiguas primero · máx. 8">
          {pageLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
          ) : sentTable.length === 0 ? (
            <AppEmptyState title="Sin OCs enviadas pendientes" description="No hay órdenes enviadas sin confirmar recepción." />
          ) : (
            <AppTable
              minWidth={0}
              rows={sentTable}
              columns={[
                {
                  key: "folio",
                  header: "Folio / Proveedor",
                  render: (row) => (
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.8125rem", display: "block", color: "var(--text-primary)" }}>
                        {row.folio ?? "Sin folio"}
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {row.supplier_name ?? "Sin proveedor"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "enviada",
                  header: "Enviada hace",
                  align: "right",
                  width: 120,
                  render: (row) => {
                    const days = daysAgo(row.updated_at);
                    return (
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", color: "var(--text-primary)" }}>
                          {row.total_estimated != null ? formatMXN(row.total_estimated) : "—"}
                        </span>
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                          hace {days} {days === 1 ? "día" : "días"}
                        </span>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}
        </SectionCard>

      </div>
    </PageContainer>
  );
}
