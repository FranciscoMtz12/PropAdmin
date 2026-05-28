"use client";

import { useTheme } from "@/contexts/ThemeContext";

/** Returns fontScale + adaptive column counts for grids. */
export function useFontScale() {
  const { fontScale } = useTheme();

  /** Columns for a 3-column grid: drops to 2 at L/XL scale */
  const cols3 = fontScale >= 1.20 ? 2 : 3;

  /** Columns for a 2-column grid: drops to 1 at XL scale */
  const cols2 = fontScale >= 1.40 ? 1 : 2;

  return { fontScale, cols3, cols2 };
}

/** Returns an icon pixel size scaled to the current font-scale. */
export function useIconSize(base: number): number {
  const { fontScale } = useFontScale();
  return Math.round(base * fontScale);
}
