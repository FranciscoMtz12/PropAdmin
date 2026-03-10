"use client";

/*
  Badge visual reutilizable para categorías de edificio.

  Lo usamos en:
  - lista de edificios
  - detalle del edificio
  - cualquier otra pantalla futura donde queramos mostrar el tipo

  El color se toma del archivo central lib/buildingCategories.ts
  para mantener consistencia visual.
*/

import AppBadge from "@/components/AppBadge";
import { getBuildingCategoryDefinition } from "@/lib/buildingCategories";

type BuildingCategoryBadgeProps = {
  category: string | null | undefined;
};

export default function BuildingCategoryBadge({ category }: BuildingCategoryBadgeProps) {
  const definition = getBuildingCategoryDefinition(category);

  return (
    <AppBadge
      backgroundColor={definition.backgroundColor}
      textColor={definition.textColor}
      borderColor={definition.borderColor}
    >
      {definition.shortLabel}
    </AppBadge>
  );
}
