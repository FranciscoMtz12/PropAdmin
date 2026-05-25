# ROADMAP ACTUALIZADO — PropAdmin
## Generado: 2026-05-25 | Basado en historial completo de commits (556)

---

# PARTE I — CRUD BACKLOG

## Estándar global CRUD

Todos los flujos CRUD deben incluir: crear, editar, eliminar.
El delete debe usar el componente `Modal`, nunca `window.confirm`.

---

## A. Módulos con delete pendiente (prioridad original)

### Prioridad 1 — Core

- ✅ `/buildings` — 2026-04-08
  _delete con modal estándar, pre-check FK, bloqueo si tiene unidades, error inline_
- ✅ `/collections` — 2026-03-16
  _delete flow + modal de confirmación_
- ⚠️ `/buildings/[buildingId]/units` — Parcial
  _cascade soft-delete desde edificio (2026-05-08); eliminar en locales de plaza (2026-05-18);
  delete directo con modal en unidades residenciales no confirmado como ruta standalone_

### Prioridad 2 — Estructura tipológica

- ❌ `/buildings/[buildingId]/unit-types`
- ❌ `/buildings/[buildingId]/unit-types/[unitTypeId]`

### Prioridad 3 — Assets de tipología

- ❌ `/buildings/[buildingId]/unit-types/[unitTypeId]/assets`
- ❌ `/buildings/[buildingId]/unit-types/[unitTypeId]/assets/[templateAssetId]`

### Prioridad 4 — Assets de unidad

- ⚠️ `/buildings/[buildingId]/units/[unitId]/assets` — Parcial
  _el hijo `[assetId]` ya cumple con soft delete (2026-04-13);
  la página padre no está confirmada con modal de delete_

### Prioridad 5 — Limpieza (rutas de unidad)

- ❌ `/buildings/[buildingId]/cleaning/units`
- ❌ `/buildings/[buildingId]/cleaning/units/[unitId]`

---

## B. Migración window.confirm → Modal

- ✅ `/buildings/[buildingId]/cleaning/common` — 2026-04-08
  _eliminado window.confirm en Cleaning, migrado a soft delete global_
- ✅ `/buildings/[buildingId]/cleaning/exterior` — 2026-04-08
  _ídem_

---

## C. Ya conformes con el estándar (del backlog original)

- ✅ `/tenants`
- ✅ `/payments`
- ✅ `/buildings/[buildingId]/units/[unitId]` — sección leases
- ✅ `/buildings/[buildingId]/units/[unitId]/assets/[assetId]` — soft delete via `deleted_at`

---

## D. Módulos con CRUD completo completados (no estaban en backlog)

- ✅ `/purchases` — OCs con crear, editar, estados, versiones, faltantes — 2026-04-16–30
- ✅ `/maintenance` — tickets con crear, editar, cambio de estado — 2026-04-13
- ✅ `/servicios` — facturas por servicio, captura mensual — 2026-05-05
- ✅ `/cobranza/medidores` — medidores con billing_type, distribución — 2026-05-04–12
- ✅ `/suppliers` — proveedores con flag de crédito — 2026-04-27
- ✅ `/users` — gestión de usuarios con roles, desactivar — 2026-04-22
- ✅ `/buildings/[buildingId]/assets` — CRUD completo de equipamiento — 2026-04-13
- ✅ `/buildings/[buildingId]/parking` — parking spots con cascade soft-delete — 2026-05-08

---

# PARTE II — UI POLISH BACKLOG

## Fase 1 — Estabilización funcional
✅ Completada — CRUD flows principales estables, delete estandarizado, módulos operativos.

## Fase 2 — Polish visual

---

### Sistema de Branding

- ✅ Logo empresa en sidebar — 2026-04-21
  _logos SAPROA y MATZ en public/brands, estructura company-assets en Supabase_
- ✅ Logo en header — 2026-04-21
- ✅ Fallback logo — 2026-04-21
- ✅ Color primario configurable por empresa (`brand_color`) — 2026-05-21
  _gradiente metálico, color dinámico por propiedad y grupo_
