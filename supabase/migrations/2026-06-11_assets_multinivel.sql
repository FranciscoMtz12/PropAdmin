-- ============================================================
-- FASE 1-B: Adaptar tabla assets al modelo multinivel
-- ============================================================
-- HALLAZGO PRE-MIGRACIÓN:
--   space_id NO existía en assets (no hay conflicto de FK).
--   FKs viejos: building_id → buildings, unit_id → units (ambos NOT NULL).
--   395 assets viejos conservan building_id/unit_id intactos.
--
-- CAMBIOS:
--   1. building_id, unit_id → nullable (los datos viejos no se tocan)
--   2. ADD property_id → properties (nullable)
--   3. ADD space_group_id → space_groups (nullable)
--   4. ADD space_id → spaces (nullable, nuevo modelo)
--   5. Índices en las nuevas FKs
--   6. Insertar 3 assets del seed de Inmobiliaria Demo

-- 1. Hacer nullable las columnas del modelo viejo
ALTER TABLE assets ALTER COLUMN building_id DROP NOT NULL;
ALTER TABLE assets ALTER COLUMN unit_id     DROP NOT NULL;

-- 2-4. Nuevas columnas del modelo nuevo
ALTER TABLE assets ADD COLUMN property_id    uuid REFERENCES properties(id);
ALTER TABLE assets ADD COLUMN space_group_id uuid REFERENCES space_groups(id);
ALTER TABLE assets ADD COLUMN space_id       uuid REFERENCES spaces(id);

-- 5. Índices en nuevas FKs
CREATE INDEX idx_assets_property_id    ON assets(property_id)    WHERE property_id    IS NOT NULL;
CREATE INDEX idx_assets_space_group_id ON assets(space_group_id) WHERE space_group_id IS NOT NULL;
CREATE INDEX idx_assets_space_id       ON assets(space_id)       WHERE space_id       IS NOT NULL;

-- 6. Insertar los 3 assets que faltaron en el seed (Inmobiliaria Demo)
--    company_id: 2672224b-b1d9-46fc-83b5-7b3f2cab29dd

-- Asset 1: Cisterna — cuelga de Edificio Cedro (solo property_id)
INSERT INTO assets (company_id, property_id, asset_type, name, status)
VALUES (
  '2672224b-b1d9-46fc-83b5-7b3f2cab29dd',
  'c2b855bc-5540-477c-8afc-8978632c6146',  -- Edificio Cedro
  'hidraulico',
  'Cisterna',
  'ACTIVE'
);

-- Asset 2: Rampa — cuelga de Nave 4 en Parque Las Cruces (property_id + space_group_id)
INSERT INTO assets (company_id, property_id, space_group_id, asset_type, name, status)
VALUES (
  '2672224b-b1d9-46fc-83b5-7b3f2cab29dd',
  'e0bcbc4d-9b5d-4a31-819d-1929273c1e2e',  -- Parque Las Cruces
  '020436ee-5afa-49a2-9dfc-edb9cd649da8',  -- Nave 4
  'acceso',
  'Rampa de carga Nave 4',
  'ACTIVE'
);

-- Asset 3: Clima — cuelga del Depto 101 de Edificio Cedro (property_id + space_id)
INSERT INTO assets (company_id, property_id, space_id, asset_type, name, status)
VALUES (
  '2672224b-b1d9-46fc-83b5-7b3f2cab29dd',
  'c2b855bc-5540-477c-8afc-8978632c6146',  -- Edificio Cedro
  'e9fbbd9f-65a7-45b3-b1c7-db4e169b0b77',  -- Depto 101
  'climatizacion',
  'Minisplit Depto 101',
  'ACTIVE'
);
