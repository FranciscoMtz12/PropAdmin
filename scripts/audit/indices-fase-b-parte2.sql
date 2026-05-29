-- Índices Fase B — Parte 2
-- Generados por diagnóstico 2026-05-29
-- APLICAR CON SUPABASE: ejecutar cada bloque en SQL Editor
-- Todos usan CONCURRENTLY para no bloquear la tabla durante la creación.
-- Verificar con: SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '...';

-- ──────────────────────────────────────────────────────────────────────────────
-- /analytics — leases con filtro de fecha
-- Soporta el OR(status=ACTIVE, end_date >= cutoff) + company_id que usa la página
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leases_company_status_enddate
  ON leases (company_id, status, end_date)
  WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- /mantenimiento — tickets ordenados por created_at DESC
-- Soporta la query principal de tickets (LIMIT 200, ORDER BY created_at DESC)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maint_logs_company_created
  ON maintenance_logs (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- /mantenimiento — logs de calendario ordenados por performed_at
-- Soporta la query de calendario (LIMIT 1000, ORDER BY performed_at DESC NULLS LAST)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maint_logs_company_performed
  ON maintenance_logs (company_id, performed_at DESC NULLS LAST, created_at DESC)
  WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- /servicios — medidores por building_id + active
-- Soporta la query de meters en loadData (active=true, deleted_at IS NULL)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bum_building_active
  ON building_utility_meters (building_id, active, deleted_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- /servicios — facturas de servicios por building_id + periodo
-- Soporta la query de invoices filtrada por period_year/period_month
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bui_building_period
  ON building_utility_invoices (building_id, period_year, period_month, deleted_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- /saproa-admin/overview — conteo de usuarios por empresa (SQL opcional)
-- Si el número de usuarios totales crece a miles, reemplazar la query de
-- app_users en overview/page.tsx por una llamada a esta vista:
--
--   supabase.from("v_user_count_by_company").select("company_id, user_count")
--
-- Y en loadData() derivar el total: usersData.reduce((n, r) => n + r.user_count, 0)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_user_count_by_company AS
  SELECT company_id, COUNT(*) AS user_count
  FROM app_users
  WHERE is_superadmin = false AND company_id IS NOT NULL
  GROUP BY company_id;
