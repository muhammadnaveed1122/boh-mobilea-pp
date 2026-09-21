import type { Opt } from './types';

export const COMPLETION_STATUS_OPTIONS: readonly Opt[] = [
  { value: 'ready_primary', label: 'Ready Primary' },
  { value: 'off_plan_primary', label: 'Off-plan Primary' },
  { value: 'ready_secondary', label: 'Ready Secondary' },
  { value: 'off_plan_secondary', label: 'Off-plan Secondary' },
];

export const PURPOSE_OPTIONS: readonly Opt[] = [
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'For Rent' },
];
export const PURPOSE_OPTIONS_SALE_ONLY: readonly Opt[] = [{ value: 'sale', label: 'For Sale' }];

/** Grouped property types (mixed_use excluded, per web). */
export const PROPERTY_TYPE_GROUPS: readonly { title: string; options: readonly Opt[] }[] = [
  {
    title: 'Residential',
    options: [
      { value: 'apartment', label: 'Apartment' },
      { value: 'villa', label: 'Villa' },
      { value: 'townhouse', label: 'Townhouse' },
      { value: 'residential_plot', label: 'Residential Plot' },
    ],
  },
  {
    title: 'Commercial',
    options: [
      { value: 'office', label: 'Office' },
      { value: 'retail', label: 'Retail' },
      { value: 'warehouse', label: 'Warehouse' },
      { value: 'commercial_plot', label: 'Commercial Plot' },
    ],
  },
];

/** propertyUse derived from a propertyType's group. */
export const PROPERTY_USE_BY_TYPE: Record<string, 'residential' | 'commercial'> = {
  apartment: 'residential',
  villa: 'residential',
  townhouse: 'residential',
  residential_plot: 'residential',
  office: 'commercial',
  retail: 'commercial',
  warehouse: 'commercial',
  commercial_plot: 'commercial',
};

export const UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE: Record<string, readonly Opt[]> = {
  apartment: [
    { value: 'studio', label: 'Studio' },
    { value: 'one_br', label: '1BR' },
    { value: 'two_br', label: '2BR' },
    { value: 'three_br', label: '3BR' },
    { value: 'four_br', label: '4BR' },
    { value: 'five_br', label: '5BR' },
    { value: 'six_br_plus', label: '6BR+' },
    { value: 'penthouse', label: 'Penthouse' },
  ],
  villa: [
    { value: 'three_br', label: '3BR' },
    { value: 'four_br', label: '4BR' },
    { value: 'five_br', label: '5BR' },
    { value: 'six_br_plus', label: '6BR+' },
    { value: 'mansion', label: 'Mansion' },
  ],
  townhouse: [
    { value: 'two_br', label: '2BR' },
    { value: 'three_br', label: '3BR' },
    { value: 'four_br', label: '4BR' },
    { value: 'five_br', label: '5BR' },
  ],
  residential_plot: [{ value: 'residential_plot', label: 'Residential Plot' }],
  office: [
    { value: 'shell_core', label: 'Shell & Core' },
    { value: 'fitted', label: 'Fitted' },
    { value: 'furnished', label: 'Furnished' },
    { value: 'full_floor', label: 'Full Floor' },
  ],
  retail: [
    { value: 'retail_unit', label: 'Retail Unit' },
    { value: 'fnb_unit', label: 'F&B Unit' },
    { value: 'kiosk', label: 'Kiosk' },
  ],
  warehouse: [{ value: 'warehouse', label: 'Warehouse' }],
  commercial_plot: [{ value: 'commercial_plot', label: 'Commercial Plot' }],
};

export const FURNISHING_OPTIONS: readonly Opt[] = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'semi_furnished', label: 'Semi Furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
];

export const VIEW_OPTIONS: readonly Opt[] = [
  { value: 'sea_view', label: 'Sea View' },
  { value: 'city_view', label: 'City View' },
  { value: 'garden_view', label: 'Garden View' },
  { value: 'pool_view', label: 'Pool View' },
  { value: 'canal_view', label: 'Canal View' },
  { value: 'golf_view', label: 'Golf View' },
  { value: 'landmark_view', label: 'Landmark View' },
  { value: 'community_view', label: 'Community View' },
  { value: 'park_view', label: 'Park View' },
  { value: 'marina_view', label: 'Marina View' },
  { value: 'boulevard_view', label: 'Boulevard View' },
  { value: 'other', label: 'Other' },
];

