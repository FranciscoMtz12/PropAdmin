"use client";

/*
  Portal de campo — Limpieza.

  Muestra los horarios de limpieza para la semana, resaltando el día de hoy.
  No hay records de limpieza completados — solo schedules.

  Secciones:
  - Limpiezas de edificio (exterior / áreas comunes) — por día
  - Limpiezas de unidad — por día
*/

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Building2, CheckCircle2, Home, Sparkles } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

type BuildingSchedule = {
  id: string;
  building_id: string;
  cleaning_type: "exterior" | "common";
  day_of_week: string;
  time_block: "morning" | "afternoon";
  buildingName?: string;
};

type UnitSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  day_of_week: string;
  start_time: string;
  duration_hours: number;
  active: boolean;
  buildingName?: string;
  unitCode?: string;
};

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};
const DAY_SHORT: Record<string, string> = {
  monday: "Lun", tuesday: "Mar", wednesday: "Mié",
  thursday: "Jue", friday: "Vie", saturday: "Sáb", sunday: "Dom",
};
const TIME_BLOCK_LABELS: Record<string, string> = {
  morning: "Mañana", afternoon: "Tarde",
};

const WEEK_DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

export default function CampoLimpiezaPage() {
  const { user, loading } = useCurrentUser();

  const [buildingSchedules, setBuildingSchedules] = useState<BuildingSchedule[]>([]);
  const [unitSchedules,     setUnitSchedules]     = useState<UnitSchedule[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(DAY_KEYS[new Date().getDay()]);

  useEffect(() => {
    if (!loading && user?.company_id) {
      void loadData(user.company_id);
    }
  }, [loading, user]);

  async function loadData(companyId: string) {
    setLoadingData(true);

    const [bsRes, usRes, bldRes] = await Promise.all([
      supabase
        .from("cleaning_building_schedules")
        .select("id, building_id, cleaning_type, day_of_week, time_block")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      supabase
        .from("cleaning_unit_schedules")
        .select("id, building_id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("company_id", companyId)
        .eq("active", true)
        .is("deleted_at", null),
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", companyId)
        .is("deleted_at", null),
    ]);

    const buildingMap = new Map<string, string>(
      (bldRes.data || []).map(b => [b.id, b.name])
    );

    // Need unit codes too
    const unitIds = [...new Set((usRes.data || []).map(u => u.unit_id))];
    let unitMap = new Map<string, string>();
    if (unitIds.length > 0) {
      const { data: unitsData } = await supabase
        .from("units")
        .select("id, unit_number, display_code")
        .in("id", unitIds);
      unitMap = new Map(
        (unitsData || []).map(u => [u.id, u.display_code || u.unit_number || "Unidad"])
      );
    }

    const bs: BuildingSchedule[] = (bsRes.data || []).map(s => ({
      ...s,
      buildingName: buildingMap.get(s.building_id) || "Edificio",
    }));

    const us: UnitSchedule[] = (usRes.data || []).map(s => ({
      ...s,
      buildingName: buildingMap.get(s.building_id) || "Edificio",
      unitCode:     unitMap.get(s.unit_id) || "Unidad",
    }));

    setBuildingSchedules(bs);
    setUnitSchedules(us);
    setLoadingData(false);
  }

  const todayKey = DAY_KEYS[new Date().getDay()];

  const filteredBS = useMemo(
    () => buildingSchedules.filter(s => s.day_of_week === selectedDay),
    [buildingSchedules, selectedDay]
  );

  const filteredUS = useMemo(
    () => unitSchedules.filter(s => s.day_of_week === selectedDay),
    [unitSchedules, selectedDay]
  );

  /* ── Styles ──────────────────────────────────────────────────── */
  const containerStyle: CSSProperties = {
    padding: "16px 16px 80px",
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  };

  const dayTabStyle = (key: string): CSSProperties => {
    const isToday  = key === todayKey;
    const isActive = key === selectedDay;
    return {
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "8px 12px",
      borderRadius: 12,
      border: isToday ? "2px solid var(--accent)" : "1px solid var(--border-default)",
      background: isActive ? "var(--accent)" : "var(--bg-card)",
      color: isActive ? "#fff" : isToday ? "var(--accent)" : "var(--text-secondary)",
      cursor: "pointer",
      fontWeight: isActive ? 700 : 500,
      WebkitTapHighlightColor: "transparent",
      minWidth: 52,
    };
  };

  const itemCardStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: 14,
  };

  const iconBoxStyle = (bg: string, color: string): CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 12,
    background: bg,
    color,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  });

  return (
    <div style={containerStyle}>

      {/* ── Título ───────────────────────────────────────────────── */}
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
        Limpieza
      </h2>

      {/* ── Selector de día ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          scrollbarWidth: "none",
          marginBottom: 20,
        }}
      >
        {WEEK_DAYS.map(day => (
          <button
            key={day}
            type="button"
            style={dayTabStyle(day)}
            onClick={() => setSelectedDay(day)}
          >
            <span style={{ fontSize: 11 }}>{DAY_SHORT[day]}</span>
            {day === todayKey && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.02em" }}>HOY</span>
            )}
          </button>
        ))}
      </div>

      {loadingData ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
      ) : (
        <>
          {/* ── Limpiezas de edificio ─────────────────────────── */}
          {filteredBS.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Edificio
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredBS.map(s => (
                  <div key={s.id} style={itemCardStyle}>
                    <div style={iconBoxStyle(
                      s.cleaning_type === "exterior" ? "var(--icon-bg-green)" : "var(--icon-bg-blue)",
                      s.cleaning_type === "exterior" ? "var(--icon-color-green)" : "var(--icon-color-blue)"
                    )}>
                      {s.cleaning_type === "exterior"
                        ? <Building2 size={18} />
                        : <Sparkles size={18} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {s.buildingName}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                        {s.cleaning_type === "exterior" ? "Exterior" : "Áreas comunes"}
                        {s.time_block ? ` · ${TIME_BLOCK_LABELS[s.time_block] || s.time_block}` : ""}
                      </p>
                    </div>
                    <CheckCircle2 size={20} style={{ color: "var(--border-default)", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Limpiezas de unidad ───────────────────────────── */}
          {filteredUS.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Unidades
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredUS.map(s => (
                  <div key={s.id} style={itemCardStyle}>
                    <div style={iconBoxStyle("var(--icon-bg-purple)", "var(--icon-color-purple)")}>
                      <Home size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {s.unitCode}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                        {s.buildingName}
                        {s.start_time ? ` · ${s.start_time.slice(0,5)}` : ""}
                        {s.duration_hours ? ` · ${s.duration_hours}h` : ""}
                      </p>
                    </div>
                    <CheckCircle2 size={20} style={{ color: "var(--border-default)", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredBS.length === 0 && filteredUS.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <Sparkles size={32} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-muted)", fontWeight: 500 }}>
                Sin limpiezas programadas para el {DAY_LABELS[selectedDay]}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
