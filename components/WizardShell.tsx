"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { slideStep } from "@/lib/animations";

interface WizardStep {
  label: string;
}

interface WizardShellProps {
  open: boolean;
  title: string;
  steps: WizardStep[];
  currentStep: number; // 1-based
  stepDir: "left" | "right";
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  onFinish: () => void;
  finalLabel?: string;
  loading?: boolean;
  children: ReactNode;
  /** "create" (default) keeps existing linear flow. "edit" makes steps clickable + shows save footer. */
  mode?: "create" | "edit";
  /** Called when the user clicks "Guardar cambios" in edit mode. */
  onSave?: () => void;
  /** Called when the user clicks a step circle in edit mode. */
  onStepChange?: (step: number) => void;
}

function Stepper({
  steps,
  currentStep,
  mode,
  onStepChange,
}: {
  steps: WizardStep[];
  currentStep: number;
  mode: "create" | "edit";
  onStepChange?: (step: number) => void;
}) {
  const isEdit = mode === "edit";
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0,
          marginBottom: isEdit ? 6 : 28,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {steps.map((s, i) => {
          const n = i + 1;
          const done = currentStep > n;
          const active = currentStep === n;
          const isLast = i === steps.length - 1;
          const circleBase: React.CSSProperties = {
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8125rem",
            fontWeight: 700,
            background: done || active ? "var(--accent)" : "var(--bg-input)",
            color: done || active ? "#fff" : "var(--text-muted)",
            border: done || active ? "none" : "1px solid var(--border-default)",
            transition: "background 0.2s",
            flexShrink: 0,
          };
          return (
            <div
              key={n}
              style={{ display: "flex", alignItems: "flex-start", flex: isLast ? "none" : 1 }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                {isEdit && onStepChange ? (
                  <button
                    type="button"
                    onClick={() => onStepChange(n)}
                    style={{ ...circleBase, cursor: "pointer", outline: "none", padding: 0 }}
                  >
                    {done ? <Check size={13} /> : n}
                  </button>
                ) : (
                  <div style={circleBase}>
                    {done ? <Check size={13} /> : n}
                  </div>
                )}
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  {s.label}
                </span>
              </div>

              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: done ? "var(--accent)" : "var(--border-default)",
                    margin: "13px 6px 0",
                    transition: "background 0.2s",
                    minWidth: 20,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {isEdit && (
        <p
          style={{
            fontSize: "0.6875rem",
            color: "var(--text-muted)",
            marginBottom: 20,
            marginTop: 2,
          }}
        >
          Modo edición — puedes navegar entre pasos libremente
        </p>
      )}
    </div>
  );
}

export default function WizardShell({
  open,
  title,
  steps,
  currentStep,
  stepDir,
  onNext,
  onBack,
  onCancel,
  onFinish,
  finalLabel = "Crear",
  loading = false,
  children,
  mode = "create",
  onSave,
  onStepChange,
}: WizardShellProps) {
  const isFirst = currentStep === 1;
  const isLast = currentStep === steps.length;
  const isEdit = mode === "edit";

  return (
    <Modal open={open} title={title} onClose={onCancel} maxWidth={920}>
      <Stepper
        steps={steps}
        currentStep={currentStep}
        mode={mode}
        onStepChange={onStepChange}
      />

      <div style={{ overflowX: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={slideStep(stepDir)}
            initial="hidden"
            animate="show"
            exit="hidden"
            style={{ minHeight: 260 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 28,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {isEdit ? (
          <>
            <UiButton type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              Cerrar
            </UiButton>
            <UiButton type="button" variant="primary" onClick={onSave} disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </UiButton>
          </>
        ) : (
          <>
            <div>
              {!isFirst && (
                <UiButton type="button" variant="secondary" onClick={onBack} disabled={loading}>
                  ← Atrás
                </UiButton>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <UiButton type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                Cancelar
              </UiButton>
              {isLast ? (
                <UiButton
                  type="button"
                  variant="primary"
                  onClick={onFinish}
                  disabled={loading}
                >
                  {loading ? "Creando..." : finalLabel}
                </UiButton>
              ) : (
                <UiButton type="button" variant="primary" onClick={onNext}>
                  Siguiente →
                </UiButton>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
