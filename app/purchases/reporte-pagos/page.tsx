"use client";

/*
  Reportes de envío a pagos — listado con cards expandibles.

  Mismo patrón visual que app/purchases/page.tsx:
  - Navegador de mes
  - Métricas
  - Cards expandibles con secciones: Datos generales / OCs incluidas / Acciones
  - Modal crear/editar

  Tablas esperadas en Supabase:

    payment_reports
      id uuid PK, company_id uuid, folio text,
      elaborated_by text, report_date date,
      week_number int, year int,
      pdf_url text NULL,
      created_at, updated_at, deleted_at

    payment_report_items
      id uuid PK, payment_report_id uuid → payment_reports,
      purchase_order_id uuid → purchase_orders,
      invoice_date date NULL, invoice_number text NULL,
      created_at

  Lectura auxiliar:
    purchase_order_signers — dropdown de "Elaboró"
    purchase_orders status='sent' — OCs disponibles para el reporte
*/

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit3,
  FileText,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { generateReportePdf } from "@/lib/pdfTemplates";
import { formatDateShort, getWeekNumber } from "@/lib/dateUtils";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";

/* ── Helpers ──────────────────────────────────────────────────── */

/** YYYY-MM-DD local (no UTC) */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ── Tipos ────────────────────────────────────────────────────── */

type Signer = { id: string; name: string; is_default: boolean };

type AvailableOC = {
  id:                  string;
  folio:               string;
  supplier_name:       string | null;
  project_description: string | null;
  building_name:       string | null;
  created_at:          string;
  sent_at:             string | null;
};

type ReportItemRow = {
  id:                string;
  payment_report_id: string;
  purchase_order_id: string;
  invoice_date:      string | null;
  invoice_number:    string | null;
  oc_folio:          string;
  oc_supplier_name:  string | null;
  oc_project_description: string | null;
  oc_building_name:  string | null;
  oc_sent_at:        string | null;
};

type PaymentReport = {
  id:             string;
  folio:          string;
  elaborated_by:  string | null;
  report_date:    string;
  week_number:    number | null;
  year:           number | null;
  pdf_url:        string | null;
  created_at:     string;
};

type ItemDraft = {
  invoice_date:   string;
  invoice_number: string;
};

/* ── Constantes ──────────────────────────────────────────────── */

const MONTH_LABELS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/* ── Componente ──────────────────────────────────────────────── */

