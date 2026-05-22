"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import ImpersonationSidebar from "@/components/ImpersonationSidebar";

function ImpersonationGateInner() {
  const pathname = usePathname();
  const { isRealSuperAdmin } = useImpersonation();

  if (!isRealSuperAdmin) return null;

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/portal/login" ||
    pathname === "/campo/login" ||
    pathname?.startsWith("/campo") ||
    pathname?.startsWith("/p/");

  if (isPublicRoute) return null;

  return (
    <>
      <ImpersonationSidebar />
      <div className="impersonation-sidebar-spacer" />
    </>
  );
}

export default function ImpersonationGate() {
  return (
    <Suspense fallback={null}>
      <ImpersonationGateInner />
    </Suspense>
  );
}
