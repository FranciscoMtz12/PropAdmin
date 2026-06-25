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
       has_ac: boolean; has_network: boolean; has_electricity_220: boolean;
       privados: number; salas_junta: number;
       has_bathroom: boolean; has_kitchenette: boolean;
     }
   }
──────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { label: "Información" },
  { label: "Atributos" },
  { label: "Resumen" },
];

type OS1 = { name: string; description: string; sqm_min: string; sqm_max: string };
type OAttrs = {
  has_ac: boolean;
  has_network: boolean;
  has_electricity_220: boolean;
  privados: number;
  salas_junta: number;
  has_bathroom: boolean;
  has_kitchenette: boolean;
};

const INIT_S1: OS1 = { name: "", description: "", sqm_min: "", sqm_max: "" };
const INIT_ATTRS: OAttrs = {
  has_ac: false, has_network: false, has_electricity_220: false,
  privados: 0, salas_junta: 0, has_bathroom: false, has_kitchenette: false,
};

const INPUT: React.CSSProperties = {
  width: "100%", padding: 10, border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box", fontSize: "0.875rem",
};

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

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)" }}>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          style={{ width: 28, height: 28, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>−</button>
        <span style={{ fontSize: "1rem", fontWeight: 700, minWidth: 20, textAlign: "center" }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 28, height: 28, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>+</button>
      </div>
    </div>
  );
}

function buildPayload(s1: OS1, attrs: OAttrs) {
  return {
    name: s1.name.trim(),
    bedrooms: null, bathrooms: attrs.has_bathroom ? 1 : 0,
    has_living_room: false, has_dining_room: false, has_patio: false,
    has_fridge: false, has_washer: false, has_dryer: false, stove_type: "NONE",
    sqm_min: s1.sqm_min ? parseFloat(s1.sqm_min) : null,
    sqm_max: s1.sqm_max ? parseFloat(s1.sqm_max) : null,
    has_ac: attrs.has_ac,
    has_network: attrs.has_network,
    has_electricity_220: attrs.has_electricity_220,
    wizard_state: { s1, attrs },
  };
}

export default function OfficeWizard({ open, propertyId, companyId, spaceType, editTemplate, onClose, onSuccess }: NonResidentialProps) {
  const isEdit = !!editTemplate;
  const [step, setStep]       = useState(1);
  const [stepDir, setStepDir] = useState<"left" | "right">("right");
  const [s1, setS1]           = useState<OS1>({ ...INIT_S1 });
  const [attrs, setAttrs]     = useState<OAttrs>({ ...INIT_ATTRS });
  const [s1Error, setS1Error] = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (open && editTemplate) {
      const ws = editTemplate.wizard_state as { s1?: Partial<OS1>; attrs?: Partial<OAttrs> } | null;
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

  function setAttr<K extends keyof OAttrs>(k: K, v: OAttrs[K]) { setAttrs(prev => ({ ...prev, [k]: v })); }

  async function handleCreate() {
    setSaving(true);
    const { error } = await supabase.from("space_templates")
      .insert({ property_id: propertyId, company_id: companyId, space_type: spaceType, ...buildPayload(s1, attrs) });
    if (error) { toast.error(error.message); setSaving(false); return; }
    // Oficinas sin assets complejos — el has_bathroom se refleja en bathrooms col
    toast.success("Plantilla de oficina creada");
    reset(); onSuccess(); onClose();
  }

  async function handleEdit() {
    if (!editTemplate) return;
    setSaving(true);
    const { error } = await supabase.from("space_templates").update(buildPayload(s1, attrs)).eq("id", editTemplate.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Plantilla de oficina actualizada");
    reset(); onSuccess(); onClose();
  }

  function renderStep() {
    if (step === 1) return (
      <div style={{ display: "grid", gap: 14 }}>
        <AppFormField label="Nombre de la oficina" required>
          <input value={s1.name} onChange={e => { setS1(p => ({ ...p, name: e.target.value })); setS1Error(""); }}
            placeholder="Ej. Oficina Ejecutiva P3-A" style={INPUT} />
          {s1Error && <p style={{ margin: "4px 0 0", color: "var(--metric-value-red)", fontSize: "0.75rem" }}>{s1Error}</p>}
        </AppFormField>
        <AppFormField label="Descripción">
          <textarea value={s1.description} onChange={e => setS1(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripción opcional..." rows={2} style={{ ...INPUT, resize: "vertical" }} />
        </AppFormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <AppFormField label="Superficie mín. (m²)">
            <input type="number" min={0} step={1} value={s1.sqm_min} onChange={e => setS1(p => ({ ...p, sqm_min: e.target.value }))} placeholder="Ej. 30" style={INPUT} />
          </AppFormField>
          <AppFormField label="Superficie máx. (m²)">
            <input type="number" min={0} step={1} value={s1.sqm_max} onChange={e => setS1(p => ({ ...p, sqm_max: e.target.value }))} placeholder="Ej. 80" style={INPUT} />
          </AppFormField>
        </div>
      </div>
    );

    if (step === 2) return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <Counter label="Privados / cubículos cerrados" value={attrs.privados} onChange={v => setAttr("privados", v)} />
          <Counter label="Salas de juntas" value={attrs.salas_junta} onChange={v => setAttr("salas_junta", v)} />
        </div>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Instalaciones</div>
          <div style={{ display: "grid", gap: 8 }}>
            <CheckToggle checked={attrs.has_ac} onChange={v => setAttr("has_ac", v)} label="Aire acondicionado" />
            <CheckToggle checked={attrs.has_network} onChange={v => setAttr("has_network", v)} label="Infraestructura de red (voz/datos)" />
            <CheckToggle checked={attrs.has_electricity_220} onChange={v => setAttr("has_electricity_220", v)} label="Electricidad 220 V" />
            <CheckToggle checked={attrs.has_bathroom} onChange={v => setAttr("has_bathroom", v)} label="Baño privado" />
            <CheckToggle checked={attrs.has_kitchenette} onChange={v => setAttr("has_kitchenette", v)} label="Kitchenette / área de café" />
          </div>
        </div>
      </div>
    );

    // Step 3: Resumen
    const attrList = [
      attrs.has_ac && "Aire acondicionado",
      attrs.has_network && "Red voz/datos",
      attrs.has_electricity_220 && "Electricidad 220 V",
      attrs.has_bathroom && "Baño privado",
      attrs.has_kitchenette && "Kitchenette",
    ].filter(Boolean) as string[];

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{s1.name}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 999, background: "var(--bg-input)" }}>Oficina</span>
            {(s1.sqm_min || s1.sqm_max) && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s1.sqm_min && s1.sqm_max ? `${s1.sqm_min}–${s1.sqm_max} m²` : `${s1.sqm_min || s1.sqm_max} m²`}</span>}
            {attrs.privados > 0 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{attrs.privados} privado{attrs.privados !== 1 ? "s" : ""}</span>}
            {attrs.salas_junta > 0 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{attrs.salas_junta} sala{attrs.salas_junta !== 1 ? "s" : ""} de juntas</span>}
          </div>
          {s1.description && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s1.description}</p>}
        </div>
        {attrList.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>INSTALACIONES</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {attrList.map(lbl => (
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
      title={isEdit ? "Editar plantilla — Oficina" : "Nueva plantilla — Oficina"}
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
