"use client";

/*
  Módulo de Cobranza.

  Esta versión ya integra:
  - collection_schedules
  - collection_records
  - collection_payments
  - collection_invoices

  Objetivo:
  - mostrar cobros administrativos a inquilinos
  - identificar pendientes, parciales, cobrados y vencidos
  - filtrar por edificio y estado
  - abrir detalle por registro
  - registrar abonos parciales
  - visualizar historial de pagos
  - visualizar facturas ligadas al cobro

  Importante:
  - esta pantalla NO timbra facturas
  - esta pantalla NO es contabilidad
  - esta pantalla sigue siendo control administrativo interno de cobranza

  Decisión actual:
  - la carga inteligente XML + PDF vendrá después
  - aquí ya dejamos la base visual y operativa para soportarla
*/

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Landmark,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useAppToast } from "@/components/AppToastProvider";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppTable from "@/components/AppTable";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";

type Building = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  building_id: string;
  unit_number: string | null;
  display_code: string | null;
};

type AppUser = {
  id: string;
  company_id: string;
  full_name: string | null;
  email: string | null;
  is_superadmin: boolean | null;
  created_at: string;
};

type Lease = {
  id: string;
  unit_id: string | null;
  tenant_id: string | null;
  responsible_payer_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  due_day: number | null;
  rent_amount: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

type CollectionChargeType =
  | "rent"
  | "maintenance_fee"
  | "services"
  | "parking"
  | "penalty"
  | "other";

type CollectionSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  charge_type: CollectionChargeType;
  title: string;
  responsibility_type: "tenant" | "owner" | "other";
  amount_expected: number;
  due_day: number;
  active: boolean;
  notes: string | null;
};

type CollectionStoredStatus = "pending" | "partial" | "collected" | "overdue";

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
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

