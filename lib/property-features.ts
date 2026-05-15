export type FeatureCategory = 'space' | 'service'

export interface FeatureTask {
  key: string
  label: string
  description: string
  route?: string
}

export interface PropertyFeature {
  key: string
  label: string
  description: string
  category: FeatureCategory
  icon: string
  color: string
  applicableTypes: string[]
  tasks: FeatureTask[]
}

export const PROPERTY_FEATURES: PropertyFeature[] = [
  // ESPACIOS FÍSICOS
  {
    key: 'units',
    label: 'Unidades / Espacios',
    description: 'Departamentos, locales, naves o secciones rentables',
    category: 'space',
    icon: 'LayoutGrid',
    color: '#8B2252',
    applicableTypes: ['residential', 'commercial', 'industrial'],
    tasks: [
      { key: 'add_first_unit', label: 'Registrar primer espacio', description: 'Da de alta al menos una unidad o espacio rentable', route: '/buildings/[id]/units' },
      { key: 'add_unit_types', label: 'Configurar tipologías', description: 'Define los tipos de unidad disponibles', route: '/buildings/[id]/unit-types' },
    ],
  },
  {
    key: 'parking',
    label: 'Estacionamiento',
    description: 'Cajones de estacionamiento asignables',
    category: 'space',
    icon: 'Car',
    color: '#0369a1',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park'],
    tasks: [
      { key: 'add_parking_spots', label: 'Registrar cajones', description: 'Da de alta los cajones disponibles' },
    ],
  },
  {
    key: 'security_booth',
    label: 'Caseta de vigilancia',
    description: 'Espacio físico de caseta en la propiedad',
    category: 'space',
    icon: 'Shield',
    color: '#b45309',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park'],
    tasks: [
      { key: 'setup_security_booth', label: 'Registrar caseta como activo', description: 'Agrega la caseta en el módulo de activos' },
    ],
  },
  {
    key: 'admin_office',
    label: 'Oficina administrativa',
    description: 'Oficina de administración dentro de la propiedad',
    category: 'space',
    icon: 'Briefcase',
    color: '#0369a1',
    applicableTypes: ['commercial', 'industrial', 'industrial_park'],
    tasks: [
      { key: 'setup_admin_office', label: 'Registrar oficina como activo', description: 'Agrega la oficina en el módulo de activos' },
    ],
  },
  {
    key: 'loading_dock',
    label: 'Muelle de carga',
    description: 'Andén o muelle para carga y descarga',
    category: 'space',
    icon: 'Truck',
    color: '#b45309',
    applicableTypes: ['industrial', 'industrial_park', 'commercial'],
    tasks: [
      { key: 'setup_loading_dock', label: 'Registrar muelle como activo', description: 'Agrega el muelle en el módulo de activos' },
    ],
  },
  {
    key: 'common_areas',
    label: 'Áreas comunes',
    description: 'Jardines, roof garden, gimnasio, alberca u otros espacios compartidos',
    category: 'space',
    icon: 'Trees',
    color: '#15803d',
    applicableTypes: ['residential', 'commercial', 'industrial_park'],
    tasks: [
      { key: 'setup_common_areas', label: 'Registrar áreas comunes', description: 'Define las áreas comunes disponibles' },
    ],
  },
  {
    key: 'service_storage',
    label: 'Bodega de servicio',
    description: 'Bodega para herramientas y materiales de mantenimiento',
    category: 'space',
    icon: 'Package',
    color: '#6b7280',
    applicableTypes: ['residential', 'commercial', 'industrial'],
    tasks: [
      { key: 'setup_service_storage', label: 'Registrar bodega como activo', description: 'Agrega la bodega de servicio en activos' },
    ],
  },
  // SERVICIOS
  {
    key: 'electricity',
    label: 'Electricidad',
    description: 'Servicio de luz con medidores y distribución de costos',
    category: 'service',
    icon: 'Zap',
    color: '#eab308',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park', 'land'],
    tasks: [
      { key: 'add_electricity_meter', label: 'Configurar medidor de luz', description: 'Da de alta el medidor principal en Servicios', route: '/servicios' },
    ],
  },
  {
    key: 'water',
    label: 'Agua',
    description: 'Servicio de agua con control de consumo',
    category: 'service',
    icon: 'Droplets',
    color: '#0ea5e9',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park'],
    tasks: [
      { key: 'add_water_meter', label: 'Configurar medidor de agua', description: 'Da de alta el medidor de agua en Servicios', route: '/servicios' },
    ],
  },
  {
    key: 'gas',
    label: 'Gas',
    description: 'Servicio de gas natural o LP',
    category: 'service',
    icon: 'Flame',
    color: '#f97316',
    applicableTypes: ['residential', 'commercial', 'industrial'],
    tasks: [
      { key: 'add_gas_meter', label: 'Configurar medidor de gas', description: 'Da de alta el medidor de gas en Servicios', route: '/servicios' },
    ],
  },
  {
    key: 'internet',
    label: 'Internet',
    description: 'Servicio de conectividad incluido o compartido',
    category: 'service',
    icon: 'Wifi',
    color: '#6366f1',
    applicableTypes: ['residential', 'commercial', 'industrial_park'],
    tasks: [
      { key: 'setup_internet', label: 'Configurar servicio de internet', description: 'Da de alta el servicio en Servicios', route: '/servicios' },
    ],
  },
  {
    key: 'security_service',
    label: 'Servicio de vigilancia',
    description: 'Personal o empresa de seguridad activa en la propiedad',
    category: 'service',
    icon: 'ShieldCheck',
    color: '#b45309',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park'],
    tasks: [
      { key: 'setup_security_service', label: 'Registrar proveedor de vigilancia', description: 'Agrega el proveedor en el módulo de proveedores', route: '/suppliers' },
    ],
  },
  {
    key: 'cleaning',
    label: 'Limpieza',
    description: 'Servicio de limpieza programado',
    category: 'service',
    icon: 'Sparkles',
    color: '#06b6d4',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park'],
    tasks: [
      { key: 'setup_cleaning_schedule', label: 'Configurar programa de limpieza', description: 'Define el calendario de limpieza', route: '/cleaning' },
    ],
  },
  {
    key: 'maintenance',
    label: 'Mantenimiento',
    description: 'Programa de mantenimiento preventivo y correctivo',
    category: 'service',
    icon: 'Wrench',
    color: '#8b5cf6',
    applicableTypes: ['residential', 'commercial', 'industrial', 'industrial_park', 'land'],
    tasks: [
      { key: 'setup_maintenance', label: 'Crear primer ticket de mantenimiento', description: 'Registra el primer mantenimiento de la propiedad', route: '/maintenance' },
    ],
  },
]

export function getDefaultFeatures(propertyType: string): PropertyFeature[] {
  return PROPERTY_FEATURES.filter(f => f.applicableTypes.includes(propertyType))
}

export function getFeatureByKey(key: string): PropertyFeature | undefined {
  return PROPERTY_FEATURES.find(f => f.key === key)
}

export function groupFeaturesByCategory(features: PropertyFeature[]) {
  return {
    spaces: features.filter(f => f.category === 'space'),
    services: features.filter(f => f.category === 'service'),
  }
}
