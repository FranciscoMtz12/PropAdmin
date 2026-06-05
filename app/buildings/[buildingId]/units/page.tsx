"use client";

/*
  Página de departamentos de un edificio — diseño v2.3

  Lógica de baños/recámaras corregida:
  - La fuente de verdad es la TIPOLOGÍA (unit_types), no la unidad.
  - El SELECT hace JOIN: unit_types(name, bedrooms, bathrooms).
  - Las cards muestran bedrooms/bathrooms de la tipología (read-only).
  - Los modales crear/editar no tienen campos propios de baños/recámaras:
    solo el selector de tipología. Al seleccionar una tipología se muestra
    un preview de sus valores.
  - No se necesita ALTER TABLE en units.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Ban,
  Bath,
  BedDouble,
  Check,
  Clock,
  Copy,
  DoorOpen,
  Edit3,
  FolderCog,
  Hash,
  Home,
  Layers3,
  Minus,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
  Warehouse,
  Wrench,
} from "lucide-react";
import toast from "react-hot-toast";
import { sortByNatural } from "@/lib/sort-utils";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import MetricCircles from "@/components/MetricCircles";
import EntityCard from "@/components/EntityCard";
import AppGrid from "@/components/AppGrid";
import AppBadge from "@/components/AppBadge";
import AppEmptyState from "@/components/AppEmptyState";
import AppFormField from "@/components/AppFormField";
import AppSelect from "@/components/AppSelect";
import {
  INPUT_STYLE,
  dropdownTriggerStyle,
  dropdownMenuStyle,
  dropdownActionButtonStyle,
  dropdownDeleteItemStyle,
  warnBannerStyle,
  errorBannerStyle,
} from "@/lib/pageStyles";
import { getPropertyLabels } from "@/lib/property-types";

/* ─── Tipos ─────────────────────────────────────────────────────────── */

type Building = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
  building_category: string | null;
  building_subtype: string | null;
};

/* La tipología trae bedrooms y bathrooms desde la tabla unit_types */
type UnitType = {
  id: string;
  building_id: string;
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
};

type UnitRow = {
  id: string;
  company_id: string;
  building_id: string;
  unit_type_id: string;
  unit_number: string;
  display_code: string | null;
  floor: number | null;
  status: string;
  rental_type: string | null;
  sqm: number | null;
  needs_review: boolean | null;
  /* Datos de la tipología — vienen del JOIN, NO son columnas propias de units */
  unit_types: {
    name: string;
    bedrooms: number | null;
    bathrooms: number | null;
  } | null;
};

type UnitArea = {
  id: string;
  unit_id: string;
  company_id: string;
  area_type: string;
  sqm: number | null;
  notes: string | null;
};

/* ─── Helpers de estado ─────────────────────────────────────────────── */

function normalizeStatus(status: string | null | undefined): string {
  return (status || "").toUpperCase();
}

/** Unidad tiene inquilino(s) activos — RENTED, OCCUPIED o PARTIAL */
function isOccupied(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return s === "RENTED" || s === "OCCUPIED" || s === "PARTIAL";
}

function getUnitStatusBadge(status: string | null | undefined) {
  const s = normalizeStatus(status);

  if (s === "RENTED" || s === "OCCUPIED") {
    return {
      label: "Rentado",
      backgroundColor: "var(--badge-bg-green)",
      textColor: "var(--badge-text-green)",
      borderColor: "var(--metric-border-green)",
    };
  }
  if (s === "PARTIAL") {
    return {
      label: "Parcial",
      backgroundColor: "var(--badge-bg-amber)",
      textColor: "var(--badge-text-amber)",
      borderColor: "var(--metric-border-amber)",
    };
  }
  if (s === "MAINTENANCE") {
    return {
      label: "Mantenimiento",
      backgroundColor: "var(--badge-bg-red)",
      textColor: "var(--badge-text-red)",
      borderColor: "var(--metric-border-red)",
    };
  }
  /* VACANT y cualquier otro */
  return {
    label: "Vacante",
    backgroundColor: "var(--badge-bg-blue)",
    textColor: "var(--badge-text-blue)",
    borderColor: "var(--metric-border-neutral)",
  };
}

/* ─── Indicador de estado: círculo outline con ícono ────────────────── */

function getStatusIndicator(status: string) {
  switch ((status ?? "").toUpperCase()) {
    case "OCCUPIED":
    case "RENTED":
      return { color: "#1D9E75", icon: "Check" };
    case "VACANT":
      return { color: "#378ADD", icon: "Home" };
    case "PARTIAL":
      return { color: "#EF9F27", icon: "Clock" };
    case "MAINTENANCE":
    case "OUT_OF_SERVICE":
      return { color: "#E24B4A", icon: "Ban" };
    default:
      return { color: "#888780", icon: "Minus" };
  }
}

function StatusCircle({ status }: { status: string }) {
  const ind = getStatusIndicator(status);
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${ind.color}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {ind.icon === "Check" && <Check size={15} color={ind.color} strokeWidth={2.5} />}
      {ind.icon === "Home"  && <Home  size={15} color={ind.color} strokeWidth={2.5} />}
      {ind.icon === "Clock" && <Clock size={15} color={ind.color} strokeWidth={2.5} />}
      {ind.icon === "Ban"   && <Ban   size={15} color={ind.color} strokeWidth={2.5} />}
      {ind.icon === "Minus" && <Minus size={15} color={ind.color} strokeWidth={2.5} />}
    </div>
  );
}

const errorTextStyle: React.CSSProperties = {
  color: "var(--metric-value-red)",
  fontSize: "0.75rem",
  marginTop: 4,
  marginBottom: 0,
};

const createUnitSchema = z.object({
  unitNumber: z.string().min(1, "El número es obligatorio"),
  unitTypeId: z.string().optional(),
  floor: z.string().optional(),
});
type CreateUnitValues = z.infer<typeof createUnitSchema>;

const editUnitSchema = z.object({
  unitNumber: z.string().min(1, "El número es obligatorio"),
  unitTypeId: z.string().optional(),
  floor: z.string().optional(),
});
type EditUnitValues = z.infer<typeof editUnitSchema>;

const CREATE_UNIT_DEFAULTS: CreateUnitValues = {
  unitNumber: "",
  unitTypeId: "",
  floor: "",
};

/* ─── Helpers de formulario por tipo ────────────────────────────────── */

type CommercialFieldConfig = { label: string; placeholder: string; showFloor: boolean };

