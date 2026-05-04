"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Droplets, FileText, Flame, MapPin, Settings, Wifi, Wrench, Zap } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import AppGrid from "@/components/AppGrid";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import CaptureReadingModal, { type ActiveLeaseInfo } from "@/components/CaptureReadingModal";
import ElectricityBillModal from "@/components/ElectricityBillModal";
import ElectricityDistributionModal from "@/components/ElectricityDistributionModal";
import BuildingUtilityInvoiceModal from "@/components/BuildingUtilityInvoiceModal";
import { sortByNatural, sortByAlphabetic } from "@/lib/sort-utils";
import type { ElectricityBill, BuildingUtilityMeter, BuildingUtilityInvoice, UtilityServiceType } from "@/lib/types";
import { ELECTRICITY_BILL_STATUS_LABEL as BILL_STATUS_LABEL, SERVICE_TYPE_LABEL, SERVICE_TYPE_UNIT, UTILITY_INVOICE_STATUS_LABEL } from "@/lib/types";

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
  active_lease: ActiveLeaseInfo | null;
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

type BillModalState = {
  cfeMeter: CFEMeterRow;
  buildingName: string;
  existingBill: ElectricityBill | null;
};

type DistModalState = {
  bill: ElectricityBill;
  cfeMeterNumber: string;
  buildingName: string;
  buildingId: string;
  internalMeters: InternalMeterRow[];
};

type UtilityMeterRow = BuildingUtilityMeter & {
  building_name?: string;
  unit_number?: string;
};

type UtilityBuildingGroup = {
  building_id: string;
  building_name: string;
  meters: UtilityMeterRow[];
};

type UtilityInvoiceModalState = {
  meter: UtilityMeterRow;
  building: { id: string; name: string };
  existingInvoice: BuildingUtilityInvoice | null;
};

