import { formatSizeRange } from '@/features/new-projects/utils/format';
import type {
  BuyProjectItem,
  OpportunityListItem,
  PropertyBadge,
  PropertyCard,
  PropertyCardMedia,
} from '../types';
import { isHttpUrl } from './record';
import {
  isBathroomExcludedPropertyType,
  isBedroomExcludedPropertyType,
  sanitizeBuyListingTitle,
  syncListingTitleBedroomsBathrooms,
  syncListingTitlePrice,
  unitPriceLabel,
} from './web-format';

/** Dedupe by URL, preserving order and each slide's media type. */
function dedupeMedia(items: (PropertyCardMedia | null | undefined)[]): PropertyCardMedia[] {
  const out: PropertyCardMedia[] = [];
  for (const item of items) {
    if (item && isHttpUrl(item.url) && !out.some((existing) => existing.url === item.url)) {
      out.push(item);
    }
  }
  return out;
}

/** Project/listing hero fields are always stills — only opportunity media carries video. */
function asImage(url: string | null | undefined): PropertyCardMedia | null {
  return typeof url === 'string' ? { url, type: 'image' } : null;
}

function positiveCount(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && value > 0 ? value : undefined;
}

function availabilityBadge(value: string | null | undefined): PropertyBadge | undefined {
  if (value === 'ready') return 'Ready';
  if (value === 'off_plan') return 'Off-Plan';
  return undefined;
}

/** Flatten a buy project + each of its listings into individual cards (mirrors web). */
export function buyProjectToCards(project: BuyProjectItem): PropertyCard[] {
  const projectImages = [
    asImage(project.heroPrimaryImageUrl),
    ...(project.heroImageUrl ?? []).map((img) => asImage(img?.img_url)),
  ];
  const location =
    project.locationLine?.trim() ||
    [project.neighborhood, project.cityName].filter(Boolean).join(', ') ||
    undefined;
  const badge = availabilityBadge(project.availability);

  return (project.listings ?? [])
    .filter((listing) => typeof listing.slug === 'string' && listing.slug.trim().length > 0)
    .map((listing) => {
      const size =
        listing.sizeMin != null || listing.sizeMax != null
          ? formatSizeRange(listing.sizeMin, listing.sizeMax)
          : undefined;
      const numericPrice =
        typeof listing.price === 'number' && listing.price > 0 ? listing.price : undefined;

      // Web hides bed/bath counts for property types that have neither (plots,
      // office, retail, warehouse) and keeps the title's BR/BA markers in sync
      // with the live counts and price. Mirrors transformBuyItemToCard.
      const beds = isBedroomExcludedPropertyType(listing.propertyType)
        ? undefined
        : positiveCount(listing.bedrooms);
      const baths = isBathroomExcludedPropertyType(listing.propertyType)
        ? undefined
        : positiveCount(listing.bathrooms);

      const rawTitle = listing.title?.trim() || project.projectName?.trim() || 'Property';
      const title = syncListingTitlePrice(
        syncListingTitleBedroomsBathrooms(
          sanitizeBuyListingTitle(rawTitle, listing.propertyType),
          beds ?? 0,
          baths ?? 0,
          listing.propertyType,
        ),
        numericPrice,
      );

      return {
        id: `buy-${listing.id}`,
        kind: 'buy-project' as const,
        favoriteId: listing.id,
        title,
        propertyType: listing.propertyType ?? undefined,
        media: dedupeMedia([...projectImages, asImage(listing.heroImageUrl)]),
        location,
        beds,
        baths,
        area: size,
        priceLabel: unitPriceLabel(listing.price),
        priceValue: numericPrice,
        badge,
        timestamp: listing.publishedAt ?? listing.createdAt ?? project.publishedAt ?? undefined,
        assignedAgent: listing.assignedAgent ?? null,
        reference: listing.reference?.trim() || undefined,
        projectSlug: project.slug,
        listingSlug: listing.slug ?? undefined,
      };
    });
}

/** Map a public opportunity listing into a card (mirrors web). */
export function opportunityToCard(item: OpportunityListItem): PropertyCard | null {
  const slug = item.slug?.trim();
  if (!slug) return null;

  const { property } = item;
  const sortedMedia: PropertyCardMedia[] = [...(item.media ?? [])]
    .filter((m) => isHttpUrl(m.mediaUrl))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((m) => ({
      url: m.mediaUrl,
      // Backend writes 'video' for any video/* mimetype (opportunity-listing-media.service).
      type: m.mediaType?.toLowerCase().includes('video') ? ('video' as const) : ('image' as const),
    }));

  const location =
    property?.buildingProjectAddress?.trim() || property?.state?.name?.trim() || undefined;
  const builtUp = property?.builtUpArea?.trim();
  const area = builtUp ? `${builtUp} ${property?.builtUpAreaUnit?.trim() || 'sqft'}` : undefined;

  return {
    id: `opp-${item.id}`,
    kind: 'opportunity',
    favoriteId: item.id,
    title: item.title?.trim() || slug,
    propertyType: property?.propertyType ?? undefined,
    media: dedupeMedia([asImage(item.heroImageUrl), ...sortedMedia]),
    location,
    beds: positiveCount(property?.bedrooms),
    baths: positiveCount(property?.bathrooms),
    area,
    priceLabel: unitPriceLabel(item.price),
    priceValue: typeof item.price === 'number' && item.price > 0 ? item.price : undefined,
    badge: undefined,
    timestamp: item.publishedAt ?? item.createdAt,
    assignedAgent: item.assignedAgent ?? null,
    reference: item.reference?.trim() || undefined,
    slug,
  };
}

/** Merge both sources newest-first. */
export function mergeFeed(cards: PropertyCard[]): PropertyCard[] {
  return [...cards].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });
}
