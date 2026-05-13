import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  // Only allow Supabase Storage URLs to prevent open-redirect/SSRF
  if (!url.includes(".supabase.co/storage/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return new NextResponse("Upstream error", { status: upstream.status });
    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
