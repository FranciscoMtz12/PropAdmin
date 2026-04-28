import type { ReactNode } from "react";

/*
  Contenedor principal reutilizable.

  Mantiene el contenido visualmente centrado dentro del shell global.
  No aplica colores propios — hereda los CSS vars del tema activo.
*/

export default function PageContainer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="page-container"
      style={{
        padding: "24px 32px 40px 32px",
      }}
    >
      {children}
    </div>
  );
}
