"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { slideStep } from "@/lib/animations";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import {
  BedDouble, Box, Car, Check, ChevronDown,
  Shirt, Sofa, Sun, TreePine, UtensilsCrossed, Wrench, Plus, X,
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

type Step1 = { name: string; sqm: string; description: string };
type Step2 = {
  hasSala: boolean; hasCocina: boolean; hasComedor: boolean;
  hasPatio: boolean; hasCajon: boolean; hasBodega: boolean;
  hasTerraza: boolean; hasLavanderia: boolean; hasAreaServicio: boolean;
  bedrooms: number; bathroomsComplete: number; bathroomsHalf: number;
  customSpaces: string[];
};
type BedroomEq = {
  ac: string;             // NONE | MINI_1T…3T | CENTRAL_1T…3T | FAN_COIL_1T…3T
  fan: string;            // NO | YES
  heater: string;         // NONE | GAS | ELECTRIC
  bed: string;            // NONE | INDIVIDUAL | MATRIMONIAL | QUEEN | KING
  closet: string;         // NONE | ARMARIO | CLOSET | WALK_IN
  tv: string;             // NO | YES
  furnitureOther: string[];
};
type SalaEq = {
  ac: string;             // NONE | MINI_1T…3T | CENTRAL_1T…3T | FAN_COIL_1T…3T
  fan: string;            // NO | YES
  furniture: string[];    // SALA | TV | MESA_CENTRO
  furnitureOther: string[];
};
type CocinaEq = {
  stoveType: string;      // NONE | GAS | ELECTRIC | INDUCTION
  stoveBurners: string;   // 2Q | 4Q | 6Q  |  2 | 4 | ZONAS (induction)
  oven: string;           // NONE | GAS | ELECTRIC
  fridge: string;         // NONE | FRIDGE | FRIGOBAR
  fridgeModel: string;
  others: string[];       // MICROWAVE | DISHWASHER | EXTRACTOR
};
type LavanderiaEq = {
  centroCarga: string;    // NO | YES
  washer: string;         // NO | YES
  dryer: string;          // NONE | GAS | ELECTRIC
};
type AreaServicioEq = {
  boiler: string;          // NONE | DEP_GAS | DEP_ELEC | DEP_SOLAR | PASO_GAS | PASO_ELEC
  boilerCapacity: string;  // 40L | 60L | 80L | 100L+
  centroCarga: string;     // NO | YES
  washer: string;          // NO | YES
  dryer: string;           // NONE | GAS | ELECTRIC
};
type ComadorEq = { furniture: string }; // NONE | COMEDOR_COMPLETO | SOLO_MESA | MESA_SILLAS
type Equipment = {
  bedrooms: BedroomEq[];
  sala: SalaEq;
  cocina: CocinaEq;
  lavanderia: LavanderiaEq;
  area: AreaServicioEq;
  comedor: ComadorEq;
};

/* ─── Defaults ───────────────────────────────────────────────────────── */

const S1: Step1 = { name: "", sqm: "", description: "" };
const S2: Step2 = {
  hasSala: false, hasCocina: false, hasComedor: false, hasPatio: false,
  hasCajon: false, hasBodega: false, hasTerraza: false, hasLavanderia: false,
  hasAreaServicio: false, bedrooms: 1, bathroomsComplete: 1, bathroomsHalf: 0,
  customSpaces: [],
};
const DEFAULT_BEDROOM_EQ: BedroomEq = {
  ac: "NONE", fan: "NO", heater: "NONE",
  bed: "NONE", closet: "NONE", tv: "NO", furnitureOther: [],
};
const DEFAULT_EQ: Equipment = {
  bedrooms: [{ ...DEFAULT_BEDROOM_EQ }],
  sala:      { ac: "NONE", fan: "NO", furniture: [], furnitureOther: [] },
  cocina:    { stoveType: "NONE", stoveBurners: "4Q", oven: "NONE", fridge: "NONE", fridgeModel: "", others: [] },
  lavanderia:{ centroCarga: "NO", washer: "NO", dryer: "NONE" },
  area:      { boiler: "NONE", boilerCapacity: "60L", centroCarga: "NO", washer: "NO", dryer: "NONE" },
  comedor:   { furniture: "NONE" },
};

/* ─── Space definitions ──────────────────────────────────────────────── */

const SPACES = [
  { key: "hasSala",         label: "Sala",             Icon: Sofa            },
  { key: "hasCocina",       label: "Cocina",            Icon: UtensilsCrossed },
  { key: "hasComedor",      label: "Comedor",           Icon: UtensilsCrossed },
  { key: "hasPatio",        label: "Patio",             Icon: TreePine        },
  { key: "hasCajon",        label: "Cajón",             Icon: Car             },
  { key: "hasBodega",       label: "Bodega",            Icon: Box             },
  { key: "hasTerraza",      label: "Terraza",           Icon: Sun             },
  { key: "hasLavanderia",   label: "Lavandería",        Icon: Shirt           },
  { key: "hasAreaServicio", label: "Área de servicio",  Icon: Wrench          },
] as const;

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
      {included && children}
    </div>
  );
}

