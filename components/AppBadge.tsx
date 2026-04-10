import type { CSSProperties, ReactNode } from "react";

/*
  AppBadge

  Badge base del sistema. Soporta variantes semánticas que usan las
  variables CSS de la paleta light/dark automáticamente, o colores
  personalizados para casos especiales.

  Variantes semánticas: "green" | "amber" | "red" | "blue" | "gray"
  Si no se pasa variant, se usan las props backgroundColor/textColor/borderColor.
*/

type BadgeVariant = "green" | "amber" | "red" | "blue" | "gray";

const VARIANT_STYLES: Record<BadgeVariant, CSSProperties> = {
  green: {
    background: "var(--badge-bg-green)",
    color: "var(--badge-text-green)",
    border: "1px solid var(--badge-bg-green)",
  },
  amber: {
    background: "var(--badge-bg-amber)",
    color: "var(--badge-text-amber)",
    border: "1px solid var(--badge-bg-amber)",
  },
  red: {
    background: "var(--badge-bg-red)",
    color: "var(--badge-text-red)",
    border: "1px solid var(--badge-bg-red)",
  },
  blue: {
    background: "var(--badge-bg-blue)",
    color: "var(--badge-text-blue)",
    border: "1px solid var(--badge-bg-blue)",
  },
  gray: {
    background: "var(--badge-bg-gray)",
    color: "var(--badge-text-gray)",
    border: "1px solid var(--badge-bg-gray)",
  },
};

export default function AppBadge({
  children,
  variant,
  backgroundColor = "var(--badge-bg-gray)",
  textColor = "var(--badge-text-gray)",
  borderColor,
  style,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  style?: CSSProperties;
}) {
  const variantStyle = variant ? VARIANT_STYLES[variant] : undefined;

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
        lineHeight: 1,
        background: backgroundColor,
        color: textColor,
        border: borderColor ? `1px solid ${borderColor}` : `1px solid ${backgroundColor}`,
        ...variantStyle,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
