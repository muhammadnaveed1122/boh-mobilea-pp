import type { ListingCallContext, PropertyCard, PropertyDetailTarget } from '../types';
import { listingWebUrl } from './web-url';

/**
 * Attribution carried by the Call dialog's callback lead. A project listing sends
 * `projectSlug`/`listingSlug` + `listingIds`; an opportunity sends the `opportunityListing*` pair
 * instead — the backend links the lead through whichever pair it gets (mirrors web
 * `buildAttribution`).
 */
export function buildListingCallContext(
  target: PropertyDetailTarget,
  { reference, listingId }: { reference?: string; listingId?: string },
): ListingCallContext {
  const shared = { reference, pageUrl: listingWebUrl(target) };
  if (target.kind === 'opportunity') {
    return { ...shared, opportunityListingSlug: target.slug, opportunityListingId: listingId };
  }
  return {
    ...shared,
    projectSlug: target.projectSlug,
    listingSlug: target.listingSlug,
    listingId,
  };
}

/** The detail-fetch target a feed card points at — also what its contact actions attribute to. */
export function cardTarget(card: PropertyCard): PropertyDetailTarget {
  return card.kind === 'opportunity'
    ? { kind: 'opportunity', slug: card.slug ?? '' }
    : {
        kind: 'buy-project',
        projectSlug: card.projectSlug ?? '',
        listingSlug: card.listingSlug ?? '',
      };
}
