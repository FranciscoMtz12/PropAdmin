import type { CSSProperties, ReactNode } from "react";

/*
  AppGrid

  Grid reutilizable para cards y métricas.
  Evita repetir display:grid + auto-fit en muchas páginas.
*/

export default function AppGrid({
  children,
  minWidth = 280,
  gap = 16,
  style,
}: {
  children: ReactNode;
  minWidth?: number;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
