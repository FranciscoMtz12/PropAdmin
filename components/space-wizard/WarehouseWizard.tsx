"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import WizardShell from "@/components/WizardShell";
import AppFormField from "@/components/AppFormField";
import { Plus, X, Zap, Flame, Droplets, Wifi, Wind, Truck } from "lucide-react";
import toast from "react-hot-toast";
import type { NonResidentialProps, AssetRow } from "./types";

/* ─── wizard_state shape (documented)
   {
     s1: { description: string; sqm_min: string; sqm_max: string },
     attrs: {
       altura_libre: string; acceso_tipo: string;
       has_electricity_220: boolean; has_three_phase: boolean;
       has_gas_line: boolean; has_water_meter: boolean;
       has_network: boolean; has_ac: boolean; capacidad_electrica: string;
     },
     eq: { items: string[]; customItems: string[] }
   }
──────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { label: "Información" },
  { label: "Atributos" },
  { label: "Equipamiento" },
  { label: "Resumen" },
];

type WS1 = { name: string; description: string; sqm_min: string; sqm_max: string };
type WAttrs = {
  altura_libre: string;
  acceso_tipo: string;
  has_electricity_220: boolean;
  has_three_phase: boolean;
  has_gas_line: boolean;
  has_water_meter: boolean;
  has_network: boolean;
  has_ac: boolean;
  capacidad_electrica: string;
};
type WEq = { items: string[]; customItems: string[] };

const INIT_S1: WS1 = { name: "", description: "", sqm_min: "", sqm_max: "" };
const INIT_ATTRS: WAttrs = {
  altura_libre: "", acceso_tipo: "NONE",
  has_electricity_220: false, has_three_phase: false,
  has_gas_line: false, has_water_meter: false,
  has_network: false, has_ac: false, capacidad_electrica: "",
};
const INIT_EQ: WEq = { items: [], customItems: [] };

const PRESET_ITEMS = [
  "Andén de carga", "Rampa vehicular", "Oficina interior", "Baño / sanitarios",
  "Montacarga", "Mezzanine", "Cuarto frío", "Sistema contra incendio",
  "Patio de maniobras", "Báscula",
];

const ACCESO_OPTIONS = [
  { value: "NONE",     label: "Sin especificar" },
  { value: "NIVEL",    label: "Nivel" },
  { value: "RAMPA",    label: "Rampa" },
  { value: "DOCK",     label: "Dock / andén" },
  { value: "MULTIPLE", label: "Múltiple" },
];

const CAP_OPTIONS = [
  { value: "",     label: "Sin especificar" },
  { value: "63A",  label: "63 A" },
  { value: "125A", label: "125 A" },
  { value: "200A", label: "200 A" },
  { value: "400A", label: "400 A" },
  { value: "OTRO", label: "Otro" },
];

/* ─── Styles ────────────────────────────────────────────────────────── */

const INPUT: React.CSSProperties = {
  width: "100%", padding: 10, border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box", fontSize: "0.875rem",
};
const SELECT: React.CSSProperties = { ...INPUT };

function ps(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
    border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
    background: active ? "var(--accent-tint-soft)" : "var(--bg-card)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
  };
}

function eqRow(label: string, child: React.ReactNode) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {child}
    </div>
  );
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

/* ─── buildPayload ─────────────────────────────────────────────────── */

function buildPayload(s1: WS1, attrs: WAttrs) {
  return {
    name: s1.name.trim(),
    bedrooms: null, bathrooms: null,
    has_living_room: false, has_dining_room: false, has_patio: false,
    has_fridge: false, has_washer: false, has_dryer: false, stove_type: "NONE",
    sqm_min: s1.sqm_min ? parseFloat(s1.sqm_min) : null,
    sqm_max: s1.sqm_max ? parseFloat(s1.sqm_max) : null,
    altura_libre: attrs.altura_libre ? parseFloat(attrs.altura_libre) : null,
    acceso_tipo: attrs.acceso_tipo !== "NONE" ? attrs.acceso_tipo : null,
    has_electricity_220: attrs.has_electricity_220,
    has_three_phase: attrs.has_three_phase,
    has_gas_line: attrs.has_gas_line,
    has_water_meter: attrs.has_water_meter,
    has_network: attrs.has_network,
    has_ac: attrs.has_ac,
    capacidad_electrica: attrs.capacidad_electrica || null,
    wizard_state: { s1, attrs, eq: undefined as unknown }, // set by caller
  };
}

