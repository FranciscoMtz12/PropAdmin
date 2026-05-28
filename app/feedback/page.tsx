"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FeedbackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/saproa-admin/feedback");
  }, [router]);
  return null;
}
