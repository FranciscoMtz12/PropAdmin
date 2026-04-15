"use client";

/*
  Portal de campo — Tickets de mantenimiento.

  Lista tickets con filtros por estado.
  FAB para crear nuevo ticket.
  Modal de creación con cámara (input file accept="image/*" capture="environment").
*/

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Camera, Plus, X } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

type Ticket = {
  id: string;
  ticket_number: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  buildings: { name: string } | null;
  units: { display_code: string | null; unit_number: string | null } | null;
};

type Building = { id: string; name: string };

type StatusFilter = "all" | "pending" | "in_progress" | "resolved";

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pendiente",
  in_progress: "En proceso",
  resolved:    "Resuelto",
  cancelled:   "Cancelado",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--badge-text-red)",
  high:   "var(--badge-text-amber)",
  normal: "var(--badge-text-blue)",
  low:    "var(--text-muted)",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  pending:     { bg: "var(--badge-bg-amber)",  text: "var(--badge-text-amber)"  },
  in_progress: { bg: "var(--badge-bg-blue)",   text: "var(--badge-text-blue)"   },
  resolved:    { bg: "var(--badge-bg-green)",  text: "var(--badge-text-green)"  },
  cancelled:   { bg: "var(--badge-bg-gray)",   text: "var(--badge-text-gray)"   },
};

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",         label: "Todos"      },
  { key: "pending",     label: "Pendiente"  },
  { key: "in_progress", label: "En proceso" },
  { key: "resolved",    label: "Resuelto"   },
];

