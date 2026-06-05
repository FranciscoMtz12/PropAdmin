# Inventario Clasificado de Colores — Fase D
Fecha: 2026-05-29

> **SOLO DIAGNÓSTICO** — ningún color fue modificado.

---

## 1. Variables de color ya existentes en globals.css

`app/globals.css` define un sistema robusto de variables CSS con soporte completo light/dark.

### 1.1 Acento / Marca
```css
--accent              → #6366F1 (indigo SAPROA, sobreescrito por JS desde brand_color)
--accent-gradient     → linear-gradient(135deg, #818cf8, #6366F1, #4f46e5)
--group-accent        → #6366F1
--btn-primary-bg      → var(--accent)
--color-primary       → #1E293B (¡ATENCIÓN: este es dark-blue, NO el color de acento!)
```

### 1.2 Texto
```css
--text-primary        → #0F172A / dark: #F1F5F9
--text-secondary      → #64748B / dark: #94A3B8
--text-muted          → #94A3B8 / dark: #64748B
--text-placeholder    → #CBD5E1 / dark: #475569
--text-label          → #94A3B8 / dark: #64748B
--text-subtle         → #CBD5E1 / dark: #475569
```

### 1.3 Fondo
```css
--bg-page             → #F1F5F9 / dark: #0F1623
--bg-card             → #FFFFFF / dark: #1E2535
--bg-card-hover       → #F8FAFC / dark: #243044
--bg-topbar           → #FFFFFF / dark: #1E2535
--bg-input            → #FFFFFF / dark: #243044
--bg-sidebar          → #1E2A3A / dark: #0F1623
--bg-primary          → #F1F5F9 / dark: #0F1623
--background          → #F8FAFC / dark: #0F1623
--bg-table-header     → #F8FAFC / dark: #1A2030
--bg-table-empty      → #F8FAFC / dark: #1A2030
```

### 1.4 Bordes
```css
--border-default      → #E2E8F0 / dark: #2D3748
--border-strong       → #CBD5E1 / dark: #3D4F6A
--border-color        → #E2E8F0 / dark: #2D3748
--border-subtle       → #F1F5F9 / dark: #2D3748
--border-dashed       → #CBD5E1 / dark: #2D3748
```

### 1.5 Semánticas de estado — EXISTEN pero son component-scoped, NO hay shorthand global

Los colores de estado están definidos por componente, en tres familias:

| Familia | Verde (éxito) | Rojo (error) | Ámbar (warning) | Azul (info) |
|---------|--------------|--------------|-----------------|-------------|
| `--icon-*` | bg: #DCFCE7, color: #15803D | bg: #FEE2E2, color: #B91C1C | bg: #FEF3C7, color: #B45309 | bg: #EFF6FF, color: #1D4ED8 |
| `--metric-*` | bg: #F0FDF4, border: #BBF7D0, value: #15803D | bg: #FFF1F2, border: #FECDD3, value: #B91C1C | bg: #FFFBEB, border: #FDE68A, value: #B45309 | bg: #EFF6FF, border: #BFDBFE, value: #1D4ED8 |
| `--badge-*` | bg: #DCFCE7, text: #15803D | bg: #FEE2E2, text: #B91C1C | bg: #FEF3C7, text: #B45309 | bg: #EFF6FF, text: #1D4ED8 |

**Conclusión crítica:** NO existen `--color-error`, `--color-success`, `--color-warning`, `--color-info`
como variables standalone genéricas. Esto significa que los ~120 colores de estado
hardcodeados en el código NO tienen una variable directa a la cual migrar todavía.

### 1.6 Gráficas y otros
```css
--chart-axis / --chart-grid
--shadow-card / --divider / --foreground
```

---

## 2. Inventario completo de colores hardcodeados

### 2.1 Alcance real

