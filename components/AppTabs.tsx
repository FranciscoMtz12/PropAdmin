"use client";

/*
  AppTabs

  Tabs horizontales reutilizables para secciones tipo:
  - detalle de edificio
  - detalle de departamento
  - assets / mantenimiento / historial

  Mantienen una navegación visual limpia sin tener que repetir estilos.
*/

import React from "react";

type TabItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
};

type AppTabsProps = {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

export default function AppTabs({ items, activeKey, onChange }: AppTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 999,
              border: isActive ? "1px solid #C7D7FE" : "1px solid #E5E7EB",
              background: isActive ? "#EEF4FF" : "white",
              color: isActive ? "#1D4ED8" : "#344054",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  padding: "0 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isActive ? "#DCE7FF" : "#F2F4F7",
                  color: isActive ? "#1D4ED8" : "#475467",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
