export const PROPERTY_TYPES = [
  { value: 'residential_multi',  label: 'Residencial multifamiliar', icon: 'Building2', color: '#8B2252' },
  { value: 'residential_single', label: 'Residencial unifamiliar',   icon: 'Home',      color: '#0369a1' },
  { value: 'commercial',         label: 'Comercial',                 icon: 'Store',     color: '#0369a1' },
  { value: 'industrial',         label: 'Industrial',                icon: 'Warehouse', color: '#b45309' },
  { value: 'industrial_park',    label: 'Parque Industrial',         icon: 'Factory',   color: '#b45309' },
  { value: 'land',               label: 'Terreno',                   icon: 'MapPin',    color: '#15803d' },
] as const

export type PropertyType = typeof PROPERTY_TYPES[number]['value']

export const PROPERTY_TAGS = [
  { value: 'residential_multi',  label: 'Residencial multifamiliar' },
  { value: 'residential_single', label: 'Residencial unifamiliar'   },
  { value: 'commercial',         label: 'Comercial'                 },
  { value: 'industrial',         label: 'Industrial'                },
  { value: 'office',             label: 'Oficinas'                  },
  { value: 'land',               label: 'Terreno'                   },
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

export type PropertyLabels = {
  units: string
  leases: string
  collections: string
  building: string
  unit: string
}

export function getPropertyLabels(category: string | null): PropertyLabels {
  switch (category) {
    case 'residential_single':
      return {
        units:       'Habitaciones',
        leases:      'Contrato',
        collections: 'Cobranza',
        building:    'Casa',
        unit:        'Habitación',
      }
    case 'land':
      return {
        units:       'Secciones',
        leases:      'Contratos de terreno',
        collections: 'Cobranza de terreno',
        building:    'Terreno',
        unit:        'Sección',
      }
    case 'industrial':
    case 'industrial_park':
      return {
        units:       'Naves / Espacios',
        leases:      'Contratos',
        collections: 'Cobranza',
        building:    'Nave industrial',
        unit:        'Espacio',
      }
    case 'commercial':
      return {
        units:       'Locales',
        leases:      'Contratos comerciales',
        collections: 'Cobranza',
        building:    'Propiedad comercial',
        unit:        'Local',
      }
    default:
      return {
        units:       'Unidades',
        leases:      'Contratos',
        collections: 'Cobranza',
        building:    'Edificio',
        unit:        'Unidad',
      }
  }
}
