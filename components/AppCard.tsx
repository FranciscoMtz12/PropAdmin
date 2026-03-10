import type { CSSProperties, ReactNode } from "react";

/*
  AppCard

  Card base reutilizable para todo PropAdmin.
  Centraliza el estilo principal de tarjetas para evitar repetir:
  - borde
  - radio
  - fondo
  - padding

  Se puede extender con style o className cuando una vista necesite
  pequeños ajustes sin romper el lenguaje visual del sistema.
*/

export default function AppCard({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        padding: 18,
        background: "white",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
