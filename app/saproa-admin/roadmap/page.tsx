"use client";

import { CheckCircle2, FileText } from "lucide-react";
import { motion } from "framer-motion";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppBadge from "@/components/AppBadge";
import { staggerContainer, staggerItem } from "@/lib/animations";

type RoadmapItem = {
  id: string;
  label: string;
  description: string;
  category: string;
  priority?: "alta" | "media" | "baja";
  status: "pendiente" | "completado";
};

const ROADMAP: RoadmapItem[] = [
  /* ── Pendientes — Alta prioridad ───────────────────────────────── */
  { id: "S1",    label: "Enmascaramiento de datos sensibles",      description: "RFC, teléfonos y correos no deben mostrarse en claro a usuarios sin permiso.",                    category: "Seguridad",     priority: "alta",  status: "pendiente" },
  { id: "S2",    label: "Auditar endpoints API sin autenticación",  description: "Verificar que ninguna ruta /api/* sea accesible sin sesión válida.",                              category: "Seguridad",     priority: "alta",  status: "pendiente" },
  { id: "S6",    label: "Aviso de privacidad en registro",          description: "Mostrar y requerir aceptación del aviso de privacidad al crear cuenta.",                          category: "Legal",         priority: "alta",  status: "pendiente" },
  { id: "S7",    label: "Términos y condiciones",                   description: "Mostrar T&C al registrarse y al primer login.",                                                   category: "Legal",         priority: "alta",  status: "pendiente" },
  { id: "A4",    label: "Onboarding por propiedad sin unidades",    description: "Guía de configuración inicial para propiedades que aún no tienen unidades.",                      category: "UX",            priority: "alta",  status: "pendiente" },
  /* ── Pendientes — Media prioridad ──────────────────────────────── */
  { id: "M2",    label: "Analytics con tabs por módulo",            description: "Dividir analytics en pestañas: cobranza, mantenimiento, compras, servicios.",                    category: "Analytics",     priority: "media", status: "pendiente" },
  { id: "M9",    label: "Migrar Storage a privados",                description: "Los buckets actuales son públicos; migrar a signed URLs con expiración.",                         category: "Seguridad",     priority: "media", status: "pendiente" },
  { id: "M15",   label: "Analytics Grupo MATZ",                     description: "Vista de analytics consolidada para el superadmin del grupo.",                                    category: "Analytics",     priority: "media", status: "pendiente" },
  { id: "M16",   label: "Seed de datos de prueba",                  description: "Script de seed reproducible para QA y demos.",                                                    category: "Developer",     priority: "media", status: "pendiente" },
  { id: "M11",   label: "Vista ejecutiva mobile",                   description: "Dashboard simplificado para directivos en dispositivos móviles.",                                  category: "Mobile",        priority: "media", status: "pendiente" },
  /* ── Pendientes — Baja prioridad ───────────────────────────────── */
  { id: "L4",    label: "Permisos granulares",                      description: "Sistema de permisos por módulo más fino que los roles actuales.",                                 category: "Plataforma",    priority: "baja",  status: "pendiente" },
  { id: "L8",    label: "Portal inquilinos completo",               description: "Flujo completo: contrato digital, pagos, solicitudes de mantenimiento.",                          category: "Portal",        priority: "baja",  status: "pendiente" },
  { id: "L17",   label: "Pagos Stripe/SPEI",                        description: "Integración de pasarela de pagos para cobros desde el portal.",                                   category: "Fintech",       priority: "baja",  status: "pendiente" },
  { id: "P1",    label: "Demo interactivo",                         description: "Versión demo con datos ficticios para prospectos.",                                                category: "Marketing",     priority: "baja",  status: "pendiente" },
  { id: "P2",    label: "Video intro HeyGen",                       description: "Video de onboarding generado con IA para nuevos clientes.",                                       category: "Marketing",     priority: "baja",  status: "pendiente" },
  /* ── Completados ────────────────────────────────────────────────── */
  { id: "F-A",   label: "Login: flujo unificado y fixes de UX",     description: "Rebote eliminado, login unificado, ruteo a /home, flash al cambiar empresa, splash limpio, destello de impersonación y color del botón Entrar corregidos.",          category: "Login/UX",      status: "completado" },
  { id: "F-B",   label: "Performance: queries y rutas optimizadas", description: "Índices aplicados en Supabase. /compras y /cobranza optimizadas. Analytics, mantenimiento y servicios con carga mejorada.",                                          category: "Performance",   status: "completado" },
  { id: "F-DS1", label: "Tokens del sistema de diseño definidos",   description: "Tipografía, espaciado base y paleta de colores de estado (error/éxito/warning/info) documentados como CSS vars globales en el sistema.",                             category: "Design System", status: "completado" },
  { id: "F-DS2", label: "Catálogo de componentes creado",           description: "Página /saproa-admin/design-system con galería completa de componentes reutilizables, sandbox de previsualización y generador de reporte de preferencias de diseño.", category: "Design System", status: "completado" },
];

const PRIORITY_CONFIG = {
  alta:  { label: "Alta prioridad",  color: "var(--metric-value-red)",   bg: "rgba(239,68,68,0.08)",  badgeVariant: "red"   as const },
  media: { label: "Media prioridad", color: "var(--metric-value-amber)", bg: "rgba(245,158,11,0.08)", badgeVariant: "amber" as const },
  baja:  { label: "Baja prioridad",  color: "var(--metric-value-green)", bg: "rgba(34,197,94,0.08)",  badgeVariant: "green" as const },
};

const PRIORITIES: Array<"alta" | "media" | "baja"> = ["alta", "media", "baja"];

export default function SaproaRoadmapPage() {
  const pendingItems   = ROADMAP.filter((i) => i.status === "pendiente");
  const completedItems = ROADMAP.filter((i) => i.status === "completado");

  return (
    <PageContainer>
      <PageHeader
        title="Roadmap"
        subtitle="Pendientes priorizados antes del lanzamiento a producción"
        titleIcon={<FileText size={18} />}
      />

      {/* ── Secciones pendientes por prioridad ─────────────────────── */}
      {PRIORITIES.map((priority) => {
        const config = PRIORITY_CONFIG[priority];
        const items  = pendingItems.filter((i) => i.priority === priority);
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
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  variants={staggerItem}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "12px 14px",
                    background: config.bg,
                    border: `1px solid ${config.color}22`,
                    borderRadius: "var(--border-radius-md)",
                  }}
                >
                  {/* Checkbox vacío */}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          color: config.color,
                          minWidth: 28,
                        }}
                      >
                        {item.id}
                      </span>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.label}
                      </span>
                      <AppBadge variant={config.badgeVariant}>{item.category}</AppBadge>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </SectionCard>
        );
      })}

      {/* ── Sección completados ─────────────────────────────────────── */}
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
                <CheckCircle2
                  size={18}
                  color="var(--metric-value-green)"
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "var(--metric-value-green)",
                        minWidth: 40,
                      }}
                    >
                      {item.id}
                    </span>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        textDecoration: "line-through",
                        textDecorationColor: "var(--metric-value-green)",
                      }}
                    >
                      {item.label}
                    </span>
                    <AppBadge variant="green">{item.category}</AppBadge>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      lineHeight: 1.5,
                    }}
                  >
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
