"use client";

/*
  SidebarGate — wrapper cliente que decide si mostrar el Sidebar global.

  Motivo: app/layout.tsx es Server Component (exporta metadata), así que
  no puede usar usePathname directamente. Este gate se monta en el layout
  y oculta el Sidebar en rutas donde no debe aparecer (la landing `/` y
  pantallas de login).
*/

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

/* Rutas donde el Sidebar no debe mostrarse. */
const HIDDEN_PATHS = new Set(["/", "/login", "/portal/login"]);

export default function SidebarGate() {
  const pathname = usePathname();
  if (!pathname) return null;
  if (HIDDEN_PATHS.has(pathname)) return null;
  return <Sidebar />;
}
