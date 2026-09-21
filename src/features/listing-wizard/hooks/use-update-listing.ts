import { useMutation } from '@tanstack/react-query';

import type { InformationValues } from '../forms/information.schema';
import {
  buildLeadUpdate,
  buildOpportunityUpdate,
  buildOwnerUpdate,
  buildPrimaryCoreUpdate,
  buildPrimaryDetailsUpdate,
} from '../mappers.edit';
import {
  updateListingLead,
  updateListingOwner,
  updateOpportunity,
  updatePrimaryListingCore,
  updatePrimaryListingDetails,
} from '../services';
import type { WizardCreated } from './use-save-content';

export interface UpdateInformationArgs {
  created: WizardCreated;
  values: InformationValues;
}

/**
 * Edit-mode Information save. Primary → PATCH listing details (wizard-state) +
 * core (purpose/availability). Secondary → PATCH the owner (the owner-first Owner
 * record, or the legacy linked lead) + opportunity (property/pricing). Purpose
 * lives on the opportunity/listing, so it persists here; PF config is saved in
 * the Portals step as in create.
 */
export function useUpdateListing() {
  return useMutation<void, Error, UpdateInformationArgs>({
    mutationFn: async ({ created, values }) => {
      if (created.branch === 'primary') {
        if (created.listingId === undefined) throw new Error('Missing listing id.');
        await updatePrimaryListingDetails(created.listingId, buildPrimaryDetailsUpdate(values));
        await updatePrimaryListingCore(created.listingId, buildPrimaryCoreUpdate(values));
        return;
      }
      if (created.ownerId !== undefined) {
        await updateListingOwner(created.ownerId, buildOwnerUpdate(values));
      } else if (created.leadId !== undefined) {
        await updateListingLead(created.leadId, buildLeadUpdate(values));
      }
      if (created.opportunityId !== undefined) {
        await updateOpportunity(created.opportunityId, buildOpportunityUpdate(values));
      }
    },
  });
}
