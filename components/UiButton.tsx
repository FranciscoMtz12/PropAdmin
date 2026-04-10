import type { CSSProperties, ReactNode } from "react";

/*
  Botón reutilizable de PropAdmin.

  Variants:
  - primary   → usa var(--accent) como fondo (color de marca de la empresa)
  - secondary → blanco con borde gris neutro

  El variant "primary" se usa en botones de acción principal:
  "+ Nuevo", "Guardar", "Confirmar", etc.
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
      variant === "primary"
        ? "1px solid var(--accent)"
        : "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "11px 16px",
    /* Primary usa el color de acento de la empresa */
    background: variant === "primary" ? "var(--accent)" : "white",
    color: variant === "primary" ? "white" : "#111827",
    fontWeight: 600,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    transition: "opacity 0.15s",
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
