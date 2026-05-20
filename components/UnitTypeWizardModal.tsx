"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import {
  Bath, BedDouble, Box, Car, Check, ChevronDown, ChevronUp,
  Droplets, Flame, Package, Settings2, Shirt, Snowflake,
  Sofa, Sun, TreePine, UtensilsCrossed, Wind, Wrench,
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  buildingId: string;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step1 = { name: string; sqm: string; rent: string; description: string };
type Step2 = {
  hasSala: boolean; hasCocina: boolean; hasComedor: boolean;
  hasPatio: boolean; hasCajon: boolean; hasBodega: boolean;
  hasTerraza: boolean; hasLavanderia: boolean; hasAreaServicio: boolean;
  bedrooms: number; bathroomsComplete: number; bathroomsHalf: number;
};
type BedroomEq  = { ac: string; fan: string; heater: string; furniture: string[] };
type SalaEq     = { ac: string; fan: string; furniture: string };
type CocinaEq   = { stove: string; oven: string; fridge: string; fridgeModel: string; others: string[] };
type AreaEq     = { boiler: string; boilerCapacity: string; washer: string; dryer: string; others: string[] };
type ComadorEq  = { furniture: string };
type Equipment  = { bedrooms: BedroomEq[]; sala: SalaEq; cocina: CocinaEq; area: AreaEq; comedor: ComadorEq };

/* ─── Defaults ───────────────────────────────────────────────────────── */

const S1: Step1 = { name: "", sqm: "", rent: "", description: "" };
const S2: Step2 = {
  hasSala: false, hasCocina: false, hasComedor: false, hasPatio: false,
  hasCajon: false, hasBodega: false, hasTerraza: false, hasLavanderia: false,
  hasAreaServicio: false, bedrooms: 1, bathroomsComplete: 1, bathroomsHalf: 0,
};
const DEFAULT_BEDROOM_EQ: BedroomEq = { ac: "NONE", fan: "NO", heater: "NONE", furniture: [] };
const DEFAULT_EQ: Equipment = {
  bedrooms: [{ ...DEFAULT_BEDROOM_EQ }],
  sala:    { ac: "NONE", fan: "NO", furniture: "NONE" },
  cocina:  { stove: "NONE", oven: "NONE", fridge: "NONE", fridgeModel: "", others: [] },
  area:    { boiler: "NONE", boilerCapacity: "60L", washer: "NONE", dryer: "NONE", others: [] },
  comedor: { furniture: "NONE" },
};

/* ─── Space definitions ──────────────────────────────────────────────── */

const SPACES = [
  { key: "hasSala",       label: "Sala",            Icon: Sofa          },
  { key: "hasCocina",     label: "Cocina",           Icon: UtensilsCrossed },
  { key: "hasComedor",    label: "Comedor",          Icon: UtensilsCrossed },
  { key: "hasPatio",      label: "Patio",            Icon: TreePine      },
  { key: "hasCajon",      label: "Cajón",            Icon: Car           },
  { key: "hasBodega",     label: "Bodega",           Icon: Box           },
  { key: "hasTerraza",    label: "Terraza",          Icon: Sun           },
  { key: "hasLavanderia", label: "Lavandería",       Icon: Shirt         },
  { key: "hasAreaServicio", label: "Área de servicio", Icon: Wrench      },
] as const;

/* ─── Sub-components ─────────────────────────────────────────────────── */

const ACCENT = "#8B2252";