| Métrica | Valor |
|---------|-------|
| Archivos escaneados | `app/**/*.tsx` + `components/**/*.tsx` |
| Total referencias hex (#rrggbb) | **573** |
| Colores hex únicos | ~120 distintos |
| Nota | Auditoría de Fase 0 reportó ~748; diferencia = rgba() y rutas adicionales no incluidas aquí |

### 2.2 Top 25 archivos por concentración

| Rank | Archivo | Hex count | Principal problema |
|------|---------|-----------|-------------------|
| 1 | `app/buildings/[buildingId]/page.tsx` | **88** | Mix de todo: acento vino, estados, chart palette |
| 2 | `app/settings/page.tsx` | **46** | 11× #8B2252 (vino legacy), colores de onboarding |
| 3 | `app/purchases/page.tsx` | **38** | 9× #7c3aed (purple), badges de estado |
| 4 | `app/collections/page.tsx` | **24** | Rojos de error, verdes de éxito |
| 5 | `app/register/page.tsx` | **22** | Background dark navy, rojos de validación |
| 6 | `app/buildings/page.tsx` | **22** | Status badges, colores de mapa |
| 7 | `components/Sidebar.tsx` | **20** | #6366F1 activo, colores de nav |
| 8 | `components/CommercialTypologyModal.tsx` | **20** | Colores de tipología, charts |
| 9 | `app/dashboard/page.tsx` | **20** | Métricas con colores de estado inline |
| 10 | `app/login/page.tsx` | **19** | Background #0d1b2a, acento #6366F1 |
| 11 | `components/UnitTypeWizardModal.tsx` | **17** | Colores de pasos del wizard |
| 12 | `app/home/page.tsx` | **16** | Métricas, cards con estado |
| 13 | `app/page.tsx` (landing) | **15** | Branding dark navy intencional |
| 14 | `app/analytics/page.tsx` | **15** | Chart colors (BUILDING_COLORS array) |
| 15 | `components/BuildingServicesTab.tsx` | **14** | Status colores de medidores |
| 16 | `app/privacy/page.tsx` | **11** | Texto legal, backgrounds |
| 17 | `app/terms/page.tsx` | **10** | Mismo patrón que privacy |
| 18 | `app/p/[token]/page.tsx` | **8** | Public ficha, colores de estado |
| 19 | `app/cleaning/page.tsx` | **8** | Status colores |
| 20 | `components/ImpersonationSidebar.tsx` | **8** | Sidebar, colores de nav |
| 21 | `components/ReturnModal.tsx` | **7** | Rojos de error |
| 22 | `app/saproa-admin/impersonar/page.tsx` | **6** | Branding SAPROA |
| 23 | `components/BuildingsMap.tsx` | **6** | Mapa, colores de pines |
| 24 | `app/campo/compras/page.tsx` | **6** | Estados de OC |
| 25 | `app/calendar/page.tsx` | **6** | Colores de eventos |

**Total top-25 = ~476 de 573 (83%)**. El resto está disperso en ~30 archivos pequeños.

### 2.3 Clasificación de los 40 colores más usados

#### Categoría (a) — ACENTO/TEMA
Colores de marca/acento que deben ser `var(--accent)` u otras variables de tema.

| Color | Ocurrencias | Contexto | Mapeo propuesto |
|-------|------------|----------|-----------------|
| `#8B2252` | 38 | **Vino legacy** — mayormente en settings (11×), buildings detail (7×). TODOS son usos incorrectos del acento anterior de SAPROA antes del rebrand a indigo. | → `var(--accent)` |
| `#6366F1` | 25 | Indigo SAPROA — en Sidebar (6×), login (5×), overview, etc. Coincide con `--accent` actual. | → `var(--accent)` |
| `#0369a1` | 22 | Azul cyan — usado intensamente en buildings detail. Podría ser un acento secundario o color de info/link. Ver **Riesgo #1**. | → nuevo `--accent-secondary` o `var(--metric-value-blue)` |
| `#7c3aed` + `#7C3AED` | 16 | Purple — 9× en purchases (probablemente categoría/label). Ver **Riesgo #2**. | → nuevo `--color-category` o chart palette |
| `#a855f7` + `#A855F7` | 8 | Purple claro — analytics chart colors | → chart palette fijo |
| `#8B5CF6` | 3 | Violet — chart color | → chart palette fijo |
| `#EC4899` | 3 | Pink — chart color | → chart palette fijo |
| `#93c5fd` | 5 | Celeste claro — badge/bg de info | → `var(--badge-bg-blue)` |

**Subtotal (a): ~120 instancias**

#### Categoría (b) — SEMÁNTICO DE ESTADO
Colores que representan estados (error, éxito, warning, info). Tienen variables
component-scoped en globals.css pero no un shorthand genérico.

**Error / Rojo:**
| Color | Ocurrencias | Mapeo |
|-------|------------|-------|
| `#EF4444` + `#ef4444` | 10 | Rojo Tailwind-500. Diferente de `--metric-value-red` (#B91C1C). Necesita `--color-error`. |
| `#f87171` | 7 | Rojo claro Tailwind-400. → `var(--icon-color-red)` en dark o nuevo `--color-error-light` |
| `#fca5a5` | 4 | Rosa error → `var(--badge-bg-red)` adjacent |
| `#FECACA` | 4 | bg error → `var(--badge-bg-red)` ✓ ya existe |
| `#E24B4A` | 3 | Rojo variante |
| `#dc2626` | ~2 | Rojo Tailwind-600 |
| `#991b1b` | ~2 | Rojo muy oscuro |

**Éxito / Verde:**
| Color | Ocurrencias | Mapeo |
|-------|------------|-------|
| `#10B981` | 11 | Verde Tailwind emerald-500. Diferente de `--metric-value-green` (#15803D). Necesita `--color-success`. |
| `#22c55e` | 6 | Verde Tailwind green-500 |
| `#1D9E75` | 6 | Verde-teal personalizado |

**Warning / Ámbar:**
| Color | Ocurrencias | Mapeo |
|-------|------------|-------|
| `#F59E0B` | 9 | Ámbar Tailwind-500 → `--color-warning` |
| `#f97316` + `#F97316` | 11 | Naranja Tailwind-500 (warning adjacent) |
| `#c2410c` | 8 | Naranja oscuro (warning dark) |
| `#b45309` | 4 | Ámbar oscuro. YA existe como `--metric-value-amber`/`--badge-text-amber` ✓ |
| `#92400E` + `#92400e` | 7 | Ámbar muy oscuro. YA existe adjacent a `--metric-value-amber` |
| `#FEF3C7` | 3 | bg warning. YA existe como `--metric-bg-amber`/`--badge-bg-amber` ✓ |
| `#fffbeb` | 3 | bg warning claro |

**Info / Azul:**
| Color | Ocurrencias | Mapeo |
|-------|------------|-------|
| `#3B82F6` | 5 | Azul Tailwind-500 → `--color-info` |
| `#378ADD` | 3 | Azul variante |

**Subtotal (b): ~119 instancias**

#### Categoría (c) — MARCA INTENCIONAL / OTRO
Colores que deben quedar fijos o mapear a variables de estructura ya existentes.

| Color | Ocurrencias | Razón para mantener |
|-------|------------|---------------------|
| `#fff` + `#ffffff` + `#FFFFFF` | 138 | Blanco puro — intentional, OK en la mayoría de contextos |
| `#6b7280` + `#6B7280` | 19 | Gray-500 — cerca de `--text-secondary`. Migrable a var existente. |
| `#0d1b2a` | 12 | Dark navy del splash screen / landing. **Intencional** — branding SAPROA fijo. |
| `#f9eaf3` | 8 | Rosa claro — bg de secciones vino. Probablemente legacy; evaluar en contexto. |
| `#1c3a5e` | 6 | Dark blue — elementos del splash y landing. **Intencional**. |
| `#374151` | 4 | Gray-700 — cerca de `--text-primary`. Migrable. |
| `#f5f3ff` + `#f3e8ff` | 6 | Lavanda claro — bgs decorativos |
| `#f3f4f6` | 3 | Gray-100 — fondo sutil |
| Chart palette completa | ~15 | `BUILDING_COLORS` en analytics y otros arrays de gráficas — **deben quedarse fijos** |

**Subtotal (c): ~334 instancias**

### 2.4 Resumen por categoría

| Categoría | Instancias | % |
|-----------|-----------|---|
| **(a) ACENTO/TEMA** — migrar a var(--accent) u otras vars de tema | **~120** | 21% |
| **(b) SEMÁNTICO DE ESTADO** — migrar a nuevas vars --color-error/success/warning/info | **~119** | 21% |
| **(c) INTENCIONAL/OTRO** — mantener o mapear a vars existentes de estructura | **~334** | 58% |
| **TOTAL** | **~573** | 100% |

---

## 3. Plan de ataque por lotes

### Prerrequisito: Crear variables semánticas en globals.css ANTES de migrar (b)

Las categoría (b) no tiene a dónde ir sin estas variables. Crearlas es el **paso 0** obligatorio.

```css
/* Propuesta — añadir en :root de globals.css */

/* Shorthands semánticos — texto/iconos */
--color-success:      #10B981;   /* emerald-500, para estados de éxito inline */
--color-success-dark: #15803D;   /* = --metric-value-green (para texto en fondo claro) */
--color-error:        #EF4444;   /* red-500, para errores inline */
--color-error-dark:   #B91C1C;   /* = --metric-value-red (para texto en fondo claro) */
--color-warning:      #F59E0B;   /* amber-500, para warnings */
--color-warning-dark: #B45309;   /* = --metric-value-amber */
--color-info:         #3B82F6;   /* blue-500, para info */
--color-info-dark:    #1D4ED8;   /* = --metric-value-blue */
--color-orange:       #F97316;   /* orange-500, warnings de OC/compras */

/* Equivalentes dark mode */
.dark {
  --color-success:      #4ADE80;
  --color-success-dark: #4ADE80;
  --color-error:        #F87171;
  --color-error-dark:   #F87171;
  --color-warning:      #FCD34D;
  --color-warning-dark: #FCD34D;
  --color-info:         #60A5FA;
  --color-info-dark:    #60A5FA;
  --color-orange:       #FB923C;
}
```

**Nota:** Los valores están alineados con los que ya usan `--icon-color-*` y `--metric-value-*`
para mantener consistencia. El dark mode se invierte igual que el sistema existente.

### Lote 1 — Victorias rápidas, bajo riesgo de regresión

Archivos donde la mayoría de colores son claramente (a) o ya mapean a vars existentes:

| Archivo | Hex | Acción principal |
|---------|-----|-----------------|
| `components/Sidebar.tsx` | 20 | `#6366F1` → `var(--accent)`. Alto impacto visual, archivo chico. |
| `components/ImpersonationSidebar.tsx` | 8 | Mismo patrón |
| `app/home/page.tsx` | 16 | Métricas: estados → vars semánticas existentes (`--metric-value-*`) |
| `app/dashboard/page.tsx` | 20 | Igual |
| `app/login/page.tsx` | 19 | `#6366F1` ya correcto, `#0d1b2a` intencional (mantener) |

**Bloqueo:** Sidebar requiere que `--accent` funcione correctamente → ya está ✓

### Lote 2 — Alta concentración, acento legacy

| Archivo | Hex | Acción principal |
|---------|-----|-----------------|
| `app/settings/page.tsx` | 46 | 11× `#8B2252` → `var(--accent)`. Limpiar legacy vino masivamente. |
| `app/collections/page.tsx` | 24 | Rojos/verdes de estado → vars semánticas (requiere Paso 0) |
| `app/buildings/page.tsx` | 22 | Status badges → `--badge-*` ya existentes |
| `app/cleaning/page.tsx` | 8 | Status simples |

**Bloqueo:** collections requiere `--color-error`/`--color-success` del Paso 0.

### Lote 3 — Archivos complejos / muchas categorías mezcladas

| Archivo | Hex | Riesgo | Notas |
|---------|-----|--------|-------|
| `app/purchases/page.tsx` | 38 | ⚠️ MEDIO | 9× `#7c3aed` — ver Riesgo #2. Verificar si son labels de categoría fijos. |
| `app/analytics/page.tsx` | 15 | 🟢 BAJO | `BUILDING_COLORS` array = chart palette fijo. Solo migrar accent si hay. |
| `components/CommercialTypologyModal.tsx` | 20 | 🟢 BAJO | Colores de pasos/wizard, evaluar en contexto |
| `components/UnitTypeWizardModal.tsx` | 17 | 🟢 BAJO | Igual |

### Lote 4 — El grande: buildings detail (clasificación manual requerida)

| Archivo | Hex | Riesgo | Notas |
|---------|-----|--------|-------|
| `app/buildings/[buildingId]/page.tsx` | 88 | ⚠️ ALTO | Mix de todo. Hacer sub-clasificación manual antes de tocar. |

Este archivo tiene `#8B2252` (7×, acento legacy), `#0369a1` (5×, ambiguo), `#10B981`/`#EF4444`
(estados), colores de badge de status de unidades, y posiblemente colores de gráfica.
**Requiere lectura cuidadosa del código antes de migrar.**

### Lote 5 — Legal / públicas (bajo impacto funcional)

`app/privacy/page.tsx` (11), `app/terms/page.tsx` (10), `app/page.tsx` (15) — páginas
informativas con colores de texto y layout. Bajo riesgo, bajo impacto de negocio.

---

## 4. Riesgos identificados

### Riesgo #1 — `#0369a1` (22 instancias): ¿acento secundario o info semántico?

Este azul-cyan aparece en `buildings/[buildingId]/page.tsx` (5×) y en varios lugares
como color de enlace/botón. NO está en globals.css como variable. Puede ser:
- El color de acento que usaba la empresa antes del rebrand
- Un color de "info" usado semánticamente como link/CTA

**Acción recomendada:** auditar el contexto en buildings detail antes de decidir si
va a `--accent-secondary` o a `--color-info`. No migrar a ciegas.

### Riesgo #2 — `#7c3aed` (16 instancias): ¿chart palette o legacy?

Purple concentrado en `purchases/page.tsx` (9×). Podría ser:
- Color de categoría fijo de OC/suppliers (intencional = categoría c)
- Acento de una versión anterior (legacy = categoría a)

**Acción recomendada:** revisar si está ligado a lógica condicional de "tipo de OC" o
simplemente aplicado como color de elemento UI.

### Riesgo #3 — `#0d1b2a` (12 instancias): intencional pero repetido

Dark navy usado en el splash screen, landing, y login. Es el color de fondo de la
pantalla oscura de bienvenida SAPROA. Debe mantenerse hardcodeado O crear una variable
`--bg-splash` específica. **No migrar a `--accent`** — es un color de estructura.

### Riesgo #4 — Whites `#fff`/`#ffffff` (138 instancias): mayormente OK

La mayoría de los blancos son correctos como hardcodeados (texto blanco sobre fondo
acento, íconos sobre fondo de color). Solo los que son color de **fondo de tarjeta**
deberían migrarse a `var(--bg-card)` para compatibilidad con dark mode.

### Riesgo #5 — Valores de color que existen en globals.css con distinto shade

`--metric-value-green` = `#15803D` pero el código hardcodea `#10B981` (shade diferente).
`--metric-value-red` = `#B91C1C` pero el código usa `#EF4444` (más brillante).
Al migrar, decidir si normalizar al shade de globals.css o crear nueva var con el shade real.

---

## 5. Variables nuevas recomendadas (orden de creación)

| Prioridad | Variable | Valor light | Valor dark | Justificación |
|-----------|----------|------------|------------|---------------|
| 🔴 Alta | `--color-error` | `#EF4444` | `#F87171` | 10+ instancias sin mapeo directo |
| 🔴 Alta | `--color-success` | `#10B981` | `#4ADE80` | 11+ instancias, shade distinto al existente |
| 🔴 Alta | `--color-warning` | `#F59E0B` | `#FCD34D` | 9+ instancias |
| 🟡 Media | `--color-info` | `#3B82F6` | `#60A5FA` | 5+ instancias |
| 🟡 Media | `--color-orange` | `#F97316` | `#FB923C` | 11 instancias, purchases/OC |
| 🟢 Baja | `--bg-splash` | `#0d1b2a` | `#0d1b2a` | Centralizar el dark navy del splash |
| 🟢 Baja | `--accent-secondary` | TBD | TBD | Solo si #0369a1 se confirma como acento secundario |
