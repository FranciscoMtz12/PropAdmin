"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CreditCard,
  Home,
  LayoutDashboard,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import UiButton from "@/components/UiButton";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Cargando dashboard...");

  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setStatus("Error obteniendo la sesión");
          return;
        }

        if (!session) {
          setStatus("No hay sesión, redirigiendo a login...");
          router.push("/login");
          return;
        }

        setEmail(session.user.email || "");
        setStatus("Dashboard cargado correctamente");
      } catch (err) {
        console.error("ERROR DASHBOARD:", err);
        setStatus("Ocurrió un error cargando dashboard");
      }
    }

    loadUser();
  }, [router]);

  const quickLinks = useMemo(
    () => [
      { label: "Edificios", href: "/buildings", icon: Building2, description: "Portafolio y detalle de edificios" },
      { label: "Agenda", href: "/agenda", icon: CalendarDays, description: "Vista consolidada de recordatorios" },
      { label: "Pagos", href: "/payments", icon: CreditCard, description: "Seguimiento de pagos recurrentes" },
      { label: "Mantenimiento", href: "/maintenance", icon: Wrench, description: "Actividad operativa y bitácoras" },
    ],
    []
  );

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        titleIcon={<LayoutDashboard size={20} />}
        subtitle="Vista principal del sistema con accesos rápidos, métricas e iconografía consistente para todo PropAdmin."
        actions={<UiButton href="/buildings">Ir a edificios</UiButton>}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <MetricCard label="Usuario activo" value={email || "Sin email"} icon={<Home size={18} />} helper="Sesión actual" />
        <MetricCard label="Estado del sistema" value={status} icon={<Wrench size={18} />} helper="Conexión base" />
        <MetricCard label="Módulos listos" value="5" icon={<Building2 size={18} />} helper="Base operativa" />
      </div>

      <SectionCard
        title="Accesos rápidos"
        subtitle="Cada módulo usa el mismo lenguaje visual: cards, iconos y acciones limpias."
        icon={<ArrowRight size={18} />}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "16px",
                  padding: "18px",
                  textDecoration: "none",
                  background: "white",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "#EEF2FF",
                      color: "#4338CA",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} />
                  </div>

                  <div>
                    <strong style={{ display: "block", marginBottom: "6px", color: "#111827" }}>{item.label}</strong>
                    <p style={{ margin: 0, color: "#667085", fontSize: "14px" }}>{item.description}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </SectionCard>
    </PageContainer>
  );
}
