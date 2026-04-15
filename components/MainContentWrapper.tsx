"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/*
  MainContentWrapper — envuelve el contenido principal del sistema.

  Para rutas /campo/* entrega los children directamente (sin maxWidth ni padding)
  para que el portal de campo ocupe el 100% del viewport.

  Para todas las demás rutas aplica el contenedor centrado estándar.
*/

export default function MainContentWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/campo")) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1280,
        padding: "24px 32px 40px",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
