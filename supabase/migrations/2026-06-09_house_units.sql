BEGIN;

-- Paso 1: unit_type por cada casa que aún no tenga uno
INSERT INTO unit_types (building_id, company_id, name, bedrooms, bathrooms)
SELECT
  b.id,
  b.company_id,
  'Casa',
  GREATEST(COALESCE((b.building_features->>'bedrooms')::int, 1), 1),
  GREATEST(COALESCE((b.building_features->>'full_bathrooms')::int, 1), 1)
FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM unit_types ut
    WHERE ut.building_id = b.id
      AND ut.deleted_at IS NULL
  );

-- Paso 2: unit por cada casa que aún no tenga una
INSERT INTO units (company_id, building_id, unit_type_id, unit_number, display_code, status, rental_type)
SELECT
  b.company_id,
  b.id,
  ut.id,
  '1',
  NULL,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM leases l2
      WHERE l2.building_id = b.id
        AND l2.unit_id IS NULL
        AND l2.status = 'ACTIVE'
        AND l2.deleted_at IS NULL
    ) THEN 'RENTED'::unit_status
    ELSE 'VACANT'::unit_status
  END,
  COALESCE(b.building_features->>'rental_mode', 'whole')
FROM buildings b
JOIN unit_types ut ON ut.building_id = b.id AND ut.deleted_at IS NULL
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM units u
    WHERE u.building_id = b.id
      AND u.deleted_at IS NULL
  );

-- Paso 3: asignar unit_id a contratos de casas que tengan unit_id = NULL (0 filas esperadas)
UPDATE leases l
SET unit_id = u.id
FROM units u
JOIN buildings b ON b.id = u.building_id
WHERE b.building_category = 'residential_single'
  AND l.building_id = b.id
  AND l.unit_id IS NULL
  AND l.deleted_at IS NULL
  AND u.deleted_at IS NULL;

-- Paso 4: insertar tarea configure_spaces para casas sin ella
INSERT INTO building_setup_tasks (building_id, company_id, task_key, feature_key, is_completed)
SELECT b.id, b.company_id, 'configure_spaces', 'house_setup', false
FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM building_setup_tasks bst
    WHERE bst.building_id = b.id AND bst.task_key = 'configure_spaces'
  );

-- Paso 5: insertar tarea add_first_lease para casas sin ella
INSERT INTO building_setup_tasks (building_id, company_id, task_key, feature_key, is_completed)
SELECT b.id, b.company_id, 'add_first_lease', 'house_setup', false
FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM building_setup_tasks bst
    WHERE bst.building_id = b.id AND bst.task_key = 'add_first_lease'
  );

COMMIT;
