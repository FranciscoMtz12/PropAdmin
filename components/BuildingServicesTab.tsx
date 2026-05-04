"use client"
import { useEffect, useState } from "react"
import { AlertTriangle, Droplets, Flame, Info, Plus, Settings, Trash2, Wifi, Zap } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import SectionCard from "@/components/SectionCard"
import AppCard from "@/components/AppCard"
import AppBadge from "@/components/AppBadge"
import AppEmptyState from "@/components/AppEmptyState"
import UiButton from "@/components/UiButton"
import DeleteConfirmModal from "@/components/DeleteConfirmModal"
import BuildingUtilityMeterModal from "@/components/BuildingUtilityMeterModal"
import BuildingUtilitySubMetersModal from "@/components/BuildingUtilitySubMetersModal"
import { sortByNatural } from "@/lib/sort-utils"
import type { BuildingUtilityMeter, BuildingUtilitySubMeter, UtilityServiceType } from "@/lib/types"
import { SERVICE_TYPE_LABEL } from "@/lib/types"

type Props = {
  buildingId: string
  companyId: string
  units: { id: string; unit_number: string; display_code: string | null }[]
}

const SERVICE_TYPE_ORDER: UtilityServiceType[] = [
  "electricity",
  "gas",
  "water",
  "internet",
  "other",
]

function ServiceIcon({ type, size = 16 }: { type: UtilityServiceType; size?: number }) {
  switch (type) {
    case "electricity": return <Zap size={size} />
    case "gas":         return <Flame size={size} />
    case "water":       return <Droplets size={size} />
    case "internet":    return <Wifi size={size} />
    default:            return <Settings size={size} />
  }
}

