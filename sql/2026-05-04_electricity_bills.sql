-- =========================================================
-- electricity_bills
-- Factura CFE de un medidor compartido para un período dado
-- =========================================================
create table if not exists public.electricity_bills (
  id uuid primary key default gen_random_uuid(),

  company_id  uuid not null references public.companies(id)   on delete cascade,
  building_id uuid not null references public.buildings(id)   on delete cascade,
  cfe_meter_id uuid not null references public.cfe_meters(id) on delete cascade,

  period_year  integer not null check (period_year  between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),

  total_amount numeric(12,2) not null check (total_amount >= 0),
  total_kwh    numeric(10,2) not null check (total_kwh >= 0),

  pdf_path  text null,
  folio_cfe text null,

  status text not null default 'draft' check (
    status in ('draft', 'distributed', 'charged')
  ),

  distributed_at timestamptz null,
  charged_at     timestamptz null,
  created_by     uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint electricity_bills_unique_period unique (cfe_meter_id, period_year, period_month)
);

create index if not exists idx_electricity_bills_company_id  on public.electricity_bills(company_id);
create index if not exists idx_electricity_bills_cfe_meter   on public.electricity_bills(cfe_meter_id);
create index if not exists idx_electricity_bills_period      on public.electricity_bills(period_year, period_month);

alter table public.electricity_bills enable row level security;

drop policy if exists "electricity_bills_select" on public.electricity_bills;
create policy "electricity_bills_select"
  on public.electricity_bills for select
  using (
    company_id in (
      select company_id from public.user_profiles where id = auth.uid()
    )
  );

drop policy if exists "electricity_bills_insert" on public.electricity_bills;
create policy "electricity_bills_insert"
  on public.electricity_bills for insert
  with check (
    company_id in (
      select company_id from public.user_profiles where id = auth.uid()
    )
  );

drop policy if exists "electricity_bills_update" on public.electricity_bills;
create policy "electricity_bills_update"
  on public.electricity_bills for update
  using (
    company_id in (
      select company_id from public.user_profiles where id = auth.uid()
    )
  );


-- =========================================================
-- electricity_bill_items
-- Distribución del costo de la factura por submedidor/depa
-- =========================================================
create table if not exists public.electricity_bill_items (
  id uuid primary key default gen_random_uuid(),

  bill_id           uuid not null references public.electricity_bills(id) on delete cascade,
  internal_meter_id uuid not null references public.internal_meters(id)   on delete cascade,
  unit_id           uuid not null references public.units(id)             on delete cascade,

  consumption_kwh  numeric(10,2) not null check (consumption_kwh >= 0),
  percentage       numeric(7,4)  not null check (percentage >= 0 and percentage <= 100),
  amount_assigned  numeric(12,2) not null check (amount_assigned >= 0),

  collection_record_id uuid null references public.collection_records(id) on delete set null,

  created_at timestamptz not null default now(),

  constraint electricity_bill_items_unique_meter unique (bill_id, internal_meter_id)
);

create index if not exists idx_electricity_bill_items_bill on public.electricity_bill_items(bill_id);
create index if not exists idx_electricity_bill_items_unit on public.electricity_bill_items(unit_id);

alter table public.electricity_bill_items enable row level security;

drop policy if exists "electricity_bill_items_select" on public.electricity_bill_items;
create policy "electricity_bill_items_select"
  on public.electricity_bill_items for select
  using (
    bill_id in (
      select id from public.electricity_bills
      where company_id in (
        select company_id from public.user_profiles where id = auth.uid()
      )
    )
  );

drop policy if exists "electricity_bill_items_insert" on public.electricity_bill_items;
create policy "electricity_bill_items_insert"
  on public.electricity_bill_items for insert
  with check (
    bill_id in (
      select id from public.electricity_bills
      where company_id in (
        select company_id from public.user_profiles where id = auth.uid()
      )
    )
  );

drop policy if exists "electricity_bill_items_update" on public.electricity_bill_items;
create policy "electricity_bill_items_update"
  on public.electricity_bill_items for update
  using (
    bill_id in (
      select id from public.electricity_bills
      where company_id in (
        select company_id from public.user_profiles where id = auth.uid()
      )
    )
  );
