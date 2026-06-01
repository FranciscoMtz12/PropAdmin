"use client";

import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { motion } from "framer-motion";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import { staggerContainer, staggerItem } from "@/lib/animations";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RoadmapStatus = "pendiente" | "parcial" | "bloqueador" | "completado";

type RoadmapItem = {
  id: string;
  label: string;
  description: string;
  /** Para "parcial" y "bloqueador": qué falta o por qué bloquea. */
  note?: string;
  category: string;
  priority?: "alta" | "media" | "baja";
  status: RoadmapStatus;
};

// ─── Datos del roadmap ────────────────────────────────────────────────────────

const ROADMAP: RoadmapItem[] = [

  /* ══════════════════════════════════════════════════════════════════
     🔴 BLOQUEADORES — requeridos antes de onboardear usuarios reales
  ══════════════════════════════════════════════════════════════════ */
  {
    id: "S6",
    label: "Aviso de privacidad en registro",
    description: "Mostrar y requerir aceptación del aviso de privacidad al crear cuenta.",
    note: "Existe texto y la página /privacy está accesible. Falta checkbox obligatorio que bloquee el submit hasta que el usuario acepte. Sin consentimiento explícito y registrado no es válido onboardear usuarios reales.",
    category: "Legal", priority: "alta", status: "bloqueador",
  },
  {
    id: "S7",
    label: "Términos y condiciones",
    description: "Mostrar T&C al registrarse y al primer login.",
    note: "Igual que S6: existen páginas /terms con contenido y los links ya navegan correctamente, pero falta el checkbox obligatorio de aceptación previa al submit. Sin esto el consentimiento no queda registrado.",
    category: "Legal", priority: "alta", status: "bloqueador",
  },

  /* ══════════════════════════════════════════════════════════════════
     PENDIENTES / PARCIALES — agrupados por prioridad
  ══════════════════════════════════════════════════════════════════ */

  /* ── Alta prioridad ── */
  {
    id: "S2",
    label: "Auditar endpoints API sin autenticación",
    description: "Verificar que ninguna ruta /api/* sea accesible sin sesión válida.",
    note: "Casi todos los endpoints tienen auth (/api/users/create y /api/portal/renewal-response protegidos; /api/portal/activate-account es públic intencional). Falta: /api/logo-proxy no tiene autenticación, solo whitelist de URL.",
    category: "Seguridad", priority: "alta", status: "parcial",
  },

  /* ── Media prioridad ── */
  {
    id: "M9",
    label: "Migrar Storage a privados",
    description: "Los buckets actuales son públicos; migrar a signed URLs con expiración.",
    note: "Infraestructura de signed URLs implementada en lib/storage.ts, lib/storage-utils.ts y lib/invoiceStorage.ts; usada en /collections. Falta: app/settings, app/register y app/maintenance aún usan getPublicUrl() para logos y fotos.",
    category: "Seguridad", priority: "media", status: "parcial",
  },
  {
    id: "M15",
    label: "Analytics Grupo MATZ",
    description: "Vista de analytics consolidada para el superadmin del grupo.",
    note: "Consolidación de portafolio implementada en /buildings (modo grupo muestra totales entre empresas). Falta: el módulo /analytics no detecta modo grupo ni agrega métricas de múltiples empresas.",
    category: "Analytics", priority: "media", status: "parcial",
  },
  {
    id: "M11",
    label: "Vista ejecutiva mobile",
    description: "Dashboard simplificado para directivos en dispositivos móviles.",
    category: "Mobile", priority: "media", status: "pendiente",
  },

  /* ── Baja prioridad ── */
  {
    id: "L4",
    label: "Permisos granulares",
    description: "Sistema de permisos por módulo más fino que los roles actuales.",
    category: "Plataforma", priority: "baja", status: "pendiente",
  },
  {
    id: "L8",
    label: "Portal inquilinos completo",
    description: "Flujo completo: contrato digital, pagos, solicitudes de mantenimiento.",
    note: "6 rutas funcionando: login, dashboard, invoices, contract (display), renewal, report-payment. Falta: firma digital de contrato, pasarela de pago real (actualmente solo se reporta transferencia manual), y módulo de solicitudes de mantenimiento desde el portal.",
    category: "Portal", priority: "baja", status: "parcial",
  },
  {
    id: "L17",
    label: "Pagos Stripe/SPEI",
    description: "Integración de pasarela de pagos para cobros desde el portal.",
    category: "Fintech", priority: "baja", status: "pendiente",
  },
  {
    id: "P1",
    label: "Demo interactivo",
    description: "Versión demo con datos ficticios para prospectos.",
    category: "Marketing", priority: "baja", status: "pendiente",
  },
  {
    id: "P2",
    label: "Video intro HeyGen",
    description: "Video de onboarding generado con IA para nuevos clientes.",
    category: "Marketing", priority: "baja", status: "pendiente",
  },

  /* ══════════════════════════════════════════════════════════════════
     COMPLETADOS — verificados contra el código real
  ══════════════════════════════════════════════════════════════════ */
  {
    id: "S1",
    label: "Enmascaramiento de datos sensibles",
    description: "SensitiveField implementado con masking por tipo: RFC (primeros/últimos 3), teléfonos (primeros 3 + últimos 4), correos (dominio visible), cuentas bancarias (últimos 4). En uso en tenants, suppliers y ficha de unidades.",
    category: "Seguridad", status: "completado",
  },
  {
    id: "A4",
    label: "Onboarding por propiedad sin unidades",
    description: "Banner dismissible en /buildings que detecta propiedades sin configurar y guía con 'Configurar ahora →'. Empty state con guía de 5 pasos cuando el portafolio está vacío. Sistema de building_setup_tasks en ficha de inmueble.",
    category: "UX", status: "completado",
  },
  {
    id: "M16",
    label: "Seed de datos de prueba",
    description: "Tres scripts reproducibles: seed-full.mjs (completo, idempotente), seed-payments.mjs y seed-payment-reports.mjs. Datos marcados con is_test=true para fácil limpieza.",
    category: "Developer", status: "completado",
  },
  {
    id: "M2",
    label: "Analytics con tabs por módulo",
    description: "Estructura de 5 tabs implementada: Portafolio, Cobranza, Mantenimiento, Limpieza, Servicios. Portafolio y Cobranza con contenido completo. Nota: Mantenimiento/Limpieza/Servicios muestran placeholder 'Próximamente'.",
    category: "Analytics", status: "completado",
  },
  {
    id: "F-A",
    label: "Login: flujo unificado y fixes de UX",
    description: "Rebote eliminado, login unificado, ruteo a /home, flash al cambiar empresa, splash limpio, destello de impersonación y color del botón Entrar corregidos. Links a /terms y /privacy corregidos en RouteGuard (se abrían pero el guard las redirigía).",
    category: "Login/UX", status: "completado",
  },
  {
    id: "F-B",
    label: "Performance: queries y rutas optimizadas",
    description: "Índices aplicados en Supabase. /compras y /cobranza optimizadas. Analytics, mantenimiento y servicios con carga mejorada.",
    category: "Performance", status: "completado",
  },
  {
    id: "F-DS1",
    label: "Tokens del sistema de diseño definidos",
    description: "Tipografía, espaciado base y paleta de colores de estado (error/éxito/warning/info) documentados como CSS vars globales.",
    category: "Design System", status: "completado",
  },
  {
    id: "F-DS2",
    label: "Catálogo de componentes creado",
    description: "Página /saproa-admin/design-system con galería completa, sandbox de previsualización de temas y generador de reporte de preferencias de diseño.",
    category: "Design System", status: "completado",
  },
];

