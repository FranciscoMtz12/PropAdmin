"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Droplets, FileText,
  Flame, MapPin, Settings, Wifi, Wrench, Zap,
} from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import CaptureUtilityReadingModal from "@/components/CaptureUtilityReadingModal";
import UtilityInvoiceModal from "@/components/UtilityInvoiceModal";
import { sortByNatural, sortByAlphabetic } from "@/lib/sort-utils";
import type { BuildingUtilityMeter, BuildingUtilitySubMeter, BuildingUtilityInvoice } from "@/lib/types";
import {
  SERVICE_TYPE_LABEL, SERVICE_TYPE_UNIT,
  UTILITY_INVOICE_STATUS_LABEL, BILLING_FREQUENCY_LABEL,
  meterGeneratesCharge,
} from "@/lib/types";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type SubMeterRow = BuildingUtilitySubMeter & {
  unit_number: string;
  active_lease: { tenant_name: string } | null;
};

type ReadingRow = {
  id: string;
  building_utility_sub_meter_id: string;
  current_reading: number;
  previous_reading: number;
  consumption: number | null;
};

type MeterGroup = {
  meter: BuildingUtilityMeter;
  sub_meters: SubMeterRow[];
  unit_number?: string;
  tenant_name?: string;
};

type BuildingGroup = {
  building_id: string;
  building_name: string;
  company_id: string | null;
  meter_groups: MeterGroup[];
};

function ServiceIcon({ type, size = 14 }: { type: string; size?: number }) {
  switch (type) {
    case "gas":      return <Flame size={size} />;
    case "water":    return <Droplets size={size} />;
    case "internet": return <Wifi size={size} />;
    case "other":    return <Settings size={size} />;
    default:         return <Zap size={size} />;
  }
}

const INV_VARIANT: Record<string, "green" | "amber" | "blue" | "gray"> = {
  pending: "amber", draft: "amber", distributed: "blue", charged: "green",
};

