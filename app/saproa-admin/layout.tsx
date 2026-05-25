"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCurrentUser } from "@/contexts/UserContext";

export default function SaproaAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { isRealSuperAdmin } = useImpersonation();

  useEffect(() => {
    if (loading) return;
    if (!user || !isRealSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, user, isRealSuperAdmin, router]);

  if (loading) return null;
  if (!user || !isRealSuperAdmin) return null;

  return <>{children}</>;
}
