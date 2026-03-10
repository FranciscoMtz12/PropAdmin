import { AlertCircle, CheckCircle2, CreditCard, Receipt } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";

export default function PaymentsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Pagos"
        titleIcon={<CreditCard size={20} />}
        subtitle="Base visual del módulo de pagos. Esta página queda preparada para aplicar el mismo patrón a pagos recurrentes, estados y filtros."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <MetricCard label="Pendientes" value="0" icon={<AlertCircle size={18} />} helper="Por pagar" />
        <MetricCard label="Pagados" value="0" icon={<CheckCircle2 size={18} />} helper="Liquidados" />
        <MetricCard label="Vencidos" value="0" icon={<Receipt size={18} />} helper="Revisión" />
      </div>

      <SectionCard
        title="Pagos en preparación"
        subtitle="Aquí se integrarán servicios, vencimientos y estatus con el sistema visual ya definido."
        icon={<CreditCard size={18} />}
      >
        <p style={{ margin: 0, color: "#667085" }}>
          La vista ya está alineada con el nuevo layout global para que el módulo se construya sobre una base consistente.
        </p>
      </SectionCard>
    </PageContainer>
  );
}
