"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { scaleIn } from "@/lib/animations";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";

/*
  Card pequeña de métricas.

  Variantes semánticas (variant): "green" | "amber" | "red" | "neutral"
  Cuando se pasa variant, el card usa bg/border/value de la paleta semántica.
  Sin variant, usa los tokens base del card.

  Theming: usa variables CSS, responde automáticamente al dark/light mode.
*/

type MetricVariant = "green" | "amber" | "red" | "neutral" | "blue";

const VARIANT_CARD_STYLE: Record<MetricVariant, React.CSSProperties> = {
  green:   { background: "var(--metric-bg-green)",   border: "1px solid var(--metric-border-green)" },
  amber:   { background: "var(--metric-bg-amber)",   border: "1px solid var(--metric-border-amber)" },
  red:     { background: "var(--metric-bg-red)",     border: "1px solid var(--metric-border-red)" },
  neutral: { background: "var(--metric-bg-neutral)", border: "1px solid var(--metric-border-neutral)" },
  blue:    { background: "var(--metric-bg-blue)",    border: "1px solid var(--metric-border-blue)" },
};

const VARIANT_VALUE_COLOR: Record<MetricVariant, string> = {
  green:   "var(--metric-value-green)",
  amber:   "var(--metric-value-amber)",
  red:     "var(--metric-value-red)",
  neutral: "var(--metric-value-neutral)",
  blue:    "var(--metric-value-blue)",
};

export default function MetricCard({
  label,
  value,
  icon,
  helper,
  variant,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  helper?: string;
  variant?: MetricVariant;
  // "blue" — vacantes / disponibles
}) {
  const cardStyle = variant ? VARIANT_CARD_STYLE[variant] : undefined;
  const valueColor = variant ? VARIANT_VALUE_COLOR[variant] : "var(--text-primary)";

  return (
    <motion.div variants={scaleIn} initial="hidden" animate="show" style={{ height: "100%" }}>
    <AppCard style={{ height: "100%", ...cardStyle }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
            {label}
          </p>
          <strong
            style={{
              fontSize: "28px",
              fontWeight: 700,
              display: "block",
              lineHeight: 1.1,
              color: valueColor,
            }}
          >
            {value}
          </strong>
          {helper ? (
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-subtle)",
                marginTop: "8px",
                marginBottom: 0,
              }}
            >
              {helper}
            </p>
          ) : null}
        </div>

        {icon ? <AppIconBox size={40} radius="var(--border-radius-md)">{icon}</AppIconBox> : null}
      </div>
    </AppCard>
    </motion.div>
  );
}
