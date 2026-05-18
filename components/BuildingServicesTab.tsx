"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle, ChevronDown, ChevronRight,
  Droplets, Flame, Info, Plus, Settings, Settings2, Trash2, Wifi, Zap,
} from "lucide-react"

import { supabase } from "@/lib/supabaseClient"
import AppEmptyState from "@/components/AppEmptyState"
import UiButton from "@/components/UiButton"
import DeleteConfirmModal from "@/components/DeleteConfirmModal"
import UtilityMeterModal from "@/components/UtilityMeterModal"
import UtilitySubMetersModal from "@/components/UtilitySubMetersModal"
import { sortByNatural } from "@/lib/sort-utils"
import type { BuildingUtilityMeter, BuildingUtilitySubMeter, UtilityServiceType } from "@/lib/types"
import { SERVICE_TYPE_LABEL, BILLING_FREQUENCY_LABEL, meterGeneratesCharge } from "@/lib/types"

type Props = {
  buildingId: string
  companyId: string
  buildingName: string
  units: { id: string; unit_number: string; display_code: string | null }[]
  refreshKey?: number
}

const SERVICE_TYPE_ORDER: UtilityServiceType[] = ["electricity", "gas", "water", "internet", "other"]

const SERVICE_TYPE_TO_CONCEPT: Partial<Record<UtilityServiceType, string>> = {
  electricity: "electricity",
  gas:         "gas",
  water:       "water",
}

function ServiceIcon({ type, size = 14 }: { type: UtilityServiceType; size?: number }) {
  switch (type) {
    case "electricity": return <Zap size={size} />
    case "gas":         return <Flame size={size} />
    case "water":       return <Droplets size={size} />
    case "internet":    return <Wifi size={size} />
    default:            return <Settings size={size} />
  }
}

const SERVICE_TYPE_COLOR: Partial<Record<UtilityServiceType, string>> = {
  electricity: "#F59E0B",
  gas:         "#EF4444",
  water:       "#3B82F6",
  internet:    "#8B5CF6",
}

