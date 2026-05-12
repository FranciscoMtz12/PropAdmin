"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle, Droplets, Flame, Info,
  Plus, Settings, Settings2, Trash2, Wifi, Zap,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import SectionCard from "@/components/SectionCard"
import AppCard from "@/components/AppCard"
import AppBadge from "@/components/AppBadge"
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
}

const SERVICE_TYPE_ORDER: UtilityServiceType[] = ["electricity", "gas", "water", "internet", "other"]

const SERVICE_TYPE_TO_CONCEPT: Partial<Record<UtilityServiceType, string>> = {
  electricity: "electricity",
  gas:         "gas",
  water:       "water",
}

function ServiceIcon({ type, size = 16 }: { type: UtilityServiceType; size?: number }) {
  switch (type) {
    case "electricity": return <Zap size={size} />
    case "gas":         return <Flame size={size} />
    case "water":       return <Droplets size={size} />
    case "internet":    return <Wifi size={size} />
    default:            return <Settings size={size} />
  }
}

export default function BuildingServicesTab({ buildingId, companyId, buildingName: _buildingName, units }: Props) {
  const [meters, setMeters]             = useState<BuildingUtilityMeter[]>([])
  const [subMetersMap, setSubMetersMap] = useState<Record<string, BuildingUtilitySubMeter[]>>({})
  const [loading, setLoading]           = useState(true)

  const [meterModalOpen, setMeterModalOpen]       = useState(false)
  const [editingMeter, setEditingMeter]           = useState<BuildingUtilityMeter | null>(null)
  const [subMetersModalFor, setSubMetersModalFor] = useState<BuildingUtilityMeter | null>(null)
  const [deletingMeter, setDeletingMeter]         = useState<BuildingUtilityMeter | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  async function loadData(): Promise<BuildingUtilityMeter[]> {
    setLoading(true)
    try {
      const { data: metersData } = await supabase
        .from("building_utility_meters")
        .select("*")
        .eq("building_id", buildingId)
        .eq("active", true)
        .is("deleted_at", null)
        .order("service_type")
        .order("created_at")

      const loadedMeters = (metersData ?? []) as BuildingUtilityMeter[]
      setMeters(loadedMeters)

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

  useEffect(() => { void loadData() }, [buildingId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Servicios del edificio</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Electricidad, gas, agua, internet y otros servicios del inmueble.
          </p>
        </div>
        <UiButton
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => { setEditingMeter(null); setMeterModalOpen(true) }}
        >
          Agregar servicio
        </UiButton>
      </div>

      {!loading && meters.length === 0 && (
        <AppEmptyState
          title="Sin servicios configurados"
          description="Registra electricidad, gas, agua, internet y otros servicios del edificio."
          actionLabel="+ Agregar servicio"
          onAction={() => { setEditingMeter(null); setMeterModalOpen(true) }}
        />
      )}

      {groups.map(group => (
        <SectionCard
          key={group.type}
          title={SERVICE_TYPE_LABEL[group.type]}
          icon={<ServiceIcon type={group.type} size={16} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {group.meters.map(meter => {
              const dedicatedUnit =
                meter.meter_type === "dedicated" && meter.unit_id
                  ? units.find(u => u.id === meter.unit_id)
                  : null
              const subs = (
                subMetersMap[meter.id] as (BuildingUtilitySubMeter & { unit_number?: string })[] | undefined
              ) ?? []

              return (
                <AppCard key={meter.id} style={{ padding: 16, borderRadius: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {meter.provider_name ?? "Sin proveedor"}
                      </span>

                      {meter.meter_number && (
                        <span style={{ fontFamily: "monospace", padding: "2px 8px", background: "var(--bg-page)", borderRadius: 6, fontSize: 12, border: "1px solid var(--border-default)", alignSelf: "flex-start" }}>
                          {meter.meter_number}
                        </span>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {meter.meter_type === "dedicated" ? (
                          <>
                            <AppBadge variant="gray">Dedicado</AppBadge>
                            {meter.contract_holder === "tenant"
                              ? <AppBadge variant="gray">Inquilino paga directo</AppBadge>
                              : <AppBadge variant="green">Empresa cobra</AppBadge>}
                            {dedicatedUnit && (
                              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                Depa {dedicatedUnit.unit_number}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <AppBadge variant="blue">Compartido</AppBadge>
                            {meter.billing_mode === "included"
                              ? <AppBadge variant="gray">Incluido en renta</AppBadge>
                              : <AppBadge variant="blue">Se cobra</AppBadge>}
                          </>
                        )}
                        {meterGeneratesCharge(meter) && (
                          <AppBadge variant="gray">{BILLING_FREQUENCY_LABEL[meter.billing_frequency]}</AppBadge>
                        )}
                        {meter.billing_type === "fixed" && meter.fixed_amount > 0 && (
                          <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                            Monto fijo · ${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(meter.fixed_amount)}/mes
                          </span>
                        )}
                      </div>

                      {meter.meter_type === "shared" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          {meter.billing_mode === "included" ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-page)", color: "var(--text-secondary)", borderRadius: 10, padding: "6px 10px", fontSize: 12, alignSelf: "flex-start", border: "1px solid var(--border-default)" }}>
                              <Info size={12} />
                              Gasto del edificio — sin cobro al inquilino
                            </div>
                          ) : (
                            <>
                              {meter.billing_type !== "fixed" && (
                                <>
                                  {subs.length > 0 ? (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {subs.map(sm => (
                                        <span key={sm.id} style={{ padding: "2px 8px", background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: 999, fontSize: 12 }}>
                                          Depa {sm.unit_number ?? sm.unit_id.slice(0, 6)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fef3c7", color: "#92400e", borderRadius: 10, padding: "6px 10px", fontSize: 12, alignSelf: "flex-start" }}>
                                      <AlertTriangle size={12} />Sin submedidores configurados
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setSubMetersModalFor(meter)}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", alignSelf: "flex-start" }}
                                  >
                                    <Settings2 size={12} />Configurar submedidores
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ flexShrink: 0, display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { setEditingMeter(meter); setMeterModalOpen(true) }}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => { setDeletingMeter(meter); setConfirmDeleteOpen(true) }}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #dc2626", background: "transparent", color: "#dc2626", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Trash2 size={12} />Eliminar
                      </button>
                    </div>
                  </div>
                </AppCard>
              )
            })}
          </div>
        </SectionCard>
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
