"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BgTexture from "@/components/BgTexture";

export default function SidebarGate() {
  const pathname = usePathname();
  if (!pathname) return null;

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/portal/login" ||
    pathname === "/campo/login" ||
    pathname.startsWith("/campo") ||
    pathname.startsWith("/p/");

  if (isPublicRoute) return null;

  return (
    <>
      <BgTexture />
      <Sidebar />
      {/* Spacer que ocupa el espacio del sidebar fijo en el flex row */}
      <div className="sidebar-spacer" />
    </>
  );
}
