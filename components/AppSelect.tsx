"use client";

/*
  AppSelect

  Select base reutilizable para todo el sistema.
  Mantiene el mismo padding, borde y radio visual.
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
        border: "1px solid #D0D5DD",
        borderRadius: 10,
        background: "white",
        color: "#111827",
        outline: "none",
        ...style,
      }}
    >
      {children}
    </select>
  );
}