- ✅ Color de acento configurable (sólido/metálico) — 2026-05-21
- ✅ Colores configurables SAPROA para superadmin (`saproa_config`) — 2026-05-22
- ⚠️ Color secundario configurable — Parcial
  _brand_color implementado; secondary_color como campo independiente no confirmado_

---

### Layout Consistency

- ✅ PageHeader consistente — adoptado en todos los módulos
- ✅ Espaciado global entre cards y secciones — 2026-05-15
- ✅ Card consistency (EntityCard homologado) — 2026-04-29
  _building cards y unit cards unificadas_
- ✅ Cards misma altura (flex column + height 100%) — 2026-05-21
- ✅ Sidebar responsive (hamburger + drawer) — 2026-04-21
- ✅ Sidebar position fixed + spacer — 2026-04-30
- ✅ Tabs en múltiples filas (wrap en lugar de scroll horizontal) — 2026-05-15

---

### Table / Lista Standardization

- ✅ Acciones en dropdown (`...`) — 2026-04-09
  _estandarizado en units, unit-types, assets, cleaning, collections_
- ✅ Dropdown z-index correcto — 2026-04-28
- ⚠️ Empty states (AppEmptyState) — Parcial
  _implementado en módulos principales; no verificado en todos los sub-módulos_

---

### Componentes globales

- ✅ UiButton — adoptado globalmente
- ✅ AppBadge — adoptado, colores semánticos por estado
- ✅ Modal component — adoptado para create/edit/delete
- ✅ SectionCard — adoptado en módulos de oficina y campo
- ✅ PageContainer — adoptado
- ✅ Toast global (react-hot-toast) — 2026-04-20
- ✅ Framer Motion animaciones estándar — 2026-04-27
  _variants centralizados, wizard steps, tabs, stagger_

---

### Dashboard Visual

- ✅ Metric cards rediseñadas con iconos, colores semánticos — 2026-04-10
- ✅ Gráfica de barras cobranza — 2026-04-09
- ✅ Dona de ocupación — 2026-04-09
- ✅ Alertas visuales / bolitas de notificación en cascada — 2026-05-18
- ✅ Checklist mensual en dashboard — 2026-05-18
- ✅ Onboarding guiado / empty state bienvenida + card progreso — 2026-05-21
- ✅ Dashboard responsive móvil — 2026-04-28

---

### Page-by-Page Visual Pass

| Módulo | Estado | Fecha |
|---|---|---|
| Dashboard | ✅ Completado | 2026-04-09 |
| Tenants | ✅ Completado | 2026-04-13 |
| Buildings / Propiedades | ✅ Completado | 2026-04-13 |
| Unit Types (Tipologías) | ⚠️ Parcial | wizard 2026-05-20, visual pass standalone pendiente |
| Units | ✅ Completado | múltiples iteraciones |
| Leases | ✅ Completado | integradas en unit detail |
| Assets / Equipamiento | ✅ Completado | 2026-04-13 |
| Maintenance | ✅ Completado | 2026-04-13, 2026-04-27 |
| Cleaning | ✅ Completado | 2026-04-23 |
| Payments | ✅ Completado | 2026-05-06 |
| Collections / Cobranza | ✅ Completado | 2026-04-15 |
| Calendar | ✅ Completado | 2026-04-23 |
| Compras | ✅ Completado | 2026-04-27 |
| Servicios | ✅ Completado | 2026-05-12 |
| Medidores | ✅ Completado | 2026-05-12 |
| Suppliers | ✅ Completado | 2026-04-27 |

---

# PARTE III — Completados fuera del Roadmap Original
## Features detectadas en commits que no estaban en CRUD_BACKLOG ni UI_POLISH_BACKLOG

---

### Sistema de tipos y subtipos de propiedad

