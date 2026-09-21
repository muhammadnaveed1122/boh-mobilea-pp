export interface FilterOption {
  value: string;
  label: string;
}

export const PROPERTY_TYPE_OPTIONS: FilterOption[] = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'residential_plot', label: 'Residential Plot' },
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'commercial_plot', label: 'Commercial Plot' },
];

export const PROPERTY_TYPE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Types' },
  ...PROPERTY_TYPE_OPTIONS,
];

export const BEDS_MULTI_OPTIONS: FilterOption[] = [
  { value: '1br', label: '1BR' },
  { value: '2br', label: '2BR' },
  { value: '3br', label: '3BR' },
  { value: '4br', label: '4BR' },
  { value: '5br', label: '5BR' },
  { value: '5br+', label: '5BR+' },
  { value: 'studio', label: 'Studio' },
  { value: 'penthouse', label: 'Penthouse' },
];

export const BATH_MULTI_OPTIONS: FilterOption[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '5+', label: '5+' },
  { value: '7+', label: '7+' },
];

export const PRICE_RANGE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'Any Price' },
  { value: '0-500000', label: 'Under AED 500K' },
  { value: '500000-1000000', label: 'AED 500K - 1M' },
  { value: '1000000-2000000', label: 'AED 1M - 2M' },
  { value: '2000000-5000000', label: 'AED 2M - 5M' },
  { value: '5000000+', label: 'Above AED 5M' },
];

const HANDOVER_START_YEAR = 2025;
const HANDOVER_END_YEAR = 2050;
const QUARTERS = ['q1', 'q2', 'q3', 'q4'] as const;

function buildHandoverOptions(): FilterOption[] {
  const options: FilterOption[] = [{ value: 'all', label: 'Any Handover' }];
  for (let year = HANDOVER_START_YEAR; year <= HANDOVER_END_YEAR; year += 1) {
    for (const q of QUARTERS) {
      options.push({
        value: `before-${q}-${String(year)}`,
        label: `Before ${q.toUpperCase()} ${String(year)}`,
      });
    }
  }
  return options;
}
export const HANDOVER_OPTIONS = buildHandoverOptions();

export const STATUS_OPTIONS: { value: 'all' | 'Ready' | 'Off-Plan'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Ready', label: 'Ready' },
  { value: 'Off-Plan', label: 'Off-Plan' },
];

export function getPropertyTypeLabel(value: string | undefined): string {
  if (!value) return '';
  const match = PROPERTY_TYPE_OPTIONS.find((o) => o.value === value.toLowerCase());
  if (match) return match.label;
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
