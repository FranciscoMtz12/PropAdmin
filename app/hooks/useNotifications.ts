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

async function calculateNotifications(companyId: string): Promise<Notification[]> {
  const notifs: Notification[] = []
  const now = new Date()

  // 1. Unidades pendientes de revisión
  const { data: unitsNeedingReview } = await supabase
    .from('units')
    .select('id')
    .eq('company_id', companyId)
    .eq('needs_review', true)
    .is('deleted_at', null)

  if (unitsNeedingReview && unitsNeedingReview.length > 0) {
    const n = unitsNeedingReview.length
    notifs.push({
      id: 'units-review',
      module: 'unidades',
      severity: 'warning',
      title: `${n} unidad${n > 1 ? 'es' : ''} pendiente${n > 1 ? 's' : ''} de revisión`,
      description: 'Unidades duplicadas que requieren verificación de datos.',
      action_route: null,
      is_resolved: false,
    })
  }

  // 2. Contratos por vencer (menos de 30 días)
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const todayStr = now.toISOString().split('T')[0]
  const thirtyStr = thirtyDaysFromNow.toISOString().split('T')[0]

  const [{ data: expiringLeases }, { data: expiredLeases }, { data: placeholderMeters }] =
    await Promise.all([
      supabase
        .from('leases')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .not('end_date', 'is', null)
        .lte('end_date', thirtyStr)
        .gte('end_date', todayStr)
        .is('deleted_at', null),

      supabase
        .from('leases')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .not('end_date', 'is', null)
        .lt('end_date', todayStr)
        .is('deleted_at', null),

      supabase
        .from('building_utility_meters')
        .select('id')
        .eq('company_id', companyId)
        .eq('active', false)
        .is('deleted_at', null),
    ])

  if (expiringLeases && expiringLeases.length > 0) {
    const n = expiringLeases.length
    notifs.push({
      id: 'leases-expiring',
      module: 'contratos',
      severity: 'warning',
      title: `${n} contrato${n > 1 ? 's' : ''} por vencer`,
      description: 'Contratos que vencen en menos de 30 días.',
      action_route: '/collections',
      is_resolved: false,
    })
  }

  if (expiredLeases && expiredLeases.length > 0) {
    const n = expiredLeases.length
    notifs.push({
      id: 'leases-expired',
      module: 'contratos',
      severity: 'critical',
      title: `${n} contrato${n > 1 ? 's' : ''} vencido${n > 1 ? 's' : ''}`,
      description: 'Contratos vencidos sin renovar.',
      action_route: '/collections',
      is_resolved: false,
    })
  }

  if (placeholderMeters && placeholderMeters.length > 0) {
    const n = placeholderMeters.length
    notifs.push({
      id: 'meters-placeholder',
      module: 'servicios',
      severity: 'critical',
      title: `${n} servicio${n > 1 ? 's' : ''} sin configurar`,
      description: 'Servicios activos sin medidor configurado.',
      action_route: null,
      is_resolved: false,
    })
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
