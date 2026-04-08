"use client";

import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";

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
  confirmText = "Archivar",
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
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#475467" }}>
          {description}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <UiButton variant="secondary" onClick={onCancel}>
            {cancelText}
          </UiButton>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #DC2626",
              borderRadius: 12,
              padding: "11px 16px",
              background: "#DC2626",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}