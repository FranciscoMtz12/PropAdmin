"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle, ChevronDown, ChevronRight,
  Droplets, Flame, Info, Plus, Settings, Settings2, Trash2, Wifi, Zap,
} from "lucide-react"

import { supabase } from "@/lib/supabaseClient"
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

const SERVICE_TYPE_COLOR: Partial<Record<UtilityServiceType, string>> = {
  electricity: "#F59E0B",
  gas:         "#EF4444",
  water:       "#3B82F6",
  internet:    "#8B5CF6",
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

function Badge({ variant, children }: { variant: "gray" | "green" | "blue" | "indigo"; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    gray:   { background: "var(--divider, #f1f5f9)", color: "var(--text-secondary)" },
    green:  { background: "#d1fae5", color: "#065f46" },
    blue:   { background: "#dbeafe", color: "#1d4ed8" },
    indigo: { background: "#ede9fe", color: "#5b21b6" },
  }
  return (
    <span style={{ ...styles[variant], fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999 }}>
      {children}
    </span>
  )
}

function MeterRow({
  meter, units, subs, onEdit, onDelete, onConfigSubs, isLast,
}: {
  meter: BuildingUtilityMeter
  units: { id: string; unit_number: string; display_code: string | null }[]
  subs: (BuildingUtilitySubMeter & { unit_number?: string })[]
  onEdit: () => void
  onDelete: () => void
  onConfigSubs: () => void
  isLast: boolean
}) {
  const [subsOpen, setSubsOpen] = useState(false)
  const dedicatedUnit = meter.meter_type === "dedicated" && meter.unit_id
    ? units.find(u => u.id === meter.unit_id)
    : null
  const hasSubs = meter.meter_type === "shared" && meter.billing_mode !== "included" && meter.billing_type !== "fixed"

  return (
    <div style={{ borderBottom: isLast ? "none" : "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", flexWrap: "wrap" }}>
        {/* Name + number */}
        <div style={{ minWidth: 120, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {meter.provider_name ?? "Sin proveedor"}
          </span>
          {meter.meter_number && (
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", padding: "1px 6px", background: "var(--bg-page, #f8fafc)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-sm)" }}>
              {meter.meter_number}
            </span>
          )}
        </div>

        {/* Badges */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {meter.meter_type === "dedicated" ? (
            <>
              <Badge variant="gray">Dedicado</Badge>
              {meter.contract_holder === "tenant"
                ? <Badge variant="gray">Inquilino directo</Badge>
                : <Badge variant="green">Empresa cobra</Badge>}
              {dedicatedUnit && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Depa {dedicatedUnit.unit_number}</span>
              )}
            </>
          ) : (
            <>
              <Badge variant="blue">Compartido</Badge>
              {meter.billing_mode === "included"
                ? <Badge variant="gray">Incluido en renta</Badge>
                : <Badge variant="blue">Se cobra</Badge>}
            </>
          )}
          {meterGeneratesCharge(meter) && (
            <Badge variant="gray">{BILLING_FREQUENCY_LABEL[meter.billing_frequency]}</Badge>
          )}
          {meter.billing_type === "fixed" && meter.fixed_amount > 0 && (
            <Badge variant="indigo">${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(meter.fixed_amount)}/mes</Badge>
          )}
          {meter.meter_type === "shared" && meter.billing_mode === "included" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
              <Info size={10} />Gasto del edificio
            </span>
          )}
          {hasSubs && subs.length === 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-primary)", background: "rgba(245,158,11,0.12)", borderRadius: 999, padding: "1px 7px" }}>
              <AlertTriangle size={10} />Sin submedidores
            </span>
          )}
          {hasSubs && subs.length > 0 && (
            <button
              type="button"
              onClick={() => setSubsOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: "var(--accent, #8B2252)", display: "inline-flex", alignItems: "center", gap: 2 }}
            >
              {subsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Ver {subs.length} submedidor{subs.length === 1 ? "" : "es"}
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {hasSubs && (
            <button type="button" onClick={onConfigSubs} style={ghostBtn()}>
              <Settings2 size={11} />Submedidores
            </button>
          )}
          <button type="button" onClick={onEdit} style={ghostBtn()}>Editar</button>
          <button type="button" onClick={onDelete} style={{ ...ghostBtn(), color: "#dc2626", borderColor: "#fca5a5" }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Expanded submeters */}
      {subsOpen && subs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 18px 10px" }}>
          {subs.map(sm => (
            <span key={sm.id} style={{ fontSize: 12, padding: "2px 8px", background: "var(--bg-page, #f8fafc)", border: "1px solid var(--border-default)", borderRadius: 999, color: "var(--text-secondary)" }}>
              Depa {sm.unit_number ?? sm.unit_id.slice(0, 6)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ghostBtn(extra?: React.CSSProperties): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 11, padding: "3px 8px", borderRadius: "var(--border-radius-sm)", cursor: "pointer",
    border: "1px solid var(--border-default)", background: "transparent",
    color: "var(--text-secondary)",
    ...extra,
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

  const isEmpty = !loading && meters.length === 0 && placeholders.length === 0

  return (
    <div style={{ background: "var(--color-background-primary, var(--bg-card))", border: "0.5px solid var(--color-border-tertiary, var(--border-default))", borderRadius: "var(--border-radius-lg, 14px)", overflow: "hidden", marginBottom: 20 }}>

      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Zap size={14} color="var(--accent, #8B2252)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Suministros</span>
        </div>
        <button
          type="button"
          onClick={() => { setEditingMeter(null); setMeterModalOpen(true) }}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <Plus size={12} />Agregar servicio
        </button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div style={{ padding: "24px 18px", textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>Sin servicios configurados</p>
          <button
            type="button"
            onClick={() => { setEditingMeter(null); setMeterModalOpen(true) }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--accent, #8B2252)", background: "transparent", color: "var(--accent, #8B2252)", cursor: "pointer", fontWeight: 600 }}
          >
            <Plus size={12} />Agregar servicio
          </button>
        </div>
      )}

      {/* Placeholders (medidores pendientes) */}
      {placeholders.map((ph) => (
        <div key={ph.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 18px", borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))", background: "rgba(245,158,11,0.08)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#F59E0B" }}><ServiceIcon type={ph.service_type as UtilityServiceType} size={14} /></span>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", background: "rgba(245,158,11,0.15)", padding: "1px 7px", borderRadius: 999, display: "inline-block", marginBottom: 2 }}>
                Pendiente de configurar
              </span>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                {SERVICE_TYPE_LABEL[ph.service_type as UtilityServiceType] ?? ph.service_type} — completa la configuración
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setEditingMeter(ph); setMeterModalOpen(true) }}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: "var(--border-radius-sm)", border: "1px dashed #D97706", background: "transparent", color: "#D97706", cursor: "pointer", fontWeight: 600 }}
          >
            Configurar ahora →
          </button>
        </div>
      ))}

      {/* Meter groups */}
      {groups.map((group, gi) => (
        <div key={group.type}>
          {/* Group label */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: gi === 0 && placeholders.length === 0 ? "12px 18px 6px" : "12px 18px 6px", borderTop: gi > 0 ? "0.5px solid var(--color-border-tertiary, var(--border-default))" : undefined }}>
            <span style={{ color: SERVICE_TYPE_COLOR[group.type] ?? "var(--text-muted)", lineHeight: 0 }}>
              <ServiceIcon type={group.type} size={12} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {SERVICE_TYPE_LABEL[group.type]}
            </span>
          </div>
          {/* Rows */}
          {group.meters.map((meter, mi) => (
            <MeterRow
              key={meter.id}
              meter={meter}
              units={units}
              subs={(subMetersMap[meter.id] as (BuildingUtilitySubMeter & { unit_number?: string })[] | undefined) ?? []}
              onEdit={() => { setEditingMeter(meter); setMeterModalOpen(true) }}
              onDelete={() => { setDeletingMeter(meter); setConfirmDeleteOpen(true) }}
              onConfigSubs={() => setSubMetersModalFor(meter)}
              isLast={mi === group.meters.length - 1}
            />
          ))}
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
