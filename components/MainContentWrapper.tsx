"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import GroupBanner from "@/components/GroupBanner";

/*
  MainContentWrapper — envuelve el contenido principal del sistema.

  Para rutas /campo/* entrega los children directamente (sin maxWidth ni padding)
  para que el portal de campo ocupe el 100% del viewport.

  Para todas las demás rutas aplica el contenedor centrado estándar.
*/

function useScrollPreservation(pathname: string | null) {
  const prevPath = useRef<string | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevPath.current;

    if (prev && prev !== pathname) {
      sessionStorage.setItem(`scroll:${prev}`, String(window.scrollY));
    }

    prevPath.current = pathname;

    const saved = pathname ? sessionStorage.getItem(`scroll:${pathname}`) : null;
    if (saved) {
      const y = parseInt(saved, 10);
      requestAnimationFrame(() => { window.scrollTo({ top: y, behavior: "instant" }); });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    const handleScroll = () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        if (pathname) sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
      }, 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [pathname]);
}

export default function MainContentWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useScrollPreservation(pathname);

  if (
    pathname?.startsWith("/campo") ||
    pathname?.startsWith("/p/") ||
    pathname?.startsWith("/saproa-admin/design-system")
  ) {
    return <>{children}</>;
  }

  return (
    <div
      className="main-content-wrapper"
      style={{
        width: "100%",
        maxWidth: 1280,
        padding: "24px 32px 40px",
        boxSizing: "border-box",
      }}
    >
      <ImpersonationBanner />
      <GroupBanner />
      {children}
    </div>
  );
}
