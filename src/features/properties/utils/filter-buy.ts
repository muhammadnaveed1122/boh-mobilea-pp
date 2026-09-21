import type { PropertyCard } from '../types';

export type BuyStatus = 'all' | 'Ready' | 'Off-Plan';

export interface BuyFilters {
  search?: string;
  status?: BuyStatus;
  propertyType?: string;
  beds?: string[];
  baths?: string[];
  /** City name (matched against the card location). */
  city?: string;
  /** Price range token, e.g. "1000000-2000000" or "5000000+". */
  priceRange?: string;
}

function normalizeType(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replaceAll('-', '_');
}

function bedsMatch(beds: number | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (beds === undefined) return false;
  return selected.some((s) => {
    if (s === 'studio') return beds === 0;
    if (s === '5br+') return beds >= 5;
    if (s === 'penthouse') return false;
    const n = Number.parseInt(s, 10);
    return !Number.isNaN(n) && beds === n;
  });
}

function bathsMatch(baths: number | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (baths === undefined) return false;
  return selected.some((s) => {
    if (s === '5+') return baths >= 5;
    if (s === '7+') return baths >= 7;
    const n = Number.parseInt(s, 10);
    return !Number.isNaN(n) && baths === n;
  });
}

function priceMatch(price: number | undefined, range: string | undefined): boolean {
  if (!range || range === 'all') return true;
  if (price === undefined) return false;
  if (range.endsWith('+')) return price >= Number.parseInt(range, 10);
  const [min, max] = range.split('-').map((n) => Number.parseInt(n, 10));
  return price >= min && price <= max;
}

function searchMatch(card: PropertyCard, query: string): boolean {
  if (!query) return true;
  const haystack = [card.title, card.location, card.propertyType].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function filterBuyCards(cards: PropertyCard[], filters: BuyFilters): PropertyCard[] {
  const search = filters.search?.trim() ?? '';
  const propertyType =
    filters.propertyType && filters.propertyType !== 'all' ? filters.propertyType : undefined;
  const city = filters.city && filters.city !== 'all' ? filters.city.toLowerCase() : undefined;
  const beds = filters.beds ?? [];
  const baths = filters.baths ?? [];

  return cards.filter((card) => {
    if (!searchMatch(card, search)) return false;
    if (filters.status && filters.status !== 'all' && card.badge !== filters.status) return false;
    if (propertyType && normalizeType(card.propertyType) !== normalizeType(propertyType))
      return false;
    if (city && !(card.location ?? '').toLowerCase().includes(city)) return false;
    if (!bedsMatch(card.beds, beds)) return false;
    if (!bathsMatch(card.baths, baths)) return false;
    if (!priceMatch(card.priceValue, filters.priceRange)) return false;
    return true;
  });
}

export function countActiveBuyFilters(f: BuyFilters): number {
  let n = 0;
  if (f.status && f.status !== 'all') n += 1;
  if (f.propertyType && f.propertyType !== 'all') n += 1;
  n += f.beds?.length ?? 0;
  n += f.baths?.length ?? 0;
  if (f.city && f.city !== 'all') n += 1;
  if (f.priceRange && f.priceRange !== 'all') n += 1;
  return n;
}
