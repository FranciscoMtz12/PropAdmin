"use client";

import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import { dangerButtonStyle } from "@/lib/pageStyles";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  open,
  title,
  description,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle="Esta acción ocultará el registro del sistema pero conservará toda su información."
      onClose={onCancel}
    >
      <div style={{ display: "grid", gap: 18 }}>
        <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>
          {description}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <UiButton variant="secondary" onClick={onCancel}>
            {cancelText}
          </UiButton>

          <button type="button" onClick={onConfirm} style={dangerButtonStyle}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
