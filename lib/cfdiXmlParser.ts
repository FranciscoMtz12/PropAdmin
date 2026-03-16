export type ParsedCfdiData = {
  uuid: string;
  series: string;
  folio: string;
  issuedAt: string;
  subtotal: string;
  tax: string;
  total: string;
  customerName: string;
  customerTaxId: string;
  invoiceType: "income" | "egress" | "payment";
  description: string;
};

function getAttr(element: Element | null, names: string[]) {
  if (!element) return "";

  for (const name of names) {
    const value = element.getAttribute(name);
    if (value) return value;
  }

  return "";
}

function findFirstByLocalName(doc: Document, localName: string) {
  const all = Array.from(doc.getElementsByTagName("*"));
  return (
    all.find(
      (node) =>
        node.localName?.toLowerCase() === localName.toLowerCase() ||
        node.nodeName?.toLowerCase().endsWith(`:${localName.toLowerCase()}`)
    ) || null
  );
}

function findAllByLocalName(doc: Document, localName: string) {
  const all = Array.from(doc.getElementsByTagName("*"));
  return all.filter(
    (node) =>
      node.localName?.toLowerCase() === localName.toLowerCase() ||
      node.nodeName?.toLowerCase().endsWith(`:${localName.toLowerCase()}`)
  );
}

function formatIssuedAtToDateInput(value: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function normalizeInvoiceType(tipoDeComprobante: string): "income" | "egress" | "payment" {
  const normalized = String(tipoDeComprobante || "").trim().toUpperCase();

  if (normalized === "E") return "egress";
  if (normalized === "P") return "payment";

  return "income";
}

function sumTrasladosImporte(doc: Document) {
  const traslados = findAllByLocalName(doc, "Traslado");

  const total = traslados.reduce((acc, traslado) => {
    const importe = Number(getAttr(traslado, ["Importe", "importe"]) || 0);
    return acc + importe;
  }, 0);

  return total > 0 ? total.toFixed(2) : "";
}

function extractDescription(doc: Document) {
  const conceptos = findAllByLocalName(doc, "Concepto");

  if (conceptos.length === 0) return "";

  const descriptions = conceptos
    .map((concepto) => getAttr(concepto, ["Descripcion", "descripcion"]))
    .filter(Boolean);

  return descriptions.join(" | ");
}

export function parseCfdiXml(xmlText: string): ParsedCfdiData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("El XML no tiene un formato válido.");
  }

  const comprobante = findFirstByLocalName(doc, "Comprobante");
  const receptor = findFirstByLocalName(doc, "Receptor");
  const timbre = findFirstByLocalName(doc, "TimbreFiscalDigital");

  if (!comprobante) {
    throw new Error("No encontré el nodo Comprobante dentro del XML.");
  }

  const uuid = getAttr(timbre, ["UUID", "Uuid", "uuid"]);
  const series = getAttr(comprobante, ["Serie", "serie"]);
  const folio = getAttr(comprobante, ["Folio", "folio"]);
  const issuedAt = formatIssuedAtToDateInput(getAttr(comprobante, ["Fecha", "fecha"]));
  const subtotal = getAttr(comprobante, ["SubTotal", "Subtotal", "subTotal", "subtotal"]);
  const total = getAttr(comprobante, ["Total", "total"]);
  const customerTaxId = getAttr(receptor, ["Rfc", "RFC", "rfc"]);
  const customerName = getAttr(receptor, ["Nombre", "nombre"]);
  const tipoDeComprobante = getAttr(comprobante, ["TipoDeComprobante", "tipodecomprobante"]);
  const description = extractDescription(doc);
  const tax = sumTrasladosImporte(doc);

  return {
    uuid,
    series,
    folio,
    issuedAt,
    subtotal,
    tax,
    total,
    customerName,
    customerTaxId,
    invoiceType: normalizeInvoiceType(tipoDeComprobante),
    description,
  };
}