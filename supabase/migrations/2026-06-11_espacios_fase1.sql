-- ============================================================
-- FASE 1: Esquema nuevo en paralelo — Espacios / Properties
-- ============================================================
-- Crea todas las tablas nuevas SIN tocar nada existente.
-- Las tablas viejas (buildings, units, unit_types, etc.) quedan intactas.
-- Esta migración NO migra datos, NO borra nada, NO toca código de la app.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ENUM NUEVO: space_status
-- ─────────────────────────────────────────────────────────────
CREATE TYPE space_status AS ENUM ('VACANT', 'RENTED', 'PARTIAL', 'MAINTENANCE');


-- ─────────────────────────────────────────────────────────────
-- 2. TABLA properties
-- ─────────────────────────────────────────────────────────────
CREATE TABLE properties (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES companies(id),
  name             text        NOT NULL,
  code             text,
  address          text,
  latitude         float8,
  longitude        float8,
  property_label   text,
  land_sqm         numeric,
  construction_sqm numeric,
  total_sqm        numeric,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  is_test          bool        NOT NULL DEFAULT false
);

CREATE INDEX idx_properties_company_id ON properties(company_id);
CREATE INDEX idx_properties_deleted_at ON properties(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON properties
  FOR ALL USING (is_superadmin());

CREATE POLICY "company_access" ON properties
  FOR ALL
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));


-- ─────────────────────────────────────────────────────────────
-- 3. TABLA space_groups
-- ─────────────────────────────────────────────────────────────
CREATE TABLE space_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id),
  property_id uuid        NOT NULL REFERENCES properties(id),
  name        text        NOT NULL,
  group_type  text        NOT NULL,
  sort_order  int4        NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_space_groups_company_id  ON space_groups(company_id);
CREATE INDEX idx_space_groups_property_id ON space_groups(property_id);

ALTER TABLE space_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON space_groups
  FOR ALL USING (is_superadmin());

CREATE POLICY "company_access" ON space_groups
  FOR ALL
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));


-- ─────────────────────────────────────────────────────────────
-- 4. TABLA space_templates  (antes que spaces para poder referenciar)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE space_templates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES companies(id),
  property_id         uuid        NOT NULL REFERENCES properties(id),
  space_type          text        NOT NULL,
  name                text        NOT NULL,
  bedrooms            int4,
  bathrooms           int4,
  has_living_room     bool        NOT NULL DEFAULT false,
  has_dining_room     bool        NOT NULL DEFAULT false,
  has_patio           bool        NOT NULL DEFAULT false,
  has_fridge          bool        NOT NULL DEFAULT false,
  has_washer          bool        NOT NULL DEFAULT false,
  has_dryer           bool        NOT NULL DEFAULT false,
  stove_type          text        NOT NULL DEFAULT 'NONE',
  has_ac              bool        NOT NULL DEFAULT false,
  has_electricity_220 bool        NOT NULL DEFAULT false,
  has_three_phase     bool        NOT NULL DEFAULT false,
  has_gas_line        bool        NOT NULL DEFAULT false,
  has_water_meter     bool        NOT NULL DEFAULT false,
  has_network         bool        NOT NULL DEFAULT false,
  sqm_min             numeric,
  sqm_max             numeric,
  sqm_bodega          numeric,
  sqm_oficina         numeric,
  sqm_patio           numeric,
  altura_libre        numeric,
  capacidad_electrica text,
  acceso_tipo         text,
  entrega             text,
  wizard_state        jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_space_templates_company_id  ON space_templates(company_id);
CREATE INDEX idx_space_templates_property_id ON space_templates(property_id);

ALTER TABLE space_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON space_templates
  FOR ALL USING (is_superadmin());

CREATE POLICY "company_access" ON space_templates
  FOR ALL
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));


-- ─────────────────────────────────────────────────────────────
-- 5. TABLA spaces
-- ─────────────────────────────────────────────────────────────
CREATE TABLE spaces (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid         NOT NULL REFERENCES companies(id),
  property_id               uuid         NOT NULL REFERENCES properties(id),
  space_group_id            uuid         REFERENCES space_groups(id),
  space_template_id         uuid         REFERENCES space_templates(id),
  space_type                text         NOT NULL,
  is_rentable               bool         NOT NULL DEFAULT true,
  code                      text         NOT NULL,
  display_code              text,
  floor                     text,
  status                    space_status NOT NULL DEFAULT 'VACANT',
  reference_rent_whole      numeric,
  reference_rent_subdivided numeric,
  rental_mode               text         NOT NULL DEFAULT 'whole',
  is_divisible              bool         NOT NULL DEFAULT false,
  divisible_strategy        text,
  min_division_sqm          numeric,
  total_sqm                 numeric,
  bedrooms                  int4,
  bathrooms                 int4,
  altura_libre              numeric,
  acceso_tipo               text,
  floorplan_polygon         jsonb,
  floorplan_image_ref       text,
  created_at                timestamptz  NOT NULL DEFAULT now(),
  deleted_at                timestamptz,
  is_test                   bool         NOT NULL DEFAULT false,
  needs_review              bool         DEFAULT false
);

