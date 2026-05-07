/**
 * Seed completo — simula flujo real del sistema con is_test=true.
 * Run: node scripts/seed-full.mjs
 *
 * Limpia datos de prueba anteriores antes de insertar.
 */

import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const H    = {
  apikey: KEY, Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json', Prefer: 'return=representation',
}
const H_DEL = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const CID = 'e8d70ff9-cd31-47ba-a893-1ed3ee60d8dd'
const TODAY = new Date().toISOString().split('T')[0]

// ── Helpers ──────────────────────────────────────────────────────────────────

async function get(table, params = '') {
  const r = await fetch(`${SUPA}/rest/v1/${table}?${params}`, { headers: H })
  if (!r.ok) { console.error(`❌ GET ${table}:`, await r.json()); return [] }
  return r.json()
}

async function post(table, rows) {
  const body = Array.isArray(rows) ? rows : [rows]
  if (body.length === 0) return []
  const r = await fetch(`${SUPA}/rest/v1/${table}`, {
    method: 'POST', headers: H, body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) { console.error(`❌ POST ${table}:`, data); return null }
  return Array.isArray(data) ? data : [data]
}

async function del(table, filter) {
  const r = await fetch(`${SUPA}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers: H_DEL,
  })
  if (!r.ok) { const d = await r.json(); console.error(`❌ DELETE ${table}:`, d) }
}

function distribute(total, n) {
  const base = Math.floor((total * 100) / n) / 100
  const remainder = Math.round((total - base * n) * 100) / 100
  return Array.from({ length: n }, (_, i) =>
    i === n - 1 ? Math.round((base + remainder) * 100) / 100 : base
  )
}

// ── STEP 0: Limpiar datos de prueba anteriores ────────────────────────────────

console.log('\n── Limpiando datos de prueba anteriores ─────────────────────')

// FK order: items before parents.
// Also clean invoices for the specific test meters+period regardless of is_test,
// so the script is idempotent even if old seeds ran without is_test=true.
const TEST_METERS = [
  '51923603-4b1b-4942-ab95-4807c89542e9',
  '92ad9d74-2ec5-48fa-8014-a65c671066bd',
  'a26e9619-9e9a-4079-924a-f89b230b4dd7',
  'ebdfdee7-775c-4bf8-91ed-abe73b866b36',
].join(',')

// Delete invoice items for the test meters+period
const existingInvs = await get('building_utility_invoices',
  `select=id&building_utility_meter_id=in.(${TEST_METERS})&period_year=eq.2026&period_month=eq.5`)
if (existingInvs.length > 0) {
  const ids = existingInvs.map(i => i.id).join(',')
  await del('building_utility_invoice_items', `invoice_id=in.(${ids})`)
  await del('building_utility_invoices', `id=in.(${ids})`)
}

await del('payment_report_items', 'is_test=eq.true')
await del('payment_reports',      `is_test=eq.true&company_id=eq.${CID}`)
await del('purchase_orders',      `is_test=eq.true&company_id=eq.${CID}`)
await del('manual_payments',      `is_test=eq.true&company_id=eq.${CID}`)
console.log('  ✓ Limpieza completa')

// ── STEP 1: Fetch IDs reales de la DB ─────────────────────────────────────────

console.log('\n── Obteniendo IDs reales de la DB ───────────────────────────')

const buildings = await get('buildings',
  `select=id,name&company_id=eq.${CID}&name=in.(Marsella 232,Marsella 304)&deleted_at=is.null`)

const M232 = buildings.find(b => b.name === 'Marsella 232')?.id
const M304 = buildings.find(b => b.name === 'Marsella 304')?.id
if (!M232 || !M304) { console.error('❌ No se encontraron los edificios'); process.exit(1) }
console.log(`  Marsella 232: ${M232}`)
console.log(`  Marsella 304: ${M304}`)

const meters = await get('building_utility_meters',
  `select=id,building_id,service_type&building_id=in.(${M232},${M304})&deleted_at=is.null`)

const ELEC_232  = meters.find(m => m.building_id === M232 && m.service_type === 'electricity')?.id
const WATER_232 = meters.find(m => m.building_id === M232 && m.service_type === 'water')?.id
const ELEC_304  = meters.find(m => m.building_id === M304 && m.service_type === 'electricity')?.id
const WATER_304 = meters.find(m => m.building_id === M304 && m.service_type === 'water')?.id
if (!ELEC_232 || !WATER_232 || !ELEC_304 || !WATER_304) {
  console.error('❌ Faltan medidores'); process.exit(1)
}
console.log(`  Medidores OK (elec-232, water-232, elec-304, water-304)`)

const allSubMeters = await get('building_utility_sub_meters',
  `select=id,building_utility_meter_id,unit_id&building_utility_meter_id=in.(${ELEC_232},${WATER_232},${ELEC_304},${WATER_304})&deleted_at=is.null`)

const subMeters232 = allSubMeters.filter(s => s.building_utility_meter_id === ELEC_232)
const subMeters304 = allSubMeters.filter(s => s.building_utility_meter_id === ELEC_304)
console.log(`  Sub-medidores: ${subMeters232.length} en 232, ${subMeters304.length} en 304`)

// Active leases — intersect with sub-meter unit_ids where available
const leases232raw = await get('leases',
  `select=id,unit_id&status=eq.ACTIVE&deleted_at=is.null&unit_id=in.(${
    (await get('units', `select=id&building_id=eq.${M232}&deleted_at=is.null`)).map(u => u.id).join(',')
  })`)
const leases304raw = await get('leases',
  `select=id,unit_id&status=eq.ACTIVE&deleted_at=is.null&unit_id=in.(${
    (await get('units', `select=id&building_id=eq.${M304}&deleted_at=is.null`)).map(u => u.id).join(',')
  })`)

const activeUnitIds232 = new Set(leases232raw.map(l => l.unit_id))
const activeUnitIds304 = new Set(leases304raw.map(l => l.unit_id))

// Sub-meters with active leases
const activeSubMeters232 = subMeters232.filter(s => activeUnitIds232.has(s.unit_id))
const activeSubMeters304 = subMeters304.filter(s => activeUnitIds304.has(s.unit_id))
console.log(`  Sub-medidores con contrato activo: ${activeSubMeters232.length} en 232, ${activeSubMeters304.length} en 304`)

// Fallback unit_id for water (no sub-meters) — first active lease unit
const fallbackUnit232 = leases232raw[0]?.unit_id
const fallbackUnit304 = leases304raw[0]?.unit_id
if (!fallbackUnit232 || !fallbackUnit304) {
  console.error('❌ Sin contratos activos'); process.exit(1)
}

const suppliers = await get('suppliers',
  `select=id,name&company_id=eq.${CID}&deleted_at=is.null&name=in.(Home Depot Mexico,Gilsa,Bricos)`)

const SUP_HD    = suppliers.find(s => s.name === 'Home Depot Mexico')?.id
const SUP_GILSA = suppliers.find(s => s.name === 'Gilsa')?.id || suppliers[0]?.id
const SUP_BRICO = suppliers.find(s => s.name === 'Bricos')?.id || suppliers[0]?.id
if (!SUP_HD) { console.error('❌ No se encontró proveedor Home Depot Mexico'); process.exit(1) }
console.log(`  Proveedores OK (Home Depot, Gilsa, Bricos)`)

// ── SEED 1: Facturas de servicios ─────────────────────────────────────────────

console.log('\n── Seed 1: Facturas de servicios (Mayo 2026) ────────────────')

const baseInv = {
  company_id: CID, period_year: 2026, period_month: 5,
  total_consumption: null, consumption_unit: null,
  folio: null, distributed_at: null, charged_at: null, paid_at: null,
  payment_status: 'unpaid', due_date: null,
  pdf_path: null, created_by: null, is_test: true,
}

const invoiceDefs = [
  { ...baseInv, building_id: M232, building_utility_meter_id: ELEC_232,
    total_amount: 3450, total_consumption: 280, consumption_unit: 'kWh',
    folio: 'CFE-MAY-001', status: 'distributed', payment_status: 'unpaid',
    due_date: '2026-05-31' },
  { ...baseInv, building_id: M232, building_utility_meter_id: WATER_232,
    total_amount: 890, total_consumption: 45, consumption_unit: 'm3',
    folio: 'SADM-MAY-001', status: 'distributed', payment_status: 'unpaid',
    due_date: '2026-05-20' },
  { ...baseInv, building_id: M304, building_utility_meter_id: ELEC_304,
    total_amount: 4120, total_consumption: 320, consumption_unit: 'kWh',
    folio: 'CFE-MAY-002', status: 'charged', payment_status: 'paid',
    charged_at: '2026-05-10T12:00:00Z', paid_at: '2026-05-10T12:00:00Z',
    due_date: '2026-05-15' },
  { ...baseInv, building_id: M304, building_utility_meter_id: WATER_304,
    total_amount: 1200, total_consumption: 60, consumption_unit: 'm3',
    folio: 'SADM-MAY-002', status: 'distributed', payment_status: 'unpaid',
    due_date: TODAY },
]

const invoiceRows = await post('building_utility_invoices', invoiceDefs)
if (!invoiceRows) { console.error('❌ Abortando'); process.exit(1) }
console.log(`  ✓ ${invoiceRows.length} facturas insertadas`)

// ── SEED 1b: Invoice items (distribución por unidad) ──────────────────────────

console.log('\n── Seed 1b: Distribución de facturas por unidad ─────────────')

const [invElec232, invWater232, invElec304, invWater304] = invoiceRows

// Elec 232 — distribute among active sub-meter units
const amounts232 = distribute(3450, activeSubMeters232.length)
const pct232     = parseFloat((100 / activeSubMeters232.length).toFixed(4))
const items232   = activeSubMeters232.map((sm, i) => ({
  invoice_id: invElec232.id,
  building_utility_sub_meter_id: sm.id,
  unit_id: sm.unit_id,
  consumption: parseFloat((280 / activeSubMeters232.length).toFixed(2)),
  percentage: pct232,
  amount_assigned: amounts232[i],
  is_test: true,
}))
await post('building_utility_invoice_items', items232)
console.log(`  ✓ Elec 232: ${items232.length} items ($3,450 ÷ ${activeSubMeters232.length} unidades)`)

// Water 232 — no sub-meters → 1 item for the building
const itemsWater232 = [{
  invoice_id: invWater232.id,
  building_utility_sub_meter_id: null,
  unit_id: fallbackUnit232,
  consumption: 45,
  percentage: 100,
  amount_assigned: 890,
  is_test: true,
}]
await post('building_utility_invoice_items', itemsWater232)
console.log(`  ✓ Agua 232: 1 item ($890 — sin sub-medidores)`)

// Elec 304 — distribute among active sub-meter units
const amounts304 = distribute(4120, activeSubMeters304.length)
const pct304     = parseFloat((100 / activeSubMeters304.length).toFixed(4))
const items304   = activeSubMeters304.map((sm, i) => ({
  invoice_id: invElec304.id,
  building_utility_sub_meter_id: sm.id,
  unit_id: sm.unit_id,
  consumption: parseFloat((320 / activeSubMeters304.length).toFixed(2)),
  percentage: pct304,
  amount_assigned: amounts304[i],
  is_test: true,
}))
await post('building_utility_invoice_items', items304)
console.log(`  ✓ Elec 304: ${items304.length} items ($4,120 ÷ ${activeSubMeters304.length} unidades)`)

// Water 304 — no sub-meters → 1 item
const itemsWater304 = [{
  invoice_id: invWater304.id,
  building_utility_sub_meter_id: null,
  unit_id: fallbackUnit304,
  consumption: 60,
  percentage: 100,
  amount_assigned: 1200,
  is_test: true,
}]
await post('building_utility_invoice_items', itemsWater304)
console.log(`  ✓ Agua 304: 1 item ($1,200 — sin sub-medidores)`)

// ── SEED 2: OCs + reporte de pagos ────────────────────────────────────────────

console.log('\n── Seed 2: Órdenes de compra + reporte RPG-2026-18 ─────────')

const basePO = {
  company_id: CID, status: 'invoiced', is_test: true,
  building_id: null, supplier_id: null, supplier_prefix: null,
  folio: null, project_description: null, total_estimated: 0,
}

const poRows = await post('purchase_orders', [
  { ...basePO, building_id: M232, supplier_id: SUP_HD,    supplier_prefix: 'HD',
    folio: 'PO-TEST-001', project_description: 'Materiales eléctricos', total_estimated: 4500 },
  { ...basePO, building_id: M304, supplier_id: SUP_GILSA,
    folio: 'PO-TEST-002', project_description: 'Pintura y acabados',    total_estimated: 2800 },
  { ...basePO, building_id: M232, supplier_id: SUP_BRICO,
    folio: 'PO-TEST-003', project_description: 'Herrajes y tornillería', total_estimated: 1200 },
])
if (!poRows) { console.error('❌ Abortando'); process.exit(1) }
const [po1, po2, po3] = poRows
console.log(`  ✓ ${poRows.length} OCs insertadas`)

const rptRows = await post('payment_reports', {
  company_id: CID, folio: 'RPG-2026-18', week_number: 18, year: 2026,
  report_date: '2026-05-02', elaborated_by: 'Compras Fra-Mar',
  status: 'pending', is_test: true,
})
if (!rptRows) { console.error('❌ Abortando'); process.exit(1) }
const reportId = rptRows[0].id
console.log(`  ✓ Reporte ${rptRows[0].folio} creado (id: ${reportId})`)

const baseItem = {
  payment_report_id: reportId,
  purchase_order_id: null, vendor_name: null, notes: null,
  payment_status: 'unpaid', paid_at: null, due_date: null, is_test: true,
}

const itemRows = await post('payment_report_items', [
  { ...baseItem, purchase_order_id: po1.id,
    description: 'Materiales eléctricos',  vendor_name: 'Home Depot',
    amount: 4500, payment_status: 'paid',  paid_at: '2026-05-08T10:00:00Z',
    due_date: '2026-05-09' },
  { ...baseItem, purchase_order_id: po2.id,
    description: 'Pintura y acabados',     vendor_name: 'Gilsa',
    amount: 2800, due_date: '2026-05-16' },
  { ...baseItem, purchase_order_id: po3.id,
    description: 'Herrajes y tornillería', vendor_name: 'Bricos',
    amount: 1200, due_date: TODAY },
])
if (!itemRows) { console.error('❌ Abortando'); process.exit(1) }
console.log(`  ✓ ${itemRows.length} items del reporte insertados`)

// Actualizar status del reporte según items
const paidItems = itemRows.filter(i => i.payment_status === 'paid').length
const newStatus = paidItems === itemRows.length ? 'paid'
  : paidItems > 0 ? 'partial' : 'pending'
await fetch(`${SUPA}/rest/v1/payment_reports?id=eq.${reportId}`, {
  method: 'PATCH',
  headers: { ...H, Prefer: 'return=minimal' },
  body: JSON.stringify({ status: newStatus }),
})
console.log(`  ✓ Status del reporte actualizado a '${newStatus}'`)

// ── SEED 3: Pagos manuales ────────────────────────────────────────────────────

console.log('\n── Seed 3: Pagos manuales (Mayo 2026) ───────────────────────')

const baseMP = {
  company_id: CID, period_year: 2026, period_month: 5,
  payment_status: 'unpaid', paid_at: null, payment_report_id: null, is_test: true,
}

const mpRows = await post('manual_payments', [
  { ...baseMP, building_id: M232, title: 'Servicio de limpieza fachada',
    amount: 3500, due_date: '2026-05-25' },
  { ...baseMP, building_id: M304, title: 'Revisión elevador',
    amount: 1800, payment_status: 'paid', paid_at: '2026-05-03T09:00:00Z',
    due_date: '2026-05-10' },
  { ...baseMP, building_id: M232, title: 'Plomería área común',
    amount: 950, due_date: TODAY },
])
if (!mpRows) { console.error('❌ Abortando'); process.exit(1) }
console.log(`  ✓ ${mpRows.length} pagos manuales insertados`)

// ── Resumen ───────────────────────────────────────────────────────────────────

const totalInvItems = items232.length + 1 + items304.length + 1
console.log(`
═══════════════════════════════════════════════════
  SEED COMPLETO ✅
═══════════════════════════════════════════════════
  Facturas de servicios:  ${invoiceRows.length}
  Items de facturas:      ${totalInvItems} (${activeSubMeters232.length} elec-232 + 1 agua-232 + ${activeSubMeters304.length} elec-304 + 1 agua-304)
  OCs de prueba:          ${poRows.length}
  Reporte creado:         ${rptRows[0].folio} (status: ${newStatus})
  Items del reporte:      ${itemRows.length}
  Pagos manuales:         ${mpRows.length}
═══════════════════════════════════════════════════
`)
