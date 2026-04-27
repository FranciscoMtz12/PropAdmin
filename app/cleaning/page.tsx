"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Plus,
  CheckCircle2,
  XCircle,
  Clock3,
  Building2,
  Home,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppCard from "@/components/AppCard";
import AppBadge from "@/components/AppBadge";
import Modal from "@/components/Modal";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import { motion, AnimatePresence } from "framer-motion";

/* ═══ Tipos ═══════════════════════════════════════════════════════ */

type CleaningType = "common_area" | "unit_exterior" | "unit_interior";
type CleaningStatus = "pending" | "in_progress" | "completed" | "skipped";
type TimeBlock = "morning" | "afternoon" | "evening";
type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
type TabKey = "week" | "by_building" | "history" | "config";

type Building = { id: string; name: string };
type Unit = { id: string; building_id: string; unit_number: string | null; display_code: string | null };

type BuildingSchedule = {
  id: string;
  building_id: string;
  cleaning_type: CleaningType;
  day_of_week: DayOfWeek;
  time_block: TimeBlock | null;
};

type UnitSchedule = {
  id: string;
  building_id: string;
  unit_id: string;
  day_of_week: DayOfWeek;
  start_time: string | null;
  duration_hours: number | null;
  active: boolean;
};

type CleaningLog = {
  id: string;
  building_id: string;
  unit_id: string | null;
  cleaning_type: CleaningType;
  scheduled_date: string;
  status: CleaningStatus;
  completed_at: string | null;
  completed_by: string | null;
  photo_url: string | null;
  notes: string | null;
};

type ChecklistItem = {
  id: string;
  cleaning_type: CleaningType;
  label: string;
  sort_order: number;
};

type ChecklistResponse = {
  cleaning_log_id: string;
  checklist_item_id: string;
  checked: boolean;
};

type WeekTask = {
  key: string;
  scheduleId: string;
  source: "building" | "unit";
  buildingId: string;
  unitId: string | null;
  cleaningType: CleaningType;
  dayOfWeek: DayOfWeek;
  dateISO: string;
  timeBlock: TimeBlock | null;
  startTime: string | null;
};

/* ═══ Constantes ══════════════════════════════════════════════════ */

const CLEANING_TYPE_COLORS: Partial<Record<CleaningType, { bg: string; text: string; border: string; label: string; icon: string }>> = {
  common_area:   { bg: "#fff7ed", text: "#9a3412", border: "#f97316", label: "Áreas comunes",     icon: "🏢" },
  unit_interior: { bg: "#fdf4ff", text: "#6b21a8", border: "#a855f7", label: "Interior premium", icon: "✨" },
};

const DEFAULT_CLEANING_VISUALS = { bg: "#f3f4f6", text: "#374151", border: "#d1d5db", label: "Limpieza", icon: "🧹" };

const CLEANING_TYPE_ICONS: Record<string, React.ReactNode> = {
  common_area:   <Building2 size={10} />,
  unit_interior: <Sparkles size={10} />,
};

const normalizeCleaningType = (raw: string): CleaningType => {
  if (raw === "common") return "common_area";
  if (raw === "exterior") return "unit_exterior";
  if (raw === "interior") return "unit_interior";
  return raw as CleaningType;
};

const denormalizeCleaningType = (c: CleaningType): string => {
  if (c === "common_area") return "common";
  if (c === "unit_exterior") return "exterior";
  if (c === "unit_interior") return "interior";
  return c;
};

function formatTimeAmPm(t: string | null | undefined): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? "0");
  if (isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const DAY_ORDER: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Lun", tuesday: "Mar", wednesday: "Mié", thursday: "Jue", friday: "Vie", saturday: "Sáb", sunday: "Dom",
};
const DAY_LONG: Record<DayOfWeek, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
  friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

const TIME_BLOCK_LABEL: Record<TimeBlock, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  evening: "Noche",
};

const TIME_BLOCK_TO_START: Record<TimeBlock, string> = {
  morning: "08:00",
  afternoon: "14:00",
  evening: "19:00",
};

const STATUS_LABEL: Record<CleaningStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  skipped: "Omitida",
};

const STATUS_VARIANT: Record<CleaningStatus, "gray" | "amber" | "blue" | "green"> = {
  pending: "amber",
  in_progress: "blue",
  completed: "green",
  skipped: "gray",
};

/* ═══ Helpers de fecha ════════════════════════════════════════════ */

