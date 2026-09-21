import { useMutation } from '@tanstack/react-query';

import { upsertOpportunityListingAmenities, upsertPrimaryListingAmenities } from '../services';
import type { WizardCreated } from './use-save-content';

export interface SaveAmenitiesArgs {
  created: WizardCreated;
  selectedAmenityIds: string[];
}

export function useSaveAmenities() {
  return useMutation<void, Error, SaveAmenitiesArgs>({
    mutationFn: async ({ created, selectedAmenityIds }) => {
      if (created.listingId === undefined) {
        throw new Error('Save the earlier steps first.');
      }
      if (created.branch === 'primary') {
        await upsertPrimaryListingAmenities(created.listingId, selectedAmenityIds);
        return;
      }
      await upsertOpportunityListingAmenities(created.listingId, selectedAmenityIds);
    },
  });
}
