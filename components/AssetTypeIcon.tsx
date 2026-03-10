import {
  Flame,
  Package,
  Snowflake,
  Wind,
  Fan,
  Droplets,
  Wrench,
} from "lucide-react";
import AppIconBox from "@/components/AppIconBox";

/*
  Icono reutilizable para representar assets.

  Se usa en listas y páginas de detalle para que los equipos
  tengan una identidad visual consistente dentro de PropAdmin.
*/

function getAssetColors(assetType: string) {
  switch (assetType) {
    case "FRIDGE":
      return { bg: "#EFF6FF", color: "#2563EB" };
    case "MINISPLIT":
    case "CENTRAL_AC":
      return { bg: "#EFF6FF", color: "#2563EB" };
    case "STOVE":
      return { bg: "#FFF7ED", color: "#EA580C" };
    case "WASHER":
    case "DRYER":
      return { bg: "#F5F3FF", color: "#7C3AED" };
    case "FAN":
      return { bg: "#F0FDF4", color: "#16A34A" };
    case "OTHER":
      return { bg: "#F3F4F6", color: "#374151" };
    default:
      return { bg: "#EFF6FF", color: "#2563EB" };
  }
}

function getAssetIcon(assetType: string) {
  switch (assetType) {
    case "FRIDGE":
      return Package;
    case "MINISPLIT":
    case "CENTRAL_AC":
      return Snowflake;
    case "STOVE":
      return Flame;
    case "WASHER":
    case "DRYER":
      return Droplets;
    case "FAN":
      return Fan;
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
  const Icon = getAssetIcon(assetType);
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
