-- ============================================================
-- MIGRACIÓN: Partial unique index en configs reusables (cierre soft-delete)
-- Fecha: 2026-06-24
-- Continúa commit 4df4162 — segunda tanda de constraints dudosas resueltas.
--
-- CAMBIAN (configs/etiquetas reutilizables → liberar al soft-delete):
--   building_feature_config, cleaning_building_schedules,
--   cleaning_unit_schedules, unit_amenities, preventive_plans
--
-- NO SE TOCAN (folios contables/fiscales — nunca se reciclan):
--   companies_code_unique, utility_bills_company_number_unique,
--   work_orders_company_number_unique
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. building_feature_config — clave de configuración por edificio
-- Era: TABLE CONSTRAINT (building_id, feature_key) — sin filtro
-- Nuevo: DROP CONSTRAINT + CREATE UNIQUE INDEX WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.building_feature_config
  DROP CONSTRAINT IF EXISTS building_feature_config_building_id_feature_key_key;
CREATE UNIQUE INDEX building_feature_config_building_id_feature_key_key
  ON public.building_feature_config (building_id, feature_key)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. cleaning_building_schedules — horario de limpieza por edificio
-- Era: TABLE CONSTRAINT (building_id, cleaning_type, day_of_week, time_block) — sin filtro
-- Nuevo: DROP CONSTRAINT + CREATE UNIQUE INDEX WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.cleaning_building_schedules
  DROP CONSTRAINT IF EXISTS cleaning_building_schedules_unique;
CREATE UNIQUE INDEX cleaning_building_schedules_unique
  ON public.cleaning_building_schedules (building_id, cleaning_type, day_of_week, time_block)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. cleaning_unit_schedules — horario de limpieza por unidad
-- Era: TABLE CONSTRAINT (unit_id, day_of_week) — sin filtro
-- Nuevo: DROP CONSTRAINT + CREATE UNIQUE INDEX WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.cleaning_unit_schedules
  DROP CONSTRAINT IF EXISTS cleaning_unit_schedules_unique;
CREATE UNIQUE INDEX cleaning_unit_schedules_unique
  ON public.cleaning_unit_schedules (unit_id, day_of_week)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. unit_amenities — amenidad por unidad
-- Era: TABLE CONSTRAINT (unit_id, amenity_key) — sin filtro
-- Nuevo: DROP CONSTRAINT + CREATE UNIQUE INDEX WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.unit_amenities
  DROP CONSTRAINT IF EXISTS unit_amenities_unit_id_amenity_key_key;
CREATE UNIQUE INDEX unit_amenities_unit_id_amenity_key_key
  ON public.unit_amenities (unit_id, amenity_key)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. preventive_plans — plan preventivo por activo
-- Era: CREATE UNIQUE INDEX (asset_id) — sin filtro
-- Nuevo: DROP INDEX + CREATE UNIQUE INDEX WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.preventive_plans_asset_unique;
CREATE UNIQUE INDEX preventive_plans_asset_unique
  ON public.preventive_plans (asset_id)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- SIN CAMBIOS (folios contables — permanecen únicos incluso borrados):
--   companies_code_unique
--   utility_bills_company_number_unique
--   work_orders_company_number_unique
-- ─────────────────────────────────────────────────────────────

COMMIT;
