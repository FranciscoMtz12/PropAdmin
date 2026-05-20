"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Notification, NotificationModule } from '@/lib/notifications'

export type { Notification }

export type ModuleStat = {
  module: NotificationModule
  count: number
  severity: 'critical' | 'warning' | 'brand' | 'info'
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
        building_id: buildingId === 'unknown' ? null : buildingId,
        count,
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
        building_id: buildingId === 'unknown' ? null : buildingId,
        count,
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
        building_id: buildingId === 'unknown' ? null : buildingId,
        count,
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
        building_id: buildingId === 'unknown' ? null : buildingId,
        count,
      })
    }
  }

  // ─── Batch 2: Compras, Cobranza records, Mantenimiento ───────────────────
  const b2TodayStr       = now.toISOString().split('T')[0]
  const b2FiveDaysLater    = new Date(now.getTime() + 5  * 86400000).toISOString().split('T')[0]
  const b2FifteenDaysLater = new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0]
  const oneDayAgo        = new Date(now.getTime() - 86400000).toISOString()
  const oneHourAgo       = new Date(now.getTime() -  3600000).toISOString()

  const [
    { data: rawOverdueOCs },
    { data: rawPartialOCs },
    { data: rawCampoOCs },
    { data: rawOverdueRecords },
    { data: rawDueSoonRecords },
    { data: rawUrgentTickets },
    { data: rawNewTickets },
    { data: rawPreventiveTickets },
    { data: rawActiveSharedMeters },
  ] = await Promise.all([
    supabase.from('purchase_orders').select('id').eq('company_id', companyId).eq('status', 'pending').lt('created_at', oneDayAgo).is('deleted_at', null),
    supabase.from('purchase_orders').select('id').eq('company_id', companyId).eq('status', 'partial').is('deleted_at', null),
    supabase.from('purchase_orders').select('id').eq('company_id', companyId).or('version_type.not.is.null,parent_order_id.not.is.null').gte('created_at', oneHourAgo).is('deleted_at', null),
    supabase.from('collection_records').select('id').eq('company_id', companyId).eq('status', 'overdue').is('deleted_at', null),
    supabase.from('collection_records').select('id').eq('company_id', companyId).eq('status', 'pending').gte('due_date', b2TodayStr).lte('due_date', b2FiveDaysLater).is('deleted_at', null),
    supabase.from('maintenance_logs').select('id').eq('company_id', companyId).eq('priority', 'urgent').neq('status', 'resolved').is('deleted_at', null),
    supabase.from('maintenance_logs').select('id').eq('company_id', companyId).eq('status', 'open').gte('created_at', oneDayAgo).is('deleted_at', null),
    supabase.from('maintenance_logs').select('id').eq('company_id', companyId).eq('log_type', 'preventive').not('next_due_at', 'is', null).gte('next_due_at', b2TodayStr).lte('next_due_at', b2FifteenDaysLater).is('deleted_at', null),
    supabase.from('building_utility_meters').select('id').eq('company_id', companyId).eq('active', true).eq('meter_type', 'shared').is('deleted_at', null),
  ])

  // Utility readings check for cobranza
  let missingReadingsCount = 0
  const sharedMeterIds = (rawActiveSharedMeters ?? []).map((m: { id: string }) => m.id)
  if (sharedMeterIds.length > 0) {
    const { data: rawSubMeters } = await supabase
      .from('building_utility_sub_meters').select('id')
      .in('building_utility_meter_id', sharedMeterIds).is('deleted_at', null)
    const smIds = (rawSubMeters ?? []).map((sm: { id: string }) => sm.id)
    if (smIds.length > 0) {
      const { data: rawCurrentReadings } = await supabase
        .from('building_utility_readings').select('building_utility_sub_meter_id')
        .in('building_utility_sub_meter_id', smIds)
        .eq('period_year', now.getFullYear()).eq('period_month', now.getMonth() + 1)
        .is('deleted_at', null)
      const readSet = new Set((rawCurrentReadings ?? []).map((r: { building_utility_sub_meter_id: string }) => r.building_utility_sub_meter_id))
      missingReadingsCount = smIds.filter((id: string) => !readSet.has(id)).length
    }
  }

  // ── Compras ──
  const overdueOCCount = rawOverdueOCs?.length ?? 0
  if (overdueOCCount > 0) {
    notifs.push({ id: 'compras-overdue', module: 'compras', severity: 'critical', title: `${overdueOCCount} orden${overdueOCCount !== 1 ? 'es' : ''} sin atender`, description: 'Pendiente >1 día sin aprobación', action_route: '/purchases', is_resolved: false, count: overdueOCCount })
  }
  const partialOCCount = rawPartialOCs?.length ?? 0
  if (partialOCCount > 0) {
    notifs.push({ id: 'compras-partial', module: 'compras', severity: 'warning', title: `${partialOCCount} orden${partialOCCount !== 1 ? 'es' : ''} surtidas parcialmente`, description: 'Requieren seguimiento', action_route: '/purchases', is_resolved: false, count: partialOCCount })
  }
  const campoOCCount = rawCampoOCs?.length ?? 0
  if (campoOCCount > 0) {
    notifs.push({ id: 'compras-campo', module: 'compras', severity: 'brand', title: `${campoOCCount} orden${campoOCCount !== 1 ? 'es' : ''} nuevas de campo`, description: 'Sin revisar', action_route: '/purchases', is_resolved: false, count: campoOCCount })
  }

  // ── Cobranza records ──
  const overdueRecordCount = rawOverdueRecords?.length ?? 0
  if (overdueRecordCount > 0) {
    notifs.push({ id: 'cobranza-overdue', module: 'cobranza', severity: 'critical', title: `${overdueRecordCount} cobro${overdueRecordCount !== 1 ? 's' : ''} vencido${overdueRecordCount !== 1 ? 's' : ''}`, description: 'Requieren atención inmediata', action_route: '/collections', is_resolved: false, count: overdueRecordCount })
  }
  const dueSoonCount = rawDueSoonRecords?.length ?? 0
  if (dueSoonCount > 0) {
    notifs.push({ id: 'cobranza-due-soon', module: 'cobranza', severity: 'warning', title: `${dueSoonCount} cobro${dueSoonCount !== 1 ? 's' : ''} vence${dueSoonCount !== 1 ? 'n' : ''} pronto`, description: 'Próximos 5 días', action_route: '/collections', is_resolved: false, count: dueSoonCount })
  }
  if (missingReadingsCount > 0) {
    notifs.push({ id: 'cobranza-lecturas', module: 'cobranza', severity: 'warning', title: `${missingReadingsCount} lectura${missingReadingsCount !== 1 ? 's' : ''} sin capturar`, description: 'Medidores del mes actual', action_route: '/servicios', is_resolved: false, count: missingReadingsCount })
  }

  // ── Mantenimiento ──
  const urgentCount = rawUrgentTickets?.length ?? 0
  if (urgentCount > 0) {
    notifs.push({ id: 'mantenimiento-urgent', module: 'mantenimiento', severity: 'critical', title: `${urgentCount} ticket${urgentCount !== 1 ? 's' : ''} urgente${urgentCount !== 1 ? 's' : ''} sin resolver`, description: 'Requieren atención inmediata', action_route: '/maintenance', is_resolved: false, count: urgentCount })
  }
  const newTicketCount = rawNewTickets?.length ?? 0
  if (newTicketCount > 0) {
    notifs.push({ id: 'mantenimiento-new', module: 'mantenimiento', severity: 'brand', title: `${newTicketCount} ticket${newTicketCount !== 1 ? 's' : ''} nuevo${newTicketCount !== 1 ? 's' : ''} sin revisar`, description: 'Últimas 24 horas', action_route: '/maintenance', is_resolved: false, count: newTicketCount })
  }
  const preventiveCount = rawPreventiveTickets?.length ?? 0
  if (preventiveCount > 0) {
    notifs.push({ id: 'mantenimiento-preventive', module: 'mantenimiento', severity: 'warning', title: `${preventiveCount} mantenimiento${preventiveCount !== 1 ? 's' : ''} preventivo${preventiveCount !== 1 ? 's' : ''} próximo${preventiveCount !== 1 ? 's' : ''}`, description: 'Próximos 15 días', action_route: '/maintenance', is_resolved: false, count: preventiveCount })
  }

  // ─── Batch 3: Pagos + Configuración ─────────────────────────────
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  const [{ data: rawInvoicedOCs }, { data: rawPRIds }, { data: rawCompany }] = await Promise.all([
    supabase.from('purchase_orders').select('id, sent_at').eq('company_id', companyId).eq('status', 'invoiced').is('deleted_at', null),
    supabase.from('payment_reports').select('id').eq('company_id', companyId).is('deleted_at', null),
    supabase.from('companies').select('logo_url, tax_id, legal_name, admin_contact_email, purchases_contact_email, brand_color').eq('id', companyId).single(),
  ])

  // Subtract OCs already included in a payment report
  let claimedOCIds = new Set<string>()
  const prIds = (rawPRIds ?? []).map((r: { id: string }) => r.id)
  if (prIds.length > 0) {
    const { data: rawPRItems } = await supabase
      .from('payment_report_items').select('purchase_order_id').in('payment_report_id', prIds)
    claimedOCIds = new Set((rawPRItems ?? []).map((i: { purchase_order_id: string }) => i.purchase_order_id))
  }

  type InvoicedOC = { id: string; sent_at: string | null }
  const unreportedOCs = (rawInvoicedOCs ?? [] as InvoicedOC[]).filter((o: InvoicedOC) => !claimedOCIds.has(o.id))
  const overdueUnreportedCount = unreportedOCs.filter((o: InvoicedOC) => o.sent_at && new Date(o.sent_at) < sevenDaysAgo).length
  const pendingUnreportedCount = unreportedOCs.filter((o: InvoicedOC) => !o.sent_at || new Date(o.sent_at) >= sevenDaysAgo).length

  if (overdueUnreportedCount > 0) {
    notifs.push({ id: 'pagos-overdue', module: 'pagos', severity: 'critical', title: `${overdueUnreportedCount} OC${overdueUnreportedCount !== 1 ? 's' : ''} facturada${overdueUnreportedCount !== 1 ? 's' : ''} sin reportar`, description: 'Más de 7 días sin incluir en reporte a pagos', action_route: '/purchases/reporte-pagos', is_resolved: false, count: overdueUnreportedCount })
  }
  if (pendingUnreportedCount > 0) {
    notifs.push({ id: 'pagos-pending', module: 'pagos', severity: 'warning', title: `${pendingUnreportedCount} OC${pendingUnreportedCount !== 1 ? 's' : ''} facturada${pendingUnreportedCount !== 1 ? 's' : ''} pendiente${pendingUnreportedCount !== 1 ? 's' : ''}`, description: 'Listas para incluir en reporte a pagos', action_route: '/purchases/reporte-pagos', is_resolved: false, count: pendingUnreportedCount })
  }

  // ── Configuración — onboarding pendiente ──
  type CompanyCheck = { logo_url: string | null; tax_id: string | null; legal_name: string | null; admin_contact_email: string | null; purchases_contact_email: string | null; brand_color: string | null }
  const co = rawCompany as CompanyCheck | null
  if (co) {
    const pendingConfigs = [
      !co.logo_url,
      !co.tax_id || !co.legal_name,
      !co.admin_contact_email,
      !co.purchases_contact_email,
      !co.brand_color || co.brand_color === '#8B2252',
    ].filter(Boolean).length
    if (pendingConfigs > 0) {
      notifs.push({ id: 'configuracion-onboarding', module: 'configuracion', severity: 'brand', title: `${pendingConfigs} campo${pendingConfigs !== 1 ? 's' : ''} de configuración pendiente${pendingConfigs !== 1 ? 's' : ''}`, description: 'Completa el perfil de tu empresa', action_route: '/settings', is_resolved: false, count: pendingConfigs })
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
    const interval = setInterval(() => { void refetch() }, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const byModule = notifications.reduce<Record<string, Notification[]>>((acc, notif) => {
    if (!acc[notif.module]) acc[notif.module] = []
    acc[notif.module].push(notif)
    return acc
  }, {})

  const moduleStats: ModuleStat[] = Object.entries(byModule).map(([module, notifs]) => ({
    module: module as NotificationModule,
    count: notifs.reduce((sum, n) => sum + (n.count ?? 1), 0),
    severity: notifs.some(n => n.severity === 'critical') ? 'critical'
            : notifs.some(n => n.severity === 'warning')  ? 'warning'
            : notifs.some(n => n.severity === 'brand')    ? 'brand'
            : 'info',
  }))

  return { notifications, byModule, moduleStats, loading, refetch }
}
