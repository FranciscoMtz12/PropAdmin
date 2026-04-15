"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CampoRootPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/campo/dashboard"); }, [router]);
  return null;
}