CREATE INDEX idx_spaces_company_id         ON spaces(company_id);
CREATE INDEX idx_spaces_property_id        ON spaces(property_id);
CREATE INDEX idx_spaces_space_group_id     ON spaces(space_group_id);
CREATE INDEX idx_spaces_space_template_id  ON spaces(space_template_id);
CREATE INDEX idx_spaces_status             ON spaces(status);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON spaces
  FOR ALL USING (is_superadmin());

CREATE POLICY "company_access" ON spaces
  FOR ALL
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));


-- ─────────────────────────────────────────────────────────────
-- 6. TABLA space_template_assets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE space_template_assets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_template_id uuid        NOT NULL REFERENCES space_templates(id),
  asset_type        text        NOT NULL,
  name              text        NOT NULL,
  sort_order        int4        NOT NULL DEFAULT 0,
  status            text,
  notes             text,
  icon_name         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX idx_sta_space_template_id ON space_template_assets(space_template_id);

ALTER TABLE space_template_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON space_template_assets
  FOR ALL USING (is_superadmin());

CREATE POLICY "template_company_access" ON space_template_assets
  FOR ALL
  USING (
    space_template_id IN (
      SELECT id FROM space_templates
      WHERE can_access_company(company_id)
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    space_template_id IN (
      SELECT id FROM space_templates
      WHERE can_access_company(company_id)
        AND deleted_at IS NULL
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 7. TABLA space_subdivisions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE space_subdivisions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES companies(id),
  space_id         uuid        NOT NULL REFERENCES spaces(id),
  subdivision_type text        NOT NULL,
  label            text        NOT NULL,
  sqm              numeric,
  sort_order       int4        NOT NULL DEFAULT 0,
  is_active        bool        NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_space_subdivisions_company_id ON space_subdivisions(company_id);
CREATE INDEX idx_space_subdivisions_space_id   ON space_subdivisions(space_id);

ALTER TABLE space_subdivisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON space_subdivisions
  FOR ALL USING (is_superadmin());

CREATE POLICY "company_access" ON space_subdivisions
  FOR ALL
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));


-- ─────────────────────────────────────────────────────────────
-- 8. TABLA space_rent_history
-- ─────────────────────────────────────────────────────────────
CREATE TABLE space_rent_history (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid        NOT NULL REFERENCES companies(id),
  space_id             uuid        NOT NULL REFERENCES spaces(id),
  space_subdivision_id uuid        REFERENCES space_subdivisions(id),
  lease_id             uuid        REFERENCES leases(id),
  rent_amount          numeric     NOT NULL,
  rental_mode          text        NOT NULL,
  effective_from       date        NOT NULL,
  effective_to         date,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_srh_company_id           ON space_rent_history(company_id);
CREATE INDEX idx_srh_space_id             ON space_rent_history(space_id);
CREATE INDEX idx_srh_space_subdivision_id ON space_rent_history(space_subdivision_id);
CREATE INDEX idx_srh_lease_id             ON space_rent_history(lease_id);
CREATE INDEX idx_srh_effective            ON space_rent_history(space_id, effective_from, effective_to);

ALTER TABLE space_rent_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON space_rent_history
  FOR ALL USING (is_superadmin());

CREATE POLICY "company_access" ON space_rent_history
  FOR ALL
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));


