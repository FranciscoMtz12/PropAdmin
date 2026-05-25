import type { ComponentType } from "react";
import {
  Coins, Wrench, Building2, TrendingUp, Users, Zap, ShoppingCart,
  Sparkles, Truck, Receipt, Calendar, LayoutDashboard,
} from "lucide-react";

export type QuickLink = {
  label: string;
  icon: string;
  path: string;
  customPath?: string;
};

type IconComp = ComponentType<{ size?: number; color?: string }>;

export const ICON_MAP: Record<string, IconComp> = {
  "ti-coin":              Coins,
  "ti-tool":              Wrench,
  "ti-building":          Building2,
  "ti-chart-bar":         TrendingUp,
  "ti-users":             Users,
  "ti-bolt":              Zap,
  "ti-shopping-cart":     ShoppingCart,
  "ti-sparkles":          Sparkles,
  "ti-truck":             Truck,
  "ti-receipt":           Receipt,
  "ti-calendar":          Calendar,
  "ti-layout-dashboard":  LayoutDashboard,
};

export const ALL_MODULES: QuickLink[] = [
  { label: "Cobranza",      icon: "ti-coin",          path: "/cobranza"      },
  { label: "Propiedades",   icon: "ti-building",      path: "/buildings"     },
  { label: "Inquilinos",    icon: "ti-users",         path: "/tenants"       },
  { label: "Servicios",     icon: "ti-bolt",          path: "/servicios"     },
  { label: "Mantenimiento", icon: "ti-tool",          path: "/mantenimiento" },
  { label: "Limpieza",      icon: "ti-sparkles",      path: "/cleaning"      },
  { label: "Compras",       icon: "ti-shopping-cart", path: "/compras"       },
  { label: "Proveedores",   icon: "ti-truck",         path: "/suppliers"     },
  { label: "Pagos",         icon: "ti-receipt",       path: "/payments"      },
  { label: "Analytics",     icon: "ti-chart-bar",     path: "/analytics"     },
  { label: "Calendario",    icon: "ti-calendar",      path: "/calendar"      },
];

const BY_ROLE: Record<string, QuickLink[]> = {
  administracion: [
    { label: "Propiedades",   icon: "ti-building",      path: "/buildings"     },
    { label: "Servicios",     icon: "ti-bolt",          path: "/servicios"     },
    { label: "Pagos",         icon: "ti-receipt",       path: "/payments"      },
    { label: "Cobranza",      icon: "ti-coin",          path: "/cobranza"      },
    { label: "Inquilinos",    icon: "ti-users",         path: "/tenants"       },
  ],
  compras: [
    { label: "Compras",       icon: "ti-shopping-cart", path: "/compras"       },
    { label: "Proveedores",   icon: "ti-truck",         path: "/suppliers"     },
    { label: "Mantenimiento", icon: "ti-tool",          path: "/mantenimiento" },
    { label: "Propiedades",   icon: "ti-building",      path: "/buildings"     },
  ],
  mantenimiento: [
    { label: "Mantenimiento", icon: "ti-tool",          path: "/mantenimiento" },
    { label: "Limpieza",      icon: "ti-sparkles",      path: "/cleaning"      },
    { label: "Propiedades",   icon: "ti-building",      path: "/buildings"     },
    { label: "Compras",       icon: "ti-shopping-cart", path: "/compras"       },
  ],
  field: [
    { label: "Mantenimiento", icon: "ti-tool",          path: "/mantenimiento" },
    { label: "Limpieza",      icon: "ti-sparkles",      path: "/cleaning"      },
    { label: "Propiedades",   icon: "ti-building",      path: "/buildings"     },
    { label: "Compras",       icon: "ti-shopping-cart", path: "/compras"       },
  ],
};

const FALLBACK: QuickLink[] = [
  { label: "Cobranza",      icon: "ti-coin",          path: "/cobranza"      },
  { label: "Mantenimiento", icon: "ti-tool",          path: "/mantenimiento" },
  { label: "Propiedades",   icon: "ti-building",      path: "/buildings"     },
  { label: "Analytics",     icon: "ti-chart-bar",     path: "/analytics"     },
  { label: "Inquilinos",    icon: "ti-users",         path: "/tenants"       },
  { label: "Servicios",     icon: "ti-bolt",          path: "/servicios"     },
  { label: "Compras",       icon: "ti-shopping-cart", path: "/compras"       },
];

export function getDefaultQuickLinks(role: string): QuickLink[] {
  return BY_ROLE[role] ?? FALLBACK;
}

/* Role-based module filtering — mirrors ROLE_ALLOWED in Sidebar.tsx (single source of truth) */
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  administracion: ["/dashboard", "/buildings", "/servicios", "/payments", "/collections", "/cobranza", "/tenants"],
  compras:        ["/dashboard", "/purchases", "/compras", "/suppliers"],
  mantenimiento:  ["/dashboard", "/maintenance", "/mantenimiento", "/cleaning"],
  directivo:      ["/dashboard", "/buildings", "/analytics", "/collections", "/cobranza", "/tenants"],
};

export function getAllowedModules(role: string): QuickLink[] {
  const allowed = ROLE_ALLOWED_PREFIXES[role];
  if (!allowed) return ALL_MODULES; // titular, superadmin: all modules
  return ALL_MODULES.filter(m => allowed.some(p => m.path.startsWith(p) || p.startsWith(m.path)));
}