export default function CobranzaMedidoresPage() {
  const { user, loading } = useCurrentUser();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [groups, setGroups]           = useState<BuildingGroup[]>([]);
  const [readings, setReadings]       = useState<ReadingRow[]>([]);
  const [bills, setBills]             = useState<ElectricityBill[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [captureModal, setCaptureModal] = useState<{
    internalMeter: InternalMeterRow;
    previousReading: number;
  } | null>(null);
  const [billModal, setBillModal]   = useState<BillModalState | null>(null);
  const [distModal, setDistModal]   = useState<DistModalState | null>(null);

  // Otros servicios (building_utility_meters)
  const [utilityGroups, setUtilityGroups]       = useState<UtilityBuildingGroup[]>([]);
  const [utilityInvoices, setUtilityInvoices]   = useState<BuildingUtilityInvoice[]>([]);
  const [utilityUnits, setUtilityUnits]         = useState<Record<string, { id: string; unit_number: string }[]>>({});
  const [utilityInvoiceModal, setUtilityInvoiceModal] = useState<UtilityInvoiceModalState | null>(null);

  useEffect(() => {
    if (user?.company_id) void loadData();
  }, [user, year, month]);

  async function loadData() {
    if (!user?.company_id) return;
    setPageLoading(true);

    // Medidores CFE compartidos
    const { data: cfeMData } = await supabase
      .from("cfe_meters")
      .select("id, meter_number, description, building_id")
      .eq("company_id", user.company_id)
      .eq("service_type", "shared")
      .is("deleted_at", null);

    const cfeMList = (cfeMData || []) as CFEMeterRow[];
    const buildingIds = [...new Set(cfeMList.map(m => m.building_id))];

    if (buildingIds.length === 0) {
      setGroups([]);
      setReadings([]);
      setBills([]);
      setPageLoading(false);
      return;
    }

    // Edificios
    const { data: bData } = await supabase
      .from("buildings")
      .select("id, name")
      .in("id", buildingIds);
    const buildingMap: Record<string, string> = {};
    ((bData || []) as Array<{ id: string; name: string }>).forEach(b => { buildingMap[b.id] = b.name; });

    // Submedidores activos
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

    // Unidades
    const unitMap: Record<string, string> = {};
    if (unitIds.length > 0) {
      const { data: uData } = await supabase
        .from("units")
        .select("id, unit_number")
        .in("id", unitIds);
      ((uData || []) as Array<{ id: string; unit_number: string }>).forEach(u => { unitMap[u.id] = u.unit_number; });
    }

    // Leases activos
    const leasesByUnit = new Map<string, ActiveLeaseInfo>();
    if (unitIds.length > 0) {
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

    // Lecturas del período
    const imIds = imList.map(im => im.id);
    let periodReadings: ReadingRow[] = [];
    if (imIds.length > 0) {
      const { data: rData } = await supabase
        .from("electricity_readings")
        .select("id, internal_meter_id, period_year, period_month, current_reading, previous_reading, consumption")
        .in("internal_meter_id", imIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null);
      periodReadings = (rData || []) as ReadingRow[];
    }

    // Facturas del período
    let periodBills: ElectricityBill[] = [];
    if (cfeIds.length > 0) {
      const { data: billData } = await supabase
        .from("electricity_bills")
        .select("id, company_id, building_id, cfe_meter_id, period_year, period_month, total_amount, total_kwh, pdf_path, folio_cfe, status, distributed_at, charged_at, created_by, created_at, deleted_at")
        .in("cfe_meter_id", cfeIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null);
      periodBills = (billData || []) as ElectricityBill[];
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
        building_name: cfe ? buildingMap[cfe.building_id] : undefined,
        cfe_meter_number: cfe?.meter_number,
        active_lease: leasesByUnit.get(im.unit_id) ?? null,
      };
    });

    cfeMList.forEach(m => { m.building_name = buildingMap[m.building_id]; });

    // Agrupar por edificio → medidor CFE
    const sortedBuildings = sortByAlphabetic(buildingIds, id => buildingMap[id]);
    const grouped: BuildingGroup[] = [];
    sortedBuildings.forEach(bid => {
      const bMeters = sortByNatural(
        cfeMList.filter(m => m.building_id === bid),
        m => m.meter_number,
      );
      if (bMeters.length === 0) return;
      grouped.push({
        building_id: bid,
        building_name: buildingMap[bid] || bid,
        cfe_meters: bMeters.map(cfe => ({
          cfe_meter: cfe,
          internal_meters: sortByNatural(
            enrichedMeters.filter(im => im.cfe_meter_id === cfe.id),
            im => im.unit_number,
          ),
        })),
      });
    });

    setGroups(grouped);
    setReadings(periodReadings);
    setBills(periodBills);

    // ── Otros servicios (building_utility_meters) ──────────────────
    const { data: utilMData } = await supabase
      .from("building_utility_meters")
      .select("*")
      .eq("company_id", user.company_id)
      .eq("active", true)
      .is("deleted_at", null);

    const utilMList = (utilMData || []) as UtilityMeterRow[];
    const utilBuildingIds = [...new Set(utilMList.map(m => m.building_id))];

    if (utilBuildingIds.length > 0) {
      // Edificios (reusar los ya cargados si hay overlap, pero simplifiquemos)
      const { data: ubData } = await supabase
        .from("buildings")
        .select("id, name")
        .in("id", utilBuildingIds);
      const ubMap: Record<string, string> = {};
      ((ubData || []) as Array<{ id: string; name: string }>).forEach(b => { ubMap[b.id] = b.name; });

      // Unidades dedicadas — para mostrar "Depa X"
      const dedicatedUnitIds = [...new Set(utilMList.filter(m => m.unit_id).map(m => m.unit_id!))];
      const uNumMap: Record<string, string> = {};
      if (dedicatedUnitIds.length > 0) {
        const { data: duData } = await supabase
          .from("units").select("id, unit_number").in("id", dedicatedUnitIds);
        ((duData || []) as Array<{ id: string; unit_number: string }>).forEach(u => { uNumMap[u.id] = u.unit_number; });
      }

      // Todas las unidades por edificio (para el modal de factura)
      const allUnitsMap: Record<string, { id: string; unit_number: string }[]> = {};
      for (const bid of utilBuildingIds) {
        const { data: auData } = await supabase
          .from("units").select("id, unit_number")
          .eq("building_id", bid).is("deleted_at", null);
        allUnitsMap[bid] = sortByNatural((auData || []) as Array<{ id: string; unit_number: string }>, u => u.unit_number);
      }
      setUtilityUnits(allUnitsMap);

      // Facturas del período
      const utilMIds = utilMList.map(m => m.id);
      const { data: uiData } = await supabase
        .from("building_utility_invoices")
        .select("*")
        .in("building_utility_meter_id", utilMIds)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null);
      setUtilityInvoices((uiData || []) as BuildingUtilityInvoice[]);

      // Enriquecer y agrupar
      utilMList.forEach(m => {
        m.building_name = ubMap[m.building_id];
        if (m.unit_id) m.unit_number = uNumMap[m.unit_id];
      });

      const sortedUBuildingIds = sortByAlphabetic(utilBuildingIds, id => ubMap[id]);
      const uGrouped: UtilityBuildingGroup[] = sortedUBuildingIds.map(bid => ({
        building_id: bid,
        building_name: ubMap[bid] || bid,
        meters: sortByNatural(utilMList.filter(m => m.building_id === bid), m => m.provider_name ?? m.service_type),
      }));
      setUtilityGroups(uGrouped);
    } else {
      setUtilityGroups([]);
      setUtilityInvoices([]);
      setUtilityUnits({});
    }

    setPageLoading(false);
  }

  const totalInternalMeters = useMemo(
    () => groups.reduce((s, g) => s + g.cfe_meters.reduce((s2, cm) => s2 + cm.internal_meters.length, 0), 0),
    [groups],
  );
  const capturedCount = readings.length;
  const pendingCount  = totalInternalMeters - capturedCount;
  const billedCount   = bills.length;

  function navMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m);
    setYear(y);
  }

  if (loading) return <PageContainer>Cargando...</PageContainer>;
  if (!user) return null;
  const canAccess = (user as any).role === "superadmin" || (user as any).is_superadmin || (user as any).role === "administracion";
  if (!canAccess) return <PageContainer>Sin acceso.</PageContainer>;

  const billVariant: Record<string, "green" | "amber" | "blue" | "gray"> = {
    draft: "amber",
    distributed: "blue",
    charged: "green",
  };

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
        <MetricCard label="Lecturas capturadas"  value={pageLoading ? "…" : capturedCount} icon={<Zap size={18} />} variant="green" />
        <MetricCard label="Facturas capturadas"  value={pageLoading ? "…" : billedCount} icon={<FileText size={18} />} variant={billedCount > 0 ? "green" : "neutral"} />
      </div>

      {/* Lista */}
      {pageLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      ) : groups.length === 0 ? (
        <AppEmptyState
          title="Sin medidores compartidos configurados"
          description="No hay medidores compartidos configurados todavía."
          actionLabel="Configurar medidores en un edificio →"
          onAction={() => { window.location.href = "/buildings"; }}
        />
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {groups.map(group => (
            <SectionCard key={group.building_id} title={group.building_name} icon={<MapPin size={18} />}>
              <div style={{ display: "grid", gap: 20 }}>
                {group.cfe_meters.map(({ cfe_meter, internal_meters }) => {
                  const captured    = internal_meters.filter(im => readings.some(r => r.internal_meter_id === im.id));
                  const total       = internal_meters.length;
                  const allDone     = total > 0 && captured.length === total;
                  const bill        = bills.find(b => b.cfe_meter_id === cfe_meter.id) ?? null;
                  const billStatus  = bill?.status ?? null;

                  return (
                    <div key={cfe_meter.id}>
                      {/* Cabecera del medidor */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}><Zap size={14} />Medidor {cfe_meter.meter_number}</strong>
                        {cfe_meter.description ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cfe_meter.description}</span> : null}
                        <AppBadge variant={allDone ? "green" : "amber"}>
                          {allDone ? `✓ ${captured.length}/${total}` : `${captured.length}/${total} lecturas`}
                        </AppBadge>
                        {billStatus ? (
                          <AppBadge variant={billVariant[billStatus] ?? "default"}>
                            {BILL_STATUS_LABEL[billStatus]}
                          </AppBadge>
                        ) : null}
                      </div>

                      {/* Acción de factura */}
                      <div style={{ marginBottom: 12 }}>
                        {!bill && allDone ? (
                          <UiButton
                            variant="primary"
                            icon={<FileText size={14} />}
                            onClick={() => setBillModal({ cfeMeter: cfe_meter, buildingName: group.building_name, existingBill: null })}
                          >
                            Capturar factura CFE
                          </UiButton>
                        ) : bill && billStatus === "draft" ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <UiButton
                              variant="secondary"
                              icon={<FileText size={14} />}
                              onClick={() => setBillModal({ cfeMeter: cfe_meter, buildingName: group.building_name, existingBill: bill })}
                            >
                              Ver / Editar factura
                            </UiButton>
                            <UiButton
                              variant="primary"
                              onClick={() => setDistModal({
                                bill,
                                cfeMeterNumber: cfe_meter.meter_number,
                                buildingName: group.building_name,
                                buildingId: group.building_id,
                                internalMeters: internal_meters,
                              })}
                            >
                              Distribuir costos
                            </UiButton>
                          </div>
                        ) : bill && billStatus === "distributed" ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <UiButton
                              variant="secondary"
                              onClick={() => setDistModal({
                                bill,
                                cfeMeterNumber: cfe_meter.meter_number,
                                buildingName: group.building_name,
                                buildingId: group.building_id,
                                internalMeters: internal_meters,
                              })}
                            >
                              Ver distribución
                            </UiButton>
                            <UiButton
                              variant="primary"
                              onClick={() => setDistModal({
                                bill,
                                cfeMeterNumber: cfe_meter.meter_number,
                                buildingName: group.building_name,
                                buildingId: group.building_id,
                                internalMeters: internal_meters,
                              })}
                            >
                              Generar cobros
                            </UiButton>
                          </div>
                        ) : bill && billStatus === "charged" ? (
                          <UiButton
                            variant="secondary"
                            icon={<FileText size={14} />}
                            onClick={() => setDistModal({
                              bill,
                              cfeMeterNumber: cfe_meter.meter_number,
                              buildingName: group.building_name,
                              buildingId: group.building_id,
                              internalMeters: internal_meters,
                            })}
                          >
                            Ver distribución
                          </UiButton>
                        ) : !bill && !allDone ? (
                          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                            Captura todas las lecturas para poder registrar la factura.
                          </p>
                        ) : null}
                      </div>

                      {/* Grid de submedidores */}
                      {internal_meters.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Sin submedidores configurados.</p>
                      ) : (
                        <AppGrid minWidth={200} gap={12}>
                          {internal_meters.map(im => {
                            const reading    = readings.find(r => r.internal_meter_id === im.id);
                            const isCaptured = !!reading;
                            return (
                              <div
                                key={im.id}
                                onClick={() => setCaptureModal({ internalMeter: im, previousReading: im.baseline_reading })}
                                style={{ padding: 14, borderRadius: 14, cursor: "pointer", border: `1px solid ${isCaptured ? "var(--metric-border-green)" : "var(--border-default)"}`, background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
                              >
                                <strong style={{ display: "block", marginBottom: 4 }}>Depa {im.unit_number}</strong>
                                <p style={{ margin: "0 0 6px", fontSize: 12, color: im.active_lease ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                  {im.active_lease ? im.active_lease.tenant_name : "Vacante"}
                                </p>
                                {isCaptured ? (
                                  <div>
                                    <AppBadge variant="green">✓ Capturado</AppBadge>
                                    <p style={{ margin: "4px 0 0", fontSize: 12 }}>Lectura: <strong>{reading.current_reading}</strong> | Consumo: <strong>{reading.consumption} kWh</strong></p>
                                  </div>
                                ) : (
                                  <div>
                                    <AppBadge variant="amber">Pendiente</AppBadge>
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

      {/* ── Otros servicios ── */}
      {!pageLoading && utilityGroups.length > 0 && (
        <div style={{ display: "grid", gap: 24, marginTop: 32 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={18} />Otros servicios
          </h2>
          {utilityGroups.map(uGroup => (
            <SectionCard key={uGroup.building_id} title={uGroup.building_name} icon={<MapPin size={18} />}>
              <div style={{ display: "grid", gap: 12 }}>
                {uGroup.meters.map(meter => {
                  const invoice   = utilityInvoices.find(i => i.building_utility_meter_id === meter.id) ?? null;
                  const invoiceStatus = invoice?.status ?? null;
                  const serviceLabel = SERVICE_TYPE_LABEL[meter.service_type as UtilityServiceType];
                  const ServiceIco = () => {
                    switch (meter.service_type) {
                      case "gas":      return <Flame size={14} />;
                      case "water":    return <Droplets size={14} />;
                      case "internet": return <Wifi size={14} />;
                      case "other":    return <Settings size={14} />;
                      default:         return <Zap size={14} />;
                    }
                  };
                  const invVariant: Record<string, "green" | "amber" | "blue"> = {
                    draft: "amber", distributed: "blue", charged: "green",
                  };
                  return (
                    <div key={meter.id} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border-default)", background: "var(--bg-card)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <strong style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <ServiceIco />{serviceLabel}
                            </strong>
                            {meter.provider_name && (
                              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{meter.provider_name}</span>
                            )}
                            {meter.meter_type === "dedicated" ? (
                              <AppBadge variant="gray">Dedicado</AppBadge>
                            ) : (
                              <AppBadge variant="blue">Compartido</AppBadge>
                            )}
                            {meter.unit_number && (
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Depa {meter.unit_number}</span>
                            )}
                            {invoiceStatus && (
                              <AppBadge variant={invVariant[invoiceStatus] ?? "gray"}>
                                {UTILITY_INVOICE_STATUS_LABEL[invoiceStatus as keyof typeof UTILITY_INVOICE_STATUS_LABEL]}
                              </AppBadge>
                            )}
                          </div>
                          {invoice && (
                            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>
                              Total: <strong>${invoice.total_amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
                              {invoice.total_consumption && SERVICE_TYPE_UNIT[meter.service_type as UtilityServiceType]
                                ? ` · ${invoice.total_consumption} ${SERVICE_TYPE_UNIT[meter.service_type as UtilityServiceType]}`
                                : null}
                            </p>
                          )}
                        </div>
                        <UiButton
                          variant={invoice ? "secondary" : "primary"}
                          icon={<FileText size={14} />}
                          onClick={() => setUtilityInvoiceModal({
                            meter,
                            building: { id: uGroup.building_id, name: uGroup.building_name },
                            existingInvoice: invoice,
                          })}
                        >
                          {invoice ? "Ver / Editar factura" : "Registrar factura"}
                        </UiButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* Modales */}
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

      {billModal && (
        <ElectricityBillModal
          cfeMeter={billModal.cfeMeter}
          buildingName={billModal.buildingName}
          companyId={user.company_id}
          period={{ year, month }}
          existingBill={billModal.existingBill}
          onClose={() => setBillModal(null)}
          onSuccess={async () => {
            setBillModal(null);
            toast.success(billModal.existingBill ? "Factura actualizada" : "Factura guardada");
            await loadData();
          }}
        />
      )}

      {distModal && (
        <ElectricityDistributionModal
          bill={distModal.bill}
          buildingId={distModal.buildingId}
          buildingName={distModal.buildingName}
          cfeMeterNumber={distModal.cfeMeterNumber}
          companyId={user.company_id}
          internalMeters={distModal.internalMeters}
          onClose={() => setDistModal(null)}
          onSuccess={async () => {
            const wasCharged = distModal.bill.status === "distributed";
            setDistModal(null);
            toast.success(wasCharged ? "Cobros generados" : "Distribución confirmada");
            await loadData();
          }}
        />
      )}
      {utilityInvoiceModal && (
        <BuildingUtilityInvoiceModal
          meter={utilityInvoiceModal.meter}
          building={utilityInvoiceModal.building}
          period={{ year, month }}
          companyId={user.company_id}
          existingInvoice={utilityInvoiceModal.existingInvoice}
          units={utilityUnits[utilityInvoiceModal.meter.building_id] || []}
          onClose={() => setUtilityInvoiceModal(null)}
          onSuccess={async (msg) => {
            setUtilityInvoiceModal(null);
            toast.success(msg);
            await loadData();
          }}
        />
      )}
    </PageContainer>
  );
}
