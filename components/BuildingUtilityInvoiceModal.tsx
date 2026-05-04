"use client"
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, FileText, Info, MapPin } from "lucide-react"
import Modal from "@/components/Modal"
import AppFormField from "@/components/AppFormField"
import UiButton from "@/components/UiButton"
import { supabase } from "@/lib/supabaseClient"
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles"
import { sortByNatural } from "@/lib/sort-utils"
import type { BuildingUtilityMeter, BuildingUtilityInvoice } from "@/lib/types"
import { SERVICE_TYPE_LABEL, SERVICE_TYPE_UNIT } from "@/lib/types"

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

type ActiveLeaseInfo = { id: string; tenant_id: string; tenant_name: string; lease_id: string }
type DistRow = { unit_id: string; unit_number: string; tenant_name: string; lease_id: string; pct: number; amount: number }

type Props = {
  meter: BuildingUtilityMeter
  building: { id: string; name: string }
  period: { year: number; month: number }
  companyId: string
  existingInvoice: BuildingUtilityInvoice | null
  units: { id: string; unit_number: string }[]
  onClose: () => void
  onSuccess: (toastMsg: string) => void
}

export default function BuildingUtilityInvoiceModal({
  meter,
  building,
  period,
  companyId,
  existingInvoice,
  units,
  onClose,
  onSuccess,
}: Props) {
  const [totalAmount, setTotalAmount]     = useState(existingInvoice ? String(existingInvoice.total_amount) : "")
  const [totalConsumption, setTotalConsumption] = useState(
    existingInvoice?.total_consumption != null ? String(existingInvoice.total_consumption) : ""
  )
  const [folio, setFolio]                 = useState(existingInvoice?.folio ?? "")
  const [pdfFile, setPdfFile]             = useState<File | null>(null)
  const [saving, setSaving]               = useState(false)
  const [msg, setMsg]                     = useState("")
  const [bucketMissing, setBucketMissing] = useState(false)

  const [activeLeases, setActiveLeases]     = useState<Map<string, ActiveLeaseInfo>>(new Map())
  const [subMeterUnitIds, setSubMeterUnitIds] = useState<string[]>([])
  const [loadingLeases, setLoadingLeases]   = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const isShared = meter.meter_type === "shared"
  const isEdit   = !!existingInvoice
  const consumptionUnit = SERVICE_TYPE_UNIT[meter.service_type]

  // On mount: for shared meters, load sub-meters and active leases
  useEffect(() => {
    if (!isShared) return
    void loadSharedData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSharedData() {
    setLoadingLeases(true)
    try {
      const { data: subMeters } = await supabase
        .from("building_utility_sub_meters")
        .select("unit_id")
        .eq("building_utility_meter_id", meter.id)
        .eq("active", true)
        .is("deleted_at", null)

      const unitIds = ((subMeters || []) as Array<{ unit_id: string }>).map(s => s.unit_id)
      setSubMeterUnitIds(unitIds)

      if (unitIds.length === 0) {
        setLoadingLeases(false)
        return
      }

      const today = new Date().toISOString().split("T")[0]

      const { data: leasesData } = await supabase
        .from("leases")
        .select("id, unit_id, tenant:tenants(id, full_name)")
        .in("unit_id", unitIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)

      const map = new Map<string, ActiveLeaseInfo>()
      for (const row of (leasesData || []) as unknown as Array<{
        id: string
        unit_id: string
        tenant: { id: string; full_name: string } | null
      }>) {
        if (!row.tenant) continue
        map.set(row.unit_id, {
          id:          row.id,
          tenant_id:   row.tenant.id,
          tenant_name: row.tenant.full_name,
          lease_id:    row.id,
        })
      }
      setActiveLeases(map)
    } finally {
      setLoadingLeases(false)
    }
  }

  // Computed distribution for shared meters
  const tenantedUnitIds = subMeterUnitIds.filter(uid => activeLeases.has(uid))
  const parsedAmount    = parseFloat(totalAmount)
  const amountValid     = !isNaN(parsedAmount) && parsedAmount > 0

  const distRows: DistRow[] = amountValid && tenantedUnitIds.length > 0
    ? sortByNatural(
        tenantedUnitIds.map(uid => {
          const lease     = activeLeases.get(uid)!
          const unitInfo  = units.find(u => u.id === uid)
          const pct       = 100 / tenantedUnitIds.length
          const amount    = parsedAmount / tenantedUnitIds.length
          return {
            unit_id:     uid,
            unit_number: unitInfo?.unit_number ?? "—",
            tenant_name: lease.tenant_name,
            lease_id:    lease.lease_id,
            pct,
            amount,
          }
        }),
        r => r.unit_number,
      )
    : []

  // Dedicated unit info
  const dedicatedUnit = meter.unit_id ? units.find(u => u.id === meter.unit_id) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg("")

    if (!totalAmount || isNaN(parseFloat(totalAmount))) {
      setMsg("El importe total es obligatorio.")
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // PDF upload
      let pdfPath = existingInvoice?.pdf_path ?? null
      if (pdfFile) {
        const ext  = pdfFile.name.split(".").pop() || "pdf"
        const padMonth = String(period.month).padStart(2, "0")
        const path = `${companyId}/${meter.service_type}/${meter.id}/${period.year}-${padMonth}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("utility-invoices")
          .upload(path, pdfFile, { upsert: false })
        if (uploadError) {
          if (
            uploadError.message?.includes("Bucket not found") ||
            uploadError.message?.includes("bucket")
          ) {
            setBucketMissing(true)
            setMsg("El bucket 'utility-invoices' no existe aún. La factura se guardará sin PDF.")
          } else {
            setMsg(`Error subiendo PDF: ${uploadError.message}`)
            setSaving(false)
            return
          }
        } else {
          pdfPath = path
        }
      }

      const total = parseFloat(totalAmount)
      const payload = {
        company_id:                 companyId,
        building_id:                building.id,
        building_utility_meter_id:  meter.id,
        period_year:                period.year,
        period_month:               period.month,
        total_amount:               total,
        total_consumption:          totalConsumption ? parseFloat(totalConsumption) : null,
        consumption_unit:           consumptionUnit,
        folio:                      folio.trim() || null,
        pdf_path:                   pdfPath,
        status:                     "charged" as const,
        charged_at:                 new Date().toISOString(),
        created_by:                 user?.id ?? null,
      }

      let invoiceId: string

      if (isEdit) {
        const { error } = await supabase
          .from("building_utility_invoices")
          .update(payload)
          .eq("id", existingInvoice!.id)
        if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return }
        invoiceId = existingInvoice!.id
      } else {
        const { data, error } = await supabase
          .from("building_utility_invoices")
          .insert(payload)
          .select("id")
          .single()
        if (error || !data) { setMsg(`Error: ${error?.message ?? "Sin respuesta"}`); setSaving(false); return }
        invoiceId = (data as { id: string }).id
      }

      // Post-upsert logic
      if (meter.meter_type === "dedicated") {
        await handleDedicatedCharges(invoiceId, total, user?.id ?? null)
      } else {
        await handleSharedCharges(invoiceId, total, user?.id ?? null)
      }
    } catch (err) {
      setMsg("Error inesperado.")
      setSaving(false)
    }
  }

  async function getOrCreateSchedule(
    unitId: string,
    unitNumber: string,
    leaseId: string,
    amount: number,
  ): Promise<string | null> {
    const { data: existing } = await supabase
      .from("collection_schedules")
      .select("id")
      .eq("company_id", companyId)
      .eq("unit_id", unitId)
      .eq("charge_type", "services")
      .eq("active", true)
      .is("deleted_at", null)
      .limit(1)

    if (existing && existing.length > 0) {
      return (existing[0] as { id: string }).id
    }

    const { data: newSched, error: schedError } = await supabase
      .from("collection_schedules")
      .insert({
        company_id:          companyId,
        building_id:         building.id,
        unit_id:             unitId,
        lease_id:            leaseId,
        charge_type:         "services",
        title:               `${SERVICE_TYPE_LABEL[meter.service_type]} — Depa ${unitNumber}`,
        responsibility_type: "tenant",
        amount_expected:     amount,
        due_day:             5,
        active:              true,
        notes:               "Generado automáticamente desde facturación de servicios.",
      })
      .select("id")
      .single()

    if (schedError || !newSched) {
      setMsg(`Error al crear programa de cobro para Depa ${unitNumber}: ${schedError?.message}`)
      return null
    }
    return (newSched as { id: string }).id
  }

  async function upsertCollectionRecord(
    scheduleId: string,
    unitId: string,
    leaseId: string,
    amount: number,
  ): Promise<string | null> {
    const padMonth = String(period.month).padStart(2, "0")
    const dueDate  = `${period.year}-${padMonth}-05`

    const { data: rec, error: recError } = await supabase
      .from("collection_records")
      .upsert({
        collection_schedule_id: scheduleId,
        company_id:   companyId,
        building_id:  building.id,
        unit_id:      unitId,
        lease_id:     leaseId,
        period_year:  period.year,
        period_month: period.month,
        due_date:     dueDate,
        amount_due:   amount,
        status:       "pending",
        notes:        `${SERVICE_TYPE_LABEL[meter.service_type]} ${MONTH_NAMES[period.month - 1]} ${period.year}`,
      }, { onConflict: "collection_schedule_id,period_year,period_month" })
      .select("id")
      .single()

    if (recError || !rec) {
      setMsg(`Error al generar cobro: ${recError?.message}`)
      return null
    }
    return (rec as { id: string }).id
  }

  async function handleDedicatedCharges(invoiceId: string, total: number, userId: string | null) {
    if (!meter.unit_id) {
      onSuccess("Factura registrada")
      setSaving(false)
      return
    }

    const today = new Date().toISOString().split("T")[0]
    const { data: leasesData } = await supabase
      .from("leases")
      .select("id, unit_id, tenant:tenants(id, full_name)")
      .eq("unit_id", meter.unit_id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .lte("start_date", today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .limit(1)

    const leaseRow = leasesData?.[0] as {
      id: string
      unit_id: string
      tenant: { id: string; full_name: string } | null
    } | undefined

    let collectionRecordId: string | null = null

    if (leaseRow) {
      const unitNumber = dedicatedUnit?.unit_number ?? meter.unit_id
      const scheduleId = await getOrCreateSchedule(meter.unit_id, unitNumber, leaseRow.id, total)
      if (!scheduleId) { setSaving(false); return }

      collectionRecordId = await upsertCollectionRecord(scheduleId, meter.unit_id, leaseRow.id, total)
      if (!collectionRecordId) { setSaving(false); return }
    }

    const { error: itemError } = await supabase
      .from("building_utility_invoice_items")
      .insert({
        invoice_id:                    invoiceId,
        building_utility_sub_meter_id: null,
        unit_id:                       meter.unit_id,
        consumption:                   totalConsumption ? parseFloat(totalConsumption) : null,
        percentage:                    100,
        amount_assigned:               total,
        collection_record_id:          collectionRecordId,
      })

    if (itemError) { setMsg(`Error al guardar ítem: ${itemError.message}`); setSaving(false); return }

    onSuccess("Factura registrada y cobro generado")
    setSaving(false)
  }

  async function handleSharedCharges(invoiceId: string, total: number, userId: string | null) {
    if (tenantedUnitIds.length === 0) {
      onSuccess("Factura registrada (sin unidades con inquilino activo)")
      setSaving(false)
      return
    }

    const amountPerUnit = total / tenantedUnitIds.length
    const items: Array<{
      invoice_id: string
      building_utility_sub_meter_id: null
      unit_id: string
      consumption: number | null
      percentage: number
      amount_assigned: number
      collection_record_id: string | null
    }> = []

    for (const uid of tenantedUnitIds) {
      const lease     = activeLeases.get(uid)!
      const unitInfo  = units.find(u => u.id === uid)
      const unitNumber = unitInfo?.unit_number ?? uid

      const scheduleId = await getOrCreateSchedule(uid, unitNumber, lease.lease_id, amountPerUnit)
      if (!scheduleId) { setSaving(false); return }

      const collectionRecordId = await upsertCollectionRecord(scheduleId, uid, lease.lease_id, amountPerUnit)
      if (!collectionRecordId) { setSaving(false); return }

      items.push({
        invoice_id:                    invoiceId,
        building_utility_sub_meter_id: null,
        unit_id:                       uid,
        consumption:                   null,
        percentage:                    parseFloat((100 / tenantedUnitIds.length).toFixed(4)),
        amount_assigned:               parseFloat(amountPerUnit.toFixed(2)),
        collection_record_id:          collectionRecordId,
      })
    }

    const { error: itemsError } = await supabase
      .from("building_utility_invoice_items")
      .insert(items)

    if (itemsError) { setMsg(`Error al guardar ítems: ${itemsError.message}`); setSaving(false); return }

    onSuccess(`Factura distribuida y cobros generados para ${tenantedUnitIds.length} depas`)
    setSaving(false)
  }

  const periodLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`
  const formattedAmount = amountValid
    ? parsedAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })
    : ""

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    fontWeight: 600,
    color: "var(--text-secondary)",
    borderBottom: "2px solid var(--border-default)",
    fontSize: 12,
  }
  const tdStyle: React.CSSProperties = {
    padding: "8px 10px",
    verticalAlign: "middle",
    fontSize: 13,
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${SERVICE_TYPE_LABEL[meter.service_type]} — ${building.name}`}
    >
      {/* Subtitle row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MapPin size={13} />{building.name}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {meter.provider_name || "Sin proveedor"} · {periodLabel}
        </span>
      </div>

      {/* Bucket missing warning */}
      {bucketMissing && (
        <div style={{
          padding: "10px 14px",
          background: "#fef3c7",
          borderRadius: 10,
          marginBottom: 14,
          fontSize: 13,
          color: "#92400e",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Crea el bucket <strong>utility-invoices</strong> en Supabase Storage para habilitar PDFs.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {msg && !bucketMissing ? <p style={{ ...errorBannerStyle, marginBottom: 14 }}>{msg}</p> : null}
        {msg && bucketMissing ? (
          <p style={{
            padding: "10px 14px",
            background: "#fef3c7",
            borderRadius: 10,
            marginBottom: 14,
            fontSize: 13,
            color: "#92400e",
          }}>{msg}</p>
        ) : null}

        {/* Importe total */}
        <AppFormField label="Importe total *">
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

        {/* Consumo (only if unit is defined) */}
        {consumptionUnit !== null && (
          <AppFormField label={`Consumo total (${consumptionUnit}) (opcional)`}>
            <input
              type="number"
              value={totalConsumption}
              onChange={e => setTotalConsumption(e.target.value)}
              placeholder="0.00"
              style={INPUT_STYLE}
              step="0.01"
              min="0"
            />
          </AppFormField>
        )}

        {/* Folio */}
        <AppFormField label="Folio / referencia (opcional)">
          <input
            value={folio}
            onChange={e => setFolio(e.target.value)}
            placeholder="Ej. 1234567890"
            style={INPUT_STYLE}
          />
        </AppFormField>

        {/* PDF upload */}
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
              padding: "16px",
              borderRadius: 12,
              cursor: "pointer",
              textAlign: "center",
              border: `2px dashed ${pdfFile ? "#15803d" : existingInvoice?.pdf_path ? "#1d4ed8" : "var(--border-default)"}`,
              background: pdfFile ? "#dcfce7" : existingInvoice?.pdf_path ? "#eff6ff" : "var(--bg-card)",
            }}
          >
            {pdfFile ? (
              <p style={{ margin: 0, color: "#15803d", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />{pdfFile.name}
              </p>
            ) : existingInvoice?.pdf_path ? (
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

        {/* Dedicated meter: info banner */}
        {!isShared && amountValid && (
          <div style={{
            padding: "12px 14px",
            background: "#eff6ff",
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: "#1d4ed8",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            El cobro de <strong>${formattedAmount}</strong> se asignará directamente a Depa{" "}
            <strong>{dedicatedUnit?.unit_number ?? "—"}</strong>.
          </div>
        )}

        {/* Shared meter: distribution table or warning */}
        {isShared && amountValid && !loadingLeases && (
          <div style={{ marginBottom: 16 }}>
            {tenantedUnitIds.length === 0 ? (
              <div style={{
                padding: "10px 14px",
                background: "#fef3c7",
                borderRadius: 10,
                fontSize: 13,
                color: "#92400e",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                No hay unidades con inquilino activo para distribuir.
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Distribución equitativa — {tenantedUnitIds.length} unidades
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-page)" }}>
                        <th style={thStyle}>Depa</th>
                        <th style={thStyle}>Inquilino</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>%</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distRows.map(r => (
                        <tr key={r.unit_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                          <td style={tdStyle}><strong>{r.unit_number}</strong></td>
                          <td style={tdStyle}>{r.tenant_name}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{r.pct.toFixed(1)}%</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                            ${r.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg-page)", fontWeight: 700 }}>
                        <td colSpan={2} style={tdStyle}>Total</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>100%</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          ${parsedAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {isShared && loadingLeases && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Cargando inquilinos activos...
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar factura"}
          </UiButton>
        </div>
      </form>
    </Modal>
  )
}
