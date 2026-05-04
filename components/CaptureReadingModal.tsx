"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/Modal";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignment: {
    id: string;
    meter_id: string;
    unit_id: string;
    meter_number: string;
    unit_name: string;
    building_name: string;
  };
  lastReading: { reading_kwh: number; reading_date: string } | null;
  companyId: string;
  userId: string;
};

const UNUSUAL_KWH_THRESHOLD = 500;

export default function CaptureReadingModal({
  isOpen,
  onClose,
  onSuccess,
  assignment,
  lastReading,
  companyId,
  userId,
}: Props) {
  const [readingKwh, setReadingKwh] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readingNum = parseFloat(readingKwh);
  const consumption =
    lastReading && !isNaN(readingNum) ? readingNum - lastReading.reading_kwh : null;
  const isUnusual =
    consumption !== null &&
    (consumption > UNUSUAL_KWH_THRESHOLD || consumption < 0);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleClose() {
    if (isSubmitting) return;
    setReadingKwh("");
    setNotes("");
    setPhotoFile(null);
    setPhotoPreview(null);
    onClose();
  }

  async function handleSubmit() {
    if (!photoFile) { toast.error("La foto del medidor es obligatoria."); return; }
    if (!readingKwh || isNaN(readingNum)) { toast.error("Ingresa la lectura en kWh."); return; }
    if (readingNum < 0) { toast.error("La lectura no puede ser negativa."); return; }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `${assignment.meter_id}/${year}-${month}/${assignment.unit_id}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("electricity-readings")
        .upload(path, photoFile, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("electricity_readings").insert({
        company_id: companyId,
        meter_id: assignment.meter_id,
        unit_id: assignment.unit_id,
        reading_kwh: readingNum,
        reading_date: now.toISOString().slice(0, 10),
        photo_path: path,
        notes: notes.trim() || null,
        created_by: userId,
      });
      if (insertErr) throw insertErr;

      toast.success("Lectura registrada.");
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar lectura.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const subtitle = `${assignment.building_name} · ${assignment.unit_name} · Medidor ${assignment.meter_number}`;

  return (
    <Modal open={isOpen} onClose={handleClose} title="Capturar lectura" subtitle={subtitle} maxWidth="520px">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Foto */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Foto del medidor *
          </label>
          {photoPreview ? (
            <div style={{ position: "relative", marginBottom: 8 }}>
              <img
                src={photoPreview}
                alt="Foto medidor"
                style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border-default)" }}
              />
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                  width: 28, height: 28, cursor: "pointer",
                  color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: "32px 16px", borderRadius: 10,
                border: "2px dashed var(--border-default)",
                background: "var(--bg-input)", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                color: "var(--text-muted)", fontSize: 13,
              }}
            >
              <span style={{ fontSize: 28 }}>📷</span>
              Toca para tomar o subir foto
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Lectura kWh */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Lectura actual (kWh) *
          </label>
          <input
            type="number"
            min={0}
            step="any"
            value={readingKwh}
            onChange={(e) => setReadingKwh(e.target.value)}
            placeholder="Ej. 1254.8"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--bg-input)", color: "var(--text-primary)",
              fontSize: 16, boxSizing: "border-box",
            }}
          />

          {/* Consumo calculado */}
          {lastReading && !isNaN(readingNum) && readingKwh !== "" && (
            <div style={{
              marginTop: 8, padding: "10px 12px", borderRadius: 8,
              background: isUnusual ? "#fef3c7" : "#dcfce7",
              border: `1px solid ${isUnusual ? "#fde68a" : "#86efac"}`,
              fontSize: 13, color: isUnusual ? "#92400e" : "#15803d",
            }}>
              <strong>Consumo: {consumption! >= 0 ? "+" : ""}{consumption?.toFixed(1)} kWh</strong>
              {" "}(anterior: {lastReading.reading_kwh} kWh el {lastReading.reading_date})
              {isUnusual && (
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  ⚠️ Consumo {consumption! < 0 ? "negativo — verifica la lectura" : "inusualmente alto"}
                </div>
              )}
            </div>
          )}

          {lastReading && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Última lectura: {lastReading.reading_kwh} kWh · {lastReading.reading_date}
            </p>
          )}
        </div>

        {/* Notas */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Observaciones del medidor..."
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--bg-input)", color: "var(--text-primary)",
              fontSize: 14, resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border-default)" }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: "1px solid var(--border-default)", background: "var(--bg-input)",
              color: "var(--text-primary)", cursor: isSubmitting ? "wait" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              border: "1px solid #15803d", background: "#15803d",
              color: "#fff", cursor: isSubmitting ? "wait" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Guardando..." : "Registrar lectura"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
