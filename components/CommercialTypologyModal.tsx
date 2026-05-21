"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import { INPUT_STYLE } from "@/lib/pageStyles";

type Props = {
  open: boolean;
  buildingId: string;
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
};

const INSTALACIONES = [
  { key: "has_electricity_220", label: "Electricidad 220V" },
  { key: "has_three_phase",     label: "Electricidad trifásica" },
  { key: "has_gas_line",        label: "Gas natural / LP" },
  { key: "has_water_meter",     label: "Medidor de agua independiente" },
  { key: "has_ac",              label: "Aire acondicionado / HVAC" },
  { key: "has_network",         label: "Red estructurada / fibra" },
] as const;

type InstKey = (typeof INSTALACIONES)[number]["key"];

const ENTREGA_OPTIONS = [
  { value: "bruta",        label: "Entrega en bruto",         desc: "Sin aplanados ni acabados" },
  { value: "semiacabada",  label: "Semiacabado",              desc: "Muros listos, sin pisos ni plafón" },
  { value: "acabada",      label: "Entrega acabada",          desc: "Lista para instalar mobiliario" },
] as const;

const errorStyle: React.CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 4 };

export default function CommercialTypologyModal({ open, buildingId, companyId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* Step 1 */
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [entrega, setEntrega] = useState<string>("");

  /* Step 2 */
  const [flags, setFlags] = useState<Record<InstKey, boolean>>({
    has_electricity_220: false,
    has_three_phase: false,
    has_gas_line: false,
    has_water_meter: false,
    has_ac: false,
    has_network: false,
  });

  /* Step 3 */
  const [sqmMin, setSqmMin] = useState("");
  const [sqmMax, setSqmMax] = useState("");

  function reset() {
    setStep(1);
    setSaving(false);
    setMsg("");
    setName(""); setNameErr(""); setEntrega("");
    setFlags({ has_electricity_220: false, has_three_phase: false, has_gas_line: false, has_water_meter: false, has_ac: false, has_network: false });
    setSqmMin(""); setSqmMax("");
  }

  function handleClose() { reset(); onClose(); }

  function toStep2() {
    if (!name.trim()) { setNameErr("El nombre es obligatorio"); return; }
    setNameErr("");
    setStep(2);
  }

  async function handleCreate() {
    setSaving(true);
    setMsg("");
    const { error } = await supabase.from("unit_types").insert({
      building_id: buildingId,
      company_id: companyId,
      name: name.trim(),
      bedrooms: 0,
      bathrooms: 0,
      entrega: entrega || null,
      ...flags,
      sqm_min: sqmMin ? parseInt(sqmMin) : null,
      sqm_max: sqmMax ? parseInt(sqmMax) : null,
    });
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    reset();
    onCreated();
  }

  const stepLabels = ["Nombre", "Instalaciones", "Superficie"];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Tipología comercial — ${stepLabels[step - 1]}`}
    >
      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        {stepLabels.map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", ...(i < stepLabels.length - 1 ? { flex: 1 } : {}) }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: step > i + 1 ? "#1D9E75" : step === i + 1 ? "#0369a1" : "var(--border-default)",
                color: step >= i + 1 ? "#fff" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, color: step >= i + 1 ? "#0369a1" : "var(--text-muted)", fontWeight: step === i + 1 ? 700 : 400 }}>
                {label}
              </span>
            </div>
            {i < stepLabels.length - 1 && (
              <div style={{ flex: 1, height: 2, background: step > i + 1 ? "#1D9E75" : "var(--border-default)", margin: "0 4px", marginBottom: 14 }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Nombre + Entrega */}
      {step === 1 && (
        <>
          <AppFormField label="Nombre del tipo de local" required>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameErr(""); }}
              placeholder="Ej. Local estándar, Suite ejecutiva, Showroom"
              style={INPUT_STYLE}
              autoFocus
            />
            {nameErr && <p style={errorStyle}>{nameErr}</p>}
          </AppFormField>

          <AppFormField label="Tipo de entrega">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ENTREGA_OPTIONS.map((opt) => {
                const sel = entrega === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEntrega(sel ? "" : opt.value)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 14px", borderRadius: "var(--border-radius-md)", textAlign: "left",
                      border: sel ? "2px solid #0369a1" : "1.5px solid var(--border-default)",
                      background: sel ? "#0369a112" : "var(--bg-card)",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${sel ? "#0369a1" : "var(--border-default)"}`, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0369a1" }} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? "#0369a1" : "var(--text-primary)" }}>{opt.label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </AppFormField>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <UiButton variant="primary" onClick={toStep2}>Siguiente →</UiButton>
            <UiButton onClick={handleClose}>Cancelar</UiButton>
          </div>
        </>
      )}

      {/* Step 2: Instalaciones */}
      {step === 2 && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Selecciona las instalaciones disponibles en este tipo de local.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {INSTALACIONES.map(({ key, label }) => {
              const sel = flags[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFlags(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: "var(--border-radius-md)", textAlign: "left",
                    border: sel ? "2px solid #0369a1" : "1.5px solid var(--border-default)",
                    background: sel ? "#0369a112" : "var(--bg-card)",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: "var(--border-radius-sm)", border: `2px solid ${sel ? "#0369a1" : "var(--border-default)"}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#0369a1" : "transparent" }}>
                    {sel && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? "#0369a1" : "var(--text-primary)" }}>{label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton variant="primary" onClick={() => setStep(3)}>Siguiente →</UiButton>
            <UiButton onClick={() => setStep(1)}>← Atrás</UiButton>
            <UiButton onClick={handleClose}>Cancelar</UiButton>
          </div>
        </>
      )}

      {/* Step 3: Superficie */}
      {step === 3 && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Superficie de referencia para esta tipología. Puede dejarse vacío.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <AppFormField label="M² mínimos">
              <input type="number" min={0} value={sqmMin} onChange={e => setSqmMin(e.target.value)} placeholder="Ej. 50" style={INPUT_STYLE} />
            </AppFormField>
            <AppFormField label="M² máximos">
              <input type="number" min={0} value={sqmMax} onChange={e => setSqmMax(e.target.value)} placeholder="Ej. 200" style={INPUT_STYLE} />
            </AppFormField>
          </div>

          {/* Resumen */}
          <div style={{ padding: 14, borderRadius: "var(--border-radius-md)", background: "var(--bg-page)", border: "1px solid var(--border-default)", marginBottom: 20, fontSize: 12, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{name}</strong>
            {entrega && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: "var(--border-radius-sm)", background: "#0369a115", color: "#0369a1", fontSize: 11, fontWeight: 600 }}>{ENTREGA_OPTIONS.find(o => o.value === entrega)?.label}</span>}
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {INSTALACIONES.filter(i => flags[i.key]).map(i => (
                <span key={i.key} style={{ padding: "2px 8px", borderRadius: "var(--border-radius-sm)", background: "#0369a112", color: "#0369a1", fontSize: 11 }}>{i.label}</span>
              ))}
            </div>
          </div>

          {msg && <p style={{ ...errorStyle, marginBottom: 12 }}>{msg}</p>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton variant="primary" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Guardando..." : "Crear tipología"}
            </UiButton>
            <UiButton onClick={() => setStep(2)}>← Atrás</UiButton>
            <UiButton onClick={handleClose}>Cancelar</UiButton>
          </div>
        </>
      )}
    </Modal>
  );
}
