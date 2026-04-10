"use client";

/*
  AppShell — contenedor principal del layout con soporte de theming.

  Es un client component porque necesita leer isDark desde ThemeContext
  para aplicar el fondo correcto. El layout raíz (server component) lo
  importa y lo usa como wrapper del área de contenido.
*/

import type { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--bg-page)",
        color: "var(--text-primary)",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      {children}
    </div>
  );
}
