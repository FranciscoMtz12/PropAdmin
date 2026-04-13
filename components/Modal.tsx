"use client";

import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

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
  if (!open) return null;

  return (
    <div
      onClick={onClose}
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
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight,
          overflowY: "auto",
          background: "var(--bg-card)",
          borderRadius: "22px",
          border: "1px solid var(--border-default)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
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
              borderRadius: "12px",
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
      </div>
    </div>
  );
}
