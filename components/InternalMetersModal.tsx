"use client";

import { useEffect, useState } from "react";
import { Info, MapPin } from "lucide-react";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles";
import { sortByNatural } from "@/lib/sort-utils";

type UnitRow = { id: string; unit_number: string; display_code: string | null };
type InternalMeterRow = {
  id: string; cfe_meter_id: string; unit_id: string;
  internal_number: string | null; baseline_reading: number;
  active: boolean; unit_number?: string;
};
type CFEMeterRow = { id: string; meter_number: string; service_type: string };
type BuildingRow = { id: string; name: string };

type Props = {
  cfeMeter: CFEMeterRow;
  building: BuildingRow;
  companyId: string;
  units: UnitRow[];
  existingInternalMeters: InternalMeterRow[];
  onClose: () => void;
  onSuccess: () => void;
};

type UnitState = {
  checked: boolean;
  internalNumber: string;
  baselineReading: string;
  existingId: string | null;
};

export default function InternalMetersModal({ cfeMeter, building, companyId, units, existingInternalMeters, onClose, onSuccess }: Props) {
  const [unitStates, setUnitStates] = useState<Record<string, UnitState>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Initialize state from existing internal meters
  useEffect(() => {
    const initial: Record<string, UnitState> = {};
    units.forEach(u => {
      const existing = existingInternalMeters.find(im => im.unit_id === u.id);
      initial[u.id] = {
        checked: !!existing,
        internalNumber: existing?.internal_number || "",
        baselineReading: existing ? String(existing.baseline_reading) : "",
        existingId: existing?.id || null,
      };
    });
    setUnitStates(initial);
  }, [units, existingInternalMeters]);

  function toggle(unitId: string, checked: boolean) {
    setUnitStates(prev => ({ ...prev, [unitId]: { ...prev[unitId], checked } }));
  }

  function updateField(unitId: string, field: 'internalNumber' | 'baselineReading', value: string) {
    setUnitStates(prev => ({ ...prev, [unitId]: { ...prev[unitId], [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    // Validate: all checked units need a baseline reading
    for (const u of units) {
      const s = unitStates[u.id];
      if (!s) continue;
      if (s.checked && !s.baselineReading.trim()) {
        setMsg(`Falta la lectura base para Depa ${u.unit_number}.`);
        return;
      }
    }

    setSaving(true);
    try {
      for (const u of units) {
        const s = unitStates[u.id];
        if (!s) continue;

        if (s.checked && !s.existingId) {
          // INSERT
          await supabase.from('internal_meters').insert({
            company_id: companyId,
            cfe_meter_id: cfeMeter.id,
            unit_id: u.id,
            internal_number: s.internalNumber.trim() || null,
            baseline_reading: parseFloat(s.baselineReading) || 0,
            baseline_date: new Date().toISOString().split('T')[0],
            active: true,
          });
        } else if (s.checked && s.existingId) {
          // UPDATE
          await supabase.from('internal_meters').update({
            internal_number: s.internalNumber.trim() || null,
            baseline_reading: parseFloat(s.baselineReading) || 0,
          }).eq('id', s.existingId);
        } else if (!s.checked && s.existingId) {
          // DEACTIVATE
          await supabase.from('internal_meters').update({ active: false }).eq('id', s.existingId);
        }
      }
      onSuccess();
    } catch {
      setMsg("Error al guardar los submedidores.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Submedidores — Medidor ${cfeMeter.meter_number}`}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
        <MapPin size={13} />{building.name}
      </p>
      <div style={{ padding: "12px 16px", background: "#fef3c7", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />Asigna qué unidades están conectadas a este medidor CFE. Para cada una, captura una lectura base inicial. Si no la conoces exacta, pon una aproximada — lo que importa son las diferencias mensuales.
      </div>

      <form onSubmit={handleSubmit}>
        {msg ? <p style={errorBannerStyle}>{msg}</p> : null}

        <div style={{ display: "grid", gap: 12, maxHeight: "50vh", overflowY: "auto", paddingRight: 4 }}>
          {sortByNatural(units, u => u.unit_number).map(u => {
            const s = unitStates[u.id];
            if (!s) return null;
            return (
              <div key={u.id} style={{
                padding: "12px 14px", borderRadius: 12,
                border: `1px solid ${s.checked ? "#8B2252" : "var(--border-default)"}`,
                background: s.checked ? "rgba(139,34,82,0.04)" : "var(--bg-card)",
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: s.checked ? 12 : 0 }}>
                  <input
                    type="checkbox"
                    checked={s.checked}
                    onChange={e => toggle(u.id, e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#8B2252", flexShrink: 0 }}
                  />
                  <strong style={{ fontSize: 14 }}>Depa {u.unit_number}</strong>
                  {u.display_code ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.display_code}</span> : null}
                </label>
                {s.checked && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingLeft: 26 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Número interno (opcional)</label>
                      <input
                        value={s.internalNumber}
                        onChange={e => updateField(u.id, 'internalNumber', e.target.value)}
                        placeholder="Ej. SM-01"
                        style={INPUT_STYLE}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Lectura base inicial *</label>
                      <input
                        type="number"
                        value={s.baselineReading}
                        onChange={e => updateField(u.id, 'baselineReading', e.target.value)}
                        placeholder="0.00"
                        style={INPUT_STYLE}
                        step="0.01"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</UiButton>
        </div>
      </form>
    </Modal>
  );
}
