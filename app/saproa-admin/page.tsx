"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SaproaAdminRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/saproa-admin/overview");
  }, [router]);
  return null;
}
