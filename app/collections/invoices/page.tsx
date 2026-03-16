"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { removeInvoiceFile } from "@/lib/invoiceStorage";
import { type InvoiceListRow, normalizeInvoiceRow } from "@/lib/normalizeInvoice";
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
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

type DeleteTarget = {
  id: string;
  label: string;
  pdfPath: string | null;
  xmlPath: string | null;
} | null;

type BuildingOption = {
  id: string;
  name: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function AdminInvoicesPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { showToast } = useAppToast();

  const [pageLoading, setPageLoading] = useState(true);
  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;

    const currentUser = user;
    let ignore = false;

    async function loadInvoices() {
      setPageLoading(true);

      let query = supabase
        .from("collection_invoices")
        .select(`
          id,
          company_id,
          building_id,
          unit_id,
          lease_id,
          collection_record_id,
          invoice_series,
          invoice_folio,
          invoice_uuid,
          invoice_type,
          issued_at,
          period_year,
          period_month,
          subtotal,
          tax,
          total,
          customer_name,
          customer_tax_id,
          description,
          charge_category,
          pdf_path,
          xml_path,
          original_pdf_filename,
          original_xml_filename,
          created_at,
          buildings(name),
          units(unit_number, display_code, buildings(name)),
          leases(tenants(full_name)),
          collection_records(
            amount_due,
            due_date,
            status,
            units(unit_number, display_code, buildings(name)),
            buildings(name),
            leases(tenants(full_name))
          )
        `)
        .order("issued_at", { ascending: false })
        .order("created_at", { ascending: false });

      const isCompanyAdmin =
        currentUser.role === "admin" && !Boolean(currentUser.is_superadmin);

      if (isCompanyAdmin && currentUser.company_id) {
        query = query.eq("company_id", currentUser.company_id);
      }

      const { data, error } = await query;

      if (ignore) return;

      if (error) {
        console.error(error);
        showToast({ type: "error", message: "No pude cargar las facturas administrativas." });
        setRows([]);
        setBuildingOptions([]);
        setPageLoading(false);
        return;
      }

      const normalized = Array.isArray(data) ? data.map((item) => normalizeInvoiceRow(item)) : [];
      setRows(normalized);

      const buildingMap = new Map<string, string>();

      normalized.forEach((row) => {
        if (row.buildingId && row.buildingName) {
          buildingMap.set(row.buildingId, row.buildingName);
        }
      });

      setBuildingOptions(
        Array.from(buildingMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
      );

      setPageLoading(false);
    }

    loadInvoices();

    return () => {
      ignore = true;
    };
  }, [loading, user, showToast]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      if (buildingFilter !== "all" && row.buildingId !== buildingFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        row.invoiceSeries,
        row.invoiceFolio,
        row.invoiceUuid,
        row.customerName,
        row.customerTaxId,
        row.buildingName,
        row.unitLabel,
        row.tenantName,
        row.periodLabel,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [rows, searchTerm, buildingFilter]);

  const metrics = useMemo(() => {
    const totalInvoices = filteredRows.length;
    const totalAmount = filteredRows.reduce((sum, row) => sum + row.total, 0);
    const withFilesCount = filteredRows.filter((row) => row.pdfPath && row.xmlPath).length;
    const linkedCount = filteredRows.filter((row) => row.collectionRecordId).length;

    return {
      totalInvoices,
      totalAmount,
      withFilesCount,
      linkedCount,
    };
  }, [filteredRows]);

  async function handleDeleteInvoice() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      if (deleteTarget.pdfPath) {
        await removeInvoiceFile(deleteTarget.pdfPath);
      }

      if (deleteTarget.xmlPath) {
        await removeInvoiceFile(deleteTarget.xmlPath);
      }

      const { error } = await supabase.from("collection_invoices").delete().eq("id", deleteTarget.id);

      if (error) {
        throw new Error(error.message || "No fue posible eliminar la factura.");
      }

      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast({ type: "success", message: "La factura se eliminó correctamente." });
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Ocurrió un error al eliminar la factura.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Facturas"
        subtitle="Administra las facturas ligadas a cobranza, conserva sus archivos PDF y XML, y mantén trazabilidad completa del flujo administrativo."
        titleIcon={<FileText size={22} />}
        actions={
          <UiButton
            variant="primary"
            onClick={() => router.push("/collections/invoices/new")}
            icon={<Plus size={16} />}
          >
            Nueva factura
          </UiButton>
        }
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Facturas visibles"
          value={String(metrics.totalInvoices)}
          icon={<FileText size={18} />}
        />
        <MetricCard
          label="Monto total"
          value={formatCurrency(metrics.totalAmount)}
          icon={<Building2 size={18} />}
        />
        <MetricCard
          label="Con PDF y XML"
          value={String(metrics.withFilesCount)}
          icon={<FileText size={18} />}
        />
        <MetricCard
          label="Ligadas a cobro"
          value={String(metrics.linkedCount)}
          icon={<Building2 size={18} />}
        />
      </AppGrid>

      <div style={{ height: 16 }} />

      <SectionCard
        title="Listado administrativo"
        subtitle="Desde aquí puedes crear, revisar, editar y eliminar facturas sin salir del flujo de PropAdmin."
      >
        <AppGrid minWidth={260} style={{ marginBottom: 18 }}>
          <AppCard>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Buscar</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #D0D5DD",
                  borderRadius: 12,
                  padding: "0 12px",
                  background: "white",
                }}
              >
                <Search size={16} color="#667085" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Serie, folio, UUID, cliente o unidad"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    padding: "12px 0",
                    color: "#111827",
                    background: "transparent",
                  }}
                />
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Edificio</label>
              <AppSelect value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
                <option value="all">Todos los edificios</option>
                {buildingOptions.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </AppSelect>
            </div>
          </AppCard>
        </AppGrid>

        <AppTable
          rows={filteredRows}
          emptyState={
            pageLoading ? "Cargando facturas..." : "Todavía no hay facturas creadas en este módulo."
          }
          columns={[
            {
              key: "folio",
              header: "Factura",
              width: 220,
              render: (row) => (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#111827" }}>
                    {row.invoiceSeries !== "—" ? `${row.invoiceSeries}-` : ""}
                    {row.invoiceFolio}
                  </div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.invoiceUuid}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.invoiceTypeLabel}</div>
                </div>
              ),
            },
            {
              key: "cliente",
              header: "Cliente",
              width: 220,
              render: (row) => (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{row.customerName}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.customerTaxId}</div>
                </div>
              ),
            },
            {
              key: "ubicacion",
              header: "Ubicación",
              width: 220,
              render: (row) => (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{row.buildingName}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.unitLabel}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.tenantName}</div>
                </div>
              ),
            },
            {
              key: "monto",
              header: "Monto",
              width: 160,
              render: (row) => (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{row.totalLabel}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.periodLabel}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.issuedAtLabel}</div>
                </div>
              ),
            },
            {
              key: "cobro",
              header: "Cobranza ligada",
              width: 180,
              render: (row) => (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{row.collectionStatusLabel}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.collectionAmountDueLabel}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{row.collectionDueDateLabel}</div>
                </div>
              ),
            },
            {
              key: "acciones",
              header: "Acciones",
              width: 240,
              render: (row) => (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <UiButton onClick={() => router.push(`/collections/invoices/${row.id}`)} icon={<Eye size={15} />}>
                    Ver
                  </UiButton>
                  <UiButton onClick={() => router.push(`/collections/invoices/${row.id}/edit`)} icon={<Pencil size={15} />}>
                    Editar
                  </UiButton>
                  <UiButton
                    onClick={() =>
                      setDeleteTarget({
                        id: row.id,
                        label: `${row.invoiceSeries !== "—" ? `${row.invoiceSeries}-` : ""}${row.invoiceFolio}`,
                        pdfPath: row.pdfPath,
                        xmlPath: row.xmlPath,
                      })
                    }
                    icon={<Trash2 size={15} />}
                  >
                    Eliminar
                  </UiButton>
                </div>
              ),
            },
          ]}
        />
      </SectionCard>

      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar factura"
        description={
          deleteTarget
            ? `Vas a eliminar la factura ${deleteTarget.label}. También se eliminarán sus archivos PDF y XML del bucket de invoices.`
            : ""
        }
        confirmText={deleting ? "Eliminando..." : "Sí, eliminar"}
        onConfirm={handleDeleteInvoice}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
      />
    </PageContainer>
  );
}