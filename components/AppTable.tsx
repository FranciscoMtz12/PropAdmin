"use client";

/*
  AppTable — tabla base reutilizable de PropAdmin.

  Theming: usa variables CSS para fondos, bordes y colores de texto,
  responde automáticamente al dark/light mode.
*/

import React from "react";

type Column<T> = {
  key: string;
  header: React.ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
  render: (row: T, rowIndex: number) => React.ReactNode;
};

type AppTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyState?: React.ReactNode;
  /** Ancho mínimo de la tabla interna. Default 720px para tablas con muchas columnas.
   *  Pasa 0 cuando la tabla vive dentro de un grid estrecho. */
  minWidth?: number;
};

export default function AppTable<T>({
  columns,
  rows,
  emptyState = "No hay datos para mostrar.",
  minWidth = 720,
}: AppTableProps<T>) {
  if (!rows.length) {
    return (
      <div
        style={{
          border: "1px dashed var(--border-dashed)",
          borderRadius: 16,
          padding: 20,
          background: "var(--bg-table-empty)",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {emptyState}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        background: "var(--bg-card)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          minWidth,
        }}
      >
        <thead>
          <tr style={{ background: "var(--bg-table-header)" }}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: column.align || "left",
                  padding: "14px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  /* var(--text-secondary): #344054 light / #CBD5E1 dark */
                  color: "var(--text-secondary)",
                  borderBottom: "1px solid var(--border-default)",
                  width: column.width,
                  whiteSpace: "nowrap",
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    padding: "14px 16px",
                    borderBottom:
                      rowIndex === rows.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    textAlign: column.align || "left",
                    fontSize: 14,
                    /* var(--text-primary): #101828 light / #F1F5F9 dark */
                    color: "var(--text-primary)",
                    verticalAlign: "top",
                  }}
                >
                  {column.render(row, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
