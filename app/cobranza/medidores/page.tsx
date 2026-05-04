"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import AppGrid from "@/components/AppGrid";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import CaptureReadingModal from "@/components/CaptureReadingModal";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type CFEMeterRow = {
  id: string;
  meter_number: string;
  description: string | null;
  building_id: string;
  building_name?: string;
};

type InternalMeterRow = {
  id: string;
  cfe_meter_id: string;
  unit_id: string;
  unit_number?: string;
  building_name?: string;
  cfe_meter_number?: string;
  tenant_name?: string;
  baseline_reading: number;
};

type ReadingRow = {
  id: string;
  internal_meter_id: string;
  period_year: number;
  period_month: number;
  current_reading: number;
  previous_reading: number;
  consumption: number;
};

type BuildingGroup = {
  building_id: string;
  building_name: string;
  cfe_meters: Array<{
    cfe_meter: CFEMeterRow;
    internal_meters: InternalMeterRow[];
  }>;
};

export default function CobranzaMedidoresPage() {
  const { user, loading } = useCurrentUser();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [groups, setGroups]       = useState<BuildingGroup[]>([]);
  const [readings, setReadings]   = useState<ReadingRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [captureModal, setCaptureModal] = useState<{
    internalMeter: InternalMeterRow;
    previousReading: number;
    existingReading: ReadingRow | null;
  } | null>(null);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user, year, month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);

    // Load cfe_meters (shared only) with their buildings
    const { data: cfeMData } = await supabase
      .from('cfe_meters')
      .select('id, meter_number, description, building_id')
      .eq('company_id', user.company_id)
      .eq('service_type', 'shared')
      .is('deleted_at', null);

    const cfeMList = (cfeMData || []) as CFEMeterRow[];
    const buildingIds = [...new Set(cfeMList.map(m => m.building_id))];

    if (buildingIds.length === 0) {
      setGroups([]);
      setReadings([]);
      setPageLoading(false);
      return;
    }

    // Load buildings
    const { data: bData } = await supabase
      .from('buildings')
      .select('id, name')
      .in('id', buildingIds);
    const buildingMap: Record<string, string> = {};
    ((bData || []) as Array<{id: string; name: string}>).forEach(b => { buildingMap[b.id] = b.name; });

    // Load internal meters
    const cfeIds = cfeMList.map(m => m.id);
    const { data: imData } = await supabase
      .from('internal_meters')
      .select('id, cfe_meter_id, unit_id, baseline_reading')
      .in('cfe_meter_id', cfeIds)
      .eq('active', true)
      .is('deleted_at', null);

    const imList = (imData || []) as InternalMeterRow[];

    // Load units
    const unitIds = [...new Set(imList.map(im => im.unit_id))];
    const unitMap: Record<string, string> = {};
    if (unitIds.length > 0) {
      const { data: uData } = await supabase
        .from('units')
        .select('id, unit_number')
        .in('id', unitIds);
      ((uData || []) as Array<{id: string; unit_number: string}>).forEach(u => { unitMap[u.id] = u.unit_number; });
    }

    // Load active tenants
    const tenantMap: Record<string, string> = {};
    if (unitIds.length > 0) {
      const { data: lData } = await supabase
        .from('leases')
        .select('unit_id, tenant:tenants(full_name)')
        .in('unit_id', unitIds)
        .is('deleted_at', null)
        .eq('status', 'active');
      ((lData || []) as unknown as Array<{unit_id: string; tenant: {full_name: string} | null}>).forEach(l => {
        if (l.tenant?.full_name) tenantMap[l.unit_id] = l.tenant.full_name;
      });
    }

    // Load readings for this period
    const imIds = imList.map(im => im.id);
    let periodReadings: ReadingRow[] = [];
    if (imIds.length > 0) {
      const { data: rData } = await supabase
        .from('electricity_readings')
        .select('id, internal_meter_id, period_year, period_month, current_reading, previous_reading, consumption')
        .in('internal_meter_id', imIds)
        .eq('period_year', year)
        .eq('period_month', month)
        .is('deleted_at', null);
      periodReadings = (rData || []) as ReadingRow[];
    }

    // Enrich internal meters
    imList.forEach(im => {
      const cfe = cfeMList.find(m => m.id === im.cfe_meter_id);
      im.unit_number = unitMap[im.unit_id];
      im.building_name = cfe ? buildingMap[cfe.building_id] : undefined;
      im.cfe_meter_number = cfe?.meter_number;
      im.tenant_name = tenantMap[im.unit_id];
    });

    cfeMList.forEach(m => { m.building_name = buildingMap[m.building_id]; });

    // Group by building → cfe_meter
    const grouped: BuildingGroup[] = [];
    buildingIds.forEach(bid => {
      const bMeters = cfeMList.filter(m => m.building_id === bid);
      if (bMeters.length === 0) return;
      grouped.push({
        building_id: bid,
        building_name: buildingMap[bid] || bid,
        cfe_meters: bMeters.map(cfe => ({
          cfe_meter: cfe,
          internal_meters: imList.filter(im => im.cfe_meter_id === cfe.id),
        })),
      });
    });

    setGroups(grouped);
    setReadings(periodReadings);
    setPageLoading(false);
  }

  const totalInternalMeters = useMemo(() => groups.reduce((s, g) => s + g.cfe_meters.reduce((s2, cm) => s2 + cm.internal_meters.length, 0), 0), [groups]);
  const capturedCount = readings.length;
  const pendingCount  = totalInternalMeters - capturedCount;

  function navMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m);
    setYear(y);
  }

  if (loading) return <PageContainer>Cargando...</PageContainer>;
  if (!user) return null;
  const canAccess = (user as any).role === 'superadmin' || (user as any).is_superadmin || (user as any).role === 'administracion';
  if (!canAccess) return <PageContainer>Sin acceso.</PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="Medidores de luz"
        titleIcon={<Zap size={20} />}
        subtitle="Lecturas mensuales de submedidores internos"
      />

      {/* Selector de mes */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navMonth(-1)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, minWidth: 160, textAlign: "center" }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button type="button" onClick={() => navMonth(1)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <MetricCard label="Edificios con submedidores" value={groups.length} icon={<Zap size={18} />} />
        <MetricCard label="Lecturas pendientes" value={pageLoading ? "…" : pendingCount} icon={<Zap size={18} />} variant={pendingCount > 0 ? "amber" : "green"} />
        <MetricCard label="Lecturas capturadas" value={pageLoading ? "…" : capturedCount} icon={<Zap size={18} />} variant="green" />
        <MetricCard label="Costo por kWh" value="Próximamente" icon={<Zap size={18} />} />
      </div>

      {/* Lista de grupos */}
      {pageLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      ) : groups.length === 0 ? (
        <AppEmptyState
          title="Sin medidores compartidos configurados"
          description="No hay medidores compartidos configurados todavía."
          actionLabel="Configurar medidores en un edificio →"
          onAction={() => { window.location.href = '/buildings'; }}
        />
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {groups.map(group => (
            <SectionCard key={group.building_id} title={`📍 ${group.building_name}`} icon={<Zap size={18} />}>
              <div style={{ display: "grid", gap: 16 }}>
                {group.cfe_meters.map(({ cfe_meter, internal_meters }) => {
                  const captured = internal_meters.filter(im => readings.some(r => r.internal_meter_id === im.id));
                  const total    = internal_meters.length;
                  const allDone  = total > 0 && captured.length === total;

                  return (
                    <div key={cfe_meter.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 14 }}>🔌 Medidor {cfe_meter.meter_number}</strong>
                        {cfe_meter.description ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cfe_meter.description}</span> : null}
                        <AppBadge variant={allDone ? "green" : "amber"}>
                          {allDone ? `✓ ${captured.length}/${total}` : `⏳ ${captured.length}/${total}`}
                        </AppBadge>
                      </div>

                      {internal_meters.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Sin submedidores configurados.</p>
                      ) : (
                        <AppGrid minWidth={200} gap={12}>
                          {internal_meters.map(im => {
                            const reading = readings.find(r => r.internal_meter_id === im.id);
                            const isCaptured = !!reading;
                            return (
                              <div
                                key={im.id}
                                onClick={() => {
                                  setCaptureModal({
                                    internalMeter: im,
                                    previousReading: im.baseline_reading,
                                    existingReading: reading || null,
                                  });
                                }}
                                style={{ padding: 14, borderRadius: 14, cursor: "pointer", border: `1px solid ${isCaptured ? "var(--metric-border-green)" : "var(--border-default)"}`, background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
                              >
                                <strong style={{ display: "block", marginBottom: 4 }}>Depa {im.unit_number}</strong>
                                <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)" }}>{im.tenant_name || "Vacante"}</p>
                                {isCaptured ? (
                                  <div>
                                    <AppBadge variant="green">✓ Capturado</AppBadge>
                                    <p style={{ margin: "4px 0 0", fontSize: 12 }}>Lectura: <strong>{reading.current_reading}</strong> | Consumo: <strong>{reading.consumption} kWh</strong></p>
                                  </div>
                                ) : (
                                  <div>
                                    <AppBadge variant="amber">⏳ Pendiente</AppBadge>
                                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Anterior: {im.baseline_reading}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </AppGrid>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {captureModal && (
        <CaptureReadingModal
          internalMeter={captureModal.internalMeter}
          period={{ year, month }}
          previousReading={captureModal.previousReading}
          averageConsumption={null}
          isVacant={!captureModal.internalMeter.tenant_name}
          isOpen
          onClose={() => setCaptureModal(null)}
          onSuccess={async () => {
            setCaptureModal(null);
            toast.success("Lectura capturada");
            await loadData();
          }}
        />
      )}
    </PageContainer>
  );
}
