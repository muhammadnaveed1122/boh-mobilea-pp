import type { PublicProjectsQuery } from '../types';

const BEDS_TO_UNIT_TYPE: Record<string, string> = {
  '1br': 'one_br',
  '2br': 'two_br',
  '3br': 'three_br',
  '4br': 'four_br',
  '5br': 'five_br',
  '5br+': 'five_br_plus',
  studio: 'studio',
  penthouse: 'penthouse',
};

function mapBedsToUnitType(beds: string[] | undefined): string | undefined {
  if (!beds || beds.length === 0) return undefined;
  // backend accepts single unitType enum — send first selected (mirrors web single-select fallback).
  // For multi-select parity we comma-join; server will ignore extras but URL reflects choice.
  const mapped = beds.map((b) => BEDS_TO_UNIT_TYPE[b] ?? b);
  return mapped.join(',');
}

function mapHandoverToApiFormat(handover: string | undefined): string | undefined {
  if (!handover || handover === 'all') return undefined;
  const match = /^before-(q\d)-(\d{4})$/.exec(handover);
  if (!match) return undefined;
  const [, quarter, year] = match;
  return `BEFORE ${quarter.toUpperCase()} ${year}`;
}

export function extractPriceRange(priceRange: string | undefined): {
  minPrice?: number;
  maxPrice?: number;
} {
  if (!priceRange || priceRange === 'all') return {};
  if (priceRange.endsWith('+')) {
    const minPrice = Number.parseInt(priceRange.replace(/[^\d]/g, ''), 10);
    return Number.isNaN(minPrice) ? {} : { minPrice };
  }
  const [rawMin, rawMax] = priceRange.split('-');
  const minPrice = Number.parseInt(rawMin ?? '', 10);
  const maxPrice = Number.parseInt(rawMax ?? '', 10);
  const result: { minPrice?: number; maxPrice?: number } = {};
  if (!Number.isNaN(maxPrice)) result.maxPrice = maxPrice;
  if (!Number.isNaN(minPrice) && minPrice > 0) result.minPrice = minPrice;
  return result;
}

export function buildProjectQueryParams(q: PublicProjectsQuery): Record<string, string> {
  const params: Record<string, string> = {
    page: String(q.page),
    limit: String(q.limit),
  };
  if (q.search?.trim()) params.search = q.search.trim();
  if (q.propertyType && q.propertyType !== 'all') params.propertyType = q.propertyType;
  const unitType = mapBedsToUnitType(q.beds);
  if (unitType) params.unitType = unitType;
  if (q.baths && q.baths.length > 0) params.baths = q.baths.join(',');
  const { minPrice, maxPrice } = extractPriceRange(q.priceRange);
  if (minPrice !== undefined) params.minPrice = String(minPrice);
  if (maxPrice !== undefined) params.maxPrice = String(maxPrice);
  const handoverDate = mapHandoverToApiFormat(q.handover);
  if (handoverDate) params.handoverDate = handoverDate;
  if (q.city && q.city !== 'all') params.stateId = q.city;
  if (q.status && q.status !== 'all') {
    params.availability = q.status.toLowerCase().replace('-', '_');
  }
  return params;
}