type CollectionPayment = {
  id: string;
  collection_record_id: string;
  company_id: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type CollectionInvoice = {
  id: string;
  collection_record_id: string | null;
  company_id: string;
  building_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  invoice_uuid: string | null;
  invoice_series: string | null;
  invoice_folio: string | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  description: string | null;
  invoice_type: string | null;
  charge_category: string | null;
  issued_at: string | null;
  period_year: number | null;
  period_month: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  pdf_path: string;
  xml_path: string;
  original_pdf_filename: string | null;
  original_xml_filename: string | null;
  match_confidence: number | null;
  match_notes: string | null;
  replaced_at: string | null;
  replaced_by_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
};

type CollectionStatusFilter =
  | "all"
  | "pending"
  | "partial"
  | "collected"
  | "overdue";

type PaymentMethod =
  | ""
  | "transferencia"
  | "efectivo"
  | "tarjeta"
  | "depósito"
  | "otro";

type PaymentForm = {
  recordId: string;
  amount: string;
  paidAt: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
};

type CollectionRow = {
  id: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitLabel: string;
  tenantLabel: string;
  responsiblePayerLabel: string;
  title: string;
  chargeTypeLabel: string;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  amountCollected: number;
  amountCollectedLabel: string;
  balance: number;
  balanceLabel: string;
  status: CollectionStoredStatus;
  statusLabel: string;
  paymentMethodLabel: string;
  notes: string;
  invoicesCount: number;
  paymentsCount: number;
};

const MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function getTodayDateOnlyKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDate(dateKey: string | null) {
  if (!dateKey) return "Sin fecha";

  const safeDate = dateKey.length >= 10 ? dateKey.slice(0, 10) : dateKey;
  const date = parseDateOnly(safeDate);

  return `${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTime(dateKey: string | null) {
  if (!dateKey) return "Sin fecha";

  const date = new Date(dateKey);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPeriod(periodYear: number, periodMonth: number) {
  return `${MONTH_LABELS_SHORT[periodMonth - 1] || "Mes"} ${periodYear}`;
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

  return (
    sanitized.slice(0, firstDot + 1) +
    sanitized.slice(firstDot + 1).replace(/\./g, "")
  );
}

function getChargeTypeLabel(type: CollectionChargeType) {
  if (type === "rent") return "Renta";
  if (type === "maintenance_fee") return "Mantenimiento";
  if (type === "services") return "Servicios";
  if (type === "parking") return "Estacionamiento";
  if (type === "penalty") return "Penalización";
  return "Otro";
}

function getStatusLabel(status: CollectionStoredStatus) {
  if (status === "collected") return "Cobrado";
  if (status === "partial") return "Parcial";
  if (status === "pending") return "Pendiente";
  return "Vencido";
}

function getStatusColors(status: CollectionStoredStatus) {
  if (status === "collected") {
    return {
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
    };
  }

  if (status === "partial") {
    return {
      background: "#EFF6FF",
      border: "#BFDBFE",
      text: "#1D4ED8",
    };
  }

  if (status === "pending") {
    return {
      background: "#FEFCE8",
      border: "#FDE68A",
      text: "#A16207",
    };
  }

  return {
    background: "#FEF2F2",
    border: "#FECACA",
    text: "#B91C1C",
  };
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getUserDisplayLabel(user: AppUser | null | undefined) {
  if (!user) return null;
  return user.full_name || user.email || null;
}

export default function CollectionsPage() {
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();

  const [loadingPage, setLoadingPage] = useState(true);
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [collectionPayments, setCollectionPayments] = useState<CollectionPayment[]>([]);
  const [collectionInvoices, setCollectionInvoices] = useState<CollectionInvoice[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] =
    useState<CollectionStatusFilter>("all");

  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [paymentRecordId, setPaymentRecordId] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    recordId: "",
    amount: "",
    paidAt: getTodayDateOnlyKey(),
    paymentMethod: "",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    void loadCollectionsData();
  }, [loading, user?.company_id]);

  async function loadCollectionsData() {
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMessage("");

    const [
      buildingsRes,
      unitsRes,
      appUsersRes,
      leasesRes,
      schedulesRes,
      recordsRes,
      paymentsRes,
      invoicesRes,
    ] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .order("name", { ascending: true }),

      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id),

      supabase
        .from("app_users")
        .select("id, company_id, full_name, email, is_superadmin, created_at")
        .eq("company_id", user.company_id),

      supabase
        .from("leases")
        .select(
          "id, unit_id, tenant_id, responsible_payer_id, billing_name, billing_email, due_day, rent_amount, status, start_date, end_date"
        )
        .eq("company_id", user.company_id),

      supabase
        .from("collection_schedules")
        .select(
          "id, building_id, unit_id, lease_id, charge_type, title, responsibility_type, amount_expected, due_day, active, notes"
        )
        .eq("company_id", user.company_id)
        .eq("active", true),

      supabase
        .from("collection_records")
        .select(
          "id, collection_schedule_id, company_id, building_id, unit_id, lease_id, period_year, period_month, due_date, amount_due, amount_collected, status, collected_at, payment_method, notes, created_at"
        )
        .eq("company_id", user.company_id)
        .order("due_date", { ascending: true }),

      supabase
        .from("collection_payments")
        .select(
          "id, collection_record_id, company_id, amount, paid_at, payment_method, reference, notes, created_by, created_at"
        )
        .eq("company_id", user.company_id)
        .order("paid_at", { ascending: false }),

      supabase
        .from("collection_invoices")
        .select(
          "id, collection_record_id, company_id, building_id, unit_id, lease_id, invoice_uuid, invoice_series, invoice_folio, customer_name, customer_tax_id, description, invoice_type, charge_category, issued_at, period_year, period_month, subtotal, tax, total, pdf_path, xml_path, original_pdf_filename, original_xml_filename, match_confidence, match_notes, replaced_at, replaced_by_invoice_id, created_by, created_at"
        )
        .eq("company_id", user.company_id)
        .is("replaced_at", null)
        .order("issued_at", { ascending: false }),
    ]);

    if (buildingsRes.error) {
      setMessage("No se pudieron cargar los edificios.");
      setLoadingPage(false);
      return;
    }

    if (unitsRes.error) {
      setMessage("No se pudieron cargar las unidades.");
      setLoadingPage(false);
      return;
    }

    if (appUsersRes.error) {
      setMessage("No se pudieron cargar los usuarios.");
      setLoadingPage(false);
      return;
    }

    if (leasesRes.error) {
      setMessage("No se pudieron cargar los contratos.");
      setLoadingPage(false);
      return;
    }

    if (schedulesRes.error) {
      setMessage("No se pudieron cargar las configuraciones de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (recordsRes.error) {
      setMessage("No se pudieron cargar los registros de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (paymentsRes.error) {
      setMessage("No se pudieron cargar los abonos de cobranza.");
      setLoadingPage(false);
      return;
    }

    if (invoicesRes.error) {
      setMessage("No se pudieron cargar las facturas ligadas a cobranza.");
      setLoadingPage(false);
      return;
    }

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setAppUsers((appUsersRes.data as AppUser[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setCollectionSchedules((schedulesRes.data as CollectionSchedule[]) || []);
    setCollectionRecords((recordsRes.data as CollectionRecord[]) || []);
    setCollectionPayments((paymentsRes.data as CollectionPayment[]) || []);
    setCollectionInvoices((invoicesRes.data as CollectionInvoice[]) || []);
    setLoadingPage(false);
  }

  const collectionRows = useMemo<CollectionRow[]>(() => {
    const buildingMap = new Map<string, Building>();
    const unitMap = new Map<string, Unit>();
    const userMap = new Map<string, AppUser>();
    const leaseMap = new Map<string, Lease>();
    const scheduleMap = new Map<string, CollectionSchedule>();
    const paymentsByRecordId = new Map<string, CollectionPayment[]>();
    const invoicesByRecordId = new Map<string, CollectionInvoice[]>();

    buildings.forEach((building) => buildingMap.set(building.id, building));
    units.forEach((unit) => unitMap.set(unit.id, unit));
    appUsers.forEach((appUser) => userMap.set(appUser.id, appUser));
    leases.forEach((lease) => leaseMap.set(lease.id, lease));
    collectionSchedules.forEach((schedule) => scheduleMap.set(schedule.id, schedule));

    collectionPayments.forEach((payment) => {
      const current = paymentsByRecordId.get(payment.collection_record_id) || [];
      current.push(payment);
      paymentsByRecordId.set(payment.collection_record_id, current);
    });

    collectionInvoices.forEach((invoice) => {
      if (!invoice.collection_record_id) return;
      const current = invoicesByRecordId.get(invoice.collection_record_id) || [];
      current.push(invoice);
      invoicesByRecordId.set(invoice.collection_record_id, current);
    });

    return collectionRecords
      .map((record) => {
        const schedule = scheduleMap.get(record.collection_schedule_id);
        if (!schedule) return null;

        const building =
          buildingMap.get(record.building_id) || buildingMap.get(schedule.building_id);
        const unit = unitMap.get(record.unit_id) || unitMap.get(schedule.unit_id);
        const lease =
          (record.lease_id ? leaseMap.get(record.lease_id) : null) ||
          (schedule.lease_id ? leaseMap.get(schedule.lease_id) : null);

        const tenantUser = lease?.tenant_id ? userMap.get(lease.tenant_id) : null;
        const responsiblePayerUser = lease?.responsible_payer_id
          ? userMap.get(lease.responsible_payer_id)
          : null;

        const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";

        const tenantLabel =
          getUserDisplayLabel(tenantUser) ||
          lease?.billing_name ||
          lease?.billing_email ||
          "Sin inquilino asignado";

        const responsiblePayerLabel =
          getUserDisplayLabel(responsiblePayerUser) ||
          lease?.billing_name ||
          lease?.billing_email ||
          getUserDisplayLabel(tenantUser) ||
          "Sin responsable definido";

        const paidAmount =
          record.amount_collected ??
          (paymentsByRecordId.get(record.id) || []).reduce(
            (sum, payment) => sum + (payment.amount || 0),
            0
          );

        const balance = Math.max((record.amount_due || 0) - paidAmount, 0);

        return {
          id: record.id,
          buildingId: record.building_id,
          buildingName: building?.name || "Edificio",
          unitId: record.unit_id,
          unitLabel: `Unidad ${unitLabel}`,
          tenantLabel,
          responsiblePayerLabel,
          title: schedule.title,
          chargeTypeLabel: getChargeTypeLabel(schedule.charge_type),
          periodLabel: formatPeriod(record.period_year, record.period_month),
          dueDate: record.due_date,
          dueDateLabel: formatDate(record.due_date),
          amountDue: record.amount_due || 0,
          amountDueLabel: formatCurrency(record.amount_due || 0),
          amountCollected: paidAmount,
          amountCollectedLabel: formatCurrency(paidAmount),
          balance,
          balanceLabel: formatCurrency(balance),
          status: record.status,
          statusLabel: getStatusLabel(record.status),
          paymentMethodLabel: record.payment_method || "—",
          notes: record.notes || schedule.notes || "—",
          invoicesCount: (invoicesByRecordId.get(record.id) || []).length,
          paymentsCount: (paymentsByRecordId.get(record.id) || []).length,
        };
      })
      .filter((row): row is CollectionRow => Boolean(row));
  }, [
    buildings,
    units,
    appUsers,
    leases,
    collectionSchedules,
    collectionRecords,
    collectionPayments,
    collectionInvoices,
  ]);

  const collectionRowsById = useMemo(() => {
    return new Map(collectionRows.map((row) => [row.id, row]));
  }, [collectionRows]);

  const filteredRows = useMemo(() => {
    return collectionRows.filter((row) => {
      if (selectedBuildingId !== "all" && row.buildingId !== selectedBuildingId) {
        return false;
      }

      if (selectedStatus !== "all" && row.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [collectionRows, selectedBuildingId, selectedStatus]);

  const selectedBuildingLabel =
    selectedBuildingId === "all"
      ? "Todos los edificios"
      : buildings.find((building) => building.id === selectedBuildingId)?.name ||
        "Edificio";

  const totalRecords = filteredRows.length;
  const collectedCount = filteredRows.filter((row) => row.status === "collected").length;
  const partialCount = filteredRows.filter((row) => row.status === "partial").length;
  const pendingCount = filteredRows.filter((row) => row.status === "pending").length;
  const overdueCount = filteredRows.filter((row) => row.status === "overdue").length;

  const totalOutstandingAmount = filteredRows
    .filter((row) => row.status !== "collected")
    .reduce((sum, row) => sum + row.balance, 0);

  const todayKey = getTodayDateOnlyKey();

  const nextPendingLabel = useMemo(() => {
    const nextPending = filteredRows
      .filter(
        (row) =>
          (row.status === "pending" || row.status === "partial") &&
          row.dueDate >= todayKey
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    if (!nextPending) return "Sin próximos cobros";
    return `${nextPending.title} · ${nextPending.dueDateLabel}`;
  }, [filteredRows, todayKey]);

  const detailRow = detailRecordId ? collectionRowsById.get(detailRecordId) || null : null;

  const detailPayments = useMemo(() => {
    if (!detailRecordId) return [];
    return collectionPayments
      .filter((payment) => payment.collection_record_id === detailRecordId)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  }, [collectionPayments, detailRecordId]);

  const detailInvoices = useMemo(() => {
    if (!detailRecordId) return [];
    return collectionInvoices
      .filter((invoice) => invoice.collection_record_id === detailRecordId)
      .sort((a, b) => {
        const aDate = a.issued_at || a.created_at;
        const bDate = b.issued_at || b.created_at;
        return bDate.localeCompare(aDate);
      });
  }, [collectionInvoices, detailRecordId]);

  function openPaymentModal(row: CollectionRow) {
    setPaymentRecordId(row.id);
    setPaymentForm({
      recordId: row.id,
      amount: row.balance > 0 ? String(row.balance) : "",
      paidAt: getTodayDateOnlyKey(),
      paymentMethod: "",
      reference: "",
      notes: "",
    });
  }

  async function handleSavePayment() {
    if (!user?.company_id || !paymentRecordId) return;

    const row = collectionRowsById.get(paymentRecordId);
    if (!row) return;

    const amount = parsePositiveNumber(paymentForm.amount);

    if (!amount) {
      showToast("Ingresa un monto válido para el abono.", "error");
      return;
    }

    if (amount > row.balance) {
      showToast("El abono no puede ser mayor al saldo pendiente.", "error");
      return;
    }

    if (!paymentForm.paidAt) {
      showToast("Selecciona la fecha del abono.", "error");
      return;
    }

    setSavingPayment(true);

    const paidAtIso = new Date(`${paymentForm.paidAt}T12:00:00`).toISOString();

    const insertRes = await supabase.from("collection_payments").insert({
      collection_record_id: row.id,
      company_id: user.company_id,
      amount,
      paid_at: paidAtIso,
      payment_method: paymentForm.paymentMethod || null,
      reference: paymentForm.reference.trim() || null,
      notes: paymentForm.notes.trim() || null,
      created_by: user.id || null,
    });

    if (insertRes.error) {
      showToast("No se pudo registrar el abono.", "error");
      setSavingPayment(false);
      return;
    }

    await loadCollectionsData();

    setSavingPayment(false);
    setPaymentRecordId(null);

    showToast("Abono registrado correctamente.", "success");
  }

  const paymentRow = paymentRecordId
    ? collectionRowsById.get(paymentRecordId) || null
    : null;

  if (loading || loadingPage) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "#6B7280" }}>
          Cargando módulo de cobranza...
        </div>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader title="Cobranza" titleIcon={<Wallet size={18} />} />

      {message ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {message}
        </div>
      ) : null}

      <AppGrid minWidth={220}>
        <MetricCard
          label="Registros"
          value={String(totalRecords)}
          helper={selectedBuildingLabel}
          icon={<Wallet size={18} />}
        />

        <MetricCard
          label="Cobrados"
          value={String(collectedCount)}
          helper="Cobros cerrados"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#DCFCE7",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
          }
        />

        <MetricCard
          label="Parciales"
          value={String(partialCount)}
          helper="Con abonos registrados"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#DBEAFE",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Landmark size={18} color="#2563EB" />
            </div>
          }
        />

        <MetricCard
          label="Pendientes"
          value={String(pendingCount)}
          helper={nextPendingLabel}
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF9C3",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Clock3 size={18} color="#EAB308" />
            </div>
          }
        />

        <MetricCard
          label="Vencidos"
          value={String(overdueCount)}
          helper="Requieren seguimiento"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEE2E2",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AlertCircle size={18} color="#DC2626" />
            </div>
          }
        />

        <MetricCard
          label="Saldo pendiente"
          value={formatCurrency(totalOutstandingAmount)}
          helper="Pendiente + parcial + vencido"
          icon={<CalendarDays size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard title="Filtros" icon={<Filter size={18} />}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={filterLabelStyle}>
                <Building2 size={14} />
                Edificio
              </div>

              <AppSelect
                value={selectedBuildingId}
                onChange={(event) => setSelectedBuildingId(event.target.value)}
              >
                <option value="all">Todos los edificios</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </AppSelect>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={filterLabelStyle}>
                <Filter size={14} />
                Estado
              </div>

              <AppSelect
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as CollectionStatusFilter)
                }
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="partial">Parcial</option>
                <option value="collected">Cobrado</option>
                <option value="overdue">Vencido</option>
              </AppSelect>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Listado de cobranza" icon={<Wallet size={18} />}>
        <AppTable
          rows={filteredRows}
          emptyState="No hay registros de cobranza para mostrar con los filtros actuales."
          columns={[
            {
              key: "concept",
              header: "Concepto",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={cellPrimaryStrongStyle}>{row.title}</span>
                  <span style={cellSecondaryStyle}>{row.chargeTypeLabel}</span>
                </div>
              ),
            },
            {
              key: "building",
              header: "Edificio / unidad",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={cellPrimaryStyle}>{row.buildingName}</span>
                  <span style={cellSecondaryStyle}>{row.unitLabel}</span>
                </div>
              ),
            },
            {
              key: "tenant",
              header: "Inquilino",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={cellPrimaryStyle}>{row.tenantLabel}</span>
                  <span style={cellSecondaryStyle}>{row.responsiblePayerLabel}</span>
                </div>
              ),
            },
            {
              key: "period",
              header: "Periodo",
              render: (row: CollectionRow) => (
                <span style={cellPrimaryStyle}>{row.periodLabel}</span>
              ),
            },
            {
              key: "dueDate",
              header: "Vencimiento",
              render: (row: CollectionRow) => (
                <span style={cellPrimaryStyle}>{row.dueDateLabel}</span>
              ),
            },
            {
              key: "amount",
              header: "Monto / cobrado",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={cellPrimaryStrongStyle}>{row.amountDueLabel}</span>
                  <span style={cellSecondaryStyle}>{row.amountCollectedLabel}</span>
                </div>
              ),
            },
            {
              key: "balance",
              header: "Saldo",
              render: (row: CollectionRow) => (
                <span
                  style={{
                    ...cellPrimaryStrongStyle,
                    color: row.balance > 0 ? "#B91C1C" : "#166534",
                  }}
                >
                  {row.balanceLabel}
                </span>
              ),
            },
            {
              key: "status",
              header: "Estado",
              render: (row: CollectionRow) => {
                const colors = getStatusColors(row.status);

                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${colors.border}`,
                      background: colors.background,
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.statusLabel}
                  </span>
                );
              },
            },
            {
              key: "activity",
              header: "Actividad",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={cellSecondaryStyle}>
                    {row.paymentsCount} abono{row.paymentsCount === 1 ? "" : "s"}
                  </span>
                  <span style={cellSecondaryStyle}>
                    {row.invoicesCount} factura{row.invoicesCount === 1 ? "" : "s"}
                  </span>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Acciones",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setDetailRecordId(row.id)}
                    style={tableActionButtonStyle}
                  >
                    <Eye size={14} />
                    Ver detalle
                  </button>

                  <button
                    type="button"
                    onClick={() => openPaymentModal(row)}
                    disabled={row.balance <= 0}
                    style={{
                      ...tablePrimaryButtonStyle,
                      opacity: row.balance <= 0 ? 0.55 : 1,
                      cursor: row.balance <= 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    <Plus size={14} />
                    Registrar abono
                  </button>
                </div>
              ),
            },
          ]}
        />
      </SectionCard>

      <Modal
        open={Boolean(detailRow)}
        title="Detalle de cobranza"
        onClose={() => setDetailRecordId(null)}
      >
        {detailRow ? (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={detailTopGridStyle}>
              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Concepto</div>
                <div style={detailValueStyle}>{detailRow.title}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Edificio / unidad</div>
                <div style={detailValueStyle}>
                  {detailRow.buildingName} · {detailRow.unitLabel}
                </div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Inquilino</div>
                <div style={detailValueStyle}>{detailRow.tenantLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Responsable de pago</div>
                <div style={detailValueStyle}>{detailRow.responsiblePayerLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Periodo</div>
                <div style={detailValueStyle}>{detailRow.periodLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Vencimiento</div>
                <div style={detailValueStyle}>{detailRow.dueDateLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Monto</div>
                <div style={detailValueStyle}>{detailRow.amountDueLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Cobrado</div>
                <div style={detailValueStyle}>{detailRow.amountCollectedLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Saldo</div>
                <div style={detailValueStyle}>{detailRow.balanceLabel}</div>
              </div>

              <div style={detailBlockStyle}>
                <div style={detailLabelStyle}>Estado</div>
                <div style={detailValueStyle}>{detailRow.statusLabel}</div>
              </div>
            </div>

            <div>
              <div style={detailSectionTitleStyle}>Notas</div>
              <div style={notesBoxStyle}>
                {detailRow.notes && detailRow.notes !== "—"
                  ? detailRow.notes
                  : "No hay notas registradas para este cobro."}
              </div>
            </div>

            <div>
              <div style={detailSectionHeaderStyle}>
                <div style={detailSectionTitleStyle}>Historial de abonos</div>

                <UiButton
                  onClick={() => {
                    setDetailRecordId(null);
                    openPaymentModal(detailRow);
                  }}
                  icon={<Plus size={16} />}
                >
                  Registrar abono
                </UiButton>
              </div>

              {detailPayments.length === 0 ? (
                <div style={emptyInlineBoxStyle}>
                  No hay abonos registrados para este cobro.
                </div>
              ) : (
                <div style={detailListWrapStyle}>
                  {detailPayments.map((payment) => (
                    <div key={payment.id} style={detailListItemStyle}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={cellPrimaryStrongStyle}>
                          {formatCurrency(payment.amount)}
                        </span>
                        <span style={cellSecondaryStyle}>
                          {payment.payment_method || "Sin método"} ·{" "}
                          {formatDateTime(payment.paid_at)}
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                        <span style={cellSecondaryStyle}>
                          {payment.reference || "Sin referencia"}
                        </span>
                        <span style={cellSecondaryStyle}>
                          {payment.notes || "Sin notas"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={detailSectionTitleStyle}>Facturas ligadas</div>

              {detailInvoices.length === 0 ? (
                <div style={emptyInlineBoxStyle}>
                  Todavía no hay facturas ligadas a este cobro.
                </div>
              ) : (
                <div style={detailListWrapStyle}>
                  {detailInvoices.map((invoice) => (
                    <div key={invoice.id} style={detailListItemStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={invoiceIconWrapStyle}>
                          <Receipt size={16} />
                        </div>

                        <div style={{ display: "grid", gap: 4 }}>
                          <span style={cellPrimaryStrongStyle}>
                            {invoice.description || "Factura ligada"}
                          </span>
                          <span style={cellSecondaryStyle}>
                            {invoice.customer_name || "Sin cliente"} ·{" "}
                            {invoice.invoice_uuid || "Sin UUID"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                        <span style={cellPrimaryStyle}>
                          {formatCurrency(invoice.total)}
                        </span>
                        <span style={cellSecondaryStyle}>
                          {formatDate(invoice.issued_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paymentRow)}
        title="Registrar abono"
        onClose={() => {
          if (!savingPayment) setPaymentRecordId(null);
        }}
      >
        {paymentRow ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={paymentSummaryCardStyle}>
              <div style={paymentSummaryGridStyle}>
                <div>
                  <div style={detailLabelStyle}>Concepto</div>
                  <div style={detailValueStyle}>{paymentRow.title}</div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Unidad</div>
                  <div style={detailValueStyle}>
                    {paymentRow.buildingName} · {paymentRow.unitLabel}
                  </div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Inquilino</div>
                  <div style={detailValueStyle}>{paymentRow.tenantLabel}</div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Saldo actual</div>
                  <div style={detailValueStyle}>{paymentRow.balanceLabel}</div>
                </div>
              </div>
            </div>

            <div style={simpleFormGridStyle}>
              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Monto del abono</span>
                <input
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: formatDecimalInput(event.target.value),
                    }))
                  }
                  inputMode="decimal"
                  style={inputStyle}
                  placeholder="0.00"
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Fecha del abono</span>
                <input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paidAt: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Método</span>
                <AppSelect
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentMethod: event.target.value as PaymentMethod,
                    }))
                  }
                >
                  <option value="">Selecciona un método</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="depósito">Depósito</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </AppSelect>
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Referencia</span>
                <input
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      reference: event.target.value,
                    }))
                  }
                  style={inputStyle}
                  placeholder="Transferencia, folio o comentario corto"
                />
              </label>
            </div>

            <label style={fieldWrapStyle}>
              <span style={fieldLabelStyle}>Notas</span>
              <textarea
                value={paymentForm.notes}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                style={textareaStyle}
                placeholder="Notas internas del abono"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!savingPayment) setPaymentRecordId(null);
                }}
                style={ghostButtonStyle}
              >
                Cancelar
              </button>

              <UiButton onClick={handleSavePayment} icon={<Plus size={16} />}>
                {savingPayment ? "Guardando..." : "Guardar abono"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

const filterLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cellPrimaryStyle: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 700,
};

const cellPrimaryStrongStyle: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 800,
};

const cellSecondaryStyle: CSSProperties = {
  fontSize: 12,
  color: "#6B7280",
};

const tableActionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const tablePrimaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#1D4ED8",
  fontSize: 12,
  fontWeight: 700,
};

const detailTopGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const detailBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
};

const detailLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const detailSectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 10,
};

const detailSectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const notesBoxStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: 12,
  fontSize: 13,
  color: "#4B5563",
  lineHeight: 1.6,
};

const emptyInlineBoxStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px dashed #D1D5DB",
  background: "#F9FAFB",
  padding: 14,
  fontSize: 13,
  color: "#6B7280",
};

const detailListWrapStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const detailListItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
};

const invoiceIconWrapStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "#EEF2FF",
  color: "#4338CA",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const paymentSummaryCardStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  padding: 14,
};

const paymentSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const simpleFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const fieldWrapStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  padding: "10px 12px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
  resize: "vertical",
};

const ghostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minWidth: 110,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#374151",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};