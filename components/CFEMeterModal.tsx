"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, TEXTAREA_STYLE, errorBannerStyle } from "@/lib/pageStyles";

type UnitRow = { id: string; unit_number: string; display_code: string | null };
type CFEMeterRow = {
  id: string; meter_number: string; rpu: string | null; description: string | null;
  tariff_type: string | null; service_type: 'dedicated' | 'shared';
  assigned_unit_id: string | null; notes: string | null;
};

type Props = {
  buildingId: string;
  companyId: string;
  units: UnitRow[];
  existingCfeMeters: CFEMeterRow[];
  meter: CFEMeterRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

const TARIFF_OPTIONS = [
  { value: "", label: "Sin especificar" },
  { value: "Doméstica 1A", label: "Doméstica 1A" },
  { value: "Doméstica 1B", label: "Doméstica 1B" },
  { value: "Doméstica 1C", label: "Doméstica 1C" },
  { value: "Doméstica DAC", label: "Doméstica DAC" },
  { value: "Comercial PDBT", label: "Comercial PDBT" },
  { value: "Comercial GDBT", label: "Comercial GDBT" },
  { value: "Otro", label: "Otro" },
];

export default function CFEMeterModal({ buildingId, companyId, units, existingCfeMeters, meter, onClose, onSuccess }: Props) {
  const isEdit = !!meter;
  const [meterNumber, setMeterNumber] = useState(meter?.meter_number || "");
  const [rpu, setRpu] = useState(meter?.rpu || "");
  const [description, setDescription] = useState(meter?.description || "");
  const [tariffType, setTariffType] = useState(meter?.tariff_type || "");
  const [serviceType, setServiceType] = useState<'dedicated' | 'shared'>(meter?.service_type || 'shared');
  const [assignedUnitId, setAssignedUnitId] = useState(meter?.assigned_unit_id || "");
  const [notes, setNotes] = useState(meter?.notes || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Units already assigned to other dedicated meters
  const assignedUnitIds = new Set(
    existingCfeMeters
      .filter(m => m.service_type === 'dedicated' && m.assigned_unit_id && m.id !== meter?.id)
      .map(m => m.assigned_unit_id!)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!meterNumber.trim()) { setMsg("El número de medidor es obligatorio."); return; }
    if (serviceType === 'dedicated' && !assignedUnitId) { setMsg("Debes seleccionar la unidad asignada."); return; }

    // Verificar unicidad del meter_number en el edificio
    const duplicate = existingCfeMeters.find(
      m => m.meter_number.trim().toLowerCase() === meterNumber.trim().toLowerCase() && m.id !== meter?.id
    );
    if (duplicate) { setMsg("Ya existe un medidor con ese número en este edificio."); return; }

    setSaving(true);
    const payload = {
      company_id: companyId,
      building_id: buildingId,
      meter_number: meterNumber.trim(),
      rpu: rpu.trim() || null,
      description: description.trim() || null,
      tariff_type: tariffType || null,
      service_type: serviceType,
      assigned_unit_id: serviceType === 'dedicated' ? assignedUnitId : null,
      notes: notes.trim() || null,
    };

    const { error } = isEdit
      ? await supabase.from('cfe_meters').update(payload).eq('id', meter!.id)
      : await supabase.from('cfe_meters').insert(payload);

    setSaving(false);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    onSuccess();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar medidor CFE" : "Agregar medidor CFE"}>
      <form onSubmit={handleSubmit}>
        {msg ? <p style={errorBannerStyle}>{msg}</p> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <AppFormField label="Número de medidor *">
            <input value={meterNumber} onChange={e => setMeterNumber(e.target.value)} placeholder="Ej. 123456789" style={INPUT_STYLE} />
          </AppFormField>
          <AppFormField label="RPU (opcional)">
            <input value={rpu} onChange={e => setRpu(e.target.value)} placeholder="Registro Permanente de Usuario" style={INPUT_STYLE} />
          </AppFormField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <AppFormField label="Descripción (opcional)">
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Local PB, Bomba" style={INPUT_STYLE} />
          </AppFormField>
          <AppFormField label="Tarifa CFE">
            <AppSelect value={tariffType} onChange={e => setTariffType(e.target.value)}>
              {TARIFF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </AppSelect>
          </AppFormField>
        </div>

        <AppFormField label="Tipo de servicio *">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <label style={{
              display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", borderRadius: 12, cursor: "pointer",
              border: `2px solid ${serviceType === 'dedicated' ? "#8B2252" : "var(--border-default)"}`,
              background: serviceType === 'dedicated' ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="radio" value="dedicated" checked={serviceType === 'dedicated'} onChange={() => setServiceType('dedicated')} style={{ accentColor: "#8B2252" }} />
                <strong style={{ fontSize: 14 }}>Dedicado</strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Sirve a UNA sola unidad. El inquilino paga directamente a CFE. Solo registro administrativo.
              </p>
            </label>
            <label style={{
              display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", borderRadius: 12, cursor: "pointer",
              border: `2px solid ${serviceType === 'shared' ? "#1d4ed8" : "var(--border-default)"}`,
              background: serviceType === 'shared' ? "#eff6ff" : "var(--bg-card)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="radio" value="shared" checked={serviceType === 'shared'} onChange={() => setServiceType('shared')} style={{ accentColor: "#1d4ed8" }} />
                <strong style={{ fontSize: 14 }}>Compartido</strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Alimenta a varias unidades. Fra-Mar paga la factura y la distribuye con submedidores.
              </p>
            </label>
          </div>
        </AppFormField>

        {serviceType === 'dedicated' ? (
          <AppFormField label="Unidad asignada *">
            <AppSelect value={assignedUnitId} onChange={e => setAssignedUnitId(e.target.value)}>
              <option value="">Selecciona una unidad</option>
              {units.map(u => {
                const alreadyAssigned = assignedUnitIds.has(u.id);
                const label = `Depa ${u.unit_number}${alreadyAssigned ? " (ya asignada)" : ""}`;
                return <option key={u.id} value={u.id} disabled={alreadyAssigned}>{label}</option>;
              })}
            </AppSelect>
          </AppFormField>
        ) : (
          <div style={{ padding: "12px 16px", background: "#eff6ff", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#1d4ed8" }}>
            💡 Después de crear este medidor, configura los submedidores internos por unidad.
          </div>
        )}

        <AppFormField label="Notas (opcional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" style={TEXTAREA_STYLE} />
        </AppFormField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear medidor"}</UiButton>
        </div>
      </form>
    </Modal>
  );
}