export default function ReportePagosPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const { legalName, shortName } = useTheme();

  /* Catálogos y datos */
  const [reports,      setReports]      = useState<PaymentReport[]>([]);
  const [reportItems,  setReportItems]  = useState<ReportItemRow[]>([]);
  const [allSentOCs,   setAllSentOCs]   = useState<AvailableOC[]>([]);
  const [signers,      setSigners]      = useState<Signer[]>([]);
  const [companyName,      setCompanyName]      = useState("");
  const [companyLogoUrl,   setCompanyLogoUrl]   = useState("");
  const [companyLogoPrint, setCompanyLogoPrint] = useState("");

  /* UI */
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState("");
  const [error,   setError]   = useState("");

  /* Expansión inline */
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  /* Navegador de mes (igual que /purchases) */
  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  /* Modal crear / editar */
  const [showModal,        setShowModal]        = useState(false);
  const [editingReportId,  setEditingReportId]  = useState<string | null>(null);
  const [signerName,       setSignerName]       = useState("");
  const [customSignerMode, setCustomSignerMode] = useState(false);
  const [reportDate,       setReportDate]       = useState(todayIso());
  /* Map<purchase_order_id, ItemDraft> con las OCs marcadas y sus datos de factura */
  const [itemDrafts,       setItemDrafts]       = useState<Map<string, ItemDraft>>(new Map());

  /* Flags */
  const [saving,          setSaving]          = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [archivingId,     setArchivingId]     = useState<string | null>(null);

  /* ── Load ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!userLoading && user?.company_id) void loadAll(user.company_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user]);

  async function loadAll(companyId: string) {
    setLoading(true);
    setError("");

    const [
      { data: reportsData,  error: reportsError },
      { data: sentOCsData                        },
      { data: signerData                         },
      { data: companyData                        },
    ] = await Promise.all([
      supabase
        .from("payment_reports")
        .select("id, folio, elaborated_by, report_date, week_number, year, pdf_url, created_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("purchase_orders")
        .select(`
          id, folio, project_description, created_at, sent_at, supplier_prefix,
          suppliers(name),
          buildings(name)
        `)
        .eq("company_id", companyId)
        .eq("status", "sent")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("purchase_order_signers")
        .select("id, name, is_default")
        .eq("company_id", companyId)
        .eq("role", "payer")
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),

      supabase
        .from("companies")
        .select("name, logo_url, logo_print_url")
        .eq("id", companyId)
        .single(),
    ]);

    if (reportsError) {
      console.error("loadAll payment_reports error:", reportsError);
      setError(`No se pudieron cargar los reportes: ${reportsError.message}`);
      setLoading(false);
      return;
    }

    const reportRows = (reportsData as PaymentReport[]) || [];
    setReports(reportRows);

    /* Cargar items de todos los reportes con info del OC en el mismo query */
    if (reportRows.length > 0) {
      const reportIds = reportRows.map((r) => r.id);
      const { data: itemsData } = await supabase
        .from("payment_report_items")
        .select(`
          id, payment_report_id, purchase_order_id,
          invoice_date, invoice_number,
          purchase_orders(
            id, folio, project_description, sent_at,
            buildings(name),
            suppliers(name)
          )
        `)
        .in("payment_report_id", reportIds);

      type Raw = {
        id: string; payment_report_id: string; purchase_order_id: string;
        invoice_date: string | null; invoice_number: string | null;
        purchase_orders: {
          id: string; folio: string; project_description: string | null;
          sent_at: string | null;
          buildings: { name: string } | null;
          suppliers: { name: string } | null;
        } | null;
      };
      const mapped: ReportItemRow[] = ((itemsData || []) as unknown as Raw[]).map((r) => ({
        id:                     r.id,
        payment_report_id:      r.payment_report_id,
        purchase_order_id:      r.purchase_order_id,
        invoice_date:           r.invoice_date,
        invoice_number:         r.invoice_number,
        oc_folio:               r.purchase_orders?.folio || "",
        oc_supplier_name:       r.purchase_orders?.suppliers?.name || null,
        oc_project_description: r.purchase_orders?.project_description || null,
        oc_building_name:       r.purchase_orders?.buildings?.name || null,
        oc_sent_at:             r.purchase_orders?.sent_at || null,
      }));
      setReportItems(mapped);
    } else {
      setReportItems([]);
    }

    /* OCs disponibles (sent) con info mínima */
    type OCRaw = {
      id: string; folio: string; project_description: string | null;
      created_at: string; sent_at: string | null; supplier_prefix: string | null;
      buildings: { name: string } | null;
      suppliers: { name: string } | null;
    };
    const ocs: AvailableOC[] = ((sentOCsData || []) as unknown as OCRaw[]).map((o) => ({
      id:                  o.id,
      folio:               o.folio,
      supplier_name:       o.suppliers?.name || null,
      project_description: o.project_description,
      building_name:       o.buildings?.name || null,
      created_at:          o.created_at,
      sent_at:             o.sent_at,
    }));
    setAllSentOCs(ocs);

    setSigners((signerData as Signer[]) || []);

    if (companyData) {
      const cd = companyData as { name: string; logo_url?: string; logo_print_url?: string };
      setCompanyName(cd.name || "");
      setCompanyLogoUrl(cd.logo_url || "");
      setCompanyLogoPrint(cd.logo_print_url || "");
    }

    setLoading(false);
  }

  /* ── Derivados ──────────────────────────────────────────────── */

  /** Items agrupados por reporte — para la vista expandida */
  const itemsByReportId = useMemo(() => {
    const map = new Map<string, ReportItemRow[]>();
    for (const it of reportItems) {
      if (!map.has(it.payment_report_id)) map.set(it.payment_report_id, []);
      map.get(it.payment_report_id)!.push(it);
    }
    return map;
  }, [reportItems]);

  /** Mapa purchase_order_id → payment_report_id que la reclama (para evitar colisiones) */
  const claimedByReport = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of reportItems) map.set(it.purchase_order_id, it.payment_report_id);
    return map;
  }, [reportItems]);

  /** OCs mostradas en el modal:
   *   - Todas las sent no reclamadas por ningún reporte
   *   - MÁS las ya incluidas en el reporte que se está editando */
  const availableOCsForModal = useMemo(() => {
    return allSentOCs.filter((o) => {
      const claimedBy = claimedByReport.get(o.id);
      return !claimedBy || claimedBy === editingReportId;
    });
  }, [allSentOCs, claimedByReport, editingReportId]);

  /** Semana / año / folio — recalculan al cambiar report_date */
  const week  = useMemo(() => getWeekNumber(new Date(reportDate + "T00:00:00")), [reportDate]);
  const year  = useMemo(() => new Date(reportDate + "T00:00:00").getFullYear(), [reportDate]);
  const folio = useMemo(() => `REP-S${week}-${year}`, [week, year]);

  /** OCs enviadas que aún no están en ningún reporte */
  const unreportedOCs = useMemo(() => {
    return allSentOCs.filter((o) => !claimedByReport.has(o.id));
  }, [allSentOCs, claimedByReport]);

  /** Filtro por mes seleccionado (sobre report_date) */
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const d = new Date(r.report_date + "T00:00:00");
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });
  }, [reports, selectedYear, selectedMonth]);

  /** Métricas del mes seleccionado */
  const metrics = useMemo(() => {
    const totalReports = filteredReports.length;
    const reportIds = new Set(filteredReports.map((r) => r.id));
    const totalItems = reportItems.filter((it) => reportIds.has(it.payment_report_id)).length;
    return { totalReports, totalItems };
  }, [filteredReports, reportItems]);

  /* ── Navegación de mes ──────────────────────────────────────── */

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedYear((y) => y - 1); setSelectedMonth(12); }
    else setSelectedMonth((m) => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedYear((y) => y + 1); setSelectedMonth(1); }
    else setSelectedMonth((m) => m + 1);
  }

  /* ── Expansión ──────────────────────────────────────────────── */

  function handleToggleExpand(reportId: string) {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  }

  /* ── Modal: crear / editar ──────────────────────────────────── */

  function openCreateModal() {
    const defaultSigner = signers.find((s) => s.is_default);
    setEditingReportId(null);
    setSignerName(defaultSigner?.name || "");
    setCustomSignerMode(false);
    setReportDate(todayIso());
    setItemDrafts(new Map());
    setError("");
    setShowModal(true);
  }

  function openEditModal(report: PaymentReport) {
    setEditingReportId(report.id);
    const elaboratedBy = report.elaborated_by || "";
    /* Buscar coincidencia case-insensitive y usar el nombre CANÓNICO del catálogo.
       Así el value={signerName} del select matchea <option value={s.name}>.
       Si no se encuentra, activar "Otro..." con el valor tal cual. */
    const match = elaboratedBy
      ? signers.find((s) => s.name.toLowerCase() === elaboratedBy.toLowerCase())
      : null;
    setSignerName(match ? match.name : elaboratedBy);
    setCustomSignerMode(!!elaboratedBy && !match);
    setReportDate(report.report_date);

    /* Precargar drafts desde los items existentes */
    const drafts = new Map<string, ItemDraft>();
    const items = itemsByReportId.get(report.id) || [];
    for (const it of items) {
      drafts.set(it.purchase_order_id, {
        invoice_date:   it.invoice_date   || "",
        invoice_number: it.invoice_number || "",
      });
    }
    setItemDrafts(drafts);
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingReportId(null);
    setCustomSignerMode(false);
    setError("");
  }

  /* Toggle OC en el form */
  function toggleOCInForm(ocId: string) {
    setItemDrafts((prev) => {
      const next = new Map(prev);
      if (next.has(ocId)) {
        next.delete(ocId);
      } else {
        next.set(ocId, { invoice_date: "", invoice_number: "" });
      }
      return next;
    });
  }

  function updateDraft(ocId: string, patch: Partial<ItemDraft>) {
    setItemDrafts((prev) => {
      const cur = prev.get(ocId);
      if (!cur) return prev;
      const next = new Map(prev);
      next.set(ocId, { ...cur, ...patch });
      return next;
    });
  }

  /* ── Guardar (crear o editar) ───────────────────────────────── */

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    /* ── Logs de validación ────────────────────────────────────── */
    console.log("[handleSave] user:", user);
    console.log("[handleSave] editingReportId:", editingReportId);
    console.log("[handleSave] elaboratedBy (signerName):", signerName);
    console.log("[handleSave] reportDate:", reportDate);
    console.log("[handleSave] folio computed:", folio, "week:", week, "year:", year);
    console.log("[handleSave] itemDrafts size:", itemDrafts.size, "entries:", Array.from(itemDrafts.entries()));
    console.log("[handleSave] customSignerMode:", customSignerMode);

    if (!user?.company_id) {
      console.log("[handleSave] ABORT: no company_id en user");
      return;
    }
    if (!signerName.trim()) {
      console.log("[handleSave] ABORT: signerName vacío");
      setError("Selecciona quién elaboró el reporte.");
      return;
    }
    if (itemDrafts.size === 0) {
      console.log("[handleSave] ABORT: itemDrafts vacío");
      setError("Selecciona al menos una OC.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        company_id:    user.company_id,
        folio,
        elaborated_by: signerName.trim(),
        report_date:   reportDate,
        week_number:   week,
        year:          year,
      };

      let targetId: string | null = null;

      if (editingReportId) {
        /* UPDATE reporte existente */
        const { error } = await supabase
          .from("payment_reports")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingReportId);
        if (error) throw error;
        targetId = editingReportId;

        /* Borrar items existentes para reinsertar */
        const { error: delErr } = await supabase
          .from("payment_report_items")
          .delete()
          .eq("payment_report_id", editingReportId);
        if (delErr) throw delErr;
      } else {
        /* INSERT nuevo reporte */
        const { data, error } = await supabase
          .from("payment_reports")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) throw error || new Error("No se pudo crear el reporte.");
        targetId = data.id;
      }

      /* INSERT de items */
      const itemsPayload = Array.from(itemDrafts.entries()).map(([ocId, draft]) => ({
        payment_report_id: targetId,
        purchase_order_id: ocId,
        invoice_date:      draft.invoice_date || null,
        invoice_number:    draft.invoice_number.trim() || null,
      }));
      const { error: itemsErr } = await supabase
        .from("payment_report_items")
        .insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      /* Persistir firmante nuevo si no estaba en el catálogo */
      const trimmedSigner = signerName.trim();
      if (trimmedSigner) {
        const signerExists = signers.some(
          (s) => s.name.toLowerCase() === trimmedSigner.toLowerCase()
        );
        if (!signerExists) {
          await supabase.from("purchase_order_signers").insert({
            company_id: user.company_id,
            name:       trimmedSigner,
            is_default: false,
            role:       "payer",
          });
        }
      }

      setMsg(editingReportId
        ? "Reporte actualizado correctamente."
        : "Reporte guardado correctamente.");
      setShowModal(false);
      setEditingReportId(null);
      setItemDrafts(new Map());
      void loadAll(user.company_id);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Error desconocido.";
      setError(`No se pudo guardar el reporte: ${m}`);
    }
    setSaving(false);
  }

  /* ── Archivar ──────────────────────────────────────────────── */

  async function handleArchive(report: PaymentReport) {
    if (!user?.company_id) return;
    if (!window.confirm(`¿Archivar el reporte ${report.folio}? Esta acción libera las OCs incluidas para que puedan reportarse de nuevo.`)) return;

    setArchivingId(report.id);

    /* 1. Soft-delete del reporte */
    const { error: err1 } = await supabase
      .from("payment_reports")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", report.id);
    if (err1) {
      setArchivingId(null);
      setError(`No se pudo archivar: ${err1.message}`);
      return;
    }

    /* 2. Borrar items para liberar las OCs reclamadas */
    await supabase
      .from("payment_report_items")
      .delete()
      .eq("payment_report_id", report.id);

    setArchivingId(null);
    setMsg(`Reporte ${report.folio} archivado.`);
    void loadAll(user.company_id);
  }

  /* ── Generar PDF ────────────────────────────────────────────── */

  /**
   * Genera y descarga el PDF de un reporte de envío a pagos usando html2pdf.
   * Mantiene la firma original para compatibilidad con callers existentes.
   */
  async function handleGeneratePDF(report: PaymentReport) {
    setGeneratingPdfId(report.id);
    const toastId = toast.loading("Generando PDF...");
    try {
      const items = itemsByReportId.get(report.id) || [];

      await generateReportePdf({
        folio:        report.folio,
        weekNumber:   report.week_number ?? 0,
        year:         report.year ?? new Date().getFullYear(),
        elaboratedBy: report.elaborated_by || "—",
        companyName:  (legalName || companyName || shortName || "").toString(),
        reportDate:   formatDateShort(report.report_date),
        items: items.map((it) => {
          const proj = it.oc_building_name
            ? (it.oc_project_description ? `${it.oc_building_name} · ${it.oc_project_description}` : it.oc_building_name)
            : (it.oc_project_description || "—");
          return {
            folio:         it.oc_folio || "",
            sentAt:        it.oc_sent_at ? formatDateShort(it.oc_sent_at) : "",
            invoiceDate:   it.invoice_date ? formatDateShort(it.invoice_date) : "",
            invoiceNumber: it.invoice_number || "",
            project:       proj,
          };
        }),
        logoUrl: companyLogoPrint || companyLogoUrl || undefined,
      });
      toast.dismiss(toastId);
      toast.success("PDF listo");
    } catch (err) {
      console.error("generate pdf error:", err);
      toast.dismiss(toastId);
      toast.error("Error al generar el PDF.");
    }
    setGeneratingPdfId(null);
  }

  /* ── Estilos ─────────────────────────────────────────────────── */

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

  const monthNavStyle: CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 12px", borderRadius: 12,
    border: "1px solid var(--border-default)", background: "var(--bg-card)",
  };
  const monthNavBtnStyle: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 28, borderRadius: 8,
    border: "1px solid var(--border-default)",
    background: "var(--bg-page)", color: "var(--text-secondary)",
    cursor: "pointer", flexShrink: 0,
  };
  const monthNavLabelStyle: CSSProperties = {
    fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
    minWidth: 140, textAlign: "center",
  };

  const thStyle: CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700,
    color: "var(--text-muted)", textAlign: "center",
    textTransform: "uppercase", letterSpacing: "0.04em",
    background: "var(--bg-input)",
  };
  const tdStyle: CSSProperties = {
    padding: "10px 12px", color: "var(--text-primary)",
    textAlign: "center", verticalAlign: "middle",
  };

  /* ── Render ──────────────────────────────────────────────────── */

  if (userLoading || loading) {
    return <PageContainer><p style={{ color: "var(--text-muted)" }}>Cargando...</p></PageContainer>;
  }

  const monthLabel = `${MONTH_LABELS_LONG[selectedMonth - 1]} ${selectedYear}`;

  return (
    <PageContainer>
      <PageHeader
        title="Reportes de envío a pagos"
        titleIcon={<FileText size={18} />}
        subtitle="Agrupa OCs enviadas en reportes semanales para el área de pagos."
        actions={
          <UiButton variant="primary" onClick={openCreateModal} icon={<Plus size={16} />}>
            Nuevo reporte
          </UiButton>
        }
      />

      {/* Navegador de mes */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <div style={monthNavStyle}>
          <button type="button" onClick={prevMonth} style={monthNavBtnStyle} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <span style={monthNavLabelStyle}>{monthLabel}</span>
          <button type="button" onClick={nextMonth} style={monthNavBtnStyle} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

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

      {/* Métricas */}
      <AppGrid minWidth={220} style={{ marginBottom: 20 }}>
        <MetricCard
          label="Reportes del mes"
          value={metrics.totalReports}
          variant="neutral"
          icon={<FileText size={18} />}
        />
        <MetricCard
          label="OCs incluidas"
          value={metrics.totalItems}
          variant="blue"
          icon={<ShoppingCart size={18} />}
        />
      </AppGrid>

      {/* ── OCs enviadas sin reportar ─────────────────────────── */}
      <AppCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
          OCs enviadas sin reportar a pagos ({unreportedOCs.length})
        </div>

        {unreportedOCs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--metric-value-green)", fontWeight: 600 }}>
            Todas las OCs enviadas ya están reportadas ✓
          </p>
        ) : (
          <div style={{
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            overflow: "hidden",
            maxHeight: 300,
            overflowY: "auto",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={{ ...thStyle, width: 140 }}>Folio</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Proveedor</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Proyecto</th>
                  <th style={{ ...thStyle, width: 110 }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {unreportedOCs.map((o, idx) => {
                  const project = o.building_name
                    ? (o.project_description ? `${o.building_name} · ${o.project_description}` : o.building_name)
                    : (o.project_description || "—");
                  return (
                    <tr key={o.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                      <td style={tdStyle}>{idx + 1}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700 }}>{o.folio}</td>
                      <td style={{ ...tdStyle, textAlign: "left" }}>{o.supplier_name || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "left", color: "var(--text-secondary)" }}>{project}</td>
                      <td style={tdStyle}>{formatDateShort(o.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      {/* Lista de reportes */}
      {filteredReports.length === 0 ? (
        <AppCard>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {reports.length === 0
              ? "No hay reportes. Crea el primero con el botón de arriba."
              : `No hay reportes en ${monthLabel}.`}
          </p>
        </AppCard>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredReports.map((r) => {
            const isExpanded = expandedReportId === r.id;
            const items      = itemsByReportId.get(r.id) || [];
            const weekBadge  = r.week_number != null ? `Semana ${r.week_number}` : "";

            return (
              <AppCard key={r.id} style={{ padding: 0, overflow: "hidden" }}>

                {/* Fila colapsada — clickeable */}
                <div
                  onClick={() => handleToggleExpand(r.id)}
                  style={{
                    padding: 18, cursor: "pointer",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", gap: 12, flexWrap: "wrap",
                    background: "transparent",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <AppBadge variant="gray" style={{ fontFamily: "monospace" }}>
                        {r.folio}
                      </AppBadge>
                      {weekBadge ? <AppBadge variant="blue">{weekBadge}</AppBadge> : null}
                      <AppBadge variant="gray">
                        {items.length} OC{items.length === 1 ? "" : "s"}
                      </AppBadge>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                      {r.elaborated_by || "Sin firmante"}
                    </div>

                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)" }}>
                      <span>Fecha: {formatDateShort(r.report_date)}</span>
                      <span>· Creado: {formatDateShort(r.created_at)}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    {r.pdf_url ? (
                      <a
                        href={r.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 12, color: "var(--metric-value-green)",
                          textDecoration: "none", fontWeight: 600,
                        }}
                        title="PDF guardado"
                      >
                        <CheckCircle2 size={14} />
                        PDF
                      </a>
                    ) : null}
                    <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                </div>

                {/* Vista expandida inline */}
                {isExpanded ? (
                  <div style={{
                    borderTop: "1px solid var(--border-default)",
                    padding: "16px 18px 20px",
                    display: "flex", flexDirection: "column", gap: 18,
                    background: "var(--bg-input)",
                  }}>

                    {/* Sección 1: Datos generales */}
                    <div>
                      <SectionLabel>Datos generales</SectionLabel>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                        <DetailRow label="Elaboró" value={r.elaborated_by || "—"} />
                        <DetailRow label="Empresa" value={legalName || companyName || shortName || "—"} />
                        <DetailRow label="Fecha" value={formatDateShort(r.report_date)} />
                        <DetailRow
                          label="Semana"
                          value={r.week_number != null && r.year != null ? `S${r.week_number} · ${r.year}` : "—"}
                        />
                      </div>
                    </div>

                    {/* Sección 2: Órdenes incluidas */}
                    <div>
                      <SectionLabel>Órdenes incluidas ({items.length})</SectionLabel>
                      {items.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>Sin órdenes incluidas</p>
                      ) : (
                        <div style={{
                          border: "1px solid var(--border-default)",
                          borderRadius: 10, overflow: "hidden",
                          background: "var(--bg-card)",
                        }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr>
                                <th style={{ ...thStyle, width: 36 }}>#</th>
                                <th style={{ ...thStyle, width: 100 }}>Fecha OC</th>
                                <th style={{ ...thStyle, width: 120 }}>Folio OC</th>
                                <th style={{ ...thStyle, width: 100 }}>Fecha factura</th>
                                <th style={{ ...thStyle, width: 100 }}>No. factura</th>
                                <th style={{ ...thStyle, textAlign: "left" }}>Proyecto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, idx) => {
                                const proj = it.oc_building_name
                                  ? (it.oc_project_description ? `${it.oc_building_name} · ${it.oc_project_description}` : it.oc_building_name)
                                  : (it.oc_project_description || "—");
                                return (
                                  <tr key={it.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                                    <td style={tdStyle}>{idx + 1}</td>
                                    <td style={tdStyle}>{it.oc_sent_at ? formatDateShort(it.oc_sent_at) : "—"}</td>
                                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                                      {it.oc_folio}
                                    </td>
                                    <td style={tdStyle}>{formatDateShort(it.invoice_date)}</td>
                                    <td style={tdStyle}>{it.invoice_number || "—"}</td>
                                    <td style={{ ...tdStyle, textAlign: "left", color: "var(--text-secondary)" }}>
                                      {proj}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Sección 3: Acciones */}
                    <div>
                      <SectionLabel>Acciones</SectionLabel>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleGeneratePDF(r)}
                          disabled={generatingPdfId === r.id}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "9px 14px", borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--bg-card)", color: "var(--text-primary)",
                            fontSize: 13, fontWeight: 600,
                            cursor: generatingPdfId === r.id ? "wait" : "pointer",
                            opacity: generatingPdfId === r.id ? 0.7 : 1,
                          }}
                        >
                          <FileText size={14} />
                          {generatingPdfId === r.id ? "Generando..." : "Generar PDF"}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "9px 14px", borderRadius: 8,
                            border: "1px solid var(--border-default)",
                            background: "var(--bg-card)", color: "var(--text-primary)",
                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          <Edit3 size={14} />
                          Editar reporte
                        </button>

                        <button
                          type="button"
                          onClick={() => handleArchive(r)}
                          disabled={archivingId === r.id}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "9px 14px", borderRadius: 8,
                            border: "1px solid var(--badge-text-red)",
                            background: "transparent",
                            color: "var(--badge-text-red)",
                            fontSize: 13, fontWeight: 600,
                            cursor: archivingId === r.id ? "wait" : "pointer",
                            opacity: archivingId === r.id ? 0.7 : 1,
                            marginLeft: "auto",
                          }}
                        >
                          <Trash2 size={14} />
                          {archivingId === r.id ? "Archivando..." : "Archivar"}
                        </button>
                      </div>
                    </div>

                  </div>
                ) : null}
              </AppCard>
            );
          })}
        </div>
      )}

      {/* ═══════════ Modal Nuevo / Editar reporte ═══════════ */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingReportId ? "Editar reporte" : "Nuevo reporte de envío a pagos"}
        subtitle={editingReportId ? undefined : "Selecciona las OCs a incluir en este reporte."}
        maxWidth="820px"
      >
        <form onSubmit={handleSave}>
          {/* Datos del reporte */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 8,
          }}>
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
                  <option value="__OTHER__">➕ Otro...</option>
                </select>
              )}
            </AppFormField>

            <AppFormField label="Fecha del reporte" required>
              <input
                type="date"
                style={INPUT_STYLE}
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </AppFormField>

            <AppFormField label="Folio (automático)">
              <input
                style={{ ...INPUT_STYLE, background: "var(--bg-page)", color: "var(--text-secondary)", fontFamily: "monospace" }}
                value={folio}
                readOnly
              />
            </AppFormField>
          </div>

          {/* ── Tabla 1: OCs disponibles (para agregar con checkbox) ── */}
          <div style={{ marginTop: 12, marginBottom: 18 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Órdenes de compra para incluir
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {itemDrafts.size} seleccionada{itemDrafts.size === 1 ? "" : "s"} · {availableOCsForModal.length} disponible{availableOCsForModal.length === 1 ? "" : "s"}
              </span>
            </div>

            {availableOCsForModal.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                No hay OCs enviadas pendientes de reportar.
              </p>
            ) : (
              <div style={{
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                overflow: "hidden",
                maxHeight: 280,
                overflowY: "auto",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 40 }}></th>
                      <th style={{ ...thStyle, width: 130 }}>Folio OC</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>Proveedor</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>Proyecto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableOCsForModal.map((o) => {
                      const isChecked = itemDrafts.has(o.id);
                      const project = o.building_name
                        ? (o.project_description ? `${o.building_name} · ${o.project_description}` : o.building_name)
                        : (o.project_description || "Sin proyecto");
                      return (
                        <tr
                          key={o.id}
                          onClick={() => toggleOCInForm(o.id)}
                          style={{
                            borderTop: "1px solid var(--border-default)",
                            cursor: "pointer",
                            background: isChecked ? "var(--bg-input)" : "transparent",
                          }}
                        >
                          <td style={{ ...tdStyle, padding: "8px 12px" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOCInForm(o.id)}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                accentColor: "var(--accent)",
                                width: 16, height: 16, cursor: "pointer",
                              }}
                            />
                          </td>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, padding: "8px 12px" }}>
                            {o.folio}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left", padding: "8px 12px" }}>
                            {o.supplier_name || "Sin proveedor"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left", color: "var(--text-secondary)", padding: "8px 12px",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                            {project}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Tabla 2: Detalle de facturas (solo las seleccionadas) ── */}
          {itemDrafts.size > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
                Detalle de facturas
              </div>
              <div style={{
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 130 }}>Folio OC</th>
                      <th style={{ ...thStyle, width: 150 }}>Fecha factura</th>
                      <th style={{ ...thStyle, width: 150 }}>No. factura</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>Proyecto</th>
                      <th style={{ ...thStyle, width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(itemDrafts.entries()).map(([ocId, draft]) => {
                      const oc = allSentOCs.find((x) => x.id === ocId);
                      if (!oc) return null;
                      const project = oc.building_name
                        ? (oc.project_description ? `${oc.building_name} · ${oc.project_description}` : oc.building_name)
                        : (oc.project_description || "—");
                      return (
                        <tr key={ocId} style={{ borderTop: "1px solid var(--border-default)" }}>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, padding: "8px 12px" }}>
                            {oc.folio}
                          </td>
                          <td style={{ ...tdStyle, padding: "6px 8px" }}>
                            <input
                              type="date"
                              style={{ ...INPUT_STYLE, padding: "7px 10px", fontSize: 13 }}
                              value={draft.invoice_date}
                              onChange={(e) => updateDraft(ocId, { invoice_date: e.target.value })}
                            />
                          </td>
                          <td style={{ ...tdStyle, padding: "6px 8px" }}>
                            <input
                              style={{ ...INPUT_STYLE, padding: "7px 10px", fontSize: 13 }}
                              value={draft.invoice_number}
                              onChange={(e) => updateDraft(ocId, { invoice_number: e.target.value })}
                              placeholder="A-12345"
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left", color: "var(--text-secondary)", padding: "8px 12px",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                            {project}
                          </td>
                          <td style={{ ...tdStyle, padding: "6px 8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => toggleOCInForm(ocId)}
                              aria-label="Quitar del reporte"
                              style={{
                                width: 30, height: 30, borderRadius: 8,
                                border: "1px solid var(--border-default)",
                                background: "var(--badge-bg-red)",
                                color: "var(--badge-text-red)",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center", justifyContent: "center",
                                padding: 0,
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {error ? (
            <div style={{ color: "var(--badge-text-red)", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <UiButton type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </UiButton>
            <UiButton type="submit" variant="primary" disabled={saving}>
              {saving
                ? (editingReportId ? "Guardando..." : "Creando...")
                : (editingReportId ? "Guardar cambios" : "Guardar reporte")}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}

/* ── Subcomponentes ──────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}
