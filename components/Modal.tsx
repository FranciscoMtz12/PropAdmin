"use client";

import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

/*
  Modal reutilizable del sistema.

  Lo usamos para que acciones como crear o editar no dominen
  visualmente la página si el usuario todavía no quiere abrirlas.
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
        background: "rgba(15, 23, 42, 0.45)",
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
          background: "white",
          borderRadius: "22px",
          border: "1px solid #E5E7EB",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.16)",
          padding: "24px",
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
            <h2 style={{ fontSize: "28px", fontWeight: 700, marginBottom: subtitle ? "6px" : 0 }}>
              {title}
            </h2>
            {subtitle ? <p style={{ color: "#667085", margin: 0 }}>{subtitle}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #E5E7EB",
              background: "white",
              borderRadius: "12px",
              width: "40px",
              height: "40px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
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
