-- =============================================================================
-- ÍNDICES FASE B — PropAdmin / SAPROA
-- Generado: 2026-05-29  |  Aplicar manualmente en Supabase SQL Editor
--
-- Notas de aplicación:
--   · Cada CREATE INDEX CONCURRENTLY debe ejecutarse como sentencia independiente
--     (NO dentro de un bloque BEGIN/COMMIT — CONCURRENTLY no admite transacciones).
--   · En Supabase SQL Editor: pegar y ejecutar un bloque a la vez.
--   · IF NOT EXISTS hace el script seguro para re-ejecutar.
--   · CONCURRENTLY no bloquea lecturas/escrituras durante la creación (seguro en prod).
--
-- Prioridad de aplicación:
--   1. Bloque A — purchase_orders        ← causa directa de /compras (1936ms)
--   2. Bloque B — suppliers / items      ← causa directa de /compras y /suppliers
--   3. Bloque C — soft-delete helpers    ← mejora general en todas las páginas
--   4. Bloque D — otros                  ← mejoras secundarias
-- =============================================================================


-- =============================================================================
-- BLOQUE A: purchase_orders
-- Estado actual: SOLO la clave primaria (pkey). Sin índice en company_id.
-- Impacto: /compras hace full table scan en cada carga de página.
-- =============================================================================

-- A1. Índice principal: filtro base de toda query en /compras (RLS + explicit)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_company_id
  ON public.purchase_orders (company_id);

-- A2. Índice compuesto + parcial para el caso más común:
--     .eq("company_id", x).is("deleted_at", null).eq("status", y)
--     Cubre también queries sin filtro de status (usa el prefijo company_id).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_company_status_active
  ON public.purchase_orders (company_id, status)
  WHERE deleted_at IS NULL;

-- A3. Índice de building para filtros por edificio en /compras (vista por edificio)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_building_id
  ON public.purchase_orders (building_id)
  WHERE deleted_at IS NULL;

-- A4. Índice para el reporte de pagos: join desde payment_report_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_company_created
  ON public.purchase_orders (company_id, created_at DESC)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- BLOQUE B: purchase_order_items, suppliers, supplier_branches
-- Estado actual: solo pkey en las tres tablas.
-- Impacto: loading de ítems de cada OC y lista de proveedores son full scans.
-- =============================================================================

-- B1. Items de órdenes de compra — join más frecuente desde purchase_orders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_items_order_id
  ON public.purchase_order_items (purchase_order_id);

-- B2. Proveedores por empresa — listado en /suppliers y dropdowns en /compras
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_company_id
  ON public.suppliers (company_id);

-- B3. Sucursales de proveedor — lookup al seleccionar proveedor en OC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_branches_supplier_id
  ON public.supplier_branches (supplier_id);

-- B4. Materiales de mantenimiento — join desde maintenance_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_materials_log_id
  ON public.maintenance_materials (maintenance_log_id);


-- =============================================================================
-- BLOQUE C: soft-delete helpers
-- El patrón .is("deleted_at", null) aparece en casi todas las páginas.
-- Las tablas ya tienen índice en company_id/building_id, pero un índice parcial
-- WHERE deleted_at IS NULL es más pequeño y rápido para el caso activo.
-- Estado de cada tabla al momento de este análisis:
--   buildings  — tiene idx_buildings_company_id (full), sin parcial activo
--   units      — tiene idx_units_building_id (full), sin parcial activo
--   leases     — tiene leases_building_id_idx WHERE deleted_at IS NULL, pero
--                  NO hay parcial en company_id
--   tenants    — tiene idx_tenants_company_id (full), sin parcial activo
-- =============================================================================

-- C1. Edificios activos — filtro en casi todas las páginas que listan edificios
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_company_active
  ON public.buildings (company_id)
  WHERE deleted_at IS NULL;

-- C2. Unidades activas por edificio — muy frecuente en /buildings y /cobranza
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_units_building_active
  ON public.units (building_id)
  WHERE deleted_at IS NULL;

-- C3. Contratos activos por empresa — /tenants, /calendar, /cobranza
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leases_company_active
  ON public.leases (company_id)
  WHERE deleted_at IS NULL;

-- C4. Inquilinos activos por empresa — /tenants
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_company_active
  ON public.tenants (company_id)
  WHERE deleted_at IS NULL;

-- C5. Metros activos por edificio — /servicios y /cobranza usan .eq("active", true)
--     La query real (con RLS) es: company_id=x AND active=true
--     El índice existente (company_id, building_id, service_type) NO incluye active.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_building_utility_meters_company_active
  ON public.building_utility_meters (company_id, building_id)
  WHERE active = true AND deleted_at IS NULL;


-- =============================================================================
-- BLOQUE D: otros índices secundarios
-- =============================================================================

-- D1. app_users por group_id — queries de group_admin para ver su grupo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_group_id
  ON public.app_users (group_id)
  WHERE group_id IS NOT NULL;

-- D2. payment_reports por fecha — /payments usa rango de fechas:
--     .gte("report_date", startDate).lte("report_date", lastDayOfMonth)
--     El índice existente (company_id, year, week_number) NO cubre report_date range.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_reports_company_date
  ON public.payment_reports (company_id, report_date)
  WHERE deleted_at IS NULL;

-- D3. building_utility_invoices por fecha de vencimiento — queries de cobranza
--     pendiente usan due_date range. El índice compuesto existente
--     (company_id, building_id, period_year, period_month) no cubre due_date.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bui_company_due_date
  ON public.building_utility_invoices (company_id, due_date)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- VERIFICACIÓN (opcional — correr después de crear los índices)
-- Lista todos los índices nuevos para confirmar que se crearon correctamente.
-- =============================================================================
/*
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND tablename IN (
    'purchase_orders', 'purchase_order_items',
    'suppliers', 'supplier_branches', 'maintenance_materials',
    'buildings', 'units', 'leases', 'tenants',
    'building_utility_meters', 'building_utility_invoices',
    'app_users', 'payment_reports'
  )
ORDER BY tablename, indexname;
*/
