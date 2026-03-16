import type { CSSProperties, ReactNode } from "react";

/*
  Botón simple reutilizable para PropAdmin.

  Variants actuales:
  - primary: fondo oscuro
  - secondary: blanco con borde

  Mejoras:
  - soporte opcional para icon
  - soporte para href, onClick, type y form
  - mantiene compatibilidad con el resto del proyecto
*/

type UiButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  form?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  icon?: ReactNode;
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
}: UiButtonProps) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    border:
      variant === "primary" ? "1px solid #111827" : "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "11px 16px",
    background: variant === "primary" ? "#111827" : "white",
    color: variant === "primary" ? "white" : "#111827",
    fontWeight: 600,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
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

      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} style={style}>
        {content}
      </a>
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