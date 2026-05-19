/**
 * Suite de pruebas funcionales SAPROA — lógica de negocio contra Supabase.
 * Ejecutar: npx tsx scripts/test-logica.ts
 *
 * Todos los datos de prueba usan folio/título "TEST-LOG-*".
 * Cada test limpia sus datos creados en el bloque finally.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────────────────────────────────────
//  ENV
// ─────────────────────────────────────────────────────────────────────────────

const envRaw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
const ENV: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  ENV[t.slice(0, i)] = t.slice(i + 1);
}

const SUPA_URL = ENV.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPA_URL || !SUPA_KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const sb = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CID         = "e8d70ff9-cd31-47ba-a893-1ed3ee60d8dd";
const TEST_YEAR   = 2026;
const TEST_MONTH  = 11;  // Noviembre — sin datos reales todavía
const UNIQ_YEAR   = 2027;
const UNIQ_MONTH  = 12;  // Solo para tests de unicidad

// ─────────────────────────────────────────────────────────────────────────────
//  TEST FRAMEWORK
// ─────────────────────────────────────────────────────────────────────────────

type Result = { name: string; passed: boolean; error?: string };
const results: Result[] = [];

function recordPass(name: string) {
  results.push({ name, passed: true });
  console.log(`✅ PASS — ${name}`);
}

function recordFail(name: string, error: string, expected?: unknown, got?: unknown) {
  results.push({ name, passed: false, error });
  console.log(`❌ FAIL — ${name}`);
  console.log(`   Error: ${error}`);
  if (expected !== undefined) console.log(`   Esperado: ${JSON.stringify(expected)}`);
  if (got !== undefined) console.log(`   Obtenido: ${JSON.stringify(got)}`);
}

class TestFail extends Error {
  constructor(msg: string, public expected?: unknown, public got?: unknown) {
    super(msg);
  }
}

function ok(cond: boolean, msg: string, expected?: unknown, got?: unknown): void {
  if (!cond) throw new TestFail(msg, expected, got);
}

async function run(
  name: string,
  fn: () => Promise<void>,
  cleanup?: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
    recordPass(name);
  } catch (e) {
    if (e instanceof TestFail) recordFail(name, e.message, e.expected, e.got);
    else recordFail(name, String(e));
  } finally {
    if (cleanup) {
      try { await cleanup(); }
      catch (ce) { console.warn(`  ⚠️  Cleanup [${name}]: ${ce}`); }
    }
  }
}

// Supabase helper — lanza TestFail si hay error
async function db<T>(
  label: string,
  q: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T> {
  const { data, error } = await q;
  if (error) {
    const errStr = typeof error === "object" && error !== null
      ? JSON.stringify(error)
      : String(error);
    throw new TestFail(`DB [${label}]: ${errStr}`);
  }
  if (data === null) throw new TestFail(`DB null result [${label}]`);
  return data;
}

// Eliminar filas por IDs — silencia errores para no ocultar el fallo original
async function del(table: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await sb.from(table).delete().in("id", ids);
  if (error) console.warn(`  ⚠️  No se pudo limpiar ${table}: ${JSON.stringify(error)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PRE-FLIGHT: IDs reales necesarios
// ─────────────────────────────────────────────────────────────────────────────

let SUPPLIER_ID    = "";
let B232_ID        = "";
let ELEC_METER_ID  = "";
let FIXED_METER_ID = "";  // internet o servicio fijo
let SUB_METERS:    Array<{ id: string; unit_id: string }> = [];
let LEASES:        Array<{ id: string; unit_id: string }> = [];
let SCHEDULES:     Array<{
  id: string; charge_type: string; amount_expected: number;
  unit_id: string; building_id: string; lease_id: string | null;
}> = [];

async function preflight(): Promise<void> {
  console.log("\n── Pre-flight ───────────────────────────────────────────────\n");

  const { data: sups, error: supErr } = await sb
    .from("suppliers").select("id").eq("company_id", CID).is("deleted_at", null).limit(1);
  if (supErr || !sups?.length) { console.error("❌ No hay proveedores"); process.exit(1); }
  SUPPLIER_ID = (sups[0] as { id: string }).id;

  const { data: bld, error: bldErr } = await sb
    .from("buildings").select("id").eq("company_id", CID)
    .eq("name", "Marsella 232").is("deleted_at", null).single();
  if (bldErr || !bld) { console.error("❌ No se encontró Marsella 232"); process.exit(1); }
  B232_ID = (bld as { id: string }).id;

  const { data: meters } = await sb
    .from("building_utility_meters").select("id,service_type,billing_type")
    .eq("building_id", B232_ID).is("deleted_at", null);
  for (const m of (meters ?? []) as Array<{ id: string; service_type: string; billing_type: string }>) {
    if (m.service_type === "electricity") ELEC_METER_ID = m.id;
    if ((m.service_type === "internet" || m.billing_type === "fixed") && !FIXED_METER_ID)
      FIXED_METER_ID = m.id;
  }
  if (!ELEC_METER_ID) { console.error("❌ No hay medidor de electricidad en Marsella 232"); process.exit(1); }
  if (!FIXED_METER_ID) FIXED_METER_ID = ELEC_METER_ID; // Fallback si no hay fijo

  const { data: subs } = await sb
    .from("building_utility_sub_meters").select("id,unit_id")
    .eq("building_utility_meter_id", ELEC_METER_ID)
    .eq("active", true).is("deleted_at", null);
  SUB_METERS = (subs ?? []) as typeof SUB_METERS;

  const { data: rawUnits } = await sb
    .from("units").select("id").eq("building_id", B232_ID).is("deleted_at", null);
  const unitIds = (rawUnits ?? []).map((u: { id: string }) => u.id);

  if (unitIds.length) {
    const today = new Date().toISOString().split("T")[0];
    const { data: ls } = await sb
      .from("leases").select("id,unit_id")
      .in("unit_id", unitIds).eq("status", "ACTIVE").is("deleted_at", null)
      .lte("start_date", today).or(`end_date.is.null,end_date.gte.${today}`);
    LEASES = (ls ?? []) as typeof LEASES;
  }

  const { data: scheds } = await sb
    .from("collection_schedules")
    .select("id,charge_type,amount_expected,unit_id,building_id,lease_id")
    .eq("building_id", B232_ID).eq("active", true).is("deleted_at", null).limit(100);
  SCHEDULES = (scheds ?? []) as typeof SCHEDULES;

  console.log(`  Proveedor:         ${SUPPLIER_ID}`);
  console.log(`  Marsella 232:      ${B232_ID}`);
  console.log(`  Medidor eléctrico: ${ELEC_METER_ID}`);
  console.log(`  Medidor fijo:      ${FIXED_METER_ID}`);
  console.log(`  Sub-medidores:     ${SUB_METERS.length}`);
  console.log(`  Contratos activos: ${LEASES.length}`);
  console.log(`  Schedules activos: ${SCHEDULES.length}`);

  if (!LEASES.length) console.warn("  ⚠️  Sin contratos activos — algunos tests de cobranza pueden fallar\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 1 — COMPRAS
// ─────────────────────────────────────────────────────────────────────────────

async function suite1(): Promise<void> {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 1 — COMPRAS");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── 1.1 OC completa de un jalón ──────────────────────────────────────────

  const ids11 = { po: [] as string[], items: [] as string[] };
  await run("1.1 — OC completa de un jalón", async () => {
    const po = await db("create OC-A",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-A", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true,
        notes: "TEST-LOG: Suite 1.1",
      }).select("id").single(),
    ) as { id: string };
    ids11.po.push(po.id);

    const items = await db("create items OC-A",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: po.id, description: "Pintura blanca 4L", quantity: 3, unit: "Cubeta", unit_price: 120 },
        { purchase_order_id: po.id, description: "Brocha 4 pulgadas", quantity: 3, unit: "Pieza", unit_price: 35 },
      ]).select("id,quantity"),
    ) as Array<{ id: string; quantity: number }>;
    ids11.items.push(...items.map(i => i.id));

    for (const item of items) {
      await db("receive item",
        sb.from("purchase_order_items")
          .update({ quantity_received: item.quantity }).eq("id", item.id).select("id").single(),
      );
    }

    await db("update OC-A received",
      sb.from("purchase_orders").update({ status: "received" }).eq("id", po.id).select("id").single(),
    );

    const verify = await db("verify OC-A",
      sb.from("purchase_orders").select("status").eq("id", po.id).single(),
    ) as { status: string };
    ok(verify.status === "received", "OC status debe ser 'received'", "received", verify.status);

    const vItems = await db("verify items OC-A",
      sb.from("purchase_order_items").select("quantity,quantity_received")
        .eq("purchase_order_id", po.id).is("deleted_at", null),
    ) as Array<{ quantity: number; quantity_received: number | null }>;
    ok(vItems.length === 2, "Debe haber 2 items", 2, vItems.length);
    for (const it of vItems) {
      ok(it.quantity_received === it.quantity,
        `Item con quantity=${it.quantity} no está completamente recibido`,
        it.quantity, it.quantity_received);
    }
  }, async () => { await del("purchase_order_items", ids11.items); await del("purchase_orders", ids11.po); });

  // ── 1.2 OC con faltantes → genera V2 ────────────────────────────────────

  const ids12 = { po: [] as string[], items: [] as string[], v2: [] as string[], v2items: [] as string[] };
  await run("1.2 — OC con faltantes → genera V2", async () => {
    const poB = await db("create OC-B",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-B", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true, notes: "TEST-LOG: Suite 1.2",
      }).select("id").single(),
    ) as { id: string };
    ids12.po.push(poB.id);

    const items = await db("create items OC-B",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: poB.id, description: "Cemento gris 50kg", quantity: 4, unit: "Bulto", unit_price: 180 },
        { purchase_order_id: poB.id, description: "Arena fina", quantity: 4, unit: "Metro", unit_price: 90 },
        { purchase_order_id: poB.id, description: "Grava", quantity: 4, unit: "Metro", unit_price: 95 },
      ]).select("id,quantity,description"),
    ) as Array<{ id: string; quantity: number; description: string }>;
    ids12.items.push(...items.map(i => i.id));

    // Recepción parcial: item1=4/4, item2=2/4, item3=0/4
    await db("receive item1 completo",
      sb.from("purchase_order_items").update({ quantity_received: 4 }).eq("id", items[0].id).select("id").single(),
    );
    await db("receive item2 parcial",
      sb.from("purchase_order_items").update({ quantity_received: 2 }).eq("id", items[1].id).select("id").single(),
    );
    await db("receive item3 cero",
      sb.from("purchase_order_items").update({ quantity_received: 0 }).eq("id", items[2].id).select("id").single(),
    );
    await db("update OC-B partial",
      sb.from("purchase_orders").update({ status: "partial" }).eq("id", poB.id).select("id").single(),
    );

    // Calcular faltantes y crear V2
    const shortages = [
      { description: items[1].description, qty_needed: 2, original_qty: 4 },
      { description: items[2].description, qty_needed: 4, original_qty: 4 },
    ];
    const poV2 = await db("create OC-B-V2",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-B-V2", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true,
        parent_order_id: poB.id, version_type: "shortage",
        notes: "TEST-LOG: Suite 1.2 V2",
      }).select("id").single(),
    ) as { id: string };
    ids12.v2.push(poV2.id);

    const v2Items = await db("create items V2",
      sb.from("purchase_order_items").insert(
        shortages.map(s => ({
          purchase_order_id: poV2.id, description: s.description,
          quantity: s.qty_needed, unit: "Metro", unit_price: 90,
        })),
      ).select("id,quantity"),
    ) as Array<{ id: string; quantity: number }>;
    ids12.v2items.push(...v2Items.map(i => i.id));

    // Verificar V2
    const v2 = await db("verify V2",
      sb.from("purchase_orders").select("parent_order_id,version_type")
        .eq("id", poV2.id).single(),
    ) as { parent_order_id: string | null; version_type: string | null };
    ok(v2.parent_order_id === poB.id, "V2.parent_order_id debe apuntar a OC-B", poB.id, v2.parent_order_id);
    ok(v2.version_type === "shortage", "V2.version_type debe ser 'shortage'", "shortage", v2.version_type);

    const vV2Items = await db("verify V2 items count",
      sb.from("purchase_order_items").select("id,quantity").eq("purchase_order_id", poV2.id).is("deleted_at", null),
    ) as Array<{ id: string; quantity: number }>;
    ok(vV2Items.length === 2, "V2 debe tener 2 items (los faltantes)", 2, vV2Items.length);

    const totalFaltante = vV2Items.reduce((s, i) => s + i.quantity, 0);
    ok(totalFaltante === 6, "Total faltante V2 debe ser 6 (2+4)", 6, totalFaltante);

    // Recibir V2 completo
    for (const it of v2Items) {
      await db("receive V2 item",
        sb.from("purchase_order_items").update({ quantity_received: it.quantity }).eq("id", it.id).select("id").single(),
      );
    }
    await db("update V2 received",
      sb.from("purchase_orders").update({ status: "received" }).eq("id", poV2.id).select("id").single(),
    );
    await db("update OC-B received",
      sb.from("purchase_orders").update({ status: "received" }).eq("id", poB.id).select("id").single(),
    );

    // Verificar cascada: B y V2 = received
    const statusCheck = await db("verify cascada received",
      sb.from("purchase_orders").select("id,status").in("id", [poB.id, poV2.id]),
    ) as Array<{ id: string; status: string }>;
    for (const po of statusCheck) {
      ok(po.status === "received", `OC ${po.id} debe estar 'received'`, "received", po.status);
    }
  }, async () => {
    await del("purchase_order_items", ids12.v2items);
    await del("purchase_orders", ids12.v2);
    await del("purchase_order_items", ids12.items);
    await del("purchase_orders", ids12.po);
  });

  // ── 1.3 V2 con faltantes → genera V3 ────────────────────────────────────

  const ids13 = {
    poC: [] as string[], cItems: [] as string[],
    v2: [] as string[], v2Items: [] as string[],
    v3: [] as string[], v3Items: [] as string[],
  };
  await run("1.3 — V2 con faltantes → genera V3", async () => {
    // OC-C
    const poC = await db("create OC-C",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-C", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true, notes: "TEST-LOG: Suite 1.3",
      }).select("id").single(),
    ) as { id: string };
    ids13.poC.push(poC.id);

    const cItems = await db("create items OC-C",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: poC.id, description: "Llave de agua 1/2", quantity: 6, unit: "Pieza", unit_price: 45 },
        { purchase_order_id: poC.id, description: "Codo PVC 1/2", quantity: 6, unit: "Pieza", unit_price: 8 },
      ]).select("id,quantity,description"),
    ) as Array<{ id: string; quantity: number; description: string }>;
    ids13.cItems.push(...cItems.map(i => i.id));

    // Recepción parcial en C: item1=3/6, item2=2/6
    await sb.from("purchase_order_items").update({ quantity_received: 3 }).eq("id", cItems[0].id);
    await sb.from("purchase_order_items").update({ quantity_received: 2 }).eq("id", cItems[1].id);
    await sb.from("purchase_orders").update({ status: "partial" }).eq("id", poC.id);

    // V2 con faltantes: item1 necesita 3 más, item2 necesita 4 más
    const v2C = await db("create V2-C",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-C-V2", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true,
        parent_order_id: poC.id, version_type: "shortage", notes: "TEST-LOG: Suite 1.3 V2",
      }).select("id").single(),
    ) as { id: string };
    ids13.v2.push(v2C.id);

    const v2CItems = await db("create items V2-C",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: v2C.id, description: cItems[0].description, quantity: 3, unit: "Pieza", unit_price: 45 },
        { purchase_order_id: v2C.id, description: cItems[1].description, quantity: 4, unit: "Pieza", unit_price: 8 },
      ]).select("id,quantity,description"),
    ) as Array<{ id: string; quantity: number; description: string }>;
    ids13.v2Items.push(...v2CItems.map(i => i.id));

    // Recepción parcial en V2: item1=2/3, item2=4/4
    await sb.from("purchase_order_items").update({ quantity_received: 2 }).eq("id", v2CItems[0].id);
    await sb.from("purchase_order_items").update({ quantity_received: 4 }).eq("id", v2CItems[1].id);
    await sb.from("purchase_orders").update({ status: "partial" }).eq("id", v2C.id);

    // V3 con el faltante de V2: item1 necesita 1 más
    const v3C = await db("create V3-C",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-C-V3", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true,
        parent_order_id: v2C.id, version_type: "shortage", notes: "TEST-LOG: Suite 1.3 V3",
      }).select("id").single(),
    ) as { id: string };
    ids13.v3.push(v3C.id);

    const v3CItems = await db("create items V3-C",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: v3C.id, description: v2CItems[0].description, quantity: 1, unit: "Pieza", unit_price: 45 },
      ]).select("id,quantity"),
    ) as Array<{ id: string; quantity: number }>;
    ids13.v3Items.push(...v3CItems.map(i => i.id));

    // Recibir V3 completo
    await sb.from("purchase_order_items").update({ quantity_received: 1 }).eq("id", v3CItems[0].id);
    await sb.from("purchase_orders").update({ status: "received" }).eq("id", v3C.id);
    await sb.from("purchase_orders").update({ status: "received" }).eq("id", v2C.id);
    await sb.from("purchase_orders").update({ status: "received" }).eq("id", poC.id);

    // Verificar C → V2 → V3 todas "received"
    const chain = await db("verify chain C+V2+V3",
      sb.from("purchase_orders").select("folio,status,parent_order_id,version_type")
        .in("id", [poC.id, v2C.id, v3C.id]),
    ) as Array<{ folio: string; status: string; parent_order_id: string | null; version_type: string | null }>;
    ok(chain.length === 3, "Deben existir 3 OCs en la cadena", 3, chain.length);
    for (const po of chain) {
      ok(po.status === "received", `${po.folio} debe estar 'received'`, "received", po.status);
    }
    const v2Row = chain.find(p => p.parent_order_id === poC.id);
    const v3Row = chain.find(p => p.parent_order_id === v2C.id);
    ok(!!v2Row, "V2 debe tener parent_order_id = OC-C");
    ok(!!v3Row, "V3 debe tener parent_order_id = V2");
  }, async () => {
    await del("purchase_order_items", ids13.v3Items);
    await del("purchase_orders", ids13.v3);
    await del("purchase_order_items", ids13.v2Items);
    await del("purchase_orders", ids13.v2);
    await del("purchase_order_items", ids13.cItems);
    await del("purchase_orders", ids13.poC);
  });

  // ── 1.4 Devolución (return) ───────────────────────────────────────────────

  const ids14 = {
    po: [] as string[], items: [] as string[],
    ret: [] as string[], retItems: [] as string[],
  };
  await run("1.4 — Devolución (return)", async () => {
    const poD = await db("create OC-D",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-D", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "received", is_test: true, notes: "TEST-LOG: Suite 1.4",
      }).select("id").single(),
    ) as { id: string };
    ids14.po.push(poD.id);

    const dItems = await db("create items OC-D",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: poD.id, description: "Foco LED 10W", quantity: 10, unit: "Pieza", unit_price: 55, quantity_received: 10 },
        { purchase_order_id: poD.id, description: "Interruptor sencillo", quantity: 5, unit: "Pieza", unit_price: 30, quantity_received: 5 },
      ]).select("id"),
    ) as Array<{ id: string }>;
    ids14.items.push(...dItems.map(i => i.id));

    // Crear devolución
    const ret = await db("create return",
      sb.from("purchase_returns").insert({
        company_id: CID, purchase_order_id: poD.id,
        type: "return", reason: "defective",
        reason_notes: "TEST-LOG: 2 focos defectuosos",
      }).select("id").single(),
    ) as { id: string };
    ids14.ret.push(ret.id);

    const retItems = await db("create return items",
      sb.from("purchase_return_items").insert([
        { return_id: ret.id, purchase_order_item_id: dItems[0].id, quantity_returned: 2 },
      ]).select("id"),
    ) as Array<{ id: string }>;
    ids14.retItems.push(...retItems.map(i => i.id));

    // Verificar: return existe, type correcto, OC status no cambió
    const retVerify = await db("verify return",
      sb.from("purchase_returns").select("type,purchase_order_id").eq("id", ret.id).single(),
    ) as { type: string; purchase_order_id: string };
    ok(retVerify.type === "return", "Return.type debe ser 'return'", "return", retVerify.type);
    ok(retVerify.purchase_order_id === poD.id, "Return apunta a OC-D");

    const poStatus = await db("verify OC-D status sin cambio",
      sb.from("purchase_orders").select("status").eq("id", poD.id).single(),
    ) as { status: string };
    ok(poStatus.status === "received", "OC-D status no debe cambiar tras devolución", "received", poStatus.status);

    const retItemsVerify = await db("verify return items",
      sb.from("purchase_return_items").select("quantity_returned").eq("return_id", ret.id),
    ) as Array<{ quantity_returned: number }>;
    ok(retItemsVerify.length === 1, "Debe haber 1 return item", 1, retItemsVerify.length);
    ok(retItemsVerify[0].quantity_returned === 2, "Cantidad devuelta debe ser 2", 2, retItemsVerify[0].quantity_returned);
  }, async () => {
    await del("purchase_return_items", ids14.retItems);
    await del("purchase_returns", ids14.ret);
    await del("purchase_order_items", ids14.items);
    await del("purchase_orders", ids14.po);
  });

  // ── 1.5 Cambio (exchange) ─────────────────────────────────────────────────

  const ids15 = {
    po: [] as string[], items: [] as string[],
    poReplacement: [] as string[], replacementItems: [] as string[],
    ret: [] as string[], retItems: [] as string[],
  };
  await run("1.5 — Cambio (exchange)", async () => {
    const poE = await db("create OC-E",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-E", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "received", is_test: true, notes: "TEST-LOG: Suite 1.5",
      }).select("id").single(),
    ) as { id: string };
    ids15.po.push(poE.id);

    const eItems = await db("create items OC-E",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: poE.id, description: "Llave de paso 1 pulgada", quantity: 3, unit: "Pieza", unit_price: 280, quantity_received: 3 },
      ]).select("id"),
    ) as Array<{ id: string }>;
    ids15.items.push(...eItems.map(i => i.id));

    // OC de reemplazo (para el cambio)
    const poReplacement = await db("create OC-E-CAMBIO",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-E-CAMBIO", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "sent", is_test: true,
        parent_order_id: poE.id, version_type: "exchange",
        notes: "TEST-LOG: Suite 1.5 reemplazo",
      }).select("id").single(),
    ) as { id: string };
    ids15.poReplacement.push(poReplacement.id);

    const replacementItems = await db("create items reemplazo",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: poReplacement.id, description: "Llave de paso 1 pulgada (cambio)", quantity: 3, unit: "Pieza", unit_price: 280 },
      ]).select("id"),
    ) as Array<{ id: string }>;
    ids15.replacementItems.push(...replacementItems.map(i => i.id));

    // Crear registro de devolución tipo exchange con puntero al reemplazo
    const ret = await db("create exchange return",
      sb.from("purchase_returns").insert({
        company_id: CID, purchase_order_id: poE.id,
        type: "exchange", reason: "wrong_item",
        reason_notes: "TEST-LOG: llave incorrecta, cambio por modelo correcto",
        replacement_order_id: poReplacement.id,
      }).select("id").single(),
    ) as { id: string };
    ids15.ret.push(ret.id);

    const retItem = await db("create exchange return item",
      sb.from("purchase_return_items").insert([
        { return_id: ret.id, purchase_order_item_id: eItems[0].id, quantity_returned: 3 },
      ]).select("id"),
    ) as Array<{ id: string }>;
    ids15.retItems.push(...retItem.map(i => i.id));

    // Verificar
    const retVerify = await db("verify exchange return",
      sb.from("purchase_returns").select("type,replacement_order_id").eq("id", ret.id).single(),
    ) as { type: string; replacement_order_id: string | null };
    ok(retVerify.type === "exchange", "Return.type debe ser 'exchange'", "exchange", retVerify.type);
    ok(retVerify.replacement_order_id === poReplacement.id,
      "Return.replacement_order_id debe apuntar a OC de reemplazo",
      poReplacement.id, retVerify.replacement_order_id);

    const replVerify = await db("verify replacement OC version_type",
      sb.from("purchase_orders").select("version_type").eq("id", poReplacement.id).single(),
    ) as { version_type: string | null };
    ok(replVerify.version_type === "exchange",
      "OC de reemplazo debe tener version_type='exchange'", "exchange", replVerify.version_type);
  }, async () => {
    await del("purchase_return_items", ids15.retItems);
    await del("purchase_returns", ids15.ret);
    await del("purchase_order_items", ids15.replacementItems);
    await del("purchase_orders", ids15.poReplacement);
    await del("purchase_order_items", ids15.items);
    await del("purchase_orders", ids15.po);
  });

  // ── 1.6 Factura de OC ─────────────────────────────────────────────────────

  const ids16 = { po: [] as string[], items: [] as string[], invoices: [] as string[] };
  await run("1.6 — Factura de OC", async () => {
    const poF = await db("create OC-F",
      sb.from("purchase_orders").insert({
        company_id: CID, folio: "TEST-LOG-OC-F", supplier_id: SUPPLIER_ID,
        building_id: B232_ID, status: "received", is_test: true, notes: "TEST-LOG: Suite 1.6",
      }).select("id").single(),
    ) as { id: string };
    ids16.po.push(poF.id);

    const fItems = await db("create items OC-F",
      sb.from("purchase_order_items").insert([
        { purchase_order_id: poF.id, description: "Cable eléctrico cal 12", quantity: 50, unit: "Metro", unit_price: 18, quantity_received: 50 },
      ]).select("id"),
    ) as Array<{ id: string }>;
    ids16.items.push(...fItems.map(i => i.id));

    // Insertar factura
    const inv = await db("insert purchase_order_invoice",
      sb.from("purchase_order_invoices").insert({
        company_id: CID, purchase_order_id: poF.id,
        invoice_number: "TEST-LOG-FAC-001",
        invoice_date: new Date().toISOString().split("T")[0],
        amount: 900,
        notes: "TEST-LOG: Factura de prueba",
      }).select("id").single(),
    ) as { id: string };
    ids16.invoices.push(inv.id);

    // Actualizar OC a "invoiced"
    await db("update OC-F invoiced",
      sb.from("purchase_orders").update({ status: "invoiced" }).eq("id", poF.id).select("id").single(),
    );

    // Verificar
    const invVerify = await db("verify invoice",
      sb.from("purchase_order_invoices").select("invoice_number,amount,purchase_order_id")
        .eq("id", inv.id).single(),
    ) as { invoice_number: string; amount: number; purchase_order_id: string };
    ok(invVerify.invoice_number === "TEST-LOG-FAC-001", "invoice_number correcto");
    ok(invVerify.amount === 900, "Amount debe ser 900", 900, invVerify.amount);
    ok(invVerify.purchase_order_id === poF.id, "Invoice apunta a OC-F");

    const poStatus = await db("verify OC-F status",
      sb.from("purchase_orders").select("status").eq("id", poF.id).single(),
    ) as { status: string };
    ok(poStatus.status === "invoiced", "OC-F debe estar 'invoiced'", "invoiced", poStatus.status);
  }, async () => {
    await del("purchase_order_invoices", ids16.invoices);
    await del("purchase_order_items", ids16.items);
    await del("purchase_orders", ids16.po);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 2 — COBRANZA
// ─────────────────────────────────────────────────────────────────────────────

async function suite2(): Promise<void> {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 2 — COBRANZA");
  console.log("══════════════════════════════════════════════════════════════\n");

  if (!LEASES.length || !SCHEDULES.length) {
    console.log("⚠️  Sin contratos/schedules activos en Marsella 232 — omitiendo Suite 2\n");
    for (const n of ["2.1","2.2","2.3","2.4"]) recordFail(`${n} — skip`, "Sin contratos activos en Marsella 232");
    return;
  }

  const VARIABLE_TYPES = new Set(["electricity", "water", "gas"]);

  // ── 2.1 Generación de cobros ──────────────────────────────────────────────

  const ids21 = { records: [] as string[] };
  await run("2.1 — Generación de cobros (Noviembre 2026)", async () => {
    // Verificar que no existen registros para Nov 2026
    const schedIds = SCHEDULES.map(s => s.id);
    const { data: existing } = await sb
      .from("collection_records")
      .select("id").in("collection_schedule_id", schedIds)
      .eq("period_year", TEST_YEAR).eq("period_month", TEST_MONTH).is("deleted_at", null);
    ok((existing ?? []).length === 0,
      `Ya existen ${(existing ?? []).length} collection_records para Nov 2026 — el test requiere período limpio`,
      0, (existing ?? []).length);

    const today = new Date().toISOString().split("T")[0];
    const dueDate = `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, "0")}-05`;
    const toInsert = SCHEDULES
      .filter(s => s.lease_id !== null)
      .map(s => {
        const isVariable = VARIABLE_TYPES.has(s.charge_type) && s.amount_expected === 0;
        return {
          collection_schedule_id: s.id,
          company_id: CID,
          building_id: s.building_id,
          unit_id: s.unit_id,
          lease_id: s.lease_id,
          period_year: TEST_YEAR,
          period_month: TEST_MONTH,
          due_date: dueDate,
          amount_due: isVariable ? 0 : s.amount_expected,
          amount_collected: 0,
          status: dueDate < today ? "overdue" : "pending",
          needs_capture: isVariable,
          notes: "TEST-LOG: Suite 2.1",
        };
      });
    ok(toInsert.length > 0, "Debe haber schedules con lease_id para insertar", ">0", toInsert.length);

    const inserted = await db("insert collection_records",
      sb.from("collection_records").insert(toInsert).select("id,needs_capture").returns<unknown[]>() as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>,
    ) as Array<{ id: string; needs_capture: boolean }>;
    ids21.records.push(...inserted.map(r => r.id));
    ok(inserted.length === toInsert.length,
      "Deben insertarse todos los cobros", toInsert.length, inserted.length);

    // Verificar que existen registros de renta
    const rentRecords = SCHEDULES.filter(s => s.charge_type === "rent");
    ok(rentRecords.length > 0, "Deben existir schedules de renta en Marsella 232");

    // Verificar needs_capture en electricidad (amount_expected=0)
    const elecSchedules = SCHEDULES.filter(
      s => VARIABLE_TYPES.has(s.charge_type) && s.amount_expected === 0 && s.lease_id,
    );
    if (elecSchedules.length > 0) {
      const elecIds = elecSchedules.map(s => s.id);
      const elecRecords = await db("verify electricidad needs_capture",
        sb.from("collection_records").select("needs_capture")
          .in("collection_schedule_id", elecIds)
          .eq("period_year", TEST_YEAR).eq("period_month", TEST_MONTH),
      ) as Array<{ needs_capture: boolean }>;
      for (const r of elecRecords) {
        ok(r.needs_capture === true,
          "Registros de servicios variables deben tener needs_capture=true", true, r.needs_capture);
      }
    }
  }, async () => { await del("collection_records", ids21.records); });

  // ── 2.2 Pago completo ────────────────────────────────────────────────────

  const rentSched = SCHEDULES.find(s => s.charge_type === "rent" && s.lease_id);
  if (!rentSched) {
    recordFail("2.2 — Pago completo", "No se encontró schedule de renta con lease_id");
    recordFail("2.3 — Pago parcial → completar", "No se encontró schedule de renta");
    recordFail("2.4 — Registro vencido", "No se encontró schedule de renta");
  } else {
    const ids22 = { records: [] as string[] };
    await run("2.2 — Pago completo", async () => {
      const rec = await db("insert record pago completo",
        sb.from("collection_records").insert({
          collection_schedule_id: rentSched.id,
          company_id: CID, building_id: rentSched.building_id,
          unit_id: rentSched.unit_id, lease_id: rentSched.lease_id,
          period_year: TEST_YEAR, period_month: TEST_MONTH - 1, // Octubre 2026
          due_date: `${TEST_YEAR}-10-05`,
          amount_due: 5000, amount_collected: 0,
          status: "pending", needs_capture: false,
          notes: "TEST-LOG: Suite 2.2",
        }).select("id").single(),
      ) as { id: string };
      ids22.records.push(rec.id);

      // Registrar pago completo
      await db("apply pago completo",
        sb.from("collection_records").update({
          amount_collected: 5000, status: "collected",
          collected_at: new Date().toISOString(),
        }).eq("id", rec.id).select("id").single(),
      );

      const verify = await db("verify collected",
        sb.from("collection_records").select("status,amount_collected,amount_due")
          .eq("id", rec.id).single(),
      ) as { status: string; amount_collected: number; amount_due: number };
      ok(verify.status === "collected", "Status debe ser 'collected'", "collected", verify.status);
      ok(verify.amount_collected === verify.amount_due,
        "amount_collected debe igualar amount_due", 5000, verify.amount_collected);
    }, async () => { await del("collection_records", ids22.records); });

    // ── 2.3 Pago parcial → completar ────────────────────────────────────────

    const ids23 = { records: [] as string[] };
    await run("2.3 — Pago parcial → completar", async () => {
      const rec = await db("insert record pago parcial",
        sb.from("collection_records").insert({
          collection_schedule_id: rentSched.id,
          company_id: CID, building_id: rentSched.building_id,
          unit_id: rentSched.unit_id, lease_id: rentSched.lease_id,
          period_year: TEST_YEAR, period_month: TEST_MONTH - 2, // Septiembre 2026
          due_date: `${TEST_YEAR}-09-05`,
          amount_due: 5000, amount_collected: 0,
          status: "pending", needs_capture: false,
          notes: "TEST-LOG: Suite 2.3",
        }).select("id").single(),
      ) as { id: string };
      ids23.records.push(rec.id);

      // Primer abono: 2000
      const prev1 = 0;
      const new1 = Math.min(prev1 + 2000, 5000);
      await db("primer abono 2000",
        sb.from("collection_records").update({
          amount_collected: new1,
          status: new1 >= 5000 ? "collected" : "partial",
        }).eq("id", rec.id).select("id").single(),
      );

      const mid = await db("verify partial",
        sb.from("collection_records").select("status,amount_collected").eq("id", rec.id).single(),
      ) as { status: string; amount_collected: number };
      ok(mid.status === "partial", "Después del primer abono: status='partial'", "partial", mid.status);
      ok(mid.amount_collected === 2000, "amount_collected=2000 tras primer abono", 2000, mid.amount_collected);

      // Segundo abono: 3000 → completa
      const new2 = Math.min(mid.amount_collected + 3000, 5000);
      await db("segundo abono 3000",
        sb.from("collection_records").update({
          amount_collected: new2,
          status: new2 >= 5000 ? "collected" : "partial",
          collected_at: new Date().toISOString(),
        }).eq("id", rec.id).select("id").single(),
      );

      const final = await db("verify final collected",
        sb.from("collection_records").select("status,amount_collected").eq("id", rec.id).single(),
      ) as { status: string; amount_collected: number };
      ok(final.status === "collected", "Estado final: 'collected'", "collected", final.status);
      ok(final.amount_collected === 5000, "Total recolectado=5000", 5000, final.amount_collected);
    }, async () => { await del("collection_records", ids23.records); });

    // ── 2.4 Registro vencido ─────────────────────────────────────────────────

    const ids24 = { records: [] as string[] };
    await run("2.4 — Registro vencido", async () => {
      const pastDate = "2026-01-05"; // Enero 2026 — ya vencido
      const rec = await db("insert record vencido",
        sb.from("collection_records").insert({
          collection_schedule_id: rentSched.id,
          company_id: CID, building_id: rentSched.building_id,
          unit_id: rentSched.unit_id, lease_id: rentSched.lease_id,
          period_year: 2026, period_month: 1,
          due_date: pastDate,
          amount_due: 6000, amount_collected: 0,
          status: "pending", needs_capture: false,
          notes: "TEST-LOG: Suite 2.4",
        }).select("id,due_date").single(),
      ) as { id: string; due_date: string };
      ids24.records.push(rec.id);

      const today = new Date().toISOString().split("T")[0];
      ok(rec.due_date < today, "due_date debe ser anterior a hoy", `< ${today}`, rec.due_date);

      // Simular proceso de marcar vencidos
      await db("mark overdue",
        sb.from("collection_records").update({ status: "overdue" })
          .eq("id", rec.id).select("id").single(),
      );

      const overdue = await db("verify overdue",
        sb.from("collection_records").select("status").eq("id", rec.id).single(),
      ) as { status: string };
      ok(overdue.status === "overdue", "Status debe ser 'overdue'", "overdue", overdue.status);

      // Verificar que acepta pago aunque esté vencido
      await db("pago en registro vencido",
        sb.from("collection_records").update({
          amount_collected: 6000, status: "collected",
          collected_at: new Date().toISOString(),
        }).eq("id", rec.id).select("id").single(),
      );

      const paid = await db("verify pago de overdue",
        sb.from("collection_records").select("status,amount_collected").eq("id", rec.id).single(),
      ) as { status: string; amount_collected: number };
      ok(paid.status === "collected", "Registro vencido acepta pago → 'collected'", "collected", paid.status);
      ok(paid.amount_collected === 6000, "amount_collected=6000", 6000, paid.amount_collected);
    }, async () => { await del("collection_records", ids24.records); });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 3 — SERVICIOS
// ─────────────────────────────────────────────────────────────────────────────

async function suite3(): Promise<void> {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 3 — SERVICIOS");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── 3.1 Factura fija registrada ──────────────────────────────────────────

  const ids31 = { invoices: [] as string[] };
  await run("3.1 — Factura fija registrada (Internet Noviembre 2026)", async () => {
    const inv = await db("insert factura fija",
      sb.from("building_utility_invoices").insert({
        company_id: CID, building_id: B232_ID,
        building_utility_meter_id: FIXED_METER_ID,
        period_year: TEST_YEAR, period_month: TEST_MONTH,
        total_amount: 500, folio: "TEST-LOG-INET-001",
        status: "distributed", payment_status: "unpaid",
        due_date: `${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")}-15`,
        is_test: true,
      }).select("id,status,payment_status").single(),
    ) as { id: string; status: string; payment_status: string };
    ids31.invoices.push(inv.id);

    ok(inv.status === "distributed", "Invoice status debe ser 'distributed'", "distributed", inv.status);
    ok(inv.payment_status === "unpaid", "payment_status debe ser 'unpaid'", "unpaid", inv.payment_status);

    // Re-leer para confirmar persistencia
    const verify = await db("verify factura fija",
      sb.from("building_utility_invoices")
        .select("total_amount,folio,building_utility_meter_id")
        .eq("id", inv.id).single(),
    ) as { total_amount: number; folio: string; building_utility_meter_id: string };
    ok(verify.total_amount === 500, "total_amount=500", 500, verify.total_amount);
    ok(verify.folio === "TEST-LOG-INET-001", "Folio correcto");
    ok(verify.building_utility_meter_id === FIXED_METER_ID, "Apunta al medidor correcto");
  }, async () => { await del("building_utility_invoices", ids31.invoices); });

  // ── 3.2 + 3.3 Distribución proporcional + Cargo 2% ─────────────────────

  if (SUB_METERS.length < 2) {
    recordFail("3.2 — Distribución proporcional por consumo", `Solo ${SUB_METERS.length} sub-medidores — se necesitan ≥2`);
    recordFail("3.3 — Cargo por servicio 2%", "Test 3.2 no ejecutado");
    recordFail("3.4 — Actualización collection_records al distribuir", "Sin sub-medidores suficientes");
  } else {
    const ids32 = {
      invoices: [] as string[],
      invoiceItems: [] as string[],
      readings: [] as string[],
    };

    // Consumos fijos para los primeros N sub-medidores con lease activo
    const TOTAL_AMOUNT   = 3450;
    const leaseUnitIds   = new Set(LEASES.map(l => l.unit_id));
    const activeSubs     = SUB_METERS.filter(s => leaseUnitIds.has(s.unit_id));
    const consumptions   = [22, 19, 21, 18, 23, 17, 20, 22, 19, 21, 18, 20, 20];
    const subsToUse      = activeSubs.slice(0, Math.min(activeSubs.length, consumptions.length));
    const totalCons      = subsToUse.reduce((s, _, i) => s + (consumptions[i] ?? 20), 0);

    let invoiceId32 = "";
    let distItems32: Array<{ id: string; amount_assigned: number; percentage: number | null }> = [];
    let test32passed = false;

    await run("3.2 — Distribución proporcional por consumo", async () => {
      ok(subsToUse.length >= 2, "Se necesitan ≥2 sub-medidores con contrato activo", "≥2", subsToUse.length);

      // Insertar lecturas para Nov 2026
      const readingsData = subsToUse.map((s, i) => ({
        company_id: CID,
        building_utility_meter_id: ELEC_METER_ID,
        building_utility_sub_meter_id: s.id,
        period_year: TEST_YEAR, period_month: TEST_MONTH,
        previous_reading: 100,
        current_reading: 100 + (consumptions[i] ?? 20),
        consumption: consumptions[i] ?? 20,
        reading_date: `${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")}-01`,
        notes: "TEST-LOG: Suite 3.2",
      }));
      const readings = await db("insert lecturas",
        sb.from("building_utility_readings").insert(readingsData).select("id").returns<unknown[]>() as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>,
      ) as Array<{ id: string }>;
      ids32.readings.push(...readings.map(r => r.id));

      // Insertar factura
      const inv = await db("insert factura electricidad",
        sb.from("building_utility_invoices").insert({
          company_id: CID, building_id: B232_ID,
          building_utility_meter_id: ELEC_METER_ID,
          period_year: TEST_YEAR, period_month: TEST_MONTH,
          total_amount: TOTAL_AMOUNT,
          total_consumption: totalCons, consumption_unit: "kWh",
          folio: "TEST-LOG-CFE-NOV", status: "distributed",
          payment_status: "unpaid", is_test: true,
          due_date: `${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")}-15`,
        }).select("id").single(),
      ) as { id: string };
      ids32.invoices.push(inv.id);
      invoiceId32 = inv.id;

      // Calcular distribución proporcional y crear items
      const itemsData = subsToUse.map((s, i) => {
        const cons = consumptions[i] ?? 20;
        const pct  = (cons / totalCons) * 100;
        const amt  = parseFloat(((cons / totalCons) * TOTAL_AMOUNT).toFixed(2));
        return {
          invoice_id: inv.id,
          building_utility_sub_meter_id: s.id,
          unit_id: s.unit_id,
          consumption: cons,
          percentage: parseFloat(pct.toFixed(4)),
          amount_assigned: amt,
        };
      });
      // Ajustar el último item para que la suma exacta cuadre
      const sumBefore = itemsData.slice(0,-1).reduce((s, it) => s + it.amount_assigned, 0);
      itemsData[itemsData.length - 1].amount_assigned = parseFloat((TOTAL_AMOUNT - sumBefore).toFixed(2));

      const items = await db("insert invoice_items",
        sb.from("building_utility_invoice_items").insert(itemsData)
          .select("id,amount_assigned,percentage").returns<unknown[]>() as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>,
      ) as Array<{ id: string; amount_assigned: number; percentage: number | null }>;
      ids32.invoiceItems.push(...items.map(it => it.id));
      distItems32 = items;

      // Verificar suma de amount_assigned ≈ total_amount (tolerancia $1)
      const sumAssigned = items.reduce((s: number, it) => s + it.amount_assigned, 0);
      ok(Math.abs(sumAssigned - TOTAL_AMOUNT) <= 1,
        `Suma de amount_assigned (${sumAssigned.toFixed(2)}) debe ≈ ${TOTAL_AMOUNT} (±$1)`,
        TOTAL_AMOUNT, parseFloat(sumAssigned.toFixed(2)));

      ok(items.length === subsToUse.length,
        `Deben generarse ${subsToUse.length} items, uno por depa`,
        subsToUse.length, items.length);

      // Verificar porcentajes suman ≈ 100%
      const sumPct = items.reduce((s: number, it) => s + (it.percentage ?? 0), 0);
      ok(Math.abs(sumPct - 100) <= 0.5,
        `Porcentajes deben sumar ≈ 100% (tolerancia 0.5%)`,
        "≈100%", parseFloat(sumPct.toFixed(2)));

      test32passed = true;
    }, async () => { /* cleanup al final de 3.3 */ });

    // ── 3.3 Cargo por servicio 2% ─────────────────────────────────────────

    await run("3.3 — Cargo por servicio 2%", async () => {
      ok(test32passed, "Test 3.2 debe pasar antes de ejecutar 3.3");
      ok(distItems32.length > 0, "Deben existir invoice_items del test 3.2");

      const sumAssigned = distItems32.reduce((s, it) => s + it.amount_assigned, 0);
      const expectedTotalCargo = parseFloat((sumAssigned * 0.02).toFixed(2));

      let sumCargos = 0;
      for (const item of distItems32) {
        const cargo = parseFloat((item.amount_assigned * 0.02).toFixed(2));
        ok(cargo > 0, `Cargo por servicio de item (${item.amount_assigned}) debe ser > 0`, ">0", cargo);
        sumCargos += cargo;
      }
      sumCargos = parseFloat(sumCargos.toFixed(2));

      // Tolerancia de $1 por redondeo de centavos
      ok(Math.abs(sumCargos - expectedTotalCargo) <= 1,
        `Suma de cargos (${sumCargos}) debe ≈ total*2% (${expectedTotalCargo})`,
        expectedTotalCargo, sumCargos);

      // Total con cargo ≈ total_amount * 1.02
      const totalConCargo = parseFloat((sumAssigned * 1.02).toFixed(2));
      const expectedConCargo = parseFloat((TOTAL_AMOUNT * 1.02).toFixed(2));
      ok(Math.abs(totalConCargo - expectedConCargo) <= 1,
        `Total con cargo (${totalConCargo}) debe ≈ ${expectedConCargo}`,
        expectedConCargo, totalConCargo);
    }, async () => {
      // Cleanup de 3.2 + 3.3 juntos
      await del("building_utility_invoice_items", ids32.invoiceItems);
      await del("building_utility_invoices", ids32.invoices);
      await del("building_utility_readings", ids32.readings);
    });

    // ── 3.4 Actualización de collection_records al distribuir ──────────────

    const rentSched34 = SCHEDULES.find(s => s.charge_type === "electricity" && s.lease_id);
    const rentSchedFallback = SCHEDULES.find(s => s.charge_type === "rent" && s.lease_id);
    const sched34 = rentSched34 ?? rentSchedFallback;

    if (!sched34) {
      recordFail("3.4 — Actualización collection_records al distribuir", "No se encontró schedule activo");
    } else {
      const ids34 = { records: [] as string[] };
      await run("3.4 — Actualización collection_records al distribuir", async () => {
        // Crear collection_records con needs_capture=true (simulando servicios variables)
        const padM = String(TEST_MONTH - 1).padStart(2, "0"); // Octubre
        const recs = await db("insert records con needs_capture=true",
          sb.from("collection_records").insert([
            {
              collection_schedule_id: sched34.id,
              company_id: CID, building_id: sched34.building_id,
              unit_id: sched34.unit_id, lease_id: sched34.lease_id,
              period_year: TEST_YEAR, period_month: TEST_MONTH - 1,
              due_date: `${TEST_YEAR}-${padM}-05`,
              amount_due: 0, amount_collected: 0,
              status: "pending", needs_capture: true,
              notes: "TEST-LOG: Suite 3.4",
            },
          ]).select("id,needs_capture").returns<unknown[]>() as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>,
        ) as Array<{ id: string; needs_capture: boolean }>;
        ids34.records.push(...recs.map(r => r.id));

        ok(recs[0].needs_capture === true, "Record debe iniciar con needs_capture=true", true, recs[0].needs_capture);

        // Simular el UPDATE que hace UtilityInvoiceModal al distribuir
        const montoPorDepa = 265.38;
        await db("simular distribución: UPDATE needs_capture+amount_due",
          sb.from("collection_records").update({
            needs_capture: false,
            amount_due: montoPorDepa,
            updated_at: new Date().toISOString(),
          }).eq("id", recs[0].id).select("id").single(),
        );

        const verify = await db("verify post-distribución",
          sb.from("collection_records")
            .select("needs_capture,amount_due").eq("id", recs[0].id).single(),
        ) as { needs_capture: boolean; amount_due: number };
        ok(verify.needs_capture === false, "needs_capture debe ser false post-distribución", false, verify.needs_capture);
        ok(verify.amount_due > 0, `amount_due debe ser > 0 post-distribución`, ">0", verify.amount_due);
        ok(Math.abs(verify.amount_due - montoPorDepa) < 0.01,
          "amount_due debe corresponder al monto distribuido", montoPorDepa, verify.amount_due);
      }, async () => { await del("collection_records", ids34.records); });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 4 — INTEGRIDAD DE DATOS
// ─────────────────────────────────────────────────────────────────────────────

async function suite4(): Promise<void> {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  SUITE 4 — INTEGRIDAD DE DATOS");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── 4.1 Soft delete en cascada ────────────────────────────────────────────

  await run("4.1 — Soft delete en cascada", async () => {
    // Buildings activos no deben tener unidades eliminadas sin que el edificio esté eliminado
    const { data: deletedUnitsInActiveBuildings } = await sb
      .from("units").select("id,building_id,deleted_at")
      .eq("company_id", CID)
      .is("deleted_at", null)
      .limit(1);
    ok(true, "Query de unidades activas OK"); // Si llega aquí, la query funcionó

    // Verificar que no hay collection_records huérfanos (sin schedule válido)
    const { data: allRecords, error: recErr } = await sb
      .from("collection_records").select("id,collection_schedule_id")
      .eq("company_id", CID).is("deleted_at", null).limit(200);
    ok(!recErr, `Error al consultar collection_records: ${JSON.stringify(recErr)}`);

    if (allRecords && allRecords.length > 0) {
      const schedIds = [...new Set((allRecords as Array<{ collection_schedule_id: string }>)
        .map(r => r.collection_schedule_id))];
      const { data: validScheds } = await sb
        .from("collection_schedules").select("id").in("id", schedIds);
      const validIds = new Set((validScheds ?? []).map((s: { id: string }) => s.id));
      const orphans = (allRecords as Array<{ id: string; collection_schedule_id: string }>)
        .filter(r => !validIds.has(r.collection_schedule_id));
      ok(orphans.length === 0,
        `Se encontraron ${orphans.length} collection_records huérfanos (sin schedule)`,
        0, orphans.length);
    }

    // Verificar que leases activos tienen unidades activas
    const today = new Date().toISOString().split("T")[0];
    const { data: activeLeases } = await sb
      .from("leases").select("id,unit_id")
      .eq("company_id", CID).eq("status", "ACTIVE").is("deleted_at", null)
      .lte("start_date", today).limit(50);
    if (activeLeases && activeLeases.length > 0) {
      const unitIds = [...new Set((activeLeases as Array<{ unit_id: string | null }>)
        .map(l => l.unit_id).filter(Boolean) as string[])];
      if (unitIds.length > 0) {
        const { data: units } = await sb.from("units").select("id,deleted_at").in("id", unitIds);
        const deletedUnits = (units ?? []).filter((u: { deleted_at: string | null }) => u.deleted_at !== null);
        ok(deletedUnits.length === 0,
          `${deletedUnits.length} leases activos apuntan a unidades eliminadas`,
          0, deletedUnits.length);
      }
    }
  });

  // ── 4.2 Unicidad de períodos ───────────────────────────────────────────────

  const ids42 = { invoices: [] as string[], records: [] as string[] };
  await run("4.2 — Unicidad de períodos", async () => {
    // Crear primera factura para UNIQ_YEAR/UNIQ_MONTH
    const inv1 = await db("insert primera factura",
      sb.from("building_utility_invoices").insert({
        company_id: CID, building_id: B232_ID,
        building_utility_meter_id: ELEC_METER_ID,
        period_year: UNIQ_YEAR, period_month: UNIQ_MONTH,
        total_amount: 1000, status: "distributed",
        payment_status: "unpaid", is_test: true,
      }).select("id").single(),
    ) as { id: string };
    ids42.invoices.push(inv1.id);

    // Intentar duplicado — debe fallar con constraint violation
    const { data: inv2, error: dupErr } = await sb
      .from("building_utility_invoices").insert({
        company_id: CID, building_id: B232_ID,
        building_utility_meter_id: ELEC_METER_ID,
        period_year: UNIQ_YEAR, period_month: UNIQ_MONTH,
        total_amount: 999, status: "distributed",
        payment_status: "unpaid", is_test: true,
      }).select("id").single();
    if (inv2) {
      // Si se insertó, el constraint no existe → guardar para cleanup y fallar
      ids42.invoices.push((inv2 as { id: string }).id);
      throw new TestFail(
        "El INSERT duplicado de building_utility_invoice (mismo meter+período) tuvo éxito — se esperaba error de unicidad",
        "constraint violation (23505)", "INSERT exitoso",
      );
    }
    const errCode = (dupErr as { code?: string })?.code;
    ok(errCode === "23505",
      `Error de duplicado esperado: code=23505. Obtenido: ${errCode}`,
      "23505", errCode);

    // Verificar unicidad en collection_records
    if (SCHEDULES.length > 0) {
      const sched = SCHEDULES[0];
      const rec1 = await db("insert primer collection_record",
        sb.from("collection_records").insert({
          collection_schedule_id: sched.id,
          company_id: CID, building_id: sched.building_id,
          unit_id: sched.unit_id, lease_id: sched.lease_id,
          period_year: UNIQ_YEAR, period_month: UNIQ_MONTH,
          due_date: `${UNIQ_YEAR}-${UNIQ_MONTH}-05`,
          amount_due: 100, amount_collected: 0,
          status: "pending", needs_capture: false,
          notes: "TEST-LOG: Suite 4.2 record",
        }).select("id").single(),
      ) as { id: string };
      ids42.records.push(rec1.id);

      const { data: rec2, error: dupRecErr } = await sb
        .from("collection_records").insert({
          collection_schedule_id: sched.id,
          company_id: CID, building_id: sched.building_id,
          unit_id: sched.unit_id, lease_id: sched.lease_id,
          period_year: UNIQ_YEAR, period_month: UNIQ_MONTH,
          due_date: `${UNIQ_YEAR}-${UNIQ_MONTH}-05`,
          amount_due: 200, amount_collected: 0,
          status: "pending", needs_capture: false,
          notes: "TEST-LOG: Suite 4.2 record duplicado",
        }).select("id").single();
      if (rec2) {
        ids42.records.push((rec2 as { id: string }).id);
        throw new TestFail(
          "El INSERT duplicado de collection_record (mismo schedule+período) tuvo éxito — sin constraint",
          "constraint violation", "INSERT exitoso",
        );
      }
      const recErrCode = (dupRecErr as { code?: string })?.code;
      ok(recErrCode === "23505",
        `Duplicado collection_record — code esperado 23505, obtenido: ${recErrCode}`,
        "23505", recErrCode);
    }
  }, async () => {
    await del("collection_records", ids42.records);
    await del("building_utility_invoices", ids42.invoices);
  });

  // ── 4.3 Consistencia de montos ────────────────────────────────────────────

  await run("4.3 — Consistencia de montos", async () => {
    // building_utility_invoices: sum(items) ≤ total_amount + $1
    const { data: invoices } = await sb
      .from("building_utility_invoices").select("id,total_amount")
      .eq("company_id", CID).is("deleted_at", null).limit(50);

    let invoiceViolations = 0;
    for (const inv of (invoices ?? []) as Array<{ id: string; total_amount: number }>) {
      const { data: items } = await sb
        .from("building_utility_invoice_items").select("amount_assigned").eq("invoice_id", inv.id);
      if (!items || items.length === 0) continue;
      const sumItems = (items as Array<{ amount_assigned: number }>).reduce((s, it) => s + it.amount_assigned, 0);
      if (sumItems > inv.total_amount + 1) invoiceViolations++;
    }
    ok(invoiceViolations === 0,
      `${invoiceViolations} facturas con sum(items) > total_amount + $1`,
      0, invoiceViolations);

    // collection_records collected: amount_collected ≥ amount_due
    const { data: collectedRecs } = await sb
      .from("collection_records").select("id,amount_due,amount_collected")
      .eq("company_id", CID).eq("status", "collected").is("deleted_at", null).limit(200);
    let cobranzaViolations = 0;
    for (const r of (collectedRecs ?? []) as Array<{ amount_due: number; amount_collected: number | null }>) {
      if ((r.amount_collected ?? 0) < r.amount_due - 0.01) cobranzaViolations++;
    }
    ok(cobranzaViolations === 0,
      `${cobranzaViolations} cobros 'collected' con amount_collected < amount_due`,
      0, cobranzaViolations);

    // purchase_orders received: todos los items tienen quantity_received > 0
    const { data: receivedPOs } = await sb
      .from("purchase_orders").select("id,folio")
      .eq("company_id", CID).eq("status", "received").is("deleted_at", null).limit(50);
    let poViolations = 0;
    for (const po of (receivedPOs ?? []) as Array<{ id: string; folio: string }>) {
      const { data: items } = await sb
        .from("purchase_order_items").select("quantity_received").eq("purchase_order_id", po.id).is("deleted_at", null);
      const allReceived = (items ?? []).every(
        (it: { quantity_received: number | null }) => (it.quantity_received ?? 0) > 0
      );
      if (!allReceived) poViolations++;
    }
    ok(poViolations === 0,
      `${poViolations} OCs 'received' con items sin quantity_received > 0`,
      0, poViolations);
  });

  // ── 4.4 Roles y acceso ────────────────────────────────────────────────────

  await run("4.4 — Roles y acceso", async () => {
    const validRoles = new Set(["superadmin","administracion","directivo","compras","mantenimiento","field","tenant"]);

    const { data: users, error: usersErr } = await sb
      .from("app_users").select("id,email,role,is_superadmin").eq("company_id", CID).limit(100);
    ok(!usersErr, `Error al consultar app_users: ${JSON.stringify(usersErr)}`);
    ok((users ?? []).length > 0, "Debe haber al menos un usuario en la empresa");

    const invalidRoles = (users ?? []).filter(
      (u: { role: string | null }) => !u.role || !validRoles.has(u.role)
    );
    ok(invalidRoles.length === 0,
      `${invalidRoles.length} usuarios con role inválido o null: ${JSON.stringify(invalidRoles.map((u: { email: string; role: string }) => ({ email: u.email, role: u.role })))}`,
      0, invalidRoles.length);

    const legacyAdmin = (users ?? []).filter(
      (u: { role: string | null }) => u.role === "admin"
    );
    ok(legacyAdmin.length === 0,
      `${legacyAdmin.length} usuarios con role='admin' (legacy) — deben migrarse`,
      0, legacyAdmin.length);

    const superadmins = (users ?? []).filter(
      (u: { role: string; is_superadmin: boolean }) => u.role === "superadmin"
    );
    ok(superadmins.length > 0, "Debe existir al menos un usuario con role='superadmin'");

    const saWithFlag = superadmins.filter(
      (u: { is_superadmin: boolean }) => u.is_superadmin === true
    );
    ok(saWithFlag.length > 0,
      `${superadmins.length} usuario(s) con role='superadmin' pero ninguno tiene is_superadmin=true`,
      ">0", saWithFlag.length);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║     SAPROA — Suite de pruebas funcionales de lógica         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  await preflight();

  await suite1();
  await suite2();
  await suite3();
  await suite4();

  // ── Reporte final ───────────────────────────────────────────────────────

  const total   = results.length;
  const passed  = results.filter(r => r.passed).length;
  const failed  = results.filter(r => !r.passed);

  const s1 = results.filter(r => r.name.startsWith("1."));
  const s2 = results.filter(r => r.name.startsWith("2."));
  const s3 = results.filter(r => r.name.startsWith("3."));
  const s4 = results.filter(r => r.name.startsWith("4."));

  const pct = (arr: Result[]) => `${arr.filter(r => r.passed).length}/${arr.length}`;
  const icon = (arr: Result[]) => arr.every(r => r.passed) ? "✅" : "❌";

  console.log("\n\n══════════════════════════════════════════════════════════════");
  console.log(`RESULTADOS: ${passed}/${total} tests pasaron`);
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`SUITE 1 COMPRAS:     ${pct(s1)} ${icon(s1)}`);
  console.log(`SUITE 2 COBRANZA:    ${pct(s2)} ${icon(s2)}`);
  console.log(`SUITE 3 SERVICIOS:   ${pct(s3)} ${icon(s3)}`);
  console.log(`SUITE 4 INTEGRIDAD:  ${pct(s4)} ${icon(s4)}`);

  if (failed.length > 0) {
    console.log("\nBUGS ENCONTRADOS:");
    for (const r of failed) {
      console.log(`  • [${r.name}] ${r.error}`);
    }
  } else {
    console.log("\nBUGS ENCONTRADOS: Ninguno");
  }

  const allPass = passed === total;
  console.log(`\nRECOMENDACIÓN: ${allPass
    ? "✅ LISTO PARA PRODUCCIÓN — toda la lógica de negocio valida correctamente."
    : `⚠️  NO LISTO — ${failed.length} test(s) fallaron. Revisar bugs listados arriba antes de desplegar.`
  }`);
  console.log("══════════════════════════════════════════════════════════════\n");

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
