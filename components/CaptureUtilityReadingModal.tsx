"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera, MapPin, User } from "lucide-react";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, TEXTAREA_STYLE, errorBannerStyle } from "@/lib/pageStyles";
import type { BuildingUtilityMeter, BuildingUtilitySubMeter } from "@/lib/types";
import { SERVICE_TYPE_UNIT } from "@/lib/types";

const MONTH_NAMES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTH_SHORT  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

type Props = {
  isOpen: boolean;
  subMeter: BuildingUtilitySubMeter & { unit_number: string };
  meter: BuildingUtilityMeter;
  activeLease: { tenant_name: string } | null;
  period: { year: number; month: number };
  previousReading: number;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CaptureUtilityReadingModal({
  isOpen,
  subMeter,
  meter,
  activeLease,
  period,
  previousReading,
  onClose,
  onSuccess,
}: Props) {
  const [currentReading, setCurrentReading] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [bucketMissing, setBucketMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const captureDate      = new Date();
  const captureDateLabel = `${captureDate.getDate()} ${MONTH_SHORT[captureDate.getMonth()]} ${captureDate.getFullYear()}`;

  const consumptionUnit = SERVICE_TYPE_UNIT[meter.service_type];
  const hasConsumption  = consumptionUnit !== null;
  const current         = parseFloat(currentReading) || 0;
  const consumption     = current > 0 ? current - previousReading : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!currentReading || isNaN(parseFloat(currentReading))) { setMsg("Ingresa la lectura actual."); return; }
    if (parseFloat(currentReading) < previousReading) { setMsg("La lectura actual no puede ser menor que la anterior."); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let photoPath: string | null = null;
      if (photoFile) {
        const ext  = photoFile.name.split(".").pop() || "jpg";
        const path = `${meter.company_id}/${meter.id}/${period.year}-${String(period.month).padStart(2, "0")}/${subMeter.unit_id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("utility-readings")
          .upload(path, photoFile, { upsert: false });

        if (uploadError) {
          if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("bucket")) {
            setBucketMissing(true);
            setMsg("El bucket 'utility-readings' no existe aún. La lectura se guardará sin foto.");
          } else {
            setMsg(`Error subiendo foto: ${uploadError.message}`);
            setSaving(false);
            return;
          }
        } else {
          photoPath = path;
        }
      }

      const { error: insertError } = await supabase.from("building_utility_readings").insert({
        company_id:                    meter.company_id,
        building_utility_meter_id:     meter.id,
        building_utility_sub_meter_id: subMeter.id,
        period_year:                   period.year,
        period_month:                  period.month,
        previous_reading:              previousReading,
        current_reading:               parseFloat(currentReading),
        consumption:                   hasConsumption ? consumption : null,
        reading_date:                  new Date().toISOString().split("T")[0],
        photo_path:                    photoPath,
        notes:                         notes.trim() || null,
        created_by:                    user?.id || null,
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
    <Modal
      open
      onClose={onClose}
      title={`Depa ${subMeter.unit_number} — ${meter.provider_name || meter.service_type}`}
    >
      {meter.building_id && (
        <p style={{ margin: "0 0 8px", fontSize: "0.8125rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
          <MapPin size={13} />{meter.description || meter.meter_number || meter.service_type}
        </p>
      )}

      {activeLease ? (
        <p style={{ margin: "0 0 12px", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
          <User size={14} />{activeLease.tenant_name}
        </p>
      ) : (
        <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.1)", borderRadius: "var(--border-radius-md)", marginBottom: 12, fontSize: "0.8125rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />Este depa no tiene inquilino activo
        </div>
      )}

      <div style={{ padding: "10px 14px", background: "var(--bg-page)", borderRadius: "var(--border-radius-md)", marginBottom: 16, fontSize: "0.8125rem" }}>
        <span>Lectura anterior: <strong>{previousReading.toLocaleString("es-MX")}</strong>
          {consumptionUnit ? ` ${consumptionUnit}` : ""}
        </span>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "0.75rem" }}>
          Período: {MONTH_NAMES[period.month - 1]} {period.year}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.75rem" }}>
          Fecha de captura: {captureDateLabel}
        </p>
      </div>

      {bucketMissing && (
        <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.1)", borderRadius: "var(--border-radius-md)", marginBottom: 12, fontSize: "0.8125rem", color: "var(--text-primary)", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Crea el bucket <strong>utility-readings</strong> en Supabase Storage para habilitar fotos.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {msg && !bucketMissing ? <p style={errorBannerStyle}>{msg}</p> : null}

        <AppFormField label="Lectura actual *">
          <input
            type="number"
            value={currentReading}
            onChange={e => setCurrentReading(e.target.value)}
            placeholder="0.00"
            style={{ ...INPUT_STYLE, fontSize: "1.25rem", fontWeight: 700 }}
            step="0.01"
            autoFocus
          />
          {current > 0 && hasConsumption && (
            <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: consumption >= 0 ? "var(--metric-value-green)" : "var(--metric-value-red)", fontWeight: 600 }}>
              Consumo: {consumption.toFixed(2)} {consumptionUnit}
            </p>
          )}
        </AppFormField>

        <AppFormField label="Foto del medidor (opcional)">
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
              padding: "20px 16px", borderRadius: "var(--border-radius-lg)",
              border: `2px dashed ${photoFile ? "rgba(16,185,129,0.5)" : "var(--border-default)"}`,
              background: photoFile ? "rgba(16,185,129,0.08)" : "var(--bg-card)", cursor: "pointer", textAlign: "center",
            }}
          >
            {photoFile ? (
              <p style={{ margin: 0, color: "var(--metric-value-green)", fontWeight: 600, fontSize: "0.875rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Camera size={14} />{photoFile.name}
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Camera size={14} />Toca para tomar foto del medidor
              </p>
            )}
          </div>
        </AppFormField>

        <AppFormField label="Notas (opcional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" style={TEXTAREA_STYLE} />
        </AppFormField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : "Capturar lectura"}
          </UiButton>
        </div>
      </form>
    </Modal>
  );
}
