# Mapa de Paleta — Fase D
**Fecha:** 2026-06-01  
**Alcance:** `app/` + `components/` (excl. `globals.css`)  
**Objetivo:** Inventariar colores hardcodeados por familia para decidir qué unificar antes de la migración masiva.

---

## Leyenda de columnas

| Columna | Descripción |
|---|---|
| Token | `✅ token` = ya tiene var, `🔴 hard` = hardcodeado sin token |
| Frec. | frecuencia aproximada de apariciones |

---

## 1. ROJOS

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#EF4444` | ~12 | Priority-urgent dot · chart vacancy · design-system donut · roadmap | ✅ `--priority-urgent` |
| `#E24B4A` | ~5 | `getStatusIndicator` → mantenimiento · StatusCircle | ✅ `--status-maintenance` |
| `#DC2626` | ~4 | Error semántico general (`color-error`) | ✅ `--color-error` |
| `#B91C1C` | ~3 | Badge red text (tokens) · metric-value-red | ✅ `--badge-text-red` / `--metric-value-red` |
| `#F87171` | ~8 | Error inline (login) · toast icon · home metric · dark-mode error | ✅ `--color-error` dark |
| `#c2410c` | ~3 | ReturnModal warning text/border (orange-700) | 🔴 hard |
| `#BE123C` | 1 | AssetTypeIcon: cámara de seguridad | 🔴 hard |
| `#DB2777` | 1 | Calendar: contratos badge border/text | 🔴 hard |
| `#EC4899` | ~2 | Analytics charts (pink slice) | 🔴 hard |
| `#6B1240` | 1 | Notificación brand text (muy oscuro) | 🔴 hard |
| `#9F1239` | 1 | badge-border-red dark mode (token) | ✅ `--color-error-border` dark |
| `rgba(190,18,60,0.1)` | 1 | AssetTypeIcon: seguridad bg | 🔴 hard |
| `rgba(220,38,38,...)` | ~10 | Error states con alpha (varios archivos) | 🔴 hard |
| `#FCA5A5` | ~3 | Login: error message bg | 🔴 hard |
| `#FECACA` | 1 | Calendar: badge border | 🔴 hard |
| `#FEE2E2` | — | badge-bg-red (token) | ✅ `--badge-bg-red` |
| `#FFF1F2` | — | metric-bg-red (token) | ✅ `--metric-bg-red` |

### Análisis familia ROJOS

**Tonos distintos:** 7 reales + variantes de opacidad  
**¿Son deliberados?** Parcialmente.

- **`#EF4444` vs `#E24B4A`** — Diferencia: 11 puntos en R, 26 en G. Visiblemente distintos pero muy cercanos. `#EF4444` viene de Tailwind red-500; `#E24B4A` es un rojo-coral personalizado para StatusCircle. En producción se ven prácticamente iguales.
- **`#DC2626` vs `#B91C1C`** — Ambos son rojos oscuros para texto/badge. `#DC2626` = error semántico; `#B91C1C` = badge text. Delta pequeño, probablemente no intencional.
- **`#F87171`** — red-400 de Tailwind, apropiado para dark mode. Tiene sentido mantener separado.
- **`#c2410c`** — Técnicamente es naranja-rojo (orange-700), usado en ReturnModal como "warning destructivo". Está en tierra de nadie entre rojo y naranja.
- **`#BE123C`, `#DB2777`, `#EC4899`** — Usos únicos / charts. No tienen familia real.

**Recomendación:**
- ✂️ Unificar `#EF4444` + `#E24B4A` → `--status-maintenance` (ya existe). El token captura la intención.
- ✂️ Unificar `#DC2626` + `#B91C1C` (texto) como `--color-error` y `--color-error-text` respectivamente. Ya están como tokens, solo falta migrar los hardcodeados.
- 📌 Mantener `#F87171` solo como valor dark-mode (no hardcodear).
- 📌 `#c2410c` es candidato a token `--color-warning-destructive` o usar `--color-warning` con ajuste.
- 🚫 `#BE123C`, `#DB2777`, `#EC4899` — colores de charts/íconos únicos, dejar hardcodeados.

