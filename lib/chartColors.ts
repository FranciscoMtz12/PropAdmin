/**
 * Paleta fija de gráficas — única fuente de verdad para colores Recharts.
 *
 * Recharts/SVG no acepta var() CSS como fill/stroke directo, así que los
 * colores de chart se definen aquí como constantes hex y se importan donde
 * se necesiten. Los tokens CSS equivalentes viven en globals.css bajo --chart-*.
 */

export const CHART = {
  /** cobrado, ocupado, ingreso */
  positive:  "#10B981",
  /** pendiente, parcial */
  warning:   "#F59E0B",
  /** vencido, gasto, problema */
  negative:  "#EF4444",
  /** total, línea de referencia */
  reference: "#3B82F6",
  /** sin datos, vacío */
  neutral:   "#94A3B8",
  /**
   * Colores categoriales — solo para diferenciar series/edificios.
   * No incluyen verde/ámbar/rojo para no chocar con los semánticos.
   */
  cat: [
    "#6366F1", // cat-1
    "#8B5CF6", // cat-2
    "#EC4899", // cat-3
    "#06B6D4", // cat-4
    "#14B8A6", // cat-5
    "#A855F7", // cat-6
    "#0EA5E9", // cat-7
    "#F472B6", // cat-8
  ],
} as const;

/** Segmento vacío de dona — cambia entre light/dark (único token variable) */
export const CHART_EMPTY_LIGHT = "#e5e7eb";
export const CHART_EMPTY_DARK  = "#374151";

/** Helper: devuelve el color de segmento vacío según el modo */
export function chartEmptyColor(isDark: boolean): string {
  return isDark ? CHART_EMPTY_DARK : CHART_EMPTY_LIGHT;
}
