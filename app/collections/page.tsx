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
  Filter,
  Flame,
  Gem,
  House,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Search,
  Wallet,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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

/** Tipos de cobro con monto variable — se generan con amount_due = 0 */
const VARIABLE_CHARGE_TYPES = new Set<CollectionChargeType>(["electricity", "water", "gas"]);

/** Orden de presentación de conceptos dentro de cada grupo */
const CHARGE_ORDER: Partial<Record<CollectionChargeType, number>> = {
  rent: 1, parking: 2, electricity: 3, water: 4, gas: 5, amenities: 6, other: 99,
};

/** Colores para identificar edificios por borde izquierdo */
const BUILDING_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
  "#06B6D4", "#A855F7",
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

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

const positiveAmountString = () =>
  z
    .string()
    .min(1, "Ingresa un monto válido")
    .refine((v) => parsePositiveNumber(v) !== null, {
      message: "Ingresa un monto válido",
    });

const collectionsErrorTextStyle: CSSProperties = {
  color: "#EF4444",
  fontSize: 12,
  marginTop: 4,
  marginBottom: 0,
};

const editRecordSchema = z.object({
  amountDue: positiveAmountString(),
  notes: z.string().optional(),
});
type EditRecordFormValues = z.infer<typeof editRecordSchema>;

const abonoSchema = z.object({
  monto: positiveAmountString(),
});
type AbonoFormValues = z.infer<typeof abonoSchema>;

const eventoSchema = z.object({
  concepto: z.string().min(1, "Escribe un concepto"),
  chargeType: z.enum(["amenities", "parking", "penalty", "other"]),
  monto: positiveAmountString(),
});
type EventoFormValues = z.infer<typeof eventoSchema>;

const capturaSchema = z.object({
  monto: positiveAmountString(),
  unidades: z.string().optional(),
  notas: z.string().optional(),
});
type CapturaFormValues = z.infer<typeof capturaSchema>;

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

// ── Componente principal ───────────────────────────────────────────────────────

