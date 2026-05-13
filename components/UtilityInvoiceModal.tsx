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

type ActiveLeaseInfo = { id: string; tenant_name: string }

type DistRow = {
  sub_meter_id: string | null
  unit_id: string
  unit_number: string
  tenant_name: string
  lease_id: string
  consumption: number | null
  pct: number
  amount: number
}

type Props = {
  isOpen: boolean
  meter: BuildingUtilityMeter
  building: { id: string; name: string }
  period: { year: number; month: number }
  companyId: string
  existingInvoice: BuildingUtilityInvoice | null
  units: { id: string; unit_number: string }[]
  onClose: () => void
  onSuccess: () => void
}

export default function UtilityInvoiceModal({
  isOpen,
  meter,
  building,
  period,
  companyId,
  existingInvoice,
  units,
  onClose,
  onSuccess,
}: Props) {
  const [totalAmount, setTotalAmount]         = useState(existingInvoice ? String(existingInvoice.total_amount) : "")
  const [totalConsumption, setTotalConsumption] = useState(
    existingInvoice?.total_consumption != null ? String(existingInvoice.total_consumption) : ""
  )
  const [folio, setFolio]                     = useState(existingInvoice?.folio ?? "")
  const [dueDate, setDueDate]                 = useState(() => {
    if (existingInvoice?.due_date) return existingInvoice.due_date
    const lastDay = new Date(period.year, period.month, 0).getDate()
    return `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  })
  const [pdfFile, setPdfFile]                 = useState<File | null>(null)
  const [saving, setSaving]                   = useState(false)
  const [msg, setMsg]                         = useState("")
  const [bucketMissing, setBucketMissing]     = useState(false)

  // For shared+charged meters
  const [subMeters, setSubMeters]     = useState<Array<{ id: string; unit_id: string }>>([])
  const [activeLeases, setActiveLeases] = useState<Map<string, ActiveLeaseInfo>>(new Map())
  const [readingsBySubMeter, setReadingsBySubMeter] = useState<Map<string, number>>(new Map())
  const [loadingData, setLoadingData] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const isShared          = meter.meter_type === "shared"
  const isIncluded        = meter.billing_mode === "included"
  const isTenantContract  = !isShared && meter.contract_holder === "tenant"
  const isEdit            = !!existingInvoice
  const consumptionUnit   = SERVICE_TYPE_UNIT[meter.service_type]
  // Required for all service types that have a consumption unit (i.e. not internet)
  const consumptionRequired = consumptionUnit !== null

  useEffect(() => {
    if (!isOpen) return
    if (!isShared || isIncluded) return
    void loadSharedData()
  }, [isOpen, meter.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSharedData() {
    setLoadingData(true)
    try {
      const { data: smData } = await supabase
        .from("building_utility_sub_meters")
        .select("id, unit_id")
        .eq("building_utility_meter_id", meter.id)
        .eq("active", true)
        .is("deleted_at", null)

      const subs = (smData || []) as Array<{ id: string; unit_id: string }>
      setSubMeters(subs)
      const unitIds  = subs.map(s => s.unit_id)
      const smIds    = subs.map(s => s.id)

      if (unitIds.length === 0) { setLoadingData(false); return }

      const today = new Date().toISOString().split("T")[0]

      const [leasesRes, readingsRes] = await Promise.all([
        supabase
          .from("leases")
          .select("id, unit_id, tenant:tenants(id, full_name)")
          .in("unit_id", unitIds)
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .lte("start_date", today)
          .or(`end_date.is.null,end_date.gte.${today}`),
        smIds.length > 0
          ? supabase
              .from("building_utility_readings")
              .select("building_utility_sub_meter_id, consumption")
              .in("building_utility_sub_meter_id", smIds)
              .eq("period_year", period.year)
              .eq("period_month", period.month)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] }),
      ])

      const leaseMap = new Map<string, ActiveLeaseInfo>()
      for (const row of (leasesRes.data || []) as unknown as Array<{
        id: string; unit_id: string; tenant: { id: string; full_name: string } | null
      }>) {
        if (row.tenant) leaseMap.set(row.unit_id, { id: row.id, tenant_name: row.tenant.full_name })
      }
      setActiveLeases(leaseMap)

      const readMap = new Map<string, number>()
      for (const r of (readingsRes.data || []) as Array<{
        building_utility_sub_meter_id: string; consumption: number | null
      }>) {
        if (r.consumption != null) readMap.set(r.building_utility_sub_meter_id, r.consumption)
      }
      setReadingsBySubMeter(readMap)
    } finally {
      setLoadingData(false)
    }
  }

  // Compute distribution rows
  const parsedAmount  = parseFloat(totalAmount)
  const amountValid   = !isNaN(parsedAmount) && parsedAmount > 0
  const hasReadings   = readingsBySubMeter.size > 0

  const distRows: DistRow[] = (() => {
    if (!isShared || isIncluded || !amountValid) return []

    if (hasReadings) {
      // Proportional by consumption
      const totalCons = [...readingsBySubMeter.values()].reduce((s, v) => s + v, 0)
      const rows: DistRow[] = []
      for (const sm of subMeters) {
        const cons  = readingsBySubMeter.get(sm.id) ?? 0
        if (cons <= 0) continue
        const lease = activeLeases.get(sm.unit_id)
        if (!lease) continue
        const pct    = totalCons > 0 ? (cons / totalCons) * 100 : 0
        const amount = totalCons > 0 ? (cons / totalCons) * parsedAmount : 0
        const unit   = units.find(u => u.id === sm.unit_id)
        rows.push({
          sub_meter_id: sm.id,
          unit_id:      sm.unit_id,
          unit_number:  unit?.unit_number ?? "—",
          tenant_name:  lease.tenant_name,
          lease_id:     lease.id,
          consumption:  cons,
          pct,
          amount,
        })
      }
      return sortByNatural(rows, r => r.unit_number)
    } else {
      // Equal parts among tenanted units
      const tenanted = subMeters
        .filter(sm => activeLeases.has(sm.unit_id))
        .map(sm => sm.unit_id)
        .filter((uid, i, a) => a.indexOf(uid) === i)
      if (tenanted.length === 0) return []
      const pct    = 100 / tenanted.length
      const amount = parsedAmount / tenanted.length
      return sortByNatural(
        tenanted.map(uid => {
          const lease = activeLeases.get(uid)!
          const sm    = subMeters.find(s => s.unit_id === uid)
          const unit  = units.find(u => u.id === uid)
          return {
            sub_meter_id: sm?.id ?? null,
            unit_id:      uid,
            unit_number:  unit?.unit_number ?? "—",
            tenant_name:  lease.tenant_name,
            lease_id:     lease.id,
            consumption:  null,
            pct,
            amount,
          }
        }),
        r => r.unit_number,
      )
    }
  })()

  const dedicatedUnit = meter.unit_id ? units.find(u => u.id === meter.unit_id) : null
  const formattedAmount = amountValid
    ? parsedAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })
    : ""

  async function getOrCreateSchedule(
    unitId: string, unitNumber: string, leaseId: string, amount: number,
  ): Promise<string | null> {
    const { data: existing } = await supabase
      .from("collection_schedules")
      .select("id")
      .eq("company_id", companyId)
      .eq("unit_id", unitId)
      .eq("charge_type", meter.service_type)
      .eq("active", true)
      .is("deleted_at", null)
      .limit(1)

    if (existing && existing.length > 0) return (existing[0] as { id: string }).id

    const { data: newSched, error } = await supabase
      .from("collection_schedules")
      .insert({
        company_id:          companyId,
        building_id:         building.id,
        unit_id:             unitId,
        lease_id:            leaseId,
        charge_type:         meter.service_type,
        title:               `${SERVICE_TYPE_LABEL[meter.service_type]} — Depa ${unitNumber}`,
        responsibility_type: "tenant",
        amount_expected:     amount,
        due_day:             5,
        active:              true,
        notes:               "Generado automáticamente desde facturación de servicios.",
      })
      .select("id")
      .single()

    if (error || !newSched) { setMsg(`Error al crear programa: ${error?.message}`); return null }
    return (newSched as { id: string }).id
  }

  async function upsertCollectionRecord(
    scheduleId: string, unitId: string, leaseId: string, amount: number, notesSuffix: string,
  ): Promise<string | null> {
    const padMonth = String(period.month).padStart(2, "0")

    const { data: existing } = await supabase
      .from("collection_records")
      .select("id")
      .eq("collection_schedule_id", scheduleId)
      .eq("period_year", period.year)
      .eq("period_month", period.month)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from("collection_records")
        .update({ amount_due: amount, needs_capture: false, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) { setMsg(`Error al actualizar cobro: ${error.message}`); return null }
      return (existing as { id: string }).id
    }

    const { data: rec, error } = await supabase
      .from("collection_records")
      .insert({
        collection_schedule_id: scheduleId,
        company_id:   companyId,
        building_id:  building.id,
        unit_id:      unitId,
        lease_id:     leaseId,
        period_year:  period.year,
        period_month: period.month,
        due_date:     `${period.year}-${padMonth}-05`,
        amount_due:    amount,
        needs_capture: false,
        status:        "pending",
        notes:         `${SERVICE_TYPE_LABEL[meter.service_type]} ${MONTH_NAMES[period.month - 1]} ${period.year}${notesSuffix}`,
      })
      .select("id")
      .single()

    if (error || !rec) { setMsg(`Error al generar cobro: ${error?.message}`); return null }
    return (rec as { id: string }).id
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg("")
    if (!totalAmount || isNaN(parseFloat(totalAmount))) { setMsg("El importe total es obligatorio."); return }
    if (consumptionRequired && (!totalConsumption || parseFloat(totalConsumption) <= 0)) {
      setMsg("El consumo total es requerido para calcular la distribución entre submedidores")
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // PDF upload
      let pdfPath = existingInvoice?.pdf_path ?? null
      if (pdfFile) {
        const ext      = pdfFile.name.split(".").pop() || "pdf"
        const padMonth = String(period.month).padStart(2, "0")
        const path     = `${companyId}/${meter.service_type}/${meter.id}/${period.year}-${padMonth}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("utility-invoices")
          .upload(path, pdfFile, { upsert: false })
        if (uploadError) {
          if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("bucket")) {
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
        company_id:                companyId,
        building_id:               building.id,
        building_utility_meter_id: meter.id,
        period_year:               period.year,
        period_month:              period.month,
        total_amount:              total,
        total_consumption:         totalConsumption ? parseFloat(totalConsumption) : null,
        consumption_unit:          consumptionUnit,
        folio:                     folio.trim() || null,
        due_date:                  dueDate || null,
        pdf_path:                  pdfPath,
        status:                    "charged" as const,
        charged_at:                new Date().toISOString(),
        created_by:                user?.id ?? null,
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

      // No charges for included or tenant-contract
      if (isIncluded || isTenantContract) { onSuccess(); setSaving(false); return }

      if (meter.meter_type === "dedicated") {
        await handleDedicatedCharges(invoiceId, total)
      } else {
        await handleSharedCharges(invoiceId, total)
      }
    } catch {
      setMsg("Error inesperado.")
      setSaving(false)
    }
  }

  async function handleDedicatedCharges(invoiceId: string, total: number) {
    if (!meter.unit_id) { onSuccess(); setSaving(false); return }

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

    const leaseRow = leasesData?.[0] as { id: string; unit_id: string; tenant: { id: string; full_name: string } | null } | undefined
    let collectionRecordId: string | null = null

    if (leaseRow) {
      const unitNumber = dedicatedUnit?.unit_number ?? meter.unit_id
      const scheduleId = await getOrCreateSchedule(meter.unit_id, unitNumber, leaseRow.id, total)
      if (!scheduleId) { setSaving(false); return }
      const consumptionSuffix = totalConsumption ? ` — ${parseFloat(totalConsumption).toFixed(2)} ${consumptionUnit ?? ""}` : ""
      collectionRecordId = await upsertCollectionRecord(scheduleId, meter.unit_id, leaseRow.id, total, consumptionSuffix)
      if (!collectionRecordId) { setSaving(false); return }
    }

    await supabase.from("building_utility_invoice_items").insert({
      invoice_id:                    invoiceId,
      building_utility_sub_meter_id: null,
      unit_id:                       meter.unit_id,
      consumption:                   totalConsumption ? parseFloat(totalConsumption) : null,
      percentage:                    100,
      amount_assigned:               total,
      collection_record_id:          collectionRecordId,
    })

    onSuccess()
    setSaving(false)
  }

  async function handleSharedCharges(invoiceId: string, total: number) {
    if (distRows.length === 0) { onSuccess(); setSaving(false); return }

    const items: Array<{
      invoice_id: string
      building_utility_sub_meter_id: string | null
      unit_id: string
      consumption: number | null
      percentage: number
      amount_assigned: number
      collection_record_id: string | null
    }> = []

    for (const row of distRows) {
      const scheduleId = await getOrCreateSchedule(row.unit_id, row.unit_number, row.lease_id, row.amount)
      if (!scheduleId) { setSaving(false); return }
      const consumptionSuffix = row.consumption != null ? ` — ${row.consumption.toFixed(2)} ${consumptionUnit ?? ""}` : ""
      const collectionRecordId = await upsertCollectionRecord(scheduleId, row.unit_id, row.lease_id, row.amount, consumptionSuffix)
      if (!collectionRecordId) { setSaving(false); return }

      items.push({
        invoice_id:                    invoiceId,
        building_utility_sub_meter_id: row.sub_meter_id,
        unit_id:                       row.unit_id,
        consumption:                   row.consumption,
        percentage:                    parseFloat(row.pct.toFixed(4)),
        amount_assigned:               parseFloat(row.amount.toFixed(2)),
        collection_record_id:          collectionRecordId,
      })
    }

    const { error } = await supabase.from("building_utility_invoice_items").insert(items)
    if (error) { setMsg(`Error al guardar ítems: ${error.message}`); setSaving(false); return }

    onSuccess()
    setSaving(false)
  }

  const periodLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`
  const thStyle: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", borderBottom: "2px solid var(--border-default)", fontSize: 12 }
  const tdStyle: React.CSSProperties = { padding: "8px 10px", verticalAlign: "middle", fontSize: 13 }

  if (!isOpen) return null

  return (
    <Modal open onClose={onClose} title={`${SERVICE_TYPE_LABEL[meter.service_type]} — ${building.name}`}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MapPin size={13} />{building.name}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {[meter.provider_name || "Sin proveedor", meter.billing_frequency === "bimonthly" ? "Bimestral" : null, periodLabel]
            .filter(Boolean).join(" · ")}
        </span>
      </div>

      {bucketMissing && (
        <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Crea el bucket <strong>utility-invoices</strong> en Supabase Storage para habilitar PDFs.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {msg && !bucketMissing ? <p style={{ ...errorBannerStyle, marginBottom: 14 }}>{msg}</p> : null}

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

        {consumptionUnit !== null && (
          <AppFormField label={consumptionRequired ? `Consumo total (${consumptionUnit}) *` : `Consumo total (${consumptionUnit}) (opcional)`}>
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

        <AppFormField label="Folio / referencia (opcional)">
          <input value={folio} onChange={e => setFolio(e.target.value)} placeholder="Ej. 1234567890" style={INPUT_STYLE} />
        </AppFormField>

        <AppFormField label="Fecha límite de pago al proveedor (opcional)">
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={INPUT_STYLE} />
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

        {/* Dedicated + tenant contract */}
        {isTenantContract && amountValid && (
          <div style={{ padding: "12px 14px", background: "var(--bg-page)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "flex-start", gap: 8, border: "1px solid var(--border-default)" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Contrato directo del inquilino — se registra solo como referencia, sin generar cobro.
          </div>
        )}

        {/* Dedicated + company contract */}
        {!isShared && !isTenantContract && amountValid && (
          <div style={{ padding: "12px 14px", background: "#eff6ff", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#1d4ed8", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            El cobro de <strong>${formattedAmount}</strong> se asignará directamente a Depa{" "}
            <strong>{dedicatedUnit?.unit_number ?? "—"}</strong>.
          </div>
        )}

        {/* Shared + included */}
        {isShared && isIncluded && amountValid && (
          <div style={{ padding: "12px 14px", background: "var(--bg-page)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "flex-start", gap: 8, border: "1px solid var(--border-default)" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Gasto del edificio — se registra sin generar cobros a inquilinos.
          </div>
        )}

        {/* Shared + charged: distribution table */}
        {isShared && !isIncluded && amountValid && !loadingData && (
          <div style={{ marginBottom: 16 }}>
            {distRows.length === 0 ? (
              <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                No hay unidades con inquilino activo para distribuir.
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {hasReadings
                    ? `Distribución proporcional por consumo — ${distRows.length} unidades`
                    : `Distribución equitativa — ${distRows.length} unidades`}
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-page)" }}>
                        <th style={thStyle}>Depa</th>
                        <th style={thStyle}>Inquilino</th>
                        {hasReadings && <th style={{ ...thStyle, textAlign: "right" }}>Consumo</th>}
                        <th style={{ ...thStyle, textAlign: "right" }}>%</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distRows.map(r => (
                        <tr key={r.unit_id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                          <td style={tdStyle}><strong>{r.unit_number}</strong></td>
                          <td style={tdStyle}>{r.tenant_name}</td>
                          {hasReadings && (
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {r.consumption != null ? `${r.consumption.toFixed(2)} ${consumptionUnit ?? ""}` : "—"}
                            </td>
                          )}
                          <td style={{ ...tdStyle, textAlign: "right" }}>{r.pct.toFixed(1)}%</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                            ${r.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg-page)", fontWeight: 700 }}>
                        <td colSpan={hasReadings ? 3 : 2} style={tdStyle}>Total</td>
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

        {isShared && !isIncluded && loadingData && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Cargando datos...</p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving || (consumptionRequired && (!totalConsumption || parseFloat(totalConsumption) <= 0))}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar factura"}
          </UiButton>
        </div>
      </form>
    </Modal>
  )
}
