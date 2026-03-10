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
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <Modal onClose={onCancel}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-red-600">{title}</h3>

        <p className="text-sm text-gray-600">{description}</p>

        <div className="flex justify-end gap-3 pt-2">
          <UiButton variant="secondary" onClick={onCancel}>
            {cancelText}
          </UiButton>

          <UiButton variant="danger" onClick={onConfirm}>
            {confirmText}
          </UiButton>
        </div>
      </div>
    </Modal>
  );
}