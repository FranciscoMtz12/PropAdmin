"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import Modal from "@/components/Modal";

type Building = { id: string; name: string };
type Unit = { id: string; name: string; display_code: string | null };
type Meter = { id: string; meter_number: string; description: string | null; building_id: string };
type Assignment = {
  id: string;
  meter_id: string;
  unit_id: string;
  meter_number: string;
  unit_name: string;
  assigned_at: string;
};

export default function MedidoresSetupPage() {
  const { user, loading } = useCurrentUser();

  const [buildings,    setBuildings]    = useState<Building[]>([]);
  const [units,        setUnits]        = useState<Unit[]>([]);
  const [meters,       setMeters]       = useState<Meter[]>([]);
  const [assignments,  setAssignments]  = useState<Assignment[]>([]);
  const [selectedBld,  setSelectedBld]  = useState("");
  const [loadingData,  setLoadingData]  = useState(true);

  /* Meter form */
  const [meterModal,   setMeterModal]   = useState(false);
  const [editMeter,    setEditMeter]    = useState<Meter | null>(null);
  const [meterNum,     setMeterNum]     = useState("");
  const [meterDesc,    setMeterDesc]    = useState("");
  const [savingMeter,  setSavingMeter]  = useState(false);

  /* Assignment form */
  const [assignModal,  setAssignModal]  = useState(false);
  const [assMeterId,   setAssMeterId]   = useState("");
  const [assUnitId,    setAssUnitId]    = useState("");
  const [savingAss,    setSavingAss]    = useState(false);

  useEffect(() => {
    if (!loading && user?.company_id) void loadBuildings(user.company_id);
  }, [loading, user]);

  useEffect(() => {
    if (selectedBld && user?.company_id) void loadBuildingData(user.company_id, selectedBld);
  }, [selectedBld, user]);

  async function loadBuildings(companyId: string) {
    setLoadingData(true);
    const { data } = await supabase
      .from("buildings")
      .select("id, name")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("name");
    setBuildings(data ?? []);
    if (data && data.length > 0) setSelectedBld(data[0].id);
    setLoadingData(false);
  }

  async function loadBuildingData(companyId: string, buildingId: string) {
    const [unitsRes, metersRes, assignmentsRes] = await Promise.all([
      supabase
        .from("units")
        .select("id, name, display_code")
        .eq("company_id", companyId)
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("electricity_meters")
        .select("id, meter_number, description, building_id")
        .eq("company_id", companyId)
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .order("meter_number"),
      supabase
        .from("unit_meter_assignments")
        .select(`
          id, meter_id, unit_id, assigned_at,
          electricity_meters ( meter_number ),
          units ( name )
        `)
        .eq("company_id", companyId)
        .is("unassigned_at", null),
    ]);

    setUnits(unitsRes.data ?? []);
    setMeters(metersRes.data ?? []);

    const buildingMeterIds = new Set((metersRes.data ?? []).map((m: Meter) => m.id));
    const filtered = (assignmentsRes.data ?? []).filter((a: any) => buildingMeterIds.has(a.meter_id));
    setAssignments(
      filtered.map((a: any) => ({
        id: a.id,
        meter_id: a.meter_id,
        unit_id: a.unit_id,
        meter_number: (a.electricity_meters as any)?.meter_number ?? "",
        unit_name: (a.units as any)?.name ?? "",
        assigned_at: a.assigned_at,
      })),
    );
  }

  function openNewMeter() {
    setEditMeter(null);
    setMeterNum("");
    setMeterDesc("");
    setMeterModal(true);
  }

  function openEditMeter(m: Meter) {
    setEditMeter(m);
    setMeterNum(m.meter_number);
    setMeterDesc(m.description ?? "");
    setMeterModal(true);
  }

  async function saveMeter() {
    if (!meterNum.trim()) { toast.error("El número de medidor es obligatorio."); return; }
    if (!selectedBld || !user?.company_id) return;
    setSavingMeter(true);
    try {
      if (editMeter) {
        const { error } = await supabase
          .from("electricity_meters")
          .update({ meter_number: meterNum.trim(), description: meterDesc.trim() || null, updated_at: new Date().toISOString() })
          .eq("id", editMeter.id);
        if (error) throw error;
        toast.success("Medidor actualizado.");
      } else {
        const { error } = await supabase
          .from("electricity_meters")
          .insert({ company_id: user.company_id, building_id: selectedBld, meter_number: meterNum.trim(), description: meterDesc.trim() || null });
        if (error) throw error;
        toast.success("Medidor creado.");
      }
      setMeterModal(false);
      void loadBuildingData(user.company_id, selectedBld);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar medidor");
    } finally {
      setSavingMeter(false);
    }
  }

  async function deleteMeter(m: Meter) {
    if (!confirm(`¿Eliminar medidor ${m.meter_number}? Se desasignarán todas sus unidades.`)) return;
    if (!user?.company_id) return;
    const { error } = await supabase
      .from("electricity_meters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Medidor eliminado.");
    void loadBuildingData(user.company_id, selectedBld);
  }

  async function saveAssignment() {
    if (!assMeterId || !assUnitId) { toast.error("Selecciona medidor y unidad."); return; }
    if (!user?.company_id) return;
    const alreadyAssigned = assignments.find((a) => a.unit_id === assUnitId);
    if (alreadyAssigned) { toast.error("Esa unidad ya tiene un medidor asignado."); return; }
    setSavingAss(true);
    try {
      const { error } = await supabase.from("unit_meter_assignments").insert({
        company_id: user.company_id,
        meter_id: assMeterId,
        unit_id: assUnitId,
        assigned_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Asignación creada.");
      setAssignModal(false);
      setAssMeterId("");
      setAssUnitId("");
      void loadBuildingData(user.company_id, selectedBld);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar medidor");
    } finally {
      setSavingAss(false);
    }
  }

  async function unassign(a: Assignment) {
    if (!confirm(`¿Desasignar medidor ${a.meter_number} de ${a.unit_name}?`)) return;
    if (!user?.company_id) return;
    const { error } = await supabase
      .from("unit_meter_assignments")
      .update({ unassigned_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Desasignado.");
    void loadBuildingData(user.company_id, selectedBld);
  }

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 0", borderBottom: "1px solid var(--border-default)",
  };

  return (
    <PageContainer>
      <PageHeader
        title="Configuración de medidores"
        subtitle="Alta de medidores y asignación a unidades"
        actions={
          <Link
            href="/cobranza/medidores"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: "1px solid var(--border-default)", background: "var(--bg-input)",
              color: "var(--text-primary)", textDecoration: "none",
            }}
          >
            <ArrowLeft size={15} /> Volver
          </Link>
        }
      />

      {/* Building selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          Edificio
        </label>
        <select
          value={selectedBld}
          onChange={(e) => setSelectedBld(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, minWidth: 240 }}
        >
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Meters CRUD */}
      <div style={{ marginBottom: 16 }}>
      <SectionCard
        title="Medidores"
        action={
          <button
            type="button"
            onClick={openNewMeter}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={14} /> Nuevo medidor
          </button>
        }
      >
        {meters.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>Sin medidores para este edificio.</p>
        ) : (
          meters.map((m) => (
            <div key={m.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>{m.meter_number}</div>
                {m.description && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.description}</div>}
              </div>
              <button type="button" onClick={() => openEditMeter(m)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <Pencil size={15} color="var(--text-muted)" />
              </button>
              <button type="button" onClick={() => void deleteMeter(m)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <Trash2 size={15} color="#c2410c" />
              </button>
            </div>
          ))
        )}
      </SectionCard>
      </div>

      {/* Assignments */}
      <SectionCard
        title="Asignaciones activas"
        action={
          meters.length > 0 ? (
            <button
              type="button"
              onClick={() => setAssignModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={14} /> Asignar
            </button>
          ) : undefined
        }
      >
        {assignments.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>Sin asignaciones activas.</p>
        ) : (
          assignments.map((a) => (
            <div key={a.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.unit_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>Medidor {a.meter_number}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.assigned_at.slice(0, 10)}</div>
              <button
                type="button"
                onClick={() => void unassign(a)}
                style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
              >
                Desasignar
              </button>
            </div>
          ))
        )}
      </SectionCard>

      {/* Meter modal */}
      <Modal open={meterModal} onClose={() => setMeterModal(false)} title={editMeter ? "Editar medidor" : "Nuevo medidor"} maxWidth="400px">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Número de medidor *</label>
            <input
              type="text"
              value={meterNum}
              onChange={(e) => setMeterNum(e.target.value)}
              placeholder="Ej. 1234567890"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Descripción (opcional)</label>
            <input
              type="text"
              value={meterDesc}
              onChange={(e) => setMeterDesc(e.target.value)}
              placeholder="Ej. Entrada principal, Piso 3..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border-default)" }}>
            <button type="button" onClick={() => setMeterModal(false)} disabled={savingMeter} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="button" onClick={() => void saveMeter()} disabled={savingMeter} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", cursor: savingMeter ? "wait" : "pointer", opacity: savingMeter ? 0.7 : 1 }}>
              {savingMeter ? "Guardando…" : editMeter ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assignment modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Asignar medidor a unidad" maxWidth="400px">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Medidor *</label>
            <select
              value={assMeterId}
              onChange={(e) => setAssMeterId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
            >
              <option value="">Seleccionar…</option>
              {meters.map((m) => <option key={m.id} value={m.id}>{m.meter_number}{m.description ? ` — ${m.description}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Unidad *</label>
            <select
              value={assUnitId}
              onChange={(e) => setAssUnitId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
            >
              <option value="">Seleccionar…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.display_code ? ` (${u.display_code})` : ""}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border-default)" }}>
            <button type="button" onClick={() => setAssignModal(false)} disabled={savingAss} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="button" onClick={() => void saveAssignment()} disabled={savingAss} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", cursor: savingAss ? "wait" : "pointer", opacity: savingAss ? 0.7 : 1 }}>
              {savingAss ? "Guardando…" : "Asignar"}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
