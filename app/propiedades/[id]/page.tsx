"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageContainer from "@/components/PageContainer";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyDetail {
  id: string;
  name: string;
  property_label: string | null;
  address: string | null;
  created_at: string;
}

interface SpaceRow {
  id: string;
  space_type: string;
  floor: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  total_sqm: number | null;
  is_divisible: boolean;
  is_rentable: boolean;
  space_template_id: string | null;
  code: string;
  display_code: string | null;
  status: string;
}

interface ChecklistState {
  hasTemplates: boolean;
  hasAssignedTemplates: boolean;
  hasActiveLease: boolean;
}

type ChecklistType = "casa" | "bodega_simple" | "multi" | "mixto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPACE_TYPE_LABEL: Record<string, string> = {
  apartment: "Departamento",
  house: "Casa",
  commercial_local: "Local comercial",
  office: "Oficina",
  warehouse: "Bodega",
  land_lot: "Terreno",
  parking: "Estacionamiento",
  amenity: "Amenidad",
  service_area: "Área de servicio",
};

function spaceTypeLabel(t: string): string {
  return SPACE_TYPE_LABEL[t] ?? t;
}

function getChecklistType(spaces: SpaceRow[]): ChecklistType {
  const types = [...new Set(spaces.map((s) => s.space_type))];
  if (types.length >= 2) return "mixto";
  const type = types[0] ?? "apartment";
  if (type === "house" && spaces.length === 1) return "casa";
  if ((type === "warehouse" || type === "land_lot") && spaces.length === 1) return "bodega_simple";
  return "multi";
}

function isSpaceConfigured(space: SpaceRow): boolean {
  const t = space.space_type;
  if (t === "house" || t === "apartment") {
    return space.bedrooms !== null || space.bathrooms !== null;
  }
  return space.total_sqm !== null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>({
    hasTemplates: false,
    hasAssignedTemplates: false,
    hasActiveLease: false,
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: propData, error: propErr } = await supabase
        .from("properties")
        .select("id, name, property_label, address, created_at")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (propErr || !propData) { setNotFound(true); setLoading(false); return; }
      setProperty(propData);

      const { data: spacesData } = await supabase
        .from("spaces")
        .select("id, space_type, floor, bedrooms, bathrooms, total_sqm, is_divisible, is_rentable, space_template_id, code, display_code, status")
        .eq("property_id", id)
        .is("deleted_at", null)
        .order("floor", { ascending: true });
      const spaceList: SpaceRow[] = spacesData ?? [];
      setSpaces(spaceList);

      const spaceIds = spaceList.map((s) => s.id);

      const [templatesRes, assignedRes] = await Promise.all([
        supabase.from("space_templates").select("id", { count: "exact", head: true })
          .eq("property_id", id).is("deleted_at", null),
        spaceIds.length > 0
          ? supabase.from("spaces").select("id", { count: "exact", head: true })
              .eq("property_id", id).not("space_template_id", "is", null).is("deleted_at", null)
          : Promise.resolve({ count: 0, data: null, error: null }),
      ]);

      let hasActiveLease = false;
      if (spaceIds.length > 0) {
        const { data: lsData } = await supabase
          .from("lease_spaces")
          .select("lease_id")
          .in("space_id", spaceIds);
        const leaseIds = [...new Set((lsData ?? []).map((r: { lease_id: string }) => r.lease_id))];
        if (leaseIds.length > 0) {
          const { data: activeLeases } = await supabase
            .from("leases")
            .select("id")
            .in("id", leaseIds)
            .eq("status", "ACTIVE")
            .is("deleted_at", null)
            .limit(1);
          hasActiveLease = (activeLeases?.length ?? 0) > 0;
        }
      }

      const assignedCount = spaceIds.length > 0 ? (assignedRes.count ?? 0) : 0;

      setChecklist({
        hasTemplates: (templatesRes.count ?? 0) > 0,
        hasAssignedTemplates: assignedCount > 0,
        hasActiveLease,
      });
    } catch (e) {
      console.error("Error loading property detail:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadData(); }, [loadData]);

  if (loading) return (
    <PageContainer>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 300, color: "var(--text-muted)", fontSize: "0.875rem" }}>
        Cargando…
      </div>
    </PageContainer>
  );

  if (notFound || !property) return (
    <PageContainer>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: 300, gap: 12 }}>
        <span style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
          Propiedad no encontrada.
        </span>
        <button type="button" onClick={() => router.push("/propiedades")}
          style={{ padding: "8px 18px", borderRadius: "var(--border-radius-sm)",
            border: "1px solid var(--border-default)", background: "var(--bg-card)",
            color: "var(--text-primary)", cursor: "pointer", fontSize: "0.875rem" }}>
          ← Volver a Propiedades
        </button>
      </div>
    </PageContainer>
  );

  const checklistType = getChecklistType(spaces);

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => router.push("/propiedades")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginBottom: 20, padding: "6px 0",
          background: "transparent", border: "none",
          color: "var(--text-secondary)", cursor: "pointer",
          fontSize: "0.8125rem", fontWeight: 500,
        }}
      >
        <ArrowLeft size={14} /> Propiedades
      </button>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--border-radius-md)",
            background: "var(--accent-tint-subtle)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Building2 size={22} color="var(--accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800,
              color: "var(--text-primary)", lineHeight: 1.2 }}>
              {property.name}
            </h1>
            {property.property_label && (
              <span style={{
                display: "inline-block", marginTop: 6, padding: "3px 10px",
                borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700,
                background: "var(--accent-tint-subtle)", color: "var(--accent)",
                border: "1px solid var(--accent-tint-medium)",
              }}>
                {property.property_label}
              </span>
            )}
            {property.address && (
              <p style={{ margin: "6px 0 0", fontSize: "0.8125rem",
                color: "var(--text-secondary)" }}>
                {property.address}
              </p>
            )}
          </div>
        </div>
      </div>

      <SetupChecklist
        type={checklistType}
        spaces={spaces}
        checklist={checklist}
      />

      <SpacesList spaces={spaces} />
    </PageContainer>
  );
}

