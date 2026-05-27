"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import {
  type PurchaseReturnReason,
  type PurchaseReturnType,
  RETURN_REASON_LABEL,
} from "@/lib/types";

type POItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number | null;
  quantity_received?: number | null;
};

type ReturnableOC = {
  id: string;
  folio: string;
  supplier_name?: string;
  ticket_number?: string | null;
  company_id?: string;
  parent_order_id?: string | null;
  maintenance_log_id?: string | null;
  supplier_id?: string;
  supplier_branch_id?: string | null;
  building_id?: string | null;
  responsible_name?: string | null;
  responsible_phone?: string | null;
  responsible_user_id?: string | null;
  signer_name?: string | null;
  supplier_prefix?: string | null;
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
  const [type, setType]     = useState<PurchaseReturnType>("return");
  const [reason, setReason] = useState<PurchaseReturnReason | "">("");
  const [notes, setNotes]   = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleClose() {
    if (isSubmitting) return;
    setReturnedQuantities({});
    setType("return");
    setReason("");
    setNotes("");
    onClose();
  }

  async function handleSubmit() {
    if (!reason) { toast.error("Selecciona un motivo."); return; }

    const hasQty = items.some((it) => Number(returnedQuantities[it.id] || 0) > 0);
    if (!hasQty) {
      toast.error(type === "exchange" ? "Debes especificar al menos un artículo a cambiar." : "Ingresa al menos una cantidad a devolver.");
      return;
    }

    for (const it of items) {
      const qty    = Number(returnedQuantities[it.id] || 0);
      const maxQty = Number(it.quantity_received ?? 0);
      if (qty > maxQty) {
        toast.error(`No puedes devolver más de lo recibido en "${it.description}"`);
        return;
      }
    }

    if (type === "exchange" && (!oc.company_id || !oc.supplier_id)) {
      toast.error("Datos de la OC incompletos para registrar cambio.");
      return;
    }

    setIsSubmitting(true);
    try {
      let replacementOrderId: string | null = null;

      if (type === "exchange") {
        const rootFolio      = oc.folio.replace(/-V\d+$/, "");
        const versionPattern = `${rootFolio}-V%`;

        const { data: existingVersions } = await supabase
          .from("purchase_orders")
          .select("folio")
          .eq("company_id", oc.company_id!)
          .ilike("folio", versionPattern)
          .is("deleted_at", null);

        let maxVersion = 1;
        ((existingVersions ?? []) as { folio: string }[]).forEach((row) => {
          const match = row.folio.match(/-V(\d+)$/);
          if (match) {
            const v = parseInt(match[1], 10);
            if (v > maxVersion) maxVersion = v;
          }
        });
        const newFolio      = `${rootFolio}-V${maxVersion + 1}`;
        const parentOrderId = oc.parent_order_id ?? oc.id;
        const nowIso        = new Date().toISOString();

        const { data: newOrder, error: ocErr } = await supabase
          .from("purchase_orders")
          .insert({
            company_id:          oc.company_id,
            folio:               newFolio,
            maintenance_log_id:  oc.maintenance_log_id ?? null,
            supplier_id:         oc.supplier_id,
            supplier_branch_id:  oc.supplier_branch_id ?? null,
            building_id:         oc.building_id ?? null,
            status:              "sent",
            parent_order_id:     parentOrderId,
            version_type:        "exchange",
            project_description: `Cambio de ${oc.folio}`,
            responsible_name:    oc.responsible_name ?? null,
            responsible_phone:   oc.responsible_phone ?? null,
            responsible_user_id: oc.responsible_user_id ?? null,
            signer_name:         oc.signer_name ?? null,
            supplier_prefix:     oc.supplier_prefix ?? null,
            sent_at:             nowIso,
            created_at:          nowIso,
            updated_at:          nowIso,
          })
          .select("id")
          .single();
        if (ocErr) throw ocErr;

        replacementOrderId = (newOrder as { id: string }).id;

        const versionItems = items
          .filter((it) => Number(returnedQuantities[it.id] || 0) > 0)
          .map((it) => ({
            purchase_order_id: replacementOrderId!,
            description:       it.description,
            quantity:          Number(returnedQuantities[it.id]),
            unit:              it.unit,
            unit_price:        it.unit_price ?? null,
          }));

        const { error: viErr } = await supabase
          .from("purchase_order_items")
          .insert(versionItems);
        if (viErr) throw viErr;
      }

      const { data: returnRow, error: retErr } = await supabase
        .from("purchase_returns")
        .insert({
          company_id:           oc.company_id,
          purchase_order_id:    oc.id,
          type,
          reason,
          reason_notes:         notes.trim() || null,
          replacement_order_id: replacementOrderId,
        })
        .select()
        .single();
      if (retErr) throw retErr;

      const itemsToInsert = items
        .filter((it) => Number(returnedQuantities[it.id] || 0) > 0)
        .map((it) => ({
          return_id:              (returnRow as { id: string }).id,
          purchase_order_item_id: it.id,
          quantity_returned:      Number(returnedQuantities[it.id]),
        }));

      const { error: itemsErr } = await supabase
        .from("purchase_return_items")
        .insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      toast.success(type === "exchange" ? "Cambio registrado. OC enviada a campo." : "Devolución registrada.");
      onSuccess();
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar el movimiento";
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
    padding: "8px 6px", fontSize: "0.8125rem", color: "var(--text-primary)",
    borderBottom: "1px solid var(--border-default)",
  };

  const colHeader = type === "exchange" ? "A cambiar" : "A devolver";

  return (
    <Modal open={isOpen} onClose={handleClose} title="Cambios y devoluciones" subtitle={subtitle} maxWidth="640px">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Tipo de movimiento */}
        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Tipo de movimiento *
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setType("return")}
              style={{
                padding: 12, borderRadius: "var(--border-radius-md)", cursor: "pointer", textAlign: "left",
                border: type === "return" ? "2px solid #c2410c" : "1px solid var(--border-default)",
                background: type === "return" ? "#fff7ed" : "var(--bg-input)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: type === "return" ? "#c2410c" : "var(--text-primary)" }}>
                ↩ Devolución
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Regreso definitivo, no espero reposición
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType("exchange")}
              style={{
                padding: 12, borderRadius: "var(--border-radius-md)", cursor: "pointer", textAlign: "left",
                border: type === "exchange" ? "2px solid var(--metric-value-blue)" : "1px solid var(--border-default)",
                background: type === "exchange" ? "var(--metric-bg-blue)" : "var(--bg-input)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: type === "exchange" ? "var(--metric-value-blue)" : "var(--text-primary)" }}>
                🔄 Cambio
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                El proveedor me repondrá los mismos artículos
              </div>
            </button>
          </div>
        </div>

        {/* Tabla de items */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {type === "exchange" ? "Artículos a cambiar" : "Items a devolver"}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                  {["#", "Descripción", "Recibido", colHeader, "Unidad"].map((h) => (
                    <th key={h} style={{ ...tdStyle, fontWeight: 700, color: "var(--text-secondary)", textAlign: h === colHeader || h === "Recibido" ? "right" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const maxQty    = Number(it.quantity_received ?? 0);
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
                            width: 80, padding: "4px 8px", borderRadius: "var(--border-radius-sm)",
                            border: "1px solid var(--border-default)",
                            background: noRecibido ? "var(--bg-page)" : "var(--bg-input)",
                            color: noRecibido ? "var(--text-muted)" : "var(--text-primary)",
                            fontSize: "0.8125rem", textAlign: "right",
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
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Motivo *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as PurchaseReturnReason)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem" }}
          >
            <option value="">Seleccionar motivo...</option>
            {(Object.entries(RETURN_REASON_LABEL) as [PurchaseReturnReason, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Notas */}
        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Descripción adicional..."
            style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical", boxSizing: "border-box" }}
          />
          <p style={{ margin: "4px 0 0", fontSize: "0.6875rem", color: "var(--text-muted)", textAlign: "right" }}>{notes.length}/500</p>
        </div>

        {/* Aviso de cambio */}
        {type === "exchange" ? (
          <div style={{
            padding: "10px 14px", borderRadius: "var(--border-radius-md)",
            background: "var(--metric-bg-blue)", border: "1px solid #93c5fd",
            fontSize: "0.8125rem", color: "var(--metric-value-blue)",
          }}>
            Se creará automáticamente una OC de cambio ya enviada a campo. El responsable verá un aviso indicando que debe entregar el material al proveedor al recoger el reemplazo.
          </div>
        ) : null}

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
              padding: "11px 16px", borderRadius: "var(--border-radius-lg)",
              border:      type === "exchange" ? "1px solid var(--metric-value-blue)" : "1px solid #c2410c",
              background:  type === "exchange" ? "var(--metric-value-blue)"          : "#c2410c",
              color: "#fff",
              fontSize: "0.875rem", fontWeight: 700,
              cursor:  isSubmitting ? "wait"    : "pointer",
              opacity: isSubmitting ? 0.7       : 1,
            }}
          >
            {isSubmitting ? "Registrando..." : type === "exchange" ? "Registrar cambio" : "Registrar devolución"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
