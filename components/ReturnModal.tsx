"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import {
  type PurchaseReturnReason,
  RETURN_REASON_LABEL,
} from "@/lib/types";

type POItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  quantity_received?: number | null;
};

type ReturnableOC = {
  id: string;
  folio: string;
  supplier_name?: string;
  ticket_number?: string | null;
  company_id?: string;
};

type Props = {
  oc: ReturnableOC;
  items: POItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ReturnModal({ oc, items, isOpen, onClose, onSuccess }: Props) {
  const [returnedQuantities, setReturnedQuantities] = useState<Record<string, string>>({});
  const [reason, setReason]   = useState<PurchaseReturnReason | "">("");
  const [notes, setNotes]     = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleClose() {
    if (isSubmitting) return;
    setReturnedQuantities({});
    setReason("");
    setNotes("");
    onClose();
  }

  async function handleSubmit() {
    if (!reason) { toast.error("Selecciona un motivo."); return; }

    const hasQty = items.some((it) => Number(returnedQuantities[it.id] || 0) > 0);
    if (!hasQty) { toast.error("Ingresa al menos una cantidad a devolver."); return; }

    for (const it of items) {
      const qty = Number(returnedQuantities[it.id] || 0);
      const maxQty = Number(it.quantity_received ?? 0);
      if (qty > maxQty) {
        toast.error(`No puedes devolver más de lo recibido en "${it.description}"`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data: returnRow, error: retErr } = await supabase
        .from("purchase_returns")
        .insert({
          company_id:        oc.company_id,
          purchase_order_id: oc.id,
          reason,
          reason_notes:      notes.trim() || null,
        })
        .select()
        .single();
      if (retErr) throw retErr;

      const itemsToInsert = items
        .filter((it) => Number(returnedQuantities[it.id] || 0) > 0)
        .map((it) => ({
          return_id:               (returnRow as { id: string }).id,
          purchase_order_item_id:  it.id,
          quantity_returned:       Number(returnedQuantities[it.id]),
        }));

      const { error: itemsErr } = await supabase
        .from("purchase_return_items")
        .insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      toast.success("Devolución registrada");
      onSuccess();
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar la devolución";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const subtitle = [
    oc.folio,
    oc.supplier_name,
    oc.ticket_number ? `Ticket MT-${oc.ticket_number}` : null,
  ].filter(Boolean).join(" · ");

  const tdStyle: React.CSSProperties = {
    padding: "8px 6px", fontSize: 13, color: "var(--text-primary)",
    borderBottom: "1px solid var(--border-default)",
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title="Registrar devolución" subtitle={subtitle} maxWidth="620px">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Tabla de items */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Items a devolver
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                  {["#", "Descripción", "Recibido", "A devolver", "Unidad"].map((h) => (
                    <th key={h} style={{ ...tdStyle, fontWeight: 700, color: "var(--text-secondary)", textAlign: h === "A devolver" || h === "Recibido" ? "right" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const maxQty = Number(it.quantity_received ?? 0);
                  const noRecibido = maxQty === 0;
                  return (
                    <tr key={it.id}>
                      <td style={{ ...tdStyle, color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td style={tdStyle}>{it.description}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{maxQty}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <input
                          type="number"
                          min={0}
                          max={maxQty}
                          step="any"
                          disabled={noRecibido}
                          value={returnedQuantities[it.id] ?? ""}
                          onChange={(e) => setReturnedQuantities((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          title={noRecibido ? "Sin material recibido" : undefined}
                          style={{
                            width: 80, padding: "4px 8px", borderRadius: 6,
                            border: "1px solid var(--border-default)",
                            background: noRecibido ? "var(--bg-page)" : "var(--bg-input)",
                            color: noRecibido ? "var(--text-muted)" : "var(--text-primary)",
                            fontSize: 13, textAlign: "right",
                          }}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)" }}>{it.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Motivo *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as PurchaseReturnReason)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
          >
            <option value="">Seleccionar motivo...</option>
            {(Object.entries(RETURN_REASON_LABEL) as [PurchaseReturnReason, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Notas */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Descripción adicional..."
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
          />
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{notes.length}/500</p>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border-default)" }}>
          <UiButton type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </UiButton>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 16px", borderRadius: 12,
              border: "1px solid #c2410c", background: "#c2410c", color: "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: isSubmitting ? "wait" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Registrando..." : "Registrar devolución"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