export default function CobranzaMedidoresPage() {
  const { user, loading } = useCurrentUser();
  const { impersonationMode, groupCompanyIds, groupCompanies } = useImpersonation();
  const isGroupMode = impersonationMode === 'group';
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [groups, setGroups]                   = useState<BuildingGroup[]>([]);
  const [readings, setReadings]               = useState<ReadingRow[]>([]);
  const [invoices, setInvoices]               = useState<BuildingUtilityInvoice[]>([]);
  const [unitsByBuilding, setUnitsByBuilding] = useState<Record<string, { id: string; unit_number: string }[]>>({});
  const [pageLoading, setPageLoading]         = useState(true);

  const [captureModal, setCaptureModal] = useState<{
    subMeter: SubMeterRow;
    meter: BuildingUtilityMeter;
    previousReading: number;
  } | null>(null);

  const [invoiceModal, setInvoiceModal] = useState<{
    meter: BuildingUtilityMeter;
    building: { id: string; name: string };
    existingInvoice: BuildingUtilityInvoice | null;
    units: { id: string; unit_number: string }[];
  } | null>(null);

  useEffect(() => {
    if (user && !user.is_superadmin) void loadData();
  }, [user?.id, user?.company_id, user?.is_superadmin, year, month]);

  async function loadData() {
    if (!user) return;
    setPageLoading(true);

    const cid = user?.company_id ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co = (q: any) => cid ? q.eq("company_id", cid) : q;
    const { data: mData } = await co(
      supabase.from("building_utility_meters").select("*").eq("active", true).is("deleted_at", null)
    );

    const mList = ((mData || []) as BuildingUtilityMeter[]).filter(meterGeneratesCharge);

    if (mList.length === 0) {
      setGroups([]); setReadings([]); setInvoices([]); setUnitsByBuilding({});
      setPageLoading(false); return;
    }

    const buildingIds  = [...new Set(mList.map(m => m.building_id))];
    const mIds         = mList.map(m => m.id);
    const sharedMIds   = mList.filter(m => m.meter_type === "shared").map(m => m.id);
    const dedUnitIds   = [...new Set(
      mList.filter(m => m.meter_type === "dedicated" && m.unit_id).map(m => m.unit_id!)
    )];

    let smList: BuildingUtilitySubMeter[] = [];
    if (sharedMIds.length > 0) {
      const { data: smData } = await supabase
        .from("building_utility_sub_meters")
        .select("*")
        .in("building_utility_meter_id", sharedMIds)
        .eq("active", true)
        .is("deleted_at", null);
      smList = (smData || []) as BuildingUtilitySubMeter[];
    }

    const smUnitIds  = [...new Set(smList.map(sm => sm.unit_id))];
    const allUnitIds = [...new Set([...smUnitIds, ...dedUnitIds])];
    const today      = new Date().toISOString().split("T")[0];

    const [bRes, uRes, lRes, invRes, allURes] = await Promise.all([
      supabase.from("buildings").select("id, name, company_id").in("id", buildingIds),
      allUnitIds.length > 0
        ? supabase.from("units").select("id, unit_number").in("id", allUnitIds)
        : Promise.resolve({ data: [] }),
      allUnitIds.length > 0
        ? supabase.from("leases")
            .select("id, unit_id, tenant:tenants(id, full_name)")
            .in("unit_id", allUnitIds)
            .eq("status", "ACTIVE")
            .is("deleted_at", null)
            .lte("start_date", today)
            .or(`end_date.is.null,end_date.gte.${today}`)
        : Promise.resolve({ data: [] }),
      supabase.from("building_utility_invoices")
        .select("*")
        .in("building_utility_meter_id", mIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null),
      supabase.from("units")
        .select("id, unit_number, building_id")
        .in("building_id", buildingIds)
        .is("deleted_at", null),
    ]);

    const smIds = smList.map(sm => sm.id);
    let periodReadings: ReadingRow[] = [];
    if (smIds.length > 0) {
      const { data: rData } = await supabase
        .from("building_utility_readings")
        .select("id, building_utility_sub_meter_id, current_reading, previous_reading, consumption")
        .in("building_utility_sub_meter_id", smIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null);
      periodReadings = (rData || []) as ReadingRow[];
    }

    const buildingMap: Record<string, string> = {};
    const buildingCompanyMap: Record<string, string | null> = {};
    ((bRes.data || []) as Array<{ id: string; name: string; company_id: string | null }>).forEach(b => {
      buildingMap[b.id] = b.name;
      buildingCompanyMap[b.id] = b.company_id ?? null;
    });

    const unitNumMap: Record<string, string> = {};
    ((uRes.data || []) as Array<{ id: string; unit_number: string }>).forEach(u => { unitNumMap[u.id] = u.unit_number; });

    const leasesByUnit = new Map<string, { tenant_name: string }>();
    ((lRes.data || []) as unknown as Array<{
      unit_id: string; tenant: { id: string; full_name: string } | null
    }>).forEach(l => {
      if (l.tenant) leasesByUnit.set(l.unit_id, { tenant_name: l.tenant.full_name });
    });

    const unitsByBld: Record<string, { id: string; unit_number: string }[]> = {};
    ((allURes.data || []) as Array<{ id: string; unit_number: string; building_id: string }>).forEach(u => {
      if (!unitsByBld[u.building_id]) unitsByBld[u.building_id] = [];
      unitsByBld[u.building_id].push({ id: u.id, unit_number: u.unit_number });
    });
    Object.keys(unitsByBld).forEach(bid => {
      unitsByBld[bid] = sortByNatural(unitsByBld[bid], u => u.unit_number);
    });
    setUnitsByBuilding(unitsByBld);

    const enrichedSubs: SubMeterRow[] = smList.map(sm => ({
      ...sm,
      unit_number:  unitNumMap[sm.unit_id] ?? sm.unit_id.slice(0, 6),
      active_lease: leasesByUnit.get(sm.unit_id) ?? null,
    }));

    const sortedBldIds = sortByAlphabetic(buildingIds, id => buildingMap[id]);
    const grps: BuildingGroup[] = sortedBldIds.map(bid => {
      const bMeters = mList.filter(m => m.building_id === bid);
      const meter_groups: MeterGroup[] = sortByNatural(bMeters, m => m.provider_name ?? m.service_type).map(meter => ({
        meter,
        sub_meters: meter.meter_type === "shared"
          ? sortByNatural(enrichedSubs.filter(sm => sm.building_utility_meter_id === meter.id), sm => sm.unit_number)
          : [],
        unit_number: meter.unit_id ? unitNumMap[meter.unit_id] : undefined,
        tenant_name: meter.unit_id ? leasesByUnit.get(meter.unit_id)?.tenant_name : undefined,
      }));
      return { building_id: bid, building_name: buildingMap[bid] ?? bid, company_id: buildingCompanyMap[bid] ?? null, meter_groups };
    }).filter(g => g.meter_groups.length > 0);

    setGroups(grps);
    setReadings(periodReadings);
    setInvoices((invRes.data || []) as BuildingUtilityInvoice[]);
    setPageLoading(false);
  }

  const filteredGroups = useMemo(() => {
    if (!isGroupMode) return groups;
    return groups.filter(g => g.company_id != null && groupCompanyIds.includes(g.company_id));
  }, [isGroupMode, groups, groupCompanyIds]);

  const totalSubMeters  = useMemo(
    () => filteredGroups.reduce((s, g) => s + g.meter_groups.reduce((s2, mg) => s2 + mg.sub_meters.length, 0), 0),
    [filteredGroups],
  );
  const capturedCount   = readings.length;
  const pendingReadings = totalSubMeters - capturedCount;
  const totalMeters     = filteredGroups.reduce((s, g) => s + g.meter_groups.length, 0);
  const pendingInvoices = totalMeters - invoices.length;
  const cobrosCount     = invoices.filter(i => i.status === "charged").length;

  function navMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  }

  if (loading) return <PageContainer>Cargando...</PageContainer>;
  if (!user) return null;
  const canAccess = (user as any).role === "superadmin" || (user as any).is_superadmin || (user as any).role === "administracion";
  if (!canAccess) return <PageContainer>Sin acceso.</PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="Servicios"
        titleIcon={<Wrench size={20} />}
        subtitle="Facturas y lecturas mensuales de servicios del edificio"
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navMonth(-1)} style={{ padding: "8px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: "1rem", fontWeight: 700, minWidth: 160, textAlign: "center" }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button type="button" onClick={() => navMonth(1)} style={{ padding: "8px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-primary)" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11.25rem, 1fr))", gap: 16, marginBottom: 24 }}>
        <MetricCard label="Edificios con servicios" value={filteredGroups.length} icon={<MapPin size={18} />} />
        <MetricCard label="Lecturas pendientes"  value={pageLoading ? "…" : pendingReadings}  icon={<Zap size={18} />}      variant={pendingReadings  > 0 ? "amber" : "green"} />
        <MetricCard label="Facturas pendientes"  value={pageLoading ? "…" : pendingInvoices}  icon={<FileText size={18} />} variant={pendingInvoices  > 0 ? "amber" : "green"} />
        <MetricCard label="Cobros generados"     value={pageLoading ? "…" : cobrosCount}      icon={<FileText size={18} />} variant={cobrosCount      > 0 ? "green" : "neutral"} />
      </div>

      {pageLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      ) : filteredGroups.length === 0 ? (
        <AppEmptyState
          title="Sin servicios configurados"
          description="No hay servicios del edificio con cobro configurados todavía."
          actionLabel="Configurar servicios en un edificio →"
          onAction={() => { window.location.href = "/buildings"; }}
        />
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {filteredGroups.map(group => {
            const company = isGroupMode ? groupCompanies.find(c => c.id === group.company_id) : undefined;
            return (
            <SectionCard key={group.building_id} title={group.building_name} icon={<MapPin size={18} />}>
              {company && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: company.brand_color || "var(--accent)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{company.short_name || company.name}</span>
                </div>
              )}
              <div style={{ display: "grid", gap: 20 }}>
                {group.meter_groups.map(({ meter, sub_meters, unit_number, tenant_name }) => {
                  const invoice   = invoices.find(i => i.building_utility_meter_id === meter.id) ?? null;
                  const invStatus = invoice?.status ?? null;
                  const meterLabel = meter.provider_name
                    ? `${meter.provider_name} · ${SERVICE_TYPE_LABEL[meter.service_type]}`
                    : SERVICE_TYPE_LABEL[meter.service_type];

                  return (
                    <div key={meter.id} style={{ padding: "14px 16px", borderRadius: "var(--border-radius-lg)", border: "1px solid var(--border-default)", background: "var(--bg-card)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "0.875rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <ServiceIcon type={meter.service_type} size={14} />{meterLabel}
                          </strong>
                          {meter.meter_number && (
                            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", padding: "1px 6px", background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-sm)" }}>
                              {meter.meter_number}
                            </span>
                          )}
                          <AppBadge variant="gray">{BILLING_FREQUENCY_LABEL[meter.billing_frequency]}</AppBadge>
                          {meter.meter_type === "shared"
                            ? <AppBadge variant="blue">Compartido</AppBadge>
                            : <AppBadge variant="gray">Dedicado</AppBadge>}
                          {invStatus && (
                            <AppBadge variant={INV_VARIANT[invStatus] ?? "gray"}>
                              {UTILITY_INVOICE_STATUS_LABEL[invStatus as keyof typeof UTILITY_INVOICE_STATUS_LABEL]}
                            </AppBadge>
                          )}
                        </div>
                        {!isGroupMode && (
                          <UiButton
                            variant={invoice ? "secondary" : "primary"}
                            icon={<FileText size={14} />}
                            onClick={() => setInvoiceModal({
                              meter,
                              building: { id: group.building_id, name: group.building_name },
                              existingInvoice: invoice,
                              units: unitsByBuilding[group.building_id] ?? [],
                            })}
                          >
                            {invoice ? "Ver / Editar" : "Registrar factura"}
                          </UiButton>
                        )}
                      </div>

                      {/* Dedicated: show tenant info */}
                      {meter.meter_type === "dedicated" && (
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          {unit_number && <span style={{ marginRight: 8 }}>Depa {unit_number}</span>}
                          <span style={{ color: tenant_name ? "var(--text-secondary)" : "var(--text-muted)" }}>
                            {tenant_name ?? "Vacante"}
                          </span>
                          {invoice && (
                            <p style={{ margin: "4px 0 0", fontSize: "0.8125rem" }}>
                              Total: <strong>${invoice.total_amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Shared: sub_meter reading cards */}
                      {meter.meter_type === "shared" && (
                        <div>
                          {invoice && (
                            <p style={{ margin: "0 0 8px", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                              Total: <strong>${invoice.total_amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
                              {invoice.total_consumption && SERVICE_TYPE_UNIT[meter.service_type]
                                ? ` · ${invoice.total_consumption} ${SERVICE_TYPE_UNIT[meter.service_type]}`
                                : null}
                            </p>
                          )}
                          {sub_meters.length === 0 ? (
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0 }}>Sin submedidores configurados.</p>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))", gap: 8 }}>
                              {sub_meters.map(sm => {
                                const reading    = readings.find(r => r.building_utility_sub_meter_id === sm.id);
                                const isCaptured = !!reading;
                                const prevReading = reading?.previous_reading ?? sm.baseline_reading;
                                return (
                                  <div
                                    key={sm.id}
                                    onClick={() => isGroupMode ? undefined : setCaptureModal({ subMeter: sm, meter, previousReading: prevReading })}
                                    style={{
                                      padding: "10px 12px", borderRadius: "var(--border-radius-lg)", cursor: isGroupMode ? "default" : "pointer",
                                      background: "var(--bg-page)",
                                      border: `1px solid ${isCaptured ? "var(--metric-border-green)" : "var(--border-default)"}`,
                                      borderLeft: `4px solid ${isCaptured ? "var(--metric-border-green)" : "#c2410c"}`,
                                    }}
                                  >
                                    <strong style={{ fontSize: "0.8125rem" }}>Depa {sm.unit_number}</strong>
                                    {sm.sub_meter_number && (
                                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: 4 }}>({sm.sub_meter_number})</span>
                                    )}
                                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: sm.active_lease ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                      {sm.active_lease ? sm.active_lease.tenant_name : "Vacante"}
                                    </p>
                                    {isCaptured ? (
                                      <p style={{ margin: "4px 0 0", fontSize: "0.6875rem", color: "var(--metric-value-green)", fontWeight: 600 }}>
                                        {reading.current_reading}
                                        {reading.consumption != null ? ` · ${reading.consumption} ${SERVICE_TYPE_UNIT[meter.service_type] ?? ""}` : ""}
                                      </p>
                                    ) : (
                                      <p style={{ margin: "4px 0 0", fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                                        Anterior: {sm.baseline_reading}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
            );
          })}
        </div>
      )}

      {captureModal && (
        <CaptureUtilityReadingModal
          isOpen
          subMeter={captureModal.subMeter}
          meter={captureModal.meter}
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

      {invoiceModal && (
        <UtilityInvoiceModal
          isOpen
          meter={invoiceModal.meter}
          building={invoiceModal.building}
          period={{ year, month }}
          companyId={user.company_id!}
          existingInvoice={invoiceModal.existingInvoice}
          units={invoiceModal.units}
          onClose={() => setInvoiceModal(null)}
          onSuccess={() => {
            setInvoiceModal(null);
            toast.success("Factura guardada");
            void loadData();
          }}
        />
      )}
    </PageContainer>
  );
}
