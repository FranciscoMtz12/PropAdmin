/*
  Foundation para módulos operativos internos de:

  - Pagos (gastos administrativos)
  - Cobranza (cuentas por cobrar a inquilinos)

  Idea de negocio:
  - payments del sidebar = pagos que hace la empresa / administración / edificio
  - collections del sidebar = cobros que se deben realizar a inquilinos
  - invoices queda libre para facturación formal futura

  IMPORTANTE:
  En este proyecto, public.app_users no tiene auth_user_id.
  Por eso las políticas RLS se construyen usando:
    lower(app_users.email) = lower(auth.email())
*/

begin;

-- =========================================================
-- 1) EXPENSE SCHEDULES
-- =========================================================
create table if not exists public.expense_schedules (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid null references public.units(id) on delete set null,

  expense_type text not null check (
    expense_type in (
      'electricity',
      'water',
      'gas',
      'internet',
      'phone',
      'maintenance_service',
      'security',
      'cleaning_service',
      'other'
    )
  ),

  title text not null,
  vendor_name text null,

  responsibility_type text not null check (
    responsibility_type in ('company', 'building', 'tenant')
  ),

  applies_to text not null default 'building' check (
    applies_to in ('building', 'unit')
  ),

  amount_estimated numeric(12,2) null check (
    amount_estimated is null or amount_estimated >= 0
  ),

  due_day integer not null check (due_day between 1 and 31),
  active boolean not null default true,
  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_schedules_unit_scope_check check (
    (applies_to = 'building')
    or
    (applies_to = 'unit' and unit_id is not null)
  )
);

comment on table public.expense_schedules is
'Configuración base de gastos administrativos recurrentes pagados por empresa, edificio o inquilino.';

create index if not exists idx_expense_schedules_company_id
  on public.expense_schedules(company_id);

create index if not exists idx_expense_schedules_building_id
  on public.expense_schedules(building_id);

create index if not exists idx_expense_schedules_unit_id
  on public.expense_schedules(unit_id);

create index if not exists idx_expense_schedules_responsibility_type
  on public.expense_schedules(responsibility_type);

create index if not exists idx_expense_schedules_active
  on public.expense_schedules(active);


-- =========================================================
-- 2) EXPENSE PAYMENTS
-- =========================================================
create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),

  expense_schedule_id uuid not null
    references public.expense_schedules(id) on delete cascade,

  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid null references public.units(id) on delete set null,

  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),

  due_date date not null,
  amount_due numeric(12,2) not null check (amount_due >= 0),

  status text not null default 'pending' check (
    status in ('pending', 'paid', 'overdue')
  ),

  paid_at timestamptz null,
  payment_reference text null,
  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_payments_unique_period unique (
    expense_schedule_id,
    period_year,
    period_month
  ),

  constraint expense_payments_paid_at_check check (
    (status <> 'paid')
    or
    (status = 'paid' and paid_at is not null)
  )
);

comment on table public.expense_payments is
'Registros mensuales reales de pagos administrativos. Alimenta el módulo de Pagos y su calendario.';

create index if not exists idx_expense_payments_company_id
  on public.expense_payments(company_id);

create index if not exists idx_expense_payments_building_id
  on public.expense_payments(building_id);

create index if not exists idx_expense_payments_unit_id
  on public.expense_payments(unit_id);

create index if not exists idx_expense_payments_due_date
  on public.expense_payments(due_date);

create index if not exists idx_expense_payments_status
  on public.expense_payments(status);

create index if not exists idx_expense_payments_period
  on public.expense_payments(period_year, period_month);


-- =========================================================
-- 3) COLLECTION SCHEDULES
-- =========================================================
create table if not exists public.collection_schedules (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  lease_id uuid null references public.leases(id) on delete set null,

  charge_type text not null check (
    charge_type in (
      'rent',
      'maintenance_fee',
      'services',
      'parking',
      'penalty',
      'other'
    )
  ),

  title text not null,

  responsibility_type text not null default 'tenant' check (
    responsibility_type in ('tenant', 'owner', 'other')
  ),

  amount_expected numeric(12,2) not null check (amount_expected >= 0),
  due_day integer not null check (due_day between 1 and 31),

  active boolean not null default true,
  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.collection_schedules is
'Configuración base de cobros recurrentes a inquilinos u otros responsables.';

create index if not exists idx_collection_schedules_company_id
  on public.collection_schedules(company_id);

create index if not exists idx_collection_schedules_building_id
  on public.collection_schedules(building_id);

create index if not exists idx_collection_schedules_unit_id
  on public.collection_schedules(unit_id);

create index if not exists idx_collection_schedules_lease_id
  on public.collection_schedules(lease_id);

create index if not exists idx_collection_schedules_active
  on public.collection_schedules(active);


-- =========================================================
-- 4) COLLECTION RECORDS
-- =========================================================
create table if not exists public.collection_records (
  id uuid primary key default gen_random_uuid(),

  collection_schedule_id uuid not null
    references public.collection_schedules(id) on delete cascade,

  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  lease_id uuid null references public.leases(id) on delete set null,

  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),

  due_date date not null,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  amount_collected numeric(12,2) null check (
    amount_collected is null or amount_collected >= 0
  ),

  status text not null default 'pending' check (
    status in ('pending', 'collected', 'overdue')
  ),

  collected_at timestamptz null,
  payment_method text null,
  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint collection_records_unique_period unique (
    collection_schedule_id,
    period_year,
    period_month
  ),

  constraint collection_records_collected_at_check check (
    (status <> 'collected')
    or
    (status = 'collected' and collected_at is not null)
  )
);

