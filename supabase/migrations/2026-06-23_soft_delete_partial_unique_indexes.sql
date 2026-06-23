-- ============================================================
-- MIGRACIÓN: Soft-delete libera valores únicos
-- Fecha: 2026-06-23
-- Patrón: Partial unique index WHERE deleted_at IS NULL
--
-- Problema: un registro soft-deleted (deleted_at IS NOT NULL) bloqueaba
-- el reuso de su nombre/código/número al intentar crear uno nuevo con el
-- mismo valor. Se aplica SOLO a campos reutilizables por el usuario
-- (nombres, códigos, números de unidad/estacionamiento).
--
-- Campos que NO se tocan: FKs de auth, números de factura/finanzas.
--
-- El registro borrado conserva su nombre original intacto; no se modifica.
-- La unicidad entre registros ACTIVOS se mantiene.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. buildings — código de edificio
-- Era: (company_id, code) WHERE code IS NOT NULL
-- Nuevo: +AND deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.buildings_company_code_unique;
CREATE UNIQUE INDEX buildings_company_code_unique
  ON public.buildings (company_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. buildings — nombre de edificio
-- Era: (company_id, name) — sin filtro
-- Nuevo: WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.buildings_company_name_unique;
CREATE UNIQUE INDEX buildings_company_name_unique
  ON public.buildings (company_id, name)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. common_areas — nombre de área común
-- Era: (building_id, name) — sin filtro
-- Nuevo: WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.common_areas_building_name_unique;
CREATE UNIQUE INDEX common_areas_building_name_unique
  ON public.common_areas (building_id, name)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. tenants — código de inquilino
-- Era: (company_id, tenant_code) WHERE tenant_code IS NOT NULL
-- Nuevo: +AND deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.tenants_company_tenant_code_unique;
CREATE UNIQUE INDEX tenants_company_tenant_code_unique
  ON public.tenants (company_id, tenant_code)
  WHERE tenant_code IS NOT NULL AND deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. unit_types — nombre de tipo de unidad
-- Era: (building_id, name) — sin filtro
-- Nuevo: WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.unit_types_building_name_unique;
CREATE UNIQUE INDEX unit_types_building_name_unique
  ON public.unit_types (building_id, name)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. units — número de unidad
-- Era: (building_id, unit_number) — sin filtro
-- Nuevo: WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.units_building_unit_number_unique;
CREATE UNIQUE INDEX units_building_unit_number_unique
  ON public.units (building_id, unit_number)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 7. units — display_code de unidad
-- Era: (company_id, display_code) WHERE display_code IS NOT NULL
-- Nuevo: +AND deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.units_company_display_code_unique;
CREATE UNIQUE INDEX units_company_display_code_unique
  ON public.units (company_id, display_code)
  WHERE display_code IS NOT NULL AND deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 8. parking_spots — número de lugar de estacionamiento
-- Era: TABLE CONSTRAINT (company_id, spot_number) — sin filtro
-- Nuevo: DROP CONSTRAINT + CREATE UNIQUE INDEX WHERE deleted_at IS NULL
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.parking_spots
  DROP CONSTRAINT IF EXISTS parking_spots_building_id_spot_number_key;
CREATE UNIQUE INDEX parking_spots_building_id_spot_number_key
  ON public.parking_spots (building_id, spot_number)
  WHERE deleted_at IS NULL;

COMMIT;
