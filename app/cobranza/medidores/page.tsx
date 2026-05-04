"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings, Zap } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import AppGrid from "@/components/AppGrid";
import SectionCard from "@/components/SectionCard";
import { getSignedReadingUrl } from "@/lib/storage-utils";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type MeterRow = {
  id: string;
  meter_number: string;
  building_id: string;
  building_name: string;
  unit_id: string;
  unit_name: string;
  last_reading_kwh: number | null;
  last_reading_date: string | null;
  month_reading_kwh: number | null;
  prev_reading_kwh: number | null;
  consumption: number | null;
  photo_path: string | null;
};

export default function MedidoresPage() {
  const { user, loading } = useCurrentUser();

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows,  setRows]  = useState<MeterRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user?.company_id) void loadData(user.company_id);
  }, [loading, user, year, month]);

  async function loadData(companyId: string) {
    setLoadingData(true);
    try {
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const prevDate = new Date(year, month - 2, 1);
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

      const { data: assignments, error: aErr } = await supabase
        .from("unit_meter_assignments")
        .select(`
          id, meter_id, unit_id,
          electricity_meters ( meter_number, building_id, buildings ( name ) ),
          units ( name )
        `)
        .eq("company_id", companyId)
        .is("unassigned_at", null)
        .is("electricity_meters.deleted_at", null);

      if (aErr) throw aErr;

      const meterIds = [...new Set((assignments ?? []).map((a: any) => a.meter_id as string))];
      if (meterIds.length === 0) { setRows([]); return; }

      const { data: readings } = await supabase
        .from("electricity_readings")
        .select("meter_id, unit_id, reading_kwh, reading_date, photo_path")
        .eq("company_id", companyId)
        .in("meter_id", meterIds)
        .order("reading_date", { ascending: false });

      const readingsArr = readings ?? [];

      const mapped: MeterRow[] = (assignments ?? [])
        .filter((a: any) => a.electricity_meters)
        .map((a: any) => {
          const meter = a.electricity_meters as any;
          const building = meter.buildings as any;

          const unitReadings = readingsArr.filter(
            (r: any) => r.meter_id === a.meter_id && r.unit_id === a.unit_id,
          );

          const monthReading = unitReadings.find((r: any) => r.reading_date?.startsWith(monthStr)) ?? null;
          const prevReading  = unitReadings.find((r: any) => r.reading_date?.startsWith(prevMonthStr)) ?? null;
          const lastReading  = unitReadings[0] ?? null;

          const consumption =
            monthReading && prevReading
              ? (monthReading.reading_kwh as number) - (prevReading.reading_kwh as number)
              : null;

          return {
            id: a.id,
            meter_number: meter.meter_number,
            building_id: meter.building_id,
            building_name: building?.name ?? "—",
            unit_id: a.unit_id,
            unit_name: (a.units as any)?.name ?? a.unit_id,
            last_reading_kwh: lastReading?.reading_kwh ?? null,
            last_reading_date: lastReading?.reading_date ?? null,
            month_reading_kwh: monthReading?.reading_kwh ?? null,
            prev_reading_kwh: prevReading?.reading_kwh ?? null,
            consumption,
            photo_path: lastReading?.photo_path ?? null,
          };
        });

      setRows(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar medidores");
    } finally {
      setLoadingData(false);
    }
  }

  async function openPhoto(path: string) {
    setExpandedPhoto(path);
    const url = await getSignedReadingUrl(supabase, path);
    setPhotoUrl(url);
  }

  function navMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  const totalMeters = rows.length;
  const withReading = rows.filter((r) => r.month_reading_kwh !== null).length;
  const withoutReading = totalMeters - withReading;
  const totalKwh = rows.reduce((sum, r) => sum + (r.consumption ?? 0), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: MeterRow[] }>();
    for (const r of rows) {
      if (!map.has(r.building_id)) map.set(r.building_id, { name: r.building_name, items: [] });
      map.get(r.building_id)!.items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  return (
    <PageContainer>
      <PageHeader
        title="Medidores de luz"
        subtitle="Lecturas mensuales de medidores CFE"
        actions={
          <Link
            href="/cobranza/medidores/setup"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: "1px solid var(--border-default)", background: "var(--bg-input)",
              color: "var(--text-primary)", textDecoration: "none",
            }}
          >
            <Settings size={15} /> Configurar
          </Link>
        }
      />

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navMonth(-1)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", display: "flex" }}
        >
          <ChevronLeft size={16} color="var(--text-primary)" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", minWidth: 160, textAlign: "center" }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          type="button"
          onClick={() => navMonth(1)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", display: "flex" }}
        >
          <ChevronRight size={16} color="var(--text-primary)" />
        </button>
      </div>

      {/* Metrics */}
      <AppGrid minWidth={200} style={{ marginBottom: 24 }}>
        <MetricCard label="Medidores activos" value={String(totalMeters)} icon={<Zap size={18} />} />
        <MetricCard label="Con lectura" value={String(withReading)} icon={<Zap size={18} />} variant="green" />
        <MetricCard label="Sin lectura" value={String(withoutReading)} icon={<Zap size={18} />} variant={withoutReading > 0 ? "amber" : "green"} />
        <MetricCard label="Consumo total (kWh)" value={totalKwh.toFixed(1)} icon={<Zap size={18} />} />
      </AppGrid>

      {/* Buildings + meters table */}
      {loadingData ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>Cargando…</div>
      ) : grouped.length === 0 ? (
        <SectionCard title="Sin medidores">
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
            No hay medidores configurados.{" "}
            <Link href="/cobranza/medidores/setup" style={{ color: "var(--accent)" }}>
              Ir a configuración
            </Link>
          </p>
        </SectionCard>
      ) : (
        grouped.map((group) => (
          <div key={group.name} style={{ marginBottom: 16 }}>
          <SectionCard title={group.name}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                    {["Unidad", "Medidor", "Lect. mes", "Lect. anterior", "Consumo", "Fecha", "Foto"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "var(--text-secondary)", fontSize: 12 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((r) => {
                    const noReading = r.month_reading_kwh === null;
                    const unusual = r.consumption !== null && (r.consumption > 500 || r.consumption < 0);
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                        <td style={{ padding: "10px 10px", fontWeight: 600, color: "var(--text-primary)" }}>{r.unit_name}</td>
                        <td style={{ padding: "10px 10px", color: "var(--text-muted)", fontFamily: "monospace" }}>{r.meter_number}</td>
                        <td style={{ padding: "10px 10px", color: noReading ? "var(--text-muted)" : "var(--text-primary)" }}>
                          {noReading ? <span style={{ color: "#92400e" }}>— Sin lectura</span> : `${r.month_reading_kwh} kWh`}
                        </td>
                        <td style={{ padding: "10px 10px", color: "var(--text-muted)" }}>
                          {r.prev_reading_kwh !== null ? `${r.prev_reading_kwh} kWh` : "—"}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          {r.consumption !== null ? (
                            <span style={{
                              padding: "3px 8px", borderRadius: 6, fontWeight: 700,
                              background: unusual ? "#fef3c7" : "#dcfce7",
                              color: unusual ? "#92400e" : "#15803d",
                              fontSize: 13,
                            }}>
                              {r.consumption >= 0 ? "+" : ""}{r.consumption.toFixed(1)} kWh
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "10px 10px", color: "var(--text-muted)", fontSize: 12 }}>{r.last_reading_date ?? "—"}</td>
                        <td style={{ padding: "10px 10px" }}>
                          {r.photo_path ? (
                            <button
                              type="button"
                              onClick={() => void openPhoto(r.photo_path!)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600 }}
                            >
                              Ver foto
                            </button>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
          </div>
        ))
      )}

      {/* Photo lightbox */}
      {expandedPhoto && (
        <div
          onClick={() => { setExpandedPhoto(null); setPhotoUrl(null); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9000, cursor: "pointer",
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="Lectura" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }} />
          ) : (
            <span style={{ color: "#fff" }}>Cargando…</span>
          )}
        </div>
      )}
    </PageContainer>
  );
}
