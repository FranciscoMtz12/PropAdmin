"use client";

/*
  Módulo de Cobranza.

  Esta página usa la base operativa:
  - collection_schedules
  - collection_records

  Objetivo:
  - mostrar cobros administrativos a inquilinos
  - identificar pendientes, cobrados y vencidos
  - filtrar por edificio y estado
  - mantener continuidad visual con Payments, Calendar y el resto del sistema

  Importante:
  - esta pantalla NO usa invoices
  - esta pantalla NO es facturación formal
  - esta pantalla es para control administrativo interno de cobranza
*/

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppTable from "@/components/AppTable";
import AppSelect from "@/components/AppSelect";

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

type Lease = {
  id: string;
  unit_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
};

type CollectionSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  lease_id: string | null;
  charge_type:
    | "rent"
    | "maintenance_fee"
    | "services"
    | "parking"
    | "penalty"
    | "other";
  title: string;
  responsibility_type: "tenant" | "owner" | "other";
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
  status: "pending" | "collected" | "overdue";
  collected_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

type CollectionStatusFilter = "all" | "pending" | "collected" | "overdue";

type CollectionRow = {
  id: string;
  buildingId: string;
  buildingName: string;
  unitLabel: string;
  tenantLabel: string;
  title: string;
  chargeTypeLabel: string;
  periodLabel: string;
  dueDate: string;
  dueDateLabel: string;
  amountDue: number;
  amountDueLabel: string;
  amountCollectedLabel: string;
  status: "pending" | "collected" | "overdue";
  statusLabel: string;
  paymentMethodLabel: string;
  notes: string;
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

function formatDate(dateKey: string) {
  if (!dateKey) return "Sin fecha";

  const date = parseDateOnly(dateKey);

  return `${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
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

function getChargeTypeLabel(type: CollectionSchedule["charge_type"]) {
  if (type === "rent") return "Renta";
  if (type === "maintenance_fee") return "Mantenimiento";
  if (type === "services") return "Servicios";
  if (type === "parking") return "Estacionamiento";
  if (type === "penalty") return "Penalización";
  return "Otro";
}

function getStatusLabel(status: CollectionRow["status"]) {
  if (status === "collected") return "Cobrado";
  if (status === "pending") return "Pendiente";
  return "Vencido";
}

function getStatusColors(status: CollectionRow["status"]) {
  if (status === "collected") {
    return {
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
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

export default function CollectionsPage() {
  const { user, loading } = useCurrentUser();

  const [loadingPage, setLoadingPage] = useState(true);
  const [message, setMessage] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [collectionSchedules, setCollectionSchedules] = useState<CollectionSchedule[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);

  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<CollectionStatusFilter>("all");

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;

    loadCollectionsData();
  }, [loading, user?.company_id]);

  async function loadCollectionsData() {
    if (!user?.company_id) return;

    setLoadingPage(true);
    setMessage("");

    const [buildingsRes, unitsRes, leasesRes, schedulesRes, recordsRes] = await Promise.all([
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
        .from("leases")
        .select("id, unit_id, tenant_name, tenant_email")
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

    setBuildings((buildingsRes.data as Building[]) || []);
    setUnits((unitsRes.data as Unit[]) || []);
    setLeases((leasesRes.data as Lease[]) || []);
    setCollectionSchedules((schedulesRes.data as CollectionSchedule[]) || []);
    setCollectionRecords((recordsRes.data as CollectionRecord[]) || []);
    setLoadingPage(false);
  }

  const collectionRows = useMemo<CollectionRow[]>(() => {
    const buildingMap = new Map<string, Building>();
    const unitMap = new Map<string, Unit>();
    const leaseMap = new Map<string, Lease>();
    const scheduleMap = new Map<string, CollectionSchedule>();

    buildings.forEach((building) => buildingMap.set(building.id, building));
    units.forEach((unit) => unitMap.set(unit.id, unit));
    leases.forEach((lease) => leaseMap.set(lease.id, lease));
    collectionSchedules.forEach((schedule) => scheduleMap.set(schedule.id, schedule));

    return collectionRecords
      .map((record) => {
        const schedule = scheduleMap.get(record.collection_schedule_id);
        if (!schedule) return null;

        const building = buildingMap.get(record.building_id) || buildingMap.get(schedule.building_id);
        const unit = unitMap.get(record.unit_id) || unitMap.get(schedule.unit_id);
        const lease =
          (record.lease_id ? leaseMap.get(record.lease_id) : null) ||
          (schedule.lease_id ? leaseMap.get(schedule.lease_id) : null);

        const unitLabel = unit?.display_code || unit?.unit_number || "Unidad";
        const tenantLabel =
          lease?.tenant_name || lease?.tenant_email || "Sin inquilino asignado";

        return {
          id: record.id,
          buildingId: record.building_id,
          buildingName: building?.name || "Edificio",
          unitLabel: `Unidad ${unitLabel}`,
          tenantLabel,
          title: schedule.title,
          chargeTypeLabel: getChargeTypeLabel(schedule.charge_type),
          periodLabel: formatPeriod(record.period_year, record.period_month),
          dueDate: record.due_date,
          dueDateLabel: formatDate(record.due_date),
          amountDue: record.amount_due,
          amountDueLabel: formatCurrency(record.amount_due),
          amountCollectedLabel: formatCurrency(record.amount_collected),
          status: record.status,
          statusLabel: getStatusLabel(record.status),
          paymentMethodLabel: record.payment_method || "—",
          notes: record.notes || schedule.notes || "—",
        };
      })
      .filter((row): row is CollectionRow => Boolean(row));
  }, [buildings, units, leases, collectionSchedules, collectionRecords]);

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
      : buildings.find((building) => building.id === selectedBuildingId)?.name || "Edificio";

  const totalRecords = filteredRows.length;
  const collectedCount = filteredRows.filter((row) => row.status === "collected").length;
  const pendingCount = filteredRows.filter((row) => row.status === "pending").length;
  const overdueCount = filteredRows.filter((row) => row.status === "overdue").length;

  const pendingAmount = filteredRows
    .filter((row) => row.status === "pending" || row.status === "overdue")
    .reduce((sum, row) => sum + row.amountDue, 0);

  const todayKey = getTodayDateOnlyKey();

  const nextPendingLabel = useMemo(() => {
    const nextPending = filteredRows
      .filter((row) => row.status === "pending" && row.dueDate >= todayKey)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    if (!nextPending) return "Sin próximos cobros";
    return `${nextPending.title} · ${nextPending.dueDateLabel}`;
  }, [filteredRows, todayKey]);

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
      <PageHeader
        title="Cobranza"
        subtitle="Control administrativo para saber qué se debe cobrar, a quién y en qué estado va cada cobro."
        titleIcon={<Wallet size={18} />}
      />

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
          helper="Cobros realizados"
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
          label="Monto pendiente"
          value={formatCurrency(pendingAmount)}
          helper="Pendiente + vencido"
          icon={<CalendarDays size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Filtros"
        subtitle="Ajusta la vista por edificio y estado del cobro."
        icon={<Filter size={18} />}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <AppCard>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
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
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
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
                <option value="collected">Cobrado</option>
                <option value="overdue">Vencido</option>
              </AppSelect>
            </div>
          </AppCard>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Listado de cobranza"
        subtitle="Vista operativa para seguimiento de cobros por edificio, unidad e inquilino."
        icon={<Wallet size={18} />}
      >
        <AppTable
          rows={filteredRows}
          emptyState="No hay registros de cobranza para mostrar con los filtros actuales."
          columns={[
            {
              key: "concept",
              header: "Concepto",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    {row.title}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    {row.chargeTypeLabel}
                  </span>
                </div>
              ),
            },
            {
              key: "building",
              header: "Edificio / unidad",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {row.buildingName}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    {row.unitLabel}
                  </span>
                </div>
              ),
            },
            {
              key: "tenant",
              header: "Inquilino",
              render: (row: CollectionRow) => (
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  {row.tenantLabel}
                </span>
              ),
            },
            {
              key: "period",
              header: "Periodo",
              render: (row: CollectionRow) => (
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  {row.periodLabel}
                </span>
              ),
            },
            {
              key: "dueDate",
              header: "Vencimiento",
              render: (row: CollectionRow) => (
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  {row.dueDateLabel}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Monto",
              align: "right",
              render: (row: CollectionRow) => (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#111827",
                  }}
                >
                  {row.amountDueLabel}
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
              key: "collected",
              header: "Cobrado / método",
              render: (row: CollectionRow) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#374151",
                    }}
                  >
                    {row.amountCollectedLabel}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#9CA3AF",
                    }}
                  >
                    {row.paymentMethodLabel}
                  </span>
                </div>
              ),
            },
            {
              key: "notes",
              header: "Notas",
              render: (row: CollectionRow) => (
                <span
                  style={{
                    fontSize: 12,
                    color: "#6B7280",
                  }}
                >
                  {row.notes}
                </span>
              ),
            },
          ]}
        />
      </SectionCard>
    </PageContainer>
  );
}
