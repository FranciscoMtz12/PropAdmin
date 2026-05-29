# SAPROA — Roadmap

> **Fuente canónica:** `app/saproa-admin/roadmap/page.tsx`
> Este archivo es un espejo de lectura del roadmap hardcodeado en la página de la app.
> Para agregar, editar o marcar como completado un ítem, modifica el array `ROADMAP` en
> ese archivo y actualiza este `.md` en el mismo commit.

---

## Pendientes

### Alta prioridad 🔴

| ID  | Ítem | Categoría | Descripción |
|-----|------|-----------|-------------|
| S1  | Enmascaramiento de datos sensibles | Seguridad | RFC, teléfonos y correos no deben mostrarse en claro a usuarios sin permiso. |
| S2  | Auditar endpoints API sin autenticación | Seguridad | Verificar que ninguna ruta /api/* sea accesible sin sesión válida. |
| S6  | Aviso de privacidad en registro | Legal | Mostrar y requerir aceptación del aviso de privacidad al crear cuenta. |
| S7  | Términos y condiciones | Legal | Mostrar T&C al registrarse y al primer login. |
| A4  | Onboarding por propiedad sin unidades | UX | Guía de configuración inicial para propiedades que aún no tienen unidades. |

### Media prioridad 🟡

| ID  | Ítem | Categoría | Descripción |
|-----|------|-----------|-------------|
| M2  | Analytics con tabs por módulo | Analytics | Dividir analytics en pestañas: cobranza, mantenimiento, compras, servicios. |
| M9  | Migrar Storage a privados | Seguridad | Los buckets actuales son públicos; migrar a signed URLs con expiración. |
| M15 | Analytics Grupo MATZ | Analytics | Vista de analytics consolidada para el superadmin del grupo. |
| M16 | Seed de datos de prueba | Developer | Script de seed reproducible para QA y demos. |
| M11 | Vista ejecutiva mobile | Mobile | Dashboard simplificado para directivos en dispositivos móviles. |

### Baja prioridad 🟢

| ID  | Ítem | Categoría | Descripción |
|-----|------|-----------|-------------|
| L4  | Permisos granulares | Plataforma | Sistema de permisos por módulo más fino que los roles actuales. |
| L8  | Portal inquilinos completo | Portal | Flujo completo: contrato digital, pagos, solicitudes de mantenimiento. |
| L17 | Pagos Stripe/SPEI | Fintech | Integración de pasarela de pagos para cobros desde el portal. |
| P1  | Demo interactivo | Marketing | Versión demo con datos ficticios para prospectos. |
| P2  | Video intro HeyGen | Marketing | Video de onboarding generado con IA para nuevos clientes. |

---

## Completado ✅

| ID    | Ítem | Categoría | Descripción |
|-------|------|-----------|-------------|
| F-A   | Login: flujo unificado y fixes de UX | Login/UX | Rebote eliminado, login unificado, ruteo a /home, flash al cambiar empresa, splash limpio, destello de impersonación y color del botón Entrar corregidos. |
| F-B   | Performance: queries y rutas optimizadas | Performance | Índices aplicados en Supabase. /compras y /cobranza optimizadas. Analytics, mantenimiento y servicios con carga mejorada. |
| F-DS1 | Tokens del sistema de diseño definidos | Design System | Tipografía, espaciado base y paleta de colores de estado (error/éxito/warning/info) documentados como CSS vars globales en el sistema. |
| F-DS2 | Catálogo de componentes creado | Design System | Página /saproa-admin/design-system con galería completa de componentes reutilizables, sandbox de previsualización y generador de reporte de preferencias de diseño. |

---

## Notas de sincronización

- La página `/saproa-admin/roadmap` lee directamente del array TypeScript — no consume este `.md`.
- Conectar la página para que lea del `.md` requeriría un componente servidor + parser de markdown (riesgo moderado). Por ahora se mantienen sincronizados manualmente en el mismo commit.
- El array `ROADMAP_PENDING` en `app/saproa-admin/overview/page.tsx` es independiente y muestra los 5 ítems de más alto riesgo para el overview del superadmin.
