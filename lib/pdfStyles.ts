import type jsPDF from "jspdf";

export const PDF_COLORS = {
  accent:       "#8B2252",
  headerBg:     "#F8FAFC",
  border:       "#E2E8F0",
  footerBg:     "#F1F5F9",
  footerBorder: "#CBD5E1",
  text:         "#374151",
  textMuted:    "#6B7280",
  white:        "#FFFFFF",
};

export const PDF_LAYOUT = {
  margin:           36,
  pageWidth:        595.28,
  pageHeight:       841.89,
  accentBarHeight:  4,
  rowHeight:        22,
  headerRowHeight:  18,
  footerRowHeight:  24,
  metaRowHeight:    28,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = jsPDF | any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Banda vino superior */
export function drawAccentBar(doc: Doc): void {
  const [r, g, b] = hexToRGB(PDF_COLORS.accent);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PDF_LAYOUT.pageWidth, PDF_LAYOUT.accentBarHeight, "F");
}

/** Línea separadora */
export function drawSeparator(doc: Doc, y: number): void {
  const [r, g, b] = hexToRGB(PDF_COLORS.border);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(PDF_LAYOUT.margin, y, PDF_LAYOUT.pageWidth - PDF_LAYOUT.margin, y);
}

/** Fila de meta datos (Elaboró / Empresa / Fecha) con fondo #F8FAFC */
export function drawMetaRow(
  doc: Doc,
  y: number,
  cells: { label: string; value: string }[],
): number {
  const { margin, pageWidth, metaRowHeight } = PDF_LAYOUT;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / cells.length;

  /* Fondo */
  const [bgR, bgG, bgB] = hexToRGB(PDF_COLORS.headerBg);
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(margin, y, usableWidth, metaRowHeight, "F");

  /* Borde exterior */
  const [brR, brG, brB] = hexToRGB(PDF_COLORS.border);
  doc.setDrawColor(brR, brG, brB);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, usableWidth, metaRowHeight);

  const [tR, tG, tB] = hexToRGB(PDF_COLORS.text);
  const [mR, mG, mB] = hexToRGB(PDF_COLORS.textMuted);

  cells.forEach((cell, i) => {
    const x = margin + i * colWidth;

    /* Divisor vertical entre celdas */
    if (i > 0) {
      doc.setDrawColor(brR, brG, brB);
      doc.setLineWidth(0.5);
      doc.line(x, y, x, y + metaRowHeight);
    }

    /* Label muted */
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(mR, mG, mB);
    doc.text(cell.label.toUpperCase(), x + 6, y + 9);

    /* Valor bold */
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(tR, tG, tB);
    doc.text(cell.value, x + 6, y + 21);
  });

  return y + metaRowHeight;
}

/** Título de sección (ej. "ORDEN DE COMPRA", "MATERIALES REQUERIDOS") */
export function drawSectionTitle(doc: Doc, y: number, title: string): number {
  const { margin, pageWidth } = PDF_LAYOUT;
  const [tR, tG, tB] = hexToRGB(PDF_COLORS.text);
  const [bR, bG, bB] = hexToRGB(PDF_COLORS.border);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(tR, tG, tB);
  doc.text(title.toUpperCase(), margin, y + 10);

  doc.setDrawColor(bR, bG, bB);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 13, pageWidth - margin, y + 13);

  return y + 16;
}

/** Header de tabla con esquinas superiores redondeadas */
export function drawTableHeader(
  doc: Doc,
  y: number,
  columns: { label: string; x: number; width: number; align?: "left" | "center" | "right" }[],
  tableWidth: number,
  tableX = PDF_LAYOUT.margin,
): number {
  const { headerRowHeight } = PDF_LAYOUT;
  const [bgR, bgG, bgB] = hexToRGB(PDF_COLORS.headerBg);
  const [brR, brG, brB] = hexToRGB(PDF_COLORS.border);
  const [tR, tG, tB]    = hexToRGB(PDF_COLORS.text);

  /* Fondo con esquinas top redondeadas */
  doc.setFillColor(bgR, bgG, bgB);
  // @ts-ignore
  doc.roundedRect(tableX, y, tableWidth, headerRowHeight, 3, 3, "F");
  /* Tapar esquinas inferiores del header (cuadradas) */
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(tableX, y + headerRowHeight / 2, tableWidth, headerRowHeight / 2, "F");

  doc.setDrawColor(brR, brG, brB);
  doc.setLineWidth(1);
  doc.line(tableX, y + headerRowHeight, tableX + tableWidth, y + headerRowHeight);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(tR, tG, tB);

  columns.forEach((col) => {
    const align = col.align || "left";
    const textX =
      align === "center" ? col.x + col.width / 2 :
      align === "right"  ? col.x + col.width - 4  :
      col.x + 4;
    doc.text(col.label.toUpperCase(), textX, y + headerRowHeight - 5, { align });
  });

  return y + headerRowHeight;
}

