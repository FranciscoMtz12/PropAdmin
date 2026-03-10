"use client";

/*
  AppEmptyState

  Estado vacío reutilizable para listas y módulos sin registros.
  Ideal para edificios, departamentos, assets, mantenimiento y documentos.
*/

import React from "react";
import AppCard from "@/components/AppCard";
import UiButton from "@/components/UiButton";

type AppEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function AppEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: AppEmptyStateProps) {
  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div>
          <strong style={{ display: "block", fontSize: 16, marginBottom: 6 }}>
            {title}
          </strong>
          <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>{description}</p>
        </div>

        {actionLabel && onAction ? (
          <UiButton onClick={onAction} variant="primary">
            {actionLabel}
          </UiButton>
        ) : null}
      </div>
    </AppCard>
  );
}
