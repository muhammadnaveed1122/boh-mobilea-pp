/**
 * Review-workflow mutations for the wizard: submit-for-review, approve,
 * request-changes, and (un)publish. Each PATCHes the right `.../publish`
 * endpoint per branch and invalidates the edit + history caches so the banner,
 * badge, and timeline refresh. Mirrors the web wizard's `finish` / banner acts.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { publishListingCms, publishOpportunityListing, type PublishListingBody } from '../services';
import type { PublishOverrideStatus } from '../review-state';
import type { WizardCreated } from './use-save-content';

const NOT_CREATED = 'Listing has not been created yet.';

function publishFor(created: WizardCreated, body: PublishListingBody): Promise<void> {
  const listingId = created.listingId;
  if (!listingId) throw new Error(NOT_CREATED);
  return created.branch === 'primary'
    ? publishListingCms(listingId, body)
    : publishOpportunityListing(listingId, body);
}

/** Invalidate everything that reflects review state for this listing. */
function useInvalidateReview(created: WizardCreated | null) {
  const qc = useQueryClient();
  return () => {
    if (!created?.listingId) return;
    const { branch, listingId } = created;
    const swallow = (): void => {};
    qc.invalidateQueries({ queryKey: ['listing-edit', branch, listingId] }).catch(swallow);
    qc.invalidateQueries({ queryKey: ['listing-history', branch, listingId] }).catch(swallow);
    qc.invalidateQueries({ queryKey: ['listings'] }).catch(swallow);
  };
}

export function useReviewMutations(created: WizardCreated | null) {
  const invalidate = useInvalidateReview(created);

  const submitForReview = useMutation<void, Error, { status: PublishOverrideStatus }>({
    mutationFn: ({ status }) => {
      if (!created) throw new Error(NOT_CREATED);
      return publishFor(created, { isPublished: false, status });
    },
    onSuccess: invalidate,
  });

  const approve = useMutation<void, Error, void>({
    mutationFn: () => {
      if (!created) throw new Error(NOT_CREATED);
      return publishFor(created, { isPublished: false, status: 'approved' });
    },
    onSuccess: invalidate,
  });

  const requestChanges = useMutation<void, Error, { changeNotes: string }>({
    mutationFn: ({ changeNotes }) => {
      if (!created) throw new Error(NOT_CREATED);
      return publishFor(created, { isPublished: false, status: 'changes_requested', changeNotes });
    },
    onSuccess: invalidate,
  });

  const setPublished = useMutation<void, Error, { isPublished: boolean }>({
    mutationFn: ({ isPublished }) => {
      if (!created) throw new Error(NOT_CREATED);
      return publishFor(created, { isPublished });
    },
    onSuccess: invalidate,
  });

  return { submitForReview, approve, requestChanges, setPublished };
}
