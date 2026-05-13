/*
  Generación de PDFs usando @react-pdf/renderer.

  Exporta 3 templates como componentes React + funciones async de descarga:
  1. generateOCPdf         — Orden de Compra
  2. generateOMPdf         — Orden de Materiales
  3. generateReportePdf    — Reporte de Envío a Pagos
*/

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";

/* Fuentes locales — URL absoluta con el origen actual para que
   @react-pdf/renderer pueda fetchearlas en dev y en producción */
const origin = typeof window !== "undefined" ? window.location.origin : "";

Font.register({
  family: "Montserrat",
  fonts: [
    { src: `${origin}/fonts/Montserrat-Regular.ttf`, fontWeight: 400 },
    { src: `${origin}/fonts/Montserrat-Medium.ttf`,  fontWeight: 500 },
    { src: `${origin}/fonts/Montserrat-Bold.ttf`,    fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word: string) => [word]);

/* ━━━ ESTILOS BASE ━━━ */

function createStyles(accent = "#8B2252") {
  return StyleSheet.create({
    page: { fontFamily: "Helvetica", fontSize: 9, color: "#374151", backgroundColor: "white", paddingBottom: 40 },
    accentBar: { height: 5, backgroundColor: accent, width: "100%" },
    pageContent: { paddingHorizontal: 36, paddingTop: 20 },
    /* Header */
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
    logoImg: { height: 28, marginBottom: 4, maxWidth: 120 },
    companyName: { fontSize: 10, fontFamily: "Montserrat", fontWeight: 700, color: "#111827", marginBottom: 2 },
    companyInfo: { fontSize: 7.5, color: "#374151", lineHeight: 1.6, maxWidth: 300 },
    docInfo: { alignItems: "flex-end", minWidth: 130, maxWidth: 150 },
    docTitle: { fontSize: 10, fontFamily: "Montserrat", fontWeight: 700, color: accent, marginBottom: 3 },
    docFolio: { fontSize: 10, fontFamily: "Montserrat", fontWeight: 700, color: "#111827" },
    docDate: { fontSize: 8, color: "#374151", marginBottom: 3 },
    matzImg: { height: 44, marginBottom: 4, maxWidth: 70 },
    /* Separador */
    separator: { height: 0.5, backgroundColor: "#000000", marginVertical: 8 },
    /* Meta row */
    metaRow: { flexDirection: "row", borderWidth: 0.5, borderColor: "#374151", marginVertical: 6 },
    metaCell: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#EDF0F4", borderRightWidth: 0.5, borderRightColor: "#C5D0DB" },
    metaCellLast: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#EDF0F4" },
    metaLabel: { fontSize: 6.5, fontFamily: "Montserrat", color: "#374151", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
    metaValue: { fontSize: 9, fontFamily: "Montserrat", fontWeight: 700, color: "#374151" },
    /* Section title */
    sectionTitle: { fontSize: 8, fontFamily: "Montserrat", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: "#374151", marginTop: 8, marginBottom: 5 },
    /* Tabla */
    tableWrap: { borderWidth: 0.5, borderColor: "#374151", marginVertical: 4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#E8EDF2", borderBottomWidth: 1, borderBottomColor: "#374151" },
    tableHeaderCell: { paddingHorizontal: 6, paddingVertical: 5, fontSize: 7, fontFamily: "Montserrat", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#374151" },
    tableRowLast: { flexDirection: "row" },
    tableCell: { paddingHorizontal: 6, paddingVertical: 6, fontSize: 8.5, color: "#374151", justifyContent: "center" },
    tableCellMono: { paddingHorizontal: 6, paddingVertical: 6, fontSize: 7.5, color: "#374151", fontFamily: "Courier", justifyContent: "center" },
    /* Footer tabla */
    tableFooter: { flexDirection: "row", backgroundColor: "#DDE3EA", borderTopWidth: 1, borderTopColor: "#374151" },
    tableFooterCell: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRightWidth: 0.5, borderRightColor: "#374151" },
    tableFooterCellLast: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
    tableFooterLabel: { fontSize: 6.5, fontFamily: "Montserrat", color: "#374151", textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.5 },
    tableFooterValue: { fontSize: 8, fontFamily: "Montserrat", fontWeight: 700, color: "#374151" },
    tableFooterSub: { fontSize: 7.5, color: "#374151", marginTop: 1 },
    /* Recipient */
    recipient: { marginVertical: 8, paddingBottom: 8 },
    recipientTag: { fontSize: 7, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
    recipientName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 3 },
    recipientCols: { flexDirection: "row", gap: 20 },
    recipientColLabel: { fontSize: 6.5, color: "#374151", textTransform: "uppercase", marginBottom: 2 },
    recipientColValue: { fontSize: 8, color: "#374151" },
    /* Firmas */
    atentamente: { fontFamily: "Montserrat", textAlign: "center", fontSize: 7, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20, marginBottom: 4 },
    signaturesRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 28, paddingHorizontal: 40 },
    sigBox: { flex: 1, alignItems: "center", marginHorizontal: 10 },
    sigName: { fontSize: 9, fontFamily: "Montserrat", fontWeight: 700, color: "#374151", marginBottom: 10, textAlign: "center", flexWrap: "wrap" },
    sigLine: { height: 0.5, backgroundColor: "#374151", width: "100%", marginBottom: 5 },
    sigLabel: { fontSize: 7, fontFamily: "Montserrat", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },
    /* Footer página */
    pageFooter: { marginTop: 16, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#374151", fontSize: 7.5, color: "#374151" },
    /* Info section (sin bordes, recibo) */
    infoSection: { flexDirection: "row", marginVertical: 8 },
    infoColLeft: { flex: 1 },
    infoColRight: { minWidth: 130, alignItems: "flex-end" as const },
    infoLabel: { fontSize: 6.5, fontFamily: "Montserrat", color: "#6B7280", textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 2 },
    infoValue: { fontSize: 9, fontFamily: "Montserrat", fontWeight: 700, color: "#111827" },
  });
}

/* ━━━ INTERFACES ━━━ */

export interface OCTemplateData {
  folio: string;
  date: string;
  legalName: string;
  address: string;
  zipCode: string;
  rfc: string;
  supplierName: string;
  supplierBranch?: string;
  cfdiUse?: string;
  clientNumber?: string;
  items: { quantity: number; unit: string; description: string; unitPrice?: number }[];
  companyPhone?: string;
  purchasesContactPhone?: string;
  purchasesContactEmail?: string;
  projectDescription?: string;
  responsibleName?: string;
  responsiblePhone?: string;
  signerName?: string;
  totalEstimated?: number;
  accentColor?: string;
  logoUrl?: string;
  logoMatzUrl?: string;
}

export interface OMTemplateData {
  folio: string;
  date: string;
  legalName: string;
  address: string;
  rfc: string;
  buildingName: string;
  ticketNumber: string;
  buildingAddress?: string;
  category?: string;
  unitNumber?: string;
  priority?: string;
  problemDescription?: string;
  materials: { index: number; description: string; quantity: number; unit: string }[];
  accentColor?: string;
  logoUrl?: string;
}

export interface ReporteTemplateData {
  folio: string;
  weekNumber: number;
  year: number;
  elaboratedBy: string;
  companyName: string;
  reportDate: string;
  items: { folio: string; sentAt?: string; invoiceDate?: string; invoiceNumber?: string; project: string }[];
  accentColor?: string;
  logoUrl?: string;
}

/* ━━━ HELPER: descargar PDF ━━━ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function savePdf(element: React.ReactElement<any>, filename: string) {
  try {
    const blob = await pdf(element).toBlob();
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF generation error:", err);
    throw err;
  }
}

/* ━━━ COMPONENTE: ORDEN DE COMPRA ━━━ */

function OCDocument({ data }: { data: OCTemplateData }) {
  const S = createStyles(data.accentColor);
  const hasPrices = data.items.some((i) => (i.unitPrice || 0) > 0);
  const totalEstimated = data.totalEstimated ?? data.items.reduce(
    (sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0
  );

  return (
    <Document>
      <Page size="A4" style={S.page}>

        <View style={S.pageContent}>

          {/* Header — izq maxWidth 320, der minWidth 130 */}
          <View style={S.header}>
            <View style={{ maxWidth: 320 }}>
              {data.logoUrl
                ? <Image src={data.logoUrl} style={S.logoImg} />
                : <Text style={[S.companyName, { color: data.accentColor || "#8B2252" }]}>FRA-MAR</Text>}
              <Text style={S.companyName}>{data.legalName}</Text>
              <Text style={S.companyInfo}>{data.address}</Text>
              <Text style={S.companyInfo}>
                C.P. {data.zipCode} · RFC: {data.rfc}{data.companyPhone ? ` · Tel: ${data.companyPhone}` : ""}
              </Text>
            </View>
            <View style={S.docInfo}>
              {data.logoMatzUrl
                ? <Image src={data.logoMatzUrl} style={S.matzImg} />
                : <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1e2a3a" }}>MATZ</Text>}
              <Text style={S.docDate}>{data.date}</Text>
              <Text style={S.docFolio}>Folio: {data.folio}</Text>
            </View>
          </View>

          {/* Contacto compras (antes del destinatario) */}
          {(data.purchasesContactPhone || data.purchasesContactEmail) ? (
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 6 }}>
              {data.purchasesContactPhone ? (
                <Text style={{ fontSize: 8, color: "#374151" }}>
                  Contacto compras: {data.purchasesContactPhone}
                </Text>
              ) : null}
              {data.purchasesContactEmail ? (
                <Text style={{ fontSize: 8, color: "#374151" }}>
                  {data.purchasesContactEmail}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Destinatario */}
          <View style={S.recipient}>
            <Text style={S.recipientTag}>A quien corresponda</Text>
            <Text style={S.recipientName}>
              {data.supplierName.toUpperCase()}
              {data.supplierBranch ? ` - ${data.supplierBranch.toUpperCase()}` : ""}
            </Text>
            <View style={{ marginTop: 4 }}>
              {data.cfdiUse ? (
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Uso de CFDI:
                  </Text>
                  <Text style={{ fontSize: 8, color: "#1F2937" }}>
                    {data.cfdiUse}
                  </Text>
                </View>
              ) : null}
              {data.clientNumber ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={{ fontSize: 8, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Número de cliente:
                  </Text>
                  <Text style={{ fontSize: 8, color: "#1F2937" }}>
                    {data.clientNumber}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={S.sectionTitle}>Orden de Compra</Text>

          {/* Tabla items — columnas P. Unit. y Total solo si hay precios */}
          <View style={S.tableWrap}>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: 45, textAlign: "center" }]}>Cant.</Text>
              <Text style={[S.tableHeaderCell, { width: 65, textAlign: "center" }]}>Unidad</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>Descripción</Text>
              {hasPrices ? (
                <Text style={[S.tableHeaderCell, { width: 70, textAlign: "right" }]}>P. Unit.</Text>
              ) : null}
              {hasPrices ? (
                <Text style={[S.tableHeaderCell, { width: 80, textAlign: "right" }]}>Total</Text>
              ) : null}
            </View>
            {data.items.map((item, i) => {
              const isLast = i === data.items.length - 1
                && !data.projectDescription && !data.responsibleName && (!hasPrices || totalEstimated <= 0);
              const rowTotal = (item.unitPrice || 0) * item.quantity;
              return (
                <View key={i} style={isLast ? S.tableRowLast : S.tableRow}>
                  <Text style={[S.tableCell, { width: 45, textAlign: "center" }]}>{item.quantity}</Text>
                  <Text style={[S.tableCell, { width: 65, textAlign: "center" }]}>{item.unit}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{item.description}</Text>
                  {hasPrices ? (
                    <Text style={[S.tableCell, { width: 70, textAlign: "right" }]}>
                      {item.unitPrice ? `$${item.unitPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                    </Text>
                  ) : null}
                  {hasPrices ? (
                    <Text style={[S.tableCell, { width: 80, textAlign: "right" }]}>
                      {item.unitPrice ? `$${rowTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {hasPrices && totalEstimated > 0 ? (
              <View style={{ flexDirection: "row", backgroundColor: "#E8EDF2", borderTopWidth: 1, borderTopColor: "#374151" }}>
                <Text style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 8, fontFamily: "Montserrat", fontWeight: 700, textAlign: "right", color: "#1F2937" }}>
                  Total neto:
                </Text>
                <Text style={{ width: 80, paddingHorizontal: 8, paddingVertical: 6, fontSize: 9, fontFamily: "Montserrat", fontWeight: 700, textAlign: "right", color: "#1F2937" }}>
                  ${totalEstimated.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ) : null}
            {(data.projectDescription || data.responsibleName) ? (
              <View style={S.tableFooter}>
                <View style={S.tableFooterCell}>
                  <Text style={S.tableFooterLabel}>Proyecto</Text>
                  <Text style={S.tableFooterValue}>{data.projectDescription || "—"}</Text>
                </View>
                <View style={S.tableFooterCellLast}>
                  <Text style={S.tableFooterLabel}>Pasa por material</Text>
                  <Text style={S.tableFooterValue}>{data.responsibleName || "—"}</Text>
                  {data.responsiblePhone ? (
                    <Text style={S.tableFooterSub}>CEL.: {data.responsiblePhone}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* Firma — línea arriba, nombre abajo */}
          <Text style={S.atentamente}>Atentamente</Text>
          <View style={{ alignItems: "center", marginTop: 28, paddingHorizontal: 80 }}>
            <View style={S.sigLine} />
            {data.signerName ? (
              <Text style={[S.sigName, { marginTop: 6, marginBottom: 0 }]}>
                {data.signerName}
              </Text>
            ) : null}
          </View>

        </View>
      </Page>
    </Document>
  );
}

/* ━━━ COMPONENTE: ORDEN DE MATERIALES ━━━ */

function OMDocument({ data }: { data: OMTemplateData }) {
  const S = createStyles(data.accentColor);

  const metaPairs = [
    [{ label: "Edificio", value: data.buildingName }, { label: "Ticket #", value: data.ticketNumber }],
    [{ label: "Dirección", value: data.buildingAddress || "—" }, { label: "Categoría", value: data.category || "—" }],
    [{ label: "Departamento", value: data.unitNumber || "—" }, { label: "Prioridad", value: data.priority || "—" }],
  ];

  return (
    <Document>
      <Page size="A4" style={S.page}>

        <View style={S.pageContent}>

          {/* Header */}
          <View style={S.header}>
            <View>
              {data.logoUrl
                ? <Image src={data.logoUrl} style={S.logoImg} />
                : <Text style={[S.companyName, { color: data.accentColor || "#8B2252" }]}>FRA-MAR</Text>}
              <Text style={S.companyName}>{data.legalName}</Text>
              <Text style={S.companyInfo}>{data.address}</Text>
              <Text style={S.companyInfo}>RFC: {data.rfc}</Text>
            </View>
            <View style={S.docInfo}>
              <Text style={S.docTitle}>Orden de Materiales</Text>
              <Text style={S.docFolio}>Folio: {data.folio}</Text>
              <Text style={S.docDate}>{data.date}</Text>
            </View>
          </View>

          <View style={S.separator} />

          {/* Meta rows en pares */}
          {metaPairs.map((pair, i) => (
            <View key={i} style={S.metaRow}>
              {pair.map((cell, j) => (
                <View key={j} style={j === pair.length - 1 ? S.metaCellLast : S.metaCell}>
                  <Text style={S.metaLabel}>{cell.label}</Text>
                  <Text style={S.metaValue}>{cell.value}</Text>
                </View>
              ))}
            </View>
          ))}
          {data.problemDescription ? (
            <View style={S.metaRow}>
              <View style={S.metaCellLast}>
                <Text style={S.metaLabel}>Descripción del problema</Text>
                <Text style={S.metaValue}>{data.problemDescription}</Text>
              </View>
            </View>
          ) : null}

          <Text style={S.sectionTitle}>Materiales requeridos</Text>

          {/* Tabla materiales */}
          <View style={S.tableWrap}>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: 28, textAlign: "center" }]}>#</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>Material</Text>
              <Text style={[S.tableHeaderCell, { width: 65, textAlign: "center" }]}>Cantidad</Text>
              <Text style={[S.tableHeaderCell, { width: 65, textAlign: "center" }]}>Unidad</Text>
            </View>
            {data.materials.map((m, i) => (
              <View key={i} style={i === data.materials.length - 1 ? S.tableRowLast : S.tableRow}>
                <Text style={[S.tableCell, { width: 28, textAlign: "center" }]}>{m.index}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{m.description}</Text>
                <Text style={[S.tableCell, { width: 65, textAlign: "center" }]}>{m.quantity}</Text>
                <Text style={[S.tableCell, { width: 65, textAlign: "center" }]}>{m.unit}</Text>
              </View>
            ))}
          </View>

          <View style={S.pageFooter}>
            <Text>{data.legalName} · RFC: {data.rfc}</Text>
          </View>

        </View>
      </Page>
    </Document>
  );
}

/* ━━━ COMPONENTE: REPORTE DE ENVÍO A PAGOS ━━━ */

function ReporteDocument({ data }: { data: ReporteTemplateData }) {
  const S = createStyles(data.accentColor);

  return (
    <Document>
      <Page size="A4" style={S.page}>

        <View style={S.pageContent}>

          {/* Header */}
          <View style={S.header}>
            <View>
              {data.logoUrl
                ? <Image src={data.logoUrl} style={S.logoImg} />
                : <Text style={[S.companyName, { color: data.accentColor || "#8B2252" }]}>FRA-MAR</Text>}
              <Text style={S.companyInfo}>RFC: IDF240229770 · San Pedro Garza García, N.L.</Text>
            </View>
            <View style={S.docInfo}>
              <Text style={S.docTitle}>Reporte de Envío a Pagos</Text>
              <Text style={S.docDate}>Semana {data.weekNumber} · {data.year}</Text>
              <Text style={S.docFolio}>{data.folio}</Text>
            </View>
          </View>

          <View style={S.separator} />

          {/* Meta row */}
          <View style={S.metaRow}>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>Elaboró</Text>
              <Text style={S.metaValue}>{data.elaboratedBy}</Text>
            </View>
            <View style={S.metaCell}>
              <Text style={S.metaLabel}>Empresa</Text>
              <Text style={S.metaValue}>{data.companyName}</Text>
            </View>
            <View style={S.metaCellLast}>
              <Text style={S.metaLabel}>Fecha</Text>
              <Text style={S.metaValue}>{data.reportDate}</Text>
            </View>
          </View>

          <Text style={S.sectionTitle}>Órdenes de compra incluidas</Text>

          {/* Tabla OCs — 6 columnas */}
          <View style={S.tableWrap}>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: 65, textAlign: "center" }]}>Fecha OC</Text>
              <Text style={[S.tableHeaderCell, { width: 95 }]}>Folio OC</Text>
              <Text style={[S.tableHeaderCell, { width: 65, textAlign: "center" }]}>Fecha factura</Text>
              <Text style={[S.tableHeaderCell, { width: 65, textAlign: "center" }]}>No. factura</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>Proyecto</Text>
              <Text style={[S.tableHeaderCell, { width: 75, textAlign: "center" }]}>Firma de recibido</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={i === data.items.length - 1 ? S.tableRowLast : S.tableRow}>
                <Text style={[S.tableCell, { width: 65, textAlign: "center" }]}>{item.sentAt || "—"}</Text>
                <Text style={[S.tableCell, { width: 95 }]}>{item.folio}</Text>
                <Text style={[S.tableCell, { width: 65, textAlign: "center" }]}>{item.invoiceDate || ""}</Text>
                <Text style={[S.tableCell, { width: 65, textAlign: "center" }]}>{item.invoiceNumber || ""}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{item.project}</Text>
                <View style={[S.tableCell, { width: 75, justifyContent: "flex-end", paddingBottom: 8 }]}>
                  <View style={{ height: 0.5, backgroundColor: "#9CA3AF", width: "80%", alignSelf: "center" }} />
                </View>
              </View>
            ))}
          </View>

          {/* Firmas */}
          <View style={S.signaturesRow}>
            <View style={S.sigBox}>
              <Text style={S.sigName}>{data.elaboratedBy}</Text>
              <View style={S.sigLine} />
              <Text style={S.sigLabel}>Elaboró</Text>
            </View>
            <View style={S.sigBox}>
              <View style={{ height: 20 }} />
              <View style={S.sigLine} />
              <Text style={S.sigLabel}>Recibió en área de pagos</Text>
            </View>
          </View>

        </View>
      </Page>
    </Document>
  );
}

/* ━━━ INTERFACES — nuevos templates ━━━ */

export interface ReciboServicioTemplateData {
  legalName: string;
  address: string;
  rfc: string;
  logoUrl?: string;
  logoMatzUrl?: string;
  accentColor?: string;
  serviceName: string;
  providerName: string;
  period: string;
  buildingName: string;
  unitNumber: string;
  tenantName: string;
  responsibleName?: string;
  consumption?: number;
  consumptionUnit?: string;
  ratePerUnit?: number;
  subtotal: number;
  serviceChargePct: number;
  serviceChargeAmount: number;
  total: number;
  folio: string;
}

export interface ReporteDistribucionTemplateData {
  legalName: string;
  address: string;
  rfc: string;
  logoUrl?: string;
  logoMatzUrl?: string;
  accentColor?: string;
  serviceName: string;
  providerName: string;
  meterNumber?: string;
  period: string;
  buildingName: string;
  invoiceTotal: number;
  ratePerUnit?: number;
  consumptionUnit?: string;
  invoiceFolio?: string;
  rows: {
    unitNumber: string;
    tenantName: string;
    consumption?: number;
    percentage?: number;
    subtotal: number;
    serviceChargeAmount: number;
    total: number;
    type: "tenant" | "common" | "company";
  }[];
  folio: string;
}

/* ━━━ COMPONENTE: RECIBO INDIVIDUAL DE SERVICIO ━━━ */

function ReciboServicioDocument({ data }: { data: ReciboServicioTemplateData }) {
  const S = createStyles(data.accentColor);
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

  const detailText =
    data.consumption != null && data.ratePerUnit != null
      ? `${data.consumption} ${data.consumptionUnit ?? ""} × ${fmt(data.ratePerUnit)}/${data.consumptionUnit ?? "u"}`
      : "Monto del período";

  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${today.getFullYear()}`;

  const showResponsible =
    data.responsibleName != null && data.responsibleName !== data.tenantName;

  const matzSrc = data.logoMatzUrl ?? data.logoUrl;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        <View style={S.pageContent}>

          {/* Header */}
          <View style={S.header}>
            <View style={{ maxWidth: 320 }}>
              {data.logoUrl
                ? <Image src={data.logoUrl} style={S.logoImg} />
                : <Text style={[S.companyName, { color: data.accentColor || "#8B2252" }]}>{data.legalName}</Text>}
              <Text style={S.companyInfo}>{data.address}</Text>
              <Text style={S.companyInfo}>RFC: {data.rfc}</Text>
            </View>
            <View style={S.docInfo}>
              {matzSrc && <Image src={matzSrc} style={S.matzImg} />}
              <Text style={S.docTitle}>Recibo de Servicio</Text>
              <Text style={S.docFolio}>Folio: {data.folio}</Text>
              <Text style={S.docDate}>{todayStr}</Text>
            </View>
          </View>

          <View style={S.separator} />

          {/* Info section — dos columnas, sin bordes */}
          <View style={S.infoSection}>
            <View style={S.infoColLeft}>
              <Text style={S.infoLabel}>Edificio</Text>
              <Text style={S.infoValue}>{data.buildingName}</Text>
              <View style={{ height: 8 }} />
              <Text style={S.infoLabel}>Departamento</Text>
              <Text style={S.infoValue}>Depa {data.unitNumber}</Text>
              <View style={{ height: 8 }} />
              <Text style={S.infoLabel}>Inquilino</Text>
              <Text style={S.infoValue}>{data.tenantName}</Text>
              {showResponsible && (
                <>
                  <View style={{ height: 8 }} />
                  <Text style={S.infoLabel}>Responsable de pago</Text>
                  <Text style={S.infoValue}>{data.responsibleName}</Text>
                </>
              )}
            </View>
            <View style={S.infoColRight}>
              <Text style={S.infoLabel}>Período</Text>
              <Text style={[S.infoValue, { fontSize: 13 }]}>{data.period}</Text>
            </View>
          </View>

          <View style={S.separator} />

          <Text style={S.sectionTitle}>Detalle del cobro</Text>

          {/* Tabla */}
          <View style={S.tableWrap}>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { flex: 2 }]}>Concepto</Text>
              <Text style={[S.tableHeaderCell, { flex: 3 }]}>Detalle</Text>
              <Text style={[S.tableHeaderCell, { width: 90, textAlign: "right" }]}>Importe</Text>
            </View>

            {/* Fila servicio principal — cargo por servicio embebido bajo el importe */}
            <View style={S.tableRowLast}>
              <Text style={[S.tableCell, { flex: 2 }]}>
                {data.serviceName}{data.providerName ? ` · ${data.providerName}` : ""}
              </Text>
              <Text style={[S.tableCell, { flex: 3 }]}>{detailText}</Text>
              <View style={[S.tableCell, { width: 90, alignItems: "flex-end" }]}>
                <Text style={{ fontSize: 8.5, color: "#374151", textAlign: "right" }}>{fmt(data.subtotal)}</Text>
                <Text style={{ fontSize: 7, color: "#6B7280", textAlign: "right", marginTop: 2 }}>
                  {"Cargo por servicio  "}{fmt(data.serviceChargeAmount)}
                </Text>
              </View>
            </View>

            {/* Footer — total */}
            <View style={[S.tableFooter, { justifyContent: "flex-end" }]}>
              <View style={[S.tableFooterCellLast, { alignItems: "flex-end" }]}>
                <Text style={S.tableFooterLabel}>Total a pagar</Text>
                <Text style={[S.tableFooterValue, { fontSize: 12 }]}>{fmt(data.total)}</Text>
              </View>
            </View>
          </View>

          <View style={[S.pageFooter, { marginTop: 24 }]}>
            <Text>{data.legalName} · RFC: {data.rfc}</Text>
          </View>

        </View>
      </Page>
    </Document>
  );
}

/* ━━━ COMPONENTE: REPORTE DE DISTRIBUCIÓN ━━━ */

function ReporteDistribucionDocument({ data }: { data: ReporteDistribucionTemplateData }) {
  const S = createStyles(data.accentColor);
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

  const tenantRows     = data.rows.filter(r => r.type === "tenant");
  const companyRows    = data.rows.filter(r => r.type !== "tenant");
  const subtotalTenant = tenantRows.reduce((s, r) => s + r.subtotal, 0);
  const totalSvcCharge = tenantRows.reduce((s, r) => s + r.serviceChargeAmount, 0);
  const totalCompany   = companyRows.reduce((s, r) => s + r.subtotal, 0);

  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${today.getFullYear()}`;

  const matzSrcRpt = data.logoMatzUrl ?? data.logoUrl;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        <View style={S.pageContent}>

          {/* Header */}
          <View style={S.header}>
            <View style={{ maxWidth: 320 }}>
              {data.logoUrl
                ? <Image src={data.logoUrl} style={S.logoImg} />
                : <Text style={[S.companyName, { color: data.accentColor || "#8B2252" }]}>{data.legalName}</Text>}
              <Text style={S.companyInfo}>{data.address}</Text>
              <Text style={S.companyInfo}>RFC: {data.rfc}</Text>
            </View>
            <View style={S.docInfo}>
              {matzSrcRpt && <Image src={matzSrcRpt} style={S.matzImg} />}
              <Text style={S.docTitle}>Reporte de Distribución</Text>
              <Text style={S.docFolio}>Folio: {data.folio}</Text>
              <Text style={S.docDate}>{todayStr}</Text>
            </View>
          </View>

          <View style={S.separator} />

          {/* Info section — dos columnas, sin bordes */}
          <View style={S.infoSection}>
            <View style={S.infoColLeft}>
              <Text style={S.infoLabel}>Edificio</Text>
              <Text style={S.infoValue}>{data.buildingName}</Text>
              <View style={{ height: 8 }} />
              <Text style={S.infoLabel}>Proveedor</Text>
              <Text style={S.infoValue}>{data.providerName}</Text>
              <View style={{ height: 8 }} />
              <Text style={S.infoLabel}>N° Medidor</Text>
              <Text style={S.infoValue}>{data.meterNumber || "—"}</Text>
              <View style={{ height: 8 }} />
              <Text style={S.infoLabel}>Folio Factura</Text>
              <Text style={S.infoValue}>{data.invoiceFolio || "—"}</Text>
            </View>
            <View style={S.infoColRight}>
              <Text style={S.infoLabel}>Período</Text>
              <Text style={[S.infoValue, { fontSize: 13 }]}>{data.period}</Text>
              <View style={{ height: 8 }} />
              <Text style={S.infoLabel}>Total Factura</Text>
              <Text style={S.infoValue}>{fmt(data.invoiceTotal)}</Text>
            </View>
          </View>

          <View style={S.separator} />

          <Text style={S.sectionTitle}>Distribución por unidad</Text>

          {/* Tabla */}
          <View style={S.tableWrap}>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: 55 }]}>Unidad</Text>
              <Text style={[S.tableHeaderCell, { flex: 2 }]}>Inquilino</Text>
              {data.rows.some(r => r.consumption != null) ? (
                <Text style={[S.tableHeaderCell, { width: 55, textAlign: "right" }]}>Consumo</Text>
              ) : null}
              {data.rows.some(r => r.percentage != null) ? (
                <Text style={[S.tableHeaderCell, { width: 38, textAlign: "right" }]}>%</Text>
              ) : null}
              <Text style={[S.tableHeaderCell, { width: 68, textAlign: "right" }]}>Subtotal</Text>
              <Text style={[S.tableHeaderCell, { width: 62, textAlign: "right" }]}>Cargo s.</Text>
              <Text style={[S.tableHeaderCell, { width: 68, textAlign: "right" }]}>Total</Text>
            </View>

            {data.rows.map((row, i) => {
              const isLast      = i === data.rows.length - 1;
              const isCompany   = row.type !== "tenant";
              const rowStyle    = isLast ? S.tableRowLast : S.tableRow;
              const cellBg      = isCompany ? { backgroundColor: "#F3F4F6" } : {};
              const showConsCol = data.rows.some(r => r.consumption != null);
              const showPctCol  = data.rows.some(r => r.percentage != null);
              return (
                <View key={i} style={[rowStyle, cellBg]}>
                  <Text style={[S.tableCell, { width: 55 }]}>{row.unitNumber}</Text>
                  <Text style={[S.tableCell, { flex: 2 }]}>{row.tenantName}</Text>
                  {showConsCol ? (
                    <Text style={[S.tableCell, { width: 55, textAlign: "right" }]}>
                      {row.consumption != null
                        ? `${row.consumption}${data.consumptionUnit ? " " + data.consumptionUnit : ""}`
                        : "—"}
                    </Text>
                  ) : null}
                  {showPctCol ? (
                    <Text style={[S.tableCell, { width: 38, textAlign: "right" }]}>
                      {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}
                    </Text>
                  ) : null}
                  <Text style={[S.tableCell, { width: 68, textAlign: "right" }]}>{fmt(row.subtotal)}</Text>
                  <Text style={[S.tableCell, { width: 62, textAlign: "right" }]}>
                    {isCompany ? "—" : fmt(row.serviceChargeAmount)}
                  </Text>
                  <Text style={[S.tableCell, { width: 68, textAlign: "right" }]}>{fmt(row.total)}</Text>
                </View>
              );
            })}

            {/* Footer */}
            <View style={S.tableFooter}>
              <View style={S.tableFooterCell}>
                <Text style={S.tableFooterLabel}>Subtotal inquilinos</Text>
                <Text style={S.tableFooterValue}>{fmt(subtotalTenant)}</Text>
              </View>
              <View style={S.tableFooterCell}>
                <Text style={S.tableFooterLabel}>Cargo por servicio (2%)</Text>
                <Text style={S.tableFooterValue}>{fmt(totalSvcCharge)}</Text>
              </View>
              <View style={S.tableFooterCell}>
                <Text style={S.tableFooterLabel}>Gasto empresa</Text>
                <Text style={S.tableFooterValue}>{fmt(totalCompany)}</Text>
              </View>
              <View style={S.tableFooterCellLast}>
                <Text style={S.tableFooterLabel}>Total factura</Text>
                <Text style={S.tableFooterValue}>{fmt(data.invoiceTotal)}</Text>
              </View>
            </View>
          </View>

          <View style={[S.pageFooter, { marginTop: 24 }]}>
            <Text>{data.legalName} · RFC: {data.rfc}</Text>
          </View>

        </View>
      </Page>
    </Document>
  );
}

/* ━━━ EXPORTS — funciones async de descarga ━━━ */

export async function generateOCPdf(data: OCTemplateData): Promise<void> {
  await savePdf(<OCDocument data={data} />, `${data.folio}.pdf`);
}

export async function generateOMPdf(data: OMTemplateData): Promise<void> {
  await savePdf(<OMDocument data={data} />, `${data.folio}.pdf`);
}

export async function generateReportePdf(data: ReporteTemplateData): Promise<void> {
  await savePdf(<ReporteDocument data={data} />, `${data.folio}.pdf`);
}

export async function generateReciboServicioPdf(data: ReciboServicioTemplateData): Promise<void> {
  await savePdf(<ReciboServicioDocument data={data} />, `${data.folio}.pdf`);
}

export async function generateReporteDistribucionPdf(data: ReporteDistribucionTemplateData): Promise<void> {
  await savePdf(<ReporteDistribucionDocument data={data} />, `${data.folio}.pdf`);
}

export async function getReciboServicioPdfBlob(data: ReciboServicioTemplateData): Promise<Blob> {
  return await pdf(<ReciboServicioDocument data={data} />).toBlob();
}

export async function getReporteDistribucionPdfBlob(data: ReporteDistribucionTemplateData): Promise<Blob> {
  return await pdf(<ReporteDistribucionDocument data={data} />).toBlob();
}
