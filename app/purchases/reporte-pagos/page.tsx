"use client";

/*
  Reporte de envío a pagos.

  Flujo:
  1. Selecciona OCs con status='sent' que aún no estén en un payment_report.
  2. Por cada OC agregada, captura fecha_factura y numero_factura.
  3. "Generar PDF" → descarga el PDF localmente (no persiste).
  4. "Guardar reporte" → genera el PDF, lo sube a Storage, persiste
      payment_reports + payment_report_items y marca la lista como no disponible.

  Tablas esperadas en Supabase:

    payment_reports
      id uuid PK, company_id uuid, folio text,
      signer_name text, report_date date,
      pdf_url text NULL,
      created_at, updated_at, deleted_at

    payment_report_items
      id uuid PK, payment_report_id uuid → payment_reports,
      purchase_order_id uuid → purchase_orders,
      invoice_date date NULL, invoice_number text NULL,
      created_at

  Storage:
    bucket "payment-reports" con path {company_id}/{folio}.pdf
*/

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  FileText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { prepareLogoForPDF } from "@/app/maintenance/page";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";

/* ── Helpers ──────────────────────────────────────────────────── */

/** ISO week number (Monday-first, estándar ISO-8601) */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** YYYY-MM-DD local (no UTC) */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateEs(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* ── Tipos ────────────────────────────────────────────────────── */

type Signer = { id: string; name: string; is_default: boolean };

type AvailableOC = {
  id:                  string;
  folio:               string;
  project_description: string | null;
  building_name:       string | null;
};

type ReportItem = {
  oc:             AvailableOC;
  invoice_date:   string;
  invoice_number: string;
};

/* ── Componente ───────────────────────────────────────────────── */

export default function ReportePagosPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const { legalName, shortName } = useTheme();

  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState("");
  const [error,   setError]   = useState("");

  /* Catálogos */
  const [signers,       setSigners]       = useState<Signer[]>([]);
  const [availableOCs,  setAvailableOCs]  = useState<AvailableOC[]>([]);
  const [companyName,   setCompanyName]   = useState("");
  const [companyLogoPrint, setCompanyLogoPrint] = useState("");
  const [companyLogoUrl,   setCompanyLogoUrl]   = useState("");

  /* Form */
  const [signerName,  setSignerName]  = useState("");
  const [customSignerMode, setCustomSignerMode] = useState(false);
  const [reportDate,  setReportDate]  = useState(todayIso());
  const [items,       setItems]       = useState<ReportItem[]>([]);
  const [ocToAdd,     setOcToAdd]     = useState("");

  /* Flags */
  const [generating,  setGenerating]  = useState(false);
  const [saving,      setSaving]      = useState(false);

  /* ── Derivados ───────────────────────────────────────────────── */

  const week  = useMemo(() => getISOWeek(new Date(reportDate + "T00:00:00")), [reportDate]);
  const year  = useMemo(() => new Date(reportDate + "T00:00:00").getFullYear(), [reportDate]);
  const folio = useMemo(() => `REP-S${week}-${year}`, [week, year]);

  /* OCs que aún no están en el carrito del reporte */
  const addableOCs = useMemo(() => {
    const used = new Set(items.map((it) => it.oc.id));
    return availableOCs.filter((o) => !used.has(o.id));
  }, [availableOCs, items]);

  /* ── Load ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!userLoading && user?.company_id) void loadAll(user.company_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user]);

  async function loadAll(companyId: string) {
    setLoading(true);
    setError("");

    /* 1. Firmantes (misma fuente que el módulo de compras) */
    const { data: signersData } = await supabase
      .from("purchase_order_signers")
      .select("id, name, is_default")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    const signerRows = (signersData as Signer[]) || [];
    setSigners(signerRows);
    /* Preseleccionar firmante default si existe */
    const defaultSigner = signerRows.find((s) => s.is_default);
    if (defaultSigner) setSignerName(defaultSigner.name);

    /* 2. Reportes previos de la empresa (para sacar IDs de items existentes) */
    const { data: reportsData } = await supabase
      .from("payment_reports")
      .select("id")
      .eq("company_id", companyId)
      .is("deleted_at", null);
    const reportIds = ((reportsData as { id: string }[] | null) || []).map((r) => r.id);

    /* 3. IDs de OCs ya reportadas */
    let alreadyReported = new Set<string>();
    if (reportIds.length > 0) {
      const { data: reportItemsData } = await supabase
        .from("payment_report_items")
        .select("purchase_order_id")
        .in("payment_report_id", reportIds);
      alreadyReported = new Set(
        ((reportItemsData as { purchase_order_id: string }[] | null) || [])
          .map((i) => i.purchase_order_id)
      );
    }

    /* 4. OCs con status='sent' que NO estén en alreadyReported */
    const { data: ocsData, error: ocsError } = await supabase
      .from("purchase_orders")
      .select(`
        id, folio, project_description,
        buildings(name)
      `)
      .eq("company_id", companyId)
      .eq("status", "sent")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (ocsError) {
      console.error("loadAll OCs error:", ocsError);
      setError(`No se pudieron cargar las OC: ${ocsError.message}`);
      setLoading(false);
      return;
    }

    type OCRow = {
      id: string; folio: string; project_description: string | null;
      buildings: { name: string } | null;
    };
    const ocs: AvailableOC[] = ((ocsData || []) as unknown as OCRow[])
      .filter((o) => !alreadyReported.has(o.id))
      .map((o) => ({
        id:                  o.id,
        folio:               o.folio,
        project_description: o.project_description,
        building_name:       o.buildings?.name || null,
      }));
    setAvailableOCs(ocs);

    /* 5. Datos de empresa (para logo y nombre en el PDF) */
    const { data: companyData } = await supabase
      .from("companies")
      .select("name, logo_url, logo_print_url")
      .eq("id", companyId)
      .single();
    if (companyData) {
      const cd = companyData as { name: string; logo_url?: string; logo_print_url?: string };
      setCompanyName(cd.name || "");
      setCompanyLogoUrl(cd.logo_url || "");
      setCompanyLogoPrint(cd.logo_print_url || "");
    }

    setLoading(false);
  }

  /* ── Items del reporte ──────────────────────────────────────── */

  function addItemById(ocId: string) {
    if (!ocId) return;
    const oc = addableOCs.find((o) => o.id === ocId);
    if (!oc) return;
    setItems((prev) => [
      ...prev,
      { oc, invoice_date: "", invoice_number: "" },
    ]);
    setOcToAdd("");
  }

  function updateItem(idx: number, patch: Partial<ReportItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ── PDF ─────────────────────────────────────────────────────── */

  /** Construye el documento jsPDF con el layout del reporte */
  async function buildReportDoc(): Promise<unknown> {
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const pageW    = 612;
    const marginL  = 36;
    const marginR  = 36;
    const rightX   = pageW - marginR;       // 576
    const contentW = pageW - marginL - marginR;

    /* Logo FRA-MAR */
    const printSrc = companyLogoPrint || companyLogoUrl;
    const logoPrint = printSrc ? await prepareLogoForPDF(printSrc, 110, 45) : null;

    /* ── Banda vino FRA-MAR ── */
    doc.setFillColor(139, 34, 82);
    doc.rect(0, 0, pageW, 4, "F");

    /* ── Logo izquierda ── */
    if (logoPrint) {
      try {
        doc.addImage(
          logoPrint.data, "PNG",
          marginL, 12,
          logoPrint.displayWidth, logoPrint.displayHeight,
        );
      } catch { /* sin logo */ }
    }

    /* ── Título + folio a la derecha ── */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);           // #111827
    doc.text("REPORTE DE ENVÍO A PAGOS", rightX, 26, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);        // #6b7280
    doc.text(`Semana ${week} · ${year}`, rightX, 42, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(folio, rightX, 56, { align: "right" });

    /* ── Línea separadora ── */
    doc.setDrawColor(229, 231, 235);        // #e5e7eb
    doc.setLineWidth(0.5);
    doc.line(marginL, 70, rightX, 70);

    /* ── Datos: 3 columnas ── */
    const dataY = 82;
    const dataH = 48;
    doc.setFillColor(248, 250, 252);        // #F8FAFC
    doc.rect(marginL, dataY, contentW, dataH, "F");
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.rect(marginL, dataY, contentW, dataH, "S");

    const colW = contentW / 3;
    const labels = ["ELABORÓ", "EMPRESA", "FECHA"];
    const values = [
      signerName || "—",
      (legalName || companyName || shortName || "").toString() || "—",
      formatDateEs(reportDate),
    ];
    labels.forEach((label, i) => {
      const cx = marginL + i * colW;
      /* divisor vertical */
      if (i > 0) {
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(cx, dataY + 6, cx, dataY + dataH - 6);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(label, cx + 12, dataY + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      /* Truncar con splitTextToSize para que quepa */
      const line = doc.splitTextToSize(values[i] || "—", colW - 24) as string[];
      doc.text(line[0] || "—", cx + 12, dataY + 34);
    });

    /* ── Tabla ── */
    let cursorY = dataY + dataH + 20;
    const tableStartY = cursorY;
    const c1 = 90;   // FOLIO OC
    const c2 = 80;   // FECHA FACTURA
    const c3 = 80;   // NO. FACTURA
    const c4 = 130;  // PROYECTO
    const c5 = contentW - c1 - c2 - c3 - c4;  // FIRMA DE RECIBIDO
    const headerH = 22;
    const rowH    = 28;

    /* Header fills */
    doc.setFillColor(248, 250, 252);
    doc.rect(marginL, cursorY, contentW, headerH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);           // #374151
    let x = marginL;
    doc.text("FOLIO OC",          x + c1 / 2, cursorY + 14, { align: "center" }); x += c1;
    doc.text("FECHA FACTURA",     x + c2 / 2, cursorY + 14, { align: "center" }); x += c2;
    doc.text("NO. FACTURA",       x + c3 / 2, cursorY + 14, { align: "center" }); x += c3;
    doc.text("PROYECTO",          x + c4 / 2, cursorY + 14, { align: "center" }); x += c4;
    doc.text("FIRMA DE RECIBIDO", x + c5 / 2, cursorY + 14, { align: "center" });
    cursorY += headerH;

    /* Filas */
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);

    for (const it of items) {
      let xi = marginL;
      /* FOLIO OC */
      doc.text(it.oc.folio || "", xi + c1 / 2, cursorY + 17, { align: "center" });
      xi += c1;
      /* FECHA FACTURA */
      doc.text(it.invoice_date ? formatDateEs(it.invoice_date) : "", xi + c2 / 2, cursorY + 17, { align: "center" });
      xi += c2;
      /* NO. FACTURA */
      doc.text(it.invoice_number || "", xi + c3 / 2, cursorY + 17, { align: "center" });
      xi += c3;
      /* PROYECTO */
      const proj = it.oc.building_name
        ? (it.oc.project_description ? `${it.oc.building_name} · ${it.oc.project_description}` : it.oc.building_name)
        : (it.oc.project_description || "—");
      const projLine = doc.splitTextToSize(proj, c4 - 8) as string[];
      doc.text(projLine[0] || "—", xi + 4, cursorY + 17);
      xi += c4;
      /* FIRMA DE RECIBIDO — línea horizontal para firmar a mano */
      doc.setDrawColor(156, 163, 175);      // #9ca3af
      doc.setLineWidth(0.5);
      doc.line(xi + 8, cursorY + rowH - 6, xi + c5 - 8, cursorY + rowH - 6);
      cursorY += rowH;
    }

    /* Bordes de tabla */
    const tableEndY = cursorY;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    /* Rect exterior */
    doc.rect(marginL, tableStartY, contentW, tableEndY - tableStartY, "S");
    /* Línea bajo el header */
    doc.line(marginL, tableStartY + headerH, marginL + contentW, tableStartY + headerH);
    /* Líneas entre filas */
    for (let i = 1; i <= items.length; i++) {
      const y = tableStartY + headerH + i * rowH;
      if (y < tableEndY) doc.line(marginL, y, marginL + contentW, y);
    }
    /* Líneas verticales entre columnas */
    let lx = marginL;
    [c1, c2, c3, c4].forEach((w) => {
      lx += w;
      doc.line(lx, tableStartY, lx, tableEndY);
    });

    /* ── Firmas al pie ── */
    cursorY += 70;
    const centerL = marginL + contentW * 0.25;
    const centerR = marginL + contentW * 0.75;
    const lineLen = 180;

    doc.setDrawColor(55, 65, 81);
    doc.setLineWidth(0.6);
    doc.line(centerL - lineLen / 2, cursorY, centerL + lineLen / 2, cursorY);
    doc.line(centerR - lineLen / 2, cursorY, centerR + lineLen / 2, cursorY);

    /* Nombre del firmante izquierdo */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const signerLines = doc.splitTextToSize((signerName || "").toUpperCase(), 200) as string[];
    signerLines.forEach((line: string, i: number) => {
      doc.text(line, centerL, cursorY + 14 + i * 11, { align: "center" });
    });

    /* Labels debajo de ambas líneas */
    const labelY = cursorY + 14 + Math.max(1, signerLines.length) * 11 + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("ELABORÓ", centerL, labelY, { align: "center" });
    doc.text("RECIBIÓ EN ÁREA DE PAGOS", centerR, labelY, { align: "center" });

    return doc;
  }

  async function handleGeneratePDF() {
    if (items.length === 0) { setError("Agrega al menos una OC al reporte."); return; }
    if (!signerName.trim()) { setError("Selecciona quién elaboró el reporte."); return; }
    setError("");
    setGenerating(true);
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const doc = (await buildReportDoc()) as any;
      doc.save(`${folio}.pdf`);
    } catch (err) {
      console.error("generate pdf error:", err);
      setError("Error al generar el PDF.");
    }
    setGenerating(false);
  }

  async function handleSaveReport() {
    if (!user?.company_id) return;
    if (items.length === 0) { setError("Agrega al menos una OC al reporte."); return; }
    if (!signerName.trim()) { setError("Selecciona quién elaboró el reporte."); return; }
    setError("");
    setSaving(true);

    try {
      /* 1. Generar PDF como blob */
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const doc = (await buildReportDoc()) as any;
      const blob: Blob = doc.output("blob");

      /* 2. Subir a Storage */
      const path = `${user.company_id}/${folio}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("payment-reports")
        .upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("payment-reports").getPublicUrl(path);
      const pdfUrl = urlData?.publicUrl || null;

      /* 3. INSERT payment_reports */
      const { data: inserted, error: insErr } = await supabase
        .from("payment_reports")
        .insert({
          company_id:  user.company_id,
          folio,
          signer_name: signerName.trim(),
          report_date: reportDate,
          pdf_url:     pdfUrl,
        })
        .select("id")
        .single();
      if (insErr || !inserted) throw insErr || new Error("No se pudo crear el reporte.");

      /* 4. INSERT payment_report_items (uno por OC) */
      const itemsPayload = items.map((it) => ({
        payment_report_id: inserted.id,
        purchase_order_id: it.oc.id,
        invoice_date:      it.invoice_date || null,
        invoice_number:    it.invoice_number.trim() || null,
      }));
      const { error: itemsErr } = await supabase
        .from("payment_report_items")
        .insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      /* 5. Persistir firmante nuevo (si no estaba en la lista) */
      const existsAlready = signers.some(
        (s) => s.name.toLowerCase() === signerName.trim().toLowerCase()
      );
      if (!existsAlready) {
        await supabase.from("purchase_order_signers").insert({
          company_id: user.company_id,
          name:       signerName.trim(),
          is_default: false,
        });
      }

      /* 6. Descargar el PDF localmente también */
      doc.save(`${folio}.pdf`);

      setMsg("Reporte guardado correctamente.");
      setItems([]);
      void loadAll(user.company_id);
    } catch (err) {
      console.error("save report error:", err);
      const m = err instanceof Error ? err.message : "Error desconocido.";
      setError(`No se pudo guardar el reporte: ${m}`);
    }
    setSaving(false);
  }

  /* ── Styles ──────────────────────────────────────────────────── */

  const INPUT_STYLE: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--border-default)",
    borderRadius: 10,
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  };

  const thStyle: CSSProperties = {
    padding: "10px 8px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border-default)",
    background: "var(--bg-input)",
  };

  const tdStyle: CSSProperties = {
    padding: "10px 8px",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border-default)",
    verticalAlign: "middle",
  };

  /* ── Render ──────────────────────────────────────────────────── */

  if (userLoading || loading) {
    return <PageContainer><p style={{ color: "var(--text-muted)" }}>Cargando...</p></PageContainer>;
  }

  const weekLabel = `Semana ${week} · ${year}`;

  return (
    <PageContainer>
      <PageHeader
        title="Reporte de envío a pagos"
        titleIcon={<FileText size={18} />}
        subtitle={weekLabel}
        actions={
          <>
            <UiButton
              variant="secondary"
              onClick={handleGeneratePDF}
              disabled={generating || saving}
              icon={<FileText size={15} />}
            >
              {generating ? "Generando..." : "Generar PDF"}
            </UiButton>
            <UiButton
              variant="primary"
              onClick={handleSaveReport}
              disabled={saving || generating}
              icon={<Save size={15} />}
            >
              {saving ? "Guardando..." : "Guardar reporte"}
            </UiButton>
          </>
        }
      />

      {msg ? (
        <AppCard style={{ marginBottom: 16 }}>
          <div style={{ color: "var(--badge-text-blue)", fontWeight: 600 }}>{msg}</div>
        </AppCard>
      ) : null}
      {error ? (
        <AppCard style={{ marginBottom: 16 }}>
          <div style={{ color: "var(--badge-text-red)", fontWeight: 600 }}>{error}</div>
        </AppCard>
      ) : null}

      {/* ── Datos del reporte ──────────────────────────────────── */}
      <AppCard style={{ marginBottom: 16 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          alignItems: "end",
        }}>
          {/* Elaboró (dropdown + Otro) */}
          <AppFormField label="Elaboró" required>
            {customSignerMode ? (
              <input
                style={INPUT_STYLE}
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nombre del firmante"
                autoFocus
              />
            ) : (
              <select
                style={INPUT_STYLE}
                value={signerName}
                onChange={(e) => {
                  if (e.target.value === "__OTHER__") {
                    setCustomSignerMode(true);
                    setSignerName("");
                  } else {
                    setSignerName(e.target.value);
                  }
                }}
              >
                <option value="">Selecciona...</option>
                {signers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}{s.is_default ? " (default)" : ""}
                  </option>
                ))}
                <option value="__OTHER__">+ Otro...</option>
              </select>
            )}
          </AppFormField>

          {/* Empresa (readonly) */}
          <AppFormField label="Empresa">
            <input
              style={{ ...INPUT_STYLE, background: "var(--bg-page)", color: "var(--text-secondary)" }}
              value={legalName || companyName || shortName || ""}
              readOnly
            />
          </AppFormField>

          {/* Fecha del reporte */}
          <AppFormField label="Fecha del reporte" required>
            <input
              type="date"
              style={INPUT_STYLE}
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </AppFormField>

          {/* Folio (auto) */}
          <AppFormField label="Folio (automático)">
            <input
              style={{ ...INPUT_STYLE, background: "var(--bg-page)", color: "var(--text-secondary)", fontFamily: "monospace" }}
              value={folio}
              readOnly
            />
          </AppFormField>
        </div>
      </AppCard>

      {/* ── Selector de OCs ────────────────────────────────────── */}
      <AppCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
          Agregar órdenes de compra al reporte
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            style={{ ...INPUT_STYLE, flex: 1, minWidth: 260 }}
            value={ocToAdd}
            onChange={(e) => setOcToAdd(e.target.value)}
          >
            <option value="">
              {addableOCs.length === 0
                ? "No hay OC disponibles para reportar"
                : `Selecciona una OC… (${addableOCs.length} disponibles)`}
            </option>
            {addableOCs.map((o) => {
              const project = o.building_name
                ? (o.project_description ? `${o.building_name} · ${o.project_description}` : o.building_name)
                : (o.project_description || "Sin proyecto");
              return (
                <option key={o.id} value={o.id}>
                  {o.folio} — {project}
                </option>
              );
            })}
          </select>

          <UiButton
            variant="primary"
            onClick={() => addItemById(ocToAdd)}
            disabled={!ocToAdd}
            icon={<Plus size={15} />}
          >
            Agregar
          </UiButton>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          Solo se muestran OC con estado &quot;Enviada&quot; que aún no estén en un reporte previo.
        </p>
      </AppCard>

      {/* ── Tabla de OCs seleccionadas ─────────────────────────── */}
      <AppCard>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
          Órdenes incluidas en el reporte ({items.length})
        </div>

        {items.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
            Aún no has agregado OCs. Selecciona una del dropdown de arriba.
          </p>
        ) : (
          <div style={{
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 120 }}>Folio OC</th>
                  <th style={{ ...thStyle, width: 150 }}>Fecha factura</th>
                  <th style={{ ...thStyle, width: 140 }}>No. factura</th>
                  <th style={thStyle}>Proyecto</th>
                  <th style={{ ...thStyle, width: 120, textAlign: "center" }}>Firma de recibido</th>
                  <th style={{ ...thStyle, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const project = it.oc.building_name
                    ? (it.oc.project_description ? `${it.oc.building_name} · ${it.oc.project_description}` : it.oc.building_name)
                    : (it.oc.project_description || "—");
                  return (
                    <tr key={it.oc.id}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700 }}>
                        {it.oc.folio}
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="date"
                          style={{ ...INPUT_STYLE, padding: "8px 10px", fontSize: 13 }}
                          value={it.invoice_date}
                          onChange={(e) => updateItem(idx, { invoice_date: e.target.value })}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          style={{ ...INPUT_STYLE, padding: "8px 10px", fontSize: 13 }}
                          value={it.invoice_number}
                          onChange={(e) => updateItem(idx, { invoice_number: e.target.value })}
                          placeholder="A-12345"
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>
                        {project}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)", fontSize: 11, fontStyle: "italic" }}>
                        (se firma en el PDF)
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          aria-label="Quitar del reporte"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--badge-bg-red)",
                            color: "var(--badge-text-red)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>
    </PageContainer>
  );
}
