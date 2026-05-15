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

export const COMMERCIAL_SUBTYPES = [
  { value: 'local_comercial',  label: 'Local comercial',  icon: 'Store',     description: 'Tienda, restaurante, consultorio u otro espacio de atención al público' },
  { value: 'oficinas',         label: 'Oficinas',         icon: 'Briefcase', description: 'Edificio o piso de oficinas, coworking o corporativo' },
  { value: 'plaza_comercial',  label: 'Plaza comercial',  icon: 'Building2', description: 'Conjunto de locales — contiene espacios hijos como una plaza o galería' },
  { value: 'showroom',         label: 'Showroom',         icon: 'Monitor',   description: 'Espacio de exhibición y venta — concesionaria, mueblería, galería' },
] as const

export type CommercialSubtype = typeof COMMERCIAL_SUBTYPES[number]['value']

export function getCommercialSubtype(subtype: string | null | undefined) {
  return COMMERCIAL_SUBTYPES.find(s => s.value === subtype)
}

export const INDUSTRIAL_SUBTYPES = [
  { value: 'nave_industrial', label: 'Nave industrial',       icon: 'Warehouse', description: 'Bodega o nave para manufactura, almacenamiento o distribución' },
  { value: 'bodega',          label: 'Bodega',                icon: 'Package',   description: 'Espacio de almacenamiento' },
  { value: 'planta',          label: 'Planta de producción',  icon: 'Factory',   description: 'Instalación para manufactura o procesamiento' },
] as const

export type IndustrialSubtype = typeof INDUSTRIAL_SUBTYPES[number]['value']

export function getIndustrialSubtype(subtype: string | null | undefined) {
  return INDUSTRIAL_SUBTYPES.find(s => s.value === subtype)
}

export function getSubtypeLabel(
  category: string | null | undefined,
  subtype: string | null | undefined,
): string | undefined {
  if (!subtype) return undefined
  if (category === 'commercial') return getCommercialSubtype(subtype)?.label
  if (category === 'industrial' || category === 'industrial_park') return getIndustrialSubtype(subtype)?.label
  return undefined
}

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

export function getPropertyLabels(category: string | null, subtype?: string | null): PropertyLabels {
  switch (category) {
    case 'commercial':
      switch (subtype) {
        case 'plaza_comercial':
          return { units: 'Locales', leases: 'Contratos', collections: 'Cobranza', building: 'Plaza comercial', unit: 'Local' }
        case 'oficinas':
          return { units: 'Oficinas', leases: 'Contratos', collections: 'Cobranza', building: 'Edificio de oficinas', unit: 'Oficina' }
        case 'showroom':
          return { units: 'Espacios', leases: 'Contratos', collections: 'Cobranza', building: 'Showroom', unit: 'Espacio' }
        default:
          return { units: 'Locales', leases: 'Contratos', collections: 'Cobranza', building: 'Local comercial', unit: 'Local' }
      }
    case 'industrial':
    case 'industrial_park':
      switch (subtype) {
        case 'planta':
          return { units: 'Áreas', leases: 'Contratos', collections: 'Cobranza', building: 'Planta de producción', unit: 'Área' }
        default:
          return { units: 'Naves / Espacios', leases: 'Contratos', collections: 'Cobranza', building: 'Nave industrial', unit: 'Espacio' }
      }
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
