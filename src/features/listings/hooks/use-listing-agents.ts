import { useQuery } from '@tanstack/react-query';
import { getListingAgents } from '../services';
import type { ListingAgent } from '../types';

export function useListingAgents() {
  return useQuery<ListingAgent[], Error>({
    queryKey: ['listing-agents'],
    queryFn: getListingAgents,
    staleTime: 5 * 60_000,
  });
}
