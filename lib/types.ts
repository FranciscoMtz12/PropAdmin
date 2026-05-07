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

// ── Servicios del edificio (genérico) ────────────────────────────────

export type UtilityServiceType  = 'electricity' | 'gas' | 'water' | 'internet' | 'other'
export type UtilityMeterType    = 'dedicated' | 'shared'
export type UtilityInvoiceStatus = 'draft' | 'distributed' | 'charged'
export type BillingFrequency    = 'monthly' | 'bimonthly'

export const BILLING_FREQUENCY_LABEL: Record<BillingFrequency, string> = {
  monthly:   'Mensual',
  bimonthly: 'Bimestral',
}

export const SERVICE_TYPE_LABEL: Record<UtilityServiceType, string> = {
  electricity: 'Electricidad',
  gas:         'Gas',
  water:       'Agua',
  internet:    'Internet',
  other:       'Otro',
}

export const SERVICE_TYPE_UNIT: Record<UtilityServiceType, string | null> = {
  electricity: 'kWh',
  gas:         'm³',
  water:       'm³',
  internet:    null,
  other:       null,
}

export const UTILITY_INVOICE_STATUS_LABEL: Record<UtilityInvoiceStatus, string> = {
  draft:       'Borrador',
  distributed: 'Distribuida',
  charged:     'Cobrada',
}

export type BuildingUtilityMeter = {
  id: string
  company_id: string
  building_id: string
  service_type: UtilityServiceType
  meter_type: UtilityMeterType
  unit_id: string | null
  provider_name: string | null
  meter_number: string | null
  contract_number: string | null
  description: string | null
  billing_mode: 'charged' | 'included'
  contract_holder: 'tenant' | 'company'
  billing_frequency: BillingFrequency
  cycle_start_month: number | null
  cycle_start_year: number | null
  active: boolean
  created_at: string
  deleted_at: string | null
}

export function meterGeneratesCharge(meter: BuildingUtilityMeter): boolean {
  if (meter.meter_type === 'dedicated') return meter.contract_holder === 'company'
  return meter.billing_mode === 'charged'
}

export type BuildingUtilitySubMeter = {
  id: string
  building_utility_meter_id: string
  unit_id: string
  sub_meter_number: string | null
  baseline_reading: number
  active: boolean
  created_at: string
  deleted_at: string | null
}

export type BuildingUtilityReading = {
  id: string
  company_id: string
  building_utility_meter_id: string | null
  building_utility_sub_meter_id: string | null
  period_year: number
  period_month: number
  previous_reading: number | null
  current_reading: number | null
  consumption: number | null
  reading_date: string | null
  photo_path: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  deleted_at: string | null
}

export type PaymentStatus = 'unpaid' | 'paid'

export type BuildingUtilityInvoice = {
  id: string
  company_id: string
  building_id: string
  building_utility_meter_id: string
  period_year: number
  period_month: number
  total_amount: number
  total_consumption: number | null
  consumption_unit: string | null
  pdf_path: string | null
  folio: string | null
  status: UtilityInvoiceStatus
  payment_status: PaymentStatus
  paid_at: string | null
  due_date: string | null
  distributed_at: string | null
  charged_at: string | null
  created_by: string | null
  created_at: string
  deleted_at: string | null
}

export type PaymentReport = {
  id: string
  company_id: string
  folio: string | null
  week_number: number | null
  year: number | null
  report_date: string | null
  elaborated_by: string | null
  signer_name: string | null
  pdf_path: string | null
  status: 'pending' | 'paid' | 'cancelled'
  created_by: string | null
  created_at: string
  deleted_at: string | null
}

export type PaymentReportItem = {
  id: string
  payment_report_id: string
  purchase_order_id: string | null
  description: string
  vendor_name: string | null
  amount: number
  payment_status: PaymentStatus
  paid_at: string | null
  due_date: string | null
  notes: string | null
  created_at: string
}

export type ManualPayment = {
  id: string
  company_id: string
  building_id: string | null
  title: string
  amount: number
  period_year: number
  period_month: number
  payment_status: PaymentStatus
  paid_at: string | null
  due_date: string | null
  payment_report_id: string | null
  created_by: string | null
  created_at: string
  deleted_at: string | null
}

export type BuildingUtilityInvoiceItem = {
  id: string
  invoice_id: string
  building_utility_sub_meter_id: string | null
  unit_id: string
  consumption: number | null
  percentage: number | null
  amount_assigned: number
  collection_record_id: string | null
  created_at: string
}

export type PurchaseOrderInvoice = {
  id: string
  company_id: string
  purchase_order_id: string
  invoice_number: string
  invoice_date: string
  amount: number
  xml_path: string | null
  pdf_path: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

