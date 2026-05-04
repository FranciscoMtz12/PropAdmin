"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, TEXTAREA_STYLE, errorBannerStyle } from "@/lib/pageStyles";

type InternalMeterWithJoins = {
  id: string;
  unit_id: string;
  cfe_meter_id: string;
  unit_number?: string;
  building_name?: string;
  cfe_meter_number?: string;
};

export type ActiveLeaseInfo = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  start_date: string;
  end_date: string | null;
};

type Props = {
  internalMeter: InternalMeterWithJoins;
  period: { year: number; month: number };
  previousReading: number;
  averageConsumption: number | null;
  activeLease: ActiveLeaseInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function CaptureReadingModal({ internalMeter, period, previousReading, averageConsumption, activeLease, isOpen, onClose, onSuccess }: Props) {
  const [currentReading, setCurrentReading] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const hasNoTenant = !activeLease;
  const current = parseFloat(currentReading) || 0;
  const consumption = current > 0 ? current - previousReading : 0;
  const isAbnormal = averageConsumption && consumption > 0 && consumption > averageConsumption * 5;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!currentReading || isNaN(parseFloat(currentReading))) { setMsg("Ingresa la lectura actual."); return; }
    if (parseFloat(currentReading) < previousReading) { setMsg("La lectura actual no puede ser menor que la anterior."); return; }
    if (!photoFile) { setMsg("La foto del medidor es obligatoria."); return; }

    setSaving(true);
    try {
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `${internalMeter.cfe_meter_id}/${period.year}-${String(period.month).padStart(2, "0")}/${internalMeter.unit_id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("electricity-readings")
        .upload(path, photoFile, { upsert: false });

      if (uploadError) { setMsg(`Error subiendo foto: ${uploadError.message}`); setSaving(false); return; }

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from("electricity_readings").insert({
        internal_meter_id: internalMeter.id,
        unit_id: internalMeter.unit_id,
        cfe_meter_id: internalMeter.cfe_meter_id,
        period_year: period.year,
        period_month: period.month,
        previous_reading: previousReading,
        current_reading: parseFloat(currentReading),
        reading_date: new Date().toISOString().split("T")[0],
        photo_url: path,
        notes: notes.trim() || null,
        has_no_tenant: hasNoTenant,
        read_by: user?.id || null,
      });

      if (insertError) { setMsg(`Error guardando lectura: ${insertError.message}`); setSaving(false); return; }
      onSuccess();
    } catch {
      setMsg("Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal open onClose={onClose} title={`Depa ${internalMeter.unit_number || "—"} — Medidor ${internalMeter.cfe_meter_number || "—"}`}>
      {internalMeter.building_name && (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>
          📍 {internalMeter.building_name}
        </p>
      )}

      {/* Inquilino o vacante — calculado automáticamente, sin checkbox */}
      {activeLease ? (
        <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          👤 {activeLease.tenant_name}
        </p>
      ) : (
        <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, marginBottom: 12, fontSize: 13, color: "#92400e" }}>
          ⚠️ Este depa no tiene inquilino activo
        </div>
      )}

      <div style={{ padding: "10px 14px", background: "var(--bg-page)", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>Lectura anterior: <strong>{previousReading.toLocaleString("es-MX")}</strong></span>
          {averageConsumption !== null && (
            <span style={{ color: "var(--text-muted)" }}>Promedio histórico: <strong>{averageConsumption.toFixed(0)} kWh</strong></span>
          )}
        </div>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Período: {MONTH_NAMES[period.month - 1]} {period.year}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {msg ? <p style={errorBannerStyle}>{msg}</p> : null}

        <AppFormField label="Lectura actual *">
          <input
            type="number"
            value={currentReading}
            onChange={e => setCurrentReading(e.target.value)}
            placeholder="0.00"
            style={{ ...INPUT_STYLE, fontSize: 20, fontWeight: 700 }}
            step="0.01"
            autoFocus
          />
          {current > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: consumption >= 0 ? "#15803d" : "#dc2626", fontWeight: 600 }}>
              Consumo: {consumption.toFixed(2)} kWh
            </p>
          )}
        </AppFormField>

        {isAbnormal && (
          <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, marginBottom: 12, fontSize: 13, color: "#92400e" }}>
            ⚠️ Lectura más alta de lo normal. Verifica que sea correcta.
          </div>
        )}

        <AppFormField label="Foto del medidor *">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => setPhotoFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              padding: "20px 16px", borderRadius: 12,
              border: `2px dashed ${photoFile ? "#15803d" : "var(--border-default)"}`,
              background: photoFile ? "#dcfce7" : "var(--bg-card)", cursor: "pointer", textAlign: "center",
            }}
          >
            {photoFile ? (
              <p style={{ margin: 0, color: "#15803d", fontWeight: 600, fontSize: 14 }}>📷 {photoFile.name}</p>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>📷 Toca para tomar foto del medidor</p>
            )}
          </div>
        </AppFormField>

        <AppFormField label="Notas (opcional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" style={TEXTAREA_STYLE} />
        </AppFormField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>{saving ? "Guardando..." : "Capturar lectura"}</UiButton>
        </div>
      </form>
    </Modal>
  );
}