const AVAILABILITY_BASE: readonly Opt[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'off_market', label: 'Off Market' },
  { value: 'unavailable', label: 'Unavailable' },
];
export const AVAILABILITY_OPTIONS: readonly Opt[] = [
  ...AVAILABILITY_BASE,
  { value: 'sold', label: 'Sold' },
];
export const AVAILABILITY_OPTIONS_RENT: readonly Opt[] = [
  ...AVAILABILITY_BASE,
  { value: 'rented', label: 'Rented' },
];

export const GENDER_OPTIONS: readonly Opt[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const OWNER_SOURCE_OPTIONS: readonly Opt[] = [
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'portal', label: 'Portal' },
  { value: 'cold_call', label: 'Cold call' },
  { value: 'other', label: 'Other' },
];

export const SPOKEN_LANGUAGE_OPTIONS: readonly Opt[] = [
  'English',
  'Arabic',
  'Hindi',
  'Urdu',
  'French',
  'Spanish',
  'Russian',
  'Mandarin',
  'German',
  'Italian',
  'Portuguese',
  'Tagalog',
  'Bengali',
  'Persian',
  'Turkish',
  'Malayalam',
  'Tamil',
  'Punjabi',
].map((l) => ({ value: l, label: l }));

export const RENT_PRICE_TYPE_OPTIONS: readonly Opt[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

const RENT_PRICE_TYPE_LABELS: Record<string, string> = {
  year: 'Year',
  month: 'Month',
  week: 'Week',
  day: 'Day',
};
const DEFAULT_RENT_PRICE_TYPE = 'year';

/** Unit suffix shown next to the rent Price field, e.g. "AED/Year". Falls back to the
 * default cadence for an empty/unknown type so the label never reads "AED/undefined". */
export function rentPriceUnitLabel(priceType: string): string {
  const label =
    RENT_PRICE_TYPE_LABELS[priceType] ?? RENT_PRICE_TYPE_LABELS[DEFAULT_RENT_PRICE_TYPE];
  return `AED/${label}`;
}

/** Max cheques accepted for a rent payment plan (1–12). Stored as a string. */
export const MAX_CHEQUES_OPTIONS: readonly Opt[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export const MORTGAGE_STATUS_OPTIONS: readonly Opt[] = [
  { value: 'mortgaged', label: 'Mortgaged' },
  { value: 'no_mortgage', label: 'No mortgage' },
];

export const OCCUPANCY_OPTIONS: readonly Opt[] = [
  { value: 'owner_occupied', label: 'Owner Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'rented', label: 'Rented' },
];

/** ISO alpha-2 nationality list (ported from web nationalityOptions.ts). */
export const NATIONALITY_OPTIONS: readonly Opt[] = [
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'QA', label: 'Qatar' },
  { value: 'KW', label: 'Kuwait' },
  { value: 'BH', label: 'Bahrain' },
  { value: 'OM', label: 'Oman' },
  { value: 'IN', label: 'India' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'LK', label: 'Sri Lanka' },
  { value: 'PH', label: 'Philippines' },
  { value: 'EG', label: 'Egypt' },
  { value: 'JO', label: 'Jordan' },
  { value: 'LB', label: 'Lebanon' },
  { value: 'SY', label: 'Syria' },
  { value: 'IQ', label: 'Iraq' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'RU', label: 'Russia' },
  { value: 'CN', label: 'China' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'AU', label: 'Australia' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'KE', label: 'Kenya' },
  { value: 'TR', label: 'Turkey' },
  { value: 'IR', label: 'Iran' },
  { value: 'AF', label: 'Afghanistan' },
  { value: 'NP', label: 'Nepal' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'TH', label: 'Thailand' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MA', label: 'Morocco' },
  { value: 'DZ', label: 'Algeria' },
  { value: 'TN', label: 'Tunisia' },
  { value: 'SD', label: 'Sudan' },
  { value: 'YE', label: 'Yemen' },
  { value: 'PS', label: 'Palestine' },
];
