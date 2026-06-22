"use client";

/*
  Página /propiedades — modelo nuevo de espacios.
  Lista las properties del esquema refactorizado.
  NO toca /buildings ni el modelo viejo.
*/

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import EntityCard from "@/components/EntityCard";
import AppEmptyState from "@/components/AppEmptyState";
import UiButton from "@/components/UiButton";
import PropertyWizardModal from "@/components/PropertyWizardModal";
import { supabase } from "@/lib/supabaseClient";
import { useActiveCompanyId } from "@/lib/useActiveCompanyId";
import { staggerContainer, staggerItem } from "@/lib/animations";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyRow {
  id: string;
  name: string;
  property_label: string | null;
  address: string | null;
  is_test: boolean;
  total_spaces: number;
  rented_spaces: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropiedadesPage() {
  const companyId = useActiveCompanyId();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const loadProperties = useCallback(async () => {
    if (!companyId) {
      setProperties([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Load properties with space counts
      const { data, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          property_label,
          address,
          is_test,
          spaces (
            id,
            status,
            is_rentable
          )
        `)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows: PropertyRow[] = (data ?? []).map((p) => {
        const rentable = (p.spaces as { id: string; status: string; is_rentable: boolean }[])
          .filter((s) => s.is_rentable);
        return {
          id: p.id,
          name: p.name,
          property_label: p.property_label,
          address: p.address,
          is_test: p.is_test,
          total_spaces: rentable.length,
          rented_spaces: rentable.filter((s) => s.status === "RENTED").length,
        };
      });

      setProperties(rows);
    } catch (e) {
      console.error("Error loading properties:", e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  return (
    <PageContainer>
      <PageHeader
        title="Propiedades"
        subtitle="Modelo nuevo — properties, spaces y contratos multi-espacio"
        titleIcon={<Building2 size={22} />}
        actions={
          <UiButton
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setWizardOpen(true)}
          >
            Nueva propiedad
          </UiButton>
        }
      />

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
            color: "var(--text-muted)",
            fontSize: "0.875rem",
          }}
        >
          Cargando propiedades…
        </div>
      ) : properties.length === 0 ? (
        <AppEmptyState
          title="Sin propiedades aún"
          description="Crea tu primera propiedad en el modelo nuevo para comenzar a gestionar espacios y contratos."
          actionLabel="Nueva propiedad"
          onAction={() => setWizardOpen(true)}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
            gap: 16,
          }}
        >
          {properties.map((p) => (
            <motion.div key={p.id} variants={staggerItem}>
              <PropertyCard property={p} onClick={() => router.push(`/propiedades/${p.id}`)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <PropertyWizardModal
        open={wizardOpen}
        companyId={companyId}
        isTest={false}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => void loadProperties()}
      />
    </PageContainer>
  );
}

// ─── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({ property: p, onClick }: { property: PropertyRow; onClick?: () => void }) {
  const occupancy =
    p.total_spaces > 0 ? Math.round((p.rented_spaces / p.total_spaces) * 100) : null;

  return (
    <EntityCard
      title={p.name}
      onClick={onClick}
      subtitle={p.address ?? undefined}
      badge={
        p.property_label ? (
          <span
            style={{
              display: "inline-flex",
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: "0.6875rem",
              fontWeight: 600,
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              marginTop: 4,
            }}
          >
            {p.property_label}
          </span>
        ) : undefined
      }
      metrics={
        p.total_spaces > 0
          ? [
              { label: "Total", value: p.total_spaces },
              { label: "Rentados", value: p.rented_spaces },
              {
                label: "Ocupación",
                value: `${occupancy}%`,
                color:
                  occupancy !== null && occupancy >= 75
                    ? "var(--badge-text-green)"
                    : occupancy !== null && occupancy >= 40
                    ? "var(--badge-text-amber)"
                    : "var(--text-muted)",
              },
            ]
          : undefined
      }
      statusIndicator={
        p.total_spaces > 0 && occupancy !== null ? (
          <OccupancyDonut pct={occupancy} />
        ) : undefined
      }
    />
  );
}

// ─── Mini donut de ocupación ──────────────────────────────────────────────────

function OccupancyDonut({ pct }: { pct: number }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const filled = (pct / 100) * circumference;
  const color =
    pct >= 75
      ? "var(--badge-text-green)"
      : pct >= 40
      ? "var(--badge-text-amber)"
      : "var(--text-muted)";

  return (
    <svg width={64} height={64} viewBox="0 0 64 64">
      <circle
        cx={32}
        cy={32}
        r={r}
        fill="none"
        stroke="var(--border-default)"
        strokeWidth={6}
      />
      <circle
        cx={32}
        cy={32}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text
        x={32}
        y={37}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="var(--text-primary)"
      >
        {pct}%
      </text>
    </svg>
  );
}
