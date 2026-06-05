"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, History } from "lucide-react";
import { differenceInSeconds, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

import { supabase } from "@/lib/supabaseClient";
import { staggerContainer, staggerItem } from "@/lib/animations";
import AppBadge from "@/components/AppBadge";
import AppCard from "@/components/AppCard";
import AppEmptyState from "@/components/AppEmptyState";
import AppSelect from "@/components/AppSelect";
import Modal from "@/components/Modal";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import UiButton from "@/components/UiButton";

const SAPROA_ACCENT = "#6366F1";

type ImpersonationSession = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  mode: "company" | "user" | "group";
  target_company_id: string | null;
  target_company_name: string | null;
  target_user_id: string | null;
  target_user_email: string | null;
  target_user_full_name: string | null;
  target_user_role: string | null;
  target_group_id: string | null;
  target_group_name: string | null;
  started_at: string;
  ended_at: string | null;
};

const MODE_LABEL: Record<string, string> = {
  company: "Empresa",
  user: "Usuario",
  group: "Grupo",
};

const MODE_VARIANT: Record<string, "blue" | "green" | "amber"> = {
  company: "blue",
  user: "green",
  group: "amber",
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "En curso";
  const secs = differenceInSeconds(parseISO(endedAt), parseISO(startedAt));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins < 60) return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es });
}

function generateSessionMd(s: ImpersonationSession): string {
  const now = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });
  const lines = [
    `# Sesión de Impersonación`,
    ``,
    `**ID:** \`${s.id}\``,
    `**Modo:** ${MODE_LABEL[s.mode] ?? s.mode}`,
    `**Inicio:** ${formatDate(s.started_at)}`,
    `**Fin:** ${s.ended_at ? formatDate(s.ended_at) : "En curso"}`,
    `**Duración:** ${formatDuration(s.started_at, s.ended_at)}`,
    ``,
    `## Actor`,
    `- **Email:** ${s.actor_email ?? "—"}`,
    `- **ID:** \`${s.actor_id ?? "—"}\``,
    ``,
    `## Objetivo`,
  ];

  if (s.mode === "group") {
    lines.push(`- **Grupo:** ${s.target_group_name ?? "—"}`);
    if (s.target_group_id) lines.push(`- **ID Grupo:** \`${s.target_group_id}\``);
  } else {
    lines.push(`- **Empresa:** ${s.target_company_name ?? "—"}`);
    if (s.target_company_id) lines.push(`- **ID Empresa:** \`${s.target_company_id}\``);
    if (s.mode === "user") {
      lines.push(`- **Usuario:** ${s.target_user_full_name ?? s.target_user_email ?? "—"}`);
      lines.push(`- **Email:** ${s.target_user_email ?? "—"}`);
      lines.push(`- **Rol:** ${s.target_user_role ?? "—"}`);
    }
  }

  lines.push(``, `---`, `*Generado por SAPROA · ${now}*`);
  return lines.join("\n");
}

