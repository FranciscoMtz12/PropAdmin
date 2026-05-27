"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Droplets, Flame, MapPin, Settings, Wifi, Zap } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import CaptureUtilityReadingModal from "@/components/CaptureUtilityReadingModal";
import { sortByNatural, sortByAlphabetic } from "@/lib/sort-utils";
import type { BuildingUtilityMeter, BuildingUtilitySubMeter } from "@/lib/types";
import { SERVICE_TYPE_LABEL } from "@/lib/types";

const MONTH_NAMES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTH_SHORT  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

type SubMeterRow = BuildingUtilitySubMeter & {
  unit_number: string;
  building_name: string;
  active_lease: { tenant_name: string } | null;
};

type ReadingRow = {
  id: string;
  building_utility_sub_meter_id: string;
  current_reading: number;
  previous_reading: number;
  consumption: number | null;
  reading_date: string | null;
};

type Group = {
  building_id: string;
  building_name: string;
  meter: BuildingUtilityMeter;
  sub_meters: SubMeterRow[];
};

function ServiceIcon({ type, size = 20 }: { type: string; size?: number }) {
  switch (type) {
    case "electricity": return <Zap size={size} />;
    case "gas":         return <Flame size={size} />;
    case "water":       return <Droplets size={size} />;
    case "internet":    return <Wifi size={size} />;
    default:            return <Settings size={size} />;
  }
}

