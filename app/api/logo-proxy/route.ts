import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extractBucketAndPath(url: string): { bucket: string; path: string } | null {
  // Handles: /storage/v1/object/public/<bucket>/<path> and signed variants
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?.*)?$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  // Only allow Supabase Storage URLs to prevent open-redirect/SSRF
  if (!url.includes(".supabase.co/storage/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const info = extractBucketAndPath(url);
  if (!info) return new NextResponse("Invalid storage URL", { status: 400 });

  try {
    // Use supabaseAdmin (service role) so this works for both public and private buckets
    const { data, error } = await supabaseAdmin.storage
      .from(info.bucket)
      .download(info.path);

    if (error || !data) return new NextResponse("Not found", { status: 404 });

    const buffer = await data.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": data.type || "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
