export type PurchaseReturnReason = "defective" | "wrong_item" | "surplus" | "other";
export type PurchaseReturnType = "return" | "exchange";
export type PurchaseOrderVersionType = "shortage" | "exchange" | null;

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
  type: PurchaseReturnType;
  reason: PurchaseReturnReason;
  reason_notes: string | null;
  photo_url: string | null;
  replacement_order_id: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
  items?: PurchaseReturnItem[];
};

// ── Medidores de luz (CFE) ───────────────────────────────────────────

export type ElectricityMeter = {
  id: string;
  company_id: string;
  building_id: string;
  meter_number: string;
  description?: string | null;
  created_at: string;
  deleted_at?: string | null;
};

export type UnitMeterAssignment = {
  id: string;
  company_id: string;
  meter_id: string;
  unit_id: string;
  assigned_at: string;
  unassigned_at?: string | null;
  meter?: ElectricityMeter;
};

export type ElectricityReading = {
  id: string;
  company_id: string;
  meter_id: string;
  unit_id: string;
  reading_kwh: number;
  reading_date: string;
  photo_path?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
};
