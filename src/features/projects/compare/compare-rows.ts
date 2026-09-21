import type { CompareProject } from '../services';

const DASH = '—';

export type CompareSection = 'key_facts' | 'inventory';

export interface CompareRow {
  readonly key: string;
  readonly label: string;
  readonly section: CompareSection;
  /** Cell value: `raw` drives best-value math, `display` is shown. */
  readonly value: (p: CompareProject) => { raw: number | string | null; display: string };
  /** Optional best-column highlight strategy. */
  readonly best?: 'min' | 'earliest';
  readonly bestTag?: string;
}

function titleCase(raw: string | null): string {
  if (!raw) return DASH;
  return raw.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(value: number | null): { raw: number | null; display: string } {
  return value === null
    ? { raw: null, display: DASH }
    : { raw: value, display: `AED ${value.toLocaleString()}` };
}

function text(value: string | null): { raw: string | null; display: string } {
  const trimmed = value?.trim();
  return trimmed ? { raw: trimmed, display: trimmed } : { raw: null, display: DASH };
}

function count(n: number, noun: string): { raw: number | null; display: string } {
  return n > 0 ? { raw: n, display: `${n} ${noun}` } : { raw: null, display: DASH };
}

export const SECTIONS: { key: CompareSection; title: string }[] = [
  { key: 'key_facts', title: 'Key Facts' },
  { key: 'inventory', title: 'Inventory' },
];

export const COMPARE_ROWS: CompareRow[] = [
  {
    key: 'startingPrice',
    label: 'Starting price',
    section: 'key_facts',
    value: (p) => money(p.startingPrice),
    best: 'min',
    bestTag: 'Lowest',
  },
  {
    key: 'bookingFee',
    label: 'Booking fee',
    section: 'key_facts',
    value: (p) => money(p.bookingFee),
  },
  {
    key: 'availability',
    label: 'Availability',
    section: 'key_facts',
    value: (p) => ({ raw: p.availability, display: titleCase(p.availability) }),
  },
  {
    key: 'constructionStage',
    label: 'Construction stage',
    section: 'key_facts',
    value: (p) => ({ raw: p.developmentStage, display: titleCase(p.developmentStage) }),
  },
  {
    key: 'handover',
    label: 'Handover',
    section: 'key_facts',
    value: (p) => text(p.handoverDate),
    best: 'earliest',
    bestTag: 'Soonest',
  },
  { key: 'location', label: 'Location', section: 'key_facts', value: (p) => text(p.location) },
  { key: 'developer', label: 'Developer', section: 'key_facts', value: (p) => text(p.developer) },
  {
    key: 'lifestyleTier',
    label: 'Lifestyle tier',
    section: 'key_facts',
    value: (p) => ({ raw: p.lifestyleTier, display: titleCase(p.lifestyleTier) }),
  },
  {
    key: 'propertyUse',
    label: 'Property use',
    section: 'key_facts',
    value: (p) => ({ raw: p.propertyUse, display: titleCase(p.propertyUse) }),
  },
  {
    key: 'unitTypes',
    label: 'Unit types',
    section: 'inventory',
    value: (p) => count(p.unitTypes.length, 'types'),
  },
  {
    key: 'floorPlans',
    label: 'Floor plans',
    section: 'inventory',
    value: (p) => count(p.floorPlans.length, 'floor plans'),
  },
  {
    key: 'amenities',
    label: 'Amenities',
    section: 'inventory',
    value: (p) => count(p.amenities.length, 'amenities'),
  },
  {
    key: 'paymentPlans',
    label: 'Payment plans',
    section: 'inventory',
    value: (p) => count(p.paymentPlans.length, 'plans'),
  },
];

/**
 * Comparable score for a handover string. Handles "Q1 2020" quarters, ISO/parseable
 * dates, and bare years — all normalized to `year*4 + quarter` so they rank together.
 */
function handoverScore(raw: string): number | null {
  const q = /Q([1-4])\D*(\d{4})/i.exec(raw);
  if (q) return Number(q[2]) * 4 + (Number(q[1]) - 1);
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.getFullYear() * 4 + Math.floor(d.getMonth() / 3);
  }
  const year = /(\d{4})/.exec(raw);
  return year ? Number(year[1]) * 4 : null;
}

/**
 * Index of the winning column for a row, or -1 when no single winner (no `best`
 * strategy, all values empty, or a tie). Ties never highlight to avoid misleading.
 */
export function bestColumnIndex(row: CompareRow, projects: CompareProject[]): number {
  if (!row.best) return -1;
  const scores = projects.map((p) => {
    const { raw } = row.value(p);
    if (row.best === 'min') return typeof raw === 'number' ? raw : null;
    // 'earliest': normalize the handover string to a comparable score
    return typeof raw === 'string' ? handoverScore(raw) : null;
  });
  let bestIdx = -1;
  let bestVal = Number.POSITIVE_INFINITY;
  let tie = false;
  scores.forEach((s, i) => {
    if (s === null) return;
    if (s < bestVal) {
      bestVal = s;
      bestIdx = i;
      tie = false;
    } else if (s === bestVal) {
      tie = true;
    }
  });
  return tie ? -1 : bestIdx;
}
