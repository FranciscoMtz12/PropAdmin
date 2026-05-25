"use client";

import { useTheme } from "@/contexts/ThemeContext";

/** Returns the current font scale and a grid helper for adaptive layouts. */
export function useFontScale() {
  const { fontScale } = useTheme();

  /** Columns for a 3-column grid: drops to 2 at L/XL scale */
  const cols3 = fontScale >= 1.20 ? 2 : 3;

  /** Columns for a 2-column grid: drops to 1 at XL scale */
  const cols2 = fontScale >= 1.40 ? 1 : 2;

  return { fontScale, cols3, cols2 };
}
