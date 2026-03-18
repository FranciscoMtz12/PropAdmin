"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Droplets,
  Eye,
  FileUp,
  Home,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppSelect from "@/components/AppSelect";
import MetricCard from "@/components/MetricCard";
import UiButton from "@/components/UiButton";


type PendingUploadRow = {
  id: string;
  company_id: string | null;
  building_id: string;
  unit_id: string;
  lease_id: string;
  tenant_id: string;
  period_year: number;
  period_month: number;
  concept_code: "rent" | "electricity" | "water";
  status: "pending_upload" | "completed";
  invoice_generation_tracking_id: string | null;
  linked_collection_record_id: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  building_name: string | null;
  unit_name: string | null;
};

type BuildingOption = {
  id: string;
  name: string;
};

const sectionTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6B7280",
};

const strongValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const badgeBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

function getConceptLabel(concept: PendingUploadRow["concept_code"]) {
  if (concept === "rent") return "Renta";
  if (concept === "electricity") return "Electricidad";
  return "Agua";
}

function getConceptIcon(concept: PendingUploadRow["concept_code"]) {
  if (concept === "rent") return <Home size={16} />;
  if (concept === "electricity") return <Zap size={16} />;
  return <Droplets size={16} />;
}

function getMonthLabel(month: number) {
  const date = new Date(2026, month - 1, 1);
  return date.toLocaleDateString("es-MX", {
    month: "long",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PendingInvoiceUploadsPage() {
  const { user } = useCurrentUser();
  const router = useRouter();

  const [rows, setRows] = useState<PendingUploadRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const currentDate = useMemo(() => new Date(), []);
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    if (!user?.company_id) return;
    void loadData();
  }, [user?.company_id]);

  async function loadData() {
    if (!user?.company_id) return;

    setLoading(true);
    setPageError("");

    try {
      const [{ data: pendingData, error: pendingError }, { data: buildingsData, error: buildingsError }] =
        await Promise.all([
          supabase
            .from("invoice_pending_uploads_view")
            .select("*")
            .eq("company_id", user.company_id)
            .eq("status", "pending_upload")
            .order("created_at", { ascending: false }),
          supabase
            .from("buildings")
            .select("id, name")
            .eq("company_id", user.company_id)
            .order("name", { ascending: true }),
        ]);

      if (pendingError) {
        throw pendingError;
      }

      if (buildingsError) {
        throw buildingsError;
      }

      setRows((pendingData || []) as PendingUploadRow[]);
      setBuildings((buildingsData || []) as BuildingOption[]);
    } catch (error: any) {
      console.error("Error cargando pendientes de factura:", error);
      setPageError(
        error?.message || "No se pudieron cargar los pendientes de factura."
      );
      setRows([]);
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedBuildingId !== "all" && row.building_id !== selectedBuildingId) {
        return false;
      }

      if (selectedMonth !== "all") {
        const [yearText, monthText] = selectedMonth.split("-");
        const year = Number(yearText);
        const month = Number(monthText);

        if (row.period_year !== year || row.period_month !== month) {
          return false;
        }
      }

      return true;
    });
  }, [rows, selectedBuildingId, selectedMonth]);

  const availableMonthOptions = useMemo(() => {
    const keys = Array.from(
      new Set(rows.map((row) => `${row.period_year}-${String(row.period_month).padStart(2, "0")}`))
    ).sort((a, b) => b.localeCompare(a));

    return keys.map((key) => {
      const [yearText, monthText] = key.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      return {
        value: key,
        label: `${getMonthLabel(month)} ${year}`,
      };
    });
  }, [rows]);

  const currentPeriodCount = rows.filter(
    (row) => row.period_year === currentYear && row.period_month === currentMonth
  ).length;

  const groupedByConcept = useMemo(() => {
    return {
      rent: filteredRows.filter((row) => row.concept_code === "rent").length,
      electricity: filteredRows.filter((row) => row.concept_code === "electricity").length,
      water: filteredRows.filter((row) => row.concept_code === "water").length,
    };
  }, [filteredRows]);

  return (
    <PageContainer>
      <PageHeader
        title="Falta cargar factura"
        subtitle="Facturas ya generadas externamente que aún no tienen XML/PDF cargado en el sistema."
        titleIcon={<Upload size={20} />}
        actions={
          <UiButton variant="secondary" onClick={() => router.push("/collections")} icon={<Wallet size={16} />}>
            Volver a cobranza
          </UiButton>
        }
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Pendientes"
          value={String(filteredRows.length)}
          helper="Falta cargar XML/PDF"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: filteredRows.length > 0 ? "#FEF3C7" : "#F3F4F6",
                display: "grid",
                placeItems: "center",
              }}
            >
              <FileUp size={18} color={filteredRows.length > 0 ? "#D97706" : "#4B5563"} />
            </div>
          }
        />

        <MetricCard
          label="Periodo actual"
          value={String(currentPeriodCount)}
          helper={`${getMonthLabel(currentMonth)} ${currentYear}`}
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#EEF2FF",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CalendarClock size={18} color="#4338CA" />
            </div>
          }
        />

        <MetricCard
          label="Renta"
          value={String(groupedByConcept.rent)}
          helper="Pendientes filtrados"
          icon={<Home size={18} />}
        />

        <MetricCard
          label="Electricidad / Agua"
          value={String(groupedByConcept.electricity + groupedByConcept.water)}
          helper="Servicios filtrados"
          icon={<Zap size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      {pageError ? (
        <AppCard
          style={{
            marginBottom: 18,
            border: "1px solid #FECACA",
            background: "#FEF2F2",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "#FEE2E2",
                color: "#B91C1C",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Ocurrió un problema
              </div>
              <div style={sectionTextStyle}>{pageError}</div>
            </div>
          </div>
        </AppCard>
      ) : null}

      <AppCard style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ ...sectionTextStyle, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              Filtrar por edificio
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

          <div>
            <div style={{ ...sectionTextStyle, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              Filtrar por periodo
            </div>
            <AppSelect
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              <option value="all">Todos los periodos</option>
              {availableMonthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </div>
        </div>
      </AppCard>

      {loading ? (
        <AppCard>
          <div style={sectionTextStyle}>Cargando pendientes de factura...</div>
        </AppCard>
      ) : null}

      {!loading && filteredRows.length === 0 ? (
        <AppCard>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ ...strongValueStyle, fontSize: 18 }}>No hay pendientes de factura</div>
            <div style={sectionTextStyle}>
              Cuando marques una factura como generada en el control mensual, aparecerá aquí hasta que cargues su XML/PDF real.
            </div>
          </div>
        </AppCard>
      ) : null}

      {!loading && filteredRows.length > 0 ? (
        <div style={{ display: "grid", gap: 16 }}>
          {filteredRows.map((row) => (
            <AppCard key={row.id}>
              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={strongValueStyle}>{row.tenant_name || "Inquilino sin nombre"}</div>
                    <div style={sectionTextStyle}>{row.tenant_email || "Sin correo disponible"}</div>
                  </div>

                  <span
                    style={{
                      ...badgeBaseStyle,
                      background: "#FEF3C7",
                      border: "1px solid #FDE68A",
                      color: "#92400E",
                    }}
                  >
                    <Upload size={14} />
                    Pendiente de cargar
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={sectionTextStyle}>Edificio</div>
                    <div style={strongValueStyle}>{row.building_name || "Edificio"}</div>
                  </div>

                  <div>
                    <div style={sectionTextStyle}>Unidad</div>
                    <div style={strongValueStyle}>{row.unit_name || "Unidad"}</div>
                  </div>

                  <div>
                    <div style={sectionTextStyle}>Concepto</div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#111827",
                      }}
                    >
                      {getConceptIcon(row.concept_code)}
                      {getConceptLabel(row.concept_code)}
                    </div>
                  </div>

                  <div>
                    <div style={sectionTextStyle}>Periodo</div>
                    <div style={strongValueStyle}>
                      {getMonthLabel(row.period_month)} {row.period_year}
                    </div>
                  </div>
                </div>

                <div style={sectionTextStyle}>
                  Marcada para seguimiento el {formatDateTime(row.created_at)}.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <UiButton
                    variant="secondary"
                    onClick={() => router.push("/collections/invoice-generation")}
                    icon={<Eye size={16} />}
                  >
                    Ver control mensual
                  </UiButton>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      ) : null}
    </PageContainer>
  );
}
