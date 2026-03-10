import type { ReactNode } from "react";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";

/*
  Card pequeña de métricas.
  Soporta icono y un texto auxiliar para mantener
  consistencia visual en dashboards y vistas de resumen.
*/

export default function MetricCard({
  label,
  value,
  icon,
  helper,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  helper?: string;
}) {
  return (
    <AppCard>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "13px", color: "#667085", marginBottom: "8px" }}>{label}</p>
          <strong style={{ fontSize: "28px", fontWeight: 700, display: "block", lineHeight: 1.1 }}>{value}</strong>
          {helper ? <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "8px", marginBottom: 0 }}>{helper}</p> : null}
        </div>

        {icon ? <AppIconBox size={40} radius={12}>{icon}</AppIconBox> : null}
      </div>
    </AppCard>
  );
}
