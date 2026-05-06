/**
 * Seed script — inserts test payment data for May 2026 into production DB.
 * Run: node scripts/seed-payments.mjs
 *
 * IDs obtained from DB on 2026-05-06:
 *   company_id   : e8d70ff9-cd31-47ba-a893-1ed3ee60d8dd (FRA-MAR)
 *   Marsella 232 : 6e0a61a6-d830-4d02-8000-0f5a5984bb2d
 *   Marsella 304 : 1b2a60c1-df2d-42fb-905f-cdd8c0483835
 *   elec-232     : 51923603-4b1b-4942-ab95-4807c89542e9 (CFE / MEDIDOR 1)
 *   water-232    : 92ad9d74-2ec5-48fa-8014-a65c671066bd (Agua y Drenaje / 123234)
 *   elec-304     : a26e9619-9e9a-4079-924a-f89b230b4dd7 (CFE / CFE-DEDICADO-001)
 *   water-304    : ebdfdee7-775c-4bf8-91ed-abe73b866b36 (Agua y Drenaje / 123456)
 */

import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const H    = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

const CID         = 'e8d70ff9-cd31-47ba-a893-1ed3ee60d8dd'
const M232        = '6e0a61a6-d830-4d02-8000-0f5a5984bb2d'
const M304        = '1b2a60c1-df2d-42fb-905f-cdd8c0483835'
const ELEC_232    = '51923603-4b1b-4942-ab95-4807c89542e9'
const WATER_232   = '92ad9d74-2ec5-48fa-8014-a65c671066bd'
const ELEC_304    = 'a26e9619-9e9a-4079-924a-f89b230b4dd7'
const WATER_304   = 'ebdfdee7-775c-4bf8-91ed-abe73b866b36'
const TODAY       = new Date().toISOString().split('T')[0]

async function post(table, rows) {
  const r = await fetch(`${SUPA}/rest/v1/${table}`, {
    method: 'POST', headers: H, body: JSON.stringify(rows),
  })
  const data = await r.json()
  if (!r.ok) { console.error(`❌ ${table}:`, data); return null }
  console.log(`✅ ${table}: inserted ${Array.isArray(rows) ? rows.length : 1} row(s)`)
  return data
}

// ── SEED 1: building_utility_invoices ─────────────────────────────────────
// NOTE: payment_status + paid_at columns don't exist in DB yet (migration pending).
// Using status 'charged' for "paid" invoices, 'distributed' for "unpaid".

console.log('\n── Seed 1: Facturas de servicios (Mayo 2026) ─────────────')

const baseInvoice = { company_id: CID, period_year: 2026, period_month: 5,
  total_consumption: null, consumption_unit: null, folio: null, charged_at: null, due_date: null }

await post('building_utility_invoices', [
  { ...baseInvoice, building_id: M232, building_utility_meter_id: ELEC_232,
    total_amount: 3450, total_consumption: 280, consumption_unit: 'kWh',
    folio: 'CFE-2026-001', status: 'distributed', due_date: '2026-05-31' },
  { ...baseInvoice, building_id: M232, building_utility_meter_id: WATER_232,
    total_amount: 890, total_consumption: 45, consumption_unit: 'm³',
    status: 'distributed', due_date: '2026-05-20' },
  { ...baseInvoice, building_id: M304, building_utility_meter_id: ELEC_304,
    total_amount: 4120, folio: 'CFE-2026-002',
    status: 'charged', due_date: '2026-05-15', charged_at: '2026-05-10T12:00:00Z' },
  { ...baseInvoice, building_id: M304, building_utility_meter_id: WATER_304,
    total_amount: 1200, status: 'distributed', due_date: TODAY },
])

// ── SEED 2: payment_reports + items ───────────────────────────────────────

console.log('\n── Seed 2: Reporte de compras RPG-2026-19 ────────────────')

const rptRows = await post('payment_reports', {
  company_id:    CID,
  folio:         'RPG-2026-19',
  week_number:   19,
  year:          2026,
  report_date:   '2026-05-05',
  elaborated_by: 'Compras Fra-Mar',
  status:        'pending',
})

if (rptRows) {
  const reportId = Array.isArray(rptRows) ? rptRows[0].id : rptRows.id
  console.log('  report id:', reportId)

  await post('payment_report_items', [
    {
      payment_report_id: reportId,
      description:       'Pintura vinílica galón',
      vendor_name:       'Home Depot',
      amount:            2340,
      payment_status:    'unpaid',
      due_date:          '2026-05-15',
      paid_at:           null,
      purchase_order_id: null,
      notes:             null,
    },
    {
      payment_report_id: reportId,
      description:       'Llave de paso 1/2"',
      vendor_name:       'Ferreterías',
      amount:            680,
      payment_status:    'unpaid',
      due_date:          '2026-05-31',
      paid_at:           null,
      purchase_order_id: null,
      notes:             null,
    },
    {
      payment_report_id: reportId,
      description:       'Silicón sellador',
      vendor_name:       'Brico Depot',
      amount:            420,
      payment_status:    'paid',
      due_date:          '2026-05-31',
      paid_at:           '2026-05-08T10:00:00Z',
      purchase_order_id: null,
      notes:             null,
    },
  ])
}

// ── SEED 3: manual_payments ───────────────────────────────────────────────

console.log('\n── Seed 3: Pagos manuales (Mayo 2026) ────────────────────')

await post('manual_payments', [
  {
    company_id:     CID,
    building_id:    M232,
    title:          'Servicio de limpieza fachada',
    amount:         3500,
    period_year:    2026,
    period_month:   5,
    payment_status: 'unpaid',
    due_date:       '2026-05-25',
    paid_at:        null,
    payment_report_id: null,
  },
  {
    company_id:     CID,
    building_id:    M304,
    title:          'Revisión elevador',
    amount:         1800,
    period_year:    2026,
    period_month:   5,
    payment_status: 'paid',
    due_date:       '2026-05-10',
    paid_at:        '2026-05-03T09:00:00Z',
    payment_report_id: null,
  },
  {
    company_id:     CID,
    building_id:    M232,
    title:          'Plomería área común',
    amount:         950,
    period_year:    2026,
    period_month:   5,
    payment_status: 'unpaid',
    due_date:       TODAY,
    paid_at:        null,
    payment_report_id: null,
  },
])

console.log('\n✅ Seed completo.')
