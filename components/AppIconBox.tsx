import type { CSSProperties, ReactNode } from "react";

/*
  AppIconBox

  Caja visual reutilizable para iconos.
  La usamos para encabezados, métricas, cards y entidades como assets.
  Así evitamos repetir width/height/radius/background en todo el proyecto.
*/

export default function AppIconBox({
  children,
  size = 44,
  radius = 14,
  background = "#EEF2FF",
  color = "#4338CA",
  style,
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
  background?: string;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        color,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
