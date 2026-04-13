"use client";

/*
  AppSelect

  Select base reutilizable para todo el sistema.
  Theming: usa variables CSS para fondo, borde y texto — responde
  automáticamente al dark/light mode.
*/

import React from "react";

type AppSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode;
};

export default function AppSelect({ children, style, ...props }: AppSelectProps) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: 12,
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        outline: "none",
        ...style,
      }}
    >
      {children}
    </select>
  );
}