export default function BuildingServicesTab({ buildingId, companyId, units }: Props) {
  const [meters, setMeters] = useState<BuildingUtilityMeter[]>([])
  const [subMetersMap, setSubMetersMap] = useState<Record<string, BuildingUtilitySubMeter[]>>({})
  const [loading, setLoading] = useState(true)
  const [meterModalOpen, setMeterModalOpen] = useState(false)
  const [editingMeter, setEditingMeter] = useState<BuildingUtilityMeter | null>(null)
  const [subMetersModalFor, setSubMetersModalFor] = useState<BuildingUtilityMeter | null>(null)
  const [deletingMeter, setDeletingMeter] = useState<BuildingUtilityMeter | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  async function loadData() {
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

      const loadedMeters: BuildingUtilityMeter[] = metersData ?? []
      setMeters(loadedMeters)

      const ids = loadedMeters.map((m) => m.id)
      const map: Record<string, BuildingUtilitySubMeter[]> = {}

      if (ids.length > 0) {
        const { data: subData } = await supabase
          .from("building_utility_sub_meters")
          .select("*")
          .in("building_utility_meter_id", ids)
          .eq("active", true)
          .is("deleted_at", null)

        const subs: BuildingUtilitySubMeter[] = subData ?? []

        for (const sub of subs) {
          const enriched = {
            ...sub,
            unit_number:
              units.find((u) => u.id === sub.unit_id)?.unit_number ?? undefined,
          } as BuildingUtilitySubMeter & { unit_number?: string }

          if (!map[sub.building_utility_meter_id]) {
            map[sub.building_utility_meter_id] = []
          }
          map[sub.building_utility_meter_id].push(enriched)
        }

        // sort each group naturally by unit_number
        for (const meterId of Object.keys(map)) {
          map[meterId] = sortByNatural(
            map[meterId] as (BuildingUtilitySubMeter & { unit_number?: string })[],
            (sm) => (sm as BuildingUtilitySubMeter & { unit_number?: string }).unit_number ?? sm.unit_id
          )
        }
      }

      setSubMetersMap(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId])

  async function handleDeleteConfirm() {
    if (!deletingMeter) return
    await supabase
      .from("building_utility_meters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deletingMeter.id)
    setConfirmDeleteOpen(false)
    setDeletingMeter(null)
    await loadData()
  }

  // Group meters by service_type in defined order
  const groups = SERVICE_TYPE_ORDER.map((type) => ({
    type,
    meters: meters.filter((m) => m.service_type === type),
  })).filter((g) => g.meters.length > 0)

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Servicios del edificio
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Gas, agua, internet, electricidad y otros servicios con proveedores.
          </p>
        </div>
        <UiButton
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => {
            setEditingMeter(null)
            setMeterModalOpen(true)
          }}
        >
          Agregar servicio
        </UiButton>
      </div>

      {/* Empty state */}
      {!loading && meters.length === 0 && (
        <AppEmptyState
          title="Sin servicios configurados"
          description="Registra los servicios del edificio: gas, agua, internet…"
          actionLabel="+ Agregar primer servicio"
          onAction={() => {
            setEditingMeter(null)
            setMeterModalOpen(true)
          }}
        />
      )}

      {/* Groups */}
      {groups.map((group) => (
        <SectionCard
          key={group.type}
          title={SERVICE_TYPE_LABEL[group.type]}
          icon={<ServiceIcon type={group.type} size={16} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {group.meters.map((meter) => {
              const dedicatedUnit =
                meter.meter_type === "dedicated" && meter.unit_id
                  ? units.find((u) => u.id === meter.unit_id)
                  : null

              const subs =
                (subMetersMap[meter.id] as (BuildingUtilitySubMeter & { unit_number?: string })[] | undefined) ?? []

              return (
                <AppCard key={meter.id} style={{ padding: 16, borderRadius: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Left side */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {/* Provider name */}
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {meter.provider_name ?? "Sin proveedor"}
                      </span>

                      {/* Meter number */}
                      {meter.meter_number && (
                        <span
                          style={{
                            fontFamily: "monospace",
                            padding: "2px 8px",
                            background: "var(--bg-page)",
                            borderRadius: 6,
                            fontSize: 12,
                            border: "1px solid var(--border-default)",
                            alignSelf: "flex-start",
                          }}
                        >
                          {meter.meter_number}
                        </span>
                      )}

                      {/* Badge: Dedicado / Compartido + billing mode */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {meter.meter_type === "dedicated" ? (
                          <AppBadge variant="gray">Dedicado</AppBadge>
                        ) : (
                          <AppBadge variant="blue">Compartido</AppBadge>
                        )}

                        {meter.meter_type === "shared" && (
                          meter.billing_mode === "included"
                            ? <AppBadge variant="gray">Incluido en renta</AppBadge>
                            : <AppBadge variant="blue">Se cobra</AppBadge>
                        )}

                        {/* Dedicated: show unit */}
                        {meter.meter_type === "dedicated" && dedicatedUnit && (
                          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            Depa {dedicatedUnit.unit_number}
                          </span>
                        )}
                      </div>

                      {/* Shared: sub-meters section */}
                      {meter.meter_type === "shared" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          {meter.billing_mode === "included" ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "var(--bg-page)",
                                color: "var(--text-secondary)",
                                borderRadius: 10,
                                padding: "6px 10px",
                                fontSize: 12,
                                alignSelf: "flex-start",
                                border: "1px solid var(--border-default)",
                              }}
                            >
                              <Info size={12} />
                              Gasto del edificio — sin cobro al inquilino
                            </div>
                          ) : (
                            <>
                              {subs.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {subs.map((sm) => (
                                    <span
                                      key={sm.id}
                                      style={{
                                        padding: "2px 8px",
                                        background: "var(--bg-page)",
                                        border: "1px solid var(--border-default)",
                                        borderRadius: 999,
                                        fontSize: 12,
                                      }}
                                    >
                                      Depa {sm.unit_number ?? sm.unit_id.slice(0, 6)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    borderRadius: 10,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    alignSelf: "flex-start",
                                  }}
                                >
                                  <AlertTriangle size={12} />
                                  Sin submedidores configurados
                                </div>
                              )}

                              {/* Configure sub-meters button */}
                              <button
                                onClick={() => setSubMetersModalFor(meter)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                  padding: "5px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--border-default)",
                                  background: "var(--bg-card)",
                                  cursor: "pointer",
                                  alignSelf: "flex-start",
                                }}
                              >
                                <Settings size={12} />
                                Configurar submedidores
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right side: action buttons */}
                    <div style={{ flexShrink: 0, display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          setEditingMeter(meter)
                          setMeterModalOpen(true)
                        }}
                        style={{
                          fontSize: 12,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-card)",
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          setDeletingMeter(meter)
                          setConfirmDeleteOpen(true)
                        }}
                        style={{
                          fontSize: 12,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #dc2626",
                          background: "transparent",
                          color: "#dc2626",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Trash2 size={12} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </AppCard>
              )
            })}
          </div>
        </SectionCard>
      ))}

      {/* Meter create/edit modal */}
      {meterModalOpen && (
        <BuildingUtilityMeterModal
          buildingId={buildingId}
          companyId={companyId}
          units={units}
          existingMeter={editingMeter}
          onClose={() => {
            setMeterModalOpen(false)
            setEditingMeter(null)
          }}
          onSuccess={() => {
            setMeterModalOpen(false)
            setEditingMeter(null)
            void loadData()
          }}
        />
      )}

      {/* Sub-meters modal */}
      {subMetersModalFor && (
        <BuildingUtilitySubMetersModal
          meter={subMetersModalFor}
          existingSubMeters={subMetersMap[subMetersModalFor.id] ?? []}
          units={units}
          onClose={() => setSubMetersModalFor(null)}
          onSuccess={() => {
            setSubMetersModalFor(null)
            void loadData()
          }}
        />
      )}

      {/* Delete confirm modal */}
      <DeleteConfirmModal
        open={confirmDeleteOpen}
        title="Eliminar servicio"
        description={deletingMeter ? `¿Eliminar el servicio de ${SERVICE_TYPE_LABEL[deletingMeter.service_type]}? Se ocultará del sistema.` : ""}
        confirmText="Eliminar servicio"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          setConfirmDeleteOpen(false)
          setDeletingMeter(null)
        }}
      />
    </div>
  )
}
