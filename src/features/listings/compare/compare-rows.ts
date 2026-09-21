import { formatCurrency } from '@/lib/format/currency';

import type { UnifiedListingRow } from '../types';

const DASH = '—';

export type CompareSection = 'key_facts' | 'amenities';

export interface CompareRow {
  readonly key: string;
  readonly label: string;
  readonly section: CompareSection;
  /** Cell value: `raw` drives best-value math, `display` is shown. */
  readonly value: (row: UnifiedListingRow) => { raw: number | string | null; display: string };
  /** Optional best-column highlight strategy. */
  readonly best?: 'min' | 'max';
  readonly bestTag?: string;
}

function titleCase(raw: string | null | undefined): string {
  if (!raw) return DASH;
  return raw.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function text(value: string | null | undefined): { raw: string | null; display: string } {
  const trimmed = value?.trim();
  return trimmed ? { raw: trimmed, display: trimmed } : { raw: null, display: DASH };
}

function num(
  value: number | null | undefined,
  suffix = '',
): { raw: number | null; display: string } {
  return Number.isFinite(value)
    ? { raw: value as number, display: `${value}${suffix}` }
    : { raw: null, display: DASH };
}

export const SECTIONS: { key: CompareSection; title: string }[] = [
  { key: 'key_facts', title: 'Key Facts' },
  { key: 'amenities', title: 'Amenities' },
];

export const COMPARE_ROWS: CompareRow[] = [
  {
    key: 'transaction',
    label: 'Transaction',
    section: 'key_facts',
    value: (r) => {
      const isRent = r.purpose === 'for_rent' || r.purpose === 'rent';
      return { raw: r.purpose ?? null, display: isRent ? 'For Rent' : 'For Sale' };
    },
  },
  {
    key: 'price',
    label: 'Price',
    section: 'key_facts',
    value: (r) => {
      if (!Number.isFinite(r.price)) return { raw: null, display: DASH };
      const isRent = r.purpose === 'for_rent' || r.purpose === 'rent';
      const money = formatCurrency(r.price);
      return { raw: r.price as number, display: isRent ? `${money}/yr` : money };
    },
    best: 'min',
    bestTag: 'Lowest',
  },
  {
    key: 'size',
    label: 'Size',
    section: 'key_facts',
    value: (r) =>
      Number.isFinite(r.sizeSqft)
        ? { raw: r.sizeSqft as number, display: `${(r.sizeSqft as number).toLocaleString()} sqft` }
        : { raw: null, display: DASH },
    best: 'max',
    bestTag: 'Largest',
  },
  {
    key: 'propertyType',
    label: 'Property type',
    section: 'key_facts',
    value: (r) => ({ raw: r.propertyType ?? null, display: titleCase(r.propertyType) }),
  },
  { key: 'bedrooms', label: 'Bedrooms', section: 'key_facts', value: (r) => num(r.bedrooms) },
  { key: 'bathrooms', label: 'Bathrooms', section: 'key_facts', value: (r) => num(r.bathrooms) },
  { key: 'location', label: 'Location', section: 'key_facts', value: (r) => text(r.location) },
  {
    key: 'property',
    label: 'Project / Property',
    section: 'key_facts',
    value: (r) => text(r.projectName ?? r.propertyLabel),
  },
  {
    key: 'developer',
    label: 'Developer',
    section: 'key_facts',
    value: (r) => text(r.developerName),
  },
  {
    // The screen renders amenity chips from hydrated data; this display is the
    // fallback text (also used by the diff-only filter as a stable string).
    key: 'amenities',
    label: 'Amenities',
    section: 'amenities',
    value: () => ({ raw: null, display: DASH }),
  },
];

/**
 * Index of the winning column for a row, or -1 when no single winner (no `best`
 * strategy, all values empty, or a tie). Ties never highlight to avoid misleading.
 */
export function bestColumnIndex(row: CompareRow, rows: UnifiedListingRow[]): number {
  if (!row.best) return -1;
  const scores = rows.map((r) => {
    const { raw } = row.value(r);
    return typeof raw === 'number' ? raw : null;
  });
  let bestIdx = -1;
  let bestVal = row.best === 'min' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  let tie = false;
  scores.forEach((s, i) => {
    if (s === null) return;
    const better = row.best === 'min' ? s < bestVal : s > bestVal;
    if (better) {
      bestVal = s;
      bestIdx = i;
      tie = false;
    } else if (s === bestVal) {
      tie = true;
    }
  });
  return tie ? -1 : bestIdx;
}
