"use client";
import type { CSSProperties } from "react";

interface MetricItem {
  value: string | number;
  label: string;
  color?: "default" | "success" | "danger" | "warning" | "info";
}

interface MetricCirclesProps {
  metrics: MetricItem[];
}

const COLOR_MAP: Record<NonNullable<MetricItem["color"]>, string> = {
  default: "var(--text-primary)",
  success: "var(--metric-value-green)",
  danger:  "var(--metric-value-red)",
  warning: "var(--metric-value-amber)",
  info:    "var(--metric-value-blue)",
};

function computeRows(n: number): number[] {
  if (n <= 6) return [n];
  if (n === 7) return [4, 3];
  if (n === 8) return [4, 4];
  if (n === 9) return [5, 4];
  if (n === 10) return [5, 5];
  if (n === 11) return [6, 5];
  return [6, Math.min(n - 6, 6)];
}

export default function MetricCircles({ metrics }: MetricCirclesProps) {
  const items = metrics.slice(0, 12);
  const rows = computeRows(items.length);

  let offset = 0;
  const numFs = "calc((100vw - 32px) / 6 * 0.27)";
  const lblFs = "calc((100vw - 32px) / 6 * 0.13)";

  const circleStyle: CSSProperties = {
    aspectRatio: "1",
    borderRadius: "50%",
    background: "var(--bg-card)",
    border: "1.5px solid var(--border-default)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    minWidth: 0,
  };

  return (
    <div
      className="metric-circles-mobile-only"
      style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}
    >
      {rows.map((rowSize, ri) => {
        const rowItems = items.slice(offset, offset + rowSize);
        offset += rowSize;
        const isSmaller = ri > 0 && rowSize < rows[0];
        const widthPct = isSmaller ? `${(rowSize / rows[0]) * 100}%` : "100%";
        return (
          <div
            key={ri}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${rowSize}, minmax(0, 1fr))`,
              gap: 6,
              width: widthPct,
              ...(isSmaller ? { marginLeft: "auto", marginRight: "auto" } : {}),
            }}
          >
            {rowItems.map((m, i) => (
              <div key={i} style={circleStyle}>
                <span
                  style={{
                    fontSize: numFs,
                    fontWeight: 600,
                    lineHeight: 1.1,
                    color: COLOR_MAP[m.color ?? "default"],
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.value}
                </span>
                <span
                  style={{
                    fontSize: lblFs,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "90%",
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
