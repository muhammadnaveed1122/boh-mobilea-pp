/**
 * Activity timeline for the wizard. Fetches the listing's review history (newest
 * first) per branch. Enabled only once the listing exists (edit mode); lazily
 * fetched when the Activity sheet opens.
 */

import { useQuery } from '@tanstack/react-query';

import { getListingCmsHistory, getOpportunityListingHistory } from '../services';
import type { WizardCreated } from './use-save-content';

export function useListingHistory(created: WizardCreated | null, enabled: boolean) {
  const branch = created?.branch;
  const listingId = created?.listingId;
  return useQuery({
    queryKey: ['listing-history', branch, listingId] as const,
    enabled: enabled && !!listingId && !!branch,
    staleTime: 30_000,
    queryFn: () => {
      if (!listingId || !branch) throw new Error('Listing id is required');
      return branch === 'primary'
        ? getListingCmsHistory(listingId)
        : getOpportunityListingHistory(listingId);
    },
  });
}