---

## 2. AMARILLOS / ÁMBAR / NARANJAS

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#D97706` | 1 | warning token en `:root` | ✅ `--color-warning` |
| `#B45309` | 1 | icon-color-amber / badge-text-amber | ✅ `--metric-value-amber` |
| `#EF9F27` | ~2 | StatusCircle parcial | ✅ `--status-partial` |
| `#F59E0B` | ~8 | priority-medium · charts (analytics, collections) · partial occupancy | ✅ `--priority-medium` |
| `#F97316` | ~8 | priority-high · cleaning border · cobrado/pendiente charts · dashboard | ✅ `--priority-high` |
| `#EA580C` | 1 | Collections: gas icon | 🔴 hard |
| `#92400E` | ~3 | Campo compras text · invoice icon · settings titular badge text | 🔴 hard |
| `#FF6600` | ~2 | MATZ brand (design system only) | 🔴 hard (brand) |
| `#CA8A04` | 1 | AssetTypeIcon: generador | 🔴 hard |
| `#C9A84C` | 1 | GroupBanner gold | 🔴 hard |
| `#c2410c` | ~3 | ReturnModal (naranja-rojo) | 🔴 hard |
| `#FDBA74` | ~2 | Purchases: metric border naranja | 🔴 hard |
| `#FCD34D` | — | dark mode amber (token) | ✅ dark tokens |
| `#FEF3C7` | — | badge-bg-amber (token) | ✅ `--badge-bg-amber` |
| `#FFFBEB` | — | metric-bg-amber (token) | ✅ `--metric-bg-amber` |
| `rgba(245,158,11, 0.08..0.15)` | ~7 | BuildingServicesTab info boxes, warn boxes | 🔴 hard |
| `rgba(201,168,76, 0.08..0.5)` | ~4 | GroupBanner gold tints | 🔴 hard |
| `rgba(217,119,6,0.1)` | 1 | AssetTypeIcon: cocina/caldera | 🔴 hard |
| `rgba(202,138,4,0.1)` | 1 | AssetTypeIcon: generador bg | 🔴 hard |

### Análisis familia ÁMBAR/NARANJAS

**Tonos distintos:** 8 reales distintos  
**¿Son deliberados?** Sí, por escalón de prioridad/semántica — pero hay duplicaciones.

