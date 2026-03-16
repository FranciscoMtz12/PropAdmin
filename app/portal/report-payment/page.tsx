"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  Info,
  Search,
  Upload,
  User2,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import UiButton from "@/components/UiButton";

/*
========================================================
TIPOS
========================================================
*/

type TenantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
};

type LeaseRecord = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  units?: {
    id: string;
    unit_number: string | null;
    display_code: string | null;
    buildings?: {
      id: string | null;
      name: string | null;
    } | null;
  } | null;
};

type CollectionRecord = {
  id: string;
  lease_id: string | null;
  period_year: number;
  period_month: number;
  due_date: string;
  amount_due: number;
  amount_collected: number | null;
  status: string | null;
};

type SelectableDebt = {
  id: string;
  label: string;
  pendingAmount: number;
  dueDateLabel: string;
  buildingLabel: string;
  unitLabel: string;
  leaseId: string | null;
};

/*
========================================================
UTILIDADES
========================================================
*/

const MONTH_LABELS_SHORT = [
  "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"
];

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function formatDate(dateKey?: string | null) {
  if (!dateKey) return "Sin fecha";
  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(year: number, month: number) {
  return `${MONTH_LABELS_SHORT[month - 1]} ${year}`;
}

/*
========================================================
NORMALIZADORES
========================================================
*/

function normalizeTenantOption(raw: any): TenantOption {
  return {
    id: raw?.id ?? "",
    full_name: raw?.full_name ?? null,
    email: raw?.email ?? null,
    company_id: raw?.company_id ?? null,
  };
}

function normalizeLeaseRecord(raw: any): LeaseRecord {
  return {
    id: raw?.id ?? "",
    start_date: raw?.start_date ?? null,
    end_date: raw?.end_date ?? null,
    status: raw?.status ?? null,
    units: raw?.units
      ? {
          id: raw.units?.id ?? "",
          unit_number: raw.units?.unit_number ?? null,
          display_code: raw.units?.display_code ?? null,
          buildings: raw.units?.buildings
            ? {
                id: raw.units.buildings?.id ?? null,
                name: raw.units.buildings?.name ?? null,
              }
            : null,
        }
      : null,
  };
}

function normalizeCollectionRecord(raw: any): CollectionRecord {
  return {
    id: raw?.id ?? "",
    lease_id: raw?.lease_id ?? null,
    period_year: raw?.period_year ?? 0,
    period_month: raw?.period_month ?? 0,
    due_date: raw?.due_date ?? "",
    amount_due: raw?.amount_due ?? 0,
    amount_collected: raw?.amount_collected ?? 0,
    status: raw?.status ?? null,
  };
}

/*
========================================================
PAGE
========================================================
*/

export default function PortalReportPaymentPage() {

  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const previewTenantId = searchParams.get("tenantId");

  const isSuperAdmin = user?.role === "admin" && Boolean(user.is_superadmin);

  const effectiveTenantId =
    user?.role === "tenant"
      ? user.tenant_id
      : previewTenantId;

  /*
  =====================================
  STATE
  =====================================
  */

  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantSelectorValue, setTenantSelectorValue] = useState("");

  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);

  const [collectionRecordId, setCollectionRecordId] = useState("");

  const [amountReported, setAmountReported] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const [pageLoading, setPageLoading] = useState(true);

  /*
  =====================================
  CARGA DE TENANTS (preview superadmin)
  =====================================
  */

  useEffect(() => {
    async function loadTenants() {

      if (!isSuperAdmin) return;

      const { data } = await supabase
        .from("tenants")
        .select("id, full_name, email, company_id")
        .order("full_name");

      if (data) {
        setTenantOptions(data.map(normalizeTenantOption));
      }
    }

    loadTenants();

  }, [isSuperAdmin]);

  /*
  =====================================
  CARGA DE LEASES
  =====================================
  */

  useEffect(() => {

    async function loadData() {

      if (!effectiveTenantId) return;

      setPageLoading(true);

      const { data: leaseData } = await supabase
        .from("leases")
        .select(`
          id,
          start_date,
          end_date,
          status,
          units:unit_id(
            id,
            unit_number,
            display_code,
            buildings:building_id(
              id,
              name
            )
          )
        `)
        .eq("tenant_id", effectiveTenantId);

      const leasesNormalized = leaseData?.map(normalizeLeaseRecord) ?? [];

      setLeases(leasesNormalized);

      const leaseIds = leasesNormalized.map((l) => l.id);

      if (!leaseIds.length) {
        setCollectionRecords([]);
        setPageLoading(false);
        return;
      }

      const { data: collections } = await supabase
        .from("collection_records")
        .select(`
          id,
          lease_id,
          period_year,
          period_month,
          due_date,
          amount_due,
          amount_collected,
          status
        `)
        .in("lease_id", leaseIds)
        .order("due_date");

      setCollectionRecords(
        collections?.map(normalizeCollectionRecord) ?? []
      );

      setPageLoading(false);
    }

    loadData();

  }, [effectiveTenantId]);

  /*
  =====================================
  DEUDAS DISPONIBLES
  =====================================
  */

  const selectableDebts = useMemo<SelectableDebt[]>(() => {

    const leaseMap = new Map(leases.map((l) => [l.id, l]));

    return collectionRecords
      .map((record) => {

        const due = Number(record.amount_due);
        const paid = Number(record.amount_collected || 0);

        const pending = Math.max(due - paid, 0);

        if (pending <= 0) return null;

        const lease = record.lease_id
          ? leaseMap.get(record.lease_id)
          : null;

        const buildingLabel =
          lease?.units?.buildings?.name || "Sin edificio";

        const unitLabel =
          lease?.units?.display_code ||
          lease?.units?.unit_number ||
          "Unidad";

        return {
          id: record.id,
          label: `${formatPeriod(record.period_year,record.period_month)} · ${buildingLabel} · ${unitLabel}`,
          pendingAmount: pending,
          dueDateLabel: formatDate(record.due_date),
          buildingLabel,
          unitLabel,
          leaseId: record.lease_id,
        };

      })
      .filter((x): x is SelectableDebt => Boolean(x));

  }, [collectionRecords, leases]);

  const selectedDebt = selectableDebts.find(
    (d) => d.id === collectionRecordId
  );

  /*
  =====================================
  SUBMIT
  =====================================
  */

  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (isSuperAdmin) {
      setFormError("La vista superadmin es solo preview.");
      return;
    }

    if (!effectiveTenantId) {
      setFormError("No se encontró el tenant.");
      return;
    }

    if (!collectionRecordId) {
      setFormError("Selecciona un adeudo.");
      return;
    }

    if (!amountReported) {
      setFormError("Ingresa el monto.");
      return;
    }

    if (!paymentDate) {
      setFormError("Selecciona la fecha.");
      return;
    }

    setSaving(true);
    setFormError("");
    setFormMessage("");

    try {

      /*
      ==============================
      SUBIR ARCHIVO
      ==============================
      */

      let proofPath: string | null = null;
      let proofUrl: string | null = null;
      let proofName: string | null = null;
      let proofType: string | null = null;

      if (proofFile) {

        const ext = proofFile.name.split(".").pop();

        const path = `tenant/${effectiveTenantId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(path, proofFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(path);

        proofPath = path;
        proofUrl = data.publicUrl;
        proofName = proofFile.name;
        proofType = proofFile.type;
      }

      /*
      ==============================
      INSERT DB
      ==============================
      */

      const { error } = await supabase
        .from("tenant_reported_payments")
        .insert({

          tenant_id: effectiveTenantId,

          lease_id: selectedDebt?.leaseId,

          collection_record_id: collectionRecordId,

          amount_reported: Number(amountReported),

          payment_date: paymentDate,

          notes,

          proof_file_url: proofUrl,

          proof_file_path: proofPath,

          proof_file_name: proofName,

          proof_file_type: proofType,

          review_status: "pending_review",

        });

      if (error) throw error;

      setFormMessage("Pago reportado correctamente para revisión.");

      setCollectionRecordId("");
      setAmountReported("");
      setPaymentDate("");
      setNotes("");
      setProofFile(null);

    } catch (err: any) {

      console.error(err);
      setFormError(err.message || "Error reportando pago.");

    }

    setSaving(false);
  }

  /*
  =====================================
  UI
  =====================================
  */

  return (
    <PageContainer>

      <PageHeader
        title="Reportar pago"
        subtitle="Envía el comprobante para revisión administrativa"
        titleIcon={<CreditCard size={20} />}
      />

      <AppGrid minWidth={260}>

        <AppCard>

          <form onSubmit={handleSubmit} style={{ display:"grid", gap:16 }}>

            <label>Adeudo</label>

            <select
              value={collectionRecordId}
              onChange={(e)=>setCollectionRecordId(e.target.value)}
            >
              <option value="">Selecciona adeudo</option>

              {selectableDebts.map(d => (
                <option key={d.id} value={d.id}>
                  {d.label} · {formatCurrency(d.pendingAmount)}
                </option>
              ))}
            </select>

            {selectedDebt && (
              <div>

                <strong>{selectedDebt.label}</strong>

                <div>
                  Vence: {selectedDebt.dueDateLabel}
                </div>

                <div>
                  Pendiente: {formatCurrency(selectedDebt.pendingAmount)}
                </div>

              </div>
            )}

            <label>Monto</label>

            <input
              type="number"
              value={amountReported}
              onChange={(e)=>setAmountReported(e.target.value)}
            />

            <label>Fecha pago</label>

            <input
              type="date"
              value={paymentDate}
              onChange={(e)=>setPaymentDate(e.target.value)}
            />

            <label>Notas</label>

            <textarea
              value={notes}
              onChange={(e)=>setNotes(e.target.value)}
            />

            <label>Comprobante</label>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e)=>setProofFile(e.target.files?.[0] || null)}
            />

            {formError && (
              <div style={{color:"red"}}>
                {formError}
              </div>
            )}

            {formMessage && (
              <div style={{color:"green"}}>
                {formMessage}
              </div>
            )}

            <UiButton
              type="submit"
              disabled={saving || isSuperAdmin}
            >
              {saving ? "Enviando..." : "Enviar reporte"}
            </UiButton>

          </form>

        </AppCard>

      </AppGrid>

    </PageContainer>
  );
}