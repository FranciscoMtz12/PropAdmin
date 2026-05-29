# Diagnóstico Fase B — Parte 2: /analytics, /mantenimiento, /servicios
Fecha: 2026-05-29

---

## Metodología de medición

El script `measure-perf.mjs` mide `networkidle` con Playwright, reutilizando un mismo
contexto de browser (auth compartida). Cada página que carga "calienta" el connection
pool de Supabase/PostgREST para las siguientes.

| Run | /analytics | /mantenimiento | /servicios |
|-----|-----------|---------------|-----------|
| 1 — warm-up (descartado) | 1 873ms | 2 387ms | 1 166ms |
| 2 | 1 877ms | 1 608ms | 691ms |
| 3 | 721ms | 684ms | 760ms |
| **Promedio R2+R3** | **~1 299ms** | **~1 146ms** | **~726ms** |

**Conclusión de medición:** la enorme varianza entre R2 y R3 en analytics/mantenimiento
(1877ms → 721ms) indica sensibilidad a cold-start del connection pool de Supabase, no a
una query estructuralmente lenta. Aun así, los hallazgos de código que inflan el
cold-start son reales y vale la pena corregirlos.

**Side-finding fuera de scope:** `/dashboard → /saproa-admin/overview` aparece
consistentemente CRÍTICO (~3500ms) en los runs calientes. No se diagnostica aquí pero
conviene incluirlo en la siguiente fase.

---

## 1. /analytics

**Archivo:** `app/analytics/page.tsx`

### 1.1 Queries al cargar

Todas 6 queries corren en paralelo con `Promise.all` — buen patrón.

| # | Tabla | Columnas | Filtros | Limit |
|---|-------|----------|---------|-------|
| 1 | `units` | id, building_id, unit_type_id, status, display_code, unit_number | company_id, deleted_at IS NULL | ninguno |
| 2 | `unit_types` | id, name, bedrooms, building_id | company_id, deleted_at IS NULL | ninguno |
| 3 | `leases` | id, unit_id, tenant_id, status, start_date, end_date, rent_amount | company_id, deleted_at IS NULL | **ninguno — trae TODO el historial** |
| 4 | `tenants` | id, full_name | company_id, deleted_at IS NULL | ninguno |
| 5 | `buildings` | id, name | company_id, deleted_at IS NULL | ninguno |
| 6 | `collection_records` | 11 columnas | company_id, deleted_at IS NULL, due_date >= 12 meses atrás | ninguno |

### 1.2 Hallazgos

#### 🔴 ALTO — Query de `leases` sin filtro de fecha (línea 189–192)

```ts
co(supabase.from("leases")
  .select("id, unit_id, tenant_id, status, start_date, end_date, rent_amount"))
  .is("deleted_at", null)
```

No hay ningún filtro temporal. Trae **todos los contratos históricos** de la empresa desde
el inicio de los tiempos. Con 50 unidades y 5 años de operación puede haber 200-500 leases.
En 10 años: 1 000+. Esta query crece linealmente con la antigüedad de la empresa.

`collection_records` sí usa `.gte("due_date", twelveMonthsAgo)` — ese mismo patrón debería
aplicarse a `leases`.

**Fix propuesto (código):**
```ts
const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), 1)
  .toISOString().slice(0, 10);

co(supabase.from("leases")
  .select("id, unit_id, tenant_id, status, start_date, end_date, rent_amount"))
  .is("deleted_at", null)
  .or(`status.eq.ACTIVE,end_date.gte.${fiveYearsAgo}`)
```
Trae todos los activos + contratos cerrados de los últimos 5 años (suficiente para los 9
cálculos de analytics). Los contratos más viejos no aportan datos relevantes a las gráficas.

**Índice nuevo para esta fix:**
```sql
-- Para el filtro OR(status=ACTIVE, end_date >= cutoff) + company_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leases_company_status_enddate
  ON leases (company_id, status, end_date)
  WHERE deleted_at IS NULL;
```

#### 🟡 MEDIO — O(n×m) scan en `tenantPaymentBehavior` (líneas 407, 429)

```ts
// PROBLEMA 1 — forEach sobre collection_records, con .find() sobre leases dentro:
const lease = r.lease_id ? leases.find((l) => l.id === r.lease_id) : null;

// PROBLEMA 2 — .find() sobre activeLeases para cada tenant:
const activeLease = activeLeases.find((l) => l.tenant_id === tenantId);
```

Con 600 registros de cobro y 200 leases: 120 000 comparaciones. Con la fix del punto
anterior (leases acotados) el impacto baja, pero el patrón sigue siendo ineficiente.

**Fix propuesto (código):**
```ts
// Agregar estos dos useMemo a los Maps existentes:
const leaseById = useMemo(
  () => new Map(leases.map((l) => [l.id, l])),
  [leases]
);
const activeLeasByTenantId = useMemo(
  () => new Map(activeLeases.map((l) => [l.tenant_id, l])),
  [activeLeases]
);

// Luego en tenantPaymentBehavior, reemplazar:
// leases.find(...)  →  leaseById.get(r.lease_id)
// activeLeases.find(...)  →  activeLeasByTenantId.get(tenantId)
```

