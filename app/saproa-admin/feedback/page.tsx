"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppGrid from "@/components/AppGrid";
import MetricCard from "@/components/MetricCard";

type FeedbackType = "idea" | "problema" | "pregunta";
type FeedbackStatus = "nuevo" | "revisado" | "en_progreso" | "resuelto";

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  title: string;
  description: string | null;
  user_id: string;
  company_id: string;
  page_url: string | null;
  status: FeedbackStatus;
  created_at: string;
  userLabel: string;
};

const STATUS_ORDER: FeedbackStatus[] = ["nuevo", "revisado", "en_progreso", "resuelto"];

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  nuevo: "Nuevo",
  revisado: "Revisado",
  en_progreso: "En progreso",
  resuelto: "Resuelto",
};

const STATUS_VARIANT: Record<FeedbackStatus, "red" | "amber" | "blue" | "green"> = {
  nuevo: "red",
  revisado: "amber",
  en_progreso: "blue",
  resuelto: "green",
};

const TYPE_VARIANT: Record<FeedbackType, "blue" | "red" | "amber"> = {
  idea: "blue",
  problema: "red",
  pregunta: "amber",
};

const TYPE_ICON: Record<FeedbackType, React.ReactNode> = {
  idea:     <Lightbulb    size={12} />,
  problema: <AlertCircle  size={12} />,
  pregunta: <HelpCircle   size={12} />,
};

const TYPE_LABEL: Record<FeedbackType, string> = {
  idea: "Idea",
  problema: "Problema",
  pregunta: "Pregunta",
};

export default function SaproaFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    void loadFeedback();
  }, []);

  async function loadFeedback() {
    setLoadingData(true);

    const { data: feedbackData, error } = await supabase
      .from("feedback")
      .select("id, type, title, description, user_id, company_id, page_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("No se pudo cargar el buzón.");
      setLoadingData(false);
      return;
    }

    const raw = (feedbackData || []) as Omit<FeedbackRow, "userLabel">[];
    const userIds = Array.from(new Set(raw.map(r => r.user_id).filter(Boolean)));

    let userMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from("app_users")
        .select("id, full_name, email")
        .in("id", userIds);
      userMap = new Map(
        ((usersData || []) as { id: string; full_name: string | null; email: string | null }[])
          .map(u => [u.id, { full_name: u.full_name, email: u.email }]),
      );
    }

    const mapped: FeedbackRow[] = raw.map(r => {
      const u = userMap.get(r.user_id);
      return { ...r, userLabel: u?.full_name || u?.email || "Desconocido" };
    });

    setRows(mapped);
    setLoadingData(false);
  }

  async function cycleStatus(row: FeedbackRow) {
    const idx = STATUS_ORDER.indexOf(row.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    const { error } = await supabase.from("feedback").update({ status: next }).eq("id", row.id);
    if (error) { toast.error("No se pudo actualizar el estado."); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: next } : r));
  }

  if (loadingData) {
    return <PageContainer><div style={{ padding: "32px 0", color: "var(--text-muted)" }}>Cargando buzón...</div></PageContainer>;
  }

  const total   = rows.length;
  const pending = rows.filter(r => r.status === "nuevo").length;
  const resolved = rows.filter(r => r.status === "resuelto").length;

  return (
    <PageContainer>
      <PageHeader title="Buzón de feedback" titleIcon={<MessageSquare size={18} />} />

      <AppGrid minWidth={220}>
        <MetricCard label="Total" value={String(total)} helper="Todos los registros"
          icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-blue)", display: "grid", placeItems: "center" }}><MessageSquare size={18} color="#2563EB" /></div>}
        />
        <MetricCard label="Pendientes" value={String(pending)} helper="Sin revisar"
          icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-red)", display: "grid", placeItems: "center" }}><Clock3 size={18} color="#DC2626" /></div>}
        />
        <MetricCard label="Resueltos" value={String(resolved)} helper="Ya cerrados"
          icon={<div style={{ width: 36, height: 36, borderRadius: "var(--border-radius-md)", background: "var(--icon-bg-green)", display: "grid", placeItems: "center" }}><CheckCircle2 size={18} color="#16A34A" /></div>}
        />
      </AppGrid>

      <SectionCard title="Feedback recibido" icon={<MessageSquare size={18} />} style={{ marginTop: 16 }}>
        <AppTable<FeedbackRow>
          minWidth={900}
          columns={[
            { key: "type",   header: "Tipo",        render: row => <AppBadge variant={TYPE_VARIANT[row.type]}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{TYPE_ICON[row.type]}{TYPE_LABEL[row.type]}</span></AppBadge> },
            { key: "title",  header: "Título",      render: row => <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.title}</span> },
            { key: "desc",   header: "Descripción", render: row => <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{row.description || "—"}</span> },
            { key: "user",   header: "Usuario",     render: row => <span style={{ fontSize: 13 }}>{row.userLabel}</span> },
            { key: "page",   header: "Página",      render: row => row.page_url ? <span style={{ fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>{row.page_url}</span> : <span style={{ color: "var(--text-muted)" }}>—</span> },
            { key: "date",   header: "Fecha",       render: row => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(row.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span> },
            { key: "status", header: "Estado",      render: row => <button type="button" onClick={() => void cycleStatus(row)} title="Clic para avanzar estado" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><AppBadge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</AppBadge></button> },
          ]}
          rows={rows}
          emptyState="Aún no hay feedback recibido."
        />
      </SectionCard>
    </PageContainer>
  );
}