- ✅ Tipos de propiedad en formulario y cards (iteración 1) — 2026-05-13
- ✅ Terrenos con m² de superficie (iteración 2) — 2026-05-14
- ✅ Página de detalle adaptada por tipo (residencial, comercial, industrial, terreno) — 2026-05-14–15
- ✅ Subtipos comerciales e industriales (local, oficinas, plaza, showroom, nave, planta) — 2026-05-15
- ✅ Labels dinámicos por tipo en portafolio y tabs — 2026-05-15
- ✅ Ficha residential_single con atributos físicos — 2026-05-15
- ✅ Bodegas hijas excluidas del portafolio principal — 2026-05-15
- ✅ Units/Areas adaptadas por subtipo industrial — 2026-05-15
- ✅ Locales de plaza/comercial como units (refactor de buildings hijos) — 2026-05-18

---

### Sistema de features configurables y setup checklist

- ✅ Features panel conectado con DB, indicadores ok/pending — 2026-05-15
- ✅ Tabs condicionales por features activas (`building_feature_config`) — 2026-05-15
- ✅ Setup checklist por propiedad con donut de progreso — 2026-05-15
- ✅ Navegación por tarea desde checklist (query param `?tab=`) — 2026-05-15
- ✅ Tareas completadas visibles, botón omitir — 2026-05-15
- ✅ Checklist filtrado por tipo de propiedad — 2026-05-15

---

### Wizard multi-paso para propiedades y tipologías

- ✅ Wizard multi-paso para propiedades (varios tipos) — 2026-05-20
- ✅ Wizard tipologías — modal ancho, baños por espacio, grupos privado/social/servicio — 2026-05-20
- ✅ Wizard paso 3 — mobiliario detallado, cocina en cascada, lavandería, resumen — 2026-05-20
- ✅ Wizard paso 3 — boilers múltiples e independientes — 2026-05-21
- ✅ Wizard paso 3 — navegación guiada por espacios, animaciones en expansiones — 2026-05-21
- ✅ Wizard paso 3 — panel lateral izquierdo/derecho en lugar de accordion — 2026-05-20
- ✅ Wizard resumen — grid balanceado adaptativo por cantidad de espacios — 2026-05-21

---

### Sistema de temas UI

- ✅ Sistema de temas (Clásico, Super Soft) con tokens CSS — 2026-05-20
- ✅ Modo oscuro con cards visuales + persistencia correcta — 2026-05-20
- ✅ Tema Rígido — 2026-05-20
- ✅ Persistencia de tema via localStorage + `user_preferences` en Supabase — 2026-05-22
- ✅ Tema UI y dark mode guardados por usuario — 2026-05-22
- ✅ Border-radius exhaustivo — toda la app usa variables CSS del tema — 2026-05-21
- ✅ Arquitectura de temas: border-radius, sombras, colores 100% en CSS variables — 2026-05-21

---

### Áreas comunes / Amenidades

- ✅ Módulo de áreas comunes — grid de cards con ícono centrado — 2026-05-21
- ✅ Modal visual con categorías predefinidas — 2026-05-21
- ✅ Toggle reservable + configuración + sección reservaciones — 2026-05-21

---

### Sistema de notificaciones en cascada

- ✅ Bolitas de notificación en cards del portafolio — 2026-05-18
- ✅ Badge sidebar con suma real de pendientes + refresco cada 60s — 2026-05-18
- ✅ Cascada en compras, cobranza, mantenimiento (brand/ámbar/rojo) — 2026-05-20
- ✅ Cascada en pagos, limpieza, configuración, dashboard — 2026-05-20
- ✅ Banner de servicios pendientes en /servicios — 2026-05-20
- ✅ Notificaciones en /payments — badge sidebar + banner — 2026-05-21
- ✅ Banner de tareas pendientes al inicio de cada tab — 2026-05-18
- ✅ Auto-completar tareas de setup con count queries paralelas — 2026-05-18

---

### Módulo de Servicios (utilities) y Medidores

- ✅ Unificación de servicios bajo `building_utility_meters` — 2026-05-05
- ✅ Página `/servicios` — checklist mensual por edificio — 2026-05-05
- ✅ billing_mode (included/charged) en medidores — 2026-05-04
- ✅ billing_type (fixed/variable) en medidores — 2026-05-12
- ✅ Panel de distribución para medidores compartidos — 2026-05-12
- ✅ PDF Recibo Servicio + Reporte de Distribución — 2026-05-12
- ✅ Bundle PDFs en ZIP — 2026-05-13
- ✅ Logos en PDFs (logo_print_url, base64, proxy CORS) — 2026-05-13
- ✅ Medidores de luz CFE — Fase 1 — 2026-05-04
- ✅ Módulo Medidores en sidebar, dashboard, tab campo — 2026-05-12
- ✅ Placeholders de servicios en cobros — 2026-05-08

