"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles";
import { sortByNatural } from "@/lib/sort-utils";
import type { BuildingUtilityMeter, UtilityServiceType, UtilityMeterType } from "@/lib/types";
import { SERVICE_TYPE_LABEL } from "@/lib/types";

type Props = {
  buildingId: string;
  companyId: string;
  units: { id: string; unit_number: string }[];
  existingMeter: BuildingUtilityMeter | null;
  onClose: () => void;
  onSuccess: () => void;
};

const SERVICE_TYPE_OPTIONS: { value: UtilityServiceType; label: string }[] = [
  { value: "electricity", label: SERVICE_TYPE_LABEL.electricity },
  { value: "gas",         label: SERVICE_TYPE_LABEL.gas },
  { value: "water",       label: SERVICE_TYPE_LABEL.water },
  { value: "internet",    label: SERVICE_TYPE_LABEL.internet },
  { value: "other",       label: SERVICE_TYPE_LABEL.other },
];

const PROVIDER_PLACEHOLDER: Record<UtilityServiceType, string> = {
  electricity: "CFE",
  gas:         "Naturgy / Gas Express",
  water:       "SIMAS / SADM",
  internet:    "Telmex / Totalplay",
  other:       "Nombre del proveedor",
};

export default function BuildingUtilityMeterModal({
  buildingId,
  companyId,
  units,
  existingMeter,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = !!existingMeter;

  const [serviceType, setServiceType]       = useState<UtilityServiceType>(existingMeter?.service_type ?? "electricity");
  const [providerName, setProviderName]     = useState(existingMeter?.provider_name ?? "");
  const [meterNumber, setMeterNumber]       = useState(existingMeter?.meter_number ?? "");
  const [contractNumber, setContractNumber] = useState(existingMeter?.contract_number ?? "");
  const [description, setDescription]       = useState(existingMeter?.description ?? "");
  const [meterType, setMeterType]           = useState<UtilityMeterType | "">(existingMeter?.meter_type ?? "");
  const [unitId, setUnitId]                 = useState(existingMeter?.unit_id ?? "");
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!meterType) {
      setMsg("Debes seleccionar el tipo de medidor.");
      return;
    }
    if (meterType === "dedicated" && !unitId) {
      setMsg("Debes seleccionar la unidad asignada.");
      return;
    }

    setSaving(true);

    const payload = {
      company_id:      companyId,
      building_id:     buildingId,
      service_type:    serviceType,
      meter_type:      meterType as UtilityMeterType,
      unit_id:         meterType === "dedicated" ? unitId : null,
      provider_name:   providerName.trim() || null,
      meter_number:    meterNumber.trim() || null,
      contract_number: contractNumber.trim() || null,
      description:     description.trim() || null,
      active:          true,
    };

    const { error } = isEdit
      ? await supabase.from("building_utility_meters").update(payload).eq("id", existingMeter!.id)
      : await supabase.from("building_utility_meters").insert(payload);

    setSaving(false);

    if (error) {
      setMsg(`Error: ${error.message}`);
      return;
    }

    onSuccess();
  }

  const sortedUnits = sortByNatural(units, u => u.unit_number);

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar servicio" : "Agregar servicio"}>
      <form onSubmit={handleSubmit}>
        {msg ? <p style={errorBannerStyle}>{msg}</p> : null}

        <AppFormField label="Tipo de servicio *">
          <AppSelect
            value={serviceType}
            onChange={e => setServiceType(e.target.value as UtilityServiceType)}
          >
            {SERVICE_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </AppSelect>
        </AppFormField>

        <AppFormField label="Proveedor">
          <input
            value={providerName}
            onChange={e => setProviderName(e.target.value)}
            placeholder={PROVIDER_PLACEHOLDER[serviceType]}
            style={INPUT_STYLE}
          />
        </AppFormField>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <AppFormField label="Número de medidor (opcional)">
            <input
              value={meterNumber}
              onChange={e => setMeterNumber(e.target.value)}
              placeholder="Número de medidor (opcional)"
              style={INPUT_STYLE}
            />
          </AppFormField>
          <AppFormField label="Número de contrato (opcional)">
            <input
              value={contractNumber}
              onChange={e => setContractNumber(e.target.value)}
              placeholder="Número de contrato (opcional)"
              style={INPUT_STYLE}
            />
          </AppFormField>
        </div>

        <AppFormField label="Descripción (opcional)">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            style={INPUT_STYLE}
          />
        </AppFormField>

        <AppFormField label="Tipo de medidor *">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "14px 16px",
                borderRadius: 12,
                cursor: "pointer",
                border: `2px solid ${meterType === "dedicated" ? "#8B2252" : "var(--border-default)"}`,
                background: meterType === "dedicated" ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  value="dedicated"
                  checked={meterType === "dedicated"}
                  onChange={() => setMeterType("dedicated")}
                  style={{ accentColor: "#8B2252" }}
                />
                <strong style={{ fontSize: 14 }}>Dedicado</strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Dedicado — asignado a una sola unidad
              </p>
            </label>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "14px 16px",
                borderRadius: 12,
                cursor: "pointer",
                border: `2px solid ${meterType === "shared" ? "#8B2252" : "var(--border-default)"}`,
                background: meterType === "shared" ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  value="shared"
                  checked={meterType === "shared"}
                  onChange={() => setMeterType("shared")}
                  style={{ accentColor: "#8B2252" }}
                />
                <strong style={{ fontSize: 14 }}>Compartido</strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Compartido — distribuido entre varias unidades
              </p>
            </label>
          </div>
        </AppFormField>

        {meterType === "dedicated" && (
          <AppFormField label="Unidad asignada *">
            <AppSelect value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">Selecciona una unidad</option>
              {sortedUnits.map(u => (
                <option key={u.id} value={u.id}>Depa {u.unit_number}</option>
              ))}
            </AppSelect>
          </AppFormField>
        )}

        {meterType === "shared" && (
          <div
            style={{
              padding: "12px 16px",
              background: "#eff6ff",
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
              color: "#1d4ed8",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Configura los submedidores después de guardar.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Agregar servicio"}
          </UiButton>
        </div>
      </form>
    </Modal>
  );
}
