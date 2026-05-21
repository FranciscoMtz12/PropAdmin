"use client"

import { useRef, useState } from "react"
import { FileText, Info } from "lucide-react"
import Modal from "@/components/Modal"
import AppFormField from "@/components/AppFormField"
import UiButton from "@/components/UiButton"
import { supabase } from "@/lib/supabaseClient"
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles"
import type { BuildingUtilityMeter } from "@/lib/types"
import { SERVICE_TYPE_LABEL } from "@/lib/types"

const MONTH_LABELS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)
}

type Props = {
  isOpen: boolean
  meter: BuildingUtilityMeter
  building: { id: string; name: string }
  period: { year: number; month: number }
  companyId: string
  onClose: () => void
  onSuccess: () => void
}

export default function UploadFixedInvoiceModal({
  isOpen,
  meter,
  building,
  period,
  companyId,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount]   = useState(meter.fixed_amount > 0 ? String(meter.fixed_amount) : "")
  const [folio, setFolio]     = useState("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const periodLabel = `${MONTH_LABELS[period.month - 1]} ${period.year}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setMsg("El importe es obligatorio."); return }
    setSaving(true)
    setMsg("")
    try {
      let pdfPath: string | null = null
      if (pdfFile) {
        const padMonth = String(period.month).padStart(2, "0")
        const path = `${companyId}/${building.id}/${meter.id}/${period.year}-${padMonth}.pdf`
        const { error: uploadError } = await supabase.storage
          .from("utility-invoices")
          .upload(path, pdfFile, { upsert: true })
        if (uploadError && !uploadError.message?.includes("Bucket not found")) {
          setMsg(`Error subiendo PDF: ${uploadError.message}`)
          setSaving(false)
          return
        }
        if (!uploadError) pdfPath = path
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("building_utility_invoices").insert({
        company_id:                companyId,
        building_id:               building.id,
        building_utility_meter_id: meter.id,
        period_year:               period.year,
        period_month:              period.month,
        total_amount:              amt,
        total_consumption:         null,
        consumption_unit:          null,
        folio:                     folio.trim() || null,
        pdf_path:                  pdfPath,
        status:                    "distributed",
        payment_status:            "unpaid",
        created_by:                user?.id ?? null,
      })
      if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return }
      onSuccess()
    } catch {
      setMsg("Error inesperado.")
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal open onClose={onClose} title={`Subir factura — ${SERVICE_TYPE_LABEL[meter.service_type] ?? meter.service_type}`}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
        {building.name} · {periodLabel}
      </p>

      {meter.fixed_amount > 0 && (
        <div style={{
          padding: "10px 14px", background: "#eff6ff", borderRadius: "var(--border-radius-md)", marginBottom: 14,
          fontSize: 13, color: "#1d4ed8", display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Monto fijo configurado: <strong>{fmt(meter.fixed_amount)}/mes</strong>. Confirma o ajusta el monto real.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {msg && <p style={{ ...errorBannerStyle, marginBottom: 14 }}>{msg}</p>}

        <AppFormField label="Monto real de la factura *">
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" style={{ ...INPUT_STYLE, fontSize: 16, fontWeight: 700 }}
            step="0.01" min="0" autoFocus
          />
        </AppFormField>

        <AppFormField label="Folio / número de factura (opcional)">
          <input
            value={folio} onChange={e => setFolio(e.target.value)}
            placeholder="Ej. 1234567890" style={INPUT_STYLE}
          />
        </AppFormField>

        <AppFormField label="PDF de la factura (opcional)">
          <input
            ref={fileRef} type="file" accept=".pdf,image/*"
            onChange={e => setPdfFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              padding: "14px", borderRadius: "var(--border-radius-md)", cursor: "pointer", textAlign: "center",
              border: `2px dashed ${pdfFile ? "#15803d" : "var(--border-default)"}`,
              background: pdfFile ? "#dcfce7" : "var(--bg-card)",
            }}
          >
            {pdfFile ? (
              <p style={{ margin: 0, color: "#15803d", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />{pdfFile.name}
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
            {saving ? "Guardando..." : "Registrar factura"}
          </UiButton>
        </div>
      </form>
    </Modal>
  )
}
