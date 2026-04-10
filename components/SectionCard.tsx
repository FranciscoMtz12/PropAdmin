import type { ReactNode } from "react";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";

/*
  Card base del sistema para secciones, formularios y listas.

  Theming: usa variables CSS para títulos y subtítulos, por lo que
  responde automáticamente al dark/light mode sin lógica extra.
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
            {icon ? (
              <AppIconBox size={40} radius={12} variant="neutral">
                {icon}
              </AppIconBox>
            ) : null}

            <div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: subtitle ? "4px" : 0,
                  /* var(--text-primary) → #101828 light / #F1F5F9 dark */
                  color: "var(--text-primary)",
                }}
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  style={{
                    /* var(--text-muted) → #667085 light / #94A3B8 dark */
                    color: "var(--text-muted)",
                    margin: 0,
                    fontSize: 14,
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {action ? <div>{action}</div> : null}
        </div>
      ) : null}

      {children}
    </AppCard>
  );
}
