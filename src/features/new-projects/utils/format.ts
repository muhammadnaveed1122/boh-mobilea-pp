import { unitPriceLabel } from '@/features/properties/utils/web-format';
import type { PublicProjectListItem } from '../types';

/**
 * Compact AED price. Delegates to the web-parity formatter so project cards read
 * identically to the website (e.g. 8500 → "AED 8.5K", not "AED 9K").
 */
export function formatAed(value: number | undefined): string {
  return unitPriceLabel(value);
}

function toNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  return Number.isNaN(n) ? 0 : n;
}

export function parsePrice(item: {
  publicStartingPrice?: string | number | null;
  startingPrice?: string | number | null;
  listings?: { price?: number | null }[];
}): number {
  const pub = toNumber(item.publicStartingPrice);
  if (pub > 0) return pub;
  const starting = toNumber(item.startingPrice);
  if (starting > 0) return starting;
  const listingPrices = (item.listings ?? []).map((l) => toNumber(l.price)).filter((n) => n > 0);
  if (listingPrices.length === 0) return 0;
  return Math.min(...listingPrices);
}

export function primaryImage(item: PublicProjectListItem | undefined): string | undefined {
  if (!item) return undefined;
  if (item.heroPrimaryImageUrl) return item.heroPrimaryImageUrl;
  const first = item.heroImageUrl?.[0]?.img_url;
  return first ?? undefined;
}

export function locationLabel(item: PublicProjectListItem): string {
  return item.locationLine || [item.neighborhood, item.city].filter(Boolean).join(', ');
}

export function statusLabel(availability: string | undefined): 'Ready' | 'Off-Plan' | null {
  if (availability === 'ready') return 'Ready';
  if (availability === 'off_plan') return 'Off-Plan';
  return null;
}

export function propertyTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatAedExact(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value) || value <= 0)
    return 'Price on request';
  return `AED ${value.toLocaleString('en-AE')}`;
}

export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const a = typeof min === 'number' && min > 0 ? min : null;
  const b = typeof max === 'number' && max > 0 ? max : null;
  if (!a && !b) return 'Price on request';
  if (a && b && a !== b) return `${formatAed(a)} – ${formatAed(b)}`;
  return formatAed(a ?? b ?? 0);
}

export function formatSizeRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const a = typeof min === 'number' && min > 0 ? min : null;
  const b = typeof max === 'number' && max > 0 ? max : null;
  if (!a && !b) return '—';
  if (a && b && a !== b) return `${a.toLocaleString()} – ${b.toLocaleString()} sqft`;
  return `${(a ?? b ?? 0).toLocaleString()} sqft`;
}

export function bedroomLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const map: Record<string, string> = {
    studio: 'Studio',
    one_br: '1 Bedroom',
    two_br: '2 Bedrooms',
    three_br: '3 Bedrooms',
    four_br: '4 Bedrooms',
    five_br: '5 Bedrooms',
    six_br: '6 Bedrooms',
    seven_br: '7 Bedrooms',
    eight_br: '8+ Bedrooms',
  };
  return map[value] ?? propertyTypeLabel(value);
}
