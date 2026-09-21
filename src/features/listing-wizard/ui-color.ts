/**
 * `useThemeColor` returns modern space-separated `rgb(r g b)`, which
 * react-native-svg (lucide icons) doesn't parse. Normalize to the comma form
 * `rgb(r, g, b)` — same technique the Button atom uses for its spinner color.
 */
export function normalizeRgb(value: string): string {
  const match = /rgb\(([^)]+)\)/i.exec(value);
  if (!match) return value;
  const parts = match[1].split(/[\s,]+/).filter(Boolean);
  return `rgb(${parts.join(', ')})`;
}