function getCommercialFieldConfig(subtype: string | null | undefined): CommercialFieldConfig {
  switch (subtype) {
    case "local_comercial":  return { label: "Número de local",          placeholder: "Ej: Local 101, L-01",   showFloor: false };
    case "oficinas":         return { label: "Número de oficina / suite", placeholder: "Ej: Suite 201, Piso 3", showFloor: true  };
    case "showroom":         return { label: "Nombre del espacio",        placeholder: "Ej: Área principal",    showFloor: false };
    default:                 return { label: "Número de espacio",         placeholder: "Ej: Esp-01",            showFloor: false };
  }
}

const INIT_COMM_FLAGS = { has_storage: false, has_bathroom: false, has_parking: false, has_independent_access: false };
const INIT_IND_AREAS  = { almacen_sqm: "", oficina_sqm: "", patio_sqm: "", carga_sqm: "" };

/* ─── Helpers de numeración automática ──────────────────────────────── */

function parseUnitPattern(unitNumber: string): { prefix: string; num: number; padLen: number } | null {
  const m = unitNumber.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10), padLen: m[2].length };
}

function buildUnitNumber(prefix: string, num: number, padLen: number): string {
  const s = String(num);
  return prefix + (padLen > 1 ? s.padStart(padLen, "0") : s);
}

function generateBulkNumbers(base: string, count: number): string[] {
  const parsed = parseUnitPattern(base);
  if (!parsed) return Array.from({ length: count }, (_, i) => i === 0 ? base : `${base} ${i + 1}`);
  const { prefix, num, padLen } = parsed;
  return Array.from({ length: count }, (_, i) => buildUnitNumber(prefix, num + i, padLen));
}

function nextAvailableNumber(base: string, existingNumbers: string[]): string {
  const parsed = parseUnitPattern(base);
  if (!parsed) return base;
  const { prefix, num, padLen } = parsed;
  const existingSet = new Set(existingNumbers.map(n => n.toLowerCase()));
  let candidate = num;
  while (existingSet.has(buildUnitNumber(prefix, candidate, padLen).toLowerCase())) candidate++;
  return buildUnitNumber(prefix, candidate, padLen);
}

/* ─── Página ─────────────────────────────────────────────────────────── */

