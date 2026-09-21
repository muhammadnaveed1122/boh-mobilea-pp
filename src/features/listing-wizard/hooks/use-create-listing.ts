import { useMutation } from '@tanstack/react-query';

import type { InformationValues } from '../forms/information.schema';
import { buildLeadBody, buildOpportunityBody, buildPrimaryListingBody } from '../mappers';
import { createLead, createOpportunity, createPrimaryListing } from '../services';
import { branchFor } from '../types';

export type CreateListingResult =
  | { kind: 'listing'; id: string }
  | { kind: 'opportunity'; id: string; leadId: string };

/**
 * Submits the wizard's Information step. Primary → POST /listings. Secondary → POST /leads
 * (skipped when reusing an existing owner) then POST /opportunities (skipped when reusing an
 * existing property). Form validation is enforced upstream via the form's onSubmit schema, so
 * this only runs for a valid payload.
 */
export function useCreateListing() {
  return useMutation<CreateListingResult, Error, InformationValues>({
    mutationFn: async (values) => {
      const branch = branchFor(values.completionStatus);

      if (branch === 'primary') {
        const listing = await createPrimaryListing(buildPrimaryListingBody(values));
        return { kind: 'listing', id: listing.id };
      }

      if (branch === 'secondary') {
        const reuseOwner =
          values.ownerSourceMode === 'existing_owner' && values.existingOwnerId.trim() !== '';
        const leadId = reuseOwner
          ? values.existingOwnerId.trim()
          : (await createLead(buildLeadBody(values))).id;

        const reuseProperty =
          values.propertySourceMode === 'existing' && values.existingPropertyId.trim() !== '';
        if (reuseProperty) {
          return { kind: 'opportunity', id: values.existingPropertyId.trim(), leadId };
        }

        const opportunity = await createOpportunity(buildOpportunityBody(values, leadId));
        return { kind: 'opportunity', id: opportunity.id, leadId };
      }

      throw new Error('Select a completion status before saving.');
    },
  });
}
