"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { slideStep } from "@/lib/animations";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import {
  BedDouble, Box, Car, Check,
  Shirt, Sofa, Sun, TreePine, UtensilsCrossed, Wind, Wrench, Plus, X,
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Props {
  open: boolean; buildingId: string; companyId: string;
  onClose: () => void; onSuccess: () => void;
}

type Step1 = { name: string; sqm: string; description: string };
type Step2 = {
  hasSala: boolean; hasCocina: boolean; hasComedor: boolean;
  hasPatio: boolean; hasCajon: boolean; hasBodega: boolean;
  hasTerraza: boolean; hasLavanderia: boolean;
  hasCuartoServicio: boolean; hasCuartoMaquinas: boolean;
  bedrooms: number;
  customSpaces: string[];
};
type BedroomEq = {
  ac: string; fan: string; heater: string;
  bed: string; closet: string; tv: string; furnitureOther: string[];
  hasOwnBath: boolean; shower: string; hasTub: boolean; hasJacuzzi: boolean;
};
type SalaEq = { ac: string; fan: string; furniture: string[]; furnitureOther: string[]; guestBath: string; guestBathShower: string };
type CocinaEq = {
  ac: string; hasHalfBath: boolean;
  stoveType: string; stoveBurners: string; oven: string;
  fridge: string; fridgeModel: string; others: string[];
};
type LavanderiaEq = {
  boiler: string; boilerCapacity: string; boilerCount: number; boilerServices: string;
  centroCarga: string; washer: string; dryer: string;
};
type CuartoMaquinasEq = {
  boiler: string; boilerCapacity: string; boilerCount: number; boilerServices: string;
};
type EquiposFuncionalesEq = {
  boiler: string; boilerCapacity: string; boilerCount: number; boilerServices: string;
  centroCarga: string; washer: string; dryer: string;
};
type AireCentralEq = { capacity: string };
type ComadorEq = { ac: string; furniture: string };
type Equipment = {
  bedrooms: BedroomEq[];
  cuartoServicio: BedroomEq;
  sala: SalaEq;
  cocina: CocinaEq;
  lavanderia: LavanderiaEq;
  cuartoMaquinas: CuartoMaquinasEq;
  equiposFuncionales: EquiposFuncionalesEq;
  aireCentral: AireCentralEq;
  comedor: ComadorEq;
};

/* ─── Defaults ───────────────────────────────────────────────────────── */

const S1: Step1 = { name: "", sqm: "", description: "" };
const S2: Step2 = {
  hasSala: false, hasCocina: false, hasComedor: false, hasPatio: false,
  hasCajon: false, hasBodega: false, hasTerraza: false, hasLavanderia: false,
  hasCuartoServicio: false, hasCuartoMaquinas: false,
  bedrooms: 1, customSpaces: [],
};
const DEFAULT_BEDROOM_EQ: BedroomEq = {
  ac: "NONE", fan: "NO", heater: "NONE",
  bed: "NONE", closet: "NONE", tv: "NO", furnitureOther: [],
  hasOwnBath: false, shower: "NONE", hasTub: false, hasJacuzzi: false,
};
const DEFAULT_EQ: Equipment = {
  bedrooms: [{ ...DEFAULT_BEDROOM_EQ }],
  cuartoServicio: { ...DEFAULT_BEDROOM_EQ },
  sala: { ac: "NONE", fan: "NO", furniture: [], furnitureOther: [], guestBath: "NONE", guestBathShower: "NONE" },
  cocina: { ac: "NONE", hasHalfBath: false, stoveType: "NONE", stoveBurners: "4Q", oven: "NONE", fridge: "NONE", fridgeModel: "", others: [] },
  lavanderia: { boiler: "NONE", boilerCapacity: "60L", boilerCount: 1, boilerServices: "1", centroCarga: "NO", washer: "NO", dryer: "NONE" },
  cuartoMaquinas: { boiler: "NONE", boilerCapacity: "60L", boilerCount: 1, boilerServices: "1" },
  equiposFuncionales: { boiler: "NONE", boilerCapacity: "60L", boilerCount: 1, boilerServices: "1", centroCarga: "NO", washer: "NO", dryer: "NONE" },
  aireCentral: { capacity: "5" },
  comedor: { ac: "NONE", furniture: "NONE" },
};

/* ─── Space group definitions ────────────────────────────────────────── */

const PRIVADOS_SPACES = [
  { key: "hasCuartoServicio", label: "Cuarto de servicio", Icon: BedDouble },
] as const;

const SOCIALES_SPACES = [
  { key: "hasSala",    label: "Sala",    Icon: Sofa            },
  { key: "hasCocina",  label: "Cocina",  Icon: UtensilsCrossed },
  { key: "hasComedor", label: "Comedor", Icon: UtensilsCrossed },
  { key: "hasTerraza", label: "Terraza", Icon: Sun             },
  { key: "hasPatio",   label: "Patio",   Icon: TreePine        },
] as const;

const SERVICIO_SPACES = [
  { key: "hasLavanderia",     label: "Lavandería",          Icon: Shirt   },
  { key: "hasCuartoMaquinas", label: "Cuarto de máquinas",  Icon: Wrench  },
  { key: "hasBodega",         label: "Bodega",              Icon: Box     },
  { key: "hasCajon",          label: "Cajón",               Icon: Car     },
] as const;

/* ─── Compute bath counts from equipment ─────────────────────────────── */

function computeBathroomsComplete(s2: Step2, eq: Equipment): number {
  return eq.bedrooms.filter((b, i) => i < s2.bedrooms && b.hasOwnBath).length
    + (s2.hasCuartoServicio && eq.cuartoServicio.hasOwnBath ? 1 : 0)
    + (s2.hasSala && eq.sala.guestBath === "FULL" ? 1 : 0);
}

function computeBathroomsHalf(s2: Step2, eq: Equipment): number {
  return (s2.hasCocina && eq.cocina.hasHalfBath ? 1 : 0)
    + (s2.hasSala && eq.sala.guestBath === "HALF" ? 1 : 0);
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

const ACCENT = "#8B2252";

function ps(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: active ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)",
    background: active ? "#f9eaf3" : "var(--bg-card)",
    color: active ? ACCENT : "var(--text-secondary)",
  };
}

