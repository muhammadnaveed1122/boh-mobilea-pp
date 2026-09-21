import { useMutation } from '@tanstack/react-query';

import type { DescriptionValues } from '../forms/description.schema';
import {
  createOpportunityListing,
  upsertOpportunityListingHero,
  upsertPrimaryListingHero,
} from '../services';
import type { ListingBranch } from '../types';

/** Ids + branch produced by the Information step; carried into the Description step. */
export interface WizardCreated {
  branch: ListingBranch;
  leadId?: string;
  /** Owner-first owner record (modern listings); mutually exclusive with `leadId`. */
  ownerId?: string;
  opportunityId?: string;
  listingId?: string;
}

export interface SaveContentArgs {
  created: WizardCreated;
  values: DescriptionValues;
}

/**
 * Persists the Description step's hero (Title + Description). Secondary: creates the
 * opportunity-listing on first save (when no listingId yet), then upserts hero. Primary:
 * upserts the CMS hero section on the listing created in the Information step. Resolves
 * the listing id so the caller can store it (idempotent re-saves upsert the same listing).
 */
export function useSaveContent() {
  return useMutation<string, Error, SaveContentArgs>({
    mutationFn: async ({ created, values }) => {
      const fields = { title: values.title, description: values.description };

      if (created.branch === 'primary') {
        if (created.listingId === undefined) {
          throw new Error('Create the listing first.');
        }
        await upsertPrimaryListingHero(created.listingId, fields);
        return created.listingId;
      }

      // secondary
      if (created.opportunityId === undefined) {
        throw new Error('Save the property step first.');
      }
      let listingId = created.listingId;
      if (listingId === undefined) {
        const listing = await createOpportunityListing(created.opportunityId, {
          name: values.title.trim().slice(0, 120),
        });
        listingId = listing.id;
      }
      await upsertOpportunityListingHero(listingId, fields);
      return listingId;
    },
  });
}