// ─── Configuración visual por prioridad ───────────────────────────────────────

const PRIORITY_CONFIG = {
  alta:  { label: "Alta prioridad",  color: "var(--metric-value-red)",   bg: "rgba(239,68,68,0.08)",  badgeVariant: "red"   as const },
  media: { label: "Media prioridad", color: "var(--metric-value-amber)", bg: "rgba(245,158,11,0.08)", badgeVariant: "amber" as const },
  baja:  { label: "Baja prioridad",  color: "var(--metric-value-green)", bg: "rgba(34,197,94,0.08)",  badgeVariant: "green" as const },
};

const PRIORITIES: Array<"alta" | "media" | "baja"> = ["alta", "media", "baja"];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SaproaRoadmapPage() {
  const blockerItems   = ROADMAP.filter((i) => i.status === "bloqueador");
  const completedItems = ROADMAP.filter((i) => i.status === "completado");

  const pendingAndPartialByPriority = (priority: "alta" | "media" | "baja") =>
    ROADMAP.filter((i) =>
      (i.status === "pendiente" || i.status === "parcial") && i.priority === priority
    );

  return (
    <PageContainer>
      <PageHeader
        title="Roadmap"
        subtitle="Estado actual reconciliado contra el código real"
        titleIcon={<FileText size={18} />}
      />

      {/* ══════════════════════════════════════════════════════════════
          SECCIÓN BLOQUEADORES — requeridos antes de onboarding real
      ══════════════════════════════════════════════════════════════ */}
      {blockerItems.length > 0 && (
        <SectionCard
          title={`Bloqueador pre-lanzamiento (${blockerItems.length})`}
          subtitle="Estos ítems deben resolverse antes de onboardear usuarios reales"
          icon={<AlertTriangle size={14} color="var(--priority-urgent)" />}
          style={{
            marginBottom: 16,
            border: "1.5px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.03)",
          }}
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {blockerItems.map((item) => (
              <motion.div
                key={item.id}
                variants={staggerItem}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "12px 14px",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "var(--border-radius-md)",
                }}
              >
                <AlertTriangle
                  size={18}
                  color="var(--priority-urgent)"
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--metric-value-red)", minWidth: 28 }}>
                      {item.id}
                    </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {item.label}
                    </span>
                    <AppBadge variant="red">{item.category}</AppBadge>
                    <AppBadge variant="red">🚫 Bloqueador</AppBadge>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {item.description}
                  </p>
                  {item.note && (
                    <p style={{ margin: "5px 0 0", fontSize: "0.75rem", color: "var(--metric-value-red)", lineHeight: 1.5, fontWeight: 600 }}>
                      ⚠ {item.note}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECCIONES POR PRIORIDAD — pendientes y parciales
      ══════════════════════════════════════════════════════════════ */}
      {PRIORITIES.map((priority) => {
        const config = PRIORITY_CONFIG[priority];
        const items  = pendingAndPartialByPriority(priority);
        if (!items.length) return null;

        return (
          <SectionCard
            key={priority}
            title={config.label}
            icon={
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: config.color,
                  display: "inline-block",
                }}
              />
            }
            style={{ marginBottom: 16 }}
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {items.map((item) => {
                const isParcial = item.status === "parcial";
                return (
                  <motion.div
                    key={item.id}
                    variants={staggerItem}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "12px 14px",
                      background: isParcial ? "rgba(245,158,11,0.06)" : config.bg,
                      border: isParcial
                        ? "1px solid rgba(245,158,11,0.3)"
                        : `1px solid ${config.color}22`,
                      borderRadius: "var(--border-radius-md)",
                    }}
                  >
                    {/* Indicador: vacío = pendiente, mitad rellena = parcial */}
                    {isParcial ? (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "var(--border-radius-sm)",
                          border: "2px solid rgba(245,158,11,0.6)",
                          background: "linear-gradient(to right, rgba(245,158,11,0.5) 50%, transparent 50%)",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "var(--border-radius-sm)",
                          border: `2px solid ${config.color}55`,
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: config.color, minWidth: 28 }}>
                          {item.id}
                        </span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {item.label}
                        </span>
                        <AppBadge variant={config.badgeVariant}>{item.category}</AppBadge>
                        {isParcial && <AppBadge variant="amber">⚠ Parcial</AppBadge>}
                      </div>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                      {isParcial && item.note && (
                        <p style={{ margin: "5px 0 0", fontSize: "0.75rem", color: "var(--metric-value-amber)", lineHeight: 1.5 }}>
                          Falta: {item.note}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </SectionCard>
        );
      })}

      {/* ══════════════════════════════════════════════════════════════
          COMPLETADOS
      ══════════════════════════════════════════════════════════════ */}
      {completedItems.length > 0 && (
        <SectionCard
          title={`Completado (${completedItems.length})`}
          icon={<CheckCircle2 size={14} color="var(--metric-value-green)" />}
          style={{ marginBottom: 16 }}
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {completedItems.map((item) => (
              <motion.div
                key={item.id}
                variants={staggerItem}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "12px 14px",
                  background: "var(--metric-bg-green)",
                  border: "1px solid var(--metric-border-green)",
                  borderRadius: "var(--border-radius-md)",
                  opacity: 0.9,
                }}
              >
                <CheckCircle2 size={18} color="var(--metric-value-green)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--metric-value-green)", minWidth: 40 }}>
                      {item.id}
                    </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-secondary)", textDecoration: "line-through", textDecorationColor: "var(--metric-value-green)" }}>
                      {item.label}
                    </span>
                    <AppBadge variant="green">{item.category}</AppBadge>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </SectionCard>
      )}
    </PageContainer>
  );
}
