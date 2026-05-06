"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle, CheckCircle, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, Clock, CreditCard, DollarSign, Droplets,
  FileText, Flame, Loader2, MapPin, Pencil, Plus, Settings, Trash2,
  TrendingUp, Wifi, Zap,
} from "lucide-react"
import toast from "react-hot-toast"

import { supabase } from "@/lib/supabaseClient"
import { useCurrentUser } from "@/contexts/UserContext"
import PageContainer from "@/components/PageContainer"
import PageHeader from "@/components/PageHeader"
import MetricCard from "@/components/MetricCard"
import SectionCard from "@/components/SectionCard"
import AppTabs from "@/components/AppTabs"
import AppEmptyState from "@/components/AppEmptyState"
import AppBadge from "@/components/AppBadge"
import AppFormField from "@/components/AppFormField"
import UiButton from "@/components/UiButton"
import Modal from "@/components/Modal"
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles"
import type {
  BuildingUtilityInvoice, PaymentReport, PaymentReportItem, ManualPayment,
} from "@/lib/types"
import { SERVICE_TYPE_LABEL } from "@/lib/types"

/* ─── Constants ──────────────────────────────────────────────────── */

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

/* ─── Local types ────────────────────────────────────────────────── */

type InvoiceRow = BuildingUtilityInvoice & {
  building_name: string
  service_type: string
  provider_name: string | null
  meter_number: string | null
}

type BuildingInvoiceGroup = {
  building_id: string
  building_name: string
  invoices: InvoiceRow[]
}

type ManualPaymentRow = ManualPayment & { building_name: string | null }

type ReportWithItems = PaymentReport & { items: PaymentReportItem[] }

type NewItemRow = { description: string; vendor_name: string; amount: string; due_date: string }

/* ─── Scalar helpers ─────────────────────────────────────────────── */

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDueDateNatural(iso: string) {
  const [y, m, d] = iso.split("-")
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/* ─── Concept icon ───────────────────────────────────────────────── */

const CONCEPT_COLORS: Record<string, string> = {
  electricity: "#f59e0b",
  gas:         "#f97316",
  water:       "#3b82f6",
  internet:    "#0ea5e9",
  other:       "#9ca3af",
  manual:      "#9ca3af",
  report:      "#8B2252",
}

function ConceptIcon({ type }: { type: string }) {
  const color = CONCEPT_COLORS[type] ?? "#9ca3af"
  const El = (() => {
    switch (type) {
      case "gas":      return <Flame size={14} />
      case "water":    return <Droplets size={14} />
      case "internet": return <Wifi size={14} />
      case "report":   return <ClipboardList size={14} />
      case "manual":   return <FileText size={14} />
      case "other":    return <Settings size={14} />
      default:         return <Zap size={14} />
    }
  })()
  return <span style={{ color, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{El}</span>
}

/* ─── Status pill ────────────────────────────────────────────────── */

type PillStatus = "paid" | "overdue" | "today" | "pending"

function getPillStatus(due_date: string | null, payment_status: string, todayStr: string): PillStatus {
  if (payment_status === "paid") return "paid"
  if (!due_date) return "pending"
  if (due_date < todayStr) return "overdue"
  if (due_date === todayStr) return "today"
  return "pending"
}

function dueDateColor(due_date: string | null, payment_status: string, todayStr: string): string {
  if (!due_date || payment_status === "paid") return "var(--text-secondary)"
  if (due_date < todayStr) return "#dc2626"
  if (due_date === todayStr) return "#ea580c"
  return "var(--text-secondary)"
}

const PILL_CONFIG: Record<PillStatus, { bg: string; label: string; Icon: React.ElementType }> = {
  paid:    { bg: "#15803d", label: "Pagado",    Icon: CheckCircle2 },
  overdue: { bg: "#dc2626", label: "Vencido",   Icon: AlertCircle  },
  today:   { bg: "#ea580c", label: "Vence hoy", Icon: Clock        },
  pending: { bg: "#d97706", label: "Pendiente", Icon: Clock        },
}

function StatusPill({ id, due_date, payment_status, todayStr, toggling, onClick }: {
  id: string
  due_date: string | null
  payment_status: string
  todayStr: string
  toggling: Set<string>
  onClick: () => void
}) {
  const status = getPillStatus(due_date, payment_status, todayStr)
  const { bg, label, Icon } = PILL_CONFIG[status]
  const isLoading = toggling.has(id)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 999, border: "none",
        background: bg, color: "#fff",
        cursor: isLoading ? "default" : "pointer",
        fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      {isLoading ? <Loader2 size={11} /> : <Icon size={11} />}
      {isLoading ? "…" : label}
    </button>
  )
}

/* ─── Table style constants ──────────────────────────────────────── */

const TH: React.CSSProperties = {
  padding: "8px 16px",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-muted)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "2px solid var(--border-default)",
  whiteSpace: "nowrap",
  background: "var(--bg-page)",
}

const TD: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--border-default)",
  fontSize: 13,
}

