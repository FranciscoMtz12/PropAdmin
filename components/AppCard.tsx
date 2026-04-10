import type { CSSProperties, ReactNode } from "react";

/*
  AppCard — card base reutilizable de PropAdmin.

  Theming:
  - background y border usan variables CSS para responder automáticamente
    al modo claro/oscuro sin necesidad de lógica en cada componente.
  - var(--bg-card):      #ffffff en light, #1e2535 en dark
  - var(--border-default): #E2E8F0 en light, #2D3748 en dark
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
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: 18,
        background: "var(--bg-card)",
        boxShadow: "var(--shadow-card)",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