// ─── SetupChecklist ───────────────────────────────────────────────────────────

interface SetupChecklistProps {
  type: ChecklistType;
  spaces: SpaceRow[];
  checklist: ChecklistState;
}

interface CheckStep {
  n: number;
  label: string;
  desc: string;
  done: boolean;
  enabled: boolean;
  upcoming?: boolean;
}

function buildSteps(type: ChecklistType, spaces: SpaceRow[], cl: ChecklistState): CheckStep[] {
  if (type === "casa") {
    const configured = spaces.length > 0 && isSpaceConfigured(spaces[0]);
    return [
      { n: 1, label: "Configurar la casa",   desc: "Define recámaras, baños y características",   done: configured,         enabled: true,       upcoming: !configured },
      { n: 2, label: "Configurar servicios", desc: "Da de alta medidores de luz, agua o gas",      done: false,              enabled: configured, upcoming: true },
      { n: 3, label: "Registrar contrato",   desc: "Registra el primer contrato de arrendamiento", done: cl.hasActiveLease,  enabled: true,      upcoming: false },
    ];
  }
  if (type === "bodega_simple") {
    const configured = spaces.length > 0 && isSpaceConfigured(spaces[0]);
    return [
      { n: 1, label: "Configurar el espacio", desc: "Define metraje y características",             done: configured,        enabled: true,       upcoming: !configured },
      { n: 2, label: "Configurar servicios",  desc: "Da de alta medidores de luz, agua o gas",      done: false,             enabled: configured, upcoming: true },
      { n: 3, label: "Registrar contrato",    desc: "Registra el primer contrato de arrendamiento", done: cl.hasActiveLease, enabled: true,      upcoming: false },
    ];
  }
  return [
    { n: 1, label: "Crear tipologías",         desc: "Define los tipos de unidad disponibles",        done: cl.hasTemplates,         enabled: true,                    upcoming: false },
    { n: 2, label: "Asignar tipologías",        desc: "Asigna cada espacio a una tipología",           done: cl.hasAssignedTemplates, enabled: cl.hasTemplates,         upcoming: false },
    { n: 3, label: "Configurar servicios",      desc: "Da de alta medidores de luz, agua o gas",       done: false,                   enabled: cl.hasAssignedTemplates, upcoming: true },
    { n: 4, label: "Registrar primer contrato", desc: "Registra el primer contrato de arrendamiento",  done: cl.hasActiveLease,       enabled: cl.hasAssignedTemplates, upcoming: false },
  ];
}

