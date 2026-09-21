/**
 * Fixed brand-navy gradient. Theme-independent on purpose — chat chrome
 * (header, details screen) must stay dark in both light and dark mode (the
 * `--brand` token inverts to near-white in dark theme).
 */
export const NAVY_GRADIENT = ['#0B1220', '#101827', '#1F2A44'] as const;
