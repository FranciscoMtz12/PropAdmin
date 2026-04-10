import type { ReactNode } from "react";
import AppIconBox from "@/components/AppIconBox";

/*
  Encabezado reutilizable para páginas del sistema.

  Cambios de theming:
  - El título tiene una barra vertical izquierda de 4px con color var(--accent).
    Esto aplica automáticamente a todas las páginas sin configuración adicional.

  Props:
  - title        → texto del título
  - subtitle     → descripción opcional debajo del título
  - titleIcon    → ícono en caja a la izquierda del título
  - actions      → nodos a la derecha (botones, filtros, etc.)
*/

export default function PageHeader({
  title,
  subtitle,
  actions,
  titleIcon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  titleIcon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "20px",
        flexWrap: "wrap",
        marginBottom: "24px",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {titleIcon ? <AppIconBox size={46} radius={14}>{titleIcon}</AppIconBox> : null}

          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            {/* Barra vertical de acento a la izquierda del título */}
            <div
              style={{
                width: 4,
                alignSelf: "stretch",
                minHeight: 36,
                borderRadius: 99,
                background: "var(--accent)",
                flexShrink: 0,
                transition: "background 0.3s",
              }}
            />

            <div>
              <h1
                style={{
                  fontSize: "38px",
                  fontWeight: 700,
                  lineHeight: 1.08,
                  marginBottom: subtitle ? "8px" : 0,
                }}
              >
                {title}
              </h1>

              {subtitle ? (
                <p style={{ color: "#667085", maxWidth: "760px", margin: 0 }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {actions ? (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