/** Fila de tabla */
export function drawTableRow(
  doc: Doc,
  y: number,
  cells: { value: string; x: number; width: number; align?: "left" | "center" | "right"; bold?: boolean; mono?: boolean }[],
  tableWidth: number,
  tableX = PDF_LAYOUT.margin,
  rowHeight = PDF_LAYOUT.rowHeight,
): number {
  const [brR, brG, brB] = hexToRGB(PDF_COLORS.border);
  const [tR, tG, tB]    = hexToRGB(PDF_COLORS.text);

  doc.setDrawColor(brR, brG, brB);
  doc.setLineWidth(0.5);
  doc.line(tableX, y + rowHeight, tableX + tableWidth, y + rowHeight);

  cells.forEach((cell) => {
    doc.setFontSize(cell.mono ? 7.5 : 8.5);
    doc.setFont("helvetica", cell.bold ? "bold" : "normal");
    doc.setTextColor(tR, tG, tB);
    const align = cell.align || "left";
    const textX =
      align === "center" ? cell.x + cell.width / 2 :
      align === "right"  ? cell.x + cell.width - 4  :
      cell.x + 4;
    doc.text(cell.value || "", textX, y + rowHeight - 6, {
      align,
      maxWidth: cell.width - 8,
    });
  });

  return y + rowHeight;
}

/** Fila footer de tabla (proyecto, info extra) con fondo #F1F5F9 */
export function drawTableFooterRow(
  doc: Doc,
  y: number,
  label: string,
  tableWidth: number,
  tableX = PDF_LAYOUT.margin,
): number {
  const { footerRowHeight } = PDF_LAYOUT;
  const [bgR, bgG, bgB]   = hexToRGB(PDF_COLORS.footerBg);
  const [fbR, fbG, fbB]   = hexToRGB(PDF_COLORS.footerBorder);
  const [tR, tG, tB]      = hexToRGB(PDF_COLORS.text);

  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(tableX, y, tableWidth, footerRowHeight, "F");

  doc.setDrawColor(fbR, fbG, fbB);
  doc.setLineWidth(1);
  doc.line(tableX, y, tableX + tableWidth, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(tR, tG, tB);
  doc.text(label, tableX + 6, y + footerRowHeight - 7);

  return y + footerRowHeight;
}

/** Borde exterior de tabla con esquinas redondeadas */
export function drawTableBorder(
  doc: Doc,
  startY: number,
  endY: number,
  tableWidth: number,
  tableX = PDF_LAYOUT.margin,
): void {
  const [r, g, b] = hexToRGB(PDF_COLORS.border);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  // @ts-ignore — roundedRect existe en jsPDF pero no siempre en tipos
  doc.roundedRect(tableX, startY, tableWidth, endY - startY, 3, 3, "S");
}

/** Contenedor de tabla con fondo blanco y bordes redondeados.
 *  Dibujar ANTES de las filas para que el fondo no las tape. */
export function drawTableContainer(
  doc: Doc,
  y: number,
  totalHeight: number,
  tableWidth: number,
  tableX = PDF_LAYOUT.margin,
): void {
  const [wR, wG, wB] = hexToRGB(PDF_COLORS.white);
  const [bR, bG, bB] = hexToRGB(PDF_COLORS.border);
  doc.setFillColor(wR, wG, wB);
  doc.setDrawColor(bR, bG, bB);
  doc.setLineWidth(0.5);
  // @ts-ignore — roundedRect existe en jsPDF pero no siempre en tipos
  doc.roundedRect(tableX, y, tableWidth, totalHeight, 3, 3, "FD");
}

/** Firmas al pie */
export function drawSignatures(
  doc: Doc,
  y: number,
  signersList: { label: string; name?: string }[],
): void {
  const { pageWidth, margin } = PDF_LAYOUT;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / signersList.length;
  const [tR, tG, tB] = hexToRGB(PDF_COLORS.text);
  const [mR, mG, mB] = hexToRGB(PDF_COLORS.textMuted);
  const [bR, bG, bB] = hexToRGB(PDF_COLORS.border);

  signersList.forEach((signer, i) => {
    const x = margin + i * colWidth;
    const centerX = x + colWidth / 2;

    if (signer.name) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(tR, tG, tB);
      doc.text(signer.name, centerX, y - 8, { align: "center" });
    }

    doc.setDrawColor(bR, bG, bB);
    doc.setLineWidth(0.5);
    doc.line(x + 10, y, x + colWidth - 10, y);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(mR, mG, mB);
    doc.text(signer.label.toUpperCase(), centerX, y + 10, { align: "center" });
  });
}
