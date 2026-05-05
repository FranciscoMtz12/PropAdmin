import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSignedBillUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("utility-invoices")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function getSignedUtilityReadingUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("utility-readings")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
