"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2, Home, Store, Briefcase, Factory, Package,
  MapPin, Car, Plus, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import WizardShell from "@/components/WizardShell";
import AppFormField from "@/components/AppFormField";
import UiButton from "@/components/UiButton";
import { supabase } from "@/lib/supabaseClient";
import { INPUT_STYLE } from "@/lib/pageStyles";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 100, display: "flex", alignItems: "center",
      justifyContent: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
      Cargando mapa…
    </div>
  ),
});

// ─── Types ───────────────────────────────────────────────────────────────────

type PropTypeValue =
  | "residencial_multi" | "residencial_uni" | "comercial"
  | "oficinas" | "industrial_parque" | "industrial_bodega"
  | "terreno" | "estacionamiento";

interface PropTypeOption {
  value: PropTypeValue;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  spaceType: string;
}

const PROP_TYPES: PropTypeOption[] = [
  { value: "residencial_multi",  label: "Residencial multifamiliar", shortLabel: "Residencial",    icon: Building2, color: "#4f46e5", spaceType: "apartment" },
  { value: "residencial_uni",    label: "Casa unifamiliar",          shortLabel: "Casa",            icon: Home,      color: "#059669", spaceType: "house" },
  { value: "comercial",          label: "Comercial / Plaza",         shortLabel: "Comercial",       icon: Store,     color: "#d97706", spaceType: "commercial_local" },
  { value: "oficinas",           label: "Comercial · Oficinas",      shortLabel: "Oficinas",        icon: Briefcase, color: "#0ea5e9", spaceType: "office" },
  { value: "industrial_parque",  label: "Industrial · Parque",       shortLabel: "Parque",          icon: Factory,   color: "#6b7280", spaceType: "warehouse" },
  { value: "industrial_bodega",  label: "Bodega",                    shortLabel: "Bodega",          icon: Package,   color: "#78716c", spaceType: "warehouse" },
  { value: "terreno",            label: "Terreno",                   shortLabel: "Terreno",         icon: MapPin,    color: "#16a34a", spaceType: "land_lot" },
  { value: "estacionamiento",    label: "Estacionamiento",           shortLabel: "Estac.",          icon: Car,       color: "#7c3aed", spaceType: "parking" },
];

const MULTI_FLOOR_TYPES: PropTypeValue[] = ["residencial_multi", "comercial"];
const SINGLE_SPACE_TYPES: PropTypeValue[] = [
  "residencial_uni", "industrial_bodega", "terreno", "estacionamiento",
];

interface FloorConfig   { floor: number; count: number; }
interface AssetDraft    { tipo: string; nombre: string; }

// Caso A — naves del parque
interface NaveConfig {
  mode: "whole" | "subdividida";
  numBodegas: number;
  totalSqm: string;
}

// Caso B — pisos divisibles por metraje
interface PisoConfig {
  totalSqm: string;
  minDivisionSqm: string;
  strategy: "free_metraje" | "fixed_units";
}

// Caso C — zona de una propiedad mixta
interface ZonaConfig {
  tipo: PropTypeValue;
  nombre: string;
  pisoInicio: number;
  pisoFin: number;
  // Para multi-piso (residencial_multi, comercial): conteo por piso
  floors: FloorConfig[];
  // Para oficinas: config de metraje por piso
  pisos: PisoConfig[];
  // Para bodega/parque
  parqueMode: "single" | "parque";
  naves: NaveConfig[];
  // Para espacio único
  rentalMode: "whole" | "by_subdivision" | "both";
  numSubdivisions: number;
}

interface WizardState {
  // Paso 1
  selectedTypes: PropTypeValue[];
  // Paso 2
  name: string; code: string; address: string;
  latitude: number | null; longitude: number | null;
  landSqm: string;
  // Paso 3 — casos simples
  floors: FloorConfig[];
  rentalMode: "whole" | "by_subdivision" | "both";
  numSubdivisions: number;
  // Paso 3 — Caso A: parque/naves
  parqueMode: "single" | "parque";
  naves: NaveConfig[];
  // Paso 3 — Caso B: oficinas divisibles
  pisos: PisoConfig[];
  // lateral panel state (shared)
  activeLateralKey: string;
  // Paso 3 — Caso C: mixto por zonas
  zonas: ZonaConfig[];
  activeZonaKey: string;
  // Paso 4
  assets: AssetDraft[];
}

