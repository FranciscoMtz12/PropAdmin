import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

// Fecha larga: "17 de abril de 2026"
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
}

// Fecha corta: "17/04/2026"
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, "dd/MM/yyyy", { locale: es });
}

// Fecha media: "17 abr 2026"
export function formatDateMedium(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, "d MMM yyyy", { locale: es });
}

// Fecha con hora: "17 abr 2026, 14:30"
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, "d MMM yyyy, HH:mm", { locale: es });
}

// Mes y año: "Abril 2026"
export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return format(d, "MMMM yyyy", { locale: es });
}

// Relativo: "hace 3 días"
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return formatDistanceToNow(d, { locale: es, addSuffix: true });
}

// Semana del año: 16 (ISO-8601, lunes-primero)
export function getWeekNumber(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
