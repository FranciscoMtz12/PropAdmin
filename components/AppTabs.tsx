"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";

/*
  Tabs horizontales reutilizables para PropAdmin.

  Acepta tanto items= como tabs= y normaliza internamente.
  Theming: usa variables CSS para responder al dark/light mode.
*/

export function AppTabPanel({ activeKey, children }: { activeKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={activeKey} variants={fadeIn} initial="hidden" animate="show">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

type TabItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  notifDot?: { count: number; color: string };
  pendingDot?: boolean;
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
          <span key={item.key} style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="app-tab-item"
              onClick={() => onChange(item.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: "var(--border-radius-md)",
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
                    borderRadius: "var(--border-radius-full, 999px)",
                    background: isActive ? "rgba(255,255,255,0.25)" : "var(--divider)",
                    color: isActive ? "#ffffff" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {item.count}
                </span>
              ) : null}
            </button>

            {item.notifDot ? (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: item.notifDot.count > 1 ? 20 : 18,
                  height: item.notifDot.count > 1 ? 20 : 18,
                  padding: item.notifDot.count > 1 ? "0 4px" : 0,
                  borderRadius: "var(--border-radius-full, 999px)",
                  background: item.notifDot.color,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              >
                {item.notifDot.count > 1 ? item.notifDot.count : null}
              </span>
            ) : null}

            {item.pendingDot && !item.notifDot ? (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--brand-color, #8B2252)",
                  border: "2px solid var(--color-background-primary)",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
