"use client";

/*
  AppFormField

  Wrapper reutilizable para campos de formulario en todo PropAdmin.

  Beneficios:
  - evita repetir label + spacing + helper + error
  - mantiene consistencia visual en modales y formularios
  - funciona con input, select, textarea o cualquier child
*/

import React from "react";

type AppFormFieldProps = {
  label: string;
  children: React.ReactNode;
  helperText?: string;
  error?: string;
  required?: boolean;
};

export default function AppFormField({
  label,
  children,
  helperText,
  error,
  required = false,
}: AppFormFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          marginBottom: 8,
          fontSize: 14,
          fontWeight: 600,
          color: "#111827",
        }}
      >
        {label}
        {required ? <span style={{ color: "#DC2626" }}> *</span> : null}
      </label>

      {children}

      {helperText ? (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 12,
            color: "#667085",
          }}
        >
          {helperText}
        </p>
      ) : null}

      {error ? (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 12,
            fontWeight: 600,
            color: "#DC2626",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
