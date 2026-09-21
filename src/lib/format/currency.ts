/**
 * Format a number as an AED currency string (e.g. `"AED 500,000"`).
 *
 * Returns an empty string for `undefined` / `null` / `NaN` so callers can pipe
 * potentially-empty form values through this helper without extra guards.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '';
  }
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value);
}
