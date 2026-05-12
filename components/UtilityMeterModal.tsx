"use client";

import { useState } from "react";
import { Building2, Calendar, CalendarDays, Info, User } from "lucide-react";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE, errorBannerStyle } from "@/lib/pageStyles";
import { sortByNatural } from "@/lib/sort-utils";
import type { BuildingUtilityMeter, UtilityServiceType, UtilityMeterType, BillingFrequency } from "@/lib/types";
import { SERVICE_TYPE_LABEL } from "@/lib/types";

type Props = {
  isOpen: boolean;
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

const MONTH_OPTIONS = [
  { value: 1,  label: "Enero" },
  { value: 2,  label: "Febrero" },
  { value: 3,  label: "Marzo" },
  { value: 4,  label: "Abril" },
  { value: 5,  label: "Mayo" },
  { value: 6,  label: "Junio" },
  { value: 7,  label: "Julio" },
  { value: 8,  label: "Agosto" },
  { value: 9,  label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function UtilityMeterModal({
  isOpen,
  buildingId,
  companyId,
  units,
  existingMeter,
  onClose,
  onSuccess,
}: Props) {
  if (!isOpen) return null;

  const isEdit = !!existingMeter;

  const [serviceType, setServiceType]       = useState<UtilityServiceType>(existingMeter?.service_type ?? "electricity");
  const [providerName, setProviderName]     = useState(existingMeter?.provider_name ?? "");
  const [meterNumber, setMeterNumber]       = useState(existingMeter?.meter_number ?? "");
  const [contractNumber, setContractNumber] = useState(existingMeter?.contract_number ?? "");
  const [description, setDescription]       = useState(existingMeter?.description ?? "");
  const [meterType, setMeterType]           = useState<UtilityMeterType | "">(existingMeter?.meter_type ?? "");
  const [billingMode, setBillingMode]         = useState<'charged' | 'included'>(existingMeter?.billing_mode ?? 'charged');
  const [contractHolder, setContractHolder]   = useState<'tenant' | 'company'>(existingMeter?.contract_holder ?? 'company');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>(existingMeter?.billing_frequency ?? 'monthly');
  const [cycleStartMonth, setCycleStartMonth]   = useState<number | "">(existingMeter?.cycle_start_month ?? "");
  const [cycleStartYear, setCycleStartYear]     = useState<number | "">(existingMeter?.cycle_start_year ?? "");
  const [billingType, setBillingType]   = useState<'variable' | 'fixed'>(existingMeter?.billing_type ?? 'variable');
  const [fixedAmount, setFixedAmount]   = useState(existingMeter?.fixed_amount ? String(existingMeter.fixed_amount) : "");
  const [unitId, setUnitId]                 = useState(existingMeter?.unit_id ?? "");
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!meterType) { setMsg("Debes seleccionar el tipo de medidor."); return; }
    if (meterType === "dedicated" && !unitId) { setMsg("Debes seleccionar la unidad asignada."); return; }

    setSaving(true);

    const payload = {
      company_id:        companyId,
      building_id:       buildingId,
      service_type:      serviceType,
      meter_type:        meterType as UtilityMeterType,
      billing_mode:      meterType === "dedicated" ? "charged" : billingMode,
      contract_holder:   meterType === "shared" ? "company" : contractHolder,
      billing_frequency: billingFrequency,
      cycle_start_month: billingFrequency === "bimonthly" ? (cycleStartMonth || null) : null,
      cycle_start_year:  billingFrequency === "bimonthly" ? (cycleStartYear || null) : null,
      billing_type:      billingType,
      fixed_amount:      billingType === "fixed" ? (parseFloat(fixedAmount) || 0) : 0,
      unit_id:           meterType === "dedicated" ? unitId : null,
      provider_name:     providerName.trim() || null,
      meter_number:      meterNumber.trim() || null,
      contract_number:   contractNumber.trim() || null,
      description:       description.trim() || null,
      active:            true,
    };

    const { error } = isEdit
      ? await supabase.from("building_utility_meters").update(payload).eq("id", existingMeter!.id)
      : await supabase.from("building_utility_meters").insert(payload);

    setSaving(false);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    onSuccess();
  }

  const sortedUnits = sortByNatural(units, u => u.unit_number);

  const generatesCharge =
    (meterType === "dedicated" && contractHolder === "company") ||
    (meterType === "shared" && billingMode === "charged");

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
              placeholder="Número de medidor"
              style={INPUT_STYLE}
            />
          </AppFormField>
          <AppFormField label="Número de contrato (opcional)">
            <input
              value={contractNumber}
              onChange={e => setContractNumber(e.target.value)}
              placeholder="Número de contrato"
              style={INPUT_STYLE}
            />
          </AppFormField>
        </div>

        <AppFormField label="Descripción (opcional)">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descripción"
            style={INPUT_STYLE}
          />
        </AppFormField>

        <AppFormField label="Tipo de medidor *">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            {(["dedicated", "shared"] as const).map(type => (
              <label
                key={type}
                style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${meterType === type ? "#8B2252" : "var(--border-default)"}`,
                  background: meterType === type ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="radio"
                    value={type}
                    checked={meterType === type}
                    onChange={() => setMeterType(type)}
                    style={{ accentColor: "#8B2252" }}
                  />
                  <strong style={{ fontSize: 14 }}>{type === "dedicated" ? "Dedicado" : "Compartido"}</strong>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {type === "dedicated"
                    ? "Asignado a una sola unidad"
                    : "Distribuido entre varias unidades"}
                </p>
              </label>
            ))}
          </div>
        </AppFormField>

        {meterType === "dedicated" && (
          <>
            <AppFormField label="¿Quién tiene el contrato con el proveedor?">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                <label style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${contractHolder === "company" ? "#8B2252" : "var(--border-default)"}`,
                  background: contractHolder === "company" ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="radio" value="company" checked={contractHolder === "company"} onChange={() => setContractHolder("company")} style={{ accentColor: "#8B2252" }} />
                    <Building2 size={14} />
                    <strong style={{ fontSize: 14 }}>La empresa paga y cobra</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    La empresa recibe la factura y genera un cobro al inquilino.
                  </p>
                </label>
                <label style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${contractHolder === "tenant" ? "#8B2252" : "var(--border-default)"}`,
                  background: contractHolder === "tenant" ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="radio" value="tenant" checked={contractHolder === "tenant"} onChange={() => setContractHolder("tenant")} style={{ accentColor: "#8B2252" }} />
                    <User size={14} />
                    <strong style={{ fontSize: 14 }}>El inquilino paga directo</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    El inquilino tiene su propio contrato. La empresa no interviene.
                  </p>
                </label>
              </div>
            </AppFormField>

            <AppFormField label="Unidad asignada *">
              <AppSelect value={unitId} onChange={e => setUnitId(e.target.value)}>
                <option value="">Selecciona una unidad</option>
                {sortedUnits.map(u => (
                  <option key={u.id} value={u.id}>Depa {u.unit_number}</option>
                ))}
              </AppSelect>
            </AppFormField>
          </>
        )}

        {meterType === "shared" && (
          <>
            <AppFormField label="¿Cómo se maneja el costo?">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                {(["charged", "included"] as const).map(mode => (
                  <label key={mode} style={{
                    display: "flex", flexDirection: "column", gap: 6,
                    padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                    border: `2px solid ${billingMode === mode ? "#8B2252" : "var(--border-default)"}`,
                    background: billingMode === mode ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="radio" value={mode} checked={billingMode === mode} onChange={() => setBillingMode(mode)} style={{ accentColor: "#8B2252" }} />
                      <strong style={{ fontSize: 14 }}>{mode === "charged" ? "Se cobra al inquilino" : "Incluido en renta"}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {mode === "charged" ? "El costo se distribuye y genera cobros." : "Solo registro de gasto — sin cobro."}
                    </p>
                  </label>
                ))}
              </div>
            </AppFormField>

            {billingMode === "charged" ? (
              <div style={{ padding: "12px 16px", background: "#eff6ff", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#1d4ed8", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Configura los submedidores después de guardar.
              </div>
            ) : (
              <div style={{ padding: "12px 16px", background: "var(--bg-page)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "flex-start", gap: 8, border: "1px solid var(--border-default)" }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Gasto del edificio — las facturas se registran sin generar cobros.
              </div>
            )}
          </>
        )}

        {generatesCharge && (
          <>
            <AppFormField label="Tipo de facturación">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                {(["variable", "fixed"] as const).map(bt => (
                  <label key={bt} style={{
                    display: "flex", flexDirection: "column", gap: 6,
                    padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                    border: `2px solid ${billingType === bt ? "#8B2252" : "var(--border-default)"}`,
                    background: billingType === bt ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="radio" value={bt} checked={billingType === bt} onChange={() => setBillingType(bt)} style={{ accentColor: "#8B2252" }} />
                      <strong style={{ fontSize: 14 }}>{bt === "variable" ? "Monto variable" : "Monto fijo"}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {bt === "variable" ? "El monto varía cada período (CFE, agua, gas)" : "Mismo monto cada mes (internet, cuota fija)"}
                    </p>
                  </label>
                ))}
              </div>
            </AppFormField>

            {billingType === "fixed" && (
              <AppFormField label="Monto mensual fijo *">
                <input
                  type="number"
                  value={fixedAmount}
                  onChange={e => setFixedAmount(e.target.value)}
                  placeholder="$0.00"
                  style={INPUT_STYLE}
                  step="0.01"
                  min="0"
                />
              </AppFormField>
            )}
          </>
        )}

        {generatesCharge && (
          <>
            <AppFormField label="Frecuencia de cobro">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                <label style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${billingFrequency === "monthly" ? "#8B2252" : "var(--border-default)"}`,
                  background: billingFrequency === "monthly" ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="radio" value="monthly" checked={billingFrequency === "monthly"} onChange={() => setBillingFrequency("monthly")} style={{ accentColor: "#8B2252" }} />
                    <CalendarDays size={14} />
                    <strong style={{ fontSize: 14 }}>Mensual</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>Se cobra cada mes</p>
                </label>
                <label style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${billingFrequency === "bimonthly" ? "#8B2252" : "var(--border-default)"}`,
                  background: billingFrequency === "bimonthly" ? "rgba(139,34,82,0.06)" : "var(--bg-card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="radio" value="bimonthly" checked={billingFrequency === "bimonthly"} onChange={() => setBillingFrequency("bimonthly")} style={{ accentColor: "#8B2252" }} />
                    <Calendar size={14} />
                    <strong style={{ fontSize: 14 }}>Bimestral</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>Se cobra cada dos meses (ej. CFE)</p>
                </label>
              </div>
            </AppFormField>

            {billingFrequency === "bimonthly" && (
              <>
                <AppFormField label="¿En qué mes inicia el ciclo de facturación?">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <AppSelect
                      value={cycleStartMonth === "" ? "" : String(cycleStartMonth)}
                      onChange={e => setCycleStartMonth(e.target.value === "" ? "" : Number(e.target.value))}
                    >
                      <option value="">Mes</option>
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </AppSelect>
                    <AppSelect
                      value={cycleStartYear === "" ? "" : String(cycleStartYear)}
                      onChange={e => setCycleStartYear(e.target.value === "" ? "" : Number(e.target.value))}
                    >
                      <option value="">Año</option>
                      {YEAR_OPTIONS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </AppSelect>
                  </div>
                </AppFormField>
                <div style={{ padding: "12px 16px", background: "#eff6ff", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#1d4ed8", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  El mes de inicio determina en qué meses del año se genera la factura.
                </div>
              </>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</UiButton>
          <UiButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Agregar servicio"}
          </UiButton>
        </div>
      </form>
    </Modal>
  );
}
