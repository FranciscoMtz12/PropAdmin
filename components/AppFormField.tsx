"use client";

/*
  AppFormField

  Wrapper reutilizable para campos de formulario en todo PropAdmin.
  Theming: usa variables CSS — responde al dark/light mode automáticamente.
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
          color: "var(--text-primary)",
        }}
      >
        {label}
        {required ? <span style={{ color: "var(--badge-text-red)" }}> *</span> : null}
      </label>

      {children}

      {helperText ? (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 12,
            color: "var(--text-muted)",
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
            color: "var(--badge-text-red)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