function MeterRow({
  meter,
  units,
  subs,
  onEdit,
  onDelete,
  onConfigSubs,
}: {
  meter: BuildingUtilityMeter
  units: { id: string; unit_number: string; display_code: string | null }[]
  subs: (BuildingUtilitySubMeter & { unit_number?: string })[]
  onEdit: () => void
  onDelete: () => void
  onConfigSubs: () => void
}) {
  const [subsOpen, setSubsOpen] = useState(false)
  const dedicatedUnit = meter.meter_type === "dedicated" && meter.unit_id
    ? units.find(u => u.id === meter.unit_id)
    : null

  const hasSubs = meter.meter_type === "shared" && meter.billing_mode !== "included" && meter.billing_type !== "fixed"

  return (
    <div style={{ background: "var(--color-background-primary, var(--bg-card))", border: "0.5px solid var(--color-border-tertiary, var(--border-default))", borderRadius: "var(--border-radius-md, 10px)", padding: "10px 14px", marginBottom: 6 }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Provider + meter number */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {meter.provider_name ?? "Sin proveedor"}
          </span>
          {meter.meter_number && (
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", padding: "1px 6px", background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: 4 }}>
              {meter.meter_number}
            </span>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {meter.meter_type === "dedicated" ? (
            <>
              <span style={badgeStyle("gray")}>Dedicado</span>
              {meter.contract_holder === "tenant"
                ? <span style={badgeStyle("gray")}>Inquilino directo</span>
                : <span style={badgeStyle("green")}>Empresa cobra</span>}
              {dedicatedUnit && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Depa {dedicatedUnit.unit_number}</span>
              )}
            </>
          ) : (
            <>
              <span style={badgeStyle("blue")}>Compartido</span>
              {meter.billing_mode === "included"
                ? <span style={badgeStyle("gray")}>Incluido en renta</span>
                : <span style={badgeStyle("blue")}>Se cobra</span>}
            </>
          )}
          {meterGeneratesCharge(meter) && (
            <span style={badgeStyle("gray")}>{BILLING_FREQUENCY_LABEL[meter.billing_frequency]}</span>
          )}
          {meter.billing_type === "fixed" && meter.fixed_amount > 0 && (
            <span style={badgeStyle("indigo")}>${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(meter.fixed_amount)}/mes</span>
          )}
          {meter.meter_type === "shared" && meter.billing_mode === "included" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
              <Info size={10} />Gasto del edificio
            </span>
          )}
          {hasSubs && subs.length === 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#92400e", background: "#fef3c7", borderRadius: 4, padding: "1px 6px" }}>
              <AlertTriangle size={10} />Sin submedidores
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {hasSubs && (
            <button
              type="button"
              onClick={onConfigSubs}
              style={rowBtnStyle()}
            >
              <Settings2 size={11} />Submedidores
            </button>
          )}
          <button type="button" onClick={onEdit} style={rowBtnStyle()}>Editar</button>
          <button type="button" onClick={onDelete} style={rowBtnStyle("danger")}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Collapsible submeters */}
      {hasSubs && subs.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setSubsOpen(o => !o)}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
          >
            {subsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {subsOpen ? 'Ocultar' : `Ver ${subs.length} submedidor${subs.length === 1 ? '' : 'es'}`}
          </button>
          {subsOpen && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {subs.map(sm => (
                <span key={sm.id} style={{ fontSize: 12, padding: "2px 8px", background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: 999, color: "var(--text-secondary)" }}>
                  Depa {sm.unit_number ?? sm.unit_id.slice(0, 6)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function badgeStyle(variant: "gray" | "green" | "blue" | "indigo"): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    gray:   { background: "var(--divider)", color: "var(--text-secondary)" },
    green:  { background: "#d1fae5", color: "#065f46" },
    blue:   { background: "#dbeafe", color: "#1d4ed8" },
    indigo: { background: "#ede9fe", color: "#5b21b6" },
  }
  return { ...map[variant], fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999 }
}

function rowBtnStyle(variant?: "danger"): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "pointer",
    border: variant === "danger" ? "1px solid #fca5a5" : "1px solid var(--border-default)",
    background: "transparent",
    color: variant === "danger" ? "#dc2626" : "var(--text-secondary)",
  }
}

export default function BuildingServicesTab({ buildingId, companyId, buildingName: _buildingName, units, refreshKey }: Props) {
  const [meters, setMeters]               = useState<BuildingUtilityMeter[]>([])
  const [placeholders, setPlaceholders]   = useState<BuildingUtilityMeter[]>([])
  const [subMetersMap, setSubMetersMap]   = useState<Record<string, BuildingUtilitySubMeter[]>>({})
  const [loading, setLoading]             = useState(true)

  const [meterModalOpen, setMeterModalOpen]       = useState(false)
  const [editingMeter, setEditingMeter]           = useState<BuildingUtilityMeter | null>(null)
  const [subMetersModalFor, setSubMetersModalFor] = useState<BuildingUtilityMeter | null>(null)
  const [deletingMeter, setDeletingMeter]         = useState<BuildingUtilityMeter | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  async function loadData(): Promise<BuildingUtilityMeter[]> {
    setLoading(true)
    try {
      const [{ data: metersData }, { data: placeholderData }] = await Promise.all([
        supabase
          .from("building_utility_meters")
          .select("*")
          .eq("building_id", buildingId)
          .eq("active", true)
          .is("deleted_at", null)
          .order("service_type")
          .order("created_at"),
        supabase
          .from("building_utility_meters")
          .select("*")
          .eq("building_id", buildingId)
          .eq("active", false)
          .is("deleted_at", null)
          .order("service_type"),
      ])

      const loadedMeters = (metersData ?? []) as BuildingUtilityMeter[]
      setMeters(loadedMeters)
      setPlaceholders((placeholderData ?? []) as BuildingUtilityMeter[])

      const ids = loadedMeters.map(m => m.id)
      const map: Record<string, BuildingUtilitySubMeter[]> = {}

      if (ids.length > 0) {
        const { data: subData } = await supabase
          .from("building_utility_sub_meters")
          .select("*")
          .in("building_utility_meter_id", ids)
          .eq("active", true)
          .is("deleted_at", null)

        const subs = (subData ?? []) as BuildingUtilitySubMeter[]
        for (const sub of subs) {
          const enriched = {
            ...sub,
            unit_number: units.find(u => u.id === sub.unit_id)?.unit_number ?? undefined,
          } as BuildingUtilitySubMeter & { unit_number?: string }
          if (!map[sub.building_utility_meter_id]) map[sub.building_utility_meter_id] = []
          map[sub.building_utility_meter_id].push(enriched)
        }
        for (const meterId of Object.keys(map)) {
          map[meterId] = sortByNatural(
            map[meterId] as (BuildingUtilitySubMeter & { unit_number?: string })[],
            sm => (sm as BuildingUtilitySubMeter & { unit_number?: string }).unit_number ?? sm.unit_id,
          )
        }
      }
      setSubMetersMap(map)
      return loadedMeters
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [buildingId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function syncBillingConcept(conceptCode: string, shouldBeActive: boolean) {
    if (shouldBeActive) {
      await supabase.from("building_billing_concepts").upsert(
        { building_id: buildingId, company_id: companyId, concept_code: conceptCode, is_active: true },
        { onConflict: "building_id,concept_code" },
      )
    } else {
      await supabase
        .from("building_billing_concepts")
        .update({ is_active: false })
        .eq("building_id", buildingId)
        .eq("concept_code", conceptCode)
    }
  }

  async function syncAllConcepts(currentMeters: BuildingUtilityMeter[]) {
    const entries = Object.entries(SERVICE_TYPE_TO_CONCEPT) as [UtilityServiceType, string][]
    await Promise.all(
      entries.map(([serviceType, code]) => {
        const hasCharge = currentMeters.some(m => m.service_type === serviceType && meterGeneratesCharge(m))
        return syncBillingConcept(code, hasCharge)
      }),
    )
  }

  async function handleDeleteConfirm() {
    if (!deletingMeter) return
    await supabase.from("building_utility_meters").update({ deleted_at: new Date().toISOString() }).eq("id", deletingMeter.id)
    setConfirmDeleteOpen(false)
    setDeletingMeter(null)
    const fresh = await loadData()
    await syncAllConcepts(fresh)
  }

  const groups = SERVICE_TYPE_ORDER
    .map(type => ({ type, meters: meters.filter(m => m.service_type === type) }))
    .filter(g => g.meters.length > 0)

  return (
    <div style={{ background: "var(--color-background-secondary, var(--bg-page))", borderRadius: "var(--border-radius-lg, 14px)", padding: 16, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          SUMINISTROS
        </span>
        <button
          type="button"
          onClick={() => { setEditingMeter(null); setMeterModalOpen(true) }}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <Plus size={12} />Agregar servicio
        </button>
      </div>

      {!loading && meters.length === 0 && placeholders.length === 0 && (
        <AppEmptyState
          title="Sin servicios configurados"
          description="Registra electricidad, gas, agua, internet y otros servicios del edificio."
          actionLabel="+ Agregar servicio"
          onAction={() => { setEditingMeter(null); setMeterModalOpen(true) }}
        />
      )}

      {/* Placeholders */}
      {placeholders.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {placeholders.map((ph) => (
            <div key={ph.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1.5px dashed #EF9F27", background: "var(--bg-page)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#EF9F27" }}><ServiceIcon type={ph.service_type as UtilityServiceType} size={14} /></span>
                <span style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "2px 7px", borderRadius: 999, fontWeight: 700 }}>Pendiente</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {SERVICE_TYPE_LABEL[ph.service_type as UtilityServiceType] ?? ph.service_type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setEditingMeter(ph); setMeterModalOpen(true) }}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
              >
                Configurar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Meter groups */}
      {groups.map((group, gi) => (
        <div key={group.type} style={{ marginTop: gi > 0 ? 16 : 0 }}>
          {/* Group label */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ color: SERVICE_TYPE_COLOR[group.type] ?? "var(--text-muted)" }}>
              <ServiceIcon type={group.type} size={12} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {SERVICE_TYPE_LABEL[group.type]}
            </span>
          </div>
          {/* Rows */}
          <div>
            {group.meters.map(meter => (
              <MeterRow
                key={meter.id}
                meter={meter}
                units={units}
                subs={(subMetersMap[meter.id] as (BuildingUtilitySubMeter & { unit_number?: string })[] | undefined) ?? []}
                onEdit={() => { setEditingMeter(meter); setMeterModalOpen(true) }}
                onDelete={() => { setDeletingMeter(meter); setConfirmDeleteOpen(true) }}
                onConfigSubs={() => setSubMetersModalFor(meter)}
              />
            ))}
          </div>
        </div>
      ))}

      <UtilityMeterModal
        isOpen={meterModalOpen}
        buildingId={buildingId}
        companyId={companyId}
        units={units}
        existingMeter={editingMeter}
        onClose={() => { setMeterModalOpen(false); setEditingMeter(null) }}
        onSuccess={() => {
          setMeterModalOpen(false)
          setEditingMeter(null)
          void (async () => {
            const fresh = await loadData()
            await syncAllConcepts(fresh)
          })()
        }}
      />

      <UtilitySubMetersModal
        isOpen={!!subMetersModalFor}
        meter={subMetersModalFor!}
        existingSubMeters={subMetersModalFor ? (subMetersMap[subMetersModalFor.id] ?? []) : []}
        units={units}
        onClose={() => setSubMetersModalFor(null)}
        onSuccess={() => { setSubMetersModalFor(null); void loadData() }}
      />

      <DeleteConfirmModal
        open={confirmDeleteOpen}
        title="Eliminar servicio"
        description={
          deletingMeter
            ? `¿Eliminar el servicio de ${SERVICE_TYPE_LABEL[deletingMeter.service_type]}? Se ocultará del sistema.`
            : ""
        }
        confirmText="Eliminar servicio"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => { setConfirmDeleteOpen(false); setDeletingMeter(null) }}
      />
    </div>
  )
}
