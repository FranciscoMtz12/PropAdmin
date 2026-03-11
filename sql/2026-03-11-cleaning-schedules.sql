-- =========================================================
-- PropAdmin
-- Cleaning schedules
-- Fecha sugerida: 2026-03-11
--
-- Objetivo:
-- 1) Guardar programación semanal simple para:
--    - exterior del edificio
--    - áreas comunes
-- 2) Guardar programación por unidad para:
--    - interior de unidades
--
-- Notas de diseño:
-- - Exterior y common usan bloques: morning / afternoon
-- - Morning permite monday a saturday
-- - Afternoon permite monday a friday
-- - Units sí guarda hora y duración
-- =========================================================

-- ---------------------------------------------------------
-- TABLA 1: cleaning_building_schedules
-- Guarda la programación semanal del edificio para:
-- - exterior
-- - common
-- ---------------------------------------------------------
create table if not exists public.cleaning_building_schedules (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,

  -- exterior | common
  cleaning_type text not null
    check (cleaning_type in ('exterior', 'common')),

  -- monday | tuesday | wednesday | thursday | friday | saturday
  day_of_week text not null
    check (day_of_week in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    )),

  -- morning | afternoon
  time_block text not null
    check (time_block in ('morning', 'afternoon')),

  created_at timestamptz not null default now(),

  -- Evita duplicados exactos
  constraint cleaning_building_schedules_unique
    unique (building_id, cleaning_type, day_of_week, time_block),

  -- Regla importante del producto:
  -- saturday solo se permite en morning
  constraint cleaning_building_schedules_saturday_rule
    check (
      not (day_of_week = 'saturday' and time_block = 'afternoon')
    )
);

comment on table public.cleaning_building_schedules is
'Programación semanal recurrente de limpieza del edificio para exterior y áreas comunes.';

comment on column public.cleaning_building_schedules.cleaning_type is
'Tipo de limpieza del edificio: exterior o common.';

comment on column public.cleaning_building_schedules.day_of_week is
'Día de la semana en formato interno en inglés.';

comment on column public.cleaning_building_schedules.time_block is
'Bloque operativo: morning o afternoon.';


-- ---------------------------------------------------------
-- ÍNDICES TABLA 1
-- ---------------------------------------------------------
create index if not exists idx_cleaning_building_schedules_company_id
  on public.cleaning_building_schedules(company_id);

create index if not exists idx_cleaning_building_schedules_building_id
  on public.cleaning_building_schedules(building_id);

create index if not exists idx_cleaning_building_schedules_building_type
  on public.cleaning_building_schedules(building_id, cleaning_type);


-- ---------------------------------------------------------
-- TABLA 2: cleaning_unit_schedules
-- Guarda programación por unidad para limpieza interior
-- ---------------------------------------------------------
create table if not exists public.cleaning_unit_schedules (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,

  -- monday | tuesday | wednesday | thursday | friday | saturday
  day_of_week text not null
    check (day_of_week in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    )),

  -- Hora de inicio para la limpieza interior
  start_time time not null,

  -- Duración estimada de la limpieza
  -- Ejemplos: 1.5, 2, 3
  duration_hours numeric(4,2) not null
    check (duration_hours > 0 and duration_hours <= 12),

  -- Permite apagar temporalmente una programación sin borrarla
  active boolean not null default true,

  created_at timestamptz not null default now(),

  -- Una unidad puede tener una sola programación por día
  constraint cleaning_unit_schedules_unique
    unique (unit_id, day_of_week)
);

comment on table public.cleaning_unit_schedules is
'Programación semanal recurrente de limpieza interior por unidad.';

comment on column public.cleaning_unit_schedules.start_time is
'Hora de inicio de la limpieza interior.';

comment on column public.cleaning_unit_schedules.duration_hours is
'Duración estimada de la limpieza en horas.';

comment on column public.cleaning_unit_schedules.active is
'Indica si la programación está activa.';


-- ---------------------------------------------------------
-- ÍNDICES TABLA 2
-- ---------------------------------------------------------
create index if not exists idx_cleaning_unit_schedules_company_id
  on public.cleaning_unit_schedules(company_id);

create index if not exists idx_cleaning_unit_schedules_building_id
  on public.cleaning_unit_schedules(building_id);

create index if not exists idx_cleaning_unit_schedules_unit_id
  on public.cleaning_unit_schedules(unit_id);

create index if not exists idx_cleaning_unit_schedules_active
  on public.cleaning_unit_schedules(active);


-- ---------------------------------------------------------
-- DATOS DE PRUEBA OPCIONALES
-- Déjalos comentados por ahora.
-- ---------------------------------------------------------
-- insert into public.cleaning_building_schedules
--   (company_id, building_id, cleaning_type, day_of_week, time_block)
-- values
--   ('COMPANY_ID', 'BUILDING_ID', 'exterior', 'monday', 'morning'),
--   ('COMPANY_ID', 'BUILDING_ID', 'exterior', 'thursday', 'morning'),
--   ('COMPANY_ID', 'BUILDING_ID', 'common', 'tuesday', 'afternoon');

-- insert into public.cleaning_unit_schedules
--   (company_id, building_id, unit_id, day_of_week, start_time, duration_hours, active)
-- values
--   ('COMPANY_ID', 'BUILDING_ID', 'UNIT_ID', 'wednesday', '09:00', 3, true);