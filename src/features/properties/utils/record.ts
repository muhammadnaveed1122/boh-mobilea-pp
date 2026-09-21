// Defensive readers for loosely-typed backend payloads (opportunity-listing
// `sections` / `media` arrive as `unknown` records).

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replaceAll(/[^\d.]/g, ''));
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** Parse an integer count (digits only) — for bedrooms/bathrooms stored as strings. */
export function asCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replaceAll(/\D/g, ''), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function isHttpUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}
