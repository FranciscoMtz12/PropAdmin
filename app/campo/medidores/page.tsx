"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Zap } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import CaptureReadingModal, { type ActiveLeaseInfo } from "@/components/CaptureReadingModal";
import { sortByNatural, sortByAlphabetic } from "@/lib/sort-utils";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type InternalMeterRow = {
  id: string;
  cfe_meter_id: string;
  unit_id: string;
  unit_number?: string;
  building_name?: string;
  building_id?: string;
  cfe_meter_number?: string;
  active_lease: ActiveLeaseInfo | null;
  baseline_reading: number;
};

type ReadingRow = {
  id: string;
  internal_meter_id: string;
  current_reading: number;
  previous_reading: number;
  consumption: number;
};

type Group = {
  building_name: string;
  building_id: string;
  cfe_meter_id: string;
  cfe_meter_number: string;
  internal_meters: InternalMeterRow[];
};

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
    internalMeter: InternalMeterRow;
    previousReading: number;
  } | null>(null);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user, year, month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);

    const { data: cfeMData } = await supabase
      .from("cfe_meters")
      .select("id, meter_number, building_id")
      .eq("company_id", user.company_id)
      .eq("service_type", "shared")
      .is("deleted_at", null);
    const cfeMList = (cfeMData || []) as Array<{ id: string; meter_number: string; building_id: string }>;
    if (cfeMList.length === 0) { setGroups([]); setReadings([]); setPageLoading(false); return; }

    const buildingIds = [...new Set(cfeMList.map(m => m.building_id))];
    const { data: bData } = await supabase.from("buildings").select("id, name").in("id", buildingIds);
    const buildingMap: Record<string, string> = {};
    ((bData || []) as Array<{ id: string; name: string }>).forEach(b => { buildingMap[b.id] = b.name; });

    const cfeIds = cfeMList.map(m => m.id);
    const { data: imData } = await supabase
      .from("internal_meters")
      .select("id, cfe_meter_id, unit_id, baseline_reading")
      .in("cfe_meter_id", cfeIds)
      .eq("active", true)
      .is("deleted_at", null);
    const imList = (imData || []) as Array<{
      id: string; cfe_meter_id: string; unit_id: string; baseline_reading: number;
    }>;

    const unitIds = [...new Set(imList.map(im => im.unit_id))];
    const unitMap: Record<string, string> = {};
    const leasesByUnit = new Map<string, ActiveLeaseInfo>();

    if (unitIds.length > 0) {
      const { data: uData } = await supabase
        .from("units")
        .select("id, unit_number")
        .in("id", unitIds);
      ((uData || []) as Array<{ id: string; unit_number: string }>).forEach(u => { unitMap[u.id] = u.unit_number; });

      // Leases activos con filtro correcto de enum ACTIVE y fechas
      const today = new Date().toISOString().split("T")[0];
      const { data: lData } = await supabase
        .from("leases")
        .select("id, unit_id, start_date, end_date, tenant:tenants(id, full_name)")
        .in("unit_id", unitIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`);

      ((lData || []) as unknown as Array<{
        id: string;
        unit_id: string;
        start_date: string;
        end_date: string | null;
        tenant: { id: string; full_name: string } | null;
      }>).forEach(l => {
        if (l.tenant) {
          leasesByUnit.set(l.unit_id, {
            id: l.id,
            tenant_id: l.tenant.id,
            tenant_name: l.tenant.full_name,
            start_date: l.start_date,
            end_date: l.end_date,
          });
        }
      });
    }

    const imIds = imList.map(im => im.id);
    let periodReadings: ReadingRow[] = [];
    if (imIds.length > 0) {
      const { data: rData } = await supabase
        .from("electricity_readings")
        .select("id, internal_meter_id, current_reading, previous_reading, consumption")
        .in("internal_meter_id", imIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null);
      periodReadings = (rData || []) as ReadingRow[];
    }

    // Enriquecer submedidores
    const enrichedMeters: InternalMeterRow[] = imList.map(im => {
      const cfe = cfeMList.find(m => m.id === im.cfe_meter_id);
      return {
        id: im.id,
        cfe_meter_id: im.cfe_meter_id,
        unit_id: im.unit_id,
        baseline_reading: im.baseline_reading,
        unit_number: unitMap[im.unit_id],
        building_id: cfe?.building_id,
        building_name: cfe ? buildingMap[cfe.building_id] : undefined,
        cfe_meter_number: cfe?.meter_number,
        active_lease: leasesByUnit.get(im.unit_id) ?? null,
      };
    });

    // Grupos: edificios alfabéticos → medidores naturales → depas naturales
    const sortedBuildings = sortByAlphabetic(buildingIds, id => buildingMap[id]);
    const grps: Group[] = [];
    sortByNatural(cfeMList, m => m.meter_number).forEach(cfe => {
      const meters = sortByNatural(
        enrichedMeters.filter(im => im.cfe_meter_id === cfe.id),
        im => im.unit_number,
      );
      if (meters.length === 0) return;
      grps.push({
        building_id: cfe.building_id,
        building_name: buildingMap[cfe.building_id] || cfe.building_id,
        cfe_meter_id: cfe.id,
        cfe_meter_number: cfe.meter_number,
        internal_meters: meters,
      });
    });

    // Ordenar grupos por nombre de edificio
    grps.sort((a, b) =>
      sortedBuildings.indexOf(a.building_id) - sortedBuildings.indexOf(b.building_id),
    );

    setGroups(grps);
    setReadings(periodReadings);
    setPageLoading(false);
  }

  const totalMeters   = useMemo(() => groups.reduce((s, g) => s + g.internal_meters.length, 0), [groups]);
  const capturedCount = readings.length;
  const pendingCount  = totalMeters - capturedCount;

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
          <Zap size={20} color="#8B2252" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#8B2252" }}>Medidores de luz</h1>
        </div>
        {/* Selector de mes */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => navMonth(-1)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700 }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" onClick={() => navMonth(1)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, paddingBottom: 12 }}>
          {([ ["all", "Todos", totalMeters], ["pending", "Pendientes", pendingCount], ["done", "Capturadas", capturedCount] ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${filter === key ? "#8B2252" : "var(--border-default)"}`,
                background: filter === key ? "#8B2252" : "var(--bg-card)",
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
            const visibleMeters = group.internal_meters.filter(im => {
              if (filter === "all") return true;
              const captured = readings.some(r => r.internal_meter_id === im.id);
              return filter === "done" ? captured : !captured;
            });
            if (visibleMeters.length === 0) return null;
            return (
              <div key={`${group.building_id}-${group.cfe_meter_id}`} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#8B2252", display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin size={14} />{group.building_name}</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>— Medidor {group.cfe_meter_number}</span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {visibleMeters.map(im => {
                    const reading    = readings.find(r => r.internal_meter_id === im.id);
                    const isCaptured = !!reading;
                    return (
                      <div
                        key={im.id}
                        onClick={() => setCaptureModal({ internalMeter: im, previousReading: im.baseline_reading })}
                        style={{
                          padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                          background: "var(--bg-card)",
                          border: `1px solid ${isCaptured ? "#15803d" : "var(--border-default)"}`,
                          borderLeft: `4px solid ${isCaptured ? "#15803d" : "#c2410c"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div>
                            <strong style={{ fontSize: 15 }}>Depa {im.unit_number}</strong>
                            <p style={{ margin: "2px 0 0", fontSize: 13, color: im.active_lease ? "var(--text-secondary)" : "var(--text-muted)" }}>
                              {im.active_lease ? im.active_lease.tenant_name : "Vacante"}
                            </p>
                          </div>
                          <span style={{
                            padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                            background: isCaptured ? "#dcfce7" : "#fff7ed",
                            color: isCaptured ? "#15803d" : "#c2410c",
                          }}>
                            {isCaptured ? "✓ Capturado" : "⏳ Pendiente"}
                          </span>
                        </div>
                        {isCaptured ? (
                          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                            Anterior: {reading.previous_reading} | Actual: {reading.current_reading} | <strong>{reading.consumption} kWh</strong>
                          </p>
                        ) : (
                          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                            Anterior: {im.baseline_reading}
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
        <CaptureReadingModal
          internalMeter={captureModal.internalMeter}
          period={{ year, month }}
          previousReading={captureModal.previousReading}
          averageConsumption={null}
          activeLease={captureModal.internalMeter.active_lease}
          isOpen
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