/* ─── AC helpers ─────────────────────────────────────────────────────── */

function acTypeOf(v: string): string {
  if (v.startsWith("FAN_COIL")) return "FAN_COIL";
  if (v.startsWith("CENTRAL")) return "CENTRAL";
  if (v.startsWith("MINI")) return "MINI";
  return "NONE";
}

function acCapOf(v: string): string {
  if (v.endsWith("_1_5T")) return "1_5T";
  if (v.endsWith("_3T")) return "3T";
  if (v.endsWith("_2T")) return "2T";
  return "1T";
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

/* ─── Asset-row generator ────────────────────────────────────────────── */

type AssetRow = { asset_type: string; name: string; status: string; notes: string | null; sort_order: number };

function buildAssetRows(s2: Step2, eq: Equipment): AssetRow[] {
  const rows: AssetRow[] = [];
  let idx = 0;
  function add(asset_type: string, name: string) {
    rows.push({ asset_type, name, status: "ACTIVE", notes: null, sort_order: idx++ });
  }

  for (let i = 0; i < s2.bedrooms; i++) {
    const b = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
    const sfx = s2.bedrooms > 1 ? ` - Recámara ${i + 1}` : " - Recámara";
    const acMap: Record<string, string> = {
      MINI_1T: "Minisplit 1 ton", MINI_1_5T: "Minisplit 1.5 ton", MINI_2T: "Minisplit 2 ton", MINI_3T: "Minisplit 3 ton",
      CENTRAL_1T: "Aire central 1 ton", CENTRAL_1_5T: "Aire central 1.5 ton", CENTRAL_2T: "Aire central 2 ton", CENTRAL_3T: "Aire central 3 ton",
      FAN_COIL_1T: "Fan & coil 1 ton", FAN_COIL_1_5T: "Fan & coil 1.5 ton", FAN_COIL_2T: "Fan & coil 2 ton", FAN_COIL_3T: "Fan & coil 3 ton",
    };
    if (b.ac !== "NONE" && acMap[b.ac]) add(b.ac.startsWith("MINI") ? "MINISPLIT" : "OTHER", `${acMap[b.ac]}${sfx}`);
    if (b.fan === "YES") add("FAN", `Ventilador de techo${sfx}`);
    if (b.heater !== "NONE") add("OTHER", `Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}${sfx}`);
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king" };
    if (b.bed !== "NONE" && bedMap[b.bed]) add("OTHER", `${bedMap[b.bed]}${sfx}`);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) add("OTHER", `${closetMap[b.closet]}${sfx}`);
    if (b.tv === "YES") add("OTHER", `Televisión${sfx}`);
    for (const f of b.furnitureOther) add("OTHER", `${f}${sfx}`);
  }

  if (s2.hasSala) {
    const acMap: Record<string, string> = {
      MINI_1T: "Minisplit 1 ton - Sala", MINI_1_5T: "Minisplit 1.5 ton - Sala", MINI_2T: "Minisplit 2 ton - Sala", MINI_3T: "Minisplit 3 ton - Sala",
      CENTRAL_1T: "Aire central 1 ton - Sala", CENTRAL_1_5T: "Aire central 1.5 ton - Sala", CENTRAL_2T: "Aire central 2 ton - Sala", CENTRAL_3T: "Aire central 3 ton - Sala",
      FAN_COIL_1T: "Fan & coil 1 ton - Sala", FAN_COIL_1_5T: "Fan & coil 1.5 ton - Sala", FAN_COIL_2T: "Fan & coil 2 ton - Sala", FAN_COIL_3T: "Fan & coil 3 ton - Sala",
    };
    if (eq.sala.ac !== "NONE" && acMap[eq.sala.ac]) add(eq.sala.ac.startsWith("MINI") ? "MINISPLIT" : "OTHER", acMap[eq.sala.ac]);
    if (eq.sala.fan === "YES") add("FAN", "Ventilador de techo - Sala");
    const furMap: Record<string, string> = { SALA: "Juego de sala", TV: "Televisión - Sala", MESA_CENTRO: "Mesa de centro - Sala" };
    for (const f of eq.sala.furniture) if (furMap[f]) add("OTHER", furMap[f]);
    for (const f of eq.sala.furnitureOther) add("OTHER", `${f} - Sala`);
  }

  if (s2.hasCocina) {
    if (eq.cocina.stoveType !== "NONE") {
      const t = eq.cocina.stoveType;
      const b = eq.cocina.stoveBurners;
      if (t === "GAS") add("STOVE", `Estufa gas ${b === "2Q" ? "2" : b === "4Q" ? "4" : "6"} quemadores`);
      else if (t === "ELECTRIC") add("STOVE", `Estufa eléctrica ${b === "2Q" ? "2" : b === "4Q" ? "4" : "6"} quemadores`);
      else if (t === "INDUCTION") add("STOVE", b === "ZONAS" ? "Inducción zonas completas" : `Inducción ${b === "2" ? "2" : "4"} quemadores`);
    }
    if (eq.cocina.oven !== "NONE") add("OTHER", `Horno ${eq.cocina.oven === "GAS" ? "gas" : "eléctrico"}`);
    if (eq.cocina.fridge !== "NONE") {
      const base = eq.cocina.fridge === "FRIDGE" ? "Refrigerador" : "Frigobar";
      add("FRIDGE", eq.cocina.fridgeModel ? `${base} - ${eq.cocina.fridgeModel}` : base);
    }
    const othMap: Record<string, string> = { MICROWAVE: "Microondas", DISHWASHER: "Lavavajillas", EXTRACTOR: "Campana extractora" };
    for (const o of eq.cocina.others) if (othMap[o]) add("OTHER", othMap[o]);
  }

  if (s2.hasLavanderia) {
    if (eq.lavanderia.centroCarga === "YES") add("OTHER", "Centro de lavado vertical - Lavandería");
    else {
      if (eq.lavanderia.washer === "YES") add("WASHER", "Lavadora - Lavandería");
      if (eq.lavanderia.dryer !== "NONE") add("DRYER", `Secadora ${eq.lavanderia.dryer === "GAS" ? "gas" : "eléctrica"} - Lavandería`);
    }
  }

  if (s2.hasAreaServicio) {
    if (eq.area.boiler !== "NONE") {
      const bMap: Record<string, string> = { DEP_GAS: "Boiler depósito gas", DEP_ELEC: "Boiler depósito eléctrico", DEP_SOLAR: "Boiler depósito solar", PASO_GAS: "Boiler de paso gas", PASO_ELEC: "Boiler de paso eléctrico" };
      const cap = ["DEP_GAS","DEP_ELEC","DEP_SOLAR"].includes(eq.area.boiler) ? ` ${eq.area.boilerCapacity}` : "";
      if (bMap[eq.area.boiler]) add("BOILER", `${bMap[eq.area.boiler]}${cap}`);
    }
    if (eq.area.centroCarga === "YES") {
      add("OTHER", "Centro de lavado vertical - Área de servicio");
    } else if (!s2.hasLavanderia) {
      if (eq.area.washer === "YES") add("WASHER", "Lavadora - Área de servicio");
      if (eq.area.dryer !== "NONE") add("DRYER", `Secadora ${eq.area.dryer === "GAS" ? "gas" : "eléctrica"} - Área de servicio`);
    }
  }

  if (s2.hasComedor) {
    const fMap: Record<string, string> = { COMEDOR_COMPLETO: "Comedor completo", SOLO_MESA: "Mesa de comedor", MESA_SILLAS: "Mesa con sillas" };
    if (eq.comedor.furniture !== "NONE" && fMap[eq.comedor.furniture]) add("OTHER", fMap[eq.comedor.furniture]);
  }

  return rows;
}

