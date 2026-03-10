import type { ReactNode } from "react";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";

/*
  Card base del sistema para secciones, formularios y listas.
  Ahora también soporta:
  - icono de sección
  - acción en el header

  Internamente usa AppCard y AppIconBox para evitar repetir estilos.
*/

export default function SectionCard({
  children,
  title,
  subtitle,
  icon,
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <AppCard style={{ padding: 24, borderRadius: 18 }}>
      {title ? (
        <div
          style={{
            marginBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            {icon ? <AppIconBox size={40} radius={12} background="#F5F7FF" color="#4338CA">{icon}</AppIconBox> : null}

            <div>
              <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: subtitle ? "6px" : 0 }}>
                {title}
              </h2>
              {subtitle ? <p style={{ color: "#667085", margin: 0 }}>{subtitle}</p> : null}
            </div>
          </div>

          {action ? <div>{action}</div> : null}
        </div>
      ) : null}

      {children}
    </AppCard>
  );
}