- **`#F59E0B` vs `#EF9F27`** — Delta de solo ~4% en R, 0% en G, ~7% en B. Visualmente casi idénticos. `#F59E0B` = amber-400 (Tailwind); `#EF9F27` = custom para StatusCircle. **Candidato #1 a unificar.**
- **`#D97706` vs `#B45309`** — El primero es warning semántico general (#color-warning); el segundo es para texto/badges. Diferencia intencional de luminosidad (uno para color over white, otro para iconos small).
- **`#F97316` vs `#EA580C`** — orange-500 vs orange-600. `#EA580C` se usa una sola vez para gas icon; podría usar `--priority-high`.
- **`#92400E`** — amber-900. Texto oscuro para settings/badges. Debería ser un token de texto ámbar oscuro.
- **`#C9A84C`** — Gold específico del GroupBanner. Intencional, mantener.
- **Las rgba()** — Son tints de `#F59E0B` y `#C9A84C`. Con `--accent-tint-*` como patrón, deberían derivarse de los tokens.

**Recomendación:**
- ✂️ Unificar `#F59E0B` + `#EF9F27` → `--status-partial` / `--priority-medium` (ya existen).
- ✂️ Crear `--color-warning-text` para `#92400E` (texto oscuro sobre fondos ámbar).
- 📌 `#C9A84C` (gold del grupo) mantener como constante en GroupBanner.tsx; es un color de identidad.
- 🚫 `#CA8A04`, `#FF6600`, `rgba(217,119,6,...)` — íconos únicos o brand colors, dejar.

---

## 3. VERDES

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#16A34A` | 1 | `--color-success` token en `:root` | ✅ `--color-success` |
| `#15803D` | ~3 | icon-color-green · badge-text-green · reservation mock | ✅ `--metric-value-green` |
| `#1D9E75` | ~4 | StatusCircle ocupada · CommercialTypologyModal step done | ✅ `--status-occupied` |
| `#10B981` | ~12 | Charts cobrado/ocupación · layout toast · buildings page · portal checkmark | 🔴 hard (el más frecuente sin token) |
| `#22C55E` | ~9 | Bar/pie chart "cobrado" · design system · cobrado segmento | 🔴 hard |
| `#065F46` | ~2 | Badge text verde oscuro (completed) · BuildingServicesTab | 🔴 hard |
| `#0F766E` | ~3 | Settings: tenant badge · collections: parking icon | 🔴 hard |
| `#34D399` | — | dark mode `--status-occupied` | ✅ dark token |
| `#4ADE80` | — | dark mode metric-value-green | ✅ dark token |
| `#D1FAE5` | 1 | Cleaning log completed bg | 🔴 hard |
| `#DCFCE7` | — | badge-bg-green (token) | ✅ `--badge-bg-green` |
| `#F0FDF4` | — | metric-bg-green (token) | ✅ `--metric-bg-green` |
| `rgba(16,185,129, 0.06..0.25)` | ~15 | Success states / file upload / task completion / banner | 🔴 hard |
| `rgba(21,128,61,0.1)` | 1 | AssetTypeIcon: intercomunicador | 🔴 hard |
| `rgba(22,163,74,0.1)` | 1 | AssetTypeIcon: ventilador | 🔴 hard |
| `rgba(34,197,94, 0.14..0.25)` | ~2 | Sidebar: online status indicator | 🔴 hard |

### Análisis familia VERDES

**Tonos distintos:** 6 verdes principales + variantes alpha  
**¿Son deliberados?** Parcialmente — hay una fragmentación real entre 3 sistemas.

Hay **tres "verdes" paralelos** en la app:
1. **Sistema de tokens:** `#16A34A` / `#15803D` / `#4ADE80` — para badges, métricas, íconos.
2. **Charts:** `#10B981` (emerald-500) y `#22C55E` (green-500) — para gráficas de Recharts.
3. **Status:** `#1D9E75` (custom) — para StatusCircle de unidades.

La fragmentación más problemática:
- **`#10B981` vs `#16A34A`** — 8 puntos en R, diferencia en G y B; visibles pero parecidos. `#10B981` aparece ~12 veces sin token, siendo el verde más frecuente. **Candidato #1 a crear token** (`--color-chart-success` o absorber en `--color-success`).
- **`#22C55E` vs `#10B981`** — Delta notable (12 puntos en R, 11 en G). El primero es más brillante. Ambos se usan en charts sin distinción clara.
- **`#0F766E`** (teal) — genuinamente diferente, es un verde-azulado para badges contextuales.

**Recomendación:**
- ✂️ Crear `--color-chart-green: #10B981` — el verde de charts más usado (~12x). Con este token, todos los recharts del sistema usarían el mismo verde.
- ✂️ Crear `--color-chart-green-alt: #22C55E` — o considerar unificarlo con `#10B981`. La diferencia es pequeña.
- ✂️ `rgba(16,185,129,...)` tints → con `--color-success-subtle` ya definido, pueden derivarse del token.
- 📌 `#1D9E75` (status-occupied) — mantener separado del verde de charts. Es un verde con más cyan.
- 🚫 `#065F46`, `#0F766E` — tonos oscuros usados 1-3 veces; no crear tokens por ahora.

---

## 4. AZULES

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#2563EB` | 1 | `--color-info` token | ✅ `--color-info` |
| `#1D4ED8` | — | metric-value-blue / badge-text-blue (token) | ✅ `--metric-value-blue` |
| `#3B82F6` | ~6 | Charts (analytics, collections) · estacionamiento area · building stroke | 🔴 hard |
| `#378ADD` | ~3 | StatusCircle vacante · cleaning border común | ✅ `--status-vacant` |
| `#0369A1` | ~5 | Rental mode "whole" · checkbox accentColor · CommercialTypology steps | 🔴 hard |
| `#0891B2` | 1 | DOC_CATEGORIES: planos color | 🔴 hard |
| `#0EA5E9` | ~2 | Payments: internet · Collections: agua | 🔴 hard |
| `#0284C7` | 1 | AssetTypeIcon: agua/cisterna | 🔴 hard |
| `#0047AB` | 1 | HEMSA brand (design system) | 🔴 hard (brand) |
| `#93C5FD` | ~3 | Portal/Purchases: metric border blue | 🔴 hard |
| `#dbeafe` | 1 | BuildingServicesTab: electricity badge bg | 🔴 hard |
| `rgba(37,99,235, 0.06..0.4)` | ~4 | Invoice modal: PDF upload border/bg | 🔴 hard |
| `rgba(2,132,199,0.1)` | ~2 | AssetTypeIcon: water bg | 🔴 hard |
| `rgba(59,130,246,...)` | ~2 | Focus states | 🔴 hard |

### Análisis familia AZULES

**Tonos distintos:** 7 azules principales  
**¿Son deliberados?** Sí — hay distinción semántica clara, pero con superposición.

- **`#3B82F6`** (blue-500) — el azul más frecuente en charts. Sin token. El más candidato a crearse.
- **`#378ADD`** vs **`#3B82F6`** — Solo 3 puntos de diferencia en R, idéntico en G y B. **Prácticamente el mismo azul.** Uno es StatusCircle, el otro charts. Candidato obvio a unificar.
- **`#0369A1`** — sky-700, más oscuro y con más cyan. Usado para accentColor en checkboxes y estados "seleccionado". Intencional, diferente.
- **`#0EA5E9`** y **`#0284C7`** — azules cian para íconos de servicios (agua, internet). Similar entre sí; podrían unificarse en un token de utility services.
- **`#93C5FD`** — blue-300, usado como borde de metric cards en Portal. No tiene token.

**Recomendación:**
- ✂️ Unificar `#378ADD` + `#3B82F6` → `--status-vacant` o nuevo `--color-chart-blue`. Delta de 3 puntos en R; imperceptible.
- ✂️ Crear `--color-chart-blue: #3B82F6` para uso en Recharts (~6 ocurrencias).
- 📌 `#0369A1` (sky-700) — candidato a `--color-action-blue` o `--color-form-accent`. Semánticamente diferente de los blues de charts.
- 📌 `#0EA5E9` / `#0284C7` — podrían unificarse en `--color-utility-water`.
- 🚫 `#0047AB` (HEMSA), `#0891B2` (planos) — colores únicos.

---

## 5. MORADOS / VIOLETAS

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#6366F1` | ~25 | SAPROA accent · charts · impersonation banner · design system · UnitTypeWizard | ✅ `--accent` |
| `#4F46E5` | 1 | Gradient: accent final | 🔴 hard (gradiente) |
| `#818CF8` | 1 | Gradient: accent inicio | 🔴 hard (gradiente) |
| `#7C3AED` | ~5 | Media/fotos icon · AssetTypeIcon elevador · collections amenities · purchases | ✅ `--color-media` |
| `#8B5CF6` | ~2 | Analytics chart · BuildingServicesTab internet service | 🔴 hard |
| `#A855F7` | ~5 | Analytics · cleaning premium · purchases border | 🔴 hard |
| `#6D28D9` | 1 | AssetTypeIcon: portón/gate | 🔴 hard |
| `#5B21B6` | 1 | BuildingServicesTab: internet badge text | 🔴 hard |
| `#A78BFA` | — | dark mode color-media | ✅ dark token |
| `#C084FC` | — | dark mode icon-color-purple | ✅ dark token |
| `#F5F3FF` | ~2 | Media bg · fotos category | ✅ `--color-media-bg` |
| `#EDE9FE` | 1 | BuildingServicesTab: internet badge bg | 🔴 hard |
| `rgba(99,102,241, 0.08..0.3)` | ~5 | UnitTypeWizard alert/draft · ImpersonationBanner bg | 🔴 hard → usar `--accent-tint-*` |
| `rgba(124,58,237,0.1)` | 1 | AssetTypeIcon: elevador bg | 🔴 hard |
| `rgba(109,40,217,0.1)` | 1 | AssetTypeIcon: gate bg | 🔴 hard |

### Análisis familia MORADOS

**Tonos distintos:** 5 reales + gradiente  
**¿Son deliberados?** Mayoritariamente sí — hay capas claras.

- **`#6366F1`** (SAPROA accent) — bien gestionado con `--accent`. Las `rgba(99,102,241,...)` son sus tints → deberían usar `--accent-tint-*` ya definidos.
- **`#7C3AED`** → `--color-media` ya definido. Las `rgba(124,58,237,0.1)` son su tint.
- **`#8B5CF6`** vs **`#7C3AED`** — Diferencia real (violet-500 vs violet-700). `#8B5CF6` aparece en internet service color y analytics. Semántica diferente de media/fotos.
- **`#A855F7`** (purple-500) — el más saturado, usado en cleaning "unit_interior premium" y analytics charts. Candidato a token de chart.
- **`#5B21B6` / `#6D28D9`** — muy oscuros, usos únicos.

**Recomendación:**
- ✂️ Todas las `rgba(99,102,241,...)` → `--accent-tint-subtle/soft/medium` (ya definidos).
- ✂️ Crear `--color-internet: #8B5CF6` (violeta para servicio de internet, aparece en varios). O simplemente absorber en `--color-media` si el contexto lo permite.
- 📌 `#A855F7` — candidato a `--color-chart-purple` para analytics.
- 🚫 `#4F46E5`, `#818CF8` — solo en el gradiente del accent; pueden quedar hardcodeados dentro del gradiente.

---

## 6. VINOS / MAGENTAS

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#8B2252` | ~15 | Fallback de accent · AREA_TYPE_COLORS locales · brand notifications | 🔴 hard (var default) |
| `rgba(139,34,82, 0.04..0.5)` | ~12 | Brand tints: selected options · borders · notificaciones · dividers | 🔴 hard → usar `--accent-tint-*` |
| `#6B1240` | 1 | Notificación brand text | 🔴 hard |
| `#FDF4FF` | 1 | Notificación brand bg | 🔴 hard |
| `#C9A84C` | 1 | GroupBanner gold | 🔴 hard |
| `#DB2777` | 1 | Calendar contratos badge | 🔴 hard |
| `#EC4899` | ~2 | Analytics chart slice | 🔴 hard |

### Análisis familia VINOS

**Tonos distintos:** 2 reales (`#8B2252` + su texto oscuro `#6B1240`)  
**¿Son deliberados?** Sí — y es la familia MÁS CONSISTENTE.

Este es el color de marca de Fra-Mar. Aparece de dos formas:
1. **Como fallback:** `var(--accent, #8B2252)` — ya usa CSS var con fallback correcto.
2. **Como rgba directo:** `rgba(139, 34, 82, 0.04..0.5)` — hardcodeados, deberían usar `--accent-tint-*`.

**El problema central:** `rgba(139,34,82,...)` hardcodeados NO cambian cuando cambia la empresa (de Fra-Mar a SAPROA). Cuando `--accent` es `#6366F1`, los tints siguen siendo del vino Fra-Mar. **Esto es un bug visual en multi-tenant.**

**Recomendación:**
- ✂️ **PRIORIDAD ALTA:** Reemplazar TODOS los `rgba(139,34,82,...)` → `--accent-tint-subtle/soft/medium`. Este es el impacto de mayor valor: hará que los tints cambien correctamente con el tema de empresa.
- ✂️ Reemplazar `#8B2252` hardcodeados (que no sean el fallback) → `var(--accent)`.
- 📌 `#C9A84C` (gold del grupo) — mantener. Es identidad del grupo, no del tenant.
- 🚫 `#DB2777`, `#EC4899` — charts únicos, dejar.

---

## 7. GRISES / NEUTROS

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#64748B` | ~8 | text-secondary · icon-neutral · patios_maniobra · chart axis dark | ✅ `--text-secondary` |
| `#94A3B8` | ~5 | text-muted · calles area · chart color gris | ✅ `--text-muted` |
| `#CBD5E1` | — | border-strong token | ✅ `--border-strong` |
| `#E2E8F0` | — | border-default token | ✅ `--border-default` |
| `#475569` | — | badge-text-gray token | ✅ `--badge-text-gray` |
| `#6B7280` | ~5 | Priority-low · default brand fallback · `otro` area · suppliers default | ✅ `--priority-low` |
| `#9CA3AF` | ~3 | Circulacion area · priority low dot default | 🔴 hard |
| `#374151` | ~2 | metric-value-neutral · dashboard segment | ✅ `--metric-value-neutral` |
| `#808080` | ~2 | PROMSA brand · design system | 🔴 hard (brand) |
| `#78716C` | 1 | Construccion area type | 🔴 hard |
| `#888780` | 1 | StatusCircle default/inactivo | 🔴 hard |
| `#F3F4F6` | ~3 | Priority-low pill bg · purchases bg | 🔴 hard |
| `rgba(0,0,0, 0.12..0.92)` | ~30+ | Shadows · overlays · lightbox backdrop | 🔴 hard (contextual) |
| `rgba(255,255,255, 0..0.9)` | ~35+ | Sidebar overlays · texto blanco semitransparente | 🔴 hard (contextual) |
| `#ffffff` / `#fff` | ~80+ | Botones active · texto sobre fondos oscuros | 🔴 hard |

### Análisis familia GRISES

**Tonos distintos:** 8 grises principales  
**¿Son deliberados?** Mayoritariamente — los tokens ya cubren los más importantes.

- **Grises con token:** `#64748B`, `#94A3B8`, `#475569`, `#374151`, `#6B7280` — bien cubiertos.
- **`#9CA3AF`** — gray-400, aparece 3 veces para `circulacion` area y priority dot. Delta pequeño con `--text-muted` (#94A3B8), solo 8 puntos. **Candidato a unificar con `--text-muted`.**
- **`#888780`** — gris cálido único para StatusCircle default. Diferente de los slate grays del sistema.
- **`rgba(0,0,0,...)` y `rgba(255,255,255,...)`** — No crearían tokens individuales; son constantes de UI de bajo nivel (shadows, overlays). El patrón de múltiples opacidades en el sidebar (12 valores distintos de blanco!) sugiere que el sidebar podría simplificarse.

**Recomendación:**
- ✂️ `#9CA3AF` → `var(--text-muted)` (#94A3B8, delta 8 pts, imperceptible).
- ✂️ Crear `--status-default: #888780` para el StatusCircle "sin estado / inactivo".
- 📌 `#F3F4F6` (priority-low bg) — candidato a `--bg-disabled` o `--badge-bg-neutral-alt`.
- 🚫 `rgba(0,0,0,...)` / `rgba(255,255,255,...)` — son valores de UI contextual, no tiene sentido tokenizarlos individualmente.

---

## 8. OTROS / ESPECIALES

| Hex | Frec. | Contexto | Token |
|---|---|---|---|
| `#14B8A6` | 1 | Collections chart slice (teal) | 🔴 hard |
| `#06B6D4` | 1 | Collections chart slice (cyan) | 🔴 hard |
| `#CCFBF1` | 1 | Settings: tenant badge bg (teal) | 🔴 hard |
| `#0F766E` | ~3 | Settings: tenant badge text · collections parking | 🔴 hard |
| `#1E40AF` | 1 | Settings: field badge | 🔴 hard |
| `rgba(37,211,102,...)` | 1 | WhatsApp button shadow (verde WA) | 🔴 hard |

### Análisis OTROS

Colores únicos o muy específicos de contexto (badges de roles, chart slices únicos, WhatsApp). **No crear tokens para ninguno** — aumentaría el vocabulario sin beneficio real.

---

## Resumen ejecutivo por familia

| Familia | Tonos distintos | Dispersión | Candidatos a unificar | Prioridad |
|---|---|---|---|---|
| Rojos | 7 | Media | `#EF4444` + `#E24B4A` → `--status-maintenance` | 🟡 Media |
| Ámbar/Naranjas | 8 | Alta | `#F59E0B` + `#EF9F27`; crear `--color-warning-text` | 🟡 Media |
| Verdes | 6 | Alta | Crear `--color-chart-green: #10B981` (sin token, 12 usos) | 🔴 Alta |
| Azules | 7 | Media | `#378ADD` + `#3B82F6`; crear `--color-chart-blue` | 🟡 Media |
| Morados | 5 | Baja | Tints de accent → `--accent-tint-*` | 🟡 Media |
| Vinos | 2 | Muy baja | `rgba(139,34,82,...)` → `--accent-tint-*` (bug multi-tenant) | 🔴 Alta |
| Grises | 8 | Baja | `#9CA3AF` → `--text-muted`; crear `--status-default` | 🟢 Baja |
| Otros | 6 | N/A | Ninguno — usos únicos | 🟢 Ignorar |

---

## Top 5 acciones de mayor impacto

1. **`rgba(139,34,82,...)` → `--accent-tint-*`** — Bug multi-tenant. 12+ ocurrencias. Tints del vino Fra-Mar no cambian con el tenant actual.

2. **Crear `--color-chart-green: #10B981`** — 12 ocurrencias sin token. El verde de charts más usado.

3. **Crear `--color-chart-blue: #3B82F6`** — 6 ocurrencias sin token. Unifica con `--status-vacant` (#378ADD, delta 3pts).

4. **`rgba(99,102,241,...)` → `--accent-tint-*`** — 5 ocurrencias en modales y wizards que ya deberían usar los tints definidos.

5. **Crear `--color-chart-orange: #F97316`** (o usar `--priority-high`) — 8 ocurrencias en charts, cleaning y dashboard.

---

## Tokens nuevos sugeridos (no crear hoy — para aprobación)

```css
/* Charts compartidos */
--color-chart-green:  #10B981;  /* 12 usos en recharts */
--color-chart-blue:   #3B82F6;  /* 6 usos — absorbería #378ADD */
--color-chart-orange: #F97316;  /* 8 usos — pendiente/cobrado */
--color-chart-pink:   #EC4899;  /* 2 usos — analytics */
--color-chart-teal:   #14B8A6;  /* 1 uso — collections */

/* Status adicional */
--status-default:     #888780;  /* StatusCircle sin estado */

/* Texto semántico oscuro */
--color-warning-text: #92400E;  /* texto amber oscuro sobre fondos claros */
--color-action-blue:  #0369A1;  /* checkboxes / form accents */
```

---

*Generado en Fase D — 2026-06-01. No se modificó ningún componente.*
