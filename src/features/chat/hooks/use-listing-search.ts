import { useQuery } from '@tanstack/react-query';

import { searchListings } from '../api/listing-search';
import { chatKeys } from './keys';

/** Listing lookup backing the broadcast attachment picker. */
export function useListingSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.listingSearch(search),
    queryFn: () => searchListings(search),
    enabled,
    staleTime: 60_000,
  });
}
