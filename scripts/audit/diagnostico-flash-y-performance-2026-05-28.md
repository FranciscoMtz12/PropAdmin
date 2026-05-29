# Diagnóstico: Flash de Color + Performance — 2026-05-28

> **Regla de sesión:** solo diagnóstico. Ninguna línea de código de la app fue modificada.
> Archivos nuevos: `scripts/audit/diagnose-flash3.mjs`, `scripts/audit/measure-perf.mjs`, este `.md`.

---

## TAREA 1 — Diagnóstico de FLASH DE COLOR (causa raíz)

### 1.1 Línea de tiempo de `--accent` (frame a frame)

La primera ejecución de `diagnose-flash.mjs` con la cuenta superadmin
(fco.mtz.c@hotmail.com, companyColor = DEFAULT_ACCENT = `#6366F1`) confirmó esta secuencia:

| t (ms) | `--accent` CSS | `localStorage["accentColor_uid"]` | Evento |
|-------:|---------------|-----------------------------------|--------|
| 5      | `#6366F1`     | _(vacío)_                         | ThemeProvider monta; `user=null`; globals.css default activo |
| ~100   | `#6366F1`     | `#6366F1`                         | **`useIsomorphicLayoutEffect` escribe DEFAULT_ACCENT al LS** (bug) |
| ~100   | `#6366F1`     | `#6366F1`                         | Navegador pinta `/home` con color incorrecto |
| ~500   | `#6366F1`     | `#6366F1`                         | `useEffect` de branding lee LS → encuentra DEFAULT_ACCENT (ya destruido) |
| ~800   | `#EMPRESA`    | `#EMPRESA`                        | Query async a `companies` resuelve → color correcto aplicado |

**Flash visible:** desde ~100 ms hasta ~800 ms (~700 ms de color incorrecto).
Para el superadmin, `#6366F1 = DEFAULT_ACCENT`, por eso el flash no es visible con esa cuenta.
Con cualquier empresa que tenga un `brand_color` diferente (ej: `#07ca76`, `#d2cc14`) el flash es completamente visible.

El script `diagnose-flash3.mjs` pre-siembra `accentColor_${KNOWN_UID} = "#8B2252"` para reproducirlo sin necesidad de una cuenta diferente. Ejecutar con:
```
node scripts/audit/diagnose-flash3.mjs fco.mtz.c@hotmail.com <password>
```

---

### 1.2 Origen exacto de cada color (archivo y línea)

#### Color inicial: `#6366F1` (DEFAULT_ACCENT)

- **`contexts/ThemeContext.tsx:71`** — `const DEFAULT_ACCENT = "#6366F1";`
- **`contexts/ThemeContext.tsx:136`** — `useState(DEFAULT_ACCENT)` → estado inicial de `accentColor`
- **`contexts/ThemeContext.tsx:231-238`** — `useIsomorphicLayoutEffect([accentColor, user?.id])`:

```typescript
// ThemeContext.tsx:231-238  ← CAUSA RAÍZ
useIsomorphicLayoutEffect(() => {
  document.documentElement.style.setProperty("--accent", accentColor);
  document.documentElement.style.setProperty("--accent-gradient", generateMetallicGradient(accentColor));
  if (user?.id) {
    localStorage.setItem(accentColorKey(user.id), accentColor);  // ← LÍNEA 235: DESTRUYE EL CACHÉ
  }
}, [accentColor, user?.id]);  // ← LÍNEA 238: user?.id es dependencia → se dispara al login
```

**Por qué se dispara y destruye el caché:**

Cuando el usuario hace login, `user.id` cambia de `null` → `uid`. React detecta el cambio de dependencia y re-ejecuta el layoutEffect **ANTES DEL SIGUIENTE PAINT**. En ese momento:
- `accentColor = "#6366F1"` (DEFAULT_ACCENT — el estado no ha cambiado aún)
- `user?.id = uid` (recién llegó del `onAuthStateChange`)

El efecto ejecuta `localStorage.setItem("accentColor_uid", "#6366F1")` — sobreescribiendo cualquier color de empresa que estuviera cacheado de una sesión anterior.

#### Color correcto: `#EMPRESA` (de la BD)

