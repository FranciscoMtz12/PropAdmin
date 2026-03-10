import type { ReactNode } from "react";
import AppIconBox from "@/components/AppIconBox";

/*
  Encabezado reutilizable para páginas del sistema.

  Mantiene un patrón consistente:
  - icono opcional
  - título
  - subtítulo opcional
  - acciones a la derecha
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
              <p style={{ color: "#667085", maxWidth: "760px", margin: 0 }}>{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>

      {actions ? (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>{actions}</div>
      ) : null}
    </div>
  );
}
