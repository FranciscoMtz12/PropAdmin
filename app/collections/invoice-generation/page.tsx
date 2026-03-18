"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  Bolt,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  FileText,
  Home,
  RefreshCcw,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import UiButton from "@/components/UiButton";
import MetricCard from "@/components/MetricCard";

type ExpectedInvoiceItemRow = {
  lease_id: string;
  company_id: string | null;
  building_id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string | null;
  end_date: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  unit_name: string | null;
  building_name: string | null;
  concept_code: "rent" | "electricity" | "water";
};

type TrackingRow = {
  id: string;
  company_id: string | null;
  building_id: string;
  unit_id: string;
  lease_id: string;
  tenant_id: string;
  period_year: number;
  period_month: number;
  concept_code: "rent" | "electricity" | "water";
  status: "pending" | "generated";
  marked_at: string | null;
  marked_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ConceptCode = "rent" | "electricity" | "water";
type GeneralStatus = "pending" | "partial" | "generated";

type LeaseConceptItem = {
  concept_code: ConceptCode;
  status: "pending" | "generated";
  tracking_id: string | null;
  marked_at: string | null;
  notes: string | null;
};

type LeaseInvoiceGroup = {
  lease_id: string;
  company_id: string | null;
  building_id: string;
  unit_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  unit_name: string;
  building_name: string;
  start_date: string | null;
  end_date: string | null;
  concepts: LeaseConceptItem[];
  general_status: GeneralStatus;
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

function getCurrentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function getMonthLabel(month: number) {
  const date = new Date(2026, month - 1, 1);
  return date.toLocaleDateString("es-MX", {
    month: "long",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function getConceptLabel(concept: ConceptCode) {
  if (concept === "rent") return "Renta";
  if (concept === "electricity") return "Electricidad";
  return "Agua";
}

function getConceptIcon(concept: ConceptCode) {
  if (concept === "rent") return <Home size={16} />;
  if (concept === "electricity") return <Bolt size={16} />;
  return <Droplets size={16} />;
}

function getGeneralStatusFromConcepts(
  concepts: LeaseConceptItem[]
): GeneralStatus {
  if (!concepts.length) return "pending";

  const generatedCount = concepts.filter(
    (item) => item.status === "generated"
  ).length;

  if (generatedCount === 0) return "pending";
  if (generatedCount === concepts.length) return "generated";
  return "partial";
}

function getGeneralStatusVisual(status: GeneralStatus) {
  if (status === "generated") {
    return {
      label: "Facturas generadas",
      background: "#ECFDF5",
      border: "#A7F3D0",
      color: "#166534",
      icon: <CheckCircle2 size={14} />,
    };
  }

  if (status === "partial") {
    return {
      label: "Parcial",
      background: "#EEF2FF",
      border: "#C7D2FE",
      color: "#3730A3",
      icon: <FileText size={14} />,
    };
  }

  return {
    label: "Pendiente de generar",
    background: "#FEF3C7",
    border: "#FDE68A",
    color: "#92400E",
    icon: <CalendarClock size={14} />,
  };
}

function getConceptStatusVisual(status: "pending" | "generated") {
  if (status === "generated") {
    return {
      label: "Generada",
      background: "#ECFDF5",
      border: "#A7F3D0",
      color: "#166534",
    };
  }

  return {
    label: "Pendiente",
    background: "#FEF3C7",
    border: "#FDE68A",
    color: "#92400E",
  };
}

function buildLeaseGroups(
  expectedRows: ExpectedInvoiceItemRow[],
  trackingRows: TrackingRow[],
  periodYear: number,
  periodMonth: number
): LeaseInvoiceGroup[] {
  const trackingMap = new Map<string, TrackingRow>();

  for (const row of trackingRows) {
    if (row.period_year !== periodYear || row.period_month !== periodMonth) {
      continue;
    }

    trackingMap.set(`${row.lease_id}::${row.concept_code}`, row);
  }

  const groupsMap = new Map<string, LeaseInvoiceGroup>();

  for (const row of expectedRows) {
    const key = row.lease_id;
    const tracking = trackingMap.get(`${row.lease_id}::${row.concept_code}`);

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        lease_id: row.lease_id,
        company_id: row.company_id,
        building_id: row.building_id,
        unit_id: row.unit_id,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name || "Inquilino sin nombre",
        tenant_email: row.tenant_email || "Sin correo disponible",
        unit_name: row.unit_name || "Unidad",
        building_name: row.building_name || "Edificio",
        start_date: row.start_date,
        end_date: row.end_date,
        concepts: [],
        general_status: "pending",
      });
    }

    const group = groupsMap.get(key)!;

    group.concepts.push({
      concept_code: row.concept_code,
      status: tracking?.status || "pending",
      tracking_id: tracking?.id || null,
      marked_at: tracking?.marked_at || null,
      notes: tracking?.notes || null,
    });
  }

  const groups = Array.from(groupsMap.values()).map((group) => {
    const conceptSortOrder: Record<ConceptCode, number> = {
      rent: 1,
      electricity: 2,
      water: 3,
    };

    const sortedConcepts = [...group.concepts].sort(
      (a, b) => conceptSortOrder[a.concept_code] - conceptSortOrder[b.concept_code]
    );

    return {
      ...group,
      concepts: sortedConcepts,
      general_status: getGeneralStatusFromConcepts(sortedConcepts),
    };
  });

  return groups.sort((a, b) => {
    const buildingCompare = a.building_name.localeCompare(b.building_name, "es");
    if (buildingCompare !== 0) return buildingCompare;

    const unitCompare = a.unit_name.localeCompare(b.unit_name, "es");
    if (unitCompare !== 0) return unitCompare;

    return a.tenant_name.localeCompare(b.tenant_name, "es");
  });
}

export default function InvoiceGenerationPage() {
  const { user } = useCurrentUser();

  const [groups, setGroups] = useState<LeaseInvoiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [expandedLeaseIds, setExpandedLeaseIds] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const currentPeriod = useMemo(() => getCurrentPeriod(), []);
  const periodYear = currentPeriod.year;
  const periodMonth = currentPeriod.month;

  const isCompanyAdmin =
    user?.role === "admin" && !Boolean(user?.is_superadmin);

  async function loadData() {
    setLoading(true);
    setPageError("");

    try {
      let expectedQuery = supabase
        .from("invoice_generation_expected_items")
        .select("*")
        .order("building_name", { ascending: true })
        .order("unit_name", { ascending: true })
        .order("tenant_name", { ascending: true });

      let trackingQuery = supabase
        .from("invoice_generation_tracking")
        .select("*")
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth)
        .order("created_at", { ascending: false });

      if (isCompanyAdmin && user?.company_id) {
        expectedQuery = expectedQuery.eq("company_id", user.company_id);
        trackingQuery = trackingQuery.eq("company_id", user.company_id);
      }

      const [{ data: expectedData, error: expectedError }, { data: trackingData, error: trackingError }] =
        await Promise.all([expectedQuery, trackingQuery]);

      if (expectedError) {
        throw expectedError;
      }

      if (trackingError) {
        throw trackingError;
      }

      const expectedRows = (expectedData || []) as ExpectedInvoiceItemRow[];
      const trackingRows = (trackingData || []) as TrackingRow[];

      const builtGroups = buildLeaseGroups(
        expectedRows,
        trackingRows,
        periodYear,
        periodMonth
      );

      setGroups(builtGroups);
    } catch (error: any) {
      console.error("Error cargando control de facturación:", error);
      setPageError(
        error?.message || "No se pudo cargar el control de generación de facturas."
      );
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user?.id, user?.company_id, isCompanyAdmin, periodYear, periodMonth]);

  const pendingGroups = useMemo(
    () => groups.filter((item) => item.general_status === "pending"),
    [groups]
  );

  const partialGroups = useMemo(
    () => groups.filter((item) => item.general_status === "partial"),
    [groups]
  );

  const generatedGroups = useMemo(
    () => groups.filter((item) => item.general_status === "generated"),
    [groups]
  );

  const totalExpectedInvoices = useMemo(
    () => groups.reduce((sum, item) => sum + item.concepts.length, 0),
    [groups]
  );

  const totalGeneratedInvoices = useMemo(
    () =>
      groups.reduce(
        (sum, item) =>
          sum + item.concepts.filter((concept) => concept.status === "generated").length,
        0
      ),
    [groups]
  );

  function toggleExpanded(leaseId: string) {
    setExpandedLeaseIds((current) =>
      current.includes(leaseId)
        ? current.filter((id) => id !== leaseId)
        : [...current, leaseId]
    );
  }

  async function updateConceptStatus(
    group: LeaseInvoiceGroup,
    concept: LeaseConceptItem,
    nextStatus: "pending" | "generated"
  ) {
    if (!user?.id) {
      setPageError("No se encontró el usuario actual.");
      return;
    }

    const saveKey = `${group.lease_id}::${concept.concept_code}`;
    setSavingKey(saveKey);
    setPageError("");

    try {
      const trackingPayload = {
        company_id: group.company_id,
        building_id: group.building_id,
        unit_id: group.unit_id,
        lease_id: group.lease_id,
        tenant_id: group.tenant_id,
        period_year: periodYear,
        period_month: periodMonth,
        concept_code: concept.concept_code,
        status: nextStatus,
        marked_at: nextStatus === "generated" ? new Date().toISOString() : null,
        marked_by: nextStatus === "generated" ? user.id : null,
        notes: concept.notes || null,
      };

      const { data: trackingData, error: trackingError } = await supabase
        .from("invoice_generation_tracking")
        .upsert(trackingPayload, {
          onConflict: "lease_id,period_year,period_month,concept_code",
        })
        .select("id")
        .single();

      if (trackingError) {
        throw trackingError;
      }

      if (nextStatus === "generated") {
        const { error: pendingError } = await supabase
          .from("invoice_pending_uploads")
          .upsert(
            {
              company_id: group.company_id,
              building_id: group.building_id,
              unit_id: group.unit_id,
              lease_id: group.lease_id,
              tenant_id: group.tenant_id,
              period_year: periodYear,
              period_month: periodMonth,
              concept_code: concept.concept_code,
              status: "pending_upload",
              invoice_generation_tracking_id: trackingData?.id || null,
              linked_collection_record_id: null,
              completed_at: null,
              completed_by: null,
              notes: null,
            },
            {
              onConflict: "lease_id,period_year,period_month,concept_code",
            }
          );

        if (pendingError) {
          throw pendingError;
        }
      } else {
        const { error: pendingCleanupError } = await supabase
          .from("invoice_pending_uploads")
          .delete()
          .eq("lease_id", group.lease_id)
          .eq("period_year", periodYear)
          .eq("period_month", periodMonth)
          .eq("concept_code", concept.concept_code)
          .eq("status", "pending_upload");

        if (pendingCleanupError) {
          throw pendingCleanupError;
        }
      }

      await loadData();
    } catch (error: any) {
      console.error("Error actualizando estatus de factura:", error);
      setPageError(
        error?.message || "No se pudo actualizar el estatus de la factura."
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Generación de facturas"
        subtitle="Control mensual de facturas esperadas por contrato vigente según los conceptos configurados en cada edificio."
        titleIcon={<FileText size={20} />}
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Contratos pendientes"
          value={String(pendingGroups.length)}
          helper="Todos sus conceptos siguen pendientes"
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#FEF3C7",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CalendarClock size={18} color="#92400E" />
            </div>
          }
        />

        <MetricCard
          label="Parciales"
          value={String(partialGroups.length)}
          helper="Algunas facturas ya fueron generadas"
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
              <RefreshCcw size={18} color="#3730A3" />
            </div>
          }
        />

        <MetricCard
          label="Completos"
          value={String(generatedGroups.length)}
          helper="Todos sus conceptos ya están generados"
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
              <CheckCircle2 size={18} color="#166534" />
            </div>
          }
        />

        <MetricCard
          label="Facturas generadas"
          value={`${totalGeneratedInvoices}/${totalExpectedInvoices}`}
          helper={`${getMonthLabel(periodMonth)} ${periodYear}`}
          icon={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#F3F4F6",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Wallet size={18} color="#374151" />
            </div>
          }
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <AppCard style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ ...strongValueStyle, fontSize: 18 }}>
              Periodo actual
            </div>
            <div style={sectionTextStyle}>
              {getMonthLabel(periodMonth)} {periodYear}
            </div>
          </div>

          <UiButton
            variant="secondary"
            onClick={() => void loadData()}
            disabled={loading || Boolean(savingKey)}
          >
            Recargar
          </UiButton>
        </div>
      </AppCard>

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

      {loading ? (
        <AppCard>
          <div style={sectionTextStyle}>Cargando control de facturación...</div>
        </AppCard>
      ) : null}

      {!loading && groups.length === 0 ? (
        <AppCard>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ ...strongValueStyle, fontSize: 18 }}>
              No hay contratos vigentes para este periodo
            </div>
            <div style={sectionTextStyle}>
              Revisa que existan leases vigentes y que los edificios tengan
              conceptos de facturación activos.
            </div>
          </div>
        </AppCard>
      ) : null}

      {!loading && groups.length > 0 ? (
        <div style={{ display: "grid", gap: 16 }}>
          {groups.map((group) => {
            const isExpanded = expandedLeaseIds.includes(group.lease_id);
            const statusVisual = getGeneralStatusVisual(group.general_status);

            return (
              <AppCard key={group.lease_id}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ ...strongValueStyle, fontSize: 18 }}>
                        {group.tenant_name}
                      </div>

                      <div style={sectionTextStyle}>
                        {group.tenant_email}
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#374151",
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          <Home size={15} />
                          {group.unit_name}
                        </span>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#6B7280",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          <FileText size={15} />
                          {group.building_name}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        ...badgeBaseStyle,
                        background: statusVisual.background,
                        border: `1px solid ${statusVisual.border}`,
                        color: statusVisual.color,
                      }}
                    >
                      {statusVisual.icon}
                      {statusVisual.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={sectionTextStyle}>Inicio de vigencia</div>
                      <div style={strongValueStyle}>{formatDate(group.start_date)}</div>
                    </div>

                    <div>
                      <div style={sectionTextStyle}>Fin de vigencia</div>
                      <div style={strongValueStyle}>{formatDate(group.end_date)}</div>
                    </div>

                    <div>
                      <div style={sectionTextStyle}>Conceptos del periodo</div>
                      <div style={strongValueStyle}>{group.concepts.length}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(group.lease_id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid #D1D5DB",
                        background: "#FFFFFF",
                        color: "#374151",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={16} />
                          Ver menos detalles
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          Ver más detalles
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        borderTop: "1px solid #E5E7EB",
                        paddingTop: 14,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      {group.concepts.map((concept) => {
                        const conceptVisual = getConceptStatusVisual(concept.status);
                        const rowSavingKey = `${group.lease_id}::${concept.concept_code}`;
                        const isSaving = savingKey === rowSavingKey;

                        return (
                          <div
                            key={`${group.lease_id}-${concept.concept_code}`}
                            style={{
                              border: "1px solid #E5E7EB",
                              borderRadius: 14,
                              background: "#FAFAFA",
                              padding: 14,
                              display: "grid",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
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
                                {getConceptIcon(concept.concept_code)}
                                {getConceptLabel(concept.concept_code)}
                              </div>

                              <span
                                style={{
                                  ...badgeBaseStyle,
                                  background: conceptVisual.background,
                                  border: `1px solid ${conceptVisual.border}`,
                                  color: conceptVisual.color,
                                }}
                              >
                                {conceptVisual.label}
                              </span>
                            </div>

                            {concept.marked_at ? (
                              <div style={sectionTextStyle}>
                                Último cambio: {formatDateTime(concept.marked_at)}
                              </div>
                            ) : (
                              <div style={sectionTextStyle}>
                                Aún no se ha marcado este concepto en el periodo actual.
                              </div>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                              }}
                            >
                              <UiButton
                                variant="secondary"
                                onClick={() =>
                                  void updateConceptStatus(
                                    group,
                                    concept,
                                    "pending"
                                  )
                                }
                                disabled={isSaving}
                              >
                                {isSaving && concept.status === "generated"
                                  ? "Guardando..."
                                  : "Marcar pendiente"}
                              </UiButton>

                              <UiButton
                                onClick={() =>
                                  void updateConceptStatus(
                                    group,
                                    concept,
                                    "generated"
                                  )
                                }
                                disabled={isSaving}
                              >
                                {isSaving && concept.status === "pending"
                                  ? "Guardando..."
                                  : "Marcar generada"}
                              </UiButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </AppCard>
            );
          })}
        </div>
      ) : null}
    </PageContainer>
  );
}