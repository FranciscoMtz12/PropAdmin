import type { CSSProperties, ReactNode } from "react";

/*
  AppBadge

  Badge base del sistema.
  Permite reutilizar el mismo patrón visual para:
  - categorías
  - estados
  - subcategorías
  - pills informativas
*/

export default function AppBadge({
  children,
  backgroundColor = "#F3F4F6",
  textColor = "#374151",
  borderColor = "#E5E7EB",
  style,
}: {
  children: ReactNode;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        background: backgroundColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
