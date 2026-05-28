import { supabase } from "@/lib/supabaseClient"

const SIGNED_URL_EXPIRY = {
  "payment-reports":    3600,   // 1 hora
  "purchase-orders":    3600,   // 1 hora
  "maintenance-photos": 7200,   // 2 horas
  "company-assets":     86400,  // 24 horas
  "payment-proofs":     3600,   // 1 hora
  "invoices":           3600,   // 1 hora
} as const

export type StorageBucket = keyof typeof SIGNED_URL_EXPIRY

/**
 * Extrae el path de storage de una URL pública de Supabase.
 * Backward-compatible: si ya es un path relativo, lo devuelve tal cual.
 */
export function extractStoragePath(urlOrPath: string, bucket: StorageBucket): string {
  const marker = `/storage/v1/object/public/${bucket}/`
  if (urlOrPath.includes(marker)) {
    return urlOrPath.split(marker)[1]?.split("?")[0] ?? urlOrPath
  }
  return urlOrPath
}

/** Genera una signed URL temporal para un archivo en un bucket privado */
export async function getSignedUrl(
  bucket: StorageBucket,
  urlOrPath: string | null | undefined,
): Promise<string | null> {
  if (!urlOrPath) return null
  const path = extractStoragePath(urlOrPath, bucket)
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY[bucket])
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/**
 * Genera signed URLs para un array de paths/URLs en lote.
 * Devuelve Record<originalUrlOrPath, signedUrl>.
 */
export async function getSignedUrls(
  bucket: StorageBucket,
  urlsOrPaths: string[],
): Promise<Record<string, string>> {
  if (!urlsOrPaths.length) return {}
  const paths = urlsOrPaths.map(u => extractStoragePath(u, bucket))
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY[bucket])
    if (error || !data) return {}
    const result: Record<string, string> = {}
    data.forEach((item, i) => {
      if (item.signedUrl) result[urlsOrPaths[i]] = item.signedUrl
    })
    return result
  } catch {
    return {}
  }
}
