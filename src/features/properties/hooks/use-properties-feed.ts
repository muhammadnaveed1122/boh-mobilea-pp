import { useQuery } from '@tanstack/react-query';
import { getPropertiesFeed, type ListingType } from '../services';
import type { PropertyCard } from '../types';

/**
 * The full mixed feed for a listing type (buy|rent), merged newest-first.
 * Buy and rent use separate cache buckets so they never clobber each other.
 */
export function usePropertiesFeed(listingType: ListingType = 'buy') {
  return useQuery<PropertyCard[], Error>({
    queryKey: ['properties', 'feed', listingType],
    queryFn: () => getPropertiesFeed(listingType),
    staleTime: 5 * 60_000,
  });
}
