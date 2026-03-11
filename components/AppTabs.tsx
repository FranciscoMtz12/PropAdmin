"use client";

import type { ReactNode } from "react";

/*
  Tabs horizontales reutilizables para PropAdmin.

  Este componente se usa en varias vistas del sistema y actualmente
  hay páginas que lo llaman con:
  - items={...}
  - tabs={...}

  Para no romper rutas ni vistas existentes, este archivo acepta ambas
  props y normaliza internamente a una sola lista.
*/

type TabItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};

type AppTabsProps = {
  items?: TabItem[];
  tabs?: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

export default function AppTabs({
  items,
  tabs,
  activeKey,
  onChange,
}: AppTabsProps) {
  const normalizedTabs = items ?? tabs ?? [];

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        borderBottom: "1px solid #E5E7EB",
        paddingBottom: "6px",
        overflowX: "auto",
      }}
    >
      {normalizedTabs.map((item) => {
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
              border: isActive
                ? "1px solid #C7D7FE"
                : "1px solid #E5E7EB",
              background: isActive ? "#EEF4FF" : "white",
              color: isActive ? "#1D4ED8" : "#344054",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {item.icon ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 0,
                }}
              >
                {item.icon}
              </span>
            ) : null}

            <span>{item.label}</span>

            {typeof item.count === "number" ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 22,
                  height: 22,
                  padding: "0 8px",
                  borderRadius: 999,
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