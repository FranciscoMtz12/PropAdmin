"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import AppIconBox from "@/components/AppIconBox";
import { useTheme } from "@/contexts/ThemeContext";
import { useIconSize } from "@/lib/useFontScale";

/*
  Encabezado reutilizable para páginas del sistema.

  Cambios de theming:
  - El título tiene una barra vertical izquierda de 4px con color var(--accent).
    Esto aplica automáticamente a todas las páginas sin configuración adicional.
  - El subtitle respeta la preferencia showDescriptions del ThemeContext.

  Props:
  - title        → texto del título
  - subtitle     → descripción opcional debajo del título
  - titleIcon    → ícono en caja a la izquierda del título
  - actions      → nodos a la derecha (botones, filtros, etc.)
*/

export default function PageHeader({
  title,
  subtitle,
  actions,
  titleIcon,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleIcon?: ReactNode;
}) {
  const { showDescriptions } = useTheme();
  const iconBoxSz = useIconSize(46);

  return (
    <div
      className="ph-root"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "20px",
        flexWrap: "wrap",
        marginBottom: "24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {titleIcon ? <AppIconBox size={iconBoxSz} radius="var(--border-radius-lg)">{titleIcon}</AppIconBox> : null}

          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            {/* Barra vertical de acento a la izquierda del título */}
            <div
              style={{
                width: 4,
                alignSelf: "stretch",
                minHeight: 36,
                borderRadius: "var(--border-radius-full, 999px)",
                background: "var(--accent)",
                flexShrink: 0,
                transition: "background 0.3s",
              }}
            />

            <div>
              <h1
                className="ph-title"
                style={{
                  fontSize: "2.375rem",
                  fontWeight: 700,
                  lineHeight: 1.08,
                  marginBottom: subtitle && showDescriptions ? "8px" : 0,
                }}
              >
                {title}
              </h1>

              {subtitle && showDescriptions ? (
                <p style={{ color: "var(--text-muted)", maxWidth: "760px", margin: 0 }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      {actions ? (
        <div className="ph-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