export default function CampoTicketsPage() {
  const { user, loading } = useCurrentUser();

  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [buildings,  setBuildings]  = useState<Building[]>([]);
  const [filter,     setFilter]     = useState<StatusFilter>("all");
  const [loadingData, setLoadingData] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  /* Create form */
  const [cTitle,      setCTitle]      = useState("");
  const [cBuilding,   setCBuilding]   = useState("");
  const [cPriority,   setCPriority]   = useState("normal");
  const [cDesc,       setCDesc]       = useState("");
  const [cPhoto,      setCPhoto]      = useState<File | null>(null);
  const [cPhotoUrl,   setCPhotoUrl]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [createError, setCreateError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user?.company_id) {
      void loadData(user.company_id);
    }
  }, [loading, user]);

  async function loadData(companyId: string) {
    setLoadingData(true);
    const [ticketsRes, buildingsRes] = await Promise.all([
      supabase
        .from("maintenance_logs")
        .select(`
          id, ticket_number, title, status, priority, created_at,
          buildings(name),
          units(display_code, unit_number)
        `)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name"),
    ]);
    setTickets((ticketsRes.data as unknown as Ticket[]) || []);
    setBuildings(buildingsRes.data || []);
    setLoadingData(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCPhoto(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setCPhotoUrl(url);
    } else {
      setCPhotoUrl(null);
    }
  }

  async function handleCreate() {
    if (!user?.company_id) return;
    if (!cTitle.trim()) { setCreateError("Escribe un título."); return; }
    setCreateError("");
    setSaving(true);

    let photoUrls: string[] = [];

    if (cPhoto) {
      const ext  = cPhoto.name.split(".").pop() || "jpg";
      const path = `maintenance/${user.company_id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("maintenance-photos")
        .upload(path, cPhoto);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("maintenance-photos")
          .getPublicUrl(path);
        if (urlData?.publicUrl) photoUrls = [urlData.publicUrl];
      }
    }

    const { error } = await supabase.from("maintenance_logs").insert({
      company_id:  user.company_id,
      building_id: cBuilding || null,
      title:       cTitle.trim(),
      description: cDesc.trim() || null,
      priority:    cPriority,
      status:      "pending",
      log_type:    "corrective",
      photos:      photoUrls,
      reported_by: user.full_name || user.email,
    });

    setSaving(false);

    if (error) {
      setCreateError("No se pudo crear el ticket.");
      return;
    }

    setCTitle(""); setCBuilding(""); setCPriority("normal");
    setCDesc(""); setCPhoto(null); setCPhotoUrl(null);
    setCreateOpen(false);
    void loadData(user.company_id);
  }

  const filtered = filter === "all"
    ? tickets
    : tickets.filter(t => t.status === filter);

  /* ── Styles ──────────────────────────────────────────────────── */
  const containerStyle: CSSProperties = {
    padding: "16px 16px 80px",
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    flexShrink: 0,
    padding: "7px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#fff" : "var(--text-secondary)",
    transition: "background 0.15s",
    WebkitTapHighlightColor: "transparent",
  });

  const cardStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: 14,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  const fabStyle: CSSProperties = {
    position: "fixed",
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0,0,0,0.24)",
    zIndex: 50,
    WebkitTapHighlightColor: "transparent",
  };

  /* Modal */
  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-end",
  };

  const sheetStyle: CSSProperties = {
    width: "100%",
    maxHeight: "90dvh",
    overflowY: "auto",
    background: "var(--bg-card)",
    borderRadius: "20px 20px 0 0",
    padding: "24px 20px 36px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-default)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: 15,
    boxSizing: "border-box",
  };

  const selectStyle: CSSProperties = { ...inputStyle };

  return (
    <div style={containerStyle}>

      {/* ── Título ───────────────────────────────────────────────── */}
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
        Tickets
      </h2>

      {/* ── Tabs de filtro ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          scrollbarWidth: "none",
          marginBottom: 16,
        }}
      >
        {TABS.map(tab => (
          <button key={tab.key} type="button" style={tabStyle(filter === tab.key)} onClick={() => setFilter(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {loadingData ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Sin tickets.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(t => {
            const badge = STATUS_BADGE[t.status] || STATUS_BADGE.pending;
            const buildingName = t.buildings?.name;
            const unitCode = t.units?.display_code || t.units?.unit_number;
            return (
              <div key={t.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>
                    {t.title}
                  </span>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.text,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {t.ticket_number && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      #{t.ticket_number}
                    </span>
                  )}
                  {buildingName && (
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {buildingName}{unitCode ? ` · ${unitCode}` : ""}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: PRIORITY_COLORS[t.priority] || "var(--text-muted)",
                    }}
                  >
                    {t.priority === "urgent" ? "URGENTE" : t.priority === "high" ? "Alta" : t.priority === "low" ? "Baja" : "Normal"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FAB ─────────────────────────────────────────────────── */}
      <button type="button" style={fabStyle} onClick={() => setCreateOpen(true)} aria-label="Nuevo ticket">
        <Plus size={24} />
      </button>

      {/* ── Modal crear ticket ──────────────────────────────────── */}
      {createOpen && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
          <div style={sheetStyle}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                Nuevo ticket
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Título *
                </label>
                <input
                  value={cTitle}
                  onChange={e => setCTitle(e.target.value)}
                  placeholder="Describe el problema..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Edificio
                </label>
                <select value={cBuilding} onChange={e => setCBuilding(e.target.value)} style={selectStyle}>
                  <option value="">Sin edificio específico</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Prioridad
                </label>
                <select value={cPriority} onChange={e => setCPriority(e.target.value)} style={selectStyle}>
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Descripción
                </label>
                <textarea
                  value={cDesc}
                  onChange={e => setCDesc(e.target.value)}
                  rows={3}
                  placeholder="Detalles adicionales..."
                  style={{ ...inputStyle, resize: "vertical" as const }}
                />
              </div>

              {/* Foto con cámara */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Foto (opcional)
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handlePhotoChange}
                />
                {cPhotoUrl ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={cPhotoUrl}
                      alt="Foto adjunta"
                      style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border-default)" }}
                    />
                    <button
                      type="button"
                      onClick={() => { setCPhoto(null); setCPhotoUrl(null); }}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.6)",
                        border: "none",
                        borderRadius: "50%",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: "14px 12px",
                      borderRadius: 10,
                      border: "1.5px dashed var(--border-strong)",
                      background: "var(--bg-page)",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <Camera size={18} />
                    Tomar foto o seleccionar
                  </button>
                )}
              </div>

              {createError && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--badge-text-red)" }}>{createError}</p>
              )}

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {saving ? "Guardando..." : "Crear ticket"}
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
