"use client";

/*
  BgTexture — patrón decorativo de íconos inmobiliarios posicionados con
  un seed fijo. Cada icono se coloca en una rejilla inclinada con jitter
  por fila para romper el grid y una variación sutil de opacidad.

  Ventajas vs. el pattern SVG anterior:
  - No se ve la repetición obvia del tile.
  - Mayor variedad de íconos (22 tipos).
  - Opacidad individual por icono para look más orgánico.

  El seed es determinístico, así que el render es idéntico en cada mount.
*/

import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

const ICON_SIZE = 24;
const TILT = -12;

/* Generador pseudo-aleatorio con seed fijo (Lehmer LCG). */
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Banco de 22 íconos (edificios, llaves, herramientas, servicios, etc.). */
function getIcon(type: number, op: number): string {
  const t = type % 22;
  switch (t) {
    case 0:  return `<rect x="0" y="0" width="16" height="22" opacity="${op}"/><rect x="2" y="3" width="4" height="4" opacity="${op}"/><rect x="10" y="3" width="4" height="4" opacity="${op}"/><rect x="2" y="10" width="4" height="4" opacity="${op}"/><rect x="10" y="10" width="4" height="4" opacity="${op}"/><rect x="5" y="16" width="6" height="6" opacity="${op}"/>`;
    case 1:  return `<rect x="0" y="0" width="11" height="28" opacity="${op}"/><rect x="1" y="3" width="3" height="4" opacity="${op}"/><rect x="7" y="3" width="3" height="4" opacity="${op}"/><rect x="1" y="10" width="3" height="4" opacity="${op}"/><rect x="7" y="10" width="3" height="4" opacity="${op}"/><rect x="1" y="17" width="3" height="4" opacity="${op}"/><rect x="7" y="17" width="3" height="4" opacity="${op}"/><rect x="3" y="23" width="5" height="5" opacity="${op}"/>`;
    case 2:  return `<rect x="0" y="0" width="26" height="16" opacity="${op}"/><rect x="1" y="2" width="4" height="4" opacity="${op}"/><rect x="8" y="2" width="4" height="4" opacity="${op}"/><rect x="15" y="2" width="4" height="4" opacity="${op}"/><rect x="21" y="2" width="4" height="4" opacity="${op}"/><rect x="1" y="9" width="4" height="4" opacity="${op}"/><rect x="8" y="9" width="4" height="4" opacity="${op}"/><rect x="11" y="12" width="6" height="4" opacity="${op}"/>`;
    case 3:  return `<circle cx="6" cy="6" r="5" opacity="${op}"/><line x1="11" y1="6" x2="22" y2="6" opacity="${op}"/><line x1="19" y1="6" x2="19" y2="10" opacity="${op}"/><line x1="15" y1="6" x2="15" y2="9" opacity="${op}"/>`;
    case 4:  return `<rect x="0" y="0" width="14" height="22" opacity="${op}"/><path d="M7 22 Q14 11 7 0" opacity="${op}"/><circle cx="11" cy="11" r="1.2" opacity="${op}"/>`;
    case 5:  return `<rect x="0" y="0" width="16" height="13" opacity="${op}"/><line x1="8" y1="0" x2="8" y2="13" opacity="${op}"/><line x1="0" y1="6" x2="16" y2="6" opacity="${op}"/>`;
    case 6:  return `<path d="M7 0 a7 7 0 0 1 14 0 c0 7-7 16-7 16 s-7-9-7-16z" opacity="${op}"/><circle cx="14" cy="0" r="3.5" opacity="${op}"/>`;
    case 7:  return `<rect x="0" y="7" width="16" height="12" rx="2" opacity="${op}"/><path d="M3 7 v-3 a5 5 0 0 1 10 0 v3" opacity="${op}"/><circle cx="8" cy="13" r="1.8" opacity="${op}"/>`;
    case 8:  return `<rect x="0" y="0" width="20" height="26" opacity="${op}"/><line x1="3" y1="6" x2="17" y2="6" opacity="${op}"/><line x1="3" y1="11" x2="17" y2="11" opacity="${op}"/><line x1="3" y1="16" x2="12" y2="16" opacity="${op}"/><rect x="3" y="20" width="7" height="4" opacity="${op}"/>`;
    case 9:  return `<rect x="0" y="10" width="4" height="10" opacity="${op}"/><rect x="6" y="4" width="4" height="16" opacity="${op}"/><rect x="12" y="7" width="4" height="13" opacity="${op}"/><rect x="18" y="0" width="4" height="20" opacity="${op}"/><line x1="-1" y1="20" x2="24" y2="20" opacity="${op}"/>`;
    case 10: return `<path d="M0 18 l14-14 m-2-3 a5 5 0 0 0-8 5 l-8 8 a2.5 2.5 0 0 0 3.5 3.5 l8-8 a5 5 0 0 0 5-8z" opacity="${op}"/>`;
    case 11: return `<rect x="0" y="0" width="22" height="20" rx="2" opacity="${op}"/><line x1="0" y1="7" x2="22" y2="7" opacity="${op}"/><line x1="6" y1="0" x2="6" y2="5" opacity="${op}"/><line x1="16" y1="0" x2="16" y2="5" opacity="${op}"/><rect x="3" y="10" width="3" height="3" opacity="${op}"/><rect x="9" y="10" width="3" height="3" opacity="${op}"/><rect x="15" y="10" width="3" height="3" opacity="${op}"/><rect x="3" y="15" width="3" height="3" opacity="${op}"/><rect x="9" y="15" width="3" height="3" opacity="${op}"/>`;
    case 12: return `<line x1="5" y1="24" x2="5" y2="0" opacity="${op}"/><line x1="5" y1="0" x2="24" y2="0" opacity="${op}"/><line x1="24" y1="0" x2="24" y2="7" opacity="${op}"/><line x1="5" y1="0" x2="0" y2="7" opacity="${op}"/><line x1="14" y1="0" x2="14" y2="9" opacity="${op}"/><rect x="11" y="9" width="6" height="4" opacity="${op}"/>`;
    case 13: return `<rect x="0" y="0" width="26" height="16" rx="2" opacity="${op}"/><path d="M12 0 v16" opacity="${op}"/><circle cx="6" cy="8" r="2.5" opacity="${op}"/><line x1="15" y1="4" x2="22" y2="4" opacity="${op}"/><line x1="15" y1="8" x2="22" y2="8" opacity="${op}"/><line x1="15" y1="12" x2="20" y2="12" opacity="${op}"/>`;
    case 14: return `<line x1="5" y1="0" x2="15" y2="24" opacity="${op}"/><ellipse cx="5" cy="0" rx="5" ry="3" transform="rotate(-15,5,0)" opacity="${op}"/>`;
    case 15: return `<line x1="0" y1="20" x2="0" y2="0" opacity="${op}"/><line x1="8" y1="20" x2="8" y2="0" opacity="${op}"/><line x1="0" y1="5" x2="8" y2="5" opacity="${op}"/><line x1="0" y1="10" x2="8" y2="10" opacity="${op}"/><line x1="0" y1="15" x2="8" y2="15" opacity="${op}"/>`;
    case 16: return `<rect x="0" y="7" width="26" height="11" rx="2" opacity="${op}"/><rect x="4" y="2" width="18" height="7" rx="2" opacity="${op}"/><circle cx="6" cy="19" r="3" opacity="${op}"/><circle cx="20" cy="19" r="3" opacity="${op}"/>`;
    case 17: return `<path d="M7 16 a3 3 0 0 1 6 0" opacity="${op}"/><path d="M3 11 a9 9 0 0 1 14 0" opacity="${op}"/><path d="M0 6 a13 13 0 0 1 20 0" opacity="${op}"/><circle cx="10" cy="18" r="1.5" opacity="${op}"/>`;
    case 18: return `<rect x="0" y="0" width="18" height="24" opacity="${op}"/><line x1="3" y1="5" x2="15" y2="5" opacity="${op}"/><line x1="3" y1="9" x2="15" y2="9" opacity="${op}"/><line x1="3" y1="13" x2="10" y2="13" opacity="${op}"/><line x1="3" y1="18" x2="15" y2="18" opacity="${op}"/>`;
    case 19: return `<circle cx="10" cy="10" r="5" opacity="${op}"/><line x1="10" y1="0" x2="10" y2="-3" opacity="${op}"/><line x1="10" y1="20" x2="10" y2="23" opacity="${op}"/><line x1="0" y1="10" x2="-3" y2="10" opacity="${op}"/><line x1="20" y1="10" x2="23" y2="10" opacity="${op}"/><line x1="3" y1="3" x2="1" y2="1" opacity="${op}"/><line x1="17" y1="3" x2="19" y2="1" opacity="${op}"/>`;
    case 20: return `<rect x="0" y="0" width="22" height="26" opacity="${op}"/><path d="M4 26 v-9 a4 4 0 0 1 8 0 v9" opacity="${op}"/><rect x="14" y="17" width="5" height="9" opacity="${op}"/><rect x="3" y="4" width="4" height="4" opacity="${op}"/><rect x="10" y="4" width="4" height="4" opacity="${op}"/><rect x="3" y="11" width="4" height="4" opacity="${op}"/><rect x="10" y="11" width="4" height="4" opacity="${op}"/>`;
    case 21: return `<rect x="0" y="0" width="24" height="20" opacity="${op}"/><line x1="12" y1="0" x2="12" y2="20" opacity="${op}"/><line x1="0" y1="10" x2="24" y2="10" opacity="${op}"/><rect x="2" y="2" width="8" height="6" opacity="${op}"/><rect x="14" y="12" width="8" height="6" opacity="${op}"/>`;
    default: return "";
  }
}

