export const PROPERTY_TYPES = [
  { value: 'residential',     label: 'Residencial',       icon: 'Building2', color: '#8B2252' },
  { value: 'commercial',      label: 'Comercial',         icon: 'Store',     color: '#0369a1' },
  { value: 'industrial',      label: 'Industrial',        icon: 'Warehouse', color: '#b45309' },
  { value: 'industrial_park', label: 'Parque Industrial', icon: 'Factory',   color: '#b45309' },
  { value: 'land',            label: 'Terreno',           icon: 'MapPin',    color: '#15803d' },
] as const

export type PropertyType = typeof PROPERTY_TYPES[number]['value']

export const PROPERTY_TAGS = [
  { value: 'residential', label: 'Residencial' },
  { value: 'commercial',  label: 'Comercial'   },
  { value: 'industrial',  label: 'Industrial'  },
  { value: 'office',      label: 'Oficinas'    },
  { value: 'land',        label: 'Terreno'     },
]

export const BUILDING_FEATURES = [
  { key: 'has_office',       label: 'Tiene oficina'   },
  { key: 'has_loading_dock', label: 'Muelle de carga' },
  { key: 'has_crane',        label: 'Grúa'            },
  { key: 'has_parking',      label: 'Estacionamiento' },
  { key: 'has_security',     label: 'Seguridad 24h'   },
  { key: 'has_bathroom',     label: 'Baños'           },
]

export function getPropertyType(category: string | null | undefined) {
  return PROPERTY_TYPES.find(t => t.value === category) ?? PROPERTY_TYPES[0]
}

export function getPropertyTypeLabel(category: string | null | undefined): string {
  return getPropertyType(category).label
}
