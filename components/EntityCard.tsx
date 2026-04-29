"use client";

import type { CSSProperties, ReactNode } from "react";
import AppCard from "./AppCard";

export interface EntityMetric {
  label: string;
  value: string | number;
  color?: string;
}

interface EntityCardProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  metrics?: EntityMetric[];
  statusIndicator?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export default function EntityCard({
  title,
  subtitle,
  badge,
  metrics,
  statusIndicator,
  actions,
  onClick,
  children,
  style,
  className,
}: EntityCardProps) {
  const hasBottom = !!(metrics?.length) || !!actions;

  const card = (
    <AppCard style={{ padding: 16, ...style }} className={className}>
      {/* Top: info (flex:1) + status indicator (flexShrink:0) */}
      <div
        className="building-card-top"
        style={{ display: "flex", alignItems: "flex-start", gap: 12, overflow: "hidden", marginBottom: 10 }}
      >
        <div className="building-card-info" style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: subtitle !== undefined ? 4 : badge ? 8 : 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </p>
          {subtitle !== undefined && (
            <p
              className="building-card-addr"
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginBottom: badge ? 8 : 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </p>
          )}
          {badge}
        </div>
        {statusIndicator && <div style={{ flexShrink: 0 }}>{statusIndicator}</div>}
      </div>

      {children}

      {hasBottom && (
        <div style={{ height: "0.5px", background: "var(--border-default)", margin: "10px 0" }} />
      )}

      {hasBottom && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", gap: 20 }}>
            {metrics?.map((m) => (
              <div key={m.label} style={{ textAlign: "center" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: m.color ?? "var(--text-primary)", lineHeight: 1 }}>
                  {m.value}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
          {actions && (
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      )}
    </AppCard>
  );

  if (onClick) {
    return (
      <div onClick={onClick} style={{ cursor: "pointer" }}>
        {card}
      </div>
    );
  }
  return card;
}
