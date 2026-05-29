# Inventario de Design System — property-admin
Fecha: 2026-05-29 | Autor: diagnóstico automático | SOLO LECTURA — no se modificó ningún archivo

> **Objetivo:** foto completa del estado actual de todos los elementos visuales,
> tokens CSS, componentes compartidos, duplicados y patrones responsive.
> Base para construir el catálogo de componentes.

---

## Índice

1. [Tokens existentes (globals.css)](#1-tokens-existentes)
2. [Inventario de componentes](#2-inventario-de-componentes)
3. [Espaciado y responsive](#3-espaciado-y-responsive)
4. [Colores hardcodeados](#4-colores-hardcodeados)
5. [Resumen ejecutivo y prioridades](#5-resumen-ejecutivo)

---

## 1. Tokens existentes

**Archivo:** `app/globals.css` (1 092 líneas)

### 1.1 Colores de acento / marca

```css
--accent              → #6366F1  (indigo SAPROA; sobreescrito por JS desde brand_color)
--accent-gradient     → linear-gradient(135deg, #818cf8 0%, #6366F1 45%, #4f46e5 100%)
--group-accent        → #6366F1  (color corporativo del grupo, no cambia en sesión)
--btn-primary-bg      → var(--accent)
--color-primary       → #1E293B  (dark-blue estructural; NO es acento)
```

### 1.2 Colores de texto

```css
--text-primary        → #0F172A      / dark: #F1F5F9
--text-secondary      → #64748B      / dark: #94A3B8
--text-muted          → #94A3B8      / dark: #64748B
--text-placeholder    → #CBD5E1      / dark: #475569
--text-label          → #94A3B8      / dark: #64748B   (alias de --text-secondary)
--text-subtle         → #CBD5E1      / dark: #475569   (alias de --text-placeholder)
```

### 1.3 Colores de fondo

```css
--bg-page             → #F1F5F9      / dark: #0F1623
--bg-card             → #FFFFFF      / dark: #1E2535
--bg-card-hover       → #F8FAFC      / dark: #243044
--bg-topbar           → #FFFFFF      / dark: #1E2535
--bg-input            → #FFFFFF      / dark: #243044
--bg-sidebar          → #1E2A3A      / dark: #0F1623
--bg-primary          → #F1F5F9      / dark: #0F1623   (alias de --bg-page)
--background          → #F8FAFC      / dark: #0F1623   (override de Tailwind)
--bg-table-header     → #F8FAFC      / dark: #1A2030
--bg-table-empty      → #F8FAFC      / dark: #1A2030
```

### 1.4 Colores de borde

```css
--border-default      → #E2E8F0      / dark: #2D3748
--border-strong       → #CBD5E1      / dark: #3D4F6A
--border-color        → #E2E8F0      / dark: #2D3748   (alias de --border-default)
--border-subtle       → #F1F5F9      / dark: #2D3748
--border-dashed       → #CBD5E1      / dark: #2D3748
```

### 1.5 Colores semánticos de estado — INCOMPLETOS ⚠️

Existen definidos **por familia de componente** pero NO como shorthand global.

| Familia | Verde (éxito) bg/color | Rojo (error) bg/color | Ámbar (warning) bg/color | Azul (info) bg/color |
|---------|----------------------|----------------------|-------------------------|---------------------|
| `--icon-*` | #DCFCE7 / #15803D | #FEE2E2 / #B91C1C | #FEF3C7 / #B45309 | #EFF6FF / #1D4ED8 |
| `--metric-*` | #F0FDF4 / #15803D | #FFF1F2 / #B91C1C | #FFFBEB / #B45309 | #EFF6FF / #1D4ED8 |
| `--badge-*` | #DCFCE7 / #15803D | #FEE2E2 / #B91C1C | #FEF3C7 / #B45309 | #EFF6FF / #1D4ED8 |

**Lo que FALTA:** `--color-error`, `--color-success`, `--color-warning`, `--color-info` como variables atómicas independientes (ver §5 prioridades).

### 1.6 Colores de gráficas

```css
--chart-axis          → #94A3B8      / dark: #64748B
--chart-grid          → #E2E8F0      / dark: #2D3748
--divider             → #F1F5F9      / dark: #2D3748
```

Nota: el array `BUILDING_COLORS` (paleta de gráficas por edificio) está hardcodeado en cada
archivo de página, NO en globals.css.

### 1.7 Sombras

```css
--shadow-card         → 0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)
                        / dark: none
--shadow-sm           → 0 1px 3px rgba(0,0,0,0.08)
--shadow-md           → 0 4px 16px rgba(0,0,0,0.12)
--shadow-lg           → 0 20px 60px rgba(0,0,0,0.25)  (modales)
```

### 1.8 Border-radius (con variación por tema)

| Variable | Clásico | super_soft | rígido |
|----------|---------|------------|--------|
| `--border-radius-sm` | `6px` | `14px` | `1px` |
| `--border-radius-md` | `8px` | `20px` | `2px` |
| `--border-radius-lg` | `12px` | `28px` | `4px` |
| `--border-radius-xl` | `16px` | `32px` | `6px` |
| `--border-radius-full` | `999px` | `999px` | `999px` |

El `--sidebar-radius` también varía: `0` (clásico/rígido) vs `0 28px 28px 0` (super_soft).

### 1.9 Espaciado base

```css
--card-gap            → 16px   (gap entre hijos de card)
--section-gap         → 24px   (gap entre secciones mayores)
```

Solo 2 tokens de espaciado. Todo lo demás hardcodeado (ver §3).

### 1.10 Tipografía

```css
--font-scale          → 1  (sobreescrito por preferencia del usuario vía JS)
```

No existen `--font-size-*`, `--font-weight-*` ni `--line-height-*`. Todo hardcodeado inline.

### 1.11 Otros tokens

```css
--foreground          → #0F172A   / dark: #F1F5F9   (text para Tailwind)
--card-shadow         → none (clásico/rígido) / 0 2px 12px rgba(0,0,0,0.06) (super_soft)
```

### 1.12 Sistema de temas

| Tema | Activación | Efecto principal |
|------|-----------|-----------------|
| Light (default) | `:root` | Fondos blancos, textos oscuros |
| Dark | `.dark` en `<html>` | Fondos oscuros, textos claros |
| super_soft | `data-theme="super_soft"` en `<html>` | Border-radius máximos, sombras de card |
| Rígido | `data-theme="rigido"` en `<html>` | Border-radius mínimos (1–6px) |

### 1.13 Resumen de cobertura de tokens

| Categoría | ¿Tokenizada? | Variables | Faltante |
|-----------|-------------|-----------|---------|
| Colores acento | ✅ Completo | 5 | `--accent-secondary` (pendiente confirmar #0369a1) |
| Colores texto | ✅ Completo | 6 | — |
| Colores fondo | ✅ Completo | 10 | — |
| Colores borde | ✅ Completo | 5 | — |
| **Colores semánticos de estado** | ❌ **Incompleto** | 0 shorthand | `--color-error/success/warning/info` |
| Sombras | ✅ Completo | 4 | — |
| Border-radius | ✅ Completo | 5 + full | — |
| Espaciado | ⚠️ Parcial | 2 | Escala `--spacing-*` |
| **Tipografía** | ❌ **Ausente** | 0 | `--font-size-*`, `--font-weight-*`, `--line-height-*` |
| Z-index | ❌ Ausente | 0 | Escala `--z-*` |
| Transiciones | ❌ Ausente | 0 | `--duration-*` |

---

## 2. Inventario de componentes

**Directorio:** `components/` — **57 archivos .tsx**

### 2.1 Componentes compartidos existentes

#### UiButton — `components/UiButton.tsx`
**Usos:** ~505 instancias en ~120 archivos (el componente más usado del sistema)

Props:
```typescript
variant?: "primary" | "secondary" | "ghost"
disabled?: boolean
icon?: ReactNode
href?: string       // Renderiza <a> en vez de <button>
form?: string
type?: "button" | "submit" | "reset"
style?: CSSProperties
```

Estilos base: `padding: 11px 16px`, `gap: 8px`, `font-weight: 600`,
`border-radius: var(--border-radius-sm)`.
Acepta override de `style`. **No tiene prop `size`** — los overrides de tamaño
se hacen con `style={{ padding, fontSize }}` directamente.

---

#### AppBadge — `components/AppBadge.tsx`
**Usos:** ~101 instancias en ~50 archivos

Props:
```typescript
variant?: "green" | "amber" | "red" | "blue" | "gray"
backgroundColor?: string
textColor?: string
borderColor?: string
style?: CSSProperties
```

Estilos base: `padding: 6px 10px`, `border-radius: var(--border-radius-full)`,
`font-size: 0.8125rem`, `font-weight: 600`. Acepta override total de colores.

---

#### AppTable — `components/AppTable.tsx`
**Usos:** ~22 instancias en ~25 archivos

Props:
```typescript
columns: Column<T>[]    // { key, header, width, align, render }
rows: T[]
emptyState?: ReactNode  // Default: "No hay datos para mostrar."
minWidth?: number       // Default: 720px
```

Estilos base: header `0.8125rem/700`, celdas `0.875rem`, `padding: 14px 16px`,
`border-radius: var(--border-radius-xl)`, `bg: var(--bg-card)`. **No acepta className.**
**No tiene prop striped ni sticky header.**

**Problema:** 45 instancias de `<table>/<thead>/<tbody>` inline en páginas,
muchas porque AppTable no cubre sus necesidades (agrupación, zebra, sticky, layout complejo).

---

#### AppCard — `components/AppCard.tsx`
**Usos:** ~40 archivos (uso general)

Props: `children`, `style?`, `className?`
Estilos: `padding: 18px`, `border: 1px solid var(--border-default)`,
`border-radius: var(--border-radius-lg)`, `bg: var(--bg-card)`, `shadow: var(--shadow-card)`.

---

#### MetricCard — `components/MetricCard.tsx`
**Usos:** ~119 instancias en ~60 archivos

Props:
```typescript
label: string
value: string | number
icon?: ReactNode
helper?: string
variant?: "green" | "amber" | "red" | "neutral" | "blue"
```

Internamente usa AppCard + AppIconBox. El valor se muestra en `1.75rem / 700`,
el label en `0.8125rem`, el helper en `0.75rem`.

---

#### EntityCard — `components/EntityCard.tsx`
**Usos:** ~8 archivos

Props:
```typescript
title: string
subtitle?: string
badge?: ReactNode
metrics?: { label, value, color }[]
statusIndicator?: ReactNode   // box 72×72
actions?: ReactNode
onClick?: () => void
style?, className?
```

Título `0.9375rem/700`, métricas `1.125rem` valor / `0.6875rem` label.
Acepta className/style.

---

#### Modal — `components/Modal.tsx`
**Usos:** ~654 instancias en ~50 archivos

Props:
```typescript
open: boolean
title: string
subtitle?: string
onClose: () => void
maxWidth?: string | number    // Default: 760px
maxHeight?: string | number   // Default: calc(100vh - 48px)
contentStyle?: CSSProperties
overlayStyle?: CSSProperties
```

Overlay: `rgba(15, 23, 42, 0.55)`. Animación Framer Motion (opacity+scale).
En mobile: `width: 95vw !important; max-height: 90vh !important`.

---

#### AppSelect — `components/AppSelect.tsx`
**Usos:** ~30 archivos

Extiende `React.SelectHTMLAttributes<HTMLSelectElement>`.
Estilos: `padding: 12px`, `border: 1px solid var(--border-default)`,
`border-radius: var(--border-radius-md)`, `bg: var(--bg-input)`.

---

#### AppEmptyState — `components/AppEmptyState.tsx`
**Usos:** ~15 archivos

---

#### AppTabs — `components/AppTabs.tsx`
**Usos:** ~10 archivos — las tabs de secciones internas de páginas

---

#### AppStatBar — `components/AppStatBar.tsx`
**Usos:** ~8 archivos

Props: `title`, `totalLabel?`, `segments: { label, value, color }[]`
Barra: `height: 12px`, `border-radius: var(--border-radius-full)`.
**No acepta className/style.**

---

#### AppGrid — `components/AppGrid.tsx`
**Usos:** ~20 archivos — layout de grillas de cards

---

#### AppIconBox — `components/AppIconBox.tsx`
**Usos:** Internamente por MetricCard y otras

---

#### MetricCircles — `components/MetricCircles.tsx`
**Usos:** Mobile-only (clase `.metric-circles-mobile-only`)
Los "círculos" de notificación mencionados: **existen SOLO en mobile**.
En desktop se muestran las MetricCards (`--metric-grid-desktop-only`).

---

#### SectionCard — `components/SectionCard.tsx`
**Usos:** Wrapper de sección con título y padding interno

---

#### PageContainer / PageHeader / MainContentWrapper
**Usos:** Todos los pages. Estructura layout fundamental.

---

#### Modales especializados (varios)
`DeleteConfirmModal`, `BuildingUtilityInvoiceModal`, `BuildingUtilityMeterModal`,
`CommercialTypologyModal`, `IndustrialTypologyModal`, `UnitTypeWizardModal`,
`UploadFixedInvoiceModal`, `UtilityInvoiceModal`, `UtilityMeterModal`,
`CaptureUtilityReadingModal`, `SettingsModal`, `ReturnModal`, `BuildingUtilitySubMetersModal`.
**Todos usan el componente `Modal` como base.**

---

### 2.2 Duplicados / patrones inline encontrados

#### Tablas inline (no usan AppTable)
**45 instancias** de `<table>/<thead>/<tbody>` en `app/**/*.tsx`

Páginas con tablas personalizadas:
- `app/buildings/[buildingId]/page.tsx` — Tablas de stats de unidades
- `app/dashboard/page.tsx` — Tabla de pagos vencidos y contratos por vencer
- `app/analytics/page.tsx` — Tablas de análisis de tenants
- `app/purchases/page.tsx` — Órdenes de compra
- `app/payments/page.tsx` — Historial de pagos
- `app/maintenance/page.tsx` — Programa de mantenimiento
- `app/calendar/page.tsx` — Eventos de calendario
- `app/collections/page.tsx` — Cobranza agrupada

**Causa probable:** AppTable no soporta agrupación, zebra, sticky headers ni layouts complejos.

---

#### Botones de navegación tipo "tabs" inline
**5+ páginas** con estado `activeTab`/`activeMainTab`/`setActiveTab` manejado
localmente en lugar de usar `<AppTabs>`:
- `app/buildings/[buildingId]/page.tsx`
- `app/buildings/[buildingId]/units/[unitId]/page.tsx`
- `app/dashboard/page.tsx`

**Síntoma:** Cada página implementa su propio estilo de tab nav (botones con
`borderBottom`, underline activo, colores hardcodeados).

---

#### Badges / pills inline
101+ instancias de `<AppBadge>` + variantes inline con `borderRadius: '999px'`
y colores hardcodeados en `<span>` directos.

---

#### SVGs inline
**11 instancias** de `<svg` en `app/**/*.tsx`. El resto de iconos viene de
`lucide-react` (importados como componentes). Los SVGs inline son:
- Iconos custom (ocupación, mapa, diagramas)
- Anotaciones de gráficas

---

### 2.3 Gráficas (Recharts)

**66+ instancias** en 25+ archivos. Uso de `ResponsiveContainer` en 25 lugares.

| Tipo | Páginas que lo usan |
|------|---------------------|
| `PieChart` | dashboard, buildings, analytics, collections, purchases |
| `BarChart` | dashboard, analytics, purchases, payments |
| `LineChart` | analytics, buildings/[id] |

**Dimensionamiento:**
- Todos usan `<ResponsiveContainer width="100%" height={N}>` donde N varía por página
  (`180`, `280`, `300`, `350`). **No hay altura estándar.**
- En mobile, globals.css limita la altura con `max-height: 180px` vía clase CSS fix.
- Colores de las gráficas: array `BUILDING_COLORS` hardcodeado por página,
  NO en globals.css.

---

### 2.4 Inputs y formularios

- **`<AppSelect>`** — select nativo estilizado. Usado en ~30 archivos para filtros.
- **`<AppFormField>`** — wrapper de label + input/select con error. Usado en formularios.
- **`<SensitiveField>`** — field con enmascaramiento de datos sensibles.
- **`<LocationPicker>`** — picker de mapa para coordenadas.
- **`react-hook-form` + `zod`** — validación en todos los formularios de alta/edición.

No existe un componente `<AppInput>` genérico para `<input type="text">` —
los inputs de texto están estilizados inline en cada form.

---

### 2.5 Loading states y empty states

**Loading (165+ instancias):**

Patrón dominante — banner de página completa:
```tsx
const [loadingData, setLoadingData] = useState(true);
if (loadingData) return <PageContainer>Cargando...</PageContainer>;
```

Páginas con loading personalizado: analytics, buildings/[id], collections, campo/assets.
No existe componente `<Skeleton>` compartido.

**Empty states (253+ instancias):**

Dos patrones coexistentes:
1. `<AppEmptyState>` — componente compartido con icono y mensaje
2. Ternario inline propio — cada página define su propio diseño de estado vacío

---

## 3. Espaciado y responsive

### 3.1 Valores de gap hardcodeados (inline styles)

| Valor | Frecuencia | Uso típico |
|-------|-----------|-----------|
| `8px` | **297** | Default apretado (botones, componentes pequeños) |
| `12px` | **202** | Medio (hijos de card, grupos de métricas) |
| `10px` | **183** | Variante de 8/12 |
| `6px` | **173** | Muy apretado (icono + texto, badge items) |
| `16px` | **106** | Estándar (= `--card-gap`) |
| `4px` | **74** | Mínimo (elementos inline) |
| `5px`, `14px` | 34–66 | Inconsistentes |
| `20px` | **28** | Separador de secciones |
| `24px` | **15** | Grande (= `--section-gap`) |
| `2px`, `3px`, `7px`, `9px`, `18px`, `32px` | 1–16 | Raros/aislados |

**Los valores 8, 12, 16, 24 son el núcleo natural** — candidatos directos para
`--spacing-2`, `--spacing-3`, `--spacing-4`, `--spacing-6`.

---

### 3.2 Tamaños de fuente hardcodeados (inline styles)

| Valor | Frecuencia | Uso típico |
|-------|-----------|-----------|
| `"0.8125rem"` (13px) | **426** | Labels pequeños, badges |
| `"0.75rem"` (12px) | **393** | Texto de tabla, fine print |
| `"0.875rem"` (14px) | **278** | Cuerpo de texto |
| `"0.6875rem"` (11px) | **224** | Etiquetas muy pequeñas |
| `"0.9375rem"` (15px) | **53** | Títulos de card |
| `"1rem"` (16px) | **44** | Énfasis |
| `"0.625rem"` (10px) | **35** | Micro-texto |
| `"1.125rem"` (18px) | **26** | Subtítulo |
| `"1.5rem"` (24px) | **11** | Heading grande |
| `"1.75rem"` (28px) | **8** | Título modal, heading primario |
| Otros (clamp, 20–30px) | ~20 | Headings especiales |

**Escala natural identificada (rem):** 0.625 → 0.6875 → 0.75 → 0.8125 → 0.875 →
0.9375 → 1 → 1.125 → 1.5 → 1.75

---

### 3.3 Responsive — estado actual

**Estrategia:** 100% CSS en `globals.css` (50+ bloques `@media`).
Ningún componente tiene media queries propios. No se usa Tailwind.

**Breakpoints usados:**

| Breakpoint | Valor | Contexto |
|-----------|-------|---------|
| Mobile | `max-width: 767px` | Layout de 1 col, sidebar off-canvas |
| Tablet | `min-width: 768px` / `max-width: 1024px` | Sidebar colapsado (72px, solo iconos) |
| Laptop | `min-width: 1024px` + `max-width: 1200–1400px` | Inconsistente por sección |
| Desktop | `min-width: 1024px` o `min-width: 1400px` | Grid completo |

**Problema laptop reportado (se ve "apretado"):**

- Sidebar: 280px fijo en desktop → ocupa ~20% de una laptop de 1366px
- Grids de cards: usan `minmax(Npx, 1fr)` con valores fijos → no colapsan hasta mobile
- Gráficas: altura fija (180–350px) definida por `height` prop en cada página,
  sin escala por viewport
- Clases como `.dashboard-grid-3`, `.buildings-grid` colapsan directo de 3-col a 1-col,
  sin paso intermedio a 2-col en laptops de 1024–1280px

**Clases responsive clave en globals.css:**

| Clase | Comportamiento |
|-------|---------------|
| `.buildings-grid` | 3-col → 2-col (tablet) → 1-col (mobile) |
| `.dashboard-grid-3` | 3-col → 2-col (tablet) → 1-col (mobile) |
| `.mod-stat-bar` | oculto en mobile (MetricCircles toma precedencia) |
| `.metric-circles-mobile-only` | visible SOLO en mobile |
| `.metric-grid-desktop-only` | visible SOLO en desktop |
| `.app-tabs-container` | flex-row (desktop) → grid 2×2 (mobile) |

---

## 4. Colores hardcodeados

> Fuente: `scripts/audit/inventario-colores-fase-d-2026-05-29.md`

### 4.1 Totales

| Métrica | Valor |
|---------|-------|
| Referencias hex en `app/` + `components/` | **573** |
| Archivos con > 5 referencias | 25 |
| Categoría (a) acento/tema | ~120 (21%) |
| Categoría (b) semántico de estado | ~119 (21%) |
| Categoría (c) intencional/otros | ~334 (58%) |

### 4.2 Top 20 archivos por concentración

| # | Archivo | Refs hex | Issue principal |
|---|---------|---------|----------------|
| 1 | `app/buildings/[buildingId]/page.tsx` | **88** | Mix de todo: acento, estado, paleta de gráficas |
| 2 | `app/settings/page.tsx` | **46** | 11× `#8B2252` vino legacy |
| 3 | `app/purchases/page.tsx` | **38** | 9× `#7c3aed` purple ambiguo |
| 4 | `app/collections/page.tsx` | **24** | Rojo/verde de estado inline |
| 5 | `app/register/page.tsx` | **22** | Dark navy de splash, rojos de validación |
| 6 | `app/buildings/page.tsx` | **22** | Badges de estado, colores de mapa |
| 7 | `components/Sidebar.tsx` | **20** | `#6366F1` activo, colores de nav |
| 8 | `components/CommercialTypologyModal.tsx` | **20** | Colores de tipologías, pasos de wizard |
| 9 | `app/dashboard/page.tsx` | **20** | Colores de estado de métricas inline |
| 10 | `app/login/page.tsx` | **19** | `#0d1b2a` dark navy, `#6366F1` acento |
| 11 | `app/analytics/page.tsx` | **17** | Paleta de gráficas, estado de tendencia |
| 12 | `app/maintenance/page.tsx` | **16** | Estados de tickets, colores de categoría |
| 13 | `components/EntityCard.tsx` | **15** | Métricas de ocupación, estado |
| 14 | `app/payments/page.tsx` | **14** | Estados de pago |
| 15 | `app/field/page.tsx` | **13** | Activos por categoría |
| 16 | `app/campo/assets/page.tsx` | **12** | Colores de tipo de activo |
| 17 | `components/MetricCard.tsx` | **11** | Valores por variante (ya en CSS vars) |
| 18 | `app/legal/page.tsx` | **10** | Branding página pública |
| 19 | `app/saproa-admin/overview/page.tsx` | **9** | Colores de métricas admin |
| 20 | `app/home/page.tsx` | **8** | Colores de iconos de módulos |

### 4.3 Colores más frecuentes por categoría

**Categoría (a) — Acento/tema (migrar a variables):**

| Color | Instancias | Contexto | Migrar a |
|-------|-----------|---------|---------|
| `#8B2252` | **38** | Vino SAPROA legacy | `var(--accent)` |
| `#6366F1` | **25** | Indigo actual | `var(--accent)` ✓ |
| `#0369a1` | **22** | Azul buildings detail | `var(--accent-secondary)` ¿? |
| `#7c3aed` | **16** | Purple purchases | paleta de gráficas ¿? |

**Categoría (b) — Estado semántico (crear variables globales):**

| Color | Instancias | Estado | Variable a crear |
|-------|-----------|--------|-----------------|
| `#EF4444` / `#ef4444` | **17** | Error/rojo | `--color-error` |
| `#10B981` | **11** | Éxito/verde | `--color-success` |
| `#22c55e` + `#1D9E75` | **12** | Éxito variantes | `--color-success` |
| `#F59E0B` | **9** | Warning/ámbar | `--color-warning` |
| `#f97316` / `#F97316` | **11** | Naranja OC | `--color-orange` |
| `#3B82F6` | **5** | Info/azul | `--color-info` |
| `#c2410c` | **8** | Naranja oscuro | `--color-warning` dark |

**Categoría (c) — Intencional/mantener:**

| Color | Instancias | Razón para conservar |
|-------|-----------|---------------------|
| `#fff` / `#ffffff` / `#FFFFFF` | **138** | Texto sobre fondos de color (necesario) |
| `#0d1b2a` | **12** | Dark navy splash screen (marca) |
| `#6b7280` / `#6B7280` | **19** | Migrar a `var(--text-secondary)` |
| Paleta `BUILDING_COLORS` | **~15** | Colores de gráficas por edificio, mantener fijos |

### 4.4 Variables nuevas propuestas (7)

```css
/* :root */
--color-error:          #EF4444;    /* red-500    */
--color-success:        #10B981;    /* emerald-500 */
--color-warning:        #F59E0B;    /* amber-500   */
--color-info:           #3B82F6;    /* blue-500    */
--color-orange:         #F97316;    /* orange-500  */
--bg-splash:            #0d1b2a;    /* dark navy splash screen */
--accent-secondary:     TBD;        /* pendiente confirmar #0369a1 */

/* .dark */
--color-error:          #F87171;    /* red-400    */
--color-success:        #4ADE80;    /* green-400  */
--color-warning:        #FCD34D;    /* amber-300  */
--color-info:           #60A5FA;    /* blue-400   */
--color-orange:         #FB923C;    /* orange-400 */
```

### 4.5 Preguntas abiertas antes de migrar

1. **`#0369a1`** (22 instancias en buildings detail): ¿Es un acento secundario para
   esa sección o debería ser `var(--color-info)`? Define si crear `--accent-secondary`.

2. **`#7c3aed`** (16 instancias en purchases): ¿Es paleta de gráficas (fijo siempre) o
   color de categoría OC que debería tokenizarse?

---

## 5. Resumen ejecutivo

### 5.1 Tokens: qué existe vs qué falta

**Bien cubierto (no tocar):**
- Sistema de colores estructura completo (texto, fondo, borde) con light/dark
- Sombras en 4 tamaños
- Border-radius en 4 tamaños + 3 temas
- Chakra de temas (clásico, super_soft, rígido) funcionando

**Brechas críticas:**

| Gap | Impacto | Instancias afectadas |
|-----|---------|---------------------|
| Sin `--color-error/success/warning/info` shorthand | Los estados se redefinen en cada componente | ~119 hex refs |
| Sin escala `--font-size-*` | 21 valores distintos hardcodeados inline | 1 450+ refs |
| Sin escala `--spacing-*` | 15 valores de gap hardcodeados | 1 200+ refs |
| Sin `--z-index-*` | z-index de modales/dropdowns sin escala | ~20 refs |

---

### 5.2 Componentes: estandarizados vs duplicados

**Estandarizados y bien adoptados:**
- `UiButton` (505 usos) — el más usado del sistema ✅
- `Modal` (654 usos) — adoptado universalmente ✅
- `MetricCard` (119 usos) — estandarizado ✅
- `AppBadge` (101 usos) — bien adoptado ✅
- `AppCard`, `AppSelect`, `AppEmptyState` — adoptados consistentemente ✅

**Duplicados / divergentes que necesitan atención:**

| Elemento | Estado | Archivos afectados | Acción recomendada |
|----------|--------|-------------------|-------------------|
| **Tablas** | 45 tablas inline vs 22 `AppTable` | 8 páginas | Extender `AppTable` con agrupación y striped |
| **Tab navigation** | Cada página hace la suya | 5+ páginas | `AppTabs` ya existe — migrar todos a él |
| **Loading state** | `if (loading) return "Cargando..."` duplicado | Todas las páginas | Crear `<PageLoadingState>` compartido |
| **Input de texto** | Sin `<AppInput>` — cada form estiliza inline | Todos los forms | Crear `AppInput` (análogo a AppSelect) |
| **Chart heights** | Cada página define su altura (180–350px) | 25 archivos | Definir constante `CHART_HEIGHT_DEFAULT` |

**Sin duplicados (bien manejados):**
- Modales especializados: todos usan `Modal` base ✅
- MetricCircles mobile: encapsulado y controlado por CSS ✅
- Formularios: react-hook-form + zod consistente en todos ✅

---

### 5.3 Problema responsive (laptops)

**Síntomas reportados:** "se ve bien en monitores grandes, apretado en laptops"

**Causas identificadas:**

1. **Sidebar fija de 280px** consume ~20% del viewport en laptop de 1366px.
   No tiene paso intermedio entre 280px (>1024px) y 72px (tablet).
   **Fix posible:** sidebar de ~240px en 1024–1280px.

2. **Grids sin paso intermedio laptop.** `.dashboard-grid-3` va de 3-col directo
   a 2-col (tablet). En laptops de 1024–1280px siguen siendo 3-col pero el contenido
   queda comprimido. **Fix:** añadir breakpoint `max-width: 1280px` → 2-col.

3. **Gráficas con altura fija.** `height={300}` en ResponsiveContainer no escala.
   En laptops la relación aspecto queda mal. **Fix:** usar `height="45%"` o clamp.

4. **Cards con `minWidth` fijo.** Algunos grids usan `minmax(280px, 1fr)` que
   no colapsa hasta que el viewport baja de ~600px.
   **Fix:** `minmax(min(280px, 100%), 1fr)` o `minmax(0, 1fr)`.

5. **MetricCard de texto no escala.** Valor `1.75rem` fijo — en laptops pequeñas
   puede truncar si el grid no da suficiente ancho.

---

### 5.4 Desglose de colores

| Categoría | Instancias | % | Acción |
|-----------|-----------|---|--------|
| (a) Acento/tema | ~120 | 21% | Migrar en Lote 1–2 |
| (b) Estado semántico | ~119 | 21% | Crear 5 variables, migrar en Lote 1–3 |
| (c) Intencional/otros | ~334 | 58% | Mayoría son `#fff` (conservar) o grises (migrar a `--text-*`) |

**Top 3 archivos de mayor riesgo:**
1. `buildings/[buildingId]/page.tsx` (88 refs) — alta mezcla de categorías
2. `settings/page.tsx` (46 refs) — 11× vino legacy
3. `purchases/page.tsx` (38 refs) — purple ambiguo

---

### 5.5 Plan de ataque recomendado (5 pasos)

| Paso | Qué hacer | Esfuerzo | Impacto |
|------|-----------|---------|--------|
| **0** | Crear 5 variables semánticas en globals.css (`--color-error/success/warning/info/orange`) | 1h | Desbloquea todo lo demás |
| **1** | Migrar colores estado (b) a las nuevas variables — sidebar, home, dashboard | 3–4h | Elimina ~60 refs hardcoded |
| **2** | Migrar vino legacy `#8B2252` en settings (11×) y otras (27×) a `var(--accent)` | 2–3h | Elimina 38 refs de marca vieja |
| **3** | Crear `AppInput` + extender `AppTable` (striped, grouping) | 4–6h | Elimina las 45 tablas inline más frecuentes |
| **4** | Fix responsive laptops (sidebar + grid breakpoints) | 2–3h | Mejora directa de UX reportada |

**Paso 0 es el prerrequisito** de todo. Sin las variables de estado, la migración
de los ~119 colores semánticos no puede proceder.

---

*Fin del inventario. No se modificó ningún archivo de código.*
