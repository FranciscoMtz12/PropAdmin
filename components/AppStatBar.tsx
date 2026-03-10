"use client";

/*
  AppStatBar

  Barra visual para mostrar progreso o composición.

  Casos de uso:
  - ocupación de edificio
  - pagos cobrados vs pendientes
  - mantenimiento completado vs programado
  - assets activos vs en revisión
*/

import React from "react";

type Segment = {
  label: string;
  value: number;
  color: string;
};

type AppStatBarProps = {
  title: string;
  totalLabel?: string;
  segments: Segment[];
};

export default function AppStatBar({
  title,
  totalLabel,
  segments,
}: AppStatBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        padding: 18,
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <strong style={{ fontSize: 15, color: "#101828" }}>{title}</strong>
        <span style={{ fontSize: 13, color: "#667085" }}>
          {totalLabel || `Total: ${total}`}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          height: 12,
          borderRadius: 999,
          overflow: "hidden",
          background: "#F2F4F7",
          marginBottom: 14,
        }}
      >
        {segments.map((segment) => {
          const width = total > 0 ? `${(segment.value / total) * 100}%` : "0%";

          return (
            <div
              key={segment.label}
              style={{
                width,
                background: segment.color,
                transition: "width 200ms ease",
              }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: segment.color,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "#475467" }}>
              {segment.label}: <strong style={{ color: "#101828" }}>{segment.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
