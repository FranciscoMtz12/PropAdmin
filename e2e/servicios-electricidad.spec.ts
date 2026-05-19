import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://prop-admin-teal.vercel.app";
const EMAIL    = "fco.mtz.c@hotmail.com";
const PASSWORD = process.env.TEST_PASSWORD!;

// Service role key for DB verification in tests (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test.describe("Servicios – Distribución Electricidad Marsella 232 Mayo 2026", () => {
  test("login y verificación de invoice_items y collection_records", async ({ page }) => {
    // ── 1. Login ──────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 20000 });
    console.log("✓ Login exitoso");

    // ── 2. Navegar a /servicios ───────────────────────────────────────
    await page.goto(`${BASE_URL}/servicios`);
    await page.waitForLoadState("networkidle");
    console.log("✓ Página /servicios cargada");

    // ── 3. Verificar que el período es Mayo 2026 ──────────────────────
    const periodText = await page.locator("text=Mayo 2026").first().textContent({ timeout: 10000 });
    expect(periodText).toContain("Mayo 2026");
    console.log("✓ Período Mayo 2026 visible");

    // ── 4. Verificar que Marsella 232 aparece con Electricidad ────────
    const marsella232 = page.locator("text=Marsella 232").first();
    await expect(marsella232).toBeVisible({ timeout: 10000 });
    console.log("✓ Edificio Marsella 232 visible");

    // Electricidad row dentro de Marsella 232
    const electricidadRow = page.locator("text=Electricidad").first();
    await expect(electricidadRow).toBeVisible({ timeout: 5000 });
    console.log("✓ Fila Electricidad visible");

    // ── 5. Verificar estado de la factura en la UI ────────────────────
    // Debe mostrar badge "Distribuida" o "Cobrada" o botón "Generar PDFs"
    const hasPdfsButton   = await page.locator("text=Generar PDFs").count() > 0;
    const hasDistribuida  = await page.locator("text=Distribuida").count() > 0;
    const hasCobrada      = await page.locator("text=Cobrada").count() > 0;
    const invoiceExists   = hasPdfsButton || hasDistribuida || hasCobrada;
    expect(invoiceExists).toBeTruthy();
    console.log(`✓ Factura existente — PDFsBtn:${hasPdfsButton} Distribuida:${hasDistribuida} Cobrada:${hasCobrada}`);

    // ── 6. Verificar DB: invoice_items existen para esta factura ──────
    const { data: items, error: itemsErr } = await supabase
      .from("building_utility_invoice_items")
      .select("id, unit_id, amount_assigned")
      .eq("invoice_id", await getInvoiceId());

    expect(itemsErr).toBeNull();
    expect((items ?? []).length).toBeGreaterThan(0);
    console.log(`✓ DB: ${items?.length} invoice_items encontrados`);

    // ── 7. Verificar DB: collection_records correctos ─────────────────
    const { data: records, error: recErr } = await supabase.rpc
      ? await supabase
          .from("collection_records")
          .select("id, unit_id, amount_due, needs_capture, status, collection_schedule_id")
          .eq("period_year", 2026)
          .eq("period_month", 5)
          .eq("needs_capture", false)
          .gt("amount_due", 0)
      : { data: [], error: null };

    expect(recErr).toBeNull();

    const marsella232Records = await getMarsella232ElectricityRecords();
    expect(marsella232Records.length).toBeGreaterThan(0);

    for (const rec of marsella232Records) {
      expect(rec.needs_capture).toBe(false);
      expect(Number(rec.amount_due)).toBeGreaterThan(0);
    }
    console.log(`✓ DB: ${marsella232Records.length} collection_records con needs_capture=false y amount_due>0`);
    console.log("Montos:", marsella232Records.map(r => `${r.unit_number}: $${r.amount_due}`).join(", "));
  });
});

async function getInvoiceId(): Promise<string> {
  const buildingId = await getMarsella232Id();
  // Find the meter for electricity in this building
  const { data: meter } = await supabase
    .from("building_utility_meters")
    .select("id")
    .eq("building_id", buildingId)
    .eq("service_type", "electricity")
    .eq("active", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!meter) return "";
  const { data } = await supabase
    .from("building_utility_invoices")
    .select("id")
    .eq("period_year", 2026)
    .eq("period_month", 5)
    .eq("building_id", buildingId)
    .eq("building_utility_meter_id", (meter as { id: string }).id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? "";
}

async function getMarsella232Id(): Promise<string> {
  const { data } = await supabase
    .from("buildings")
    .select("id")
    .eq("name", "Marsella 232")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? "";
}

async function getMarsella232ElectricityRecords() {
  const buildingId = await getMarsella232Id();
  const { data } = await supabase
    .from("collection_records")
    .select(`
      id, unit_id, amount_due, needs_capture, status,
      collection_schedule_id,
      units:unit_id(unit_number)
    `)
    .eq("period_year", 2026)
    .eq("period_month", 5)
    .is("deleted_at", null)
    .eq("building_id", buildingId);

  // Filter to electricity schedules
  const scheduleIds = (data ?? []).map((r: Record<string, unknown>) => r.collection_schedule_id as string);
  if (!scheduleIds.length) return [];

  const { data: scheds } = await supabase
    .from("collection_schedules")
    .select("id")
    .in("id", scheduleIds)
    .eq("charge_type", "electricity");

  const elecIds = new Set((scheds ?? []).map((s: { id: string }) => s.id));
  return (data ?? [])
    .filter((r: Record<string, unknown>) => elecIds.has(r.collection_schedule_id as string))
    .map((r: Record<string, unknown>) => ({
      ...r,
      unit_number: (r.units as { unit_number: string } | null)?.unit_number ?? "?",
    }));
}
