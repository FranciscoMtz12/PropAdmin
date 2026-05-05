"use client"
import { useEffect, useState } from "react"
import {
  AlertTriangle, Building2, Droplets, Flame, Info,
  Plus, Settings, Settings2, Trash2, User, Wifi, Zap,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import SectionCard from "@/components/SectionCard"
import AppCard from "@/components/AppCard"
import AppBadge from "@/components/AppBadge"
import AppEmptyState from "@/components/AppEmptyState"
import UiButton from "@/components/UiButton"
import DeleteConfirmModal from "@/components/DeleteConfirmModal"
import BuildingUtilityMeterModal from "@/components/BuildingUtilityMeterModal"
import BuildingUtilitySubMetersModal from "@/components/BuildingUtilitySubMetersModal"
import CFEMeterModal from "@/components/CFEMeterModal"
import InternalMetersModal from "@/components/InternalMetersModal"
import { sortByNatural } from "@/lib/sort-utils"
import type { BuildingUtilityMeter, BuildingUtilitySubMeter, UtilityServiceType } from "@/lib/types"
import { SERVICE_TYPE_LABEL, BILLING_FREQUENCY_LABEL, meterGeneratesCharge } from "@/lib/types"

type Props = {
  buildingId: string
  companyId: string
  buildingName: string
  units: { id: string; unit_number: string; display_code: string | null }[]
}

type CFEMeterRow = {
  id: string
  meter_number: string
  rpu: string | null
  description: string | null
  tariff_type: string | null
  service_type: "dedicated" | "shared"
  assigned_unit_id: string | null
  notes: string | null
  created_at: string
}

type InternalMeterRow = {
  id: string
  cfe_meter_id: string
  unit_id: string
  internal_number: string | null
  baseline_reading: number
  active: boolean
  unit_number?: string
}

const SERVICE_TYPE_ORDER: UtilityServiceType[] = ["electricity", "gas", "water", "internet", "other"]

// Maps service_type → concept_code in building_billing_concepts
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

export default function BuildingServicesTab({ buildingId, companyId, buildingName, units }: Props) {
  // ── Generic utility meters ──────────────────────────────────────────
  const [meters, setMeters]             = useState<BuildingUtilityMeter[]>([])
  const [subMetersMap, setSubMetersMap] = useState<Record<string, BuildingUtilitySubMeter[]>>({})
  const [loading, setLoading]           = useState(true)

  const [meterModalOpen, setMeterModalOpen]   = useState(false)
  const [editingMeter, setEditingMeter]       = useState<BuildingUtilityMeter | null>(null)
  const [subMetersModalFor, setSubMetersModalFor] = useState<BuildingUtilityMeter | null>(null)
  const [deletingMeter, setDeletingMeter]     = useState<BuildingUtilityMeter | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // ── CFE meters (sistema legacy de electricidad) ─────────────────────
  const [cfeMeders, setCfeMeders]                 = useState<CFEMeterRow[]>([])
  const [internalMetersMap, setInternalMetersMap] = useState<Record<string, InternalMeterRow[]>>({})

  const [cfeMeterModalOpen, setCfeMeterModalOpen]   = useState(false)
  const [editingCfeMeter, setEditingCfeMeter]       = useState<CFEMeterRow | null>(null)
  const [internalMetersModalFor, setInternalMetersModalFor] = useState<CFEMeterRow | null>(null)
  const [deletingCfeMeter, setDeletingCfeMeter]     = useState<CFEMeterRow | null>(null)
  const [confirmDeleteCfeMeterOpen, setConfirmDeleteCfeMeterOpen] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────

  async function loadCfeData() {
    const { data: cfeMData } = await supabase
      .from("cfe_meters")
      .select("id, meter_number, rpu, description, tariff_type, service_type, assigned_unit_id, notes, created_at")
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("meter_number")

    const cfeMList = (cfeMData || []) as CFEMeterRow[]
    setCfeMeders(cfeMList)

    const sharedIds = cfeMList.filter((m) => m.service_type === "shared").map((m) => m.id)
    if (sharedIds.length === 0) { setInternalMetersMap({}); return }

    const { data: imData } = await supabase
      .from("internal_meters")
      .select("id, cfe_meter_id, unit_id, internal_number, baseline_reading, active")
      .in("cfe_meter_id", sharedIds)
      .eq("active", true)
      .is("deleted_at", null)

    const imList = (imData || []) as InternalMeterRow[]
    const imMap: Record<string, InternalMeterRow[]> = {}
    imList.forEach((im) => {
      if (!imMap[im.cfe_meter_id]) imMap[im.cfe_meter_id] = []
      imMap[im.cfe_meter_id].push(im)
    })

    const unitIds = [...new Set(imList.map((im) => im.unit_id))]
    if (unitIds.length > 0) {
      const { data: uData } = await supabase
        .from("units")
        .select("id, unit_number")
        .in("id", unitIds)
      const uMap: Record<string, string> = {}
      ;((uData || []) as { id: string; unit_number: string }[]).forEach((u) => { uMap[u.id] = u.unit_number })
      Object.values(imMap).forEach((arr) =>
        arr.forEach((im) => { if (uMap[im.unit_id]) im.unit_number = uMap[im.unit_id] })
      )
    }
    setInternalMetersMap(imMap)
  }

  async function loadUtilityMeters(): Promise<BuildingUtilityMeter[]> {
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

    const ids = loadedMeters.map((m) => m.id)
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
          unit_number: units.find((u) => u.id === sub.unit_id)?.unit_number ?? undefined,
        } as BuildingUtilitySubMeter & { unit_number?: string }
        if (!map[sub.building_utility_meter_id]) map[sub.building_utility_meter_id] = []
        map[sub.building_utility_meter_id].push(enriched)
      }
      for (const meterId of Object.keys(map)) {
        map[meterId] = sortByNatural(
          map[meterId] as (BuildingUtilitySubMeter & { unit_number?: string })[],
          (sm) => (sm as BuildingUtilitySubMeter & { unit_number?: string }).unit_number ?? sm.unit_id,
        )
      }
    }
    setSubMetersMap(map)
    return loadedMeters
  }

  async function loadData(): Promise<BuildingUtilityMeter[]> {
    setLoading(true)
    let fresh: BuildingUtilityMeter[] = []
    try {
      ;[fresh] = await Promise.all([loadUtilityMeters(), loadCfeData()])
    } finally {
      setLoading(false)
    }
    return fresh
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId])

  // ── Billing concepts sync ───────────────────────────────────────────

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
        const hasCharge = currentMeters.some(
          (m) => m.service_type === serviceType && meterGeneratesCharge(m),
        )
        return syncBillingConcept(code, hasCharge)
      }),
    )
  }

  // ── Handlers ───────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deletingMeter) return
    await supabase
      .from("building_utility_meters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deletingMeter.id)
    setConfirmDeleteOpen(false)
    setDeletingMeter(null)
    const fresh = await loadData()
    await syncAllConcepts(fresh)
  }

  async function handleDeleteCfeMeter() {
    if (!deletingCfeMeter) return
    await supabase
      .from("cfe_meters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deletingCfeMeter.id)
    setConfirmDeleteCfeMeterOpen(false)
    setDeletingCfeMeter(null)
    await loadCfeData()
  }

  // ── Derived ────────────────────────────────────────────────────────

  const groups = SERVICE_TYPE_ORDER
    .map((type) => ({ type, meters: meters.filter((m) => m.service_type === type) }))
    .filter((g) => g.meters.length > 0)

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Servicios del edificio</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Medidores CFE, gas, agua, internet y otros servicios del inmueble.
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

      {/* ── Sección CFE (medidores oficiales de electricidad) ── */}
      <SectionCard
        title="Electricidad"
        subtitle="Medidores CFE"
        icon={<Zap size={16} />}
        action={
          <UiButton
            variant="secondary"
            icon={<Plus size={14} />}
            onClick={() => { setEditingCfeMeter(null); setCfeMeterModalOpen(true) }}
          >
            Agregar medidor CFE
          </UiButton>
        }
      >
        {cfeMeders.length === 0 ? (
          <AppEmptyState
            title="Sin medidores CFE registrados"
            description="Registra los medidores CFE oficiales del edificio."
            actionLabel="+ Agregar medidor CFE"
            onAction={() => { setEditingCfeMeter(null); setCfeMeterModalOpen(true) }}
          />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {sortByNatural(cfeMeders, (m) => m.meter_number).map((meter) => {
              const submeters = sortByNatural(
                internalMetersMap[meter.id] || [],
                (sm) => sm.unit_number ?? "",
              )
              const isDedicated  = meter.service_type === "dedicated"
              const assignedUnit = isDedicated ? units.find((u) => u.id === meter.assigned_unit_id) : null

              return (
                <AppCard key={meter.id} style={{ padding: 16, borderRadius: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                        <strong style={{ fontSize: 15, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Zap size={14} />Medidor {meter.meter_number}
                        </strong>
                        {isDedicated
                          ? <AppBadge variant="gray">Dedicado</AppBadge>
                          : <AppBadge variant="blue">Compartido</AppBadge>}
                      </div>

                      {(meter.description || meter.tariff_type) && (
                        <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)" }}>
                          {[meter.description, meter.tariff_type ? `Tarifa: ${meter.tariff_type}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {meter.rpu && (
                        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>RPU: {meter.rpu}</p>
                      )}

                      {isDedicated ? (
                        <div style={{ fontSize: 13 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Sirve a: </span>
                          <strong>{assignedUnit ? `Depa ${assignedUnit.unit_number}` : "Sin unidad"}</strong>
                          <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}>
                            El inquilino paga directamente a CFE
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Submedidores internos: </span>
                          <strong>{submeters.length}</strong>
                          {submeters.length > 0 ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                              {submeters.map((sm) => (
                                <span
                                  key={sm.id}
                                  style={{ padding: "2px 8px", background: "var(--bg-page)", border: "1px solid var(--border-default)", borderRadius: 999, fontSize: 12 }}
                                >
                                  Depa {sm.unit_number ?? sm.unit_id.slice(0, 6)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: 6, padding: "8px 12px", background: "#fef3c7", borderRadius: 10, fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                              <AlertTriangle size={12} />Falta configurar submedidores
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setInternalMetersModalFor(meter)}
                            style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}
                          >
                            <Settings2 size={13} />Configurar submedidores
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => { setEditingCfeMeter(meter); setCfeMeterModalOpen(true) }}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeletingCfeMeter(meter); setConfirmDeleteCfeMeterOpen(true) }}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #dc2626", background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#dc2626", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Trash2 size={12} />Eliminar
                      </button>
                    </div>
                  </div>
                </AppCard>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Otros servicios (building_utility_meters) ── */}
      {!loading && meters.length === 0 && (
        <AppEmptyState
          title="Sin otros servicios configurados"
          description="Registra gas, agua, internet y otros servicios del edificio."
          actionLabel="+ Agregar servicio"
          onAction={() => { setEditingMeter(null); setMeterModalOpen(true) }}
        />
      )}

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

                      {/* Badges */}
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
                          <AppBadge variant="gray">
                            {BILLING_FREQUENCY_LABEL[meter.billing_frequency]}
                          </AppBadge>
                        )}
                      </div>

                      {/* Shared sub-meters */}
                      {meter.meter_type === "shared" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          {meter.billing_mode === "included" ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-page)", color: "var(--text-secondary)", borderRadius: 10, padding: "6px 10px", fontSize: 12, alignSelf: "flex-start", border: "1px solid var(--border-default)" }}>
                              <Info size={12} />
                              Gasto del edificio — sin cobro al inquilino
                            </div>
                          ) : (
                            <>
                              {subs.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {subs.map((sm) => (
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
                                <Settings size={12} />Configurar submedidores
                              </button>
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

      {/* ── Modals: generic utility meters ── */}
      {meterModalOpen && (
        <BuildingUtilityMeterModal
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
      )}

      {subMetersModalFor && (
        <BuildingUtilitySubMetersModal
          meter={subMetersModalFor}
          existingSubMeters={subMetersMap[subMetersModalFor.id] ?? []}
          units={units}
          onClose={() => setSubMetersModalFor(null)}
          onSuccess={() => { setSubMetersModalFor(null); void loadData() }}
        />
      )}

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

      {/* ── Modals: CFE meters ── */}
      {cfeMeterModalOpen && (
        <CFEMeterModal
          buildingId={buildingId}
          companyId={companyId}
          units={units}
          existingCfeMeters={cfeMeders}
          meter={editingCfeMeter}
          onClose={() => setCfeMeterModalOpen(false)}
          onSuccess={() => { setCfeMeterModalOpen(false); void loadCfeData() }}
        />
      )}

      {internalMetersModalFor && (
        <InternalMetersModal
          cfeMeter={internalMetersModalFor}
          building={{ id: buildingId, name: buildingName }}
          companyId={companyId}
          units={units}
          existingInternalMeters={internalMetersMap[internalMetersModalFor.id] || []}
          onClose={() => setInternalMetersModalFor(null)}
          onSuccess={() => { setInternalMetersModalFor(null); void loadCfeData() }}
        />
      )}

      <DeleteConfirmModal
        open={confirmDeleteCfeMeterOpen}
        title="Eliminar medidor CFE"
        description={
          deletingCfeMeter
            ? `¿Eliminar el medidor ${deletingCfeMeter.meter_number}? Se ocultará del sistema.`
            : ""
        }
        confirmText="Eliminar medidor"
        onConfirm={() => void handleDeleteCfeMeter()}
        onCancel={() => { setConfirmDeleteCfeMeterOpen(false); setDeletingCfeMeter(null) }}
      />
    </div>
  )
}
