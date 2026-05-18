"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Notification, NotificationModule } from '@/lib/notifications'

export type { Notification }

export type ModuleStat = {
  module: NotificationModule
  count: number
  severity: 'critical' | 'warning' | 'info'
}

type RowWithBuilding = { building_id: string | null; buildings: { name: string } | null }
type LeaseRow = { id: string; unit_id: string | null; units: { building_id: string | null; buildings: { name: string } | null } | null }

function groupByBuilding(rows: RowWithBuilding[]): Map<string, { name: string; count: number }> {
  const map = new Map<string, { name: string; count: number }>()
  for (const row of rows) {
    const bid = row.building_id ?? 'unknown'
    const bname = row.buildings?.name ?? 'Edificio'
    const entry = map.get(bid)
    if (entry) entry.count++
    else map.set(bid, { name: bname, count: 1 })
  }
  return map
}

function leasesToBuildingRows(leases: LeaseRow[]): RowWithBuilding[] {
  return leases.map(l => ({
    building_id: l.units?.building_id ?? null,
    buildings:   l.units?.buildings   ?? null,
  }))
}

async function calculateNotifications(companyId: string): Promise<Notification[]> {
  const notifs: Notification[] = []
  const now = new Date()

  // 1. Unidades pendientes de revisión — una notificación por edificio
  const { data: rawUnits } = await supabase
    .from('units')
    .select('id, building_id, buildings(name)')
    .eq('company_id', companyId)
    .eq('needs_review', true)
    .is('deleted_at', null)

  if (rawUnits && rawUnits.length > 0) {
    const byBuilding = groupByBuilding(rawUnits as unknown as RowWithBuilding[])
    for (const [buildingId, { name, count }] of byBuilding.entries()) {
      notifs.push({
        id: `units-review-${buildingId}`,
        module: 'unidades',
        severity: 'warning',
        title: `${count} unidad${count > 1 ? 'es' : ''} pendiente${count > 1 ? 's' : ''} de revisión`,
        description: name,
        action_route: null,
        is_resolved: false,
      })
    }
  }

  // 2. Contratos por vencer y vencidos — una notificación por edificio
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const todayStr = now.toISOString().split('T')[0]
  const thirtyStr = thirtyDaysFromNow.toISOString().split('T')[0]

  const [{ data: rawExpiring }, { data: rawExpired }, { data: rawMeters }] =
    await Promise.all([
      supabase
        .from('leases')
        .select('id, unit_id, units(building_id, buildings(name))')
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .not('end_date', 'is', null)
        .lte('end_date', thirtyStr)
        .gte('end_date', todayStr)
        .is('deleted_at', null),

      supabase
        .from('leases')
        .select('id, unit_id, units(building_id, buildings(name))')
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .not('end_date', 'is', null)
        .lt('end_date', todayStr)
        .is('deleted_at', null),

      supabase
        .from('building_utility_meters')
        .select('id, building_id, buildings(name)')
        .eq('company_id', companyId)
        .eq('active', false)
        .is('deleted_at', null),
    ])

  if (rawExpiring && rawExpiring.length > 0) {
    const byBuilding = groupByBuilding(leasesToBuildingRows(rawExpiring as unknown as LeaseRow[]))
    for (const [buildingId, { name, count }] of byBuilding.entries()) {
      notifs.push({
        id: `leases-expiring-${buildingId}`,
        module: 'contratos',
        severity: 'warning',
        title: `${count} contrato${count > 1 ? 's' : ''} por vencer`,
        description: name,
        action_route: '/collections',
        is_resolved: false,
      })
    }
  }

  if (rawExpired && rawExpired.length > 0) {
    const byBuilding = groupByBuilding(leasesToBuildingRows(rawExpired as unknown as LeaseRow[]))
    for (const [buildingId, { name, count }] of byBuilding.entries()) {
      notifs.push({
        id: `leases-expired-${buildingId}`,
        module: 'contratos',
        severity: 'critical',
        title: `${count} contrato${count > 1 ? 's' : ''} vencido${count > 1 ? 's' : ''}`,
        description: name,
        action_route: '/collections',
        is_resolved: false,
      })
    }
  }

  if (rawMeters && rawMeters.length > 0) {
    const byBuilding = groupByBuilding(rawMeters as unknown as RowWithBuilding[])
    for (const [buildingId, { name, count }] of byBuilding.entries()) {
      notifs.push({
        id: `meters-placeholder-${buildingId}`,
        module: 'servicios',
        severity: 'critical',
        title: `${count} servicio${count > 1 ? 's' : ''} sin configurar`,
        description: name,
        action_route: null,
        is_resolved: false,
      })
    }
  }

  return notifs
}

export function useNotifications(companyId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = async () => {
    if (!companyId) return
    setLoading(true)
    const notifs = await calculateNotifications(companyId)
    setNotifications(notifs)
    setLoading(false)
  }

  useEffect(() => {
    if (!companyId) return
    void refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const byModule = notifications.reduce<Record<string, Notification[]>>((acc, notif) => {
    if (!acc[notif.module]) acc[notif.module] = []
    acc[notif.module].push(notif)
    return acc
  }, {})

  const moduleStats: ModuleStat[] = Object.entries(byModule).map(([module, notifs]) => ({
    module: module as NotificationModule,
    count: notifs.length,
    severity: notifs.some(n => n.severity === 'critical') ? 'critical'
            : notifs.some(n => n.severity === 'warning')  ? 'warning'
            : 'info',
  }))

  return { notifications, byModule, moduleStats, loading, refetch }
}