const CARD: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  overflow: "hidden",
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function PaymentsPage() {
  const { user, loading } = useCurrentUser()
  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]

  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [activeTab, setActiveTab] = useState("services")

  // Data
  const [invoiceGroups, setInvoiceGroups]   = useState<BuildingInvoiceGroup[]>([])
  const [reports, setReports]               = useState<ReportWithItems[]>([])
  const [manualPayments, setManualPayments] = useState<ManualPaymentRow[]>([])
  const [allBuildings, setAllBuildings]     = useState<Array<{ id: string; name: string }>>([])
  const [pageLoading, setPageLoading]       = useState(true)

  // Toggle loading tracker
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  // New report modal
  const [reportModalOpen, setReportModalOpen]         = useState(false)
  const [newReportFolio, setNewReportFolio]           = useState("")
  const [newReportDate, setNewReportDate]             = useState("")
  const [newReportElaboratedBy, setNewReportElaboratedBy] = useState("")
  const [newReportItems, setNewReportItems]           = useState<NewItemRow[]>([{ description: "", vendor_name: "", amount: "", due_date: "" }])
  const [reportPdfFile, setReportPdfFile]             = useState<File | null>(null)
  const [savingReport, setSavingReport]               = useState(false)
  const [reportMsg, setReportMsg]                     = useState("")
  const reportPdfRef = useRef<HTMLInputElement>(null)

  // Add / edit manual payment modal
  const [mpModalOpen, setMpModalOpen]   = useState(false)
  const [mpEditId, setMpEditId]         = useState<string | null>(null)
  const [mpTitle, setMpTitle]           = useState("")
  const [mpBuildingId, setMpBuildingId] = useState("")
  const [mpAmount, setMpAmount]         = useState("")
  const [mpDueDate, setMpDueDate]       = useState("")
  const [savingMp, setSavingMp]         = useState(false)
  const [mpMsg, setMpMsg]               = useState("")

  useEffect(() => {
    if (user?.company_id) void loadData()
  }, [user, year, month])

  function navMonth(delta: number) {
    let m = month + delta, y = year
    if (m < 1)  { m = 12; y-- }
    if (m > 12) { m = 1;  y++ }
    setMonth(m); setYear(y)
  }

  async function loadData() {
    if (!user?.company_id) return
    setPageLoading(true)
    const cid = user.company_id

    const padM = String(month).padStart(2, "0")
    const nm   = month === 12 ? 1 : month + 1
    const ny   = month === 12 ? year + 1 : year
    const startDate = `${year}-${padM}-01`
    const endDate   = `${ny}-${String(nm).padStart(2, "0")}-01`

    const [invRes, mpRes, rptRes, bldRes] = await Promise.all([
      supabase.from("building_utility_invoices")
        .select("*")
        .eq("company_id", cid)
        .eq("period_year", year)
        .eq("period_month", month)
        .in("status", ["distributed", "charged"])
        .is("deleted_at", null),
      supabase.from("manual_payments")
        .select("*")
        .eq("company_id", cid)
        .eq("period_year", year)
        .eq("period_month", month)
        .is("deleted_at", null),
      supabase.from("payment_reports")
        .select("*")
        .eq("company_id", cid)
        .gte("report_date", startDate)
        .lt("report_date", endDate)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("buildings")
        .select("id, name")
        .eq("company_id", cid)
        .is("deleted_at", null)
        .order("name"),
    ])

    const invoiceList  = (invRes.data  || []) as BuildingUtilityInvoice[]
    const mpList       = (mpRes.data   || []) as ManualPayment[]
    const reportList   = (rptRes.data  || []) as PaymentReport[]
    const buildingList = (bldRes.data  || []) as Array<{ id: string; name: string }>

    setAllBuildings(buildingList)
    const buildingMap: Record<string, string> = {}
    buildingList.forEach(b => { buildingMap[b.id] = b.name })

    const meterIds  = [...new Set(invoiceList.map(i => i.building_utility_meter_id))]
    const reportIds = reportList.map(r => r.id)

    const [mRes, itemsRes] = await Promise.all([
      meterIds.length > 0
        ? supabase.from("building_utility_meters")
            .select("id, service_type, provider_name, meter_number")
            .in("id", meterIds)
        : Promise.resolve({ data: [] }),
      reportIds.length > 0
        ? supabase.from("payment_report_items")
            .select("*")
            .in("payment_report_id", reportIds)
            .order("created_at")
        : Promise.resolve({ data: [] }),
    ])

    type MeterSnap = { id: string; service_type: string; provider_name: string | null; meter_number: string | null }
    const meterMap: Record<string, MeterSnap> = {}
    ;((mRes.data || []) as MeterSnap[]).forEach(m => { meterMap[m.id] = m })

    const enriched: InvoiceRow[] = invoiceList.map(inv => ({
      ...inv,
      building_name: buildingMap[inv.building_id] ?? inv.building_id,
      service_type:  meterMap[inv.building_utility_meter_id]?.service_type ?? "other",
      provider_name: meterMap[inv.building_utility_meter_id]?.provider_name ?? null,
      meter_number:  meterMap[inv.building_utility_meter_id]?.meter_number ?? null,
    }))

    const groupMap = new Map<string, BuildingInvoiceGroup>()
    for (const inv of enriched) {
      const g = groupMap.get(inv.building_id) ?? {
        building_id: inv.building_id, building_name: inv.building_name, invoices: [],
      }
      g.invoices.push(inv)
      groupMap.set(inv.building_id, g)
    }
    setInvoiceGroups([...groupMap.values()])

    setManualPayments(mpList.map(mp => ({
      ...mp,
      building_name: mp.building_id ? (buildingMap[mp.building_id] ?? null) : null,
    })))

    const itemsByReport = new Map<string, PaymentReportItem[]>()
    ;((itemsRes.data || []) as PaymentReportItem[]).forEach(item => {
      const arr = itemsByReport.get(item.payment_report_id) ?? []
      arr.push(item)
      itemsByReport.set(item.payment_report_id, arr)
    })
    setReports(reportList.map(r => ({ ...r, items: itemsByReport.get(r.id) ?? [] })))

    setPageLoading(false)
  }

  /* ── Invoice toggle ──────────────────────────────────────────────── */

  async function toggleInvoice(inv: InvoiceRow) {
    setToggling(prev => new Set(prev).add(inv.id))
    const nowPaid = inv.payment_status === "paid"
    const { error } = await supabase.from("building_utility_invoices").update({
      payment_status: nowPaid ? "unpaid" : "paid",
      paid_at:        nowPaid ? null : new Date().toISOString(),
    }).eq("id", inv.id)
    if (error) toast.error("Error al actualizar")
    else toast.success(nowPaid ? "Marcado como pendiente" : "Marcado como pagado")
    setToggling(prev => { const s = new Set(prev); s.delete(inv.id); return s })
    void loadData()
  }

  /* ── Report item toggle ──────────────────────────────────────────── */

  async function toggleReportItem(item: PaymentReportItem, report: ReportWithItems) {
    setToggling(prev => new Set(prev).add(item.id))
    const nowPaid = item.payment_status === "paid"
    const { error } = await supabase.from("payment_report_items").update({
      payment_status: nowPaid ? "unpaid" : "paid",
      paid_at:        nowPaid ? null : new Date().toISOString(),
    }).eq("id", item.id)
    if (error) { toast.error("Error al actualizar") }
    else {
      if (!nowPaid) {
        const allPaid = report.items.every(i => i.id === item.id || i.payment_status === "paid")
        if (allPaid) await supabase.from("payment_reports").update({ status: "paid" }).eq("id", report.id)
      } else {
        await supabase.from("payment_reports").update({ status: "pending" }).eq("id", report.id)
      }
      toast.success(nowPaid ? "Marcado como pendiente" : "Marcado como pagado")
    }
    setToggling(prev => { const s = new Set(prev); s.delete(item.id); return s })
    void loadData()
  }

  async function markAllReportPaid(report: ReportWithItems) {
    const now = new Date().toISOString()
    for (const item of report.items.filter(i => i.payment_status === "unpaid")) {
      await supabase.from("payment_report_items")
        .update({ payment_status: "paid", paid_at: now })
        .eq("id", item.id)
    }
    await supabase.from("payment_reports").update({ status: "paid" }).eq("id", report.id)
    toast.success("Reporte marcado como pagado")
    void loadData()
  }

  /* ── Manual payment toggle / delete ─────────────────────────────── */

  async function toggleManual(mp: ManualPaymentRow) {
    setToggling(prev => new Set(prev).add(mp.id))
    const nowPaid = mp.payment_status === "paid"
    await supabase.from("manual_payments").update({
      payment_status: nowPaid ? "unpaid" : "paid",
      paid_at:        nowPaid ? null : new Date().toISOString(),
    }).eq("id", mp.id)
    toast.success(nowPaid ? "Marcado como pendiente" : "Marcado como pagado")
    setToggling(prev => { const s = new Set(prev); s.delete(mp.id); return s })
    void loadData()
  }

  async function deleteManual(id: string) {
    await supabase.from("manual_payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
    toast.success("Pago eliminado")
    void loadData()
  }

  /* ── Create report ───────────────────────────────────────────────── */

  function openReportModal() {
    const today = new Date()
    const week  = getWeekNumber(today)
    setNewReportFolio(`RPG-${today.getFullYear()}-${week}`)
    setNewReportDate(today.toISOString().split("T")[0])
    setNewReportElaboratedBy("")
    setNewReportItems([{ description: "", vendor_name: "", amount: "", due_date: todayStr }])
    setReportPdfFile(null)
    setReportMsg("")
    setReportModalOpen(true)
  }

  async function handleCreateReport(e: React.FormEvent) {
    e.preventDefault()
    setReportMsg("")
    const invalid = newReportItems.some(i => !i.description.trim() || !i.amount)
    if (invalid) { setReportMsg("Completa descripción y monto en todos los items."); return }

    setSavingReport(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const today = new Date(newReportDate || new Date().toISOString().split("T")[0])
      const week  = getWeekNumber(today)

      let pdfPath: string | null = null
      if (reportPdfFile) {
        const ext  = reportPdfFile.name.split(".").pop() || "pdf"
        const path = `${user!.company_id}/${today.getFullYear()}/${week}-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from("payment-reports").upload(path, reportPdfFile, { upsert: false })
        if (!error) pdfPath = path
      }

      const { data: rData, error: rErr } = await supabase.from("payment_reports").insert({
        company_id:    user!.company_id,
        folio:         newReportFolio.trim() || null,
        week_number:   week,
        year:          today.getFullYear(),
        report_date:   newReportDate || today.toISOString().split("T")[0],
        elaborated_by: newReportElaboratedBy.trim() || null,
        pdf_path:      pdfPath,
        status:        "pending",
        created_by:    authUser?.id ?? null,
      }).select("id").single()

      if (rErr || !rData) { setReportMsg(`Error: ${rErr?.message ?? "Sin respuesta"}`); return }
      const reportId = (rData as { id: string }).id

      const items = newReportItems.map(i => ({
        payment_report_id: reportId,
        description:       i.description.trim(),
        vendor_name:       i.vendor_name.trim() || null,
        amount:            parseFloat(i.amount),
        due_date:          i.due_date || null,
        payment_status:    "unpaid" as const,
        paid_at:           null,
        notes:             null,
        purchase_order_id: null,
      }))
      await supabase.from("payment_report_items").insert(items)

      toast.success("Reporte creado")
      setReportModalOpen(false)
      void loadData()
    } finally {
      setSavingReport(false)
    }
  }

  /* ── Create / edit manual payment ───────────────────────────────── */

  function openMpModal(mp?: ManualPaymentRow) {
    if (mp) {
      setMpEditId(mp.id)
      setMpTitle(mp.title)
      setMpBuildingId(mp.building_id ?? "")
      setMpAmount(String(mp.amount))
      setMpDueDate(mp.due_date ?? todayStr)
    } else {
      setMpEditId(null)
      setMpTitle(""); setMpBuildingId(""); setMpAmount("")
      setMpDueDate(todayStr)
    }
    setMpMsg("")
    setMpModalOpen(true)
  }

  async function handleSaveManualPayment(e: React.FormEvent) {
    e.preventDefault()
    setMpMsg("")
    if (!mpTitle.trim()) { setMpMsg("El título es obligatorio."); return }
    if (!mpAmount || isNaN(parseFloat(mpAmount))) { setMpMsg("El monto es obligatorio."); return }

    setSavingMp(true)
    try {
      if (mpEditId) {
        const { error } = await supabase.from("manual_payments").update({
          title:        mpTitle.trim(),
          building_id:  mpBuildingId || null,
          amount:       parseFloat(mpAmount),
          due_date:     mpDueDate || null,
          period_year:  year,
          period_month: month,
        }).eq("id", mpEditId)
        if (error) { setMpMsg(`Error: ${error.message}`); return }
        toast.success("Pago actualizado")
      } else {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        const { error } = await supabase.from("manual_payments").insert({
          company_id:        user!.company_id,
          building_id:       mpBuildingId || null,
          title:             mpTitle.trim(),
          amount:            parseFloat(mpAmount),
          due_date:          mpDueDate || null,
          period_year:       year,
          period_month:      month,
          payment_status:    "unpaid",
          paid_at:           null,
          payment_report_id: null,
          created_by:        authUser?.id ?? null,
        })
        if (error) { setMpMsg(`Error: ${error.message}`); return }
        toast.success("Pago agregado")
      }
      setMpModalOpen(false)
      void loadData()
    } finally {
      setSavingMp(false)
    }
  }

  /* ── Metrics ─────────────────────────────────────────────────────── */

  const allInvoices    = invoiceGroups.flatMap(g => g.invoices)
  const unpaidInvoices = allInvoices.filter(i => i.payment_status === "unpaid")
  const paidInvoices   = allInvoices.filter(i => i.payment_status === "paid")
  const unpaidManual   = manualPayments.filter(m => m.payment_status === "unpaid")
  const paidManual     = manualPayments.filter(m => m.payment_status === "paid")

  const pendingCount = unpaidInvoices.length + unpaidManual.length
  const paidCount    = paidInvoices.length   + paidManual.length
  const totalPending = unpaidInvoices.reduce((s, i) => s + Number(i.total_amount), 0) + unpaidManual.reduce((s, m) => s + Number(m.amount), 0)
  const totalPaid    = paidInvoices.reduce((s, i)   => s + Number(i.total_amount), 0) + paidManual.reduce((s, m)   => s + Number(m.amount), 0)

  if (loading || !user) return null

  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader
        title="Pagos"
        titleIcon={<CreditCard size={20} />}
        subtitle="Control de pagos de servicios y compras"
      />

      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        <button type="button" onClick={() => navMonth(-1)} style={{ width: 36, height: 36, borderRadius: "8px 0 0 8px", border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ padding: "0 24px", height: 36, display: "flex", alignItems: "center", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-card)", fontSize: 14, fontWeight: 700, minWidth: 160, justifyContent: "center" }}>
          {periodLabel}
        </div>
        <button type="button" onClick={() => navMonth(1)} style={{ width: 36, height: 36, borderRadius: "0 8px 8px 0", border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <MetricCard label="Pendientes de pagar" value={pageLoading ? "…" : pendingCount} icon={<Clock size={18} />} variant={pendingCount > 0 ? "amber" : "green"} />
        <MetricCard label="Pagados" value={pageLoading ? "…" : paidCount} icon={<CheckCircle size={18} />} variant={paidCount > 0 ? "green" : "neutral"} />
        <MetricCard label="Total pendiente" value={pageLoading ? "…" : formatMXN(totalPending)} icon={<DollarSign size={18} />} variant={totalPending > 0 ? "amber" : "green"} />
        <MetricCard label="Total pagado" value={pageLoading ? "…" : formatMXN(totalPaid)} icon={<TrendingUp size={18} />} variant={totalPaid > 0 ? "green" : "neutral"} />
      </div>

      {/* Tabs */}
      <AppTabs
        items={[
          { key: "services", label: "Servicios" },
          { key: "reports",  label: "Reportes de compras" },
          { key: "manual",   label: "Manuales" },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
      />

      <div style={{ marginTop: 20 }}>

        {/* ── TAB 1: SERVICIOS ─────────────────────────────────────── */}
        {activeTab === "services" && (
          <>
            {pageLoading ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
            ) : allInvoices.length === 0 ? (
              <AppEmptyState
                title="No hay facturas de servicios en este período"
                description="Las facturas aparecen cuando tienen estado 'Distribuida' o 'Cobrada' en el módulo de Servicios."
              />
            ) : (
              <div style={CARD}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={TH}>Concepto</th>
                        <th style={TH}>Edificio</th>
                        <th style={TH}>Fecha límite</th>
                        <th style={{ ...TH, textAlign: "right" }}>Monto</th>
                        <th style={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allInvoices.map(inv => {
                        const sub = [inv.provider_name, inv.meter_number].filter(Boolean).join(" · ")
                        return (
                          <tr
                            key={inv.id}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-page)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={TD}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <ConceptIcon type={inv.service_type} />
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                    {SERVICE_TYPE_LABEL[inv.service_type as keyof typeof SERVICE_TYPE_LABEL] ?? inv.service_type}
                                  </div>
                                  {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ ...TD, color: "var(--text-secondary)" }}>{inv.building_name}</td>
                            <td style={{ ...TD, color: dueDateColor(inv.due_date ?? null, inv.payment_status, todayStr) }}>
                              {inv.due_date ? formatDueDateNatural(inv.due_date) : "—"}
                            </td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>
                              {formatMXN(Number(inv.total_amount))}
                            </td>
                            <td style={TD}>
                              <StatusPill
                                id={inv.id}
                                due_date={inv.due_date ?? null}
                                payment_status={inv.payment_status}
                                todayStr={todayStr}
                                toggling={toggling}
                                onClick={() => void toggleInvoice(inv)}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-default)" }}>
                  Pendiente: <strong>{formatMXN(unpaidInvoices.reduce((s, i) => s + Number(i.total_amount), 0))}</strong>
                  {" · "}
                  Pagado: <strong>{formatMXN(paidInvoices.reduce((s, i) => s + Number(i.total_amount), 0))}</strong>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: REPORTES DE COMPRAS ───────────────────────────── */}
        {activeTab === "reports" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <UiButton variant="primary" icon={<Plus size={15} />} onClick={openReportModal}>
                Nuevo reporte
              </UiButton>
            </div>
            {pageLoading ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
            ) : reports.length === 0 ? (
              <AppEmptyState
                title="No hay reportes de compras en este período"
                description="Crea un reporte semanal para registrar los pagos de compras."
                actionLabel="+ Nuevo reporte"
                onAction={openReportModal}
              />
            ) : (
              <div style={{ display: "grid", gap: 20 }}>
                {reports.map(report => {
                  const total      = report.items.reduce((s, i) => s + Number(i.amount), 0)
                  const hasPending = report.items.some(i => i.payment_status === "unpaid")
                  const statusVariant = report.status === "paid" ? "green" : report.status === "cancelled" ? "gray" : "amber"
                  const statusLabel   = report.status === "paid" ? "Pagado" : report.status === "cancelled" ? "Cancelado" : "Pendiente"
                  return (
                    <SectionCard
                      key={report.id}
                      title={`Reporte ${report.folio ?? report.id.slice(0, 8)}`}
                      subtitle={[
                        report.week_number ? `Semana ${report.week_number}` : null,
                        report.report_date ? formatDate(report.report_date) : null,
                        report.elaborated_by ? `— ${report.elaborated_by}` : null,
                      ].filter(Boolean).join(" · ")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        <AppBadge variant={statusVariant}>{statusLabel}</AppBadge>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{report.items.length} items</span>
                      </div>

                      {report.items.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin items registrados.</p>
                      ) : (
                        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-default)" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr>
                                <th style={TH}>Concepto</th>
                                <th style={TH}>Proveedor</th>
                                <th style={TH}>Fecha límite</th>
                                <th style={{ ...TH, textAlign: "right" }}>Monto</th>
                                <th style={TH}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.items.map(item => (
                                <tr
                                  key={item.id}
                                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-page)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                >
                                  <td style={TD}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <ConceptIcon type="report" />
                                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.description}</span>
                                    </div>
                                  </td>
                                  <td style={{ ...TD, color: "var(--text-secondary)" }}>{item.vendor_name ?? "—"}</td>
                                  <td style={{ ...TD, color: dueDateColor(item.due_date ?? null, item.payment_status, todayStr) }}>
                                    {item.due_date ? formatDueDateNatural(item.due_date) : "—"}
                                  </td>
                                  <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>
                                    {formatMXN(Number(item.amount))}
                                  </td>
                                  <td style={TD}>
                                    <StatusPill
                                      id={item.id}
                                      due_date={item.due_date ?? null}
                                      payment_status={item.payment_status}
                                      todayStr={todayStr}
                                      toggling={toggling}
                                      onClick={() => void toggleReportItem(item, report)}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "var(--bg-page)" }}>
                                <td colSpan={3} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>Total</td>
                                <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>
                                  {formatMXN(total)}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  {hasPending && (
                                    <button
                                      type="button"
                                      onClick={() => void markAllReportPaid(report)}
                                      style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "none", background: "#8B2252", color: "#fff", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                                    >
                                      Marcar todo pagado
                                    </button>
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </SectionCard>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── TAB 3: MANUALES ─────────────────────────────────────── */}
        {activeTab === "manual" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <UiButton variant="primary" icon={<Plus size={15} />} onClick={() => openMpModal()}>
                Agregar pago
              </UiButton>
            </div>
            {pageLoading ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p>
            ) : manualPayments.length === 0 ? (
              <AppEmptyState
                title="No hay pagos manuales en este período"
                description="Agrega pagos que no tienen origen automático."
                actionLabel="+ Agregar pago manual"
                onAction={() => openMpModal()}
              />
            ) : (
              <div style={CARD}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={TH}>Concepto</th>
                        <th style={TH}>Edificio</th>
                        <th style={TH}>Fecha límite</th>
                        <th style={{ ...TH, textAlign: "right" }}>Monto</th>
                        <th style={TH}>Status</th>
                        <th style={TH}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualPayments.map(mp => (
                        <tr
                          key={mp.id}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-page)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={TD}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <ConceptIcon type="manual" />
                              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{mp.title}</span>
                            </div>
                          </td>
                          <td style={{ ...TD, color: "var(--text-secondary)" }}>{mp.building_name ?? "—"}</td>
                          <td style={{ ...TD, color: dueDateColor(mp.due_date ?? null, mp.payment_status, todayStr) }}>
                            {mp.due_date ? formatDueDateNatural(mp.due_date) : "—"}
                          </td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>
                            {formatMXN(Number(mp.amount))}
                          </td>
                          <td style={TD}>
                            <StatusPill
                              id={mp.id}
                              due_date={mp.due_date ?? null}
                              payment_status={mp.payment_status}
                              todayStr={todayStr}
                              toggling={toggling}
                              onClick={() => void toggleManual(mp)}
                            />
                          </td>
                          <td style={TD}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => openMpModal(mp)}
                                style={{ display: "inline-flex", alignItems: "center", padding: 6, borderRadius: 6, border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteManual(mp.id)}
                                style={{ display: "inline-flex", alignItems: "center", padding: 6, borderRadius: 6, border: "1px solid #dc2626", background: "transparent", cursor: "pointer", color: "#dc2626" }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-default)" }}>
                  Pendiente: <strong>{formatMXN(unpaidManual.reduce((s, m) => s + Number(m.amount), 0))}</strong>
                  {" · "}
                  Pagado: <strong>{formatMXN(paidManual.reduce((s, m) => s + Number(m.amount), 0))}</strong>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Nuevo reporte ────────────────────────────────────── */}
      <Modal open={reportModalOpen} onClose={() => setReportModalOpen(false)} title="Nuevo reporte de compras" maxWidth="680px">
        <form onSubmit={handleCreateReport}>
          {reportMsg && <p style={{ ...errorBannerStyle, marginBottom: 14 }}>{reportMsg}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <AppFormField label="Folio">
              <input value={newReportFolio} onChange={e => setNewReportFolio(e.target.value)} placeholder="RPG-2026-18" style={INPUT_STYLE} />
            </AppFormField>
            <AppFormField label="Fecha del reporte">
              <input type="date" value={newReportDate} onChange={e => setNewReportDate(e.target.value)} style={INPUT_STYLE} />
            </AppFormField>
          </div>

          <AppFormField label="Elaborado por (opcional)">
            <input value={newReportElaboratedBy} onChange={e => setNewReportElaboratedBy(e.target.value)} placeholder="Nombre del responsable" style={INPUT_STYLE} />
          </AppFormField>

          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Items *</p>
            <div style={{ display: "grid", gap: 8 }}>
              {newReportItems.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 110px 130px 32px", gap: 8, alignItems: "center" }}>
                  <input
                    placeholder="Descripción *"
                    value={item.description}
                    onChange={e => setNewReportItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                    style={{ ...INPUT_STYLE, fontSize: 13 }}
                  />
                  <input
                    placeholder="Proveedor"
                    value={item.vendor_name}
                    onChange={e => setNewReportItems(prev => prev.map((it, i) => i === idx ? { ...it, vendor_name: e.target.value } : it))}
                    style={{ ...INPUT_STYLE, fontSize: 13 }}
                  />
                  <input
                    type="number"
                    placeholder="Monto *"
                    value={item.amount}
                    onChange={e => setNewReportItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))}
                    style={{ ...INPUT_STYLE, fontSize: 13 }}
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="date"
                    value={item.due_date}
                    onChange={e => setNewReportItems(prev => prev.map((it, i) => i === idx ? { ...it, due_date: e.target.value } : it))}
                    style={{ ...INPUT_STYLE, fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewReportItems(prev => prev.filter((_, i) => i !== idx))}
                    disabled={newReportItems.length === 1}
                    style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #dc2626", background: "transparent", color: "#dc2626", cursor: newReportItems.length === 1 ? "default" : "pointer", opacity: newReportItems.length === 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNewReportItems(prev => [...prev, { description: "", vendor_name: "", amount: "", due_date: todayStr }])}
              style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", cursor: "pointer" }}
            >
              <Plus size={13} /> Agregar item
            </button>
          </div>

          <AppFormField label="PDF del reporte (opcional)">
            <input ref={reportPdfRef} type="file" accept=".pdf,image/*" onChange={e => setReportPdfFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            <div
              onClick={() => reportPdfRef.current?.click()}
              style={{ padding: "14px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: `2px dashed ${reportPdfFile ? "#15803d" : "var(--border-default)"}`, background: reportPdfFile ? "#dcfce7" : "var(--bg-card)" }}
            >
              <span style={{ fontSize: 13, color: reportPdfFile ? "#15803d" : "var(--text-muted)", fontWeight: reportPdfFile ? 600 : 400, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} />{reportPdfFile ? reportPdfFile.name : "Toca para adjuntar PDF"}
              </span>
            </div>
          </AppFormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setReportModalOpen(false)} disabled={savingReport}>Cancelar</UiButton>
            <UiButton type="submit" variant="primary" disabled={savingReport}>
              {savingReport ? "Guardando..." : "Crear reporte"}
            </UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Agregar / Editar pago manual ────────────────────── */}
      <Modal open={mpModalOpen} onClose={() => setMpModalOpen(false)} title={mpEditId ? "Editar pago" : "Agregar pago manual"} maxWidth="480px">
        <form onSubmit={handleSaveManualPayment}>
          {mpMsg && <p style={{ ...errorBannerStyle, marginBottom: 14 }}>{mpMsg}</p>}

          <AppFormField label="Título *">
            <input value={mpTitle} onChange={e => setMpTitle(e.target.value)} placeholder="Ej. Mantenimiento bomba de agua" style={INPUT_STYLE} autoFocus />
          </AppFormField>

          <AppFormField label="Edificio (opcional)">
            <select value={mpBuildingId} onChange={e => setMpBuildingId(e.target.value)} style={{ ...INPUT_STYLE, appearance: "none" }}>
              <option value="">— Sin edificio —</option>
              {allBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </AppFormField>

          <AppFormField label="Monto *">
            <input type="number" value={mpAmount} onChange={e => setMpAmount(e.target.value)} placeholder="0.00" style={INPUT_STYLE} step="0.01" min="0" />
          </AppFormField>

          <AppFormField label="Fecha límite de pago *">
            <input type="date" value={mpDueDate} onChange={e => setMpDueDate(e.target.value)} style={INPUT_STYLE} required />
          </AppFormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <UiButton type="button" variant="secondary" onClick={() => setMpModalOpen(false)} disabled={savingMp}>Cancelar</UiButton>
            <UiButton type="submit" variant="primary" disabled={savingMp}>
              {savingMp ? "Guardando..." : mpEditId ? "Guardar cambios" : "Agregar"}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  )
}
