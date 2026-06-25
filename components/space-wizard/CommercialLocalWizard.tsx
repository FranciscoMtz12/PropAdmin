"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WizardShell from "@/components/WizardShell";
import AppFormField from "@/components/AppFormField";
import toast from "react-hot-toast";
import type { NonResidentialProps } from "./types";

/* ─── wizard_state shape (documented)
   {
     s1: { description: string; sqm_min: string; sqm_max: string },
     attrs: {
       entrega: string;            // "OBRA_GRIS" | "ACABADO" | "SEMI"
       has_ac: boolean;
       has_network: boolean;
       has_electricity_220: boolean;
       has_bathroom: boolean;
       has_bodega_trasera: boolean;
       has_mezzanine: boolean;
       has_escaparate: boolean;
     }
   }
──────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { label: "Información" },
  { label: "Atributos" },
  { label: "Resumen" },
];

type CS1 = { name: string; description: string; sqm_min: string; sqm_max: string };
type CAttrs = {
  entrega: string;
  has_ac: boolean;
  has_network: boolean;
  has_electricity_220: boolean;
  has_bathroom: boolean;
  has_bodega_trasera: boolean;
  has_mezzanine: boolean;
  has_escaparate: boolean;
};

const INIT_S1: CS1 = { name: "", description: "", sqm_min: "", sqm_max: "" };
const INIT_ATTRS: CAttrs = {
  entrega: "OBRA_GRIS",
  has_ac: false, has_network: false, has_electricity_220: false,
  has_bathroom: false, has_bodega_trasera: false, has_mezzanine: false, has_escaparate: false,
};

const INPUT: React.CSSProperties = {
  width: "100%", padding: 10, border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box", fontSize: "0.875rem",
};

const ENTREGA_OPTIONS = [
  { value: "OBRA_GRIS", label: "Obra gris" },
  { value: "SEMI",      label: "Semi-acabado" },
  { value: "ACABADO",   label: "Acabado completo" },
];

function ps(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
    border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
    background: active ? "var(--accent-tint-soft)" : "var(--bg-card)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
  };
}

function CheckToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", border: `1px solid ${checked ? "var(--accent)" : "var(--border-default)"}`, borderRadius: "var(--border-radius-md)", background: checked ? "var(--accent-tint-soft)" : "var(--bg-card)" }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, border: checked ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: checked ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && <div style={{ width: 8, height: 5, borderLeft: "2px solid #fff", borderBottom: "2px solid #fff", transform: "rotate(-45deg) translateY(-1px)" }} />}
      </div>
      <span style={{ fontSize: "0.8125rem", fontWeight: checked ? 600 : 400, color: checked ? "var(--accent)" : "var(--text-primary)" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
    </label>
  );
}

function buildPayload(s1: CS1, attrs: CAttrs) {
  return {
    name: s1.name.trim(),
    bedrooms: null, bathrooms: attrs.has_bathroom ? 1 : 0,
    has_living_room: false, has_dining_room: false, has_patio: false,
    has_fridge: false, has_washer: false, has_dryer: false, stove_type: "NONE",
    sqm_min: s1.sqm_min ? parseFloat(s1.sqm_min) : null,
    sqm_max: s1.sqm_max ? parseFloat(s1.sqm_max) : null,
    entrega: attrs.entrega,
    has_ac: attrs.has_ac,
    has_network: attrs.has_network,
    has_electricity_220: attrs.has_electricity_220,
    wizard_state: { s1, attrs },
  };
}

export default function CommercialLocalWizard({ open, propertyId, companyId, spaceType, editTemplate, onClose, onSuccess }: NonResidentialProps) {
  const isEdit = !!editTemplate;
  const [step, setStep]       = useState(1);
  const [stepDir, setStepDir] = useState<"left" | "right">("right");
  const [s1, setS1]           = useState<CS1>({ ...INIT_S1 });
  const [attrs, setAttrs]     = useState<CAttrs>({ ...INIT_ATTRS });
  const [s1Error, setS1Error] = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (open && editTemplate) {
      const ws = editTemplate.wizard_state as { s1?: Partial<CS1>; attrs?: Partial<CAttrs> } | null;
      setS1({ ...INIT_S1, name: editTemplate.name, ...(ws?.s1 ?? {}) });
      setAttrs({ ...INIT_ATTRS, ...(ws?.attrs ?? {}) });
      setStep(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTemplate?.id]);

  function reset() { setStep(1); setS1({ ...INIT_S1 }); setAttrs({ ...INIT_ATTRS }); setS1Error(""); setSaving(false); }
  function handleClose() { reset(); onClose(); }

  function goNext() {
    if (step === 1 && !s1.name.trim()) { setS1Error("El nombre es obligatorio."); return; }
    setS1Error(""); setStepDir("right"); setStep(p => Math.min(p + 1, STEPS.length));
  }
  function goBack() { setStepDir("left"); setStep(p => Math.max(1, p - 1)); }
  function handleStepJump(target: number) { setStepDir(target > step ? "right" : "left"); setStep(target); }

  function setAttr<K extends keyof CAttrs>(k: K, v: CAttrs[K]) { setAttrs(prev => ({ ...prev, [k]: v })); }

  async function handleCreate() {
    setSaving(true);
    const { error } = await supabase.from("space_templates")
      .insert({ property_id: propertyId, company_id: companyId, space_type: spaceType, ...buildPayload(s1, attrs) });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Plantilla de local comercial creada");
    reset(); onSuccess(); onClose();
  }

  async function handleEdit() {
    if (!editTemplate) return;
    setSaving(true);
    const { error } = await supabase.from("space_templates").update(buildPayload(s1, attrs)).eq("id", editTemplate.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Plantilla de local comercial actualizada");
    reset(); onSuccess(); onClose();
  }

  function renderStep() {
    if (step === 1) return (
      <div style={{ display: "grid", gap: 14 }}>
        <AppFormField label="Nombre del local" required>
          <input value={s1.name} onChange={e => { setS1(p => ({ ...p, name: e.target.value })); setS1Error(""); }}
            placeholder="Ej. Local Comercial LC-01" style={INPUT} />
          {s1Error && <p style={{ margin: "4px 0 0", color: "var(--metric-value-red)", fontSize: "0.75rem" }}>{s1Error}</p>}
        </AppFormField>
        <AppFormField label="Descripción">
          <textarea value={s1.description} onChange={e => setS1(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripción opcional..." rows={2} style={{ ...INPUT, resize: "vertical" }} />
        </AppFormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <AppFormField label="Superficie mín. (m²)">
            <input type="number" min={0} step={1} value={s1.sqm_min} onChange={e => setS1(p => ({ ...p, sqm_min: e.target.value }))} placeholder="Ej. 40" style={INPUT} />
          </AppFormField>
          <AppFormField label="Superficie máx. (m²)">
            <input type="number" min={0} step={1} value={s1.sqm_max} onChange={e => setS1(p => ({ ...p, sqm_max: e.target.value }))} placeholder="Ej. 120" style={INPUT} />
          </AppFormField>
        </div>
      </div>
    );

    if (step === 2) return (
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Tipo de entrega</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ENTREGA_OPTIONS.map(o => (
              <button key={o.value} type="button" onClick={() => setAttr("entrega", o.value)} style={ps(attrs.entrega === o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Características</div>
          <div style={{ display: "grid", gap: 8 }}>
            <CheckToggle checked={attrs.has_escaparate} onChange={v => setAttr("has_escaparate", v)} label="Escaparate / vitrina exterior" />
            <CheckToggle checked={attrs.has_bathroom} onChange={v => setAttr("has_bathroom", v)} label="Baño propio" />
            <CheckToggle checked={attrs.has_bodega_trasera} onChange={v => setAttr("has_bodega_trasera", v)} label="Bodega trasera" />
            <CheckToggle checked={attrs.has_mezzanine} onChange={v => setAttr("has_mezzanine", v)} label="Mezzanine" />
            <CheckToggle checked={attrs.has_ac} onChange={v => setAttr("has_ac", v)} label="Aire acondicionado" />
            <CheckToggle checked={attrs.has_network} onChange={v => setAttr("has_network", v)} label="Infraestructura de red" />
            <CheckToggle checked={attrs.has_electricity_220} onChange={v => setAttr("has_electricity_220", v)} label="Electricidad 220 V" />
          </div>
        </div>
      </div>
    );

    // Step 3: Resumen
    const entregaLabel = ENTREGA_OPTIONS.find(o => o.value === attrs.entrega)?.label ?? attrs.entrega;
    const featList = [
      attrs.has_escaparate && "Escaparate",
      attrs.has_bathroom && "Baño propio",
      attrs.has_bodega_trasera && "Bodega trasera",
      attrs.has_mezzanine && "Mezzanine",
      attrs.has_ac && "Aire acondicionado",
      attrs.has_network && "Red voz/datos",
      attrs.has_electricity_220 && "Electricidad 220 V",
    ].filter(Boolean) as string[];

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{s1.name}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 999, background: "var(--bg-input)" }}>Local comercial</span>
            {(s1.sqm_min || s1.sqm_max) && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s1.sqm_min && s1.sqm_max ? `${s1.sqm_min}–${s1.sqm_max} m²` : `${s1.sqm_min || s1.sqm_max} m²`}</span>}
            <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999, background: "var(--accent-tint-soft)", color: "var(--accent)" }}>Entrega: {entregaLabel}</span>
          </div>
          {s1.description && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s1.description}</p>}
        </div>
        {featList.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>CARACTERÍSTICAS</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {featList.map(lbl => (
                <span key={lbl} style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--accent-tint-soft)", color: "var(--accent)", border: "1px solid var(--accent-tint-medium)" }}>{lbl}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <WizardShell
      open={open}
      title={isEdit ? "Editar plantilla — Local comercial" : "Nueva plantilla — Local comercial"}
      steps={STEPS}
      currentStep={step}
      stepDir={stepDir}
      mode={isEdit ? "edit" : "create"}
      onNext={goNext}
      onBack={goBack}
      onCancel={handleClose}
      onFinish={() => { void handleCreate(); }}
      onSave={() => { void handleEdit(); }}
      onStepChange={isEdit ? handleStepJump : undefined}
      finalLabel="Crear plantilla"
      loading={saving}
    >
      {renderStep()}
    </WizardShell>
  );
}
