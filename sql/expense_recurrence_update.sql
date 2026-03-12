-- ============================================
-- PROPADMIN
-- RECURRENCIA DE PAGOS ADMINISTRATIVOS
-- ============================================


-- =========================================================
-- 1. AGREGAR CAMPOS A expense_schedules (plantilla recurrente)
-- =========================================================

ALTER TABLE expense_schedules
ADD COLUMN IF NOT EXISTS frequency_type text DEFAULT 'monthly';

ALTER TABLE expense_schedules
ADD COLUMN IF NOT EXISTS starts_on date;

ALTER TABLE expense_schedules
ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE expense_schedules
ADD COLUMN IF NOT EXISTS auto_generate boolean DEFAULT true;

ALTER TABLE expense_schedules
ADD COLUMN IF NOT EXISTS expected_issue_day integer;

ALTER TABLE expense_schedules
ADD COLUMN IF NOT EXISTS expected_cutoff_day integer;



-- =========================================================
-- 2. AGREGAR CAMPOS A expense_payments (registro mensual)
-- =========================================================

ALTER TABLE expense_payments
ADD COLUMN IF NOT EXISTS invoice_received_at date;

ALTER TABLE expense_payments
ADD COLUMN IF NOT EXISTS cutoff_date date;

ALTER TABLE expense_payments
ADD COLUMN IF NOT EXISTS billing_period_label text;

ALTER TABLE expense_payments
ADD COLUMN IF NOT EXISTS is_generated_placeholder boolean DEFAULT false;

ALTER TABLE expense_payments
ADD COLUMN IF NOT EXISTS amount_estimated_snapshot numeric;



-- =========================================================
-- 3. INDEXES IMPORTANTES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_expense_payments_period
ON expense_payments (period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_expense_payments_schedule
ON expense_payments (expense_schedule_id);

CREATE INDEX IF NOT EXISTS idx_expense_payments_status
ON expense_payments (status);



-- =========================================================
-- 4. COMENTARIOS PARA DOCUMENTAR
-- =========================================================

COMMENT ON COLUMN expense_schedules.frequency_type IS
'monthly | bimonthly';

COMMENT ON COLUMN expense_schedules.expected_issue_day IS
'Día estimado en que llega el recibo';

COMMENT ON COLUMN expense_schedules.expected_cutoff_day IS
'Día estimado de corte del servicio';

COMMENT ON COLUMN expense_payments.invoice_received_at IS
'Fecha real en que llegó el recibo';

COMMENT ON COLUMN expense_payments.cutoff_date IS
'Fecha real de corte del servicio';

COMMENT ON COLUMN expense_payments.is_generated_placeholder IS
'Indica que el pago fue generado automáticamente al iniciar el periodo';