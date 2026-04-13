"use client";

/*
  AppShell — contenedor principal del layout.

  Usa variables CSS para el fondo y texto — responde automáticamente
  cuando ThemeContext agrega/quita la clase .dark en <html>.
  No necesita leer isDark directamente.
*/

import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
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
