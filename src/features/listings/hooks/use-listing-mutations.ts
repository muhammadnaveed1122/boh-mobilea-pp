import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignOpportunityListing, changeOpportunityListingStage } from '../services';
import { assignListingAgent, changeListingStage } from '../services.primary';
import type { ListingKind } from '../types';

/** Invalidates every listings query (both 'primary' and 'all'/secondary keys). */
function useInvalidateListings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['listings'] }).catch(() => {});
}

export function useChangeListingStage(kind: ListingKind) {
  const invalidate = useInvalidateListings();
  return useMutation<void, Error, { listingId: string; stageId: string | null }>({
    mutationFn: ({ listingId, stageId }) =>
      kind === 'primary'
        ? changeListingStage(listingId, stageId)
        : changeOpportunityListingStage(listingId, stageId),
    onSuccess: invalidate,
  });
}

export function useAssignListingAgent(kind: ListingKind) {
  const invalidate = useInvalidateListings();
  return useMutation<void, Error, { listingId: string; assigneeId: string | null }>({
    mutationFn: ({ listingId, assigneeId }) =>
      kind === 'primary'
        ? assignListingAgent(listingId, assigneeId)
        : assignOpportunityListing(listingId, assigneeId),
    onSuccess: invalidate,
  });
}
