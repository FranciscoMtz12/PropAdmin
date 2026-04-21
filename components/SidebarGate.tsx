"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BgTexture from "@/components/BgTexture";

export default function SidebarGate() {
  const pathname = usePathname();
  if (!pathname) return null;

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/portal/login" ||
    pathname === "/campo/login" ||
    pathname.startsWith("/campo");

  if (isPublicRoute) return null;

  return (
    <>
      <BgTexture />
      <Sidebar />
    </>
  );
}