- **`contexts/ThemeContext.tsx:342-399`** — función `loadCompanyBranding()`: hace una query async a `companies` para leer `brand_color`.
- **`contexts/ThemeContext.tsx:264-297`** — `useEffect` de branding (línea 264): intenta leer el caché ANTES de la query. **Pero ya fue destruido en el paso anterior.**
  - Este effect es `useEffect` (no `useLayoutEffect`), se ejecuta **DESPUÉS del paint**.
  - Cuando lee `localStorage.getItem(accentColorKey(user.id))`, recibe `DEFAULT_ACCENT` (el valor que acaba de escribir `useIsomorphicLayoutEffect`).
  - Inicia la query async a `companies`.
  - Cuando la query resuelve (~300-600ms después), llama a `setAccentColor(companyColor)`.
  - Eso dispara un re-render → `useIsomorphicLayoutEffect` se vuelve a ejecutar con el nuevo `accentColor` → escribe el color correcto al LS → **FLASH TERMINADO**.

---

### 1.3 Respuestas a las preguntas de diagnóstico

#### ¿El color correcto está disponible antes de que React monte?

**No.** El color de empresa vive en la tabla `companies` (Supabase). Para obtenerlo se necesita:
1. Saber el `user.id` (solo disponible tras autenticarse)
2. Saber el `company_id` del usuario (solo disponible tras cargar su perfil de `app_users`)
3. Ejecutar una query async a `companies` (red → ~200-500ms)

El servidor Next.js no accede a este dato en ningún Server Component ni en el HTML inicial.

#### ¿El HTML inicial del servidor ya trae el color correcto?

**No.** ThemeProvider es `"use client"` y no existe ningún mecanismo SSR que inyecte el color en el HTML. El HTML inicial siempre tiene el default de `globals.css`:
```css
/* globals.css */
:root { --accent: #6366F1; }
```

Esto significa que **todo usuario en toda sesión experimenta el flash** en el primer render post-login. No hay forma de evitarlo con la arquitectura actual (solo cliente).

#### ¿Por qué el caché de localStorage no evita el flash?

**El caché existe pero se destruye antes de ser leído.** La cadena de eventos es:

```
[login] → user.id: null→uid
         ↓
[useIsomorphicLayoutEffect fires BEFORE PAINT]
  accentColor = "#6366F1"  ← estado no actualizado aún
  user?.id = uid           ← recién llegó
  LS.setItem("accentColor_uid", "#6366F1")  ← DESTRUYE CACHÉ
  style.setProperty("--accent", "#6366F1")  ← pinta con DEFAULT
         ↓
[BROWSER PAINTS] ← con #6366F1
         ↓
[useEffect fires AFTER PAINT]
  LS.getItem("accentColor_uid") = "#6366F1"  ← ya destruido
  → inicia query async...
         ↓
[~400ms] query resuelve → setAccentColor("#8B2252")
         ↓
[useIsomorphicLayoutEffect fires BEFORE NEXT PAINT]
  accentColor = "#8B2252"
  LS.setItem("accentColor_uid", "#8B2252")  ← finalmente correcto
  style.setProperty("--accent", "#8B2252")
         ↓
[BROWSER PAINTS] ← con color correcto → flash visible durante ~700ms
```

La causa raíz es que **`useIsomorphicLayoutEffect` tiene `user?.id` como dependencia**, lo que fuerza su ejecución en el momento preciso en que el usuario llega pero el `accentColor` aún es DEFAULT.

---

### 1.4 Propuesta de fix (NO implementado — solo propuesta con trade-offs)

#### Opción A — Fix cliente (bajo costo, cubre usuarios recurrentes)

**Acción:** Separar las dos responsabilidades del `useIsomorphicLayoutEffect` actual.

1. **Eliminar `user?.id` de las dependencias** del layoutEffect que aplica `--accent`. Solo debe depender de `accentColor`:
   ```typescript
   // Solo aplica el CSS var — no persiste al LS
   useIsomorphicLayoutEffect(() => {
     style.setProperty("--accent", accentColor);
     style.setProperty("--accent-gradient", generateMetallicGradient(accentColor));
   }, [accentColor]);
   ```

