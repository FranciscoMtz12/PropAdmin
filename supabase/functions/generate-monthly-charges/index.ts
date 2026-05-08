import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VARIABLE_CHARGE_TYPES = ['electricity', 'water', 'gas', 'services']

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .is('deleted_at', null)

  if (!companies?.length) {
    return new Response(JSON.stringify({ ok: true, month, year, companies: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results: Record<string, number> = {}

  for (const company of companies) {
    const companyId = company.id as string

    // PASO 1: Leases activos
    const { data: leases } = await supabase
      .from('leases')
      .select('id, rent_amount, due_day, includes_parking, parking_fee, unit_id')
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)

    if (!leases?.length) {
      results[companyId] = 0
      continue
    }

    const unitIds = leases.map((l) => l.unit_id as string).filter(Boolean)

    // PASO 2: Unidades (para building_id)
    const { data: units } = await supabase
      .from('units')
      .select('id, building_id, unit_number')
      .in('id', unitIds)

    const unitMap = Object.fromEntries((units ?? []).map((u) => [u.id, u]))

    // PASO 3: Schedules activos existentes
    const { data: existingSchedules } = await supabase
      .from('collection_schedules')
      .select('id, lease_id, charge_type, amount_expected, due_day, unit_id, building_id')
      .eq('company_id', companyId)
      .eq('active', true)
      .is('deleted_at', null)
      .in('unit_id', unitIds)

    // PASO 4: Crear schedules de renta/parking faltantes
    const schedulesToCreate = []
    for (const lease of leases) {
      const unit = unitMap[lease.unit_id]
      if (!unit) continue

      const hasRent = existingSchedules?.some(
        (s) => s.lease_id === lease.id && s.charge_type === 'rent'
      )
      if (!hasRent) {
        schedulesToCreate.push({
          company_id: companyId,
          building_id: unit.building_id,
          unit_id: lease.unit_id,
          lease_id: lease.id,
          charge_type: 'rent',
          title: 'Renta',
          responsibility_type: 'tenant',
          amount_expected: lease.rent_amount,
          due_day: lease.due_day || 15,
          active: true,
          billing_frequency: 'monthly',
        })
      }

      if (lease.includes_parking && (lease.parking_fee ?? 0) > 0) {
        const hasParking = existingSchedules?.some(
          (s) => s.lease_id === lease.id && s.charge_type === 'parking'
        )
        if (!hasParking) {
          schedulesToCreate.push({
            company_id: companyId,
            building_id: unit.building_id,
            unit_id: lease.unit_id,
            lease_id: lease.id,
            charge_type: 'parking',
            title: 'Estacionamiento',
            responsibility_type: 'tenant',
            amount_expected: lease.parking_fee,
            due_day: lease.due_day || 15,
            active: true,
            billing_frequency: 'monthly',
          })
        }
      }
    }

    if (schedulesToCreate.length > 0) {
      await supabase.from('collection_schedules').insert(schedulesToCreate)
    }

    // PASO 5: Todos los schedules activos (incluye los recién creados)
    const { data: allSchedules } = await supabase
      .from('collection_schedules')
      .select('id, lease_id, charge_type, amount_expected, due_day, unit_id, building_id')
      .eq('company_id', companyId)
      .eq('active', true)
      .is('deleted_at', null)
      .in('unit_id', unitIds)

    // PASO 6: Records ya existentes este mes
    const { data: existingRecords } = await supabase
      .from('collection_records')
      .select('collection_schedule_id')
      .eq('company_id', companyId)
      .eq('period_year', year)
      .eq('period_month', month)
      .is('deleted_at', null)

    const existingScheduleIds = new Set(
      (existingRecords ?? []).map((r) => r.collection_schedule_id as string)
    )

    // PASO 7: Insertar records faltantes
    const activeLeaseIds = new Set(leases.map((l) => l.id as string))
    const recordsToCreate = []

    for (const schedule of allSchedules ?? []) {
      if (!schedule.lease_id || !activeLeaseIds.has(schedule.lease_id)) continue
      if (existingScheduleIds.has(schedule.id)) continue

      const dueDay = schedule.due_day || 15
      const lastDay = new Date(year, month, 0).getDate()
      const dueDateDay = Math.min(dueDay, lastDay)
      const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(dueDateDay).padStart(2, '0')}`

      const isVariable = VARIABLE_CHARGE_TYPES.includes(schedule.charge_type)

      recordsToCreate.push({
        collection_schedule_id: schedule.id,
        company_id: companyId,
        building_id: schedule.building_id,
        unit_id: schedule.unit_id,
        lease_id: schedule.lease_id,
        period_year: year,
        period_month: month,
        due_date: dueDate,
        amount_due: isVariable ? 0 : schedule.amount_expected,
        amount_collected: 0,
        status: 'pending',
        notes: isVariable ? 'needs_amount' : null,
      })
    }

    if (recordsToCreate.length > 0) {
      await supabase.from('collection_records').insert(recordsToCreate)
    }

    results[companyId] = recordsToCreate.length
    console.log(`Company ${companyId}: ${recordsToCreate.length} records creados para ${month}/${year}`)
  }

  return new Response(JSON.stringify({ ok: true, month, year, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