function initState(): WizardState {
  return {
    selectedTypes: [],
    name: "", code: "", address: "", latitude: null, longitude: null, landSqm: "",
    floors: [{ floor: 1, count: 3 }],
    rentalMode: "whole", numSubdivisions: 2,
    parqueMode: "single",
    naves: [{ mode: "whole", numBodegas: 2, totalSqm: "" }],
    pisos: [
      { totalSqm: "600", minDivisionSqm: "100", strategy: "free_metraje" },
      { totalSqm: "600", minDivisionSqm: "100", strategy: "free_metraje" },
    ],
    activeLateralKey: "0",
    zonas: [],
    activeZonaKey: "0",
    assets: [],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcPropertyLabel(types: PropTypeValue[]): string {
  if (types.length === 0) return "";
  if (types.length === 1) return PROP_TYPES.find((t) => t.value === types[0])?.label ?? "";
  return `Mixto · ${types.map((v) => PROP_TYPES.find((t) => t.value === v)?.shortLabel ?? v).join(" + ")}`;
}

function calcLabelFromZonas(zonas: ZonaConfig[]): string {
  const uniqueTypes = [...new Set(zonas.map((z) => z.tipo))];
  if (uniqueTypes.length === 0) return "Mixto";
  if (uniqueTypes.length === 1) return PROP_TYPES.find((t) => t.value === uniqueTypes[0])?.label ?? uniqueTypes[0];
  return `Mixto · ${uniqueTypes.map((v) => PROP_TYPES.find((t) => t.value === v)?.shortLabel ?? v).join(" + ")}`;
}

function genFloorSpaceCodes(floors: FloorConfig[]) {
  const result: { code: string; floor: string }[] = [];
  for (const f of floors)
    for (let i = 1; i <= f.count; i++)
      result.push({ code: `${f.floor}${String(i).padStart(2, "0")}`, floor: String(f.floor) });
  return result;
}

function initZona(tipo: PropTypeValue, idx: number, pisoStart: number): ZonaConfig {
  return {
    tipo,
    nombre: `Zona ${idx + 1}`,
    pisoInicio: pisoStart,
    pisoFin: pisoStart,
    floors: [{ floor: pisoStart, count: 3 }],
    pisos: [{ totalSqm: "600", minDivisionSqm: "100", strategy: "free_metraje" }],
    parqueMode: "single",
    naves: [{ mode: "whole", numBodegas: 2, totalSqm: "" }],
    rentalMode: "whole",
    numSubdivisions: 2,
  };
}

function syncZonaFloors(zona: ZonaConfig): ZonaConfig {
  const ini = Math.max(1, zona.pisoInicio);
  const fin = Math.max(ini, zona.pisoFin);
  const n = fin - ini + 1;
  const floors = Array.from({ length: n }, (_, i) => {
    const f = ini + i;
    return zona.floors.find((x) => x.floor === f) ?? { floor: f, count: 3 };
  });
  const pisos = Array.from({ length: n }, (_, i) =>
    zona.pisos[i] ?? { totalSqm: "600", minDivisionSqm: "100", strategy: "free_metraje" as const }
  );
  return { ...zona, pisoInicio: ini, pisoFin: fin, floors, pisos };
}

function detectOverlaps(zonas: ZonaConfig[]): boolean {
  for (let i = 0; i < zonas.length; i++)
    for (let j = i + 1; j < zonas.length; j++)
      if (zonas[i].pisoInicio <= zonas[j].pisoFin && zonas[j].pisoInicio <= zonas[i].pisoFin)
        return true;
  return false;
}

function calcZonaSpaces(zona: ZonaConfig): number {
  const isMulti = MULTI_FLOOR_TYPES.includes(zona.tipo);
  const isOfc = zona.tipo === "oficinas";
  const isPrq = zona.tipo === "industrial_parque" ||
                (zona.tipo === "industrial_bodega" && zona.parqueMode === "parque");
  if (isMulti) return zona.floors.reduce((s, f) => s + f.count, 0);
  if (isOfc) return zona.pisos.length;
  if (isPrq) return zona.naves.reduce((s, n) => s + (n.mode === "whole" ? 1 : n.numBodegas), 0);
  return 1;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function Counter({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: "1px solid var(--border-default)" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 30, height: 30, borderRadius: "var(--border-radius-sm)",
            border: "1px solid var(--border-default)", background: "var(--bg-card)",
            color: "var(--text-primary)", cursor: "pointer", fontSize: "1.125rem",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          −
        </button>
        <span style={{ fontWeight: 700, fontSize: "1rem", minWidth: 24, textAlign: "center" }}>{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width: 30, height: 30, borderRadius: "var(--border-radius-sm)",
            border: "1px solid var(--border-default)", background: "var(--bg-card)",
            color: "var(--text-primary)", cursor: "pointer", fontSize: "1.125rem",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          +
        </button>
      </div>
    </div>
  );
}

/** Panel lateral reutilizable: lista izq + animación al cambiar item */
function LateralPanel({
  items,
  activeKey,
  onSelect,
  onAdd,
  addLabel,
  children,
}: {
  items: { key: string; label: string; description?: string }[];
  activeKey: string;
  onSelect: (k: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  const safeKey = items.find((i) => i.key === activeKey) ? activeKey : items[0]?.key ?? "0";

  return (
    <div style={{ display: "flex", border: "1px solid var(--border-default)",
      borderRadius: "var(--border-radius-lg)", overflow: "hidden", minHeight: 320 }}>
      {/* Lista izquierda */}
      <div style={{ width: "min(210px, 36%)", flexShrink: 0,
        borderRight: "1px solid var(--border-default)", background: "var(--bg-page)",
        display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {items.map((item) => {
            const active = item.key === safeKey;
            return (
              <button key={item.key} type="button" onClick={() => onSelect(item.key)}
                style={{ display: "flex", flexDirection: "column", width: "100%",
                  padding: "10px 12px", border: "none", textAlign: "left", cursor: "pointer",
                  borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                  background: active ? "var(--accent-tint, rgba(99,102,241,0.08))" : "transparent",
                  borderBottom: "1px solid var(--border-default)",
                  transition: "background 0.12s" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: active ? 700 : 500,
                  color: active ? "var(--accent)" : "var(--text-primary)" }}>
                  {item.label}
                </span>
                {item.description && (
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {item.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {onAdd && (
          <button type="button" onClick={onAdd}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px",
              border: "none", borderTop: "1px solid var(--border-default)",
              background: "transparent", color: "var(--accent)", cursor: "pointer",
              fontSize: "0.8125rem", fontWeight: 600 }}>
            <Plus size={14} />
            {addLabel ?? "Agregar"}
          </button>
        )}
      </div>

      {/* Detalle derecho con animación */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div key={safeKey}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: "16px 18px", height: "100%" }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ selected, onToggle }: { selected: PropTypeValue[]; onToggle: (v: PropTypeValue) => void; }) {
  return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        Selecciona el tipo de propiedad. Puedes elegir varios tipos si es mixta.
      </p>
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(180px, 100%), 1fr))", gap: 10 }}>
        {PROP_TYPES.map((pt) => {
          const Icon = pt.icon;
          const isSelected = selected.includes(pt.value);
          const idx = selected.indexOf(pt.value);
          return (
            <button key={pt.value} type="button" onClick={() => onToggle(pt.value)}
              style={{ position: "relative", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8, padding: "14px 10px",
                borderRadius: "var(--border-radius-md)",
                border: isSelected ? `2px solid ${pt.color}` : "1.5px solid var(--border-default)",
                background: isSelected ? `${pt.color}18` : "var(--bg-card)",
                color: isSelected ? pt.color : "var(--text-secondary)",
                cursor: "pointer", fontWeight: isSelected ? 700 : 500,
                fontSize: "0.8125rem", transition: "all 0.15s ease",
                textAlign: "center", boxSizing: "border-box", minWidth: 0 }}>
              <Icon size={22} />
              <span>{pt.label}</span>
              {isSelected && selected.length > 1 && (
                <span style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18,
                  borderRadius: "50%", background: pt.color, color: "#fff", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "0.625rem", fontWeight: 700 }}>
                  {idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p style={{ marginTop: 14, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Etiqueta:{" "}
          <strong style={{ color: "var(--text-primary)" }}>{calcPropertyLabel(selected)}</strong>
        </p>
      )}
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ state, onChange, showLandSqm }: {
  state: WizardState; onChange: (p: Partial<WizardState>) => void; showLandSqm: boolean;
}) {
  return (
    <div>
      <AppFormField label="Nombre" required>
        <input style={INPUT_STYLE} value={state.name} autoFocus
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej. Torre Sauce, Parque Las Cruces" />
      </AppFormField>
      <AppFormField label="Código">
        <input style={INPUT_STYLE} value={state.code}
          onChange={(e) => onChange({ code: e.target.value })}
          placeholder="Ej. TS-001 (opcional)" />
      </AppFormField>
      <AppFormField label="Dirección">
        <input style={INPUT_STYLE} value={state.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Ej. Av. Principal 123, Col. Centro" />
      </AppFormField>
      {showLandSqm && (
        <AppFormField label="Metros cuadrados de terreno">
          <input style={INPUT_STYLE} type="number" value={state.landSqm}
            onChange={(e) => onChange({ landSqm: e.target.value })}
            placeholder="Ej. 5000" min={0} />
        </AppFormField>
      )}
      <AppFormField label="Ubicación">
        <LocationPicker latitude={state.latitude} longitude={state.longitude}
          onLocationChange={(lat, lng, addr) => {
            const patch: Partial<WizardState> = { latitude: lat, longitude: lng };
            if (addr && !state.address.trim()) patch.address = addr;
            onChange(patch);
          }} />
      </AppFormField>
    </div>
  );
}

// ─── Step 3 — Residencial/Comercial (pisos + cantidad) ───────────────────────

function Step3Multi({ floors, onChange }: { floors: FloorConfig[]; onChange: (f: FloorConfig[]) => void; }) {
  const total = floors.reduce((s, f) => s + f.count, 0);
  const preview = genFloorSpaceCodes(floors);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>Pisos y espacios</p>
          <UiButton type="button" variant="secondary" icon={<Plus size={14} />}
            onClick={() => { if (floors.length < 20) onChange([...floors, { floor: floors.length + 1, count: 3 }]); }}
            style={{ fontSize: "0.8125rem", padding: "7px 12px" }}>
            Agregar piso
          </UiButton>
        </div>
        {floors.map((f, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600, minWidth: 56 }}>
              Piso {f.floor}
            </span>
            <div style={{ flex: 1 }}>
              <Counter label="Espacios" value={f.count}
                onChange={(v) => { const n = [...floors]; n[idx] = { ...n[idx], count: v }; onChange(n); }}
                min={1} max={20} />
            </div>
            {floors.length > 1 && (
              <button type="button"
                onClick={() => onChange(floors.filter((_, i) => i !== idx).map((x, i) => ({ ...x, floor: i + 1 })))}
                style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 16px", borderRadius: "var(--border-radius-md)",
        background: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
        <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700,
          color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Vista previa — {total} espacios
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {preview.slice(0, 30).map((sp) => (
            <span key={sp.code} style={{ padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem",
              fontWeight: 600, background: "var(--bg-card)", color: "var(--text-secondary)",
              border: "1px solid var(--border-default)" }}>
              {sp.code}
            </span>
          ))}
          {total > 30 && (
            <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem", color: "var(--text-muted)" }}>
              +{total - 30} más
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Casa/Bodega simple ─────────────────────────────────────────────

function Step3Single({ rentalMode, numSubdivisions, onChange }: {
  rentalMode: "whole" | "by_subdivision" | "both";
  numSubdivisions: number;
  onChange: (p: Partial<WizardState>) => void;
}) {
  const modes = [
    { value: "whole"          as const, label: "Completo",           description: "Se renta como una sola unidad" },
    { value: "by_subdivision" as const, label: "Por cuartos/partes",  description: "Cada sección tiene su contrato" },
    { value: "both"           as const, label: "Ambos modos",         description: "Puede rentarse completo o por partes" },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AppFormField label="¿Cómo se renta este espacio?">
        <div style={{ display: "grid", gap: 8 }}>
          {modes.map((m) => (
            <button key={m.value} type="button" onClick={() => onChange({ rentalMode: m.value })}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderRadius: "var(--border-radius-md)", textAlign: "left", cursor: "pointer",
                border: rentalMode === m.value ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                background: rentalMode === m.value ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                border: rentalMode === m.value ? "none" : "1.5px solid var(--border-default)",
                background: rentalMode === m.value ? "var(--accent)" : "transparent" }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.description}</p>
              </div>
            </button>
          ))}
        </div>
      </AppFormField>
      {(rentalMode === "by_subdivision" || rentalMode === "both") && (
        <AppFormField label="¿Cuántas subdivisiones (cuartos/secciones)?">
          <Counter label="Subdivisiones" value={numSubdivisions}
            onChange={(v) => onChange({ numSubdivisions: v })} min={2} max={20} />
        </AppFormField>
      )}
    </div>
  );
}

// ─── Step 3 — Bodega (elige si es sola o parque) ─────────────────────────────

function Step3BodegaChoice({ state, onChange }: {
  state: WizardState; onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Selector single vs parque */}
      <div>
        <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
          ¿Cómo está configurada esta propiedad?
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {([
            { v: "single" as const, label: "Una sola bodega / nave", desc: "Un único espacio independiente" },
            { v: "parque" as const, label: "Parque con varias naves", desc: "Varias naves agrupadas en una propiedad" },
          ] as const).map(({ v, label, desc }) => (
            <button key={v} type="button" onClick={() => onChange({ parqueMode: v, activeLateralKey: "0" })}
              style={{ display: "flex", flexDirection: "column", gap: 4, padding: "14px 16px",
                borderRadius: "var(--border-radius-md)", textAlign: "left", cursor: "pointer",
                border: state.parqueMode === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                background: state.parqueMode === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>{label}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Config según modo */}
      {state.parqueMode === "single" ? (
        <Step3Single rentalMode={state.rentalMode} numSubdivisions={state.numSubdivisions} onChange={onChange} />
      ) : (
        <NavePanel state={state} onChange={onChange} />
      )}
    </div>
  );
}

// ─── Nave Panel (para industrial_parque y industrial_bodega en modo parque) ──

function NavePanel({ state, onChange }: {
  state: WizardState; onChange: (p: Partial<WizardState>) => void;
}) {
  const naves = state.naves;
  const activeIdx = Math.min(parseInt(state.activeLateralKey) || 0, naves.length - 1);
  const activeKey = String(activeIdx);
  const nave = naves[activeIdx] ?? naves[0];

  function updateNave(idx: number, patch: Partial<NaveConfig>) {
    const next = [...naves];
    next[idx] = { ...next[idx], ...patch };
    onChange({ naves: next });
  }

  function addNave() {
    if (naves.length >= 20) return;
    const next = [...naves, { mode: "whole" as const, numBodegas: 2, totalSqm: "" }];
    onChange({ naves: next, activeLateralKey: String(next.length - 1) });
  }

  function removeNave(idx: number) {
    if (naves.length <= 1) return;
    const next = naves.filter((_, i) => i !== idx);
    onChange({ naves: next, activeLateralKey: String(Math.min(activeIdx, next.length - 1)) });
  }

  const items = naves.map((n, i) => ({
    key: String(i),
    label: `Nave ${i + 1}`,
    description: n.mode === "whole" ? "Completa" : `${n.numBodegas} bodegas`,
  }));

  return (
    <LateralPanel items={items} activeKey={activeKey}
      onSelect={(k) => onChange({ activeLateralKey: k })}
      onAdd={addNave} addLabel="Agregar nave">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
          Nave {activeIdx + 1}
        </p>
        {naves.length > 1 && (
          <button type="button" onClick={() => removeNave(activeIdx)}
            style={{ border: "none", background: "transparent", color: "var(--text-muted)",
              cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Modo: completa o dividida */}
      <AppFormField label="¿Cómo se renta esta nave?">
        <div style={{ display: "grid", gap: 8 }}>
          {([
            { v: "whole"      as const, label: "Completa",                desc: "1 contrato para toda la nave" },
            { v: "subdividida" as const, label: "Dividida en bodegas", desc: "Varias bodegas con contratos independientes" },
          ] as const).map(({ v, label, desc }) => (
            <button key={v} type="button" onClick={() => updateNave(activeIdx, { mode: v })}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderRadius: "var(--border-radius-md)", textAlign: "left", cursor: "pointer",
                border: nave.mode === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                background: nave.mode === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                border: nave.mode === v ? "none" : "1.5px solid var(--border-default)",
                background: nave.mode === v ? "var(--accent)" : "transparent" }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>{label}</p>
                <p style={{ margin: 0, fontSize: "0.6875rem", color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </AppFormField>

      {nave.mode === "subdividida" && (
        <AppFormField label="¿Cuántas bodegas?">
          <Counter label="Bodegas" value={nave.numBodegas}
            onChange={(v) => updateNave(activeIdx, { numBodegas: v })} min={2} max={20} />
        </AppFormField>
      )}

      <AppFormField label="Metros cuadrados (opcional)">
        <input style={INPUT_STYLE} type="number" value={nave.totalSqm}
          onChange={(e) => updateNave(activeIdx, { totalSqm: e.target.value })}
          placeholder="Ej. 800" min={0} />
      </AppFormField>
    </LateralPanel>
  );
}

// ─── Piso Panel (para oficinas divisibles) ────────────────────────────────────

function PisoPanel({ state, onChange }: {
  state: WizardState; onChange: (p: Partial<WizardState>) => void;
}) {
  const pisos = state.pisos;
  const activeIdx = Math.min(parseInt(state.activeLateralKey) || 0, pisos.length - 1);
  const activeKey = String(activeIdx);
  const piso = pisos[activeIdx] ?? pisos[0];

  function updatePiso(idx: number, patch: Partial<PisoConfig>) {
    const next = [...pisos];
    next[idx] = { ...next[idx], ...patch };
    onChange({ pisos: next });
  }

  function addPiso() {
    if (pisos.length >= 20) return;
    const next = [...pisos, { totalSqm: "600", minDivisionSqm: "100", strategy: "free_metraje" as const }];
    onChange({ pisos: next, activeLateralKey: String(next.length - 1) });
  }

  function removePiso(idx: number) {
    if (pisos.length <= 1) return;
    const next = pisos.filter((_, i) => i !== idx);
    onChange({ pisos: next, activeLateralKey: String(Math.min(activeIdx, next.length - 1)) });
  }

  const items = pisos.map((p, i) => ({
    key: String(i),
    label: `Piso ${i + 1}`,
    description: p.totalSqm ? `${p.totalSqm} m²` : "Sin metraje",
  }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
        Cada piso se convierte en un espacio divisible por metraje. Las porciones se asignan al firmar contratos.
      </p>
      <LateralPanel items={items} activeKey={activeKey}
        onSelect={(k) => onChange({ activeLateralKey: k })}
        onAdd={addPiso} addLabel="Agregar piso">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
            Piso {activeIdx + 1}
          </p>
          {pisos.length > 1 && (
            <button type="button" onClick={() => removePiso(activeIdx)}
              style={{ border: "none", background: "transparent", color: "var(--text-muted)",
                cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
              <Trash2 size={15} />
            </button>
          )}
        </div>

        <AppFormField label="Metros totales del piso" required>
          <input style={INPUT_STYLE} type="number" value={piso.totalSqm}
            onChange={(e) => updatePiso(activeIdx, { totalSqm: e.target.value })}
            placeholder="Ej. 600" min={1} />
        </AppFormField>

        <AppFormField label="Mínimo de corte (m²)" required>
          <input style={INPUT_STYLE} type="number" value={piso.minDivisionSqm}
            onChange={(e) => updatePiso(activeIdx, { minDivisionSqm: e.target.value })}
            placeholder="Ej. 100" min={1} />
        </AppFormField>

        <AppFormField label="Modalidad de división">
          <div style={{ display: "grid", gap: 8 }}>
            {([
              { v: "free_metraje" as const, label: "Metraje libre",     desc: "El inquilino toma los m² que necesita (mínimo el corte)" },
              { v: "fixed_units"  as const, label: "Cubículos fijos",   desc: "La planta está dividida en unidades preconfiguradas" },
            ] as const).map(({ v, label, desc }) => (
              <button key={v} type="button" onClick={() => updatePiso(activeIdx, { strategy: v })}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: "var(--border-radius-md)", textAlign: "left", cursor: "pointer",
                  border: piso.strategy === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                  background: piso.strategy === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: piso.strategy === v ? "none" : "1.5px solid var(--border-default)",
                  background: piso.strategy === v ? "var(--accent)" : "transparent" }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "0.6875rem", color: "var(--text-muted)" }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </AppFormField>
      </LateralPanel>
    </div>
  );
}

// ─── Step 3 — Mixto por zonas (Caso C) ──────────────────────────────────────

/** Config de una zona: rango de pisos + comportamiento por tipo */
function ZonaDetail({
  zona, onChange, selectedTypes,
}: {
  zona: ZonaConfig;
  onChange: (patch: Partial<ZonaConfig>) => void;
  selectedTypes: PropTypeValue[];
}) {
  const tipoProp = PROP_TYPES.find((p) => p.value === zona.tipo);
  const isMulti = MULTI_FLOOR_TYPES.includes(zona.tipo);
  const isOfc   = zona.tipo === "oficinas";
  const isPrq   = zona.tipo === "industrial_parque" ||
                  (zona.tipo === "industrial_bodega" && zona.parqueMode === "parque");
  const isBod   = zona.tipo === "industrial_bodega";
  const isSingle = ["residencial_uni", "terreno", "estacionamiento"].includes(zona.tipo);

  function setRange(ini: number, fin: number) {
    const updated = syncZonaFloors({ ...zona, pisoInicio: ini, pisoFin: fin });
    onChange(updated);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Nombre */}
      <AppFormField label="Nombre de la zona">
        <input style={INPUT_STYLE} value={zona.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          placeholder="Ej. Locales planta baja, Deptos torre" />
      </AppFormField>

      {/* Tipo selector — solo los elegidos en Step 1 */}
      <AppFormField label="Tipo de uso">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {selectedTypes.map((tv) => {
            const pt = PROP_TYPES.find((p) => p.value === tv);
            if (!pt) return null;
            const active = zona.tipo === tv;
            return (
              <button key={tv} type="button"
                onClick={() => onChange({ tipo: tv })}
                style={{ display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                  border: active ? `2px solid ${pt.color}` : "1.5px solid var(--border-default)",
                  background: active ? `${pt.color}18` : "var(--bg-card)",
                  color: active ? pt.color : "var(--text-secondary)",
                  fontWeight: active ? 700 : 500, fontSize: "0.8125rem" }}>
                <pt.icon size={13} />
                {pt.label}
              </button>
            );
          })}
        </div>
      </AppFormField>

      {/* Rango de pisos */}
      <div>
        <label style={{ display: "block", marginBottom: 8, fontSize: "0.875rem",
          fontWeight: 600, color: "var(--text-primary)" }}>
          Rango de pisos
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input style={{ ...INPUT_STYLE, width: 80, textAlign: "center" }} type="number" min={1}
            value={zona.pisoInicio}
            onChange={(e) => setRange(Math.max(1, parseInt(e.target.value) || 1), zona.pisoFin)} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem", flexShrink: 0 }}>hasta</span>
          <input style={{ ...INPUT_STYLE, width: 80, textAlign: "center" }} type="number" min={zona.pisoInicio}
            value={zona.pisoFin}
            onChange={(e) => setRange(zona.pisoInicio, Math.max(zona.pisoInicio, parseInt(e.target.value) || zona.pisoInicio))} />
        </div>
      </div>

      {/* Config per tipo */}
      {isMulti && (
        <div>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
            Espacios por piso
          </p>
          {zona.floors.map((f, idx) => (
            <Counter key={f.floor} label={`Piso ${f.floor}`} value={f.count}
              onChange={(v) => {
                const nf = [...zona.floors]; nf[idx] = { ...nf[idx], count: v };
                onChange({ floors: nf });
              }} min={1} max={20} />
          ))}
          <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Total: {zona.floors.reduce((s, f) => s + f.count, 0)} espacios
          </p>
        </div>
      )}

      {isOfc && (
        <div>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
            Metraje por piso
          </p>
          {zona.pisos.map((p, idx) => (
            <div key={idx} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-default)", display: "grid", gap: 10 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                Piso {zona.pisoInicio + idx}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <AppFormField label="m² totales">
                  <input style={INPUT_STYLE} type="number" value={p.totalSqm} min={1}
                    onChange={(e) => {
                      const np = [...zona.pisos]; np[idx] = { ...np[idx], totalSqm: e.target.value };
                      onChange({ pisos: np });
                    }} placeholder="600" />
                </AppFormField>
                <AppFormField label="Mínimo m²">
                  <input style={INPUT_STYLE} type="number" value={p.minDivisionSqm} min={1}
                    onChange={(e) => {
                      const np = [...zona.pisos]; np[idx] = { ...np[idx], minDivisionSqm: e.target.value };
                      onChange({ pisos: np });
                    }} placeholder="100" />
                </AppFormField>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { v: "free_metraje" as const, label: "Metraje libre" },
                  { v: "fixed_units"  as const, label: "Cubículos fijos" },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => { const np = [...zona.pisos]; np[idx] = { ...np[idx], strategy: v }; onChange({ pisos: np }); }}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: "var(--border-radius-sm)", cursor: "pointer",
                      border: p.strategy === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                      background: p.strategy === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)",
                      color: p.strategy === v ? "var(--accent)" : "var(--text-secondary)",
                      fontWeight: p.strategy === v ? 700 : 500, fontSize: "0.75rem" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isBod && (
        <AppFormField label="¿Tipo de bodega?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {([
              { v: "single" as const, label: "Una sola nave" },
              { v: "parque" as const, label: "Parque de naves" },
            ] as const).map(({ v, label }) => (
              <button key={v} type="button" onClick={() => onChange({ parqueMode: v })}
                style={{ padding: "10px", borderRadius: "var(--border-radius-md)", cursor: "pointer", textAlign: "left",
                  border: zona.parqueMode === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                  background: zona.parqueMode === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)",
                  fontWeight: zona.parqueMode === v ? 700 : 500, fontSize: "0.8125rem",
                  color: zona.parqueMode === v ? "var(--accent)" : "var(--text-primary)" }}>
                {label}
              </button>
            ))}
          </div>
        </AppFormField>
      )}

      {isPrq && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>Naves</p>
            <button type="button" onClick={() => onChange({ naves: [...zona.naves, { mode: "whole", numBodegas: 2, totalSqm: "" }] })}
              style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent",
                color: "var(--accent)", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>
              <Plus size={13} /> Nave
            </button>
          </div>
          {zona.naves.map((nave, ni) => (
            <div key={ni} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-default)", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-primary)" }}>Nave {ni + 1}</span>
                {zona.naves.length > 1 && (
                  <button type="button" onClick={() => onChange({ naves: zona.naves.filter((_, i) => i !== ni) })}
                    style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { v: "whole"       as const, label: "Completa" },
                  { v: "subdividida" as const, label: "Dividida" },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => { const nn = [...zona.naves]; nn[ni] = { ...nn[ni], mode: v }; onChange({ naves: nn }); }}
                    style={{ flex: 1, padding: "6px", borderRadius: "var(--border-radius-sm)", cursor: "pointer",
                      border: nave.mode === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                      background: nave.mode === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)",
                      fontSize: "0.75rem", fontWeight: nave.mode === v ? 700 : 500,
                      color: nave.mode === v ? "var(--accent)" : "var(--text-secondary)" }}>
                    {label}
                  </button>
                ))}
              </div>
              {nave.mode === "subdividida" && (
                <Counter label="Bodegas" value={nave.numBodegas} min={2} max={20}
                  onChange={(v) => { const nn = [...zona.naves]; nn[ni] = { ...nn[ni], numBodegas: v }; onChange({ naves: nn }); }} />
              )}
            </div>
          ))}
        </div>
      )}

      {isSingle && (
        <AppFormField label="¿Cómo se renta?">
          <div style={{ display: "grid", gap: 8 }}>
            {([
              { v: "whole"          as const, label: "Completo",           desc: "Un solo contrato" },
              { v: "by_subdivision" as const, label: "Por cuartos/partes", desc: "Contratos individuales" },
              { v: "both"           as const, label: "Ambos modos",         desc: "Flexible" },
            ] as const).map(({ v, label, desc }) => (
              <button key={v} type="button" onClick={() => onChange({ rentalMode: v })}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: "var(--border-radius-md)", textAlign: "left", cursor: "pointer",
                  border: zona.rentalMode === v ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
                  background: zona.rentalMode === v ? "var(--accent-tint, rgba(99,102,241,0.08))" : "var(--bg-card)" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: zona.rentalMode === v ? "none" : "1.5px solid var(--border-default)",
                  background: zona.rentalMode === v ? "var(--accent)" : "transparent" }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "0.6875rem", color: "var(--text-muted)" }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </AppFormField>
      )}
    </div>
  );
}

function Step3Mixto({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void; }) {
  const zonas = state.zonas;
  const hasOverlap = zonas.length >= 2 && detectOverlaps(zonas);
  const activeIdx = Math.min(parseInt(state.activeZonaKey) || 0, Math.max(0, zonas.length - 1));
  const activeKey = String(activeIdx);
  const zona = zonas[activeIdx];

  function updateZona(idx: number, patch: Partial<ZonaConfig>) {
    const next = [...zonas];
    next[idx] = { ...next[idx], ...patch };
    onChange({ zonas: next });
  }

  function addZona() {
    if (zonas.length >= 10) return;
    const lastPisoFin = zonas.length > 0 ? zonas[zonas.length - 1].pisoFin : 0;
    const tipo = state.selectedTypes[zonas.length % state.selectedTypes.length];
    const next = [...zonas, initZona(tipo, zonas.length, lastPisoFin + 1)];
    onChange({ zonas: next, activeZonaKey: String(next.length - 1) });
  }

  function removeZona(idx: number) {
    if (zonas.length <= 1) return;
    const next = zonas.filter((_, i) => i !== idx);
    onChange({ zonas: next, activeZonaKey: String(Math.min(activeIdx, next.length - 1)) });
  }

  const items = zonas.map((z, i) => {
    const pt = PROP_TYPES.find((p) => p.value === z.tipo);
    const floorRange = z.pisoInicio === z.pisoFin ? `P${z.pisoInicio}` : `P${z.pisoInicio}–${z.pisoFin}`;
    return {
      key: String(i),
      label: z.nombre,
      description: `${pt?.label ?? z.tipo} · ${floorRange}`,
    };
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {hasOverlap && (
        <div style={{ padding: "8px 14px", borderRadius: "var(--border-radius-md)",
          background: "var(--badge-bg-amber)", border: "1px solid var(--metric-border-amber)",
          color: "var(--badge-text-amber)", fontSize: "0.8125rem", fontWeight: 600 }}>
          ⚠️ Dos o más zonas tienen rangos de pisos superpuestos — los spaces se crearán igual, pero revisa los rangos.
        </div>
      )}

      <LateralPanel items={items} activeKey={activeKey}
        onSelect={(k) => onChange({ activeZonaKey: k })}
        onAdd={addZona} addLabel="Agregar zona">
        {zona ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
              {zona.nombre}
            </p>
            {zonas.length > 1 && (
              <button type="button" onClick={() => removeZona(activeIdx)}
                style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ) : null}
        {zona ? (
          <ZonaDetail zona={zona} onChange={(p) => updateZona(activeIdx, p)} selectedTypes={state.selectedTypes} />
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Agrega una zona para comenzar.</p>
        )}
      </LateralPanel>
    </div>
  );
}

// ─── Step 4 — Assets ─────────────────────────────────────────────────────────

function Step4Assets({ assets, onChange }: { assets: AssetDraft[]; onChange: (a: AssetDraft[]) => void; }) {
  return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        Opcional. Registra equipos o instalaciones de toda la propiedad (cisterna, caldera, cámaras, etc.).
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {assets.map((a, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, alignItems: "center" }}>
            <input style={INPUT_STYLE} value={a.tipo}
              onChange={(e) => { const n = [...assets]; n[idx] = { ...n[idx], tipo: e.target.value }; onChange(n); }}
              placeholder="Tipo (ej. hidráulico)" />
            <input style={INPUT_STYLE} value={a.nombre}
              onChange={(e) => { const n = [...assets]; n[idx] = { ...n[idx], nombre: e.target.value }; onChange(n); }}
              placeholder="Nombre (ej. Cisterna 5000L)" />
            <button type="button" onClick={() => onChange(assets.filter((_, i) => i !== idx))}
              style={{ border: "none", background: "transparent", color: "var(--text-muted)",
                cursor: "pointer", padding: 6, display: "flex", alignItems: "center" }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <UiButton type="button" variant="secondary" icon={<Plus size={14} />}
          onClick={() => onChange([...assets, { tipo: "", nombre: "" }])}
          style={{ justifySelf: "start", fontSize: "0.8125rem", padding: "8px 14px" }}>
          Agregar equipo
        </UiButton>
      </div>
    </div>
  );
}

// ─── Step 5 — Resumen ────────────────────────────────────────────────────────

function Step5Summary({ state }: { state: WizardState; }) {
  const singleType = state.selectedTypes.length === 1 ? state.selectedTypes[0] : null;
  const isMixto = state.selectedTypes.length > 1;
  const label = singleType
    ? calcPropertyLabel(state.selectedTypes)
    : calcLabelFromZonas(state.zonas);
  const isParque = singleType === "industrial_parque" ||
                   (singleType === "industrial_bodega" && state.parqueMode === "parque");
  const isOficinas = singleType === "oficinas";
  const isMultiFloor = !isParque && !isOficinas && singleType && MULTI_FLOOR_TYPES.includes(singleType);

  let totalSpaces = 0;
  if (isParque) totalSpaces = state.naves.reduce((s, n) => s + (n.mode === "whole" ? 1 : n.numBodegas), 0);
  else if (isOficinas) totalSpaces = state.pisos.length;
  else if (isMultiFloor) totalSpaces = state.floors.reduce((s, f) => s + f.count, 0);
  else if (!isMixto && singleType) totalSpaces = 1;
  else if (isMixto) totalSpaces = state.zonas.reduce((s, z) => s + calcZonaSpaces(z), 0);

  const zonaBreakdownItems = isMixto
    ? state.zonas.map((zona) => {
        const floorRange = zona.pisoInicio === zona.pisoFin
          ? `P${zona.pisoInicio}`
          : `P${zona.pisoInicio}–${zona.pisoFin}`;
        const isMultiZ = MULTI_FLOOR_TYPES.includes(zona.tipo);
        const isOfcZ = zona.tipo === "oficinas";
        if (isMultiZ) {
          const total = zona.floors.reduce((s, f) => s + f.count, 0);
          const tLabel = zona.tipo === "comercial" ? "locales" : "deptos";
          return `${total} ${tLabel} (${floorRange})`;
        } else if (isOfcZ) {
          const totalM = zona.pisos.reduce((s, p) => s + (Number(p.totalSqm) || 0), 0);
          return `${totalM.toLocaleString("es-MX")}m² oficinas (${floorRange})`;
        } else {
          const pt = PROP_TYPES.find((p) => p.value === zona.tipo);
          return `${zona.nombre} · ${pt?.shortLabel ?? zona.tipo} (${floorRange})`;
        }
      })
    : [];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Info card */}
      <div style={{ padding: 16, borderRadius: "var(--border-radius-lg)",
        border: "1px solid var(--border-default)", background: "var(--bg-card)", display: "grid", gap: 6 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>
          {state.name || <em style={{ color: "var(--text-muted)" }}>Sin nombre</em>}
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>{label}</p>
        {state.address && (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{state.address}</p>
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)" }}>
            {totalSpaces}
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>espacios</p>
        </div>
        {(isParque || isOficinas) && (
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)" }}>
              {isParque ? state.naves.length : state.pisos.length}
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {isParque ? "naves" : "pisos"}
            </p>
          </div>
        )}
        {isMixto && (
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)" }}>
              {state.zonas.length}
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>zonas</p>
          </div>
        )}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)" }}>
            {state.assets.filter((a) => a.nombre.trim()).length}
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>equipos</p>
        </div>
      </div>

      {/* Distribución */}
      {isParque && (
        <SummaryBadges label="Distribución de naves"
          items={state.naves.map((n, i) => `Nave ${i + 1}: ${n.mode === "whole" ? "completa" : `${n.numBodegas} bod.`}`)} />
      )}
      {isOficinas && (
        <SummaryBadges label="Distribución de pisos"
          items={state.pisos.map((p, i) => `Piso ${i + 1}: ${p.totalSqm || "?"}m²`)} />
      )}
      {isMultiFloor && (
        <SummaryBadges label="Distribución por piso"
          items={state.floors.map((f) => `Piso ${f.floor}: ${f.count} esp.`)} />
      )}
      {isMixto && zonaBreakdownItems.length > 0 && (
        <SummaryBadges label="Desglose por zona" items={zonaBreakdownItems} />
      )}
    </div>
  );
}

function SummaryBadges({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700,
        color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => (
          <span key={item} style={{ padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem",
            fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)",
            border: "1px solid var(--border-default)" }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Tipo" },
  { label: "Información" },
  { label: "Estructura" },
  { label: "Equipo" },
  { label: "Resumen" },
];

interface Props {
  open: boolean;
  companyId: string | null;
  isTest?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PropertyWizardModal({ open, companyId, isTest = false, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [stepDir, setStepDir] = useState<"left" | "right">("right");
  const [state, setState] = useState<WizardState>(initState);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function patch(p: Partial<WizardState>) { setState((s) => ({ ...s, ...p })); }

  function handleClose() {
    setStep(1); setStepDir("right"); setState(initState()); setErr(""); onClose();
  }

  function goNext() {
    if (step === 1 && state.selectedTypes.length === 0) { setErr("Elige al menos un tipo de propiedad."); return; }
    if (step === 2 && !state.name.trim()) { setErr("El nombre es obligatorio."); return; }
    if (step === 2 && state.selectedTypes.length > 1 && state.zonas.length === 0) {
      const initZonas = state.selectedTypes.map((tipo, idx) => initZona(tipo, idx, idx + 1));
      setState((s) => ({ ...s, zonas: initZonas, activeZonaKey: "0" }));
    }
    setErr(""); setStepDir("right"); setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function goBack() { setErr(""); setStepDir("left"); setStep((s) => Math.max(1, s - 1)); }

  const handleFinish = useCallback(async () => {
    if (!companyId) { setErr("No hay empresa activa seleccionada."); return; }
    setLoading(true); setErr("");
    try {
      const singleType = state.selectedTypes.length === 1 ? state.selectedTypes[0] : null;
      const label = singleType
        ? calcPropertyLabel(state.selectedTypes)
        : calcLabelFromZonas(state.zonas);

      // ── 1. Insertar propiedad ───────────────────────────────────────────────
      const { data: prop, error: propErr } = await supabase.from("properties")
        .insert({
          company_id: companyId,
          name: state.name.trim(),
          code: state.code.trim() || null,
          address: state.address.trim() || null,
          latitude: state.latitude,
          longitude: state.longitude,
          property_label: label,
          total_sqm: state.landSqm ? Number(state.landSqm) : null,
          is_test: isTest,
        })
        .select("id").single();
      if (propErr || !prop) throw new Error(propErr?.message ?? "Error al crear propiedad");
      const pid = prop.id;

      // ── 2. Insertar estructura según caso ──────────────────────────────────
      const isParque = singleType === "industrial_parque" ||
                       (singleType === "industrial_bodega" && state.parqueMode === "parque");
      const isOficinas = singleType === "oficinas";
      const isMultiFloor = !isParque && !isOficinas &&
                           singleType && MULTI_FLOOR_TYPES.includes(singleType) &&
                           state.selectedTypes.length === 1;
      const isSingle = !isParque && !isOficinas &&
                       singleType && SINGLE_SPACE_TYPES.includes(singleType) &&
                       state.selectedTypes.length === 1;

      if (isParque) {
        // — Caso A: Parque con naves —
        const sgRows = state.naves.map((_, i) => ({
          company_id: companyId, property_id: pid,
          name: `Nave ${i + 1}`, group_type: "nave", sort_order: i + 1,
        }));
        const { data: sgs, error: sgErr } = await supabase.from("space_groups").insert(sgRows).select("id");
        if (sgErr || !sgs) throw new Error(sgErr?.message ?? "Error al crear naves");

        const spaceRows: Record<string, unknown>[] = [];
        for (let i = 0; i < state.naves.length; i++) {
          const nave = state.naves[i];
          const sgId = sgs[i].id;
          if (nave.mode === "whole") {
            spaceRows.push({
              company_id: companyId, property_id: pid, space_group_id: sgId,
              space_type: "warehouse", rental_mode: "whole", is_rentable: true,
              code: `N${i + 1}-BOD`,
              total_sqm: nave.totalSqm ? Number(nave.totalSqm) : null,
              status: "VACANT", is_test: isTest,
            });
          } else {
            for (let j = 0; j < nave.numBodegas; j++) {
              spaceRows.push({
                company_id: companyId, property_id: pid, space_group_id: sgId,
                space_type: "warehouse", rental_mode: "whole", is_rentable: true,
                code: `N${i + 1}-B${j + 1}`, status: "VACANT", is_test: isTest,
              });
            }
          }
        }
        if (spaceRows.length > 0) {
          const { error: spErr } = await supabase.from("spaces").insert(spaceRows);
          if (spErr) throw new Error(spErr.message);
        }

      } else if (isOficinas) {
        // — Caso B: Oficinas divisibles —
        const sgRows = state.pisos.map((_, i) => ({
          company_id: companyId, property_id: pid,
          name: `Piso ${i + 1}`, group_type: "piso", sort_order: i + 1,
        }));
        const { data: sgs, error: sgErr } = await supabase.from("space_groups").insert(sgRows).select("id");
        if (sgErr || !sgs) throw new Error(sgErr?.message ?? "Error al crear pisos");

        const spaceRows = state.pisos.map((p, i) => ({
          company_id: companyId, property_id: pid, space_group_id: sgs[i].id,
          space_type: "office", rental_mode: "both", is_rentable: true,
          code: `P${i + 1}-OF`,
          total_sqm: p.totalSqm ? Number(p.totalSqm) : null,
          is_divisible: true,
          divisible_strategy: p.strategy,
          min_division_sqm: p.minDivisionSqm ? Number(p.minDivisionSqm) : null,
          status: "VACANT", is_test: isTest,
        }));
        const { error: spErr } = await supabase.from("spaces").insert(spaceRows);
        if (spErr) throw new Error(spErr.message);

      } else if (isMultiFloor) {
        // — Residencial multi / Comercial —
        const spaceRows = genFloorSpaceCodes(state.floors).map(({ code, floor }) => ({
          company_id: companyId, property_id: pid,
          space_type: PROP_TYPES.find((p) => p.value === singleType!)?.spaceType ?? "apartment",
          rental_mode: "whole", is_rentable: true,
          code, floor, status: "VACANT", is_test: isTest,
        }));
        const { error: spErr } = await supabase.from("spaces").insert(spaceRows);
        if (spErr) throw new Error(spErr.message);

      } else if (isSingle) {
        // — Casa / Bodega simple / Terreno / Estacionamiento —
        const { data: sp, error: spErr } = await supabase.from("spaces")
          .insert({
            company_id: companyId, property_id: pid,
            space_type: PROP_TYPES.find((p) => p.value === singleType!)?.spaceType ?? "house",
            rental_mode: state.rentalMode, is_rentable: true,
            code: "1", status: "VACANT", is_test: isTest,
          })
          .select("id").single();
        if (spErr || !sp) throw new Error(spErr?.message ?? "Error al crear espacio");

        if (state.rentalMode !== "whole" && state.numSubdivisions >= 2) {
          const subRows = Array.from({ length: state.numSubdivisions }, (_, i) => ({
            company_id: companyId, space_id: sp.id,
            subdivision_type: "room", label: `Recámara ${i + 1}`,
            sort_order: i + 1, is_active: true,
          }));
          const { error: subErr } = await supabase.from("space_subdivisions").insert(subRows);
          if (subErr) throw new Error(subErr.message);
        }
      } else if (state.selectedTypes.length > 1) {
        // — Caso C: Mixto por zonas —
        for (let zi = 0; zi < state.zonas.length; zi++) {
          const zona = state.zonas[zi];
          const spaceType = PROP_TYPES.find((p) => p.value === zona.tipo)?.spaceType ?? "apartment";
          const isMultiZ = MULTI_FLOOR_TYPES.includes(zona.tipo);
          const isOfcZ   = zona.tipo === "oficinas";
          const isPrqZ   = zona.tipo === "industrial_parque" ||
                           (zona.tipo === "industrial_bodega" && zona.parqueMode === "parque");

          if (isMultiZ) {
            const spaceRows = genFloorSpaceCodes(zona.floors).map(({ code, floor }) => ({
              company_id: companyId, property_id: pid,
              space_type: spaceType, rental_mode: "whole", is_rentable: true,
              code, floor, status: "VACANT", is_test: isTest,
            }));
            if (spaceRows.length > 0) {
              const { error: spErr } = await supabase.from("spaces").insert(spaceRows);
              if (spErr) throw new Error(spErr.message);
            }
          } else if (isOfcZ) {
            const sgRows = zona.pisos.map((_, pi) => ({
              company_id: companyId, property_id: pid,
              name: `Piso ${zona.pisoInicio + pi}`, group_type: "piso",
              sort_order: zona.pisoInicio + pi,
            }));
            const { data: sgs, error: sgErr } = await supabase.from("space_groups").insert(sgRows).select("id");
            if (sgErr || !sgs) throw new Error(sgErr?.message ?? "Error al crear pisos de oficinas");
            const spaceRows = zona.pisos.map((p, pi) => ({
              company_id: companyId, property_id: pid, space_group_id: sgs[pi].id,
              space_type: "office", rental_mode: "both", is_rentable: true,
              code: `P${zona.pisoInicio + pi}-OF`, floor: String(zona.pisoInicio + pi),
              total_sqm: p.totalSqm ? Number(p.totalSqm) : null,
              is_divisible: true, divisible_strategy: p.strategy,
              min_division_sqm: p.minDivisionSqm ? Number(p.minDivisionSqm) : null,
              status: "VACANT", is_test: isTest,
            }));
            const { error: spErr } = await supabase.from("spaces").insert(spaceRows);
            if (spErr) throw new Error(spErr.message);
          } else if (isPrqZ) {
            const sgRows = zona.naves.map((_, ni) => ({
              company_id: companyId, property_id: pid,
              name: `Nave ${ni + 1}`, group_type: "nave", sort_order: ni + 1,
            }));
            const { data: sgs, error: sgErr } = await supabase.from("space_groups").insert(sgRows).select("id");
            if (sgErr || !sgs) throw new Error(sgErr?.message ?? "Error al crear naves");
            const spaceRowsP: Record<string, unknown>[] = [];
            for (let ni = 0; ni < zona.naves.length; ni++) {
              const nave = zona.naves[ni];
              const sgId = sgs[ni].id;
              if (nave.mode === "whole") {
                spaceRowsP.push({
                  company_id: companyId, property_id: pid, space_group_id: sgId,
                  space_type: "warehouse", rental_mode: "whole", is_rentable: true,
                  code: `N${ni + 1}-BOD`,
                  total_sqm: nave.totalSqm ? Number(nave.totalSqm) : null,
                  status: "VACANT", is_test: isTest,
                });
              } else {
                for (let j = 0; j < nave.numBodegas; j++) {
                  spaceRowsP.push({
                    company_id: companyId, property_id: pid, space_group_id: sgId,
                    space_type: "warehouse", rental_mode: "whole", is_rentable: true,
                    code: `N${ni + 1}-B${j + 1}`, status: "VACANT", is_test: isTest,
                  });
                }
              }
            }
            if (spaceRowsP.length > 0) {
              const { error: spErr } = await supabase.from("spaces").insert(spaceRowsP);
              if (spErr) throw new Error(spErr.message);
            }
          } else {
            // bodega sola / terreno / casa / estacionamiento en zona
            const { error: spErr } = await supabase.from("spaces").insert({
              company_id: companyId, property_id: pid,
              space_type: spaceType, rental_mode: zona.rentalMode, is_rentable: true,
              code: `Z${zi + 1}`, floor: String(zona.pisoInicio),
              status: "VACANT", is_test: isTest,
            });
            if (spErr) throw new Error(spErr.message);
          }
        }
      }

      // ── 3. Insertar assets a nivel propiedad ──────────────────────────────
      const validAssets = state.assets.filter((a) => a.nombre.trim());
      if (validAssets.length > 0) {
        const { error: aErr } = await supabase.from("assets").insert(
          validAssets.map((a) => ({
            company_id: companyId, property_id: pid,
            asset_type: a.tipo.trim() || "general", name: a.nombre.trim(), status: "ACTIVE",
          }))
        );
        if (aErr) throw new Error(aErr.message);
      }

      toast.success(`Propiedad "${state.name.trim()}" creada`);
      handleClose();
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [companyId, isTest, state, onSuccess]);

  const singleType = state.selectedTypes.length === 1 ? state.selectedTypes[0] : null;
  const showLandSqm = singleType === "terreno";

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <Step1 selected={state.selectedTypes}
            onToggle={(v) => {
              const cur = state.selectedTypes;
              patch({ selectedTypes: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
            }} />
        );
      case 2:
        return <Step2 state={state} onChange={patch} showLandSqm={showLandSqm} />;
      case 3:
        if (state.selectedTypes.length > 1) {
          return <Step3Mixto state={state} onChange={patch} />;
        }
        switch (singleType) {
          case "residencial_multi":
          case "comercial":
            return <Step3Multi floors={state.floors} onChange={(f) => patch({ floors: f })} />;
          case "residencial_uni":
          case "terreno":
          case "estacionamiento":
            return <Step3Single rentalMode={state.rentalMode} numSubdivisions={state.numSubdivisions} onChange={patch} />;
          case "industrial_bodega":
            return <Step3BodegaChoice state={state} onChange={patch} />;
          case "industrial_parque":
            return <NavePanel state={state} onChange={patch} />;
          case "oficinas":
            return <PisoPanel state={state} onChange={patch} />;
          default:
            return null;
        }
      case 4:
        return <Step4Assets assets={state.assets} onChange={(a) => patch({ assets: a })} />;
      case 5:
        return <Step5Summary state={state} />;
      default:
        return null;
    }
  }

  return (
    <WizardShell open={open} title="Nueva propiedad" steps={STEPS}
      currentStep={step} stepDir={stepDir}
      onNext={goNext} onBack={goBack} onCancel={handleClose}
      onFinish={handleFinish} finalLabel="Crear propiedad" loading={loading}>
      {renderStep()}
      {err && (
        <p style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--border-radius-md)",
          background: "var(--badge-bg-red)", border: "1px solid var(--metric-border-red)",
          color: "var(--badge-text-red)", fontSize: "0.8125rem", fontWeight: 600 }}>
          {err}
        </p>
      )}
    </WizardShell>
  );
}
