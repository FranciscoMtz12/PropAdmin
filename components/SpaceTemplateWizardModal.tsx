"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import WizardShell from "@/components/WizardShell";
import AppFormField from "@/components/AppFormField";
import {
  BedDouble, Box, Car, Check,
  Shirt, Sofa, Sun, TreePine, UtensilsCrossed, Wind, Wrench, Plus, X,
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface EditTemplateData {
  id: string;
  name: string;
  space_type: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  has_living_room?: boolean;
  has_dining_room?: boolean;
  has_patio?: boolean;
  has_fridge?: boolean;
  has_washer?: boolean;
  has_dryer?: boolean;
  stove_type?: string | null;
  wizard_state?: { s1?: { description?: string }; s2?: Step2; eq?: Equipment } | null;
  assets?: { name: string; asset_type: string }[];
}

interface Props {
  open: boolean;
  propertyId: string;
  companyId: string;
  spaceType: string; // 'apartment' | 'loft' | 'house' | ...
  editTemplate?: EditTemplateData | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Step1 = { name: string; description: string };
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
  bed: string; bedCount: number; closet: string; tv: string; furnitureOther: string[];
  hasOwnBath: boolean; shower: string; hasTub: boolean; hasJacuzzi: boolean;
};
type SalaEq = {
  ac: string; fan: string; furniture: string[]; furnitureOther: string[];
  guestBath: string; guestBathShower: string; guestBathHasTub: boolean; guestBathHasJacuzzi: boolean;
};
type CocinaEq = {
  ac: string; hasHalfBath: boolean;
  stoveType: string; stoveBurners: string; oven: string;
  fridge: string; fridgeModel: string; others: string[];
};
type BoilerUnit = { type: string; capacity: string; services: string };
type LavanderiaEq = { boilers: BoilerUnit[]; centroCarga: string; washer: string; dryer: string };
type CuartoMaquinasEq = { boilers: BoilerUnit[] };
type EquiposFuncionalesEq = { boilers: BoilerUnit[]; centroCarga: string; washer: string; dryer: string };
type AireCentralEq = { capacity: string };
type ComedorEq = { ac: string; furniture: string };
type Equipment = {
  bedrooms: BedroomEq[];
  cuartoServicio: BedroomEq;
  sala: SalaEq;
  cocina: CocinaEq;
  lavanderia: LavanderiaEq;
  cuartoMaquinas: CuartoMaquinasEq;
  equiposFuncionales: EquiposFuncionalesEq;
  aireCentral: AireCentralEq;
  comedor: ComedorEq;
};
type AssetRow = { asset_type: string; name: string; status: string; notes: string | null; sort_order: number };
type SummaryGroup = { key: string; label: string; Icon: React.ElementType; items: string[] };

/* ─── Defaults ───────────────────────────────────────────────────────── */

const INIT_S1: Step1 = { name: "", description: "" };
const INIT_S2: Step2 = {
  hasSala: false, hasCocina: false, hasComedor: false, hasPatio: false,
  hasCajon: false, hasBodega: false, hasTerraza: false, hasLavanderia: false,
  hasCuartoServicio: false, hasCuartoMaquinas: false,
  bedrooms: 1, customSpaces: [],
};
const DEFAULT_BEDROOM_EQ: BedroomEq = {
  ac: "NONE", fan: "NO", heater: "NONE",
  bed: "NONE", bedCount: 1, closet: "NONE", tv: "NO", furnitureOther: [],
  hasOwnBath: false, shower: "NONE", hasTub: false, hasJacuzzi: false,
};
const INIT_EQ: Equipment = {
  bedrooms: [{ ...DEFAULT_BEDROOM_EQ }],
  cuartoServicio: { ...DEFAULT_BEDROOM_EQ },
  sala: { ac: "NONE", fan: "NO", furniture: [], furnitureOther: [], guestBath: "NONE", guestBathShower: "NONE", guestBathHasTub: false, guestBathHasJacuzzi: false },
  cocina: { ac: "NONE", hasHalfBath: false, stoveType: "NONE", stoveBurners: "4Q", oven: "NONE", fridge: "NONE", fridgeModel: "", others: [] },
  lavanderia: { boilers: [], centroCarga: "NO", washer: "NO", dryer: "NONE" },
  cuartoMaquinas: { boilers: [{ type: "DEP_GAS", capacity: "60L", services: "1" }] },
  equiposFuncionales: { boilers: [{ type: "DEP_GAS", capacity: "60L", services: "1" }], centroCarga: "NO", washer: "NO", dryer: "NONE" },
  aireCentral: { capacity: "5" },
  comedor: { ac: "NONE", furniture: "NONE" },
};

const WIZARD_STEPS = [
  { label: "Información" },
  { label: "Espacios" },
  { label: "Equipamiento" },
  { label: "Resumen" },
];

const RESIDENTIAL_TYPES = ["apartment", "loft", "house"];

const SPACE_TYPE_DISPLAY: Record<string, string> = {
  apartment: "Departamento", loft: "Loft", house: "Casa",
  warehouse: "Bodega", office: "Oficina", commercial_local: "Local comercial",
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
  { key: "hasLavanderia",     label: "Lavandería",         Icon: Shirt  },
  { key: "hasCuartoMaquinas", label: "Cuarto de máquinas", Icon: Wrench },
  { key: "hasBodega",         label: "Bodega",             Icon: Box    },
  { key: "hasCajon",          label: "Cajón",              Icon: Car    },
] as const;

/* ─── Bath / AC helpers ──────────────────────────────────────────────── */

function computeBathroomsComplete(s2: Step2, eq: Equipment): number {
  return eq.bedrooms.filter((b, i) => i < s2.bedrooms && b.hasOwnBath).length
    + (s2.hasCuartoServicio && eq.cuartoServicio.hasOwnBath ? 1 : 0)
    + (s2.hasSala && eq.sala.guestBath === "FULL" ? 1 : 0);
}
function computeBathroomsHalf(s2: Step2, eq: Equipment): number {
  return (s2.hasCocina && eq.cocina.hasHalfBath ? 1 : 0)
    + (s2.hasSala && eq.sala.guestBath === "HALF" ? 1 : 0);
}
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
function capLabel(c: string) {
  return c === "1_5T" ? "1.5 ton" : c === "2T" ? "2 ton" : c === "3T" ? "3 ton" : c === "5T" ? "5 ton" : "1 ton";
}

/* ─── Boiler constants ───────────────────────────────────────────────── */

const BOILER_TYPE_OPTIONS = [
  { value: "DEP_GAS",   label: "Depósito gas"        },
  { value: "DEP_ELEC",  label: "Depósito eléctrico"  },
  { value: "DEP_SOLAR", label: "Depósito solar"       },
  { value: "PASO_GAS",  label: "Paso gas"             },
  { value: "PASO_ELEC", label: "Paso eléctrico"       },
];
const BOILER_CAP_OPTIONS = [
  { value: "40L", label: "40L" }, { value: "60L", label: "60L" },
  { value: "80L", label: "80L" }, { value: "100L+", label: "100L+" },
];
const BOILER_NAME: Record<string, string> = {
  DEP_GAS: "Boiler depósito gas", DEP_ELEC: "Boiler depósito eléctrico",
  DEP_SOLAR: "Boiler depósito solar", PASO_GAS: "Boiler de paso gas", PASO_ELEC: "Boiler de paso eléctrico",
};
const BOILER_SHORT: Record<string, string> = {
  DEP_GAS: "depósito gas", DEP_ELEC: "depósito eléctrico", DEP_SOLAR: "depósito solar",
  PASO_GAS: "de paso gas", PASO_ELEC: "de paso eléctrico",
};
const IS_DEP  = (b: string) => ["DEP_GAS", "DEP_ELEC", "DEP_SOLAR"].includes(b);
const IS_PASO = (b: string) => ["PASO_GAS", "PASO_ELEC"].includes(b);
const SHOWER_OPTIONS = [
  { value: "NONE", label: "No incluye" }, { value: "NORMAL", label: "Normal" },
  { value: "ELECTRIC", label: "Eléctrica" }, { value: "RAIN", label: "Lluvia" },
];
const SHOWER_LABEL: Record<string, string> = {
  NORMAL: "Regadera normal", ELECTRIC: "Regadera eléctrica", RAIN: "Regadera lluvia",
};

/* ─── Draft helpers ──────────────────────────────────────────────────── */

type DraftData = { step: number; s1: Step1; s2: Step2; eq: Equipment };
const draftKey = (propertyId: string) => `space_template_wizard_draft_${propertyId}`;
function saveDraft(pid: string, d: DraftData) { try { localStorage.setItem(draftKey(pid), JSON.stringify(d)); } catch {} }
function loadDraft(pid: string): DraftData | null { try { const r = localStorage.getItem(draftKey(pid)); return r ? (JSON.parse(r) as DraftData) : null; } catch { return null; } }
function clearDraft(pid: string) { try { localStorage.removeItem(draftKey(pid)); } catch {} }

/* ─── buildAssetRows ─────────────────────────────────────────────────── */

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
  const add = (asset_type: string, name: string) =>
    rows.push({ asset_type, name, status: "ACTIVE", notes: null, sort_order: idx++ });
  function addBoilers(boilers: BoilerUnit[], sfx: string) {
    const total = boilers.length;
    boilers.forEach((b, i) => {
      if (total === 1) {
        const cap = IS_DEP(b.type) ? ` ${b.capacity}` : "";
        const svc = IS_PASO(b.type) && b.services !== "1" ? ` — ${b.services} servicios` : "";
        add("BOILER", `${BOILER_NAME[b.type] ?? b.type}${cap}${svc}${sfx}`);
      } else {
        const cap = IS_DEP(b.type) ? ` ${b.capacity}` : "";
        const svc = IS_PASO(b.type) ? ` ${b.services} servicio${b.services !== "1" ? "s" : ""}` : "";
        add("BOILER", `Boiler ${i + 1}: ${BOILER_SHORT[b.type] ?? b.type}${cap}${svc}${sfx}`);
      }
    });
  }
  function addAC(ac: string, sfx: string) {
    const t = acTypeOf(ac);
    if (t === "NONE" || t === "CENTRAL") return;
    const c = acCapOf(ac); const cs = capLabel(c);
    if (t === "MINI") add("MINISPLIT", `Minisplit ${cs}${sfx}`);
    else add("OTHER", `Fan & coil ${cs}${sfx}`);
  }
  function addBedBath(b: BedroomEq, sfx: string) {
    if (!b.hasOwnBath) return;
    add("OTHER", `Baño privado${sfx}`);
    if (b.shower !== "NONE" && SHOWER_LABEL[b.shower]) add("OTHER", `${SHOWER_LABEL[b.shower]}${sfx}`);
    if (b.hasTub) add("OTHER", `Tina${sfx}`);
    if (b.hasJacuzzi) add("OTHER", `Jacuzzi${sfx}`);
  }
  function addBedContent(b: BedroomEq, sfx: string) {
    addBedBath(b, sfx);
    addAC(b.ac, sfx);
    if (b.fan === "YES") add("FAN", `Ventilador de techo${sfx}`);
    if (b.heater !== "NONE") add("OTHER", `Calefactor ${b.heater === "GAS" ? "gas" : "eléctrico"}${sfx}`);
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king", LITERA: "Litera" };
    if (b.bed !== "NONE" && bedMap[b.bed]) add("OTHER", `${bedMap[b.bed]}${b.bedCount > 1 ? ` × ${b.bedCount}` : ""}${sfx}`);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) add("OTHER", `${closetMap[b.closet]}${sfx}`);
    if (b.tv === "YES") add("OTHER", `Televisión${sfx}`);
    for (const f of b.furnitureOther) add("OTHER", `${f}${sfx}`);
  }
  for (let i = 0; i < s2.bedrooms; i++) {
    addBedContent(eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ, s2.bedrooms > 1 ? ` - Recámara ${i + 1}` : " - Recámara");
  }
  if (s2.hasCuartoServicio) addBedContent(eq.cuartoServicio, " - Cuarto de servicio");
  if (s2.hasSala) {
    addAC(eq.sala.ac, " - Sala");
    if (eq.sala.fan === "YES") add("FAN", "Ventilador de techo - Sala");
    const furMap: Record<string, string> = { SALA: "Juego de sala", TV: "Televisión - Sala", MESA_CENTRO: "Mesa de centro - Sala" };
    for (const f of eq.sala.furniture) if (furMap[f]) add("OTHER", furMap[f]);
    for (const f of eq.sala.furnitureOther) add("OTHER", `${f} - Sala`);
    if (eq.sala.guestBath !== "NONE") {
      add("OTHER", eq.sala.guestBath === "FULL" ? "Baño de visitas completo - Sala" : "Medio baño de visitas - Sala");
      if (eq.sala.guestBath === "FULL") {
        if (eq.sala.guestBathShower !== "NONE" && SHOWER_LABEL[eq.sala.guestBathShower]) add("OTHER", `${SHOWER_LABEL[eq.sala.guestBathShower]} - Sala`);
        if (eq.sala.guestBathHasTub) add("OTHER", "Tina - Sala");
        if (eq.sala.guestBathHasJacuzzi) add("OTHER", "Jacuzzi - Sala");
      }
    }
  }
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
  if (s2.hasLavanderia) {
    if (!s2.hasCuartoMaquinas) addBoilers(eq.lavanderia.boilers, " - Lavandería");
    if (eq.lavanderia.centroCarga === "YES") add("OTHER", "Centro de lavado vertical - Lavandería");
    else {
      if (eq.lavanderia.washer === "YES") add("WASHER", "Lavadora - Lavandería");
      if (eq.lavanderia.dryer !== "NONE") add("DRYER", `Secadora ${eq.lavanderia.dryer === "GAS" ? "gas" : "eléctrica"} - Lavandería`);
    }
  }
  if (s2.hasCuartoMaquinas) addBoilers(eq.cuartoMaquinas.boilers, " - Cuarto de máquinas");
  if (!s2.hasLavanderia && !s2.hasCuartoMaquinas) {
    const f = eq.equiposFuncionales;
    addBoilers(f.boilers, "");
    if (f.centroCarga === "YES") add("OTHER", "Centro de lavado vertical");
    else {
      if (f.washer === "YES") add("WASHER", "Lavadora");
      if (f.dryer !== "NONE") add("DRYER", `Secadora ${f.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
  }
  if (s2.hasComedor) {
    addAC(eq.comedor.ac, " - Comedor");
    const fMap: Record<string, string> = { COMEDOR_COMPLETO: "Comedor completo", SOLO_MESA: "Mesa de comedor", MESA_SILLAS: "Mesa con sillas" };
    if (eq.comedor.furniture !== "NONE" && fMap[eq.comedor.furniture]) add("OTHER", fMap[eq.comedor.furniture]);
  }
  const centralSpaces = getCentralSpaces(s2, eq);
  if (centralSpaces.length > 0) add("OTHER", `Sistema de aire central ${eq.aireCentral.capacity} ton`);
  return rows;
}

/* ─── buildSummaryGroups ─────────────────────────────────────────────── */

function buildSummaryGroups(s2: Step2, eq: Equipment): SummaryGroup[] {
  const groups: SummaryGroup[] = [];
  function addBed(b: BedroomEq): string[] {
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
    const bedMap: Record<string, string> = { INDIVIDUAL: "Cama individual", MATRIMONIAL: "Cama matrimonial", QUEEN: "Cama queen", KING: "Cama king", LITERA: "Litera" };
    if (b.bed !== "NONE" && bedMap[b.bed]) items.push(`${bedMap[b.bed]}${b.bedCount > 1 ? ` × ${b.bedCount}` : ""}`);
    const closetMap: Record<string, string> = { ARMARIO: "Armario", CLOSET: "Closet", WALK_IN: "Walk-in closet" };
    if (b.closet !== "NONE" && closetMap[b.closet]) items.push(closetMap[b.closet]);
    if (b.tv === "YES") items.push("Televisión");
    for (const f of b.furnitureOther) items.push(f);
    return items;
  }
  for (let i = 0; i < s2.bedrooms; i++) {
    groups.push({ key: `bed-${i}`, label: s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara", Icon: BedDouble, items: addBed(eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ) });
  }
  if (s2.hasCuartoServicio) groups.push({ key: "cuartoServicio", label: "Cuarto de servicio", Icon: BedDouble, items: addBed(eq.cuartoServicio) });
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
      if (eq.sala.guestBath === "FULL") {
        if (eq.sala.guestBathShower !== "NONE" && SHOWER_LABEL[eq.sala.guestBathShower]) items.push(SHOWER_LABEL[eq.sala.guestBathShower]);
        if (eq.sala.guestBathHasTub) items.push("Tina");
        if (eq.sala.guestBathHasJacuzzi) items.push("Jacuzzi");
      }
    }
    groups.push({ key: "sala", label: "Sala", Icon: Sofa, items });
  }
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
  function boilerItems(boilers: BoilerUnit[]): string[] {
    const total = boilers.length;
    return boilers.map((b, i) => {
      const cap = IS_DEP(b.type) ? ` ${b.capacity}` : "";
      const svc = IS_PASO(b.type) && b.services !== "1" ? ` — ${b.services} servicios` : "";
      if (total === 1) return `${BOILER_NAME[b.type] ?? b.type}${cap}${svc}`;
      const svcM = IS_PASO(b.type) ? ` ${b.services} servicio${b.services !== "1" ? "s" : ""}` : "";
      return `Boiler ${i + 1}: ${BOILER_SHORT[b.type] ?? b.type}${cap}${svcM}`;
    });
  }
  if (s2.hasLavanderia) {
    const items: string[] = [];
    if (!s2.hasCuartoMaquinas) items.push(...boilerItems(eq.lavanderia.boilers));
    if (eq.lavanderia.centroCarga === "YES") items.push("Centro de lavado vertical");
    else {
      if (eq.lavanderia.washer === "YES") items.push("Lavadora");
      if (eq.lavanderia.dryer !== "NONE") items.push(`Secadora ${eq.lavanderia.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
    groups.push({ key: "lavanderia", label: "Lavandería", Icon: Shirt, items });
  }
  if (s2.hasCuartoMaquinas) {
    groups.push({ key: "cuartoMaquinas", label: "Cuarto de máquinas", Icon: Wrench, items: boilerItems(eq.cuartoMaquinas.boilers) });
  }
  if (!s2.hasLavanderia && !s2.hasCuartoMaquinas) {
    const f = eq.equiposFuncionales;
    const items: string[] = [...boilerItems(f.boilers)];
    if (f.centroCarga === "YES") items.push("Centro de lavado vertical");
    else {
      if (f.washer === "YES") items.push("Lavadora");
      if (f.dryer !== "NONE") items.push(`Secadora ${f.dryer === "GAS" ? "gas" : "eléctrica"}`);
    }
    if (items.length > 0) groups.push({ key: "funcionales", label: "Equipos funcionales", Icon: Wrench, items });
  }
  if (s2.hasComedor) {
    const items: string[] = [];
    const t = acTypeOf(eq.comedor.ac);
    if (t === "MINI" || t === "FAN_COIL") items.push(`${t === "MINI" ? "Minisplit" : "Fan & coil"} ${capLabel(acCapOf(eq.comedor.ac))}`);
    else if (t === "CENTRAL") items.push("Aire central (sistema)");
    const fMap: Record<string, string> = { COMEDOR_COMPLETO: "Comedor completo", SOLO_MESA: "Mesa de comedor", MESA_SILLAS: "Mesa con sillas" };
    if (eq.comedor.furniture !== "NONE" && fMap[eq.comedor.furniture]) items.push(fMap[eq.comedor.furniture]);
    groups.push({ key: "comedor", label: "Comedor", Icon: UtensilsCrossed, items });
  }
  const centralSpaces = getCentralSpaces(s2, eq);
  if (centralSpaces.length > 0) {
    groups.push({ key: "aireCentral", label: "Sistema de aire central", Icon: Wind, items: [`Espacios: ${centralSpaces.join(", ")}`, `Tonelaje: ${eq.aireCentral.capacity} ton`] });
  }
  return groups;
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

const STEP_INPUT: React.CSSProperties = {
  width: "100%", padding: 10, border: "1px solid var(--border-default)",
  borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box", fontSize: "0.875rem",
};

function ps(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
    border: active ? "2px solid var(--accent)" : "1.5px solid var(--border-default)",
    background: active ? "var(--accent-tint-soft)" : "var(--bg-card)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)" }}>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 30, height: 30, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", fontSize: "1.125rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>−</button>
        <span style={{ fontSize: "1.125rem", fontWeight: 700, minWidth: 20, textAlign: "center" }}>{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width: 30, height: 30, borderRadius: "var(--border-radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", fontSize: "1.125rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>+</button>
      </div>
    </div>
  );
}

function Expand({ show, id, children }: { show: boolean; id: string; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div key={id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IncludeToggle({ included, onInclude, onExclude, children }: {
  included: boolean; onInclude: () => void; onExclude: () => void; children?: ReactNode;
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

function AcSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = acTypeOf(value); const c = acCapOf(value);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Radio value={t}
        onChange={(newT) => {
          if (newT === "NONE") onChange("NONE");
          else if (newT === "CENTRAL") onChange("CENTRAL");
          else onChange(`${newT}_${(t === "MINI" || t === "FAN_COIL") ? c : "1T"}`);
        }}
        options={[{ value: "NONE", label: "No incluye" }, { value: "MINI", label: "Minisplit" }, { value: "CENTRAL", label: "Aire central" }, { value: "FAN_COIL", label: "Fan & coil" }]}
      />
      <Expand show={t === "MINI" || t === "FAN_COIL"} id="ac-cap">
        <Radio value={c} onChange={(newC) => onChange(`${t}_${newC}`)}
          options={[{ value: "1T", label: "1 ton" }, { value: "1_5T", label: "1.5 ton" }, { value: "2T", label: "2 ton" }, { value: "3T", label: "3 ton" }, ...(t === "FAN_COIL" ? [{ value: "5T", label: "5 ton" }] : [])]}
        />
      </Expand>
    </div>
  );
}

function PillsInput({ value, onChange, placeholder = "Agregar..." }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add() { const t = input.trim(); if (!t) return; onChange([...value, t]); setInput(""); }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none" }} />
        <button type="button" onClick={add}
          style={{ padding: "0 12px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          Agregar
        </button>
      </div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {value.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 600, background: "var(--accent-tint-soft)", color: "var(--accent)" }}>
              {item}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center" }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export default function SpaceTemplateWizardModal({
  open, propertyId, companyId, spaceType, editTemplate, onClose, onSuccess,
}: Props) {
  const isResidential = RESIDENTIAL_TYPES.includes(spaceType);
  const isEdit = !!editTemplate;

  const [step, setStep]         = useState(1);
  const [stepDir, setStepDir]   = useState<"left" | "right">("right");
  const [s1, setS1]             = useState<Step1>({ ...INIT_S1 });
  const [s2, setS2]             = useState<Step2>({ ...INIT_S2 });
  const [eq, setEq]             = useState<Equipment>(JSON.parse(JSON.stringify(INIT_EQ)) as Equipment);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [saving, setSaving]     = useState(false);
  const [s1Error, setS1Error]   = useState("");
  const [customSpaceInput, setCustomSpaceInput] = useState("");
  const [showCustomInput, setShowCustomInput]   = useState(false);
  const [draftFound, setDraftFound] = useState(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const draftTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Auto-save draft */
  useEffect(() => {
    if (!open || !propertyId || isEdit) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(propertyId, { step, s1, s2, eq }), 400);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [open, propertyId, step, s1, s2, eq, isEdit]);

  /* Check for draft on open */
  useEffect(() => {
    if (open && propertyId && !isEdit) {
      const draft = loadDraft(propertyId);
      if (draft?.s1.name.trim()) setDraftFound(true);
    }
  }, [open, propertyId, isEdit]);

  /* Populate from editTemplate */
  useEffect(() => {
    if (open && editTemplate) {
      setS1({ name: editTemplate.name, description: editTemplate.wizard_state?.s1?.description ?? "" });
      if (editTemplate.wizard_state?.s2) {
        setS2({ ...INIT_S2, ...editTemplate.wizard_state.s2 });
        setEq(editTemplate.wizard_state.eq
          ? (JSON.parse(JSON.stringify(editTemplate.wizard_state.eq)) as Equipment)
          : JSON.parse(JSON.stringify(INIT_EQ)) as Equipment);
      } else {
        setS2({ ...INIT_S2, bedrooms: editTemplate.bedrooms ?? 1 });
      }
      setStep(1); setDraftFound(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTemplate?.id]);

  /* Scroll panel on space change */
  useEffect(() => { rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [selectedSpace]);

  /* ── Helpers ── */

  function reset() {
    setStep(1); setS1({ ...INIT_S1 }); setS2({ ...INIT_S2 });
    setEq(JSON.parse(JSON.stringify(INIT_EQ)) as Equipment);
    setSelectedSpace(""); setSaving(false); setS1Error("");
    setCustomSpaceInput(""); setShowCustomInput(false); setDraftFound(false);
    if (propertyId && !isEdit) clearDraft(propertyId);
  }

  function handleClose() { reset(); onClose(); }

  function syncBedroomArray(newS2: Step2): Equipment {
    const prev = eq.bedrooms;
    return { ...eq, bedrooms: Array.from({ length: newS2.bedrooms }, (_, i) => prev[i] ?? { ...DEFAULT_BEDROOM_EQ }) };
  }

  function goNext() {
    if (step === 1) {
      if (!s1.name.trim()) { setS1Error("El nombre de la plantilla es obligatorio."); return; }
      setS1Error("");
    }
    if (step === 2 && isResidential) setEq(syncBedroomArray(s2));
    setStepDir("right");
    setStep((p) => Math.min(p + 1, WIZARD_STEPS.length));
  }

  function goBack() { setStepDir("left"); setStep((p) => Math.max(1, p - 1)); }

  function handleStepJump(target: number) {
    if (isResidential && target === 3 && step !== 3) setEq(syncBedroomArray(s2));
    setStepDir(target > step ? "right" : "left");
    setStep(target);
  }

  function toggleSpace(key: string) { setS2((p) => ({ ...p, [key]: !p[key as keyof Step2] })); }

  function buildPayload() {
    const showFuncionales = !s2.hasLavanderia && !s2.hasCuartoMaquinas;
    const hasWasher =
      (s2.hasLavanderia && (eq.lavanderia.centroCarga === "YES" || eq.lavanderia.washer === "YES")) ||
      (showFuncionales && (eq.equiposFuncionales.centroCarga === "YES" || eq.equiposFuncionales.washer === "YES"));
    const hasDryer =
      (s2.hasLavanderia && eq.lavanderia.centroCarga !== "YES" && eq.lavanderia.dryer !== "NONE") ||
      (showFuncionales && eq.equiposFuncionales.centroCarga !== "YES" && eq.equiposFuncionales.dryer !== "NONE");
    const stoveType = eq.cocina.stoveType === "GAS" ? "GAS"
      : eq.cocina.stoveType === "ELECTRIC" ? "ELECTRIC"
      : eq.cocina.stoveType === "INDUCTION" ? "ELECTRIC"
      : "NONE";
    return {
      name: s1.name.trim(),
      bedrooms: s2.bedrooms,
      bathrooms: computeBathroomsComplete(s2, eq),
      has_living_room: s2.hasSala,
      has_dining_room: s2.hasComedor,
      has_patio: s2.hasPatio,
      has_fridge: eq.cocina.fridge !== "NONE",
      has_washer: hasWasher,
      has_dryer: hasDryer,
      stove_type: stoveType,
      wizard_state: { s1: { description: s1.description.trim() || null }, s2, eq },
    };
  }

  async function handleCreate() {
    setSaving(true);
    const payload = {
      property_id: propertyId,
      company_id: companyId,
      space_type: spaceType,
      ...buildPayload(),
    };
    const { data: inserted, error } = await supabase
      .from("space_templates").insert(payload).select("id").single();
    if (error || !inserted) {
      toast.error(error?.message ?? "Error creando plantilla");
      setSaving(false); return;
    }
    const assetRows = buildAssetRows(s2, eq);
    if (assetRows.length > 0) {
      await supabase.from("space_template_assets")
        .insert(assetRows.map((r) => ({ ...r, space_template_id: inserted.id })));
    }
    if (propertyId) clearDraft(propertyId);
    toast.success("Plantilla creada con equipamiento");
    reset(); onSuccess(); onClose();
  }

  async function handleEdit() {
    if (!editTemplate) return;
    setSaving(true);
    const { error } = await supabase.from("space_templates")
      .update(buildPayload()).eq("id", editTemplate.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("space_template_assets").delete().eq("space_template_id", editTemplate.id);
    const assetRows = buildAssetRows(s2, eq);
    if (assetRows.length > 0) {
      await supabase.from("space_template_assets")
        .insert(assetRows.map((r) => ({ ...r, space_template_id: editTemplate.id })));
    }
    toast.success("Plantilla actualizada");
    reset(); onSuccess(); onClose();
  }

  /* ── Count helpers for lateral panel badges ── */

  function bedroomCount(b: BedroomEq) {
    return (b.hasOwnBath ? 1 : 0) + (b.ac !== "NONE" ? 1 : 0) + (b.fan === "YES" ? 1 : 0)
      + (b.heater !== "NONE" ? 1 : 0) + (b.bed !== "NONE" ? b.bedCount : 0)
      + (b.closet !== "NONE" ? 1 : 0) + (b.tv === "YES" ? 1 : 0) + b.furnitureOther.length;
  }
  function salaCount(s: SalaEq) {
    return (s.ac !== "NONE" ? 1 : 0) + (s.fan === "YES" ? 1 : 0) + s.furniture.length + s.furnitureOther.length
      + (s.guestBath !== "NONE" ? 1 : 0) + (s.guestBath === "FULL" && s.guestBathHasTub ? 1 : 0)
      + (s.guestBath === "FULL" && s.guestBathHasJacuzzi ? 1 : 0);
  }
  function cocinaCount(c: CocinaEq) {
    return (c.ac !== "NONE" ? 1 : 0) + (c.stoveType !== "NONE" ? 1 : 0) + (c.oven !== "NONE" ? 1 : 0)
      + (c.fridge !== "NONE" ? 1 : 0) + c.others.length + (c.hasHalfBath ? 1 : 0);
  }
  function lavanderiaCount(l: LavanderiaEq) {
    return l.boilers.length + (l.centroCarga === "YES" ? 1 : (l.washer === "YES" ? 1 : 0) + (l.dryer !== "NONE" ? 1 : 0));
  }
  function funcionalesCount(f: EquiposFuncionalesEq) {
    return f.boilers.length + (f.centroCarga === "YES" ? 1 : (f.washer === "YES" ? 1 : 0) + (f.dryer !== "NONE" ? 1 : 0));
  }
  function comedorCount(c: ComedorEq) { return (c.ac !== "NONE" ? 1 : 0) + (c.furniture !== "NONE" ? 1 : 0); }

  const showFuncionales = !s2.hasLavanderia && !s2.hasCuartoMaquinas;
  const centralSpaces = getCentralSpaces(s2, eq);

  const panelSpaces = [
    ...Array.from({ length: s2.bedrooms }, (_, i) => ({ key: `bed-${i}`, label: s2.bedrooms > 1 ? `Recámara ${i + 1}` : "Recámara", Icon: BedDouble, count: bedroomCount(eq.bedrooms[i] ?? DEFAULT_BEDROOM_EQ) })),
    ...(s2.hasCuartoServicio ? [{ key: "cuartoServicio", label: "Cuarto de servicio", Icon: BedDouble, count: bedroomCount(eq.cuartoServicio) }] : []),
    ...(s2.hasSala   ? [{ key: "sala",    label: "Sala",    Icon: Sofa,            count: salaCount(eq.sala)                }] : []),
    ...(s2.hasCocina ? [{ key: "cocina",  label: "Cocina",  Icon: UtensilsCrossed, count: cocinaCount(eq.cocina)            }] : []),
    ...(s2.hasComedor ? [{ key: "comedor", label: "Comedor", Icon: UtensilsCrossed, count: comedorCount(eq.comedor)         }] : []),
    ...(s2.hasLavanderia ? [{ key: "lavanderia", label: "Lavandería", Icon: Shirt, count: lavanderiaCount(eq.lavanderia)    }] : []),
    ...(s2.hasCuartoMaquinas ? [{ key: "cuartoMaquinas", label: "Cuarto de máquinas", Icon: Wrench, count: eq.cuartoMaquinas.boilers.length }] : []),
    ...(centralSpaces.length > 0 ? [{ key: "aireCentral", label: "Aire central", Icon: Wind, count: centralSpaces.length }] : []),
  ];

  const activeKey = panelSpaces.some(p => p.key === selectedSpace) ? selectedSpace : (panelSpaces[0]?.key ?? "");
  const activeSpace = panelSpaces.find(p => p.key === activeKey);

  /* ── Eq updaters ── */
  function setBedEq<K extends keyof BedroomEq>(i: number, k: K, v: BedroomEq[K]) {
    setEq((prev) => { const arr = [...prev.bedrooms]; arr[i] = { ...arr[i]!, [k]: v }; return { ...prev, bedrooms: arr }; });
  }
  function setCuartoServ<K extends keyof BedroomEq>(k: K, v: BedroomEq[K]) {
    setEq((prev) => ({ ...prev, cuartoServicio: { ...prev.cuartoServicio, [k]: v } }));
  }
  function setSala<K extends keyof SalaEq>(k: K, v: SalaEq[K]) {
    setEq((prev) => ({ ...prev, sala: { ...prev.sala, [k]: v } }));
  }
  function setCocina<K extends keyof CocinaEq>(k: K, v: CocinaEq[K]) {
    setEq((prev) => ({ ...prev, cocina: { ...prev.cocina, [k]: v } }));
  }
  function setLav<K extends keyof LavanderiaEq>(k: K, v: LavanderiaEq[K]) {
    setEq((prev) => ({ ...prev, lavanderia: { ...prev.lavanderia, [k]: v } }));
  }
  function setCuartoMaq<K extends keyof CuartoMaquinasEq>(k: K, v: CuartoMaquinasEq[K]) {
    setEq((prev) => ({ ...prev, cuartoMaquinas: { ...prev.cuartoMaquinas, [k]: v } }));
  }
  function setFuncionales<K extends keyof EquiposFuncionalesEq>(k: K, v: EquiposFuncionalesEq[K]) {
    setEq((prev) => ({ ...prev, equiposFuncionales: { ...prev.equiposFuncionales, [k]: v } }));
  }
  function setComedor<K extends keyof ComedorEq>(k: K, v: ComedorEq[K]) {
    setEq((prev) => ({ ...prev, comedor: { ...prev.comedor, [k]: v } }));
  }

  /* ── Boilers UI section ── */
  function boilersSection(boilers: BoilerUnit[], onBoilers: (v: BoilerUnit[]) => void) {
    const btnStyle: React.CSSProperties = {
      width: 24, height: 24, borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)",
      background: "var(--bg-input)", cursor: "pointer", fontSize: "0.9375rem",
      display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)",
    };
    function updateAt(idx: number, patch: Partial<BoilerUnit>) {
      const next = [...boilers]; next[idx] = { ...next[idx]!, ...patch }; onBoilers(next);
    }
    return (
      <div style={{ marginBottom: 14 }}>
        {eqRow("Boilers", (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" style={btnStyle}
              onClick={() => { if (boilers.length > 1) onBoilers(boilers.slice(0, -1)); }}>−</button>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, minWidth: 16, textAlign: "center" }}>{boilers.length}</span>
            <button type="button" style={btnStyle}
              onClick={() => onBoilers([...boilers, { type: "DEP_GAS", capacity: "60L", services: "1" }])}>+</button>
          </div>
        ))}
        <AnimatePresence initial={false}>
          {boilers.map((b, i) => (
            <motion.div key={i} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
              <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-md)", padding: "12px 14px", marginBottom: 8 }}>
                {boilers.length > 1 && <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Boiler {i + 1}</div>}
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Tipo</div>
                  <Radio value={b.type} onChange={(v) => updateAt(i, { type: v })} options={BOILER_TYPE_OPTIONS} />
                  <Expand show={IS_DEP(b.type)} id={`dep-${i}`}>
                    <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Capacidad</div>
                      <Radio value={b.capacity} onChange={(v) => updateAt(i, { capacity: v })} options={BOILER_CAP_OPTIONS} />
                    </div>
                  </Expand>
                  <Expand show={IS_PASO(b.type)} id={`svc-${i}`}>
                    <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Servicios</div>
                      <Radio value={b.services} onChange={(v) => updateAt(i, { services: v })}
                        options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4+", label: "4+" }]} />
                    </div>
                  </Expand>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  function eqRow(label: string, children: ReactNode) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
        {children}
      </div>
    );
  }

  function bedBathRows(bEq: BedroomEq, onBath: (v: boolean) => void, onShower: (v: string) => void, onTub: (v: boolean) => void, onJac: (v: boolean) => void) {
    return eqRow("Baño propio", (
      <div style={{ display: "grid", gap: 8 }}>
        <Radio value={bEq.hasOwnBath ? "YES" : "NO"} onChange={(v) => onBath(v === "YES")}
          options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
        <Expand show={bEq.hasOwnBath} id="bath-det">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
            <div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Regadera</div>
              <Radio value={bEq.shower !== "NONE" ? "YES" : "NO"} onChange={(v) => onShower(v === "YES" ? "NORMAL" : "NONE")}
                options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
            </div>
            <div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Tina</div>
              <Radio value={bEq.hasTub ? "YES" : "NO"} onChange={(v) => onTub(v === "YES")}
                options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
            </div>
            <div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Jacuzzi</div>
              <Radio value={bEq.hasJacuzzi ? "YES" : "NO"} onChange={(v) => onJac(v === "YES")}
                options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
            </div>
          </div>
        </Expand>
      </div>
    ));
  }

  /* ── spaceContent for Step 3 ── */
  function spaceContent(key: string): ReactNode {
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
          {eqRow("Cama", (
            <div style={{ display: "grid", gap: 8 }}>
              <Radio value={bEq.bed} onChange={(v) => { setBedEq(i, "bed", v); if (v === "NONE") setBedEq(i, "bedCount", 1); }}
                options={[{ value: "NONE", label: "No incluye" }, { value: "INDIVIDUAL", label: "Individual" }, { value: "MATRIMONIAL", label: "Matrimonial" }, { value: "QUEEN", label: "Queen" }, { value: "KING", label: "King" }, { value: "LITERA", label: "Litera" }]} />
              <Expand show={bEq.bed !== "NONE"} id={`bed-count-${i}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>Cantidad</span>
                  <button type="button" onClick={() => setBedEq(i, "bedCount", Math.max(1, bEq.bedCount - 1))} style={{ width: 24, height: 24, borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontWeight: 700 }}>{bEq.bedCount}</span>
                  <button type="button" onClick={() => setBedEq(i, "bedCount", bEq.bedCount + 1)} style={{ width: 24, height: 24, borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-input)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </Expand>
            </div>
          ))}
          {eqRow("Closet", <Radio value={bEq.closet} onChange={(v) => setBedEq(i, "closet", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "ARMARIO", label: "Armario" }, { value: "CLOSET", label: "Closet" }, { value: "WALK_IN", label: "Walk-in closet" }]} />)}
          {eqRow("Televisión", <Radio value={bEq.tv} onChange={(v) => setBedEq(i, "tv", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
          {eqRow("Otro mobiliario", <PillsInput value={bEq.furnitureOther} onChange={(v) => setBedEq(i, "furnitureOther", v)} />)}
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
          {eqRow("Cama", <Radio value={b.bed} onChange={(v) => { setCuartoServ("bed", v); if (v === "NONE") setCuartoServ("bedCount", 1); }} options={[{ value: "NONE", label: "No incluye" }, { value: "INDIVIDUAL", label: "Individual" }, { value: "MATRIMONIAL", label: "Matrimonial" }, { value: "QUEEN", label: "Queen" }, { value: "LITERA", label: "Litera" }]} />)}
          {eqRow("Closet", <Radio value={b.closet} onChange={(v) => setCuartoServ("closet", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "ARMARIO", label: "Armario" }, { value: "CLOSET", label: "Closet" }]} />)}
          {eqRow("Televisión", <Radio value={b.tv} onChange={(v) => setCuartoServ("tv", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
          {eqRow("Otro mobiliario", <PillsInput value={b.furnitureOther} onChange={(v) => setCuartoServ("furnitureOther", v)} />)}
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
          <Radio value={eq.sala.guestBath} onChange={(v) => { setSala("guestBath", v); if (v !== "FULL") { setSala("guestBathShower", "NONE"); setSala("guestBathHasTub", false); setSala("guestBathHasJacuzzi", false); } }}
            options={[{ value: "NONE", label: "No incluye" }, { value: "HALF", label: "Medio baño" }, { value: "FULL", label: "Baño completo" }]} />
          <Expand show={eq.sala.guestBath === "FULL"} id="guest-full">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Regadera</div>
                <Radio value={eq.sala.guestBathShower !== "NONE" ? "YES" : "NO"} onChange={(v) => setSala("guestBathShower", v === "YES" ? "NORMAL" : "NONE")} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Tina</div>
                <Radio value={eq.sala.guestBathHasTub ? "YES" : "NO"} onChange={(v) => setSala("guestBathHasTub", v === "YES")} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 4 }}>Jacuzzi</div>
                <Radio value={eq.sala.guestBathHasJacuzzi ? "YES" : "NO"} onChange={(v) => setSala("guestBathHasJacuzzi", v === "YES")} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />
              </div>
            </div>
          </Expand>
        </div>)}
      </>
    );
    if (key === "cocina") return (
      <>
        {eqRow("Aire acondicionado", <AcSection value={eq.cocina.ac} onChange={(v) => setCocina("ac", v)} />)}
        {eqRow("Estufa / parrilla", <IncludeToggle included={eq.cocina.stoveType !== "NONE"} onExclude={() => setCocina("stoveType", "NONE")} onInclude={() => setCocina("stoveType", "GAS")}>
          <div style={{ display: "grid", gap: 8 }}>
            <Radio value={eq.cocina.stoveType} onChange={(v) => { setCocina("stoveType", v); setCocina("stoveBurners", v === "INDUCTION" ? "2" : "4Q"); }}
              options={[{ value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }, { value: "INDUCTION", label: "Inducción" }]} />
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
            <input value={eq.cocina.fridgeModel} onChange={(e) => setCocina("fridgeModel", e.target.value)} placeholder="Modelo (opcional)" style={{ ...STEP_INPUT, marginTop: 4 }} />
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
        {!s2.hasCuartoMaquinas && boilersSection(eq.lavanderia.boilers, (v) => setLav("boilers", v))}
        {eqRow("Centro de lavado vertical", <Radio value={eq.lavanderia.centroCarga} onChange={(v) => setLav("centroCarga", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
        <Expand show={eq.lavanderia.centroCarga !== "YES"} id="washer-dryer">
          <>
            {eqRow("Lavadora", <Radio value={eq.lavanderia.washer} onChange={(v) => setLav("washer", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
            {eqRow("Secadora", <Radio value={eq.lavanderia.dryer} onChange={(v) => setLav("dryer", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }]} />)}
          </>
        </Expand>
      </>
    );
    if (key === "cuartoMaquinas") return <>{boilersSection(eq.cuartoMaquinas.boilers, (v) => setCuartoMaq("boilers", v))}</>;
    if (key === "aireCentral") return (
      <>
        {eqRow("Espacios cubiertos", (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {centralSpaces.map((sp) => (
              <span key={sp} style={{ padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--accent-tint-soft)", color: "var(--accent)", border: "1px solid var(--accent)" }}>{sp}</span>
            ))}
          </div>
        ))}
        {eqRow("Tonelaje del sistema (ton)", (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={1} max={50} step={0.5} value={eq.aireCentral.capacity}
              onChange={(e) => setEq((prev) => ({ ...prev, aireCentral: { capacity: e.target.value } }))}
              style={{ ...STEP_INPUT, width: 100 }} />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>ton</span>
          </div>
        ))}
      </>
    );
    return null;
  }

  /* ── Space toggle button ── */
  function spaceToggle(key: string, label: string, Icon: React.ElementType) {
    const on = s2[key as keyof Step2] as boolean;
    return (
      <button key={key} type="button" onClick={() => toggleSpace(key)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 8px", borderRadius: "var(--border-radius-md)", cursor: "pointer", border: on ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: on ? "var(--accent-tint-soft)" : "var(--bg-card)", color: on ? "var(--accent)" : "var(--text-secondary)" }}>
        <Icon size={18} />
        <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>{label}</span>
      </button>
    );
  }

  /* ── Render steps ── */
  const typeDisplay = SPACE_TYPE_DISPLAY[spaceType] ?? spaceType;
  const modalTitle = isEdit
    ? `Editar plantilla — ${typeDisplay}`
    : `Nueva plantilla — ${typeDisplay}`;

  /* Non-residential placeholder (for Pieza 1-B) */
  if (!isResidential) {
    return (
      <WizardShell
        open={open}
        title={modalTitle}
        steps={[{ label: "Próximamente" }]}
        currentStep={1}
        stepDir="right"
        onNext={() => {}}
        onBack={() => {}}
        onCancel={handleClose}
        onFinish={handleClose}
        finalLabel="Cerrar"
      >
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          <p style={{ margin: 0 }}>El wizard para el tipo <strong style={{ color: "var(--text-primary)" }}>{typeDisplay}</strong> está en construcción.</p>
          <p style={{ margin: "8px 0 0", fontSize: "0.8125rem" }}>Disponible en Fase 4 Pieza 1-B.</p>
        </div>
      </WizardShell>
    );
  }

  function renderStep(): ReactNode {
    if (step === 1) return (
      <div style={{ display: "grid", gap: 14 }}>
        {draftFound && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: "var(--border-radius-md)", background: "var(--accent-tint-soft)", border: "1px solid var(--accent-tint-medium)" }}>
            <span style={{ flex: 1, fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 600 }}>Hay un borrador guardado. ¿Deseas restaurarlo?</span>
            <button type="button" onClick={() => {
              const draft = loadDraft(propertyId);
              if (!draft) return;
              setStep(draft.step); setS1(draft.s1); setS2(draft.s2); setEq(draft.eq); setDraftFound(false);
            }} style={{ padding: "4px 10px", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--border-radius-sm)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Restaurar</button>
            <button type="button" onClick={() => { clearDraft(propertyId); setDraftFound(false); }}
              style={{ padding: "4px 10px", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--border-radius-sm)", border: "1px solid var(--accent-tint-medium)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>Descartar</button>
          </div>
        )}
        <AppFormField label="Nombre de la plantilla" required>
          <input value={s1.name}
            onChange={(e) => { setS1((p) => ({ ...p, name: e.target.value })); setS1Error(""); }}
            placeholder={`Ej. ${typeDisplay} Tipo A — 2 recámaras`}
            style={STEP_INPUT} />
          {s1Error && <p style={{ margin: "4px 0 0", color: "var(--metric-value-red)", fontSize: "0.75rem" }}>{s1Error}</p>}
        </AppFormField>
        <AppFormField label="Descripción">
          <textarea value={s1.description}
            onChange={(e) => setS1((p) => ({ ...p, description: e.target.value }))}
            placeholder="Descripción opcional de la plantilla..."
            rows={3} style={{ ...STEP_INPUT, resize: "vertical" }} />
        </AppFormField>
      </div>
    );

    if (step === 2) return (
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Privados</p>
          <div style={{ display: "grid", gap: 10 }}>
            <Counter label="Recámaras" value={s2.bedrooms} onChange={(v) => setS2((p) => ({ ...p, bedrooms: v }))} min={0} max={10} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(6.875rem, 1fr))", gap: 8 }}>
              {PRIVADOS_SPACES.map(({ key, label, Icon }) => spaceToggle(key, label, Icon))}
            </div>
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sociales</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(6.875rem, 1fr))", gap: 8 }}>
            {SOCIALES_SPACES.map(({ key, label, Icon }) => spaceToggle(key, label, Icon))}
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 10px", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Servicio</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(6.875rem, 1fr))", gap: 8 }}>
            {SERVICIO_SPACES.map(({ key, label, Icon }) => spaceToggle(key, label, Icon))}
            <button type="button" onClick={() => setShowCustomInput((v) => !v)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 8px", borderRadius: "var(--border-radius-md)", cursor: "pointer", border: (showCustomInput || s2.customSpaces.length > 0) ? "2px solid var(--accent)" : "1.5px solid var(--border-default)", background: (showCustomInput || s2.customSpaces.length > 0) ? "var(--accent-tint-soft)" : "var(--bg-card)", color: (showCustomInput || s2.customSpaces.length > 0) ? "var(--accent)" : "var(--text-secondary)" }}>
              <Plus size={18} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Otro</span>
            </button>
          </div>
          {showCustomInput && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <input value={customSpaceInput} onChange={(e) => setCustomSpaceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const n = customSpaceInput.trim(); if (n) { setS2((p) => ({ ...p, customSpaces: [...p.customSpaces, n] })); setCustomSpaceInput(""); } } }}
                placeholder="Ej. Estudio, Terraza privada..."
                style={{ ...STEP_INPUT, flex: 1, fontSize: "0.8125rem" }} />
              <button type="button" onClick={() => { const n = customSpaceInput.trim(); if (n) { setS2((p) => ({ ...p, customSpaces: [...p.customSpaces, n] })); setCustomSpaceInput(""); } }}
                style={{ padding: "0 14px", borderRadius: "var(--border-radius-md)", border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Agregar
              </button>
            </div>
          )}
          {s2.customSpaces.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {s2.customSpaces.map((cs, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--accent-tint-soft)", color: "var(--accent)" }}>
                  {cs}
                  <button type="button" onClick={() => setS2((p) => ({ ...p, customSpaces: p.customSpaces.filter((_, j) => j !== i) }))}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center" }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    if (step === 3) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", height: 560, border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
          {/* Panel izquierdo */}
          <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border-default)", overflowY: "hidden", background: "var(--bg-page)" }}>
            {panelSpaces.map((sp) => {
              const active = sp.key === activeKey;
              const SpIcon = sp.Icon;
              return (
                <button key={sp.key} type="button" onClick={() => setSelectedSpace(sp.key)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", padding: "7px 14px", border: "none", borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent", background: active ? "var(--accent-tint-soft)" : "transparent", cursor: "pointer", transition: "background 0.12s", borderBottom: "1px solid var(--border-default)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
                    <SpIcon size={15} color={active ? "var(--accent)" : "var(--text-muted)"} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sp.label}</span>
                  </div>
                  {sp.count > 0 && (
                    <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 999, background: active ? "var(--accent-tint-medium)" : "var(--bg-input)", color: active ? "var(--accent)" : "var(--text-muted)", fontSize: "0.6875rem", fontWeight: 700 }}>{sp.count}</span>
                  )}
                </button>
              );
            })}
            {panelSpaces.length === 0 && (
              <div style={{ padding: 16, fontSize: "0.75rem", color: "var(--text-muted)" }}>Sin espacios. Configura tus espacios en el paso anterior.</div>
            )}
          </div>
          {/* Panel derecho */}
          <div ref={rightPanelRef} className="no-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
            <AnimatePresence mode="wait">
              {activeSpace ? (
                <motion.div key={activeKey} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15, ease: "easeOut" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px", borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
                    <activeSpace.Icon size={18} color="var(--accent)" />
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>{activeSpace.label}</span>
                    {activeSpace.count > 0 && (
                      <span style={{ padding: "2px 9px", borderRadius: 999, background: "var(--accent-tint-soft)", color: "var(--accent)", fontSize: "0.6875rem", fontWeight: 700 }}>
                        {activeKey === "aireCentral" ? `${activeSpace.count} espacio${activeSpace.count !== 1 ? "s" : ""}` : `${activeSpace.count} equipo${activeSpace.count !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "16px 20px" }}>{spaceContent(activeKey)}</div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{ padding: 24, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Selecciona un espacio para configurar.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* Equipos funcionales */}
        {showFuncionales && (
          <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Wrench size={15} color="var(--accent)" />
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>Equipos funcionales</span>
              {funcionalesCount(eq.equiposFuncionales) > 0 && (
                <span style={{ padding: "1px 8px", borderRadius: 999, background: "var(--accent-tint-soft)", color: "var(--accent)", fontSize: "0.6875rem", fontWeight: 700 }}>
                  {funcionalesCount(eq.equiposFuncionales)} equipo{funcionalesCount(eq.equiposFuncionales) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {boilersSection(eq.equiposFuncionales.boilers, (v) => setFuncionales("boilers", v))}
            {eqRow("Centro de lavado vertical", <Radio value={eq.equiposFuncionales.centroCarga} onChange={(v) => setFuncionales("centroCarga", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
            {eq.equiposFuncionales.centroCarga !== "YES" && (
              <>
                {eqRow("Lavadora", <Radio value={eq.equiposFuncionales.washer} onChange={(v) => setFuncionales("washer", v)} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Sí" }]} />)}
                {eqRow("Secadora", <Radio value={eq.equiposFuncionales.dryer} onChange={(v) => setFuncionales("dryer", v)} options={[{ value: "NONE", label: "No incluye" }, { value: "GAS", label: "Gas" }, { value: "ELECTRIC", label: "Eléctrica" }]} />)}
              </>
            )}
          </div>
        )}
      </div>
    );

    if (step === 4) {
      const groups = buildSummaryGroups(s2, eq);
      const groupsWithEq = groups.filter((g) => g.items.length > 0);
      const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
      const bathroomsComplete = computeBathroomsComplete(s2, eq);
      const bathroomsHalf = computeBathroomsHalf(s2, eq);
      const noEqSpaces = [
        ...(s2.hasPatio ? ["Patio"] : []),
        ...(s2.hasCajon ? ["Cajón"] : []),
        ...(s2.hasBodega ? ["Bodega"] : []),
        ...(s2.hasTerraza ? ["Terraza"] : []),
        ...s2.customSpaces,
      ];
      return (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", background: "var(--bg-card)", display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{s1.name}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 999, background: "var(--bg-input)" }}>{typeDisplay}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {s2.bedrooms} rec. · {bathroomsComplete} baño{bathroomsComplete !== 1 ? "s" : ""}
                {bathroomsHalf > 0 ? ` · ${bathroomsHalf} medio${bathroomsHalf !== 1 ? "s" : ""}` : ""}
              </span>
            </div>
            {s1.description && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s1.description}</p>}
          </div>
          {groupsWithEq.length > 0 && (
            <div>
              <p style={{ margin: "0 0 10px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                EQUIPAMIENTO ({totalItems} elemento{totalItems !== 1 ? "s" : ""})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(groupsWithEq.length <= 4 ? 2 : 3, groupsWithEq.length)}, 1fr)`, gap: 10 }}>
                {groupsWithEq.map((g) => (
                  <div key={g.key} style={{ border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--bg-input)" }}>
                      <g.Icon size={14} color="var(--accent)" />
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>{g.label}</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: "auto" }}>{g.items.length}</span>
                    </div>
                    <div style={{ padding: "10px 12px", display: "grid", gap: 4 }}>
                      {g.items.map((item, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
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
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Sin equipamiento configurado. La plantilla se creará sin equipos.</p>
          )}
          {(noEqSpaces.length > 0 || bathroomsComplete > 0 || bathroomsHalf > 0) && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>OTROS ESPACIOS</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {noEqSpaces.map((lbl) => (
                  <span key={lbl} style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>{lbl}</span>
                ))}
                {bathroomsComplete > 0 && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                    {bathroomsComplete} Baño{bathroomsComplete !== 1 ? "s" : ""} completo{bathroomsComplete !== 1 ? "s" : ""}
                  </span>
                )}
                {bathroomsHalf > 0 && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                    {bathroomsHalf} Medio{bathroomsHalf !== 1 ? "s" : ""} baño{bathroomsHalf !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <WizardShell
      open={open}
      title={modalTitle}
      steps={WIZARD_STEPS}
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
