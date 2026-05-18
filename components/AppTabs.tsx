"use client";

import type { CSSProperties, ReactNode } from "react";

/*
  Tabs horizontales reutilizables para PropAdmin.

  Acepta tanto items= como tabs= y normaliza internamente.
  Theming: usa variables CSS para responder al dark/light mode.
*/

type TabItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  notifDot?: { count: number; color: string };
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
      className="app-tabs-container"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        borderBottom: "1px solid var(--border-default)",
        paddingBottom: "6px",
      } as CSSProperties}
    >
      {normalizedTabs.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            className="app-tab-item"
            onClick={() => onChange(item.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 999,
              border: isActive
                ? "1px solid var(--accent)"
                : "1px solid var(--border-default)",
              background: isActive ? "var(--accent)" : "var(--bg-card)",
              color: isActive ? "#ffffff" : "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              minWidth: "fit-content",
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
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
                  background: isActive ? "rgba(255,255,255,0.25)" : "var(--divider)",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {item.count}
              </span>
            ) : null}

            {item.notifDot ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "transparent",
                  border: `1.5px solid ${item.notifDot.color}`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: item.notifDot.color,
                  lineHeight: 1,
                }}
              >
                {item.notifDot.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