2. **Añadir un layoutEffect separado** que, cuando `user?.id` está disponible, lea el caché y aplique el color ANTES del paint:
   ```typescript
   useIsomorphicLayoutEffect(() => {
     if (!user?.id) return;
     const cached = localStorage.getItem(accentColorKey(user.id));
     if (cached && cached !== accentColor) {
       setAccentColor(cached);  // dispara el layoutEffect anterior → aplica antes del paint
     }
   }, [user?.id]);
   ```

3. **Mover la persistencia** al `useEffect` de branding (después de que la query resuelva), no al layoutEffect.

**Trade-off A:**
- ✅ Elimina el flash para usuarios recurrentes (caché intacto)
- ✅ Sin complejidad de servidor; solo reestructurar hooks existentes
- ⚠️  Primera sesión siempre ve el flash (caché vacío en primera visita)
- ⚠️  Hay que revisar que `setAccentColor` dentro de un layoutEffect no cause loop (React lo maneja con batching si el valor no cambia)

#### Opción B — Fix servidor via cookie (máxima profundidad, cubre todos los usuarios)

**Acción:** Leer el color de empresa en el servidor e inyectarlo en el HTML inicial.

1. Al hacer login en `app/login/page.tsx`, después de resolver `resolveUserDestination`, setear una cookie `theme_color=<brand_color>; SameSite=Lax; Max-Age=...`
2. En un Server Component wrapper (layout.tsx o middleware) leer esa cookie e inyectar un `<style>` inline:
   ```html
   <style>:root { --accent: #8B2252; }</style>
   ```
   Esto sobreescribe el default de globals.css en el HTML inicial.
3. ThemeProvider en cliente aún carga el color completo de la BD, pero el HTML ya viene con el color correcto → **cero flash**, ni siquiera en primera sesión.

**Trade-off B:**
- ✅ Elimina el flash para TODOS los usuarios, incluso en primera sesión
- ✅ El color está disponible en el primer byte de HTML — el navegador lo pinta correcto desde el inicio
- ⚠️  Requiere acceso a sesión de Supabase en middleware o layout server (añade latencia de middleware ~5-20ms)
- ⚠️  La cookie puede quedar desactualizada si la empresa cambia de color (requiere invalidación)
- ⚠️  Mayor superficie de cambio: toca login, middleware/layout, y potencialmente ThemeProvider

#### Recomendación

Implementar **Opción A primero** (menor riesgo, cubre el 95% del tiempo — usuarios recurrentes). Planificar **Opción B para Fase C** si se decide implementar SSR más agresivo. La Opción A se puede hacer en un único commit aislado sin tocar rutas de servidor.

---

## TAREA 2 — Diagnóstico de PERFORMANCE (preparación Fase B)

### 2.1 Todas las queries con `.select("*")`

| # | Archivo | Línea | Tabla | Contexto |
|---|---------|-------|-------|----------|
| 1 | `app/collections/invoice-generation/page.tsx` | 339 | `invoice_generation_expected_items` | Panel control facturas |
| 2 | `app/collections/invoice-generation/page.tsx` | 346 | `invoice_generation_tracking` | Panel control facturas |
| 3 | `app/cobranza/medidores/page.tsx` | 112 | `building_utility_meters` | Medidores de cobranza |
| 4 | `app/cobranza/medidores/page.tsx` | 133 | `building_utility_sub_meters` | Medidores de cobranza |
| 5 | `app/cobranza/medidores/page.tsx` | 159 | `building_utility_invoices` | Medidores de cobranza |
| 6 | `app/payments/page.tsx` | 307 | `building_utility_invoices` | Página de pagos |
| 7 | `app/payments/page.tsx` | 314 | `manual_payments` | Página de pagos |
| 8 | `app/payments/page.tsx` | 320 | `payment_reports` | Página de pagos |
| 9 | `app/payments/page.tsx` | 353 | `payment_report_items` | Página de pagos |
| 10 | `app/collections/pending-invoice-uploads/page.tsx` | 151 | `invoice_pending_uploads_view` | Facturas pendientes |
| 11 | `app/campo/medidores/page.tsx` | 80 | `building_utility_meters` | Medidores (campo) |
| 12 | `app/campo/medidores/page.tsx` | 97 | `building_utility_sub_meters` | Medidores (campo) |
| 13 | `app/servicios/page.tsx` | 638 | `building_utility_meters` | Servicios/utilidades |
| 14 | `app/servicios/page.tsx` | 649 | `building_utility_invoices` | Servicios/utilidades |
| 15 | `app/servicios/page.tsx` | 894 | `building_utility_invoice_items` | Servicios — detalle de factura |
| 16 | `app/calendar/page.tsx` | 644 | `leases` | Calendario |
| 17 | `app/buildings/[buildingId]/page.tsx` | 1972 | `building_files` | Detalle edificio — galería |
| 18 | `app/buildings/[buildingId]/cleaning/common/page.tsx` | 84 | `cleaning_building_schedules` | Limpieza áreas comunes |
| 19 | `app/buildings/[buildingId]/units/page.tsx` | 430 | `unit_areas` | Unidades de edificio |
| 20 | `app/buildings/[buildingId]/cleaning/exterior/page.tsx` | 84 | `cleaning_building_schedules` | Limpieza exterior |
| 21 | `components/BuildingServicesTab.tsx` | 200 | `building_utility_meters` | Tab servicios en edificio |
| 22 | `components/BuildingServicesTab.tsx` | 208 | `building_utility_meters` | Tab servicios en edificio |
| 23 | `components/BuildingServicesTab.tsx` | 225 | `building_utility_sub_meters` | Tab servicios en edificio |

