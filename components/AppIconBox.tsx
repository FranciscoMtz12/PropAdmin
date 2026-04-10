import type { CSSProperties, ReactNode } from "react";

/*
  AppIconBox

  Caja visual reutilizable para iconos.
  Soporta variantes semánticas que usan variables CSS de la paleta
  light/dark automáticamente.

  Variantes: "neutral" | "green" | "amber" | "red" | "blue" | "purple"
  Si no se pasa variant, se usan las props background/color.
*/

type IconVariant = "neutral" | "green" | "amber" | "red" | "blue" | "purple";

const VARIANT_STYLES: Record<IconVariant, CSSProperties> = {
  neutral: {
    background: "var(--icon-bg-neutral)",
    color: "var(--icon-color-neutral)",
  },
  green: {
    background: "var(--icon-bg-green)",
    color: "var(--icon-color-green)",
  },
  amber: {
    background: "var(--icon-bg-amber)",
    color: "var(--icon-color-amber)",
  },
  red: {
    background: "var(--icon-bg-red)",
    color: "var(--icon-color-red)",
  },
  blue: {
    background: "var(--icon-bg-blue)",
    color: "var(--icon-color-blue)",
  },
  purple: {
    background: "var(--icon-bg-purple)",
    color: "var(--icon-color-purple)",
  },
};

export default function AppIconBox({
  children,
  size = 44,
  radius = 14,
  variant,
  background = "var(--icon-bg-neutral)",
  color = "var(--icon-color-neutral)",
  style,
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
  variant?: IconVariant;
  background?: string;
  color?: string;
  style?: CSSProperties;
}) {
  const variantStyle = variant ? VARIANT_STYLES[variant] : undefined;

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
        ...variantStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
