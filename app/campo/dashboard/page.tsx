"use client";

/*
  Dashboard del portal de campo.

  Muestra:
  - Saludo con nombre del usuario y fecha de hoy
  - Tarjeta: tickets abiertos (pending + in_progress)
  - Tarjeta: limpiezas programadas para hoy
  - Accesos rápidos a las 3 secciones
*/

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Ticket, Wrench } from "lucide-react";
import type { CSSProperties } from "react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

const DAY_NAMES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function formatTodayLong() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export default function CampoDashboardPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [openTickets,   setOpenTickets]   = useState<number | null>(null);
  const [todayCleanings, setTodayCleanings] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && user?.company_id) {
      void loadData(user.company_id);
    }
  }, [loading, user]);

  async function loadData(companyId: string) {
    setLoadingData(true);
    const todayKey = DAY_KEYS[new Date().getDay()];

    const [ticketsRes, buildingCleanRes, unitCleanRes] = await Promise.all([
      supabase
        .from("maintenance_logs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("status", ["pending", "in_progress"])
        .is("deleted_at", null),

      supabase
        .from("cleaning_building_schedules")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("day_of_week", todayKey)
        .is("deleted_at", null),

      supabase
        .from("cleaning_unit_schedules")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("day_of_week", todayKey)
        .eq("active", true)
        .is("deleted_at", null),
    ]);

    setOpenTickets(ticketsRes.count ?? 0);
    setTodayCleanings((buildingCleanRes.count ?? 0) + (unitCleanRes.count ?? 0));
    setLoadingData(false);
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = user?.full_name?.split(" ")[0] || "";

  /* ── Styles ──────────────────────────────────────────────────── */
  const containerStyle: CSSProperties = {
    padding: "24px 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  };

  const metricCardStyle = (color: string, bg: string, border: string): CSSProperties => ({
    padding: "20px 18px",
    borderRadius: 16,
    background: bg,
    border: `1px solid ${border}`,
    display: "flex",
    alignItems: "center",
    gap: 16,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  });

  const metricIconStyle = (iconBg: string, iconColor: string): CSSProperties => ({
    width: 48,
    height: 48,
    borderRadius: 14,
    background: iconBg,
    color: iconColor,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  });

  const quickCardStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "18px 12px",
    borderRadius: 16,
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    cursor: "pointer",
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
    minHeight: 90,
  };

  return (
    <div style={containerStyle}>

      {/* ── Saludo ──────────────────────────────────────────────── */}
      <div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", textTransform: "capitalize" }}>
          {formatTodayLong()}
        </p>
        <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      {/* ── Métricas ────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        <div
          style={metricCardStyle("amber", "var(--metric-bg-amber)", "var(--metric-border-amber)")}
          onClick={() => router.push("/campo/tickets")}
          role="button"
          tabIndex={0}
        >
          <div style={metricIconStyle("var(--icon-bg-amber)", "var(--icon-color-amber)")}>
            <Wrench size={22} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tickets abiertos
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 800, color: "var(--metric-value-amber)", lineHeight: 1 }}>
              {loadingData ? "—" : openTickets}
            </p>
          </div>
        </div>

        <div
          style={metricCardStyle("blue", "var(--metric-bg-blue)", "var(--metric-border-blue)")}
          onClick={() => router.push("/campo/limpieza")}
          role="button"
          tabIndex={0}
        >
          <div style={metricIconStyle("var(--icon-bg-blue)", "var(--icon-color-blue)")}>
            <Sparkles size={22} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Limpiezas hoy
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 800, color: "var(--metric-value-blue)", lineHeight: 1 }}>
              {loadingData ? "—" : todayCleanings}
            </p>
          </div>
        </div>

      </div>

      {/* ── Accesos rápidos ─────────────────────────────────────── */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Accesos rápidos
        </p>
        <div style={{ display: "flex", gap: 10 }}>

          <a href="/campo/tickets" style={quickCardStyle}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--icon-bg-amber)", color: "var(--icon-color-amber)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wrench size={20} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
              Tickets
            </span>
          </a>

          <a href="/campo/limpieza" style={quickCardStyle}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--icon-bg-blue)", color: "var(--icon-color-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={20} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
              Limpieza
            </span>
          </a>

          <a href="/campo/assets" style={quickCardStyle}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--icon-bg-green)", color: "var(--icon-color-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ticket size={20} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
              Activos
            </span>
          </a>

        </div>
      </div>

    </div>
  );
}