export default function CampoMedidoresPage() {
  const { user, loading } = useCurrentUser();
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [groups, setGroups] = useState<Group[]>([]);
  const [readings, setReadings]     = useState<ReadingRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [captureModal, setCaptureModal] = useState<{
    subMeter: SubMeterRow;
    previousReading: number;
  } | null>(null);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user, year, month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);

    // Load shared meters that generate charge
    const { data: mData } = await supabase
      .from("building_utility_meters")
      .select("*")
      .eq("company_id", user.company_id)
      .eq("meter_type", "shared")
      .eq("billing_mode", "charged")
      .eq("active", true)
      .is("deleted_at", null);

    const mList = (mData || []) as BuildingUtilityMeter[];
    if (mList.length === 0) { setGroups([]); setReadings([]); setPageLoading(false); return; }

    const buildingIds = [...new Set(mList.map(m => m.building_id))];
    const mIds        = mList.map(m => m.id);

    const [bRes, smRes] = await Promise.all([
      supabase.from("buildings").select("id, name").in("id", buildingIds),
      supabase
        .from("building_utility_sub_meters")
        .select("*")
        .in("building_utility_meter_id", mIds)
        .eq("active", true)
        .is("deleted_at", null),
    ]);

    const buildingMap: Record<string, string> = {};
    ((bRes.data || []) as Array<{ id: string; name: string }>).forEach(b => { buildingMap[b.id] = b.name; });

    const smList = (smRes.data || []) as BuildingUtilitySubMeter[];
    const unitIds = [...new Set(smList.map(sm => sm.unit_id))];

    const unitMap: Record<string, string> = {};
    const leasesByUnit = new Map<string, { tenant_name: string }>();

    if (unitIds.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const [uRes, lRes] = await Promise.all([
        supabase.from("units").select("id, unit_number").in("id", unitIds),
        supabase
          .from("leases")
          .select("id, unit_id, tenant:tenants(id, full_name)")
          .in("unit_id", unitIds)
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .lte("start_date", today)
          .or(`end_date.is.null,end_date.gte.${today}`),
      ]);

      ((uRes.data || []) as Array<{ id: string; unit_number: string }>).forEach(u => { unitMap[u.id] = u.unit_number; });
      ((lRes.data || []) as unknown as Array<{
        id: string; unit_id: string; tenant: { id: string; full_name: string } | null
      }>).forEach(l => {
        if (l.tenant) leasesByUnit.set(l.unit_id, { tenant_name: l.tenant.full_name });
      });
    }

    const smIds = smList.map(sm => sm.id);
    let periodReadings: ReadingRow[] = [];
    if (smIds.length > 0) {
      const { data: rData } = await supabase
        .from("building_utility_readings")
        .select("id, building_utility_sub_meter_id, current_reading, previous_reading, consumption, reading_date")
        .in("building_utility_sub_meter_id", smIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null);
      periodReadings = (rData || []) as ReadingRow[];
    }

    // Build enriched sub_meters
    const enrichedSubs: SubMeterRow[] = smList.map(sm => {
      const meter = mList.find(m => m.id === sm.building_utility_meter_id)!;
      return {
        ...sm,
        unit_number:  unitMap[sm.unit_id] ?? sm.unit_id.slice(0, 6),
        building_name: buildingMap[meter.building_id] ?? meter.building_id,
        active_lease: leasesByUnit.get(sm.unit_id) ?? null,
      };
    });

    // Build groups: one per meter
    const sortedBuildings = sortByAlphabetic(buildingIds, id => buildingMap[id]);
    const grps: Group[] = sortByNatural(mList, m => m.provider_name ?? m.service_type).map(meter => ({
      building_id:   meter.building_id,
      building_name: buildingMap[meter.building_id] ?? meter.building_id,
      meter,
      sub_meters: sortByNatural(
        enrichedSubs.filter(sm => sm.building_utility_meter_id === meter.id),
        sm => sm.unit_number,
      ),
    })).filter(g => g.sub_meters.length > 0);

    grps.sort((a, b) =>
      sortedBuildings.indexOf(a.building_id) - sortedBuildings.indexOf(b.building_id),
    );

    setGroups(grps);
    setReadings(periodReadings);
    setPageLoading(false);
  }

  const totalSubMeters = useMemo(() => groups.reduce((s, g) => s + g.sub_meters.length, 0), [groups]);
  const capturedCount  = readings.length;
  const pendingCount   = totalSubMeters - capturedCount;

  function navMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  }

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (!user) return null;
  const canAccess = (user as any).role === "superadmin" || (user as any).is_superadmin || (user as any).role === "field";
  if (!canAccess) return <div style={{ padding: 24 }}>Sin acceso.</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", paddingBottom: 80 }}>
      {/* Header compacto */}
      <div style={{ padding: "16px 16px 0", background: "var(--bg-card)", borderBottom: "1px solid var(--border-default)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Zap size={20} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: "var(--accent)" }}>Lecturas de medidores</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => navMonth(-1)} style={{ padding: "6px 10px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ flex: 1, textAlign: "center", fontSize: "0.9375rem", fontWeight: 700 }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" onClick={() => navMonth(1)} style={{ padding: "6px 10px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, paddingBottom: 12 }}>
          {([
            ["all",     "Todos",      totalSubMeters],
            ["pending", "Pendientes", pendingCount],
            ["done",    "Capturadas", capturedCount],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                border: `1px solid ${filter === key ? "var(--accent)" : "var(--border-default)"}`,
                background: filter === key ? "var(--accent)" : "var(--bg-card)",
                color: filter === key ? "#fff" : "var(--text-primary)",
              }}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {pageLoading ? (
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        ) : groups.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            <Zap size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontWeight: 600 }}>Sin medidores configurados</p>
          </div>
        ) : (
          groups.map(group => {
            const visible = group.sub_meters.filter(sm => {
              if (filter === "all") return true;
              const captured = readings.some(r => r.building_utility_sub_meter_id === sm.id);
              return filter === "done" ? captured : !captured;
            });
            if (visible.length === 0) return null;

            const meterLabel = group.meter.provider_name
              ? `${group.meter.provider_name} · ${SERVICE_TYPE_LABEL[group.meter.service_type]}`
              : SERVICE_TYPE_LABEL[group.meter.service_type];

            return (
              <div key={group.meter.id} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <MapPin size={14} />{group.building_name}
                  </span>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ServiceIcon type={group.meter.service_type} size={13} /> — {meterLabel}
                    {group.meter.meter_number ? ` · ${group.meter.meter_number}` : ""}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {visible.map(sm => {
                    const reading    = readings.find(r => r.building_utility_sub_meter_id === sm.id);
                    const isCaptured = !!reading;
                    return (
                      <div
                        key={sm.id}
                        onClick={() => {
                          const prevReading = reading?.previous_reading ?? sm.baseline_reading;
                          setCaptureModal({ subMeter: sm, previousReading: prevReading });
                        }}
                        style={{
                          padding: "14px 16px", borderRadius: "var(--border-radius-lg)", cursor: "pointer",
                          background: "var(--bg-card)",
                          border: `1px solid ${isCaptured ? "var(--metric-border-green)" : "var(--border-default)"}`,
                          borderLeft: `4px solid ${isCaptured ? "var(--metric-border-green)" : "#c2410c"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div>
                            <strong style={{ fontSize: "0.9375rem" }}>Depa {sm.unit_number}</strong>
                            {sm.sub_meter_number && (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 6 }}>({sm.sub_meter_number})</span>
                            )}
                            <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: sm.active_lease ? "var(--text-secondary)" : "var(--text-muted)" }}>
                              {sm.active_lease ? sm.active_lease.tenant_name : "Vacante"}
                            </p>
                          </div>
                          <span style={{
                            padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700,
                            background: isCaptured ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.08)",
                            color: isCaptured ? "var(--metric-value-green)" : "var(--metric-value-red)",
                          }}>
                            {isCaptured ? "Capturado" : "Pendiente"}
                          </span>
                        </div>
                        {isCaptured ? (
                          <>
                            <p style={{ margin: "8px 0 0", fontSize: "0.8125rem" }}>
                              Anterior: {reading.previous_reading} | Actual: {reading.current_reading}
                              {reading.consumption != null ? ` | Consumo: ${reading.consumption}` : ""}
                            </p>
                            {reading.reading_date && (
                              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Capturado el {formatShortDate(reading.reading_date)}
                              </p>
                            )}
                          </>
                        ) : (
                          <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                            Anterior: {sm.baseline_reading}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {captureModal && (
        <CaptureUtilityReadingModal
          isOpen
          subMeter={captureModal.subMeter}
          meter={groups.find(g => g.sub_meters.some(sm => sm.id === captureModal.subMeter.id))!.meter}
          activeLease={captureModal.subMeter.active_lease}
          period={{ year, month }}
          previousReading={captureModal.previousReading}
          onClose={() => setCaptureModal(null)}
          onSuccess={async () => {
            setCaptureModal(null);
            toast.success("Lectura capturada");
            await loadData();
          }}
        />
      )}
    </div>
  );
}
