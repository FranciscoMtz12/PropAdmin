/**
 * Ordenamiento natural alfanumérico.
 * Trata números embebidos en strings como números, no como caracteres.
 *
 * USAR EN TODA LISTA donde se muestren:
 * - Departamentos (units), submedidores (internal_number)
 * - Folios de OC, tickets, facturas
 * - Códigos, números de medidor
 * - Cualquier identificador alfanumérico
 */
export function naturalCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return ((a ?? "").toString()).localeCompare(
    (b ?? "").toString(),
    "es-MX",
    { numeric: true, sensitivity: "base" },
  );
}

export function sortByNatural<T>(
  arr: T[],
  getKey: (item: T) => string | null | undefined,
): T[] {
  return [...arr].sort((a, b) => naturalCompare(getKey(a), getKey(b)));
}

export function sortByAlphabetic<T>(
  arr: T[],
  getKey: (item: T) => string | null | undefined,
): T[] {
  return [...arr].sort((a, b) =>
    ((getKey(a) ?? "")).localeCompare(
      (getKey(b) ?? ""),
      "es-MX",
      { sensitivity: "base" },
    ),
  );
}
