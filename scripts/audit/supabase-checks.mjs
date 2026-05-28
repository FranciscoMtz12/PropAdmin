/**
 * Supabase data integrity checks — SELECT only, no modifications
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://mremgbneyztpbojwgwcc.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc0NDczMCwiZXhwIjoyMDg4MzIwNzMwfQ.-XxZ6dLFR1ZtQg39J-0YDoaJavZk33n_lNiPXQCzH2k";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runChecks() {
  const results = {};

  // E. INTEGRIDAD DE DATOS
  console.log("\n[E] Data Integrity Checks...");

  // Unit types without company_id
  const { count: unitTypesNoCompany, error: e1 } = await supabase
    .from("unit_types")
    .select("id", { count: "exact", head: true })
    .is("company_id", null);
  results.unitTypesNoCompany = { count: unitTypesNoCompany, error: e1?.message };
  console.log(`  unit_types without company_id: ${unitTypesNoCompany}`);

  // Collection records with amount_due <= 0
  const { count: badCollections, error: e2 } = await supabase
    .from("collection_records")
    .select("*", { count: "exact", head: true })
    .lte("amount_due", 0)
    .is("deleted_at", null);
  results.badCollections = { count: badCollections, error: e2?.message };
  console.log(`  collection_records with amount_due <= 0: ${badCollections}`);

  // Duplicate folios in purchase_orders
  const { data: allOrders } = await supabase
    .from("purchase_orders")
    .select("folio")
    .is("deleted_at", null);
  const folioCounts = {};
  (allOrders || []).forEach(o => { if(o.folio) folioCounts[o.folio] = (folioCounts[o.folio] || 0) + 1; });
  const dupeFolios = Object.entries(folioCounts).filter(([,c]) => c > 1).map(([f,c]) => ({ folio: f, count: c }));
  results.dupeFolios = dupeFolios;
  console.log(`  Duplicate purchase_order folios: ${dupeFolios.length}`);

  // F. STORAGE — check buckets
  console.log("\n[F] Storage Buckets...");
  const { data: buckets, error: e5 } = await supabase.storage.listBuckets();
  results.buckets = buckets?.map(b => ({
    id: b.id,
    name: b.name,
    public: b.public,
    file_size_limit: b.file_size_limit,
  }));
  console.log("  Buckets:", JSON.stringify(results.buckets, null, 2));

  results.utilityReadingsBucket = buckets?.find(b => b.name === "utility-readings") || null;
  console.log(`  utility-readings bucket exists: ${!!results.utilityReadingsBucket}`);

  const publicBuckets = buckets?.filter(b => b.public) || [];
  console.log(`  Public buckets: ${publicBuckets.map(b => b.name).join(", ")}`);
  results.publicBuckets = publicBuckets.map(b => b.name);

  // G. Check roles/permission system
  console.log("\n[G] Permission/Roles system...");
  const { data: allUsers } = await supabase
    .from("app_users")
    .select("role, is_superadmin");
  const roleCounts = {};
  (allUsers || []).forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1; });
  results.roleCounts = roleCounts;
  console.log("  Role distribution:", JSON.stringify(roleCounts));

  // Check companies table
  const { data: companiesData } = await supabase
    .from("companies")
    .select("id, short_name, brand_color, accent_style")
    .limit(10);
  results.companies = companiesData;
  console.log(`  Companies count sample: ${companiesData?.length}`);

  // Check user_preferences table structure
  const { data: prefSample } = await supabase
    .from("user_preferences")
    .select("user_id, dark_mode, ui_theme, show_descriptions")
    .limit(5);
  results.userPrefSample = prefSample;
  console.log(`  user_preferences sample: ${JSON.stringify(prefSample?.slice(0,2))}`);

  // Save results
  writeFileSync(join(__dirname, "supabase-results.json"), JSON.stringify(results, null, 2));
  console.log("\n✓ Supabase results written");
  return results;
}

runChecks().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
