"use client";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";
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
  priority: "alta" | "media" | "baja";
};

const ROADMAP: RoadmapItem[] = [
  /* Alta prioridad */
  { id: "S1",  label: "Enmascaramiento de datos sensibles",     description: "RFC, teléfonos y correos no deben mostrarse en claro a usuarios sin permiso.", category: "Seguridad",   priority: "alta" },
  { id: "S2",  label: "Auditar endpoints API sin autenticación", description: "Verificar que ninguna ruta /api/* sea accesible sin sesión válida.",             category: "Seguridad",   priority: "alta" },
  { id: "S6",  label: "Aviso de privacidad en registro",         description: "Mostrar y requerir aceptación del aviso de privacidad al crear cuenta.",         category: "Legal",       priority: "alta" },
  { id: "S7",  label: "Términos y condiciones",                  description: "Mostrar T&C al registrarse y al primer login.",                                  category: "Legal",       priority: "alta" },
  { id: "A4",  label: "Onboarding por propiedad sin unidades",   description: "Guía de configuración inicial para propiedades que aún no tienen unidades.",     category: "UX",          priority: "alta" },
  /* Media prioridad */
  { id: "M2",  label: "Analytics con tabs por módulo",           description: "Dividir analytics en pestañas: cobranza, mantenimiento, compras, servicios.",   category: "Analytics",   priority: "media" },
  { id: "M9",  label: "Migrar Storage a privados",               description: "Los buckets actuales son públicos; migrar a signed URLs con expiración.",        category: "Seguridad",   priority: "media" },
  { id: "M15", label: "Analytics Grupo MATZ",                    description: "Vista de analytics consolidada para el superadmin del grupo.",                   category: "Analytics",   priority: "media" },
  { id: "M16", label: "Seed de datos de prueba",                 description: "Script de seed reproducible para QA y demos.",                                   category: "Developer",   priority: "media" },
  { id: "M11", label: "Vista ejecutiva mobile",                  description: "Dashboard simplificado para directivos en dispositivos móviles.",                 category: "Mobile",      priority: "media" },
  /* Baja prioridad */
  { id: "L4",  label: "Permisos granulares",                     description: "Sistema de permisos por módulo más fino que los roles actuales.",                category: "Plataforma",  priority: "baja" },
  { id: "L8",  label: "Portal inquilinos completo",              description: "Flujo completo: contrato digital, pagos, solicitudes de mantenimiento.",         category: "Portal",      priority: "baja" },
  { id: "L17", label: "Pagos Stripe/SPEI",                       description: "Integración de pasarela de pagos para cobros desde el portal.",                  category: "Fintech",     priority: "baja" },
  { id: "P1",  label: "Demo interactivo",                        description: "Versión demo con datos ficticios para prospectos.",                              category: "Marketing",   priority: "baja" },
  { id: "P2",  label: "Video intro HeyGen",                      description: "Video de onboarding generado con IA para nuevos clientes.",                     category: "Marketing",   priority: "baja" },
];

const PRIORITY_CONFIG = {
  alta:  { label: "Alta prioridad",  color: "#EF4444", bg: "rgba(239,68,68,0.08)",  badgeVariant: "red"   as const },
  media: { label: "Media prioridad", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", badgeVariant: "amber" as const },
  baja:  { label: "Baja prioridad",  color: "#22C55E", bg: "rgba(34,197,94,0.08)",  badgeVariant: "green" as const },
};

const PRIORITIES: Array<"alta" | "media" | "baja"> = ["alta", "media", "baja"];

export default function SaproaRoadmapPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Roadmap"
        subtitle="Pendientes priorizados antes del lanzamiento a producción"
        titleIcon={<FileText size={18} />}
      />

      {PRIORITIES.map(priority => {
        const config = PRIORITY_CONFIG[priority];
        const items = ROADMAP.filter(i => i.priority === priority);
        return (
          <SectionCard
            key={priority}
            title={config.label}
            icon={<span style={{ width: 10, height: 10, borderRadius: "50%", background: config.color, display: "inline-block" }} />}
            style={{ marginBottom: 16 }}
          >
            <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(item => (
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
                  {/* Checkbox (visual only) */}
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

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: config.color, minWidth: 28 }}>{item.id}</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</span>
                      <AppBadge variant={config.badgeVariant}>{item.category}</AppBadge>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </SectionCard>
        );
      })}
    </PageContainer>
  );
}
