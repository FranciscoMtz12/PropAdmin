import {
  ArrowUpDown,
  Camera,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Gauge,
  Package,
  Phone,
  Snowflake,
  Thermometer,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import AppIconBox from "@/components/AppIconBox";

/*
  Icono reutilizable para representar assets por tipo.

  Se usa en listas y páginas de detalle para que los equipos
  tengan una identidad visual consistente dentro de PropAdmin.

  Tipos soportados:
  - Unidad: MINISPLIT, CENTRAL_AC, BOILER, FRIDGE, WASHER, DRYER, STOVE, FAN
  - Edificio: ELEVATOR, CISTERN, HYDROPNEUMATIC, GENERATOR, PUMP, GATE,
               SECURITY_CAMERA, INTERCOM, COMMON_AREA_AC
  - Genérico: OTHER
*/

function getAssetColors(assetType: string): { bg: string; color: string } {
  switch (assetType) {
    /* ── Frío / clima ─────────────────────────────────────────── */
    case "MINISPLIT":
    case "CENTRAL_AC":
    case "COMMON_AREA_AC":
      return { bg: "#EFF6FF", color: "#2563EB" };

    /* ── Calor / gas ──────────────────────────────────────────── */
    case "BOILER":
    case "STOVE":
      return { bg: "#FEF3C7", color: "#D97706" };

    /* ── Agua ─────────────────────────────────────────────────── */
    case "WASHER":
    case "DRYER":
    case "CISTERN":
    case "PUMP":
    case "HYDROPNEUMATIC":
      return { bg: "#EFF6FF", color: "#0284C7" };

    /* ── Eléctrico / energía ──────────────────────────────────── */
    case "GENERATOR":
      return { bg: "#FEF9C3", color: "#CA8A04" };

    /* ── Verde / ventilación ──────────────────────────────────── */
    case "FAN":
      return { bg: "#F0FDF4", color: "#16A34A" };

    /* ── Acceso / seguridad ───────────────────────────────────── */
    case "ELEVATOR":
      return { bg: "#F5F3FF", color: "#7C3AED" };
    case "GATE":
      return { bg: "#F5F3FF", color: "#6D28D9" };
    case "SECURITY_CAMERA":
      return { bg: "#FFF1F2", color: "#BE123C" };
    case "INTERCOM":
      return { bg: "#F0FDF4", color: "#15803D" };

    /* ── Refrigeración ────────────────────────────────────────── */
    case "FRIDGE":
      return { bg: "#EFF6FF", color: "#2563EB" };

    /* ── Genérico ─────────────────────────────────────────────── */
    case "OTHER":
    default:
      return { bg: "#F3F4F6", color: "#374151" };
  }
}

function getAssetIcon(assetType: string) {
  switch (assetType) {
    case "MINISPLIT":
    case "CENTRAL_AC":
    case "COMMON_AREA_AC":
      return Snowflake;

    case "BOILER":
    case "STOVE":
      return Flame;

    case "WASHER":
    case "DRYER":
      return Droplets;

    case "CISTERN":
      return Droplets;

    case "HYDROPNEUMATIC":
      return Gauge;

    case "PUMP":
      return Wind;

    case "GENERATOR":
      return Zap;

    case "ELEVATOR":
      return ArrowUpDown;

    case "GATE":
      return DoorOpen;

    case "SECURITY_CAMERA":
      return Camera;

    case "INTERCOM":
      return Phone;

    case "THERMOMETER":
      return Thermometer;

    case "FAN":
      return Fan;

    case "FRIDGE":
      return Package;

    case "OTHER":
      return Wrench;

    default:
      return Wind;
  }
}

export default function AssetTypeIcon({
  assetType,
  size = 18,
}: {
  assetType: string;
  size?: number;
}) {
  const Icon   = getAssetIcon(assetType);
  const colors = getAssetColors(assetType);

  return (
    <AppIconBox
      size={size + 18}
      radius={12}
      background={colors.bg}
      color={colors.color}
    >
      <Icon size={size} />
    </AppIconBox>
  );
}