function Radio({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          style={{
            padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: value === o.value ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)",
            background: value === o.value ? "#f9eaf3" : "var(--bg-card)",
            color: value === o.value ? ACCENT : "var(--text-secondary)",
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Pills({
  value, onChange, options,
}: { value: string[]; onChange: (v: string[]) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            style={{
              padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: on ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)",
              background: on ? "#f9eaf3" : "var(--bg-card)",
              color: on ? ACCENT : "var(--text-secondary)",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Counter({ value, onChange, min = 0, max = 10, label }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid var(--border-default)", borderRadius: 12, background: "var(--bg-card)" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>−</button>
        <span style={{ fontSize: 18, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>+</button>
      </div>
    </div>
  );
}

/* ─── Asset-row generator ────────────────────────────────────────────── */

type AssetRow = { asset_type: string; name: string; status: string; notes: string | null; sort_order: number };

function buildAssetRows(s2: Step2, eq: Equipment): AssetRow[] {
  const rows: AssetRow[] = [];
  let idx = 0;

  /* Recámaras */
  for (let i = 0; i < s2.bedrooms; i++) {
    const b = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
    const sfx = s2.bedrooms > 1 ? ` - Recámara ${i + 1}` : " - Recámara";
    const acMap: Record<string, string> = { MINI_1T: "1 Ton", MINI_1_5T: "1.5 Ton", MINI_2T: "2 Ton", MINI_3T: "3 Ton" };
    if (b.ac !== "NONE" && acMap[b.ac]) rows.push({ asset_type: "MINISPLIT", name: `Minisplit ${acMap[b.ac]}${sfx}`, status: "ACTIVE", notes: null, sort_order: idx++ });
    if (b.fan === "YES") rows.push({ asset_type: "FAN", name: `Ventilador de techo${sfx}`, status: "ACTIVE", notes: null, sort_order: idx++ });
    if (b.heater !== "NONE") rows.push({ asset_type: "OTHER", name: `Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}${sfx}`, status: "ACTIVE", notes: null, sort_order: idx++ });
    const furMap: Record<string, string> = { SINGLE_BED: "Cama individual", QUEEN_BED: "Cama matrimonial", CLOSET: "Closet", NIGHTSTAND: "Buró", DESK: "Escritorio" };
    for (const f of b.furniture) if (furMap[f]) rows.push({ asset_type: "OTHER", name: `${furMap[f]}${sfx}`, status: "ACTIVE", notes: null, sort_order: idx++ });
  }

  /* Sala */
  if (s2.hasSala) {
    const { ac, fan, furniture } = eq.sala;
    const acMap: Record<string, string> = { MINI_1T: "1 Ton", MINI_1_5T: "1.5 Ton", MINI_2T: "2 Ton" };
    if (ac !== "NONE" && acMap[ac]) rows.push({ asset_type: "MINISPLIT", name: `Minisplit ${acMap[ac]} - Sala`, status: "ACTIVE", notes: null, sort_order: idx++ });
    if (fan === "YES") rows.push({ asset_type: "FAN", name: "Ventilador de techo - Sala", status: "ACTIVE", notes: null, sort_order: idx++ });
    if (furniture === "SALA_COMPLETA") rows.push({ asset_type: "OTHER", name: "Sala completa", status: "ACTIVE", notes: null, sort_order: idx++ });
    if (furniture === "TV") rows.push({ asset_type: "OTHER", name: "Televisión - Sala", status: "ACTIVE", notes: null, sort_order: idx++ });
  }

  /* Cocina */
  if (s2.hasCocina) {
    const { stove, oven, fridge, fridgeModel, others } = eq.cocina;
    const stoveMap: Record<string, string> = {
      GAS_2Q: "Estufa gas 2 quemadores", GAS_4Q: "Estufa gas 4 quemadores", GAS_6Q: "Estufa gas 6 quemadores",
      ELECTRIC: "Estufa eléctrica", VITRO: "Vitrocerámica",
    };
    if (stove !== "NONE" && stoveMap[stove]) rows.push({ asset_type: "STOVE", name: stoveMap[stove], status: "ACTIVE", notes: null, sort_order: idx++ });
    if (oven !== "NONE") rows.push({ asset_type: "OTHER", name: oven === "GAS" ? "Horno de gas" : "Horno eléctrico", status: "ACTIVE", notes: null, sort_order: idx++ });
    if (fridge !== "NONE") {
      const base = fridge === "FRIDGE" ? "Refrigerador" : "Frigobar";
      rows.push({ asset_type: "FRIDGE", name: fridgeModel ? `${base} - ${fridgeModel}` : base, status: "ACTIVE", notes: null, sort_order: idx++ });
    }
    const othMap: Record<string, string> = { MICROWAVE: "Microondas", DISHWASHER: "Lavavajillas", EXTRACTOR: "Campana extractora" };
    for (const o of others) if (othMap[o]) rows.push({ asset_type: "OTHER", name: othMap[o], status: "ACTIVE", notes: null, sort_order: idx++ });
  }

  /* Área de servicio / Lavandería */
  if (s2.hasAreaServicio || s2.hasLavanderia) {
    const { boiler, boilerCapacity, washer, dryer, others } = eq.area;
    if (s2.hasAreaServicio && boiler !== "NONE") {
      const bMap: Record<string, string> = {
        DEP_GAS: "Boiler depósito gas", DEP_ELEC: "Boiler depósito eléctrico", DEP_SOLAR: "Boiler depósito solar",
        PASO_GAS: "Boiler de paso gas", PASO_ELEC: "Boiler de paso eléctrico",
      };
      const cap = ["DEP_GAS", "DEP_ELEC", "DEP_SOLAR"].includes(boiler) ? ` ${boilerCapacity}` : "";
      if (bMap[boiler]) rows.push({ asset_type: "BOILER", name: `${bMap[boiler]}${cap}`, status: "ACTIVE", notes: null, sort_order: idx++ });
    }
    if (washer !== "NONE") rows.push({ asset_type: "WASHER", name: washer === "FRONT" ? "Lavadora carga frontal" : "Lavadora carga superior", status: "ACTIVE", notes: null, sort_order: idx++ });
    if (dryer !== "NONE") rows.push({ asset_type: "DRYER", name: dryer === "GAS" ? "Secadora gas" : "Secadora eléctrica", status: "ACTIVE", notes: null, sort_order: idx++ });
    const othMap: Record<string, string> = { CENTRO_LAVADO: "Centro de lavado vertical", SOLO_CONEXIONES: "Solo conexiones de lavandería" };
    for (const o of others) if (othMap[o]) rows.push({ asset_type: "OTHER", name: othMap[o], status: "ACTIVE", notes: null, sort_order: idx++ });
  }

  /* Comedor */
  if (s2.hasComedor && eq.comedor.furniture !== "NONE") {
    rows.push({ asset_type: "OTHER", name: eq.comedor.furniture === "COMEDOR_COMPLETO" ? "Comedor completo" : "Mesa de comedor", status: "ACTIVE", notes: null, sort_order: idx++ });
  }

  return rows;
}

/* ─── Step indicator ─────────────────────────────────────────────────── */

function StepIndicator({ step }: { step: number }) {
  const labels = ["Información", "Espacios", "Equipamiento", "Resumen"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", flex: i < labels.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: done ? ACCENT : active ? ACCENT : "var(--bg-input)",
                color: done || active ? "#fff" : "var(--text-muted)",
                border: active && !done ? `2px solid ${ACCENT}` : "none",
                flexShrink: 0,
              }}>
                {done ? <Check size={14} /> : n}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? ACCENT : "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? ACCENT : "var(--border-default)", margin: "0 6px", marginBottom: 16 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export default function UnitTypeWizardModal({ open, buildingId, companyId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [s1, setS1] = useState<Step1>({ ...S1 });
  const [s2, setS2] = useState<Step2>({ ...S2 });
  const [eq, setEq] = useState<Equipment>(JSON.parse(JSON.stringify(DEFAULT_EQ)) as Equipment);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [s1Error, setS1Error] = useState("");

  const STEP_TITLES = ["Nueva tipología — Información", "Nueva tipología — Espacios", "Nueva tipología — Equipamiento", "Nueva tipología — Resumen"];

  function reset() {
    setStep(1); setS1({ ...S1 }); setS2({ ...S2 });
    setEq(JSON.parse(JSON.stringify(DEFAULT_EQ)) as Equipment);
    setExpandedBlocks(new Set()); setSaving(false); setS1Error("");
  }

  function handleClose() { reset(); onClose(); }

  /* Sync bedroom array length when going from step 2 → 3 */
  function syncBedroomArray(newS2: Step2): Equipment {
    const prev = eq.bedrooms;
    const arr: BedroomEq[] = Array.from({ length: newS2.bedrooms }, (_, i) => prev[i] ?? { ...DEFAULT_BEDROOM_EQ });
    return { ...eq, bedrooms: arr };
  }

  function goNext() {
    if (step === 1) {
      if (!s1.name.trim()) { setS1Error("El nombre de la tipología es obligatorio."); return; }
      setS1Error("");
      setStep(2);
    } else if (step === 2) {
      const synced = syncBedroomArray(s2);
      setEq(synced);
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  }
  function goBack() { setStep((p) => Math.max(1, p - 1)); }

  function toggleBlock(key: string) {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  /* ── Step 2 helpers ── */
  function toggleSpace(key: keyof Step2 & string) {
    setS2((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function setCount(key: keyof Step2, val: number) {
    setS2((prev) => ({ ...prev, [key]: val }));
  }

  /* ── Step 3 equipment helpers ── */
  function setBedEq<K extends keyof BedroomEq>(i: number, key: K, val: BedroomEq[K]) {
    setEq((prev) => {
      const arr = [...prev.bedrooms];
      arr[i] = { ...arr[i]!, [key]: val };
      return { ...prev, bedrooms: arr };
    });
  }
  function setSala<K extends keyof SalaEq>(key: K, val: SalaEq[K]) {
    setEq((prev) => ({ ...prev, sala: { ...prev.sala, [key]: val } }));
  }
  function setCocina<K extends keyof CocinaEq>(key: K, val: CocinaEq[K]) {
    setEq((prev) => ({ ...prev, cocina: { ...prev.cocina, [key]: val } }));
  }
  function setArea<K extends keyof AreaEq>(key: K, val: AreaEq[K]) {
    setEq((prev) => ({ ...prev, area: { ...prev.area, [key]: val } }));
  }
  function setComedor<K extends keyof ComadorEq>(key: K, val: ComadorEq[K]) {
    setEq((prev) => ({ ...prev, comedor: { ...prev.comedor, [key]: val } }));
  }

  /* ── Create ── */
  async function handleCreate() {
    if (!buildingId) return;
    setSaving(true);
    const stoveMap: Record<string, string> = { GAS_2Q: "GAS", GAS_4Q: "GAS", GAS_6Q: "GAS", ELECTRIC: "ELECTRIC", VITRO: "ELECTRIC", NONE: "NONE" };
    const payload = {
      building_id:     buildingId,
      company_id:      companyId,
      name:            s1.name.trim(),
      bedrooms:        s2.bedrooms,
      bathrooms:       s2.bathroomsComplete,
      has_living_room: s2.hasSala,
      has_dining_room: s2.hasComedor,
      has_patio:       s2.hasPatio,
      has_fridge:      eq.cocina.fridge !== "NONE",
      has_washer:      eq.area.washer !== "NONE",
      has_dryer:       eq.area.dryer !== "NONE",
      stove_type:      stoveMap[eq.cocina.stove] ?? "NONE",
    };
    const { data: inserted, error } = await supabase.from("unit_types").insert(payload).select("id").single();
    if (error || !inserted) {
      toast.error(error?.message ?? "Error creando tipología");
      setSaving(false);
      return;
    }
    const assetRows = buildAssetRows(s2, eq);
    if (assetRows.length > 0) {
      await supabase.from("unit_type_assets").insert(
        assetRows.map((r) => ({ ...r, unit_type_id: inserted.id }))
      );
    }
    toast.success("Tipología creada con equipamiento");
    reset();
    onSuccess();
    onClose();
  }

  /* ── Helpers for step 3 blocks ── */
  function blockHeader(key: string, label: string, Icon: React.ElementType, count: number) {
    const open = expandedBlocks.has(key);
    return (
      <button type="button" onClick={() => toggleBlock(key)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", border: "none", background: "var(--bg-input)", borderRadius: open ? "10px 10px 0 0" : 10, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon size={16} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
          {count > 0 && (
            <span style={{ padding: "1px 8px", borderRadius: 999, background: "#f9eaf3", color: ACCENT, fontSize: 11, fontWeight: 700 }}>
              {count} equipo{count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    );
  }

  function blockBody(children: React.ReactNode, key: string) {
    if (!expandedBlocks.has(key)) return null;
    return (
      <div style={{ padding: "14px", border: "1px solid var(--border-default)", borderTop: "none", borderRadius: "0 0 10px 10px" }}>
        {children}
      </div>
    );
  }

  function eqRow(label: string, children: React.ReactNode) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
        {children}
      </div>
    );
  }

  /* ── Equipment count per block ── */
  function bedroomCount(b: BedroomEq) {
    return (b.ac !== "NONE" ? 1 : 0) + (b.fan === "YES" ? 1 : 0) + (b.heater !== "NONE" ? 1 : 0) + b.furniture.length;
  }
  function salaCount(s: SalaEq) {
    return (s.ac !== "NONE" ? 1 : 0) + (s.fan === "YES" ? 1 : 0) + (s.furniture !== "NONE" ? 1 : 0);
  }
  function cocinaCount(c: CocinaEq) {
    return (c.stove !== "NONE" ? 1 : 0) + (c.oven !== "NONE" ? 1 : 0) + (c.fridge !== "NONE" ? 1 : 0) + c.others.length;
  }
  function areaCount(a: AreaEq) {
    return (a.boiler !== "NONE" ? 1 : 0) + (a.washer !== "NONE" ? 1 : 0) + (a.dryer !== "NONE" ? 1 : 0) + a.others.length;
  }

  /* ─── Render ──────────────────────────────────────────────────────── */
  const STEP_INPUT: React.CSSProperties = {
    width: "100%", padding: 10, border: "1px solid var(--border-default)",
    borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <Modal open={open} title={STEP_TITLES[step - 1] ?? ""} onClose={handleClose} maxWidth={560}>
      <StepIndicator step={step} />

      {/* ── PASO 1: Información ── */}
      {step === 1 && (
        <div style={{ display: "grid", gap: 14 }}>
          <AppFormField label="Nombre de la tipología" required>
            <input
              value={s1.name}
              onChange={(e) => { setS1((p) => ({ ...p, name: e.target.value })); setS1Error(""); }}
              placeholder="Ej. Tipo A — 2 recámaras"
              style={STEP_INPUT}
            />
            {s1Error && <p style={{ margin: "4px 0 0", color: "#ef4444", fontSize: 12 }}>{s1Error}</p>}
          </AppFormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <AppFormField label="Superficie m²">
              <input value={s1.sqm} onChange={(e) => setS1((p) => ({ ...p, sqm: e.target.value }))} type="number" min={0} placeholder="Ej. 60" style={STEP_INPUT} />
            </AppFormField>
            <AppFormField label="Renta sugerida">
              <input value={s1.rent} onChange={(e) => setS1((p) => ({ ...p, rent: e.target.value }))} type="number" min={0} placeholder="Ej. 8500" style={STEP_INPUT} />
            </AppFormField>
          </div>
          <AppFormField label="Descripción">
            <textarea
              value={s1.description}
              onChange={(e) => setS1((p) => ({ ...p, description: e.target.value }))}
              placeholder="Descripción opcional de la tipología..."
              rows={3}
              style={{ ...STEP_INPUT, resize: "vertical" }}
            />
          </AppFormField>
        </div>
      )}

      {/* ── PASO 2: Espacios físicos ── */}
      {step === 2 && (
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Espacios incluidos</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {SPACES.map(({ key, label, Icon }) => {
                const on = s2[key as keyof Step2] as boolean;
                return (
                  <button key={key} type="button"
                    onClick={() => toggleSpace(key as keyof Step2 & string)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                      border: on ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)",
                      background: on ? "#f9eaf3" : "var(--bg-card)",
                      color: on ? ACCENT : "var(--text-secondary)",
                    }}>
                    <Icon size={18} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Contadores</p>
            <Counter label="Recámaras" value={s2.bedrooms} onChange={(v) => setCount("bedrooms", v)} min={0} max={10} />
            <Counter label="Baños completos" value={s2.bathroomsComplete} onChange={(v) => setCount("bathroomsComplete", v)} min={0} max={10} />
            <Counter label="Medios baños" value={s2.bathroomsHalf} onChange={(v) => setCount("bathroomsHalf", v)} min={0} max={5} />
          </div>
        </div>
      )}

      {/* ── PASO 3: Equipamiento ── */}
      {step === 3 && (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)" }}>
            Haz clic en cada espacio para configurar su equipamiento.
          </p>

          {/* Recámaras */}
          {Array.from({ length: s2.bedrooms }, (_, i) => {
            const bKey = `bed-${i}`;
            const bEq = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
            const label = s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara";
            return (
              <div key={bKey}>
                {blockHeader(bKey, label, BedDouble, bedroomCount(bEq))}
                {blockBody(
                  <div>
                    {eqRow("Aire acondicionado", <Radio value={bEq.ac} onChange={(v) => setBedEq(i, "ac", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "MINI_1T", label: "1 ton" }, { value: "MINI_1_5T", label: "1.5 ton" }, { value: "MINI_2T", label: "2 ton" }, { value: "MINI_3T", label: "3 ton" }]} />)}
                    {eqRow("Ventilador de techo", <Radio value={bEq.fan} onChange={(v) => setBedEq(i, "fan", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                    {eqRow("Calefactor", <Radio value={bEq.heater} onChange={(v) => setBedEq(i, "heater", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrico" }]} />)}
                    {eqRow("Mobiliario", <Pills value={bEq.furniture} onChange={(v) => setBedEq(i, "furniture", v)} options={[{ value: "SINGLE_BED", label: "Cama individual" }, { value: "QUEEN_BED", label: "Cama matrimonial" }, { value: "CLOSET", label: "Closet" }, { value: "NIGHTSTAND", label: "Buró" }, { value: "DESK", label: "Escritorio" }]} />)}
                  </div>,
                  bKey
                )}
              </div>
            );
          })}

          {/* Sala */}
          {s2.hasSala && (
            <div>
              {blockHeader("sala", "Sala", Sofa, salaCount(eq.sala))}
              {blockBody(
                <div>
                  {eqRow("Aire acondicionado", <Radio value={eq.sala.ac} onChange={(v) => setSala("ac", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "MINI_1T", label: "1 ton" }, { value: "MINI_1_5T", label: "1.5 ton" }, { value: "MINI_2T", label: "2 ton" }]} />)}
                  {eqRow("Ventilador de techo", <Radio value={eq.sala.fan} onChange={(v) => setSala("fan", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                  {eqRow("Mobiliario", <Radio value={eq.sala.furniture} onChange={(v) => setSala("furniture", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "SALA_COMPLETA", label: "Sala completa" }, { value: "TV", label: "TV" }]} />)}
                </div>,
                "sala"
              )}
            </div>
          )}

          {/* Cocina */}
          {s2.hasCocina && (
            <div>
              {blockHeader("cocina", "Cocina", UtensilsCrossed, cocinaCount(eq.cocina))}
              {blockBody(
                <div>
                  {eqRow("Estufa / parrilla", <Radio value={eq.cocina.stove} onChange={(v) => setCocina("stove", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS_2Q", label: "Gas 2Q" }, { value: "GAS_4Q", label: "Gas 4Q" }, { value: "GAS_6Q", label: "Gas 6Q" }, { value: "ELECTRIC", label: "Eléctrica" }, { value: "VITRO", label: "Vitrocerámica" }]} />)}
                  {eqRow("Horno", <Radio value={eq.cocina.oven} onChange={(v) => setCocina("oven", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrico" }]} />)}
                  {eqRow("Refrigeración", <Radio value={eq.cocina.fridge} onChange={(v) => setCocina("fridge", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "FRIDGE", label: "Refrigerador" }, { value: "MINIBAR", label: "Frigobar" }]} />)}
                  {eq.cocina.fridge !== "NONE" && (
                    <div style={{ marginBottom: 14, paddingLeft: 8 }}>
                      <input value={eq.cocina.fridgeModel} onChange={(e) => setCocina("fridgeModel", e.target.value)} placeholder="Modelo (opcional)" style={{ ...STEP_INPUT, fontSize: 12 }} />
                    </div>
                  )}
                  {eqRow("Otros", <Pills value={eq.cocina.others} onChange={(v) => setCocina("others", v)} options={[{ value: "MICROWAVE", label: "Microondas" }, { value: "DISHWASHER", label: "Lavavajillas" }, { value: "EXTRACTOR", label: "Campana extractora" }]} />)}
                </div>,
                "cocina"
              )}
            </div>
          )}

          {/* Área de servicio / Lavandería */}
          {(s2.hasAreaServicio || s2.hasLavanderia) && (
            <div>
              {blockHeader("area", s2.hasAreaServicio ? "Área de servicio" : "Lavandería", Wrench, areaCount(eq.area))}
              {blockBody(
                <div>
                  {s2.hasAreaServicio && eqRow("Boiler", (
                    <div style={{ display: "grid", gap: 8 }}>
                      <Radio value={eq.area.boiler} onChange={(v) => setArea("boiler", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "DEP_GAS", label: "Depósito gas" }, { value: "DEP_ELEC", label: "Depósito eléctrico" }, { value: "DEP_SOLAR", label: "Depósito solar" }, { value: "PASO_GAS", label: "Paso gas" }, { value: "PASO_ELEC", label: "Paso eléctrico" }]} />
                      {["DEP_GAS", "DEP_ELEC", "DEP_SOLAR"].includes(eq.area.boiler) && (
                        <Pills value={[eq.area.boilerCapacity]} onChange={(v) => setArea("boilerCapacity", v[v.length - 1] ?? "60L")} options={[{ value: "40L", label: "40L" }, { value: "60L", label: "60L" }, { value: "80L", label: "80L" }, { value: "100L+", label: "100L+" }]} />
                      )}
                    </div>
                  ))}
                  {eqRow("Lavadora", <Radio value={eq.area.washer} onChange={(v) => setArea("washer", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "FRONT", label: "Carga frontal" }, { value: "TOP", label: "Carga superior" }]} />)}
                  {eqRow("Secadora", <Radio value={eq.area.dryer} onChange={(v) => setArea("dryer", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }]} />)}
                  {eqRow("Otros", <Pills value={eq.area.others} onChange={(v) => setArea("others", v)} options={[{ value: "CENTRO_LAVADO", label: "Centro de lavado vertical" }, { value: "SOLO_CONEXIONES", label: "Solo conexiones" }]} />)}
                </div>,
                "area"
              )}
            </div>
          )}

          {/* Comedor */}
          {s2.hasComedor && (
            <div>
              {blockHeader("comedor", "Comedor", UtensilsCrossed, eq.comedor.furniture !== "NONE" ? 1 : 0)}
              {blockBody(
                <div>
                  {eqRow("Mobiliario", <Radio value={eq.comedor.furniture} onChange={(v) => setComedor("furniture", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "COMEDOR_COMPLETO", label: "Comedor completo" }, { value: "SOLO_MESA", label: "Solo mesa" }]} />)}
                </div>,
                "comedor"
              )}
            </div>
          )}

          {/* Spaces with no equipment */}
          {[s2.hasPatio && "Patio", s2.hasCajon && "Cajón", s2.hasBodega && "Bodega", s2.hasTerraza && "Terraza"].filter(Boolean).map((lbl) => (
            <div key={lbl as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--border-default)", borderRadius: 10, background: "var(--bg-card)" }}>
              <Settings2 size={15} color="var(--text-muted)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{lbl as string}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>Solo se documenta su existencia</span>
            </div>
          ))}

          {s2.bathroomsComplete > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--border-default)", borderRadius: 10, background: "var(--bg-card)" }}>
              <Bath size={15} color="var(--text-muted)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {s2.bathroomsComplete} baño{s2.bathroomsComplete !== 1 ? "s" : ""} completo{s2.bathroomsComplete !== 1 ? "s" : ""}
                {s2.bathroomsHalf > 0 ? ` · ${s2.bathroomsHalf} medio${s2.bathroomsHalf !== 1 ? "s" : ""} baño${s2.bathroomsHalf !== 1 ? "s" : ""}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 4: Resumen ── */}
      {step === 4 && (() => {
        const assetRows = buildAssetRows(s2, eq);
        const bySpace: Record<string, string[]> = {};
        for (const r of assetRows) {
          const space = r.name.includes(" - ") ? r.name.split(" - ").pop()! : "General";
          (bySpace[space] = bySpace[space] ?? []).push(r.name.split(" - ")[0]!);
        }
        return (
          <div style={{ display: "grid", gap: 16 }}>
            {/* General info card */}
            <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: 12, background: "var(--bg-card)", display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{s1.name}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s2.bedrooms} rec. · {s2.bathroomsComplete} baño{s2.bathroomsComplete !== 1 ? "s" : ""}</span>
                {s1.sqm && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {s1.sqm} m²</span>}
                {s1.rent && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· ${Number(s1.rent).toLocaleString("es-MX")} renta</span>}
              </div>
              {s1.description && <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{s1.description}</p>}
            </div>

            {/* Active spaces */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ESPACIOS</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SPACES.filter(({ key }) => s2[key as keyof Step2]).map(({ label }) => (
                  <span key={label} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#f9eaf3", color: ACCENT }}>{label}</span>
                ))}
                {s2.bedrooms > 0 && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#f9eaf3", color: ACCENT }}>{s2.bedrooms} Recámara{s2.bedrooms !== 1 ? "s" : ""}</span>}
                {s2.bathroomsComplete > 0 && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#eff6ff", color: "#2563eb" }}>{s2.bathroomsComplete} Baño{s2.bathroomsComplete !== 1 ? "s" : ""}</span>}
                {s2.bathroomsHalf > 0 && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#eff6ff", color: "#2563eb" }}>{s2.bathroomsHalf} Medio{s2.bathroomsHalf !== 1 ? "s" : ""} baño{s2.bathroomsHalf !== 1 ? "s" : ""}</span>}
              </div>
            </div>

            {/* Equipment */}
            {assetRows.length > 0 && (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>EQUIPAMIENTO ({assetRows.length} elemento{assetRows.length !== 1 ? "s" : ""})</p>
                <div style={{ display: "grid", gap: 4 }}>
                  {assetRows.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-primary)" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                      {r.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {assetRows.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Sin equipamiento configurado. La tipología se creará sin equipos plantilla.</p>
            )}
          </div>
        );
      })()}

      {/* ── Nav buttons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 10 }}>
        <div>
          {step > 1 && (
            <UiButton type="button" variant="secondary" onClick={goBack} disabled={saving}>
              Atrás
            </UiButton>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <UiButton type="button" variant="secondary" onClick={handleClose} disabled={saving}>Cancelar</UiButton>
          {step < 4 ? (
            <UiButton type="button" variant="primary" onClick={goNext}>Siguiente</UiButton>
          ) : (
            <UiButton type="button" variant="primary" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Creando..." : "Crear tipología"}
            </UiButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
