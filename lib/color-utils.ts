/* HSL-based color utilities for metallic gradient generation — no external libs */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) return [0.54, 0.13, 0.32]; // fallback: #8B2252
  return [
    parseInt(clean.substring(0, 2), 16) / 255,
    parseInt(clean.substring(2, 4), 16) / 255,
    parseInt(clean.substring(4, 6), 16) / 255,
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const hn = h / 360;

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (sn === 0) {
    r = g = b = ln;
  } else {
    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;
    r = hue2rgb(p, q, hn + 1 / 3);
    g = hue2rgb(p, q, hn);
    b = hue2rgb(p, q, hn - 1 / 3);
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function generateMetallicGradient(hex: string): string {
  if (!hex?.startsWith("#") || hex.length < 7)
    return `linear-gradient(135deg, ${hex ?? "#8B2252"} 0%, ${hex ?? "#8B2252"} 100%)`;
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const highlight = hslToHex(h, Math.max(0, s - 10), Math.min(95, l + 18));
  const shadow    = hslToHex(h, Math.min(100, s + 5), Math.max(5, l - 14));
  return `linear-gradient(135deg, ${highlight} 0%, ${hex} 45%, ${shadow} 100%)`;
}

export function generateMetallicGradientHover(hex: string): string {
  if (!hex?.startsWith("#") || hex.length < 7)
    return `linear-gradient(135deg, ${hex ?? "#8B2252"} 0%, ${hex ?? "#8B2252"} 100%)`;
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const highlight = hslToHex(h, Math.max(0, s - 8), Math.min(95, l + 22));
  const mid       = hslToHex(h, s, Math.min(95, l + 4));
  const shadow    = hslToHex(h, Math.min(100, s + 3), Math.max(5, l - 10));
  return `linear-gradient(135deg, ${highlight} 0%, ${mid} 45%, ${shadow} 100%)`;
}