/* ─── Summary group builder ──────────────────────────────────────────── */

type SummaryGroup = { key: string; label: string; Icon: React.ElementType; items: string[] };

function buildSummaryGroups(s2: Step2, eq: Equipment): SummaryGroup[] {
  const groups: SummaryGroup[] = [];

  for (let i = 0; i < s2.bedrooms; i++) {
    const b = eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ;
    const items: string[] = [];
    const acMap: Record<string, string> = {
      MINI_1T: "Minisplit 1 ton", MINI_1_5T: "Minisplit 1.5 ton", MINI_2T: "Minisplit 2 ton", MINI_3T: "Minisplit 3 ton",
      CENTRAL_1T: "Aire central 1 ton", CENTRAL_1_5T: "Aire central 1.5 ton", CENTRAL_2T: "Aire central 2 ton", CENTRAL_3T: "Aire central 3 ton",
      FAN_COIL_1T: "Fan & coil 1 ton", FAN_COIL_1_5T: "Fan & coil 1.5 ton", FAN_COIL_2T: "Fan & coil 2 ton", FAN_COIL_3T: "Fan & coil 3 ton",
    };
    if (b.ac !== "NONE" && acMap[b.ac]) items.push(acMap[b.ac]);
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

  if (s2.hasSala) {
    const items: string[] = [];
    const acMap: Record<string, string> = {
      MINI_1T: "Minisplit 1 ton", MINI_1_5T: "Minisplit 1.5 ton", MINI_2T: "Minisplit 2 ton", MINI_3T: "Minisplit 3 ton",
      CENTRAL_1T: "Aire central 1 ton", CENTRAL_1_5T: "Aire central 1.5 ton", CENTRAL_2T: "Aire central 2 ton", CENTRAL_3T: "Aire central 3 ton",
      FAN_COIL_1T: "Fan & coil 1 ton", FAN_COIL_1_5T: "Fan & coil 1.5 ton", FAN_COIL_2T: "Fan & coil 2 ton", FAN_COIL_3T: "Fan & coil 3 ton",
    };
    if (eq.sala.ac !== "NONE" && acMap[eq.sala.ac]) items.push(acMap[eq.sala.ac]);
    if (eq.sala.fan === "YES") items.push("Ventilador de techo");
    const furMap: Record<string, string> = { SALA: "Juego de sala", TV: "Televisión", MESA_CENTRO: "Mesa de centro" };
    for (const f of eq.sala.furniture) if (furMap[f]) items.push(furMap[f]);
    for (const f of eq.sala.furnitureOther) items.push(f);
    groups.push({ key: "sala", label: "Sala", Icon: Sofa, items });
  }

  if (s2.hasCocina) {
    const items: string[] = [];
    if (eq.cocina.stoveType !== "NONE") {
      const t = eq.cocina.stoveType; const b = eq.cocina.stoveBurners;
      if (t === "GAS") items.push(`Estufa gas ${b === "2Q" ? "2" : b === "4Q" ? "4" : "6"} quemadores`);
      else if (t === "ELECTRIC") items.push(`Estufa eléctrica ${b === "2Q" ? "2" : b === "4Q" ? "4" : "6"} quemadores`);
      else if (t === "INDUCTION") items.push(b === "ZONAS" ? "Inducción zonas completas" : `Inducción ${b === "2" ? "2" : "4"} quemadores`);
    }
    if (eq.cocina.oven !== "NONE") items.push(`Horno ${eq.cocina.oven === "GAS" ? "gas" : "eléctrico"}`);
    if (eq.cocina.fridge !== "NONE") {
      const base = eq.cocina.fridge === "FRIDGE" ? "Refrigerador" : "Frigobar";
      items.push(eq.cocina.fridgeModel ? `${base} (${eq.cocina.fridgeModel})` : base);
    }
    const othMap: Record<string, string> = { MICROWAVE: "Microondas", DISHWASHER: "Lavavajillas", EXTRACTOR: "Campana extractora" };
    for (const o of eq.cocina.others) if (othMap[o]) items.push(othMap[o]);
    groups.push({ key: "cocina", label: "Cocina", Icon: UtensilsCrossed, items });
  }

  if (s2.hasLavanderia) {
    const items: string[] = [];
    if (eq.lavanderia.centroCarga === "YES") items.push("Centro de lavado vertical");
    else {
      if (eq.lavanderia.washer === "YES") items.push("Lavadora");
      if (eq.lavanderia.dryer !== "NONE") items.push(`Secadora ${eq.lavanderia.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
    groups.push({ key: "lavanderia", label: "Lavandería", Icon: Shirt, items });
  }

  if (s2.hasAreaServicio) {
    const items: string[] = [];
    if (eq.area.boiler !== "NONE") {
      const bMap: Record<string, string> = { DEP_GAS: "Boiler depósito gas", DEP_ELEC: "Boiler depósito eléctrico", DEP_SOLAR: "Boiler depósito solar", PASO_GAS: "Boiler de paso gas", PASO_ELEC: "Boiler de paso eléctrico" };
      const cap = ["DEP_GAS","DEP_ELEC","DEP_SOLAR"].includes(eq.area.boiler) ? ` ${eq.area.boilerCapacity}` : "";
      if (bMap[eq.area.boiler]) items.push(`${bMap[eq.area.boiler]}${cap}`);
    }
    if (eq.area.centroCarga === "YES") items.push("Centro de lavado vertical");
    else if (!s2.hasLavanderia) {
      if (eq.area.washer === "YES") items.push("Lavadora");
      if (eq.area.dryer !== "NONE") items.push(`Secadora ${eq.area.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
    groups.push({ key: "area", label: "Área de servicio", Icon: Wrench, items });
  }

  if (s2.hasComedor) {
    const items: string[] = [];
    const fMap: Record<string, string> = { COMEDOR_COMPLETO: "Comedor completo", SOLO_MESA: "Mesa de comedor", MESA_SILLAS: "Mesa con sillas" };
    if (eq.comedor.furniture !== "NONE" && fMap[eq.comedor.furniture]) items.push(fMap[eq.comedor.furniture]);
    groups.push({ key: "comedor", label: "Comedor", Icon: UtensilsCrossed, items });
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
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [saving, setSaving]       = useState(false);
  const [s1Error, setS1Error]     = useState("");
  const [customSpaceInput, setCustomSpaceInput] = useState("");
  const [showCustomInput, setShowCustomInput]   = useState(false);

  const STEP_TITLES = ["Nueva tipología — Información", "Nueva tipología — Espacios", "Nueva tipología — Equipamiento", "Nueva tipología — Resumen"];

  const STEP_INPUT: React.CSSProperties = {
    width: "100%", padding: 10, border: "1px solid var(--border-default)",
    borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  function reset() {
    setStep(1); setS1({ ...S1 }); setS2({ ...S2 });
    setEq(JSON.parse(JSON.stringify(DEFAULT_EQ)) as Equipment);
    setExpandedBlocks(new Set()); setSaving(false); setS1Error("");
    setCustomSpaceInput(""); setShowCustomInput(false);
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

  function toggleBlock(key: string) {
    setExpandedBlocks((prev) => prev.has(key) ? new Set() : new Set([key]));
  }

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
  function setSala<K extends keyof SalaEq>(key: K, val: SalaEq[K]) {
    setEq((prev) => ({ ...prev, sala: { ...prev.sala, [key]: val } }));
  }
  function setCocina<K extends keyof CocinaEq>(key: K, val: CocinaEq[K]) {
    setEq((prev) => ({ ...prev, cocina: { ...prev.cocina, [key]: val } }));
  }
  function setLavanderia<K extends keyof LavanderiaEq>(key: K, val: LavanderiaEq[K]) {
    setEq((prev) => ({ ...prev, lavanderia: { ...prev.lavanderia, [key]: val } }));
  }
  function setArea<K extends keyof AreaServicioEq>(key: K, val: AreaServicioEq[K]) {
    setEq((prev) => ({ ...prev, area: { ...prev.area, [key]: val } }));
  }
  function setComedor<K extends keyof ComadorEq>(key: K, val: ComadorEq[K]) {
    setEq((prev) => ({ ...prev, comedor: { ...prev.comedor, [key]: val } }));
  }

  /* ── Create ── */
  async function handleCreate() {
    if (!buildingId) return;
    setSaving(true);
    const hasWasher = (s2.hasLavanderia && (eq.lavanderia.centroCarga === "YES" || eq.lavanderia.washer === "YES"))
                    || (s2.hasAreaServicio && (eq.area.centroCarga === "YES" || eq.area.washer === "YES"));
    const hasDryer  = (s2.hasLavanderia && eq.lavanderia.centroCarga !== "YES" && eq.lavanderia.dryer !== "NONE")
                    || (s2.hasAreaServicio && eq.area.centroCarga !== "YES" && eq.area.dryer !== "NONE");
    const stoveType = eq.cocina.stoveType === "GAS" ? "GAS" : eq.cocina.stoveType === "ELECTRIC" ? "ELECTRIC" : eq.cocina.stoveType === "INDUCTION" ? "ELECTRIC" : "NONE";

    const payload = {
      building_id: buildingId, company_id: companyId,
      name: s1.name.trim(), bedrooms: s2.bedrooms, bathrooms: s2.bathroomsComplete,
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

  /* ── Block helpers ── */
  function blockHeader(key: string, label: string, Icon: React.ElementType, count: number) {
    const isOpen = expandedBlocks.has(key);
    return (
      <button type="button" onClick={() => toggleBlock(key)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", border: "none", background: "var(--bg-input)", borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon size={16} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
          {count > 0 && (
            <span style={{ padding: "1px 8px", borderRadius: 999, background: "#f9eaf3", color: ACCENT, fontSize: 11, fontWeight: 700 }}>
              {count} equipo{count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "inline-flex" }}
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
    );
  }
  function blockBody(children: React.ReactNode, key: string) {
    const isOpen = expandedBlocks.has(key);
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: 14, border: "1px solid var(--border-default)", borderTop: "none", borderRadius: "0 0 10px 10px" }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  /* ── Counts ── */
  function bedroomCount(b: BedroomEq) {
    return (b.ac !== "NONE" ? 1 : 0) + (b.fan === "YES" ? 1 : 0) + (b.heater !== "NONE" ? 1 : 0)
      + (b.bed !== "NONE" ? 1 : 0) + (b.closet !== "NONE" ? 1 : 0) + (b.tv === "YES" ? 1 : 0)
      + b.furnitureOther.length;
  }
  function salaCount(s: SalaEq) {
    return (s.ac !== "NONE" ? 1 : 0) + (s.fan === "YES" ? 1 : 0) + s.furniture.length + s.furnitureOther.length;
  }
  function cocinaCount(c: CocinaEq) {
    return (c.stoveType !== "NONE" ? 1 : 0) + (c.oven !== "NONE" ? 1 : 0) + (c.fridge !== "NONE" ? 1 : 0) + c.others.length;
  }
  function lavanderiaCount(l: LavanderiaEq) {
    if (l.centroCarga === "YES") return 1;
    return (l.washer === "YES" ? 1 : 0) + (l.dryer !== "NONE" ? 1 : 0);
  }
  function areaCount(a: AreaServicioEq) {
    return (a.boiler !== "NONE" ? 1 : 0);
  }

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <Modal open={open} title={STEP_TITLES[step - 1] ?? ""} onClose={handleClose} maxWidth={560}>
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
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Espacios incluidos</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {SPACES.map(({ key, label, Icon }) => {
                const on = s2[key as keyof Step2] as boolean;
                return (
                  <button key={key} type="button"
                    onClick={() => toggleSpace(key as keyof Step2 & string)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 8px", borderRadius: 10, cursor: "pointer", border: on ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)", background: on ? "#f9eaf3" : "var(--bg-card)", color: on ? ACCENT : "var(--text-secondary)" }}>
                    <Icon size={18} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                  </button>
                );
              })}
              {/* Otro */}
              <button type="button"
                onClick={() => setShowCustomInput((v) => !v)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 8px", borderRadius: 10, cursor: "pointer", border: (showCustomInput || s2.customSpaces.length > 0) ? `2px solid ${ACCENT}` : "1.5px solid var(--border-default)", background: (showCustomInput || s2.customSpaces.length > 0) ? "#f9eaf3" : "var(--bg-card)", color: (showCustomInput || s2.customSpaces.length > 0) ? ACCENT : "var(--text-secondary)" }}>
                <Plus size={18} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>Otro</span>
              </button>
            </div>

            {/* Custom space input */}
            {showCustomInput && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <input
                  value={customSpaceInput}
                  onChange={(e) => setCustomSpaceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSpace(); } }}
                  placeholder="Ej. Cuarto de servicio, Estudio..."
                  style={{ ...STEP_INPUT, flex: 1, fontSize: 13 }}
                />
                <button type="button" onClick={addCustomSpace}
                  style={{ padding: "0 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Agregar
                </button>
              </div>
            )}

            {/* Added custom spaces */}
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
            return (
              <div key={bKey}>
                {blockHeader(bKey, s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara", BedDouble, bedroomCount(bEq))}
                {blockBody(
                  <div>
                    {eqRow("Aire acondicionado", (
                      <div style={{ display: "grid", gap: 8 }}>
                        <Radio
                          value={acTypeOf(bEq.ac)}
                          onChange={(t) => setBedEq(i, "ac", t === "NONE" ? "NONE" : `${t}_${acTypeOf(bEq.ac) !== "NONE" ? acCapOf(bEq.ac) : "1T"}`)}
                          options={[{value:"NONE",label:"No incluye"},{value:"MINI",label:"Minisplit"},{value:"CENTRAL",label:"Aire central"},{value:"FAN_COIL",label:"Fan & coil"}]}
                        />
                        {acTypeOf(bEq.ac) !== "NONE" && (
                          <Radio
                            value={acCapOf(bEq.ac)}
                            onChange={(cap) => setBedEq(i, "ac", `${acTypeOf(bEq.ac)}_${cap}`)}
                            options={[{value:"1T",label:"1 ton"},{value:"1_5T",label:"1.5 ton"},{value:"2T",label:"2 ton"},{value:"3T",label:"3 ton"}]}
                          />
                        )}
                      </div>
                    ))}
                    {eqRow("Ventilador de techo", (
                      <Radio value={bEq.fan} onChange={(v) => setBedEq(i, "fan", v)}
                        options={[{value:"NO",label:"No"},{value:"YES",label:"Sí"}]} />
                    ))}
                    {eqRow("Calefactor", (
                      <IncludeToggle
                        included={bEq.heater !== "NONE"}
                        onExclude={() => setBedEq(i, "heater", "NONE")}
                        onInclude={() => setBedEq(i, "heater", "GAS")}
                      >
                        <Radio value={bEq.heater} onChange={(v) => setBedEq(i, "heater", v)}
                          options={[{value:"GAS",label:"Gas"},{value:"ELECTRIC",label:"Eléctrico"}]} />
                      </IncludeToggle>
                    ))}
                    {eqRow("Cama", (
                      <Radio value={bEq.bed} onChange={(v) => setBedEq(i, "bed", v)}
                        options={[{value:"NONE",label:"No incluye"},{value:"INDIVIDUAL",label:"Individual"},{value:"MATRIMONIAL",label:"Matrimonial"},{value:"QUEEN",label:"Queen"},{value:"KING",label:"King"}]} />
                    ))}
                    {eqRow("Closet", (
                      <Radio value={bEq.closet} onChange={(v) => setBedEq(i, "closet", v)}
                        options={[{value:"NONE",label:"No incluye"},{value:"ARMARIO",label:"Armario"},{value:"CLOSET",label:"Closet"},{value:"WALK_IN",label:"Walk-in closet"}]} />
                    ))}
                    {eqRow("Televisión", (
                      <Radio value={bEq.tv} onChange={(v) => setBedEq(i, "tv", v)}
                        options={[{value:"NO",label:"No"},{value:"YES",label:"Sí"}]} />
                    ))}
                    {eqRow("Otro mobiliario", (
                      <PillsInput value={bEq.furnitureOther} onChange={(v) => setBedEq(i, "furnitureOther", v)} placeholder="Ej. Escritorio, Buró..." />
                    ))}
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
                  {eqRow("Aire acondicionado", (
                    <div style={{ display: "grid", gap: 8 }}>
                      <Radio
                        value={acTypeOf(eq.sala.ac)}
                        onChange={(t) => setSala("ac", t === "NONE" ? "NONE" : `${t}_${acTypeOf(eq.sala.ac) !== "NONE" ? acCapOf(eq.sala.ac) : "1T"}`)}
                        options={[{value:"NONE",label:"No incluye"},{value:"MINI",label:"Minisplit"},{value:"CENTRAL",label:"Aire central"},{value:"FAN_COIL",label:"Fan & coil"}]}
                      />
                      {acTypeOf(eq.sala.ac) !== "NONE" && (
                        <Radio
                          value={acCapOf(eq.sala.ac)}
                          onChange={(cap) => setSala("ac", `${acTypeOf(eq.sala.ac)}_${cap}`)}
                          options={[{value:"1T",label:"1 ton"},{value:"1_5T",label:"1.5 ton"},{value:"2T",label:"2 ton"},{value:"3T",label:"3 ton"}]}
                        />
                      )}
                    </div>
                  ))}
                  {eqRow("Ventilador de techo", (
                    <Radio value={eq.sala.fan} onChange={(v) => setSala("fan", v)}
                      options={[{value:"NO",label:"No"},{value:"YES",label:"Sí"}]} />
                  ))}
                  {eqRow("Mobiliario", (
                    <div style={{ display: "grid", gap: 8 }}>
                      <Pills value={eq.sala.furniture} onChange={(v) => setSala("furniture", v)}
                        options={[{value:"SALA",label:"Juego de sala"},{value:"TV",label:"Televisión"},{value:"MESA_CENTRO",label:"Mesa de centro"}]} />
                      <PillsInput value={eq.sala.furnitureOther} onChange={(v) => setSala("furnitureOther", v)} placeholder="Otro mobiliario..." />
                    </div>
                  ))}
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
                  {eqRow("Estufa / parrilla", (
                    <IncludeToggle
                      included={eq.cocina.stoveType !== "NONE"}
                      onExclude={() => setCocina("stoveType", "NONE")}
                      onInclude={() => setCocina("stoveType", "GAS")}
                    >
                      <div style={{ display: "grid", gap: 8 }}>
                        <Radio value={eq.cocina.stoveType} onChange={(v) => { setCocina("stoveType", v); if (v === "INDUCTION") setCocina("stoveBurners", "2"); else setCocina("stoveBurners", "4Q"); }}
                          options={[{value:"GAS",label:"Gas"},{value:"ELECTRIC",label:"Eléctrica"},{value:"INDUCTION",label:"Inducción"}]} />
                        {(eq.cocina.stoveType === "GAS" || eq.cocina.stoveType === "ELECTRIC") && (
                          <Radio value={eq.cocina.stoveBurners} onChange={(v) => setCocina("stoveBurners", v)}
                            options={[{value:"2Q",label:"2 quemadores"},{value:"4Q",label:"4 quemadores"},{value:"6Q",label:"6 quemadores"}]} />
                        )}
                        {eq.cocina.stoveType === "INDUCTION" && (
                          <Radio value={eq.cocina.stoveBurners} onChange={(v) => setCocina("stoveBurners", v)}
                            options={[{value:"2",label:"2 quemadores"},{value:"4",label:"4 quemadores"},{value:"ZONAS",label:"Zonas completas"}]} />
                        )}
                      </div>
                    </IncludeToggle>
                  ))}
                  {eqRow("Horno", (
                    <Radio value={eq.cocina.oven} onChange={(v) => setCocina("oven", v)}
                      options={[{value:"NONE",label:"No incluye"},{value:"GAS",label:"Gas"},{value:"ELECTRIC",label:"Eléctrico"}]} />
                  ))}
                  {eqRow("Refrigeración", (
                    <div style={{ display: "grid", gap: 8 }}>
                      <Radio value={eq.cocina.fridge} onChange={(v) => setCocina("fridge", v)}
                        options={[{value:"NONE",label:"No incluye"},{value:"FRIDGE",label:"Refrigerador"},{value:"FRIGOBAR",label:"Frigobar"}]} />
                      {eq.cocina.fridge !== "NONE" && (
                        <input value={eq.cocina.fridgeModel} onChange={(e) => setCocina("fridgeModel", e.target.value)}
                          placeholder="Modelo (opcional)" style={{ ...STEP_INPUT, fontSize: 12 }} />
                      )}
                    </div>
                  ))}
                  {eqRow("Electrodomésticos", (
                    <Pills value={eq.cocina.others} onChange={(v) => setCocina("others", v)}
                      options={[{value:"MICROWAVE",label:"Microondas"},{value:"DISHWASHER",label:"Lavavajillas"},{value:"EXTRACTOR",label:"Campana extractora"}]} />
                  ))}
                </div>,
                "cocina"
              )}
            </div>
          )}

          {/* Lavandería */}
          {s2.hasLavanderia && (
            <div>
              {blockHeader("lavanderia", "Lavandería", Shirt, lavanderiaCount(eq.lavanderia))}
              {blockBody(
                <div>
                  {eqRow("Centro de lavado vertical", (
                    <Radio value={eq.lavanderia.centroCarga} onChange={(v) => setLavanderia("centroCarga", v)}
                      options={[{value:"NO",label:"No"},{value:"YES",label:"Sí"}]} />
                  ))}
                  {eq.lavanderia.centroCarga !== "YES" && (
                    <>
                      {eqRow("Lavadora", (
                        <Radio value={eq.lavanderia.washer} onChange={(v) => setLavanderia("washer", v)}
                          options={[{value:"NO",label:"No"},{value:"YES",label:"Sí"}]} />
                      ))}
                      {eqRow("Secadora", (
                        <Radio value={eq.lavanderia.dryer} onChange={(v) => setLavanderia("dryer", v)}
                          options={[{value:"NONE",label:"No incluye"},{value:"GAS",label:"Gas"},{value:"ELECTRIC",label:"Eléctrica"}]} />
                      ))}
                    </>
                  )}
                </div>,
                "lavanderia"
              )}
            </div>
          )}

          {/* Área de servicio */}
          {s2.hasAreaServicio && (
            <div>
              {blockHeader("area", "Área de servicio", Wrench, areaCount(eq.area))}
              {blockBody(
                <div>
                  {eqRow("Boiler", (
                    <div style={{ display: "grid", gap: 8 }}>
                      <Radio value={eq.area.boiler} onChange={(v) => setArea("boiler", v)}
                        options={[{value:"NONE",label:"No incluye"},{value:"DEP_GAS",label:"Depósito gas"},{value:"DEP_ELEC",label:"Depósito eléctrico"},{value:"DEP_SOLAR",label:"Depósito solar"},{value:"PASO_GAS",label:"Paso gas"},{value:"PASO_ELEC",label:"Paso eléctrico"}]} />
                      {["DEP_GAS","DEP_ELEC","DEP_SOLAR"].includes(eq.area.boiler) && (
                        <Pills value={[eq.area.boilerCapacity]} onChange={(v) => setArea("boilerCapacity", v[v.length - 1] ?? "60L")}
                          options={[{value:"40L",label:"40L"},{value:"60L",label:"60L"},{value:"80L",label:"80L"},{value:"100L+",label:"100L+"}]} />
                      )}
                    </div>
                  ))}
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
                  {eqRow("Mobiliario", (
                    <Radio value={eq.comedor.furniture} onChange={(v) => setComedor("furniture", v)}
                      options={[{value:"NONE",label:"No incluye"},{value:"COMEDOR_COMPLETO",label:"Comedor completo"},{value:"SOLO_MESA",label:"Solo mesa"},{value:"MESA_SILLAS",label:"Mesa y sillas"}]} />
                  ))}
                </div>,
                "comedor"
              )}
            </div>
          )}

        </div>
      )}

      {/* ── PASO 4: Resumen ── */}
      {step === 4 && (() => {
        const groups = buildSummaryGroups(s2, eq);
        const groupsWithEq = groups.filter((g) => g.items.length > 0);
        const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
        const noEqSpaces: string[] = [
          ...(s2.hasPatio ? ["Patio"] : []),
          ...(s2.hasCajon ? ["Cajón"] : []),
          ...(s2.hasBodega ? ["Bodega"] : []),
          ...(s2.hasTerraza ? ["Terraza"] : []),
          ...s2.customSpaces,
        ];
        const hasBadges = noEqSpaces.length > 0 || s2.bathroomsComplete > 0 || s2.bathroomsHalf > 0;

        return (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Info general */}
            <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: 12, background: "var(--bg-card)", display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{s1.name}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s2.bedrooms} rec. · {s2.bathroomsComplete} baño{s2.bathroomsComplete !== 1 ? "s" : ""}</span>
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
                  {s2.bathroomsComplete > 0 && (
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                      {s2.bathroomsComplete} Baño{s2.bathroomsComplete !== 1 ? "s" : ""} completo{s2.bathroomsComplete !== 1 ? "s" : ""}
                    </span>
                  )}
                  {s2.bathroomsHalf > 0 && (
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                      {s2.bathroomsHalf} Medio{s2.bathroomsHalf !== 1 ? "s" : ""} baño{s2.bathroomsHalf !== 1 ? "s" : ""}
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
          {step > 1 && <UiButton type="button" variant="secondary" onClick={goBack} disabled={saving}>Atrás</UiButton>}
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
