"use client";

/*
  Frontend del módulo de mantenimiento por asset.

  Objetivo:
  - probar la experiencia visual antes de conectar Supabase real
  - mostrar historial tipo timeline / cards
  - abrir modal para crear un mantenimiento nuevo
  - mantener el mismo lenguaje visual del resto de PropAdmin

  En el siguiente patch:
  - conectaremos esta vista con el detalle del asset
  - y luego con Supabase real
*/

import { useMemo, useState, type FormEvent, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  DollarSign,
  Plus,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AppCard from "@/components/AppCard";
import AppIconBox from "@/components/AppIconBox";

type MaintenanceItem = {
  id: string;
  maintenanceType: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  description: string;
  provider: string;
  cost: string;
  serviceDate: string;
  nextServiceDate: string;
  notes: string;
};

function formatDate(dateValue: string) {
  if (!dateValue) return "Sin fecha";

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;

  return parsed.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusLabel(status: MaintenanceItem["status"]) {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "IN_PROGRESS":
      return "En proceso";
    case "COMPLETED":
      return "Completado";
    default:
      return status;
  }
}

function getStatusStyles(status: MaintenanceItem["status"]): CSSProperties {
  switch (status) {
    case "PENDING":
      return {
        background: "#FEF3C7",
        color: "#92400E",
        border: "1px solid #FDE68A",
      };
    case "IN_PROGRESS":
      return {
        background: "#DBEAFE",
        color: "#1D4ED8",
        border: "1px solid #BFDBFE",
      };
    case "COMPLETED":
      return {
        background: "#DCFCE7",
        color: "#166534",
        border: "1px solid #BBF7D0",
      };
    default:
      return {
        background: "#F3F4F6",
        color: "#4B5563",
        border: "1px solid #E5E7EB",
      };
  }
}

const MOCK_LOGS: MaintenanceItem[] = [
  {
    id: "m-001",
    maintenanceType: "Preventivo",
    status: "COMPLETED",
    description: "Limpieza general del equipo y revisión de funcionamiento.",
    provider: "FríoTech",
    cost: "$850",
    serviceDate: "2026-03-10",
    nextServiceDate: "2026-09-10",
    notes: "Se detectó operación normal. Se recomienda limpieza semestral.",
  },
  {
    id: "m-002",
    maintenanceType: "Inspección",
    status: "PENDING",
    description: "Inspección visual y validación de conexiones.",
    provider: "Servicios Marsella",
    cost: "$0",
    serviceDate: "2026-04-25",
    nextServiceDate: "",
    notes: "Pendiente de agendar con proveedor.",
  },
];

export default function AssetMaintenancePage() {
  const params = useParams();

  const buildingId = params.buildingId as string;
  const unitId = params.unitId as string;
  const assetId = params.assetId as string;

  const [logs, setLogs] = useState<MaintenanceItem[]>(MOCK_LOGS);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [maintenanceType, setMaintenanceType] = useState("Preventivo");
  const [status, setStatus] = useState<MaintenanceItem["status"]>("PENDING");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("");
  const [cost, setCost] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  const stats = useMemo(() => {
    return {
      total: logs.length,
      pending: logs.filter((item) => item.status === "PENDING").length,
      inProgress: logs.filter((item) => item.status === "IN_PROGRESS").length,
      completed: logs.filter((item) => item.status === "COMPLETED").length,
    };
  }, [logs]);

  function resetForm() {
    setMaintenanceType("Preventivo");
    setStatus("PENDING");
    setDescription("");
    setProvider("");
    setCost("");
    setServiceDate("");
    setNextServiceDate("");
    setNotes("");
  }

  function handleCreateMaintenance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");

    if (!description.trim()) {
      setMsg("La descripción del mantenimiento es obligatoria.");
      return;
    }

    const newItem: MaintenanceItem = {
      id: `mock-${Date.now()}`,
      maintenanceType,
      status,
      description: description.trim(),
      provider: provider.trim() || "Sin proveedor",
      cost: cost.trim() || "$0",
      serviceDate: serviceDate || new Date().toISOString().slice(0, 10),
      nextServiceDate,
      notes: notes.trim(),
    };

    setLogs((prev) => [newItem, ...prev]);
    setMsg("Mantenimiento agregado en frontend correctamente.");
    setIsCreateModalOpen(false);
    resetForm();
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mantenimiento del asset"
        titleIcon={<Wrench size={18} />}
        subtitle="Frontend de prueba para visualizar historial, estados y creación de mantenimientos antes de conectarlo a Supabase."
        actions={
          <>
            <UiButton href={`/buildings/${buildingId}/units/${unitId}/assets/${assetId}`}>
              Volver al asset
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nuevo mantenimiento
            </UiButton>
          </>
        }
      />

      {msg ? (
        <p
          style={{
            color: msg.includes("correctamente") ? "green" : "crimson",
            marginBottom: 16,
          }}
        >
          {msg}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <ClipboardList size={18} />
            </AppIconBox>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Total</p>
              <strong style={{ fontSize: 24 }}>{stats.total}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <CalendarDays size={18} />
            </AppIconBox>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Pendientes</p>
              <strong style={{ fontSize: 24 }}>{stats.pending}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <Wrench size={18} />
            </AppIconBox>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>En proceso</p>
              <strong style={{ fontSize: 24 }}>{stats.inProgress}</strong>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AppIconBox>
              <ShieldCheck size={18} />
            </AppIconBox>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>Completados</p>
              <strong style={{ fontSize: 24 }}>{stats.completed}</strong>
            </div>
          </div>
        </AppCard>
      </div>

      <SectionCard
        title="Historial de mantenimiento"
        subtitle="Timeline frontend para validar el flujo visual antes de guardar información real."
        icon={<Wrench size={18} />}
      >
        {logs.length === 0 ? (
          <div
            style={{
              border: "1px dashed #D0D5DD",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
            }}
          >
            <strong style={{ display: "block", marginBottom: 8 }}>
              Todavía no hay mantenimientos
            </strong>
            <p style={{ margin: 0, color: "#667085" }}>
              Usa el botón superior para crear el primer registro y probar el flujo.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {logs.map((item) => (
              <AppCard key={item.id}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{item.maintenanceType}</strong>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          ...getStatusStyles(item.status),
                        }}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>

                    <p style={{ marginTop: 0, marginBottom: 12, color: "#475467" }}>
                      {item.description}
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <UserRound size={15} />
                        <span style={{ fontSize: 14 }}>{item.provider}</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <DollarSign size={15} />
                        <span style={{ fontSize: 14 }}>{item.cost}</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <CalendarDays size={15} />
                        <span style={{ fontSize: 14 }}>
                          Servicio: {formatDate(item.serviceDate)}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <CalendarDays size={15} />
                        <span style={{ fontSize: 14 }}>
                          Próximo: {item.nextServiceDate ? formatDate(item.nextServiceDate) : "Sin fecha"}
                        </span>
                      </div>
                    </div>

                    {item.notes ? (
                      <div style={{ marginTop: 12 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: "#667085",
                            marginBottom: 4,
                          }}
                        >
                          Notas
                        </p>
                        <p style={{ margin: 0 }}>{item.notes}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Nuevo mantenimiento"
        subtitle="Formulario frontend para probar el flujo antes de conectarlo con Supabase."
      >
        <form onSubmit={handleCreateMaintenance}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8 }}>
                Tipo de mantenimiento
              </label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #D0D5DD",
                  background: "white",
                }}
              >
                <option value="Preventivo">Preventivo</option>
                <option value="Correctivo">Correctivo</option>
                <option value="Inspección">Inspección</option>
                <option value="Reparación">Reparación</option>
                <option value="Limpieza">Limpieza</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8 }}>
                Estatus
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "PENDING" | "IN_PROGRESS" | "COMPLETED")
                }
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #D0D5DD",
                  background: "white",
                }}
              >
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En proceso</option>
                <option value="COMPLETED">Completado</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8 }}>
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el mantenimiento realizado o programado."
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #D0D5DD",
                  minHeight: 110,
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Proveedor
                </label>
                <input
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Ej. FríoTech"
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #D0D5DD",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8 }}>Costo</label>
                <input
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="Ej. $850"
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #D0D5DD",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Fecha de servicio
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #D0D5DD",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Próximo servicio
                </label>
                <input
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #D0D5DD",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8 }}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios adicionales del servicio."
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #D0D5DD",
                  minHeight: 90,
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 20,
            }}
          >
            <UiButton type="submit" variant="primary">
              Guardar mantenimiento
            </UiButton>
            <UiButton onClick={() => setIsCreateModalOpen(false)}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
