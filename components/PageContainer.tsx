import type { ReactNode } from "react";

/*
  Contenedor principal reutilizable.

  Mantiene el contenido visualmente centrado dentro del shell global.
  Esto ayuda a que todas las páginas se sientan consistentes, aunque
  cada módulo todavía tenga componentes internos propios.
*/

export default function PageContainer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "24px 32px 40px 32px",
        color: "#0F172A",
      }}
    >
      {children}
    </div>
  );
}
