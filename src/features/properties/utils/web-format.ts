/*
 * Sonar flags several regexes below as backtracking-prone. They are ported
 * verbatim from web so the two apps format identically, and they only ever run
 * over short listing titles from our own API — never user input — so the
 * super-linear case is unreachable. Rewriting them would break parity.
 */
/* eslint-disable sonarjs/slow-regex */

/**
 * Formatting parity with the web app (`boh-lead-magnet`).
 *
 * The Buy/Rent cards must render byte-identical strings to `/buy-with-us` and
 * `/rent-with-us`. These are direct ports — when the web helpers change, change
 * these too. Web sources:
 *  - `src/utils/formatters.ts`                        → formatAedPrice
 *  - `src/features/projects/api/projectsListingApi.ts` → bed/bath exclusions, title sanitize
 *  - `src/features/projects/utils/listingTitleSanitizer.ts` → title <-> price/beds sync
 */

const BEDROOM_EXCLUDED_PROPERTY_TYPES = [
  'residential_plot',
  'commercial_plot',
  'office',
  'retail',
  'warehouse',
];

const BATHROOM_EXCLUDED_PROPERTY_TYPES = [
  'residential_plot',
  'commercial_plot',
  'retail',
  'warehouse',
];

const NON_STAT_TITLE_RE = /(residential plot|commercial plot|office|retail|warehouse)/i;
const AED_PRICE_SEGMENT_RE = /\bAED\s*[\d,.]+(?:\.\d+)?(?:\s*[KMB])?\b/gi;
const BR_SEGMENT_RE = /\s*[-/]\s*\d+\s*BR\b/gi;
const BA_SEGMENT_RE = /\s*[-/]\s*\d+\s*BA\b/gi;
const BR_COUNT_RE = /\b\d+\s*BR\b/gi;
const BA_COUNT_RE = /\b\d+\s*BA\b/gi;

function normalizePropertyTypeKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';
}

export function isBedroomExcludedPropertyType(value: string | null | undefined): boolean {
  const normalized = normalizePropertyTypeKey(value);
  return normalized !== '' && BEDROOM_EXCLUDED_PROPERTY_TYPES.includes(normalized);
}

export function isBathroomExcludedPropertyType(value: string | null | undefined): boolean {
  const normalized = normalizePropertyTypeKey(value);
  return normalized !== '' && BATHROOM_EXCLUDED_PROPERTY_TYPES.includes(normalized);
}

// ---------- price ----------

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$|(\.\d*?)0+$/, '$1');
}

function formatCompactPriceValue(value: number, divisor: number, suffix: string): string {
  const compact = value / divisor;
  const fractionDigits =
    Number.isInteger(compact) || Math.round(compact * 10) === compact * 10 ? 1 : 2;
  return trimTrailingZeros(compact.toFixed(fractionDigits)) + suffix;
}

/** 8500 → "AED 8.5K", 8_500_000 → "AED 8.5M". Empty string for zero/invalid. */
export function formatAedPrice(priceNum: number | null | undefined): string {
  if (!priceNum || Number.isNaN(priceNum) || priceNum <= 0) {
    return '';
  }
  if (priceNum >= 1_000_000_000) {
    return `AED ${formatCompactPriceValue(priceNum, 1_000_000_000, 'B')}`;
  }
  if (priceNum >= 1_000_000) {
    return `AED ${formatCompactPriceValue(priceNum, 1_000_000, 'M')}`;
  }
  if (priceNum >= 1_000) {
    return `AED ${formatCompactPriceValue(priceNum, 1_000, 'K')}`;
  }
  return `AED ${priceNum.toLocaleString('en-US')}`;
}

/** The card's unit-price string: compact AED, or "Price on request". */
export function unitPriceLabel(price: number | null | undefined): string {
  return formatAedPrice(price) || 'Price on request';
}

// ---------- title ----------

