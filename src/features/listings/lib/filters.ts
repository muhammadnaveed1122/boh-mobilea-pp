import type { ListingPortal } from '../types';

/** Public-page status options (mirrors web; excludes re_review). '' = all. */
export const STATUS_FILTER_OPTIONS: readonly { label: string; value: string }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Review', value: 'in_review' },
  { label: 'Changes Requested', value: 'changes_requested' },
  { label: 'Approved', value: 'approved' },
  { label: 'Published', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Archived', value: 'archived' },
];

/** Room pills. value is the bedroom count as a string; '4' means 4+. */
export const ROOM_PILLS: readonly { label: string; value: string }[] = [
  { label: 'Studio', value: '0' },
  { label: '1 Bed', value: '1' },
  { label: '2 Beds', value: '2' },
  { label: '3 Beds', value: '3' },
  { label: '4+ Beds', value: '4' },
];

/** Price buckets. value is the encoded range; min/max are inclusive bounds. */
export const PRICE_OPTIONS: readonly {
  label: string;
  value: string;
  min?: number;
  max?: number;
}[] = [
  { label: 'Any price', value: '' },
  { label: 'Up to 500K', value: '0-500000', min: 0, max: 500_000 },
  { label: '500K – 1M', value: '500000-1000000', min: 500_000, max: 1_000_000 },
  { label: '1M – 2M', value: '1000000-2000000', min: 1_000_000, max: 2_000_000 },
  { label: '2M – 5M', value: '2000000-5000000', min: 2_000_000, max: 5_000_000 },
  { label: '5M+', value: '5000000-', min: 5_000_000 },
];

export const PORTAL_META: Record<ListingPortal, { mark: string; label: string; bg: string }> = {
  property_finder: { mark: 'PF', label: 'Property Finder', bg: '#ef4444' },
  bayut: { mark: 'BY', label: 'Bayut', bg: '#2563eb' },
  dubizzle: { mark: 'DZ', label: 'Dubizzle', bg: '#e11d48' },
  whatsapp: { mark: 'WA', label: 'WhatsApp', bg: '#16a34a' },
};

export const PORTAL_ORDER: readonly ListingPortal[] = [
  'property_finder',
  'bayut',
  'dubizzle',
  'whatsapp',
];
