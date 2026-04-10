"use client";

/*
  AppEmptyState — estado vacío reutilizable de PropAdmin.

  Theming: usa variables CSS para colores de texto, responde
  automáticamente al dark/light mode.
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
          <strong
            style={{
              display: "block",
              fontSize: 16,
              marginBottom: 6,
              /* var(--text-primary): #101828 light / #F1F5F9 dark */
              color: "var(--text-primary)",
            }}
          >
            {title}
          </strong>
          <p
            style={{
              margin: 0,
              /* var(--text-muted): #667085 light / #94A3B8 dark */
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            {description}
          </p>
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