function downloadSessionMd(s: ImpersonationSession) {
  const blob = new Blob([generateSessionMd(s)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sesion-${s.id.slice(0, 8)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function AuditoriaPage() {
  const [sessions,         setSessions]         = useState<ImpersonationSession[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [selectedSession,  setSelectedSession]  = useState<ImpersonationSession | null>(null);

  /* filtros */
  const [modeFilter,    setModeFilter]    = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [actorFilter,   setActorFilter]   = useState("");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");

  useEffect(() => { void loadSessions(); }, []);

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from("impersonation_sessions")
      .select("*")
      .order("started_at", { ascending: false });
    setSessions((data as ImpersonationSession[]) ?? []);
    setLoading(false);
  }

  const uniqueTargets = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => {
      if (s.target_company_name) set.add(s.target_company_name);
      if (s.target_group_name) set.add(s.target_group_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const uniqueActors = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => { if (s.actor_email) set.add(s.actor_email); });
    return Array.from(set).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (modeFilter !== "all" && s.mode !== modeFilter) return false;
      if (companyFilter) {
        const name = s.target_company_name ?? s.target_group_name ?? "";
        if (name !== companyFilter) return false;
      }
      if (actorFilter && s.actor_email !== actorFilter) return false;
      if (dateFrom) {
        if (new Date(s.started_at) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        if (new Date(s.started_at) >= end) return false;
      }
      return true;
    });
  }, [sessions, modeFilter, companyFilter, actorFilter, dateFrom, dateTo]);

  const hasFilters = modeFilter !== "all" || companyFilter || actorFilter || dateFrom || dateTo;

  function clearFilters() {
    setModeFilter("all");
    setCompanyFilter("");
    setActorFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Auditoría de impersonación"
        subtitle="Historial de sesiones de vista simulada"
        titleIcon={<History size={18} />}
      />

      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-lg)",
        padding: "14px 18px",
        marginBottom: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
      }}>
        {/* Pills de modo */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {[
            { key: "all",     label: "Todos"   },
            { key: "company", label: "Empresa" },
            { key: "user",    label: "Usuario" },
            { key: "group",   label: "Grupo"   },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setModeFilter(key)}
              style={{
                padding: "5px 12px",
                borderRadius: "var(--border-radius-full)",
                border: `1px solid ${modeFilter === key ? SAPROA_ACCENT : "var(--border-default)"}`,
                background: modeFilter === key ? `${SAPROA_ACCENT}18` : "transparent",
                color: modeFilter === key ? SAPROA_ACCENT : "var(--text-secondary)",
                fontSize: "0.75rem",
                fontWeight: modeFilter === key ? 700 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: "var(--border-default)", flexShrink: 0 }} />

        {/* Select empresa/grupo */}
        <AppSelect
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
          style={{ width: 170, padding: "6px 10px", fontSize: "0.8125rem" }}
        >
          <option value="">Todas las empresas</option>
          {uniqueTargets.map(t => <option key={t} value={t}>{t}</option>)}
        </AppSelect>

        {/* Select actor */}
        <AppSelect
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
          style={{ width: 190, padding: "6px 10px", fontSize: "0.8125rem" }}
        >
          <option value="">Todos los actores</option>
          {uniqueActors.map(a => <option key={a} value={a}>{a}</option>)}
        </AppSelect>

        {/* Rango de fecha */}
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--border-radius-md)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: "0.8125rem",
          }}
        />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>–</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--border-radius-md)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: "0.8125rem",
          }}
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              flexShrink: 0,
              padding: 0,
            }}
          >
            Limpiar
          </button>
        )}

        {/* Conteo */}
        {!loading && (
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
            {filtered.length} {filtered.length === 1 ? "sesión" : "sesiones"}
          </span>
        )}
      </div>

      {/* ── Contenido ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Cargando historial...
        </div>
      ) : filtered.length === 0 ? (
        <AppEmptyState
          title="Sin sesiones registradas"
          description={
            hasFilters
              ? "No hay sesiones que coincidan con los filtros seleccionados."
              : "Aún no se ha registrado ninguna sesión de impersonación. Las sesiones aparecen aquí al usar la vista simulada."
          }
          actionLabel={hasFilters ? "Limpiar filtros" : undefined}
          onAction={hasFilters ? clearFilters : undefined}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map(session => (
            <motion.div key={session.id} variants={staggerItem}>
              <SessionCard session={session} onClick={() => setSelectedSession(session)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Modal de detalle ──────────────────────────────────────── */}
      <Modal
        open={selectedSession !== null}
        title="Detalle de sesión"
        subtitle={selectedSession ? formatDate(selectedSession.started_at) : ""}
        onClose={() => setSelectedSession(null)}
        maxWidth={500}
      >
        {selectedSession && (
          <SessionDetail
            session={selectedSession}
            onDownload={() => downloadSessionMd(selectedSession)}
          />
        )}
      </Modal>
    </PageContainer>
  );
}

/* ─── SessionCard ────────────────────────────────────────────────── */

