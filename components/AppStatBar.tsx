"use client";

/*
  AppStatBar

  Barra visual para mostrar progreso o composición.
  Theming: usa variables CSS — responde al dark/light mode automáticamente.
*/

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
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-xl)",
        padding: 18,
        background: "var(--bg-card)",
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
        <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{title}</strong>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {totalLabel || `Total: ${total}`}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          height: 12,
          borderRadius: "var(--border-radius-full, 999px)",
          overflow: "hidden",
          background: "var(--divider)",
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
                borderRadius: "var(--border-radius-full, 999px)",
                background: segment.color,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {segment.label}: <strong style={{ color: "var(--text-primary)" }}>{segment.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
