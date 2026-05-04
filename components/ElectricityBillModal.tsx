"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileText, MapPin, Zap } from "lucide-react";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles";
import type { ElectricityBill } from "@/lib/types";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Props = {
  cfeMeter: { id: string; meter_number: string; building_id: string };
  buildingName: string;
  companyId: string;
  period: { year: number; month: number };
  existingBill: ElectricityBill | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ElectricityBillModal({ cfeMeter, buildingName, companyId, period, existingBill, onClose, onSuccess }: Props) {
  const [totalAmount, setTotalAmount] = useState(existingBill ? String(existingBill.total_amount) : "");
  const [totalKwh, setTotalKwh]       = useState(existingBill ? String(existingBill.total_kwh) : "");
  const [folioCfe, setFolioCfe]       = useState(existingBill?.folio_cfe || "");
  const [pdfFile, setPdfFile]         = useState<File | null>(null);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");
  const [bucketMissing, setBucketMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!totalAmount || isNaN(parseFloat(totalAmount))) { setMsg("El importe total es obligatorio."); return; }
    if (!totalKwh || isNaN(parseFloat(totalKwh)) || parseFloat(totalKwh) <= 0) { setMsg("El total de kWh es obligatorio."); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let pdfPath = existingBill?.pdf_path || null;

      if (pdfFile) {
        const ext  = pdfFile.name.split(".").pop() || "pdf";
        const path = `${cfeMeter.id}/${period.year}-${String(period.month).padStart(2, "0")}/factura-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("electricity-bills")
          .upload(path, pdfFile, { upsert: false });
        if (uploadError) {
          if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("bucket")) {
            setBucketMissing(true);
            setMsg("El bucket 'electricity-bills' no existe aún. La factura se guardará sin PDF.");
          } else {
            setMsg(`Error subiendo PDF: ${uploadError.message}`);
            setSaving(false);
            return;
          }
        } else {
          pdfPath = path;
        }
      }

      const payload = {
        company_id:   companyId,
        building_id:  cfeMeter.building_id,
        cfe_meter_id: cfeMeter.id,
        period_year:  period.year,
        period_month: period.month,
        total_amount: parseFloat(totalAmount),
        total_kwh:    parseFloat(totalKwh),
        folio_cfe:    folioCfe.trim() || null,
        pdf_path:     pdfPath,
        status:       existingBill?.status || 'draft',
        created_by:   user?.id || null,
      };

      const { error } = existingBill
        ? await supabase.from("electricity_bills").update(payload).eq("id", existingBill.id)
        : await supabase.from("electricity_bills").insert(payload);

      if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
      onSuccess();
    } catch {
      setMsg("Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  const periodLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  const isEdit = !!existingBill;

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar factura CFE" : "Capturar factura CFE"}>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
        <MapPin size={13} />{buildingName}
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
        <Zap size={13} />Medidor {cfeMeter.meter_number} — {periodLabel}
      </p>

      {bucketMissing && (
        <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Crea el bucket <strong>electricity-bills</strong> en Supabase Storage para habilitar PDFs.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {msg && !bucketMissing ? <p style={errorBannerStyle}>{msg}</p> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <AppFormField label="Importe total CFE ($MXN) *">
            <input
              type="number"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="0.00"
              style={{ ...INPUT_STYLE, fontSize: 18, fontWeight: 700 }}
              step="0.01"
              min="0"
              autoFocus
            />
          </AppFormField>
          <AppFormField label="Total kWh facturados *">
            <input
              type="number"
              value={totalKwh}
              onChange={e => setTotalKwh(e.target.value)}
              placeholder="0.00"
              style={{ ...INPUT_STYLE, fontSize: 18, fontWeight: 700 }}
              step="0.01"
              min="0"
            />
          </AppFormField>
        </div>

        {totalAmount && totalKwh && parseFloat(totalKwh) > 0 ? (
          <p style={{ margin: "-8px 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
            Costo por kWh: <strong>${(parseFloat(totalAmount) / parseFloat(totalKwh)).toFixed(4)}</strong>
          </p>
        ) : null}

        <AppFormField label="Folio CFE (opcional)">
          <input
            value={folioCfe}
            onChange={e => setFolioCfe(e.target.value)}
            placeholder="Ej. 1234567890"
            style={INPUT_STYLE}
          />
        </AppFormField>

        <AppFormField label="PDF de la factura (opcional)">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            onChange={e => setPdfFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              padding: "16px", borderRadius: 12, cursor: "pointer", textAlign: "center",
              border: `2px dashed ${pdfFile ? "#15803d" : existingBill?.pdf_path ? "#1d4ed8" : "var(--border-default)"}`,
              background: pdfFile ? "#dcfce7" : existingBill?.pdf_path ? "#eff6ff" : "var(--bg-card)",
            }}
          >
            {pdfFile ? (
              <p style={{ margin: 0, color: "#15803d", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />{pdfFile.name}
              </p>
            ) : existingBill?.pdf_path ? (
              <p style={{ margin: 0, color: "#1d4ed8", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />PDF existente — toca para reemplazar
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />Toca para adjuntar PDF de la factura
              </p>
            )}
          </div>
        </AppFormField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar factura"}
          </UiButton>
        </div>
      </form>
    </Modal>
  );
}
