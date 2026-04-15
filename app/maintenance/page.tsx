"use client";

/*
  Módulo de Mantenimiento — v2.0

  Dos secciones principales:
  1. TICKETS  — sistema completo: filtros, cards expandibles, fotos, materiales, PDF
  2. CALENDARIO — vista semanal/mensual/anual (código original intacto)

  Tablas:
  - maintenance_logs      → tickets (ticket_number, status, priority, photos JSONB)
  - maintenance_materials → materiales por ticket
  - maintenance_categories → categorías activas
  - buildings / units     → labels y filtros

  Storage: bucket "maintenance-photos"
  PDF: jsPDF + autoTable (generación cliente puro)
*/

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  Filter,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import AppCard from "@/components/AppCard";
import AppGrid from "@/components/AppGrid";
import AppTabs from "@/components/AppTabs";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";
import AppFormField from "@/components/AppFormField";

import {
  INPUT_STYLE,
  TEXTAREA_STYLE,
  dropdownMenuStyle,
  dropdownActionButtonStyle,
  dropdownDeleteItemStyle,
  errorBannerStyle,
} from "@/lib/pageStyles";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type MainTab = "tickets" | "calendar";
type ViewMode = "week" | "month" | "year";

type MaintenanceCategory = {
  id: string;
  name: string;
};

type Ticket = {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string | null;
  log_type: string;
  status: string;
  priority: string | null;
  building_id: string | null;
  unit_id: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  photos: string[] | null;
  performed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  category_name_snapshot: string | null;
  buildings: { id: string; name: string; address: string | null } | null;
  units: { id: string; unit_number: string; display_code: string | null } | null;
};

type Material = {
  id: string;
  maintenance_log_id: string;
  description: string;
  quantity: number;
  unit: string;
};

type MaterialDraft = {
  id?: string;
  description: string;
  quantity: string | number;
  unit: string;
};

type BuildingOption = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
};

type UnitOption = {
  id: string;
  unit_number: string;
  display_code: string | null;
  building_id: string;
};

/* Calendar types — kept from v1 */
type RecentLogRow = {
  id: string;
  title: string;
  log_type: string;
  performed_at: string | null;
  next_due_at: string | null;
  status: string;
  asset_name_snapshot: string | null;
  asset_type_snapshot: string | null;
  category_name_snapshot: string | null;
  building_id: string | null;
  unit_id: string | null;
  asset_id: string | null;
};

type EnrichedRecentLogRow = RecentLogRow & {
  building_label: string;
  unit_label: string;
};

type CalendarEvent = {
  id: string;
  dayKey: string;
  isoDate: string;
  title: string;
  subtitle: string;
  kind: "done" | "upcoming";
  colorBackground: string;
  colorBorder: string;
  colorText: string;
};