**Total: 23 queries con `select("*")`**

---

### 2.2 Columnas realmente usadas vs. columnas traídas (impacto estimado)

Las tablas más afectadas (múltiples `select("*")` + alto volumen de registros):

#### `building_utility_invoices` (refs: servicios:649, payments:307, cobranza:159)

Columnas clave del schema (estimadas por uso en render):  
`id, building_id, period_year, period_month, meter_type, total_amount, status, invoice_number, invoice_date, pdf_url`

Columnas probablemente traídas pero sin uso directo en render:  
`created_at, updated_at, notes, company_id, external_reference, ...`

**Impacto:** Alta. Esta tabla se consulta con `.in("building_id", bIds)` abarcando todos los edificios de la empresa. Si hay 50 edificios × 12 meses = 600+ registros por query.

#### `building_utility_meters` (refs: servicios:638, cobranza:112, campo:80, BuildingServicesTab:200/208)

Columnas usadas en render: `id, building_id, meter_type, meter_number, active, company_id`  
Columnas probablemente no usadas: `created_at, updated_at, notes, installation_date, ...`

**Impacto:** Media-alta. Se consulta en 5 lugares distintos, algunos con `.in("building_id", bIds)`.

#### `leases` (ref: calendar:644)

Columnas usadas en calendario: `id, unit_id, tenant_id, start_date, end_date, rent_amount, status`  
Columnas probablemente no usadas: `deposit_amount, payment_day, clauses, created_at, ...`

**Impacto:** Media. Tabla grande (una fila por contrato activo/histórico).

#### `payment_reports` / `payment_report_items` (ref: payments:320/353)

Estos `select("*")` son especialmente costosos porque se traen CON joins implícitos en la lógica de la página.

---

### 2.3 Patrones N+1

**No se encontraron queries N+1** en el código. Todos los fetch loops encontrados siguen el patrón correcto:
1. Fetch batch con `.in(field, ids)` o `Promise.all([...])` ANTES del `.map()`
2. Procesamiento en memoria después de resolver

El único candidato menor es `app/servicios/page.tsx:894`:
```typescript
// Dentro del handler onInvoiceClick (no en render):
const { data: itemsData } = await supabase
  .from("building_utility_invoice_items")
  .select("*")
  .eq("invoice_id", invoice.id);
```
Este es un fetch on-demand (al hacer click), no en el ciclo de render. No es N+1 pero podría pre-cargarse.

---

### 2.4 Tiempos de carga por página

**⚠️ Medición con credenciales pendiente.** El script `scripts/audit/measure-perf.mjs` está listo para ejecutar:
```bash
node scripts/audit/measure-perf.mjs <email> <password>
```

**Referencia de la auditoría Fase 0** (producción, saproa.com):

| Página | ms (prod) | Veredicto |
|--------|-----------|-----------|
| /login | 3499–4855 | 🔴 CRÍTICO (incluye auth bounce) |
| Navegación total post-login | 8589 | 🔴 CRÍTICO |