---

### Módulo de Compras (Purchase Orders)

- ✅ OCs con estados (draft, enviada, parcial, facturada), folio correlativo — 2026-04-17
- ✅ PDF de Orden de Compra (Montserrat, precios, firma) — 2026-04-17
- ✅ Reporte de envío a pagos — 2026-04-16
- ✅ XML SAT — tabla de conceptos facturados, botón reemplazar — 2026-04-27
- ✅ Filtros de estado como pills visuales — 2026-04-27
- ✅ Versiones de OC (-V2/-V3, parent_order_id) — 2026-04-29
- ✅ OC faltantes con folio -V2/-V3 — 2026-04-30
- ✅ Progreso del ticket en detalle de OC — 2026-04-30
- ✅ Módulo de devoluciones de OC — Fase 1 — 2026-04-30
- ✅ Módulo de cambios y devoluciones — Fase 2 (exchanges) — 2026-04-30
- ✅ OCs draft desde mantenimiento, materiales por proveedor en campo — 2026-04-17

---

### Vista consolidada Grupo MATZ (Multi-empresa)

- ✅ Infraestructura base — `ImpersonationContext`, banner con logos, color dorado — 2026-05-22
- ✅ Panel de impersonación "Ver como..." (sidebar árbol grupo→empresa→usuario) — 2026-05-22
- ✅ "Ver empresa" — vista completa de empresa — 2026-05-22
- ✅ Vista simulada con brand_color de empresa — 2026-05-22
- ✅ Propiedades agrupadas por empresa (Fase 2) — 2026-05-22
- ✅ Todos los módulos con patrón agrupado/unificado (Fase 3) — 2026-05-25
  _tenants, suppliers, purchases, cobranza/medidores, cleaning, servicios, payments, maintenance_

---

### Sistema de roles y accesos

- ✅ Roles granulares (superadmin, administracion, directivo, compras, mantenimiento, field, tenant) — 2026-04-22
- ✅ RouteGuard por rol — 2026-04-22
- ✅ Menú filtrado por rol en sidebar — 2026-04-22
- ✅ Dashboards por rol (compras, mantenimiento, campo) — 2026-04-22
- ✅ Rol titular — cuenta maestra por empresa con acceso completo — 2026-05-19
- ✅ Titular puede gestionar usuarios de su empresa en /users — 2026-05-19

---

### Portal de campo (PWA móvil)

- ✅ Portal campo completo — dashboard móvil, tickets con cámara, limpieza del día — 2026-04-15
- ✅ Assets con reporte de incidencia, PWA meta tags, bottom navigation — 2026-04-15
- ✅ Fotos múltiples desde carrete con subida a Supabase Storage — 2026-04-16
- ✅ OCs pendientes en campo, recepción con faltantes — 2026-04-27
- ✅ Responsable de recoger conectado a app_users — 2026-04-24

---

### Portal del inquilino

- ✅ Portal login seguro + activación de cuenta — 2026-03-14
- ✅ Dashboard portal con datos reales de lease — 2026-03-15
- ✅ Flujo de renovación de contrato desde portal — 2026-03-15
- ✅ Reporte de pago con comprobante (upload a Storage) — 2026-03-15
- ✅ Historial de pagos reportados en portal — 2026-03-15
- ✅ Vista admin de pagos reportados (tabs, motivo de rechazo) — 2026-03-15
- ✅ Ficha pública compartible `/p/[token]` con botón compartir — 2026-05-19

---

### Módulo de limpieza (rediseño completo)

