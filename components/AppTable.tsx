"use client";

/*
  AppTable

  Tabla base reutilizable para PropAdmin.

  Objetivo:
  - evitar repetir tablas en edificios, assets, pagos y mantenimiento
  - mantener el mismo estilo visual en todo el sistema
  - permitir renderizar celdas simples o contenido custom
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
};

export default function AppTable<T>({
  columns,
  rows,
  emptyState = "No hay datos para mostrar.",
}: AppTableProps<T>) {
  if (!rows.length) {
    return (
      <div
        style={{
          border: "1px dashed #D0D5DD",
          borderRadius: 16,
          padding: 20,
          background: "#FCFCFD",
          color: "#667085",
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
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        background: "white",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          minWidth: 720,
        }}
      >
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: column.align || "left",
                  padding: "14px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#344054",
                  borderBottom: "1px solid #E5E7EB",
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
                      rowIndex === rows.length - 1 ? "none" : "1px solid #F2F4F7",
                    textAlign: column.align || "left",
                    fontSize: 14,
                    color: "#101828",
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