comment on table public.collection_records is
'Registros mensuales reales de cobranza. Alimenta el módulo de Cobranza y sus resúmenes.';

create index if not exists idx_collection_records_company_id
  on public.collection_records(company_id);

create index if not exists idx_collection_records_building_id
  on public.collection_records(building_id);

create index if not exists idx_collection_records_unit_id
  on public.collection_records(unit_id);

create index if not exists idx_collection_records_lease_id
  on public.collection_records(lease_id);

create index if not exists idx_collection_records_due_date
  on public.collection_records(due_date);

create index if not exists idx_collection_records_status
  on public.collection_records(status);

create index if not exists idx_collection_records_period
  on public.collection_records(period_year, period_month);


-- =========================================================
-- RLS
-- =========================================================
alter table public.expense_schedules enable row level security;
alter table public.expense_payments enable row level security;
alter table public.collection_schedules enable row level security;
alter table public.collection_records enable row level security;


-- =========================================================
-- POLICIES: EXPENSE SCHEDULES
-- =========================================================
drop policy if exists "expense_schedules_select_by_company" on public.expense_schedules;
create policy "expense_schedules_select_by_company"
  on public.expense_schedules
  for select
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "expense_schedules_insert_by_company" on public.expense_schedules;
create policy "expense_schedules_insert_by_company"
  on public.expense_schedules
  for insert
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "expense_schedules_update_by_company" on public.expense_schedules;
create policy "expense_schedules_update_by_company"
  on public.expense_schedules
  for update
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  )
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "expense_schedules_delete_by_company" on public.expense_schedules;
create policy "expense_schedules_delete_by_company"
  on public.expense_schedules
  for delete
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );


-- =========================================================
-- POLICIES: EXPENSE PAYMENTS
-- =========================================================
drop policy if exists "expense_payments_select_by_company" on public.expense_payments;
create policy "expense_payments_select_by_company"
  on public.expense_payments
  for select
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "expense_payments_insert_by_company" on public.expense_payments;
create policy "expense_payments_insert_by_company"
  on public.expense_payments
  for insert
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "expense_payments_update_by_company" on public.expense_payments;
create policy "expense_payments_update_by_company"
  on public.expense_payments
  for update
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  )
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "expense_payments_delete_by_company" on public.expense_payments;
create policy "expense_payments_delete_by_company"
  on public.expense_payments
  for delete
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );


-- =========================================================
-- POLICIES: COLLECTION SCHEDULES
-- =========================================================
drop policy if exists "collection_schedules_select_by_company" on public.collection_schedules;
create policy "collection_schedules_select_by_company"
  on public.collection_schedules
  for select
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "collection_schedules_insert_by_company" on public.collection_schedules;
create policy "collection_schedules_insert_by_company"
  on public.collection_schedules
  for insert
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "collection_schedules_update_by_company" on public.collection_schedules;
create policy "collection_schedules_update_by_company"
  on public.collection_schedules
  for update
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  )
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "collection_schedules_delete_by_company" on public.collection_schedules;
create policy "collection_schedules_delete_by_company"
  on public.collection_schedules
  for delete
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );


-- =========================================================
-- POLICIES: COLLECTION RECORDS
-- =========================================================
drop policy if exists "collection_records_select_by_company" on public.collection_records;
create policy "collection_records_select_by_company"
  on public.collection_records
  for select
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "collection_records_insert_by_company" on public.collection_records;
create policy "collection_records_insert_by_company"
  on public.collection_records
  for insert
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "collection_records_update_by_company" on public.collection_records;
create policy "collection_records_update_by_company"
  on public.collection_records
  for update
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  )
  with check (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

drop policy if exists "collection_records_delete_by_company" on public.collection_records;
create policy "collection_records_delete_by_company"
  on public.collection_records
  for delete
  using (
    company_id in (
      select app_users.company_id
      from public.app_users
      where lower(app_users.email) = lower(auth.email())
    )
  );

commit;
