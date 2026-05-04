"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import CaptureReadingModal from "@/components/CaptureReadingModal";

type Assignment = {
  id: string;
  meter_id: string;
  unit_id: string;
  meter_number: string;
  unit_name: string;
  building_id: string;
  building_name: string;
  last_reading_kwh: number | null;
  last_reading_date: string | null;
};

type Building = { id: string; name: string };

export default function CampoMedidoresPage() {
  const { user, loading } = useCurrentUser();

  const [assignments,  setAssignments]  = useState<Assignment[]>([]);
  const [buildings,    setBuildings]    = useState<Building[]>([]);
  const [filterBld,    setFilterBld]    = useState("all");
  const [loadingData,  setLoadingData]  = useState(true);

  const [captureTarget, setCaptureTarget] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!loading && user?.company_id) void loadData(user.company_id);
  }, [loading, user]);

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const { data: rawAssignments, error } = await supabase
        .from("unit_meter_assignments")
        .select(`
          id,
          meter_id,
          unit_id,
          electricity_meters ( meter_number, building_id,
            buildings ( name )
          ),
          units ( name )
        `)
        .eq("company_id", companyId)
        .is("unassigned_at", null)
        .is("electricity_meters.deleted_at", null);

      if (error) throw error;

      const assignmentIds = (rawAssignments ?? []).map((a: any) => a.id);
      let lastReadingsMap: Record<string, { reading_kwh: number; reading_date: string }> = {};

      if (assignmentIds.length > 0) {
        const meterIds = [...new Set((rawAssignments ?? []).map((a: any) => a.meter_id as string))];
        const { data: readings } = await supabase
          .from("electricity_readings")
          .select("meter_id, unit_id, reading_kwh, reading_date")
          .eq("company_id", companyId)
          .in("meter_id", meterIds)
          .order("reading_date", { ascending: false });

        const seen = new Set<string>();
        for (const r of readings ?? []) {
          const key = `${r.meter_id}:${r.unit_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            lastReadingsMap[key] = { reading_kwh: r.reading_kwh, reading_date: r.reading_date };
          }
        }
      }

      const mapped: Assignment[] = (rawAssignments ?? [])
        .filter((a: any) => a.electricity_meters)
        .map((a: any) => {
          const meter = a.electricity_meters as any;
          const building = meter.buildings as any;
          const key = `${a.meter_id}:${a.unit_id}`;
          const last = lastReadingsMap[key] ?? null;
          return {
            id: a.id,
            meter_id: a.meter_id,
            unit_id: a.unit_id,
            meter_number: meter.meter_number,
            unit_name: (a.units as any)?.name ?? a.unit_id,
            building_id: meter.building_id,
            building_name: building?.name ?? "Edificio",
            last_reading_kwh: last?.reading_kwh ?? null,
            last_reading_date: last?.reading_date ?? null,
          };
        });

      setAssignments(mapped);

      const bldMap = new Map<string, string>();
      mapped.forEach((a) => bldMap.set(a.building_id, a.building_name));
      setBuildings(Array.from(bldMap.entries()).map(([id, name]) => ({ id, name })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar medidores");
    } finally {
      setLoadingData(false);
    }
  }

  const filtered = useMemo(
    () => filterBld === "all" ? assignments : assignments.filter((a) => a.building_id === filterBld),
    [assignments, filterBld],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { building_name: string; items: Assignment[] }>();
    for (const a of filtered) {
      if (!map.has(a.building_id)) map.set(a.building_id, { building_name: a.building_name, items: [] });
      map.get(a.building_id)!.items.push(a);
    }
    return Array.from(map.values());
  }, [filtered]);

  if (loading || loadingData) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 15 }}>Cargando medidores…</span>
      </div>
    );
  }

  const pillBase: React.CSSProperties = {
    padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
    border: "1px solid var(--border-default)", cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-default)", padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Zap size={20} color="#ca8a04" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Medidores</h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          {assignments.length} asignaciones activas
        </p>
      </div>

      {/* Filter pills */}
      {buildings.length > 1 && (
        <div style={{ padding: "12px 16px", overflowX: "auto", display: "flex", gap: 8 }}>
          <button
            style={{
              ...pillBase,
              background: filterBld === "all" ? "var(--accent)" : "var(--bg-card)",
              color: filterBld === "all" ? "#fff" : "var(--text-primary)",
              borderColor: filterBld === "all" ? "var(--accent)" : "var(--border-default)",
            }}
            onClick={() => setFilterBld("all")}
          >
            Todos
          </button>
          {buildings.map((b) => (
            <button
              key={b.id}
              style={{
                ...pillBase,
                background: filterBld === b.id ? "var(--accent)" : "var(--bg-card)",
                color: filterBld === b.id ? "#fff" : "var(--text-primary)",
                borderColor: filterBld === b.id ? "var(--accent)" : "var(--border-default)",
              }}
              onClick={() => setFilterBld(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "8px 16px" }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)", fontSize: 14 }}>
            <Zap size={32} style={{ opacity: 0.3, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
            Sin medidores asignados
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.building_name} style={{ marginBottom: 24 }}>
              <p style={{ margin: "12px 0 8px", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {group.building_name}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.items.map((a) => {
                  const hasPending = a.last_reading_date === null;
                  return (
                    <div
                      key={a.id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: hasPending ? "#fef3c7" : "#dcfce7",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Zap size={18} color={hasPending ? "#92400e" : "#15803d"} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                          {a.unit_name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          Medidor {a.meter_number}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          {a.last_reading_kwh !== null
                            ? `Última: ${a.last_reading_kwh} kWh · ${a.last_reading_date}`
                            : "Sin lecturas aún"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCaptureTarget(a)}
                        style={{
                          flexShrink: 0, padding: "8px 14px", borderRadius: 8,
                          border: "1px solid #15803d", background: "#15803d",
                          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Capturar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Capture modal */}
      {captureTarget && user && (
        <CaptureReadingModal
          isOpen={!!captureTarget}
          onClose={() => setCaptureTarget(null)}
          onSuccess={() => { setCaptureTarget(null); void loadData(user.company_id!); }}
          assignment={captureTarget}
          lastReading={
            captureTarget.last_reading_kwh !== null && captureTarget.last_reading_date !== null
              ? { reading_kwh: captureTarget.last_reading_kwh, reading_date: captureTarget.last_reading_date }
              : null
          }
          companyId={user.company_id!}
          userId={user.id}
        />
      )}
    </div>
  );
}
