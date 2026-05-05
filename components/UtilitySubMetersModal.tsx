"use client"

import { useEffect, useState } from "react"
import type { BuildingUtilityMeter, BuildingUtilitySubMeter } from "@/lib/types"
import { SERVICE_TYPE_LABEL } from "@/lib/types"
import { supabase } from "@/lib/supabaseClient"
import { sortByNatural } from "@/lib/sort-utils"
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles"
import Modal from "@/components/Modal"
import UiButton from "@/components/UiButton"
import { Info } from "lucide-react"

type Props = {
  isOpen: boolean
  meter: BuildingUtilityMeter
  units: { id: string; unit_number: string }[]
  existingSubMeters: BuildingUtilitySubMeter[]
  onClose: () => void
  onSuccess: () => void
}

type UnitState = {
  checked: boolean
  subMeterNumber: string
  baselineReading: string
  existingId: string | null
}

export default function UtilitySubMetersModal({
  isOpen,
  meter,
  units,
  existingSubMeters,
  onClose,
  onSuccess,
}: Props) {
  const [unitStates, setUnitStates] = useState<Record<string, UnitState>>({})
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const initial: Record<string, UnitState> = {}
    units.forEach(u => {
      const existing = existingSubMeters.find(sm => sm.unit_id === u.id && !sm.deleted_at)
      initial[u.id] = {
        checked: !!existing,
        subMeterNumber: existing?.sub_meter_number || "",
        baselineReading: existing ? String(existing.baseline_reading) : "0",
        existingId: existing?.id || null,
      }
    })
    setUnitStates(initial)
  }, [units, existingSubMeters, isOpen])

  if (!isOpen) return null

  const sortedUnits = sortByNatural(units, u => u.unit_number)

  function updateUnit(unitId: string, patch: Partial<UnitState>) {
    setUnitStates(prev => ({ ...prev, [unitId]: { ...prev[unitId], ...patch } }))
  }

  async function handleSave() {
    setSaving(true)
    setErrorMsg(null)

    for (const unit of sortedUnits) {
      const state = unitStates[unit.id]
      if (!state) continue

      if (!state.checked && state.existingId !== null) {
        const { error } = await supabase
          .from("building_utility_sub_meters")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", state.existingId)
        if (error) { setErrorMsg(`Error al eliminar submedidor: ${error.message}`); setSaving(false); return }
      } else if (state.checked && state.existingId === null) {
        const { error } = await supabase
          .from("building_utility_sub_meters")
          .insert({
            building_utility_meter_id: meter.id,
            unit_id: unit.id,
            sub_meter_number: state.subMeterNumber.trim() || null,
            baseline_reading: parseFloat(state.baselineReading) || 0,
            active: true,
          })
        if (error) { setErrorMsg(`Error al crear submedidor: ${error.message}`); setSaving(false); return }
      } else if (state.checked && state.existingId !== null) {
        const { error } = await supabase
          .from("building_utility_sub_meters")
          .update({
            sub_meter_number: state.subMeterNumber.trim() || null,
            baseline_reading: parseFloat(state.baselineReading) || 0,
            deleted_at: null,
            active: true,
          })
          .eq("id", state.existingId)
        if (error) { setErrorMsg(`Error al actualizar submedidor: ${error.message}`); setSaving(false); return }
      }
    }

    setSaving(false)
    onSuccess()
  }

  const modalTitle =
    `Submedidores — ${meter.provider_name || SERVICE_TYPE_LABEL[meter.service_type]} (${meter.meter_number || "sin núm."})`

  return (
    <Modal open title={modalTitle} onClose={onClose} maxWidth="640px">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Marca las unidades conectadas a este medidor. La lectura base puede ser 0 si no la conoces.</span>
      </div>

      {errorMsg && <div style={{ ...errorBannerStyle, marginBottom: 16 }}>{errorMsg}</div>}

      <div style={{ maxHeight: "50vh", overflowY: "auto", display: "grid", gap: 8 }}>
        {sortedUnits.map(unit => {
          const state = unitStates[unit.id]
          if (!state) return null
          const checked = state.checked

          return (
            <div
              key={unit.id}
              style={{
                borderRadius: 12,
                border: checked ? "1px solid #8B2252" : "1px solid var(--border-default)",
                background: checked ? "rgba(139,34,82,0.04)" : "var(--bg-card)",
                padding: "12px 14px",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => updateUnit(unit.id, { checked: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#8B2252" }}
                />
                {unit.unit_number}
              </label>

              {checked && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Número de submedidor (opcional)
                    </label>
                    <input
                      type="text"
                      value={state.subMeterNumber}
                      onChange={e => updateUnit(unit.id, { subMeterNumber: e.target.value })}
                      placeholder="Ej. SM-01"
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Lectura base</label>
                    <input
                      type="number"
                      value={state.baselineReading}
                      onChange={e => updateUnit(unit.id, { baselineReading: e.target.value })}
                      step={0.01}
                      min={0}
                      placeholder="0"
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sortedUnits.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
            No hay unidades en este edificio.
          </p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-default)" }}>
        <UiButton variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
        <UiButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </UiButton>
      </div>
    </Modal>
  )
}
