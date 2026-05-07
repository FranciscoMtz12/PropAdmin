/**
 * Seed script — inserts test payment_reports with is_test=true for May 2026.
 * Run: node scripts/seed-payment-reports.mjs
 *
 * IDs (from DB):
 *   company_id   : e8d70ff9-cd31-47ba-a893-1ed3ee60d8dd (FRA-MAR)
 *   Marsella 232 : 6e0a61a6-d830-4d02-8000-0f5a5984bb2d
 *   Marsella 304 : 1b2a60c1-df2d-42fb-905f-cdd8c0483835
 *   Home Depot   : f2c2412c-de14-4f8f-91d3-9cdeb0faf209
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

const CID   = 'e8d70ff9-cd31-47ba-a893-1ed3ee60d8dd'
const M232  = '6e0a61a6-d830-4d02-8000-0f5a5984bb2d'
const M304  = '1b2a60c1-df2d-42fb-905f-cdd8c0483835'
const HD    = 'f2c2102c-de14-4f8f-91d3-9cdeb0faf209'

async function post(table, rows) {
  const r = await fetch(`${SUPA}/rest/v1/${table}`, {
    method: 'POST', headers: H, body: JSON.stringify(rows),
  })
  const data = await r.json()
  if (!r.ok) { console.error(`❌ ${table}:`, data); return null }
  console.log(`✅ ${table}: inserted ${Array.isArray(rows) ? rows.length : 1} row(s)`)
  return data
}

// ── SEED 1: purchase_orders (is_test=true) ───────────────────────────────────

console.log('\n── Seed 1: Órdenes de compra de prueba ──────────────────────')

const basePO = {
  company_id: CID, status: 'invoiced', is_test: true,
  building_id: null, supplier_id: null, supplier_prefix: null,
  folio: null, project_description: null, total_estimated: 0,
  created_at: new Date().toISOString(),
}

const poRows = await post('purchase_orders', [
  { ...basePO, building_id: M232, supplier_id: HD, supplier_prefix: 'HD',
    folio: 'PO-TEST-001', project_description: 'Materiales eléctricos', total_estimated: 4500 },
  { ...basePO, building_id: M304,
    folio: 'PO-TEST-002', project_description: 'Pintura y acabados', total_estimated: 2800 },
  { ...basePO, building_id: M232,
    folio: 'PO-TEST-003', project_description: 'Herrajes y tornillería', total_estimated: 1200 },
])

if (!poRows) { console.error('❌ Abortando — no se crearon POs'); process.exit(1) }
const [po1, po2, po3] = Array.isArray(poRows) ? poRows : [poRows]
console.log('  PO IDs:', po1.id, po2.id, po3.id)

// ── SEED 2: payment_reports (is_test=true) ───────────────────────────────────

console.log('\n── Seed 2: Reportes de pago de prueba ───────────────────────')

// RPG-2026-18 — all unpaid, due 2026-05-01 (vencida), status='pending'
const rpt18Rows = await post('payment_reports', {
  company_id:    CID,
  folio:         'RPG-2026-18',
  week_number:   18,
  year:          2026,
  report_date:   '2026-04-28',
  elaborated_by: 'Compras Fra-Mar',
  status:        'pending',
  is_test:       true,
})

// RPG-2026-19 — mixed (1 paid, 1 unpaid), status='partial'
const rpt19Rows = await post('payment_reports', {
  company_id:    CID,
  folio:         'RPG-2026-19-TEST',
  week_number:   19,
  year:          2026,
  report_date:   '2026-05-05',
  elaborated_by: 'Compras Fra-Mar',
  status:        'pending',
  is_test:       true,
})

if (!rpt18Rows || !rpt19Rows) { console.error('❌ Abortando — no se crearon reportes'); process.exit(1) }
const rpt18Id = Array.isArray(rpt18Rows) ? rpt18Rows[0].id : rpt18Rows.id
const rpt19Id = Array.isArray(rpt19Rows) ? rpt19Rows[0].id : rpt19Rows.id
console.log('  RPG-2026-18 id:', rpt18Id)
console.log('  RPG-2026-19-TEST id:', rpt19Id)

// ── SEED 3: payment_report_items ─────────────────────────────────────────────

console.log('\n── Seed 3: Items de reportes de prueba ──────────────────────')

const baseItem = { payment_status: 'unpaid', paid_at: null, notes: null, is_test: true }

await post('payment_report_items', [
  { ...baseItem, payment_report_id: rpt18Id, description: 'Materiales eléctricos',
    vendor_name: 'Home Depot', amount: 4500, due_date: '2026-05-01',
    purchase_order_id: po1.id },
  { ...baseItem, payment_report_id: rpt18Id, description: 'Pintura y acabados',
    vendor_name: 'Comex', amount: 2800, due_date: '2026-05-01',
    purchase_order_id: po2.id },
  { ...baseItem, payment_report_id: rpt18Id, description: 'Herrajes y tornillería',
    vendor_name: 'Truper', amount: 1200, due_date: '2026-05-01',
    purchase_order_id: po3.id },
  { ...baseItem, payment_report_id: rpt19Id, description: 'Mano de obra plomería',
    vendor_name: null, amount: 3200, due_date: '2026-05-15',
    purchase_order_id: null },
  { ...baseItem, payment_report_id: rpt19Id, description: 'Refacciones bomba agua',
    vendor_name: null, amount: 1800, due_date: '2026-05-31',
    purchase_order_id: null, payment_status: 'paid', paid_at: '2026-05-05T10:00:00Z' },
])

console.log('\n✅ Seed completo.')