function Radio({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={ps(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Pills({ value, onChange, options }: {
  value: string[]; onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            style={ps(on)}>
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

/* ─── Include toggle (No incluye / Sí incluye) ───────────────────────── */

function IncludeToggle({ included, onInclude, onExclude, children }: {
  included: boolean; onInclude: () => void; onExclude: () => void; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={onExclude} style={ps(!included)}>No incluye</button>
        <button type="button" onClick={() => { if (!included) onInclude(); }} style={ps(included)}>Sí incluye</button>
      </div>
      <Expand show={included} id="include-content">{children}</Expand>
    </div>
  );
}

/* ─── Animated expand/collapse wrapper ──────────────────────────────── */

function Expand({ show, id, children }: { show: boolean; id: string; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── AC helpers ─────────────────────────────────────────────────────── */

function acTypeOf(v: string): string {
  if (v === "CENTRAL" || v.startsWith("CENTRAL_")) return "CENTRAL";
  if (v.startsWith("FAN_COIL")) return "FAN_COIL";
  if (v.startsWith("MINI")) return "MINI";
  return "NONE";
}

function acCapOf(v: string): string {
  if (v.endsWith("_1_5T")) return "1_5T";
  if (v.endsWith("_5T")) return "5T";
  if (v.endsWith("_3T")) return "3T";
  if (v.endsWith("_2T")) return "2T";
  return "1T";
}

/* ─── AcSection (reusable) ───────────────────────────────────────────── */

function AcSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = acTypeOf(value);
  const c = acCapOf(value);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Radio
        value={t}
        onChange={(newT) => {
          if (newT === "NONE") onChange("NONE");
          else if (newT === "CENTRAL") onChange("CENTRAL");
          else onChange(`${newT}_${(t === "MINI" || t === "FAN_COIL") ? c : "1T"}`);
        }}
        options={[
          { value: "NONE", label: "No incluye" },
          { value: "MINI", label: "Minisplit" },
          { value: "CENTRAL", label: "Aire central" },
          { value: "FAN_COIL", label: "Fan & coil" },
        ]}
      />
      <Expand show={t === "MINI" || t === "FAN_COIL"} id="ac-cap">
        <Radio
          value={c}
          onChange={(newC) => onChange(`${t}_${newC}`)}
          options={[
            { value: "1T", label: "1 ton" },
            { value: "1_5T", label: "1.5 ton" },
            { value: "2T", label: "2 ton" },
            { value: "3T", label: "3 ton" },
            ...(t === "FAN_COIL" ? [{ value: "5T", label: "5 ton" }] : []),
          ]}
        />
      </Expand>
    </div>
  );
}

/* ─── Pills input (text + Agregar + removable pills) ────────────────── */

function PillsInput({ value, onChange, placeholder = "Agregar..." }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (!t) return;
    onChange([...value, t]);
    setInput("");
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border-default)", borderRadius: 8, background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
        />
        <button type="button" onClick={add}
          style={{ padding: "0 12px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          Agregar
        </button>
      </div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {value.map((item, idx) => (
            <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#f9eaf3", color: ACCENT }}>
              {item}
              <button type="button" onClick={() => onChange(value.filter((_, i) => i !== idx))}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: ACCENT, display: "flex", alignItems: "center" }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Boiler constants ───────────────────────────────────────────────── */

const BOILER_OPTIONS = [
  { value: "NONE", label: "No incluye" },
  { value: "DEP_GAS", label: "Depósito gas" },
  { value: "DEP_ELEC", label: "Depósito eléctrico" },
  { value: "DEP_SOLAR", label: "Depósito solar" },
  { value: "PASO_GAS", label: "Paso gas" },
  { value: "PASO_ELEC", label: "Paso eléctrico" },
];
const BOILER_CAP_OPTIONS = [
  { value: "40L", label: "40L" }, { value: "60L", label: "60L" },
  { value: "80L", label: "80L" }, { value: "100L+", label: "100L+" },
];
const BOILER_NAME: Record<string, string> = {
  DEP_GAS: "Boiler depósito gas", DEP_ELEC: "Boiler depósito eléctrico",
  DEP_SOLAR: "Boiler depósito solar", PASO_GAS: "Boiler de paso gas", PASO_ELEC: "Boiler de paso eléctrico",
};
const IS_DEP  = (b: string) => ["DEP_GAS", "DEP_ELEC", "DEP_SOLAR"].includes(b);
const IS_PASO = (b: string) => ["PASO_GAS", "PASO_ELEC"].includes(b);

const SHOWER_OPTIONS = [
  { value: "NONE",     label: "No incluye" },
  { value: "NORMAL",   label: "Normal"     },
  { value: "ELECTRIC", label: "Eléctrica"  },
  { value: "RAIN",     label: "Lluvia"     },
];
const SHOWER_LABEL: Record<string, string> = {
  NORMAL: "Regadera normal", ELECTRIC: "Regadera eléctrica", RAIN: "Regadera lluvia",
};

/* ─── Asset-row generator ────────────────────────────────────────────── */

type AssetRow = { asset_type: string; name: string; status: string; notes: string | null; sort_order: number };

function capLabel(c: string) {
  if (c === "1_5T") return "1.5 ton";
  if (c === "2T") return "2 ton";
  if (c === "3T") return "3 ton";
  if (c === "5T") return "5 ton";
  return "1 ton";
}

function getCentralSpaces(s2: Step2, eq: Equipment): string[] {
  const out: string[] = [];
  for (let i = 0; i < s2.bedrooms; i++) {
    if (acTypeOf(eq.bedrooms[i]?.ac ?? "NONE") === "CENTRAL")
      out.push(s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara");
  }
  if (s2.hasCuartoServicio && acTypeOf(eq.cuartoServicio.ac) === "CENTRAL") out.push("Cuarto de servicio");
  if (s2.hasSala && acTypeOf(eq.sala.ac) === "CENTRAL") out.push("Sala");
  if (s2.hasCocina && acTypeOf(eq.cocina.ac) === "CENTRAL") out.push("Cocina");
  if (s2.hasComedor && acTypeOf(eq.comedor.ac) === "CENTRAL") out.push("Comedor");
  return out;
}

function buildAssetRows(s2: Step2, eq: Equipment): AssetRow[] {
  const rows: AssetRow[] = [];
  let idx = 0;
  function add(asset_type: string, name: string) {
    rows.push({ asset_type, name, status: "ACTIVE", notes: null, sort_order: idx++ });
  }
  function addBoiler(boiler: string, boilerCapacity: string, boilerCount: number, boilerServices: string, sfx: string) {
    if (boiler === "NONE") return;
    const n = BOILER_NAME[boiler] ?? boiler;
    const cap = IS_DEP(boiler) ? ` ${boilerCapacity}` : "";
    const cnt = IS_DEP(boiler) && boilerCount > 1 ? ` × ${boilerCount}` : "";
    const svc = IS_PASO(boiler) && boilerServices !== "1" ? ` ${boilerServices} salidas` : "";
    add("BOILER", `${n}${cap}${cnt}${svc}${sfx}`);
  }
  function addAC(ac: string, sfx: string) {
    const t = acTypeOf(ac);
    if (t === "NONE" || t === "CENTRAL") return;
    const c = acCapOf(ac);
    const capStr = capLabel(c);
    if (t === "MINI") add("MINISPLIT", `Minisplit ${capStr}${sfx}`);
    else add("OTHER", `Fan & coil ${capStr}${sfx}`);
  }
  function addBedBath(b: BedroomEq, sfx: string) {
    if (!b.hasOwnBath) return;
    add("OTHER", `Baño privado${sfx}`);
    if (b.shower !== "NONE" && SHOWER_LABEL[b.shower]) add("OTHER", `${SHOWER_LABEL[b.shower]}${sfx}`);
    if (b.hasTub) add("OTHER", `Tina${sfx}`);
    if (b.hasJacuzzi) add("OTHER", `Jacuzzi${sfx}`);
  }

  // Recámaras
  for (let i = 0; i < s2.bedrooms; i++) {
    const b = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
    const sfx = s2.bedrooms > 1 ? ` - Recámara ${i + 1}` : " - Recámara";
    addBedBath(b, sfx);
    addAC(b.ac, sfx);
    if (b.fan === "YES") add("FAN", `Ventilador de techo${sfx}`);
    if (b.heater !== "NONE") add("OTHER", `Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}${sfx}`);
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king" };
    if (b.bed !== "NONE" && bedMap[b.bed]) add("OTHER", `${bedMap[b.bed]}${sfx}`);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) add("OTHER", `${closetMap[b.closet]}${sfx}`);
    if (b.tv === "YES") add("OTHER", `Televisión${sfx}`);
    for (const f of b.furnitureOther) add("OTHER", `${f}${sfx}`);
  }

  // Cuarto de servicio
  if (s2.hasCuartoServicio) {
    const b = eq.cuartoServicio;
    const sfx = " - Cuarto de servicio";
    addBedBath(b, sfx);
    addAC(b.ac, sfx);
    if (b.fan === "YES") add("FAN", `Ventilador de techo${sfx}`);
    if (b.heater !== "NONE") add("OTHER", `Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}${sfx}`);
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king" };
    if (b.bed !== "NONE" && bedMap[b.bed]) add("OTHER", `${bedMap[b.bed]}${sfx}`);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) add("OTHER", `${closetMap[b.closet]}${sfx}`);
    if (b.tv === "YES") add("OTHER", `Televisión${sfx}`);
    for (const f of b.furnitureOther) add("OTHER", `${f}${sfx}`);
  }

  // Sala
  if (s2.hasSala) {
    addAC(eq.sala.ac, " - Sala");
    if (eq.sala.fan === "YES") add("FAN", "Ventilador de techo - Sala");
    const furMap: Record<string, string> = { SALA: "Juego de sala", TV: "Televisión - Sala", MESA_CENTRO: "Mesa de centro - Sala" };
    for (const f of eq.sala.furniture) if (furMap[f]) add("OTHER", furMap[f]);
    for (const f of eq.sala.furnitureOther) add("OTHER", `${f} - Sala`);
    if (eq.sala.guestBath !== "NONE") {
      add("OTHER", eq.sala.guestBath === "FULL" ? "Baño de visitas completo - Sala" : "Medio baño de visitas - Sala");
      if (eq.sala.guestBath === "FULL" && eq.sala.guestBathShower !== "NONE" && SHOWER_LABEL[eq.sala.guestBathShower]) {
        add("OTHER", `${SHOWER_LABEL[eq.sala.guestBathShower]} - Sala`);
      }
    }
  }

  // Cocina
  if (s2.hasCocina) {
    addAC(eq.cocina.ac, " - Cocina");
    const t = eq.cocina.stoveType; const b = eq.cocina.stoveBurners;
    if (t === "GAS") add("STOVE", `Estufa gas ${b === "2Q" ? "2" : b === "4Q" ? "4" : "6"} quemadores`);
    else if (t === "ELECTRIC") add("STOVE", `Estufa eléctrica ${b === "2Q" ? "2" : b === "4Q" ? "4" : "6"} quemadores`);
    else if (t === "INDUCTION") add("STOVE", b === "ZONAS" ? "Inducción zonas completas" : `Inducción ${b === "2" ? "2" : "4"} quemadores`);
    if (eq.cocina.oven !== "NONE") add("OTHER", `Horno ${eq.cocina.oven === "GAS" ? "gas" : "eléctrico"}`);
    if (eq.cocina.fridge !== "NONE") {
      const base = eq.cocina.fridge === "FRIDGE" ? "Refrigerador" : "Frigobar";
      add("FRIDGE", eq.cocina.fridgeModel ? `${base} - ${eq.cocina.fridgeModel}` : base);
    }
    const othMap: Record<string, string> = { MICROWAVE: "Microondas", DISHWASHER: "Lavavajillas", EXTRACTOR: "Campana extractora" };
    for (const o of eq.cocina.others) if (othMap[o]) add("OTHER", othMap[o]);
    if (eq.cocina.hasHalfBath) add("OTHER", "Medio baño - Cocina");
  }

  // Lavandería
  if (s2.hasLavanderia) {
    if (!s2.hasCuartoMaquinas) addBoiler(eq.lavanderia.boiler, eq.lavanderia.boilerCapacity, eq.lavanderia.boilerCount, eq.lavanderia.boilerServices, " - Lavandería");
    if (eq.lavanderia.centroCarga === "YES") add("OTHER", "Centro de lavado vertical - Lavandería");
    else {
      if (eq.lavanderia.washer === "YES") add("WASHER", "Lavadora - Lavandería");
      if (eq.lavanderia.dryer !== "NONE") add("DRYER", `Secadora ${eq.lavanderia.dryer === "GAS" ? "gas" : "eléctrica"} - Lavandería`);
    }
  }

  // Cuarto de máquinas
  if (s2.hasCuartoMaquinas) {
    addBoiler(eq.cuartoMaquinas.boiler, eq.cuartoMaquinas.boilerCapacity, eq.cuartoMaquinas.boilerCount, eq.cuartoMaquinas.boilerServices, " - Cuarto de máquinas");
  }

  // Equipos funcionales (solo si no hay Lavandería ni Cuarto de máquinas)
  if (!s2.hasLavanderia && !s2.hasCuartoMaquinas) {
    const f = eq.equiposFuncionales;
    addBoiler(f.boiler, f.boilerCapacity, f.boilerCount, f.boilerServices, "");
    if (f.centroCarga === "YES") add("OTHER", "Centro de lavado vertical");
    else {
      if (f.washer === "YES") add("WASHER", "Lavadora");
      if (f.dryer !== "NONE") add("DRYER", `Secadora ${f.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
  }

  // Comedor
  if (s2.hasComedor) {
    addAC(eq.comedor.ac, " - Comedor");
    const fMap: Record<string, string> = { COMEDOR_COMPLETO: "Comedor completo", SOLO_MESA: "Mesa de comedor", MESA_SILLAS: "Mesa con sillas" };
    if (eq.comedor.furniture !== "NONE" && fMap[eq.comedor.furniture]) add("OTHER", fMap[eq.comedor.furniture]);
  }

  // Sistema de aire central (one system asset)
  const centralSpaces = getCentralSpaces(s2, eq);
  if (centralSpaces.length > 0) {
    add("OTHER", `Sistema de aire central ${eq.aireCentral.capacity} ton`);
  }

  return rows;
}

/* ─── Summary group builder ──────────────────────────────────────────── */

type SummaryGroup = { key: string; label: string; Icon: React.ElementType; items: string[] };

function buildSummaryGroups(s2: Step2, eq: Equipment): SummaryGroup[] {
  const groups: SummaryGroup[] = [];

  // Bedrooms
  for (let i = 0; i < s2.bedrooms; i++) {
    const b = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
    const items: string[] = [];
    if (b.hasOwnBath) {
      items.push("Baño privado");
      if (b.shower !== "NONE" && SHOWER_LABEL[b.shower]) items.push(SHOWER_LABEL[b.shower]);
      if (b.hasTub) items.push("Tina");
      if (b.hasJacuzzi) items.push("Jacuzzi");
    }
    const t = acTypeOf(b.ac);
    if (t === "MINI" || t === "FAN_COIL") {
      items.push(`${t === "MINI" ? "Minisplit" : "Fan & coil"} ${capLabel(acCapOf(b.ac))}`);
    } else if (t === "CENTRAL") {
      items.push("Aire central (sistema)");
    }
    if (b.fan === "YES") items.push("Ventilador de techo");
    if (b.heater !== "NONE") items.push(`Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}`);
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king" };
    if (b.bed !== "NONE" && bedMap[b.bed]) items.push(bedMap[b.bed]);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) items.push(closetMap[b.closet]);
    if (b.tv === "YES") items.push("Televisión");
    for (const f of b.furnitureOther) items.push(f);
    groups.push({ key: `bed-${i}`, label: s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara", Icon: BedDouble, items });
  }

  // Cuarto de servicio
  if (s2.hasCuartoServicio) {
    const b = eq.cuartoServicio;
    const items: string[] = [];
    if (b.hasOwnBath) {
      items.push("Baño privado");
      if (b.shower !== "NONE" && SHOWER_LABEL[b.shower]) items.push(SHOWER_LABEL[b.shower]);
      if (b.hasTub) items.push("Tina");
      if (b.hasJacuzzi) items.push("Jacuzzi");
    }
    const t = acTypeOf(b.ac);
    if (t === "MINI" || t === "FAN_COIL") items.push(`${t === "MINI" ? "Minisplit" : "Fan & coil"} ${capLabel(acCapOf(b.ac))}`);
    else if (t === "CENTRAL") items.push("Aire central (sistema)");
    if (b.fan === "YES") items.push("Ventilador de techo");
    if (b.heater !== "NONE") items.push(`Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}`);
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king" };
    if (b.bed !== "NONE" && bedMap[b.bed]) items.push(bedMap[b.bed]);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) items.push(closetMap[b.closet]);
    if (b.tv === "YES") items.push("Televisión");
    for (const f of b.furnitureOther) items.push(f);
    groups.push({ key: "cuartoServicio", label: "Cuarto de servicio", Icon: BedDouble, items });
  }

  // Sala
  if (s2.hasSala) {
    const items: string[] = [];
    const t = acTypeOf(eq.sala.ac);
    if (t === "MINI" || t === "FAN_COIL") items.push(`${t === "MINI" ? "Minisplit" : "Fan & coil"} ${capLabel(acCapOf(eq.sala.ac))}`);
    else if (t === "CENTRAL") items.push("Aire central (sistema)");
    if (eq.sala.fan === "YES") items.push("Ventilador de techo");
    const furMap: Record<string, string> = { SALA: "Juego de sala", TV: "Televisión", MESA_CENTRO: "Mesa de centro" };
    for (const f of eq.sala.furniture) if (furMap[f]) items.push(furMap[f]);
    for (const f of eq.sala.furnitureOther) items.push(f);
    if (eq.sala.guestBath !== "NONE") {
      items.push(eq.sala.guestBath === "FULL" ? "Baño de visitas completo" : "Medio baño de visitas");
      if (eq.sala.guestBath === "FULL" && eq.sala.guestBathShower !== "NONE" && SHOWER_LABEL[eq.sala.guestBathShower]) {
        items.push(SHOWER_LABEL[eq.sala.guestBathShower]);
      }
    }
    groups.push({ key: "sala", label: "Sala", Icon: Sofa, items });
  }

  // Cocina
  if (s2.hasCocina) {
    const items: string[] = [];
    const t = acTypeOf(eq.cocina.ac);
    if (t === "MINI" || t === "FAN_COIL") items.push(`${t === "MINI" ? "Minisplit" : "Fan & coil"} ${capLabel(acCapOf(eq.cocina.ac))}`);
    else if (t === "CENTRAL") items.push("Aire central (sistema)");
    const st = eq.cocina.stoveType; const sb = eq.cocina.stoveBurners;
    if (st === "GAS") items.push(`Estufa gas ${sb === "2Q" ? "2" : sb === "4Q" ? "4" : "6"} quemadores`);
    else if (st === "ELECTRIC") items.push(`Estufa eléctrica ${sb === "2Q" ? "2" : sb === "4Q" ? "4" : "6"} quemadores`);
    else if (st === "INDUCTION") items.push(sb === "ZONAS" ? "Inducción zonas completas" : `Inducción ${sb === "2" ? "2" : "4"} quemadores`);
    if (eq.cocina.oven !== "NONE") items.push(`Horno ${eq.cocina.oven === "GAS" ? "gas" : "eléctrico"}`);
    if (eq.cocina.fridge !== "NONE") {
      const base = eq.cocina.fridge === "FRIDGE" ? "Refrigerador" : "Frigobar";
      items.push(eq.cocina.fridgeModel ? `${base} (${eq.cocina.fridgeModel})` : base);
    }
    const othMap: Record<string, string> = { MICROWAVE: "Microondas", DISHWASHER: "Lavavajillas", EXTRACTOR: "Campana extractora" };
    for (const o of eq.cocina.others) if (othMap[o]) items.push(othMap[o]);
    if (eq.cocina.hasHalfBath) items.push("Medio baño");
    groups.push({ key: "cocina", label: "Cocina", Icon: UtensilsCrossed, items });
  }

  // Lavandería
  if (s2.hasLavanderia) {
    const items: string[] = [];
    const l = eq.lavanderia;
    if (!s2.hasCuartoMaquinas && l.boiler !== "NONE") {
      const cap = IS_DEP(l.boiler) ? ` ${l.boilerCapacity}` : "";
      const cnt = IS_DEP(l.boiler) && l.boilerCount > 1 ? ` × ${l.boilerCount}` : "";
      const svc = IS_PASO(l.boiler) && l.boilerServices !== "1" ? ` ${l.boilerServices} salidas` : "";
      items.push(`${BOILER_NAME[l.boiler] ?? l.boiler}${cap}${cnt}${svc}`);
    }
    if (l.centroCarga === "YES") items.push("Centro de lavado vertical");
    else {
      if (l.washer === "YES") items.push("Lavadora");
      if (l.dryer !== "NONE") items.push(`Secadora ${l.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
    groups.push({ key: "lavanderia", label: "Lavandería", Icon: Shirt, items });
  }

  // Cuarto de máquinas
  if (s2.hasCuartoMaquinas) {
    const items: string[] = [];
    const m = eq.cuartoMaquinas;
    if (m.boiler !== "NONE") {
      const cap = IS_DEP(m.boiler) ? ` ${m.boilerCapacity}` : "";
      const cnt = IS_DEP(m.boiler) && m.boilerCount > 1 ? ` × ${m.boilerCount}` : "";
      const svc = IS_PASO(m.boiler) && m.boilerServices !== "1" ? ` ${m.boilerServices} salidas` : "";
      items.push(`${BOILER_NAME[m.boiler] ?? m.boiler}${cap}${cnt}${svc}`);
    }
    groups.push({ key: "cuartoMaquinas", label: "Cuarto de máquinas", Icon: Wrench, items });
  }

  // Equipos funcionales
  if (!s2.hasLavanderia && !s2.hasCuartoMaquinas) {
    const items: string[] = [];
    const f = eq.equiposFuncionales;
    if (f.boiler !== "NONE") {
      const cap = IS_DEP(f.boiler) ? ` ${f.boilerCapacity}` : "";
      const cnt = IS_DEP(f.boiler) && f.boilerCount > 1 ? ` × ${f.boilerCount}` : "";
      const svc = IS_PASO(f.boiler) && f.boilerServices !== "1" ? ` ${f.boilerServices} salidas` : "";
      items.push(`${BOILER_NAME[f.boiler] ?? f.boiler}${cap}${cnt}${svc}`);
    }
    if (f.centroCarga === "YES") items.push("Centro de lavado vertical");
    else {
      if (f.washer === "YES") items.push("Lavadora");
      if (f.dryer !== "NONE") items.push(`Secadora ${f.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
    if (items.length > 0) groups.push({ key: "funcionales", label: "Equipos funcionales", Icon: Wrench, items });
  }

  // Comedor
  if (s2.hasComedor) {
    const items: string[] = [];
    const t = acTypeOf(eq.comedor.ac);
    if (t === "MINI" || t === "FAN_COIL") items.push(`${t === "MINI" ? "Minisplit" : "Fan & coil"} ${capLabel(acCapOf(eq.comedor.ac))}`);
    else if (t === "CENTRAL") items.push("Aire central (sistema)");
    const fMap: Record<string, string> = { COMEDOR_COMPLETO: "Comedor completo", SOLO_MESA: "Mesa de comedor", MESA_SILLAS: "Mesa con sillas" };
    if (eq.comedor.furniture !== "NONE" && fMap[eq.comedor.furniture]) items.push(fMap[eq.comedor.furniture]);
    groups.push({ key: "comedor", label: "Comedor", Icon: UtensilsCrossed, items });
  }

  // Aire central system
  const centralSpaces = getCentralSpaces(s2, eq);
  if (centralSpaces.length > 0) {
    groups.push({
      key: "aireCentral",
      label: "Sistema de aire central",
      Icon: Wind,
      items: [
        `Espacios: ${centralSpaces.join(", ")}`,
        `Tonelaje: ${eq.aireCentral.capacity} ton`,
      ],
    });
  }

  return groups;
}

/* ─── Step indicator ─────────────────────────────────────────────────── */

function StepIndicator({ step }: { step: number }) {
  const labels = ["Información", "Espacios", "Equipamiento", "Resumen"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {labels.map((label, i) => {
        const n = i + 1; const done = step > n; const active = step === n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", flex: i < labels.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: (done || active) ? ACCENT : "var(--bg-input)", color: (done || active) ? "#fff" : "var(--text-muted)", flexShrink: 0 }}>
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
  const [step, setStep]           = useState(1);
  const [stepDir, setStepDir]     = useState<"left" | "right">("right");
  const [s1, setS1]               = useState<Step1>({ ...S1 });
  const [s2, setS2]               = useState<Step2>({ ...S2 });
  const [eq, setEq]               = useState<Equipment>(JSON.parse(JSON.stringify(DEFAULT_EQ)) as Equipment);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [saving, setSaving]       = useState(false);
  const [s1Error, setS1Error]     = useState("");
  const [customSpaceInput, setCustomSpaceInput] = useState("");
  const [showCustomInput, setShowCustomInput]   = useState(false);
  const [visitedSpaces, setVisitedSpaces]       = useState<Set<string>>(new Set());

  const STEP_TITLES = ["Nueva tipología — Información", "Nueva tipología — Espacios", "Nueva tipología — Equipamiento", "Nueva tipología — Resumen"];

  const STEP_INPUT: React.CSSProperties = {
    width: "100%", padding: 10, border: "1px solid var(--border-default)",
    borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  function reset() {
    setStep(1); setS1({ ...S1 }); setS2({ ...S2 });
    setEq(JSON.parse(JSON.stringify(DEFAULT_EQ)) as Equipment);
    setSelectedSpace(""); setSaving(false); setS1Error("");
    setCustomSpaceInput(""); setShowCustomInput(false); setVisitedSpaces(new Set());
  }

  function handleClose() { reset(); onClose(); }

  function syncBedroomArray(newS2: Step2): Equipment {
    const prev = eq.bedrooms;
    const arr: BedroomEq[] = Array.from({ length: newS2.bedrooms }, (_, i) => prev[i] ?? { ...DEFAULT_BEDROOM_EQ });
    return { ...eq, bedrooms: arr };
  }

  function goNext() {
    if (step === 1) {
      if (!s1.name.trim()) { setS1Error("El nombre de la tipología es obligatorio."); return; }
      setS1Error(""); setStepDir("right"); setStep(2);
    } else if (step === 2) {
      setEq(syncBedroomArray(s2)); setStepDir("right"); setStep(3);
    } else if (step === 3) {
      setStepDir("right"); setStep(4);
    }
  }
  function goBack() { setStepDir("left"); setStep((p) => Math.max(1, p - 1)); }

  function toggleSpace(key: keyof Step2 & string) { setS2((p) => ({ ...p, [key]: !p[key] })); }
  function setCount(key: keyof Step2, val: number) { setS2((p) => ({ ...p, [key]: val })); }

  function addCustomSpace() {
    const name = customSpaceInput.trim();
    if (!name) return;
    setS2((p) => ({ ...p, customSpaces: [...p.customSpaces, name] }));
    setCustomSpaceInput("");
  }
  function removeCustomSpace(idx: number) {
    setS2((p) => ({ ...p, customSpaces: p.customSpaces.filter((_, i) => i !== idx) }));
  }

  function setBedEq<K extends keyof BedroomEq>(i: number, key: K, val: BedroomEq[K]) {
    setEq((prev) => { const arr = [...prev.bedrooms]; arr[i] = { ...arr[i]!, [key]: val }; return { ...prev, bedrooms: arr }; });
  }
  function setCuartoServ<K extends keyof BedroomEq>(key: K, val: BedroomEq[K]) {
    setEq((prev) => ({ ...prev, cuartoServicio: { ...prev.cuartoServicio, [key]: val } }));
  }
  function setSala<K extends keyof SalaEq>(key: K, val: SalaEq[K]) {
    setEq((prev) => ({ ...prev, sala: { ...prev.sala, [key]: val } }));
  }
  function setCocina<K extends keyof CocinaEq>(key: K, val: CocinaEq[K]) {
    setEq((prev) => ({ ...prev, cocina: { ...prev.cocina, [key]: val } }));
  }
  function setLav<K extends keyof LavanderiaEq>(key: K, val: LavanderiaEq[K]) {
    setEq((prev) => ({ ...prev, lavanderia: { ...prev.lavanderia, [key]: val } }));
  }
  function setCuartoMaq<K extends keyof CuartoMaquinasEq>(key: K, val: CuartoMaquinasEq[K]) {
    setEq((prev) => ({ ...prev, cuartoMaquinas: { ...prev.cuartoMaquinas, [key]: val } }));
  }
  function setFuncionales<K extends keyof EquiposFuncionalesEq>(key: K, val: EquiposFuncionalesEq[K]) {
    setEq((prev) => ({ ...prev, equiposFuncionales: { ...prev.equiposFuncionales, [key]: val } }));
  }
  function setAireCentralEq<K extends keyof AireCentralEq>(key: K, val: AireCentralEq[K]) {
    setEq((prev) => ({ ...prev, aireCentral: { ...prev.aireCentral, [key]: val } }));
  }
  function setComedor<K extends keyof ComadorEq>(key: K, val: ComadorEq[K]) {
    setEq((prev) => ({ ...prev, comedor: { ...prev.comedor, [key]: val } }));
  }

  /* ── Create ── */
  async function handleCreate() {
    if (!buildingId) return;
    setSaving(true);
    const showFuncionales = !s2.hasLavanderia && !s2.hasCuartoMaquinas;
    const hasWasher =
      (s2.hasLavanderia && (eq.lavanderia.centroCarga === "YES" || eq.lavanderia.washer === "YES")) ||
      (showFuncionales && (eq.equiposFuncionales.centroCarga === "YES" || eq.equiposFuncionales.washer === "YES"));
    const hasDryer =
      (s2.hasLavanderia && eq.lavanderia.centroCarga !== "YES" && eq.lavanderia.dryer !== "NONE") ||
      (showFuncionales && eq.equiposFuncionales.centroCarga !== "YES" && eq.equiposFuncionales.dryer !== "NONE");
    const stoveType = eq.cocina.stoveType === "GAS" ? "GAS" : eq.cocina.stoveType === "ELECTRIC" ? "ELECTRIC" : eq.cocina.stoveType === "INDUCTION" ? "ELECTRIC" : "NONE";
    const bathroomsComplete = computeBathroomsComplete(s2, eq);

    const payload = {
      building_id: buildingId, company_id: companyId,
      name: s1.name.trim(), bedrooms: s2.bedrooms, bathrooms: bathroomsComplete,
      has_living_room: s2.hasSala, has_dining_room: s2.hasComedor, has_patio: s2.hasPatio,
      has_fridge: eq.cocina.fridge !== "NONE", has_washer: hasWasher, has_dryer: hasDryer,
      stove_type: stoveType,
    };
    const { data: inserted, error } = await supabase.from("unit_types").insert(payload).select("id").single();
    if (error || !inserted) { toast.error(error?.message ?? "Error creando tipología"); setSaving(false); return; }
    const assetRows = buildAssetRows(s2, eq);
    if (assetRows.length > 0) {
      await supabase.from("unit_type_assets").insert(assetRows.map((r) => ({ ...r, unit_type_id: inserted.id })));
    }
    toast.success("Tipología creada con equipamiento");
    reset(); onSuccess(); onClose();
  }

  function eqRow(label: string, children: React.ReactNode) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
        {children}
      </div>
    );
  }

  /* ── Boiler rows helper ── */
  function boilerRows(
    boiler: string, boilerCapacity: string, boilerCount: number, boilerServices: string,
    onBoiler: (v: string) => void, onCapacity: (v: string) => void, onCount: (v: number) => void,
    onServices: (v: string) => void
  ) {
    return (
      <>
        {eqRow("Boiler", (
          <div style={{ display: "grid", gap: 8 }}>
            <Radio value={boiler} onChange={onBoiler} options={BOILER_OPTIONS} />
            <Expand show={IS_DEP(boiler)} id="boiler-dep">
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Capacidad</div>
                <Radio value={boilerCapacity} onChange={onCapacity} options={BOILER_CAP_OPTIONS} />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Cantidad</div>
                <Radio value={String(boilerCount)} onChange={(v) => onCount(Number(v))} options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} />
              </div>
            </Expand>
            <Expand show={IS_PASO(boiler)} id="boiler-svc">
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Servicios (salidas de agua caliente)</div>
                <Radio value={boilerServices} onChange={onServices} options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4+", label: "4+" }]} />
              </div>
            </Expand>
          </div>
        ))}
      </>
    );
  }

  /* ── Bath section reusable (for bedrooms + cuarto servicio) ── */
  function bedBathRows(
    bEq: BedroomEq,
    onHasOwnBath: (v: boolean) => void,
    onShower: (v: string) => void,
    onHasTub: (v: boolean) => void,
    onHasJacuzzi: (v: boolean) => void,
  ) {
    return eqRow("Baño propio", (
      <div style={{ display: "grid", gap: 8 }}>
        <Radio value={bEq.hasOwnBath ? "YES" : "NO"} onChange={(v) => onHasOwnBath(v === "YES")}
          options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
        <Expand show={bEq.hasOwnBath} id="bath-details">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Regadera</div>
              <Radio value={bEq.shower !== "NONE" ? "YES" : "NO"}
                onChange={(v) => onShower(v === "YES" ? "NORMAL" : "NONE")}
                options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Tina</div>
              <Radio value={bEq.hasTub ? "YES" : "NO"} onChange={(v) => onHasTub(v === "YES")}
                options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Jacuzzi</div>
              <Radio value={bEq.hasJacuzzi ? "YES" : "NO"} onChange={(v) => onHasJacuzzi(v === "YES")}
                options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
            </div>
          </div>
        </Expand>
      </div>
    ));
  }

  /* ── Counts ── */
  function bedroomCount(b: BedroomEq) {
    return (b.hasOwnBath ? 1 : 0)
      + (b.ac !== "NONE" ? 1 : 0) + (b.fan === "YES" ? 1 : 0) + (b.heater !== "NONE" ? 1 : 0)
      + (b.bed !== "NONE" ? 1 : 0) + (b.closet !== "NONE" ? 1 : 0) + (b.tv === "YES" ? 1 : 0)
      + b.furnitureOther.length;
  }
  function salaCount(s: SalaEq) {
    return (s.ac !== "NONE" ? 1 : 0) + (s.fan === "YES" ? 1 : 0) + s.furniture.length + s.furnitureOther.length
      + (s.guestBath !== "NONE" ? 1 : 0);
  }
  function cocinaCount(c: CocinaEq) {
    return (c.ac !== "NONE" ? 1 : 0) + (c.stoveType !== "NONE" ? 1 : 0) + (c.oven !== "NONE" ? 1 : 0) + (c.fridge !== "NONE" ? 1 : 0) + c.others.length
      + (c.hasHalfBath ? 1 : 0);
  }
  function lavanderiaCount(l: LavanderiaEq) {
    return (l.boiler !== "NONE" ? 1 : 0) + (l.centroCarga === "YES" ? 1 : (l.washer === "YES" ? 1 : 0) + (l.dryer !== "NONE" ? 1 : 0));
  }
  function cuartoMaquinasCount(m: CuartoMaquinasEq) {
    return m.boiler !== "NONE" ? 1 : 0;
  }
  function funcionalesCount(f: EquiposFuncionalesEq) {
    return (f.boiler !== "NONE" ? 1 : 0) + (f.centroCarga === "YES" ? 1 : (f.washer === "YES" ? 1 : 0) + (f.dryer !== "NONE" ? 1 : 0));
  }
  function comedorCount(c: ComadorEq) {
    return (c.ac !== "NONE" ? 1 : 0) + (c.furniture !== "NONE" ? 1 : 0);
  }

  const showFuncionales = !s2.hasLavanderia && !s2.hasCuartoMaquinas;
  const centralSpaces = getCentralSpaces(s2, eq);

  const panelSpaces: { key: string; label: string; headerLabel?: string; Icon: React.ElementType; count: number }[] = [
    ...Array.from({ length: s2.bedrooms }, (_, i) => ({
      key: `bed-${i}`,
      label: s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara",
      Icon: BedDouble,
      count: bedroomCount(eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ),
    })),
    ...(s2.hasCuartoServicio ? [{ key: "cuartoServicio", label: "Cuarto de servicio", Icon: BedDouble,       count: bedroomCount(eq.cuartoServicio)          }] : []),
    ...(s2.hasSala          ? [{ key: "sala",            label: "Sala",              Icon: Sofa,             count: salaCount(eq.sala)                      }] : []),
    ...(s2.hasCocina        ? [{ key: "cocina",          label: "Cocina",            Icon: UtensilsCrossed,  count: cocinaCount(eq.cocina)                  }] : []),
    ...(s2.hasComedor       ? [{ key: "comedor",         label: "Comedor",           Icon: UtensilsCrossed,  count: comedorCount(eq.comedor)                }] : []),
    ...(s2.hasLavanderia    ? [{ key: "lavanderia",      label: "Lavandería",        Icon: Shirt,            count: lavanderiaCount(eq.lavanderia)          }] : []),
    ...(s2.hasCuartoMaquinas ? [{ key: "cuartoMaquinas", label: "Cuarto de máquinas", Icon: Wrench,          count: cuartoMaquinasCount(eq.cuartoMaquinas) }] : []),
    ...(centralSpaces.length > 0 ? [{ key: "aireCentral", label: "Aire central", headerLabel: "Sistema de aire central", Icon: Wind, count: centralSpaces.length }] : []),
  ];
  const step3ActiveKey = panelSpaces.some(p => p.key === selectedSpace) ? selectedSpace : (panelSpaces[0]?.key ?? "");
  const step3ActiveIdx = panelSpaces.findIndex(p => p.key === step3ActiveKey);
  const step3IsLast    = panelSpaces.length === 0 || step3ActiveIdx === panelSpaces.length - 1;
  const step3NextSpace = panelSpaces[step3ActiveIdx + 1] ?? null;
  const step3PrevSpace = panelSpaces[step3ActiveIdx - 1] ?? null;

  const rightPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step3ActiveKey]);

  /* ── Space toggle button ── */
  function spaceToggle(key: string, label: string, Icon: React.ElementType) {
    const on = s2[key as keyof Step2] as boolean;
    return (
      <button key={key} type="button"
        onClick={() => toggleSpace(key as keyof Step2 & string)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 8px", borderRadius: 10, cursor: "pointer", border: on ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)", background: on ? "#f9eaf3" : "var(--bg-card)", color: on ? ACCENT : "var(--text-secondary)" }}>
        <Icon size={18} />
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      </button>
    );
  }

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <Modal open={open} title={STEP_TITLES[step - 1] ?? ""} onClose={handleClose} maxWidth={780}>
      <StepIndicator step={step} />

      <AnimatePresence mode="wait">
        <motion.div key={step} variants={slideStep(stepDir)} initial="hidden" animate="show" exit="hidden" style={{ overflow: "hidden" }}>

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
          <AppFormField label="Superficie m²">
            <input value={s1.sqm} onChange={(e) => setS1((p) => ({ ...p, sqm: e.target.value }))} type="number" min={0} placeholder="Ej. 60" style={STEP_INPUT} />
          </AppFormField>
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
        <div style={{ display: "grid", gap: 20 }}>

          {/* PRIVADOS */}
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Privados</p>
            <div style={{ display: "grid", gap: 10 }}>
              <Counter label="Recámaras" value={s2.bedrooms} onChange={(v) => setCount("bedrooms", v)} min={0} max={10} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                {PRIVADOS_SPACES.map(({ key, label, Icon }) => spaceToggle(key, label, Icon))}
              </div>
            </div>
          </div>

          {/* SOCIALES */}
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sociales</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {SOCIALES_SPACES.map(({ key, label, Icon }) => spaceToggle(key, label, Icon))}
            </div>
          </div>

          {/* SERVICIO */}
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Servicio</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {SERVICIO_SPACES.map(({ key, label, Icon }) => spaceToggle(key, label, Icon))}
              {/* Otro */}
              <button type="button"
                onClick={() => setShowCustomInput((v) => !v)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 8px", borderRadius: 10, cursor: "pointer", border: (showCustomInput || s2.customSpaces.length > 0) ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)", background: (showCustomInput || s2.customSpaces.length > 0) ? "#f9eaf3" : "var(--bg-card)", color: (showCustomInput || s2.customSpaces.length > 0) ? ACCENT : "var(--text-secondary)" }}>
                <Plus size={18} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>Otro</span>
              </button>
            </div>

            {showCustomInput && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <input
                  value={customSpaceInput}
                  onChange={(e) => setCustomSpaceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSpace(); } }}
                  placeholder="Ej. Estudio, Terraza privada..."
                  style={{ ...STEP_INPUT, flex: 1, fontSize: 13 }}
                />
                <button type="button" onClick={addCustomSpace}
                  style={{ padding: "0 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Agregar
                </button>
              </div>
            )}

            {s2.customSpaces.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {s2.customSpaces.map((cs, idx) => (
                  <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#f9eaf3", color: ACCENT }}>
                    {cs}
                    <button type="button" onClick={() => removeCustomSpace(idx)}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: ACCENT, display: "flex", alignItems: "center" }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 3: Equipamiento ── */}
      {step === 3 && (() => {
        const activeKey = step3ActiveKey;
        const activeSpace = panelSpaces.find(p => p.key === activeKey);

        function spaceContent(key: string): React.ReactNode {
          const bedMatch = key.match(/^bed-(\d+)$/);
          if (bedMatch) {
            const i = parseInt(bedMatch[1]);
            const bEq = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
            return (
              <>
                {bedBathRows(bEq, (v) => setBedEq(i, "hasOwnBath", v), (v) => setBedEq(i, "shower", v), (v) => setBedEq(i, "hasTub", v), (v) => setBedEq(i, "hasJacuzzi", v))}
                {eqRow("Aire acondicionado", <AcSection value={bEq.ac} onChange={(v) => setBedEq(i, "ac", v)} />)}
                {eqRow("Ventilador de techo", <Radio value={bEq.fan} onChange={(v) => setBedEq(i, "fan", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                {eqRow("Calefactor", <IncludeToggle included={bEq.heater !== "NONE"} onExclude={() => setBedEq(i, "heater", "NONE")} onInclude={() => setBedEq(i, "heater", "GAS")}>
                  <Radio value={bEq.heater} onChange={(v) => setBedEq(i, "heater", v)} options={[{ value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrico" }]} />
                </IncludeToggle>)}
                {eqRow("Cama", <Radio value={bEq.bed} onChange={(v) => setBedEq(i, "bed", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "INDIVIDUAL", label: "Individual" }, { value: "MATRIMONIAL", label: "Matrimonial" }, { value: "QUEEN", label: "Queen" }, { value: "KING", label: "King" }]} />)}
                {eqRow("Closet", <Radio value={bEq.closet} onChange={(v) => setBedEq(i, "closet", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "ARMARIO", label: "Armario" }, { value: "CLOSET", label: "Closet" }, { value: "WALK_IN", label: "Walk-in closet" }]} />)}
                {eqRow("Televisión", <Radio value={bEq.tv} onChange={(v) => setBedEq(i, "tv", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                {eqRow("Otro mobiliario", <PillsInput value={bEq.furnitureOther} onChange={(v) => setBedEq(i, "furnitureOther", v)} placeholder="Ej. Escritorio, Buró..." />)}
              </>
            );
          }
          if (key === "cuartoServicio") {
            const b = eq.cuartoServicio;
            return (
              <>
                {bedBathRows(b, (v) => setCuartoServ("hasOwnBath", v), (v) => setCuartoServ("shower", v), (v) => setCuartoServ("hasTub", v), (v) => setCuartoServ("hasJacuzzi", v))}
                {eqRow("Aire acondicionado", <AcSection value={b.ac} onChange={(v) => setCuartoServ("ac", v)} />)}
                {eqRow("Ventilador de techo", <Radio value={b.fan} onChange={(v) => setCuartoServ("fan", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                {eqRow("Calefactor", <IncludeToggle included={b.heater !== "NONE"} onExclude={() => setCuartoServ("heater", "NONE")} onInclude={() => setCuartoServ("heater", "GAS")}>
                  <Radio value={b.heater} onChange={(v) => setCuartoServ("heater", v)} options={[{ value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrico" }]} />
                </IncludeToggle>)}
                {eqRow("Cama", <Radio value={b.bed} onChange={(v) => setCuartoServ("bed", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "INDIVIDUAL", label: "Individual" }, { value: "MATRIMONIAL", label: "Matrimonial" }, { value: "QUEEN", label: "Queen" }, { value: "KING", label: "King" }]} />)}
                {eqRow("Closet", <Radio value={b.closet} onChange={(v) => setCuartoServ("closet", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "ARMARIO", label: "Armario" }, { value: "CLOSET", label: "Closet" }, { value: "WALK_IN", label: "Walk-in closet" }]} />)}
                {eqRow("Televisión", <Radio value={b.tv} onChange={(v) => setCuartoServ("tv", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                {eqRow("Otro mobiliario", <PillsInput value={b.furnitureOther} onChange={(v) => setCuartoServ("furnitureOther", v)} placeholder="Ej. Escritorio, Buró..." />)}
              </>
            );
          }
          if (key === "sala") return (
            <>
              {eqRow("Aire acondicionado", <AcSection value={eq.sala.ac} onChange={(v) => setSala("ac", v)} />)}
              {eqRow("Ventilador de techo", <Radio value={eq.sala.fan} onChange={(v) => setSala("fan", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
              {eqRow("Mobiliario", <div style={{ display: "grid", gap: 8 }}>
                <Pills value={eq.sala.furniture} onChange={(v) => setSala("furniture", v)} options={[{ value: "SALA", label: "Juego de sala" }, { value: "TV", label: "Televisión" }, { value: "MESA_CENTRO", label: "Mesa de centro" }]} />
                <PillsInput value={eq.sala.furnitureOther} onChange={(v) => setSala("furnitureOther", v)} placeholder="Otro mobiliario..." />
              </div>)}
              {eqRow("Baño de visitas", <div style={{ display: "grid", gap: 8 }}>
                <Radio value={eq.sala.guestBath} onChange={(v) => { setSala("guestBath", v); if (v !== "FULL") setSala("guestBathShower", "NONE"); }} options={[{ value: "NONE", label: "No incluye" }, { value: "HALF", label: "Medio baño" }, { value: "FULL", label: "Baño completo" }]} />
                <Expand show={eq.sala.guestBath === "FULL"} id="guest-shower">
                  {eqRow("Regadera", <Radio value={eq.sala.guestBathShower} onChange={(v) => setSala("guestBathShower", v)} options={SHOWER_OPTIONS} />)}
                </Expand>
              </div>)}
            </>
          );
          if (key === "cocina") return (
            <>
              {eqRow("Aire acondicionado", <AcSection value={eq.cocina.ac} onChange={(v) => setCocina("ac", v)} />)}
              {eqRow("Estufa / parrilla", <IncludeToggle included={eq.cocina.stoveType !== "NONE"} onExclude={() => setCocina("stoveType", "NONE")} onInclude={() => setCocina("stoveType", "GAS")}>
                <div style={{ display: "grid", gap: 8 }}>
                  <Radio value={eq.cocina.stoveType} onChange={(v) => { setCocina("stoveType", v); if (v === "INDUCTION") setCocina("stoveBurners", "2"); else setCocina("stoveBurners", "4Q"); }} options={[{ value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }, { value: "INDUCTION", label: "Inducción" }]} />
                  <Expand show={eq.cocina.stoveType === "GAS" || eq.cocina.stoveType === "ELECTRIC"} id="burners-std">
                    <Radio value={eq.cocina.stoveBurners} onChange={(v) => setCocina("stoveBurners", v)} options={[{ value: "2Q", label: "2 quemadores" }, { value: "4Q", label: "4 quemadores" }, { value: "6Q", label: "6 quemadores" }]} />
                  </Expand>
                  <Expand show={eq.cocina.stoveType === "INDUCTION"} id="burners-ind">
                    <Radio value={eq.cocina.stoveBurners} onChange={(v) => setCocina("stoveBurners", v)} options={[{ value: "2", label: "2 quemadores" }, { value: "4", label: "4 quemadores" }, { value: "ZONAS", label: "Zonas completas" }]} />
                  </Expand>
                </div>
              </IncludeToggle>)}
              {eqRow("Horno", <Radio value={eq.cocina.oven} onChange={(v) => setCocina("oven", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrico" }]} />)}
              {eqRow("Refrigeración", <div style={{ display: "grid", gap: 8 }}>
                <Radio value={eq.cocina.fridge} onChange={(v) => setCocina("fridge", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "FRIDGE", label: "Refrigerador" }, { value: "FRIGOBAR", label: "Frigobar" }]} />
                <Expand show={eq.cocina.fridge !== "NONE"} id="fridge-model">
                  <input value={eq.cocina.fridgeModel} onChange={(e) => setCocina("fridgeModel", e.target.value)} placeholder="Modelo (opcional)" style={{ ...STEP_INPUT, fontSize: 12 }} />
                </Expand>
              </div>)}
              {eqRow("Electrodomésticos", <Pills value={eq.cocina.others} onChange={(v) => setCocina("others", v)} options={[{ value: "MICROWAVE", label: "Microondas" }, { value: "DISHWASHER", label: "Lavavajillas" }, { value: "EXTRACTOR", label: "Campana extractora" }]} />)}
              {eqRow("Medio baño", <Radio value={eq.cocina.hasHalfBath ? "YES" : "NO"} onChange={(v) => setCocina("hasHalfBath", v === "YES")} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
            </>
          );
          if (key === "comedor") return (
            <>
              {eqRow("Aire acondicionado", <AcSection value={eq.comedor.ac} onChange={(v) => setComedor("ac", v)} />)}
              {eqRow("Mobiliario", <Radio value={eq.comedor.furniture} onChange={(v) => setComedor("furniture", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "COMEDOR_COMPLETO", label: "Comedor completo" }, { value: "SOLO_MESA", label: "Solo mesa" }, { value: "MESA_SILLAS", label: "Mesa y sillas" }]} />)}
            </>
          );
          if (key === "lavanderia") return (
            <>
              {!s2.hasCuartoMaquinas && boilerRows(eq.lavanderia.boiler, eq.lavanderia.boilerCapacity, eq.lavanderia.boilerCount, eq.lavanderia.boilerServices, (v) => setLav("boiler", v), (v) => setLav("boilerCapacity", v), (v) => setLav("boilerCount", v), (v) => setLav("boilerServices", v))}
              {eqRow("Centro de lavado vertical", <Radio value={eq.lavanderia.centroCarga} onChange={(v) => setLav("centroCarga", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
              <Expand show={eq.lavanderia.centroCarga !== "YES"} id="washer-dryer">
                <>
                  {eqRow("Lavadora", <Radio value={eq.lavanderia.washer} onChange={(v) => setLav("washer", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                  {eqRow("Secadora", <Radio value={eq.lavanderia.dryer} onChange={(v) => setLav("dryer", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }]} />)}
                </>
              </Expand>
            </>
          );
          if (key === "cuartoMaquinas") return (
            <>{boilerRows(eq.cuartoMaquinas.boiler, eq.cuartoMaquinas.boilerCapacity, eq.cuartoMaquinas.boilerCount, eq.cuartoMaquinas.boilerServices, (v) => setCuartoMaq("boiler", v), (v) => setCuartoMaq("boilerCapacity", v), (v) => setCuartoMaq("boilerCount", v), (v) => setCuartoMaq("boilerServices", v))}</>
          );
          if (key === "aireCentral") return (
            <>
              {eqRow("Espacios cubiertos", (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {centralSpaces.map((sp) => (
                    <span key={sp} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#f9eaf3", color: ACCENT, border: `1px solid ${ACCENT}` }}>{sp}</span>
                  ))}
                </div>
              ))}
              {eqRow("Tonelaje del sistema (ton)", (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" min={1} max={50} step={0.5}
                    value={eq.aireCentral.capacity}
                    onChange={(e) => setAireCentralEq("capacity", e.target.value)}
                    placeholder="Ej. 7.5"
                    style={{ ...STEP_INPUT, width: 100 }} />
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>ton</span>
                </div>
              ))}
            </>
          );
          return null;
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Paneles izquierdo / derecho */}
            <div style={{ display: "flex", height: 560, border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>

              {/* Panel izquierdo */}
              <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border-default)", overflowY: "hidden", background: "var(--bg-page)" }}>
                {panelSpaces.map((sp) => {
                  const active = sp.key === activeKey;
                  const SpIcon = sp.Icon;
                  return (
                    <button key={sp.key} type="button" onClick={() => { setSelectedSpace(sp.key); setVisitedSpaces(prev => { const s = new Set(prev); s.add(sp.key); return s; }); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 8, width: "100%", padding: "7px 14px",
                        border: "none", borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
                        background: active ? "#FDF2F6" : "transparent",
                        cursor: "pointer", transition: "background 0.12s",
                        borderBottom: "1px solid var(--border-default)",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
                        <SpIcon size={15} color={active ? ACCENT : "var(--text-muted)"} />
                        <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? ACCENT : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sp.label}
                        </span>
                      </div>
                      {sp.count > 0 && (
                        <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 999, background: active ? `${ACCENT}18` : "var(--bg-input)", color: active ? ACCENT : "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>
                          {sp.count}
                        </span>
                      )}
                    </button>
                  );
                })}
                {panelSpaces.length === 0 && (
                  <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>Sin espacios configurados.</div>
                )}
              </div>

              {/* Panel derecho */}
              <div ref={rightPanelRef} className="no-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
                <AnimatePresence mode="wait">
                  {activeSpace ? (
                    <motion.div
                      key={activeKey}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px", borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
                        <activeSpace.Icon size={18} color={ACCENT} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{activeSpace.headerLabel ?? activeSpace.label}</span>
                        {activeSpace.count > 0 && (
                          <span style={{ padding: "2px 9px", borderRadius: 999, background: "#f9eaf3", color: ACCENT, fontSize: 11, fontWeight: 700 }}>
                            {activeKey === "aireCentral"
                              ? `${activeSpace.count} espacio${activeSpace.count !== 1 ? "s" : ""}`
                              : `${activeSpace.count} equipo${activeSpace.count !== 1 ? "s" : ""}`}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: "16px 20px" }}>{spaceContent(activeKey)}</div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ padding: 24, fontSize: 13, color: "var(--text-muted)" }}
                    >
                      Selecciona un espacio para configurar.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Equipos funcionales (debajo de los paneles) */}
            {showFuncionales && (
              <div style={{ border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Wrench size={15} color={ACCENT} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Equipos funcionales</span>
                  {funcionalesCount(eq.equiposFuncionales) > 0 && (
                    <span style={{ padding: "1px 8px", borderRadius: 999, background: "#f9eaf3", color: ACCENT, fontSize: 11, fontWeight: 700 }}>
                      {funcionalesCount(eq.equiposFuncionales)} equipo{funcionalesCount(eq.equiposFuncionales) !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {boilerRows(eq.equiposFuncionales.boiler, eq.equiposFuncionales.boilerCapacity, eq.equiposFuncionales.boilerCount, eq.equiposFuncionales.boilerServices, (v) => setFuncionales("boiler", v), (v) => setFuncionales("boilerCapacity", v), (v) => setFuncionales("boilerCount", v), (v) => setFuncionales("boilerServices", v))}
                {eqRow("Centro de lavado vertical", <Radio value={eq.equiposFuncionales.centroCarga} onChange={(v) => setFuncionales("centroCarga", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                {eq.equiposFuncionales.centroCarga !== "YES" && <>
                  {eqRow("Lavadora", <Radio value={eq.equiposFuncionales.washer} onChange={(v) => setFuncionales("washer", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                  {eqRow("Secadora", <Radio value={eq.equiposFuncionales.dryer} onChange={(v) => setFuncionales("dryer", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }]} />)}
                </>}
              </div>
            )}

          </div>
        );
      })()}

      {/* ── PASO 4: Resumen ── */}
      {step === 4 && (() => {
        const groups = buildSummaryGroups(s2, eq);
        const groupsWithEq = groups.filter((g) => g.items.length > 0);
        const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
        const bathroomsComplete = computeBathroomsComplete(s2, eq);
        const bathroomsHalf = computeBathroomsHalf(s2, eq);
        const noEqSpaces: string[] = [
          ...(s2.hasPatio ? ["Patio"] : []),
          ...(s2.hasCajon ? ["Cajón"] : []),
          ...(s2.hasBodega ? ["Bodega"] : []),
          ...(s2.hasTerraza ? ["Terraza"] : []),
          ...s2.customSpaces,
        ];
        const hasBadges = noEqSpaces.length > 0 || bathroomsComplete > 0 || bathroomsHalf > 0;

        return (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Info general */}
            <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: 12, background: "var(--bg-card)", display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{s1.name}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {s2.bedrooms} rec. · {bathroomsComplete} baño{bathroomsComplete !== 1 ? "s" : ""}
                  {bathroomsHalf > 0 ? ` · ${bathroomsHalf} medio${bathroomsHalf !== 1 ? "s" : ""}` : ""}
                </span>
                {s1.sqm && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {s1.sqm} m²</span>}
              </div>
              {s1.description && <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{s1.description}</p>}
            </div>

            {/* Cards de equipamiento por espacio */}
            {groupsWithEq.length > 0 && (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                  EQUIPAMIENTO POR ESPACIO ({totalItems} elemento{totalItems !== 1 ? "s" : ""})
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {groupsWithEq.map((g) => (
                    <div key={g.key} style={{ border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--bg-input)" }}>
                        <g.Icon size={14} color={ACCENT} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{g.label}</span>
                      </div>
                      <div style={{ padding: "10px 12px", display: "grid", gap: 4 }}>
                        {g.items.map((item, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                            <div style={{ width: 4, height: 4, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalItems === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Sin equipamiento configurado. La tipología se creará sin equipos plantilla.</p>
            )}

            {/* Otros espacios como badges */}
            {hasBadges && (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>OTROS ESPACIOS</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {noEqSpaces.map((lbl) => (
                    <span key={lbl} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>{lbl}</span>
                  ))}
                  {bathroomsComplete > 0 && (
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                      {bathroomsComplete} Baño{bathroomsComplete !== 1 ? "s" : ""} completo{bathroomsComplete !== 1 ? "s" : ""}
                    </span>
                  )}
                  {bathroomsHalf > 0 && (
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                      {bathroomsHalf} Medio{bathroomsHalf !== 1 ? "s" : ""} baño{bathroomsHalf !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

        </motion.div>
      </AnimatePresence>

      {/* ── Nav buttons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 10 }}>
        <div>
          {step > 1 && step !== 3 && (
            <UiButton type="button" variant="secondary" onClick={goBack} disabled={saving}>← Atrás</UiButton>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {step !== 3 && (
            <UiButton type="button" variant="secondary" onClick={handleClose} disabled={saving}>Cancelar</UiButton>
          )}
          {step < 4 ? (
            step === 3 ? (
              <>
                {step3PrevSpace && (
                  <UiButton type="button" variant="secondary" onClick={() => setSelectedSpace(step3PrevSpace.key)}>← {step3PrevSpace.label}</UiButton>
                )}
                {step3IsLast ? (
                  <UiButton type="button" variant="primary" onClick={goNext}>Ver resumen →</UiButton>
                ) : (
                  <UiButton type="button" variant="primary" onClick={() => {
                    const nextKey = step3NextSpace?.key ?? "";
                    if (nextKey) {
                      setSelectedSpace(nextKey);
                      setVisitedSpaces(prev => { const s = new Set(prev); s.add(nextKey); return s; });
                    }
                  }}>→ {step3NextSpace?.label ?? ""}</UiButton>
                )}
              </>
            ) : (
              <UiButton type="button" variant="primary" onClick={goNext}>Siguiente</UiButton>
            )
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
