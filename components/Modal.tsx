"use client";

import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/*
  Modal reutilizable del sistema.

  Theming: usa variables CSS para fondo, bordes y texto — responde
  automáticamente al dark/light mode.
*/

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "760px",
  maxHeight = "calc(100vh - 48px)",
  contentStyle,
  overlayStyle,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string | number;
  maxHeight?: string | number;
  contentStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 1000,
            ...overlayStyle,
          }}
        >
          <motion.div
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: "100%",
              maxWidth,
              maxHeight,
              overflowY: "auto",
              background: "var(--bg-card)",
              borderRadius: "var(--border-radius-lg)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.25))",
              padding: "24px",
              color: "var(--text-primary)",
              ...contentStyle,
            }}
          >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 700,
                marginBottom: subtitle ? "6px" : 0,
                color: "var(--text-primary)",
              }}
            >
              {title}
            </h2>
            {subtitle ? (
              <p style={{ color: "var(--text-muted)", margin: 0 }}>{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--border-default)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              borderRadius: "var(--border-radius-sm)",
              width: "40px",
              height: "40px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