function buildAssets(eq: WEq): AssetRow[] {
  const rows: AssetRow[] = [];
  [...eq.items, ...eq.customItems].forEach((name, i) => {
    rows.push({ asset_type: "OTHER", name, status: "ACTIVE", notes: null, sort_order: i });
  });
  return rows;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export default function WarehouseWizard({ open, propertyId, companyId, spaceType, editTemplate, onClose, onSuccess }: NonResidentialProps) {
  const isEdit = !!editTemplate;
  const [step, setStep]       = useState(1);
  const [stepDir, setStepDir] = useState<"left" | "right">("right");
  const [s1, setS1]           = useState<WS1>({ ...INIT_S1 });
  const [attrs, setAttrs]     = useState<WAttrs>({ ...INIT_ATTRS });
  const [eq, setEq]           = useState<WEq>({ ...INIT_EQ });
  const [s1Error, setS1Error] = useState("");
  const [saving, setSaving]   = useState(false);
  const [customInput, setCustomInput] = useState("");

  /* Restore from editTemplate */
  useEffect(() => {
    if (open && editTemplate) {
      const ws = editTemplate.wizard_state as { s1?: Partial<WS1>; attrs?: Partial<WAttrs>; eq?: Partial<WEq> } | null;
      setS1({ ...INIT_S1, name: editTemplate.name, ...(ws?.s1 ?? {}) });
      setAttrs({ ...INIT_ATTRS, ...(ws?.attrs ?? {}) });
      setEq({ ...INIT_EQ, ...(ws?.eq ?? {}) });
      setStep(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTemplate?.id]);

  function reset() {
    setStep(1); setS1({ ...INIT_S1 }); setAttrs({ ...INIT_ATTRS }); setEq({ ...INIT_EQ });
    setS1Error(""); setSaving(false); setCustomInput("");
  }
  function handleClose() { reset(); onClose(); }

  function goNext() {
    if (step === 1 && !s1.name.trim()) { setS1Error("El nombre es obligatorio."); return; }
    setS1Error(""); setStepDir("right"); setStep(p => Math.min(p + 1, STEPS.length));
  }
  function goBack() { setStepDir("left"); setStep(p => Math.max(1, p - 1)); }
  function handleStepJump(target: number) { setStepDir(target > step ? "right" : "left"); setStep(target); }

  function setAttr<K extends keyof WAttrs>(k: K, v: WAttrs[K]) {
    setAttrs(prev => ({ ...prev, [k]: v }));
  }

  const payload = { ...buildPayload(s1, attrs), wizard_state: { s1, attrs, eq } };

  async function handleCreate() {
    setSaving(true);
    const { data: inserted, error } = await supabase.from("space_templates")
      .insert({ property_id: propertyId, company_id: companyId, space_type: spaceType, ...payload })
      .select("id").single();
    if (error || !inserted) { toast.error(error?.message ?? "Error creando plantilla"); setSaving(false); return; }
    const assetRows = buildAssets(eq);
    if (assetRows.length > 0) {
      await supabase.from("space_template_assets")
        .insert(assetRows.map(r => ({ ...r, space_template_id: inserted.id })));
    }
    toast.success("Plantilla de bodega creada");
    reset(); onSuccess(); onClose();
  }

  async function handleEdit() {
    if (!editTemplate) return;
    setSaving(true);
    const { error } = await supabase.from("space_templates").update(payload).eq("id", editTemplate.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("space_template_assets").delete().eq("space_template_id", editTemplate.id);
    const assetRows = buildAssets(eq);
    if (assetRows.length > 0) {
      await supabase.from("space_template_assets")
        .insert(assetRows.map(r => ({ ...r, space_template_id: editTemplate.id })));
    }
    toast.success("Plantilla de bodega actualizada");
    reset(); onSuccess(); onClose();
  }

  /* ── Steps ── */

  function renderStep1() {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <AppFormField label="Nombre de la bodega / nave" required>
          <input value={s1.name} onChange={e => { setS1(p => ({ ...p, name: e.target.value })); setS1Error(""); }}
            placeholder="Ej. Bodega Norte B1" style={INPUT} />
          {s1Error && <p style={{ margin: "4px 0 0", color: "var(--metric-value-red)", fontSize: "0.75rem" }}>{s1Error}</p>}
        </AppFormField>
        <AppFormField label="Descripción">
          <textarea value={s1.description} onChange={e => setS1(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripción opcional..." rows={2} style={{ ...INPUT, resize: "vertical" }} />
        </AppFormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <AppFormField label="Superficie mín. (m²)">
            <input type="number" min={0} step={1} value={s1.sqm_min} onChange={e => setS1(p => ({ ...p, sqm_min: e.target.value }))}
              placeholder="Ej. 500" style={INPUT} />
          </AppFormField>
          <AppFormField label="Superficie máx. (m²)">
            <input type="number" min={0} step={1} value={s1.sqm_max} onChange={e => setS1(p => ({ ...p, sqm_max: e.target.value }))}
              placeholder="Ej. 2000" style={INPUT} />
          </AppFormField>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {eqRow("Altura libre (m)", (
            <input type="number" min={0} step={0.1} value={attrs.altura_libre}
              onChange={e => setAttr("altura_libre", e.target.value)}
              placeholder="Ej. 8.5" style={INPUT} />
          ))}
          {eqRow("Tipo de acceso", (
            <select value={attrs.acceso_tipo} onChange={e => setAttr("acceso_tipo", e.target.value)} style={SELECT}>
              {ACCESO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Infraestructura</div>
          <div style={{ display: "grid", gap: 8 }}>
            <CheckToggle checked={attrs.has_electricity_220} onChange={v => setAttr("has_electricity_220", v)} label="Electricidad 220 V" />
            <CheckToggle checked={attrs.has_three_phase} onChange={v => setAttr("has_three_phase", v)} label="Trifásico" />
            <div>
              <CheckToggle checked={!!attrs.capacidad_electrica} onChange={v => { if (!v) setAttr("capacidad_electrica", ""); else setAttr("capacidad_electrica", "63A"); }} label="Capacidad eléctrica especificada" />
              <AnimatePresence initial={false}>
                {attrs.capacidad_electrica !== "" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
                    <select value={attrs.capacidad_electrica} onChange={e => setAttr("capacidad_electrica", e.target.value)} style={{ ...SELECT, marginTop: 6 }}>
                      {CAP_OPTIONS.filter(o => o.value !== "").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <CheckToggle checked={attrs.has_gas_line} onChange={v => setAttr("has_gas_line", v)} label="Línea de gas" />
            <CheckToggle checked={attrs.has_water_meter} onChange={v => setAttr("has_water_meter", v)} label="Medidor de agua propio" />
            <CheckToggle checked={attrs.has_network} onChange={v => setAttr("has_network", v)} label="Infraestructura de red (voz/datos)" />
            <CheckToggle checked={attrs.has_ac} onChange={v => setAttr("has_ac", v)} label="Aire acondicionado" />
          </div>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Instalaciones incluidas</div>
          <div style={{ display: "grid", gap: 6 }}>
            {PRESET_ITEMS.map(item => {
              const on = eq.items.includes(item);
              return (
                <button key={item} type="button" onClick={() => setEq(p => ({ ...p, items: on ? p.items.filter(x => x !== item) : [...p.items, item] }))}
                  style={ps(on)}>
                  {item}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Agregar elemento personalizado</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={customInput} onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const t = customInput.trim(); if (t) { setEq(p => ({ ...p, customItems: [...p.customItems, t] })); setCustomInput(""); } } }}
              placeholder="Ej. Área de andén refrigerado..." style={{ ...INPUT, flex: 1 }} />
            <button type="button" onClick={() => { const t = customInput.trim(); if (t) { setEq(p => ({ ...p, customItems: [...p.customItems, t] })); setCustomInput(""); } }}
              style={{ padding: "0 14px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              <Plus size={14} />
            </button>
          </div>
          {eq.customItems.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {eq.customItems.map((item, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 600, background: "var(--accent-tint-soft)", color: "var(--accent)" }}>
                  {item}
                  <button type="button" onClick={() => setEq(p => ({ ...p, customItems: p.customItems.filter((_, j) => j !== i) }))}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent)", display: "flex" }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderStep4() {
    const allItems = [...eq.items, ...eq.customItems];
    const infra = [
      attrs.has_electricity_220 && "Electricidad 220 V",
      attrs.has_three_phase && "Trifásico",
      attrs.capacidad_electrica && `Capacidad eléctrica: ${attrs.capacidad_electrica}`,
      attrs.has_gas_line && "Línea de gas",
      attrs.has_water_meter && "Medidor de agua propio",
      attrs.has_network && "Infraestructura de red",
      attrs.has_ac && "Aire acondicionado",
    ].filter(Boolean) as string[];

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{s1.name}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 999, background: "var(--bg-input)" }}>Bodega / Nave</span>
            {(s1.sqm_min || s1.sqm_max) && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {s1.sqm_min && s1.sqm_max ? `${s1.sqm_min}–${s1.sqm_max} m²` : `${s1.sqm_min || s1.sqm_max} m²`}
              </span>
            )}
            {attrs.altura_libre && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Altura libre: {attrs.altura_libre} m</span>}
            {attrs.acceso_tipo !== "NONE" && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Acceso: {ACCESO_OPTIONS.find(o => o.value === attrs.acceso_tipo)?.label}</span>}
          </div>
          {s1.description && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s1.description}</p>}
        </div>
        {infra.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>INFRAESTRUCTURA</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {infra.map(label => (
                <span key={label} style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>{label}</span>
              ))}
            </div>
          </div>
        )}
        {allItems.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>INSTALACIONES ({allItems.length})</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allItems.map(item => (
                <span key={item} style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--accent-tint-soft)", color: "var(--accent)", border: "1px solid var(--accent-tint-medium)" }}>{item}</span>
              ))}
            </div>
          </div>
        )}
        {allItems.length === 0 && infra.length === 0 && (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Sin atributos ni instalaciones configuradas.</p>
        )}
      </div>
    );
  }

  function renderStep() {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    if (step === 3) return renderStep3();
    return renderStep4();
  }

  return (
    <WizardShell
      open={open}
      title={isEdit ? "Editar plantilla — Bodega / Nave" : "Nueva plantilla — Bodega / Nave"}
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
