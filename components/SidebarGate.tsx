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
import BgTexture from "@/components/BgTexture";

/* Rutas donde el Sidebar y la textura no deben mostrarse. */
const HIDDEN_PATHS = new Set(["/", "/login", "/portal/login"]);

export default function SidebarGate() {
  const pathname = usePathname();
  if (!pathname) return null;
  const isHidden = HIDDEN_PATHS.has(pathname);
  return (
    <>
      {!isHidden && <BgTexture />}
      {!isHidden && <Sidebar />}
    </>
  );
}