type WeekDayColumn = {
  key: string;
  label: string;
  shortDate: string;
  isoDate: string;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MATERIAL_UNITS = [
  "Pieza", "Metro", "Litro", "Tubo", "Caja", "Rollo", "Bolsa", "Otro",
];

const TICKET_CATEGORIES = [
  "Plomería", "Electricidad", "Pintura", "Carpintería",
  "Aire acondicionado", "Limpieza", "Otro",
];

const PRIORITIES = [
  { value: "alta",  label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja",  label: "Baja" },
];

const TICKET_STATUSES = [
  { value: "open",        label: "Abierto" },
  { value: "in_progress", label: "En proceso" },
  { value: "resolved",    label: "Resuelto" },
];

const LOG_TYPES = [
  { value: "corrective",  label: "Correctivo" },
  { value: "preventive",  label: "Preventivo" },
  { value: "inspection",  label: "Inspección" },
  { value: "replacement", label: "Reemplazo" },
];

/* Calendar */
const DAY_ORDER = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── BADGE / COLOR HELPERS ────────────────────────────────────────────────────

function getPriorityStyle(priority: string | null): CSSProperties {
  const p = (priority || "").toLowerCase();
  if (p === "alta") return { background: "var(--badge-bg-red)",   color: "var(--badge-text-red)",   border: "1px solid var(--metric-border-red)" };
  if (p === "baja") return { background: "var(--badge-bg-blue)",  color: "var(--badge-text-blue)",  border: "1px solid var(--metric-border-blue)" };
  return             { background: "var(--badge-bg-amber)", color: "var(--badge-text-amber)", border: "1px solid var(--metric-border-amber)" };
}

function getStatusStyle(status: string | null): CSSProperties {
  const s = (status || "").toLowerCase();
  if (s === "open")        return { background: "var(--badge-bg-red)",   color: "var(--badge-text-red)",   border: "1px solid var(--metric-border-red)" };
  if (s === "resolved")    return { background: "var(--badge-bg-green)", color: "var(--badge-text-green)", border: "1px solid var(--metric-border-green)" };
  return                          { background: "var(--badge-bg-amber)", color: "var(--badge-text-amber)", border: "1px solid var(--metric-border-amber)" };
}

function getPriorityLabel(priority: string | null) {
  const p = (priority || "").toLowerCase();
  if (p === "alta") return "Alta";
  if (p === "baja") return "Baja";
  return "Media";
}

function getStatusLabel(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "open")        return "Abierto";
  if (s === "in_progress") return "En proceso";
  if (s === "resolved")    return "Resuelto";
  return status || "—";
}

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getTicketNumber(ticket: Ticket) {
  if (ticket.ticket_number) return ticket.ticket_number;
  return `MT-${new Date(ticket.created_at).getFullYear()}-${ticket.id.slice(0, 6).toUpperCase()}`;
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return "—";
  return new Date(dateValue).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ─── CALENDAR HELPERS — kept intact from v1 ──────────────────────────────────

function getStartOfWeek(date: Date) {
  const copy = new Date(date);
  const jsDay = copy.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatShortDate(date: Date) {
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()].slice(0, 3)}`;
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 5);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} - ${end.getDate()} ${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${MONTH_LABELS[start.getMonth()]} - ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()} - ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${end.getFullYear()}`;
}

function formatMonthLabel(date: Date) {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatYearLabel(date: Date) {
  return `${date.getFullYear()}`;
}

function getDateOnlyKey(dateValue: string | null) {
  if (!dateValue) return "";
  return dateValue.slice(0, 10);
}

function parseDateOnly(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDayKeyFromDateValue(dateValue: string | null) {
  const dateKey = getDateOnlyKey(dateValue);
  if (!dateKey) return "";
  const date = parseDateOnly(dateKey);
  const jsDay = date.getDay();
  if (jsDay === 0) return "sunday";
  if (jsDay === 1) return "monday";
  if (jsDay === 2) return "tuesday";
  if (jsDay === 3) return "wednesday";
  if (jsDay === 4) return "thursday";
  if (jsDay === 5) return "friday";
  return "saturday";
}

function formatLogType(logType: string) {
  const n = (logType || "").toLowerCase();
  if (n === "preventive")  return "Preventivo";
  if (n === "corrective")  return "Correctivo";
  if (n === "replacement") return "Reemplazo";
  if (n === "inspection")  return "Inspección";
  if (n === "note")        return "Nota";
  return logType || "Sin tipo";
}

function renderViewTab(label: string, active: boolean, onClick: () => void) {
  return (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 10,
        border: "1px solid",
        borderColor: active ? "var(--accent)" : "var(--border-default)",
        background: active ? "var(--accent)" : "var(--bg-card)",
        color: active ? "#fff" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ─── INLINE BADGE ─────────────────────────────────────────────────────────────

function Badge({ label, style }: { label: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

// ─── CREATE FORM DEFAULT ──────────────────────────────────────────────────────

const EMPTY_CREATE_FORM = {
  title: "",
  building_id: "",
  unit_id: "",
  category: "",
  priority: "media",
  log_type: "corrective",
  description: "",
  reported_by: "",
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { user, loading } = useCurrentUser();
  const { logoUrl } = useTheme();
  const router = useRouter();

  /* ── Main tab ───────────────────────────────────────────────────── */
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("tickets");

  /* ── Shared data ────────────────────────────────────────────────── */
  const [buildings, setBuildings]   = useState<BuildingOption[]>([]);
  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [msg, setMsg] = useState("");
  const [companyName, setCompanyName]         = useState("");
  const [companyLogoPrint, setCompanyLogoPrint] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl]     = useState("");

  /* ── Tickets ────────────────────────────────────────────────────── */
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const [materialsByTicket, setMaterialsByTicket] =
    useState<Record<string, Material[]>>({});
  const [editingMaterials, setEditingMaterials] =
    useState<Record<string, MaterialDraft[]>>({});

  const [savingMaterialsId, setSavingMaterialsId] = useState<string | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId]   = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId]     = useState<string | null>(null);

  /* ── Filters ────────────────────────────────────────────────────── */
  const [filterBuilding,  setFilterBuilding]  = useState("ALL");
  const [filterPriority,  setFilterPriority]  = useState("ALL");
  const [filterStatus,    setFilterStatus]    = useState("ALL");
  const [filterCategory,  setFilterCategory]  = useState("ALL");

  /* ── Create ticket modal ────────────────────────────────────────── */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm]           = useState(EMPTY_CREATE_FORM);
  const [createUnits, setCreateUnits]         = useState<UnitOption[]>([]);
  const [creating, setCreating]               = useState(false);
  const [createError, setCreateError]         = useState("");

  /* ── Change status modal ────────────────────────────────────────── */
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget]       = useState<Ticket | null>(null);
  const [statusValue, setStatusValue]         = useState("open");
  const [resolvedAt, setResolvedAt]           = useState("");
  const [changingStatus, setChangingStatus]   = useState(false);

  /* ── Calendar state — intacto desde v1 ─────────────────────────── */
  const [recentLogs, setRecentLogs]           = useState<EnrichedRecentLogRow[]>([]);
  const [calendarBuildings, setCalendarBuildings] = useState<BuildingOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("ALL");
  const [viewMode, setViewMode]               = useState<ViewMode>("week");
  const [referenceDate, setReferenceDate]     = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  /* ── Router guard ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id) void loadPageData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── DATA LOADING ─────────────────────────────────────────────────────────

  async function loadPageData() {
    if (!user?.company_id) return;
    setLoadingData(true);
    setMsg("");

    const [
      { data: catData },
      { data: buildData },
      { data: ticketData, error: ticketError },
      { data: companyData },
    ] = await Promise.all([
      supabase
        .from("maintenance_categories")
        .select("id, name")
        .eq("company_id", user.company_id)
        .order("name", { ascending: true }),

      supabase
        .from("buildings")
        .select("id, name, code, address")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),

      supabase
        .from("maintenance_logs")
        .select(`
          id, ticket_number, title, description, log_type, status, priority,
          building_id, unit_id, reported_by, assigned_to, photos,
          performed_at, resolved_at, created_at,
          category_name_snapshot,
          buildings(id, name, address),
          units(id, unit_number, display_code)
        `)
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("companies")
        .select("name, logo_url, logo_print_url, logo_dark_url")
        .eq("id", user.company_id)
        .single(),
    ]);

    if (ticketError) {
      setMsg("No se pudieron cargar los tickets de mantenimiento.");
    } else {
      setTickets((ticketData as unknown as Ticket[]) || []);
    }

    setCategories((catData as MaintenanceCategory[]) || []);
    setBuildings((buildData as BuildingOption[]) || []);
    if (companyData && "name" in companyData) {
      const cd = companyData as { name: string; logo_url?: string; logo_print_url?: string };
      setCompanyName(cd.name || "");
      setCompanyLogoPrint(cd.logo_print_url || "");
      setCompanyLogoUrl(cd.logo_url || "");
    }

    await loadCalendarData(user.company_id);
    setLoadingData(false);
  }

  async function loadCalendarData(companyId: string) {
    const [{ data: buildData }, { data: logsData }] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name, code, address")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name"),

      supabase
        .from("maintenance_logs")
        .select(
          "id, title, log_type, performed_at, next_due_at, status, asset_name_snapshot, asset_type_snapshot, category_name_snapshot, building_id, unit_id, asset_id"
        )
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("performed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    setCalendarBuildings((buildData as BuildingOption[]) || []);
    const parsedLogs = (logsData as RecentLogRow[]) || [];

    const buildingIds = Array.from(
      new Set(parsedLogs.map((l) => l.building_id).filter(Boolean) as string[])
    );
    const unitIds = Array.from(
      new Set(parsedLogs.map((l) => l.unit_id).filter(Boolean) as string[])
    );

    let buildingMap = new Map<string, BuildingOption>();
    let unitMap     = new Map<string, UnitOption>();

    if (buildingIds.length > 0) {
      const { data } = await supabase
        .from("buildings")
        .select("id, name, code, address")
        .in("id", buildingIds)
        .is("deleted_at", null);
      if (data) buildingMap = new Map((data as BuildingOption[]).map((b) => [b.id, b]));
    }

    if (unitIds.length > 0) {
      const { data } = await supabase
        .from("units")
        .select("id, unit_number, display_code, building_id")
        .in("id", unitIds)
        .is("deleted_at", null);
      if (data) unitMap = new Map((data as UnitOption[]).map((u) => [u.id, u]));
    }

    const enriched: EnrichedRecentLogRow[] = parsedLogs.map((log) => {
      const building = log.building_id ? buildingMap.get(log.building_id) : null;
      const unit     = log.unit_id     ? unitMap.get(log.unit_id)         : null;
      return {
        ...log,
        building_label: building ? building.name : "Sin edificio ligado",
        unit_label: unit ? `Departamento ${unit.display_code || unit.unit_number}` : "",
      };
    });

    setRecentLogs(enriched);
  }

  async function loadMaterials(ticketId: string) {
    const { data, error } = await supabase
      .from("maintenance_materials")
      .select("id, maintenance_log_id, description, quantity, unit")
      .eq("maintenance_log_id", ticketId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const mats = (!error && data) ? (data as Material[]) : [];
    setMaterialsByTicket((prev) => ({ ...prev, [ticketId]: mats }));
    setEditingMaterials((prev) => ({
      ...prev,
      [ticketId]: mats.map((m) => ({
        id: m.id, description: m.description, quantity: m.quantity, unit: m.unit,
      })),
    }));
  }

  // ─── TICKET ACTIONS ───────────────────────────────────────────────────────

  async function handleToggleExpand(ticketId: string) {
    if (expandedId === ticketId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ticketId);
    if (!materialsByTicket[ticketId]) {
      await loadMaterials(ticketId);
    }
  }

  async function handleCreateTicket(e: FormEvent) {
    e.preventDefault();
    if (!user?.company_id) return;
    if (!createForm.title.trim())   { setCreateError("El título es requerido."); return; }
    if (!createForm.building_id)    { setCreateError("Selecciona un edificio."); return; }
    if (!createForm.category)       { setCreateError("Selecciona una categoría."); return; }

    setCreating(true);
    setCreateError("");

    const { error } = await supabase.from("maintenance_logs").insert({
      company_id:              user.company_id,
      title:                   createForm.title.trim(),
      building_id:             createForm.building_id || null,
      unit_id:                 createForm.unit_id     || null,
      category_name_snapshot:  createForm.category    || null,
      priority:                createForm.priority,
      log_type:                createForm.log_type,
      description:             createForm.description.trim() || null,
      reported_by:             createForm.reported_by.trim() || null,
      status:                  "open",
    });

    if (error) {
      setCreateError(error.message);
      setCreating(false);
      return;
    }

    setShowCreateModal(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateUnits([]);
    setCreating(false);
    await loadPageData();
  }

  async function handleChangeStatus() {
    if (!statusTarget) return;
    setChangingStatus(true);

    const updateData: Record<string, string | null> = { status: statusValue };
    if (statusValue === "resolved") {
      updateData.resolved_at = resolvedAt || new Date().toISOString().slice(0, 10);
    } else {
      updateData.resolved_at = null;
    }

    const { error } = await supabase
      .from("maintenance_logs")
      .update(updateData)
      .eq("id", statusTarget.id);

    if (!error) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === statusTarget.id
            ? { ...t, status: statusValue, resolved_at: updateData.resolved_at ?? null }
            : t
        )
      );
    }

    setShowStatusModal(false);
    setStatusTarget(null);
    setChangingStatus(false);
  }

  async function handleArchive(ticketId: string) {
    setOpenActionsId(null);
    const { error } = await supabase
      .from("maintenance_logs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (!error) {
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      if (expandedId === ticketId) setExpandedId(null);
    }
  }

  async function handleUploadPhoto(ticket: Ticket, file: File) {
    setUploadingPhotoId(ticket.id);

    const folder   = ticket.ticket_number || ticket.id.slice(0, 8);
    const filename = `${folder}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("maintenance-photos")
      .upload(filename, file, { upsert: false });

    if (uploadError) {
      setMsg(`Error al subir foto: ${uploadError.message}`);
      setUploadingPhotoId(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("maintenance-photos")
      .getPublicUrl(uploadData.path);

    const newPhotos = [...(ticket.photos || []), urlData.publicUrl];

    const { error: updateError } = await supabase
      .from("maintenance_logs")
      .update({ photos: newPhotos })
      .eq("id", ticket.id);

    if (!updateError) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, photos: newPhotos } : t))
      );
    }

    setUploadingPhotoId(null);
  }

  async function handleDeletePhoto(ticket: Ticket, photoUrl: string) {
    const newPhotos = (ticket.photos || []).filter((u) => u !== photoUrl);

    const { error } = await supabase
      .from("maintenance_logs")
      .update({ photos: newPhotos })
      .eq("id", ticket.id);

    if (!error) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, photos: newPhotos } : t))
      );
    }

    /* Best-effort: eliminar del bucket también */
    try {
      const parts = photoUrl.split("/storage/v1/object/public/maintenance-photos/");
      if (parts.length === 2) {
        await supabase.storage.from("maintenance-photos").remove([parts[1]]);
      }
    } catch {
      /* no es crítico */
    }
  }

  async function handleSaveMaterials(ticketId: string) {
    setSavingMaterialsId(ticketId);

    /* Soft-delete todos los existentes */
    await supabase
      .from("maintenance_materials")
      .update({ deleted_at: new Date().toISOString() })
      .eq("maintenance_log_id", ticketId)
      .is("deleted_at", null);

    /* Insertar los renglones actuales */
    const validDrafts = (editingMaterials[ticketId] || []).filter(
      (d) => d.description.trim() && d.quantity !== ""
    );

    if (validDrafts.length > 0) {
      await supabase.from("maintenance_materials").insert(
        validDrafts.map((d) => ({
          maintenance_log_id: ticketId,
          description:        d.description.trim(),
          quantity:           Number(d.quantity),
          unit:               d.unit,
        }))
      );
    }

    await loadMaterials(ticketId);
    setSavingMaterialsId(null);
  }

  async function handleGeneratePDF(ticket: Ticket) {
    const mats = materialsByTicket[ticket.id] || [];
    setGeneratingPdfId(ticket.id);

    /* Comprime el logo usando canvas antes de insertarlo en el PDF */
    async function compressLogoForPDF(imgUrl: string): Promise<string> {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const maxW = 300, maxH = 100;
          const ratio = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const canvas = document.createElement("canvas");
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve("");
        img.src = imgUrl;
      });
    }

    try {
      const { default: jsPDF }     = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      /* Letter: 612 x 792 pt */
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW   = 612;
      const marginL = 40;
      const marginR = 40;
      const contentW = pageW - marginL - marginR;

      const year  = new Date().getFullYear();
      const folio = `OM-${year}-${String(ticket.ticket_number || ticket.id.slice(0, 6)).toUpperCase()}`;
      const fechaStr = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

      const buildingName    = ticket.buildings?.name    || "Sin edificio";
      const buildingAddress = ticket.buildings?.address || "";
      const unitLabel       = ticket.units
        ? `${ticket.units.display_code || ticket.units.unit_number}`
        : "—";
      const categoryLabel = ticket.category_name_snapshot || "—";
      const priorityLabel = getPriorityLabel(ticket.priority);

      /* ── HEADER ──────────────────────────────────────────────────── */
      let cursorY = 40;
      let logoEndX = marginL; /* donde termina el bloque del logo */

      /* Logo comprimido — logo_print_url tiene prioridad sobre logo_url */
      const pdfLogoSrc = companyLogoPrint || companyLogoUrl;
      if (pdfLogoSrc) {
        try {
          const compressed = await compressLogoForPDF(pdfLogoSrc);
          if (compressed) {
            /* Calcular dimensiones proporcionales máx 120pt ancho, 60pt alto */
            const tmpImg = new Image();
            await new Promise<void>((res) => { tmpImg.onload = () => res(); tmpImg.onerror = () => res(); tmpImg.src = compressed; });
            const logoMaxW = 120, logoMaxH = 60;
            const logoRatio = Math.min(logoMaxW / (tmpImg.width || 1), logoMaxH / (tmpImg.height || 1));
            const logoW = (tmpImg.width || logoMaxW) * logoRatio;
            const logoH = (tmpImg.height || logoMaxH) * logoRatio;
            doc.addImage(compressed, "PNG", marginL, cursorY, logoW, logoH);
            logoEndX = marginL + logoW + 16;
          }
        } catch { /* sin logo */ }
      }

      /* Título + folio + fecha (columna derecha del header) */
      const headerRightX = logoEndX + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Orden de Materiales", headerRightX, cursorY + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Folio: ${folio}`, headerRightX, cursorY + 30);
      doc.text(`Fecha: ${fechaStr}`, headerRightX, cursorY + 44);

      cursorY += 72;

      /* Línea separadora */
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(marginL, cursorY, pageW - marginR, cursorY);
      cursorY += 16;

      /* ── GRID DE DATOS (2 columnas) ──────────────────────────────── */
      const colW    = (contentW - 8) / 2;
      const cellH   = 36;
      const cellPad = 8;
      const col2X   = marginL + colW + 8;

      function drawCell(x: number, y: number, w: number, label: string, value: string, fullWidth = false) {
        const cellWidth = fullWidth ? contentW : w;
        /* Fondo */
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(x, y, cellWidth, cellH, 4, 4, "F");
        /* Borde */
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, cellWidth, cellH, 4, 4, "S");
        /* Label */
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(label.toUpperCase(), x + cellPad, y + cellPad + 7);
        /* Valor */
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const maxValueW = cellWidth - cellPad * 2;
        const valueLines = doc.splitTextToSize(value || "—", maxValueW) as string[];
        doc.text(valueLines[0] ?? "—", x + cellPad, y + cellPad + 20);
      }

      const rowGap = cellH + 6;

      /* Fila 1 */
      drawCell(marginL, cursorY, colW, "Edificio",   buildingName);
      drawCell(col2X,   cursorY, colW, "Ticket #",   getTicketNumber(ticket));
      cursorY += rowGap;

      /* Fila 2 */
      drawCell(marginL, cursorY, colW, "Dirección",  buildingAddress || "—");
      drawCell(col2X,   cursorY, colW, "Categoría",  categoryLabel);
      cursorY += rowGap;

      /* Fila 3 */
      drawCell(marginL, cursorY, colW, "Departamento", unitLabel);
      drawCell(col2X,   cursorY, colW, "Prioridad",    priorityLabel);
      cursorY += rowGap;

      /* Fila 4 — descripción, ancho completo */
      const descText  = ticket.description || ticket.title;
      const descLines = doc.splitTextToSize(descText, contentW - cellPad * 2) as string[];
      const descCellH = Math.max(cellH, cellPad * 2 + descLines.length * 12);

      doc.setFillColor(248, 249, 250);
      doc.roundedRect(marginL, cursorY, contentW, descCellH, 4, 4, "F");
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.roundedRect(marginL, cursorY, contentW, descCellH, 4, 4, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("DESCRIPCIÓN DEL PROBLEMA", marginL + cellPad, cursorY + cellPad + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(descLines, marginL + cellPad, cursorY + cellPad + 20);

      cursorY += descCellH + 16;

      /* ── TABLA DE MATERIALES ─────────────────────────────────────── */
      type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginL, right: marginR },
        head: [["#", "Material", "Cantidad", "Unidad"]],
        body: mats.length > 0
          ? mats.map((m, i) => [String(i + 1), m.description, String(m.quantity), m.unit])
          : [["—", "Sin materiales registrados", "", ""]],
        theme: "plain",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 8,
        },
        bodyStyles: {
          fontSize: 10,
          cellPadding: 8,
          textColor: [15, 23, 42],
        },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        styles: {
          lineColor: [229, 231, 235],
          lineWidth: 0.5,
        },
        columnStyles: {
          0: { cellWidth: 24 },
          2: { cellWidth: 60, halign: "center" },
          3: { cellWidth: 60 },
        },
      });

      /* ── FOOTER ──────────────────────────────────────────────────── */
      const finalY = (doc as DocWithAutoTable).lastAutoTable?.finalY ?? cursorY + 40;
      const footerY = finalY + 20;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(marginL, footerY, pageW - marginR, footerY);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generado por PropAdmin · ${companyName || ""} · ${fechaStr}`,
        marginL,
        footerY + 14,
      );

      doc.save(`orden-materiales-${folio}.pdf`);
    } catch {
      setMsg("Error al generar el PDF.");
    }

    setGeneratingPdfId(null);
  }

  async function handleCreateBuildingChange(buildingId: string) {
    setCreateForm((prev) => ({ ...prev, building_id: buildingId, unit_id: "" }));
    if (!buildingId) { setCreateUnits([]); return; }

    const { data } = await supabase
      .from("units")
      .select("id, unit_number, display_code, building_id")
      .eq("building_id", buildingId)
      .is("deleted_at", null)
      .order("unit_number");

    setCreateUnits((data as UnitOption[]) || []);
  }

  function openStatusModal(ticket: Ticket) {
    setOpenActionsId(null);
    setStatusTarget(ticket);
    setStatusValue(ticket.status || "open");
    setResolvedAt(
      ticket.resolved_at
        ? ticket.resolved_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setShowStatusModal(true);
  }

  // ─── CALENDAR COMPUTED — intacto desde v1 ─────────────────────────────────

  const filteredCalendarLogs = useMemo(() => {
    return recentLogs.filter((log) => {
      if (selectedBuildingId === "ALL") return true;
      return log.building_id === selectedBuildingId;
    });
  }, [recentLogs, selectedBuildingId]);

  const weekStart = useMemo(() => getStartOfWeek(referenceDate), [referenceDate]);

  const weekDays = useMemo<WeekDayColumn[]>(() => {
    return DAY_ORDER.map((dayKey, index) => {
      const date = addDays(weekStart, index);
      return {
        key: dayKey,
        label: DAY_LABELS[dayKey],
        shortDate: formatShortDate(date),
        isoDate: date.toISOString().slice(0, 10),
      };
    });
  }, [weekStart]);

  const weekEvents = useMemo<CalendarEvent[]>(() => {
    const weekDateSet = new Set(weekDays.map((d) => d.isoDate));

    const doneEvents: CalendarEvent[] = filteredCalendarLogs
      .filter((log) => { const iso = getDateOnlyKey(log.performed_at); return iso && weekDateSet.has(iso); })
      .map((log) => ({
        id: `done-${log.id}`,
        dayKey: getDayKeyFromDateValue(log.performed_at),
        isoDate: getDateOnlyKey(log.performed_at),
        title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
        subtitle: `${log.title} · ${formatLogType(log.log_type)}`,
        kind: "done",
        colorBackground: "var(--metric-bg-amber)",
        colorBorder: "var(--metric-border-amber)",
        colorText: "var(--metric-value-amber)",
      }));

    const upcomingEvents: CalendarEvent[] = filteredCalendarLogs
      .filter((log) => { const iso = getDateOnlyKey(log.next_due_at); return iso && weekDateSet.has(iso); })
      .map((log) => ({
        id: `upcoming-${log.id}`,
        dayKey: getDayKeyFromDateValue(log.next_due_at),
        isoDate: getDateOnlyKey(log.next_due_at),
        title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
        subtitle: `${log.title} · Próximo`,
        kind: "upcoming",
        colorBackground: "var(--badge-bg-amber)",
        colorBorder: "var(--metric-border-amber)",
        colorText: "var(--badge-text-amber)",
      }));

    return [...doneEvents, ...upcomingEvents]
      .filter((e) => e.dayKey !== "sunday")
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredCalendarLogs, weekDays]);

  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    DAY_ORDER.forEach((day) => map.set(day, []));
    weekEvents.forEach((event) => {
      const cur = map.get(event.dayKey) || [];
      cur.push(event);
      map.set(event.dayKey, cur);
    });
    return map;
  }, [weekEvents]);

  const monthDays = useMemo(() => {
    const monthStart = getStartOfMonth(referenceDate);
    const monthEnd   = getEndOfMonth(referenceDate);
    const days: { isoDate: string; label: string; dayNumber: number }[] = [];
    let cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const isoDate = cursor.toISOString().slice(0, 10);
      const dayKey  = getDayKeyFromDateValue(isoDate);
      if (dayKey !== "sunday") {
        days.push({ isoDate, label: DAY_LABELS[dayKey], dayNumber: cursor.getDate() });
      }
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [referenceDate]);

  const monthEventsByDate = useMemo(() => {
    const monthDateSet = new Set(monthDays.map((d) => d.isoDate));
    const map = new Map<string, CalendarEvent[]>();
    monthDays.forEach((d) => map.set(d.isoDate, []));

    const doneEvents = filteredCalendarLogs
      .filter((log) => { const iso = getDateOnlyKey(log.performed_at); return iso && monthDateSet.has(iso); })
      .map((log) => ({
        id: `done-${log.id}`,
        dayKey: getDayKeyFromDateValue(log.performed_at),
        isoDate: getDateOnlyKey(log.performed_at),
        title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
        subtitle: `${log.title} · ${formatLogType(log.log_type)}`,
        kind: "done" as const,
        colorBackground: "var(--metric-bg-amber)",
        colorBorder: "var(--metric-border-amber)",
        colorText: "var(--metric-value-amber)",
      }));

    const upcomingEvents = filteredCalendarLogs
      .filter((log) => { const iso = getDateOnlyKey(log.next_due_at); return iso && monthDateSet.has(iso); })
      .map((log) => ({
        id: `upcoming-${log.id}`,
        dayKey: getDayKeyFromDateValue(log.next_due_at),
        isoDate: getDateOnlyKey(log.next_due_at),
        title: `${log.building_label}${log.unit_label ? ` · ${log.unit_label}` : ""}`,
        subtitle: `${log.title} · Próximo`,
        kind: "upcoming" as const,
        colorBackground: "var(--badge-bg-amber)",
        colorBorder: "var(--metric-border-amber)",
        colorText: "var(--badge-text-amber)",
      }));

    [...doneEvents, ...upcomingEvents]
      .filter((e) => e.dayKey !== "sunday")
      .forEach((event) => {
        const cur = map.get(event.isoDate) || [];
        cur.push(event);
        map.set(event.isoDate, cur);
      });

    return map;
  }, [filteredCalendarLogs, monthDays]);

  const yearSummary = useMemo(() => {
    const targetYear = referenceDate.getFullYear();
    return MONTH_LABELS.map((monthLabel, monthIndex) => {
      const monthDone = filteredCalendarLogs.filter((log) => {
        const iso = getDateOnlyKey(log.performed_at);
        if (!iso) return false;
        const d = parseDateOnly(iso);
        return d.getFullYear() === targetYear && d.getMonth() === monthIndex && d.getDay() !== 0;
      }).length;
      const monthUpcoming = filteredCalendarLogs.filter((log) => {
        const iso = getDateOnlyKey(log.next_due_at);
        if (!iso) return false;
        const d = parseDateOnly(iso);
        return d.getFullYear() === targetYear && d.getMonth() === monthIndex && d.getDay() !== 0;
      }).length;
      return { monthLabel, done: monthDone, upcoming: monthUpcoming, total: monthDone + monthUpcoming };
    });
  }, [filteredCalendarLogs, referenceDate]);

  const calendarTotals = useMemo(() => ({
    categories: categories.length,
    upcoming:   recentLogs.filter((l) => !!l.next_due_at).length,
    corrective: recentLogs.filter((l) => l.log_type === "corrective").length,
  }), [categories, recentLogs]);

  const selectedCalendarBuildingLabel =
    selectedBuildingId === "ALL"
      ? "Todos los edificios"
      : calendarBuildings.find((b) => b.id === selectedBuildingId)?.name || "Edificio";

  function goPrevious() {
    if (viewMode === "week")  { setReferenceDate((p) => addDays(p, -7)); return; }
    if (viewMode === "month") { setReferenceDate((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1)); return; }
    setReferenceDate((p) => new Date(p.getFullYear() - 1, 0, 1));
  }
  function goCurrent() { const t = new Date(); t.setHours(0, 0, 0, 0); setReferenceDate(t); }
  function goNext() {
    if (viewMode === "week")  { setReferenceDate((p) => addDays(p, 7)); return; }
    if (viewMode === "month") { setReferenceDate((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1)); return; }
    setReferenceDate((p) => new Date(p.getFullYear() + 1, 0, 1));
  }

  const currentLabel =
    viewMode === "week"  ? formatWeekRange(weekStart)     :
    viewMode === "month" ? formatMonthLabel(referenceDate) :
                           formatYearLabel(referenceDate);

  // ─── TICKET COMPUTED ──────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState("");

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim() ? normalizeText(searchQuery.trim()) : "";
    return tickets.filter((t) => {
      if (filterBuilding  !== "ALL" && t.building_id !== filterBuilding) return false;
      if (filterPriority  !== "ALL" && (t.priority || "").toLowerCase() !== filterPriority) return false;
      if (filterStatus    !== "ALL" && (t.status   || "").toLowerCase() !== filterStatus)   return false;
      if (filterCategory  !== "ALL" && t.category_name_snapshot !== filterCategory) return false;
      if (q) {
        const num      = normalizeText(t.ticket_number || "");
        const title    = normalizeText(t.title);
        const building = normalizeText(t.buildings?.name || "");
        const unit     = normalizeText(t.units?.display_code || t.units?.unit_number || "");
        if (!num.includes(q) && !title.includes(q) && !building.includes(q) && !unit.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, filterBuilding, filterPriority, filterStatus, filterCategory, searchQuery]);

  const ticketTotals = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return {
      total:   tickets.length,
      open:    tickets.filter((t) => (t.status || "").toLowerCase() === "open").length,
      inProg:  tickets.filter((t) => (t.status || "").toLowerCase() === "in_progress").length,
      resolved: tickets.filter((t) => {
        if ((t.status || "").toLowerCase() !== "resolved") return false;
        const ref = t.resolved_at || t.created_at;
        return ref.slice(0, 7) === thisMonth;
      }).length,
    };
  }, [tickets]);

  const hasFilters =
    filterBuilding !== "ALL" || filterPriority !== "ALL" ||
    filterStatus   !== "ALL" || filterCategory !== "ALL";

  // ─── LOADING GUARDS ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-secondary)" }}>Cargando usuario...</div>
      </PageContainer>
    );
  }
  if (!user) return null;
  if (loadingData) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-secondary)" }}>Cargando mantenimiento...</div>
      </PageContainer>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <PageHeader
        title="Mantenimiento"
        subtitle="Gestión de tickets, seguimiento de trabajos y calendario operativo."
        titleIcon={<Wrench size={18} />}
        actions={
          activeMainTab === "tickets" ? (
            <UiButton
              icon={<Plus size={16} />}
              onClick={() => { setCreateError(""); setShowCreateModal(true); }}
            >
              Nuevo ticket
            </UiButton>
          ) : undefined
        }
      />

      {msg ? (
        <div style={{ ...errorBannerStyle, marginBottom: 16 }}>{msg}</div>
      ) : null}

      {/* ── Tabs principales ──────────────────────────────────────── */}
      <AppTabs
        activeKey={activeMainTab}
        onChange={(key) => setActiveMainTab(key as MainTab)}
        tabs={[
          { key: "tickets",  label: "Tickets",    icon: <ClipboardList size={16} />, count: tickets.length },
          { key: "calendar", label: "Calendario", icon: <CalendarClock size={16} /> },
        ]}
      />

      <div style={{ marginTop: 18 }}>

        {/* ══════════════════════════════ TAB: TICKETS ══════════════════════════════ */}
        {activeMainTab === "tickets" ? (
          <div style={{ display: "grid", gap: 18 }}>

            {/* Métricas */}
            <AppGrid minWidth={220}>
              <MetricCard
                label="Total tickets"
                value={ticketTotals.total}
                icon={<ClipboardList size={18} />}
                variant="neutral"
                helper="Todos los registros"
              />
              <MetricCard
                label="Abiertos"
                value={ticketTotals.open}
                icon={<CircleAlert size={18} />}
                variant="red"
                helper="Pendientes de atención"
              />
              <MetricCard
                label="En proceso"
                value={ticketTotals.inProg}
                icon={<Wrench size={18} />}
                variant="amber"
                helper="En seguimiento"
              />
              <MetricCard
                label="Resueltos este mes"
                value={ticketTotals.resolved}
                icon={<ShieldCheck size={18} />}
                variant="green"
                helper="Cerrados el mes actual"
              />
            </AppGrid>

            {/* Filtros */}
            <AppCard>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}
                >
                  <Filter size={14} /> Filtros
                </div>

                {/* Buscador de texto libre */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--bg-input)", minWidth: 240, flex: "1 1 240px", maxWidth: 360 }}>
                  <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar ticket o descripción..."
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)" }}
                  />
                  {searchQuery ? (
                    <button type="button" onClick={() => setSearchQuery("")} style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)" }}>
                      <X size={14} />
                    </button>
                  ) : null}
                </div>

                <select
                  value={filterBuilding}
                  onChange={(e) => setFilterBuilding(e.target.value)}
                  style={{ ...INPUT_STYLE, width: "auto", minWidth: 190, padding: "9px 12px" }}
                >
                  <option value="ALL">Todos los edificios</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  style={{ ...INPUT_STYLE, width: "auto", minWidth: 180, padding: "9px 12px" }}
                >
                  <option value="ALL">Todas las prioridades</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ ...INPUT_STYLE, width: "auto", minWidth: 170, padding: "9px 12px" }}
                >
                  <option value="ALL">Todos los estados</option>
                  {TICKET_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{ ...INPUT_STYLE, width: "auto", minWidth: 190, padding: "9px 12px" }}
                >
                  <option value="ALL">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>

                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterBuilding("ALL");
                      setFilterPriority("ALL");
                      setFilterStatus("ALL");
                      setFilterCategory("ALL");
                    }}
                    style={{
                      padding: "9px 12px", borderRadius: 10,
                      border: "1px solid var(--border-default)",
                      background: "transparent", color: "var(--text-muted)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>
            </AppCard>

            {/* Lista de tickets */}
            {filteredTickets.length === 0 ? (
              <AppCard>
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  {tickets.length === 0
                    ? "No hay tickets. Crea el primero con el botón de arriba."
                    : "No hay tickets con los filtros seleccionados."}
                </div>
              </AppCard>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filteredTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    isExpanded={expandedId === ticket.id}
                    isMenuOpen={openActionsId === ticket.id}
                    onToggle={() => handleToggleExpand(ticket.id)}
                    onMenuOpen={() =>
                      setOpenActionsId((prev) => (prev === ticket.id ? null : ticket.id))
                    }
                    onMenuClose={() => setOpenActionsId(null)}
                    onOpenStatusModal={openStatusModal}
                    onArchive={handleArchive}
                    editingMaterials={editingMaterials[ticket.id] || []}
                    onMaterialsChange={(drafts) =>
                      setEditingMaterials((prev) => ({ ...prev, [ticket.id]: drafts }))
                    }
                    onSaveMaterials={() => handleSaveMaterials(ticket.id)}
                    savingMaterials={savingMaterialsId === ticket.id}
                    onUploadPhoto={(file) => handleUploadPhoto(ticket, file)}
                    uploadingPhoto={uploadingPhotoId === ticket.id}
                    onDeletePhoto={(url) => handleDeletePhoto(ticket, url)}
                    onGeneratePDF={() => handleGeneratePDF(ticket)}
                    generatingPdf={generatingPdfId === ticket.id}
                  />
                ))}
                {tickets.length === 200 ? (
                  <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
                    Mostrando los 200 tickets más recientes
                  </p>
                ) : null}
              </div>
            )}

          </div>
        ) : null}

        {/* ══════════════════════════════ TAB: CALENDARIO ══════════════════════════════ */}
        {activeMainTab === "calendar" ? (
          <div style={{ display: "grid", gap: 18 }}>

            <AppGrid minWidth={220}>
              <MetricCard
                label="Vista activa"
                value={viewMode === "week" ? "Semana" : viewMode === "month" ? "Mes" : "Año"}
                helper={currentLabel}
                icon={<CalendarClock size={18} />}
              />
              <MetricCard
                label="Categorías"
                value={String(calendarTotals.categories)}
                helper="Tipos activos"
                icon={<ClipboardList size={18} />}
              />
              <MetricCard
                label="Programados"
                value={String(calendarTotals.upcoming)}
                helper={selectedCalendarBuildingLabel}
                icon={<ShieldCheck size={18} />}
              />
              <MetricCard
                label="Correctivos"
                value={String(calendarTotals.corrective)}
                helper="Seguimiento"
                icon={<CircleAlert size={18} />}
              />
            </AppGrid>

            <SectionCard
              title="Calendario de mantenimiento"
              subtitle="Vista operativa para revisar trabajos realizados y próximos trabajos."
              icon={<CalendarClock size={18} />}
            >
              <AppCard>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                  {/* Selector de vista + navegación */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {renderViewTab("Semana", viewMode === "week",  () => setViewMode("week"))}
                      {renderViewTab("Mes",    viewMode === "month", () => setViewMode("month"))}
                      {renderViewTab("Año",    viewMode === "year",  () => setViewMode("year"))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <UiButton onClick={goPrevious} icon={<ChevronLeft size={16} />}>
                        {viewMode === "week" ? "Semana anterior" : viewMode === "month" ? "Mes anterior" : "Año anterior"}
                      </UiButton>
                      <UiButton onClick={goCurrent}>
                        {viewMode === "week" ? "Semana actual" : viewMode === "month" ? "Mes actual" : "Año actual"}
                      </UiButton>
                      <UiButton onClick={goNext} icon={<ChevronRight size={16} />}>
                        {viewMode === "week" ? "Semana siguiente" : viewMode === "month" ? "Mes siguiente" : "Año siguiente"}
                      </UiButton>
                    </div>
                  </div>

                  {/* Filtro por edificio */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Filter size={14} /> Edificio
                    </div>
                    <select
                      value={selectedBuildingId}
                      onChange={(e) => setSelectedBuildingId(e.target.value)}
                      style={{ minWidth: 240, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
                    >
                      <option value="ALL">Todos los edificios</option>
                      {calendarBuildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code ? `${b.code} - ` : ""}{b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vista semana */}
                  {viewMode === "week" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16 }}>
                      {weekDays.map((day) => {
                        const dayEvents = weekEventsByDay.get(day.key) || [];
                        return (
                          <div key={day.key} style={{ border: "1px solid var(--border-default)", borderRadius: 16, padding: 14, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 14, minHeight: 280 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{day.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{day.shortDate}</div>
                            </div>
                            {dayEvents.length === 0 ? (
                              <div style={{ borderRadius: 12, padding: "10px", background: "var(--bg-page)", border: "1px dashed var(--border-strong)", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Sin eventos</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {dayEvents.map((event) => (
                                  <div key={event.id} style={{ borderRadius: 12, padding: "10px", background: event.colorBackground, border: `1px solid ${event.colorBorder}`, display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: event.colorText, lineHeight: 1.35 }}>{event.title}</span>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: event.colorText, opacity: 0.9, lineHeight: 1.35 }}>{event.subtitle}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Vista mes */}
                  {viewMode === "month" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16 }}>
                      {monthDays.map((day) => {
                        const dayEvents    = monthEventsByDate.get(day.isoDate) || [];
                        const visibleEvents = dayEvents.slice(0, 3);
                        return (
                          <div key={day.isoDate} style={{ border: "1px solid var(--border-default)", borderRadius: 16, padding: 12, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10, minHeight: 170 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{day.dayNumber} · {day.label}</div>
                            {dayEvents.length === 0 ? (
                              <div style={{ borderRadius: 10, padding: "8px", background: "var(--bg-page)", border: "1px dashed var(--border-strong)", fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Sin eventos</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {visibleEvents.map((event) => (
                                  <div key={event.id} style={{ borderRadius: 10, padding: "8px", background: event.colorBackground, border: `1px solid ${event.colorBorder}`, display: "flex", flexDirection: "column", gap: 3 }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 800, color: event.colorText, lineHeight: 1.3 }}>{event.title}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: event.colorText, opacity: 0.9, lineHeight: 1.3 }}>{event.subtitle}</span>
                                  </div>
                                ))}
                                {dayEvents.length > 3 ? (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)" }}>+ {dayEvents.length - 3} más</span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Vista año */}
                  {viewMode === "year" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
                      {yearSummary.map((month) => (
                        <div key={month.monthLabel} style={{ border: "1px solid var(--border-default)", borderRadius: 16, padding: 14, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10, minHeight: 150 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{month.monthLabel}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ borderRadius: 10, padding: "10px", background: "var(--metric-bg-amber)", border: "1px solid var(--metric-border-amber)", fontSize: 12, fontWeight: 700, color: "var(--metric-value-amber)" }}>Realizados: {month.done}</div>
                            <div style={{ borderRadius: 10, padding: "10px", background: "var(--badge-bg-amber)", border: "1px solid var(--metric-border-amber)", fontSize: 12, fontWeight: 700, color: "var(--badge-text-amber)" }}>Próximos: {month.upcoming}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Total: {month.total}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                </div>
              </AppCard>
            </SectionCard>

            {/* Leyenda */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <AppCard>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: "var(--icon-color-amber)", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Realizado</span>
                </div>
              </AppCard>
              <AppCard>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: "var(--badge-text-amber)", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Próximo / programado</span>
                </div>
              </AppCard>
            </div>

          </div>
        ) : null}

      </div>

      {/* ── Modal: crear ticket ──────────────────────────────────────── */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo ticket de mantenimiento"
        maxWidth="560px"
      >
        <form onSubmit={handleCreateTicket}>
          {createError ? (
            <div style={{ ...errorBannerStyle, marginBottom: 16 }}>{createError}</div>
          ) : null}

          <AppFormField label="Título del problema" required>
            <input
              style={INPUT_STYLE}
              value={createForm.title}
              onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Ej. Fuga de agua en cocina"
            />
          </AppFormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Edificio" required>
              <select
                style={INPUT_STYLE}
                value={createForm.building_id}
                onChange={(e) => handleCreateBuildingChange(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </AppFormField>

            <AppFormField label="Departamento">
              <select
                style={INPUT_STYLE}
                value={createForm.unit_id}
                onChange={(e) => setCreateForm((p) => ({ ...p, unit_id: e.target.value }))}
                disabled={!createForm.building_id}
              >
                <option value="">Sin departamento</option>
                {createUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_code || u.unit_number}</option>
                ))}
              </select>
            </AppFormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Categoría" required>
              <select
                style={INPUT_STYLE}
                value={createForm.category}
                onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
              >
                <option value="">Seleccionar...</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </AppFormField>

            <AppFormField label="Prioridad" required>
              <select
                style={INPUT_STYLE}
                value={createForm.priority}
                onChange={(e) => setCreateForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </AppFormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AppFormField label="Tipo" required>
              <select
                style={INPUT_STYLE}
                value={createForm.log_type}
                onChange={(e) => setCreateForm((p) => ({ ...p, log_type: e.target.value }))}
              >
                {LOG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </AppFormField>

          </div>

          <AppFormField label="Reportado por">
            <input
              style={INPUT_STYLE}
              value={createForm.reported_by}
              onChange={(e) => setCreateForm((p) => ({ ...p, reported_by: e.target.value }))}
              placeholder="Nombre de quien reporta"
            />
          </AppFormField>

          <AppFormField label="Descripción">
            <textarea
              style={TEXTAREA_STYLE}
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Descripción detallada del problema..."
            />
          </AppFormField>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <UiButton type="button" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </UiButton>
            <UiButton type="submit" disabled={creating}>
              {creating ? "Creando..." : "Crear ticket"}
            </UiButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal: cambiar estado ────────────────────────────────────── */}
      <Modal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Cambiar estado del ticket"
        maxWidth="400px"
      >
        {statusTarget ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Ticket:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {getTicketNumber(statusTarget)}
              </strong>
            </div>

            <AppFormField label="Nuevo estado">
              <select
                style={INPUT_STYLE}
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </AppFormField>

            {statusValue === "resolved" ? (
              <AppFormField label="Fecha de resolución">
                <input
                  type="date"
                  style={INPUT_STYLE}
                  value={resolvedAt}
                  onChange={(e) => setResolvedAt(e.target.value)}
                />
              </AppFormField>
            ) : null}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <UiButton type="button" onClick={() => setShowStatusModal(false)}>
                Cancelar
              </UiButton>
              <UiButton onClick={handleChangeStatus} disabled={changingStatus}>
                {changingStatus ? "Guardando..." : "Confirmar"}
              </UiButton>
            </div>
          </div>
        ) : null}
      </Modal>

    </PageContainer>
  );
}

// ─── TICKET CARD ─────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  isExpanded,
  isMenuOpen,
  onToggle,
  onMenuOpen,
  onMenuClose,
  onOpenStatusModal,
  onArchive,
  editingMaterials,
  onMaterialsChange,
  onSaveMaterials,
  savingMaterials,
  onUploadPhoto,
  uploadingPhoto,
  onDeletePhoto,
  onGeneratePDF,
  generatingPdf,
}: {
  ticket: Ticket;
  isExpanded: boolean;
  isMenuOpen: boolean;
  onToggle: () => void;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onOpenStatusModal: (t: Ticket) => void;
  onArchive: (id: string) => void;
  editingMaterials: MaterialDraft[];
  onMaterialsChange: (drafts: MaterialDraft[]) => void;
  onSaveMaterials: () => Promise<void>;
  savingMaterials: boolean;
  onUploadPhoto: (file: File) => Promise<void>;
  uploadingPhoto: boolean;
  onDeletePhoto: (url: string) => Promise<void>;
  onGeneratePDF: () => Promise<void>;
  generatingPdf: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ticketNum    = getTicketNumber(ticket);
  const priorityStyle = getPriorityStyle(ticket.priority);
  const statusStyle   = getStatusStyle(ticket.status);
  const photos        = ticket.photos || [];

  return (
    <AppCard style={{ padding: 0, overflow: "hidden", position: "relative", zIndex: isMenuOpen ? 10 : 1 }}>

      {/* ── Fila compacta (siempre visible) ─────────────────────── */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
          cursor: "pointer",
          background: isExpanded ? "var(--bg-page)" : "transparent",
          flexWrap: "wrap",
          transition: "background 0.15s",
        }}
      >
        {/* Izquierda: número + título + ubicación */}
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <Badge
              label={ticketNum}
              style={{
                background: "var(--icon-bg-neutral)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                fontFamily: "monospace",
                fontSize: 11,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              {ticket.title}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {ticket.buildings?.name || "Sin edificio"}
            {ticket.units
              ? ` · Depto. ${ticket.units.display_code || ticket.units.unit_number}`
              : ""}
          </div>
        </div>

        {/* Centro: categoría + prioridad */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {ticket.category_name_snapshot ? (
            <Badge
              label={ticket.category_name_snapshot}
              style={{ background: "var(--icon-bg-neutral)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
            />
          ) : null}
          <Badge label={getPriorityLabel(ticket.priority)} style={priorityStyle} />
        </div>

        {/* Derecha: estado + fotos + fecha + "..." */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Badge label={getStatusLabel(ticket.status)} style={statusStyle} />
          {photos.length > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              <Camera size={13} />
              {photos.length}
            </span>
          ) : null}
          <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {formatDate(ticket.created_at)}
          </span>

          {/* Dropdown "..." */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMenuOpen(); }}
              style={{
                padding: "6px 8px", borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--bg-card)", color: "var(--text-muted)",
                cursor: "pointer", display: "flex", alignItems: "center",
              }}
            >
              <MoreHorizontal size={16} />
            </button>

            {isMenuOpen ? (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={(e) => { e.stopPropagation(); onMenuClose(); }}
                />
                <div style={{ ...dropdownMenuStyle, zIndex: 200 }}>
                  <button
                    type="button"
                    style={dropdownActionButtonStyle}
                    onClick={(e) => { e.stopPropagation(); onOpenStatusModal(ticket); }}
                  >
                    <Pencil size={14} /> Cambiar estado
                  </button>
                  <button
                    type="button"
                    style={dropdownDeleteItemStyle}
                    onClick={(e) => { e.stopPropagation(); onArchive(ticket.id); }}
                  >
                    <Trash2 size={14} /> Archivar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Vista expandida ──────────────────────────────────────── */}
      {isExpanded ? (
        <div
          style={{
            borderTop: "1px solid var(--border-default)",
            padding: "18px 16px",
            display: "grid",
            gap: 20,
            background: "var(--bg-page)",
          }}
        >

          {/* Sección 1 — Detalles */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Detalles
            </div>

            {ticket.description ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                {ticket.description}
              </p>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {ticket.reported_by ? (
                <InfoTile label="Reportado por" value={ticket.reported_by} />
              ) : null}
              <InfoTile label="Fecha de creación" value={formatDate(ticket.created_at)} />
              {ticket.resolved_at ? (
                <InfoTile label="Fecha de resolución" value={formatDate(ticket.resolved_at)} />
              ) : null}
              <InfoTile
                label="Edificio"
                value={ticket.buildings?.name || "—"}
                sub={ticket.buildings?.address || undefined}
              />
              {ticket.units ? (
                <InfoTile
                  label="Departamento"
                  value={ticket.units.display_code || ticket.units.unit_number}
                />
              ) : null}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-default)" }} />

          {/* Sección 2 — Fotos */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Fotos ({photos.length})
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-card)", color: "var(--text-primary)",
                  fontSize: 12, fontWeight: 600,
                  cursor: uploadingPhoto ? "wait" : "pointer",
                  opacity: uploadingPhoto ? 0.7 : 1,
                }}
              >
                <ImagePlus size={14} />
                {uploadingPhoto ? "Subiendo..." : "Subir foto"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) { await onUploadPhoto(file); e.target.value = ""; }
                }}
              />
            </div>

            {photos.length === 0 ? (
              <div style={{ padding: 18, borderRadius: 12, border: "1px dashed var(--border-strong)", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                Sin fotos adjuntas
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                {photos.slice(0, 6).map((url, idx) => (
                  <div
                    key={url}
                    style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-default)", aspectRatio: "1" }}
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeletePhoto(url)}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        width: 22, height: 22, borderRadius: "50%",
                        border: "none", background: "rgba(0,0,0,0.65)", color: "#fff",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {photos.length > 6 ? (
                  <div style={{ borderRadius: 10, border: "1px dashed var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--text-muted)", fontWeight: 600, aspectRatio: "1" }}>
                    +{photos.length - 6} más
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-default)" }} />

          {/* Sección 3 — Materiales */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Materiales
            </div>

            {editingMaterials.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Sin materiales. Agrega renglones con el botón +.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {/* Encabezado */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 130px 32px", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", paddingLeft: 4 }}>Descripción</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>Cant.</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", paddingLeft: 4 }}>Unidad</span>
                  <span />
                </div>

                {editingMaterials.map((mat, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 130px 32px", gap: 8, alignItems: "center" }}>
                    <input
                      style={INPUT_STYLE}
                      placeholder="Descripción del material"
                      value={mat.description}
                      onChange={(e) => {
                        const updated = editingMaterials.map((m, i) =>
                          i === idx ? { ...m, description: e.target.value } : m
                        );
                        onMaterialsChange(updated);
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      style={{ ...INPUT_STYLE, textAlign: "center" }}
                      placeholder="1"
                      value={mat.quantity}
                      onChange={(e) => {
                        const updated = editingMaterials.map((m, i) =>
                          i === idx
                            ? { ...m, quantity: e.target.value === "" ? "" : Number(e.target.value) }
                            : m
                        );
                        onMaterialsChange(updated);
                      }}
                    />
                    <select
                      style={INPUT_STYLE}
                      value={mat.unit}
                      onChange={(e) => {
                        const updated = editingMaterials.map((m, i) =>
                          i === idx ? { ...m, unit: e.target.value } : m
                        );
                        onMaterialsChange(updated);
                      }}
                    >
                      {MATERIAL_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onMaterialsChange(editingMaterials.filter((_, i) => i !== idx))}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: "1px solid var(--border-default)",
                        background: "var(--badge-bg-red)", color: "var(--badge-text-red)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Acciones de materiales */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() =>
                  onMaterialsChange([...editingMaterials, { description: "", quantity: 1, unit: "Pieza" }])
                }
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px dashed var(--border-strong)",
                  background: "transparent", color: "var(--text-secondary)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Plus size={14} /> Agregar renglón
              </button>

              <button
                type="button"
                onClick={onSaveMaterials}
                disabled={savingMaterials}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-card)", color: "var(--text-primary)",
                  fontSize: 13, fontWeight: 600,
                  cursor: savingMaterials ? "wait" : "pointer",
                  opacity: savingMaterials ? 0.7 : 1,
                }}
              >
                {savingMaterials ? "Guardando..." : "Guardar materiales"}
              </button>

              <button
                type="button"
                onClick={onGeneratePDF}
                disabled={generatingPdf}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-card)", color: "var(--text-primary)",
                  fontSize: 13, fontWeight: 600,
                  cursor: generatingPdf ? "wait" : "pointer",
                  opacity: generatingPdf ? 0.7 : 1,
                }}
              >
                <FileText size={14} />
                {generatingPdf ? "Generando..." : "Generar PDF"}
              </button>
            </div>
          </div>

        </div>
      ) : null}
    </AppCard>
  );
}

// ─── INFO TILE (usado en el detalle expandido) ────────────────────────────────

function InfoTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
      ) : null}
    </div>
  );
}
