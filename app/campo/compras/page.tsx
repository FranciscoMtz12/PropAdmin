"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { type PurchaseReturnReason, RETURN_REASON_LABEL } from "@/lib/types";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";

/* ── Types ──────────────────────────────────────────────────────── */

type POCampoItem = {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: number;
  unit: string;
};

type POCampo = {
  id: string;
  folio: string;
  supplier_id: string;
  supplier_branch_id: string | null;
  supplier_prefix: string | null;
  building_id: string | null;
  maintenance_log_id: string | null;
  parent_order_id: string | null;
  version_type: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  created_at: string;
  supplier_name: string;
  branch_name: string | null;
  building_name: string | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  signer_name: string | null;
};

type ItemReception = {
  itemId: string;
  description: string;
  quantity: number;
  unit: string;
  faltaAlgo: boolean;
  cuantoFalto: string;
};

type ExchangeCtx = {
  reason: PurchaseReturnReason;
  reason_notes: string | null;
  items: Array<{ quantity_returned: number; description: string; unit: string }>;
};

/* ── Component ──────────────────────────────────────────────────── */

export default function CampoComprasPage() {
  const { user, loading } = useCurrentUser();

  const [orders, setOrders] = useState<POCampo[]>([]);
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, POCampoItem[]>>({});
  const [exchangeCtx, setExchangeCtx] = useState<Record<string, ExchangeCtx>>({});
  const [loadingData, setLoadingData] = useState(true);

  const [receptionOrder, setReceptionOrder] = useState<POCampo | null>(null);
  const [receptionItems, setReceptionItems] = useState<ItemReception[]>([]);
  const [savingReception, setSavingReception] = useState(false);

  useEffect(() => {
    if (!loading && user?.id) void loadData(user.id);
  }, [loading, user]);

  async function loadData(userId: string) {
    setLoadingData(true);

    const { data: ocRaw, error } = await supabase
      .from("purchase_orders")
      .select(`
        id, folio, supplier_id, supplier_branch_id, supplier_prefix,
        building_id, maintenance_log_id, parent_order_id, version_type, pdf_url, sent_at, created_at,
        responsible_user_id, responsible_name, responsible_phone, signer_name,
        suppliers(id, name),
        buildings(id, name)
      `)
      .eq("responsible_user_id", userId)
      .eq("status", "sent")
      .is("deleted_at", null)
      .order("sent_at", { ascending: false });

    if (error) {
      toast.error("No se pudieron cargar las órdenes.");
      setLoadingData(false);
      return;
    }

    const ocList = (ocRaw ?? []) as unknown as Array<{
      id: string; folio: string; supplier_id: string;
      supplier_branch_id: string | null; supplier_prefix: string | null;
      building_id: string | null; maintenance_log_id: string | null;
      parent_order_id: string | null; version_type: string | null;
      pdf_url: string | null; sent_at: string | null; created_at: string;
      responsible_user_id: string | null; responsible_name: string | null;
      responsible_phone: string | null; signer_name: string | null;
      suppliers: { name: string } | null;
      buildings: { name: string } | null;
    }>;
    const orderIds = ocList.map((o) => o.id);

    let allItems: POCampoItem[] = [];
    if (orderIds.length > 0) {
      const { data: itemData } = await supabase
        .from("purchase_order_items")
        .select("id, purchase_order_id, description, quantity, unit")
        .in("purchase_order_id", orderIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      allItems = (itemData ?? []) as POCampoItem[];
    }

    const branchIds = ocList
      .map((o) => o.supplier_branch_id)
      .filter(Boolean) as string[];
    const branchMap: Record<string, string> = {};
    if (branchIds.length > 0) {
      const { data: branchData } = await supabase
        .from("supplier_branches")
        .select("id, name")
        .in("id", branchIds);
      ((branchData ?? []) as { id: string; name: string }[]).forEach((b) => {
        branchMap[b.id] = b.name;
      });
    }

    const mapped: POCampo[] = ocList.map((o) => ({
      id: o.id,
      folio: o.folio,
      supplier_id: o.supplier_id,
      supplier_branch_id: o.supplier_branch_id ?? null,
      supplier_prefix: o.supplier_prefix ?? null,
      building_id: o.building_id ?? null,
      maintenance_log_id: o.maintenance_log_id ?? null,
      parent_order_id: o.parent_order_id ?? null,
      version_type:    o.version_type ?? null,
      pdf_url: o.pdf_url ?? null,
      sent_at: o.sent_at ?? null,
      created_at: o.created_at,
      supplier_name: o.suppliers?.name ?? "—",
      branch_name: o.supplier_branch_id ? (branchMap[o.supplier_branch_id] ?? null) : null,
      building_name: o.buildings?.name ?? null,
      responsible_user_id: o.responsible_user_id ?? null,
      responsible_name: o.responsible_name ?? null,
      responsible_phone: o.responsible_phone ?? null,
      signer_name: o.signer_name ?? null,
    }));

    const itemsMap: Record<string, POCampoItem[]> = {};
    allItems.forEach((it) => {
      if (!itemsMap[it.purchase_order_id]) itemsMap[it.purchase_order_id] = [];
      itemsMap[it.purchase_order_id].push(it);
    });

    setOrders(mapped);
    setItemsByOrderId(itemsMap);

    /* Cargar contexto de cambio para OCs de tipo exchange */
    const exchangeIds = mapped.filter((o) => o.version_type === "exchange").map((o) => o.id);
    if (exchangeIds.length > 0) {
      const { data: retData } = await supabase
        .from("purchase_returns")
        .select("replacement_order_id, reason, reason_notes, items:purchase_return_items(quantity_returned, purchase_order_item_id)")
        .in("replacement_order_id", exchangeIds)
        .is("deleted_at", null);

      type RetRow = { replacement_order_id: string; reason: string; reason_notes: string | null; items: Array<{ quantity_returned: number; purchase_order_item_id: string }> };
      const retRows = (retData ?? []) as unknown as RetRow[];

      if (retRows.length > 0) {
        const allPoiIds = retRows.flatMap((r) => r.items.map((i) => i.purchase_order_item_id));
        const descMap: Record<string, { description: string; unit: string }> = {};
        if (allPoiIds.length > 0) {
          const { data: poiData } = await supabase
            .from("purchase_order_items")
            .select("id, description, unit")
            .in("id", allPoiIds);
          ((poiData ?? []) as { id: string; description: string; unit: string }[]).forEach((poi) => {
            descMap[poi.id] = { description: poi.description, unit: poi.unit };
          });
        }
        const ctxMap: Record<string, ExchangeCtx> = {};
        retRows.forEach((r) => {
          ctxMap[r.replacement_order_id] = {
            reason:       r.reason as PurchaseReturnReason,
            reason_notes: r.reason_notes,
            items: r.items
              .filter((i) => descMap[i.purchase_order_item_id])
              .map((i) => ({
                quantity_returned: i.quantity_returned,
                description:       descMap[i.purchase_order_item_id]!.description,
                unit:              descMap[i.purchase_order_item_id]!.unit,
              })),
          };
        });
        setExchangeCtx(ctxMap);
      }
    }

    setLoadingData(false);
  }

  function openReceptionModal(order: POCampo) {
    const items = itemsByOrderId[order.id] ?? [];
    setReceptionItems(
      items.map((it) => ({
        itemId: it.id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        faltaAlgo: false,
        cuantoFalto: "",
      }))
    );
    setReceptionOrder(order);
  }

  function closeReceptionModal() {
    if (!savingReception) setReceptionOrder(null);
  }

  async function completeParentChain(orderId: string): Promise<void> {
    const { data: row } = await supabase
      .from("purchase_orders")
      .select("parent_order_id")
      .eq("id", orderId)
      .single();
    const parentId = (row as { parent_order_id: string | null } | null)?.parent_order_id;
    if (!parentId) return;
    const nowIso = new Date().toISOString();
    await supabase
      .from("purchase_orders")
      .update({ status: "received", received_at: nowIso, updated_at: nowIso })
      .eq("id", parentId)
      .neq("status", "received");
    await completeParentChain(parentId);
  }

  async function confirmReception() {
    if (!receptionOrder || !user?.company_id) return;

    for (const item of receptionItems) {
      if (item.faltaAlgo) {
        const v = parseFloat(item.cuantoFalto);
        if (!isFinite(v) || v <= 0 || v > item.quantity) {
          toast.error(`Cantidad faltante inválida para: ${item.description}`);
          return;
        }
      }
    }

    setSavingReception(true);
    const nowIso = new Date().toISOString();

    const itemUpdates = receptionItems.map((item) => {
      const faltante = item.faltaAlgo ? parseFloat(item.cuantoFalto) : 0;
      return {
        id: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        quantity_received: item.quantity - faltante,
        faltante,
        hasFaltante: item.faltaAlgo,
      };
    });

    for (const upd of itemUpdates) {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ quantity_received: upd.quantity_received })
        .eq("id", upd.id);
      if (error) {
        toast.error("Error al guardar recepción.");
        setSavingReception(false);
        return;
      }
    }

    const anyFaltante = itemUpdates.some((u) => u.hasFaltante);
    const newStatus = anyFaltante ? "partial" : "received";
    const ocPatch: Record<string, unknown> = { status: newStatus, updated_at: nowIso };
    if (!anyFaltante) ocPatch.received_at = nowIso;

    const { error: ocErr } = await supabase
      .from("purchase_orders")
      .update(ocPatch)
      .eq("id", receptionOrder.id);

    if (ocErr) {
      toast.error("Error al actualizar la orden.");
      setSavingReception(false);
      return;
    }

    /* Cascada de completado hacia la madre — solo si recepción total */
    if (!anyFaltante) {
      await completeParentChain(receptionOrder.id);
    }

    if (anyFaltante) {
      const faltanteItems = itemUpdates.filter((u) => u.hasFaltante);

      /* Calcular folio versionado: raíz-V{n+1} */
      const rootFolio = receptionOrder.folio.replace(/-V\d+$/, "");
      const versionPattern = `${rootFolio}-V%`;
      const { data: existingVersions } = await supabase
        .from("purchase_orders")
        .select("folio")
        .eq("company_id", user.company_id)
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
      const newFolio = `${rootFolio}-V${maxVersion + 1}`;
      const parentOrderId = receptionOrder.parent_order_id ?? receptionOrder.id;

      const { data: newOC, error: newOCErr } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: user.company_id,
          folio: newFolio,
          supplier_id: receptionOrder.supplier_id,
          supplier_branch_id: receptionOrder.supplier_branch_id,
          supplier_prefix: receptionOrder.supplier_prefix,
          maintenance_log_id: receptionOrder.maintenance_log_id,
          building_id: receptionOrder.building_id,
          status: "draft",
          project_description: `Reposición de faltantes de ${receptionOrder.folio}`,
          responsible_user_id: receptionOrder.responsible_user_id,
          responsible_name: receptionOrder.responsible_name,
          responsible_phone: receptionOrder.responsible_phone,
          signer_name: receptionOrder.signer_name,
          parent_order_id: parentOrderId,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();

      if (!newOCErr && newOC) {
        await supabase.from("purchase_order_items").insert(
          faltanteItems.map((fi) => ({
            purchase_order_id: (newOC as { id: string }).id,
            description: fi.description,
            quantity: fi.faltante,
            unit: fi.unit,
            created_at: nowIso,
          }))
        );
      }
    }

    const orderId = receptionOrder.id;
    toast.success(
      anyFaltante
        ? "Recepción parcial registrada. Se creó un borrador por faltantes en Compras."
        : "Recepción completa registrada."
    );
    setReceptionOrder(null);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setSavingReception(false);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* ── Styles ─────────────────────────────────────────────────────── */

  const containerStyle: CSSProperties = {
    padding: "20px 16px 40px",
    maxWidth: 600,
    margin: "0 auto",
    width: "100%",
  };

  const cardStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: 16,
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      {/* Encabezado */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
          Órdenes de Compra
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          OCs asignadas a ti pendientes de surtir
        </p>
      </div>

      {/* Lista */}
      {loadingData ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>
          Cargando órdenes...
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          ...cardStyle,
          textAlign: "center", padding: "40px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <ShoppingCart size={36} color="var(--text-muted)" />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            Sin órdenes pendientes
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Cuando te asignen una OC enviada, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orders.map((order) => {
            const items = itemsByOrderId[order.id] ?? [];
            return (
              <div key={order.id} style={cardStyle}>

                {/* Header */}
                <div style={{ padding: "16px 16px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: "monospace", fontSize: 13, fontWeight: 800,
                      color: "var(--text-primary)", letterSpacing: "0.02em",
                    }}>
                      {order.folio}
                    </span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999,
                      background: "var(--metric-bg-blue)",
                      color: "var(--metric-value-blue)",
                      border: "1px solid var(--metric-border-blue)",
                      fontSize: 11, fontWeight: 700,
                    }}>
                      Enviada
                    </span>
                  </div>

                  <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                    {order.supplier_name}
                    {order.branch_name ? (
                      <span style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 13 }}>
                        {" · "}{order.branch_name}
                      </span>
                    ) : null}
                  </p>

                  {order.building_name ? (
                    <p style={{ margin: "0 0 3px", fontSize: 13, color: "var(--text-secondary)" }}>
                      Edificio: {order.building_name}
                    </p>
                  ) : null}

                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Enviada el {formatDate(order.sent_at ?? order.created_at)}
                  </p>
                </div>

                {/* Banner de cambio — solo para OCs de tipo exchange */}
                {order.version_type === "exchange" && exchangeCtx[order.id] ? (() => {
                  const ctx = exchangeCtx[order.id]!;
                  return (
                    <div style={{
                      background: "#fef3c7", border: "2px solid #f59e0b",
                      borderTop: "none",
                      padding: "14px 16px",
                    }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: "#92400e",
                        marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
                      }}>
                        🔄 ESTA ES UNA ORDEN DE CAMBIO
                      </div>
                      <div style={{ fontSize: 13, color: "#78350f", marginBottom: 10 }}>
                        Al recoger el material nuevo, también debes{" "}
                        <strong>ENTREGAR</strong> al proveedor:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, color: "#78350f" }}>
                        {ctx.items.map((it, idx) => (
                          <li key={idx} style={{ marginBottom: 4, fontSize: 13 }}>
                            <strong>{it.description}</strong> — {it.quantity_returned} {it.unit}
                          </li>
                        ))}
                      </ul>
                      <div style={{
                        marginTop: 10, paddingTop: 10,
                        borderTop: "1px solid #f59e0b",
                        fontSize: 13, color: "#78350f",
                      }}>
                        <strong>Motivo:</strong> {RETURN_REASON_LABEL[ctx.reason]}
                        {ctx.reason_notes ? (
                          <div style={{ fontStyle: "italic", marginTop: 4 }}>
                            &ldquo;{ctx.reason_notes}&rdquo;
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })() : null}

                {/* Materiales */}
                {items.length > 0 ? (
                  <div style={{
                    borderTop: "1px solid var(--border-default)",
                    padding: "10px 16px",
                    background: "var(--bg-input)",
                  }}>
                    <p style={{
                      margin: "0 0 8px", fontSize: 11, fontWeight: 700,
                      color: "var(--text-muted)", textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}>
                      Materiales ({items.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {items.map((it) => (
                        <div key={it.id} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", gap: 8,
                        }}>
                          <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>
                            {it.description}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: "var(--text-secondary)",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap",
                          }}>
                            {it.quantity} {it.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Acciones */}
                <div style={{
                  borderTop: "1px solid var(--border-default)",
                  padding: "12px 16px",
                  display: "flex", gap: 10, flexWrap: "wrap",
                }}>
                  {order.pdf_url ? (
                    <a
                      href={order.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center",
                        justifyContent: "center", gap: 6,
                        padding: "12px 16px", borderRadius: 10, minHeight: 44,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-card)", color: "var(--text-secondary)",
                        fontSize: 13, fontWeight: 600, textDecoration: "none",
                        flex: "1 1 auto",
                      }}
                    >
                      <ExternalLink size={15} />
                      Ver PDF
                    </a>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => openReceptionModal(order)}
                    style={{
                      display: "inline-flex", alignItems: "center",
                      justifyContent: "center", gap: 6,
                      padding: "12px 16px", borderRadius: 10, minHeight: 44,
                      border: "1px solid #10B981", background: "#10B981", color: "#fff",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      flex: "2 1 auto",
                    }}
                  >
                    <CheckCircle2 size={15} />
                    Confirmar recepción
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal confirmar recepción ─────────────────────────────── */}
      <Modal
        open={receptionOrder !== null}
        onClose={closeReceptionModal}
        title="Confirmar recepción"
        subtitle={receptionOrder?.folio}
        maxWidth="520px"
      >
        {receptionOrder ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Marca si faltó algo en algún material. Los items sin marca se registran como recibidos completos.
            </p>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {receptionItems.map((item, idx) => (
                <div
                  key={item.itemId}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${item.faltaAlgo ? "#F59E0B" : "var(--border-default)"}`,
                    background: item.faltaAlgo ? "#fffbeb" : "var(--bg-input)",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {/* Descripción + cantidad */}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", gap: 8, marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
                      {item.description}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
                      background: "var(--bg-card)", border: "1px solid var(--border-default)",
                      borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {item.quantity} {item.unit}
                    </span>
                  </div>

                  {/* Checkbox */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", userSelect: "none",
                    fontSize: 13, color: "var(--text-secondary)", fontWeight: 500,
                  }}>
                    <input
                      type="checkbox"
                      checked={item.faltaAlgo}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setReceptionItems((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, faltaAlgo: checked, cuantoFalto: "" } : r
                          )
                        );
                      }}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#F59E0B" }}
                    />
                    ¿Faltó algo?
                  </label>

                  {/* Input cantidad faltante */}
                  {item.faltaAlgo ? (
                    <div style={{ marginTop: 10 }}>
                      <label style={{
                        fontSize: 12, fontWeight: 600, color: "#92400e",
                        marginBottom: 4, display: "block",
                      }}>
                        ¿Cuánto faltó? (máx. {item.quantity} {item.unit})
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        max={item.quantity}
                        step="any"
                        value={item.cuantoFalto}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReceptionItems((prev) =>
                            prev.map((r, i) => i === idx ? { ...r, cuantoFalto: val } : r)
                          );
                        }}
                        placeholder={`Máx. ${item.quantity}`}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8,
                          border: "1px solid #F59E0B",
                          background: "#fff7ed", color: "#92400e",
                          fontSize: 14, fontWeight: 600,
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Aviso de faltantes */}
            {receptionItems.some((i) => i.faltaAlgo) ? (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px", borderRadius: 8,
                background: "#fffbeb", border: "1px solid #F59E0B",
              }}>
                <AlertCircle size={16} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  Se creará un borrador de OC en Compras con los materiales faltantes para que el equipo de compras la complete.
                </p>
              </div>
            ) : null}

            {/* Botones */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <UiButton
                type="button"
                variant="secondary"
                onClick={closeReceptionModal}
                disabled={savingReception}
              >
                Cancelar
              </UiButton>
              <button
                type="button"
                onClick={() => void confirmReception()}
                disabled={savingReception}
                style={{
                  display: "inline-flex", alignItems: "center",
                  justifyContent: "center", gap: 8,
                  padding: "11px 20px", borderRadius: 12, minHeight: 44,
                  border: "1px solid #10B981", background: "#10B981", color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: savingReception ? "wait" : "pointer",
                  opacity: savingReception ? 0.7 : 1,
                }}
              >
                {savingReception ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