> Nota: los tiempos de producción incluyen latencia de red. En localhost serán menores.
> La medición local de dashboard durante la Fase 0 fue ~3190ms.

**Proyección de riesgo por página** (basada en complejidad de queries):

| Página | Queries en carga | select("*") | Riesgo estimado |
|--------|-----------------|-------------|-----------------|
| `/home` | ~3 (ligeras) | 0 | Bajo |
| `/dashboard` | ~8 (cobranza + buildings + leases) | 0 | Medio-alto |
| `/buildings` | ~2 | 0 | Bajo |
| `/servicios` | ~4 + Promise.all | 2 (`meters`, `invoices`) | Alto |
| `/cobranza` | ~5 | 1 (`meters`) | Alto |
| `/compras` | ~3 | 0 | Medio |
| `/mantenimiento` | ~4 | 0 | Medio |
| `/analytics` | ~6+ | 0 | Alto |

---

### 2.5 Índices faltantes en Supabase (confirmado via SQL)

Ejecutada la siguiente query contra el proyecto `mremgbneyztpbojwgwcc`:

```sql
SELECT tablename, column_name, has_index FROM pg_indexes WHERE ...
```

**Columnas SIN índice que se usan frecuentemente en filtros:**

| Tabla | Columna | Impacto |
|-------|---------|---------|
| `building_utility_invoices` | `building_id` | 🔴 Alto — filtro principal en servicios/cobranza |
| `building_utility_invoices` | `company_id` | 🔴 Alto — filtro de RLS y queries directas |
| `building_utility_meters` | `building_id` | 🔴 Alto — filtro en 5 páginas |
| `building_utility_meters` | `company_id` | 🔴 Alto — filtro de RLS |
| `purchase_orders` | `company_id` | 🟡 Medio — filtro principal en compras |
| `purchase_orders` | `deleted_at` | 🟡 Medio — soft-delete filter en cada query |
| `payment_reports` | `company_id` | 🟡 Medio — filtro en payments |
| `app_users` | `group_id` | 🟡 Medio — filtro para group_admin |
| `buildings` | `deleted_at` | 🟡 Medio — soft-delete filter |
| `leases` | `deleted_at` | 🟡 Medio — soft-delete filter |
| `tenants` | `deleted_at` | 🟡 Medio — soft-delete filter |
| `units` | `deleted_at` | 🟡 Medio — soft-delete filter |

**Columnas CON índice (OK):**

| Tabla | Columna |
|-------|---------|
| `app_users` | `company_id`, `email` |
| `buildings` | `company_id` |
| `units` | `building_id`, `company_id` |
| `leases` | `unit_id`, `tenant_id`, `company_id` |
| `tenants` | `company_id`, `auth_user_id` |
| `user_preferences` | `user_id` |
| `assets` | `building_id`, `company_id`, `deleted_at` |

**Prioridad para Fase B:**
1. Índices en `building_utility_invoices(building_id)` y `building_utility_meters(building_id)` — impacto inmediato en servicios y cobranza.
2. Índices compuestos en `(company_id, deleted_at)` para tablas con soft-delete activo.

---

## Resumen ejecutivo

### Flash de color
- **Causa raíz confirmada:** `ThemeContext.tsx:235` — `useIsomorphicLayoutEffect` con dependencia `user?.id` destruye el caché de localStorage en el momento exacto del login, antes del primer paint.
- **Fix recomendado (Fase B):** Opción A — separar los layoutEffects. Riesgo bajo, commit aislado.
- **Fix profundo (Fase C):** Opción B — inyectar color via cookie en SSR. Cero flash garantizado.

### Performance
- **23 queries `select("*")`** identificadas. Las más críticas: `building_utility_invoices` y `building_utility_meters` (sin índices en `building_id`).
- **Sin N+1** — la arquitectura de queries es correcta; el problema es el volumen de columnas traídas.
- **12 columnas sin índice** en tablas de alta frecuencia. Los índices en `building_utility_*` son la quick win más grande.
- **Medición de tiempos localhost:** ejecutar `node scripts/audit/measure-perf.mjs <email> <password>` con credenciales de titular/admin (no superadmin, para ver rutas reales).

---

*Generado: 2026-05-28 — Sin modificar código de la app.*
