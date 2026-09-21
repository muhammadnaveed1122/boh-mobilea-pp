/**
 * Enum → display-label helpers, ported from web
 * (boh-lead-magnet features/projects/constants). Kept as plain maps + a
 * title-case fallback so the mobile detail screen renders the same labels.
 */
const UNIT_TYPE_LABELS: Record<string, string> = {
  studio: 'Studio',
  one_br: '1BR',
  two_br: '2BR',
  three_br: '3BR',
  four_br: '4BR',
  five_br: '5BR',
  six_br_plus: '6BR+',
  penthouse: 'Penthouse',
  mansion: 'Mansion',
  residential_plot: 'Residential Plot',
  shell_core: 'Shell & Core',
  fitted: 'Fitted',
  furnished: 'Furnished',
  full_floor: 'Full Floor',
  retail_unit: 'Retail Unit',
  fnb_unit: 'F&B Unit',
  kiosk: 'Kiosk',
  warehouse: 'Warehouse',
  commercial_plot: 'Commercial Plot',
};

const VIEW_TYPE_LABELS: Record<string, string> = {
  not_specified: 'Not Specified',
  sea_view: 'Sea View',
  city_view: 'City View',
  garden_view: 'Garden View',
  pool_view: 'Pool View',
  golf_view: 'Golf View',
  park_view: 'Park View',
};

const DEVELOPMENT_STAGE_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  launched: 'Launched',
  under_construction: 'Under Construction',
  handed_over: 'Handed Over',
};

/** `residential_plot` → "Residential Plot", `under_construction` → "Under Construction". */
export function titleCase(value: string | null | undefined): string {
  if (!value || value.trim() === '') return '—';
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function getUnitTypeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return UNIT_TYPE_LABELS[value] ?? titleCase(value);
}

export function getViewTypeLabel(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  return VIEW_TYPE_LABELS[value] ?? titleCase(value);
}

export function getDevelopmentStageLabel(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  return DEVELOPMENT_STAGE_LABELS[value] ?? titleCase(value);
}

/** Quarter strings ("Q1 2026") pass through; ISO dates collapse to their quarter. */
export function getHandoverDateLabel(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();
  const quarter = /^q([1-4])\s+(\d{4})$/i.exec(trimmed);
  if (quarter) return `Q${quarter[1]} ${quarter[2]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const q = Math.floor(parsed.getMonth() / 3) + 1;
  return `Q${q} ${parsed.getFullYear()}`;
}

const BEDROOM_HIDE_PROPERTY_TYPES = new Set([
  'residential_plot',
  'commercial_plot',
  'office',
  'retail',
  'warehouse',
]);
const BEDROOM_HIDE_UNIT_TYPES = new Set([
  'residential_plot',
  'commercial_plot',
  'shell_core',
  'fitted',
  'furnished',
  'full_floor',
  'retail_unit',
  'fnb_unit',
  'kiosk',
  'warehouse',
]);
const BATHROOM_HIDE_PROPERTY_TYPES = new Set(['residential_plot', 'commercial_plot', 'warehouse']);
const BATHROOM_HIDE_UNIT_TYPES = new Set(['residential_plot', 'commercial_plot', 'warehouse']);

function normalizeKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replaceAll(/\s+/g, '_') ?? '';
}

export function shouldHideBedrooms(
  propertyType?: string | null,
  unitType?: string | null,
): boolean {
  const pt = normalizeKey(propertyType);
  if (pt !== '' && BEDROOM_HIDE_PROPERTY_TYPES.has(pt)) return true;
  const ut = normalizeKey(unitType);
  return ut !== '' && BEDROOM_HIDE_UNIT_TYPES.has(ut);
}

export function shouldHideBathrooms(
  propertyType?: string | null,
  unitType?: string | null,
): boolean {
  const pt = normalizeKey(propertyType);
  if (pt !== '' && BATHROOM_HIDE_PROPERTY_TYPES.has(pt)) return true;
  const ut = normalizeKey(unitType);
  return ut !== '' && BATHROOM_HIDE_UNIT_TYPES.has(ut);
}