export default function BgTexture() {
  const { isDark } = useTheme();
  const stroke = isDark ? "#ffffff" : "#1a1a2e";
  const baseOpacity = isDark ? 0.045 : 0.055;

  const icons = useMemo(() => {
    const rand = seeded(2847);
    const W = 1920, H = 1080;
    const RAD = TILT * Math.PI / 180;
    const cosA = Math.cos(-RAD), sinA = Math.sin(-RAD);
    const diag = Math.sqrt(W * W + H * H);
    const cx = W / 2, cy = H / 2;
    // Spacing base con jitter por fila para romper el grid
    const colSpacing = 52;
    const rowSpacing = 44;
    const cols = Math.ceil(diag / colSpacing) + 4;
    const rows = Math.ceil(diag / rowSpacing) + 4;

    const items: string[] = [];
    for (let row = 0; row < rows; row++) {
      // jitter horizontal diferente por fila — rompe la cuadrícula
      const rowJitter = (rand() - 0.5) * 28;
      for (let col = 0; col < cols; col++) {
        // posición en espacio rotado
        const lx = -diag / 2 + col * colSpacing + rowJitter + (rand() - 0.5) * 14;
        const ly = -diag / 2 + row * rowSpacing + (rand() - 0.5) * 10;
        // rotar al espacio de pantalla
        const sx = cx + lx * cosA - ly * sinA;
        const sy = cy + lx * sinA + ly * cosA;
        const iconType = Math.floor(rand() * 22);
        const op = 0.6 + rand() * 0.4; // variación sutil de opacidad por icono
        items.push(
          `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)}) rotate(${TILT})">${getIcon(iconType, parseFloat(op.toFixed(2)))}</g>`
        );
      }
    }
    return items.join("");
  }, []);

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        fill="none"
        stroke={stroke}
        strokeWidth="1.05"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={baseOpacity}
        dangerouslySetInnerHTML={{ __html: icons }}
      />
    </svg>
  );
}