#### 🟢 BAJO — `typologyPerformance` con nested loops (líneas 274–308)

Para cada unit_type → filtra units → filtra leases por unidad. O(unitTypes × units × leases).
Con datos acotados (fix #1) el impacto es bajo. Podría mejorarse agrupando leases por unit_id
en un Map previo, pero tiene poco efecto práctico con volúmenes normales.

---

## 2. /mantenimiento

**Archivo:** `app/maintenance/page.tsx`

### 2.1 Secuencia real de queries al cargar

**IMPORTANTE:** Esta página hace las queries en SERIE, no todas en paralelo.

```
Fase 1 — Promise.all (paralelo):
  ├─ maintenance_categories
  ├─ buildings (con address)
  ├─ maintenance_logs LIMIT 200 con joins a buildings + units
  ├─ companies (logo, nombre)
  └─ suppliers

Fase 2 — await loadCalendarData() ← SERIAL, espera a que Fase 1 termine
  └─ Promise.all (paralelo):
       ├─ buildings (OTRA VEZ — duplicado)
       └─ maintenance_logs LIMIT 1000 (sin joins)

Fase 3 — Condicional (serial, dentro de loadCalendarData):
  ├─ buildings IN (ids extraídos de los 1000 logs)
  └─ units IN (ids extraídos de los 1000 logs)

Fase 4 — setLoadingData(false)
```

El usuario espera a que Fases 1+2+3 completen antes de ver la página.

### 2.2 Hallazgos

#### 🔴 ALTO — `loadCalendarData()` cargada en cada render aunque el usuario no vea el calendario (línea 775)

```ts
// En loadInitData(), línea 775 — llamada incondicional:
await loadCalendarData(user?.company_id ?? null);
setLoadingData(false); // ← se bloquea hasta que el calendario cargue
```

La función descarga **1 000 filas de maintenance_logs** (más 2–4 queries adicionales)
aunque el usuario quizá nunca vea el tab de calendario. Este `await` es el responsable
principal de la lentitud: agrega una segunda ida a Supabase completa en serie.

**Fix propuesto (código):**
```ts
// Mover la carga del calendario a un useEffect perezoso:
useEffect(() => {
  if (activeTab === "calendario" && !calendarLoaded && user?.company_id) {
    void loadCalendarData(user.company_id).then(() => setCalendarLoaded(true));
  }
}, [activeTab, calendarLoaded, user?.company_id]);

// En loadInitData(): eliminar la línea `await loadCalendarData(...)` y
// setLoadingData(false) directamente después del Promise.all.
```
Resultado: la página muestra en ~1 RTT. El calendario carga solo cuando el usuario lo pide.

#### 🔴 ALTO — `buildings` se consulta DOS veces (líneas 727 y 783–787)

`loadInitData` y `loadCalendarData` ambas consultan `buildings` con las mismas columnas
(`id, name, code, address`). Con la lazy-load fix anterior esto desaparece si `buildData`
de `loadInitData` se pasa a `loadCalendarData`.

**Fix propuesto:** pasar `buildData` ya cargado como parámetro a `loadCalendarData(companyId, buildings)`.

#### 🟡 MEDIO — `maintenance_logs LIMIT 200` con joins embebidos (líneas 733–745)

Cada registro incluye `buildings(id, name, address)` y `units(id, unit_number, display_code)`
como joins. Esto obliga a Postgres a hacer un JOIN por fila. Con 200 registros son hasta 400
lookups extra.

**Fix propuesto (código):** quitar los joins embebidos y enriquecer en cliente con los Maps
ya disponibles (`buildingMap` de la query de buildings ya cargada).

**Índices nuevos para las queries de mantenimiento:**
```sql
-- Para la query principal de tickets (ORDER BY created_at DESC, filtro por company_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maint_logs_company_created
  ON maintenance_logs (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Para la query de calendario (ORDER BY performed_at DESC NULLS LAST, created_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maint_logs_company_performed
  ON maintenance_logs (company_id, performed_at DESC NULLS LAST, created_at DESC)
  WHERE deleted_at IS NULL;
```

#### 🟢 BAJO — `suppliers` sin limit en la página de mantenimiento (línea 751–756)

Trae todos los suppliers activos sin límite. Para empresas con muchos proveedores puede
crecer. Fix: `.limit(500)` o paginar en el selector.

---

## 3. /servicios

**Archivo:** `app/servicios/page.tsx`

### 3.1 Secuencia real de queries al cargar

```
Fase 1 — await buildings (SERIAL — waterfall)
  └─ extrae bIds

Fase 2 — Promise.all (paralelo, pero bloqueado hasta Fase 1):
  ├─ building_utility_meters (select="*", IN building_ids)
  ├─ units (IN building_ids)
  └─ building_utility_invoices (select="*", IN building_ids, filtro por periodo)

+ Por separado (segundo useEffect): loadPendingMeters() — serial, independiente
```

### 3.2 Hallazgos

#### 🔴 ALTO — Waterfall buildings → Promise.all (líneas 621–654)

```ts
// Fase 1 (serial):
const { data: buildingsData } = await co(supabase.from("buildings")...);
const bIds = buildingsData.map(b => b.id);

// Fase 2 (bloqueado hasta que Fase 1 termine):
const [umRes, unitsRes, uiRes] = await Promise.all([
  supabase.from("building_utility_meters")...in("building_id", bIds),
  supabase.from("units")...in("building_id", bIds),
  supabase.from("building_utility_invoices")...in("building_id", bIds),
]);
```

La dependencia en `bIds` es real: los IN requieren conocer los IDs de edificios primero.
Pero esa dependencia puede eliminarse si las tablas de medidores e invoices tienen
`company_id` propio (probable).

**Fix propuesto (código):**
```ts
// Fetch buildings + meters + units + invoices en paralelo usando company_id directamente:
const [buildRes, umRes, unitsRes, uiRes] = await Promise.all([
  co(supabase.from("buildings").select("id, name, company_id")).is("deleted_at", null).order("name"),
  co(supabase.from("building_utility_meters").select("*")).eq("active", true).is("deleted_at", null),
  co(supabase.from("units").select("id, unit_number, building_id")).is("deleted_at", null),
  co(supabase.from("building_utility_invoices").select("*"))
    .eq("period_year", year).eq("period_month", month).is("deleted_at", null),
]);
```
Requiere verificar que `building_utility_meters` y `building_utility_invoices` tengan
`company_id` y que el helper `co()` funcione sobre ellas.

Ahorro estimado: 1 RTT completo a Supabase (~200–400ms según latencia).

#### 🟡 MEDIO — `select("*")` en meters e invoices (líneas 637, 648)

```ts
supabase.from("building_utility_meters").select("*")
supabase.from("building_utility_invoices").select("*")
```

Traen todas las columnas aunque el render solo use un subconjunto. Conviene enumerar
columnas explícitamente para reducir payload.

**Fix propuesto (código):** identificar qué columnas usa el render y restringir el select.

#### 🟢 BAJO — `loadPendingMeters()` como segundo useEffect (línea 583)

Corre en paralelo con `loadData()` al montar el componente — no bloquea el render principal.
Impacto mínimo. Si se quiere consolidar, incluirla en el Promise.all de Fase 1 de `loadData`.

**Índices nuevos para servicios:**
```sql
-- Para la query de meters por building_id + active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bum_building_active
  ON building_utility_meters (building_id, active, deleted_at);

-- Para la query de invoices por building_id + periodo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bui_building_period
  ON building_utility_invoices (building_id, period_year, period_month, deleted_at);
```

---

## Resumen por impacto

| Impacto | Página | Problema | Tipo de fix |
|---------|--------|----------|-------------|
| 🔴 Alto | /mantenimiento | `loadCalendarData` serial + 1 000 rows en cada carga | Código: lazy-load al cambiar a tab calendario |
| 🔴 Alto | /mantenimiento | `buildings` consultada dos veces | Código: pasar resultado como parámetro |
| 🔴 Alto | /analytics | `leases` sin filtro de fecha → historial completo | Código: filtro OR(ACTIVE, end_date ≥ 5 años) + índice |
| 🔴 Alto | /servicios | Waterfall buildings → Promise.all | Código: parallelizar usando company_id directo |
| 🟡 Medio | /analytics | O(n×m) scan en `tenantPaymentBehavior` | Código: Map lookup en lugar de Array.find |
| 🟡 Medio | /mantenimiento | `maintenance_logs LIMIT 200` con joins embebidos | Código: quitar joins, enriquecer en cliente |
| 🟡 Medio | /mantenimiento | Índice faltante para ORDER BY created_at | SQL (ver abajo) |
| 🟡 Medio | /mantenimiento | Índice faltante para ORDER BY performed_at | SQL (ver abajo) |
| 🟡 Medio | /servicios | `select("*")` en meters e invoices | Código: columnas explícitas |
| 🟢 Bajo | /servicios | `loadPendingMeters` como segundo effect | Código opcional: consolidar en Promise.all |
| 🟢 Bajo | /mantenimiento | suppliers sin limit | Código: `.limit(500)` |

---

## SQL para Francisco (NO aplicar aún)

```sql
-- /analytics: leases con filtro de fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leases_company_status_enddate
  ON leases (company_id, status, end_date)
  WHERE deleted_at IS NULL;

-- /mantenimiento: tickets por company + created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maint_logs_company_created
  ON maintenance_logs (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- /mantenimiento: calendario por company + performed_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maint_logs_company_performed
  ON maintenance_logs (company_id, performed_at DESC NULLS LAST, created_at DESC)
  WHERE deleted_at IS NULL;

-- /servicios: meters por building + active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bum_building_active
  ON building_utility_meters (building_id, active, deleted_at);

-- /servicios: invoices por building + periodo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bui_building_period
  ON building_utility_invoices (building_id, period_year, period_month, deleted_at);
```