-- ─────────────────────────────────────────────────────────────
-- 9. TABLA lease_spaces
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lease_spaces (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id             uuid        NOT NULL REFERENCES leases(id),
  space_id             uuid        NOT NULL REFERENCES spaces(id),
  space_subdivision_id uuid        REFERENCES space_subdivisions(id),
  allocated_sqm        numeric,
  allocated_rent       numeric,
  billing_mode         text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lease_spaces_lease_id             ON lease_spaces(lease_id);
CREATE INDEX idx_lease_spaces_space_id             ON lease_spaces(space_id);
CREATE INDEX idx_lease_spaces_space_subdivision_id ON lease_spaces(space_subdivision_id);

ALTER TABLE lease_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_full_access" ON lease_spaces
  FOR ALL USING (is_superadmin());

CREATE POLICY "lease_company_access" ON lease_spaces
  FOR ALL
  USING (
    lease_id IN (
      SELECT id FROM leases
      WHERE can_access_company(company_id)
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    lease_id IN (
      SELECT id FROM leases
      WHERE can_access_company(company_id)
        AND deleted_at IS NULL
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 10. TRIGGERS
-- ─────────────────────────────────────────────────────────────

-- ── 10a. sync_space_status_from_lease ────────────────────────
-- Adaptado de sync_unit_status_from_lease.
-- Recalcula el status del espacio según lease_spaces activos.
-- Se dispara sobre lease_spaces (INSERT / UPDATE / DELETE).
-- Reglas:
--   0 contratos activos → VACANT
--   rental_mode=whole con ≥1 contrato completo → RENTED
--   by_subdivision con todas las subdivisiones ocupadas → RENTED
--   by_subdivision parcial → PARTIAL
--   is_divisible por metraje: suma allocated_sqm vs total_sqm
-- Nunca toca espacios en MAINTENANCE.
-- Capacidad se cuenta desde space_subdivisions (no desde bedrooms).

CREATE OR REPLACE FUNCTION sync_space_status_from_lease()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_space_id     uuid;
  v_rental_mode  text;
  v_is_divisible bool;
  v_total_sqm    numeric;
  v_whole_count  int;
  v_sub_count    int;
  v_total_subs   int;
  v_alloc_sqm    numeric;
BEGIN
  -- Para UPDATE que cambia de espacio: sincronizar también el espacio anterior
  IF TG_OP = 'UPDATE' AND OLD.space_id IS DISTINCT FROM NEW.space_id THEN
    PERFORM sync_space_status_from_lease_for(OLD.space_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_space_id := OLD.space_id;
  ELSE
    v_space_id := NEW.space_id;
  END IF;

  IF v_space_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM sync_space_status_from_lease_for(v_space_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Función auxiliar que ejecuta el cálculo real para un espacio dado
CREATE OR REPLACE FUNCTION sync_space_status_from_lease_for(v_space_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_rental_mode  text;
  v_is_divisible bool;
  v_total_sqm    numeric;
  v_whole_count  int;
  v_sub_count    int;
  v_total_subs   int;
  v_alloc_sqm    numeric;
BEGIN
  -- No tocar espacios en MAINTENANCE
  IF EXISTS (
    SELECT 1 FROM spaces WHERE id = v_space_id AND status = 'MAINTENANCE'
  ) THEN
    RETURN;
  END IF;

  SELECT rental_mode, is_divisible, total_sqm
  INTO v_rental_mode, v_is_divisible, v_total_sqm
  FROM spaces WHERE id = v_space_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Contratos completos activos (sin subdivision)
  SELECT COUNT(*) INTO v_whole_count
  FROM lease_spaces ls
  JOIN leases l ON l.id = ls.lease_id
  WHERE ls.space_id = v_space_id
    AND ls.space_subdivision_id IS NULL
    AND l.status = 'ACTIVE'
    AND l.deleted_at IS NULL;

  IF v_whole_count > 0 THEN
    UPDATE spaces SET status = 'RENTED' WHERE id = v_space_id;
    RETURN;
  END IF;

  -- Sin contrato completo: evaluar subdivisiones
  SELECT COUNT(*) INTO v_sub_count
  FROM lease_spaces ls
  JOIN leases l ON l.id = ls.lease_id
  WHERE ls.space_id = v_space_id
    AND ls.space_subdivision_id IS NOT NULL
    AND l.status = 'ACTIVE'
    AND l.deleted_at IS NULL;

  IF v_sub_count = 0 THEN
    UPDATE spaces SET status = 'VACANT' WHERE id = v_space_id;
    RETURN;
  END IF;

  -- Hay subdivisiones activas: ¿completo o parcial?
  IF v_is_divisible AND v_total_sqm IS NOT NULL AND v_total_sqm > 0 THEN
    -- Divisible por metraje: suma allocated_sqm de contratos activos
    SELECT COALESCE(SUM(ls.allocated_sqm), 0) INTO v_alloc_sqm
    FROM lease_spaces ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = v_space_id
      AND l.status = 'ACTIVE'
      AND l.deleted_at IS NULL;

    IF v_alloc_sqm >= v_total_sqm THEN
      UPDATE spaces SET status = 'RENTED' WHERE id = v_space_id;
    ELSE
      UPDATE spaces SET status = 'PARTIAL' WHERE id = v_space_id;
    END IF;
  ELSE
    -- Subdivisiones discretas: compara activas vs total de subs activas del espacio
    SELECT COUNT(*) INTO v_total_subs
    FROM space_subdivisions
    WHERE space_id = v_space_id
      AND is_active = true
      AND deleted_at IS NULL;

    IF v_total_subs = 0 OR v_sub_count >= v_total_subs THEN
      UPDATE spaces SET status = 'RENTED' WHERE id = v_space_id;
    ELSE
      UPDATE spaces SET status = 'PARTIAL' WHERE id = v_space_id;
    END IF;
  END IF;
END;
$$;

CREATE TRIGGER trigger_sync_space_status
AFTER INSERT OR UPDATE OR DELETE ON lease_spaces
FOR EACH ROW EXECUTE FUNCTION sync_space_status_from_lease();


-- ── 10b. check_lease_space_consistency ───────────────────────
-- Adaptado de check_lease_room_consistency.
-- Bloquea:
--   a) contrato completo cuando el espacio tiene subdivisiones rentadas activas
--   b) subdivisión cuando el espacio ya tiene un contrato completo activo
--   c) para espacios divisibles por metraje: suma de allocated_sqm no puede exceder total_sqm

CREATE OR REPLACE FUNCTION check_lease_space_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_space_id   uuid;
  v_total_sqm  numeric;
  v_used_sqm   numeric;
  v_new_sqm    numeric;
  v_exclude_id uuid;
BEGIN
  v_space_id := NEW.space_id;

  -- Para UPDATE excluimos la fila actual; para INSERT no hay nada que excluir
  IF TG_OP = 'UPDATE' THEN
    v_exclude_id := OLD.id;
  ELSE
    v_exclude_id := NULL;
  END IF;

  -- Caso A: contrato completo → verificar que no hay subdivisiones activas
  IF NEW.space_subdivision_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM lease_spaces ls
      JOIN leases l ON l.id = ls.lease_id
      WHERE ls.space_id = v_space_id
        AND ls.space_subdivision_id IS NOT NULL
        AND l.status = 'ACTIVE'
        AND l.deleted_at IS NULL
        AND (v_exclude_id IS NULL OR ls.id != v_exclude_id)
    ) THEN
      RAISE EXCEPTION 'No se puede crear contrato completo: el espacio tiene subdivisiones rentadas individualmente';
    END IF;
  END IF;

  -- Caso B: subdivisión → verificar que no hay contrato completo activo
  IF NEW.space_subdivision_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM lease_spaces ls
      JOIN leases l ON l.id = ls.lease_id
      WHERE ls.space_id = v_space_id
        AND ls.space_subdivision_id IS NULL
        AND l.status = 'ACTIVE'
        AND l.deleted_at IS NULL
        AND (v_exclude_id IS NULL OR ls.id != v_exclude_id)
    ) THEN
      RAISE EXCEPTION 'No se puede rentar subdivisión: el espacio ya tiene un contrato completo activo';
    END IF;

    -- Caso C: espacio divisible por metraje → validar que suma no excede total_sqm
    SELECT s.total_sqm INTO v_total_sqm
    FROM spaces s
    WHERE s.id = v_space_id
      AND s.is_divisible = true;

    IF v_total_sqm IS NOT NULL AND v_total_sqm > 0 THEN
      v_new_sqm := COALESCE(NEW.allocated_sqm, 0);

      SELECT COALESCE(SUM(ls.allocated_sqm), 0) INTO v_used_sqm
      FROM lease_spaces ls
      JOIN leases l ON l.id = ls.lease_id
      WHERE ls.space_id = v_space_id
        AND l.status = 'ACTIVE'
        AND l.deleted_at IS NULL
        AND (v_exclude_id IS NULL OR ls.id != v_exclude_id);

      IF v_used_sqm + v_new_sqm > v_total_sqm THEN
        RAISE EXCEPTION
          'Metraje excede capacidad del espacio: %.2f m² disponibles, se intentan agregar %.2f m²',
          (v_total_sqm - v_used_sqm),
          v_new_sqm;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_lease_space_consistency
BEFORE INSERT OR UPDATE ON lease_spaces
FOR EACH ROW EXECUTE FUNCTION check_lease_space_consistency();


COMMIT;
