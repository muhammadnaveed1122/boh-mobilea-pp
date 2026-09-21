import { useQuery } from '@tanstack/react-query';
import { getListingById } from '../services';
import { getPrimaryListingDetail } from '../services.primary';
import type { ListingDetail, ListingKind } from '../types';

/**
 * Fetch a single listing's detail. `kind` selects the source: `secondary`
 * (opportunity-listing, default) or `primary` (project CMS page), mapped into
 * the same `ListingDetail` shape so one screen renders both.
 */
export function useListingDetail(id: string | undefined, kind: ListingKind = 'secondary') {
  return useQuery<ListingDetail, Error>({
    queryKey: ['listing', kind, id],
    queryFn: () => {
      if (!id) {
        throw new Error('Listing id is required');
      }
      return kind === 'primary' ? getPrimaryListingDetail(id) : getListingById(id);
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
