/**
 * Edit-mode prefill. Fetches the listing (per branch) plus its property/owner
 * and media, and returns fully-seeded wizard state (forms + local objects) +
 * the pre-seeded `created` id bag. Mirrors the web wizard's resume hydration.
 */

import { useQuery } from '@tanstack/react-query';

import {
  getLeadDetail,
  getOpportunityDetail,
  getOpportunityListingMedia,
  getOpportunityListingPermit,
  getPrimaryListingMedia,
  getPrimaryListingPermit,
  getPrimaryListingRaw,
  getSecondaryListingRaw,
  type OpportunityDetail,
} from '../services';
import {
  primaryToInformation,
  primaryToPublish,
  secondaryToInformation,
  secondaryToPublish,
  toContent,
  toDescription,
  toWebsite,
} from '../mappers.edit';
import { toReviewState, type ReviewState } from '../review-state';
import type { ListingBranch } from '../types';
import type { DescriptionValues } from '../forms/description.schema';
import type { InformationValues } from '../forms/information.schema';
import type { WizardContentInput } from './use-save-media';
import type { WizardPublish, WizardWebsiteContent } from '../portals.model';
import type { WizardCreated } from './use-save-content';

export interface EditHydration {
  created: WizardCreated;
  information: InformationValues;
  description: DescriptionValues;
  content: WizardContentInput;
  publish: WizardPublish;
  website: WizardWebsiteContent;
  /** Server-authoritative review-workflow state (status, isReviewer, notes, …). */
  review: ReviewState;
  /** Display-only extras (labels the form fields need but don't store as ids). */
  meta: { communityName?: string };
}

function amenityIdsOf(amenities?: { amenityId?: string | null }[] | null): string[] {
  return (amenities ?? []).map((a) => a.amenityId).filter((id): id is string => !!id);
}

async function hydratePrimary(listingId: string): Promise<EditHydration> {
  const raw = await getPrimaryListingRaw(listingId);
  const media = await getPrimaryListingMedia(listingId);
  const permit = await getPrimaryListingPermit(listingId).catch(() => null);
  return {
    created: { branch: 'primary', listingId },
    information: primaryToInformation(raw),
    description: toDescription(raw.sections),
    content: toContent(raw.sections, amenityIdsOf(raw.amenities), media),
    publish: primaryToPublish(raw, permit),
    website: toWebsite(raw.sections),
    review: toReviewState(raw),
    meta: { communityName: raw.neighbourhoodName ?? undefined },
  };
}

async function hydrateSecondary(listingId: string): Promise<EditHydration> {
  const raw = await getSecondaryListingRaw(listingId);
  const opportunityId = raw.opportunityId ?? undefined;
  const opp: OpportunityDetail = opportunityId ? await getOpportunityDetail(opportunityId) : {};
  // Owner-first listings embed the owner on the listing read and have no lead row at
  // all — only the legacy lead-based ones need the extra `/leads` fetch.
  const ownerId = raw.owner?.id ?? undefined;
  const leadId = ownerId === undefined ? (opp.leadId ?? undefined) : undefined;
  const lead = leadId ? await getLeadDetail(leadId) : { id: '' };
  const media = await getOpportunityListingMedia(listingId);
  const permit = await getOpportunityListingPermit(listingId).catch(() => null);
  const communityName =
    opp.neighbourhood?.name ?? raw.sections?.location?.locationName ?? undefined;
  return {
    created: { branch: 'secondary', listingId, opportunityId, leadId, ownerId },
    information: secondaryToInformation(raw, opp, lead),
    description: toDescription(raw.sections),
    content: toContent(raw.sections, amenityIdsOf(raw.amenities), media),
    publish: secondaryToPublish(raw, permit),
    website: toWebsite(raw.sections),
    review: toReviewState(raw),
    meta: { communityName },
  };
}

/**
 * Shared query options for the edit-prefill bundle — used by the hook and by the
 * detail screen's prefetch so opening Edit is instant (served from cache). The
 * cache is kept alive across navigation (gcTime) but stays fresh on open
 * (staleTime 0 → shows cached immediately, refetches in the background).
 */
export function listingEditQueryOptions(listingId: string | undefined, branch: ListingBranch) {
  return {
    queryKey: ['listing-edit', branch, listingId] as const,
    enabled: !!listingId,
    staleTime: 0,
    gcTime: 5 * 60_000,
    queryFn: (): Promise<EditHydration> => {
      if (!listingId) throw new Error('Listing id is required');
      return branch === 'primary' ? hydratePrimary(listingId) : hydrateSecondary(listingId);
    },
  };
}

export function useListingEditHydration(listingId: string | undefined, branch: ListingBranch) {
  return useQuery<EditHydration, Error>(listingEditQueryOptions(listingId, branch));
}