export default function BuildingUnitsPage() {
  const router     = useRouter();
  const params     = useParams();
  const buildingId = params.buildingId as string;
  const { user, loading } = useCurrentUser();
  const { impersonationMode } = useImpersonation();
  const isGroupMode = impersonationMode === 'group';

  /* Estado de datos */
  const [building, setBuilding]       = useState<Building | null>(null);
  const [unitTypes, setUnitTypes]     = useState<UnitType[]>([]);
  const [units, setUnits]             = useState<UnitRow[]>([]);
  const [tenantsByUnitId, setTenantsByUnitId] = useState<Map<string, string>>(new Map());
  const [activeLeaseCountByUnitId, setActiveLeaseCountByUnitId] = useState<Map<string, number>>(new Map());
  const [unitAreasMap, setUnitAreasMap] = useState<Record<string, UnitArea[]>>({});
  const [unitAmenitiesMap, setUnitAmenitiesMap] = useState<Record<string, Set<string>>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [msg, setMsg]                 = useState("");

  /* Estado del formulario de creación */
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalStep, setCreateModalStep] = useState<0 | 1>(1);

  const createForm = useForm<CreateUnitValues>({
    resolver: zodResolver(createUnitSchema),
    defaultValues: CREATE_UNIT_DEFAULTS,
  });
  const createUnitNumber = createForm.watch("unitNumber");
  const createUnitTypeId = createForm.watch("unitTypeId");

  /* Campos extra — commercial */
  const [createSqm, setCreateSqm] = useState("");
  const [createCommFlags, setCreateCommFlags] = useState({ ...INIT_COMM_FLAGS });

  /* Campos extra — industrial */
  const [createIndAreas, setCreateIndAreas] = useState({ ...INIT_IND_AREAS });

  /* Cantidad de unidades a crear en lote */
  const [createCount, setCreateCount] = useState(1);

  /* Estado del modal de duplicar unidad */
  const [pendingDupUnit, setPendingDupUnit] = useState<UnitRow | null>(null);
  const [dupUnitCount, setDupUnitCount]     = useState(1);
  const [duplicating, setDuplicating]       = useState(false);

  /* Estado del modal de eliminar */
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete]           = useState<UnitRow | null>(null);
  const [deleteError, setDeleteError]             = useState<string | null>(null);
  const [deleting, setDeleting]                   = useState(false);

  /* Estado del modal de edición */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUnit, setEditingUnit]         = useState<UnitRow | null>(null);

  const editForm = useForm<EditUnitValues>({
    resolver: zodResolver(editUnitSchema),
    defaultValues: { unitNumber: "", unitTypeId: "", floor: "" },
  });
  const editUnitTypeId = editForm.watch("unitTypeId");

  /* Control de dropdown por unidad */
  const [openActionsUnitId, setOpenActionsUnitId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if ((user?.company_id || isGroupMode) && buildingId) void loadPageData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, buildingId, isGroupMode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(e.target as Node)) {
        setOpenActionsUnitId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Carga de datos ──────────────────────────────────────────────── */

  async function loadPageData() {
    if ((!user?.company_id && !isGroupMode) || !buildingId) return;
    setLoadingData(true);
    setMsg("");

    /* 1. Edificio — en modo grupo no filtramos por company_id (viene del edificio mismo) */
    const buildingQ = supabase
      .from("buildings")
      .select("id, company_id, name, code, address, building_category, building_subtype")
      .eq("id", buildingId)
      .is("deleted_at", null);
    const { data: buildingData, error: buildingError } = user?.company_id
      ? await buildingQ.eq("company_id", user.company_id).single()
      : await buildingQ.single();

    if (buildingError) {
      setMsg("No se pudo cargar el edificio.");
      setLoadingData(false);
      return;
    }
    setBuilding(buildingData);

    /* 2. Tipologías — traer bedrooms y bathrooms para los modales */
    const { data: unitTypeData, error: unitTypeError } = await supabase
      .from("unit_types")
      .select("id, building_id, name, bedrooms, bathrooms")
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (unitTypeError) {
      setMsg("No se pudieron cargar las tipologías del edificio.");
      setLoadingData(false);
      return;
    }
    setUnitTypes((unitTypeData || []) as UnitType[]);

    /* 3. Departamentos — JOIN con unit_types para traer bedrooms/bathrooms */
    const { data: unitData, error: unitError } = await supabase
      .from("units")
      .select(`
        id,
        company_id,
        building_id,
        unit_type_id,
        unit_number,
        display_code,
        floor,
        status,
        rental_type,
        sqm,
        needs_review,
        unit_types(name, bedrooms, bathrooms)
      `)
      .eq("building_id", buildingId)
      .is("deleted_at", null);

    if (unitError) {
      setMsg("No se pudieron cargar los departamentos.");
      setLoadingData(false);
      return;
    }

    const raw = (unitData as unknown as UnitRow[]) || [];

    const sorted = sortByNatural(raw, u => u.unit_number);
    setUnits(sorted);

    /* 4. Áreas de unidades (unit_areas) */
    if (sorted.length > 0) {
      const { data: unitAreasData } = await supabase
        .from("unit_areas")
        .select("*")
        .in("unit_id", sorted.map((u) => u.id))
        .is("deleted_at", null);

      const areasMap: Record<string, UnitArea[]> = {};
      (unitAreasData || []).forEach((area: UnitArea) => {
        if (!areasMap[area.unit_id]) areasMap[area.unit_id] = [];
        areasMap[area.unit_id].push(area);
      });
      setUnitAreasMap(areasMap);
    } else {
      setUnitAreasMap({});
    }

    /* 5. Amenidades de unidades commercial (unit_amenities) */
    if (sorted.length > 0) {
      const { data: unitAmenitiesData } = await supabase
        .from("unit_amenities")
        .select("unit_id, amenity_key")
        .in("unit_id", sorted.map((u) => u.id))
        .is("deleted_at", null);

      const amenitiesMap: Record<string, Set<string>> = {};
      (unitAmenitiesData || []).forEach((row: { unit_id: string; amenity_key: string }) => {
        if (!amenitiesMap[row.unit_id]) amenitiesMap[row.unit_id] = new Set();
        amenitiesMap[row.unit_id].add(row.amenity_key);
      });
      setUnitAmenitiesMap(amenitiesMap);
    } else {
      setUnitAmenitiesMap({});
    }

    /* 6. Nombre del inquilino activo para unidades ocupadas */
    const occupiedIds = sorted.filter((u) => isOccupied(u.status)).map((u) => u.id);
    const tenantMap = new Map<string, string>();

    if (occupiedIds.length > 0) {
      const { data: activeLeasesData } = await supabase
        .from("leases")
        .select("unit_id, tenant_id")
        .in("unit_id", occupiedIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null);

      const tenantIds = [
        ...new Set(
          (activeLeasesData || [])
            .map((l: { tenant_id: string | null }) => l.tenant_id)
            .filter(Boolean) as string[]
        ),
      ];

      if (tenantIds.length > 0) {
        const { data: tenantsData } = await supabase
          .from("tenants")
          .select("id, full_name")
          .in("id", tenantIds);

        const tenantById = new Map(
          (tenantsData || []).map(
            (t: { id: string; full_name: string }) => [t.id, t.full_name]
          )
        );

        (activeLeasesData || []).forEach(
          (l: { unit_id: string; tenant_id: string | null }) => {
            const name = l.tenant_id ? tenantById.get(l.tenant_id) : undefined;
            if (name) tenantMap.set(l.unit_id, name);
          }
        );
      }
    }

    setTenantsByUnitId(tenantMap);

    /* 5. Conteo de leases activos por unidad — solo para by_room */
    const byRoomIds = sorted.filter((u) => u.rental_type === "by_room").map((u) => u.id);
    if (byRoomIds.length > 0) {
      const { data: byRoomLeases } = await supabase
        .from("leases")
        .select("unit_id")
        .in("unit_id", byRoomIds)
        .eq("status", "ACTIVE")
        .is("deleted_at", null);

      const countMap = new Map<string, number>();
      (byRoomLeases || []).forEach((l: { unit_id: string }) => {
        countMap.set(l.unit_id, (countMap.get(l.unit_id) || 0) + 1);
      });
      setActiveLeaseCountByUnitId(countMap);
    }

    setLoadingData(false);
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */

  function generateDisplayCode(buildingCode: string | null, unitNum: string) {
    if (!unitNum.trim()) return null;
    if (buildingCode?.trim()) return `${buildingCode.trim()}-${unitNum.trim()}`;
    return unitNum.trim();
  }

  async function cloneTemplateAssetsToUnit(
    newUnitId: string,
    selectedTypeId: string
  ): Promise<string | null> {
    if (!user?.company_id || !building) return null;

    const { data: templateAssets, error } = await supabase
      .from("unit_type_assets")
      .select("asset_type, name, status, notes, sort_order")
      .eq("unit_type_id", selectedTypeId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return error.message;
    if (!templateAssets?.length) return null;

    const rows = templateAssets.map((item) => ({
      company_id: user.company_id,
      building_id: building.id,
      unit_id: newUnitId,
      asset_type: item.asset_type,
      name: item.name,
      status: item.status || "ACTIVE",
      notes: item.notes || null,
    }));

    const { error: insertError } = await supabase.from("assets").insert(rows);
    return insertError ? insertError.message : null;
  }

  /* ── Handlers CRUD ───────────────────────────────────────────────── */

  const onCreateUnit = createForm.handleSubmit(async (data) => {
    setMsg("");
    if (!user?.company_id)  { setMsg("No se encontró la empresa del usuario."); return; }
    if (!building)           { setMsg("No se encontró el edificio."); return; }

    const cat = building.building_category;
    const isBulk = createCount > 1;

    /* Para residential_multi, tipología es obligatoria */
    if (cat === "residential_multi" && !data.unitTypeId) {
      createForm.setError("unitTypeId", { message: "Debes seleccionar una tipología" });
      return;
    }

    /* Generar lista de números a crear */
    const existingNumbers = units.map(u => u.unit_number);
    let numbersToCreate: string[];
    if (isBulk) {
      const base = data.unitNumber.trim();
      numbersToCreate = generateBulkNumbers(base, createCount);
      /* Saltar los que ya existen */
      const existingSet = new Set(existingNumbers.map(n => n.toLowerCase()));
      const available: string[] = [];
      let offset = 0;
      const parsed = parseUnitPattern(base);
      for (let i = 0; available.length < createCount; i++) {
        let candidate: string;
        if (parsed) {
          candidate = buildUnitNumber(parsed.prefix, parsed.num + offset, parsed.padLen);
        } else {
          candidate = i === 0 ? base : `${base} ${offset + 1}`;
        }
        if (!existingSet.has(candidate.toLowerCase())) available.push(candidate);
        offset++;
        if (offset > 1000) break;
      }
      numbersToCreate = available;
    } else {
      numbersToCreate = [data.unitNumber.trim()];
    }

    /* Crear unidades */
    const createdIds: string[] = [];
    for (const unitNum of numbersToCreate) {
      const displayCode = generateDisplayCode(building.code, unitNum);
      const insertRow: Record<string, unknown> = {
        company_id:   user.company_id,
        building_id:  building.id,
        unit_number:  unitNum,
        display_code: displayCode,
        floor:        data.floor && data.floor.trim() ? Number(data.floor) : null,
        status:       "VACANT",
        needs_review: isBulk,
      };
      if (cat === "commercial") {
        const sqmVal = parseFloat(createSqm);
        if (!isNaN(sqmVal) && sqmVal > 0) insertRow.sqm = sqmVal;
      }
      if (cat === "residential_multi" && data.unitTypeId) {
        insertRow.unit_type_id = data.unitTypeId;
      }

      const { data: newUnit, error } = await supabase
        .from("units")
        .insert(insertRow)
        .select("id")
        .single();

      if (error || !newUnit) {
        setMsg(error?.message || `No se pudo crear ${labels.unit.toLowerCase()}.`);
        return;
      }
      createdIds.push(newUnit.id);

      /* Amenidades commercial */
      if (cat === "commercial") {
        const amenityKeys = ["has_storage", "has_bathroom", "has_parking", "has_independent_access"] as const;
        const amenitiesToInsert = amenityKeys
          .filter((key) => createCommFlags[key] === true)
          .map((key) => ({ unit_id: newUnit.id, company_id: building.company_id, amenity_key: key }));
        if (amenitiesToInsert.length > 0) await supabase.from("unit_amenities").insert(amenitiesToInsert);
      }

      /* Áreas industrial */
      if (cat === "industrial" || cat === "industrial_park") {
        const areasToInsert = [
          { area_type: "almacen", sqm: parseFloat(createIndAreas.almacen_sqm) },
          { area_type: "oficina", sqm: parseFloat(createIndAreas.oficina_sqm) },
          { area_type: "patio",   sqm: parseFloat(createIndAreas.patio_sqm) },
          { area_type: "carga",   sqm: parseFloat(createIndAreas.carga_sqm) },
        ].filter((a) => !isNaN(a.sqm) && a.sqm > 0);
        if (areasToInsert.length > 0) {
          await supabase.from("unit_areas").insert(
            areasToInsert.map((a) => ({ unit_id: newUnit.id, company_id: building.company_id, area_type: a.area_type, sqm: a.sqm }))
          );
        }
      }

      /* Clonar assets base — solo para residential_multi con tipología */
      if (cat === "residential_multi" && data.unitTypeId) {
        const cloneError = await cloneTemplateAssetsToUnit(newUnit.id, data.unitTypeId);
        if (cloneError) {
          setMsg(`${labels.unit} creado, pero hubo un problema al clonar el equipamiento base: ${cloneError}`);
          await loadPageData();
          return;
        }
      }
    }

    createForm.reset(CREATE_UNIT_DEFAULTS);
    setCreateSqm("");
    setCreateCommFlags({ ...INIT_COMM_FLAGS });
    setCreateIndAreas({ ...INIT_IND_AREAS });
    setCreateCount(1);
    setIsCreateModalOpen(false);
    if (isBulk) {
      setMsg(`${createdIds.length} ${labels.units.toLowerCase()} creados correctamente.`);
    } else {
      const suffix = cat === "residential_multi" ? " Si la tipología tenía equipos base, ya se clonaron automáticamente." : "";
      setMsg(`${labels.unit} guardado correctamente.${suffix}`);
    }
    await loadPageData();
  });

  async function handleDuplicateUnit() {
    const unit = pendingDupUnit;
    if (!user?.company_id || !building || !unit) return;
    setDuplicating(true);

    /* Calcular el máximo con el mismo prefijo una sola vez, luego iterar */
    const existingNumbers = new Set(units.map(u => u.unit_number.toLowerCase()));
    const parsed = parseUnitPattern(unit.unit_number);
    let nextNum: number | null = null;
    let basePrefix = "", basePad = 1;
    if (parsed) {
      basePrefix = parsed.prefix; basePad = parsed.padLen;
      const samePrefix = units
        .map(u => parseUnitPattern(u.unit_number))
        .filter((p): p is NonNullable<typeof p> => p !== null && p.prefix === parsed.prefix)
        .map(p => p.num);
      nextNum = (samePrefix.length > 0 ? Math.max(...samePrefix) : parsed.num) + 1;
    }

    let created = 0;
    for (let i = 0; i < dupUnitCount; i++) {
      let newNumber: string;
      if (parsed && nextNum !== null) {
        let n = nextNum;
        let c = buildUnitNumber(basePrefix, n, basePad);
        while (existingNumbers.has(c.toLowerCase())) { n++; c = buildUnitNumber(basePrefix, n, basePad); }
        newNumber = c; nextNum = n + 1;
      } else {
        newNumber = nextAvailableNumber(`${unit.unit_number} 2`, [...existingNumbers]);
      }
      existingNumbers.add(newNumber.toLowerCase());

      const displayCode = generateDisplayCode(building.code, newNumber);
      const insertRow: Record<string, unknown> = {
        company_id:   user.company_id,
        building_id:  building.id,
        unit_number:  newNumber,
        display_code: displayCode,
        floor:        unit.floor,
        status:       "VACANT",
        needs_review: true,
        sqm:          unit.sqm,
      };
      if (unit.unit_type_id) insertRow.unit_type_id = unit.unit_type_id;

      const { data: newUnit, error } = await supabase.from("units").insert(insertRow).select("id").single();
      if (error || !newUnit) { toast.error(`Error en copia ${i + 1}: ${error?.message || "error"}`); break; }
      created++;

      const srcAreas = unitAreasMap[unit.id] ?? [];
      if (srcAreas.length > 0) {
        await supabase.from("unit_areas").insert(
          srcAreas.map(a => ({ unit_id: newUnit.id, company_id: building.company_id, area_type: a.area_type, sqm: a.sqm }))
        );
      }

      const srcAmenities = unitAmenitiesMap[unit.id];
      if (srcAmenities && srcAmenities.size > 0) {
        await supabase.from("unit_amenities").insert(
          [...srcAmenities].map(key => ({ unit_id: newUnit.id, company_id: building.company_id, amenity_key: key }))
        );
      }
    }

    setDuplicating(false);
    setPendingDupUnit(null);
    setDupUnitCount(1);
    if (created > 0) {
      toast.success(`${created} ${created === 1 ? "unidad duplicada" : "unidades duplicadas"} — revisa los datos`);
      await loadPageData();
    }
  }

  function openDeleteModal(unit: UnitRow) {
    setUnitToDelete(unit);
    setIsDeleteModalOpen(true);
    setOpenActionsUnitId(null);
    setMsg("");
    setDeleteError(null);
  }

  function openEditModal(unit: UnitRow) {
    setEditingUnit(unit);
    editForm.reset({
      unitNumber: unit.unit_number,
      unitTypeId: unit.unit_type_id,
      floor: unit.floor != null ? String(unit.floor) : "",
    });
    setIsEditModalOpen(true);
    setOpenActionsUnitId(null);
    setMsg("");
  }

  function closeEditModal() {
    if (editForm.formState.isSubmitting) return;
    setIsEditModalOpen(false);
    setEditingUnit(null);
  }

  const onUpdateUnit = editForm.handleSubmit(async (data) => {
    if (!user?.company_id || !editingUnit || !building) return;

    const displayCode = generateDisplayCode(building.code, data.unitNumber);
    const { error } = await supabase
      .from("units")
      .update({
        unit_number:  data.unitNumber.trim(),
        display_code: displayCode,
        floor:        data.floor && data.floor.trim() ? Number(data.floor) : null,
        unit_type_id: data.unitTypeId || editingUnit.unit_type_id,
      })
      .eq("id", editingUnit.id)
      .eq("company_id", user.company_id);

    if (error) { setMsg(`No se pudo actualizar ${labels.unit.toLowerCase()}. ${error.message}`); return; }
    setIsEditModalOpen(false);
    setEditingUnit(null);
    setMsg(`${labels.unit} actualizado correctamente.`);
    await loadPageData();
  });

  function closeDeleteModal() {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setUnitToDelete(null);
    setDeleteError(null);
  }

  async function handleDeleteUnit() {
    if (!user?.company_id || !unitToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const now = new Date().toISOString();
    const uid = unitToDelete.id;

    // 1. Assets de la unidad
    await supabase.from("assets")
      .update({ deleted_at: now }).eq("unit_id", uid).is("deleted_at", null);

    // 2. Collection schedules
    await supabase.from("collection_schedules")
      .update({ deleted_at: now, active: false }).eq("unit_id", uid).is("deleted_at", null);

    // 3. Collection records pendientes
    await supabase.from("collection_records")
      .update({ deleted_at: now })
      .eq("unit_id", uid).in("status", ["pending", "overdue"]).is("deleted_at", null);

    // 4. Leases activos
    await supabase.from("leases")
      .update({ deleted_at: now, status: "ENDED" })
      .eq("unit_id", uid).eq("status", "ACTIVE").is("deleted_at", null);

    // 5. Unidad
    const { error } = await supabase.from("units")
      .update({ deleted_at: now }).eq("id", uid).eq("company_id", user.company_id);

    if (error) {
      setDeleteError(`No se pudo eliminar ${labels.unit.toLowerCase()}. ${error.message}`);
      setDeleting(false);
      return;
    }
    setIsDeleteModalOpen(false);
    setUnitToDelete(null);
    setDeleting(false);
    setMsg(`${labels.unit} archivado correctamente.`);
    await loadPageData();
  }

  /* ── Estadísticas ─────────────────────────────────────────────────── */

  const stats = useMemo(
    () => ({
      total:       units.length,
      rented:      units.filter((u) => ["RENTED", "OCCUPIED"].includes(normalizeStatus(u.status))).length,
      partial:     units.filter((u) => normalizeStatus(u.status) === "PARTIAL").length,
      vacant:      units.filter((u) => normalizeStatus(u.status) === "VACANT").length,
      maintenance: units.filter((u) => normalizeStatus(u.status) === "MAINTENANCE").length,
    }),
    [units]
  );

  /* ── Labels dinámicos según tipo de propiedad ───────────────────────── */

  const labels = useMemo(
    () => getPropertyLabels(building?.building_category ?? null, building?.building_subtype ?? null),
    [building]
  );

  /* ── Tipología seleccionada (para preview en modales) ─────────────── */

  const selectedTypeForCreate = unitTypes.find((ut) => ut.id === createUnitTypeId) ?? null;
  const selectedTypeForEdit   = unitTypes.find((ut) => ut.id === editUnitTypeId)     ?? null;

  /* ── Render ──────────────────────────────────────────────────────── */

  if (loading)     return <PageContainer>Cargando usuario...</PageContainer>;
  if (!user)       return null;
  if (loadingData) return <PageContainer>Cargando departamentos...</PageContainer>;

  if (!building) {
    return (
      <PageContainer>
        <p>{msg || "No se encontró el edificio."}</p>
        <a href="/buildings" style={{ display: "inline-block", marginTop: 16, color: "var(--text-primary)" }}>
          Volver a edificios
        </a>
      </PageContainer>
    );
  }

  const cat = building.building_category;
  const isResidentialMulti = cat === "residential_multi";

  function openCreateModal() {
    if (isResidentialMulti && unitTypes.length > 0) {
      setCreateModalStep(0);
    } else {
      setCreateModalStep(1);
    }
    setIsCreateModalOpen(true);
  }

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ padding: "18px 0 0 0", marginBottom: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          <a href="/dashboard" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Inicio</a>
          <span style={{ color: "var(--text-muted)" }}>{">"}</span>
          <a href="/buildings" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Propiedades</a>
          <span style={{ color: "var(--text-muted)" }}>{">"}</span>
          <a href={`/buildings/${building.id}`} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>{building.name}</a>
          <span style={{ color: "var(--text-muted)" }}>{">"}</span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{labels.units}</span>
        </div>
      </div>

      <PageHeader
        title={`${labels.units} — ${building.name}`}
        titleIcon={<DoorOpen size={20} />}
        subtitle="Crea, organiza y administra las unidades del edificio."
        actions={
          <>
            <UiButton href={`/buildings/${building.id}`}>Volver al edificio</UiButton>
            <UiButton onClick={openCreateModal} variant="primary">
              <Plus size={16} />
              Nuevo {labels.unit.toLowerCase()}
            </UiButton>
          </>
        }
      />

      {msg ? (
        <p style={{
          color: msg.includes("correctamente") ? "var(--badge-text-green)" : "var(--badge-text-red)",
          marginBottom: 16, fontSize: "0.875rem", fontWeight: 600,
        }}>
          {msg}
        </p>
      ) : null}

      {/* Métricas */}
      <MetricCircles metrics={[
        { value: stats.total, label: "Total" },
        { value: stats.vacant, label: "Vacantes", color: "info" },
        ...( ["residential_multi", "residential_single"].includes(building.building_category ?? "")
          ? [{ value: stats.partial, label: "Parciales", color: "warning" as const }] : [] ),
        { value: stats.rented, label: "Rentados", color: "success" },
        { value: stats.maintenance, label: "Mant.", color: "warning" },
      ]} />

      {/* Grid de departamentos */}
      <SectionCard
        title={`${labels.units} del edificio`}
        subtitle="Ordenados por número — entra al detalle o administra su equipamiento."
        icon={<FolderCog size={18} />}
      >
        {units.length === 0 ? (
          <AppEmptyState
            title={`Todavía no hay ${labels.units.toLowerCase()}`}
            description="Crea la primera unidad del edificio y, si su tipología tiene equipamiento base, el sistema lo clonará automáticamente."
            actionLabel={`Crear ${labels.unit.toLowerCase()}`}
            onAction={openCreateModal}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(21.25rem, 1fr))", gap: 12 }}>
            {units.map((unit) => {
              const unitBadge     = getUnitStatusBadge(unit.status);
              const tenantName    = tenantsByUnitId.get(unit.id);
              const typeInfo      = unit.unit_types;
              const isByRoom      = unit.rental_type === "by_room";
              const occupiedRooms = isByRoom ? (activeLeaseCountByUnitId.get(unit.id) ?? 0) : undefined;
              const totalRooms    = isByRoom ? (typeInfo?.bedrooms ?? 1) : undefined;

              const isCommercial = cat === "commercial";
              const isIndustrial = cat === "industrial" || cat === "industrial_park";

              /* Métricas de áreas industriales — desde unit_areas */
              const areas = unitAreasMap[unit.id] ?? [];
              const indTotal = isIndustrial ? areas.reduce((sum, a) => sum + (a.sqm ?? 0), 0) : 0;
              const indParts = isIndustrial ? areas.map((a) => `${a.sqm} m² ${a.area_type}`) : [];

              return (
                <div
                  key={unit.id}
                  onClick={() => router.push(`/buildings/${building.id}/units/${unit.id}`)}
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  {unit.needs_review && (
                    <div
                      title="Pendiente de revisión"
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--metric-bg-amber)",
                        zIndex: 10,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                <EntityCard
                  title={unit.unit_number}
                  subtitle={unit.display_code || "—"}
                  badge={
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <AppBadge
                        backgroundColor={unitBadge.backgroundColor}
                        textColor={unitBadge.textColor}
                        borderColor={unitBadge.borderColor}
                      >
                        {unitBadge.label}
                      </AppBadge>
                      {isByRoom && occupiedRooms !== undefined && totalRooms !== undefined ? (
                        <AppBadge backgroundColor="var(--metric-bg-amber)" textColor="var(--badge-text-amber)" borderColor="var(--metric-border-amber)">
                          {occupiedRooms}/{totalRooms} cuartos
                        </AppBadge>
                      ) : null}
                      {isResidentialMulti && (
                        <AppBadge backgroundColor="var(--bg-page)" textColor="var(--text-secondary)" borderColor="var(--border-default)">
                          <Layers3 size={12} />
                          {typeInfo?.name || "Sin tipología"}
                        </AppBadge>
                      )}
                    </div>
                  }
                  statusIndicator={<StatusCircle status={unit.status} />}
                  actions={
                    <div
                      style={{ position: "relative" }}
                      ref={openActionsUnitId === unit.id ? actionsMenuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenActionsUnitId(openActionsUnitId === unit.id ? null : unit.id)}
                        style={dropdownTriggerStyle}
                        aria-label="Más acciones"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openActionsUnitId === unit.id && (
                        <div style={dropdownMenuStyle}>
                          <button type="button" onClick={() => openEditModal(unit)}                    style={dropdownActionButtonStyle}><Edit3  size={14} /> Editar</button>
                          <button type="button" onClick={() => { setPendingDupUnit(unit); setDupUnitCount(1); setOpenActionsUnitId(null); }} style={dropdownActionButtonStyle}><Copy size={14} /> Duplicar</button>
                          <button type="button" onClick={() => openDeleteModal(unit)}                  style={dropdownDeleteItemStyle}><Trash2 size={14} /> Eliminar</button>
                        </div>
                      )}
                    </div>
                  }
                >
                  <div style={{ marginTop: 8 }}>
                    {/* Detalles residencial: tipología + piso + inquilino */}
                    {isResidentialMulti && (unit.floor != null || typeInfo?.bedrooms != null || typeInfo?.bathrooms != null || tenantName) && (
                      <>
                        {(unit.floor != null || typeInfo?.bedrooms != null || typeInfo?.bathrooms != null) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: tenantName ? 6 : 0 }}>
                            {unit.floor != null && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Hash size={11} />Piso {unit.floor}</span>}
                            {typeInfo?.bedrooms != null && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><BedDouble size={11} />{typeInfo.bedrooms} rec.</span>}
                            {typeInfo?.bathrooms != null && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Bath size={11} />{typeInfo.bathrooms} baño{typeInfo.bathrooms !== 1 ? "s" : ""}</span>}
                          </div>
                        )}
                      </>
                    )}

                    {/* Detalles commercial: m² + chips desde unit_amenities */}
                    {isCommercial && (unit.sqm != null || (unitAmenitiesMap[unit.id]?.size ?? 0) > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: "0.75rem", color: "var(--text-secondary)", alignItems: "center" }}>
                        {unit.sqm ? <span style={{ fontWeight: 600 }}>{unit.sqm} m²</span> : null}
                        {unitAmenitiesMap[unit.id]?.has("has_storage")            && <AppBadge backgroundColor="var(--bg-page)" textColor="var(--text-secondary)" borderColor="var(--border-default)">Bodega</AppBadge>}
                        {unitAmenitiesMap[unit.id]?.has("has_bathroom")           && <AppBadge backgroundColor="var(--bg-page)" textColor="var(--text-secondary)" borderColor="var(--border-default)">Baños</AppBadge>}
                        {unitAmenitiesMap[unit.id]?.has("has_parking")            && <AppBadge backgroundColor="var(--bg-page)" textColor="var(--text-secondary)" borderColor="var(--border-default)">Estacionamiento</AppBadge>}
                        {unitAmenitiesMap[unit.id]?.has("has_independent_access") && <AppBadge backgroundColor="var(--bg-page)" textColor="var(--text-secondary)" borderColor="var(--border-default)">Acceso independiente</AppBadge>}
                      </div>
                    )}

                    {/* Detalles industrial: total + desglose */}
                    {isIndustrial && indTotal > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        <span style={{ fontWeight: 600, marginRight: 6 }}>{indTotal.toLocaleString("es-MX")} m² total</span>
                        {indParts.length > 0 && <span style={{ color: "var(--text-muted)" }}>{indParts.join(" · ")}</span>}
                      </div>
                    )}

                    {/* Inquilino — todos los tipos */}
                    {tenantName && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <User size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tenantName}
                        </span>
                      </div>
                    )}
                  </div>
                </EntityCard>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Modal: editar ── */}
      <Modal open={isEditModalOpen} onClose={closeEditModal} title={`Editar ${labels.unit.toLowerCase()}`}>
        <form onSubmit={onUpdateUnit}>
          <AppFormField label={`Número de ${labels.unit.toLowerCase()}`} required>
            <input
              {...editForm.register("unitNumber")}
              placeholder="Ej. 101"
              style={INPUT_STYLE}
            />
            {editForm.formState.errors.unitNumber ? (
              <p style={errorTextStyle}>{editForm.formState.errors.unitNumber.message}</p>
            ) : null}
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <AppFormField label="Tipología">
              <AppSelect {...editForm.register("unitTypeId")}>
                {unitTypes.map((ut) => <option key={ut.id} value={ut.id}>{ut.name}</option>)}
              </AppSelect>
            </AppFormField>
            <AppFormField label="Piso">
              <input
                type="number" min={0}
                {...editForm.register("floor")}
                placeholder="Ej. 1" style={INPUT_STYLE}
              />
            </AppFormField>
          </div>

          {/* Preview de recámaras/baños de la tipología seleccionada */}
          {selectedTypeForEdit ? (
            <TypePreview type={selectedTypeForEdit} />
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={editForm.formState.isSubmitting} variant="primary">
              {editForm.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
            </UiButton>
            <UiButton type="button" onClick={closeEditModal}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal: eliminar ── */}
      <Modal open={isDeleteModalOpen} onClose={closeDeleteModal} title={`Eliminar ${labels.unit.toLowerCase()}`} maxWidth="480px">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={warnBannerStyle}>
            ¿Eliminar {labels.unit.toLowerCase()} <strong>{unitToDelete?.unit_number}</strong>? Esta acción lo
            ocultará del sistema pero conservará toda su información.
          </div>
          {deleteError ? <div style={errorBannerStyle}>{deleteError}</div> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              Cancelar
            </UiButton>
            <UiButton type="button" onClick={() => void handleDeleteUnit()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Eliminando..." : `Eliminar ${labels.unit.toLowerCase()}`}
            </UiButton>
          </div>
        </div>
      </Modal>

      {/* ── Modal: crear ── */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateModalStep(1);
          createForm.reset(CREATE_UNIT_DEFAULTS);
          setCreateSqm("");
          setCreateCommFlags({ ...INIT_COMM_FLAGS });
          setCreateIndAreas({ ...INIT_IND_AREAS });
          setCreateCount(1);
        }}
        title={createModalStep === 0 ? "¿Con qué tipología?" : `Crear ${labels.unit.toLowerCase()}`}
        subtitle={createModalStep === 1 && isResidentialMulti ? "El equipamiento base de la tipología se clonará automáticamente al guardar." : undefined}
      >

        {/* ── PASO 0: selección de tipología (solo residential_multi) ── */}
        {createModalStep === 0 && (
          <div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              Selecciona una tipología como base o empieza desde cero.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {unitTypes.map((ut) => (
                <button
                  key={ut.id}
                  type="button"
                  onClick={() => {
                    createForm.setValue("unitTypeId", ut.id);
                    setCreateModalStep(1);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 16px", borderRadius: "var(--border-radius-lg)",
                    border: "1.5px solid var(--border-default)",
                    background: "var(--bg-card)",
                    cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{ut.name}</p>
                    {(ut.bedrooms != null || ut.bathrooms != null) && (
                      <div style={{ marginTop: 3, fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: 10 }}>
                        {ut.bedrooms != null && <span>{ut.bedrooms} rec.</span>}
                        {ut.bathrooms != null && <span>{ut.bathrooms} baño{ut.bathrooms !== 1 ? "s" : ""}</span>}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>Usar →</span>
                </button>
              ))}
            </div>
            <UiButton
              type="button"
              onClick={() => {
                createForm.setValue("unitTypeId", "");
                setCreateModalStep(1);
              }}
            >
              Empezar desde cero
            </UiButton>
          </div>
        )}

        {/* ── PASO 1: formulario de creación ── */}
        {createModalStep === 1 && (
        <form onSubmit={onCreateUnit}>
          {/* ── Número / nombre — siempre presente ── */}
          {(() => {
            if (cat === "commercial") {
              const cfg = getCommercialFieldConfig(building.building_subtype);
              return (
                <AppFormField label={cfg.label} required>
                  <input {...createForm.register("unitNumber")} placeholder={cfg.placeholder} style={INPUT_STYLE} />
                  {createForm.formState.errors.unitNumber ? <p style={errorTextStyle}>{createForm.formState.errors.unitNumber.message}</p> : null}
                </AppFormField>
              );
            }
            if (cat === "industrial" || cat === "industrial_park") {
              const indLabel = building.building_subtype === "nave_industrial"
                ? "Número de bodega"
                : `Número / nombre de ${labels.unit.toLowerCase()}`;
              const indPlaceholder = building.building_subtype === "nave_industrial"
                ? "Ej: Bodega 1, B-01"
                : "Ej: Nave 1, Espacio A";
              return (
                <AppFormField label={indLabel} required>
                  <input {...createForm.register("unitNumber")} placeholder={indPlaceholder} style={INPUT_STYLE} />
                  {createForm.formState.errors.unitNumber ? <p style={errorTextStyle}>{createForm.formState.errors.unitNumber.message}</p> : null}
                </AppFormField>
              );
            }
            /* residential_multi y otros */
            return (
              <AppFormField label={`Número de ${labels.unit.toLowerCase()}`} required>
                <input {...createForm.register("unitNumber")} placeholder="Ej. 101" style={INPUT_STYLE} />
                {createForm.formState.errors.unitNumber ? <p style={errorTextStyle}>{createForm.formState.errors.unitNumber.message}</p> : null}
              </AppFormField>
            );
          })()}

          {/* ── Campos específicos por categoría ── */}
          {isResidentialMulti && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <AppFormField label="Tipología" required>
                  <AppSelect {...createForm.register("unitTypeId")}>
                    <option value="">Selecciona una tipología</option>
                    {unitTypes.map((ut) => <option key={ut.id} value={ut.id}>{ut.name}</option>)}
                  </AppSelect>
                  {createForm.formState.errors.unitTypeId ? <p style={errorTextStyle}>{createForm.formState.errors.unitTypeId.message}</p> : null}
                </AppFormField>
                <AppFormField label="Piso">
                  <input type="number" min={0} {...createForm.register("floor")} placeholder="Ej. 1" style={INPUT_STYLE} />
                </AppFormField>
              </div>
              {selectedTypeForCreate ? <TypePreview type={selectedTypeForCreate} /> : null}
            </>
          )}

          {cat === "commercial" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <AppFormField label="M² totales">
                  <input
                    type="number" min={0} step="0.01"
                    value={createSqm}
                    onChange={e => setCreateSqm(e.target.value)}
                    placeholder="Ej. 85"
                    style={INPUT_STYLE}
                  />
                </AppFormField>
                {getCommercialFieldConfig(building.building_subtype).showFloor && (
                  <AppFormField label="Piso">
                    <input type="number" min={0} {...createForm.register("floor")} placeholder="Ej. 1" style={INPUT_STYLE} />
                  </AppFormField>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Espacios incluidos</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {([ ["has_storage", "Bodega / trastienda"], ["has_bathroom", "Sanitarios"], ["has_parking", "Estacionamiento asignado"], ["has_independent_access", "Acceso independiente"] ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", cursor: "pointer", color: "var(--text-primary)" }}>
                    <input
                      type="checkbox"
                      checked={createCommFlags[key]}
                      onChange={e => setCreateCommFlags(prev => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {(cat === "industrial" || cat === "industrial_park") && (() => {
            const areas: [keyof typeof createIndAreas, string][] = [
              ["almacen_sqm", "Almacén (m²)"],
              ["oficina_sqm", "Oficina interna (m²)"],
              ["patio_sqm",   "Patio de maniobras (m²)"],
              ["carga_sqm",   "Área de carga/descarga (m²)"],
            ];
            const total = Object.values(createIndAreas).reduce((s, v) => s + (parseFloat(v) || 0), 0);
            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                  {areas.map(([key, label]) => (
                    <AppFormField key={key} label={label}>
                      <input
                        type="number" min={0} step="0.01"
                        value={createIndAreas[key]}
                        onChange={e => setCreateIndAreas(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="0"
                        style={INPUT_STYLE}
                      />
                    </AppFormField>
                  ))}
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                  Total: <strong>{total > 0 ? `${total.toLocaleString("es-MX")} m²` : "—"}</strong>
                </p>
                <AppFormField label="Piso">
                  <input type="number" min={0} {...createForm.register("floor")} placeholder="Ej. 1" style={INPUT_STYLE} />
                </AppFormField>
              </>
            );
          })()}

          {/* Para tipos que no son residential_multi ni commercial ni industrial, mostrar solo Piso */}
          {!isResidentialMulti && cat !== "commercial" && cat !== "industrial" && cat !== "industrial_park" && (
            <AppFormField label="Piso">
              <input type="number" min={0} {...createForm.register("floor")} placeholder="Ej. 1" style={INPUT_STYLE} />
            </AppFormField>
          )}

          {building.code && createUnitNumber && createUnitNumber.trim() ? (
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              Código generado: <strong>{generateDisplayCode(building.code, createUnitNumber)}</strong>
            </p>
          ) : null}

          {/* ── Cantidad de espacios a crear ── */}
          <AppFormField label="Cantidad de espacios a crear">
            <input
              type="number"
              min={1}
              max={50}
              value={createCount}
              onChange={e => setCreateCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              style={INPUT_STYLE}
            />
          </AppFormField>
          {createCount > 1 && createUnitNumber.trim() ? (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--border-radius-md)",
              background: "var(--icon-bg-blue)",
              border: "1px solid var(--metric-border-neutral)",
              marginBottom: 12,
              fontSize: "0.75rem",
              color: "var(--badge-text-blue)",
            }}>
              <span style={{ fontWeight: 600 }}>Se crearán: </span>
              {generateBulkNumbers(createUnitNumber.trim(), Math.min(createCount, 5)).join(", ")}
              {createCount > 5 ? ` ... (+${createCount - 5} más)` : ""}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={createForm.formState.isSubmitting} variant="primary">
              {createForm.formState.isSubmitting ? "Guardando..." : createCount > 1 ? `Crear ${createCount} ${labels.units.toLowerCase()}` : `Guardar ${labels.unit.toLowerCase()}`}
            </UiButton>
            {isResidentialMulti && unitTypes.length > 0 && (
              <UiButton type="button" onClick={() => setCreateModalStep(0)}>
                ← Tipología
              </UiButton>
            )}
            <UiButton type="button" onClick={() => {
              setIsCreateModalOpen(false);
              setCreateModalStep(1);
              createForm.reset(CREATE_UNIT_DEFAULTS);
              setCreateSqm("");
              setCreateCommFlags({ ...INIT_COMM_FLAGS });
              setCreateIndAreas({ ...INIT_IND_AREAS });
              setCreateCount(1);
            }}>
              Cancelar
            </UiButton>
          </div>
        </form>
        )}
      </Modal>

      {/* ── Modal duplicar unidad ── */}
      <Modal
        open={pendingDupUnit !== null}
        onClose={() => { if (!duplicating) { setPendingDupUnit(null); setDupUnitCount(1); } }}
        title={`Duplicar ${labels.unit.toLowerCase()}`}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            ¿Cuántas copias quieres crear de <strong>{pendingDupUnit?.unit_number}</strong>?
          </p>
          <AppFormField label="Cantidad de copias">
            <input
              type="number"
              min={1}
              max={50}
              value={dupUnitCount}
              onChange={e => setDupUnitCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              style={INPUT_STYLE}
            />
          </AppFormField>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <UiButton variant="secondary" disabled={duplicating} onClick={() => { setPendingDupUnit(null); setDupUnitCount(1); }}>
              Cancelar
            </UiButton>
            <UiButton variant="primary" disabled={duplicating} onClick={() => void handleDuplicateUnit()}>
              {duplicating ? "Duplicando..." : `Duplicar${dupUnitCount > 1 ? ` (${dupUnitCount})` : ""}`}
            </UiButton>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

/* ─── TypePreview — muestra recámaras/baños de la tipología ─────────── */

function TypePreview({ type }: { type: UnitType }) {
  const hasBed  = type.bedrooms  != null;
  const hasBath = type.bathrooms != null;
  if (!hasBed && !hasBath) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 14px",
        borderRadius: "var(--border-radius-md)",
        background: "var(--bg-page)",
        border: "1px solid var(--border-default)",
        marginBottom: 16,
        fontSize: "0.8125rem",
        color: "var(--text-secondary)",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-muted)", marginRight: 4 }}>
        {type.name}:
      </span>
      {hasBed ? (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <BedDouble size={14} />
          {type.bedrooms} recámara{type.bedrooms !== 1 ? "s" : ""}
        </span>
      ) : null}
      {hasBath ? (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Bath size={14} />
          {type.bathrooms} baño{type.bathrooms !== 1 ? "s" : ""}
        </span>
      ) : null}
    </div>
  );
}
