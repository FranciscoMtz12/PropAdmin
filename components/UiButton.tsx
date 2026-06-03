import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/*
  Botón reutilizable de PropAdmin.

  Variants:
  - primary   → usa var(--accent) como fondo (color de marca de la empresa)
  - secondary → blanco con borde gris neutro
  - ghost     → sin fondo, sin borde, texto secundario (para Cancelar en wizards)

  El variant "primary" se usa en botones de acción principal:
  "+ Nuevo", "Guardar", "Confirmar", etc.
*/

type UiButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  form?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  icon?: ReactNode;
  style?: CSSProperties;
};

export default function UiButton({
  children,
  href,
  onClick,
  type = "button",
  form,
  variant = "secondary",
  disabled = false,
  icon,
  style: styleProp,
}: UiButtonProps) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    border: variant === "primary"
      ? "1px solid var(--accent)"
      : variant === "ghost"
      ? "none"
      : "1px solid var(--border-default)",
    borderRadius: "var(--border-radius-sm)",
    padding: "11px 16px",
    background: variant === "primary" ? "var(--btn-primary-bg)" : variant === "ghost" ? "transparent" : "var(--bg-card)",
    color: variant === "primary" ? "#ffffff" : variant === "ghost" ? "var(--text-secondary)" : "var(--text-primary)",
    fontWeight: 600,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    transition: "opacity 0.15s",
    ...styleProp,
  };

  const content = (
    <>
      {icon ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          }}
        >
          {icon}
        </span>
      ) : null}
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      style={style}
      disabled={disabled}
    >
      {content}
    </button>
  );
}
