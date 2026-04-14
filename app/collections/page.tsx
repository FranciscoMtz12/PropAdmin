"use client";

/*
  Cobranza — vista simplificada por mes.

  Flujo:
  - Navegar por mes con < / >
  - "Generar cobros del mes" → lee leases activos + schedules activos y crea los records faltantes
  - Auto-marca como 'overdue' los records pending con due_date pasada al montar
  - Lista agrupada por inquilino/lease — acordeón expandible
  - Marcar cobro individual o todos los cobros del inquilino como pagados (collected)
  - Cargo manual (cobro adicional o recurrente nuevo)
  - Archivado de cobros

  Lógica CFDI preservada en: lib/cfdi-import-preserved.ts
*/

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Droplets,
  FileText,
  Filter,
  Flame,
  Gem,
  House,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Upload,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import AppGrid from "@/components/AppGrid";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import SectionCard from "@/components/SectionCard";

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Building = { id: string; name: string };

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
};

type Tenant = {
  id: string;
  full_name: string;
  email: string | null;
  billing_name: string | null;
  billing_email: string | null;
  tax_id: string | null;
};

type Lease = {
  id: string;
  unit_id: string | null;
  tenant_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_tax_id: string | null;
  rent_amount: number | null;
  room_number: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

type CollectionChargeType =
  | "rent"
  | "maintenance_fee"
  | "electricity"
  | "water"
  | "gas"
  | "amenities"
  | "services"
  | "parking"
  | "penalty"
  | "other";

type CollectionStoredStatus = "pending" | "partial" | "collected" | "overdue";

type CollectionSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  charge_type: CollectionChargeType;
  title: string;
  amount_expected: number;
  due_day: number;
  active: boolean;
  notes: string | null;
};

type CollectionRecord = {
  id: string;
  collection_schedule_id: string;
  company_id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: CollectionStoredStatus;
  collected_at: string | null;
  notes: string | null;
  created_at: string;
};

type CollectionStatusFilter = "all" | "pending" | "partial" | "collected" | "overdue";
type ChargeMode = "recurring" | "one_time";

type ChargeForm = {
  chargeMode: ChargeMode;
  buildingId: string;
  unitId: string;
  leaseId: string;
  chargeType: CollectionChargeType;
  title: string;
  responsibilityType: "tenant" | "owner" | "other";
  amountExpected: string;
  dueDay: string;
  initialDueDate: string;
  notes: string;
  createFirstRecordNow: boolean;
};

type EditRecordForm = {
  recordId: string;
  amountDue: string;
  notes: string;
};

type InquilinoRow = {
  groupKey: string; // lease_id o "unit-{unit_id}"
  leaseId: string | null;
  tenantLabel: string;
  buildingId: string;
  buildingName: string;
  unitLabel: string;
  records: CollectionRecord[];
  totalDue: number;
  totalCollected: number;
  balance: number;
  estadoGeneral: CollectionStoredStatus;
};

// ── Constantes ─────────────────────────────────────────────────────────────────

