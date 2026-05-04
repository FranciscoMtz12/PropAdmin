"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MapPin, Zap } from "lucide-react";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppBadge from "@/components/AppBadge";
import { supabase } from "@/lib/supabaseClient";
import { errorBannerStyle } from "@/lib/pageStyles";
import { sortByNatural } from "@/lib/sort-utils";
import type { ElectricityBill } from "@/lib/types";
import type { ActiveLeaseInfo } from "@/components/CaptureReadingModal";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type InternalMeterRow = {
  id: string;
  unit_id: string;
  unit_number?: string;
  active_lease: ActiveLeaseInfo | null;
  baseline_reading: number;
};

type DistributionRow = {
  internal_meter_id: string;
  unit_id: string;
  unit_number: string;
  tenant_name: string | null;
  lease_id: string | null;
  consumption_kwh: number;
  percentage: number;
  amount_assigned: number;
  has_reading: boolean;
};

type Props = {
  bill: ElectricityBill;
  buildingId: string;
  buildingName: string;
  cfeMeterNumber: string;
  companyId: string;
  internalMeters: InternalMeterRow[];
  onClose: () => void;
  onSuccess: () => void;
};

export default function ElectricityDistributionModal({
  bill, buildingId, buildingName, cfeMeterNumber, companyId, internalMeters, onClose, onSuccess,
}: Props) {
  const [rows, setRows]         = useState<DistributionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  const periodLabel = `${MONTH_NAMES[bill.period_month - 1]} ${bill.period_year}`;
  const costPerKwh  = bill.total_kwh > 0 ? bill.total_amount / bill.total_kwh : 0;

  useEffect(() => {
    void loadDistribution();
  }, []);

  async function loadDistribution() {
    setLoading(true);
    const imIds = internalMeters.map(im => im.id);

    // Lecturas del período
    const { data: rData } = await supabase
      .from("electricity_readings")
      .select("internal_meter_id, consumption")
      .in("internal_meter_id", imIds)
      .eq("period_year", bill.period_year)
      .eq("period_month", bill.period_month)
      .is("deleted_at", null);

    const readingMap = new Map<string, number>(
      ((rData || []) as Array<{ internal_meter_id: string; consumption: number }>)
        .map(r => [r.internal_meter_id, r.consumption]),
    );

    const totalConsumption = [...readingMap.values()].reduce((s, v) => s + v, 0);

    const built: DistributionRow[] = internalMeters.map(im => {
      const kwh  = readingMap.get(im.id) ?? 0;
      const pct  = totalConsumption > 0 ? (kwh / totalConsumption) * 100 : 0;
      const amt  = totalConsumption > 0 ? (kwh / totalConsumption) * bill.total_amount : 0;
      return {
        internal_meter_id: im.id,
        unit_id:           im.unit_id,
        unit_number:       im.unit_number || "—",
        tenant_name:       im.active_lease?.tenant_name ?? null,
        lease_id:          im.active_lease?.id ?? null,
        consumption_kwh:   kwh,
        percentage:        pct,
        amount_assigned:   amt,
        has_reading:       readingMap.has(im.id),
      };
    });

    setRows(sortByNatural(built, r => r.unit_number));
    setLoading(false);
  }

  const missingReadings = rows.filter(r => !r.has_reading);
  const totalAssigned   = rows.reduce((s, r) => s + r.amount_assigned, 0);
  const diff            = Math.abs(totalAssigned - bill.total_amount);

  async function handleDistribute() {
    setMsg("");
    setSaving(true);
    try {
      // Upsert bill items
      for (const r of rows) {
        const { error } = await supabase.from("electricity_bill_items").upsert({
          bill_id:           bill.id,
          internal_meter_id: r.internal_meter_id,
          unit_id:           r.unit_id,
          consumption_kwh:   r.consumption_kwh,
          percentage:        parseFloat(r.percentage.toFixed(4)),
          amount_assigned:   parseFloat(r.amount_assigned.toFixed(2)),
        }, { onConflict: "bill_id,internal_meter_id" });
        if (error) { setMsg(`Error al guardar distribución: ${error.message}`); setSaving(false); return; }
      }

      const { error: billError } = await supabase
        .from("electricity_bills")
        .update({ status: "distributed", distributed_at: new Date().toISOString() })
        .eq("id", bill.id);

      if (billError) { setMsg(`Error al actualizar factura: ${billError.message}`); setSaving(false); return; }
      onSuccess();
    } catch {
      setMsg("Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCharges() {
    setMsg("");
    setSaving(true);
    try {
      const dueDay = 5;
      const dueDate = `${bill.period_year}-${String(bill.period_month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;

      // Load existing bill items if status is 'distributed'
      const { data: itemsData } = await supabase
        .from("electricity_bill_items")
        .select("id, unit_id, internal_meter_id, amount_assigned, collection_record_id")
        .eq("bill_id", bill.id);

      const items = (itemsData || []) as Array<{
        id: string; unit_id: string; internal_meter_id: string;
        amount_assigned: number; collection_record_id: string | null;
      }>;

      for (const item of items) {
        const row = rows.find(r => r.internal_meter_id === item.internal_meter_id);
        if (!row || !row.tenant_name) continue; // skip vacant units

        // Find or create collection_schedule for electricity on this unit
        const { data: existingSchedules } = await supabase
          .from("collection_schedules")
          .select("id")
          .eq("company_id", companyId)
          .eq("unit_id", item.unit_id)
          .eq("charge_type", "services")
          .eq("active", true)
          .limit(1);

        let scheduleId: string;
        if (existingSchedules && existingSchedules.length > 0) {
          scheduleId = (existingSchedules[0] as { id: string }).id;
        } else {
          const { data: newSched, error: schedError } = await supabase
            .from("collection_schedules")
            .insert({
              company_id:          companyId,
              building_id:         buildingId,
              unit_id:             item.unit_id,
              lease_id:            row.lease_id,
              charge_type:         "services",
              title:               `Luz — Depa ${row.unit_number}`,
              responsibility_type: "tenant",
              amount_expected:     item.amount_assigned,
              due_day:             dueDay,
              active:              true,
              notes:               "Generado automáticamente desde facturación de medidores.",
            })
            .select("id")
            .single();
          if (schedError || !newSched) {
            setMsg(`Error al crear programa de cobro para Depa ${row.unit_number}: ${schedError?.message}`);
            setSaving(false);
            return;
          }
          scheduleId = (newSched as { id: string }).id;
        }

        // Insert collection_record (upsert por período)
        const { data: newRecord, error: recError } = await supabase
          .from("collection_records")
          .upsert({
            collection_schedule_id: scheduleId,
            company_id:   companyId,
            building_id:  buildingId,
            unit_id:      item.unit_id,
            lease_id:     row.lease_id,
            period_year:  bill.period_year,
            period_month: bill.period_month,
            due_date:     dueDate,
            amount_due:   item.amount_assigned,
            status:       "pending",
            notes:        `Luz ${MONTH_NAMES[bill.period_month - 1]} ${bill.period_year} — ${row.consumption_kwh.toFixed(2)} kWh`,
          }, { onConflict: "collection_schedule_id,period_year,period_month" })
          .select("id")
          .single();

        if (recError || !newRecord) {
          setMsg(`Error al generar cobro para Depa ${row.unit_number}: ${recError?.message}`);
          setSaving(false);
          return;
        }

        // Link collection_record_id to the bill item
        await supabase
          .from("electricity_bill_items")
          .update({ collection_record_id: (newRecord as { id: string }).id })
          .eq("id", item.id);
      }

      const { error: billError } = await supabase
        .from("electricity_bills")
        .update({ status: "charged", charged_at: new Date().toISOString() })
        .eq("id", bill.id);

      if (billError) { setMsg(`Error al actualizar factura: ${billError.message}`); setSaving(false); return; }
      onSuccess();
    } catch {
      setMsg("Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  const isDistributed = bill.status === "distributed";
  const isCharged     = bill.status === "charged";

  return (
    <Modal open onClose={onClose} title={isCharged ? "Distribución de costos" : isDistributed ? "Generar cobros" : "Distribuir costos"}>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
        <MapPin size={13} />{buildingName}
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
        <Zap size={13} />Medidor {cfeMeterNumber} — {periodLabel}
      </p>

      {/* Resumen de factura */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "12px 14px", background: "var(--bg-page)", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
        <div>
          <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Total factura</p>
          <strong>${bill.total_amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
        </div>
        <div>
          <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>Total kWh</p>
          <strong>{bill.total_kwh.toLocaleString("es-MX")} kWh</strong>
        </div>
        <div>
          <p style={{ margin: "0 0 2px", color: "var(--text-muted)" }}>$/kWh</p>
          <strong>${costPerKwh.toFixed(4)}</strong>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Calculando distribución...</p>
      ) : (
        <>
          {missingReadings.length > 0 && (
            <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {missingReadings.length === 1
                ? `Depa ${missingReadings[0].unit_number} no tiene lectura — su consumo se asignará como 0 kWh.`
                : `${missingReadings.length} depas sin lectura — sus consumos serán 0 kWh.`}
            </div>
          )}

          {/* Tabla de distribución */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-page)" }}>
                  <th style={thStyle}>Depa</th>
                  <th style={thStyle}>Inquilino</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>kWh</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>%</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.internal_meter_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <td style={tdStyle}><strong>{r.unit_number}</strong></td>
                    <td style={tdStyle}>
                      {r.tenant_name
                        ? <span>{r.tenant_name}</span>
                        : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Vacante</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {r.has_reading ? r.consumption_kwh.toFixed(2) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{r.percentage.toFixed(1)}%</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                      ${r.amount_assigned.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-page)", fontWeight: 700 }}>
                  <td colSpan={2} style={{ ...tdStyle }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{bill.total_kwh.toFixed(2)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>100%</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    ${totalAssigned.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    {diff > 0.02 && (
                      <span style={{ display: "block", fontSize: 11, color: "#92400e", fontWeight: 400 }}>
                        Diferencia: ${diff.toFixed(2)} (redondeo)
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {msg ? <p style={errorBannerStyle}>{msg}</p> : null}

          {isCharged ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <AppBadge variant="green">Cobros generados</AppBadge>
              <UiButton type="button" variant="secondary" onClick={onClose}>Cerrar</UiButton>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
              {isDistributed ? (
                <UiButton type="button" variant="primary" onClick={handleGenerateCharges} disabled={saving}>
                  {saving ? "Generando..." : "Generar cobros"}
                </UiButton>
              ) : (
                <UiButton type="button" variant="primary" onClick={handleDistribute} disabled={saving}>
                  {saving ? "Guardando..." : "Confirmar distribución"}
                </UiButton>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontWeight: 600,
  color: "var(--text-secondary)", borderBottom: "2px solid var(--border-default)",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 10px", verticalAlign: "middle",
};
