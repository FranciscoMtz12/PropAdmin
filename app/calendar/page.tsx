import {
  CalendarDays,
  Clock3,
  CreditCard,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";

export default function CalendarPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Calendario"
        subtitle="Vista general del sistema para organizar limpieza, mantenimiento, pagos y cobranza."
        titleIcon={<CalendarDays size={18} />}
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Vista activa"
          value="Semana"
          helper="Base inicial"
          icon={<CalendarDays size={18} />}
        />
        <MetricCard
          label="Limpieza"
          value="General"
          helper="Todos los edificios"
          icon={<Sparkles size={18} />}
        />
        <MetricCard
          label="Mantenimiento"
          value="Próximamente"
          helper="Semanal"
          icon={<Wrench size={18} />}
        />
        <MetricCard
          label="Pagos"
          value="Próximamente"
          helper="Mensual"
          icon={<CreditCard size={18} />}
        />
        <MetricCard
          label="Cobranza"
          value="Próximamente"
          helper="Mensual"
          icon={<Wallet size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Calendario general"
        subtitle="Primera base visual del calendario global del sistema."
        icon={<CalendarDays size={18} />}
      >
        <AppCard>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <AppBadge backgroundColor="#EEF2FF" textColor="#4338CA">
                Semana
              </AppBadge>

              <AppBadge backgroundColor="#F3F4F6" textColor="#374151">
                Día
              </AppBadge>

              <AppBadge backgroundColor="#F3F4F6" textColor="#374151">
                Mes
              </AppBadge>

              <AppBadge backgroundColor="#F3F4F6" textColor="#374151">
                Año
              </AppBadge>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(170px, 1fr))",
                gap: 16,
                overflowX: "auto",
                paddingBottom: 10,
              }}
            >
              {[
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
                "Domingo",
              ].map((day) => (
                <div
                  key={day}
                  style={{
                    minWidth: 170,
                    border: "1px solid #E5E7EB",
                    borderRadius: 16,
                    padding: 16,
                    background: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    {day}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 12,
                        padding: "12px 12px",
                        background: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                        fontSize: 13,
                        color: "#166534",
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      Limpieza
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        padding: "12px 12px",
                        background: "#FFF7ED",
                        border: "1px solid #FED7AA",
                        fontSize: 13,
                        color: "#9A3412",
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      Mantenimiento
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        padding: "12px 12px",
                        background: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        fontSize: 13,
                        color: "#1D4ED8",
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      Pagos
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        padding: "12px 12px",
                        background: "#FEFCE8",
                        border: "1px solid #FDE68A",
                        fontSize: 13,
                        color: "#A16207",
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      Cobranza
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AppCard>
      </SectionCard>

      <div style={{ height: 16 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#10B981",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Limpieza
            </span>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#F97316",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Mantenimiento
            </span>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#2563EB",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Pagos
            </span>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#EAB308",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Cobranza
            </span>
          </div>
        </AppCard>
      </div>

      <SectionCard
        title="Siguiente fase"
        subtitle="Esta pantalla queda lista para evolucionar hacia un calendario completo tipo Google Calendar."
        icon={<Clock3 size={18} />}
      >
        <AppCard>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 14,
              color: "#4B5563",
              lineHeight: 1.7,
            }}
          >
            <span>• Vista por día, semana, mes y año</span>
            <span>• Filtros por módulo y por edificio</span>
            <span>• Eventos reales de limpieza, mantenimiento, pagos y cobranza</span>
            <span>• Leyenda visual permanente</span>
          </div>
        </AppCard>
      </SectionCard>
    </PageContainer>
  );
}
