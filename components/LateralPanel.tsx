"use client";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface LateralPanelItem {
  key: string;
  label: string;
  headerLabel?: string;
  Icon: React.ElementType;
  count: number;
  countLabel?: string;
}

interface LateralPanelProps {
  items: LateralPanelItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  renderContent: (key: string) => ReactNode;
  height?: number;
  emptyText?: string;
  rightPanelRef?: RefObject<HTMLDivElement | null>;
}

export default function LateralPanel({
  items,
  selectedKey,
  onSelect,
  renderContent,
  height = 560,
  emptyText = "Selecciona un elemento para configurar.",
  rightPanelRef,
}: LateralPanelProps) {
  const activeItem = items.find((p) => p.key === selectedKey);

  return (
    <div
      style={{
        display: "flex",
        height,
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Panel izquierdo — lista */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid var(--border-default)",
          overflowY: "hidden",
          background: "var(--bg-page)",
        }}
      >
        {items.map((item) => {
          const active = item.key === selectedKey;
          const ItemIcon = item.Icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                width: "100%",
                padding: "7px 14px",
                border: "none",
                borderLeft: active
                  ? "3px solid var(--accent)"
                  : "3px solid transparent",
                background: active ? "var(--accent-tint-soft)" : "transparent",
                cursor: "pointer",
                transition: "background 0.12s",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <ItemIcon
                  size={15}
                  color={active ? "var(--accent)" : "var(--text-muted)"}
                />
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--accent)" : "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </span>
              </div>
              {item.count > 0 && (
                <span
                  style={{
                    flexShrink: 0,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: active
                      ? "var(--accent-tint-medium)"
                      : "var(--bg-input)",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
        {items.length === 0 && (
          <div
            style={{ padding: 16, fontSize: "0.75rem", color: "var(--text-muted)" }}
          >
            Sin espacios configurados.
          </div>
        )}
      </div>

      {/* Panel derecho — contenido */}
      <div
        ref={rightPanelRef}
        className="no-scrollbar"
        style={{ flex: 1, overflowY: "auto" }}
      >
        <AnimatePresence mode="wait">
          {activeItem ? (
            <motion.div
              key={selectedKey}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--border-default)",
                  position: "sticky",
                  top: 0,
                  background: "var(--bg-card)",
                  zIndex: 1,
                }}
              >
                <activeItem.Icon size={18} color="var(--accent)" />
                <span
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {activeItem.headerLabel ?? activeItem.label}
                </span>
                {activeItem.count > 0 && (
                  <span
                    style={{
                      padding: "2px 9px",
                      borderRadius: 999,
                      background: "var(--accent-tint-soft)",
                      color: "var(--accent)",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                    }}
                  >
                    {activeItem.key === "aireCentral"
                      ? `${activeItem.count} espacio${activeItem.count !== 1 ? "s" : ""}`
                      : `${activeItem.count} ${activeItem.countLabel ?? "equipo"}${activeItem.count !== 1 ? "s" : ""}`}
                  </span>
                )}
              </div>
              <div style={{ padding: "16px 20px" }}>
                {renderContent(selectedKey)}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                padding: 24,
                fontSize: "0.8125rem",
                color: "var(--text-muted)",
              }}
            >
              {emptyText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
