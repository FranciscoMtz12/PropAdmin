# SAPROA — Roadmap

> **Fuente canónica:** `app/saproa-admin/roadmap/page.tsx`
> Este archivo es un espejo de lectura del roadmap. Para agregar, editar o cambiar el estado
> de un ítem, modifica el array `ROADMAP` en ese archivo y actualiza este `.md` en el mismo commit.
>
> **Última reconciliación contra el código real:** estados auditados y verificados en el repo.

---

## 🔴 Bloqueador pre-lanzamiento

> Requerido antes de onboardear usuarios reales. Sin estos ítems no se captura consentimiento
> válido y el producto no puede onboardear a clientes.

| ID  | Ítem | Categoría | Descripción | Qué falta |
|-----|------|-----------|-------------|-----------|
| S6  | Aviso de privacidad en registro | Legal | Mostrar y requerir aceptación del aviso de privacidad al crear cuenta. | Existe texto y la página `/privacy` está accesible. **Falta checkbox obligatorio** que bloquee el submit hasta aceptar. Sin consentimiento explícito no es válido onboardear usuarios reales. |
| S7  | Términos y condiciones | Legal | Mostrar T&C al registrarse y al primer login. | Igual que S6: existen páginas `/terms` con contenido y los links navegan correctamente. **Falta checkbox obligatorio** de aceptación previa al submit. |

---

## Pendientes

### Alta prioridad 🔴

| ID  | Ítem | Categoría | Estado | Qué falta (si parcial) |
|-----|------|-----------|--------|------------------------|
| S2  | Auditar endpoints API sin autenticación | Seguridad | ⚠️ Parcial | Casi todos protegidos. Falta justificar/proteger `/api/logo-proxy` (sin sesión, solo whitelist de URL). |

### Media prioridad 🟡

| ID  | Ítem | Categoría | Estado | Qué falta (si parcial) |
|-----|------|-----------|--------|------------------------|
| M9  | Migrar Storage a privados | Seguridad | ⚠️ Parcial | Infraestructura de signed URLs implementada. Falta migrar `app/settings`, `app/register` y `app/maintenance` que aún usan `getPublicUrl()`. |
| M15 | Analytics Grupo MATZ | Analytics | ⚠️ Parcial | Consolidación existe en `/buildings` en modo grupo. Falta: `/analytics` no distingue modo grupo ni agrega métricas entre empresas. |
| M11 | Vista ejecutiva mobile | Mobile | ❌ Pendiente | — |

### Baja prioridad 🟢

| ID  | Ítem | Categoría | Estado | Qué falta (si parcial) |
|-----|------|-----------|--------|------------------------|
| L4  | Permisos granulares por módulo | Plataforma | ❌ Pendiente | — |
| L8  | Portal inquilinos completo | Portal | ⚠️ Parcial | 6 rutas funcionando. Falta: firma digital de contrato, pasarela de pago real (actualmente solo se reporta transferencia manual), y solicitudes de mantenimiento desde el portal. |
| L17 | Pagos Stripe/SPEI | Fintech | ❌ Pendiente | — |
| P1  | Demo interactivo | Marketing | ❌ Pendiente | — |
| P2  | Video intro HeyGen | Marketing | ❌ Pendiente | — |

---

## ✅ Completado

> Verificado contra el código real del repositorio.

| ID     | Ítem | Categoría | Evidencia / Notas |
|--------|------|-----------|-------------------|
| S1     | Enmascaramiento de datos sensibles | Seguridad | `components/SensitiveField.tsx` — masking por tipo (RFC, phone, email, bank). Usado en tenants, suppliers y ficha de unidades. |
| A4     | Onboarding por propiedad sin unidades | UX | `app/buildings/page.tsx` líneas 973-1015: banner dismissible. Líneas 1128-1165: empty state con guía de 5 pasos. |
| M16    | Seed de datos de prueba | Developer | `scripts/seed-full.mjs`, `scripts/seed-payments.mjs`, `scripts/seed-payment-reports.mjs` — idempotentes, flag `is_test=true`. |
| M2     | Analytics con tabs por módulo | Analytics | `app/analytics/page.tsx`: 5 tabs (Portafolio, Cobranza, Mantenimiento, Limpieza, Servicios). Portafolio y Cobranza completos. Mantenimiento/Limpieza/Servicios con placeholder "Próximamente". |
| F-A    | Login: flujo unificado y fixes de UX | Login/UX | Rebote, ruteo, flash de color, splash, destello de impersonación, botón Entrar y links a /terms y /privacy corregidos. |
| F-B    | Performance: queries y rutas optimizadas | Performance | Índices Supabase, /compras y /cobranza optimizadas, analytics/mantenimiento/servicios mejorados. |
| F-DS1  | Tokens del sistema de diseño definidos | Design System | Tipografía, espaciado, paleta de estados como CSS vars globales en `app/globals.css`. |
| F-DS2  | Catálogo de componentes creado | Design System | Página `/saproa-admin/design-system` con galería, sandbox de previsualización y generador de reporte. |

---

## Notas de sincronización

- La página `/saproa-admin/roadmap` lee directamente del array TypeScript — no consume este `.md`.
- Sincronización manual en el mismo commit: al cambiar un ítem en `page.tsx`, actualizar este `.md`.
- El array `ROADMAP_PENDING` en `app/saproa-admin/overview/page.tsx` es independiente y muestra los 5 ítems de mayor riesgo para el widget del overview.