- ✅ Tracking semanal, checklist auto-save, historial 30 días — 2026-04-23
- ✅ Dona de progreso reactiva, auto-completar tarea al terminar checklist — 2026-04-23
- ✅ Modal nueva tarea interior con hora/duración/frecuencia — 2026-04-23
- ✅ Editar/eliminar horarios — 2026-04-28
- ✅ Filtros toggleables en leyenda — 2026-04-24
- ✅ Horarios de limpieza — botón eliminar con Modal (reemplaza X) — 2026-05-18

---

### Módulo de mantenimiento (completo)

- ✅ Tickets con fotos, materiales editables, PDF orden — 2026-04-13
- ✅ Modal crear ticket, cambio de estado inline — 2026-04-13
- ✅ Calendario semanal de mantenimiento — 2026-04-13
- ✅ Resumen de OCs en detalle de ticket — 2026-04-30
- ✅ sort numérico de unidades + CTA dinámico lista de materiales (campo) — 2026-04-30

---

### Cobranza y pagos (funcionalidades extendidas)

- ✅ Abonos parciales, estado automático, cargo eventual — 2026-04-14
- ✅ Modelo by_room — cobranza por cuarto, dona proporcional — 2026-04-14
- ✅ Revertir pagos con confirmación — 2026-04-14
- ✅ Identificador de edificio por color en cobranza — 2026-04-15
- ✅ Pagos: pestaña Reportes + folio RPG-YYYY-SWW — 2026-05-07
- ✅ Invoice columns en reporte de pagos — 2026-05-07
- ✅ Preservar status de collection_record en re-distribución — 2026-05-13
- ✅ Historial de precios de renta por unidad/edificio — 2026-04-30

---

### Analytics

- ✅ Panel de analytics operativo — ocupación, tipologías, rotación, gasto por persona — 2026-04-22
- ✅ Analytics: eficiencia de cobro, comportamiento de pago, historial de rentas — 2026-04-22

---

### Calendario global

- ✅ Módulo calendario con vistas mensual/semanal/anual — 2026-04-23
- ✅ Colores consistentes por módulo (MODULE_COLORS) — 2026-04-23
- ✅ Eventos de limpieza, pagos proyectados, mantenimiento — 2026-03-11
- ✅ Popup de overflow de eventos por día — 2026-03-13

---

### Infraestructura y developer experience

- ✅ Sistema de diseño completo — paletas light/dark, variables CSS semánticas — 2026-04-10
- ✅ zod + react-hook-form — validación inline en toda la app — 2026-04-20
- ✅ LocationPicker — buscador Nominatim, mapa interactivo, marker draggable — 2026-04-20
- ✅ Framer Motion — sistema de animaciones centralizado — 2026-04-27
- ✅ date-fns — formateo de fechas en español, ISO-8601 semanas — 2026-04-20
- ✅ Soft delete global (`deleted_at`) en todas las tablas principales — 2026-04-08
- ✅ RLS completo en todas las tablas — 2026-04-21
- ✅ Módulo de documentos estilo Google Drive en detalle de propiedad — 2026-05-19
- ✅ Galería de fotos con secciones, drag & drop, lightbox — 2026-05-19
- ✅ Splash screen estilo Netflix post-login — 2026-04-22
- ✅ Carrusel automático en landing — 2026-04-22
- ✅ Buzón de feedback (botón flotante + modal + panel superadmin) — 2026-04-22
- ✅ natural sort para números de unidades — 2026-05-11
- ✅ Parking spots tab + cascade soft-delete desde edificio — 2026-05-08
- ✅ Auditoría exhaustiva dark mode, a11y, console.logs — 2026-05-21

---

# RESUMEN EJECUTIVO

| Categoría | ✅ | ⚠️ | ❌ |
|---|---|---|---|
| CRUD Backlog (delete) | 4 | 2 | 6 |
| UI Polish | 28 | 3 | 0 |
| Fuera del roadmap | 90+ | — | — |

**Pendientes de mayor impacto:**
1. Delete modal en rutas de unit-types (Prioridades 2 y 3 del CRUD backlog)
2. Delete en cleaning/units y cleaning/units/[unitId]
3. Confirmar delete standalone en `/buildings/[buildingId]/units`
4. Color secundario como campo independiente en branding
5. Empty states (AppEmptyState) en sub-módulos restantes
