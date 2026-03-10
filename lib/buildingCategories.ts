/*
  Fuente única de verdad para categorías de edificio.

  Aquí concentramos:
  - valores válidos que guardamos en base de datos
  - etiquetas visibles en español
  - colores para badges y filtros
  - subcategorías de uso mixto

  Esto evita duplicar strings en muchas páginas.
*/

export type BuildingCategoryKey =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed_use";

export type MixedUseSubcategoryKey =
  | "residential_commercial"
  | "industrial_commercial";

export type BuildingCategoryDefinition = {
  key: BuildingCategoryKey;
  label: string;
  shortLabel: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

export const BUILDING_CATEGORIES: BuildingCategoryDefinition[] = [
  {
    key: "residential",
    label: "Edificio de departamentos",
    shortLabel: "Departamentos",
    backgroundColor: "#DBEAFE",
    textColor: "#1D4ED8",
    borderColor: "#BFDBFE",
  },
  {
    key: "commercial",
    label: "Plaza comercial",
    shortLabel: "Plaza comercial",
    backgroundColor: "#F3E8FF",
    textColor: "#7E22CE",
    borderColor: "#E9D5FF",
  },
  {
    key: "industrial",
    label: "Bodegas / industrial",
    shortLabel: "Industrial",
    backgroundColor: "#E5E7EB",
    textColor: "#374151",
    borderColor: "#D1D5DB",
  },
  {
    key: "mixed_use",
    label: "Uso mixto",
    shortLabel: "Uso mixto",
    backgroundColor: "#DCFCE7",
    textColor: "#15803D",
    borderColor: "#BBF7D0",
  },
];

export const MIXED_USE_SUBCATEGORIES: { value: MixedUseSubcategoryKey; label: string }[] = [
  {
    value: "residential_commercial",
    label: "Vivienda + comercial",
  },
  {
    value: "industrial_commercial",
    label: "Industrial + comercial",
  },
];

export function getBuildingCategoryDefinition(category: string | null | undefined) {
  return (
    BUILDING_CATEGORIES.find((item) => item.key === category) || {
      key: "residential" as BuildingCategoryKey,
      label: "Sin categoría",
      shortLabel: "Sin categoría",
      backgroundColor: "#F3F4F6",
      textColor: "#4B5563",
      borderColor: "#E5E7EB",
    }
  );
}

export function getMixedUseSubcategoryLabel(subcategory: string | null | undefined) {
  if (!subcategory) return "Sin subcategoría";

  const found = MIXED_USE_SUBCATEGORIES.find((item) => item.value === subcategory);
  return found?.label || subcategory;
}