function getMondayOfWeek(ref: Date): Date {
  const d = new Date(ref);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayOfWeekFromDate(d: Date): DayOfWeek {
  return DAY_ORDER[(d.getDay() + 6) % 7];
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmt = (dd: Date) =>
    `${dd.getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][dd.getMonth()]}`;
  return `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
}

/* ═══ Form schema ═════════════════════════════════════════════════ */

const scheduleSchema = z
  .object({
    building_id: z.string().min(1, "Selecciona un edificio"),
    cleaning_type: z.enum(["common_area", "unit_interior"]),
    unit_id: z.string().optional(),
    day_of_week: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
    time_block: z.enum(["morning", "afternoon"]).optional(),
    start_time: z.string().optional(),
    duration_hours: z.number().optional(),
    frequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cleaning_type === "common_area") {
      if (!data.time_block) {
        ctx.addIssue({ code: "custom", path: ["time_block"], message: "Selecciona un horario" });
      }
    } else if (data.cleaning_type === "unit_interior") {
      if (!data.unit_id) {
        ctx.addIssue({ code: "custom", path: ["unit_id"], message: "Selecciona una unidad" });
      }
      if (!data.start_time) {
        ctx.addIssue({ code: "custom", path: ["start_time"], message: "Ingresa hora de inicio" });
      }
      if (!data.duration_hours || data.duration_hours <= 0) {
        ctx.addIssue({ code: "custom", path: ["duration_hours"], message: "Duración inválida" });
      }
      if (!data.frequency) {
        ctx.addIssue({ code: "custom", path: ["frequency"], message: "Selecciona frecuencia" });
      }
    }
  });
type ScheduleValues = z.infer<typeof scheduleSchema>;

/* ═══ Página ══════════════════════════════════════════════════════ */

export default function CleaningPage() {
  const { user, loading } = useCurrentUser();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildingSchedules, setBuildingSchedules] = useState<BuildingSchedule[]>([]);
  const [unitSchedules, setUnitSchedules] = useState<UnitSchedule[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistResponses, setChecklistResponses] = useState<ChecklistResponse[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [tab, setTab] = useState<TabKey>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(["common_area", "unit_interior", "completed"])
  );

  // Completion modal
  const [selectedTask, setSelectedTask] = useState<WeekTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // History filters
  const [historyBuildingId, setHistoryBuildingId] = useState("all");
  const [historyType, setHistoryType] = useState<"all" | CleaningType>("all");

  // Config: new schedule modal
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const scheduleForm = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      building_id: "",
      cleaning_type: "common_area",
      unit_id: "",
      day_of_week: "monday",
      time_block: "morning",
      start_time: "10:00",
      duration_hours: 2,
      frequency: "weekly",
    },
  });
  const watchedType = scheduleForm.watch("cleaning_type");
  const watchedBuilding = scheduleForm.watch("building_id");

  useEffect(() => {
    if (loading) return;
    if (!user?.company_id) return;
    void loadData();
  }, [loading, user?.company_id]);

  async function loadData() {
    if (!user?.company_id) return;
    setLoadingData(true);

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

    const [bRes, uRes, bsRes, usRes, logsRes, chkRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", user.company_id)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("units")
        .select("id, building_id, unit_number, display_code")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),
      supabase
        .from("cleaning_building_schedules")
        .select("id, building_id, cleaning_type, day_of_week, time_block")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),
      supabase
        .from("cleaning_unit_schedules")
        .select("id, building_id, unit_id, day_of_week, start_time, duration_hours, active")
        .eq("company_id", user.company_id)
        .is("deleted_at", null),
      supabase
        .from("cleaning_logs")
        .select("id, building_id, unit_id, cleaning_type, scheduled_date, status, completed_at, completed_by, photo_url, notes")
        .eq("company_id", user.company_id)
        .gte("scheduled_date", monthStart),
      supabase
        .from("cleaning_checklist_items")
        .select("id, cleaning_type, label, sort_order")
        .eq("active", true),
    ]);

    [bRes, uRes, bsRes, usRes, logsRes, chkRes].forEach((r) => {
      if (r.error) console.error("cleaning fetch failed", r.error);
    });

    setBuildings((bRes.data as Building[]) || []);
    setUnits((uRes.data as Unit[]) || []);
    setBuildingSchedules(((bsRes.data as BuildingSchedule[]) || []).map((s) => ({
      ...s,
      cleaning_type: normalizeCleaningType(s.cleaning_type as string),
    })));
    setUnitSchedules((usRes.data as UnitSchedule[]) || []);
    setLogs(((logsRes.data as CleaningLog[]) || []).map((l) => ({
      ...l,
      cleaning_type: normalizeCleaningType(l.cleaning_type as string),
    })));
    setChecklist(((chkRes.data as ChecklistItem[]) || []).map((c) => ({
      ...c,
      cleaning_type: normalizeCleaningType(c.cleaning_type as string),
    })).sort((a, b) => a.sort_order - b.sort_order));

    // Segunda pasada: responses de todos los logs visibles para la dona de progreso
    const loadedLogs = (logsRes.data as CleaningLog[]) || [];
    const logIds = loadedLogs.map((l) => l.id);
    if (logIds.length > 0) {
      const { data: respData, error: respError } = await supabase
        .from("cleaning_checklist_responses")
        .select("cleaning_log_id, checklist_item_id, checked")
        .in("cleaning_log_id", logIds);
      if (respError) console.error("checklist_responses batch fetch failed", respError);
      setChecklistResponses((respData as ChecklistResponse[]) || []);
    } else {
      setChecklistResponses([]);
    }

    setLoadingData(false);
  }

  /* ── Derivados ────────────────────────────────────────────────── */

  const buildingById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const unitsByBuilding = useMemo(() => {
    const m = new Map<string, Unit[]>();
    units.forEach((u) => {
      const list = m.get(u.building_id) || [];
      list.push(u);
      m.set(u.building_id, list);
    });
    return m;
  }, [units]);

  const weekMonday = useMemo(() => {
    const today = new Date();
    return addDays(getMondayOfWeek(today), weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return DAY_ORDER.map((_, i) => {
      const d = addDays(weekMonday, i);
      return { dayOfWeek: DAY_ORDER[i], date: d, iso: isoDate(d) };
    });
  }, [weekMonday]);

  const todayISO = isoDate(new Date());
  const todayDow = dayOfWeekFromDate(new Date());

  /* Tareas generadas desde schedules, expandidas a cada día de la semana visible */
  const weekTasks = useMemo<WeekTask[]>(() => {
    const tasks: WeekTask[] = [];
    weekDays.forEach(({ dayOfWeek, iso }) => {
      buildingSchedules
        .filter((s) => s.day_of_week === dayOfWeek)
        .forEach((s) => {
          tasks.push({
            key: `b-${s.id}-${iso}`,
            scheduleId: s.id,
            source: "building",
            buildingId: s.building_id,
            unitId: null,
            cleaningType: s.cleaning_type,
            dayOfWeek,
            dateISO: iso,
            timeBlock: s.time_block ?? null,
            startTime: null,
          });
        });
      unitSchedules
        .filter((s) => s.active && s.day_of_week === dayOfWeek)
        .forEach((s) => {
          // Derivar time_block desde start_time si existe
          let tb: TimeBlock | null = null;
          if (s.start_time) {
            const hour = parseInt(s.start_time.slice(0, 2), 10);
            if (!isNaN(hour)) tb = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
          }
          tasks.push({
            key: `u-${s.id}-${iso}`,
            scheduleId: s.id,
            source: "unit",
            buildingId: s.building_id,
            unitId: s.unit_id,
            cleaningType: "unit_interior",
            dayOfWeek,
            dateISO: iso,
            timeBlock: tb,
            startTime: s.start_time ?? null,
          });
        });
    });
    return tasks;
  }, [weekDays, buildingSchedules, unitSchedules]);

  /* Matchear logs contra tasks — una task se considera completada si existe un log con
     mismo building + unit + cleaning_type + scheduled_date + status 'completed'. */
  const logIndex = useMemo(() => {
    const m = new Map<string, CleaningLog>();
    logs.forEach((l) => {
      const k = `${l.building_id}|${l.unit_id ?? ""}|${l.cleaning_type}|${l.scheduled_date}`;
      m.set(k, l);
    });
    return m;
  }, [logs]);

  function getLogForTask(task: WeekTask): CleaningLog | undefined {
    return logIndex.get(`${task.buildingId}|${task.unitId ?? ""}|${task.cleaningType}|${task.dateISO}`);
  }

  // Progreso de checklist por tarea (para donuts del grid semanal)
  const taskProgress = useMemo(() => {
    const itemsByType = new Map<CleaningType, number>();
    checklist.forEach((c) => {
      itemsByType.set(c.cleaning_type, (itemsByType.get(c.cleaning_type) ?? 0) + 1);
    });
    const checkedByLog = new Map<string, number>();
    checklistResponses.forEach((r) => {
      if (!r.checked) return;
      checkedByLog.set(r.cleaning_log_id, (checkedByLog.get(r.cleaning_log_id) ?? 0) + 1);
    });

    const m = new Map<string, { checked: number; total: number }>();
    weekTasks.forEach((task) => {
      const total = itemsByType.get(task.cleaningType) ?? 0;
      const log = getLogForTask(task);
      const checked = log ? (checkedByLog.get(log.id) ?? 0) : 0;
      m.set(task.key, { checked, total });
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekTasks, logIndex, checklist, checklistResponses]);

  // Cargar responses al abrir tarea
  useEffect(() => {
    if (!selectedTask) {
      setCheckedItems(new Set());
      setCurrentLogId(null);
      return;
    }
    const existingLog = getLogForTask(selectedTask);
    if (!existingLog) {
      setCheckedItems(new Set());
      setCurrentLogId(null);
      return;
    }
    setCurrentLogId(existingLog.id);
    void supabase
      .from("cleaning_checklist_responses")
      .select("checklist_item_id, checked")
      .eq("cleaning_log_id", existingLog.id)
      .then(({ data, error }) => {
        if (error) {
          console.error("checklist_responses fetch failed", error);
          setCheckedItems(new Set());
          return;
        }
        const rows = (data || []) as { checklist_item_id: string; checked: boolean }[];
        setCheckedItems(new Set(rows.filter((r) => r.checked).map((r) => r.checklist_item_id)));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.key]);

  /* Stat bar semana */
  const weekStats = useMemo(() => {
    const total = weekTasks.length;
    const completed = weekTasks.filter((t) => getLogForTask(t)?.status === "completed").length;
    const compliance = total > 0 ? (completed / total) * 100 : 0;

    const todayTasks = weekTasks.filter((t) => t.dateISO === todayISO);
    const todayCompleted = todayTasks.filter((t) => getLogForTask(t)?.status === "completed").length;
    const todayPending = todayTasks.length - todayCompleted;

    const activeBuildings = new Set(buildingSchedules.map((s) => s.building_id));
    unitSchedules.filter((s) => s.active).forEach((s) => activeBuildings.add(s.building_id));

    const premiumUnits = new Set(unitSchedules.filter((s) => s.active).map((s) => s.unit_id)).size;

    return {
      compliance,
      todayTotal: todayTasks.length,
      todayCompleted,
      todayPending,
      activeBuildings: activeBuildings.size,
      premiumUnits,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekTasks, logIndex, buildingSchedules, unitSchedules, todayISO]);

  /* Por edificio (semana visible) */
  const byBuildingStats = useMemo(() => {
    return buildings
      .map((b) => {
        const bTasks = weekTasks.filter((t) => t.buildingId === b.id);
        const completed = bTasks.filter((t) => getLogForTask(t)?.status === "completed").length;
        const total = bTasks.length;
        const rate = total > 0 ? (completed / total) * 100 : 0;
        return { id: b.id, name: b.name, completed, pending: total - completed, total, rate };
      })
      .filter((b) => b.total > 0)
      .sort((a, b) => b.rate - a.rate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, weekTasks, logIndex]);

  /* Historial últimos 30 días */
  const historyRows = useMemo(() => {
    const thirtyAgoIso = isoDate(addDays(new Date(), -30));
    return logs
      .filter((l) => l.scheduled_date >= thirtyAgoIso)
      .filter((l) => historyBuildingId === "all" || l.building_id === historyBuildingId)
      .filter((l) => historyType === "all" || l.cleaning_type === historyType)
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  }, [logs, historyBuildingId, historyType]);

  /* ── Acciones ─────────────────────────────────────────────────── */

  // Asegurar que exista un cleaning_log para la tarea seleccionada — devuelve el id.
  async function ensureLog(status: CleaningStatus = "in_progress"): Promise<string | null> {
    if (!selectedTask || !user?.company_id) return null;
    if (currentLogId) return currentLogId;

    const existingLog = getLogForTask(selectedTask);
    if (existingLog) {
      setCurrentLogId(existingLog.id);
      return existingLog.id;
    }

    const { data, error } = await supabase
      .from("cleaning_logs")
      .insert({
        company_id: user.company_id,
        building_id: selectedTask.buildingId,
        unit_id: selectedTask.unitId,
        cleaning_type: selectedTask.cleaningType,
        scheduled_date: selectedTask.dateISO,
        status,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("cleaning_logs create failed", error);
      return null;
    }
    setCurrentLogId(data.id as string);
    return data.id as string;
  }

  async function toggleChecklistItem(itemId: string) {
    const wasChecked = checkedItems.has(itemId);
    const nextChecked = !wasChecked;

    // Optimistic UI
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });

    if (!selectedTask || !user?.company_id) return;

    setIsSaving(true);
    const logId = await ensureLog("in_progress");
    if (!logId) {
      toast.error("No se pudo guardar el progreso.");
      // Revert
      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (wasChecked) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("cleaning_checklist_responses")
      .upsert(
        { cleaning_log_id: logId, checklist_item_id: itemId, checked: nextChecked },
        { onConflict: "cleaning_log_id,checklist_item_id" }
      );

    if (error) {
      console.error("checklist_responses upsert failed", error);
      toast.error("No se pudo guardar el ítem.");
      setIsSaving(false);
      return;
    }

    // Actualizar estado local para que taskProgress (y la dona) refleje el cambio
    setChecklistResponses((prev) => {
      const idx = prev.findIndex(
        (r) => r.cleaning_log_id === logId && r.checklist_item_id === itemId
      );
      if (idx !== -1) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], checked: nextChecked };
        return copy;
      }
      return [...prev, { cleaning_log_id: logId, checklist_item_id: itemId, checked: nextChecked }];
    });

    setIsSaving(false);

    // Auto-completar si todos los items están chequeados
    const taskChecklist = checklist.filter((c) => c.cleaning_type === selectedTask.cleaningType);
    if (taskChecklist.length === 0) return;
    const nextSet = new Set(checkedItems);
    if (nextChecked) nextSet.add(itemId);
    else nextSet.delete(itemId);
    const allChecked = taskChecklist.every((c) => nextSet.has(c.id));
    if (allChecked) {
      await completeTask();
    }
  }

  async function completeTask() {
    if (!selectedTask || !user?.company_id) return;
    setSubmittingCompletion(true);

    const logId = await ensureLog("completed");
    if (!logId) {
      toast.error("No se pudo registrar la limpieza.");
      setSubmittingCompletion(false);
      return;
    }

    const { error } = await supabase
      .from("cleaning_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        notes: completionNotes.trim() || null,
      })
      .eq("id", logId);

    if (error) {
      console.error("cleaning_logs complete failed", error);
      toast.error("No se pudo marcar completada.");
      setSubmittingCompletion(false);
      return;
    }

    toast.success("Tarea registrada como completada.");
    setSelectedTask(null);
    setCompletionNotes("");
    setCurrentLogId(null);
    setSubmittingCompletion(false);
    await loadData();
  }

  async function reopenTask() {
    if (!selectedTask || !currentLogId) return;
    setSubmittingCompletion(true);
    const { error } = await supabase
      .from("cleaning_logs")
      .update({ status: "pending", completed_at: null, completed_by: null })
      .eq("id", currentLogId);
    if (error) {
      console.error("cleaning_logs reopen failed", error);
      toast.error("No se pudo reabrir la tarea.");
      setSubmittingCompletion(false);
      return;
    }
    toast.success("Tarea reabierta.");
    setSelectedTask(null);
    setCompletionNotes("");
    setCurrentLogId(null);
    setSubmittingCompletion(false);
    await loadData();
  }

  const onCreateSchedule = scheduleForm.handleSubmit(async (data) => {
    if (!user?.company_id) return;

    if (data.cleaning_type === "common_area") {
      const { error } = await supabase.from("cleaning_building_schedules").insert({
        company_id: user.company_id,
        building_id: data.building_id,
        cleaning_type: denormalizeCleaningType(data.cleaning_type),
        day_of_week: data.day_of_week,
        time_block: data.time_block,
      });
      if (error) {
        console.error("schedule insert failed", error);
        toast.error("No se pudo crear el horario.");
        return;
      }
    } else {
      const { error } = await supabase.from("cleaning_unit_schedules").insert({
        company_id: user.company_id,
        building_id: data.building_id,
        unit_id: data.unit_id,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        duration_hours: data.duration_hours,
        frequency: data.frequency,
        active: true,
      });
      if (error) {
        console.error("schedule insert failed", error);
        toast.error("No se pudo crear el horario.");
        return;
      }
    }

    toast.success("Horario creado.");
    scheduleForm.reset();
    setShowCreateSchedule(false);
    await loadData();
  });

  /* ── Render ───────────────────────────────────────────────────── */

  if (loading || loadingData) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>Cargando limpieza...</div>
      </PageContainer>
    );
  }

  const selectedTaskLog = selectedTask ? getLogForTask(selectedTask) : undefined;
  const selectedTaskChecklist = selectedTask
    ? checklist.filter((c) => c.cleaning_type === selectedTask.cleaningType)
    : [];

  const canEdit =
    user?.role === "superadmin" ||
    user?.role === "mantenimiento" ||
    Boolean(user?.is_superadmin);

  return (
    <PageContainer>
      <PageHeader
        title="Limpieza"
        titleIcon={<Sparkles size={18} />}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <UiButton variant="secondary" icon={<Settings size={14} />} onClick={() => setTab("config")}>
              Configurar horario
            </UiButton>
            <UiButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreateSchedule(true)}>
              Nueva tarea
            </UiButton>
          </div>
        }
      />

      {/* Tabs pills + navegador de semana */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
        {([
          { k: "week", label: "Semana" },
          { k: "by_building", label: "Por edificio" },
          { k: "history", label: "Historial" },
          { k: "config", label: "Configuración" },
        ] as { k: TabKey; label: string }[]).map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              style={{
                padding: "8px 18px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                background: active ? "#6b21a8" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
        {tab === "week" && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setWeekOffset((o) => o - 1)} style={navBtnStyle}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", minWidth: 200, textAlign: "center" }}>
              {formatWeekRange(weekMonday)}
            </span>
            <button onClick={() => setWeekOffset((o) => o + 1)} style={navBtnStyle}><ChevronRight size={16} /></button>
            <button onClick={() => setWeekOffset(0)} style={{ padding: ".4rem .9rem", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Hoy
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "week" && renderWeekTab()}
          {tab === "by_building" && renderByBuildingTab()}
          {tab === "history" && renderHistoryTab()}
          {tab === "config" && renderConfigTab()}
        </motion.div>
      </AnimatePresence>

      {/* ── Modal de completar tarea ── */}
      <Modal
        open={!!selectedTask}
        title={selectedTask ? (CLEANING_TYPE_COLORS[selectedTask.cleaningType]?.label ?? "Limpieza") : ""}
        subtitle={
          selectedTask
            ? `${buildingById.get(selectedTask.buildingId)?.name ?? ""}${
                selectedTask.unitId ? ` · ${unitById.get(selectedTask.unitId)?.display_code ?? unitById.get(selectedTask.unitId)?.unit_number ?? ""}` : ""
              } · ${DAY_LONG[selectedTask.dayOfWeek]} ${selectedTask.dateISO}`
            : ""
        }
        onClose={() => {
          if (!submittingCompletion) { setSelectedTask(null); setCompletionNotes(""); }
        }}
        maxWidth="540px"
      >
        {selectedTask && selectedTaskLog?.status === "completed" ? (
          <>
            <div style={{ padding: 16, background: "var(--metric-bg-green)", border: "1px solid var(--metric-border-green)", borderRadius: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <CheckCircle2 size={24} color="#16A34A" />
              <div>
                <div style={{ fontWeight: 700, color: "var(--metric-value-green)" }}>Completada</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {selectedTaskLog.completed_at ? new Date(selectedTaskLog.completed_at).toLocaleString("es-MX") : "Sin fecha"}
                </div>
                {selectedTaskLog.notes && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{selectedTaskLog.notes}</div>
                )}
              </div>
            </div>
            {canEdit && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <UiButton
                  variant="secondary"
                  onClick={() => void reopenTask()}
                  disabled={submittingCompletion}
                >
                  {submittingCompletion ? "Reabriendo..." : "Reabrir tarea"}
                </UiButton>
              </div>
            )}
          </>
        ) : (
          <>
            {selectedTaskChecklist.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.5px" }}>
                    CHECKLIST
                  </div>
                  {isSaving && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                      Guardando...
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedTaskChecklist.map((item) => {
                    const isChecked = checkedItems.has(item.id);
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          border: "1px solid var(--border-default)",
                          borderRadius: 8,
                          fontSize: 13,
                          cursor: canEdit ? "pointer" : "default",
                          background: isChecked ? "var(--metric-bg-green)" : "transparent",
                          color: isChecked ? "var(--metric-value-green)" : "var(--text-primary)",
                          textDecoration: isChecked ? "line-through" : "none",
                          opacity: canEdit ? 1 : 0.85,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!canEdit}
                          onChange={() => { if (canEdit) void toggleChecklistItem(item.id); }}
                          style={{ width: 14, height: 14, cursor: canEdit ? "pointer" : "not-allowed", accentColor: "#16A34A" }}
                        />
                        {item.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, padding: 12, border: "1px dashed var(--border-default)", borderRadius: 8 }}>
                Sin checklist configurado para este tipo.
              </div>
            )}

            {canEdit && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Notas (opcional)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={3}
                  placeholder="Observaciones, materiales usados, etc."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 13,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            )}

            {!canEdit && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 14, padding: "10px 12px", background: "var(--bg-page)", borderRadius: 8 }}>
                Solo lectura — contacta al equipo de mantenimiento.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <UiButton variant="secondary" onClick={() => { if (!submittingCompletion) { setSelectedTask(null); setCompletionNotes(""); } }}>
                Cerrar
              </UiButton>
              {canEdit && (
                <UiButton onClick={() => void completeTask()} disabled={submittingCompletion} variant="primary" icon={<CheckCircle2 size={14} />}>
                  {submittingCompletion ? "Guardando..." : "Marcar completada"}
                </UiButton>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ── Modal de nuevo horario ── */}
      <Modal
        open={showCreateSchedule}
        title="Nuevo horario de limpieza"
        onClose={() => { if (!scheduleForm.formState.isSubmitting) { scheduleForm.reset(); setShowCreateSchedule(false); } }}
        maxWidth="480px"
      >
        <form onSubmit={onCreateSchedule} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Edificio" error={scheduleForm.formState.errors.building_id?.message}>
            <AppSelect {...scheduleForm.register("building_id")}>
              <option value="">Selecciona un edificio</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </AppSelect>
          </Field>

          <Field label="Tipo de limpieza" error={scheduleForm.formState.errors.cleaning_type?.message}>
            <AppSelect {...scheduleForm.register("cleaning_type")}>
              <option value="common_area">Área común</option>
              <option value="unit_interior">Interior de unidad</option>
            </AppSelect>
          </Field>

          {watchedType === "unit_interior" && (
            <Field label="Unidad" error={scheduleForm.formState.errors.unit_id?.message}>
              <AppSelect {...scheduleForm.register("unit_id")}>
                <option value="">Selecciona una unidad</option>
                {(unitsByBuilding.get(watchedBuilding) || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_code || u.unit_number || u.id.slice(0, 6)}
                  </option>
                ))}
              </AppSelect>
            </Field>
          )}

          <Field label="Día de la semana">
            <AppSelect {...scheduleForm.register("day_of_week")}>
              {DAY_ORDER.map((d) => <option key={d} value={d}>{DAY_LONG[d]}</option>)}
            </AppSelect>
          </Field>

          {watchedType === "common_area" && (
            <Field label="Horario" error={scheduleForm.formState.errors.time_block?.message}>
              <AppSelect {...scheduleForm.register("time_block")}>
                <option value="morning">Mañana</option>
                <option value="afternoon">Tarde</option>
              </AppSelect>
            </Field>
          )}

          {watchedType === "unit_interior" && (
            <>
              <Field label="Hora de inicio" error={scheduleForm.formState.errors.start_time?.message}>
                <input
                  type="time"
                  {...scheduleForm.register("start_time")}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 13,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </Field>

              <Field label="Duración (horas)" error={scheduleForm.formState.errors.duration_hours?.message}>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  {...scheduleForm.register("duration_hours", { valueAsNumber: true })}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 13,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </Field>

              <Field label="Frecuencia" error={scheduleForm.formState.errors.frequency?.message}>
                <AppSelect {...scheduleForm.register("frequency")}>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </AppSelect>
              </Field>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <UiButton variant="secondary" onClick={() => { if (!scheduleForm.formState.isSubmitting) { scheduleForm.reset(); setShowCreateSchedule(false); } }}>
              Cancelar
            </UiButton>
            <UiButton type="submit" variant="primary" disabled={scheduleForm.formState.isSubmitting}>
              {scheduleForm.formState.isSubmitting ? "Creando..." : "Crear horario"}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );

  /* ═══ Tabs ═══════════════════════════════════════════════════════ */

  function renderWeekTab() {
    return (
      <>
        {/* Stat bar */}
        <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
          {[
            {
              label: "Cumplimiento semanal",
              value: `${weekStats.compliance.toFixed(0)}%`,
              sub: "esta semana",
              color: weekStats.compliance >= 80 ? "#10B981" : weekStats.compliance >= 60 ? "#F59E0B" : "#EF4444",
            },
            { label: "Tareas hoy", value: weekStats.todayTotal, sub: "programadas" },
            { label: "Completadas hoy", value: weekStats.todayCompleted, sub: "terminadas", color: "#10B981" },
            { label: "Pendientes hoy", value: weekStats.todayPending, sub: "por hacer", color: weekStats.todayPending > 0 ? "#F59E0B" : undefined },
            { label: "Edificios activos", value: weekStats.activeBuildings, sub: "con horario" },
            { label: "Servicio premium", value: weekStats.premiumUnits, sub: "unidades", color: "#A855F7" },
          ].map((s, i, arr) => (
            <div key={i} style={{ flex: 1, padding: "14px 20px", borderRight: i < arr.length - 1 ? "1px solid var(--border-default)" : "none", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color ?? "var(--text-primary)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Leyenda / Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { label: "Áreas comunes",    type: "common_area",   color: "#f97316", bg: "#fff7ed" },
            { label: "Interior premium", type: "unit_interior", color: "#a855f7", bg: "#fdf4ff" },
            { label: "Completada",       type: "completed",     color: "#22c55e", bg: "#f0fdf4" },
          ].map((l) => {
            const active = activeFilters.has(l.type);
            return (
              <button
                key={l.type}
                type="button"
                onClick={() =>
                  setActiveFilters((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.type)) next.delete(l.type);
                    else next.add(l.type);
                    return next;
                  })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: active ? l.bg : "#f3f4f6",
                  border: `1.5px solid ${active ? l.color : "#d1d5db"}`,
                  color: active ? "var(--text-primary)" : "#9ca3af",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, background: active ? l.color : "#d1d5db", flexShrink: 0 }} />
                {l.label}
              </button>
            );
          })}
        </div>

        {/* Grid 7 días */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
          {weekDays.map(({ dayOfWeek, iso, date }, index) => {
            const dayTasks = weekTasks.filter((t) => t.dateISO === iso);
            const visibleTasks = dayTasks.filter((task) => {
              const isCompleted = getLogForTask(task)?.status === "completed";
              if (isCompleted && !activeFilters.has("completed")) return false;
              if (!isCompleted && !activeFilters.has(task.cleaningType)) return false;
              return true;
            });
            const isCurrentDay = iso === todayISO;
            return (
              <motion.div
                key={iso}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                style={{
                  border: isCurrentDay ? "2px solid var(--accent)" : "1px solid var(--border-default)",
                  borderRadius: 10,
                  background: "var(--bg-card)",
                  padding: 8,
                  minHeight: 180,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: isCurrentDay ? "var(--accent)" : "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {DAY_SHORT[dayOfWeek]} {date.getDate()}
                </div>
                {visibleTasks.length === 0 ? null : visibleTasks.map((task) => {
                  const visuals = CLEANING_TYPE_COLORS[task.cleaningType] ?? DEFAULT_CLEANING_VISUALS;
                  const log = getLogForTask(task);
                  const done = log?.status === "completed";
                  const building = buildingById.get(task.buildingId);
                  const unit = task.unitId ? unitById.get(task.unitId) : null;
                  return (
                    <button
                      key={task.key}
                      type="button"
                      onClick={() => setSelectedTask(task)}
                      style={{
                        background: done ? "#f3f4f6" : visuals.bg,
                        color: done ? "#6b7280" : visuals.text,
                        border: "none",
                        borderLeft: `3px solid ${done ? "#6b7280" : visuals.border}`,
                        borderRadius: 6,
                        padding: "6px 8px",
                        textAlign: "left",
                        cursor: "pointer",
                        opacity: done ? 0.85 : 1,
                        marginBottom: 4,
                        width: "100%",
                      }}
                      title={`${visuals.label} · ${building?.name ?? ""}`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {building?.name ?? (unit ? (unit.display_code || unit.unit_number) : visuals.label)}
                          </div>
                          <div style={{ fontSize: 11, color: done ? "#9ca3af" : "var(--text-secondary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {task.source === "unit" && task.startTime
                              ? `${unit ? (unit.display_code || unit.unit_number) : ""} · ${formatTimeAmPm(task.startTime)}`
                              : task.timeBlock
                                ? TIME_BLOCK_LABEL[task.timeBlock]
                                : (unit ? (unit.display_code || unit.unit_number) : visuals.label)}
                          </div>
                        </div>
                        {(() => {
                          const todayDate = new Date();
                          todayDate.setHours(0, 0, 0, 0);
                          const taskDate = new Date(task.dateISO + "T00:00:00");
                          const isPast = taskDate < todayDate;
                          const isCompleted = done;
                          const isOverdue = isPast && !isCompleted;
                          const prog = taskProgress.get(task.key);
                          const total = prog?.total ?? 0;
                          const checked = prog?.checked ?? 0;
                          const progress = total > 0 ? checked / total : 0;

                          if (isCompleted) {
                            return <CheckCircle2 size={20} style={{ color: "#22c55e", flexShrink: 0 }} />;
                          }
                          if (isOverdue) {
                            return <XCircle size={20} style={{ color: "#ef4444", flexShrink: 0 }} />;
                          }
                          if (progress > 0 && total > 0) {
                            const radius = 9;
                            const circumference = 2 * Math.PI * radius;
                            const strokeDashoffset = circumference * (1 - progress);
                            return (
                              <svg width={24} height={24} style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
                                <circle cx={12} cy={12} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={3} />
                                <circle
                                  cx={12}
                                  cy={12}
                                  r={radius}
                                  fill="none"
                                  stroke="#6b21a8"
                                  strokeWidth={3}
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                />
                              </svg>
                            );
                          }
                          return (
                            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #d1d5db", flexShrink: 0 }} />
                          );
                        })()}
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            );
          })}
        </div>

        {/* Cumplimiento por edificio — esta semana */}
        <div style={{ marginTop: 20 }}>
          <SectionCard title="Cumplimiento por edificio — esta semana" icon={<Building2 size={18} />}>
            {byBuildingStats.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No hay tareas programadas esta semana.</div>
            ) : (
              <div>
                {byBuildingStats.map((b) => {
                  const pct = Math.round(b.rate);
                  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={b.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color }}>{pct}%</span>
                      </div>
                      <div style={{ background: "#e5e7eb", borderRadius: 99, height: 8 }}>
                        <div style={{ width: `${pct}%`, background: color, borderRadius: 99, height: 8, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                        <span>{b.completed} completadas</span>
                        <span>{b.total - b.completed} pendientes</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </>
    );
  }

  function renderByBuildingTab() {
    return (
      <SectionCard title={`Cumplimiento por edificio · ${formatWeekRange(weekMonday)}`} icon={<Building2 size={18} />}>
        {byBuildingStats.length === 0 ? (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No hay tareas programadas esta semana.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {byBuildingStats.map((b) => {
              const color = b.rate >= 80 ? "#10B981" : b.rate >= 60 ? "#F59E0B" : "#EF4444";
              return (
                <AppCard key={b.id} style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.completed} / {b.total} tareas</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{b.rate.toFixed(0)}%</div>
                  </div>
                  <div style={{ height: 8, background: "var(--divider)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${b.rate}%`, height: "100%", background: color, transition: "width .4s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    <span><CheckCircle2 size={10} style={{ verticalAlign: "middle" }} /> {b.completed} completadas</span>
                    <span><Clock3 size={10} style={{ verticalAlign: "middle" }} /> {b.pending} pendientes</span>
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}
      </SectionCard>
    );
  }

  function renderHistoryTab() {
    return (
      <>
        <SectionCard title="Filtros" icon={<Filter size={18} />}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              <label style={filterLabelStyle}>Edificio</label>
              <AppSelect value={historyBuildingId} onChange={(e) => setHistoryBuildingId(e.target.value)}>
                <option value="all">Todos</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </AppSelect>
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <label style={filterLabelStyle}>Tipo</label>
              <AppSelect value={historyType} onChange={(e) => setHistoryType(e.target.value as "all" | CleaningType)}>
                <option value="all">Todos</option>
                {(Object.keys(CLEANING_TYPE_COLORS) as CleaningType[]).map((t) => (
                  <option key={t} value={t}>{CLEANING_TYPE_COLORS[t]?.label ?? "Limpieza"}</option>
                ))}
              </AppSelect>
            </div>
          </div>
        </SectionCard>

        <div style={{ height: 16 }} />

        <SectionCard title="Últimos 30 días" icon={<Clock3 size={18} />}>
          {historyRows.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>Sin registros en el periodo.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Área / Unidad</th>
                    <th style={thStyle}>Edificio</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Completado por</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((r) => {
                    const visuals = CLEANING_TYPE_COLORS[r.cleaning_type] ?? DEFAULT_CLEANING_VISUALS;
                    const b = buildingById.get(r.building_id);
                    const u = r.unit_id ? unitById.get(r.unit_id) : null;
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={tdStyle}>{r.scheduled_date}</td>
                        <td style={tdStyle}>
                          <span style={{ background: visuals.bg, color: visuals.text, borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 500, borderLeft: `3px solid ${visuals.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {CLEANING_TYPE_ICONS[r.cleaning_type] ?? <Sparkles size={10} />} {visuals.label}
                          </span>
                        </td>
                        <td style={tdStyle}>{u ? (u.display_code || u.unit_number) : "Áreas comunes"}</td>
                        <td style={tdStyle}>{b?.name ?? "—"}</td>
                        <td style={tdStyle}><AppBadge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</AppBadge></td>
                        <td style={tdStyle}>{r.completed_at ? new Date(r.completed_at).toLocaleString("es-MX") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </>
    );
  }

  function renderConfigTab() {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <UiButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreateSchedule(true)}>
            Nuevo horario
          </UiButton>
        </div>

        {buildings.map((b) => {
          const bSch = buildingSchedules.filter((s) => s.building_id === b.id);
          const uSch = unitSchedules.filter((s) => s.building_id === b.id);
          if (bSch.length === 0 && uSch.length === 0) return null;

          return (
            <div key={b.id} style={{ marginBottom: 12 }}>
              <SectionCard title={b.name} icon={<Building2 size={18} />} subtitle={`${bSch.length + uSch.length} horario${bSch.length + uSch.length === 1 ? "" : "s"}`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {bSch.map((s) => {
                    const v = CLEANING_TYPE_COLORS[s.cleaning_type] ?? DEFAULT_CLEANING_VISUALS;
                    return (
                      <div key={s.id} style={scheduleRowStyle}>
                        <span style={{ background: v.bg, color: v.text, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 500, borderLeft: `3px solid ${v.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {CLEANING_TYPE_ICONS[s.cleaning_type] ?? <Sparkles size={10} />} {v.label}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{DAY_LONG[s.day_of_week]}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {s.time_block ? TIME_BLOCK_LABEL[s.time_block] : "—"}
                        </span>
                      </div>
                    );
                  })}
                  {uSch.map((s) => {
                    const v = CLEANING_TYPE_COLORS.unit_interior ?? DEFAULT_CLEANING_VISUALS;
                    const u = unitById.get(s.unit_id);
                    return (
                      <div key={s.id} style={scheduleRowStyle}>
                        <span style={{ background: v.bg, color: v.text, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 500, borderLeft: `3px solid ${v.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {CLEANING_TYPE_ICONS.unit_interior} {u?.display_code || u?.unit_number || "Unidad"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{DAY_LONG[s.day_of_week]}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {s.start_time || "—"} · {s.duration_hours ?? 0}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          );
        })}
      </>
    );
  }
}

/* ═══ Shared styles ═══════════════════════════════════════════════ */

const navBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  borderRadius: 8,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--text-secondary)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
};

const filterLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const scheduleRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}