function cleanupTitleSpacing(title: string): string {
  return title
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+-\s+/g, ' - ')
    .trim();
}

function hasBedroomCount(title: string): boolean {
  return /\b\d+\s*BR\b/i.test(title);
}

function hasBathroomCount(title: string): boolean {
  return /\b\d+\s*BA\b/i.test(title);
}

function insertMissingStats(
  title: string,
  bedrooms: number | undefined,
  bathrooms: number | undefined,
): string {
  const stats: string[] = [];
  if (!hasBedroomCount(title) && typeof bedrooms === 'number' && bedrooms > 0) {
    stats.push(`${bedrooms}BR`);
  }
  if (!hasBathroomCount(title) && typeof bathrooms === 'number' && bathrooms > 0) {
    stats.push(`${bathrooms}BA`);
  }
  if (stats.length === 0) {
    return title;
  }

  const segments = title
    .split(/\s+-\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length < 3) {
    return cleanupTitleSpacing(`${title} - ${stats.join(' - ')}`);
  }

  const next = [...segments];
  next.splice(Math.min(3, next.length), 0, ...stats);
  return cleanupTitleSpacing(next.join(' - '));
}

/** Strip BR/BA markers from titles of property types that have no bed/bath. */
export function sanitizeBuyListingTitle(
  title: string,
  propertyType: string | null | undefined,
): string {
  const shouldStrip = isBedroomExcludedPropertyType(propertyType) || NON_STAT_TITLE_RE.test(title);
  if (!shouldStrip) {
    return title.trim();
  }

  const keepBathrooms =
    normalizePropertyTypeKey(propertyType) === 'office' ||
    (propertyType == null && /\boffice\b/i.test(title));

  let sanitized = title.replace(BR_SEGMENT_RE, '');
  if (!keepBathrooms && isBathroomExcludedPropertyType(propertyType)) {
    sanitized = sanitized.replace(BA_SEGMENT_RE, '');
  }
  return cleanupTitleSpacing(sanitized);
}

/** Align stale BR/BA markers in a saved title with the live counts. */
export function syncListingTitleBedroomsBathrooms(
  title: string,
  bedrooms: number | undefined,
  bathrooms: number | undefined,
  propertyType: string | null | undefined,
): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return '';
  }

  const hideStats = isBedroomExcludedPropertyType(propertyType) || NON_STAT_TITLE_RE.test(trimmed);
  if (hideStats) {
    return cleanupTitleSpacing(trimmed.replace(BR_SEGMENT_RE, '').replace(BA_SEGMENT_RE, ''));
  }

  let next = trimmed;
  if (typeof bedrooms === 'number' && !Number.isNaN(bedrooms)) {
    next =
      bedrooms > 0 ? next.replace(BR_COUNT_RE, `${bedrooms}BR`) : next.replace(BR_SEGMENT_RE, '');
  }
  if (typeof bathrooms === 'number' && !Number.isNaN(bathrooms)) {
    next =
      bathrooms > 0 ? next.replace(BA_COUNT_RE, `${bathrooms}BA`) : next.replace(BA_SEGMENT_RE, '');
  }

  if (!hasBedroomCount(next) || !hasBathroomCount(next)) {
    next = insertMissingStats(next, bedrooms, bathrooms);
  }
  return cleanupTitleSpacing(next);
}

/** Replace a title's trailing AED amount with the live price. */
export function syncListingTitlePrice(title: string, price: number | undefined): string {
  const trimmed = title.trim();
  if (!trimmed || price === undefined || Number.isNaN(price) || price <= 0) {
    return trimmed;
  }
  const formatted = formatAedPrice(price);
  if (!formatted) {
    return trimmed;
  }
  const matches = [...trimmed.matchAll(AED_PRICE_SEGMENT_RE)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) {
    return trimmed;
  }
  return `${trimmed.slice(0, last.index)}${formatted}${trimmed.slice(last.index + last[0].length)}`;
}