function SetupChecklist({ type, spaces, checklist }: SetupChecklistProps) {
  const steps = buildSteps(type, spaces, checklist);
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;

  if (doneCount === total) return null;

  const isEmpty = doneCount === 0;
  const circ = 2 * Math.PI * 14;
  const dashOff = circ * (1 - doneCount / total);

  return (
    <AnimatePresence>
      <motion.div
        key="setup-checklist"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginBottom: 24 }}
      >
        <div style={{
          borderRadius: "var(--border-radius-lg)",
          background: isEmpty ? "var(--accent-tint-subtle)" : "var(--bg-card)",
          border: isEmpty ? "1.5px solid var(--accent-tint-medium)" : "1px solid var(--border-default)",
          borderLeft: "4px solid var(--accent)",
          padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEmpty ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <PartyPopper size={18} color="var(--accent)" />
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                      ¡Tu propiedad está lista! Configúrala paso a paso.
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Sigue estos {total} pasos para dejar tu propiedad completamente operativa.
                  </p>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} color="var(--accent)" />
                  <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                    Configuración en progreso — {doneCount}/{total} completados
                  </span>
                </div>
              )}
            </div>
            <svg width="36" height="36" style={{ flexShrink: 0 }}>
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border-default)" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke="var(--accent)" strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOff}
                transform="rotate(-90 18 18)"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
              <text x="18" y="23" textAnchor="middle" fontSize="9" fill="var(--text-primary)" fontWeight="700">
                {doneCount}/{total}
              </text>
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((step) => (
              <div
                key={step.n}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  borderRadius: "var(--border-radius-md)",
                  background: step.done ? "rgba(16,185,129,0.06)" : step.enabled && !step.upcoming ? "var(--bg-page)" : "transparent",
                  border: step.done ? "1px solid rgba(16,185,129,0.2)" : step.enabled ? "1px solid var(--border-default)" : "1px solid transparent",
                  opacity: (!step.done && !step.enabled) ? 0.45 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {step.done ? (
                  <CheckCircle2 size={22} color="var(--metric-value-green)" style={{ flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                    background: step.enabled ? "var(--accent)" : "var(--border-default)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.6875rem", fontWeight: 800,
                    color: step.enabled ? "var(--text-inverse, #fff)" : "var(--text-muted)",
                  }}>
                    {step.n}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.8125rem", fontWeight: 600,
                    color: step.done ? "var(--metric-value-green)" : step.enabled ? "var(--text-primary)" : "var(--text-muted)",
                    textDecoration: step.done ? "line-through" : "none",
                  }}>
                    {step.label}
                  </div>
                  {!step.done && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 1 }}>
                      {step.enabled ? step.desc : `Completa el paso ${step.n - 1} primero`}
                    </div>
                  )}
                </div>
                {!step.done && step.upcoming && (
                  <span style={{
                    fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)",
                    padding: "4px 10px", borderRadius: 999,
                    border: "1px solid var(--border-default)", flexShrink: 0,
                  }}>
                    Próximamente
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── SpacesList ────────────────────────────────────────────────────────────────

function SpacesList({ spaces }: { spaces: SpaceRow[] }) {
  if (spaces.length === 0) return null;

  return (
    <div style={{
      borderRadius: "var(--border-radius-lg)",
      border: "1px solid var(--border-default)",
      background: "var(--bg-card)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--border-default)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
          Espacios
        </span>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          {spaces.length} {spaces.length === 1 ? "espacio" : "espacios"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {spaces.map((space, idx) => (
          <SpaceRow key={space.id} space={space} isLast={idx === spaces.length - 1} />
        ))}
      </div>
    </div>
  );
}

function SpaceRow({ space, isLast }: { space: SpaceRow; isLast: boolean }) {
  const label = spaceTypeLabel(space.space_type);
  const floorLabel = space.floor ? `Piso ${space.floor}` : null;
  const bedroomsLabel = space.bedrooms !== null ? `${space.bedrooms} rec.` : null;
  const bathroomsLabel = space.bathrooms !== null ? `${space.bathrooms} baños` : null;
  const sqmLabel = space.total_sqm !== null ? `${space.total_sqm} m²` : null;

  const attrs: string[] = [];
  if (bedroomsLabel) attrs.push(bedroomsLabel);
  if (bathroomsLabel) attrs.push(bathroomsLabel);
  if (sqmLabel) attrs.push(sqmLabel);
  if (space.is_divisible) attrs.push("Divisible");

  const statusColor = space.status === "RENTED" ? "var(--metric-value-green)"
    : space.status === "MAINTENANCE" ? "var(--color-warning, #f59e0b)"
    : "var(--text-muted)";
  const statusLabel = space.status === "RENTED" ? "Rentado"
    : space.status === "MAINTENANCE" ? "Mantenimiento"
    : "Vacío";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
      borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            {space.display_code ?? space.code}
          </span>
          <span style={{
            fontSize: "0.6875rem", color: "var(--text-secondary)",
            padding: "2px 8px", borderRadius: 999,
            background: "var(--bg-page)", border: "1px solid var(--border-subtle)",
          }}>
            {label}
          </span>
          {floorLabel && (
            <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
              {floorLabel}
            </span>
          )}
        </div>
        {attrs.length > 0 ? (
          <div style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {attrs.join(" · ")}
          </div>
        ) : (
          <div style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            Sin configurar
          </div>
        )}
      </div>
      <span style={{
        fontSize: "0.6875rem", fontWeight: 600, color: statusColor, flexShrink: 0,
      }}>
        {statusLabel}
      </span>
    </div>
  );
}
