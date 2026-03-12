begin;

-- =========================================================
-- EXPENSE SCHEDULES
-- Campos de recurrencia + identificador del servicio
-- =========================================================

alter table public.expense_schedules
  add column if not exists frequency_type text
  check (frequency_type in ('monthly', 'bimonthly'));

alter table public.expense_schedules
  add column if not exists starts_on date;

alter table public.expense_schedules
  add column if not exists ends_on date;

alter table public.expense_schedules
  add column if not exists auto_generate boolean not null default true;

alter table public.expense_schedules
  add column if not exists expected_issue_day integer
  check (expected_issue_day is null or expected_issue_day between 1 and 31);

alter table public.expense_schedules
  add column if not exists expected_cutoff_day integer
  check (expected_cutoff_day is null or expected_cutoff_day between 1 and 31);

alter table public.expense_schedules
  add column if not exists service_identifier text;

update public.expense_schedules
set frequency_type = 'monthly'
where frequency_type is null;

-- =========================================================
-- EXPENSE PAYMENTS
-- Campos operativos para pagos reales
-- =========================================================

alter table public.expense_payments
  add column if not exists invoice_received_at date;

alter table public.expense_payments
  add column if not exists cutoff_date date;

alter table public.expense_payments
  add column if not exists billing_period_label text;

alter table public.expense_payments
  add column if not exists is_generated_placeholder boolean not null default false;

alter table public.expense_payments
  add column if not exists amount_estimated_snapshot numeric(12,2);

alter table public.expense_payments
  add column if not exists billed_period_label text;

alter table public.expense_payments
  add column if not exists consumption_period_label text;

alter table public.expense_payments
  add column if not exists billed_month_label text;

update public.expense_payments
set cutoff_date = due_date + 1
where cutoff_date is null and due_date is not null;

update public.expense_payments
set billing_period_label = to_char(make_date(period_year, period_month, 1), 'Mon YYYY')
where billing_period_label is null;

commit;