export default function CollectionsPage() {
  const { user, loading } = useCurrentUser();

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

  const [deleteRecordId, setDeleteRecordId]   = useState<string | null>(null);
  const [deletingRecord, setDeletingRecord]   = useState(false);

  const [editRecordId, setEditRecordId]     = useState<string | null>(null);
  const editForm = useForm<EditRecordFormValues>({
    resolver: zodResolver(editRecordSchema),
    defaultValues: { amountDue: "", notes: "" },
  });

  /* Abono: contexto (qué registro se abona) separado del formulario (monto). */
  const [abonoRecord, setAbonoRecord]       = useState<CollectionRecord | null>(null);
  const abonoForm = useForm<AbonoFormValues>({
    resolver: zodResolver(abonoSchema),
    defaultValues: { monto: "" },
  });
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);

  const [eventoModal, setEventoModal]       = useState<{ groupKey: string; leaseId: string | null; buildingId: string; unitId: string } | null>(null);
  const eventoForm = useForm<EventoFormValues>({
    resolver: zodResolver(eventoSchema),
    defaultValues: { concepto: "", chargeType: "amenities", monto: "" },
  });

  /* Captura: contexto (qué registro + charge_type) separado del formulario. */
  const [capturaContext, setCapturaContext] = useState<{ record: CollectionRecord; chargeType: CollectionChargeType } | null>(null);
  const capturaForm = useForm<CapturaFormValues>({
    resolver: zodResolver(capturaSchema),
    defaultValues: { monto: "", unidades: "", notas: "" },
  });

  type SortMode = "building" | "due_date";
  const [sortMode, setSortMode]             = useState<SortMode>("building");
  const [appliedSortMode, setAppliedSortMode] = useState<SortMode>("building");
  const [searchQuery, setSearchQuery]       = useState("");

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
        toast.error("Error cargando datos de cobranza.");
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
      toast("No hay configuraciones de cobro activas asociadas a contratos activos.", { icon: "⚠️" });
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
        const dueDate    = buildDateKey(year, month, s.due_day || 15);
        const isVariable = VARIABLE_CHARGE_TYPES.has(s.charge_type as CollectionChargeType);
        return {
          collection_schedule_id: s.id,
          company_id: user.company_id,
          building_id: s.building_id,
          unit_id: s.unit_id,
          lease_id: s.lease_id,
          period_year: year,
          period_month: month,
          due_date: dueDate,
          amount_due: isVariable ? 0 : s.amount_expected,
          amount_collected: 0,
          status: dueDate < today ? "overdue" : "pending",
          collected_at: null,
          payment_method: null,
          notes: isVariable ? "needs_amount" : null,
        };
      });

    if (!toInsert.length) {
      const monthLabel = `${MONTH_LABELS_LONG[month - 1]} ${year}`;
      toast.success(`Los cobros de ${monthLabel} ya están generados.`);
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("collection_records").insert(toInsert);

    if (error) {
      toast.error(`Error generando cobros: ${error.message}`);
      setGenerating(false);
      return;
    }

    await loadData();
    setGenerating(false);
    const monthLabel = `${MONTH_LABELS_LONG[month - 1]} ${year}`;
    toast.success(`${toInsert.length} cobro${toInsert.length === 1 ? "" : "s"} generado${toInsert.length === 1 ? "" : "s"} para ${monthLabel}.`);
  }

  // ── Registrar abono (parcial o total) ────────────────────────────────────────

  async function applyAbono(record: CollectionRecord, monto: number) {
    if (!user?.company_id) return;
    const prevCollected = record.amount_collected || 0;
    const newCollected  = Math.min(prevCollected + monto, record.amount_due);
    const newStatus: CollectionStoredStatus = newCollected >= record.amount_due ? "collected" : "partial";
    const newCollectedAt = newStatus === "collected" ? new Date().toISOString() : null;

    const { error } = await supabase
      .from("collection_records")
      .update({ amount_collected: newCollected, status: newStatus, collected_at: newCollectedAt })
      .eq("id", record.id)
      .eq("company_id", user.company_id);

    if (error) {
      toast.error(`No se pudo registrar el abono: ${error.message}`);
      return;
    }
    setRecords((prev) =>
      prev.map((r) => r.id === record.id
        ? { ...r, amount_collected: newCollected, status: newStatus, collected_at: newCollectedAt }
        : r
      )
    );
    setAbonoRecord(null);
    toast.success(newStatus === "collected" ? "Cobro marcado como pagado." : "Abono registrado.");
  }

  const handleAbonoSubmit = abonoForm.handleSubmit(async (data) => {
    if (!abonoRecord) return;
    const monto = parsePositiveNumber(data.monto);
    if (!monto) {
      toast.error("Ingresa un monto válido.");
      return;
    }
    await applyAbono(abonoRecord, monto);
  });

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
      toast.error(`No se pudo revertir: ${error.message}`);
      return;
    }
    setRecords((prev) =>
      prev.map((r) => r.id === record.id ? { ...r, status: "pending", amount_collected: 0, collected_at: null } : r)
    );
    toast.success("Cobro revertido a pendiente.");
  }

  // ── Cargo eventual (único, active=false) ──────────────────────────────────────

  const handleCreateEvento = eventoForm.handleSubmit(async (data) => {
    if (!eventoModal || !user?.company_id) return;
    const monto = parsePositiveNumber(data.monto);
    if (!monto) { toast.error("Ingresa un monto válido."); return; }

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
        charge_type:     data.chargeType,
        title:           data.concepto.trim(),
        amount_expected: monto,
        due_day:         dueDay,
        active:          false,
      })
      .select("id")
      .single();

    if (schedError || !schedData) {
      toast.error(`No se pudo crear el cargo: ${schedError?.message || "error desconocido"}`);
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
      toast.error(`No se pudo crear el cobro: ${recError?.message || "error desconocido"}`);
      return;
    }

    setSchedules((prev) => [...prev, {
      id: schedData.id,
      building_id:     eventoModal.buildingId,
      unit_id:         eventoModal.unitId,
      lease_id:        eventoModal.leaseId,
      charge_type:     data.chargeType,
      title:           data.concepto.trim(),
      amount_expected: monto,
      due_day:         dueDay,
      active:          false,
      notes:           null,
    }]);
    setRecords((prev) => [...prev, recData as CollectionRecord]);
    setEventoModal(null);
    eventoForm.reset({ concepto: "", chargeType: "amenities", monto: "" });
    toast.success("Cargo eventual registrado.");
  });

  // ── Capturar monto de servicio variable ───────────────────────────────────────

  const handleCaptura = capturaForm.handleSubmit(async (data) => {
    if (!capturaContext || !user?.company_id) return;
    const monto = parsePositiveNumber(data.monto);
    if (!monto) { toast.error("Ingresa un monto válido."); return; }

    const unitSuffix = capturaContext.chargeType === "electricity" ? "kWh" : "m³";
    const unidades = data.unidades?.trim() || "";
    const notas = data.notas?.trim() || "";
    const notesLine = unidades
      ? `${unidades} ${unitSuffix}${notas ? ` · ${notas}` : ""}`
      : notas || null;

    const newStatus: CollectionStoredStatus =
      capturaContext.record.due_date < getTodayDateKey() ? "overdue" : "pending";

    const { error } = await supabase
      .from("collection_records")
      .update({ amount_due: monto, notes: notesLine, status: newStatus })
      .eq("id", capturaContext.record.id)
      .eq("company_id", user.company_id);

    if (error) { toast.error(`Error: ${error.message}`); return; }

    const recordId = capturaContext.record.id;
    setRecords((prev) => prev.map((r) =>
      r.id === recordId ? { ...r, amount_due: monto, notes: notesLine, status: newStatus } : r
    ));
    setCapturaContext(null);
    capturaForm.reset({ monto: "", unidades: "", notas: "" });
    toast.success("Monto capturado correctamente.");
  });

  // ── Eliminar cobro ────────────────────────────────────────────────────────────

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
      toast.error(`No se pudo eliminar: ${error.message}`);
      return;
    }

    setRecords((prev) => prev.filter((r) => r.id !== deleteRecordId));
    toast.success("Cobro archivado correctamente.");
  }

  // ── Editar cobro ──────────────────────────────────────────────────────────────

  function openEditRecord(record: CollectionRecord) {
    setEditRecordId(record.id);
    editForm.reset({
      amountDue: String(record.amount_due || ""),
      notes: record.notes || "",
    });
  }

  const handleSaveRecordEdits = editForm.handleSubmit(async (data) => {
    if (!editRecordId || !user?.company_id) return;
    const nextAmount = parsePositiveNumber(data.amountDue);
    if (!nextAmount) {
      toast.error("Ingresa un monto válido.");
      return;
    }

    const { error } = await supabase
      .from("collection_records")
      .update({ amount_due: nextAmount, notes: data.notes?.trim() || null })
      .eq("id", editRecordId)
      .eq("company_id", user.company_id);

    if (error) {
      toast.error(`No se pudo actualizar: ${error.message}`);
      return;
    }

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editRecordId ? { ...r, amount_due: nextAmount, notes: data.notes?.trim() || null } : r,
      ),
    );
    setEditRecordId(null);
    toast.success("Cobro actualizado.");
  });

  // ── Navegación de mes ─────────────────────────────────────────────────────────

  function prevMonth() {
    setAppliedSortMode(sortMode);
    if (selectedMonth === 1) { setSelectedYear((y) => y - 1); setSelectedMonth(12); }
    else setSelectedMonth((m) => m - 1);
  }

  function nextMonth() {
    setAppliedSortMode(sortMode);
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

        // CAMBIO 2: ordenar registros por CHARGE_ORDER
        const sortedRecords = [...groupRecords].sort((a, b) => {
          const tA = scheduleMap.get(a.collection_schedule_id)?.charge_type || "other";
          const tB = scheduleMap.get(b.collection_schedule_id)?.charge_type || "other";
          return (CHARGE_ORDER[tA as CollectionChargeType] ?? 50) - (CHARGE_ORDER[tB as CollectionChargeType] ?? 50);
        });

        const totalDue       = sortedRecords.reduce((s, r) => s + (r.amount_due || 0), 0);
        const totalCollected = sortedRecords.reduce((s, r) => s + (r.amount_collected || 0), 0);
        const balance        = Math.max(totalDue - totalCollected, 0);
        const estadoGeneral  = computeEstadoGeneral(sortedRecords);

        return { groupKey, leaseId: leaseId ?? null, tenantLabel, buildingId, buildingName, unitLabel, records: sortedRecords, totalDue, totalCollected, balance, estadoGeneral };
      })
      .filter((row) => {
        if (filterBuildingId !== "all" && row.buildingId !== filterBuildingId) return false;
        if (filterStatus !== "all" && row.estadoGeneral !== filterStatus) return false;
        return true;
      })
      // CAMBIO 3: ordenar grupos según appliedSortMode
      .sort((a, b) => {
        if (appliedSortMode === "due_date") {
          const aMin = a.records.reduce((m, r) => r.due_date < m ? r.due_date : m, "9999-99-99");
          const bMin = b.records.reduce((m, r) => r.due_date < m ? r.due_date : m, "9999-99-99");
          if (aMin !== bMin) return aMin < bMin ? -1 : 1;
        } else {
          const aBldg = a.buildingName.toLowerCase();
          const bBldg = b.buildingName.toLowerCase();
          if (aBldg !== bBldg) return aBldg < bBldg ? -1 : 1;
          const aUnit = unitMap.get(a.records[0]?.unit_id);
          const bUnit = unitMap.get(b.records[0]?.unit_id);
          const aNum  = parseInt(aUnit?.unit_number || "", 10);
          const bNum  = parseInt(bUnit?.unit_number || "", 10);
          if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) return aNum - bNum;
          if (aUnit?.unit_number && bUnit?.unit_number) return aUnit.unit_number.localeCompare(bUnit.unit_number);
        }
        const statusOrder: Record<CollectionStoredStatus, number> = { overdue: 0, pending: 1, partial: 2, collected: 3 };
        return statusOrder[a.estadoGeneral] - statusOrder[b.estadoGeneral];
      });
  }, [monthRecords, leaseMap, unitMap, buildingMap, tenantMap, scheduleMap, filterBuildingId, filterStatus, appliedSortMode]);

  // ── Búsqueda sobre grupos ─────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return inquilinoRows;
    const q = normalizeText(searchQuery.trim());
    return inquilinoRows.filter((row) =>
      normalizeText(row.tenantLabel).includes(q) ||
      normalizeText(row.unitLabel).includes(q) ||
      normalizeText(row.buildingName).includes(q)
    );
  }, [inquilinoRows, searchQuery]);

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

  const countData = useMemo(() => {
    const overdue   = monthRecords.filter((r) => r.status === "overdue").length;
    const pending   = monthRecords.filter((r) => r.status === "pending" || r.status === "partial").length;
    const collected = monthRecords.filter((r) => r.status === "collected").length;
    return { overdue, pending, collected, total: monthRecords.length };
  }, [monthRecords]);

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
      <PageHeader title="Cobranza" titleIcon={<Wallet size={18} />} />

      {/* ── Navegador de mes + acción principal ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
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
      </div>

      {/* ── Métricas ── */}
      <AppGrid minWidth={200} style={{ marginTop: 24 }}>
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

      {/* ── Gráfica donut + barra de cantidades ── */}
      <div style={{ ...chartRowStyle, marginTop: 24 }}>
        {/* Donut — distribución por monto */}
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

        {/* Barra de cantidades — distribución por número de cobros */}
        <div style={donutCardStyle}>
          <p style={sectionLabelStyle}>Cobros del mes</p>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: "8px 0" }}>
            {countData.total === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Sin cobros generados</p>
            ) : (
              <>
                {/* Barra apilada horizontal */}
                <div style={{ display: "flex", height: 20, borderRadius: 10, overflow: "hidden", gap: 2 }}>
                  {countData.overdue > 0 && (
                    <div style={{ flex: countData.overdue, background: "#EF4444", minWidth: 4 }} title={`Vencido: ${countData.overdue}`} />
                  )}
                  {countData.pending > 0 && (
                    <div style={{ flex: countData.pending, background: "#F59E0B", minWidth: 4 }} title={`Pendiente/parcial: ${countData.pending}`} />
                  )}
                  {countData.collected > 0 && (
                    <div style={{ flex: countData.collected, background: "#10B981", minWidth: 4 }} title={`Cobrado: ${countData.collected}`} />
                  )}
                </div>
                {/* Leyenda de conteos */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {[
                    { label: "Vencido",   count: countData.overdue,   color: "#EF4444" },
                    { label: "Pendiente", count: countData.pending,   color: "#F59E0B" },
                    { label: "Cobrado",   count: countData.collected, color: "#10B981" },
                  ].map(({ label, count, color }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color }}>{count}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <p style={{ ...sectionLabelStyle, marginTop: 4 }}>
            {countData.total} cobro{countData.total !== 1 ? "s" : ""} en total
          </p>
        </div>
      </div>

      {/* ── Filtros + búsqueda + ordenamiento ── */}
      <div style={{ ...filtersRowStyle, marginTop: 24 }}>
        {/* Buscador */}
        <div style={{ ...filterFieldStyle, flex: "2 1 240px" }}>
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar inquilino o departamento..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)" }}
          />
          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery("")} style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={14} />
            </button>
          ) : null}
        </div>

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

        {/* Ordenamiento */}
        <div style={filterFieldStyle}>
          <Filter size={14} style={{ color: "var(--text-muted)" }} />
          <AppSelect
            value={sortMode}
            onChange={(e) => {
              const mode = e.target.value as SortMode;
              setSortMode(mode);
              setAppliedSortMode(mode);
            }}
          >
            <option value="building">Por edificio</option>
            <option value="due_date">Por vencimiento</option>
          </AppSelect>
        </div>
      </div>

      {/* ── Lista de inquilinos ── */}
      <div style={{ marginTop: 16 }}>
      <SectionCard title={`Cobros de ${monthLabel}`} icon={<Wallet size={18} />}>
        {filteredRows.length === 0 ? (
          <div style={emptyBoxStyle}>
            {searchQuery.trim()
              ? `Sin resultados para "${searchQuery}"`
              : monthRecords.length === 0
                ? `Todavía no hay cobros para ${monthLabel}. Usa "Generar cobros del mes" para crear los registros desde los contratos activos.`
                : "No hay cobros que coincidan con los filtros seleccionados."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredRows.map((row) => {
              const isExpanded = expandedKey === row.groupKey;
              const statusColors = getStatusColors(row.estadoGeneral);
              const buildingIdx = buildings.findIndex((b) => b.id === row.buildingId);
              const buildingColor = BUILDING_COLORS[buildingIdx >= 0 ? buildingIdx % BUILDING_COLORS.length : 0];

              return (
                <div key={row.groupKey} style={tenantCardStyle}>
                  {/* Fila principal — siempre visible */}
                  <div
                    style={{ ...tenantCardHeaderStyle, borderLeft: `4px solid ${buildingColor}`, paddingLeft: 12 }}
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

                    {/* Centro: saldo pendiente o badge cobrado */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {row.balance > 0 ? (
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(row.balance)}
                        </span>
                      ) : null}
                      <span style={{ ...badgeStyle, background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}>
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
                          const needsCaptura = VARIABLE_CHARGE_TYPES.has(chargeType) && record.amount_due === 0;

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
                                {needsCaptura ? (
                                  <span style={{ ...badgeStyle, fontSize: 11, padding: "4px 8px", background: "var(--metric-bg-amber)", color: "var(--badge-text-amber)", border: "1px solid var(--metric-border-amber)" }}>
                                    Capturar monto
                                  </span>
                                ) : (
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
                                )}
                              </div>

                              {/* Acción */}
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
                                {needsCaptura ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCapturaContext({ record, chargeType });
                                      capturaForm.reset({ monto: "", unidades: "", notas: "" });
                                    }}
                                    disabled={isMarking}
                                    style={paidBtnStyle}
                                  >
                                    <Zap size={13} />
                                    Capturar
                                  </button>
                                ) : record.status !== "collected" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAbonoRecord(record);
                                      abonoForm.reset({ monto: String(Math.max(record.amount_due - (record.amount_collected || 0), 0)) });
                                    }}
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
                            eventoForm.reset({ concepto: "", chargeType: "amenities", monto: "" });
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
      </div>

      {/* ── Modal: Editar cobro ── */}
      <Modal
        open={Boolean(editRecordId)}
        title="Editar cobro"
        onClose={() => { if (!editForm.formState.isSubmitting) setEditRecordId(null); }}
      >
        <form onSubmit={handleSaveRecordEdits} style={{ display: "grid", gap: 16 }}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Monto</span>
            <input
              {...editForm.register("amountDue", {
                onChange: (e) => editForm.setValue("amountDue", formatDecimalInput(e.target.value)),
              })}
              style={inputStyle}
              inputMode="decimal"
              placeholder="0.00"
            />
            {editForm.formState.errors.amountDue ? (
              <p style={collectionsErrorTextStyle}>{editForm.formState.errors.amountDue.message}</p>
            ) : null}
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Notas</span>
            <textarea
              {...editForm.register("notes")}
              rows={3}
              style={textareaStyle}
            />
          </label>
          <div style={modalFooterStyle}>
            <UiButton variant="secondary" onClick={() => { if (!editForm.formState.isSubmitting) setEditRecordId(null); }}>Cancelar</UiButton>
            <UiButton type="submit" disabled={editForm.formState.isSubmitting} icon={<Pencil size={15} />}>
              {editForm.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
            </UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Eliminar cobro ── */}
      <Modal
        open={Boolean(deleteRecordId)}
        title="Eliminar cobro"
        onClose={() => { if (!deletingRecord) setDeleteRecordId(null); }}
      >
        {deleteRecord ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={warningBoxStyle}>
              ¿Eliminar el cobro de{" "}
              <strong>{formatCurrency(deleteRecord.amount_due)}</strong> con vencimiento{" "}
              <strong>{formatDate(deleteRecord.due_date)}</strong>? Esta acción lo ocultará del
              sistema pero conservará su información.
            </div>
            <div style={modalFooterStyle}>
              <UiButton variant="secondary" onClick={() => setDeleteRecordId(null)} disabled={deletingRecord}>Cancelar</UiButton>
              <UiButton onClick={handleDeleteRecord} disabled={deletingRecord} icon={<Trash2 size={15} />}>
                {deletingRecord ? "Eliminando..." : "Eliminar cobro"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Modal: Registrar abono ── */}
      <Modal
        open={Boolean(abonoRecord)}
        title="Registrar abono"
        onClose={() => { if (!abonoForm.formState.isSubmitting) setAbonoRecord(null); }}
      >
        {abonoRecord ? (
          <form onSubmit={handleAbonoSubmit} style={{ display: "grid", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Total del cobro:{" "}
              <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(abonoRecord.amount_due)}</strong>
              {(abonoRecord.amount_collected || 0) > 0 ? (
                <> · Ya abonado:{" "}
                  <strong style={{ color: "#10B981" }}>{formatCurrency(abonoRecord.amount_collected || 0)}</strong>
                </>
              ) : null}
            </p>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Monto a abonar</span>
              <input
                {...abonoForm.register("monto", {
                  onChange: (e) => abonoForm.setValue("monto", formatDecimalInput(e.target.value)),
                })}
                style={inputStyle}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
              />
              {abonoForm.formState.errors.monto ? (
                <p style={collectionsErrorTextStyle}>{abonoForm.formState.errors.monto.message}</p>
              ) : null}
            </label>
            <div style={modalFooterStyle}>
              <UiButton variant="secondary" onClick={() => { if (!abonoForm.formState.isSubmitting) setAbonoRecord(null); }}>Cancelar</UiButton>
              <UiButton
                type="submit"
                disabled={abonoForm.formState.isSubmitting}
                icon={<CheckCircle2 size={15} />}
              >
                {abonoForm.formState.isSubmitting ? "Guardando..." : "Confirmar abono"}
              </UiButton>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* ── Modal: Capturar monto variable ── */}
      <Modal
        open={Boolean(capturaContext)}
        title={`Capturar monto — ${capturaContext ? getChargeTypeLabel(capturaContext.chargeType) : ""}`}
        onClose={() => {
          if (!capturaForm.formState.isSubmitting) {
            setCapturaContext(null);
            capturaForm.reset({ monto: "", unidades: "", notas: "" });
          }
        }}
      >
        {capturaContext ? (
          <form onSubmit={handleCaptura} style={{ display: "grid", gap: 16 }}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Monto a cobrar</span>
              <input
                {...capturaForm.register("monto", {
                  onChange: (e) => capturaForm.setValue("monto", formatDecimalInput(e.target.value)),
                })}
                style={inputStyle}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
              />
              {capturaForm.formState.errors.monto ? (
                <p style={collectionsErrorTextStyle}>{capturaForm.formState.errors.monto.message}</p>
              ) : null}
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>
                Consumo ({capturaContext.chargeType === "electricity" ? "kWh" : "m³"})
              </span>
              <input
                {...capturaForm.register("unidades", {
                  onChange: (e) => capturaForm.setValue("unidades", formatDecimalInput(e.target.value)),
                })}
                style={inputStyle}
                inputMode="decimal"
                placeholder="0"
              />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Comentario (opcional)</span>
              <input
                {...capturaForm.register("notas")}
                style={inputStyle}
                placeholder="Ej. Periodo 1-31 mar"
              />
            </label>
            <div style={modalFooterStyle}>
              <UiButton variant="secondary" onClick={() => {
                if (!capturaForm.formState.isSubmitting) {
                  setCapturaContext(null);
                  capturaForm.reset({ monto: "", unidades: "", notas: "" });
                }
              }}>Cancelar</UiButton>
              <UiButton type="submit" disabled={capturaForm.formState.isSubmitting} icon={<Zap size={15} />}>
                {capturaForm.formState.isSubmitting ? "Guardando..." : "Confirmar monto"}
              </UiButton>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* ── Modal: Cargo eventual ── */}
      <Modal
        open={Boolean(eventoModal)}
        title="Cargo eventual"
        onClose={() => {
          if (!eventoForm.formState.isSubmitting) {
            setEventoModal(null);
            eventoForm.reset({ concepto: "", chargeType: "amenities", monto: "" });
          }
        }}
      >
        <form onSubmit={handleCreateEvento} style={{ display: "grid", gap: 16 }}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Concepto</span>
            <input
              {...eventoForm.register("concepto")}
              style={inputStyle}
              placeholder="Ej. Limpieza de terraza"
              autoFocus
            />
            {eventoForm.formState.errors.concepto ? (
              <p style={collectionsErrorTextStyle}>{eventoForm.formState.errors.concepto.message}</p>
            ) : null}
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Tipo</span>
            <AppSelect {...eventoForm.register("chargeType")}>
              <option value="amenities">Amenidades</option>
              <option value="parking">Estacionamiento</option>
              <option value="penalty">Penalización</option>
              <option value="other">Otro</option>
            </AppSelect>
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Monto</span>
            <input
              {...eventoForm.register("monto", {
                onChange: (e) => eventoForm.setValue("monto", formatDecimalInput(e.target.value)),
              })}
              style={inputStyle}
              inputMode="decimal"
              placeholder="0.00"
            />
            {eventoForm.formState.errors.monto ? (
              <p style={collectionsErrorTextStyle}>{eventoForm.formState.errors.monto.message}</p>
            ) : null}
          </label>
          <div style={modalFooterStyle}>
            <UiButton variant="secondary" onClick={() => {
              if (!eventoForm.formState.isSubmitting) {
                setEventoModal(null);
                eventoForm.reset({ concepto: "", chargeType: "amenities", monto: "" });
              }
            }}>Cancelar</UiButton>
            <UiButton type="submit" disabled={eventoForm.formState.isSubmitting} icon={<Plus size={15} />}>
              {eventoForm.formState.isSubmitting ? "Guardando..." : "Agregar cargo"}
            </UiButton>
          </div>
        </form>
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
  gridTemplateColumns: "1fr 1fr",
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
  overflowX: "auto",
};

const conceptsHeaderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 110px 170px",
  gap: 12,
  padding: "6px 8px",
  marginBottom: 4,
  minWidth: 480,
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
  minWidth: 480,
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
