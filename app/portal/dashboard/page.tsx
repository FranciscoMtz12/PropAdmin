"use client";

import { FileText, Home, KeyRound, Wallet } from "lucide-react";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppGrid from "@/components/AppGrid";
import AppCard from "@/components/AppCard";

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const cardTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#6B7280",
};

const iconBoxStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#EEF2FF",
  color: "#4338CA",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export default function PortalDashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Portal del inquilino"
        titleIcon={<Home size={20} />}
      />

      <AppGrid minWidth={260}>
        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <KeyRound size={18} />
            </div>

            <div>
              <div style={cardTitleStyle}>Mi contrato</div>
              <div style={cardTextStyle}>
                Aquí aparecerán la fecha de inicio, fecha final y el estado general
                de tu contrato.
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <FileText size={18} />
            </div>

            <div>
              <div style={cardTitleStyle}>Mis facturas y adeudos</div>
              <div style={cardTextStyle}>
                Aquí podrás consultar tus facturas, saldo pendiente y movimientos
                relacionados con cobranza.
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={iconBoxStyle}>
              <Wallet size={18} />
            </div>

            <div>
              <div style={cardTitleStyle}>Reportar pago</div>
              <div style={cardTextStyle}>
                Aquí podrás subir tu comprobante y capturar manualmente el monto del
                pago para revisión administrativa.
              </div>
            </div>
          </div>
        </AppCard>
      </AppGrid>

      <div style={{ marginTop: 20 }}>
        <AppCard>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Próximamente
            </div>

            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "#6B7280",
              }}
            >
              Este portal será la base para mostrar contrato, renovación, adeudos,
              facturas y reporte de pagos del inquilino.
            </div>
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
}