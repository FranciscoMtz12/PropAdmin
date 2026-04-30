export type PurchaseReturnReason = "defective" | "wrong_item" | "surplus" | "other";

export const RETURN_REASON_LABEL: Record<PurchaseReturnReason, string> = {
  defective:   "Defectuoso",
  wrong_item:  "Producto equivocado",
  surplus:     "Sobrante",
  other:       "Otro",
};

export type PurchaseReturnItem = {
  id: string;
  return_id: string;
  purchase_order_item_id: string;
  quantity_returned: number;
};

export type PurchaseReturn = {
  id: string;
  company_id: string;
  purchase_order_id: string;
  reason: PurchaseReturnReason;
  reason_notes: string | null;
  photo_url: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
  items?: PurchaseReturnItem[];
};
