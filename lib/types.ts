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

// ── Medidores de luz CFE ─────────────────────────────────────────────

export type CFEServiceType = 'dedicated' | 'shared'

export type CFEMeter = {
  id: string
  company_id: string
  building_id: string
  meter_number: string
  rpu: string | null
  description: string | null
  tariff_type: string | null
  service_type: CFEServiceType
  assigned_unit_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joins computed
  building_name?: string
  assigned_unit_label?: string
  internal_meters?: InternalMeter[]
}

export type InternalMeter = {
  id: string
  company_id: string
  cfe_meter_id: string
  unit_id: string
  internal_number: string | null
  baseline_reading: number
  baseline_date: string
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joins
  unit_number?: string
  display_code?: string
  tenant_name?: string
}

export type ElectricityReading = {
  id: string
  company_id: string
  internal_meter_id: string
  unit_id: string
  cfe_meter_id: string
  period_year: number
  period_month: number
  previous_reading: number
  current_reading: number
  consumption: number
  reading_date: string
  photo_url: string
  notes: string | null
  has_no_tenant: boolean
  read_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // computed
  photo_signed_url?: string
  unit_number?: string
  building_name?: string
}