const MONTH_LABELS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Helpers puros ──────────────────────────────────────────────────────────────

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getMonthLastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildDateKey(year: number, month: number, day: number) {
  const safeDay = Math.max(1, Math.min(day, getMonthLastDay(year, month)));
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function formatDate(dateKey: string | null) {
  if (!dateKey) return "Sin fecha";
  const [year, month, day] = dateKey.slice(0, 10).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return `${date.getDate()} ${MONTH_LABELS_LONG[(date.getMonth())].slice(0, 3)} ${date.getFullYear()}`;
}

function formatCurrency(amount: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDecimalInput(value: string) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const firstDot = sanitized.indexOf(".");
  if (firstDot === -1) return sanitized;
  return sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, "");
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getStatusLabel(status: CollectionStoredStatus) {
  if (status === "collected") return "Cobrado";
  if (status === "partial")   return "Parcial";
  if (status === "pending")   return "Pendiente";
  return "Vencido";
}

function getStatusColors(status: CollectionStoredStatus) {
  if (status === "collected") return { bg: "var(--badge-bg-green)",  text: "var(--badge-text-green)",  border: "var(--metric-border-green)" };
  if (status === "partial")   return { bg: "var(--metric-bg-neutral)", text: "var(--badge-text-blue)",  border: "#BFDBFE" };
  if (status === "pending")   return { bg: "#FEFCE8",                text: "#A16207",                  border: "#FDE68A" };
  return                             { bg: "var(--badge-bg-red)",    text: "var(--badge-text-red)",    border: "#FECACA" };
}

function getChargeTypeLabel(type: CollectionChargeType) {
  const map: Record<CollectionChargeType, string> = {
    rent: "Renta", maintenance_fee: "Mantenimiento", electricity: "Electricidad",
    water: "Agua", gas: "Gas", amenities: "Amenidades", services: "Servicios",
    parking: "Estacionamiento", penalty: "Penalización", other: "Otro",
  };
  return map[type] || "Otro";
}

function getChargeTypeIcon(type: CollectionChargeType) {
  if (type === "rent")            return <House size={15} color="var(--badge-text-blue)" />;
  if (type === "maintenance_fee") return <Wrench size={15} color="#D97706" />;
  if (type === "electricity")     return <Zap size={15} color="#2563EB" />;
  if (type === "water")           return <Droplets size={15} color="#0EA5E9" />;
  if (type === "gas")             return <Flame size={15} color="#EA580C" />;
  if (type === "amenities")       return <Gem size={15} color="#7C3AED" />;
  if (type === "parking")         return <CarFront size={15} color="#0F766E" />;
  if (type === "penalty")         return <AlertTriangle size={15} color="#DC2626" />;
  return                                 <Receipt size={15} color="#6D28D9" />;
}

function computeEstadoGeneral(records: CollectionRecord[]): CollectionStoredStatus {
  if (!records.length) return "pending";
  if (records.every((r) => r.status === "collected")) return "collected";
  if (records.some((r) => r.status === "overdue"))    return "overdue";
  if (records.some((r) => r.status === "partial"))    return "partial";
  // Mix: alguno cobrado + alguno sin cobrar
  if (records.some((r) => r.status === "collected"))  return "partial";
  return "pending";
}

function createDefaultChargeForm(): ChargeForm {
  const today = getTodayDateKey();
  const day = new Date().getDate();
  return {
    chargeMode: "recurring",
    buildingId: "", unitId: "", leaseId: "",
    chargeType: "rent",
    title: "",
    responsibilityType: "tenant",
    amountExpected: "",
    dueDay: String(day),
    initialDueDate: today,
    notes: "",
    createFirstRecordNow: true,
  };
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function CollectionsPage() {
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();
  const router = useRouter();

  const now = new Date();
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [buildings, setBuildings]   = useState<Building[]>([]);
  const [units, setUnits]           = useState<Unit[]>([]);
  const [tenants, setTenants]       = useState<Tenant[]>([]);
  const [leases, setLeases]         = useState<Lease[]>([]);
  const [schedules, setSchedules]   = useState<CollectionSchedule[]>([]);
  const [records, setRecords]       = useState<CollectionRecord[]>([]);

  const [loadingPage, setLoadingPage]     = useState(true);
  const [generating, setGenerating]       = useState(false);
  const [markingIds, setMarkingIds]       = useState<Set<string>>(new Set());

  const [filterBuildingId, setFilterBuildingId] = useState("all");
  const [filterStatus, setFilterStatus]         = useState<CollectionStatusFilter>("all");
  const [expandedKey, setExpandedKey]           = useState<string | null>(null);

  const [createChargeOpen, setCreateChargeOpen] = useState(false);
  const [chargeForm, setChargeForm]             = useState<ChargeForm>(createDefaultChargeForm());
  const [creatingCharge, setCreatingCharge]     = useState(false);

  const [deleteRecordId, setDeleteRecordId]   = useState<string | null>(null);
  const [deletingRecord, setDeletingRecord]   = useState(false);

  const [editRecordId, setEditRecordId]     = useState<string | null>(null);
  const [editForm, setEditForm]             = useState<EditRecordForm>({ recordId: "", amountDue: "", notes: "" });
  const [editingRecord, setEditingRecord]   = useState(false);

  const [abonoModal, setAbonoModal]         = useState<{ record: CollectionRecord; monto: string } | null>(null);
  const [abonoSaving, setAbonoSaving]       = useState(false);
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);

  const [eventoModal, setEventoModal]       = useState<{ groupKey: string; leaseId: string | null; buildingId: string; unitId: string } | null>(null);
  const [eventoForm, setEventoForm]         = useState({ concepto: "", chargeType: "amenities" as CollectionChargeType, monto: "" });
  const [eventoSaving, setEventoSaving]     = useState(false);

  // ── Cargar datos ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.company_id]);

  async function loadData() {
    if (!user?.company_id) return;
    setLoadingPage(true);

    const [buildingsRes, unitsRes, tenantsRes, leasesRes, schedulesRes, recordsRes] =
      await Promise.all([
        supabase.from("buildings").select("id, name").eq("company_id", user.company_id).is("deleted_at", null).order("name"),
        supabase.from("units").select("id, building_id, unit_number, display_code").eq("company_id", user.company_id).is("deleted_at", null),
        supabase.from("tenants").select("id, full_name, email, billing_name, billing_email, tax_id").eq("company_id", user.company_id).is("deleted_at", null),
        supabase.from("leases").select("id, unit_id, tenant_id, billing_name, billing_email, billing_tax_id, rent_amount, room_number, status, start_date, end_date").eq("company_id", user.company_id).eq("status", "ACTIVE").is("deleted_at", null),
        supabase.from("collection_schedules").select("id, building_id, unit_id, lease_id, charge_type, title, amount_expected, due_day, active, notes").eq("company_id", user.company_id).is("deleted_at", null),
        supabase.from("collection_records").select("id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, notes, created_at").eq("company_id", user.company_id).is("deleted_at", null).order("due_date"),
      ]);

    for (const res of [buildingsRes, unitsRes, tenantsRes, leasesRes, schedulesRes, recordsRes]) {
      if (res.error) {
        showToast({ type: "error", message: "Error cargando datos de cobranza." });
        setLoadingPage(false);
        return;
      }
    }

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setTenants((tenantsRes.data as Tenant[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setSchedules((schedulesRes.data as CollectionSchedule[]) || []);
    setRecords((recordsRes.data as CollectionRecord[]) || []);
    setLoadingPage(false);

    // PASO 3 — Auto-marcar vencidos
    void autoMarkOverdue();
  }

  // ── PASO 3: auto-mark overdue ─────────────────────────────────────────────────

  async function autoMarkOverdue() {
    if (!user?.company_id) return;
    await supabase
      .from("collection_records")
      .update({ status: "overdue" })
      .eq("company_id", user.company_id)
      .eq("status", "pending")
      .lt("due_date", getTodayDateKey())
      .is("deleted_at", null);
  }

  // ── PASO 1: generar cobros del mes ────────────────────────────────────────────

  async function generateMonthlyCharges(year: number, month: number) {
    if (!user?.company_id) return;
    setGenerating(true);

    // Schedules activos para leases activos
    const activeLeaseIds = new Set(leases.map((l) => l.id));
    const activeSchedules = schedules.filter(
      (s) => s.active && s.lease_id && activeLeaseIds.has(s.lease_id),
    );

    if (!activeSchedules.length) {
      showToast({ type: "warning", message: "No hay configuraciones de cobro activas asociadas a contratos activos." });
      setGenerating(false);
      return;
    }

    // Registros ya existentes este mes (fresh query para evitar race conditions)
    const { data: existingRecords } = await supabase
      .from("collection_records")
      .select("collection_schedule_id")
      .eq("company_id", user.company_id)
      .eq("period_year", year)
      .eq("period_month", month)
      .is("deleted_at", null);

    const existingScheduleIds = new Set(
      (existingRecords || []).map((r) => r.collection_schedule_id),
    );

    const today = getTodayDateKey();
    const toInsert = activeSchedules
      .filter((s) => !existingScheduleIds.has(s.id))
      .map((s) => {
        const dueDate = buildDateKey(year, month, s.due_day || 15);
        return {
          collection_schedule_id: s.id,
          company_id: user.company_id,
          building_id: s.building_id,
          unit_id: s.unit_id,
          lease_id: s.lease_id,
          period_year: year,
          period_month: month,
          due_date: dueDate,
          amount_due: s.amount_expected,
          amount_collected: 0,
          status: dueDate < today ? "overdue" : "pending",
          collected_at: null,
          payment_method: null,
          notes: null,
        };
      });

    if (!toInsert.length) {
      const monthLabel = `${MONTH_LABELS_LONG[month - 1]} ${year}`;
      showToast({ type: "success", message: `Los cobros de ${monthLabel} ya están generados.` });
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("collection_records").insert(toInsert);

    if (error) {
      showToast({ type: "error", message: `Error generando cobros: ${error.message}` });
      setGenerating(false);
      return;
    }

    await loadData();
    setGenerating(false);
    const monthLabel = `${MONTH_LABELS_LONG[month - 1]} ${year}`;
    showToast({ type: "success", message: `${toInsert.length} cobro${toInsert.length === 1 ? "" : "s"} generado${toInsert.length === 1 ? "" : "s"} para ${monthLabel}.` });
  }

  // ── Registrar abono (parcial o total) ────────────────────────────────────────

  async function handleAbono(record: CollectionRecord, monto: number) {
    if (!user?.company_id) return;
    setAbonoSaving(true);
    const prevCollected = record.amount_collected || 0;
    const newCollected  = Math.min(prevCollected + monto, record.amount_due);
    const newStatus: CollectionStoredStatus = newCollected >= record.amount_due ? "collected" : "partial";
    const newCollectedAt = newStatus === "collected" ? new Date().toISOString() : null;

    const { error } = await supabase
      .from("collection_records")
      .update({ amount_collected: newCollected, status: newStatus, collected_at: newCollectedAt })
      .eq("id", record.id)
      .eq("company_id", user.company_id);

    setAbonoSaving(false);
    if (error) {
      showToast({ type: "error", message: `No se pudo registrar el abono: ${error.message}` });
      return;
    }
    setRecords((prev) =>
      prev.map((r) => r.id === record.id
        ? { ...r, amount_collected: newCollected, status: newStatus, collected_at: newCollectedAt }
        : r
      )
    );
    setAbonoModal(null);
    showToast({ type: "success", message: newStatus === "collected" ? "Cobro marcado como pagado." : "Abono registrado." });
  }

  // ── Revertir cobro a pendiente ────────────────────────────────────────────────

  async function handleRevertRecord(record: CollectionRecord) {
    if (!user?.company_id) return;
    setMarkingIds((prev) => new Set([...prev, record.id]));
    setRevertConfirmId(null);

    const { error } = await supabase
      .from("collection_records")
      .update({ status: "pending", amount_collected: 0, collected_at: null })
      .eq("id", record.id)
      .eq("company_id", user.company_id);

    setMarkingIds((prev) => { const next = new Set(prev); next.delete(record.id); return next; });
    if (error) {
      showToast({ type: "error", message: `No se pudo revertir: ${error.message}` });
      return;
    }
    setRecords((prev) =>
      prev.map((r) => r.id === record.id ? { ...r, status: "pending", amount_collected: 0, collected_at: null } : r)
    );
    showToast({ type: "success", message: "Cobro revertido a pendiente." });
  }

  // ── Cargo eventual (único, active=false) ──────────────────────────────────────

  async function handleCreateEvento() {
    if (!eventoModal || !user?.company_id) return;
    const monto = parsePositiveNumber(eventoForm.monto);
    if (!monto) { showToast({ type: "error", message: "Ingresa un monto válido." }); return; }
    if (!eventoForm.concepto.trim()) { showToast({ type: "error", message: "Escribe un concepto." }); return; }

    setEventoSaving(true);
    const dueDay  = new Date().getDate();
    const dueDate = buildDateKey(selectedYear, selectedMonth, dueDay);
    const initialStatus: CollectionStoredStatus = dueDate < getTodayDateKey() ? "overdue" : "pending";

    const { data: schedData, error: schedError } = await supabase
      .from("collection_schedules")
      .insert({
        company_id:      user.company_id,
        building_id:     eventoModal.buildingId,
        unit_id:         eventoModal.unitId,
        lease_id:        eventoModal.leaseId,
        charge_type:     eventoForm.chargeType,
        title:           eventoForm.concepto.trim(),
        amount_expected: monto,
        due_day:         dueDay,
        active:          false,
      })
      .select("id")
      .single();

    if (schedError || !schedData) {
      showToast({ type: "error", message: `No se pudo crear el cargo: ${schedError?.message || "error desconocido"}` });
      setEventoSaving(false);
      return;
    }

    const { data: recData, error: recError } = await supabase
      .from("collection_records")
      .insert({
        company_id:               user.company_id,
        building_id:              eventoModal.buildingId,
        unit_id:                  eventoModal.unitId,
        lease_id:                 eventoModal.leaseId,
        collection_schedule_id:   schedData.id,
        period_year:              selectedYear,
        period_month:             selectedMonth,
        due_date:                 dueDate,
        amount_due:               monto,
        amount_collected:         0,
        status:                   initialStatus,
      })
      .select("id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, notes, created_at")
      .single();

    if (recError || !recData) {
      showToast({ type: "error", message: `No se pudo crear el cobro: ${recError?.message || "error desconocido"}` });
      setEventoSaving(false);
      return;
    }

    setSchedules((prev) => [...prev, {
      id: schedData.id,
      building_id:     eventoModal.buildingId,
      unit_id:         eventoModal.unitId,
      lease_id:        eventoModal.leaseId,
      charge_type:     eventoForm.chargeType,
      title:           eventoForm.concepto.trim(),
      amount_expected: monto,
      due_day:         dueDay,
      active:          false,
      notes:           null,
    }]);
    setRecords((prev) => [...prev, recData as CollectionRecord]);
    setEventoModal(null);
    setEventoForm({ concepto: "", chargeType: "amenities", monto: "" });
    setEventoSaving(false);
    showToast({ type: "success", message: "Cargo eventual registrado." });
  }

  // ── Archivar cobro ────────────────────────────────────────────────────────────

  async function handleDeleteRecord() {
    if (!deleteRecordId || !user?.company_id) return;
    setDeletingRecord(true);

    const { error } = await supabase
      .from("collection_records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteRecordId)
      .eq("company_id", user.company_id);

    setDeletingRecord(false);
    setDeleteRecordId(null);

    if (error) {
      showToast({ type: "error", message: `No se pudo archivar: ${error.message}` });
      return;
    }

    setRecords((prev) => prev.filter((r) => r.id !== deleteRecordId));
    showToast({ type: "success", message: "Cobro archivado correctamente." });
  }

  // ── Editar cobro ──────────────────────────────────────────────────────────────

  function openEditRecord(record: CollectionRecord) {
    setEditRecordId(record.id);
    setEditForm({
      recordId: record.id,
      amountDue: String(record.amount_due || ""),
      notes: record.notes || "",
    });
  }

  async function handleSaveRecordEdits() {
    if (!editRecordId || !user?.company_id) return;
    const nextAmount = parsePositiveNumber(editForm.amountDue);
    if (!nextAmount) {
      showToast({ type: "error", message: "Ingresa un monto válido." });
      return;
    }

    setEditingRecord(true);

    const { error } = await supabase
      .from("collection_records")
      .update({ amount_due: nextAmount, notes: editForm.notes.trim() || null })
      .eq("id", editRecordId)
      .eq("company_id", user.company_id);

    setEditingRecord(false);

    if (error) {
      showToast({ type: "error", message: `No se pudo actualizar: ${error.message}` });
      return;
    }

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editRecordId ? { ...r, amount_due: nextAmount, notes: editForm.notes.trim() || null } : r,
      ),
    );
    setEditRecordId(null);
    showToast({ type: "success", message: "Cobro actualizado." });
  }

  // ── Crear cargo manual ────────────────────────────────────────────────────────

  async function handleCreateCharge() {
    if (!user?.company_id) return;

    if (!chargeForm.buildingId) { showToast({ type: "error", message: "Selecciona un edificio." }); return; }
    if (!chargeForm.unitId)     { showToast({ type: "error", message: "Selecciona una unidad." }); return; }

    const amountExpected = parsePositiveNumber(chargeForm.amountExpected);
    if (!amountExpected) { showToast({ type: "error", message: "Ingresa un monto válido." }); return; }
    if (!chargeForm.title.trim()) { showToast({ type: "error", message: "Escribe el concepto del cobro." }); return; }
    if (!chargeForm.initialDueDate) { showToast({ type: "error", message: "Selecciona una fecha de vencimiento." }); return; }

    const dueDateObj = new Date(`${chargeForm.initialDueDate}T00:00:00`);
    const derivedDueDay =
      chargeForm.chargeMode === "recurring"
        ? Number(chargeForm.dueDay || dueDateObj.getDate())
        : dueDateObj.getDate();

    setCreatingCharge(true);

    const { data: insertedSchedule, error: scheduleError } = await supabase
      .from("collection_schedules")
      .insert({
        company_id: user.company_id,
        building_id: chargeForm.buildingId,
        unit_id: chargeForm.unitId,
        lease_id: chargeForm.leaseId || null,
        charge_type: chargeForm.chargeType,
        title: chargeForm.title.trim(),
        responsibility_type: chargeForm.responsibilityType,
        amount_expected: amountExpected,
        due_day: derivedDueDay,
        active: chargeForm.chargeMode === "recurring",
        notes: chargeForm.notes.trim() || null,
      })
      .select("id")
      .single();

    if (scheduleError || !insertedSchedule) {
      showToast({ type: "error", message: "No se pudo crear la configuración del cobro." });
      setCreatingCharge(false);
      return;
    }

    const shouldCreateRecord = chargeForm.chargeMode === "one_time" || chargeForm.createFirstRecordNow;

    if (shouldCreateRecord) {
      const today = getTodayDateKey();
      const { error: recordError } = await supabase.from("collection_records").insert({
        collection_schedule_id: insertedSchedule.id,
        company_id: user.company_id,
        building_id: chargeForm.buildingId,
        unit_id: chargeForm.unitId,
        lease_id: chargeForm.leaseId || null,
        period_year: dueDateObj.getFullYear(),
        period_month: dueDateObj.getMonth() + 1,
        due_date: chargeForm.initialDueDate,
        amount_due: amountExpected,
        amount_collected: 0,
        status: chargeForm.initialDueDate < today ? "overdue" : "pending",
        collected_at: null,
        payment_method: null,
        notes: chargeForm.notes.trim() || null,
      });

      if (recordError) {
        // Rollback schedule
        await supabase.from("collection_schedules").update({ deleted_at: new Date().toISOString() }).eq("id", insertedSchedule.id);
        showToast({ type: "error", message: recordError.message.includes("unique") ? "Ya existe un cobro para ese periodo." : "No se pudo crear el primer registro del cobro." });
        setCreatingCharge(false);
        return;
      }
    }

    await loadData();
    setCreatingCharge(false);
    setCreateChargeOpen(false);
    setChargeForm(createDefaultChargeForm());
    showToast({ type: "success", message: chargeForm.chargeMode === "recurring" ? "Cobro recurrente creado." : "Cargo adicional creado." });
  }

  // ── Navegación de mes ─────────────────────────────────────────────────────────

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedYear((y) => y - 1); setSelectedMonth(12); }
    else setSelectedMonth((m) => m - 1);
  }

  function nextMonth() {
    if (selectedMonth === 12) { setSelectedYear((y) => y + 1); setSelectedMonth(1); }
    else setSelectedMonth((m) => m + 1);
  }

  // ── Datos derivados ───────────────────────────────────────────────────────────

  const scheduleMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);
  const tenantMap   = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const unitMap     = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const leaseMap    = useMemo(() => new Map(leases.map((l) => [l.id, l])), [leases]);

  const monthRecords = useMemo(
    () => records.filter((r) => r.period_year === selectedYear && r.period_month === selectedMonth),
    [records, selectedYear, selectedMonth],
  );

  const inquilinoRows = useMemo<InquilinoRow[]>(() => {
    const byKey = new Map<string, CollectionRecord[]>();

    for (const record of monthRecords) {
      const key = record.lease_id || `unit-${record.unit_id}`;
      const existing = byKey.get(key) || [];
      existing.push(record);
      byKey.set(key, existing);
    }

    return Array.from(byKey.entries())
      .map(([groupKey, groupRecords]) => {
        const leaseId = groupRecords[0].lease_id;
        const lease   = leaseId ? leaseMap.get(leaseId) : null;
        const unit    = unitMap.get(groupRecords[0].unit_id);
        const building = unit ? buildingMap.get(unit.building_id) : null;
        const tenant  = lease?.tenant_id ? tenantMap.get(lease.tenant_id) : null;

        const tenantLabel  = tenant?.full_name || lease?.billing_name || lease?.billing_email || "Sin inquilino";
        const baseUnitLabel = unit ? (unit.display_code || unit.unit_number || "Unidad") : "Sin unidad";
        const roomNum = lease?.room_number;
        const unitLabel = roomNum && roomNum > 1 ? `${baseUnitLabel} · C${roomNum}` : baseUnitLabel;
        const buildingName = building?.name || "Sin edificio";
        const buildingId   = building?.id || unit?.building_id || "";

        const totalDue       = groupRecords.reduce((s, r) => s + (r.amount_due || 0), 0);
        const totalCollected = groupRecords.reduce((s, r) => s + (r.amount_collected || 0), 0);
        const balance        = Math.max(totalDue - totalCollected, 0);
        const estadoGeneral  = computeEstadoGeneral(groupRecords);

        return { groupKey, leaseId: leaseId ?? null, tenantLabel, buildingId, buildingName, unitLabel, records: groupRecords, totalDue, totalCollected, balance, estadoGeneral };
      })
      .filter((row) => {
        if (filterBuildingId !== "all" && row.buildingId !== filterBuildingId) return false;
        if (filterStatus !== "all" && row.estadoGeneral !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const order: Record<CollectionStoredStatus, number> = { overdue: 0, pending: 1, partial: 2, collected: 3 };
        return order[a.estadoGeneral] - order[b.estadoGeneral];
      });
  }, [monthRecords, leaseMap, unitMap, buildingMap, tenantMap, filterBuildingId, filterStatus]);

  // ── Métricas del mes ──────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const rows = inquilinoRows;
    const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);

    const collected = monthRecords
      .filter((r) => r.status === "collected")
      .reduce((s, r) => s + (r.amount_collected || r.amount_due || 0), 0);

    const pendiente = monthRecords
      .filter((r) => r.status === "pending" || r.status === "partial")
      .reduce((s, r) => s + Math.max((r.amount_due || 0) - (r.amount_collected || 0), 0), 0);

    const vencido = monthRecords
      .filter((r) => r.status === "overdue")
      .reduce((s, r) => s + (r.amount_due || 0), 0);

    return { totalDue, collected, pendiente, vencido };
  }, [inquilinoRows, monthRecords]);

  const donutData = useMemo(() => {
    const segments = [
      { name: "Cobrado",   value: metrics.collected, color: "#10B981" },
      { name: "Pendiente", value: metrics.pendiente, color: "#F59E0B" },
      { name: "Vencido",   value: metrics.vencido,   color: "#EF4444" },
    ].filter((s) => s.value > 0);
    return segments.length ? segments : [{ name: "Sin cobros", value: 1, color: "var(--border-strong)" }];
  }, [metrics]);

  const unitsForBuilding = useMemo(
    () => units.filter((u) => u.building_id === chargeForm.buildingId),
    [units, chargeForm.buildingId],
  );
  const leasesForUnit = useMemo(
    () => leases.filter((l) => l.unit_id === chargeForm.unitId),
    [leases, chargeForm.unitId],
  );

  const deleteRecord = deleteRecordId ? records.find((r) => r.id === deleteRecordId) : null;

  // ── Guard ─────────────────────────────────────────────────────────────────────

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>
          Cargando cobranza...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  const monthLabel = `${MONTH_LABELS_LONG[selectedMonth - 1]} ${selectedYear}`;

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      {/* ── Header ── */}
      <PageHeader
        title="Cobranza"
        titleIcon={<Wallet size={18} />}
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Navegador de mes */}
            <div style={monthNavStyle}>
              <button type="button" onClick={prevMonth} style={monthNavBtnStyle} aria-label="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <span style={monthNavLabelStyle}>{monthLabel}</span>
              <button type="button" onClick={nextMonth} style={monthNavBtnStyle} aria-label="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            </div>

            <UiButton
              onClick={() => void generateMonthlyCharges(selectedYear, selectedMonth)}
              disabled={generating}
              icon={<Zap size={15} />}
            >
              {generating ? "Generando..." : "Generar cobros del mes"}
            </UiButton>

            <UiButton
              variant="secondary"
              onClick={() => router.push("/collections/invoices")}
              icon={<FileText size={15} />}
            >
              Ver historial
            </UiButton>

            <UiButton
              variant="secondary"
              onClick={() => { setChargeForm(createDefaultChargeForm()); setCreateChargeOpen(true); }}
              icon={<Plus size={15} />}
            >
              Cargo manual
            </UiButton>
          </div>
        }
      />

      {/* ── Métricas ── */}
      <AppGrid minWidth={200}>
        <MetricCard
          label="Total a cobrar"
          value={formatCurrency(metrics.totalDue)}
          helper={monthLabel}
          icon={<Wallet size={18} />}
        />
        <MetricCard
          label="Cobrado"
          value={formatCurrency(metrics.collected)}
          helper="Pagos confirmados"
          variant="green"
          icon={<CheckCircle2 size={18} />}
        />
        <MetricCard
          label="Pendiente"
          value={formatCurrency(metrics.pendiente)}
          helper="Pendiente + parcial"
          variant="amber"
          icon={<Clock3 size={18} />}
        />
        <MetricCard
          label="Vencido"
          value={formatCurrency(metrics.vencido)}
          helper="Requiere seguimiento"
          variant="red"
          icon={<AlertCircle size={18} />}
        />
      </AppGrid>

      {/* ── Gráfica donut + accesos rápidos ── */}
      <div style={chartRowStyle}>
        {/* Donut */}
        <div style={donutCardStyle}>
          <p style={sectionLabelStyle}>Distribución del mes</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => [formatCurrency(Number(value ?? 0)), ""]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={donutLegendStyle}>
            {donutData.map((d) => (
              <div key={d.name} style={donutLegendItemStyle}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={quickLinksGridStyle}>
          <button type="button" onClick={() => router.push("/collections/reported-payments")} style={quickLinkCardStyle}>
            <div style={quickLinkIconStyle}><Upload size={18} /></div>
            <span style={quickLinkLabelStyle}>Pagos reportados</span>
          </button>
          <button type="button" onClick={() => router.push("/collections/invoice-generation")} style={quickLinkCardStyle}>
            <div style={quickLinkIconStyle}><FileText size={18} /></div>
            <span style={quickLinkLabelStyle}>Generación de facturas</span>
          </button>
          <button type="button" onClick={() => router.push("/collections/invoices")} style={quickLinkCardStyle}>
            <div style={quickLinkIconStyle}><Receipt size={18} /></div>
            <span style={quickLinkLabelStyle}>Facturas importadas</span>
          </button>
          <button type="button" onClick={() => router.push("/collections/pending-invoice-uploads")} style={quickLinkCardStyle}>
            <div style={quickLinkIconStyle}><Upload size={18} /></div>
            <span style={quickLinkLabelStyle}>Falta cargar factura</span>
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={filtersRowStyle}>
        <div style={filterFieldStyle}>
          <Building2 size={14} style={{ color: "var(--text-muted)" }} />
          <AppSelect value={filterBuildingId} onChange={(e) => setFilterBuildingId(e.target.value)}>
            <option value="all">Todos los edificios</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </AppSelect>
        </div>

        <div style={filterFieldStyle}>
          <Filter size={14} style={{ color: "var(--text-muted)" }} />
          <AppSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CollectionStatusFilter)}>
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="partial">Parcial</option>
            <option value="overdue">Vencido</option>
            <option value="collected">Cobrado</option>
          </AppSelect>
        </div>
      </div>

      {/* ── Lista de inquilinos ── */}
      <SectionCard title={`Cobros de ${monthLabel}`} icon={<Wallet size={18} />}>
        {inquilinoRows.length === 0 ? (
          <div style={emptyBoxStyle}>
            {monthRecords.length === 0
              ? `Todavía no hay cobros para ${monthLabel}. Usa "Generar cobros del mes" para crear los registros desde los contratos activos.`
              : "No hay cobros que coincidan con los filtros seleccionados."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {inquilinoRows.map((row) => {
              const isExpanded = expandedKey === row.groupKey;
              const statusColors = getStatusColors(row.estadoGeneral);

              return (
                <div key={row.groupKey} style={tenantCardStyle}>
                  {/* Fila principal — siempre visible */}
                  <div
                    style={tenantCardHeaderStyle}
                    onClick={() => setExpandedKey(isExpanded ? null : row.groupKey)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedKey(isExpanded ? null : row.groupKey); }}
                  >
                    {/* Izquierda: nombre + ubicación */}
                    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                      <span style={tenantNameStyle}>{row.tenantLabel}</span>
                      <span style={tenantSubtitleStyle}>{row.buildingName} · {row.unitLabel}</span>
                    </div>

                    {/* Centro: total + badge estado */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={totalAmountStyle}>{formatCurrency(row.totalDue)}</span>
                      <span style={{
                        ...badgeStyle,
                        background: statusColors.bg,
                        color: statusColors.text,
                        border: `1px solid ${statusColors.border}`,
                      }}>
                        {getStatusLabel(row.estadoGeneral)}
                      </span>
                    </div>

                    {/* Derecha: chevron */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={chevronWrapStyle}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Contenido expandido */}
                  {isExpanded ? (
                    <div style={expandedBodyStyle}>
                      {/* Tabla de conceptos */}
                      <div style={conceptsTableStyle}>
                        {/* Encabezado */}
                        <div style={conceptsHeaderRowStyle}>
                          <span style={thStyle}>Concepto</span>
                          <span style={{ ...thStyle, textAlign: "right" }}>Monto</span>
                          <span style={{ ...thStyle, textAlign: "center" }}>Estado</span>
                          <span style={{ ...thStyle, textAlign: "right" }}>Acción</span>
                        </div>

                        {/* Filas */}
                        {row.records.map((record) => {
                          const schedule = scheduleMap.get(record.collection_schedule_id);
                          const chargeType = (schedule?.charge_type || "other") as CollectionChargeType;
                          const conceptLabel = schedule ? getChargeTypeLabel(chargeType) : "Cobro";
                          const recColors = getStatusColors(record.status);
                          const isMarking = markingIds.has(record.id);

                          return (
                            <div key={record.id} style={conceptRowStyle}>
                              {/* Concepto */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={chargeIconWrapStyle}>{getChargeTypeIcon(chargeType)}</div>
                                <div style={{ display: "grid", gap: 2 }}>
                                  <span style={conceptNameStyle}>{conceptLabel}</span>
                                  <span style={conceptSubStyle}>Vence {formatDate(record.due_date)}</span>
                                </div>
                              </div>

                              {/* Monto — 3 líneas */}
                              <div style={{ display: "grid", gap: 2, textAlign: "right" }}>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total: {formatCurrency(record.amount_due)}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>Pagado: {formatCurrency(record.amount_collected || 0)}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: (record.amount_due - (record.amount_collected || 0)) > 0 ? "#EF4444" : "#10B981" }}>
                                  Resta: {formatCurrency(Math.max(record.amount_due - (record.amount_collected || 0), 0))}
                                </span>
                              </div>

                              {/* Estado */}
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <span style={{
                                  ...badgeStyle,
                                  fontSize: 11,
                                  padding: "4px 8px",
                                  background: recColors.bg,
                                  color: recColors.text,
                                  border: `1px solid ${recColors.border}`,
                                }}>
                                  {getStatusLabel(record.status)}
                                </span>
                              </div>

                              {/* Acción */}
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
                                {record.status !== "collected" ? (
                                  <button
                                    type="button"
                                    onClick={() => setAbonoModal({ record, monto: String(Math.max(record.amount_due - (record.amount_collected || 0), 0)) })}
                                    disabled={isMarking}
                                    style={paidBtnStyle}
                                  >
                                    <Wallet size={13} />
                                    {isMarking ? "..." : "Abonar"}
                                  </button>
                                ) : (
                                  <div style={{ position: "relative" }}>
                                    <button
                                      type="button"
                                      onClick={() => setRevertConfirmId(record.id)}
                                      disabled={isMarking}
                                      style={{ ...editBtnStyle, width: "auto", padding: "4px 9px", fontSize: 11, fontWeight: 600 }}
                                    >
                                      {isMarking ? "..." : "Revertir"}
                                    </button>
                                    {revertConfirmId === record.id ? (
                                      <div style={{
                                        position: "absolute",
                                        top: "calc(100% + 4px)",
                                        right: 0,
                                        zIndex: 10,
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border-default)",
                                        borderRadius: 12,
                                        padding: "10px 14px",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        minWidth: 160,
                                        whiteSpace: "nowrap",
                                      }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>¿Revertir pago?</span>
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); void handleRevertRecord(record); }} style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid #FECACA", background: "var(--badge-bg-red)", color: "var(--badge-text-red)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Sí</button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); setRevertConfirmId(null); }} style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>No</button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditRecord(record)}
                                  style={editBtnStyle}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteRecordId(record.id)}
                                  style={archiveBtnStyle}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pie del expand */}
                      <div style={{ ...expandFooterStyle, justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                          Saldo pendiente: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(row.balance)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventoModal({ groupKey: row.groupKey, leaseId: row.leaseId, buildingId: row.buildingId, unitId: row.records[0]?.unit_id || "" });
                            setEventoForm({ concepto: "", chargeType: "amenities", monto: "" });
                          }}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          <Plus size={13} />
                          Cargo eventual
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Modal: Cargo manual ── */}
      <Modal
        open={createChargeOpen}
        title="Nuevo cobro"
        onClose={() => { if (!creatingCharge) { setCreateChargeOpen(false); setChargeForm(createDefaultChargeForm()); } }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={formGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Tipo de cobro</span>
              <AppSelect
                value={chargeForm.chargeMode}
                onChange={(e) => setChargeForm((p) => ({ ...p, chargeMode: e.target.value as ChargeMode, createFirstRecordNow: e.target.value === "recurring" }))}
              >
                <option value="recurring">Recurrente</option>
                <option value="one_time">Único / cargo adicional</option>
              </AppSelect>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Categoría</span>
              <AppSelect value={chargeForm.chargeType} onChange={(e) => setChargeForm((p) => ({ ...p, chargeType: e.target.value as CollectionChargeType }))}>
                <option value="rent">Renta</option>
                <option value="maintenance_fee">Mantenimiento</option>
                <option value="electricity">Electricidad</option>
                <option value="water">Agua</option>
                <option value="gas">Gas</option>
                <option value="amenities">Amenidades</option>
                <option value="parking">Estacionamiento</option>
                <option value="penalty">Penalización</option>
                <option value="other">Otro</option>
              </AppSelect>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Edificio</span>
              <AppSelect
                value={chargeForm.buildingId}
                onChange={(e) => setChargeForm((p) => ({ ...p, buildingId: e.target.value, unitId: "", leaseId: "" }))}
              >
                <option value="">Selecciona un edificio</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </AppSelect>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Unidad</span>
              <AppSelect
                value={chargeForm.unitId}
                onChange={(e) => setChargeForm((p) => ({ ...p, unitId: e.target.value, leaseId: "" }))}
                disabled={!chargeForm.buildingId}
              >
                <option value="">Selecciona una unidad</option>
                {unitsForBuilding.map((u) => <option key={u.id} value={u.id}>{u.display_code || u.unit_number || "Unidad"}</option>)}
              </AppSelect>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Contrato</span>
              <AppSelect
                value={chargeForm.leaseId}
                onChange={(e) => setChargeForm((p) => ({ ...p, leaseId: e.target.value }))}
                disabled={!chargeForm.unitId}
              >
                <option value="">Sin contrato específico</option>
                {leasesForUnit.map((l) => {
                  const t = l.tenant_id ? tenantMap.get(l.tenant_id) : null;
                  return <option key={l.id} value={l.id}>{t?.full_name || l.billing_name || "Contrato"}</option>;
                })}
              </AppSelect>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Concepto</span>
              <input
                value={chargeForm.title}
                onChange={(e) => setChargeForm((p) => ({ ...p, title: e.target.value }))}
                style={inputStyle}
                placeholder="Ej. Renta abril o cargo extraordinario"
              />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Monto</span>
              <input
                value={chargeForm.amountExpected}
                onChange={(e) => setChargeForm((p) => ({ ...p, amountExpected: formatDecimalInput(e.target.value) }))}
                style={inputStyle}
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>{chargeForm.chargeMode === "recurring" ? "Primer vencimiento" : "Vencimiento"}</span>
              <input
                type="date"
                value={chargeForm.initialDueDate}
                onChange={(e) => {
                  const parsed = new Date(`${e.target.value}T00:00:00`);
                  setChargeForm((p) => ({
                    ...p,
                    initialDueDate: e.target.value,
                    dueDay: p.chargeMode === "recurring" ? String(parsed.getDate()) : p.dueDay,
                  }));
                }}
                style={inputStyle}
              />
            </label>

            {chargeForm.chargeMode === "recurring" ? (
              <>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Día de vencimiento mensual</span>
                  <AppSelect value={chargeForm.dueDay} onChange={(e) => setChargeForm((p) => ({ ...p, dueDay: e.target.value }))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>Día {d}</option>
                    ))}
                  </AppSelect>
                </label>

                <label style={{ ...fieldStyle, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={chargeForm.createFirstRecordNow}
                    onChange={(e) => setChargeForm((p) => ({ ...p, createFirstRecordNow: e.target.checked }))}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                    Crear primer cobro ahora
                  </span>
                </label>
              </>
            ) : null}
          </div>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Notas</span>
            <textarea
              value={chargeForm.notes}
              onChange={(e) => setChargeForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              style={textareaStyle}
              placeholder="Notas internas opcionales"
            />
          </label>

          <div style={modalFooterStyle}>
            <UiButton variant="secondary" onClick={() => { if (!creatingCharge) { setCreateChargeOpen(false); setChargeForm(createDefaultChargeForm()); } }}>
              Cancelar
            </UiButton>
            <UiButton onClick={handleCreateCharge} disabled={creatingCharge} icon={<Plus size={15} />}>
              {creatingCharge ? "Guardando..." : "Guardar cobro"}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Editar cobro ── */}
      <Modal
        open={Boolean(editRecordId)}
        title="Editar cobro"
        onClose={() => { if (!editingRecord) setEditRecordId(null); }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Monto</span>
            <input
              value={editForm.amountDue}
              onChange={(e) => setEditForm((p) => ({ ...p, amountDue: formatDecimalInput(e.target.value) }))}
              style={inputStyle}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Notas</span>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              style={textareaStyle}
            />
          </label>
          <div style={modalFooterStyle}>
            <UiButton variant="secondary" onClick={() => { if (!editingRecord) setEditRecordId(null); }}>Cancelar</UiButton>
            <UiButton onClick={handleSaveRecordEdits} disabled={editingRecord} icon={<Pencil size={15} />}>
              {editingRecord ? "Guardando..." : "Guardar cambios"}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Archivar cobro ── */}
      <Modal
        open={Boolean(deleteRecordId)}
        title="Archivar cobro"
        onClose={() => { if (!deletingRecord) setDeleteRecordId(null); }}
      >
        {deleteRecord ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={warningBoxStyle}>
              ¿Archivar el cobro de{" "}
              <strong>{formatCurrency(deleteRecord.amount_due)}</strong> con vencimiento{" "}
              <strong>{formatDate(deleteRecord.due_date)}</strong>? Esta acción lo ocultará del
              sistema pero conservará su información.
            </div>
            <div style={modalFooterStyle}>
              <UiButton variant="secondary" onClick={() => setDeleteRecordId(null)} disabled={deletingRecord}>Cancelar</UiButton>
              <UiButton onClick={handleDeleteRecord} disabled={deletingRecord} icon={<Trash2 size={15} />}>
                {deletingRecord ? "Archivando..." : "Archivar cobro"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Modal: Registrar abono ── */}
      <Modal
        open={Boolean(abonoModal)}
        title="Registrar abono"
        onClose={() => { if (!abonoSaving) setAbonoModal(null); }}
      >
        {abonoModal ? (
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Total del cobro:{" "}
              <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(abonoModal.record.amount_due)}</strong>
              {(abonoModal.record.amount_collected || 0) > 0 ? (
                <> · Ya abonado:{" "}
                  <strong style={{ color: "#10B981" }}>{formatCurrency(abonoModal.record.amount_collected || 0)}</strong>
                </>
              ) : null}
            </p>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Monto a abonar</span>
              <input
                value={abonoModal.monto}
                onChange={(e) => setAbonoModal((p) => p ? { ...p, monto: formatDecimalInput(e.target.value) } : p)}
                style={inputStyle}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
              />
            </label>
            <div style={modalFooterStyle}>
              <UiButton variant="secondary" onClick={() => { if (!abonoSaving) setAbonoModal(null); }}>Cancelar</UiButton>
              <UiButton
                onClick={() => {
                  const m = parsePositiveNumber(abonoModal.monto);
                  if (!m) { showToast({ type: "error", message: "Ingresa un monto válido." }); return; }
                  void handleAbono(abonoModal.record, m);
                }}
                disabled={abonoSaving}
                icon={<CheckCircle2 size={15} />}
              >
                {abonoSaving ? "Guardando..." : "Confirmar abono"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Modal: Cargo eventual ── */}
      <Modal
        open={Boolean(eventoModal)}
        title="Cargo eventual"
        onClose={() => { if (!eventoSaving) { setEventoModal(null); setEventoForm({ concepto: "", chargeType: "amenities", monto: "" }); } }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Concepto</span>
            <input
              value={eventoForm.concepto}
              onChange={(e) => setEventoForm((p) => ({ ...p, concepto: e.target.value }))}
              style={inputStyle}
              placeholder="Ej. Limpieza de terraza"
              autoFocus
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Tipo</span>
            <AppSelect
              value={eventoForm.chargeType}
              onChange={(e) => setEventoForm((p) => ({ ...p, chargeType: e.target.value as CollectionChargeType }))}
            >
              <option value="amenities">Amenidades</option>
              <option value="parking">Estacionamiento</option>
              <option value="penalty">Penalización</option>
              <option value="other">Otro</option>
            </AppSelect>
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Monto</span>
            <input
              value={eventoForm.monto}
              onChange={(e) => setEventoForm((p) => ({ ...p, monto: formatDecimalInput(e.target.value) }))}
              style={inputStyle}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <div style={modalFooterStyle}>
            <UiButton variant="secondary" onClick={() => { if (!eventoSaving) { setEventoModal(null); setEventoForm({ concepto: "", chargeType: "amenities", monto: "" }); } }}>Cancelar</UiButton>
            <UiButton onClick={handleCreateEvento} disabled={eventoSaving} icon={<Plus size={15} />}>
              {eventoSaving ? "Guardando..." : "Agregar cargo"}
            </UiButton>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const monthNavStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
};

const monthNavBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-page)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  flexShrink: 0,
};

const monthNavLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  minWidth: 120,
  textAlign: "center",
};

const chartRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px 1fr",
  gap: 16,
  marginTop: 4,
};

const donutCardStyle: CSSProperties = {
  padding: "18px 16px",
  borderRadius: 20,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  display: "grid",
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

const donutLegendStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "center",
};

const donutLegendItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const quickLinksGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const quickLinkCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 10,
  padding: "16px 14px",
  borderRadius: 16,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  cursor: "pointer",
  textAlign: "left",
};

const quickLinkIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "var(--icon-bg-neutral)",
  color: "var(--icon-color-neutral)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const quickLinkLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
};

const filtersRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 4,
};

const filterFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  flex: "1 1 200px",
  maxWidth: 280,
};

const tenantCardStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  overflow: "hidden",
};

const tenantCardHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 12,
  alignItems: "center",
  padding: "14px 16px",
  cursor: "pointer",
};

const tenantNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-primary)",
};

const tenantSubtitleStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  fontWeight: 500,
};

const totalAmountStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "var(--text-primary)",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};


const chevronWrapStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-page)",
  color: "var(--text-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const expandedBodyStyle: CSSProperties = {
  borderTop: "1px solid var(--border-default)",
  padding: "14px 16px",
  display: "grid",
  gap: 0,
};

const conceptsTableStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

const conceptsHeaderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 110px 170px",
  gap: 12,
  padding: "6px 8px",
  marginBottom: 4,
};

const thStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const conceptRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 110px 170px",
  gap: 12,
  alignItems: "center",
  padding: "10px 8px",
  borderRadius: 10,
};

const chargeIconWrapStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  background: "var(--icon-bg-neutral)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const conceptNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
};

const conceptSubStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
};

const conceptAmountStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const paidBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: 8,
  border: "1px solid var(--metric-border-green)",
  background: "var(--badge-bg-green)",
  color: "var(--badge-text-green)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const editBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-page)",
  color: "var(--text-muted)",
  cursor: "pointer",
};

const archiveBtnStyle: CSSProperties = {
  ...editBtnStyle,
  color: "var(--badge-text-red)",
  borderColor: "#FECACA",
  background: "var(--badge-bg-red)",
};

const expandFooterStyle: CSSProperties = {
  borderTop: "1px solid var(--border-default)",
  marginTop: 10,
  paddingTop: 10,
  display: "flex",
  justifyContent: "flex-end",
};

const emptyBoxStyle: CSSProperties = {
  padding: "20px 16px",
  borderRadius: 12,
  border: "1px dashed var(--border-default)",
  color: "var(--text-muted)",
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.6,
  textAlign: "center",
};

const warningBoxStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  background: "var(--metric-bg-amber)",
  border: "1px solid var(--metric-border-amber)",
  color: "var(--badge-text-amber)",
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.6,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  outline: "none",
  fontSize: 14,
  color: "var(--text-primary)",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};

const modalFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};
