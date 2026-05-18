export type NotificationSeverity = 'critical' | 'warning' | 'info'
export type NotificationModule = 'cobranza' | 'servicios' | 'unidades' | 'contratos' | 'mantenimiento' | 'propiedades' | 'compras'

export type Notification = {
  id: string
  module: NotificationModule
  severity: NotificationSeverity
  title: string
  description: string
  action_route: string | null
  is_resolved: boolean
}

export const NOTIFICATION_TYPES = {
  COBROS_NO_GENERADOS:         { module: 'cobranza'    as const, severity: 'warning'  as const, title: 'Cobros del mes sin generar',       description: 'No se han generado los cobros de este mes.' },
  COBROS_VENCIDOS:             { module: 'cobranza'    as const, severity: 'critical' as const, title: 'Cobros vencidos sin pagar',         description: 'Hay cobros vencidos que requieren atención.' },
  MEDIDOR_SIN_CONFIGURAR:      { module: 'servicios'   as const, severity: 'critical' as const, title: 'Medidor sin configurar',            description: 'Servicio activo sin medidor configurado.' },
  LECTURAS_PENDIENTES:         { module: 'servicios'   as const, severity: 'warning'  as const, title: 'Lecturas pendientes',              description: 'Hay lecturas del mes sin capturar.' },
  UNIDADES_PENDIENTES_REVISION:{ module: 'unidades'    as const, severity: 'warning'  as const, title: 'Unidades pendientes de revisión',  description: 'Unidades duplicadas que requieren verificación.' },
  CONTRATO_POR_VENCER:         { module: 'contratos'   as const, severity: 'warning'  as const, title: 'Contrato próximo a vencer',        description: 'Contrato vence en menos de 30 días.' },
  CONTRATO_VENCIDO:            { module: 'contratos'   as const, severity: 'critical' as const, title: 'Contrato vencido',                 description: 'Contrato vencido sin renovar.' },
  SETUP_PENDIENTE:             { module: 'propiedades' as const, severity: 'info'     as const, title: 'Configuración pendiente',          description: 'La propiedad tiene tareas de configuración pendientes.' },
} as const

export const SEVERITY_COLORS: Record<NotificationSeverity, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: '#FCEBEB', border: '#E24B4A', text: '#A32D2D', dot: '#E24B4A' },
  warning:  { bg: '#FAEEDA', border: '#EF9F27', text: '#854F0B', dot: '#EF9F27' },
  info:     { bg: '#E6F1FB', border: '#378ADD', text: '#185FA5', dot: '#378ADD' },
}

export const MODULE_LABELS: Record<NotificationModule, string> = {
  cobranza:      'Cobranza',
  servicios:     'Servicios',
  unidades:      'Unidades',
  contratos:     'Contratos',
  mantenimiento: 'Mantenimiento',
  propiedades:   'Propiedades',
  compras:       'Compras',
}
