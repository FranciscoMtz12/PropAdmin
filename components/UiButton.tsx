import type { CSSProperties, ReactNode } from "react";

/*
  Botón simple reutilizable.

  variant:
  - primary: fondo oscuro
  - secondary: blanco con borde
*/

export default function UiButton({
  children,
  href,
  onClick,
  type = "button",
  variant = "secondary",
  disabled = false,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    border: variant === "primary" ? "1px solid #111827" : "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "11px 16px",
    background: variant === "primary" ? "#111827" : "white",
    color: variant === "primary" ? "white" : "#111827",
    fontWeight: 600,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };

  if (href) {
    return (
      <a href={href} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}
