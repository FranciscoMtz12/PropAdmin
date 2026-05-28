"use client";

/*
  AppEmptyState — estado vacío reutilizable de PropAdmin.

  Theming: usa variables CSS para colores de texto, responde
  automáticamente al dark/light mode.
*/

import React from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
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
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <motion.div variants={staggerItem}>
          <strong
            style={{
              display: "block",
              fontSize: "1rem",
              marginBottom: 6,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </strong>
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontSize: "0.875rem",
            }}
          >
            {description}
          </p>
        </motion.div>

        {actionLabel && onAction ? (
          <motion.div variants={staggerItem}>
            <UiButton onClick={onAction} variant="primary">
              {actionLabel}
            </UiButton>
          </motion.div>
        ) : null}
      </motion.div>
    </AppCard>
  );
}