function SessionCard({
  session,
  onClick,
}: {
  session: ImpersonationSession;
  onClick: () => void;
}) {
  const target   = session.mode === "group" ? session.target_group_name : session.target_company_name;
  const duration = formatDuration(session.started_at, session.ended_at);
  const isActive = !session.ended_at;

  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      <AppCard style={{ padding: "15px 17px", transition: "box-shadow 0.15s, border-color 0.15s" }}>
        {/* Fila superior: badge + fecha */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <AppBadge variant={MODE_VARIANT[session.mode] ?? "gray"}>
            {MODE_LABEL[session.mode] ?? session.mode}
          </AppBadge>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", flexShrink: 0 }}>
            {formatDate(session.started_at)}
          </span>
        </div>

        {/* Empresa / grupo */}
        <div style={{
          fontSize: "0.9375rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: session.mode === "user" ? 3 : 10,
        }}>
          {target ?? "—"}
        </div>

        {/* Usuario (solo modo user) */}
        {session.mode === "user" && (
          <div style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 10,
          }}>
            {session.target_user_full_name ?? session.target_user_email ?? "—"}
          </div>
        )}

        {/* Fila inferior: actor + duración */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: "0.6875rem",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "58%",
          }}>
            {session.actor_email ?? "—"}
          </span>
          <span style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: isActive ? "#10B981" : "var(--text-secondary)",
            background: isActive ? "#10B98118" : "transparent",
            border: isActive ? "1px solid #10B98130" : "none",
            padding: isActive ? "2px 8px" : undefined,
            borderRadius: "var(--border-radius-full)",
            flexShrink: 0,
          }}>
            {duration}
          </span>
        </div>

        {/* Hint */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 8, gap: 3 }}>
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Ver detalle</span>
          <ChevronRight size={10} color="var(--text-muted)" />
        </div>
      </AppCard>
    </div>
  );
}

/* ─── SessionDetail (contenido del modal) ────────────────────────── */

function SessionDetail({
  session,
  onDownload,
}: {
  session: ImpersonationSession;
  onDownload: () => void;
}) {
  const duration = formatDuration(session.started_at, session.ended_at);
  const isActive = !session.ended_at;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Banner sesión activa */}
      {isActive && (
        <div style={{
          background: "#10B98112",
          border: "1px solid #10B98128",
          borderRadius: "var(--border-radius-md)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
          <span style={{ fontSize: "0.8125rem", color: "#10B981", fontWeight: 600 }}>Sesión en curso</span>
        </div>
      )}

      {/* Grid de campos básicos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <DetailField label="Modo" value={
          <AppBadge variant={MODE_VARIANT[session.mode] ?? "gray"}>
            {MODE_LABEL[session.mode]}
          </AppBadge>
        } />
        <DetailField label="Duración" value={duration} />
        <DetailField label="Inicio" value={formatDate(session.started_at)} />
        <DetailField label="Fin" value={session.ended_at ? formatDate(session.ended_at) : "En curso"} />
      </div>

      {/* Actor */}
      <InfoBlock label="Actor" rows={[
        session.actor_email ?? "—",
        session.actor_id ?? "",
      ]} mono={[false, true]} />

      {/* Objetivo */}
      {session.mode === "group" ? (
        <InfoBlock label="Grupo" rows={[
          session.target_group_name ?? "—",
          session.target_group_id ?? "",
        ]} mono={[false, true]} />
      ) : (
        <InfoBlock label="Empresa objetivo" rows={[
          session.target_company_name ?? "—",
          session.target_company_id ?? "",
        ]} mono={[false, true]} />
      )}

      {/* Usuario impersonado */}
      {session.mode === "user" && (
        <InfoBlock label="Usuario impersonado" rows={[
          session.target_user_full_name ?? session.target_user_email ?? "—",
          session.target_user_email ?? "",
          session.target_user_role ? `Rol: ${session.target_user_role}` : "",
        ]} mono={[false, false, false]} />
      )}

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
        Las acciones realizadas durante la sesión estarán disponibles en la Fase 2.
      </p>

      <UiButton variant="secondary" onClick={onDownload} icon={<Download size={14} />}>
        Descargar reporte .md
      </UiButton>
    </div>
  );
}

/* ─── Sub-componentes de detail ──────────────────────────────────── */

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function InfoBlock({
  label,
  rows,
  mono,
}: {
  label: string;
  rows: string[];
  mono: boolean[];
}) {
  const visible = rows.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div>
      <div style={{
        fontSize: "0.6875rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--text-muted)",
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        background: "var(--bg-page, #F1F5F9)",
        borderRadius: "var(--border-radius-md)",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}>
        {rows.map((row, i) =>
          row ? (
            <span
              key={i}
              style={{
                fontSize: mono[i] ? "0.6875rem" : "0.875rem",
                fontWeight: mono[i] ? 400 : (i === 0 ? 600 : 400),
                fontFamily: mono[i] ? "monospace" : undefined,
                color: mono[i] || i > 0 ? "var(--text-muted)" : "var(--text-primary)",
                wordBreak: "break-all",
              }}
            >
              {row}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
