import { BellRing, CalendarDays, Clock3, Wrench } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";

export default function AgendaPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Agenda"
        titleIcon={<CalendarDays size={20} />}
        subtitle="Base visual del módulo de agenda con métricas, cards e iconos consistentes para futuros eventos y recordatorios."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <MetricCard label="Eventos del mes" value="0" icon={<CalendarDays size={18} />} helper="Calendario" />
        <MetricCard label="Mantenimientos próximos" value="0" icon={<Wrench size={18} />} helper="Programados" />
        <MetricCard label="Pagos por revisar" value="0" icon={<Clock3 size={18} />} helper="Pendientes" />
      </div>

      <SectionCard
        title="Agenda en preparación"
        subtitle="Aquí se integrará la vista calendario con filtros por edificio, pagos y mantenimiento."
        icon={<BellRing size={18} />}
      >
        <p style={{ margin: 0, color: "#667085" }}>
          Por ahora esta vista ya usa el mismo layout, espaciado, iconografía y jerarquía visual del resto de la aplicación.
        </p>
      </SectionCard>
    </PageContainer>
  );
}
